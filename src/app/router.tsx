import { createHashRouter } from 'react-router'
import { QuickCapture } from '../features/capture/QuickCapture'
import { HandsPage } from '../features/hands/HandsPage'
import { HandEditor } from '../features/review/HandEditor'
import { MorePage } from '../features/more/MorePage'
import { OddsHelper } from '../features/odds/OddsHelper'
import { Replayer } from '../features/replayer/Replayer'
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
      { path: 'hands', element: <HandsPage /> },
      { path: 'hands/:id', element: <HandEditor /> },
      { path: 'hands/:id/replay', element: <Replayer /> },
      { path: 'sessions', element: <SessionList /> },
      { path: 'sessions/:id', element: <SessionDetail /> },
      { path: 'stats', element: <Placeholder title="Stats" /> },
      { path: 'odds', element: <OddsHelper /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'more', element: <MorePage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/capture', element: <QuickCapture /> },
  { path: '/capture/:id', element: <QuickCapture /> },
])
