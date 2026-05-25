# Module Engine

Cookbook for adding a new module — the building block used on the visual canvas. For the broader concept of what a module is, see [docs/features/modules.md](../features/modules.md). This page is a "how do I implement one?" reference.

---

## TL;DR

- Define with `defineModule({ id, name, defaults, schema, render })` from `@core/module-engine`.
- Register via `registry.register(YourModule)` in `src/modules/base/index.ts` (first-party) or via the plugin SDK's `modules` entrypoint (plugin).
- `id` is namespaced kebab-case (`base.heading`, `acme.product-card`).
- `render({ props, children, html })` is **pure** — string → string. No DOM, no React, no side effects.
- Props pass through `escapeProps` before `render`. Strings are HTML-safe; objects pass through (used by `_resolvedMediaByKey`).
- CSS from `render()` is deduped by `moduleId` — emit the same CSS per instance, it ships once.

---

## Minimal module

```ts
// src/modules/base/heading/HeadingModule.ts
import { defineModule } from '@core/module-engine'

export const HeadingModule = defineModule({
  id: 'base.heading',
  name: 'Heading',
  description: 'A heading element (h1–h6).',
  category: 'Typography',
  htmlTag: 'h2',
  defaults: {
    level: 2,
    text:  'Heading',
    align: 'left',
  },
  schema: {
    level: {
      type:    'select',
      label:   'Level',
      options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `h${n}` })),
    },
    text: { type: 'text', label: 'Text' },
    align: {
      type:    'select',
      label:   'Align',
      layout:  'inline',
      options: [
        { value: 'left',   label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right',  label: 'Right' },
      ],
    },
  },
  render: ({ props, html }) => {
    const tag = `h${Math.max(1, Math.min(6, Number(props.level) || 2))}`
    return {
      html: html`<${tag} class="heading" data-align="${props.align}">${props.text}</${tag}>`,
      css:  `.heading[data-align="center"] { text-align: center; }
             .heading[data-align="right"]  { text-align: right;  }`,
    }
  },
})
```

Register:

```ts
// src/modules/base/index.ts
import { HeadingModule } from './heading/HeadingModule'
registry.register(HeadingModule)
```

That's the whole feature loop:

- The module appears in the canvas Module Picker.
- Its Properties Panel auto-renders from `schema`.
- The publisher walks it like any other module.
- Its CSS is deduped across all instances.

---

## Render contract

```ts
type ModuleRender<TProps> = (input: {
  props:    TProps                                       // already escaped + bindings resolved
  children: string                                       // joined rendered child HTML
  html:     (strings, ...values) => string              // auto-escapes interpolations
}) => RenderOutput  // { html: string; css?: string }
```

### `props` is trusted (after escaping)

By the time `render` is called:

- String props have been HTML-escaped.
- Dynamic bindings (`{currentEntry.title}`) have been resolved.
- Per-breakpoint overrides have been merged in.

So `${props.title}` inside the `html` template is safe to interpolate as-is.

### `children` is trusted

It's already-rendered HTML from the publisher walker. Interpolate as-is:

```ts
html: html`<div class="container">${children}</div>`
```

### `html` is a tagged template that auto-escapes

```ts
html`<a href="${props.url}">${props.label}</a>`
```

Both `${props.url}` and `${props.label}` are auto-escaped. If you need to emit a raw HTML fragment (extremely rare), pre-build it with the same `html` template and concatenate.

### Returning CSS

```ts
return {
  html: html`<div class="my-mod">${children}</div>`,
  css:  `.my-mod { padding: 16px; border-radius: var(--editor-radius); }`,
}
```

