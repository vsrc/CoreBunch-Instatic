/**
 * DashboardGrid — 12-column / fixed-row-height widget grid with explicit
 * per-cell placement and free-position drag-and-drop.
 *
 * Layout model
 * ------------
 * Each `DashboardItem` carries `{ col, row, size, rows }` — explicit grid
 * coordinates. The CSS sets `grid-column: col / span size` and
 * `grid-row: row / span rows` on every cell, so widgets stay exactly
 * where the user puts them. The grid does NOT use `grid-auto-flow` —
 * gaps between widgets are honoured.
 *
 * Drag-to-move
 * ------------
 * One grid-wide droppable instead of per-cell drop zones — on drop, the
 * handler reads the dragged element's translated bounding rect, snaps
 * the top-left corner to the nearest grid cell, and calls `onMove(id,
 * col, row)`. The hook's collision resolver pushes any overlapping
 * siblings downward while keeping the dropped widget pinned at the
 * landing cell.
 *
 * Resize
 * ------
 * Same per-side handle model as before (left / right / top / bottom +
 * corner). The hook applies collision resolution after each resize so
 * neighbouring cards slide down to make room.
 *
 * Resize / move snap math (column width, row height) is mirrored from
 * `useDashboardLayout.ts` so the JS handlers and CSS grid track sizes
 * stay in lockstep.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { PlusIcon } from 'pixel-art-icons/icons/plus'
import type { DashboardWidgetDefinition } from '@core/dashboard'
import { Button } from '@ui/components/Button'
import { cn } from '@ui/cn'
import {
  EDITING_GRID_GAP,
  GRID_ROW_HEIGHT,
  MAX_COLS,
  MAX_ROWS,
  MIN_COLS,
  MIN_ROWS,
  type DashboardItem,
} from '../hooks/useDashboardLayout'
import styles from './DashboardGrid.module.css'

const GRID_DROP_ID = '__dashboard_grid__'

function clampSize(size: number, min: number, max: number): number {
  if (size < min) return min
  if (size > max) return max
  return Math.round(size)
}

export interface DashboardGridProps {
  items: readonly DashboardItem[]
  /** Definitions keyed by id (registry snapshot). */
  definitions: ReadonlyMap<string, DashboardWidgetDefinition>
  editing: boolean
  onMove: (id: string, col: number, row: number) => void
  onResize: (id: string, size: number) => void
  onResizeRows: (id: string, rows: number) => void
  onAddBlock: () => void
}

