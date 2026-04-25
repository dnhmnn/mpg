import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { useOrg } from './OrgPublicLayout'
import { PubHeader, PubWrap, PubSendBar, PubSection, field, inp, lbl } from './pubStyles'

const today = () => new Date().toISOString().slice(0, 10)
type Pos = { qty: number; name: string }

export default function OrgProduktausgabe() {
  const { org, orgCode } = useOrg()
  const navigate = useNavigate()
  const [einsatz, setEinsatz] = useState('')
  const [datum, setDatum] = useState(today())
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [positions, setPositions] = useState<Pos[]>([{ qty: 1, name: '' }])
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)

  const addPos = () => setPositions(p => [...p, { qty: 1, name: '' }])
  const delPos = (i: number) => setPositions(p => p.filter((_, j) => j !== i))
  const updPos = (i: number, k: keyof Pos, v: string | number) => setPositions(p => p.map((r, j) => j === i ? { ...r, [k]: v } : r))

  async function submit() {
    const filled = positions.filter(p => p.qty > 0 && p.name.trim())
    if (!einsatz || !datum || !filled.length || !vorname || !nachname) { alert('Bitte alle Pflichtfelder ausfüllen.'); return }
    setSending(true)
    try {
      const deDate = datum.split('-').reverse().join('.')
      await pb.collection('product_outputs').create({ title: `Produktausgabe ${einsatz} (${deDate})`, payload: { einsatz, datum, vorname, nachname, positionen: filled }, status: 'offen', organization_id: org.id })
      setSuccess(true)
    } catch (e: any) { alert('Fehler: ' + e.message) }
    finally { setSending(false) }
  }

  if (success) return (
    <PubWrap>
      <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 20, padding: 32, textAlign: 'center', maxWidth: 480, margin: '2rem auto', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ width: 56, height: 56, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.75rem' }}>✅</div>
        <h2 style={{ color: 'var(--text)', margin: '0 0 1.5rem', fontSize: '1.2rem' }}>Erfolgreich gespeichert!</h2>
        <button style={btn} onClick={() => { setEinsatz(''); setDatum(today()); setVorname(''); setNachname(''); setPositions([{ qty: 1, name: '' }]); setSuccess(false) }}>
          + Neue Ausgabe
        </button>
      </div>
    </PubWrap>
  )

  return <>
    <PubHeader title={`Produktausgabe – ${org.org_name}`} onBack={() => navigate(`/${orgCode}`)} />
    <PubWrap>
      <PubSection title="📋 Kopfdaten" open>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem' }}>
          <div style={field}><label style={lbl}>Einsatznummer *<input style={inp} type="text" placeholder="z.B. 2025-001" value={einsatz} onChange={e => setEinsatz(e.target.value)} /></label></div>
          <div style={field}><label style={lbl}>Datum *<input style={inp} type="date" value={datum} onChange={e => setDatum(e.target.value)} /></label></div>
        </div>
      </PubSection>

      <PubSection title="📦 Positionen" open>
        {positions.map((pos, i) => (
          <div key={i} style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.5rem', padding: '.75rem', background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', borderRadius: 10 }}>
            <input style={{ ...inp, width: 90, marginTop: 0 }} type="number" min={1} value={pos.qty} onChange={e => updPos(i, 'qty', Number(e.target.value))} placeholder="Anz." />
            <input style={{ ...inp, flex: 1, marginTop: 0 }} type="text" value={pos.name} onChange={e => updPos(i, 'name', e.target.value)} placeholder="Artikel / Beschreibung" />
            <button onClick={() => delPos(i)} style={{ width: 36, height: 36, borderRadius: 8, border: '0.5px solid var(--border-medium)', background: 'var(--bg-hover)', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0 }}>×</button>
          </div>
        ))}
        <button onClick={addPos} style={{ border: '0.5px solid var(--border-medium)', background: 'var(--bg-subtle)', padding: '.6rem .9rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600, color: 'var(--accent)', fontSize: '.9rem', fontFamily: 'inherit' }}>+ Position hinzufügen</button>
      </PubSection>

      <PubSection title="👤 Ausgetragen von" open>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem' }}>
          <div style={field}><label style={lbl}>Vorname *<input style={inp} type="text" value={vorname} onChange={e => setVorname(e.target.value)} /></label></div>
          <div style={field}><label style={lbl}>Nachname *<input style={inp} type="text" value={nachname} onChange={e => setNachname(e.target.value)} /></label></div>
        </div>
      </PubSection>
    </PubWrap>
    <PubSendBar onSubmit={submit} sending={sending} />
  </>
}

const btn: React.CSSProperties = { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit' }
