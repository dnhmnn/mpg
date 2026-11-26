// Daten der Hygiene: Objekte (auch archivierte) und Durchführungen der letzten 400 Tage der eigenen
// Organisation, mit Echtzeit. Geschrieben wird über die Pläne (src/lib/hygiene/aktionen.ts) mit
// schreibeZusammen: alles oder nichts, eine Kennung vom Gerät, erneut senden legt nichts doppelt an.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pb } from '../../lib/pocketbase'
import { useHeute } from '../../hooks/useHeute'
import { pbFehlerText } from '../../lib/pbFehler'
import { pbOptionen, pbSchreiber, schreibeZusammen, SchreibFehler, type Anfrage, type Server } from '../../lib/mpg/schreiben'
import { plusTage, tagVonDatum } from '../../lib/mpg/fristen'
import { standVon, type HyStand } from '../../lib/hygiene/fristen'
import { punkteBereinigen } from '../../lib/hygiene/checklisten'
import type { Quellen } from '../../lib/hygiene/vorschlaege'
import type { HyDurchfuehrung, HyObjekt, HyVorlage } from '../../lib/hygiene/typen'
import type { User } from '../../types'

export type Ausgang = 'ok' | 'unklar' | 'fehler' | 'belegt'

/** JSON-Felder kommen je nach Server als Text — immer als Liste lesen. */
function liste(x: unknown): unknown[] {
  if (Array.isArray(x)) return x
  if (typeof x === 'string') { try { const v = JSON.parse(x); return Array.isArray(v) ? v : [] } catch { return [] } }
  return []
}
function objektLesen(o: HyObjekt): HyObjekt {
  return { ...o, punkte: punkteBereinigen(liste(o.punkte)), standort: o.standort || '', quelle: o.quelle || '', quelle_id: o.quelle_id || '', quelle_name: o.quelle_name || '', vorlage_id: o.vorlage_id || '', archiviert: o.archiviert || '', intervall_tage: Number(o.intervall_tage) || 0 }
}
function vorlageLesen(v: HyVorlage): HyVorlage {
  return { ...v, punkte: punkteBereinigen(liste(v.punkte)), archiviert: v.archiviert || '', intervall_tage: Number(v.intervall_tage) || 0 }
}
function dfLesen(d: HyDurchfuehrung): HyDurchfuehrung {
  const punkte = liste(d.punkte).map(p => ({ text: String((p as { text?: unknown })?.text ?? ''), erledigt: (p as { erledigt?: unknown })?.erledigt === true })).filter(p => p.text)
  return { ...d, punkte, offen: Number(d.offen) || punkte.filter(p => !p.erledigt).length, anlass: d.anlass || '', einsatz_nummer: d.einsatz_nummer || '', bemerkung: d.bemerkung || '' }
}

