import { useState } from 'react'
import { CardPad } from '../../components/CardPad'
import { PlayingCard } from '../../components/PlayingCard'
import { Button, Chip, IconButton, NumberInput, TextArea, TextInput } from '../../components/ui'
import { unavailableCards } from '../../domain/cards'
import { involvedPositions, knownCards } from '../../domain/hand'
import { positionLabel, positionRank, positionsFor } from '../../domain/positions'
import type { Card, Hand, Player, Position } from '../../domain/types'
import type { AmountUnit } from './amountUnit'

function ShownCards({ hand, player, onChange }: { hand: Hand; player: Player; onChange: (cards: [Card, Card] | undefined) => void }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<Card | null>(null)
  const blocked = unavailableCards([...knownCards(hand).filter((c) => !player.shown?.includes(c)), pending])
  const shown = player.shown
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-muted">Cards shown</span>
        <div className="flex gap-1">
          <PlayingCard card={shown?.[0] ?? pending} size="sm" />
          <PlayingCard card={shown?.[1] ?? null} size="sm" />
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>
          {open ? 'Close' : shown ? 'Change' : 'Add'}
        </Button>
        {shown && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onChange(undefined)
              setPending(null)
            }}
          >
            Clear
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-2">
          <CardPad
            blocked={blocked}
            onPick={(card) => {
              if (!pending) {
                setPending(card)
                if (shown) onChange(undefined)
              } else {
                onChange([pending, card])
                setPending(null)
                setOpen(false)
              }
            }}
            onClear={() => setPending(null)}
          />
        </div>
      )}
    </div>
  )
}

function PlayerCard({
  hand,
  player,
  unit,
  canRemove,
  onChange,
  onRemove,
}: {
  hand: Hand
  player: Player
  unit: AmountUnit
  canRemove: boolean
  onChange: (patch: Partial<Player>) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface-2/40 p-3">
      <div className="flex items-center gap-2">
        <span className="w-14 font-bold">{positionLabel(player.position, hand.tableSize)}</span>
        {player.isHero && <span className="rounded bg-accent-soft px-1.5 text-xs font-semibold text-accent">You</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <NumberInput
            aria-label={`${positionLabel(player.position, hand.tableSize)} starting stack`}
            className="h-10 w-28 text-right"
            placeholder="Stack"
            value={player.stack === null ? null : unit.toDisplay(player.stack)}
            onChange={(v) => onChange({ stack: v === null ? null : unit.fromDisplay(v) })}
          />
          <span className="w-6 text-xs text-muted">{unit.label}</span>
          {canRemove && <IconButton icon="trash" label="Remove player" className="h-10 w-9" onClick={onRemove} />}
        </div>
      </div>
      {!player.isHero && (
        <>
          <TextInput
            placeholder="Description (e.g. 50s reg, loose-passive)"
            value={player.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value || undefined })}
          />
          <TextArea
            rows={2}
            className="min-h-16"
            placeholder="Reads and history with this player"
            value={player.reads ?? ''}
            onChange={(e) => onChange({ reads: e.target.value || undefined })}
          />
          <ShownCards hand={hand} player={player} onChange={(shown) => onChange({ shown })} />
        </>
      )}
    </div>
  )
}

export function PlayersEditor({
  hand,
  unit,
  onChange,
}: {
  hand: Hand
  unit: AmountUnit
  onChange: (players: Player[]) => void
}) {
  const players = [...hand.players].sort((a, b) => positionRank(a.position) - positionRank(b.position))
  const acting = involvedPositions(hand)
  const free = positionsFor(hand.tableSize).filter((p) => !hand.players.some((x) => x.position === p))
  const heroStack = hand.players.find((p) => p.isHero)?.stack ?? null

  const patch = (pos: Position, change: Partial<Player>) =>
    onChange(hand.players.map((p) => (p.position === pos ? { ...p, ...change } : p)))

  return (
    <div className="space-y-2">
      {players.length === 0 && (
        <p className="text-sm text-muted">Set your position (Edit quick details) or add actions, and players appear here.</p>
      )}
      {players.map((p) => (
        <PlayerCard
          key={p.position}
          hand={hand}
          player={p}
          unit={unit}
          canRemove={!p.isHero && !acting.has(p.position)}
          onChange={(change) => patch(p.position, change)}
          onRemove={() => onChange(hand.players.filter((x) => x.position !== p.position))}
        />
      ))}
      {free.length > 0 && (
        <div>
          <div className="mb-1 text-[13px] font-medium text-muted">Add a villain</div>
          <div className="flex flex-wrap gap-1.5">
            {free.map((p) => (
              <Chip key={p} onClick={() => onChange([...hand.players, { position: p, isHero: false, stack: heroStack }])}>
                + {positionLabel(p, hand.tableSize)}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
