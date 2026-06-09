import { useState, useEffect } from 'react'
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
}

const EDITABLE_EXTS = ['docx', 'doc', 'odt', 'rtf', 'txt', 'xlsx', 'xls', 'ods', 'csv', 'pptx', 'ppt', 'odp']

function getDocType(ext: string): 'word' | 'cell' | 'slide' {
  if (['xlsx', 'xls', 'ods', 'csv'].includes(ext)) return 'cell'
  if (['pptx', 'ppt', 'odp'].includes(ext)) return 'slide'
  return 'word'
}

function getDocColor(ext: string): string {
  if (['xlsx', 'xls', 'ods', 'csv'].includes(ext)) return '#166534'
  if (['pptx', 'ppt', 'odp'].includes(ext)) return '#9a3412'
  return '#1e40af'
}

function getBorderColor(ext: string): string {
  if (['xlsx', 'xls', 'ods', 'csv'].includes(ext)) return '#166534'
  if (['pptx', 'ppt', 'odp'].includes(ext)) return '#9a3412'
  return '#1e40af'
}

function getExtLabel(ext: string): string {
  return ext.toUpperCase()
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

function DocTypeIcon({ ext, size = 36 }: { ext: string; size?: number }) {
  const color = getDocColor(ext)
  const docType = getDocType(ext)
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: `${color}18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {docType === 'word' && (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="8" y1="13" x2="16" y2="13"/>
          <line x1="8" y1="17" x2="13" y2="17"/>
        </svg>
      )}
      {docType === 'cell' && (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="3" y1="15" x2="21" y2="15"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
          <line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
      )}
      {docType === 'slide' && (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      )}
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

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  useEffect(() => {
    if (user?.organization_id) {
      loadFiles()
    }
  }, [user])

  async function loadFiles() {
    if (!user?.organization_id) return
    try {
      setLoading(true)
      const allFiles = await pb.collection('files').getFullList<OfficeFile>({
        filter: `organization_id = "${user.organization_id}" && is_folder = false`,
        sort: '-updated',
      })
      const officeFiles = allFiles.filter(f => {
        const ext = f.file?.split('.').pop()?.toLowerCase() || ''
        return EDITABLE_EXTS.includes(ext) && f.file
      })
      setFiles(officeFiles)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showMsg('Fehler beim Laden: ' + msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Euro-Office editor integration
  useEffect(() => {
    if (!editingFile) return
    setEditorLoading(true)

    const ext = editingFile.file.split('.').pop()?.toLowerCase() || 'docx'
    const fileUrl = `${pb.baseUrl}/api/files/files/${editingFile.id}/${editingFile.file}?token=${pb.authStore.token}`
    const callbackUrl = `${pb.baseUrl}/api/office/callback?file_id=${editingFile.id}`
    const OFFICE_URL = (import.meta as unknown as { env: Record<string, string> }).env.VITE_OFFICE_URL || 'http://localhost:8090'

    const script = document.createElement('script')
    script.src = `${OFFICE_URL}/web-apps/apps/api/documents/api.js`
    script.onload = () => {
      if ((window as unknown as { DocsAPI?: { DocEditor: new (id: string, config: unknown) => void } }).DocsAPI) {
        const DocsAPI = (window as unknown as { DocsAPI: { DocEditor: new (id: string, config: unknown) => void } }).DocsAPI
        new DocsAPI.DocEditor('office-editor-container', {
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
              compactHeader: true, feedback: false, forcesave: true,
              help: false, plugins: false, toolbarNoTabs: false,
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
      try {
        const w = window as unknown as { DocsAPI?: { DocEditor?: { prototype?: { destroyEditor?: () => void } } } }
        w.DocsAPI?.DocEditor?.prototype?.destroyEditor?.call(null)
      } catch {}
      if (document.head.contains(script)) document.head.removeChild(script)
      const container = document.getElementById('office-editor-container')
      if (container) container.innerHTML = ''
    }
  }, [editingFile])

  const today = formatDate(new Date().toISOString())

  if (authLoading) return null

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
        position: 'sticky',
        top: 0,
        zIndex: 100,
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'max(20px, env(safe-area-inset-left))',
        paddingRight: 'max(20px, env(safe-area-inset-right))',
      }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#600812', padding: 4, flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: '#1a0e08' }}>Office</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{today}</div>
          </div>
          <button
            style={{
              background: '#600812',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            onClick={() => showMsg('Lade ein Office-Dokument über die Dateien-App hoch, um es hier zu öffnen.', 'success')}
          >
            Neues Dokument
          </button>
        </div>
      </div>

      {/* TOAST */}
      {msg && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(70px + env(safe-area-inset-bottom))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          padding: '10px 20px',
          borderRadius: 20,
          fontWeight: 600,
          fontSize: 13,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          whiteSpace: 'nowrap',
          maxWidth: 'calc(100vw - 40px)',
          ...(msg.type === 'error'
            ? { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }
            : { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }),
        }}>
          {msg.text}
        </div>
      )}

      {/* CONTENT */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px 120px', boxSizing: 'border-box' as const }}>

        {/* SECTION HEADER */}
        <div style={{
          fontSize: 10, fontWeight: 700, color: '#600812',
          textTransform: 'uppercase', letterSpacing: '0.14em',
          marginBottom: 10,
        }}>
          DOKUMENTE
        </div>

        {/* FILE LIST */}
        {loading ? (
          <div style={{
            textAlign: 'center', padding: '48px 16px',
            color: 'var(--warm-gray)', background: '#fff',
            borderRadius: 12, fontStyle: 'italic',
          }}>
            Lade Dokumente…
          </div>
        ) : files.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 16px',
            color: 'var(--warm-gray)', background: '#fff',
            borderRadius: 12,
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ opacity: 0.25, marginBottom: 12 }} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="13" y2="17"/>
            </svg>
            <div style={{ fontWeight: 700, marginBottom: 6, color: '#1a0e08' }}>Keine Office-Dokumente gefunden</div>
            <div style={{ fontStyle: 'italic', fontSize: 13 }}>
              Lade ein Dokument in der Dateien-App hoch, um es hier zu öffnen.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {files.map(f => {
              const ext = f.file.split('.').pop()?.toLowerCase() || 'docx'
              const borderColor = getBorderColor(ext)
              const docColor = getDocColor(ext)
              return (
                <div
                  key={f.id}
                  onClick={() => setEditingFile(f)}
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    borderLeft: `3px solid ${borderColor}`,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <DocTypeIcon ext={ext} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700, fontStyle: 'italic', fontSize: 15,
                      color: '#1a0e08', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {f.name}
                    </div>
                    <div style={{
                      fontSize: 12, color: 'var(--warm-gray)',
                      fontStyle: 'italic', marginTop: 2,
                    }}>
                      Zuletzt bearbeitet: {relativeTime(f.updated)}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    color: docColor,
                    background: `${docColor}14`,
                    padding: '3px 7px',
                    borderRadius: 5,
                    flexShrink: 0,
                  }}>
                    {getExtLabel(ext)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* FULL-SCREEN EDITOR OVERLAY */}
      {editingFile && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: '#1a1a1a',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Editor Header */}
          <div style={{
            height: 50,
            background: '#1a0e08',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 'max(16px, env(safe-area-inset-left))',
            paddingRight: 'max(16px, env(safe-area-inset-right))',
            paddingTop: 'env(safe-area-inset-top)',
            gap: 12,
            flexShrink: 0,
          }}>
            <button
              onClick={() => setEditingFile(null)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#fff', fontSize: 24, lineHeight: 1,
                padding: '0 4px', flexShrink: 0,
                fontFamily: 'inherit',
              }}
            >
              ×
            </button>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
              <span style={{
                fontStyle: 'italic', fontWeight: 700,
                color: '#fff', fontSize: 14,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                display: 'block',
              }}>
                {editingFile.name}
              </span>
            </div>
            <div style={{
              fontSize: 11, color: 'var(--warm-gray)',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              Strg+S zum Speichern
            </div>
          </div>

          {/* Editor Container */}
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
        @keyframes office-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
