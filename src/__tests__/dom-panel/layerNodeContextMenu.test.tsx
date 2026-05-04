/**
 * layerNodeContextMenu.test.tsx
 *
 * Tests for the LayerNodeContextMenu 'Insert component here' submenu:
 * - The entry is present in the menu when visual components exist
 * - Hovering opens a submenu listing VC names
 * - Clicking a VC entry calls insertComponentRef and closes the menu
 * - Empty state hides the submenu entry entirely
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LayerNodeContextMenu } from '../../editor/components/DomPanel/LayerNodeContextMenu'
import { useEditorStore } from '@core/editor-store/store'
import { makeNode, makePage, makeSite } from '../fixtures'
import type { VisualComponent } from '@core/visualComponents/schemas'
import '../../modules/base/index'

afterEach(cleanup)

function makeVC(id: string, name: string): VisualComponent {
  return {
    id,
    name,
    rootNode: {
      id: `root-${id}`,
      moduleId: 'base.root',
      props: {},
      children: [],
      breakpointOverrides: {},
      classIds: [],
    },
    params: [],
    breakpoints: [],
    classIds: [],
    filePath: `src/components/${name}.tsx`,
    generated: true,
    ejected: false,
    createdAt: 1_700_000_000_000,
  }
}

function resetStore(vcs: VisualComponent[] = []) {
  localStorage.clear()
  const home = makePage({
    id: 'page-home',
    title: 'Home',
    slug: 'index',
    rootNodeId: 'root-home',
    nodes: {
      'root-home': makeNode({ id: 'root-home', moduleId: 'base.root' }),
      'text-node': makeNode({ id: 'text-node', moduleId: 'base.text', props: { content: 'Hello' } }),
    },
  })
  useEditorStore.setState({
    site: makeSite({ pages: [home], files: [], visualComponents: vcs }),
    activePageId: 'page-home',
    selectedNodeId: 'text-node',
    hoveredNodeId: null,
    activeDocument: null,
    _historyPast: [],
    _historyFuture: [],
    canUndo: false,
    canRedo: false,
    hasUnsavedChanges: false,
  } as Parameters<typeof useEditorStore.setState>[0])
}

const noop = () => {}

function renderMenu(nodeId = 'text-node', vcs: VisualComponent[] = [makeVC('vc-1', 'HeroCard')]) {
  resetStore(vcs)
  return render(
    <LayerNodeContextMenu
      x={100}
      y={200}
      nodeId={nodeId}
      onClose={noop}
      onDelete={noop}
      onDuplicate={noop}
      onRename={noop}
      onWrapInContainer={noop}
    />,
  )
}

beforeEach(() => resetStore())

describe('LayerNodeContextMenu — Insert component here', () => {
  it('renders the "Insert component here" submenu trigger', () => {
    renderMenu()
    expect(screen.getByRole('menuitem', { name: /insert component here/i })).toBeDefined()
  })

  it('opens submenu listing VC names on mouseenter', () => {
    renderMenu()
    const trigger = screen.getByRole('menuitem', { name: /insert component here/i })
    fireEvent.mouseEnter(trigger)

    // Submenu should now be visible with the VC name
    expect(screen.getByRole('menuitem', { name: 'HeroCard' })).toBeDefined()
  })

  it('calls insertComponentRef with the correct nodeId and vcId when a VC is clicked', () => {
    const vc = makeVC('vc-abc', 'MyCard')
    renderMenu('text-node', [vc])

    // Open submenu
    const trigger = screen.getByRole('menuitem', { name: /insert component here/i })
    fireEvent.mouseEnter(trigger)

    // Click the VC entry
    fireEvent.click(screen.getByRole('menuitem', { name: 'MyCard' }))

    // Verify a VC ref node was inserted as child of text-node's parent (page root)
    const state = useEditorStore.getState()
    const page = state.site?.pages.find((p) => p.id === 'page-home')
    const refNodes = page
      ? Object.values(page.nodes).filter((n) => n.moduleId === 'base.visual-component-ref')
      : []
    expect(refNodes.length).toBe(1)
    expect(refNodes[0]?.props.componentId).toBe('vc-abc')
  })

  it('hides the "Insert component here" submenu entirely when visualComponents is empty', () => {
    renderMenu('text-node', [])

    expect(screen.queryByRole('menuitem', { name: /insert component here/i })).toBeNull()
  })

  it('uses selectedNodeId from store as fallback when nodeId prop is not provided', () => {
    const vc = makeVC('vc-1', 'HeroCard')
    resetStore([vc])

    // Render WITHOUT nodeId prop — should fall back to selectedNodeId ('text-node')
    render(
      <LayerNodeContextMenu
        x={100}
        y={200}
        onClose={noop}
        onDelete={noop}
        onDuplicate={noop}
        onRename={noop}
        onWrapInContainer={noop}
      />,
    )

    const trigger = screen.getByRole('menuitem', { name: /insert component here/i })
    fireEvent.mouseEnter(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'HeroCard' }))

    const state = useEditorStore.getState()
    const page = state.site?.pages.find((p) => p.id === 'page-home')
    const refNodes = page
      ? Object.values(page.nodes).filter((n) => n.moduleId === 'base.visual-component-ref')
      : []
    expect(refNodes.length).toBe(1)
    expect(refNodes[0]?.props.componentId).toBe('vc-1')
  })
})
