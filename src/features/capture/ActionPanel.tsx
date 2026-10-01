import { useState } from 'react'
import { NumberPad } from '../../components/CardPad'
import { Icon } from '../../components/icons'
import {
  amountToCall,
  isRunout,
  legalActions,
  nextActor,
  replayHand,
  seatIn,
  setupFromHand,
  skippedActions,
  stateForStreet,
} from '../../domain/engine'
import { positionLabel, postflopOrder, preflopOrder, straddlePosition } from '../../domain/positions'
import { minBetTo, needsAmount, quickSizes } from '../../domain/sizing'
import type { Action, ActionType, Hand, Position, Street } from '../../domain/types'
import { cx } from '../../lib/cx'
import { newId } from '../../lib/id'
import { applyPadKey } from '../../lib/padInput'
import type { AmountUnit } from '../review/amountUnit'
import { STREET_LABEL } from '../review/labels'

const BOARD_NEEDED: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 }

const key =
  'flex items-center justify-center rounded-xl font-bold transition-colors select-none disabled:opacity-30 disabled:pointer-events-none'

/**
 * One-thumb action entry for Quick Capture: who acted, what they did, and how much.
 * Writes the same actions as the Full Review editor, so pots, replays and exports all use it.
 */
export function ActionPanel({
  hand,
  unit,
  onAdd,
  onUndo,
  onShowBoard,
}: {
  hand: Hand
  unit: AmountUnit
  /** New actions to append, in order (skipped players' folds/checks first). */
  onAdd: (actions: Action[]) => void
  onUndo: () => void
  onShowBoard: () => void
}) {
  const replay = replayHand(setupFromHand(hand))
  const next = nextActor(replay, hand)
  const [chosen, setChosen] = useState<Position | null>(null)
  const [sizing, setSizing] = useState<ActionType | null>(null)
  const [amountText, setAmountText] = useState('')

  const undoButton = hand.actions.length > 0 && (
    <button type="button" onClick={onUndo} className="flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-muted active:bg-surface-2">
      <Icon name="undo" size={16} /> Undo
    </button>
  )

  if (!next) {
    const winner = replay.final.handOver ? replay.final.seats.find((s) => !s.folded) : null
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted">
            {winner
              ? `Hand over: ${winner.position === hand.heroPosition ? 'you take' : `${positionLabel(winner.position, hand.tableSize)} takes`} ${unit.format(replay.finalPot)}.`
              : `${isRunout(replay.final) ? 'All-in, no more betting.' : 'Betting is complete.'} Pot ${unit.format(replay.finalPot)}.`}
          </p>
          {undoButton}
        </div>
        <p className="text-xs text-faint">Add stacks, reads and your thinking later in Full Review.</p>
      </div>
    )
  }

  const street = next.street
  const state = stateForStreet(replay, hand, street)
  const position = chosen && seatIn(state, chosen) && !seatIn(state, chosen)!.folded && !seatIn(state, chosen)!.allIn ? chosen : state.toAct!
  const who = position === hand.heroPosition ? 'You' : positionLabel(position, hand.tableSize)
  const legal = legalActions(state, position)
  const toCall = amountToCall(state, position)
  const boardMissing = hand.board.length < BOARD_NEEDED[street]

  const add = (type: ActionType, amount?: number) => {
    const filled = skippedActions(state, hand, position).map((s) => ({ id: newId(), street, position: s.position, type: s.type }) as Action)
    onAdd([...filled, { id: newId(), street, position, type, amount }])
    setChosen(null)
    setSizing(null)
    setAmountText('')
  }

  const choose = (type: ActionType) => {
    if (needsAmount(type, state, position)) {
      setSizing(type)
      setAmountText('')
    } else add(type)
  }

  // ── sizing view ──
  if (sizing) {
    const amount = amountText === '' ? null : Number(amountText)
    const toStored = amount === null ? null : unit.fromDisplay(amount)
    const min = minBetTo(state, hand.bb)
    const seat = seatIn(state, position)
    const maxTo = seat?.stack == null ? Infinity : seat.committed + seat.stack
    const belowMin = toStored !== null && toStored < min && toStored < maxTo
    const isHero = position === hand.heroPosition
    const verb = { bet: isHero ? 'bet' : 'bets', raise: isHero ? 'raise to' : 'raises to', allin: 'all-in for' }[sizing as 'bet' | 'raise' | 'allin']
    const sizes = quickSizes(state, position, sizing, hand)
    return (
      <div className="space-y-2">
        <div className="flex h-12 items-center justify-between rounded-xl bg-bg px-3">
          <span className="text-sm text-muted">
            {who} {verb}
          </span>
          <span className="num text-2xl font-bold">{amount === null ? <span className="text-faint">{unit.label}</span> : unit.format(toStored!)}</span>
        </div>
        {sizes.length > 0 && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {sizes.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => add(s.label.includes('all-in') ? 'allin' : sizing, s.to)}
                className="num h-9 shrink-0 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold active:bg-surface-3"
              >
                {s.label} · {unit.format(s.to)}
              </button>
            ))}
          </div>
        )}
        <NumberPad keyHeight="h-11" onKey={(k) => setAmountText(applyPadKey(amountText, k))} />
        <p className={cx('h-4 text-center text-xs', belowMin ? 'text-warn' : 'text-faint')}>
          {belowMin ? `Below the minimum (${unit.format(min)}); it will be flagged` : `Total for the street. Minimum ${unit.format(min)}.`}
        </p>
        <div className="grid grid-cols-[1fr_2fr] gap-1.5">
          <button type="button" onClick={() => setSizing(null)} className={cx(key, 'h-12 bg-surface-2 text-base active:bg-surface-3')}>
            Back
          </button>
          <button
            type="button"
            disabled={toStored === null || !(toStored > 0)}
            onClick={() => toStored !== null && add(sizing, toStored)}
            className={cx(key, 'h-12 bg-accent text-base text-accent-fg active:brightness-90')}
          >
            Add {sizing === 'allin' ? 'all-in' : sizing}
            {toStored !== null && toStored > 0 ? ` ${unit.format(toStored)}` : ''}
          </button>
        </div>
      </div>
    )
  }

  // ── who and what ──
  // Players who can still act, starting with whoever is next, in table order.
  const actionOrder =
    street === 'preflop' ? preflopOrder(hand.tableSize, !!hand.straddle && straddlePosition(hand.tableSize) !== null) : postflopOrder(hand.tableSize)
  const start = Math.max(0, actionOrder.indexOf(state.toAct!))
  const order = [...actionOrder.slice(start), ...actionOrder.slice(0, start)]
    .map((p) => seatIn(state, p))
    .filter((s): s is NonNullable<typeof s> => !!s && !s.folded && !s.allIn)
  const labels: Record<string, string> = {
    fold: 'Fold',
    check: 'Check',
    call: `Call ${unit.format(toCall)}`,
    bet: 'Bet…',
    raise: 'Raise…',
    allin: 'All-in',
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="num text-sm">
          <span className="font-semibold">{STREET_LABEL[street]}</span>
          <span className="text-muted"> · pot {unit.format(state.pot)}</span>
          {boardMissing && street !== 'preflop' && (
            <button type="button" onClick={onShowBoard} className="ml-2 font-semibold text-accent">
              + board
            </button>
          )}
        </div>
        {undoButton}
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="radiogroup" aria-label="Who acted">
        {order.map((s) => {
          const isHero = s.position === hand.heroPosition
          return (
            <button
              key={s.position}
              type="button"
              role="radio"
              aria-checked={s.position === position}
              onClick={() => setChosen(s.position)}
              className={cx(
                'h-11 shrink-0 rounded-xl px-3 text-sm font-bold',
                s.position === position ? 'bg-accent text-accent-fg' : 'bg-surface-2 active:bg-surface-3',
                isHero && s.position !== position && 'text-accent',
              )}
            >
              {isHero ? `You · ${positionLabel(s.position, hand.tableSize)}` : positionLabel(s.position, hand.tableSize)}
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {legal.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => choose(t)}
            className={cx(
              key,
              'num h-14 text-lg',
              t === 'fold' ? 'bg-surface-2 text-muted active:bg-surface-3' : 'bg-surface-2 text-fg active:bg-surface-3',
              (t === 'bet' || t === 'raise') && 'text-accent',
            )}
          >
            {labels[t]}
          </button>
        ))}
      </div>
      {position !== state.toAct && state.toAct && skippedActions(state, hand, position).length > 0 && (
        <p className="text-xs text-muted">
          Players before {who === 'You' ? 'you' : who} will be marked as {state.currentBet > 0 ? 'folding' : 'checking'}.
        </p>
      )}
    </div>
  )
}
