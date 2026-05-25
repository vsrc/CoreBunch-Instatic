/**
 * Plugins widget — list of installed plugins with their status dot
 * (active / disabled / error). Data comes from `usePluginsStats()`,
 * its own per-widget endpoint — fires in parallel with the rest of the
 * dashboard's data hooks and unblocks as soon as `installed_plugins`
 * has been scanned.
 */
import { PlugSolidIcon } from 'pixel-art-icons/icons/plug-solid'
import type { DashboardWidgetRendererProps } from '@core/dashboard'
import { Widget } from '@ui/components/Widget'
import { Skeleton, SkeletonCircle } from '@ui/components/Skeleton'
import { usePluginsStats, type DashboardPluginRow } from '../hooks/useDashboardStats'
import styles from './widgets.module.css'

function dotClass(state: DashboardPluginRow['state']): string {
  if (state === 'active') return styles.dotGreen
  if (state === 'error') return styles.dotAmber
  return styles.dotMuted
}

function stateLabel(state: DashboardPluginRow['state']): string {
  if (state === 'active') return 'active'
  if (state === 'error') return 'error'
  return 'off'
}

// Number of skeleton rows to render while loading — matches the
// typical fresh-install row count (a few first-party + Analytics).
const SKELETON_ROWS = 4

export function PluginsWidget({ span, editing }: DashboardWidgetRendererProps) {
  const stats = usePluginsStats()
  const isLoading = stats === null
  const plugins = stats?.rows ?? []
  const isEmpty = !isLoading && plugins.length === 0

  return (
    <Widget
      widgetId="plugins"
      title="Plugins"
      icon={PlugSolidIcon}
      tint="mint"
      span={span}
      editing={editing}
      loading={isLoading}
    >
      <div>
        {isLoading && Array.from({ length: SKELETON_ROWS }, (_, i) => (
          // Skeleton row matches the real `.pluginRow` layout
          // (icon, name+version, state dot+label) so when data lands
          // the row positions are unchanged.
          <div key={i} className={styles.pluginRow}>
            <SkeletonCircle size={20} />
            <span className={styles.pluginName}>
              <Skeleton width={120} height="0.9em" />
              <small style={{ marginTop: 2, display: 'inline-block' }}>
                <Skeleton width={40} height="0.8em" />
              </small>
            </span>
            <Skeleton width={50} height="0.8em" />
          </div>
        ))}
        {isEmpty && (
          <p className={styles.feedTime} style={{ padding: '12px 0' }}>
            No plugins installed yet.
          </p>
        )}
        {!isLoading && plugins.map((p) => (
          <div key={p.id} className={styles.pluginRow}>
            <span className={styles.pluginIcon}>
              <PlugSolidIcon size={12} aria-hidden="true" />
            </span>
            <span className={styles.pluginName}>
              {p.name}
              <small>v{p.version}</small>
            </span>
            <span className={styles.wlistMeta}>
              <span className={`${styles.dot} ${dotClass(p.state)}`} />
              {stateLabel(p.state)}
            </span>
          </div>
        ))}
      </div>
    </Widget>
  )
}
