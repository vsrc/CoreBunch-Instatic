import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import type { AnyModuleDefinition } from '@core/module-engine/types'
import { createModuleImportMap } from '@core/module-engine/runtimeResolver'
import {
  getMissingModuleDependencies,
  normalizeModuleDependencies,
} from '@core/module-engine/dependencies'
import type { SiteDocument } from '@core/page-tree/schemas'
import { useEditorStore } from '@site/store/store'
import { Button } from '@ui/components/Button'
import { CanvasModulePlaceholder } from '@ui/components/CanvasModulePlaceholder'
import { PackageSolidIcon } from 'pixel-art-icons/icons/package-solid'
import { cn } from '@ui/cn'
import { generateClassCSS } from '@core/publisher/classCss'
import {
  createSandboxSrcDoc,
  HOST_MESSAGE_SOURCE,
  SANDBOX_MESSAGE_SOURCE,
  type SandboxContext,
} from './moduleSandboxSrcDoc'
import styles from './ModuleSandboxFrame.module.css'

interface ModuleSandboxFrameProps {
  moduleDefinition: AnyModuleDefinition
  props: Record<string, unknown>
  nodeId: string
  isSelected: boolean
  mcClassName?: string
  classIds?: string[]
}

interface SandboxUpdatePayload {
  context: SandboxContext
  classCSS: string
}

function getNodeClassCSS(site: SiteDocument | null, classIds: string[] | undefined): string {
  if (!site || !classIds?.length) return ''

  const classes: SiteDocument['classes'] = {}
  for (const id of classIds) {
    const cls = site.classes[id]
    if (cls) classes[id] = cls
  }

  if (Object.keys(classes).length === 0) return ''
  return generateClassCSS(classes, site.breakpoints)
}

