import { Button, Chip, Field, Segmented, Sheet, Switch, TextInput } from '../../components/ui'
import { formatDate, toDateInput } from '../../domain/format'
import type { HandFilter, Outcome } from '../../domain/filters'
import { positionLabel, positionsFor } from '../../domain/positions'
import { stakesLabel } from '../../domain/session'
import { REVIEW_STATUSES, WENT_TO, type Position, type Session, type Tag, type WentTo } from '../../domain/types'
import { REVIEW_LABEL } from '../review/labels'

const WENT_LABEL: Record<WentTo, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
}

function toggle<T>(list: readonly T[] | undefined, v: T): T[] {
  const cur = list ?? []
  return cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
}

function parseDateInput(v: string, endOfDay: boolean): number | undefined {
  if (!v) return undefined
  const [y, m, d] = v.split('-').map(Number)
  const date = endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d)
  return date.getTime()
}

export function FilterSheet({
  open,
  onClose,
  filter,
  onChange,
  tags,
  sessions,
}: {
  open: boolean
  onClose: () => void
  filter: HandFilter
  onChange: (f: HandFilter) => void
  tags: readonly Tag[]
  sessions: readonly Session[]
}) {
  const set = (patch: Partial<HandFilter>) => onChange({ ...filter, ...patch })
  return (
    <Sheet open={open} onClose={onClose} title="Filter hands">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Field label="From">
            <TextInput
              type="date"
              value={filter.from ? toDateInput(filter.from) : ''}
              onChange={(e) => set({ from: parseDateInput(e.target.value, false) })}
            />
          </Field>
          <Field label="To">
            <TextInput
              type="date"
              value={filter.to ? toDateInput(filter.to) : ''}
              onChange={(e) => set({ to: parseDateInput(e.target.value, true) })}
            />
          </Field>
        </div>

        <Field label="Session">
          <select
            className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-[16px]"
            value={filter.sessionId ?? ''}
            onChange={(e) => set({ sessionId: e.target.value || undefined })}
          >
            <option value="">All sessions</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {formatDate(s.startedAt)} · {s.gameType === 'tournament' ? s.tournament?.name || 'Tournament' : stakesLabel(s)}
                {s.location ? ` · ${s.location}` : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Starting hand" hint='e.g. "AK", "AKs", "QQ", "pairs", "suited", "A"'>
          <TextInput
            value={filter.handQuery ?? ''}
            placeholder="Any"
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(e) => set({ handQuery: e.target.value || undefined })}
          />
        </Field>

        <div>
          <div className="mb-1 text-[13px] font-medium text-muted">Position</div>
          <div className="flex flex-wrap gap-1.5">
            {positionsFor(9).map((p: Position) => (
              <Chip key={p} active={filter.positions?.includes(p)} onClick={() => set({ positions: toggle(filter.positions, p) })}>
                {positionLabel(p)}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[13px] font-medium text-muted">Result</div>
          <Segmented<Outcome | 'any'>
            value={filter.outcome ?? 'any'}
            onChange={(v) => set({ outcome: v === 'any' ? undefined : v })}
            options={[
              { value: 'any', label: 'Any' },
              { value: 'won', label: 'Won' },
              { value: 'lost', label: 'Lost' },
              { value: 'even', label: 'Even' },
            ]}
          />
        </div>

        <div>
          <div className="mb-1 text-[13px] font-medium text-muted">How far it went</div>
          <div className="flex flex-wrap gap-1.5">
            {WENT_TO.map((w) => (
              <Chip key={w} active={filter.wentTo?.includes(w)} onClick={() => set({ wentTo: toggle(filter.wentTo, w) })}>
                {WENT_LABEL[w]}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[13px] font-medium text-muted">Tags (all selected)</div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Chip key={t.id} active={filter.tagIds?.includes(t.id)} onClick={() => set({ tagIds: toggle(filter.tagIds, t.id) })}>
                {t.name}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[13px] font-medium text-muted">Review status</div>
          <div className="flex flex-wrap gap-1.5">
            {REVIEW_STATUSES.map((r) => (
              <Chip
                key={r}
                active={filter.reviewStatuses?.includes(r)}
                onClick={() => set({ reviewStatuses: toggle(filter.reviewStatuses, r) })}
              >
                {REVIEW_LABEL[r]}
              </Chip>
            ))}
          </div>
        </div>

        <Switch checked={!!filter.flaggedOnly} onChange={(v) => set({ flaggedOnly: v || undefined })} label="Flagged for review only" />

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button onClick={() => onChange({ text: filter.text })}>Clear filters</Button>
          <Button variant="primary" onClick={onClose}>
            Show hands
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
