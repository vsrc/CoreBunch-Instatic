# Content Documents CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Content section for the self-hosted CMS: collections, rich Markdown-backed entries, draft saves, publishing snapshots, and public content routes.

**Architecture:** Add focused content tables and repositories beside the existing CMS site/page repositories. Keep the Site page-builder intact, add `/admin/site` and `/admin/content`, and mount a separate Content document editor that reuses the admin visual language without reusing page-builder canvas internals.

**Tech Stack:** Bun, TypeScript, React 19, React Router, Postgres, native `contenteditable` rich authoring, Markdown serialization/rendering, existing CMS auth/session/media APIs.

---

### File Structure

- Create `server/cms/contentRepository.ts`: collection, entry, version CRUD plus publish lookup helpers.
- Create `server/cms/contentRenderer.ts`: safe Markdown-to-HTML renderer for public and preview output.
- Modify `server/cms/migrations.ts`: add content tables and seed default Posts collection.
- Modify `server/cms/handlers.ts`: add authenticated `/api/cms/content/*` routes.
- Modify `server/router.ts`: route public content URLs after static/admin/api handling and before 404.
- Create `src/core/persistence/cmsContent.ts`: browser client for content APIs.
- Create `src/content/types.ts`: frontend content types.
- Create `src/content/markdown.ts`: serialize/parse the limited rich document format.
- Create `src/content/ContentAdmin.tsx` and `src/content/ContentAdmin.module.css`: Content workspace.
- Create `src/content/RichMarkdownEditor.tsx` and `src/content/RichMarkdownEditor.module.css`: rich editor surface.
- Modify `src/app/router.ts`: route `/admin`, `/admin/site`, and `/admin/content`.
- Modify `src/app/AdminEntry.tsx`: render the selected admin section after auth.
- Add tests in `src/__tests__/server/contentCms.test.ts`, `src/__tests__/content/markdown.test.ts`, and update app route tests.

### Task 1: Content Database And Repository

**Files:**
- Modify: `server/cms/migrations.ts`
- Create: `server/cms/contentRepository.ts`
- Test: `src/__tests__/server/contentCms.test.ts`

- [ ] **Step 1: Write failing repository tests**

Create tests that run migrations, assert the default `posts` collection exists, create a draft entry, publish it, and assert only the published snapshot is returned for public lookup.

Run: `bun test src/__tests__/server/contentCms.test.ts`
Expected: FAIL because `contentRepository.ts` does not exist.

- [ ] **Step 2: Add migration**

Add migration `003_content_documents` with tables:

- `content_collections`
- `content_entries`
- `content_entry_versions`

Seed default Posts with id `posts`, slug `posts`, singular label `Post`, plural label `Posts`.

- [ ] **Step 3: Add repository**

Implement:

- `listContentCollections(db)`
- `createContentCollection(db, input)`
- `listContentEntries(db, collectionId)`
- `getContentEntry(db, entryId)`
- `createContentEntry(db, input)`
- `saveContentEntryDraft(db, entryId, input)`
- `softDeleteContentEntry(db, entryId)`
- `publishContentEntry(db, entryId, adminUserId)`
- `getPublishedContentEntryByRoute(db, collectionSlug, entrySlug)`

- [ ] **Step 4: Run repository tests**

Run: `bun test src/__tests__/server/contentCms.test.ts`
Expected: PASS.

### Task 2: Content API And Public Rendering

**Files:**
- Modify: `server/cms/handlers.ts`
- Modify: `server/router.ts`
- Create: `server/cms/contentRenderer.ts`
- Test: `src/__tests__/server/contentCms.test.ts`

- [ ] **Step 1: Write failing API/render tests**

Cover authenticated collection list, entry create, draft save, publish, draft-only public 404, and published `/posts/:slug` HTML.

Run: `bun test src/__tests__/server/contentCms.test.ts`
Expected: FAIL because handlers/routes are missing.

- [ ] **Step 2: Add content API routes**

Add authenticated routes:

- `GET /api/cms/content/collections`
- `POST /api/cms/content/collections`
- `GET /api/cms/content/collections/:collectionId/entries`
- `POST /api/cms/content/collections/:collectionId/entries`
- `GET /api/cms/content/entries/:entryId`
- `PUT /api/cms/content/entries/:entryId`
- `POST /api/cms/content/entries/:entryId/publish`

- [ ] **Step 3: Add Markdown renderer**

Render the v1 supported Markdown safely:

- headings `#` through `######`
- paragraphs
- links
- images `![alt](url)`
- video shortcode `@[video](url)`

Escape raw HTML by default.

- [ ] **Step 4: Add public content routing**

After published page lookup misses, resolve content routes:

- `/posts/:slug`
- `/:collectionSlug/:slug`

Return 404 for drafts, unpublished entries, deleted entries, and missing entries.

- [ ] **Step 5: Run server tests**

