import { describe, expect, it } from 'vitest'
import { bluffBreakEven, outsEquity, potOdds, potOddsFacingBet } from './odds'

describe('pot odds', () => {
  it('computes required equity as call ÷ pot after calling', () => {
    // $100 pot, villain bets $50: pot before call is 150, call 50, final 200 → 25%
    const o = potOddsFacingBet(100, 50)!
    expect(o.toCall).toBe(50)
    expect(o.potBefore).toBe(150)
    expect(o.potAfterCall).toBe(200)
    expect(o.requiredEquity).toBeCloseTo(0.25)
    expect(o.ratio).toBeCloseTo(3)
  })

  it('handles a pot-sized bet (33%) and an all-in for less', () => {
    expect(potOddsFacingBet(60, 60)!.requiredEquity).toBeCloseTo(1 / 3)
    expect(potOdds(136, 45)!.requiredEquity).toBeCloseTo(45 / 181)
  })

  it('accounts for chips already invested when facing a raise', () => {
    // Hero bet 20 into 40, villain raised to 60: pot = 40 + 60 + 20 = 120, call 40 → 40/160
    const o = potOddsFacingBet(40, 60, 20)!
    expect(o.toCall).toBe(40)
    expect(o.potAfterCall).toBe(160)
    expect(o.requiredEquity).toBeCloseTo(0.25)
  })

  it('returns null with nothing to call', () => {
    expect(potOdds(100, 0)).toBeNull()
    expect(potOddsFacingBet(100, 0)).toBeNull()
  })
})

describe('outs to equity', () => {
  it('flush draw on the flop: rule of 2 and 4 vs exact', () => {
    const [turn, both] = outsEquity(9, 'flop')
    expect(turn.rule).toBe(18)
    expect(turn.exact).toBeCloseTo(19.15, 1)
    expect(both.rule).toBe(36)
    expect(both.exact).toBeCloseTo(34.97, 1)
    expect(both.exactFormula).toContain('C(38,2)')
  })

  it('open-ender on the turn', () => {
    const [river] = outsEquity(8, 'turn')
    expect(river.rule).toBe(16)
    expect(river.exact).toBeCloseTo(17.39, 1)
  })

  it('caps the rule of 4 at 100% and clamps silly inputs', () => {
    expect(outsEquity(30, 'flop')[1].rule).toBe(100)
    expect(outsEquity(-3, 'flop')[0].exact).toBe(0)
    expect(outsEquity(47, 'flop')[1].exact).toBeCloseTo(100)
  })
})

describe('bluff break-even', () => {
  it('is bet ÷ (pot + bet)', () => {
    expect(bluffBreakEven(100, 50)).toBeCloseTo(1 / 3)
    expect(bluffBreakEven(100, 0)).toBeNull()
  })
})
