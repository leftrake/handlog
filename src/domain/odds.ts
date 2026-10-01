// Pot odds and outs-to-equity math, with the formulas shown alongside results in the UI.
import { round2 } from './money'

export interface PotOdds {
  /** Amount you must put in to call. */
  toCall: number
  /** Pot before your call, including every bet already made (villain's bet too). */
  potBefore: number
  /** Pot after your call. */
  potAfterCall: number
  /** Minimum share of the final pot you need for a break-even call: toCall ÷ potAfterCall. */
  requiredEquity: number
  /** Pot-to-call ratio, e.g. 3 means "3 to 1". */
  ratio: number
}

/** Pot odds for calling `toCall` into a pot of `potBefore` (which already includes the bet you face). */
export function potOdds(potBefore: number, toCall: number): PotOdds | null {
  if (!(toCall > 0) || !(potBefore >= 0)) return null
  const potAfterCall = round2(potBefore + toCall)
  return {
    toCall: round2(toCall),
    potBefore: round2(potBefore),
    potAfterCall,
    requiredEquity: toCall / potAfterCall,
    ratio: potBefore / toCall,
  }
}

/**
 * Pot odds when facing a single bet: `pot` is the pot before the bet, `bet` is the bet you face,
 * `invested` is what you already have in on this street (e.g. a bet you're being raised over).
 */
export function potOddsFacingBet(pot: number, bet: number, invested = 0): PotOdds | null {
  const toCall = bet - invested
  return potOdds(pot + bet + invested, toCall)
}

export type DrawStreet = 'flop' | 'turn'

export interface EquityEstimate {
  label: string
  ruleName: 'Rule of 2' | 'Rule of 4'
  /** Rule-of-thumb percentage (0–100). */
  rule: number
  ruleFormula: string
  /** Exact percentage (0–100). */
  exact: number
  exactFormula: string
}

function choose2(n: number): number {
  return (n * (n - 1)) / 2
}

/**
 * Chance of hitting one of `outs` cards.
 * Flop: by the turn (one card, 47 unseen) and by the river (two cards). Turn: by the river (46 unseen).
 * Rule of 2 and 4: outs × 2 for one card, outs × 4 for two cards.
 */
export function outsEquity(outs: number, street: DrawStreet): EquityEstimate[] {
  const o = Math.max(0, Math.min(Math.floor(outs), street === 'flop' ? 47 : 46))
  if (street === 'turn') {
    return [
      {
        label: 'River (1 card)',
        ruleName: 'Rule of 2',
        rule: Math.min(100, o * 2),
        ruleFormula: `${o} × 2`,
        exact: (o / 46) * 100,
        exactFormula: `${o} ÷ 46`,
      },
    ]
  }
  const missBoth = choose2(47 - o) / choose2(47)
  return [
    {
      label: 'Turn (1 card)',
      ruleName: 'Rule of 2',
      rule: Math.min(100, o * 2),
      ruleFormula: `${o} × 2`,
      exact: (o / 47) * 100,
      exactFormula: `${o} ÷ 47`,
    },
    {
      label: 'Turn or river (2 cards)',
      ruleName: 'Rule of 4',
      rule: Math.min(100, o * 4),
      ruleFormula: `${o} × 4`,
      exact: (1 - missBoth) * 100,
      exactFormula: `1 − C(${47 - o},2) ÷ C(47,2) = 1 − (${47 - o}×${46 - o}) ÷ (47×46)`,
    },
  ]
}

/** How often a bet of `bet` into `pot` must make villain fold to break even: bet ÷ (pot + bet). */
export function bluffBreakEven(pot: number, bet: number): number | null {
  if (!(bet > 0) || !(pot >= 0)) return null
  return bet / (pot + bet)
}
