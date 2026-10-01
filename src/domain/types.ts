// Core data model for HandLog. Pure types and constants only — no React, no storage.

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const
export type Rank = (typeof RANKS)[number]

export const SUITS = ['s', 'h', 'd', 'c'] as const
export type Suit = (typeof SUITS)[number]

/** A specific card such as "As" or "Td". */
export type Card = `${Rank}${Suit}`

/** One of the 169 starting-hand classes: "AA", "AKs", "AKo". */
export type HandClass = string

export const STREETS = ['preflop', 'flop', 'turn', 'river'] as const
export type Street = (typeof STREETS)[number]

export const WENT_TO = ['preflop', 'flop', 'turn', 'river', 'showdown'] as const
export type WentTo = (typeof WENT_TO)[number]

export type Position = 'UTG' | 'UTG1' | 'UTG2' | 'MP' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB'

/** Players dealt in: heads-up (2) through 10-handed. */
export const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const
export type TableSize = (typeof TABLE_SIZES)[number]
export type GameType = 'cash' | 'tournament'

/** Unit a hand's amounts are stored in: dollars (cash) or big blinds (tournament). */
export type Unit = 'money' | 'bb'

export const ACTION_TYPES = ['fold', 'check', 'call', 'bet', 'raise', 'allin'] as const
export type ActionType = (typeof ACTION_TYPES)[number]

export const REVIEW_STATUSES = ['unreviewed', 'reviewed', 'needs_study'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

/** Cash stakes in dollars. `ante` is a big-blind ante (posted once, by the BB, as dead money). */
export interface Stakes {
  sb: number
  bb: number
  straddle?: number
  ante?: number
}

/** Tournament blind level in chips. `ante` is a big-blind ante. */
export interface BlindLevel {
  level: number
  sb: number
  bb: number
  ante?: number
}

export interface Rebuy {
  at: number
  amount: number
}

export interface TournamentInfo {
  name?: string
  startingStack?: number
  level: BlindLevel
}

export interface Session {
  id: string
  gameType: GameType
  /** Players currently at the table. Changes as people come and go; each hand keeps its own copy. */
  tableSize: TableSize
  location: string
  /** Cash stakes in dollars. For tournaments this mirrors the blind ratio (bb = 1). */
  stakes: Stakes
  tournament?: TournamentInfo
  /** Dollars. Tournament: entry fee. */
  buyIn: number
  /** Rebuys, top-ups and add-ons, in dollars. */
  rebuys: Rebuy[]
  /** Dollars. Tournament: prize won. Null while the session is active. */
  cashOut: number | null
  startedAt: number
  endedAt: number | null
  notes: string
  sample?: boolean
  createdAt: number
  updatedAt: number
}

export type HoleCards =
  | { kind: 'exact'; cards: [Card, Card] }
  | { kind: 'class'; handClass: HandClass }

export interface Player {
  position: Position
  isHero: boolean
  /** Starting stack in hand units; null when unknown. */
  stack: number | null
  description?: string
  reads?: string
  shown?: [Card, Card]
}

export interface Action {
  id: string
  street: Street
  position: Position
  type: ActionType
  /** For bet / raise / all-in: the player's total commitment on this street ("raise to"). */
  amount?: number
  /** "What I was thinking" at this decision (hero actions). */
  thought?: string
}

export interface StudyNotes {
  differently: string
  question: string
}

export interface Hand {
  id: string
  sessionId: string | null

  // Snapshot of the game context at capture time, in hand units.
  gameType: GameType
  tableSize: TableSize
  unit: Unit
  sb: number
  bb: number
  straddle?: number
  ante?: number
  blindLevel?: BlindLevel

  // Quick Capture
  hole: HoleCards | null
  board: Card[]
  heroPosition: Position | null
  wentTo: WentTo | null
  /** Net result, signed, in hand units. */
  result: number | null
  tagIds: string[]
  note: string
  flagged: boolean

  // Full Review
  reviewStatus: ReviewStatus
  players: Player[]
  actions: Action[]
  study: StudyNotes

  sample?: boolean
  createdAt: number
  updatedAt: number
}

export interface Tag {
  id: string
  name: string
  order: number
}

export type DisplayUnit = 'money' | 'bb'
export type Theme = 'dark' | 'light' | 'system'

/** The values used to pre-fill the "start session" form. */
export interface SessionDefaults {
  gameType: GameType
  tableSize: TableSize
  location: string
  stakes: Stakes
  buyIn: number
  tournament?: TournamentInfo
}

export interface Settings {
  defaultStakes: Stakes
  defaultTableSize: TableSize
  currencySymbol: string
  displayUnit: DisplayUnit
  theme: Theme
  lastSessionInput: SessionDefaults | null
  activeSessionId: string | null
  lastBackupAt: number | null
}

export const DEFAULT_SETTINGS: Settings = {
  defaultStakes: { sb: 1, bb: 2 },
  defaultTableSize: 9,
  currencySymbol: '$',
  displayUnit: 'money',
  theme: 'dark',
  lastSessionInput: null,
  activeSessionId: null,
  lastBackupAt: null,
}

export const DEFAULT_TAG_NAMES = [
  '3bet pot',
  '4bet pot',
  'Bluff',
  'Hero call',
  'Cooler',
  'Bad beat',
  'Misplayed',
  'Tough spot',
  'Villain read',
] as const
