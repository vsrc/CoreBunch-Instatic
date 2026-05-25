/**
 * Public-site routing entrypoint.
 *
 * Every visitor request for an HTML page — whether the URL maps to a
 * stand-alone published page (`/about`) or to a content row rendered
 * through its postType's entry template (`/posts/hello-world`) — flows
 * through this module. There used to be two parallel router branches:
 *
 *   - `tryServePublishedPage`   → page lookup by slug → render
 *   - `tryServeContentRoute`    → row lookup by route → template render
 *
 * Both branches produced the same `RendererOutput` shape and both fed
 * the same `applyPublishedHtmlPipeline`. The split predates the
 * pages→data_rows migration: pages used to be their own table. After
 * the migration, pages, posts, and components are all `data_rows` —
 * the difference between them is just the lookup strategy, not the
 * publishing model.
 *
 * This module consolidates the public-route surface:
 *
 *   1. `resolvePublicRoute(db, url)` walks the lookup order (page slug
 *      → data-row route → row redirect) and returns a
 *      `PublicRouteResolution`.
 *   2. `renderPublicResolution(...)` materialises a resolution into the
 *      `Response` we hand back to the visitor. Page + row both run
 *      through `publishPage` (via the renderer) and then the HTML
 *      pipeline, so plugin frontend injections and the
 *      publish.before/publish.html/publish.after side-effects fire once
 *      per request regardless of which kind of content the URL hit.
 *
 * The `publicSlugFromPath` helper is exported because the loop runtime
 * (`server/handlers/cms/loop.ts`) needs the same path → slug
 * normalisation as the resolver does. Keeping the helper in one place
 * stops "the loop endpoint thinks `/about/` is a different slug than
 * `/about`" drift.
 *
 * Rendering is currently LIVE — the page snapshot is read from
 * `data_row_versions.snapshot_json` and `publishPage()` runs per
 * visitor request. The previous architecture docs claimed "publishing
 * is static, HTML written to `uploads/published/<route>.html`", but
 * no such write ever existed. Adding a static-to-disk layer is a
 * future change; this module is the seam to plug it into.
 */

import type { DbClient } from '../db/client'
import type { PublishedPageSnapshot } from '../repositories/publish'
import type { PublishedDataRow } from '@core/data/schemas'
import {
  getDataRowRedirectByRoute,
  getPublishedDataRowByRoute,
} from '../repositories/data/publish'
import {
  getLatestPublishedSiteSnapshot,
  getPublishedPageBySlug,
} from '../repositories/publish'
import { applyPublishedHtmlPipeline } from './publishedHtmlPipeline'
import {
  renderPublishedDataRowTemplate,
  renderPublishedSnapshot,
} from './publicRenderer'

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Normalise an inbound URL pathname to the slug used by the published-page
 * lookup. The empty path (`/`) maps to the canonical `index` slug.
 *
 * Shared with the loop runtime so per-page slug resolution stays consistent.
 */
export function publicSlugFromPath(pathname: string): string {
  const trimmed = pathname.replace(/^\/+|\/+$/g, '')
  return trimmed === '' ? 'index' : trimmed
}

/**
 * Split a `/<table-route>/<row-slug>` pathname into its components, ready
 * for `getPublishedDataRowByRoute`. Returns `null` for paths that don't
 * have at least two segments — the caller should treat those as
 * "not a content-row URL" and move on.
 */
function contentRouteFromPath(pathname: string): { tableRouteBase: string; rowSlug: string } | null {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
  if (parts.length < 2) return null
  return {
    tableRouteBase: `/${parts.slice(0, -1).map((part) => decodeURIComponent(part)).join('/')}`,
    rowSlug: decodeURIComponent(parts[parts.length - 1]),
  }
}

// ---------------------------------------------------------------------------
// Route resolution
// ---------------------------------------------------------------------------

/**
 * Discriminated result of `resolvePublicRoute`. `not-found` means the
 * URL doesn't map to any published content; callers continue dispatch
 * to the next handler (e.g. the setup-wizard redirect). `redirect` is
 * an old row-slug → new path mapping; the caller emits a 301.
 */
export type PublicRouteResolution =
  | { kind: 'page'; snapshot: PublishedPageSnapshot }
  | { kind: 'row'; snapshot: PublishedPageSnapshot; row: PublishedDataRow }
  | { kind: 'redirect'; location: string }
  | { kind: 'not-found' }

/**
 * Walk the lookup order for a public URL:
 *
 *   1. Page snapshot at the full slug (`/about` → page row with slug
 *      `about`).
 *   2. Data row at `<route-base>/<row-slug>` (`/posts/hello` → row
 *      `hello` under postType `posts`).
 *   3. Redirect from a previous slug (the row was renamed; old URL →
 *      new path).
 *
 * Page lookup wins over row lookup when both shapes are possible — a
 * page with slug `posts/hello` shadows a row at the same URL. That
 * matches the pre-unification routing order (`tryServePublishedPage`
 * ran before `tryServeContentRoute` in the dispatcher).
 *
 * The row path also needs the site snapshot to find the entry
 * template; when there isn't one (corrupt install / nothing published),
 * we return `not-found` rather than inventing a fallback document.
 */
export async function resolvePublicRoute(
  db: DbClient,
  url: URL,
): Promise<PublicRouteResolution> {
  // Page at the full slug.
  const pageSlug = publicSlugFromPath(url.pathname)
  const pageSnapshot = await getPublishedPageBySlug(db, pageSlug)
  if (pageSnapshot) {
    return { kind: 'page', snapshot: pageSnapshot }
  }

  // Data-row routes need at least `/table/slug` shape.
  const route = contentRouteFromPath(url.pathname)
  if (!route) return { kind: 'not-found' }

  const row = await getPublishedDataRowByRoute(db, route.tableRouteBase, route.rowSlug)
  if (row) {
    // Every postType table has a default entry template auto-seeded
    // into the `pages` table on creation (and the boot backfill catches
    // any pre-existing table that's missing one). So a missing
    // siteSnapshot here means a corrupt install — surface that as
    // not-found rather than half-rendering.
    const siteSnapshot = await getLatestPublishedSiteSnapshot(db)
    if (!siteSnapshot) return { kind: 'not-found' }
    return { kind: 'row', snapshot: siteSnapshot, row }
  }

  const redirect = await getDataRowRedirectByRoute(db, route.tableRouteBase, route.rowSlug)
  if (redirect) {
    return { kind: 'redirect', location: `${redirect.targetPath}${url.search}` }
  }

  return { kind: 'not-found' }
}

// ---------------------------------------------------------------------------
// Resolution → Response
// ---------------------------------------------------------------------------

/**
 * Materialise a resolution into the `Response` the visitor sees.
 *
 * Returns `null` for `not-found` so the router can fall through to its
 * next handler. Page + row both go through `publishPage` (via the
 * renderer) and then `applyPublishedHtmlPipeline`, so plugin
 * frontend-asset injection and the `publish.before/publish.html/
 * publish.after` side-effects fire ONCE per request regardless of which
 * resolution kind matched.
 *
 * A `row` resolution can still yield `null` here when the postType's
 * entry template selection misses (no matching template at all). That's
 * the same "render → 404" behaviour the pre-unification router had.
 */
export async function renderPublicResolution(
  resolution: PublicRouteResolution,
  db: DbClient,
  url: URL,
): Promise<Response | null> {
  switch (resolution.kind) {
    case 'not-found':
      return null
    case 'redirect':
      return new Response(null, {
        status: 301,
        headers: { location: resolution.location },
      })
    case 'page': {
      const rendered = await renderPublishedSnapshot(resolution.snapshot, { db, url })
      const html = await applyPublishedHtmlPipeline(rendered, db)
      return new Response(html, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }
    case 'row': {
      const rendered = await renderPublishedDataRowTemplate(resolution.snapshot, resolution.row, { db, url })
      if (!rendered) return null
      const html = await applyPublishedHtmlPipeline(rendered, db)
      return new Response(html, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }
  }
}
