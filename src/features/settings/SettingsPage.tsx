import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { TableSizePicker } from '../../components/TableSize'
import { Button, Field, NumberInput, Page, PageHeader, Panel, Section, Segmented, TextInput } from '../../components/ui'
import { useSettings } from '../../db/hooks'
import { db } from '../../db/db'
import { clearAllData, loadSampleData, removeSampleData, updateSettings } from '../../db/repo'
import type { DisplayUnit, Theme } from '../../domain/types'
import { BackupPanel } from './BackupPanel'
import { TagManager } from './TagManager'

const CONFIRM_WORD = 'DELETE'

function DangerZone() {
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState(false)
  return (
    <Panel className="space-y-3 border-loss/40">
      <p className="text-sm text-muted">
        Permanently deletes every session, hand and tag on this device. Export a backup first — this can't be undone.
      </p>
      <Field label={`Type ${CONFIRM_WORD} to confirm`}>
        <TextInput value={typed} autoCapitalize="characters" autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
      </Field>
      <Button
        variant="danger"
        block
        icon="trash"
        disabled={typed !== CONFIRM_WORD}
        onClick={async () => {
          await clearAllData()
          setTyped('')
          setDone(true)
        }}
      >
        Clear all data
      </Button>
      {done && <p className="text-sm text-muted">All data cleared.</p>}
    </Panel>
  )
}

function DeveloperTools() {
  const sampleCount = useLiveQuery(() => db.hands.filter((h) => !!h.sample).count(), []) ?? 0
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <Panel className="space-y-3">
      <p className="text-sm text-muted">
        Load about 20 realistic hands across five sessions to see the study views populated. Sample data is marked and
        can be removed without touching your own hands.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          icon="download"
          onClick={async () => {
            const r = await loadSampleData()
            setMsg(`Loaded ${r.hands} hands in ${r.sessions} sessions.`)
          }}
        >
          {sampleCount ? 'Reload sample' : 'Load sample data'}
        </Button>
        <Button
          icon="trash"
          disabled={!sampleCount}
          onClick={async () => {
            await removeSampleData()
            setMsg('Sample data removed.')
          }}
        >
          Remove sample
        </Button>
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </Panel>
  )
}

export function SettingsPage() {
  const settings = useSettings()
  if (!settings) return <PageHeader title="Settings" />
  const { defaultStakes } = settings

  return (
    <>
      <PageHeader title="Settings" back="/more" />
      <Page>
        <Section title="Backup & restore">
          <BackupPanel settings={settings} />
        </Section>

        <Section title="Defaults">
          <Panel className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label={`Small blind (${settings.currencySymbol})`}>
                <NumberInput
                  value={defaultStakes.sb}
                  onChange={(v) => v && updateSettings({ defaultStakes: { ...defaultStakes, sb: v } })}
                />
              </Field>
              <Field label={`Big blind (${settings.currencySymbol})`}>
                <NumberInput
                  value={defaultStakes.bb}
                  onChange={(v) => v && updateSettings({ defaultStakes: { ...defaultStakes, bb: v } })}
                />
              </Field>
            </div>
            <Field label="Players at the table">
              <TableSizePicker value={settings.defaultTableSize} onChange={(defaultTableSize) => updateSettings({ defaultTableSize })} />
            </Field>
            <p className="text-xs text-faint">
              Used for hands logged without a session. New sessions start from your last session's values.
            </p>
          </Panel>
        </Section>

        <Section title="Display">
          <Panel className="space-y-3">
            <Field label="Show amounts in">
              <Segmented<DisplayUnit>
                value={settings.displayUnit}
                onChange={(displayUnit) => updateSettings({ displayUnit })}
                options={[
                  { value: 'money', label: `Dollars (${settings.currencySymbol})` },
                  { value: 'bb', label: 'Big blinds' },
                ]}
              />
            </Field>
            <Field label="Currency symbol">
              <TextInput
                className="w-24"
                maxLength={3}
                defaultValue={settings.currencySymbol}
                onBlur={(e) => updateSettings({ currencySymbol: e.target.value.trim() || '$' })}
              />
            </Field>
            <Field label="Theme">
              <Segmented<Theme>
                value={settings.theme}
                onChange={(theme) => updateSettings({ theme })}
                options={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' },
                  { value: 'system', label: 'System' },
                ]}
              />
            </Field>
          </Panel>
        </Section>

        <Section title="Tags">
          <Panel>
            <TagManager />
          </Panel>
        </Section>

        <Section title="Developer">
          <DeveloperTools />
        </Section>

        <Section title="Danger zone">
          <DangerZone />
        </Section>
      </Page>
    </>
  )
}
