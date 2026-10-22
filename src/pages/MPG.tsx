import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import { faelligFeld, intervallVon, kalendertag, tagText, tagVonDatum, INTERVALL_TEXT, type Intervall } from '../lib/mpg/fristen'
import { pruefungNichtBestanden, zustandVon, sperrtDefekt, STUFE_TEXT, type Stufe, type Zustand } from '../lib/mpg/zustand'
import { ergebnisVon, moeglicheErgebnisse, offenePunkte, ERGEBNIS_TEXT, type PruefErgebnis } from '../lib/mpg/pruefung'
import { planeBeheben, planeBestaetigung, planeDefekt, planePruefung, restNachAnker } from '../lib/mpg/aktionen'
import { neueId, pbOptionen, pbSchreiber, schreibeZusammen, SchreibFehler } from '../lib/mpg/schreiben'
import { pbFehlerText } from '../lib/pbFehler'
import { entwurfSchluessel, unklarSchluessel } from '../lib/mpg/lokal'

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'geraete' | 'defekte' | 'logbuch' | 'vorlagen'
type DeviceInterval = Intervall
type Severity = 'low' | 'medium' | 'high' | 'critical'
type DefectStatus = 'open' | 'in_progress' | 'resolved'
type ExternalReportStatus = 'pending' | 'confirmed' | 'rejected'

interface Device {
  id: string
  name: string
  type: string
  serial_number: string
  location: string
  interval: DeviceInterval
  last_inspection?: string
  last_inspection_passed?: boolean
  next_inspection_due: string
  organization_id: string
  created: string
  operational?: boolean
  has_stk?: boolean
  last_stk?: string
  stk_interval_months?: number
  has_mtk?: boolean
  last_mtk?: string
  mtk_interval_months?: number
}

interface ChecklistResult { item: string; checked: boolean; note: string }

interface Inspection {
  id: string
  device_id: string
  device_name: string
  device_type: string
  user_name: string
  inspection_date: string
  passed: boolean
  notes: string
  checklist_results: ChecklistResult[]
}

interface Checklist {
  id?: string
  device_type: string
  items: string[]
  organization_id?: string
}

interface Defect {
  id: string
  device_id: string
  device_name: string
  reported_by: string
  description: string
  severity: Severity
  status: DefectStatus
  resolved_by?: string
  resolved_notes?: string
  organization_id: string
  created: string
}

interface ExternalReport {
  id: string
  device_id: string
  device_name: string
  organization_id: string
  reporter_name?: string
  description: string
  severity: Severity
  status: ExternalReportStatus
  rejected_reason?: string
  created: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEVICE_TYPES = ['AED','BZ-Gerät','Absaugpumpe','Beatmungsgerät','Sauerstoffgerät','Pulsoximeter','Blutdruckmessgerät','Defibrillator','Sonstiges']

const DEFAULT_CHECKLISTS: Record<string, string[]> = {
  'AED': ['Gerät auf äußere Beschädigungen prüfen','Status-Anzeige kontrollieren (OK-Symbol)','Batterie-Anzeige kontrollieren','Elektroden Verfallsdatum prüfen','Elektroden auf Beschädigungen prüfen','Selbsttest-Funktion überprüfen','Zubehör vollständig (Schere, Rasierer, Handschuhe)','Standort und Beschilderung kontrollieren'],
  'BZ-Gerät': ['Gerät auf äußere Beschädigungen prüfen','Batteriestand kontrollieren','Display-Funktion testen','Teststreifen Verfallsdatum prüfen','Kontrolllösung Verfallsdatum prüfen','Funktionstest mit Kontrolllösung durchführen','Stechhilfe auf Funktion prüfen','Ausreichend Lanzetten vorhanden'],
  'Absaugpumpe': ['Gerät auf äußere Beschädigungen prüfen','Stromversorgung/Akkustand kontrollieren','Saugschlauch auf Risse und Beschädigungen prüfen','Saugkraft testen (Handfläche)','Auffangbehälter leer und sauber','Auffangbehälter auf Dichtigkeit prüfen','Filter kontrollieren und ggf. wechseln','Einwegmaterial vollständig und steril'],
  'Sonstiges': ['Sichtprüfung auf Beschädigungen','Funktionsprüfung durchführen','Zubehör und Verbrauchsmaterial prüfen','Reinigung und Desinfektion durchgeführt'],
}

const SEVERITY_CFG: Record<Severity, { label: string; color: string; bg: string }> = {
  low:      { label: 'Gering',    color: '#d97706', bg: 'rgba(217,119,6,0.08)'  },
  medium:   { label: 'Mittel',    color: '#ea580c', bg: 'rgba(234,88,12,0.08)'  },
  high:     { label: 'Hoch',      color: '#dc2626', bg: 'rgba(220,38,38,0.08)'  },
  critical: { label: 'Kritisch',  color: 'rgb(var(--lbf-defekt-rgb))', bg: 'rgba(var(--lbf-defekt-rgb),0.12)'  },
}

// Linke Kartenlinie und Marken je Zustand (Farben nach CLAUDE.md)
const STUFE_FARBE: Record<Stufe, string> = {
  gesperrt: '#dc2626', handlung: 'var(--lbf-akzent)', bald: 'var(--lbf-akzent)', ok: '#16a34a',
}

const ERGEBNIS_FARBE: Record<PruefErgebnis, string> = {
  bestanden: '#16a34a', mangel: 'var(--lbf-akzent)', nicht_bestanden: '#dc2626',
}

const INTERVAL_LABELS = INTERVALL_TEXT


type DefektFormular = { description: string; severity: Severity; sperren: boolean; id: string; unklar: boolean; seit?: string }
interface Unklar {
  /** je Geräte-ID die gesendete Defektmeldung */
  defekte: Record<string, DefektFormular>
  /** je Meldungs-ID die gesendete Bestätigung */
  bestaetigungen: Record<string, { anmerkung: string; sperren: boolean; seit?: string }>
}

/**
 * Wird ein unklarer Versuch erst nach längerer Zeit erneut gesendet, kann sich am Gerät
 * inzwischen etwas geändert haben (z. B. repariert und freigegeben) — vorher nachfragen.
 */
function altenVersuchSenden(seit: string | undefined): boolean {
  const t = seit ? new Date(seit).getTime() : NaN
  if (!Number.isFinite(t) || Date.now() - t < 30 * 60_000) return true
  const wann = new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return confirm(`Dieser Speicherversuch ist vom ${wann}. Seitdem kann sich am Gerät etwas geändert haben (z. B. repariert und freigegeben) — eine Sperre darin würde erneut gesetzt.\n\nTrotzdem erneut senden?`)
}
const KEIN_UNKLAR: Unklar = { defekte: {}, bestaetigungen: {} }

const schreiber = pbSchreiber(pb)

function fehlerText(e: unknown): string {
  return e instanceof SchreibFehler ? e.message : pbFehlerText(e)
}

// ── Helpers ────────────────────────────────────────────────────────────────

const pik = (ch: React.ReactNode, sz = 18) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{ch}</svg>
)

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d
}

function fmtDate(s?: string | null, opts?: Intl.DateTimeFormatOptions): string {
  const d = parseDate(s)
  return d ? d.toLocaleDateString('de-DE', opts) : '—'
}

function fmtDateTime(s?: string | null): string {
  const d = parseDate(s)
  if (!d) return '—'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function relativeDate(s?: string | null): string {
  const d = parseDate(s)
  if (!d) return ''
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days <= 0) return 'heute'   // auch bei leicht vorgehender Uhr eines anderen Geräts
  if (days === 1) return 'gestern'
  if (days < 7) return `vor ${days} Tagen`
  return fmtDate(s)
}

// ── Component ──────────────────────────────────────────────────────────────

