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
          <svg width="140" height="32" viewBox="0 0 140 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="4" width="24" height="24" rx="6" fill="#1e3a8a"/>
            <path d="M 8 10 L 8 22 M 8 10 L 15 10 Q 18 10 18 13 Q 18 15 16 16 M 15 16 L 20 22" 
                  stroke="#dc2626" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  fill="none"/>
            <text x="31" y="22" fill="#1d1d1f" fontSize="18" fontWeight="800" fontFamily="Atkinson Hyperlegible, sans-serif">Responda</text>
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
