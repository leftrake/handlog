// Live-query hooks: components re-render whenever the underlying IndexedDB data changes.
// Each returns `undefined` while the first query is loading.
import { useLiveQuery } from 'dexie-react-hooks'
import type { Hand, Session, Settings, Tag } from '../domain/types'
import { db, SETTINGS_KEY } from './db'
import { getActiveSession, normalizeSettings } from './repo'

export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => normalizeSettings((await db.meta.get(SETTINGS_KEY))?.value), [])
}

export function useActiveSession(): Session | null | undefined {
  return useLiveQuery(() => getActiveSession(), [])
}

/** All sessions, newest first. */
export function useSessions(): Session[] | undefined {
  return useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray(), [])
}

export function useSession(id: string | undefined): Session | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.sessions.get(id)) ?? null) : null), [id])
}

/** All hands, newest first. */
export function useHands(): Hand[] | undefined {
  return useLiveQuery(() => db.hands.orderBy('createdAt').reverse().toArray(), [])
}

export function useHand(id: string | undefined): Hand | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.hands.get(id)) ?? null) : null), [id])
}

/** Hands for one session, oldest first (the order they were played). */
export function useSessionHands(sessionId: string | undefined): Hand[] | undefined {
  return useLiveQuery(
    async () => (sessionId ? (await db.hands.where('sessionId').equals(sessionId).sortBy('createdAt')) : []),
    [sessionId],
  )
}

export function useTags(): Tag[] | undefined {
  return useLiveQuery(() => db.tags.orderBy('order').toArray(), [])
}
