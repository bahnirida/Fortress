import { Shield, KeyRound, StickyNote, Star, Settings as SettingsIcon } from 'lucide-react'
import type { SectionKey } from '../app/App'

const ITEMS: { key: SectionKey; label: string }[] = [
  { key: 'all', label: 'All Vaults' },
  { key: 'password', label: 'Passwords' },
  { key: 'note', label: 'Secure Notes' },
  { key: 'favorite', label: 'Favorites' },
  { key: 'settings', label: 'Settings' },
]

type Props = {
  active: SectionKey
  onSelectSection: (key: SectionKey) => void
}

export function Sidebar({ active, onSelectSection }: Props) {
  return (
    <div>
      <div className="brand">
        <span className="brand-icon" aria-hidden>
          <Shield size={18} strokeWidth={1.8} />
        </span>
        Fortress
      </div>
      <nav className="nav">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${active === item.key ? 'active' : ''}`}
            onClick={() => onSelectSection(item.key)}
            aria-pressed={active === item.key}
          >
            <span className="nav-icon" aria-hidden>
              {item.key === 'all' && <Shield size={16} strokeWidth={1.6} />}
              {item.key === 'password' && <KeyRound size={16} strokeWidth={1.6} />}
              {item.key === 'note' && <StickyNote size={16} strokeWidth={1.6} />}
              {item.key === 'favorite' && <Star size={16} strokeWidth={1.6} />}
              {item.key === 'settings' && <SettingsIcon size={16} strokeWidth={1.6} />}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
