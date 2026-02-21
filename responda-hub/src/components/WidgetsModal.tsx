import Modal from './Modal'

interface WidgetsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function WidgetsModal({ isOpen, onClose }: WidgetsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Widgets anpassen">
      <div style={{ display: 'grid', gap: '12px' }}>
        <div style={{
          background: '#f8f8f8',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          padding: '16px',
          cursor: 'pointer'
        }}>
          <div style={{ fontWeight: 600, color: '#1a1a1a', marginBottom: '4px' }}>
            Datum & Uhrzeit
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>
            Zeigt aktuelles Datum und Wochentag
          </div>
        </div>
        
        <div style={{
          background: '#f8f8f8',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          padding: '16px',
          cursor: 'pointer'
        }}>
          <div style={{ fontWeight: 600, color: '#1a1a1a', marginBottom: '4px' }}>
            Organisation
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>
            Logo und Name der Organisation
          </div>
        </div>

        <div style={{
          background: '#f8f8f8',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          padding: '16px',
          cursor: 'pointer'
        }}>
          <div style={{ fontWeight: 600, color: '#1a1a1a', marginBottom: '4px' }}>
            Neuigkeiten
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>
            Aktuelle Meldungen und Updates
          </div>
        </div>
      </div>
    </Modal>
  )
}
