import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import PocketBase from 'pocketbase'
import StatusBar from '../../components/StatusBar'
import { useAuth } from '../../hooks/useAuth'

const pb = new PocketBase('https://api.responda.systems')

const EDITABLE_EXTS = ['docx', 'doc', 'odt', 'rtf', 'txt', 'xlsx', 'xls', 'ods', 'csv', 'pptx', 'ppt', 'odp', 'pdf']
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']
const FILE_TYPE_STYLES: Record<string, { color: string; label: string }> = {
  pdf: { color: '#dc2626', label: 'PDF' },
  doc: { color: '#2563eb', label: 'DOC' },
  docx: { color: '#2563eb', label: 'DOC' },
  odt: { color: '#2563eb', label: 'ODT' },
  rtf: { color: '#2563eb', label: 'RTF' },
  txt: { color: '#8a7a68', label: 'TXT' },
  xls: { color: '#16a34a', label: 'XLS' },
  xlsx: { color: '#16a34a', label: 'XLS' },
  ods: { color: '#16a34a', label: 'ODS' },
  csv: { color: '#16a34a', label: 'CSV' },
  ppt: { color: '#ea580c', label: 'PPT' },
  pptx: { color: '#ea580c', label: 'PPT' },
  odp: { color: '#ea580c', label: 'ODP' },
}

function getFileDisplayName(file: string, names: Record<string, string>): string {
  return names[file] || file
}

// PocketBase stores dates as "2026-01-15 14:00:00.000Z" (space instead of T)
// new Date() needs ISO format with T, so we normalize first
function parseDate(str: string | null | undefined): Date {
  if (!str) return new Date(NaN)
  // Replace space separator and ensure Z suffix for Safari compatibility
  let s = str.trim().replace(' ', 'T')
  if (!s.endsWith('Z') && !s.includes('+') && !/ [+-]\d{2}:\d{2}$/.test(s)) {
    s += 'Z'
  }
  return new Date(s)
}

function formatDateForInput(str: string | null | undefined): string {
  if (!str) return ''
  const d = parseDate(str)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 16)
}

function fmtDate(str: string | null | undefined): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return '–'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(str: string | null | undefined): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return '–'
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtTime(str: string | null | undefined): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return '–'
  return d.toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function fmtDayMonth(str: string | null | undefined): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return '–'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

interface Termin {
  id: string
  name: string
  description: string
  start_datetime: string
  end_datetime: string
  location: string
  dozent: string
  dozent_id?: string
  max_teilnehmer: number
  status: 'geplant' | 'laufend' | 'abgeschlossen' | 'abgesagt'
  konzept_id?: string
  notizen?: string
  einladung_token?: string
  lernkonzept?: string
  teilnehmer_info?: string
  dateien?: string | string[]
  anhang?: string | string[]
  dozent_todos?: string
  co_dozenten?: string
  dozent_aufgaben?: string
  dateien_links?: string
  anhang_links?: string
  dateien_names?: string
  anhang_names?: string
  organization_id: string
  created: string
  updated: string
  collectionId: string
}

interface Teilnehmer {
  id: string
  vorname: string
  nachname: string
  email: string          // PocketBase Auth-Email (Platzhalter, nicht änderbar via API)
  contact_email: string  // Echte Email (normales Text-Feld, frei änderbar)
  telefon: string
  whatsapp: string
  notizen: string
  ausbildung_typ: string
  lernbar_zugang_aktiv: boolean
  organization_id: string
  created: string
}

interface TerminTeilnehmer {
  id: string
  termin_id: string
  teilnehmer_id: string
  status: 'eingeladen' | 'zugesagt' | 'abgesagt' | 'entschuldigt'
  eingeladen_am: string
  eingeladen_via: 'email' | 'whatsapp' | 'persönlich' | 'telefon'
  anwesend: boolean
  anwesenheit_status?: 'da' | 'krank' | 'entschuldigt' | 'fehlend' | ''
  notizen: string
  organization_id: string
  expand?: {
    teilnehmer_id?: Teilnehmer
  }
}

interface EditorBlock {
  id: string
  type: 'text' | 'bild' | 'video' | 'quiz'
  text: string
  imageFile: File | null
  imagePreview: string | null
  videoUrl: string
  quizFrage: string
  quizAntworten: [string, string, string, string]
  quizRichtige: number
}
interface EditorPage {
  id: string
  blocks: EditorBlock[]
}
interface Lernbeitrag {
  id: string
  collectionId: string
  typ: 'bild' | 'text' | 'video' | 'quiz'
  titel: string
  inhalt: string
  bild?: string | string[]
  video_url?: string
  dateien?: string | string[]
  tags: string[]
  organisation_id: string
  erstellt_von_name: string
  gepinnt: boolean
  quiz_daten?: { frage: string; antworten: string[]; richtige: number }
  created: string
}

interface Dokument {
  id: string
  termin_id: string
  name: string
  typ: 'dozent' | 'teilnehmer'
  datei?: string
  oder_dateien_id?: string
  beschreibung: string
  organization_id: string
  created: string
}

interface Modul {
  id: string
  name: string
  beschreibung: string
  inhalte: ModulInhalt[]
  dauer_minuten: number
  min_pass_percent: number
  organization_id: string
  created: string
}

interface ModulInhalt {
  typ: 'text' | 'quiz'
  titel: string
  inhalt: string
  reihenfolge: number
}

interface QuizFrage {
  frage: string
  antworten: string[]
  richtige: number
}

interface ModulTermin {
  id: string
  modul_id: string
  termin_id: string
  pflicht: boolean
  frist_datum: string
  organization_id: string
  expand?: {
    modul_id?: Modul
  }
}

interface ModulProgress {
  id: string
  modul_id: string
  teilnehmer_id: string
  termin_id?: string
  fortschritt_prozent: number
  gestartet_am?: string
  abgeschlossen_am?: string
  notizen: string
  organization_id: string
}

interface Ausbildungskonzept {
  id: string
  name: string
  beschreibung: string
  lernziele: string[]
  handlungen: string[]
  koennen: string[]
  wissensanhang_links: {titel: string, url: string}[]
  verknuepfte_module: string[]
  verknuepfte_termine: string[]
  organization_id: string
  created: string
}

interface PraesentationSlide {
  id: string
  layout: 'title' | 'content' | 'image' | 'blank'
  bg: string
  pattern?: string | null
  title?: string
  body?: string
  textColor?: string
  imageFile?: File | null
  imagePreview?: string | null
  imageExistingUrl?: string | null
}

interface Praesentation {
  id: string
  collectionId: string
  titel: string
  termin_id?: string
  inhalt: string
  bilder?: string | string[]
  organization_id: string
  created_by?: string
  created: string
}

interface TerminForm {
  id?: string
  name: string
  description: string
  start_datetime: string
  end_datetime: string
  location: string
  dozent: string
  dozent_id?: string
  max_teilnehmer: number
  status: 'geplant' | 'laufend' | 'abgeschlossen' | 'abgesagt'
  konzept_id?: string
  notizen?: string
}

interface TeilnehmerForm {
  id?: string
  vorname: string
  nachname: string
  email: string         // contact_email (echte Email)
  telefon: string
  whatsapp: string
  ausbildung_typ: string
  notizen: string
  lernbar_zugang_aktiv: boolean
}

interface ModulForm {
  id?: string
  name: string
  beschreibung: string
  inhalte: ModulInhalt[]
  dauer_minuten: number
  min_pass_percent: number
}

interface KonzeptForm {
  id?: string
  name: string
  beschreibung: string
  lernziele: string[]
  handlungen: string[]
  koennen: string[]
  wissensanhang_links: {titel: string, url: string}[]
  verknuepfte_module: string[]
  verknuepfte_termine: string[]
}

function TextBlockEditor({ initialText, onUpdate }: { initialText: string; onUpdate: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current) ref.current.innerHTML = initialText }, [])
  const fmt = (cmd: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false)
    if (ref.current) onUpdate(ref.current.innerHTML)
  }
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <div style={{ flex: 1, fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.18em' }}>Text</div>
        {[['B','bold'],['I','italic'],['U','underline']].map(([lbl, cmd]) => (
          <button key={cmd} type="button" onMouseDown={e => { e.preventDefault(); fmt(cmd) }}
            style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid rgba(96,8,18,0.18)', background: 'rgba(96,8,18,0.03)', cursor: 'pointer', color: '#600812', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'inherit', fontSize: 12, fontWeight: lbl === 'B' ? 700 : 400, fontStyle: lbl === 'I' ? 'italic' : 'normal', textDecoration: lbl === 'U' ? 'underline' : 'none', flexShrink: 0 }}>
            {lbl}
          </button>
        ))}
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => { if (ref.current) onUpdate(ref.current.innerHTML) }}
        style={{ width: '100%', minHeight: 72, outline: 'none', border: 'none', borderBottom: '0.5px solid rgba(96,8,18,0.1)', background: 'transparent', fontSize: 15, color: '#1a0e08', lineHeight: 1.85, fontFamily: "Georgia, 'Times New Roman', serif", padding: '0 0 6px 0', boxSizing: 'border-box' as const, wordBreak: 'break-word' } as React.CSSProperties}
      />
    </>
  )
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

function PdfThumbnail({ url, typeColor }: { url: string; typeColor: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return
      observer.disconnect()
      ;(async () => {
        try {
          const pdfjs: any = await import('pdfjs-dist')
          pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
          const doc = await pdfjs.getDocument(url).promise
          const page = await doc.getPage(1)
          const baseViewport = page.getViewport({ scale: 1 })
          const targetWidth = (containerRef.current?.clientWidth || 160) * Math.min(window.devicePixelRatio || 1, 2)
          const viewport = page.getViewport({ scale: targetWidth / baseViewport.width })
          const canvas = canvasRef.current
          if (!canvas || cancelled) return
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          await page.render({ canvasContext: ctx, viewport }).promise
          if (!cancelled) setLoaded(true)
        } catch {
          if (!cancelled) setError(true)
        }
      })()
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => { cancelled = true; observer.disconnect() }
  }, [url])

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: loaded ? 'block' : 'none' }} />
      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={typeColor} strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          {error && <span style={{ fontSize: 10, fontWeight: 700, color: typeColor, letterSpacing: '0.06em' }}>PDF</span>}
        </div>
      )}
    </div>
  )
}

