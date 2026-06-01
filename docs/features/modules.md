# Modules

Modules are the building blocks the visual editor places on the canvas — `base.container`, `base.text`, `base.image`, `base.button`, `base.loop`, `base.visual-component-ref`, plugin-shipped modules, etc. Each module is a single `ModuleDefinition` registered in the global `ModuleRegistry`.

A module declares:
- A unique `id` (namespaced: `base.text`, `acme.product-card`)
- A `PropertySchema` describing its props (drives the right-panel form)
- A `render({ props, children, html })` function that returns HTML + optional CSS
- An optional canvas `component` (React) for in-editor preview
- Optional defaults, behaviors (`canHaveChildren`, `htmlTag`, `category`)

---

## TL;DR

- Definition shape: `ModuleDefinition<TProps>` in `src/core/module-engine/types.ts`.
- Property control schema: `PropertyControl` (text / textarea / number / boolean / select / color / image / link / spacing / variable / etc.) in `propertySchema.ts`.
- Registry: `registry` singleton in `src/core/module-engine/registry.ts`. First-party modules self-register from `src/modules/base/index.ts` at app boot.
- Plugin modules register via `defineModule` from the SDK and the plugin's `modules` entrypoint.
- The publisher walks the page tree and calls `module.render()` per node — see [docs/features/publisher.md](publisher.md).
- The editor canvas may render via the React `component` if provided; otherwise it uses the same `render()` HTML inside a sandboxed iframe.

---

## Where the code lives

```text
src/core/module-engine/
├── types.ts             — ModuleDefinition, RenderOutput, ModuleComponentProps, ModuleDependencies
├── registry.ts          — ModuleRegistry singleton (`registry`)
├── propertySchema.ts    — PropertyControl discriminated union, PropertySchemaSchema
├── dependencies.ts      — module dependency normalization + checks
└── runtimeResolver.ts   — bare-specifier → runtime URL mapping for ESM modules

src/modules/base/
├── body/                — base.body (root container)
├── container/           — base.container (flex/grid container)
├── text/                — base.text (single-line text)
├── content/             — base.content (rich text / paragraphs)
├── button/              — base.button
├── link/                — base.link
├── image/               — base.image
├── video/               — base.video
├── list/                — base.list
├── loop/                — base.loop
├── forms/               — base.form and form-control primitives
├── visualComponentRef/  — base.visual-component-ref
├── slotOutlet/          — base.slot-outlet (VC author side)
├── slotInstance/        — base.slot-instance (VC consumer side)
├── utils/               — shared helpers (escape, common html templates)
└── index.ts             — registers every base module with the registry
```

---

## The `ModuleDefinition` shape

```ts
interface ModuleDefinition<TProps extends Record<string, unknown>> {
  /** Namespaced id — 'base.text', 'acme.product-card'. URL-safe lowercase. */
  id: string

  /** Display name in the module picker. */
  name: string

  /** One-line description (shown in the picker). */
  description?: string

  /** Category — for grouping in the picker ('Layout', 'Typography', 'Media', ...). */
  category?: string

  /** Default HTML tag the module renders to. Used by the canvas for selection geometry. */
  htmlTag?: string

  /** True if the module accepts children. */
  canHaveChildren?: boolean

  /** Default props applied when a fresh instance is inserted. */
  defaults: Partial<TProps>

  /** Property schema — drives the right-panel Properties UI. */
  schema: PropertySchema

  /** Pure render function — called by the publisher and the canvas. */
  render: (input: {
    props:     TProps                  // already escaped + dynamic-prop-resolved
    children:  string                  // joined rendered child HTML
    html:      (strings: TemplateStringsArray, ...values: unknown[]) => string
  }) => RenderOutput   // { html: string; css?: string }

  /** Optional: React component for the editor canvas (when the iframe-rendered HTML isn't enough). */
  component?: React.ComponentType<ModuleComponentProps<TProps>>

  /** Optional: external npm dependencies this module needs (e.g. 'three'). */
  dependencies?: ModuleDependencies

  /** Optional: marker classes the editor recognizes for selection / drop-target geometry. */
  selectorClasses?: string[]
}
```

