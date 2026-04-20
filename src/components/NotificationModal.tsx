interface NotificationModalProps {
  isOpen: boolean
  type: 'info' | 'warning' | 'success' | 'update'
  title: string
  message: string
  onDismiss: () => void
  onRemindLater: () => void
}

export default function NotificationModal({
  isOpen,
  type,
  title,
  message,
  onDismiss,
  onRemindLater
}: NotificationModalProps) {
  if (!isOpen) return null

  const accentMap = {
    info:    '#3b82f6',
    warning: '#f59e0b',
    success: '#10b981',
    update:  '#8b5cf6'
  }

  const iconMap = {
    info:    'ℹ️',
    warning: '⚠️',
    success: '✅',
    update:  '🔔'
  }

  const accent = accentMap[type]

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(24px + env(safe-area-inset-bottom))',
        right: '16px',
        zIndex: 10000,
        maxWidth: '340px',
        width: 'calc(100vw - 32px)',
        animation: 'slideInRight 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
    >
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(60px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          padding: '16px',
          borderLeft: `4px solid ${accent}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
          <span style={{ fontSize: '22px', lineHeight: 1 }}>{iconMap[type]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>
              {title}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {message}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onDismiss}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              background: accent,
              color: '#fff'
            }}
          >
            Verstanden
          </button>
          <button
            onClick={onRemindLater}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: `1px solid ${accent}`,
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              background: 'transparent',
              color: accent
            }}
          >
            Später
          </button>
        </div>
      </div>
    </div>
  )
}
