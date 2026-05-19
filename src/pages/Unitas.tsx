import React, { useState, useEffect, useCallback } from 'react'
import PocketBase from 'pocketbase'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getTheme, setTheme, type ThemeMode } from '../lib/theme'

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

  const [greetingPhase, setGreetingPhase] = useState<'loading' | 'servus' | 'name' | 'exit' | 'done'>('loading')

  useEffect(() => {
    // Only start text animation once data has loaded
    if (authLoading || loading) return
    if (greetingPhase === 'loading') { setGreetingPhase('servus'); return }
    if (greetingPhase === 'done') return
    if (greetingPhase === 'servus') {
      const t = setTimeout(() => setGreetingPhase('name'), 800)
      return () => clearTimeout(t)
    }
    if (greetingPhase === 'name') {
      const t = setTimeout(() => setGreetingPhase('exit'), 900)
      return () => clearTimeout(t)
    }
    if (greetingPhase === 'exit') {
      const t = setTimeout(() => setGreetingPhase('done'), 350)
      return () => clearTimeout(t)
    }
  }, [greetingPhase, authLoading, loading])

  const initials = (name?: string) => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Stellungnahme-Modal
  const [snModal, setSnModal] = useState<PatientRecord | null>(null)
  const [snAntworten, setSnAntworten] = useState<Record<string, string>>({})
  const [snSending, setSnSending] = useState<Record<string, boolean>>({})

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

  async function submitStellungnahme(patientId: string, rqId: string) {
    const text = snAntworten[rqId]?.trim()
    if (!text) return
    setSnSending(prev => ({ ...prev, [rqId]: true }))
    try {
      const rec = await pb.collection('patients').getOne(patientId)
      const payload = typeof rec.payload === 'string' ? JSON.parse(rec.payload) : (rec.payload || {})
      const updatedRQ = (Array.isArray(payload.rueckfragen) ? payload.rueckfragen : []).map((rq: any) =>
        rq.id === rqId ? { ...rq, status: 'beantwortet' } : rq
      )
      const newSN = { id: Date.now().toString(), rueckfrage_id: rqId, text, created: new Date().toISOString() }
      const updatedSN = [...(Array.isArray(payload.stellungnahmen) ? payload.stellungnahmen : []), newSN]
      await pb.collection('patients').update(patientId, { payload: { ...payload, rueckfragen: updatedRQ, stellungnahmen: updatedSN } })
      const updated = { ...payload, rueckfragen: updatedRQ, stellungnahmen: updatedSN }
      const patchList = (list: PatientRecord[]) => list.map(p => p.id === patientId ? { ...p, payload: updated } : p)
      setMyPatients(patchList)
      setMyArchivedPatients(patchList)
      if (snModal?.id === patientId) setSnModal(prev => prev ? { ...prev, payload: updated } : prev)
      setSnAntworten(prev => ({ ...prev, [rqId]: '' }))
      showMsg('Stellungnahme übermittelt', 'success')
    } catch (e: any) {
      showMsg('Fehler: ' + e.message, 'error')
    } finally {
      setSnSending(prev => ({ ...prev, [rqId]: false }))
    }
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
  const lernbarBadge = upcomingTermine.length + (progress.length - doneMods)
  const protokolleBadge = myPatients.length + myArchivedPatients.length

  const firstName = user?.name?.split(' ')[0] || ''

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-app)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>

      {/* ── Greeting overlay ── */}
      {greetingPhase !== 'done' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: greetingPhase === 'exit' ? 'greetFadeOut 0.3s ease-in forwards' : 'none',
          userSelect: 'none',
        }}>
          {greetingPhase === 'loading' ? (
            <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#600812', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          ) : greetingPhase === 'servus' ? (
            <div key="servus" style={{
              fontSize: 'clamp(44px, 12vw, 80px)', fontWeight: 700, color: '#1d1d1f',
              letterSpacing: '-0.02em', lineHeight: 1, whiteSpace: 'nowrap',
              fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif",
              animation: 'greetIn 0.45s ease-out both',
            }}>Servus</div>
          ) : (
            <div key="name" style={{
              fontSize: 'clamp(44px, 12vw, 80px)', fontWeight: 700, color: '#600812',
              letterSpacing: '-0.02em', lineHeight: 1, whiteSpace: 'nowrap',
              fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif",
              animation: 'greetIn 0.45s ease-out both',
            }}>{firstName}</div>
          )}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        background: 'var(--bg-card)',
        borderBottom: '0.5px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 100,
        padding: '0 20px',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.svg" alt="" width={28} height={28} style={{ borderRadius: 6, flexShrink: 0 }} />
            <span style={{ fontWeight: 800, fontSize: '0.9375rem', letterSpacing: '-0.02em', color: 'var(--text)' }}>
              {(user as any)?.organization_name || 'Responda'}
            </span>
          </div>
          <button
            onClick={() => setTab('konto')}
            title={user?.name || ''}
            style={{
              width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(140deg, #600812 0%, #8b1120 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif",
              fontWeight: 700, fontSize: 12, color: '#fff', letterSpacing: '0.03em',
              boxShadow: '0 2px 10px rgba(96,8,18,0.4)',
              flexShrink: 0,
            }}
          >{initials(user?.name)}</button>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px calc(80px + env(safe-area-inset-bottom))' }}>

        {/* ÜBERSICHT */}
        {tab === 'uebersicht' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Greeting + date */}
            <div style={{ paddingTop: 4 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Servus, {firstName}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 5, fontWeight: 500 }}>
                {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* Quick-stat cards */}
            {(myPatients.length + myFreigegebenPatients.length + openOutputs > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: openOutputs > 0 && (myPatients.length + myFreigegebenPatients.length) > 0 ? '1fr 1fr' : '1fr', gap: 10 }}>
                {(myPatients.length + myFreigegebenPatients.length) > 0 && (
                  <button onClick={() => setTab('protokolle')} style={{
                    background: 'var(--bg-card)', borderRadius: 14, padding: '16px 18px',
                    border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    borderLeft: '4px solid #600812',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  }}>
                    <div style={{ fontSize: 30, fontWeight: 800, color: '#600812', lineHeight: 1, marginBottom: 4 }}>
                      {myPatients.length + myFreigegebenPatients.length}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Protokoll{(myPatients.length + myFreigegebenPatients.length) !== 1 ? 'e' : ''}
                    </div>
                    {myFreigegebenPatients.length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#600812', fontWeight: 600 }}>
                        {myFreigegebenPatients.length} freigegeben
                      </div>
                    )}
                  </button>
                )}
                {openOutputs > 0 && (
                  <button onClick={() => setTab('vorgaenge')} style={{
                    background: 'var(--bg-card)', borderRadius: 14, padding: '16px 18px',
                    border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    borderLeft: '4px solid #f59e0b',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  }}>
                    <div style={{ fontSize: 30, fontWeight: 800, color: '#d97706', lineHeight: 1, marginBottom: 4 }}>
                      {openOutputs}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Vorgänge
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: '#d97706', fontWeight: 600 }}>
                      offen
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* Neuigkeiten */}
            {neuigkeiten.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#8e8e93', padding: '40px 0', fontSize: 14 }}>
                Keine Neuigkeiten vorhanden
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 4 }}>Neuigkeiten</div>
                {neuigkeiten.map(n => {
                  const anhangUrl = n.anhang ? `https://api.responda.systems/api/files/${n.collectionId}/${n.id}/${n.anhang}` : null
                  return (
                    <div key={n.id} style={{ background: 'var(--bg-card)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                      {n.gepinnt && (
                        <div style={{ background: '#600812', padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/></svg>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Angepinnt</span>
                        </div>
                      )}
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3 }}>{n.titel}</div>
                        {n.inhalt && <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginBottom: anhangUrl ? 10 : 0 }}>{n.inhalt}</div>}
                        {anhangUrl && (
                          <a href={anhangUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text)', fontWeight: 600, fontSize: 13, textDecoration: 'none', marginTop: 4 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Anhang
                          </a>
                        )}
                        <div style={{ fontSize: 11, color: '#8e8e93', marginTop: 8 }}>
                          {new Date(n.created).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          {n.erstellt_von && ` · ${n.erstellt_von}`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* PROTOKOLLE */}
        {tab === 'protokolle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {myPatients.length === 0 && myFreigegebenPatients.length === 0 && myArchivedPatients.length === 0 && (
              <div style={{ textAlign: 'center', color: '#8e8e93', padding: '60px 0', fontSize: 15 }}>Keine Protokolle vorhanden</div>
            )}

            {/* Offen */}
            {myPatients.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 4, paddingBottom: 4 }}>In Bearbeitung</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {[...myPatients].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()).map(p => {
                    const m = p.payload?.mannschaft || {}
                    const crew = ['tf','m1','m2','m3'].map((k: string) => m[k]?.name).filter(Boolean).join(', ')
                    const patName = [p.payload?.vorname, p.payload?.name].filter(Boolean).join(' ')
                    const age = Date.now() - new Date(p.created).getTime()
                    const hoursLeft = Math.max(0, Math.ceil(24 - age / 3600000))
                    const isExpiringSoon = hoursLeft <= 4
                    const isTF = m.tf?.id === user?.id
                    const canEdit = isTF && hoursLeft > 0
                    const allRQs: any[] = Array.isArray(p.payload?.rueckfragen) ? p.payload.rueckfragen : []
                    const openRQs = allRQs.filter((r: any) => r.status === 'offen')
                    return (
                      <div key={p.id} style={{ background: 'var(--bg-card)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                        <div style={{ padding: '13px 16px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)', lineHeight: 1.2 }}>{patName || p.title}</div>
                            {openRQs.length > 0 && (
                              <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                                {openRQs.length} Rückfrage{openRQs.length !== 1 ? 'n' : ''}
                              </span>
                            )}
                          </div>
                          {crew && <div style={{ fontSize: 13, color: '#8e8e93', marginBottom: 4 }}>{crew}</div>}
                          <div style={{ fontSize: 12, color: isExpiringSoon ? '#d97706' : '#8e8e93', fontWeight: isExpiringSoon ? 600 : 400 }}>
                            {new Date(p.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} Uhr
                            {isTF && ` · ${hoursLeft > 0 ? `noch ${hoursLeft}h bearbeitbar` : 'Fenster abgelaufen'}`}
                          </div>
                        </div>
                        {openRQs.length > 0 && (
                          <div style={{ background: '#fffbeb', borderTop: '0.5px solid #fde68a', borderBottom: '0.5px solid #fde68a', padding: '9px 16px' }}>
                            {openRQs.map((rq: any) => (
                              <div key={rq.id} style={{ fontSize: 13, color: '#78350f', lineHeight: 1.45 }}>
                                <span style={{ fontWeight: 600 }}>Rückfrage: </span>{rq.frage}
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ padding: '9px 12px', display: 'flex', gap: 7, background: 'var(--bg-app)', borderTop: openRQs.length > 0 ? 'none' : '0.5px solid var(--border)' }}>
                          {openRQs.length > 0 && (
                            <button onClick={() => setSnModal(p)} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Stellungnahme
                            </button>
                          )}
                          {canEdit && (
                            <>
                              <button onClick={async () => { await pb.collection('patients').update(p.id, { status: 'freigegeben' }); showMsg('Protokoll freigegeben', 'success'); loadPatients() }} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                                Freigeben
                              </button>
                              <button onClick={() => navigate(`/protokoll/${p.id}`)} style={{ background: '#600812', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Bearbeiten</button>
                            </>
                          )}
                          {!canEdit && (
                            <button onClick={() => navigate(`/protokoll/${p.id}`)} style={{ background: 'transparent', color: '#600812', border: '1px solid rgba(96,8,18,0.25)', borderRadius: 8, padding: '7px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Ansehen</button>
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
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 4, paddingBottom: 4 }}>Freigegeben</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {[...myFreigegebenPatients].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()).map(p => {
                    const m = p.payload?.mannschaft || {}
                    const crew = ['tf','m1','m2','m3'].map((k: string) => m[k]?.name).filter(Boolean).join(', ')
                    const patName = [p.payload?.vorname, p.payload?.name].filter(Boolean).join(' ')
                    const allRQs: any[] = Array.isArray(p.payload?.rueckfragen) ? p.payload.rueckfragen : []
                    const openRQs = allRQs.filter((r: any) => r.status === 'offen')
                    const sns: any[] = Array.isArray(p.payload?.stellungnahmen) ? p.payload.stellungnahmen : []
                    const changedCount = (p.payload?._changed_fields || []).length
                    const isTF = m.tf?.id === user?.id
                    const reopen = p.payload?.tf_reopen
                    const reopenActive = reopen && new Date(reopen.expires_at) > new Date()
                    const reopenMinsLeft = reopenActive ? Math.ceil((new Date(reopen.expires_at).getTime() - Date.now()) / 60000) : 0
                    return (
                      <div key={p.id} style={{ background: 'var(--bg-card)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                        <div style={{ padding: '13px 16px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)', lineHeight: 1.2 }}>{patName || p.title}</div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {openRQs.length > 0 && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{openRQs.length} Rückfrage{openRQs.length !== 1 ? 'n' : ''}</span>}
                              {changedCount > 0 && <span style={{ background: '#fef9eb', color: '#b45309', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{changedCount} Änd.</span>}
                              {reopenActive && <span style={{ background: '#f0fdf4', color: '#166534', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Nachbearb.</span>}
                              {!openRQs.length && !changedCount && !reopenActive && <span style={{ background: '#f0fdf4', color: '#166534', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Freigegeben</span>}
                            </div>
                          </div>
                          {crew && <div style={{ fontSize: 13, color: '#8e8e93', marginBottom: 4 }}>{crew}</div>}
                          <div style={{ fontSize: 12, color: '#8e8e93' }}>
                            {new Date(p.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} Uhr
                            {reopenActive && isTF && ` · Nachbearbeitung noch ${reopenMinsLeft >= 60 ? `${Math.ceil(reopenMinsLeft/60)}h` : `${reopenMinsLeft}min`}`}
                          </div>
                        </div>
                        {openRQs.length > 0 && (
                          <div style={{ background: '#fffbeb', borderTop: '0.5px solid #fde68a', borderBottom: '0.5px solid #fde68a', padding: '9px 16px' }}>
                            {openRQs.map((rq: any) => (
                              <div key={rq.id} style={{ fontSize: 13, color: '#78350f', lineHeight: 1.45 }}>
                                <span style={{ fontWeight: 600 }}>Rückfrage: </span>{rq.frage}
                              </div>
                            ))}
                          </div>
                        )}
                        {sns.filter((s: any) => allRQs.some((rq: any) => rq.id === s.rueckfrage_id)).length > 0 && (
                          <div style={{ background: '#f0fdf4', borderTop: '0.5px solid #bbf7d0', borderBottom: '0.5px solid #bbf7d0', padding: '9px 16px' }}>
                            {sns.map((s: any) => (
                              <div key={s.id} style={{ fontSize: 13, color: '#15803d', lineHeight: 1.45 }}>
                                <span style={{ fontWeight: 600 }}>Stellungnahme: </span>
                                <span style={{ color: 'var(--text)' }}>{s.text.length > 80 ? s.text.slice(0, 80) + '…' : s.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ padding: '9px 12px', display: 'flex', gap: 7, background: 'var(--bg-app)', borderTop: (openRQs.length > 0 || sns.length > 0) ? 'none' : '0.5px solid var(--border)' }}>
                          {openRQs.length > 0 && (
                            <button onClick={() => setSnModal(p)} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Stellungnahme
                            </button>
                          )}
                          {reopenActive && isTF ? (
                            <button onClick={() => navigate(`/protokoll/${p.id}`)} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Nachbearbeiten</button>
                          ) : (
                            <button onClick={() => navigate(`/protokoll/${p.id}`)} style={{ background: 'transparent', color: '#600812', border: '1px solid rgba(96,8,18,0.25)', borderRadius: 8, padding: '7px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Ansehen</button>
                          )}
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
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 4, paddingBottom: 4 }}>Archiviert</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...myArchivedPatients].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()).map(p => {
                    const m = p.payload?.mannschaft || {}
                    const crew = ['tf','m1','m2','m3'].map((k: string) => m[k]?.name).filter(Boolean).join(', ')
                    const patName = [p.payload?.vorname, p.payload?.name].filter(Boolean).join(' ')
                    const allRQsA: any[] = Array.isArray(p.payload?.rueckfragen) ? p.payload.rueckfragen : []
                    const openRQsA = allRQsA.filter((r: any) => r.status === 'offen')
                    const snsA: any[] = Array.isArray(p.payload?.stellungnahmen) ? p.payload.stellungnahmen : []
                    const changedCountA = (p.payload?._changed_fields || []).length
                    return (
                      <div key={p.id} style={{ background: 'var(--bg-card)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', opacity: openRQsA.length > 0 || changedCountA > 0 ? 1 : 0.8 }}>
                        <div style={{ padding: '13px 16px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)', lineHeight: 1.2 }}>{patName || p.title}</div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              {openRQsA.length > 0 && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{openRQsA.length} Rückfrage{openRQsA.length !== 1 ? 'n' : ''}</span>}
                              {changedCountA > 0 && <span style={{ background: '#fef9eb', color: '#b45309', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{changedCountA} Änd.</span>}
                              {!openRQsA.length && !changedCountA && <span style={{ background: 'var(--bg-subtle)', color: '#8e8e93', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Archiviert</span>}
                            </div>
                          </div>
                          {crew && <div style={{ fontSize: 13, color: '#8e8e93', marginBottom: 4 }}>{crew}</div>}
                          <div style={{ fontSize: 12, color: '#8e8e93' }}>
                            {new Date(p.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} Uhr
                          </div>
                        </div>
                        {openRQsA.length > 0 && (
                          <div style={{ background: '#fffbeb', borderTop: '0.5px solid #fde68a', borderBottom: '0.5px solid #fde68a', padding: '9px 16px' }}>
                            {openRQsA.map((rq: any) => (
                              <div key={rq.id} style={{ fontSize: 13, color: '#78350f', lineHeight: 1.45 }}>
                                <span style={{ fontWeight: 600 }}>Rückfrage: </span>{rq.frage}
                              </div>
                            ))}
                          </div>
                        )}
                        {snsA.length > 0 && (
                          <div style={{ background: '#f0fdf4', borderTop: '0.5px solid #bbf7d0', borderBottom: '0.5px solid #bbf7d0', padding: '9px 16px' }}>
                            {snsA.map((s: any) => (
                              <div key={s.id} style={{ fontSize: 13, color: '#15803d', lineHeight: 1.45 }}>
                                <span style={{ fontWeight: 600 }}>Stellungnahme: </span>
                                <span style={{ color: 'var(--text)' }}>{s.text.length > 80 ? s.text.slice(0, 80) + '…' : s.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ padding: '9px 12px', display: 'flex', gap: 7, background: 'var(--bg-app)', borderTop: (openRQsA.length > 0 || snsA.length > 0) ? 'none' : '0.5px solid var(--border)' }}>
                          {openRQsA.length > 0 && (
                            <button onClick={() => setSnModal(p)} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Stellungnahme
                            </button>
                          )}
                          <button onClick={() => navigate(`/protokoll/${p.id}`)} style={{ background: 'transparent', color: '#600812', border: '1px solid rgba(96,8,18,0.25)', borderRadius: 8, padding: '7px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Ansehen</button>
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
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 16 }}>Meine Vorgänge</div>
            {myOutputs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)', fontSize: 15 }}>Keine Vorgänge vorhanden</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myOutputs.map(output => {
                  const p = output.payload
                  const deDate = p.datum ? p.datum.split('-').reverse().join('.') : '–'
                  const statusCfg: Record<string, { label: string; bg: string; color: string; border: string }> = {
                    offen:     { label: 'Offen',     bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
                    erledigt:  { label: 'Erledigt',  bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
                    ignoriert: { label: 'Ignoriert', bg: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: 'var(--border)' },
                  }
                  const cfg = statusCfg[output.status] ?? statusCfg['ignoriert']
                  return (
                    <div key={output.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Einsatz {p.einsatz}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{deDate}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 999, padding: '3px 9px' }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {p.positionen.map((pos, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', borderBottom: idx < p.positionen.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                            <span style={{ color: 'var(--text)' }}>{pos.name}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{pos.qty}× {pos.unit ?? ''}</span>
                          </div>
                        ))}
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
            {/* Profile card */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #600812 0%, #9b1b2a 100%)', padding: '24px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#fff', flexShrink: 0 }}>
                  {initials(user?.name)}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>{user?.name}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{user?.email}</div>
                </div>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Kontakt-Email</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="email" value={kontaktEmail} onChange={e => setKontaktEmail(e.target.value)} placeholder="deine@email.de"
                      style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'var(--bg-input)', color: 'var(--text)' }} />
                    <button onClick={saveKontaktEmail} disabled={savingEmail}
                      style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#600812', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: savingEmail ? 0.6 : 1 }}>
                      Speichern
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Passwort</label>
                  <button onClick={sendPasswordReset} disabled={sendingReset}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: sendingReset ? 0.6 : 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Passwort-Reset Email senden
                  </button>
                </div>
                <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Abmelden
                </button>
              </div>
            </div>

            {/* Theme */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Darstellung</div>
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {([
                  { value: 'light',  label: 'Hell',   icon: '☀️', desc: 'Helles Design' },
                  { value: 'dark',   label: 'Dunkel', icon: '🌙', desc: 'Dunkles Design' },
                  { value: 'system', label: 'System', icon: '⚙️', desc: 'Geräteeinstellung' },
                  { value: 'retro',  label: 'Retro',  icon: '📟', desc: 'CRT Terminal' },
                ] as { value: ThemeMode; label: string; icon: string; desc: string }[]).map(opt => (
                  <button key={opt.value} onClick={() => { setTheme(opt.value); setThemeMode(opt.value) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 12,
                      border: themeMode === opt.value ? '2px solid #600812' : '1.5px solid var(--border)',
                      background: themeMode === opt.value ? 'rgba(96,8,18,0.04)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{opt.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{opt.desc}</div>
                    </div>
                    {themeMode === opt.value && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Tab Bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--bg-card)',
        borderTop: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'stretch',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {([
          { id: 'uebersicht', label: 'Übersicht', badge: 0,
            icon: (a: boolean) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? '#600812' : 'none'} stroke={a ? '#600812' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
          { id: 'protokolle', label: 'Protokolle', badge: protokolleBadge,
            icon: (a: boolean) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? '#600812' : 'none'} stroke={a ? '#600812' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
          ...(hasLernbar ? [{ id: 'lernbar', label: 'Lernbar', badge: lernbarBadge,
            icon: (a: boolean) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? '#600812' : 'none'} stroke={a ? '#600812' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> }] : []),
          { id: 'vorgaenge', label: 'Vorgänge', badge: openOutputs,
            icon: (a: boolean) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? '#600812' : 'none'} stroke={a ? '#600812' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
          ...(hasMPG ? [{ id: 'hub', label: 'Hub', badge: 0,
            icon: (a: boolean) => (
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: a ? '#600812' : '#8e8e93',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: '0.03em',
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
                flex: 1, padding: '10px 4px 8px', border: 'none', background: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
                color: active ? '#600812' : '#8e8e93',
              }}
            >
              {t.icon(active)}
              {t.badge > 0 && (
                <span style={{
                  position: 'absolute', top: 6, right: 'calc(50% - 16px)',
                  background: '#600812', color: '#fff',
                  borderRadius: 999, padding: '0 5px', fontSize: 9, fontWeight: 700, minWidth: 14, textAlign: 'center', lineHeight: '15px',
                }}>{t.badge}</span>
              )}
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, lineHeight: 1, color: active ? '#600812' : '#8e8e93' }}>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Toast */}
      {message && (
        <div style={{
          position: 'fixed', bottom: 'calc(76px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          padding: '12px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap',
          background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: message.type === 'success' ? '#166534' : '#b91c1c',
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
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes greetIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes greetFadeOut {
          from { opacity: 1; backdrop-filter: blur(0); }
          to   { opacity: 0; }
        }
        details > summary::-webkit-details-marker { display: none; }
        @media print {
          body > * { display: none !important; }
          #sn-print-area { display: block !important; position: fixed; inset: 0; background: #fff; padding: 32px; z-index: 99999; }
        }
      `}</style>

      {/* Stellungnahme-Modal */}
      {snModal && (() => {
        const pl = snModal.payload || {}
        const rqs: any[] = Array.isArray(pl.rueckfragen) ? pl.rueckfragen : []
        const sns: any[] = Array.isArray(pl.stellungnahmen) ? pl.stellungnahmen : []
        const patName = [pl.vorname, pl.name].filter(Boolean).join(' ') || snModal.title || 'Unbekannt'
        return (
          <>
            {/* Print-only area */}
            <div id="sn-print-area" style={{ display: 'none' }}>
              <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '0 auto' }}>
                <div style={{ borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 20 }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>Stellungnahme zum Protokoll</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>{patName} · {new Date(snModal.created).toLocaleString('de-DE')}</div>
                </div>
                {rqs.map((rq: any, i: number) => {
                  const sn = sns.find((s: any) => s.rueckfrage_id === rq.id)
                  return (
                    <div key={rq.id} style={{ marginBottom: 24, pageBreakInside: 'avoid' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Rückfrage #{i + 1} — {new Date(rq.created).toLocaleString('de-DE')}</div>
                      <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: 14 }}>{rq.frage}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Stellungnahme{sn ? ` — ${new Date(sn.created).toLocaleString('de-DE')}` : ' — ausstehend'}:</div>
                      <div style={{ border: `1px solid ${sn ? '#166534' : '#ccc'}`, borderRadius: 6, padding: '8px 12px', fontSize: 14, minHeight: 48, background: sn ? '#f0fdf4' : '#fafafa' }}>
                        {sn ? sn.text : ''}
                      </div>
                    </div>
                  )
                })}
                <div style={{ marginTop: 40, borderTop: '1px solid #000', paddingTop: 12, fontSize: 12, color: '#555' }}>
                  Ausgedruckt: {new Date().toLocaleString('de-DE')} · {user?.name}
                </div>
              </div>
            </div>

            {/* Modal */}
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px 20px' }}>
              <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
                <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Stellungnahme abgeben</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{patName}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => window.print()} title="Drucken" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      Drucken
                    </button>
                    <button onClick={() => setSnModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1 }}>×</button>
                  </div>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {rqs.map((rq: any, i: number) => {
                    const sn = sns.find((s: any) => s.rueckfrage_id === rq.id)
                    return (
                      <div key={rq.id} style={{ border: `1px solid ${sn ? '#bbf7d0' : '#fcd34d'}`, borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ background: sn ? '#f0fdf4' : '#fffbeb', padding: '10px 14px', borderBottom: `1px solid ${sn ? '#bbf7d0' : '#fcd34d'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>Rückfrage #{i + 1}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: sn ? '#dcfce7' : '#fef9c3', color: sn ? '#166534' : '#92400e', marginLeft: 'auto' }}>
                            {sn ? 'Beantwortet' : 'Offen'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{new Date(rq.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ fontSize: 14, background: 'var(--bg-subtle)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 3 }}>{rq.created_by ? `Frage von ${rq.created_by}:` : 'Frage:'}</div>
                            {rq.frage}
                          </div>
                          {sn ? (
                            <div style={{ fontSize: 14, background: '#dcfce7', borderRadius: 8, padding: '8px 10px', border: '1px solid #bbf7d0', lineHeight: 1.5 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>Deine Stellungnahme:</span>
                                <span style={{ fontSize: 11, color: '#166534' }}>{new Date(sn.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {sn.text}
                            </div>
                          ) : (
                            <>
                              <textarea
                                value={snAntworten[rq.id] || ''}
                                onChange={e => setSnAntworten(prev => ({ ...prev, [rq.id]: e.target.value }))}
                                rows={4}
                                placeholder="Stellungnahme eingeben…"
                                style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid var(--border-medium)', padding: '8px 10px', fontSize: 14, fontFamily: 'inherit', color: 'var(--text)', background: 'var(--bg)', resize: 'vertical' }}
                              />
                              <button
                                onClick={() => submitStellungnahme(snModal.id, rq.id)}
                                disabled={!snAntworten[rq.id]?.trim() || snSending[rq.id]}
                                style={{ padding: '10px', background: !snAntworten[rq.id]?.trim() ? 'var(--bg-subtle)' : '#16a34a', color: !snAntworten[rq.id]?.trim() ? 'var(--text-secondary)' : '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: !snAntworten[rq.id]?.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                              >
                                {snSending[rq.id] ? 'Wird gespeichert…' : 'Stellungnahme absenden'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding: '12px 20px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setSnModal(null)} style={{ padding: '9px 18px', background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
