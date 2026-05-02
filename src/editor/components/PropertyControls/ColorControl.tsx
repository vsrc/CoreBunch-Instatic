import { useEffect, useState } from 'react'
import type { ControlProps } from './shared'
import { cn } from '@ui/cn'
import { TokenizedColorField } from './TokenizedColorField'
import styles from './controls.module.css'
interface ColorControlProps extends ControlProps<string> {
  format?: 'hex' | 'rgba'
  placeholder?: string
}

export function ColorControl({
  propKey,
  value,
  onChange,
  label,
  placeholder,
  isOverride,
  disabled,
}: ColorControlProps) {
  const stringValue = String(value ?? '')
  const [text, setText] = useState(stringValue)

  useEffect(() => {
    setText(stringValue)
  }, [stringValue])

  const handleTextBlur = () => {
    // Validate before committing
    const s = text.trim()
    const isTokenReference = /^var\(\s*--[a-z0-9_-]+\s*\)$/i.test(s)
    const cssSupportsColor =
      typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
        ? CSS.supports('color', s)
        : true
    if (s === '' || isTokenReference || cssSupportsColor) {
      onChange(propKey, s)
    } else {
      // Revert to last known-good value
      setText(String(value ?? ''))
    }
  }

  function handleSwatchChange(nextValue: string) {
    setText(nextValue)
    onChange(propKey, nextValue)
  }

  function handleTokenSelect(nextValue: string) {
    setText(nextValue)
    onChange(propKey, nextValue)
  }

  return (
    <div className={cn(styles.controlWrapper, disabled && styles.controlWrapperDisabled)}>
      <div className={styles.labelRow}>
        <label
          htmlFor={`ctrl-${propKey}-text`}
          className={isOverride ? styles.labelOverride : undefined}
        >
          {label ?? propKey}
        </label>
      </div>
      <TokenizedColorField
        id={`ctrl-${propKey}-text`}
        value={text}
        disabled={disabled}
        inputLabel={label ?? propKey}
        swatchLabel={`${label ?? propKey} colour swatch`}
        placeholder={placeholder ?? '#000000 or rgb(...)'}
        fieldSize="sm"
        monospace
        onTextChange={setText}
        onTextBlur={handleTextBlur}
        onSwatchChange={handleSwatchChange}
        onTokenSelect={handleTokenSelect}
      />
    </div>
  )
}
