import { useMemo, useState } from 'react'
import { TableSizePicker } from '../../components/TableSize'
import { Button, Field, NumberInput, Segmented, TextInput } from '../../components/ui'
import { useSessions } from '../../db/hooks'
import { startSession } from '../../db/repo'
import { DEFAULT_BLIND_LEVEL, initialSessionDefaults } from '../../domain/session'
import type { SessionDefaults, Settings } from '../../domain/types'

/** Start-a-session form, pre-filled with the last session's values. */
export function StartSessionForm({ settings }: { settings: Settings }) {
  const [form, setForm] = useState<SessionDefaults>(() => initialSessionDefaults(settings))
  const [showExtras, setShowExtras] = useState(() => !!(form.stakes.straddle || form.stakes.ante))
  const [busy, setBusy] = useState(false)
  const sessions = useSessions()
  const cur = settings.currencySymbol

  const locations = useMemo(() => {
    const seen = new Set<string>()
    for (const s of sessions ?? []) if (s.location) seen.add(s.location)
    return [...seen].slice(0, 12)
  }, [sessions])

  const set = (patch: Partial<SessionDefaults>) => setForm((f) => ({ ...f, ...patch }))
  const isTourney = form.gameType === 'tournament'
  const level = form.tournament?.level ?? DEFAULT_BLIND_LEVEL
  const setLevel = (patch: Partial<typeof level>) =>
    set({ tournament: { ...form.tournament, level: { ...level, ...patch } } })

  const valid = isTourney ? level.bb > 0 && level.sb > 0 : form.stakes.bb > 0 && form.stakes.sb > 0
  const start = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      await startSession({
        ...form,
        tournament: isTourney ? { ...form.tournament, level } : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Segmented
        ariaLabel="Game type"
        size="lg"
        value={form.gameType}
        onChange={(gameType) => set({ gameType })}
        options={[
          { value: 'cash', label: 'Cash game' },
          { value: 'tournament', label: 'Tournament' },
        ]}
      />

      {isTourney ? (
        <>
          <Field label="Tournament name">
            <TextInput
              value={form.tournament?.name ?? ''}
              placeholder="Daily deepstack"
              onChange={(e) => set({ tournament: { ...form.tournament, level, name: e.target.value } })}
            />
          </Field>
          <div className="grid grid-cols-4 gap-2">
            <Field label="Level">
              <NumberInput value={level.level} allowEmpty={false} onChange={(v) => setLevel({ level: v ?? 1 })} />
            </Field>
            <Field label="SB">
              <NumberInput value={level.sb} onChange={(v) => setLevel({ sb: v ?? 0 })} />
            </Field>
            <Field label="BB">
              <NumberInput value={level.bb} onChange={(v) => setLevel({ bb: v ?? 0 })} />
            </Field>
            <Field label="BB ante">
              <NumberInput value={level.ante ?? null} onChange={(v) => setLevel({ ante: v ?? undefined })} />
            </Field>
          </div>
          <Field label="Starting stack (chips)">
            <NumberInput
              value={form.tournament?.startingStack ?? null}
              placeholder="30000"
              onChange={(v) => set({ tournament: { ...form.tournament, level, startingStack: v ?? undefined } })}
            />
          </Field>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label={`Small blind (${cur})`}>
              <NumberInput value={form.stakes.sb} onChange={(v) => set({ stakes: { ...form.stakes, sb: v ?? 0 } })} />
            </Field>
            <Field label={`Big blind (${cur})`}>
              <NumberInput value={form.stakes.bb} onChange={(v) => set({ stakes: { ...form.stakes, bb: v ?? 0 } })} />
            </Field>
          </div>
          {showExtras ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label={`UTG straddle (${cur})`} hint="Leave blank if none">
                <NumberInput
                  value={form.stakes.straddle ?? null}
                  onChange={(v) => set({ stakes: { ...form.stakes, straddle: v || undefined } })}
                />
              </Field>
              <Field label={`BB ante (${cur})`} hint="Leave blank if none">
                <NumberInput
                  value={form.stakes.ante ?? null}
                  onChange={(v) => set({ stakes: { ...form.stakes, ante: v || undefined } })}
                />
              </Field>
            </div>
          ) : (
            <button type="button" className="text-sm font-medium text-accent" onClick={() => setShowExtras(true)}>
              + Straddle or ante
            </button>
          )}
        </>
      )}

      <Field label="Players at the table" hint="You can change this during the session as players come and go.">
        <TableSizePicker value={form.tableSize} onChange={(tableSize) => set({ tableSize })} />
      </Field>

      <Field label="Location">
        <TextInput
          value={form.location}
          placeholder="Card room"
          list="hl-locations"
          autoCapitalize="words"
          onChange={(e) => set({ location: e.target.value })}
        />
        <datalist id="hl-locations">
          {locations.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>

      <Field label={isTourney ? `Entry fee (${cur})` : `Buy-in (${cur})`}>
        <NumberInput value={form.buyIn} onChange={(v) => set({ buyIn: v ?? 0 })} />
      </Field>

      <Button variant="primary" size="lg" block icon="play" disabled={!valid || busy} onClick={start}>
        Start session
      </Button>
    </div>
  )
}
