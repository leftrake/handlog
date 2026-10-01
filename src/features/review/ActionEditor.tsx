import { useState } from 'react'
import { Icon } from '../../components/icons'
import { PlayingCard } from '../../components/PlayingCard'
import { Button, IconButton, NumberInput, Segmented, TextArea } from '../../components/ui'
import {
  isRunout,
  legalActions,
  nextActor,
  seatIn,
  skippedActions,
  stateForStreet,
  type Replay,
  type Step,
  type StreetSummary,
  type TableState,
} from '../../domain/engine'
import { formatPercent } from '../../domain/format'
import { potOdds } from '../../domain/odds'
import { positionLabel } from '../../domain/positions'
import { ACTION_TYPES, STREETS, type Action, type ActionType, type Card, type Hand, type Position, type Street } from '../../domain/types'
import { cx } from '../../lib/cx'
import { newId } from '../../lib/id'
import { niceSize, type AmountUnit } from './amountUnit'
import { IssueLine } from './IssueList'
import { ACTION_LABEL, boardFor, STREET_LABEL } from './labels'

const needsAmount = (t: ActionType) => t === 'bet' || t === 'raise'

/** A real decision against a bet: more than just the blinds/straddle preflop. */
function facingBet(step: Step, hand: Hand): boolean {
  if (step.toCall <= 0) return false
  if (step.action.street !== 'preflop') return true
  return step.before.currentBet > Math.max(hand.bb, hand.straddle ?? 0)
}

