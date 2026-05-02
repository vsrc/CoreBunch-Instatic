import type { SiteFile } from '../files/types'
import type { Page } from '../page-tree/types'

export interface LockedSiteDependency {
  name: string
  requested: string
  version: string
  integrity?: string
  tarballUrl?: string
  resolvedAt: number
}

export interface SiteDependencyLock {
  version: 1
  packages: Record<string, LockedSiteDependency>
  updatedAt: number
}

export type SiteScriptPlacement = 'head' | 'body-end'
export type SiteScriptTiming = 'immediate' | 'dom-ready' | 'idle'

export type SiteScriptScope =
  | { type: 'all-pages' }
  | { type: 'pages'; pageIds: string[] }
  | { type: 'templates'; templatePageIds: string[] }

export interface SiteScriptRuntimeConfig {
  enabled: boolean
  runInCanvas: boolean
  placement: SiteScriptPlacement
  timing: SiteScriptTiming
  scope: SiteScriptScope
  priority: number
}

export interface SiteRuntimeConfig {
  dependencyLock: SiteDependencyLock
  scripts: Record<string, SiteScriptRuntimeConfig>
}

export type SiteRuntimeTarget = 'canvas' | 'publish'

export interface RuntimeScriptEntry {
  file: SiteFile
  config: SiteScriptRuntimeConfig
}

export interface CollectRuntimeScriptsInput {
  files: SiteFile[]
  runtime: SiteRuntimeConfig
  page: Page
  target: SiteRuntimeTarget
}

export type SiteRuntimeDiagnosticSeverity = 'error' | 'warning' | 'info'

export interface SiteRuntimeDiagnostic {
  code: string
  severity: SiteRuntimeDiagnosticSeverity
  message: string
  fileId?: string
  path?: string
  line?: number
  column?: number
  packageName?: string
}
