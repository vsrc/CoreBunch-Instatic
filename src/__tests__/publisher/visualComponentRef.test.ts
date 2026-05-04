/**
 * Publisher VC inlining tests — Phase 5 slice 2a.
 *
 * Tests the renderVisualComponentRef() path in render.ts that intercepts
 * base.visual-component-ref nodes and inlines the instantiated VC tree.
 *
 * Coverage:
 *  1. Inlining with prop override
 *  2. Slot expansion (with content / with defaultValue / without either)
 *  3. Class CSS collection for VC node classIds
 *  4. Unknown componentId → HTML comment
 *  5. RichText override sanitization
 *  6. Nested VC refs (recursive inlining)
 */

import { describe, it, expect } from 'bun:test'
import { publishPage, renderNode, type RenderContext } from '@core/publisher/render'
import type { VisualComponent, VCParam, VCNode } from '@core/visualComponents/schemas'
import { makeModule, makeRegistry, makePage, makeSite } from './helpers'
import { ContainerModule } from '../../modules/base/container'
import { TextModule } from '../../modules/base/text'
import { VisualComponentRefModule } from '../../modules/base/visualComponentRef'
import { SlotOutletModule } from '../../modules/base/slotOutlet'
import { ContentModule } from '../../modules/base/content'

// ---------------------------------------------------------------------------
// Shared registry including all modules used by VCs under test
// ---------------------------------------------------------------------------

const registry = makeRegistry({
  'base.container': ContainerModule as never,
  'base.text': TextModule as never,
  'base.visual-component-ref': VisualComponentRefModule as never,
  'base.slot-outlet': SlotOutletModule as never,
  'base.content': ContentModule as never,
})

// ---------------------------------------------------------------------------
// VC fixture helpers
// ---------------------------------------------------------------------------

function makeParam(overrides: Partial<VCParam> & { id: string; name: string; type: VCParam['type'] }): VCParam {
  return {
    defaultValue: '',
    required: false,
    ...overrides,
  }
}

function makeVCNode(overrides: Partial<VCNode> & { id: string; moduleId: string }): VCNode {
  return {
    props: {},
    breakpointOverrides: {},
    children: [],
    classIds: [],
    ...overrides,
  }
}

