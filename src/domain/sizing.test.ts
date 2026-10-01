import { describe, expect, it } from 'vitest'
import { initialState, replayHand, setupFromHand, type HandSetup } from './engine'
import { buildSampleData } from './sampleData'
import { actionLog, minBetTo, needsAmount, niceSize, quickSizes } from './sizing'
import type { Action } from './types'

const cash = { unit: 'money' as const, bb: 2 }

function setup(overrides: Partial<HandSetup> = {}): HandSetup {
  return { tableSize: 9, sb: 1, bb: 2, heroPosition: null, players: [], actions: [], ...overrides }
}

const act = (id: string, position: Action['position'], type: Action['type'], amount?: number, street: Action['street'] = 'preflop'): Action => ({
  id,
  street,
  position,
  type,
  amount,
})

describe('quick sizes', () => {
  it('offers live-sized opens in an unopened pot, plus a pot-sized raise', () => {
    const s = initialState(setup())
    expect(quickSizes(s, 'UTG', 'raise', cash).map((q) => [q.label, q.to])).toEqual([
      ['2.5x', 5],
      ['3x', 6],
      ['4x', 8],
      ['5x', 10],
      ['Pot', 7],
    ])
  })

  it('offers 3-bet sizes facing a raise', () => {
    const r = replayHand(setup({ actions: [act('1', 'UTG', 'raise', 6)] }))
    expect(quickSizes(r.final, 'UTG1', 'raise', cash).map((q) => [q.label, q.to])).toEqual([
      ['2.5x', 15],
      ['3x', 18],
      ['4x', 24],
      ['Pot', 21],
    ])
  })

  it('offers pot fractions for a bet', () => {
    const r = replayHand(
      setup({
        tableSize: 2,
        actions: [act('1', 'BTN', 'raise', 6), act('2', 'BB', 'call'), act('3', 'BB', 'check', undefined, 'flop')],
      }),
    )
    const flop = r.final
    expect(quickSizes(flop, 'BTN', 'bet', cash).map((q) => q.to)).toEqual([4, 6, 8, 9, 12])
  })

  it('caps sizes at a known stack and drops duplicates', () => {
    const r = replayHand(
      setup({ players: [{ position: 'UTG1', isHero: true, stack: 20 }], actions: [act('1', 'UTG', 'raise', 6)] }),
    )
    expect(quickSizes(r.final, 'UTG1', 'raise', cash)).toEqual([
      { label: '2.5x', to: 15 },
      { label: '3x', to: 18 },
      { label: '4x (all-in)', to: 20 },
    ])
  })

  it('rounds to chips you would actually bet', () => {
    expect(niceSize(9.5, cash)).toBe(10)
    expect(niceSize(2.24, { unit: 'bb', bb: 1 })).toBe(2.2)
  })
})

describe('minimums and required amounts', () => {
  it('knows the minimum bet and raise', () => {
    expect(minBetTo(initialState(setup()), 2)).toBe(4)
    const r = replayHand(setup({ actions: [act('1', 'UTG', 'raise', 7)] }))
    expect(minBetTo(r.final, 2)).toBe(12)
  })

  it('asks for a size on bets and raises, and on all-ins only when the stack is unknown', () => {
    const s = initialState(setup({ players: [{ position: 'BTN', isHero: true, stack: 200 }] }))
    expect(needsAmount('raise', s, 'BTN')).toBe(true)
    expect(needsAmount('call', s, 'BTN')).toBe(false)
    expect(needsAmount('allin', s, 'BTN')).toBe(false)
    expect(needsAmount('allin', s, 'CO')).toBe(true)
  })
})

describe('action log', () => {
  it('summarizes the action by street without auto-filled folds', () => {
    let n = 0
    const { hands } = buildSampleData(Date.UTC(2026, 8, 30), () => `id${n++}`, (t) => t)
    const qq = hands.find((h) => h.note.startsWith('BB squeezed'))!
    const log = actionLog(qq, replayHand(setupFromHand(qq)), (v) => `$${v}`)
    expect(log).toEqual([
      { street: 'preflop', items: ['You raise $15', 'BTN call $15', 'BB raise $60', 'You call $45', 'BTN fold'] },
      { street: 'flop', items: ['BB bet $70', 'You call $70'] },
      { street: 'turn', items: ['BB bet $160', 'You call $160'] },
    ])
  })
})
