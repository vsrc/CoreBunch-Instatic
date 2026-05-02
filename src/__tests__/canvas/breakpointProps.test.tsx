import { describe, expect, it, beforeEach } from 'bun:test'
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { useEditorStore } from '../../core/editor-store/store'
import { BreakpointFrame } from '../../editor/components/Canvas/BreakpointFrame'
import { CanvasRoot } from '../../editor/components/Canvas/CanvasRoot'
import '../../modules/base'

beforeEach(() => {
  cleanup()
  useEditorStore.setState({
    site: null,
    _historyPast: [],
    _historyFuture: [],
    canUndo: false,
    canRedo: false,
    selectedNodeId: null,
    hoveredNodeId: null,
    activeDocument: null,
    activePageId: null,
    activeBreakpointId: 'desktop',
    hasUnsavedChanges: false,
  })
})

describe('canvas breakpoint rendering', () => {
  it('renders node breakpoint prop overrides inside the matching breakpoint frame', () => {
    const site = useEditorStore.getState().createSite('Breakpoint Props')
    const page = site.pages[0]
    const rootId = page.rootNodeId
    const textId = useEditorStore.getState().insertNode('base.text', {
      text: 'Desktop headline',
      tag: 'h1',
    }, rootId)
    useEditorStore.getState().setBreakpointOverride(textId, 'mobile', {
      text: 'Mobile headline',
    })

    render(
      <BreakpointFrame
        page={useEditorStore.getState().site!.pages[0]}
        breakpoint={{ id: 'mobile', label: 'Mobile', width: 375, icon: 'smartphone' }}
        isActive
        onActivate={() => {}}
      />,
    )

    expect(screen.getByText('Mobile headline')).toBeTruthy()
    expect(screen.queryByText('Desktop headline')).toBeNull()
  })

  it('activates the clicked breakpoint when selecting a node inside that frame', () => {
    const site = useEditorStore.getState().createSite('Breakpoint Selection')
    const page = site.pages[0]
    const textId = useEditorStore.getState().insertNode('base.text', {
      text: 'Shared headline',
      tag: 'h1',
    }, page.rootNodeId)
    useEditorStore.getState().setActiveBreakpoint('desktop')

    render(<CanvasRoot />)

    const mobileNode = document.querySelector(`[data-breakpoint-id="mobile"] [data-node-id="${textId}"]`)
    expect(mobileNode).toBeTruthy()

    fireEvent.click(mobileNode!)

    const state = useEditorStore.getState()
    expect(state.selectedNodeId).toBe(textId)
    expect(state.activeBreakpointId).toBe('mobile')
  })
})
