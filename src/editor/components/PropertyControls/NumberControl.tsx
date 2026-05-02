import type { ControlProps } from './shared'
import { Input } from '@ui/components/Input'
import { cn } from '@ui/cn'
import styles from './controls.module.css'

interface NumberControlProps extends ControlProps<number> {
  min?: number
  max?: number
  step?: number
  unit?: string
}

export function NumberControl({
  propKey,
  value,
  onChange,
  label,
  min,
  max,
  step = 1,
  unit,
  isOverride,
  disabled,
}: NumberControlProps) {
  return (
    <div className={cn(styles.controlWrapper, disabled && styles.controlWrapperDisabled)}>
      <div className={styles.labelRow}>
        <label
          htmlFor={`ctrl-${propKey}`}
          className={isOverride ? styles.labelOverride : undefined}
        >
          {label ?? propKey}
        </label>
        {unit && (
          <span className={styles.labelUnit}>{unit}</span>
        )}
      </div>
      <Input
        id={`ctrl-${propKey}`}
        type="number"
        value={value ?? 0}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        fieldSize="sm"
        onChange={(e) => {
          const v = e.target.valueAsNumber
          if (!isNaN(v)) onChange(propKey, v)
        }}
      />
    </div>
  )
}
