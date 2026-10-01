import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Banner, EmptyState, Page, PageHeader, Panel, Section, Segmented } from '../../components/ui'
import { useHands, useSessions, useSettings } from '../../db/hooks'
import { formatBB, formatDate, formatDuration, formatMoney, formatPercent } from '../../domain/format'
import { positionLabel } from '../../domain/positions'
import { sessionProfit, stakesLabel } from '../../domain/session'
import {
  filterSessions,
  filterStatHands,
  handSample,
  profitTimeline,
  resultsByPosition,
  sessionStats,
  startingHandGrid,
  type StatsFilter,
} from '../../domain/stats'
import type { GameType } from '../../domain/types'
import { useLocalPref, useNow } from '../../lib/hooks'
import { cx } from '../../lib/cx'
import { HandGrid } from './HandGrid'
import { PositionBars } from './PositionBars'
import { ProfitChart } from './ProfitChart'

type Range = 'all' | '30' | '90' | 'year'
type Game = 'all' | GameType

function rangeStart(range: Range, now: number): number | undefined {
  if (range === '30') return now - 30 * 86_400_000
  if (range === '90') return now - 90 * 86_400_000
  if (range === 'year') return new Date(new Date(now).getFullYear(), 0, 1).getTime()
  return undefined
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'win' | 'loss' }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={cx('text-xl font-bold', tone === 'win' && 'text-win', tone === 'loss' && 'text-loss')}>{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  )
}

function TableToggle({ children }: { children: ReactNode }) {
  return (
    <details className="group mt-3">
      <summary className="cursor-pointer list-none text-sm font-medium text-accent">
        <span className="group-open:hidden">Show as table</span>
        <span className="hidden group-open:inline">Hide table</span>
      </summary>
      <div className="mt-2 overflow-x-auto">{children}</div>
    </details>
  )
}

const th = 'px-2 py-1.5 text-left text-xs font-semibold text-muted'
const td = 'num px-2 py-1.5 text-sm'

