/**
 * Agent HTTP layer — the network plumbing behind the agent slice.
 *
 * Two responsibilities:
 *   1. Tool-result bridge: convert the executor's legacy `AgentActionResult`
 *      into the canonical `AiToolOutput` and POST it to the server so the
 *      in-flight MCP tool waiter resolves and the driver loop continues.
 *   2. Conversation bootstrap: discover the per-scope default credential,
 *      create the conversation row lazily on first send, and rehydrate
 *      persisted message records back into the in-memory `AgentMessage` shape.
 *
 * The agent slice (agentSlice.ts) and the stream-event processor
 * (streamEvents.ts) call into here; this module owns no React/store state.
 */

import { nanoid } from 'nanoid'
import { Type, type Static } from '@core/utils/typeboxHelpers'
import { apiRequest } from '@core/http'
import {
  AGENT_TOOL_RESULT_PATH,
  AI_CONVERSATIONS_PATH,
  AI_DEFAULTS_PATH,
} from './agentConfig'
import type { ConversationDetail } from '@admin/ai/api'
import type {
  AgentActionResult,
  AgentMessage,
  AgentToolCall,
  AgentToolScope,
} from './types'

// ---------------------------------------------------------------------------
// Tool-result bridge
// ---------------------------------------------------------------------------

/**
 * Convert the legacy `AgentActionResult` (carries `success`, `nodeId`,
 * `snapshot`) into the new `AiToolOutput` shape (`{ ok, data?, error? }`).
 * The Phase 1 server expects the canonical shape; the executor returns the
 * legacy shape for now to minimise blast radius. Adapter lives here.
 */
export function toAiToolOutput(result: AgentActionResult): {
  ok: boolean
  data?: unknown
  error?: string
} {
  if (!result.success) {
    return { ok: false, error: result.error ?? 'Tool call failed.' }
  }
  // Pack the legacy ancillary fields into `data` so the driver can see them.
  // Drivers translate `data` straight into the model's tool_result content.
  const data: Record<string, unknown> = {}
  if (result.nodeId !== undefined) data.nodeId = result.nodeId
  if (result.snapshot !== undefined) data.snapshot = result.snapshot
  return { ok: true, data }
}

export async function postToolResult(
  bridgeId: string,
  requestId: string,
  result: AgentActionResult,
  signal: AbortSignal | null,
): Promise<void> {
  try {
    const res = await fetch(AGENT_TOOL_RESULT_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bridgeId,
        requestId,
        result: toAiToolOutput(result),
      }),
      signal: signal ?? undefined,
    })
    if (!res.ok) {
      // 404 means the bridge is gone (stream closed before our POST landed) —
      // expected race during abort. Anything else is a routing/config issue
      // that would silently leave the agent loop hung server-side.
      console.error(
        `[AgentSlice] tool-result POST failed: ${res.status} ${res.statusText}`,
        { bridgeId, requestId },
      )
    }
  } catch (err) {
    // Network failure or user abort. Server cleans up pending tool resolvers
    // when its bridge is destroyed, so Claude's loop fails with a tool error
    // there.
    if (err instanceof Error && err.name === 'AbortError') return
    console.error('[AgentSlice] Failed to post tool-result:', err)
  }
}

// ---------------------------------------------------------------------------
// Conversation bootstrap
//
// On first send we POST to /admin/api/ai/conversations to create a row, then
// reuse its id for every subsequent send in this session. The conversation
// row carries `(credentialId, modelId)`; the chat handler reads them from
// the row.
//
// If no site default exists yet, conversation creation will 400 — the panel
// renders a "no credential configured" banner in that case.
// ---------------------------------------------------------------------------

/**
 * Translate persisted MessageRecord rows back into the in-memory AgentMessage
 * shape (text + toolCall blocks; tool-result messages are folded back into the
 * preceding tool-call block's `result` so the UI renders the same way fresh
 * messages would).
 */
export function rehydrateMessages(
  records: ConversationDetail['messages'],
): AgentMessage[] {
  const out: AgentMessage[] = []
  const toolCallIndex = new Map<string, AgentToolCall>() // toolCallId → block

  for (const rec of records) {
    if (rec.role === 'tool' && rec.toolCallId) {
      // Fold into the matching tool-call block.
      const existing = toolCallIndex.get(rec.toolCallId)
      if (existing) {
        const errText = rec.content
          .filter((b): b is { kind: 'text'; text: string } => b.kind === 'text')
          .map((b) => b.text)
          .join(' ')
          .trim()
        const ok = errText === ''
        existing.status = ok ? 'success' : 'error'
        existing.result = { success: ok, error: ok ? undefined : errText }
      }
      continue
    }

    const msg: AgentMessage = {
      id: rec.id,
      role: rec.role === 'user' ? 'user' : 'assistant',
      blocks: [],
      timestamp: Date.parse(rec.createdAt) || Date.now(),
    }

    for (const block of rec.content) {
      if (block.kind === 'text') {
        msg.blocks.push({ kind: 'text', text: block.text })
      } else if (block.kind === 'toolCall') {
        const toolCall: AgentToolCall = {
          id: nanoid(),
          externalId: block.toolCallId,
          actionType: block.toolName,
          params: (block.input && typeof block.input === 'object'
            ? (block.input as Record<string, unknown>)
            : {}),
          result: null,
          status: 'pending',
        }
        msg.blocks.push({ kind: 'toolCall', toolCall })
        toolCallIndex.set(block.toolCallId, toolCall)
      }
      // image blocks — skip in v1; could render via <img> later.
    }
    out.push(msg)
  }

  return out
}

const ScopeDefaultEntrySchema = Type.Object({
  credentialId: Type.String(),
  modelId: Type.String(),
})
type ScopeDefaultEntry = Static<typeof ScopeDefaultEntrySchema>

const ScopeDefaultsResponseSchema = Type.Object(
  { defaults: Type.Optional(Type.Record(Type.String(), ScopeDefaultEntrySchema)) },
  { additionalProperties: true },
)

export async function fetchScopeDefault(scope: AgentToolScope): Promise<ScopeDefaultEntry | null> {
  // Soft fetch: any failure (no default set, network, bad shape) just means
  // "no preselected credential/model" — the caller falls back to the picker.
  try {
    const body = await apiRequest(AI_DEFAULTS_PATH, { schema: ScopeDefaultsResponseSchema })
    return body.defaults?.[scope] ?? null
  } catch (err) {
    console.error(`[AgentSlice] Failed to fetch ${scope} default:`, err)
    return null
  }
}

const CreatedConversationEnvelopeSchema = Type.Object(
  { conversation: Type.Object({ id: Type.String() }) },
  { additionalProperties: true },
)
type CreatedConversation = Static<typeof CreatedConversationEnvelopeSchema>['conversation']

export async function createConversationForScope(
  scope: AgentToolScope,
  credentialId: string,
  modelId: string,
  contextJson: string | undefined,
): Promise<CreatedConversation> {
  const body = await apiRequest(AI_CONVERSATIONS_PATH, {
    method: 'POST',
    body: { scope, credentialId, modelId, ...(contextJson ? { contextJson } : {}) },
    schema: CreatedConversationEnvelopeSchema,
    fallbackMessage: 'Conversation create failed',
  })
  return body.conversation
}
