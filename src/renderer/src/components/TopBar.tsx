import { Lock, Plus } from 'lucide-react'
import type { RefObject } from 'react'

type Props = {
  query: string
  onQueryChange: (value: string) => void
  searchRef: RefObject<HTMLInputElement>
  onLock: () => void
  isLocked: boolean
}

export function TopBar({ query, onQueryChange, searchRef, onLock, isLocked }: Props) {
  return (
    <div className="topbar">
      <input
        ref={searchRef}
        className="search"
        type="search"
        placeholder="Search vault..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label="Search entries"
      />
      <button className="btn btn-ghost" type="button" onClick={onLock} disabled={isLocked}>
        <Lock size={16} strokeWidth={1.6} aria-hidden /> Lock
      </button>
      <button className="btn btn-primary" type="button" aria-label="Add entry (coming soon)">
        <Plus size={16} strokeWidth={1.6} aria-hidden /> Add
      </button>
    </div>
  )
}
