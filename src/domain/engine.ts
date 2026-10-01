// Replays a hand's action list: pot after every action, stacks, whose turn it is, effective
// stacks and SPR per street, and problems with the sequence. Problems are reported, never thrown,
// so a half-entered or slightly wrong hand still replays as far as it sensibly can.
import { round2 } from './money'
import { positionLabel, positionsFor, postflopOrder, preflopOrder, STRADDLE_POSITION } from './positions'
import { STREETS, type Action, type ActionType, type Player, type Position, type Street, type TableSize } from './types'

export type IssueSeverity = 'error' | 'warning'

export interface Issue {
  severity: IssueSeverity
  message: string
  /** The action the issue is about, if any. */
  actionId?: string
}

export interface Seat {
  position: Position
  startStack: number | null
  /** Chips behind. Null when the starting stack is unknown (treated as deep enough for any bet). */
  stack: number | null
  /** Chips committed on the current street. */
  committed: number
  /** Chips put in over the whole hand, including antes. */
  invested: number
  folded: boolean
  allIn: boolean
  /** Has acted since the last full raise on this street. */
  acted: boolean
  /** False after a short all-in that didn't reopen the betting to this player. */
  canRaise: boolean
}

export interface TableState {
  street: Street
  /** Everything in the middle, including bets on the current street. */
  pot: number
  /** Highest commitment on the current street. */
  currentBet: number
  /** Size of the last full bet/raise increment (the minimum re-raise increment). */
  lastRaise: number
  /** Seats in preflop order (UTG … BB). */
  seats: Seat[]
  toAct: Position | null
  /** No one left to act on this street. */
  roundComplete: boolean
  /** One player (or none) left who hasn't folded. */
  handOver: boolean
}

export interface Step {
  index: number
  action: Action
  before: TableState
  after: TableState
  /** What the actor needed to call before acting. */
  toCall: number
  /** Chips the actor put in with this action. */
  put: number
  issues: Issue[]
}

export interface StreetSummary {
  street: Street
  potStart: number
  players: Position[]
  /** Hero vs the deepest opponent still in, at the start of the street. Null if stacks unknown. */
  effectiveStack: number | null
  /** Effective stack ÷ pot at the start of the street (postflop only). */
  spr: number | null
}

export interface HandSetup {
  tableSize: TableSize
  sb: number
  bb: number
  straddle?: number
  ante?: number
  heroPosition: Position | null
  players: readonly Player[]
  actions: readonly Action[]
}

export interface Replay {
  initial: TableState
  steps: Step[]
  final: TableState
  streets: StreetSummary[]
  issues: Issue[]
  /** Bet nobody called, returned to its owner when the hand ends. */
  uncalled: { position: Position; amount: number } | null
  /** Final pot after any uncalled bet is returned. */
  finalPot: number
}

// ── helpers ──────────────────────────────────────────────

const STREET_LABEL: Record<Street, string> = { preflop: 'preflop', flop: 'flop', turn: 'turn', river: 'river' }

function cloneState(s: TableState): TableState {
  return { ...s, seats: s.seats.map((x) => ({ ...x })) }
}

function seatOf(s: TableState, p: Position): Seat | undefined {
  return s.seats.find((x) => x.position === p)
}

function needsToAct(seat: Seat, s: TableState): boolean {
  return !seat.folded && !seat.allIn && (!seat.acted || seat.committed < s.currentBet)
}

function actionOrder(s: TableState, size: TableSize, straddle: boolean): Position[] {
  return s.street === 'preflop' ? preflopOrder(size, straddle) : postflopOrder(size)
}

/** Next seat that still has to act, starting after `after` (or from the top of the order). */
function nextToAct(s: TableState, size: TableSize, straddle: boolean, after: Position | null): Position | null {
  const canBet = s.seats.filter((x) => !x.folded && !x.allIn)
  if (canBet.length <= 1 && canBet.every((x) => x.committed >= s.currentBet)) return null
  const order = actionOrder(s, size, straddle)
  const start = after ? order.indexOf(after) + 1 : 0
  for (let i = 0; i < order.length; i++) {
    const seat = seatOf(s, order[(start + i) % order.length])
    if (seat && needsToAct(seat, s)) return seat.position
  }
  return null
}

