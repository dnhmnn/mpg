import { Link } from 'react-router-dom'
import { useState } from 'react'
import type { User } from '../types'

interface StatusBarProps {
  user: User | null
  onLogout: () => void
  showBackButton?: boolean
  onBackClick?: () => void
  pageName?: string
  showHubLink?: boolean
}

export default function StatusBar({ user, onLogout, showBackButton, onBackClick, pageName, showHubLink }: StatusBarProps) {
  const userName = user?.name || user?.email?.split('@')[0] || '—'
  const [logoError, setLogoError] = useState(false)

  return (
    <div className="status-bar">
      {showBackButton ? (
        <button className="back-button" onClick={onBackClick}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Zurück
        </button>
      ) : (
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!logoError && (
            <img
              src="/logo.png"
              alt="Logo"
              onError={() => setLogoError(true)}
              style={{ height: 34, width: 34, objectFit: 'contain', flexShrink: 0 }}
            />
          )}
          <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em', color: '#1a0e08' }}>
            Responda
          </span>
        </div>
      )}
      <div className="user-name">{pageName || userName}</div>
      {showHubLink ? (
        <Link to="/hub" className="logout-btn">
          Hub
        </Link>
      ) : (
        <button className="logout-btn" onClick={onLogout}>
          Abmelden
        </button>
      )}
    </div>
  )
}
