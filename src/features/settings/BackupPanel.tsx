import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { Icon } from '../../components/icons'
import { Banner, Button, Panel } from '../../components/ui'
import { db } from '../../db/db'
import { exportBackup, importBackup, previewImport } from '../../db/repo'
import { backupAge, backupFileName, parseBackup, type Backup, type MergePlan } from '../../domain/backup'
import { handsToCsv } from '../../domain/csv'
import { formatDate, formatDateTime } from '../../domain/format'
import type { Settings } from '../../domain/types'
import { saveTextFile } from '../../lib/files'
import { useNow } from '../../lib/hooks'
import { cx } from '../../lib/cx'

type Pending = { backup: Backup; plan: MergePlan; fileName: string }

function countLine(label: string, c: { added: number; updated: number; unchanged: number }) {
  return `${label}: ${c.added} new, ${c.updated} updated, ${c.unchanged} already here`
}

export function BackupPanel({ settings }: { settings: Settings }) {
  const counts = useLiveQuery(async () => ({ hands: await db.hands.count(), sessions: await db.sessions.count() }), [])
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const now = useNow(60_000)
  const age = backupAge(settings.lastBackupAt, now)
  const hasData = (counts?.hands ?? 0) + (counts?.sessions ?? 0) > 0

  const doExport = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const backup = await exportBackup()
      const outcome = await saveTextFile(backupFileName(backup.exportedAt), 'application/json', JSON.stringify(backup, null, 1))
      setMessage(
        outcome === 'cancelled'
          ? { tone: 'error', text: 'Backup not saved.' }
          : { tone: 'ok', text: `Backup saved: ${backup.hands.length} hands, ${backup.sessions.length} sessions. Keep it somewhere safe (Files, iCloud Drive, email).` },
      )
    } catch (e) {
      setMessage({ tone: 'error', text: `Export failed: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(false)
    }
  }

  const doCsv = async () => {
    const [hands, tags, sessions] = await Promise.all([db.hands.toArray(), db.tags.toArray(), db.sessions.toArray()])
    const csv = handsToCsv(hands, { tags: new Map(tags.map((t) => [t.id, t])), sessions: new Map(sessions.map((s) => [s.id, s])) })
    await saveTextFile(backupFileName(Date.now(), 'csv').replace('backup', 'hands'), 'text/csv', csv)
  }

  const onFile = async (file: File | undefined) => {
    setMessage(null)
    setPending(null)
    if (!file) return
    const parsed = parseBackup(await file.text())
    if (!parsed.ok) {
      setMessage({ tone: 'error', text: parsed.error })
      return
    }
    setPending({ backup: parsed.backup, plan: await previewImport(parsed.backup), fileName: file.name })
  }

  const doImport = async () => {
    if (!pending) return
    setBusy(true)
    try {
      const c = await importBackup(pending.backup)
      setMessage({ tone: 'ok', text: `Imported. ${countLine('Hands', c.hands)}. ${countLine('Sessions', c.sessions)}.` })
      setPending(null)
    } catch (e) {
      setMessage({ tone: 'error', text: `Import failed: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel className="space-y-3 border-accent/40">
      <div className="flex items-start gap-3">
        <div className={cx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', age.stale && hasData ? 'bg-warn/15 text-warn' : 'bg-accent-soft text-accent')}>
          <Icon name={age.stale && hasData ? 'alert' : 'check'} size={18} />
        </div>
        <div className="text-sm">
          <div className="font-semibold">{age.label}</div>
          <div className="text-muted">
            {counts ? `${counts.hands} hands and ${counts.sessions} sessions on this device.` : ''} Your data never leaves this device, so a
            backup file is the only copy if you lose or reset your phone.
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="primary" size="lg" icon="download" disabled={busy} onClick={doExport}>
          Export backup
        </Button>
        <Button size="lg" icon="upload" disabled={busy} onClick={() => fileInput.current?.click()}>
          Import backup
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {pending && (
        <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3 text-sm">
          <div className="font-semibold">{pending.fileName}</div>
          <div className="text-muted">
            Exported {pending.backup.exportedAt ? formatDateTime(pending.backup.exportedAt) : 'at an unknown time'} ·{' '}
            {pending.backup.hands.length} hands, {pending.backup.sessions.length} sessions
          </div>
          <ul className="list-inside list-disc text-muted">
            <li>{countLine('Hands', pending.plan.counts.hands)}</li>
            <li>{countLine('Sessions', pending.plan.counts.sessions)}</li>
            {pending.plan.counts.tags.added > 0 && <li>{pending.plan.counts.tags.added} new tags</li>}
          </ul>
          <p className="text-xs text-faint">Merging never deletes anything. Where both copies exist, the more recently edited one wins.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setPending(null)}>Cancel</Button>
            <Button variant="primary" disabled={busy} onClick={doImport}>
              Merge into my data
            </Button>
          </div>
        </div>
      )}

      {message && (
        <Banner tone={message.tone === 'error' ? 'warn' : 'info'} icon={message.tone === 'error' ? 'alert' : 'check'}>
          {message.text}
        </Banner>
      )}

      <button type="button" onClick={doCsv} className="flex items-center gap-1.5 text-sm font-medium text-accent">
        <Icon name="download" size={16} /> Export hands as CSV (for spreadsheets)
      </button>
      {settings.lastBackupAt && <p className="text-xs text-faint">Last export {formatDate(settings.lastBackupAt)}.</p>}
    </Panel>
  )
}
