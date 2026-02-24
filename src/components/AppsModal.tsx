import AppIcon from './AppIcon'
import Modal from './Modal'
import type { App } from '../types'

interface AppsModalProps {
  isOpen: boolean
  onClose: () => void
  availableApps: App[]
  onAddApp: (id: string) => void
}

export default function AppsModal({ isOpen, onClose, availableApps, onAddApp }: AppsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Apps verwalten">
      {availableApps.length === 0 ? (
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#999', padding: '40px 20px' }}>
          Alle Apps sind bereits hinzugefügt
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px 16px' }}>
          {availableApps.map((app) => (
            <div 
              key={app.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
              onClick={() => {
                onAddApp(app.id)
                onClose()
              }}
            >
              <div style={{
                width: '60px',
                height: '60px',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                position: 'relative'
              }}>
                <AppIcon icon={app.icon} />
                <div style={{
                  content: '+',
                  position: 'absolute',
                  bottom: '-4px',
                  right: '-4px',
                  width: '18px',
                  height: '18px',
                  background: '#34c759',
                  border: '2px solid #fff',
                  borderRadius: '50%',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  +
                </div>
              </div>
              <div style={{
                fontSize: '11px',
                fontWeight: 500,
                color: '#1a1a1a',
                textAlign: 'center',
                maxWidth: '65px'
              }}>
                {app.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
