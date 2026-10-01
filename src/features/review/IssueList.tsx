import { Icon } from '../../components/icons'
import type { Issue } from '../../domain/engine'
import { cx } from '../../lib/cx'

export function IssueLine({ issue }: { issue: Issue }) {
  return (
    <div className={cx('flex items-start gap-1.5 text-xs', issue.severity === 'error' ? 'text-loss' : 'text-warn')}>
      <Icon name="alert" size={14} className="mt-px shrink-0" />
      <span>{issue.message}</span>
    </div>
  )
}

/** Hand-wide problems (ones not tied to a specific action row). */
export function IssueList({ issues }: { issues: readonly Issue[] }) {
  if (issues.length === 0) return null
  return (
    <div className="space-y-1 rounded-xl border border-warn/30 bg-warn/5 px-3 py-2">
      {issues.map((i, n) => (
        <IssueLine key={`${i.actionId ?? 'hand'}-${n}`} issue={i} />
      ))}
      <p className="pt-1 text-[11px] text-faint">These are checks, not blockers. Your hand is saved either way.</p>
    </div>
  )
}
