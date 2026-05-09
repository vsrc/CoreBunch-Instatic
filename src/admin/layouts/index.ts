/**
 * Admin layouts — pick one of these as the root of any admin page:
 *
 *   - AdminCanvasLayout: the editor canvas shell (Site, Content). Carries
 *     floating editor panels, the page canvas, the DnD context wired to
 *     the SiteExplorer, and the per-workspace sidebars.
 *   - AdminPageLayout: the lightweight admin-page shell (Plugins, Users,
 *     Account, plugin admin pages). Just toolbar + a centered, scrollable
 *     page body with a unified header (title, description, optional tabs
 *     and actions slots).
 *
 * If a new admin page IS the editor canvas, use AdminCanvasLayout.
 * Otherwise — lists, forms, settings, dashboards — use AdminPageLayout.
 */
export { AdminCanvasLayout } from './AdminCanvasLayout'
export { AdminPageLayout } from './AdminPageLayout'
