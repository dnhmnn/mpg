// CIRS-Meldung (öffentliches Formular): ein kritisches Ereignis anonym melden.
//
// Felder nach der Einstellung der Organisation (Plan Vorgänge 4.2): Kernfelder ausblenden,
// Pflicht wählen, umbenennen, Hilfetext, Reihenfolge, eigene Felder. „Was ist passiert?“
// bleibt immer; Name und Kontakt sind nie Pflicht. Kategorie und Schweregrad mit den festen
// Listen aus src/lib/cirs.ts, damit die Auswertung stimmt.
//
// Angelegt wird weiter direkt (cirs_reports.create, ohne Anmeldung); eigene Felder gehen als
// payload.eigene = { version, werte } mit, der Hook cirs.pb.js prüft sie und legt die
// Bezeichnungen dazu. Fehler des Servers stehen auf der Seite.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { useOrg } from './OrgPublicLayout'
import { PubHeader, PubSection, PubSendBar, PubWrap, field, inp, lbl, sel, ta } from './pubStyles'
import { KATEGORIEN, SCHWEREGRADE, meldungsNummer } from '../../lib/cirs'
import { bausteine, standardKonfig, werteBereinigen, type Baustein } from '../../lib/formular/felder'
import { CIRS_KURZ_MAX, CIRS_TEXT_MAX, cirsFehler, cirsLeer, cirsSatz, type CirsKern } from './formularDaten'
import FeldEingabe from './felder/FeldEingabe'
import { eigeneFelder, feldElementId, felderPruefen, fokusAuf, gruppieren } from './felder/pruefen'

/** Heutiges Datum in Ortszeit (nicht UTC: kurz nach Mitternacht stünde sonst der Vortag da). */
const heute = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const T = {
  kopf: (org: string) => `CIRS-Meldung ${org}`,
  wasIst: 'Was ist CIRS?',
  wasIstText: 'Anonyme Meldung kritischer Ereignisse, damit sie sich nicht wiederholen. Es zählt, was passiert ist, nicht wer.',
  person: 'Name und Kontakt sind freiwillig. Ohne sie bleibt die Meldung anonym.',
  senden: 'Meldung absenden',
  gemeldet: 'Meldung eingegangen',
  danke: 'Danke für deinen Beitrag zur Sicherheit.',
  nummer: 'Meldungsnummer',
  nummerHinweis: 'Bei Rückfragen zur Meldung bitte angeben.',
  neu: 'Neue Meldung',
  bitteWaehlen: 'Bitte wählen',
  ohneNetz: 'Keine Verbindung zum Server. Die Meldung ist nicht gesendet. Bitte mit Netz erneut versuchen.',
  fehler: 'Die Meldung ließ sich nicht senden. Bitte erneut versuchen.',
  ortPlatzhalter: 'z.B. Fahrzeughalle',
  wasPlatzhalter: 'Schildere das Ereignis sachlich.',
}

const hilfeStil: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--warm-gray)', marginTop: 4, lineHeight: 1.45, textTransform: 'none', letterSpacing: 'normal', fontWeight: 400 }
const fehlerStil: React.CSSProperties = { fontSize: 12, color: 'var(--lbf-fehler-text-2)', marginTop: 6, lineHeight: 1.4 }

/** Text einer Ablehnung beim Anlegen: ohne Netz, sonst die deutsche Meldung des Hooks. */
function fehlerText(e: unknown): string {
  const f = (e ?? {}) as { status?: number; message?: string; response?: { message?: string } }
  if (f.status === 0) return T.ohneNetz
  const m = String(f.response?.message || '').trim()
  if (m && !/^(Failed to|Something went wrong|The request)/i.test(m)) return m
  return T.fehler
}