function makeVC(overrides: Partial<VisualComponent> & { id: string; name: string; rootNode: VCNode }): VisualComponent {
  return {
    params: [],
    breakpoints: [],
    classIds: [],
    filePath: '',
    generated: true,
    ejected: false,
    createdAt: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1. Inlining with prop override
// ---------------------------------------------------------------------------

describe('VC inlining — prop override substitution', () => {
  // VC: <div><p>{title}</p></div>  where `title` is a param (id: 'param-title')
  const textNode = makeVCNode({
    id: 'vc-text',
    moduleId: 'base.text',
    props: { text: 'Default Title', tag: 'p' },
    propBindings: { text: { paramId: 'param-title' } },
  })
  const containerNode = makeVCNode({
    id: 'vc-root',
    moduleId: 'base.container',
    children: ['vc-text'],
    childNodes: [textNode],
  })
  const vc = makeVC({
    id: 'vc-card',
    name: 'Card',
    rootNode: containerNode,
    params: [makeParam({ id: 'param-title', name: 'title', type: 'string', defaultValue: 'Default Title' })],
  })

  it('inlines the VC tree and substitutes the prop override', () => {
    const page = makePage({
      root: {
        moduleId: 'base.visual-component-ref',
        props: {
          componentId: 'vc-card',
          propOverrides: { 'param-title': 'Override Title' },
          slotContent: {},
        },
      },
    })
    const site = makeSite({ visualComponents: [vc], pages: [page] })
    const { html } = publishPage(page, site, registry)
    expect(html).toContain('Override Title')
    expect(html).not.toContain('Default Title')
  })

  it('uses the param defaultValue when no override is provided', () => {
    const page = makePage({
      root: {
        moduleId: 'base.visual-component-ref',
        props: {
          componentId: 'vc-card',
          propOverrides: {},
          slotContent: {},
        },
      },
    })
    const site = makeSite({ visualComponents: [vc], pages: [page] })
    const { html } = publishPage(page, site, registry)
    expect(html).toContain('Default Title')
  })

  it('emits the VC root element in the published HTML', () => {
    const page = makePage({
      root: {
        moduleId: 'base.visual-component-ref',
        props: {
          componentId: 'vc-card',
          propOverrides: { 'param-title': 'Hello' },
          slotContent: {},
        },
      },
    })
    const site = makeSite({ visualComponents: [vc], pages: [page] })
    const { html } = publishPage(page, site, registry)
    // Container renders as <div>, text renders as <p>
    expect(html).toContain('<div>')
    expect(html).toContain('<p>Hello</p>')
  })
})

// ---------------------------------------------------------------------------
// 2. Slot expansion
// ---------------------------------------------------------------------------

describe('VC inlining — slot expansion', () => {
  // VC: <div>[slot: children]</div>
  const slotOutletNode = makeVCNode({
    id: 'vc-slot-outlet',
    moduleId: 'base.slot-outlet',
    props: { slotName: 'children' },
  })
  const slotContainerNode = makeVCNode({
    id: 'vc-slot-root',
    moduleId: 'base.container',
    children: ['vc-slot-outlet'],
    childNodes: [slotOutletNode],
  })

  // Default slot content for when no instance content is provided
  const defaultSlotNode = makeVCNode({
    id: 'default-slot-text',
    moduleId: 'base.text',
    props: { text: 'Default slot content', tag: 'p' },
  })

  const vcWithSlot = makeVC({
    id: 'vc-slot',
    name: 'SlotComponent',
    rootNode: slotContainerNode,
    params: [makeParam({
      id: 'param-children',
      name: 'children',
      type: 'slot',
      defaultValue: [defaultSlotNode] as unknown,
    })],
  })

  it('expands slot with provided slotContent', () => {
    // Instance slot content: a text node
    const slotTextNode = makeVCNode({
      id: 'slot-content-text',
      moduleId: 'base.text',
      props: { text: 'Instance slot content', tag: 'p' },
    })
    const page = makePage({
      root: {
        moduleId: 'base.visual-component-ref',
        props: {
          componentId: 'vc-slot',
          propOverrides: {},
          slotContent: { children: [slotTextNode] },
        },
      },
    })
    const site = makeSite({ visualComponents: [vcWithSlot], pages: [page] })
    const { html } = publishPage(page, site, registry)
    expect(html).toContain('Instance slot content')
    expect(html).not.toContain('Default slot content')
  })

  it('uses slot param defaultValue when no slotContent is provided', () => {
    const page = makePage({
      root: {
        moduleId: 'base.visual-component-ref',
        props: {
          componentId: 'vc-slot',
          propOverrides: {},
          slotContent: {},
        },
      },
    })
    const site = makeSite({ visualComponents: [vcWithSlot], pages: [page] })
    const { html } = publishPage(page, site, registry)
    expect(html).toContain('Default slot content')
  })

  it('emits empty string for slot-outlet with no content and no defaultValue', () => {
    // VC with a slot outlet that has NO defaultValue
    const vcNoDefault = makeVC({
      id: 'vc-no-default',
      name: 'NoDefault',
      rootNode: slotContainerNode,
      params: [makeParam({
        id: 'param-empty',
        name: 'children',
        type: 'slot',
        defaultValue: [],
      })],
    })
    const page = makePage({
      root: {
        moduleId: 'base.visual-component-ref',
        props: {
          componentId: 'vc-no-default',
          propOverrides: {},
          slotContent: {},
        },
      },
    })
    const site = makeSite({ visualComponents: [vcNoDefault], pages: [page] })
    const { html } = publishPage(page, site, registry)
    // The slot-outlet renders as empty string (no content, no default)
    // The container div is present but empty
    expect(html).toContain('<div></div>')
    // No slot comment markers or placeholder text
    expect(html).not.toContain('slotOutlet')
    expect(html).not.toContain('<!-- ')
  })
})

// ---------------------------------------------------------------------------
// 3. Class CSS — VC node classIds included in CSS bundle
// ---------------------------------------------------------------------------

describe('VC inlining — class CSS collection', () => {
  it('CSS class rules for VC node classIds appear in published output', () => {
    // VC text node has a classId referencing a CSS class
    const textNode = makeVCNode({
      id: 'vc-cls-text',
      moduleId: 'base.text',
      props: { text: 'Styled', tag: 'p' },
      classIds: ['cls-heading'],
    })
    const rootNode = makeVCNode({
      id: 'vc-cls-root',
      moduleId: 'base.container',
      children: ['vc-cls-text'],
      childNodes: [textNode],
    })
    const vc = makeVC({ id: 'vc-cls', name: 'Cls', rootNode })

    const page = makePage({
      root: {
        moduleId: 'base.visual-component-ref',
        props: { componentId: 'vc-cls', propOverrides: {}, slotContent: {} },
      },
    })
    const site = makeSite({
      visualComponents: [vc],
      pages: [page],
      classes: {
        'cls-heading': {
          id: 'cls-heading',
          name: 'heading-xl',
          styles: { fontSize: '2rem' },
          breakpointStyles: {},
          createdAt: 0,
          updatedAt: 0,
        },
      },
    })

    const { html } = publishPage(page, site, registry)
    // The class name appears in the HTML (injected onto the text element)
    expect(html).toContain('heading-xl')
    // The CSS rule for the class appears in the <style> block
    expect(html).toContain('font-size')
  })

  it('CSS dedup: VC used twice — both instances render, shared cssMap used', () => {
    // Use a custom module that returns CSS so we can verify dedup
    const withCssRegistry = makeRegistry({
      'base.visual-component-ref': VisualComponentRefModule as never,
      'base.slot-outlet': SlotOutletModule as never,
      'test.styled': makeModule('test.styled', {
        render: (props) => ({
          html: `<p>${String((props as { text: unknown }).text)}</p>`,
          css: 'p { color: navy; }',
        }),
      }),
      'base.container': ContainerModule as never,
    })

    const styledNode = makeVCNode({
      id: 'vc-dedup-styled',
      moduleId: 'test.styled',
      props: { text: 'Styled' },
    })
    const rootNode = makeVCNode({
      id: 'vc-dedup-root',
      moduleId: 'base.container',
      children: ['vc-dedup-styled'],
      childNodes: [styledNode],
    })
    const vc = makeVC({ id: 'vc-dedup', name: 'Dedup', rootNode })

    // Two ref nodes pointing at the same VC
    const page = makePage({
      root: {
        moduleId: 'base.container',
        props: {},
        children: ['ref1', 'ref2'],
      },
      ref1: {
        moduleId: 'base.visual-component-ref',
        props: { componentId: 'vc-dedup', propOverrides: {}, slotContent: {} },
      },
      ref2: {
        moduleId: 'base.visual-component-ref',
        props: { componentId: 'vc-dedup', propOverrides: {}, slotContent: {} },
      },
    })
    const site = makeSite({ visualComponents: [vc], pages: [page] })
    const cssMap = new Map<string, string>()
    const html = renderNode('root', { page, site, registry: withCssRegistry, breakpointId: undefined, cssMap })

    // Both instances of the VC appear in the HTML
    expect(html.match(/<p>Styled<\/p>/g)?.length).toBe(2)
    // But the CSS rule is deduplicated — only one entry for the module type
    expect(cssMap.has('test.styled')).toBe(true)
    expect(cssMap.size).toBe(1) // only test.styled has CSS; base.container returns none
    // And the CSS appears exactly once (not duplicated)
    const cssCount = (cssMap.get('test.styled') ?? '').split('p { color: navy; }').length - 1
    expect(cssCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 4. Unknown componentId
// ---------------------------------------------------------------------------

describe('VC inlining — unknown componentId', () => {
  it('emits an HTML comment for a non-existent componentId', () => {
    const page = makePage({
      root: {
        moduleId: 'base.visual-component-ref',
        props: { componentId: 'nonexistent-vc', propOverrides: {}, slotContent: {} },
      },
    })
    const site = makeSite({ visualComponents: [], pages: [page] })
    const cssMap = new Map<string, string>()
    const html = renderNode('root', { page, site, registry, breakpointId: undefined, cssMap })
    expect(html).toContain('<!-- pb: unknown component')
    expect(html).toContain('nonexistent-vc')
    expect(html).not.toContain('<div>')
  })

  it('emits a missing-componentId comment when componentId is empty', () => {
    const page = makePage({
      root: {
        moduleId: 'base.visual-component-ref',
        props: { componentId: '', propOverrides: {}, slotContent: {} },
      },
    })
    const site = makeSite({ visualComponents: [], pages: [page] })
    const cssMap = new Map<string, string>()
    const html = renderNode('root', { page, site, registry, breakpointId: undefined, cssMap })
    expect(html).toContain('<!-- pb: visual-component-ref missing componentId -->')
  })

  it('HTML-escapes the componentId in the error comment to prevent XSS', () => {
    const page = makePage({
      root: {
        moduleId: 'base.visual-component-ref',
        props: { componentId: '<script>evil</script>', propOverrides: {}, slotContent: {} },
      },
    })
    const site = makeSite({ visualComponents: [], pages: [page] })
    const cssMap = new Map<string, string>()
    const html = renderNode('root', { page, site, registry, breakpointId: undefined, cssMap })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

// ---------------------------------------------------------------------------
// 5. RichText override sanitization
// ---------------------------------------------------------------------------

describe('VC inlining — richtext prop sanitization', () => {
  // VC: <article>{html param}</article> using base.content (html is a richtext key)
  const contentNode = makeVCNode({
    id: 'vc-content-node',
    moduleId: 'base.content',
    props: { html: '' },
    propBindings: { html: { paramId: 'param-html' } },
  })
  const contentRootNode = makeVCNode({
    id: 'vc-content-root',
    moduleId: 'base.container',
    children: ['vc-content-node'],
    childNodes: [contentNode],
  })
  const vcContent = makeVC({
    id: 'vc-richtext',
    name: 'RichTextVC',
    rootNode: contentRootNode,
    params: [makeParam({ id: 'param-html', name: 'html', type: 'richText', defaultValue: '' })],
  })

  it('strips <script> from richtext param override, preserves safe HTML', () => {
    const page = makePage({
      root: {
        moduleId: 'base.visual-component-ref',
        props: {
          componentId: 'vc-richtext',
          propOverrides: { 'param-html': '<p>ok</p><script>bad()</script>' },
          slotContent: {},
        },
      },
    })
    const site = makeSite({ visualComponents: [vcContent], pages: [page] })
    const { html } = publishPage(page, site, registry)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('bad()')
    // Safe text content must be preserved
    expect(html).toContain('ok')
  })

  it('sanitized richtext does not break the surrounding HTML structure', () => {
    const page = makePage({
      root: {
        moduleId: 'base.visual-component-ref',
        props: {
          componentId: 'vc-richtext',
          propOverrides: { 'param-html': '<p>text</p><script>x()</script>' },
          slotContent: {},
        },
      },
    })
    const site = makeSite({ visualComponents: [vcContent], pages: [page] })
    const { html } = publishPage(page, site, registry)
    // The <article> wrapper from base.content must be intact
    expect(html).toContain('<article>')
    expect(html).not.toContain('<script>')
  })
})

// ---------------------------------------------------------------------------
// 6. Nested VC refs (recursive inlining)
// ---------------------------------------------------------------------------

describe('VC inlining — nested VC refs', () => {
  it('recursively inlines a VC that contains another VC ref', () => {
    // Inner VC: <p>Inner</p>
    const innerTextNode = makeVCNode({
      id: 'inner-text',
      moduleId: 'base.text',
      props: { text: 'Inner', tag: 'p' },
    })
    const innerVC = makeVC({
      id: 'vc-inner',
      name: 'InnerCard',
      rootNode: innerTextNode,
    })

    // Outer VC: <div>[ref to inner VC]</div>
    const refNode = makeVCNode({
      id: 'outer-ref',
      moduleId: 'base.visual-component-ref',
      props: { componentId: 'vc-inner', propOverrides: {}, slotContent: {} },
    })
    const outerRootNode = makeVCNode({
      id: 'outer-root',
      moduleId: 'base.container',
      children: ['outer-ref'],
      childNodes: [refNode],
    })
    const outerVC = makeVC({
      id: 'vc-outer',
      name: 'OuterCard',
      rootNode: outerRootNode,
    })

    // Page ref points to the outer VC
    const page = makePage({
      root: {
        moduleId: 'base.visual-component-ref',
        props: { componentId: 'vc-outer', propOverrides: {}, slotContent: {} },
      },
    })
    const site = makeSite({ visualComponents: [innerVC, outerVC], pages: [page] })
    const { html } = publishPage(page, site, registry)

    // Both levels must be inlined
    expect(html).toContain('Inner')
    // Structure: outer container wraps inner text
    expect(html).toContain('<div>')
    expect(html).toContain('<p>Inner</p>')
  })
})
