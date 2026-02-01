import type { KeyboardEvent } from 'react'
import { KeyRound, StickyNote, Star } from 'lucide-react'
import type { VaultEntry } from '../types/vault'

type Props = {
  entry: VaultEntry
  selected: boolean
  onSelect: () => void
  tabIndex?: number
}

export function EntryRow({ entry, selected, onSelect, tabIndex = -1 }: Props) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect()
    }
  }

  return (
    <button
      className={`entry ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      tabIndex={tabIndex}
      aria-pressed={selected}
      role="listitem"
      data-entry-id={entry.id}
    >
      <div className="entry-header">
        <div className="entry-title">{entry.title}</div>
        {entry.favorite && (
          <span className="pill">
            <Star size={14} strokeWidth={1.6} aria-hidden />
          </span>
        )}
      </div>
      <div className="entry-meta">
        <span className="pill subtle">
          {entry.type === 'password' ? (
            <>
              <KeyRound size={14} strokeWidth={1.6} aria-hidden /> Password
            </>
          ) : (
            <>
              <StickyNote size={14} strokeWidth={1.6} aria-hidden /> Secure Note
            </>
          )}
        </span>
        {entry.username && <span className="meta-text">{entry.username}</span>}
        {entry.url && <span className="meta-text">{entry.url}</span>}
      </div>
    </button>
  )
}
