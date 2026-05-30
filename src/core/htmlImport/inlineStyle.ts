/**
 * Harvest the background-image subset of inline `style="…"` attributes.
 *
 * CSS is otherwise out of scope for the HTML importer (`stripUnsafe` removes
 * every inline `style` attribute). The single exception is a background IMAGE:
 * a `style="background-image: url(…)"` (or a `background:` shorthand carrying a
 * `url(…)`) is the common way exported sites attach a hero/section background
 * to an element. Dropping it silently used to lose the asset reference even
 * though the bytes still landed in the media library.
 *
 * This module extracts ONLY the image-bearing background longhands —
 * `background-image` plus its companions `background-size`,
 * `background-position`, `background-repeat` — and only when an actual
 * `url(…)` image is present. Colours, gradients-without-url, and every other
 * inline declaration stay out of scope.
 *
 * The harvest runs BEFORE `stripUnsafe` removes the `style` attribute, keyed by
 * the live `Element` so `walkAndMap` can attach the captured bag to the
 * PageNode it mints for that element. The result is materialised into a
 * node-scoped "module-style" StyleRule downstream (see `importLinking.ts`), so
 * the editor's `BackgroundImageControl` picks the image straight out of the
 * media library after a Super Import.
 */

// ---------------------------------------------------------------------------
// Allowlisted image-background longhands (kebab → camel)
// ---------------------------------------------------------------------------

const BG_COMPANIONS: ReadonlyArray<readonly [kebab: string, camel: string]> = [
  ['background-size', 'backgroundSize'],
  ['background-position', 'backgroundPosition'],
  ['background-repeat', 'backgroundRepeat'],
]

/** Match the first `url(...)` payload in a CSS value (quoted or bare). */
const URL_PAYLOAD_RE = /url\(\s*(['"]?)([^'")\n]+)\1\s*\)/i

/**
 * Pull the image-background subset out of one element's inline style
 * declaration. Returns `{}` when the element has no `url(...)` background image
 * — colours, plain gradients, and unrelated declarations are intentionally not
 * captured.
 *
 * `backgroundImage` is normalised to the canonical `url('payload')` form so the
 * downstream asset rewriter and the editor's picker both recognise it.
 */
export function extractBackgroundStyles(style: CSSStyleDeclaration): Record<string, string> {
  // Prefer the longhand; fall back to extracting the url() from the shorthand
  // when the inline style used `background: url(...) …` and the environment
  // didn't expand it into longhands.
  let backgroundImage = style.getPropertyValue('background-image').trim()
  if (!backgroundImage || backgroundImage.toLowerCase() === 'none') {
    const shorthand = style.getPropertyValue('background').trim()
    const m = shorthand.match(URL_PAYLOAD_RE)
    backgroundImage = m ? `url('${m[2].trim()}')` : ''
  }

  // Only an actual url() image is in scope — gradients/colours stay dropped.
  if (!URL_PAYLOAD_RE.test(backgroundImage)) return {}

  const out: Record<string, string> = { backgroundImage }
  for (const [kebab, camel] of BG_COMPANIONS) {
    const v = style.getPropertyValue(kebab).trim()
    if (v) out[camel] = v
  }
  return out
}

/**
 * Walk every element in `doc` and harvest its inline image-background subset
 * into a `Map` keyed by the element. Call this BEFORE `stripUnsafe` (which
 * removes the `style` attribute). Elements with no `url(...)` background are
 * absent from the map.
 */
export function harvestInlineBackgrounds(doc: Document): Map<Element, Record<string, string>> {
  const result = new Map<Element, Record<string, string>>()
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    // `el.style` is the parsed inline-style declaration. Reading it avoids a
    // hand-rolled CSS parser and matches the engine the publisher trusts.
    const styledEl = el as Element & { style?: CSSStyleDeclaration }
    if (!styledEl.style || !el.hasAttribute('style')) continue
    const bag = extractBackgroundStyles(styledEl.style)
    if (Object.keys(bag).length > 0) result.set(el, bag)
  }
  return result
}
