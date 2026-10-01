import type { ActionType, Card, ReviewStatus, Street } from '../../domain/types'

export const ACTION_LABEL: Record<ActionType, string> = {
  fold: 'Fold',
  check: 'Check',
  call: 'Call',
  bet: 'Bet',
  raise: 'Raise',
  allin: 'All-in',
}

export const STREET_LABEL: Record<Street, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' }

/** The board cards dealt on a given street. */
export function boardFor(board: readonly Card[], street: Street): Card[] {
  if (street === 'flop') return board.slice(0, 3)
  if (street === 'turn') return board.slice(3, 4)
  if (street === 'river') return board.slice(4, 5)
  return []
}

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  unreviewed: 'Unreviewed',
  reviewed: 'Reviewed',
  needs_study: 'Needs study',
}
