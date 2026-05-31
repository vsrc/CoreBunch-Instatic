# Unified Selector Picker Design

The Properties panel class picker becomes a unified selector picker for the selected element.

This spec describes the intended design before implementation. The change keeps the current picker location and editing model, but expands it from assigned class rules only to all direct selectors that affect the selected rendered element.

---

## TL;DR

- The existing ClassPicker surface becomes selector-aware without moving in the Properties panel.
- Pills under the input show all direct style sources affecting the selected element: assigned classes, matching ambient selectors, pseudo-state ambient selectors, and inline styles.
- The dropdown searches class rules and ambient selectors.
- Class rules remain assignable/removable through `node.classIds`.
- Ambient selectors are not assigned to an element. Matching ambient selectors can be selected for editing; non-matching ambient selectors are disabled with `Doesn't match this element`.
- Creating from the input is inferred from syntax: simple class-like input creates a class; selector-shaped input creates an ambient rule.

## Decisions

| Topic | Decision |
| --- | --- |
| Panel shape | Keep the current picker location and pill strip. Do not build a separate DevTools-style rule stack. |
| Selector matching | Use the selected node's live canvas DOM element as the truth source for ambient matching. |
| Combinators | Match ambient selectors against the selected element as the selector subject with `element.matches(selector)`. |
| Pseudo states | Include supported pseudo-state selectors when the selector with the trailing pseudo removed matches the element; mark the pill inactive. |
| Inheritance | Do not include inherited ancestor rules in this pass. |
| Write target | Keep the existing model: edits write to the selected active rule, not to an implicit new rule. |
| Ambient dropdown rows | Show all ambient selectors; disable rows that do not match the selected element. |
| Ambient pill removal | Use the same pill shape as class pills, including the remove slot, but disable the remove action for ambient selectors. |

## UX

The picker stays directly below the selected element header in `src/admin/pages/site/panels/PropertiesPanel/ClassPicker.tsx`.

The input becomes a selector search/create control:

- Class rules are enabled when they are not already assigned to the selected node.
- Matching ambient rules are enabled and select the rule as the active edit target.
- Non-matching ambient rules are visible but disabled with `Doesn't match this element`.
- Empty-query suggestions keep the current Recent/Frequent/All grouping for class rules and include an Ambient selectors section in the same dropdown.

The pill strip shows:

- assigned class pills from `node.classIds`
- matching ambient selector pills from `site.styleRules`
- inactive pseudo selector pills when their non-pseudo subject matches
- the existing inline style pill when `node.inlineStyles` exists or inline editing is active

Clicking a class or matching ambient selector pill sets that rule as the active edit target in the same Properties panel. The selected node remains selected.

Class pills keep their existing actions:

- select/edit
- rename when allowed
- reorder
- remove from this element

Ambient pills:

- select/edit the ambient rule
- keep the same remove-slot layout
- disable the remove action because ambient selectors are not stored in `node.classIds`

Inline style pills keep their current behavior.

## Matching Model

Selector matching uses the live canvas element for the selected node.

The selected element is the rendered element carrying `data-node-id="<nodeId>"`, produced by `src/admin/pages/site/canvas/NodeRenderer.tsx`. The matcher reads from the active canvas document, not from a page-tree approximation.

Class-kind rules:

- Affect the element when the selected node has the rule id in `node.classIds`.
- Remain assignable/removable through `addNodeClass` and `removeNodeClass`.
- Do not require `element.matches()` to decide whether they are assigned.

Ambient rules:

- Affect the element when `element.matches(styleRuleSelector(rule))` is true.
- Do not become assigned to the node.
- Are editable from the picker only when they match the selected element.

Pseudo-state ambient rules:

- Supported trailing pseudos, such as `:hover` and `:focus`, are detected conservatively.
- If the full selector does not match at rest, the matcher strips the trailing supported pseudo and tests the stripped selector.
- When the stripped selector matches, the rule appears as an inactive pseudo match.
- Unsupported or structurally ambiguous selectors fall back to normal `element.matches()` behavior and fail closed on selector errors.

## Creation Rules

The picker infers the create operation from the typed query.

Class creation:

- `display` creates a class rule named `display`.
- `.display` normalizes to the same class rule named `display`.
- Existing class validation continues to use `assertValidCssClassName`.

Ambient creation:

- Selector-shaped input creates an ambient rule via `createAmbientRule`.
- Examples: `h1`, `.hero .title`, `a:hover`, `[data-x]`, `section > h2`.
- The ambient rule appears as a pill only when it matches the selected element.

If an ambient selector is created from the element picker but does not match the selected element, it is still created globally and remains available in the dropdown as disabled for that element.

## State And Data Flow

The existing active edit target can remain `activeClassId` during the first implementation because it points at a `StyleRule` id, not strictly a class-kind rule. Rename only local UI concepts that improve clarity.

The selector picker needs a small derivation layer that accepts:

- `site.styleRules`
- selected `PageNode`
- selected node id
- selected node's live canvas element
- current active rule id

It returns:

- pill items for selectors affecting the selected element
- dropdown suggestion items with enabled/disabled state
- exact-match/create metadata for submit behavior

The derivation stays pure except for DOM `matches()` calls. Store mutations remain in the existing store actions:

- `addNodeClass`
- `removeNodeClass`
- `createClass`
- `createAmbientRule`
- `setActiveClass`
- `renameClass`
- `reorderNodeClass`

## Error Handling

Invalid ambient selectors are already rejected by `createAmbientRule`. Matching code guards every `element.matches()` call because imported or corrupt persisted selectors may be invalid.

On selector match errors:

- skip that ambient selector for the selected element
- do not throw from the Properties panel render path
- avoid noisy logs for every render; corrupted selector persistence is handled by the tolerant style-rule parser and creation validation

User-visible create errors appear inline next to the picker input or in the existing creation dialog; the implementation must not silently swallow failed creates.

## Testing

Add focused unit tests around the selector derivation helper.

Required cases:

- `.hero .title` matches the `.title` selected element and not the `.hero` ancestor.
- `a:hover` appears as an inactive pseudo match for an anchor element.
- A non-matching ambient selector appears in dropdown results as disabled with `Doesn't match this element`.
- Simple input such as `display` creates a class.
- Selector-shaped input such as `.hero .title` creates an ambient selector.
- Ambient selector pills do not call `removeNodeClass`.

Update component tests only where useful for the rendered disabled/enabled behavior. Avoid broad browser E2E for this first pass unless the implementation changes canvas selection plumbing.

## Docs To Update After Implementation

- `docs/reference/css-class-registry.md` — describe the Properties panel selector picker and ambient selector visibility.
- `docs/editor.md` — update the Properties panel overview if it currently describes the picker as class-only.

## Related

- `src/admin/pages/site/panels/PropertiesPanel/ClassPicker.tsx` — current picker implementation.
- `src/admin/pages/site/panels/PropertiesPanel/useClassPickerSuggestions.ts` — current suggestion derivation.
- `src/admin/pages/site/panels/PropertiesPanel/StyleSurface.tsx` — active rule editing surface.
- `src/admin/pages/site/store/slices/classSlice.ts` — style-rule and node-class mutations.
- `src/admin/pages/site/canvas/NodeRenderer.tsx` — rendered `data-node-id` element source.
- `docs/reference/css-class-registry.md` — current style rule registry reference.
