import { Link } from 'react-router'
import { EmptyState, Page, PageHeader } from '../../components/ui'
import { useSessions, useSettings } from '../../db/hooks'
import { formatDate, formatDuration, formatMoney } from '../../domain/format'
import { sessionDurationMs, sessionProfit, stakesLabel } from '../../domain/session'
import type { Session } from '../../domain/types'
import { useNow } from '../../lib/hooks'

export function SessionListItem({ session, currency }: { session: Session; currency: string }) {
  const now = useNow(60_000)
  const profit = sessionProfit(session)
  const live = session.endedAt === null
  const title = session.gameType === 'tournament' ? session.tournament?.name || 'Tournament' : stakesLabel(session)
  return (
    <Link to={`/sessions/${session.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 active:bg-surface-2 hover:bg-surface-2/60">
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">
          {title}
          {session.location && <span className="font-normal text-muted"> · {session.location}</span>}
        </div>
        <div className="text-xs text-muted">
          {formatDate(session.startedAt)} · {formatDuration(sessionDurationMs(session, now))}
          {session.gameType === 'tournament' && ' · MTT'}
        </div>
      </div>
      {live ? (
        <span className="rounded-full bg-win/15 px-2 py-0.5 text-xs font-bold text-win">LIVE</span>
      ) : (
        <span className={`num font-semibold ${profit !== null && profit < 0 ? 'text-loss' : 'text-win'}`}>
          {profit === null ? '—' : formatMoney(profit, currency, { signed: true })}
        </span>
      )}
    </Link>
  )
}

export function SessionList() {
  const sessions = useSessions()
  const settings = useSettings()
  return (
    <>
      <PageHeader title="Session history" back="/more" />
      <Page>
        {sessions && sessions.length === 0 && (
          <EmptyState icon="history" title="No sessions yet">
            Start one from the Session tab.
          </EmptyState>
        )}
        <div className="-mx-2">
          {settings &&
            sessions?.map((s) => <SessionListItem key={s.id} session={s} currency={settings.currencySymbol} />)}
        </div>
      </Page>
    </>
  )
}
