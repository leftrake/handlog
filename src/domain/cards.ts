import { RANKS, SUITS, type Card, type HandClass, type HoleCards, type Rank, type Suit } from './types'

const SUIT_SYMBOLS: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const SYMBOL_TO_SUIT: Record<string, Suit> = {
  '♠': 's', '♤': 's',
  '♥': 'h', '♡': 'h',
  '♦': 'd', '♢': 'd',
  '♣': 'c', '♧': 'c',
}
export const SUIT_NAMES: Record<Suit, string> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' }

export function isRank(x: string): x is Rank {
  return (RANKS as readonly string[]).includes(x)
}

export function isSuit(x: string): x is Suit {
  return (SUITS as readonly string[]).includes(x)
}

export function isCard(x: unknown): x is Card {
  return typeof x === 'string' && x.length === 2 && isRank(x[0]) && isSuit(x[1])
}

export function makeCard(rank: Rank, suit: Suit): Card {
  return `${rank}${suit}`
}

export function cardRank(card: Card): Rank {
  return card[0] as Rank
}

export function cardSuit(card: Card): Suit {
  return card[1] as Suit
}

/** 0 for Ace … 12 for Deuce (index in RANKS). */
export function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank)
}

function normalizeRank(raw: string): Rank | null {
  const r = raw.toUpperCase()
  if (r === '10') return 'T'
  return isRank(r) ? r : null
}

function normalizeSuit(raw: string): Suit | null {
  if (raw in SYMBOL_TO_SUIT) return SYMBOL_TO_SUIT[raw]
  const s = raw.toLowerCase()
  return isSuit(s) ? s : null
}

/** Parse a single card: "As", "as", "AS", "A♠", "10h", "Td". */
export function parseCard(raw: string): Card | null {
  const s = raw.trim()
  const m = /^(10|[2-9TJQKA])\s*([shdc♠♤♥♡♦♢♣♧])$/i.exec(s)
  if (!m) return null
  const rank = normalizeRank(m[1])
  const suit = normalizeSuit(m[2])
  return rank && suit ? makeCard(rank, suit) : null
}

/**
 * Parse a run of cards: "AsKd", "As Kd", "A♠ K♦ 7c", "10h9h".
 * Returns null if any part is unparseable.
 */
export function parseCards(raw: string): Card[] | null {
  const s = raw.replace(/[,\s]+/g, '')
  if (s === '') return []
  const re = /(10|[2-9TJQKA])([shdc♠♤♥♡♦♢♣♧])/giy
  const out: Card[] = []
  let consumed = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    const card = parseCard(m[1] + m[2])
    if (!card) return null
    out.push(card)
    consumed = re.lastIndex
  }
  return consumed === s.length ? out : null
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOLS[suit]
}

/** "A♠" */
export function formatCard(card: Card): string {
  return `${card[0]}${SUIT_SYMBOLS[cardSuit(card)]}`
}

export function formatCards(cards: readonly Card[], sep = ' '): string {
  return cards.map(formatCard).join(sep)
}

export function fullDeck(): Card[] {
  return RANKS.flatMap((r) => SUITS.map((s) => makeCard(r, s)))
}

/** Cards that appear more than once, each listed once. */
export function findDuplicates(cards: readonly (Card | null | undefined)[]): Card[] {
  const seen = new Set<Card>()
  const dupes = new Set<Card>()
  for (const c of cards) {
    if (!c) continue
    if (seen.has(c)) dupes.add(c)
    seen.add(c)
  }
  return [...dupes]
}

/**
 * Returns the set of cards unavailable for a slot: every card in `used` except the one
 * currently occupying the slot being edited (so you can re-pick it).
 */
export function unavailableCards(used: readonly (Card | null | undefined)[], editing?: Card | null): Set<Card> {
  const out = new Set<Card>()
  for (const c of used) if (c && c !== editing) out.add(c)
  return out
}

/** Exact hole cards from a HoleCards value, if known. */
export function exactHoleCards(hole: HoleCards | null | undefined): [Card, Card] | null {
  return hole?.kind === 'exact' ? hole.cards : null
}

/** "AKs", "AKo" or "QQ" for two specific cards, higher rank first. */
export function handClassOf(a: Card, b: Card): HandClass {
  const ra = cardRank(a)
  const rb = cardRank(b)
  if (ra === rb) return `${ra}${rb}`
  const [hi, lo] = rankIndex(ra) < rankIndex(rb) ? [ra, rb] : [rb, ra]
  return `${hi}${lo}${cardSuit(a) === cardSuit(b) ? 's' : 'o'}`
}

