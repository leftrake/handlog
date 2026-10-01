import { useCallback, useEffect, useState } from 'react'
import { db } from '../../db/db'
import type { Hand } from '../../domain/types'
import { useAutosave } from '../capture/useAutosave'

/** Loads a hand once into local state and autosaves every edit. */
export function useHandDraft(id: string | undefined) {
  const [hand, setHand] = useState<Hand | null>(null)
  const [missing, setMissing] = useState(false)
  const autosave = useAutosave(hand)
  const { track } = autosave

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const h = id ? await db.hands.get(id) : undefined
      if (cancelled) return
      if (!h) setMissing(true)
      else {
        track(h, true)
        setHand(h)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, track])

  const update = useCallback((patch: Partial<Hand> | ((h: Hand) => Partial<Hand>)) => {
    setHand((h) => (h ? { ...h, ...(typeof patch === 'function' ? patch(h) : patch) } : h))
  }, [])

  return { hand, missing, update, savedAt: autosave.savedAt, flush: autosave.flush, discard: autosave.discard }
}
