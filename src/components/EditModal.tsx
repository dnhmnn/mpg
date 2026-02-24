import Modal from './Modal'

interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  onEditApps: () => void
  onEditWidgets: () => void
}

export default function EditModal({ isOpen, onClose, onEditApps, onEditWidgets }: EditModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Hub bearbeiten">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button 
          style={{
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '15px',
            color: '#1a1a1a',
            fontWeight: 500
          }}
          onClick={() => {
            onClose()
            onEditApps()
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}>
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
              </svg>
            </div>
            <span>Apps verwalten</span>
          </div>
          <span style={{ color: '#999', fontSize: '18px' }}>›</span>
        </button>

        <button 
          style={{
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '15px',
            color: '#1a1a1a',
            fontWeight: 500
          }}
          onClick={() => {
            onClose()
            onEditWidgets()
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}>
                <rect x="3" y="3" width="7" height="9"/>
                <rect x="14" y="3" width="7" height="5"/>
                <rect x="14" y="12" width="7" height="9"/>
                <rect x="3" y="16" width="7" height="5"/>
              </svg>
            </div>
            <span>Widgets anpassen</span>
          </div>
          <span style={{ color: '#999', fontSize: '18px' }}>›</span>
        </button>
      </div>
    </Modal>
  )
}
