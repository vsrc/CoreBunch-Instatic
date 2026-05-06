/**
 * validateSite — Constraint #230: ALL site data loaded from storage MUST be
 * validated before being passed to `store.loadSite()`.
 *
 * Structural validation is delegated to parseSiteDocument (TypeBox).
 * runDomainPostChecks() handles the nine cross-cutting rules that cannot be
 * expressed as per-field schema constraints:
 *   1. Page slug syntax
 *   2. Page slug uniqueness
 *   3. SiteFile path safety + deduplication
 *   4. VisualComponent name validation
 *   5. VisualComponent recursion prevention
 *   6. Richtext prop sanitization (XSS — Constraint #299)
 *   7. SitePackageJson name sanitization
 *   8. SiteRuntimeConfig normalization
 *   9. Framework color slug normalization + default dark color generation
 *
 * Referential integrity: rootNodeId must exist in each page's nodes map.
 */

import { nanoid } from 'nanoid'
import { parseSiteDocument, type SiteDocument } from '@core/page-tree/schemas'
import { isSafePath, normalizePath } from '@core/files/pathValidation'
import { validateComponentName } from '@core/visualComponents/nameValidation'
import { sanitizeRichtext, isRichtextPropKey } from '@core/sanitize'
import { normalizeSitePackageJson } from '@core/site-dependencies/manifest'
import { normalizeSiteRuntimeConfig } from '@core/site-runtime'
import { pageSlugDuplicateError, pageSlugError } from '@core/page-tree/slugs'
import { generateDefaultDarkColor, normalizeFrameworkColorSlug } from '@core/framework/colors'
import { getReferencedComponentIds } from '@core/visualComponents/recursionGuard'
import { syncSlotInstances, applySlotSyncResult } from '@core/visualComponents/slotSync'
import type { BaseNode } from '@core/page-tree/baseNode'

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class SiteValidationError extends Error {
  readonly path: string
  constructor(message: string, path: string) {
    super(`[persistence/validate] ${path}: ${message}`)
    this.name = 'SiteValidationError'
    this.path = path
  }
}

// ---------------------------------------------------------------------------
// Legacy shape converter
// ---------------------------------------------------------------------------

/**
 * Convert legacy VC shape (rootNode + childNodes) to flat tree shape (tree.nodes).
 *
 * Detects VCs that still have `rootNode` (old nested format) and have no `tree`
 * field, then rewrites them in-place:
 *   vc.tree = { nodes: flatNodes, rootNodeId: root.id }
 *   delete vc.rootNode
 *
 * The nodes in the flat map have `childNodes` stripped — the flat `children`
 * array (IDs) is authoritative.
 *
 * Mutates `raw` in place before parseSiteDocument runs.
 *
 */
// TODO(2026-06-05): delete legacy-shape converter. Pre-release flux period ended; all dev DBs have been re-saved with the new shape.
function convertLegacyVCShape(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const site = raw as Record<string, unknown>
  const vcs = site.visualComponents
  if (!Array.isArray(vcs)) return

  for (const vc of vcs) {
    if (!vc || typeof vc !== 'object') continue
    const v = vc as Record<string, unknown>

    // Already migrated — has a valid tree object
    if (v.tree && typeof v.tree === 'object' && !Array.isArray(v.tree)) continue

    // Old shape: has rootNode
    const root = v.rootNode
    if (!root || typeof root !== 'object' || Array.isArray(root)) continue

    // Walk the nested rootNode tree and build a flat nodes map.
    // childNodes is stripped from each node copy (children[] is authoritative).
    const flatNodes: Record<string, unknown> = {}
    function walk(n: Record<string, unknown>): void {
      const id = String(n.id ?? '')
      if (!id) return
      // Destructure out childNodes, keep everything else
      const { childNodes, ...rest } = n as Record<string, unknown> & { childNodes?: unknown }
      void childNodes
      flatNodes[id] = rest
      // Recurse into the old nested children
      if (Array.isArray(n.childNodes)) {
        for (const child of n.childNodes as unknown[]) {
          if (child && typeof child === 'object' && !Array.isArray(child)) {
            walk(child as Record<string, unknown>)
          }
        }
      }
    }
    walk(root as Record<string, unknown>)

    const rootId = (root as Record<string, unknown>).id
    v.tree = { nodes: flatNodes, rootNodeId: rootId }
    delete v.rootNode
  }
}

