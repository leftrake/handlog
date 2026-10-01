import { Link } from 'react-router'
import { Banner, Page, PageHeader, Panel, Section } from '../../components/ui'
import { useActiveSession, useSessions, useSettings } from '../../db/hooks'
import { backupAge } from '../../domain/backup'
import { useNow } from '../../lib/hooks'
import { StartSessionForm } from './StartSessionForm'
import { ActiveSession } from './ActiveSession'
import { SessionListItem } from './SessionList'

export function SessionHome() {
  const settings = useSettings()
  const active = useActiveSession()
  const sessions = useSessions()
  const now = useNow(60_000)

  if (!settings || active === undefined) return <PageHeader title="Session" />

  const recent = (sessions ?? []).filter((s) => s.endedAt !== null).slice(0, 3)

  return (
    <>
      <PageHeader title={active ? 'Session' : 'Start a session'} />
      <Page>
        {active ? (
          <ActiveSession key={active.id} session={active} settings={settings} />
        ) : (
          <>
            {(sessions?.length ?? 0) > 0 && backupAge(settings.lastBackupAt, now).stale && (
              <Banner tone="warn" icon="alert" className="mb-3">
                {backupAge(settings.lastBackupAt, now).label}.{' '}
                <Link to="/settings" className="font-semibold underline">
                  Back up now
                </Link>{' '}
                so a lost phone doesn't mean lost hands.
              </Banner>
            )}
            <Panel>
              <StartSessionForm settings={settings} />
            </Panel>
            {recent.length > 0 && (
              <Section
                className="mt-6"
                title="Recent sessions"
                action={
                  <Link to="/sessions" className="text-sm font-medium text-accent">
                    All sessions
                  </Link>
                }
              >
                <div className="-mx-2">
                  {recent.map((s) => (
                    <SessionListItem key={s.id} session={s} currency={settings.currencySymbol} />
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </Page>
    </>
  )
}
