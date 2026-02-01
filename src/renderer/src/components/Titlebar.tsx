import { useCallback, useEffect, useState } from 'react'
import { Copy, Minus, Square, X } from 'lucide-react'

export function Titlebar() {
  const [isMax, setIsMax] = useState(false)

  const refreshState = useCallback(async () => {
    const maximized = await window.shell.isMaximized()
    setIsMax(maximized)
  }, [])

  useEffect(() => {
    refreshState()
  }, [refreshState])

  const handleToggleMax = async () => {
    const maximized = await window.shell.toggleMaximize()
    setIsMax(maximized)
  }

  return (
    <header
      className="titlebar drag"
      onDoubleClick={handleToggleMax}
    >
      <div className="titlebar-left no-drag">
        <span className="lock-icon" aria-hidden>
          🔒
        </span>
        <span className="titlebar-title">Vault</span>
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
