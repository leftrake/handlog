import Dexie, { type EntityTable, type Transaction } from 'dexie'
import { DEFAULT_SETTINGS, DEFAULT_TAG_NAMES, type Hand, type Session, type Tag } from '../domain/types'
import { newId } from '../lib/id'

/** Key/value rows. Currently holds the single `settings` record. */
export interface MetaRow {
  key: string
  value: unknown
}

export const SETTINGS_KEY = 'settings'

export function defaultTags(): Tag[] {
  return DEFAULT_TAG_NAMES.map((name, order) => ({ id: newId(), name, order }))
}

export class HandLogDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>
  hands!: EntityTable<Hand, 'id'>
  tags!: EntityTable<Tag, 'id'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor(name = 'handlog') {
    super(name)
    // Booleans and nulls can't be IndexedDB keys, so flags and "active" are filtered in memory.
    this.version(1).stores({
      sessions: 'id, startedAt',
      hands: 'id, sessionId, createdAt, heroPosition, reviewStatus, *tagIds',
      tags: 'id, order',
      meta: 'key',
    })
    this.on('populate', (tx: Transaction) => seed(tx))
  }
}

async function seed(tx: Transaction): Promise<void> {
  await tx.table('tags').bulkAdd(defaultTags())
  await tx.table('meta').put({ key: SETTINGS_KEY, value: { ...DEFAULT_SETTINGS } })
}

export const db = new HandLogDB()
