import { useRef } from 'react'
import SigCanvas from './SigCanvas'
import type { NachForm } from './types'

interface Props {
  form: NachForm
  setN: (key: keyof NachForm, value: string) => void
  onClose: () => void
  onSave: (sig: string) => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, opacity: 0.6, marginBottom: '4px' }}>{label}</label>
      {children}
    </div>
  )
}

function Inp({ value, onChange, type = 'text', placeholder = '' }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
  )
}

function YesNo({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: '16px' }}>
      {['ja', 'nein'].map(v => (
        <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', cursor: 'pointer' }}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} /> {v}
        </label>
      ))}
    </div>
  )
}

function Row2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>{children}</div>
}

export default function NachModal({ form, setN, onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function clear() {
    canvasRef.current?.getContext('2d')?.clearRect(0, 0, 500, 150)
  }

  function submit() {
    if (!form.stichwort.trim()) { alert('Bitte Stichwort eingeben'); return }
    const sig = canvasRef.current?.toDataURL() || ''
    onSave(sig)
    clear()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', borderRadius: '18px 18px 0 0', width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '17px' }}>Nacherfassung</h3>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 8px' }}>

          <Row2>
            <Field label="Alarmzeit"><Inp value={form.datum_alarmzeit} onChange={v => setN('datum_alarmzeit', v)} type="datetime-local" /></Field>
            <Field label="Einsatzende"><Inp value={form.datum_einsatzende} onChange={v => setN('datum_einsatzende', v)} type="datetime-local" /></Field>
          </Row2>
          <Row2>
            <Field label="Stichwort *"><Inp value={form.stichwort} onChange={v => setN('stichwort', v)} /></Field>
            <Field label="Kategorie"><Inp value={form.kategorie} onChange={v => setN('kategorie', v)} /></Field>
          </Row2>
          <Row2>
            <Field label="Einsatznummer ILS"><Inp value={form.einsatznummer_ils} onChange={v => setN('einsatznummer_ils', v)} /></Field>
            <Field label="Adresse"><Inp value={form.adresse} onChange={v => setN('adresse', v)} /></Field>
          </Row2>
          <Field label="Meldebild">
            <textarea value={form.meldebild} onChange={e => setN('meldebild', e.target.value)} rows={2}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
          </Field>
          <Row2>
            <Field label="Disponierte EM/FW"><Inp value={form.disponierte_em_fw} onChange={v => setN('disponierte_em_fw', v)} /></Field>
            <Field label="Disponierte EM/RD"><Inp value={form.disponierte_em_rd} onChange={v => setN('disponierte_em_rd', v)} /></Field>
          </Row2>

          <Field label="Patientendaten erhoben?">
            <YesNo name="pat_daten" value={form.patienten_daten_erhoben} onChange={v => setN('patienten_daten_erhoben', v)} />
          </Field>
          {form.patienten_daten_erhoben === 'ja' && (
            <Row2>
              <Field label="Patient Name"><Inp value={form.patient_name} onChange={v => setN('patient_name', v)} /></Field>
              <Field label="Alter / Geburtsdatum"><Inp value={form.patient_alter_geburtsdatum} onChange={v => setN('patient_alter_geburtsdatum', v)} /></Field>
              <Field label="Pat.-Nr. ILS"><Inp value={form.patient_nummer_ils} onChange={v => setN('patient_nummer_ils', v)} /></Field>
            </Row2>
          )}

          <Field label="Sachverhalt">
            <textarea value={form.sachverhalt} onChange={e => setN('sachverhalt', e.target.value)} rows={3}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
          </Field>

          <Field label="Protokollpflichtig (§630f BGB)?">
            <YesNo name="protokoll" value={form.protokollpflichtig} onChange={v => setN('protokollpflichtig', v)} />
          </Field>
          {form.protokollpflichtig === 'ja' && (
            <Field label="Begründung">
              <textarea value={form.protokollpflichtig_begruendung} onChange={e => setN('protokollpflichtig_begruendung', e.target.value)} rows={2}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }} />
            </Field>
          )}

          <Field label="Verantwortliche Person unterwiesen?">
            <YesNo name="unterwiesen" value={form.verantwortlicher_unterwiesen} onChange={v => setN('verantwortlicher_unterwiesen', v)} />
          </Field>
          <Row2>
            <Field label="Verantw. Name"><Inp value={form.verantwortlicher_name} onChange={v => setN('verantwortlicher_name', v)} /></Field>
            <Field label="Verantw. Qualifikation"><Inp value={form.verantwortlicher_qualifikation} onChange={v => setN('verantwortlicher_qualifikation', v)} /></Field>
          </Row2>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>Nacherfasst von</div>
            <Row2>
              <Field label="Name"><Inp value={form.nacherfasst_von_name} onChange={v => setN('nacherfasst_von_name', v)} /></Field>
              <Field label="Qualifikation"><Inp value={form.nacherfasst_von_qualifikation} onChange={v => setN('nacherfasst_von_qualifikation', v)} /></Field>
            </Row2>
            <Field label="Unterschrift">
              <SigCanvas canvasRef={canvasRef} />
              <button onClick={clear} style={{ marginTop: '6px', fontSize: '13px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Löschen</button>
            </Field>
          </div>

        </div>
        <div style={{ display: 'flex', gap: '10px', padding: '12px 20px calc(16px + env(safe-area-inset-bottom))', flexShrink: 0, background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--bg-secondary)', color: 'var(--text)', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>Abbrechen</button>
          <button onClick={submit} style={{ flex: 1, padding: '12px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>Speichern</button>
        </div>
      </div>
    </div>
  )
}
