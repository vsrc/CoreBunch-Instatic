# Font Tokens Design

This spec defines a merged Fonts system for the site editor: installed Google
and custom font assets become assignable sources for editable CSS font variables.

Authors should manage fonts from one Typography panel surface. The builder
should write stable `var(--font-...)` references instead of raw family names so
site designs survive font swaps.

---

## TL;DR

- Keep one user-facing surface: `Typography -> Fonts`.
- Store font assets and font tokens together under `site.settings.fonts`.
- A font asset is the installed Google/custom family and its self-hosted files.
- A font token is the builder-facing variable: name, editable variable slug,
  assigned family, and fallback stack.
- The property panel font-family control writes `var(--font-primary)` style
  values by default.
- Renaming a token variable rewrites existing authored references from the old
  variable to the new one.
- Changing a token's assigned family only changes generated `:root` CSS.
- Existing installed-family variables such as `--font-inter` should be removed;
  they encourage direct family binding instead of design-token binding.

## Current State

Installed fonts live under `site.settings.fonts.items`.

Source files:

- `src/core/fonts/schemas.ts` defines `FontEntry` and `SiteFontsSettings`.
- `src/core/fonts/css.ts` emits `@font-face` rules and per-family variables.
- `src/admin/pages/site/panels/TypographyPanel/FontsSection/FontsSection.tsx`
  renders the installed font family list.
- `src/admin/pages/site/panels/TypographyPanel/FontsSection/AddGoogleFontDialog.tsx`
  installs Google fonts.
- `src/admin/pages/site/panels/TypographyPanel/FontsSection/AddCustomFontDialog.tsx`
  assembles custom font entries from media font assets.
- `src/admin/pages/site/panels/PropertiesPanel/ClassPropertyRow.tsx` routes
  `fontFamily` through the generic text property control.
- `src/admin/pages/site/panels/PropertiesPanel/cssControlTypes.ts` exposes
  typography tokens only for `fontSize`, not `fontFamily`.

The current CSS emitter generates variables from installed family names:

```css
:root {
  --font-inter: "Inter", sans-serif;
}
```

That shape is useful for hand-written CSS but weak for the builder. If a class
stores `font-family: var(--font-inter)`, swapping the site's primary typeface
from Inter to a custom family requires changing every class reference.

## Goals

1. Fonts feel like one system in the editor.
2. Font-family properties default to stable design-token variables.
3. Font variables are fully custom: authors can add, rename, reorder, delete,
   and assign them.
4. A variable rename preserves existing builder-authored designs by rewriting
   references.
5. Google and custom font previews stay live everywhere the user chooses a font.
6. Published output stays self-hosted and plain CSS.

## Non-Goals

- Do not add fixed required slots such as primary/secondary/tertiary.
- Do not keep a compatibility path for old installed-family variables.
- Do not overload framework typography scale groups. Those remain font-size
  scale tokens such as `--text-m`.
- Do not require every installed family to have a token.
- Do not require every token to point at a custom font; system fallback stacks
  are valid.

## Data Model

Extend `SiteFontsSettings` in `src/core/fonts/schemas.ts`:

```ts
type SiteFontsSettings = {
  items: FontEntry[]
  tokens?: FontToken[]
}

type FontToken = {
  id: string
  name: string
  variable: string
  familyId?: string
  fallback: string
  order: number
  createdAt: number
  updatedAt: number
}
```

`items` remains the installed asset library. Each `FontEntry` still owns the
self-hosted `@font-face` files for one family.

`tokens` is the builder-facing layer. Each token emits one CSS custom property.
`variable` stores the slug without the leading CSS custom-property dashes:

```ts
{
  name: 'Primary',
  variable: 'font-primary',
  familyId: 'font_abc',
  fallback: 'sans-serif'
}
```

The emitted CSS variable is `--${variable}`.

This gives the user one Fonts system while keeping the necessary internal split:
assets are installable font files; tokens are design variables applied by the
builder.

## Variable Rules

Normalize editable variables at the boundary:

- Trim whitespace.
- Lowercase.
- Replace invalid runs with `-`.
- Strip leading custom-property dashes before storing.
- Require a non-empty slug.
- Prefer a `font-` prefix when creating new tokens.
- Reject duplicate variables within one site.

Examples:

| User input | Stored variable | Emitted variable |
|------------|-----------------|------------------|
| `font-primary` | `font-primary` | `--font-primary` |
| `--font Brand` | `font-brand` | `--font-brand` |
| `Editorial` | `font-editorial` | `--font-editorial` |

The token `id` is the identity. The editable `variable` is not the identity.

## CSS Output

`src/core/fonts/css.ts` should generate two blocks:

1. `@font-face` rules for installed families.
2. `:root` variables for font tokens.

Example:

```css
:root {
  --font-primary: "PP Neue Montreal", sans-serif;
  --font-mono: "PP Lettra Mono", monospace;
  --font-system: system-ui, sans-serif;
}
```

When `familyId` points at an installed family, the declaration starts with the
quoted family name and then appends the token fallback.

When `familyId` is absent, the declaration is the fallback stack. This supports
tokens such as `System` without requiring a local font install.

Remove generated installed-family variables such as `--font-pp-neue-montreal`.
Direct installed-family choices can still write a raw CSS family stack as an
escape hatch, but the default builder workflow should use tokens.

