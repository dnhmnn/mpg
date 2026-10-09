import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { pb } from '../../lib/pocketbase'
import { useAuth } from '../../hooks/useAuth'
import PatientEditModal from './PatientEditModal'
import PatientQRManager from './PatientQRManager'
import SignModal from './SignModal'
import NachModal from './NachModal'
import DetailsModal from './DetailsModal'
import ProtokollView from '../../components/ProtokollView'
const ProtokollInhalt = lazy(() => import('../../components/ProtokollFenster').then((m) => ({ default: m.ProtokollInhalt })))
const RueckfrageFenster = lazy(() => import('../../components/RueckfrageFenster'))
import type { Patient, Nacherfassung, PatientPayload, NachForm } from './types'
import { EMPTY_PAYLOAD, EMPTY_NACH, parsePayload, fmtDate } from './types'
import { archivHindernis, offeneRueckfragen, rueckfragen } from '../public/doku/rueckfrage'
import { fristEnde, fristRestText } from '../public/doku/absenden'

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

  /** Das Protokoll, zu dem gerade eine Rückfrage gestellt wird. */
  const [rueckfrageModal, setRueckfrageModal] = useState<Patient | null>(null)

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

  /** Ein archiviertes Protokoll zum Nachlesen des Vorgangs. */
  const [nachlesen, setNachlesen] = useState<Patient | null>(null)

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

  /*
   * Der Beauftragte bearbeitet das Protokoll nicht mehr.
   *
   * Der alte Admin-Bogen führt andere Felder als die Maske, in der heute
   * dokumentiert wird — er zeigte für ein neues Protokoll leere Zeilen und
   * schrieb beim Weiterklicken eine Nutzlast darüber. Der Weg von der Karte
   * dorthin ist deshalb zu; vom Protokoll zur Unterschrift geht es jetzt
   * direkt. Was unklar ist, wird gefragt, nicht geändert.
   *
   * Erreichbar bleibt der Bogen allein über die Detailansicht (dort setzt
   * `openDetails` den Stand) — für die Ausnahmen, die er noch kann, etwa den
   * Zugangscode des Patienten.
   */

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

  /*
   * Die Nachbearbeitung gibt es nicht mehr.
   *
   * Ein Protokoll noch einmal zum Schreiben zu öffnen hieß, das im Einsatz
   * Dokumentierte nachträglich zu ändern. Stattdessen stellt der Beauftragte
   * eine Rückfrage und der Teamführer nimmt dazu Stellung — das Protokoll
   * bleibt, wie es war, die Erklärung steht daneben.
   */

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
    'bearbeitet': 'var(--lbf-akzent-grund)',
    'archiviert': 'var(--warm-gray)',
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
          animation: slideInRight 0.2s ease-out both;
          max-width: 320px;
          font-family: inherit;
          letter-spacing: 0.02em;
        }
        .pat-toast.success { background: var(--lbf-ok-grund); border: 1px solid #bbf7d0; color: var(--lbf-ok-text); }
        .pat-toast.error   { background: var(--lbf-fehler-grund); border: 1px solid #fecaca; color: var(--lbf-fehler-text-2); }

        .pat-toolbar {
          background: var(--lbf-card);
          border-bottom: 0.5px solid rgba(var(--lbf-rot-rgb),0.1);
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
        .pat-tab-btn:hover { color: var(--lbf-text); }
        .pat-tab-btn.active {
          color: var(--lbf-akzent);
          border-bottom-color: var(--lbf-akzent);
        }
        .pat-tab-btn .pat-tab-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

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
          /* Der Kartengrund kommt aus dem Token, sonst bleibt die Karte im
             Dunkelmodus weiss. */
          background: var(--lbf-card);
          border-radius: 12px;
          border-left: 3px solid transparent;
          box-shadow: var(--lbf-shadow);
          position: relative;
          cursor: default;
          overflow: hidden;
          /* Im Raster werden die Karten auf eine Hoehe gestreckt. Ohne diese
             zwei Zeilen blieb der Fussbereich dort stehen, wo der Text endet,
             und darunter stand ein weisser Rest. */
          display: flex;
          flex-direction: column;
        }
        .pat-card-body {
          padding: 14px 16px 12px 14px;
          flex: 1;
        }
        .pat-card.offen         { border-left-color: var(--lbf-akzent); }
        .pat-card.freigegeben   { border-left-color: #16a34a; }
        /* Eine offene Rueckfrage haelt das Protokoll auf — der Balken sagt es. */
        .pat-card.rueckfrage    { border-left-color: #d97706; }
        .pat-card.nach          { border-left-color: var(--lbf-akzent); }
        .pat-card.archiviert    { border-left-color: rgba(var(--lbf-grau-rgb),0.4); }
        .pat-card.old           { border-left-color: #d97706; }

        .pat-card-type {
          font-size: 10px;
          font-weight: 700;
          color: var(--lbf-akzent);
          text-transform: uppercase;
          letter-spacing: 0.14em;
          margin-bottom: 5px;
        }
        .pat-card-name {
          font-style: italic;
          font-weight: 700;
          font-size: 17px;
          margin-bottom: 5px;
          color: var(--lbf-text);
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
          border-top: 0.5px solid var(--lbf-border-light);
          /* Im Dunkelmodus blieb dieser Streifen hell — unter einer dunklen
             Karte, mit dunklen Knöpfen darauf. */
          background: var(--lbf-fuss);
          padding: 8px 12px;
          flex-wrap: wrap;
        }

        /* Was einer Handlung entgegensteht, steht auf der Karte — nicht erst
           als Titel am gesperrten Knopf. */
        .pat-hinweis {
          margin-top: 9px;
          padding: 6px 10px;
          background: var(--lbf-akzent-weich);
          border-radius: 8px;
          font-style: italic;
          font-size: 12px;
          color: var(--lbf-akzent);
          line-height: 1.45;
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
        .pat-badge.nach          { background: rgba(var(--lbf-rot-rgb),0.07); color: var(--lbf-akzent); }
        .pat-badge.archiviert    { background: rgba(var(--lbf-grau-rgb),0.1); color: var(--warm-gray); }
        .pat-badge.old-warn      { background: rgba(217,119,6,0.1); color: #d97706; }

        .pat-btn {
          font-size: 12px;
          font-weight: 700;
          padding: 6px 12px;
          border: 1px solid rgba(var(--lbf-rot-rgb),0.15);
          border-radius: 8px;
          cursor: pointer;
          background: var(--warm-bg);
          color: var(--lbf-text);
          transition: background 0.12s;
          flex-shrink: 0;
          font-family: inherit;
          letter-spacing: 0.02em;
        }
        .pat-btn:hover { background: rgba(var(--lbf-rot-rgb),0.06); }
        /* Die eine Handlung, auf die eine Karte hinauslaeuft. */
        .pat-btn.haupt { background: var(--lbf-akzent-grund); border-color: var(--lbf-akzent-grund); color: #fff; }
        .pat-btn.haupt:hover { background: #4a0610; }
        .pat-btn:disabled, .pat-btn.haupt:disabled {
          background: rgba(var(--lbf-rot-rgb),0.04);
          border-color: var(--lbf-border-light);
          color: var(--warm-gray);
          cursor: not-allowed;
        }
        .pat-btn.danger { background: var(--lbf-fehler-grund-3); border-color: rgba(220,38,38,0.3); color: #dc2626; }
        .pat-btn.danger:hover { background: var(--lbf-fehler-grund-4); }

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
          color: var(--lbf-akzent);
          text-transform: uppercase;
          letter-spacing: 0.14em;
          padding: 10px 0 8px;
          border-bottom: 0.5px solid var(--lbf-border);
          margin-bottom: 12px;
        }

        .pat-warn-banner {
          background: var(--lbf-warn-grund-3);
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
        .pat-warn-title { font-weight: 700; font-size: 13px; color: var(--lbf-warn-text); font-style: italic; }
        .pat-warn-sub { font-size: 12px; color: var(--lbf-warn-text-2); margin-top: 2px; font-style: italic; }

        .pat-audit-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: var(--lbf-card);
          border-radius: 10px;
          margin-bottom: 6px;
          border-left: 3px solid rgba(var(--lbf-grau-rgb),0.3);
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
          color: var(--lbf-text);
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

      `}</style>

      {/* ── MASTHEAD ── */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid var(--lbf-border)', position: 'sticky', top: 0, zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/hub" style={{ display: 'flex', color: 'var(--lbf-akzent)', textDecoration: 'none', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </a>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--lbf-text)' }}>Patienten</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{user?.organization_name || 'Responda'}</div>
          </div>
          {(activeTab === 'patienten' || activeTab === 'nach') && (
            <button
              onClick={() => { setNachForm({ ...EMPTY_NACH }); setShowNach(true) }}
              style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(var(--lbf-rot-rgb),0.07)', color: 'var(--lbf-akzent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
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
              <div style={{ width: '28px', height: '28px', border: '2px solid rgba(var(--lbf-rot-rgb),0.15)', borderTopColor: 'var(--lbf-akzent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
              <div>Lade Dokus...</div>
            </div>
          ) : patients.length === 0 && freigegebenPatients.length === 0 ? (
            <div className="pat-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25, marginBottom: '14px', color: 'var(--lbf-akzent)' }}>
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
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>
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
                      // Vermerke des Systems zählen nicht: sie verlangen keine
                      // Stellungnahme und halten das Archivieren nicht auf.
                      const offeneRQ = offeneRueckfragen((pat as any).payload)
                      const openRQ = offeneRQ.length
                      const hindernis = archivHindernis((pat as any).payload)
                      const canSign = !hindernis
                      const changedCount = ((pat as any).payload?._changed_fields || []).length
                      return (
                        /*
                         * Dieselbe Karte wie überall auf dieser Seite: weiß,
                         * Radius 12, weicher Schatten, links ein 3px-Balken in
                         * der Statusfarbe. Vorher trug sie den Status als
                         * Streifen oben — und weil die Karte schon rundet und
                         * beschneidet, blieben an seinen Ecken weiße Keile
                         * stehen. Ein kleiner Balken links genügt.
                         */
                        <div key={pat.id} className={`pat-card ${openRQ > 0 ? 'rueckfrage' : 'freigegeben'}`}>
                          <div className="pat-card-body">
                            {openRQ > 0 ? (
                              <div className="pat-card-type">{`${openRQ} Rückfrage${openRQ !== 1 ? 'n' : ''} offen`}</div>
                            ) : null}
                            <div className="pat-card-name">{displayName}</div>
                            <div className="pat-card-meta">
                              {crew ? <>{crew}<br /></> : null}
                              {fmtDate(pat.created)}
                              {sns.length > 0 ? ` · ${sns.length} Stellungnahme${sns.length !== 1 ? 'n' : ''}` : ''}
                              {changedCount > 0 ? ` · ${changedCount} Änderung${changedCount !== 1 ? 'en' : ''}` : ''}
                            </div>
                            {hindernis ? <div className="pat-hinweis">{hindernis}</div> : null}
                          </div>
                          <div className="pat-card-footer">
                            <button className="pat-btn" onClick={() => setProtokollSheet(pat)}>Ansehen</button>
                            <button className="pat-btn" onClick={() => setRueckfrageModal(pat)}>
                              {openRQ > 0 ? `Rückfrage (${openRQ})` : 'Rückfrage'}
                            </button>
                            <div style={{ flex: 1 }} />
                            {/*
                              * Gegenzeichnen führt jetzt direkt zur Unterschrift.
                              * Vorher ging der Weg über den alten Admin-Bogen —
                              * der zeigt für ein Protokoll aus der neuen Maske
                              * leere Felder und schrieb beim Weiterklicken eine
                              * Nutzlast samt Audit-Eintrag "bearbeitet", obwohl
                              * niemand etwas geändert hat.
                              */}
                            <button
                              className="pat-btn haupt" disabled={!canSign} title={hindernis}
                              onClick={() => { if (canSign) { setCurrentPatient(pat); setShowSign(true) } }}
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
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>
                    Noch nicht freigegeben ({patients.length})
                  </div>
                  <div className="pat-grid">
                    {patients.map(pat => {
                      const p = parsePayload(pat.payload)
                      const patName = [p.name, p.vorname].filter(Boolean).join(' ')
                      const m = (pat as any).payload?.mannschaft || {}
                      const crew = ['tf','m1','m2','m3'].map((k: string) => m[k]?.name).filter(Boolean).join(', ')
                      const displayName = patName || crew || pat.title || 'Unbekannt'
                      // Dieselbe Frist wie in Unitas: sie steht im Protokoll,
                      // ältere zählen ab dem Anlegen.
                      const restMs = fristEnde((pat as any).payload || {}, pat.created) - Date.now()
                      const frist = fristRestText((pat as any).payload || {}, pat.created)
                      return (
                        <div key={pat.id} className="pat-card offen">
                          <div className="pat-card-body">
                            <div className="pat-card-name">{displayName}</div>
                            <div className="pat-card-meta">
                              {crew ? <>{crew}<br /></> : null}
                              {fmtDate(pat.created)}
                              {restMs > 0 ? ` · beim Teamführer, ${frist}` : ' · Freigabe ausstehend'}
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
              <div style={{ width: '28px', height: '28px', border: '2px solid rgba(var(--lbf-rot-rgb),0.15)', borderTopColor: 'var(--lbf-akzent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
              <div>Lade Nacherfassungen...</div>
            </div>
          ) : nacherfassungen.length === 0 ? (
            <div className="pat-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25, marginBottom: '14px', color: 'var(--lbf-akzent)' }}>
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
              <div style={{ width: '28px', height: '28px', border: '2px solid rgba(var(--lbf-rot-rgb),0.15)', borderTopColor: 'var(--lbf-akzent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
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
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25, marginBottom: '14px', color: 'var(--lbf-akzent)' }}>
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
                        const archRqs = rueckfragen((item.orig as any).payload)
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
                              {archRqs.length > 0 && (
                                // Dasselbe Fenster wie beim Fragen, nur lesend:
                                // im Archiv gibt es nichts mehr zu fragen.
                                <button className="pat-btn" onClick={() => setNachlesen(item.orig as Patient)}>
                                  Rückfragen
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
              <div style={{ width: '28px', height: '28px', border: '2px solid rgba(var(--lbf-rot-rgb),0.15)', borderTopColor: 'var(--lbf-akzent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
              <div>Lade Audit-Log...</div>
            </div>
          ) : (
          <>
            {auditLogs.length === 0 && (
              <div className="pat-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25, marginBottom: '14px', color: 'var(--lbf-akzent)' }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <div style={{ fontStyle: 'italic', fontWeight: 700, color: 'var(--lbf-text)', marginBottom: '6px', fontSize: 15 }}>Keine Einträge</div>
                <div>Collection <code>audit_logs</code> muss in PocketBase angelegt sein.</div>
              </div>
            )}
            {auditLogs.map(entry => (
              <div key={entry.id} className="pat-audit-row">
                <span className="pat-audit-action" style={{ background: auditColor[entry.action] || 'var(--warm-gray)' }}>
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
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '20px 0 10px', paddingTop: '16px', borderTop: '0.5px solid var(--lbf-border)' }}>
                  QR-Code Zugriffe
                </div>
                {accessLogs.map(entry => {
                  const eventColor: Record<string, string> = {
                    granted: '#16a34a',
                    dob_failed: '#d97706',
                    locked: '#c0392b',
                    expired: 'var(--warm-gray)',
                  }
                  const eventLabel: Record<string, string> = {
                    granted: 'Zugriff gewährt',
                    dob_failed: 'Falsches Geburtsdatum',
                    locked: 'Gesperrt',
                    expired: 'Abgelaufen',
                  }
                  return (
                    <div key={entry.id} className="pat-audit-row">
                      <span className="pat-audit-action" style={{ background: eventColor[entry.event] || 'var(--warm-gray)' }}>
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
              <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--lbf-border)', background: 'var(--lbf-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)' }}>{sheetName}</div>
                  <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                    {(protokollSheet as any).status === 'offen' ? 'In Bearbeitung durch Teamleiter' : 'Freigegeben'}
                  </div>
                </div>
                <button
                  onClick={() => setProtokollSheet(null)}
                  style={{ background: 'rgba(var(--lbf-rot-rgb),0.06)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lbf-akzent)', flexShrink: 0 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {/* Die Maske selbst, nur lesend — damit alle dasselbe sehen
                    wie der, der sie ausgefüllt hat. */}
                <Suspense fallback={null}>
                  <ProtokollInhalt patientId={protokollSheet.id} payload={(protokollSheet as any).payload} />
                </Suspense>
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
            <div style={{ background: 'var(--lbf-card)', borderRadius: 14, width: '100%', maxWidth: 460, padding: '24px', boxShadow: '0 16px 48px rgba(0,0,0,0.2)', border: '0.5px solid rgba(var(--lbf-rot-rgb),0.1)', maxHeight: '90dvh', overflowY: 'auto' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Mannschaft nachtragen</div>
              <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)', marginBottom: 20 }}>{patName}</div>
              {roles.map(({ key, label }) => {
                const existing = (mannschaftModal as any).payload?.mannschaft?.[key]
                const picked = mannPicked[key]
                return (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</label>
                    {picked ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(var(--lbf-rot-rgb),0.04)', border: '0.5px solid rgba(var(--lbf-rot-rgb),0.15)', borderRadius: 8 }}>
                        <span style={{ flex: 1, fontStyle: 'italic', fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)' }}>{picked.name}</span>
                        <button onClick={() => setMannPicked(prev => { const n = { ...prev }; delete n[key]; return n })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
                      </div>
                    ) : existing?.id ? (
                      <div style={{ padding: '8px 12px', background: 'rgba(var(--lbf-grau-rgb),0.06)', border: '0.5px solid rgba(var(--lbf-grau-rgb),0.2)', borderRadius: 8, fontStyle: 'italic', fontSize: 14, color: 'var(--warm-gray)' }}>
                        {existing.name} <span style={{ fontSize: 11, opacity: 0.7 }}>(bereits eingetragen)</span>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="Name suchen…"
                          value={mannSearch[key] || ''}
                          onChange={e => searchMannschaft(key, e.target.value)}
                          style={{ width: '100%', padding: '9px 12px', border: '0.5px solid rgba(var(--lbf-rot-rgb),0.2)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: 'var(--warm-bg)', color: 'var(--lbf-text)', outline: 'none' }}
                        />
                        {(mannResults[key] || []).length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--lbf-card)', border: '0.5px solid rgba(var(--lbf-rot-rgb),0.15)', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.12)', zIndex: 10, overflow: 'hidden', marginTop: 4 }}>
                            {mannResults[key].map((u: any) => (
                              <div key={u.id} onClick={() => { setMannPicked(prev => ({ ...prev, [key]: u })); setMannSearch(prev => ({ ...prev, [key]: '' })); setMannResults(prev => ({ ...prev, [key]: [] })) }} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14, color: 'var(--lbf-text)', borderBottom: '0.5px solid rgba(var(--lbf-rot-rgb),0.06)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--lbf-rot-rgb),0.04)')}
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
                  style={{ padding: '9px 18px', background: Object.keys(mannPicked).length > 0 ? 'var(--lbf-akzent-grund)' : 'var(--lbf-border-light)', color: Object.keys(mannPicked).length > 0 ? '#fff' : 'var(--warm-gray)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: Object.keys(mannPicked).length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', letterSpacing: '0.04em' }}
                >
                  {savingMannschaft ? 'Speichern…' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Rückfrage stellen — links das Wort, rechts das Protokoll */}
      {rueckfrageModal && (() => {
        const pl = parsePayload((rueckfrageModal as any).payload)
        const patName = [pl.name, pl.vorname].filter(Boolean).join(' ') || rueckfrageModal.title || 'Unbekannt'
        return (
          <Suspense fallback={null}>
            <RueckfrageFenster
              patientId={rueckfrageModal.id}
              titel={patName}
              payload={((rueckfrageModal as any).payload ?? {}) as Record<string, unknown>}
              rolle="fragen"
              name={(user as any)?.name || user?.email || 'Beauftragter'}
              onGeschrieben={() => { loadOpenData(); flash('Rückfrage gesendet', 'success') }}
              onSchliessen={() => setRueckfrageModal(null)}
            />
          </Suspense>
        )
      })()}

      {/* Den Vorgang eines archivierten Protokolls nachlesen — dasselbe
          Fenster wie beim Fragen, nur ohne Schreibfeld. */}
      {nachlesen && (() => {
        const pl = parsePayload((nachlesen as any).payload)
        const patName = [pl.name, pl.vorname].filter(Boolean).join(' ') || nachlesen.title || 'Unbekannt'
        return (
          <Suspense fallback={null}>
            <RueckfrageFenster
              patientId={nachlesen.id}
              titel={patName}
              payload={((nachlesen as any).payload ?? {}) as Record<string, unknown>}
              rolle="lesen"
              name={(user as any)?.name || user?.email}
              onSchliessen={() => setNachlesen(null)}
            />
          </Suspense>
        )
      })()}
    </>
  )
}
