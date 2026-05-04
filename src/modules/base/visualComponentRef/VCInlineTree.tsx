/**
 * VCInlineTree — lightweight React renderer for an instantiated VC node map.
 *
 * Architecture source: Contribution #619 §8.5
 *
 * Renders a flat VCNode map (produced by instantiateVCAtRef) as a React subtree.
 * Nodes are rendered using the module registry — no Zustand subscriptions, no
 * NodeWrapper (inner nodes are not selectable in this context).
 *
 * base.visual-component-ref nodes are delegated back to VisualComponentRefEditor
 * via the registry, which uses the store to look up the VC and recursively
 * renders another VCInlineTree. This provides natural recursive rendering with
 * cycle safety guaranteed by the recursion guard at write boundaries.
 */

import { registry } from '@core/module-engine/registry'
import type { VCNode } from '@core/visualComponents/schemas'

interface VCInlineTreeProps {
  /** Flat node map from instantiateVCAtRef */
  nodes: Record<string, VCNode>
  /** ID of the root node — entry point for traversal */
  rootNodeId: string
}

export function VCInlineTree({ nodes, rootNodeId }: VCInlineTreeProps) {
  return <VCNodeRenderer nodeId={rootNodeId} nodes={nodes} />
}

// ---------------------------------------------------------------------------
// VCNodeRenderer — recursive node renderer (no NodeWrapper, not selectable)
// ---------------------------------------------------------------------------

interface VCNodeRendererProps {
  nodeId: string
  nodes: Record<string, VCNode>
}

function VCNodeRenderer({ nodeId, nodes }: VCNodeRendererProps) {
  const node = nodes[nodeId]
  if (!node) return null
  if (node.hidden) return null

  const definition = registry.get(node.moduleId)
  if (!definition) return null

  const ComponentType = definition.component

  const children = node.children.map((childId) => (
    <VCNodeRenderer key={childId} nodeId={childId} nodes={nodes} />
  ))

  return (
    <ComponentType
      props={node.props as never}
      nodeId={node.id}
      isSelected={false}
      mcClassName=""
    >
      {children}
    </ComponentType>
  )
}