export function StatsPage() {
  const sessions = useSessions()
  const hands = useHands()
  const settings = useSettings()
  const [range, setRange] = useLocalPref<Range>('handlog.stats.range', 'all')
  const [game, setGame] = useLocalPref<Game>('handlog.stats.game', 'all')

  const now = useNow(60_000)
  const filter: StatsFilter = useMemo(
    () => ({ from: rangeStart(range, now), gameType: game === 'all' ? undefined : game }),
    [range, game, now],
  )
  const fs = useMemo(() => filterSessions(sessions ?? [], filter), [sessions, filter])
  const fh = useMemo(() => filterStatHands(hands ?? [], filter), [hands, filter])
  const stats = useMemo(() => sessionStats(fs), [fs])
  const timeline = useMemo(() => profitTimeline(fs), [fs])
  const sample = useMemo(() => handSample(fh), [fh])
  const byPos = useMemo(() => resultsByPosition(fh), [fh])
  const grid = useMemo(() => startingHandGrid(fh), [fh])
  const sessionMap = useMemo(() => new Map(fs.map((s) => [s.id, s])), [fs])

  if (!sessions || !hands || !settings) return <PageHeader title="Stats" />
  const cur = settings.currencySymbol
  const money = (n: number, signed = false) => formatMoney(n, cur, { signed })
  const finished = fs.filter((s) => sessionProfit(s) !== null).sort((a, b) => b.startedAt - a.startedAt)
  const showCash = game !== 'tournament' && stats.cash.count > 0
  const showMtt = game !== 'cash' && stats.tournament.count > 0

  return (
    <>
      <PageHeader title="Stats" />
      <Page className="lg:max-w-5xl">
        {/* One filter row scopes everything below. */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Segmented<Range>
            size="sm"
            className="sm:flex-[2]"
            ariaLabel="Date range"
            value={range}
            onChange={setRange}
            options={[
              { value: 'all', label: 'All time' },
              { value: '30', label: '30d' },
              { value: '90', label: '90d' },
              { value: 'year', label: 'This year' },
            ]}
          />
          <Segmented<Game>
            size="sm"
            className="sm:flex-1"
            ariaLabel="Game type"
            value={game}
            onChange={setGame}
            options={[
              { value: 'all', label: 'All' },
              { value: 'cash', label: 'Cash' },
              { value: 'tournament', label: 'Tournament' },
            ]}
          />
        </div>

        <Section
          title="Session results"
          action={<span className="rounded-full bg-win/15 px-2 py-0.5 text-[11px] font-semibold text-win">Complete record</span>}
        >
          {stats.count === 0 ? (
            <Panel>
              <EmptyState icon="chart" title="No finished sessions in this range">
                End a session with a cash-out and it shows up here.
              </EmptyState>
            </Panel>
          ) : (
            <div className="space-y-3">
              <Panel>
                <div className="text-xs text-muted">Net profit · {stats.count} session{stats.count === 1 ? '' : 's'}</div>
                <div className={cx('text-5xl font-bold tracking-tight', stats.profit >= 0 ? 'text-win' : 'text-loss')}>
                  {money(stats.profit, true)}
                </div>
                <div className="mt-1 text-sm text-muted">
                  {formatDuration(stats.hours * 3_600_000)} played · {stats.winning} winning, {stats.count - stats.winning} losing
                </div>
              </Panel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Tile label="$ per hour" value={stats.perHour === null ? '—' : money(stats.perHour, true)} sub="all finished sessions" />
                {showCash && (
                  <Tile
                    label="BB per hour"
                    value={stats.cash.bbPerHour === null ? '—' : `${stats.cash.bbPerHour > 0 ? '+' : ''}${stats.cash.bbPerHour}`}
                    sub={`cash · ${formatBB(stats.cash.bbWon, { signed: true })} total`}
                  />
                )}
                {showCash && <Tile label="Cash $/hour" value={stats.cash.perHour === null ? '—' : money(stats.cash.perHour, true)} sub={`${stats.cash.count} sessions`} />}
                {showMtt && (
                  <Tile
                    label="Tournament ROI"
                    value={stats.tournament.roi === null ? '—' : `${stats.tournament.roi >= 0 ? '+' : ''}${formatPercent(stats.tournament.roi, 0)}`}
                    sub={`${stats.tournament.cashes} cash${stats.tournament.cashes === 1 ? '' : 'es'} in ${stats.tournament.count}`}
                  />
                )}
              </div>
              <Panel>
                <h3 className="text-sm font-semibold">Profit over time</h3>
                <p className="mb-2 text-xs text-muted">Running total after each finished session</p>
                <ProfitChart points={timeline} sessions={sessionMap} currency={cur} />
                <TableToggle>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-line">
                        <th className={th}>Date</th>
                        <th className={th}>Game</th>
                        <th className={cx(th, 'text-right')}>Hours</th>
                        <th className={cx(th, 'text-right')}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finished.map((s) => (
                        <tr key={s.id} className="border-b border-line/40">
                          <td className={td}>
                            <Link to={`/sessions/${s.id}`} className="text-accent">
                              {formatDate(s.startedAt)}
                            </Link>
                          </td>
                          <td className={td}>
                            {s.gameType === 'tournament' ? s.tournament?.name || 'Tournament' : stakesLabel(s)}
                            {s.location ? ` · ${s.location}` : ''}
                          </td>
                          <td className={cx(td, 'text-right')}>{(((s.endedAt ?? s.startedAt) - s.startedAt) / 3_600_000).toFixed(1)}</td>
                          <td className={cx(td, 'text-right font-semibold')}>{money(sessionProfit(s) ?? 0, true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableToggle>
              </Panel>
            </div>
          )}
        </Section>

        <Section title="Logged hands">
          <Banner tone="warn" icon="alert" className="mb-3">
            <b>Biased sample.</b> Hand stats only include hands you chose to log, and you log big and interesting
            hands far more often than routine folds. Use them to spot patterns worth studying, not as a win rate.
            Session results above are complete.
          </Banner>
          {sample.logged === 0 ? (
            <Panel>
              <EmptyState icon="list" title="No hands logged in this range" />
            </Panel>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              <Panel>
                <h3 className="text-sm font-semibold">Results by position</h3>
                <p className="num mb-3 text-xs text-muted">
                  Net big blinds per position · {sample.logged} hands logged, net {formatBB(sample.netBB, { signed: true })}
                </p>
                {byPos.length > 0 ? <PositionBars rows={byPos} /> : <p className="text-sm text-muted">No positions recorded.</p>}
                <TableToggle>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-line">
                        <th className={th}>Position</th>
                        <th className={cx(th, 'text-right')}>Hands</th>
                        <th className={cx(th, 'text-right')}>Won / lost</th>
                        <th className={cx(th, 'text-right')}>Net</th>
                        <th className={cx(th, 'text-right')}>Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byPos.map((r) => (
                        <tr key={r.position} className="border-b border-line/40">
                          <td className={td}>{positionLabel(r.position)}</td>
                          <td className={cx(td, 'text-right')}>{r.hands}</td>
                          <td className={cx(td, 'text-right')}>
                            {r.won} / {r.lost}
                          </td>
                          <td className={cx(td, 'text-right font-semibold')}>{formatBB(r.netBB, { signed: true })}</td>
                          <td className={cx(td, 'text-right')}>{r.avgBB === null ? '—' : formatBB(r.avgBB, { signed: true })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableToggle>
              </Panel>
              <Panel>
                <h3 className="text-sm font-semibold">Starting hands</h3>
                <p className="mb-3 text-xs text-muted">How often you logged each hand, and your net result with it</p>
                <HandGrid cells={grid} />
                <TableToggle>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-line">
                        <th className={th}>Hand</th>
                        <th className={cx(th, 'text-right')}>Logged</th>
                        <th className={cx(th, 'text-right')}>Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grid
                        .filter((c) => c.count > 0)
                        .sort((a, b) => b.count - a.count || b.netBB - a.netBB)
                        .map((c) => (
                          <tr key={c.handClass} className="border-b border-line/40">
                            <td className={td}>{c.handClass}</td>
                            <td className={cx(td, 'text-right')}>{c.count}</td>
                            <td className={cx(td, 'text-right font-semibold')}>{c.withResult ? formatBB(c.netBB, { signed: true }) : '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </TableToggle>
              </Panel>
            </div>
          )}
        </Section>
      </Page>
    </>
  )
}
