/**
 * base.text editor preview component.
 *
 * Component-only file so React Fast Refresh can hot-patch edits without
 * re-running module registration. Per Constraint #309, this file MUST NOT
 * export non-component values — `normalizeTag` is duplicated in `index.ts`
 * for the publisher render path.
 *
 * Text is edited via the Properties panel only. The canvas-side inline
 * (double-click contentEditable) editing was removed because the
 * iframe-per-frame architecture makes focus/selection management
 * unreliable across the cross-frame boundary; a clean replacement will be
 * designed separately.
 */
import React from 'react'
import type { ModuleComponentProps } from '@core/module-engine/types'

type TextTag =
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'span'
  | 'div'
  | 'small'
  | 'strong'
  | 'em'

interface TextProps extends Record<string, unknown> {
  text: string
  tag: TextTag
}

const TEXT_TAGS = new Set<TextTag>([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'div',
  'small',
  'strong',
  'em',
])

function normalizeTag(tag: unknown): TextTag {
  const value = String(tag || 'p').toLowerCase() as TextTag
  return TEXT_TAGS.has(value) ? value : 'p'
}

export const TextEditor: React.FC<ModuleComponentProps<TextProps>> = ({
  props,
  mcClassName,
  nodeWrapperProps,
}) => {
  const Tag = normalizeTag(props.tag) as React.ElementType
  return React.createElement(Tag, { ...nodeWrapperProps, className: mcClassName }, props.text || 'Text')
}
