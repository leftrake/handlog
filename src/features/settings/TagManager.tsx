import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Button, ConfirmButton, IconButton, TextInput } from '../../components/ui'
import { db } from '../../db/db'
import { useTags } from '../../db/hooks'
import { addTag, deleteTag, moveTag, renameTag } from '../../db/repo'
import type { Tag } from '../../domain/types'

function useTagCounts(): Map<string, number> {
  return (
    useLiveQuery(async () => {
      const counts = new Map<string, number>()
      await db.hands.each((h) => {
        for (const t of h.tagIds) counts.set(t, (counts.get(t) ?? 0) + 1)
      })
      return counts
    }, []) ?? new Map()
  )
}

function TagRow({ tag, count, first, last }: { tag: Tag; count: number; first: boolean; last: boolean }) {
  const [name, setName] = useState(tag.name)
  const commit = () => {
    const trimmed = name.trim()
    if (!trimmed) setName(tag.name)
    else if (trimmed !== tag.name) void renameTag(tag.id, trimmed)
  }
  return (
    <li className="flex items-center gap-1 py-1">
      <TextInput
        aria-label="Tag name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-10 flex-1"
      />
      <span className="num w-8 text-center text-xs text-muted" title="Hands with this tag">
        {count}
      </span>
      <IconButton icon="chevronUp" label="Move up" disabled={first} onClick={() => moveTag(tag.id, -1)} className="h-10 w-9" />
      <IconButton icon="chevronDown" label="Move down" disabled={last} onClick={() => moveTag(tag.id, 1)} className="h-10 w-9" />
      <ConfirmButton
        size="sm"
        variant="ghost"
        icon="trash"
        confirmLabel={count ? `Remove from ${count}?` : 'Delete?'}
        onConfirm={() => deleteTag(tag.id)}
        aria-label={`Delete ${tag.name}`}
      >
        {''}
      </ConfirmButton>
    </li>
  )
}

export function TagManager() {
  const tags = useTags()
  const counts = useTagCounts()
  const [draft, setDraft] = useState('')
  if (!tags) return null
  return (
    <div>
      <ul className="divide-y divide-line/50">
        {tags.map((t, i) => (
          <TagRow key={t.id} tag={t} count={counts.get(t.id) ?? 0} first={i === 0} last={i === tags.length - 1} />
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!draft.trim()) return
          await addTag(draft)
          setDraft('')
        }}
      >
        <TextInput value={draft} placeholder="New tag" onChange={(e) => setDraft(e.target.value)} />
        <Button type="submit" icon="plus" disabled={!draft.trim()}>
          Add
        </Button>
      </form>
      <p className="mt-2 text-xs text-faint">Renaming a tag updates every hand that has it. Deleting removes it from those hands.</p>
    </div>
  )
}
