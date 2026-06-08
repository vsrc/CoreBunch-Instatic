/**
 * SpacingBoxControl — shared TokenAwareInput behaviour
 *
 * The per-side spacing inputs used to hand-roll their own copy of the
 * token-autocomplete control (suggestion filtering, commit-on-Enter,
 * hover preview, the Suggested/All dropdown). That logic now lives in the
 * single deep `TokenAwareInput` primitive, and SpacingBoxControl renders it
 * with `fieldSize="xs"`, `overlay`, and `tooltipOnOverflow`.
 *
 * These tests pin that contract from both ends:
 *   1. TokenAwareInput, given the spacing control's exact prop combo,
 *      filters suggestions, commits the resolved token on Enter, and fires
 *      a preview when a token row is hovered.
 *   2. SpacingBoxControl's per-side field exhibits the SAME behaviour,
 *      proving it is genuinely backed by the shared component.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { TokenAwareInput } from '@site/property-controls/TokenAwareInput'
import type { Token } from '@site/property-controls/tokenUtils'
import { SpacingBoxControl } from '@site/panels/PropertiesPanel/SpacingBoxControl/SpacingBoxControl'
import { useEditorStore } from '@site/store/store'
import { makeSite } from '../fixtures'

const TOKENS: ReadonlyArray<Token> = [
  { step: 'sm', varName: '--space-sm', valueExpr: 'var(--space-sm)', groupName: 'Spacing', prefix: 'space' },
  { step: 'md', varName: '--space-md', valueExpr: 'var(--space-md)', groupName: 'Spacing', prefix: 'space' },
  { step: 'lg', varName: '--space-lg', valueExpr: 'var(--space-lg)', groupName: 'Spacing', prefix: 'space' },
]

beforeEach(() => {
  localStorage.clear()
})
afterEach(cleanup)

// ---------------------------------------------------------------------------
// 1. Shared TokenAwareInput, driven with the spacing control's prop combo
// ---------------------------------------------------------------------------

describe('TokenAwareInput (spacing prop combo: xs + overlay + tooltipOnOverflow)', () => {
  it('filters suggestions by the typed prefix', () => {
    render(
      <TokenAwareInput
        value=""
        tokens={TOKENS}
        fieldSize="xs"
        overlay
        tooltipOnOverflow
        aria-label="margin top"
        menuAriaLabel="margin top spacing tokens"
        onCommit={() => {}}
        onPreview={() => {}}
        onClearPreview={() => {}}
      />,
    )

    const input = screen.getByLabelText('margin top')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'md' } })

    const menu = screen.getByRole('menu', { name: 'margin top spacing tokens' })
    // "Suggested" section is populated by the prefix filter.
    expect(within(menu).getByText('Suggested')).toBeTruthy()
    expect(within(menu).getByText('--space-md')).toBeTruthy()
  })

  it('commits the resolved token expression on Enter', () => {
    let committed: string | undefined | symbol = Symbol('uncalled')
    render(
      <TokenAwareInput
        value=""
        tokens={TOKENS}
        fieldSize="xs"
        overlay
        tooltipOnOverflow
        aria-label="margin top"
        onCommit={(resolved) => {
          committed = resolved
        }}
        onPreview={() => {}}
        onClearPreview={() => {}}
      />,
    )

    const input = screen.getByLabelText('margin top')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'md' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)

    expect(committed).toBe('var(--space-md)')
  })

  it('previews a token value when its row is hovered', () => {
    const previews: Array<string | undefined> = []
    render(
      <TokenAwareInput
        value=""
        tokens={TOKENS}
        fieldSize="xs"
        overlay
        tooltipOnOverflow
        aria-label="margin top"
        menuAriaLabel="margin top spacing tokens"
        onCommit={() => {}}
        onPreview={(resolved) => previews.push(resolved)}
        onClearPreview={() => {}}
      />,
    )

    const input = screen.getByLabelText('margin top')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'md' } })

    const menu = screen.getByRole('menu', { name: 'margin top spacing tokens' })
    const row = within(menu).getByText('--space-md').closest('[role="menuitem"]')
    expect(row).toBeTruthy()
    fireEvent.mouseEnter(row as Element)

    expect(previews).toContain('var(--space-md)')
  })
})

// ---------------------------------------------------------------------------
// 2. SpacingBoxControl per-side field is backed by the shared component
// ---------------------------------------------------------------------------

function seedSpacingTokens() {
  useEditorStore.setState({
    site: makeSite({
      settings: {
        shortcuts: {},
        framework: {
          spacing: {
            groups: [
              {
                id: 'group-space',
                name: 'Spacing',
                namingConvention: 'space',
                min: { size: 16, scaleRatio: 1.25 },
                max: { size: 28, scaleRatio: 1.414 },
                steps: 'sm,md,lg',
                baseScaleIndex: 1,
                mode: 'fluid',
                order: 0,
                createdAt: 0,
                updatedAt: 0,
              },
            ],
          },
        },
      },
    }),
  } as Parameters<typeof useEditorStore.setState>[0])
}

describe('SpacingBoxControl per-side input', () => {
  it('exposes the shared token autocomplete: filter + commit + preview', () => {
    seedSpacingTokens()

    const changes: Array<[string, string | number | undefined]> = []
    const previews: Array<Record<string, unknown>> = []

    render(
      <SpacingBoxControl
        storedStyles={{}}
        currentStyles={{}}
        onChange={(property, value) => changes.push([property, value])}
        onRemove={() => {}}
        onPreview={(patch) => previews.push(patch)}
        onClearPreview={() => {}}
      />,
    )

    const input = screen.getByLabelText('padding top')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'md' } })

    // Suggestion filtering renders the shared dropdown for this side.
    const menu = screen.getByRole('menu', { name: 'padding top spacing tokens' })
    expect(within(menu).getByText('--space-md')).toBeTruthy()

    // Preview-on-hover fires through the shared component.
    const row = within(menu).getByText('--space-md').closest('[role="menuitem"]')
    fireEvent.mouseEnter(row as Element)
    expect(previews.some((p) => p.paddingTop === 'var(--space-md)')).toBe(true)

    // Commit-on-Enter resolves the token and writes the side.
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(changes).toContainEqual(['paddingTop', 'var(--space-md)'])
  })
})
