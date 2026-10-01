import { describe, expect, it } from 'vitest'
import { analysisText } from './analysisText'
import { backupAge, buildBackup, parseBackup, planMerge } from './backup'
import { csvCell, handsToCsv } from './csv'
import { createHand } from './hand'
import { buildSampleData } from './sampleData'
import { DEFAULT_SETTINGS, type Hand, type Tag } from './types'

let n = 0
const sample = buildSampleData(Date.UTC(2026, 8, 30, 12), () => `id${n++}`, (name) => `tag-${name}`)
const sampleTags: Tag[] = sample.tagNames.map((name, order) => ({ id: `tag-${name}`, name, order }))
const backup = buildBackup({ sessions: sample.sessions, hands: sample.hands, tags: sampleTags, settings: DEFAULT_SETTINGS }, 1000)

describe('backup', () => {
  it('round-trips through JSON', () => {
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.backup.hands).toHaveLength(sample.hands.length)
  })

  it('rejects files that are not HandLog backups', () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false })
    expect(parseBackup('{"app":"other"}')).toMatchObject({ ok: false })
    expect(parseBackup(JSON.stringify({ ...backup, version: 99 }))).toMatchObject({ ok: false })
    expect(parseBackup(JSON.stringify({ ...backup, hands: [{ nope: 1 }] }))).toMatchObject({ ok: false })
  })

  it('adds everything into an empty database', () => {
    const plan = planMerge({ sessions: [], hands: [], tags: [] }, backup)
    expect(plan.counts.hands.added).toBe(sample.hands.length)
    expect(plan.counts.sessions.added).toBe(sample.sessions.length)
  })

  it('never duplicates hands when the same backup is imported again', () => {
    const plan = planMerge({ sessions: sample.sessions, hands: sample.hands, tags: sampleTags }, backup)
    expect(plan.hands).toEqual([])
    expect(plan.sessions).toEqual([])
    expect(plan.counts.hands).toEqual({ added: 0, updated: 0, unchanged: sample.hands.length })
  })

  it('keeps the newer copy of an edited hand', () => {
    const [first, second, ...rest] = sample.hands
    const localNewer: Hand = { ...first, note: 'edited on this phone', updatedAt: first.updatedAt + 10 }
    const incomingNewer: Hand = { ...second, note: 'edited on the laptop', updatedAt: second.updatedAt + 10 }
    const plan = planMerge(
      { sessions: sample.sessions, hands: [localNewer, second, ...rest], tags: sampleTags },
      { ...backup, hands: [first, incomingNewer, ...rest] },
    )
    expect(plan.hands.map((h) => h.note)).toEqual(['edited on the laptop'])
    expect(plan.counts.hands).toEqual({ added: 0, updated: 1, unchanged: sample.hands.length - 1 })
  })

  it('maps tags by name onto existing local tags', () => {
    const localBluff: Tag = { id: 'local-bluff', name: 'bluff', order: 0 }
    const plan = planMerge({ sessions: [], hands: [], tags: [localBluff] }, backup)
    expect(plan.tags.find((t) => t.name === 'Bluff')).toBeUndefined()
    const bluffHand = plan.hands.find((h) => h.note.startsWith('Triple barrel'))!
    expect(bluffHand.tagIds).toEqual(['local-bluff'])
    expect(plan.tags.every((t) => t.order >= 1)).toBe(true)
  })
})

describe('backup age', () => {
  const day = 86_400_000
  it('labels and flags stale backups', () => {
    expect(backupAge(null, 0)).toMatchObject({ label: 'Never backed up', stale: true })
    expect(backupAge(10 * day, 10 * day + 1000)).toMatchObject({ label: 'Backed up today', stale: false })
    expect(backupAge(day, 9 * day)).toMatchObject({ label: 'Last backup 8 days ago', stale: true })
  })
})

describe('csv', () => {
  it('quotes and escapes per RFC 4180 and blocks formula injection', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a, b')).toBe('"a, b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell(-290)).toBe('-290')
    expect(csvCell(null)).toBe('')
    expect(csvCell(true)).toBe('yes')
  })

  it('writes one row per hand with a header', () => {
    const csv = handsToCsv(sample.hands, {
      tags: new Map(sampleTags.map((t) => [t.id, t])),
      sessions: new Map(sample.sessions.map((s) => [s.id, s])),
    })
    const lines = csv.replace('﻿', '').trim().split('\r\n')
    expect(lines[0].startsWith('date,time,location,game,stakes')).toBe(true)
    expect(lines).toHaveLength(sample.hands.length + 1)
    const qq = lines.find((l) => l.includes('Qh Qd'))!
    expect(qq).toContain('Bellagio')
    expect(qq).toContain(',-290,money,-96.67,')
  })
})

describe('analysis text', () => {
  const tags = new Map(sampleTags.map((t) => [t.id, t]))
  const qq = sample.hands.find((h) => h.note.startsWith('BB squeezed'))!
  const session = sample.sessions.find((s) => s.id === qq.sessionId)!
  const text = analysisText(qq, { tags, session, currencySymbol: '$' })

  it('describes stakes, players, action by street with pots, and the result', () => {
    expect(text).toContain('NLHE cash $1/$3, 9-handed (live).')
    expect(text).toContain('Hero: UTG+1, Qh Qd, stack $290 (96.67 BB)')
    expect(text).toContain('- BB: $350 (116.67 BB) · Older reg, tight · Reads: Rarely squeezes light. Bets big for value.')
    expect(text).toContain('PREFLOP (pot $4): UTG folds, Hero raises to $15, MP, LJ, HJ, CO fold, BTN calls $15, SB folds, BB raises to $60, Hero calls $45, BTN folds')
    expect(text).toContain('FLOP [Ac 8d 4s] (pot $136, SPR 1.7): BB bets $70, Hero calls $70')
    expect(text).toContain('TURN [2c] (pot $276, SPR 0.6): BB bets $160, Hero calls $160 (all-in)')
    expect(text).toContain('RIVER [Ks] (pot $596)')
    expect(text).toContain('BB shows Ah Kh')
    expect(text).toContain('Result: Hero lost $290 (−96.67 BB). Final pot $596.')
    expect(text).toContain('My question: Versus a tight squeezer')
  })

  it('handles a quick capture with no action', () => {
    const h = createHand({ sessionId: null, gameType: 'cash', tableSize: 9, unit: 'money', sb: 1, bb: 2 }, 'q', 0)
    h.hole = { kind: 'class', handClass: 'T9s' }
    h.heroPosition = 'SB'
    h.result = 210
    h.wentTo = 'river'
    const t = analysisText(h, { currencySymbol: '$' })
    expect(t).toContain('Hero: SB, T9s (suits not recorded)')
    expect(t).toContain('(Street-by-street action not recorded.)')
    expect(t).toContain('Result: Hero won $210 (+105 BB).')
  })

  it('prints in big blinds for tournament hands', () => {
    const ak = sample.hands.find((h) => h.note.startsWith('Opened AK'))!
    const t = analysisText(ak, { currencySymbol: '$' })
    expect(t).toContain('NLHE tournament, 9-handed, Level 5, 200/400 (400 ante). Amounts in big blinds.')
    expect(t).toContain('BTN goes all-in for 45 BB')
  })
})

