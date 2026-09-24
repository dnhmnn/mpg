import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { useOrg } from './OrgPublicLayout'
import { PubHeader, inp, ta, field, lbl } from './pubStyles'
import { diktatAuswerten, FELDNAME, einheit } from '../../lib/diktat'
import type { Diktatergebnis } from '../../lib/diktat'

// Schnelldokumentation — für die Hand, die nicht frei ist.
//
// Der Unterschied zur vollen Doku ist nicht der Umfang, sondern die Reihenfolge:
// Hier wird zuerst GESPROCHEN und danach bestätigt. Die volle Doku fragt Feld
// für Feld ab; das geht am Patienten nicht.
//
// ZUR SPRACHEINGABE: Absichtlich KEINE Web-Speech-Schnittstelle. Die schickt
// den Ton bei Safari an Apple und bei Chrome an Google — gesprochene
// Patientenangaben an einen Dritten. Stattdessen ein gewöhnliches Textfeld
// und die Diktattaste der Tastatur: die läuft auf neueren iPhones auf dem
// Gerät, braucht keine Berechtigung und verlässt es nicht.
//
// DAS DIKTAT SCHLÄGT VOR, DER MENSCH BESTÄTIGT. Erkannte Messwerte erscheinen
// als Vorschlag und werden erst durch Antippen übernommen. Der gesprochene
// Wortlaut wandert IMMER unverändert ins Protokoll — auch wenn die Auswertung
// danebenliegt, steht die Quelle noch da.

const VITAL = ['rr_sys', 'rr_dia', 'hf', 'spo2', 'af', 'temp', 'bz', 'schmerz'] as const
type VitalFeld = typeof VITAL[number]

