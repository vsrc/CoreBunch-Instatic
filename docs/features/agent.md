# AI Agent

The AI Agent — a Claude-powered assistant integrated into the visual editor. The user types a request in the Agent Panel; the agent reads the current page snapshot, plans a sequence of edits, and executes them by calling MCP tools that bridge to the editor store.

The agent runs on the **Anthropic Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) — the plain `@anthropic-ai/sdk` is banned, gated by `no-anthropic-sdk.test.ts`. Authentication is ambient via the user's local Claude Code credentials (no API key, no env var).

---

## TL;DR

- Server endpoint: `POST /admin/api/agent` — opens a streaming NDJSON response. The browser sends `{ prompt, sessionId, pageContext }`; the server runs `query(...)` from the SDK and streams events back.
- Bridge endpoint: `POST /admin/api/agent/tool-result` — the browser delivers the result of a write tool it just executed against the editor store.
- Server tools: `server/handlers/agent/tools.ts` — defined with `tool()` from the SDK (uses Zod, the **one legitimate Zod use** in the repo).
- Client store: `agentSlice` inside the editor store, persisted across page reloads.
- Two tool classes:
  - **Read tools** — resolved server-side from the page snapshot the browser sent.
  - **Write tools** — bridged back to the browser, which applies them against the editor store and POSTs the result back.
- Auth: ambient Claude Code credentials. Constraint #385.

---

## Where the code lives

```text
server/handlers/agent/
├── index.ts                  — /admin/api/agent + /admin/api/agent/tool-result endpoints
└── tools.ts                  — MCP tool definitions (uses Zod; the only legitimate Zod use)

src/admin/pages/site/agent/
├── agentSlice.ts             — Zustand slice (messages, in-flight stream, ...)
├── agentConfig.ts            — model + system-prompt config
├── systemPrompt.ts           — buildSystemPrompt(ctx)
├── executor.ts               — client-side dispatcher: receives toolRequest events, runs them against the store, POSTs results back
├── markdown.ts               — markdown rendering for agent messages
├── renderEvidence.ts         — extract a serializable page snapshot from the editor store
├── storeRef.ts               — bridge reference held by SpotlightRoot
├── systemPrompt.ts           — system prompt assembler
└── types.ts                  — ServerStreamEvent, AgentMessage, AgentToolCall, ...
```

Plus the Agent Panel UI inside `src/admin/pages/site/panels/AgentPanel/`.

---

## Flow

```text
User types prompt in Agent Panel
    │
    ▼
agentSlice.run(prompt)
    │
    ├─→ snapshot = renderEvidence(state)         ← serializable page context
    ├─→ POST /admin/api/agent { prompt, sessionId, pageContext: snapshot }
    │
    ▼
Server: validates request, builds CommandContext + MCP server
    │
    ├─→ query(SDK, { systemPrompt, mcpServers, signal }) starts streaming
    │
    ├─→ as Claude calls tools:
    │     - Read tool (e.g. listNodes)         → resolve server-side from snapshot
    │     - Write tool (e.g. insertNode)       → emit toolRequest{ bridgeId, requestId, ... }
    │                                             pending promise pauses tool execution
    │
    ├─→ stream events (NDJSON, one per line):
    │     { kind: 'message-start' }
    │     { kind: 'message-delta', text: '...' }
    │     { kind: 'tool-call', name: 'insertNode', ... }
    │     { kind: 'tool-request', bridgeId, requestId, tool, args }
    │     { kind: 'tool-result', name, result }
    │     { kind: 'message-end' }
    │     { kind: 'done' }
    │
    ▼
Browser executor reads NDJSON:
    │
    ├─→ on 'tool-request': run the write tool against the editor store
    │       (e.g. insertNode(...) via mutateActiveTree)
    │       → POST /admin/api/agent/tool-result { bridgeId, requestId, result }
    │       → server resolves the pending promise → Claude sees tool_result and continues
    │
    └─→ on 'message-delta' / 'message-end' / 'done': update agentSlice.messages
```

The two-endpoint design lets the **browser execute writes** (so the editor store stays the single source of truth) while the **server runs Claude** (so the SDK + tools live where they belong).

---

## The page snapshot

