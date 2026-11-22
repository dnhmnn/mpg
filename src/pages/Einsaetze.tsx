// Einsätze (/einsaetze) im Dunkelrot-Design, Owner 22.11.2026:
// - Einsätze entstehen aus Protokoll und Produktausgabe mit Einsatznummer (pb_hooks/einsaetze.pb.js) oder von Hand.
// - Je Einsatz: Personen der Organisation, beteiligte Organisationen (freier Text), Protokolle und Produktausgaben
//   (über die Nummer oder von Hand verknüpft), CIRS-Meldungen nur für CIRS-Berechtigte (Feld einsatz_id an der
//   Meldung, damit andere nicht einmal sehen, dass es eine gibt), Löschen für Leitung und Recht Einsätze.
// - Seiten in der Adresse: ?seite=einsatz&id=…, ?seite=neu, ?seite=bearbeiten&id=…
// Rechnung in src/pages/einsaetze/logik.ts, Stile EZ_CSS. Alamos und EKS gibt es nicht mehr.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import { useStatusleiste } from '../hooks/useStatusleiste'
import { sichtbareEmail } from '../lib/apps'
import { Abschnitt, Auswahl, Feld, Hinweis, Icon, Leiste, Seite, Toast } from './benutzer/bausteine'
import { BV_CSS } from './benutzer/stil'
import { EZ_CSS } from './einsaetze/stil'
import { besatzungLesen, POSTEN } from './public/doku/besatzung'
import type { Werte } from './public/doku/DokuFeld'
import {
  ROLLEN_IM_EINSATZ, STATUS_TEXT, darfCirs, darfPatientennamen, darfVerwalten, datumText, gruppieren, loesen,
  neueNummer, nummerVergeben, organisationDazu, organisationVorschlaege, organisationWeg, organisationenLesen, passt, titel,
  verknuepfen, verknuepfungenLesen, zugeordnet, type Einsatz, type EinsatzStatus, type VerknuepfungArt,
} from './einsaetze/logik'

const STIL = BV_CSS + EZ_CSS

interface EinsatzPerson { id: string; einsatz_id: string; user_id: string; rolle?: string; expand?: { user_id?: { id: string; name: string; email?: string } } }
interface OrgUser { id: string; name: string; email: string }
interface Dok { id: string; title?: string; status: string; payload?: unknown; created: string }
interface Cirs { id: string; title?: string; status?: string; created: string; einsatz_id?: string }

function payload(x: unknown): Record<string, unknown> {
  if (x && typeof x === 'object') return x as Record<string, unknown>
  if (typeof x === 'string') { try { const v = JSON.parse(x); return v && typeof v === 'object' ? v : {} } catch { return {} } }
  return {}
}
const tag = (s: string) => new Date(s.replace(' ', 'T')).toLocaleDateString('de-DE')
const scrollOben = () => { window.scrollTo(0, 0); document.body.scrollTop = 0; document.documentElement.scrollTop = 0 }

