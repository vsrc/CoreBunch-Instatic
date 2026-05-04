import { useEffect, useRef } from 'react'
import type { VisualComponent } from '@core/visualComponents/schemas'
import { useEditorStore } from '@core/editor-store/store'

const EMPTY_VCS: VisualComponent[] = []
import {
  ContextMenu as UIContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSubmenu,
} from '@ui/components/ContextMenu'
import { EditIcon } from 'pixel-art-icons/icons/edit'
import { CopyIcon } from 'pixel-art-icons/icons/copy'
import { CheckboxIcon } from 'pixel-art-icons/icons/checkbox'
import { DeleteIcon } from 'pixel-art-icons/icons/delete'
import { BracesIcon } from 'pixel-art-icons/icons/braces'

interface LayerNodeContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onDelete: () => void
  onDuplicate: () => void
  onRename: () => void
  onWrapInContainer: () => void
  /** The node that was right-clicked. When omitted, falls back to selectedNodeId. */
  nodeId?: string
}

export function LayerNodeContextMenu({
  x,
  y,
  onClose,
  onDelete,
  onDuplicate,
  onRename,
  onWrapInContainer,
  nodeId: nodeIdProp,
}: LayerNodeContextMenuProps) {
  const firstItemRef = useRef<HTMLButtonElement>(null)

  const visualComponents = useEditorStore((s) => s.site?.visualComponents ?? EMPTY_VCS)
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
  const insertComponentRef = useEditorStore((s) => s.insertComponentRef)

  // Prefer explicitly passed nodeId; fall back to store's selected node.
  // CanvasRoot selects the right-clicked node before opening the menu, so
  // selectedNodeId is reliable there even without an explicit nodeId prop.
  const nodeId = nodeIdProp ?? selectedNodeId

  useEffect(() => {
    firstItemRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
    }
  }

  function handleInsertVc(vcId: string) {
    if (!nodeId) return
    insertComponentRef(nodeId, vcId)
    onClose()
  }

  return (
    <UIContextMenu
      x={x}
      y={y}
      ariaLabel="Node options"
      onClose={onClose}
      onKeyDown={handleKeyDown}
    >
      <ContextMenuItem ref={firstItemRef} onClick={onRename}>
        <span aria-hidden="true"><EditIcon size={13} /></span>
        Rename
      </ContextMenuItem>

      <ContextMenuItem onClick={onDuplicate}>
        <span aria-hidden="true"><CopyIcon size={13} /></span>
        Duplicate
      </ContextMenuItem>

      <ContextMenuItem onClick={onWrapInContainer}>
        <span aria-hidden="true"><CheckboxIcon size={13} /></span>
        Wrap in Container
      </ContextMenuItem>

      {visualComponents.length > 0 && (
        <ContextMenuSubmenu
          label="Insert component here"
          icon={<BracesIcon size={13} />}
          onClose={onClose}
        >
          {visualComponents.map((vc) => (
            <ContextMenuItem key={vc.id} onClick={() => handleInsertVc(vc.id)}>
              {vc.name}
            </ContextMenuItem>
          ))}
        </ContextMenuSubmenu>
      )}

      <ContextMenuSeparator />

      <ContextMenuItem danger onClick={onDelete}>
        <span aria-hidden="true"><DeleteIcon size={13} /></span>
        Delete
      </ContextMenuItem>
    </UIContextMenu>
  )
}
