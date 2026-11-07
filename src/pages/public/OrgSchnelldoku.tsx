import { useEffect, useMemo, useRef, useState } from 'react'
import { mitFassung, NEUE_FASSUNG } from '../../lib/protokoll'
import { useNavigate } from 'react-router-dom'
import { useOrg } from './OrgPublicLayout'
import { PubHeader, inp, ta, field, lbl } from './pubStyles'
import { diktatAuswerten, FELDNAME, einheit } from '../../lib/diktat'
import type { Diktatergebnis } from '../../lib/diktat'
import { useFormularStand } from '../../lib/formular/stand'
import { neueKennung } from '../../lib/formular/api'
import { ablegenMitMeldung, sendenOderAblegen } from '../../lib/formular/versand'
import type { NeuerEintrag } from '../../lib/formular/warteschlange'
import AbsenderFeld, { AbmeldenNachSenden, Textknopf, absenderAngabe, sendeKnopfText, vorDemSenden } from './absender/AbsenderFeld'
import BesatzungNamen from './absender/BesatzungNamen'
import { warteschlangeMelden } from './absender/Warteschlange'
import { ABSENDER_TEXTE, modusAusStand } from './absender/texte'
import { KEINE_NAMEN, namenFelder, type Namen } from './doku/besatzung'

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
//
// ABSENDEN über den Server (Bauplan v2, 4.6): wer erfasst, bestätigt je nach
// Einstellung mit Passwort, angemeldet oder mit freiem Namen; der Server
// schreibt den Namen in `ausfueller_name` und verknüpft die Besatzung. Ohne
// Netz liegt das Protokoll in der Warteschlange des Geräts, ohne Passwort.

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
  /** Absender (früher „Erfasst von“); das Passwort lebt nur im Zustand. */
  const [ersteller, setErsteller] = useState('')
  const [passwort, setPasswort] = useState('')
  const [anderer, setAnderer] = useState(false)
  const [besatzung, setBesatzung] = useState<Namen>(KEINE_NAMEN)
  const [sendet, setSendet] = useState(false)
  const [fertig, setFertig] = useState('')
  /** Nach dem Ablegen ohne Netz: die Meldung statt der Nummer. */
  const [abgelegt, setAbgelegt] = useState('')
  const [meldung, setMeldung] = useState('')
  const [ablage, setAblage] = useState<{ e: NeuerEintrag; mitAnmeldung: boolean; sekunden?: number; text: string } | null>(null)
  /** Kennung des neuen Satzes: entsteht beim ersten Versuch, neu mit „Nächstes Protokoll“. */
  const kennungRef = useRef('')
  const diktatRef = useRef<HTMLTextAreaElement>(null)
  const { stand, alterServer } = useFormularStand(orgCode, { mitAnmeldung: !anderer, org })
  const modus = modusAusStand(stand, 'patienten')

  // Angemeldet erkannt und noch kein Name: einmal mit dem Kontonamen vorbelegen
  const vorbelegt = useRef(false)
  useEffect(() => {
    const n = stand?.angemeldet?.name?.trim()
    if (!n || anderer || vorbelegt.current) return
    vorbelegt.current = true
    setErsteller((a) => a.trim() ? a : n)
  }, [stand, anderer])

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

  /** Das Schnellprotokoll für Versand und Warteschlange (Absendername je nach Weg). */
  function eintragBauen(absenderName: string): NeuerEintrag {
    const jetzt = new Date()
    const zeit = jetzt.toTimeString().slice(0, 5)

    // Dieselben Feldnamen wie die volle Doku — damit ein Schnellprotokoll
    // später dort geöffnet und ergänzt werden kann, statt daneben zu liegen.
    const payload: Record<string, unknown> = mitFassung({
      schnelldoku: true,
      name: unbekannt ? 'unbekannt' : name.trim(),
      vorname: unbekannt ? '' : vorname.trim(),
      gebdatum: unbekannt ? '' : gebdatum,
      notfallgeschehen: gesprochen.trim(),
      verlaufsbeschreibung: gesprochen.trim(),
      uebergabe_ziel: ziel.trim(),
      transport_ziel: ziel.trim(),
      // Der Server ersetzt ihn durch den Kontonamen, wenn der Absender verknüpft ist
      ausfueller_name: ersteller.trim(),
      ausfueller_zeit: jetzt.toISOString(),
      // Die Besatzung als Namen; Kennungen setzt nur der Server
      ...namenFelder(besatzung),
      verlauf: [{ zeit, ...vitals }],
      // Was das Diktat nicht übernehmen konnte, bleibt sichtbar — sonst
      // verschwindet es zwischen Erfassung und Protokoll.
      diktat_verworfen: ergebnis.verworfen.map(v => `${FELDNAME[v.feld] || v.feld}: „${v.quelle}" — ${v.grund}`),
    // Dieselben Feldnamen heißen dieselbe Fassung: sonst gilt das
    // Schnellprotokoll als altes und wird im alten Bogen gezeigt, wo
    // keines seiner Felder vorkommt.
    }, NEUE_FASSUNG)

    const id = kennungRef.current || (kennungRef.current = neueKennung())
    return {
      id, formular: 'patienten', maske: 'schnell', orgCode, orgId: org.id,
      absenderName, angemeldetId: '',
      daten: { title: `Schnelldoku: ${payload.vorname || ''} ${payload.name}`.trim(), payload },
    }
  }

  /** Was vor dem Senden oder Ablegen am Protokoll fehlt (mit Hinweis), sonst true. */
  function vollstaendig(): boolean {
    if (!unbekannt && !name.trim()) { alert('Bitte Namen angeben oder „Patient unbekannt" ankreuzen.'); return false }
    if (!gesprochen.trim()) { alert('Bitte zuerst das Geschehen diktieren oder eintippen.'); return false }
    return true
  }

  async function absenden() {
    if (sendet) return
    if (!vollstaendig()) return
    setAblage(null)
    const online = navigator.onLine !== false
    const vorher = vorDemSenden({ stand, alterServer, formular: 'patienten', anderer, name: ersteller, passwort, online })
    if (vorher) { setMeldung(vorher); return }
    setMeldung('')
    setSendet(true)
    try {
      const jetzt = new Date()
      const angabe = absenderAngabe({ stand, formular: 'patienten', anderer, name: ersteller, passwort })
      // Das Passwort lebt nur in diesem Aufruf
      setPasswort('')
      const e = eintragBauen(angabe.mitAnmeldung ? (stand?.angemeldet?.name ?? '') : ersteller.trim())
      const r = await sendenOderAblegen(e, angabe, { modus })
      if (r.art === 'gesendet') {
        setFertig(`SD-${jetzt.getFullYear()}-${r.id.slice(0, 8)}`)
      } else if (r.art === 'abgelegt') {
        warteschlangeMelden()
        setAbgelegt(r.meldung)
      } else {
        setMeldung(r.meldung)
        if (r.art === 'fehler' && r.ablegenAnbieten) setAblage({ e, mitAnmeldung: angabe.mitAnmeldung, sekunden: r.sekunden, text: r.meldung })
      }
    } finally { setSendet(false) }
  }

  /** Modus Passwort, kein Passwort zur Hand: ohne Passwort ablegen (Befund Client-Abläufe 5). */
  function ohnePasswortAblegen() {
    if (sendet || !vollstaendig()) return
    setAblage(null)
    if (!ersteller.trim()) { setMeldung('Bitte einen Namen eintragen.'); return }
    setPasswort('')
    const r = ablegenMitMeldung(eintragBauen(ersteller.trim()), { modus, mitAnmeldung: false, anlass: 'ohne_passwort' })
    if (!r.gespeichert) { setMeldung(r.meldung); return }
    warteschlangeMelden()
    setAbgelegt(r.meldung)
  }

  function aufGeraetAblegen() {
    if (!ablage) return
    const r = ablegenMitMeldung(ablage.e, { modus, mitAnmeldung: ablage.mitAnmeldung, anlass: 'gesperrt', sekunden: ablage.sekunden, text: ablage.text })
    setAblage(null)
    if (!r.gespeichert) { setMeldung(r.meldung); return }
    warteschlangeMelden()
    setAbgelegt(r.meldung)
  }

  function naechstes() {
    kennungRef.current = ''
    vorbelegt.current = false
    setFertig(''); setAbgelegt(''); setMeldung(''); setAblage(null)
    setGesprochen(''); setVitals({}); setName(''); setVorname(''); setGebdatum(''); setUnbekannt(false); setZiel('')
    setBesatzung(KEINE_NAMEN); setPasswort(''); setAnderer(false)
  }

  if (fertig || abgelegt) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--warm-bg)' }}>
        <PubHeader title="Schnelldokumentation" onBack={() => navigate(`/${orgCode}`)} />
        <div style={{ padding: 20, maxWidth: 560, margin: '0 auto' }}>
          <div style={{ background: 'var(--lbf-card)', borderRadius: 12, borderLeft: `3px solid ${abgelegt ? 'var(--lbf-akzent)' : '#16a34a'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '18px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: abgelegt ? 'var(--lbf-akzent)' : '#16a34a' }}>
              {abgelegt ? 'Auf dem Gerät gespeichert' : 'Gespeichert'}
            </div>
            {fertig ? (
              <div style={{ fontSize: 22, fontWeight: 800, fontStyle: 'italic', color: 'var(--lbf-akzent)', marginTop: 6 }}>{fertig}</div>
            ) : null}
            <p style={{ color: 'var(--warm-gray)', fontSize: 13, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
              {abgelegt || 'Das Protokoll liegt als offener Vorgang bereit und kann in der vollständigen Dokumentation ergänzt werden.'}
            </p>
          </div>
          <button onClick={naechstes}
            style={{ width: '100%', marginTop: 16, background: 'var(--lbf-akzent-grund)', color: '#fde8d8', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Nächstes Protokoll
          </button>
          {/* Fremdes Gerät: wer angemeldet gesendet hat, meldet sich hier wieder ab */}
          <AbmeldenNachSenden />
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
          <div style={{ background: 'var(--lbf-card)', borderRadius: 12, borderLeft: '3px solid var(--lbf-akzent)', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '14px 16px', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <div style={{ ...lbl, marginBottom: 0, flex: 1 }}>Erkannt — zum Übernehmen antippen</div>
              <button onClick={alleUebernehmen}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--lbf-akzent)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Alle
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {offeneVorschlaege.map(v => (
                <button key={v.feld} onClick={() => uebernehmen(v.feld, v.wert)}
                  style={{ background: 'var(--lbf-card)', border: '1.5px solid rgba(var(--lbf-rot-rgb),0.25)', borderRadius: 999, padding: '9px 14px', fontSize: 14, color: 'var(--lbf-text)' }}>
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
          <div style={{ background: 'var(--lbf-card)', borderRadius: 12, borderLeft: '3px solid #d97706', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '14px 16px', marginBottom: '1rem' }}>
            <div style={{ ...lbl, color: '#d97706' }}>Nicht übernommen</div>
            {ergebnis.verworfen.map((v, i) => (
              <div key={i} style={{ fontSize: 13, marginTop: 6, color: 'var(--lbf-text)' }}>
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
              style={{ width: 20, height: 20, accentColor: 'var(--lbf-akzent)' }} />
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

        {/* Besatzung: Namen, verknüpft wird beim Absenden am Server */}
        <div style={field}>
          <div style={{ ...lbl, marginBottom: 8 }}>Besatzung</div>
          <BesatzungNamen orgCode={orgCode} namen={besatzung} onNamen={setBesatzung} mitAnmeldung={!anderer} />
        </div>

        {/* Wer erfasst hat: der Absender (früher „Erfasst von“) */}
        <div style={field}>
          <AbsenderFeld
            orgCode={orgCode} formular="patienten" stand={stand} alterServer={alterServer}
            name={ersteller} onName={setErsteller} nameLabel="Erfasst von"
            passwort={passwort} onPasswort={setPasswort}
            anderer={anderer} onAnderer={setAnderer}
            onSenden={() => { void absenden() }}
            onAblegen={ohnePasswortAblegen}
          />
          {meldung ? (
            <div style={{ padding: '8px 11px', marginTop: 4, background: 'var(--lbf-warn-grund)', border: '0.5px solid #fde047', borderRadius: 8, fontSize: 12, fontStyle: 'italic', color: 'var(--lbf-warn-text)', lineHeight: 1.45 }}>
              {meldung}
            </div>
          ) : null}
          {ablage ? (
            <div style={{ marginTop: 8 }}>
              <Textknopf onClick={aufGeraetAblegen}>{ABSENDER_TEXTE.ablegen}</Textknopf>
            </div>
          ) : null}
        </div>
      </div>

      {/* Absenden immer erreichbar, ohne Scrollen */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--warm-bg)', borderTop: '0.5px solid var(--lbf-border)', padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <button onClick={() => { void absenden() }} disabled={sendet}
          style={{ width: '100%', maxWidth: 520, margin: '0 auto', display: 'block', background: 'var(--lbf-akzent-grund)', color: '#fde8d8', border: 'none', borderRadius: 10, padding: '15px 0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: sendet ? 0.6 : 1 }}>
          {sendet ? 'Wird gespeichert …' : sendeKnopfText({ stand, anderer }, 'Protokoll speichern')}
        </button>
      </div>
    </div>
  )
}
