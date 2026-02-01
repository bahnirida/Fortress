import { Plus } from 'lucide-react'
import type { RefObject } from 'react'

type Props = {
  query: string
  onQueryChange: (value: string) => void
  searchRef: RefObject<HTMLInputElement>
}

export function TopBar({ query, onQueryChange, searchRef }: Props) {
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
      <button className="btn btn-primary" type="button" aria-label="Add entry (coming soon)">
        <Plus size={16} strokeWidth={1.6} aria-hidden /> Add
      </button>
    </div>
  )
}
