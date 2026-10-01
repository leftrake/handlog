import { describe, expect, it } from 'vitest'
import { replayHand, setupFromHand } from './engine'
import { activeFilterCount, filterHands, reviewQueue } from './filters'
import { createHand } from './hand'
import type { Hand, Tag } from './types'
import { validateHand } from './validation'

function hand(id: string, patch: Partial<Hand>): Hand {
  const h = createHand({ sessionId: 's1', gameType: 'cash', tableSize: 9, unit: 'money', sb: 1, bb: 2 }, id, 0)
  return { ...h, ...patch }
}

const tags: Tag[] = [
  { id: 't-bluff', name: 'Bluff', order: 0 },
  { id: 't-3bet', name: '3bet pot', order: 1 },
]
const tagMap = new Map(tags.map((t) => [t.id, t]))

const hands = [
  hand('a', {
    createdAt: 100,
    hole: { kind: 'exact', cards: ['As', 'Ks'] },
    heroPosition: 'BTN',
    result: 240,
    wentTo: 'river',
    tagIds: ['t-3bet'],
  }),
  hand('b', {
    createdAt: 200,
    hole: { kind: 'class', handClass: 'AKo' },
    heroPosition: 'BB',
    result: -80,
    wentTo: 'flop',
    tagIds: ['t-bluff', 't-3bet'],
    note: 'Barrelled the ace-high board',
  }),
  hand('c', {
    createdAt: 300,
    hole: { kind: 'exact', cards: ['7h', '7d'] },
    heroPosition: 'CO',
    result: 0,
    wentTo: 'showdown',
    reviewStatus: 'reviewed',
    sessionId: 's2',
  }),
  hand('d', { createdAt: 50, flagged: false, heroPosition: 'UTG' }),
]

const ids = (hs: Hand[]) => hs.map((h) => h.id)

describe('filterHands', () => {
  it('filters by starting hand', () => {
    expect(ids(filterHands(hands, { handQuery: 'AK' }))).toEqual(['a', 'b'])
    expect(ids(filterHands(hands, { handQuery: 'AKs' }))).toEqual(['a'])
    expect(ids(filterHands(hands, { handQuery: 'pairs' }))).toEqual(['c'])
  })

  it('filters by position, outcome, street, status and session', () => {
    expect(ids(filterHands(hands, { positions: ['BTN', 'CO'] }))).toEqual(['a', 'c'])
    expect(ids(filterHands(hands, { outcome: 'won' }))).toEqual(['a'])
    expect(ids(filterHands(hands, { outcome: 'lost' }))).toEqual(['b'])
    expect(ids(filterHands(hands, { outcome: 'even' }))).toEqual(['c'])
    expect(ids(filterHands(hands, { wentTo: ['flop', 'turn'] }))).toEqual(['b'])
    expect(ids(filterHands(hands, { reviewStatuses: ['reviewed'] }))).toEqual(['c'])
    expect(ids(filterHands(hands, { sessionId: 's2' }))).toEqual(['c'])
  })

  it('requires every selected tag', () => {
    expect(ids(filterHands(hands, { tagIds: ['t-3bet'] }))).toEqual(['a', 'b'])
    expect(ids(filterHands(hands, { tagIds: ['t-3bet', 't-bluff'] }))).toEqual(['b'])
  })

  it('filters by date range (inclusive)', () => {
    expect(ids(filterHands(hands, { from: 100, to: 200 }))).toEqual(['a', 'b'])
  })

  it('searches notes, tag names and positions', () => {
    expect(ids(filterHands(hands, { text: 'barrelled' }, tagMap))).toEqual(['b'])
    expect(ids(filterHands(hands, { text: 'bluff' }, tagMap))).toEqual(['b'])
    expect(ids(filterHands(hands, { text: 'btn' }, tagMap))).toEqual(['a'])
  })

  it('counts active filters', () => {
    expect(activeFilterCount({})).toBe(0)
    expect(activeFilterCount({ positions: ['BTN'], from: 1, to: 2, text: 'x' })).toBe(2)
  })
})

describe('reviewQueue', () => {
  it('lists flagged unreviewed hands oldest first', () => {
    expect(ids(reviewQueue(hands))).toEqual(['a', 'b'])
  })
})

describe('validateHand', () => {
  it('reports duplicate cards and board/action mismatches', () => {
    const h = hand('x', {
      heroPosition: 'BTN',
      hole: { kind: 'exact', cards: ['As', 'Kd'] },
      board: ['As', '7c'],
      wentTo: 'preflop',
      actions: [{ id: '1', street: 'flop', position: 'SB', type: 'check' }],
    })
    const messages = validateHand(h, replayHand(setupFromHand(h))).map((i) => i.message)
    expect(messages).toContain('A♠ is used more than once')
    expect(messages).toContain('The board has 2 cards; a flop needs 3')
    expect(messages).toContain("Marked as ending on the preflop, but there's flop action")
    expect(messages).toContain('Add your starting stack to see effective stacks and SPR')
  })
})
