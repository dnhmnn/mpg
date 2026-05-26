import { useState, useEffect, useMemo } from 'react'
import { pb } from '../../lib/pocketbase'
import { useAuth } from '../../hooks/useAuth'
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
    'eingesehen': '#16a34a',
    'bearbeitet': '#600812',
    'archiviert': '#8a7a68',
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
          padding: 12px 18px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 13px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          animation: slideInRight 0.25s cubic-bezier(0.34,1.56,0.64,1) both;
          max-width: 320px;
          font-family: inherit;
          letter-spacing: 0.02em;
        }
        .pat-toast.success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
        .pat-toast.error   { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }

        .pat-toolbar {
          background: #fff;
          border-bottom: 0.5px solid rgba(96,8,18,0.1);
          position: sticky;
          top: calc(env(safe-area-inset-top) + 60px);
          z-index: 99;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .pat-toolbar::-webkit-scrollbar { display: none; }
        .pat-toolbar-inner {
          display: flex;
          min-width: max-content;
          padding-left: max(8px, env(safe-area-inset-left));
          padding-right: max(8px, env(safe-area-inset-right));
        }

        .pat-tab-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          flex-shrink: 0;
          padding: 6px 12px 0;
          height: 50px;
          border: none;
          border-bottom: 2px solid transparent;
          background: none;
          color: var(--warm-gray);
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
          position: relative;
          transition: color 0.15s, border-color 0.15s;
        }
        .pat-tab-btn:hover { color: #1a0e08; }
        .pat-tab-btn.active {
          color: #600812;
          border-bottom-color: #600812;
        }
        .pat-tab-btn .pat-tab-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .pat-tab-btn.primary {
          background: #600812;
          color: #fff;
          border-bottom-color: transparent;
          border-radius: 8px;
          margin: auto 4px auto auto;
          padding: 0 14px;
          height: 32px;
          gap: 0;
          flex-direction: row;
          align-self: center;
        }
        .pat-tab-btn.primary:hover { opacity: 0.88; }

        .pat-content {
          max-width: 1100px;
          margin: 0 auto;
          padding: 1.25rem 1.25rem;
          padding-top: 24px;
          padding-bottom: 100px;
          background: var(--warm-bg);
          min-height: 100vh;
        }

        .pat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 12px;
        }

        .pat-card {
          background: #fff;
          border-radius: 12px;
          border-left: 3px solid transparent;
          box-shadow: 0 1px 4px rgba(0,0,0,0.07);
          position: relative;
          cursor: default;
          overflow: hidden;
        }
        .pat-card-body {
          padding: 14px 16px 12px 14px;
        }
        .pat-card.offen         { border-left-color: #600812; }
        .pat-card.nach          { border-left-color: #600812; }
        .pat-card.archiviert    { border-left-color: rgba(139,113,90,0.4); }
        .pat-card.old           { border-left-color: #d97706; }
        .pat-card.abgeschlossen { border-left-color: #d97706; }

        .pat-card-type {
          font-size: 10px;
          font-weight: 700;
          color: #600812;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          margin-bottom: 5px;
        }
        .pat-card-name {
          font-style: italic;
          font-weight: 700;
          font-size: 17px;
          margin-bottom: 5px;
          color: #1a0e08;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pat-card-meta {
          font-style: italic;
          font-size: 12px;
          color: var(--warm-gray);
          margin-bottom: 10px;
          line-height: 1.5;
        }
        .pat-card-footer {
          display: flex;
          gap: 6px;
          align-items: center;
          border-top: 0.5px solid rgba(96,8,18,0.08);
          background: rgba(250,249,247,0.8);
          padding: 8px 12px;
          flex-wrap: wrap;
        }

        .pat-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          flex-shrink: 0;
          font-style: italic;
        }
        .pat-badge.offen         { background: rgba(96,8,18,0.07); color: #600812; }
        .pat-badge.nach          { background: rgba(96,8,18,0.07); color: #600812; }
        .pat-badge.archiviert    { background: rgba(139,113,90,0.1); color: #8a7a68; }
        .pat-badge.old-warn      { background: rgba(217,119,6,0.1); color: #d97706; }
        .pat-badge.abgeschlossen { background: rgba(217,119,6,0.1); color: #d97706; }

        .pat-btn {
          font-size: 12px;
          font-weight: 700;
          padding: 6px 12px;
          border: 1px solid rgba(96,8,18,0.15);
          border-radius: 8px;
          cursor: pointer;
          background: #faf9f7;
          color: #1a0e08;
          transition: background 0.12s;
          flex-shrink: 0;
          font-family: inherit;
          letter-spacing: 0.02em;
        }
        .pat-btn:hover { background: rgba(96,8,18,0.06); }
        .pat-btn.danger { background: #fff0f0; border-color: rgba(192,57,43,0.3); color: #c0392b; }
        .pat-btn.danger:hover { background: #fde8e8; }

        .pat-empty {
          text-align: center;
          padding: 64px 20px;
          color: var(--warm-gray);
          font-size: 14px;
          font-style: italic;
        }

        .pat-year-header {
          font-size: 10px;
          font-weight: 700;
          color: #600812;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          padding: 10px 0 8px;
          border-bottom: 0.5px solid rgba(96,8,18,0.12);
          margin-bottom: 12px;
        }

        .pat-warn-banner {
          background: #fff8ed;
          border: 0.5px solid rgba(217,119,6,0.3);
          border-left: 3px solid #d97706;
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .pat-warn-text { flex: 1; }
        .pat-warn-title { font-weight: 700; font-size: 13px; color: #92400e; font-style: italic; }
        .pat-warn-sub { font-size: 12px; color: #b45309; margin-top: 2px; font-style: italic; }

        .pat-audit-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: #fff;
          border-radius: 10px;
          margin-bottom: 6px;
          border-left: 3px solid rgba(139,113,90,0.3);
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .pat-audit-action {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
          color: #fff;
          flex-shrink: 0;
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-style: italic;
        }
        .pat-audit-title {
          font-weight: 700;
          font-size: 13px;
          color: #1a0e08;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          min-width: 0;
        }
        .pat-audit-sub {
          font-size: 12px;
          color: var(--warm-gray);
          font-style: italic;
        }
        .pat-audit-type {
          font-size: 10px;
          color: var(--warm-gray);
          flex-shrink: 0;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }

        .fab {
          position: fixed;
          bottom: calc(24px + env(safe-area-inset-bottom));
          right: 20px;
          width: 52px;
          height: 52px;
          border-radius: 26px;
          background: #600812;
          color: #fff;
          border: none;
          font-size: 26px;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(96,8,18,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 500;
          transition: transform 0.15s, opacity 0.15s;
        }
        .fab:hover { opacity: 0.88; }
        .fab:active { transform: scale(0.94); }
      `}</style>

      {/* ── MASTHEAD ── */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', position: 'sticky', top: 0, zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/hub" style={{ display: 'flex', color: '#600812', textDecoration: 'none', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </a>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--lbf-text)' }}>Patienten</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{user?.organization_name || 'Responda'}</div>
          </div>
          {(activeTab === 'patienten' || activeTab === 'nach') && (
            <button
              onClick={() => { setNachForm({ ...EMPTY_NACH }); setShowNach(true) }}
              style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(96,8,18,0.07)', color: '#600812', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              title="Neue Nacherfassung"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`pat-toast ${msg.type}`}>{msg.text}</div>
      )}

      {/* TOOLBAR */}
      <div className="pat-toolbar">
        <div className="pat-toolbar-inner">
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
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/>
            <line x1="10" y1="12" x2="14" y2="12"/>
          </svg>
          <span className="pat-tab-label">Archiv{totalArchiv > 0 ? ` (${totalArchiv})` : ''}</span>
          {oldCount > 0 && (
            <span style={{ position: 'absolute', top: 4, right: 6, background: '#d97706', color: '#fff', borderRadius: 8, padding: '1px 4px', fontSize: 9, fontWeight: 700 }}>
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
          <span className="pat-tab-label">Audit</span>
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
        </div>
      </div>

      <div className="pat-content">

        {/* PATIENTENDOKUS */}
        {activeTab === 'patienten' && (
          dataLoading ? (
            <div className="pat-empty">
              <div style={{ width: '28px', height: '28px', border: '2px solid rgba(96,8,18,0.15)', borderTopColor: '#600812', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
              <div>Lade Dokus...</div>
            </div>
          ) : patients.length === 0 && freigegebenPatients.length === 0 ? (
            <div className="pat-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25, marginBottom: '14px', color: '#600812' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <div style={{ fontStyle: 'italic', fontWeight: 700, color: 'var(--lbf-text)', marginBottom: '6px', fontSize: 15 }}>Keine offenen Protokolle</div>
              <div>Neue Protokolle werden hier angezeigt, sobald sie eingereicht werden.</div>
            </div>
          ) : (
            <>
              {/* Freigegeben — ready for admin action */}
              {freigegebenPatients.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>
                    Freigegeben – Gegenzeichnung möglich ({freigegebenPatients.length})
                  </div>
                  <div className="pat-grid" style={{ marginBottom: 28 }}>
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
                      return (
                        <div key={pat.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ height: 3, background: accentColor, borderRadius: '12px 12px 0 0' }} />
                          <div style={{ padding: '12px 16px 10px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: accentColor, marginBottom: 6 }}>
                              PROTOKOLL FREIGEGEBEN{openRQ > 0 ? ` · ${openRQ} Rückfrage${openRQ !== 1 ? 'n' : ''}` : ''}
                            </div>
                            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)', marginBottom: 4 }}>{displayName}</div>
                            {crew && <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>{crew}</div>}
                            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{fmtDate(pat.created)}</div>

                            {/* change indicators */}
                            {(changedCount > 0 || tfChangedCount > 0 || sns.length > 0) && (
                              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                                {changedCount > 0 && <span style={{ fontStyle: 'italic', fontSize: 11, fontWeight: 700, color: '#d97706' }}>{changedCount} Admin-Änd.</span>}
                                {tfChangedCount > 0 && <span style={{ fontStyle: 'italic', fontSize: 11, fontWeight: 700, color: '#16a34a' }}>{tfChangedCount} TF-Nachbearb.</span>}
                                {sns.length > 0 && <span style={{ fontStyle: 'italic', fontSize: 11, fontWeight: 700, color: '#600812' }}>{sns.length} Stellungnahme{sns.length !== 1 ? 'n' : ''}</span>}
                              </div>
                            )}

                            {/* Nachbearbeitung */}
                            {reopenActive && (
                              <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(96,8,18,0.05)', borderRadius: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ fontStyle: 'italic', fontSize: 12, fontWeight: 700, color: '#600812' }}>TF Nachbearbeitung läuft</span>
                                <span style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>· {fmtReopenRemaining((pat as any).payload.tf_reopen.expires_at)}</span>
                              </div>
                            )}
                            {hasTFReopen && !reopenActive && (
                              <div style={{ marginTop: 8, padding: '5px 10px', background: 'rgba(139,113,90,0.08)', borderRadius: 8 }}>
                                <span style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', fontWeight: 600 }}>Nachbearbeitung abgelaufen</span>
                              </div>
                            )}
                          </div>

                          {/* Action footer */}
                          <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'rgba(250,249,247,0.8)', padding: '8px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button className="pat-btn" onClick={() => setProtokollSheet(pat)}>Ansehen</button>
                            <button className="pat-btn" onClick={() => openEdit(pat)}>Bearbeiten</button>
                            {openRQ > 0 && <button className="pat-btn" onClick={() => { setStellungnahmePat(pat); setShowStellungnahme(true) }}>Anfragen ({openRQ})</button>}
                            <button className="pat-btn" onClick={() => setReopenModal(pat)}>Nachbearbeit.</button>
                            <div style={{ flex: 1 }} />
                            <button
                              style={{ background: canSign ? '#600812' : 'var(--lbf-border-light)', color: canSign ? '#fff' : 'var(--warm-gray)', border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: canSign ? 'pointer' : 'not-allowed', fontFamily: 'inherit', letterSpacing: '0.04em' }}
                              onClick={() => canSign && openEdit(pat)}
                              title={!canSign ? `Erst alle ${openRQ} offenen Rückfragen beantworten` : ''}
                            >
                              Gegenzeichnen
                            </button>
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
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>
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
                        <div key={pat.id} className="pat-card offen" style={{ opacity: 0.85 }}>
                          <div className="pat-card-body">
                            <div className="pat-card-type">Protokoll</div>
                            <div className="pat-card-name">{displayName}</div>
                            <div className="pat-card-meta">
                              {crew ? `Mannschaft: ${crew}` : null}
                              {crew ? <br /> : null}
                              {fmtDate(pat.created)}
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontStyle: 'italic', fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)' }}>
                                Noch nicht freigegeben
                              </span>
                              <span style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>
                                {hoursLeft > 0 ? `· noch ${hoursLeft}h` : '· Freigabe ausstehend'}
                              </span>
                            </div>
                          </div>
                          <div className="pat-card-footer">
                            {!m.tf?.id && (
                              <button className="pat-btn" onClick={() => { setMannschaftModal(pat); setMannPicked((pat as any).payload?.mannschaft || {}) }}>Mannschaft nachtragen</button>
                            )}
                            <div style={{ flex: 1 }} />
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
              <div style={{ width: '28px', height: '28px', border: '2px solid rgba(96,8,18,0.15)', borderTopColor: '#600812', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
              <div>Lade Nacherfassungen...</div>
            </div>
          ) : nacherfassungen.length === 0 ? (
            <div className="pat-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25, marginBottom: '14px', color: '#600812' }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div style={{ fontStyle: 'italic', fontWeight: 700, color: 'var(--lbf-text)', marginBottom: '6px', fontSize: 15 }}>Keine offenen Nacherfassungen</div>
              <div>Über den + Button oben rechts eine neue anlegen.</div>
            </div>
          ) : (
            <div className="pat-grid">
              {nacherfassungen.map(n => (
                <div key={n.id} className="pat-card nach">
                  <div className="pat-card-body">
                    <div className="pat-card-type">Nacherfassung</div>
                    <div className="pat-card-name">{n.stichwort || '—'}</div>
                    <div className="pat-card-meta">{n.nacherfasst_von_name} · {fmtDate(n.created)}</div>
                  </div>
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
              <div style={{ width: '28px', height: '28px', border: '2px solid rgba(96,8,18,0.15)', borderTopColor: '#600812', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
              <div>Lade Archiv...</div>
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
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25, marginBottom: '14px', color: '#600812' }}>
                  <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/>
                  <line x1="10" y1="12" x2="14" y2="12"/>
                </svg>
                <div style={{ fontStyle: 'italic', fontWeight: 700, color: 'var(--lbf-text)', fontSize: 15 }}>Archiv leer</div>
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
                            <div className="pat-card-body">
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
                                <div style={{ marginTop: 4 }}>
                                  <span style={{ fontStyle: 'italic', fontSize: 11, fontWeight: 700, color: '#16a34a' }}>
                                    {archSns.length} Stellungnahme{archSns.length !== 1 ? 'n' : ''}
                                  </span>
                                </div>
                              )}
                            </div>
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
              <div style={{ width: '28px', height: '28px', border: '2px solid rgba(96,8,18,0.15)', borderTopColor: '#600812', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
              <div>Lade Audit-Log...</div>
            </div>
          ) : (
          <>
            {auditLogs.length === 0 && (
              <div className="pat-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25, marginBottom: '14px', color: '#600812' }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <div style={{ fontStyle: 'italic', fontWeight: 700, color: 'var(--lbf-text)', marginBottom: '6px', fontSize: 15 }}>Keine Einträge</div>
                <div>Collection <code>audit_logs</code> muss in PocketBase angelegt sein.</div>
              </div>
            )}
            {auditLogs.map(entry => (
              <div key={entry.id} className="pat-audit-row">
                <span className="pat-audit-action" style={{ background: auditColor[entry.action] || '#8a7a68' }}>
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
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '20px 0 10px', paddingTop: '16px', borderTop: '0.5px solid rgba(96,8,18,0.12)' }}>
                  QR-Code Zugriffe
                </div>
                {accessLogs.map(entry => {
                  const eventColor: Record<string, string> = {
                    granted: '#16a34a',
                    dob_failed: '#d97706',
                    locked: '#c0392b',
                    expired: '#8a7a68',
                  }
                  const eventLabel: Record<string, string> = {
                    granted: 'Zugriff gewährt',
                    dob_failed: 'Falsches Geburtsdatum',
                    locked: 'Gesperrt',
                    expired: 'Abgelaufen',
                  }
                  return (
                    <div key={entry.id} className="pat-audit-row">
                      <span className="pat-audit-action" style={{ background: eventColor[entry.event] || '#8a7a68' }}>
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
            <div onClick={() => setProtokollSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.45)', zIndex: 3000 }} />
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 3001, background: 'var(--warm-bg)', borderRadius: '16px 16px 0 0', maxHeight: '92dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(96,8,18,0.12)', background: 'var(--lbf-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)' }}>{sheetName}</div>
                  <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                    {(protokollSheet as any).status === 'offen' ? 'In Bearbeitung durch Teamleiter' : 'Freigegeben'}
                  </div>
                </div>
                <button
                  onClick={() => setProtokollSheet(null)}
                  style={{ background: 'rgba(96,8,18,0.06)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#600812', flexShrink: 0 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
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
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.45)', zIndex: 3100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: 'var(--lbf-card)', borderRadius: 14, width: '100%', maxWidth: 460, padding: '24px', boxShadow: '0 16px 48px rgba(0,0,0,0.2)', border: '0.5px solid rgba(96,8,18,0.1)', maxHeight: '90dvh', overflowY: 'auto' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Mannschaft nachtragen</div>
              <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)', marginBottom: 20 }}>{patName}</div>
              {roles.map(({ key, label }) => {
                const existing = (mannschaftModal as any).payload?.mannschaft?.[key]
                const picked = mannPicked[key]
                return (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</label>
                    {picked ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(96,8,18,0.04)', border: '0.5px solid rgba(96,8,18,0.15)', borderRadius: 8 }}>
                        <span style={{ flex: 1, fontStyle: 'italic', fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)' }}>{picked.name}</span>
                        <button onClick={() => setMannPicked(prev => { const n = { ...prev }; delete n[key]; return n })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
                      </div>
                    ) : existing?.id ? (
                      <div style={{ padding: '8px 12px', background: 'rgba(139,113,90,0.06)', border: '0.5px solid rgba(139,113,90,0.2)', borderRadius: 8, fontStyle: 'italic', fontSize: 14, color: 'var(--warm-gray)' }}>
                        {existing.name} <span style={{ fontSize: 11, opacity: 0.7 }}>(bereits eingetragen)</span>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="Name suchen…"
                          value={mannSearch[key] || ''}
                          onChange={e => searchMannschaft(key, e.target.value)}
                          style={{ width: '100%', padding: '9px 12px', border: '0.5px solid rgba(96,8,18,0.2)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: 'var(--warm-bg)', color: 'var(--lbf-text)', outline: 'none' }}
                        />
                        {(mannResults[key] || []).length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--lbf-card)', border: '0.5px solid rgba(96,8,18,0.15)', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.12)', zIndex: 10, overflow: 'hidden', marginTop: 4 }}>
                            {mannResults[key].map((u: any) => (
                              <div key={u.id} onClick={() => { setMannPicked(prev => ({ ...prev, [key]: u })); setMannSearch(prev => ({ ...prev, [key]: '' })); setMannResults(prev => ({ ...prev, [key]: [] })) }} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14, color: 'var(--lbf-text)', borderBottom: '0.5px solid rgba(96,8,18,0.06)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,8,18,0.04)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <span style={{ fontStyle: 'italic', fontWeight: 700 }}>{u.name}</span> <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>{u.email}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              <div style={{ fontStyle: 'italic', fontSize: 12, color: '#d97706', background: 'rgba(217,119,6,0.07)', border: '0.5px solid rgba(217,119,6,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 20 }}>
                Der Teamleiter erhält eine offene Rückfrage zur Bestätigung der Mannschaft.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setMannschaftModal(null); setMannPicked({}); setMannSearch({}); setMannResults({}) }} className="pat-btn">
                  Abbrechen
                </button>
                <button
                  onClick={saveMannschaftNachtraeglich}
                  disabled={savingMannschaft || Object.keys(mannPicked).length === 0}
                  style={{ padding: '9px 18px', background: Object.keys(mannPicked).length > 0 ? '#600812' : 'var(--lbf-border-light)', color: Object.keys(mannPicked).length > 0 ? '#fff' : 'var(--warm-gray)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: Object.keys(mannPicked).length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', letterSpacing: '0.04em' }}
                >
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
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.45)', zIndex: 3100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: 'var(--lbf-card)', borderRadius: 14, width: '100%', maxWidth: 420, padding: '24px', boxShadow: '0 16px 48px rgba(0,0,0,0.2)', border: '0.5px solid rgba(96,8,18,0.1)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Zur Nachbearbeitung öffnen</div>
              <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)', marginBottom: 20 }}>{patName}</div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Dauer (Stunden)</label>
                <input
                  type="number"
                  min={1}
                  max={72}
                  value={reopenHours}
                  onChange={e => setReopenHours(Math.max(1, Math.min(72, Number(e.target.value))))}
                  style={{ width: '100%', padding: '9px 12px', border: '0.5px solid rgba(96,8,18,0.2)', borderRadius: 8, fontSize: 16, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: 'var(--warm-bg)', color: 'var(--lbf-text)', outline: 'none' }}
                />
                <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 6 }}>
                  Der Teamleiter hat {reopenHours} Stunden Zeit zur Nachbearbeitung. Ein System-Eintrag wird automatisch erstellt.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setReopenModal(null)} className="pat-btn">
                  Abbrechen
                </button>
                <button
                  onClick={() => reopenForTF(reopenModal, reopenHours)}
                  style={{ padding: '9px 18px', background: '#600812', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}
                >
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
        const pl = parsePayload((freshPat as any).payload)
        const rqs: any[] = Array.isArray(pl.rueckfragen) ? pl.rueckfragen : []
        const sns: any[] = Array.isArray(pl.stellungnahmen) ? pl.stellungnahmen : []
        const patName = [pl.vorname, pl.name].filter(Boolean).join(' ') || freshPat.title || 'Unbekannt'
        const einsatzInfo = [pl.einsatz_nr && `Einsatz-Nr. ${pl.einsatz_nr}`, pl.einsatz_art, pl.einsatz_adresse].filter(Boolean).join(' · ')
        const m = (pl.mannschaft || {}) as Record<string, { name?: string } | null>
        const crew = ['tf','m1','m2','m3'].map(k => m[k]?.name).filter(Boolean).join(', ')
        const isArchived = (freshPat as any).status === 'archiviert'
        const printStellungnahmen = () => {
          const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))
          const rqHtml = rqs.map((rq: any, i: number) => {
            const sn = sns.find((s: any) => s.rueckfrage_id === rq.id)
            return `
              <div class="rq">
                <div class="rq-head">Rückfrage #${i + 1}${rq.created_by ? ` <span class="meta">— ${esc(rq.created_by)}</span>` : ''}</div>
                <div class="rq-body">${esc(rq.frage)}</div>
                ${sn
                  ? `<div class="sn-label">Stellungnahme (${new Date(sn.created).toLocaleString('de-DE')}):</div><div class="sn-body">${esc(sn.text)}</div>`
                  : `<div class="sn-empty">Keine Stellungnahme eingegangen.</div>`
                }
              </div>
            `
          }).join('')
          const w = window.open('', '_blank', 'width=900,height=1100')
          if (!w) { alert('Bitte Popups erlauben, um drucken zu können.'); return }
          w.document.write(`<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Stellungnahmen — ${esc(patName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Atkinson Hyperlegible','Helvetica Neue',Arial,sans-serif;color:#1a0e08;padding:32px;background:#fff;line-height:1.5}
  h1{font-size:20px;margin-bottom:12px;color:#600812;letter-spacing:-0.01em}
  .meta-row{font-size:13px;margin-bottom:4px}
  .meta-row strong{display:inline-block;min-width:100px;color:#600812;font-weight:700}
  hr{border:none;border-top:0.5px solid rgba(96,8,18,0.2);margin:16px 0 20px}
  .rq{margin-bottom:20px;page-break-inside:avoid;border-left:3px solid #600812;padding-left:12px}
  .rq-head{font-weight:700;font-size:14px;color:#1a0e08;margin-bottom:6px}
  .rq-head .meta{font-style:italic;color:#8a7a68;font-weight:400;font-size:12px}
  .rq-body{font-size:13px;margin-bottom:10px;color:#1a0e08}
  .sn-label{font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#16a34a;margin-bottom:4px}
  .sn-body{font-size:13px;background:rgba(22,163,74,0.06);border-left:2px solid #16a34a;padding:8px 12px;border-radius:4px;color:#1a0e08}
  .sn-empty{font-size:13px;font-style:italic;color:#8a7a68}
  .print-btn{position:fixed;bottom:24px;right:24px;background:#600812;color:#fff;border:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-family:inherit}
  @media print{.print-btn{display:none}}
</style></head>
<body>
<h1>Stellungnahmen zum Einsatz</h1>
<div class="meta-row"><strong>Patient:</strong> ${esc(patName)}</div>
${einsatzInfo ? `<div class="meta-row"><strong>Einsatz:</strong> ${esc(einsatzInfo)}</div>` : ''}
${pl.zeit_einsatz ? `<div class="meta-row"><strong>Alarmzeit:</strong> ${esc(pl.zeit_einsatz)}</div>` : ''}
${crew ? `<div class="meta-row"><strong>Mannschaft:</strong> ${esc(crew)}</div>` : ''}
<hr>
${rqHtml || '<div style="font-style:italic;color:#8a7a68">Keine Rückfragen vorhanden.</div>'}
<button class="print-btn" onclick="window.print()">Drucken / PDF</button>
</body></html>`)
          w.document.close()
        }
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.45)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px 20px' }}>
              <div style={{ background: 'var(--lbf-card)', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.2)', border: '0.5px solid rgba(96,8,18,0.1)' }}>
                <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid rgba(96,8,18,0.12)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--lbf-card)', zIndex: 1 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Rückfragen &amp; Stellungnahmen</div>
                    <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)' }}>{patName}</div>
                    {einsatzInfo && <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{einsatzInfo}</div>}
                    {crew && <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 1 }}>Mannschaft: {crew}</div>}
                  </div>
                  <button
                    onClick={() => setShowStellungnahme(false)}
                    style={{ background: 'rgba(96,8,18,0.06)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#600812', flexShrink: 0, marginTop: 2 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {rqs.length === 0 && (
                    <div style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--warm-gray)', textAlign: 'center', padding: '24px 0' }}>Keine Rückfragen vorhanden.</div>
                  )}
                  {rqs.map((rq: any, i: number) => {
                    const sn = sns.find((s: any) => s.rueckfrage_id === rq.id)
                    return (
                      <div key={rq.id} style={{ background: 'var(--lbf-card)', border: `0.5px solid ${sn ? 'rgba(22,163,74,0.3)' : 'var(--lbf-input-border)'}`, borderLeft: `3px solid ${sn ? '#16a34a' : '#600812'}`, borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ background: sn ? 'rgba(22,163,74,0.05)' : 'rgba(96,8,18,0.04)', padding: '8px 14px', borderBottom: `0.5px solid ${sn ? 'rgba(22,163,74,0.2)' : 'rgba(96,8,18,0.1)'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 13, color: 'var(--lbf-text)' }}>Rückfrage #{i + 1}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: sn ? 'rgba(22,163,74,0.12)' : 'var(--lbf-border-light)', color: sn ? '#16a34a' : '#600812', marginLeft: 'auto', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {sn ? 'Beantwortet' : 'Offen'}
                          </span>
                          <span style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>{new Date(rq.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ fontSize: 13, background: 'rgba(250,249,247,0.8)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5, color: 'var(--lbf-text)' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{rq.created_by ? `${rq.created_by} fragt:` : 'Frage:'}</div>
                            {rq.frage}
                          </div>
                          {sn ? (
                            <div style={{ fontSize: 13, background: 'rgba(22,163,74,0.06)', borderRadius: 8, padding: '8px 10px', border: '0.5px solid rgba(22,163,74,0.2)', lineHeight: 1.5, color: 'var(--lbf-text)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Stellungnahme des Teamleiters:</span>
                                <span style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>{new Date(sn.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {sn.text}
                            </div>
                          ) : (
                            <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', padding: '4px 0' }}>Noch keine Stellungnahme eingegangen.</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding: '10px 20px 16px', borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'rgba(250,249,247,0.8)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={printStellungnahmen}
                    className="pat-btn"
                  >
                    Drucken / PDF
                  </button>
                  {!isArchived && (
                    <button
                      onClick={() => { setShowStellungnahme(false); openDetails(stellungnahmePat.id, 'patient') }}
                      style={{ padding: '8px 16px', background: '#600812', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}
                    >
                      Protokoll bearbeiten
                    </button>
                  )}
                  <button onClick={() => setShowStellungnahme(false)} className="pat-btn">
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
