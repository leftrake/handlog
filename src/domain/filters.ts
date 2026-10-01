import { formatHole, handClassMatches, holeHandClass } from './cards'
import { positionLabel } from './positions'
import type { Hand, Position, ReviewStatus, Tag, WentTo } from './types'

export type Outcome = 'won' | 'lost' | 'even'

export interface HandFilter {
  /** Free text: matches notes, study fields, villain notes, tags, position and cards. */
  text?: string
  /** Inclusive epoch-ms bounds on when the hand was logged. */
  from?: number
  to?: number
  sessionId?: string
  positions?: Position[]
  /** Loose starting-hand query: "AK", "AKs", "QQ", "pairs", "suited", "A". */
  handQuery?: string
  /** Hands must carry every one of these tags. */
  tagIds?: string[]
  reviewStatuses?: ReviewStatus[]
  outcome?: Outcome
  wentTo?: WentTo[]
  flaggedOnly?: boolean
}

export function outcomeOf(h: Hand): Outcome | null {
  if (h.result === null) return null
  return h.result > 0 ? 'won' : h.result < 0 ? 'lost' : 'even'
}

function searchableText(h: Hand, tags: ReadonlyMap<string, Tag>): string {
  return [
    h.note,
    h.study.differently,
    h.study.question,
    ...h.actions.map((a) => a.thought ?? ''),
    ...h.players.flatMap((p) => [p.description ?? '', p.reads ?? '']),
    ...h.tagIds.map((id) => tags.get(id)?.name ?? ''),
    h.heroPosition ? positionLabel(h.heroPosition) : '',
    formatHole(h.hole),
    holeHandClass(h.hole) ?? '',
  ]
    .join(' \n ')
    .toLowerCase()
}

export function matchesFilter(h: Hand, f: HandFilter, tags: ReadonlyMap<string, Tag> = new Map()): boolean {
  if (f.from !== undefined && h.createdAt < f.from) return false
  if (f.to !== undefined && h.createdAt > f.to) return false
  if (f.sessionId && h.sessionId !== f.sessionId) return false
  if (f.positions?.length && (!h.heroPosition || !f.positions.includes(h.heroPosition))) return false
  if (f.handQuery?.trim()) {
    const hc = holeHandClass(h.hole)
    if (!hc || !handClassMatches(hc, f.handQuery)) return false
  }
  if (f.tagIds?.length && !f.tagIds.every((t) => h.tagIds.includes(t))) return false
  if (f.reviewStatuses?.length && !f.reviewStatuses.includes(h.reviewStatus)) return false
  if (f.outcome && outcomeOf(h) !== f.outcome) return false
  if (f.wentTo?.length && (!h.wentTo || !f.wentTo.includes(h.wentTo))) return false
  if (f.flaggedOnly && !h.flagged) return false
  if (f.text?.trim()) {
    const hay = searchableText(h, tags)
    const words = f.text.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.every((w) => hay.includes(w))) return false
  }
  return true
}

export function filterHands(hands: readonly Hand[], f: HandFilter, tags?: ReadonlyMap<string, Tag>): Hand[] {
  return hands.filter((h) => matchesFilter(h, f, tags))
}

/** Number of active filter criteria (for a badge on the filter button). */
export function activeFilterCount(f: HandFilter): number {
  let n = 0
  if (f.from !== undefined || f.to !== undefined) n++
  if (f.sessionId) n++
  if (f.positions?.length) n++
  if (f.handQuery?.trim()) n++
  if (f.tagIds?.length) n++
  if (f.reviewStatuses?.length) n++
  if (f.outcome) n++
  if (f.wentTo?.length) n++
  if (f.flaggedOnly) n++
  return n
}

/** Flagged, unreviewed hands, oldest first. */
export function reviewQueue(hands: readonly Hand[]): Hand[] {
  return hands
    .filter((h) => h.flagged && h.reviewStatus === 'unreviewed')
    .sort((a, b) => a.createdAt - b.createdAt)
}
