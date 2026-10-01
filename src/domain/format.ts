// Display formatting. Exports (CSV/JSON) use raw numbers, not these.
import { round2 } from './money'
import type { DisplayUnit, Hand } from './types'

const MINUS = '−'

function groupDigits(n: number, decimals: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** Show cents only when the amount has them. */
function smartDecimals(n: number): number {
  return Number.isInteger(round2(n)) ? 0 : 2
}

export interface MoneyOpts {
  signed?: boolean
}

/** "$1,250", "+$185", "−$40.50". */
export function formatMoney(n: number, currency: string, opts: MoneyOpts = {}): string {
  const abs = Math.abs(round2(n))
  const body = `${currency}${groupDigits(abs, smartDecimals(abs))}`
  if (n < 0 && abs !== 0) return `${MINUS}${body}`
  return opts.signed && abs !== 0 ? `+${body}` : body
}

/** "92.5 BB", "+12 BB", "−3.25 BB". */
export function formatBB(n: number, opts: MoneyOpts = {}): string {
  const v = round2(n)
  const abs = Math.abs(v)
  // Up to 2 decimals (1 once it's 100+ BB), never trailing zeros: "92.5 BB", "12 BB", "140.3 BB".
  const body = `${abs.toLocaleString('en-US', { maximumFractionDigits: abs >= 100 ? 1 : 2 })} BB`
  if (v < 0) return `${MINUS}${body}`
  return opts.signed && v !== 0 ? `+${body}` : body
}

export interface DisplayPrefs {
  currencySymbol: string
  displayUnit: DisplayUnit
}

/** An amount stored in a hand's units, shown in the user's preferred unit (tournaments: always BB). */
export function formatHandAmount(
  hand: Pick<Hand, 'unit' | 'bb'>,
  amount: number,
  prefs: DisplayPrefs,
  opts: MoneyOpts = {},
): string {
  if (hand.unit === 'bb') return formatBB(amount, opts)
  if (prefs.displayUnit === 'bb') return formatBB(amount / hand.bb, opts)
  return formatMoney(amount, prefs.currencySymbol, opts)
}

/** Plain number for compact UI: "12.5", "1,200". */
export function formatNumber(n: number): string {
  const v = round2(n)
  return groupDigits(v, smartDecimals(v))
}

/** "3h 12m", "45m". */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

export function formatShortTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "2026-09-30" in local time, for <input type="date">. */
export function toDateInput(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** "2026-09-30T21:15" in local time, for <input type="datetime-local">. */
export function toDateTimeInput(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${toDateInput(ts)}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Parse a user-typed amount: "1,250", "$40.5", "  12 ". Returns null when not a number. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[,$€£\s]/g, '')
  if (s === '' || !/^-?\d*\.?\d*$/.test(s) || s === '.' || s === '-') return null
  const n = Number(s)
  return Number.isFinite(n) ? round2(n) : null
}
