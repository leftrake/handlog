import { useLiveQuery } from 'dexie-react-hooks'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { Icon, type IconName } from '../components/icons'
import { cx } from '../lib/cx'
import { db } from '../db/db'
import { useActiveSession } from '../db/hooks'

interface NavItem {
  to: string
  label: string
  icon: IconName
  end?: boolean
}

const LEFT: NavItem[] = [
  { to: '/', label: 'Session', icon: 'chip', end: true },
  { to: '/hands', label: 'Hands', icon: 'list' },
]
const RIGHT: NavItem[] = [
  { to: '/stats', label: 'Stats', icon: 'chart' },
  { to: '/more', label: 'More', icon: 'dots' },
]
const DESKTOP_EXTRA: NavItem[] = [
  { to: '/sessions', label: 'Session history', icon: 'history' },
  { to: '/odds', label: 'Odds helper', icon: 'calculator' },
  { to: '/settings', label: 'Settings', icon: 'sliders' },
]

function useQueueCount(): number {
  return useLiveQuery(() => db.hands.filter((h) => h.flagged && h.reviewStatus === 'unreviewed').count(), []) ?? 0
}

function Badge({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span className="num absolute -right-2 -top-1 min-w-[18px] rounded-full bg-accent px-1 text-center text-[11px] font-bold leading-[18px] text-accent-fg">
      {n > 99 ? '99+' : n}
    </span>
  )
}

function TabLink({ item, badge, live }: { item: NavItem; badge?: number; live?: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx('flex flex-1 flex-col items-center justify-center gap-0.5 pt-1 text-[11px] font-medium', isActive ? 'text-fg' : 'text-faint')
      }
    >
      <span className="relative">
        <Icon name={item.icon} size={24} />
        {badge !== undefined && <Badge n={badge} />}
        {live && <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-win" />}
      </span>
      {item.label}
    </NavLink>
  )
}

/** Phone: bottom tab bar with a big centre "log hand" button. Desktop: left sidebar. */
export function AppShell() {
  const navigate = useNavigate()
  const active = useActiveSession()
  const queue = useQueueCount()

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 md:flex">
        <div className="mb-4 flex items-center gap-2 px-2">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8" />
          <span className="text-lg font-bold">HandLog</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/capture')}
          className="mb-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-accent-fg active:brightness-90"
        >
          <Icon name="plus" /> Log hand
        </button>
        <nav className="flex flex-col gap-1">
          {[...LEFT, ...RIGHT.filter((i) => i.to !== '/more'), ...DESKTOP_EXTRA].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium',
                  isActive ? 'bg-surface-3 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              <Icon name={item.icon} size={18} />
              <span className="flex-1">{item.label}</span>
              {item.to === '/hands' && queue > 0 && (
                <span className="num rounded-full bg-accent px-2 text-xs font-bold leading-5 text-accent-fg">{queue}</span>
              )}
              {item.to === '/' && active && <span className="h-2 w-2 rounded-full bg-win" />}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </main>

      {/* Phone tab bar */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <div className="mx-auto flex h-[68px] max-w-lg items-stretch">
          {LEFT.map((item) => (
            <TabLink key={item.to} item={item} badge={item.to === '/hands' ? queue : undefined} live={item.to === '/' && !!active} />
          ))}
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              aria-label="Log a hand"
              onClick={() => navigate('/capture')}
              className="-mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg shadow-black/40 ring-4 ring-bg active:scale-95"
            >
              <Icon name="plus" size={30} strokeWidth={2.5} />
            </button>
          </div>
          {RIGHT.map((item) => (
            <TabLink key={item.to} item={item} />
          ))}
        </div>
      </nav>
    </div>
  )
}
