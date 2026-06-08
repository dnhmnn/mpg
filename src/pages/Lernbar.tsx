import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { pb } from '../lib/pocketbase'

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
  id: string; collectionId: string; name: string; description: string
  start_datetime: string; end_datetime: string; location: string
  dozent: string; status: string
  lernkonzept?: string
  dateien?: string[]
  anhang?: string[]
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
  titel: string; inhalt: string; bild?: string | string[]; video_url?: string
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
      <a href={googleUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(96,8,18,0.12)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontWeight: 600, fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Google
      </a>
      <button onClick={downloadICS} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(96,8,18,0.12)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Apple / iCal
      </button>
    </div>
  )
}

const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
  zugesagt:   { label: 'Zugesagt',   bg: '#dcfce7', color: '#166534' },
  abgesagt:   { label: 'Abgesagt',   bg: '#fee2e2', color: '#991b1b' },
  eingeladen: { label: 'Eingeladen', bg: 'rgba(96,8,18,0.06)', color: 'var(--warm-gray)' },
  da:         { label: 'Anwesend',   bg: '#dbeafe', color: '#1e40af' },
  fehlend:    { label: 'Gefehlt',    bg: '#fef3c7', color: '#92400e' },
}

function parseInhalt(raw: any): Record<string, any> {
  if (raw === null || raw === undefined) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return {} }
}

function getPatternBg(pattern: string | null): { backgroundImage: string; backgroundSize?: string } | null {
  if (!pattern) return null
  const a = 'rgba(255,255,255,0.18)', b = 'rgba(255,255,255,0.09)'
  switch (pattern) {
    case 'diamante':   return { backgroundImage: `repeating-linear-gradient(45deg,${a} 0,${a} 1px,transparent 0,transparent 12px),repeating-linear-gradient(-45deg,${a} 0,${a} 1px,transparent 0,transparent 12px)` }
    case 'venezia':    return { backgroundImage: `radial-gradient(circle,${a} 1.5px,transparent 1.5px)`, backgroundSize: '10px 10px' }
    case 'marmo':      return { backgroundImage: `repeating-linear-gradient(67deg,transparent 0,transparent 8px,${b} 8px,${b} 10px,transparent 10px,transparent 20px,${a} 20px,${a} 21px,transparent 21px,transparent 32px)` }
    case 'trama':      return { backgroundImage: `repeating-linear-gradient(0deg,${a} 0,${a} 1px,transparent 0,transparent 7px),repeating-linear-gradient(90deg,${a} 0,${a} 1px,transparent 0,transparent 7px)` }
    case 'fiorentino': return { backgroundImage: `repeating-linear-gradient(60deg,${a} 0,${a} 1px,transparent 0,transparent 10px),repeating-linear-gradient(-60deg,${a} 0,${a} 1px,transparent 0,transparent 10px)` }
    case 'capitone':   return { backgroundImage: `radial-gradient(circle,${a} 2px,transparent 2px),repeating-linear-gradient(45deg,${b} 0,${b} 1px,transparent 0,transparent 16px),repeating-linear-gradient(-45deg,${b} 0,${b} 1px,transparent 0,transparent 16px)`, backgroundSize: '16px 16px,auto,auto' }
    default: return null
  }
}

