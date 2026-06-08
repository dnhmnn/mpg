import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'geraete' | 'defekte' | 'logbuch' | 'vorlagen'
type DeviceInterval = 'daily' | 'weekly' | 'monthly' | 'yearly'
type Severity = 'low' | 'medium' | 'high' | 'critical'
type DefectStatus = 'open' | 'in_progress' | 'resolved'
type DeviceStatus = 'ok' | 'warning' | 'overdue' | 'defect'
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
  critical: { label: 'Kritisch',  color: '#7f1d1d', bg: 'rgba(127,29,29,0.12)'  },
}

const STATUS_BORDER: Record<DeviceStatus, string> = {
  ok: '#16a34a', warning: '#d97706', overdue: '#dc2626', defect: '#7f1d1d',
}

const INTERVAL_LABELS: Record<DeviceInterval, string> = {
  daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich', yearly: 'Jährlich',
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
  if (days === 0) return 'heute'
  if (days === 1) return 'gestern'
  if (days < 7) return `vor ${days} Tagen`
  return fmtDate(s)
}

function calcPeriodicStatus(lastDate: string | null | undefined, intervalMonths: number): 'ok' | 'warning' | 'overdue' {
  const d = parseDate(lastDate)
  if (!d) return 'overdue'
  const next = new Date(d)
  next.setMonth(next.getMonth() + intervalMonths)
  const daysLeft = Math.floor((next.getTime() - Date.now()) / 86400000)
  if (daysLeft < 0) return 'overdue'
  if (daysLeft <= 30) return 'warning'
  return 'ok'
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

  // UI
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DeviceStatus>('all')
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // Add/Edit Device sheet
  const [deviceSheet, setDeviceSheet] = useState<null | { id?: string; name: string; type: string; serial_number: string; location: string; interval: DeviceInterval; operational: boolean; has_stk: boolean; last_stk: string; stk_interval_months: number; has_mtk: boolean; last_mtk: string; mtk_interval_months: number }>(null)

  // Inspection overlay
  const [inspState, setInspState] = useState<null | {
    device: Device; items: string[]; results: ChecklistResult[]; step: number; notes: string
  }>(null)

  // Device history sheet
  const [historyDevice, setHistoryDevice] = useState<Device | null>(null)
  const [historyTab, setHistoryTab] = useState<'pruefungen' | 'defekte'>('pruefungen')

  // Report defect sheet
  const [defectDevice, setDefectDevice] = useState<Device | null>(null)
  const [defectForm, setDefectForm] = useState({ description: '', severity: 'medium' as Severity })

  // Resolve defect sheet
  const [resolveTarget, setResolveTarget] = useState<Defect | null>(null)
  const [resolveNotes, setResolveNotes] = useState('')

  // Vorlagen (checklist template editor)
  const [showVorlagen, setShowVorlagen] = useState(false)
  const [vtType, setVtType] = useState('AED')
  const [vtItems, setVtItems] = useState<string[]>([])
  const [vtNewItem, setVtNewItem] = useState('')

  // External defect reports
  const [externalReports, setExternalReports] = useState<ExternalReport[]>([])
  const [confirmTarget, setConfirmTarget] = useState<ExternalReport | null>(null)
  const [confirmNotes, setConfirmNotes] = useState('')
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

  // ── Data Loading ───────────────────────────────────────────────────────

  async function loadAll() {
    if (!user?.organization_id) return
    setLoading(true)
    try {
      await Promise.all([loadDevices(), loadInspections(), loadChecklists(), loadDefects(), loadExternalReports()])
    } finally {
      setLoading(false)
    }
  }

  async function loadDevices() {
    const r = await pb.collection('mpg_devices').getFullList<Device>({ filter: `organization_id = "${user!.organization_id}"`, sort: 'name' })
    setDevices(r)
  }

  async function loadInspections() {
    const r = await pb.collection('mpg_inspections').getFullList<Inspection>({ filter: `organization_id = "${user!.organization_id}"`, sort: '-inspection_date' })
    setInspections(r)
  }

  async function loadDefects() {
    try {
      const r = await pb.collection('mpg_defects').getFullList<Defect>({ filter: `organization_id = "${user!.organization_id}"`, sort: '-created' })
      setDefects(r)
    } catch { /* collection not yet created */ }
  }

  async function loadExternalReports() {
    try {
      const r = await pb.collection('mpg_defect_reports').getFullList<ExternalReport>({ filter: `organization_id = "${user!.organization_id}"`, sort: '-created' })
      setExternalReports(r)
    } catch { /* collection not yet created */ }
  }

  async function loadChecklists() {
    const records = await pb.collection('mpg_checklists').getFullList<Checklist>({ filter: `organization_id = "${user!.organization_id}"` })
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
    setTimeout(() => setMsg(null), 3000)
  }

  function calcNextDue(device: Device): Date | null {
    const stored = parseDate(device.next_inspection_due)
    if (stored) return stored
    const base = parseDate(device.last_inspection) || parseDate(device.created)
    if (!base) return null
    const next = new Date(base)
    switch (device.interval) {
      case 'daily': next.setDate(next.getDate() + 1); break
      case 'weekly': next.setDate(next.getDate() + 7); break
      case 'monthly': next.setMonth(next.getMonth() + 1); break
      case 'yearly': next.setFullYear(next.getFullYear() + 1); break
    }
    return next
  }

  function getDeviceStatus(device: Device): DeviceStatus {
    if (device.operational === false) return 'defect'
    const hasOpenDefect = defects.some(d => d.device_id === device.id && d.status !== 'resolved')
    if (hasOpenDefect) return 'defect'
    if (device.last_inspection_passed === false) return 'overdue'
    if (device.has_stk && calcPeriodicStatus(device.last_stk, device.stk_interval_months || 24) === 'overdue') return 'overdue'
    if (device.has_mtk && calcPeriodicStatus(device.last_mtk, device.mtk_interval_months || 24) === 'overdue') return 'overdue'
    const due = calcNextDue(device)
    if (!due) return 'overdue'
    const diff = Math.floor((due.getTime() - Date.now()) / 86400000)
    if (diff < 0) return 'overdue'
    if (device.has_stk && calcPeriodicStatus(device.last_stk, device.stk_interval_months || 24) === 'warning') return 'warning'
    if (device.has_mtk && calcPeriodicStatus(device.last_mtk, device.mtk_interval_months || 24) === 'warning') return 'warning'
    if (diff <= 7) return 'warning'
    return 'ok'
  }

  const stats = {
    ok: devices.filter(d => getDeviceStatus(d) === 'ok').length,
    warning: devices.filter(d => getDeviceStatus(d) === 'warning').length,
    overdue: devices.filter(d => getDeviceStatus(d) === 'overdue').length,
    defect: devices.filter(d => getDeviceStatus(d) === 'defect').length,
    total: devices.length,
  }

  const filteredDevices = devices.filter(d => {
    const q = searchQuery.toLowerCase()
    const matchSearch = !q || d.name.toLowerCase().includes(q) || d.type.toLowerCase().includes(q) || (d.location || '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || getDeviceStatus(d) === statusFilter
    return matchSearch && matchStatus
  })

  // Device CRUD
  async function saveDevice() {
    if (!deviceSheet?.name.trim()) { showMsg('Bezeichnung fehlt', 'error'); return }
    const nextDue = new Date()
    switch (deviceSheet.interval) {
      case 'daily': nextDue.setDate(nextDue.getDate() + 1); break
      case 'weekly': nextDue.setDate(nextDue.getDate() + 7); break
      case 'monthly': nextDue.setMonth(nextDue.getMonth() + 1); break
      case 'yearly': nextDue.setFullYear(nextDue.getFullYear() + 1); break
    }
    const data = { ...deviceSheet, next_inspection_due: nextDue.toISOString(), organization_id: user!.organization_id }
    try {
      if (deviceSheet.id) {
        await pb.collection('mpg_devices').update(deviceSheet.id, data)
        showMsg('Gerät aktualisiert')
      } else {
        await pb.collection('mpg_devices').create(data)
        showMsg('Gerät hinzugefügt')
      }
      setDeviceSheet(null)
      await loadDevices()
    } catch (e: unknown) { showMsg('Fehler: ' + (e as Error).message, 'error') }
  }

  async function deleteDevice(id: string, name: string) {
    if (!confirm(`Gerät "${name}" wirklich löschen?`)) return
    await pb.collection('mpg_devices').delete(id)
    showMsg('Gerät gelöscht')
    await loadDevices()
  }

  // Inspection
  function startInspection(device: Device) {
    const template = checklists.find(c => c.device_type === device.type) || checklists.find(c => c.device_type === 'Sonstiges')
    const items = template?.items || DEFAULT_CHECKLISTS['Sonstiges']
    setInspState({ device, items, results: items.map(item => ({ item, checked: false, note: '' })), step: 0, notes: '' })
  }

  async function saveInspection(passed: boolean) {
    if (!inspState) return
    try {
      await pb.collection('mpg_inspections').create({
        device_id: inspState.device.id, device_name: inspState.device.name, device_type: inspState.device.type,
        user_name: user?.name || user?.email || 'Unbekannt',
        inspection_date: new Date().toISOString(), passed, notes: inspState.notes,
        checklist_results: inspState.results, organization_id: user!.organization_id,
      })
      const nextDue = new Date()
      switch (inspState.device.interval) {
        case 'daily': nextDue.setDate(nextDue.getDate() + 1); break
        case 'weekly': nextDue.setDate(nextDue.getDate() + 7); break
        case 'monthly': nextDue.setMonth(nextDue.getMonth() + 1); break
        case 'yearly': nextDue.setFullYear(nextDue.getFullYear() + 1); break
        default: nextDue.setMonth(nextDue.getMonth() + 1)
      }
      await pb.collection('mpg_devices').update(inspState.device.id, {
        last_inspection: new Date().toISOString(), last_inspection_passed: passed,
        next_inspection_due: nextDue.toISOString(),
      })
      setInspState(null)
      showMsg(passed ? 'Prüfung bestanden!' : 'Prüfung nicht bestanden', passed ? 'success' : 'error')
      await loadAll()
    } catch (e: unknown) { showMsg('Fehler: ' + (e as Error).message, 'error') }
  }

  // Defects
  async function reportDefect() {
    if (!defectDevice || !defectForm.description.trim()) { showMsg('Beschreibung fehlt', 'error'); return }
    try {
      await pb.collection('mpg_defects').create({
        device_id: defectDevice.id, device_name: defectDevice.name,
        reported_by: user?.name || user?.email || 'Unbekannt',
        description: defectForm.description.trim(),
        severity: defectForm.severity, status: 'open',
        organization_id: user!.organization_id,
      })
      setDefectDevice(null)
      setDefectForm({ description: '', severity: 'medium' })
      showMsg('Defekt gemeldet')
      await loadDefects()
    } catch (e: unknown) { showMsg('Fehler: ' + (e as Error).message, 'error') }
  }

  async function resolveDefect() {
    if (!resolveTarget) return
    try {
      await pb.collection('mpg_defects').update(resolveTarget.id, {
        status: 'resolved', resolved_by: user?.name || user?.email || 'Unbekannt',
        resolved_notes: resolveNotes.trim(),
      })
      setResolveTarget(null)
      setResolveNotes('')
      showMsg('Defekt als behoben markiert')
      await loadDefects()
    } catch (e: unknown) { showMsg('Fehler: ' + (e as Error).message, 'error') }
  }

  async function deleteDefect(id: string) {
    if (!confirm('Defekt-Eintrag löschen?')) return
    await pb.collection('mpg_defects').delete(id)
    showMsg('Eintrag gelöscht')
    await loadDefects()
  }

  async function toggleOperational(device: Device) {
    const newVal = device.operational !== false ? false : true
    await pb.collection('mpg_devices').update(device.id, { operational: newVal })
    showMsg(newVal ? 'Gerät als einsatzbereit markiert' : 'Gerät als nicht einsatzbereit markiert', newVal ? 'success' : 'error')
    await loadDevices()
  }

  async function confirmExternalReport() {
    if (!confirmTarget) return
    try {
      await pb.collection('mpg_defects').create({
        device_id: confirmTarget.device_id, device_name: confirmTarget.device_name,
        reported_by: confirmTarget.reporter_name || 'Externe Meldung',
        description: confirmTarget.description,
        severity: confirmTarget.severity, status: 'open',
        organization_id: user!.organization_id,
      })
      await pb.collection('mpg_devices').update(confirmTarget.device_id, { operational: false })
      await pb.collection('mpg_defect_reports').update(confirmTarget.id, { status: 'confirmed' })
      setConfirmTarget(null)
      setConfirmNotes('')
      showMsg('Meldung bestätigt — Defekt angelegt, Gerät deaktiviert')
      await loadAll()
    } catch (e: unknown) { showMsg('Fehler: ' + (e as Error).message, 'error') }
  }

  async function rejectExternalReport() {
    if (!rejectTarget) return
    try {
      await pb.collection('mpg_defect_reports').update(rejectTarget.id, { status: 'rejected', rejected_reason: rejectReason.trim() })
      setRejectTarget(null)
      setRejectReason('')
      showMsg('Meldung abgelehnt')
      await loadExternalReports()
    } catch (e: unknown) { showMsg('Fehler: ' + (e as Error).message, 'error') }
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

  // ── Inspection Overlay (full-screen) ────────────────────────────────────

  if (inspState) {
    const { device, results, step, notes } = inspState
    const isLastStep = step >= results.length
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--warm-bg)', overflowY: 'auto', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif", zIndex: 500 }}>
        {/* Header */}
        <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', padding: 'calc(env(safe-area-inset-top) + 14px) 20px 14px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100 }}>
          <button onClick={() => setInspState(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#600812', display: 'flex' }}>
            {pik(<><polyline points="15 18 9 12 15 6"/></>)}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>Prüfung</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>{device.name}</div>
          </div>
          {!isLastStep && (
            <div style={{ fontSize: 11, fontWeight: 700, color: '#600812', background: 'rgba(96,8,18,0.07)', borderRadius: 99, padding: '3px 10px' }}>
              {step + 1} / {results.length}
            </div>
          )}
        </div>

        <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px' }}>
          {!isLastStep ? (
            <>
              {/* Progress bar */}
              <div style={{ height: 4, background: 'rgba(96,8,18,0.1)', borderRadius: 99, marginBottom: 28, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#600812', borderRadius: 99, width: `${(step / results.length) * 100}%`, transition: 'width .3s' }} />
              </div>

              {/* Checklist item */}
              <div style={{ background: 'var(--lbf-card)', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid #600812', marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 12 }}>
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
                    style={{ width: 22, height: 22, accentColor: '#600812', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
                  />
                  <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--lbf-text)', lineHeight: 1.5 }}>{results[step].item}</span>
                </label>
              </div>

              {/* Note for this item */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 8 }}>Bemerkung (optional)</div>
                <textarea
                  value={results[step].note}
                  onChange={e => {
                    const r = [...results]
                    r[step] = { ...r[step], note: e.target.value }
                    setInspState({ ...inspState, results: r })
                  }}
                  placeholder="z.B. Kleine Beschädigung, Batterie bei 80%, ..."
                  rows={3}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' as const }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setInspState({ ...inspState, step: Math.max(0, step - 1) })} disabled={step === 0}
                  style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: step === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: step === 0 ? 0.4 : 1 }}>
                  Zurück
                </button>
                <button onClick={() => setInspState({ ...inspState, step: step + 1 })}
                  style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: '#600812', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {step === results.length - 1 ? 'Zur Zusammenfassung' : 'Weiter'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Summary */}
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 12 }}>Zusammenfassung</div>
              <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 20 }}>
                {results.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderBottom: i < results.length - 1 ? '0.5px solid rgba(96,8,18,0.06)' : 'none' }}>
                    <span style={{ color: r.checked ? '#16a34a' : '#dc2626', flexShrink: 0, marginTop: 1 }}>
                      {pik(r.checked ? <><polyline points="20 6 9 17 4 12"/></> : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>, 16)}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--lbf-text)' }}>{r.item}</div>
                      {r.note && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 2 }}>→ {r.note}</div>}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 8 }}>Anmerkungen / Mängel</div>
                <textarea
                  value={notes}
                  onChange={e => setInspState({ ...inspState, notes: e.target.value })}
                  placeholder="Besondere Vorkommnisse, festgestellte Mängel..."
                  rows={4}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' as const }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                <button onClick={() => setInspState({ ...inspState, step: results.length - 1 })}
                  style={{ flex: 1, minWidth: 120, padding: '13px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'none', fontSize: 14, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Zurück
                </button>
                <button onClick={() => saveInspection(false)}
                  style={{ flex: 1, minWidth: 120, padding: '13px', borderRadius: 10, border: 'none', background: '#dc2626', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Nicht bestanden
                </button>
                <button onClick={() => saveInspection(true)}
                  style={{ flex: 2, minWidth: 140, padding: '13px', borderRadius: 10, border: 'none', background: '#16a34a', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Bestanden
                </button>
              </div>
            </>
          )}
        </div>
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
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', padding: 'calc(env(safe-area-inset-top) + 14px) 20px 14px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => navigate('/hub')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#600812', display: 'flex' }}>
          {pik(<><polyline points="15 18 9 12 15 6"/></>)}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>Medizinprodukte</div>
          <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>{today}</div>
        </div>
        {activeTab === 'geraete' && (
          <button onClick={() => setDeviceSheet({ name: '', type: 'AED', serial_number: '', location: '', interval: 'monthly', operational: true, has_stk: false, last_stk: '', stk_interval_months: 24, has_mtk: false, last_mtk: '', mtk_interval_months: 24 })}
            style={{ background: '#600812', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '7px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            {pik(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>, 14)}
            Gerät
          </button>
        )}
        {activeTab === 'vorlagen' && (
          <button onClick={() => openVorlagen()}
            style={{ background: '#600812', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '7px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
            Bearbeiten
          </button>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.08)', position: 'sticky', top: 'calc(env(safe-area-inset-top) + 60px)', zIndex: 99 }}>
        {([
          ['geraete', 'Geräte'],
          ['defekte', (() => { const n = openDefects.length + pendingReports.length; return n > 0 ? `Defekte (${n})` : 'Defekte' })()],
          ['logbuch', 'Logbuch'],
          ['vorlagen', 'Vorlagen'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            flex: 1, padding: '11px 4px 9px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
            color: activeTab === t ? '#600812' : 'var(--warm-gray)', fontFamily: 'inherit',
            borderTop: activeTab === t ? '2px solid #600812' : '2px solid transparent',
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
              {[
                { key: 'ok', label: 'OK', color: '#16a34a', count: stats.ok },
                { key: 'warning', label: 'Bald', color: '#d97706', count: stats.warning },
                { key: 'overdue', label: 'Fällig', color: '#dc2626', count: stats.overdue },
                { key: 'defect', label: 'Defekt', color: '#7f1d1d', count: stats.defect },
              ].map(s => (
                <button key={s.key} onClick={() => setStatusFilter(statusFilter === s.key as DeviceStatus ? 'all' : s.key as DeviceStatus)}
                  style={{ background: 'var(--lbf-card)', borderRadius: 12, padding: '12px 8px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: statusFilter === s.key ? `1.5px solid ${s.color}` : '1.5px solid transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: s.color, textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.count}</div>
                </button>
              ))}
            </div>

            {/* Search + filter */}
            <div style={{ marginBottom: 10 }}>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Geräte durchsuchen…"
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid rgba(96,8,18,0.15)', borderRadius: 10, background: 'var(--lbf-card)', fontSize: 14, fontFamily: 'inherit', color: 'var(--lbf-text)', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>

            {/* Device cards */}
            {loading ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Lade Geräte…</div>
            ) : filteredDevices.length === 0 ? (
              <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--warm-gray)' }}>
                <div style={{ fontStyle: 'italic', marginBottom: 8 }}>Keine Geräte gefunden</div>
                {devices.length === 0 && (
                  <button onClick={() => setDeviceSheet({ name: '', type: 'AED', serial_number: '', location: '', interval: 'monthly', operational: true, has_stk: false, last_stk: '', stk_interval_months: 24, has_mtk: false, last_mtk: '', mtk_interval_months: 24 })}
                    style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#600812', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Erstes Gerät anlegen
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredDevices.map(device => {
                  const status = getDeviceStatus(device)
                  const due = calcNextDue(device)
                  const openDef = defects.filter(d => d.device_id === device.id && d.status !== 'resolved')
                  const lastInsp = inspections.find(i => i.device_id === device.id)
                  return (
                    <div key={device.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${STATUS_BORDER[status]}`, overflow: 'hidden', position: 'relative' }}>
                      {/* Card body */}
                      <div style={{ padding: '14px 46px 14px 16px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 6 }}>{device.type}</div>
                        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 16, color: 'var(--lbf-text)', marginBottom: 4 }}>{device.name}</div>
                        {(device.location || device.serial_number) && (
                          <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', marginBottom: 8 }}>
                            {[device.location, device.serial_number ? `S/N: ${device.serial_number}` : ''].filter(Boolean).join(' · ')}
                          </div>
                        )}

                        {/* Status badges */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 10 }}>
                          {device.operational === false
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: 'rgba(220,38,38,0.1)', borderRadius: 99, padding: '3px 10px' }}>Nicht einsatzbereit</span>
                            : <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.1)', borderRadius: 99, padding: '3px 10px' }}>Einsatzbereit</span>
                          }
                          {status === 'warning' && <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', background: 'rgba(217,119,6,0.1)', borderRadius: 99, padding: '3px 10px' }}>Prüfung bald fällig</span>}
                          {status === 'overdue' && device.operational !== false && <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: 'rgba(220,38,38,0.1)', borderRadius: 99, padding: '3px 10px' }}>Prüfung überfällig</span>}
                          {openDef.length > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#7f1d1d', background: 'rgba(127,29,29,0.1)', borderRadius: 99, padding: '3px 10px' }}>
                              {openDef.length} Defekt{openDef.length > 1 ? 'e' : ''} offen
                            </span>
                          )}
                          {device.has_stk && (() => {
                            const s = calcPeriodicStatus(device.last_stk, device.stk_interval_months || 24)
                            return s !== 'ok' ? <span style={{ fontSize: 11, fontWeight: 700, color: s === 'overdue' ? '#dc2626' : '#d97706', background: s === 'overdue' ? 'rgba(220,38,38,0.1)' : 'rgba(217,119,6,0.1)', borderRadius: 99, padding: '3px 10px' }}>STK {s === 'overdue' ? 'überfällig' : 'bald fällig'}</span> : <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.1)', borderRadius: 99, padding: '3px 10px' }}>STK OK</span>
                          })()}
                          {device.has_mtk && (() => {
                            const s = calcPeriodicStatus(device.last_mtk, device.mtk_interval_months || 24)
                            return s !== 'ok' ? <span style={{ fontSize: 11, fontWeight: 700, color: s === 'overdue' ? '#dc2626' : '#d97706', background: s === 'overdue' ? 'rgba(220,38,38,0.1)' : 'rgba(217,119,6,0.1)', borderRadius: 99, padding: '3px 10px' }}>MTK {s === 'overdue' ? 'überfällig' : 'bald fällig'}</span> : <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.1)', borderRadius: 99, padding: '3px 10px' }}>MTK OK</span>
                          })()}
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
                          {due ? `Nächste Prüfung: ${due.toLocaleDateString('de-DE')}` : ''}
                          {lastInsp ? ` · Zuletzt: ${relativeDate(lastInsp.inspection_date)}` : ''}
                        </div>
                        {(device.has_stk || device.has_mtk) && (
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 3 }}>
                            {device.has_stk && `STK: ${device.last_stk ? fmtDate(device.last_stk) : 'ausstehend'}`}
                            {device.has_stk && device.has_mtk && ' · '}
                            {device.has_mtk && `MTK: ${device.last_mtk ? fmtDate(device.last_mtk) : 'ausstehend'}`}
                          </div>
                        )}
                      </div>

                      {/* Action strip */}
                      <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'rgba(250,249,247,0.8)', padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={() => startInspection(device)}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', background: '#600812', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Prüfung starten
                        </button>
                        <button onClick={() => { setDefectDevice(device); setDefectForm({ description: '', severity: 'medium' }) }}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '0.5px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.04)', color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Defekt melden
                        </button>
                        <button onClick={() => { setHistoryDevice(device); setHistoryTab('pruefungen') }}
                          style={{ padding: '8px 10px', borderRadius: 8, border: '0.5px solid rgba(96,8,18,0.15)', background: 'none', color: 'var(--warm-gray)', cursor: 'pointer', display: 'flex' }}>
                          {pik(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></>, 14)}
                        </button>
                      </div>

                      {/* ··· menu */}
                      <div style={{ position: 'absolute', top: 12, right: 12 }}>
                        <button onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === device.id ? null : device.id) }}
                          style={{ background: 'var(--lbf-card)', border: '0.5px solid rgba(96,8,18,0.12)', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--warm-gray)' }}>
                          {pik(<><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></>, 14)}
                        </button>
                        {openMenu === device.id && (
                          <div style={{ position: 'absolute', top: 30, right: 0, background: 'var(--lbf-card)', border: '0.5px solid rgba(96,8,18,0.12)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 160, zIndex: 200 }}>
                            {[
                              { label: 'Bearbeiten', action: () => { setDeviceSheet({ id: device.id, name: device.name, type: device.type, serial_number: device.serial_number, location: device.location, interval: device.interval, operational: device.operational !== false, has_stk: !!device.has_stk, last_stk: device.last_stk || '', stk_interval_months: device.stk_interval_months || 24, has_mtk: !!device.has_mtk, last_mtk: device.last_mtk || '', mtk_interval_months: device.mtk_interval_months || 24 }); setOpenMenu(null) } },
                              { label: device.operational === false ? 'Als einsatzbereit markieren' : 'Als nicht einsatzbereit markieren', action: () => { toggleOperational(device); setOpenMenu(null) }, danger: device.operational !== false },
                              { label: 'Löschen', action: () => { deleteDevice(device.id, device.name); setOpenMenu(null) }, danger: true },
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
                      </div>
                      <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'rgba(250,249,247,0.8)', padding: '8px 14px', display: 'flex', gap: 8 }}>
                        <button onClick={() => { setConfirmTarget(r); setConfirmNotes('') }}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', background: '#600812', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Bestätigen
                        </button>
                        <button onClick={() => { setRejectTarget(r); setRejectReason('') }}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '0.5px solid rgba(96,8,18,0.2)', background: 'none', color: 'var(--warm-gray)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
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
                          <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'rgba(250,249,247,0.8)', padding: '8px 14px', display: 'flex', gap: 8 }}>
                            <button onClick={() => { setResolveTarget(def); setResolveNotes('') }}
                              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Als behoben markieren
                            </button>
                            <button onClick={() => deleteDefect(def.id)}
                              style={{ padding: '8px 10px', borderRadius: 8, border: '0.5px solid rgba(220,38,38,0.2)', background: 'none', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                              {pik(<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></>, 14)}
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
                        <div key={def.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', borderLeft: '3px solid rgba(139,113,90,0.35)', padding: '12px 16px', opacity: 0.75 }}>
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
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 12 }}>
              Prüfungsprotokoll ({inspections.length})
            </div>
            {inspections.length === 0 ? (
              <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch keine Prüfungen durchgeführt</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {inspections.map(insp => (
                  <details key={insp.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${insp.passed ? '#16a34a' : '#dc2626'}`, overflow: 'hidden' }}>
                    <summary style={{ padding: '14px 16px', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)', marginBottom: 3 }}>{insp.device_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
                          {fmtDateTime(insp.inspection_date)} · {insp.user_name}
                        </div>
                        {insp.notes && <div style={{ fontSize: 12, color: 'var(--lbf-text)', marginTop: 4, fontStyle: 'italic' }}>{insp.notes}</div>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: insp.passed ? '#16a34a' : '#dc2626', background: insp.passed ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', borderRadius: 99, padding: '4px 10px', flexShrink: 0 }}>
                        {insp.passed ? 'Bestanden' : 'Nicht bestanden'}
                      </span>
                    </summary>
                    {insp.checklist_results?.length > 0 && (
                      <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', padding: '12px 16px' }}>
                        {insp.checklist_results.map((r, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', borderBottom: i < insp.checklist_results.length - 1 ? '0.5px solid rgba(96,8,18,0.05)' : 'none' }}>
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
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══ VORLAGEN TAB ═══ */}
        {activeTab === 'vorlagen' && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 12 }}>Prüfvorlagen pro Gerätetyp</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DEVICE_TYPES.map(type => {
                const t = checklists.find(c => c.device_type === type)
                const count = t?.items.length || (DEFAULT_CHECKLISTS[type] || DEFAULT_CHECKLISTS['Sonstiges']).length
                return (
                  <button key={type} onClick={() => openVorlagen(type)}
                    style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid #600812', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', fontFamily: 'inherit', border: 'none', textAlign: 'left' as const }}>
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

      {/* ── Toast ── */}
      {msg && (
        <div style={{ position: 'fixed', bottom: 'calc(24px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, padding: '10px 20px', borderRadius: 20, fontWeight: 600, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', whiteSpace: 'nowrap' as const, background: msg.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: msg.type === 'success' ? '#166534' : '#dc2626' }}>
          {msg.text}
        </div>
      )}

      {/* ── Add/Edit Device Sheet ── */}
      {deviceSheet !== null && (
        <>
          <div onClick={() => setDeviceSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(96,8,18,0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: 'var(--lbf-text)', marginBottom: 20 }}>
              {deviceSheet.id ? 'Gerät bearbeiten' : 'Neues Gerät'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Gerätetyp *', el: (
                  <select value={deviceSheet.type} onChange={e => setDeviceSheet({ ...deviceSheet, type: e.target.value })}
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }}>
                    {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )},
                { label: 'Bezeichnung *', el: (
                  <input autoFocus type="text" value={deviceSheet.name} onChange={e => setDeviceSheet({ ...deviceSheet, name: e.target.value })} placeholder="z.B. AED Eingangsbereich"
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }} />
                )},
                { label: 'Seriennummer', el: (
                  <input type="text" value={deviceSheet.serial_number} onChange={e => setDeviceSheet({ ...deviceSheet, serial_number: e.target.value })} placeholder="Optional"
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }} />
                )},
                { label: 'Standort', el: (
                  <input type="text" value={deviceSheet.location} onChange={e => setDeviceSheet({ ...deviceSheet, location: e.target.value })} placeholder="z.B. Fahrzeug 1, Büro, Eingang"
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }} />
                )},
                { label: 'Prüfintervall *', el: (
                  <select value={deviceSheet.interval} onChange={e => setDeviceSheet({ ...deviceSheet, interval: e.target.value as DeviceInterval })}
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }}>
                    {Object.entries(INTERVAL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                )},
              ].map(({ label, el }) => (
                <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>{label}</span>
                  {el}
                </label>
              ))}

              {/* Einsatzbereit */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={deviceSheet.operational} onChange={e => setDeviceSheet({ ...deviceSheet, operational: e.target.checked })}
                  style={{ width: 20, height: 20, accentColor: '#600812', cursor: 'pointer', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lbf-text)' }}>Einsatzbereit</div>
                  <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Deaktivieren = Gerät vorübergehend außer Betrieb</div>
                </div>
              </label>

              {/* STK */}
              <div style={{ background: 'var(--warm-bg)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={deviceSheet.has_stk} onChange={e => setDeviceSheet({ ...deviceSheet, has_stk: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: '#600812', cursor: 'pointer', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lbf-text)' }}>STK (Sicherheitstechn. Kontrolle) erforderlich</span>
                </label>
                {deviceSheet.has_stk && (
                  <div style={{ display: 'flex', gap: 10, paddingLeft: 28 }}>
                    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Letzte STK</span>
                      <input type="date" value={deviceSheet.last_stk} onChange={e => setDeviceSheet({ ...deviceSheet, last_stk: e.target.value })}
                        style={{ padding: '9px 10px', borderRadius: 8, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
                    </label>
                    <label style={{ width: 80, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Intervall (Mon.)</span>
                      <input type="number" min="1" max="120" value={deviceSheet.stk_interval_months} onChange={e => setDeviceSheet({ ...deviceSheet, stk_interval_months: Number(e.target.value) })}
                        style={{ padding: '9px 10px', borderRadius: 8, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
                    </label>
                  </div>
                )}
              </div>

              {/* MTK */}
              <div style={{ background: 'var(--warm-bg)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={deviceSheet.has_mtk} onChange={e => setDeviceSheet({ ...deviceSheet, has_mtk: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: '#600812', cursor: 'pointer', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lbf-text)' }}>MTK (Messtechn. Kontrolle) erforderlich</span>
                </label>
                {deviceSheet.has_mtk && (
                  <div style={{ display: 'flex', gap: 10, paddingLeft: 28 }}>
                    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Letzte MTK</span>
                      <input type="date" value={deviceSheet.last_mtk} onChange={e => setDeviceSheet({ ...deviceSheet, last_mtk: e.target.value })}
                        style={{ padding: '9px 10px', borderRadius: 8, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
                    </label>
                    <label style={{ width: 80, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Intervall (Mon.)</span>
                      <input type="number" min="1" max="120" value={deviceSheet.mtk_interval_months} onChange={e => setDeviceSheet({ ...deviceSheet, mtk_interval_months: Number(e.target.value) })}
                        style={{ padding: '9px 10px', borderRadius: 8, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
                    </label>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setDeviceSheet(null)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
                <button onClick={saveDevice} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: '#600812', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
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
              <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(96,8,18,0.2)', margin: '0 auto 16px' }} />
              <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)' }}>{historyDevice.name}</div>
              <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 2 }}>{historyDevice.type} · {historyDevice.location}</div>
            </div>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(96,8,18,0.08)', margin: '12px 0 0' }}>
              {([['pruefungen', 'Prüfungen'], ['defekte', 'Defekte']] as ['pruefungen'|'defekte', string][]).map(([t, l]) => (
                <button key={t} onClick={() => setHistoryTab(t)} style={{ flex: 1, padding: '10px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: historyTab === t ? '#600812' : 'var(--warm-gray)', fontFamily: 'inherit', borderTop: historyTab === t ? '2px solid #600812' : '2px solid transparent' }}>{l}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {historyTab === 'pruefungen' && (() => {
                const di = inspections.filter(i => i.device_id === historyDevice.id)
                return di.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic', padding: '24px 0' }}>Noch keine Prüfungen</div>
                ) : di.map(insp => (
                  <div key={insp.id} style={{ background: 'var(--warm-bg)', borderRadius: 10, padding: '12px', marginBottom: 10, borderLeft: `3px solid ${insp.passed ? '#16a34a' : '#dc2626'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)' }}>{fmtDateTime(insp.inspection_date)} · {insp.user_name}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: insp.passed ? '#16a34a' : '#dc2626' }}>{insp.passed ? 'Bestanden' : 'Nicht bestanden'}</span>
                    </div>
                    {insp.notes && <div style={{ fontSize: 13, color: 'var(--lbf-text)', fontStyle: 'italic' }}>{insp.notes}</div>}
                  </div>
                ))
              })()}
              {historyTab === 'defekte' && (() => {
                const dd = defects.filter(d => d.device_id === historyDevice.id)
                return (
                  <>
                    <button onClick={() => { setDefectDevice(historyDevice); setDefectForm({ description: '', severity: 'medium' }); setHistoryDevice(null) }}
                      style={{ width: '100%', marginBottom: 16, padding: '11px', borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Defekt melden
                    </button>
                    {dd.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic', padding: '24px 0' }}>Keine Defekte für dieses Gerät</div>
                    ) : dd.map(def => (
                      <div key={def.id} style={{ background: 'var(--warm-bg)', borderRadius: 10, padding: '12px', marginBottom: 10, borderLeft: `3px solid ${def.status === 'resolved' ? 'rgba(139,113,90,0.35)' : SEVERITY_CFG[def.severity].color}` }}>
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
          <div onClick={() => setDefectDevice(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '80vh', overflowY: 'auto', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(96,8,18,0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>{defectDevice.type}</div>
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 20 }}>Defekt melden</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#dc2626' }}>Beschreibung *</span>
                <textarea autoFocus value={defectForm.description} onChange={e => setDefectForm({ ...defectForm, description: e.target.value })} placeholder="Was genau ist defekt? Wie macht sich der Defekt bemerkbar?" rows={4}
                  style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(220,38,38,0.2)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#dc2626' }}>Schweregrad</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(Object.entries(SEVERITY_CFG) as [Severity, typeof SEVERITY_CFG[Severity]][]).map(([key, cfg]) => (
                    <button key={key} onClick={() => setDefectForm({ ...defectForm, severity: key })} type="button"
                      style={{ padding: '10px', borderRadius: 10, border: `1.5px solid ${defectForm.severity === key ? cfg.color : 'rgba(96,8,18,0.1)'}`, background: defectForm.severity === key ? cfg.bg : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: cfg.color }}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </label>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setDefectDevice(null)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
                <button onClick={reportDefect} disabled={!defectForm.description.trim()}
                  style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: !defectForm.description.trim() ? 'rgba(220,38,38,0.3)' : '#dc2626', fontSize: 15, fontWeight: 700, color: '#fff', cursor: !defectForm.description.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  Defekt melden
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Resolve Defect Sheet ── */}
      {resolveTarget && (
        <>
          <div onClick={() => setResolveTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '70vh', overflowY: 'auto', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(96,8,18,0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 6 }}>Defekt beheben</div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic', marginBottom: 20 }}>{resolveTarget.device_name} · {resolveTarget.description}</div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Lösungshinweis (optional)</span>
              <textarea value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="Was wurde gemacht? Ersatzteil, Reparatur, ..." rows={3}
                style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setResolveTarget(null)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={resolveDefect} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: '#16a34a', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Als behoben markieren</button>
            </div>
          </div>
        </>
      )}

      {/* ── Confirm External Report Sheet ── */}
      {confirmTarget && (
        <>
          <div onClick={() => setConfirmTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '75vh', overflowY: 'auto', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(96,8,18,0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Meldung bestätigen</div>
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 8 }}>{confirmTarget.device_name}</div>
            <div style={{ fontSize: 14, color: 'var(--lbf-text)', marginBottom: 4, lineHeight: 1.5 }}>{confirmTarget.description}</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', marginBottom: 16 }}>
              Gemeldet von {confirmTarget.reporter_name || 'Anonym'} · {relativeDate(confirmTarget.created)}
            </div>
            <div style={{ background: 'rgba(127,29,29,0.06)', border: '0.5px solid rgba(127,29,29,0.15)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#7f1d1d', fontStyle: 'italic' }}>
              Gerät wird als <strong style={{ fontStyle: 'normal' }}>nicht einsatzbereit</strong> markiert und ein Defekt-Eintrag angelegt.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmTarget(null)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={confirmExternalReport} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: '#600812', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Bestätigen & Defekt anlegen</button>
            </div>
          </div>
        </>
      )}

      {/* ── Reject External Report Sheet ── */}
      {rejectTarget && (
        <>
          <div onClick={() => setRejectTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '70vh', overflowY: 'auto', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(96,8,18,0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 6 }}>Meldung ablehnen</div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic', marginBottom: 20 }}>{rejectTarget.device_name} · {rejectTarget.description}</div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Ablehnungsgrund (optional)</span>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="z.B. Falsches Gerät angegeben, kein tatsächlicher Defekt, …" rows={3}
                style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setRejectTarget(null)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={rejectExternalReport} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: '#dc2626', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Ablehnen</button>
            </div>
          </div>
        </>
      )}

      {/* ── Vorlagen Editor Sheet ── */}
      {showVorlagen && (
        <>
          <div onClick={() => setShowVorlagen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(96,8,18,0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 16 }}>Prüfvorlage bearbeiten</div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Gerätetyp</span>
              <select value={vtType} onChange={e => vtSwitchType(e.target.value)}
                style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }}>
                {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={() => { if (!vtNewItem.trim()) return; setVtItems([...vtItems, vtNewItem.trim()]); setVtNewItem('') }}
                style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#600812', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {pik(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>, 16)}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowVorlagen(false)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={saveVorlage} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: '#600812', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Speichern</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
