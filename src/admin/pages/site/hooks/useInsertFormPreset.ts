import { selectActiveCanvasPage, useEditorStore } from '@site/store/store'
import { resolveInsertLocation } from '@site/store/insertLocation'
import type { FormPreset, FormPresetNode } from '@site/module-picker'
import type { Page } from '@core/page-tree'
import { normalizeIdentifierValue } from '@core/utils/identifier'

export function useInsertFormPreset() {
  const canvasPage = useEditorStore(selectActiveCanvasPage)
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
  const insertNode = useEditorStore((s) => s.insertNode)
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps)
  const selectNode = useEditorStore((s) => s.selectNode)

  return (preset: FormPreset, explicitParentId?: string) => {
    if (!canvasPage) return null
    const targetId =
      (explicitParentId && canvasPage.nodes[explicitParentId] ? explicitParentId : null) ??
      selectedNodeId ??
      canvasPage.rootNodeId
    const location = resolveInsertLocation(canvasPage, targetId)
    if (!location) return null

    const formId = uniqueFormId(canvasPage, preset.id)
    const rootId = insertPresetNode(insertNode, preset.root, location.parentId, location.index)
    updateNodeProps(rootId, { formId })
    selectNode(rootId)
    return rootId
  }
}

function uniqueFormId(page: Page, baseId: string): string {
  const base = normalizeIdentifierValue(baseId, 'form')
  const used = new Set(
    Object.values(page.nodes)
      .filter((node) => node.moduleId === 'base.form')
      .map((node) => normalizeIdentifierValue(String(node.props.formId ?? '')))
      .filter(Boolean),
  )
  if (!used.has(base)) return base

  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}`
    if (!used.has(candidate)) return candidate
  }
}

function insertPresetNode(
  insertNode: (moduleId: string, defaults: Record<string, unknown>, parentId: string, index?: number) => string,
  presetNode: FormPresetNode,
  parentId: string,
  index?: number,
): string {
  const nodeId = insertNode(presetNode.moduleId, presetNode.defaults ?? {}, parentId, index)
  for (const child of presetNode.children ?? []) {
    insertPresetNode(insertNode, child, nodeId)
  }
  return nodeId
}