export function DashboardGrid({
  items,
  definitions,
  editing,
  onMove,
  onResize,
  onResizeRows,
  onAddBlock,
}: DashboardGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    const itemId = event.active.id as string
    const item = items.find((i) => i.id === itemId)
    const grid = gridRef.current
    const draggedRect = event.active.rect.current.translated
    if (!item || !grid || !draggedRect) return

    const gridRect = grid.getBoundingClientRect()
    // One column track = (gridWidth - 11 gaps) / 12. The "step" from
    // one column start to the next is `colTrack + gap` — that's what
    // we divide the drop X offset by so each pointer-pixel maps cleanly
    // to a column index. Same shape for rows: `--row-h + gap`.
    //
    // We use `EDITING_GRID_GAP` here (not `GRID_GAP`) because drag-
    // and-drop only fires in customize mode, where the CSS widens the
    // gap to 16px for handle accessibility. The snap math has to use
    // the same value the layout actually rendered with, or the dropped
    // card lands a column off after a few rows of drift.
    const colTrack = (gridRect.width - (MAX_COLS - 1) * EDITING_GRID_GAP) / MAX_COLS
    const colStep = colTrack + EDITING_GRID_GAP
    const rowStep = GRID_ROW_HEIGHT + EDITING_GRID_GAP

    const offsetX = draggedRect.left - gridRect.left
    const offsetY = draggedRect.top - gridRect.top

    // `round` snaps to the nearest column / row line rather than
    // `floor`-ing, which feels closer to where the user "aimed" the
    // drop. Clamp into the legal range so the widget stays inside the
    // grid and within the 12-col bound when accounting for its width.
    const rawCol = Math.round(offsetX / colStep) + 1
    const rawRow = Math.round(offsetY / rowStep) + 1
    const targetCol = Math.max(1, Math.min(MAX_COLS - item.size + 1, rawCol))
    const targetRow = Math.max(1, rawRow)

    onMove(itemId, targetCol, targetRow)
  }

  /**
   * The "Add block" tile sits in the next row below the lowest widget.
   * We compute it from the max (row + rows) of the items so dropping a
   * widget further down doesn't leave the Add tile stranded mid-grid.
   */
  const addBlockRow = items.reduce(
    (max, item) => Math.max(max, item.row + item.rows),
    1,
  )

  const draggingDef = draggingId ? definitions.get(draggingId) ?? null : null
  const draggingItem = draggingId ? items.find((i) => i.id === draggingId) ?? null : null

  // CRITICAL: a SINGLE render tree across view/customize so the grid's
  // root <div> survives the mode flip with the same DOM identity. If we
  // returned different JSX trees for the two modes (one with DndContext,
  // one without), React would unmount the old grid element and mount a
  // fresh one — and a brand-new element has no previous CSS state for
  // the `gap` transition to interpolate from. The transition would
  // silently no-op.
  //
  // `DndContext` is always mounted (cheap when there's no active drag).
  // Inside, each cell branches per-mode: `<DraggableCell>` in customize,
  // a plain `<div>` in view. The Add-block tile and DragOverlay render
  // only in customize. The grid surface itself stays the same element.
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <GridSurface ref={gridRef} editing={editing}>
        {items.map((item) => {
          const def = definitions.get(item.id)
          if (!def) return null
          if (editing) {
            return (
              <DraggableCell
                key={item.id}
                item={item}
                definition={def}
                onResize={onResize}
                onResizeRows={onResizeRows}
              />
            )
          }
          const Render = def.render
          return (
            <div
              key={item.id}
              className={styles.cell}
              data-span={item.size}
              data-rows={item.rows}
              data-col={item.col}
              data-row={item.row}
              style={{
                ['--span' as string]: String(item.size),
                ['--rows' as string]: String(item.rows),
                ['--col' as string]: String(item.col),
                ['--row' as string]: String(item.row),
              }}
            >
              <Render span={item.size} editing={false} />
            </div>
          )
        })}
        {editing && (
          <Button
            variant="ghost"
            className={cn(styles.cell, styles.addWidget)}
            data-span={3}
            data-rows={3}
            data-col={1}
            data-row={addBlockRow}
            style={{
              ['--span' as string]: '3',
              ['--rows' as string]: '3',
              ['--col' as string]: '1',
              ['--row' as string]: String(addBlockRow),
            }}
            onClick={onAddBlock}
          >
            <span className={styles.addInner}>
              <span className={styles.addIcon}>
                <PlusIcon size={14} />
              </span>
              <span className={styles.addLabel}>Add block</span>
            </span>
          </Button>
        )}
      </GridSurface>
      <DragOverlay>
        {editing && draggingDef && draggingItem ? (
          <div
            className={cn(styles.cell, styles.dragOverlay)}
            data-span={draggingItem.size}
            data-rows={draggingItem.rows}
            style={{
              ['--span' as string]: String(draggingItem.size),
              ['--rows' as string]: String(draggingItem.rows),
            }}
          >
            <draggingDef.render span={draggingItem.size} editing />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

/**
 * Grid surface — registers itself as a single droppable so dnd-kit fires
 * `onDragEnd` regardless of which cell the user releases over. Forwards
 * its DOM node to both the parent ref (for snap-math measurements) and
 * the droppable's setNodeRef.
 *
 * Stays mounted across view/customize toggles — the `.editing` class
 * just gets added/removed on the same DOM node so the CSS `gap` /
 * `outline-color` transitions have a previous state to interpolate
 * from. Without this stability the gap change would snap instantly
 * because the element would be brand-new each toggle.
 */
function GridSurface({
  ref,
  editing,
  children,
}: {
  ref: React.RefObject<HTMLDivElement | null>
  editing: boolean
  children: React.ReactNode
}) {
  const { setNodeRef } = useDroppable({ id: GRID_DROP_ID })

  function setRefs(node: HTMLDivElement | null) {
    ref.current = node
    setNodeRef(node)
  }

  return (
    <div ref={setRefs} className={cn(styles.gridLayout, editing && styles.editing)}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Draggable cell + resize handles
// ---------------------------------------------------------------------------

type ResizeAxis = 'x' | 'y' | 'xy'
type ResizeKind = 'left' | 'right' | 'top' | 'bottom' | 'corner'

interface ResizeSpec {
  kind: ResizeKind
  axis: ResizeAxis
  xSign: -1 | 0 | 1
  ySign: -1 | 0 | 1
}

const RESIZE_SPECS: Record<ResizeKind, ResizeSpec> = {
  right:  { kind: 'right',  axis: 'x',  xSign:  1, ySign:  0 },
  left:   { kind: 'left',   axis: 'x',  xSign: -1, ySign:  0 },
  bottom: { kind: 'bottom', axis: 'y',  xSign:  0, ySign:  1 },
  top:    { kind: 'top',    axis: 'y',  xSign:  0, ySign: -1 },
  corner: { kind: 'corner', axis: 'xy', xSign:  1, ySign:  1 },
}

interface DraggableCellProps {
  item: DashboardItem
  definition: DashboardWidgetDefinition
  onResize: (id: string, size: number) => void
  onResizeRows: (id: string, rows: number) => void
}

function DraggableCell({ item, definition, onResize, onResizeRows }: DraggableCellProps) {
  const draggable = useDraggable({ id: item.id })
  const Render = definition.render

  const containerRef = useRef<HTMLDivElement | null>(null)
  const resizeStateRef = useRef<{
    spec: ResizeSpec
    startX: number
    startY: number
    startSize: number
    startRows: number
    colWidth: number
    rowHeight: number
  } | null>(null)

  function startResize(spec: ResizeSpec, event: ReactPointerEvent<HTMLSpanElement>) {
    event.stopPropagation()
    event.preventDefault()

    const container = containerRef.current
    const grid = container?.parentElement
    if (!container || !grid) return

    const gridRect = grid.getBoundingClientRect()
    // Same reasoning as the move snap math: resize only fires in
    // customize mode, so use the wider gutter constant the rendered
    // grid actually uses. One full column step = column-track +
    // gap; one row step = row-height + gap.
    const colWidth = (gridRect.width - (MAX_COLS - 1) * EDITING_GRID_GAP) / MAX_COLS + EDITING_GRID_GAP
    if (colWidth <= 0) return

    resizeStateRef.current = {
      spec,
      startX: event.clientX,
      startY: event.clientY,
      startSize: item.size,
      startRows: item.rows,
      colWidth,
      rowHeight: GRID_ROW_HEIGHT + EDITING_GRID_GAP,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveResize(event: ReactPointerEvent<HTMLSpanElement>) {
    const state = resizeStateRef.current
    if (!state) return

    const { spec, startX, startY, startSize, startRows, colWidth, rowHeight } = state

    if (spec.axis === 'x' || spec.axis === 'xy') {
      const dx = event.clientX - startX
      const cols = Math.round(dx / colWidth) * spec.xSign
      const nextSize = clampSize(startSize + cols, MIN_COLS, MAX_COLS)
      if (nextSize !== item.size) onResize(item.id, nextSize)
    }
    if (spec.axis === 'y' || spec.axis === 'xy') {
      const dy = event.clientY - startY
      const rows = Math.round(dy / rowHeight) * spec.ySign
      const nextRows = clampSize(startRows + rows, MIN_ROWS, MAX_ROWS)
      if (nextRows !== item.rows) onResizeRows(item.id, nextRows)
    }
  }

  function endResize(event: ReactPointerEvent<HTMLSpanElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    resizeStateRef.current = null
  }

  const transformStyle = draggable.transform
    ? `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`
    : undefined

  return (
    <div
      ref={(node) => {
        containerRef.current = node
        draggable.setNodeRef(node)
      }}
      className={cn(
        styles.cell,
        draggable.isDragging && styles.dragging,
      )}
      data-span={item.size}
      data-rows={item.rows}
      data-col={item.col}
      data-row={item.row}
      style={{
        ['--span' as string]: String(item.size),
        ['--rows' as string]: String(item.rows),
        ['--col' as string]: String(item.col),
        ['--row' as string]: String(item.row),
        transform: transformStyle,
      }}
      {...draggable.listeners}
      {...draggable.attributes}
    >
      <Render span={item.size} editing />

      {/* 4 edge handles + 1 corner handle. The corner is stacked above
          the edges (z-index: 11 vs 10) so the small overlap area
          resolves to two-axis resize. */}
      <ResizeHandle
        kind="left"
        label={`Resize ${definition.name} from left`}
        onStart={startResize}
        onMove={moveResize}
        onEnd={endResize}
      />
      <ResizeHandle
        kind="right"
        label={`Resize ${definition.name} from right`}
        onStart={startResize}
        onMove={moveResize}
        onEnd={endResize}
      />
      <ResizeHandle
        kind="top"
        label={`Resize ${definition.name} from top`}
        onStart={startResize}
        onMove={moveResize}
        onEnd={endResize}
      />
      <ResizeHandle
        kind="bottom"
        label={`Resize ${definition.name} from bottom`}
        onStart={startResize}
        onMove={moveResize}
        onEnd={endResize}
      />
      <ResizeHandle
        kind="corner"
        label={`Resize ${definition.name} from corner`}
        onStart={startResize}
        onMove={moveResize}
        onEnd={endResize}
      />
    </div>
  )
}

interface ResizeHandleProps {
  kind: ResizeKind
  label: string
  onStart: (spec: ResizeSpec, event: ReactPointerEvent<HTMLSpanElement>) => void
  onMove: (event: ReactPointerEvent<HTMLSpanElement>) => void
  onEnd: (event: ReactPointerEvent<HTMLSpanElement>) => void
}

const HANDLE_CLASS: Record<ResizeKind, string> = {
  left: styles.handleLeft as string,
  right: styles.handleRight as string,
  top: styles.handleTop as string,
  bottom: styles.handleBottom as string,
  corner: styles.handleCorner as string,
}

function ResizeHandle({ kind, label, onStart, onMove, onEnd }: ResizeHandleProps) {
  const spec = RESIZE_SPECS[kind]
  return (
    <span
      className={cn(styles.handle, HANDLE_CLASS[kind])}
      role="separator"
      aria-orientation={spec.axis === 'y' ? 'horizontal' : 'vertical'}
      aria-label={label}
      onPointerDown={(e) => onStart(spec, e)}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      onClick={(e) => e.stopPropagation()}
    />
  )
}
