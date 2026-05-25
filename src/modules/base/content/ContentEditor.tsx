/**
 * base.content editor preview component.
 *
 * Component-only file so React Fast Refresh can hot-patch edits without
 * re-running module registration.
 */
import React from 'react'
import type { ModuleComponentProps } from '@core/module-engine/types'
import { CanvasModulePlaceholder } from '@ui/components/CanvasModulePlaceholder'
import { TextPlusIcon } from 'pixel-art-icons/icons/text-plus'

interface ContentProps extends Record<string, unknown> {
  html: string
}

export const ContentEditor: React.FC<ModuleComponentProps<ContentProps>> = ({ props, mcClassName, nodeWrapperProps }) => {
  if (!props.html) {
    return (
      <CanvasModulePlaceholder
        {...nodeWrapperProps}
        className={mcClassName}
        icon={<TextPlusIcon size={16} />}
        label="Content body"
      />
    )
  }

  return (
    <article
      {...nodeWrapperProps}
      className={mcClassName}
      dangerouslySetInnerHTML={{ __html: props.html }}
    />
  )
}
