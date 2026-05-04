/**
 * base.visual-component-ref editor preview component.
 *
 * Component-only file so React Fast Refresh can hot-patch edits without
 * re-running module registration.
 */
import React, { useCallback } from 'react'
import type { ModuleComponentProps } from '@core/module-engine/types'
import { useEditorStore } from '@core/editor-store/store'
import { instantiateVCAtRef } from '@core/visualComponents/instantiate'
import type { VCNode } from '@core/visualComponents/schemas'
import { BracesIcon } from 'pixel-art-icons/icons/braces'
import { VCInlineTree } from './VCInlineTree'
import styles from './VisualComponentRef.module.css'

interface VisualComponentRefProps extends Record<string, unknown> {
  componentId: string
  /** Per-param value overrides — keyed by VCParam.id (stable across renames) */
  propOverrides: Record<string, unknown>
  slotContent: Record<string, unknown[]>
}

export const VisualComponentRefEditor: React.FC<ModuleComponentProps<VisualComponentRefProps>> = ({
  props,
  nodeId,
}) => {
  const componentId = typeof props.componentId === 'string' ? props.componentId : ''
  const propOverrides =
    props.propOverrides && typeof props.propOverrides === 'object' && !Array.isArray(props.propOverrides)
      ? (props.propOverrides as Record<string, unknown>)
      : {}
  const slotContent =
    props.slotContent && typeof props.slotContent === 'object' && !Array.isArray(props.slotContent)
      ? (props.slotContent as Record<string, VCNode[]>)
      : {}

  const vc = useEditorStore(
    useCallback(
      (s) => s.site?.visualComponents?.find((v) => v.id === componentId) ?? null,
      [componentId],
    ),
  )

  if (!vc) {
    return (
      <div className={styles.unknown}>
        <BracesIcon size={12} color="currentColor" aria-hidden="true" />
        <span>{componentId ? `Unknown component: ${componentId}` : 'No component selected'}</span>
      </div>
    )
  }

  const { nodes, rootNodeId } = instantiateVCAtRef(vc, propOverrides, slotContent, nodeId)

  return <VCInlineTree nodes={nodes} rootNodeId={rootNodeId} />
}