/** Build a hand class from two ranks and suitedness. Pairs ignore `suited`. */
export function makeHandClass(r1: Rank, r2: Rank, suited: boolean): HandClass {
  if (r1 === r2) return `${r1}${r2}`
  const [hi, lo] = rankIndex(r1) < rankIndex(r2) ? [r1, r2] : [r2, r1]
  return `${hi}${lo}${suited ? 's' : 'o'}`
}

/**
 * Normalize a hand-class string: "aks" → "AKs", "KA o" → "AKo", "qq" → "QQ", "T9S" → "T9s".
 * Returns null for anything that isn't one of the 169 classes (e.g. "AK" with no suitedness).
 */
export function parseHandClass(raw: string): HandClass | null {
  const s = raw.replace(/\s+/g, '').replace(/10/g, 'T')
  const m = /^([2-9TJQKA])([2-9TJQKA])([so])?$/i.exec(s)
  if (!m) return null
  const r1 = m[1].toUpperCase() as Rank
  const r2 = m[2].toUpperCase() as Rank
  const suffix = m[3]?.toLowerCase()
  if (r1 === r2) return suffix ? null : `${r1}${r2}`
  if (!suffix) return null
  return makeHandClass(r1, r2, suffix === 's')
}

export function isHandClass(x: string): boolean {
  return parseHandClass(x) === x
}

/** The starting-hand class for a hand's hole cards, whichever way they were entered. */
export function holeHandClass(hole: HoleCards | null | undefined): HandClass | null {
  if (!hole) return null
  if (hole.kind === 'class') return hole.handClass
  return handClassOf(hole.cards[0], hole.cards[1])
}

export function formatHole(hole: HoleCards | null | undefined): string {
  if (!hole) return '—'
  return hole.kind === 'class' ? hole.handClass : formatCards(hole.cards, '')
}

/** Number of specific card combinations in a class: pairs 6, suited 4, offsuit 12. */
export function comboCount(hc: HandClass): number {
  if (hc.length === 2) return 6
  return hc.endsWith('s') ? 4 : 12
}

/**
 * Position of a hand class in the standard 13×13 grid (row, col indexes into RANKS).
 * Pairs on the diagonal, suited hands above it (row < col), offsuit below (row > col).
 */
export function gridPosition(hc: HandClass): { row: number; col: number } {
  const hi = rankIndex(hc[0] as Rank)
  const lo = rankIndex(hc[1] as Rank)
  if (hc.length === 2) return { row: hi, col: hi }
  return hc.endsWith('s') ? { row: hi, col: lo } : { row: lo, col: hi }
}

/** The hand class at a grid cell. */
export function gridHandClass(row: number, col: number): HandClass {
  if (row === col) return `${RANKS[row]}${RANKS[row]}`
  if (row < col) return `${RANKS[row]}${RANKS[col]}s`
  return `${RANKS[col]}${RANKS[row]}o`
}

/** All 169 hand classes in grid order (row-major). */
export function allHandClasses(): HandClass[] {
  const out: HandClass[] = []
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) out.push(gridHandClass(r, c))
  return out
}

/**
 * Does a hand class match a loose search query?
 * "A" → any hand with an ace · "AK" → AKs or AKo · "AKs" → exactly AKs · "QQ" → QQ ·
 * "pairs"/"pp" → any pair · "suited" → any suited hand.
 */
export function handClassMatches(hc: HandClass, query: string): boolean {
  const q = query.trim().replace(/10/g, 'T')
  if (q === '') return true
  const lower = q.toLowerCase()
  if (lower === 'pairs' || lower === 'pair' || lower === 'pp') return hc.length === 2
  if (lower === 'suited') return hc.endsWith('s')
  if (lower === 'offsuit') return hc.endsWith('o')
  const exact = parseHandClass(q)
  if (exact) return exact === hc
  const ranks = q.toUpperCase().split('').filter(isRank)
  if (ranks.length === 0 || ranks.length !== q.length) return false
  if (ranks.length === 1) return hc.includes(ranks[0])
  if (ranks.length === 2) {
    const [a, b] = ranks
    if (a === b) return hc === `${a}${b}`
    return hc.length === 3 && hc.startsWith(makeHandClass(a, b, true).slice(0, 2))
  }
  return false
}
