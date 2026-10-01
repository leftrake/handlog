import { describe, expect, it } from 'vitest'
import { replayHand, setupFromHand } from './engine'
import { buildFrames } from './frames'
import { buildSampleData } from './sampleData'

let n = 0
const { hands } = buildSampleData(Date.UTC(2026, 8, 30), () => `id${n++}`, (t) => t)
const fmt = (x: number) => `$${x}`
const framesFor = (note: string) => {
  const hand = hands.find((h) => h.note.startsWith(note))!
  return buildFrames(hand, replayHand(setupFromHand(hand)), fmt)
}

describe('replayer frames', () => {
  it('starts with the blinds and ends with the result', () => {
    const frames = framesFor('3bet AKs')
    expect(frames[0]).toMatchObject({ kind: 'start', caption: 'Blinds $1/$3' })
    const end = frames.at(-1)!
    expect(end.kind).toBe('end')
    expect(end.caption).toBe('You win $136 · $75 uncalled returned to BTN · Net +$70')
  })

  it('inserts a deal frame at each new street', () => {
    const frames = framesFor('3bet AKs')
    const deals = frames.filter((f) => f.kind === 'deal').map((f) => f.caption)
    expect(deals).toEqual(['Flop · pot $76', 'Turn · pot $136'])
  })

  it('shows pot odds before each hero decision', () => {
    const frames = framesFor('3bet AKs')
    // The frame before hero's 3bet: CO opened to 12, so hero faces 12 into 16.
    const before3bet = frames.find((f) => f.caption === 'CO raises to $12')!
    expect(before3bet.decision?.toCall).toBe(12)
    expect(before3bet.decision?.odds?.potAfterCall).toBe(28)
    expect(before3bet.decision?.odds?.requiredEquity).toBeCloseTo(12 / 28)
    // On the flop deal frame CO is first to act, so there's no hero decision yet.
    expect(frames.find((f) => f.caption === 'Flop · pot $76')!.decision).toBeNull()
    // After CO checks, hero decides with nothing to call.
    const afterCheck = frames.find((f) => f.caption === 'CO checks')!
    expect(afterCheck.decision).toEqual({ toCall: 0, odds: null })
  })

  it('deals out the runout after an all-in and reveals at the end', () => {
    const frames = framesFor('KK vs AA')
    const deals = frames.filter((f) => f.kind === 'deal').map((f) => f.street)
    expect(deals).toEqual(['flop', 'turn', 'river'])
    expect(frames.at(-1)).toMatchObject({ kind: 'end', reveal: true })
    expect(frames.at(-1)!.caption).toContain('Showdown')
  })

  it('describes hero actions in the second person', () => {
    const captions = framesFor('3bet AKs').map((f) => f.caption)
    expect(captions).toContain('You (BTN) raise to $36')
    expect(captions).toContain('You (BTN) bet $30')
  })
})
