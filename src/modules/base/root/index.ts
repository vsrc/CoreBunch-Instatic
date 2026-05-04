/**
 * base.root — invisible page root container.
 *
 * Emits a bare `<div>` with no default class or default CSS. Visual styling
 * is opt-in via user classes (mcClassName / multi-class system).
 */
import type { ModuleDefinition } from '@core/module-engine/types'
import { registry } from '@core/module-engine/registry'
import { FileTextIcon } from 'pixel-art-icons/icons/file-text'
import { RootEditor } from './RootEditor'

type RootProps = Record<string, unknown>

export const RootModule: ModuleDefinition<RootProps> = {
  id: 'base.root',
  name: 'Page Root',
  category: 'Layout',
  version: '2.0.0',
  trusted: true,
  canHaveChildren: true,
  icon: FileTextIcon,

  schema: {},
  defaults: {},

  component: RootEditor,

  render: (_props, renderedChildren) => ({
    html: `<div>${renderedChildren.join('')}</div>`,
  }),
}

registry.registerOrReplace(RootModule)
