import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@ui/components/Button'
import { cn } from '@ui/cn'
import { ContextMenu, ContextMenuItem } from '@ui/components/ContextMenu'
import { ChevronDown2Icon } from '@ui/icons/icons/chevron-down-2'
import type { IconComponent } from '@ui/icons/types'
import styles from './Toolbar.module.css'

export type PublishActionStatusTone = 'neutral' | 'success' | 'warning' | 'danger'
export type PublishActionState = 'idle' | 'busy' | 'success' | 'error'

export interface PublishActionMenuItem {
  id: string
  label: string
  icon: IconComponent
  disabled?: boolean
  onSelect: () => void | Promise<void>
  testId?: string
}

interface PublishActionGroupProps {
  statusLabel?: string | null
  statusTone?: PublishActionStatusTone
  statusAriaLabel?: string
  publishLabel: string
  publishAriaLabel: string
  publishTitle: string
  publishState?: PublishActionState
  publishDisabled?: boolean
  publishBusy?: boolean
  publishIcon: IconComponent
  onPublish: () => void | Promise<void>
  menuItems: PublishActionMenuItem[]
  menuLabel?: string
  triggerLabel?: string
  toast?: {
    tone: 'status' | 'alert'
    message: string
  } | null
}

const MENU_WIDTH = 184
const MENU_GAP = 6
const VIEWPORT_MARGIN = 8

interface MenuPosition {
  x: number
  y: number
}

export function PublishActionGroup({
  statusLabel,
  statusTone = 'neutral',
  statusAriaLabel,
  publishLabel,
  publishAriaLabel,
  publishTitle,
  publishState = 'idle',
  publishDisabled = false,
  publishBusy = false,
  publishIcon: PublishIcon,
  onPublish,
  menuItems,
  menuLabel = 'Publishing actions',
  triggerLabel = 'More publishing actions',
  toast,
}: PublishActionGroupProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  function closeMenu() {
    setMenuOpen(false)
    setMenuPosition(null)
    triggerRef.current?.focus()
  }

  function toggleMenu() {
    if (menuOpen) {
      closeMenu()
      return
    }

    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const maxX = window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN
    setMenuPosition({
      x: Math.max(VIEWPORT_MARGIN, Math.min(rect.right - MENU_WIDTH, maxX)),
      y: rect.bottom + MENU_GAP,
    })
    setMenuOpen(true)
  }

  function handleMenuItemSelect(item: PublishActionMenuItem) {
    if (item.disabled) return
    setMenuOpen(false)
    setMenuPosition(null)
    void item.onSelect()
  }

  return (
    <div className={styles.publishActionGroup}>
      {statusLabel && (
        <span
          role="status"
          aria-live="polite"
          aria-label={statusAriaLabel ?? statusLabel}
          className={styles.publishActionStatus}
          data-tone={statusTone}
        >
          <span className={styles.publishActionStatusDot} aria-hidden="true" />
          {statusLabel}
        </span>
      )}

      <div className={styles.publishActionWrapper}>
        <div className={styles.publishSplitButton}>
          <Button
            variant={publishState === 'error' ? 'destructive' : 'primary'}
            size="sm"
            className={styles.publishPrimaryButton}
            aria-label={publishAriaLabel}
            aria-busy={publishBusy}
            title={publishTitle}
            onClick={() => void onPublish()}
            disabled={publishDisabled}
            data-publish-state={publishState}
            data-testid="toolbar-publish-btn"
          >
            <PublishIcon
              size={13}
              className={cn(publishBusy && styles.spinIcon)}
              aria-hidden="true"
            />
            <span>{publishLabel}</span>
          </Button>
          <Button
            ref={triggerRef}
            variant={publishState === 'error' ? 'destructive' : 'primary'}
            size="sm"
            iconOnly
            className={styles.publishMenuTrigger}
            aria-label={triggerLabel}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            title={triggerLabel}
            onClick={toggleMenu}
            disabled={menuItems.length === 0}
            data-testid="toolbar-publish-actions-trigger"
          >
            <ChevronDown2Icon size={13} aria-hidden="true" />
          </Button>
        </div>

        {menuOpen && menuPosition && typeof document !== 'undefined' && createPortal(
          <ContextMenu
            id={menuId}
            x={menuPosition.x}
            y={menuPosition.y}
            width={MENU_WIDTH}
            minWidth={MENU_WIDTH}
            zIndex={10000}
            ariaLabel={menuLabel}
            onClose={closeMenu}
            data-testid="toolbar-publish-actions-menu"
          >
            {menuItems.map((item) => {
              const ItemIcon = item.icon
              return (
                <ContextMenuItem
                  key={item.id}
                  disabled={item.disabled}
                  onClick={() => handleMenuItemSelect(item)}
                  data-testid={item.testId}
                >
                  <span aria-hidden="true">
                    <ItemIcon size={14} />
                  </span>
                  <span>{item.label}</span>
                </ContextMenuItem>
              )
            })}
          </ContextMenu>,
          document.body,
        )}

        {toast && (
          <div
            role={toast.tone === 'alert' ? 'alert' : 'status'}
            className={cn(
              styles.publishToast,
              toast.tone === 'status' && styles.publishToastStatus,
            )}
          >
            {toast.message}
          </div>
        )}
      </div>
    </div>
  )
}
