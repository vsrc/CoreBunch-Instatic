import {
  forwardRef,
  useRef,
  type InputHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { Button, type ButtonProps } from '@ui/components/Button'
import { cn } from '@ui/cn'
import styles from './FileUpload.module.css'

type UploadButtonProps = Omit<ButtonProps, 'children' | 'type' | 'onClick'> & {
  onClick?: ButtonProps['onClick']
  'data-testid'?: string
}

interface FileUploadProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  buttonProps: UploadButtonProps
  children: ReactNode
}

function assignRef(ref: Ref<HTMLInputElement> | undefined, value: HTMLInputElement | null) {
  if (!ref) return
  if (typeof ref === 'function') {
    ref(value)
    return
  }
  ref.current = value
}

export const FileUpload = forwardRef<HTMLInputElement, FileUploadProps>(function FileUpload(
  {
    buttonProps,
    children,
    className,
    'aria-hidden': ariaHidden = true,
    tabIndex = -1,
    ...inputProps
  },
  forwardedRef,
) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { onClick, ...buttonRest } = buttonProps

  function setInputRef(node: HTMLInputElement | null) {
    inputRef.current = node
    assignRef(forwardedRef, node)
  }

  function handleButtonClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event)
    if (!event.defaultPrevented) {
      inputRef.current?.click()
    }
  }

  return (
    <span className={cn(styles.fileUpload, className)}>
      <Button
        {...buttonRest}
        type="button"
        onClick={handleButtonClick}
      >
        {children}
      </Button>
      <input
        {...inputProps}
        ref={setInputRef}
        type="file"
        aria-hidden={ariaHidden}
        tabIndex={tabIndex}
        className={styles.nativeInput}
      />
    </span>
  )
})