export default function MPG() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  // Nav
  const [activeTab, setActiveTab] = useState<Tab>('geraete')

  // Data
  const [devices, setDevices] = useState<Device[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [defects, setDefects] = useState<Defect[]>([])
  const [loading, setLoading] = useState(true)
  const [ladefehler, setLadefehler] = useState('')

  // UI
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout>>()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Stufe>('all')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  // Läuft gerade ein Schreibvorgang? Sperrt die Knöpfe gegen Doppeltippen.
  const [busy, setBusy] = useState(false)
  const laeuft = useRef(false)

  // Add/Edit Device sheet
  const [deviceSheet, setDeviceSheet] = useState<null | { id?: string; name: string; type: string; serial_number: string; location: string; interval: DeviceInterval; has_stk: boolean; last_stk: string; stk_interval_months: number; has_mtk: boolean; last_mtk: string; mtk_interval_months: number }>(null)

  // Inspection overlay — die IDs werden beim Start vergeben, damit ein erneuter
  // Speicherversuch nach Verbindungsabbruch nichts doppelt anlegt. Ist ein Versuch
  // unklar ausgegangen (versucht), wird nur noch genau dieser Stand erneut gesendet.
  const [inspState, setInspState] = useState<null | {
    device: Device; items: string[]; results: ChecklistResult[]; step: number; notes: string
    ids: { pruefung: string; defekt: string }
    versucht?: { ergebnis: PruefErgebnis; zeit: string }
  }>(null)
  const entwurfGeprueft = useRef(false)
  const [geraeteGeladen, setGeraeteGeladen] = useState(false)
  // Begonnene Prüfung und unklare Speicherungen liegen je Person und Organisation (src/lib/mpg/lokal.ts)
  const entwurfKey = user?.id ? entwurfSchluessel(user.id, user.organization_id) : ''
  const unklarKey = user?.id ? unklarSchluessel(user.id, user.organization_id) : ''

  // Device history sheet
  const [historyDevice, setHistoryDevice] = useState<Device | null>(null)
  const [historyTab, setHistoryTab] = useState<'pruefungen' | 'defekte'>('pruefungen')

  // Report defect sheet
  const [defectDevice, setDefectDevice] = useState<Device | null>(null)
  const [defectForm, setDefectForm] = useState<DefektFormular>({ description: '', severity: 'medium', sperren: false, id: '', unklar: false })
  // Unklar ausgegangene Speicherungen — erneutes Öffnen sendet genau denselben Stand mit derselben ID.
  // In localStorage, damit auch Neuladen oder ein Wechsel ins Hub nichts verliert.
  const unklarRef = useRef<Unklar>(KEIN_UNKLAR)
  const [, setUnklarStand] = useState(0)

  // Resolve defect sheet
  const [resolveTarget, setResolveTarget] = useState<Defect | null>(null)
  const [resolveNotes, setResolveNotes] = useState('')
  const [wiederEinsatzbereit, setWiederEinsatzbereit] = useState(false)

  // Vorlagen (checklist template editor)
  const [showVorlagen, setShowVorlagen] = useState(false)
  const [vtType, setVtType] = useState('AED')
  const [vtItems, setVtItems] = useState<string[]>([])
  const [vtNewItem, setVtNewItem] = useState('')

  // External defect reports
  const [externalReports, setExternalReports] = useState<ExternalReport[]>([])
  const [confirmTarget, setConfirmTarget] = useState<ExternalReport | null>(null)
  const [confirmNotes, setConfirmNotes] = useState('')
  const [confirmSperren, setConfirmSperren] = useState(true)
  const [confirmVersuch, setConfirmVersuch] = useState<{ anmerkung: string; sperren: boolean; seit?: string } | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ExternalReport | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // ── Effects ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.organization_id) return
    loadAll()
  }, [user?.organization_id])

  // Close menus on outside click
  useEffect(() => {
    const handler = () => setOpenMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  function schreibeEntwurf(st: typeof inspState) {
    if (!entwurfKey) return
    try {
      if (st) {
        const { device, ...rest } = st
        localStorage.setItem(entwurfKey, JSON.stringify({ ...rest, device_id: device.id }))
      } else {
        localStorage.removeItem(entwurfKey)
      }
    } catch { /* ohne Speicher geht es auch */ }
  }

  // Begonnene Prüfung auf dem Gerät festhalten
  useEffect(() => {
    if (entwurfGeprueft.current) schreibeEntwurf(inspState)
  }, [inspState, entwurfKey])

  // … und nach dem Neuladen fortsetzen — erst, wenn die Geräteliste wirklich geladen ist.
  // Scheitert das Laden (Funkloch), bleibt der Entwurf liegen bis „Erneut laden“.
  useEffect(() => {
    if (entwurfGeprueft.current || !entwurfKey) return
    let e: any = null
    try { const roh = localStorage.getItem(entwurfKey); e = roh ? JSON.parse(roh) : null } catch { e = { kaputt: true } }
    if (e && (!Array.isArray(e.results) || !e.ids?.pruefung || !e.ids?.defekt)) {
      try { localStorage.removeItem(entwurfKey) } catch { /* egal */ }
      e = null
    }
    if (!e) { entwurfGeprueft.current = true; return }
    if (!geraeteGeladen) return
    entwurfGeprueft.current = true
    const device = devices.find(d => d.id === e.device_id)
    if (!device) {
      try { localStorage.removeItem(entwurfKey) } catch { /* egal */ }
      showMsg('Begonnene Prüfung verworfen — das Gerät gibt es nicht mehr.', 'error')
      return
    }
    const results: ChecklistResult[] = e.results
    setInspState({ device, items: e.items ?? results.map(r => r.item), results, step: Math.min(e.step ?? 0, results.length), notes: e.notes ?? '', ids: e.ids, versucht: e.versucht })
    showMsg(e.versucht ? 'Prüfung wiederhergestellt — Speichern war unklar, bitte erneut senden' : 'Begonnene Prüfung wiederhergestellt')
  }, [geraeteGeladen, devices, entwurfKey])

  // Unklare Speicherungen der angemeldeten Person laden
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
  const ohne = <T,>(o: Record<string, T>, k: string) => { const { [k]: _, ...rest } = o; return rest }

  // ── Data Loading ───────────────────────────────────────────────────────

  // Nur das jeweils letzte Laden zählt (es kann nach dem Speichern mehrfach angestoßen werden)
  const ladeNr = useRef(0)
  async function loadAll() {
    if (!user?.organization_id) return
    const nr = ++ladeNr.current
    setLoading(true)
    try {
      await Promise.all([loadDevices(), loadInspections(), loadChecklists(), loadDefects(), loadExternalReports()])
      if (nr === ladeNr.current) setLadefehler('')
    } catch (e) {
      if (nr === ladeNr.current && !(e as { isAbort?: boolean })?.isAbort) setLadefehler(pbFehlerText(e))
    } finally {
      if (nr === ladeNr.current) setLoading(false)
    }
  }

  // Je Liste zählt nur die Antwort der neuesten Anfrage — eine verspätete ältere
  // Antwort (Funkloch) darf einen neueren Stand nicht überschreiben
  const ladeGen = useRef({ geraete: 0, pruefungen: 0, defekte: 0, meldungen: 0, vorlagen: 0 })
  function neuesteAnfrage(k: keyof typeof ladeGen.current) {
    const n = ++ladeGen.current[k]
    return () => n === ladeGen.current[k]
  }

  async function loadDevices() {
    const aktuell = neuesteAnfrage('geraete')
    const r = await pb.collection('mpg_devices').getFullList<Device>({ filter: `organization_id = "${user!.organization_id}"`, sort: 'name', requestKey: null })
    if (!aktuell()) return
    setDevices(r)
    setGeraeteGeladen(true)
  }

  async function loadInspections() {
    const aktuell = neuesteAnfrage('pruefungen')
    const r = await pb.collection('mpg_inspections').getFullList<Inspection>({ filter: `organization_id = "${user!.organization_id}"`, sort: '-inspection_date', requestKey: null })
    if (aktuell()) setInspections(r)
  }

  async function loadDefects() {
    const aktuell = neuesteAnfrage('defekte')
    try {
      const r = await pb.collection('mpg_defects').getFullList<Defect>({ filter: `organization_id = "${user!.organization_id}"`, sort: '-created', requestKey: null })
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
      const r = await pb.collection('mpg_defect_reports').getFullList<ExternalReport>({ filter: `organization_id = "${user!.organization_id}"`, sort: '-created', requestKey: null })
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
    const records = await pb.collection('mpg_checklists').getFullList<Checklist>({ filter: `organization_id = "${user!.organization_id}"`, requestKey: null })
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
  }

  // ── Business Logic ─────────────────────────────────────────────────────

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
  const zustandCache = new Map<string, Zustand>()
  function zustand(device: Device): Zustand {
    let z = zustandCache.get(device.id)
    if (!z) {
      z = zustandVon(device, offeneDefekteVon(device.id), offeneMeldungenVon(device.id), heute)
      zustandCache.set(device.id, z)
    }
    return z
  }

  const stats: Record<Stufe, number> = { gesperrt: 0, handlung: 0, bald: 0, ok: 0 }
  for (const d of devices) stats[zustand(d).stufe]++

  const filteredDevices = devices.filter(d => {
    const q = searchQuery.trim().toLowerCase()
    const matchSearch = !q || [d.name, d.type, d.location, d.serial_number].some(f => (f || '').toLowerCase().includes(q))
    const matchStatus = statusFilter === 'all' || zustand(d).stufe === statusFilter
    return matchSearch && matchStatus
  })

  /** Gibt es den Datensatz schon? (Anker eines unklaren Versuchs) — ohne 404 als Fehler. */
  async function gibtEs(collection: string, id: string): Promise<boolean> {
    const r = await pb.collection(collection).getList(1, 1, { filter: pb.filter('id = {:id}', { id }), fields: 'id', ...pbOptionen() })
    return r.totalItems > 0
  }

  /**
   * Führt einen mehrteiligen Schreibvorgang aus.
   * 'unklar': keine Antwort oder nur teilweise geschrieben — mit DENSELBEN Anfragen erneut senden.
   */
  async function ausfuehren(anfragen: Parameters<typeof schreibeZusammen>[1], erfolg: string): Promise<'ok' | 'unklar' | 'fehler' | 'belegt'> {
    if (busy || laeuft.current) return 'belegt'
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

  // Device CRUD
  async function saveDevice() {
    if (!deviceSheet?.name.trim()) { showMsg('Bezeichnung fehlt', 'error'); return }
    if (busy) return
    const { id, ...felder } = deviceSheet
    const alt = id ? devices.find(d => d.id === id) : undefined
    // Die Fälligkeit folgt aus der letzten Prüfung und dem Intervall — Speichern verschiebt sie nicht
    const data = {
      ...felder, name: felder.name.trim(),
      next_inspection_due: faelligFeld({ interval: felder.interval, last_inspection: alt?.last_inspection }, heute),
      organization_id: user!.organization_id,
    }
    setBusy(true)
    try {
      if (id) {
        await pb.collection('mpg_devices').update(id, data, pbOptionen())
        showMsg('Gerät aktualisiert')
      } else {
        await pb.collection('mpg_devices').create({ ...data, operational: true }, pbOptionen())
        showMsg('Gerät hinzugefügt — Erstprüfung offen')
      }
      setDeviceSheet(null)
    } catch (e: unknown) { showMsg('Fehler: ' + pbFehlerText(e), 'error') }
    finally { setBusy(false) }
    loadDevices().catch(() => undefined)
  }

  async function deleteDevice(device: Device) {
    if (busy) return
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
        return
      }
      if (!confirm(`Gerät "${device.name}" wirklich löschen? Es hat noch keinen Verlauf.`)) return
      await pb.collection('mpg_devices').delete(device.id, pbOptionen())
      showMsg('Gerät gelöscht')
      loadDevices().catch(() => undefined)
    } catch (e) {
      showMsg('Löschen nicht möglich: ' + pbFehlerText(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  // Inspection
  function startInspection(device: Device) {
    const template = checklists.find(c => c.device_type === device.type) || checklists.find(c => c.device_type === 'Sonstiges')
    // Eine leere Vorlage hätte keinen Prüfpunkt — dann die Standardliste
    const items = template?.items?.length ? template.items : (DEFAULT_CHECKLISTS[device.type] || DEFAULT_CHECKLISTS['Sonstiges'])
    setInspState({ device, items, results: items.map(item => ({ item, checked: false, note: '' })), step: 0, notes: '', ids: { pruefung: neueId(), defekt: neueId() } })
  }

  function abbrechenPruefung() {
    if (!inspState || busy) return
    if (inspState.versucht) {
      if (!confirm('Ob diese Prüfung gespeichert wurde, ist unklar. Trotzdem verwerfen?\n\nTeile können schon angekommen sein (Sperre, Defekt, Protokoll im Logbuch) — bitte danach den Stand des Geräts prüfen.')) return
    } else {
      const angefangen = inspState.notes.trim() || inspState.results.some(r => r.checked || r.note.trim())
      if (angefangen && !confirm('Prüfung abbrechen? Die Eingaben gehen verloren.')) return
    }
    setInspState(null)
  }

  async function saveInspection(gewaehlt: PruefErgebnis) {
    if (!inspState || busy || laeuft.current) return
    // Nach unklarem Ausgang nur genau den gesendeten Stand wiederholen — sonst meldete der
    // Server „schon da“ und ein geändertes Ergebnis ginge still verloren
    const vorher = inspState.versucht
    const ergebnis = vorher?.ergebnis ?? gewaehlt
    const wahl = moeglicheErgebnisse(inspState.results, inspState.notes)
    if (!wahl[ergebnis]) { showMsg(wahl.hinweis || 'Bitte eine Bemerkung eintragen', 'error'); return }
    const zeit = vorher?.zeit ?? new Date().toISOString()

    // Wiederholung eines unklaren Versuchs: Gerätestand lesen (ein älterer Versuch darf eine
    // inzwischen neuere Prüfung nicht überschreiben) und nachsehen, ob der Anker — das
    // Protokoll — schon da ist. Dann fehlt höchstens der Prüfstand am Gerät danach.
    let serverLetzte: string | null = null
    let ankerDa = false
    if (vorher) {
      if (!altenVersuchSenden(vorher.zeit)) return
      laeuft.current = true
      setBusy(true)
      try {
        ankerDa = await gibtEs('mpg_inspections', inspState.ids.pruefung)
        const g = await pb.collection('mpg_devices').getOne<Device>(inspState.device.id, { fields: 'id,last_inspection', ...pbOptionen() })
        serverLetzte = g.last_inspection || null
      } catch (e) {
        showMsg(pbFehlerText(e), 'error')
        return
      } finally {
        laeuft.current = false
        setBusy(false)
      }
    }

    const plan = planePruefung({
      geraet: inspState.device, punkte: inspState.results, bemerkung: inspState.notes,
      ergebnis, wer: wer(), jetzt: new Date(zeit), ids: inspState.ids, serverLetzte,
    })
    const schonEingetragen = !!serverLetzte && new Date(serverLetzte.replace(' ', 'T')).getTime() === new Date(zeit).getTime()
    const anfragen = ankerDa ? (schonEingetragen ? [] : restNachAnker(plan)) : plan
    if (!anfragen.length) {
      showMsg('War bereits gespeichert')
      schreibeEntwurf(null)
      setInspState(null)
      loadAll()
      return
    }
    const nachtrag = !plan.some(a => a.collection === 'mpg_devices' && 'last_inspection' in a.body)
    const text = nachtrag ? 'Prüfung nachgetragen — es gibt eine neuere Prüfung, deren Stand gilt weiter'
      : ergebnis === 'bestanden' ? 'Prüfung bestanden'
      : ergebnis === 'mangel' ? 'Mangel festgehalten — Gerät bleibt einsatzbereit'
      : 'Prüfung nicht bestanden — Gerät gesperrt, Defekt angelegt'
    // Den Versuch VOR dem Senden festschreiben — auch im Entwurf, falls die App währenddessen
    // beendet wird: nach dem Neuladen gibt es dann nur „erneut senden“, nichts Geändertes
    const festgeschrieben = { ...inspState, versucht: { ergebnis, zeit } }
    schreibeEntwurf(festgeschrieben)
    setInspState(festgeschrieben)
    const r = await ausfuehren(anfragen, text)
    if (r === 'ok') {
      schreibeEntwurf(null)   // auch wenn die Seite inzwischen verlassen wurde
      setInspState(null)
      loadAll()
    } else if (r !== 'unklar' && !vorher) {
      // Sicher abgelehnt, nichts geschrieben: wieder änderbar
      const offen = { ...inspState, versucht: undefined }
      schreibeEntwurf(offen)
      setInspState(offen)
    }
  }

  // Defects
  /** Ist eine unklar gesendete Defektmeldung angekommen? Der Defekt ist der Anker — er wird zuletzt geschrieben. */
  function defektAngekommen(f: DefektFormular): boolean {
    return defects.some(d => d.id === f.id)
  }

  function openDefectSheet(device: Device) {
    setDefectDevice(device)
    const offen = unklarRef.current.defekte[device.id]
    if (offen && !defektAngekommen(offen)) { setDefectForm(offen); return }
    if (offen) aendereUnklar(u => ({ ...u, defekte: ohne(u.defekte, device.id) }))
    setDefectForm({ description: '', severity: 'medium', sperren: false, id: neueId(), unklar: false })
  }

  function verwerfeUnklarenDefekt() {
    const id = defectDevice?.id
    if (id) aendereUnklar(u => ({ ...u, defekte: ohne(u.defekte, id) }))
    setDefectDevice(null)
  }

  async function reportDefect() {
    if (!defectDevice || !defectForm.description.trim()) { showMsg('Beschreibung fehlt', 'error'); return }
    // Hoch/kritisch sperrt ohnehin — dann auch als nicht einsatzbereit markieren
    const sperren = defectForm.sperren || sperrtDefekt(defectForm.severity)
    const anfragen = planeDefekt({ geraet: defectDevice, beschreibung: defectForm.description, schwere: defectForm.severity, sperren, wer: wer(), id: defectForm.id })
    const geraetId = defectDevice.id
    // Wiederholung: ist der Defekt (Anker, zuletzt geschrieben) schon da, ist alles angekommen
    if (defectForm.unklar) {
      if (busy || laeuft.current) return
      if (!altenVersuchSenden(defectForm.seit)) return
      laeuft.current = true
      setBusy(true)
      let schonDa = false
      try { schonDa = await gibtEs('mpg_defects', defectForm.id) }
      catch (e) { showMsg(pbFehlerText(e), 'error'); return }
      finally { laeuft.current = false; setBusy(false) }
      if (schonDa) {
        aendereUnklar(u => ({ ...u, defekte: ohne(u.defekte, geraetId) }))
        showMsg('War bereits gespeichert')
        setDefectDevice(null)
        Promise.all([loadDefects(), loadDevices()]).catch(() => undefined)
        return
      }
    }
    // Inhalt vor dem Senden festschreiben: erneut gesendet wird genau diese Meldung mit derselben ID
    const f = { ...defectForm, unklar: true, seit: defectForm.seit ?? new Date().toISOString() }
    aendereUnklar(u => ({ ...u, defekte: { ...u.defekte, [geraetId]: f } }))
    const r = await ausfuehren(anfragen, sperren ? 'Defekt gemeldet — Gerät gesperrt' : 'Defekt gemeldet')
    if (r === 'ok') {
      aendereUnklar(u => ({ ...u, defekte: ohne(u.defekte, geraetId) }))
      setDefectDevice(null)
      Promise.all([loadDefects(), loadDevices()]).catch(() => undefined)
    } else if (r === 'unklar') {
      setDefectForm(f)
    } else if (!defectForm.unklar) {
      // Sicher abgelehnt: nichts geschrieben, Formular bleibt änderbar
      aendereUnklar(u => ({ ...u, defekte: ohne(u.defekte, geraetId) }))
    }
  }

  function openResolveSheet(def: Defect) {
    setResolveTarget(def)
    setResolveNotes('')
    setWiederEinsatzbereit(false)
  }

  async function resolveDefect() {
    if (!resolveTarget) return
    const anfragen = planeBeheben({ defekt: resolveTarget, notiz: resolveNotes, wer: wer(), wiederEinsatzbereit })
    if (await ausfuehren(anfragen, wiederEinsatzbereit ? 'Defekt behoben — Gerät wieder einsatzbereit' : 'Defekt als behoben markiert') === 'ok') {
      setResolveTarget(null)
      setResolveNotes('')
      Promise.all([loadDefects(), loadDevices()]).catch(() => undefined)
    }
  }

  async function toggleOperational(device: Device) {
    if (busy) return
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
    }
    setBusy(true)
    try {
      await pb.collection('mpg_devices').update(device.id, { operational: freigeben }, pbOptionen())
      showMsg(freigeben ? 'Gerät als einsatzbereit markiert' : 'Gerät als nicht einsatzbereit markiert', freigeben ? 'success' : 'error')
    } catch (e) {
      showMsg('Fehler: ' + pbFehlerText(e), 'error')
    } finally {
      setBusy(false)
    }
    loadDevices().catch(() => undefined)
  }

  function openConfirmSheet(r: ExternalReport) {
    setConfirmTarget(r)
    // Ging eine Bestätigung unklar aus, wird genau sie erneut gesendet
    const v = unklarRef.current.bestaetigungen[r.id]
    setConfirmVersuch(v ?? null)
    setConfirmNotes(v ? v.anmerkung : '')
    setConfirmSperren(v ? v.sperren : sperrtDefekt(r.severity))
  }

  /**
   * Ist die Meldung noch unbearbeitet? Liest den Serverstand — ein anderer Admin oder ein
   * früherer, unklar ausgegangener Versuch kann sie schon bestätigt oder abgelehnt haben.
   */
  async function meldungNochOffen(id: string): Promise<boolean> {
    const r = await pb.collection('mpg_defect_reports').getOne<ExternalReport>(id, { fields: 'id,status', ...pbOptionen() })
    if (r.status === 'pending') return true
    showMsg(r.status === 'confirmed' ? 'Diese Meldung ist bereits bestätigt.' : 'Diese Meldung ist bereits abgelehnt.')
    if (unklarRef.current.bestaetigungen[id]) aendereUnklar(u => ({ ...u, bestaetigungen: ohne(u.bestaetigungen, id) }))
    setConfirmTarget(null)
    setRejectTarget(null)
    return false
  }

  async function confirmExternalReport() {
    if (!confirmTarget || busy || laeuft.current) return
    if (confirmVersuch && !altenVersuchSenden(confirmVersuch.seit)) return
    const meldung = confirmTarget
    laeuft.current = true
    setBusy(true)
    let offen = false
    let geraetDa = true
    try {
      offen = await meldungNochOffen(meldung.id)
      // Ob es das Gerät noch gibt, sagt der Server — die Liste ist vielleicht nicht geladen
      if (offen) geraetDa = await gibtEs('mpg_devices', meldung.device_id)
    }
    catch (e) { offen = false; showMsg('Fehler: ' + pbFehlerText(e), 'error') }
    finally { laeuft.current = false; setBusy(false) }
    if (!offen) { Promise.all([loadExternalReports(), loadDefects(), loadDevices()]).catch(() => undefined); return }
    // Nach unklarem Ausgang genau den gesendeten Stand wiederholen
    const stand = confirmVersuch ?? { anmerkung: confirmNotes, sperren: confirmSperren || sperrtDefekt(meldung.severity), seit: new Date().toISOString() }
    // Der Defekt trägt die ID der Meldung: Eine Meldung kann so nur einen Defekt erzeugen,
    // auch nach Neuladen, erneutem Öffnen oder von einem zweiten Gerät aus
    const anfragen = planeBestaetigung({
      meldung, anmerkung: stand.anmerkung, sperren: stand.sperren,
      geraetDa, wer: wer(), defektId: meldung.id,
    })
    aendereUnklar(u => ({ ...u, bestaetigungen: { ...u.bestaetigungen, [meldung.id]: stand } }))
    const gesperrt = anfragen.some(a => a.collection === 'mpg_devices')
    const r = await ausfuehren(anfragen, gesperrt ? 'Meldung bestätigt — Defekt angelegt, Gerät gesperrt' : 'Meldung bestätigt — Defekt angelegt')
    if (r === 'ok' || (r !== 'unklar' && !confirmVersuch)) aendereUnklar(u => ({ ...u, bestaetigungen: ohne(u.bestaetigungen, meldung.id) }))
    if (r === 'ok') {
      setConfirmTarget(null)
      setConfirmNotes('')
      setConfirmVersuch(null)
      loadAll()
    } else if (r === 'unklar') {
      setConfirmVersuch(stand)
    }
  }

  async function rejectExternalReport() {
    if (!rejectTarget || busy || laeuft.current) return
    const id = rejectTarget.id
    laeuft.current = true
    setBusy(true)
    try {
      if (await meldungNochOffen(id)) {
        // Eine Bestätigung kann schon teilweise angekommen sein (Defekt mit der ID der Meldung)
        if (await gibtEs('mpg_defects', id)) {
          showMsg('Zu dieser Meldung ist schon ein Defekt angelegt — die Bestätigung ist teilweise gespeichert. Bitte die Bestätigung erneut senden statt abzulehnen.', 'error')
          setRejectTarget(null)
        } else {
          await pb.collection('mpg_defect_reports').update(id, { status: 'rejected', rejected_reason: rejectReason.trim() }, pbOptionen())
          if (unklarRef.current.bestaetigungen[id]) aendereUnklar(u => ({ ...u, bestaetigungen: ohne(u.bestaetigungen, id) }))
          setRejectTarget(null)
          setRejectReason('')
          showMsg('Meldung abgelehnt')
        }
      }
    } catch (e: unknown) { showMsg('Fehler: ' + pbFehlerText(e), 'error') }
    finally { laeuft.current = false; setBusy(false) }
    Promise.all([loadExternalReports(), loadDefects(), loadDevices()]).catch(() => undefined)
  }

  // Vorlagen (checklist templates)
  function openVorlagen(type = 'AED') {
    setVtType(type)
    const t = checklists.find(c => c.device_type === type)
    setVtItems(t ? [...t.items] : [...(DEFAULT_CHECKLISTS[type] || DEFAULT_CHECKLISTS['Sonstiges'])])
    setVtNewItem('')
    setShowVorlagen(true)
  }

  function vtSwitchType(type: string) {
    setVtType(type)
    const t = checklists.find(c => c.device_type === type)
    setVtItems(t ? [...t.items] : [...(DEFAULT_CHECKLISTS[type] || DEFAULT_CHECKLISTS['Sonstiges'])])
    setVtNewItem('')
  }

  async function saveVorlage() {
    if (!vtItems.length) { showMsg('Eine Prüfvorlage braucht mindestens einen Prüfpunkt.', 'error'); return }
    try {
      const existing = checklists.find(c => c.device_type === vtType)
      if (existing?.id) {
        await pb.collection('mpg_checklists').update(existing.id, { items: vtItems })
      } else {
        await pb.collection('mpg_checklists').create({ device_type: vtType, items: vtItems, organization_id: user!.organization_id })
      }
      await loadChecklists()
      showMsg('Vorlage gespeichert')
      setShowVorlagen(false)
    } catch (e: unknown) { showMsg('Fehler: ' + (e as Error).message, 'error') }
  }

  // ── Sub-views ───────────────────────────────────────────────────────────

  if (authLoading) return null

  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  // Steht oben, solange ein Blatt oder die Prüfung offen ist — unten lägen ihre Knöpfe
  const blattOffen = !!(inspState || deviceSheet || historyDevice || defectDevice || resolveTarget || confirmTarget || rejectTarget || showVorlagen)
  const toast = msg && (
    <div role="status" style={{ position: 'fixed', ...(blattOffen ? { top: 'calc(env(safe-area-inset-top) + 72px)' } : { bottom: 'calc(24px + env(safe-area-inset-bottom))' }), pointerEvents: 'none', left: 16, right: 16, margin: '0 auto', width: 'fit-content', maxWidth: 520, zIndex: 9999, padding: '10px 20px', borderRadius: 20, fontWeight: 600, fontSize: 13, lineHeight: 1.4, textAlign: 'center' as const, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', background: msg.type === 'success' ? 'var(--lbf-ok-grund)' : 'var(--lbf-fehler-grund)', border: `1px solid ${msg.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: msg.type === 'success' ? 'var(--lbf-ok-text)' : '#dc2626' }}>
      {msg.text}
    </div>
  )

  // ── Inspection Overlay (full-screen) ────────────────────────────────────

  if (inspState) {
    const { device, results, step, notes, versucht } = inspState
    // Nach unklarem Speichern bleibt die Zusammenfassung stehen — der Stand ist festgeschrieben
    const isLastStep = step >= results.length || !!versucht
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--warm-bg)', overflowY: 'auto', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif", zIndex: 500 }}>
        {/* Header */}
        <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid var(--lbf-border)', padding: 'calc(env(safe-area-inset-top) + 14px) 20px 14px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100 }}>
          <button onClick={abbrechenPruefung} disabled={busy} aria-label="Prüfung abbrechen" style={{ background: 'none', border: 'none', cursor: busy ? 'wait' : 'pointer', padding: 4, color: 'var(--lbf-akzent)', display: 'flex', opacity: busy ? 0.4 : 1 }}>
            {pik(<><polyline points="15 18 9 12 15 6"/></>)}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>Prüfung</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>{device.name}</div>
          </div>
          {!isLastStep && (
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lbf-akzent)', background: 'rgba(var(--lbf-rot-rgb),0.07)', borderRadius: 99, padding: '3px 10px' }}>
              {step + 1} / {results.length}
            </div>
          )}
        </div>

        <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px' }}>
          {!isLastStep ? (
            <>
              {/* Progress bar */}
              <div style={{ height: 4, background: 'rgba(var(--lbf-rot-rgb),0.1)', borderRadius: 99, marginBottom: 28, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--lbf-akzent)', borderRadius: 99, width: `${(step / results.length) * 100}%`, transition: 'width .3s' }} />
              </div>

              {/* Checklist item */}
              <div style={{ background: 'var(--lbf-card)', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid var(--lbf-akzent)', marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 12 }}>
                  Prüfpunkt {step + 1}
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 16, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={results[step].checked}
                    onChange={() => {
                      const r = [...results]
                      r[step] = { ...r[step], checked: !r[step].checked }
                      setInspState({ ...inspState, results: r })
                    }}
                    style={{ width: 22, height: 22, accentColor: 'var(--lbf-akzent)', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
                  />
                  <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--lbf-text)', lineHeight: 1.5 }}>{results[step].item}</span>
                </label>
              </div>

              {/* Note for this item */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 8 }}>Bemerkung (optional)</div>
                <textarea
                  value={results[step].note}
                  onChange={e => {
                    const r = [...results]
                    r[step] = { ...r[step], note: e.target.value }
                    setInspState({ ...inspState, results: r })
                  }}
                  placeholder="z.B. Kleine Beschädigung, Batterie bei 80%, ..."
                  rows={3}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--lbf-card)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' as const }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setInspState({ ...inspState, step: Math.max(0, step - 1) })} disabled={step === 0}
                  style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: step === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: step === 0 ? 0.4 : 1 }}>
                  Zurück
                </button>
                <button onClick={() => setInspState({ ...inspState, step: step + 1 })}
                  style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: 'var(--lbf-akzent-grund)', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {step === results.length - 1 ? 'Zur Zusammenfassung' : 'Weiter'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Summary */}
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 12 }}>Zusammenfassung</div>
              <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 20 }}>
                {results.map((r, i) => (
                  <button key={i} onClick={() => setInspState({ ...inspState, step: i })} disabled={!!versucht || busy} title="Zu diesem Prüfpunkt"
                    style={{ display: 'flex', width: '100%', alignItems: 'flex-start', gap: 12, padding: '12px 14px', border: 'none', borderBottom: i < results.length - 1 ? '0.5px solid rgba(var(--lbf-rot-rgb),0.06)' : 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const }}>
                    <span style={{ color: r.checked ? '#16a34a' : '#dc2626', flexShrink: 0, marginTop: 1 }}>
                      {pik(r.checked ? <><polyline points="20 6 9 17 4 12"/></> : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>, 16)}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--lbf-text)' }}>{r.item}</div>
                      {r.note && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 2 }}>→ {r.note}</div>}
                    </div>
                  </button>
                ))}
              </div>

              {(() => {
                const wahl = moeglicheErgebnisse(results, notes)
                const offen = offenePunkte(results).length
                const knopf = (ergebnis: PruefErgebnis, text: string, farbe: string, flex: number) => (
                  <button key={ergebnis} onClick={() => saveInspection(ergebnis)} disabled={busy || !wahl[ergebnis]}
                    style={{ flex, minWidth: 120, padding: '13px', borderRadius: 10, border: 'none', background: farbe, fontSize: 14, fontWeight: 700, color: '#fff', cursor: busy || !wahl[ergebnis] ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: busy || !wahl[ergebnis] ? 0.4 : 1 }}>
                    {text}
                  </button>
                )
                return (
                  <>
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 8 }}>
                        {offen ? 'Mangel beschreiben (Pflicht)' : 'Anmerkungen'}
                      </div>
                      <textarea
                        value={notes}
                        readOnly={!!versucht || busy}
                        onChange={e => setInspState({ ...inspState, notes: e.target.value })}
                        placeholder={offen ? 'Was ist nicht in Ordnung? Was wurde veranlasst?' : 'Besondere Vorkommnisse (optional)'}
                        rows={4}
                        style={{ width: '100%', padding: '12px', borderRadius: 10, border: `1.5px solid ${offen && !notes.trim() ? 'rgba(220,38,38,0.45)' : 'rgba(var(--lbf-rot-rgb),0.15)'}`, background: 'var(--lbf-card)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' as const }}
                      />
                      {wahl.hinweis && <div style={{ fontSize: 12, fontStyle: 'italic', color: offen && !notes.trim() ? '#dc2626' : 'var(--warm-gray)', marginTop: 6 }}>{wahl.hinweis}</div>}
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                      {versucht ? (
                        knopf(versucht.ergebnis, busy ? 'Sendet…' : `Erneut senden: ${ERGEBNIS_TEXT[versucht.ergebnis]}`, 'var(--lbf-akzent-grund)', 1)
                      ) : (
                        <>
                          <button onClick={() => setInspState({ ...inspState, step: Math.max(0, results.length - 1) })} disabled={busy || !results.length}
                            style={{ flex: 1, minWidth: 120, padding: '13px', borderRadius: 10, border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'none', fontSize: 14, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Zurück
                          </button>
                          {offen === 0 && knopf('bestanden', busy ? 'Speichert…' : 'Bestanden', '#16a34a', 2)}
                          {knopf('mangel', 'Mangel – bleibt einsatzbereit', 'var(--lbf-akzent-grund)', 2)}
                          {knopf('nicht_bestanden', 'Nicht bestanden – sperren', '#dc2626', 2)}
                        </>
                      )}
                    </div>
                    {versucht && !busy && (
                      <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--lbf-text)', marginTop: 10 }}>
                        Ob „{ERGEBNIS_TEXT[versucht.ergebnis]}“ gespeichert wurde, ist unklar. Erneut senden legt nichts doppelt an. Zum Ändern die Prüfung verwerfen und neu beginnen.
                      </div>
                    )}
                    {!versucht && offen === 0 && (
                      <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 10 }}>
                        Mangel oder „nicht bestanden“ verlangen eine Beschreibung.
                      </div>
                    )}
                  </>
                )
              })()}
            </>
          )}
        </div>
        {toast}
      </div>
    )
  }

  // ── Main Render ─────────────────────────────────────────────────────────

  const openDefects = defects.filter(d => d.status !== 'resolved')
  const resolvedDefects = defects.filter(d => d.status === 'resolved')
  const pendingReports = externalReports.filter(r => r.status === 'pending')

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid var(--lbf-border)', padding: 'calc(env(safe-area-inset-top) + 14px) 20px 14px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => navigate('/hub')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--lbf-akzent)', display: 'flex' }}>
          {pik(<><polyline points="15 18 9 12 15 6"/></>)}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>Medizinprodukte</div>
          <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>{today}</div>
        </div>
        {activeTab === 'geraete' && (
          <button onClick={() => setDeviceSheet({ name: '', type: 'AED', serial_number: '', location: '', interval: 'monthly', has_stk: false, last_stk: '', stk_interval_months: 24, has_mtk: false, last_mtk: '', mtk_interval_months: 24 })}
            style={{ background: 'var(--lbf-akzent-grund)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '7px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            {pik(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>, 14)}
            Gerät
          </button>
        )}
        {activeTab === 'vorlagen' && (
          <button onClick={() => openVorlagen()}
            style={{ background: 'var(--lbf-akzent-grund)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '7px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
            Bearbeiten
          </button>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', background: 'var(--lbf-card)', borderBottom: '0.5px solid var(--lbf-border-light)', position: 'sticky', top: 'calc(env(safe-area-inset-top) + 60px)', zIndex: 99 }}>
        {([
          ['geraete', 'Geräte'],
          ['defekte', (() => { const n = openDefects.length + pendingReports.length; return n > 0 ? `Defekte (${n})` : 'Defekte' })()],
          ['logbuch', 'Logbuch'],
          ['vorlagen', 'Vorlagen'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            flex: 1, padding: '11px 4px 9px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
            color: activeTab === t ? 'var(--lbf-akzent)' : 'var(--warm-gray)', fontFamily: 'inherit',
            borderTop: activeTab === t ? '2px solid var(--lbf-akzent)' : '2px solid transparent',
            whiteSpace: 'nowrap',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 16px 48px' }}>

        {/* ═══ GERÄTE TAB ═══ */}
        {activeTab === 'geraete' && (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {(['ok', 'bald', 'handlung', 'gesperrt'] as Stufe[]).map(k => (
                <button key={k} onClick={() => setStatusFilter(statusFilter === k ? 'all' : k)}
                  style={{ background: 'var(--lbf-card)', borderRadius: 12, padding: '12px 8px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: statusFilter === k ? `1.5px solid ${STUFE_FARBE[k]}` : '1.5px solid transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const, minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: STUFE_FARBE[k], textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 3, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{k === 'handlung' ? 'Handeln' : k === 'ok' ? 'Bereit' : STUFE_TEXT[k]}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: STUFE_FARBE[k], lineHeight: 1 }}>{stats[k]}</div>
                </button>
              ))}
            </div>

            {/* Search + filter */}
            <div style={{ marginBottom: 10 }}>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Name, Typ, Standort, Seriennummer…"
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', borderRadius: 10, background: 'var(--lbf-card)', fontSize: 14, fontFamily: 'inherit', color: 'var(--lbf-text)', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>

            {/* Device cards */}
            {/* Schon geladene Geräte bleiben sichtbar, wenn ein späteres Laden scheitert (Funkloch) */}
            {ladefehler && geraeteGeladen && !loading && (
              <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid #dc2626', padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, fontSize: 12, fontStyle: 'italic', color: 'var(--lbf-text)' }}>Stand nicht aktuell — {ladefehler}</div>
                <button onClick={loadAll} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--lbf-akzent-grund)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Erneut laden</button>
              </div>
            )}
            {loading && !geraeteGeladen ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Lade Geräte…</div>
            ) : ladefehler && !geraeteGeladen ? (
              <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid #dc2626', padding: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)', marginBottom: 4 }}>Geräte konnten nicht geladen werden</div>
                <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginBottom: 12 }}>{ladefehler}</div>
                <button onClick={loadAll} disabled={loading} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--lbf-akzent-grund)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Erneut laden</button>
              </div>
            ) : filteredDevices.length === 0 ? (
              <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--warm-gray)' }}>
                <div style={{ fontStyle: 'italic', marginBottom: 8 }}>Keine Geräte gefunden</div>
                {devices.length === 0 && (
                  <button onClick={() => setDeviceSheet({ name: '', type: 'AED', serial_number: '', location: '', interval: 'monthly', has_stk: false, last_stk: '', stk_interval_months: 24, has_mtk: false, last_mtk: '', mtk_interval_months: 24 })}
                    style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: 'var(--lbf-akzent-grund)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Erstes Gerät anlegen
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredDevices.map(device => {
                  const z = zustand(device)
                  return (
                    <div key={device.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${STUFE_FARBE[z.stufe]}`, overflow: 'hidden', position: 'relative' }}>
                      {/* Card body */}
                      <div style={{ padding: '14px 46px 14px 16px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 6 }}>{device.type}</div>
                        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 16, color: 'var(--lbf-text)', marginBottom: 4 }}>{device.name}</div>
                        {(device.location || device.serial_number) && (
                          <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', marginBottom: 8 }}>
                            {[device.location, device.serial_number ? `S/N: ${device.serial_number}` : ''].filter(Boolean).join(' · ')}
                          </div>
                        )}

                        {/* Zustand mit Gründen */}
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: STUFE_FARBE[z.stufe], textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>{STUFE_TEXT[z.stufe]}</span>
                          {z.gruende.map((g, i) => (
                            <div key={i} style={{ fontSize: 12, fontStyle: 'italic', color: g.stufe === 'gesperrt' ? '#dc2626' : 'var(--lbf-text)', marginTop: 2 }}>{g.text}</div>
                          ))}
                          {unklarRef.current.defekte[device.id] && !defektAngekommen(unklarRef.current.defekte[device.id]) && (
                            <div style={{ fontSize: 12, fontStyle: 'italic', color: '#dc2626', marginTop: 2 }}>Defektmeldung nicht sicher gespeichert — unter „Defekt melden“ erneut senden</div>
                          )}
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
                          {z.fristen.map(f => f.naechste
                            ? `${f.art === 'pruefung' ? 'Nächste Prüfung' : f.bezeichnung}: ${tagText(f.naechste)}`
                            : `${f.art === 'pruefung' ? 'Prüfung' : f.bezeichnung}: offen`).join(' · ')}
                          {device.last_inspection ? ` · Zuletzt: ${relativeDate(device.last_inspection)}` : ''}
                        </div>
                      </div>

                      {/* Action strip */}
                      <div style={{ borderTop: '0.5px solid var(--lbf-border-light)', background: 'var(--lbf-fuss)', padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={() => startInspection(device)}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--lbf-akzent-grund)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Prüfung starten
                        </button>
                        <button onClick={() => openDefectSheet(device)}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '0.5px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.04)', color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Defekt melden
                        </button>
                        <button onClick={() => { setHistoryDevice(device); setHistoryTab('pruefungen') }}
                          style={{ padding: '8px 10px', borderRadius: 8, border: '0.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'none', color: 'var(--warm-gray)', cursor: 'pointer', display: 'flex' }}>
                          {pik(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></>, 14)}
                        </button>
                      </div>

                      {/* ··· menu */}
                      <div style={{ position: 'absolute', top: 12, right: 12 }}>
                        <button onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === device.id ? null : device.id) }}
                          style={{ background: 'var(--lbf-card)', border: '0.5px solid var(--lbf-border)', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--warm-gray)' }}>
                          {pik(<><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></>, 14)}
                        </button>
                        {openMenu === device.id && (
                          <div style={{ position: 'absolute', top: 30, right: 0, background: 'var(--lbf-card)', border: '0.5px solid var(--lbf-border)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 160, zIndex: 200 }}>
                            {[
                              { label: 'Bearbeiten', action: () => { setDeviceSheet({ id: device.id, name: device.name, type: device.type, serial_number: device.serial_number || '', location: device.location || '', interval: intervallVon(device.interval), has_stk: !!device.has_stk, last_stk: kalendertag(device.last_stk) ?? '', stk_interval_months: device.stk_interval_months || 24, has_mtk: !!device.has_mtk, last_mtk: kalendertag(device.last_mtk) ?? '', mtk_interval_months: device.mtk_interval_months || 24 }); setOpenMenu(null) } },
                              { label: device.operational === false ? 'Als einsatzbereit markieren' : 'Als nicht einsatzbereit markieren', action: () => { toggleOperational(device); setOpenMenu(null) }, danger: device.operational !== false },
                              { label: 'Löschen', action: () => { deleteDevice(device); setOpenMenu(null) }, danger: true },
                            ].map(item => (
                              <button key={item.label} onClick={item.action}
                                style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, textAlign: 'left' as const, color: item.danger ? '#dc2626' : 'var(--lbf-text)', fontFamily: 'inherit' }}>
                                {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ═══ DEFEKTE TAB ═══ */}
        {activeTab === 'defekte' && (
          <>
            {/* Pending external reports */}
            {pendingReports.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 12 }}>
                  Eingehende Meldungen ({pendingReports.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {pendingReports.map(r => (
                    <div key={r.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid #d97706', overflow: 'hidden' }}>
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>{r.device_name}</div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: SEVERITY_CFG[r.severity].color, background: SEVERITY_CFG[r.severity].bg, borderRadius: 99, padding: '3px 9px', flexShrink: 0, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                            {SEVERITY_CFG[r.severity].label}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--lbf-text)', marginBottom: 8, lineHeight: 1.5 }}>{r.description}</div>
                        <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
                          {relativeDate(r.created)} · {r.reporter_name || 'Anonym'}
                        </div>
                        {unklarRef.current.bestaetigungen[r.id] && (
                          <div style={{ fontSize: 12, fontStyle: 'italic', color: '#dc2626', marginTop: 4 }}>Bestätigung nicht sicher gespeichert — bitte erneut senden</div>
                        )}
                      </div>
                      <div style={{ borderTop: '0.5px solid var(--lbf-border-light)', background: 'var(--lbf-fuss)', padding: '8px 14px', display: 'flex', gap: 8 }}>
                        <button onClick={() => openConfirmSheet(r)}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--lbf-akzent-grund)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Bestätigen
                        </button>
                        <button onClick={() => { setRejectTarget(r); setRejectReason('') }}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '0.5px solid rgba(var(--lbf-rot-rgb),0.2)', background: 'none', color: 'var(--warm-gray)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Ablehnen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {openDefects.length === 0 && resolvedDefects.length === 0 && pendingReports.length === 0 && (
              <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--warm-gray)' }}>
                <div style={{ fontSize: 13, fontStyle: 'italic' }}>Keine Defekte gemeldet</div>
              </div>
            )}
            {(openDefects.length > 0 || resolvedDefects.length > 0) && (
              <>
                {openDefects.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 12 }}>
                      Offene Defekte ({openDefects.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                      {openDefects.map(def => (
                        <div key={def.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${SEVERITY_CFG[def.severity].color}`, overflow: 'hidden' }}>
                          <div style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between', marginBottom: 6 }}>
                              <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>{def.device_name}</div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: SEVERITY_CFG[def.severity].color, background: SEVERITY_CFG[def.severity].bg, borderRadius: 99, padding: '3px 9px', flexShrink: 0, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                                {SEVERITY_CFG[def.severity].label}
                              </span>
                            </div>
                            <div style={{ fontSize: 14, color: 'var(--lbf-text)', marginBottom: 8, lineHeight: 1.5 }}>{def.description}</div>
                            <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
                              {relativeDate(def.created)} · {def.reported_by}
                            </div>
                          </div>
                          <div style={{ borderTop: '0.5px solid var(--lbf-border-light)', background: 'var(--lbf-fuss)', padding: '8px 14px', display: 'flex', gap: 8 }}>
                            <button onClick={() => openResolveSheet(def)}
                              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Als behoben markieren
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {resolvedDefects.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 12 }}>
                      Behobene Defekte ({resolvedDefects.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {resolvedDefects.map(def => (
                        <div key={def.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', borderLeft: '3px solid rgba(var(--lbf-grau-rgb),0.35)', padding: '12px 16px', opacity: 0.75 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)' }}>{def.device_name}</div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.1)', borderRadius: 99, padding: '2px 8px', textTransform: 'uppercase' as const }}>Behoben</span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 4 }}>{def.description}</div>
                          {def.resolved_notes && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>→ {def.resolved_notes}</div>}
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 6 }}>
                            Gemeldet {relativeDate(def.created)} · Behoben von {def.resolved_by || '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ═══ LOGBUCH TAB ═══ */}
        {activeTab === 'logbuch' && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 12 }}>
              Prüfungsprotokoll ({inspections.length})
            </div>
            {inspections.length === 0 ? (
              <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch keine Prüfungen durchgeführt</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {inspections.map(insp => { const erg = ergebnisVon(insp); return (
                  <details key={insp.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${ERGEBNIS_FARBE[erg]}`, overflow: 'hidden' }}>
                    <summary style={{ padding: '14px 16px', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)', marginBottom: 3 }}>{insp.device_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
                          {fmtDateTime(insp.inspection_date)} · {insp.user_name}
                        </div>
                        {insp.notes && <div style={{ fontSize: 12, color: 'var(--lbf-text)', marginTop: 4, fontStyle: 'italic' }}>{insp.notes}</div>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: ERGEBNIS_FARBE[erg], textTransform: 'uppercase' as const, letterSpacing: '0.08em', flexShrink: 0 }}>
                        {ERGEBNIS_TEXT[erg]}
                      </span>
                    </summary>
                    {insp.checklist_results?.length > 0 && (
                      <div style={{ borderTop: '0.5px solid var(--lbf-border-light)', padding: '12px 16px' }}>
                        {insp.checklist_results.map((r, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', borderBottom: i < insp.checklist_results.length - 1 ? '0.5px solid rgba(var(--lbf-rot-rgb),0.05)' : 'none' }}>
                            <span style={{ color: r.checked ? '#16a34a' : '#dc2626', flexShrink: 0 }}>
                              {pik(r.checked ? <><polyline points="20 6 9 17 4 12"/></> : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>, 14)}
                            </span>
                            <div>
                              <div style={{ fontSize: 13, color: 'var(--lbf-text)' }}>{r.item}</div>
                              {r.note && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>→ {r.note}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                ) })}
              </div>
            )}
          </>
        )}

        {/* ═══ VORLAGEN TAB ═══ */}
        {activeTab === 'vorlagen' && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 12 }}>Prüfvorlagen pro Gerätetyp</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DEVICE_TYPES.map(type => {
                const t = checklists.find(c => c.device_type === type)
                const count = t?.items.length || (DEFAULT_CHECKLISTS[type] || DEFAULT_CHECKLISTS['Sonstiges']).length
                return (
                  <button key={type} onClick={() => openVorlagen(type)}
                    style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid var(--lbf-akzent)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', fontFamily: 'inherit', border: 'none', textAlign: 'left' as const }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)' }}>{type}</div>
                      <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 2 }}>{count} Prüfpunkte</div>
                    </div>
                    <span style={{ color: 'var(--warm-gray)' }}>{pik(<polyline points="9 18 15 12 9 6"/>, 16)}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {toast}

      {/* ── Add/Edit Device Sheet ── */}
      {deviceSheet !== null && (
        <>
          <div onClick={() => setDeviceSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(var(--lbf-rot-rgb),0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: 'var(--lbf-text)', marginBottom: 20 }}>
              {deviceSheet.id ? 'Gerät bearbeiten' : 'Neues Gerät'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Gerätetyp *', el: (
                  <select value={deviceSheet.type} onChange={e => setDeviceSheet({ ...deviceSheet, type: e.target.value })}
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }}>
                    {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )},
                { label: 'Bezeichnung *', el: (
                  <input autoFocus type="text" value={deviceSheet.name} onChange={e => setDeviceSheet({ ...deviceSheet, name: e.target.value })} placeholder="z.B. AED Eingangsbereich"
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }} />
                )},
                { label: 'Seriennummer', el: (
                  <input type="text" value={deviceSheet.serial_number} onChange={e => setDeviceSheet({ ...deviceSheet, serial_number: e.target.value })} placeholder="Optional"
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }} />
                )},
                { label: 'Standort', el: (
                  <input type="text" value={deviceSheet.location} onChange={e => setDeviceSheet({ ...deviceSheet, location: e.target.value })} placeholder="z.B. Fahrzeug 1, Büro, Eingang"
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }} />
                )},
                { label: 'Prüfintervall *', el: (
                  <select value={deviceSheet.interval} onChange={e => setDeviceSheet({ ...deviceSheet, interval: e.target.value as DeviceInterval })}
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }}>
                    {Object.entries(INTERVAL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                )},
              ].map(({ label, el }) => (
                <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>{label}</span>
                  {el}
                </label>
              ))}

              {/* STK */}
              <div style={{ background: 'var(--warm-bg)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={deviceSheet.has_stk} onChange={e => setDeviceSheet({ ...deviceSheet, has_stk: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: 'var(--lbf-akzent)', cursor: 'pointer', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lbf-text)' }}>STK (Sicherheitstechn. Kontrolle) erforderlich</span>
                </label>
                {deviceSheet.has_stk && (
                  <div style={{ display: 'flex', gap: 10, paddingLeft: 28 }}>
                    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Letzte STK</span>
                      <input type="date" value={deviceSheet.last_stk} onChange={e => setDeviceSheet({ ...deviceSheet, last_stk: e.target.value })}
                        style={{ padding: '9px 10px', borderRadius: 8, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--lbf-card)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
                    </label>
                    <label style={{ width: 80, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Intervall (Mon.)</span>
                      <input type="number" min="1" max="120" value={deviceSheet.stk_interval_months} onChange={e => setDeviceSheet({ ...deviceSheet, stk_interval_months: Number(e.target.value) })}
                        style={{ padding: '9px 10px', borderRadius: 8, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--lbf-card)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
                    </label>
                  </div>
                )}
              </div>

              {/* MTK */}
              <div style={{ background: 'var(--warm-bg)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={deviceSheet.has_mtk} onChange={e => setDeviceSheet({ ...deviceSheet, has_mtk: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: 'var(--lbf-akzent)', cursor: 'pointer', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lbf-text)' }}>MTK (Messtechn. Kontrolle) erforderlich</span>
                </label>
                {deviceSheet.has_mtk && (
                  <div style={{ display: 'flex', gap: 10, paddingLeft: 28 }}>
                    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Letzte MTK</span>
                      <input type="date" value={deviceSheet.last_mtk} onChange={e => setDeviceSheet({ ...deviceSheet, last_mtk: e.target.value })}
                        style={{ padding: '9px 10px', borderRadius: 8, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--lbf-card)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
                    </label>
                    <label style={{ width: 80, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Intervall (Mon.)</span>
                      <input type="number" min="1" max="120" value={deviceSheet.mtk_interval_months} onChange={e => setDeviceSheet({ ...deviceSheet, mtk_interval_months: Number(e.target.value) })}
                        style={{ padding: '9px 10px', borderRadius: 8, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--lbf-card)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
                    </label>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setDeviceSheet(null)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
                <button onClick={saveDevice} disabled={busy} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: 'var(--lbf-akzent-grund)', fontSize: 15, fontWeight: 700, color: '#fff', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>
                  {deviceSheet.id ? 'Speichern' : 'Hinzufügen'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Device History Sheet ── */}
      {historyDevice && (
        <>
          <div onClick={() => setHistoryDevice(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 0 calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>
            <div style={{ padding: '0 20px', marginBottom: 4 }}>
              <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(var(--lbf-rot-rgb),0.2)', margin: '0 auto 16px' }} />
              <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)' }}>{historyDevice.name}</div>
              <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 2 }}>{historyDevice.type} · {historyDevice.location}</div>
            </div>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', borderBottom: '0.5px solid var(--lbf-border-light)', margin: '12px 0 0' }}>
              {([['pruefungen', 'Prüfungen'], ['defekte', 'Defekte']] as ['pruefungen'|'defekte', string][]).map(([t, l]) => (
                <button key={t} onClick={() => setHistoryTab(t)} style={{ flex: 1, padding: '10px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: historyTab === t ? 'var(--lbf-akzent)' : 'var(--warm-gray)', fontFamily: 'inherit', borderTop: historyTab === t ? '2px solid var(--lbf-akzent)' : '2px solid transparent' }}>{l}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {historyTab === 'pruefungen' && (() => {
                const di = inspections.filter(i => i.device_id === historyDevice.id)
                return di.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic', padding: '24px 0' }}>Noch keine Prüfungen</div>
                ) : di.map(insp => { const erg = ergebnisVon(insp); return (
                  <div key={insp.id} style={{ background: 'var(--warm-bg)', borderRadius: 10, padding: '12px', marginBottom: 10, borderLeft: `3px solid ${ERGEBNIS_FARBE[erg]}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)' }}>{fmtDateTime(insp.inspection_date)} · {insp.user_name}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: ERGEBNIS_FARBE[erg], textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{ERGEBNIS_TEXT[erg]}</span>
                    </div>
                    {insp.notes && <div style={{ fontSize: 13, color: 'var(--lbf-text)', fontStyle: 'italic' }}>{insp.notes}</div>}
                  </div>
                ) })
              })()}
              {historyTab === 'defekte' && (() => {
                const dd = defects.filter(d => d.device_id === historyDevice.id)
                return (
                  <>
                    <button onClick={() => { openDefectSheet(historyDevice); setHistoryDevice(null) }}
                      style={{ width: '100%', marginBottom: 16, padding: '11px', borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Defekt melden
                    </button>
                    {dd.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic', padding: '24px 0' }}>Keine Defekte für dieses Gerät</div>
                    ) : dd.map(def => (
                      <div key={def.id} style={{ background: 'var(--warm-bg)', borderRadius: 10, padding: '12px', marginBottom: 10, borderLeft: `3px solid ${def.status === 'resolved' ? 'rgba(var(--lbf-grau-rgb),0.35)' : SEVERITY_CFG[def.severity].color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                          <div style={{ fontSize: 13, color: 'var(--lbf-text)' }}>{def.description}</div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: def.status === 'resolved' ? '#16a34a' : SEVERITY_CFG[def.severity].color, flexShrink: 0 }}>
                            {def.status === 'resolved' ? 'Behoben' : SEVERITY_CFG[def.severity].label}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>{relativeDate(def.created)} · {def.reported_by}</div>
                        {def.resolved_notes && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 4 }}>→ {def.resolved_notes}</div>}
                      </div>
                    ))}
                  </>
                )
              })()}
            </div>
          </div>
        </>
      )}

      {/* ── Report Defect Sheet ── */}
      {defectDevice && (
        <>
          <div onClick={() => !busy && setDefectDevice(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '80vh', overflowY: 'auto', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(var(--lbf-rot-rgb),0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>{defectDevice.type}</div>
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 20 }}>Defekt melden</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#dc2626' }}>Beschreibung *</span>
                <textarea autoFocus value={defectForm.description} readOnly={defectForm.unklar || busy} onChange={e => setDefectForm({ ...defectForm, description: e.target.value })} placeholder="Was genau ist defekt? Wie macht sich der Defekt bemerkbar?" rows={4}
                  style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(220,38,38,0.2)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#dc2626' }}>Schweregrad</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(Object.entries(SEVERITY_CFG) as [Severity, typeof SEVERITY_CFG[Severity]][]).map(([key, cfg]) => (
                    <button key={key} onClick={() => setDefectForm({ ...defectForm, severity: key })} disabled={defectForm.unklar} type="button"
                      style={{ padding: '10px', borderRadius: 10, border: `1.5px solid ${defectForm.severity === key ? cfg.color : 'rgba(var(--lbf-rot-rgb),0.1)'}`, background: defectForm.severity === key ? cfg.bg : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: cfg.color }}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </label>
              {sperrtDefekt(defectForm.severity) ? (
                <div style={{ fontSize: 12, fontStyle: 'italic', color: '#dc2626' }}>
                  Bei „{SEVERITY_CFG[defectForm.severity].label}“ wird das Gerät gesperrt, bis der Defekt behoben ist.
                </div>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={defectForm.sperren} disabled={defectForm.unklar} onChange={e => setDefectForm({ ...defectForm, sperren: e.target.checked })}
                    style={{ width: 20, height: 20, accentColor: 'var(--lbf-akzent)', cursor: 'pointer', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lbf-text)' }}>Gerät sperren</div>
                    <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Als nicht einsatzbereit markieren</div>
                  </div>
                </label>
              )}
              {defectForm.unklar && (
                <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--lbf-text)' }}>
                  Ob diese Meldung gespeichert wurde, ist unklar. Erneut senden legt sie nicht doppelt an.
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => defectForm.unklar ? verwerfeUnklarenDefekt() : setDefectDevice(null)} disabled={busy} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>{defectForm.unklar ? 'Verwerfen' : 'Abbrechen'}</button>
                <button onClick={reportDefect} disabled={!defectForm.description.trim() || busy}
                  style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: !defectForm.description.trim() || busy ? 'rgba(220,38,38,0.3)' : '#dc2626', fontSize: 15, fontWeight: 700, color: '#fff', cursor: !defectForm.description.trim() ? 'not-allowed' : busy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                  {busy ? 'Speichert…' : defectForm.unklar ? 'Erneut senden' : 'Defekt melden'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Resolve Defect Sheet ── */}
      {resolveTarget && (
        <>
          <div onClick={() => !busy && setResolveTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '70vh', overflowY: 'auto', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(var(--lbf-rot-rgb),0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 6 }}>Defekt beheben</div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic', marginBottom: 20 }}>{resolveTarget.device_name} · {resolveTarget.description}</div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Lösungshinweis (optional)</span>
              <textarea value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="Was wurde gemacht? Ersatzteil, Reparatur, ..." rows={3}
                style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            </label>
            {(() => {
              const geraet = devices.find(d => d.id === resolveTarget.device_id)
              if (!geraet || geraet.operational !== false) return null
              const weitere = offeneDefekteVon(geraet.id).filter(d => d.id !== resolveTarget.id)
              const weitereSperrend = weitere.filter(d => sperrtDefekt(d.severity)).length
              if (weitereSperrend) return (
                <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginBottom: 16 }}>
                  Das Gerät bleibt gesperrt: {weitereSperrend === 1 ? 'ein weiterer Defekt' : `${weitereSperrend} weitere Defekte`} „hoch“ oder „kritisch“ offen.
                </div>
              )
              return (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 16 }}>
                  <input type="checkbox" checked={wiederEinsatzbereit} onChange={e => setWiederEinsatzbereit(e.target.checked)}
                    style={{ width: 20, height: 20, accentColor: 'var(--lbf-akzent)', cursor: 'pointer', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lbf-text)' }}>Gerät wieder einsatzbereit</div>
                    <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
                      {[
                        weitere.length ? `Noch ${weitere.length === 1 ? 'ein Mangel' : `${weitere.length} Mängel`} offen.` : '',
                        pruefungNichtBestanden(geraet) ? 'Die letzte Prüfung ist nicht bestanden — gesperrt bleibt es, bis eine Prüfung bestanden ist.' : 'Hebt die Sperre auf.',
                      ].filter(Boolean).join(' ')}
                    </div>
                  </div>
                </label>
              )
            })()}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setResolveTarget(null)} disabled={busy} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={resolveDefect} disabled={busy} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: '#16a34a', fontSize: 15, fontWeight: 700, color: '#fff', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>{busy ? 'Speichert…' : 'Als behoben markieren'}</button>
            </div>
          </div>
        </>
      )}

      {/* ── Confirm External Report Sheet ── */}
      {confirmTarget && (
        <>
          <div onClick={() => !busy && setConfirmTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '75vh', overflowY: 'auto', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(var(--lbf-rot-rgb),0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Meldung bestätigen</div>
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 8 }}>{confirmTarget.device_name}</div>
            <div style={{ fontSize: 14, color: 'var(--lbf-text)', marginBottom: 4, lineHeight: 1.5 }}>{confirmTarget.description}</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', marginBottom: 16 }}>
              Gemeldet von {confirmTarget.reporter_name || 'Anonym'} · {relativeDate(confirmTarget.created)}
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Anmerkung (optional)</span>
              <textarea value={confirmNotes} readOnly={!!confirmVersuch || busy} onChange={e => setConfirmNotes(e.target.value)} placeholder="z.B. Gerät gesichtet, Ersatz auf RTW 2 gelegt, …" rows={3}
                style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            </label>
            {geraeteGeladen && !devices.some(d => d.id === confirmTarget.device_id) ? (
              <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginBottom: 20 }}>Das Gerät gibt es nicht mehr — es wird nur der Defekt-Eintrag angelegt.</div>
            ) : sperrtDefekt(confirmTarget.severity) ? (
              <div style={{ fontSize: 12, fontStyle: 'italic', color: '#dc2626', marginBottom: 20 }}>
                Ein Defekt-Eintrag wird angelegt. Bei „{SEVERITY_CFG[confirmTarget.severity].label}“ wird das Gerät gesperrt, bis der Defekt behoben ist.
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 20 }}>
                <input type="checkbox" checked={confirmSperren} disabled={!!confirmVersuch || busy} onChange={e => setConfirmSperren(e.target.checked)}
                  style={{ width: 20, height: 20, accentColor: 'var(--lbf-akzent)', cursor: 'pointer', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lbf-text)' }}>Gerät sperren</div>
                  <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Als nicht einsatzbereit markieren. Ein Defekt-Eintrag wird in jedem Fall angelegt.</div>
                </div>
              </label>
            )}
            {confirmVersuch && !busy && (
              <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--lbf-text)', marginBottom: 14 }}>
                Ob diese Bestätigung gespeichert wurde, ist unklar. Erneut senden legt den Defekt nicht doppelt an.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmTarget(null)} disabled={busy} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>{confirmVersuch ? 'Schließen' : 'Abbrechen'}</button>
              <button onClick={confirmExternalReport} disabled={busy} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: 'var(--lbf-akzent-grund)', fontSize: 15, fontWeight: 700, color: '#fff', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>{busy ? 'Speichert…' : confirmVersuch ? 'Erneut senden' : 'Bestätigen & Defekt anlegen'}</button>
            </div>
          </div>
        </>
      )}

      {/* ── Reject External Report Sheet ── */}
      {rejectTarget && (
        <>
          <div onClick={() => !busy && setRejectTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '70vh', overflowY: 'auto', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(var(--lbf-rot-rgb),0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 6 }}>Meldung ablehnen</div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic', marginBottom: 20 }}>{rejectTarget.device_name} · {rejectTarget.description}</div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Ablehnungsgrund (optional)</span>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="z.B. Falsches Gerät angegeben, kein tatsächlicher Defekt, …" rows={3}
                style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setRejectTarget(null)} disabled={busy} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={rejectExternalReport} disabled={busy} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: '#dc2626', fontSize: 15, fontWeight: 700, color: '#fff', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>Ablehnen</button>
            </div>
          </div>
        </>
      )}

      {/* ── Vorlagen Editor Sheet ── */}
      {showVorlagen && (
        <>
          <div onClick={() => setShowVorlagen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(var(--lbf-rot-rgb),0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 16 }}>Prüfvorlage bearbeiten</div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Gerätetyp</span>
              <select value={vtType} onChange={e => vtSwitchType(e.target.value)}
                style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }}>
                {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Prüfpunkte ({vtItems.length})</span>
              <button onClick={() => { if (!confirm('Auf Standard zurücksetzen?')) return; setVtItems([...(DEFAULT_CHECKLISTS[vtType] || DEFAULT_CHECKLISTS['Sonstiges'])]) }}
                style={{ fontSize: 11, color: 'var(--warm-gray)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Zurücksetzen</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {vtItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--warm-bg)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--lbf-text)' }}>{item}</div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => { if (i === 0) return; const a = [...vtItems]; [a[i-1],a[i]] = [a[i],a[i-1]]; setVtItems(a) }} disabled={i === 0}
                      style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: 'var(--warm-gray)', padding: 3, opacity: i === 0 ? 0.3 : 1 }}>
                      {pik(<polyline points="18 15 12 9 6 15"/>, 14)}
                    </button>
                    <button onClick={() => { if (i >= vtItems.length - 1) return; const a = [...vtItems]; [a[i],a[i+1]] = [a[i+1],a[i]]; setVtItems(a) }} disabled={i >= vtItems.length - 1}
                      style={{ background: 'none', border: 'none', cursor: i >= vtItems.length - 1 ? 'default' : 'pointer', color: 'var(--warm-gray)', padding: 3, opacity: i >= vtItems.length - 1 ? 0.3 : 1 }}>
                      {pik(<polyline points="6 9 12 15 18 9"/>, 14)}
                    </button>
                    <button onClick={() => setVtItems(vtItems.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 3 }}>
                      {pik(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>, 14)}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input value={vtNewItem} onChange={e => setVtNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && vtNewItem.trim()) { setVtItems([...vtItems, vtNewItem.trim()]); setVtNewItem('') } }}
                placeholder="Neuen Prüfpunkt eingeben…"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={() => { if (!vtNewItem.trim()) return; setVtItems([...vtItems, vtNewItem.trim()]); setVtNewItem('') }}
                style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--lbf-akzent-grund)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {pik(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>, 16)}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowVorlagen(false)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={saveVorlage} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: 'var(--lbf-akzent-grund)', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Speichern</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
