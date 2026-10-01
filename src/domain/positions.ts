import { TABLE_SIZES, type Position, type TableSize } from './types'

/**
 * Seats in preflop action order for each table size. The first seat to act is UTG (once there
 * are four or more players); the rest are named back from the button, matching common usage.
 * Heads-up, the button posts the small blind and there is no separate SB seat.
 */
const SEATS: Record<TableSize, readonly Position[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['UTG', 'BTN', 'SB', 'BB'],
  5: ['UTG', 'CO', 'BTN', 'SB', 'BB'],
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  10: ['UTG', 'UTG1', 'UTG2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
}

export const MIN_TABLE_SIZE: TableSize = 2
export const MAX_TABLE_SIZE: TableSize = 10

/** Every position, earliest to latest, for sorting and filters. */
export const ALL_POSITIONS: readonly Position[] = SEATS[10]

const LABELS: Record<Position, string> = {
  UTG: 'UTG',
  UTG1: 'UTG+1',
  UTG2: 'UTG+2',
  MP: 'MP',
  LJ: 'LJ',
  HJ: 'HJ',
  CO: 'CO',
  BTN: 'BTN',
  SB: 'SB',
  BB: 'BB',
}

/** "UTG+1", "BTN"; heads-up the button is shown as "BTN/SB". */
export function positionLabel(p: Position, size?: TableSize): string {
  if (size === 2 && p === 'BTN') return 'BTN/SB'
  return LABELS[p]
}

/** Parse "UTG+1", "utg1", "btn" etc. */
export function parsePosition(raw: string): Position | null {
  const s = raw.trim().toUpperCase().replace('+', '')
  return (ALL_POSITIONS as readonly string[]).includes(s) ? (s as Position) : null
}

export function isTableSize(n: unknown): n is TableSize {
  return (TABLE_SIZES as readonly unknown[]).includes(n)
}

/** Clamp any number to a valid table size. */
export function toTableSize(n: number): TableSize {
  const v = Math.round(Math.min(MAX_TABLE_SIZE, Math.max(MIN_TABLE_SIZE, n)))
  return v as TableSize
}

/** "Heads-up", "7-handed". */
export function tableSizeLabel(size: TableSize): string {
  return size === 2 ? 'Heads-up' : `${size}-handed`
}

export function positionsFor(size: TableSize): readonly Position[] {
  return SEATS[size] ?? SEATS[9]
}

export function isSeated(p: Position, size: TableSize): boolean {
  return positionsFor(size).includes(p)
}

/** The seat that posts the small blind: the button heads-up, otherwise the SB. */
export function smallBlindPosition(size: TableSize): Position {
  return size === 2 ? 'BTN' : 'SB'
}

/** The seat that posts a straddle (first to act preflop), or null heads-up where there's none. */
export function straddlePosition(size: TableSize): Position | null {
  return size >= 3 ? positionsFor(size)[0] : null
}

/**
 * Preflop action order. Heads-up the button (small blind) acts first. With a straddle, action
 * starts left of the straddler, who acts last.
 */
export function preflopOrder(size: TableSize, straddle = false): Position[] {
  const order = [...positionsFor(size)]
  if (!straddle || straddlePosition(size) === null) return order
  const [first, ...rest] = order
  return [...rest, first]
}

/** Postflop action order: SB, BB, then UTG … BTN. Heads-up the big blind acts first. */
export function postflopOrder(size: TableSize): Position[] {
  if (size === 2) return ['BB', 'BTN']
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

/** Sort key across table sizes (UTG first, BB last). */
export function positionRank(p: Position): number {
  return ALL_POSITIONS.indexOf(p)
}