Before sending a prompt, `renderEvidence(state)` extracts a serializable view of the current page:

- `AgentModuleContext[]` — every module on the page with its props, styles, classes
- `AgentLayoutNodeContext[]` — node positions, dimensions, parent / child relationships
- `AgentBreakpointContext[]` — active breakpoint info
- `AgentLayoutImageContext[]` — images with width / height / blurhash

The snapshot is **structured** (not raw page tree JSON) — it's shaped to be useful to Claude without leaking implementation details. The agent prompt instructs Claude to use this snapshot when reasoning about the page.

---

## Server endpoints

### `POST /admin/api/agent`

```ts
// Request body
{
  prompt:      string
  sessionId:   string             // stable across the agent thread
  pageContext: AgentRenderSnapshotPayload
}

// Response: NDJSON stream of ServerStreamEvent
```

The handler:

1. CSRF-checks the request (`originAllowed`).
2. Validates the body via TypeBox.
3. Constructs an MCP server that exposes the page-builder tools (`createPageBuilderMcpServer(...)`).
4. Calls the SDK's `query(...)` with a system prompt + the MCP server.
5. Pipes the stream to the response. Each event is JSON + a newline.

Ambient auth: the SDK uses Claude Code credentials. No env var. The user must have `claude auth login` run on the host. (For the self-hosted case, this is the operator's setup step.)

### `POST /admin/api/agent/tool-result`

```ts
// Request body
{
  bridgeId:  string
  requestId: string
  result:    AgentActionResult       // { ok: true, data?: ... } | { ok: false, error: ... }
}
```

The server maintains a `Map<bridgeId, Map<requestId, PendingPromise>>` of in-flight tool requests. On `tool-result`, it resolves the matching pending promise, which lets the MCP tool handler return → Claude sees the `tool_result` → it continues streaming.

If the bridge id is unknown (e.g. the agent run was aborted), the result is dropped silently.

---

## Tools (MCP)

`server/handlers/agent/tools.ts` defines every tool the agent can call. Each tool is registered via `tool(...)` from the SDK — this is **the only legitimate Zod use** in the codebase, because `tool()` requires `AnyZodRawShape` and TypeBox can't satisfy that type-level constraint.

### Read tools (resolved server-side)

| Tool                  | What it returns                                                  |
|-----------------------|------------------------------------------------------------------|
| `listNodes`           | All nodes on the page with their props and parent / children     |
| `findNode`            | A node by id or query                                            |
| `getModuleSchema`     | A module's `PropertySchema` (what props it accepts)              |
| `getSiteContext`      | Site name, breakpoints, settings                                 |
| `getClassRegistry`    | User-defined CSS classes                                         |
| `listAvailableModules`| Modules in the registry the agent can insert                     |
| `getMediaList`        | Available media assets                                           |
| `getPageList`         | Pages in the site                                                |

These don't need the browser — the snapshot has everything.

### Write tools (bridged to the browser)

| Tool                    | What it does                                                   |
|-------------------------|----------------------------------------------------------------|
| `insertNode`            | Add a new node under a parent                                  |
| `updateNodeProps`       | Patch a node's props                                           |
| `setBreakpointOverride` | Set a per-breakpoint override                                  |
| `moveNode`              | Re-parent / reorder                                            |
| `duplicateNode`         | Clone a subtree                                                |
| `deleteNode`            | Remove a node                                                  |
| `wrapNode`              | Wrap a node in a container                                     |
| `assignClass`           | Add a class to a node                                          |
| `createClass`           | Add a new CSSClass to the registry                             |
| `updateClass`           | Modify a class's style properties                              |
| `setSelection`          | Move the editor selection                                      |
| `publish`               | Publish the current page (step-up-gated)                       |

Each write tool emits a `tool-request` event; the browser executor runs the matching action on the editor store; the result POSTs back.

The mapping from a write tool to a store action lives in `executor.ts`. New write tools require both:
1. A tool definition in `tools.ts`.
2. A handler in `executor.ts` that runs the action on the store.

---

## Client store (`agentSlice`)

```ts
interface AgentSlice {
  sessionId:    string                          // stable per agent thread
  messages:     AgentMessage[]                  // history (user + agent)
  isStreaming:  boolean                         // a query is currently in flight
  abortRef:     AbortController | null

  run:          (prompt: string) => Promise<void>
  abort:        () => void
  reset:        () => void
}
```

`run(prompt)`:

1. Pushes the user message into `messages`.
2. Builds the snapshot via `renderEvidence(state)`.
3. POSTs to `/admin/api/agent` with `AbortController`.
4. Streams NDJSON via `ReadableStream` reader.
5. Routes each event:
   - `message-delta` → append text to the current agent message
   - `tool-request` → call `executor.runWriteTool(bridgeId, requestId, tool, args)` → POST result back
   - `done` → mark streaming complete
6. Persists messages to `localStorage` so the conversation survives reload.

`agentSlice` is one of the 11 slices in the editor store. See [docs/editor.md](../editor.md) for the slice composition.

---

## System prompt

`systemPrompt.ts` builds the system prompt at run time. It includes:

- Instructions on how to use the snapshot.
- A description of the available tools.
- The current breakpoint and selection state.
- The list of installed modules and classes.
- Page-mode vs. VC-mode context.

The system prompt is **assembled per request** — the agent's available actions and the page state are baked in, so it can't go off-script.

---

## Abort + crash recovery

- **Abort.** The Agent Panel's "Stop" button calls `agentSlice.abort()` → `AbortController.abort()` → the fetch stream errors out → the server's `query(...)` receives the same signal and stops. Pending tool requests resolve with `{ ok: false, error: 'aborted' }`.
- **Crash on server.** If the SDK throws (network blip, model error), the stream emits `{ kind: 'error', message }` and the client surfaces the error in the panel.
- **Page reload mid-stream.** The session id is stable, but the in-flight stream dies. The user re-runs the prompt; the server starts fresh.

---

## Forbidden patterns

| Pattern                                                              | Use instead                                              |
|----------------------------------------------------------------------|----------------------------------------------------------|
| Importing `@anthropic-ai/sdk` (the non-agent SDK)                    | `@anthropic-ai/claude-agent-sdk`. Gated.                |
| Calling write tools directly server-side                             | Bridge to the browser. The editor store is the source of truth. |
| Importing Zod outside `server/handlers/agent/tools.ts`               | Use TypeBox. Gated by `no-anthropic-sdk.test.ts`'s import scan. |
| Long-running tool handlers without `signal` handling                 | Tools should be quick. Aborts propagate via the fetch signal. |
| Persisting tool results server-side                                  | The server is stateless w.r.t. agent runs. Persistence lives in the browser. |
| Letting the agent edit data outside the active page tree             | The editor store mutates the page tree; cross-page edits require the user to switch pages first. |
| Bypassing step-up for destructive agent actions (publish, delete page) | Step-up applies the same way as for human commands. |

---

## Related

- [docs/architecture.md](../architecture.md) — `/admin/api/agent` is matched before `/admin/api/cms/*`
- [docs/server.md](../server.md) — server-side handler routing
- [docs/editor.md](../editor.md) — agent slice composition
- [docs/features/auth-and-access.md](auth-and-access.md) — step-up gates for destructive agent actions
- Source-of-truth files:
  - `server/handlers/agent/index.ts` — endpoints
  - `server/handlers/agent/tools.ts` — MCP tool definitions (the legitimate Zod use)
  - `src/admin/pages/site/agent/agentSlice.ts` — client store
  - `src/admin/pages/site/agent/executor.ts` — write-tool dispatcher
  - `src/admin/pages/site/agent/systemPrompt.ts` — system prompt assembly
  - `src/admin/pages/site/agent/types.ts` — ServerStreamEvent, AgentMessage, ...
  - `src/admin/pages/site/agent/renderEvidence.ts` — page snapshot builder
  - `src/admin/pages/site/panels/AgentPanel/` — the UI
- Gate tests:
  - `src/__tests__/architecture/agent-endpoint-auth.test.ts`
  - `src/__tests__/architecture/agent-sdk-integration.test.ts`
  - `src/__tests__/architecture/no-anthropic-sdk.test.ts`
  - `src/__tests__/architecture/task381-agent-panel-tab.test.ts`
  - `src/__tests__/architecture/task390-agent-config.test.ts`
