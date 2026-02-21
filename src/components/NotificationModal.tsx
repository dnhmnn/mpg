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

  const iconMap = {
    info: 'ℹ️',
    warning: '⚠️',
    success: '✅',
    update: '🔔'
  }

  const iconStyles: Record<typeof type, string> = {
    info: 'linear-gradient(135deg, #3b82f6, #1e40af)',
    warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
    success: 'linear-gradient(135deg, #10b981, #059669)',
    update: 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
  }

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        animation: 'fadeIn 0.3s ease-out'
      }}
      onClick={onDismiss}
    >
      <div 
        style={{
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(40px)',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          border: '0.5px solid rgba(255, 255, 255, 0.3)',
          animation: 'slideUpNotif 0.4s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: '32px',
          background: iconStyles[type]
        }}>
          {iconMap[type]}
        </div>
        
        <div style={{
          fontSize: '24px',
          fontWeight: 700,
          color: '#1a1a1a',
          textAlign: 'center',
          marginBottom: '16px'
        }}>
          {title}
        </div>
        
        <div style={{
          fontSize: '16px',
          lineHeight: 1.6,
          color: '#4b5563',
          textAlign: 'center',
          marginBottom: '28px',
          whiteSpace: 'pre-wrap'
        }}>
          {message}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            style={{
              padding: '14px 24px',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: '#fff'
            }}
            onClick={onDismiss}
          >
            Verstanden
          </button>
          
          <button 
            style={{
              padding: '14px 24px',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: 'rgba(255, 255, 255, 0.5)',
              color: '#667eea'
            }}
            onClick={onRemindLater}
          >
            Später erinnern
          </button>
        </div>
      </div>
    </div>
  )
}
