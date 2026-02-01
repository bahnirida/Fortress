import { EntryRow } from './EntryRow'
import type { VaultEntry } from '../types/vault'
import { useEffect, useRef } from 'react'

type Props = {
  entries: VaultEntry[]
  loading: boolean
  error: string | null
  selectedId: string | null
  onSelect: (id: string) => void
  onRetry: () => void
  emptyMessage: string
}

export function EntryList({
  entries,
  loading,
  error,
  selectedId,
  onSelect,
  onRetry,
  emptyMessage,
}: Props) {
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-entry-id="${selectedId ?? ''}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  if (loading) {
    return <div className="empty-state">Loading entries…</div>
  }
  if (error) {
    return (
      <div className="empty-state error">
        <div>Error: {error}</div>
        <button className="btn btn-ghost" onClick={onRetry}>
          Retry
        </button>
      </div>
    )
  }
  if (!entries.length) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className="entries" role="list" ref={listRef}>
      {entries.map((entry, index) => (
        <EntryRow
          key={entry.id}
          entry={entry}
          selected={entry.id === selectedId}
          onSelect={() => onSelect(entry.id)}
          tabIndex={index === 0 ? 0 : -1}
        />
      ))}
    </div>
  )
}
