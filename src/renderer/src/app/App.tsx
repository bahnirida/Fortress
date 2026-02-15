import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppShell } from './AppShell'
import { Sidebar } from '../components/Sidebar'
import { TopBar } from '../components/TopBar'
import { EntryList } from '../components/EntryList'
import { DetailsPanel } from '../components/DetailsPanel'
import { Titlebar } from '../components/Titlebar'
import { vaultClient as vault } from '../api/vaultClient'
import type { VaultItem } from '../types/vault'
import { AlertCircle, Eye, EyeOff, FolderOpen, HelpCircle, LockKeyhole, Moon, Sun, X } from 'lucide-react'

export type SectionKey = 'all' | 'password' | 'note' | 'favorite' | 'settings'
type Theme = 'dark' | 'light'

type AuthMode = 'open' | 'create'

const DEFAULT_AUTO_LOCK_MINUTES = 10
const LAST_VAULT_PATH_KEY = 'vault:lastPath'

type SegmentedControlProps = {
  value: AuthMode
  onChange: (value: AuthMode) => void
}

function SegmentedControl({ value, onChange }: SegmentedControlProps) {
  return (
    <div className="auth-segmented" role="tablist" aria-label="Vault mode">
      <button
        className={`auth-segment ${value === 'open' ? 'active' : ''}`}
        role="tab"
        aria-selected={value === 'open'}
        type="button"
        onClick={() => onChange('open')}
      >
        Open
      </button>
      <button
        className={`auth-segment ${value === 'create' ? 'active' : ''}`}
        role="tab"
        aria-selected={value === 'create'}
        type="button"
        onClick={() => onChange('create')}
      >
        Create
      </button>
    </div>
  )
}

type CompactAlertProps = {
  title: string
  message: string
  onClose: () => void
}

function CompactAlert({ title, message, onClose }: CompactAlertProps) {
  return (
    <div className="auth-alert" role="alert">
      <div className="auth-alert-icon" aria-hidden>
        <AlertCircle size={14} />
      </div>
      <div className="auth-alert-content">
        <div className="auth-alert-title">{title}</div>
        <div className="auth-alert-message">{message}</div>
      </div>
      <button className="auth-alert-close" type="button" aria-label="Close error" onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  )
}

