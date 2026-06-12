# SEO & AEO

Search and answer-engine optimization is a core publishing capability:
structured metadata per page/post, site-wide defaults with title patterns,
Open Graph + X cards, schema.org JSON-LD, generated `robots.txt` with
AI-crawler controls, `sitemap.xml`, and an admin workspace at
`/admin/tools/seo` with AI-assisted copy suggestions.

Spec history: `docs/superpowers/specs/2026-06-12-seo-workspace-design.md` (local).

---

## The model

One engine module owns everything: **`src/core/seo/`** (barrel-gated).

| File | Responsibility |
| --- | --- |
| `schema.ts` | `SeoMetadataSchema` (per-target object stored in `cells_json.seo`), `SiteSeoSettingsSchema` (`site.settings.seo`: title pattern, description, default social image, X handle/card, organization, robots, sitemap) |
| `resolve.ts` | `resolveSeoMetadata` — the single fallback engine (see below) |
| `jsonLd.ts` | `buildJsonLdEntities` (`WebSite`, `Organization`, `Article`, `BreadcrumbList`) + `serializeJsonLd` (escapes `</script`, `<!--`) |
| `robots.ts` | `generateRobotsTxt` — shared by the server endpoint and the admin live preview (byte-identical) |
| `aiCrawlers.ts` | The AI-crawler user-agent lists behind the Robots tab's two toggles |
| `health.ts` | `computeSeoHealth` — the index dots / issue chips |
| `lengthMeter.ts` | Approximate pixel-width metering (~580px title / ~990px description budgets) |

### Storage

- **Targets** (`page` + `postType` rows): one built-in `seoMetadata` field with
  id `seo`; the structured object lives in `cells_json.seo`. Not offered as a
  user-created custom field type; not bindable; not form-submittable.
- **Site defaults**: `site.settings.seo` (replaced the legacy
  `metaTitle`/`metaDescription` settings).
- **Templates**: an entry template page row's `seo.title`/`seo.description`
  act as token patterns for every matching post.

### Resolution — two-stage title

`resolveSeoMetadata` is shared by the publisher, the admin previews, and the
health indicators — what the editor shows IS what gets emitted.

```
baseTitle  = target.seo.title ?? row/page title
pattern    = template.seo.title ?? site.seo.titlePattern      // {source.field} tokens
title      = explicit target title (pattern skipped)
           | interpolate(pattern)                              // shared token engine
           | baseTitle ?? site.name
```

Patterns use the existing `{source.field}` token engine
(`src/core/templates/tokenInterpolation.ts`) — `{page.title}`, `{site.name}`,
`{currentEntry.title}`. There is no second token grammar.

Social fields fall back search → OG → X. `noindex` emits `noindex` only
(never a silent `nofollow`).

### Absolute URLs

Canonical, `og:url`, sitemap `<loc>`, and origin-dependent JSON-LD use the
configured public origin (`PUBLIC_ORIGINS` env → `canonicalPublicOrigin()` in
`server/auth/security.ts`). Static HTML is baked at publish time, so with no
origin configured those tags are **omitted** — never a guessed host. The
dynamic `robots.txt`/`sitemap.xml` endpoints fall back to the request origin.

## Published output

`src/core/publisher/seoHead.ts` builds the head: title, description,
canonical, robots, OG (incl. `og:locale`, `og:site_name`, `article:*_time`),
X cards (`twitter:*` tag names), and one
`<script type="application/ld+json">` per entity. The server resolves the
payload per route in `server/publish/publicRenderer.ts` (page SEO from the
snapshot, row SEO from the published version's cells + entry-template
patterns); `publishPage` has an internal fallback so previews/exports run the
same resolver.

JSON-LD (zero-config in v1): `WebSite` + `Organization` on the homepage,
`Article` on row routes, `BreadcrumbList` on routes deeper than one segment.
Noindex targets emit none.

## robots.txt and sitemap.xml

