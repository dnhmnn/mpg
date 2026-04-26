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

  const pill = (label: string, color: string) => (
    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: color, color: '#fff', flexShrink: 0 }}>{label}</span>
  )
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-card)', borderRadius: '12px', marginBottom: '8px', gap: '8px', boxShadow: 'var(--shadow-sm)' }
  const btnSm = (onClick: () => void, label: string, danger = false): React.ReactNode => (
    <button onClick={onClick} style={{ fontSize: '13px', fontWeight: 600, padding: '6px 12px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: danger ? '#c0392b' : 'var(--bg-secondary)', color: danger ? '#fff' : 'var(--text)', flexShrink: 0 }}>{label}</button>
  )

  const auditColor: Record<string, string> = {
    'eingesehen': '#059669',
    'bearbeitet': '#2563eb',
    'archiviert': '#6b7280',
    'gelöscht': '#c0392b',
    'gelöscht (Aufbewahrungsfrist)': '#c0392b',
  }

  if (loading) return null

  return (
    <>
      <style>{`
        .pat-tab { padding: 8px 16px; border: none; background: none; font-size: 14px; font-weight: 600; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
        .pat-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
        .fab { position: fixed; bottom: calc(24px + env(safe-area-inset-bottom)); right: 20px; width: 56px; height: 56px; border-radius: 28px; background: #c0392b; color: #fff; border: none; font-size: 28px; cursor: pointer; box-shadow: 0 4px 16px rgba(192,57,43,0.4); display: flex; align-items: center; justify-content: center; z-index: 500; }
        @media (min-width: 768px) { .pat-rows { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; } }
        @media (min-width: 1100px) { .pat-rows { grid-template-columns: repeat(3, 1fr); } }
      `}</style>

      <StatusBar user={user} onLogout={logout} pageName="Patienten" showHubLink />

      {msg && (
        <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 64px)', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'success' ? '#27a447' : '#c03026', color: '#fff', padding: '10px 20px', borderRadius: '20px', fontSize: '14px', fontWeight: 600, zIndex: 9999, whiteSpace: 'nowrap' }}>
          {msg.text}
        </div>
      )}

      <div className="content">
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px', overflowX: 'auto' }}>
          {(['patienten', 'nach', 'archiv', 'audit'] as Tab[]).map(t => (
            <button key={t} className={`pat-tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
              {t === 'patienten' ? `Patientendokus (${patients.length})`
               : t === 'nach' ? `Nacherfassungen (${nacherfassungen.length})`
               : t === 'archiv' ? `Archiv (${archivedPatients.length + archivedNach.length})`
               : 'Audit-Log'}
            </button>
          ))}
        </div>

        {activeTab === 'patienten' && (
          <div className="pat-rows">
            {patients.length === 0 && <div style={{ opacity: 0.5, fontSize: '14px' }}>Keine offenen Patientendokus</div>}
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
                <div key={pat.id} style={rowStyle}>
                  {isDraft ? pill('Entwurf', '#d97706') : pill('offen', '#2563eb')}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                    <div style={{ fontSize: '12px', opacity: 0.6 }}>{isDraft && crew ? `Mannschaft: ${crew} · ` : ''}{fmtDate(pat.created)}</div>
                  </div>
                  {crewStillEditing
                    ? <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '5px 10px' }}>In Bearbeitung</span>
                        {btnSm(() => openDetails(pat.id, 'patient'), 'Ansehen')}
                      </div>
                    : btnSm(() => openEdit(pat), 'Bearbeiten')
                  }
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'nach' && (
          <div className="pat-rows">
            {nacherfassungen.length === 0 && <div style={{ opacity: 0.5, fontSize: '14px' }}>Keine offenen Nacherfassungen</div>}
            {nacherfassungen.map(n => (
              <div key={n.id} style={rowStyle}>
                {pill('offen', '#2563eb')}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.stichwort || '—'}</div>
                  <div style={{ fontSize: '12px', opacity: 0.6 }}>{n.nacherfasst_von_name} · {fmtDate(n.created)}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {btnSm(() => openDetails(n.id, 'nach'), 'Details')}
                  {btnSm(() => archiveNach(n.id), 'Archivieren', true)}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'archiv' && (
          <>
            {oldCount > 0 && (
              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#92400e' }}>{oldCount} Datensätze älter als 10 Jahre</div>
                  <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>DSGVO-Aufbewahrungsfrist überschritten – zur Löschung empfohlen.</div>
                </div>
                <button onClick={deleteOldRecords} style={{ fontSize: '13px', fontWeight: 600, padding: '6px 12px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: '#c0392b', color: '#fff', flexShrink: 0 }}>
                  Jetzt löschen
                </button>
              </div>
            )}

            {Object.keys(archiveByYear).length === 0 && <div style={{ opacity: 0.5, fontSize: '14px' }}>Archiv leer</div>}

            {Object.entries(archiveByYear)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([year, items]) => (
                <div key={year}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 4px 4px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
                    {year}
                  </div>
                  <div className="pat-rows" style={{ marginBottom: '16px' }}>
                    {items.map(item => (
                      <div key={item.id} style={{ ...rowStyle, opacity: item.isOld ? 0.75 : 1, outline: item.isOld ? '1px solid #fcd34d' : 'none' }}>
                        {item.type === 'patient' ? pill('Patientendoku', '#6b7280') : pill('Nacherfassung', '#6b7280')}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                          <div style={{ fontSize: '12px', opacity: 0.6 }}>
                            {item.type === 'patient' && (item.orig as Patient).admin_name ? `${(item.orig as Patient).admin_name} · ` : ''}
                            {fmtDate(item.type === 'patient' ? (item.orig as Patient).updated : (item.orig as Nacherfassung).created)}
                            {item.isOld && <span style={{ color: '#b45309', marginLeft: '6px', fontWeight: 600 }}>· Frist überschritten</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {btnSm(() => openDetails(item.id, item.type), 'Ansehen')}
                          {btnSm(() => deleteRecord(item.id, item.type, item.title), 'Löschen', true)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </>
        )}

        {activeTab === 'audit' && (
          <div>
            {auditLogs.length === 0 && (
              <div style={{ opacity: 0.5, fontSize: '14px', marginBottom: '8px' }}>
                Keine Einträge. Collection <code>audit_logs</code> muss in PocketBase angelegt sein.
              </div>
            )}
            {auditLogs.map(entry => (
              <div key={entry.id} style={{ ...rowStyle, padding: '10px 14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: auditColor[entry.action] || '#6b7280', color: '#fff', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {entry.action}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.record_title}</div>
                  <div style={{ fontSize: '12px', opacity: 0.6 }}>{entry.user_name} · {fmtDate(entry.created)}</div>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0 }}>{entry.record_type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="fab" onClick={() => { setNachForm({ ...EMPTY_NACH }); setShowNach(true) }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>

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
