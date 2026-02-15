import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Menu, Minus, Square, X } from 'lucide-react'

type Props = {
  onImport: () => void
  onExport: () => void
  onLockVault: () => void
  onCopyUsername: () => void
  onCopyPassword: () => void
  onTogglePassword: () => void
  onReload: () => void
  onToggleDevTools: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  canCopyUsername: boolean
  canCopyPassword: boolean
  canTogglePassword: boolean
}

export function Titlebar({
  onImport,
  onExport,
  onLockVault,
  onCopyUsername,
  onCopyPassword,
  onTogglePassword,
  onReload,
  onToggleDevTools,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  canCopyUsername,
  canCopyPassword,
  canTogglePassword,
}: Props) {
  const [isMax, setIsMax] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState<'file' | 'edit' | 'view'>('file')
  const menuRef = useRef<HTMLDivElement | null>(null)

  const refreshState = useCallback(async () => {
    const maximized = await window.shell.isMaximized()
    setIsMax(maximized)
  }, [])

  useEffect(() => {
    refreshState()
  }, [refreshState])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuOpen) return
      const target = event.target as Node
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const menuItems = useMemo(() => {
    return {
      file: [
        { label: 'Import…', onClick: onImport, disabled: false },
        { label: 'Export…', onClick: onExport, disabled: false },
        { label: 'Lock Vault', onClick: onLockVault, disabled: false },
        { label: 'Exit', onClick: () => window.shell.close(), disabled: false },
      ],
      edit: [
        { label: 'Copy Username', onClick: onCopyUsername, disabled: !canCopyUsername },
        { label: 'Copy Password', onClick: onCopyPassword, disabled: !canCopyPassword },
        { label: 'Toggle Password Visibility', onClick: onTogglePassword, disabled: !canTogglePassword },
      ],
      view: [
        { label: 'Reload', onClick: onReload, disabled: false },
        { label: 'Toggle DevTools', onClick: onToggleDevTools, disabled: false },
        { label: 'Zoom In', onClick: onZoomIn, disabled: false },
        { label: 'Zoom Out', onClick: onZoomOut, disabled: false },
        { label: 'Reset Zoom', onClick: onZoomReset, disabled: false },
      ],
    }
  }, [
    onImport,
    onExport,
    onLockVault,
    onCopyUsername,
    onCopyPassword,
    onTogglePassword,
    onReload,
    onToggleDevTools,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    canCopyUsername,
    canCopyPassword,
    canTogglePassword,
  ])

  const handleToggleMax = async () => {
    const maximized = await window.shell.toggleMaximize()
    setIsMax(maximized)
  }

  return (
    <header
      className="titlebar drag"
      onDoubleClick={handleToggleMax}
    >
      <div className="titlebar-left no-drag" ref={menuRef}>
        <button
          className="tb-btn tb-btn-menu"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => {
            setMenuOpen((open) => {
              const next = !open
              if (next) setActiveMenu('file')
              return next
            })
          }}
        >
          <Menu size={16} strokeWidth={1.8} aria-hidden />
        </button>
        {menuOpen && (
          <div className="titlebar-menu" role="menu">
            <div className="menu-sections" role="presentation">
              <button
                className={`menu-section ${activeMenu === 'file' ? 'active' : ''}`}
                role="menuitem"
                onClick={() => setActiveMenu('file')}
              >
                File
              </button>
              <button
                className={`menu-section ${activeMenu === 'edit' ? 'active' : ''}`}
                role="menuitem"
                onClick={() => setActiveMenu('edit')}
              >
                Edit
              </button>
              <button
                className={`menu-section ${activeMenu === 'view' ? 'active' : ''}`}
                role="menuitem"
                onClick={() => setActiveMenu('view')}
              >
                View
              </button>
            </div>
            <div className="menu-items" role="presentation">
              {menuItems[activeMenu].map((item) => (
                <button
                  key={item.label}
                  className={`menu-item ${item.disabled ? 'disabled' : ''}`}
                  role="menuitem"
                  aria-disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return
                    item.onClick()
                    setMenuOpen(false)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="titlebar-spacer drag" />
      <div className="titlebar-controls no-drag">
        <button className="tb-btn" aria-label="Minimize" onClick={() => window.shell.minimize()}>
          <Minus size={14} strokeWidth={1.8} aria-hidden />
        </button>
        <button
          className="tb-btn"
          aria-label={isMax ? 'Restore' : 'Maximize'}
          onClick={handleToggleMax}
        >
          {isMax ? (
            <Copy size={14} strokeWidth={1.8} aria-hidden />
          ) : (
            <Square size={14} strokeWidth={1.8} aria-hidden />
          )}
        </button>
        <button className="tb-btn tb-btn-close" aria-label="Close" onClick={() => window.shell.close()}>
          <X size={14} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </header>
  )
}
