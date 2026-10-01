import { formatBB } from '../../domain/format'
import { positionLabel } from '../../domain/positions'
import type { PositionRow } from '../../domain/stats'

/**
 * Net result by position as zero-centred bars (diverging: wins right in blue, losses left in red).
 * Every bar carries its value at the tip, so colour is never the only channel.
 */
export function PositionBars({ rows }: { rows: readonly PositionRow[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.netBB)))
  return (
    <div className="space-y-1.5" role="list">
      {rows.map((r) => {
        const pct = (Math.abs(r.netBB) / max) * 50
        const positive = r.netBB >= 0
        return (
          <div key={r.position} role="listitem" className="grid grid-cols-[3.25rem_1fr_4.75rem] items-center gap-2">
            <div className="text-sm font-semibold">
              {positionLabel(r.position)}
              <div className="num text-[11px] font-normal text-muted">{r.hands} hand{r.hands === 1 ? '' : 's'}</div>
            </div>
            <div className="relative h-4">
              <div className="absolute inset-y-[-4px] left-1/2 w-px bg-[var(--viz-axis)]" />
              {r.netBB !== 0 && (
                <div
                  className={positive ? 'absolute inset-y-0 left-1/2 rounded-r' : 'absolute inset-y-0 right-1/2 rounded-l'}
                  style={{ width: `${pct}%`, background: positive ? 'var(--viz-1)' : 'var(--viz-neg)' }}
                />
              )}
            </div>
            <div className="num text-right text-sm font-semibold">
              {r.withResult ? formatBB(r.netBB, { signed: true }) : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
