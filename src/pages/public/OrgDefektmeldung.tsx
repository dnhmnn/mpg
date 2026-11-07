// Defektmeldung (öffentliches Formular): ein Medizinprodukt als defekt melden,
// etwa über den QR-Code am Gerät (/<org>/defektmeldung?device=<id>).
//
// Absender nach Bauplan Formulare v2 (4.2, 4.7): angemeldet, mit Passwort oder
// Name frei, je nach Einstellung der Organisation. Gesendet wird nur über
// src/lib/formular/versand.ts (Route /absenden, ohne Netz in die
// Warteschlange, bei altem Server der alte Weg); die Maske legt nie selbst an.

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { useOrg } from './OrgPublicLayout'
import { PubWrap, PubSendBar, inp, lbl, ta } from './pubStyles'
import { istAusserBetrieb } from '../../lib/mpg/zustand'
import AbsenderFeld, { AbmeldenNachSenden, absenderAngabe, sendeKnopfText } from './absender/AbsenderFeld'
import { warteschlangeMelden } from './absender/Warteschlange'
import { useFormularStand } from '../../lib/formular/stand'
import { neueKennung } from '../../lib/formular/api'
import { ablegenMitMeldung, sendenOderAblegen } from '../../lib/formular/versand'
import type { NeuerEintrag } from '../../lib/formular/warteschlange'
import { absenderZeile, type AbsenderEintrag, type AbsenderModus } from '../../lib/formular/absender'
import { ABSENDER_TEXTE, modusAusStand } from './absender/texte'
import { BESCHREIBUNG_MAX, absenderPruefen, meldungAlt, meldungDaten, meldungPruefen } from './formularDaten'

type Severity = 'low' | 'medium' | 'high' | 'critical'

interface DeviceSummary { id: string; name: string; type: string; location: string; ausser_betrieb?: string }
/** Was nach dem Senden gezeigt wird: angekommen oder auf dem Gerät abgelegt. */
type Fertig = { art: 'gesendet'; absender: string; geraet: string } | { art: 'abgelegt'; meldung: string }

const SEVERITY_CFG: Record<Severity, { label: string; desc: string; color: string; bg: string }> = {
  low:      { label: 'Gering',   desc: 'Gerät noch nutzbar',          color: '#d97706', bg: 'rgba(217,119,6,0.08)'  },
  medium:   { label: 'Mittel',   desc: 'Eingeschränkte Funktion',      color: '#ea580c', bg: 'rgba(234,88,12,0.08)'  },
  high:     { label: 'Hoch',     desc: 'Nicht mehr einsatzbereit',     color: '#dc2626', bg: 'rgba(220,38,38,0.08)'  },
  critical: { label: 'Kritisch', desc: 'Sicherheitsrelevanter Defekt', color: 'rgb(var(--lbf-defekt-rgb))', bg: 'rgba(var(--lbf-defekt-rgb),0.12)'  },
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--lbf-card)', borderLeft: '3px solid var(--lbf-akzent)', borderRadius: 12, marginBottom: '.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div style={{ padding: '.85rem 1rem', fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.12em', borderBottom: '0.5px solid var(--lbf-border-light)' }}>
        {title}
      </div>
      <div style={{ padding: '1rem' }}>{children}</div>
    </div>
  )
}

/** Textknopf im LBF-Stil: Akzent, fett, ohne Rahmen. */
const textKnopf: React.CSSProperties = { background: 'none', border: 'none', padding: '6px 0', color: 'var(--lbf-akzent)', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }


