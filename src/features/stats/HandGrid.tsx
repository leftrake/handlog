import { useState } from 'react'
import { Link } from 'react-router'
import { Segmented } from '../../components/ui'
import { comboCount } from '../../domain/cards'
import { formatBB } from '../../domain/format'
import { bucket, type GridCell } from '../../domain/stats'
import { cx } from '../../lib/cx'

export type GridMode = 'count' | 'net'

const COUNT_STEPS = 5
const NET_STEPS = 3

/** Fill and ink (chosen by fill luminance, from the theme) for a cell. */
function cellStyle(cell: GridCell, mode: GridMode, maxCount: number, maxNet: number): { background: string; color: string } | null {
  if (cell.count === 0) return null
  if (mode === 'count') {
    const b = bucket(cell.count, maxCount, COUNT_STEPS)
    return { background: `var(--heat-c${b})`, color: `var(--heat-c-ink-${b})` }
  }
  if (cell.withResult === 0 || cell.netBB === 0) return { background: 'var(--heat-mid)', color: 'var(--heat-mid-ink)' }
  const b = bucket(Math.abs(cell.netBB), maxNet, NET_STEPS)
  return cell.netBB > 0
    ? { background: `var(--heat-p${b})`, color: `var(--heat-p-ink-${b})` }
    : { background: `var(--heat-n${b})`, color: `var(--heat-n-ink-${b})` }
}

function Legend({ mode }: { mode: GridMode }) {
  const swatches =
    mode === 'count'
      ? Array.from({ length: COUNT_STEPS }, (_, i) => `var(--heat-c${i + 1})`)
      : ['var(--heat-n3)', 'var(--heat-n2)', 'var(--heat-n1)', 'var(--heat-mid)', 'var(--heat-p1)', 'var(--heat-p2)', 'var(--heat-p3)']
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted">
      <span>{mode === 'count' ? 'Fewer' : 'Lost'}</span>
      <div className="flex gap-0.5">
        {swatches.map((s) => (
          <span key={s} className="h-3 w-5 rounded-sm" style={{ background: s }} />
        ))}
      </div>
      <span>{mode === 'count' ? 'More' : 'Won'}</span>
      <span className="ml-auto flex items-center gap-1">
        <span className="h-3 w-3 rounded-sm border border-line bg-surface-2" /> not logged
      </span>
    </div>
  )
}

export function HandGrid({ cells }: { cells: readonly GridCell[] }) {
  const [mode, setMode] = useState<GridMode>('count')
  const [selected, setSelected] = useState<string | null>(null)
  const maxCount = Math.max(0, ...cells.map((c) => c.count))
  const maxNet = Math.max(0, ...cells.map((c) => Math.abs(c.netBB)))
  const sel = cells.find((c) => c.handClass === selected) ?? null

  return (
    <div className="space-y-3">
      <Segmented<GridMode>
        size="sm"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'count', label: 'Times logged' },
          { value: 'net', label: 'Net result (BB)' },
        ]}
      />
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
        {cells.map((c) => {
          const style = cellStyle(c, mode, maxCount, maxNet)
          const label =
            c.count === 0
              ? `${c.handClass}: not logged`
              : `${c.handClass}: ${c.count} logged${c.withResult ? `, net ${formatBB(c.netBB, { signed: true })}` : ''}`
          return (
            <button
              key={c.handClass}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => setSelected(c.handClass === selected ? null : c.handClass)}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setSelected(c.handClass)}
              onFocus={() => setSelected(c.handClass)}
              className={cx(
                'flex aspect-square items-center justify-center overflow-hidden rounded-[3px] text-[8.5px] font-semibold leading-none tracking-tight sm:text-[11px]',
                !style && 'bg-surface-2 text-faint',
                selected === c.handClass && 'outline outline-2 outline-offset-1 outline-fg',
              )}
              style={style ?? undefined}
            >
              {c.handClass}
            </button>
          )
        })}
      </div>
      <Legend mode={mode} />
      <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm" aria-live="polite">
        {sel ? (
          <>
            <div>
              <div className="num font-semibold">
                {sel.handClass}{' '}
                <span className="text-muted">
                  · {sel.count} logged · {comboCount(sel.handClass)} combos
                </span>
              </div>
              <div className="num text-muted">
                {sel.withResult ? `Net ${formatBB(sel.netBB, { signed: true })} over ${sel.withResult} with a result` : 'No results recorded'}
              </div>
            </div>
            {sel.count > 0 && (
              <Link to={`/hands?hand=${encodeURIComponent(sel.handClass)}`} className="shrink-0 font-semibold text-accent">
                View hands
              </Link>
            )}
          </>
        ) : (
          <span className="text-muted">Tap a cell for details. Suited hands are above the diagonal, offsuit below.</span>
        )}
      </div>
    </div>
  )
}
