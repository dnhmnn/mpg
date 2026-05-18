import { useState, useEffect, useMemo } from 'react'
import { pb } from '../../lib/pocketbase'
import { useAuth } from '../../hooks/useAuth'
import StatusBar from '../../components/StatusBar'
import PatientEditModal from './PatientEditModal'
import PatientQRManager from './PatientQRManager'
import SignModal from './SignModal'
import NachModal from './NachModal'
import DetailsModal from './DetailsModal'
import ProtokollView from '../../components/ProtokollView'
import type { Patient, Nacherfassung, PatientPayload, NachForm } from './types'
import { EMPTY_PAYLOAD, EMPTY_NACH, parsePayload, fmtDate } from './types'

function fmtReopenRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'abgelaufen'
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const min = totalMin % 60
  return h > 0 ? `noch ${h}h ${min}min` : `noch ${min}min`
}

type Tab = 'patienten' | 'nach' | 'archiv' | 'audit' | 'qrcodes'

interface AuditEntry {
  id: string
  action: string
  record_type: string
  record_title: string
  user_name: string
  created: string
}

interface AccessLogEntry {
  id: string
  access_code: string
  patient_name: string
  event: string
  user_agent: string
  created: string
}

const TEN_YEARS_MS = 10 * 365.25 * 24 * 60 * 60 * 1000

