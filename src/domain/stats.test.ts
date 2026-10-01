import { describe, expect, it } from 'vitest'
import { createHand } from './hand'
import { createSession } from './session'
import {
  bucket,
  filterSessions,
  filterStatHands,
  handSample,
  niceTicks,
  profitTimeline,
  resultsByPosition,
  sessionStats,
  startingHandGrid,
} from './stats'
import type { Hand, Session } from './types'

const H = 3_600_000

function session(id: string, patch: Partial<Session>): Session {
  const s = createSession({ gameType: 'cash', tableSize: 9, location: 'x', stakes: { sb: 1, bb: 2 }, buyIn: 200 }, id, 0)
  return { ...s, ...patch }
}

function hand(id: string, patch: Partial<Hand>): Hand {
  const h = createHand({ sessionId: null, gameType: 'cash', tableSize: 9, unit: 'money', sb: 1, bb: 2 }, id, 0)
  return { ...h, ...patch }
}

const sessions = [
  // 1/2 cash: +300 over 4h = +150 BB
  session('a', { startedAt: 0, endedAt: 4 * H, buyIn: 200, rebuys: [{ at: 1, amount: 200 }], cashOut: 700 }),
  // 2/5 cash: −250 over 2h = −50 BB
  session('b', { startedAt: 10 * H, endedAt: 12 * H, stakes: { sb: 2, bb: 5 }, buyIn: 500, cashOut: 250 }),
  // Tournament: $400 entry, $1,290 prize over 6h
  session('c', { gameType: 'tournament', startedAt: 20 * H, endedAt: 26 * H, buyIn: 400, cashOut: 1290 }),
  // Tournament bust
  session('d', { gameType: 'tournament', startedAt: 30 * H, endedAt: 33 * H, buyIn: 400, cashOut: 0 }),
  // Still running: excluded
  session('e', { startedAt: 40 * H, endedAt: null, cashOut: null }),
]

describe('sessionStats', () => {
  const s = sessionStats(sessions, 50 * H)

  it('totals finished sessions only', () => {
    expect(s.count).toBe(4)
    expect(s.winning).toBe(2)
    expect(s.profit).toBe(300 - 250 + 890 - 400)
    expect(s.hours).toBe(15)
    expect(s.perHour).toBe(36)
  })

  it('computes cash $/hour and BB/hour at each session’s own stakes', () => {
    expect(s.cash.profit).toBe(50)
    expect(s.cash.hours).toBe(6)
    expect(s.cash.perHour).toBe(8.33)
    expect(s.cash.bbWon).toBe(100)
    expect(s.cash.bbPerHour).toBe(16.67)
  })

  it('computes tournament ROI', () => {
    expect(s.tournament).toMatchObject({ count: 2, invested: 800, prizes: 1290, cashes: 1, profit: 490 })
    expect(s.tournament.roi).toBeCloseTo(0.6125)
  })

  it('handles no data', () => {
    const empty = sessionStats([])
    expect(empty.perHour).toBeNull()
    expect(empty.cash.bbPerHour).toBeNull()
    expect(empty.tournament.roi).toBeNull()
  })
})

describe('profitTimeline', () => {
  it('runs a cumulative total in end order', () => {
    expect(profitTimeline(sessions).map((p) => [p.sessionId, p.result, p.cumulative])).toEqual([
      ['a', 300, 300],
      ['b', -250, 50],
      ['c', 890, 940],
      ['d', -400, 540],
    ])
  })
})

describe('filters', () => {
  it('scopes sessions and hands by date and game type', () => {
    expect(filterSessions(sessions, { gameType: 'tournament' }).map((s) => s.id)).toEqual(['c', 'd'])
    expect(filterSessions(sessions, { from: 10 * H, to: 25 * H }).map((s) => s.id)).toEqual(['b', 'c'])
    const hs = [hand('1', { createdAt: 5 }), hand('2', { createdAt: 50, gameType: 'tournament' })]
    expect(filterStatHands(hs, { gameType: 'cash' }).map((h) => h.id)).toEqual(['1'])
    expect(filterStatHands(hs, { from: 10 }).map((h) => h.id)).toEqual(['2'])
  })
})

describe('hand aggregation', () => {
  const hands = [
    hand('1', { heroPosition: 'BTN', hole: { kind: 'exact', cards: ['As', 'Ks'] }, result: 60 }), // +30 BB
    hand('2', { heroPosition: 'BTN', hole: { kind: 'class', handClass: 'AKs' }, result: -20 }), // −10 BB
    hand('3', { heroPosition: 'UTG', hole: { kind: 'exact', cards: ['Qh', 'Qd'] }, result: null }),
    // Tournament hand, already in BB
    hand('4', { heroPosition: 'UTG', unit: 'bb', bb: 1, sb: 0.5, gameType: 'tournament', hole: { kind: 'class', handClass: 'AKo' }, result: -12.5 }),
    hand('5', { heroPosition: null, hole: null, result: 10 }),
  ]

  it('summarizes the logged sample in BB', () => {
    expect(handSample(hands)).toEqual({ logged: 5, withResult: 4, netBB: 30 - 10 - 12.5 + 5 })
  })

  it('groups results by position in table order', () => {
    expect(resultsByPosition(hands)).toEqual([
      { position: 'UTG', hands: 2, withResult: 1, netBB: -12.5, avgBB: -12.5, won: 0, lost: 1 },
      { position: 'BTN', hands: 2, withResult: 2, netBB: 20, avgBB: 10, won: 1, lost: 1 },
    ])
  })

  it('fills the 13x13 grid from exact and shorthand hole cards', () => {
    const grid = startingHandGrid(hands)
    expect(grid).toHaveLength(169)
    const aks = grid.find((c) => c.handClass === 'AKs')!
    expect(aks).toMatchObject({ row: 0, col: 1, count: 2, withResult: 2, netBB: 20 })
    expect(grid.find((c) => c.handClass === 'QQ')).toMatchObject({ count: 1, withResult: 0, netBB: 0 })
    expect(grid.find((c) => c.handClass === 'AKo')).toMatchObject({ row: 1, col: 0, count: 1, netBB: -12.5 })
    expect(grid.reduce((n, c) => n + c.count, 0)).toBe(4)
  })

  it('buckets values for colour steps', () => {
    expect(bucket(0, 10, 5)).toBe(0)
    expect(bucket(1, 10, 5)).toBe(1)
    expect(bucket(10, 10, 5)).toBe(5)
    expect(bucket(6, 10, 5)).toBe(3)
  })
})

describe('niceTicks', () => {
  it('uses clean steps and always includes zero', () => {
    expect(niceTicks([450, 85, 1000, 1753, 1498])).toEqual([0, 500, 1000, 1500, 2000])
    expect(niceTicks([-250, 50, 940])).toEqual([-500, 0, 500, 1000])
    expect(niceTicks([0])).toEqual([0])
  })
})
