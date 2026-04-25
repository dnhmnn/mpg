import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { useOrg } from './OrgPublicLayout'
import { PubHeader, PubWrap, PubSendBar, PubSection, field, inp, sel, ta } from './pubStyles'

const today = () => new Date().toISOString().slice(0, 10)

export default function OrgCirs() {
  const { org, orgCode } = useOrg()
  const navigate = useNavigate()
  const [f, setF] = useState({ datum: today(), ort: '', kategorie: '', schwere: '', was: '', warum: '', folgen: '', vorschlag: '', melder_name: '', melder_kontakt: '' })
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }))

  async function submit() {
    if (!f.datum || !f.ort || !f.kategorie || !f.schwere || !f.was) { alert('Bitte alle Pflichtfelder ausfüllen.'); return }
    setSending(true)
    try {
      const deDate = f.datum.split('-').reverse().join('.')
      await pb.collection('cirs_reports').create({ title: `CIRS: ${f.kategorie} (${deDate})`, payload: f, status: 'offen', organization_id: org.id })
      setSuccess(true)
    } catch (e: any) { alert('Fehler: ' + e.message) }
    finally { setSending(false) }
  }

  if (success) return (
    <PubWrap>
      <div style={{ background: '#dcfce7', border: '2px solid #16a34a', borderRadius: 12, padding: 24, textAlign: 'center', maxWidth: 480, margin: '2rem auto' }}>
        <div style={{ fontSize: '3rem' }}>✅</div>
        <h2 style={{ color: '#15803d', margin: '.5rem 0' }}>Erfolgreich gemeldet!</h2>
        <p style={{ color: '#166534', margin: '0 0 1.5rem' }}>Danke für deinen Beitrag zur Sicherheit.</p>
        <button style={btn} onClick={() => { setF({ datum: today(), ort: '', kategorie: '', schwere: '', was: '', warum: '', folgen: '', vorschlag: '', melder_name: '', melder_kontakt: '' }); setSuccess(false) }}>+ Neue Meldung</button>
      </div>
    </PubWrap>
  )

  return <>
    <PubHeader title={`CIRS-Meldung – ${org.org_name}`} onBack={() => navigate(`/${orgCode}`)} />
    <PubWrap>
      <div style={{ background: '#dbeafe', border: '2px solid #93c5fd', borderRadius: 12, padding: '1rem', marginBottom: '1rem', color: '#1e40af', fontSize: '.95rem' }}>
        <strong>ℹ️ Was ist CIRS?</strong><br />Anonyme Meldung kritischer Ereignisse zur Verbesserung der Sicherheit.
      </div>
      <PubSection title="📅 Ereignis" open>
        <div style={field}><label style={lbl}>Datum *<input style={inp} type="date" value={f.datum} onChange={set('datum')} /></label></div>
        <div style={field}><label style={lbl}>Ort *<input style={inp} type="text" placeholder="z.B. Fahrzeughalle" value={f.ort} onChange={set('ort')} /></label></div>
        <div style={field}><label style={lbl}>Kategorie *
          <select style={sel} value={f.kategorie} onChange={set('kategorie')}>
            <option value="">Bitte wählen…</option>
            {['personal','kommunikation','material','fahrzeug','einsatz','organisation','sonstiges'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
          </select></label></div>
        <div style={field}><label style={lbl}>Schweregrad *
          <select style={sel} value={f.schwere} onChange={set('schwere')}>
            <option value="">Bitte wählen…</option>
            <option value="gering">Gering (keine Gefährdung)</option>
            <option value="mittel">Mittel (potenzielle Gefährdung)</option>
            <option value="hoch">Hoch (ernste Gefährdung)</option>
          </select></label></div>
      </PubSection>
      <PubSection title="📄 Beschreibung" open>
        <div style={field}><label style={lbl}>Was ist passiert? *<textarea style={ta} placeholder="Schildere das Ereignis sachlich…" value={f.was} onChange={set('was')} /></label></div>
        <div style={field}><label style={lbl}>Warum ist es passiert?<textarea style={ta} value={f.warum} onChange={set('warum')} /></label></div>
        <div style={field}><label style={lbl}>Folgen<textarea style={ta} value={f.folgen} onChange={set('folgen')} /></label></div>
      </PubSection>
      <PubSection title="💡 Verbesserungsvorschläge" open>
        <div style={field}><label style={lbl}>Wie verhindern?<textarea style={ta} value={f.vorschlag} onChange={set('vorschlag')} /></label></div>
      </PubSection>
      <PubSection title="🕵️ Melder (optional)">
        <div style={field}><label style={lbl}>Name (optional)<input style={inp} type="text" value={f.melder_name} onChange={set('melder_name')} /></label></div>
        <div style={field}><label style={lbl}>Kontakt (optional)<input style={inp} type="text" value={f.melder_kontakt} onChange={set('melder_kontakt')} /></label></div>
      </PubSection>
    </PubWrap>
    <PubSendBar onSubmit={submit} sending={sending} label="Meldung absenden" />
  </>
}

const lbl: React.CSSProperties = { display: 'block', fontWeight: 700, color: '#111827', fontSize: '.92rem' }
const btn: React.CSSProperties = { background: '#c8102e', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }
