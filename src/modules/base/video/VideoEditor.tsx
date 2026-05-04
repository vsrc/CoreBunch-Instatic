/**
 * base.video editor preview component.
 *
 * Component-only file so React Fast Refresh can hot-patch edits without
 * re-running module registration. Per Constraint #309, this file MUST NOT
 * export non-component values — `youtubeEmbedUrl` is duplicated in
 * `index.ts` for the publisher render path.
 */
import React from 'react'
import type { ModuleComponentProps } from '@core/module-engine/types'
import { cn } from '@ui/cn'
import styles from './video.module.css'

interface VideoProps extends Record<string, unknown> {
  source: 'media' | 'youtube' | 'url'
  youtubeId: string
  videoUrl: string
  autoplay: boolean
  loop: boolean
  muted: boolean
  controls: boolean
}

function youtubeEmbedUrl(id: unknown, autoplay: unknown): string {
  const safeId = encodeURIComponent(String(id ?? '').trim())
  if (!safeId) return ''
  return `https://www.youtube.com/embed/${safeId}${autoplay ? '?autoplay=1' : ''}`
}

export const VideoEditor: React.FC<ModuleComponentProps<VideoProps>> = ({ props, mcClassName }) => {
  const isYoutube = props.source === 'youtube'
  const sourceUrl = isYoutube
    ? youtubeEmbedUrl(props.youtubeId, props.autoplay)
    : props.videoUrl

  if (!sourceUrl) {
    return (
      <div className={cn(styles.placeholder, mcClassName)}>
        <span className={styles.playIcon}>Play</span>
        <span>{isYoutube ? 'YouTube ID required' : 'Video URL required'}</span>
      </div>
    )
  }

  if (isYoutube) {
    return (
      <iframe
        className={mcClassName}
        src={sourceUrl}
        title="YouTube video"
        frameBorder="0"
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
      />
    )
  }

  return (
    <video
      className={mcClassName}
      src={sourceUrl}
      autoPlay={props.autoplay}
      loop={props.loop}
      muted={props.muted}
      controls={props.controls}
    />
  )
}
