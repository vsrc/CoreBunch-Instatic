/**
 * base.root editor preview component.
 *
 * Component-only file so React Fast Refresh can hot-patch edits without
 * re-running module registration.
 */
import type { ModuleComponentProps } from '@core/module-engine/types'

type RootProps = Record<string, unknown>

export const RootEditor = ({ children, mcClassName }: ModuleComponentProps<RootProps>) => (
  <div className={mcClassName}>
    {children}
  </div>
)
