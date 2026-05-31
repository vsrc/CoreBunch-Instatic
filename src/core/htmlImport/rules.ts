/**
 * HTML → module mapping rules for the HTML importer.
 *
 * Rules are tested in order; the first match wins. The catch-all `*` rule
 * is always last and guarantees every element produces a node — nothing
 * falls through.
 *
 * Verified prop names against module source:
 *   base.text    — `text` (string), `tag` (TextTag)
 *   base.link    — `text` (string), `href`, `target`   (NOT `label`)
 *   base.button  — `label` (string), `href`, `target`, `disabled`
 *   base.image   — `src` only (alt comes from media library, not a prop)
 *   base.container — `tag` (builtin name | 'custom'), `customTag` (free text)
 *
 * BUILTIN_HTML_TAGS in base.container: div, section, article, main, header,
 * footer, nav, aside, ul, ol. Tags outside that set MUST use tag:'custom' +
 * customTag so resolveHtmlTag emits the real element name.
 */

import { normalizeImportedText } from './text'

export interface ImportRule {
  /** CSS selector tested via `el.matches()`. */
  match: string
  /** Returns the moduleId and props for this element. */
  map: (el: Element) => { moduleId: string; props: Record<string, unknown> }
  /**
   * When truthy the walker recurses into the element's children and sets
   * `node.children` to their IDs. Leaf modules (text, image, button) omit
   * this flag so they remain childless.
   *
   * A predicate form lets a rule decide per element — used by the anchor rule
   * so a text-only `<a>` stays a leaf (text prop) while an `<a>` wrapping an
   * icon/`<svg>` recurses to preserve that nested content.
   */
  recurse?: boolean | ((el: Element) => boolean)
}

/** True when the element has at least one element (non-text) child. */
export function hasElementChild(el: Element): boolean {
  return el.children.length > 0
}

export const HTML_TO_MODULE_RULES: ImportRule[] = [
  // Headings / paragraphs / inline phrasing → base.text (LEAF).
  // Props: `text` + `tag`.
  {
    match: 'h1, h2, h3, h4, h5, h6, p, span, small, strong, em',
    // Leaf when it holds only text → base.text. But when it WRAPS element
    // children (`<h2>Get the<br>file-based</h2>`, `<span><span>k</span><span>v</span></span>`)
    // recurse to a container so the nested structure + line breaks survive
    // instead of being flattened into one merged string.
    map: (el) =>
      hasElementChild(el)
        ? {
            moduleId: 'base.container',
            props: { tag: 'custom', customTag: el.tagName.toLowerCase() },
          }
        : {
            moduleId: 'base.text',
            props: { text: normalizeImportedText(el.textContent ?? ''), tag: el.tagName.toLowerCase() },
          },
    recurse: hasElementChild,
  },

  // btn-classed anchors → base.button (prop `label`). LEAF — base.button
  // cannot have children, so a btn wrapping an icon keeps only its label.
  {
    match: 'a.btn',
    map: (el) => ({
      moduleId: 'base.button',
      props: {
        label: normalizeImportedText(el.textContent ?? ''),
        href: el.getAttribute('href') ?? '',
        target: el.getAttribute('target') ?? '_self',
      },
    }),
  },

  // Plain anchors → base.link (prop `text`). Recurse ONLY when the anchor wraps
  // element children (an icon / inline `<svg>` / `<img>`) so that nested
  // content is preserved as real child nodes; a text-only link stays a leaf and
  // keeps using its `text` prop. base.link allows children, so this is safe.
  {
    match: 'a',
    map: (el) => ({
      moduleId: 'base.link',
      props: {
        text: normalizeImportedText(el.textContent ?? ''),
        href: el.getAttribute('href') ?? '',
        target: el.getAttribute('target') ?? '_self',
      },
    }),
    recurse: hasElementChild,
  },

  // Inline SVG → base.svg (LEAF). The whole element (including its
  // path/circle/… children) is captured verbatim in `outerHTML`; the publisher
  // sanitises it via the SVG DOMPurify profile. We do NOT recurse — children
  // are part of the markup, not separate nodes.
  {
    match: 'svg',
    map: (el) => ({
      moduleId: 'base.svg',
      props: {
        svg: el.outerHTML,
        title: el.getAttribute('aria-label') ?? '',
      },
    }),
  },

  // Images. `src` only — alt text is sourced from the media library asset,
  // not stored as a per-instance prop. LEAF.
  {
    match: 'img',
    map: (el) => ({
      moduleId: 'base.image',
      props: { src: el.getAttribute('src') ?? '' },
    }),
  },

  // Buttons → base.button. LEAF.
  {
    match: 'button',
    map: (el) => ({
      moduleId: 'base.button',
      props: { label: normalizeImportedText(el.textContent ?? ''), disabled: el.hasAttribute('disabled') },
    }),
  },

  // ul / ol are BUILTIN_HTML_TAGS for base.container → container + RECURSE.
  {
    match: 'ul, ol',
    map: (el) => ({
      moduleId: 'base.container',
      props: { tag: el.tagName.toLowerCase() },
    }),
    recurse: true,
  },

  // Semantic containers (all in BUILTIN_HTML_TAGS). RECURSE.
  {
    match: 'div, section, article, main, header, footer, nav, aside',
    map: (el) => ({
      moduleId: 'base.container',
      props: { tag: el.tagName.toLowerCase() },
    }),
    recurse: true,
  },

  // Void HTML elements. Browsers never give these DOM children, and React
  // throws if you render children inside a void tag
  // ("input is a void element tag and must neither have 'children' nor use
  // 'dangerouslySetInnerHTML'"). Map to base.container with tag:'custom' so
  // resolveHtmlTag emits the real tag name, but leave recurse unset (false)
  // so the node stays childless.
  //
  // Note: <img> is already matched above as base.image. This rule covers the
  // remaining void elements: area, base, br, col, embed, hr, input, link,
  // meta, param, source, track, wbr.
  {
    match: 'area, base, br, col, embed, hr, input, link, meta, param, source, track, wbr',
    map: (el) => ({
      moduleId: 'base.container',
      props: { tag: 'custom', customTag: el.tagName.toLowerCase() },
    }),
    // recurse intentionally omitted — void elements must remain childless.
  },

  // Catch-all for every other tag (li, figure, blockquote, form, table,
  // dialog, …). MUST use tag:'custom' + customTag so resolveHtmlTag
  // emits the real element name — tag:'div' + customTag would render <div>.
  // RECURSE.
  {
    match: '*',
    map: (el) => ({
      moduleId: 'base.container',
      props: { tag: 'custom', customTag: el.tagName.toLowerCase() },
    }),
    recurse: true,
  },
]
