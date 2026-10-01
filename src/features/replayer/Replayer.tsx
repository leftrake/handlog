import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Icon } from '../../components/icons'
import { EmptyState, IconButton, Page, PageHeader, Panel } from '../../components/ui'
import { useHand, useSettings } from '../../db/hooks'
import { formatHole } from '../../domain/cards'
import { replayHand, setupFromHand } from '../../domain/engine'
import { formatPercent } from '../../domain/format'
import { buildFrames } from '../../domain/frames'
import { positionLabel } from '../../domain/positions'
import { STREETS, type Street } from '../../domain/types'
import { cx } from '../../lib/cx'
import { amountUnit } from '../review/amountUnit'
import { IssueLine } from '../review/IssueList'
import { STREET_LABEL } from '../review/labels'
import { TableGraphic } from './TableGraphic'

export function Replayer() {
  const { id } = useParams()
  const hand = useHand(id)
  const settings = useSettings()
  const [index, setIndex] = useState(0)

  const unit = hand && settings ? amountUnit(hand, settings.displayUnit, settings.currencySymbol) : null
  const frames = useMemo(() => {
    if (!hand || !settings) return []
    const u = amountUnit(hand, settings.displayUnit, settings.currencySymbol)
    return buildFrames(hand, replayHand(setupFromHand(hand)), (n) => u.format(n))
  }, [hand, settings])

  const last = Math.max(0, frames.length - 1)
  const i = Math.min(index, last)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight' || e.key === ' ') setIndex((x) => Math.min(x + 1, last))
      else if (e.key === 'ArrowLeft') setIndex((x) => Math.max(x - 1, 0))
      else if (e.key === 'Home') setIndex(0)
      else if (e.key === 'End') setIndex(last)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last])

  if (hand === null) {
    return (
      <>
        <PageHeader title="Replay" back="/hands" />
        <EmptyState title="Hand not found" />
      </>
    )
  }
  if (!hand || !settings || !unit || frames.length === 0) return <PageHeader title="Replay" back />

  const frame = frames[i]
  const streetStart = (s: Street) => frames.findIndex((f) => f.street === s)
  const decision = frame.decision

  return (
    <div className="flex min-h-[calc(100dvh-76px)] flex-col md:min-h-dvh">
      <PageHeader
        title="Replay"
        subtitle={[hand.heroPosition ? positionLabel(hand.heroPosition) : null, formatHole(hand.hole)].filter(Boolean).join(' · ')}
        back
      />
      <Page className="flex-1 space-y-3 pt-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {STREETS.map((s) => {
            const at = streetStart(s)
            return (
              <button
                key={s}
                type="button"
                disabled={at < 0}
                onClick={() => setIndex(at)}
                className={cx(
                  'h-8 rounded-full px-3 text-xs font-semibold disabled:opacity-30',
                  frame.street === s ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted',
                )}
              >
                {STREET_LABEL[s]}
              </button>
            )
          })}
        </div>

        <TableGraphic hand={hand} frame={frame} unit={unit} />

        <Panel className="space-y-1 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{frame.caption}</p>
            <span className="num shrink-0 text-xs text-muted">
              {i + 1} / {frames.length}
            </span>
          </div>
          {frame.issues.map((iss, n) => (
            <IssueLine key={n} issue={iss} />
          ))}
        </Panel>

        {decision && (
          <Panel className="border-accent/50 py-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-accent">
              <Icon name="calculator" size={16} /> Your decision
            </div>
            {decision.odds ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-surface-2 py-2">
                    <div className="text-[11px] text-muted">To call</div>
                    <div className="num font-bold">{unit.format(decision.odds.toCall)}</div>
                  </div>
                  <div className="rounded-xl bg-surface-2 py-2">
                    <div className="text-[11px] text-muted">Pot after call</div>
                    <div className="num font-bold">{unit.format(decision.odds.potAfterCall)}</div>
                  </div>
                  <div className="rounded-xl bg-accent-soft py-2">
                    <div className="text-[11px] text-muted">Equity needed</div>
                    <div className="num font-bold">{formatPercent(decision.odds.requiredEquity)}</div>
                  </div>
                </div>
                <p className="num mt-2 text-xs text-muted">
                  {unit.format(decision.odds.toCall)} ÷ {unit.format(decision.odds.potAfterCall)} ={' '}
                  {formatPercent(decision.odds.requiredEquity)} · pot odds {decision.odds.ratio.toFixed(1)} : 1
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">Nothing to call: you can check or bet.</p>
            )}
          </Panel>
        )}

        {hand.actions.length === 0 && (
          <p className="text-center text-sm text-muted">
            No action entered yet.{' '}
            <Link to={`/hands/${hand.id}`} className="font-medium text-accent">
              Add it in the review editor
            </Link>
          </p>
        )}
      </Page>

      <div className="pb-safe sticky bottom-[calc(76px+env(safe-area-inset-bottom))] border-t border-line bg-surface md:bottom-0">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <IconButton icon="skipBack" label="First" disabled={i === 0} onClick={() => setIndex(0)} />
          <button
            type="button"
            disabled={i === 0}
            onClick={() => setIndex(i - 1)}
            className="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl bg-surface-2 font-semibold disabled:opacity-40"
          >
            <Icon name="stepBack" /> Back
          </button>
          <button
            type="button"
            disabled={i === last}
            onClick={() => setIndex(i + 1)}
            className="flex h-12 flex-[1.4] items-center justify-center gap-1 rounded-xl bg-accent font-semibold text-accent-fg disabled:opacity-40"
          >
            Next <Icon name="stepForward" />
          </button>
          <IconButton icon="skipForward" label="Last" disabled={i === last} onClick={() => setIndex(last)} />
        </div>
      </div>
    </div>
  )
}
