import type { Position, TableSize } from './types'

/** Seats in preflop action order (UTG first, BB last). */
const POSITIONS_9: readonly Position[] = ['UTG', 'UTG1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']
const POSITIONS_6: readonly Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']

export const ALL_POSITIONS: readonly Position[] = POSITIONS_9

const LABELS: Record<Position, string> = {
  UTG: 'UTG',
  UTG1: 'UTG+1',
  MP: 'MP',
  LJ: 'LJ',
  HJ: 'HJ',
  CO: 'CO',
  BTN: 'BTN',
  SB: 'SB',
  BB: 'BB',
}

export function positionLabel(p: Position): string {
  return LABELS[p]
}

/** Parse "UTG+1", "utg1", "btn" etc. */
export function parsePosition(raw: string): Position | null {
  const s = raw.trim().toUpperCase().replace('+', '')
  return (ALL_POSITIONS as readonly string[]).includes(s) ? (s as Position) : null
}

export function positionsFor(size: TableSize): readonly Position[] {
  return size === 6 ? POSITIONS_6 : POSITIONS_9
}

export function isSeated(p: Position, size: TableSize): boolean {
  return positionsFor(size).includes(p)
}

/** The seat that posts a straddle: first to act preflop (UTG). */
export const STRADDLE_POSITION: Position = 'UTG'

/** Preflop action order. With a UTG straddle, action starts left of the straddler, who acts last. */
export function preflopOrder(size: TableSize, straddle = false): Position[] {
  const order = [...positionsFor(size)]
  if (!straddle) return order
  const [first, ...rest] = order
  return [...rest, first]
}

/** Postflop action order: SB, BB, then UTG … BTN. */
export function postflopOrder(size: TableSize): Position[] {
  const order = positionsFor(size)
  return [...order.slice(-2), ...order.slice(0, -2)]
}

/**
 * Seat order clockwise around the table starting with the button, used for drawing the table.
 * BTN → SB → BB → UTG → … → CO.
 */
export function clockwiseFromButton(size: TableSize): Position[] {
  const pre = positionsFor(size)
  const btn = pre.indexOf('BTN')
  return [...pre.slice(btn), ...pre.slice(0, btn)]
}

/** Map a position to its slot in the 9-handed list, for sorting across table sizes. */
export function positionRank(p: Position): number {
  return POSITIONS_9.indexOf(p)
}
