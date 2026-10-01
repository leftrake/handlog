import { findDuplicates, formatCard } from './cards'
import type { Issue, Replay } from './engine'
import { knownCards } from './hand'
import { isSeated, positionLabel } from './positions'
import { STREETS, WENT_TO, type Hand } from './types'

const BOARD_NEEDED = { preflop: 0, flop: 3, turn: 4, river: 5 } as const

/**
 * Problems with a hand as a whole: the action-sequence issues from the replay, plus card and
 * consistency checks. These are advisory — saving is never blocked.
 */
export function validateHand(hand: Hand, replay: Replay): Issue[] {
  const issues: Issue[] = [...replay.issues]

  for (const card of findDuplicates(knownCards(hand))) {
    issues.push({ severity: 'error', message: `${formatCard(card)} is used more than once` })
  }

  if (![0, 3, 4, 5].includes(hand.board.length)) {
    issues.push({ severity: 'warning', message: `The board has ${hand.board.length} cards; a flop needs 3` })
  }

  if (hand.heroPosition && !isSeated(hand.heroPosition, hand.tableSize)) {
    issues.push({
      severity: 'error',
      message: `${positionLabel(hand.heroPosition)} isn't a seat at a ${hand.tableSize}-handed table`,
    })
  }

  const lastStreet = hand.actions.reduce((max, a) => Math.max(max, STREETS.indexOf(a.street)), -1)
  if (lastStreet >= 0) {
    const street = STREETS[lastStreet]
    const needed = BOARD_NEEDED[street]
    if (hand.board.length > 0 && hand.board.length < needed) {
      issues.push({ severity: 'warning', message: `There's ${street} action but only ${hand.board.length} board cards` })
    }
    if (hand.wentTo && WENT_TO.indexOf(hand.wentTo) < lastStreet) {
      issues.push({ severity: 'warning', message: `Marked as ending on the ${hand.wentTo}, but there's ${street} action` })
    }
  }

  if (hand.actions.length > 0 && hand.heroPosition) {
    const hero = hand.players.find((p) => p.isHero)
    if (!hero || hero.stack === null) {
      issues.push({ severity: 'warning', message: 'Add your starting stack to see effective stacks and SPR' })
    }
  }

  return issues
}

export function countBySeverity(issues: readonly Issue[]): { errors: number; warnings: number } {
  let errors = 0
  let warnings = 0
  for (const i of issues) {
    if (i.severity === 'error') errors++
    else warnings++
  }
  return { errors, warnings }
}
