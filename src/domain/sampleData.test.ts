import { describe, expect, it } from 'vitest'
import { findDuplicates } from './cards'
import { replayHand, setupFromHand } from './engine'
import { knownCards } from './hand'
import { buildSampleData } from './sampleData'
import { validateHand } from './validation'

let n = 0
const data = buildSampleData(Date.UTC(2026, 8, 30, 12), () => `id${n++}`, (name) => `tag:${name}`)

describe('sample data', () => {
  it('has a handful of sessions and about 20 hands', () => {
    expect(data.sessions).toHaveLength(5)
    expect(data.hands.length).toBeGreaterThanOrEqual(20)
    expect(data.sessions.some((s) => s.gameType === 'tournament')).toBe(true)
  })

  it('every hand replays and validates cleanly', () => {
    for (const h of data.hands) {
      const issues = validateHand(h, replayHand(setupFromHand(h)))
      expect({ hand: h.note, issues: issues.map((i) => i.message) }).toEqual({ hand: h.note, issues: [] })
    }
  })

  it('never reuses a card within a hand', () => {
    for (const h of data.hands) expect(findDuplicates(knownCards(h))).toEqual([])
  })

  it('derives results from the action', () => {
    const aks = data.hands.find((h) => h.note.startsWith('3bet AKs'))!
    // Pot 136 after the turn bet is returned; hero put in 36 + 30.
    expect(aks.result).toBe(70)
    const kk = data.hands.find((h) => h.note === 'KK vs AA, standard')!
    expect(kk.result).toBe(-1000)
    const tourney = data.hands.find((h) => h.note.startsWith('Opened AK'))!
    expect(tourney.unit).toBe('bb')
    expect(tourney.result).toBe(47.5)
  })

  it('marks everything as sample data and uses supplied tag ids', () => {
    expect(data.hands.every((h) => h.sample)).toBe(true)
    expect(data.sessions.every((s) => s.sample)).toBe(true)
    expect(data.hands.flatMap((h) => h.tagIds).every((t) => t.startsWith('tag:'))).toBe(true)
  })
})