Constraint #179: **`render()` is pure** — no DOM, no React, no side effects. Inputs in, strings out.

---

## Property schema

The schema drives the right-panel Properties UI. Each prop key maps to a `PropertyControl` describing how to edit it.

```ts
schema: PropertySchema = {
  text:  { type: 'text',     label: 'Text' },
  color: { type: 'color',    label: 'Color', defaultValue: '#000' },
  size:  { type: 'select',   label: 'Size', options: [
            { value: 'sm', label: 'Small' },
            { value: 'md', label: 'Medium' },
            { value: 'lg', label: 'Large' },
          ]},
  alignment: { type: 'select', label: 'Align',
               options: ['left', 'center', 'right'].map(v => ({ value: v, label: v })),
               layout: 'inline' },
}
```

### Control types

| `type`        | Renders as                                                | Cell value                                       |
|---------------|-----------------------------------------------------------|--------------------------------------------------|
| `text`        | `<Input>`                                                 | `string`                                         |
| `textarea`    | `<Textarea>`                                              | `string`                                         |
| `richText`    | `<RichTextEditor>` (DOMPurify-sanitized output)           | HTML string                                      |
| `number`      | `<Input type="number">`                                   | `number`                                         |
| `boolean`     | `<Switch>`                                                | `boolean`                                        |
| `select`      | `<Select>` (short list) or `<ContextMenu>` (long)         | option value (string)                            |
| `multiSelect` | Multi-select pills                                        | `string[]`                                       |
| `color`       | `<ColorInput>`                                            | `string` (hex / token name)                      |
| `link`        | URL + target + rel composite                              | `LinkValue` object                               |
| `dataTable`   | Data table picker                                         | table id string                                  |
| `image`       | Media picker                                              | media id or URL                                  |
| `media`       | Media picker (any media type)                             | media id                                         |
| `spacing`     | 4-axis spacing control (margin / padding box)             | `SpacingValue` object                            |
| `variable`    | Variable token autocomplete                               | `string`                                         |

`PropertyControl` is a discriminated union — `propertySchema.ts` has the full schema.

### Conditional controls

A control can declare `condition` to hide itself unless another prop has a specific value:

```ts
schema: {
  hasIcon: { type: 'boolean', label: 'Show icon' },
  iconName: {
    type: 'select',
    label: 'Icon',
    options: [...],
    condition: { prop: 'hasIcon', equals: true },
  },
}
```

### Layout

`layout: 'inline'` puts the control on the same row as its label (good for short options). `layout: 'block'` (default) stacks it.

### Categories

`category: 'spacing' | 'typography' | 'background' | 'border' | 'effects' | 'meta' | 'content' | ...` groups controls in the Properties panel under collapsible sections.

---

## The registry

`src/core/module-engine/registry.ts` exports a singleton:

```ts
import { registry } from '@core/module-engine/registry'

registry.register(MyModuleDefinition)
registry.get('base.text')          // → ModuleDefinition | undefined
registry.list()                    // → AnyModuleDefinition[]
registry.subscribe(listener)       // notified on register/unregister
```

The registry is type-erased — every module is held as `AnyModuleDefinition` (props typed as `Record<string, unknown>`). The narrow → erased cast happens once at `register()` so user code never needs to widen its types.

### Boot-time registration

`src/modules/base/index.ts` registers every first-party module. It's imported by `SitePage.tsx` (the visual editor's mount) so the registry is populated before the canvas mounts:

```ts
// src/modules/base/index.ts
import { registry } from '@core/module-engine'
import { ContainerModule } from './container'
import { TextModule } from './text'
// ...
registry.register(ContainerModule)
registry.register(TextModule)
// ...
```

### Plugin module registration

Plugin modules register from inside the plugin's QuickJS sandbox. The plugin's `modules` entrypoint exports `defineModule(...)` definitions that the host loads into a separate VM (`server/plugins/modulePackVm.ts`) and reflects into the editor via the plugin host bridge.

A plugin canvas module is rendered inside the editor's sandboxed iframe just like a first-party module.

