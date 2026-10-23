// Gemeinsamer Datenstand des MPG-Moduls: Geräte, Defekte, Meldungen, Vorlagen — einmal
// geladen, von allen Seiten genutzt. Dazu die Schreibwege aus Paket 1 (genau einmal,
// unklare Versuche festgeschrieben) und die lokal gehaltenen Daten je Person
// (begonnene Prüfung, unklare Defektmeldungen und Bestätigungen).
//
// Prüfprotokolle werden NICHT hier geladen, sondern seitenweise dort, wo sie gebraucht
// werden (Gerätebuch, Logbuch) — nach einem Jahr täglicher Checks wären es sonst
// zehntausende Datensätze bei jedem Öffnen.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { pb } from '../../lib/pocketbase'
import { useAuth } from '../../hooks/useAuth'
import { faelligFeld, kalendertag, tagVonDatum } from '../../lib/mpg/fristen'
import { istAusserBetrieb, zustandVon, type Stufe, type Zustand } from '../../lib/mpg/zustand'
import { planeGeraetAenderung, planeLoeschen, planeNeuesGeraet, stammdatenText, type Stammdaten } from '../../lib/mpg/aktionen'
import { darfMpgVerwalten } from '../../lib/mpg/rechte'
import { vorlageWaehlen } from '../../lib/mpg/pruefung'
import { neueId, pbOptionen, pbSchreiber, schreibeZusammen, SchreibFehler, type Anfrage } from '../../lib/mpg/schreiben'
import { restNachAnker } from '../../lib/mpg/aktionen'
import { entwurfSchluessel, unklarSchluessel } from '../../lib/mpg/lokal'
import { pbFehlerText } from '../../lib/pbFehler'
import { DEFAULT_CHECKLISTS, type Checklist, type Defect, type Device, type ExternalReport, type PruefStand, type Severity } from './typen'

const schreiber = pbSchreiber(pb)

export function fehlerText(e: unknown): string {
  return e instanceof SchreibFehler ? e.message : pbFehlerText(e)
}

export type DefektFormular = { description: string; severity: Severity; sperren: boolean; id: string; unklar: boolean; seit?: string }

/**
 * Ein gesendeter Vorgang eines Blatts, dessen Ausgang unklar ist: genau dieser Plan wird
 * erneut gesendet. updatedVorher ist die Serverzeit der letzten Änderung des Geräts vor dem
 * ersten Senden — daran zeigt sich, ob es sich seitdem geändert hat (ohne die Uhr des Handys).
 * einzeln: Der erste Versuch ging als einzelne Anfragen raus (Batch API aus) — dann kann ein
 * Teil angekommen sein; als Sammelbuchung kam alles oder nichts an.
 */
export interface BlattVersuch { anfragen: Anfrage[]; seit: string; updatedVorher: string; id: string; einzeln?: boolean }

interface Unklar {
  /** je Geräte-ID die gesendete Defektmeldung */
  defekte: Record<string, DefektFormular>
  /** je Meldungs-ID die gesendete Bestätigung */
  bestaetigungen: Record<string, { anmerkung: string; sperren: boolean; seit?: string }>
  /** je Blatt („freigeben:<Gerät>“ …) der unklar gesendete Vorgang — übersteht Schließen und Neuladen */
  blaetter: Record<string, BlattVersuch>
}
const KEIN_UNKLAR: Unklar = { defekte: {}, bestaetigungen: {}, blaetter: {} }

export const ohne = <T,>(o: Record<string, T>, k: string) => { const { [k]: _, ...rest } = o; return rest }

/**
 * Wird ein unklarer Versuch erst nach längerer Zeit erneut gesendet, kann sich am Gerät
 * inzwischen etwas geändert haben (z. B. repariert und freigegeben) — vorher nachfragen.
 */
export function altenVersuchSenden(seit: string | undefined): boolean {
  const t = seit ? new Date(seit).getTime() : NaN
  if (!Number.isFinite(t) || Date.now() - t < 30 * 60_000) return true
  const wann = new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return confirm(`Dieser Speicherversuch ist vom ${wann}. Seitdem kann sich am Gerät etwas geändert haben (z. B. repariert und freigegeben) — eine Sperre darin würde erneut gesetzt.\n\nTrotzdem erneut senden?`)
}

