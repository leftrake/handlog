import { beforeEach, describe, expect, it } from 'vitest'
import type { SessionDefaults } from '../domain/types'
import { db } from './db'
import {
  addRebuy,
  addTag,
  clearAllData,
  deleteSession,
  deleteTag,
  draftHand,
  endSession,
  getActiveSession,
  getSettings,
  moveTag,
  saveHand,
  setBlindLevel,
  startSession,
} from './repo'

const cash: SessionDefaults = { gameType: 'cash', tableSize: 6, location: 'Aria', stakes: { sb: 2, bb: 5 }, buyIn: 500 }

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
})

describe('first run', () => {
  it('seeds default tags and settings', async () => {
    const tags = await db.tags.orderBy('order').toArray()
    expect(tags.map((t) => t.name)).toContain('Hero call')
    expect(tags).toHaveLength(9)
    const settings = await getSettings()
    expect(settings.theme).toBe('dark')
    expect(settings.activeSessionId).toBeNull()
  })
})

describe('sessions', () => {
  it('starts, tracks and ends a session', async () => {
    const s = await startSession(cash, 1000)
    expect((await getActiveSession())?.id).toBe(s.id)
    expect((await getSettings()).lastSessionInput?.location).toBe('Aria')

    await addRebuy(s.id, 300, 2000)
    await endSession(s.id, 1100, 9000)
    const ended = await db.sessions.get(s.id)
    expect(ended?.rebuys).toEqual([{ at: 2000, amount: 300 }])
    expect(ended?.cashOut).toBe(1100)
    expect(await getActiveSession()).toBeNull()
  })

  it('attaches new hands to the active session', async () => {
    const s = await startSession(cash)
    const h = await draftHand()
    expect(h.sessionId).toBe(s.id)
    expect(h.bb).toBe(5)
    expect(h.tableSize).toBe(6)
  })

  it('snapshots the current tournament level onto hands', async () => {
    const s = await startSession({
      ...cash,
      gameType: 'tournament',
      tournament: { level: { level: 1, sb: 100, bb: 200 } },
    })
    await setBlindLevel(s.id, { level: 2, sb: 200, bb: 400, ante: 400 })
    const h = await draftHand()
    expect(h.unit).toBe('bb')
    expect(h.blindLevel?.level).toBe(2)
    expect(h.ante).toBe(1)
    expect((await getSettings()).lastSessionInput?.tournament?.level.level).toBe(2)
  })

  it('uses default stakes when no session is active', async () => {
    const h = await draftHand()
    expect(h.sessionId).toBeNull()
    expect(h.bb).toBe(2)
  })

  it('keeps or deletes hands when deleting a session', async () => {
    const s = await startSession(cash)
    const a = await saveHand(await draftHand())
    await deleteSession(s.id, { deleteHands: false })
    expect((await db.hands.get(a.id))?.sessionId).toBeNull()

    const s2 = await startSession(cash)
    const b = await saveHand(await draftHand())
    await deleteSession(s2.id, { deleteHands: true })
    expect(await db.hands.get(b.id)).toBeUndefined()
  })
})

describe('tags', () => {
  it('adds at the end and reorders', async () => {
    const t = await addTag('  Straddled pot ')
    expect(t.name).toBe('Straddled pot')
    expect(t.order).toBe(9)
    await moveTag(t.id, -1)
    const tags = await db.tags.orderBy('order').toArray()
    expect(tags[8].id).toBe(t.id)
  })

  it('removes a deleted tag from every hand', async () => {
    const tag = await addTag('Temp')
    const keep = (await db.tags.toArray())[0]
    const h = await draftHand()
    h.tagIds = [tag.id, keep.id]
    await saveHand(h)
    expect(await deleteTag(tag.id)).toBe(1)
    expect((await db.hands.get(h.id))?.tagIds).toEqual([keep.id])
    expect(await db.tags.get(tag.id)).toBeUndefined()
  })
})

describe('clearAllData', () => {
  it('wipes everything and restores defaults', async () => {
    await startSession(cash)
    await saveHand(await draftHand())
    await addTag('Extra')
    await clearAllData()
    expect(await db.sessions.count()).toBe(0)
    expect(await db.hands.count()).toBe(0)
    expect(await db.tags.count()).toBe(9)
    expect((await getSettings()).activeSessionId).toBeNull()
  })
})
