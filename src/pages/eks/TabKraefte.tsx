import { useState } from 'react'
import { newId } from '../../lib/eks/ids'
import { FMS, type EksEventType, type EksState } from '../../lib/eks/types'
import { Feld, Overlay } from './TabAtemschutz'

const RED = '#600812'

export default function TabKraefte({ state, dispatch }: {
  state: EksState; dispatch: (t: EksEventType, p: any) => Promise<void>
}) {
  const [neu, setNeu] = useState(false)
  const kraefte = Object.values(state.kraefte).filter(k => !k.entfernt)
  const abschnitte = Object.values(state.abschnitte).filter(a => !a.entfernt)

  return (
    <div style={{ paddingBottom: 20 }}>
      <button onClick={() => setNeu(true)} style={{ ...b(RED, true), width: '100%', padding: 12, marginBottom: 14 }}>
        Einsatzmittel aufnehmen
      </button>

      {kraefte.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
          Noch keine Einsatzmittel erfasst.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {kraefte.map(k => {
          const fms = FMS[k.fms_status] || FMS[2]
          const abs = k.abschnitt_id ? state.abschnitte[k.abschnitt_id] : null
          return (
            <div key={k.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', borderLeft: `3px solid ${fms.farbe}`, padding: '11px 13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 15, color: 'var(--lbf-text)' }}>{k.funkrufname}</div>
                  <div style={{ fontStyle: 'italic', fontSize: 11.5, color: 'var(--warm-gray)' }}>
                    {[k.typ, k.besatzung ? `${k.besatzung} Kräfte` : null, abs?.name].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: fms.farbe, lineHeight: 1 }}>{k.fms_status}</div>
                  <div style={{ fontSize: 9, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</div>
                </div>
                <button onClick={() => { if (confirm(`${k.funkrufname} entfernen?`)) dispatch('kraft.remove', { id: k.id }) }}
                  style={{ background: 'none', border: 'none', color: 'var(--warm-gray)', cursor: 'pointer', padding: 4, lineHeight: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div style={{ fontSize: 11.5, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 4 }}>{fms.lang}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <button key={s} onClick={() => dispatch('kraft.status', { id: k.id, fms_status: s })} title={FMS[s].lang}
                    style={{
                      width: 34, height: 32, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 13,
                      border: k.fms_status === s ? 'none' : '1px solid rgba(96,8,18,0.15)',
                      background: k.fms_status === s ? FMS[s].farbe : 'transparent',
                      color: k.fms_status === s ? '#fff' : 'var(--warm-gray)',
                    }}>{s}</button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {neu && (
        <NeuModal abschnitte={abschnitte} onClose={() => setNeu(false)}
          onSave={async (p) => { await dispatch('kraft.set', { ...p, id: newId(), neu: true }); setNeu(false) }} />
      )}
    </div>
  )
}

function NeuModal({ abschnitte, onClose, onSave }: { abschnitte: any[]; onClose: () => void; onSave: (p: any) => void }) {
  const [funkrufname, setFunk] = useState('')
  const [typ, setTyp] = useState('')
  const [besatzung, setBes] = useState(6)
  const [abschnitt_id, setAbs] = useState('')
  return (
    <Overlay titel="Einsatzmittel aufnehmen" onClose={onClose}>
      <Feld label="Funkrufname"><input value={funkrufname} onChange={e => setFunk(e.target.value)} placeholder="z.B. HLF 20/1" className="eks-input" autoFocus /></Feld>
      <Feld label="Typ"><input value={typ} onChange={e => setTyp(e.target.value)} placeholder="HLF, DLK, ELW …" className="eks-input" /></Feld>
      <Feld label="Besatzung"><input type="number" min={0} value={besatzung} onChange={e => setBes(Number(e.target.value))} className="eks-input" /></Feld>
      {abschnitte.length > 0 && (
        <Feld label="Einsatzabschnitt">
          <select value={abschnitt_id} onChange={e => setAbs(e.target.value)} className="eks-input">
            <option value="">—</option>{abschnitte.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Feld>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose} style={b('var(--warm-gray)')}>Abbrechen</button>
        <button disabled={!funkrufname.trim()} onClick={() => onSave({ funkrufname: funkrufname.trim(), typ, besatzung, abschnitt_id: abschnitt_id || undefined })}
          style={{ ...b(RED, true), opacity: funkrufname.trim() ? 1 : 0.5 }}>Aufnehmen</button>
      </div>
    </Overlay>
  )
}

function b(farbe: string, voll = false): React.CSSProperties {
  return {
    border: voll ? 'none' : `1px solid ${farbe}44`, background: voll ? farbe : 'transparent',
    color: voll ? '#fff' : farbe, borderRadius: 9, padding: '7px 12px',
    fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
  }
}
