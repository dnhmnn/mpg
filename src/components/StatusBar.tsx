import { Link } from 'react-router-dom'
import type { User } from '../types'

interface StatusBarProps {
  user: User | null
  onLogout: () => void
  showBackButton?: boolean
  onBackClick?: () => void
  pageName?: string
  showHubLink?: boolean
  orgName?: string
}

export default function StatusBar({ user, onLogout, showBackButton, onBackClick, pageName, showHubLink, orgName }: StatusBarProps) {
  const displayName = user?.name || user?.email?.split('@')[0] || '—'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      height: 'calc(60px + env(safe-area-inset-top))',
      paddingTop: 'env(safe-area-inset-top)',
      background: '#fff',
      borderBottom: '0.5px solid rgba(96,8,18,0.12)',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 'max(16px, env(safe-area-inset-left))',
      paddingRight: 'max(16px, env(safe-area-inset-right))',
      gap: 8,
    }}>
      {/* Left */}
      <div style={{ width: 60, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {showBackButton ? (
          <button
            onClick={onBackClick}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              color: '#600812', fontWeight: 700, fontSize: 14,
              padding: '6px 0',
            }}
          >
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="#600812" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="7 1 1 7 7 13"/>
            </svg>
            Zurück
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#600812',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Center */}
      <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
        {pageName && (
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a0e08', letterSpacing: '-0.01em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {pageName}
          </div>
        )}
        {orgName && (
          <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {orgName}
          </div>
        )}
        {!pageName && !orgName && (
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a0e08', letterSpacing: '-0.01em' }}>
            Responda
          </div>
        )}
      </div>

      {/* Right */}
      <div style={{ width: 60, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
        {showHubLink ? (
          <Link
            to="/hub"
            style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '1.5px solid #600812',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#600812', fontStyle: 'italic', fontWeight: 700, fontSize: 15,
              textDecoration: 'none',
              background: 'rgba(96,8,18,0.04)',
            }}
            title="Hub"
          >
            {initial}
          </Link>
        ) : (
          <button
            onClick={onLogout}
            style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '1.5px solid #600812',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#600812', fontStyle: 'italic', fontWeight: 700, fontSize: 15,
              background: 'rgba(96,8,18,0.04)',
              cursor: 'pointer',
            }}
            title="Abmelden"
          >
            {initial}
          </button>
        )}
      </div>
    </div>
  )
}