Run: `bun test src/__tests__/server/contentCms.test.ts`
Expected: PASS.

### Task 3: Admin Routing And Content Client

**Files:**
- Modify: `src/app/router.ts`
- Modify: `src/app/AdminEntry.tsx`
- Create: `src/core/persistence/cmsContent.ts`
- Modify: `src/core/persistence/index.ts`
- Create: `src/content/types.ts`
- Test: `src/__tests__/app/adminCmsRoute.test.ts`

- [ ] **Step 1: Write failing route/client tests**

Assert `/admin` redirects to `/admin/site`, `/admin/site` renders the editor section, and `/admin/content` can render the Content section after auth.

Run: `bun test src/__tests__/app/adminCmsRoute.test.ts`
Expected: FAIL because `/admin/content` is not routed.

- [ ] **Step 2: Add content API client**

Implement typed fetch helpers for collections, entries, draft saves, and publish calls with `credentials: 'include'` and shared CMS error parsing.

- [ ] **Step 3: Add admin section routing**

Use React Router nested/admin paths:

- `/admin` redirects to `/admin/site`
- `/admin/site` passes `section="site"` to `AdminEntry`
- `/admin/content` passes `section="content"` to `AdminEntry`

- [ ] **Step 4: Run route/client tests**

Run: `bun test src/__tests__/app/adminCmsRoute.test.ts`
Expected: PASS.

### Task 4: Content Workspace UI

**Files:**
- Create: `src/content/ContentAdmin.tsx`
- Create: `src/content/ContentAdmin.module.css`
- Modify: `src/app/AdminEntry.tsx`
- Test: `src/__tests__/content/contentAdmin.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Render Content after auth, mock content API responses, assert collections list, new post creation, title editing, save draft, and publish button call the right APIs.

Run: `bun test src/__tests__/content/contentAdmin.test.tsx`
Expected: FAIL because `ContentAdmin` does not exist.

- [ ] **Step 2: Add ContentAdmin layout**

Build the shell:

- left navigation/sidebar with collections and entries
- center document surface
- top content toolbar
- right settings panel

Use project CSS variables and existing Button/Input primitives.

- [ ] **Step 3: Wire draft and publish state**

Load collections, load entries for selected collection, create entries, save drafts, and publish snapshots.

- [ ] **Step 4: Run UI tests**

Run: `bun test src/__tests__/content/contentAdmin.test.tsx`
Expected: PASS.

### Task 5: Rich Markdown Editor

**Files:**
- Create: `src/content/markdown.ts`
- Create: `src/content/RichMarkdownEditor.tsx`
- Create: `src/content/RichMarkdownEditor.module.css`
- Modify: `src/content/ContentAdmin.tsx`
- Test: `src/__tests__/content/markdown.test.ts`

- [ ] **Step 1: Write failing Markdown tests**

Assert the editor model serializes headings, paragraphs, images, videos, and links to Markdown, and parses saved Markdown back to rich blocks.

Run: `bun test src/__tests__/content/markdown.test.ts`
Expected: FAIL because `src/content/markdown.ts` does not exist.

- [ ] **Step 2: Add Markdown model helpers**

Represent body content as v1 blocks:

- `{ type: 'paragraph', text }`
- `{ type: 'heading', level, text }`
- `{ type: 'image', src, alt }`
- `{ type: 'video', src }`

Serialize to Markdown and parse from Markdown.

- [ ] **Step 3: Add rich editor surface**

Use native rich controls:

- editable title field
- block-based rich body
- typing `## Heading` autoformats to heading
- toolbar insert heading/text/image/video
- image/video blocks show previews

- [ ] **Step 4: Run Markdown/editor tests**

Run: `bun test src/__tests__/content/markdown.test.ts src/__tests__/content/contentAdmin.test.tsx`
Expected: PASS.

### Task 6: Full Validation

**Files:**
- Modify implementation files only as needed to pass validation.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
bun test src/__tests__/server/contentCms.test.ts src/__tests__/content/markdown.test.ts src/__tests__/content/contentAdmin.test.tsx src/__tests__/app/adminCmsRoute.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run build and lint**

Run:

```bash
bun run build
bun run lint
```

Expected: both PASS.

- [ ] **Step 3: Manual route validation**

With dev server running, validate:

- `/admin/site` loads existing editor.
- `/admin/content` loads Content.
- draft-only `/posts/:slug` returns 404.
- published `/posts/:slug` returns rendered HTML.

### Self-Review

Spec coverage:

- Collections, entries, drafts, publishing, public rendering, rich UI storage as Markdown, admin route split, and default Posts collection are covered.
- Custom fields, template binding, roles, collaboration, and raw Markdown source are intentionally excluded.

Completeness scan:

- No task depends on an undefined future decision.

Type consistency:

- Server uses content collections, entries, and versions consistently.
- Frontend stores rich editor blocks locally and serializes body content to `bodyMarkdown` for API calls.
