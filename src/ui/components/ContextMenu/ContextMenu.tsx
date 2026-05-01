import {
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Button, type ButtonProps } from '@ui/components/Button'
import { Separator } from '@ui/components/Separator'
import { cn } from '@ui/cn'
import styles from './ContextMenu.module.css'

interface ContextMenuProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  x: number
  y: number
  ariaLabel: string
  onClose: () => void
  children: ReactNode
  minWidth?: number
  width?: number
  zIndex?: number
  menuClassName?: string
}

export const ContextMenu = forwardRef<HTMLDivElement, ContextMenuProps>(function ContextMenu(
  {
    x,
    y,
    ariaLabel,
    onClose,
    children,
    minWidth = 176,
    width = minWidth,
    zIndex = 1000,
    menuClassName,
    onKeyDown,
    ...props
  },
  ref,
) {
  const style = {
    '--context-menu-x': `${x}px`,
    '--context-menu-y': `${y}px`,
    '--context-menu-min-width': `${minWidth}px`,
    '--context-menu-width': `${width}px`,
    '--context-menu-z-index': zIndex,
  } as CSSProperties

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
    onKeyDown?.(event)
  }

  return (
    <>
      <div
        className={styles.backdrop}
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault()
          onClose()
        }}
        style={style}
      />
      <div
        ref={ref}
        role="menu"
        aria-label={ariaLabel}
        className={cn(styles.menu, menuClassName)}
        style={style}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </div>
    </>
  )
})

interface ContextMenuItemProps extends Omit<ButtonProps, 'variant' | 'size' | 'menuItem' | 'tone'> {
  danger?: boolean
}

export const ContextMenuItem = forwardRef<HTMLButtonElement, ContextMenuItemProps>(
  function ContextMenuItem({ danger = false, className, children, ...props }, ref) {
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="xs"
        menuItem
        role="menuitem"
        tone={danger ? 'danger' : 'default'}
        className={cn(styles.item, className)}
        {...props}
      >
        {children}
      </Button>
    )
  },
)

export function ContextMenuSeparator() {
  return <Separator spacing="compact" className={styles.separator} />
}
