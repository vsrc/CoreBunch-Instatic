# CSS Class Registry

The site's class registry — `Record<string, CSSClass>` stored on the site shell. Every user-defined CSS class lives here. The publisher compiles entries to CSS at publish time; the editor's canvas injects the same CSS for live preview.

Two kinds of classes:

1. **Author-facing classes** — the user picks a name (`hero-button`, `card-meta`) and the editor applies them via `node.classIds`.
2. **Scoped classes** — generated classes owned by a single node (for "set this property only on this element"). The scope object pins the class to its node.

---

## TL;DR

- Stored on `SiteShell.classes: Record<string, CSSClass>`.
- Source-of-truth schema: `CSSClassSchema` in `src/core/page-tree/cssClass.ts`.
- Compiled to CSS by `classCss.ts` in the publisher; collected via `collectClassCSS(site)`.
- Each node references classes by id (`node.classIds: string[]`). Later ids in the array win in cascade order.
- Class **name** is the public CSS selector (`.hero-button`); class **id** is the stable internal identifier (`<nanoid>`).
- Scoped classes (`scope: { type: 'node', nodeId, role: 'module-style' }`) generate uniquely-prefixed selectors so they don't affect other nodes.
- Generated classes (framework-emitted spacing utilities, etc.) are flagged on `metadata` so the ClassPicker can filter them out by default.

---

## The `CSSClass` shape

```ts
interface CSSClass {
  id:           string                              // nanoid, stable across renames
  name:         string                              // CSS class name applied to elements
  description?: string
  scope?: {
    type:   'node'
    nodeId: string
    role:   'module-style'
  }
  styles:           Record<string, unknown>          // base CSS properties (CSSPropertyBag-shaped at write time)
  breakpointStyles?: Record<string, Record<string, unknown>>  // per-breakpoint styles
  metadata?:    GeneratedClassMetadata               // framework-generated flags
  createdAt?:   number
  updatedAt?:   number
}
```

`styles` and `breakpointStyles` are typed `Record<string, unknown>` at the persistence boundary — narrowing happens at the publisher's `bagToCSS` (`classCss.ts`). The WRITE API (class slice, framework generators) uses the typed `CSSPropertyBag` shape from `src/core/page-tree/cssPropertyBag.ts`.

---

## Naming

Class **name** is the public CSS selector. It must be a valid CSS identifier. `assertValidCssClassName(name)` enforces:

- Starts with a letter or `-_`
- Contains only letters, digits, `-`, `_`
- Doesn't collide with reserved names

Class **id** is internal (a nanoid). Refs from nodes (`classIds`) and from internal data structures use the id, not the name. This means renaming a class doesn't break anything that references it.

Plugin-shipped classes are namespaced under the plugin id: `acme.template/hero-root`. See [docs/features/plugin-system.md](../features/plugin-system.md) (the pack section).

---

## Assigning classes to nodes

```ts
interface PageNode {
  // ...
  classIds: string[]    // ordered; later ids win in CSS cascade
}
```

The editor's ClassPicker (right Properties Panel) adds / removes entries from `node.classIds`. Order matters — drag-reorder is supported.

At render time, `classNamesForClassIds(classIds, registry)` returns the rendered class names that go onto the element's `class=` attribute. `injectNodeClassIds(html, node, site)` in the publisher splices them into the root tag.

---

## Compiling classes to CSS

`collectClassCSS(site)` walks the class registry and emits CSS for each entry:

```text
For each class in registry:
  selector = '.' + name                          // or scoped variant
  base CSS  = bagToCSS(class.styles)
  emit:     '${selector} { ${base CSS} }'

  for each (breakpointId, bag) in class.breakpointStyles:
    breakpoint = site.breakpoints[breakpointId]
    media query = '@media (min-width: ${minWidth}px) and (max-width: ${maxWidth}px)'
    bp CSS = bagToCSS(bag)
    emit: '${media query} { ${selector} { ${bp CSS} } }'
```

The compiled string is part of the per-page CSS bundle (see [docs/features/publisher.md](../features/publisher.md) → CSS pipeline).

### `bagToCSS`

Translates the property bag (`{ color: '#fff', padding: { top: 16, right: 8 } }`) to CSS strings. Handles:

- Plain values: `color: #fff;`
- Spacing bags: `padding: 16px 8px 0 0;` (decomposed)
- Variable references: `color: var(--site-primary);`
- Multi-value props (transforms, transitions): joined per CSS rules

Invalid entries are silently dropped — the bag is tolerant.

---

## Scoped classes

A scoped class is **owned by one node**. Its scope object pins it to that node's id and a role:

```ts
{
  id:    'class-abc',
  name:  '__pb_scope_<nodeId>',          // generated, never user-facing
  scope: { type: 'node', nodeId: 'node-xyz', role: 'module-style' },
  styles: { 'border-radius': '12px' },
}
```

When the publisher emits the selector, it generates a uniquely-prefixed name so it can't be applied accidentally elsewhere:

```css
[data-node-id="node-xyz"].__pb_scope_node-xyz {
  border-radius: 12px;
}
```

Use scoped classes when you want **per-node styling** without polluting the global class palette. The Properties Panel exposes this via "Edit only this element" controls.

### Duplicating nodes with scoped classes

When a node is duplicated, its scoped classes need fresh ids that point at the duplicated nodes (not the originals). `cloneScopedClassesForNodeMap(scopedClasses, oldToNewIdMap)` rewrites them in one pass.

Called by `duplicateNode` and `pasteSubtree` in `src/core/page-tree/mutations.ts`.

---

## Generated classes (framework + plugin)

A "generated" class is one the codebase emits programmatically — typically the spacing scale utilities (`.pad-1`, `.pad-2`, ...) or the typography scale. They have `metadata.generated = true` with kind tags.