function put(s: TableState, seat: Seat, amount: number, intoStreet = true): number {
  const actual = round2(seat.stack === null ? amount : Math.min(amount, seat.stack))
  if (seat.stack !== null) seat.stack = round2(seat.stack - actual)
  if (intoStreet) seat.committed = round2(seat.committed + actual)
  seat.invested = round2(seat.invested + actual)
  s.pot = round2(s.pot + actual)
  if (seat.stack === 0) seat.allIn = true
  return actual
}

function refresh(s: TableState, size: TableSize, straddle: boolean, after: Position | null): void {
  const live = s.seats.filter((x) => !x.folded)
  s.handOver = live.length <= 1
  s.toAct = s.handOver ? null : nextToAct(s, size, straddle, after)
  s.roundComplete = s.toAct === null
}

/** True when betting is finished for the rest of the hand (at most one player can still bet). */
export function isRunout(s: TableState): boolean {
  if (s.handOver) return false
  const canBet = s.seats.filter((x) => !x.folded && !x.allIn)
  return s.roundComplete && canBet.length <= 1
}

function advanceStreet(s: TableState, size: TableSize, bb: number): void {
  const i = STREETS.indexOf(s.street)
  s.street = STREETS[Math.min(i + 1, STREETS.length - 1)]
  s.currentBet = 0
  s.lastRaise = bb
  for (const seat of s.seats) {
    seat.committed = 0
    seat.acted = false
    seat.canRaise = true
  }
  refresh(s, size, false, null)
}

function effectiveFor(s: TableState, hero: Position | null, useStart: boolean): number | null {
  if (!hero) return null
  const h = seatOf(s, hero)
  if (!h || h.folded) return null
  const heroStack = useStart ? h.startStack : h.stack
  if (heroStack === null) return null
  const opp = s.seats
    .filter((x) => x.position !== hero && !x.folded)
    .map((x) => (useStart ? x.startStack : x.stack))
    .filter((x): x is number => x !== null)
  if (opp.length === 0) return null
  return round2(Math.min(heroStack, Math.max(...opp)))
}

function summarize(s: TableState, hero: Position | null): StreetSummary {
  const preflop = s.street === 'preflop'
  const effectiveStack = effectiveFor(s, hero, preflop)
  return {
    street: s.street,
    potStart: s.pot,
    players: s.seats.filter((x) => !x.folded).map((x) => x.position),
    effectiveStack,
    spr: !preflop && effectiveStack !== null && s.pot > 0 ? round2(effectiveStack / s.pot) : null,
  }
}

// ── setup ────────────────────────────────────────────────

export function initialState(setup: HandSetup): TableState {
  const stacks = new Map(setup.players.map((p) => [p.position, p.stack]))
  const seats: Seat[] = positionsFor(setup.tableSize).map((position) => {
    const start = stacks.get(position) ?? null
    return {
      position,
      startStack: start,
      stack: start,
      committed: 0,
      invested: 0,
      folded: false,
      allIn: false,
      acted: false,
      canRaise: true,
    }
  })
  const s: TableState = {
    street: 'preflop',
    pot: 0,
    currentBet: 0,
    lastRaise: setup.bb,
    seats,
    toAct: null,
    roundComplete: false,
    handOver: false,
  }
  const bbSeat = seatOf(s, 'BB')!
  if (setup.ante) put(s, bbSeat, setup.ante, false)
  put(s, seatOf(s, 'SB')!, setup.sb)
  put(s, bbSeat, setup.bb)
  if (setup.straddle) put(s, seatOf(s, STRADDLE_POSITION)!, setup.straddle)
  s.currentBet = Math.max(...s.seats.map((x) => x.committed))
  s.lastRaise = setup.straddle ? setup.straddle : setup.bb
  refresh(s, setup.tableSize, !!setup.straddle, null)
  return s
}

// ── replay ───────────────────────────────────────────────

