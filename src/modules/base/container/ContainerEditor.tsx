/**
 * base.container editor preview component.
 *
 * Component-only file so React Fast Refresh can hot-patch edits without
 * re-running module registration. Per Constraint #309, this file MUST NOT
 * export non-component values — `resolveContainerTag` is duplicated in
 * `index.ts` for the publisher render path.
 */
import React from 'react'
import type { ModuleComponentProps } from '@core/module-engine/types'

type ContainerTag = 'div' | 'section' | 'article' | 'main' | 'header' | 'footer'

interface ContainerProps extends Record<string, unknown> {
  tag: ContainerTag
}

const VALID_TAGS = new Set<ContainerTag>(['div', 'section', 'article', 'main', 'header', 'footer'])

function resolveContainerTag(value: unknown): ContainerTag {
  return typeof value === 'string' && VALID_TAGS.has(value as ContainerTag)
    ? (value as ContainerTag)
    : 'div'
}

export const ContainerEditor: React.FC<ModuleComponentProps<ContainerProps>> = ({
  props,
  children,
  mcClassName,
}) => {
  const Tag = resolveContainerTag(props.tag)
  return React.createElement(Tag, { className: mcClassName }, children)
}
