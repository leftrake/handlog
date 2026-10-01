import { Link } from 'react-router'
import { Icon } from '../../components/icons'
import { HandClassBadge, PlayingCard } from '../../components/PlayingCard'
import { cx } from '../../lib/cx'
import { formatDateTime, formatHandAmount, formatShortTime, type DisplayPrefs } from '../../domain/format'
import { positionLabel } from '../../domain/positions'
import type { Hand, Tag } from '../../domain/types'

const WENT_LABEL = { preflop: 'Pre', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'SD' } as const

export function HoleView({ hand, size = 'sm' }: { hand: Pick<Hand, 'hole'>; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const hole = hand.hole
  if (!hole) {
    return (
      <span className="flex gap-0.5">
        <PlayingCard card={null} size={size} placeholder="?" />
        <PlayingCard card={null} size={size} placeholder="?" />
      </span>
    )
  }
  if (hole.kind === 'class') return <HandClassBadge handClass={hole.handClass} size={size} />
  return (
    <span className="flex gap-0.5">
      <PlayingCard card={hole.cards[0]} size={size} />
      <PlayingCard card={hole.cards[1]} size={size} />
    </span>
  )
}

export function ResultText({ hand, prefs, className }: { hand: Hand; prefs: DisplayPrefs; className?: string }) {
  if (hand.result === null) return <span className={cx('text-faint', className)}>—</span>
  return (
    <span className={cx('num font-semibold', hand.result > 0 ? 'text-win' : hand.result < 0 ? 'text-loss' : 'text-muted', className)}>
      {formatHandAmount(hand, hand.result, prefs, { signed: true })}
    </span>
  )
}

/** One line in a hand list. */
export function HandRow({
  hand,
  prefs,
  to,
  tags,
  showDate = false,
}: {
  hand: Hand
  prefs: DisplayPrefs
  to: string
  tags?: Map<string, Tag>
  showDate?: boolean
}) {
  const tagNames = tags ? hand.tagIds.map((id) => tags.get(id)?.name).filter(Boolean) : []
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl px-2 py-2 active:bg-surface-2 hover:bg-surface-2/60">
      <HoleView hand={hand} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <span>{hand.heroPosition ? positionLabel(hand.heroPosition) : '—'}</span>
          {hand.wentTo && <span className="text-sm font-medium text-muted">{WENT_LABEL[hand.wentTo]}</span>}
          {hand.flagged && hand.reviewStatus === 'unreviewed' && <Icon name="flag" size={14} className="text-warn" />}
          {hand.reviewStatus === 'needs_study' && (
            <span className="rounded bg-warn/15 px-1.5 text-[11px] font-semibold text-warn">study</span>
          )}
        </div>
        <div className="truncate text-xs text-muted">
          {showDate ? formatDateTime(hand.createdAt) : formatShortTime(hand.createdAt)}
          {tagNames.length > 0 && ` · ${tagNames.join(', ')}`}
          {hand.note && ` · ${hand.note}`}
        </div>
      </div>
      <ResultText hand={hand} prefs={prefs} className="text-[15px]" />
    </Link>
  )
}