export function replayHand(setup: HandSetup): Replay {
  const { tableSize: size, bb } = setup
  const straddle = !!setup.straddle
  const hero = setup.heroPosition
  const initial = initialState(setup)
  const s = cloneState(initial)
  const steps: Step[] = []
  const streets: StreetSummary[] = [summarize(s, hero)]
  const allIssues: Issue[] = []

  setup.actions.forEach((action, index) => {
    const before = cloneState(s)
    const issues: Issue[] = []
    const issue = (severity: IssueSeverity, message: string) => issues.push({ severity, message, actionId: action.id })
    const who = positionLabel(action.position)
    let toCall = 0
    let chips = 0

    const record = () => {
      steps.push({ index, action, before, after: cloneState(s), toCall, put: chips, issues })
      allIssues.push(...issues)
    }

    if (s.handOver) {
      issue('error', `${who} acts after the hand was over`)
      return record()
    }

    const target = STREETS.indexOf(action.street)
    const current = STREETS.indexOf(s.street)
    if (target < current) {
      issue('error', `${STREET_LABEL[action.street]} action is listed after ${STREET_LABEL[s.street]} action`)
    } else if (target > current) {
      if (isRunout(s)) {
        issue('error', `No betting is possible on the ${STREET_LABEL[action.street]}: everyone left is all-in`)
        return record()
      }
      if (s.toAct) {
        issue('warning', `${STREET_LABEL[s.street]} betting wasn't finished: ${positionLabel(s.toAct)} still had to act`)
      }
      while (STREETS.indexOf(s.street) < target) {
        advanceStreet(s, size, bb)
        streets.push(summarize(s, hero))
      }
    }

    const seat = seatOf(s, action.position)
    if (!seat) {
      issue('error', `${who} isn't a seat at a ${size}-handed table`)
      return record()
    }
    if (seat.folded) {
      issue('error', `${who} already folded`)
      return record()
    }
    if (seat.allIn) {
      issue('error', `${who} is already all-in`)
      return record()
    }
    if (s.toAct && s.toAct !== action.position) {
      issue('error', `Out of turn: ${positionLabel(s.toAct)} acts before ${who}`)
    } else if (!s.toAct) {
      issue('error', `${STREET_LABEL[s.street]} betting was already closed when ${who} acted`)
    }

    toCall = round2(Math.max(0, s.currentBet - seat.committed))
    const maxTo = seat.stack === null ? Infinity : round2(seat.committed + seat.stack)
    let type: ActionType = action.type

    if (type === 'fold') {
      if (toCall === 0) issue('warning', `${who} folded when they could check`)
      seat.folded = true
    } else if (type === 'check') {
      if (toCall > 0) issue('error', `${who} can't check facing a bet (${toCall} to call)`)
    } else if (type === 'call') {
      if (toCall === 0) issue('error', `Nothing to call: ${who} should check`)
      else chips = put(s, seat, toCall)
    } else {
      // bet / raise / all-in, all expressed as a "to" amount for the street
      let to: number | null
      if (type === 'allin') {
        to = seat.stack !== null ? maxTo : (action.amount ?? null)
        if (to === null) issue('error', `All-in amount unknown: add ${who}'s starting stack or an amount`)
      } else {
        to = action.amount ?? null
        if (to === null || !(to > 0)) {
          issue('error', `${who}'s ${type} needs an amount`)
          to = null
        } else if (to > maxTo) {
          issue('error', `${who} only had ${maxTo}, so this is treated as all-in`)
          to = maxTo
        }
        if (type === 'bet' && s.currentBet > 0) {
          issue('warning', `There's already a bet, so ${who}'s bet is a raise`)
          type = 'raise'
        } else if (type === 'raise' && s.currentBet === 0) {
          issue('warning', `Nothing to raise, so ${who}'s raise is a bet`)
          type = 'bet'
        }
      }

      if (to !== null) {
        to = round2(to)
        const isAllIn = action.type === 'allin' || to >= maxTo
        if (to <= s.currentBet) {
          // An all-in for less (or exactly) is a call; anything else is a mis-sized raise, treated as a call.
          if (!isAllIn) issue('error', `${who}'s ${type} to ${to} isn't more than the current bet of ${s.currentBet}`)
          chips = put(s, seat, Math.max(0, to - seat.committed))
        } else {
          const increment = round2(to - s.currentBet)
          const minTo = s.currentBet === 0 ? bb : round2(s.currentBet + s.lastRaise)
          if (s.currentBet > 0 && !seat.canRaise) {
            issue('error', `${who} can't re-raise: the short all-in didn't reopen the betting`)
          }
          if (to < minTo && !isAllIn) {
            issue('error', `${who}'s ${s.currentBet === 0 ? 'bet' : 'raise'} to ${to} is below the minimum (${minTo})`)
          }
          chips = put(s, seat, to - seat.committed)
          const full = s.currentBet === 0 || increment >= s.lastRaise
          for (const other of s.seats) {
            if (other === seat || other.folded || other.allIn) continue
            if (full) {
              other.acted = false
              other.canRaise = true
            } else if (other.acted) {
              // A short all-in: players who already acted may only call or fold.
              other.canRaise = false
            }
          }
          if (full) s.lastRaise = s.currentBet === 0 ? Math.max(to, bb) : increment
          s.currentBet = to
        }
        if (action.type === 'allin') seat.allIn = true
      }
    }
    seat.acted = true
    refresh(s, size, straddle && s.street === 'preflop', action.position)
    record()
  })

  // Uncalled bet: the top commitment on the last street that nobody matched.
  let uncalled: Replay['uncalled'] = null
  if (s.handOver || s.roundComplete) {
    const sorted = [...s.seats].sort((a, b) => b.committed - a.committed)
    const [top, second] = sorted
    if (top && top.committed > (second?.committed ?? 0)) {
      uncalled = { position: top.position, amount: round2(top.committed - (second?.committed ?? 0)) }
    }
  }

  return {
    initial,
    steps,
    final: s,
    streets,
    issues: allIssues,
    uncalled,
    finalPot: round2(s.pot - (uncalled?.amount ?? 0)),
  }
}

