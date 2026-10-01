import { round2, sum } from './money'
import type { BlindLevel, Session, SessionDefaults, Settings } from './types'

export function createSession(input: SessionDefaults, id: string, now: number): Session {
  return {
    id,
    gameType: input.gameType,
    tableSize: input.tableSize,
    location: input.location.trim(),
    stakes: { ...input.stakes },
    tournament: input.gameType === 'tournament' && input.tournament ? structuredClone(input.tournament) : undefined,
    buyIn: input.buyIn,
    rebuys: [],
    cashOut: null,
    startedAt: now,
    endedAt: null,
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

/** Values to pre-fill the next "start session" form. */
export function sessionDefaultsFrom(s: Session): SessionDefaults {
  return {
    gameType: s.gameType,
    tableSize: s.tableSize,
    location: s.location,
    stakes: { ...s.stakes },
    buyIn: s.buyIn,
    tournament: s.tournament ? structuredClone(s.tournament) : undefined,
  }
}

/** Form defaults: last session's values, else the settings defaults. */
export function initialSessionDefaults(settings: Settings): SessionDefaults {
  if (settings.lastSessionInput) return structuredClone(settings.lastSessionInput)
  return {
    gameType: 'cash',
    tableSize: settings.defaultTableSize,
    location: '',
    stakes: { ...settings.defaultStakes },
    buyIn: settings.defaultStakes.bb * 100,
  }
}

export const DEFAULT_BLIND_LEVEL: BlindLevel = { level: 1, sb: 100, bb: 200, ante: 200 }

export function isActive(s: Session): boolean {
  return s.endedAt === null
}

/** Buy-in plus every rebuy / add-on, in dollars. */
export function totalInvested(s: Session): number {
  return sum([s.buyIn, ...s.rebuys.map((r) => r.amount)])
}

/** Net dollars for a finished session; null until a cash-out is recorded. */
export function sessionProfit(s: Session): number | null {
  if (s.cashOut === null) return null
  return round2(s.cashOut - totalInvested(s))
}

export function sessionDurationMs(s: Session, now: number): number {
  return Math.max(0, (s.endedAt ?? now) - s.startedAt)
}

export function sessionHours(s: Session, now: number): number {
  return sessionDurationMs(s, now) / 3_600_000
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

/** "1/2", "1/3 (6 straddle)", or "L7 · 400/800 (800)" for tournaments. */
export function stakesLabel(s: Pick<Session, 'gameType' | 'stakes' | 'tournament'>): string {
  if (s.gameType === 'tournament') {
    const l = s.tournament?.level
    return l ? blindLevelLabel(l) : 'Tournament'
  }
  const { sb, bb, straddle, ante } = s.stakes
  let label = `${fmtNum(sb)}/${fmtNum(bb)}`
  if (straddle) label += ` (${fmtNum(straddle)} straddle)`
  if (ante) label += ` (${fmtNum(ante)} BB ante)`
  return label
}

export function blindLevelLabel(l: BlindLevel): string {
  const ante = l.ante ? ` (${fmtNum(l.ante)})` : ''
  return `L${l.level} · ${fmtNum(l.sb)}/${fmtNum(l.bb)}${ante}`
}
