import { describe, expect, it } from 'vitest'
import {
  amountToCall,
  initialState,
  legalActions,
  nextActor,
  replayHand,
  skippedActions,
  stateForStreet,
  type HandSetup,
} from './engine'
import type { Action, ActionType, Player, Position, Street } from './types'

type Row = [Position, ActionType, number?]

let seq = 0
function acts(street: Street, rows: Row[]): Action[] {
  return rows.map(([position, type, amount]) => ({ id: `a${seq++}`, street, position, type, amount }))
}

function setup(overrides: Partial<HandSetup> = {}): HandSetup {
  return { tableSize: 6, sb: 1, bb: 2, heroPosition: null, players: [], actions: [], ...overrides }
}

const stacks = (entries: [Position, number][], hero?: Position): Player[] =>
  entries.map(([position, stack]) => ({ position, stack, isHero: position === hero }))

const errors = (r: ReturnType<typeof replayHand>) => r.issues.filter((i) => i.severity === 'error').map((i) => i.message)

describe('initial state', () => {
  it('posts blinds and starts with UTG', () => {
    const s = initialState(setup({ tableSize: 9 }))
    expect(s.pot).toBe(3)
    expect(s.currentBet).toBe(2)
    expect(s.toAct).toBe('UTG')
  })

  it('posts a UTG straddle: action starts at UTG+1 and the straddle sets the min raise', () => {
    const s = initialState(setup({ tableSize: 9, straddle: 4 }))
    expect(s.pot).toBe(7)
    expect(s.currentBet).toBe(4)
    expect(s.toAct).toBe('UTG1')
    const r = replayHand(setup({ tableSize: 9, straddle: 4, actions: acts('preflop', [['UTG1', 'raise', 7]]) }))
    expect(errors(r)[0]).toMatch(/below the minimum \(8\)/)
  })

  it('posts a big-blind ante as dead money', () => {
    const s = initialState(setup({ ante: 2 }))
    expect(s.pot).toBe(5)
    expect(s.currentBet).toBe(2)
    const bb = s.seats.find((x) => x.position === 'BB')!
    expect(bb.committed).toBe(2)
    expect(bb.invested).toBe(4)
  })
})

describe('pot tracking', () => {
  it('tracks the pot after every action across streets', () => {
    const actions = [
      ...acts('preflop', [
        ['UTG', 'fold'],
        ['HJ', 'fold'],
        ['CO', 'raise', 6],
        ['BTN', 'call'],
        ['SB', 'fold'],
        ['BB', 'call'],
      ]),
      ...acts('flop', [
        ['BB', 'check'],
        ['CO', 'bet', 10],
        ['BTN', 'fold'],
        ['BB', 'call'],
      ]),
    ]
    const r = replayHand(setup({ actions }))
    expect(r.issues).toEqual([])
    expect(r.steps.map((s) => s.after.pot)).toEqual([3, 3, 9, 15, 15, 19, 19, 29, 29, 39])
    expect(r.streets.map((s) => [s.street, s.potStart])).toEqual([
      ['preflop', 3],
      ['flop', 19],
    ])
    expect(r.final.roundComplete).toBe(true)
    expect(nextActor(r, setup())).toEqual({ street: 'turn', position: 'BB' })
  })

  it('gives the big blind the option after limps', () => {
    const r = replayHand(
      setup({
        actions: acts('preflop', [
          ['UTG', 'call'],
          ['HJ', 'fold'],
          ['CO', 'fold'],
          ['BTN', 'fold'],
          ['SB', 'call'],
        ]),
      }),
    )
    expect(r.final.toAct).toBe('BB')
    expect(legalActions(r.final, 'BB')).toEqual(['check', 'raise', 'allin'])
    expect(amountToCall(r.final, 'BB')).toBe(0)
  })

  it('returns an uncalled bet', () => {
    const r = replayHand(
      setup({
        actions: acts('preflop', [
          ['UTG', 'fold'],
          ['HJ', 'fold'],
          ['CO', 'raise', 6],
          ['BTN', 'fold'],
          ['SB', 'fold'],
          ['BB', 'fold'],
        ]),
      }),
    )
    expect(r.final.handOver).toBe(true)
    expect(r.uncalled).toEqual({ position: 'CO', amount: 4 })
    expect(r.finalPot).toBe(5)
  })
})

