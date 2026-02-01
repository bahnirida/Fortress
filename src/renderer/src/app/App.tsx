import { useEffect, useMemo, useRef, useState } from 'react'
import { AppShell } from './AppShell'
import { Sidebar } from '../components/Sidebar'
import { TopBar } from '../components/TopBar'
import { EntryList } from '../components/EntryList'
import { DetailsPanel } from '../components/DetailsPanel'
import { Titlebar } from '../components/Titlebar'
import { vault } from '../api/vault'
import type { VaultEntry } from '../types/vault'
import { Moon, Sun } from 'lucide-react'

export type SectionKey = 'all' | 'password' | 'note' | 'favorite' | 'settings'
type Theme = 'dark' | 'light'

function App() {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>('dark')
  const [showPassword, setShowPassword] = useState(false)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const detailsRef = useRef<HTMLDivElement | null>(null)

  const loadEntries = () => {
    setLoading(true)
    setError(null)
    vault
      .listEntries()
      .then((data) => {
        setEntries(data)
        if (data.length) setSelectedId(data[0].id)
      })
      .catch((err) => {
        setError(err?.message ?? 'Failed to load entries')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadEntries()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-light')
    root.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark')
  }, [theme])

  const filteredEntries = useMemo(() => {
    const term = query.trim().toLowerCase()
    return entries.filter((entry) => {
      if (activeSection === 'password' && entry.type !== 'password') return false
      if (activeSection === 'note' && entry.type !== 'note') return false
      if (activeSection === 'favorite' && !entry.favorite) return false
      if (!term) return true
      return [entry.title, entry.username, entry.url]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term))
    })
  }, [entries, activeSection, query])

  useEffect(() => {
    setShowPassword(false)
    if (activeSection === 'settings') {
      setSelectedId(null)
      return
    }
    if (!filteredEntries.length) {
      setSelectedId(null)
      return
    }
    const stillVisible = filteredEntries.some((e) => e.id === selectedId)
    setSelectedId(stillVisible ? selectedId : filteredEntries[0].id)
  }, [activeSection, filteredEntries, selectedId])

  const selected =
    filteredEntries.find((entry) => entry.id === selectedId) ?? null

  // Keyboard shortcuts: arrows for selection, Enter focus details, Ctrl/Cmd+F focus search, Esc clears search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInputLike =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      if (activeSection === 'settings') return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }

      if (e.key === 'Escape') {
        if (query) {
          e.preventDefault()
          setQuery('')
        }
        return
      }

      if (isInputLike) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (!filteredEntries.length) return
        const currentIndex = filteredEntries.findIndex((e) => e.id === selectedId)
        const nextIndex =
          e.key === 'ArrowDown'
            ? Math.min((currentIndex === -1 ? 0 : currentIndex + 1), filteredEntries.length - 1)
            : Math.max((currentIndex === -1 ? filteredEntries.length - 1 : currentIndex - 1), 0)
        setSelectedId(filteredEntries[nextIndex].id)
        return
      }

      if (e.key === 'Enter' && selectedId) {
        detailsRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeSection, filteredEntries, query, selectedId])

  return (
    <AppShell
      themeClass={theme === 'light' ? 'theme-light' : 'theme-dark'}
      titlebar={<Titlebar />}
      sidebar={
        <Sidebar
          active={activeSection}
          onSelectSection={setActiveSection}
        />
      }
      main={
        activeSection === 'settings' ? (
          <div className="settings-card">
            <div className="details-header">
              <div>
                <div className="details-title">Appearance</div>
                <div className="details-subtitle">Switch between light and dark</div>
              </div>
            </div>
            <div className="detail-row">
              <span className="label">Theme</span>
              <div className="value">
                <button
                  className="btn btn-ghost"
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                >
                  <Moon size={16} strokeWidth={1.6} aria-hidden /> Dark
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setTheme('light')}
                  aria-pressed={theme === 'light'}
                >
                  <Sun size={16} strokeWidth={1.6} aria-hidden /> Light
                </button>
              </div>
            </div>
            <div className="detail-row">
              <span className="label">Auto-lock</span>
              <span className="value">
                <span className="pill">🔒 Auto-lock: 5 minutes</span>
              </span>
            </div>
          </div>
        ) : (
          <>
            <TopBar
              query={query}
              onQueryChange={setQuery}
              searchRef={searchRef}
            />
            <EntryList
              entries={filteredEntries}
              loading={loading}
              error={error}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRetry={loadEntries}
              emptyMessage={
                query ? 'No results match your search.' : 'No entries available.'
              }
            />
          </>
        )
      }
      details={
        <DetailsPanel
          ref={detailsRef}
          entry={selected}
          loading={loading}
          error={error}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((prev) => !prev)}
        />
      }
    />
  )
}

export default App
