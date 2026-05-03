import React, { useState, useEffect } from 'react'
import PocketBase from 'pocketbase'
import { useAuth } from '../hooks/useAuth'
import { getTheme, setTheme, type ThemeMode } from '../lib/theme'

const pb = new PocketBase('https://api.responda.systems')

function parseDate(str: string | null | undefined): Date {
  if (!str) return new Date(NaN)
  let s = str.trim().replace(' ', 'T')
  if (!s.endsWith('Z') && !s.includes('+') && !/ [+-]\d{2}:\d{2}$/.test(s)) s += 'Z'
  return new Date(s)
}
function fmtDate(str: string | null | undefined): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return '–'
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtTime(str: string | null | undefined): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

interface Termin {
  id: string
  name: string
  description: string
  start_datetime: string
  end_datetime: string
  location: string
  dozent: string
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
  name: string
  beschreibung: string
  inhalte: { typ: string; titel: string; inhalt: string; reihenfolge: number }[]
  dauer_minuten: number
}

interface ModulProgress {
  id: string
  modul_id: string
  teilnehmer_id: string
  fortschritt_prozent: number
  abgeschlossen_am?: string
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

function toICSDate(str: string): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function CalendarButtons({ termin }: { termin: Termin }) {
  const start = toICSDate(termin.start_datetime)
  const end = termin.end_datetime ? toICSDate(termin.end_datetime) : start

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(termin.name)}` +
    `&dates=${start}/${end}` +
    `&details=${encodeURIComponent(termin.description || '')}` +
    `&location=${encodeURIComponent(termin.location || '')}`

  function downloadICS() {
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Responda//Lernbar//DE',
      'BEGIN:VEVENT',
      `DTSTART:${start}`, `DTEND:${end}`,
      `SUMMARY:${termin.name}`,
      `DESCRIPTION:${(termin.description || '').replace(/\n/g, '\\n')}`,
      `LOCATION:${termin.location || ''}`,
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n')
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${termin.name.replace(/\s+/g, '_')}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
      <a href={googleUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 600, fontSize: '12px', textDecoration: 'none', fontFamily: 'inherit' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Google
      </a>
      <button onClick={downloadICS} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Apple / iCal
      </button>
    </div>
  )
}

export default function Lernbar() {
  const { user, loading: authLoading, logout } = useAuth()
  const [tab, setTab] = useState<'termine' | 'lernmodule' | 'neuigkeiten' | 'konto'>('termine')

  const [termine, setTermine] = useState<Termin[]>([])
  const [terminUser, setTerminUser] = useState<TerminUser[]>([])
  const [module, setModule] = useState<Modul[]>([])
  const [progress, setProgress] = useState<ModulProgress[]>([])
  const [neuigkeiten, setNeuigkeiten] = useState<Neuigkeit[]>([])
  const [loading, setLoading] = useState(true)

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getTheme())

  // Modul-Player
  const [playerProgress, setPlayerProgress] = useState<ModulProgress | null>(null)
  const [playerStep, setPlayerStep] = useState<'intro' | number>('intro')
  const [quizSelected, setQuizSelected] = useState<number | null>(null)
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [modulFailed, setModulFailed] = useState(false)

  // Konto-Form
  const [kontaktEmail, setKontaktEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

  useEffect(() => {
    if (user) {
      loadData()
      setKontaktEmail((user as any).contact_email || '')
    }
  }, [user])

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
        const neuigkeitenRecords = await pb.collection('lernbar_neuigkeiten').getFullList({
          sort: '-gepinnt,-created',
          requestKey: `lernbar-neuigkeiten-${Date.now()}`
        })
        setNeuigkeiten(neuigkeitenRecords as any)
      } catch {
        // collection may not exist yet
      }
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function updateTerminStatus(terminUserId: string, status: 'zugesagt' | 'abgesagt') {
    try {
      await pb.collection('ausbildungen_termine_user').update(terminUserId, { status }, { requestKey: `tu-update-${Date.now()}` })
      setTerminUser(prev => prev.map(t => t.id === terminUserId ? { ...t, status } : t))
      showMsg(status === 'zugesagt' ? 'Zugesagt!' : 'Abgesagt', 'success')
    } catch (e: any) {
      showMsg('Fehler: ' + e.message, 'error')
    }
  }

  async function markModulDone(progressId: string) {
    try {
      await pb.collection('ausbildungen_module_progress').update(progressId, {
        abgeschlossen_am: new Date().toISOString(),
        fortschritt_prozent: 100
      }, { requestKey: `mod-done-${Date.now()}` })
      setProgress(prev => prev.map(p => p.id === progressId ? { ...p, abgeschlossen_am: new Date().toISOString(), fortschritt_prozent: 100 } : p))
      showMsg('Modul als abgeschlossen markiert!', 'success')
    } catch (e: any) {
      showMsg('Fehler: ' + e.message, 'error')
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
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Lade...</div>
      </div>
    )
  }

  const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
    zugesagt:   { label: 'Zugesagt',   bg: '#dcfce7', color: '#166534' },
    abgesagt:   { label: 'Abgesagt',   bg: '#fee2e2', color: '#991b1b' },
    eingeladen: { label: 'Eingeladen', bg: 'var(--bg-subtle)', color: 'var(--text-secondary)' },
    da:         { label: 'Anwesend',   bg: '#dbeafe', color: '#1e40af' },
    fehlend:    { label: 'Gefehlt',    bg: '#fef3c7', color: '#92400e' },
  }

  const upcomingTermine = termine.filter(t => t.status !== 'abgeschlossen' && t.status !== 'abgesagt')
  const pastTermine = termine.filter(t => t.status === 'abgeschlossen')
  const doneMods = progress.filter(p => p.abgeschlossen_am).length

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
    color: active ? 'var(--text)' : 'var(--text-secondary)',
    borderBottom: active ? '2px solid var(--btn-dark)' : '2px solid transparent',
    marginBottom: '-1px', whiteSpace: 'nowrap'
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-subtle)', padding: '0 20px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <svg width="120" height="28" viewBox="0 0 140 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#0f172a"/>
            <path d="M8 10h10a6 6 0 0 1 0 12H8V10z" fill="none" stroke="white" strokeWidth="2"/>
            <circle cx="18" cy="16" r="3" fill="white"/>
            <text x="40" y="22" fontFamily="system-ui,-apple-system,sans-serif" fontWeight="700" fontSize="18" fill="#0f172a" letterSpacing="-0.5">responda</text>
          </svg>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{user?.name}</span>
            <button onClick={logout} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', color: 'var(--text)', fontFamily: 'inherit' }}>Abmelden</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', borderBottom: '1px solid var(--bg-subtle)' }}>
          <button style={tabStyle(tab === 'termine')} onClick={() => setTab('termine')}>
            Termine {upcomingTermine.length > 0 && <span style={{ marginLeft: '4px', background: 'var(--btn-dark)', color: 'var(--btn-dark-text)', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }}>{upcomingTermine.length}</span>}
          </button>
          <button style={tabStyle(tab === 'lernmodule')} onClick={() => setTab('lernmodule')}>
            Lernmodule {progress.length > 0 && <span style={{ marginLeft: '4px', background: doneMods === progress.length ? '#16a34a' : 'var(--btn-dark)', color: 'var(--btn-dark-text)', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }}>{doneMods}/{progress.length}</span>}
          </button>
          <button style={tabStyle(tab === 'neuigkeiten')} onClick={() => setTab('neuigkeiten')}>
            Neuigkeiten {neuigkeiten.length > 0 && <span style={{ marginLeft: '4px', background: 'var(--btn-dark)', color: 'var(--btn-dark-text)', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }}>{neuigkeiten.length}</span>}
          </button>
          <button style={tabStyle(tab === 'konto')} onClick={() => setTab('konto')}>Mein Konto</button>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Begrüßung */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
            Servus, {user?.name?.split(' ')[0]}!
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* TERMINE */}
        {tab === 'termine' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {upcomingTermine.length === 0 && pastTermine.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px 0', fontSize: '15px' }}>Keine Termine zugewiesen</div>
            )}

            {upcomingTermine.map(termin => {
              const tu = terminUser.find(t => t.termin_id === termin.id)
              const cfg = tu ? statusConfig[tu.status] : null
              const startTime = fmtTime(termin.start_datetime)
              const endTime = termin.end_datetime ? fmtTime(termin.end_datetime) : ''
              return (
                <div key={termin.id} style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ background: 'linear-gradient(135deg, var(--btn-dark) 0%, var(--btn-dark) 100%)', padding: '16px 20px', color: 'var(--btn-dark-text)' }}>
                    <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px' }}>{termin.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {fmtDate(termin.start_datetime)}
                      </div>
                      {startTime && (
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {startTime}{endTime ? ` – ${endTime}` : ''} Uhr
                        </div>
                      )}
                      {termin.location && (
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          {termin.location}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: '14px 20px' }}>
                    {termin.description && (
                      <div style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '14px', lineHeight: 1.5 }}>{termin.description}</div>
                    )}
                    {termin.dozent && (
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>Dozent: {termin.dozent}</div>
                    )}

                    {tu && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                          {cfg && (
                            <span style={{ padding: '4px 12px', borderRadius: '20px', background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '13px' }}>{cfg.label}</span>
                          )}
                          {(tu.status === 'eingeladen' || tu.status === 'abgesagt' || tu.status === 'zugesagt') && (
                            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                              {tu.status !== 'zugesagt' && (
                                <button
                                  onClick={() => updateTerminStatus(tu.id, 'zugesagt')}
                                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
                                >Zusagen</button>
                              )}
                              {tu.status !== 'abgesagt' && (
                                <button
                                  onClick={() => updateTerminStatus(tu.id, 'abgesagt')}
                                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
                                >Absagen</button>
                              )}
                            </div>
                          )}
                        </div>
                        {tu.status === 'zugesagt' && <CalendarButtons termin={termin} />}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {pastTermine.length > 0 && (
              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '14px', color: 'var(--text-secondary)', padding: '10px 0', borderTop: '1px solid var(--border)', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                  Vergangene Termine ({pastTermine.length})
                </summary>
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pastTermine.map(termin => {
                    const tu = terminUser.find(t => t.termin_id === termin.id)
                    const cfg = tu ? statusConfig[tu.status] : null
                    return (
                      <div key={termin.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{termin.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{fmtDate(termin.start_datetime)}</div>
                        </div>
                        {cfg && <span style={{ padding: '3px 10px', borderRadius: '20px', background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '12px' }}>{cfg.label}</span>}
                      </div>
                    )
                  })}
                </div>
              </details>
            )}
          </div>
        )}

        {/* LERNMODULE */}
        {tab === 'lernmodule' && !playerProgress && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {progress.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px 0', fontSize: '15px' }}>Noch keine Lernmodule zugewiesen</div>
            )}

            {progress.length > 0 && (
              <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px 20px', border: '1px solid var(--border)', marginBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>Gesamtfortschritt</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{doneMods}/{progress.length} abgeschlossen</span>
                </div>
                <div style={{ background: 'var(--border)', borderRadius: '6px', height: '8px' }}>
                  <div style={{ background: 'var(--btn-dark)', borderRadius: '6px', height: '8px', width: `${Math.round((doneMods / progress.length) * 100)}%`, transition: 'width 0.3s' }} />
                </div>
              </div>
            )}

            {progress.map(p => {
              const mod = module.find(m => m.id === p.modul_id)
              if (!mod) return null
              const isDone = !!p.abgeschlossen_am
              return (
                <div key={p.id} style={{ background: 'var(--bg-card)', borderRadius: '14px', border: `1px solid ${isDone ? '#bbf7d0' : 'var(--border)'}`, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: isDone ? '#10b981' : '#cbd5e1' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>{mod.name}</div>
                      {mod.beschreibung && <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{mod.beschreibung}</div>}
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{mod.dauer_minuten} Min · {mod.inhalte?.length || 0} Blöcke</div>
                    </div>
                    {isDone ? (
                      <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: '#dcfce7', color: '#065f46' }}>Fertig</span>
                    ) : (
                      <button
                        onClick={() => { setPlayerProgress(p); setPlayerStep('intro'); setQuizSelected(null); setQuizSubmitted(false); setModulFailed(false) }}
                        style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--btn-dark)', color: 'var(--btn-dark-text)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
                      >Starten</button>
                    )}
                  </div>
                  {isDone && (
                    <div style={{ padding: '0 20px 14px 20px', fontSize: '12px', color: '#059669' }}>
                      Abgeschlossen am {new Date(p.abgeschlossen_am!).toLocaleDateString('de-DE')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* MODUL PLAYER */}
        {tab === 'lernmodule' && playerProgress && (() => {
          const mod = module.find(m => m.id === playerProgress.modul_id)
          if (!mod) return null
          const blocks = [...(mod.inhalte || [])].sort((a, b) => a.reihenfolge - b.reihenfolge)
          const totalBlocks = blocks.length
          const isLast = typeof playerStep === 'number' && playerStep === totalBlocks - 1

          function resetPlayer() {
            setPlayerProgress(null)
            setPlayerStep('intro')
            setQuizSelected(null)
            setQuizSubmitted(false)
            setModulFailed(false)
          }

          function nextBlock() {
            setQuizSelected(null)
            setQuizSubmitted(false)
            setModulFailed(false)
            if (playerStep === 'intro') { setPlayerStep(0); return }
            if (typeof playerStep === 'number') {
              if (isLast) { markModulDone(playerProgress.id); resetPlayer() }
              else setPlayerStep(playerStep + 1)
            }
          }

          const currentBlock = typeof playerStep === 'number' ? blocks[playerStep] : null
          let quiz: any = null
          if (currentBlock?.typ === 'quiz') {
            try { quiz = JSON.parse(currentBlock.inhalt) } catch {}
          }

          return (
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              {/* Player header */}
              <div style={{ background: 'linear-gradient(135deg, var(--btn-dark) 0%, var(--btn-dark) 100%)', padding: '16px 20px', color: 'var(--btn-dark-text)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={resetPlayer} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{mod.name}</div>
                  {playerStep !== 'intro' && (
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                      Block {(playerStep as number) + 1} von {totalBlocks}
                    </div>
                  )}
                </div>
                {playerStep !== 'intro' && totalBlocks > 0 && (
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                    {Math.round(((playerStep as number) / totalBlocks) * 100)}%
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {playerStep !== 'intro' && totalBlocks > 0 && (
                <div style={{ background: 'var(--border)', height: '3px' }}>
                  <div style={{ background: 'var(--btn-dark)', height: '3px', width: `${Math.round(((playerStep as number) / totalBlocks) * 100)}%`, transition: 'width 0.3s' }} />
                </div>
              )}

              <div style={{ padding: '24px 20px' }}>

                {/* INTRO */}
                {playerStep === 'intro' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--text)', marginBottom: '8px' }}>{mod.name}</div>
                      {mod.beschreibung && <div style={{ fontSize: '15px', color: 'var(--text)', lineHeight: 1.6 }}>{mod.beschreibung}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '12px 16px', flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{mod.dauer_minuten}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Minuten</div>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '12px 16px', flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{totalBlocks}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Blöcke</div>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '12px 16px', flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#7c3aed' }}>{blocks.filter(b => b.typ === 'quiz').length}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Quiz</div>
                      </div>
                    </div>
                    {blocks.filter(b => b.typ === 'quiz').length > 0 && (
                      <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: '#92400e' }}>
                        Dieses Modul enthält Quiz-Fragen. Alle müssen richtig beantwortet werden.
                      </div>
                    )}
                    <button onClick={nextBlock} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: 'var(--btn-dark)', color: 'var(--btn-dark-text)', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit', marginTop: '4px' }}>
                      Starten
                    </button>
                  </div>
                )}

                {/* TEXT BLOCK */}
                {currentBlock?.typ === 'text' && (
                  <div>
                    {currentBlock.titel && <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text)', marginBottom: '14px' }}>{currentBlock.titel}</div>}
                    <div style={{ fontSize: '15px', color: 'var(--text)', lineHeight: 1.75, whiteSpace: 'pre-wrap', marginBottom: '24px' }}>{currentBlock.inhalt}</div>
                    <button onClick={nextBlock} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: 'var(--btn-dark)', color: 'var(--btn-dark-text)', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {isLast ? 'Abschließen' : 'Weiter'}
                    </button>
                  </div>
                )}

                {/* QUIZ BLOCK */}
                {currentBlock?.typ === 'quiz' && quiz && (
                  <div>
                    {currentBlock.titel && <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text)', marginBottom: '14px' }}>{currentBlock.titel}</div>}
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Quiz</div>
                    <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--text)', marginBottom: '16px', lineHeight: 1.5 }}>{quiz.frage}</div>

                    {modulFailed ? (
                      <div>
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: '16px', color: '#b91c1c', marginBottom: '6px' }}>Falsch!</div>
                          <div style={{ fontSize: '14px', color: '#991b1b' }}>Das Modul muss neu gestartet werden.</div>
                        </div>
                        <button
                          onClick={() => { setPlayerStep('intro'); setQuizSelected(null); setQuizSubmitted(false); setModulFailed(false) }}
                          style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: 'var(--btn-dark)', color: 'var(--btn-dark-text)', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}
                        >Neu starten</button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                          {quiz.antworten?.map((a: string, idx: number) => {
                            let bg = 'var(--bg-card)', border = '1px solid var(--border)', color = 'var(--text)'
                            if (quizSubmitted) {
                              if (idx === quiz.richtige) { bg = '#f0fdf4'; border = '2px solid #16a34a'; color = '#166534' }
                              else if (idx === quizSelected) { bg = '#fef2f2'; border = '2px solid #ef4444'; color = '#b91c1c' }
                            } else if (idx === quizSelected) {
                              bg = '#eff6ff'; border = '2px solid #3b82f6'; color = '#1d4ed8'
                            }
                            return (
                              <button
                                key={idx}
                                disabled={quizSubmitted}
                                onClick={() => setQuizSelected(idx)}
                                style={{ padding: '12px 16px', borderRadius: '10px', border, background: bg, color, fontWeight: idx === quizSelected || (quizSubmitted && idx === quiz.richtige) ? 700 : 400, fontSize: '14px', cursor: quizSubmitted ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                              >{a}</button>
                            )
                          })}
                        </div>

                        {!quizSubmitted ? (
                          <button
                            disabled={quizSelected === null}
                            onClick={() => {
                              setQuizSubmitted(true)
                              if (quizSelected !== quiz.richtige) setModulFailed(true)
                            }}
                            style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: quizSelected === null ? 'var(--border)' : 'var(--btn-dark)', color: quizSelected === null ? 'var(--text-secondary)' : 'var(--btn-dark-text)', fontWeight: 700, fontSize: '15px', cursor: quizSelected === null ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                          >Antworten</button>
                        ) : quizSelected === quiz.richtige ? (
                          <div>
                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px', textAlign: 'center', marginBottom: '14px', fontWeight: 700, color: '#166534' }}>
                              Richtig!
                            </div>
                            <button onClick={nextBlock} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>
                              {isLast ? 'Abschließen' : 'Weiter'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* NEUIGKEITEN */}
        {tab === 'neuigkeiten' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {neuigkeiten.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px 0', fontSize: '15px' }}>Noch keine Neuigkeiten</div>
            )}
            {neuigkeiten.map(n => {
              const anhangUrl = n.anhang
                ? `https://api.responda.systems/api/files/${n.collectionId}/${n.id}/${n.anhang}`
                : null
              return (
                <div key={n.id} style={{ background: 'var(--bg-card)', borderRadius: '14px', border: `1px solid ${n.gepinnt ? 'var(--accent)' : 'var(--border)'}`, overflow: 'hidden' }}>
                  {n.gepinnt && (
                    <div style={{ background: 'var(--accent)', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#fff' }}><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/></svg>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Angepinnt</span>
                    </div>
                  )}
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)', marginBottom: '8px' }}>{n.titel}</div>
                    {n.inhalt && (
                      <div style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginBottom: anhangUrl ? '12px' : '0' }}>{n.inhalt}</div>
                    )}
                    {anhangUrl && (
                      <a
                        href={anhangUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 600, fontSize: '13px', textDecoration: 'none', marginTop: '4px' }}
                      >
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
            })}
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
                      style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
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

      {/* Toast */}
      {message && (
        <div style={{
          position: 'fixed', bottom: '32px', right: '24px', zIndex: 9999,
          padding: '12px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
          background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: message.type === 'success' ? '#166534' : '#b91c1c',
          animation: 'slideInRight 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
        }}>
          {message.text}
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        details > summary::-webkit-details-marker { display: none; }
      `}</style>
    </div>
  )
}
