// Aggregations for the dashboard. Session stats use every finished session (a complete record);
// hand stats only see hands the player chose to log (a biased sample) and are kept in big blinds
// so different stakes and tournament hands can be combined.
import { allHandClasses, gridPosition, holeHandClass } from './cards'
import { round2, sum } from './money'
import { positionRank } from './positions'
import { sessionHours, sessionProfit, totalInvested } from './session'
import type { GameType, Hand, HandClass, Position, Session } from './types'

export interface StatsFilter {
  from?: number
  to?: number
  gameType?: GameType
}

export function filterSessions(sessions: readonly Session[], f: StatsFilter): Session[] {
  return sessions.filter(
    (s) =>
      (f.from === undefined || s.startedAt >= f.from) &&
      (f.to === undefined || s.startedAt <= f.to) &&
      (!f.gameType || s.gameType === f.gameType),
  )
}

export function filterStatHands(hands: readonly Hand[], f: StatsFilter): Hand[] {
  return hands.filter(
    (h) =>
      (f.from === undefined || h.createdAt >= f.from) &&
      (f.to === undefined || h.createdAt <= f.to) &&
      (!f.gameType || h.gameType === f.gameType),
  )
}

// ── sessions ─────────────────────────────────────────────

export interface SessionStats {
  /** Finished sessions (with a cash-out recorded). */
  count: number
  winning: number
  profit: number
  hours: number
  perHour: number | null
  cash: {
    count: number
    profit: number
    hours: number
    perHour: number | null
    /** Profit in big blinds, each session converted at its own stakes. */
    bbWon: number
    bbPerHour: number | null
  }
  tournament: {
    count: number
    invested: number
    prizes: number
    cashes: number
    profit: number
    /** Profit ÷ total invested. */
    roi: number | null
  }
}

export function sessionStats(sessions: readonly Session[], now = Date.now()): SessionStats {
  const done = sessions.filter((s) => sessionProfit(s) !== null)
  const cash = done.filter((s) => s.gameType === 'cash')
  const mtt = done.filter((s) => s.gameType === 'tournament')
  const profitOf = (s: Session) => sessionProfit(s) ?? 0
  const hoursOf = (list: readonly Session[]) => list.reduce((h, s) => h + sessionHours(s, now), 0)

  const hours = hoursOf(done)
  const profit = sum(done.map(profitOf))
  const cashHours = hoursOf(cash)
  const cashProfit = sum(cash.map(profitOf))
  const bbWon = round2(cash.reduce((b, s) => b + profitOf(s) / s.stakes.bb, 0))
  const mttInvested = sum(mtt.map(totalInvested))
  const mttPrizes = sum(mtt.map((s) => s.cashOut ?? 0))
  const mttProfit = sum(mtt.map(profitOf))

  return {
    count: done.length,
    winning: done.filter((s) => profitOf(s) > 0).length,
    profit,
    hours: round2(hours),
    perHour: hours > 0 ? round2(profit / hours) : null,
    cash: {
      count: cash.length,
      profit: cashProfit,
      hours: round2(cashHours),
      perHour: cashHours > 0 ? round2(cashProfit / cashHours) : null,
      bbWon,
      bbPerHour: cashHours > 0 ? round2(bbWon / cashHours) : null,
    },
    tournament: {
      count: mtt.length,
      invested: mttInvested,
      prizes: mttPrizes,
      cashes: mtt.filter((s) => (s.cashOut ?? 0) > 0).length,
      profit: mttProfit,
      roi: mttInvested > 0 ? mttProfit / mttInvested : null,
    },
  }
}

export interface TimelinePoint {
  sessionId: string
  at: number
  result: number
  cumulative: number
}

/** Finished sessions in the order they ended, with a running total. */
export function profitTimeline(sessions: readonly Session[]): TimelinePoint[] {
  const done = sessions
    .filter((s) => sessionProfit(s) !== null)
    .sort((a, b) => (a.endedAt ?? a.startedAt) - (b.endedAt ?? b.startedAt))
  let running = 0
  return done.map((s) => {
    const result = sessionProfit(s) ?? 0
    running = round2(running + result)
    return { sessionId: s.id, at: s.endedAt ?? s.startedAt, result, cumulative: running }
  })
}

// ── hands (logged sample) ────────────────────────────────

const resultBB = (h: Hand) => (h.result === null ? null : h.result / h.bb)

export interface HandSample {
  logged: number
  withResult: number
  netBB: number
}

export function handSample(hands: readonly Hand[]): HandSample {
  const results = hands.map(resultBB).filter((x): x is number => x !== null)
  return { logged: hands.length, withResult: results.length, netBB: sum(results) }
}

export interface PositionRow {
  position: Position
  hands: number
  /** Hands with a result recorded. */
  withResult: number
  netBB: number
  avgBB: number | null
  won: number
  lost: number
}

/** Results by hero position, in table order (UTG first). Positions with no logged hands are omitted. */
export function resultsByPosition(hands: readonly Hand[]): PositionRow[] {
  const rows = new Map<Position, PositionRow>()
  for (const h of hands) {
    if (!h.heroPosition) continue
    const row = rows.get(h.heroPosition) ?? {
      position: h.heroPosition,
      hands: 0,
      withResult: 0,
      netBB: 0,
      avgBB: null,
      won: 0,
      lost: 0,
    }
    row.hands++
    const r = resultBB(h)
    if (r !== null) {
      row.withResult++
      row.netBB += r
      if (r > 0) row.won++
      else if (r < 0) row.lost++
    }
    rows.set(h.heroPosition, row)
  }
  return [...rows.values()]
    .map((r) => ({ ...r, netBB: round2(r.netBB), avgBB: r.withResult ? round2(r.netBB / r.withResult) : null }))
    .sort((a, b) => positionRank(a.position) - positionRank(b.position))
}

export interface GridCell {
  handClass: HandClass
  row: number
  col: number
  /** Times this starting hand was logged. */
  count: number
  withResult: number
  netBB: number
}

/** The 13×13 starting-hand grid (row-major, AA top-left) with logged counts and net results. */
export function startingHandGrid(hands: readonly Hand[]): GridCell[] {
  const cells = new Map<HandClass, GridCell>(
    allHandClasses().map((hc) => [hc, { handClass: hc, ...gridPosition(hc), count: 0, withResult: 0, netBB: 0 }]),
  )
  for (const h of hands) {
    const hc = holeHandClass(h.hole)
    const cell = hc ? cells.get(hc) : undefined
    if (!cell) continue
    cell.count++
    const r = resultBB(h)
    if (r !== null) {
      cell.withResult++
      cell.netBB = round2(cell.netBB + r)
    }
  }
  return [...cells.values()]
}

/** Bucket a value into one of `steps` levels by its share of `max` (1-based; 0 means none). */
export function bucket(value: number, max: number, steps: number): number {
  if (value <= 0 || max <= 0) return 0
  return Math.min(steps, Math.max(1, Math.ceil((value / max) * steps)))
}

/** Clean axis ticks (steps of 1, 2, 2.5 or 5 × 10ⁿ) covering the data and zero. */
export function niceTicks(values: readonly number[], target = 4): number[] {
  const lo = Math.min(0, ...values)
  const hi = Math.max(0, ...values)
  if (lo === hi) return [0]
  const raw = (hi - lo) / target
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? raw
  const ticks: number[] = []
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.999; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}
