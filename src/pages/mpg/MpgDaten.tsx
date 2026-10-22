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
import { faelligFeld, tagVonDatum } from '../../lib/mpg/fristen'
import { pruefungNichtBestanden, sperrtDefekt, zustandVon, type Stufe, type Zustand } from '../../lib/mpg/zustand'
import { pbOptionen, pbSchreiber, schreibeZusammen, SchreibFehler, type Anfrage } from '../../lib/mpg/schreiben'
import { entwurfSchluessel, unklarSchluessel } from '../../lib/mpg/lokal'
import { pbFehlerText } from '../../lib/pbFehler'
import { DEFAULT_CHECKLISTS, type Checklist, type Defect, type Device, type ExternalReport, type PruefStand, type Severity } from './typen'

const schreiber = pbSchreiber(pb)

export function fehlerText(e: unknown): string {
  return e instanceof SchreibFehler ? e.message : pbFehlerText(e)
}

export type DefektFormular = { description: string; severity: Severity; sperren: boolean; id: string; unklar: boolean; seit?: string }

interface Unklar {
  /** je Geräte-ID die gesendete Defektmeldung */
  defekte: Record<string, DefektFormular>
  /** je Meldungs-ID die gesendete Bestätigung */
  bestaetigungen: Record<string, { anmerkung: string; sperren: boolean; seit?: string }>
}
const KEIN_UNKLAR: Unklar = { defekte: {}, bestaetigungen: {} }

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
  | null

export type Ausgang = 'ok' | 'unklar' | 'fehler' | 'belegt'