function App() {
  const [entries, setEntries] = useState<VaultItem[]>([])
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>('dark')
  const [showPassword, setShowPassword] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('open')
  const [masterPassword, setMasterPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showMasterPassword, setShowMasterPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberVaultPath, setRememberVaultPath] = useState(true)
  const [vaultPath, setVaultPath] = useState('')
  const [autoLockMinutes, setAutoLockMinutes] = useState(DEFAULT_AUTO_LOCK_MINUTES)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const detailsRef = useRef<HTMLDivElement | null>(null)
  const activityRef = useRef(0)

  const loadEntries = useCallback(
    (searchQuery?: string) => {
      if (!isUnlocked) return
      setLoading(true)
      setError(null)
      vault
        .listItems(searchQuery)
        .then((data) => {
          setEntries(data)
          if (!data.length) {
            setSelectedId(null)
            setSelectedItem(null)
            return
          }
          setSelectedId((prev) => (prev && data.some((item) => item.id === prev) ? prev : data[0].id))
        })
        .catch((err) => {
          setError(err?.message ?? 'Failed to load entries')
          if (String(err?.message ?? '').toLowerCase().includes('locked')) {
            setIsUnlocked(false)
            setEntries([])
            setSelectedItem(null)
          }
        })
        .finally(() => setLoading(false))
    },
    [isUnlocked],
  )

  useEffect(() => {
    const initialize = async () => {
      try {
        const [unlocked, minutes] = await Promise.all([vault.isUnlocked(), vault.getAutoLockMinutes()])
        setIsUnlocked(unlocked)
        setAutoLockMinutes(minutes)
        if (unlocked) {
          loadEntries(query)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize vault state')
      }
    }

    initialize()

    const unsubscribe = vault.onStateChanged((state) => {
      if (!state.unlocked) {
        setIsUnlocked(false)
        setEntries([])
        setSelectedId(null)
        setSelectedItem(null)
        setShowPassword(false)
      }
    })

    return unsubscribe
  }, [loadEntries, query])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-light')
    root.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark')
  }, [theme])

  useEffect(() => {
    const rememberedPath = localStorage.getItem(LAST_VAULT_PATH_KEY)
    if (rememberedPath) {
      setVaultPath(rememberedPath)
    }
  }, [])

  useEffect(() => {
    if (rememberVaultPath && vaultPath.trim()) {
      localStorage.setItem(LAST_VAULT_PATH_KEY, vaultPath.trim())
      return
    }
    if (!rememberVaultPath) {
      localStorage.removeItem(LAST_VAULT_PATH_KEY)
    }
  }, [rememberVaultPath, vaultPath])

  useEffect(() => {
    if (!isUnlocked || activeSection === 'settings') return
    const handle = window.setTimeout(() => loadEntries(query), 150)
    return () => window.clearTimeout(handle)
  }, [query, activeSection, isUnlocked, loadEntries])

  useEffect(() => {
    if (!isUnlocked || !selectedId || activeSection === 'settings') return
    setShowPassword(false)
    vault
      .getItem(selectedId)
      .then((item) => {
        setSelectedItem(item)
      })
      .catch((err) => {
        setError(err?.message ?? 'Failed to load selected item')
      })
  }, [selectedId, isUnlocked, activeSection])

  useEffect(() => {
    if (!isUnlocked) return

    const touch = () => {
      const now = Date.now()
      if (now - activityRef.current < 5000) return
      activityRef.current = now
      void vault.touchActivity()
    }

    const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'scroll']
    for (const eventName of events) {
      window.addEventListener(eventName, touch, { passive: true })
    }

    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, touch)
      }
    }
  }, [isUnlocked])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (activeSection === 'password' && entry.type !== 'password') return false
      if (activeSection === 'note' && entry.type !== 'note') return false
      if (activeSection === 'favorite') return false
      return true
    })
  }, [entries, activeSection])

  useEffect(() => {
    if (activeSection === 'settings') {
      setSelectedId(null)
      return
    }
    if (!filteredEntries.length) {
      setSelectedId(null)
      setSelectedItem(null)
      return
    }
    const stillVisible = filteredEntries.some((entry) => entry.id === selectedId)
    setSelectedId(stillVisible ? selectedId : filteredEntries[0].id)
  }, [activeSection, filteredEntries, selectedId])

  const authValidation = useMemo(() => {
    const errors: { path?: string; password?: string; confirm?: string } = {}
    if (!vaultPath.trim()) {
      errors.path = 'Vault path is required.'
    }
    if (!masterPassword.trim()) {
      errors.password = authMode === 'create' ? 'New master password is required.' : 'Master password is required.'
    }
    if (authMode === 'create') {
      if (!confirmPassword.trim()) {
        errors.confirm = 'Please confirm your master password.'
      } else if (confirmPassword !== masterPassword) {
        errors.confirm = 'Passwords do not match.'
      }
    }
    return errors
  }, [authMode, confirmPassword, masterPassword, vaultPath])

  const canSubmitAuth =
    Boolean(vaultPath.trim()) &&
    Boolean(masterPassword.trim()) &&
    (authMode === 'open' || (Boolean(confirmPassword.trim()) && confirmPassword === masterPassword))

  const handleUnlock = async () => {
    setError(null)
    if (!canSubmitAuth) {
      setError('Please fill all required fields.')
      return
    }

    try {
      if (authMode === 'create') {
        const result = await vault.createVault(masterPassword, vaultPath || undefined)
        if (!result.ok) {
          setError(result.error.message)
          return
        }
      } else {
        if (!vaultPath.trim()) {
          setError('Vault path is required to open an existing vault.')
          return
        }
        const result = await vault.openVault(masterPassword, vaultPath)
        if (!result.ok) {
          setError(result.error.message)
          return
        }
      }
      setIsUnlocked(true)
      setMasterPassword('')
      setConfirmPassword('')
      setShowMasterPassword(false)
      setShowConfirmPassword(false)
      loadEntries(query)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock vault')
    }
  }

  const handleLock = async () => {
    try {
      await vault.lockVault()
      setIsUnlocked(false)
      setEntries([])
      setSelectedItem(null)
      setSelectedId(null)
      setShowPassword(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock vault')
    }
  }

  const handleAutoLockMinutesChange = async (minutes: number) => {
    try {
      const next = await vault.setAutoLockMinutes(minutes)
      setAutoLockMinutes(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update auto-lock setting')
    }
  }

  const handleCopyPassword = () => {
    if (!selectedItem?.password) return
    void window.shell.copySecret(selectedItem.password, 30_000)
  }

  const handlePickVaultFile = async () => {
    const selectedPath =
      authMode === 'create'
        ? await window.shell.openExportDialog()
        : await window.shell.openImportDialog()
    if (selectedPath) {
      setVaultPath(selectedPath)
    }
  }

  if (!isUnlocked) {
    return (
      <div className={`window auth-window ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
        <header className="titlebar auth-titlebar drag">
          <div className="titlebar-left no-drag">
            <span className="titlebar-title auth-titlebar-title">
              <LockKeyhole size={14} aria-hidden /> Vault Locked
            </span>
          </div>
          <div className="titlebar-spacer drag" />
          <div className="titlebar-controls no-drag">
            <button className="tb-btn auth-title-btn" aria-label="Minimize" onClick={() => window.shell.minimize()}>
              &#8211;
            </button>
            <button className="tb-btn tb-btn-close auth-title-btn" aria-label="Close" onClick={() => window.shell.close()}>
              &#10005;
            </button>
          </div>
        </header>

        <main className="auth-layout">
          <div className="auth-bg-layer" aria-hidden />
          <section className="auth-card">
            <header className="auth-card-header">
              <h1 className="auth-title">{authMode === 'create' ? 'Create Vault' : 'Unlock Vault'}</h1>
              <p className="auth-subtitle">Local-first encrypted vault secured with SQLCipher.</p>
            </header>

            {error && (
              <CompactAlert
                title="Unlock failed"
                message={error}
                onClose={() => setError(null)}
              />
            )}

            <div className="auth-field-group">
              <label className="auth-label">Mode</label>
              <SegmentedControl
                value={authMode}
                onChange={(mode) => {
                  setAuthMode(mode)
                  setError(null)
                  setConfirmPassword('')
                }}
              />
            </div>

            <div className="auth-field-group">
              <label className="auth-label" htmlFor="vault-path">Vault path</label>
              <div className="auth-input-row">
                <input
                  id="vault-path"
                  className={`auth-input ${authValidation.path ? 'is-invalid' : ''}`}
                  type="text"
                  placeholder="Select a vault file"
                  value={vaultPath}
                  onChange={(e) => setVaultPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmitAuth) void handleUnlock()
                  }}
                />
                <button className="auth-browse-btn" type="button" onClick={handlePickVaultFile}>
                  <FolderOpen size={15} aria-hidden />
                  Browse...
                </button>
              </div>
              {authValidation.path && <p className="auth-error-text">{authValidation.path}</p>}
            </div>

            <div className="auth-field-group">
              <label className="auth-label" htmlFor="master-password">
                {authMode === 'create' ? 'New master password' : 'Master password'}
              </label>
              <div className="auth-input-row">
                <input
                  id="master-password"
                  className={`auth-input ${authValidation.password ? 'is-invalid' : ''}`}
                  type={showMasterPassword ? 'text' : 'password'}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmitAuth) void handleUnlock()
                  }}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  autoComplete="off"
                  aria-label="Master password"
                />
                <button
                  className="auth-eye-btn"
                  type="button"
                  onClick={() => setShowMasterPassword((prev) => !prev)}
                  aria-label={showMasterPassword ? 'Hide password' : 'Show password'}
                >
                  {showMasterPassword ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
                  {showMasterPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {authValidation.password && <p className="auth-error-text">{authValidation.password}</p>}
            </div>

            {authMode === 'create' && (
              <div className="auth-field-group">
                <label className="auth-label" htmlFor="confirm-password">Confirm password</label>
                <div className="auth-input-row">
                  <input
                    id="confirm-password"
                    className={`auth-input ${authValidation.confirm ? 'is-invalid' : ''}`}
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canSubmitAuth) void handleUnlock()
                    }}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                    autoComplete="off"
                    aria-label="Confirm password"
                  />
                  <button
                    className="auth-eye-btn"
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                  >
                    {showConfirmPassword ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {authValidation.confirm && <p className="auth-error-text">{authValidation.confirm}</p>}
              </div>
            )}

            <label className="auth-check-row">
              <input
                type="checkbox"
                checked={rememberVaultPath}
                onChange={(e) => setRememberVaultPath(e.target.checked)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmitAuth) void handleUnlock()
                }}
              />
              Remember last vault path
            </label>

            <button
              className="auth-cta"
              type="button"
              onClick={() => void handleUnlock()}
              disabled={!canSubmitAuth}
            >
              {authMode === 'create' ? 'Create Vault' : 'Unlock Vault'}
            </button>

            <button className="auth-help" type="button">
              <HelpCircle size={14} aria-hidden />
              What is a vault?
            </button>
          </section>
        </main>
      </div>
    )
  }

  return (
    <AppShell
      themeClass={theme === 'light' ? 'theme-light' : 'theme-dark'}
      titlebar={
        <Titlebar
          onImport={handlePickVaultFile}
          onExport={() => {
            void window.shell.openExportDialog().then((target) => {
              if (target) {
                void vault.exportEncryptedVault(target)
              }
            })
          }}
          onLockVault={() => void handleLock()}
          onCopyUsername={() => {
            if (selectedItem?.username) {
              void window.shell.copyText(selectedItem.username)
            }
          }}
          onCopyPassword={handleCopyPassword}
          onTogglePassword={() => {
            if (selectedItem?.type === 'password') setShowPassword((prev) => !prev)
          }}
          onReload={() => window.shell.reload()}
          onToggleDevTools={() => window.shell.toggleDevTools()}
          onZoomIn={() => window.shell.zoomIn()}
          onZoomOut={() => window.shell.zoomOut()}
          onZoomReset={() => window.shell.zoomReset()}
          canCopyUsername={Boolean(selectedItem?.username)}
          canCopyPassword={selectedItem?.type === 'password' && Boolean(selectedItem.password)}
          canTogglePassword={selectedItem?.type === 'password'}
        />
      }
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
              <label className="label" htmlFor="auto-lock-minutes">Auto-lock (minutes)</label>
              <span className="value">
                <input
                  id="auto-lock-minutes"
                  className="search"
                  type="number"
                  min={1}
                  max={240}
                  value={autoLockMinutes}
                  onChange={(e) => {
                    const parsed = Number(e.target.value)
                    if (Number.isFinite(parsed)) {
                      void handleAutoLockMinutesChange(parsed)
                    }
                  }}
                  aria-label="Auto-lock minutes"
                />
              </span>
            </div>
            <div className="detail-row">
              <span className="label">Vault</span>
              <span className="value mono">{vaultPath || 'Active vault path managed in main process'}</span>
            </div>
          </div>
        ) : (
          <>
            <TopBar
              query={query}
              onQueryChange={setQuery}
              searchRef={searchRef}
              onLock={() => void handleLock()}
              isLocked={!isUnlocked}
            />
            <EntryList
              entries={filteredEntries}
              loading={loading}
              error={error}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRetry={() => loadEntries(query)}
              emptyMessage={query ? 'No results match your search.' : 'No entries available.'}
            />
          </>
        )
      }
      details={
        <DetailsPanel
          ref={detailsRef}
          entry={selectedItem}
          loading={loading}
          error={error}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((prev) => !prev)}
          autoLockMinutes={autoLockMinutes}
          onCopyPassword={handleCopyPassword}
        />
      }
    />
  )
}

export default App
