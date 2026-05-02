import type { ControlProps } from './shared'
import { Input } from '@ui/components/Input'
import { cn } from '@ui/cn'
import styles from './controls.module.css'

interface TextControlProps extends ControlProps<string> {
  placeholder?: string
}

export function TextControl({ propKey, value, onChange, label, placeholder, isOverride, disabled }: TextControlProps) {
  return (
    <div className={cn(styles.controlWrapper, disabled && styles.controlWrapperDisabled)}>
      <div className={styles.labelRow}>
        <label
          htmlFor={`ctrl-${propKey}`}
          className={isOverride ? styles.labelOverride : undefined}
        >
          {label ?? propKey}
        </label>
      </div>
      <Input
        id={`ctrl-${propKey}`}
        type="text"
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        fieldSize="sm"
        onChange={(e) => onChange(propKey, e.target.value)}
      />
    </div>
  )
}
