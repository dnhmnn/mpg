import { useState, useEffect } from 'react'
import { pb } from '../../lib/pocketbase'
import { useAuth } from '../../hooks/useAuth'
import StatusBar from '../../components/StatusBar'
import PatientEditModal from './PatientEditModal'
import SignModal from './SignModal'
import NachModal from './NachModal'
import DetailsModal from './DetailsModal'
import type { Patient, Nacherfassung, PatientPayload, NachForm } from './types'
import { EMPTY_PAYLOAD, EMPTY_NACH, parsePayload, fmtDate } from './types'

type Tab = 'patienten' | 'nach' | 'archiv'

export default function Patienten() {
  const { user, loading, logout } = useAuth()

  const [patients, setPatients] = useState<Patient[]>([])
  const [nacherfassungen, setNacherfassungen] = useState<Nacherfassung[]>([])
  const [archivedPatients, setArchivedPatients] = useState<Patient[]>([])
  const [archivedNach, setArchivedNach] = useState<Nacherfassung[]>([])
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
      const [pats, nachs, aPats, aNachs] = await Promise.all([
        pb.collection('patients').getFullList({ filter: `status="offen"&&organization_id="${org}"`, sort: '-created' }),
        pb.collection('patient_docs_nacherfassung').getFullList({ filter: `status="offen"&&organization_id="${org}"`, sort: '-created' }),
        pb.collection('patients').getFullList({ filter: `status="archiviert"&&organization_id="${org}"`, sort: '-updated' }),
        pb.collection('patient_docs_nacherfassung').getFullList({ filter: `status="archiviert"&&organization_id="${org}"`, sort: '-updated' }),
      ])
      setPatients(pats as unknown as Patient[])
      setNacherfassungen(nachs as unknown as Nacherfassung[])
      setArchivedPatients(aPats as unknown as Patient[])
      setArchivedNach(aNachs as unknown as Nacherfassung[])
    } catch (e: any) {
      flash('Fehler beim Laden: ' + e.message, 'error')
    }
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
      await pb.collection('patient_docs_nacherfassung').update(id, { status: 'archiviert' })
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
  }

  const pill = (label: string, color: string) => (
    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: color, color: '#fff', marginRight: '8px', flexShrink: 0 }}>{label}</span>
  )

  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-card)', borderRadius: '12px', marginBottom: '8px', gap: '8px', boxShadow: 'var(--shadow-sm)' }
  const btnSm = (onClick: () => void, label: string, danger = false): React.ReactNode => (
    <button onClick={onClick} style={{ fontSize: '13px', fontWeight: 600, padding: '6px 12px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: danger ? '#c0392b' : 'var(--bg-secondary)', color: danger ? '#fff' : 'var(--text)', flexShrink: 0 }}>{label}</button>
  )

  if (loading) return null

  return (
    <>
      <style>{`
        .pat-tab { padding: 8px 16px; border: none; background: none; font-size: 14px; font-weight: 600; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; }
        .pat-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
        .fab { position: fixed; bottom: calc(24px + env(safe-area-inset-bottom)); right: 20px; width: 56px; height: 56px; border-radius: 28px; background: #c0392b; color: #fff; border: none; font-size: 28px; cursor: pointer; box-shadow: 0 4px 16px rgba(192,57,43,0.4); display: flex; align-items: center; justify-content: center; z-index: 500; }
        @media (min-width: 768px) {
          .pat-rows { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        }
        @media (min-width: 1100px) {
          .pat-rows { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>

      <StatusBar user={user} onLogout={logout} pageName="Patienten" showHubLink />

      {msg && (
        <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 64px)', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'success' ? '#27a447' : '#c03026', color: '#fff', padding: '10px 20px', borderRadius: '20px', fontSize: '14px', fontWeight: 600, zIndex: 9999, whiteSpace: 'nowrap' }}>
          {msg.text}
        </div>
      )}

      <div className="content">
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px', overflowX: 'auto' }}>
          {(['patienten', 'nach', 'archiv'] as Tab[]).map(t => (
            <button key={t} className={`pat-tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
              {t === 'patienten' ? `Patientendokus (${patients.length})` : t === 'nach' ? `Nacherfassungen (${nacherfassungen.length})` : 'Archiv'}
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
          <div className="pat-rows">
            {archivedPatients.length === 0 && archivedNach.length === 0 && <div style={{ opacity: 0.5, fontSize: '14px' }}>Archiv leer</div>}
            {archivedPatients.map(pat => {
              const p = parsePayload(pat.payload)
              const name = [p.name, p.vorname].filter(Boolean).join(' ') || pat.title || 'Unbekannt'
              return (
                <div key={pat.id} style={rowStyle}>
                  {pill('Patientendoku', '#6b7280')}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    <div style={{ fontSize: '12px', opacity: 0.6 }}>{pat.admin_name && `${pat.admin_name} · `}{fmtDate(pat.updated)}</div>
                  </div>
                  {btnSm(() => openDetails(pat.id, 'patient'), 'Ansehen')}
                </div>
              )
            })}
            {archivedNach.map(n => (
              <div key={n.id} style={rowStyle}>
                {pill('Nacherfassung', '#6b7280')}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.stichwort || '—'}</div>
                  <div style={{ fontSize: '12px', opacity: 0.6 }}>{n.nacherfasst_von_name} · {fmtDate(n.created)}</div>
                </div>
                {btnSm(() => openDetails(n.id, 'nach'), 'Ansehen')}
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="fab" onClick={() => { setNachForm({ ...EMPTY_NACH }); setShowNach(true) }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>

      {showEdit && (
        <PatientEditModal
          payload={payload}
          setP={setP}
          onClose={() => setShowEdit(false)}
          onSaveAndSign={saveAndSign}
        />
      )}

      {showSign && (
        <SignModal
          adminName={adminName}
          setAdminName={setAdminName}
          onClose={() => setShowSign(false)}
          onArchive={archiveWithSig}
        />
      )}

      {showNach && (
        <NachModal
          form={nachForm}
          setN={setN}
          onClose={() => setShowNach(false)}
          onSave={saveNach}
        />
      )}

      {showDetails && detailsDoc && (
        <DetailsModal
          doc={detailsDoc}
          type={detailsType}
          onClose={() => setShowDetails(false)}
        />
      )}
    </>
  )
}
