import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@ui/cn'
import styles from './Switch.module.css'

interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role' | 'onChange'> {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  hitArea?: boolean
  switchSize?: 'sm' | 'md'
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  {
    checked,
    onCheckedChange,
    hitArea = false,
    switchSize = 'md',
    className,
    disabled,
    onClick,
    type = 'button',
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-hit-area={hitArea ? 'true' : undefined}
      data-size={switchSize}
      className={cn(styles.switch, className)}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented && !disabled) {
          onCheckedChange?.(!checked)
        }
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(styles.track, checked ? styles.trackOn : styles.trackOff)}
      >
        <span
          aria-hidden="true"
          className={cn(styles.thumb, checked ? styles.thumbOn : styles.thumbOff)}
        />
      </span>
      {children}
    </button>
  )
})