export default function Lernbar() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'bibliothek' | 'termine' | 'module'>('bibliothek')

  const [termine, setTermine] = useState<Termin[]>([])
  const [terminUser, setTerminUser] = useState<TerminUser[]>([])
  const [module, setModule] = useState<Modul[]>([])
  const [progress, setProgress] = useState<ModulProgress[]>([])
  const [beitraege, setBeitraege] = useState<Lernbeitrag[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [feedQuizState, setFeedQuizState] = useState<Record<string, { selected: number | null; submitted: boolean }>>({})
  const [detailTermin, setDetailTermin] = useState<Termin | null>(null)
  const [bibSearch, setBibSearch] = useState('')
  const [bibActiveTag, setBibActiveTag] = useState<string | null>(null)
  const [openBook, setOpenBook] = useState<Lernbeitrag | null>(null)
  const [bookPage, setBookPage] = useState(0)
  const [bookDir, setBookDir] = useState(1)
  const touchStartX = useRef(0)

  useEffect(() => { setBookPage(0); setBookDir(1) }, [openBook?.id])

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
      } catch (e: any) {
        console.error('lernbar_beitraege Fehler:', e?.message, e?.data)
      }
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
      <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Atkinson Hyperlegible', Inter, -apple-system, sans-serif" }}>
        <div style={{ color: 'var(--warm-gray)', fontSize: 15, fontStyle: 'italic' }}>Lade…</div>
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
      <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', Inter, -apple-system, sans-serif" }}>
        {/* Player Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--lbf-card)', borderBottom: '1px solid rgba(96,8,18,0.12)', padding: 'calc(env(safe-area-inset-top) + 12px) 16px 12px' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={resetPlayer} style={{ background: 'none', border: 'none', padding: '6px 8px 6px 0', cursor: 'pointer', color: '#600812', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 14, fontFamily: 'inherit' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              Zurück
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.name}</div>
              {playerStep !== 'intro' && !modulFailed && (
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 1 }}>Block {(playerStep as number) + 1} / {totalBlocks}</div>
              )}
            </div>
            {playerStep !== 'intro' && totalBlocks > 0 && !modulFailed && (
              <div style={{ fontSize: 13, fontWeight: 700, color: '#600812' }}>{Math.round(((playerStep as number) / totalBlocks) * 100)}%</div>
            )}
          </div>
          {playerStep !== 'intro' && totalBlocks > 0 && !modulFailed && (
            <div style={{ marginTop: 10, height: 3, background: 'var(--lbf-border)', borderRadius: 99 }}>
              <div style={{ height: 3, background: '#600812', borderRadius: 99, width: `${Math.round(((playerStep as number) / totalBlocks) * 100)}%`, transition: 'width 0.3s' }} />
            </div>
          )}
        </div>

        <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 40px' }}>
          {/* Intro */}
          {playerStep === 'intro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--lbf-text)', marginBottom: 8 }}>{mod.name}</div>
                {mod.beschreibung && <div style={{ fontSize: 15, color: 'var(--lbf-text)', lineHeight: 1.65 }}>{mod.beschreibung}</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { val: mod.dauer_minuten, label: 'Minuten' },
                  { val: totalBlocks, label: 'Blöcke' },
                  { val: blocks.filter((b: any) => b.typ === 'quiz').length, label: 'Quiz' },
                ].map(({ val, label }) => (
                  <div key={label} style={{ background: 'var(--lbf-card)', borderRadius: 12, padding: '14px 16px', textAlign: 'center', borderLeft: '3px solid #600812' }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: '#600812', fontStyle: 'italic' }}>{val}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>
              {blocks.filter((b: any) => b.typ === 'quiz').length > 0 && (
                <div style={{ background: 'var(--warm-bg)', border: '1px solid rgba(96,8,18,0.12)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--warm-gray)' }}>
                  Dieses Modul enthält Quiz-Fragen. Mindestens {passPercent}% müssen richtig beantwortet werden.
                </div>
              )}
              <button onClick={advanceBlock} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: '#600812', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
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
                style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: '#600812', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
                Neu starten
              </button>
            </div>
          )}

          {/* Text Block */}
          {!modulFailed && currentBlock?.typ === 'text' && (
            <div>
              {currentBlock.titel && <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--lbf-text)', marginBottom: 14 }}>{currentBlock.titel}</div>}
              <div style={{ fontSize: 15, color: 'var(--lbf-text)', lineHeight: 1.75, whiteSpace: 'pre-wrap', marginBottom: 28 }}>{currentBlock.inhalt}</div>
              <button onClick={advanceBlock} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: '#600812', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
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
              <button onClick={advanceBlock} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: '#600812', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
                {isLast ? 'Abschließen' : 'Weiter'}
              </button>
            )
            const antworten: string[] = Array.isArray(currentFrage.antworten) ? currentFrage.antworten : []
            const richtige = Number(currentFrage.richtige)
            return (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Quiz{fragen.length > 1 ? ` · Frage ${quizFrageIdx + 1} / ${fragen.length}` : ''}
                </div>
                <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--lbf-text)', marginBottom: 18, lineHeight: 1.5 }}>{currentFrage.frage}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {antworten.map((a, idx) => {
                    let bg = 'var(--lbf-card)', border = '1.5px solid rgba(96,8,18,0.12)', color = 'var(--lbf-text)'
                    if (quizSubmitted) {
                      if (idx === richtige) { bg = '#f0fdf4'; border = '2px solid #16a34a'; color = '#166534' }
                      else if (idx === quizSelected) { bg = '#fef2f2'; border = '2px solid #600812'; color = '#600812' }
                    } else if (idx === quizSelected) {
                      bg = 'var(--warm-bg)'; border = '2px solid #600812'; color = '#600812'
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
                    style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: quizSelected === null ? 'var(--warm-bg)' : '#600812', color: quizSelected === null ? 'var(--warm-gray)' : '#fff', fontWeight: 700, fontSize: 16, cursor: quizSelected === null ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                    Antworten
                  </button>
                ) : (
                  <div>
                    <div style={{ borderRadius: 12, padding: '13px 16px', textAlign: 'center', marginBottom: 14, fontWeight: 700, background: quizSelected === richtige ? '#f0fdf4' : '#fef2f2', border: quizSelected === richtige ? '1px solid #bbf7d0' : '1px solid #fecaca', color: quizSelected === richtige ? '#166534' : '#600812' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {quizSelected === richtige
                          ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Richtig!</>
                          : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Falsch</>}
                      </span>
                    </div>
                    <button onClick={() => {
                        if (isLastFrage) { advanceBlock() }
                        else { setQuizFrageIdx(quizFrageIdx + 1); setQuizSelected(null); setQuizSubmitted(false) }
                      }}
                      style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: '#600812', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
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

  const lernbarBadge = upcomingTermine.length + (progress.length - doneMods)

  const allBibTags = [...new Set(beitraege.flatMap(b => parseTags(b.tags)))]
  const filteredBeitraege = beitraege.filter(b => {
    const tags = parseTags(b.tags)
    if (bibActiveTag && !tags.includes(bibActiveTag)) return false
    if (bibSearch.trim()) {
      const q = bibSearch.toLowerCase()
      const inhaltText = typeof b.inhalt === 'string' ? b.inhalt : JSON.stringify(b.inhalt || '')
      return b.titel.toLowerCase().includes(q) || inhaltText.toLowerCase().includes(q) || tags.some(t => t.toLowerCase().includes(q))
    }
    return true
  })

  const BOTTOM_TABS = [
    {
      id: 'bibliothek' as const, label: 'Bibliothek',
      badge: 0,
      icon: <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
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
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', Inter, -apple-system, sans-serif" }}>
      {/* Header — masthead */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', padding: 'calc(env(safe-area-inset-top) + 0px) 0 0' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, padding: '0 20px' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#600812', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 14, fontFamily: 'inherit', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ flex: 1, textAlign: 'center', padding: '0 12px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--lbf-text)', lineHeight: 1.2 }}>Lernbar</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>
              {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <div style={{ width: 34 }} />
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: tab === 'bibliothek' ? '14px 14px calc(84px + env(safe-area-inset-bottom))' : '20px 16px calc(84px + env(safe-area-inset-bottom))' }}>

        {/* ── BIBLIOTHEK ── */}
        {tab === 'bibliothek' && (() => {
          const COVER: Record<string, { bg: string; spine: string; label: string }> = {
            text:  { bg: 'linear-gradient(165deg, #600812 0%, #3d0408 100%)', spine: 'rgba(0,0,0,0.3)', label: 'Text' },
            bild:  { bg: 'linear-gradient(165deg, #7c2d12 0%, #431407 100%)', spine: 'rgba(0,0,0,0.3)', label: 'Bild' },
            video: { bg: 'linear-gradient(165deg, #065f46 0%, #022c22 100%)', spine: 'rgba(0,0,0,0.3)', label: 'Video' },
            quiz:  { bg: 'linear-gradient(165deg, #1e3a8a 0%, #0f172a 100%)', spine: 'rgba(0,0,0,0.3)', label: 'Quiz' },
          }

          const renderBook = (b: Lernbeitrag) => {
            const tags = parseTags(b.tags)
            const bildFirstCard = Array.isArray(b.bild) ? b.bild[0] : b.bild
            const bildUrl = bildFirstCard ? `https://api.responda.systems/api/files/${b.collectionId}/${b.id}/${bildFirstCard}` : null
            let bookColor: string | null = null
            let bookPattern: string | null = null
            const bInhalt = parseInhalt(b.inhalt); if (bInhalt?.v === 2) { if (bInhalt.color) bookColor = bInhalt.color; if (bInhalt.pattern) bookPattern = bInhalt.pattern }
            const cfg = bookColor
              ? (() => { const r = parseInt(bookColor.slice(1,3),16), g = parseInt(bookColor.slice(3,5),16), bv = parseInt(bookColor.slice(5,7),16); return { bg: `linear-gradient(165deg, ${bookColor} 0%, rgb(${Math.round(r*.55)},${Math.round(g*.55)},${Math.round(bv*.55)}) 100%)`, spine: 'rgba(0,0,0,0.3)', label: '' } })()
              : (COVER[b.typ] || COVER.text)
            return (
              <div key={b.id} onClick={() => setOpenBook(b)} style={{
                cursor: 'pointer', borderRadius: 10, overflow: 'hidden',
                aspectRatio: '3/4', position: 'relative',
                background: bildUrl ? '#1a0e08' : cfg.bg,
                boxShadow: '3px 5px 18px rgba(0,0,0,0.28), inset -3px 0 8px rgba(0,0,0,0.18)',
              }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 7, background: cfg.spine, zIndex: 3 }} />
                {!bildUrl && bookPattern && (() => { const pp = getPatternBg(bookPattern); return pp ? <div style={{ position: 'absolute', inset: 0, backgroundImage: pp.backgroundImage, backgroundSize: pp.backgroundSize || 'auto', zIndex: 1, pointerEvents: 'none' }} /> : null })()}
                {bildUrl && <img src={bildUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                <div style={{ position: 'absolute', inset: 0, background: bildUrl ? 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.05) 55%, transparent 100%)' : 'none', zIndex: 2 }} />
                {b.gepinnt && (
                  <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 4 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(253,232,216,0.9)"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/></svg>
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 12px 14px 20px', zIndex: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>{cfg.label}</div>
                  <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 14, color: '#fff', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const } as React.CSSProperties}>{b.titel}</div>
                  {tags.length > 0 && (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tags.slice(0, 3).map(t => `#${t}`).join(' ')}
                    </div>
                  )}
                </div>
              </div>
            )
          }

          const pinned = filteredBeitraege.filter(b => b.gepinnt)
          const regular = filteredBeitraege.filter(b => !b.gepinnt)

          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--warm-gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="search" placeholder="Titel, Inhalt oder Tag suchen…" value={bibSearch} onChange={e => setBibSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px 10px 36px', border: '1.5px solid rgba(96,8,18,0.15)', borderRadius: 10, background: 'var(--lbf-card)', fontSize: 14, fontFamily: 'inherit', color: 'var(--lbf-text)', boxSizing: 'border-box', WebkitAppearance: 'none' }} />
              </div>

              {/* Tag chips */}
              {allBibTags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {allBibTags.map(tag => (
                    <button key={tag} onClick={() => setBibActiveTag(bibActiveTag === tag ? null : tag)}
                      style={{ fontSize: 11, fontWeight: 700, fontStyle: 'italic', color: bibActiveTag === tag ? '#fff' : '#600812', background: bibActiveTag === tag ? '#600812' : 'rgba(96,8,18,0.07)', border: 'none', borderRadius: 99, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      #{tag}
                    </button>
                  ))}
                </div>
              )}

              {filteredBeitraege.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--warm-gray)', padding: '64px 16px 24px', fontSize: 15, fontStyle: 'italic' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(96,8,18,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 12px' }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  {bibSearch || bibActiveTag ? 'Keine Treffer' : 'Noch keine Beiträge'}
                </div>
              )}

              {pinned.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Angepinnt</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>{pinned.map(renderBook)}</div>
                </>
              )}
              {regular.length > 0 && (
                <>
                  {pinned.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Alle Beiträge</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>{regular.map(renderBook)}</div>
                </>
              )}
            </div>
          )
        })()}

        {/* ── TERMINE (Timeline) ── */}
        {tab === 'termine' && (
          <div>
            {termine.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--warm-gray)', padding: '64px 0 24px', fontSize: 15, fontStyle: 'italic' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(96,8,18,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 12px' }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Keine Termine zugewiesen
              </div>
            )}
            {termine.length > 0 && (() => {
              const upcoming = termine.filter(t => t.status !== 'abgeschlossen')
              const past = termine.filter(t => t.status === 'abgeschlossen')

              const renderCard = (termin: Termin) => {
                const tu = terminUser.find(t => t.termin_id === termin.id)
                const cfg = tu ? statusConfig[tu.status] : null
                const isPast = termin.status === 'abgeschlossen'
                const startTime = fmtTime(termin.start_datetime)
                const endTime = termin.end_datetime ? fmtTime(termin.end_datetime) : ''
                const d = parseDate(termin.start_datetime)
                const dayNum = isNaN(d.getTime()) ? '?' : d.getDate().toString()
                const monthName = isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '').toUpperCase()
                const weekday = isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '').toUpperCase()
                const stripColor = tu?.status === 'zugesagt' ? '#16a34a' : tu?.status === 'abgesagt' ? '#dc2626' : '#600812'
                const hasActions = tu && (tu.status === 'eingeladen' || tu.status === 'abgesagt' || tu.status === 'zugesagt') && !isPast

                return (
                  <div key={termin.id} onClick={() => setDetailTermin(termin)} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 5px rgba(0,0,0,0.08)', overflow: 'hidden', cursor: 'pointer', opacity: isPast ? 0.6 : 1 }}>
                    {/* Status strip */}
                    {!isPast && <div style={{ height: 3, background: stripColor }} />}

                    <div style={{ display: 'flex' }}>
                      {/* Date column */}
                      <div style={{ width: 64, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 0', borderRight: '0.5px solid rgba(96,8,18,0.1)', gap: 1 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warm-gray)' }}>{weekday}</span>
                        <span style={{ fontSize: 30, fontWeight: 800, color: isPast ? 'var(--warm-gray)' : '#600812', fontStyle: 'italic', lineHeight: 1 }}>{dayNum}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warm-gray)' }}>{monthName}</span>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)', lineHeight: 1.3 }}>{termin.name}</div>
                          {cfg && (
                            <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 99, background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {cfg.label}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {startTime && (
                            <span style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
                              {startTime}{endTime ? ` – ${endTime}` : ''} Uhr
                            </span>
                          )}
                          {termin.location && (
                            <span style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>{termin.location}</span>
                          )}
                          {termin.dozent && (
                            <span style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>{termin.dozent}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action area */}
                    <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', padding: '8px 12px', background: 'rgba(250,249,247,0.8)', display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                      {hasActions && tu.status !== 'zugesagt' && (
                        <button onClick={() => updateTerminStatus(tu.id, 'zugesagt')}
                          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Zusagen
                        </button>
                      )}
                      {hasActions && tu.status !== 'abgesagt' && (
                        <button onClick={() => updateTerminStatus(tu.id, 'abgesagt')}
                          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(96,8,18,0.2)', background: 'transparent', color: 'var(--warm-gray)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Absagen
                        </button>
                      )}
                      {tu?.status === 'zugesagt' && !isPast && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <CalendarButtons termin={termin} />
                        </div>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 3 }} onClick={() => setDetailTermin(termin)}>
                        Details
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                      </span>
                    </div>
                  </div>
                )
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {upcoming.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', paddingLeft: 2, marginBottom: 2 }}>Bevorstehend</div>
                      {upcoming.map(renderCard)}
                    </>
                  )}
                  {past.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.14em', paddingLeft: 2, marginTop: upcoming.length > 0 ? 8 : 0, marginBottom: 2 }}>Vergangen</div>
                      {past.map(renderCard)}
                    </>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* ── MODULE ── */}
        {tab === 'module' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {progress.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--warm-gray)', padding: '64px 0 24px', fontSize: 15, fontStyle: 'italic' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(96,8,18,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 12px' }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                Noch keine Lernmodule zugewiesen
              </div>
            )}
            {progress.length > 0 && (
              <div style={{ background: 'var(--lbf-card)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--lbf-shadow)', marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Gesamtfortschritt</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)' }}>{doneMods} von {progress.length} abgeschlossen</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#600812', fontStyle: 'italic' }}>{Math.round((doneMods / progress.length) * 100)}%</span>
                </div>
                <div style={{ background: 'var(--lbf-border-light)', borderRadius: 99, height: 4 }}>
                  <div style={{ background: '#600812', borderRadius: 99, height: 4, width: `${Math.round((doneMods / progress.length) * 100)}%`, transition: 'width 0.4s' }} />
                </div>
              </div>
            )}
            {progress.map(p => {
              const mod = module.find(m => m.id === p.modul_id)
              if (!mod) return null
              const isDone = !!p.abgeschlossen_am
              return (
                <div key={p.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, borderLeft: `3px solid ${isDone ? '#16a34a' : '#600812'}`, boxShadow: 'var(--lbf-shadow)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>{mod.name}</div>
                      {mod.beschreibung && <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2, fontStyle: 'italic' }}>{mod.beschreibung}</div>}
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4, fontStyle: 'italic' }}>{mod.dauer_minuten} Min · {mod.inhalte?.length || 0} Blöcke</div>
                    </div>
                    {isDone ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#065f46', flexShrink: 0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Fertig
                      </span>
                    ) : (
                      <button onClick={() => { setPlayerProgress(p); setPlayerStep('intro'); setQuizSelected(null); setQuizSubmitted(false); setModulFailed(false); setQuizFrageIdx(0); setQuizResults({ correct: 0, total: 0 }) }}
                        style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#600812', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                        Starten
                      </button>
                    )}
                  </div>
                  {isDone && (
                    <div style={{ padding: '0 16px 12px', fontSize: 11, color: '#059669', fontStyle: 'italic' }}>
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
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: 'var(--lbf-card)', borderTop: '0.5px solid rgba(96,8,18,0.12)', display: 'flex', alignItems: 'stretch', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {BOTTOM_TABS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, border: 'none', background: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
              color: active ? '#600812' : 'var(--warm-gray)',
              borderTop: active ? '2px solid #600812' : '2px solid transparent',
              paddingTop: 10, paddingBottom: 6
            }}>
              {React.cloneElement(t.icon, { width: 20, height: 20, stroke: active ? '#600812' : 'var(--warm-gray)' })}
              {t.badge > 0 && (
                <span style={{ position: 'absolute', top: 8, right: 'calc(50% - 16px)', background: '#600812', color: '#fff', borderRadius: 999, padding: '0 5px', fontSize: 9, fontWeight: 700, minWidth: 14, textAlign: 'center' }}>{t.badge}</span>
              )}
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>{t.label}</span>
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

      <style>{`details > summary::-webkit-details-marker { display: none; }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

      {/* Book Reader */}
      {openBook && (() => {
        const b = openBook
        const tags = parseTags(b.tags)
        const bildFirst = Array.isArray(b.bild) ? b.bild[0] : b.bild
        const bildUrl = bildFirst ? `https://api.responda.systems/api/files/${b.collectionId}/${b.id}/${bildFirst}` : null
        const qs = feedQuizState[b.id] || { selected: null, submitted: false }
        const quiz = parseQuiz(b.quiz_daten)
        const initials = (b.erstellt_von_name || 'R').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
        const ACCENT: Record<string, string> = { text: '#600812', bild: '#7c2d12', video: '#065f46', quiz: '#1e3a8a' }
        const typeLabel = b.typ === 'quiz' ? 'Quiz' : b.typ === 'video' ? 'Video' : b.typ === 'bild' ? 'Bild' : 'Text'

        // Detect v2 rich content format
        let richPages: { id: string; blocks: { id: string; type: string; text?: string; bildIdx?: number; bildExistingUrl?: string; videoUrl?: string; quizFrage?: string; quizAntworten?: string[]; quizRichtige?: number }[] }[] | null = null
        let readerColor: string | null = null
        let readerPattern: string | null = null
        const rInhalt = parseInhalt(b.inhalt)
        if (rInhalt?.v === 2 && Array.isArray(rInhalt.pages)) { richPages = rInhalt.pages; readerColor = rInhalt.color || null; readerPattern = rInhalt.pattern || null }
        const accent = readerColor || ACCENT[b.typ] || '#600812'
        const bildArr = Array.isArray(b.bild) ? b.bild : (b.bild ? [b.bild] : [])

        // Build page list
        type PID = 'title' | 'media' | 'content' | 'quiz' | 'tags' | `rich-${number}`
        let pages: PID[]
        if (richPages) {
          pages = ['title', ...richPages.map((_, i) => `rich-${i}` as PID), ...(tags.length > 0 ? ['tags' as PID] : [])]
        } else {
          pages = ['title']
          if ((b.typ === 'video' && b.video_url) || bildUrl) pages.push('media')
          if (b.inhalt && b.typ !== 'quiz') pages.push('content')
          if (b.typ === 'quiz' && quiz) pages.push('quiz')
          if (tags.length > 0) pages.push('tags')
        }
        const total = pages.length
        const pid = pages[bookPage] ?? 'title'
        const canPrev = bookPage > 0
        const canNext = bookPage < total - 1

        const go = (dir: 1 | -1) => {
          const next = bookPage + dir
          if (next < 0 || next >= total) return
          setBookDir(dir); setBookPage(next)
        }

        const renderPage = (id: PID) => {
          if (id === 'title') return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '44px 32px', textAlign: 'center', position: 'relative' }}>
              <div style={{ width: 28, height: 3, borderRadius: 2, background: accent, marginBottom: 24 }} />
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.22em', color: accent, marginBottom: 18 }}>{typeLabel}</div>
              <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: 'var(--lbf-text)', lineHeight: 1.3, marginBottom: 28 }}>{b.titel}</div>
              <div style={{ width: 40, height: 0.5, background: 'rgba(96,8,18,0.25)', marginBottom: 24 }} />
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>{initials}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lbf-text)' }}>{b.erstellt_von_name || 'Responda'}</div>
              <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 3 }}>
                {new Date(b.created).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
              {total > 1 && (
                <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  Weiter lesen
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              )}
            </div>
          )

          if (id === 'media') return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#000' }}>
              {b.typ === 'video' && b.video_url ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: 16, background: '#0a0a0a' }}>
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, width: '100%', overflow: 'hidden', borderRadius: 6 }}>
                    <iframe src={getVideoEmbed(b.video_url)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                  </div>
                </div>
              ) : bildUrl ? (
                <img src={bildUrl} alt={b.titel} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
              ) : null}
            </div>
          )

          if (id === 'content') return (
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px 16px' }}>
              <div style={{ fontSize: 15, color: 'var(--lbf-text)', lineHeight: 1.85, whiteSpace: 'pre-wrap', fontFamily: "Georgia, 'Times New Roman', serif" }}>{typeof b.inhalt === 'string' ? b.inhalt : ''}</div>
            </div>
          )

          if (id === 'quiz' && quiz) return (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 14 }}>Frage</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--lbf-text)', lineHeight: 1.55, marginBottom: 18 }}>{quiz.frage}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {quiz.antworten.map((a: string, i: number) => {
                  let bg = 'var(--warm-bg)', border = '1.5px solid rgba(96,8,18,0.12)', col = 'var(--lbf-text)'
                  if (qs.submitted) {
                    if (i === quiz.richtige) { bg = '#f0fdf4'; border = '2px solid #16a34a'; col = '#166534' }
                    else if (i === qs.selected) { bg = '#fef2f2'; border = '2px solid #600812'; col = '#600812' }
                  } else if (i === qs.selected) { bg = 'rgba(107,15,26,0.06)'; border = `2px solid ${accent}`; col = accent }
                  return (
                    <button key={i} disabled={qs.submitted}
                      onClick={() => setFeedQuizState(prev => ({ ...prev, [b.id]: { selected: i, submitted: false } }))}
                      style={{ padding: '12px 14px', borderRadius: 10, border, background: bg, color: col, fontWeight: i === qs.selected || (qs.submitted && i === quiz.richtige) ? 700 : 400, fontSize: 14, cursor: qs.submitted ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                      {a}
                    </button>
                  )
                })}
              </div>
              {!qs.submitted ? (
                <button disabled={qs.selected === null}
                  onClick={() => setFeedQuizState(prev => ({ ...prev, [b.id]: { ...prev[b.id], submitted: true } }))}
                  style={{ marginTop: 14, width: '100%', padding: 14, borderRadius: 10, border: 'none', background: qs.selected === null ? 'var(--warm-bg)' : accent, color: qs.selected === null ? 'var(--warm-gray)' : '#fff', fontWeight: 700, fontSize: 15, cursor: qs.selected === null ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  Antworten
                </button>
              ) : (
                <div style={{ marginTop: 14, padding: '13px 16px', borderRadius: 10, textAlign: 'center', fontWeight: 700, fontSize: 14, background: qs.selected === quiz.richtige ? '#f0fdf4' : '#fef2f2', border: qs.selected === quiz.richtige ? '1px solid #bbf7d0' : '1px solid #fecaca', color: qs.selected === quiz.richtige ? '#166534' : '#600812' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {qs.selected === quiz.richtige
                      ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Richtig!</>
                      : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Falsch — richtige Antwort ist markiert</>}
                  </span>
                </div>
              )}
            </div>
          )

          if (id === 'tags') return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase' as const, letterSpacing: '0.2em', marginBottom: 20 }}>Themen</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {tags.map(t => (
                  <button key={t} onClick={() => { setBibActiveTag(bibActiveTag === t ? null : t); setOpenBook(null) }}
                    style={{ fontSize: 13, fontWeight: 700, fontStyle: 'italic', color: accent, background: 'rgba(96,8,18,0.07)', border: 'none', borderRadius: 99, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          )
          if (typeof id === 'string' && id.startsWith('rich-') && richPages) {
            const pageIdx = parseInt(id.slice(5))
            const richPage = richPages[pageIdx]
            if (!richPage) return null
            return (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 12px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {richPage.blocks.map((block, bi) => (
                  <div key={block.id || bi}>
                    {block.type === 'text' && block.text && (
                      <div dangerouslySetInnerHTML={{ __html: typeof block.text === 'string' ? block.text : '' }} style={{ fontSize: 15, color: 'var(--lbf-text)', lineHeight: 1.85, fontFamily: "Georgia, 'Times New Roman', serif" }} />
                    )}
                    {block.type === 'bild' && (() => {
                      let url: string | null = null
                      if (block.bildIdx !== undefined && bildArr[block.bildIdx]) url = `https://api.responda.systems/api/files/${b.collectionId}/${b.id}/${bildArr[block.bildIdx]}`
                      else if (block.bildExistingUrl) url = block.bildExistingUrl
                      return url ? <img src={url} alt="" style={{ width: '100%', borderRadius: 8, display: 'block', maxHeight: 260, objectFit: 'cover' }} /> : null
                    })()}
                    {block.type === 'video' && block.videoUrl && (
                      <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                        <iframe src={(() => { const yt = block.videoUrl!.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/); return yt ? `https://www.youtube.com/embed/${yt[1]}?rel=0` : block.videoUrl! })()} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen />
                      </div>
                    )}
                    {block.type === 'quiz' && block.quizFrage && (() => {
                      const blockQs = feedQuizState[`${b.id}-${block.id}`] || { selected: null, submitted: false }
                      const antworten = block.quizAntworten || []
                      const richtige = block.quizRichtige ?? 0
                      return (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 10 }}>Quiz</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--lbf-text)', lineHeight: 1.5, marginBottom: 14 }}>{block.quizFrage}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {antworten.filter(a => a.trim()).map((a: string, i: number) => {
                              let bg = 'var(--warm-bg)', border = '1.5px solid rgba(96,8,18,0.12)', col = 'var(--lbf-text)'
                              if (blockQs.submitted) { if (i === richtige) { bg = '#f0fdf4'; border = '2px solid #16a34a'; col = '#166534' } else if (i === blockQs.selected) { bg = '#fef2f2'; border = '2px solid #600812'; col = '#600812' } } else if (i === blockQs.selected) { bg = 'rgba(107,15,26,0.06)'; border = `2px solid ${accent}`; col = accent }
                              return <button key={i} disabled={blockQs.submitted} onClick={() => setFeedQuizState(prev => ({ ...prev, [`${b.id}-${block.id}`]: { selected: i, submitted: false } }))} style={{ padding: '10px 12px', borderRadius: 9, border, background: bg, color: col, fontWeight: i === blockQs.selected || (blockQs.submitted && i === richtige) ? 700 : 400, fontSize: 14, cursor: blockQs.submitted ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>{a}</button>
                            })}
                          </div>
                          {!blockQs.submitted ? (
                            <button disabled={blockQs.selected === null} onClick={() => setFeedQuizState(prev => ({ ...prev, [`${b.id}-${block.id}`]: { ...prev[`${b.id}-${block.id}`], submitted: true } }))} style={{ marginTop: 12, width: '100%', padding: 12, borderRadius: 9, border: 'none', background: blockQs.selected === null ? 'var(--warm-bg)' : accent, color: blockQs.selected === null ? 'var(--warm-gray)' : '#fff', fontWeight: 700, fontSize: 14, cursor: blockQs.selected === null ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Antworten</button>
                          ) : (
                            <div style={{ marginTop: 12, padding: '11px 14px', borderRadius: 9, textAlign: 'center', fontWeight: 700, fontSize: 13, background: blockQs.selected === richtige ? '#f0fdf4' : '#fef2f2', border: blockQs.selected === richtige ? '1px solid #bbf7d0' : '1px solid #fecaca', color: blockQs.selected === richtige ? '#166534' : '#600812' }}>
                              {blockQs.selected === richtige ? '✓ Richtig!' : '✗ Falsch — richtige Antwort ist markiert'}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                ))}
              </div>
            )
          }
          return null
        }

        return (
          <>
            <div onClick={() => setOpenBook(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,6,0.8)', zIndex: 200 }} />
            <div
              onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
              onTouchEnd={e => { const d = touchStartX.current - e.changedTouches[0].clientX; if (Math.abs(d) > 48) go(d > 0 ? 1 : -1) }}
              style={{
                position: 'fixed', left: '50%', top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(calc(100vw - 32px), 420px)',
                height: 'min(88dvh, 660px)',
                zIndex: 201,
                background: 'var(--lbf-card)',
                borderRadius: 3,
                boxShadow: '0 30px 90px rgba(0,0,0,0.5), -6px 0 18px rgba(0,0,0,0.2)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                animation: 'bookOpen 0.32s cubic-bezier(0.22,1,0.36,1)',
              }}>

              {/* Spine */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 9, zIndex: 10, pointerEvents: 'none',
                background: `linear-gradient(to right, ${accent}, ${accent}88 60%, transparent)` }} />
              {readerPattern && (() => { const pp = getPatternBg(readerPattern); return pp ? <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 9, zIndex: 11, pointerEvents: 'none', backgroundImage: pp.backgroundImage, backgroundSize: pp.backgroundSize || 'auto' }} /> : null })()}
              {/* Spine inner shadow */}
              <div style={{ position: 'absolute', left: 9, top: 0, bottom: 0, width: 22, zIndex: 10, pointerEvents: 'none',
                background: 'linear-gradient(to right, rgba(0,0,0,0.09), transparent)' }} />
              {/* Right edge shadow */}
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 12, zIndex: 10, pointerEvents: 'none',
                background: 'linear-gradient(to left, rgba(0,0,0,0.06), transparent)' }} />

              {/* Close */}
              <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 20 }}>
                <button onClick={() => setOpenBook(null)} style={{ background: 'rgba(96,8,18,0.07)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#8a7a68' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Page content with slide animation */}
              <div key={`${b.id}-${bookPage}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: `pageIn${bookDir >= 0 ? 'R' : 'L'} 0.2s ease-out` }}>
                {renderPage(pid)}
              </div>

              {/* Bottom nav */}
              <div style={{ flexShrink: 0, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'var(--lbf-card)', zIndex: 5 }}>
                <button onClick={() => go(-1)} disabled={!canPrev}
                  style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: canPrev ? 'rgba(96,8,18,0.07)' : 'transparent', color: canPrev ? accent : 'rgba(96,8,18,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canPrev ? 'pointer' : 'default' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  {pages.map((_, i) => (
                    <div key={i} onClick={() => { setBookDir(i > bookPage ? 1 : -1); setBookPage(i) }}
                      style={{ width: i === bookPage ? 20 : 6, height: 6, borderRadius: 3, background: i === bookPage ? accent : 'rgba(96,8,18,0.14)', cursor: 'pointer', transition: 'width 0.22s, background 0.22s' }} />
                  ))}
                </div>
                <button onClick={() => go(1)} disabled={!canNext}
                  style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: canNext ? 'rgba(96,8,18,0.07)' : 'transparent', color: canNext ? accent : 'rgba(96,8,18,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canNext ? 'pointer' : 'default' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>

            <style>{`
              @keyframes bookOpen {
                from { opacity: 0; transform: translate(-50%, -50%) scale(0.9) perspective(800px) rotateY(-6deg); }
                to   { opacity: 1; transform: translate(-50%, -50%) scale(1) perspective(800px) rotateY(0deg); }
              }
              @keyframes pageInR {
                from { opacity: 0; transform: translateX(28px); }
                to   { opacity: 1; transform: none; }
              }
              @keyframes pageInL {
                from { opacity: 0; transform: translateX(-28px); }
                to   { opacity: 1; transform: none; }
              }
            `}</style>
          </>
        )
      })()}

      {/* Termin Detail Sheet */}
      {detailTermin && (() => {
        const termin = detailTermin
        const tu = terminUser.find(t => t.termin_id === termin.id)
        const cfg = tu ? statusConfig[tu.status] : null
        const startTime = fmtTime(termin.start_datetime)
        const endTime = termin.end_datetime ? fmtTime(termin.end_datetime) : ''
        const dateien: string[] = Array.isArray(termin.dateien) ? termin.dateien : Array.isArray(termin.anhang) ? termin.anhang : []
        return (
          <>
            {/* Backdrop */}
            <div onClick={() => setDetailTermin(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200 }} />
            {/* Sheet */}
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', maxHeight: '88dvh', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
              {/* Drag handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(96,8,18,0.2)' }} />
              </div>
              {/* Header */}
              <div style={{ padding: '8px 20px 14px', borderBottom: '1px solid rgba(96,8,18,0.12)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 19, color: 'var(--lbf-text)', lineHeight: 1.25, marginBottom: 6 }}>{termin.name}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--warm-gray)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {fmtDate(termin.start_datetime)}
                    </div>
                    {startTime && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--warm-gray)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {startTime}{endTime ? ` – ${endTime}` : ''} Uhr
                      </div>
                    )}
                    {termin.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--warm-gray)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {termin.location}
                      </div>
                    )}
                    {termin.dozent && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--warm-gray)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        {termin.dozent}
                      </div>
                    )}
                  </div>
                  {cfg && <span style={{ display: 'inline-block', marginTop: 8, padding: '4px 12px', borderRadius: 99, background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 12 }}>{cfg.label}</span>}
                </div>
                <button onClick={() => setDetailTermin(null)} style={{ background: 'rgba(96,8,18,0.06)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: 'var(--warm-gray)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Actions */}
                {tu && (tu.status === 'eingeladen' || tu.status === 'abgesagt' || tu.status === 'zugesagt') && termin.status !== 'abgeschlossen' && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    {tu.status !== 'zugesagt' && (
                      <button onClick={() => { updateTerminStatus(tu.id, 'zugesagt'); setDetailTermin(null) }}
                        style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Zusagen
                      </button>
                    )}
                    {tu.status !== 'abgesagt' && (
                      <button onClick={() => { updateTerminStatus(tu.id, 'abgesagt'); setDetailTermin(null) }}
                        style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid rgba(96,8,18,0.12)', background: 'var(--warm-bg)', color: 'var(--lbf-text)', fontWeight: 600, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Absagen
                      </button>
                    )}
                  </div>
                )}
                {tu?.status === 'zugesagt' && <CalendarButtons termin={termin} />}

                {/* Description */}
                {termin.description && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Beschreibung</div>
                    <div style={{ fontSize: 15, color: 'var(--lbf-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{termin.description}</div>
                  </div>
                )}

                {/* Lernkonzept */}
                {termin.lernkonzept && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Lernkonzept</div>
                    <div style={{ background: 'var(--warm-bg)', borderRadius: 12, padding: '14px 16px', fontSize: 15, color: 'var(--lbf-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', borderLeft: '3px solid #600812' }}>{termin.lernkonzept}</div>
                  </div>
                )}

                {/* Files */}
                {dateien.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Dateien</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {dateien.map((file: string, i: number) => {
                        const fileUrl = `https://api.responda.systems/api/files/${termin.collectionId}/${termin.id}/${file}`
                        const ext = file.split('.').pop()?.toLowerCase() ?? ''
                        return (
                          <a key={i} href={fileUrl} target="_blank" rel="noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--warm-bg)', border: '1px solid rgba(96,8,18,0.12)', borderRadius: 12, textDecoration: 'none', color: 'var(--lbf-text)' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(107,15,26,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file}</div>
                              {ext && <div style={{ fontSize: 11, color: 'var(--warm-gray)', textTransform: 'uppercase', marginTop: 1 }}>{ext}</div>}
                            </div>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warm-gray)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}

                {!termin.description && !termin.lernkonzept && dateien.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--warm-gray)', padding: '20px 0', fontSize: 14 }}>
                    Keine weiteren Informationen hinterlegt
                  </div>
                )}
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
