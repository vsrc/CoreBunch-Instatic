/**
 * Pinch / browser-zoom is blocked INSIDE the canvas breakpoint-frame iframes.
 *
 * Regression: `AdminZoomGuard` runs only on the parent admin document, but
 * wheel / Safari `gesture*` events fire inside each frame's OWN iframe document
 * and never cross the boundary. Without an in-frame guard, pinch-zooming over a
 * breakpoint frame (e.g. while hovering its toolbar buttons) zoomed the whole
 * admin page. `IframeFrameSurface` now installs the guard in every frame doc.
 *
 * The `gesturestart` / `gesturechange` / multi-touch assertions are the
 * decisive ones: the design frame's pre-existing wheel forwarder already
 * cancels every `wheel` event (to drive canvas pan), but it never touched the
 * gesture/touch events — those are blocked solely by the new guard.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { cleanup, render, waitFor } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { useEditorStore } from '@site/store/store'
import { CanvasRoot } from '@site/canvas/CanvasRoot'
import { makeNode, makePage, makeSite } from '../fixtures'
import '@modules/base'

afterEach(cleanup)

function dispatchCancelable(
  target: EventTarget,
  type: string,
  props: Record<string, unknown> = {},
): Event {
  const event = new Event(type, { cancelable: true, bubbles: true })
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(event, key, { configurable: true, value })
  }
  target.dispatchEvent(event)
  return event
}

function firstCanvasFrameDocument(): Document | null {
  const iframe = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe')).find((i) =>
    i.title.startsWith('Canvas frame for '),
  )
  return iframe?.contentDocument ?? null
}

beforeEach(() => {
  const page = makePage({
    id: 'p1',
    slug: 'home',
    title: 'Home',
    rootNodeId: 'root',
    nodes: { root: makeNode({ id: 'root', moduleId: 'base.body', children: [] }) },
  })
  const site = makeSite({ pages: [page] })
  useEditorStore.setState({
    site,
    activePageId: 'p1',
    activeDocument: null,
  } as Parameters<typeof useEditorStore.setState>[0])
})

describe('canvas breakpoint frame — in-frame browser-zoom guard', () => {
  it('cancels pinch / ctrl-wheel and Safari gesture zoom inside the frame document', async () => {
    render(
      <DndContext>
        <CanvasRoot />
      </DndContext>,
    )

    let frameDoc: Document | null = null
    await waitFor(() => {
      frameDoc = firstCanvasFrameDocument()
      expect(frameDoc?.body).toBeTruthy()
    })

    // ctrl/meta wheel (trackpad pinch in Chrome) — zoom blocked.
    expect(dispatchCancelable(frameDoc!, 'wheel', { ctrlKey: true }).defaultPrevented).toBe(true)
    expect(dispatchCancelable(frameDoc!, 'wheel', { metaKey: true }).defaultPrevented).toBe(true)
    // Safari pinch gestures + multi-touch pinch — only the new guard cancels these.
    expect(dispatchCancelable(frameDoc!, 'gesturestart').defaultPrevented).toBe(true)
    expect(dispatchCancelable(frameDoc!, 'gesturechange').defaultPrevented).toBe(true)
    expect(dispatchCancelable(frameDoc!, 'touchmove', { touches: [{}, {}] }).defaultPrevented).toBe(true)
  })

  it('leaves single-finger touch scrolling inside the frame alone', async () => {
    render(
      <DndContext>
        <CanvasRoot />
      </DndContext>,
    )

    let frameDoc: Document | null = null
    await waitFor(() => {
      frameDoc = firstCanvasFrameDocument()
      expect(frameDoc?.body).toBeTruthy()
    })

    // A one-finger touchmove is a scroll, not a pinch — the guard must not cancel it.
    expect(dispatchCancelable(frameDoc!, 'touchmove', { touches: [{}] }).defaultPrevented).toBe(false)
  })
})
