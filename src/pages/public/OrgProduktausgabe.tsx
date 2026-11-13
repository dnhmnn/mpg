// Produktausgabe (öffentliches Formular): Artikel, die im Einsatz verbraucht
// wurden, an die Lagerverwaltung melden.
//
// Absender nach Bauplan Formulare v2 (4.2, 4.7): angemeldet, mit Passwort oder
// Name frei, je nach Einstellung der Organisation. Gesendet wird nur über
// src/lib/formular/versand.ts (Route /absenden, ohne Netz in die
// Warteschlange, bei altem Server der alte Weg); die Maske legt nie selbst an.
//
// Felder nach der Einstellung der Organisation (Plan Vorgänge 4.2): Bezeichnung und
// Hilfetext der Kernfelder, Reihenfolge und eigene Felder aus form_config.formulare.
// Die Kernblöcke (Positionen, Verbrauchsort) behalten ihre Bedienung.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { useOrg } from './OrgPublicLayout'
import { PubWrap, PubSendBar, PubSection, field, inp, lbl } from './pubStyles'
import AbsenderFeld, { AbmeldenNachSenden, absenderAngabe, sendeKnopfText } from './absender/AbsenderFeld'
import { warteschlangeMelden } from './absender/Warteschlange'
import { useFormularStand } from '../../lib/formular/stand'
import { neueKennung } from '../../lib/formular/api'
import { ablegenMitMeldung, sendenOderAblegen } from '../../lib/formular/versand'
import type { NeuerEintrag } from '../../lib/formular/warteschlange'
import { absenderZeile, type AbsenderEintrag, type AbsenderModus } from '../../lib/formular/absender'
import { ABSENDER_TEXTE, modusAusStand } from './absender/texte'
import { EINSATZ_MAX, absenderPruefen, ausgabeAlt, ausgabeDaten, ausgabePruefen, eigeneAngaben, type EigeneEingabe } from './formularDaten'
import { bausteine, standardKonfig, werteBereinigen, type Baustein } from '../../lib/formular/felder'
import FeldEingabe from './felder/FeldEingabe'
import { eigeneAngeboten, eigeneFelder, feldElementId, felderPruefen, fokusAuf, gruppieren, serverFeld } from './felder/pruefen'

/** Heutiges Datum in Ortszeit (nicht UTC: kurz nach Mitternacht stünde sonst der Vortag da). */
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface InventoryItem { id: string; name: string; unit: string }
interface Location { id: string; name: string }
type Pos = { qty: number; name: string; item_id: string; unit: string }
/** Was nach dem Senden gezeigt wird: angekommen oder auf dem Gerät abgelegt. */
type Fertig = { art: 'gesendet'; absender: string } | { art: 'abgelegt'; meldung: string }

function Card({ title, hilfe, children }: { title: string; hilfe?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--lbf-card)', borderLeft: '3px solid var(--lbf-akzent)', borderRadius: 12, marginBottom: '.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div style={{ padding: '.85rem 1rem', fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: '0.5px solid var(--lbf-border-light)' }}>
        {title}
      </div>
      <div style={{ padding: '1rem' }}>
        {hilfe ? <div style={hilfeStil}>{hilfe}</div> : null}
        {children}
      </div>
    </div>
  )
}

/** Hilfetext aus der Einstellung: klein in Zweitfarbe unter der Bezeichnung (nicht kursiv). */
const hilfeStil: React.CSSProperties = { fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.45, margin: '0 0 10px', textTransform: 'none', letterSpacing: 'normal', fontWeight: 400 }

