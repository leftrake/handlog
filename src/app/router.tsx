import { createHashRouter } from 'react-router'
import { QuickCapture } from '../features/capture/QuickCapture'
import { MorePage } from '../features/more/MorePage'
import { SessionDetail } from '../features/session/SessionDetail'
import { SessionHome } from '../features/session/SessionHome'
import { SessionList } from '../features/session/SessionList'
import { SettingsPage } from '../features/settings/SettingsPage'
import { AppShell } from './AppShell'
import { NotFound, Placeholder } from './fallbacks'

// Hash routing: deep links work on GitHub Pages and from the offline cache without server rewrites.
export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <SessionHome /> },
      { path: 'hands', element: <Placeholder title="Hands" /> },
      { path: 'hands/:id', element: <Placeholder title="Hand review" /> },
      { path: 'sessions', element: <SessionList /> },
      { path: 'sessions/:id', element: <SessionDetail /> },
      { path: 'stats', element: <Placeholder title="Stats" /> },
      { path: 'odds', element: <Placeholder title="Odds helper" /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'more', element: <MorePage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/capture', element: <QuickCapture /> },
  { path: '/capture/:id', element: <QuickCapture /> },
])