export function useHygieneDaten(user: User | null) {
  const org = user?.organization_id || ''
  const heute = useHeute()
  const [objekte, setObjekte] = useState<HyObjekt[]>([])
  const [dfs, setDfs] = useState<HyDurchfuehrung[]>([])
  const [vorlagen, setVorlagen] = useState<HyVorlage[]>([])
  /** Gibt es hygiene_vorlagen am Server? (Vor dem neuen Einrichtungsskript nicht: dann nur die Vorlagen von Responda) */
  const [vorlagenDa, setVorlagenDa] = useState(true)
  const [laedt, setLaedt] = useState(true)
  const [fehlt, setFehlt] = useState(false)
  /** Einmal vollständig geladen? Vorher keine Vorschläge und kein Anlegen (sonst Doppeltes) */
  const [geladen, setGeladen] = useState(false)
  /** Letztes Laden gescheitert (Funkloch, Zeitlimit): angezeigt wird der Stand davor */
  const [ladeFehler, setLadeFehler] = useState(false)
  const ladeNr = useRef(0)
  const [busy, setBusy] = useState(false)
  const laeuft = useRef(false)
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null)
  const zeit = useRef(0)
  const melden = useCallback((text: string, fehler = false) => {
    setMeldung({ text, fehler })
    window.clearTimeout(zeit.current)
    zeit.current = window.setTimeout(() => setMeldung(null), fehler ? 6000 : 3500)
  }, [])

  const laden = useCallback(async () => {
    if (!org) return
    // Nur die zuletzt gestartete Anfrage zählt: Eine ältere, spät ankommende Antwort überschreibt nie einen neueren Stand
    const nr = ++ladeNr.current
    const seit = plusTage(tagVonDatum(new Date()), -400)
    try {
      const [o, d] = await Promise.all([
        pb.collection('hygiene_objekte').getFullList<HyObjekt>({ filter: pb.filter('organization_id = {:o}', { o: org }), sort: 'name', ...pbOptionen() }),
        pb.collection('hygiene_durchfuehrungen').getFullList<HyDurchfuehrung>({ filter: pb.filter('organization_id = {:o} && zeitpunkt >= {:s}', { o: org, s: `${seit} 00:00:00` }), sort: '-zeitpunkt', batch: 500, ...pbOptionen() }),
      ])
      // Vorlagen für sich: Fehlen sie am Server noch, geht der Rest trotzdem
      const v = await pb.collection('hygiene_vorlagen').getFullList<HyVorlage>({ filter: pb.filter('organization_id = {:o}', { o: org }), sort: 'name', ...pbOptionen() })
        .then(l => ({ da: true, l })).catch((e: { status?: number }) => ({ da: e?.status !== 404, l: null as HyVorlage[] | null }))
      if (nr !== ladeNr.current) return
      setVorlagenDa(v.da)
      if (v.l) setVorlagen(v.l.map(vorlageLesen))
      setObjekte(o.map(objektLesen))
      setDfs(d.map(dfLesen))
      setFehlt(false)
      setGeladen(true)
      setLadeFehler(false)
    } catch (e) {
      if (nr !== ladeNr.current) return
      // 404: Sammlungen fehlen am Server noch (scripts/hygiene-einrichten.py)
      if ((e as { status?: number })?.status === 404) setFehlt(true)
      else setLadeFehler(true)
    } finally { if (nr === ladeNr.current) setLaedt(false) }
  }, [org])

  useEffect(() => {
    if (!org) return
    void laden()
    const neu = () => { void laden() }
    pb.collection('hygiene_objekte').subscribe('*', neu).catch(() => {})
    pb.collection('hygiene_durchfuehrungen').subscribe('*', neu).catch(() => {})
    pb.collection('hygiene_vorlagen').subscribe('*', neu).catch(() => {})
    return () => {
      pb.collection('hygiene_vorlagen').unsubscribe('*').catch(() => {})
      pb.collection('hygiene_objekte').unsubscribe('*').catch(() => {})
      pb.collection('hygiene_durchfuehrungen').unsubscribe('*').catch(() => {})
    }
  }, [org, laden])

  // Eine einzelne Anfrage ohne Sammelbuchung: PocketBase 0.23.4 ersetzt in der Sammelbuchung die Meldungen
  // des Hooks (z. B. „Zeitpunkt liegt in der Zukunft“) durch einen allgemeinen englischen Text
  const schreiber = useMemo<Server>(() => {
    const s = pbSchreiber(pb)
    return { sendeBatch: (a) => (a.length === 1 ? s.sende(a[0]) : s.sendeBatch(a)), sende: s.sende }
  }, [])
  /** Den gespeicherten Stand gleich übernehmen, bis das Nachladen ihn bestätigt */
  const uebernehmen = useCallback((anfragen: Anfrage[]) => {
    const jetzt = new Date().toISOString().replace('T', ' ')
    for (const a of anfragen) {
      if (a.collection === 'hygiene_objekte') {
        if (a.aktion === 'create') setObjekte(l => (l.some(x => x.id === a.id) ? l : [...l, objektLesen({ ...(a.body as unknown as HyObjekt), id: a.id, created: jetzt, updated: jetzt })]))
        else setObjekte(l => l.map(x => (x.id === a.id ? objektLesen({ ...x, ...(a.body as Partial<HyObjekt>), ...(a.body.archiviert ? { archiviert: jetzt } : {}) }) : x)))
      } else if (a.collection === 'hygiene_vorlagen') {
        if (a.aktion === 'create') setVorlagen(l => (l.some(x => x.id === a.id) ? l : [...l, vorlageLesen({ ...(a.body as unknown as HyVorlage), id: a.id, created: jetzt, updated: jetzt })]))
        else setVorlagen(l => l.map(x => (x.id === a.id ? vorlageLesen({ ...x, ...(a.body as Partial<HyVorlage>), ...(a.body.archiviert ? { archiviert: jetzt } : {}) }) : x)))
      } else if (a.collection === 'hygiene_durchfuehrungen' && a.aktion === 'create') {
        setDfs(l => (l.some(x => x.id === a.id) ? l : [dfLesen({ ...(a.body as unknown as HyDurchfuehrung), id: a.id, created: jetzt }), ...l]))
      }
    }
  }, [])
  /** Schreibt einen Plan. 'unklar': keine Antwort — mit DENSELBEN Anfragen erneut senden. */
  const ausfuehren = useCallback(async (anfragen: Anfrage[], erfolg: string): Promise<Ausgang> => {
    if (laeuft.current) return 'belegt'
    laeuft.current = true
    setBusy(true)
    try {
      const r = await schreibeZusammen(schreiber, anfragen)
      melden(r === 'schon' ? 'War bereits gespeichert' : erfolg)
      if (r !== 'schon') uebernehmen(anfragen)
      void laden()
      return 'ok'
    } catch (e) {
      const unklar = e instanceof SchreibFehler && (e.art === 'netz' || e.teilweise)
      melden(unklar ? 'Keine Antwort vom Server — ob es gespeichert wurde, ist offen. Bitte erneut senden.' : (e instanceof SchreibFehler ? e.message : pbFehlerText(e)), true)
      if (unklar) void laden()
      return unklar ? 'unklar' : 'fehler'
    } finally {
      laeuft.current = false
      setBusy(false)
    }
  }, [schreiber, laden, melden, uebernehmen])

  const staende = useMemo(() => {
    const m = new Map<string, HyStand>()
    for (const o of objekte) m.set(o.id, standVon(o, dfs, heute))
    return m
  }, [objekte, dfs, heute])

  const aktiv = useMemo(() => objekte.filter(o => !o.archiviert), [objekte])

  /** Quellen für Vorschläge (Route am Server; nur mit „Hygiene verwalten“). */
  const quellenLaden = useCallback(async (): Promise<{ ok: true; q: Quellen } | { ok: false; grund: 'route' | 'recht' | 'netz' }> => {
    try {
      const r = await pb.send<Partial<Quellen>>('/api/responda/hygiene/quellen', { method: 'GET', requestKey: null })
      const arr = <T,>(x: unknown) => (Array.isArray(x) ? x as T[] : [])
      return { ok: true, q: { geraete: arr(r?.geraete), orte: arr(r?.orte), saetze: arr(r?.saetze), artikel: arr(r?.artikel) } }
    } catch (e) {
      const s = (e as { status?: number })?.status
      return { ok: false, grund: s === 404 ? 'route' : s === 401 || s === 403 ? 'recht' : 'netz' }
    }
  }, [])

  return { objekte, aktiv, dfs, vorlagen, vorlagenDa, staende, heute, laedt, fehlt, geladen, ladeFehler, busy, meldung, setMeldung, melden, laden, ausfuehren, quellenLaden }
}

export type HygieneDaten = ReturnType<typeof useHygieneDaten>

/** Ausgeblendete Vorschläge: nur auf diesem Gerät (Bequemlichkeit, kein Nachweis). */
const AUS_SCHLUESSEL = (org: string) => `hygiene_vorschlaege_aus:${org}`
export function ausgeblendetLesen(org: string): string[] {
  try { const v = JSON.parse(localStorage.getItem(AUS_SCHLUESSEL(org)) || '[]'); return Array.isArray(v) ? v.map(String) : [] } catch { return [] }
}
export function ausgeblendetSchreiben(org: string, liste: string[]) {
  try { localStorage.setItem(AUS_SCHLUESSEL(org), JSON.stringify([...new Set(liste)].slice(-2000))) } catch { /* ohne Speicher: dann eben nicht */ }
}

/** „23.11.2026, 14:05“ */
export function zeitText(s: string | undefined): string {
  if (!s) return '—'
  const d = new Date(s.replace(' ', 'T'))
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
/** „14:05“ */
export function uhrText(s: string | undefined): string {
  if (!s) return ''
  const d = new Date(s.replace(' ', 'T'))
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}
