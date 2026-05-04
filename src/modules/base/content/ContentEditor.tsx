/**
 * base.content editor preview component.
 *
 * Component-only file so React Fast Refresh can hot-patch edits without
 * re-running module registration.
 */
import React from 'react'
import type { ModuleComponentProps } from '@core/module-engine/types'
import { cn } from '@ui/cn'
import styles from './content.module.css'

interface ContentProps extends Record<string, unknown> {
  html: string
}

export const ContentEditor: React.FC<ModuleComponentProps<ContentProps>> = ({ props, mcClassName }) => {
  if (!props.html) {
    return <div className={cn(styles.placeholder, mcClassName)}>Content body</div>
  }

  return (
    <article
      className={mcClassName}
      dangerouslySetInnerHTML={{ __html: props.html }}
    />
  )
}
