/**
 * Pages widget — total published / drafts / scheduled counts pulled
 * from `usePagesStats()`. The "+N this week" delta reads
 * `deltaPublishedThisWeek` from the server-side count of pages
 * whose `published_at` is within the trailing 7 days.
 */
import { FileTextSolidIcon } from 'pixel-art-icons/icons/file-text-solid'
import { StatValue, Delta } from '@ui/components/charts'
import type { DashboardWidgetRendererProps } from '@core/dashboard'
import { Widget } from '@ui/components/Widget'
import { Skeleton } from '@ui/components/Skeleton'
import { usePagesStats } from '../hooks/useDashboardStats'
import styles from './widgets.module.css'

export function PagesWidget({ span, editing }: DashboardWidgetRendererProps) {
  const stats = usePagesStats()
  const isLoading = stats === null

  return (
    <Widget
      widgetId="pages"
      title="Pages"
      icon={FileTextSolidIcon}
      tint="lilac"
      span={span}
      editing={editing}
      loading={isLoading}
    >
      {isLoading ? (
        <>
          {/* Skeleton matches the StatValue + sub-row + footer layout
              so when data lands the layout doesn't shift. The big
              number gets 48px of height (matches StatValue's `value`
              font-size at the widget's typical density). */}
          <Skeleton width={72} height={32} />
          <Skeleton width="55%" height="0.9em" />
          <div className={styles.subFootRow}>
            <Skeleton width={72} height="0.85em" />
            <Skeleton width={88} height="0.85em" />
          </div>
        </>
      ) : (
        <>
          <StatValue
            value={stats.published.toLocaleString()}
            sub={(
              <>
                <span>Published</span>
                {stats.deltaPublishedThisWeek > 0 && (
                  <Delta>+{stats.deltaPublishedThisWeek} this week</Delta>
                )}
              </>
            )}
          />
          <div className={styles.subFootRow}>
            <span>{stats.drafts} draft{stats.drafts === 1 ? '' : 's'}</span>
            <span>{stats.scheduled} scheduled</span>
          </div>
        </>
      )}
    </Widget>
  )
}
