// Turns a replay into step-through frames for the hand replayer: the deal of each street,
// every action, any all-in runout, and the result — plus pot odds whenever the hero acts next.
import { advanceTo, type Issue, type Replay, type Step, type TableState } from './engine'
import { potOdds, type PotOdds } from './odds'
import { positionLabel } from './positions'
import { STREETS, type Hand, type Position, type Street, type TableSize } from './types'

export type FrameKind = 'start' | 'deal' | 'action' | 'end'

export interface HeroDecision {
  toCall: number
  /** Null when there's nothing to call. */
  odds: PotOdds | null
}

export interface Frame {
  kind: FrameKind
  state: TableState
  street: Street
  caption: string
  /** Seat that just acted (highlighted). */
  actor: Position | null
  issues: Issue[]
  /** Set when the next action is the hero's: the decision they face. */
  decision: HeroDecision | null
  /** Show villains' shown cards (at the end of the hand). */
  reveal: boolean
}

const BOARD_FOR_STREET: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 }
const STREET_NAME: Record<Street, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' }

/** Number of board cards visible on a street. */
export function boardCount(street: Street): number {
  return BOARD_FOR_STREET[street]
}

function describe(step: Step, hero: Position | null, size: TableSize, fmt: (n: number) => string): string {
  const a = step.action
  const who = a.position === hero ? `You (${positionLabel(a.position, size)})` : positionLabel(a.position, size)
  const you = a.position === hero
  const to = step.after.seats.find((s) => s.position === a.position)?.committed ?? 0
  switch (a.type) {
    case 'fold':
      return `${who} ${you ? 'fold' : 'folds'}`
    case 'check':
      return `${who} ${you ? 'check' : 'checks'}`
    case 'call':
      return `${who} ${you ? 'call' : 'calls'} ${fmt(step.put)}`
    case 'bet':
      return `${who} ${you ? 'bet' : 'bets'} ${fmt(to)}`
    case 'raise':
      return `${who} ${you ? 'raise' : 'raises'} to ${fmt(to)}`
    case 'allin':
      return `${who} ${you ? 'are' : 'is'} all-in${step.put > 0 ? ` for ${fmt(to)}` : ''}`
  }
}

function decisionFor(step: Step | undefined, hero: Position | null): HeroDecision | null {
  if (!step || !hero || step.action.position !== hero) return null
  return { toCall: step.toCall, odds: potOdds(step.before.pot, step.toCall) }
}

export function buildFrames(hand: Hand, replay: Replay, fmt: (n: number) => string): Frame[] {
  const hero = hand.heroPosition
  const setup = { tableSize: hand.tableSize, bb: hand.bb }
  const steps = replay.steps
  const frames: Frame[] = []
  const blinds = [`Blinds ${fmt(hand.sb)}/${fmt(hand.bb)}`]
  if (hand.straddle) blinds.push(`straddle ${fmt(hand.straddle)}`)
  if (hand.ante) blinds.push(`BB ante ${fmt(hand.ante)}`)

  frames.push({
    kind: 'start',
    state: replay.initial,
    street: 'preflop',
    caption: blinds.join(', '),
    actor: null,
    issues: [],
    decision: decisionFor(steps[0], hero),
    reveal: false,
  })

  let street: Street = 'preflop'
  let last = replay.initial
  steps.forEach((step, i) => {
    if (STREETS.indexOf(step.action.street) > STREETS.indexOf(street)) {
      for (let k = STREETS.indexOf(street) + 1; k <= STREETS.indexOf(step.action.street); k++) {
        street = STREETS[k]
        const state = advanceTo(step.before, setup, street)
        frames.push({
          kind: 'deal',
          state,
          street,
          caption: `${STREET_NAME[street]} · pot ${fmt(state.pot)}`,
          actor: null,
          issues: [],
          decision: street === step.action.street ? decisionFor(step, hero) : null,
          reveal: false,
        })
      }
    }
    frames.push({
      kind: 'action',
      state: step.after,
      street,
      caption: describe(step, hero, hand.tableSize, fmt),
      actor: step.action.position,
      issues: step.issues,
      decision: decisionFor(steps[i + 1], hero),
      reveal: false,
    })
    last = step.after
  })

  // Deal any remaining board cards (all-in runout, or checked-down streets with no logged action).
  const final = replay.final
  if (!final.handOver) {
    const shownStreets = STREETS.filter((s) => BOARD_FOR_STREET[s] <= hand.board.length && BOARD_FOR_STREET[s] > 0)
    for (const s of shownStreets) {
      if (STREETS.indexOf(s) <= STREETS.indexOf(street)) continue
      street = s
      last = advanceTo(last, setup, s)
      frames.push({ kind: 'deal', state: last, street: s, caption: `${STREET_NAME[s]} · pot ${fmt(last.pot)}`, actor: null, issues: [], decision: null, reveal: false })
    }
  }

  // Result.
  const parts: string[] = []
  if (final.handOver) {
    const winner = final.seats.find((s) => !s.folded)
    if (winner) parts.push(`${winner.position === hero ? 'You win' : `${positionLabel(winner.position, hand.tableSize)} wins`} ${fmt(replay.finalPot)}`)
  } else {
    parts.push(hand.wentTo === 'showdown' ? `Showdown · pot ${fmt(replay.finalPot)}` : `Pot ${fmt(replay.finalPot)}`)
  }
  if (replay.uncalled) parts.push(`${fmt(replay.uncalled.amount)} uncalled returned to ${positionLabel(replay.uncalled.position, hand.tableSize)}`)
  if (hand.result !== null) parts.push(hand.result >= 0 ? `Net +${fmt(hand.result)}` : `Net −${fmt(-hand.result)}`)
  frames.push({ kind: 'end', state: last, street, caption: parts.join(' · '), actor: null, issues: [], decision: null, reveal: true })

  return frames
}