export interface GeraetFelder {
  name: string; type: string; serial_number: string; location: string; interval: Device['interval']
  has_stk: boolean; last_stk: string; stk_interval_months: number
  has_mtk: boolean; last_mtk: string; mtk_interval_months: number
}

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

  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout>>()
  // Läuft gerade ein Schreibvorgang? Sperrt die Knöpfe gegen Doppeltippen.
  const [busy, setBusy] = useState(false)
  const laeuft = useRef(false)
  const [blatt, setBlatt] = useState<Blatt>(null)

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
      await Promise.all([loadDevices(), loadChecklists(), loadDefects(), loadExternalReports()])
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

  async function loadChecklists() {
    const aktuell = neuesteAnfrage('vorlagen')
    const records = await pb.collection('mpg_checklists').getFullList<Checklist>({ filter: pb.filter('organization_id = {:o}', { o: user!.organization_id }), requestKey: null })
    if (!aktuell()) return
    if (records.length === 0) {
      const created: Checklist[] = []
      for (const [type, items] of Object.entries(DEFAULT_CHECKLISTS)) {
        const r = await pb.collection('mpg_checklists').create({ device_type: type, items, organization_id: user!.organization_id })
        created.push(r as unknown as Checklist)
      }
      setChecklists(created)
    } else {
      setChecklists(records)
    }
    setVorlagenGeladen(true)
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
    for (const z of zustaende.values()) s[z.stufe]++
    return s
  }, [zustaende])

  /** Prüfpunkte für ein Gerät — eine leere Vorlage hätte keinen Punkt, dann die Standardliste. */
  function vorlageFuer(device: Pick<Device, 'type'>): string[] {
    const t = checklists.find(c => c.device_type === device.type) || checklists.find(c => c.device_type === 'Sonstiges')
    return t?.items?.length ? t.items : (DEFAULT_CHECKLISTS[device.type] || DEFAULT_CHECKLISTS['Sonstiges'])
  }

  /** Gibt es den Datensatz schon? (Anker eines unklaren Versuchs) — ohne 404 als Fehler. */
  async function gibtEs(collection: string, id: string): Promise<boolean> {
    const r = await pb.collection(collection).getList(1, 1, { filter: pb.filter('id = {:id}', { id }), fields: 'id', ...pbOptionen() })
    return r.totalItems > 0
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
      const r = await schreibeZusammen(schreiber, anfragen)
      showMsg(r === 'schon' ? 'War bereits gespeichert' : erfolg)
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

  /** Anlegen oder ändern; gibt die ID zurück. Die Fälligkeit folgt aus der letzten Prüfung. */
  async function speichereGeraet(id: string | undefined, felder: GeraetFelder): Promise<string | null> {
    if (!felder.name.trim()) { showMsg('Bezeichnung fehlt', 'error'); return null }
    if (laeuft.current) return null
    const alt = id ? devices.find(d => d.id === id) : undefined
    const data = {
      ...felder, name: felder.name.trim(), location: felder.location.trim(), serial_number: felder.serial_number.trim(),
      next_inspection_due: faelligFeld({ interval: felder.interval, last_inspection: alt?.last_inspection }, heute),
      organization_id: user!.organization_id,
    }
    laeuft.current = true
    setBusy(true)
    let neueId: string | null = null
    try {
      const r = id
        ? await pb.collection('mpg_devices').update<Device>(id, data, pbOptionen())
        : await pb.collection('mpg_devices').create<Device>({ ...data, operational: true }, pbOptionen())
      neueId = r.id
      // Gleich übernehmen — die Seite des Geräts soll es sofort kennen, auch wenn das Nachladen scheitert
      neuesteAnfrage('geraete')
      setDevices(ds => [...ds.filter(d => d.id !== r.id), r].sort((a, b) => a.name.localeCompare(b.name, 'de')))
      showMsg(id ? 'Gerät gespeichert' : 'Gerät angelegt — Erstprüfung offen')
    } catch (e: unknown) { showMsg('Fehler: ' + pbFehlerText(e), 'error') }
    finally { laeuft.current = false; setBusy(false) }
    loadDevices().catch(() => undefined)
    return neueId
  }

  async function loescheGeraet(device: Device): Promise<boolean> {
    if (laeuft.current) return false
    laeuft.current = true
    setBusy(true)
    try {
      // Prüfungen und Defekte sind Nachweise — ein Gerät mit Verlauf bleibt stehen
      const filter = pb.filter('device_id = {:id}', { id: device.id })
      const [p, d] = await Promise.all([
        pb.collection('mpg_inspections').getList(1, 1, { filter, fields: 'id', ...pbOptionen() }),
        pb.collection('mpg_defects').getList(1, 1, { filter, fields: 'id', ...pbOptionen() }),
      ])
      if (p.totalItems > 0 || d.totalItems > 0) {
        showMsg(`„${device.name}“ hat Prüfungen oder Defekte im Verlauf und bleibt als Nachweis erhalten. Bitte als nicht einsatzbereit markieren.`, 'error')
        return false
      }
      if (!confirm(`Gerät "${device.name}" wirklich löschen? Es hat noch keinen Verlauf.`)) return false
      await pb.collection('mpg_devices').delete(device.id, pbOptionen())
      showMsg('Gerät gelöscht')
      loadDevices().catch(() => undefined)
      return true
    } catch (e) {
      showMsg('Löschen nicht möglich: ' + pbFehlerText(e), 'error')
      return false
    } finally {
      laeuft.current = false
      setBusy(false)
    }
  }

  async function schalteEinsatzbereit(device: Device) {
    if (laeuft.current) return
    const freigeben = device.operational === false
    if (freigeben) {
      const offen = offeneDefekteVon(device.id)
      const sperrend = offen.filter(d => sperrtDefekt(d.severity))
      if (sperrend.length) {
        showMsg(`Noch ${sperrend.length === 1 ? 'ein Defekt' : `${sperrend.length} Defekte`} „hoch“ oder „kritisch“ offen. Erst beheben, dann freigeben.`, 'error')
        return
      }
      const hinweise = [
        offen.length ? `Es ${offen.length === 1 ? 'ist noch ein Mangel' : `sind noch ${offen.length} Mängel`} offen.` : '',
        pruefungNichtBestanden(device) ? 'Die letzte Prüfung ist nicht bestanden — das Gerät bleibt gesperrt, bis eine Prüfung bestanden ist.' : '',
      ].filter(Boolean)
      if (hinweise.length && !confirm(`${hinweise.join('\n')}\n\n„${device.name}“ trotzdem als einsatzbereit markieren?`)) return
    } else if (!confirm(`„${device.name}“ als nicht einsatzbereit markieren (sperren)?`)) {
      return
    }
    laeuft.current = true
    setBusy(true)
    try {
      await pb.collection('mpg_devices').update(device.id, { operational: freigeben }, pbOptionen())
      showMsg(freigeben ? 'Gerät als einsatzbereit markiert' : 'Gerät als nicht einsatzbereit markiert', freigeben ? 'success' : 'error')
    } catch (e) {
      showMsg('Fehler: ' + pbFehlerText(e), 'error')
    } finally {
      laeuft.current = false
      setBusy(false)
    }
    loadDevices().catch(() => undefined)
  }

  // ── Vorlagen ────────────────────────────────────────────────────────────

  async function speichereVorlage(typ: string, items: string[]): Promise<boolean> {
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
    msg, showMsg, busy, laeuft, blatt, setBlatt,
    wer, zustand, stats, offeneDefekteVon, offeneMeldungenVon, vorlageFuer,
    gibtEs, mitSperre, ausfuehren,
    speichereGeraet, loescheGeraet, schalteEinsatzbereit, speichereVorlage,
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
