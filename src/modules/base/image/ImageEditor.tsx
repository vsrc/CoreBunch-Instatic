/**
 * base.image editor preview component.
 *
 * Component-only file so React Fast Refresh can hot-patch edits without
 * re-running module registration.
 */
import React from 'react'
import type { ModuleComponentProps } from '@core/module-engine/types'
import { cn } from '@ui/cn'
import styles from './image.module.css'

interface ImageProps extends Record<string, unknown> {
  src: string
  alt: string
  loading: 'lazy' | 'eager'
}

export const ImageEditor: React.FC<ModuleComponentProps<ImageProps>> = ({ props, mcClassName }) => {
  if (props.src) {
    return <img src={props.src} alt={props.alt || ''} className={mcClassName} loading={props.loading} />
  }
  return <div className={cn(styles.placeholder, mcClassName)}>No image selected</div>
}
