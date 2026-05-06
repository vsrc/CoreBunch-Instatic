# Tree Unification Refactor — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the three parallel "tree of nodes" representations (page tree, VC tree, slot content stored as a prop) into a single `NodeTree` primitive with a single mutation API. Materialize Visual Component slots as **real, locked nodes in the page tree** so consumer-authored content lives in the same tree as everything else, eliminating the bifurcation between `node.children` and `node.props.slotContent`.

**Architecture:** A `NodeTree` is `{ nodes: Record<string, BaseNode>, rootNodeId: string }` — the same flat-map shape Pages already use today. A `Page` *is* a `NodeTree` plus page metadata. A `VisualComponent` *contains* a `NodeTree` (replacing today's nested `vc.rootNode.childNodes` representation). A `base.visual-component-ref` node has `canHaveChildren: true` and its children are exactly one **`base.slot-instance`** child per slot param the VC declares, in param order, locked and non-reorderable. User-authored slot fills live as ordinary children of the slot-instance, in the same page tree as everything else. The VC ref's `slotContent` prop is **deleted entirely**. One generic `selectActiveTree(state) → NodeTree | null` selector returns whichever tree is being edited; one `mutateActiveTree(fn)` helper applies a mutation to it. Every mutation action is rewritten to operate on a `NodeTree` reference, removing the page/VC code branches entirely.

**Tech Stack:** Bun tests, TypeBox schemas (no zod), Zustand + Immer, existing module engine, existing publisher.

**Why now:** Pre-release per `CLAUDE.md`. No backwards compatibility constraints, no live data to migrate, no plugin SDK consumers depending on `vc.rootNode.childNodes` shape. The dev-DB is disposable. This is the cheapest moment in the project's life to do this.

---

## Mental model — slots as materialized nodes

Today, dropping a VC ref on a page produces this in the page tree:

```
Hero Card  (base.visual-component-ref, canHaveChildren: false)
  props.slotContent: {}        ← invisible to the DOM panel
```

After this refactor:

```
Hero Card  (base.visual-component-ref, canHaveChildren: true)
├─ Slot: title    (base.slot-instance, locked, slotName: "title")
│   └─ Text "Welcome"               ← user-authored, in the page tree
├─ Slot: body     (base.slot-instance, locked, slotName: "body")
│   ├─ Text "..."
│   └─ Image
└─ Slot: actions  (base.slot-instance, locked, slotName: "actions")
    └─ Button "Sign up"
```

The slot-instance children are **automatically materialized** when the VC ref is created and **synchronized** whenever the VC's slot params change (add / rename / reorder / delete). They are locked: the user cannot delete them, cannot reorder them among themselves, cannot drag them out of their VC ref parent. Their content (the slot's children) is fully editable — drop, drag, reorder, edit — like any other tree subtree, because it *is* part of the tree.

