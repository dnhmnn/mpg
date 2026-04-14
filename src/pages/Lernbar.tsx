import { useState, useEffect } from 'react'
import PocketBase from 'pocketbase'
import { useAuth } from '../hooks/useAuth'

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
      <a href={googleUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontWeight: 600, fontSize: '12px', textDecoration: 'none', fontFamily: 'inherit' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Google
      </a>
      <button onClick={downloadICS} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Apple / iCal
      </button>
    </div>
  )
}


  const { user, loading: authLoading, logout } = useAuth()
  const [tab, setTab] = useState<'termine' | 'lernmodule' | 'konto'>('termine')

  const [termine, setTermine] = useState<Termin[]>([])
  const [terminUser, setTerminUser] = useState<TerminUser[]>([])
  const [module, setModule] = useState<Modul[]>([])
  const [progress, setProgress] = useState<ModulProgress[]>([])
  const [loading, setLoading] = useState(true)

  const [expandedModul, setExpandedModul] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

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
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#64748b' }}>Lade...</div>
      </div>
    )
  }

  const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
    zugesagt:   { label: 'Zugesagt',   bg: '#dcfce7', color: '#166534' },
    abgesagt:   { label: 'Abgesagt',   bg: '#fee2e2', color: '#991b1b' },
    eingeladen: { label: 'Eingeladen', bg: '#f1f5f9', color: '#64748b' },
    da:         { label: 'Anwesend',   bg: '#dbeafe', color: '#1e40af' },
    fehlend:    { label: 'Gefehlt',    bg: '#fef3c7', color: '#92400e' },
  }

  const upcomingTermine = termine.filter(t => t.status !== 'abgeschlossen' && t.status !== 'abgesagt')
  const pastTermine = termine.filter(t => t.status === 'abgeschlossen')
  const doneMods = progress.filter(p => p.abgeschlossen_am).length

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
    color: active ? '#0f172a' : '#94a3b8',
    borderBottom: active ? '2px solid #0f172a' : '2px solid transparent',
    marginBottom: '-1px', whiteSpace: 'nowrap'
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', padding: '0 20px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <svg width="120" height="28" viewBox="0 0 140 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#0f172a"/>
            <path d="M8 10h10a6 6 0 0 1 0 12H8V10z" fill="none" stroke="white" strokeWidth="2"/>
            <circle cx="18" cy="16" r="3" fill="white"/>
            <text x="40" y="22" fontFamily="system-ui,-apple-system,sans-serif" fontWeight="700" fontSize="18" fill="#0f172a" letterSpacing="-0.5">responda</text>
          </svg>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', color: '#64748b' }}>{user?.name}</span>
            <button onClick={logout} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>Abmelden</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
          <button style={tabStyle(tab === 'termine')} onClick={() => setTab('termine')}>
            Termine {upcomingTermine.length > 0 && <span style={{ marginLeft: '4px', background: '#0f172a', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }}>{upcomingTermine.length}</span>}
          </button>
          <button style={tabStyle(tab === 'lernmodule')} onClick={() => setTab('lernmodule')}>
            Lernmodule {progress.length > 0 && <span style={{ marginLeft: '4px', background: doneMods === progress.length ? '#16a34a' : '#0f172a', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }}>{doneMods}/{progress.length}</span>}
          </button>
          <button style={tabStyle(tab === 'konto')} onClick={() => setTab('konto')}>Mein Konto</button>
        </div>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Begrüßung */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>
            Servus, {user?.name?.split(' ')[0]}!
          </div>
          <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '4px' }}>
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* TERMINE */}
        {tab === 'termine' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {upcomingTermine.length === 0 && pastTermine.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '48px 0', fontSize: '15px' }}>Keine Termine zugewiesen</div>
            )}

            {upcomingTermine.map(termin => {
              const tu = terminUser.find(t => t.termin_id === termin.id)
              const cfg = tu ? statusConfig[tu.status] : null
              const startTime = fmtTime(termin.start_datetime)
              const endTime = termin.end_datetime ? fmtTime(termin.end_datetime) : ''
              return (
                <div key={termin.id} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '16px 20px', color: '#fff' }}>
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
                      <div style={{ fontSize: '14px', color: '#374151', marginBottom: '14px', lineHeight: 1.5 }}>{termin.description}</div>
                    )}
                    {termin.dozent && (
                      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>Dozent: {termin.dozent}</div>
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
                                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
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
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '14px', color: '#64748b', padding: '10px 0', borderTop: '1px solid #e2e8f0', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                  Vergangene Termine ({pastTermine.length})
                </summary>
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pastTermine.map(termin => {
                    const tu = terminUser.find(t => t.termin_id === termin.id)
                    const cfg = tu ? statusConfig[tu.status] : null
                    return (
                      <div key={termin.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{termin.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{fmtDate(termin.start_datetime)}</div>
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
        {tab === 'lernmodule' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {progress.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '48px 0', fontSize: '15px' }}>Noch keine Lernmodule zugewiesen</div>
            )}

            {/* Fortschrittsbalken gesamt */}
            {progress.length > 0 && (
              <div style={{ background: '#fff', borderRadius: '12px', padding: '16px 20px', border: '1px solid #e2e8f0', marginBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>Gesamtfortschritt</span>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>{doneMods}/{progress.length} abgeschlossen</span>
                </div>
                <div style={{ background: '#e2e8f0', borderRadius: '6px', height: '8px' }}>
                  <div style={{ background: '#0f172a', borderRadius: '6px', height: '8px', width: `${progress.length > 0 ? Math.round((doneMods / progress.length) * 100) : 0}%`, transition: 'width 0.3s' }} />
                </div>
              </div>
            )}

            {progress.map(p => {
              const mod = module.find(m => m.id === p.modul_id)
              if (!mod) return null
              const isDone = !!p.abgeschlossen_am
              const isOpen = expandedModul === p.id
              return (
                <div key={p.id} style={{ background: '#fff', borderRadius: '14px', border: `1px solid ${isDone ? '#bbf7d0' : '#e2e8f0'}`, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedModul(isOpen ? null : p.id)}
                    style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                  >
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: isDone ? '#10b981' : '#cbd5e1' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{mod.name}</div>
                      {mod.beschreibung && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{mod.beschreibung}</div>}
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: isDone ? '#dcfce7' : '#f1f5f9', color: isDone ? '#065f46' : '#94a3b8', flexShrink: 0 }}>
                      {isDone ? 'Fertig' : 'Offen'}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: '1px solid #f1f5f9', padding: '20px' }}>
                      {mod.inhalte && mod.inhalte.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {[...mod.inhalte].sort((a, b) => a.reihenfolge - b.reihenfolge).map((block, i) => (
                            <div key={i}>
                              {block.titel && <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px', color: '#0f172a' }}>{block.titel}</div>}
                              {block.typ === 'text' && (
                                <div style={{ fontSize: '14px', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{block.inhalt}</div>
                              )}
                              {block.typ === 'quiz' && (() => {
                                let quiz: any = null
                                try { quiz = JSON.parse(block.inhalt) } catch { return null }
                                return (
                                  <div style={{ background: '#f5f3ff', borderRadius: '10px', padding: '14px', border: '1px solid #ddd6fe' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Quiz</div>
                                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '10px' }}>{quiz.frage}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      {quiz.antworten?.map((a: string, idx: number) => (
                                        <div key={idx} style={{ padding: '8px 12px', borderRadius: '8px', background: '#fff', border: '1px solid #ddd6fe', fontSize: '13px' }}>{a}</div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: '#94a3b8', fontSize: '14px' }}>Kein Inhalt vorhanden.</div>
                      )}

                      {!isDone && (
                        <button
                          onClick={() => markModulDone(p.id)}
                          style={{ marginTop: '20px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#0f172a', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Als abgeschlossen markieren
                        </button>
                      )}
                      {isDone && (
                        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: '#059669', fontWeight: 600 }}>
                          Abgeschlossen am {new Date(p.abgeschlossen_am!).toLocaleDateString('de-DE')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* MEIN KONTO */}
        {tab === 'konto' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Profil */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '20px 24px', color: '#fff', display: 'flex', alignItems: 'center', gap: '14px' }}>
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Kontakt-Email</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="email"
                      value={kontaktEmail}
                      onChange={e => setKontaktEmail(e.target.value)}
                      placeholder="deine@email.de"
                      style={{ flex: 1, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
                    />
                    <button
                      onClick={saveKontaktEmail}
                      disabled={savingEmail}
                      style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#0f172a', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', opacity: savingEmail ? 0.6 : 1 }}
                    >Speichern</button>
                  </div>
                </div>

                {/* Passwort */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Passwort</label>
                  <button
                    onClick={sendPasswordReset}
                    disabled={sendingReset}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', opacity: sendingReset ? 0.6 : 1 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Passwort-Reset Email senden
                  </button>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>Du erhältst eine Email mit einem Link zum Passwort zurücksetzen.</div>
                </div>
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
