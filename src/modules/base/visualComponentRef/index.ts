/**
 * base.visual-component-ref — reference to a Visual Component.
 *
 * Drops a named VC instance onto a page or inside another VC.
 * The editor canvas renders the VC tree inline by instantiating it with
 * propOverrides substituted from per-param overrides. Double-click enters
 * the VC's own canvas for editing.
 * The publisher emits a comment marker; full emit is Phase 5.
 *
 * Architecture source: Contribution #619 §8
 */
import type { ModuleDefinition } from '@core/module-engine/types'
import { registry } from '@core/module-engine/registry'
import { BracesIcon } from 'pixel-art-icons/icons/braces'
import { VisualComponentRefEditor } from './VisualComponentRefEditor'

interface VisualComponentRefProps extends Record<string, unknown> {
  componentId: string
  /** Per-param value overrides — keyed by VCParam.id (stable across renames) */
  propOverrides: Record<string, unknown>
  slotContent: Record<string, unknown[]>
}

export const VisualComponentRefModule: ModuleDefinition<VisualComponentRefProps> = {
  id: 'base.visual-component-ref',
  name: 'Component',
  description: 'A reference to a Visual Component',
  category: 'Components',
  version: '1.0.0',
  icon: BracesIcon,
  trusted: true,
  canHaveChildren: false,

  // Props are not panel-edited — PropertiesPanel branches on moduleId and
  // renders ComponentRefView instead (Contribution #619 §8.5).
  schema: {},

  defaults: {
    componentId: '',
    propOverrides: {},
    slotContent: {},
  },

  component: VisualComponentRefEditor,

  /**
   * Defense-in-depth fallback: the publisher walker intercepts
   * base.visual-component-ref nodes via renderVisualComponentRef() in
   * render.ts before this method is ever called. This implementation is
   * intentionally unreachable under normal operation.
   */
  render: () => ({ html: '', css: '' }),
}

registry.registerOrReplace(VisualComponentRefModule)
