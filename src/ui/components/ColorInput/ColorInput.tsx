import {
  forwardRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type InputHTMLAttributes,
} from 'react'
import { cn } from '@ui/cn'
import { getColorInputValue } from './ColorInput.utils'
import styles from './ColorInput.module.css'

type ColorInputSize = 'xs' | 'sm' | 'md'

interface ColorInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  fieldSize?: ColorInputSize
  swatchValue?: string
}

type ColorInputStyle = CSSProperties & { '--color-input-value'?: string }

export const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(function ColorInput(
  {
    className,
    fieldSize = 'sm',
    swatchValue,
    value,
    defaultValue,
    disabled,
    onChange,
    style,
    ...props
  },
  ref,
) {
  const [uncontrolledValue, setUncontrolledValue] = useState(getColorInputValue(defaultValue))
  const currentValue = value === undefined
    ? uncontrolledValue
    : getColorInputValue(value)
  const displayValue = getColorInputValue(swatchValue ?? currentValue)
  const frameStyle: ColorInputStyle = {
    ...style,
    '--color-input-value': displayValue,
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (value === undefined) {
      setUncontrolledValue(event.target.value)
    }
    onChange?.(event)
  }

  return (
    <span
      className={cn(
        styles.colorInput,
        styles[`size-${fieldSize}`],
        disabled && styles.disabled,
        className,
      )}
      style={frameStyle}
    >
      <span className={styles.preview} aria-hidden="true" />
      <input
        {...props}
        ref={ref}
        type="color"
        value={currentValue}
        disabled={disabled}
        onChange={handleChange}
        className={styles.nativeInput}
      />
    </span>
  )
})
