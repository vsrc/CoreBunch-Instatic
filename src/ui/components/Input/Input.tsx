import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@ui/cn'
import styles from './Input.module.css'

type FieldSize = 'xs' | 'sm' | 'md'
type TextEmphasis = 'default' | 'strong'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  fieldSize?: FieldSize
  monospace?: boolean
  emphasis?: TextEmphasis
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  fieldSize?: FieldSize
  monospace?: boolean
  emphasis?: TextEmphasis
  resize?: 'none' | 'vertical' | 'both'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, fieldSize = 'md', monospace = false, emphasis = 'default', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || props['aria-invalid'] ? true : undefined}
      data-emphasis={emphasis !== 'default' ? emphasis : undefined}
      className={cn(
        styles.input,
        styles[`size-${fieldSize}`],
        monospace && styles.monospace,
        invalid && styles.invalid,
        className,
      )}
      {...props}
    />
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    className,
    invalid = false,
    fieldSize = 'md',
    monospace = false,
    emphasis = 'default',
    resize = 'vertical',
    ...props
  },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || props['aria-invalid'] ? true : undefined}
      data-emphasis={emphasis !== 'default' ? emphasis : undefined}
      data-resize={resize}
      className={cn(
        styles.input,
        styles.textarea,
        styles[`size-${fieldSize}`],
        monospace && styles.monospace,
        invalid && styles.invalid,
        className,
      )}
      {...props}
    />
  )
})
