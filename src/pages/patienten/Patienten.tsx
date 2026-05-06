import { useState, useEffect, useMemo } from 'react'
import { pb } from '../../lib/pocketbase'
import { useAuth } from '../../hooks/useAuth'
import StatusBar from '../../components/StatusBar'
import PatientEditModal from './PatientEditModal'
import SignModal from './SignModal'
import NachModal from './NachModal'
import DetailsModal from './DetailsModal'
import type { Patient, Nacherfassung, PatientPayload, NachForm } from './types'
import { EMPTY_PAYLOAD, EMPTY_NACH, parsePayload, fmtDate } from './types'

type Tab = 'patienten' | 'nach' | 'archiv' | 'audit'

interface AuditEntry {
  id: string
  action: string
  record_type: string
  record_title: string
  user_name: string
  created: string
}

const TEN_YEARS_MS = 10 * 365.25 * 24 * 60 * 60 * 1000

export default function Patienten() {
  const { user, loading, logout } = useAuth()

  const [patients, setPatients] = useState<Patient[]>([])
  const [nacherfassungen, setNacherfassungen] = useState<Nacherfassung[]>([])
  const [archivedPatients, setArchivedPatients] = useState<Patient[]>([])
  const [archivedNach, setArchivedNach] = useState<Nacherfassung[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('patienten')

  const [showEdit, setShowEdit] = useState(false)
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null)
  const [payload, setPayload] = useState<PatientPayload>({ ...EMPTY_PAYLOAD })

  const [showSign, setShowSign] = useState(false)
  const [adminName, setAdminName] = useState('')

  const [showNach, setShowNach] = useState(false)
  const [nachForm, setNachForm] = useState<NachForm>({ ...EMPTY_NACH })

  const [showDetails, setShowDetails] = useState(false)
  const [detailsDoc, setDetailsDoc] = useState<Patient | Nacherfassung | null>(null)
  const [detailsType, setDetailsType] = useState<'patient' | 'nach'>('patient')

  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    if (!user?.organization_id) return
    const org = user.organization_id
    try {
      const [pats, nachs, aPats, aNachs, logs] = await Promise.all([
        pb.collection('patients').getFullList({ filter: `status="offen"&&organization_id="${org}"`, sort: '-created' }),
        pb.collection('patient_docs_nacherfassung').getFullList({ filter: `status="offen"&&organization_id="${org}"`, sort: '-created' }),
        pb.collection('patients').getFullList({ filter: `status="archiviert"&&organization_id="${org}"`, sort: '-updated' }),
        pb.collection('patient_docs_nacherfassung').getFullList({ filter: `status="archiviert"&&organization_id="${org}"`, sort: '-created' }),
        pb.collection('audit_logs').getFullList({ filter: `organization_id="${org}"`, sort: '-created', fields: 'id,action,record_type,record_title,user_name,created' }).catch(() => []),
      ])
      setPatients(pats as unknown as Patient[])
      setNacherfassungen(nachs as unknown as Nacherfassung[])
      setArchivedPatients(aPats as unknown as Patient[])
      setArchivedNach(aNachs as unknown as Nacherfassung[])
      setAuditLogs(logs as unknown as AuditEntry[])
    } catch (e: any) {
      flash('Fehler beim Laden: ' + e.message, 'error')
    }
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
    setPayload(parsePayload((doc as any).payload))
    setShowEdit(true)
    const p = parsePayload((doc as any).payload)
    auditLog('bearbeitet', pat.id, 'patient', [p.name, p.vorname].filter(Boolean).join(' ') || pat.title || 'Unbekannt')
  }

  async function saveAndSign() {
    if (!currentPatient) return
    try {
      await pb.collection('patients').update(currentPatient.id, { payload })
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

        .pat-content {
          max-width: 1100px;
          margin: 0 auto;
          padding: 1.25rem 1.25rem;
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
        .pat-card.offen      { border-left-color: #3b82f6; }
        .pat-card.entwurf    { border-left-color: #f59e0b; }
        .pat-card.nach       { border-left-color: #8b5cf6; }
        .pat-card.archiviert { border-left-color: #6b7280; }
        .pat-card.old        { border-left-color: #f59e0b; outline: 1px solid #fcd34d; }

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
        .pat-badge.offen      { background: #eff6ff; color: #1d4ed8; }
        .pat-badge.entwurf    { background: #fffbeb; color: #b45309; }
        .pat-badge.nach       { background: #f5f3ff; color: #6d28d9; }
        .pat-badge.archiviert { background: #f3f4f6; color: #374151; }
        .pat-badge.editing    { background: #fef9c3; color: #92400e; border: 1px solid #fcd34d; }
        .pat-badge.old-warn   { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }

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
          <span>Dokus{patients.length > 0 ? ` (${patients.length})` : ''}</span>
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
          <span>Nacherfassungen{nacherfassungen.length > 0 ? ` (${nacherfassungen.length})` : ''}</span>
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
          <span>Archiv{totalArchiv > 0 ? ` (${totalArchiv})` : ''}</span>
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
          <span>Audit-Log</span>
        </button>
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
          patients.length === 0 ? (
            <div className="pat-empty">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: '14px' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>Keine offenen Patientendokus</div>
              <div style={{ fontSize: '13px' }}>Neue Dokus werden hier angezeigt, sobald sie eingereicht werden.</div>
            </div>
          ) : (
            <div className="pat-grid">
              {patients.map(pat => {
                const p = parsePayload(pat.payload)
                const patName = [p.name, p.vorname].filter(Boolean).join(' ')
                const isDraft = !patName
                const m = (pat as any).payload?.mannschaft || {}
                const crew = ['tf','m1','m2','m3'].map((k: string) => m[k]?.name).filter(Boolean).join(', ')
                const displayName = patName || crew || pat.title || 'Unbekannt'
                const hasCrewUsers = ['tf','m1','m2','m3'].some(k => m[k]?.id)
                const ageMs = Date.now() - new Date(pat.created).getTime()
                const crewStillEditing = hasCrewUsers && ageMs < 24 * 60 * 60 * 1000
                return (
                  <div key={pat.id} className={`pat-card ${isDraft ? 'entwurf' : 'offen'}`}>
                    <div className="pat-card-type">{isDraft ? 'Entwurf' : 'Patientendoku'}</div>
                    <div className="pat-card-name">{displayName}</div>
                    <div className="pat-card-meta">
                      {isDraft && crew ? `Mannschaft: ${crew}` : null}
                      {isDraft && crew ? <br /> : null}
                      {fmtDate(pat.created)}
                    </div>
                    <div className="pat-card-footer">
                      <span className={`pat-badge ${isDraft ? 'entwurf' : 'offen'}`}>
                        {isDraft ? 'Entwurf' : 'offen'}
                      </span>
                      <div style={{ flex: 1 }} />
                      {crewStillEditing ? (
                        <>
                          <span className="pat-badge editing">In Bearbeitung</span>
                          <button className="pat-btn" onClick={() => openDetails(pat.id, 'patient')}>Ansehen</button>
                        </>
                      ) : (
                        <button className="pat-btn" onClick={() => openEdit(pat)}>Bearbeiten</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* NACHERFASSUNGEN */}
        {activeTab === 'nach' && (
          nacherfassungen.length === 0 ? (
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
                      {items.map(item => (
                        <div key={item.id} className={`pat-card ${item.isOld ? 'old' : 'archiviert'}`}>
                          <div className="pat-card-type">
                            {item.type === 'patient' ? 'Patientendoku' : 'Nacherfassung'}
                          </div>
                          <div className="pat-card-name">{item.title}</div>
                          <div className="pat-card-meta">
                            {item.type === 'patient' && (item.orig as Patient).admin_name
                              ? `${(item.orig as Patient).admin_name} · ` : ''}
                            {fmtDate(item.type === 'patient' ? (item.orig as Patient).updated : (item.orig as Nacherfassung).created)}
                          </div>
                          <div className="pat-card-footer">
                            <span className="pat-badge archiviert">archiviert</span>
                            {item.isOld && <span className="pat-badge old-warn">Frist überschritten</span>}
                            <div style={{ flex: 1 }} />
                            <button className="pat-btn" onClick={() => openDetails(item.id, item.type)}>Ansehen</button>
                            <button className="pat-btn danger" onClick={() => deleteRecord(item.id, item.type, item.title)}>Löschen</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </>
        )}

        {/* AUDIT LOG */}
        {activeTab === 'audit' && (
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
          </>
        )}

      </div>

      {showEdit && (
        <PatientEditModal payload={payload} setP={setP} onClose={() => setShowEdit(false)} onSaveAndSign={saveAndSign} />
      )}
      {showSign && (
        <SignModal adminName={adminName} setAdminName={setAdminName} onClose={() => setShowSign(false)} onArchive={archiveWithSig} />
      )}
      {showNach && (
        <NachModal form={nachForm} setN={setN} onClose={() => setShowNach(false)} onSave={saveNach} />
      )}
      {showDetails && detailsDoc && (
        <DetailsModal doc={detailsDoc} type={detailsType} onClose={() => setShowDetails(false)} />
      )}
    </>
  )
}