describe('validation', () => {
  it('flags out-of-turn action', () => {
    const r = replayHand(setup({ actions: acts('preflop', [['CO', 'raise', 6]]) }))
    expect(errors(r)).toEqual(['Out of turn: UTG acts before CO'])
  })

  it('flags acting after folding', () => {
    const actions = acts('preflop', [
      ['UTG', 'fold'],
      ['HJ', 'fold'],
      ['CO', 'fold'],
      ['BTN', 'raise', 5],
      ['SB', 'fold'],
      ['BB', 'call'],
    ])
    actions.push(...acts('flop', [['SB', 'check']]))
    const r = replayHand(setup({ actions }))
    expect(errors(r)).toEqual(['SB already folded'])
  })

  it('flags raises below the minimum, but not short all-ins', () => {
    const r = replayHand(
      setup({
        actions: acts('preflop', [
          ['UTG', 'raise', 6],
          ['HJ', 'raise', 8],
        ]),
      }),
    )
    expect(errors(r)).toEqual(["HJ's raise to 8 is below the minimum (10)"])

    const shortAllIn = replayHand(
      setup({
        players: stacks([['HJ', 8]]),
        actions: acts('preflop', [
          ['UTG', 'raise', 6],
          ['HJ', 'allin'],
        ]),
      }),
    )
    expect(errors(shortAllIn)).toEqual([])
    expect(shortAllIn.final.currentBet).toBe(8)
  })

  it('flags a check facing a bet and a call with nothing to call', () => {
    const r = replayHand(
      setup({
        actions: [
          ...acts('preflop', [
            ['UTG', 'fold'],
            ['HJ', 'fold'],
            ['CO', 'fold'],
            ['BTN', 'fold'],
            ['SB', 'call'],
            ['BB', 'check'],
          ]),
          ...acts('flop', [
            ['SB', 'call'],
            ['BB', 'bet', 4],
            ['SB', 'check'],
          ]),
        ],
      }),
    )
    expect(errors(r)).toEqual(['Nothing to call: SB should check', "SB can't check facing a bet (4 to call)"])
  })

  it("doesn't let a player re-raise after a short all-in", () => {
    const players = stacks([
      ['CO', 200],
      ['BTN', 30],
      ['BB', 200],
    ])
    const actions = [
      ...acts('preflop', [
        ['UTG', 'fold'],
        ['HJ', 'fold'],
        ['CO', 'call'],
        ['BTN', 'call'],
        ['SB', 'fold'],
        ['BB', 'check'],
      ]),
      ...acts('flop', [
        ['BB', 'check'],
        ['CO', 'bet', 20],
        ['BTN', 'allin'], // 28 behind: raise to 28 is only 8 more, a short all-in
        ['BB', 'raise', 60], // BB hasn't acted on the bet yet, so may raise
        ['CO', 'raise', 120], // CO had acted before the short all-in, but BB's full raise reopened it
      ]),
    ]
    const r = replayHand(setup({ players, actions }))
    expect(errors(r)).toEqual([])

    const blocked = replayHand(
      setup({
        players,
        actions: [
          ...actions.slice(0, 9),
          ...acts('flop', [
            ['BB', 'fold'],
            ['CO', 'raise', 60],
          ]),
        ],
      }),
    )
    expect(errors(blocked)).toEqual(["CO can't re-raise: the short all-in didn't reopen the betting"])
  })

  it('caps bets at the stack and stops betting once everyone is all-in', () => {
    const r = replayHand(
      setup({
        players: stacks([
          ['SB', 50],
          ['BB', 100],
        ]),
        actions: [
          ...acts('preflop', [
            ['UTG', 'fold'],
            ['HJ', 'fold'],
            ['CO', 'fold'],
            ['BTN', 'fold'],
            ['SB', 'raise', 80],
            ['BB', 'call'],
          ]),
          ...acts('flop', [['BB', 'bet', 10]]),
        ],
      }),
    )
    expect(errors(r)).toEqual([
      'SB only had 50, so this is treated as all-in',
      'No betting is possible on the flop: everyone left is all-in',
    ])
    expect(r.steps[5].after.pot).toBe(100)
    expect(nextActor(r, setup())).toBeNull()
  })

  it('warns when a street is left unfinished', () => {
    const r = replayHand(
      setup({
        actions: [...acts('preflop', [['UTG', 'raise', 6]]), ...acts('flop', [['SB', 'check']])],
      }),
    )
    expect(r.issues[0]).toMatchObject({ severity: 'warning', message: "preflop betting wasn't finished: HJ still had to act" })
  })
})

describe('effective stacks and SPR', () => {
  it('uses starting stacks preflop and remaining stacks on later streets', () => {
    const players = stacks(
      [
        ['BTN', 300],
        ['BB', 150],
      ],
      'BTN',
    )
    const r = replayHand(
      setup({
        heroPosition: 'BTN',
        players,
        actions: [
          ...acts('preflop', [
            ['UTG', 'fold'],
            ['HJ', 'fold'],
            ['CO', 'fold'],
            ['BTN', 'raise', 6],
            ['SB', 'fold'],
            ['BB', 'call'],
          ]),
          ...acts('flop', [['BB', 'check']]),
        ],
      }),
    )
    expect(r.streets[0]).toMatchObject({ street: 'preflop', effectiveStack: 150, spr: null })
    // Flop pot 13, BB has 144 behind, hero 294: effective 144, SPR 144 / 13
    expect(r.streets[1]).toMatchObject({ street: 'flop', potStart: 13, effectiveStack: 144, spr: 11.08 })
  })

  it('is unknown when stacks are missing', () => {
    const r = replayHand(setup({ heroPosition: 'BTN' }))
    expect(r.streets[0].effectiveStack).toBeNull()
  })
})

describe('editor helpers', () => {
  it('fills folds for skipped players preflop', () => {
    const s = initialState(setup({ tableSize: 9 }))
    expect(skippedActions(s, { tableSize: 9 }, 'CO')).toEqual([
      { position: 'UTG', type: 'fold' },
      { position: 'UTG1', type: 'fold' },
      { position: 'MP', type: 'fold' },
      { position: 'LJ', type: 'fold' },
      { position: 'HJ', type: 'fold' },
    ])
  })

  it('fills checks for skipped players when nobody has bet', () => {
    const r = replayHand(
      setup({
        actions: acts('preflop', [
          ['UTG', 'call'],
          ['HJ', 'call'],
          ['CO', 'fold'],
          ['BTN', 'fold'],
          ['SB', 'call'],
          ['BB', 'check'],
        ]),
      }),
    )
    const flop = stateForStreet(r, setup(), 'flop')
    expect(flop.toAct).toBe('SB')
    expect(skippedActions(flop, { tableSize: 6 }, 'HJ')).toEqual([
      { position: 'SB', type: 'check' },
      { position: 'BB', type: 'check' },
      { position: 'UTG', type: 'check' },
    ])
  })

  it('offers legal actions facing a bet', () => {
    const s = initialState(setup())
    expect(legalActions(s, 'UTG')).toEqual(['fold', 'call', 'raise', 'allin'])
  })
})
