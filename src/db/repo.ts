// Data access for sessions, hands, tags and settings. UI code calls these; never Dexie directly.
import { createHand, handContextFromSession, handContextFromSettings, type HandContext } from '../domain/hand'
import { buildSampleData } from '../domain/sampleData'
import { createSession, sessionDefaultsFrom } from '../domain/session'
import {
  DEFAULT_SETTINGS,
  type BlindLevel,
  type Hand,
  type Session,
  type SessionDefaults,
  type Settings,
  type Tag,
} from '../domain/types'
import { newId } from '../lib/id'
import { db, defaultTags, SETTINGS_KEY } from './db'

// ── settings ─────────────────────────────────────────────

export function normalizeSettings(value: unknown): Settings {
  const v = (value ?? {}) as Partial<Settings>
  return { ...DEFAULT_SETTINGS, ...v, defaultStakes: { ...DEFAULT_SETTINGS.defaultStakes, ...v.defaultStakes } }
}

export async function getSettings(): Promise<Settings> {
  const row = await db.meta.get(SETTINGS_KEY)
  return normalizeSettings(row?.value)
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.meta, async () => {
    const next = { ...(await getSettings()), ...patch }
    await db.meta.put({ key: SETTINGS_KEY, value: next })
    return next
  })
}

// ── sessions ─────────────────────────────────────────────

export async function getActiveSession(): Promise<Session | null> {
  const { activeSessionId } = await getSettings()
  if (!activeSessionId) return null
  const s = await db.sessions.get(activeSessionId)
  return s && s.endedAt === null ? s : null
}

/** Start a session, make it active, and remember its values as the next form's defaults. */
export async function startSession(input: SessionDefaults, now = Date.now()): Promise<Session> {
  const session = createSession(input, newId(), now)
  await db.transaction('rw', db.sessions, db.meta, async () => {
    await db.sessions.add(session)
    await updateSettings({ activeSessionId: session.id, lastSessionInput: sessionDefaultsFrom(session) })
  })
  return session
}

export async function updateSession(id: string, patch: Partial<Omit<Session, 'id'>>): Promise<void> {
  await db.sessions.update(id, { ...patch, updatedAt: Date.now() })
}

async function mutateSession(id: string, fn: (s: Session) => void): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id)
    if (!s) throw new Error(`Session ${id} not found`)
    fn(s)
    s.updatedAt = Date.now()
    await db.sessions.put(s)
  })
}

export async function addRebuy(id: string, amount: number, at = Date.now()): Promise<void> {
  await mutateSession(id, (s) => {
    s.rebuys = [...s.rebuys, { at, amount }]
  })
}

export async function removeRebuy(id: string, index: number): Promise<void> {
  await mutateSession(id, (s) => {
    s.rebuys = s.rebuys.filter((_, i) => i !== index)
  })
}

/** Update a tournament's current blind level; new hands snapshot it. */
export async function setBlindLevel(id: string, level: BlindLevel): Promise<void> {
  await db.transaction('rw', db.sessions, db.meta, async () => {
    await mutateSession(id, (s) => {
      if (!s.tournament) throw new Error('Not a tournament session')
      s.tournament = { ...s.tournament, level: { ...level } }
    })
    const s = await db.sessions.get(id)
    if (s) await updateSettings({ lastSessionInput: sessionDefaultsFrom(s) })
  })
}

export async function endSession(id: string, cashOut: number, endedAt = Date.now()): Promise<void> {
  await db.transaction('rw', db.sessions, db.meta, async () => {
    await mutateSession(id, (s) => {
      s.cashOut = cashOut
      s.endedAt = endedAt
    })
    const settings = await getSettings()
    if (settings.activeSessionId === id) await updateSettings({ activeSessionId: null })
  })
}

/** Re-open a session that was ended by mistake. */
export async function resumeSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.meta, async () => {
    const active = await getActiveSession()
    if (active && active.id !== id) throw new Error('Another session is active. End it first.')
    await mutateSession(id, (s) => {
      s.endedAt = null
      s.cashOut = null
    })
    await updateSettings({ activeSessionId: id })
  })
}

/** Delete a session. Its hands are either deleted too or kept as session-less hands. */
export async function deleteSession(id: string, opts: { deleteHands: boolean }): Promise<void> {
  await db.transaction('rw', db.sessions, db.hands, db.meta, async () => {
    const hands = db.hands.where('sessionId').equals(id)
    if (opts.deleteHands) await hands.delete()
    else await hands.modify({ sessionId: null })
    await db.sessions.delete(id)
    const settings = await getSettings()
    if (settings.activeSessionId === id) await updateSettings({ activeSessionId: null })
  })
}

