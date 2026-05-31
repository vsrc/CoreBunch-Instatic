/**
 * pageRefRender.test.ts — the publisher resolves internal page references
 * (`cms:page:<id>`) to the target page's current public path at render time.
 */

import { describe, it, expect } from 'bun:test'
import { renderNode, type RenderContext } from '@core/publisher'
import { makeModule, makeRegistry, makePage, makeSite } from './helpers'

// A module that echoes its (already-resolved) href so we can assert on it.
const linkModule = makeModule('test.link', {
  canHaveChildren: false,
  render: (props) => ({ html: `<a href="${String(props.href)}">x</a>` }),
})
const registry = makeRegistry({ 'test.link': linkModule })

function ctxWith(href: string): RenderContext {
  const page = makePage({ root: { moduleId: 'test.link', props: { href } } })
  const site = makeSite({
    pages: [
      { ...page, id: 'home-id', slug: 'index' },
      { ...page, id: 'club-id', slug: 'club' },
    ],
  })
  return { page, site, registry, breakpointId: undefined, cssMap: new Map() }
}

describe('publisher page-ref resolution', () => {
  it('resolves a page ref to /slug', () => {
    expect(renderNode('root', ctxWith('cms:page:club-id'))).toBe('<a href="/club">x</a>')
  })

  it('resolves a home-page ref (slug "index") to "/"', () => {
    expect(renderNode('root', ctxWith('cms:page:home-id'))).toBe('<a href="/">x</a>')
  })

  it('preserves a fragment', () => {
    expect(renderNode('root', ctxWith('cms:page:club-id#join'))).toBe('<a href="/club#join">x</a>')
  })

  it('resolves a dangling ref to "#"', () => {
    expect(renderNode('root', ctxWith('cms:page:deleted'))).toBe('<a href="#">x</a>')
  })

  it('leaves a normal URL untouched', () => {
    expect(renderNode('root', ctxWith('https://example.com'))).toBe('<a href="https://example.com">x</a>')
  })
})
