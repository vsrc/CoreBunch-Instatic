# Admin Feature Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move admin route-level code into `src/admin` feature folders and split the content admin page into focused content components, hooks, and utilities.

**Architecture:** `src/admin` owns the admin shell, router, loading screen, and visual workspaces. `src/admin/site`, `src/admin/content`, and `src/admin/plugins` map to the top-level admin navigation. Domain content types and markdown helpers move to `src/core/content` so non-admin code does not import from admin.

**Tech Stack:** React 19, TypeScript, Vite, Bun test, CSS modules.

---

### Task 1: Register the Architecture Guard

**Files:**
- Create: `src/__tests__/architecture/admin-feature-folders.test.ts`

- [ ] **Step 1: Write the failing architecture test**

```ts
import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(path: string) {
  return readFileSync(join(root, path), 'utf8')
}

describe('admin feature folders', () => {
  it('keeps admin page entry points in src/admin feature folders', () => {
    expect(existsSync(join(root, 'src/admin/AdminLayout.tsx'))).toBe(true)
    expect(existsSync(join(root, 'src/admin/AdminEntry.tsx'))).toBe(true)
    expect(existsSync(join(root, 'src/admin/router.ts'))).toBe(true)
    expect(existsSync(join(root, 'src/admin/site/SitePage.tsx'))).toBe(true)
    expect(existsSync(join(root, 'src/admin/content/ContentPage.tsx'))).toBe(true)
    expect(existsSync(join(root, 'src/admin/plugins/PluginsPage.tsx'))).toBe(true)
    expect(existsSync(join(root, 'src/admin/plugins/PluginPage.tsx'))).toBe(true)
  })

  it('uses page names instead of admin-specific component names', () => {
    const adminEntry = read('src/admin/AdminEntry.tsx')
    expect(adminEntry).toContain('<SitePage />')
    expect(adminEntry).toContain('<ContentPage />')
    expect(adminEntry).toContain('<PluginsPage />')
    expect(adminEntry).toContain('<PluginPage />')
    expect(adminEntry).not.toContain('ContentAdmin')
    expect(adminEntry).not.toContain('PluginsAdmin')
    expect(adminEntry).not.toContain('PluginPageAdmin')
  })

  it('keeps reusable content domain code outside admin pages', () => {
    expect(existsSync(join(root, 'src/core/content/types.ts'))).toBe(true)
    expect(existsSync(join(root, 'src/core/content/markdown.ts'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/__tests__/architecture/admin-feature-folders.test.ts`

Expected: FAIL because `src/admin/AdminLayout.tsx` and the feature page files do not exist yet.

### Task 2: Move Admin Shell Files

