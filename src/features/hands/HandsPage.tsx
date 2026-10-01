import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Icon } from '../../components/icons'
import { EmptyState, Page, PageHeader, Segmented } from '../../components/ui'
import { useHands, useSessions, useSettings, useTags } from '../../db/hooks'
import { formatBB, formatDate, formatMoney } from '../../domain/format'
import { sum } from '../../domain/money'
import { activeFilterCount, filterHands, reviewQueue, type HandFilter } from '../../domain/filters'
import type { Hand } from '../../domain/types'
import { useLocalPref } from '../../lib/hooks'
import { cx } from '../../lib/cx'
import { FilterSheet } from './FilterSheet'
import { HandRow } from './HandRow'

type View = 'all' | 'queue'

function groupByDay(hands: readonly Hand[]): { day: string; hands: Hand[] }[] {
  const groups: { day: string; hands: Hand[] }[] = []
  for (const h of hands) {
    const day = formatDate(h.createdAt)
    const last = groups.at(-1)
    if (last?.day === day) last.hands.push(h)
    else groups.push({ day, hands: [h] })
  }
  return groups
}

export function HandsPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'queue' ? 'queue' : 'all'
  const hands = useHands()
  const tags = useTags()
  const sessions = useSessions()
  const settings = useSettings()
  const [savedFilter, setSavedFilter] = useLocalPref<HandFilter>('handlog.handFilter', {})
  // A deep link like /hands?hand=AKs (from the stats grid) shows just that starting hand.
  const handParam = params.get('hand')
  const filter = useMemo<HandFilter>(() => (handParam ? { handQuery: handParam } : savedFilter), [handParam, savedFilter])
  const setFilter = (f: HandFilter) => {
    setSavedFilter(f)
    if (handParam) setParams({}, { replace: true })
  }
  const [sheet, setSheet] = useState(false)

  const tagMap = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags])
  const queue = useMemo(() => reviewQueue(hands ?? []), [hands])
  const filtered = useMemo(() => filterHands(hands ?? [], filter, tagMap), [hands, filter, tagMap])
  const shown = view === 'queue' ? queue : filtered
  const nFilters = activeFilterCount(filter)

  // Dollars when every hand is a cash hand (and you display dollars); otherwise big blinds,
  // the one unit cash and tournament hands share.
  const net = useMemo(() => {
    if (shown.length === 0 || !settings) return null
    if (shown.every((h) => h.unit === 'money') && settings.displayUnit === 'money') {
      return formatMoney(sum(shown.map((h) => h.result ?? 0)), settings.currencySymbol, { signed: true })
    }
    return formatBB(sum(shown.map((h) => (h.result ?? 0) / h.bb)), { signed: true })
  }, [shown, settings])

  if (!hands || !settings || !tags || !sessions) return <PageHeader title="Hands" />

  return (
    <>
      <PageHeader title="Hands" />
      <Page className="pt-3">
        <Segmented<View>
          className="mb-3"
          value={view}
          onChange={(v) => setParams(v === 'queue' ? { view: 'queue' } : {}, { replace: true })}
          options={[
            { value: 'all', label: `All hands (${hands.length})` },
            { value: 'queue', label: `Review queue (${queue.length})` },
          ]}
        />

        {view === 'all' && (
          <div className="mb-3 flex gap-2">
            <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 focus-within:border-accent">
              <Icon name="search" size={18} className="text-muted" />
              <input
                className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
                placeholder="Search notes, tags, reads…"
                value={filter.text ?? ''}
                onChange={(e) => setFilter({ ...filter, text: e.target.value || undefined })}
              />
              {filter.text && (
                <button type="button" aria-label="Clear search" onClick={() => setFilter({ ...filter, text: undefined })}>
                  <Icon name="x" size={16} className="text-muted" />
                </button>
              )}
            </label>
            <button
              type="button"
              onClick={() => setSheet(true)}
              className={cx(
                'relative flex h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold',
                nFilters ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2',
              )}
            >
              <Icon name="filter" size={18} /> Filter
              {nFilters > 0 && (
                <span className="num rounded-full bg-accent px-1.5 text-xs leading-5 text-accent-fg">{nFilters}</span>
              )}
            </button>
          </div>
        )}

        {view === 'queue' && (
          <p className="mb-3 px-1 text-sm text-muted">
            Hands you flagged "Review this" that are still unreviewed, oldest first. Mark a hand reviewed to clear it.
          </p>
        )}

        {shown.length > 0 && (
          <div className="mb-1 flex justify-between px-1 text-xs text-muted">
            <span>
              {shown.length} hand{shown.length === 1 ? '' : 's'}
              {view === 'all' && (nFilters > 0 || filter.text) ? ' match' : ''}
            </span>
            {net && <span className="num">Net {net}</span>}
          </div>
        )}

        {shown.length === 0 ? (
          view === 'queue' ? (
            <EmptyState icon="check" title="Review queue is empty">
              Hands flagged "Review this" show up here until you mark them reviewed.
            </EmptyState>
          ) : hands.length === 0 ? (
            <EmptyState icon="list" title="No hands yet">
              Tap + to log your first hand. Sample data is available under Settings → Developer.
            </EmptyState>
          ) : (
            <EmptyState icon="filter" title="No hands match">
              Try clearing a filter.
            </EmptyState>
          )
        ) : view === 'queue' ? (
          <div className="-mx-2">
            {shown.map((h) => (
              <HandRow key={h.id} hand={h} prefs={settings} tags={tagMap} to={`/hands/${h.id}`} showDate />
            ))}
          </div>
        ) : (
          groupByDay(shown).map((g) => (
            <section key={g.day} className="mb-3">
              <h2 className="sticky top-14 z-10 -mx-4 bg-bg/95 px-5 py-1 text-xs font-semibold uppercase tracking-wide text-muted backdrop-blur">
                {g.day}
              </h2>
              <div className="-mx-2">
                {g.hands.map((h) => (
                  <HandRow key={h.id} hand={h} prefs={settings} tags={tagMap} to={`/hands/${h.id}`} />
                ))}
              </div>
            </section>
          ))
        )}
      </Page>
      <FilterSheet
        open={sheet}
        onClose={() => setSheet(false)}
        filter={filter}
        onChange={setFilter}
        tags={tags}
        sessions={sessions}
      />
    </>
  )
}
