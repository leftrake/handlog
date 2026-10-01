import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CardPad, NumberPad, ShorthandPad } from '../../components/CardPad'
import { Icon } from '../../components/icons'
import { HandClassBadge, PlayingCard } from '../../components/PlayingCard'
import { Button, Chip, ConfirmButton, EmptyState, IconButton, Segmented, Switch, TextArea, TextInput } from '../../components/ui'
import { cx } from '../../lib/cx'
import { db } from '../../db/db'
import { useSession, useSettings, useTags } from '../../db/hooks'
import { addTag, draftHand } from '../../db/repo'
import { handClassOf, unavailableCards } from '../../domain/cards'
import { formatBB, formatHandAmount, formatNumber, formatTime } from '../../domain/format'
import { round2 } from '../../domain/money'
import { isSeated, positionLabel, positionsFor } from '../../domain/positions'
import type { Card, Hand, TableSize, WentTo } from '../../domain/types'
import { useLocalPref } from '../../lib/hooks'
import { applyPadKey } from '../../lib/padInput'
import { useAutosave } from './useAutosave'

type Focus = 'hole' | 'position' | 'wentTo' | 'result' | 'board' | 'extras'
type HoleMode = 'exact' | 'class'

const PANEL_TITLE: Record<Focus, string> = {
  hole: 'Hole cards',
  position: 'Your position',
  wentTo: 'How far did it go?',
  result: 'Result',
  board: 'Board',
  extras: 'Tags & note',
}

const WENT_OPTIONS: { value: WentTo; label: string }[] = [
  { value: 'preflop', label: 'Preflop' },
  { value: 'flop', label: 'Flop' },
  { value: 'turn', label: 'Turn' },
  { value: 'river', label: 'River' },
  { value: 'showdown', label: 'Showdown' },
]

const WENT_LABEL = Object.fromEntries(WENT_OPTIONS.map((o) => [o.value, o.label])) as Record<WentTo, string>

/** The first core field still empty, in capture order. */
function firstMissing(h: Hand): Focus | null {
  if (!h.hole) return 'hole'
  if (!h.heroPosition) return 'position'
  if (!h.wentTo) return 'wentTo'
  if (h.result === null) return 'result'
  return null
}

function goBack(navigate: ReturnType<typeof useNavigate>) {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  if (idx > 0) navigate(-1)
  else navigate('/', { replace: true })
}