function StreetHeader({ summary, street, board, unit }: { summary?: StreetSummary; street: Street; board: Card[]; unit: AmountUnit }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line/60 pb-2">
      <h3 className="text-sm font-bold uppercase tracking-wide">{STREET_LABEL[street]}</h3>
      {board.length > 0 && (
        <div className="flex gap-0.5">
          {board.map((c) => (
            <PlayingCard key={c} card={c} size="xs" />
          ))}
        </div>
      )}
      {summary && (
        <div className="num ml-auto flex gap-3 text-xs text-muted">
          <span>
            Pot <b className="text-fg">{unit.format(summary.potStart)}</b>
          </span>
          {summary.effectiveStack !== null && (
            <span>
              Eff <b className="text-fg">{unit.format(summary.effectiveStack)}</b>
            </span>
          )}
          {summary.spr !== null && (
            <span>
              SPR <b className="text-fg">{summary.spr.toFixed(1)}</b>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function ActionRow({
  step,
  hand,
  unit,
  onChange,
  onRemove,
}: {
  step: Step
  hand: Hand
  unit: AmountUnit
  onChange: (patch: Partial<Action>) => void
  onRemove: () => void
}) {
  const { action } = step
  const isHero = action.position === hand.heroPosition
  const [showThought, setShowThought] = useState(!!action.thought)
  const odds = isHero && facingBet(step, hand) ? potOdds(step.before.pot, step.toCall) : null
  const showAmount = needsAmount(action.type) || (action.type === 'allin' && seatIn(step.before, action.position)?.stack === null)

  return (
    <li className="py-1.5">
      <div className="flex items-center gap-1.5">
        <span className={cx('w-14 shrink-0 text-sm font-bold', isHero && 'text-accent')}>{positionLabel(action.position, hand.tableSize)}</span>
        <select
          aria-label="Action"
          value={action.type}
          onChange={(e) => onChange({ type: e.target.value as ActionType })}
          className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm"
        >
          {ACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACTION_LABEL[t]}
            </option>
          ))}
        </select>
        {showAmount ? (
          <NumberInput
            aria-label="Amount (total for the street)"
            className="h-9 w-24 text-right text-sm"
            placeholder="to"
            value={action.amount === undefined ? null : unit.toDisplay(action.amount)}
            onChange={(v) => onChange({ amount: v === null ? undefined : unit.fromDisplay(v) })}
          />
        ) : (
          step.put > 0 && <span className="num text-sm text-muted">{unit.format(step.put)}</span>
        )}
        <span className="num ml-auto text-xs text-muted">pot {unit.format(step.after.pot)}</span>
        {isHero && (
          <IconButton
            icon="note"
            label="What I was thinking"
            className={cx('h-9 w-9', (showThought || action.thought) && 'text-accent')}
            onClick={() => setShowThought(!showThought)}
          />
        )}
        <IconButton icon="trash" label="Delete action" className="h-9 w-9 text-muted" onClick={onRemove} />
      </div>
      {odds && (
        <div className="num ml-14 mt-0.5 text-xs text-muted">
          To call {unit.format(odds.toCall)} · pot after call {unit.format(odds.potAfterCall)} · needs{' '}
          <b className="text-fg">{formatPercent(odds.requiredEquity)}</b> equity
        </div>
      )}
      {step.issues.length > 0 && (
        <div className="ml-14 mt-1 space-y-0.5">
          {step.issues.map((i, n) => (
            <IssueLine key={n} issue={i} />
          ))}
        </div>
      )}
      {isHero && showThought && (
        <TextArea
          rows={2}
          className="ml-14 mt-1 w-[calc(100%-3.5rem)] min-h-14 text-sm"
          placeholder="What were you thinking here?"
          value={action.thought ?? ''}
          onChange={(e) => onChange({ thought: e.target.value || undefined })}
        />
      )}
    </li>
  )
}

function quickSizes(state: TableState, position: Position, type: ActionType, hand: Hand): { label: string; to: number }[] {
  const seat = seatIn(state, position)
  if (!seat) return []
  const toCall = Math.max(0, state.currentBet - seat.committed)
  if (type === 'bet') {
    return [
      { label: '⅓', f: 1 / 3 },
      { label: '½', f: 1 / 2 },
      { label: '⅔', f: 2 / 3 },
      { label: '¾', f: 3 / 4 },
      { label: 'Pot', f: 1 },
    ].map(({ label, f }) => ({ label, to: niceSize(state.pot * f, hand) }))
  }
  if (type === 'raise') {
    const potRaise = state.currentBet + state.pot + toCall
    return [
      ...[2.5, 3, 4].map((m) => ({ label: `${m}x`, to: niceSize(state.currentBet * m, hand) })),
      { label: 'Pot', to: niceSize(potRaise, hand) },
    ]
  }
  return []
}

function ActionBuilder({ hand, replay, unit, onAdd }: { hand: Hand; replay: Replay; unit: AmountUnit; onAdd: (actions: Action[]) => void }) {
  const next = nextActor(replay, hand)
  const lastStreet = hand.actions.at(-1)?.street ?? 'preflop'
  const [street, setStreet] = useState<Street>(next?.street ?? lastStreet)
  const state = stateForStreet(replay, hand, street)
  const [chosen, setChosen] = useState<Position | null>(null)
  const position = chosen ?? state.toAct
  const legal = position ? legalActions(state, position) : []
  const [chosenType, setType] = useState<ActionType | null>(null)
  const type = chosenType && legal.includes(chosenType) ? chosenType : null
  const [amount, setAmount] = useState<number | null>(null)

  if (replay.final.handOver) {
    const winner = replay.final.seats.find((s) => !s.folded)
    return (
      <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
        Hand over{winner ? `: ${positionLabel(winner.position, hand.tableSize)} takes ${unit.format(replay.finalPot)}` : ''}
        {replay.uncalled ? ` (${unit.format(replay.uncalled.amount)} uncalled returned)` : ''}.
      </p>
    )
  }
  if (!next) {
    return (
      <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
        {isRunout(replay.final) ? 'All-in: no more betting.' : 'Betting is complete.'} Final pot {unit.format(replay.finalPot)}.
      </p>
    )
  }

  const firstStreet = STREETS.indexOf(next.street)
  const streetOptions = STREETS.filter((_, i) => i >= firstStreet)
  const seats = state.seats.filter((s) => !s.folded && !s.allIn)
  const needs = type !== null && (needsAmount(type) || (type === 'allin' && seatIn(state, position!)?.stack === null))
  const canAdd = position !== null && type !== null && (!needs || (amount !== null && amount > 0))
  const sizes = position && type ? quickSizes(state, position, type, hand) : []

  const add = () => {
    if (!canAdd || !position || !type) return
    const fill = skippedActions(state, hand, position).map((s) => ({ id: newId(), street, position: s.position, type: s.type }) as Action)
    onAdd([...fill, { id: newId(), street, position, type, amount: needs && amount !== null ? unit.fromDisplay(amount) : undefined }])
  }

  return (
    <div className="space-y-3 rounded-2xl border border-accent/40 bg-accent-soft/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Add action</span>
        {streetOptions.length > 1 && (
          <Segmented<Street>
            size="sm"
            value={street}
            onChange={(s) => {
              setStreet(s)
              setChosen(null)
              setType(null)
            }}
            options={streetOptions.map((s) => ({ value: s, label: STREET_LABEL[s] }))}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {seats.map((s) => (
          <button
            key={s.position}
            type="button"
            onClick={() => {
              setChosen(s.position)
              setType(null)
            }}
            className={cx(
              'h-10 min-w-12 rounded-lg px-2.5 text-sm font-bold',
              s.position === position ? 'bg-accent text-accent-fg' : 'bg-surface-2 active:bg-surface-3',
              s.position === hand.heroPosition && s.position !== position && 'text-accent',
            )}
          >
            {positionLabel(s.position, hand.tableSize)}
            {s.position === state.toAct && <span className="ml-1 text-[10px] font-semibold opacity-70">next</span>}
          </button>
        ))}
      </div>
      {position && position !== state.toAct && skippedActions(state, hand, position).length > 0 && (
        <p className="text-xs text-muted">
          Players before {positionLabel(position, hand.tableSize)} will be marked as{' '}
          {state.currentBet > 0 || street === 'preflop' ? 'folding' : 'checking'}.
        </p>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {legal.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cx('h-11 rounded-lg text-sm font-semibold', t === type ? 'bg-accent text-accent-fg' : 'bg-surface-2 active:bg-surface-3')}
          >
            {ACTION_LABEL[t]}
          </button>
        ))}
      </div>
      {needs && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <NumberInput
              aria-label="Amount"
              className="h-11 flex-1"
              placeholder={type === 'allin' ? 'All-in total for the street' : `${ACTION_LABEL[type!]} to…`}
              value={amount}
              onChange={setAmount}
            />
            <span className="text-sm text-muted">{unit.label}</span>
          </div>
          {sizes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sizes.map((s) => (
                <Button key={s.label} size="sm" onClick={() => setAmount(unit.toDisplay(s.to))}>
                  {s.label} · {unit.format(s.to)}
                </Button>
              ))}
            </div>
          )}
          <p className="text-xs text-faint">Amounts are the total for the street ("raise to"), not the increase.</p>
        </div>
      )}
      <Button variant="primary" block icon="plus" disabled={!canAdd} onClick={add}>
        Add {position ? positionLabel(position, hand.tableSize) : ''} {type ? ACTION_LABEL[type].toLowerCase() : ''}
      </Button>
    </div>
  )
}

