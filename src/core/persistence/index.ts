export type { IPersistenceAdapter, ProjectSummary } from './types'
export { LocalAdapter, localAdapter } from './local'
export { CmsAdapter, cmsAdapter } from './cms'
export { publishCmsDraft } from './cmsPublish'
export type { CmsPublishResult } from './cmsPublish'
export { getCmsSetupStatus, loginCms, logoutCms, probeCmsSession, setupCms } from './cmsAuth'
export type { CmsLoginInput, CmsSetupInput, CmsSetupStatus } from './cmsAuth'
export { validateProject, ValidationError } from './validate'
// usePersistence moved to src/editor/hooks/usePersistence.ts (Constraint #179 — no React in core)