// ---------------------------------------------------------------------------
// Legacy slotContent converter (Task 4)
// ---------------------------------------------------------------------------

/**
 * Convert legacy `vcRef.props.slotContent: Record<string, VCNode[]>` format
 * to materialized `base.slot-instance` children in the page tree.
 *
 * Old shape (pre-Task 4):
 *   page.nodes[refId].props.slotContent = {
 *     children: [{ id, moduleId, props, children, ... }, ...],
 *   }
 *
 * New shape (Task 4 Tree Unification):
 *   page.nodes[refId].children = ['slotInstanceId']
 *   page.nodes['slotInstanceId'] = {
 *     id, moduleId: 'base.slot-instance',
 *     props: { slotName: 'children' },
 *     children: ['contentNodeId'],
 *     locked: true,
 *   }
 *   page.nodes['contentNodeId'] = { ... } (content nodes from slotContent array)
 *
 * Mutates `raw` in place before parseSiteDocument runs. Handles both flat
 * (children[]) and legacy nested (childNodes[]) VCNode shapes within
 * the slotContent arrays.
 *
 */
// TODO(2026-06-05): delete legacy-shape converter. Pre-release flux period ended; all dev DBs have been re-saved with the new shape.
function convertLegacySlotContent(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return
  const site = raw as Record<string, unknown>
  const pages = site.pages
  if (!Array.isArray(pages)) return

  for (const page of pages) {
    if (!page || typeof page !== 'object') continue
    const p = page as Record<string, unknown>
    const nodes = p.nodes
    if (!nodes || typeof nodes !== 'object' || Array.isArray(nodes)) continue
    const nodesMap = nodes as Record<string, unknown>

    for (const node of Object.values(nodesMap)) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) continue
      const n = node as Record<string, unknown>
      if (n.moduleId !== 'base.visual-component-ref') continue
      const nodeProps = n.props as Record<string, unknown> | undefined
      if (!nodeProps) continue
      const slotContent = nodeProps.slotContent
      if (!slotContent || typeof slotContent !== 'object' || Array.isArray(slotContent)) continue

      // Has legacy slotContent — convert each slot key to a slot-instance child.
      const slotContentMap = slotContent as Record<string, unknown>
      const newChildIds: string[] = []

      for (const [slotName, contentNodes] of Object.entries(slotContentMap)) {
        if (!Array.isArray(contentNodes)) continue

        // Flatten legacy VCNode trees into the page's nodes map.
        // Each element may itself be nested (childNodes) or flat (children[]).
        const contentChildIds: string[] = []
        for (const contentNode of contentNodes) {
          if (!contentNode || typeof contentNode !== 'object' || Array.isArray(contentNode)) continue
          const cn = contentNode as Record<string, unknown>
          const cnId = typeof cn.id === 'string' && cn.id ? cn.id : nanoid()
          cn.id = cnId
          flattenLegacyVCNodeIntoPageNodes(cn, nodesMap)
          contentChildIds.push(cnId)
        }

        // Create the slot-instance node.
        const slotInstanceId = nanoid()
        nodesMap[slotInstanceId] = {
          id: slotInstanceId,
          moduleId: 'base.slot-instance',
          props: { slotName },
          children: contentChildIds,
          breakpointOverrides: {},
          classIds: [],
          locked: true,
        }
        newChildIds.push(slotInstanceId)
      }

      // Replace slotContent prop with slot-instance children.
      delete nodeProps.slotContent
      // Merge new slot-instance IDs with any existing children (e.g. already-converted).
      const existingChildren = Array.isArray(n.children) ? (n.children as string[]) : []
      n.children = [...existingChildren, ...newChildIds]
    }
  }
}

/**
 * Recursively flatten a legacy VCNode (possibly with nested childNodes) into
 * the flat page nodes map. Strips `childNodes` and normalizes `children` to
 * an array of IDs.
 */