export function ActionEditor({
  hand,
  replay,
  unit,
  onActions,
}: {
  hand: Hand
  replay: Replay
  unit: AmountUnit
  onActions: (actions: Action[]) => void
}) {
  const byStreet = new Map<Street, Step[]>()
  for (const step of replay.steps) {
    const list = byStreet.get(step.action.street) ?? []
    list.push(step)
    byStreet.set(step.action.street, list)
  }
  const shownStreets = STREETS.filter((s) => byStreet.has(s) || s === 'preflop')
  const summaries = new Map(replay.streets.map((s) => [s.street, s]))

  const change = (id: string, patch: Partial<Action>) => onActions(hand.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  const remove = (id: string) => onActions(hand.actions.filter((a) => a.id !== id))

  return (
    <div className="space-y-4">
      {shownStreets.map((street) => (
        <div key={street}>
          <StreetHeader summary={summaries.get(street)} street={street} board={boardFor(hand.board, street)} unit={unit} />
          {street === 'preflop' && (
            <p className="num pt-1.5 text-xs text-muted">
              Blinds {unit.format(hand.sb)}/{unit.format(hand.bb)}
              {hand.straddle ? `, UTG straddle ${unit.format(hand.straddle)}` : ''}
              {hand.ante ? `, BB ante ${unit.format(hand.ante)}` : ''}
            </p>
          )}
          <ul className="divide-y divide-line/40">
            {(byStreet.get(street) ?? []).map((step) => (
              <ActionRow key={step.action.id} step={step} hand={hand} unit={unit} onChange={(p) => change(step.action.id, p)} onRemove={() => remove(step.action.id)} />
            ))}
          </ul>
        </div>
      ))}
      <ActionBuilder
        key={`${hand.actions.length}-${hand.actions.at(-1)?.id ?? ''}`}
        hand={hand}
        replay={replay}
        unit={unit}
        onAdd={(added) => onActions([...hand.actions, ...added])}
      />
      {hand.actions.length > 0 && (
        <button type="button" className="flex items-center gap-1 text-sm text-muted" onClick={() => onActions(hand.actions.slice(0, -1))}>
          <Icon name="undo" size={16} /> Undo last action
        </button>
      )}
    </div>
  )
}
