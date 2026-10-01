import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { TableSizePicker } from '../../components/TableSize'
import { Banner, Button, ConfirmButton, EmptyState, Field, IconButton, NumberInput, Page, PageHeader, Panel, Section, Segmented, TextInput } from '../../components/ui'
import { useActiveSession, useSession, useSessionHands, useSettings, useTags } from '../../db/hooks'
import { deleteSession, removeRebuy, resumeSession, updateSession } from '../../db/repo'
import { formatDuration, formatMoney, formatShortTime, toDateTimeInput } from '../../domain/format'
import { round2 } from '../../domain/money'
import { blindLevelLabel, sessionDurationMs, sessionHours, sessionProfit, stakesLabel, totalInvested } from '../../domain/session'
import type { Session } from '../../domain/types'
import { useNow } from '../../lib/hooks'
import { HandRow } from '../hands/HandRow'
import { SessionNotes } from './ActiveSession'

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'win' | 'loss' }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num text-lg font-bold ${tone === 'win' ? 'text-win' : tone === 'loss' ? 'text-loss' : ''}`}>{value}</div>
    </div>
  )
}

function parseDateTime(v: string): number | null {
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : null
}

export function SessionDetail() {
  const { id } = useParams()
  const session = useSession(id)
  const settings = useSettings()
  const active = useActiveSession()
  const hands = useSessionHands(id)
  const tags = useTags()
  const tagMap = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags])
  const navigate = useNavigate()
  const now = useNow(30_000)
  const [keepHands, setKeepHands] = useState(true)

  if (session === undefined || !settings) return <PageHeader title="Session" back />
  if (session === null) {
    return (
      <>
        <PageHeader title="Session" back="/sessions" />
        <EmptyState title="Session not found" />
      </>
    )
  }

  const cur = settings.currencySymbol
  const isTourney = session.gameType === 'tournament'
  const profit = sessionProfit(session)
  const hours = sessionHours(session, now)
  const save = (patch: Partial<Session>) => updateSession(session.id, patch)
  const live = session.endedAt === null

  return (
    <>
      <PageHeader
        title={isTourney ? session.tournament?.name || 'Tournament' : stakesLabel(session)}
        subtitle={[session.location, live ? 'Live' : null].filter(Boolean).join(' · ')}
        back
      />
      <Page className="space-y-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Result" value={profit === null ? '—' : formatMoney(profit, cur, { signed: true })} tone={profit === null ? undefined : profit >= 0 ? 'win' : 'loss'} />
          <Stat label="Duration" value={formatDuration(sessionDurationMs(session, now))} />
          <Stat label="$/hour" value={profit === null || hours <= 0 ? '—' : formatMoney(round2(profit / hours), cur, { signed: true })} />
          {isTourney ? (
            <Stat label="Invested" value={formatMoney(totalInvested(session), cur)} />
          ) : (
            <Stat
              label="BB/hour"
              value={profit === null || hours <= 0 ? '—' : `${round2(profit / session.stakes.bb / hours)}`}
            />
          )}
        </div>

        <Section title="Details">
          <Panel className="space-y-3">
            <Field label="Location">
              <TextInput defaultValue={session.location} onBlur={(e) => save({ location: e.target.value.trim() })} />
            </Field>
            {isTourney ? (
              <Field label="Tournament name">
                <TextInput
                  defaultValue={session.tournament?.name ?? ''}
                  onBlur={(e) => session.tournament && save({ tournament: { ...session.tournament, name: e.target.value } })}
                />
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Field label={`SB (${cur})`}>
                  <NumberInput value={session.stakes.sb} onChange={(v) => v && save({ stakes: { ...session.stakes, sb: v } })} />
                </Field>
                <Field label={`BB (${cur})`}>
                  <NumberInput value={session.stakes.bb} onChange={(v) => v && save({ stakes: { ...session.stakes, bb: v } })} />
                </Field>
              </div>
            )}
            {isTourney && session.tournament && (
              <p className="text-sm text-muted">Current level: {blindLevelLabel(session.tournament.level)}</p>
            )}
            <Field label="Players at the table" hint="Used for new hands. Each logged hand keeps its own table size.">
              <TableSizePicker value={session.tableSize} onChange={(tableSize) => save({ tableSize })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Started">
                <TextInput
                  type="datetime-local"
                  defaultValue={toDateTimeInput(session.startedAt)}
                  onBlur={(e) => {
                    const t = parseDateTime(e.target.value)
                    if (t) save({ startedAt: t })
                  }}
                />
              </Field>
              <Field label="Ended">
                <TextInput
                  type="datetime-local"
                  disabled={live}
                  defaultValue={session.endedAt ? toDateTimeInput(session.endedAt) : ''}
                  onBlur={(e) => {
                    const t = parseDateTime(e.target.value)
                    if (t) save({ endedAt: t })
                  }}
                />
              </Field>
            </div>
            <p className="text-xs text-faint">Stake changes apply to new hands only; logged hands keep the stakes they were played at.</p>
          </Panel>
        </Section>

        <Section title="Money">
          <Panel className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label={`${isTourney ? 'Entry fee' : 'Buy-in'} (${cur})`}>
                <NumberInput value={session.buyIn} onChange={(v) => save({ buyIn: v ?? 0 })} />
              </Field>
              <Field label={`${isTourney ? 'Prize' : 'Cash-out'} (${cur})`}>
                <NumberInput
                  value={session.cashOut}
                  disabled={live}
                  placeholder={live ? 'Still playing' : '0'}
                  onChange={(v) => save({ cashOut: v })}
                />
              </Field>
            </div>
            {session.rebuys.length > 0 && (
              <div>
                <div className="mb-1 text-[13px] font-medium text-muted">Rebuys</div>
                {session.rebuys.map((r, i) => (
                  <div key={`${r.at}-${i}`} className="flex items-center justify-between border-b border-line/60 py-1 last:border-0">
                    <span className="num">
                      {formatMoney(r.amount, cur)} <span className="text-sm text-muted">at {formatShortTime(r.at)}</span>
                    </span>
                    <IconButton icon="trash" label="Remove rebuy" onClick={() => removeRebuy(session.id, i)} />
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total invested</span>
              <span className="num font-semibold">{formatMoney(totalInvested(session), cur)}</span>
            </div>
          </Panel>
        </Section>

        <Section title="Notes">
          <SessionNotes session={session} />
        </Section>

        <Section title={`Hands (${hands?.length ?? 0})`}>
          {hands && hands.length === 0 ? (
            <p className="px-1 text-sm text-muted">No hands logged in this session.</p>
          ) : (
            <div className="-mx-2">
              {hands?.map((h) => (
                <HandRow key={h.id} hand={h} prefs={settings} tags={tagMap} to={`/hands/${h.id}`} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Manage">
          <Panel className="space-y-3">
            {!live && (
              <>
                {active && active.id !== session.id ? (
                  <Banner>End your current session before re-opening this one.</Banner>
                ) : (
                  <Button block icon="undo" onClick={() => resumeSession(session.id).then(() => navigate('/'))}>
                    Re-open session
                  </Button>
                )}
              </>
            )}
            {hands && hands.length > 0 && (
              <Segmented
                size="sm"
                value={keepHands ? 'keep' : 'delete'}
                onChange={(v) => setKeepHands(v === 'keep')}
                options={[
                  { value: 'keep', label: 'Keep its hands' },
                  { value: 'delete', label: 'Delete its hands too' },
                ]}
              />
            )}
            <ConfirmButton
              block
              icon="trash"
              variant="danger"
              onConfirm={async () => {
                await deleteSession(session.id, { deleteHands: !keepHands })
                navigate('/sessions', { replace: true })
              }}
            >
              Delete session
            </ConfirmButton>
          </Panel>
        </Section>
      </Page>
    </>
  )
}
