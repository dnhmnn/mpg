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

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>
        <div style={{ color: 'var(--text-secondary)' }}>Lade...</div>
      </div>
    )
  }

  const upcomingTermine = termine.filter(t => t.status !== 'abgeschlossen' && t.status !== 'abgesagt')
  const doneMods = progress.filter(p => p.abgeschlossen_am).length

  const hasLernbar = user?.supervisor || user?.permissions?.['lernbar'] || (user as any)?.lernbar_access
  const openOutputs = myOutputs.filter(o => o.status === 'offen').length
  const lernbarBadge = upcomingTermine.length + (progress.length - doneMods)
  const protokolleBadge = myPatients.length + myArchivedPatients.length

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
    color: active ? 'var(--text)' : 'var(--text-secondary)',
    borderBottom: active ? '2px solid var(--btn-dark)' : '2px solid transparent',
    marginBottom: '-1px', whiteSpace: 'nowrap' as const
  })

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 100, padding: '0 16px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.svg" alt="Responda" width={32} height={32} />
            <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em', color: 'var(--text)' }}>Responda</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{user?.name?.split(' ')[0]}</span>
            <button onClick={logout} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', color: 'var(--text)', fontFamily: 'inherit' }}>Abmelden</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', borderBottom: '1px solid var(--bg-subtle)' }}>
          <button style={tabStyle(tab === 'uebersicht')} onClick={() => setTab('uebersicht')}>Übersicht</button>
          <button style={tabStyle(tab === 'protokolle')} onClick={() => setTab('protokolle')}>
            Protokolle{myPatients.length + myFreigegebenPatients.length + myArchivedPatients.length > 0 ? ` (${myPatients.length + myFreigegebenPatients.length + myArchivedPatients.length})` : ''}
          </button>
          <button style={tabStyle(tab === 'vorgaenge')} onClick={() => setTab('vorgaenge')}>
            Vorgänge
            {myOutputs.filter(o => o.status === 'offen').length > 0 && (
              <span style={{ marginLeft: '4px', background: '#f59e0b', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }}>
                {myOutputs.filter(o => o.status === 'offen').length}
              </span>
            )}
          </button>
          <button style={tabStyle(tab === 'konto')} onClick={() => setTab('konto')}>Mein Konto</button>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px calc(80px + env(safe-area-inset-bottom))' }}>

        {/* ÜBERSICHT */}
        {tab === 'uebersicht' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
                Servus, {user?.name?.split(' ')[0]}!
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>
            {neuigkeiten.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px 0', fontSize: '15px' }}>Keine Neuigkeiten</div>
            ) : (
              neuigkeiten.map(n => {
                const anhangUrl = n.anhang ? `https://api.responda.systems/api/files/${n.collectionId}/${n.id}/${n.anhang}` : null
                return (
                  <div key={n.id} style={{ background: 'var(--bg-card)', borderRadius: '14px', border: `1px solid ${n.gepinnt ? 'var(--accent)' : 'var(--border)'}`, overflow: 'hidden' }}>
                    {n.gepinnt && (
                      <div style={{ background: 'var(--accent)', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/></svg>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Angepinnt</span>
                      </div>
                    )}
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)', marginBottom: '8px' }}>{n.titel}</div>
                      {n.inhalt && <div style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginBottom: anhangUrl ? '12px' : '0' }}>{n.inhalt}</div>}
                      {anhangUrl && (
                        <a href={anhangUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 600, fontSize: '13px', textDecoration: 'none', marginTop: '4px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          Anhang herunterladen
                        </a>
                      )}
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '12px' }}>
                        {new Date(n.created).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {n.erstellt_von && ` · ${n.erstellt_von}`}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* PROTOKOLLE */}
        {tab === 'protokolle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)' }}>Meine Protokolle</div>

            {myPatients.length === 0 && myFreigegebenPatients.length === 0 && myArchivedPatients.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px 0', fontSize: '15px' }}>Keine Protokolle vorhanden</div>
            )}

            {/* Offen — TF can edit+release within 24h */}
            {myPatients.length > 0 && (
              <>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>In Bearbeitung</div>
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
                  const sns: any[] = Array.isArray(p.payload?.stellungnahmen) ? p.payload.stellungnahmen : []
                  return (
                    <div key={p.id} style={{ background: 'var(--bg-card)', borderRadius: '14px', border: `1px solid ${openRQs.length > 0 ? '#f59e0b' : isExpiringSoon ? '#f97316' : 'var(--border)'}`, overflow: 'hidden' }}>
                      <div style={{ background: 'linear-gradient(135deg, var(--btn-dark) 0%, var(--btn-dark) 100%)', padding: '14px 18px', color: 'var(--btn-dark-text)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '16px' }}>{patName || p.title}</span>
                          {openRQs.length > 0 && <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{openRQs.length} Rückfrage{openRQs.length !== 1 ? 'n' : ''}</span>}
                        </div>
                        {crew && <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{crew}</div>}
                      </div>
                      {openRQs.length > 0 && (
                        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d', padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {openRQs.map((rq: any) => (
                            <div key={rq.id} style={{ fontSize: 13, color: '#78350f', lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 700, color: '#92400e' }}>Rückfrage: </span>{rq.frage}
                            </div>
                          ))}
                          <div style={{ fontSize: 12, color: '#a16207', fontWeight: 600 }}>→ Bitte im Protokoll Stellung nehmen</div>
                        </div>
                      )}
                      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Erstellt: {new Date(p.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr</div>
                          {isTF && <div style={{ fontSize: '12px', marginTop: '3px', fontWeight: 600, color: isExpiringSoon ? '#f97316' : 'var(--text-secondary)' }}>
                            {hoursLeft > 0 ? `Noch ${hoursLeft} Std. bearbeitbar` : 'Bearbeitungsfenster abgelaufen'}
                          </div>}
                        </div>
                        {openRQs.length > 0 && (
                          <button onClick={() => setSnModal(p)} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
                            Stellungnahme ({openRQs.length})
                          </button>
                        )}
                        {canEdit && (
                          <button onClick={async () => {
                            await pb.collection('patients').update(p.id, { status: 'freigegeben' })
                            showMsg('Protokoll freigegeben', 'success')
                            loadPatients()
                          }} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
                            Freigeben
                          </button>
                        )}
                        {canEdit && (
                          <button onClick={() => navigate(`/protokoll/${p.id}`)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>Bearbeiten</button>
                        )}
                        {!canEdit && (
                          <button onClick={() => navigate(`/protokoll/${p.id}`)} style={{ background: 'var(--bg-subtle)', color: 'var(--text)', border: '0.5px solid var(--border-medium)', borderRadius: '8px', padding: '9px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>Ansehen</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {/* Freigegeben — TF can re-edit if reopen active */}
            {myFreigegebenPatients.length > 0 && (
              <>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: myPatients.length > 0 ? '8px' : 0 }}>Freigegeben</div>
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
                    <div key={p.id} style={{ background: 'var(--bg-card)', borderRadius: '14px', border: `1px solid ${openRQs.length > 0 ? '#f59e0b' : reopenActive ? '#16a34a' : 'var(--border)'}`, overflow: 'hidden' }}>
                      <div style={{ background: 'linear-gradient(135deg, #166534, #15803d)', padding: '14px 18px', color: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '16px' }}>{patName || p.title}</span>
                          {openRQs.length > 0 && <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{openRQs.length} Rückfrage{openRQs.length !== 1 ? 'n' : ''}</span>}
                          {changedCount > 0 && <span style={{ background: '#d97706', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{changedCount} Änderung{changedCount !== 1 ? 'en' : ''}</span>}
                          {reopenActive && <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Nachbearbeitung offen</span>}
                        </div>
                        {crew && <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>{crew}</div>}
                      </div>
                      {openRQs.length > 0 && (
                        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d', padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {openRQs.map((rq: any) => (
                            <div key={rq.id} style={{ fontSize: 13, color: '#78350f', lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 700, color: '#92400e' }}>Rückfrage: </span>{rq.frage}
                            </div>
                          ))}
                          <div style={{ fontSize: 12, color: '#a16207', fontWeight: 600 }}>→ Bitte im Protokoll Stellung nehmen</div>
                        </div>
                      )}
                      {sns.filter((s: any) => allRQs.some((rq: any) => rq.id === s.rueckfrage_id)).length > 0 && (
                        <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {sns.map((s: any) => (
                            <div key={s.id} style={{ fontSize: 13, color: '#166534', lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 700 }}>Stellungnahme: </span>
                              <span style={{ color: '#374151' }}>{s.text.length > 100 ? s.text.slice(0, 100) + '…' : s.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(p.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr · Freigegeben</div>
                          {reopenActive && isTF && (
                            <div style={{ fontSize: '12px', marginTop: '3px', fontWeight: 600, color: '#16a34a' }}>
                              Nachbearbeitung: noch {reopenMinsLeft >= 60 ? `${Math.ceil(reopenMinsLeft / 60)}h` : `${reopenMinsLeft}min`}
                            </div>
                          )}
                        </div>
                        {openRQs.length > 0 && (
                          <button onClick={() => setSnModal(p)} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
                            Stellungnahme ({openRQs.length})
                          </button>
                        )}
                        {reopenActive && isTF ? (
                          <button onClick={() => navigate(`/protokoll/${p.id}`)} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>Nachbearbeiten</button>
                        ) : (
                          <button onClick={() => navigate(`/protokoll/${p.id}`)} style={{ background: 'var(--bg-subtle)', color: 'var(--text)', border: '0.5px solid var(--border-medium)', borderRadius: '8px', padding: '9px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>Ansehen</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {/* Archiviert */}
            {myArchivedPatients.length > 0 && (
              <>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: '8px' }}>Archiviert</div>
                {[...myArchivedPatients].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()).map(p => {
                  const m = p.payload?.mannschaft || {}
                  const crew = ['tf','m1','m2','m3'].map((k: string) => m[k]?.name).filter(Boolean).join(', ')
                  const patName = [p.payload?.vorname, p.payload?.name].filter(Boolean).join(' ')
                  const allRQsA: any[] = Array.isArray(p.payload?.rueckfragen) ? p.payload.rueckfragen : []
                  const openRQsA = allRQsA.filter((r: any) => r.status === 'offen')
                  const snsA: any[] = Array.isArray(p.payload?.stellungnahmen) ? p.payload.stellungnahmen : []
                  const changedCountA = (p.payload?._changed_fields || []).length
                  return (
                    <div key={p.id} style={{ background: 'var(--bg-card)', borderRadius: '14px', border: `1px solid ${openRQsA.length > 0 ? '#f59e0b' : 'var(--border)'}`, overflow: 'hidden', opacity: openRQsA.length > 0 || changedCountA > 0 ? 1 : 0.85 }}>
                      <div style={{ background: 'var(--bg-subtle)', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)' }}>{patName || p.title}</span>
                          {openRQsA.length > 0 && <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{openRQsA.length} Rückfrage{openRQsA.length !== 1 ? 'n' : ''}</span>}
                          {changedCountA > 0 && <span style={{ background: '#d97706', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{changedCountA} Änderung{changedCountA !== 1 ? 'en' : ''}</span>}
                        </div>
                        {crew && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{crew}</div>}
                      </div>
                      {openRQsA.length > 0 && (
                        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d', padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {openRQsA.map((rq: any) => (
                            <div key={rq.id} style={{ fontSize: 13, color: '#78350f', lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 700, color: '#92400e' }}>Rückfrage: </span>{rq.frage}
                            </div>
                          ))}
                          <div style={{ fontSize: 12, color: '#a16207', fontWeight: 600 }}>→ Bitte im Protokoll Stellung nehmen</div>
                        </div>
                      )}
                      {snsA.length > 0 && (
                        <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {snsA.map((s: any) => (
                            <div key={s.id} style={{ fontSize: 13, color: '#166534', lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 700 }}>Stellungnahme: </span>
                              <span style={{ color: '#374151' }}>{s.text.length > 100 ? s.text.slice(0, 100) + '…' : s.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ flex: 1, fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {new Date(p.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr · Archiviert
                        </div>
                        {openRQsA.length > 0 && (
                          <button onClick={() => setSnModal(p)} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
                            Stellungnahme ({openRQsA.length})
                          </button>
                        )}
                        <button onClick={() => navigate(`/protokoll/${p.id}`)} style={{ background: 'var(--bg-subtle)', color: 'var(--text)', border: '0.5px solid var(--border-medium)', borderRadius: '8px', padding: '9px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>Ansehen</button>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}


        {tab === 'vorgaenge' && (
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>Meine Produktausgaben</h2>
            {myOutputs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)', fontSize: 15 }}>
                Keine Vorgänge vorhanden
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myOutputs.map(output => {
                  const p = output.payload
                  const deDate = p.datum ? p.datum.split('-').reverse().join('.') : '–'
                  const statusCfg: Record<string, { label: string; bg: string; color: string }> = {
                    offen:     { label: 'Offen',     bg: '#fef9c3', color: '#854d0e' },
                    erledigt:  { label: 'Erledigt',  bg: '#dcfce7', color: '#166534' },
                    ignoriert: { label: 'Ignoriert', bg: 'var(--bg-subtle)', color: 'var(--text-secondary)' },
                  }
                  const cfg = statusCfg[output.status] ?? { label: output.status, bg: 'var(--bg-subtle)', color: 'var(--text-secondary)' }
                  return (
                    <div key={output.id} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--shadow-sm)' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Einsatz {p.einsatz}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{deDate}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, borderRadius: 6, padding: '3px 9px', flexShrink: 0 }}>
                          {cfg.label.toUpperCase()}
                        </span>
                      </div>
                      {/* Status indicator */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 8 }}>
                        {output.status === 'erledigt' ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            <span style={{ fontSize: 13, color: '#166634', fontWeight: 600 }}>Aus dem Lager ausgebucht</span>
                          </>
                        ) : output.status === 'offen' ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>Wartet auf Bearbeitung durch Lager</span>
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Ignoriert</span>
                          </>
                        )}
                      </div>
                      {/* Positions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {p.positionen.map((pos, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '4px 0', borderBottom: idx < p.positionen.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{pos.name}</span>
                            <span style={{ color: 'var(--text-secondary)', flexShrink: 0, marginLeft: 8 }}>{pos.qty}× {pos.unit ?? ''}</span>
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

        {/* MEIN KONTO */}
        {tab === 'konto' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Profil */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, var(--btn-dark) 0%, var(--btn-dark) 100%)', padding: '20px 24px', color: 'var(--btn-dark-text)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '18px', flexShrink: 0 }}>
                  {user?.name?.charAt(0) || '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '17px' }}>{user?.name}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginTop: '2px' }}>Lernbar-Zugang</div>
                </div>
              </div>

              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>Kontakt-Email</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="email"
                      value={kontaktEmail}
                      onChange={e => setKontaktEmail(e.target.value)}
                      placeholder="deine@email.de"
                      style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: 'var(--bg-input)', color: 'var(--text)' }}
                    />
                    <button
                      onClick={saveKontaktEmail}
                      disabled={savingEmail}
                      style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'var(--btn-dark)', color: 'var(--btn-dark-text)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', opacity: savingEmail ? 0.6 : 1 }}
                    >Speichern</button>
                  </div>
                </div>

                {/* Passwort */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>Passwort</label>
                  <button
                    onClick={sendPasswordReset}
                    disabled={sendingReset}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', opacity: sendingReset ? 0.6 : 1 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Passwort-Reset Email senden
                  </button>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>Du erhältst eine Email mit einem Link zum Passwort zurücksetzen.</div>
                </div>
              </div>
            </div>
            {/* Darstellung */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>Darstellung</div>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {([
                  { value: 'light', label: 'Hell', icon: '☀️', desc: 'Helles Design' },
                  { value: 'dark',  label: 'Dunkel', icon: '🌙', desc: 'Dunkles Design' },
                  { value: 'system', label: 'System', icon: '⚙️', desc: 'Geräteeinstellung' },
                  { value: 'retro', label: 'Retro', icon: '📟', desc: 'CRT Terminal — grüner Phosphor' }
                ] as { value: ThemeMode; label: string; icon: string; desc: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setTheme(opt.value); setThemeMode(opt.value) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '12px 14px', borderRadius: '10px',
                      border: themeMode === opt.value ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                      background: themeMode === opt.value ? 'var(--bg-subtle)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      transition: 'all 0.15s', width: '100%'
                    }}
                  >
                    <span style={{ fontSize: '20px', lineHeight: 1 }}>{opt.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{opt.label}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>{opt.desc}</div>
                    </div>
                    {themeMode === opt.value && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--bg-card)', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'stretch',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}>
        {([
          { id: 'uebersicht', label: 'Übersicht', badge: 0, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
          { id: 'protokolle', label: 'Protokolle', badge: protokolleBadge, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
          ...(hasLernbar ? [{ id: 'lernbar', label: 'Lernbar', badge: lernbarBadge, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> }] : []),
          { id: 'vorgaenge', label: 'Vorgänge', badge: openOutputs, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
          { id: 'konto', label: 'Konto', badge: 0, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
        ] as { id: string; label: string; badge: number; icon: React.ReactNode }[]).map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => t.id === 'lernbar' ? navigate('/lernbar') : setTab(t.id as any)}
              style={{
                flex: 1, padding: '8px 4px 6px', border: 'none', background: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
                color: active ? 'var(--accent)' : 'var(--text-secondary)'
              }}
            >
              {t.icon}
              {t.badge > 0 && (
                <span style={{
                  position: 'absolute', top: 6, right: 'calc(50% - 14px)',
                  background: 'var(--accent)', color: '#fff',
                  borderRadius: 999, padding: '0px 5px', fontSize: 9, fontWeight: 700, minWidth: 14, textAlign: 'center'
                }}>{t.badge}</span>
              )}
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, lineHeight: 1 }}>{t.label}</span>
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
        @keyframes slideInUp {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
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
