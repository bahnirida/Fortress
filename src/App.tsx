import { useEffect, useMemo, useState } from 'react'
import type { VaultEntry } from '../electron/preload/types'
import './App.css'

type SidebarKey = 'all' | 'password' | 'note' | 'favorite' | 'settings'

const SIDEBAR_ITEMS: { key: SidebarKey; label: string }[] = [
  { key: 'all', label: 'All Vaults' },
  { key: 'password', label: 'Passwords' },
  { key: 'note', label: 'Secure Notes' },
  { key: 'favorite', label: 'Favorites' },
  { key: 'settings', label: 'Settings' },
]

function App() {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [activeSection, setActiveSection] = useState<SidebarKey>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    window.vault.listEntries().then((data) => {
      setEntries(data)
      if (data.length) {
        setSelectedId(data[0].id)
      }
    })
  }, [])

  const filteredEntries = useMemo(() => {
    if (activeSection === 'settings') return []

    const term = searchTerm.trim().toLowerCase()
    return entries.filter((entry) => {
      if (activeSection === 'password' && entry.type !== 'password') {
        return false
      }
      if (activeSection === 'note' && entry.type !== 'note') {
        return false
      }
      if (activeSection === 'favorite' && !entry.favorite) {
        return false
      }
      if (!term) return true
      return [entry.title, entry.username, entry.url]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term))
    })
  }, [activeSection, entries, searchTerm])

  useEffect(() => {
    setShowPassword(false)
    if (activeSection === 'settings') {
      setSelectedId(null)
      return
    }
    if (filteredEntries.length === 0) {
      setSelectedId(null)
      return
    }
    const stillVisible = filteredEntries.some((entry) => entry.id === selectedId)
    setSelectedId(stillVisible ? selectedId : filteredEntries[0].id)
  }, [activeSection, filteredEntries, searchTerm, selectedId])

  const selectedEntry =
    filteredEntries.find((entry) => entry.id === selectedId) ?? null

  const isSettingsView = activeSection === 'settings'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Vault</div>
        <nav className="nav">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${
                activeSection === item.key ? 'active' : ''
              }`}
              onClick={() => setActiveSection(item.key)}
            >
              <span className="nav-bullet" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="list-panel">
        {isSettingsView ? (
          <div className="empty-state">
            <h2>Settings</h2>
            <p>Security settings and preferences will live here.</p>
          </div>
        ) : (
          <>
            <div className="search-bar">
              <input
                type="search"
                placeholder="Search vault..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="entries">
              {filteredEntries.map((entry) => (
                <button
                  key={entry.id}
                  className={`entry ${entry.id === selectedId ? 'selected' : ''}`}
                  onClick={() => setSelectedId(entry.id)}
                >
                  <div className="entry-header">
                    <div className="entry-title">{entry.title}</div>
                    {entry.favorite && <span className="pill">★</span>}
                  </div>
                  <div className="entry-meta">
                    <span className="pill subtle">
                      {entry.type === 'password' ? 'Password' : 'Secure Note'}
                    </span>
                    {entry.username && <span className="meta-text">{entry.username}</span>}
                    {entry.url && <span className="meta-text">{entry.url}</span>}
                  </div>
                </button>
              ))}
              {filteredEntries.length === 0 && (
                <div className="empty-state">
                  <h3>No entries</h3>
                  <p>Try a different filter or search.</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <section className="details-panel">
        {selectedEntry ? (
          <>
            <div className="details-header">
              <div>
                <div className="details-title">{selectedEntry.title}</div>
                <div className="details-subtitle">
                  {selectedEntry.type === 'password' ? 'Password' : 'Secure Note'}
                  {selectedEntry.favorite && <span className="pill">★ Favorite</span>}
                </div>
              </div>
              <span className="badge">{selectedEntry.updatedAt ? 'Updated' : 'New'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Username</span>
              <span className="value">{selectedEntry.username ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span className="label">URL</span>
              <span className="value">{selectedEntry.url ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Password</span>
              <div className="value password">
                <span className="mono">
                  {selectedEntry.type === 'password'
                    ? showPassword
                      ? 'example-password'
                      : '••••••••••'
                    : 'Not applicable'}
                </span>
                {selectedEntry.type === 'password' && (
                  <button
                    className="ghost"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? 'Hide' : 'Reveal'}
                  </button>
                )}
              </div>
            </div>
            <div className="detail-row">
              <span className="label">Last updated</span>
              <span className="value">
                {selectedEntry.updatedAt
                  ? new Date(selectedEntry.updatedAt).toLocaleString()
                  : '—'}
              </span>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h3>Select an entry</h3>
            <p>Choose an item from the list to view details.</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default App
