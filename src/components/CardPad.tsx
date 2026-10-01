import { useState, type ReactNode } from 'react'
import { makeCard, makeHandClass, suitSymbol } from '../domain/cards'
import { RANKS, SUITS, type Card, type HandClass, type Rank } from '../domain/types'
import type { PadKey } from '../lib/padInput'
import { Icon } from './icons'
import { cx } from '../lib/cx'
import { SUIT_TEXT } from './suits'

const keyBase =
  'flex items-center justify-center rounded-xl font-bold transition-colors select-none disabled:opacity-25 disabled:pointer-events-none'

/** 13 ranks in a 7 + 6 grid, with an optional extra key in the last cell. */
export function RankGrid({
  selected = [],
  disabled,
  onPick,
  trailing,
}: {
  selected?: readonly Rank[]
  disabled?: (r: Rank) => boolean
  onPick: (r: Rank) => void
  trailing?: ReactNode
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {RANKS.map((r) => (
        <button
          key={r}
          type="button"
          disabled={disabled?.(r)}
          onClick={() => onPick(r)}
          className={cx(
            keyBase,
            'h-14 text-xl',
            selected.includes(r) ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg active:bg-surface-3',
          )}
        >
          {r}
        </button>
      ))}
      {trailing ?? <span />}
    </div>
  )
}

/** Rank pad then suit pad. Cards in `blocked` (already used) can't be picked. */
export function CardPad({
  blocked,
  onPick,
  onClear,
  clearLabel = 'Clear',
}: {
  blocked: ReadonlySet<Card>
  onPick: (card: Card) => void
  onClear?: () => void
  clearLabel?: string
}) {
  const [rank, setRank] = useState<Rank | null>(null)
  const rankFull = (r: Rank) => SUITS.every((s) => blocked.has(makeCard(r, s)))

  return (
    <div className="space-y-2">
      <RankGrid
        selected={rank ? [rank] : []}
        disabled={rankFull}
        onPick={setRank}
        trailing={
          onClear ? (
            <button
              type="button"
              onClick={() => {
                setRank(null)
                onClear()
              }}
              aria-label={clearLabel}
              className={cx(keyBase, 'h-14 bg-surface-2 text-muted active:bg-surface-3')}
            >
              <Icon name="backspace" />
            </button>
          ) : undefined
        }
      />
      <div className="grid grid-cols-4 gap-1.5">
        {SUITS.map((s) => {
          const card = rank ? makeCard(rank, s) : null
          const off = !card || blocked.has(card)
          return (
            <button
              key={s}
              type="button"
              disabled={off}
              onClick={() => {
                if (!card) return
                setRank(null)
                onPick(card)
              }}
              aria-label={card ?? `suit ${s}`}
              className={cx(
                keyBase,
                'h-16 gap-1 bg-surface-2 text-3xl active:bg-surface-3',
                SUIT_TEXT[s],
                !rank && 'opacity-40',
              )}
            >
              {rank && <span className="text-2xl text-fg">{rank}</span>}
              {suitSymbol(s)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Two ranks then suited/offsuit, for when exact suits don't matter ("AKs"). */
export function ShorthandPad({ onPick, onClear }: { onPick: (hc: HandClass) => void; onClear?: () => void }) {
  const [ranks, setRanks] = useState<Rank[]>([])
  const pick = (r: Rank) => {
    const next = [...ranks, r]
    if (next.length === 2 && next[0] === next[1]) {
      setRanks([])
      onPick(makeHandClass(r, r, false))
      return
    }
    setRanks(next.slice(-2))
  }
  const ready = ranks.length === 2
  const finish = (suited: boolean) => {
    if (!ready) return
    setRanks([])
    onPick(makeHandClass(ranks[0], ranks[1], suited))
  }

  return (
    <div className="space-y-2">
      <RankGrid
        selected={ranks}
        onPick={pick}
        trailing={
          <button
            type="button"
            onClick={() => {
              setRanks([])
              onClear?.()
            }}
            aria-label="Clear"
            className={cx(keyBase, 'h-14 bg-surface-2 text-muted active:bg-surface-3')}
          >
            <Icon name="backspace" />
          </button>
        }
      />
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" disabled={!ready} onClick={() => finish(true)} className={cx(keyBase, 'h-16 bg-surface-2 text-lg active:bg-surface-3')}>
          {ready ? makeHandClass(ranks[0], ranks[1], true) : 'Suited'}
        </button>
        <button type="button" disabled={!ready} onClick={() => finish(false)} className={cx(keyBase, 'h-16 bg-surface-2 text-lg active:bg-surface-3')}>
          {ready ? makeHandClass(ranks[0], ranks[1], false) : 'Offsuit'}
        </button>
      </div>
    </div>
  )
}

const PAD_KEYS: PadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back']

/** Phone-style number pad (no OS keyboard popping up mid-hand). */
export function NumberPad({ onKey, keyHeight = 'h-14' }: { onKey: (k: PadKey) => void; keyHeight?: string }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {PAD_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          aria-label={k === 'back' ? 'Delete' : k}
          className={cx(keyBase, keyHeight, 'num bg-surface-2 text-2xl active:bg-surface-3')}
        >
          {k === 'back' ? <Icon name="backspace" /> : k}
        </button>
      ))}
    </div>
  )
}
