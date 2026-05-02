import type { ControlProps } from './shared'
import { Select } from '@ui/components/Select'
import { cn } from '@ui/cn'
import styles from './controls.module.css'

interface SelectOption {
  label: string
  value: unknown
}

interface SelectControlProps extends ControlProps<unknown> {
  options: SelectOption[]
  placeholder?: string
}

export function SelectControl({
  propKey,
  value,
  onChange,
  label,
  options,
  placeholder,
  isOverride,
  disabled,
}: SelectControlProps) {
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
      <Select
        id={`ctrl-${propKey}`}
        value={String(value ?? '')}
        placeholder={placeholder}
        disabled={disabled}
        fieldSize="sm"
        onChange={(e) => {
          const raw = e.target.value
          const matched = options.find((o) => String(o.value) === raw)
          onChange(propKey, matched !== undefined ? matched.value : raw)
        }}
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </Select>
    </div>
  )
}
