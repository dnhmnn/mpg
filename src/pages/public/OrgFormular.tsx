// Eigenes Formular einer Organisation (öffentlich, /<org>/formular/<vorlage>), Bauplan
// Vorgänge 4.3.
//
// Die Vorlage kommt aus form_templates (öffentlich lesbar; ohne Netz aus dem Zwischenspeicher
// des Service Workers). Gesendet wird nur über src/lib/formular/versand.ts (Route /absenden
// mit `formular: 'eigen'`, ohne Netz in die Warteschlange, bei altem Server der alte Weg):
// Der Server prüft Vorlage, Organisation, Modul, Absender und Felder und setzt Status und
// Absender selbst. Die Maske legt nie selbst an.
//
// Absender nach der Vorlage: „Mitglied mit Passwort“, „Name frei eintragen“ oder „Anonym“
// (kein Name, kein Token, auch für angemeldete Mitglieder, F6).

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useOrg } from './OrgPublicLayout'
import { pb } from '../../lib/pocketbase'
import { modulFrei } from '../../lib/freigabe'
import { schemaLesen, vorlageModus, werteBereinigen, type VorlageModus, type VorlageSchema } from '../../lib/formular/felder'
import { useFormularStand } from '../../lib/formular/stand'
import { neueKennung } from '../../lib/formular/api'
import { ablegenMitMeldung, sendenOderAblegen } from '../../lib/formular/versand'
import type { NeuerEintrag } from '../../lib/formular/warteschlange'
import { absenderZeile } from '../../lib/formular/absender'
import { PubSendBar, PubWrap } from './pubStyles'
import AbsenderFeld, { AbmeldenNachSenden, absenderAngabe, sendeKnopfText } from './absender/AbsenderFeld'
import { warteschlangeMelden } from './absender/Warteschlange'
import { ABSENDER_TEXTE } from './absender/texte'
import { absenderPruefen } from './formularDaten'
import FormularInhalt from './felder/FormularInhalt'
import { felderPruefen, fokusAuf, serverFeld } from './felder/pruefen'

/** Was die Seite von der Vorlage braucht. */
type Vorlage = { id: string; titel: string; beschreibung: string; modus: VorlageModus; version: number; schema: VorlageSchema }
type Fertig = { art: 'gesendet'; absender: string; anonym: boolean } | { art: 'abgelegt'; meldung: string }

const T = {
  laedt: 'Formular wird geladen…',
  nichtGefunden: 'Formular nicht gefunden',
  nichtVerfuegbar: 'Dieses Formular ist nicht verfügbar.',
  zurueck: 'Zur Seite der Organisation',
  gesendet: 'Gesendet',
  gesendetText: (titel: string) => `Deine Angaben für „${titel}“ sind angekommen.`,
  anonymGesendet: 'Anonym gesendet, ohne Namen.',
  abgelegt: 'Auf dem Gerät gespeichert',
  neu: 'Neues Formular ausfüllen',
  senden: 'Absenden',
  keineFelder: 'Dieses Formular hat noch keine Felder.',
}

/** Die Vorlage für die Seite, oder null, wenn sie hier nichts annimmt (fremd, inaktiv, archiviert, Modul aus). */
function vorlageFuer(rec: Record<string, unknown>, org: { id: string } & Record<string, unknown>): Vorlage | null {
  if (rec.organization_id !== org.id || rec.is_active !== true || rec.archiviert === true || !modulFrei(org, 'dokumente')) return null
  return {
    id: String(rec.id),
    titel: typeof rec.title === 'string' && rec.title.trim() ? rec.title.trim() : 'Formular',
    beschreibung: typeof rec.description === 'string' ? rec.description : '',
    modus: vorlageModus(rec),
    version: typeof rec.version === 'number' && Number.isInteger(rec.version) && rec.version >= 0 ? rec.version : 0,
    schema: schemaLesen(rec),
  }
}