// ── helpers for the editor ──────────────────────────────

export interface NextActor {
  street: Street
  position: Position
}

/** Who acts next, moving to the next street when the current betting round is closed. */
export function nextActor(replay: Replay, setup: Pick<HandSetup, 'tableSize' | 'bb'>): NextActor | null {
  const s = replay.final
  if (s.handOver) return null
  if (s.toAct) return { street: s.street, position: s.toAct }
  if (s.street === 'river' || isRunout(s)) return null
  const probe = cloneState(s)
  advanceStreet(probe, setup.tableSize, setup.bb)
  return probe.toAct ? { street: probe.street, position: probe.toAct } : null
}

/** The state a new action on `street` would act against (advancing a closed round if needed). */
export function stateForStreet(replay: Replay, setup: Pick<HandSetup, 'tableSize' | 'bb'>, street: Street): TableState {
  const s = cloneState(replay.final)
  while (STREETS.indexOf(s.street) < STREETS.indexOf(street)) advanceStreet(s, setup.tableSize, setup.bb)
  return s
}

/** Actions a seat could legally take in `state`. */
export function legalActions(state: TableState, position: Position): ActionType[] {
  const seat = seatOf(state, position)
  if (!seat || seat.folded || seat.allIn) return []
  const toCall = Math.max(0, state.currentBet - seat.committed)
  const deeper = seat.stack === null || seat.stack > toCall
  if (toCall > 0) {
    const out: ActionType[] = ['fold', 'call']
    if (deeper && seat.canRaise) out.push('raise')
    out.push('allin')
    return out
  }
  const out: ActionType[] = ['check', state.currentBet > 0 ? 'raise' : 'bet', 'allin']
  return out
}

export function amountToCall(state: TableState, position: Position): number {
  const seat = seatOf(state, position)
  if (!seat) return 0
  const toCall = Math.max(0, state.currentBet - seat.committed)
  return round2(seat.stack === null ? toCall : Math.min(toCall, seat.stack))
}

/**
 * Actions to insert for players skipped when jumping to `target`: folds when facing a bet
 * (or preflop), checks otherwise. Lets you enter "folds to the CO" in one tap.
 */
export function skippedActions(
  state: TableState,
  setup: Pick<HandSetup, 'tableSize' | 'straddle'>,
  target: Position,
): { position: Position; type: 'fold' | 'check' }[] {
  const out: { position: Position; type: 'fold' | 'check' }[] = []
  if (!state.toAct || state.toAct === target) return out
  const order = actionOrder(state, setup.tableSize, !!setup.straddle && state.street === 'preflop')
  const start = order.indexOf(state.toAct)
  for (let i = 0; i < order.length; i++) {
    const pos = order[(start + i) % order.length]
    if (pos === target) return out
    const seat = seatOf(state, pos)
    if (!seat || !needsToAct(seat, state)) continue
    const facing = state.currentBet - seat.committed > 0
    out.push({ position: pos, type: facing ? 'fold' : 'check' })
  }
  return []
}

export function seatIn(state: TableState, position: Position): Seat | undefined {
  return seatOf(state, position)
}

/** Build the engine setup from a hand record. */
export function setupFromHand(h: {
  tableSize: TableSize
  sb: number
  bb: number
  straddle?: number
  ante?: number
  heroPosition: Position | null
  players: readonly Player[]
  actions: readonly Action[]
}): HandSetup {
  return {
    tableSize: h.tableSize,
    sb: h.sb,
    bb: h.bb,
    straddle: h.straddle,
    ante: h.ante,
    heroPosition: h.heroPosition,
    players: h.players,
    actions: h.actions,
  }
}
