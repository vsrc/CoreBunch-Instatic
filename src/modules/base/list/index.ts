/**
 * base.list — ordered or unordered list.
 *
 * Emits a bare `<ul>` / `<ol>` with no default class or default CSS.
 * Visual styling is opt-in via user classes (mcClassName / multi-class system).
 */
import type { ModuleDefinition } from '@core/module-engine/types'
import { registry } from '@core/module-engine/registry'
import { ListBoxIcon } from 'pixel-art-icons/icons/list-box'
import { ListEditor } from './ListEditor'

interface ListProps extends Record<string, unknown> {
  items: string
  listType: 'unordered' | 'ordered'
}

function parseItems(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export const ListModule: ModuleDefinition<ListProps> = {
  id: 'base.list',
  name: 'List',
  description: 'An ordered or unordered list.',
  category: 'Typography',
  version: '2.0.0',
  icon: ListBoxIcon,
  trusted: true,
  canHaveChildren: false,

  schema: {
    items: {
      type: 'textarea',
      label: 'Items',
      rows: 5,
      placeholder: 'Item 1\nItem 2\nItem 3',
    },
    listType: {
      type: 'select',
      label: 'List type',
      options: [
        { label: 'Bullet', value: 'unordered' },
        { label: 'Numbered', value: 'ordered' },
      ],
    },
  },

  defaults: {
    items: '',
    listType: 'unordered',
  },

  component: ListEditor,

  render: (props) => {
    const tag = props.listType === 'ordered' ? 'ol' : 'ul'
    const items = parseItems(String(props.items || ''))
    const liItems = items.map((item) => `<li>${item}</li>`).join('')
    return {
      html: `<${tag}>${liItems}</${tag}>`,
    }
  },
}

registry.registerOrReplace(ListModule)
