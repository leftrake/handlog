import { describe, expect, it } from 'vitest'
import { formatBB, formatDuration, formatHandAmount, formatMoney, parseAmount } from './format'

describe('format', () => {
  it('formats money with sign and cents only when needed', () => {
    expect(formatMoney(1250, '$')).toBe('$1,250')
    expect(formatMoney(185, '$', { signed: true })).toBe('+$185')
    expect(formatMoney(-40.5, '$')).toBe('−$40.50')
    expect(formatMoney(0, '$', { signed: true })).toBe('$0')
  })

  it('formats big blinds', () => {
    expect(formatBB(92.5)).toBe('92.5 BB')
    expect(formatBB(-3.25, { signed: true })).toBe('−3.25 BB')
    expect(formatBB(12, { signed: true })).toBe('+12 BB')
  })

  it('shows hand amounts in the preferred unit; tournaments always in BB', () => {
    const cash = { unit: 'money' as const, bb: 2 }
    const mtt = { unit: 'bb' as const, bb: 1 }
    expect(formatHandAmount(cash, 120, { currencySymbol: '$', displayUnit: 'money' })).toBe('$120')
    expect(formatHandAmount(cash, 120, { currencySymbol: '$', displayUnit: 'bb' })).toBe('60 BB')
    expect(formatHandAmount(mtt, 14.5, { currencySymbol: '$', displayUnit: 'money' })).toBe('14.5 BB')
  })

  it('formats durations', () => {
    expect(formatDuration(45 * 60_000)).toBe('45m')
    expect(formatDuration(192 * 60_000)).toBe('3h 12m')
  })

  it('parses typed amounts', () => {
    expect(parseAmount('1,250')).toBe(1250)
    expect(parseAmount('$40.5')).toBe(40.5)
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('')).toBeNull()
  })
})