function flattenLegacyVCNodeIntoPageNodes(
  node: Record<string, unknown>,
  nodesMap: Record<string, unknown>,
): void {
  const id = typeof node.id === 'string' && node.id ? node.id : nanoid()
  node.id = id

  // Normalize children array.
  let childIds: string[] = []
  if (Array.isArray(node.childNodes)) {
    // Legacy nested format: childNodes is an array of VCNode objects
    for (const child of node.childNodes as unknown[]) {
      if (!child || typeof child !== 'object' || Array.isArray(child)) continue
      const c = child as Record<string, unknown>
      const childId = typeof c.id === 'string' && c.id ? c.id : nanoid()
      c.id = childId
      flattenLegacyVCNodeIntoPageNodes(c, nodesMap)
      childIds.push(childId)
    }
    delete node.childNodes
  } else if (Array.isArray(node.children)) {
    // Already-flat format: children is already string IDs
    childIds = (node.children as unknown[]).filter((v) => typeof v === 'string') as string[]
  }

  node.children = childIds
  if (!node.breakpointOverrides || typeof node.breakpointOverrides !== 'object') {
    node.breakpointOverrides = {}
  }
  if (!Array.isArray(node.classIds)) {
    node.classIds = []
  }

  nodesMap[id] = node
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a parseSiteDocument error message to a structured site path.
 *
 * parseSiteDocument throws Error with messages in two formats:
 *   1. "<relative.path>: <description>" (from parsePageNode / parsePage)
 *      → strip the ': ...' suffix, prepend 'site.'
 *   2. "<firstWord> <rest>" (top-level field errors, e.g. "id must be a string")
 *      → extract first word as field name, prepend 'site.'
 */
function extractSiteErrorPath(message: string): string {
  const colonIndex = message.indexOf(': ')
  if (colonIndex > 0) {
    return `site.${message.slice(0, colonIndex)}`
  }
  const firstWord = message.split(' ')[0]
  return `site.${firstWord}`
}

/**
 * Validate raw data from storage and return a typed SiteDocument, or throw
 * SiteValidationError describing exactly which field failed.
 *
 * Usage:
 * ```ts
 * const raw = await adapter.loadSite(id)
 * const site = validateSite(raw)   // throws if corrupt
 * store.loadSite(site)
 * ```
 */
export function validateSite(raw: unknown): SiteDocument {
  // TODO(2026-06-05): delete both converters below. Pre-release flux period ended;
  // all dev DBs have been re-saved with the new shape.
  convertLegacyVCShape(raw)
  convertLegacySlotContent(raw)

  let site: SiteDocument
  try {
    site = parseSiteDocument(raw)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid site'
    throw new SiteValidationError(message, extractSiteErrorPath(message))
  }
  return runDomainPostChecks(site)
}

/**
 * Walk a node's props and sanitize richtext-keyed values in-place.
 * Operates on a single flat node — no childNodes recursion (VC trees are now flat).
 */
function sanitizeNodeProps(node: unknown): void {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return
  const n = node as { props?: Record<string, unknown> }
  if (n.props && typeof n.props === 'object') {
    for (const [key, val] of Object.entries(n.props)) {
      if (isRichtextPropKey(key) && typeof val === 'string') {
        n.props[key] = sanitizeRichtext(val)
      }
    }
  }
}

/**
 * Drop VisualComponents that form dependency cycles.
 * Uses DFS cycle detection on the componentRef graph.
 */
function filterCyclicVCs(vcs: SiteDocument['visualComponents']): SiteDocument['visualComponents'] {
  const vcMap = new Map(vcs.map((vc) => [vc.id, vc]))
  const cyclic = new Set<string>()
  const visited = new Set<string>()
  const inStack = new Set<string>()

  function dfs(id: string): boolean {
    if (inStack.has(id)) { cyclic.add(id); return true }
    if (visited.has(id)) return cyclic.has(id)
    visited.add(id)
    inStack.add(id)
    const vc = vcMap.get(id)
    if (vc) {
      for (const refId of getReferencedComponentIds(vc)) {
        if (dfs(refId)) cyclic.add(id)
      }
    }
    inStack.delete(id)
    return cyclic.has(id)
  }

  for (const vc of vcs) dfs(vc.id)
  return vcs.filter((vc) => !cyclic.has(vc.id))
}

// ---------------------------------------------------------------------------
// Domain post-checks
// ---------------------------------------------------------------------------

function runDomainPostChecks(site: SiteDocument): SiteDocument {
  // 1 & 2: Page slug syntax + uniqueness
  for (let i = 0; i < site.pages.length; i++) {
    const { slug, id } = site.pages[i]
    const slugErr = pageSlugError(slug)
    if (slugErr) throw new SiteValidationError(slugErr, `site.pages[${i}].slug`)
    const dupErr = pageSlugDuplicateError(slug, site.pages, id)
    if (dupErr) throw new SiteValidationError(`duplicate slug: ${dupErr}`, `site.pages[${i}].slug`)
  }

  // Referential integrity: rootNodeId must exist in the page's nodes map
  for (let i = 0; i < site.pages.length; i++) {
    const page = site.pages[i]
    if (!page.nodes[page.rootNodeId]) {
      throw new SiteValidationError(
        `rootNodeId "${page.rootNodeId}" not found in nodes`,
        `site.pages[${i}].rootNodeId`,
      )
    }
  }

  // 3: SiteFile path safety + deduplication (first-wins on normalized path)
  const seenPaths = new Set<string>()
  site.files = site.files.filter((file) => {
    const normalized = normalizePath(file.path)
    if (!isSafePath(normalized) || seenPaths.has(normalized)) return false
    seenPaths.add(normalized)
    file.path = normalized
    return true
  })

  // 4: VC name validation + deduplication (first-wins on name)
  const seenVCNames = new Set<string>()
  site.visualComponents = site.visualComponents.filter((vc) => {
    if (!validateComponentName(vc.name, []).ok) return false
    if (seenVCNames.has(vc.name)) return false
    seenVCNames.add(vc.name)
    return true
  })

  // 5: VC recursion prevention — drop VCs that form dependency cycles
  site.visualComponents = filterCyclicVCs(site.visualComponents)

  // 5b: Passive slot sync — idempotent reconciliation of slot-instance children
  // on every VC ref. Runs after VC filtering so we only reference live VCs.
  // This fixes any slot-instance drift that may have occurred before Task 4 was
  // wired into all mutation paths (e.g. legacy data, direct DB edits).
  {
    const vcById = new Map(site.visualComponents.map((vc) => [vc.id, vc]))
    for (const page of site.pages) {
      for (const node of Object.values(page.nodes)) {
        if (node.moduleId !== 'base.visual-component-ref') continue
        const componentId = node.props.componentId
        if (typeof componentId !== 'string' || !componentId) continue
        const vc = vcById.get(componentId)
        if (!vc) continue
        const treeNodes = page.nodes as Record<string, BaseNode>
        const syncResult = syncSlotInstances(node as BaseNode, vc, treeNodes)
        if (syncResult.ops.length > 0 || Object.keys(syncResult.newNodes).length > 0) {
          applySlotSyncResult(treeNodes, syncResult, node.id)
        }
      }
    }
  }

  // 6: Richtext sanitization — page nodes (flat map) and VC node trees (flat map)
  for (const page of site.pages) {
    for (const node of Object.values(page.nodes)) sanitizeNodeProps(node)
  }
  for (const vc of site.visualComponents) {
    for (const node of Object.values(vc.tree.nodes)) sanitizeNodeProps(node)
  }

  // 7: SitePackageJson name sanitization (filters unsafe npm package names)
  site.packageJson = normalizeSitePackageJson(site.packageJson)

  // 8: SiteRuntimeConfig normalization (filters unsafe names in dep-lock, normalizes scripts)
  site.runtime = normalizeSiteRuntimeConfig(site.runtime)

  // 9: Framework color slug normalization + default dark color generation
  if (site.settings.framework?.colors) {
    site.settings.framework.colors.tokens = site.settings.framework.colors.tokens.map((token) => ({
      ...token,
      slug: normalizeFrameworkColorSlug(token.slug),
      darkValue: token.darkValue || generateDefaultDarkColor(token.lightValue),
    }))
  }

  return site
}