// ── hands ────────────────────────────────────────────────

/** Game context for a new hand: the active session's, else default stakes. */
export async function newHandContext(): Promise<HandContext> {
  const active = await getActiveSession()
  return active ? handContextFromSession(active) : handContextFromSettings(await getSettings())
}

/** A new, unsaved hand for the current context. Nothing is written until `saveHand`. */
export async function draftHand(now = Date.now()): Promise<Hand> {
  return createHand(await newHandContext(), newId(), now)
}

export async function saveHand(hand: Hand): Promise<Hand> {
  const saved = { ...hand, updatedAt: Date.now() }
  await db.hands.put(saved)
  return saved
}

export async function updateHand(id: string, patch: Partial<Omit<Hand, 'id'>>): Promise<void> {
  await db.hands.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteHand(id: string): Promise<void> {
  await db.hands.delete(id)
}

// ── tags ─────────────────────────────────────────────────

export async function addTag(name: string): Promise<Tag> {
  return db.transaction('rw', db.tags, async () => {
    const last = await db.tags.orderBy('order').last()
    const tag: Tag = { id: newId(), name: name.trim(), order: (last?.order ?? -1) + 1 }
    await db.tags.add(tag)
    return tag
  })
}

export async function renameTag(id: string, name: string): Promise<void> {
  await db.tags.update(id, { name: name.trim() })
}

/** Remove a tag and strip it from every hand that had it. */
export async function deleteTag(id: string): Promise<number> {
  return db.transaction('rw', db.tags, db.hands, async () => {
    const affected = await db.hands
      .where('tagIds')
      .equals(id)
      .modify((h) => {
        h.tagIds = h.tagIds.filter((t) => t !== id)
      })
    await db.tags.delete(id)
    return affected
  })
}

/** Move a tag one slot up (-1) or down (+1) in the list. */
export async function moveTag(id: string, dir: -1 | 1): Promise<void> {
  await db.transaction('rw', db.tags, async () => {
    const tags = await db.tags.orderBy('order').toArray()
    const i = tags.findIndex((t) => t.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= tags.length) return
    ;[tags[i], tags[j]] = [tags[j], tags[i]]
    await db.tags.bulkPut(tags.map((t, order) => ({ ...t, order })))
  })
}

// ── sample data ──────────────────────────────────────────

/** Remove any existing sample data, then add a fresh set (creating tags it uses if missing). */
export async function loadSampleData(now = Date.now()): Promise<{ sessions: number; hands: number }> {
  return db.transaction('rw', db.sessions, db.hands, db.tags, async () => {
    await removeSampleData()
    const tags = await db.tags.orderBy('order').toArray()
    const byName = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]))
    let order = (tags.at(-1)?.order ?? -1) + 1
    const created: Tag[] = []
    const tagId = (name: string) => {
      const existing = byName.get(name.toLowerCase())
      if (existing) return existing
      const tag: Tag = { id: newId(), name, order: order++ }
      byName.set(name.toLowerCase(), tag.id)
      created.push(tag)
      return tag.id
    }
    const data = buildSampleData(now, newId, tagId)
    await db.tags.bulkAdd(created)
    await db.sessions.bulkAdd(data.sessions)
    await db.hands.bulkAdd(data.hands)
    return { sessions: data.sessions.length, hands: data.hands.length }
  })
}

export async function removeSampleData(): Promise<void> {
  await db.transaction('rw', db.sessions, db.hands, async () => {
    await db.hands.filter((h) => !!h.sample).delete()
    await db.sessions.filter((s) => !!s.sample).delete()
  })
}

export async function hasSampleData(): Promise<boolean> {
  return (await db.hands.filter((h) => !!h.sample).count()) > 0
}

// ── everything ───────────────────────────────────────────

/** Wipe all data and restore default tags and settings. */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.sessions, db.hands, db.tags, db.meta, async () => {
    await Promise.all([db.sessions.clear(), db.hands.clear(), db.tags.clear(), db.meta.clear()])
    await db.tags.bulkAdd(defaultTags())
    await db.meta.put({ key: SETTINGS_KEY, value: { ...DEFAULT_SETTINGS } })
  })
}
