import { cardRank, cardSuit, suitSymbol } from '../domain/cards'
import type { Card, HandClass } from '../domain/types'
import { cx } from '../lib/cx'
import { SUIT_TEXT } from './suits'

type CardSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZE: Record<CardSize, string> = {
  xs: 'h-7 w-5 text-[13px] rounded-[5px]',
  sm: 'h-10 w-7 text-base rounded-md',
  md: 'h-14 w-10 text-xl rounded-lg',
  lg: 'h-[68px] w-12 text-2xl rounded-xl',
}

/** A card face, or an empty slot when `card` is null. */
export function PlayingCard({
  card,
  size = 'md',
  active,
  placeholder,
  className,
}: {
  card: Card | null
  size?: CardSize
  active?: boolean
  placeholder?: string
  className?: string
}) {
  const ring = active ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''
  if (!card) {
    return (
      <span
        className={cx(
          'inline-flex shrink-0 items-center justify-center border-2 border-dashed border-line font-semibold text-faint',
          SIZE[size],
          ring,
          className,
        )}
      >
        {placeholder}
      </span>
    )
  }
  const suit = cardSuit(card)
  return (
    <span
      className={cx(
        'inline-flex shrink-0 flex-col items-center justify-center border border-line bg-card font-bold leading-none shadow-sm',
        SIZE[size],
        SUIT_TEXT[suit],
        ring,
        className,
      )}
      aria-label={card}
    >
      <span>{cardRank(card)}</span>
      <span className="text-[0.8em]">{suitSymbol(suit)}</span>
    </span>
  )
}

/** A hand class like "AKs" shown as a compact pill (used when exact suits weren't recorded). */
export function HandClassBadge({ handClass, size = 'md', active }: { handClass: HandClass; size?: CardSize; active?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg border border-line bg-card px-2 font-bold',
        size === 'xs' ? 'h-7 text-[13px]' : size === 'sm' ? 'h-10 text-base' : size === 'lg' ? 'h-[68px] text-2xl px-3' : 'h-14 text-xl',
        active && 'ring-2 ring-accent ring-offset-2 ring-offset-bg',
      )}
    >
      {handClass}
    </span>
  )
}
