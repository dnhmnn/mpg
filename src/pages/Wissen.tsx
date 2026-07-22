import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { unzip } from 'fflate'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import WissenArtikelView from '../components/WissenArtikelView'

interface Artikel {
  id: string
  collectionId: string
  titel: string
  inhalt: string
  tags: string | string[]
  bild?: string
  quelle?: string
  organization_id: string
  updated: string
}

function fileUrl(a: Artikel): string {
  return a.bild ? `${(pb as any).baseURL || (pb as any).baseUrl}/api/files/${a.collectionId}/${a.id}/${a.bild}` : ''
}
function parseTags(v: string | string[]): string[] {
  if (Array.isArray(v)) return v
  if (!v) return []
  try { const p = JSON.parse(v); if (Array.isArray(p)) return p } catch { /* kein JSON */ }
  return String(v).split(',').map(t => t.trim()).filter(Boolean)
}

const EMPTY = { titel: '', inhalt: '', tags: '', quelle: '' }

// ── Datei-/ZIP-Import: clientseitige Text-Extraktion ──────────────────────────
type EntryKind = 'pdf' | 'text' | 'image' | 'unsupported'
interface ImportEntry { name: string; kind: EntryKind; bytes: Uint8Array }
type ImpStatus = 'warten' | 'lesen' | 'ki' | 'anlegen' | 'fertig' | 'übersprungen' | 'fehler'
interface ImpRow { name: string; kind: EntryKind; status: ImpStatus; info: string; created: number }

const TEXT_EXT = /\.(txt|md|markdown|csv|log)$/i
const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i

function baseName(n: string): string { return n.split('/').pop() || n }
function isJunk(n: string): boolean {
  const b = baseName(n)
  return n.startsWith('__MACOSX/') || n.endsWith('/') || b.startsWith('.') || b.startsWith('._')
}
function classifyName(n: string): EntryKind {
  if (/\.pdf$/i.test(n)) return 'pdf'
  if (TEXT_EXT.test(n)) return 'text'
  if (IMG_EXT.test(n)) return 'image'
  return 'unsupported'
}
function imgMime(n: string): string {
  const s = n.toLowerCase()
  if (s.endsWith('.png')) return 'image/png'
  if (s.endsWith('.gif')) return 'image/gif'
  if (s.endsWith('.webp')) return 'image/webp'
  if (s.endsWith('.bmp')) return 'image/bmp'
  return 'image/jpeg'
}
function niceTitle(n: string): string {
  return (baseName(n).replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 200) || 'Ohne Titel'
}
function impStatusColor(s: ImpStatus): string {
  if (s === 'fertig') return '#16a34a'
  if (s === 'fehler') return '#dc2626'
  if (s === 'übersprungen' || s === 'warten') return '#8a7a68'
  return '#d97706'
}
function impStatusLabel(r: ImpRow): string {
  switch (r.status) {
    case 'warten': return 'wartet'
    case 'lesen': return 'liest…'
    case 'ki': return 'KI wertet aus…' + (r.info ? ' (' + r.info + ')' : '')
    case 'anlegen': return 'legt an…'
    case 'fertig': return r.info || 'fertig'
    case 'übersprungen': return 'übersprungen' + (r.info ? ' · ' + r.info : '')
    case 'fehler': return 'Fehler' + (r.info ? ' · ' + r.info : '')
    default: return ''
  }
}
function unzipAsync(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => unzip(bytes, (err, data) => (err ? reject(err) : resolve(data))))
}
async function pdfToText(bytes: Uint8Array): Promise<{ text: string; total: number; read: number }> {
  const pdfjs: any = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
  // getDocument transferiert den Buffer — deshalb eine Kopie übergeben
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
  const total = doc.numPages
  const read = Math.min(total, 120)
  let out = ''
  for (let i = 1; i <= read; i++) {
    const page = await doc.getPage(i)
    const tc = await page.getTextContent()
    out += tc.items.map((it: any) => (it && typeof it.str === 'string' ? it.str : '')).join(' ') + '\n\n'
  }
  try { await doc.destroy() } catch { /* egal */ }
  return { text: out, total, read }
}
function chunkText(text: string, size = 8000): string[] {
  const clean = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []
  if (clean.length <= size) return [clean]
  const out: string[] = []
  let cur = ''
  for (const para of clean.split(/\n\n+/)) {
    let p = para
    while (p.length > size) { if (cur) { out.push(cur); cur = '' } out.push(p.slice(0, size)); p = p.slice(size) }
    if ((cur + '\n\n' + p).length > size && cur) { out.push(cur); cur = p }
    else cur = cur ? cur + '\n\n' + p : p
  }
  if (cur.trim()) out.push(cur)
  return out
}
async function expandFiles(files: File[]): Promise<ImportEntry[]> {
  const entries: ImportEntry[] = []
  for (const f of files) {
    const isZip = /\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed'
    if (isZip) {
      let map: Record<string, Uint8Array> = {}
      try { map = await unzipAsync(new Uint8Array(await f.arrayBuffer())) }
      catch { entries.push({ name: f.name, kind: 'unsupported', bytes: new Uint8Array() }); continue }
      for (const [name, bytes] of Object.entries(map)) {
        if (isJunk(name) || !bytes.length) continue
        entries.push({ name: baseName(name), kind: classifyName(name), bytes })
      }
    } else {
      entries.push({ name: f.name, kind: classifyName(f.name), bytes: new Uint8Array(await f.arrayBuffer()) })
    }
  }
  return entries
}