export default function Einsaetze() {
  const { user, loading: authLoading } = useAuth()
  useStatusleiste('--lbf-kopf', { kopf: '.bv-kopf' })
  const navigate = useNavigate()
  const ort = useLocation()
  const [adr] = useSearchParams()
  const seite = adr.get('seite') || ''
  const id = adr.get('id') || ''

  const [einsaetze, setEinsaetze] = useState<Einsatz[]>([])
  const [laedt, setLaedt] = useState(true)
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null)
  const melden = useCallback((text: string, fehler = false) => { setMeldung({ text, fehler }); window.setTimeout(() => setMeldung(null), 3500) }, [])

  const laden = useCallback(async () => {
    if (!user?.organization_id) return
    try {
      const l = await pb.collection('einsaetze').getFullList<Einsatz>({ filter: pb.filter('organization_id = {:o}', { o: user.organization_id }), sort: '-datum', requestKey: null })
      setEinsaetze(l)
    } catch { /* Liste bleibt, wie sie war */ }
    finally { setLaedt(false) }
  }, [user?.organization_id])

  useEffect(() => {
    if (!user) return
    void laden()
    pb.collection('einsaetze').subscribe('*', () => { void laden() }).catch(() => { /* ohne Echtzeit: beim nächsten Öffnen */ })
    return () => { pb.collection('einsaetze').unsubscribe('*').catch(() => {}) }
  }, [user, laden])
  useEffect(() => { scrollOben() }, [seite, id])

  function oeffne(s: string, eid?: string) {
    const q = new URLSearchParams({ seite: s, ...(eid ? { id: eid } : {}) })
    navigate({ search: `?${q}` }, { state: { ezUnter: true } })
  }
  function zurueck() {
    if ((ort.state as { ezUnter?: boolean } | null)?.ezUnter) navigate(-1)
    else navigate({ search: '' }, { replace: true })
  }

  const orgName = user?.organization_name || 'Responda'
  if (authLoading) return <style>{STIL}</style>
  const verwalten = darfVerwalten(user)
  const einsatz = einsaetze.find((e) => e.id === id) || null

  let inhalt: React.ReactNode
  if (seite === 'bearbeiten' && !einsatz) {
    // Erst bearbeiten, wenn der Einsatz da ist: leere Felder würden beim Speichern die Nummer löschen (Durchsicht 22.11.2026)
    inhalt = <Seite titel="Einsatz bearbeiten" unter={orgName} zurueck={zurueck}><Hinweis oben>{laedt ? 'Wird geladen …' : 'Diesen Einsatz gibt es nicht mehr.'}</Hinweis></Seite>
  } else if (seite === 'neu' || seite === 'bearbeiten') {
    inhalt = <Formular key={seite === 'bearbeiten' ? einsatz?.id : 'neu'} user={user} orgName={orgName} einsatz={seite === 'bearbeiten' ? einsatz : null} alle={einsaetze} zurueck={zurueck}
      gespeichert={(neu) => {
        void laden()
        if (neu) {
          setEinsaetze((l) => (l.some((x) => x.id === neu.id) ? l : [neu, ...l]))
          navigate({ search: `?seite=einsatz&id=${neu.id}` }, { replace: true, state: ort.state })
        } else zurueck()
      }} melden={melden} />
  } else if (seite === 'einsatz') {
    inhalt = einsatz
      ? <Detail user={user} orgName={orgName} einsatz={einsatz} alle={einsaetze} zurueck={zurueck} oeffne={oeffne} neuLaden={laden} melden={melden} verwalten={verwalten}
          geloescht={() => { setEinsaetze((l) => l.filter((x) => x.id !== einsatz.id)); zurueck(); melden('Einsatz gelöscht. Protokolle und Produktausgaben bleiben erhalten.') }} />
      : <Seite titel="Einsatz" unter={orgName} zurueck={zurueck}><Hinweis oben>{laedt ? 'Wird geladen …' : 'Diesen Einsatz gibt es nicht mehr.'}</Hinweis></Seite>
  } else {
    inhalt = <Liste orgName={orgName} einsaetze={einsaetze} laedt={laedt} verwalten={verwalten} oeffne={oeffne} zurHub={() => navigate('/hub')} />
  }

  return (
    <>
      <style>{STIL}</style>
      {inhalt}
      {meldung && <Toast text={meldung.text} fehler={meldung.fehler} hoch={seite === 'neu' || seite === 'bearbeiten'} onClose={() => setMeldung(null)} />}
    </>
  )
}

// ── Liste ────────────────────────────────────────────────────────────────────