export default function Patienten() {
  const { user, loading, logout } = useAuth()

  const [patients, setPatients] = useState<Patient[]>([])
  const [freigegebenPatients, setFreigegebenPatients] = useState<Patient[]>([])
  const [nacherfassungen, setNacherfassungen] = useState<Nacherfassung[]>([])
  const [archivedPatients, setArchivedPatients] = useState<Patient[]>([])
  const [archivedNach, setArchivedNach] = useState<Nacherfassung[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  const [accessLogs, setAccessLogs] = useState<AccessLogEntry[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('patienten')

  const [reopenModal, setReopenModal] = useState<Patient | null>(null)
  const [reopenHours, setReopenHours] = useState(24)

  const [protokollSheet, setProtokollSheet] = useState<Patient | null>(null)
  const [mannschaftModal, setMannschaftModal] = useState<Patient | null>(null)
  const [mannSearch, setMannSearch] = useState<Record<string, string>>({})
  const [mannResults, setMannResults] = useState<Record<string, any[]>>({})
  const [mannPicked, setMannPicked] = useState<Record<string, any>>({})
  const [savingMannschaft, setSavingMannschaft] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null)
  const [payload, setPayload] = useState<PatientPayload>({ ...EMPTY_PAYLOAD })
  const [originalPayload, setOriginalPayload] = useState<PatientPayload>({ ...EMPTY_PAYLOAD })

  const [showSign, setShowSign] = useState(false)
  const [adminName, setAdminName] = useState('')

  const [showNach, setShowNach] = useState(false)
  const [nachForm, setNachForm] = useState<NachForm>({ ...EMPTY_NACH })

  const [showDetails, setShowDetails] = useState(false)
  const [detailsDoc, setDetailsDoc] = useState<Patient | Nacherfassung | null>(null)
  const [detailsType, setDetailsType] = useState<'patient' | 'nach'>('patient')

  const [showStellungnahme, setShowStellungnahme] = useState(false)
  const [stellungnahmePat, setStellungnahmePat] = useState<Patient | null>(null)

  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [archivLoaded, setArchivLoaded] = useState(false)
  const [auditLoaded, setAuditLoaded] = useState(false)

  useEffect(() => { if (user) loadOpenData() }, [user])

  useEffect(() => {
    if (!user) return
    if (activeTab === 'archiv' && !archivLoaded) loadArchivData()
    if (activeTab === 'audit' && !auditLoaded) loadAuditData()
  }, [activeTab, user])

  useEffect(() => {
    if (!user?.organization_id) return
    pb.collection('patients').subscribe('*', () => { loadOpenData() }, { requestKey: null } as any)
    return () => { pb.collection('patients').unsubscribe('*') }
  }, [user])

  async function loadOpenData() {
    if (!user?.organization_id) return
    const org = user.organization_id
    setDataLoading(true)
    try {
      const [openList, freiList, nachs] = await Promise.all([
        pb.collection('patients').getFullList({ filter: `status="offen"&&organization_id="${org}"`, sort: '-created' }),
        pb.collection('patients').getFullList({ filter: `status="freigegeben"&&organization_id="${org}"`, sort: '-created' }),
        pb.collection('patient_docs_nacherfassung').getFullList({ filter: `status="offen"&&organization_id="${org}"`, sort: '-created' }),
      ])
      // Auto-freigabe: offen records older than 24h
      const now = Date.now()
      const stillOpen: Patient[] = []
      for (const p of openList as unknown as Patient[]) {
        if (now - new Date(p.created).getTime() > 24 * 3600 * 1000) {
          try {
            await pb.collection('patients').update(p.id, { status: 'freigegeben' })
            freiList.push({ ...p, status: 'freigegeben' } as any)
          } catch {}
        } else {
          stillOpen.push(p)
        }
      }
      setPatients(stillOpen)
      setFreigegebenPatients(freiList as unknown as Patient[])
      setNacherfassungen(nachs as unknown as Nacherfassung[])
    } catch (e: any) {
      flash('Fehler beim Laden: ' + e.message, 'error')
    } finally {
      setDataLoading(false)
    }
  }

  async function loadArchivData() {
    if (!user?.organization_id) return
    const org = user.organization_id
    try {
      const [aPats, aNachs] = await Promise.all([
        pb.collection('patients').getFullList({ filter: `status="archiviert"&&organization_id="${org}"`, sort: '-updated' }),
        pb.collection('patient_docs_nacherfassung').getFullList({ filter: `status="archiviert"&&organization_id="${org}"`, sort: '-created' }),
      ])
      setArchivedPatients(aPats as unknown as Patient[])
      setArchivedNach(aNachs as unknown as Nacherfassung[])
      setArchivLoaded(true)
    } catch (e: any) {
      flash('Fehler beim Laden: ' + e.message, 'error')
    }
  }

  async function loadAuditData() {
    if (!user?.organization_id) return
    const org = user.organization_id
    try {
      const [logs, accLogs] = await Promise.all([
        pb.collection('audit_logs').getFullList({
          filter: `organization_id="${org}"`, sort: '-created',
          fields: 'id,action,record_type,record_title,user_name,created'
        }).catch(() => []),
        pb.collection('access_logs').getFullList({
          filter: `organization_id="${org}"`, sort: '-created',
          fields: 'id,access_code,patient_name,event,user_agent,created'
        }).catch(() => []),
      ])
      setAuditLogs(logs as unknown as AuditEntry[])
      setAccessLogs(accLogs as unknown as AccessLogEntry[])
      setAuditLoaded(true)
    } catch (e: any) {
      flash('Fehler beim Laden: ' + e.message, 'error')
    }
  }

  async function loadData() {
    setArchivLoaded(false)
    setAuditLoaded(false)
    await loadOpenData()
    if (activeTab === 'archiv') await loadArchivData()
    if (activeTab === 'audit') await loadAuditData()
  }

  async function auditLog(action: string, recordId: string, recordType: string, title: string) {
    if (!user) return
    try {
      await pb.collection('audit_logs').create({
        action, record_id: recordId, record_type: recordType, record_title: title,
        user_id: user.id, user_name: (user as any).name || user.email,
        organization_id: user.organization_id,
      })
    } catch {}
  }

  function flash(text: string, type: 'success' | 'error') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  function setP<K extends keyof PatientPayload>(key: K, value: PatientPayload[K]) {
    setPayload(p => ({ ...p, [key]: value }))
  }

  function setN(key: keyof NachForm, value: string) {
    setNachForm(f => ({ ...f, [key]: value }))
  }

  async function openEdit(pat: Patient) {
    const doc = await pb.collection('patients').getOne(pat.id)
    setCurrentPatient(doc as unknown as Patient)
    const parsed = parsePayload((doc as any).payload)
    setPayload(parsed)
    setOriginalPayload(parsed)
    setShowEdit(true)
    auditLog('bearbeitet', pat.id, 'patient', [parsed.name, parsed.vorname].filter(Boolean).join(' ') || pat.title || 'Unbekannt')
  }

  async function saveOnly(localPayload: PatientPayload) {
    if (!currentPatient) return
    try {
      await pb.collection('patients').update(currentPatient.id, { payload: localPayload })
      setPayload(localPayload)
      flash('Gespeichert', 'success')
      setShowEdit(false)
      await loadData()
    } catch (e: any) {
      flash('Fehler: ' + e.message, 'error')
    }
  }

  async function saveAndSign(localPayload: PatientPayload) {
    if (!currentPatient) return
    try {
      await pb.collection('patients').update(currentPatient.id, { payload: localPayload })
      setPayload(localPayload)
      setShowEdit(false)
      setShowSign(true)
    } catch (e: any) {
      flash('Fehler: ' + e.message, 'error')
    }
  }

  async function archiveWithSig(sig: string) {
    if (!currentPatient) return
    try {
      await pb.collection('patients').update(currentPatient.id, {
        status: 'archiviert',
        admin_name: adminName,
        admin_datum: new Date().toISOString(),
        admin_unterschrift: sig,
      })
      const p = parsePayload((currentPatient as any).payload)
      await auditLog('archiviert', currentPatient.id, 'patient', [p.name, p.vorname].filter(Boolean).join(' ') || currentPatient.title || 'Unbekannt')
      flash('Archiviert', 'success')
      setShowSign(false)
      setAdminName('')
      await loadData()
    } catch (e: any) {
      flash('Fehler: ' + e.message, 'error')
    }
  }

  async function saveNach(sig: string) {
    try {
      await pb.collection('patient_docs_nacherfassung').create({
        ...nachForm,
        patienten_daten_erhoben: nachForm.patienten_daten_erhoben === 'ja',
        protokollpflichtig: nachForm.protokollpflichtig === 'ja',
        verantwortlicher_unterwiesen: nachForm.verantwortlicher_unterwiesen === 'ja',
        nacherfasst_datum: new Date().toISOString(),
        nacherfasst_unterschrift: sig,
        organization_id: user?.organization_id,
        status: 'offen',
      })
      flash('Nacherfassung gespeichert', 'success')
      setShowNach(false)
      setNachForm({ ...EMPTY_NACH })
      await loadData()
    } catch (e: any) {
      flash('Fehler: ' + e.message, 'error')
    }
  }

  async function reopenForTF(patient: Patient, hours: number) {
    const now = new Date()
    const expires = new Date(now.getTime() + hours * 3600 * 1000)
    const adminName = (user as any)?.name || user?.email || 'Admin'
    const sysRQ = {
      id: Date.now().toString(),
      frage: `Protokoll wurde am ${now.toLocaleString('de-DE')} für ${hours} Stunden zur Weiterbearbeitung an den Teamleiter gesendet (durch ${adminName}).`,
      created_by: 'System',
      status: 'beantwortet' as const,
      created: now.toISOString(),
    }
    const pl = parsePayload((patient as any).payload)
    const existingRQs = pl.rueckfragen || []
    try {
      await pb.collection('patients').update(patient.id, {
        payload: {
          ...pl,
          tf_reopen: { opened_at: now.toISOString(), expires_at: expires.toISOString(), opened_by: adminName },
          rueckfragen: [...existingRQs, sysRQ],
        }
      })
      flash(`Protokoll für ${hours}h zur Nachbearbeitung geöffnet`, 'success')
      setReopenModal(null)
      await loadOpenData()
    } catch (e: any) {
      flash('Fehler: ' + e.message, 'error')
    }
  }

  async function searchMannschaft(role: string, text: string) {
    setMannSearch(prev => ({ ...prev, [role]: text }))
    if (!mannschaftModal || text.length < 2) { setMannResults(prev => ({ ...prev, [role]: [] })); return }
    try {
      const results = await pb.collection('users').getFullList({
        filter: `organization_id="${(mannschaftModal as any).organization_id}"&&(name~"${text}"||email~"${text}")`,
        fields: 'id,name,email',
        sort: 'name',
      })
      setMannResults(prev => ({ ...prev, [role]: results }))
    } catch { setMannResults(prev => ({ ...prev, [role]: [] })) }
  }

  async function saveMannschaftNachtraeglich() {
    if (!mannschaftModal) return
    setSavingMannschaft(true)
    try {
      const pl = parsePayload((mannschaftModal as any).payload)
      const existingMann = (pl as any).mannschaft || {}
      const newMann = { ...existingMann }
      for (const role of ['tf','m1','m2','m3']) {
        if (mannPicked[role]) newMann[role] = { id: mannPicked[role].id, name: mannPicked[role].name }
      }
      const adminName = (user as any)?.name || user?.email || 'Admin'
      const rq = {
        id: Date.now().toString(),
        frage: `Mannschaft wurde am ${new Date().toLocaleString('de-DE')} durch ${adminName} nachgetragen. Bitte prüfen und bestätigen.`,
        created_by: 'System',
        status: 'offen' as const,
        created: new Date().toISOString(),
      }
      const existingRQs = pl.rueckfragen || []
      await pb.collection('patients').update(mannschaftModal.id, {
        payload: { ...pl, mannschaft: newMann, rueckfragen: [...existingRQs, rq] }
      })
      flash('Mannschaft gespeichert', 'success')
      setMannschaftModal(null)
      setMannPicked({})
      setMannSearch({})
      setMannResults({})
      await loadOpenData()
    } catch (e: any) {
      flash('Fehler: ' + e.message, 'error')
    } finally {
      setSavingMannschaft(false)
    }
  }

  async function archiveNach(id: string) {
    if (!confirm('Nacherfassung archivieren?')) return
    try {
      const rec = nacherfassungen.find(n => n.id === id)
      await pb.collection('patient_docs_nacherfassung').update(id, { status: 'archiviert' })
      await auditLog('archiviert', id, 'nach', rec?.stichwort || id)
      flash('Archiviert', 'success')
      await loadData()
    } catch (e: any) {
      flash('Fehler: ' + e.message, 'error')
    }
  }

  async function openDetails(id: string, type: 'patient' | 'nach') {
    const col = type === 'patient' ? 'patients' : 'patient_docs_nacherfassung'
    const doc = await pb.collection(col).getOne(id)
    setDetailsDoc(doc as unknown as Patient | Nacherfassung)
    setDetailsType(type)
    if (type === 'patient') {
      setCurrentPatient(doc as unknown as Patient)
      const parsed = parsePayload((doc as any).payload)
      setPayload(parsed)
      setOriginalPayload(parsed)
    }
    setShowDetails(true)
    const title = type === 'patient'
      ? (() => { const p = parsePayload((doc as any).payload); return [p.name, p.vorname].filter(Boolean).join(' ') || (doc as any).title || 'Unbekannt' })()
      : ((doc as any).stichwort || id)
    auditLog('eingesehen', id, type, title)
  }

  async function deleteRecord(id: string, type: 'patient' | 'nach', title: string) {
    if (!confirm(`"${title}" unwiderruflich löschen?\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`)) return
    try {
      await auditLog('gelöscht', id, type, title)
      await pb.collection(type === 'patient' ? 'patients' : 'patient_docs_nacherfassung').delete(id)
      flash('Datensatz gelöscht', 'success')
      await loadData()
    } catch (e: any) {
      flash('Fehler: ' + e.message, 'error')
    }
  }

  async function deleteOldRecords() {
    if (!confirm(`${oldCount} Datensätze älter als 10 Jahre unwiderruflich löschen?`)) return
    const cutoff = Date.now() - TEN_YEARS_MS
    const items = [
      ...archivedPatients.filter(p => new Date(p.updated).getTime() < cutoff).map(p => {
        const pp = parsePayload(p.payload)
        return { id: p.id, type: 'patient' as const, title: [pp.name, pp.vorname].filter(Boolean).join(' ') || p.title || 'Unbekannt' }
      }),
      ...archivedNach.filter(n => new Date(n.created).getTime() < cutoff).map(n => ({
        id: n.id, type: 'nach' as const, title: n.stichwort || n.id,
      })),
    ]
    for (const r of items) {
      await auditLog('gelöscht (Aufbewahrungsfrist)', r.id, r.type, r.title)
      await pb.collection(r.type === 'patient' ? 'patients' : 'patient_docs_nacherfassung').delete(r.id).catch(() => {})
    }
    flash(`${items.length} Datensätze gelöscht`, 'success')
    await loadData()
  }

  const archiveByYear = useMemo(() => {
    type Item = { id: string; type: 'patient' | 'nach'; year: number; date: Date; title: string; isOld: boolean; orig: Patient | Nacherfassung }
    const cutoff = Date.now() - TEN_YEARS_MS
    const items: Item[] = [
      ...archivedPatients.map(p => {
        const pp = parsePayload(p.payload)
        const date = new Date(p.updated)
        return { id: p.id, type: 'patient' as const, year: date.getFullYear(), date, title: [pp.name, pp.vorname].filter(Boolean).join(' ') || p.title || 'Unbekannt', isOld: date.getTime() < cutoff, orig: p }
      }),
      ...archivedNach.map(n => {
        const date = new Date(n.created)
        return { id: n.id, type: 'nach' as const, year: date.getFullYear(), date, title: n.stichwort || '—', isOld: date.getTime() < cutoff, orig: n }
      }),
    ].sort((a, b) => b.date.getTime() - a.date.getTime())
    const byYear: Record<number, Item[]> = {}
    items.forEach(i => { if (!byYear[i.year]) byYear[i.year] = []; byYear[i.year].push(i) })
    return byYear
  }, [archivedPatients, archivedNach])

  const oldCount = useMemo(() => {
    const cutoff = Date.now() - TEN_YEARS_MS
    return archivedPatients.filter(p => new Date(p.updated).getTime() < cutoff).length
         + archivedNach.filter(n => new Date(n.created).getTime() < cutoff).length
  }, [archivedPatients, archivedNach])

  const auditColor: Record<string, string> = {
    'eingesehen': '#059669',
    'bearbeitet': '#2563eb',
    'archiviert': '#6b7280',
    'gelöscht': '#c0392b',
    'gelöscht (Aufbewahrungsfrist)': '#c0392b',
  }

  if (loading) return null

  const totalArchiv = archivedPatients.length + archivedNach.length

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }

        .pat-toast {
          position: fixed;
          bottom: 32px;
          right: 24px;
          z-index: 9999;
          padding: 14px 20px;
          border-radius: 14px;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.14);
          animation: slideInRight 0.25s cubic-bezier(0.34,1.56,0.64,1) both;
          max-width: 320px;
        }
        .pat-toast.success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
        .pat-toast.error   { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }

        .pat-toolbar {
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 0.5px solid var(--border);
          padding: 0.5rem 1rem;
          display: flex;
          gap: 0.3rem;
          align-items: center;
          position: sticky;
          top: 60px;
          z-index: 99;
        }

        .pat-tab-btn {
          border: none;
          background: transparent;
          color: var(--text-secondary);
          padding: 0.45rem 0.75rem;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
        }
        .pat-tab-btn:hover { background: var(--bg-hover); color: var(--text); }
        .pat-tab-btn.active { background: var(--accent); color: #fff; }
        .pat-tab-btn.primary { background: var(--accent); color: #fff; margin-left: auto; }
        .pat-tab-btn.primary:hover { opacity: 0.85; }

        @media (max-width: 560px) {
          .pat-toolbar { overflow-x: auto; -webkit-overflow-scrolling: touch; gap: 0.2rem; padding: 0.35rem 0.75rem; }
          .pat-toolbar::-webkit-scrollbar { display: none; }
          .pat-tab-btn { padding: 0.4rem 0.6rem; flex-shrink: 0; }
          .pat-tab-label { display: none; }
        }

        .pat-content {
          max-width: 1100px;
          margin: 0 auto;
          padding: 1.25rem 1.25rem;
          padding-top: 130px;
          padding-bottom: 100px;
        }

        .pat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 14px;
        }

        .pat-card {
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 16px;
          padding: 18px 18px 14px 18px;
          border: 0.5px solid var(--border);
          border-left: 4px solid transparent;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          position: relative;
          transition: all 0.2s;
          cursor: default;
        }
        .pat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          border-color: var(--border-medium);
        }
        .pat-card.offen         { border-left-color: #3b82f6; }
        .pat-card.abgeschlossen { border-left-color: #f97316; }
        .pat-card.entwurf       { border-left-color: #f59e0b; }
        .pat-card.nach          { border-left-color: #8b5cf6; }
        .pat-card.archiviert    { border-left-color: #6b7280; }
        .pat-card.old           { border-left-color: #f59e0b; outline: 1px solid #fcd34d; }

        .pat-card-type {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-bottom: 5px;
        }
        .pat-card-name {
          font-weight: 700;
          font-size: 17px;
          margin-bottom: 6px;
          color: var(--text);
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pat-card-meta {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 12px;
          line-height: 1.5;
        }
        .pat-card-footer {
          display: flex;
          gap: 8px;
          align-items: center;
          border-top: 0.5px solid var(--border);
          padding-top: 10px;
          margin-top: 4px;
          flex-wrap: wrap;
        }

        .pat-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 9px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
          flex-shrink: 0;
        }
        .pat-badge.offen         { background: #eff6ff; color: #1d4ed8; }
        .pat-badge.abgeschlossen { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
        .pat-badge.entwurf       { background: #fffbeb; color: #b45309; }
        .pat-badge.nach          { background: #f5f3ff; color: #6d28d9; }
        .pat-badge.archiviert    { background: #f3f4f6; color: #374151; }
        .pat-badge.editing       { background: #fef9c3; color: #92400e; border: 1px solid #fcd34d; }
        .pat-badge.old-warn      { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }

        .pat-btn {
          font-size: 13px;
          font-weight: 600;
          padding: 6px 12px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          background: var(--bg-secondary);
          color: var(--text);
          transition: background 0.15s;
          flex-shrink: 0;
          font-family: inherit;
        }
        .pat-btn:hover { background: var(--bg-hover); }
        .pat-btn.danger { background: #c0392b; color: #fff; }
        .pat-btn.danger:hover { background: #a93226; }

        .pat-empty {
          text-align: center;
          padding: 64px 20px;
          color: var(--text-secondary);
          font-size: 15px;
        }

        .pat-year-header {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 12px 4px 6px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 10px;
        }

        .pat-warn-banner {
          background: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 14px;
          padding: 14px 18px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .pat-warn-text { flex: 1; }
        .pat-warn-title { font-weight: 700; font-size: 14px; color: #92400e; }
        .pat-warn-sub { font-size: 12px; color: #b45309; margin-top: 2px; }

        .pat-audit-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: var(--bg-card);
          border-radius: 12px;
          margin-bottom: 6px;
          border: 0.5px solid var(--border);
        }
        .pat-audit-action {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
          color: #fff;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .pat-audit-title {
          font-weight: 600;
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          min-width: 0;
        }
        .pat-audit-sub { font-size: 12px; color: var(--text-secondary); }
        .pat-audit-type { font-size: 11px; color: var(--text-secondary); flex-shrink: 0; }

        .fab {
          position: fixed;
          bottom: calc(24px + env(safe-area-inset-bottom));
          right: 20px;
          width: 56px;
          height: 56px;
          border-radius: 28px;
          background: var(--accent);
          color: #fff;
          border: none;
          font-size: 28px;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(0,0,0,0.22);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 500;
          transition: transform 0.15s, opacity 0.15s;
        }
        .fab:hover { opacity: 0.85; }
        .fab:active { transform: scale(0.94); }
      `}</style>

      <StatusBar user={user} onLogout={logout} pageName="Patienten" showHubLink />

      {msg && (
        <div className={`pat-toast ${msg.type}`}>{msg.text}</div>
      )}

      {/* TOOLBAR */}
      <div className="pat-toolbar">
        <button
          className={`pat-tab-btn${activeTab === 'patienten' ? ' active' : ''}`}
          onClick={() => setActiveTab('patienten')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className="pat-tab-label">Dokus{(patients.length + freigegebenPatients.length) > 0 ? ` (${patients.length + freigegebenPatients.length})` : ''}</span>
        </button>
        <button
          className={`pat-tab-btn${activeTab === 'nach' ? ' active' : ''}`}
          onClick={() => setActiveTab('nach')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span className="pat-tab-label">Nacherfassungen{nacherfassungen.length > 0 ? ` (${nacherfassungen.length})` : ''}</span>
        </button>
        <button
          className={`pat-tab-btn${activeTab === 'archiv' ? ' active' : ''}`}
          onClick={() => setActiveTab('archiv')}
          style={{ position: 'relative' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/>
            <line x1="10" y1="12" x2="14" y2="12"/>
          </svg>
          <span className="pat-tab-label">Archiv{totalArchiv > 0 ? ` (${totalArchiv})` : ''}</span>
          {oldCount > 0 && (
            <span style={{ position: 'absolute', top: '4px', right: '4px', background: '#f59e0b', color: '#fff', borderRadius: '50%', width: '14px', height: '14px', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              {oldCount > 9 ? '9+' : oldCount}
            </span>
          )}
        </button>
        <button
          className={`pat-tab-btn${activeTab === 'audit' ? ' active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span className="pat-tab-label">Audit-Log</span>
        </button>
        {user?.supervisor && (
          <button
            className={`pat-tab-btn${activeTab === 'qrcodes' ? ' active' : ''}`}
            onClick={() => setActiveTab('qrcodes')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              <path d="M14 14h3v3h-3zM17 17h3M17 20h3M20 17v3"/>
            </svg>
            <span className="pat-tab-label">QR-Codes</span>
          </button>
        )}
        <button
          className="pat-tab-btn primary"
          onClick={() => { setNachForm({ ...EMPTY_NACH }); setShowNach(true) }}
          title="Neue Nacherfassung"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      <div className="pat-content">

        {/* PATIENTENDOKUS */}
        {activeTab === 'patienten' && (
          dataLoading ? (
            <div className="pat-empty">
              <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
              <div style={{ fontSize: '14px' }}>Lade Dokus...</div>
            </div>
          ) : patients.length === 0 && freigegebenPatients.length === 0 ? (
            <div className="pat-empty">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: '14px' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>Keine offenen Protokolle</div>
              <div style={{ fontSize: '13px' }}>Neue Protokolle werden hier angezeigt, sobald sie eingereicht werden.</div>
            </div>
          ) : (
            <>
              {/* Freigegeben — ready for admin action */}
              {freigegebenPatients.length > 0 && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Freigegeben – Gegenzeichnung möglich ({freigegebenPatients.length})
                  </div>
                  <div className="pat-grid" style={{ marginBottom: 24 }}>
                    {freigegebenPatients.map(pat => {
                      const p = parsePayload(pat.payload)
                      const patName = [p.name, p.vorname].filter(Boolean).join(' ')
                      const m = (pat as any).payload?.mannschaft || {}
                      const crew = ['tf','m1','m2','m3'].map((k: string) => m[k]?.name).filter(Boolean).join(', ')
                      const displayName = patName || crew || pat.title || 'Unbekannt'
                      const rqs: any[] = Array.isArray((pat as any).payload?.rueckfragen) ? (pat as any).payload.rueckfragen : []
                      const sns: any[] = Array.isArray((pat as any).payload?.stellungnahmen) ? (pat as any).payload.stellungnahmen : []
                      const openRQ = rqs.filter((r: any) => r.status === 'offen').length
                      const canSign = openRQ === 0
                      const changedCount = ((pat as any).payload?._changed_fields || []).length
                      const hasTFReopen = !!(pat as any).payload?.tf_reopen
                      const reopenActive = hasTFReopen && new Date((pat as any).payload.tf_reopen.expires_at) > new Date()
                      const tfChangedCount = ((pat as any).payload?._tf_changed_fields || []).length
                      const accentColor = openRQ > 0 ? '#f59e0b' : '#16a34a'
                      const accentDark = openRQ > 0 ? '#92400e' : '#166534'
                      return (
                        <div key={pat.id} style={{ background: 'var(--bg-card)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: '1px solid var(--border)' }}>
                          {/* Header band */}
                          <div style={{ background: accentColor, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              <span style={{ color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: '0.1em' }}>PROTOKOLL</span>
                              {openRQ > 0 && <span style={{ background: 'rgba(0,0,0,0.18)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 7px', letterSpacing: '0.03em' }}>⚠ {openRQ} Rückfrage{openRQ !== 1 ? 'n' : ''}</span>}
                            </div>
                            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500 }}>{fmtDate(pat.created)}</span>
                          </div>

                          {/* Body */}
                          <div style={{ padding: '14px 16px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', lineHeight: 1.2, marginBottom: 4 }}>{displayName}</div>
                                {crew && <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{crew}</div>}
                              </div>
                              <button
                                style={{ flexShrink: 0, background: canSign ? accentColor : 'var(--border)', color: canSign ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: 12, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: canSign ? 'pointer' : 'not-allowed', fontFamily: 'inherit', lineHeight: 1 }}
                                onClick={() => canSign && openEdit(pat)}
                                title={!canSign ? `Erst alle ${openRQ} offenen Rückfragen beantworten` : ''}
                              >
                                {canSign ? '✓ Gegenzeichnen' : 'Gegenzeichnen'}
                              </button>
                            </div>

                            {/* Nachbearbeitung status */}
                            {reopenActive && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 10px' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>TF Nachbearbeitung läuft</span>
                                <span style={{ fontSize: 12, color: '#3b82f6', marginLeft: 2 }}>· {fmtReopenRemaining((pat as any).payload.tf_reopen.expires_at)}</span>
                              </div>
                            )}
                            {hasTFReopen && !reopenActive && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Nachbearbeitung abgelaufen</span>
                              </div>
                            )}

                            {/* Change indicators */}
                            {(changedCount > 0 || tfChangedCount > 0 || sns.length > 0) && (
                              <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                                {changedCount > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />{changedCount} Admin-Änd.</span>}
                                {tfChangedCount > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />{tfChangedCount} TF-Nachbearb.</span>}
                                {sns.length > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />{sns.length} Stellungnahme{sns.length !== 1 ? 'n' : ''}</span>}
                              </div>
                            )}
                          </div>

                          {/* Action footer */}
                          <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px', display: 'flex', gap: 6, background: 'var(--bg)', flexWrap: 'wrap' }}>
                            <button className="pat-btn" onClick={() => setProtokollSheet(pat)}>Ansehen</button>
                            <button className="pat-btn" onClick={() => openEdit(pat)}>Bearbeiten</button>
                            {openRQ > 0 && <button className="pat-btn" style={{ color: accentDark, borderColor: accentColor }} onClick={() => { setStellungnahmePat(pat); setShowStellungnahme(true) }}>Anfragen ({openRQ})</button>}
                            <button className="pat-btn" onClick={() => setReopenModal(pat)}>Nachbearbeit.</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
              {/* Offen — not yet released by TF */}
              {patients.length > 0 && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Noch nicht freigegeben ({patients.length})
                  </div>
                  <div className="pat-grid">
                    {patients.map(pat => {
                      const p = parsePayload(pat.payload)
                      const patName = [p.name, p.vorname].filter(Boolean).join(' ')
                      const m = (pat as any).payload?.mannschaft || {}
                      const crew = ['tf','m1','m2','m3'].map((k: string) => m[k]?.name).filter(Boolean).join(', ')
                      const displayName = patName || crew || pat.title || 'Unbekannt'
                      const ageMs = Date.now() - new Date(pat.created).getTime()
                      const hoursLeft = Math.max(0, Math.ceil(24 - ageMs / 3600000))
                      return (
                        <div key={pat.id} className="pat-card offen" style={{ opacity: 0.8 }}>
                          <div className="pat-card-type">Protokoll</div>
                          <div className="pat-card-name">{displayName}</div>
                          <div className="pat-card-meta">
                            {crew ? `Mannschaft: ${crew}` : null}
                            {crew ? <br /> : null}
                            {fmtDate(pat.created)}
                          </div>
                          <div className="pat-card-footer">
                            <span style={{ fontSize: 11, fontWeight: 700, background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 999, padding: '2px 8px' }}>
                              Noch nicht freigegeben
                            </span>
                            <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>
                              {hoursLeft > 0 ? `noch ${hoursLeft}h` : 'Freigabe ausstehend'}
                            </span>
                            <div style={{ flex: 1 }} />
                            {!m.tf?.id && (
                              <button className="pat-btn" onClick={() => { setMannschaftModal(pat); setMannPicked((pat as any).payload?.mannschaft || {}) }}>Mannschaft nachtragen</button>
                            )}
                            <button className="pat-btn" onClick={() => setProtokollSheet(pat)}>Ansehen</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )
        )}

        {/* NACHERFASSUNGEN */}
        {activeTab === 'nach' && (
          dataLoading ? (
            <div className="pat-empty">
              <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
              <div style={{ fontSize: '14px' }}>Lade Nacherfassungen...</div>
            </div>
          ) : nacherfassungen.length === 0 ? (
            <div className="pat-empty">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: '14px' }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>Keine offenen Nacherfassungen</div>
              <div style={{ fontSize: '13px' }}>Über den + Button oben rechts eine neue anlegen.</div>
            </div>
          ) : (
            <div className="pat-grid">
              {nacherfassungen.map(n => (
                <div key={n.id} className="pat-card nach">
                  <div className="pat-card-type">Nacherfassung</div>
                  <div className="pat-card-name">{n.stichwort || '—'}</div>
                  <div className="pat-card-meta">{n.nacherfasst_von_name} · {fmtDate(n.created)}</div>
                  <div className="pat-card-footer">
                    <span className="pat-badge nach">offen</span>
                    <div style={{ flex: 1 }} />
                    <button className="pat-btn" onClick={() => openDetails(n.id, 'nach')}>Details</button>
                    <button className="pat-btn danger" onClick={() => archiveNach(n.id)}>Archivieren</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ARCHIV */}

        {activeTab === 'archiv' && (
          !archivLoaded ? (
            <div className="pat-empty">
              <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
              <div style={{ fontSize: '14px' }}>Lade Archiv...</div>
            </div>
          ) : (
          <>
            {oldCount > 0 && (
              <div className="pat-warn-banner">
                <div className="pat-warn-text">
                  <div className="pat-warn-title">{oldCount} Datensätze älter als 10 Jahre</div>
                  <div className="pat-warn-sub">DSGVO-Aufbewahrungsfrist überschritten – zur Löschung empfohlen.</div>
                </div>
                <button className="pat-btn danger" onClick={deleteOldRecords}>Jetzt löschen</button>
              </div>
            )}

            {Object.keys(archiveByYear).length === 0 ? (
              <div className="pat-empty">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: '14px' }}>
                  <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/>
                  <line x1="10" y1="12" x2="14" y2="12"/>
                </svg>
                <div style={{ fontWeight: 700 }}>Archiv leer</div>
              </div>
            ) : (
              Object.entries(archiveByYear)
                .sort(([a], [b]) => Number(b) - Number(a))
                .map(([year, items]) => (
                  <div key={year} style={{ marginBottom: '24px' }}>
                    <div className="pat-year-header">{year} · {items.length} Einträge</div>
                    <div className="pat-grid">
                      {items.map(item => {
                        const archSns: any[] = item.type === 'patient' ? (Array.isArray((item.orig as any).payload?.stellungnahmen) ? (item.orig as any).payload.stellungnahmen : []) : []
                        return (
                          <div key={item.id} className={`pat-card ${item.isOld ? 'old' : 'archiviert'}`}>
                            <div className="pat-card-type">
                              {item.type === 'patient' ? 'Protokoll' : 'Nacherfassung'}
                            </div>
                            <div className="pat-card-name">{item.title}</div>
                            <div className="pat-card-meta">
                              {item.type === 'patient' && (item.orig as Patient).admin_name
                                ? `${(item.orig as Patient).admin_name} · ` : ''}
                              {fmtDate(item.type === 'patient' ? (item.orig as Patient).updated : (item.orig as Nacherfassung).created)}
                            </div>
                            {archSns.length > 0 && (
                              <div style={{ padding: '4px 0 2px' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 999, padding: '2px 8px' }}>
                                  {archSns.length} Stellungnahme{archSns.length !== 1 ? 'n' : ''}
                                </span>
                              </div>
                            )}
                            <div className="pat-card-footer">
                              <span className="pat-badge archiviert">archiviert</span>
                              {item.isOld && <span className="pat-badge old-warn">Frist überschritten</span>}
                              <div style={{ flex: 1 }} />
                              {archSns.length > 0 && (
                                <button className="pat-btn" onClick={() => { setStellungnahmePat(item.orig as Patient); setShowStellungnahme(true) }}>
                                  Stellungnahmen
                                </button>
                              )}
                              <button className="pat-btn" onClick={() => openDetails(item.id, item.type)}>Ansehen</button>
                              <button className="pat-btn danger" onClick={() => deleteRecord(item.id, item.type, item.title)}>Löschen</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
            )}
          </>
          )
        )}

        {/* AUDIT LOG */}
        {activeTab === 'audit' && (
          !auditLoaded ? (
            <div className="pat-empty">
              <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
              <div style={{ fontSize: '14px' }}>Lade Audit-Log...</div>
            </div>
          ) : (
          <>
            {auditLogs.length === 0 && (
              <div className="pat-empty">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: '14px' }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>Keine Einträge</div>
                <div style={{ fontSize: '13px' }}>Collection <code>audit_logs</code> muss in PocketBase angelegt sein.</div>
              </div>
            )}
            {auditLogs.map(entry => (
              <div key={entry.id} className="pat-audit-row">
                <span className="pat-audit-action" style={{ background: auditColor[entry.action] || '#6b7280' }}>
                  {entry.action}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pat-audit-title">{entry.record_title}</div>
                  <div className="pat-audit-sub">{entry.user_name} · {fmtDate(entry.created)}</div>
                </div>
                <span className="pat-audit-type">{entry.record_type}</span>
              </div>
            ))}

            {/* QR Zugriffslog */}
            {accessLogs.length > 0 && (
              <>
                <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '1.25rem 0 .5rem', paddingTop: '1rem', borderTop: '0.5px solid var(--border)' }}>
                  QR-Code Zugriffe
                </div>
                {accessLogs.map(entry => {
                  const eventColor: Record<string, string> = {
                    granted: '#16a34a',
                    dob_failed: '#d97706',
                    locked: '#c0392b',
                    expired: '#6b7280',
                  }
                  const eventLabel: Record<string, string> = {
                    granted: 'Zugriff gewährt',
                    dob_failed: 'Falsches Geburtsdatum',
                    locked: 'Gesperrt',
                    expired: 'Abgelaufen',
                  }
                  return (
                    <div key={entry.id} className="pat-audit-row">
                      <span className="pat-audit-action" style={{ background: eventColor[entry.event] || '#6b7280' }}>
                        {eventLabel[entry.event] || entry.event}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pat-audit-title">
                          {entry.patient_name || '–'} · Code {entry.access_code}
                        </div>
                        <div className="pat-audit-sub" title={entry.user_agent}>
                          {fmtDate(entry.created)} · {entry.user_agent?.split(' ').slice(-1)[0] || 'Unbekanntes Gerät'}
                        </div>
                      </div>
                      <span className="pat-audit-type">QR-Zugriff</span>
                    </div>
                  )
                })}
              </>
            )}
          </>
          )
        )}

        {/* QR-CODES */}
        {activeTab === 'qrcodes' && (
          <PatientQRManager />
        )}

      </div>

      {showEdit && currentPatient && (
        <PatientEditModal
          patient={currentPatient}
          payload={payload}
          original={originalPayload}
          onClose={() => setShowEdit(false)}
          onSave={saveOnly}
          onSaveAndSign={saveAndSign}
          onRefresh={loadData}
        />
      )}
      {showSign && (
        <SignModal adminName={adminName} setAdminName={setAdminName} onClose={() => setShowSign(false)} onArchive={archiveWithSig} />
      )}
      {showNach && (
        <NachModal form={nachForm} setN={setN} onClose={() => setShowNach(false)} onSave={saveNach} />
      )}
      {showDetails && detailsDoc && (
        <DetailsModal
          doc={detailsDoc}
          type={detailsType}
          onClose={() => setShowDetails(false)}
          onEdit={detailsType === 'patient' && currentPatient && (currentPatient as any).status !== 'archiviert'
            ? () => { setShowDetails(false); setShowEdit(true) }
            : undefined}
        />
      )}

      {/* Protokoll Bottom Sheet */}
      {protokollSheet && (() => {
        const pl = parsePayload((protokollSheet as any).payload)
        const cf = new Set<string>((protokollSheet as any).payload?._changed_fields || [])
        const tf = new Set<string>((protokollSheet as any).payload?._tf_changed_fields || [])
        const sheetName = [pl.name, pl.vorname].filter(Boolean).join(' ') || protokollSheet.title || 'Protokoll'
        return (
          <>
            <div onClick={() => setProtokollSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000 }} />
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 3001, background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', maxHeight: '92dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{sheetName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Protokoll ansehen · {(protokollSheet as any).status === 'offen' ? 'In Bearbeitung durch Teamleiter' : 'Freigegeben'}</div>
                </div>
                <button onClick={() => setProtokollSheet(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1, padding: '4px 8px' }}>×</button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <ProtokollView payload={pl} changedFields={cf} tfChangedFields={tf} />
              </div>
            </div>
          </>
        )
      })()}

      {/* Mannschaft nachtragen Modal */}
      {mannschaftModal && (() => {
        const pl = parsePayload((mannschaftModal as any).payload)
        const patName = [pl.name, pl.vorname].filter(Boolean).join(' ') || mannschaftModal.title || 'Unbekannt'
        const roles: { key: string; label: string }[] = [
          { key: 'tf', label: 'Teamführer (TF)' },
          { key: 'm1', label: 'Ersthelfer 1 (M1)' },
          { key: 'm2', label: 'Ersthelfer 2 (M2)' },
          { key: 'm3', label: 'Fahrer (M3)' },
        ]
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 460, padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90dvh', overflowY: 'auto' }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginBottom: 4 }}>Mannschaft nachtragen</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{patName}</div>
              {roles.map(({ key, label }) => {
                const existing = (mannschaftModal as any).payload?.mannschaft?.[key]
                const picked = mannPicked[key]
                return (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{label}</label>
                    {picked ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10 }}>
                        <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{picked.name}</span>
                        <button onClick={() => setMannPicked(prev => { const n = { ...prev }; delete n[key]; return n })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1 }}>×</button>
                      </div>
                    ) : existing?.id ? (
                      <div style={{ padding: '8px 12px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, color: 'var(--text-secondary)' }}>
                        {existing.name} <span style={{ fontSize: 11, opacity: 0.7 }}>(bereits eingetragen)</span>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="Name suchen…"
                          value={mannSearch[key] || ''}
                          onChange={e => searchMannschaft(key, e.target.value)}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: 'var(--bg)', color: 'var(--text)' }}
                        />
                        {(mannResults[key] || []).length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 10, overflow: 'hidden', marginTop: 4 }}>
                            {mannResults[key].map((u: any) => (
                              <div key={u.id} onClick={() => { setMannPicked(prev => ({ ...prev, [key]: u })); setMannSearch(prev => ({ ...prev, [key]: '' })); setMannResults(prev => ({ ...prev, [key]: [] })) }} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14, color: 'var(--text)', borderBottom: '0.5px solid var(--border)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                {u.name} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.email}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              <div style={{ fontSize: 12, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 20 }}>
                Der Teamleiter erhält eine offene Rückfrage zur Bestätigung der Mannschaft.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setMannschaftModal(null); setMannPicked({}); setMannSearch({}); setMannResults({}) }} style={{ padding: '10px 18px', background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Abbrechen
                </button>
                <button onClick={saveMannschaftNachtraeglich} disabled={savingMannschaft || Object.keys(mannPicked).length === 0} style={{ padding: '10px 18px', background: Object.keys(mannPicked).length > 0 ? 'var(--accent)' : '#e5e7eb', color: Object.keys(mannPicked).length > 0 ? '#fff' : '#9ca3af', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: Object.keys(mannPicked).length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                  {savingMannschaft ? 'Speichern…' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Wiedereröffnen Modal */}
      {reopenModal && (() => {
        const pl = parsePayload((reopenModal as any).payload)
        const patName = [pl.name, pl.vorname].filter(Boolean).join(' ') || reopenModal.title || 'Unbekannt'
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 420, padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginBottom: 6 }}>Zur Nachbearbeitung öffnen</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{patName}</div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Dauer (Stunden)</label>
                <input
                  type="number"
                  min={1}
                  max={72}
                  value={reopenHours}
                  onChange={e => setReopenHours(Math.max(1, Math.min(72, Number(e.target.value))))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 16, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: 'var(--bg)', color: 'var(--text)' }}
                />
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Der Teamleiter hat {reopenHours} Stunden Zeit zur Nachbearbeitung. Ein System-Eintrag wird automatisch erstellt.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setReopenModal(null)} style={{ padding: '10px 18px', background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Abbrechen
                </button>
                <button onClick={() => reopenForTF(reopenModal, reopenHours)} style={{ padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Öffnen
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Stellungnahmen-Modal */}
      {showStellungnahme && stellungnahmePat && (() => {
        // Use fresh data from subscribed state so Unitas answers appear immediately
        const freshPat = freigegebenPatients.find(p => p.id === stellungnahmePat.id)
          || archivedPatients.find(p => p.id === stellungnahmePat.id)
          || stellungnahmePat
        const pl = (freshPat as any).payload || {}
        const rqs: any[] = Array.isArray(pl.rueckfragen) ? pl.rueckfragen : []
        const sns: any[] = Array.isArray(pl.stellungnahmen) ? pl.stellungnahmen : []
        const patName = [pl.vorname, pl.name].filter(Boolean).join(' ') || freshPat.title || 'Unbekannt'
        const einsatzInfo = [pl.einsatz_nr && `Einsatz-Nr. ${pl.einsatz_nr}`, pl.einsatz_art, pl.einsatz_adresse].filter(Boolean).join(' · ')
        const m = (pl.mannschaft || {}) as Record<string, { name?: string } | null>
        const crew = ['tf','m1','m2','m3'].map(k => m[k]?.name).filter(Boolean).join(', ')
        const isArchived = (freshPat as any).status === 'archiviert'
        return (
          <>
            {/* Print-only area */}
            <style>{`@media print { body * { visibility: hidden !important; } #sn-print-area, #sn-print-area * { visibility: visible !important; } #sn-print-area { position: fixed; top: 0; left: 0; width: 100vw; background: white; padding: 32px; z-index: 99999; } }`}</style>
            <div id="sn-print-area" style={{ visibility: 'hidden', position: 'fixed', top: 0, left: '-200vw', width: '700px', padding: 32, fontFamily: 'serif', background: 'white' }}>
              <h2 style={{ fontSize: 18, marginBottom: 4 }}>Stellungnahmen zum Einsatz</h2>
              <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Patient:</strong> {patName}</div>
              {einsatzInfo && <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Einsatz:</strong> {einsatzInfo}</div>}
              {pl.zeit_einsatz && <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Alarmzeit:</strong> {pl.zeit_einsatz}</div>}
              {crew && <div style={{ fontSize: 13, marginBottom: 16 }}><strong>Mannschaft:</strong> {crew}</div>}
              <hr style={{ margin: '12px 0' }} />
              {rqs.map((rq: any, i: number) => {
                const sn = sns.find((s: any) => s.rueckfrage_id === rq.id)
                return (
                  <div key={rq.id} style={{ marginBottom: 20, breakInside: 'avoid' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Rückfrage #{i + 1} {rq.created_by ? `(${rq.created_by})` : ''}</div>
                    <div style={{ fontSize: 13, marginBottom: 8, paddingLeft: 12 }}>{rq.frage}</div>
                    {sn ? (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>Stellungnahme ({new Date(sn.created).toLocaleString('de-DE')}):</div>
                        <div style={{ fontSize: 13, paddingLeft: 12 }}>{sn.text}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 13, fontStyle: 'italic' }}>Keine Stellungnahme eingegangen.</div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px 20px' }}>
              <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Rückfragen &amp; Stellungnahmen</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{patName}</div>
                    {einsatzInfo && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{einsatzInfo}</div>}
                    {crew && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Mannschaft: {crew}</div>}
                  </div>
                  <button onClick={() => setShowStellungnahme(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-secondary)', padding: '0 4px', lineHeight: 1 }}>×</button>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {rqs.length === 0 && (
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>Keine Rückfragen vorhanden.</div>
                  )}
                  {rqs.map((rq: any, i: number) => {
                    const sn = sns.find((s: any) => s.rueckfrage_id === rq.id)
                    return (
                      <div key={rq.id} style={{ border: `1px solid ${sn ? '#bbf7d0' : '#fcd34d'}`, borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ background: sn ? '#f0fdf4' : '#fffbeb', padding: '10px 14px', borderBottom: `1px solid ${sn ? '#bbf7d0' : '#fcd34d'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Rückfrage #{i + 1}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: sn ? '#dcfce7' : '#fef9c3', color: sn ? '#166534' : '#92400e', marginLeft: 'auto' }}>
                            {sn ? 'Beantwortet' : 'Offen'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{new Date(rq.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ fontSize: 14, background: 'var(--bg-subtle)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 3 }}>{rq.created_by ? `${rq.created_by} fragt:` : 'Frage:'}</div>
                            {rq.frage}
                          </div>
                          {sn ? (
                            <div style={{ fontSize: 14, background: '#dcfce7', borderRadius: 8, padding: '8px 10px', border: '1px solid #bbf7d0', lineHeight: 1.5 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>Stellungnahme des Teamleiters:</span>
                                <span style={{ fontSize: 11, color: '#166534' }}>{new Date(sn.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {sn.text}
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', padding: '4px 0' }}>Noch keine Stellungnahme eingegangen.</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding: '12px 20px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => window.print()}
                    style={{ padding: '9px 18px', background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Drucken / PDF
                  </button>
                  {!isArchived && (
                    <button
                      onClick={() => { setShowStellungnahme(false); openDetails(stellungnahmePat.id, 'patient') }}
                      style={{ padding: '9px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Protokoll bearbeiten
                    </button>
                  )}
                  <button onClick={() => setShowStellungnahme(false)} style={{ padding: '9px 18px', background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          </>
        )
      })()}
    </>
  )
}
