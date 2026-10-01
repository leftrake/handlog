import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteHand, saveHand } from '../../db/repo'
import { isBlankCapture } from '../../domain/hand'
import type { Hand } from '../../domain/types'

const DEBOUNCE_MS = 300

/**
 * Saves the hand shortly after every change, and immediately when the page is hidden
 * (phone locked, app switched) or the screen unmounts. A hand isn't written until something
 * has been entered, so opening and closing Quick Capture leaves nothing behind.
 */
export function useAutosave(hand: Hand | null) {
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const persisted = useRef(false)
  const baseline = useRef<Hand | null>(null)
  const pending = useRef<Hand | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const flush = useCallback(async () => {
    clearTimer()
    const h = pending.current
    if (!h) return
    pending.current = null
    await saveHand(h)
    persisted.current = true
    setSavedAt(Date.now())
  }, [])

  /** Start tracking a hand: `isStored` is true when it already exists in the database. */
  const track = useCallback((h: Hand, isStored: boolean) => {
    clearTimer()
    pending.current = null
    baseline.current = h
    persisted.current = isStored
    setSavedAt(isStored ? h.updatedAt : null)
  }, [])

  /** Drop pending changes and delete the hand if it was ever written. */
  const discard = useCallback(async (id: string) => {
    clearTimer()
    pending.current = null
    if (persisted.current) await deleteHand(id)
    persisted.current = false
  }, [])

  useEffect(() => {
    if (!hand || hand === baseline.current) return
    if (!persisted.current && isBlankCapture(hand)) return
    pending.current = hand
    clearTimer()
    timer.current = setTimeout(() => void flush(), DEBOUNCE_MS)
  }, [hand, flush])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    const onPageHide = () => void flush()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
      void flush()
    }
  }, [flush])

  return { savedAt, flush, track, discard, isPersisted: () => persisted.current }
}
