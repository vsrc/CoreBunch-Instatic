/**
 * base.button editor preview component.
 *
 * Component-only file so React Fast Refresh can hot-patch edits without
 * re-running module registration.
 */
import React from 'react'
import type { ModuleComponentProps } from '@core/module-engine/types'

interface ButtonProps extends Record<string, unknown> {
  label: string
  href: string
  target: '_blank' | '_self' | '_parent'
  disabled: boolean
}

export const ButtonEditor: React.FC<ModuleComponentProps<ButtonProps>> = ({ props, mcClassName }) => {
  if (props.href) {
    const rel = props.target === '_blank' ? 'noopener noreferrer' : undefined
    return <a href={props.href} target={props.target} rel={rel} className={mcClassName}>{props.label || 'Button'}</a>
  }
  return <button type="button" className={mcClassName} disabled={props.disabled}>{props.label || 'Button'}</button>
}