/** Die festen Texte der Vorprüfung mit der Bezeichnung der Organisation, wenn sie umbenannt hat. */
function kernFehler(text: string, bs: Baustein[]): string {
  const label = (id: string) => {
    const b = bs.find((x) => x.art === 'kern' && x.id === id)
    return b && b.art === 'kern' && b.label !== b.kern.label ? b.label : ''
  }
  const umbenannt: [string, string, (l: string) => string][] = [
    ['einsatz', 'Bitte den Einsatz angeben.', (l) => `Bitte „${l}“ angeben.`],
    ['datum', 'Bitte ein gültiges Datum angeben.', (l) => `Bitte „${l}“ prüfen.`],
    ['lager_id', 'Bitte einen Verbrauchsort auswählen.', (l) => `Bitte „${l}“ auswählen.`],
  ]
  for (const [id, t, neu] of umbenannt) if (text === t && label(id)) return neu(label(id))
  return text
}

function ArticleSearch({ inventoryItems, onSelect }: {
  inventoryItems: InventoryItem[]
  onSelect: (item: InventoryItem) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const suggestions = query.trim()
    ? inventoryItems.filter(it => it.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : inventoryItems.slice(0, 8)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function select(item: InventoryItem) {
    onSelect(item); setQuery(''); setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ flex: 1 }}>
      <input
        style={{ ...inp, marginTop: 0 }}
        type="text"
        placeholder="Artikel suchen…"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && suggestions.length > 0 && (
        <div style={{ background: 'var(--lbf-card)', border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', borderRadius: 10, marginTop: 4, overflow: 'hidden', maxHeight: 280, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
          {suggestions.map((item, idx) => (
            <button key={item.id} type="button" onMouseDown={() => select(item)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: idx < suggestions.length - 1 ? '0.5px solid var(--lbf-border-light)' : 'none', color: 'var(--lbf-text)' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</span>
              <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', flexShrink: 0, marginLeft: 8 }}>{item.unit}</span>
            </button>
          ))}
        </div>
      )}
      {open && inventoryItems.length === 0 && (
        <div style={{ background: 'var(--lbf-card)', border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', borderRadius: 10, marginTop: 4, padding: '12px 14px', fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
          Keine Artikel in der Datenbank
        </div>
      )}
      {open && suggestions.length === 0 && inventoryItems.length > 0 && query.trim() && (
        <div style={{ background: 'var(--lbf-card)', border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', borderRadius: 10, marginTop: 4, padding: '12px 14px', fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
          Kein Artikel gefunden
        </div>
      )}
    </div>
  )
}

/** Textknopf im LBF-Stil: Akzent, fett, ohne Rahmen. */
const textKnopf: React.CSSProperties = { background: 'none', border: 'none', padding: '6px 0', color: 'var(--lbf-akzent)', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }


export default function OrgProduktausgabe() {
  const { org, orgCode } = useOrg()
  const navigate = useNavigate()
  const [einsatz, setEinsatz] = useState('')
  const [datum, setDatum] = useState(today())
  const [positions, setPositions] = useState<Partial<Pos>[]>([{ qty: 1 }])
  const [sending, setSending] = useState(false)
  const [fertig, setFertig] = useState<Fertig | null>(null)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLagerId, setSelectedLagerId] = useState('')

  // Absender (4.2): Name, Passwort nur im Zustand dieses einen Versuchs, nie gespeichert
  const [name, setName] = useState('')
  const [passwort, setPasswort] = useState('')
  const [anderer, setAnderer] = useState(false)
  const [fehler, setFehler] = useState('')
  const [ablegenAnbieten, setAblegenAnbieten] = useState(false)
  /** Nach „gesperrt“: wie lange die Sperre läuft und was der Server sagte (für die Ablage). */
  const sperre = useRef<{ sekunden?: number; text: string } | null>(null)
  // Kennung des Satzes: entsteht beim ersten Versuch und bleibt bis „Neue Ausgabe“
  const kennung = useRef('')
  const { stand, alterServer } = useFormularStand(orgCode, { mitAnmeldung: !anderer, org })
  const angemeldet = !anderer && !!stand?.angemeldet
  // Derselbe Modus, nach dem AbsenderFeld das Passwortfeld zeigt; beim alten Server gibt es keins
  const modus: AbsenderModus = alterServer ? 'frei' : modusAusStand(stand, 'produktausgabe')

  // Felder nach der Einstellung; eigene nur, wenn der Server sie nimmt (sonst gingen sie verloren)
  const konfig = standardKonfig(org.form_config, 'produktausgabe')
  const mitEigenen = eigeneAngeboten('produktausgabe', { stand, alterServer })
  const alleBausteine = bausteine(konfig, 'produktausgabe')
  const bs = mitEigenen ? alleBausteine : alleBausteine.filter((b) => b.art === 'kern')
  const eigene = eigeneFelder(bs)
  const [werte, setWerte] = useState<Record<string, unknown>>({})
  const [feldFehler, setFeldFehler] = useState<Record<string, string>>({})
  function wertSetzen(id: string, w: unknown) {
    setWerte((p) => ({ ...p, [id]: w }))
    if (feldFehler[id]) setFeldFehler((p) => { const n = { ...p }; delete n[id]; return n })
  }
  /** `daten.eigene` nur, wenn es eigene Felder gibt. */
  function eigeneEingabe(): EigeneEingabe | undefined {
    return eigene.length ? { version: konfig.version, werte: werteBereinigen(eigene, werte) } : undefined
  }
  /** Eigene Felder prüfen; der erste Fehler bekommt den Fokus. */
  function eigenePruefen(): boolean {
    const p = felderPruefen(eigene, werte)
    setFeldFehler(p.fehler)
    if (p.erster) fokusAuf(p.erster)
    return !p.erster
  }

  useEffect(() => {
    pb.collection('inventory_items').getFullList<InventoryItem>({
      filter: `organization_id = "${org.id}"`,
      sort: 'name',
    // Archivierte Artikel und Standorte (Lager, Paket 4) nicht mehr anbieten
    }).then(items => setInventoryItems(items.filter(i => !(i as { archiviert?: boolean }).archiviert))).catch(e => console.error('inventory_items:', e))
    pb.collection('inventory_locations').getFullList<Location>({
      filter: `organization_id = "${org.id}"`,
      sort: 'name',
    }).then(async locs => {
      if (locs.length === 0) {
        const defaultLoc = await pb.collection('inventory_locations').create({
          name: 'Lager', icon: 'box', organization_id: org.id,
        })
        setLocations([defaultLoc as unknown as Location])
        setSelectedLagerId(defaultLoc.id)
      } else {
        const aktiv = locs.filter(l => !(l as { archiviert?: boolean }).archiviert)
        setLocations(aktiv)
        if (aktiv.length === 1) setSelectedLagerId(aktiv[0].id)
      }
    }).catch(e => console.error('inventory_locations:', e))
  }, [org.id])

  const addPos = () => setPositions(p => [...p, { qty: 1 }])
  const delPos = (i: number) => setPositions(p => p.filter((_, j) => j !== i))
  const updQty = (i: number, v: number) =>
    setPositions(p => p.map((r, j) => j === i ? { ...r, qty: v } : r))
  const clearPos = (i: number) =>
    setPositions(p => p.map((r, j) => j === i ? { qty: r.qty } : r))
  const selectItem = useCallback((i: number, item: InventoryItem) =>
    setPositions(p => p.map((r, j) => j === i ? { ...r, name: item.name, item_id: item.id, unit: item.unit } : r)),
    [])

  /** Der Eintrag für Versand und Warteschlange (1.18): daten für die Route, alt für den alten Weg. */
  function eintrag(angabe: ReturnType<typeof absenderAngabe>): NeuerEintrag {
    if (!kennung.current) kennung.current = neueKennung()
    const angemeldetId = angabe.mitAnmeldung ? stand?.angemeldet?.id ?? '' : ''
    const absenderName = (angabe.absender?.name ?? '').trim() || (angabe.mitAnmeldung ? stand?.angemeldet?.name ?? '' : name.trim())
    const lagerName = locations.find(l => l.id === selectedLagerId)?.name ?? ''
    const e = eigeneEingabe()
    return {
      id: kennung.current,
      formular: 'produktausgabe',
      orgCode,
      orgId: org.id,
      absenderName,
      angemeldetId,
      daten: ausgabeDaten(einsatz, datum, selectedLagerId, positions, e),
      alt: ausgabeAlt(einsatz, datum, selectedLagerId, positions, { lagerName, absender: { id: angemeldetId, name: absenderName }, orgId: org.id, eigene: e ? eigeneAngaben(eigene, e) : undefined }),
    }
  }

  function fertigMelden(f: Fertig) {
    setFertig(f)
    setFehler('')
    setAblegenAnbieten(false)
    // Die Karte der Warteschlange sofort zeigen, nicht erst beim nächsten Durchgang
    if (f.art === 'abgelegt') warteschlangeMelden()
  }

  async function submit() {
    if (sending) return
    setFehler('')
    setAblegenAnbieten(false)
    const kern = ausgabePruefen(ausgabeDaten(einsatz, datum, selectedLagerId, positions))
    const eigeneOk = eigenePruefen()
    const pruef = (kern ? kernFehler(kern, bs) : '')
      || absenderPruefen({ angemeldet, name, modus, passwort, online: navigator.onLine !== false, alterServer })
    if (pruef) { setFehler(pruef); return }
    if (!eigeneOk) return
    const angabe = absenderAngabe({ stand, formular: 'produktausgabe', anderer, name, passwort })
    const e = eintrag(angabe)
    setSending(true)
    try {
      const r = await sendenOderAblegen(e, angabe, { modus })
      if (r.art === 'gesendet') {
        const absender: AbsenderEintrag | null = r.absender
        fertigMelden({ art: 'gesendet', absender: absenderZeile(absender, e.absenderName) })
      } else if (r.art === 'abgelegt') {
        fertigMelden({ art: 'abgelegt', meldung: r.meldung })
      } else if (r.art === 'nicht_abgelegt') {
        setFehler(r.meldung)
      } else {
        // Ein eigenes Feld, das der Server ablehnt: der Text am Feld
        const f = serverFeld(r.feld, 'eigene')
        if (r.grund === 'daten' && f && eigene.some((d) => d.id === f)) { setFeldFehler((p) => ({ ...p, [f]: r.meldung })); fokusAuf(f) }
        else setFehler(r.meldung)
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
    const angabe = absenderAngabe({ stand, formular: 'produktausgabe', anderer, name, passwort: '' })
    const r = ablegenMitMeldung(eintrag(angabe), { modus, mitAnmeldung: angabe.mitAnmeldung, anlass: 'gesperrt', sekunden: sperre.current?.sekunden, text: sperre.current?.text })
    if (r.gespeichert) fertigMelden({ art: 'abgelegt', meldung: r.meldung })
    else { setFehler(r.meldung); setAblegenAnbieten(false) }
  }

  /** Modus Passwort, kein Passwort zur Hand: ohne Passwort ablegen (Befund Client-Abläufe 5). */
  function ohnePasswortAblegen() {
    if (sending) return
    setFehler('')
    setAblegenAnbieten(false)
    const kern = ausgabePruefen(ausgabeDaten(einsatz, datum, selectedLagerId, positions))
    const eigeneOk = eigenePruefen()
    const pruef = (kern ? kernFehler(kern, bs) : '')
      || absenderPruefen({ angemeldet: false, name, modus: 'frei', passwort: '', online: true, alterServer })
    if (pruef) { setFehler(pruef); return }
    if (!eigeneOk) return
    setPasswort('')
    const angabe = absenderAngabe({ stand, formular: 'produktausgabe', anderer: true, name, passwort: '' })
    const r = ablegenMitMeldung(eintrag(angabe), { modus, mitAnmeldung: false, anlass: 'ohne_passwort' })
    if (r.gespeichert) fertigMelden({ art: 'abgelegt', meldung: r.meldung })
    else setFehler(r.meldung)
  }

  function reset() {
    setEinsatz(''); setDatum(today())
    setPositions([{ qty: 1 }]); setFertig(null); setSelectedLagerId(locations.length === 1 ? locations[0].id : '')
    setPasswort(''); setFehler(''); setAblegenAnbieten(false)
    setWerte({}); setFeldFehler({})
    // Neue Ausgabe, neue Kennung (4.2); der Name bleibt für die nächste Ausgabe stehen
    kennung.current = ''
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
          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: 'var(--lbf-text)', marginBottom: 8 }}>{gesendet ? 'Erfolgreich gespeichert' : 'Auf dem Gerät gespeichert'}</div>
          <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', marginBottom: gesendet && fertig.absender ? 8 : 24, lineHeight: 1.5 }}>
            {gesendet ? 'Die Ausgabe wurde an die Lagerverwaltung weitergeleitet.' : fertig.meldung}
          </div>
          {gesendet && fertig.absender && (
            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 24 }}>Absender: {fertig.absender}</div>
          )}
          <button style={{ background: 'var(--lbf-akzent-grund)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em' }} onClick={reset}>
            Neue Ausgabe
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
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--lbf-text)' }}>Produktausgabe</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{org.org_name}</div>
          </div>
        </div>
      </header>
      <PubWrap>

        {gruppieren(bs, 'produktausgabe').map((g, gi) => {
          if (g.block === 'positionen') {
            const b = g.teile[0] as Extract<Baustein, { art: 'kern' }>
            return (
              <Card key={`b-${gi}`} title={b.label} hilfe={b.hilfe}>
                {positions.map((pos, i) => (
                  <div key={i} style={{ padding: '.75rem', background: pos.item_id ? 'rgba(var(--lbf-rot-rgb),0.03)' : 'var(--warm-bg)', border: `1.5px solid ${pos.item_id ? 'rgba(var(--lbf-rot-rgb),0.2)' : 'rgba(var(--lbf-rot-rgb),0.1)'}`, borderRadius: 10, marginBottom: '.6rem' }}>
                    <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start' }}>
                      <div style={{ flexShrink: 0, width: 72 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Anz.</div>
                        <input style={{ ...inp, marginTop: 0, textAlign: 'center', padding: '10px 4px' }}
                          type="number" min={1} value={pos.qty ?? 1}
                          onChange={e => updQty(i, Number(e.target.value))} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: pos.item_id ? '#16a34a' : 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                          {pos.item_id ? 'Artikel ausgewählt' : 'Artikel auswählen *'}
                        </div>
                        {pos.item_id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--lbf-card)', border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', borderRadius: 10, padding: '10px 12px' }}>
                            <span style={{ flex: 1, fontWeight: 700, fontStyle: 'italic', fontSize: 14, color: 'var(--lbf-text)', wordBreak: 'break-word' }}>{pos.name}</span>
                            <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', flexShrink: 0 }}>{pos.unit}</span>
                            <button type="button" onClick={() => clearPos(i)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 20, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
                          </div>
                        ) : null}
                      </div>
                      <button type="button" onClick={() => delPos(i)}
                        style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--lbf-akzent-weich)', color: 'var(--lbf-akzent)', fontWeight: 700, cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0, alignSelf: 'flex-end', marginBottom: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ×
                      </button>
                    </div>
                    {!pos.item_id && (
                      <div style={{ marginTop: '.5rem' }}>
                        <ArticleSearch inventoryItems={inventoryItems} onSelect={item => selectItem(i, item)} />
                      </div>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addPos}
                  style={{ border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--lbf-akzent-weich)', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, color: 'var(--lbf-akzent)', fontSize: 13, fontFamily: 'inherit', letterSpacing: '0.02em' }}>
                  + Position hinzufügen
                </button>
              </Card>
            )
          }
          if (g.block === 'lager_id') {
            const b = g.teile[0] as Extract<Baustein, { art: 'kern' }>
            return (
              <Card key={`b-${gi}`} title={`${b.label} *`} hilfe={b.hilfe}>
                {locations.length === 0 ? (
                  <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Keine Verbrauchsorte gefunden</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {locations.map(loc => (
                      <button key={loc.id} type="button" onClick={() => setSelectedLagerId(loc.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: selectedLagerId === loc.id ? '1.5px solid var(--lbf-akzent)' : '1.5px solid var(--lbf-border)', background: selectedLagerId === loc.id ? 'var(--lbf-akzent-weich)' : 'var(--lbf-card)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: selectedLagerId === loc.id ? '2px solid var(--lbf-akzent)' : '2px solid rgba(var(--lbf-rot-rgb),0.2)', background: selectedLagerId === loc.id ? 'var(--lbf-akzent-grund)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {selectedLagerId === loc.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                        </div>
                        <span style={{ fontWeight: selectedLagerId === loc.id ? 700 : 400, fontStyle: selectedLagerId === loc.id ? 'italic' : 'normal', fontSize: 15, color: 'var(--lbf-text)' }}>{loc.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            )
          }
          return (
            <PubSection key={`g-${gi}`} title={g.titel} open>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', columnGap: '.75rem' }}>
                {g.teile.map((b) => {
                  if (b.art === 'eigen') {
                    return (
                      <div key={b.feld.id} style={{ gridColumn: '1 / -1' }}>
                        <FeldEingabe feld={b.feld} wert={werte[b.feld.id]} onWert={(w) => wertSetzen(b.feld.id, w)} fehler={feldFehler[b.feld.id]} />
                      </div>
                    )
                  }
                  if (b.id === 'einsatz') {
                    return (
                      <div key="einsatz" style={field}>
                        <label style={lbl} htmlFor={feldElementId('einsatz')}>{b.label} *</label>
                        {b.hilfe ? <div style={{ ...hilfeStil, margin: '4px 0 0' }}>{b.hilfe}</div> : null}
                        <input id={feldElementId('einsatz')} style={inp} type="text" placeholder="z.B. 2025-001" maxLength={EINSATZ_MAX} value={einsatz} onChange={e => setEinsatz(e.target.value)} />
                      </div>
                    )
                  }
                  if (b.id === 'datum') {
                    return (
                      <div key="datum" style={field}>
                        <label style={lbl} htmlFor={feldElementId('datum')}>{b.label} *</label>
                        {b.hilfe ? <div style={{ ...hilfeStil, margin: '4px 0 0' }}>{b.hilfe}</div> : null}
                        <input id={feldElementId('datum')} style={inp} type="date" value={datum} onChange={e => setDatum(e.target.value)} />
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            </PubSection>
          )
        })}

        <div style={{ background: 'var(--lbf-card)', borderLeft: '3px solid var(--lbf-akzent)', borderRadius: 12, marginBottom: '.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '1rem' }}>
          <AbsenderFeld
            orgCode={orgCode}
            formular="produktausgabe"
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

        {fehler && (
          <div role="alert" style={{ background: 'var(--lbf-fehler-grund)', border: '0.5px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--lbf-fehler-text)', fontStyle: 'italic', marginBottom: '.75rem', lineHeight: 1.5 }}>
            {fehler}
            {ablegenAnbieten && (
              <div style={{ marginTop: 6 }}>
                <button type="button" onClick={aufGeraetAblegen} style={{ ...textKnopf, fontStyle: 'normal' }}>{ABSENDER_TEXTE.ablegen}</button>
              </div>
            )}
          </div>
        )}

      </PubWrap>
      <PubSendBar onSubmit={submit} sending={sending} label={sendeKnopfText({ stand, anderer }, 'An Lager senden')} small />
    </div>
  )
}
