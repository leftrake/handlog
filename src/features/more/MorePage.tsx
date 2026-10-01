import { Link } from 'react-router'
import { Icon, type IconName } from '../../components/icons'
import { Page, PageHeader } from '../../components/ui'

const LINKS: { to: string; label: string; detail: string; icon: IconName }[] = [
  { to: '/hands?view=queue', label: 'Review queue', detail: 'Flagged hands, oldest first', icon: 'book' },
  { to: '/sessions', label: 'Session history', detail: 'Every session and its result', icon: 'history' },
  { to: '/odds', label: 'Odds helper', detail: 'Pot odds and outs to equity', icon: 'calculator' },
  { to: '/settings', label: 'Settings', detail: 'Backup, defaults, tags, theme', icon: 'sliders' },
]

export function MorePage() {
  return (
    <>
      <PageHeader title="More" />
      <Page>
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
          {LINKS.map((l) => (
            <li key={l.to} className="border-b border-line/60 last:border-0">
              <Link to={l.to} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-muted">
                  <Icon name={l.icon} size={20} />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{l.label}</span>
                  <span className="block text-sm text-muted">{l.detail}</span>
                </span>
                <Icon name="chevronRight" size={18} className="text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </Page>
    </>
  )
}