**Files:**
- Move: `src/app/AdminEntry.tsx` to `src/admin/AdminEntry.tsx`
- Move: `src/app/AdminEntry.module.css` to `src/admin/AdminEntry.module.css`
- Move: `src/app/AppLoadingScreen.tsx` to `src/admin/AppLoadingScreen.tsx`
- Move: `src/app/AppLoadingScreen.module.css` to `src/admin/AppLoadingScreen.module.css`
- Move: `src/app/EditorLayout.tsx` to `src/admin/AdminLayout.tsx`
- Move: `src/app/EditorLayout.module.css` to `src/admin/AdminLayout.module.css`
- Move: `src/app/router.ts` to `src/admin/router.ts`
- Move: `src/app/main.tsx` to `src/admin/main.tsx`
- Modify: `index.html`
- Modify: `tsconfig.json`
- Modify: `tsconfig.app.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Move files and update imports**

Rename `EditorLayout` to `AdminLayout`, update the default export, update CSS imports, update `index.html` to `/src/admin/main.tsx`, and replace the `@app/*` alias with `@admin/*`.

- [ ] **Step 2: Run architecture test**

Run: `bun test src/__tests__/architecture/admin-feature-folders.test.ts`

Expected: still FAIL until page entry points and domain content files exist.

### Task 3: Create Admin Feature Page Entry Points

**Files:**
- Create: `src/admin/site/SitePage.tsx`
- Move: `src/plugins/PluginsAdmin.tsx` to `src/admin/plugins/PluginsPage.tsx`
- Move: `src/plugins/PluginPageAdmin.tsx` to `src/admin/plugins/PluginPage.tsx`
- Move: `src/plugins/PluginPageRenderer.tsx` to `src/admin/plugins/components/PluginPageRenderer/PluginPageRenderer.tsx`
- Move: `src/plugins/useInstalledEditorPlugins.ts` to `src/admin/plugins/hooks/useInstalledEditorPlugins.ts`
- Move: `src/plugins/pluginEvents.ts` to `src/admin/plugins/utils/pluginEvents.ts`
- Move: `src/plugins/PluginsAdmin.module.css` to `src/admin/plugins/PluginsPage.module.css`

- [ ] **Step 1: Create `SitePage`**

```tsx
import AdminLayout from '../AdminLayout'

export function SitePage() {
  return <AdminLayout workspace="site" />
}
```

- [ ] **Step 2: Rename plugins page exports**

`PluginsAdmin` becomes `PluginsPage`; `PluginPageAdmin` becomes `PluginPage`.

- [ ] **Step 3: Update `AdminEntry`**

Render `SitePage`, `ContentPage`, `PluginsPage`, and `PluginPage` for the corresponding admin sections.

### Task 4: Move Content Domain Helpers

**Files:**
- Move: `src/content/types.ts` to `src/core/content/types.ts`
- Move: `src/content/markdown.ts` to `src/core/content/markdown.ts`
- Modify imports in `src/core/persistence/cmsContent.ts`, `src/core/templates/templatePreviewData.ts`, content tests, and content page files.

- [ ] **Step 1: Move files and update imports**

Use `@core/content/types` and `@core/content/markdown` from admin content code.

- [ ] **Step 2: Run markdown tests**

Run: `bun test src/__tests__/content/markdown.test.ts`

Expected: PASS.

### Task 5: Split Content Page

**Files:**
- Move: `src/content/ContentAdmin.tsx` to `src/admin/content/ContentPage.tsx`
- Move: `src/content/ContentAdmin.module.css` to `src/admin/content/ContentPage.module.css`
- Move: `src/content/RichMarkdownEditor.tsx` to `src/admin/content/components/RichMarkdownEditor/RichMarkdownEditor.tsx`
- Move: `src/content/RichMarkdownEditor.module.css` to `src/admin/content/components/RichMarkdownEditor/RichMarkdownEditor.module.css`
- Create: `src/admin/content/utils/contentEntryUtils.ts`
- Create: `src/admin/content/hooks/useContentWorkspace.ts`
- Create: `src/admin/content/hooks/useContentEntryDraft.ts`
- Create: `src/admin/content/hooks/useContentMediaPicker.ts`
- Create component folders under `src/admin/content/components/`

- [ ] **Step 1: Extract pure utility functions**

Move `slugFromTitle`, `updateEntryList`, `mediaTypeFromAsset`, and `publicContentPath` to `contentEntryUtils.ts`.

- [ ] **Step 2: Extract hooks**

Move collection/entry loading to `useContentWorkspace`, draft save/publish/status state to `useContentEntryDraft`, and media picker state to `useContentMediaPicker`.

- [ ] **Step 3: Extract components**

Move toolbar, sidebar, explorer panel, document canvas, settings panel, and media picker dialog into `src/admin/content/components`.

- [ ] **Step 4: Run content tests**

Run: `bun test src/__tests__/content/contentAdmin.test.tsx`

Expected: PASS after test imports are updated to `ContentPage`.

### Task 6: Verification

**Files:**
- Modify tests that read moved source paths.

- [ ] **Step 1: Run focused tests**

Run:

```sh
bun test src/__tests__/architecture/admin-feature-folders.test.ts
bun test src/__tests__/app/adminCmsRoute.test.ts src/__tests__/app/appLoadingScreen.test.tsx src/__tests__/app/initialHtmlLoading.test.ts
bun test src/__tests__/content
bun test src/__tests__/plugins
bun test src/__tests__/layout/editorLayoutPersistence.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run build**

Run: `bun run build`

Expected: PASS.