export type Blatt =
  | { art: 'defekt'; device: Device }
  | { art: 'beheben'; defekt: Defect }
  | { art: 'bestaetigen'; meldung: ExternalReport }
  | { art: 'ablehnen'; meldung: ExternalReport }
  | { art: 'sperren' | 'freigeben' | 'ausserBetrieb' | 'wiederInBetrieb'; device: Device }
  | { art: 'vermerk'; device: Device; bezug?: { id: string; text: string } }
  | null

export type Ausgang = 'ok' | 'unklar' | 'fehler' | 'belegt'

export interface GeraetFelder extends Stammdaten { interval: Device['interval'] }

function useMpgDatenWert() {
  const { user, loading: authLoading } = useAuth()

  const [devices, setDevices] = useState<Device[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [defects, setDefects] = useState<Defect[]>([])
  const [externalReports, setExternalReports] = useState<ExternalReport[]>([])
  const [loading, setLoading] = useState(true)
  const [ladefehler, setLadefehler] = useState('')
  const [geraeteGeladen, setGeraeteGeladen] = useState(false)
  // Eine Prüfung beginnt erst, wenn die Vorlagen der Organisation da sind — sonst
  // liefe sie mit der Standardliste statt mit der eigenen Vorlage
  const [vorlagenGeladen, setVorlagenGeladen] = useState(false)
  // Gibt es das Gerätebuch (Collection mpg_ereignisse) schon in PocketBase? Bis es
  // eingerichtet ist, schreibt alles ohne Gerätebuch — nichts scheitert daran.
  const [buch, setBuch] = useState(false)
  // „MPG verwalten“ — die App blendet nur aus, durchgesetzt wird es in den API-Regeln.
  // Bei jedem Zeichnen neu: Ein befristetes Recht kann während der Sitzung ablaufen.
  const darfVerwalten = darfMpgVerwalten(user)

  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout>>()
  // Läuft gerade ein Schreibvorgang? Sperrt die Knöpfe gegen Doppeltippen.
  const [busy, setBusy] = useState(false)
  const laeuft = useRef(false)
  const [blatt, setBlatt] = useState<Blatt>(null)
  // Zählt erfolgreiche Schreibvorgänge — Gerätebuch und Verlauf laden danach neu
  const [schreibStand, setSchreibStand] = useState(0)

  // Begonnene Prüfung und unklare Speicherungen liegen je Person und Organisation (src/lib/mpg/lokal.ts)
  const entwurfKey = user?.id ? entwurfSchluessel(user.id, user.organization_id) : ''
  const unklarKey = user?.id ? unklarSchluessel(user.id, user.organization_id) : ''
  const unklarRef = useRef<Unklar>(KEIN_UNKLAR)
  const [unklarStand, setUnklarStand] = useState(0)
  const [entwurfStand, setEntwurfStand] = useState(0)
  // Die Prüfung, deren Speichern gerade läuft (ids.pruefung) — auch wenn ihre Seite schon verlassen ist
  const [laufendePruefung, setLaufendePruefung] = useState<string | null>(null)

  // ── Lokale Daten ────────────────────────────────────────────────────────

  useEffect(() => {
    let u: Unklar = KEIN_UNKLAR
    try { const roh = unklarKey && localStorage.getItem(unklarKey); if (roh) u = { ...KEIN_UNKLAR, ...JSON.parse(roh) } } catch { /* kaputt — leer */ }
    unklarRef.current = u
    setUnklarStand(n => n + 1)
  }, [unklarKey])

  function aendereUnklar(f: (u: Unklar) => Unklar) {
    unklarRef.current = f(unklarRef.current)
    try { if (unklarKey) localStorage.setItem(unklarKey, JSON.stringify(unklarRef.current)) } catch { /* ohne Speicher nur bis zum Neuladen */ }
    setUnklarStand(n => n + 1)
  }

  function leseEntwurf(): PruefStand | null {
    if (!entwurfKey) return null
    try {
      const e = JSON.parse(localStorage.getItem(entwurfKey) || 'null')
      if (!e || !Array.isArray(e.results) || !e.ids?.pruefung || !e.ids?.defekt || !e.device_id) return null
      return { device_id: e.device_id, items: e.items ?? e.results.map((r: { item: string }) => r.item), results: e.results, notes: e.notes ?? '', ids: e.ids, versucht: e.versucht }
    } catch { return null }
  }

  function schreibeEntwurf(st: PruefStand | null) {
    if (!entwurfKey) return
    try {
      if (st) localStorage.setItem(entwurfKey, JSON.stringify(st))
      else localStorage.removeItem(entwurfKey)
    } catch { /* ohne Speicher geht es auch */ }
    setEntwurfStand(n => n + 1)
  }

  /**
   * Entwurf nur ändern, wenn er noch DIESE Prüfung ist — ein Speichern, das nach dem Verlassen
   * der Seite endet, darf eine inzwischen begonnene andere Prüfung nicht anfassen.
   */
  function entwurfWenn(pruefungId: string, neu: PruefStand | null) {
    if (leseEntwurf()?.ids.pruefung === pruefungId) schreibeEntwurf(neu)
  }

  // ── Laden ───────────────────────────────────────────────────────────────

  // Nur das jeweils letzte Laden zählt (es kann nach dem Speichern mehrfach angestoßen werden)
  const ladeNr = useRef(0)
  async function loadAll() {
    if (!user?.organization_id) return
    const nr = ++ladeNr.current
    setLoading(true)
    try {
      await Promise.all([loadDevices(), loadChecklists(), loadDefects(), loadExternalReports(), pruefeBuch()])
      if (nr === ladeNr.current) setLadefehler('')
    } catch (e) {
      if (nr === ladeNr.current && !(e as { isAbort?: boolean })?.isAbort) setLadefehler(pbFehlerText(e))
    } finally {
      if (nr === ladeNr.current) setLoading(false)
    }
  }

  // Je Liste zählt nur die Antwort der neuesten Anfrage — eine verspätete ältere
  // Antwort (Funkloch) darf einen neueren Stand nicht überschreiben
  const ladeGen = useRef({ geraete: 0, defekte: 0, meldungen: 0, vorlagen: 0 })
  function neuesteAnfrage(k: keyof typeof ladeGen.current) {
    const n = ++ladeGen.current[k]
    return () => n === ladeGen.current[k]
  }

  async function loadDevices() {
    const aktuell = neuesteAnfrage('geraete')
    const r = await pb.collection('mpg_devices').getFullList<Device>({ filter: pb.filter('organization_id = {:o}', { o: user!.organization_id }), sort: 'name', requestKey: null })
    if (!aktuell()) return
    setDevices(r)
    setGeraeteGeladen(true)
  }

  async function loadDefects() {
    const aktuell = neuesteAnfrage('defekte')
    try {
      const r = await pb.collection('mpg_defects').getFullList<Defect>({ filter: pb.filter('organization_id = {:o}', { o: user!.organization_id }), sort: '-created', requestKey: null })
      if (!aktuell()) return
      setDefects(r)
      // Unklar gesendete Defektmeldungen, deren Anker (der Defekt) angekommen ist, sind erledigt
      const da = new Set(r.map(d => d.id))
      const erledigt = Object.entries(unklarRef.current.defekte).filter(([, f]) => da.has(f.id)).map(([g]) => g)
      if (erledigt.length) aendereUnklar(u => ({ ...u, defekte: Object.fromEntries(Object.entries(u.defekte).filter(([g]) => !erledigt.includes(g))) }))
    } catch { /* collection not yet created */ }
  }

  async function loadExternalReports() {
    const aktuell = neuesteAnfrage('meldungen')
    try {
      const r = await pb.collection('mpg_defect_reports').getFullList<ExternalReport>({ filter: pb.filter('organization_id = {:o}', { o: user!.organization_id }), sort: '-created', requestKey: null })
      if (!aktuell()) return
      setExternalReports(r)
      // Unklare Bestätigungen zu Meldungen, die nicht mehr offen sind, sind erledigt
      const offen = new Set(r.filter(m => m.status === 'pending').map(m => m.id))
      if (Object.keys(unklarRef.current.bestaetigungen).some(id => !offen.has(id))) {
        aendereUnklar(u => ({ ...u, bestaetigungen: Object.fromEntries(Object.entries(u.bestaetigungen).filter(([id]) => offen.has(id))) }))
      }
    } catch { /* collection not yet created */ }
  }

  // Ohne eigene Vorlagen gilt die Standardliste je Typ (vorlageFuer) — angelegt wird eine
  // Vorlage erst, wenn jemand mit „MPG verwalten“ sie speichert
  async function loadChecklists() {
    const aktuell = neuesteAnfrage('vorlagen')
    const records = await pb.collection('mpg_checklists').getFullList<Checklist>({ filter: pb.filter('organization_id = {:o}', { o: user!.organization_id }), requestKey: null })
    if (!aktuell()) return
    setChecklists(records)
    setVorlagenGeladen(true)
  }

  /** Gerätebuch vorhanden und lesbar? Ohne Antwort (Funkloch) bleibt der letzte Stand. */
  async function pruefeBuch() {
    try {
      await pb.collection('mpg_ereignisse').getList(1, 1, { filter: pb.filter('organization_id = {:o}', { o: user!.organization_id }), fields: 'id', requestKey: null })
      setBuch(true)
    } catch (e) {
      // 404: Collection fehlt · 403: Regeln noch nicht eingetragen · 400: Felder fehlen
      if ([400, 403, 404].includes((e as { status?: number })?.status ?? 0)) setBuch(false)
    }
  }

  useEffect(() => {
    if (!user?.organization_id) return
    loadAll()
  }, [user?.organization_id])

  // ── Hilfen ──────────────────────────────────────────────────────────────

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMsg({ text, type })
    clearTimeout(msgTimer.current)
    // Fehler bleiben länger stehen — sie wollen gelesen werden
    msgTimer.current = setTimeout(() => setMsg(null), type === 'error' ? 8000 : 3000)
  }

  const wer = () => ({ organization_id: user!.organization_id, name: user?.name || user?.email || 'Unbekannt' })
  const heute = tagVonDatum(new Date())

  // Der Bestand: was außer Betrieb genommen ist, steht in keiner Liste und keiner Zählung mehr
  const bestand = useMemo(() => devices.filter(d => !istAusserBetrieb(d)), [devices])
  // Gibt es die Felder der Außerbetriebnahme schon? PocketBase liefert jedes Feld mit, auch
  // leer — fehlt es, würde ein Speichern still verworfen
  const ausserBetriebMoeglich = devices.some(d => 'ausser_betrieb' in d)

  /** Name eines Geräts — eine Meldung von außen kann ohne Namen ankommen (Geräteliste nicht geladen) */
  const geraeteName = (id: string, gespeichert?: string | null) => gespeichert?.trim() || devices.find(d => d.id === id)?.name || 'Unbekanntes Gerät'

  const offeneDefekteVon = (id: string) => defects.filter(d => d.device_id === id && d.status !== 'resolved')
  const offeneMeldungenVon = (id: string) => externalReports.filter(r => r.device_id === id && r.status === 'pending')

  const zustaende = useMemo(() => {
    const m = new Map<string, Zustand>()
    for (const d of devices) {
      m.set(d.id, zustandVon(d, defects.filter(x => x.device_id === d.id && x.status !== 'resolved'),
        externalReports.filter(r => r.device_id === d.id && r.status === 'pending'), heute))
    }
    return m
  }, [devices, defects, externalReports, heute])
  const zustand = (d: Device): Zustand => zustaende.get(d.id) ?? zustandVon(d, offeneDefekteVon(d.id), offeneMeldungenVon(d.id), heute)

  const stats = useMemo(() => {
    const s: Record<Stufe, number> = { gesperrt: 0, handlung: 0, bald: 0, ok: 0 }
    for (const d of bestand) { const z = zustaende.get(d.id); if (z) s[z.stufe]++ }
    return s
  }, [zustaende, bestand])

  /** Prüfpunkte für ein Gerät und woher sie kommen (src/lib/mpg/pruefung.ts, vorlageWaehlen). */
  const vorlageMitQuelle = (device: Pick<Device, 'type'>) => vorlageWaehlen(device.type, checklists, DEFAULT_CHECKLISTS)
  const vorlageFuer = (device: Pick<Device, 'type'>): string[] => vorlageMitQuelle(device).punkte

  /** Gibt es den Datensatz schon? (Anker eines unklaren Versuchs) — ohne 404 als Fehler. */
  async function gibtEs(collection: string, id: string): Promise<boolean> {
    const r = await pb.collection(collection).getList(1, 1, { filter: pb.filter('id = {:id}', { id }), fields: 'id', ...pbOptionen() })
    return r.totalItems > 0
  }

  /**
   * Vor dem erneuten Senden eines unklaren Versuchs, der ein Gerät freigibt oder seinen
   * Betriebszustand ändert: Ist er schon angekommen (Eintrag im Gerätebuch da), nicht noch
   * einmal — sonst gäbe er ein inzwischen wieder gesperrtes Gerät erneut frei. Ohne
   * Gerätebuch: Hat sich das Gerät seit dem ersten Versuch geändert, nachfragen.
   */
  async function vorErneutemSenden(o: { versuch: BlattVersuch; geraetId: string; was: string }): Promise<{ weiter: 'schon' } | { weiter: 'senden'; anfragen: Anfrage[] } | { weiter: 'abbrechen' }> {
    const plan = o.versuch.anfragen
    // Was der Vorgang am Gerät setzt — zeigt das Gerät diesen Stand schon?
    const soll: Record<string, unknown> = Object.assign({}, ...plan.filter(a => a.collection === 'mpg_devices' && a.aktion === 'update' && a.id === o.geraetId).map(a => a.body))
    const DATUM = ['ausser_betrieb', 'last_stk', 'last_mtk', 'last_inspection']
    const norm = (k: string, v: unknown) => v === null || v === undefined ? '' : DATUM.includes(k) ? (kalendertag(String(v)) ?? '') : typeof v === 'string' ? v.trim() : String(v)
    const eintrag = plan.find(a => a.collection === 'mpg_ereignisse' && a.aktion === 'create')
    const r = await mitSperre(async () => {
      const eintragDa = !!eintrag && buch && await gibtEs('mpg_ereignisse', eintrag.id)
      const g = await pb.collection('mpg_devices').getOne<Record<string, unknown>>(o.geraetId, { fields: ['id', 'updated', ...Object.keys(soll)].join(','), ...pbOptionen() })
      return {
        eintragDa,
        spiegelt: Object.entries(soll).every(([k, v]) => norm(k, g[k]) === norm(k, v)),
        unveraendert: !!o.versuch.updatedVorher && g.updated === o.versuch.updatedVorher,
      }
    })
    if (!r.ok) return { weiter: 'abbrechen' }
    const { eintragDa, spiegelt, unveraendert } = r.wert
    const fertig = () => { showMsg('War bereits gespeichert'); setSchreibStand(n => n + 1); return { weiter: 'schon' as const } }
    const nachfragen = () => confirm(`Seit dem ersten Versuch wurde das Gerät geändert — vielleicht ist „${o.was}“ schon angekommen und danach hat jemand etwas geändert (z. B. gesperrt). Bitte erst den Stand prüfen.\n\nTrotzdem erneut senden?`)
    if (eintragDa) {
      // Der Eintrag ist der Anker. Danach im Plan steht höchstens noch das Gerät. Unverändert
      // seit dem ersten Versuch: Das kam nicht an (eine angekommene Sammelbuchung hätte das
      // Gerät mitgeändert) — nachschicken. Geändert: Als Sammelbuchung kam alles an, danach
      // hat jemand etwas geändert; einzeln geschrieben ist es unklar — nachfragen.
      const rest = restNachAnker(plan)
      if (!rest.length || spiegelt) return fertig()
      if (unveraendert) return { weiter: 'senden', anfragen: rest }
      if (!o.versuch.einzeln) return fertig()
      if (nachfragen()) return { weiter: 'senden', anfragen: rest }
      return { weiter: 'abbrechen' }
    }
    if (unveraendert || spiegelt || nachfragen()) return { weiter: 'senden', anfragen: plan }
    return { weiter: 'abbrechen' }
  }

  const blattVersuch = (schluessel: string): BlattVersuch | null => unklarRef.current.blaetter?.[schluessel] ?? null
  function merkeBlattVersuch(schluessel: string, v: BlattVersuch | null) {
    aendereUnklar(u => ({ ...u, blaetter: v ? { ...(u.blaetter ?? {}), [schluessel]: v } : ohne(u.blaetter ?? {}, schluessel) }))
  }

  /** Vorab-Lesen (z. B. Serverstand prüfen) mit Sperre gegen Doppeltippen; Fehler als Meldung. */
  async function mitSperre<T>(f: () => Promise<T>): Promise<{ ok: true; wert: T } | { ok: false }> {
    if (laeuft.current) return { ok: false }
    laeuft.current = true
    setBusy(true)
    try { return { ok: true, wert: await f() } }
    catch (e) { showMsg(pbFehlerText(e), 'error'); return { ok: false } }
    finally { laeuft.current = false; setBusy(false) }
  }

  /**
   * Führt einen mehrteiligen Schreibvorgang aus.
   * 'unklar': keine Antwort oder nur teilweise geschrieben — mit DENSELBEN Anfragen erneut senden.
   */
  async function ausfuehren(anfragen: Anfrage[], erfolg: string): Promise<Ausgang> {
    if (laeuft.current) return 'belegt'
    laeuft.current = true
    setBusy(true)
    try {
      // Das Gerätebuch ist Nachweis, nicht Sicherheit: Sperren, Mängel und Prüfungen dürfen nie
      // an seinem Eintrag scheitern (z. B. Regeln von mpg_ereignisse halb eingetragen)
      const r = await schreibeZusammen(schreiber, anfragen, a => a.collection === 'mpg_ereignisse' && a.aktion === 'create')
      if (r === 'ohne') showMsg(`${erfolg} — aber ohne Eintrag im Gerätebuch. Bitte in PocketBase die Regeln von mpg_ereignisse prüfen.`, 'error')
      else showMsg(r === 'schon' ? 'War bereits gespeichert' : erfolg)
      setSchreibStand(n => n + 1)
      return 'ok'
    } catch (e) {
      showMsg(fehlerText(e), 'error')
      const unklar = e instanceof SchreibFehler && (e.art === 'netz' || e.teilweise)
      // Es kann etwas angekommen sein — Anzeige auf den Serverstand bringen
      if (unklar) loadAll()
      return unklar ? 'unklar' : 'fehler'
    } finally {
      laeuft.current = false
      setBusy(false)
    }
  }

  // ── Geräte ──────────────────────────────────────────────────────────────

  /**
   * Anlegen oder ändern (braucht „MPG verwalten“); gibt die ID zurück. Die Fälligkeit folgt
   * aus der letzten Prüfung. Die IDs vergibt das Formular — einmal je Formular, damit ein
   * erneutes Tippen nach einem Funkloch nichts doppelt anlegt.
   */
  async function speichereGeraet(id: string | undefined, felder: GeraetFelder, ids: { geraet: string; ereignis: string }, voriger?: Anfrage[]): Promise<{ id: string | null; unklar?: Anfrage[] }> {
    if (!felder.name.trim()) { showMsg('Bezeichnung fehlt', 'error'); return { id: null } }
    if (!darfVerwalten) { showMsg('Geräte anlegen und ändern braucht das Recht „MPG verwalten“.', 'error'); return { id: null } }
    const alt = id ? devices.find(d => d.id === id) : undefined
    const daten = {
      ...felder, name: felder.name.trim(), location: felder.location.trim(), serial_number: felder.serial_number.trim(),
      next_inspection_due: faelligFeld({ interval: felder.interval, last_inspection: alt?.last_inspection }, heute),
    }
    // Nach einem unklaren Versuch genau den gesendeten Plan noch einmal — neu berechnet hielte
    // er das Gerät (schon geändert nachgeladen) für unverändert
    const anfragen = voriger ?? (id
      ? planeGeraetAenderung({ id, alt: alt ?? {}, daten, wer: wer(), ereignisId: ids.ereignis, buch })
      : planeNeuesGeraet({ id: ids.geraet, daten, wer: wer(), ereignisId: ids.ereignis, buch }))
    if (!anfragen.length) { showMsg('Nichts geändert'); return { id: id ?? null } }
    const r = await ausfuehren(anfragen, id ? 'Gerät gespeichert' : 'Gerät angelegt — Erstprüfung offen')
    if (r !== 'ok') return { id: null, unklar: r === 'unklar' ? anfragen : undefined }
    // Gleich übernehmen — die Seite des Geräts soll es sofort kennen, auch wenn das Nachladen scheitert
    let neu: Device = alt
      ? { ...alt, ...daten }
      : { ...daten, id: ids.geraet, organization_id: user!.organization_id, operational: true, created: new Date().toISOString() }
    // PocketBase verwirft Felder, die es nicht kennt, ohne Fehler — nachsehen, ob alles angekommen
    // ist, statt still „gespeichert“ zu melden (z. B. Prüfintervall, wenn das Feld anders heißt)
    try {
      const gespeichert = await pb.collection('mpg_devices').getOne<Device>(neu.id, pbOptionen())
      const soll = stammdatenText(daten), ist = stammdatenText(gespeichert)
      const fehlt = soll.filter((f, i) => f.wert !== ist[i].wert).map(f => f.name)
      if (fehlt.length) {
        showMsg(`Gespeichert — aber PocketBase hat ${fehlt.join(', ')} nicht übernommen. Bitte in PocketBase die Felder von mpg_devices prüfen (Prüfintervall: Feld „interval“, Text oder Auswahl mit daily, weekly, monthly, yearly).`, 'error')
      }
      neu = gespeichert
    } catch { /* Nachladen scheitert (Funkloch) — dann mit dem gesendeten Stand */ }
    neuesteAnfrage('geraete')
    setDevices(ds => [...ds.filter(d => d.id !== neu.id), neu].sort((a, b) => a.name.localeCompare(b.name, 'de')))
    loadDevices().catch(() => undefined)
    return { id: neu.id }
  }

  /** Ein Gerät ohne Nachweise löschen (braucht „MPG verwalten“) — sonst bleibt es und wird außer Betrieb genommen. */
  async function loescheGeraet(device: Device): Promise<boolean> {
    if (!darfVerwalten) return false
    const vorab = await mitSperre(async () => {
      // Prüfungen, Defekte, Meldungen und Einträge im Gerätebuch sind Nachweise
      const filter = pb.filter('device_id = {:id}', { id: device.id })
      const zahl = (c: string, f = filter) => pb.collection(c).getList(1, 1, { filter: f, fields: 'id', ...pbOptionen() }).then(r => r.totalItems)
      const [p, d, mld, e] = await Promise.all([
        // Meldungen von außen nur bestätigte (eine offene kann jeder ohne Anmeldung anlegen)
        zahl('mpg_inspections'), zahl('mpg_defects'), zahl('mpg_defect_reports', pb.filter('device_id = {:id} && status = "confirmed"', { id: device.id })),
        buch ? zahl('mpg_ereignisse', pb.filter('device_id = {:id} && art != "angelegt" && art != "geaendert"', { id: device.id })) : Promise.resolve(0),
      ])
      return p + d + mld + e
    })
    if (!vorab.ok) return false
    if (vorab.wert > 0) {
      showMsg(`„${device.name}“ hat Prüfungen, Defekte oder Einträge im Gerätebuch und bleibt als Nachweis erhalten. Bitte außer Betrieb nehmen.`, 'error')
      return false
    }
    if (!confirm(`Gerät „${device.name}“ wirklich löschen? Es hat noch keinen Verlauf.`)) return false
    const r = await ausfuehren(planeLoeschen({ geraet: device, wer: wer(), id: neueId(), buch }), 'Gerät gelöscht')
    loadDevices().catch(() => undefined)
    return r === 'ok'
  }

  // ── Vorlagen ────────────────────────────────────────────────────────────

  async function speichereVorlage(typ: string, items: string[]): Promise<boolean> {
    if (!darfVerwalten) { showMsg('Prüfvorlagen ändern braucht das Recht „MPG verwalten“.', 'error'); return false }
    if (!items.length) { showMsg('Eine Prüfvorlage braucht mindestens einen Prüfpunkt.', 'error'); return false }
    // Ohne geladene Vorlagen wüssten wir nicht, ob es schon eine gibt — sonst entstünde eine zweite
    if (!vorlagenGeladen) { showMsg('Die Prüfvorlagen sind noch nicht geladen — bitte erneut laden.', 'error'); return false }
    if (laeuft.current) return false
    laeuft.current = true
    setBusy(true)
    try {
      const existing = checklists.find(c => c.device_type === typ)
      const r = existing?.id
        ? await pb.collection('mpg_checklists').update<Checklist>(existing.id, { items }, pbOptionen())
        : await pb.collection('mpg_checklists').create<Checklist>({ device_type: typ, items, organization_id: user!.organization_id }, pbOptionen())
      // Gleich übernehmen — wer die Vorlage sofort wieder öffnet, sieht den neuen Stand
      neuesteAnfrage('vorlagen')
      setChecklists(cs => cs.some(c => c.id === r.id) ? cs.map(c => c.id === r.id ? r : c) : [...cs, r])
      showMsg('Vorlage gespeichert')
      return true
    } catch (e: unknown) {
      showMsg('Fehler: ' + pbFehlerText(e), 'error')
      return false
    } finally {
      laeuft.current = false
      setBusy(false)
      loadChecklists().catch(() => undefined)
    }
  }

  // ── Defekte und Meldungen ───────────────────────────────────────────────

  /** Ist eine unklar gesendete Defektmeldung angekommen? Der Defekt ist der Anker — er wird zuletzt geschrieben. */
  const defektAngekommen = (f: DefektFormular) => defects.some(d => d.id === f.id)

  /** Unklare Defektmeldung zu diesem Gerät, die noch nicht angekommen ist */
  function unklarerDefekt(deviceId: string): DefektFormular | null {
    const f = unklarRef.current.defekte[deviceId]
    return f && !defektAngekommen(f) ? f : null
  }

  const unklareBestaetigung = (meldungId: string) => unklarRef.current.bestaetigungen[meldungId] ?? null

  /**
   * Ist die Meldung noch unbearbeitet? Liest den Serverstand — ein anderer Admin oder ein
   * früherer, unklar ausgegangener Versuch kann sie schon bestätigt oder abgelehnt haben.
   */
  async function meldungNochOffen(id: string): Promise<boolean> {
    const r = await pb.collection('mpg_defect_reports').getOne<ExternalReport>(id, { fields: 'id,status', ...pbOptionen() })
    if (r.status === 'pending') return true
    showMsg(r.status === 'confirmed' ? 'Diese Meldung ist bereits bestätigt.' : 'Diese Meldung ist bereits abgelehnt.')
    if (unklarRef.current.bestaetigungen[id]) aendereUnklar(u => ({ ...u, bestaetigungen: ohne(u.bestaetigungen, id) }))
    setBlatt(null)
    return false
  }

  return {
    user, authLoading, heute,
    devices, defects, externalReports, checklists,
    loading, ladefehler, geraeteGeladen, vorlagenGeladen,
    loadAll, loadDevices, loadDefects, loadExternalReports, loadChecklists,
    msg, showMsg, busy, laeuft, blatt, setBlatt, schreibStand,
    wer, zustand, stats, geraeteName, offeneDefekteVon, offeneMeldungenVon, vorlageFuer, vorlageMitQuelle,
    gibtEs, mitSperre, ausfuehren, vorErneutemSenden, blattVersuch, merkeBlattVersuch,
    speichereGeraet, loescheGeraet, speichereVorlage,
    buch, darfVerwalten, bestand, ausserBetriebMoeglich,
    leseEntwurf, schreibeEntwurf, entwurfWenn, entwurfStand, laufendePruefung, setLaufendePruefung,
    unklarStand, aendereUnklar, unklarerDefekt, unklareBestaetigung, defektAngekommen, meldungNochOffen,
  }
}

export type MpgDaten = ReturnType<typeof useMpgDatenWert>

const Kontext = createContext<MpgDaten | null>(null)

export function MpgDatenQuelle({ children }: { children: ReactNode }) {
  const wert = useMpgDatenWert()
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>
}

export function useMpg(): MpgDaten {
  const k = useContext(Kontext)
  if (!k) throw new Error('useMpg außerhalb von MpgDatenQuelle')
  return k
}