`classUtils.ts`:

```ts
isUserVisibleClass(cls)        // false for generated classes — hides them from the ClassPicker by default
isGeneratedClass(cls)          // true if `metadata.generated === true`
isGeneratedClassLocked(cls)    // true if the class is locked from manual edit (the framework owns its styles)
generatedClassKindLabel(cls)   // e.g. 'Spacing', 'Typography' — for grouping in the ClassPicker advanced view
```

The framework regenerates these classes whenever the user changes the framework scale (Site → Framework → Scale panel). Users can opt to show them in the ClassPicker via Settings → Editor → Show framework-generated classes.

---

## Tolerant parse

`parseCSSClass(raw)` is tolerant — it never throws. Invalid `scope` shapes drop silently; missing `styles` falls back to `{}`; missing `id` or `name` makes the whole entry skip. `parseClassRegistry(raw)` walks an entire registry and filters out invalid entries.

This is what makes the editor robust against partially-corrupt persisted data — a single broken class doesn't break the whole site load.

Hard parsing (throws on shape mismatch) uses `Value.Parse(CSSClassSchema, raw)` directly. The persistence layer uses the tolerant path so the editor can render even with garbage entries.

---

## Cookbook

### Create a class

```ts
import { nanoid } from 'nanoid'
import type { CSSClass } from '@core/page-tree'

const cls: CSSClass = {
  id:     nanoid(),
  name:   'hero-button',
  styles: {
    'background-color': 'var(--site-primary)',
    'padding':          { top: 12, right: 24, bottom: 12, left: 24 },
    'border-radius':    '8px',
  },
}

useEditorStore.getState().createClass(cls)
```

The class is added to `site.classes`. The publisher emits CSS for it on next publish.

### Assign a class to a node

```ts
useEditorStore.getState().setNodeClassIds(nodeId, ['hero-button'])
```

The class names appear on the rendered element via `classNamesForClassIds`.

### Per-breakpoint styles

```ts
{
  id:    'card',
  name:  'card',
  styles:           { padding: 16, 'border-radius': 8 },
  breakpointStyles: {
    mobile:  { padding: 8 },         // narrower padding on mobile
    desktop: { padding: 24 },        // wider on desktop
  },
}
```

The publisher wraps each per-breakpoint style block in the matching `@media (min-width: ...)` query.

### Scoped class for one node

The Properties Panel's "Custom" tab generates a scoped class automatically when the user sets a property only on that node. Internally:

```ts
const scoped: CSSClass = {
  id:    nanoid(),
  name:  `__pb_scope_${nodeId}`,
  scope: { type: 'node', nodeId, role: 'module-style' },
  styles: { 'border-radius': '12px' },
}
useEditorStore.getState().createClass(scoped)
useEditorStore.getState().setNodeClassIds(nodeId, [...existing, scoped.id])
```

The user never sees `__pb_scope_<nodeId>` — the panel shows it as "Custom styles".

### Rename a class

Class **id** is stable; **name** is editable. The editor mutates `class.name`. Nodes that reference the class by id keep working — only the rendered CSS class name changes.

### Delete a class

`useEditorStore.getState().deleteClass(classId)`:

1. Remove the entry from `site.classes`.
2. Walk every node and remove the id from `classIds`.
3. (Optional) If the class is scoped to a now-deleted node, the class can be GC'd alongside.

---

## Forbidden patterns

| Pattern                                                              | Use instead                                              |
|----------------------------------------------------------------------|----------------------------------------------------------|
| Storing CSS strings directly on nodes                                | Add a `CSSClass` to the registry; reference via `classIds` |
| Looking up a class by name                                           | Look up by id — names can be renamed                     |
| Hand-emitting CSS in module `render`                                 | Add a class to the registry — modules emit shared CSS, not per-instance overrides |
| Forgetting to clone scoped classes on duplicate / paste              | `cloneScopedClassesForNodeMap` — called by mutations     |
| Letting users name a class `__pb_scope_*`                            | The validator rejects names starting with `__pb_`        |
| Mixing user classes and framework classes in the same `classIds` array without intent | The order matters — later wins. Framework classes are usually last (override semantics). |
| Reading `class.styles` as `CSSPropertyBag` without narrowing         | The persistence boundary stores `Record<string, unknown>` — narrow via `bagToCSS` or `parseStylesBag` |
| Hard-failing the editor on a corrupt class entry                     | `parseClassRegistry` is tolerant — invalid entries drop silently |

---

## Related

- [docs/features/publisher.md](../features/publisher.md) — `collectClassCSS` in the CSS pipeline
- [docs/features/site-shell.md](../features/site-shell.md) — `Record<string, CSSClass>` on the shell
- [docs/reference/page-tree.md](page-tree.md) — `node.classIds`
- [docs/design.md](../design.md) — design rules around user classes
- Source-of-truth files:
  - `src/core/page-tree/cssClass.ts` — `CSSClassSchema`, `parseCSSClass`, `parseClassRegistry`
  - `src/core/page-tree/classNames.ts` — `cssClassSelector`, `classNamesForClassIds`, `assertValidCssClassName`
  - `src/core/page-tree/classUtils.ts` — `isUserVisibleClass`, `isGeneratedClass`, ...
  - `src/core/page-tree/cssPropertyBag.ts` — `CSSPropertyBag` type
  - `src/core/page-tree/scopedClassClone.ts` — `cloneScopedClassesForNodeMap`
  - `src/core/publisher/classCss.ts` — `bagToCSS`
  - `src/core/publisher/cssCollector.ts` — `collectClassCSS`
- Gate tests:
  - `src/__tests__/architecture/framework-typography-spacing.test.ts`
  - `src/__tests__/architecture/task427-preview-class-css.test.ts`
