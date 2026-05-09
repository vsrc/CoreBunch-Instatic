/**
 * AdminPageLayout — the lightweight admin shell for non-editor pages.
 *
 * One of the two top-level admin layouts in `src/admin/layouts/`:
 *   - AdminCanvasLayout — used by the Site editor and the Content
 *     workspace. Carries the floating editor panels, the page canvas, the
 *     DnD context, and the per-workspace sidebars.
 *   - AdminPageLayout (this file) — used by Plugins, Users, Account, and
 *     plugin admin pages. Strips the canvas / sidebar / DnD chrome and
 *     renders a simple centered page body with a unified header (title,
 *     description, optional tabs and actions slots).
 *
 * Pick AdminCanvasLayout when the page IS the editor canvas. Pick this
 * layout when the page is a regular admin page (lists, forms, settings)
 * that doesn't need the editor machinery — rendering those through the
 * canvas layout stacked five empty wrapper divs around the actual content.
 *
 * What this layout provides:
 *  - The same fixed Toolbar at the top (so the section navigation, settings
 *    button, and any per-page toolbar action match the editor).
 *  - A scrollable, centered page body with a single, consistent max-width
 *    and padding so every page feels the same.
 *  - A consistent page header with title, description, and slots for tabs
 *    and primary actions (e.g. "Upload Plugin").
 *  - The site hydrate / plugin event bridge / installed-editor-plugins
 *    refresh that AdminCanvasLayout runs — these are required for the
 *    toolbar site name and the Plugins nav badge regardless of which
 *    workspace the user is on.
 *  - The Settings modal portal (mounted alongside Toolbar so the cog
 *    button keeps working on every admin page).
 */
import { type ReactNode } from 'react'
import { cmsAdapter } from '@core/persistence'
import { Toolbar } from '@site/toolbar'
import { SettingsButton } from '@site/toolbar/SettingsButton'
import { useEditorLayoutPersistence } from '@site/hooks/useEditorLayoutPersistence'
import { usePersistence } from '@site/hooks/usePersistence'
import { SettingsModal } from '@admin/modals/Settings'
import { AdminSectionNavigation } from '@admin/shared/AdminSectionNavigation'
import { useEditorSelectPreference } from '@site/preferences/editorPreferences'
import { useInstalledEditorPlugins } from '@admin/pages/plugins/hooks/useInstalledEditorPlugins'
import { usePluginEventBridge } from '@admin/pages/plugins/hooks/usePluginEventBridge'
import { useCurrentAdminUser } from '@admin/sessionContext'
import type { AdminWorkspace } from '@admin/workspace'
import styles from './AdminPageLayout.module.css'

interface AdminPageLayoutProps {
  /** Active section — drives the toolbar's nav highlight. */
  workspace: AdminWorkspace
  /** Page title rendered in the H1 of the page header. */
  title: string
  /** Optional description shown under the title. */
  description?: string
  /**
   * Optional tab buttons. Rendered to the right of the title block, before
   * `actions`. Pass a row of `<Button>` components — the layout only handles
   * positioning; the page owns selected-state and click handling.
   */
  tabs?: ReactNode
  /**
   * Optional primary actions (e.g. "Upload Plugin", "Create User"). Rendered
   * to the right of the tabs.
   */
  actions?: ReactNode
  /**
   * Optional extra toolbar items rendered in the toolbar's right slot. The
   * Settings cog is always appended automatically — pages should not pass
   * their own SettingsButton here.
   */
  toolbarRightSlot?: ReactNode
  /** Optional id for the H1 — useful for `aria-labelledby` on the body. */
  titleId?: string
  /** Page body. */
  children?: ReactNode
}

export function AdminPageLayout({
  workspace,
  title,
  description,
  tabs,
  actions,
  toolbarRightSlot,
  titleId,
  children,
}: AdminPageLayoutProps) {
  // Hydrate the same editor side-effects AdminCanvasLayout runs. The toolbar
  // reads the site name from the editor store, and the Plugins nav badge /
  // event bridge needs to be live on every admin tab — otherwise
  // hard-refreshing on /admin/account would show "Untitled Site" until the
  // user navigated back to /admin/site at least once.
  usePersistence('default', cmsAdapter, {
    markNewSiteUnsaved: true,
    enabled: true,
  })
  useEditorLayoutPersistence()
  useInstalledEditorPlugins()
  usePluginEventBridge()

  const currentUser = useCurrentAdminUser()
  const density = useEditorSelectPreference('density')

  const rightSlot = (
    <>
      {toolbarRightSlot}
      <SettingsButton />
    </>
  )

  return (
    <div className={styles.shell} data-editor-density={density}>
      <Toolbar
        section={workspace}
        adminNavigationSlot={(
          <AdminSectionNavigation
            section={workspace}
            currentUser={currentUser}
          />
        )}
        rightSlot={rightSlot}
      />

      <main className={styles.body}>
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.titleGroup}>
              <h1 id={titleId}>{title}</h1>
              {description && <p>{description}</p>}
            </div>
            {(tabs || actions) && (
              <div className={styles.headerEnd}>
                {tabs && (
                  <div className={styles.tabs}>{tabs}</div>
                )}
                {actions && (
                  <div className={styles.actions}>{actions}</div>
                )}
              </div>
            )}
          </header>
          {children}
        </div>
      </main>

      <SettingsModal />
    </div>
  )
}
