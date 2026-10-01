import { describe, expect, it } from 'vitest'
import { createHand, handContextFromSession, handResultBB, isBlankCapture, knownCards, syncPlayers } from './hand'
import { createSession, sessionProfit, stakesLabel, totalInvested } from './session'
import type { SessionDefaults } from './types'

const cash: SessionDefaults = {
  gameType: 'cash',
  tableSize: 9,
  location: 'Bellagio',
  stakes: { sb: 1, bb: 3, straddle: 6 },
  buyIn: 300,
}

const mtt: SessionDefaults = {
  gameType: 'tournament',
  tableSize: 9,
  location: 'Venetian',
  stakes: { sb: 1, bb: 2 },
  buyIn: 400,
  tournament: { name: 'Daily 400', startingStack: 30000, level: { level: 6, sb: 300, bb: 600, ante: 600 } },
}

describe('sessions', () => {
  it('computes invested and profit', () => {
    const s = createSession(cash, 's1', 1000)
    s.rebuys = [{ at: 2000, amount: 300 }, { at: 3000, amount: 200 }]
    expect(totalInvested(s)).toBe(800)
    expect(sessionProfit(s)).toBeNull()
    s.cashOut = 1234.5
    expect(sessionProfit(s)).toBe(434.5)
  })

  it('labels stakes', () => {
    expect(stakesLabel(createSession(cash, 's', 0))).toBe('1/3 (6 straddle)')
    expect(stakesLabel(createSession(mtt, 't', 0))).toBe('L6 · 300/600 (600)')
  })
})

describe('hand context', () => {
  it('copies cash stakes in dollars', () => {
    const ctx = handContextFromSession(createSession(cash, 's1', 0))
    expect(ctx).toMatchObject({ sessionId: 's1', unit: 'money', sb: 1, bb: 3, straddle: 6 })
  })

  it('converts tournament levels to big blinds', () => {
    const ctx = handContextFromSession(createSession(mtt, 't1', 0))
    expect(ctx).toMatchObject({ unit: 'bb', sb: 0.5, bb: 1, ante: 1 })
    expect(ctx.blindLevel).toEqual({ level: 6, sb: 300, bb: 600, ante: 600 })
  })

  it('creates a blank, flagged, unreviewed hand', () => {
    const h = createHand(handContextFromSession(createSession(cash, 's1', 0)), 'h1', 5)
    expect(h.flagged).toBe(true)
    expect(h.reviewStatus).toBe('unreviewed')
    expect(isBlankCapture(h)).toBe(true)
    h.heroPosition = 'BTN'
    expect(isBlankCapture(h)).toBe(false)
  })

  it('converts results to big blinds', () => {
    const h = createHand(handContextFromSession(createSession(cash, 's1', 0)), 'h1', 5)
    h.result = -135
    expect(handResultBB(h)).toBe(-45)
  })
})

describe('players', () => {
  it('adds hero and every involved position once, keeping existing entries and skipping pure folds', () => {
    const h = createHand(handContextFromSession(createSession(cash, 's1', 0)), 'h1', 5)
    h.heroPosition = 'CO'
    h.players = [{ position: 'BB', isHero: false, stack: 450, reads: 'sticky' }]
    h.actions = [
      { id: 'z', street: 'preflop', position: 'UTG', type: 'fold' },
      { id: 'a', street: 'preflop', position: 'CO', type: 'raise', amount: 15 },
      { id: 'b', street: 'preflop', position: 'BB', type: 'call' },
    ]
    const players = syncPlayers(h, 300)
    expect(players).toEqual([
      { position: 'BB', isHero: false, stack: 450, reads: 'sticky' },
      { position: 'CO', isHero: true, stack: 300 },
    ])
  })

  it('collects every known card', () => {
    const h = createHand(handContextFromSession(createSession(cash, 's1', 0)), 'h1', 5)
    h.hole = { kind: 'exact', cards: ['As', 'Kd'] }
    h.board = ['7c', '8c', '9c']
    h.players = [{ position: 'BB', isHero: false, stack: null, shown: ['Tc', 'Jc'] }]
    expect(knownCards(h)).toEqual(['As', 'Kd', '7c', '8c', '9c', 'Tc', 'Jc'])
  })
})
