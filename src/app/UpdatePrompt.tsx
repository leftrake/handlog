import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../components/ui'

const HOUR = 60 * 60 * 1000

/** Registers the service worker; offers new versions instead of reloading under the user. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Long sessions keep the app open for hours: look for updates hourly.
      if (registration) setInterval(() => void registration.update(), HOUR)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 4000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6">
      <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-surface-3 px-4 py-2.5 text-sm shadow-xl">
        {needRefresh ? (
          <>
            <span>A new version of HandLog is ready.</span>
            <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>
              Reload
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
              Later
            </Button>
          </>
        ) : (
          <span>HandLog is ready to work offline.</span>
        )}
      </div>
    </div>
  )
}
