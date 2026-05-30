/**
 * Unit tests for `materializeImportedNodeStyle` — turning an imported node's
 * inline background (`fragment.nodeStyles`) into a node-scoped module-style
 * StyleRule that the editor's BackgroundImageControl can edit.
 */

import { describe, it, expect } from 'bun:test'
import { materializeImportedNodeStyle } from '@site/store/slices/site/importLinking'
import type { StyleRule } from '@core/page-tree'

describe('materializeImportedNodeStyle', () => {
  it('creates a node-scoped module-style class carrying the inline styles', () => {
    const rules: Record<string, StyleRule> = {}
    const nodeStyles = { n1: { backgroundImage: `url('/uploads/media/hero.png')` } }

    const id = materializeImportedNodeStyle(nodeStyles, 'n1', rules)
    expect(id).not.toBeNull()

    const rule = rules[id!]
    expect(rule.kind).toBe('class')
    expect(rule.scope).toEqual({ type: 'node', nodeId: 'n1', role: 'module-style' })
    expect((rule.styles as Record<string, string>).backgroundImage).toBe(`url('/uploads/media/hero.png')`)
    // Selector is derived from the (escaped) name so the publisher emits it.
    expect(rule.selector.startsWith('.')).toBe(true)
    expect(rule.tags).toContain('module-instance')
  })

  it('appends after every existing rule in cascade order', () => {
    const rules: Record<string, StyleRule> = {
      existing: {
        id: 'existing', name: 'btn', kind: 'class', selector: '.btn',
        order: 7, styles: {}, contextStyles: {}, createdAt: 1, updatedAt: 1,
      },
    }
    const id = materializeImportedNodeStyle({ n1: { backgroundImage: `url('x.png')` } }, 'n1', rules)
    expect(rules[id!].order).toBe(8)
  })

  it('returns null (and adds nothing) when the node has no inline styles', () => {
    const rules: Record<string, StyleRule> = {}
    expect(materializeImportedNodeStyle(undefined, 'n1', rules)).toBeNull()
    expect(materializeImportedNodeStyle({}, 'n1', rules)).toBeNull()
    expect(materializeImportedNodeStyle({ other: { backgroundImage: 'url(x)' } }, 'n1', rules)).toBeNull()
    expect(Object.keys(rules)).toHaveLength(0)
  })
})
