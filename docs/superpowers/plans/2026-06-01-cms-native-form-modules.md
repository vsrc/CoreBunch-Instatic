# CMS-Native Form Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-party form primitives that render clean HTML and support hardened CMS-native submissions into `data_rows`.

**Architecture:** Implement form primitives as normal `ModuleDefinition`s in `src/modules/base/forms/`, add core form snapshot/validation helpers in `src/core/forms/`, add a public submit/challenge endpoint under `/_pb/form/`, and inject a tiny runtime only when published pages contain CMS-native forms. Keep storage in existing `data_tables`/`data_rows`.

**Tech Stack:** Bun, TypeScript, TypeBox, React 19, module engine, publisher pipeline, existing data repositories.

---

## File Map

- Create `src/core/forms/schemas.ts`: TypeBox schemas for form bindings, submitted values, challenge envelopes, validation errors, and action results.
- Create `src/core/forms/snapshot.ts`: pure helpers that derive a server-trusted form snapshot from a published page tree.
- Create `src/core/forms/validation.ts`: pure value coercion and validation against `DataField` definitions plus control overrides.
- Create `src/core/forms/index.ts`: barrel exports.
- Create `src/modules/base/forms/*`: first-party form modules and editor components.
- Modify `src/modules/base/index.ts`: register form modules.
- Create `server/forms/challenge.ts`: short-lived challenge issue/verify helpers.
- Create `server/forms/rateLimit.ts`: public form rate limiters.
- Create `server/forms/handler.ts`: public challenge and submit routes.
- Modify `server/router.ts`: route `/_pb/form/*` before public page rendering.
- Create `server/forms/formRuntime.ts`: public runtime JS response or string builder used by publisher injection.
- Modify publisher runtime injection only if needed to include form runtime on pages with `base.form` in CMS-native mode.
- Add focused tests under `src/__tests__/forms/` and `src/__tests__/server/`.
- Update `docs/features/modules.md`, `docs/features/content-storage.md`, and add a durable feature doc if the implementation ships.

## Tasks

### Task 1: Core Form Schemas And Validation

**Files:**
- Create: `src/core/forms/schemas.ts`
- Create: `src/core/forms/validation.ts`
- Create: `src/core/forms/index.ts`
- Test: `src/__tests__/forms/formValidation.test.ts`

- [ ] Write failing tests for required fields, unknown fields, email validation, select option validation, and string length caps.
- [ ] Run `bun test src/__tests__/forms/formValidation.test.ts` and confirm the tests fail because the module does not exist.
- [ ] Implement TypeBox schemas and validation helpers without server dependencies.
- [ ] Run the focused test and confirm it passes.

### Task 2: First-Party Form Primitive Modules

**Files:**
- Create: `src/modules/base/forms/FormEditor.tsx`
- Create: `src/modules/base/forms/FormControls.tsx`
- Create: `src/modules/base/forms/index.ts`
- Modify: `src/modules/base/index.ts`
- Test: `src/__tests__/forms/formModules.test.ts`

- [ ] Write failing render tests for `base.form`, `base.label`, `base.input`, `base.textarea`, `base.select`, `base.option`, `base.option-group`, `base.checkbox`, `base.radio`, `base.submit`, and `base.form-message`.
- [ ] Run the focused test and confirm missing modules fail.
- [ ] Implement modules with TypeBox `propsSchema`, clean render output, safe URLs/actions, and editor preview components.
- [ ] Register the modules from `src/modules/base/index.ts`.
- [ ] Run the focused test and confirm it passes.

### Task 3: Published Form Snapshot

**Files:**
- Create: `src/core/forms/snapshot.ts`
- Test: `src/__tests__/forms/formSnapshot.test.ts`

- [ ] Write failing tests that derive form/control bindings from a `NodeTree<PageNode>`.
- [ ] Run the focused test and confirm it fails.
- [ ] Implement snapshot derivation: nearest ancestor form, label-next-control inference, submit-nearest-form inference, and control field binding collection.
- [ ] Run the focused test and confirm it passes.

### Task 4: Public Challenge And Submit Endpoint

**Files:**
- Create: `server/forms/challenge.ts`
- Create: `server/forms/rateLimit.ts`
- Create: `server/forms/handler.ts`
- Modify: `server/router.ts`
- Test: `src/__tests__/server/publicForms.test.ts`

- [ ] Write failing tests for challenge issuance, same-origin enforcement, missing challenge rejection, unknown field rejection, valid row creation, and rate limiting.
- [ ] Run the focused server test and confirm it fails.
- [ ] Implement challenge issue/verify, endpoint routing, origin/fetch-metadata checks, payload caps, snapshot loading, validation, row creation, and JSON envelopes.
- [ ] Run the focused server test and confirm it passes.

### Task 5: Public Runtime And Publisher Hook

**Files:**
- Create: `server/forms/formRuntime.ts`
- Modify: publisher frontend injection files that decide runtime scripts.
- Test: `src/__tests__/publisher/formRuntime.test.ts`

- [ ] Write failing tests that CMS-native forms include the runtime and pages without CMS-native forms do not.
- [ ] Run the focused publisher test and confirm it fails.
- [ ] Implement runtime asset serving and page injection.
- [ ] Run the focused publisher test and confirm it passes.

### Task 6: Editor UX Affordances

**Files:**
- Modify Properties panel/module picker files as needed under `src/admin/pages/site/`.
- Test: focused component tests under `src/__tests__/panels/` or `src/__tests__/forms/`.

- [ ] Write failing tests or focused assertions for form binding rows and warnings where existing component-test infrastructure allows it.
- [ ] Implement the first pass of Properties panel form-binding display and warnings.
- [ ] Add module-picker presets that insert ordinary nodes.
- [ ] Run focused tests.

### Task 7: Documentation And Final Verification

**Files:**
- Modify: `docs/features/modules.md`
- Modify: `docs/features/content-storage.md`
- Create or modify: `docs/features/forms.md`

- [ ] Document form modules, CMS-native submissions, security model, and extension points for post-submit actions.
- [ ] Run `bun run build`.
- [ ] Run `bun test`.
- [ ] Run `bun run lint`.
- [ ] Triage failures as own-change vs pre-existing based on `git diff`.
