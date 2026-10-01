// Bet-size helpers shared by Quick Capture and the Full Review editor.
import { seatIn, type Replay, type TableState } from './engine'
import { round2 } from './money'
import { positionLabel } from './positions'
import type { ActionType, Hand, Position, Street } from './types'

/** Round a suggested bet size to something you'd actually put out. */
export function niceSize(amount: number, hand: Pick<Hand, 'unit' | 'bb'>): number {
  if (hand.unit === 'bb') return Math.round(amount * 10) / 10
  if (hand.bb >= 1) return Math.round(amount)
  return round2(amount)
}

/** Bets and raises always need a size; an all-in needs one only when the stack is unknown. */
export function needsAmount(type: ActionType, state: TableState, position: Position): boolean {
  if (type === 'bet' || type === 'raise') return true
  return type === 'allin' && seatIn(state, position)?.stack === null
}

/** Smallest legal bet or raise, as a total for the street. */
export function minBetTo(state: TableState, bb: number): number {
  return state.currentBet === 0 ? bb : round2(state.currentBet + state.lastRaise)
}

export interface QuickSize {
  label: string
  /** Total for the street ("raise to"). */
  to: number
}

/**
 * Suggested sizes: fractions of the pot for a bet; multiples of the current bet (plus a pot-sized
 * raise) for a raise. Live opens run bigger, so unopened pots also offer 5x. Sizes beyond a known
 * stack are capped at all-in, and duplicates are dropped.
 */
export function quickSizes(
  state: TableState,
  position: Position,
  type: ActionType,
  hand: Pick<Hand, 'unit' | 'bb' | 'straddle'>,
): QuickSize[] {
  const seat = seatIn(state, position)
  if (!seat) return []
  const maxTo = seat.stack === null ? Infinity : round2(seat.committed + seat.stack)
  let sizes: QuickSize[] = []
  if (type === 'bet') {
    sizes = (
      [
        ['⅓ pot', 1 / 3],
        ['½ pot', 1 / 2],
        ['⅔ pot', 2 / 3],
        ['¾ pot', 3 / 4],
        ['Pot', 1],
      ] as const
    ).map(([label, f]) => ({ label, to: niceSize(state.pot * f, hand) }))
  } else if (type === 'raise') {
    const toCall = Math.max(0, state.currentBet - seat.committed)
    const unopened = state.street === 'preflop' && state.currentBet <= Math.max(hand.bb, hand.straddle ?? 0)
    const mults = unopened ? [2.5, 3, 4, 5] : [2.5, 3, 4]
    sizes = [
      ...mults.map((m) => ({ label: `${m}x`, to: niceSize(state.currentBet * m, hand) })),
      { label: 'Pot', to: niceSize(state.currentBet + state.pot + toCall, hand) },
    ]
  }
  const seen = new Set<number>()
  return sizes
    .map((s) => (s.to >= maxTo ? { label: `${s.label} (all-in)`, to: maxTo } : s))
    .filter((s) => s.to > 0 && !seen.has(s.to) && seen.add(s.to))
}

export interface StreetLog {
  street: Street
  items: string[]
}

/**
 * A compact, readable action log by street: "You raise $15", "BTN call $15". Folds are only listed
 * for players who had already put money in voluntarily, so auto-filled folds don't clutter it.
 */
export function actionLog(hand: Pick<Hand, 'heroPosition' | 'tableSize'>, replay: Replay, fmt: (n: number) => string): StreetLog[] {
  const out: StreetLog[] = []
  const voluntary = new Set<Position>()
  for (const step of replay.steps) {
    const a = step.action
    const who = a.position === hand.heroPosition ? 'You' : positionLabel(a.position, hand.tableSize)
    const to = step.after.seats.find((x) => x.position === a.position)?.committed ?? 0
    let text: string | null = null
    switch (a.type) {
      case 'fold':
        text = voluntary.has(a.position) ? `${who} fold` : null
        break
      case 'check':
        text = `${who} check`
        break
      case 'call':
        text = `${who} call ${fmt(step.put)}`
        break
      case 'bet':
        text = `${who} bet ${fmt(to)}`
        break
      case 'raise':
        text = `${who} raise ${fmt(to)}`
        break
      case 'allin':
        text = `${who} all-in ${fmt(to)}`
        break
    }
    if (a.type !== 'fold') voluntary.add(a.position)
    if (!text) continue
    const last = out.at(-1)
    if (last?.street === a.street) last.items.push(text)
    else out.push({ street: a.street, items: [text] })
  }
  return out
}
