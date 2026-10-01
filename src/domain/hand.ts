import { exactHoleCards } from './cards'
import { round2 } from './money'
import type { BlindLevel, Card, GameType, Hand, Player, Position, Session, Settings, TableSize, Unit } from './types'

/** Game details copied onto every hand when it is created. */
export interface HandContext {
  sessionId: string | null
  gameType: GameType
  tableSize: TableSize
  unit: Unit
  sb: number
  bb: number
  straddle?: number
  ante?: number
  blindLevel?: BlindLevel
}

export function handContextFromSession(s: Session): HandContext {
  if (s.gameType === 'tournament' && s.tournament) {
    const lvl = s.tournament.level
    return {
      sessionId: s.id,
      gameType: 'tournament',
      tableSize: s.tableSize,
      unit: 'bb',
      sb: round2(lvl.sb / lvl.bb),
      bb: 1,
      ante: lvl.ante ? round2(lvl.ante / lvl.bb) : undefined,
      blindLevel: { ...lvl },
    }
  }
  return {
    sessionId: s.id,
    gameType: 'cash',
    tableSize: s.tableSize,
    unit: 'money',
    sb: s.stakes.sb,
    bb: s.stakes.bb,
    straddle: s.stakes.straddle || undefined,
    ante: s.stakes.ante || undefined,
  }
}

/** Context for a hand logged with no active session: a cash hand at the default stakes. */
export function handContextFromSettings(settings: Settings): HandContext {
  const { sb, bb, straddle, ante } = settings.defaultStakes
  return {
    sessionId: null,
    gameType: 'cash',
    tableSize: settings.defaultTableSize,
    unit: 'money',
    sb,
    bb,
    straddle: straddle || undefined,
    ante: ante || undefined,
  }
}

export function createHand(ctx: HandContext, id: string, now: number): Hand {
  const hand: Hand = {
    id,
    sessionId: ctx.sessionId,
    gameType: ctx.gameType,
    tableSize: ctx.tableSize,
    unit: ctx.unit,
    sb: ctx.sb,
    bb: ctx.bb,
    hole: null,
    board: [],
    heroPosition: null,
    wentTo: null,
    result: null,
    tagIds: [],
    note: '',
    flagged: true,
    reviewStatus: 'unreviewed',
    players: [],
    actions: [],
    study: { differently: '', question: '' },
    createdAt: now,
    updatedAt: now,
  }
  if (ctx.straddle) hand.straddle = ctx.straddle
  if (ctx.ante) hand.ante = ctx.ante
  if (ctx.blindLevel) hand.blindLevel = { ...ctx.blindLevel }
  return hand
}

/** True when nothing has been entered yet (used to avoid saving empty captures). */
export function isBlankCapture(h: Hand): boolean {
  return (
    h.hole === null &&
    h.board.length === 0 &&
    h.heroPosition === null &&
    h.wentTo === null &&
    h.result === null &&
    h.tagIds.length === 0 &&
    h.note.trim() === '' &&
    h.actions.length === 0
  )
}

export function toBB(h: Pick<Hand, 'bb'>, amount: number): number {
  return round2(amount / h.bb)
}

export function fromBB(h: Pick<Hand, 'bb'>, bbAmount: number): number {
  return round2(bbAmount * h.bb)
}

export function handResultBB(h: Hand): number | null {
  return h.result === null ? null : toBB(h, h.result)
}

export function heroPlayer(h: Hand): Player | undefined {
  return h.players.find((p) => p.isHero)
}

/** Positions that did something other than fold (the players worth tracking stacks and reads for). */
export function involvedPositions(h: Pick<Hand, 'actions'>): Set<Position> {
  return new Set(h.actions.filter((a) => a.type !== 'fold').map((a) => a.position))
}

/**
 * Ensure the players list has an entry for the hero at `heroPosition` and for every position
 * that took part in the hand (anything but a fold). Existing entries (and their stacks/notes) are kept.
 */
export function syncPlayers(h: Hand, defaultStack: number | null): Player[] {
  const out = h.players
    .filter((p) => !p.isHero || p.position === h.heroPosition)
    .map((p) => ({ ...p, isHero: p.position === h.heroPosition }))
  const have = new Set(out.map((p) => p.position))
  const want: Position[] = []
  if (h.heroPosition) want.push(h.heroPosition)
  want.push(...involvedPositions(h))
  for (const pos of want) {
    if (have.has(pos)) continue
    have.add(pos)
    out.push({ position: pos, isHero: pos === h.heroPosition, stack: defaultStack })
  }
  return out
}

/** Every specific card on the hand: hole cards, board, and any villain cards shown. */
export function knownCards(h: Hand): Card[] {
  const cards: Card[] = []
  const hole = exactHoleCards(h.hole)
  if (hole) cards.push(...hole)
  cards.push(...h.board)
  for (const p of h.players) if (p.shown) cards.push(...p.shown)
  return cards
}