export function QuickCapture() {
  const { id } = useParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const tags = useTags()

  const [hand, setHand] = useState<Hand | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [focus, setFocus] = useState<Focus>('hole')
  const [holeCards, setHoleCards] = useState<[Card | null, Card | null]>([null, null])
  const [holeSlot, setHoleSlot] = useState<0 | 1>(0)
  const [boardSlot, setBoardSlot] = useState(0)
  const [holeMode, setHoleMode] = useLocalPref<HoleMode>('handlog.holeMode', 'exact')
  const [sign, setSign] = useState<1 | -1 | null>(null)
  const [amountText, setAmountText] = useState('')
  const [nudge, setNudge] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [newTag, setNewTag] = useState<string | null>(null)
  const session = useSession(hand?.sessionId ?? undefined)
  const autosave = useAutosave(hand)
  const { track } = autosave

  const load = useCallback(
    (h: Hand, stored: boolean) => {
      track(h, stored)
      setHand(h)
      setHoleCards(h.hole?.kind === 'exact' ? [...h.hole.cards] : [null, null])
      if (h.hole?.kind === 'class') setHoleMode('class')
      setHoleSlot(0)
      setBoardSlot(Math.min(h.board.length, 4))
      setSign(h.result === null ? null : h.result < 0 ? -1 : 1)
      setAmountText(h.result === null ? '' : String(Math.abs(h.result)))
      setNudge(false)
      setNewTag(null)
      setFocus(firstMissing(h) ?? 'extras')
    },
    [track, setHoleMode],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const h = id ? await db.hands.get(id) : await draftHand()
      if (cancelled) return
      if (!h) setNotFound(true)
      else load(h, !!id)
    })()
    return () => {
      cancelled = true
    }
  }, [id, load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(t)
  }, [toast])

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col">
        <div className="pt-safe px-2 py-2">
          <IconButton icon="x" label="Close" onClick={() => goBack(navigate)} />
        </div>
        <EmptyState title="Hand not found">It may have been deleted.</EmptyState>
      </div>
    )
  }
  if (!hand || !settings || !tags) return <div className="min-h-dvh bg-bg" />

  const commit = (patch: Partial<Hand>, advance = false) => {
    const next = { ...hand, ...patch }
    setHand(next)
    if (advance) setFocus(firstMissing(next) ?? 'extras')
  }

  // ── hole cards ──
  const pickHole = (card: Card) => {
    const cards: [Card | null, Card | null] = [...holeCards]
    cards[holeSlot] = card
    setHoleCards(cards)
    if (cards[0] && cards[1]) commit({ hole: { kind: 'exact', cards: [cards[0], cards[1]] } }, true)
    else setHoleSlot(cards[0] ? 1 : 0)
  }
  const clearHole = () => {
    const cards: [Card | null, Card | null] = [...holeCards]
    if (cards[holeSlot]) cards[holeSlot] = null
    else if (holeSlot === 1) {
      cards[0] = null
      setHoleSlot(0)
    }
    setHoleCards(cards)
    if (hand.hole) commit({ hole: null })
  }
  const switchHoleMode = (mode: HoleMode) => {
    setHoleMode(mode)
    if (mode === 'class' && hand.hole?.kind === 'exact') {
      commit({ hole: { kind: 'class', handClass: handClassOf(hand.hole.cards[0], hand.hole.cards[1]) } })
      setHoleCards([null, null])
    } else if (mode === 'exact' && hand.hole?.kind === 'class') {
      commit({ hole: null })
      setHoleSlot(0)
    }
  }

  // ── board ──
  const pickBoard = (card: Card) => {
    const board = [...hand.board]
    const slot = Math.min(boardSlot, board.length)
    board[slot] = card
    commit({ board })
    setBoardSlot(Math.min(slot + 1, 4))
  }
  const clearBoard = () => {
    if (hand.board.length === 0) return
    const board = hand.board.slice(0, -1)
    commit({ board })
    setBoardSlot(board.length)
  }

  // ── result ──
  const applyResult = (s: 1 | -1 | null, text: string) => {
    setSign(s)
    setAmountText(text)
    if (s !== null) setNudge(false)
    const n = text === '' ? null : Number(text)
    const result = s === null || n === null || !Number.isFinite(n) ? null : round2(s * n)
    if (result !== hand.result) commit({ result })
  }

  // ── leaving ──
  const readyToLeave = async (): Promise<boolean> => {
    if (amountText !== '' && sign === null) {
      setFocus('result')
      setNudge(true)
      return false
    }
    await autosave.flush()
    return true
  }
  const done = async () => {
    if (await readyToLeave()) goBack(navigate)
  }
  const saveAndNext = async () => {
    if (!(await readyToLeave())) return
    const wasBlank = !autosave.isPersisted()
    if (id) navigate('/capture', { replace: true })
    else load(await draftHand(), false)
    setToast(wasBlank ? 'Nothing to save — ready for the next hand' : 'Saved. Ready for the next hand.')
  }
  const discard = async () => {
    await autosave.discard(hand.id)
    goBack(navigate)
  }

  const editingCard = focus === 'hole' ? holeCards[holeSlot] : focus === 'board' ? (hand.board[boardSlot] ?? null) : null
  const blocked = unavailableCards(
    [...holeCards, ...hand.board, ...hand.players.flatMap((p) => p.shown ?? [])],
    editingCard,
  )
  const unitLabel = hand.unit === 'bb' ? 'BB' : settings.currencySymbol
  const amountNum = amountText === '' ? null : Number(amountText)
  const contextLabel = (() => {
    const stakes =
      hand.unit === 'bb' && hand.blindLevel
        ? `L${hand.blindLevel.level} · ${formatNumber(hand.blindLevel.sb)}/${formatNumber(hand.blindLevel.bb)}`
        : `${formatNumber(hand.sb)}/${formatNumber(hand.bb)}`
    if (!hand.sessionId) return `No active session · ${stakes} default`
    return [stakes, session?.location].filter(Boolean).join(' · ')
  })()
  const tagMap = new Map(tags.map((t) => [t.id, t]))
  const toggleTag = (tagId: string) =>
    commit({ tagIds: hand.tagIds.includes(tagId) ? hand.tagIds.filter((t) => t !== tagId) : [...hand.tagIds, tagId] })

  const next = () => setFocus(firstMissing(hand) ?? 'extras')

  // ── panels ──
  let panel: ReactNode
  switch (focus) {
    case 'hole':
      panel =
        holeMode === 'exact' ? (
          <CardPad key="hole" blocked={blocked} onPick={pickHole} onClear={clearHole} />
        ) : (
          <ShorthandPad
            onPick={(handClass) => {
              setHoleCards([null, null])
              commit({ hole: { kind: 'class', handClass } }, true)
            }}
            onClear={() => commit({ hole: null })}
          />
        )
      break
    case 'board':
      panel = <CardPad key="board" blocked={blocked} onPick={pickBoard} onClear={clearBoard} clearLabel="Remove last board card" />
      break
    case 'position':
      panel = (
        <div className="grid grid-cols-3 gap-1.5">
          {positionsFor(hand.tableSize).map((p) => (
            <BigKey key={p} active={hand.heroPosition === p} onClick={() => commit({ heroPosition: p }, true)}>
              {positionLabel(p)}
            </BigKey>
          ))}
        </div>
      )
      break
    case 'wentTo':
      panel = (
        <div className="grid grid-cols-6 gap-1.5">
          {WENT_OPTIONS.map((o, i) => (
            <BigKey
              key={o.value}
              className={i < 3 ? 'col-span-2' : 'col-span-3'}
              active={hand.wentTo === o.value}
              onClick={() => commit({ wentTo: o.value }, true)}
            >
              {o.label}
            </BigKey>
          ))}
        </div>
      )
      break
    case 'result':
      panel = (
        <div className="space-y-2">
          <div className={cx('grid grid-cols-2 gap-1.5 rounded-2xl', nudge && 'animate-pulse ring-2 ring-warn')}>
            <button
              type="button"
              onClick={() => applyResult(1, amountText)}
              className={cx(
                'h-14 rounded-xl text-lg font-bold transition-colors',
                sign === 1 ? 'bg-win text-accent-fg' : 'bg-surface-2 text-win active:bg-surface-3',
              )}
            >
              Won +
            </button>
            <button
              type="button"
              onClick={() => applyResult(-1, amountText)}
              className={cx(
                'h-14 rounded-xl text-lg font-bold transition-colors',
                sign === -1 ? 'bg-loss text-white' : 'bg-surface-2 text-loss active:bg-surface-3',
              )}
            >
              Lost −
            </button>
          </div>
          {/* Fixed-height readout: helper text lives inside it so the keypad never shifts mid-entry. */}
          <div className="relative flex h-12 items-center justify-center rounded-xl bg-bg px-3">
            {amountText === '' ? (
              <span className={nudge ? 'font-medium text-warn' : 'text-muted'}>{nudge ? 'Won or lost?' : `Amount in ${unitLabel}`}</span>
            ) : (
              <span className={cx('num text-3xl font-bold', sign === 1 ? 'text-win' : sign === -1 ? 'text-loss' : 'text-fg')}>
                {sign === -1 ? '−' : sign === 1 ? '+' : ''}
                {hand.unit === 'bb' ? `${amountText} BB` : `${settings.currencySymbol}${amountText}`}
              </span>
            )}
            <span className="num absolute right-3 text-xs">
              {nudge && amountText !== '' ? (
                <span className="font-medium text-warn">Won or lost?</span>
              ) : (
                hand.unit === 'money' &&
                amountNum !== null &&
                amountNum > 0 && <span className="text-muted">{formatBB(amountNum / hand.bb)}</span>
              )}
            </span>
          </div>
          <NumberPad keyHeight="h-12" onKey={(k) => applyResult(sign, applyPadKey(amountText, k))} />
        </div>
      )
      break
    case 'extras':
      panel = (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Chip key={t.id} active={hand.tagIds.includes(t.id)} onClick={() => toggleTag(t.id)}>
                {t.name}
              </Chip>
            ))}
            {newTag === null ? (
              <Chip onClick={() => setNewTag('')}>+ New tag</Chip>
            ) : (
              <form
                className="flex w-full gap-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!newTag.trim()) return setNewTag(null)
                  const tag = await addTag(newTag)
                  commit({ tagIds: [...hand.tagIds, tag.id] })
                  setNewTag(null)
                }}
              >
                <TextInput autoFocus value={newTag} placeholder="Tag name" onChange={(e) => setNewTag(e.target.value)} />
                <Button type="submit" variant="primary">
                  Add
                </Button>
              </form>
            )}
          </div>
          <TextArea
            rows={2}
            className="min-h-16"
            value={hand.note}
            placeholder="Note — use the keyboard mic to dictate"
            onChange={(e) => commit({ note: e.target.value })}
          />
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Switch checked={hand.flagged} onChange={(flagged) => commit({ flagged })} label="Review this" />
            </div>
            <Button size="sm" icon="plus" onClick={() => {
              setBoardSlot(Math.min(hand.board.length, 4))
              setFocus('board')
            }}>
              Board
            </Button>
          </div>
        </div>
      )
      break
  }

  const missing = firstMissing(hand)

  return (
    <div className="flex h-dvh flex-col bg-bg">
      {/* Header */}
      <header className="pt-safe shrink-0 border-b border-line/60">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-1 px-2">
          <IconButton icon="x" label="Close" onClick={done} />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold leading-tight">{id ? 'Edit hand' : 'Log hand'}</div>
            <div className="truncate text-xs text-muted">{contextLabel}</div>
          </div>
          <div className="flex items-center gap-1 pr-2 text-xs text-muted" aria-live="polite">
            {autosave.savedAt ? (
              <>
                <Icon name="check" size={14} className="text-win" /> Saved {formatTime(autosave.savedAt)}
              </>
            ) : (
              'Not saved yet'
            )}
          </div>
        </div>
      </header>

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-40 flex justify-center px-4">
          <div className="rounded-full bg-surface-3 px-4 py-2 text-sm font-medium shadow-lg">{toast}</div>
        </div>
      )}

      {/* Summary: tap any slot to edit it */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg space-y-3 px-4 py-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Hole cards</div>
              {hand.hole?.kind === 'class' ? (
                <button type="button" onClick={() => setFocus('hole')}>
                  <HandClassBadge handClass={hand.hole.handClass} size="lg" active={focus === 'hole'} />
                </button>
              ) : holeMode === 'class' && !holeCards[0] ? (
                <button type="button" aria-label="Hole cards" onClick={() => setFocus('hole')}>
                  <PlayingCard card={null} size="lg" placeholder="AKs?" active={focus === 'hole'} className="w-[100px] text-base" />
                </button>
              ) : (
                <div className="flex gap-1.5">
                  {([0, 1] as const).map((i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Hole card ${i + 1}`}
                      onClick={() => {
                        setFocus('hole')
                        setHoleSlot(i)
                      }}
                    >
                      <PlayingCard card={holeCards[i]} size="lg" active={focus === 'hole' && holeSlot === i} placeholder="?" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Board · optional</div>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Board card ${i + 1}`}
                    disabled={i > hand.board.length}
                    onClick={() => {
                      setFocus('board')
                      setBoardSlot(Math.min(i, hand.board.length))
                    }}
                    className={cx(i === 3 && 'ml-1', i === 4 && 'ml-1')}
                  >
                    <PlayingCard
                      card={hand.board[i] ?? null}
                      size="sm"
                      active={focus === 'board' && Math.min(boardSlot, hand.board.length) === i}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <SummaryChip label="Position" active={focus === 'position'} onClick={() => setFocus('position')}>
              {hand.heroPosition ? positionLabel(hand.heroPosition) : null}
            </SummaryChip>
            <SummaryChip label="Went to" active={focus === 'wentTo'} onClick={() => setFocus('wentTo')}>
              {hand.wentTo ? WENT_LABEL[hand.wentTo] : null}
            </SummaryChip>
            <SummaryChip
              label="Result"
              active={focus === 'result'}
              onClick={() => setFocus('result')}
              tone={hand.result === null ? undefined : hand.result > 0 ? 'win' : hand.result < 0 ? 'loss' : undefined}
            >
              {hand.result !== null ? formatHandAmount(hand, hand.result, settings, { signed: true }) : nudge ? '?' : null}
            </SummaryChip>
          </div>

          <button
            type="button"
            onClick={() => setFocus('extras')}
            className={cx(
              'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm',
              focus === 'extras' ? 'border-accent bg-accent-soft/40' : 'border-line bg-surface',
            )}
          >
            <Icon name="tag" size={16} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate">
              {hand.tagIds.length > 0 ? (
                hand.tagIds.map((t) => tagMap.get(t)?.name).filter(Boolean).join(', ')
              ) : (
                <span className="text-faint">Tags, note</span>
              )}
              {hand.note && <span className="text-muted"> · {hand.note}</span>}
            </span>
            {hand.flagged && <Icon name="flag" size={16} className="shrink-0 text-warn" />}
          </button>

          {hand.sessionId === null && focus === 'position' && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2 text-sm">
              <span className="text-muted">Table size</span>
              <Segmented<TableSize>
                size="sm"
                className="w-40"
                value={hand.tableSize}
                onChange={(tableSize) =>
                  commit({
                    tableSize,
                    heroPosition: hand.heroPosition && isSeated(hand.heroPosition, tableSize) ? hand.heroPosition : null,
                  })
                }
                options={[
                  { value: 9, label: '9' },
                  { value: 6, label: '6' },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      {/* Input panel: sits in the thumb zone */}
      <div className="shrink-0 rounded-t-3xl border-t border-line bg-surface">
        <div className="mx-auto max-w-lg px-3 pb-2 pt-3">
          <div className="mb-2 flex h-8 items-center justify-between gap-2 px-1">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{PANEL_TITLE[focus]}</h2>
            <div className="flex items-center gap-2">
              {focus === 'hole' && (
                <Segmented<HoleMode>
                  size="sm"
                  className="w-36"
                  value={hand.hole?.kind === 'class' ? 'class' : holeMode}
                  onChange={switchHoleMode}
                  options={[
                    { value: 'exact', label: 'Exact' },
                    { value: 'class', label: 'AKs' },
                  ]}
                />
              )}
              {focus !== 'extras' && (
                <button type="button" onClick={next} className="h-8 rounded-lg px-2 text-sm font-semibold text-accent active:bg-surface-2">
                  {focus === 'board' || missing === focus ? 'Skip' : 'Next'}
                </button>
              )}
            </div>
          </div>
          {panel}
        </div>
      </div>

      {/* Primary actions at the bottom */}
      <div className="pb-safe shrink-0 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-lg gap-2 px-3 py-2">
          <ConfirmButton size="lg" variant="ghost" icon="trash" confirmLabel="Discard?" className="px-3 text-muted" onConfirm={discard}>
            <span className="sr-only">Discard</span>
          </ConfirmButton>
          <Button size="lg" className="flex-1" onClick={saveAndNext}>
            Save & next
          </Button>
          <Button size="lg" variant="primary" className="flex-1" onClick={done}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

function BigKey({ active, onClick, children, className }: { active?: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'h-16 rounded-xl text-lg font-bold transition-colors',
        active ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg active:bg-surface-3',
        className,
      )}
    >
      {children}
    </button>
  )
}

function SummaryChip({
  label,
  active,
  onClick,
  tone,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  tone?: 'win' | 'loss'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex h-16 flex-col items-start justify-center rounded-xl border px-3 text-left',
        active ? 'border-accent bg-accent-soft/40' : 'border-line bg-surface',
      )}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span
        className={cx(
          'num w-full truncate text-lg font-bold',
          children === null ? 'text-faint' : tone === 'win' ? 'text-win' : tone === 'loss' ? 'text-loss' : 'text-fg',
        )}
      >
        {children ?? '—'}
      </span>
    </button>
  )
}