function FileCard({ name, ext, url, accent, onSchreibstube, onVollbild, onRemove, onRename }: {
  name: string
  ext: string
  url: string
  accent: string
  onSchreibstube?: () => void
  onVollbild?: () => void
  onRemove?: () => void
  onRename?: (newName: string) => void
}) {
  const [showChoice, setShowChoice] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(name)
  const isImage = IMAGE_EXTS.includes(ext)
  const typeStyle = FILE_TYPE_STYLES[ext] || { color: 'var(--warm-gray)', label: ext ? ext.toUpperCase() : 'DATEI' }

  function openNormal() {
    if (ext === 'pdf' && onVollbild) onVollbild()
    else window.open(url, '_blank', 'noopener')
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (onSchreibstube) setShowChoice(true)
    else openNormal()
  }

  function openManage(e: React.MouseEvent) {
    e.preventDefault()
    setRenameValue(name)
    setRenaming(false)
    setShowManage(true)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderTop: `3px solid ${accent}`, position: 'relative' }}>
      {(onRemove || onRename) && (
        <button onClick={openManage} title="Optionen" style={{ position: 'absolute', top: 6, right: 6, zIndex: 1, width: 22, height: 22, borderRadius: '50%', background: 'rgba(26,14,8,0.5)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
        </button>
      )}
      <a href={url} onClick={handleClick} style={{ display: 'block', aspectRatio: '4 / 3', position: 'relative', textDecoration: 'none', cursor: 'pointer', background: isImage ? `center / cover no-repeat url("${url}")` : 'rgba(96,8,18,0.03)' }}>
        {ext === 'pdf' && <PdfThumbnail url={url} typeColor={typeStyle.color} />}
        {!isImage && ext !== 'pdf' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={typeStyle.color} strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span style={{ fontSize: 10, fontWeight: 700, color: typeStyle.color, letterSpacing: '0.06em' }}>{typeStyle.label}</span>
          </div>
        )}
      </a>
      <div style={{ padding: '8px 10px' }}>
        <div title={name} style={{ fontSize: 12, color: 'var(--lbf-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
      </div>
      {showChoice && (
        <>
          <div onClick={() => setShowChoice(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.45)', zIndex: 900 }} />
          <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 901, background: '#fff', borderRadius: 14, padding: 18, width: 'min(300px, 86vw)', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
            <div title={name} style={{ fontSize: 13, fontWeight: 700, fontStyle: 'italic', color: 'var(--lbf-text)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 16 }}>Wie möchtest du die Datei öffnen?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => { setShowChoice(false); onSchreibstube?.() }} style={{ background: '#600812', border: 'none', borderRadius: 8, padding: '10px 0', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                In Schreibstube öffnen
              </button>
              <button onClick={() => { setShowChoice(false); openNormal() }} style={{ background: '#fff', border: '1px solid rgba(96,8,18,0.2)', borderRadius: 8, padding: '10px 0', color: 'var(--lbf-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Normal öffnen
              </button>
            </div>
          </div>
        </>
      )}
      {showManage && (
        <>
          <div onClick={() => setShowManage(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.45)', zIndex: 900 }} />
          <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 901, background: '#fff', borderRadius: 14, padding: 18, width: 'min(300px, 86vw)', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
            {renaming ? (
              <>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 8 }}>Neuer Name</div>
                <input
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(96,8,18,0.2)', fontSize: 13, fontFamily: 'inherit', marginBottom: 14, color: 'var(--lbf-text)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => { const v = renameValue.trim(); if (v) onRename?.(v); setShowManage(false) }} style={{ background: accent, border: 'none', borderRadius: 8, padding: '10px 0', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Speichern
                  </button>
                  <button onClick={() => setRenaming(false)} style={{ background: '#fff', border: '1px solid rgba(96,8,18,0.2)', borderRadius: 8, padding: '10px 0', color: 'var(--lbf-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Zurück
                  </button>
                </div>
              </>
            ) : (
              <>
                <div title={name} style={{ fontSize: 13, fontWeight: 700, fontStyle: 'italic', color: 'var(--lbf-text)', marginBottom: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {onRename && (
                    <button onClick={() => setRenaming(true)} style={{ background: '#fff', border: '1px solid rgba(96,8,18,0.2)', borderRadius: 8, padding: '10px 0', color: 'var(--lbf-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Umbenennen
                    </button>
                  )}
                  {onRemove && (
                    <button onClick={() => { setShowManage(false); onRemove() }} style={{ background: '#fff', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, padding: '10px 0', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Löschen
                    </button>
                  )}
                  <button onClick={() => setShowManage(false)} style={{ background: 'transparent', border: 'none', borderRadius: 8, padding: '8px 0', color: 'var(--warm-gray)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Abbrechen
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function AddFileCard({ accent, accentRgb, uploading, onUpload, onLibrary, accept }: {
  accent: string
  accentRgb: string
  uploading: boolean
  onUpload: (file: File) => void
  onLibrary: () => void
  accept?: string
}) {
  const [showChoice, setShowChoice] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{ position: 'relative' }}>
      <div onClick={() => !uploading && setShowChoice(true)} style={{ aspectRatio: '4 / 3', borderRadius: 12, border: `1.5px dashed rgba(${accentRgb},0.3)`, background: `rgba(${accentRgb},0.02)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: uploading ? 'default' : 'pointer' }}>
        {uploading ? (
          <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Lade hoch…</span>
        ) : (
          <>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>Hinzufügen</span>
          </>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept={accept} style={{ display: 'none' }} disabled={uploading}
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }} />
      {showChoice && (
        <>
          <div onClick={() => setShowChoice(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.45)', zIndex: 900 }} />
          <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 901, background: '#fff', borderRadius: 14, padding: 18, width: 'min(300px, 86vw)', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, fontStyle: 'italic', color: 'var(--lbf-text)', marginBottom: 16 }}>Datei hinzufügen</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => { setShowChoice(false); fileInputRef.current?.click() }} style={{ background: accent, border: 'none', borderRadius: 8, padding: '10px 0', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Hochladen
              </button>
              <button onClick={() => { setShowChoice(false); onLibrary() }} style={{ background: '#fff', border: '1px solid rgba(96,8,18,0.2)', borderRadius: 8, padding: '10px 0', color: 'var(--lbf-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Aus Bibliothek
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function Ausbildungen() {
  const { user, loading: authLoading, logout } = useAuth()
  const navigate = useNavigate()

  const [termine, setTermine] = useState<Termin[]>([])
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([])
  const [terminTeilnehmer, setTerminTeilnehmer] = useState<TerminTeilnehmer[]>([])
  const [dokumente, setDokumente] = useState<Dokument[]>([])
  const [module, setModule] = useState<Modul[]>([])
  const [modulTermine, setModulTermine] = useState<ModulTermin[]>([])
  const [modulProgress, setModulProgress] = useState<ModulProgress[]>([])
  const [konzepte, setKonzepte] = useState<Ausbildungskonzept[]>([])
  const [einladungen, setEinladungen] = useState<{id: string, termin_id: string, name: string, status: string, anwesenheit_status?: 'da' | 'krank' | 'entschuldigt' | 'fehlend' | ''}[]>([])

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null)

  
  const [showAddTerminModal, setShowAddTerminModal] = useState(false)
  const [showTerminDetailModal, setShowTerminDetailModal] = useState(false)
  const [showAddTeilnehmerModal, setShowAddTeilnehmerModal] = useState(false)
  const [showTeilnehmerDetailModal, setShowTeilnehmerDetailModal] = useState(false)
  const [showAddModulModal, setShowAddModulModal] = useState(false)
  const [showUploadDokumentModal, setShowUploadDokumentModal] = useState(false)
  const [showAssignModulModal, setShowAssignModulModal] = useState(false)
  const [showAddKonzeptModal, setShowAddKonzeptModal] = useState(false)
  const [showKonzeptDetailModal, setShowKonzeptDetailModal] = useState(false)
  
  const [terminForm, setTerminForm] = useState<TerminForm>({
    name: '',
    description: '',
    start_datetime: '',
    end_datetime: '',
    location: '',
    dozent: '',
    dozent_id: '',
    max_teilnehmer: 20,
    status: 'geplant',
    konzept_id: '',
    notizen: ''
  })
  const [konzeptSuggestions, setKonzeptSuggestions] = useState<Ausbildungskonzept[]>([])
  
  const [teilnehmerForm, setTeilnehmerForm] = useState<TeilnehmerForm>({
    vorname: '',
    nachname: '',
    email: '',
    telefon: '',
    whatsapp: '',
    ausbildung_typ: '',
    notizen: '',
    lernbar_zugang_aktiv: false
  })
  const [originalEmail, setOriginalEmail] = useState('')
  
  const [modulForm, setModulForm] = useState<ModulForm>({
    name: '',
    beschreibung: '',
    inhalte: [],
    dauer_minuten: 60,
    min_pass_percent: 80
  })

  const [konzeptForm, setKonzeptForm] = useState<KonzeptForm>({
    name: '',
    beschreibung: '',
    lernziele: [],
    handlungen: [],
    koennen: [],
    wissensanhang_links: [],
    verknuepfte_module: [],
    verknuepfte_termine: []
  })
  
  const [selectedTermin, setSelectedTermin] = useState<Termin | null>(null)
  const [selectedTeilnehmer, setSelectedTeilnehmer] = useState<Teilnehmer | null>(null)
  const [selectedKonzept, setSelectedKonzept] = useState<Ausbildungskonzept | null>(null)
  const [selectedModul, setSelectedModul] = useState<Modul | null>(null)
  const [showModulDetailModal, setShowModulDetailModal] = useState(false)
  const [selectedModulTab, setSelectedModulTab] = useState<'inhalt' | 'teilnehmer'>('inhalt')
  const [currentTerminTab, setCurrentTerminTab] = useState<'uebersicht' | 'teilnehmer' | 'dokumente' | 'module'>('uebersicht')
  const [selectedTeilnehmerDetail, setSelectedTeilnehmerDetail] = useState<Teilnehmer | null>(null)
  const [selectedTeilnehmerTab, setSelectedTeilnehmerTab] = useState<'uebersicht' | 'lernmodule' | 'termine'>('uebersicht')
  const [addModulTeilnehmerId, setAddModulTeilnehmerId] = useState('')
  const [editingQuizBlock, setEditingQuizBlock] = useState<number | null>(null)
  const [newQuizFrage, setNewQuizFrage] = useState('')
  const [newQuizAntworten, setNewQuizAntworten] = useState(['', '', '', ''])
  const [newQuizRichtige, setNewQuizRichtige] = useState(0)

  // Lernfeed
  const [beitraege, setBeitraege] = useState<Lernbeitrag[]>([])
  const [beitraegeLoading, setBeitraegeLoading] = useState(false)
  const [showBeitragModal, setShowBeitragModal] = useState(false)
  const [beitragForm, setBeitragForm] = useState<{ titel: string; tags: string; gepinnt: boolean; color: string; pattern: string | null; coverBlockId: string | null }>({ titel: '', tags: '', gepinnt: false, color: '#600812', pattern: null, coverBlockId: null })
  const [bookPages, setBookPages] = useState<EditorPage[]>([])
  const [bookPageIdx, setBookPageIdx] = useState(0)
  const [bookDir, setBookDir] = useState(1)
  const [showBlockPicker, setShowBlockPicker] = useState(false)
  const [savingBeitrag, setSavingBeitrag] = useState(false)
  const [editingBeitragId, setEditingBeitragId] = useState<string | null>(null)
  const [pdfFiles, setPdfFiles] = useState<File[]>([])
  const [generatingAIImage, setGeneratingAIImage] = useState(false)
  const [aiImageTargetBlock, setAiImageTargetBlock] = useState<string | null>(null)
  
const [viewMode, setViewMode] = useState<'termine' | 'teilnehmer' | 'module' | 'konzepte' | 'jahresuebersicht' | 'archiv' | 'lernfeed' | 'dozent' | 'praesentationen'>('termine')
  const [terminDetailPage, setTerminDetailPage] = useState<Termin | null>(null)
  const [dozentTermineFilter, setDozentTermineFilter] = useState<'meine' | 'alle'>('meine')
  const [dozentTodos, setDozentTodos] = useState<{id: string; text: string; done: boolean}[]>([])
  const [dozentAufgaben, setDozentAufgaben] = useState<{id: string; text: string; assignee_id?: string; assignee_name?: string; done: boolean}[]>([])
  const [coDozenten, setCoDozenten] = useState<{user_id: string; name: string}[]>([])
  const [newTodoText, setNewTodoText] = useState('')
  const [newAufgabeText, setNewAufgabeText] = useState('')
  const [newAufgabeAssignee, setNewAufgabeAssignee] = useState('')
  const [uploadingDozentFile, setUploadingDozentFile] = useState(false)
  const [uploadingTNFile, setUploadingTNFile] = useState(false)
  const [showFilePicker, setShowFilePicker] = useState<'dozent' | 'tn' | false>(false)
  const [filePickerItems, setFilePickerItems] = useState<{id: string; name: string; file: string; file_type?: string}[]>([])
  const [filePickerLoading, setFilePickerLoading] = useState(false)
  const [filePickerSearch, setFilePickerSearch] = useState('')
  const [dateienLinks, setDateienLinks] = useState<{id: string; name: string; file: string}[]>([])
  const [anhangLinks, setAnhangLinks] = useState<{id: string; name: string; file: string}[]>([])
  const [dateienNames, setDateienNames] = useState<Record<string, string>>({})
  const [anhangNames, setAnhangNames] = useState<Record<string, string>>({})
  const [terminDetailTab, setTerminDetailTab] = useState<'info' | 'anwesenheit' | 'dateien' | 'dozenten'>('info')
  const [editingTNInfo, setEditingTNInfo] = useState(false)
  const [tnInfoText, setTNInfoText] = useState('')
  const [editingLernkonzept, setEditingLernkonzept] = useState(false)
  const [lernkonzeptText, setLernkonzeptText] = useState('')

  const [praesentationen, setPraesentationen] = useState<Praesentation[]>([])
  const [praesentationenLoading, setPraesentationenLoading] = useState(false)
  const [showPraesentationEditor, setShowPraesentationEditor] = useState(false)
  const [editingPraesentation, setEditingPraesentation] = useState<Praesentation | null>(null)
  const [praesentationTitel, setPraesentationTitel] = useState('')
  const [praesentationTerminId, setPraesentationTerminId] = useState('')
  const [praesentationSlides, setPraesentationSlides] = useState<PraesentationSlide[]>([])
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0)
  const [savingPraesentation, setSavingPraesentation] = useState(false)
  const [showPresentationMode, setShowPresentationMode] = useState(false)
  const [presentationModeSlideIdx, setPresentationModeSlideIdx] = useState(0)
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null)

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTyp, setUploadTyp] = useState<'dozent' | 'teilnehmer'>('teilnehmer')
  const [uploadBeschreibung, setUploadBeschreibung] = useState('')

  const [newLernziel, setNewLernziel] = useState('')
  const [newHandlung, setNewHandlung] = useState('')
  const [newKoennen, setNewKoennen] = useState('')
  const [newLinkTitel, setNewLinkTitel] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')

  const [allUsers, setAllUsers] = useState<any[]>([])
  const [existingUserDetected, setExistingUserDetected] = useState<any>(null)

  useEffect(() => {
    if (user?.organization_id) {
      loadData()
      loadAllUsers()
      loadPraesentationen()
    }
  }, [user])

  // Fullscreen when presentation mode opens/closes
  useEffect(() => {
    const el = document.documentElement as any
    if (showPresentationMode) {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
    } else {
      const doc = document as any
      if (doc.fullscreenElement && doc.exitFullscreen) doc.exitFullscreen().catch(() => {})
      else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) doc.webkitExitFullscreen()
    }
  }, [showPresentationMode])

  if (authLoading) {
    return null
  }

  async function loadData() {
    if (!user?.organization_id) return
    
    try {
      setLoading(true)
      await Promise.all([
        loadTermine(),
        loadTeilnehmer(),
        loadTerminTeilnehmer(),
        loadDokumente(),
        loadModule(),
        loadModulTermine(),
        loadModulProgress(),
        loadKonzepte(),
      ])
    } catch(e: any) {
      console.error('Fehler beim Laden:', e)
      showMessage('Fehler beim Laden der Daten', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadTermine() {
    try {
      const records = await pb.collection('ausbildungen_termine').getFullList({
        filter: `organization_id = "${user?.organization_id}"`,
        sort: '-start_datetime',
        requestKey: `loadTermine-${Date.now()}`
      })
      setTermine(records)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadTermine:', e)
    }
  }

  async function loadTeilnehmer() {
    try {
      const userRecords = await pb.collection('users').getFullList({
        filter: `organization_id = "${user?.organization_id}" && role = "teilnehmer"`,
        sort: 'name',
        requestKey: `loadTeilnehmer-${Date.now()}`
      })
      const teilnehmerData = userRecords.map(u => ({
        id: u.id,
        vorname: u.name?.split(' ')[0] || '',
        nachname: u.name?.split(' ').slice(1).join(' ') || '',
        // contact_email bevorzugen; falls leer, normale email nehmen (wenn kein Platzhalter)
        email: u.contact_email || (u.email?.includes('@kein-email.intern') ? '' : (u.email || '')),
        contact_email: u.contact_email || '',
        telefon: u.phone || '',
        whatsapp: u.whatsapp || '',
        notizen: u.notizen || '',
        ausbildung_typ: u.ausbildung_typ || '',
        lernbar_zugang_aktiv: u.permissions?.lernbar || false,
        organization_id: u.organization_id,
        created: u.created
      }))
      setTeilnehmer(teilnehmerData)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadTeilnehmer:', e)
    }
  }

  async function loadTerminTeilnehmer() {
    try {
      const records = await pb.collection('ausbildungen_termine_user').getFullList({
        sort: 'created',
        requestKey: `loadTerminTeilnehmer-${Date.now()}`
      })
      setTerminTeilnehmer(records)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadTerminTeilnehmer:', e)
    }
  }

  async function loadDokumente() {
    try {
      const records = await pb.collection('ausbildungen_dokumente').getFullList({
        filter: `organization_id = "${user?.organization_id}"`,
        sort: '-created',
        requestKey: `loadDokumente-${Date.now()}`
      })
      setDokumente(records)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadDokumente:', e)
    }
  }

  async function loadModule() {
    try {
      const records = await pb.collection('ausbildungen_module').getFullList({
        filter: `organization_id = "${user?.organization_id}"`,
        sort: 'name',
        requestKey: `loadModule-${Date.now()}`
      })
      setModule(records)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadModule:', e)
    }
  }

  async function loadModulTermine() {
    try {
      const records = await pb.collection('ausbildungen_module_termine').getFullList({
        expand: 'modul_id',
        sort: '-created',
        requestKey: `loadModulTermine-${Date.now()}`
      })
      setModulTermine(records)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadModulTermine:', e)
    }
  }

  async function loadModulProgress() {
    try {
      const records = await pb.collection('ausbildungen_module_progress').getFullList({
        sort: 'created',
        requestKey: `loadModulProgress-${Date.now()}`
      })
      setModulProgress(records)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadModulProgress:', e)
    }
  }

  async function loadKonzepte() {
    try {
      const records = await pb.collection('ausbildungen_konzepte').getFullList({
        filter: `organization_id = "${user?.organization_id}"`,
        sort: '-created',
        requestKey: `loadKonzepte-${Date.now()}`
      })
      setKonzepte(records)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadKonzepte:', e)
    }
  }





  async function loadBeitraege() {
    if (!user?.organization_id) return
    setBeitraegeLoading(true)
    try {
      const all = await pb.collection('lernbar_beitraege').getFullList({
        requestKey: `loadBeitraege-${Date.now()}`
      })
      console.log('Alle Beitraege (ohne Filter):', all.length, all.map(r => ({ id: r.id, organisation_id: (r as any).organisation_id, organization_id: (r as any).organization_id })))
      const records = all.filter((r: any) =>
        r.organisation_id === user.organization_id || r.organization_id === user.organization_id
      )
      setBeitraege(records as any)
    } catch (e: any) {
      console.error('loadBeitraege Fehler:', e?.message, e?.data)
    }
    finally { setBeitraegeLoading(false) }
  }

  function openTerminDetailPage(t: Termin) {
    let todos: {id: string; text: string; done: boolean}[] = []
    try { todos = t.dozent_todos ? JSON.parse(t.dozent_todos) : [] } catch { todos = [] }
    let aufgaben: {id: string; text: string; assignee_id?: string; assignee_name?: string; done: boolean}[] = []
    try { aufgaben = t.dozent_aufgaben ? JSON.parse(t.dozent_aufgaben) : [] } catch { aufgaben = [] }
    let coDoz: {user_id: string; name: string}[] = []
    try { coDoz = t.co_dozenten ? JSON.parse(t.co_dozenten) : [] } catch { coDoz = [] }
    let links: {id: string; name: string; file: string}[] = []
    try { links = t.dateien_links ? JSON.parse(t.dateien_links) : [] } catch { links = [] }
    let aLinks: {id: string; name: string; file: string}[] = []
    try { aLinks = t.anhang_links ? JSON.parse(t.anhang_links) : [] } catch { aLinks = [] }
    let dNames: Record<string, string> = {}
    try { dNames = t.dateien_names ? JSON.parse(t.dateien_names) : {} } catch { dNames = {} }
    let aNames: Record<string, string> = {}
    try { aNames = t.anhang_names ? JSON.parse(t.anhang_names) : {} } catch { aNames = {} }
    setDozentTodos(todos)
    setDozentAufgaben(aufgaben)
    setCoDozenten(coDoz)
    setDateienLinks(links)
    setAnhangLinks(aLinks)
    setDateienNames(dNames)
    setAnhangNames(aNames)
    setNewTodoText('')
    setNewAufgabeText('')
    setNewAufgabeAssignee('')
    setTNInfoText(t.teilnehmer_info || '')
    setLernkonzeptText(t.lernkonzept || '')
    setEditingTNInfo(false)
    setEditingLernkonzept(false)
    setTerminDetailTab('info')
    setTerminDetailPage(t)
    loadEinladungenForTermin(t.id)
  }

  async function saveTerminDetailField(terminId: string, fields: Record<string, any>) {
    try { await pb.collection('ausbildungen_termine').update(terminId, fields) } catch { /* graceful if field not in PB */ }
    setTermine(prev => prev.map(t => t.id === terminId ? { ...t, ...fields } : t))
    setTerminDetailPage(prev => prev ? { ...prev, ...fields } : prev)
  }

  async function saveTodosToDb(terminId: string, todos: {id: string; text: string; done: boolean}[]) {
    const payload = { dozent_todos: JSON.stringify(todos) }
    try { await pb.collection('ausbildungen_termine').update(terminId, payload) } catch(e: any) { console.error('saveTodosToDb:', e) }
    setTermine(prev => prev.map(t => t.id === terminId ? { ...t, ...payload } : t))
    setTerminDetailPage(prev => prev ? { ...prev, ...payload } : prev)
  }

  async function addTodo() {
    if (!newTodoText.trim() || !terminDetailPage) return
    const updated = [...dozentTodos, { id: Math.random().toString(36).slice(2, 9), text: newTodoText.trim(), done: false }]
    setDozentTodos(updated)
    setNewTodoText('')
    await saveTodosToDb(terminDetailPage.id, updated)
  }

  async function toggleTodo(id: string) {
    if (!terminDetailPage) return
    const updated = dozentTodos.map(t => t.id === id ? { ...t, done: !t.done } : t)
    setDozentTodos(updated)
    await saveTodosToDb(terminDetailPage.id, updated)
  }

  async function deleteTodo(id: string) {
    if (!terminDetailPage) return
    const updated = dozentTodos.filter(t => t.id !== id)
    setDozentTodos(updated)
    await saveTodosToDb(terminDetailPage.id, updated)
  }

  async function saveDozentAufgabenToDb(terminId: string, aufgaben: {id: string; text: string; assignee_id?: string; assignee_name?: string; done: boolean}[]) {
    const payload = { dozent_aufgaben: JSON.stringify(aufgaben) }
    try { await pb.collection('ausbildungen_termine').update(terminId, payload) } catch {}
    setTermine(prev => prev.map(t => t.id === terminId ? { ...t, ...payload } : t))
    setTerminDetailPage(prev => prev ? { ...prev, ...payload } : prev)
  }

  async function addDozentAufgabe() {
    if (!newAufgabeText.trim() || !terminDetailPage) return
    const assignee = allUsers.find(u => u.id === newAufgabeAssignee)
    const updated = [...dozentAufgaben, { id: Math.random().toString(36).slice(2,9), text: newAufgabeText.trim(), assignee_id: newAufgabeAssignee || undefined, assignee_name: assignee?.name || undefined, done: false }]
    setDozentAufgaben(updated)
    setNewAufgabeText('')
    setNewAufgabeAssignee('')
    await saveDozentAufgabenToDb(terminDetailPage.id, updated)
  }

  async function toggleDozentAufgabe(id: string) {
    if (!terminDetailPage) return
    const updated = dozentAufgaben.map(a => a.id === id ? { ...a, done: !a.done } : a)
    setDozentAufgaben(updated)
    await saveDozentAufgabenToDb(terminDetailPage.id, updated)
  }

  async function deleteDozentAufgabe(id: string) {
    if (!terminDetailPage) return
    const updated = dozentAufgaben.filter(a => a.id !== id)
    setDozentAufgaben(updated)
    await saveDozentAufgabenToDb(terminDetailPage.id, updated)
  }

  async function saveCoDozenten(terminId: string, coDoz: {user_id: string; name: string}[]) {
    const payload = { co_dozenten: JSON.stringify(coDoz) }
    try { await pb.collection('ausbildungen_termine').update(terminId, payload) } catch {}
    setTermine(prev => prev.map(t => t.id === terminId ? { ...t, ...payload } : t))
    setTerminDetailPage(prev => prev ? { ...prev, ...payload } : prev)
  }

  async function addCoDozent(userId: string, name: string) {
    if (!terminDetailPage || coDozenten.some(c => c.user_id === userId)) return
    const updated = [...coDozenten, { user_id: userId, name }]
    setCoDozenten(updated)
    await saveCoDozenten(terminDetailPage.id, updated)
  }

  async function removeCoDozent(userId: string) {
    if (!terminDetailPage) return
    const updated = coDozenten.filter(c => c.user_id !== userId)
    setCoDozenten(updated)
    await saveCoDozenten(terminDetailPage.id, updated)
  }

  async function setAnwesenheitStatus(ttId: string, current: string | undefined, value: 'da' | 'krank' | 'entschuldigt' | 'fehlend') {
    const newValue = current === value ? '' : value
    try {
      await pb.collection('ausbildungen_termine_user').update(ttId, { anwesenheit_status: newValue, anwesend: newValue === 'da' })
      setTerminTeilnehmer(prev => prev.map(tt => tt.id === ttId ? { ...tt, anwesenheit_status: newValue as any, anwesend: newValue === 'da' } : tt))
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  async function setEinladungAnwesenheitStatus(einladungId: string, current: string, value: 'da' | 'krank' | 'entschuldigt' | 'fehlend') {
    const newValue = current === value ? '' : value
    try {
      await pb.collection('ausbildungen_einladungen').update(einladungId, { anwesenheit_status: newValue })
      setEinladungen(prev => prev.map(e => e.id === einladungId ? { ...e, anwesenheit_status: newValue as any } : e))
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  async function removeEinladung(einladungId: string) {
    if (!confirm('Link-Rückmeldung wirklich entfernen?')) return
    try {
      await pb.collection('ausbildungen_einladungen').delete(einladungId)
      setEinladungen(prev => prev.filter(e => e.id !== einladungId))
      showMessage('Rückmeldung entfernt', 'success')
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  async function toggleRSVP(ttId: string, currentStatus: string) {
    const newStatus = currentStatus === 'zugesagt' ? 'eingeladen' : 'zugesagt'
    try {
      await pb.collection('ausbildungen_termine_user').update(ttId, { status: newStatus })
      setTerminTeilnehmer(prev => prev.map(tt => tt.id === ttId ? { ...tt, status: newStatus as any } : tt))
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  async function uploadDozentFile(file: File) {
    if (!terminDetailPage) return
    setUploadingDozentFile(true)
    try {
      const fd = new FormData()
      fd.append('+dateien', file)
      const updated = await pb.collection('ausbildungen_termine').update(terminDetailPage.id, fd)
      setTermine(prev => prev.map(t => t.id === terminDetailPage.id ? { ...t, dateien: updated.dateien } : t))
      setTerminDetailPage(prev => prev ? { ...prev, dateien: updated.dateien } : prev)
      showMessage('Datei hochgeladen', 'success')
    } catch(e: any) {
      showMessage('Fehler: ' + e.message, 'error')
    } finally { setUploadingDozentFile(false) }
  }

  async function uploadTNFile(file: File) {
    if (!terminDetailPage) return
    setUploadingTNFile(true)
    try {
      const fd = new FormData()
      fd.append('+anhang', file)
      const updated = await pb.collection('ausbildungen_termine').update(terminDetailPage.id, fd)
      setTermine(prev => prev.map(t => t.id === terminDetailPage.id ? { ...t, anhang: updated.anhang } : t))
      setTerminDetailPage(prev => prev ? { ...prev, anhang: updated.anhang } : prev)
      showMessage('Datei hochgeladen', 'success')
    } catch(e: any) {
      showMessage('Fehler: ' + e.message, 'error')
    } finally { setUploadingTNFile(false) }
  }

  async function loadFilePicker() {
    if (!user?.organization_id) return
    setFilePickerLoading(true)
    setFilePickerSearch('')
    try {
      const items = await pb.collection('files').getFullList({
        filter: `organization_id = "${user.organization_id}" && is_folder = false`,
        sort: 'name'
      })
      setFilePickerItems(items as any[])
    } catch { /* silent */ } finally { setFilePickerLoading(false) }
  }

  async function linkDozentFile(item: {id: string; name: string; file: string}) {
    if (!terminDetailPage) return
    if (dateienLinks.some(l => l.id === item.id)) { setShowFilePicker(false); return }
    const updated = [...dateienLinks, { id: item.id, name: item.name, file: item.file }]
    setDateienLinks(updated)
    setShowFilePicker(false)
    try {
      await pb.collection('ausbildungen_termine').update(terminDetailPage.id, { dateien_links: JSON.stringify(updated) })
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  async function unlinkDozentFile(id: string) {
    if (!terminDetailPage) return
    const updated = dateienLinks.filter(l => l.id !== id)
    setDateienLinks(updated)
    try {
      await pb.collection('ausbildungen_termine').update(terminDetailPage.id, { dateien_links: JSON.stringify(updated) })
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  async function linkTNFile(item: {id: string; name: string; file: string}) {
    if (!terminDetailPage) return
    if (anhangLinks.some(l => l.id === item.id)) { setShowFilePicker(false); return }
    const updated = [...anhangLinks, { id: item.id, name: item.name, file: item.file }]
    setAnhangLinks(updated)
    setShowFilePicker(false)
    try {
      await pb.collection('ausbildungen_termine').update(terminDetailPage.id, { anhang_links: JSON.stringify(updated) })
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  async function unlinkTNFile(id: string) {
    if (!terminDetailPage) return
    const updated = anhangLinks.filter(l => l.id !== id)
    setAnhangLinks(updated)
    try {
      await pb.collection('ausbildungen_termine').update(terminDetailPage.id, { anhang_links: JSON.stringify(updated) })
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  async function removeDozentFile(file: string) {
    if (!terminDetailPage) return
    try {
      const fd = new FormData()
      fd.append('dateien-', file)
      const updated = await pb.collection('ausbildungen_termine').update(terminDetailPage.id, fd)
      setTermine(prev => prev.map(t => t.id === terminDetailPage.id ? { ...t, dateien: updated.dateien } : t))
      setTerminDetailPage(prev => prev ? { ...prev, dateien: updated.dateien } : prev)
      if (dateienNames[file]) {
        const updatedNames = { ...dateienNames }
        delete updatedNames[file]
        setDateienNames(updatedNames)
        await pb.collection('ausbildungen_termine').update(terminDetailPage.id, { dateien_names: JSON.stringify(updatedNames) })
      }
      showMessage('Datei gelöscht', 'success')
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  async function removeTNFile(file: string) {
    if (!terminDetailPage) return
    try {
      const fd = new FormData()
      fd.append('anhang-', file)
      const updated = await pb.collection('ausbildungen_termine').update(terminDetailPage.id, fd)
      setTermine(prev => prev.map(t => t.id === terminDetailPage.id ? { ...t, anhang: updated.anhang } : t))
      setTerminDetailPage(prev => prev ? { ...prev, anhang: updated.anhang } : prev)
      if (anhangNames[file]) {
        const updatedNames = { ...anhangNames }
        delete updatedNames[file]
        setAnhangNames(updatedNames)
        await pb.collection('ausbildungen_termine').update(terminDetailPage.id, { anhang_names: JSON.stringify(updatedNames) })
      }
      showMessage('Datei gelöscht', 'success')
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  async function renameDozentFile(file: string, newName: string) {
    if (!terminDetailPage) return
    const updated = { ...dateienNames, [file]: newName }
    setDateienNames(updated)
    try {
      await pb.collection('ausbildungen_termine').update(terminDetailPage.id, { dateien_names: JSON.stringify(updated) })
      showMessage('Datei umbenannt', 'success')
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  async function renameTNFile(file: string, newName: string) {
    if (!terminDetailPage) return
    const updated = { ...anhangNames, [file]: newName }
    setAnhangNames(updated)
    try {
      await pb.collection('ausbildungen_termine').update(terminDetailPage.id, { anhang_names: JSON.stringify(updated) })
      showMessage('Datei umbenannt', 'success')
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  async function renameDozentLink(id: string, newName: string) {
    if (!terminDetailPage) return
    const updated = dateienLinks.map(l => l.id === id ? { ...l, name: newName } : l)
    setDateienLinks(updated)
    try {
      await pb.collection('ausbildungen_termine').update(terminDetailPage.id, { dateien_links: JSON.stringify(updated) })
      showMessage('Datei umbenannt', 'success')
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  async function renameTNLink(id: string, newName: string) {
    if (!terminDetailPage) return
    const updated = anhangLinks.map(l => l.id === id ? { ...l, name: newName } : l)
    setAnhangLinks(updated)
    try {
      await pb.collection('ausbildungen_termine').update(terminDetailPage.id, { anhang_links: JSON.stringify(updated) })
      showMessage('Datei umbenannt', 'success')
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  async function loadPraesentationen() {
    if (!user?.organization_id) return
    setPraesentationenLoading(true)
    try {
      const records = await pb.collection('ausbildungen_praesentationen').getFullList({
        filter: `organization_id = "${user.organization_id}"`,
        sort: '-created',
        requestKey: `loadPraes-${Date.now()}`
      })
      setPraesentationen(records as any)
    } catch { /* collection may not exist yet */ }
    finally { setPraesentationenLoading(false) }
  }

  function makePraesSlide(layout: PraesentationSlide['layout'] = 'title'): PraesentationSlide {
    return { id: Math.random().toString(36).slice(2,9), layout, bg: '#600812', pattern: null, title: '', body: '', textColor: '#ffffff', imageFile: null, imagePreview: null, imageExistingUrl: null }
  }

  function openNewPraesentation() {
    setPraesentationTitel('')
    setPraesentationTerminId('')
    setPraesentationSlides([makePraesSlide('title')])
    setCurrentSlideIdx(0)
    setEditingPraesentation(null)
    setShowPraesentationEditor(true)
  }

  function openEditPraesentation(p: Praesentation) {
    let slides: PraesentationSlide[] = []
    try {
      const parsed = JSON.parse(p.inhalt)
      if (Array.isArray(parsed?.slides)) {
        const bildArr: string[] = Array.isArray(p.bilder) ? p.bilder as string[] : (p.bilder ? [p.bilder as string] : [])
        slides = parsed.slides.map((s: any) => {
          const imgUrl = s.imageIdx !== undefined && bildArr[s.imageIdx]
            ? `https://api.responda.systems/api/files/${p.collectionId}/${p.id}/${bildArr[s.imageIdx]}`
            : s.imageExistingUrl || null
          return { ...s, imageFile: null, imagePreview: imgUrl, imageExistingUrl: imgUrl }
        })
      }
    } catch {}
    if (slides.length === 0) slides = [makePraesSlide()]
    setPraesentationTitel(p.titel)
    setPraesentationTerminId(p.termin_id || '')
    setPraesentationSlides(slides)
    setCurrentSlideIdx(0)
    setEditingPraesentation(p)
    setShowPraesentationEditor(true)
  }

  async function savePraesentation() {
    if (!praesentationTitel.trim() || !user?.organization_id) return
    setSavingPraesentation(true)
    try {
      const imageFiles: File[] = []
      const slidesData = praesentationSlides.map(s => {
        if (s.imageFile) {
          const idx = imageFiles.length
          imageFiles.push(s.imageFile)
          return { id: s.id, layout: s.layout, bg: s.bg, pattern: s.pattern, title: s.title, body: s.body, textColor: s.textColor, imageIdx: idx }
        }
        return { id: s.id, layout: s.layout, bg: s.bg, pattern: s.pattern, title: s.title, body: s.body, textColor: s.textColor, imageExistingUrl: s.imageExistingUrl || undefined }
      })
      const fd = new FormData()
      fd.append('titel', praesentationTitel.trim())
      if (praesentationTerminId) fd.append('termin_id', praesentationTerminId)
      fd.append('inhalt', JSON.stringify({ v: 1, slides: slidesData }))
      fd.append('organization_id', user.organization_id)
      if (user.id) fd.append('created_by', user.id)
      imageFiles.forEach(f => fd.append('bilder', f))
      let result: any
      if (editingPraesentation) {
        result = await pb.collection('ausbildungen_praesentationen').update(editingPraesentation.id, fd)
        setPraesentationen(prev => prev.map(p => p.id === editingPraesentation.id ? result : p))
      } else {
        result = await pb.collection('ausbildungen_praesentationen').create(fd)
        setPraesentationen(prev => [result, ...prev])
      }
      setEditingPraesentation(result)
      showMessage('Gespeichert', 'success')
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
    finally { setSavingPraesentation(false) }
  }

  async function deletePraesentation(id: string) {
    if (!confirm('Präsentation löschen?')) return
    try {
      await pb.collection('ausbildungen_praesentationen').delete(id)
      setPraesentationen(prev => prev.filter(p => p.id !== id))
      showMessage('Gelöscht', 'success')
    } catch(e: any) { showMessage('Fehler: ' + e.message, 'error') }
  }

  function updateSlideField(slideId: string, updates: Partial<PraesentationSlide>) {
    setPraesentationSlides(prev => prev.map(s => s.id === slideId ? { ...s, ...updates } : s))
  }

  function addPraesSlide() {
    const newSlide = makePraesSlide('content')
    setPraesentationSlides(prev => { const next = [...prev]; next.splice(currentSlideIdx + 1, 0, newSlide); return next })
    setCurrentSlideIdx(prev => prev + 1)
  }

  function deletePraesSlide(idx: number) {
    if (praesentationSlides.length <= 1) return
    setPraesentationSlides(prev => prev.filter((_, i) => i !== idx))
    setCurrentSlideIdx(prev => Math.min(prev, praesentationSlides.length - 2))
  }

  function uid() { return Math.random().toString(36).slice(2, 9) }
  function makeBlock(type: EditorBlock['type']): EditorBlock {
    return { id: uid(), type, text: '', imageFile: null, imagePreview: null, videoUrl: '', quizFrage: '', quizAntworten: ['', '', '', ''], quizRichtige: 0 }
  }
  function makePage(): EditorPage { return { id: uid(), blocks: [] } }

  function resetBeitragForm() {
    setEditingBeitragId(null)
    setShowBeitragModal(false)
    setBookPages([])
    setBookPageIdx(0)
    setBookDir(1)
    setShowBlockPicker(false)
    setBeitragForm({ titel: '', tags: '', gepinnt: false, color: '#600812', pattern: null, coverBlockId: null })
    setPdfFiles([])
  }

  async function saveBeitrag() {
    if (!beitragForm.titel.trim()) return
    setSavingBeitrag(true)
    try {
      const imageFiles: File[] = []
      const pagesData = bookPages.map(page => ({
        id: page.id,
        blocks: page.blocks.map(block => {
          if (block.type === 'bild') {
            if (block.imageFile) {
              const idx = imageFiles.length
              imageFiles.push(block.imageFile)
              return { id: block.id, type: 'bild' as const, bildIdx: idx }
            }
            if (block.imagePreview && !block.imageFile) {
              return { id: block.id, type: 'bild' as const, bildExistingUrl: block.imagePreview }
            }
            return { id: block.id, type: 'bild' as const }
          }
          if (block.type === 'text') return { id: block.id, type: 'text' as const, text: block.text }
          if (block.type === 'video') return { id: block.id, type: 'video' as const, videoUrl: block.videoUrl }
          if (block.type === 'quiz') return { id: block.id, type: 'quiz' as const, quizFrage: block.quizFrage, quizAntworten: block.quizAntworten, quizRichtige: block.quizRichtige }
          return { id: block.id, type: block.type as any }
        })
      }))
      const tags = beitragForm.tags.split(',').map(t => t.trim()).filter(Boolean)
      const fd = new FormData()
      fd.append('typ', 'text')
      fd.append('titel', beitragForm.titel.trim())
      fd.append('inhalt', JSON.stringify({ v: 2, color: beitragForm.color, pattern: beitragForm.pattern || undefined, cover_block_id: beitragForm.coverBlockId || undefined, pages: pagesData }))
      fd.append('gepinnt', String(beitragForm.gepinnt))
      fd.append('tags', JSON.stringify(tags))
      fd.append('video_url', '')
      if (!editingBeitragId) {
        fd.append('organisation_id', user?.organization_id || '')
        fd.append('erstellt_von_id', user?.id || '')
        fd.append('erstellt_von_name', user?.name || '')
      }
      imageFiles.forEach(f => fd.append('bild', f))
      pdfFiles.forEach(f => fd.append('dateien', f))
      if (editingBeitragId) {
        await pb.collection('lernbar_beitraege').update(editingBeitragId, fd)
        showMessage('Beitrag aktualisiert', 'success')
      } else {
        await pb.collection('lernbar_beitraege').create(fd)
        showMessage('Beitrag erstellt', 'success')
      }
      resetBeitragForm()
      await loadBeitraege()
    } catch(e: any) {
      const detail = e?.response?.data ? Object.entries(e.response.data).map(([k,v]: any) => `${k}: ${v?.message || JSON.stringify(v)}`).join('; ') : ''
      showMessage(`Fehler (${e?.status || '?'}): ${e.message}${detail ? ' — ' + detail : ''}`, 'error')
      console.error('saveBeitrag error', e?.status, e?.response)
    } finally { setSavingBeitrag(false) }
  }

  function openEditBeitrag(b: Lernbeitrag) {
    const tagsStr = Array.isArray(b.tags) ? b.tags.join(', ') : ''
    setEditingBeitragId(b.id)
    let pages: EditorPage[] = []
    let bookColor = '#600812'
    let bookPattern: string | null = null
    let coverBlockId: string | null = null
    try {
      const parsed = parseInhalt(b.inhalt)
      if (parsed?.v === 2 && Array.isArray(parsed.pages)) {
        if (parsed.color) bookColor = parsed.color
        if (parsed.pattern) bookPattern = parsed.pattern
        if (parsed.cover_block_id) coverBlockId = parsed.cover_block_id
        const bildArr = Array.isArray(b.bild) ? b.bild : (b.bild ? [b.bild] : [])
        pages = parsed.pages.map((p: any) => ({
          id: p.id || uid(),
          blocks: (p.blocks || []).map((blk: any): EditorBlock => {
            if (blk.type === 'bild') {
              let imgUrl: string | null = null
              if (blk.bildIdx !== undefined && bildArr[blk.bildIdx]) imgUrl = `https://api.responda.systems/api/files/${b.collectionId}/${b.id}/${bildArr[blk.bildIdx]}`
              else if (blk.bildExistingUrl) imgUrl = blk.bildExistingUrl
              return { id: blk.id || uid(), type: 'bild', text: '', imageFile: null, imagePreview: imgUrl, videoUrl: '', quizFrage: '', quizAntworten: ['', '', '', ''], quizRichtige: 0 }
            }
            if (blk.type === 'video') return { id: blk.id || uid(), type: 'video', text: '', imageFile: null, imagePreview: null, videoUrl: blk.videoUrl || '', quizFrage: '', quizAntworten: ['', '', '', ''], quizRichtige: 0 }
            if (blk.type === 'quiz') return { id: blk.id || uid(), type: 'quiz', text: '', imageFile: null, imagePreview: null, videoUrl: '', quizFrage: blk.quizFrage || '', quizAntworten: (blk.quizAntworten?.length === 4 ? blk.quizAntworten : ['', '', '', '']) as [string,string,string,string], quizRichtige: blk.quizRichtige ?? 0 }
            return { id: blk.id || uid(), type: 'text', text: blk.text || '', imageFile: null, imagePreview: null, videoUrl: '', quizFrage: '', quizAntworten: ['', '', '', ''], quizRichtige: 0 }
          })
        }))
      }
    } catch {}
    if (pages.length === 0) {
      const block = makeBlock(b.typ)
      if (b.typ === 'text') block.text = b.inhalt || ''
      if (b.typ === 'bild') { const bf = Array.isArray(b.bild) ? b.bild[0] : b.bild; if (bf) block.imagePreview = `https://api.responda.systems/api/files/${b.collectionId}/${b.id}/${bf}` }
      if (b.typ === 'video') block.videoUrl = b.video_url || ''
      if (b.typ === 'quiz') { const qd = b.quiz_daten; block.quizFrage = qd?.frage || ''; block.quizAntworten = ([...(qd?.antworten || []),'','',''].slice(0,4)) as [string,string,string,string]; block.quizRichtige = qd?.richtige ?? 0 }
      pages = [{ id: uid(), blocks: [block] }]
    }
    setBeitragForm({ titel: b.titel, tags: tagsStr, gepinnt: b.gepinnt, color: bookColor, pattern: bookPattern, coverBlockId })
    setBookPages(pages)
    setBookPageIdx(0)
    setBookDir(1)
    setShowBlockPicker(false)
    setShowBeitragModal(true)
  }

  async function deleteBeitrag(id: string) {
    if (!confirm('Beitrag wirklich löschen?')) return
    try {
      await pb.collection('lernbar_beitraege').delete(id)
      setBeitraege(prev => prev.filter(b => b.id !== id))
      showMessage('Beitrag gelöscht', 'success')
    } catch(e: any) {
      showMessage('Fehler: ' + e.message, 'error')
    }
  }

  async function generateAIImage(blockId: string) {
    if (!beitragForm.titel.trim()) { showMessage('Bitte zuerst einen Titel eingeben', 'error'); return }
    setAiImageTargetBlock(blockId)
    setGeneratingAIImage(true)
    try {
      const prompt = encodeURIComponent(`${beitragForm.titel} Rettungsdienst Notfallmedizin training illustration`.trim())
      const url = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=768&nologo=true&seed=${Date.now()}`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Bildgenerierung fehlgeschlagen')
      const blob = await response.blob()
      const file = new File([blob], 'ki-bild.jpg', { type: 'image/jpeg' })
      setBookPages(prev => prev.map(p => ({ ...p, blocks: p.blocks.map(b => b.id === blockId ? { ...b, imageFile: file, imagePreview: URL.createObjectURL(blob) } : b) })))
    } catch(e: any) {
      showMessage('KI-Bild Fehler: ' + e.message, 'error')
    } finally {
      setGeneratingAIImage(false)
      setAiImageTargetBlock(null)
    }
  }

  async function loadAllUsers() {
    try {
      const users = await pb.collection('users').getFullList({
        filter: `organization_id = "${user?.organization_id}"`
      })
      setAllUsers(users)
    } catch(e) {
      console.error('Fehler beim Laden der User:', e)
    }
  }

  async function checkExistingUser(email: string) {
    if (!email || !email.includes('@')) {
      setExistingUserDetected(null)
      return
    }

    try {
      // Suche in BEIDEN Email-Feldern: auth email UND contact_email
      const existingUsers = await pb.collection('users').getFullList({
        filter: `organization_id = "${user?.organization_id}" && (email = "${email}" || contact_email = "${email}")`
      })

      if (existingUsers.length > 0) {
        const existing = existingUsers[0]
        setExistingUserDetected(existing)
        setTeilnehmerForm(prev => ({
          ...prev,
          vorname: existing.name?.split(' ')[0] || prev.vorname,
          nachname: existing.name?.split(' ').slice(1).join(' ') || prev.nachname,
          telefon: existing.phone || prev.telefon,
          whatsapp: existing.whatsapp || prev.whatsapp,
          ausbildung_typ: existing.ausbildung_typ || prev.ausbildung_typ,
          notizen: existing.notizen || prev.notizen,
          lernbar_zugang_aktiv: existing.permissions?.lernbar || prev.lernbar_zugang_aktiv
        }))
      } else {
        setExistingUserDetected(null)
      }
    } catch(e) {
      console.error('Fehler beim Prüfen:', e)
      setExistingUserDetected(null)
    }
  }

  function showMessage(text: string, type: 'success' | 'error') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  // Aktive Termine (nicht abgeschlossen) im Hauptbereich, abgeschlossene ins Archiv
  const filteredTermine = termine.filter(t => t.status !== 'abgeschlossen')
  const archivTermine = termine.filter(t => t.status === 'abgeschlossen')
  const filteredTeilnehmer = teilnehmer
  const filteredModule = module
  const filteredKonzepte = konzepte

  // TERMIN FUNCTIONS
  function openAddTermin() {
    setTerminForm({
      name: '', description: '', start_datetime: '', end_datetime: '',
      location: '', dozent: '', dozent_id: '', max_teilnehmer: 20, status: 'geplant',
      konzept_id: '', notizen: ''
    })
    setKonzeptSuggestions([])
    setShowAddTerminModal(true)
  }

  function openEditTermin(termin: Termin) {
    setTerminForm({
      id: termin.id,
      name: termin.name,
      description: termin.description,
      start_datetime: formatDateForInput(termin.start_datetime),
      end_datetime: formatDateForInput(termin.end_datetime),
      location: termin.location,
      dozent: termin.dozent,
      dozent_id: termin.dozent_id || '',
      max_teilnehmer: termin.max_teilnehmer,
      status: termin.status,
      konzept_id: termin.konzept_id || '',
      notizen: termin.notizen || ''
    })
    setKonzeptSuggestions([])
    setShowAddTerminModal(true)
  }

  function handleTerminNameChange(name: string) {
    setTerminForm(prev => ({ ...prev, name }))
    // Auto-Matching: suche passende Konzepte anhand des Namens
    if (name.length < 2) { setKonzeptSuggestions([]); return }
    const lower = name.toLowerCase()
    const matches = konzepte.filter(k =>
      k.name.toLowerCase().includes(lower) ||
      lower.includes(k.name.toLowerCase()) ||
      k.beschreibung?.toLowerCase().includes(lower)
    )
    setKonzeptSuggestions(matches.slice(0, 4))
  }

  async function saveTermin() {
    if (!terminForm.name || !terminForm.start_datetime) {
      alert('Bitte Name und Startdatum eingeben')
      return
    }

    // Convert datetime-local values ("2026-04-14T14:00") to full ISO strings
    // PocketBase requires a complete datetime format
    function toISOSafe(val: string): string {
      if (!val) return ''
      const d = new Date(val)
      return isNaN(d.getTime()) ? val : d.toISOString()
    }

    try {
      const { id: _id, ...rest } = terminForm
      const data = {
        ...rest,
        start_datetime: toISOSafe(terminForm.start_datetime),
        end_datetime: terminForm.end_datetime ? toISOSafe(terminForm.end_datetime) : '',
        organization_id: user?.organization_id
      }

      if (terminForm.id) {
        await pb.collection('ausbildungen_termine').update(terminForm.id, data)
        showMessage('Termin aktualisiert', 'success')
      } else {
        await pb.collection('ausbildungen_termine').create(data)
        showMessage('Termin erstellt', 'success')
      }

      setShowAddTerminModal(false)
      await loadTermine()
    } catch(e: any) {
      alert('Fehler beim Speichern: ' + (e?.data ? JSON.stringify(e.data) : e.message))
    }
  }

  async function saveTerminField(terminId: string, fields: Partial<Termin>) {
    try {
      await pb.collection('ausbildungen_termine').update(terminId, fields)
      await loadTermine()
      // selectedTermin aktualisieren
      setSelectedTermin(prev => prev ? { ...prev, ...fields } : prev)
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function generateEinladungsText(termin: Termin): string {
    const datum = fmtDateTime(termin.start_datetime)
    const lines = [
      `📚 Einladung: ${termin.name}`,
      `📅 ${datum}`,
      termin.location ? `📍 ${termin.location}` : '',
      termin.dozent ? `👤 Dozent: ${termin.dozent}` : '',
      termin.description ? `\n${termin.description}` : '',
    ].filter(Boolean)
    return lines.join('\n')
  }

  async function generateEinladungsToken(termin: Termin): Promise<string | null> {
    try {
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
      await pb.collection('ausbildungen_einladungs_tokens').create({
        token,
        termin_id: termin.id,
        termin_name: termin.name,
        termin_datum: termin.start_datetime,
        termin_end_datum: termin.end_datetime || '',
        termin_ort: termin.location || '',
        termin_beschreibung: termin.description || '',
        organization_id: termin.organization_id
      }, { requestKey: `token-${Date.now()}` })
      await pb.collection('ausbildungen_termine').update(termin.id, { einladung_token: token }, { requestKey: `termin-token-${Date.now()}` })
      setSelectedTermin(prev => prev ? { ...prev, einladung_token: token } : prev)
      setTerminDetailPage(prev => prev && prev.id === termin.id ? { ...prev, einladung_token: token } : prev)
      setTermine(prev => prev.map(t => t.id === termin.id ? { ...t, einladung_token: token } : t))
      showMessage('Einladungslink erstellt!', 'success')
      return token
    } catch (e: any) {
      showMessage('Fehler: ' + e.message, 'error')
      return null
    }
  }

  async function deleteTermin(id: string, name: string) {
    if (!confirm(`Termin "${name}" wirklich löschen?`)) return

    try {
      await pb.collection('ausbildungen_termine').delete(id)
      showMessage('Termin gelöscht', 'success')
      await loadData()
    } catch(e: any) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  async function loadEinladungenForTermin(terminId: string) {
    try {
      const res = await pb.collection('ausbildungen_einladungen').getFullList({
        filter: `termin_id = "${terminId}"`,
        requestKey: `einladungen-${terminId}-${Date.now()}`
      })
      setEinladungen(res as any)
    } catch (e: any) {
      setEinladungen([])
      showMessage('Fehler beim Laden der Rückmeldungen: ' + (e?.message || e), 'error')
    }
  }

  function viewTerminDetail(termin: Termin) {
    setSelectedTermin(termin)
    setCurrentTerminTab('uebersicht')
    setShowTerminDetailModal(true)
    loadEinladungenForTermin(termin.id)
  }

  function viewTeilnehmerDetail(t: Teilnehmer) {
    setSelectedTeilnehmerDetail(t)
    setSelectedTeilnehmerTab('uebersicht')
    setShowTeilnehmerDetailModal(true)
  }

  // TEILNEHMER FUNCTIONS
  function openAddTeilnehmer() {
    setTeilnehmerForm({
      vorname: '',
      nachname: '',
      email: '',
      telefon: '',
      whatsapp: '',
      ausbildung_typ: '',
      notizen: '',
      lernbar_zugang_aktiv: false
    })
    setExistingUserDetected(null)
    setShowAddTeilnehmerModal(true)
  }

  function openEditTeilnehmer(teilnehmer: Teilnehmer) {
    setOriginalEmail(teilnehmer.email)
    setTeilnehmerForm({
      id: teilnehmer.id,
      vorname: teilnehmer.vorname,
      nachname: teilnehmer.nachname,
      email: teilnehmer.email,
      telefon: teilnehmer.telefon,
      whatsapp: teilnehmer.whatsapp,
      ausbildung_typ: teilnehmer.ausbildung_typ,
      notizen: teilnehmer.notizen,
      lernbar_zugang_aktiv: teilnehmer.lernbar_zugang_aktiv
    })
    setExistingUserDetected(null)
    setShowAddTeilnehmerModal(true)
  }

  async function saveTeilnehmer() {
  if (!teilnehmerForm.vorname || !teilnehmerForm.nachname) {
    alert('Bitte Vor- und Nachname eingeben')
    return
  }

  if (teilnehmerForm.lernbar_zugang_aktiv && !teilnehmerForm.email) {
    alert('Email erforderlich für Lernbar-Zugang')
    return
  }

  try {
    const fullName = `${teilnehmerForm.vorname} ${teilnehmerForm.nachname}`
    
    const permissions = {
      ausbildungen_manage: false,
      chat: false,
      dashboard: false,
      dateien: false,
      dokumente: false,
      einsaetze: false,
      lager: false,
      lernbar: teilnehmerForm.lernbar_zugang_aktiv,
      patienten: false,
      produktausgabe: false,
      qr: false,
      users_manage: false
    }

    const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).toUpperCase().slice(-6) + '!'
    // Auth-Email: immer Platzhalter (wird für PocketBase-Auth verwendet, nicht änderbar via API)
    const placeholderEmail = `${teilnehmerForm.vorname.toLowerCase()}.${teilnehmerForm.nachname.toLowerCase()}.${Math.random().toString(36).slice(-6)}@kein-email.intern`

    const userData = {
      name: fullName,
      email: placeholderEmail,           // PocketBase Auth-Email (Platzhalter)
      contact_email: teilnehmerForm.email || '', // Echte Email (normales Feld, frei änderbar)
      phone: teilnehmerForm.telefon || '',
      whatsapp: teilnehmerForm.whatsapp || '',
      ausbildung_typ: teilnehmerForm.ausbildung_typ || '',
      notizen: teilnehmerForm.notizen || '',
      role: 'teilnehmer',
      permissions: permissions,
      emailVisibility: true,
      verified: false,
      organization_id: user?.organization_id,
      password: randomPassword,
      passwordConfirm: randomPassword
    }

    if (teilnehmerForm.id) {
      // UPDATE bestehender Teilnehmer
      // contact_email ist ein normales Text-Feld → kann direkt aktualisiert werden
      const updateData = {
        name: fullName,
        contact_email: teilnehmerForm.email || '',
        phone: teilnehmerForm.telefon || '',
        whatsapp: teilnehmerForm.whatsapp || '',
        ausbildung_typ: teilnehmerForm.ausbildung_typ || '',
        notizen: teilnehmerForm.notizen || '',
        permissions: permissions
      }

      await pb.collection('users').update(teilnehmerForm.id, updateData)
      showMessage('Teilnehmer aktualisiert', 'success')

      const oldTeilnehmer = teilnehmer.find(t => t.id === teilnehmerForm.id)
      const kontaktEmail = teilnehmerForm.email || ''
      if (teilnehmerForm.lernbar_zugang_aktiv && !oldTeilnehmer?.lernbar_zugang_aktiv && kontaktEmail) {
        try {
          // Password-Reset an die contact_email senden
          // (PocketBase requestPasswordReset braucht die auth-email, daher über admins-Umweg nicht möglich)
          // Stattdessen: Info-Meldung
          showMessage('Lernbar aktiviert – bitte Password-Reset in PocketBase Admin auslösen', 'success')
        } catch(e: any) {
          console.error('Password Reset Fehler:', e)
        }
      }
    } else {
      // CREATE: Prüfe ob User bereits existiert (in auth-email ODER contact_email)
      let existingUser: any = null

      if (teilnehmerForm.email) {
        try {
          const found = await pb.collection('users').getFullList({
            filter: `organization_id = "${user?.organization_id}" && (email = "${teilnehmerForm.email}" || contact_email = "${teilnehmerForm.email}")`
          })
          if (found.length > 0) existingUser = found[0]
        } catch(e) {
          // ignorieren
        }
      }

      if (existingUser) {
        // BESTEHENDEN USER ALS TEILNEHMER VERKNÜPFEN
        // Kein neuer Login — nur Teilnehmer-Rolle + ggf. Lernbar-Zugang hinzufügen
        const mergedPermissions = {
          ...existingUser.permissions,
          lernbar: teilnehmerForm.lernbar_zugang_aktiv || existingUser.permissions?.lernbar || false
        }
        await pb.collection('users').update(existingUser.id, {
          role: 'teilnehmer',
          contact_email: teilnehmerForm.email || existingUser.contact_email || '',
          phone: teilnehmerForm.telefon || existingUser.phone || '',
          whatsapp: teilnehmerForm.whatsapp || existingUser.whatsapp || '',
          ausbildung_typ: teilnehmerForm.ausbildung_typ || existingUser.ausbildung_typ || '',
          notizen: teilnehmerForm.notizen || existingUser.notizen || '',
          permissions: mergedPermissions
        })
        showMessage('Bestehender User als Teilnehmer verknüpft', 'success')
      } else {
        // NEUEN USER MIT PLATZHALTER-EMAIL ERSTELLEN
        await pb.collection('users').create(userData)
        if (teilnehmerForm.lernbar_zugang_aktiv && teilnehmerForm.email) {
          try {
            await pb.collection('users').requestPasswordReset(teilnehmerForm.email)
            showMessage('Neuer Teilnehmer erstellt – Passwort-Email gesendet', 'success')
          } catch {
            showMessage('Neuer Teilnehmer erstellt', 'success')
          }
        } else {
          showMessage('Neuer Teilnehmer erstellt', 'success')
        }
      }
    }

    setShowAddTeilnehmerModal(false)
    setExistingUserDetected(null)
    await loadTeilnehmer()
  } catch(e: any) {
    console.error('Kompletter Fehler:', e)
    console.error('Response Data:', e.response)
    console.error('Error Data:', e.data)
    alert('Fehler beim Speichern: ' + JSON.stringify(e.data || e.message))
  }
}
  async function deleteTeilnehmer(id: string, name: string) {
    if (!confirm(`Teilnehmer "${name}" wirklich löschen?`)) return

    try {
      await pb.collection('users').delete(id)
      showMessage('Teilnehmer gelöscht', 'success')
      await loadData()
    } catch(e: any) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  async function toggleLernbarZugang(teilnehmer: Teilnehmer) {
    const newStatus = !teilnehmer.lernbar_zugang_aktiv
    
    if (newStatus && !teilnehmer.email) {
      alert('Email erforderlich für Lernbar-Zugang')
      return
    }

    try {
      const permissions = {
        ausbildungen_manage: false,
        chat: false,
        dashboard: false,
        dateien: false,
        dokumente: false,
        einsaetze: false,
        lager: false,
        lernbar: newStatus,
        patienten: false,
        produktausgabe: false,
        qr: false,
        users_manage: false
      }

      await pb.collection('users').update(teilnehmer.id, { permissions })
      showMessage(newStatus ? 'Lernbar aktiviert' : 'Lernbar deaktiviert', 'success')
      await loadTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // TERMIN-TEILNEHMER FUNCTIONS
  async function addTeilnehmerToTermin(terminId: string, teilnehmerId: string) {
    try {
      await pb.collection('ausbildungen_termine_user').create({
        termin_id: terminId,
        teilnehmer_id: teilnehmerId,
        status: 'eingeladen',
        eingeladen_am: new Date().toISOString(),
        eingeladen_via: 'email',
        anwesend: false,
        notizen: '',
        organization_id: user?.organization_id
      })
      showMessage('Teilnehmer hinzugefügt', 'success')
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message + '\nStatus: ' + e.status + '\nDetails: ' + JSON.stringify(e.data))
    }
  }

  async function addAlleTeilnehmerToTermin(terminId: string) {
    const bereitsZugewiesen = terminTeilnehmer
      .filter(tt => tt.termin_id === terminId)
      .map(tt => tt.teilnehmer_id)
    const fehlende = teilnehmer.filter(t => !bereitsZugewiesen.includes(t.id))
    if (fehlende.length === 0) {
      showMessage('Alle Teilnehmer bereits zugewiesen', 'success')
      return
    }
    try {
      for (const t of fehlende) {
        await pb.collection('ausbildungen_termine_user').create({
          termin_id: terminId,
          teilnehmer_id: t.id,
          status: 'eingeladen',
          eingeladen_am: new Date().toISOString(),
          eingeladen_via: 'email',
          anwesend: false,
          notizen: '',
          organization_id: user?.organization_id
        }, { requestKey: `termin-teilnehmer-${terminId}-${t.id}` })
      }
      showMessage(`${fehlende.length} Teilnehmer hinzugefügt`, 'success')
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function removeTeilnehmerFromTermin(terminTeilnehmerId: string) {
    if (!confirm('Teilnehmer wirklich entfernen?')) return
    
    try {
      await pb.collection('ausbildungen_termine_user').delete(terminTeilnehmerId)
      showMessage('Teilnehmer entfernt', 'success')
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function updateTeilnehmerStatus(terminTeilnehmerId: string, status: string) {
    try {
      await pb.collection('ausbildungen_termine_user').update(terminTeilnehmerId, { status })
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // DOKUMENT FUNCTIONS
  async function uploadDokument() {
    if (!selectedTermin || !uploadFile) {
      alert('Bitte Datei auswählen')
      return
    }

    try {
      const formData = new FormData()
      formData.append('termin_id', selectedTermin.id)
      formData.append('name', uploadFile.name)
      formData.append('typ', uploadTyp)
      formData.append('datei', uploadFile)
      formData.append('beschreibung', uploadBeschreibung)
      formData.append('organization_id', user?.organization_id || '')

      await pb.collection('ausbildungen_dokumente').create(formData)
      showMessage('Dokument hochgeladen', 'success')
      setShowUploadDokumentModal(false)
      setUploadFile(null)
      setUploadBeschreibung('')
      await loadDokumente()
    } catch(e: any) {
      alert('Fehler beim Upload: ' + e.message)
    }
  }

  async function deleteDokument(id: string, name: string) {
    if (!confirm(`Dokument "${name}" wirklich löschen?`)) return

    try {
      await pb.collection('ausbildungen_dokumente').delete(id)
      showMessage('Dokument gelöscht', 'success')
      await loadDokumente()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // MODUL FUNCTIONS
  function openAddModul() {
    setModulForm({
      name: '',
      beschreibung: '',
      inhalte: [],
      dauer_minuten: 60,
      min_pass_percent: 80
    })
    setShowAddModulModal(true)
  }

  async function saveModul() {
    if (!modulForm.name) {
      alert('Bitte Name eingeben')
      return
    }

    try {
      const data = {
        ...modulForm,
        organization_id: user?.organization_id
      }

      if (modulForm.id) {
        await pb.collection('ausbildungen_module').update(modulForm.id, data)
        showMessage('Modul aktualisiert', 'success')
      } else {
        await pb.collection('ausbildungen_module').create(data)
        showMessage('Modul erstellt', 'success')
      }

      setShowAddModulModal(false)
      await loadModule()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function openEditModul(m: Modul) {
    setModulForm({
      id: m.id,
      name: m.name,
      beschreibung: m.beschreibung,
      inhalte: m.inhalte ? [...m.inhalte] : [],
      dauer_minuten: m.dauer_minuten,
      min_pass_percent: m.min_pass_percent ?? 80
    })
    setShowAddModulModal(true)
  }

  async function deleteModul(id: string, name: string) {
    if (!confirm(`Modul "${name}" wirklich löschen?`)) return
    try {
      await pb.collection('ausbildungen_module').delete(id)
      showMessage('Modul gelöscht', 'success')
      await loadModule()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function openModulDetail(m: Modul) {
    setSelectedModul(m)
    setSelectedModulTab('inhalt')
    setAddModulTeilnehmerId('')
    setShowModulDetailModal(true)
  }

  async function assignTeilnehmerToModul(modulId: string, teilnehmerId: string) {
    if (!teilnehmerId) return
    const already = modulProgress.some(p => p.modul_id === modulId && p.teilnehmer_id === teilnehmerId)
    if (already) { showMessage('Bereits zugewiesen', 'success'); return }
    try {
      await pb.collection('ausbildungen_module_progress').create({
        modul_id: modulId,
        teilnehmer_id: teilnehmerId,
        fortschritt_prozent: 0,
        notizen: '',
        organization_id: user?.organization_id
      }, { requestKey: `modul-progress-${modulId}-${teilnehmerId}` })
      await loadModulProgress()
      showMessage('Teilnehmer hinzugefügt', 'success')
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function assignAllTeilnehmerToModul(modulId: string) {
    const unassigned = teilnehmer.filter(t => !modulProgress.some(p => p.modul_id === modulId && p.teilnehmer_id === t.id))
    if (unassigned.length === 0) { showMessage('Alle bereits zugewiesen', 'success'); return }
    try {
      for (const t of unassigned) {
        await pb.collection('ausbildungen_module_progress').create({
          modul_id: modulId,
          teilnehmer_id: t.id,
          fortschritt_prozent: 0,
          notizen: '',
          organization_id: user?.organization_id
        }, { requestKey: `assign-${modulId}-${t.id}` })
      }
      await loadModulProgress()
      showMessage(`${unassigned.length} Teilnehmer hinzugefügt`, 'success')
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function removeModulTeilnehmer(progressId: string) {
    try {
      await pb.collection('ausbildungen_module_progress').delete(progressId)
      await loadModulProgress()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function toggleModulAbgeschlossen(progressId: string, currentlyDone: boolean) {
    try {
      await pb.collection('ausbildungen_module_progress').update(progressId, {
        abgeschlossen_am: currentlyDone ? null : new Date().toISOString(),
        fortschritt_prozent: currentlyDone ? 0 : 100
      })
      await loadModulProgress()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function addInhaltBlock(typ: 'text' | 'quiz') {
    setModulForm(prev => ({
      ...prev,
      inhalte: [...prev.inhalte, {
        typ,
        titel: '',
        inhalt: typ === 'quiz' ? JSON.stringify({ fragen: [] }) : '',
        reihenfolge: prev.inhalte.length
      }]
    }))
  }

  function removeInhaltBlock(idx: number) {
    setModulForm(prev => ({ ...prev, inhalte: prev.inhalte.filter((_, i) => i !== idx) }))
  }

  function updateInhaltBlock(idx: number, field: 'titel' | 'inhalt', value: string) {
    setModulForm(prev => {
      const inhalte = [...prev.inhalte]
      inhalte[idx] = { ...inhalte[idx], [field]: value }
      return { ...prev, inhalte }
    })
  }

  function parseQuizInhalt(raw: any): { fragen: QuizFrage[] } {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (parsed && Array.isArray(parsed.fragen)) return parsed
    } catch {}
    return { fragen: [] }
  }

  function addQuizFrage(inhaltIdx: number) {
    if (!newQuizFrage.trim()) return
    const answers = newQuizAntworten.filter(a => a.trim())
    if (answers.length < 2) { alert('Mindestens 2 Antworten angeben'); return }
    setModulForm(prev => {
      const inhalte = [...prev.inhalte]
      const block = inhalte[inhaltIdx]
      const quizData = parseQuizInhalt(block.inhalt)
      quizData.fragen = [...quizData.fragen, { frage: newQuizFrage, antworten: answers, richtige: newQuizRichtige }]
      inhalte[inhaltIdx] = { ...block, inhalt: JSON.stringify(quizData) }
      return { ...prev, inhalte }
    })
    setNewQuizFrage('')
    setNewQuizAntworten(['', '', '', ''])
    setNewQuizRichtige(0)
    setEditingQuizBlock(null)
  }

  function removeQuizFrage(inhaltIdx: number, frageIdx: number) {
    setModulForm(prev => {
      const inhalte = [...prev.inhalte]
      const block = inhalte[inhaltIdx]
      const quizData = parseQuizInhalt(block.inhalt)
      quizData.fragen = quizData.fragen.filter((_, i) => i !== frageIdx)
      inhalte[inhaltIdx] = { ...block, inhalt: JSON.stringify(quizData) }
      return { ...prev, inhalte }
    })
  }

  async function assignModulToTermin(modulId: string, terminId: string, pflicht: boolean, frist: string) {
    try {
      await pb.collection('ausbildungen_module_termine').create({
        modul_id: modulId,
        termin_id: terminId,
        pflicht: pflicht,
        frist_datum: frist,
        organization_id: user?.organization_id
      })
      showMessage('Modul zugewiesen', 'success')
      await loadModulTermine()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // KONZEPT FUNCTIONS
  function openAddKonzept() {
    setKonzeptForm({
      name: '',
      beschreibung: '',
      lernziele: [],
      handlungen: [],
      koennen: [],
      wissensanhang_links: [],
      verknuepfte_module: [],
      verknuepfte_termine: []
    })
    setShowAddKonzeptModal(true)
  }

  function openEditKonzept(konzept: Ausbildungskonzept) {
    setKonzeptForm({
      id: konzept.id,
      name: konzept.name,
      beschreibung: konzept.beschreibung,
      lernziele: konzept.lernziele || [],
      handlungen: konzept.handlungen || [],
      koennen: konzept.koennen || [],
      wissensanhang_links: konzept.wissensanhang_links || [],
      verknuepfte_module: konzept.verknuepfte_module || [],
      verknuepfte_termine: konzept.verknuepfte_termine || []
    })
    setShowAddKonzeptModal(true)
  }

  async function saveKonzept() {
    if (!konzeptForm.name) {
      alert('Bitte Name eingeben')
      return
    }

    try {
      const data = {
        ...konzeptForm,
        organization_id: user?.organization_id
      }

      if (konzeptForm.id) {
        await pb.collection('ausbildungen_konzepte').update(konzeptForm.id, data)
        showMessage('Konzept aktualisiert', 'success')
      } else {
        await pb.collection('ausbildungen_konzepte').create(data)
        showMessage('Konzept erstellt', 'success')
      }

      setShowAddKonzeptModal(false)
      await loadKonzepte()
    } catch(e: any) {
      alert('Fehler beim Speichern: ' + e.message)
    }
  }

  async function deleteKonzept(id: string, name: string) {
    if (!confirm(`Konzept "${name}" wirklich löschen?`)) return

    try {
      await pb.collection('ausbildungen_konzepte').delete(id)
      showMessage('Konzept gelöscht', 'success')
      await loadKonzepte()
    } catch(e: any) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  function viewKonzeptDetail(konzept: Ausbildungskonzept) {
    setSelectedKonzept(konzept)
    setShowKonzeptDetailModal(true)
  }

  function addKonzeptItem(field: 'lernziele' | 'handlungen' | 'koennen') {
    let value = ''
    if (field === 'lernziele') value = newLernziel
    if (field === 'handlungen') value = newHandlung
    if (field === 'koennen') value = newKoennen
    
    if (!value.trim()) return
    
    setKonzeptForm({
      ...konzeptForm,
      [field]: [...konzeptForm[field], value.trim()]
    })
    
    if (field === 'lernziele') setNewLernziel('')
    if (field === 'handlungen') setNewHandlung('')
    if (field === 'koennen') setNewKoennen('')
  }

  function removeKonzeptItem(field: 'lernziele' | 'handlungen' | 'koennen', index: number) {
    const updated = konzeptForm[field].filter((_, i) => i !== index)
    setKonzeptForm({ ...konzeptForm, [field]: updated })
  }

  function addWissensLink() {
    if (!newLinkTitel.trim() || !newLinkUrl.trim()) return
    setKonzeptForm({
      ...konzeptForm,
      wissensanhang_links: [...konzeptForm.wissensanhang_links, {titel: newLinkTitel.trim(), url: newLinkUrl.trim()}]
    })
    setNewLinkTitel('')
    setNewLinkUrl('')
  }

  function removeWissensLink(index: number) {
    const updated = konzeptForm.wissensanhang_links.filter((_, i) => i !== index)
    setKonzeptForm({ ...konzeptForm, wissensanhang_links: updated })
  }

  // HELPER FUNCTIONS
  function getTerminTeilnehmerCount(terminId: string): number {
    return terminTeilnehmer.filter(tt => tt.termin_id === terminId).length
  }

  function getTeilnehmerName(teilnehmerId: string): string {
    const tn = teilnehmer.find(x => x.id === teilnehmerId)
    if (tn) return `${tn.vorname} ${tn.nachname}`
    const u = allUsers.find((u: any) => u.id === teilnehmerId)
    if (u) return u.name || u.email || 'Unbekannt'
    return 'Unbekannt'
  }

  // Per-Link beantwortete Rückmeldung (ausbildungen_einladungen) für denselben Teilnehmer per Namensabgleich finden
  function getLinkedEinladung(name: string, terminId: string) {
    const key = (name || '').trim().toLowerCase()
    if (!key) return undefined
    return einladungen.find(e => e.termin_id === terminId && (e.name || '').trim().toLowerCase() === key)
  }

  // Effektiver RSVP-Status: eigener Unitas-Status, sonst (falls "eingeladen") die per Link eingegangene Rückmeldung
  function getEffektivStatus(tt: TerminTeilnehmer): 'eingeladen' | 'zugesagt' | 'abgesagt' | 'entschuldigt' {
    if (tt.status !== 'eingeladen') return tt.status
    const linked = getLinkedEinladung(getTeilnehmerName(tt.teilnehmer_id), tt.termin_id)
    if (linked?.status === 'zusagen') return 'zugesagt'
    if (linked?.status === 'absagen') return 'abgesagt'
    return tt.status
  }

  // Wer abgesagt/sich entschuldigt hat, gilt ohne expliziten Anwesenheits-Status automatisch als "entschuldigt"
  function getAnwesenheitStatus(tt: TerminTeilnehmer): 'da' | 'krank' | 'entschuldigt' | 'fehlend' | '' {
    if (tt.anwesenheit_status) return tt.anwesenheit_status
    const eff = getEffektivStatus(tt)
    if (eff === 'abgesagt' || eff === 'entschuldigt') return 'entschuldigt'
    const linked = getLinkedEinladung(getTeilnehmerName(tt.teilnehmer_id), tt.termin_id)
    if (linked?.anwesenheit_status) return linked.anwesenheit_status
    return ''
  }

  function getEinladungAnwesenheitStatus(e: { status: string, anwesenheit_status?: 'da' | 'krank' | 'entschuldigt' | 'fehlend' | '' }): 'da' | 'krank' | 'entschuldigt' | 'fehlend' | '' {
    if (e.anwesenheit_status) return e.anwesenheit_status
    if (e.status === 'absagen') return 'entschuldigt'
    return ''
  }

  function getTerminDokumenteCount(terminId: string): number {
    return dokumente.filter(d => d.termin_id === terminId).length
  }

  function getTerminModuleCount(terminId: string): number {
    return modulTermine.filter(mt => mt.termin_id === terminId).length
  }

  const aktuellesJahr = new Date().getFullYear()
  const jahresTermine = termine
    .filter(t => parseDate(t.start_datetime).getFullYear() === aktuellesJahr)
    .sort((a, b) => parseDate(a.start_datetime).getTime() - parseDate(b.start_datetime).getTime())

  const anwesenheitsfarben: {[k: string]: {bg: string, label: string, color: string}} = {
    da:           {bg: '#dcfce7', label: 'Da', color: '#166534'},
    krank:        {bg: '#fef9c3', label: 'Kr', color: '#92400e'},
    entschuldigt: {bg: '#dbeafe', label: 'En', color: '#1e40af'},
    fehlend:      {bg: '#fee2e2', label: 'Fe', color: '#991b1b'},
  }

  // LBF helpers
  const addBtnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 8, border: 'none',
    background: 'rgba(96,8,18,0.07)', color: '#600812', fontSize: 20,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0
  }

  function terminStatusColor(status: string): string {
    if (status === 'geplant') return '#600812'
    if (status === 'laufend') return '#d97706'
    if (status === 'abgeschlossen') return '#16a34a'
    if (status === 'abgesagt') return 'rgba(139,113,90,0.4)'
    return '#600812'
  }

  function terminStatusBg(status: string): string {
    if (status === 'geplant') return 'rgba(96,8,18,0.07)'
    if (status === 'laufend') return 'rgba(217,119,6,0.12)'
    if (status === 'abgeschlossen') return 'rgba(22,163,74,0.1)'
    if (status === 'abgesagt') return 'rgba(139,113,90,0.1)'
    return 'rgba(96,8,18,0.07)'
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>

      {/* ── MASTHEAD HEADER ── */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', position: 'sticky', top: 0, zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/hub" style={{ display: 'flex', color: '#600812', textDecoration: 'none', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </a>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--lbf-text)' }}>Ausbildungen</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{user?.organization_name || 'Responda'}</div>
          </div>
          {viewMode === 'termine' && (
            <button onClick={openAddTermin} style={addBtnStyle} title="Termin hinzufügen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          )}
          {viewMode === 'teilnehmer' && (
            <button onClick={openAddTeilnehmer} style={addBtnStyle} title="Teilnehmer hinzufügen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          )}
          {viewMode === 'module' && (
            <button onClick={openAddModul} style={addBtnStyle} title="Modul hinzufügen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          )}
          {viewMode === 'konzepte' && (
            <button onClick={openAddKonzept} style={addBtnStyle} title="Konzept hinzufügen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          )}
          {viewMode === 'lernfeed' && (
            <button onClick={() => { setBookPages([{ id: Math.random().toString(36).slice(2,9), blocks: [] }]); setBookPageIdx(0); setBookDir(1); setShowBlockPicker(false); setBeitragForm({ titel: '', tags: '', gepinnt: false, color: '#600812', pattern: null, coverBlockId: null }); setEditingBeitragId(null); setShowBeitragModal(true) }} style={addBtnStyle} title="Beitrag erstellen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          )}
          {viewMode === 'praesentationen' && (
            <button onClick={openNewPraesentation} style={addBtnStyle} title="Neue Präsentation">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* ── VIEW NAVIGATION BAR ── */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.1)', position: 'sticky', top: 'calc(env(safe-area-inset-top) + 60px)', zIndex: 99, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        <div style={{ display: 'flex', paddingLeft: 'max(8px, env(safe-area-inset-left))', paddingRight: 'max(8px, env(safe-area-inset-right))', minWidth: 'max-content' }}>
          {([
            { key: 'termine' as const, label: 'Termine', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, count: undefined },
            { key: 'teilnehmer' as const, label: 'Teilnehmer', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>, count: undefined },
            { key: 'module' as const, label: 'Module', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, count: undefined },
            { key: 'konzepte' as const, label: 'Konzepte', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>, count: undefined },
            { key: 'jahresuebersicht' as const, label: 'Jahresplan', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>, count: undefined },
            { key: 'archiv' as const, label: 'Archiv', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21,8 21,21 3,21 3,8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>, count: archivTermine.length },
            { key: 'lernfeed' as const, label: 'Lernfeed', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1" fill="currentColor" stroke="none"/></svg>, count: undefined },
            { key: 'dozent' as const, label: 'Dozent', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>, count: undefined },
            { key: 'praesentationen' as const, label: 'Folien', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>, count: undefined },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setViewMode(tab.key)
                if (tab.key === 'lernfeed' || tab.key === 'dozent') loadBeitraege()
                if (tab.key === 'praesentationen') loadPraesentationen()
              }}
              className="ausb-nav-btn"
              style={{
                color: viewMode === tab.key ? '#600812' : 'var(--warm-gray)',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: viewMode === tab.key ? '#600812' : 'transparent',
                background: 'none', border: 'none', borderBottom: viewMode === tab.key ? '2px solid #600812' : '2px solid transparent',
                padding: '6px 12px 0', height: 50, cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: 'inherit', position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}
            >
              {tab.icon}
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tab.label}</span>
              {tab.count != null && tab.count > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 6, background: '#600812', color: '#fff', borderRadius: 8, padding: '1px 4px', fontSize: 9, fontWeight: 700 }}>
                  {tab.count > 9 ? '9+' : tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TOAST ── */}
      {message && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 20px', borderRadius: 12, fontWeight: 600, fontSize: 14,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', whiteSpace: 'nowrap', zIndex: 9999,
          ...(message.type === 'success'
            ? { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }
            : { background: '#fff0f0', border: '1px solid rgba(96,8,18,0.2)', color: '#600812' })
        }}>
          {message.text}
        </div>
      )}

      {(viewMode === 'termine' || viewMode === 'teilnehmer' || viewMode === 'module' || viewMode === 'konzepte') && (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px max(16px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 40px)' }}>


        {/* TERMINE VIEW */}
        {viewMode === 'termine' && (
          loading ? (
            <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 15 }}>Lade Termine...</div>
          ) : filteredTermine.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 15 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--lbf-text)', fontStyle: 'normal' }}>Keine Termine</div>
              <div>Erstelle deinen ersten Ausbildungstermin</div>
            </div>
          ) : (() => {
            // Chronologische Agenda statt Kachel-Raster: nach Monat gruppiert
            const sortedTermine = [...filteredTermine].sort((a, b) => parseDate(a.start_datetime).getTime() - parseDate(b.start_datetime).getTime())
            const monthGroups: { key: string; label: string; items: Termin[] }[] = []
            sortedTermine.forEach(termin => {
              const gd = parseDate(termin.start_datetime)
              const key = isNaN(gd.getTime()) ? 'ohne' : `${gd.getFullYear()}-${gd.getMonth()}`
              const label = isNaN(gd.getTime()) ? 'Ohne Datum' : gd.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }).toUpperCase()
              let grp = monthGroups.find(x => x.key === key)
              if (!grp) { grp = { key, label, items: [] }; monthGroups.push(grp) }
              grp.items.push(termin)
            })
            const now = Date.now()
            const nextTerminId = sortedTermine.find(termin => {
              const td = parseDate(termin.start_datetime).getTime()
              return !isNaN(td) && td >= now && termin.status !== 'abgesagt'
            })?.id
            const renderTerminCard = (termin: Termin) => {
                const teilnehmerCount = getTerminTeilnehmerCount(termin.id)
                const dokumenteCount = getTerminDokumenteCount(termin.id)
                const moduleCount = getTerminModuleCount(termin.id)
                const d = parseDate(termin.start_datetime)
                const weekday = isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE', { weekday: 'short' }).toUpperCase()
                const dayNum = isNaN(d.getTime()) ? '–' : d.getDate()
                const month = isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE', { month: 'short' }).toUpperCase()
                const statusColor = terminStatusColor(termin.status)
                const statusBg = terminStatusBg(termin.status)
                const statusLabel = termin.status === 'geplant' ? 'Geplant' : termin.status === 'laufend' ? 'Laufend' : termin.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Abgesagt'
                const isNext = termin.id === nextTerminId
                const fillRatio = termin.max_teilnehmer > 0 ? teilnehmerCount / termin.max_teilnehmer : 0
                const tnColor = fillRatio >= 1 ? '#16a34a' : fillRatio >= 0.5 ? '#d97706' : 'var(--warm-gray)'
                const circleColor = termin.status === 'abgesagt' ? '#8a7a68' : statusColor
                return (
                  <div
                    key={termin.id}
                    onClick={() => openTerminDetailPage(termin)}
                    style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', borderLeft: `3px solid ${statusColor}`, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'stretch', padding: '12px 14px 10px' }}>
                      {/* Left date column */}
                      <div style={{ minWidth: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginRight: 12, gap: 4 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--warm-gray)' }}>{weekday}</div>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: circleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', fontWeight: 800, fontSize: 16, color: '#fde8d8', flexShrink: 0 }}>{dayNum}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--warm-gray)' }}>{month}</div>
                      </div>
                      {/* Right content */}
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 28 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 8 }}>
                          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)', lineHeight: 1.3 }}>{termin.name}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                            {isNext && (
                              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#fde8d8', background: '#600812', padding: '2px 8px', borderRadius: 99 }}>Nächster</span>
                            )}
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: statusColor, background: statusBg, padding: '2px 8px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              {termin.status === 'laufend' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, animation: 'pulseDot 1.4s ease-in-out infinite' }} />}
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                        {termin.location && <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>{termin.location}</div>}
                        {termin.dozent && <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>{termin.dozent}</div>}
                      </div>
                    </div>
                    {/* Bottom stats strip */}
                    <div style={{ borderTop: '0.5px solid rgba(138,122,104,0.15)', background: 'rgba(138,122,104,0.06)', padding: '8px 14px', display: 'flex', gap: 14, fontSize: 12, fontWeight: 600 }}>
                      <span style={{ color: tnColor }}>{teilnehmerCount}/{termin.max_teilnehmer} TN</span>
                      {dokumenteCount > 0 && <span style={{ color: 'var(--warm-gray)' }}>{dokumenteCount} Dok.</span>}
                      {moduleCount > 0 && <span style={{ color: 'var(--warm-gray)' }}>{moduleCount} Mod.</span>}
                    </div>
                    {/* 3-dot menu */}
                    <button
                      style={{ position: 'absolute', top: 14, right: 10, background: 'rgba(250,249,247,0.9)', border: '0.5px solid rgba(96,8,18,0.12)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--warm-gray)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        const menuId = `menu-${termin.id}`
                        const menu = document.getElementById(menuId)
                        document.querySelectorAll('.card-menu-dropdown').forEach(m => { if (m.id !== menuId) m.classList.remove('show') })
                        menu?.classList.toggle('show')
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/></svg>
                    </button>
                    <div id={`menu-${termin.id}`} className="card-menu-dropdown" style={{ top: 46, right: 10 }}>
                      <button className="menu-item" onClick={(e) => { e.stopPropagation(); openEditTermin(termin) }}>Bearbeiten</button>
                      <button className="menu-item danger" onClick={(e) => { e.stopPropagation(); deleteTermin(termin.id, termin.name) }}>Löschen</button>
                    </div>
                  </div>
                )
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {monthGroups.map(group => (
                  <div key={group.key}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>{group.label}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {group.items.map(renderTerminCard)}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()
        )}

        {/* TEILNEHMER VIEW */}
        {viewMode === 'teilnehmer' && (
          loading ? (
            <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 15 }}>Lade Teilnehmer...</div>
          ) : filteredTeilnehmer.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 15 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--lbf-text)', fontStyle: 'normal' }}>Keine Teilnehmer</div>
              <div>Füge Teilnehmer hinzu oder weise sie einem Termin zu</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {filteredTeilnehmer.map(t => (
                <div
                  key={t.id}
                  onClick={() => viewTeilnehmerDetail(t)}
                  style={{ background: 'var(--lbf-card)', borderRadius: 12, borderLeft: '3px solid #600812', boxShadow: 'var(--lbf-shadow)', padding: '14px 14px 10px', cursor: 'pointer', position: 'relative' }}
                >
                  {/* 3-dot menu */}
                  <button
                    style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(250,249,247,0.9)', border: '0.5px solid rgba(96,8,18,0.12)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--warm-gray)' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      const menuId = `menu-${t.id}`
                      const menu = document.getElementById(menuId)
                      document.querySelectorAll('.card-menu-dropdown').forEach(m => { if (m.id !== menuId) m.classList.remove('show') })
                      menu?.classList.toggle('show')
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/></svg>
                  </button>
                  <div id={`menu-${t.id}`} className="card-menu-dropdown" style={{ top: 42, right: 10 }}>
                    <button className="menu-item" onClick={(e) => { e.stopPropagation(); openEditTeilnehmer(t) }}>Bearbeiten</button>
                    <button className="menu-item" onClick={(e) => { e.stopPropagation(); toggleLernbarZugang(t) }}>{t.lernbar_zugang_aktiv ? 'Lernbar deaktivieren' : 'Lernbar aktivieren'}</button>
                    <button className="menu-item danger" onClick={(e) => { e.stopPropagation(); deleteTeilnehmer(t.id, `${t.vorname} ${t.nachname}`) }}>Löschen</button>
                  </div>

                  <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>{t.ausbildung_typ || 'Teilnehmer'}</div>
                  <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)', marginBottom: 4, paddingRight: 32 }}>{t.vorname} {t.nachname}</div>
                  <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 8 }}>
                    {t.email && <div>{t.email}</div>}
                    {t.telefon && <div>{t.telefon}</div>}
                  </div>

                  {t.lernbar_zugang_aktiv && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(96,8,18,0.07)', borderRadius: 5, padding: '3px 8px' }}>
                        Lernbar aktiv
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* MODULE VIEW */}
        {viewMode === 'module' && (
          loading ? (
            <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 15 }}>Lade Module...</div>
          ) : filteredModule.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 15 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--lbf-text)', fontStyle: 'normal' }}>Keine Module</div>
              <div>Erstelle dein erstes Lernmodul</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {filteredModule.map(m => {
                const assigned = modulProgress.filter(p => p.modul_id === m.id)
                const done = assigned.filter(p => p.abgeschlossen_am)
                return (
                  <div key={m.id} onClick={() => openModulDetail(m)} style={{ background: 'var(--lbf-card)', borderRadius: 12, borderLeft: '3px solid #600812', boxShadow: 'var(--lbf-shadow)', padding: '14px 14px 10px', cursor: 'pointer', position: 'relative' }}>
                    {/* 3-dot menu */}
                    <button
                      style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(250,249,247,0.9)', border: '0.5px solid rgba(96,8,18,0.12)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--warm-gray)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        const menuId = `menu-m-${m.id}`
                        const menu = document.getElementById(menuId)
                        document.querySelectorAll('.card-menu-dropdown').forEach(el => { if (el.id !== menuId) el.classList.remove('show') })
                        menu?.classList.toggle('show')
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/></svg>
                    </button>
                    <div id={`menu-m-${m.id}`} className="card-menu-dropdown" style={{ top: 42, right: 10 }}>
                      <button className="menu-item" onClick={(e) => { e.stopPropagation(); openEditModul(m) }}>Bearbeiten</button>
                      <button className="menu-item danger" onClick={(e) => { e.stopPropagation(); deleteModul(m.id, m.name) }}>Löschen</button>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>{m.dauer_minuten} Min.</div>
                    <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)', marginBottom: 4, paddingRight: 32 }}>{m.name}</div>
                    <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 10 }}>{m.beschreibung && <div>{m.beschreibung}</div>}</div>
                    <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'rgba(250,249,247,0.8)', margin: '0 -14px', padding: '8px 14px', display: 'flex', gap: 14, fontSize: 12, color: 'var(--warm-gray)', fontWeight: 600 }}>
                      <span>{m.inhalte?.length || 0} Blöcke</span>
                      <span>{done.length}/{assigned.length} abgeschl.</span>
                    </div>
                    {assigned.length > 0 && (
                      <div style={{height: '3px', background: 'rgba(96,8,18,0.06)', borderRadius: '0 0 12px 12px', overflow: 'hidden', margin: '0 -14px'}}>
                        <div style={{height: '100%', background: '#16a34a', width: `${Math.round((done.length / assigned.length) * 100)}%`, transition: 'width 0.3s'}} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* KONZEPTE VIEW */}
        {viewMode === 'konzepte' && (
          loading ? (
            <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 15 }}>Lade Konzepte...</div>
          ) : filteredKonzepte.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 15 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--lbf-text)', fontStyle: 'normal' }}>Keine Konzepte</div>
              <div>Erstelle dein erstes Ausbildungskonzept</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {filteredKonzepte.map(k => (
                <div
                  key={k.id}
                  onClick={() => viewKonzeptDetail(k)}
                  style={{ background: 'var(--lbf-card)', borderRadius: 12, borderLeft: '3px solid #600812', boxShadow: 'var(--lbf-shadow)', padding: '14px 14px 10px', cursor: 'pointer', position: 'relative' }}
                >
                  {/* 3-dot menu */}
                  <button
                    style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(250,249,247,0.9)', border: '0.5px solid rgba(96,8,18,0.12)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--warm-gray)' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      const menuId = `menu-${k.id}`
                      const menu = document.getElementById(menuId)
                      document.querySelectorAll('.card-menu-dropdown').forEach(m => { if (m.id !== menuId) m.classList.remove('show') })
                      menu?.classList.toggle('show')
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/></svg>
                  </button>
                  <div id={`menu-${k.id}`} className="card-menu-dropdown" style={{ top: 42, right: 10 }}>
                    <button className="menu-item" onClick={(e) => { e.stopPropagation(); openEditKonzept(k) }}>Bearbeiten</button>
                    <button className="menu-item danger" onClick={(e) => { e.stopPropagation(); deleteKonzept(k.id, k.name) }}>Löschen</button>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>Konzept</div>
                  <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)', marginBottom: 4, paddingRight: 32 }}>{k.name}</div>
                  <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 10 }}>
                    {k.beschreibung && <div>{k.beschreibung}</div>}
                  </div>
                  <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'rgba(250,249,247,0.8)', margin: '0 -14px', padding: '8px 14px', display: 'flex', gap: 14, fontSize: 12, color: 'var(--warm-gray)', fontWeight: 600 }}>
                    <span>{k.lernziele?.length || 0} Lernziele</span>
                    <span>{k.handlungen?.length || 0} Handlungen</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
      )}

      {/* JAHRESÜBERSICHT VIEW */}
      {viewMode === 'jahresuebersicht' && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px max(16px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 40px)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Jahresplan</div>
          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)', marginBottom: 4 }}>Jahresübersicht {aktuellesJahr}</div>
          <p style={{color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: '12px', marginBottom: '24px'}}>
            Anwesenheit aller Teilnehmer bei allen Terminen im Jahr {aktuellesJahr}
          </p>

          {teilnehmer.length === 0 || jahresTermine.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 15 }}>Keine Daten vorhanden</div>
          ) : (
            <div>
              <div>
                {/* Matrix-Tabelle */}
                <div style={{overflowX: 'auto', marginBottom: '32px'}}>
                  <table style={{borderCollapse: 'collapse', width: '100%', fontSize: '13px'}}>
                    <thead>
                      <tr>
                        <th style={{textAlign: 'left', padding: '10px 12px', background: 'var(--warm-bg)', borderBottom: '2px solid rgba(96,8,18,0.1)', position: 'sticky', left: 0, zIndex: 1, minWidth: '160px', color: 'var(--lbf-text)'}}>
                          Teilnehmer
                        </th>
                        {jahresTermine.map(t => (
                          <th key={t.id} style={{padding: '10px 8px', background: 'var(--warm-bg)', borderBottom: '2px solid rgba(96,8,18,0.1)', textAlign: 'center', minWidth: '80px', fontWeight: 600, color: 'var(--lbf-text)'}}>
                            <div>{fmtDayMonth(t.start_datetime)}</div>
                            <div style={{fontWeight: 400, color: 'var(--warm-gray)', fontSize: '11px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{t.name}</div>
                          </th>
                        ))}
                        <th style={{padding: '10px 12px', background: 'var(--warm-bg)', borderBottom: '2px solid rgba(96,8,18,0.1)', textAlign: 'center', minWidth: '80px', color: 'var(--lbf-text)'}}>
                          Gesamt
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {teilnehmer.map((t, idx) => {
                        let daCount = 0
                        return (
                          <tr key={t.id} style={{background: idx % 2 === 0 ? '#ffffff' : '#faf9f7'}}>
                            <td style={{padding: '10px 12px', fontWeight: 600, borderBottom: '1px solid rgba(96,8,18,0.06)', position: 'sticky', left: 0, background: idx % 2 === 0 ? '#ffffff' : '#faf9f7', zIndex: 1, color: 'var(--lbf-text)'}}>
                              {t.vorname} {t.nachname}
                              {t.ausbildung_typ && <div style={{fontSize: '11px', color: 'var(--warm-gray)', fontWeight: 400}}>{t.ausbildung_typ}</div>}
                            </td>
                            {jahresTermine.map(termin => {
                              const tt = terminTeilnehmer.find(tt => tt.termin_id === termin.id && tt.teilnehmer_id === t.id)
                              const anw = tt ? getAnwesenheitStatus(tt) : ''
                              if (anw === 'da') daCount++
                              const cfg = anw ? anwesenheitsfarben[anw] : null
                              return (
                                <td key={termin.id} style={{padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid rgba(96,8,18,0.06)'}}>
                                  {cfg ? (
                                    <span style={{display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '11px'}}>
                                      {cfg.label}
                                    </span>
                                  ) : (
                                    tt ? <span style={{color: 'var(--warm-gray)', fontSize: '11px'}}>–</span>
                                       : <span style={{color: 'var(--lbf-input-border)', fontSize: '11px'}}>·</span>
                                  )}
                                </td>
                              )
                            })}
                            <td style={{padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid rgba(96,8,18,0.06)', fontWeight: 700}}>
                              <span style={{color: daCount > 0 ? '#16a34a' : 'var(--warm-gray)'}}>
                                {daCount}/{jahresTermine.length}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Gesamtauswertung */}
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>Gesamtauswertung</div>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px'}}>
                  {teilnehmer.map(t => {
                    const ttList = terminTeilnehmer.filter(tt => tt.teilnehmer_id === t.id && jahresTermine.some(jt => jt.id === tt.termin_id))
                    const da = ttList.filter(tt => getAnwesenheitStatus(tt) === 'da').length
                    const krank = ttList.filter(tt => getAnwesenheitStatus(tt) === 'krank').length
                    const entschuldigt = ttList.filter(tt => getAnwesenheitStatus(tt) === 'entschuldigt').length
                    const fehlend = ttList.filter(tt => getAnwesenheitStatus(tt) === 'fehlend').length
                    const prozent = jahresTermine.length > 0 ? Math.round((da / jahresTermine.length) * 100) : 0
                    const erreicht = prozent >= 80
                    return (
                      <div key={t.id} style={{background: 'var(--lbf-card)', border: `1.5px solid ${erreicht ? '#16a34a' : 'rgba(96,8,18,0.1)'}`, borderRadius: '12px', padding: '16px', boxShadow: 'var(--lbf-shadow)'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
                          <div>
                            <div style={{fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)'}}>{t.vorname} {t.nachname}</div>
                            {t.ausbildung_typ && <div style={{fontStyle: 'italic', fontSize: '12px', color: 'var(--warm-gray)'}}>{t.ausbildung_typ}</div>}
                          </div>
                          <span style={{padding: '4px 10px', borderRadius: '6px', background: erreicht ? '#dcfce7' : '#fef2f2', color: erreicht ? '#166534' : '#991b1b', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em'}}>
                            {erreicht ? 'Erreicht' : 'Nicht erreicht'}
                          </span>
                        </div>
                        <div style={{background: 'rgba(96,8,18,0.06)', borderRadius: '6px', height: '6px', marginBottom: '8px'}}>
                          <div style={{background: prozent >= 80 ? '#16a34a' : prozent >= 50 ? '#d97706' : '#600812', borderRadius: '6px', height: '6px', width: `${Math.min(prozent, 100)}%`, transition: 'width 0.3s'}} />
                        </div>
                        <div style={{fontStyle: 'italic', fontSize: '12px', color: 'var(--warm-gray)', display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                          <span style={{color: '#16a34a'}}><b>{da}</b> Da</span>
                          <span style={{color: '#d97706'}}><b>{krank}</b> Krank</span>
                          <span style={{color: '#2563eb'}}><b>{entschuldigt}</b> Entsch.</span>
                          <span style={{color: '#dc2626'}}><b>{fehlend}</b> Fehlend</span>
                          <span style={{marginLeft: 'auto', fontWeight: 700, color: '#600812'}}>{prozent}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ARCHIV VIEW */}
      {viewMode === 'archiv' && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px max(16px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 40px)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>Archiv</div>
          <p style={{fontStyle: 'italic', color: 'var(--warm-gray)', fontSize: '12px', marginBottom: '24px'}}>
            Abgeschlossene Termine — nach Jahr sortiert
          </p>
          {archivTermine.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 15 }}>Noch keine abgeschlossenen Termine</div>
          ) : (() => {
            const Jahre = ([...new Set(
              archivTermine.map(t => parseDate(t.start_datetime).getFullYear())
            )] as number[]).sort((a, b) => b - a)
            return (
              <div style={{display: 'flex', flexDirection: 'column', gap: '32px'}}>
                {Jahre.map(jahr => {
                  const jahrTermine = archivTermine
                    .filter(t => parseDate(t.start_datetime).getFullYear() === jahr)
                    .sort((a, b) => parseDate(b.start_datetime).getTime() - parseDate(a.start_datetime).getTime())
                  return (
                    <div key={jahr}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px'}}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>{jahr}</div>
                        <span style={{fontStyle: 'italic', fontSize: '12px', color: 'var(--warm-gray)'}}>{jahrTermine.length} Termine</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        {jahrTermine.map(termin => {
                          const d = parseDate(termin.start_datetime)
                          const weekday = d.toLocaleDateString('de-DE', { weekday: 'short' }).toUpperCase()
                          const dayNum = d.getDate()
                          const month = d.toLocaleDateString('de-DE', { month: 'short' }).toUpperCase()
                          return (
                            <div
                              key={termin.id}
                              onClick={() => viewTerminDetail(termin)}
                              style={{
                                background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)',
                                borderLeft: '3px solid rgba(139,113,90,0.4)', overflow: 'hidden',
                                cursor: 'pointer', display: 'flex', alignItems: 'stretch'
                              }}
                            >
                              <div style={{ minWidth: 56, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '0.5px solid rgba(96,8,18,0.1)', gap: 2 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--warm-gray)' }}>{weekday}</div>
                                <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 24, lineHeight: 1, color: 'rgba(139,113,90,0.6)' }}>{dayNum}</div>
                                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--warm-gray)' }}>{month}</div>
                              </div>
                              <div style={{ flex: 1, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <div>
                                  <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>{termin.name}</div>
                                  <div style={{ fontStyle: 'italic', fontSize: '12px', color: 'var(--warm-gray)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {termin.location && <span>{termin.location}</span>}
                                    {termin.dozent && <span>{termin.dozent}</span>}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div style={{ fontStyle: 'italic', fontSize: '11px', color: 'var(--warm-gray)' }}>
                                    {fmtTime(termin.start_datetime)} Uhr
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* LERNFEED VIEW */}
      {viewMode === 'lernfeed' && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px max(16px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 40px)' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>Lernfeed</div>
            <p style={{ fontStyle: 'italic', color: 'var(--warm-gray)', fontSize: 12, margin: 0 }}>
              Lernbeiträge für den Unitas-Feed — erscheinen in der Lernbar deiner Teilnehmer
            </p>
          </div>

          {beitraegeLoading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Lade...</div>
          ) : beitraege.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 15 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--lbf-text)' }}>Noch keine Lernbeiträge</div>
              <div>Erstelle deinen ersten Beitrag mit dem + Button oben</div>
            </div>
          ) : (() => {
            const COVER_COLORS: Record<string, { bg: string; spine: string }> = {
              text:  { bg: 'linear-gradient(165deg, #600812 0%, #3d0408 100%)', spine: 'rgba(0,0,0,0.3)' },
              bild:  { bg: 'linear-gradient(165deg, #7c2d12 0%, #431407 100%)', spine: 'rgba(0,0,0,0.3)' },
              video: { bg: 'linear-gradient(165deg, #065f46 0%, #022c22 100%)', spine: 'rgba(0,0,0,0.3)' },
              quiz:  { bg: 'linear-gradient(165deg, #1e3a8a 0%, #0f172a 100%)', spine: 'rgba(0,0,0,0.3)' },
            }
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {beitraege.map(b => {
                  const bildArrC = Array.isArray(b.bild) ? b.bild : (b.bild ? [b.bild] : [])
                  const bInhaltC = parseInhalt(b.inhalt)
                  let bookColorC: string | null = null
                  let bookPatternC: string | null = null
                  if (bInhaltC?.v === 2) { if (bInhaltC.color) bookColorC = bInhaltC.color; if (bInhaltC.pattern) bookPatternC = bInhaltC.pattern }
                  const cfgC = bookColorC
                    ? (() => { const r = parseInt(bookColorC!.slice(1,3),16), g = parseInt(bookColorC!.slice(3,5),16), bv = parseInt(bookColorC!.slice(5,7),16); return { bg: `linear-gradient(165deg, ${bookColorC} 0%, rgb(${Math.round(r*.55)},${Math.round(g*.55)},${Math.round(bv*.55)}) 100%)`, spine: 'rgba(0,0,0,0.3)' } })()
                    : (COVER_COLORS[b.typ] || COVER_COLORS.text)
                  // Resolve cover image (same logic as Lernbar)
                  let bildUrlC: string | null = null
                  if (bInhaltC?.v === 2 && bInhaltC.cover_block_id && Array.isArray(bInhaltC.pages)) {
                    outer: for (const page of bInhaltC.pages as any[]) {
                      for (const blk of (page.blocks || []) as any[]) {
                        if (blk.id === bInhaltC.cover_block_id && blk.type === 'bild') {
                          if (blk.bildIdx !== undefined && bildArrC[blk.bildIdx]) bildUrlC = `https://api.responda.systems/api/files/${b.collectionId}/${b.id}/${bildArrC[blk.bildIdx]}`
                          else if (blk.bildExistingUrl) bildUrlC = blk.bildExistingUrl
                          break outer
                        }
                      }
                    }
                  }
                  if (!bildUrlC && bildArrC[0]) bildUrlC = `https://api.responda.systems/api/files/${b.collectionId}/${b.id}/${bildArrC[0]}`
                  const tags: string[] = (() => { try { const t = b.tags; return Array.isArray(t) ? t : JSON.parse(t as any) } catch { return [] } })()
                  return (
                    <div key={b.id}>
                      {/* Book cover */}
                      <div style={{ cursor: 'pointer', borderRadius: 10, overflow: 'hidden', aspectRatio: '3/4', position: 'relative', background: bildUrlC ? '#1a0e08' : cfgC.bg, boxShadow: '3px 5px 18px rgba(0,0,0,0.28), inset -3px 0 8px rgba(0,0,0,0.18)', marginBottom: 8 }}
                        onClick={() => openEditBeitrag(b)}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 7, background: cfgC.spine, zIndex: 3 }} />
                        {!bildUrlC && bookPatternC && (() => { const pp = getPatternBg(bookPatternC); return pp ? <div style={{ position: 'absolute', inset: 0, backgroundImage: pp.backgroundImage, backgroundSize: pp.backgroundSize || 'auto', zIndex: 1, pointerEvents: 'none' }} /> : null })()}
                        {bildUrlC && <img src={bildUrlC} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                        <div style={{ position: 'absolute', inset: 0, background: bildUrlC ? 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.05) 55%, transparent 100%)' : 'none', zIndex: 2 }} />
                        {b.gepinnt && (
                          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 4 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(253,232,216,0.9)"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/></svg>
                          </div>
                        )}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 10px 10px 16px', zIndex: 4 }}>
                          <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 12, color: '#fff', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const } as React.CSSProperties}>{b.titel}</div>
                          {tags.length > 0 && (
                            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {tags.slice(0, 2).map(t => `#${t}`).join(' ')}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => openEditBeitrag(b)} style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: '1px solid rgba(96,8,18,0.18)', background: 'rgba(96,8,18,0.04)', color: '#600812', fontWeight: 600, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Bearbeiten
                        </button>
                        <button onClick={() => deleteBeitrag(b.id)} style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid rgba(96,8,18,0.12)', background: 'none', color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* PRAESENTATIONEN LIST VIEW */}
      {viewMode === 'praesentationen' && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px max(16px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 40px)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>Präsentationen</div>
          {praesentationenLoading ? (
            <div style={{ color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 13 }}>Lade…</div>
          ) : praesentationen.length === 0 ? (
            <div style={{ background: 'var(--lbf-card)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 14 }}>
              Noch keine Präsentationen — klicke auf + um eine zu erstellen.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {praesentationen.map(p => {
                const parsed = parseInhalt(p.inhalt)
                const firstSlide = parsed?.slides?.[0]
                const slideCount = parsed?.slides?.length || 0
                const bildArr: string[] = Array.isArray(p.bilder) ? p.bilder as string[] : (p.bilder ? [p.bilder as string] : [])
                let coverImg: string | null = null
                if (firstSlide?.imageIdx !== undefined && bildArr[firstSlide.imageIdx]) coverImg = `https://api.responda.systems/api/files/${p.collectionId}/${p.id}/${bildArr[firstSlide.imageIdx]}`
                else if (firstSlide?.imageExistingUrl) coverImg = firstSlide.imageExistingUrl
                const patBg = firstSlide?.pattern ? getPatternBg(firstSlide.pattern) : null
                return (
                  <div key={p.id} style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', background: '#fff' }}>
                    <div style={{ aspectRatio: '16/9', background: firstSlide?.bg || '#600812', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {coverImg && <img src={coverImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                      {patBg && <div style={{ position: 'absolute', inset: 0, backgroundImage: patBg.backgroundImage, backgroundSize: patBg.backgroundSize || 'auto', zIndex: 1 }} />}
                      {coverImg && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.7) 0%,rgba(0,0,0,0.1) 60%,transparent 100%)', zIndex: 2 }} />}
                      {firstSlide?.title && (
                        <div style={{ color: firstSlide.textColor || '#fff', fontSize: 13, fontWeight: 700, fontStyle: 'italic', textAlign: 'center', padding: '0 14px', zIndex: 3, position: 'relative', lineHeight: 1.3 }}>{firstSlide.title}</div>
                      )}
                      <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600, zIndex: 3 }}>{slideCount} Folie{slideCount !== 1 ? 'n' : ''}</div>
                    </div>
                    <div style={{ padding: '10px 12px 12px' }}>
                      <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 14, color: 'var(--lbf-text)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titel}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEditPraesentation(p)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid rgba(96,8,18,0.2)', background: 'transparent', color: '#600812', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Bearbeiten</button>
                        <button onClick={() => { openEditPraesentation(p); setTimeout(() => { setShowPresentationMode(true); setPresentationModeSlideIdx(0) }, 50) }} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', background: '#600812', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Präsentieren</button>
                        <button onClick={() => deletePraesentation(p.id)} style={{ width: 30, padding: '6px 0', borderRadius: 8, border: '1px solid rgba(96,8,18,0.15)', background: 'transparent', color: 'var(--warm-gray)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* DOZENT VIEW */}
      {viewMode === 'dozent' && (() => {
        const isMyTermin = (t: Termin) =>
          (t.dozent_id && t.dozent_id === user?.id) ||
          (!t.dozent_id && t.dozent && t.dozent.trim().toLowerCase() === (user?.name || '').trim().toLowerCase())

        const sortedTermine = [...termine].sort((a, b) => parseDate(a.start_datetime).getTime() - parseDate(b.start_datetime).getTime())
        const meineTermine = sortedTermine.filter(isMyTermin)
        const displayedTermine = dozentTermineFilter === 'alle' ? sortedTermine : meineTermine

        return (
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px max(16px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 40px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                {dozentTermineFilter === 'alle' ? 'Alle Termine' : 'Meine Termine'}
              </div>
              <div style={{ display: 'flex', background: '#fff', borderRadius: 99, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 3 }}>
                {([
                  { key: 'meine', label: 'Meine Termine' },
                  { key: 'alle', label: 'Alle Dozenten' },
                ] as const).map(opt => (
                  <button key={opt.key} onClick={() => setDozentTermineFilter(opt.key)} style={{
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    padding: '6px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    background: dozentTermineFilter === opt.key ? '#600812' : 'transparent',
                    color: dozentTermineFilter === opt.key ? '#fff' : 'var(--warm-gray)',
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {displayedTermine.length === 0 ? (
              <div style={{ background: 'var(--lbf-card)', borderRadius: 12, padding: '24px 20px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 14, textAlign: 'center' }}>
                {dozentTermineFilter === 'alle' ? 'Keine Termine vorhanden.' : 'Keine Termine zugewiesen — trage dich als Dozent in einem Termin ein.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {displayedTermine.map(termin => {
                  const teilnehmerCount = getTerminTeilnehmerCount(termin.id)
                  const dokumenteCount = getTerminDokumenteCount(termin.id)
                  const moduleCount = getTerminModuleCount(termin.id)
                  let todos: {id: string; text: string; done: boolean}[] = []
                  try { todos = termin.dozent_todos ? JSON.parse(termin.dozent_todos) : [] } catch { todos = [] }
                  const doneTodos = todos.filter(td => td.done).length
                  const d = parseDate(termin.start_datetime)
                  const weekday = isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE', { weekday: 'short' }).toUpperCase()
                  const dayNum = isNaN(d.getTime()) ? '–' : d.getDate()
                  const month = isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE', { month: 'short' }).toUpperCase()
                  const statusColor = terminStatusColor(termin.status)
                  const statusLabel = termin.status === 'geplant' ? 'Geplant' : termin.status === 'laufend' ? 'Laufend' : termin.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Abgesagt'
                  const showsForeignDozent = dozentTermineFilter === 'alle' && !isMyTermin(termin) && !!termin.dozent
                  return (
                    <div
                      key={termin.id}
                      onClick={() => openTerminDetailPage(termin)}
                      style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', cursor: 'pointer', position: 'relative' }}
                    >
                      {/* Status strip top */}
                      <div style={{ height: 3, background: statusColor, borderRadius: '12px 12px 0 0' }} />
                      <div style={{ display: 'flex', alignItems: 'stretch', padding: '12px 14px 10px' }}>
                        {/* Left date column */}
                        <div style={{ minWidth: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingRight: 12, borderRight: '0.5px solid rgba(96,8,18,0.1)', marginRight: 12, gap: 2, paddingTop: 2 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--warm-gray)' }}>{weekday}</div>
                          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 30, lineHeight: 1, color: statusColor }}>{dayNum}</div>
                          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--warm-gray)' }}>{month}</div>
                        </div>
                        {/* Right content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)', lineHeight: 1.3 }}>{termin.name}</div>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: statusColor, flexShrink: 0, marginLeft: 6 }}>{statusLabel}</span>
                          </div>
                          {termin.location && <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>{termin.location}</div>}
                          {termin.start_datetime && <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>{fmtTime(termin.start_datetime)}{termin.end_datetime ? `–${fmtTime(termin.end_datetime)}` : ''} Uhr</div>}
                          {showsForeignDozent && <div style={{ fontStyle: 'italic', fontSize: 12, color: '#600812' }}>Dozent: {termin.dozent}</div>}
                        </div>
                      </div>
                      {/* Bottom stats strip */}
                      <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'rgba(250,249,247,0.8)', padding: '8px 14px', display: 'flex', gap: 14, fontSize: 12, color: 'var(--warm-gray)', fontWeight: 600, borderRadius: '0 0 12px 12px', flexWrap: 'wrap' }}>
                        <span>{teilnehmerCount}/{termin.max_teilnehmer} TN</span>
                        {dokumenteCount > 0 && <span>{dokumenteCount} Dok.</span>}
                        {moduleCount > 0 && <span>{moduleCount} Mod.</span>}
                        {todos.length > 0 && <span style={{ color: doneTodos === todos.length ? '#16a34a' : 'var(--warm-gray)' }}>{doneTodos}/{todos.length} ToDo</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* TERMIN DETAIL PAGE */}
      {terminDetailPage && (() => {
        const t = terminDetailPage
        const COVER_DS: Record<string, { bg: string; spine: string }> = {
          text: { bg: 'linear-gradient(165deg,#600812 0%,#3d0408 100%)', spine: 'rgba(0,0,0,0.3)' },
          bild: { bg: 'linear-gradient(165deg,#7c2d12 0%,#431407 100%)', spine: 'rgba(0,0,0,0.3)' },
          video: { bg: 'linear-gradient(165deg,#065f46 0%,#022c22 100%)', spine: 'rgba(0,0,0,0.3)' },
          quiz: { bg: 'linear-gradient(165deg,#1e3a8a 0%,#0f172a 100%)', spine: 'rgba(0,0,0,0.3)' },
        }
        const dozentDateien: string[] = (() => { const d = t.dateien; return Array.isArray(d) ? d : (d ? [d as string] : []) })()
        const tnDateien: string[] = (() => { const d = t.anhang; return Array.isArray(d) ? d : (d ? [d as string] : []) })()
        const forThisTermin = terminTeilnehmer.filter(tt => tt.termin_id === t.id)
        // Personen, die nur per Einladungslink reagiert haben (kein Unitas-Eintrag) → zusätzlich in Anwesenheit berücksichtigen
        const ttNamesLower = new Set(forThisTermin.map(tt => getTeilnehmerName(tt.teilnehmer_id).trim().toLowerCase()))
        const linkOnlyEinladungen = einladungen.filter(e => e.termin_id === t.id && !ttNamesLower.has((e.name || '').trim().toLowerCase()))
        const anwesendCount = forThisTermin.filter(tt => tt.anwesend).length + linkOnlyEinladungen.filter(e => getEinladungAnwesenheitStatus(e) === 'da').length
        const zugesagtCount = forThisTermin.filter(tt => getEffektivStatus(tt) === 'zugesagt').length + linkOnlyEinladungen.filter(e => e.status === 'zusagen').length
        const isHauptdozent = t.dozent_id === user?.id || (!t.dozent_id && t.dozent?.trim().toLowerCase() === (user?.name || '').trim().toLowerCase())
        const isAnyCoDozent = coDozenten.some(cd => cd.user_id === user?.id)
        const isDozent = isHauptdozent || isAnyCoDozent
        const dozentTeam = [
          ...(t.dozent ? [{ user_id: t.dozent_id || '', name: t.dozent, isHaupt: true }] : []),
          ...coDozenten.map(cd => ({ ...cd, isHaupt: false }))
        ]
        const availableUsersForCoDozent = allUsers.filter(u =>
          u.id !== t.dozent_id && !coDozenten.some(cd => cd.user_id === u.id)
        )

        const dDetail = parseDate(t.start_datetime)
        const detailWeekday = isNaN(dDetail.getTime()) ? '' : dDetail.toLocaleDateString('de-DE', { weekday: 'short' }).toUpperCase()
        const detailDayNum = isNaN(dDetail.getTime()) ? '–' : dDetail.getDate()
        const detailMonth = isNaN(dDetail.getTime()) ? '' : dDetail.toLocaleDateString('de-DE', { month: 'short' }).toUpperCase()
        const detailStatusColor = terminStatusColor(t.status)
        const detailStatusBg = terminStatusBg(t.status)
        const detailStatusLabel = t.status === 'geplant' ? 'Geplant' : t.status === 'laufend' ? 'Laufend' : t.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Abgesagt'
        const detailCircleColor = t.status === 'abgesagt' ? '#8a7a68' : detailStatusColor

        const TABS = [
          { key: 'info', label: 'Info', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> },
          { key: 'anwesenheit', label: 'Anwesenheit', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg> },
          { key: 'dateien', label: 'Dateien', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> },
          { key: 'dozenten', label: 'Dozenten', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
        ] as const

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 350, background: 'var(--warm-bg)', display: 'flex', flexDirection: 'column', overscrollBehavior: 'none' }}>
            {/* Header */}
            <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(96,8,18,0.12)', paddingTop: 'calc(env(safe-area-inset-top) + 8px)', paddingBottom: 14, paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                <button onClick={() => setTerminDetailPage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', color: '#600812', marginLeft: -2, flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 99, background: detailStatusBg, color: detailStatusColor, fontWeight: 700, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {t.status === 'laufend' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: detailStatusColor, animation: 'pulseDot 1.4s ease-in-out infinite' }} />}
                  {detailStatusLabel}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--warm-gray)' }}>{detailWeekday}</div>
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: detailCircleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', fontWeight: 800, fontSize: 19, color: '#fde8d8' }}>{detailDayNum}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--warm-gray)' }}>{detailMonth}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 18, color: 'var(--lbf-text)', lineHeight: 1.25 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 3 }}>
                    {t.start_datetime ? `${fmtTime(t.start_datetime)}${t.end_datetime ? `–${fmtTime(t.end_datetime)} Uhr` : ' Uhr'}` : ''}
                    {t.location ? ` · ${t.location}` : ''}
                  </div>
                  {t.dozent && <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 1 }}>{t.dozent}</div>}
                </div>
              </div>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px max(16px,env(safe-area-inset-left)) 20px' }}>

              {/* ── TAB: INFO ── */}
              {terminDetailTab === 'info' && (
                <div>
                  {/* Teilnehmer & Einladung */}
                  {(() => {
                    const einladungsText = generateEinladungsText(t)
                    const terminEinladungen = einladungen.filter(e => e.termin_id === t.id)
                    const unitasRSVPs = terminTeilnehmer.filter(tt => tt.termin_id === t.id)
                    // Rückmeldungen aus Link + Unitas zu einer Liste zusammenführen, dedupliziert pro Name
                    const rsvpMap = new Map<string, { display: string, status: 'zugesagt' | 'abgesagt' | 'ausstehend' }>()
                    function upsertRSVP(rawName: string, status: 'zugesagt' | 'abgesagt' | 'ausstehend') {
                      const display = (rawName || '').trim()
                      if (!display || display === 'Unbekannt') return
                      const key = display.toLowerCase()
                      const existing = rsvpMap.get(key)
                      if (status === 'ausstehend') {
                        if (!existing) rsvpMap.set(key, { display, status })
                      } else {
                        rsvpMap.set(key, { display, status })
                      }
                    }
                    terminEinladungen.forEach(e => upsertRSVP(e.name, e.status === 'zusagen' ? 'zugesagt' : 'abgesagt'))
                    unitasRSVPs.forEach(tt => {
                      const name = getTeilnehmerName(tt.teilnehmer_id)
                      const status = tt.status === 'zugesagt' ? 'zugesagt'
                        : (tt.status === 'abgesagt' || tt.status === 'entschuldigt') ? 'abgesagt'
                        : 'ausstehend'
                      upsertRSVP(name, status)
                    })
                    const alleRueckmeldungen = [...rsvpMap.values()]
                    const zusagen = alleRueckmeldungen.filter(r => r.status === 'zugesagt').map(r => r.display)
                    const absagen = alleRueckmeldungen.filter(r => r.status === 'abgesagt').map(r => r.display)
                    const ausstehend = alleRueckmeldungen.filter(r => r.status === 'ausstehend').map(r => r.display)
                    const rueckmeldungenGesamt = zusagen.length + absagen.length + ausstehend.length
                    return (
                      <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '3px solid #600812' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Teilnehmer &amp; Einladung</div>
                        <div style={{ fontSize: 14, color: 'var(--lbf-text)', marginBottom: 14 }}>
                          <span style={{ fontWeight: 700 }}>{getTerminTeilnehmerCount(t.id)}</span> / {t.max_teilnehmer} Teilnehmer
                        </div>

                        {/* Einladungslink */}
                        {t.einladung_token ? (() => {
                          const invUrl = `${window.location.origin}/einladung/${t.einladung_token}`
                          const invText = `${einladungsText}\n\nHier anmelden / absagen: ${invUrl}`
                          return (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Einladungslink</div>
                                <button
                                  onClick={() => { if (confirm('Neuen Link generieren? Der alte Link funktioniert dann nicht mehr.')) generateEinladungsToken(t) }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--warm-gray)', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}
                                >Neu generieren</button>
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--warm-bg)', border: '1px solid rgba(96,8,18,0.12)', borderRadius: 8, padding: '8px 12px' }}>
                                <span style={{ flex: 1, fontSize: 12, color: 'var(--lbf-text)', wordBreak: 'break-all' }}>{invUrl}</span>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(invUrl); showMessage('Link kopiert!', 'success') }}
                                  style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 6, background: '#600812', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                                >Kopieren</button>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                                <a href={`https://wa.me/?text=${encodeURIComponent(invText)}`} target="_blank" rel="noreferrer"
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: '#25d366', color: '#fff', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.85L0 24l6.335-1.508A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.371l-.359-.213-3.721.886.9-3.62-.234-.372A9.818 9.818 0 1 1 12 21.818z"/></svg>
                                  WhatsApp
                                </a>
                                <a href={`mailto:?subject=${encodeURIComponent('Einladung: '+t.name)}&body=${encodeURIComponent(invText)}`}
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: '#600812', color: '#fff', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                  E-Mail
                                </a>
                              </div>
                            </div>
                          )
                        })() : (
                          <button
                            onClick={() => generateEinladungsToken(t)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#600812', border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: rueckmeldungenGesamt > 0 ? 14 : 0 }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            Einladungslink erstellen
                          </button>
                        )}

                        {/* Rückmeldungen — kombiniert aus Einladungslink + Unitas */}
                        {rueckmeldungenGesamt > 0 && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Rückmeldungen</div>
                              <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>{rueckmeldungenGesamt} gesamt</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {zusagen.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Zugesagt ({zusagen.length})</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {zusagen.map((name, i) => (
                                      <span key={i} style={{ padding: '4px 10px', borderRadius: 20, background: '#dcfce7', color: '#166534', fontSize: 13, fontWeight: 500, fontStyle: 'italic' }}>{name}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {absagen.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Abgesagt ({absagen.length})</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {absagen.map((name, i) => (
                                      <span key={i} style={{ padding: '4px 10px', borderRadius: 20, background: '#fee2e2', color: '#991b1b', fontSize: 13, fontWeight: 500, fontStyle: 'italic' }}>{name}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {ausstehend.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Ausstehend ({ausstehend.length})</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {ausstehend.map((name, i) => (
                                      <span key={i} style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(139,113,90,0.08)', color: 'var(--warm-gray)', fontSize: 13, fontWeight: 500, fontStyle: 'italic' }}>{name}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Termin-Infos */}
                  {t.description && (
                    <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '3px solid rgba(96,8,18,0.15)' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Beschreibung</div>
                      <div style={{ fontSize: 14, color: 'var(--lbf-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{t.description}</div>
                    </div>
                  )}

                  {/* Infos für Teilnehmer */}
                  <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '3px solid #16a34a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Infos für Teilnehmer</div>
                      <button onClick={() => { setEditingTNInfo(!editingTNInfo); setTNInfoText(t.teilnehmer_info || '') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 11, fontWeight: 600, padding: '2px 4px', fontFamily: 'inherit' }}>
                        {editingTNInfo ? 'Abbrechen' : 'Bearbeiten'}
                      </button>
                    </div>
                    {editingTNInfo ? (
                      <>
                        <textarea value={tnInfoText} onChange={e => setTNInfoText(e.target.value)} rows={4}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 14, color: 'var(--lbf-text)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.65, resize: 'vertical', boxSizing: 'border-box' }} />
                        <button onClick={async () => {
                          try { await pb.collection('ausbildungen_termine').update(t.id, { teilnehmer_info: tnInfoText }) } catch {}
                          setTermine(prev => prev.map(x => x.id === t.id ? { ...x, teilnehmer_info: tnInfoText } : x))
                          setTerminDetailPage(prev => prev ? { ...prev, teilnehmer_info: tnInfoText } : prev)
                          setEditingTNInfo(false)
                          showMessage('Gespeichert', 'success')
                        }} style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#600812', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Speichern
                        </button>
                      </>
                    ) : (
                      t.teilnehmer_info
                        ? <div style={{ fontSize: 14, color: 'var(--lbf-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{t.teilnehmer_info}</div>
                        : <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch keine Infos für Teilnehmer hinterlegt.</div>
                    )}
                  </div>

                  {/* Lernkonzept / Infos für Dozenten */}
                  <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '3px solid #600812' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Lernkonzept / Dozenten-Info</div>
                      <button onClick={() => { setEditingLernkonzept(!editingLernkonzept); setLernkonzeptText(t.lernkonzept || '') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 11, fontWeight: 600, padding: '2px 4px', fontFamily: 'inherit' }}>
                        {editingLernkonzept ? 'Abbrechen' : 'Bearbeiten'}
                      </button>
                    </div>
                    {editingLernkonzept ? (
                      <>
                        <textarea value={lernkonzeptText} onChange={e => setLernkonzeptText(e.target.value)} rows={5}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 14, color: 'var(--lbf-text)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.65, resize: 'vertical', boxSizing: 'border-box' }} />
                        <button onClick={async () => {
                          try { await pb.collection('ausbildungen_termine').update(t.id, { lernkonzept: lernkonzeptText }) } catch {}
                          setTermine(prev => prev.map(x => x.id === t.id ? { ...x, lernkonzept: lernkonzeptText } : x))
                          setTerminDetailPage(prev => prev ? { ...prev, lernkonzept: lernkonzeptText } : prev)
                          setEditingLernkonzept(false)
                          showMessage('Gespeichert', 'success')
                        }} style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#600812', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Speichern
                        </button>
                      </>
                    ) : (
                      t.lernkonzept
                        ? <div style={{ fontSize: 14, color: 'var(--lbf-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{t.lernkonzept}</div>
                        : <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch kein Konzept hinterlegt.</div>
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB: ANWESENHEIT ── */}
              {terminDetailTab === 'anwesenheit' && (
                <div>
                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                    {[
                      { label: 'Eingeladen', val: forThisTermin.length + linkOnlyEinladungen.length, color: '#600812' },
                      { label: 'Zugesagt', val: zugesagtCount, color: '#d97706' },
                      { label: 'Anwesend', val: anwesendCount, color: '#16a34a' },
                      { label: 'Krank', val: forThisTermin.filter(tt => getAnwesenheitStatus(tt) === 'krank').length + linkOnlyEinladungen.filter(e => getEinladungAnwesenheitStatus(e) === 'krank').length, color: '#d97706' },
                      { label: 'Entschuldigt', val: forThisTermin.filter(tt => getAnwesenheitStatus(tt) === 'entschuldigt').length + linkOnlyEinladungen.filter(e => getEinladungAnwesenheitStatus(e) === 'entschuldigt').length, color: 'var(--warm-gray)' },
                      { label: 'Fehlend', val: forThisTermin.filter(tt => getAnwesenheitStatus(tt) === 'fehlend').length + linkOnlyEinladungen.filter(e => getEinladungAnwesenheitStatus(e) === 'fehlend').length, color: '#dc2626' },
                    ].map(s => (
                      <div key={s.label} style={{ background: '#fff', borderRadius: 10, padding: '12px 10px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontStyle: 'italic', color: 'var(--warm-gray)', fontSize: 11, marginBottom: 14, textAlign: 'center' }}>
                    {einladungen.filter(e => e.termin_id === t.id).length} Rückmeldung(en) über Einladungslink erhalten
                    {linkOnlyEinladungen.length !== einladungen.filter(e => e.termin_id === t.id).length && ` · ${linkOnlyEinladungen.length} ohne Unitas-Konto`}
                  </div>

                  {/* Teilnehmer hinzufügen */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    <select
                      value=""
                      onChange={e => { if (e.target.value) addTeilnehmerToTermin(t.id, e.target.value) }}
                      style={{ flex: 1, minWidth: 180, padding: '9px 10px', borderRadius: 10, border: '0.5px solid rgba(96,8,18,0.15)', background: '#fff', color: 'var(--lbf-text)', fontSize: 13, fontFamily: 'inherit' }}
                    >
                      <option value="">Teilnehmer hinzufügen…</option>
                      {teilnehmer
                        .filter(tn => !forThisTermin.some(tt => tt.teilnehmer_id === tn.id))
                        .map(tn => <option key={tn.id} value={tn.id}>{tn.vorname} {tn.nachname}</option>)}
                    </select>
                    <button onClick={() => addAlleTeilnehmerToTermin(t.id)}
                      style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: '#600812', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      Alle hinzufügen
                    </button>
                  </div>

                  {forThisTermin.length === 0 && linkOnlyEinladungen.length === 0 ? (
                    <div style={{ fontStyle: 'italic', color: 'var(--warm-gray)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Keine Teilnehmer eingetragen.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(() => {
                      const anwOptions: { value: 'da' | 'krank' | 'entschuldigt' | 'fehlend', label: string, color: string, bg: string }[] = [
                        { value: 'da', label: 'Da', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
                        { value: 'krank', label: 'Krank', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
                        { value: 'entschuldigt', label: 'Entschuldigt', color: 'var(--warm-gray)', bg: 'rgba(139,113,90,0.1)' },
                        { value: 'fehlend', label: 'Fehlend', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
                      ]
                      return (<>
                      {forThisTermin.map(tt => {
                        const name = getTeilnehmerName(tt.teilnehmer_id)
                        const s = getEffektivStatus(tt)
                        const statusColor = s === 'zugesagt' ? '#16a34a' : s === 'abgesagt' ? '#dc2626' : 'var(--warm-gray)'
                        const anw = getAnwesenheitStatus(tt)
                        return (
                          <div key={tt.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(96,8,18,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#600812', fontStyle: 'italic' }}>{name.charAt(0)}</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 14, color: 'var(--lbf-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                <div style={{ fontSize: 10, color: statusColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{s}</div>
                              </div>
                              {/* RSVP toggle */}
                              <button onClick={() => toggleRSVP(tt.id, tt.status)}
                                style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${s === 'zugesagt' ? '#16a34a' : 'rgba(96,8,18,0.15)'}`, background: s === 'zugesagt' ? 'rgba(22,163,74,0.08)' : '#fff', color: s === 'zugesagt' ? '#16a34a' : 'var(--warm-gray)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                                {s === 'zugesagt' ? 'Zugesagt' : 'Zusagen'}
                              </button>
                              <button onClick={() => removeTeilnehmerFromTermin(tt.id)} title="Vom Termin entfernen"
                                style={{ background: 'none', border: 'none', color: 'var(--warm-gray)', cursor: 'pointer', padding: 4, flexShrink: 0, lineHeight: 0 }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                            {/* Anwesenheits-Status */}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {anwOptions.map(opt => (
                                <button key={opt.value} onClick={() => setAnwesenheitStatus(tt.id, anw, opt.value)}
                                  style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${anw === opt.value ? opt.color : 'rgba(96,8,18,0.15)'}`, background: anw === opt.value ? opt.bg : '#fff', color: anw === opt.value ? opt.color : 'var(--warm-gray)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      {linkOnlyEinladungen.map(e => {
                        const s = e.status
                        const statusColor = s === 'zusagen' ? '#16a34a' : s === 'absagen' ? '#dc2626' : 'var(--warm-gray)'
                        const statusLabel = s === 'zusagen' ? 'zugesagt' : s === 'absagen' ? 'abgesagt' : s
                        const anw = getEinladungAnwesenheitStatus(e)
                        return (
                          <div key={e.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(96,8,18,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#600812', fontStyle: 'italic' }}>{(e.name || '?').charAt(0)}</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 14, color: 'var(--lbf-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                                <div style={{ fontSize: 10, color: statusColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{statusLabel} · per Einladungslink</div>
                              </div>
                              <button onClick={() => removeEinladung(e.id)} title="Rückmeldung entfernen"
                                style={{ background: 'none', border: 'none', color: 'var(--warm-gray)', cursor: 'pointer', padding: 4, flexShrink: 0, lineHeight: 0 }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                            {/* Anwesenheits-Status */}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {anwOptions.map(opt => (
                                <button key={opt.value} onClick={() => setEinladungAnwesenheitStatus(e.id, anw, opt.value)}
                                  style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${anw === opt.value ? opt.color : 'rgba(96,8,18,0.15)'}`, background: anw === opt.value ? opt.bg : '#fff', color: anw === opt.value ? opt.color : 'var(--warm-gray)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      </>)
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: DATEIEN ── */}
              {terminDetailTab === 'dateien' && (
                <div>
                  {/* Für Teilnehmer */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#8a7a68', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Für Teilnehmer</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                      {tnDateien.map((file, i) => {
                        const ext = file.split('.').pop()?.toLowerCase() ?? ''
                        const url = `https://api.responda.systems/api/files/${t.collectionId}/${t.id}/${file}`
                        return (
                          <FileCard key={`tn-${i}`} name={getFileDisplayName(file, anhangNames)} ext={ext} url={url} accent="#8a7a68"
                            onSchreibstube={EDITABLE_EXTS.includes(ext) ? () => navigate(`/office?open=${t.id}&collection=ausbildungen_termine&field=anhang&index=${i}`) : undefined}
                            onVollbild={ext === 'pdf' ? () => setPdfViewerUrl(url) : undefined}
                            onRemove={() => removeTNFile(file)}
                            onRename={newName => renameTNFile(file, newName)}
                          />
                        )
                      })}
                      {anhangLinks.map(link => {
                        const ext = link.name.split('.').pop()?.toLowerCase() ?? ''
                        const url = `${pb.baseUrl}/api/files/files/${link.id}/${link.file}?token=${pb.authStore.token}`
                        return (
                          <FileCard key={link.id} name={link.name} ext={ext} url={url} accent="#8a7a68"
                            onSchreibstube={EDITABLE_EXTS.includes(ext) ? () => navigate(`/office?open=${link.id}`) : undefined}
                            onVollbild={ext === 'pdf' ? () => setPdfViewerUrl(url) : undefined}
                            onRemove={() => unlinkTNFile(link.id)}
                            onRename={newName => renameTNLink(link.id, newName)}
                          />
                        )
                      })}
                      <AddFileCard accent="#8a7a68" accentRgb="138,122,104" uploading={uploadingTNFile}
                        onUpload={uploadTNFile} onLibrary={() => { setShowFilePicker('tn'); loadFilePicker() }} />
                    </div>
                  </div>

                  {/* Für Dozenten */}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Für Dozenten</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                      {dozentDateien.map((file, i) => {
                        const ext = file.split('.').pop()?.toLowerCase() ?? ''
                        const url = `https://api.responda.systems/api/files/${t.collectionId}/${t.id}/${file}`
                        return (
                          <FileCard key={`dz-${i}`} name={getFileDisplayName(file, dateienNames)} ext={ext} url={url} accent="#600812"
                            onSchreibstube={EDITABLE_EXTS.includes(ext) ? () => navigate(`/office?open=${t.id}&collection=ausbildungen_termine&field=dateien&index=${i}`) : undefined}
                            onVollbild={ext === 'pdf' ? () => setPdfViewerUrl(url) : undefined}
                            onRemove={() => removeDozentFile(file)}
                            onRename={newName => renameDozentFile(file, newName)}
                          />
                        )
                      })}
                      {dateienLinks.map(link => {
                        const ext = link.name.split('.').pop()?.toLowerCase() ?? ''
                        const url = `${pb.baseUrl}/api/files/files/${link.id}/${link.file}?token=${pb.authStore.token}`
                        return (
                          <FileCard key={link.id} name={link.name} ext={ext} url={url} accent="#600812"
                            onSchreibstube={EDITABLE_EXTS.includes(ext) ? () => navigate(`/office?open=${link.id}`) : undefined}
                            onVollbild={ext === 'pdf' ? () => setPdfViewerUrl(url) : undefined}
                            onRemove={() => unlinkDozentFile(link.id)}
                            onRename={newName => renameDozentLink(link.id, newName)}
                          />
                        )
                      })}
                      <AddFileCard accent="#600812" accentRgb="96,8,18" uploading={uploadingDozentFile}
                        accept=".pdf,.ppt,.pptx,.doc,.docx,.key,.pages"
                        onUpload={uploadDozentFile} onLibrary={() => { setShowFilePicker('dozent'); loadFilePicker() }} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB: DOZENTEN ── */}
              {terminDetailTab === 'dozenten' && (
                <div>
                  {/* Dozenten-Team */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Dozenten-Team</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      {dozentTeam.map((d, i) => (
                        <div key={d.user_id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 10, padding: '11px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: `3px solid ${d.isHaupt ? '#600812' : 'rgba(96,8,18,0.2)'}` }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: d.isHaupt ? 'rgba(96,8,18,0.1)' : 'rgba(139,113,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: d.isHaupt ? '#600812' : 'var(--warm-gray)', fontStyle: 'italic' }}>{d.name?.charAt(0) || '?'}</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 14, color: 'var(--lbf-text)' }}>{d.name}</div>
                            <div style={{ fontSize: 10, color: d.isHaupt ? '#600812' : 'var(--warm-gray)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d.isHaupt ? 'Hauptdozent' : 'Co-Dozent'}</div>
                          </div>
                          {!d.isHaupt && (
                            <button onClick={() => removeCoDozent(d.user_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Invite Co-Dozent */}
                    {availableUsersForCoDozent.length > 0 && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select defaultValue="" onChange={e => { if (e.target.value) { const u = allUsers.find(x => x.id === e.target.value); if (u) addCoDozent(u.id, u.name); e.target.value = '' } }}
                          style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: '#fff', fontSize: 13, color: 'var(--lbf-text)', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                          <option value="">+ Co-Dozent einladen …</option>
                          {availableUsersForCoDozent.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Aufgaben aufteilen */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Aufgaben aufteilen</div>
                    {dozentAufgaben.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                        {dozentAufgaben.map(a => (
                          <div key={a.id} style={{ background: '#fff', borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <button onClick={() => toggleDozentAufgabe(a.id)} style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${a.done ? '#16a34a' : 'rgba(96,8,18,0.25)'}`, background: a.done ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, marginTop: 2 }}>
                              {a.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, color: a.done ? 'var(--warm-gray)' : 'var(--lbf-text)', textDecoration: a.done ? 'line-through' : 'none', lineHeight: 1.4 }}>{a.text}</div>
                              {a.assignee_name && (
                                <div style={{ fontSize: 10, color: '#600812', fontWeight: 700, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                  {a.assignee_name}
                                </div>
                              )}
                            </div>
                            <button onClick={() => deleteDozentAufgabe(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 2, flexShrink: 0 }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input value={newAufgabeText} onChange={e => setNewAufgabeText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDozentAufgabe() } }}
                        placeholder="Neue Aufgabe beschreiben …"
                        style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: '#fff', fontSize: 14, color: 'var(--lbf-text)', outline: 'none', fontFamily: 'inherit' }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select value={newAufgabeAssignee} onChange={e => setNewAufgabeAssignee(e.target.value)}
                          style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: '#fff', fontSize: 13, color: 'var(--lbf-text)', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                          <option value="">Zuständig: Kein</option>
                          {dozentTeam.map((d, i) => <option key={d.user_id || i} value={d.user_id}>{d.name}</option>)}
                        </select>
                        <button onClick={addDozentAufgabe} disabled={!newAufgabeText.trim()}
                          style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: newAufgabeText.trim() ? '#600812' : 'rgba(96,8,18,0.1)', color: newAufgabeText.trim() ? '#fff' : 'var(--warm-gray)', fontWeight: 700, fontSize: 13, cursor: newAufgabeText.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Persönliche Checkliste */}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Meine Checkliste</div>
                    {dozentTodos.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                        {dozentTodos.map(td => (
                          <div key={td.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                            <button onClick={() => toggleTodo(td.id)} style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${td.done ? '#16a34a' : 'rgba(96,8,18,0.25)'}`, background: td.done ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                              {td.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                            </button>
                            <span style={{ flex: 1, fontSize: 14, color: td.done ? 'var(--warm-gray)' : 'var(--lbf-text)', textDecoration: td.done ? 'line-through' : 'none' }}>{td.text}</span>
                            <button onClick={() => deleteTodo(td.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 2 }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={newTodoText} onChange={e => setNewTodoText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTodo() } }}
                        placeholder="Persönlicher Punkt …"
                        style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: '#fff', fontSize: 14, color: 'var(--lbf-text)', outline: 'none', fontFamily: 'inherit' }} />
                      <button onClick={addTodo} disabled={!newTodoText.trim()}
                        style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: newTodoText.trim() ? '#600812' : 'rgba(96,8,18,0.1)', color: newTodoText.trim() ? '#fff' : 'var(--warm-gray)', fontWeight: 700, fontSize: 13, cursor: newTodoText.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                        +
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* Bottom tab bar */}
            <div style={{ background: '#fff', borderTop: '0.5px solid rgba(96,8,18,0.12)', display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)', flexShrink: 0 }}>
              {TABS.map(tab => {
                const active = terminDetailTab === tab.key
                return (
                  <button key={tab.key} onClick={() => setTerminDetailTab(tab.key as any)}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 4px 8px', border: 'none', background: 'none', cursor: 'pointer', borderTop: active ? '2px solid #600812' : '2px solid transparent', color: active ? '#600812' : 'var(--warm-gray)', fontFamily: 'inherit' }}>
                    {tab.icon}
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* BEITRAG BUCH-EDITOR */}
      {showBeitragModal && (() => {
        const TOTAL_PAGES = bookPages.length + 1
        const isTagsPage = bookPageIdx === bookPages.length
        const isFirstPage = bookPageIdx === 0
        const canPrev = bookPageIdx > 0
        const canNext = bookPageIdx < TOTAL_PAGES - 1
        const currentPage = isTagsPage ? null : bookPages[bookPageIdx]
        const pageLabel = isTagsPage ? 'Tags' : bookPageIdx === 0 ? 'Titelseite' : `Seite ${bookPageIdx + 1}`

        const goPage = (dir: 1 | -1) => {
          const next = bookPageIdx + dir
          if (next < 0 || next >= TOTAL_PAGES) return
          setBookDir(dir); setBookPageIdx(next); setShowBlockPicker(false)
        }

        const addBlock = (type: EditorBlock['type']) => {
          setShowBlockPicker(false)
          const newBlock: EditorBlock = { id: Math.random().toString(36).slice(2,9), type, text: '', imageFile: null, imagePreview: null, videoUrl: '', quizFrage: '', quizAntworten: ['', '', '', ''], quizRichtige: 0 }
          setBookPages(prev => {
            const pages = [...prev]
            const idx = Math.min(bookPageIdx, pages.length - 1)
            if (idx < 0) return [{ id: Math.random().toString(36).slice(2,9), blocks: [newBlock] }]
            pages[idx] = { ...pages[idx], blocks: [...pages[idx].blocks, newBlock] }
            return pages
          })
        }

        const removeBlock = (blockId: string) => {
          setBookPages(prev => prev.map(p => ({ ...p, blocks: p.blocks.filter(b => b.id !== blockId) })))
        }

        const updateBlock = (blockId: string, updates: Partial<EditorBlock>) => {
          setBookPages(prev => prev.map(p => ({ ...p, blocks: p.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b) })))
        }

        const addPage = () => {
          const newPage: EditorPage = { id: Math.random().toString(36).slice(2,9), blocks: [] }
          setBookPages(prev => { const pages = [...prev]; pages.splice(bookPageIdx + 1, 0, newPage); return pages })
          setBookDir(1); setBookPageIdx(bookPageIdx + 1)
        }

        const removePage = (idx: number) => {
          if (bookPages.length <= 1) return
          setBookPages(prev => prev.filter((_, i) => i !== idx))
          setBookPageIdx(prev => Math.max(0, Math.min(prev, bookPages.length - 2)))
        }

        const renderBlock = (block: EditorBlock) => {
          const isGenThis = generatingAIImage && aiImageTargetBlock === block.id
          return (
            <div key={block.id} style={{ marginBottom: 14, position: 'relative' }}>
              <button onClick={() => removeBlock(block.id)}
                style={{ position: 'absolute', top: 0, right: 0, zIndex: 5, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(96,8,18,0.08)', color: '#8a7a68', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, lineHeight: 1 }}>×</button>

              {block.type === 'text' && (
                <TextBlockEditor key={block.id} initialText={block.text} onUpdate={html => updateBlock(block.id, { text: html })} />
              )}

              {block.type === 'bild' && <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#7c2d12', textTransform: 'uppercase' as const, letterSpacing: '0.18em' }}>Bild</div>
                  {block.imagePreview && (
                    <button onClick={() => setBeitragForm(prev => ({ ...prev, coverBlockId: prev.coverBlockId === block.id ? null : block.id }))}
                      style={{ marginLeft: 'auto', marginRight: 26, display: 'flex', alignItems: 'center', gap: 4, background: beitragForm.coverBlockId === block.id ? beitragForm.color : 'rgba(96,8,18,0.06)', border: 'none', borderRadius: 99, padding: '3px 9px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill={beitragForm.coverBlockId === block.id ? '#fff' : '#600812'} stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      <span style={{ fontSize: 10, fontWeight: 700, color: beitragForm.coverBlockId === block.id ? '#fff' : '#600812' }}>Titelbild</span>
                    </button>
                  )}
                </div>
                {block.imagePreview ? (
                  <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', marginRight: 26 }}>
                    <img src={block.imagePreview} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
                    <button type="button" onClick={() => updateBlock(block.id, { imageFile: null, imagePreview: null })}
                      style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, zIndex: 3 }}>×</button>
                  </div>
                ) : (
                  <div style={{ marginRight: 26 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 72, border: '1.5px dashed rgba(96,8,18,0.18)', borderRadius: 8, cursor: 'pointer', gap: 5, background: 'rgba(96,8,18,0.02)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(96,8,18,0.3)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <span style={{ fontSize: 11, color: '#8a7a68', fontStyle: 'italic' }}>Bild hochladen</span>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) updateBlock(block.id, { imageFile: f, imagePreview: URL.createObjectURL(f) }) }} />
                    </label>
                    <button type="button" onClick={() => generateAIImage(block.id)} disabled={isGenThis || !beitragForm.titel.trim()}
                      style={{ width: '100%', marginTop: 5, padding: '6px', borderRadius: 7, border: '1.5px solid rgba(96,8,18,0.18)', background: 'rgba(96,8,18,0.03)', color: '#600812', fontSize: 11, fontWeight: 600, cursor: isGenThis || !beitragForm.titel.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: !beitragForm.titel.trim() ? 0.5 : 1 }}>
                      {isGenThis ? '✦ Generiere…' : '✦ KI-Bild'}
                    </button>
                  </div>
                )}
              </div>}

              {block.type === 'video' && <div style={{ marginRight: 26 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#065f46', textTransform: 'uppercase' as const, letterSpacing: '0.18em', marginBottom: 6 }}>Video</div>
                <input value={block.videoUrl} onChange={e => updateBlock(block.id, { videoUrl: e.target.value })} placeholder="YouTube-URL…"
                  style={{ width: '100%', border: 'none', borderBottom: '1px solid rgba(96,8,18,0.15)', outline: 'none', background: 'transparent', fontSize: 14, color: '#1a0e08', fontFamily: 'inherit', padding: '3px 0', marginBottom: 8, boxSizing: 'border-box' as const }} />
                {block.videoUrl.trim() && (
                  <div style={{ position: 'relative', paddingBottom: '50%', background: '#000', borderRadius: 6, overflow: 'hidden' }}>
                    <iframe src={(() => { const yt = block.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/); return yt ? `https://www.youtube.com/embed/${yt[1]}?rel=0` : block.videoUrl })()} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen />
                  </div>
                )}
              </div>}

              {block.type === 'quiz' && <div style={{ marginRight: 26 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' as const, letterSpacing: '0.18em', marginBottom: 6 }}>Quiz</div>
                <textarea value={block.quizFrage} onChange={e => updateBlock(block.id, { quizFrage: e.target.value })} placeholder="Frage…" rows={2}
                  style={{ width: '100%', resize: 'none', border: 'none', borderBottom: '0.5px solid rgba(96,8,18,0.12)', outline: 'none', background: 'transparent', fontSize: 15, fontWeight: 600, color: '#1a0e08', lineHeight: 1.4, fontFamily: 'inherit', padding: '0 0 5px', boxSizing: 'border-box' as const, marginBottom: 8 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {block.quizAntworten.map((a, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <button onClick={() => updateBlock(block.id, { quizRichtige: idx })}
                        style={{ width: 17, height: 17, borderRadius: '50%', border: `2px solid ${block.quizRichtige === idx ? '#16a34a' : 'rgba(96,8,18,0.2)'}`, background: block.quizRichtige === idx ? '#16a34a' : 'transparent', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {block.quizRichtige === idx && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                      </button>
                      <input value={a} onChange={e => { const arr = [...block.quizAntworten] as [string,string,string,string]; arr[idx] = e.target.value; updateBlock(block.id, { quizAntworten: arr }) }} placeholder={`Antwort ${idx + 1}…`}
                        style={{ flex: 1, border: 'none', borderBottom: '0.5px solid rgba(96,8,18,0.08)', outline: 'none', background: 'transparent', fontSize: 13, color: '#1a0e08', fontFamily: 'inherit', padding: '3px 0' }} />
                    </div>
                  ))}
                </div>
              </div>}
            </div>
          )
        }

        const renderPageContent = () => {
          if (isTagsPage) return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 20px 12px 26px', overflowY: 'auto' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.2em', marginBottom: 10 }}>
                Tags <span style={{ fontWeight: 400, color: '#8a7a68', textTransform: 'none' as const, letterSpacing: 0, fontSize: 10 }}>(kommagetrennt)</span>
              </div>
              <input value={beitragForm.tags} onChange={e => setBeitragForm(prev => ({ ...prev, tags: e.target.value }))} placeholder="Reanimation, XABCDE, Beatmung…"
                style={{ border: 'none', borderBottom: '1px solid rgba(96,8,18,0.15)', outline: 'none', background: 'transparent', fontSize: 14, color: '#1a0e08', fontFamily: 'inherit', padding: '4px 0', width: '100%', marginBottom: 14 }} />
              {beitragForm.tags.split(',').map(t => t.trim()).filter(Boolean).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {beitragForm.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                    <span key={t} style={{ fontSize: 12, fontStyle: 'italic', fontWeight: 700, color: '#600812', background: 'rgba(96,8,18,0.07)', borderRadius: 99, padding: '3px 10px' }}>#{t}</span>
                  ))}
                </div>
              )}
              {/* File attachments */}
              <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.1)', paddingTop: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.2em', marginBottom: 10 }}>
                  Dateien <span style={{ fontWeight: 400, color: '#8a7a68', textTransform: 'none' as const, letterSpacing: 0, fontSize: 10 }}>(PDF, Dokumente)</span>
                </div>
                {/* Existing files when editing */}
                {editingBeitragId && (() => { const rawD = beitraege.find(b => b.id === editingBeitragId)?.dateien; const existing: string[] = Array.isArray(rawD) ? rawD : (rawD ? [rawD as string] : []); return existing.length > 0 ? (
                  <div style={{ marginBottom: 8 }}>
                    {existing.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 12, color: '#8a7a68' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{f}</span>
                        <span style={{ flexShrink: 0, fontSize: 10, color: 'rgba(139,113,90,0.6)' }}>vorhanden</span>
                      </div>
                    ))}
                  </div>
                ) : null })()}
                {/* Newly added files */}
                {pdfFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{ flex: 1, fontSize: 13, color: '#1a0e08', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{f.name}</span>
                    <button onClick={() => setPdfFiles(prev => prev.filter((_, j) => j !== i))}
                      style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#8a7a68', padding: 2, display: 'flex', alignItems: 'center' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 0', marginTop: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#600812', fontFamily: 'inherit' }}>Datei hinzufügen</span>
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg" multiple style={{ display: 'none' }}
                    onChange={e => { const files = Array.from(e.target.files || []); if (files.length) setPdfFiles(prev => [...prev, ...files]); e.target.value = '' }} />
                </label>
              </div>
            </div>
          )
          return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {isFirstPage && (
                <div style={{ padding: '10px 20px 0 26px', flexShrink: 0 }}>
                  <textarea autoFocus value={beitragForm.titel} onChange={e => setBeitragForm(prev => ({ ...prev, titel: e.target.value }))} placeholder="Titel des Beitrags…" rows={2}
                    style={{ width: '100%', resize: 'none', border: 'none', borderBottom: '0.5px solid rgba(96,8,18,0.12)', outline: 'none', background: 'transparent', fontStyle: 'italic', fontWeight: 700, fontSize: 19, color: '#1a0e08', lineHeight: 1.3, fontFamily: "'Atkinson Hyperlegible', Inter, sans-serif", padding: '0 0 8px', boxSizing: 'border-box' as const }} />
                  <div style={{ paddingBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button onClick={() => setBeitragForm(prev => ({ ...prev, gepinnt: !prev.gepinnt }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                      <div style={{ width: 15, height: 15, borderRadius: 3, border: `1.5px solid ${beitragForm.gepinnt ? beitragForm.color : 'rgba(96,8,18,0.2)'}`, background: beitragForm.gepinnt ? beitragForm.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {beitragForm.gepinnt && <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/></svg>}
                      </div>
                      <span style={{ fontSize: 11, color: beitragForm.gepinnt ? '#1a0e08' : '#8a7a68' }}>{beitragForm.gepinnt ? 'Angepinnt' : 'Anpinnen'}</span>
                    </button>
                  </div>
                  {/* Farbauswahl */}
                  <div style={{ display: 'flex', gap: 7, paddingBottom: 8, flexWrap: 'wrap' as const }}>
                    {[['#600812','#3d0408'],['#1a0e08','#0a0503'],['#1e3a8a','#0f1e4a'],['#065f46','#033422'],['#7c2d12','#4a1a0a'],['#4a044e','#280229'],['#134e4a','#082b28'],['#713f12','#3d2209']].map(([c]) => (
                      <button key={c} onClick={() => setBeitragForm(prev => ({ ...prev, color: c }))}
                        style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', background: c, cursor: 'pointer', flexShrink: 0, boxShadow: beitragForm.color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : '0 1px 3px rgba(0,0,0,0.2)' }} />
                    ))}
                  </div>
                  {/* Musterauswahl */}
                  <div style={{ display: 'flex', gap: 6, paddingBottom: 4, flexWrap: 'wrap' as const }}>
                    {([null, 'diamante', 'venezia', 'marmo', 'trama', 'fiorentino', 'capitone'] as const).map(p => {
                      const pat = getPatternBg(p)
                      const sel = beitragForm.pattern === p
                      return (
                        <button key={String(p)} onClick={() => setBeitragForm(prev => ({ ...prev, pattern: p }))}
                          title={p || 'Kein Muster'}
                          style={{ width: 22, height: 28, borderRadius: 3, border: 'none', background: beitragForm.color, cursor: 'pointer', flexShrink: 0, position: 'relative' as const, overflow: 'hidden', boxShadow: sel ? `0 0 0 2px #fff, 0 0 0 4px ${beitragForm.color}` : '0 1px 3px rgba(0,0,0,0.2)' }}>
                          {pat && <div style={{ position: 'absolute' as const, inset: 0, backgroundImage: pat.backgroundImage, backgroundSize: pat.backgroundSize || 'auto', pointerEvents: 'none' }} />}
                          {!p && <div style={{ position: 'absolute' as const, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: 700 }}>—</span></div>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 4px 26px' }}>
                {currentPage && currentPage.blocks.map(block => renderBlock(block))}
                {!showBlockPicker ? (
                  <button onClick={() => setShowBlockPicker(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 10px', color: '#8a7a68', fontFamily: 'inherit', fontSize: 12 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    Block hinzufügen
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 5, paddingBottom: 10, flexWrap: 'wrap' as const }}>
                    {(['text', 'bild', 'video', 'quiz'] as const).map(t => (
                      <button key={t} onClick={() => addBlock(t)}
                        style={{ padding: '5px 11px', borderRadius: 20, border: '1.5px solid rgba(96,8,18,0.18)', background: 'rgba(96,8,18,0.04)', color: '#600812', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                        {t === 'bild' ? 'Bild' : t === 'quiz' ? 'Quiz' : t === 'video' ? 'Video' : 'Text'}
                      </button>
                    ))}
                    <button onClick={() => setShowBlockPicker(false)}
                      style={{ padding: '5px 11px', borderRadius: 20, border: '1.5px solid rgba(96,8,18,0.1)', background: 'transparent', color: '#8a7a68', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                  </div>
                )}
              </div>
            </div>
          )
        }

        return (
          <>
            <div onClick={resetBeitragForm} style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,6,0.8)', zIndex: 500 }} />
            <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(calc(100vw - 32px), 420px)', height: 'min(88dvh, 620px)', zIndex: 501, background: '#fffef9', borderRadius: 3, boxShadow: '0 30px 90px rgba(0,0,0,0.5), -6px 0 18px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'bookOpen 0.32s cubic-bezier(0.22,1,0.36,1)' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 9, zIndex: 10, pointerEvents: 'none', background: `linear-gradient(to right, ${beitragForm.color}, ${beitragForm.color}88 60%, transparent)` }} />
              {beitragForm.pattern && (() => { const pp = getPatternBg(beitragForm.pattern); return pp ? <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 9, zIndex: 11, pointerEvents: 'none', backgroundImage: pp.backgroundImage, backgroundSize: pp.backgroundSize || 'auto' }} /> : null })()}
              <div style={{ position: 'absolute', left: 9, top: 0, bottom: 0, width: 22, zIndex: 10, pointerEvents: 'none', background: 'linear-gradient(to right, rgba(0,0,0,0.09), transparent)' }} />
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 12, zIndex: 10, pointerEvents: 'none', background: 'linear-gradient(to left, rgba(0,0,0,0.06), transparent)' }} />
              <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 20 }}>
                <button onClick={resetBeitragForm} style={{ background: 'rgba(96,8,18,0.07)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#8a7a68' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div style={{ paddingLeft: 26, paddingRight: 40, paddingTop: 12, paddingBottom: 4, flexShrink: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 9, color: '#8a7a68', fontStyle: 'italic' }}>{pageLabel}</div>
                {!isFirstPage && !isTagsPage && bookPages.length > 1 && (
                  <button onClick={() => removePage(bookPageIdx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 20px 0 0', color: 'rgba(96,8,18,0.3)', display: 'flex', alignItems: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </button>
                )}
              </div>
              <div key={`ep-${bookPageIdx}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: `pageIn${bookDir >= 0 ? 'R' : 'L'} 0.2s ease-out` }}>
                {renderPageContent()}
              </div>
              <div style={{ flexShrink: 0, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', borderTop: '0.5px solid rgba(96,8,18,0.08)', background: '#fffef9', zIndex: 5 }}>
                <button onClick={() => goPage(-1)} disabled={!canPrev}
                  style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: canPrev ? 'rgba(96,8,18,0.07)' : 'transparent', color: canPrev ? '#600812' : 'rgba(96,8,18,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canPrev ? 'pointer' : 'default' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
                    <div key={i} onClick={() => { setBookDir(i > bookPageIdx ? 1 : -1); setBookPageIdx(i); setShowBlockPicker(false) }}
                      style={{ width: i === bookPageIdx ? 20 : 6, height: 6, borderRadius: 3, background: i === bookPageIdx ? '#600812' : 'rgba(96,8,18,0.14)', cursor: 'pointer', transition: 'width 0.22s, background 0.22s' }} />
                  ))}
                  {!isTagsPage && (
                    <button onClick={addPage}
                      style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid rgba(96,8,18,0.2)', background: 'transparent', color: '#600812', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: 2 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  )}
                </div>
                {canNext ? (
                  <button onClick={() => goPage(1)}
                    style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(96,8,18,0.07)', color: '#600812', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ) : (
                  <button onClick={saveBeitrag} disabled={savingBeitrag || !beitragForm.titel.trim()}
                    style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: savingBeitrag || !beitragForm.titel.trim() ? 'rgba(96,8,18,0.12)' : '#600812', color: '#fff', fontWeight: 700, fontSize: 13, cursor: savingBeitrag || !beitragForm.titel.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: !beitragForm.titel.trim() ? 0.6 : 1 }}>
                    {savingBeitrag ? 'Speichert…' : editingBeitragId ? 'Speichern' : 'Veröffentlichen'}
                  </button>
                )}
              </div>
            </div>
            <style>{`@keyframes bookOpen{from{opacity:0;transform:translate(-50%,-50%) scale(0.9) perspective(800px) rotateY(-6deg)}to{opacity:1;transform:translate(-50%,-50%) scale(1) perspective(800px) rotateY(0)}}@keyframes pageInR{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:none}}@keyframes pageInL{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:none}}`}</style>
          </>
        )
      })()}

      {/* ADD/EDIT TERMIN MODAL */}
      {showAddTerminModal && (
        <div className="modal show" onClick={() => setShowAddTerminModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{terminForm.id ? 'Termin bearbeiten' : 'Termin hinzufügen'}</h3>
            
            <div className="field">
              <label>Name *</label>
              <input
                type="text"
                value={terminForm.name}
                onChange={(e) => handleTerminNameChange(e.target.value)}
                placeholder="z.B. Sanitätsausbildung Gruppe A"
                autoFocus
              />
              {konzeptSuggestions.length > 0 && (
                <div style={{marginTop: '6px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '8px'}}>
                  <div style={{fontSize: '12px', color: '#0369a1', fontWeight: 600, marginBottom: '6px'}}>
                    💡 Passende Konzepte gefunden:
                  </div>
                  {konzeptSuggestions.map(k => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => { setTerminForm(prev => ({ ...prev, konzept_id: k.id })); setKonzeptSuggestions([]) }}
                      style={{display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', marginBottom: '4px', background: terminForm.konzept_id === k.id ? '#0ea5e9' : 'var(--bg-card)', color: terminForm.konzept_id === k.id ? 'var(--btn-dark-text)' : 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit'}}
                    >
                      {terminForm.konzept_id === k.id ? '✓ ' : ''}{k.name}
                      {k.beschreibung && <span style={{color: terminForm.konzept_id === k.id ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)', marginLeft: '6px'}}>— {k.beschreibung.slice(0, 60)}{k.beschreibung.length > 60 ? '…' : ''}</span>}
                    </button>
                  ))}
                </div>
              )}
              {terminForm.konzept_id && (
                <div style={{marginTop: '6px', fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px'}}>
                  ✓ Konzept verknüpft: <strong>{konzepte.find(k => k.id === terminForm.konzept_id)?.name}</strong>
                  <button type="button" onClick={() => setTerminForm(prev => ({ ...prev, konzept_id: '' }))} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', marginLeft: '4px'}}>✕</button>
                </div>
              )}
            </div>
            
            <div className="field">
              <label>Beschreibung</label>
              <textarea
                value={terminForm.description}
                onChange={(e) => setTerminForm({ ...terminForm, description: e.target.value })}
                rows={3}
                placeholder="Optional"
              />
            </div>
            
            <div className="field">
              <label>Startdatum *</label>
              <input
                type="datetime-local"
                value={terminForm.start_datetime}
                onChange={(e) => setTerminForm({ ...terminForm, start_datetime: e.target.value })}
              />
            </div>
            
            <div className="field">
              <label>Enddatum</label>
              <input
                type="datetime-local"
                value={terminForm.end_datetime}
                onChange={(e) => setTerminForm({ ...terminForm, end_datetime: e.target.value })}
              />
            </div>
            
            <div className="field">
              <label>Ort</label>
              <input
                type="text"
                value={terminForm.location}
                onChange={(e) => setTerminForm({ ...terminForm, location: e.target.value })}
                placeholder="z.B. Schulungsraum 1"
              />
            </div>
            
            <div className="field">
              <label>Dozent</label>
              <select
                value={terminForm.dozent_id || ''}
                onChange={e => {
                  const uid = e.target.value
                  const u = allUsers.find((u: any) => u.id === uid)
                  setTerminForm({ ...terminForm, dozent_id: uid, dozent: u ? u.name : '' })
                }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(96,8,18,0.2)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontFamily: 'inherit', fontSize: 14 }}
              >
                <option value="">— Kein Dozent —</option>
                {allUsers.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              {terminForm.dozent && (
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4, fontStyle: 'italic' }}>{terminForm.dozent}</div>
              )}
            </div>
            
            <div className="field">
              <label>Max. Teilnehmer</label>
              <input
                type="number"
                value={terminForm.max_teilnehmer}
                onChange={(e) => setTerminForm({ ...terminForm, max_teilnehmer: parseInt(e.target.value) })}
                min="1"
              />
            </div>
            
            <div className="field">
              <label>Status</label>
              <select 
                value={terminForm.status}
                onChange={(e) => setTerminForm({ ...terminForm, status: e.target.value as any })}
              >
                <option value="geplant">Geplant</option>
                <option value="laufend">Laufend</option>
                <option value="abgeschlossen">Abgeschlossen</option>
                <option value="abgesagt">Abgesagt</option>
              </select>
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAddTerminModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={saveTermin}>
                {terminForm.id ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEILNEHMER DETAIL MODAL */}
      {showTeilnehmerDetailModal && selectedTeilnehmerDetail && (() => {
        const t = selectedTeilnehmerDetail
        const aktuellesJahrDetail = new Date().getFullYear()
        const alleJahre = [...new Set(
          terminTeilnehmer
            .filter(tt => tt.teilnehmer_id === t.id)
            .map(tt => {
              const termin = termine.find(tr => tr.id === tt.termin_id)
              return termin ? parseDate(termin.start_datetime).getFullYear() : null
            })
            .filter(Boolean) as number[]
        )].sort((a, b) => b - a)
        if (!alleJahre.includes(aktuellesJahrDetail)) alleJahre.unshift(aktuellesJahrDetail)

        const renderJahrBlock = (jahr: number, isArchiv: boolean) => {
          const jahresTermineFiltered = termine
            .filter(tr => parseDate(tr.start_datetime).getFullYear() === jahr)
            .sort((a, b) => parseDate(a.start_datetime).getTime() - parseDate(b.start_datetime).getTime())
          const statusConfig: {[k:string]: {label:string, bg:string, color:string}} = {
            da:           {label: 'Da',           bg: '#dcfce7', color: '#166534'},
            krank:        {label: 'Krank',         bg: '#fef9c3', color: '#92400e'},
            entschuldigt: {label: 'Entschuldigt',  bg: '#dbeafe', color: '#1e40af'},
            fehlend:      {label: 'Fehlend',       bg: '#fee2e2', color: '#991b1b'},
            zugesagt:     {label: 'Zugesagt',      bg: '#d1fae5', color: '#065f46'},
            abgesagt:     {label: 'Abgesagt',      bg: '#fce7f3', color: '#9d174d'},
            eingeladen:   {label: 'Eingeladen',    bg: 'var(--bg-subtle)', color: 'var(--text-secondary)'},
          }

          return (
            <div key={jahr} style={{marginBottom: isArchiv ? '24px' : '0'}}>
              {/* Jahr-Header */}
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '14px'}}>
                <div style={{fontWeight: 700, fontSize: '15px'}}>{jahr}</div>
              </div>

              {/* Termin-Liste */}
              {jahresTermineFiltered.length === 0 ? (
                <div style={{color: 'var(--text-secondary)', fontSize: '13px'}}>Keine Termine in diesem Jahr</div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                  {jahresTermineFiltered.map(termin => {
                    const tt = terminTeilnehmer.find(tt => tt.termin_id === termin.id && tt.teilnehmer_id === t.id)
                    const st = tt?.status as string | undefined
                    const cfg = st ? statusConfig[st] : null
                    return (
                      <div key={termin.id} style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border)'}}>
                        <div style={{fontSize: '12px', color: 'var(--text-secondary)', minWidth: '40px', fontWeight: 600}}>
                          {fmtDayMonth(termin.start_datetime)}
                        </div>
                        <div style={{flex: 1, fontSize: '14px'}}>{termin.name}</div>
                        {cfg ? (
                          <span style={{padding: '3px 10px', borderRadius: '6px', background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '12px'}}>{cfg.label}</span>
                        ) : (
                          <span style={{padding: '3px 10px', borderRadius: '6px', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '12px'}}>–</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        }

        const archivJahre = alleJahre.filter(j => j !== aktuellesJahrDetail)
        const myProgress = modulProgress.filter(p => p.teilnehmer_id === t.id)
        const myDone = myProgress.filter(p => p.abgeschlossen_am)
        const myTerminCount = terminTeilnehmer.filter(tt => tt.teilnehmer_id === t.id).length

        const tabs = [
          { key: 'uebersicht' as const, label: 'Übersicht' },
          { key: 'lernmodule' as const, label: `Lernmodule (${myProgress.length})` },
          { key: 'termine' as const, label: `Termine (${myTerminCount})` },
        ]

        return (
          <div className="modal show" onClick={() => setShowTeilnehmerDetailModal(false)}>
            <div className="modal-content large" onClick={e => e.stopPropagation()} style={{padding: 0, overflow: 'hidden'}}>
              {/* LBF header */}
              <div style={{background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', padding: '20px 24px 16px', position: 'relative', display: 'flex', alignItems: 'center', gap: 14}}>
                <div style={{width: 44, height: 44, borderRadius: '50%', background: 'var(--lbf-border-light)', border: '1.5px solid #600812', display: 'flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', fontWeight: 700, fontSize: 16, color: '#600812', flexShrink: 0}}>
                  {t.vorname[0]}{t.nachname[0]}
                </div>
                <div style={{flex: 1, minWidth: 0, paddingRight: 80}}>
                  {t.ausbildung_typ && <div style={{fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#600812', marginBottom: 4}}>{t.ausbildung_typ}</div>}
                  <div style={{fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)'}}>{t.vorname} {t.nachname}</div>
                  {t.email && <div style={{fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2}}>{t.email}</div>}
                </div>
                <div style={{position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8}}>
                  <button onClick={() => { setShowTeilnehmerDetailModal(false); openEditTeilnehmer(t) }} style={{background: 'rgba(96,8,18,0.06)', border: '0.5px solid rgba(96,8,18,0.15)', borderRadius: 8, padding: '6px 12px', color: '#600812', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit'}}>Bearbeiten</button>
                  <button onClick={() => setShowTeilnehmerDetailModal(false)} style={{background: 'rgba(96,8,18,0.06)', border: '0.5px solid rgba(96,8,18,0.12)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div style={{display: 'flex', borderBottom: '0.5px solid rgba(96,8,18,0.1)', padding: '0 24px', background: 'var(--lbf-card)', overflowX: 'auto'}}>
                {tabs.map(tab => (
                  <button key={tab.key} onClick={() => setSelectedTeilnehmerTab(tab.key)} style={{
                    padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                    color: selectedTeilnehmerTab === tab.key ? '#600812' : 'var(--warm-gray)',
                    borderBottom: selectedTeilnehmerTab === tab.key ? '2px solid #600812' : '2px solid transparent',
                    marginBottom: '-0.5px', whiteSpace: 'nowrap' as const
                  }}>{tab.label}</button>
                ))}
              </div>

              {/* Tab body */}
              <div style={{overflowY: 'auto', maxHeight: '60vh', padding: '20px 28px'}}>

                {/* ÜBERSICHT */}
                {selectedTeilnehmerTab === 'uebersicht' && (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                      {t.email && (
                        <div style={{background: 'var(--bg-subtle)', borderRadius: '8px', padding: '10px 14px'}}>
                          <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px'}}>Email</div>
                          <div style={{fontSize: '13px'}}>{t.email}</div>
                        </div>
                      )}
                      {t.telefon && (
                        <div style={{background: 'var(--bg-subtle)', borderRadius: '8px', padding: '10px 14px'}}>
                          <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px'}}>Telefon</div>
                          <div style={{fontSize: '13px'}}>{t.telefon}</div>
                        </div>
                      )}
                      {t.whatsapp && (
                        <div style={{background: 'var(--bg-subtle)', borderRadius: '8px', padding: '10px 14px'}}>
                          <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px'}}>WhatsApp</div>
                          <div style={{fontSize: '13px'}}>{t.whatsapp}</div>
                        </div>
                      )}
                      <div style={{background: 'var(--bg-subtle)', borderRadius: '8px', padding: '10px 14px'}}>
                        <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px'}}>Lernbar</div>
                        <div style={{fontSize: '13px', color: t.lernbar_zugang_aktiv ? '#059669' : 'var(--text-secondary)', fontWeight: 600}}>{t.lernbar_zugang_aktiv ? 'Aktiv' : 'Inaktiv'}</div>
                      </div>
                    </div>
                    {t.notizen && (
                      <div style={{background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#92400e'}}>
                        {t.notizen}
                      </div>
                    )}
                  </div>
                )}

                {/* LERNMODULE */}
                {selectedTeilnehmerTab === 'lernmodule' && (
                  <div>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px'}}>
                      <div style={{fontSize: '13px', fontWeight: 700, color: 'var(--text)'}}>Fortschritt</div>
                      <div style={{fontSize: '12px', color: 'var(--text-secondary)'}}>{myDone.length}/{myProgress.length} abgeschlossen</div>
                    </div>
                    {myProgress.length > 0 && (
                      <div style={{background: 'var(--border)', borderRadius: '6px', height: '8px', marginBottom: '16px'}}>
                        <div style={{background: 'var(--btn-dark)', borderRadius: '6px', height: '8px', width: `${myProgress.length > 0 ? Math.round((myDone.length/myProgress.length)*100) : 0}%`, transition: 'width 0.3s'}} />
                      </div>
                    )}
                    {myProgress.length === 0 ? (
                      <div style={{color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '24px 0'}}>Noch keinem Modul zugewiesen.</div>
                    ) : (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                        {myProgress.map(p => {
                          const mod = module.find(m => m.id === p.modul_id)
                          const isDone = !!p.abgeschlossen_am
                          return (
                            <div key={p.id} style={{display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: isDone ? '#f0fdf4' : '#f8fafc', border: `1px solid ${isDone ? '#bbf7d0' : '#e2e8f0'}`}}>
                              <div style={{width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: isDone ? '#10b981' : '#cbd5e1'}} />
                              <div style={{flex: 1}}>
                                <div style={{fontSize: '13px', fontWeight: 600}}>{mod?.name || 'Unbekanntes Modul'}</div>
                                {isDone && p.abgeschlossen_am && (
                                  <div style={{fontSize: '11px', color: '#059669', marginTop: '1px'}}>Abgeschlossen am {fmtDate(p.abgeschlossen_am)}</div>
                                )}
                              </div>
                              <span style={{fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: isDone ? '#dcfce7' : '#f1f5f9', color: isDone ? '#065f46' : '#94a3b8'}}>
                                {isDone ? 'Fertig' : 'Offen'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TERMINE */}
                {selectedTeilnehmerTab === 'termine' && (
                  <div>
                    {renderJahrBlock(aktuellesJahrDetail, false)}
                    {archivJahre.length > 0 && (
                      <details style={{marginTop: '24px'}}>
                        <summary style={{cursor: 'pointer', fontWeight: 700, fontSize: '14px', color: 'var(--text-secondary)', padding: '10px 0', borderTop: '1px solid var(--border)', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '6px'}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                          Archiv ({archivJahre.length} {archivJahre.length === 1 ? 'Jahr' : 'Jahre'})
                        </summary>
                        <div style={{marginTop: '16px'}}>
                          {archivJahre.map(j => renderJahrBlock(j, true))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>

              <div style={{padding: '14px 28px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end'}}>
                <button className="btn" onClick={() => setShowTeilnehmerDetailModal(false)}>Schließen</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ADD/EDIT TEILNEHMER MODAL */}
      {showAddTeilnehmerModal && (
        <div className="modal show" onClick={() => setShowAddTeilnehmerModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{teilnehmerForm.id ? 'Teilnehmer bearbeiten' : 'Teilnehmer hinzufügen'}</h3>
            
            <div className="field">
              <label>Vorname *</label>
              <input
                type="text"
                value={teilnehmerForm.vorname}
                onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, vorname: e.target.value })}
                autoFocus
              />
            </div>
            
            <div className="field">
              <label>Nachname *</label>
              <input
                type="text"
                value={teilnehmerForm.nachname}
                onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, nachname: e.target.value })}
              />
            </div>
            
            <div className="field">
              <label>Email {teilnehmerForm.lernbar_zugang_aktiv && '*'}</label>
              <input
                type="email"
                value={teilnehmerForm.email}
                onChange={(e) => {
                  setTeilnehmerForm({ ...teilnehmerForm, email: e.target.value })
                  if (!teilnehmerForm.id) {
                    checkExistingUser(e.target.value)
                  }
                }}
                placeholder={teilnehmerForm.lernbar_zugang_aktiv ? 'Erforderlich für Lernbar' : 'Optional'}
                style={{
                  borderColor: existingUserDetected ? '#22c55e' : undefined,
                  borderWidth: existingUserDetected ? '2px' : undefined
                }}
              />
              {existingUserDetected && !teilnehmerForm.id && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '6px',
                  padding: '10px',
                  marginTop: '8px',
                  fontSize: '13px',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <div>
                    <strong>Bestehender User gefunden!</strong><br/>
                    {existingUserDetected.name} wird verknüpft (nicht neu erstellt)
                  </div>
                </div>
              )}
            </div>
            
            <div className="field">
              <label>Telefon</label>
              <input
                type="tel"
                value={teilnehmerForm.telefon}
                onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, telefon: e.target.value })}
              />
            </div>
            
            <div className="field">
              <label>WhatsApp</label>
              <input
                type="tel"
                value={teilnehmerForm.whatsapp}
                onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, whatsapp: e.target.value })}
              />
            </div>
            
            <div className="field">
              <label>Ausbildungstyp</label>
              <select 
                value={teilnehmerForm.ausbildung_typ}
                onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, ausbildung_typ: e.target.value })}
              >
                <option value="">Bitte wählen</option>
                <option value="SAN A/B">SAN A/B</option>
                <option value="Rettungssanitäter">Rettungssanitäter</option>
                <option value="Notfallsanitäter">Notfallsanitäter</option>
                <option value="GuKP">GuKP</option>
                <option value="Kommandant">Kommandant</option>
                <option value="Gerätewart">Gerätewart</option>
                <option value="Erste-Hilfe">Erste-Hilfe</option>
                <option value="Sonstiges">Sonstiges</option>
              </select>
            </div>
            
            <div className="field">
              <label>Notizen</label>
              <textarea
                value={teilnehmerForm.notizen}
                onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, notizen: e.target.value })}
                rows={3}
              />
            </div>
            
            <div className="field">
              <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                <input
                  type="checkbox"
                  checked={teilnehmerForm.lernbar_zugang_aktiv}
                  onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, lernbar_zugang_aktiv: e.target.checked })}
                  style={{width: 'auto'}}
                />
                Lernbar-Zugang aktivieren
              </label>
              <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px'}}>
                Teilnehmer erhält Zugang zur Lernbar. Password-Reset Email wird automatisch gesendet.
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAddTeilnehmerModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={saveTeilnehmer}>
                {teilnehmerForm.id ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TERMIN DETAIL MODAL */}
      {showTerminDetailModal && selectedTermin && (
        <div className="modal show" onClick={() => setShowTerminDetailModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()} style={{padding: 0, overflow: 'hidden'}}>

            {/* Header */}
            {(() => {
              const startD = parseDate(selectedTermin.start_datetime)
              const endD = parseDate(selectedTermin.end_datetime)
              const statusLabels: Record<string, string> = {geplant: 'Geplant', laufend: 'Laufend', abgeschlossen: 'Abgeschlossen', abgesagt: 'Abgesagt'}
              const statusColors: Record<string, string> = {geplant: '#3b82f6', laufend: '#10b981', abgeschlossen: '#6366f1', abgesagt: '#ef4444'}
              const sc = statusColors[selectedTermin.status] || '#64748b'
              return (
                <div style={{background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', padding: '20px 24px 16px', position: 'relative'}}>
                  <div style={{height: 3, background: sc, position: 'absolute', top: 0, left: 0, right: 0}} />
                  <div style={{fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: sc, marginBottom: 6, marginTop: 4}}>
                    {statusLabels[selectedTermin.status]}
                    {selectedTermin.dozent && <span style={{color: 'var(--warm-gray)', fontWeight: 400, marginLeft: 10, textTransform: 'none', letterSpacing: 0}}>{selectedTermin.dozent}</span>}
                  </div>
                  <div style={{fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: 'var(--lbf-text)', lineHeight: 1.25, marginBottom: 6, paddingRight: 80}}>
                    {selectedTermin.name}
                  </div>
                  <div style={{fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', display: 'flex', gap: 12, flexWrap: 'wrap' as const}}>
                    {!isNaN(startD.getTime()) && (
                      <span>
                        {fmtDateTime(selectedTermin.start_datetime)}
                        {!isNaN(endD.getTime()) && ` – ${fmtTime(selectedTermin.end_datetime)}`}
                      </span>
                    )}
                    {selectedTermin.location && <span>{selectedTermin.location}</span>}
                    <span>{getTerminTeilnehmerCount(selectedTermin.id)} / {selectedTermin.max_teilnehmer} Teilnehmer</span>
                  </div>
                  {selectedTermin.description && (
                    <div style={{fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 4}}>{selectedTermin.description}</div>
                  )}
                  <div style={{position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8}}>
                    <button
                      onClick={() => { setShowTerminDetailModal(false); openEditTermin(selectedTermin) }}
                      style={{background: 'rgba(96,8,18,0.06)', border: '0.5px solid rgba(96,8,18,0.15)', borderRadius: 8, padding: '6px 12px', color: '#600812', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit'}}
                    >
                      Bearbeiten
                    </button>
                    <button onClick={() => setShowTerminDetailModal(false)} style={{
                      background: 'rgba(96,8,18,0.06)', border: '0.5px solid rgba(96,8,18,0.12)', borderRadius: 8,
                      width: 30, height: 30, cursor: 'pointer', color: 'var(--warm-gray)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Tabs */}
            <div style={{display: 'flex', borderBottom: '0.5px solid rgba(96,8,18,0.1)', padding: '0 24px', background: 'var(--lbf-card)', overflowX: 'auto'}}>
              {([
                {key: 'uebersicht', label: 'Übersicht'},
                {key: 'teilnehmer', label: `Teilnehmer (${getTerminTeilnehmerCount(selectedTermin.id)})`},
                {key: 'dokumente', label: `Dokumente (${getTerminDokumenteCount(selectedTermin.id)})`},
                {key: 'module', label: `Module (${getTerminModuleCount(selectedTermin.id)})`},
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setCurrentTerminTab(tab.key)} style={{
                  padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, fontFamily: 'inherit', textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                  color: currentTerminTab === tab.key ? '#600812' : 'var(--warm-gray)',
                  borderBottom: currentTerminTab === tab.key ? '2px solid #600812' : '2px solid transparent',
                  marginBottom: '-0.5px', whiteSpace: 'nowrap' as const
                }}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{overflowY: 'auto', maxHeight: '60vh', padding: '20px 28px'}}>
              {/* ÜBERSICHT TAB */}
              {currentTerminTab === 'uebersicht' && (() => {
                const einladungsText = generateEinladungsText(selectedTermin)
                const linkedKonzept = selectedTermin.konzept_id ? konzepte.find(k => k.id === selectedTermin.konzept_id) : null
                return (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>

                    {/* Termin-Infos */}
                    <div style={{display: 'grid', gap: '8px', fontSize: '14px'}}>
                      <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                        <span className={`status-badge ${selectedTermin.status}`}>
                          {selectedTermin.status === 'geplant' ? 'Geplant' : selectedTermin.status === 'laufend' ? 'Laufend' : selectedTermin.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Abgesagt'}
                        </span>
                        <span style={{color: 'var(--text-secondary)'}}>{getTerminTeilnehmerCount(selectedTermin.id)} / {selectedTermin.max_teilnehmer} Teilnehmer</span>
                        {selectedTermin.dozent && <span style={{color: 'var(--text-secondary)'}}>👤 {selectedTermin.dozent}</span>}
                      </div>
                      {selectedTermin.description && <div style={{color: 'var(--text)'}}>{selectedTermin.description}</div>}
                      {selectedTermin.end_datetime && (
                        <div style={{color: 'var(--text-secondary)'}}>bis {fmtDateTime(selectedTermin.end_datetime)}</div>
                      )}
                    </div>

                    {/* Einladungslinks */}
                    <div style={{background: 'var(--bg-subtle)', borderRadius: '10px', padding: '14px'}}>
                      <div style={{fontWeight: 700, fontSize: '13px', marginBottom: '10px', color: 'var(--text)'}}>Einladung versenden</div>

                      {/* Einladungslink */}
                      {selectedTermin.einladung_token ? (() => {
                        const invUrl = `${window.location.origin}/einladung/${selectedTermin.einladung_token}`
                        const invText = `${einladungsText}\n\nHier anmelden / absagen: ${invUrl}`
                        return (
                          <div style={{marginBottom: '12px'}}>
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px'}}>
                              <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em'}}>Einladungslink</div>
                              <button
                                onClick={() => { if (confirm('Neuen Link generieren? Der alte Link funktioniert dann nicht mehr.')) generateEinladungsToken(selectedTermin) }}
                                style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'inherit', padding: '0'}}
                              >Neu generieren</button>
                            </div>
                            <div style={{display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px'}}>
                              <span style={{flex: 1, fontSize: '12px', color: 'var(--text)', wordBreak: 'break-all'}}>{invUrl}</span>
                              <button
                                onClick={() => { navigator.clipboard.writeText(invUrl); showMessage('Link kopiert!', 'success') }}
                                style={{flexShrink: 0, padding: '4px 10px', borderRadius: '6px', background: 'var(--btn-dark)', border: 'none', color: '#fff', fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit'}}
                              >Kopieren</button>
                            </div>
                            <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px'}}>
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(invText)}`}
                                target="_blank" rel="noreferrer"
                                style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', background: '#25d366', color: '#fff', fontWeight: 600, fontSize: '12px', textDecoration: 'none'}}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.85L0 24l6.335-1.508A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.371l-.359-.213-3.721.886.9-3.62-.234-.372A9.818 9.818 0 1 1 12 21.818z"/></svg>
                                WhatsApp
                              </a>
                              <a
                                href={`mailto:?subject=${encodeURIComponent('Einladung: '+selectedTermin.name)}&body=${encodeURIComponent(invText)}`}
                                style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: '12px', textDecoration: 'none'}}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                E-Mail
                              </a>
                            </div>
                          </div>
                        )
                      })() : (
                        <button
                          onClick={() => generateEinladungsToken(selectedTermin)}
                          style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'var(--btn-dark)', border: 'none', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '12px'}}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          Einladungslink erstellen (einmalig)
                        </button>
                      )}

                      {/* Text-Einladung */}
                      <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px'}}>Text versenden</div>
                      <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(einladungsText)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: '#25d366', color: '#fff', fontWeight: 600, fontSize: '13px', textDecoration: 'none'}}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.85L0 24l6.335-1.508A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.371l-.359-.213-3.721.886.9-3.62-.234-.372A9.818 9.818 0 1 1 12 21.818z"/></svg>
                          WhatsApp
                        </a>
                        <a
                          href={`sms:?body=${encodeURIComponent(einladungsText)}`}
                          style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: '#3b82f6', color: '#fff', fontWeight: 600, fontSize: '13px', textDecoration: 'none'}}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          SMS
                        </a>
                        <a
                          href={`mailto:?subject=${encodeURIComponent('Einladung: ' + selectedTermin.name)}&body=${encodeURIComponent(einladungsText)}`}
                          style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: '13px', textDecoration: 'none'}}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                          E-Mail
                        </a>
                        <button
                          onClick={() => { navigator.clipboard.writeText(einladungsText); showMessage('Text kopiert', 'success') }}
                          style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit'}}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          Kopieren
                        </button>
                      </div>
                    </div>

                    {/* Rückmeldungen */}
                    {(() => {
                      const terminEinladungen = einladungen.filter(e => e.termin_id === selectedTermin.id)
                      if (terminEinladungen.length === 0) return null
                      const zusagen = terminEinladungen.filter(e => e.status === 'zusagen')
                      const absagen = terminEinladungen.filter(e => e.status === 'absagen')
                      return (
                        <div style={{borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden'}}>
                          <div style={{padding: '12px 16px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                            <div style={{fontWeight: 700, fontSize: '13px', color: 'var(--text)'}}>Rückmeldungen</div>
                            <div style={{fontSize: '12px', color: 'var(--text-secondary)'}}>{terminEinladungen.length} gesamt</div>
                          </div>
                          <div style={{padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                            {zusagen.length > 0 && (
                              <div>
                                <div style={{fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px'}}>Zugesagt ({zusagen.length})</div>
                                <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                                  {zusagen.map(e => (
                                    <span key={e.id} style={{padding: '4px 10px', borderRadius: '20px', background: '#dcfce7', color: '#166534', fontSize: '13px', fontWeight: 500}}>{e.name}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {absagen.length > 0 && (
                              <div>
                                <div style={{fontSize: '11px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px'}}>Abgesagt ({absagen.length})</div>
                                <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                                  {absagen.map(e => (
                                    <span key={e.id} style={{padding: '4px 10px', borderRadius: '20px', background: '#fee2e2', color: '#991b1b', fontSize: '13px', fontWeight: 500}}>{e.name}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Ausbildungskonzept */}
                    <div style={{borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden'}}>
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-subtle)', borderBottom: linkedKonzept ? '1px solid #e2e8f0' : 'none'}}>
                        <div style={{fontWeight: 700, fontSize: '13px', color: 'var(--text)'}}>Ausbildungskonzept</div>
                        {linkedKonzept && (
                          <button
                            onClick={() => saveTerminField(selectedTermin.id, { konzept_id: '' })}
                            style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1, padding: '0 2px'}}
                            title="Konzept entfernen"
                          >✕</button>
                        )}
                      </div>

                      {linkedKonzept ? (
                        <div style={{padding: '16px'}}>
                          <div style={{fontWeight: 700, fontSize: '15px', marginBottom: '4px'}}>{linkedKonzept.name}</div>
                          {linkedKonzept.beschreibung && (
                            <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px'}}>{linkedKonzept.beschreibung}</div>
                          )}

                          {linkedKonzept.lernziele?.length > 0 && (
                            <div style={{marginBottom: '16px'}}>
                              <div style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                Lernziele
                              </div>
                              <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                                {linkedKonzept.lernziele.map((lz, i) => (
                                  <div key={i} style={{display: 'flex', gap: '10px', padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', borderLeft: '3px solid #3b82f6', fontSize: '13px', color: 'var(--text)'}}>
                                    <span style={{color: '#3b82f6', fontWeight: 700, fontSize: '11px', minWidth: '16px'}}>{i + 1}</span>
                                    {lz}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {linkedKonzept.handlungen?.length > 0 && (
                            <div style={{marginBottom: '16px'}}>
                              <div style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                                Handlungen
                              </div>
                              <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                                {linkedKonzept.handlungen.map((h, i) => (
                                  <div key={i} style={{display: 'flex', gap: '10px', padding: '8px 12px', background: '#f0fdf4', borderRadius: '8px', borderLeft: '3px solid #10b981', fontSize: '13px', color: 'var(--text)'}}>
                                    <span style={{color: '#10b981', fontWeight: 700, fontSize: '11px', minWidth: '16px'}}>{i + 1}</span>
                                    {h}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {linkedKonzept.koennen?.length > 0 && (
                            <div style={{marginBottom: '16px'}}>
                              <div style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg>
                                Das Können
                              </div>
                              <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                                {linkedKonzept.koennen.map((k, i) => (
                                  <span key={i} style={{padding: '4px 12px', background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '20px', fontSize: '12px', color: '#3730a3', fontWeight: 500}}>
                                    {k}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {linkedKonzept.wissensanhang_links?.length > 0 && (
                            <div>
                              <div style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                Wissensanhang
                              </div>
                              <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                                {linkedKonzept.wissensanhang_links.map((link, i) => (
                                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border)', textDecoration: 'none'}}>
                                    <div style={{width: '28px', height: '28px', borderRadius: '6px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                    </div>
                                    <div style={{flex: 1, minWidth: 0}}>
                                      <div style={{fontWeight: 600, fontSize: '13px', color: 'var(--text)'}}>{link.titel}</div>
                                      <div style={{fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{link.url}</div>
                                    </div>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{padding: '12px 16px'}}>
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) saveTerminField(selectedTermin.id, { konzept_id: e.target.value }) }}
                            style={{width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', background: 'var(--bg-card)'}}
                          >
                            <option value="">Konzept auswählen...</option>
                            {konzepte.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Individuelle Notizen */}
                    <div style={{background: 'var(--bg-subtle)', borderRadius: '10px', padding: '14px'}}>
                      <div style={{fontWeight: 700, fontSize: '13px', marginBottom: '10px', color: 'var(--text)'}}>Notizen</div>
                      <textarea
                        defaultValue={selectedTermin.notizen || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (selectedTermin.notizen || '')) {
                            saveTerminField(selectedTermin.id, { notizen: e.target.value })
                          }
                        }}
                        placeholder="Individuelle Notizen zum Termin..."
                        rows={4}
                        style={{width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'var(--bg-card)'}}
                      />
                      <div style={{fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px'}}>Wird automatisch gespeichert wenn du das Feld verlässt</div>
                    </div>

                    {/* RSVP-Liste */}
                    {(() => {
                      const ttList = terminTeilnehmer.filter(tt => tt.termin_id === selectedTermin.id)
                      if (ttList.length === 0) return null
                      const zugesagt = ttList.filter(tt => tt.status === 'zugesagt')
                      const abgesagt = ttList.filter(tt => tt.status === 'abgesagt')
                      const ausstehend = ttList.filter(tt => tt.status === 'eingeladen' || !tt.status)
                      return (
                        <div style={{background: 'var(--bg-subtle)', borderRadius: '10px', padding: '14px'}}>
                          <div style={{fontWeight: 700, fontSize: '13px', marginBottom: '10px', color: 'var(--text)'}}>
                            Zu-/Absagen
                            <span style={{marginLeft: '8px', fontWeight: 400, color: 'var(--text-secondary)', fontSize: '12px'}}>
                              {zugesagt.length} zugesagt · {abgesagt.length} abgesagt · {ausstehend.length} ausstehend
                            </span>
                          </div>
                          <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                            {ttList.map(tt => {
                              const t = teilnehmer.find(tn => tn.id === tt.teilnehmer_id)
                              if (!t) return null
                              const s = tt.status as string
                              return (
                                <div key={tt.id} style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)'}}>
                                  <div style={{flex: 1, fontSize: '14px', fontWeight: 500}}>{t.vorname} {t.nachname}</div>
                                  <div style={{display: 'flex', gap: '4px'}}>
                                    <button
                                      onClick={() => pb.collection('ausbildungen_termine_user').update(tt.id, { status: s === 'zugesagt' ? 'eingeladen' : 'zugesagt' }).then(() => loadTerminTeilnehmer())}
                                      style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: s === 'zugesagt' ? '#dcfce7' : '#fff', color: s === 'zugesagt' ? '#166534' : '#64748b', borderColor: s === 'zugesagt' ? '#22c55e' : '#e2e8f0'}}
                                    >✓ Zugesagt</button>
                                    <button
                                      onClick={() => pb.collection('ausbildungen_termine_user').update(tt.id, { status: s === 'abgesagt' ? 'eingeladen' : 'abgesagt' }).then(() => loadTerminTeilnehmer())}
                                      style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: s === 'abgesagt' ? '#fee2e2' : '#fff', color: s === 'abgesagt' ? '#991b1b' : '#64748b', borderColor: s === 'abgesagt' ? '#ef4444' : '#e2e8f0'}}
                                    >✕ Abgesagt</button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                  </div>
                )
              })()}
              
              {/* TEILNEHMER TAB */}
              {currentTerminTab === 'teilnehmer' && (
                <div>
                  {/* Teilnehmer hinzufügen */}
                  <div style={{marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addTeilnehmerToTermin(selectedTermin.id, e.target.value)
                          e.target.value = ''
                        }
                      }}
                      style={{flex: 1, minWidth: '200px', padding: '10px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit'}}
                    >
                      <option value="">Teilnehmer hinzufügen...</option>
                      {teilnehmer
                        .filter(t => !terminTeilnehmer.some(tt => tt.termin_id === selectedTermin.id && tt.teilnehmer_id === t.id))
                        .map(t => (
                          <option key={t.id} value={t.id}>{t.vorname} {t.nachname}</option>
                        ))
                      }
                    </select>
                    <button
                      className="btn primary"
                      onClick={() => addAlleTeilnehmerToTermin(selectedTermin.id)}
                      title="Alle Teilnehmer hinzufügen"
                    >
                      Alle hinzufügen
                    </button>
                  </div>

                  {/* Teilnehmerliste */}
                  {terminTeilnehmer.filter(tt => tt.termin_id === selectedTermin.id).length === 0 ? (
                    <div className="empty-state">Noch keine Teilnehmer zugewiesen</div>
                  ) : (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      {terminTeilnehmer
                        .filter(tt => tt.termin_id === selectedTermin.id)
                        .map(tt => {
                          const t = teilnehmer.find(teiln => teiln.id === tt.teilnehmer_id)
                          if (!t) return null
                          return (
                            <div key={tt.id} style={{display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f9fafb', borderRadius: '8px', flexWrap: 'wrap'}}>
                              <div style={{flex: 1, minWidth: '120px'}}>
                                <div style={{fontWeight: 600}}>{t.vorname} {t.nachname}</div>
                                {t.ausbildung_typ && <div style={{fontSize: '12px', color: 'var(--text-secondary)'}}>{t.ausbildung_typ}</div>}
                              </div>
                              <button className="btn-small danger" onClick={() => removeTeilnehmerFromTermin(tt.id)}>✕</button>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}
              
              {/* DOKUMENTE TAB */}
              {currentTerminTab === 'dokumente' && (
                <div>
                  <div style={{marginBottom: '16px'}}>
                    <button className="btn primary" onClick={() => setShowUploadDokumentModal(true)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      Dokument hochladen
                    </button>
                  </div>
                  
                  {dokumente.filter(d => d.termin_id === selectedTermin.id).length === 0 ? (
                    <div className="empty-state">Noch keine Dokumente hochgeladen</div>
                  ) : (
                    <>
                      {/* Dozenten-Dokumente */}
                      {dokumente.filter(d => d.termin_id === selectedTermin.id && d.typ === 'dozent').length > 0 && (
                        <div style={{marginBottom: '24px'}}>
                          <h4 style={{fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#b91c1c'}}>
                            📚 Dozenten-Unterlagen
                          </h4>
                          <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                            {dokumente
                              .filter(d => d.termin_id === selectedTermin.id && d.typ === 'dozent')
                              .map(d => (
                                <div key={d.id} className="dokument-item">
                                  <div style={{flex: 1}}>
                                    <div style={{fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px'}}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                      </svg>
                                      {d.name}
                                    </div>
                                    {d.beschreibung && (
                                      <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px'}}>
                                        {d.beschreibung}
                                      </div>
                                    )}
                                    <div style={{fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px'}}>
                                      {new Date(d.created).toLocaleDateString('de-DE')}
                                    </div>
                                  </div>
                                  <div style={{display: 'flex', gap: '8px'}}>
                                    {d.datei && EDITABLE_EXTS.includes(d.datei.split('.').pop()?.toLowerCase() || '') && (
                                      <button
                                        className="btn-small"
                                        onClick={() => navigate(`/office?open=${d.id}&collection=ausbildungen_dokumente&field=datei`)}
                                      >
                                        In Schreibstube öffnen
                                      </button>
                                    )}
                                    {d.datei && (
                                      <a
                                        href={pb.files.getUrl(d, d.datei)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-small"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Download
                                      </a>
                                    )}
                                    <button
                                      className="btn-small danger"
                                      onClick={() => deleteDokument(d.id, d.name)}
                                    >
                                      Löschen
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Teilnehmer-Dokumente */}
                      {dokumente.filter(d => d.termin_id === selectedTermin.id && d.typ === 'teilnehmer').length > 0 && (
                        <div>
                          <h4 style={{fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#059669'}}>
                            👥 Teilnehmer-Unterlagen
                          </h4>
                          <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                            {dokumente
                              .filter(d => d.termin_id === selectedTermin.id && d.typ === 'teilnehmer')
                              .map(d => (
                                <div key={d.id} className="dokument-item">
                                  <div style={{flex: 1}}>
                                    <div style={{fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px'}}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                      </svg>
                                      {d.name}
                                    </div>
                                    {d.beschreibung && (
                                      <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px'}}>
                                        {d.beschreibung}
                                      </div>
                                    )}
                                    <div style={{fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px'}}>
                                      {new Date(d.created).toLocaleDateString('de-DE')}
                                    </div>
                                  </div>
                                  <div style={{display: 'flex', gap: '8px'}}>
                                    {d.datei && EDITABLE_EXTS.includes(d.datei.split('.').pop()?.toLowerCase() || '') && (
                                      <button
                                        className="btn-small"
                                        onClick={() => navigate(`/office?open=${d.id}&collection=ausbildungen_dokumente&field=datei`)}
                                      >
                                        In Schreibstube öffnen
                                      </button>
                                    )}
                                    {d.datei && (
                                      <a
                                        href={pb.files.getUrl(d, d.datei)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-small"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Download
                                      </a>
                                    )}
                                    <button
                                      className="btn-small danger"
                                      onClick={() => deleteDokument(d.id, d.name)}
                                    >
                                      Löschen
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {/* MODULE TAB */}
              {currentTerminTab === 'module' && (
                <div>
                  <div style={{marginBottom: '16px'}}>
                    <select 
                      onChange={(e) => {
                        if (e.target.value) {
                          const frist = new Date()
                          frist.setDate(frist.getDate() + 14)
                          assignModulToTermin(e.target.value, selectedTermin.id, false, frist.toISOString())
                          e.target.value = ''
                        }
                      }}
                      style={{
                        padding: '10px',
                        border: '1px solid rgba(0, 0, 0, 0.15)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        width: '100%'
                      }}
                    >
                      <option value="">Modul zuweisen...</option>
                      {module
                        .filter(m => !modulTermine.some(mt => 
                          mt.termin_id === selectedTermin.id && mt.modul_id === m.id
                        ))
                        .map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.dauer_minuten} Min.)
                          </option>
                        ))
                      }
                    </select>
                  </div>
                  
                  {modulTermine.filter(mt => mt.termin_id === selectedTermin.id).length === 0 ? (
                    <div className="empty-state">Noch keine Module zugewiesen</div>
                  ) : (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      {modulTermine
                        .filter(mt => mt.termin_id === selectedTermin.id)
                        .map(mt => {
                          const m = module.find(mod => mod.id === mt.modul_id)
                          if (!m) return null
                          return (
                            <div key={mt.id} className="modul-item">
                              <div style={{flex: 1}}>
                                <div style={{fontWeight: 600}}>{m.name}</div>
                                <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px'}}>
                                  {mt.pflicht ? '⚠️ Pflicht' : '📌 Optional'} • 
                                  Frist: {new Date(mt.frist_datum).toLocaleDateString('de-DE')} • 
                                  Dauer: {m.dauer_minuten} Min.
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ADD/EDIT MODUL MODAL */}
      {showAddModulModal && (
        <div className="modal show" onClick={() => setShowAddModulModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()} style={{maxHeight: '90vh', overflowY: 'auto'}}>
            <h3>{modulForm.id ? 'Modul bearbeiten' : 'Modul erstellen'}</h3>

            <div className="field">
              <label>Name *</label>
              <input type="text" value={modulForm.name} autoFocus
                onChange={(e) => setModulForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Grundlagen Erste Hilfe" />
            </div>

            <div className="field">
              <label>Beschreibung</label>
              <textarea rows={2} value={modulForm.beschreibung}
                onChange={(e) => setModulForm(prev => ({ ...prev, beschreibung: e.target.value }))}
                placeholder="Kurze Beschreibung des Moduls" />
            </div>

            <div className="field">
              <label>Dauer (Minuten)</label>
              <input type="number" min={1} value={modulForm.dauer_minuten}
                onChange={(e) => setModulForm(prev => ({ ...prev, dauer_minuten: parseInt(e.target.value) || 60 }))} />
            </div>

            <div className="field">
              <label>Mindest-Quizprozent (%)</label>
              <input type="number" min={0} max={100} value={modulForm.min_pass_percent}
                onChange={(e) => setModulForm(prev => ({ ...prev, min_pass_percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
                placeholder="z.B. 80" />
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Wie viel Prozent der Quiz-Fragen müssen richtig beantwortet werden (0–100).
              </div>
            </div>

            {/* Content blocks */}
            <div style={{marginTop: '24px', marginBottom: '12px'}}>
              <div style={{fontWeight: 700, fontSize: '14px', marginBottom: '12px'}}>Inhalte</div>

              {modulForm.inhalte.length === 0 && (
                <div style={{color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px'}}>Noch keine Inhaltsblöcke hinzugefügt.</div>
              )}

              {modulForm.inhalte.map((block, idx) => (
                <div key={idx} style={{
                  border: '1px solid var(--border)', borderRadius: '10px',
                  padding: '16px', marginBottom: '12px', background: '#fafafa'
                }}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px'}}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: block.typ === 'quiz' ? '#7c3aed' : '#2563eb',
                      background: block.typ === 'quiz' ? '#f5f3ff' : '#eff6ff',
                      padding: '3px 8px', borderRadius: '4px'
                    }}>
                      {block.typ === 'quiz' ? 'Quiz' : 'Text'}
                    </span>
                    <input
                      type="text"
                      value={block.titel}
                      onChange={(e) => updateInhaltBlock(idx, 'titel', e.target.value)}
                      placeholder="Titel des Blocks"
                      style={{flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit'}}
                    />
                    <button onClick={() => removeInhaltBlock(idx)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px'
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>

                  {block.typ === 'text' && (
                    <textarea
                      rows={5}
                      value={block.inhalt}
                      onChange={(e) => updateInhaltBlock(idx, 'inhalt', e.target.value)}
                      placeholder="Inhalt hier eingeben..."
                      style={{width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box'}}
                    />
                  )}

                  {block.typ === 'quiz' && (() => {
                    const quizData = parseQuizInhalt(block.inhalt)
                    return (
                      <div>
                        {quizData.fragen.map((f, fi) => (
                          <div key={fi} style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px',
                            padding: '12px', marginBottom: '8px', fontSize: '13px'
                          }}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                              <div style={{fontWeight: 600, flex: 1}}>{f.frage}</div>
                              <button onClick={() => removeQuizFrage(idx, fi)} style={{background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px'}}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            </div>
                            <div style={{marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px'}}>
                              {f.antworten.map((a, ai) => (
                                <div key={ai} style={{
                                  display: 'flex', alignItems: 'center', gap: '6px',
                                  color: ai === f.richtige ? '#059669' : 'var(--text-secondary)'
                                }}>
                                  <span style={{fontSize: '11px', fontWeight: ai === f.richtige ? 700 : 400}}>
                                    {ai === f.richtige ? '✓' : '○'}
                                  </span>
                                  {a}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        {editingQuizBlock === idx ? (
                          <div style={{background: 'var(--bg-card)', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '12px', marginTop: '8px'}}>
                            <div className="field" style={{marginBottom: '8px'}}>
                              <label style={{fontSize: '12px'}}>Frage</label>
                              <input type="text" value={newQuizFrage}
                                onChange={(e) => setNewQuizFrage(e.target.value)}
                                placeholder="Frage eingeben..."
                                style={{padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box'}} />
                            </div>
                            <div style={{display: 'grid', gap: '6px', marginBottom: '10px'}}>
                              {[0,1,2,3].map(i => (
                                <div key={i} style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                                  <input type="radio" name={`richtig-${idx}`} checked={newQuizRichtige === i}
                                    onChange={() => setNewQuizRichtige(i)} title="Richtige Antwort" />
                                  <input type="text" value={newQuizAntworten[i]}
                                    onChange={(e) => {
                                      const a = [...newQuizAntworten]; a[i] = e.target.value; setNewQuizAntworten(a)
                                    }}
                                    placeholder={`Antwort ${i + 1}${i < 2 ? ' *' : ''}`}
                                    style={{flex: 1, padding: '7px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit'}} />
                                </div>
                              ))}
                            </div>
                            <div style={{fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px'}}>Radio = richtige Antwort</div>
                            <div style={{display: 'flex', gap: '8px'}}>
                              <button className="btn primary" style={{fontSize: '12px', padding: '6px 14px'}} onClick={() => addQuizFrage(idx)}>Hinzufügen</button>
                              <button className="btn secondary" style={{fontSize: '12px', padding: '6px 14px'}} onClick={() => setEditingQuizBlock(null)}>Abbrechen</button>
                            </div>
                          </div>
                        ) : (
                          <button className="btn secondary" style={{fontSize: '12px', padding: '6px 14px', marginTop: '8px'}}
                            onClick={() => { setEditingQuizBlock(idx); setNewQuizFrage(''); setNewQuizAntworten(['','','','']); setNewQuizRichtige(0) }}>
                            + Frage hinzufügen
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </div>
              ))}

              <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                <button className="btn secondary" style={{fontSize: '13px'}} onClick={() => addInhaltBlock('text')}>
                  + Textblock
                </button>
                <button className="btn secondary" style={{fontSize: '13px'}} onClick={() => addInhaltBlock('quiz')}>
                  + Quizblock
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAddModulModal(false)}>Abbrechen</button>
              <button className="btn primary" onClick={saveModul}>
                {modulForm.id ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODUL DETAIL MODAL */}
      {showModulDetailModal && selectedModul && (
        <div className="modal show" onClick={() => setShowModulDetailModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()} style={{padding: 0, overflow: 'hidden'}}>
            {/* Header */}
            <div style={{background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', padding: '20px 24px 16px', position: 'relative'}}>
              <div style={{fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#600812', marginBottom: 6}}>
                Lernmodul · {selectedModul.dauer_minuten} Min.
              </div>
              <div style={{fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)', lineHeight: 1.25, paddingRight: 50}}>{selectedModul.name}</div>
              {selectedModul.beschreibung && (
                <div style={{fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 4}}>{selectedModul.beschreibung}</div>
              )}
              <button onClick={() => setShowModulDetailModal(false)} style={{
                position: 'absolute', top: 14, right: 14, background: 'rgba(96,8,18,0.06)',
                border: '0.5px solid rgba(96,8,18,0.12)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
                color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div style={{display: 'flex', borderBottom: '0.5px solid rgba(96,8,18,0.1)', padding: '0 24px', background: 'var(--lbf-card)'}}>
              {(['inhalt', 'teilnehmer'] as const).map(tab => (
                <button key={tab} onClick={() => setSelectedModulTab(tab)} style={{
                  padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, fontFamily: 'inherit', textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                  color: selectedModulTab === tab ? '#600812' : 'var(--warm-gray)',
                  borderBottom: selectedModulTab === tab ? '2px solid #600812' : '2px solid transparent',
                  marginBottom: '-0.5px', whiteSpace: 'nowrap' as const
                }}>
                  {tab === 'inhalt' ? 'Inhalt' : `Teilnehmer (${modulProgress.filter(p => p.modul_id === selectedModul.id).length})`}
                </button>
              ))}
            </div>

            {/* Body */}
            <div style={{padding: '24px 28px', overflowY: 'auto', maxHeight: '55vh'}}>

              {/* INHALT TAB */}
              {selectedModulTab === 'inhalt' && (
                <div>
                  {(!selectedModul.inhalte || selectedModul.inhalte.length === 0) ? (
                    <div style={{color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '24px 0'}}>
                      Noch keine Inhalte. Modul bearbeiten, um Blöcke hinzuzufügen.
                    </div>
                  ) : (
                    selectedModul.inhalte.map((block, idx) => (
                      <div key={idx} style={{marginBottom: '20px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px'}}>
                          <span style={{
                            fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                            color: block.typ === 'quiz' ? '#7c3aed' : '#2563eb',
                            background: block.typ === 'quiz' ? '#f5f3ff' : '#eff6ff',
                            padding: '2px 8px', borderRadius: '4px'
                          }}>{block.typ === 'quiz' ? 'Quiz' : 'Text'}</span>
                          {block.titel && <span style={{fontWeight: 600, fontSize: '14px'}}>{block.titel}</span>}
                        </div>

                        {block.typ === 'text' && (
                          <div style={{
                            background: 'var(--bg-subtle)', borderRadius: '10px', padding: '16px',
                            fontSize: '14px', lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-wrap'
                          }}>
                            {block.inhalt || <span style={{color: 'var(--text-secondary)'}}>Kein Inhalt.</span>}
                          </div>
                        )}

                        {block.typ === 'quiz' && (() => {
                          const quizData = parseQuizInhalt(block.inhalt)
                          return (
                            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                              {quizData.fragen.length === 0 && (
                                <div style={{color: 'var(--text-secondary)', fontSize: '13px'}}>Noch keine Fragen.</div>
                              )}
                              {quizData.fragen.map((f, fi) => (
                                <div key={fi} style={{background: '#f5f3ff', borderRadius: '10px', padding: '14px', border: '1px solid #e9d5ff'}}>
                                  <div style={{fontWeight: 600, fontSize: '14px', marginBottom: '8px'}}>{fi + 1}. {f.frage}</div>
                                  <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                                    {f.antworten.map((a, ai) => (
                                      <div key={ai} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '6px 10px', borderRadius: '6px',
                                        background: ai === f.richtige ? '#d1fae5' : '#fff',
                                        border: `1px solid ${ai === f.richtige ? '#6ee7b7' : '#e2e8f0'}`,
                                        fontSize: '13px', color: ai === f.richtige ? '#065f46' : '#334155'
                                      }}>
                                        <span style={{fontWeight: ai === f.richtige ? 700 : 400, minWidth: '14px'}}>
                                          {ai === f.richtige ? '✓' : String.fromCharCode(65 + ai)}
                                        </span>
                                        {a}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TEILNEHMER TAB */}
              {selectedModulTab === 'teilnehmer' && (() => {
                const assigned = modulProgress.filter(p => p.modul_id === selectedModul.id)
                const done = assigned.filter(p => p.abgeschlossen_am)
                const unassignedTeilnehmer = teilnehmer.filter(t => !assigned.some(p => p.teilnehmer_id === t.id))
                return (
                  <div>
                    {/* Summary bar */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '16px',
                      background: 'var(--bg-subtle)', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px'
                    }}>
                      <div style={{flex: 1}}>
                        <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px'}}>
                          {done.length} von {assigned.length} abgeschlossen
                        </div>
                        <div style={{height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden'}}>
                          <div style={{
                            height: '100%', background: '#10b981', borderRadius: '3px',
                            width: assigned.length > 0 ? `${Math.round((done.length / assigned.length) * 100)}%` : '0%',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                      </div>
                      <button className="btn primary" style={{fontSize: '12px', padding: '7px 14px', whiteSpace: 'nowrap'}}
                        onClick={() => assignAllTeilnehmerToModul(selectedModul.id)}>
                        Alle hinzufügen
                      </button>
                    </div>

                    {/* Add individual */}
                    {unassignedTeilnehmer.length > 0 && (
                      <div style={{display: 'flex', gap: '8px', marginBottom: '16px'}}>
                        <select value={addModulTeilnehmerId} onChange={(e) => setAddModulTeilnehmerId(e.target.value)}
                          style={{flex: 1, padding: '9px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit'}}>
                          <option value="">Teilnehmer einzeln hinzufügen...</option>
                          {unassignedTeilnehmer.map(t => (
                            <option key={t.id} value={t.id}>{t.vorname} {t.nachname}</option>
                          ))}
                        </select>
                        <button className="btn primary" style={{fontSize: '13px', padding: '8px 16px'}}
                          onClick={async () => { await assignTeilnehmerToModul(selectedModul.id, addModulTeilnehmerId); setAddModulTeilnehmerId('') }}>
                          Hinzufügen
                        </button>
                      </div>
                    )}

                    {/* Participant list */}
                    {assigned.length === 0 ? (
                      <div style={{color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '20px 0'}}>
                        Noch keine Teilnehmer zugewiesen.
                      </div>
                    ) : (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                        {assigned.map(p => {
                          const t = teilnehmer.find(x => x.id === p.teilnehmer_id)
                          const isDone = !!p.abgeschlossen_am
                          return (
                            <div key={p.id} style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '12px 14px', borderRadius: '10px',
                              background: isDone ? '#f0fdf4' : '#fafafa',
                              border: `1px solid ${isDone ? '#bbf7d0' : '#e2e8f0'}`
                            }}>
                              <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: isDone ? '#10b981' : '#e2e8f0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, color: isDone ? '#fff' : '#94a3b8', fontSize: '13px', fontWeight: 700
                              }}>
                                {t ? `${t.vorname[0]}${t.nachname[0]}` : '?'}
                              </div>
                              <div style={{flex: 1}}>
                                <div style={{fontWeight: 600, fontSize: '14px'}}>
                                  {t ? `${t.vorname} ${t.nachname}` : 'Unbekannt'}
                                </div>
                                {isDone && p.abgeschlossen_am && (
                                  <div style={{fontSize: '11px', color: '#059669', marginTop: '2px'}}>
                                    Abgeschlossen am {fmtDate(p.abgeschlossen_am)}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => toggleModulAbgeschlossen(p.id, isDone)}
                                style={{
                                  padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
                                  background: isDone ? '#dcfce7' : '#f1f5f9',
                                  color: isDone ? '#065f46' : '#475569'
                                }}
                              >
                                {isDone ? 'Abgeschlossen' : 'Offen'}
                              </button>
                              <button onClick={() => removeModulTeilnehmer(p.id)} style={{background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '4px'}}
                                title="Entfernen">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Footer */}
            <div style={{padding: '14px 28px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
              <button className="btn secondary" onClick={() => { setShowModulDetailModal(false); openEditModul(selectedModul) }}>
                Bearbeiten
              </button>
              <button className="btn" onClick={() => setShowModulDetailModal(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD DOKUMENT MODAL */}
      {showUploadDokumentModal && (
        <div className="modal show" onClick={() => setShowUploadDokumentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Dokument hochladen</h3>
            
            <div className="field">
              <label>Datei *</label>
              <input
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>
            
            <div className="field">
              <label>Typ *</label>
              <select 
                value={uploadTyp}
                onChange={(e) => setUploadTyp(e.target.value as any)}
              >
                <option value="dozent">Dozent</option>
                <option value="teilnehmer">Teilnehmer</option>
              </select>
            </div>
            
            <div className="field">
              <label>Beschreibung</label>
              <textarea
                value={uploadBeschreibung}
                onChange={(e) => setUploadBeschreibung(e.target.value)}
                rows={3}
                placeholder="Optional"
              />
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowUploadDokumentModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={uploadDokument}>
                Hochladen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT KONZEPT MODAL */}
      {showAddKonzeptModal && (
        <div className="modal show" onClick={() => setShowAddKonzeptModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>{konzeptForm.id ? 'Konzept bearbeiten' : 'Konzept erstellen'}</h3>
            
            <div className="field">
              <label>Name *</label>
              <input
                type="text"
                value={konzeptForm.name}
                onChange={(e) => setKonzeptForm({ ...konzeptForm, name: e.target.value })}
                placeholder="z.B. San A - Modul 1"
                autoFocus
              />
            </div>
            
            <div className="field">
              <label>Beschreibung</label>
              <textarea
                value={konzeptForm.beschreibung}
                onChange={(e) => setKonzeptForm({ ...konzeptForm, beschreibung: e.target.value })}
                rows={2}
                placeholder="Kurze Beschreibung des Konzepts"
              />
            </div>

            <div style={{marginTop: '24px'}}>
              <h4 style={{marginBottom: '12px', fontSize: '16px'}}>Lernziele</h4>
              <div className="list-editor">
                {konzeptForm.lernziele.map((lz, idx) => (
                  <div key={idx} className="list-item">
                    <span>{lz}</span>
                    <button className="btn-icon danger" onClick={() => removeKonzeptItem('lernziele', idx)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="add-item">
                  <input
                    type="text"
                    value={newLernziel}
                    onChange={(e) => setNewLernziel(e.target.value)}
                    placeholder="Neues Lernziel hinzufügen..."
                    onKeyPress={(e) => e.key === 'Enter' && addKonzeptItem('lernziele')}
                  />
                  <button className="btn-small primary" onClick={() => addKonzeptItem('lernziele')}>+</button>
                </div>
              </div>
            </div>

            <div style={{marginTop: '24px'}}>
              <h4 style={{marginBottom: '12px', fontSize: '16px'}}>Handlungen</h4>
              <div className="list-editor">
                {konzeptForm.handlungen.map((h, idx) => (
                  <div key={idx} className="list-item">
                    <span>{h}</span>
                    <button className="btn-icon danger" onClick={() => removeKonzeptItem('handlungen', idx)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="add-item">
                  <input
                    type="text"
                    value={newHandlung}
                    onChange={(e) => setNewHandlung(e.target.value)}
                    placeholder="Neue Handlung hinzufügen..."
                    onKeyPress={(e) => e.key === 'Enter' && addKonzeptItem('handlungen')}
                  />
                  <button className="btn-small primary" onClick={() => addKonzeptItem('handlungen')}>+</button>
                </div>
              </div>
            </div>

            <div style={{marginTop: '24px'}}>
              <h4 style={{marginBottom: '12px', fontSize: '16px'}}>Das Können</h4>
              <div className="list-editor">
                {konzeptForm.koennen.map((k, idx) => (
                  <div key={idx} className="list-item">
                    <span>{k}</span>
                    <button className="btn-icon danger" onClick={() => removeKonzeptItem('koennen', idx)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="add-item">
                  <input
                    type="text"
                    value={newKoennen}
                    onChange={(e) => setNewKoennen(e.target.value)}
                    placeholder="Neue Kompetenz hinzufügen..."
                    onKeyPress={(e) => e.key === 'Enter' && addKonzeptItem('koennen')}
                  />
                  <button className="btn-small primary" onClick={() => addKonzeptItem('koennen')}>+</button>
                </div>
              </div>
            </div>

            <div style={{marginTop: '24px'}}>
              <h4 style={{marginBottom: '12px', fontSize: '16px'}}>Wissensanhang (Links)</h4>
              <div className="list-editor">
                {konzeptForm.wissensanhang_links.map((link, idx) => (
                  <div key={idx} className="list-item">
                    <div>
                      <div style={{fontWeight: 600}}>{link.titel}</div>
                      <div style={{fontSize: '12px', color: 'var(--text-secondary)'}}>{link.url}</div>
                    </div>
                    <button className="btn-icon danger" onClick={() => removeWissensLink(idx)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="add-link">
                  <input
                    type="text"
                    value={newLinkTitel}
                    onChange={(e) => setNewLinkTitel(e.target.value)}
                    placeholder="Titel"
                    style={{flex: 1}}
                  />
                  <input
                    type="url"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="URL"
                    style={{flex: 2}}
                  />
                  <button className="btn-small primary" onClick={addWissensLink}>+</button>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAddKonzeptModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={saveKonzept}>
                {konzeptForm.id ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KONZEPT DETAIL MODAL */}
      {showKonzeptDetailModal && selectedKonzept && (
        <div className="modal show" onClick={() => setShowKonzeptDetailModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()} style={{padding: 0, overflow: 'hidden'}}>
            {/* Header */}
            <div style={{
              background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)',
              padding: '20px 24px 16px', position: 'relative'
            }}>
              <div style={{fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#600812', marginBottom: 6}}>
                Ausbildungskonzept
              </div>
              <div style={{fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)', lineHeight: 1.25, paddingRight: 50}}>
                {selectedKonzept.name}
              </div>
              {selectedKonzept.beschreibung && (
                <div style={{fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 4, lineHeight: 1.6}}>
                  {selectedKonzept.beschreibung}
                </div>
              )}
              <button
                onClick={() => setShowKonzeptDetailModal(false)}
                style={{
                  position: 'absolute', top: 14, right: 14,
                  background: 'rgba(96,8,18,0.06)', border: '0.5px solid rgba(96,8,18,0.12)', borderRadius: 8,
                  width: 30, height: 30, cursor: 'pointer', color: 'var(--warm-gray)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{padding: '28px 32px', overflowY: 'auto', maxHeight: '60vh'}}>

              {selectedKonzept.lernziele && selectedKonzept.lernziele.length > 0 && (
                <div style={{marginBottom: '28px'}}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '14px'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    Lernziele
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    {selectedKonzept.lernziele.map((lz, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                        padding: '12px 14px', background: 'var(--bg-subtle)',
                        borderRadius: '10px', borderLeft: '3px solid #3b82f6',
                        fontSize: '14px', lineHeight: 1.5, color: 'var(--text)'
                      }}>
                        <span style={{color: '#3b82f6', fontWeight: 700, fontSize: '12px', minWidth: '20px', paddingTop: '1px'}}>{idx + 1}</span>
                        {lz}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedKonzept.handlungen && selectedKonzept.handlungen.length > 0 && (
                <div style={{marginBottom: '28px'}}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '14px'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    Handlungen
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    {selectedKonzept.handlungen.map((h, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                        padding: '12px 14px', background: 'var(--bg-subtle)',
                        borderRadius: '10px', borderLeft: '3px solid #10b981',
                        fontSize: '14px', lineHeight: 1.5, color: 'var(--text)'
                      }}>
                        <span style={{color: '#10b981', fontWeight: 700, fontSize: '12px', minWidth: '20px', paddingTop: '1px'}}>{idx + 1}</span>
                        {h}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedKonzept.koennen && selectedKonzept.koennen.length > 0 && (
                <div style={{marginBottom: '28px'}}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '14px'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
                    </svg>
                    Das Können
                  </div>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                    {selectedKonzept.koennen.map((k, idx) => (
                      <span key={idx} style={{
                        padding: '6px 14px', background: '#f0f4ff',
                        border: '1px solid #c7d2fe', borderRadius: '20px',
                        fontSize: '13px', color: '#3730a3', fontWeight: 500
                      }}>
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedKonzept.wissensanhang_links && selectedKonzept.wissensanhang_links.length > 0 && (
                <div style={{marginBottom: '8px'}}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '14px'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    Wissensanhang
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    {selectedKonzept.wissensanhang_links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '14px',
                          padding: '14px 16px', background: 'var(--bg-subtle)',
                          borderRadius: '10px', textDecoration: 'none',
                          border: '1px solid var(--border)', transition: 'border-color 0.15s'
                        }}
                      >
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '8px',
                          background: '#e0e7ff', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', flexShrink: 0
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                          </svg>
                        </div>
                        <div style={{flex: 1, minWidth: 0}}>
                          <div style={{fontWeight: 600, fontSize: '14px', color: 'var(--text)'}}>{link.titel}</div>
                          <div style={{fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{link.url}</div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {(!selectedKonzept.lernziele || selectedKonzept.lernziele.length === 0) &&
               (!selectedKonzept.handlungen || selectedKonzept.handlungen.length === 0) &&
               (!selectedKonzept.koennen || selectedKonzept.koennen.length === 0) &&
               (!selectedKonzept.wissensanhang_links || selectedKonzept.wissensanhang_links.length === 0) && (
                <div style={{textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: '14px'}}>
                  Keine weiteren Inhalte vorhanden.
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{padding: '16px 32px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
              <button className="btn secondary" onClick={() => { setShowKonzeptDetailModal(false); openEditKonzept(selectedKonzept) }}>
                Bearbeiten
              </button>
              <button className="btn" onClick={() => setShowKonzeptDetailModal(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FILE PICKER SHEET */}
      {showFilePicker && (() => {
        const isTN = showFilePicker === 'tn'
        const currentLinks = isTN ? anhangLinks : dateienLinks
        const accentColor = isTN ? '#8a7a68' : '#600812'
        const query = filePickerSearch.toLowerCase()
        const filtered = filePickerItems.filter(f => f.name.toLowerCase().includes(query))
        return (
          <>
            <div onClick={() => setShowFilePicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 700 }} />
            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 701, background: 'var(--warm-bg)', borderRadius: '20px 20px 0 0', maxHeight: '80dvh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <div style={{ flexShrink: 0, padding: '14px 16px 10px', borderBottom: '0.5px solid rgba(96,8,18,0.08)' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(96,8,18,0.15)', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>
                  Aus Bibliothek — {isTN ? 'Für Teilnehmer' : 'Für Dozenten'}
                </div>
                <input value={filePickerSearch} onChange={e => setFilePickerSearch(e.target.value)}
                  placeholder="Suchen …" autoFocus
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1px solid rgba(${isTN ? '138,122,104' : '96,8,18'},0.15)`, background: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit', color: 'var(--lbf-text)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
                {filePickerLoading ? (
                  <div style={{ color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Lade…</div>
                ) : filtered.length === 0 ? (
                  <div style={{ color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Keine Dateien gefunden</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filtered.map(item => {
                      const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
                      const alreadyLinked = currentLinks.some(l => l.id === item.id)
                      return (
                        <button key={item.id} onClick={() => isTN ? linkTNFile(item) : linkDozentFile(item)} disabled={alreadyLinked}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: alreadyLinked ? `rgba(${isTN ? '138,122,104' : '96,8,18'},0.04)` : '#fff', border: `1px solid rgba(${isTN ? '138,122,104' : '96,8,18'},${alreadyLinked ? '0.2' : '0.1'})`, borderRadius: 10, cursor: alreadyLinked ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={alreadyLinked ? '#16a34a' : accentColor} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--lbf-text)' }}>{item.name}</span>
                          <span style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', flexShrink: 0 }}>{ext}</span>
                          {alreadyLinked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )
      })()}

      {/* PDF VIEWER */}
      {pdfViewerUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: '#111', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flexShrink: 0, height: 52, background: '#1a0e08', borderBottom: '0.5px solid rgba(253,232,216,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
            <div style={{ fontStyle: 'italic', fontSize: 13, color: '#fde8d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{decodeURIComponent(pdfViewerUrl.split('/').pop() || '')}</div>
            <button onClick={() => setPdfViewerUrl(null)} style={{ background: 'rgba(253,232,216,0.1)', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#fde8d8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Schließen</button>
          </div>
          <iframe src={pdfViewerUrl} style={{ flex: 1, border: 'none' }} title="PDF" />
        </div>
      )}

      {/* PRAESENTATION EDITOR */}
      {showPraesentationEditor && (() => {
        const slide = praesentationSlides[currentSlideIdx]
        if (!slide) return null
        const patBg = slide.pattern ? getPatternBg(slide.pattern) : null
        const COLORS = ['#600812','#3d0408','#1e3a8a','#065f46','#713f12','#1a1a2e','#0f0a07','#374151']
        const PATTERNS_P = ['diamante','venezia','marmo','trama','fiorentino','capitone'] as const
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'var(--warm-bg)', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>
            {/* Editor header */}
            <div style={{ flexShrink: 0, height: 54, background: '#fff', borderBottom: '0.5px solid rgba(96,8,18,0.12)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px' }}>
              <button onClick={() => setShowPraesentationEditor(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <input value={praesentationTitel} onChange={e => setPraesentationTitel(e.target.value)} placeholder="Titel der Präsentation …"
                style={{ flex: 1, background: 'var(--warm-bg)', border: '1px solid rgba(96,8,18,0.15)', borderRadius: 8, padding: '6px 12px', color: 'var(--lbf-text)', fontSize: 14, fontStyle: 'italic', outline: 'none', fontFamily: 'inherit' }} />
              <button onClick={() => { setShowPresentationMode(true); setPresentationModeSlideIdx(0) }}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(96,8,18,0.2)', background: 'transparent', color: '#600812', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" fill="#600812" stroke="none"/></svg>
                Präsentieren
              </button>
              <button onClick={savePraesentation} disabled={savingPraesentation || !praesentationTitel.trim()}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: praesentationTitel.trim() ? '#600812' : 'rgba(96,8,18,0.3)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: praesentationTitel.trim() ? 'pointer' : 'default', fontFamily: 'inherit', flexShrink: 0 }}>
                {savingPraesentation ? 'Speichert…' : 'Speichern'}
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Left: slide thumbnails */}
              <div style={{ width: 130, background: '#fff', borderRight: '0.5px solid rgba(96,8,18,0.08)', overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                {praesentationSlides.map((s, i) => {
                  const sPat = s.pattern ? getPatternBg(s.pattern) : null
                  return (
                    <div key={s.id} onClick={() => setCurrentSlideIdx(i)} style={{ position: 'relative', cursor: 'pointer' }}>
                      <div style={{ aspectRatio: '16/9', background: s.bg, borderRadius: 5, border: i === currentSlideIdx ? '2px solid #600812' : '2px solid rgba(96,8,18,0.12)', overflow: 'hidden', position: 'relative' }}>
                        {s.imagePreview && <img src={s.imagePreview} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                        {sPat && <div style={{ position: 'absolute', inset: 0, backgroundImage: sPat.backgroundImage, backgroundSize: sPat.backgroundSize || 'auto', zIndex: 1 }} />}
                        {s.title && <div style={{ position: 'absolute', bottom: 3, left: 4, right: 4, fontSize: 5.5, color: s.textColor || '#fff', fontStyle: 'italic', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', zIndex: 2 }}>{s.title}</div>}
                        <div style={{ position: 'absolute', top: 2, left: 3, fontSize: 5.5, color: 'rgba(255,255,255,0.55)', zIndex: 2 }}>{i + 1}</div>
                      </div>
                      {i === currentSlideIdx && (
                        <button onClick={e => { e.stopPropagation(); deletePraesSlide(i) }} style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: 3, background: 'rgba(220,38,38,0.85)', border: 'none', color: '#fff', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 3 }}>×</button>
                      )}
                    </div>
                  )
                })}
                <button onClick={addPraesSlide} style={{ width: '100%', padding: '6px 0', borderRadius: 6, border: '1px dashed rgba(96,8,18,0.25)', background: 'transparent', color: '#600812', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>+ Folie</button>
              </div>

              {/* Center: slide canvas */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'auto', background: 'var(--warm-bg)' }}>
                <div style={{ width: '100%', maxWidth: 760, aspectRatio: '16/9', background: slide.bg, borderRadius: 10, position: 'relative', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
                  {slide.imagePreview && <img src={slide.imagePreview} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />}
                  {patBg && <div style={{ position: 'absolute', inset: 0, backgroundImage: patBg.backgroundImage, backgroundSize: patBg.backgroundSize || 'auto', zIndex: 1 }} />}
                  {slide.imagePreview && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0.15) 60%,transparent 100%)', zIndex: 2 }} />}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: slide.layout === 'blank' ? 'flex-start' : 'center', justifyContent: slide.layout === 'content' ? 'flex-end' : 'center', padding: slide.layout === 'content' ? '10% 8% 8%' : '8%', zIndex: 3, gap: 12 }}>
                    {slide.layout !== 'blank' && (
                      <input value={slide.title || ''} onChange={e => updateSlideField(slide.id, { title: e.target.value })}
                        placeholder={slide.layout === 'title' ? 'Titel eingeben …' : 'Überschrift …'}
                        style={{ background: 'transparent', border: 'none', outline: 'none', color: slide.textColor || '#fff', fontFamily: "'Atkinson Hyperlegible', sans-serif", fontSize: slide.layout === 'title' ? 'clamp(20px, 4.5vw, 52px)' : 'clamp(15px, 3vw, 34px)', fontWeight: 800, fontStyle: 'italic', textAlign: 'center', width: '100%', caretColor: slide.textColor || '#fff', textShadow: slide.imagePreview ? '0 2px 8px rgba(0,0,0,0.5)' : 'none' } as React.CSSProperties} />
                    )}
                    {(slide.layout === 'content' || slide.layout === 'blank') && (
                      <textarea value={slide.body || ''} onChange={e => updateSlideField(slide.id, { body: e.target.value })}
                        placeholder="Text eingeben …" rows={3}
                        style={{ background: 'transparent', border: 'none', outline: 'none', color: slide.textColor || '#fff', fontFamily: "'Atkinson Hyperlegible', sans-serif", fontSize: 'clamp(12px, 1.8vw, 20px)', textAlign: 'center', width: '100%', resize: 'none', caretColor: slide.textColor || '#fff', lineHeight: 1.65, opacity: 0.85, textShadow: slide.imagePreview ? '0 2px 6px rgba(0,0,0,0.5)' : 'none' } as React.CSSProperties} />
                    )}
                  </div>
                </div>
              </div>

              {/* Right: properties */}
              <div style={{ width: 190, background: '#fff', borderLeft: '0.5px solid rgba(96,8,18,0.08)', overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Hintergrund</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                    {COLORS.map(c => (
                      <button key={c} onClick={() => updateSlideField(slide.id, { bg: c })}
                        style={{ width: '100%', aspectRatio: '1', borderRadius: 6, border: `2px solid ${slide.bg === c ? '#600812' : 'rgba(96,8,18,0.12)'}`, background: c, cursor: 'pointer', padding: 0 }} />
                    ))}
                  </div>
                  <input type="color" value={slide.bg} onChange={e => updateSlideField(slide.id, { bg: e.target.value })}
                    style={{ width: '100%', height: 28, borderRadius: 6, border: '1px solid rgba(96,8,18,0.15)', marginTop: 6, cursor: 'pointer', background: 'transparent' }} />
                </div>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Muster</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                    <button onClick={() => updateSlideField(slide.id, { pattern: null })}
                      style={{ aspectRatio: '1', borderRadius: 5, border: `2px solid ${!slide.pattern ? '#600812' : 'rgba(96,8,18,0.12)'}`, background: 'var(--warm-bg)', cursor: 'pointer', fontSize: 7, color: 'var(--warm-gray)' }}>Kein</button>
                    {PATTERNS_P.map(pat => {
                      const pp = getPatternBg(pat)
                      return pp ? (
                        <button key={pat} onClick={() => updateSlideField(slide.id, { pattern: pat })}
                          style={{ aspectRatio: '1', borderRadius: 5, border: `2px solid ${slide.pattern === pat ? '#600812' : 'rgba(96,8,18,0.12)'}`, background: slide.bg, backgroundImage: pp.backgroundImage, backgroundSize: pp.backgroundSize || 'auto', cursor: 'pointer' }} />
                      ) : null
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Textfarbe</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {['#ffffff','#fde8d8','#1a0e08','#600812'].map(c => (
                      <button key={c} onClick={() => updateSlideField(slide.id, { textColor: c })}
                        style={{ flex: 1, height: 26, borderRadius: 6, border: `2px solid ${slide.textColor === c ? '#600812' : 'rgba(96,8,18,0.12)'}`, background: c, cursor: 'pointer', padding: 0 }} />
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Layout</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(['title','content','image','blank'] as const).map(l => (
                      <button key={l} onClick={() => updateSlideField(slide.id, { layout: l })}
                        style={{ padding: '5px 8px', borderRadius: 6, border: `1px solid ${slide.layout === l ? '#600812' : 'rgba(96,8,18,0.12)'}`, background: slide.layout === l ? 'rgba(96,8,18,0.07)' : 'transparent', color: slide.layout === l ? '#600812' : 'var(--warm-gray)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: slide.layout === l ? 700 : 400 }}>
                        {l === 'title' ? 'Titel' : l === 'content' ? 'Inhalt' : l === 'image' ? 'Bild' : 'Leer'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Bild</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: '1px dashed rgba(96,8,18,0.25)', borderRadius: 8, cursor: 'pointer', color: '#600812', fontSize: 11 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Bild hochladen
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      const preview = URL.createObjectURL(f)
                      updateSlideField(slide.id, { imageFile: f, imagePreview: preview, imageExistingUrl: null })
                      e.target.value = ''
                    }} />
                  </label>
                  {slide.imagePreview && (
                    <button onClick={() => updateSlideField(slide.id, { imageFile: null, imagePreview: null, imageExistingUrl: null })}
                      style={{ marginTop: 5, width: '100%', padding: '4px 0', borderRadius: 6, border: '1px solid rgba(220,38,38,0.3)', background: 'transparent', color: '#dc2626', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Bild entfernen
                    </button>
                  )}
                </div>
                {praesentationSlides.length > 1 && (
                  <button onClick={() => deletePraesSlide(currentSlideIdx)}
                    style={{ padding: '6px 0', borderRadius: 8, border: '1px solid rgba(220,38,38,0.25)', background: 'transparent', color: 'rgba(220,38,38,0.65)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', marginTop: 'auto' }}>
                    Folie löschen
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* PRESENTATION FULLSCREEN */}
      {showPresentationMode && (() => {
        const slide = praesentationSlides[presentationModeSlideIdx]
        const total = praesentationSlides.length
        if (!slide) return null
        const pat = slide.pattern ? getPatternBg(slide.pattern) : null
        const goSlide = (dir: 1 | -1) => setPresentationModeSlideIdx(p => Math.max(0, Math.min(total - 1, p + dir)))
        let touchStartX = 0
        return (
          <div tabIndex={0} ref={el => el?.focus()} onKeyDown={e => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') goSlide(1)
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goSlide(-1)
            if (e.key === 'Escape') setShowPresentationMode(false)
          }} onTouchStart={e => { touchStartX = e.touches[0].clientX }}
          onTouchEnd={e => { const dx = e.changedTouches[0].clientX - touchStartX; if (Math.abs(dx) > 50) goSlide(dx < 0 ? 1 : -1) }}
          style={{ position: 'fixed', inset: 0, zIndex: 9000, background: '#000', outline: 'none', cursor: 'none' }}>
            {/* Slide */}
            <div style={{ width: '100%', height: '100%', background: slide.bg, position: 'relative', overflow: 'hidden' }}>
              {slide.imagePreview && <img src={slide.imagePreview} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />}
              {pat && <div style={{ position: 'absolute', inset: 0, backgroundImage: pat.backgroundImage, backgroundSize: pat.backgroundSize || 'auto', zIndex: 1 }} />}
              {slide.imagePreview && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.8) 0%,rgba(0,0,0,0.1) 55%,transparent 100%)', zIndex: 2 }} />}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: slide.layout === 'content' ? 'flex-end' : 'center', padding: slide.layout === 'content' ? '6vw 8vw 10vw' : '6vw 8vw', zIndex: 3, gap: '2vh' }}>
                {slide.layout !== 'blank' && slide.title && (
                  <div style={{ color: slide.textColor || '#fff', fontSize: 'clamp(28px, 5.5vw, 80px)', fontWeight: 800, fontStyle: 'italic', textAlign: 'center', lineHeight: 1.1, textShadow: slide.imagePreview ? '0 3px 16px rgba(0,0,0,0.6)' : 'none' }}>{slide.title}</div>
                )}
                {(slide.layout === 'content' || slide.layout === 'blank') && slide.body && (
                  <div style={{ color: slide.textColor || '#fff', fontSize: 'clamp(16px, 2.2vw, 32px)', textAlign: 'center', lineHeight: 1.7, opacity: 0.88, maxWidth: '80vw', textShadow: slide.imagePreview ? '0 2px 10px rgba(0,0,0,0.5)' : 'none' }}>{slide.body}</div>
                )}
              </div>
            </div>
            {/* Controls overlay (visible on hover) */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, background: 'linear-gradient(to top,rgba(0,0,0,0.7),transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 10, cursor: 'auto' }}>
              <button onClick={() => goSlide(-1)} disabled={presentationModeSlideIdx === 0}
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: presentationModeSlideIdx > 0 ? 'rgba(255,255,255,0.15)' : 'transparent', color: presentationModeSlideIdx > 0 ? '#fff' : 'rgba(255,255,255,0.2)', cursor: presentationModeSlideIdx > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {praesentationSlides.map((_, i) => (
                  <div key={i} onClick={() => setPresentationModeSlideIdx(i)}
                    style={{ width: i === presentationModeSlideIdx ? 22 : 6, height: 6, borderRadius: 3, background: i === presentationModeSlideIdx ? '#fff' : 'rgba(255,255,255,0.3)', cursor: 'pointer', transition: 'width 0.2s' }} />
                ))}
              </div>
              <button onClick={() => goSlide(1)} disabled={presentationModeSlideIdx >= total - 1}
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: presentationModeSlideIdx < total - 1 ? 'rgba(255,255,255,0.15)' : 'transparent', color: presentationModeSlideIdx < total - 1 ? '#fff' : 'rgba(255,255,255,0.2)', cursor: presentationModeSlideIdx < total - 1 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <button onClick={() => setShowPresentationMode(false)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Beenden</button>
            </div>
          </div>
        )
      })()}

      <style>{`
        .content {
          max-width: 1100px;
          margin: 0 auto;
          padding: 1rem 1.25rem;
          padding-top: 130px;
          padding-bottom: 100px;
        }

        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }

        @keyframes pulseDot {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }

        .toast {
          position: fixed;
          bottom: 32px;
          right: 24px;
          z-index: 9999;
          padding: 14px 20px;
          border-radius: 14px;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.14);
          animation: slideInRight 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          max-width: 320px;
        }

        .toast-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
        .toast-error   { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }

        .action-toolbar {
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 0.5px solid var(--border);
          padding: 0.5rem 1rem;
          display: flex;
          gap: 0.3rem;
          align-items: center;
          position: sticky;
          top: 60px;
          z-index: 99;
        }

        .action-btn {
          border: none;
          background: transparent;
          color: var(--text-secondary);
          padding: 0.45rem 0.75rem;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
        }

        .action-btn:hover {
          background: var(--bg-hover);
          color: var(--text);
        }

        .action-btn.active {
          background: var(--accent);
          color: #fff;
        }

        .action-btn.primary {
          background: var(--accent);
          color: #fff;
          margin-left: auto;
        }

        .action-btn.primary:hover { opacity: 0.85; }

        .btn-label { font-size: 13px; }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 14px;
        }

        .card {
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 16px;
          padding: 18px 18px 14px 18px;
          border: 0.5px solid var(--border);
          border-left: 4px solid transparent;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          position: relative;
          transition: all 0.2s;
          cursor: pointer;
        }

        .card.status-geplant     { border-left-color: #3b82f6; }
        .card.status-laufend     { border-left-color: #f59e0b; }
        .card.status-abgeschlossen { border-left-color: #22c55e; }
        .card.status-abgesagt    { border-left-color: #ef4444; }

        .card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          border-color: var(--border-medium);
        }
        .card.status-geplant:hover     { border-left-color: #3b82f6; }
        .card.status-laufend:hover     { border-left-color: #f59e0b; }
        .card.status-abgeschlossen:hover { border-left-color: #22c55e; }
        .card.status-abgesagt:hover    { border-left-color: #ef4444; }

        .card-menu-container {
          position: absolute;
          top: 14px;
          right: 14px;
        }

        .menu-dots {
          background: var(--bg-subtle);
          border: 0.5px solid var(--border-medium);
          border-radius: 8px;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.15s;
        }

        .menu-dots:hover {
          background: var(--bg-hover);
          color: var(--accent);
        }

        .card-menu-dropdown {
          position: absolute;
          top: 36px;
          right: 0;
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          border: 0.5px solid var(--border-medium);
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          min-width: 160px;
          overflow: hidden;
          display: none;
          flex-direction: column;
          z-index: 100;
        }

        .card-menu-dropdown.show {
          display: flex;
        }

        .menu-item {
          background: none;
          border: none;
          cursor: pointer;
          padding: 11px 16px;
          font-size: 14px;
          transition: background 0.15s;
          font-weight: 600;
          text-align: left;
          white-space: nowrap;
          color: var(--text);
          font-family: inherit;
        }

        .menu-item:hover { background: var(--bg-hover); }
        .menu-item.danger { color: #dc2626; }
        .menu-item.danger:hover { background: #fef2f2; }

        .card-type {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-bottom: 5px;
        }

        .card-name {
          font-weight: 700;
          font-size: 17px;
          margin-bottom: 6px;
          color: var(--text);
          line-height: 1.3;
          padding-right: 32px;
        }

        .card-meta {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 10px;
          line-height: 1.5;
        }

        .card-status-info { margin: 8px 0 10px; }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .status-badge.geplant      { background: #eff6ff; color: #1d4ed8; }
        .status-badge.laufend      { background: #fffbeb; color: #b45309; }
        .status-badge.abgeschlossen { background: #f0fdf4; color: #15803d; }
        .status-badge.abgesagt     { background: #fef2f2; color: #b91c1c; }
        .status-badge.lernbar      { background: #eff6ff; color: #1d4ed8; }

        .card-stats {
          display: flex;
          gap: 14px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          border-top: 0.5px solid var(--border);
          padding-top: 10px;
          margin-top: 4px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .empty-state {
          text-align: center;
          padding: 64px 20px;
          color: var(--text-secondary);
          font-size: 15px;
        }

        .modal {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal.show { display: flex; }

        .modal-content {
          background: var(--bg-card);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border-radius: 18px;
          max-width: 520px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          padding: 24px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.2);
          border: 0.5px solid var(--border);
        }

        .modal-content.large { max-width: 700px; }

        .modal-content h3 {
          margin: 0 0 16px 0;
          color: var(--accent);
          font-weight: 800;
        }

        .modal-content h4 {
          margin: 0 0 12px 0;
          color: var(--text);
          font-weight: 700;
        }

        .field { margin-bottom: 16px; }

        .field label {
          font-weight: 700;
          font-size: 12px;
          color: var(--text-secondary);
          display: block;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .field input,
        .field select,
        .field textarea {
          padding: 10px 12px;
          border: 0.5px solid var(--border-medium);
          border-radius: 10px;
          background: var(--bg);
          font-size: 15px;
          font-family: inherit;
          width: 100%;
          color: var(--text);
          transition: border-color 0.15s;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(185,28,28,0.1);
        }

        .modal-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 24px;
        }

        .btn {
          background: var(--bg-subtle);
          color: var(--text);
          padding: 10px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 700;
          transition: all 0.15s;
          font-family: inherit;
          border: 0.5px solid var(--border-medium);
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .btn:hover { background: var(--bg-hover); }
        .btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
        .btn.primary:hover { opacity: 0.85; }

        .btn-small {
          background: var(--bg-subtle);
          color: var(--text);
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.15s;
          font-family: inherit;
          border: 0.5px solid var(--border-medium);
          font-size: 12px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .btn-small:hover { background: var(--bg-hover); }
        .btn-small.danger { color: #dc2626; }
        .btn-small.danger:hover { background: #fef2f2; }
        .btn-small.primary { background: var(--accent); color: #fff; border-color: var(--accent); }

        .btn-icon {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: var(--text-secondary);
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
        }

        .btn-icon:hover { background: var(--bg-hover); color: var(--text); }
        .btn-icon.danger:hover { background: #fef2f2; color: #dc2626; }

        .tabs {
          display: flex;
          gap: 2px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 20px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .tab {
          background: none;
          border: none;
          padding: 10px 16px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          color: var(--text-secondary);
          transition: all 0.15s;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          white-space: nowrap;
          flex-shrink: 0;
          font-family: inherit;
        }

        .tab:hover { color: var(--text); }
        .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
        .tab-content { min-height: 200px; }

        .list-editor {
          background: var(--bg-subtle);
          border: 0.5px solid var(--border);
          border-radius: 10px;
          padding: 12px;
        }

        .list-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-card);
          padding: 10px 12px;
          border-radius: 8px;
          margin-bottom: 8px;
          gap: 12px;
          border: 0.5px solid var(--border);
        }

        .list-item:last-of-type { margin-bottom: 12px; }
        .add-item, .add-link { display: flex; gap: 8px; }

        .add-item input, .add-link input {
          flex: 1;
          padding: 8px 12px;
          border: 0.5px solid var(--border-medium);
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          background: var(--bg);
          color: var(--text);
        }

        .teilnehmer-list {
          border: 0.5px solid var(--border);
          border-radius: 10px;
          padding: 12px;
          background: var(--bg-subtle);
        }

        .dokument-item {
          background: var(--bg-subtle);
          padding: 12px;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          border: 0.5px solid var(--border);
        }

        .modul-item {
          background: var(--bg-subtle);
          padding: 12px;
          border-radius: 10px;
          border: 0.5px solid var(--border);
        }

        .anwesend-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        @media (max-width: 768px) {
          .action-toolbar {
            flex-wrap: nowrap;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            justify-content: flex-start;
            gap: 0.25rem;
            padding: 0.35rem 0.75rem;
            max-width: 100vw;
            box-sizing: border-box;
          }
          .action-toolbar::-webkit-scrollbar { display: none; }

          .action-btn { flex-shrink: 0; padding: 0.4rem 0.6rem; gap: 4px; }
          .action-btn svg { width: 15px; height: 15px; }
          .btn-label { display: none; }

          /* Content */
          .content {
            padding-top: 110px;
            padding-left: 12px;
            padding-right: 12px;
            padding-bottom: 72px;
            overflow-x: hidden;
          }

          .toast { bottom: 68px; right: 10px; left: 10px; max-width: none; }

          .cards-grid { grid-template-columns: 1fr; gap: 10px; }
          .card { padding: 14px 14px 12px 14px; }

          .modal { align-items: flex-end; padding: 0; }
          .modal-content {
            border-radius: 20px 20px 0 0;
            max-width: 100%;
            width: 100%;
            max-height: 85vh;
            padding: 16px 14px 0;
            box-sizing: border-box;
            overflow-x: hidden;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            display: flex;
            flex-direction: column;
          }
          .modal-content.large { max-width: 100%; }
          .modal-content h3 { font-size: 1rem; margin-bottom: 0.6rem; flex-shrink: 0; }
          .modal-content h4 { font-size: 0.9rem; }

          .field { margin-bottom: 10px; }
          .field label { font-size: 11px; margin-bottom: 4px; }
          .field input, .field select, .field textarea { padding: 8px 10px; font-size: 14px; }

          .modal-actions {
            position: sticky;
            bottom: 0;
            background: var(--bg-card);
            padding: 10px 0 calc(14px + env(safe-area-inset-bottom));
            margin-top: 8px;
            flex-shrink: 0;
          }
        }
      `}</style>

    </div>
  )
}
