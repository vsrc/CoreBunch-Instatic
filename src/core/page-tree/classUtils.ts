import type { CSSClass } from './types'

function isNodeScopedClass(cls: CSSClass | null | undefined, nodeId?: string): boolean {
  if (cls?.scope?.type !== 'node') return false
  return nodeId ? cls.scope.nodeId === nodeId : true
}

export function isUserVisibleClass(cls: CSSClass | null | undefined): boolean {
  return !isNodeScopedClass(cls)
}
