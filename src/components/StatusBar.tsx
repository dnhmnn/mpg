import type { User } from '../types'

interface StatusBarProps {
  user: User | null
  onLogout: () => void
}

export default function StatusBar({ user, onLogout }: StatusBarProps) {
  const userName = user?.name || user?.email?.split('@')[0] || '—'

  return (
    <div className="status-bar">
      <div className="logo-container">
        <div className="logo-icon">
          <div className="logo-plus"></div>
        </div>
        <div className="logo-text">Responda</div>
      </div>
      <div className="user-name">{userName}</div>
      <button className="logout-btn" onClick={onLogout}>
        Abmelden
      </button>
    </div>
  )
}
