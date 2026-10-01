import { HandClassBadge, PlayingCard } from '../../components/PlayingCard'
import { boardCount, type Frame } from '../../domain/frames'
import { clockwiseFromButton, positionLabel } from '../../domain/positions'
import type { Hand, Position } from '../../domain/types'
import { cx } from '../../lib/cx'
import type { AmountUnit } from '../review/amountUnit'

function polar(angleDeg: number, rx: number, ry: number) {
  const a = (angleDeg * Math.PI) / 180
  return { left: `${50 + rx * Math.cos(a)}%`, top: `${50 + ry * Math.sin(a)}%` }
}

/** Oval table with every seat, the board, pot, stacks and bets for one replayer frame. */
export function TableGraphic({ hand, frame, unit }: { hand: Hand; frame: Frame; unit: AmountUnit }) {
  const order = clockwiseFromButton(hand.tableSize)
  const anchor: Position = hand.heroPosition ?? 'BTN'
  const anchorIndex = Math.max(0, order.indexOf(anchor))
  const step = 360 / order.length
  const s = frame.state
  const bets = s.seats.reduce((sum, x) => sum + x.committed, 0)
  const middle = s.pot - bets
  const board = hand.board.slice(0, boardCount(frame.street))
  const shown = new Map(hand.players.filter((p) => p.shown).map((p) => [p.position, p.shown!]))

  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-xl select-none sm:aspect-[16/10]">
      <div className="absolute inset-x-[9%] inset-y-[14%] rounded-[50%] border-[6px] border-felt-rim bg-felt shadow-[inset_0_0_40px_rgba(0,0,0,0.45)]" />

      {/* Board and pot */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
        <div className="flex h-10 gap-1">
          {board.map((c) => (
            <PlayingCard key={c} card={c} size="sm" />
          ))}
        </div>
        <div className="num rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-semibold text-white">
          Pot {unit.format(middle)}
          {bets > 0 && <span className="font-normal text-white/70"> · total {unit.format(s.pot)}</span>}
        </div>
      </div>

      {order.map((pos, i) => {
        const angle = 90 + (i - anchorIndex) * step
        const seat = s.seats.find((x) => x.position === pos)
        if (!seat) return null
        const isHero = pos === hand.heroPosition
        const acting = frame.actor === pos
        const toAct = s.toAct === pos && frame.kind !== 'end'
        const reveal = frame.reveal && shown.get(pos)
        const seatPos = polar(angle, 44, 43)
        const betPos = polar(angle, 28, 25)
        const cardPos = polar(angle, 33, 30)
        return (
          <div key={pos}>
            <div
              style={seatPos}
              className={cx(
                'absolute z-10 w-[60px] -translate-x-1/2 -translate-y-1/2 rounded-lg border px-1 py-0.5 text-center shadow sm:w-[76px]',
                isHero ? 'border-accent bg-surface' : 'border-line bg-surface',
                seat.folded && 'opacity-40',
                acting && 'ring-2 ring-warn',
                toAct && !acting && 'ring-2 ring-accent/60',
              )}
            >
              <div className="text-[11px] font-bold leading-tight">
                {positionLabel(pos)}
                {pos === 'BTN' && <span className="ml-1 rounded-full bg-white px-1 text-[9px] font-black text-black">D</span>}
              </div>
              <div className="num truncate text-[10px] leading-tight text-muted">
                {seat.allIn ? 'ALL-IN' : seat.stack === null ? '—' : unit.format(seat.stack)}
              </div>
            </div>

            {seat.committed > 0 && (
              <div
                style={betPos}
                className="num absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-warn/90 px-1.5 text-[10px] font-bold text-black"
              >
                {unit.format(seat.committed)}
              </div>
            )}

            {isHero && hand.hole && !seat.folded && (
              <div style={cardPos} className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 gap-0.5">
                {hand.hole.kind === 'exact' ? (
                  <>
                    <PlayingCard card={hand.hole.cards[0]} size="xs" />
                    <PlayingCard card={hand.hole.cards[1]} size="xs" />
                  </>
                ) : (
                  <HandClassBadge handClass={hand.hole.handClass} size="xs" />
                )}
              </div>
            )}
            {!isHero && reveal && (
              <div style={cardPos} className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 gap-0.5">
                <PlayingCard card={reveal[0]} size="xs" />
                <PlayingCard card={reveal[1]} size="xs" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
