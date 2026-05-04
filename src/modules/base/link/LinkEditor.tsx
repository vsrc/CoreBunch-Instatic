/**
 * base.link editor preview component.
 *
 * Component-only file so React Fast Refresh can hot-patch edits without
 * re-running module registration.
 */
import React from 'react'
import type { ModuleComponentProps } from '@core/module-engine/types'

interface LinkProps extends Record<string, unknown> {
  href: string
  text: string
  target: '_blank' | '_self' | '_parent'
}

export const LinkEditor: React.FC<ModuleComponentProps<LinkProps>> = ({ props, children, mcClassName }) => {
  const rel = props.target === '_blank' ? 'noopener noreferrer' : undefined
  return React.createElement(
    'a',
    {
      href: props.href || '#',
      target: props.target,
      rel,
      className: mcClassName,
    },
    children ?? props.text ?? 'Link text',
  )
}
