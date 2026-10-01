// CSV export of hands: one row per hand, RFC 4180 quoting, safe to open in Excel or Sheets.
import { plainCards } from './analysisText'
import { holeHandClass } from './cards'
import { round2 } from './money'
import { positionLabel } from './positions'
import type { Hand, Session, Tag } from './types'

type Cell = string | number | boolean | null | undefined

/** Quote a value when needed and neutralise spreadsheet formula injection in text. */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  let s = value
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: readonly (readonly Cell[])[]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

const HEADERS = [
  'date',
  'time',
  'location',
  'game',
  'stakes',
  'table_size',
  'position',
  'hole_cards',
  'hand_class',
  'board',
  'went_to',
  'result',
  'unit',
  'result_bb',
  'tags',
  'review_this',
  'review_status',
  'note',
  'action',
  'differently',
  'question',
  'id',
] as const

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function actionSummary(h: Hand): string {
  return h.actions
    .map((a) => `${a.street[0].toUpperCase()}: ${positionLabel(a.position)} ${a.type}${a.amount !== undefined ? ` ${a.amount}` : ''}`)
    .join('; ')
}

export function handsToCsv(
  hands: readonly Hand[],
  ctx: { tags: ReadonlyMap<string, Tag>; sessions: ReadonlyMap<string, Session> },
): string {
  const rows: Cell[][] = [[...HEADERS]]
  for (const h of [...hands].sort((a, b) => a.createdAt - b.createdAt)) {
    const d = new Date(h.createdAt)
    const session = h.sessionId ? ctx.sessions.get(h.sessionId) : undefined
    const stakes =
      h.unit === 'bb' && h.blindLevel
        ? `L${h.blindLevel.level} ${h.blindLevel.sb}/${h.blindLevel.bb}${h.blindLevel.ante ? `/${h.blindLevel.ante}` : ''}`
        : `${h.sb}/${h.bb}${h.straddle ? `/${h.straddle}` : ''}`
    rows.push([
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      session?.location ?? '',
      h.gameType,
      stakes,
      h.tableSize,
      h.heroPosition ? positionLabel(h.heroPosition) : '',
      h.hole?.kind === 'exact' ? plainCards(h.hole.cards) : '',
      holeHandClass(h.hole) ?? '',
      plainCards(h.board),
      h.wentTo ?? '',
      h.result,
      h.unit === 'bb' ? 'BB' : 'money',
      h.result === null ? null : round2(h.result / h.bb),
      h.tagIds.map((id) => ctx.tags.get(id)?.name).filter(Boolean).join('; '),
      h.flagged,
      h.reviewStatus,
      h.note,
      actionSummary(h),
      h.study.differently,
      h.study.question,
      h.id,
    ])
  }
  // BOM so Excel reads UTF-8 (notes may contain accents or emoji).
  return '﻿' + toCsv(rows)
}