export default function OrgCirs() {
  const { org, orgCode } = useOrg()
  const navigate = useNavigate()
  const konfig = standardKonfig(org.form_config, 'cirs')
  const bs = bausteine(konfig, 'cirs')
  const eigene = eigeneFelder(bs)
  const personZeigen = bs.some((b) => b.art === 'kern' && (b.id === 'melder_name' || b.id === 'melder_kontakt'))

  const [kern, setKern] = useState<CirsKern>(() => cirsLeer(heute()))
  const [werte, setWerte] = useState<Record<string, unknown>>({})
  const [feldFehler, setFeldFehler] = useState<Record<string, string>>({})
  const [fehler, setFehler] = useState('')
  const [sending, setSending] = useState(false)
  const [nummer, setNummer] = useState<string | null>(null)

  function kernSetzen(id: keyof CirsKern, w: string) {
    setKern((p) => ({ ...p, [id]: w }))
    if (feldFehler[id]) setFeldFehler((p) => { const n = { ...p }; delete n[id]; return n })
  }
  function wertSetzen(id: string, w: unknown) {
    setWerte((p) => ({ ...p, [id]: w }))
    if (feldFehler[id]) setFeldFehler((p) => { const n = { ...p }; delete n[id]; return n })
  }

  async function submit() {
    if (sending) return
    setFehler('')
    // Kernfelder und eigene Felder prüfen; der erste Fehler in Formularfolge bekommt den Fokus
    const e = felderPruefen(eigene, werte)
    const alle: Record<string, string> = { ...e.fehler, ...cirsFehler(kern, bs) }
    setFeldFehler(alle)
    const erster = bs.map((b) => (b.art === 'kern' ? b.id : b.feld.id)).find((id) => alle[id])
    if (erster) { fokusAuf(erster); return }
    setSending(true)
    try {
      const satz = cirsSatz(kern, bs, {
        orgId: org.id, heute: heute(),
        eigene: eigene.length ? { version: konfig.version, werte: werteBereinigen(eigene, werte) } : undefined,
      })
      const rec = await pb.collection('cirs_reports').create(satz, { requestKey: null })
      setNummer(rec?.id ? meldungsNummer(rec.id, rec.created || new Date().toISOString()) : '')
      window.scrollTo(0, 0)
    } catch (err) {
      setFehler(fehlerText(err))
    } finally {
      setSending(false)
    }
  }

  function neu() {
    setKern(cirsLeer(heute()))
    setWerte({})
    setFeldFehler({})
    setFehler('')
    setNummer(null)
  }

  if (nummer !== null) return (
    <PubWrap>
      <div style={{ background: 'var(--lbf-card)', borderRadius: 16, padding: 32, textAlign: 'center', maxWidth: 480, margin: '2rem auto', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', boxSizing: 'border-box' }}>
        <div style={{ width: 52, height: 52, background: 'var(--lbf-ok-grund-2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h2 style={{ color: 'var(--lbf-text)', margin: '0 0 .5rem', fontSize: 20 }}>{T.gemeldet}</h2>
        <p style={{ color: 'var(--warm-gray)', margin: nummer ? '0 0 1rem' : '0 0 1.5rem', fontSize: 15 }}>{T.danke}</p>
        {nummer ? (
          <p style={{ color: 'var(--warm-gray)', margin: '0 0 1.5rem', fontSize: 13, lineHeight: 1.5 }}>
            {T.nummer} <strong style={{ color: 'var(--lbf-text)', letterSpacing: '0.02em' }}>{nummer}</strong><br />{T.nummerHinweis}
          </p>
        ) : null}
        <button type="button" style={btn} onClick={neu}>{T.neu}</button>
      </div>
    </PubWrap>
  )

  /** Ein Kernfeld nach seiner Art; Bezeichnung und Hilfetext aus der Einstellung. */
  function kernFeld(b: Extract<Baustein, { art: 'kern' }>) {
    const id = b.id as keyof CirsKern
    const elId = feldElementId(b.id)
    const pflicht = b.pflicht || b.id === 'was'
    const f = feldFehler[b.id]
    const rahmen: React.CSSProperties = f ? { borderColor: 'var(--lbf-fehler-text-2)' } : {}
    const wert = kern[id] ?? ''
    const an = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => kernSetzen(id, e.target.value)
    let eingabe: React.ReactNode
    if (b.id === 'datum') eingabe = <input id={elId} style={{ ...inp, ...rahmen }} type="date" value={wert} onChange={an} />
    else if (b.id === 'kategorie') {
      eingabe = (
        <select id={elId} style={{ ...sel, ...rahmen }} value={wert} onChange={an}>
          <option value="">{T.bitteWaehlen}</option>
          {KATEGORIEN.map((k) => <option key={k.wert} value={k.wert}>{k.name}</option>)}
        </select>
      )
    } else if (b.id === 'schwere') {
      eingabe = (
        <select id={elId} style={{ ...sel, ...rahmen }} value={wert} onChange={an}>
          <option value="">{T.bitteWaehlen}</option>
          {SCHWEREGRADE.map((s) => <option key={s.wert} value={s.wert}>{`${s.name} (${s.lang})`}</option>)}
        </select>
      )
    } else if (['was', 'warum', 'folgen', 'vorschlag'].includes(b.id)) {
      eingabe = <textarea id={elId} style={{ ...ta, ...rahmen }} maxLength={CIRS_TEXT_MAX} placeholder={b.id === 'was' ? T.wasPlatzhalter : undefined} value={wert} onChange={an} />
    } else {
      eingabe = <input id={elId} style={{ ...inp, ...rahmen }} type="text" maxLength={CIRS_KURZ_MAX} placeholder={b.id === 'ort' ? T.ortPlatzhalter : undefined} value={wert} onChange={an} />
    }
    return (
      <div key={b.id} style={field}>
        <label htmlFor={elId} style={lbl}>
          {b.label}{pflicht ? ' *' : ''}
          {b.hilfe ? <span style={hilfeStil}>{b.hilfe}</span> : null}
        </label>
        {eingabe}
        {f ? <div role="alert" style={fehlerStil}>{f}</div> : null}
      </div>
    )
  }

  return <>
    <PubHeader title={T.kopf(org.org_name)} onBack={() => navigate(`/${orgCode}`)} />
    <PubWrap>
      <div style={{ background: 'var(--lbf-info-grund)', border: '0.5px solid var(--lbf-info-rand)', borderRadius: 12, padding: '1rem', marginBottom: '1rem', color: 'var(--lbf-text)', fontSize: 14, lineHeight: 1.5 }}>
        <strong>{T.wasIst}</strong><br />{T.wasIstText}
      </div>
      {gruppieren(bs, 'cirs').map((g, gi) => (
        <PubSection key={`g-${gi}`} title={g.titel} open>
          {g.titel === 'Angaben zur Person' && personZeigen ? <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.45 }}>{T.person}</p> : null}
          {g.teile.map((b) => b.art === 'kern'
            ? kernFeld(b)
            : <FeldEingabe key={b.feld.id} feld={b.feld} wert={werte[b.feld.id]} onWert={(w) => wertSetzen(b.feld.id, w)} fehler={feldFehler[b.feld.id]} />)}
        </PubSection>
      ))}
      {fehler ? (
        <div role="alert" style={{ background: 'var(--lbf-fehler-grund)', border: '0.5px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--lbf-fehler-text)', marginBottom: '.75rem', lineHeight: 1.5 }}>{fehler}</div>
      ) : null}
    </PubWrap>
    <PubSendBar onSubmit={() => { void submit() }} sending={sending} label={T.senden} />
  </>
}

const btn: React.CSSProperties = { background: 'var(--lbf-akzent-grund)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }
