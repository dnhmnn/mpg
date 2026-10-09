import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import PocketBase from 'pocketbase'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getTheme, setTheme, type ThemeMode } from '../lib/theme'
import { fristEnde, fristRestText } from './public/doku/absenden'
import { offeneRueckfragen } from './public/doku/rueckfrage'
const ProtokollFenster = lazy(() => import('../components/ProtokollFenster'))
const RueckfrageFenster = lazy(() => import('../components/RueckfrageFenster'))

const pb = new PocketBase('https://api.responda.systems')

interface Termin {
  id: string
  start_datetime: string
  status: string
}

interface TerminUser {
  id: string
  termin_id: string
  teilnehmer_id: string
  status: string
}

interface Modul {
  id: string
}

interface ModulProgress {
  id: string
  modul_id: string
  teilnehmer_id: string
  fortschritt_prozent: number
  abgeschlossen_am?: string
}

interface PatientRecord {
  id: string
  title: string
  status: string
  created: string
  payload: any
}

interface ProductOutput {
  id: string
  title: string
  status: 'offen' | 'erledigt' | 'ignoriert' | string
  created: string
  payload: {
    einsatz: string
    datum: string
    user_name?: string
    positionen: Array<{ qty: number; name: string; unit?: string; item_id?: string }>
  }
}

interface DefectReport {
  id: string
  device_name: string
  description: string
  severity: string
  status: 'pending' | 'confirmed' | 'rejected' | string
  reporter_user_id: string
  rejected_reason?: string
  created: string
}

interface Neuigkeit {
  id: string
  titel: string
  inhalt: string
  anhang: string
  organisation_id: string
  erstellt_von: string
  gepinnt: boolean
  created: string
  collectionId: string
}


export default function Unitas() {
  const { user, loading: authLoading, logout } = useAuth()
  const [tab, setTab] = useState<'uebersicht' | 'protokolle' | 'vorgaenge' | 'konto'>('uebersicht')
  const [myOutputs, setMyOutputs] = useState<ProductOutput[]>([])
  const [myReports, setMyReports] = useState<DefectReport[]>([])

  const [termine, setTermine] = useState<Termin[]>([])
  const [terminUser, setTerminUser] = useState<TerminUser[]>([])
  const [module, setModule] = useState<Modul[]>([])
  const [progress, setProgress] = useState<ModulProgress[]>([])
  const [neuigkeiten, setNeuigkeiten] = useState<Neuigkeit[]>([])
  const [myPatients, setMyPatients] = useState<PatientRecord[]>([])
  const [myFreigegebenPatients, setMyFreigegebenPatients] = useState<PatientRecord[]>([])
  const [myArchivedPatients, setMyArchivedPatients] = useState<PatientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getTheme())

  const [showGreeting] = useState(() => {
    const flag = sessionStorage.getItem('justLoggedIn')
    if (flag) { sessionStorage.removeItem('justLoggedIn'); return true }
    return false
  })
  const [greetingGone, setGreetingGone] = useState(false)

  useEffect(() => {
    if (!showGreeting) return
    const t = setTimeout(() => setGreetingGone(true), 2400)
    return () => clearTimeout(t)
  }, [showGreeting])

  const initials = (name?: string) => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  /** Das Protokoll, zu dem gerade Stellung genommen wird. */
  const [snModal, setSnModal] = useState<PatientRecord | null>(null)
  /** Das ganze Protokoll ansehen — in der Gliederung der Maske. */
  const [protokollModal, setProtokollModal] = useState<PatientRecord | null>(null)

  // Konto-Form
  const [kontaktEmail, setKontaktEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

  const loadPatients = useCallback(async () => {
    if (!user?.organization_id) return
    try {
      const isMine = (p: any) => {
        const pl = typeof p.payload === 'string' ? JSON.parse(p.payload) : (p.payload || {})
        return ['tf','m1','m2','m3'].some((k: string) => pl.mannschaft?.[k]?.id === user!.id)
      }
      const [open, freed, archived] = await Promise.all([
        pb.collection('patients').getFullList({ filter: `status = "offen" && organization_id = "${user.organization_id}"`, sort: '-created', requestKey: `unitas-pats-open-${Date.now()}` }),
        pb.collection('patients').getFullList({ filter: `status = "freigegeben" && organization_id = "${user.organization_id}"`, sort: '-created', requestKey: `unitas-pats-freed-${Date.now()}` }),
        pb.collection('patients').getFullList({ filter: `status = "archiviert" && organization_id = "${user.organization_id}"`, sort: '-created', requestKey: `unitas-pats-arch-${Date.now()}` }),
      ])
      setMyPatients((open as any[]).filter(isMine))
      setMyFreigegebenPatients((freed as any[]).filter(isMine))
      setMyArchivedPatients((archived as any[]).filter(isMine))
    } catch { /* ignore */ }
  }, [user])

  useEffect(() => {
    if (user) {
      loadData()
      setKontaktEmail((user as any).contact_email || '')
    }
  }, [user])

  useEffect(() => {
    if (user) loadPatients()
  }, [location.pathname, user])

  useEffect(() => {
    if (!user?.organization_id) return
    pb.collection('patients').subscribe('*', () => { loadPatients() }, { requestKey: null } as any)
    return () => { pb.collection('patients').unsubscribe('*') }
  }, [user, loadPatients])

  function showMsg(text: string, type: 'success' | 'error') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  async function loadData() {
    setLoading(true)
    try {
      // Termine wo der User eingeladen ist
      const tuRecords = await pb.collection('ausbildungen_termine_user').getFullList({
        filter: `teilnehmer_id = "${user!.id}"`,
        requestKey: `lernbar-tu-${Date.now()}`
      })
      setTerminUser(tuRecords as any)

      const terminIds = [...new Set((tuRecords as any[]).map(r => r.termin_id))]
      if (terminIds.length > 0) {
        const terminRecords = await pb.collection('ausbildungen_termine').getFullList({
          filter: terminIds.map(id => `id = "${id}"`).join(' || '),
          sort: 'start_datetime',
          requestKey: `lernbar-termine-${Date.now()}`
        })
        setTermine(terminRecords as any)
      }

      // Lernmodule
      const progressRecords = await pb.collection('ausbildungen_module_progress').getFullList({
        filter: `teilnehmer_id = "${user!.id}"`,
        requestKey: `lernbar-progress-${Date.now()}`
      })
      setProgress(progressRecords as any)

      const modulIds = [...new Set((progressRecords as any[]).map(r => r.modul_id))]
      if (modulIds.length > 0) {
        const modulRecords = await pb.collection('ausbildungen_module').getFullList({
          filter: modulIds.map(id => `id = "${id}"`).join(' || '),
          requestKey: `lernbar-module-${Date.now()}`
        })
        setModule(modulRecords as any)
      }

      // Neuigkeiten
      try {
        const neuigkeitenRecords = await pb.collection('unitas_neuigkeiten').getFullList({
          sort: '-gepinnt,-created',
          requestKey: `lernbar-neuigkeiten-${Date.now()}`
        })
        setNeuigkeiten(neuigkeitenRecords as any)
      } catch {
        // collection may not exist yet
      }

      // Meine Patientenprotokolle (wo ich in der Mannschaft bin)
      await loadPatients()

      // Produktausgaben des Benutzers (client-seitig gefiltert da JSON-Feld)
      try {
        if (user?.organization_id) {
          const outputs = await pb.collection('product_outputs').getFullList({
            filter: `organization_id = "${user.organization_id}"`,
            sort: '-created',
            requestKey: `unitas-outputs-${Date.now()}`,
          })
          setMyOutputs((outputs as any[]).filter(o => o.payload?.user_id === user!.id))
        }
      } catch { /* ignore */ }

      // Defektmeldungen des Benutzers
      try {
        if (user?.organization_id) {
          const reports = await pb.collection('mpg_defect_reports').getFullList({
            filter: `organization_id = "${user.organization_id}"`,
            sort: '-created',
            requestKey: `unitas-reports-${Date.now()}`,
          })
          setMyReports((reports as any[]).filter(r => r.reporter_user_id === user!.id))
        }
      } catch { /* ignore */ }
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function saveKontaktEmail() {
    if (!kontaktEmail.trim()) return
    setSavingEmail(true)
    try {
      await pb.collection('users').update(user!.id, { contact_email: kontaktEmail.trim() }, { requestKey: `email-update-${Date.now()}` })
      showMsg('Email gespeichert', 'success')
    } catch (e: any) {
      showMsg('Fehler: ' + e.message, 'error')
    } finally {
      setSavingEmail(false)
    }
  }

  async function sendPasswordReset() {
    const email = (user as any)?.contact_email || user?.email
    if (!email) { showMsg('Keine Email hinterlegt', 'error'); return }
    setSendingReset(true)
    try {
      await pb.collection('users').requestPasswordReset(email)
      showMsg('Passwort-Reset Email gesendet!', 'success')
    } catch (e: any) {
      showMsg('Fehler: ' + e.message, 'error')
    } finally {
      setSendingReset(false)
    }
  }


  const upcomingTermine = termine.filter(t => t.status !== 'abgeschlossen' && t.status !== 'abgesagt')
  const doneMods = progress.filter(p => p.abgeschlossen_am).length

  const hasLernbar = user?.supervisor || user?.permissions?.['lernbar'] || (user as any)?.lernbar_access
  const hasMPG = user?.supervisor || user?.permissions?.['dashboard']
  const openOutputs = myOutputs.filter(o => o.status === 'offen').length
  const pendingReportsCount = myReports.filter(r => r.status === 'pending').length
  const lernbarBadge = upcomingTermine.length + (progress.length - doneMods)
  const protokolleBadge = myPatients.length + myArchivedPatients.length

  const firstName = user?.name?.split(' ')[0] || ''

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>

      {/* ── Greeting overlay — dark red curtain ── */}
      {showGreeting && !greetingGone && (
        <div className="unitas-greeting-overlay">
          <span style={{ fontSize: 15, fontStyle: 'italic', color: 'rgba(253,232,216,0.5)', letterSpacing: '0.04em', animation: 'greetNameSlide 0.5s ease-out both' }}>Servus,</span>
          <span style={{ fontStyle: 'italic', fontWeight: 700, color: '#fde8d8', fontSize: 'clamp(48px,13vw,80px)', lineHeight: 1, animation: 'greetNameSlide 0.5s 0.12s ease-out both' }}>
            {firstName}
          </span>
        </div>
      )}

      {/* ── Header — masthead ── */}
      <div style={{
        background: 'var(--lbf-card)',
        borderBottom: '0.5px solid rgba(var(--lbf-rot-rgb),0.15)',
        position: 'sticky', top: 0, zIndex: 100,
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'max(20px, env(safe-area-inset-left))',
        paddingRight: 'max(20px, env(safe-area-inset-right))',
      } as React.CSSProperties}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          {/* Left: Responda logo */}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <img src="/logoklein.svg" alt="Responda" style={{ height: 34, width: 34, objectFit: 'contain' }} />
          </div>
          {/* Center: org + date */}
          <div style={{ flex: 1, textAlign: 'center', padding: '0 12px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--text)', lineHeight: 1.2 }}>
              {(user as any)?.organization_name || 'Responda'}
            </div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>
              {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          {/* Right: avatar */}
          <button onClick={() => setTab('konto')} title={user?.name || ''} style={{
            width: 34, height: 34, borderRadius: '50%', border: '1.5px solid var(--lbf-akzent)', cursor: 'pointer',
            background: 'var(--lbf-card)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif",
            fontWeight: 700, fontSize: 12, color: 'var(--lbf-akzent)', letterSpacing: '0.03em', flexShrink: 0,
          }}>{initials(user?.name)}</button>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px calc(88px + env(safe-area-inset-bottom))' }}>

        {/* ÜBERSICHT */}
        {tab === 'uebersicht' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

            {/* Editorial greeting */}
            <div style={{ paddingTop: 4 }}>
              <div style={{ fontStyle: 'italic', color: 'var(--warm-gray)', fontSize: 12, marginBottom: 5, letterSpacing: '0.01em' }}>
                {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Servus, <span style={{ color: 'var(--lbf-akzent)', fontStyle: 'italic' }}>{firstName}</span>
              </div>
            </div>

            {/* Stat cards — editorial big numbers */}
            {(myPatients.length + myFreigegebenPatients.length + openOutputs > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: openOutputs > 0 && (myPatients.length + myFreigegebenPatients.length) > 0 ? '1fr 1fr' : '1fr', gap: 12 }}>
                {(myPatients.length + myFreigegebenPatients.length) > 0 && (
                  <button onClick={() => setTab('protokolle')} style={{
                    background: 'var(--lbf-card)', borderRadius: 12, padding: '18px 20px',
                    border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    boxShadow: 'var(--lbf-shadow)',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Protokolle</div>
                    <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--lbf-akzent)', lineHeight: 1 }}>
                      {myPatients.length + myFreigegebenPatients.length}
                    </div>
                    <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 6 }}>
                      {myFreigegebenPatients.length > 0 ? `${myFreigegebenPatients.length} freigegeben` : 'in Bearbeitung'}
                    </div>
                  </button>
                )}
                {openOutputs > 0 && (
                  <button onClick={() => setTab('vorgaenge')} style={{
                    background: 'var(--lbf-card)', borderRadius: 12, padding: '18px 20px',
                    border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    boxShadow: 'var(--lbf-shadow)',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Vorgänge</div>
                    <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--lbf-akzent)', lineHeight: 1 }}>
                      {openOutputs}
                    </div>
                    <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 6 }}>offen</div>
                  </button>
                )}
              </div>
            )}

            {/* Neuigkeiten */}
            {neuigkeiten.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--warm-gray)', padding: '40px 0', fontSize: 14, fontStyle: 'italic' }}>
                Keine Neuigkeiten vorhanden
              </div>
            ) : (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', paddingLeft: 2 }}>Neuigkeiten</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: -12 }}>
                  {neuigkeiten.map(n => {
                    const anhangUrl = n.anhang ? `https://api.responda.systems/api/files/${n.collectionId}/${n.id}/${n.anhang}` : null
                    return (
                      <div key={n.id} style={{ background: 'var(--lbf-card)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: '3px solid var(--lbf-akzent)' }}>
                        {n.gepinnt && (
                          <div style={{ background: 'var(--lbf-akzent-grund)', padding: '4px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/></svg>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Angepinnt</span>
                          </div>
                        )}
                        <div style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3 }}>{n.titel}</div>
                          {n.inhalt && <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginBottom: anhangUrl ? 10 : 0 }}>{n.inhalt}</div>}
                          {anhangUrl && (
                            <a href={anhangUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '0.5px solid rgba(0,0,0,0.1)', background: 'var(--warm-bg)', color: 'var(--text)', fontWeight: 600, fontSize: 13, textDecoration: 'none', marginTop: 4 }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              Anhang
                            </a>
                          )}
                          <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 8 }}>
                            {new Date(n.created).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                            {n.erstellt_von && ` · ${n.erstellt_von}`}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* PROTOKOLLE */}
        {tab === 'protokolle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {myPatients.length === 0 && myFreigegebenPatients.length === 0 && myArchivedPatients.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--warm-gray)', padding: '60px 0', fontSize: 15, fontStyle: 'italic' }}>Keine Protokolle vorhanden</div>
            )}

            {/* In Bearbeitung */}
            {myPatients.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', paddingLeft: 2, paddingBottom: 6, paddingTop: 4 }}>In Bearbeitung</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {[...myPatients].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()).map(p => {
                    const m = p.payload?.mannschaft || {}
                    const crew = ['tf','m1','m2','m3'].map((k: string) => m[k]?.name).filter(Boolean).join(' · ')
                    const patName = [p.payload?.vorname, p.payload?.name].filter(Boolean).join(' ')
                    // Die Frist steht im Protokoll, vom Absenden an gerechnet;
                    // ältere kennen sie nicht und zählen ab dem Anlegen.
                    const restMs = fristEnde(p.payload || {}, p.created) - Date.now()
                    const fristText = fristRestText(p.payload || {}, p.created)
                    const isExpiringSoon = restMs > 0 && restMs <= 4 * 3600000
                    const isTF = m.tf?.id === user?.id
                    const canEdit = isTF && restMs > 0
                    const openRQs = offeneRueckfragen(p.payload)
                    return (
                      <div key={p.id} style={{ background: 'var(--lbf-card)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--lbf-shadow)', borderLeft: '3px solid var(--lbf-akzent)' }}>
                        <div style={{ padding: '13px 16px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                            <div style={{ fontWeight: 700, fontSize: 17, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1.2 }}>{patName || p.title}</div>
                            {openRQs.length > 0 && (
                              <span style={{ background: 'var(--lbf-warn-grund-2)', color: 'var(--lbf-warn-text)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                                {openRQs.length} Rückfrage{openRQs.length !== 1 ? 'n' : ''}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, fontStyle: 'italic', color: isExpiringSoon ? '#d97706' : 'var(--warm-gray)', fontWeight: isExpiringSoon ? 600 : 400, marginBottom: crew ? 2 : 0 }}>
                            {new Date(p.created).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}
                            {isTF && ` · ${restMs > 0 ? `${fristText} bearbeitbar` : 'Änderungsfrist abgelaufen'}`}
                          </div>
                          {crew && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>{crew}</div>}
                        </div>
                        {openRQs.length > 0 && (
                          <div style={{ background: 'var(--lbf-warn-grund)', borderTop: '0.5px solid #fde68a', borderBottom: '0.5px solid #fde68a', padding: '9px 16px' }}>
                            {openRQs.map((rq: any) => (
                              <div key={rq.id} style={{ fontSize: 13, color: 'var(--lbf-warn-text-3)', lineHeight: 1.45 }}>
                                <span style={{ fontWeight: 600 }}>Rückfrage: </span>{rq.frage}
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ padding: '9px 12px', display: 'flex', gap: 7, background: 'var(--lbf-fuss)', borderTop: '0.5px solid var(--lbf-border-light)' }}>
                          {openRQs.length > 0 && (
                            <button onClick={() => setSnModal(p)} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Stellungnahme
                            </button>
                          )}
                          {canEdit && (
                            <>
                              <button onClick={async () => { await pb.collection('patients').update(p.id, { status: 'freigegeben' }); showMsg('Protokoll freigegeben', 'success'); loadPatients() }} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                                Freigeben
                              </button>
                              <button onClick={() => navigate(`/protokoll/${p.id}`)} style={{ background: 'var(--lbf-akzent-grund)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Bearbeiten</button>
                            </>
                          )}
                          <button onClick={() => setProtokollModal(p)} style={{ background: 'transparent', color: 'var(--lbf-akzent)', border: '1px solid rgba(var(--lbf-rot-rgb),0.3)', borderRadius: 7, padding: '6px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Protokoll</button>
                          {!canEdit && (
                            <button onClick={() => setProtokollModal(p)} style={{ background: 'transparent', color: 'var(--lbf-akzent)', border: '1px solid rgba(var(--lbf-rot-rgb),0.3)', borderRadius: 7, padding: '6px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Ansehen</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Freigegeben */}
            {myFreigegebenPatients.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', paddingLeft: 2, paddingBottom: 6, paddingTop: 4 }}>Freigegeben</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {[...myFreigegebenPatients].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()).map(p => {
                    const m = p.payload?.mannschaft || {}
                    const crew = ['tf','m1','m2','m3'].map((k: string) => m[k]?.name).filter(Boolean).join(' · ')
                    const patName = [p.payload?.vorname, p.payload?.name].filter(Boolean).join(' ')
                    const allRQs: any[] = Array.isArray(p.payload?.rueckfragen) ? p.payload.rueckfragen : []
                    const openRQs = offeneRueckfragen(p.payload)
                    const sns: any[] = Array.isArray(p.payload?.stellungnahmen) ? p.payload.stellungnahmen : []
                    const changedCount = (p.payload?._changed_fields || []).length
                    return (
                      <div key={p.id} style={{ background: 'var(--lbf-card)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--lbf-shadow)', borderLeft: '3px solid #16a34a' }}>
                        <div style={{ padding: '13px 16px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                            <div style={{ fontWeight: 700, fontSize: 17, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1.2 }}>{patName || p.title}</div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {openRQs.length > 0 && <span style={{ background: 'var(--lbf-warn-grund-2)', color: 'var(--lbf-warn-text)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{openRQs.length} Rückfrage{openRQs.length !== 1 ? 'n' : ''}</span>}
                              {changedCount > 0 && <span style={{ background: 'var(--lbf-warn-grund-5)', color: 'var(--lbf-warn-text-2)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{changedCount} Änd.</span>}
                              {!openRQs.length && !changedCount && <span style={{ background: 'var(--lbf-ok-grund)', color: 'var(--lbf-ok-text)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Freigegeben</span>}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginBottom: crew ? 2 : 0 }}>
                            {new Date(p.created).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}
                          </div>
                          {crew && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>{crew}</div>}
                        </div>
                        {openRQs.length > 0 && (
                          <div style={{ background: 'var(--lbf-warn-grund)', borderTop: '0.5px solid #fde68a', borderBottom: '0.5px solid #fde68a', padding: '9px 16px' }}>
                            {openRQs.map((rq: any) => (
                              <div key={rq.id} style={{ fontSize: 13, color: 'var(--lbf-warn-text-3)', lineHeight: 1.45 }}>
                                <span style={{ fontWeight: 600 }}>Rückfrage: </span>{rq.frage}
                              </div>
                            ))}
                          </div>
                        )}
                        {sns.filter((s: any) => allRQs.some((rq: any) => rq.id === s.rueckfrage_id)).length > 0 && (
                          <div style={{ background: 'var(--lbf-ok-grund)', borderTop: '0.5px solid #bbf7d0', borderBottom: '0.5px solid #bbf7d0', padding: '9px 16px' }}>
                            {sns.map((s: any) => (
                              <div key={s.id} style={{ fontSize: 13, color: 'var(--lbf-ok-text-2)', lineHeight: 1.45 }}>
                                <span style={{ fontWeight: 600 }}>Stellungnahme: </span>
                                <span style={{ color: 'var(--text)' }}>{s.text.length > 80 ? s.text.slice(0, 80) + '…' : s.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ padding: '9px 12px', display: 'flex', gap: 7, background: 'var(--lbf-fuss)', borderTop: '0.5px solid rgba(22,163,74,0.15)' }}>
                          {openRQs.length > 0 && (
                            <button onClick={() => setSnModal(p)} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Stellungnahme
                            </button>
                          )}
                          <button onClick={() => setProtokollModal(p)} style={{ background: 'transparent', color: 'var(--lbf-akzent)', border: '1px solid rgba(var(--lbf-rot-rgb),0.3)', borderRadius: 7, padding: '6px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Ansehen</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Archiviert */}
            {myArchivedPatients.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', paddingLeft: 2, paddingBottom: 6, paddingTop: 4 }}>Archiviert</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...myArchivedPatients].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()).map(p => {
                    const m = p.payload?.mannschaft || {}
                    const crew = ['tf','m1','m2','m3'].map((k: string) => m[k]?.name).filter(Boolean).join(' · ')
                    const patName = [p.payload?.vorname, p.payload?.name].filter(Boolean).join(' ')
                    const allRQsA: any[] = Array.isArray(p.payload?.rueckfragen) ? p.payload.rueckfragen : []
                    const openRQsA = offeneRueckfragen(p.payload)
                    const snsA: any[] = Array.isArray(p.payload?.stellungnahmen) ? p.payload.stellungnahmen : []
                    const changedCountA = (p.payload?._changed_fields || []).length
                    return (
                      <div key={p.id} style={{ background: 'var(--lbf-card)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: '3px solid rgba(var(--lbf-grau-rgb),0.4)', opacity: openRQsA.length > 0 || changedCountA > 0 ? 1 : 0.75 }}>
                        <div style={{ padding: '13px 16px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                            <div style={{ fontWeight: 700, fontSize: 17, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1.2 }}>{patName || p.title}</div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              {openRQsA.length > 0 && <span style={{ background: 'var(--lbf-warn-grund-2)', color: 'var(--lbf-warn-text)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{openRQsA.length} Rückfrage{openRQsA.length !== 1 ? 'n' : ''}</span>}
                              {changedCountA > 0 && <span style={{ background: 'var(--lbf-warn-grund-5)', color: 'var(--lbf-warn-text-2)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{changedCountA} Änd.</span>}
                              {!openRQsA.length && !changedCountA && <span style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--warm-gray)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Archiviert</span>}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginBottom: crew ? 2 : 0 }}>
                            {new Date(p.created).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}
                          </div>
                          {crew && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>{crew}</div>}
                        </div>
                        {openRQsA.length > 0 && (
                          <div style={{ background: 'var(--lbf-warn-grund)', borderTop: '0.5px solid #fde68a', borderBottom: '0.5px solid #fde68a', padding: '9px 16px' }}>
                            {openRQsA.map((rq: any) => (
                              <div key={rq.id} style={{ fontSize: 13, color: 'var(--lbf-warn-text-3)', lineHeight: 1.45 }}>
                                <span style={{ fontWeight: 600 }}>Rückfrage: </span>{rq.frage}
                              </div>
                            ))}
                          </div>
                        )}
                        {snsA.length > 0 && (
                          <div style={{ background: 'var(--lbf-ok-grund)', borderTop: '0.5px solid #bbf7d0', borderBottom: '0.5px solid #bbf7d0', padding: '9px 16px' }}>
                            {snsA.map((s: any) => (
                              <div key={s.id} style={{ fontSize: 13, color: 'var(--lbf-ok-text-2)', lineHeight: 1.45 }}>
                                <span style={{ fontWeight: 600 }}>Stellungnahme: </span>
                                <span style={{ color: 'var(--text)' }}>{s.text.length > 80 ? s.text.slice(0, 80) + '…' : s.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ padding: '9px 12px', display: 'flex', gap: 7, background: 'var(--lbf-fuss)', borderTop: '0.5px solid rgba(var(--lbf-grau-rgb),0.15)' }}>
                          {openRQsA.length > 0 && (
                            <button onClick={() => setSnModal(p)} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Stellungnahme
                            </button>
                          )}
                          <button onClick={() => setProtokollModal(p)} style={{ background: 'transparent', color: 'var(--lbf-akzent)', border: '1px solid rgba(var(--lbf-rot-rgb),0.3)', borderRadius: 7, padding: '6px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Ansehen</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* VORGÄNGE */}
        {tab === 'vorgaenge' && (
          <div>
            {/* Produktausgaben */}
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', paddingLeft: 2, marginBottom: 16 }}>Produktausgaben</div>
            {myOutputs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--warm-gray)', fontSize: 14, fontStyle: 'italic' }}>Keine Produktausgaben vorhanden</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myOutputs.map(output => {
                  const p = output.payload
                  const deDate = p.datum ? p.datum.split('-').reverse().join('.') : '–'
                  const statusCfg: Record<string, { label: string; bg: string; color: string; border: string }> = {
                    offen:     { label: 'Offen',     bg: 'var(--lbf-warn-grund)', color: 'var(--lbf-warn-text)', border: '#fde68a' },
                    erledigt:  { label: 'Erledigt',  bg: 'var(--lbf-ok-grund)', color: 'var(--lbf-ok-text)', border: '#bbf7d0' },
                    ignoriert: { label: 'Ignoriert', bg: 'rgba(0,0,0,0.04)', color: 'var(--warm-gray)', border: 'rgba(0,0,0,0.08)' },
                  }
                  const cfg = statusCfg[output.status] ?? statusCfg['ignoriert']
                  return (
                    <div key={output.id} style={{ background: 'var(--lbf-card)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: '3px solid var(--lbf-akzent)' }}>
                      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, fontStyle: 'italic', color: 'var(--text)' }}>Einsatz {p.einsatz}</div>
                          <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 2 }}>{deDate}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 999, padding: '3px 9px' }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {p.positionen.map((pos, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', borderBottom: idx < p.positionen.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none' }}>
                            <span style={{ color: 'var(--text)' }}>{pos.name}</span>
                            <span style={{ fontStyle: 'italic', color: 'var(--warm-gray)' }}>{pos.qty}× {pos.unit ?? ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Defektmeldungen */}
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', paddingLeft: 2, marginTop: 28, marginBottom: 16 }}>Defektmeldungen</div>
            {myReports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--warm-gray)', fontSize: 14, fontStyle: 'italic' }}>Keine Defektmeldungen vorhanden</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myReports.map(report => {
                  const statusCfg: Record<string, { label: string; bg: string; color: string; border: string; borderLeft: string }> = {
                    pending:   { label: 'Ausstehend', bg: 'var(--lbf-warn-grund)', color: 'var(--lbf-warn-text)', border: '#fde68a', borderLeft: '#d97706' },
                    confirmed: { label: 'Bestätigt',  bg: 'var(--lbf-fehler-grund)', color: 'var(--lbf-fehler-text)', border: '#fecaca', borderLeft: '#dc2626' },
                    rejected:  { label: 'Abgelehnt',  bg: 'rgba(0,0,0,0.04)', color: 'var(--warm-gray)', border: 'rgba(0,0,0,0.08)', borderLeft: 'rgba(var(--lbf-grau-rgb),0.35)' },
                  }
                  const cfg = statusCfg[report.status] ?? statusCfg['rejected']
                  return (
                    <div key={report.id} style={{ background: 'var(--lbf-card)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `3px solid ${cfg.borderLeft}` }}>
                      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, fontStyle: 'italic', color: 'var(--text)' }}>{report.device_name}</div>
                          <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 2 }}>
                            {new Date(report.created).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 999, padding: '3px 9px', flexShrink: 0 }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{report.description}</div>
                        {report.status === 'rejected' && report.rejected_reason && (
                          <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 6 }}>Grund: {report.rejected_reason}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* KONTO */}
        {tab === 'konto' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Profile */}
            <div style={{ background: 'var(--lbf-card)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--lbf-shadow)' }}>
              <div style={{ padding: '22px 20px 18px', borderBottom: '0.5px solid rgba(var(--lbf-rot-rgb),0.1)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>Profil</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid var(--lbf-akzent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: 'var(--lbf-akzent)', flexShrink: 0, background: 'rgba(var(--lbf-rot-rgb),0.04)' }}>
                    {initials(user?.name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1.2 }}>{user?.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginTop: 2 }}>{user?.email}</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Kontakt-Email</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="email" value={kontaktEmail} onChange={e => setKontaktEmail(e.target.value)} placeholder="deine@email.de"
                      style={{ flex: 1, padding: '10px 14px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-input)', color: 'var(--text)' }} />
                    <button onClick={saveKontaktEmail} disabled={savingEmail}
                      style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--lbf-akzent-grund)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: savingEmail ? 0.6 : 1 }}>
                      Speichern
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Passwort</label>
                  <button onClick={sendPasswordReset} disabled={sendingReset}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: 'var(--lbf-card)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: sendingReset ? 0.6 : 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Passwort-Reset Email senden
                  </button>
                </div>
                <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, border: '1px solid #fecaca', background: 'var(--lbf-fehler-grund)', color: 'var(--lbf-fehler-text-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Abmelden
                </button>
              </div>
            </div>

            {/* Theme */}
            <div style={{ background: 'var(--lbf-card)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--lbf-shadow)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(var(--lbf-rot-rgb),0.1)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Darstellung</div>
              </div>
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {([
                  { value: 'light',  label: 'Hell',   desc: 'Helles Design',
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> },
                  { value: 'dark',   label: 'Dunkel', desc: 'Dunkles Design',
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
                  { value: 'system', label: 'System', desc: 'Geräteeinstellung',
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
                  { value: 'retro',  label: 'Retro',  desc: 'CRT Terminal',
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg> },
                ] as { value: ThemeMode; label: string; icon: React.ReactNode; desc: string }[]).map(opt => (
                  <button key={opt.value} onClick={() => { setTheme(opt.value); setThemeMode(opt.value) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10,
                      border: themeMode === opt.value ? '1.5px solid var(--lbf-akzent)' : '1px solid rgba(0,0,0,0.08)',
                      background: themeMode === opt.value ? 'rgba(var(--lbf-rot-rgb),0.04)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}>
                    <span style={{ lineHeight: 1, color: themeMode === opt.value ? 'var(--lbf-akzent)' : 'var(--warm-gray)', flexShrink: 0 }}>{opt.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{opt.label}</div>
                      <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 1 }}>{opt.desc}</div>
                    </div>
                    {themeMode === opt.value && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--lbf-akzent)' }} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Tab Bar — editorial ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--lbf-card)',
        borderTop: '0.5px solid var(--lbf-border)',
        display: 'flex', alignItems: 'stretch',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {([
          { id: 'uebersicht', label: 'Übersicht', badge: 0,
            icon: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" style={{ fill: a ? 'var(--lbf-akzent)' : 'none', stroke: a ? 'var(--lbf-akzent)' : 'var(--warm-gray)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
          { id: 'protokolle', label: 'Protokolle', badge: protokolleBadge,
            icon: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" style={{ fill: a ? 'var(--lbf-akzent)' : 'none', stroke: a ? 'var(--lbf-akzent)' : 'var(--warm-gray)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
          ...(hasLernbar ? [{ id: 'lernbar', label: 'Lernbar', badge: lernbarBadge,
            icon: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" style={{ fill: a ? 'var(--lbf-akzent)' : 'none', stroke: a ? 'var(--lbf-akzent)' : 'var(--warm-gray)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> }] : []),
          { id: 'vorgaenge', label: 'Vorgänge', badge: openOutputs + pendingReportsCount,
            icon: (a: boolean) => <svg width="20" height="20" viewBox="0 0 24 24" style={{ fill: a ? 'var(--lbf-akzent)' : 'none', stroke: a ? 'var(--lbf-akzent)' : 'var(--warm-gray)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
          ...(hasMPG ? [{ id: 'hub', label: 'Hub', badge: 0,
            icon: (a: boolean) => (
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: a ? 'var(--lbf-akzent-grund)' : 'transparent',
                border: a ? 'none' : '1.5px solid var(--warm-gray)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 700, color: a ? '#fff' : 'var(--warm-gray)', letterSpacing: '0.03em',
                flexShrink: 0,
              }}>{initials(user?.name)}</div>
            ) }] : []),
        ] as { id: string; label: string; badge: number; icon: (active: boolean) => React.ReactNode }[]).map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => t.id === 'lernbar' || t.id === 'hub' ? navigate(`/${t.id}`) : setTab(t.id as any)}
              style={{
                flex: 1, padding: '0 4px 8px', border: 'none', background: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
                color: active ? 'var(--lbf-akzent)' : 'var(--warm-gray)',
                borderTop: active ? '2px solid var(--lbf-akzent)' : '2px solid transparent',
                paddingTop: 10,
              }}
            >
              {t.icon(active)}
              {t.badge > 0 && (
                <span style={{
                  position: 'absolute', top: 6, right: 'calc(50% - 16px)',
                  background: 'var(--lbf-akzent-grund)', color: '#fff',
                  borderRadius: 999, padding: '0 5px', fontSize: 9, fontWeight: 700, minWidth: 14, textAlign: 'center', lineHeight: '15px',
                }}>{t.badge}</span>
              )}
              <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1, color: active ? 'var(--lbf-akzent)' : 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Toast */}
      {message && (
        <div style={{
          position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          padding: '12px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap',
          background: message.type === 'success' ? 'var(--lbf-ok-grund)' : 'var(--lbf-fehler-grund)',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: message.type === 'success' ? 'var(--lbf-ok-text)' : 'var(--lbf-fehler-text-2)',
          animation: 'slideInUp 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
        }}>
          {message.text}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        @keyframes slideInUp {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
        @keyframes greetCurtainOut { 0%,60%{opacity:1} 100%{opacity:0} }
        @keyframes greetNameSlide { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
        .unitas-greeting-overlay {
          position:fixed;inset:0;z-index:9999;background:#3d0408;
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
          animation:greetCurtainOut 2.4s ease forwards;pointer-events:none;
          font-family:'Atkinson Hyperlegible',-apple-system,sans-serif;
        }
        details > summary::-webkit-details-marker { display: none; }
      `}</style>

      {/* Das Protokoll ansehen — in der Maske, in der es erfasst wurde */}
      {protokollModal && (() => {
        const pl = (protokollModal.payload || {}) as Record<string, unknown>
        const name = [pl.vorname, pl.name].filter(Boolean).join(' ') || protokollModal.title || 'Protokoll'
        return (
          <Suspense fallback={null}>
            <ProtokollFenster
              patientId={protokollModal.id} payload={pl} titel={name}
              onSchliessen={() => setProtokollModal(null)}
            />
          </Suspense>
        )
      })()}

      {/* Stellungnahme — links die Rückfrage, rechts das Protokoll mit den
          angetippten Feldern. Geändert wird am Protokoll nichts. */}
      {snModal && (() => {
        const pl = (snModal.payload || {}) as Record<string, unknown>
        const name = [pl.vorname, pl.name].filter(Boolean).join(' ') || snModal.title || 'Protokoll'
        return (
          <Suspense fallback={null}>
            <RueckfrageFenster
              patientId={snModal.id} titel={name} payload={pl}
              rolle="antworten"
              name={(user as any)?.name || user?.email}
              onGeschrieben={() => { showMsg('Stellungnahme übermittelt', 'success'); loadPatients() }}
              onSchliessen={() => setSnModal(null)}
            />
          </Suspense>
        )
      })()}
    </div>
  )
}