export default function Wissen() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [artikel, setArtikel] = useState<Artikel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [search, setSearch] = useState('')

  const [editorOpen, setEditorOpen] = useState(false)
  const [viewing, setViewing] = useState<Artikel | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [removeBild, setRemoveBild] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Import
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [impStarted, setImpStarted] = useState(false)
  const [impRows, setImpRows] = useState<ImpRow[]>([])
  const [impCreated, setImpCreated] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [impConfirm, setImpConfirm] = useState(false)
  const [stopping, setStopping] = useState(false)
  const impEntriesRef = useRef<ImportEntry[]>([])
  const impFileRef = useRef<HTMLInputElement>(null)
  const impCancelRef = useRef(false)

  useEffect(() => {
    if (!authLoading && user && !user.supervisor) navigate('/hub')
  }, [authLoading, user, navigate])

  useEffect(() => { if (user?.organization_id) load() }, [user])

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMsg({ text, type }); setTimeout(() => setMsg(null), 3500)
  }

  async function load() {
    if (!user?.organization_id) return
    try {
      setLoading(true); setError('')
      const list = await pb.collection('wissen').getFullList<Artikel>({
        filter: `organization_id = "${user.organization_id}"`, sort: '-updated', requestKey: `wissen-${Date.now()}`,
      })
      setArtikel(list)
    } catch (e: any) {
      setError('Fehler beim Laden — existiert die Collection "wissen" in PocketBase?')
    } finally { setLoading(false) }
  }

  function openNew() {
    setEditingId(null); setForm({ ...EMPTY }); setFile(null); setPreview(''); setRemoveBild(false); setEditorOpen(true)
  }
  function openEdit(a: Artikel) {
    setEditingId(a.id)
    setForm({ titel: a.titel, inhalt: a.inhalt, tags: parseTags(a.tags).join(', '), quelle: a.quelle || '' })
    setFile(null); setPreview(fileUrl(a)); setRemoveBild(false); setEditorOpen(true)
  }
  function pickFile(f: File | undefined) { if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setRemoveBild(false) } }

  async function save() {
    if (!user) return
    if (!form.titel.trim() && !form.inhalt.trim()) { alert('Titel oder Inhalt eingeben.'); return }
    if (saving) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('titel', form.titel.trim())
      fd.append('inhalt', form.inhalt)
      fd.append('tags', JSON.stringify(form.tags.split(',').map(t => t.trim()).filter(Boolean)))
      fd.append('quelle', form.quelle.trim())
      fd.append('organization_id', user.organization_id || '')
      if (file) fd.append('bild', file)
      else if (removeBild) fd.append('bild', '')
      if (editingId) { await pb.collection('wissen').update(editingId, fd); showMsg('✅ Artikel gespeichert!') }
      else { await pb.collection('wissen').create(fd); showMsg('✅ Artikel angelegt!') }
      setEditorOpen(false)
      await load()
    } catch (e: any) {
      alert('Fehler: ' + (e?.data ? JSON.stringify(e.data) : e.message) + '\n\nFalls die Collection "wissen" fehlt, bitte erst in PocketBase anlegen.')
    } finally { setSaving(false) }
  }

  // ── Import ──────────────────────────────────────────────────────────────
  function openImport() {
    setImportOpen(true); setImporting(false); setImpStarted(false); setImpCreated(0); setImpRows([]); setImpConfirm(false); setStopping(false)
    impEntriesRef.current = []; impCancelRef.current = false
  }
  async function onImportFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length || importing) return
    const files = Array.from(fileList)
    // Nach einem abgeschlossenen Lauf beginnt eine neue Auswahl frisch; davor wird angehängt
    const prev = impStarted ? [] : impEntriesRef.current
    setImpStarted(false); setImpCreated(0)
    if (!prev.length) setImpRows([{ name: 'Dateien werden gelesen…', kind: 'unsupported', status: 'lesen', info: '', created: 0 }])
    let fresh: ImportEntry[] = []
    try { fresh = await expandFiles(files) } catch { fresh = [] }
    // an bestehende Auswahl anhängen, nach Name deduplizieren
    const seen = new Set(prev.map(e => e.name))
    const merged = [...prev]
    let added = 0
    for (const en of fresh) { if (!seen.has(en.name)) { seen.add(en.name); merged.push(en); added++ } }
    // Verwertbares zuerst, Nicht-Unterstütztes ans Ende
    const order: Record<EntryKind, number> = { pdf: 0, text: 0, image: 1, unsupported: 2 }
    merged.sort((a, b) => order[a.kind] - order[b.kind])
    impEntriesRef.current = merged
    if (!merged.length) {
      setImpRows([{ name: 'Keine verwertbaren Dateien gefunden', kind: 'unsupported', status: 'fehler', info: 'ZIP leer oder nur nicht unterstützte Dateien', created: 0 }])
      return
    }
    setImpRows(merged.map(en => ({
      name: en.name, kind: en.kind,
      status: en.kind === 'unsupported' ? 'übersprungen' : 'warten',
      info: en.kind === 'unsupported' ? 'nicht unterstützt' : '', created: 0,
    })))
    if (added === 0) showMsg('Keine neuen verwertbaren Dateien gefunden', 'error')
  }
  function cancelImport() { impCancelRef.current = true; setStopping(true) }
  async function createWissenArticle(titel: string, inhalt: string, tags: string[], quelle: string, bild?: File) {
    const fd = new FormData()
    fd.append('titel', (titel || '').slice(0, 200))
    fd.append('inhalt', inhalt || '')
    fd.append('tags', JSON.stringify((tags || []).slice(0, 8)))
    fd.append('quelle', ('Import: ' + quelle).slice(0, 200))
    fd.append('organization_id', user!.organization_id || '')
    if (bild) fd.append('bild', bild)
    await pb.collection('wissen').create(fd)
  }
  async function runImport() {
    if (!user || importing) return
    const entries = impEntriesRef.current
    if (!entries.length) return
    impCancelRef.current = false; setStopping(false)
    setImporting(true); setImpStarted(true)
    let total = 0
    let cancelled = false
    const update = (i: number, patch: Partial<ImpRow>) => setImpRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
    for (let i = 0; i < entries.length; i++) {
      if (impCancelRef.current) { cancelled = true; update(i, { status: 'übersprungen', info: 'abgebrochen' }); continue }
      const en = entries[i]
      let made = 0
      try {
        if (en.kind === 'unsupported') { update(i, { status: 'übersprungen', info: 'nicht unterstützt' }); continue }
        if (en.kind === 'image') {
          update(i, { status: 'anlegen' })
          const bild = new File([en.bytes.slice().buffer as ArrayBuffer], en.name, { type: imgMime(en.name) })
          await createWissenArticle(niceTitle(en.name), '', [], en.name, bild)
          made = 1; total += 1; setImpCreated(total)
          update(i, { status: 'fertig', info: 'als Abbildung angelegt', created: 1 })
          continue
        }
        // pdf / text
        update(i, { status: 'lesen' })
        let text = ''; let pageNote = ''
        if (en.kind === 'pdf') {
          const r = await pdfToText(en.bytes)
          text = r.text
          if (r.total > r.read) pageNote = ' · nur erste ' + r.read + ' von ' + r.total + ' Seiten'
        } else {
          text = new TextDecoder('utf-8', { fatal: false }).decode(en.bytes)
        }
        const chunks = chunkText(text)
        if (!chunks.length || text.trim().length < 40) {
          update(i, { status: 'übersprungen', info: en.kind === 'pdf' ? 'kein Text (evtl. Scan/Bild-PDF)' : 'kein Text' }); continue
        }
        update(i, { status: 'ki', info: chunks.length > 1 ? chunks.length + ' Abschnitte' : '' })
        for (const chunk of chunks) {
          if (impCancelRef.current) break
          const res = await pb.send('/ki/wissen-import', { method: 'POST', body: { dateiname: en.name, text: chunk } }) as
            { success?: boolean; eintraege?: { titel: string; inhalt: string; tags: string[] }[]; error?: string }
          const list = res && res.success && Array.isArray(res.eintraege) ? res.eintraege : []
          for (const it of list) {
            if (!it || !(it.inhalt || '').trim()) continue
            update(i, { status: 'anlegen' })
            await createWissenArticle(it.titel, it.inhalt, it.tags || [], en.name)
            made += 1; total += 1; setImpCreated(total)
          }
        }
        if (impCancelRef.current) { cancelled = true; update(i, { status: made > 0 ? 'fertig' : 'übersprungen', info: made > 0 ? made + ' angelegt (abgebrochen)' : 'abgebrochen', created: made }) }
        else if (made === 0) update(i, { status: 'übersprungen', info: 'kein Fachinhalt erkannt' })
        else update(i, { status: 'fertig', info: made + ' Eintrag' + (made === 1 ? '' : 'e') + pageNote, created: made })
      } catch (err: any) {
        const m = err?.message || (err?.data ? JSON.stringify(err.data) : '') || 'Fehler'
        update(i, { status: 'fehler', info: (made > 0 ? made + ' angelegt, dann ' : '') + String(m).slice(0, 120), created: made })
      } finally {
        entries[i].bytes = new Uint8Array() // Speicher je Datei freigeben
      }
    }
    setImporting(false)
    await load()
    if (total > 0) showMsg('✅ ' + total + ' Wissenseintrag' + (total === 1 ? '' : 'e') + ' angelegt' + (cancelled ? ' (abgebrochen)' : '') + '!')
    else showMsg(cancelled ? 'Import abgebrochen' : 'Keine Einträge angelegt', 'error')
  }

  async function del() {
    if (!editingId) return
    if (!confirm('Diesen Wissensartikel wirklich löschen?')) return
    try { await pb.collection('wissen').delete(editingId); setEditorOpen(false); showMsg('✅ Gelöscht!'); await load() }
    catch (e: any) { alert('Fehler: ' + e.message) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return artikel
    return artikel.filter(a => a.titel.toLowerCase().includes(q) || a.inhalt.toLowerCase().includes(q) || parseTags(a.tags).some(t => t.toLowerCase().includes(q)))
  }, [artikel, search])

  if (authLoading) return null

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', position: 'sticky', top: 0, zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/supervisor')} style={{ display: 'flex', border: 'none', background: 'none', color: '#600812', cursor: 'pointer', padding: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>Wissensbasis</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>Grundlage des KI-Assistenten · nur Supervisor</div>
          </div>
          <button onClick={openImport} title="Dateien / ZIP importieren" style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(96,8,18,0.25)', borderRadius: 10, background: 'transparent', color: '#600812', padding: '9px 13px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import
          </button>
          <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 10, background: '#600812', color: '#fff', padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Artikel
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 500, background: msg.type === 'success' ? '#16a34a' : '#dc2626', color: '#fff', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>{msg.text}</div>
      )}

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 16px 80px' }}>
        <div style={{ background: 'rgba(96,8,18,0.04)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--lbf-text)', lineHeight: 1.55, marginBottom: 16 }}>
          Diese Wissensbasis ist die Grundlage, aus der der Lern-Assistent antwortet. Je mehr saubere, fachlich geprüfte Artikel (mit Schlagwörtern und ggf. Bild), desto besser die Antworten. Importierte Einträge bitte vor dem Verlassen darauf prüfen.
        </div>

        <input type="text" placeholder="Wissensbasis durchsuchen…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 14, borderRadius: 12, marginBottom: 16, fontWeight: 600 }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Lade…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', background: 'var(--lbf-card)', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--lbf-text)' }}>{artikel.length === 0 ? 'Noch keine Artikel' : 'Kein Treffer'}</div>
            <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)' }}>{artikel.length === 0 ? 'Lege mit „Artikel" den ersten Wissenseintrag an.' : 'Suchbegriff anpassen.'}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(a => (
              <div key={a.id} onClick={() => setViewing(a)} style={{ display: 'flex', gap: 12, background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '3px solid #600812', padding: '12px 14px', cursor: 'pointer' }}>
                {fileUrl(a) && <img src={fileUrl(a)} alt="" style={{ width: 54, height: 54, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#fff', border: '0.5px solid rgba(96,8,18,0.1)' }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 15, color: 'var(--lbf-text)' }}>{a.titel || '(ohne Titel)'}</div>
                  <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.inhalt.replace(/^#{2,3}\s+/gm, '').replace(/^!!!\s*\w+[:\s]*/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()}</div>
                  {parseTags(a.tags).length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {parseTags(a.tags).slice(0, 6).map(t => <span key={t} style={{ fontStyle: 'italic', fontWeight: 700, color: '#600812', fontSize: 12 }}>#{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Artikel-Leseansicht (Nachschlagewerk-Stil) */}
      {viewing && (
        <WissenArtikelView
          titel={viewing.titel}
          inhalt={viewing.inhalt}
          tags={parseTags(viewing.tags)}
          bildUrl={fileUrl(viewing) || undefined}
          quelle={viewing.quelle || undefined}
          onEdit={() => { const a = viewing; setViewing(null); openEdit(a) }}
          onClose={() => setViewing(null)}
        />
      )}

      {/* Editor */}
      {editorOpen && (
        <div onClick={() => setEditorOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--lbf-card)', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 620, maxHeight: '92dvh', overflowY: 'auto', padding: '18px 18px calc(20px + env(safe-area-inset-bottom))' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>{editingId ? 'Artikel bearbeiten' : 'Neuer Wissensartikel'}</div>

            <input type="text" value={form.titel} onChange={e => setForm({ ...form, titel: e.target.value })} placeholder="Titel (z.B. Sinustachykardie)"
              style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontStyle: 'italic', fontWeight: 700, fontSize: 19, color: 'var(--lbf-text)', fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box' }} />

            {/* Bild */}
            <div onClick={() => fileRef.current?.click()} style={{ border: '1.5px dashed rgba(96,8,18,0.3)', borderRadius: 12, padding: preview ? 0 : '22px', textAlign: 'center', cursor: 'pointer', marginBottom: 12, overflow: 'hidden', position: 'relative' }}>
              {preview ? <img src={preview} alt="" style={{ width: '100%', display: 'block', maxHeight: 240, objectFit: 'contain', background: '#fff' }} /> : <span style={{ fontSize: 13, fontWeight: 700, color: '#600812' }}>Bild hinzufügen (optional)</span>}
            </div>
            {preview && <button onClick={() => { setFile(null); setPreview(''); setRemoveBild(true) }} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 12, padding: 0, fontFamily: 'inherit' }}>Bild entfernen</button>}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pickFile(e.target.files?.[0])} />

            <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>Inhalt</label>
            <textarea value={form.inhalt} onChange={e => setForm({ ...form, inhalt: e.target.value })} rows={9} placeholder={'Der Fachtext, aus dem die KI antwortet…\n\n## Definition\n…\n\n## Therapie\n- Punkt 1\n\n!!! cave Wichtige Warnung'}
              style={{ width: '100%', padding: '11px 13px', borderRadius: 9, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontSize: 14, lineHeight: 1.6, fontFamily: 'inherit', outline: 'none', resize: 'vertical', minHeight: 160, boxSizing: 'border-box', marginBottom: 4 }} />
            <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginBottom: 12, lineHeight: 1.5 }}>
              Struktur wie im Nachschlagewerk: <b>## Abschnitt</b> = aufklappbares Kapitel · <b>!!! cave</b> = rote Warn-Box · <b>!!! merke</b> = Merke-Box · <b>!!! tipp</b> = Tipp-Box · <b>- </b> = Aufzählung · <b>**fett**</b>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>Schlagwörter (Komma-getrennt)</label>
              <input type="text" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="EKG, Tachykardie, Rhythmus"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Wichtig — daran findet die KI den Artikel zur Frage.</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>Quelle / Lizenz (optional)</label>
              <input type="text" value={form.quelle} onChange={e => setForm({ ...form, quelle: e.target.value })} placeholder="z.B. eigene SOP / ERC-Leitlinie 2021"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {editingId && <button onClick={del} style={{ border: '1px solid rgba(220,38,38,0.3)', background: 'transparent', color: '#dc2626', borderRadius: 10, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Löschen</button>}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => setEditorOpen(false)} style={{ border: '1px solid rgba(96,8,18,0.2)', background: 'transparent', color: 'var(--warm-gray)', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
                <button onClick={save} disabled={saving} style={{ border: 'none', background: '#600812', color: '#fff', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>{saving ? 'Speichern…' : 'Speichern'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import-Modal */}
      {importOpen && (
        <div onClick={() => { if (!importing) setImportOpen(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--lbf-card)', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 620, maxHeight: '92dvh', overflowY: 'auto', padding: '18px 18px calc(20px + env(safe-area-inset-bottom))' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Dateien / ZIP importieren</div>
            <div style={{ fontSize: 13, color: 'var(--lbf-text)', lineHeight: 1.5, marginBottom: 14 }}>
              Lade PDF-, Text- oder Bild-Dateien (auch als ZIP) hoch. Die KI liest den Text automatisch aus und macht daraus fertige Wissenseinträge — Titel, Kurzfassung und Schlagwörter. Bilder werden als Abbildungen übernommen.
            </div>

            {/* Dropzone */}
            <div
              onClick={() => { if (!importing) impFileRef.current?.click() }}
              onDragOver={e => { e.preventDefault(); if (!importing) setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); if (!importing) onImportFiles(e.dataTransfer.files) }}
              style={{ border: `1.5px dashed ${dragOver ? '#600812' : 'rgba(96,8,18,0.3)'}`, borderRadius: 12, padding: '22px', textAlign: 'center', cursor: importing ? 'default' : 'pointer', marginBottom: 14, background: dragOver ? 'rgba(96,8,18,0.04)' : 'transparent' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#600812' }}>Dateien wählen oder hierher ziehen</div>
              <div style={{ fontSize: 11.5, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 3 }}>ZIP · PDF · TXT · MD · CSV · PNG/JPG — mehrere gleichzeitig möglich</div>
            </div>
            <input ref={impFileRef} type="file" multiple accept=".zip,.pdf,.txt,.md,.markdown,.csv,.log,image/*" style={{ display: 'none' }}
              onChange={e => { const t = e.target; onImportFiles(t.files).finally(() => { t.value = '' }) }} />

            {/* Liste */}
            {impRows.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, maxHeight: '38dvh', overflowY: 'auto' }}>
                {impRows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(96,8,18,0.03)', borderRadius: 9, padding: '8px 11px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: impStatusColor(r.status), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lbf-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ fontSize: 11, fontStyle: 'italic', color: impStatusColor(r.status) }}>{impStatusLabel(r)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {impRows.length > 0 && (
              <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginBottom: 10, lineHeight: 1.45 }}>
                Die KI strukturiert den hochgeladenen Text — sie kann dabei Fehler machen. Bitte jeden erzeugten Eintrag prüfen, bevor du dich darauf verlässt. Lade nur Material hoch, das du verwenden darfst.
              </div>
            )}

            {impRows.length > 0 && !(impStarted && !importing) && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14, cursor: importing ? 'default' : 'pointer' }}>
                <input type="checkbox" checked={impConfirm} disabled={importing} onChange={e => setImpConfirm(e.target.checked)}
                  style={{ marginTop: 2, width: 16, height: 16, accentColor: '#600812', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--lbf-text)', lineHeight: 1.4 }}>
                  Ich bestätige, dass die Dateien <b>keine Patienten- oder Personendaten</b> enthalten. Der Text wird zur Auswertung an Mistral (EU) gesendet.
                </span>
              </label>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {importing && <span style={{ fontSize: 12, fontWeight: 700, color: '#600812' }}>{impCreated} angelegt…</span>}
              {!importing && impStarted && <span style={{ fontSize: 12, fontWeight: 700, color: impCreated > 0 ? '#16a34a' : 'var(--warm-gray)' }}>{impCreated} Einträge angelegt</span>}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {importing ? (
                  <button onClick={cancelImport} disabled={stopping} style={{ border: '1px solid rgba(220,38,38,0.4)', background: 'transparent', color: '#dc2626', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: stopping ? 'default' : 'pointer', opacity: stopping ? 0.6 : 1, fontFamily: 'inherit' }}>{stopping ? 'Stoppt…' : 'Stopp'}</button>
                ) : (
                  <button onClick={() => setImportOpen(false)} style={{ border: '1px solid rgba(96,8,18,0.2)', background: 'transparent', color: 'var(--warm-gray)', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{impStarted ? 'Schließen' : 'Abbrechen'}</button>
                )}
                {!(impStarted && !importing) && (
                  <button onClick={runImport} disabled={importing || !impConfirm || impRows.filter(r => r.kind !== 'unsupported').length === 0}
                    style={{ border: 'none', background: '#600812', color: '#fff', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: (importing || !impConfirm || impRows.filter(r => r.kind !== 'unsupported').length === 0) ? 'not-allowed' : 'pointer', opacity: (importing || !impConfirm || impRows.filter(r => r.kind !== 'unsupported').length === 0) ? 0.6 : 1, fontFamily: 'inherit' }}>
                    {importing ? 'Wertet aus…' : 'Auswerten & anlegen'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
