import type { Suit } from '../domain/types'

// Four-colour deck: spades/hearts/diamonds/clubs are distinguishable at a glance in a dim room.
export const SUIT_TEXT: Record<Suit, string> = {
  s: 'text-suit-s',
  h: 'text-suit-h',
  d: 'text-suit-d',
  c: 'text-suit-c',
}
