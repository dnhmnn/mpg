import { useRef } from 'react'
import SigCanvas from './SigCanvas'

interface Props {
  adminName: string
  setAdminName: (v: string) => void
  onClose: () => void
  onArchive: (sig: string) => void
}

export default function SignModal({ adminName, setAdminName, onClose, onArchive }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function clear() {
    canvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 150)
  }

  function submit() {
    if (!adminName.trim()) { alert('Bitte Namen eingeben'); return }
    const sig = canvasRef.current?.toDataURL() || ''
    onArchive(sig)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 1100 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', borderRadius: '18px 18px 0 0', width: '100%', padding: '20px 20px 0', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: '17px' }}>Gegenzeichnen & Archivieren</h3>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, opacity: 0.6, marginBottom: '4px' }}>MPG-Beauftragter Name</label>
          <input
            value={adminName}
            onChange={e => setAdminName(e.target.value)}
            placeholder="Vor- und Nachname"
            style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, opacity: 0.6, marginBottom: '4px' }}>Unterschrift</label>
          <SigCanvas canvasRef={canvasRef} />
          <button onClick={clear} style={{ marginTop: '6px', fontSize: '13px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Löschen</button>
        </div>

        <div style={{ display: 'flex', gap: '10px', padding: '12px 0 calc(16px + env(safe-area-inset-bottom))' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--bg-secondary)', color: 'var(--text)', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>Abbrechen</button>
          <button onClick={submit} style={{ flex: 1, padding: '12px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>Unterschreiben & Archivieren</button>
        </div>
      </div>
    </div>
  )
}
