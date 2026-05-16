import React, { useState, useEffect } from 'react'
import PocketBase from 'pocketbase'
import { useNavigate } from 'react-router-dom'
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
function toICSDate(str: string): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}
function getVideoEmbed(url: string): string {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return url
}

interface Termin {
  id: string; name: string; description: string; start_datetime: string
  end_datetime: string; location: string; dozent: string; status: string
}
interface TerminUser {
  id: string; termin_id: string; teilnehmer_id: string; status: string
}
interface Modul {
  id: string; name: string; beschreibung: string
  inhalte: { typ: string; titel: string; inhalt: string; reihenfolge: number }[]
  dauer_minuten: number; min_pass_percent?: number
}
interface ModulProgress {
  id: string; modul_id: string; teilnehmer_id: string
  fortschritt_prozent: number; abgeschlossen_am?: string
}
interface Lernbeitrag {
  id: string; collectionId: string; typ: 'bild' | 'text' | 'video' | 'quiz'
  titel: string; inhalt: string; bild?: string; video_url?: string
  tags: string[] | string; organisation_id: string; erstellt_von_name: string
  gepinnt: boolean; quiz_daten?: string | { frage: string; antworten: string[]; richtige: number }
  created: string
}

function CalendarButtons({ termin }: { termin: Termin }) {
  const start = toICSDate(termin.start_datetime)
  const end = termin.end_datetime ? toICSDate(termin.end_datetime) : start
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(termin.name)}&dates=${start}/${end}&details=${encodeURIComponent(termin.description || '')}&location=${encodeURIComponent(termin.location || '')}`
  function downloadICS() {
    const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Responda//Lernbar//DE','BEGIN:VEVENT',`DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${termin.name}`,`DESCRIPTION:${(termin.description||'').replace(/\n/g,'\\n')}`,`LOCATION:${termin.location||''}`,'END:VEVENT','END:VCALENDAR'].join('\r\n')
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    const a = document.createElement('a'); a.href = url; a.download = `${termin.name.replace(/\s+/g,'_')}.ics`; a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <a href={googleUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 600, fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Google
      </a>
      <button onClick={downloadICS} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Apple / iCal
      </button>
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

export default function Lernbar() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'feed' | 'termine' | 'module'>('feed')

  const [termine, setTermine] = useState<Termin[]>([])
  const [terminUser, setTerminUser] = useState<TerminUser[]>([])
  const [module, setModule] = useState<Modul[]>([])
  const [progress, setProgress] = useState<ModulProgress[]>([])
  const [beitraege, setBeitraege] = useState<Lernbeitrag[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [feedQuizState, setFeedQuizState] = useState<Record<string, { selected: number | null; submitted: boolean }>>({})

  // Module player
  const [playerProgress, setPlayerProgress] = useState<ModulProgress | null>(null)
  const [playerStep, setPlayerStep] = useState<'intro' | number>('intro')
  const [quizSelected, setQuizSelected] = useState<number | null>(null)
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [modulFailed, setModulFailed] = useState(false)
  const [quizFrageIdx, setQuizFrageIdx] = useState(0)
  const [quizResults, setQuizResults] = useState({ correct: 0, total: 0 })

  useEffect(() => { if (user) loadData() }, [user])

  function showMsg(text: string, type: 'success' | 'error') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  async function loadData() {
    setLoading(true)
    try {
      const tuRecords = await pb.collection('ausbildungen_termine_user').getFullList({
        filter: `teilnehmer_id = "${user!.id}"`, requestKey: `lb-tu-${Date.now()}`
      })
      setTerminUser(tuRecords as any)
      const terminIds = [...new Set((tuRecords as any[]).map(r => r.termin_id))]
      if (terminIds.length > 0) {
        const tr = await pb.collection('ausbildungen_termine').getFullList({
          filter: terminIds.map(id => `id = "${id}"`).join(' || '), sort: 'start_datetime', requestKey: `lb-termine-${Date.now()}`
        })
        setTermine(tr as any)
      }
      const pr = await pb.collection('ausbildungen_module_progress').getFullList({
        filter: `teilnehmer_id = "${user!.id}"`, requestKey: `lb-progress-${Date.now()}`
      })
      setProgress(pr as any)
      const modulIds = [...new Set((pr as any[]).map(r => r.modul_id))]
      if (modulIds.length > 0) {
        const mr = await pb.collection('ausbildungen_module').getFullList({
          filter: modulIds.map(id => `id = "${id}"`).join(' || '), requestKey: `lb-module-${Date.now()}`
        })
        setModule(mr as any)
      }
      try {
        if (user?.organization_id) {
          const br = await pb.collection('lernbar_beitraege').getFullList({
            filter: `organisation_id = "${user!.organization_id}"`, sort: '-gepinnt,-created', requestKey: `lb-beitraege-${Date.now()}`
          })
          setBeitraege(br as any)
        }
      } catch { /* collection may not exist */ }
    } catch (e: any) { console.error(e) }
    finally { setLoading(false) }
  }

  async function updateTerminStatus(terminUserId: string, status: 'zugesagt' | 'abgesagt') {
    try {
      await pb.collection('ausbildungen_termine_user').update(terminUserId, { status }, { requestKey: `tu-${Date.now()}` })
      setTerminUser(prev => prev.map(t => t.id === terminUserId ? { ...t, status } : t))
      showMsg(status === 'zugesagt' ? 'Zugesagt!' : 'Abgesagt', 'success')
    } catch (e: any) { showMsg('Fehler: ' + e.message, 'error') }
  }

  async function markModulDone(progressId: string) {
    try {
      await pb.collection('ausbildungen_module_progress').update(progressId, {
        abgeschlossen_am: new Date().toISOString(), fortschritt_prozent: 100
      }, { requestKey: `mod-${Date.now()}` })
      setProgress(prev => prev.map(p => p.id === progressId ? { ...p, abgeschlossen_am: new Date().toISOString(), fortschritt_prozent: 100 } : p))
      showMsg('Modul abgeschlossen!', 'success')
    } catch (e: any) { showMsg('Fehler: ' + e.message, 'error') }
  }

  const doneMods = progress.filter(p => p.abgeschlossen_am).length
  const upcomingTermine = termine.filter(t => t.status !== 'abgeschlossen' && t.status !== 'abgesagt')
  const pastTermine = termine.filter(t => t.status === 'abgeschlossen')

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, -apple-system, sans-serif' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Lade…</div>
      </div>
    )
  }

  // ── MODULE PLAYER (full screen) ──────────────────────────────────────────
  if (playerProgress) {
    const mod = module.find(m => m.id === playerProgress.modul_id)
    if (!mod) { setPlayerProgress(null); return null }
    const rawInhalte = mod.inhalte
    const blocks = ([...(Array.isArray(rawInhalte) ? rawInhalte : (() => { try { return JSON.parse(rawInhalte as any) } catch { return [] } })()) || []]).sort((a: any, b: any) => a.reihenfolge - b.reihenfolge)
    const totalBlocks = blocks.length
    const isLast = typeof playerStep === 'number' && playerStep === totalBlocks - 1
    const passPercent = mod.min_pass_percent ?? 100
    const currentBlock = typeof playerStep === 'number' ? blocks[playerStep] : null

    function resetPlayer() {
      setPlayerProgress(null); setPlayerStep('intro'); setQuizSelected(null)
      setQuizSubmitted(false); setModulFailed(false); setQuizFrageIdx(0); setQuizResults({ correct: 0, total: 0 })
    }
    function advanceBlock() {
      setQuizSelected(null); setQuizSubmitted(false); setQuizFrageIdx(0)
      if (playerStep === 'intro') { setPlayerStep(0); return }
      if (typeof playerStep === 'number') {
        if (isLast) {
          const passed = quizResults.total === 0 || (quizResults.correct / quizResults.total * 100) >= passPercent
          if (passed) { markModulDone(playerProgress.id); resetPlayer() } else { setModulFailed(true) }
        } else { setPlayerStep(playerStep + 1) }
      }
    }

    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', fontFamily: 'Inter, -apple-system, sans-serif' }}>
        {/* Player Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: 'calc(env(safe-area-inset-top) + 12px) 16px 12px' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={resetPlayer} style={{ background: 'none', border: 'none', padding: '6px 8px 6px 0', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 14, fontFamily: 'inherit' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              Zurück
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.name}</div>
              {playerStep !== 'intro' && !modulFailed && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Block {(playerStep as number) + 1} / {totalBlocks}</div>
              )}
            </div>
            {playerStep !== 'intro' && totalBlocks > 0 && !modulFailed && (
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{Math.round(((playerStep as number) / totalBlocks) * 100)}%</div>
            )}
          </div>
          {playerStep !== 'intro' && totalBlocks > 0 && !modulFailed && (
            <div style={{ marginTop: 10, height: 3, background: 'var(--border)', borderRadius: 99 }}>
              <div style={{ height: 3, background: 'var(--accent)', borderRadius: 99, width: `${Math.round(((playerStep as number) / totalBlocks) * 100)}%`, transition: 'width 0.3s' }} />
            </div>
          )}
        </div>

        <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 40px' }}>
          {/* Intro */}
          {playerStep === 'intro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--text)', marginBottom: 8 }}>{mod.name}</div>
                {mod.beschreibung && <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.65 }}>{mod.beschreibung}</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { val: mod.dauer_minuten, label: 'Minuten' },
                  { val: totalBlocks, label: 'Blöcke' },
                  { val: blocks.filter((b: any) => b.typ === 'quiz').length, label: 'Quiz' },
                ].map(({ val, label }) => (
                  <div key={label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px', textAlign: 'center', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{val}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              {blocks.filter((b: any) => b.typ === 'quiz').length > 0 && (
                <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
                  Dieses Modul enthält Quiz-Fragen. Mindestens {passPercent}% müssen richtig beantwortet werden.
                </div>
              )}
              <button onClick={advanceBlock} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                Starten
              </button>
            </div>
          )}

          {/* Failed */}
          {modulFailed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '24px 20px', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 20, color: '#b91c1c', marginBottom: 8 }}>Nicht bestanden</div>
                <div style={{ fontSize: 14, color: '#991b1b', lineHeight: 1.5 }}>
                  {quizResults.correct} von {quizResults.total} Fragen richtig ({quizResults.total > 0 ? Math.round(quizResults.correct / quizResults.total * 100) : 0}%). Mindestens {passPercent}% erforderlich.
                </div>
              </div>
              <button onClick={() => { setPlayerStep('intro'); setQuizSelected(null); setQuizSubmitted(false); setModulFailed(false); setQuizFrageIdx(0); setQuizResults({ correct: 0, total: 0 }) }}
                style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
                Neu starten
              </button>
            </div>
          )}

          {/* Text Block */}
          {!modulFailed && currentBlock?.typ === 'text' && (
            <div>
              {currentBlock.titel && <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--text)', marginBottom: 14 }}>{currentBlock.titel}</div>}
              <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.75, whiteSpace: 'pre-wrap', marginBottom: 28 }}>{currentBlock.inhalt}</div>
              <button onClick={advanceBlock} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
                {isLast ? 'Abschließen' : 'Weiter'}
              </button>
            </div>
          )}

          {/* Quiz Block */}
          {!modulFailed && currentBlock?.typ === 'quiz' && (() => {
            let quizData: { fragen: { frage: string; antworten: string[]; richtige: number }[] } = { fragen: [] }
            try {
              const raw = currentBlock.inhalt
              const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
              if (parsed && Array.isArray(parsed.fragen)) quizData = parsed
              else if (parsed?.frage) quizData = { fragen: [parsed] }
            } catch {}
            const fragen = quizData.fragen || []
            const currentFrage = fragen[quizFrageIdx]
            const isLastFrage = quizFrageIdx >= fragen.length - 1
            if (!currentFrage) return (
              <button onClick={advanceBlock} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
                {isLast ? 'Abschließen' : 'Weiter'}
              </button>
            )
            const antworten: string[] = Array.isArray(currentFrage.antworten) ? currentFrage.antworten : []
            const richtige = Number(currentFrage.richtige)
            return (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Quiz{fragen.length > 1 ? ` · Frage ${quizFrageIdx + 1} / ${fragen.length}` : ''}
                </div>
                <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--text)', marginBottom: 18, lineHeight: 1.5 }}>{currentFrage.frage}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {antworten.map((a, idx) => {
                    let bg = 'var(--bg-card)', border = '1.5px solid var(--border)', color = 'var(--text)'
                    if (quizSubmitted) {
                      if (idx === richtige) { bg = '#f0fdf4'; border = '2px solid #16a34a'; color = '#166534' }
                      else if (idx === quizSelected) { bg = '#fef2f2'; border = '2px solid var(--accent)'; color = 'var(--accent)' }
                    } else if (idx === quizSelected) {
                      bg = 'var(--bg-subtle)'; border = '2px solid var(--accent)'; color = 'var(--accent)'
                    }
                    return (
                      <button key={idx} disabled={quizSubmitted} onClick={() => setQuizSelected(idx)}
                        style={{ padding: '13px 16px', borderRadius: 12, border, background: bg, color, fontWeight: idx === quizSelected || (quizSubmitted && idx === richtige) ? 700 : 400, fontSize: 15, cursor: quizSubmitted ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                        {a}
                      </button>
                    )
                  })}
                </div>
                {!quizSubmitted ? (
                  <button disabled={quizSelected === null}
                    onClick={() => { setQuizResults(prev => ({ correct: prev.correct + (quizSelected === richtige ? 1 : 0), total: prev.total + 1 })); setQuizSubmitted(true) }}
                    style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: quizSelected === null ? 'var(--bg-subtle)' : 'var(--accent)', color: quizSelected === null ? 'var(--text-secondary)' : '#fff', fontWeight: 700, fontSize: 16, cursor: quizSelected === null ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                    Antworten
                  </button>
                ) : (
                  <div>
                    <div style={{ borderRadius: 12, padding: '13px 16px', textAlign: 'center', marginBottom: 14, fontWeight: 700, background: quizSelected === richtige ? '#f0fdf4' : '#fef2f2', border: quizSelected === richtige ? '1px solid #bbf7d0' : '1px solid #fecaca', color: quizSelected === richtige ? '#166534' : 'var(--accent)' }}>
                      {quizSelected === richtige ? '✓ Richtig!' : '✗ Falsch'}
                    </div>
                    <button onClick={() => {
                        if (isLastFrage) { advanceBlock() }
                        else { setQuizFrageIdx(quizFrageIdx + 1); setQuizSelected(null); setQuizSubmitted(false) }
                      }}
                      style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {isLastFrage ? (isLast ? 'Abschließen' : 'Weiter') : 'Nächste Frage'}
                    </button>
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* Toast */}
        {message && (
          <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: message.type === 'success' ? '#166534' : '#b91c1c', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
            {message.text}
          </div>
        )}
      </div>
    )
  }

  // ── MAIN VIEW ────────────────────────────────────────────────────────────
  const parseTags = (raw: string[] | string): string[] => {
    if (Array.isArray(raw)) return raw
    try { const p = JSON.parse(raw as string); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  const parseQuiz = (raw: any) => {
    if (!raw) return null
    if (typeof raw === 'object' && raw.frage) return raw
    try { const p = JSON.parse(raw); return p?.frage ? p : null } catch { return null }
  }

  const lernbarBadge = upcomingTermine.length + (progress.length - doneMods) + beitraege.length

  const BOTTOM_TABS = [
    {
      id: 'feed' as const, label: 'Feed',
      badge: beitraege.length,
      icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.61 4.87 2 2 0 0 1 3.6 2.69h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.06a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    },
    {
      id: 'termine' as const, label: 'Termine',
      badge: upcomingTermine.length,
      icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    },
    {
      id: 'module' as const, label: 'Module',
      badge: progress.length - doneMods,
      icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: 'calc(env(safe-area-inset-top) + 0px) 0 0' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: '4px 8px 4px 0', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 14, fontFamily: 'inherit', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Zurück
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
            <img src="/logo.svg" alt="Responda" width={30} height={30} />
            <span style={{ fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.01em', color: 'var(--text)' }}>Lernbar</span>
          </div>
          <div style={{ width: 70 }} />
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px calc(80px + env(safe-area-inset-bottom))' }}>

        {/* ── FEED ── */}
        {tab === 'feed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {beitraege.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '64px 0 24px', fontSize: 15 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
                Noch keine Lernbeiträge
              </div>
            )}
            {beitraege.map(b => {
              const tags = parseTags(b.tags)
              const bildUrl = b.bild ? `https://api.responda.systems/api/files/${b.collectionId}/${b.id}/${b.bild}` : null
              const qs = feedQuizState[b.id] || { selected: null, submitted: false }
              const quiz = parseQuiz(b.quiz_daten)
              return (
                <div key={b.id} style={{ background: 'var(--bg-card)', borderRadius: 18, border: `1px solid ${b.gepinnt ? 'var(--accent)' : 'var(--border)'}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                  {b.gepinnt && (
                    <div style={{ background: 'var(--accent)', padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/></svg>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Angepinnt</span>
                    </div>
                  )}
                  {b.typ === 'bild' && bildUrl && (
                    <img src={bildUrl} alt={b.titel} style={{ width: '100%', display: 'block', maxHeight: 300, objectFit: 'cover' }} />
                  )}
                  {b.typ === 'video' && b.video_url && (
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, background: '#000' }}>
                      <iframe src={getVideoEmbed(b.video_url)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                    </div>
                  )}
                  {(b.typ === 'text' || b.typ === 'quiz') && (
                    <div style={{ height: 4, background: 'var(--accent)' }} />
                  )}
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', flex: 1 }}>{b.titel}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'rgba(107,15,26,0.08)', borderRadius: 7, padding: '3px 9px', marginLeft: 10, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {b.typ === 'bild' ? '📷' : b.typ === 'text' ? '📝' : b.typ === 'video' ? '▶' : '❓'}
                      </span>
                    </div>
                    {b.inhalt && b.typ !== 'quiz' && (
                      <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginBottom: 12 }}>{b.inhalt}</div>
                    )}
                    {b.typ === 'quiz' && quiz && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5, marginBottom: 14 }}>{quiz.frage}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                          {quiz.antworten.map((a: string, idx: number) => {
                            let bg = 'var(--bg-subtle)', border = '1.5px solid var(--border)', color = 'var(--text)'
                            if (qs.submitted) {
                              if (idx === quiz.richtige) { bg = '#f0fdf4'; border = '2px solid #16a34a'; color = '#166534' }
                              else if (idx === qs.selected) { bg = '#fef2f2'; border = '2px solid var(--accent)'; color = 'var(--accent)' }
                            } else if (idx === qs.selected) { bg = 'rgba(107,15,26,0.06)'; border = '2px solid var(--accent)'; color = 'var(--accent)' }
                            return (
                              <button key={idx} disabled={qs.submitted} onClick={() => setFeedQuizState(prev => ({ ...prev, [b.id]: { selected: idx, submitted: false } }))}
                                style={{ padding: '12px 14px', borderRadius: 12, border, background: bg, color, fontWeight: idx === qs.selected || (qs.submitted && idx === quiz.richtige) ? 700 : 400, fontSize: 14, cursor: qs.submitted ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                                {a}
                              </button>
                            )
                          })}
                        </div>
                        {!qs.submitted ? (
                          <button disabled={qs.selected === null} onClick={() => setFeedQuizState(prev => ({ ...prev, [b.id]: { ...prev[b.id], submitted: true } }))}
                            style={{ marginTop: 12, width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: qs.selected === null ? 'var(--bg-subtle)' : 'var(--accent)', color: qs.selected === null ? 'var(--text-secondary)' : '#fff', fontWeight: 700, fontSize: 15, cursor: qs.selected === null ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                            Antworten
                          </button>
                        ) : (
                          <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 12, textAlign: 'center', fontWeight: 700, background: qs.selected === quiz.richtige ? '#f0fdf4' : '#fef2f2', border: qs.selected === quiz.richtige ? '1px solid #bbf7d0' : '1px solid #fecaca', color: qs.selected === quiz.richtige ? '#166534' : 'var(--accent)' }}>
                            {qs.selected === quiz.richtige ? '✓ Richtig!' : '✗ Falsch — die richtige Antwort ist markiert'}
                          </div>
                        )}
                      </div>
                    )}
                    {tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {tags.map(t => (
                          <span key={t} style={{ fontSize: 11, fontWeight: 600, background: 'rgba(107,15,26,0.07)', color: 'var(--accent)', borderRadius: 6, padding: '3px 9px' }}>{t}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
                      {b.erstellt_von_name && `${b.erstellt_von_name} · `}{new Date(b.created).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── TERMINE ── */}
        {tab === 'termine' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {upcomingTermine.length === 0 && pastTermine.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '64px 0 24px', fontSize: 15 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                Keine Termine zugewiesen
              </div>
            )}
            {upcomingTermine.map(termin => {
              const tu = terminUser.find(t => t.termin_id === termin.id)
              const cfg = tu ? statusConfig[tu.status] : null
              const startTime = fmtTime(termin.start_datetime)
              const endTime = termin.end_datetime ? fmtTime(termin.end_datetime) : ''
              return (
                <div key={termin.id} style={{ background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                  <div style={{ background: 'var(--accent)', padding: '16px 20px' }}>
                    <div style={{ fontWeight: 700, fontSize: 18, color: '#fff', marginBottom: 6 }}>{termin.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, text: fmtDate(termin.start_datetime) },
                        startTime ? { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, text: `${startTime}${endTime ? ` – ${endTime}` : ''} Uhr` } : null,
                        termin.location ? { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>, text: termin.location } : null,
                      ].filter(Boolean).map((item: any, i) => (
                        <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: 6 }}>{item.icon}{item.text}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    {termin.description && <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 12, lineHeight: 1.6 }}>{termin.description}</div>}
                    {termin.dozent && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Dozent: {termin.dozent}</div>}
                    {tu && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          {cfg && <span style={{ padding: '5px 14px', borderRadius: 99, background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 13 }}>{cfg.label}</span>}
                          {(tu.status === 'eingeladen' || tu.status === 'abgesagt' || tu.status === 'zugesagt') && (
                            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                              {tu.status !== 'zugesagt' && (
                                <button onClick={() => updateTerminStatus(tu.id, 'zugesagt')} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Zusagen</button>
                              )}
                              {tu.status !== 'abgesagt' && (
                                <button onClick={() => updateTerminStatus(tu.id, 'abgesagt')} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Absagen</button>
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
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14, color: 'var(--text-secondary)', padding: '12px 0', borderTop: '1px solid var(--border)', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                  Vergangene Termine ({pastTermine.length})
                </summary>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pastTermine.map(termin => {
                    const tu = terminUser.find(t => t.termin_id === termin.id)
                    const cfg = tu ? statusConfig[tu.status] : null
                    return (
                      <div key={termin.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{termin.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{fmtDate(termin.start_datetime)}</div>
                        </div>
                        {cfg && <span style={{ padding: '3px 10px', borderRadius: 99, background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 12 }}>{cfg.label}</span>}
                      </div>
                    )
                  })}
                </div>
              </details>
            )}
          </div>
        )}

        {/* ── MODULE ── */}
        {tab === 'module' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {progress.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '64px 0 24px', fontSize: 15 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
                Noch keine Lernmodule zugewiesen
              </div>
            )}
            {progress.length > 0 && (
              <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '16px 18px', border: '1px solid var(--border)', marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Gesamtfortschritt</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{doneMods}/{progress.length} abgeschlossen</span>
                </div>
                <div style={{ background: 'var(--border)', borderRadius: 99, height: 8 }}>
                  <div style={{ background: 'var(--accent)', borderRadius: 99, height: 8, width: `${Math.round((doneMods / progress.length) * 100)}%`, transition: 'width 0.4s' }} />
                </div>
              </div>
            )}
            {progress.map(p => {
              const mod = module.find(m => m.id === p.modul_id)
              if (!mod) return null
              const isDone = !!p.abgeschlossen_am
              return (
                <div key={p.id} style={{ background: 'var(--bg-card)', borderRadius: 16, border: `1.5px solid ${isDone ? '#bbf7d0' : 'var(--border)'}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, background: isDone ? '#10b981' : 'var(--border-strong)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{mod.name}</div>
                      {mod.beschreibung && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{mod.beschreibung}</div>}
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{mod.dauer_minuten} Min · {mod.inhalte?.length || 0} Blöcke</div>
                    </div>
                    {isDone ? (
                      <span style={{ padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: '#dcfce7', color: '#065f46', flexShrink: 0 }}>Fertig ✓</span>
                    ) : (
                      <button onClick={() => { setPlayerProgress(p); setPlayerStep('intro'); setQuizSelected(null); setQuizSubmitted(false); setModulFailed(false); setQuizFrageIdx(0); setQuizResults({ correct: 0, total: 0 }) }}
                        style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                        Starten
                      </button>
                    )}
                  </div>
                  {isDone && (
                    <div style={{ padding: '0 18px 14px', fontSize: 12, color: '#059669' }}>
                      Abgeschlossen am {new Date(p.abgeschlossen_am!).toLocaleDateString('de-DE')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: 'var(--bg-card)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'stretch', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {BOTTOM_TABS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '8px 4px 6px', border: 'none', background: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', fontFamily: 'inherit', position: 'relative', color: active ? 'var(--accent)' : 'var(--text-secondary)' }}>
              {t.icon}
              {t.badge > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 'calc(50% - 16px)', background: 'var(--accent)', color: '#fff', borderRadius: 999, padding: '0 5px', fontSize: 9, fontWeight: 700, minWidth: 14, textAlign: 'center' }}>{t.badge}</span>
              )}
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, lineHeight: 1 }}>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Toast */}
      {message && (
        <div style={{ position: 'fixed', bottom: 'calc(76px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: message.type === 'success' ? '#166534' : '#b91c1c', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
          {message.text}
        </div>
      )}

      <style>{`details > summary::-webkit-details-marker { display: none; }`}</style>
    </div>
  )
}
