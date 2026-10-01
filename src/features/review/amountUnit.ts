import { formatBB, formatMoney } from '../../domain/format'
import { round2 } from '../../domain/money'
import type { Hand } from '../../domain/types'

export type EntryUnit = 'money' | 'bb'

/**
 * Converts between a hand's stored units and the unit amounts are typed/shown in.
 * Tournament hands are always in big blinds; cash hands can be entered in either.
 */
export interface AmountUnit {
  unit: EntryUnit
  label: string
  toDisplay: (stored: number) => number
  fromDisplay: (typed: number) => number
  format: (stored: number, signed?: boolean) => string
}

export function amountUnit(hand: Pick<Hand, 'unit' | 'bb'>, preferred: EntryUnit, currency: string): AmountUnit {
  const unit: EntryUnit = hand.unit === 'bb' ? 'bb' : preferred
  const inBB = unit === 'bb' && hand.unit === 'money'
  return {
    unit,
    label: unit === 'bb' ? 'BB' : currency,
    toDisplay: (v) => (inBB ? round2(v / hand.bb) : v),
    fromDisplay: (v) => (inBB ? round2(v * hand.bb) : v),
    format: (v, signed) =>
      unit === 'bb' ? formatBB(inBB ? v / hand.bb : v, { signed }) : formatMoney(v, currency, { signed }),
  }
}

/** Round a suggested bet size to something you'd actually put out. */
export function niceSize(amount: number, hand: Pick<Hand, 'unit' | 'bb'>): number {
  if (hand.unit === 'bb') return Math.round(amount * 10) / 10
  if (hand.bb >= 1) return Math.round(amount)
  return round2(amount)
}
