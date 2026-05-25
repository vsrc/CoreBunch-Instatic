/**
 * Skeleton — animated placeholder shape rendered while async data loads.
 *
 * Surfaces a shimmering rectangle whose dimensions match the final
 * content's footprint, so the transition from "loading" to "loaded"
 * does not cause layout shift. The shimmer is a horizontally-translated
 * gradient over `--editor-surface-3`; `prefers-reduced-motion` users get
 * a static fill (no animation).
 *
 * Use:
 *
 *   ```tsx
 *   {isLoading ? <Skeleton width="80px" height="24px" /> : <strong>{count}</strong>}
 *   ```
 *
 * Variants:
 *   - `Skeleton`        — bare rectangle, you control width / height
 *   - `SkeletonText`    — N stacked lines (varies the last line's width
 *                         to feel less mechanical)
 *   - `SkeletonCircle`  — radius-50% rect, for avatar / thumbnail slots
 *
 * Design tokens only — `--editor-surface-3` (base), `--editor-surface-4`
 * (shimmer highlight). Never hardcoded colours; the skeleton tracks
 * the theme like the rest of the editor surface.
 */
import type { CSSProperties } from 'react'
import { cn } from '@ui/cn'
import styles from './Skeleton.module.css'

export interface SkeletonProps {
  /** Width — any CSS length. `'100%'` to fill the parent. */
  width?: string | number
  /** Height — any CSS length. Defaults to `'1em'` (matches surrounding text). */
  height?: string | number
  /**
   * Border radius. Defaults to `--editor-radius-sm` (3 px). Pass
   * `'50%'` for a circular slot (or use `SkeletonCircle`).
   */
  radius?: string | number
  /** Optional className escape hatch (layout positioning, margin, etc.). */
  className?: string
  /**
   * Inline style escape hatch. Use sparingly — prefer the width / height /
   * radius props. Inline styles are accepted because skeleton dimensions
   * are often computed at render time (e.g. `width: someCount * 8`).
   */
  style?: CSSProperties
  /**
   * `aria-label` for screen readers. Defaults to nothing — skeletons
   * carry no semantic content; the surrounding wrapper should announce
   * its own `aria-busy="true"` instead.
   */
  ariaLabel?: string
}

function toLen(v: string | number | undefined, fallback: string): string {
  if (v === undefined) return fallback
  if (typeof v === 'number') return `${v}px`
  return v
}

export function Skeleton({
  width = '100%',
  height = '1em',
  radius,
  className,
  style,
  ariaLabel,
}: SkeletonProps) {
  const computedStyle: CSSProperties = {
    width: toLen(width, '100%'),
    height: toLen(height, '1em'),
    borderRadius: toLen(radius, 'var(--editor-radius-sm)'),
    ...style,
  }
  return (
    <span
      className={cn(styles.skeleton, className)}
      style={computedStyle}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? 'status' : undefined}
    />
  )
}

export interface SkeletonTextProps {
  /** Number of lines to render. Defaults to 3. */
  lines?: number
  /** Optional className for the wrapping container. */
  className?: string
  /**
   * Spacing between lines, in pixels. Defaults to 8 — matches the
   * dashboard widget's natural row gap.
   */
  gap?: number
  /** Per-line height (any CSS length). Defaults to `'0.9em'`. */
  lineHeight?: string | number
}

/**
 * Stacked text skeleton. The last line is rendered at ~60 % width so the
 * group reads as a paragraph rather than a perfectly-aligned block —
 * less robotic, more "natural text shape".
 */
export function SkeletonText({
  lines = 3,
  className,
  gap = 8,
  lineHeight = '0.9em',
}: SkeletonTextProps) {
  const items = Array.from({ length: Math.max(1, lines) }, (_, i) => i)
  return (
    <div className={cn(styles.textGroup, className)} style={{ gap: `${gap}px` }}>
      {items.map((i) => {
        const isLast = i === items.length - 1 && items.length > 1
        return (
          <Skeleton
            key={i}
            width={isLast ? '62%' : '100%'}
            height={lineHeight}
          />
        )
      })}
    </div>
  )
}

export interface SkeletonCircleProps {
  /** Diameter in px (sets both width and height). */
  size: number
  /** Optional className escape hatch. */
  className?: string
}

/**
 * Circular skeleton — for avatars, plug-status dots, image thumbnails
 * intended to read as round.
 */
export function SkeletonCircle({ size, className }: SkeletonCircleProps) {
  return (
    <Skeleton width={size} height={size} radius="50%" className={className} />
  )
}
