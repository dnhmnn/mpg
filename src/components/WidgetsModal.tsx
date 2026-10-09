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
          background: 'var(--warm-bg)',
          border: '1px solid var(--lbf-border)',
          borderRadius: '12px',
          padding: '16px',
          cursor: 'pointer'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
            Datum & Uhrzeit
          </div>
          <div style={{ fontSize: '13px', color: 'var(--warm-gray)' }}>
            Zeigt aktuelles Datum und Wochentag
          </div>
        </div>
        
        <div style={{
          background: 'var(--warm-bg)',
          border: '1px solid var(--lbf-border)',
          borderRadius: '12px',
          padding: '16px',
          cursor: 'pointer'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
            Organisation
          </div>
          <div style={{ fontSize: '13px', color: 'var(--warm-gray)' }}>
            Logo und Name der Organisation
          </div>
        </div>

        <div style={{
          background: 'var(--warm-bg)',
          border: '1px solid var(--lbf-border)',
          borderRadius: '12px',
          padding: '16px',
          cursor: 'pointer'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
            Neuigkeiten
          </div>
          <div style={{ fontSize: '13px', color: 'var(--warm-gray)' }}>
            Aktuelle Meldungen und Updates
          </div>
        </div>
      </div>
    </Modal>
  )
}
