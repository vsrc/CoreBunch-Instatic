# Color Framework Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the color part of the framework: structured color tokens, Core Framework-style variables, locked generated utility classes, and a compact Colors panel.

**Architecture:** Add a shared generated-class metadata foundation to `CSSClass`, then implement color-specific settings, generators, store actions, publisher/editor CSS integration, and panel UI. Generated utility class IDs stay stable by token id, variant identity, and utility type so node assignments survive value and slug edits.

**Tech Stack:** React 19, Zustand/Immer, Bun tests, CSS Modules, existing editor UI primitives.

---

### Task 1: Core Color Generator

**Files:**
- Create: `src/core/framework/colors.ts`
- Modify: `src/core/page-tree/types.ts`
- Modify: `src/core/publisher/classCss.ts`
- Test: `src/__tests__/framework/colors.test.ts`

- [ ] Write failing tests for slug normalization, variable generation, theme scopes, generated utility classes, stable IDs, `borderColor`, and `fill`.
- [ ] Run `bun test src/__tests__/framework/colors.test.ts` and verify failures are for missing exports.
- [ ] Implement `FrameworkColorSettings`, variable generation, utility class generation, and safe property-bag extensions.
- [ ] Re-run `bun test src/__tests__/framework/colors.test.ts` and verify it passes.

### Task 2: Store Actions And Synchronization

**Files:**
- Modify: `src/core/editor-store/slices/siteSlice.ts`
- Modify: `src/core/persistence/validate.ts`
- Test: `src/__tests__/editor-store/frameworkColors.test.ts`

- [ ] Write failing tests for category CRUD, color CRUD, generated dark defaults, generated utility sync, assignment preservation, utility removal, and flat token migration.
- [ ] Run `bun test src/__tests__/editor-store/frameworkColors.test.ts` and verify failures are for missing store actions.
- [ ] Add framework color actions to `SiteSlice` and validation/migration for `settings.framework.colors`.
- [ ] Re-run the store tests and verify they pass.

### Task 3: Publisher And Canvas CSS

**Files:**
- Modify: `src/core/publisher/render.ts`
- Modify: `src/editor/components/Canvas/ClassStyleInjector.tsx`
- Modify: `src/editor/components/Canvas/canvasClassCss.ts`
- Test: `src/__tests__/publisher/render.test.ts`
- Test: `src/__tests__/publisher/classStyleInjector.test.ts`

- [ ] Write failing tests that published pages include generated color variables, `.theme-dark/.theme-light` scopes, and used utility CSS.
- [ ] Run the targeted publisher tests and verify failures.
- [ ] Wire framework color CSS into publisher and editor style injection.
- [ ] Re-run targeted publisher tests.

### Task 4: Class Picker And Locked Properties State

**Files:**
- Modify: `src/core/page-tree/classUtils.ts`
- Modify: `src/editor/components/PropertiesPanel/ClassPicker.tsx`
- Modify: `src/editor/components/PropertiesPanel/ClassPicker.module.css`
- Modify: `src/editor/components/PropertiesPanel/PropertiesPanel.tsx`
- Test: `src/__tests__/panels/propertiesPanel.test.tsx`
- Test: `src/__tests__/panels/selectorsPanel.test.tsx`

- [ ] Write failing tests for generated utility badges, assignment, no rename/edit actions for locked utilities, and a locked state in Properties.
- [ ] Run targeted panel tests and verify failures.
- [ ] Implement generated/locked class helpers and UI states.
- [ ] Re-run targeted panel tests.

### Task 5: Colors Panel

**Files:**
- Create: `src/editor/components/ColorsPanel/ColorsPanel.tsx`
- Create: `src/editor/components/ColorsPanel/ColorsPanel.module.css`
- Create: `src/editor/components/ColorsPanel/index.ts`
- Modify: `src/core/editor-store/slices/uiSlice.ts`
- Modify: `src/editor/components/LeftSidebar/LeftSidebar.tsx`
- Modify: `src/editor/components/PanelRail/PanelRail.tsx`
- Test: `src/__tests__/panels/colorsPanel.test.tsx`

- [ ] Write failing tests for rail mounting, color creation, category filtering, accordion editing, utility toggles, dark value editing, and generated class visibility.
- [ ] Run `bun test src/__tests__/panels/colorsPanel.test.tsx` and verify failures.
- [ ] Implement the compact flat color-first panel and rail wiring.
- [ ] Re-run color panel tests.

### Task 6: Final Verification

**Files:**
- All changed implementation and test files.

- [ ] Run focused framework, store, panel, and publisher tests.
- [ ] Run `bun run build` if the dirty worktree allows it; otherwise report blocking unrelated failures.
- [ ] Review `git diff` to ensure changes are scoped and no unrelated dirty files were reverted.
