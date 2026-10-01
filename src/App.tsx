import { useHands, useSessions, useSettings, useTags } from './db/hooks'

// Temporary shell for the storage phase; replaced by the routed app in the next phase.
export default function App() {
  const settings = useSettings()
  const sessions = useSessions()
  const hands = useHands()
  const tags = useTags()
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">HandLog</h1>
      <p className="mt-2 text-muted">Storage ready.</p>
      <dl className="num mt-4 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted">Sessions</dt>
        <dd>{sessions?.length ?? '…'}</dd>
        <dt className="text-muted">Hands</dt>
        <dd>{hands?.length ?? '…'}</dd>
        <dt className="text-muted">Tags</dt>
        <dd>{tags?.map((t) => t.name).join(', ') ?? '…'}</dd>
        <dt className="text-muted">Theme</dt>
        <dd>{settings?.theme ?? '…'}</dd>
      </dl>
    </main>
  )
}
