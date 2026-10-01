// "Copy for analysis": a clean plain-text hand history for pasting into Claude or a forum.
import { cardRank, cardSuit } from './cards'
import { replayHand, setupFromHand, type Step } from './engine'
import { formatDate, formatNumber } from './format'
import { round2 } from './money'
import { positionLabel } from './positions'
import { STREETS, type Card, type Hand, type Position, type Session, type Street, type Tag } from './types'

export interface AnalysisContext {
  tags?: ReadonlyMap<string, Tag>
  session?: Session | null
  currencySymbol: string
}

const STREET_TITLE: Record<Street, string> = { preflop: 'PREFLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER' }
const BOARD_RANGE: Record<Street, [number, number]> = { preflop: [0, 0], flop: [0, 3], turn: [3, 4], river: [4, 5] }

/** Cards as "Qh Qd": letters survive every forum and chat box. */
export function plainCards(cards: readonly Card[]): string {
  return cards.map((c) => `${cardRank(c)}${cardSuit(c)}`).join(' ')
}

export function analysisText(hand: Hand, ctx: AnalysisContext): string {
  const cur = ctx.currencySymbol
  const isBB = hand.unit === 'bb'
  const amt = (v: number) => (isBB ? `${formatNumber(v)} BB` : `${cur}${formatNumber(v)}`)
  const withBB = (v: number) => (isBB ? amt(v) : `${amt(v)} (${formatNumber(round2(v / hand.bb))} BB)`)
  const who = (p: Position) => (p === hand.heroPosition ? 'Hero' : positionLabel(p))
  const lines: string[] = []

  // Header
  const where = [ctx.session?.location, formatDate(hand.createdAt)].filter(Boolean).join(' · ')
  if (isBB) {
    const lvl = hand.blindLevel
    const level = lvl ? `Level ${lvl.level}, ${formatNumber(lvl.sb)}/${formatNumber(lvl.bb)}${lvl.ante ? ` (${formatNumber(lvl.ante)} ante)` : ''}` : 'blinds unknown'
    const name = ctx.session?.tournament?.name
    lines.push(`NLHE tournament${name ? ` (${name})` : ''}, ${hand.tableSize}-handed, ${level}. Amounts in big blinds.`)
  } else {
    let stakes = `${cur}${formatNumber(hand.sb)}/${cur}${formatNumber(hand.bb)}`
    if (hand.straddle) stakes += ` with a ${cur}${formatNumber(hand.straddle)} UTG straddle`
    if (hand.ante) stakes += `, ${cur}${formatNumber(hand.ante)} BB ante`
    lines.push(`NLHE cash ${stakes}, ${hand.tableSize}-handed (live).`)
  }
  if (where) lines.push(where)
  lines.push('')

  // Players
  const hole = hand.hole ? (hand.hole.kind === 'exact' ? plainCards(hand.hole.cards) : `${hand.hole.handClass} (suits not recorded)`) : 'unknown cards'
  const hero = hand.players.find((p) => p.isHero)
  lines.push(`Hero: ${hand.heroPosition ? positionLabel(hand.heroPosition) : 'position unknown'}, ${hole}${hero?.stack != null ? `, stack ${withBB(hero.stack)}` : ''}`)
  const villains = hand.players.filter((p) => !p.isHero)
  if (villains.length) {
    lines.push('Villains:')
    for (const v of villains) {
      const bits = [v.stack != null ? withBB(v.stack) : 'stack unknown', v.description, v.reads ? `Reads: ${v.reads}` : undefined]
      lines.push(`- ${positionLabel(v.position)}: ${bits.filter(Boolean).join(' · ')}`)
    }
  }

  const replay = replayHand(setupFromHand(hand))
  const eff = replay.streets[0]?.effectiveStack
  if (eff != null) lines.push(`Effective stack: ${withBB(eff)}`)
  lines.push('')

  // Action by street
  if (hand.actions.length === 0) {
    if (hand.board.length) lines.push(`Board: ${plainCards(hand.board)}`)
    if (hand.wentTo) lines.push(`Went to: ${hand.wentTo}`)
    lines.push('(Street-by-street action not recorded.)')
  } else {
    const byStreet = new Map<Street, Step[]>()
    for (const s of replay.steps) byStreet.set(s.action.street, [...(byStreet.get(s.action.street) ?? []), s])
    const lastActionStreet = STREETS.indexOf(hand.actions.at(-1)!.street)
    const boardStreets = STREETS.filter((s) => s !== 'preflop' && hand.board.length >= BOARD_RANGE[s][1])
    const lastStreet = Math.max(lastActionStreet, ...boardStreets.map((s) => STREETS.indexOf(s)))
    for (const street of STREETS.slice(0, lastStreet + 1)) {
      const summary = replay.streets.find((x) => x.street === street)
      const steps = byStreet.get(street) ?? []
      const [a, b] = BOARD_RANGE[street]
      const cards = hand.board.slice(a, b)
      const pot = summary?.potStart ?? steps[0]?.before.pot ?? replay.finalPot
      const meta = [`pot ${amt(pot)}`]
      if (summary?.spr != null) meta.push(`SPR ${summary.spr.toFixed(1)}`)
      const head = `${STREET_TITLE[street]}${cards.length ? ` [${plainCards(cards)}]` : ''} (${meta.join(', ')})`
      lines.push(steps.length ? `${head}: ${describeSteps(steps, who, amt)}` : head)
    }
  }
  lines.push('')

  // Showdown and result
  const shown = villains.filter((v) => v.shown)
  for (const v of shown) lines.push(`${positionLabel(v.position)} shows ${plainCards(v.shown!)}`)
  if (hand.result !== null) {
    const r = hand.result
    const verb = r > 0 ? 'won' : r < 0 ? 'lost' : 'broke even'
    const bb = isBB ? '' : ` (${r > 0 ? '+' : r < 0 ? '−' : ''}${formatNumber(Math.abs(r / hand.bb))} BB)`
    lines.push(`Result: Hero ${verb}${r !== 0 ? ` ${amt(Math.abs(r))}` : ''}${bb}${hand.actions.length ? `. Final pot ${amt(replay.finalPot)}.` : '.'}`)
  }

  // Notes and study
  const tagNames = hand.tagIds.map((id) => ctx.tags?.get(id)?.name).filter(Boolean)
  const extra: string[] = []
  if (tagNames.length) extra.push(`Tags: ${tagNames.join(', ')}`)
  if (hand.note.trim()) extra.push(`Notes: ${hand.note.trim()}`)
  const thoughts = replay.steps.filter((s) => s.action.thought?.trim())
  if (thoughts.length) {
    extra.push('My thinking at each decision:')
    for (const s of thoughts) extra.push(`- ${STREET_TITLE[s.action.street].toLowerCase()}, ${describeSteps([s], who, amt)}: ${s.action.thought!.trim()}`)
  }
  if (hand.study.differently.trim()) extra.push(`What I'd do differently: ${hand.study.differently.trim()}`)
  if (hand.study.question.trim()) extra.push(`My question: ${hand.study.question.trim()}`)
  if (extra.length) lines.push('', ...extra)

  if (!hand.study.question.trim()) lines.push('', 'What do you think of my play in this hand?')
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

/** "UTG folds, Hero raises to $15, MP, LJ, HJ, CO fold, BTN calls $15" — runs of folds are grouped. */
function describeSteps(steps: readonly Step[], who: (p: Position) => string, amt: (v: number) => string): string {
  const parts: string[] = []
  let folds: string[] = []
  const flush = () => {
    if (folds.length === 1) parts.push(`${folds[0]} folds`)
    else if (folds.length > 1) parts.push(`${folds.join(', ')} fold`)
    folds = []
  }
  for (const s of steps) {
    const a = s.action
    const name = who(a.position)
    if (a.type === 'fold' && name !== 'Hero') {
      folds.push(name)
      continue
    }
    flush()
    const seat = s.after.seats.find((x) => x.position === a.position)
    const to = seat?.committed ?? 0
    const allIn = seat?.allIn && !s.before.seats.find((x) => x.position === a.position)?.allIn
    let text: string
    switch (a.type) {
      case 'fold':
        text = `${name} folds`
        break
      case 'check':
        text = `${name} checks`
        break
      case 'call':
        text = `${name} calls ${amt(s.put)}`
        break
      case 'bet':
        text = `${name} bets ${amt(to)}`
        break
      case 'raise':
        text = `${name} raises to ${amt(to)}`
        break
      case 'allin':
        text = `${name} goes all-in for ${amt(to)}`
        break
    }
    if (allIn && a.type !== 'allin') text += ' (all-in)'
    parts.push(text)
  }
  flush()
  return parts.join(', ')
}
