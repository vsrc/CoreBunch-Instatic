/**
 * base.slot-outlet editor preview component.
 *
 * Component-only file so React Fast Refresh can hot-patch edits without
 * re-running module registration.
 */
import React from 'react'
import type { ModuleComponentProps } from '@core/module-engine/types'
import { TargetIcon } from 'pixel-art-icons/icons/target'
import styles from './SlotOutlet.module.css'

interface SlotOutletProps extends Record<string, unknown> {
  slotName: string
}

export const SlotOutletEditor: React.FC<ModuleComponentProps<SlotOutletProps>> = ({ props }) => {
  const slotName = typeof props.slotName === 'string' && props.slotName ? props.slotName : 'children'

  return (
    <div className={styles.placeholder}>
      <TargetIcon size={12} color="currentColor" aria-hidden="true" />
      <span className={styles.label}>Slot: {slotName}</span>
    </div>
  )
}
