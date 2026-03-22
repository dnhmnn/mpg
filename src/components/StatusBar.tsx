import { Link } from 'react-router-dom'
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
        <div className="logo">
          <svg width="120" height="32" viewBox="0 0 560 140">
            <rect x="20" y="20" width="100" height="100" rx="26" fill="#1e3a8a" opacity="0.15"/>
            <path d="M45 42 L45 98 L60 98 L60 78 L72 78 L83 98 L100 98 L87 77 Q92 74 92 63 Q92 42 75 42 Z M60 52 L72 52 Q77 52 77 62 Q77 72 72 72 L60 72 Z" fill="#1e3a8a"/>
            <text x="140" y="80" fontFamily="Inter, sans-serif" fontSize="46" fontWeight="600" fill="#1d1d1f" letterSpacing="0">Responda</text>
          </svg>
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