---

## Rendering modules

The publisher's per-node flow (see [docs/features/publisher.md](publisher.md)):

```text
For each node, bottom-up:
  1. children = node.children.map(renderNode)
  2. resolvedProps  = resolveProps(node, breakpoint)
  3. dynamicProps   = resolveDynamicProps(...)
  4. safeProps      = escapeProps(dynamicProps, schema)   ← string props HTML-escaped
  5. { html, css } = def.render({ props: safeProps, children, html })
  6. cssCollector.add(moduleId, css)                       ← dedup by moduleId
  7. html = injectNodeClassIds(html, node, site)           ← splice classIds into root tag
```

A module's CSS is **collected and deduped by `moduleId`** — emitting the same CSS for every instance is fine; it appears once in the published page bundle.

### The `html` template helper

`html` (passed in to `render`) is a tagged template that auto-escapes interpolated values:

```ts
render({ props, children, html }) {
  return {
    html: html`<div class="card">
      <h3>${props.title}</h3>
      ${children}
    </div>`,
    css: `.card { padding: 16px; border-radius: 12px; }`,
  }
}
```

`${props.title}` is auto-escaped (HTML-safe). `${children}` is **trusted** because it's already rendered HTML from the walker.

If you need to emit a raw HTML attribute fragment (e.g. `aria-label="..."`), pre-escape with `escapeHtml(value)` and interpolate as a string.

---

## Editor canvas rendering

The canvas renders modules inside per-breakpoint iframes. Two render paths:

| Path                                                                       | When used                                                  |
|----------------------------------------------------------------------------|------------------------------------------------------------|
| The module's `render()` HTML inserted into the iframe (default)            | All modules with no `component`                            |
| The module's React `component` rendered in a host-managed iframe           | When the module needs DOM access or interactive runtime    |

The React component receives `ModuleComponentProps<TProps>`:

```ts
interface ModuleComponentProps<TProps> {
  props:    TProps
  children: React.ReactNode
  nodeId:   string
  // ... editor-time context (breakpoint, selected, hovered, etc.)
}
```

Modules with a `component` should produce HTML that **matches** what `render()` would produce — the canvas selection geometry, drop-target detection, and dimension measurements assume parity.

---

## Module dependencies

Modules can declare external npm dependencies they need at runtime (e.g. a `base.three-scene` module that imports `three`):

```ts
dependencies: {
  three: '^0.171.0',
} as ModuleDependencies
```

When a page uses such a module, the publisher emits a `<script type="importmap">` mapping `three` to the per-site runtime cache URL (`/_pb/runtime/cache/<hash>/three/build/three.module.js`).

`getMissingModuleDependencies(...)` in `dependencies.ts` returns the dependencies a module needs that the site doesn't declare in its `packageJson` — the Site → Dependencies panel surfaces these so the user can add them.

---

## Cookbook

### Define a first-party module

```ts
// src/modules/base/heading/index.ts
import { defineModule } from '@core/module-engine'

export const HeadingModule = defineModule({
  id: 'base.heading',
  name: 'Heading',
  description: 'A heading element (h1–h6).',
  category: 'Typography',
  htmlTag: 'h2',
  defaults: { level: 2, text: 'Heading', align: 'left' },
  schema: {
    level: {
      type: 'select',
      label: 'Level',
      options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `h${n}` })),
    },
    text: { type: 'text', label: 'Text' },
    align: {
      type: 'select',
      label: 'Align',
      layout: 'inline',
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
      css: `.heading[data-align="center"] { text-align: center; } .heading[data-align="right"] { text-align: right; }`,
    }
  },
})
```

Register it in `src/modules/base/index.ts`:

```ts
import { HeadingModule } from './heading'
registry.register(HeadingModule)
```

That's it. The module shows up in the picker, in the Properties panel, in the publisher, in the canvas.

### Override per-breakpoint props

Nodes carry `breakpointOverrides: Record<breakpointId, Partial<TProps>>`. The publisher merges them on top of `props` for the active breakpoint:

```ts
// In the editor:
setBreakpointOverride(nodeId, 'mobile', 'align', 'center')

// At render:
resolveProps(node, 'mobile')  → { ...node.props, ...node.breakpointOverrides.mobile }
```

Modules don't need to know — they just receive resolved props.

### Bind a prop to dynamic data

`PageNode.dynamicBindings` lets a prop be filled from `currentEntry` / `parentEntry` / `site` / `viewer` at render time:

```jsonc
{
  "moduleId": "base.heading",
  "props": { "text": "Default heading", "level": 2 },
  "dynamicBindings": {
    "text": { "source": "currentEntry", "fieldId": "title" }
  }
}
```

At render time, `resolveDynamicProps(...)` substitutes the bound value. Used inside loops (the entry stack supplies `currentEntry`) and inside entry templates (the published row supplies `currentEntry`).

### Read site files / other context from a module

```ts
render({ props, children, html, ctx }) {  // ctx is available if requested
  const stylesheet = ctx.siteFiles.find((f) => f.id === props.stylesheetId)
  // ...
}
```

Modules that need broader context can opt in to `ctx: RenderContext`. Most modules don't need it.

---

## Forbidden patterns

| Pattern                                                       | Use instead                                                  |
|---------------------------------------------------------------|--------------------------------------------------------------|
| `render` calling `document.querySelector` / `window.foo`      | Render is pure — no DOM. Compute, don't read.                |
| `await fetch(...)` inside `render`                            | Render is sync. Pre-fetch via loop prefetch / media prefetch.|
| Mutating `props` inside `render`                              | Treat as immutable input.                                    |
| Hand-escaping with `String.replace(/</g, '&lt;')`             | Use the `html` tagged template (auto-escapes interpolations).|
| Returning `{ html: '<script>...</script>' }`                  | Scripts in module HTML are stripped at publish-time sanitize. Use plugin frontend assets for runtime JS. |
| Emitting unique CSS per instance (with hardcoded ids)         | Use stable selectors / `[data-*]` attrs — CSS is deduped per `moduleId`. |
| Hardcoding hex colors in module CSS                           | Module CSS ships to published pages, where editor tokens aren't available. Use site `framework` tokens (`var(--site-primary)` style) if exposed, or accept the hex literal. (`src/modules/` is exempt from `css-token-policy.test.ts`.) |
| Importing from `@admin/...` inside a module                   | Modules are publisher-side. Admin imports break boot. Stay inside `@core/...` and `@ui/...` (for icons). |

---

## Related

- [docs/architecture.md](../architecture.md) — modules in the layer stack
- [docs/features/publisher.md](publisher.md) — how the walker calls `module.render()`
- [docs/features/visual-components.md](visual-components.md) — `base.visual-component-ref`, `base.slot-outlet`, `base.slot-instance`
- [docs/features/loops.md](loops.md) — `base.loop`
- [docs/features/cms-native-forms.md](cms-native-forms.md) — `base.form` and form-control primitives
- [docs/features/plugin-system.md](plugin-system.md) — plugin modules + module packs
- [docs/features/html-import.md](html-import.md) — HTML string → `PageNode` importer; uses `base.text`, `base.button`, `base.image`, `base.container`
- [docs/reference/module-engine.md](../reference/module-engine.md) — focused cookbook for adding a module
- [docs/reference/page-tree.md](../reference/page-tree.md) — nodes reference modules by `moduleId`
- Source-of-truth files:
  - `src/core/module-engine/types.ts` — `ModuleDefinition`, `RenderOutput`, `ModuleComponentProps`
  - `src/core/module-engine/registry.ts` — `ModuleRegistry`, `registry` singleton
  - `src/core/module-engine/propertySchema.ts` — `PropertyControl` union, `PropertySchemaSchema`
  - `src/core/module-engine/dependencies.ts` — `ModuleDependencies`, `getMissingModuleDependencies`
  - `src/modules/base/index.ts` — boot-time first-party registration
- Gate tests:
  - `src/__tests__/architecture/component-system-placement.test.ts`
  - `src/__tests__/architecture/framework-typography-spacing.test.ts`