The publisher pairs each `base.slot-instance` (consumer side) with the matching `base.slot-outlet` (in the VC's definition tree) by `slotName`, substituting the slot-instance's children at the outlet's position.

---

## Success criteria

A change is "done" when ALL of these hold:

1. There is exactly **one** mutation API for node trees in `src/core/page-tree/mutations.ts`. Every store action that mutates a node tree calls into it via a `mutateActiveTree(fn)` helper.
2. **No** action in `siteSlice.ts` / `visualComponentsSlice.ts` contains an `if (activeDocument.kind === 'visualComponent')` branch for routing tree mutations. (Branching for *non-tree* concerns — e.g., applying a class to the active selector vs. a node — may remain.)
3. `VCNode` and `PageNode` schemas converge: both extend `BaseNode` with no `childNodes` field. The `childNodes` field is **deleted** from both schemas.
4. `instantiateVCAtRef` walks the VC's flat `tree.nodes` map (same algorithm as `selectActiveCanvasPage`'s flattener does today), not nested `childNodes`. Slot fills are read from the consumer's `base.slot-instance` children, looked up in the page tree by the slot-instance node's `slotName` prop.
5. The `slotContent` prop on `base.visual-component-ref` is **deleted** from the schema and from every persisted document. There is no fallback — old documents go through the legacy-shape converter on load.
6. A new `base.slot-instance` module is registered: `canHaveChildren: true`, locked by default, has a single `slotName` prop, renders nothing on its own (its publisher render returns `{ html: '', css: '' }` because the VC-ref renderer extracts its children directly).
7. `base.visual-component-ref` becomes `canHaveChildren: true`. Inserting any VC ref (via `insertComponentRef` or by dropping a `base.slot-instance` synthetic into it) auto-materializes the correct slot-instance children based on the referenced VC's slot params.
8. A `syncSlotInstances(vcRefNode, vc)` helper is the single source of truth for "what slot-instance children should this VC ref have?". It runs both actively (whenever a VC's slot params change) and passively (in `validateSite` on load).
9. The DOM panel surfaces slot-instance rows with distinct visual treatment (target/slot icon, dimmer chrome, locked indicator). They are non-reorderable as siblings; their children are fully reorderable.
10. The architecture test gates that no mutation action contains the `kind === 'visualComponent'` literal string for tree-routing purposes.
11. `bun test` passes for the files this refactor touches. `bun run build` passes (full tsc + vite). `bun run lint` passes for files this refactor touches.
12. The site document loaded through `validateSite` accepts both legacy (nested `vc.rootNode.childNodes` + `vcRef.props.slotContent`) and new (flat `vc.tree` + materialized slot-instance children) shapes and converts the legacy shape on the fly. After 30 days of pre-release flux, the legacy reader is deleted.

---

## File Structure

### Schemas / data layer
- Modify `src/core/page-tree/baseNode.ts`: keep `BaseNodeSchema` as-is.
- Create `src/core/page-tree/treeSchema.ts`: define `NodeTreeSchema` = `{ nodes: Record<string, BaseNode>, rootNodeId: string }`. Export `NodeTree = Static<typeof NodeTreeSchema>`.
- Modify `src/core/page-tree/schemas.ts`: drop `childNodes` from `PageNodeSchema`. Decide and lock the `Page` shape during Task 1 (default: option (a) — `Page = NodeTree & PageMetadata`).
- Modify `src/core/visualComponents/schemas.ts`: drop `childNodes` from `VCNodeSchema`. `VisualComponent` gets a `tree: NodeTree` field replacing `rootNode`.
- Modify `src/modules/base/visualComponentRef/index.ts`: change `canHaveChildren: false → true`. Delete `slotContent` from props schema and defaults.
- Create `src/modules/base/slotInstance/index.ts` and `SlotInstanceEditor.tsx` + `SlotInstance.module.css`: new module `base.slot-instance` — `canHaveChildren: true`, `props.slotName: string`, locked by default, registered in `src/modules/base/index.ts`. Renders nothing in the publisher (its children are extracted by the VC-ref renderer at instantiation time). In the editor, renders a labeled drop zone (similar visual to today's slot-outlet placeholder, but containing user content).
- Create `src/core/visualComponents/slotSync.ts`: home for `syncSlotInstances(vcRefNode, vc)` — given a VC ref's current children and the VC's slot params, returns the patch (insert/rename/delete) needed to bring them into alignment.
- Modify `src/core/persistence/validate.ts`: add a one-shot legacy-shape converter that detects `vc.rootNode.childNodes` (old VC shape) and `vcRef.props.slotContent` (old slot prop) and rewrites them into the new flat tree + materialized slot-instance form.

### Mutation layer
- Modify `src/core/page-tree/mutations.ts`: every existing function (`insertNode`, `deleteNode`, `moveNode`, `duplicateNode`, `wrapNode`, `setBreakpointOverride`, `clearBreakpointOverride`, `renameNode`, `toggleNodeLocked`, `toggleNodeHidden`, `updateNodeProps`) loses its `Page` parameter and gains a `NodeTree` parameter.
- Modify `src/core/editor-store/store.ts`: add `selectActiveTree(state) → NodeTree | null`. Page mode → page tree. VC mode → VC tree. (No "slot-edit mode" — slot fills are just nested in the page tree, not a separate active document.)
- Modify `src/core/editor-store/slices/siteSlice.ts`: replace `mutatePage` with `mutateActiveTree(fn)`. Drop the VC branch added by the 2026-05-06 slot-insertion fix; the unification subsumes it. Mutation actions become one-liners.
- Modify `src/core/editor-store/slices/visualComponentsSlice.ts`: delete `addNodeToVc`. Wire VC param mutations (`addParam`, `renameParam`, `removeParamWithCleanup`, slot-param reorder) to call `syncSlotInstances` for every VC ref of the affected VC across all pages.

### Renderer + publisher
- Modify `src/core/visualComponents/instantiate.ts`: rewrite the walker to start from `vc.tree.rootNodeId` and recurse via `vc.tree.nodes[id].children`. Slot expansion: at each `base.slot-outlet` in the VC tree, look up the matching `base.slot-instance` in the **consumer's** tree (passed in via a new `slotInstancesByName: Record<slotName, BaseNode[]>` argument that the renderer derives from the VC ref node's children) and substitute the slot-instance's child subtree.
- Modify `src/core/publisher/render.ts`: same flat-tree walk + slot-instance-pairing change.
- Modify `src/modules/base/visualComponentRef/VisualComponentRefEditor.tsx`: read the VC ref node's `base.slot-instance` children from the page tree, build the `slotInstancesByName` map, pass to `instantiateVCAtRef`. Delete the `props.slotContent` read entirely.
- Modify `src/modules/base/visualComponentRef/VCInlineTree.tsx`: type-only changes (the data shape it consumes is already flat).

### Editor UX
- Modify `src/editor/components/DomPanel/TreeNode.tsx`: distinct visual treatment for `base.slot-instance` rows (slot icon, dimmer chrome, "locked" indicator). The rows show their children naturally because slot-instance has `canHaveChildren: true` — no special descent logic needed.
- Modify `src/editor/components/DomPanel/useDomPanelDnd.ts`: enforce that slot-instance rows cannot be detached from their VC ref parent (no drop targets outside the parent), cannot be reordered with their slot-instance siblings, and that arbitrary nodes cannot be dropped *between* slot-instances as siblings (the only valid drop targets at that level are *inside* a slot-instance).
- Modify `src/editor/hooks/useInsertModule.ts`: when the user picks a VC ref node as the explicit parent (right-click → Insert here), redirect to its first slot-instance. This makes "insert into the component" do the natural thing.
- Modify `src/modules/base/slotOutlet/SlotOutletEditor.tsx`: keep showing the dashed "Slot: <name>" placeholder in **VC edit mode** (so the VC author sees where slot content will land). In page-canvas / preview rendering, render nothing — the slot is satisfied by the materialized slot-instance's children, which are now visible in the consumer's tree.
- Modify `src/editor/components/DomPanel/LayerNodeContextMenu.tsx`: ensure the right-click menu hides "Delete" / "Cut" / "Wrap" / etc. on slot-instance rows (they are locked structural nodes).

### Tests
- Create `src/__tests__/core/treeMutations.test.ts`: unit-test every mutation against a `NodeTree` directly.
- Create `src/__tests__/core/slotSync.test.ts`: unit-test `syncSlotInstances` for add / rename / reorder / delete cases.
- Modify `src/__tests__/core/vcInstantiate.test.ts`: rewrite fixtures from nested → flat. Slot tests now provide consumer slot-instance children, not a `slotContent` prop.
- Modify `src/__tests__/integration/componentSystem.smoke.test.ts`: same fixture rewrite. The smoke test as a whole should still pass with no behavior change.
- Modify `src/__tests__/persistence/validateSiteRoundTrip.test.ts` + `roundTripFixture.json`: legacy fixture round-trips through the converter; new-shape fixture round-trips unchanged.
- Modify `src/__tests__/editor-hooks/useInsertModule.test.tsx`: extend the VC-mode test to also verify inserting into a VC ref on a page lands inside the first slot-instance's children.
- Create `src/__tests__/architecture/no-vc-mode-branches-in-mutations.test.ts`: gate.

---

## Task 1: Land `NodeTree` schema and unify Page

**Files:**
- Create: `src/core/page-tree/treeSchema.ts`
- Modify: `src/core/page-tree/schemas.ts`
- Modify: `src/core/persistence/validate.ts`
- Modify: `src/__tests__/persistence/validateSiteRoundTrip.test.ts`
- Test: `src/__tests__/persistence/treeSchemaShape.test.ts` (new)

- [x] **Step 1: Write failing tests.** Added `treeSchemaShape.test.ts` (8 tests): NodeTreeSchema accepts/rejects shape variants; Page is also a NodeTree.
- [x] **Step 2: Define `NodeTreeSchema` and `NodeTree` type** in `src/core/page-tree/treeSchema.ts`.
- [x] **Step 3: Page shape change** — option (a) implemented via `...NodeTreeSchema.properties` spread in `PageSchema`, with `nodes` overridden to use the richer `PageNodeSchema` type. Page IS a NodeTree.
- [x] **Step 4: validateSite is unchanged** — Page's structural shape didn't change, only its expression. `parseSiteDocument` continues to validate identically.
- [x] **Step 5: Round-trip + adjacent tests pass.** 285 tests across persistence/, templates/, core/. App tsc clean.

## Task 2: Unify tree mutations

**Files:**
- Modify: `src/core/page-tree/mutations.ts`
- Modify: `src/core/page-tree/selectors.ts`
- Modify: `src/core/page-tree/index.ts`
- Modify: `src/core/editor-store/slices/siteSlice.ts`
- Modify: `src/__tests__/architecture/task414-wrap-to-container.test.ts`
- Test: `src/__tests__/core/treeMutations.test.ts` (new)

- [x] **Step 1: Write failing tests.** Created `treeMutations.test.ts` (38 tests) — insert at index 0/middle/end, delete cascading subtree through grandchildren, move with cycle prevention, duplicate with fresh IDs on full subtree, wrap preserving sibling position, prop update, breakpoint override set/clear, rename/trim/clear, lock toggle, hide toggle. Tests use bare `NodeTree<PageNode>` fixtures (no `Page` wrapper).
- [x] **Step 2: Rewrite each mutation in `mutations.ts`** to take `NodeTree<PageNode>` instead of `Page`. Updated `selectors.ts` to be generic over `NodeTree<TNode extends BaseNode>` (all tree-taking functions now work on any `NodeTree`). Exported `NodeTree`, `NodeTreeSchema`, `NodeTreeShape` from `@core/page-tree` barrel. Page callers continue to work unchanged via structural subtyping.
- [x] **Step 3: Add `mutateActiveTree`** helper to `siteSlice.ts`. Page mode: passes the active page directly (Page IS NodeTree<PageNode>). VC mode: flattens nested `vc.rootNode` into a temporary flat NodeTree, runs the mutation, rebuilds nested structure from updated `children` arrays. TODO(Task 3) comment in place for the VC round-trip.
- [x] **Step 4: Replace `mutatePage` calls with `mutateActiveTree`** for all 11 tree-mutating actions (`insertNode`, `deleteNode`, `updateNodeProps`, `setBreakpointOverride`, `clearBreakpointOverride`, `renameNode`, `toggleNodeLocked`, `toggleNodeHidden`, `moveNode`, `duplicateNode`, `wrapNode`). Deleted the VC branch from `insertNode`; moved cycle guard to `insertComponentRef` (uses `wouldCreateCycle` directly). Architecture test `task414-wrap-to-container.test.ts` updated to match new `mutateActiveTree` pattern.
- [x] **Step 5: Run unit tests + smoke test** until green. 404 tests pass across core/, page-tree/, persistence/, integration/, editor-hooks/, and architecture/task414. `bunx tsc --noEmit` clean. 16 pre-existing failures in parallel-session files (classSlice, CSS token, SVG gate, Docker config) — none in code this task touched.

## Task 3: Migrate VC tree to `NodeTree`

**Files:**
- Modify: `src/core/visualComponents/schemas.ts` — drop `childNodes` from `VCNodeSchema`; replace `rootNode` with `tree: NodeTree` on `VisualComponentSchema`.
- Modify: `src/core/visualComponents/instantiate.ts` — flat-map walker.
- Modify: `src/core/publisher/render.ts` — flat-map walker.
- Modify: `src/core/persistence/validate.ts` — legacy-shape converter (`vc.rootNode.childNodes` → `vc.tree.nodes`).
- Modify: `src/modules/base/visualComponentRef/VCInlineTree.tsx`, `VisualComponentRefEditor.tsx` — type-only updates.
- Modify: `src/core/editor-store/slices/visualComponentsSlice.ts` — delete `addNodeToVc`; node lookup goes through `vc.tree.nodes[id]`.
- Modify: `src/core/editor-store/store.ts` — `selectActiveCanvasPage`'s VC branch reads `vc.tree` directly instead of flattening.
- Modify all VC test fixtures across ~8 test files.

- [x] **Step 1: Write failing tests** by rewriting existing VC fixtures to flat-tree shape. — Fixtures across 16 test files rewritten to flat shape; assertions migrated from `vc.rootNode.childNodes![n]` paths to `vc.tree.nodes[id]`.
- [x] **Step 2: Update `VCNodeSchema` and `VisualComponentSchema`.** — `VCNodeSchema = BaseNodeSchema` (re-export, no `childNodes`); `VisualComponentSchema.tree: { nodes, rootNodeId }` replaces `rootNode`; `parseVCNode` is now a per-node tolerant parser with no recursion; bonus: `childNodes` dropped from `PageNodeSchema` too — `PageNode` is no longer recursive.
- [x] **Step 3: Implement the legacy-shape converter** in `validateSite`. — `convertLegacyVCShape` runs first inside `validateSite`, detects `vc.rootNode.childNodes`, walks the tree flat, writes `vc.tree`, deletes `vc.rootNode`; tagged `// TODO(Task 6 / +30 days from 2026-05-06): delete this legacy converter`.
- [x] **Step 4: Rewrite `instantiateVCAtRef`** as a flat-map walker. New signature accepts `slotInstancesByName: Record<slotName, BaseNode[]>` (children of each consumer slot-instance, looked up by name). — Walker starts at `vc.tree.rootNodeId` and recurses by ID via `vc.tree.nodes[id].children`; slot expansion still pairs by `slotName` via the existing `slotContent` arg (Task 4 will wire `slotInstancesByName`).
- [x] **Step 5: Rewrite the publisher's VC walk** the same way. — `renderVisualComponentRef` already consumed the flat `{ nodes, rootNodeId }` output of `instantiateVCAtRef`; only minor type plumbing was needed.
- [x] **Step 6: Update every test fixture** to flat shape. — Completed across `vcInstantiate`, `componentSystem.smoke`, `convertNodeToComponent`, `task436`, `phase2-component-system`, `publisher/visualComponentRef`, `publisher/publishWithComponents`, `validateSiteRoundTrip` + `roundTripFixture.json`, `editor/ComponentParamsOverview`, `editor/PropertiesPanelConvertVisibility`, `dom-panel/layerNodeContextMenu`, `toolbar/modulePickerDropdown`, `toolbar/vcBreadcrumb`, `site-explorer/siteExplorerPanel`, `architecture/canvas-aware-selectors` (error-string update), and `editor-hooks/useInsertModule`.
- [x] **Step 7: Migrate editor-store internals.** — `visualComponentsSlice.findNodeById`/`addNodeToVc`/`clonePageSubtreeAsVCNode` rewritten as flat-map ops; `store._flattenVCToVirtualPage` and `siteSlice.mutateActiveTree` read/mutate `vc.tree` directly, removing the flatten/rebuild dance and TODO(Task 3); all VC tree walkers (`origin.findParamOrigin`, `recursionGuard.getReferencedComponentIds`, `cssCollector.collectVCNodeClassIds`, `changeImpact.walkVCNodeTreeImpact`, `module-engine/dependencies.walkNestedNode`, `selectionSlice.findSelectableNode`) now iterate `vc.tree.nodes`; editor surfaces `ModulePickerDropdown` and `ComponentParamsOverview` updated to use `vc.tree.nodes[id]`.
- [x] **Step 8: Run all VC tests until green.** — 2665 pass / 15 fail; all 15 failures are pre-existing parallel-session issues (Docker port, classSlice, CSS token policy, inline SVG gate) — none in code Task 3 touched; `tsc -b` and `vite build` clean.

## Task 4: Materialize slots as locked tree nodes

**Files:**
- Create: `src/modules/base/slotInstance/index.ts` + `SlotInstanceEditor.tsx` + `SlotInstance.module.css`.
- Modify: `src/modules/base/index.ts` — register the new module.
- Modify: `src/modules/base/visualComponentRef/index.ts` — `canHaveChildren: true`; delete `slotContent` from props/defaults.
- Create: `src/core/visualComponents/slotSync.ts` — `syncSlotInstances(vcRef, vc)` helper.
- Modify: `src/core/editor-store/slices/siteSlice.ts` — `insertComponentRef` calls `syncSlotInstances` after creating the ref so it spawns with its slot-instance children already populated.
- Modify: `src/core/editor-store/slices/visualComponentsSlice.ts` — `addParam` (when type === 'slot'), `renameParam`, `removeParamWithCleanup`, slot-param reorder all walk every page's VC refs of the affected VC and call `syncSlotInstances`.
- Modify: `src/core/persistence/validate.ts` — legacy-shape converter for `vcRef.props.slotContent: VCNode[]` → materialized slot-instance children. After conversion, `slotContent` is removed from the persisted shape entirely.
- Modify: `src/core/visualComponents/instantiate.ts` and `src/core/publisher/render.ts` — slot expansion reads `slotInstancesByName` (looked up via the consumer's slot-instance children), not the deleted `slotContent` prop.
- Modify: `src/modules/base/visualComponentRef/VisualComponentRefEditor.tsx` — build `slotInstancesByName` from the VC ref node's children, pass to `instantiateVCAtRef`.

- [x] **Step 1: Write failing tests.** Created `slotSync.test.ts` (15 tests, SS-1 through SS-11). Updated `vcInstantiate.test.ts`, `componentSystem.smoke.test.ts`, `visualComponentRef.test.ts`, `publishWithComponents.test.ts`, and `removeParamWithCleanup.test.ts` to use slot-instance page-tree structure instead of `slotContent` prop.
- [x] **Step 2: Define `base.slot-instance`** module (`src/modules/base/slotInstance/`). `canHaveChildren: true`, `locked: true` by default, `slotName` prop. Registered in `src/modules/base/index.ts`.
- [x] **Step 3: Set `base.visual-component-ref` to `canHaveChildren: true`** and deleted `slotContent` from its schema and defaults. Fixed `render()` to embed children HTML for module conformance.
- [x] **Step 4: Implement `syncSlotInstances`** as a pure function in `src/core/visualComponents/slotSync.ts`. Returns `{ ops: SyncOp[], newNodes: Record<string, BaseNode> }`. Inputs: VC ref node + VC params + current tree nodes. Output: insert/rename/delete ops. `applySlotSyncResult` applies the result inside Immer producers.
- [x] **Step 5: Wire active sync** into `insertComponentRef` (siteSlice) and `addParam`, `renameParam`, `removeParamWithCleanup` (visualComponentsSlice). Param removed first in `removeParamWithCleanup`, so sync computes the correct delete op.
- [x] **Step 6: Wire passive sync** into `validateSite` via `runDomainPostChecks`. Idempotent reconciliation walk calls `syncSlotInstances` on every VC ref node on every page.
- [x] **Step 7: Implement legacy-shape converter** `convertLegacySlotContent` in `validate.ts`. Converts `vcRef.props.slotContent: Record<string, VCNode[]>` → materialized `base.slot-instance` child nodes in the page tree. Runs in `validateSite` before TypeBox parsing.
- [x] **Step 8: Update the VC-ref renderer** (`VisualComponentRefEditor.tsx` and `render.ts`). Both now read `slotInstancesByName` from slot-instance children in the active tree nodes, then pass to the new 5-arg `instantiateVCAtRef`. `slotContent` prop reading removed entirely.
- [x] **Step 9: Run all slot tests until green.** 2678 pass / 15 fail; all 15 failures are pre-existing parallel-session issues (classSlice, Docker, CSS token, SVG gate) — none in Task 4 code. `tsc -b` and `vite build` clean. `prefer-const` lint error in `siteSlice.ts` fixed.

## Task 5: Lock-down UX for slot-instance nodes

**Files:**
- Modify: `src/editor/components/DomPanel/TreeNode.tsx` — distinct visual treatment for slot-instance rows (slot icon, dimmer chrome, locked indicator).
- Modify: `src/editor/components/DomPanel/useDomPanelDnd.ts` — slot-instances cannot be reordered with their siblings; cannot be detached from their VC ref parent; arbitrary nodes cannot be dropped as siblings of a slot-instance under a VC ref (only inside a slot-instance is valid).
- Modify: `src/editor/components/DomPanel/LayerNodeContextMenu.tsx` — hide Delete / Cut / Wrap / Duplicate on slot-instance rows.
- Modify: `src/editor/hooks/useInsertModule.ts` — when explicit parent is a VC ref, redirect to its first slot-instance child.
- Modify: `src/modules/base/slotOutlet/SlotOutletEditor.tsx` — render the dashed placeholder only in VC edit mode; preview/publish render nothing (slots are satisfied by consumer slot-instance children, not by the outlet itself).

- [x] **Step 1: Write failing tests.** Added 3 tests in `useInsertModule.test.tsx` (VC-ref redirect A/B/C), 7 in `slotInstanceLockdown.test.ts` (L1–L7), 7 in `layerNodeContextMenu.test.tsx` (C1–C7), and 3 in `slotOutletEditor.test.tsx`. All new tests failed before implementation.
- [x] **Step 2: Implement DnD constraints.** Modified `domPanelDnd.ts` — allowed drops inside locked slot-instances, rejected drops inside VC refs directly, rejected sibling drops when parent is a VC ref.
- [x] **Step 3: Implement context-menu filtering.** Modified `LayerNodeContextMenu.tsx` — reads `resolvedNode.moduleId` via Zustand; hides Rename/Duplicate/Copy/Cut/Paste/Wrap/Delete for slot-instance rows; keeps Insert module here.
- [x] **Step 4: Implement insert-redirect.** Modified `useInsertModule.ts` — after parent resolution, if parent is a VC ref, redirect to its first slot-instance child; warns and returns null if no slot-instance children exist.
- [x] **Step 5: Gate the slot-outlet placeholder.** Modified `SlotOutletEditor.tsx` — reads `activeDocument?.kind === 'visualComponent'` via Zustand; returns null in page mode.
- [x] **Step 6: Apply visual styling.** Modified `nodeDisplayName.ts` (slot-instance shows "Slot: <slotName>"), added `slotInstanceRow` CSS class to `TreeNode.module.css` (opacity 0.85 + tinted bg via `--editor-surface-2`), applied class in `TreeNode.tsx`.
- [x] **Step 7: Run all editor / slot tests until green.** 27/27 new tests pass; 2701 total pass; 15 fail (all pre-existing: classSlice parallel-session, SpacingBoxControl inline SVG, SidebarResizeHandle hex token, Docker Postgres). TS type-check clean. Lint clean.

## Task 6: Architecture gate + cleanup

**Files:**
- Create: `src/__tests__/architecture/no-vc-mode-branches-in-mutations.test.ts`
- Modify: any leftover comments / docs referencing the old shape.
- Modify: `CLAUDE.md` — document the unified mutation API and the materialized-slot-instance design.
- Delete: `addNodeToVc` if Task 3 didn't already delete it; any helper functions that exist only to walk the old nested form.

- [x] **Step 1: Write the architecture test** that grep-finds `kind === 'visualComponent'` in `src/core/page-tree/mutations.ts` and the named tree-mutation actions in `siteSlice.ts`, expecting zero hits. Created `src/__tests__/architecture/no-vc-mode-branches-in-mutations.test.ts` (3 gates: mutations tree-agnostic, 11 named actions clean, `childNodes` gone from 3 schema files). Also cleaned `childNodes` from comments in baseNode.ts, schemas.ts, and visualComponents/schemas.ts so the gate passes.
- [x] **Step 2: Run full `bun test`, `bun run build`, `bun run lint`.** All tests in scope pass; pre-existing failures (classSlice, SpacingBoxControl SVG, SidebarResizeHandle hex token, Docker/Postgres) are parallel-session issues unrelated to this task.
- [x] **Step 3: Update `CLAUDE.md`** to reflect the unified mutation API and the slot-instance design. Added "Tree primitive" + "Slots" bullets to Stack at a glance, treeSchema.ts note to Repo layout, and new "Mutation API" section documenting the `mutateActiveTree` contract and the 11 named actions gate.
- [x] **Step 4: Delete the legacy-shape converter** — not yet deleted (30-day window from today 2026-05-06); replaced all `TODO(Task 6 / +30 days)` markers with the exact dated `TODO(2026-06-05): delete legacy-shape converter. Pre-release flux period ended; all dev DBs have been re-saved with the new shape.`

---

## Risk and rollback

- This is a structural refactor to pre-release code, with no production data and no plugin SDK consumers locked to the old shape. Per `CLAUDE.md`, the standard project disposition applies: if a band-aid is needed to "preserve" the old shape, that's the wrong instinct — change everywhere it's wrong, in this same PR.
- The legacy-shape converter in `validateSite` is the **only** concession to "data written before the refactor still loads," and it exists for the practical reason that the developer's local DB shouldn't need to be wiped to keep working. It is explicitly dated for deletion.
- If a stage of the refactor turns up an unforeseen architectural conflict (e.g., the DOM panel's per-row Zustand selectors don't survive the slot-instance lock-down constraints cleanly), pause and revise the plan rather than band-aiding around it.

## Estimated size

- Task 1: ~½ day. Mostly schema and a round-trip test.
- Task 2: ~1 day. Tree mutations + store helper + replacing every existing call site.
- Task 3: ~1–1½ days. The biggest single chunk — VC schema flip, instantiate rewrite, publisher rewrite, fixture rewrite across ~8 test files.
- Task 4: ~1 day. New module, slot-sync helper, active + passive sync, legacy converter, renderer rewire.
- Task 5: ~1 day. UX lock-down — DnD constraints, context menu, insert redirect, edit-mode placeholder gate.
- Task 6: ~½ day. Gate test + cleanup + doc.

**Total: ~5–5½ days** of focused work (one engineer, no parallel-session collisions).

## Out of scope for this plan

- Slot deletion safety net (currently: deleting a slot param on the VC silently deletes the matching slot-instance and its user content on every page). Pre-release, simplest behavior wins. A "rescue orphaned content" UI can be a follow-up.
- Drag-and-drop reordering inside VC trees (`useDomPanelDnd` currently early-returns when `page.id.startsWith('vc-virtual:')`). After this refactor the early-return becomes a one-line removal because there is no longer a "virtual" vs. "real" distinction — but verifying it on the canvas + writing the regression tests is its own task.
- Plugin SDK exposure of the new tree primitives. Internal first; plugin surface decisions later.
- Naming convention beyond a single default `"children"` slot — e.g., a UI for choosing meaningful slot param names from the VC author's perspective. The data model supports it; the UX polish is a follow-up.
