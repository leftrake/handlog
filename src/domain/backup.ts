// JSON backup format and the merge rules for importing one. Pure: storage code applies the plan.
import type { Hand, Session, Settings, Tag } from './types'

export const BACKUP_APP = 'handlog'
export const BACKUP_VERSION = 1

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exportedAt: number
  sessions: Session[]
  hands: Hand[]
  tags: Tag[]
  settings: Settings
}

export function buildBackup(data: Omit<Backup, 'app' | 'version' | 'exportedAt'>, now: number): Backup {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now, ...data }
}

export function backupFileName(now: number, ext = 'json'): string {
  const d = new Date(now)
  const p = (n: number) => String(n).padStart(2, '0')
  return `handlog-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.${ext}`
}

const DAY = 86_400_000

/** Human label for how long ago the last backup was, and whether it's time for another (7+ days). */
export function backupAge(lastBackupAt: number | null, now: number): { label: string; stale: boolean; days: number | null } {
  if (!lastBackupAt) return { label: 'Never backed up', stale: true, days: null }
  const days = Math.max(0, Math.floor((now - lastBackupAt) / DAY))
  const label = days === 0 ? 'Backed up today' : days === 1 ? 'Backed up yesterday' : `Last backup ${days} days ago`
  return { label, stale: days >= 7, days }
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string }

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const hasId = (x: unknown): boolean => isObj(x) && typeof x.id === 'string' && x.id.length > 0

/** Parse and sanity-check a backup file's text. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: "That file isn't valid JSON." }
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) return { ok: false, error: "That doesn't look like a HandLog backup." }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return { ok: false, error: 'This backup is from a newer version of HandLog. Update the app first.' }
  }
  for (const key of ['sessions', 'hands', 'tags'] as const) {
    const list = raw[key]
    if (!Array.isArray(list) || !list.every(hasId)) return { ok: false, error: `The backup's ${key} are missing or damaged.` }
  }
  const hands = raw.hands as Hand[]
  if (!hands.every((h) => typeof h.createdAt === 'number' && Array.isArray(h.actions) && Array.isArray(h.tagIds))) {
    return { ok: false, error: "The backup's hands are missing required fields." }
  }
  return {
    ok: true,
    backup: {
      app: BACKUP_APP,
      version: raw.version,
      exportedAt: typeof raw.exportedAt === 'number' ? raw.exportedAt : 0,
      sessions: raw.sessions as Session[],
      hands,
      tags: raw.tags as Tag[],
      settings: (isObj(raw.settings) ? raw.settings : {}) as unknown as Settings,
    },
  }
}

export interface MergeCounts {
  added: number
  updated: number
  unchanged: number
}

export interface MergePlan {
  sessions: Session[]
  hands: Hand[]
  tags: Tag[]
  counts: { sessions: MergeCounts; hands: MergeCounts; tags: MergeCounts }
}

interface Local {
  sessions: readonly Session[]
  hands: readonly Hand[]
  tags: readonly Tag[]
}

/**
 * Decide what to write when importing a backup into existing data.
 * - Records match by id, so importing the same backup twice never duplicates anything.
 * - When both sides have a record, the newer `updatedAt` wins.
 * - Tags also match by name, so a backup's "Bluff" maps onto the local "Bluff" tag.
 * Returns only the records that need writing.
 */
export function planMerge(local: Local, incoming: Backup): MergePlan {
  // Tags: by id, else by case-insensitive name; remember how incoming ids map to local ones.
  const tagIdMap = new Map<string, string>()
  const localTagsById = new Map(local.tags.map((t) => [t.id, t]))
  const localTagsByName = new Map(local.tags.map((t) => [t.name.trim().toLowerCase(), t]))
  let nextOrder = Math.max(-1, ...local.tags.map((t) => t.order)) + 1
  const tags: Tag[] = []
  const tagCounts: MergeCounts = { added: 0, updated: 0, unchanged: 0 }
  for (const t of incoming.tags) {
    const match = localTagsById.get(t.id) ?? localTagsByName.get(t.name.trim().toLowerCase())
    if (match) {
      tagIdMap.set(t.id, match.id)
      tagCounts.unchanged++
    } else {
      tagIdMap.set(t.id, t.id)
      const added = { ...t, order: nextOrder++ }
      tags.push(added)
      localTagsByName.set(t.name.trim().toLowerCase(), added)
      tagCounts.added++
    }
  }

  const sessions = mergeById(local.sessions, incoming.sessions)
  const handsPlan = mergeById(
    local.hands,
    incoming.hands.map((h) => ({ ...h, tagIds: [...new Set(h.tagIds.map((id) => tagIdMap.get(id) ?? id))] })),
  )

  return {
    sessions: sessions.write,
    hands: handsPlan.write,
    tags,
    counts: { sessions: sessions.counts, hands: handsPlan.counts, tags: tagCounts },
  }
}

function mergeById<T extends { id: string; updatedAt: number }>(local: readonly T[], incoming: readonly T[]) {
  const existing = new Map(local.map((x) => [x.id, x]))
  const write: T[] = []
  const counts: MergeCounts = { added: 0, updated: 0, unchanged: 0 }
  const seen = new Set<string>()
  for (const item of incoming) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    const mine = existing.get(item.id)
    if (!mine) {
      write.push(item)
      counts.added++
    } else if ((item.updatedAt ?? 0) > (mine.updatedAt ?? 0)) {
      write.push(item)
      counts.updated++
    } else {
      counts.unchanged++
    }
  }
  return { write, counts }
}