export default function OrgDefektmeldung() {
  const { org, orgCode } = useOrg()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedId = searchParams.get('device') || ''

  const [devices, setDevices] = useState<DeviceSummary[]>([])
  const [selectedId, setSelectedId] = useState(preselectedId)
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<Severity>('medium')
  const [sending, setSending] = useState(false)
  const [fertig, setFertig] = useState<Fertig | null>(null)
  const [error, setError] = useState('')
  const [liste, setListe] = useState<'laedt' | 'ok' | 'fehler'>('laedt')

  // Absender (4.2): Name, Passwort nur im Zustand dieses einen Versuchs, nie gespeichert
  const [name, setName] = useState('')
  const [passwort, setPasswort] = useState('')
  const [anderer, setAnderer] = useState(false)
  const [ablegenAnbieten, setAblegenAnbieten] = useState(false)
  /** Nach „gesperrt“: wie lange die Sperre läuft und was der Server sagte (für die Ablage). */
  const sperre = useRef<{ sekunden?: number; text: string } | null>(null)
  // Kennung des Satzes: entsteht beim ersten Versuch und bleibt bis „Neue Meldung“
  const kennung = useRef('')
  // Name des gemeldeten Geräts, auch ohne geladene Liste (für den alten Weg und die Rückmeldung)
  const geraeteName = useRef('')
  const { stand, alterServer } = useFormularStand(orgCode, { mitAnmeldung: !anderer, org })
  const angemeldet = !anderer && !!stand?.angemeldet
  // Derselbe Modus, nach dem AbsenderFeld das Passwortfeld zeigt; beim alten Server gibt es keins
  const modus: AbsenderModus = alterServer ? 'frei' : modusAusStand(stand, 'defektmeldung')

  function ladeGeraete() {
    setListe('laedt')
    pb.collection('mpg_devices').getFullList<DeviceSummary>({
      filter: `organization_id = "${org.id}"`,
      sort: 'name',
      fields: 'id,name,type,location,ausser_betrieb',
    }).then(ds => {
      const aktiv = ds.filter(d => !istAusserBetrieb(d))
      setDevices(aktiv)
      setListe('ok')
      // Ein Link (QR) auf ein außer Betrieb genommenes oder unbekanntes Gerät wählt nichts vor
      setSelectedId(id => aktiv.some(d => d.id === id) ? id : '')
    }).catch(() => setListe('fehler'))
  }
  useEffect(ladeGeraete, [org.id])

  const selectedDevice = devices.find(d => d.id === selectedId)

  /** Der Eintrag für Versand und Warteschlange (1.18): daten für die Route, alt für den alten Weg. */
  function eintrag(angabe: ReturnType<typeof absenderAngabe>): NeuerEintrag {
    if (!kennung.current) kennung.current = neueKennung()
    const angemeldetId = angabe.mitAnmeldung ? stand?.angemeldet?.id ?? '' : ''
    const absenderName = (angabe.absender?.name ?? '').trim() || (angabe.mitAnmeldung ? stand?.angemeldet?.name ?? '' : name.trim())
    return {
      id: kennung.current,
      formular: 'defektmeldung',
      orgCode,
      orgId: org.id,
      absenderName,
      angemeldetId,
      daten: meldungDaten(selectedId, description, severity),
      alt: meldungAlt(selectedId, description, severity, { deviceName: geraeteName.current, absender: { id: angemeldetId, name: absenderName }, orgId: org.id }),
    }
  }

  function fertigMelden(f: Fertig) {
    setFertig(f)
    setError('')
    setAblegenAnbieten(false)
    // Die Karte der Warteschlange sofort zeigen, nicht erst beim nächsten Durchgang
    if (f.art === 'abgelegt') warteschlangeMelden()
  }

  async function submit() {
    if (sending) return
    setError('')
    setAblegenAnbieten(false)
    if (liste === 'laedt') { setError('Die Geräteliste lädt noch. Bitte einen Moment warten.'); return }
    // Ohne geladene Liste zählt das Gerät aus dem Link (QR): die Meldung soll nicht am Netz scheitern
    if (!selectedId || (liste === 'ok' && !selectedDevice)) { setError('Bitte ein Gerät auswählen.'); return }
    const pruef = meldungPruefen(meldungDaten(selectedId, description, severity))
      || absenderPruefen({ angemeldet, name, modus, passwort, online: navigator.onLine !== false, alterServer })
    if (pruef) { setError(pruef); return }
    setSending(true)
    try {
      // Ohne Liste das eine Gerät nachschlagen: Name für die Meldung, außer Betrieb genommen: nein.
      // Ohne Netz geht es ohne Namen weiter; den setzt der Server beim Eingang.
      geraeteName.current = selectedDevice?.name || ''
      if (!selectedDevice && navigator.onLine !== false) {
        const g = await pb.collection('mpg_devices').getOne<DeviceSummary>(selectedId, { fields: 'id,name,ausser_betrieb', requestKey: null }).catch(() => null)
        if (g && istAusserBetrieb(g)) { setError('Dieses Gerät ist außer Betrieb genommen.'); return }
        geraeteName.current = g?.name || ''
      }
      const angabe = absenderAngabe({ stand, formular: 'defektmeldung', anderer, name, passwort })
      const e = eintrag(angabe)
      const r = await sendenOderAblegen(e, angabe, { modus })
      if (r.art === 'gesendet') {
        const absender: AbsenderEintrag | null = r.absender
        fertigMelden({ art: 'gesendet', absender: absenderZeile(absender, e.absenderName), geraet: geraeteName.current })
      } else if (r.art === 'abgelegt') {
        fertigMelden({ art: 'abgelegt', meldung: r.meldung })
      } else if (r.art === 'nicht_abgelegt') {
        setError(r.meldung)
      } else {
        setError(r.meldung)
        setAblegenAnbieten(r.ablegenAnbieten)
        sperre.current = r.ablegenAnbieten ? { sekunden: r.sekunden, text: r.meldung } : null
      }
    } finally {
      // Nach jedem Versuch leeren (4.2)
      setPasswort('')
      setSending(false)
    }
  }

  /** Nach zu vielen falschen Passwörtern: auf dem Gerät ablegen, die Warteschlange fragt später erneut. */
  function aufGeraetAblegen() {
    const angabe = absenderAngabe({ stand, formular: 'defektmeldung', anderer, name, passwort: '' })
    const r = ablegenMitMeldung(eintrag(angabe), { modus, mitAnmeldung: angabe.mitAnmeldung, anlass: 'gesperrt', sekunden: sperre.current?.sekunden, text: sperre.current?.text })
    if (r.gespeichert) fertigMelden({ art: 'abgelegt', meldung: r.meldung })
    else { setError(r.meldung); setAblegenAnbieten(false) }
  }

  /** Modus Passwort, kein Passwort zur Hand: ohne Passwort ablegen (Befund Client-Abläufe 5). */
  function ohnePasswortAblegen() {
    if (sending) return
    setError('')
    setAblegenAnbieten(false)
    if (liste === 'laedt') { setError('Die Geräteliste lädt noch. Bitte einen Moment warten.'); return }
    if (!selectedId || (liste === 'ok' && !selectedDevice)) { setError('Bitte ein Gerät auswählen.'); return }
    const pruef = meldungPruefen(meldungDaten(selectedId, description, severity))
      || absenderPruefen({ angemeldet: false, name, modus: 'frei', passwort: '', online: true, alterServer })
    if (pruef) { setError(pruef); return }
    setPasswort('')
    geraeteName.current = selectedDevice?.name || geraeteName.current
    const angabe = absenderAngabe({ stand, formular: 'defektmeldung', anderer: true, name, passwort: '' })
    const r = ablegenMitMeldung(eintrag(angabe), { modus, mitAnmeldung: false, anlass: 'ohne_passwort' })
    if (r.gespeichert) fertigMelden({ art: 'abgelegt', meldung: r.meldung })
    else setError(r.meldung)
  }

  function reset() {
    setFertig(null)
    setDescription('')
    setSeverity('medium')
    setPasswort('')
    setError('')
    setAblegenAnbieten(false)
    if (!preselectedId) setSelectedId('')
    // Neue Meldung, neue Kennung (4.2); der Name bleibt für die nächste Meldung stehen
    kennung.current = ''
    geraeteName.current = ''
  }

  if (fertig) {
    const gesendet = fertig.art === 'gesendet'
    return (
      // Oben im Fluss, nicht auf 100dvh zentriert: steht darüber die Karte der Warteschlange, bleibt die Bestätigung sichtbar
      <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px 40px', boxSizing: 'border-box' }}>
        <div style={{ background: 'var(--lbf-card)', borderLeft: `3px solid ${gesendet ? '#16a34a' : 'var(--lbf-akzent)'}`, borderRadius: 12, padding: 32, textAlign: 'center', maxWidth: 400, width: '100%', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
          <div style={{ width: 52, height: 52, background: gesendet ? 'rgba(22,163,74,0.1)' : 'var(--lbf-akzent-weich)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            {gesendet ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--lbf-akzent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
              </svg>
            )}
          </div>
          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: 'var(--lbf-text)', marginBottom: 8 }}>{gesendet ? 'Meldung eingegangen' : 'Auf dem Gerät gespeichert'}</div>
          <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', marginBottom: gesendet && fertig.absender ? 8 : 24, lineHeight: 1.5 }}>
            {fertig.art === 'gesendet'
              ? (fertig.geraet ? <>Die Defektmeldung für <strong style={{ fontStyle: 'normal', color: 'var(--lbf-text)' }}>{fertig.geraet}</strong> wurde übermittelt und wird geprüft.</> : 'Die Defektmeldung wurde übermittelt und wird geprüft.')
              : fertig.meldung}
          </div>
          {fertig.art === 'gesendet' && fertig.absender && (
            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 24 }}>Absender: {fertig.absender}</div>
          )}
          <button style={{ background: 'var(--lbf-akzent-grund)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em' }} onClick={reset}>
            Neue Meldung
          </button>
          <AbmeldenNachSenden />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)' }}>
      <header style={{ position: 'sticky', top: 0, background: 'var(--lbf-card)', borderBottom: '0.5px solid var(--lbf-border)', zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(`/${orgCode}`)} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', color: 'var(--lbf-akzent)', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--lbf-text)' }}>Defektmeldung</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{org.org_name}</div>
          </div>
        </div>
      </header>

      <PubWrap>
        {/* Gerät */}
        <Card title="Gerät *">
          <label style={lbl}>
            Medizinprodukt auswählen
            {liste === 'fehler' ? (
              <div style={{ ...inp, marginTop: 6, color: 'var(--warm-gray)', fontStyle: 'italic', textTransform: 'none', letterSpacing: 'normal', fontWeight: 400, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                <span>{selectedId ? 'Geräteliste nicht geladen. Das Gerät aus dem Link wird gemeldet.' : 'Geräteliste konnte nicht geladen werden.'}</span>
                <button type="button" onClick={ladeGeraete} style={{ background: 'none', border: 'none', color: 'var(--lbf-akzent)', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', fontStyle: 'normal' }}>Erneut laden</button>
              </div>
            ) : devices.length === 0 ? (
              <div style={{ ...inp, marginTop: 6, color: 'var(--warm-gray)', fontStyle: 'italic' }}>{liste === 'laedt' ? 'Lädt …' : 'Keine Geräte gefunden'}</div>
            ) : (
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                style={{ ...inp, appearance: 'none', WebkitAppearance: 'none' }}
              >
                <option value="">Gerät auswählen</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.location ? ` · ${d.location}` : ''} ({d.type})
                  </option>
                ))}
              </select>
            )}
          </label>
        </Card>

        {/* Beschreibung */}
        <Card title="Beschreibung">
          <label style={lbl}>
            Was ist defekt? *
            <textarea
              value={description}
              maxLength={BESCHREIBUNG_MAX}
              onChange={e => setDescription(e.target.value)}
              placeholder="Was genau ist defekt? Wie macht sich das Problem bemerkbar?"
              rows={4}
              style={ta}
            />
          </label>
        </Card>

        {/* Schweregrad */}
        <Card title="Schweregrad">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {(Object.entries(SEVERITY_CFG) as [Severity, typeof SEVERITY_CFG[Severity]][]).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSeverity(key)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: `1.5px solid ${severity === key ? cfg.color : 'var(--lbf-border)'}`,
                  background: severity === key ? cfg.bg : 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left' as const,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: cfg.color }}>{cfg.label}</div>
                <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 2 }}>{cfg.desc}</div>
              </button>
            ))}
          </div>
        </Card>

        {/* Absender, zuletzt: direkt über dem Sendeknopf (4.2) */}
        <div style={{ background: 'var(--lbf-card)', borderLeft: '3px solid var(--lbf-akzent)', borderRadius: 12, marginBottom: '.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '1rem' }}>
          <AbsenderFeld
            orgCode={orgCode}
            formular="defektmeldung"
            stand={stand}
            alterServer={alterServer}
            name={name}
            onName={setName}
            passwort={passwort}
            onPasswort={setPasswort}
            anderer={anderer}
            onAnderer={(v) => { setAnderer(v); setPasswort('') }}
            onSenden={() => { void submit() }}
            onAblegen={ohnePasswortAblegen}
          />
        </div>

        {error && (
          <div role="alert" style={{ background: 'var(--lbf-fehler-grund)', border: '0.5px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--lbf-fehler-text)', fontStyle: 'italic', marginBottom: '.75rem', lineHeight: 1.5 }}>
            {error}
            {ablegenAnbieten && (
              <div style={{ marginTop: 6 }}>
                <button type="button" onClick={aufGeraetAblegen} style={{ ...textKnopf, fontStyle: 'normal' }}>{ABSENDER_TEXTE.ablegen}</button>
              </div>
            )}
          </div>
        )}
      </PubWrap>

      <PubSendBar onSubmit={submit} sending={sending} label={sendeKnopfText({ stand, anderer }, 'Defekt melden')} small />
    </div>
  )
}
