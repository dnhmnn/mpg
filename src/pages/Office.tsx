import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'

interface OfficeFile {
  id: string
  name: string
  file: string
  file_type?: string
  file_size?: number
  created: string
  updated: string
  collectionId: string
  organization_id?: string
}

const EDITABLE_EXTS = ['docx', 'doc', 'odt', 'rtf', 'txt', 'xlsx', 'xls', 'ods', 'csv', 'pptx', 'ppt', 'odp']
const OFFICE_URL = (import.meta as unknown as { env: Record<string, string> }).env.VITE_OFFICE_URL || 'http://localhost:8090'
const RECENT_KEY = 'office_recent'

type DocCategory = 'word' | 'cell' | 'slide'

function getDocType(ext: string): DocCategory {
  if (['xlsx', 'xls', 'ods', 'csv'].includes(ext)) return 'cell'
  if (['pptx', 'ppt', 'odp'].includes(ext)) return 'slide'
  return 'word'
}

function getDocColor(type: DocCategory | string): string {
  if (type === 'cell') return '#166534'
  if (type === 'slide') return '#9a3412'
  return '#1e40af'
}

function getBorderColor(ext: string): string {
  return getDocColor(getDocType(ext))
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  if (days < 7) return `vor ${days} Tag${days === 1 ? '' : 'en'}`
  return new Date(dateStr).toLocaleDateString('de-DE')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

function DocTypeIcon({ type, size = 36 }: { type: DocCategory; size?: number }) {
  const color = getDocColor(type)
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: `${color}18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {type === 'word' && (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="8" y1="13" x2="16" y2="13"/>
          <line x1="8" y1="17" x2="13" y2="17"/>
        </svg>
      )}
      {type === 'cell' && (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="3" y1="15" x2="21" y2="15"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
          <line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
      )}
      {type === 'slide' && (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      )}
    </div>
  )
}

function FileCard({ f, onClick }: { f: OfficeFile; onClick: () => void }) {
  const ext = f.file.split('.').pop()?.toLowerCase() || 'docx'
  const type = getDocType(ext)
  const borderColor = getBorderColor(ext)
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      borderLeft: `3px solid ${borderColor}`,
      padding: '12px 14px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <DocTypeIcon type={type} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontStyle: 'italic', fontSize: 15,
          color: '#1a0e08', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{f.name}</div>
        <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 2 }}>
          {relativeTime(f.updated)}
        </div>
      </div>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const,
        letterSpacing: '0.08em', color: getDocColor(type),
        background: `${getDocColor(type)}14`,
        padding: '3px 7px', borderRadius: 5, flexShrink: 0,
      }}>
        {ext.toUpperCase()}
      </div>
    </div>
  )
}

export default function Office() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [files, setFiles] = useState<OfficeFile[]>([])
  const [loading, setLoading] = useState(true)
  const [editingFile, setEditingFile] = useState<OfficeFile | null>(null)
  const [editorLoading, setEditorLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [createType, setCreateType] = useState<DocCategory | null>(null)
  const [newDocName, setNewDocName] = useState('')
  const [creating, setCreating] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  useEffect(() => {
    if (user?.organization_id) loadFiles()
  }, [user])

  useEffect(() => {
    const saved = localStorage.getItem(RECENT_KEY)
    if (saved) setRecentIds(JSON.parse(saved))
  }, [])

  useEffect(() => {
    if (createType) {
      const defaults: Record<DocCategory, string> = {
        word: 'Neues Dokument',
        cell: 'Neue Tabelle',
        slide: 'Neue Präsentation',
      }
      setNewDocName(defaults[createType])
      setTimeout(() => nameInputRef.current?.focus(), 100)
    }
  }, [createType])

  async function loadFiles() {
    if (!user?.organization_id) return
    try {
      setLoading(true)
      const allFiles = await pb.collection('files').getFullList<OfficeFile>({
        filter: `organization_id = "${user.organization_id}" && is_folder = false`,
        sort: '-updated',
      })
      setFiles(allFiles.filter(f => {
        const ext = f.file?.split('.').pop()?.toLowerCase() || ''
        return EDITABLE_EXTS.includes(ext) && f.file
      }))
    } catch (e: unknown) {
      showMsg('Fehler beim Laden: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally {
      setLoading(false)
    }
  }

  function trackRecent(id: string) {
    setRecentIds(prev => {
      const updated = [id, ...prev.filter(x => x !== id)].slice(0, 10)
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
      return updated
    })
  }

  function openFile(f: OfficeFile) {
    trackRecent(f.id)
    setEditingFile(f)
  }

  async function createNewDoc() {
    if (!createType || !newDocName.trim() || !user?.organization_id) return
    setCreating(true)
    try {
      const extMap: Record<DocCategory, string> = { word: 'docx', cell: 'xlsx', slide: 'pptx' }
      const ext = extMap[createType]
      const templateUrl = `${OFFICE_URL}/empty/${ext}`

      const res = await fetch(templateUrl)
      if (!res.ok) throw new Error('Vorlage nicht erreichbar')
      const blob = await res.blob()

      const fileName = newDocName.trim().replace(/\.[^.]+$/, '') + '.' + ext
      const formData = new FormData()
      formData.append('file', blob, fileName)
      formData.append('name', fileName)
      formData.append('organization_id', user.organization_id)
      formData.append('is_folder', 'false')

      const created = await pb.collection('files').create<OfficeFile>(formData)
      setCreateType(null)
      await loadFiles()
      openFile(created)
    } catch {
      showMsg('Vorlage nicht verfügbar — bitte erst Server-Setup abschließen.', 'error')
      setCreateType(null)
    } finally {
      setCreating(false)
    }
  }

  // Editor integration
  useEffect(() => {
    if (!editingFile) return
    setEditorLoading(true)

    const ext = editingFile.file.split('.').pop()?.toLowerCase() || 'docx'
    const fileUrl = `${pb.baseUrl}/api/files/files/${editingFile.id}/${editingFile.file}?token=${pb.authStore.token}`
    const callbackUrl = `${pb.baseUrl}/api/office/callback?file_id=${editingFile.id}`

    const script = document.createElement('script')
    script.src = `${OFFICE_URL}/web-apps/apps/api/documents/api.js`
    script.onload = () => {
      const w = window as unknown as { DocsAPI?: { DocEditor: new (id: string, config: unknown) => void } }
      if (w.DocsAPI) {
        new w.DocsAPI.DocEditor('office-editor-container', {
          document: {
            fileType: ext,
            key: `${editingFile.id}_${new Date(editingFile.updated).getTime()}`,
            title: editingFile.name,
            url: fileUrl,
          },
          documentType: getDocType(ext),
          editorConfig: {
            callbackUrl,
            user: { id: user?.id || '', name: user?.name || '' },
            lang: 'de',
            customization: {
              autosave: true, chat: false, comments: true,
              compactHeader: false, feedback: false, forcesave: true,
              help: false, plugins: false,
              uiTheme: 'theme-lbf',
              logo: {
                image: 'https://app.responda.systems/logoklein.svg',
                imageDark: 'https://app.responda.systems/logoklein.svg',
                url: 'https://app.responda.systems/office',
              },
            },
          },
          events: {
            onAppReady: () => setEditorLoading(false),
            onDocumentReady: () => setEditorLoading(false),
            onError: (event: unknown) => {
              setEditorLoading(false)
              const e = event as { data?: { errorDescription?: string } }
              showMsg('Editor-Fehler: ' + (e?.data?.errorDescription || 'Unbekannter Fehler'), 'error')
              setEditingFile(null)
            },
          },
        })
      }
    }
    script.onerror = () => {
      setEditorLoading(false)
      showMsg('Euro-Office Server nicht erreichbar. Prüfe VITE_OFFICE_URL.', 'error')
    }
    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) document.head.removeChild(script)
      const container = document.getElementById('office-editor-container')
      if (container) container.innerHTML = ''
    }
  }, [editingFile])

  const today = formatDate(new Date().toISOString())
  const recentFiles = recentIds.map(id => files.find(f => f.id === id)).filter(Boolean) as OfficeFile[]
  const allFiles = files

  if (authLoading) return null

  const CREATE_OPTIONS: { type: DocCategory; label: string; sub: string }[] = [
    { type: 'word', label: 'Dokument', sub: 'Word' },
    { type: 'cell', label: 'Tabelle', sub: 'Excel' },
    { type: 'slide', label: 'Präsentation', sub: 'PowerPoint' },
  ]

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--warm-bg)',
      fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif",
    }}>

      {/* MASTHEAD */}
      <div style={{
        background: '#fff',
        borderBottom: '0.5px solid rgba(96,8,18,0.12)',
        position: 'sticky', top: 0, zIndex: 100,
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'max(20px, env(safe-area-inset-left))',
        paddingRight: 'max(20px, env(safe-area-inset-right))',
      }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#600812', padding: 4, flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: '#1a0e08' }}>Office</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{today}</div>
          </div>
        </div>
      </div>

      {/* TOAST */}
      {msg && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(70px + env(safe-area-inset-bottom))',
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, padding: '10px 20px', borderRadius: 20,
          fontWeight: 600, fontSize: 13,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 40px)',
          ...(msg.type === 'error'
            ? { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }
            : { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }),
        }}>
          {msg.text}
        </div>
      )}

      {/* CONTENT */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px 120px', boxSizing: 'border-box' as const }}>

        {/* NEU ERSTELLEN */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>
          NEU ERSTELLEN
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 28 }}>
          {CREATE_OPTIONS.map(({ type, label, sub }) => {
            const color = getDocColor(type)
            return (
              <button
                key={type}
                onClick={() => setCreateType(type)}
                style={{
                  background: '#fff', border: 'none', borderRadius: 12,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  borderTop: `3px solid ${color}`,
                  padding: '14px 10px 12px',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'transform .12s',
                }}
                onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)' }}
                onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
              >
                <DocTypeIcon type={type} size={40} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a0e08' }}>{label}</div>
                  <div style={{ fontSize: 10, color: 'var(--warm-gray)', fontStyle: 'italic' }}>{sub}</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* ZULETZT VERWENDET */}
        {recentFiles.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>
              ZULETZT VERWENDET
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
              {recentFiles.slice(0, 5).map(f => (
                <FileCard key={f.id} f={f} onClick={() => openFile(f)} />
              ))}
            </div>
          </>
        )}

        {/* ALLE DOKUMENTE */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>
          ALLE DOKUMENTE
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--warm-gray)', background: '#fff', borderRadius: 12, fontStyle: 'italic' }}>
            Lade Dokumente…
          </div>
        ) : allFiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--warm-gray)', background: '#fff', borderRadius: 12 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ opacity: 0.25, marginBottom: 12 }} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <div style={{ fontWeight: 700, marginBottom: 6, color: '#1a0e08' }}>Keine Office-Dokumente</div>
            <div style={{ fontStyle: 'italic', fontSize: 13 }}>Erstelle ein neues Dokument oder lade eines in der Dateien-App hoch.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allFiles.map(f => (
              <FileCard key={f.id} f={f} onClick={() => openFile(f)} />
            ))}
          </div>
        )}
      </div>

      {/* NEU ERSTELLEN MODAL */}
      {createType && (
        <>
          <div onClick={() => setCreateType(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400 }} />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 401,
            background: '#fff', borderRadius: '20px 20px 0 0',
            padding: '24px 20px',
            paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(96,8,18,0.15)', margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <DocTypeIcon type={createType} size={44} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: '#1a0e08' }}>
                  {createType === 'word' ? 'Neues Dokument' : createType === 'cell' ? 'Neue Tabelle' : 'Neue Präsentation'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
                  {createType === 'word' ? '.docx' : createType === 'cell' ? '.xlsx' : '.pptx'}
                </div>
              </div>
            </div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', display: 'block', marginBottom: 8 }}>
              NAME
            </label>
            <input
              ref={nameInputRef}
              value={newDocName}
              onChange={e => setNewDocName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createNewDoc()}
              style={{
                width: '100%', boxSizing: 'border-box' as const,
                border: '1.5px solid rgba(96,8,18,0.2)', borderRadius: 10,
                padding: '12px 14px', fontSize: 15, fontFamily: 'inherit',
                fontStyle: 'italic', outline: 'none',
                background: 'var(--warm-bg)', color: '#1a0e08',
                marginBottom: 16,
              }}
            />
            <button
              onClick={createNewDoc}
              disabled={creating || !newDocName.trim()}
              style={{
                width: '100%', background: creating || !newDocName.trim() ? 'rgba(96,8,18,0.3)' : '#600812',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '14px', fontSize: 15, fontWeight: 700,
                fontFamily: 'inherit', cursor: creating || !newDocName.trim() ? 'default' : 'pointer',
              }}
            >
              {creating ? 'Erstelle…' : 'Erstellen'}
            </button>
          </div>
        </>
      )}

      {/* FULL-SCREEN EDITOR OVERLAY */}
      {editingFile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#1a1a1a', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            height: 50, background: '#1a0e08',
            display: 'flex', alignItems: 'center',
            paddingLeft: 'max(16px, env(safe-area-inset-left))',
            paddingRight: 'max(16px, env(safe-area-inset-right))',
            paddingTop: 'env(safe-area-inset-top)',
            gap: 12, flexShrink: 0,
          }}>
            <button onClick={() => setEditingFile(null)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#fff', fontSize: 24, lineHeight: 1,
              padding: '0 4px', flexShrink: 0, fontFamily: 'inherit',
            }}>×</button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontStyle: 'italic', fontWeight: 700, color: '#fff', fontSize: 14 }}>
                {editingFile.name}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>Strg+S</div>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            {editorLoading && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: '#1a1a1a', zIndex: 10,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.15)',
                  borderTopColor: '#fff',
                  animation: 'office-spin 0.8s linear infinite',
                  marginBottom: 16,
                }} />
                <div style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                  Editor lädt…
                </div>
              </div>
            )}
            <div id="office-editor-container" style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes office-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
