/**
 * src/core/htmlImport — HTML → PageNode importer.
 *
 * Public API:
 *
 *   importHtml(source)   — parse → strip → walk; the single entry point.
 *   parseHtml(source)    — DOMParser wrapper (browser / test polyfill).
 *   stripUnsafe(doc)     — mutates doc in place, returns StripReport.
 *   walkAndMap(doc)      — maps doc.body element children to PageNodes.
 *   HTML_TO_MODULE_RULES — declarative element → module mapping table.
 *
 * Types:
 *   ImportFragment  — { nodes, rootIds } flat NodeTree fragment.
 *   ImportResult    — ImportFragment + stripped (StripReport).
 *   StripReport     — counts of dropped constructs.
 *   ImportRule      — shape of a single rule in HTML_TO_MODULE_RULES.
 *
 * All imports into this module from outside go through this barrel.
 * Internal files import each other via relative paths.
 */

export type { ImportFragment, ImportResult } from './walkAndMap'
export type { StripReport } from './stripUnsafe'
export type { ImportRule } from './rules'

export { HTML_TO_MODULE_RULES } from './rules'
export { parseHtml } from './parseHtml'
export { stripUnsafe } from './stripUnsafe'
export { walkAndMap, importHtml } from './walkAndMap'
export { harvestInlineBackgrounds, extractBackgroundStyles } from './inlineStyle'
