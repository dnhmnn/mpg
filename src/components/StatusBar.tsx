import type { User } from '../types'

interface StatusBarProps {
  user: User | null
  onLogout: () => void
}

export default function StatusBar({ user, onLogout }: StatusBarProps) {
  const userName = user?.name || user?.email?.split('@')[0] || '—'

  return (
    <div className="status-bar">
      <div className="logo">
        <svg width="120" height="32" viewBox="0 0 560 140">
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#c8102e', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#8b0000', stopOpacity: 0.9 }} />
            </linearGradient>
          </defs>
          <rect x="20" y="20" width="100" height="100" rx="26" fill="rgba(200,16,46,0.25)"/>
          <path d="M45 42 L45 98 L60 98 L60 78 L72 78 L83 98 L100 98 L87 77 Q92 74 92 63 Q92 42 75 42 Z M60 52 L72 52 Q77 52 77 62 Q77 72 72 72 L60 72 Z" fill="white"/>
          <text x="140" y="80" fontFamily="Inter, sans-serif" fontSize="46" fontWeight="600" fill="white" letterSpacing="0">Responda</text>
        </svg>
      </div>
      <div className="user-name">{userName}</div>
      <button className="logout-btn" onClick={onLogout}>
        Abmelden
      </button>
    </div>
  )
}