function Liste({ orgName, einsaetze, laedt, verwalten, oeffne, zurHub }: {
  orgName: string; einsaetze: Einsatz[]; laedt: boolean; verwalten: boolean; oeffne: (s: string, id?: string) => void; zurHub: () => void
}) {
  const [suche, setSuche] = useState('')
  const gruppen = useMemo(() => gruppieren(einsaetze.filter((e) => passt(e, suche))), [einsaetze, suche])
  return (
    <Seite titel="Einsätze" unter={orgName} zurueck={zurHub} zurueckLabel="Zurück zur Übersicht"
      rechts={verwalten ? <button type="button" className="bv-rund hell" aria-label="Neuer Einsatz" title="Neuer Einsatz" onClick={() => oeffne('neu')}><Icon n="plus" /></button> : undefined}>
      <Hinweis oben>Ein Einsatz entsteht von selbst, sobald ein Protokoll oder eine Produktausgabe mit Einsatznummer abgeschickt wird. Gleiche Nummer, gleicher Einsatz.</Hinweis>
      <div className="bv-suche ez-suche">
        <Icon n="suche" />
        <input type="search" placeholder="Nummer, Stichwort, Organisation" aria-label="Einsätze suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
        {suche && <button type="button" aria-label="Suche leeren" onClick={() => setSuche('')}><Icon n="kreuz" /></button>}
      </div>
      {laedt ? <Hinweis>Wird geladen …</Hinweis> : !gruppen.length ? (
        <div className="bv-notiz" style={{ marginTop: 14 }}><b>{suche ? 'Nichts gefunden' : 'Noch keine Einsätze'}</b><p>{suche ? 'Anders suchen oder die Suche leeren.' : 'Sobald ein Protokoll oder eine Produktausgabe mit Einsatznummer abgeschickt wird, steht der Einsatz hier.'}</p></div>
      ) : gruppen.map((g) => (
        <section key={g.titel}>
          <Abschnitt titel={g.titel} rechts={g.einsaetze.length} />
          <div className="bv-flaeche">
            {g.einsaetze.map((e) => (
              <button key={e.id} type="button" className="bv-z" onClick={() => oeffne('einsatz', e.id)}>
                <span className={`ez-strich ${e.status}`} aria-hidden="true" />
                <span className="bv-tx"><b>{titel(e)}</b><small>{[datumText(e.datum), e.keyword && e.unit ? `Nr. ${e.unit}` : '', ...organisationenLesen(e.organisationen).slice(0, 2)].filter(Boolean).join(' · ')}</small></span>
                <Icon n="weiter" className="bv-pfeil" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </Seite>
  )
}

// ── Neu und Bearbeiten ───────────────────────────────────────────────────────

function lokal(iso: string | undefined): string {
  const d = iso ? new Date(iso.replace(' ', 'T').replace(/(\d)$/, '$1Z')) : new Date()
  const t = isNaN(d.getTime()) ? new Date() : d
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function Formular({ user, orgName, einsatz, alle, zurueck, gespeichert, melden }: {
  user: ReturnType<typeof useAuth>['user']; orgName: string; einsatz: Einsatz | null; alle: Einsatz[]; zurueck: () => void
  gespeichert: (neu?: Einsatz) => void; melden: (t: string, f?: boolean) => void
}) {
  const [f, setF] = useState({ keyword: einsatz?.keyword || '', unit: einsatz?.unit || '', adresse: einsatz?.adresse || '', datum: lokal(einsatz?.datum), vermerke: einsatz?.interne_vermerke || '' })
  const [laeuft, setLaeuft] = useState(false)
  const neu = !einsatz
  async function speichern() {
    if (!user?.organization_id || laeuft) return
    if (!f.keyword.trim() && !f.unit.trim()) { melden('Bitte ein Stichwort oder eine Einsatznummer eintragen.', true); return }
    const zeitpunkt = new Date(f.datum)
    if (!f.datum || isNaN(zeitpunkt.getTime())) { melden('Bitte einen vollständigen Zeitpunkt eintragen.', true); return }
    if (!neu && !f.unit.trim()) { melden('Die Einsatznummer darf nicht leer sein: über sie gehören Protokolle und Produktausgaben dazu.', true); return }
    const andere = alle.find((e) => e.id !== einsatz?.id && nummerVergeben([e], f.unit))
    if (andere) { melden(`Die Nummer ${f.unit.trim()} hat schon „${titel(andere)}“.`, true); return }
    setLaeuft(true)
    try {
      const daten = { keyword: f.keyword.trim(), unit: f.unit.trim() || neueNummer(new Date(), Math.random, alle), adresse: f.adresse.trim(), datum: zeitpunkt.toISOString(), interne_vermerke: f.vermerke.trim() }
      if (neu) {
        const r = await pb.collection('einsaetze').create<Einsatz>({ ...daten, status: 'aktiv', organization_id: user.organization_id })
        melden('Einsatz angelegt.')
        gespeichert(r)
      } else {
        await pb.collection('einsaetze').update(einsatz.id, daten)
        melden('Gespeichert.')
        gespeichert()
      }
    } catch { melden('Speichern hat nicht geklappt.', true) }
    finally { setLaeuft(false) }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <Seite titel={neu ? 'Neuer Einsatz' : 'Einsatz bearbeiten'} unter={orgName} zurueck={zurueck}
      leiste={<Leiste titel={neu ? 'Neuer Einsatz' : titel(einsatz)} knopf={neu ? 'Anlegen' : 'Speichern'} onClick={speichern} laeuft={laeuft} />}>
      <Feld label="Stichwort" erst><input className="bv-eingabe" value={f.keyword} onChange={set('keyword')} placeholder="z. B. B3 Wohnungsbrand" /></Feld>
      <Feld label="Einsatznummer" hinweis={neu ? 'Leer lassen: Responda vergibt eine. Protokolle und Produktausgaben mit derselben Nummer gehören dann von selbst dazu.' : 'Protokolle und Produktausgaben mit derselben Nummer gehören von selbst dazu.'}>
        <input className="bv-eingabe" value={f.unit} onChange={set('unit')} placeholder="z. B. 2026-0417" autoCapitalize="none" />
      </Feld>
      <Feld label="Zeitpunkt"><input className="bv-eingabe" type="datetime-local" value={f.datum} onChange={set('datum')} /></Feld>
      <Feld label="Einsatzort" zusatz="optional" hinweis="Nur der Ort des Einsatzes, keine Angaben zu Patienten."><input className="bv-eingabe" value={f.adresse} onChange={set('adresse')} /></Feld>
      <Feld label="Vermerke" zusatz="optional"><textarea className="bv-eingabe" value={f.vermerke} onChange={set('vermerke')} /></Feld>
    </Seite>
  )
}

// ── Einsatz ──────────────────────────────────────────────────────────────────

function Detail({ user, orgName, einsatz, alle, zurueck, oeffne, neuLaden, melden, verwalten, geloescht }: {
  user: ReturnType<typeof useAuth>['user']; orgName: string; einsatz: Einsatz; alle: Einsatz[]; zurueck: () => void
  oeffne: (s: string, id?: string) => void; neuLaden: () => Promise<void>; melden: (t: string, f?: boolean) => void; verwalten: boolean; geloescht: () => void
}) {
  const org = user?.organization_id || ''
  const cirsSicht = darfCirs(user)
  const namenSicht = darfPatientennamen(user)
  const [personen, setPersonen] = useState<EinsatzPerson[]>([])
  const [protokolle, setProtokolle] = useState<Dok[]>([])
  const [ausgaben, setAusgaben] = useState<Dok[]>([])
  const [cirs, setCirs] = useState<Cirs[]>([])
  const [cirsFrei, setCirsFrei] = useState<Cirs[]>([])
  const [mitglieder, setMitglieder] = useState<OrgUser[]>([])
  const [offen, setOffen] = useState<'' | 'person' | 'protokoll' | 'produktausgabe' | 'cirs' | 'karte'>('')
  const [laeuft, setLaeuft] = useState(false)

  const ladeDetails = useCallback(async () => {
    const r = await Promise.allSettled([
      pb.collection('einsatz_personen').getFullList<EinsatzPerson>({ filter: pb.filter('einsatz_id = {:id}', { id: einsatz.id }), expand: 'user_id', requestKey: null }),
      pb.collection('patients').getFullList<Dok>({ filter: pb.filter('organization_id = {:o}', { o: org }), sort: '-created', requestKey: null }),
      pb.collection('product_outputs').getFullList<Dok>({ filter: pb.filter('organization_id = {:o}', { o: org }), sort: '-created', requestKey: null }),
      cirsSicht ? pb.collection('cirs_reports').getFullList<Cirs>({ filter: pb.filter('organization_id = {:o}', { o: org }), sort: '-created', fields: 'id,title,status,created,einsatz_id', requestKey: null }) : Promise.resolve([] as Cirs[]),
    ])
    if (r[0].status === 'fulfilled') setPersonen(r[0].value)
    if (r[1].status === 'fulfilled') setProtokolle(r[1].value)
    if (r[2].status === 'fulfilled') setAusgaben(r[2].value)
    if (r[3].status === 'fulfilled') {
      setCirs(r[3].value.filter((c) => c.einsatz_id === einsatz.id))
      setCirsFrei(r[3].value.filter((c) => !c.einsatz_id).slice(0, 30))
    }
  }, [einsatz.id, org, cirsSicht])
  useEffect(() => { void ladeDetails() }, [ladeDetails])
  useEffect(() => {
    if (offen !== 'person' || mitglieder.length || !org) return
    pb.collection('users').getFullList<OrgUser>({ filter: pb.filter('organization_id = {:o}', { o: org }), fields: 'id,name,email', sort: 'name', requestKey: null }).then(setMitglieder).catch(() => {})
  }, [offen, mitglieder.length, org])

  const orgs = organisationenLesen(einsatz.organisationen)
  const hand = verknuepfungenLesen(einsatz.verknuepfungen)
  const zuProtokolle = zugeordnet(einsatz, 'protokoll', protokolle)
  const zuAusgaben = zugeordnet(einsatz, 'produktausgabe', ausgaben)

  // Besatzung aus den Protokollen des Einsatzes, die noch nicht unter Personen steht (Owner 22.11.2026).
  // Neue Protokolle trägt der Server selbst ein (pb_hooks/einsaetze.pb.js); das hier ist für ältere.
  const besatzungFehlt: { id: string; rolle: string }[] = []
  for (const { dok } of zuProtokolle) {
    const b = besatzungLesen(payload(dok.payload) as Werte)
    for (const p of POSTEN) {
      const x = b[p.pos]
      if (x?.id && !personen.some((q) => q.user_id === x.id) && !besatzungFehlt.some((q) => q.id === x.id)) besatzungFehlt.push({ id: x.id, rolle: p.pos === 'tf' ? 'Teamführer' : '' })
    }
  }
  async function besatzungUebernehmen() {
    await einmal(async () => {
      try {
        // Nur Konten der eigenen Organisation
        const org = mitglieder.length ? mitglieder : await pb.collection('users').getFullList<OrgUser>({ filter: pb.filter('organization_id = {:o}', { o: user?.organization_id || '' }), fields: 'id,name,email', sort: 'name', requestKey: null })
        if (!mitglieder.length) setMitglieder(org)
        let n = 0
        for (const p of besatzungFehlt) {
          if (!org.some((m) => m.id === p.id)) continue
          await pb.collection('einsatz_personen').create({ einsatz_id: einsatz.id, user_id: p.id, rolle: p.rolle })
          n++
        }
        await ladeDetails()
        melden(n ? (n === 1 ? 'Eine Person übernommen.' : `${n} Personen übernommen.`) : 'Niemand aus der Besatzung hat ein Konto in eurer Organisation.')
      } catch { melden('Besatzung nicht übernommen.', true) }
    })
  }

  // Eins nach dem anderen: Organisationen und Verknüpfungen werden als ganze Liste geschrieben; ein zweiter
  // Tipp während des Speicherns rechnete sonst mit dem alten Stand (Durchsicht 22.11.2026)
  const beschaeftigt = useRef(false)
  async function einmal<T>(f: () => Promise<T>): Promise<T | undefined> {
    if (beschaeftigt.current) return undefined
    beschaeftigt.current = true
    setLaeuft(true)
    try { return await f() } finally { beschaeftigt.current = false; setLaeuft(false) }
  }
  async function aendern(daten: Record<string, unknown>, ok?: string) {
    return (await einmal(async () => {
      try {
        await pb.collection('einsaetze').update(einsatz.id, daten)
        await neuLaden()
        if (ok) melden(ok)
        return true
      } catch { melden('Speichern hat nicht geklappt.', true); return false }
    })) ?? false
  }

  // Organisationen
  const [neueOrg, setNeueOrg] = useState('')
  const vorschlaege = organisationVorschlaege(alle, orgs)
  async function orgDazu(name: string) {
    const n = name.trim()
    if (!n) return
    if (await aendern({ organisationen: organisationDazu(orgs, n) })) setNeueOrg('')
  }

  // Personen
  const [suche, setSuche] = useState('')
  const [rolle, setRolle] = useState('')
  const treffer = suche.trim() ? mitglieder.filter((m) => !personen.some((p) => p.user_id === m.id) && (m.name || '').toLowerCase().includes(suche.trim().toLowerCase())).slice(0, 8) : []
  async function personDazu(m: OrgUser) {
    await einmal(async () => {
      try {
        await pb.collection('einsatz_personen').create({ einsatz_id: einsatz.id, user_id: m.id, rolle: rolle || '' })
        setSuche(''); setRolle('')
        await ladeDetails()
      } catch { melden('Person nicht hinzugefügt.', true) }
    })
  }
  async function personWeg(p: EinsatzPerson) {
    await einmal(async () => {
      try { await pb.collection('einsatz_personen').delete(p.id); setPersonen((l) => l.filter((x) => x.id !== p.id)) } catch { melden('Nicht entfernt.', true) }
    })
  }

  // Dokumente von Hand
  async function dokDazu(art: VerknuepfungArt, dokId: string) { await aendern({ verknuepfungen: verknuepfen(hand, art, dokId) }) }
  async function dokWeg(art: VerknuepfungArt, dokId: string) { await aendern({ verknuepfungen: loesen(hand, art, dokId) }) }
  async function cirsSetzen(c: Cirs, an: boolean) {
    await einmal(async () => {
      try {
        await pb.collection('cirs_reports').update(c.id, { einsatz_id: an ? einsatz.id : '' })
        await ladeDetails()
      } catch { melden('CIRS-Meldung nicht verknüpft. Ist das Feld einsatz_id auf dem Server angelegt?', true) }
    })
  }

  async function loeschen() {
    if (!confirm(`„${titel(einsatz)}“ löschen?\n\nProtokolle, Produktausgaben und CIRS-Meldungen bleiben erhalten; nur der Einsatz, seine Personen und Verknüpfungen verschwinden.`)) return
    await einmal(async () => {
      try { await pb.collection('einsaetze').delete(einsatz.id); geloescht() } catch { melden('Löschen hat nicht geklappt. Vielleicht fehlt das Recht.', true) }
    })
  }

  const protokollZeile = (d: Dok) => {
    const p = payload(d.payload)
    const name = [p.vorname, p.name].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ')
    const besatzung = [p.mannschaft_tf, p.mannschaft_1].map((x) => String(x ?? '').trim()).filter(Boolean).join(', ')
    return { b: namenSicht && name ? name : `Protokoll vom ${tag(d.created)}`, small: [namenSicht && name ? tag(d.created) : '', besatzung, d.status].filter(Boolean).join(' · ') }
  }
  const ausgabeZeile = (d: Dok) => {
    const p = payload(d.payload)
    const pos = Array.isArray(p.positionen) ? (p.positionen as { qty?: number; name?: string }[]) : []
    return { b: `Produktausgabe vom ${tag(d.created)}`, small: [String(p.user_name ?? ''), pos.slice(0, 3).map((x) => `${x.qty ?? ''}× ${x.name ?? ''}`).join(', ')].filter(Boolean).join(' · ') }
  }

  // Als Funktion, nicht als Bestandteil: sonst baute React die Liste bei jeder Änderung neu auf
  const dokListe = (art: VerknuepfungArt, liste: { dok: Dok; wie: 'nummer' | 'hand' }[], alleDoks: Dok[], zeile: (d: Dok) => { b: string; small: string }) => {
    const frei = alleDoks.filter((d) => !liste.some((x) => x.dok.id === d.id)).slice(0, 20)
    return (
      <div className="bv-flaeche">
        {!liste.length && <div className="ez-leer">{art === 'protokoll' ? 'Kein Protokoll.' : 'Keine Produktausgabe.'}</div>}
        {liste.map(({ dok, wie }) => {
          const z = zeile(dok)
          return (
            <div key={dok.id} className="bv-z">
              <span className="bv-tx"><b>{z.b}</b><small>{z.small}</small></span>
              <span className="ez-wie">{wie === 'nummer' ? 'Über Nr.' : 'Von Hand'}</span>
              {wie === 'hand' && verwalten && <button type="button" className="ez-weg" aria-label="Verknüpfung lösen" onClick={() => void dokWeg(art, dok.id)}><Icon n="kreuz" /></button>}
            </div>
          )
        })}
        {verwalten && (
          <button type="button" className="bv-z neu" aria-expanded={offen === art} onClick={() => setOffen(offen === art ? '' : art)}>
            <Icon n="plus" /><span className="bv-tx"><b>{art === 'protokoll' ? 'Protokoll verknüpfen' : 'Produktausgabe verknüpfen'}</b></span>
          </button>
        )}
        {offen === art && (frei.length ? frei.map((d) => {
          const z = zeile(d)
          return (
            <button key={d.id} type="button" className="bv-z" onClick={() => { void dokDazu(art, d.id); setOffen('') }}>
              <span className="bv-tx"><b>{z.b}</b><small>{z.small}</small></span><Icon n="plus" className="bv-pfeil" />
            </button>
          )
        }) : <div className="ez-leer">Nichts weiter zum Verknüpfen.</div>)}
      </div>
    )
  }

  return (
    <Seite titel={titel(einsatz)} unter={[einsatz.keyword && einsatz.unit ? `Nr. ${einsatz.unit}` : '', orgName].filter(Boolean).join(' · ')} zurueck={zurueck} zurueckLabel="Zurück zu den Einsätzen"
      rechts={verwalten ? <button type="button" className="bv-rund" aria-label="Einsatz bearbeiten" title="Bearbeiten" onClick={() => oeffne('bearbeiten', einsatz.id)}><svg className="bv-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg></button> : undefined}
      reiter={<div className="ez-kopfzeile"><span className="ez-pille">{STATUS_TEXT[einsatz.status] || einsatz.status}</span>{datumText(einsatz.datum) && <span className="ez-pille">{datumText(einsatz.datum)}</span>}</div>}>

      {(einsatz.adresse || einsatz.interne_vermerke) && (
        <div className="bv-notiz">{einsatz.adresse && <b>{einsatz.adresse}</b>}{einsatz.interne_vermerke && <p>{einsatz.interne_vermerke}</p>}</div>
      )}
      {verwalten && (
        <div className="bv-flaeche" style={{ marginTop: einsatz.adresse || einsatz.interne_vermerke ? 12 : 0 }}>
          {(['aktiv', 'abgeschlossen'] as EinsatzStatus[]).filter((s) => s !== einsatz.status).map((s) => (
            <button key={s} type="button" className="bv-z akzent" onClick={() => void aendern({ status: s }, s === 'aktiv' ? 'Einsatz läuft wieder.' : 'Einsatz abgeschlossen.')}>
              <span className="bv-tx"><b>{s === 'aktiv' ? 'Wieder öffnen' : 'Abschließen'}</b></span>
            </button>
          ))}
        </div>
      )}

      <Abschnitt titel="Personen" rechts={personen.length || undefined} />
      <div className="bv-flaeche">
        {!personen.length && <div className="ez-leer">Noch niemand eingetragen.</div>}
        {personen.map((p) => (
          <div key={p.id} className="bv-z">
            <span className="bv-tx"><b>{p.expand?.user_id?.name || 'Unbekannt'}</b>{p.rolle && <small>{p.rolle}</small>}</span>
            {verwalten && <button type="button" className="ez-weg" aria-label="Person entfernen" onClick={() => void personWeg(p)}><Icon n="kreuz" /></button>}
          </div>
        ))}
        {verwalten && besatzungFehlt.length > 0 && (
          <button type="button" className="bv-z neu" onClick={() => void besatzungUebernehmen()}>
            <Icon n="personplus" /><span className="bv-tx"><b>Besatzung aus den Protokollen übernehmen</b><small>{besatzungFehlt.length === 1 ? 'Eine Person' : `${besatzungFehlt.length} Personen`} mit Konto, Teamführer mit Funktion</small></span>
          </button>
        )}
        {verwalten && (
          <button type="button" className="bv-z neu" aria-expanded={offen === 'person'} onClick={() => setOffen(offen === 'person' ? '' : 'person')}>
            <Icon n="personplus" /><span className="bv-tx"><b>Person hinzufügen</b></span>
          </button>
        )}
        {offen === 'person' && (
          <>
            <div className="ez-eingabe-zeile">
              <input className="bv-eingabe" placeholder="Name suchen" value={suche} onChange={(e) => setSuche(e.target.value)} aria-label="Person suchen" />
            </div>
            <div className="ez-eingabe-zeile" style={{ paddingTop: 0 }}>
              <Auswahl value={rolle} onChange={setRolle} label="Funktion im Einsatz">
                <option value="">Funktion (optional)</option>
                {ROLLEN_IM_EINSATZ.map((r) => <option key={r} value={r}>{r}</option>)}
              </Auswahl>
            </div>
            {treffer.map((m) => (
              <button key={m.id} type="button" className="bv-z" onClick={() => void personDazu(m)}>
                <span className="bv-tx"><b>{m.name}</b>{sichtbareEmail(m.email) && <small>{sichtbareEmail(m.email)}</small>}</span><Icon n="plus" className="bv-pfeil" />
              </button>
            ))}
            {suche.trim() && !treffer.length && <div className="ez-leer">Niemand gefunden.</div>}
          </>
        )}
      </div>

      <Abschnitt titel="Organisationen" rechts={orgs.length || undefined} />
      <div className="bv-flaeche">
        {orgs.length ? (
          <div className="ez-chips">
            {orgs.map((o) => (
              <span key={o} className="ez-chip">{o}{verwalten && <button type="button" aria-label={`${o} entfernen`} onClick={() => void aendern({ organisationen: organisationWeg(orgs, o) })}><Icon n="kreuz" /></button>}</span>
            ))}
          </div>
        ) : <div className="ez-leer">Keine weiteren Organisationen eingetragen.</div>}
        {verwalten && (
          <>
            <div className="ez-eingabe-zeile">
              <input className="bv-eingabe" placeholder="z. B. Rettungsdienst, Polizei" value={neueOrg} maxLength={80} onChange={(e) => setNeueOrg(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void orgDazu(neueOrg) }} aria-label="Organisation hinzufügen" />
              <button type="button" className="ez-knopf" disabled={!neueOrg.trim()} onClick={() => void orgDazu(neueOrg)}>Dazu</button>
            </div>
            {!!vorschlaege.length && (
              <div className="ez-chips" style={{ paddingTop: 0 }}>
                {vorschlaege.map((v) => <button key={v} type="button" className="ez-chip vorschlag" onClick={() => void orgDazu(v)}>+ {v}</button>)}
              </div>
            )}
          </>
        )}
      </div>

      <Abschnitt titel="Protokolle" rechts={zuProtokolle.length || undefined} />
      {dokListe('protokoll', zuProtokolle, protokolle, protokollZeile)}

      <Abschnitt titel="Produktausgaben" rechts={zuAusgaben.length || undefined} />
      {dokListe('produktausgabe', zuAusgaben, ausgaben, ausgabeZeile)}

      {cirsSicht && (
        <>
          <Abschnitt titel="CIRS-Meldungen" rechts={cirs.length || undefined} />
          <Hinweis>Nur für dich und andere CIRS-Berechtigte sichtbar. Wer sonst den Einsatz öffnet, sieht hier nichts.</Hinweis>
          <div className="bv-flaeche">
            {!cirs.length && <div className="ez-leer">Keine CIRS-Meldung verknüpft.</div>}
            {cirs.map((c) => (
              <div key={c.id} className="bv-z">
                <span className="bv-tx"><b>CIRS-Meldung vom {tag(c.created)}</b>{c.status && <small>{c.status}</small>}</span>
                <button type="button" className="ez-weg" aria-label="Verknüpfung lösen" onClick={() => void cirsSetzen(c, false)}><Icon n="kreuz" /></button>
              </div>
            ))}
            <button type="button" className="bv-z neu" aria-expanded={offen === 'cirs'} onClick={() => setOffen(offen === 'cirs' ? '' : 'cirs')}>
              <Icon n="plus" /><span className="bv-tx"><b>CIRS-Meldung verknüpfen</b></span>
            </button>
            {offen === 'cirs' && (cirsFrei.length ? cirsFrei.map((c) => (
              <button key={c.id} type="button" className="bv-z" onClick={() => { void cirsSetzen(c, true); setOffen('') }}>
                <span className="bv-tx"><b>CIRS-Meldung vom {tag(c.created)}</b>{c.status && <small>{c.status}</small>}</span><Icon n="plus" className="bv-pfeil" />
              </button>
            )) : <div className="ez-leer">Keine offene Meldung ohne Einsatz.</div>)}
          </div>
        </>
      )}

      <Abschnitt titel="Karte" />
      {offen === 'karte' ? <Karte einsatz={einsatz} /> : (
        <div className="bv-flaeche">
          <button type="button" className="bv-z" onClick={() => setOffen('karte')}>
            <span className="bv-tx"><b>Karte öffnen</b><small>{einsatz.adresse ? 'Sucht den Einsatzort bei OpenStreetMap' : 'Ohne Einsatzort nur die Übersicht'}</small></span><Icon n="weiter" className="bv-pfeil" />
          </button>
        </div>
      )}

      {verwalten && (
        <div className="bv-flaeche" style={{ marginTop: 28 }}>
          <button type="button" className="bv-z gefahr" disabled={laeuft} onClick={() => void loeschen()}>Einsatz löschen</button>
        </div>
      )}
    </Seite>
  )
}

// ── Karte (BayernAtlas, eine gespeicherte Zeichnung, der Ort auf Tippen bei OpenStreetMap). Nur ansehen: „Karte
// speichern“ schrieb Marker und geladene Zeichnung bei jedem Speichern doppelt zurück (Durchsicht 22.11.2026). ──

function Karte({ einsatz }: { einsatz: Einsatz }) {
  const div = useRef<HTMLDivElement>(null)
  const karte = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  useEffect(() => {
    let aus = false
    const bauen = () => {
      if (aus || !div.current) return
      const L = (window as any).L // eslint-disable-line @typescript-eslint/no-explicit-any
      const map = L.map(div.current, { zoomControl: true }).setView([48.15, 11.57], 11)
      L.tileLayer.wms('https://geoservices.bayern.de/wms/v2/ogc_bay_dk.cgi', { layers: 'by_dk', format: 'image/png', transparent: false, attribution: '© Bayerische Vermessungsverwaltung' }).addTo(map)
      if (einsatz.karte_geojson) { try { L.geoJSON(JSON.parse(einsatz.karte_geojson)).addTo(map) } catch { /* keine Zeichnung */ } }
      if (einsatz.adresse) {
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(einsatz.adresse + ', Deutschland')}&format=json&limit=1`)
          .then((r) => r.json()).then((res) => {
            if (aus || !res?.[0]) return
            const lat = parseFloat(res[0].lat), lon = parseFloat(res[0].lon)
            L.marker([lat, lon]).addTo(map)
            map.setView([lat, lon], 15)
          }).catch(() => {})
      }
      karte.current = map
    }
    if (!document.getElementById('leaflet-css')) {
      const l = document.createElement('link'); l.id = 'leaflet-css'; l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l)
    }
    if ((window as any).L) bauen() // eslint-disable-line @typescript-eslint/no-explicit-any
    else { const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = bauen; document.head.appendChild(s) }
    return () => { aus = true; if (karte.current) { karte.current.remove(); karte.current = null } }
  }, [einsatz.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="ez-karte"><div ref={div} /></div>
}