## Typography Panel UX

`Typography -> Fonts` becomes a token-first list.

Each row shows:

- token name;
- emitted variable, e.g. `--font-primary`;
- assigned family preview;
- fallback stack;
- actions for edit, duplicate, and delete.

Rows use the same tile style as the current Google/custom font picker direction:
surface parent, one-pixel grid gap, borderless cards, large radius, and live
font preview.

Editing a token opens a panel or dialog with:

- `Name`;
- `Variable`;
- `Assigned font`;
- `Fallback`;
- live preview text rendered through `var(--token)`;
- rename-impact copy when the variable changes and existing references will be
  rewritten.

Adding a Google font or uploading a custom font should offer a direct path to
create a token from that family. The default draft values are suggestions only,
not fixed slots. For example, first-token creation can prefill `Primary` and
`font-primary`, but the user can replace both before saving.

## Property Panel Font Picker

Replace the generic `fontFamily` text input with a dedicated rich picker.

The picker sections:

1. `Inherit`
2. Font tokens
3. Direct installed fonts
4. Manual CSS value

Token rows are the primary affordance. Each token row shows:

- token name;
- `var(--font-primary)`;
- assigned family name;
- live preview rendered in the resolved font stack.

Selecting a token writes:

```css
font-family: var(--font-primary);
```

Direct installed font rows are an escape hatch. Selecting one writes a concrete
family stack:

```css
font-family: "PP Neue Montreal", sans-serif;
```

Manual CSS value keeps advanced values possible, but it is visually secondary.

The picker should support hover preview using the existing property preview
channel in `ClassPropertyRow`.

## Rename Semantics

When a token variable changes from `font-primary` to `font-brand`, rewrite exact
CSS variable references in authored style data:

```css
var(--font-primary)
```

becomes:

```css
var(--font-brand)
```

Rewrite all structured `CSSPropertyBag` locations controlled by the editor:

- reusable class style rules;
- generated class drafts if they ever store font-family values;
- node-scoped style declarations;
- Visual Component definition trees;
- slot-fill trees.

Do not rewrite arbitrary text by substring. Only rewrite syntactically complete
`var(--old-name)` references, including whitespace variants such as
`var( --font-primary )`.

Raw user CSS should use the same exact `var(...)` replacement. This is still a
structured rename operation: replace only complete `var(--old-name)` calls and
preserve whitespace outside the variable name. Do not replace bare text such as
comments, class names, file names, or partial custom-property names.

## Delete Semantics

Deleting a token is destructive when the token is still referenced.

The editor should preview impact before deletion:

- number of classes or nodes using the variable;
- option to cancel;
- option to delete and leave existing CSS as unresolved `var(--...)`.

Do not silently rewrite deleted token references to a raw family. That removes
the design-token intent and makes future cleanup harder.

Deleting an installed font family is blocked while any token references that
family. The user can reassign affected tokens first, or delete the tokens with
their own impact confirmation.

## Import Behavior

The site importer already collects `@font-face` families into
`site.settings.fonts.items`.

When imported CSS contains root font variables, register them as font tokens if
their values resolve to an imported or installed family:

```css
:root {
  --font-display: "Acme Grotesk", sans-serif;
}
```

If the value cannot be matched to a known installed family, create a token with
no `familyId` and preserve the fallback stack as the declaration value where
possible.

Imported direct `font-family: var(--font-display)` declarations should keep
using the token variable.

## Testing

Schema and parser tests:

- valid `FontToken` entries are retained;
- malformed tokens are dropped or normalized at the tolerant parser boundary;
- duplicate variables are rejected by editor actions;
- variable normalization handles user-entered `--font Brand`.

CSS generation tests:

- emits `@font-face` rules for installed families;
- emits token variables from `fonts.tokens`;
- emits fallback-only tokens when `familyId` is absent;
- does not emit installed-family variables.

Store/action tests:

- creating a token writes the normalized variable;
- renaming a token rewrites structured `var(--old)` references;
- changing `familyId` does not change existing style declarations;
- deleting a referenced token reports impact.

Property panel tests:

- `fontFamily` renders the dedicated font picker;
- token selection writes `var(--font-...)`;
- direct font selection writes a concrete family stack;
- hover preview applies and clears transient font-family values.

Browser QA:

- Typography Fonts list shows live previews for Google and custom assigned
  families;
- property picker previews token rows in the assigned font;
- renaming a variable updates a visible text element using that token;
- changing a token's assigned family updates that element without changing its
  stored class declaration.

End-of-task verification:

```sh
bun run build
bun test
bun run lint
```

## Related

- `docs/editor.md` - admin editor, property panel, and Typography panel.
- `docs/features/site-import.md` - import flow for fonts and root variables.
- `src/core/fonts/schemas.ts` - font settings schema source of truth.
- `src/core/fonts/css.ts` - font CSS emitter.
- `src/core/page-tree/cssPropertyBag.ts` - `fontFamily` style property shape.
- `src/admin/pages/site/panels/TypographyPanel/FontsSection/FontsSection.tsx` -
  Fonts panel surface.
- `src/admin/pages/site/panels/PropertiesPanel/ClassPropertyRow.tsx` -
  property-row control routing and hover preview.
- `src/admin/pages/site/panels/PropertiesPanel/cssControlTypes.ts` -
  property control type and token-source mapping.