export function ModuleSandboxFrame({
  moduleDefinition,
  props,
  nodeId,
  isSelected,
  mcClassName,
  classIds,
}: ModuleSandboxFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const updateFrameRef = useRef<number | null>(null)
  const pendingUpdateRef = useRef<SandboxUpdatePayload | null>(null)
  const site = useEditorStore((s) => s.site)
  const packageJson = useEditorStore((s) => s.packageJson)
  const selectNode = useEditorStore((s) => s.selectNode)
  const setFocusedPanel = useEditorStore((s) => s.setFocusedPanel)
  const setDependency = useEditorStore((s) => s.setDependency)
  const setDependenciesPanelOpen = useEditorStore((s) => s.setDependenciesPanelOpen)
  const runtime = moduleDefinition.editorRuntime?.sandbox

  // Dependencies the module declares but the site hasn't installed yet.
  // The iframe's import map is built with `strictSiteManifest: true` —
  // missing deps would surface as a raw `TypeError: Failed to resolve
  // module specifier` inside the iframe. Show a friendlier empty state
  // (with a one-click "add" affordance) before mounting the iframe at all.
  const missingDependencies = useMemo(
    () => getMissingModuleDependencies(moduleDefinition, packageJson),
    [moduleDefinition, packageJson],
  )

  const classCSS = useMemo(
    () => getNodeClassCSS(site, classIds),
    [site, classIds],
  )

  // The iframe's import map is filtered from the site's precomputed
  // `runtime.packageImportmap` — the server built it from the actual
  // `bun install` cache when the user resolved their deps, so the URLs
  // point at the host's own `/_pb/runtime/cache/...` route. Plugin code
  // never names a CDN: `import * as THREE from 'three'` resolves to the
  // same on-disk file the published page uses.
  const siteImportmap = useEditorStore((s) => s.siteRuntime.packageImportmap)
  const dependencyResolveStatus = useEditorStore((s) => s.dependencyResolveStatus)
  const importMap = useMemo(
    () => createModuleImportMap(moduleDefinition, {
      packageJson,
      strictSiteManifest: true,
      siteImportmap,
    }),
    [moduleDefinition, packageJson, siteImportmap],
  )
  // Importmap is incomplete if any runtime dep declared by this module is
  // missing from `importMap.imports`. That's the case after opening a site
  // whose persisted state predates the importmap field, or while the
  // background auto-resolve is still installing. We refuse to mount the
  // iframe in that state so the user sees a clear "resolving" message
  // instead of a "Failed to resolve module specifier" runtime error.
  const importmapIncomplete = useMemo(() => {
    const runtimeDeps = normalizeModuleDependencies(moduleDefinition.dependencies)
      .filter((dep) => !dep.dev)
    if (runtimeDeps.length === 0) return false
    return runtimeDeps.some((dep) => !importMap.imports[dep.name])
  }, [moduleDefinition.dependencies, importMap])

  const sandboxContext = useMemo<SandboxContext>(
    () => ({
      props,
      nodeId,
      isSelected,
      className: mcClassName ?? '',
      dependencies: importMap.imports,
      apiVersion: 1,
    }),
    [props, nodeId, isSelected, mcClassName, importMap],
  )

  const srcDoc = useMemo(() => {
    if (!runtime) return ''

    return createSandboxSrcDoc({
      title: `${moduleDefinition.name} preview`,
      source: runtime.source,
      importMap,
      context: sandboxContext,
      classCSS,
    })
    // The iframe document must stay mounted while props/class styles change.
    // Those values are delivered by postMessage below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, moduleDefinition.name, importMap, sandboxContext.nodeId])

  const flushUpdate = useCallback(() => {
    const payload = pendingUpdateRef.current
    if (!payload) return

    pendingUpdateRef.current = null
    iframeRef.current?.contentWindow?.postMessage({
      source: HOST_MESSAGE_SOURCE,
      type: 'update',
      context: payload.context,
      classCSS: payload.classCSS,
    }, '*')
  }, [])

  const scheduleUpdate = useCallback(() => {
    pendingUpdateRef.current = { context: sandboxContext, classCSS }
    if (updateFrameRef.current !== null) return

    updateFrameRef.current = window.requestAnimationFrame(() => {
      updateFrameRef.current = null
      flushUpdate()
    })
  }, [sandboxContext, classCSS, flushUpdate])

  const postUpdate = useCallback(() => {
    pendingUpdateRef.current = { context: sandboxContext, classCSS }
    if (updateFrameRef.current !== null) {
      window.cancelAnimationFrame(updateFrameRef.current)
      updateFrameRef.current = null
    }
    flushUpdate()
  }, [sandboxContext, classCSS, flushUpdate])

  useEffect(() => {
    scheduleUpdate()
  }, [scheduleUpdate])

  useEffect(() => () => {
    if (updateFrameRef.current !== null) {
      window.cancelAnimationFrame(updateFrameRef.current)
      updateFrameRef.current = null
    }
  }, [])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return

      const message = event.data as { source?: string; type?: string; nodeId?: string } | null
      if (!message || message.source !== SANDBOX_MESSAGE_SOURCE || message.nodeId !== nodeId) return

      if (message.type === 'pointerdown' || message.type === 'dblclick') {
        selectNode(nodeId)
        setFocusedPanel('canvas')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [nodeId, selectNode, setFocusedPanel])

  if (!runtime) {
    return (
      <div className={styles.fallback}>
        Missing sandbox runtime for {moduleDefinition.name}
      </div>
    )
  }

  // Importmap not yet populated for this module's runtime deps —
  // `useAutoResolveDependencies` triggers a fresh resolve in the
  // background; mount nothing until the URLs land.
  if (importmapIncomplete && missingDependencies.length === 0) {
    const status = dependencyResolveStatus === 'error'
      ? 'Dependency resolve failed — open the Dependencies panel to retry.'
      : 'Resolving runtime packages…'
    return (
      <CanvasModulePlaceholder
        className={mcClassName}
        icon={<PackageSolidIcon size={16} color="currentColor" />}
        label={`${moduleDefinition.name} is preparing`}
        description={status}
      />
    )
  }

  if (missingDependencies.length > 0) {
    const packagesLabel = missingDependencies
      .map((dep) => `${dep.name}@${dep.version}`)
      .join(', ')
    const buttonLabel = missingDependencies.length === 1
      ? `Add ${missingDependencies[0]!.name}`
      : `Add ${missingDependencies.length} packages`
    // Collapse to the placeholder's natural height — the iframe's
    // `minHeight` was sized for the live preview (320–360 px), which leaves
    // an empty white band below a short placeholder. Letting the empty
    // state size itself reads cleanly and matches the rest of the canvas
    // placeholder modules (container, image, loop).
    return (
      <CanvasModulePlaceholder
        className={mcClassName}
        icon={<PackageSolidIcon size={16} color="currentColor" />}
        label={
          missingDependencies.length === 1
            ? `${moduleDefinition.name} needs 1 package`
            : `${moduleDefinition.name} needs ${missingDependencies.length} packages`
        }
        description={packagesLabel}
        actions={
          <Button
            variant="primary"
            size="xs"
            data-testid="module-sandbox-missing-deps-add"
            onClick={() => {
              for (const dep of missingDependencies) {
                setDependency(dep.name, dep.version, dep.dev)
              }
              setDependenciesPanelOpen(true)
            }}
          >
            {buttonLabel}
          </Button>
        }
      />
    )
  }

  return (
    <div
      className={cn(styles.frame, mcClassName)}
      style={{ '--module-sandbox-min-height': `${runtime.minHeight ?? 360}px` } as CSSProperties}
    >
      <iframe
        ref={iframeRef}
        title={`${moduleDefinition.name} sandbox preview`}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        srcDoc={srcDoc}
        onLoad={postUpdate}
        className={styles.iframe}
      />
    </div>
  )
}