- CSS is deduped per `moduleId` — emit the same CSS for every instance; it appears once.
- Use module-scoped selectors (`.my-mod`, `.my-mod__inner`). Don't use global selectors.
- The CSS goes through `sanitizeModuleCSS` — `@import`, `expression()`, `javascript:` URLs are stripped.
- `src/modules/` is exempt from `css-token-policy.test.ts` (modules ship to published pages where editor tokens aren't available). Use hex literals or site framework tokens.

### Emitting children

If a module accepts children (`canHaveChildren: true`), put `${children}` where they should appear:

```ts
canHaveChildren: true,
render: ({ children, html, props }) => ({
  html: html`<section class="container" data-direction="${props.direction}">${children}</section>`,
  css:  `/* ... */`,
})
```

Modules without children ignore `children` (it's the empty string anyway).

---

## Property schema patterns

### Text input

```ts
schema: {
  label: { type: 'text', label: 'Label' },
  body:  { type: 'textarea', label: 'Body', rows: 4 },
}
```

### Select

```ts
size: {
  type:    'select',
  label:   'Size',
  options: [
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
  ],
  defaultValue: 'md',
}
```

For long lists (>10), the Properties Panel auto-switches to a searchable dropdown.

### Conditional

```ts
hasIcon:  { type: 'boolean', label: 'Show icon' },
iconName: {
  type:    'select',
  label:   'Icon',
  options: ICON_OPTIONS,
  condition: { prop: 'hasIcon', equals: true },
}
```

The control hides when its condition is false.

### Link

```ts
href: {
  type:  'link',
  label: 'Link',
  defaultValue: { url: '', target: '_self', rel: '' },
}
```

Cell shape is `LinkValue { url, target?, rel? }`.

### Color

```ts
bgColor: { type: 'color', label: 'Background', defaultValue: '#1b1b1b' }
```

### Image / Media

```ts
poster:  { type: 'image', label: 'Poster' }
video:   { type: 'media', label: 'Video', accept: ['video/*'] }
```

Cell shape: media id (string) or external URL (string). The publisher resolves via `mediaPrefetch.ts` and attaches `_resolvedMediaByKey` to props.

### Spacing

```ts
padding: {
  type:  'spacing',
  label: 'Padding',
  defaultValue: { top: 0, right: 0, bottom: 0, left: 0 },
}
```

### Category grouping

```ts
text: { type: 'text', label: 'Text', category: 'content' }
align: { type: 'select', label: 'Align', category: 'layout' }
```

Categories: `content` | `layout` | `spacing` | `typography` | `background` | `border` | `effects` | `meta`.

### Layout

```ts
align:  { type: 'select', label: 'Align',  layout: 'inline' }   // same row
margin: { type: 'spacing', label: 'Margin', layout: 'block' }   // own row
```

---

## Media in `render`

For `image` and `media` props, the publisher's `attachResolvedMediaByKey(...)` puts a resolved `RenderResolvedMedia` object on `props._resolvedMediaByKey?.<propKey>`:

```ts
render({ props, html }) {
  const resolved = props._resolvedMediaByKey?.src
  if (!resolved) {
    // Fallback: render with the raw URL (for non-CMS URLs / preview)
    return { html: html`<img src="${props.src}" alt="${props.alt ?? ''}">` }
  }
  // Resolved — emit responsive picture markup
  return {
    html: html`
      <picture>
        ${resolved.sources.map((s) => html`<source srcset="${s.srcset}" type="${s.type}" sizes="${s.sizes}">`).join('')}
        <img src="${resolved.fallback}" alt="${props.alt ?? ''}"
             ${resolved.width  ? html` width="${resolved.width}"`   : ''}
             ${resolved.height ? html` height="${resolved.height}"` : ''}>
      </picture>
    `,
  }
}
```

`mediaPresentation.ts` produces the variants; `attachResolvedMediaByKey` attaches them; the module just emits the markup.

---

## Module dependencies (npm imports)

If your module needs an npm package at **runtime** (e.g. `three.js` in a 3D scene module):

```ts
dependencies: {
  three: '^0.171.0',
} as ModuleDependencies
```

The publisher emits an `<script type="importmap">` entry mapping `three` to the per-site runtime cache URL. Inside the module's frontend bundle, `import * as THREE from 'three'` works.

`getMissingModuleDependencies(...)` surfaces dependencies the site doesn't declare — the Site → Dependencies panel shows them so the user can add them.

---

## Editor canvas component (optional)

If your module needs DOM access at edit time (e.g. live preview interaction), provide a React `component`:

```ts
import type { ModuleComponentProps } from '@core/module-engine'

function HeadingComponent({ props, children, nodeId }: ModuleComponentProps<HeadingProps>) {
  // ... renders to React, inside the canvas iframe
  return <h2 data-align={props.align}>{props.text}</h2>
}

export const HeadingModule = defineModule({
  // ...
  component: HeadingComponent,
})
```

The canvas uses `component` instead of inserting raw `render()` HTML — but the **same HTML structure** must be produced. The canvas's selection geometry, drop-target detection, and dimension measurement assume parity.

---

## Forbidden patterns

| Pattern                                                              | Use instead                                              |
|----------------------------------------------------------------------|----------------------------------------------------------|
| `document.querySelector` inside `render`                             | Render is pure. No DOM.                                  |
| `await fetch(...)` inside `render`                                   | Render is sync. Pre-fetch via prefetch helpers.          |
| Mutating `props` inside `render`                                     | Treat as immutable.                                      |
| Hand-escaping with `String.replace`                                  | Use the `html` template helper.                          |
| Returning `<script>` tags in module HTML                             | The pipeline sanitizes them out. Use plugin frontend assets for runtime JS. |
| Importing from `@admin/...` inside a module                          | Modules are publisher-side. Stay inside `@core/...`, `@ui/...`. |
| Hardcoding `'#ff7700'` in module CSS when a site token exists        | Reference site framework tokens via `var(--site-primary)` if the site exposes one. Module hex is OK because `src/modules/` is exempt from the token gate. |
| One-off id-based selectors (`#node-${nodeId}`)                       | CSS is deduped per `moduleId` — selectors per-instance would defeat dedup. Use `[data-x]` attribute selectors instead. |

---

## Related

- [docs/features/modules.md](../features/modules.md) — broader module concept + lifecycle
- [docs/features/publisher.md](../features/publisher.md) — how `render()` fits in the walker
- [docs/features/visual-components.md](../features/visual-components.md) — `base.visual-component-ref`, slots
- [docs/reference/page-tree.md](page-tree.md) — nodes reference modules by `moduleId`
- Source-of-truth files:
  - `src/core/module-engine/types.ts` — `ModuleDefinition`, `RenderOutput`
  - `src/core/module-engine/propertySchema.ts` — `PropertyControl` discriminated union
  - `src/core/module-engine/registry.ts` — registry singleton
  - `src/modules/base/*` — first-party modules (read these for examples)