const textKnopf: React.CSSProperties = { background: 'none', border: 'none', padding: '6px 0', color: 'var(--lbf-akzent)', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }

export default function OrgFormular() {
  const { templateId } = useParams<{ templateId: string }>()
  const { org, orgCode } = useOrg()
  const navigate = useNavigate()

  const [vorlage, setVorlage] = useState<Vorlage | null>(null)
  const [laedt, setLaedt] = useState(true)
  const [werte, setWerte] = useState<Record<string, unknown>>({})
  const [feldFehler, setFeldFehler] = useState<Record<string, string>>({})
  const [fehler, setFehler] = useState('')
  const [sending, setSending] = useState(false)
  const [fertig, setFertig] = useState<Fertig | null>(null)

  // Absender: Name, Passwort nur im Zustand dieses einen Versuchs, nie gespeichert
  const [name, setName] = useState('')
  const [passwort, setPasswort] = useState('')
  const [anderer, setAnderer] = useState(false)
  const [ablegenAnbieten, setAblegenAnbieten] = useState(false)
  const sperre = useRef<{ sekunden?: number; text: string } | null>(null)
  const kennung = useRef('')

  const modus: VorlageModus = vorlage?.modus ?? 'frei'
  const anonym = modus === 'anonym'
  // Anonym: auch beim Stand kein Token (niemand wird erkannt)
  const { stand, alterServer } = useFormularStand(orgCode, { mitAnmeldung: !anderer && !anonym, org })
  const angemeldet = !anonym && !anderer && !!stand?.angemeldet

  useEffect(() => {
    let weg = false
    setLaedt(true)
    if (!templateId) { setVorlage(null); setLaedt(false); return }
    pb.collection('form_templates').getOne(templateId, { requestKey: null })
      .then((rec) => { if (!weg) setVorlage(vorlageFuer(rec as unknown as Record<string, unknown>, org as unknown as { id: string } & Record<string, unknown>)) })
      .catch(() => { if (!weg) setVorlage(null) })
      .finally(() => { if (!weg) setLaedt(false) })
    return () => { weg = true }
  }, [templateId, org.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function wertSetzen(id: string, w: unknown) {
    setWerte((p) => ({ ...p, [id]: w }))
    if (feldFehler[id]) setFeldFehler((p) => { const n = { ...p }; delete n[id]; return n })
  }

  /** Der Eintrag für Versand und Warteschlange: daten für die Route, alt für den alten Weg. */
  function eintrag(v: Vorlage, angabe: ReturnType<typeof absenderAngabe>): NeuerEintrag {
    if (!kennung.current) kennung.current = neueKennung()
    const bereinigt = werteBereinigen(v.schema.felder, werte)
    const angemeldetId = !anonym && angabe.mitAnmeldung ? stand?.angemeldet?.id ?? '' : ''
    const absenderName = anonym ? '' : ((angabe.absender?.name ?? '').trim() || (angabe.mitAnmeldung ? stand?.angemeldet?.name ?? '' : name.trim()))
    return {
      id: kennung.current,
      formular: 'eigen',
      vorlage: v.id,
      modus: v.modus,
      titel: v.titel,
      orgCode,
      orgId: org.id,
      absenderName,
      angemeldetId,
      daten: { version: v.version, werte: bereinigt },
      alt: { template_id: v.id, organization_id: org.id, org_code: orgCode, payload: JSON.parse(JSON.stringify(bereinigt)) },
    }
  }

  function fertigMelden(f: Fertig) {
    setFertig(f)
    setFehler('')
    setAblegenAnbieten(false)
    if (f.art === 'abgelegt') warteschlangeMelden()
    window.scrollTo(0, 0)
  }

  /** Felder und Absender prüfen; der erste Fehler bekommt den Fokus. */
  function vorpruefen(v: Vorlage, o: { ohnePasswort?: boolean } = {}): boolean {
    const p = felderPruefen(v.schema.felder, werte)
    setFeldFehler(p.fehler)
    if (p.erster) { fokusAuf(p.erster); return false }
    if (anonym) return true
    const absender = o.ohnePasswort
      ? absenderPruefen({ angemeldet: false, name, modus: 'frei', passwort: '', online: true, alterServer })
      : absenderPruefen({ angemeldet, name, modus: modus === 'passwort' ? 'passwort' : 'frei', passwort, online: navigator.onLine !== false, alterServer })
    if (absender) { setFehler(absender); return false }
    return true
  }

  async function submit() {
    if (sending || !vorlage) return
    setFehler('')
    setAblegenAnbieten(false)
    if (!vorpruefen(vorlage)) return
    const angabe = absenderAngabe({ stand, formular: 'eigen', anderer, name, passwort, modus })
    const e = eintrag(vorlage, angabe)
    setSending(true)
    try {
      const r = await sendenOderAblegen(e, angabe, { modus })
      if (r.art === 'gesendet') {
        fertigMelden({ art: 'gesendet', absender: anonym ? '' : absenderZeile(r.absender, e.absenderName), anonym })
      } else if (r.art === 'abgelegt') {
        fertigMelden({ art: 'abgelegt', meldung: r.meldung })
      } else if (r.art === 'nicht_abgelegt') {
        setFehler(r.meldung)
      } else {
        // Ein Feld, das der Server ablehnt, zeigt den Text am Feld
        const f = serverFeld(r.feld, 'werte')
        if (r.grund === 'daten' && f && vorlage.schema.felder.some((d) => d.id === f)) {
          setFeldFehler((p) => ({ ...p, [f]: r.meldung }))
          fokusAuf(f)
        } else {
          setFehler(r.meldung)
        }
        setAblegenAnbieten(r.ablegenAnbieten)
        sperre.current = r.ablegenAnbieten ? { sekunden: r.sekunden, text: r.meldung } : null
      }
    } finally {
      setPasswort('')
      setSending(false)
    }
  }

  /** Nach zu vielen falschen Passwörtern: auf dem Gerät ablegen, die Warteschlange fragt später erneut. */
  function aufGeraetAblegen() {
    if (!vorlage) return
    const angabe = absenderAngabe({ stand, formular: 'eigen', anderer, name, passwort: '', modus })
    const r = ablegenMitMeldung(eintrag(vorlage, angabe), { modus, mitAnmeldung: angabe.mitAnmeldung, anlass: 'gesperrt', sekunden: sperre.current?.sekunden, text: sperre.current?.text })
    if (r.gespeichert) fertigMelden({ art: 'abgelegt', meldung: r.meldung })
    else { setFehler(r.meldung); setAblegenAnbieten(false) }
  }

  /** Modus Passwort, kein Passwort zur Hand: ohne Passwort ablegen. */
  function ohnePasswortAblegen() {
    if (sending || !vorlage) return
    setFehler('')
    setAblegenAnbieten(false)
    if (!vorpruefen(vorlage, { ohnePasswort: true })) return
    setPasswort('')
    const angabe = absenderAngabe({ stand, formular: 'eigen', anderer: true, name, passwort: '', modus })
    const r = ablegenMitMeldung(eintrag(vorlage, angabe), { modus, mitAnmeldung: false, anlass: 'ohne_passwort' })
    if (r.gespeichert) fertigMelden({ art: 'abgelegt', meldung: r.meldung })
    else setFehler(r.meldung)
  }

  function neu() {
    setFertig(null)
    setWerte({})
    setFeldFehler({})
    setFehler('')
    setPasswort('')
    setAblegenAnbieten(false)
    // Neues Formular, neue Kennung; der Name bleibt für das nächste stehen
    kennung.current = ''
  }

  const kopf = (titel: string) => (
    <header style={{ position: 'sticky', top: 0, background: 'var(--lbf-card)', borderBottom: '0.5px solid var(--lbf-border)', zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
      <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" aria-label={T.zurueck} onClick={() => navigate(`/${orgCode}`)} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', color: 'var(--lbf-akzent)', cursor: 'pointer', padding: 0, flexShrink: 0, minWidth: 44, minHeight: 44 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--lbf-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titel}</div>
          <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{org.org_name}</div>
        </div>
      </div>
    </header>
  )

  if (laedt) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', display: 'grid', placeItems: 'center' }}>
        <div role="status" style={{ color: 'var(--warm-gray)', fontSize: 14 }}>{T.laedt}</div>
      </div>
    )
  }

  if (!vorlage) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)' }}>
        {kopf('Formular')}
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--lbf-text)', marginBottom: 8 }}>{T.nichtGefunden}</div>
          <div style={{ fontSize: 14, color: 'var(--warm-gray)', lineHeight: 1.5 }}>{T.nichtVerfuegbar}</div>
        </div>
      </div>
    )
  }

  if (fertig) {
    const gesendet = fertig.art === 'gesendet'
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px 40px', boxSizing: 'border-box' }}>
        <div style={{ background: 'var(--lbf-card)', borderLeft: `3px solid ${gesendet ? '#16a34a' : 'var(--lbf-akzent)'}`, borderRadius: 12, padding: 32, textAlign: 'center', maxWidth: 400, width: '100%', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', boxSizing: 'border-box' }}>
          <div style={{ width: 52, height: 52, background: gesendet ? 'rgba(22,163,74,0.1)' : 'var(--lbf-akzent-weich)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            {gesendet ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--lbf-akzent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--lbf-text)', marginBottom: 8 }}>{gesendet ? T.gesendet : T.abgelegt}</div>
          <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 8, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
            {fertig.art === 'gesendet' ? T.gesendetText(vorlage.titel) : fertig.meldung}
          </div>
          {fertig.art === 'gesendet' ? (
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 24 }}>
              {fertig.anonym ? T.anonymGesendet : fertig.absender ? `Absender: ${fertig.absender}` : null}
            </div>
          ) : <div style={{ marginBottom: 16 }} />}
          <button type="button" style={{ background: 'var(--lbf-akzent-grund)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em' }} onClick={neu}>
            {T.neu}
          </button>
          {!anonym ? <AbmeldenNachSenden /> : null}
        </div>
      </div>
    )
  }

  const ohneFelder = vorlage.schema.felder.filter((f) => f.aus !== true).length === 0

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)' }}>
      {kopf(vorlage.titel)}
      <PubWrap>
        {ohneFelder ? (
          <p style={{ fontSize: 14, color: 'var(--warm-gray)', margin: '8px 2px 16px' }}>{T.keineFelder}</p>
        ) : (
          <FormularInhalt schema={vorlage.schema} werte={werte} onWert={wertSetzen} fehler={feldFehler} beschreibung={vorlage.beschreibung} />
        )}

        {/* Absender zuletzt, direkt über dem Sendeknopf; anonym sagt AbsenderFeld selbst „ohne Namen“ */}
        <div style={{ background: 'var(--lbf-card)', borderLeft: '3px solid var(--lbf-akzent)', borderRadius: 12, marginBottom: '.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '1rem' }}>
          <AbsenderFeld
            orgCode={orgCode}
            formular="eigen"
            vorlage={vorlage.id}
            modus={modus}
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

        {fehler ? (
          <div role="alert" style={{ background: 'var(--lbf-fehler-grund)', border: '0.5px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--lbf-fehler-text)', marginBottom: '.75rem', lineHeight: 1.5 }}>
            {fehler}
            {ablegenAnbieten ? (
              <div style={{ marginTop: 6 }}>
                <button type="button" onClick={aufGeraetAblegen} style={textKnopf}>{ABSENDER_TEXTE.ablegen}</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </PubWrap>
      {!ohneFelder ? <PubSendBar onSubmit={() => { void submit() }} sending={sending} label={sendeKnopfText({ stand, anderer, modus }, T.senden)} small /> : null}
    </div>
  )
}
