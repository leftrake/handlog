import { MAX_TABLE_SIZE, MIN_TABLE_SIZE, toTableSize } from '../domain/positions'
import { TABLE_SIZES, type TableSize } from '../domain/types'
import { cx } from '../lib/cx'
import { Icon } from './icons'

/** One-tap choice of how many players are dealt in, heads-up through 10-handed. */
export function TableSizePicker({ value, onChange }: { value: TableSize; onChange: (size: TableSize) => void }) {
  return (
    <div role="radiogroup" aria-label="Players at the table" className="grid grid-cols-9 gap-1 rounded-xl bg-surface-2 p-1">
      {TABLE_SIZES.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={n === 2 ? 'Heads-up' : `${n} players`}
          onClick={() => onChange(n)}
          className={cx(
            'num h-10 rounded-lg text-sm font-semibold transition-colors',
            value === n ? 'bg-surface-3 text-fg shadow-sm' : 'text-muted active:text-fg',
          )}
        >
          {n === 2 ? 'HU' : n}
        </button>
      ))}
    </div>
  )
}

/** Compact − / + control for when players leave or join mid-session. */
export function PlayerStepper({
  value,
  onChange,
  className,
}: {
  value: TableSize
  onChange: (size: TableSize) => void
  className?: string
}) {
  const btn = 'flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold active:bg-surface-3 disabled:opacity-30'
  return (
    <div className={cx('flex items-center rounded-xl bg-surface-2', className)} role="group" aria-label="Players at the table">
      <button type="button" aria-label="One fewer player" className={btn} disabled={value <= MIN_TABLE_SIZE} onClick={() => onChange(toTableSize(value - 1))}>
        −
      </button>
      <span className="num flex min-w-[4.5rem] items-center justify-center gap-1 text-sm font-semibold">
        <Icon name="chip" size={14} className="text-muted" />
        {value === 2 ? 'HU' : `${value} players`}
      </span>
      <button type="button" aria-label="One more player" className={btn} disabled={value >= MAX_TABLE_SIZE} onClick={() => onChange(toTableSize(value + 1))}>
        +
      </button>
    </div>
  )
}
