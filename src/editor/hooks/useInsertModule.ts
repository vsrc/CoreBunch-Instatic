import { useCallback } from 'react'
import { selectActiveCanvasPage, useEditorStore } from '@core/editor-store/store'
import { registry } from '@core/module-engine/registry'
import { getMissingModuleDependencies } from '@core/module-engine/dependencies'
import type { AnyModuleDefinition } from '@core/module-engine/types'

/**
 * Insert a module into the active canvas document (page or Visual Component).
 *
 * Without an explicit `parentId`, parent resolution follows the toolbar default:
 * if the selected node can have children, insert as its child; otherwise insert
 * as a sibling (under the selected node's parent); otherwise insert at the
 * canvas root.
 *
 * Pass an explicit `parentId` (e.g. from the DOM-panel right-click context) to
 * skip the smart-resolution step and insert directly into that node.
 *
 * Uses `selectActiveCanvasPage` so parent resolution works in BOTH page mode
 * and VC-canvas mode — the slice's `insertNode` action then routes to the
 * correct tree (page tree vs. VC tree) based on `activeDocument.kind`.
 */
export function useInsertModule() {
  const canvasPage = useEditorStore(selectActiveCanvasPage)
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
  const insertNode = useEditorStore((s) => s.insertNode)
  const selectNode = useEditorStore((s) => s.selectNode)
  const packageJson = useEditorStore((s) => s.packageJson)
  const setDependency = useEditorStore((s) => s.setDependency)

  return useCallback(
    (mod: AnyModuleDefinition, explicitParentId?: string) => {
      if (!canvasPage) return null

      let parentId = canvasPage.rootNodeId
      if (explicitParentId && canvasPage.nodes[explicitParentId]) {
        parentId = explicitParentId
      } else if (selectedNodeId) {
        const selectedNode = canvasPage.nodes[selectedNodeId]
        if (selectedNode) {
          const def = registry.get(selectedNode.moduleId)
          if (def?.canHaveChildren) {
            parentId = selectedNodeId
          } else {
            const parentNode = Object.values(canvasPage.nodes).find((node) =>
              node.children.includes(selectedNodeId),
            )
            if (parentNode) parentId = parentNode.id
          }
        }
      }

      // ─── slot-instance structural lock-down — Task 5 ──────────────────────
      // If the resolved parent is a VC ref, redirect the insertion into its
      // first slot-instance child. Direct children of a VC ref are managed
      // exclusively by syncSlotInstances; content goes inside a slot-instance.
      const parentNode = canvasPage.nodes[parentId]
      if (parentNode?.moduleId === 'base.visual-component-ref') {
        const slotInstanceChildId = parentNode.children.find(
          (childId) => canvasPage.nodes[childId]?.moduleId === 'base.slot-instance',
        )
        if (slotInstanceChildId) {
          parentId = slotInstanceChildId
        } else {
          // Defensive: VC ref has no slot-instance children. This shouldn't
          // happen post-Task 4 (syncSlotInstances guarantees the invariant),
          // but if it does, skip the insertion rather than create an orphan.
          console.warn(
            '[useInsertModule] VC ref has no slot-instance children; insertion skipped',
            { parentId },
          )
          return null
        }
      }
      // ─────────────────────────────────────────────────────────────────────────

      // ─── canHaveChildren guard ─────────────────────────────────────────────
      // The resolved parent MUST be able to host children. This rule is mostly
      // enforced upstream (the smart-resolve path checks `canHaveChildren` on
      // the selected node and walks to its parent if not), but it can still
      // fail when:
      //   - `explicitParentId` was passed for a non-container (e.g. right-click
      //     "Insert here" on a Text node);
      //   - the canvas root itself can't have children (e.g. an old VC whose
      //     root is a single Text or Button — pre-fix data; new conversions
      //     auto-wrap in a Container).
      // Walk up to find the nearest ancestor that CAN have children. If none
      // is found (the root itself can't), abort with a console.warn rather
      // than silently corrupting the tree.
      let resolvedParentId: string | null = parentId
      while (resolvedParentId) {
        const node = canvasPage.nodes[resolvedParentId]
        if (!node) {
          resolvedParentId = null
          break
        }
        const def = registry.get(node.moduleId)
        if (def?.canHaveChildren) break
        // Walk up one level.
        const ancestor = Object.values(canvasPage.nodes).find((n) =>
          n.children.includes(resolvedParentId!),
        )
        resolvedParentId = ancestor ? ancestor.id : null
      }
      if (!resolvedParentId) {
        console.warn(
          '[useInsertModule] no ancestor accepts children; insertion aborted',
          { initialParentId: parentId, canvasRootId: canvasPage.rootNodeId },
        )
        return null
      }
      parentId = resolvedParentId
      // ─────────────────────────────────────────────────────────────────────────

      for (const dependency of getMissingModuleDependencies(mod, packageJson)) {
        setDependency(dependency.name, dependency.version, dependency.dev)
      }

      const nodeId = insertNode(mod.id, mod.defaults, parentId)
      selectNode(nodeId)
      return nodeId
    },
    [canvasPage, selectedNodeId, packageJson, setDependency, insertNode, selectNode],
  )
}
