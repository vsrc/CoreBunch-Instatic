/**
 * UserStylesheetInjector — injects user-authored CSS files (from
 * `site.files[type === 'style']`) into a target document.
 *
 * Multi-document support
 * ──────────────────────
 * Each breakpoint frame in the canvas is its own iframe. `IframeFrameSurface`
 * mounts one of these injectors per frame, targeting the iframe's document
 * so user CSS lands inside the page document — exactly where it sits on the
 * published site. When no `targetDocument` prop is passed, the injector
 * falls back to the editor's main document (currently only used by tests
 * and any non-iframe canvas path).
 *
 * The CSS goes in unchanged. Inside the iframe the `<body>` IS the page
 * body, `body > nav` is a real direct-child relationship, and `:nth-child()`
 * counts the authored elements — no rewriting needed. This is the whole
 * point of the iframe-per-frame architecture (see
 * `docs/features/canvas-iframe-per-frame.md`).
 *
 * Concatenation order matches `collectUserStylesheetCss` (server-side) so
 * each iframe loads the same bytes the published page receives. Both
 * helpers sort by `path` ascending and prefix each file with a CSS
 * comment carrying the source path.
 */

import { useEffect, useMemo } from 'react'
import { useEditorStore } from '@site/store/store'
import type { SiteFile } from '@core/files/schemas'

const STYLE_TAG_ID = 'mc-user-styles'

// Reference-stable empty array for the ?? fallback — matches the pattern used
// in ClassStyleInjector. An inline `?? []` would create a new array per
// render and force the useMemo below to re-run every time.
const EMPTY_FILES: readonly SiteFile[] = []

interface UserStylesheetInjectorProps {
  /**
   * Document to inject the <style> tag into. Defaults to the editor's main
   * document.
   */
  targetDocument?: Document
}

export function UserStylesheetInjector({ targetDocument }: UserStylesheetInjectorProps = {}) {
  const files = useEditorStore((s) => s.site?.files ?? EMPTY_FILES)

  // Concatenate user stylesheets in stable path order. Memoised on the files
  // array reference so the effect skips when nothing relevant changed.
  // Mirrors `collectUserStylesheetCss` (server-side) byte-for-byte: ordering,
  // comment wrapping, and no transformation of the body itself.
  const css = useMemo(() => {
    // Project to a typed `{ path, content }` tuple so map() doesn't have to
    // re-narrow `content` (which is optional on the schema).
    const stylesheets = files
      .flatMap<{ path: string; content: string }>((f) =>
        f.type === 'style' && typeof f.content === 'string' && f.content.length > 0
          ? [{ path: f.path, content: f.content }]
          : [],
      )
      .sort((a, b) => a.path.localeCompare(b.path))
    if (stylesheets.length === 0) return ''
    return stylesheets
      .map((f) => `/* ${escapeCommentPath(f.path)} */\n${f.content}`)
      .join('\n\n')
  }, [files])

  useEffect(() => {
    const targetDoc = targetDocument ?? document
    let styleEl = targetDoc.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = targetDoc.createElement('style')
      styleEl.id = STYLE_TAG_ID
      styleEl.setAttribute('data-source', 'UserStylesheetInjector')
      targetDoc.head.appendChild(styleEl)
    }
    styleEl.textContent = css || '/* no user stylesheets */'
  }, [targetDocument, css])

  useEffect(() => {
    const targetDoc = targetDocument ?? document
    return () => {
      targetDoc.getElementById(STYLE_TAG_ID)?.remove()
    }
  }, [targetDocument])

  return null
}

/**
 * Sanitise a path for safe inclusion inside a CSS comment block. The only
 * sequence that can break out is the asterisk-slash pair — replace any
 * accidental occurrences so the comment can't terminate early. Mirrors the
 * helper of the same shape in `src/core/publisher/userStylesheets.ts`.
 */
function escapeCommentPath(path: string): string {
  return path.replace(/\*\//g, '*\\/')
}
