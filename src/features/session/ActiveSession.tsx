import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icon } from '../../components/icons'
import { Button, Field, NumberInput, Panel, Section, Sheet, TextArea } from '../../components/ui'
import { useSessionHands, useTags } from '../../db/hooks'
import { addRebuy, endSession, setBlindLevel, updateSession } from '../../db/repo'
import { formatDuration, formatMoney, formatNumber, formatShortTime } from '../../domain/format'
import { blindLevelLabel, sessionDurationMs, stakesLabel, totalInvested } from '../../domain/session'
import type { BlindLevel, Session, Settings } from '../../domain/types'
import { useNow } from '../../lib/hooks'
import { HandRow } from '../hands/HandRow'

type SheetKind = 'rebuy' | 'level' | 'end' | null

export function ActiveSession({ session, settings }: { session: Session; settings: Settings }) {
  const now = useNow(15_000)
  const navigate = useNavigate()
  const hands = useSessionHands(session.id)
  const tags = useTags()
  const tagMap = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags])
  const [sheet, setSheet] = useState<SheetKind>(null)
  const cur = settings.currencySymbol
  const isTourney = session.gameType === 'tournament'
  const invested = totalInvested(session)
  const handsNewestFirst = useMemo(() => [...(hands ?? [])].reverse(), [hands])

  return (
    <div className="space-y-5">
      <Panel className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-win">
              <span className="h-2 w-2 animate-pulse rounded-full bg-win" /> Live · {formatDuration(sessionDurationMs(session, now))}
            </div>
            <div className="mt-1 truncate text-xl font-bold">
              {isTourney ? session.tournament?.name || 'Tournament' : stakesLabel(session)}
            </div>
            <div className="truncate text-sm text-muted">
              {[session.location, `${session.tableSize}-handed`, isTourney && session.tournament && blindLevelLabel(session.tournament.level)]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted">{isTourney ? 'Entries' : 'In for'}</div>
            <div className="num text-xl font-bold">{formatMoney(invested, cur)}</div>
            {session.rebuys.length > 0 && (
              <div className="text-xs text-muted">
                +{session.rebuys.length} {isTourney ? 're-entry' : 'rebuy'}
                {session.rebuys.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button icon="plus" onClick={() => setSheet('rebuy')}>
            {isTourney ? 'Rebuy / add-on' : 'Rebuy'}
          </Button>
          {isTourney ? (
            <Button icon="chevronUp" onClick={() => setSheet('level')}>
              Blind level
            </Button>
          ) : (
            <Button icon="check" onClick={() => setSheet('end')}>
              Cash out
            </Button>
          )}
        </div>
        {isTourney && (
          <Button block icon="check" onClick={() => setSheet('end')}>
            Finish tournament
          </Button>
        )}
      </Panel>

      <Button variant="primary" size="lg" block icon="plus" onClick={() => navigate('/capture')}>
        Log a hand
      </Button>

      <Section
        title={`Hands this session (${hands?.length ?? 0})`}
        action={
          hands && hands.length > 0 ? (
            <Link to={`/sessions/${session.id}`} className="text-sm font-medium text-accent">
              Session details
            </Link>
          ) : undefined
        }
      >
        {handsNewestFirst.length === 0 ? (
          <p className="px-1 text-sm text-muted">Tap the + button after a hand to capture it. It takes about 10 seconds.</p>
        ) : (
          <div className="-mx-2">
            {handsNewestFirst.map((h) => (
              <HandRow key={h.id} hand={h} prefs={settings} tags={tagMap} to={`/capture/${h.id}`} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Session notes">
        <SessionNotes session={session} />
      </Section>

      <RebuySheet open={sheet === 'rebuy'} onClose={() => setSheet(null)} session={session} cur={cur} />
      {isTourney && session.tournament && (
        <LevelSheet open={sheet === 'level'} onClose={() => setSheet(null)} session={session} level={session.tournament.level} />
      )}
      <EndSheet open={sheet === 'end'} onClose={() => setSheet(null)} session={session} cur={cur} />
    </div>
  )
}

/** Notes save as you type (debounced) and when leaving the screen. */
export function SessionNotes({ session }: { session: Session }) {
  const [text, setText] = useState(session.notes)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(session.notes)

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
        void updateSession(session.id, { notes: latest.current })
      }
    }
  }, [session.id])

  return (
    <TextArea
      value={text}
      placeholder="Table dynamics, players, how you felt…"
      onChange={(e) => {
        const v = e.target.value
        setText(v)
        latest.current = v
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          timer.current = null
          void updateSession(session.id, { notes: v })
        }, 500)
      }}
    />
  )
}

// Each sheet's form only mounts while the sheet is open, so its fields start fresh every time.

function RebuySheet({ open, onClose, session, cur }: { open: boolean; onClose: () => void; session: Session; cur: string }) {
  return (
    <Sheet open={open} onClose={onClose} title={session.gameType === 'tournament' ? 'Rebuy / add-on' : 'Add a rebuy'}>
      <RebuyForm session={session} cur={cur} onDone={onClose} />
    </Sheet>
  )
}

function RebuyForm({ session, cur, onDone }: { session: Session; cur: string; onDone: () => void }) {
  const [amount, setAmount] = useState<number | null>(session.buyIn || null)
  const quick = [session.buyIn, session.buyIn / 2].filter((v, i, a) => v > 0 && a.indexOf(v) === i)
  return (
    <div className="space-y-3">
      <Field label={`Amount (${cur})`}>
        <NumberInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      <div className="flex gap-2">
        {quick.map((q) => (
          <Button key={q} size="sm" onClick={() => setAmount(q)}>
            {formatMoney(q, cur)}
          </Button>
        ))}
      </div>
      <Button
        variant="primary"
        size="lg"
        block
        disabled={!amount || amount <= 0}
        onClick={async () => {
          if (!amount) return
          await addRebuy(session.id, amount)
          onDone()
        }}
      >
        Add {amount ? formatMoney(amount, cur) : ''}
      </Button>
    </div>
  )
}

function LevelSheet({ open, onClose, session, level }: { open: boolean; onClose: () => void; session: Session; level: BlindLevel }) {
  return (
    <Sheet open={open} onClose={onClose} title="Blind level">
      <LevelForm session={session} level={level} onDone={onClose} />
    </Sheet>
  )
}

function LevelForm({ session, level, onDone }: { session: Session; level: BlindLevel; onDone: () => void }) {
  const [next, setNext] = useState<BlindLevel>(() => ({ ...level, level: level.level + 1 }))
  const set = (patch: Partial<BlindLevel>) => setNext((l) => ({ ...l, ...patch }))
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Currently {blindLevelLabel(level)}. New hands record stacks and results in big blinds at this level.
      </p>
      <div className="grid grid-cols-4 gap-2">
        <Field label="Level">
          <NumberInput value={next.level} allowEmpty={false} onChange={(v) => set({ level: v ?? level.level })} />
        </Field>
        <Field label="SB">
          <NumberInput value={next.sb} onChange={(v) => set({ sb: v ?? 0 })} />
        </Field>
        <Field label="BB">
          <NumberInput value={next.bb} onChange={(v) => set({ bb: v ?? 0 })} />
        </Field>
        <Field label="Ante">
          <NumberInput value={next.ante ?? null} onChange={(v) => set({ ante: v ?? undefined })} />
        </Field>
      </div>
      <Button size="sm" onClick={() => set({ sb: level.sb * 2, bb: level.bb * 2, ante: level.ante ? level.ante * 2 : undefined })}>
        Double blinds ({formatNumber(level.sb * 2)}/{formatNumber(level.bb * 2)})
      </Button>
      <Button
        variant="primary"
        size="lg"
        block
        disabled={!(next.bb > 0 && next.sb > 0)}
        onClick={async () => {
          await setBlindLevel(session.id, next)
          onDone()
        }}
      >
        Set level {next.level}
      </Button>
    </div>
  )
}

function EndSheet({ open, onClose, session, cur }: { open: boolean; onClose: () => void; session: Session; cur: string }) {
  const isTourney = session.gameType === 'tournament'
  return (
    <Sheet open={open} onClose={onClose} title={isTourney ? 'Finish tournament' : 'Cash out'}>
      <EndForm session={session} cur={cur} onDone={onClose} />
    </Sheet>
  )
}

function EndForm({ session, cur, onDone }: { session: Session; cur: string; onDone: () => void }) {
  const isTourney = session.gameType === 'tournament'
  const [cashOut, setCashOut] = useState<number | null>(isTourney ? 0 : null)
  const invested = totalInvested(session)
  const profit = cashOut === null ? null : cashOut - invested
  return (
    <div className="space-y-3">
      <Field label={isTourney ? `Prize won (${cur}), 0 if you busted` : `Cash-out amount (${cur})`}>
        <NumberInput value={cashOut} onChange={setCashOut} autoFocus placeholder="0" />
      </Field>
      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm">
        <span className="text-muted">
          In for {formatMoney(invested, cur)} · {formatShortTime(session.startedAt)} – now
        </span>
        {profit !== null && (
          <span className={`num font-bold ${profit >= 0 ? 'text-win' : 'text-loss'}`}>
            {formatMoney(profit, cur, { signed: true })}
          </span>
        )}
      </div>
      <Button
        variant="primary"
        size="lg"
        block
        disabled={cashOut === null || cashOut < 0}
        onClick={async () => {
          if (cashOut === null) return
          await endSession(session.id, cashOut)
          onDone()
        }}
      >
        <Icon name="check" /> End session
      </Button>
    </div>
  )
}
