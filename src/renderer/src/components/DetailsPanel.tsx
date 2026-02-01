import { forwardRef } from 'react'
import { Clock, Copy, Eye, EyeOff, Lock, Star } from 'lucide-react'
import type { VaultEntry } from '../types/vault'

type Props = {
  entry: VaultEntry | null
  loading: boolean
  error: string | null
  showPassword: boolean
  onTogglePassword: () => void
}

export const DetailsPanel = forwardRef<HTMLDivElement, Props>(
  ({ entry, loading, error, showPassword, onTogglePassword }, ref) => {
    if (loading) return <div className="empty-state">Loading…</div>
    if (error) return <div className="empty-state error">Error: {error}</div>
    if (!entry) {
      return (
        <div className="empty-state">
          <h3>No entry selected</h3>
          <p>Choose an item from the list to view details.</p>
        </div>
      )
    }

    return (
      <div className="details-content" ref={ref} tabIndex={-1}>
        <div className="details-header">
          <div>
            <div className="details-title">{entry.title}</div>
            <div className="details-subtitle">
              {entry.type === 'password' ? 'Password' : 'Secure Note'}
              {entry.favorite && (
                <span className="pill">
                  <Star size={14} strokeWidth={1.6} aria-hidden /> Favorite
                </span>
              )}
            </div>
          </div>
          <span className="badge">
            Updated {new Date(entry.updatedAt).toLocaleDateString()}
          </span>
        </div>

        <div className="detail-row">
          <span className="label">Status</span>
          <span className="value">
            <Lock size={16} strokeWidth={1.6} aria-hidden /> Locked
            <span className="pill">
              <Clock size={14} strokeWidth={1.5} aria-hidden /> Auto-lock: 5 minutes
            </span>
          </span>
        </div>
        <div className="detail-row">
          <span className="label">Username</span>
          <span className="value">{entry.username ?? '—'}</span>
        </div>
        <div className="detail-row">
          <span className="label">URL</span>
          <span className="value">{entry.url ?? '—'}</span>
        </div>
        <div className="detail-row">
          <span className="label">Password</span>
          <div className="value password">
            <span className="mono">
              {entry.type === 'password'
                ? showPassword
                  ? 'example-password'
                  : '••••••••••'
                : 'Not applicable'}
            </span>
            {entry.type === 'password' && (
              <>
                <button className="btn btn-ghost" onClick={onTogglePassword}>
                  {showPassword ? (
                    <>
                      <EyeOff size={16} strokeWidth={1.6} aria-hidden /> Hide
                    </>
                  ) : (
                    <>
                      <Eye size={16} strokeWidth={1.6} aria-hidden /> Reveal
                    </>
                  )}
                </button>
                <button className="btn btn-ghost" disabled aria-disabled="true">
                  <Copy size={16} strokeWidth={1.6} aria-hidden /> Copy
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  },
)