export default function OrgSchnelldoku() {
  const { org, orgCode } = useOrg()
  const navigate = useNavigate()

  const [gesprochen, setGesprochen] = useState('')
  const [vitals, setVitals] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [vorname, setVorname] = useState('')
  const [gebdatum, setGebdatum] = useState('')
  const [unbekannt, setUnbekannt] = useState(false)
  const [ziel, setZiel] = useState('')
  const [ersteller, setErsteller] = useState('')
  const [sendet, setSendet] = useState(false)
  const [fertig, setFertig] = useState('')
  const diktatRef = useRef<HTMLTextAreaElement>(null)

  // Bei jeder Änderung neu auswerten — aber nichts von selbst übernehmen.
  const ergebnis: Diktatergebnis = useMemo(
    () => diktatAuswerten(gesprochen, vitals), [gesprochen, vitals])

  const offeneVorschlaege = ergebnis.werte.filter(v => !vitals[v.feld])

  function uebernehmen(feld: string, wert: string) {
    setVitals(v => ({ ...v, [feld]: wert }))
  }
  function alleUebernehmen() {
    setVitals(v => {
      const n = { ...v }
      for (const x of ergebnis.werte) if (!n[x.feld]) n[x.feld] = x.wert
      return n
    })
  }

  async function absenden() {
    if (!unbekannt && !name.trim()) { alert('Bitte Namen angeben oder „Patient unbekannt" ankreuzen.'); return }
    if (!gesprochen.trim()) { alert('Bitte zuerst das Geschehen diktieren oder eintippen.'); return }
    setSendet(true)
    try {
      const jetzt = new Date()
      const zeit = jetzt.toTimeString().slice(0, 5)

      // Dieselben Feldnamen wie die volle Doku — damit ein Schnellprotokoll
      // später dort geöffnet und ergänzt werden kann, statt daneben zu liegen.
      const payload: Record<string, unknown> = {
        schnelldoku: true,
        name: unbekannt ? 'unbekannt' : name.trim(),
        vorname: unbekannt ? '' : vorname.trim(),
        gebdatum: unbekannt ? '' : gebdatum,
        notfallgeschehen: gesprochen.trim(),
        verlaufsbeschreibung: gesprochen.trim(),
        uebergabe_ziel: ziel.trim(),
        transport_ziel: ziel.trim(),
        ausfueller_name: ersteller.trim(),
        ausfueller_zeit: jetzt.toISOString(),
        verlauf: [{ zeit, ...vitals }],
        // Was das Diktat nicht übernehmen konnte, bleibt sichtbar — sonst
        // verschwindet es zwischen Erfassung und Protokoll.
        diktat_verworfen: ergebnis.verworfen.map(v => `${FELDNAME[v.feld] || v.feld}: „${v.quelle}" — ${v.grund}`),
      }

      const rec = await pb.collection('patients').create({
        title: `Schnelldoku: ${payload.vorname || ''} ${payload.name}`.trim(),
        payload,
        status: 'offen',
        organization_id: org.id,
      })
      setFertig(`SD-${jetzt.getFullYear()}-${rec.id.slice(0, 8)}`)
    } catch (e) {
      alert('Fehler beim Speichern: ' + ((e as Error).message || 'unbekannt'))
    } finally { setSendet(false) }
  }

  if (fertig) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--warm-bg)' }}>
        <PubHeader title="Schnelldokumentation" onBack={() => navigate(`/${orgCode}`)} />
        <div style={{ padding: 20, maxWidth: 560, margin: '0 auto' }}>
          <div style={{ background: '#fff', borderRadius: 12, borderLeft: '3px solid #16a34a', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '18px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#16a34a' }}>Gespeichert</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontStyle: 'italic', color: '#600812', marginTop: 6 }}>{fertig}</div>
            <p style={{ color: 'var(--warm-gray)', fontSize: 13, marginTop: 10, marginBottom: 0 }}>
              Das Protokoll liegt als offener Vorgang bereit und kann in der vollständigen
              Dokumentation ergänzt werden.
            </p>
          </div>
          <button onClick={() => { setFertig(''); setGesprochen(''); setVitals({}); setName(''); setVorname(''); setGebdatum(''); setUnbekannt(false); setZiel('') }}
            style={{ width: '100%', marginTop: 16, background: '#600812', color: '#fde8d8', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Nächstes Protokoll
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-bg)' }}>
      <PubHeader title="Schnelldokumentation" onBack={() => navigate(`/${orgCode}`)} />
      <div style={{ padding: 20, maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>

        {/* Diktat zuerst — das ist der Kern dieser Seite */}
        <div style={field}>
          <label style={lbl} htmlFor="diktat">Was ist passiert</label>
          <textarea id="diktat" ref={diktatRef} value={gesprochen}
            onChange={e => setGesprochen(e.target.value)}
            placeholder={'Diktiertaste der Tastatur drücken und sprechen — z. B. \u201EPatient klagt über Druck auf der Brust, RR 120 zu 80, Puls 88, Sättigung 96\u201C.'}
            style={{ ...ta, minHeight: 150, fontSize: 16 }} />
          <div style={{ color: 'var(--warm-gray)', fontSize: 12, marginTop: 6, fontStyle: 'italic' }}>
            Der Wortlaut wird unverändert ins Protokoll übernommen.
          </div>
        </div>

        {/* Erkannte Werte — Vorschlag, nicht Übernahme */}
        {offeneVorschlaege.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, borderLeft: '3px solid #600812', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '14px 16px', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <div style={{ ...lbl, marginBottom: 0, flex: 1 }}>Erkannt — zum Übernehmen antippen</div>
              <button onClick={alleUebernehmen}
                style={{ background: 'none', border: 'none', padding: 0, color: '#600812', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Alle
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {offeneVorschlaege.map(v => (
                <button key={v.feld} onClick={() => uebernehmen(v.feld, v.wert)}
                  style={{ background: '#fff', border: '1.5px solid rgba(96,8,18,0.25)', borderRadius: 999, padding: '9px 14px', fontSize: 14, color: '#1a0e08' }}>
                  <span style={{ color: 'var(--warm-gray)' }}>{FELDNAME[v.feld]}</span>{' '}
                  <strong style={{ fontWeight: 700 }}>{v.wert}</strong>{' '}
                  <span style={{ color: 'var(--warm-gray)', fontSize: 12 }}>{einheit(v.feld)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Was nicht übernommen wurde — sichtbar, nicht verschluckt */}
        {ergebnis.verworfen.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, borderLeft: '3px solid #d97706', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '14px 16px', marginBottom: '1rem' }}>
            <div style={{ ...lbl, color: '#d97706' }}>Nicht übernommen</div>
            {ergebnis.verworfen.map((v, i) => (
              <div key={i} style={{ fontSize: 13, marginTop: 6, color: '#1a0e08' }}>
                <span style={{ fontStyle: 'italic' }}>„{v.quelle}"</span>
                <span style={{ color: 'var(--warm-gray)' }}> — {v.grund}</span>
              </div>
            ))}
          </div>
        )}

        {/* Vitalwerte — nur die, die gesetzt sind, plus Nachtragen von Hand */}
        <div style={field}>
          <div style={lbl}>Vitalwerte</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 6 }}>
            {VITAL.map(f => (
              <label key={f} style={{ display: 'block' }}>
                <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{FELDNAME[f]} {einheit(f) && `(${einheit(f)})`}</span>
                <input value={vitals[f] || ''} inputMode="decimal"
                  onChange={e => setVitals(v => ({ ...v, [f]: e.target.value }))}
                  style={{ ...inp, marginTop: 2, padding: '10px 12px' }} />
              </label>
            ))}
          </div>
        </div>

        {/* Patient — so wenig wie möglich */}
        <div style={field}>
          <div style={lbl}>Patient</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 14 }}>
            <input type="checkbox" checked={unbekannt} onChange={e => setUnbekannt(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: '#600812' }} />
            Patient unbekannt
          </label>
          {!unbekannt && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" style={{ ...inp, marginTop: 0 }} />
              <input value={vorname} onChange={e => setVorname(e.target.value)} placeholder="Vorname" style={{ ...inp, marginTop: 0 }} />
              <input value={gebdatum} onChange={e => setGebdatum(e.target.value)} placeholder="Geburtsdatum" type="date" style={{ ...inp, marginTop: 0, gridColumn: '1 / -1' }} />
            </div>
          )}
        </div>

        <div style={field}>
          <label style={lbl} htmlFor="ziel">Übergabe an</label>
          <input id="ziel" value={ziel} onChange={e => setZiel(e.target.value)} placeholder="Klinik oder Station" style={inp} />
        </div>

        <div style={field}>
          <label style={lbl} htmlFor="ersteller">Erfasst von</label>
          <input id="ersteller" value={ersteller} onChange={e => setErsteller(e.target.value)} placeholder="Name" style={inp} />
        </div>
      </div>

      {/* Absenden immer erreichbar, ohne Scrollen */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(250,249,247,0.95)', borderTop: '0.5px solid rgba(96,8,18,0.12)', padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <button onClick={absenden} disabled={sendet}
          style={{ width: '100%', maxWidth: 520, margin: '0 auto', display: 'block', background: '#600812', color: '#fde8d8', border: 'none', borderRadius: 10, padding: '15px 0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: sendet ? 0.6 : 1 }}>
          {sendet ? 'Wird gespeichert …' : 'Protokoll speichern'}
        </button>
      </div>
    </div>
  )
}