`server/publish/seoEndpoints.ts`, dispatched by `server/router.ts` BEFORE
static assets and public rendering. Both generate from the **published
snapshot** and cache keyed by `publishVersion` — SEO follows the publish
lifecycle (edit → publish → live).

- `robots.txt` (`text/plain`): default allow + optional per-bot `Disallow`
  blocks from the two AI-crawler toggles (training bots: GPTBot,
  Google-Extended, CCBot, Applebot-Extended, meta-externalagent; answer bots:
  OAI-SearchBot, PerplexityBot, ChatGPT-User, Claude-SearchBot), plus a
  `Sitemap:` line.
- `sitemap.xml` (`application/xml`): published routable pages + post rows,
  excluding templates, `noindex` targets, and
  `site.settings.seo.sitemap.excludedTargets`; `<lastmod>` from publish
  timestamps. Disabled ⇒ 404.

## Admin workspace — `/admin/tools/seo`

`src/admin/pages/seo/`. Reached from the **Tools** nav dropdown
(`AdminSectionNavigation`), which also hosts plugin admin pages (their
`/admin/plugins/:pluginId/:pageId` routes are unchanged — only nav grouping
moved).

- **Meta tab** — right: target index (search, All/Pages/Posts/Templates/Issues
  filters, issue summary chips, per-field health dots, ↑/↓/Enter + `/`
  keyboard nav, pinned Site defaults row). Left: sticky preview editor with
  Search / Open Graph / X / Schema platform views. Controlled
  `Input`/`Textarea` primitives (no contentEditable); empty fields show their
  RESOLVED fallback as placeholder; title/description carry pixel meters;
  images pick from the media library; X fields hide behind "Customize X
  preview" until set; switching targets while dirty asks via an in-app
  dialog. The Schema view pretty-prints the exact JSON-LD the publisher will
  emit.
- **Robots.txt tab** — indexing + AI-crawler toggles over a live preview
  generated by the same `generateRobotsTxt` the endpoint serves.
- **Sitemap tab** — enable/disable, inclusion counts, per-target
  include/exclude switches (noindex targets shown as auto-excluded).

### AI suggestions

The sparkle on title/description/OG/X inputs calls
`POST /admin/api/cms/seo/generate` (`server/handlers/cms/seoGenerate.ts`):
one tool-less driver call through the existing `server/ai` stack (provider +
model from the `content`, falling back to `site`, scope default), returning
three suggestions rendered as tappable bubbles with **More options**
(exclude-aware regenerate) and **Reject**. Length budgets ride the prompt.
Suggestions fill the input through the normal dirty/save flow — nothing
auto-saves.

## API and permissions

`server/handlers/cms/seo.ts` — `/admin/api/cms/seo/*`:

| Route | Capability | Notes |
| --- | --- | --- |
| `GET /seo/targets` | `seo.read` | Full target index + site SEO + configured origin (draft cells) |
| `PUT /seo/targets/:kind/:id` | `seo.manage` + target ownership | `pages.edit` for page/template rows; `content.edit.any`/`content.manage` for post rows |
| `PUT /seo/site` | `seo.manage` | Site defaults + robots + sitemap settings (one object) |
| `POST /seo/generate` | `seo.manage` + `ai.chat` | AI suggestions |

`seo.read` gates the workspace; `seo.manage` gates writes. Health indicators
are computed client-side with the shared core resolver, so the index, the
editor, and the published output agree by construction.

## Tests

- `src/core/seo/__tests__/` — resolver fallback chains, JSON-LD building +
  escaping, robots generation, health.
- `src/__tests__/publisher/render.test.ts` — emitted head tags.
- `src/__tests__/server/seoEndpoints.test.ts` — robots/sitemap endpoints +
  version caching.
- `src/__tests__/server/seoHandler.test.ts` / `seoGenerate.test.ts` —
  API + capability gates (real SQLite via the capability harness).
- `src/__tests__/admin/seoWorkspace.test.tsx` — Meta/Robots tabs + Tools nav.
