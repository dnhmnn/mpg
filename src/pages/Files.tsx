import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'

const EDITABLE_EXTS = ['docx', 'doc', 'odt', 'rtf', 'txt', 'xlsx', 'xls', 'ods', 'csv', 'pptx', 'ppt', 'odp']

interface FileItem {
  id: string
  name: string
  is_folder: boolean
  parent_folder_id: string
  organization_id: string
  file?: string
  file_size?: number
  file_type?: string
  created: string
}

interface FolderPath {
  id: string
  name: string
}

export default function Files() {
  const navigate = useNavigate()
  const { user, loading: authLoading, logout } = useAuth()
  
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<FolderPath[]>([])
  const [allFiles, setAllFiles] = useState<FileItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [actionFile, setActionFile] = useState<FileItem | null>(null)
  
  const [folderName, setFolderName] = useState('')
  const [renameName, setRenameName] = useState('')
  const [currentRenameId, setCurrentRenameId] = useState<string | null>(null)
  
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{name: string, status: 'uploading' | 'success' | 'error'}[]>([])
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user?.organization_id) {
      loadFiles()
    }
  }, [currentFolderId, user])

  useEffect(() => {
    function closeMenus(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.file-menu-container')) {
        document.querySelectorAll('.file-menu-dropdown').forEach(menu => {
          menu.classList.remove('show')
        })
      }
    }
    document.addEventListener('click', closeMenus)
    return () => document.removeEventListener('click', closeMenus)
  }, [])

  async function loadFiles() {
    if (!user?.organization_id) {
      setError('Keine Organisation gefunden')
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      
      const filter = `organization_id = "${user.organization_id}" && parent_folder_id ${currentFolderId ? `= "${currentFolderId}"` : '= ""'}`
      
      console.log('Loading files with filter:', filter)
      
      const files = await pb.collection('files').getFullList<FileItem>({
        filter,
        sort: '-is_folder,name'
      })
      
      console.log('Loaded files:', files)
      
      setAllFiles(files)
    } catch(e: any) {
      console.error('Error loading files:', e)
      setError('Fehler beim Laden: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function showMessage(text: string, type: 'success' | 'error' = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  function navigateToFolder(folderId: string | null, folderName?: string) {
    if (folderId === null) {
      setCurrentFolderId(null)
      setFolderPath([])
    } else {
      const idx = folderPath.findIndex(f => f.id === folderId)
      if (idx >= 0) {
        setCurrentFolderId(folderId)
        setFolderPath(folderPath.slice(0, idx + 1))
      } else if (folderName) {
        setCurrentFolderId(folderId)
        setFolderPath([...folderPath, { id: folderId, name: folderName }])
      }
    }
  }

  async function createFolder() {
    if (!folderName.trim()) {
      alert('Bitte Ordnername eingeben')
      return
    }
    
    try {
      await pb.collection('files').create({
        name: folderName,
        is_folder: true,
        parent_folder_id: currentFolderId || '',
        organization_id: user?.organization_id
      })
      
      setShowNewFolderModal(false)
      setFolderName('')
      await loadFiles()
      showMessage('Ordner erstellt!')
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function handleFileUpload(files: FileList) {
    const fileArray = Array.from(files)
    setUploadProgress(fileArray.map(f => ({ name: f.name, status: 'uploading' })))
    
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      
      try {
        const formData = new FormData()
        formData.append('name', file.name)
        formData.append('is_folder', 'false')
        formData.append('parent_folder_id', currentFolderId || '')
        formData.append('file', file)
        formData.append('file_size', file.size.toString())
        formData.append('file_type', file.type)
        formData.append('organization_id', user?.organization_id || '')
        
        await pb.collection('files').create(formData)
        
        setUploadProgress(prev => {
          const newProgress = [...prev]
          newProgress[i] = { ...newProgress[i], status: 'success' }
          return newProgress
        })
      } catch(e) {
        console.error('Upload error:', e)
        setUploadProgress(prev => {
          const newProgress = [...prev]
          newProgress[i] = { ...newProgress[i], status: 'error' }
          return newProgress
        })
      }
    }
    
    await loadFiles()
    showMessage('Dateien hochgeladen!')
  }

  async function downloadFile(fileId: string) {
    try {
      const file = await pb.collection('files').getOne<FileItem>(fileId)
      
      if (!file.file) {
        alert('Keine Datei vorhanden')
        return
      }
      
      const baseUrl = pb.baseUrl
      const token = pb.authStore.token
      const url = `${baseUrl}/api/files/files/${file.id}/${file.file}?token=${token}`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 100)
    } catch(e: any) {
      console.error('Download error:', e)
      alert('Fehler beim Download: ' + e.message)
    }
  }

  async function renameItem() {
    if (!renameName.trim() || !currentRenameId) {
      alert('Bitte Name eingeben')
      return
    }
    
    try {
      await pb.collection('files').update(currentRenameId, { name: renameName })
      
      setShowRenameModal(false)
      setCurrentRenameId(null)
      setRenameName('')
      await loadFiles()
      showMessage('Umbenannt!')
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function deleteItem(itemId: string, itemName: string, isFolder: boolean) {
    const type = isFolder ? 'Ordner' : 'Datei'
    
    if (!confirm(`${type} "${itemName}" wirklich löschen?${isFolder ? '\n\nAlle Dateien im Ordner gehen verloren!' : ''}`)) {
      return
    }
    
    try {
      if (isFolder) {
        const children = await pb.collection('files').getFullList({
          filter: `parent_folder_id = "${itemId}"`
        })
        
        for (const child of children) {
          await pb.collection('files').delete(child.id)
        }
      }
      
      await pb.collection('files').delete(itemId)
      
      await loadFiles()
      showMessage('Gelöscht!')
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function getFileIcon(item: FileItem) {
    if (item.is_folder) return 'Ordner'
    
    const ext = item.name.split('.').pop()?.toLowerCase() || ''
    
    if (ext === 'pdf') return 'PDF'
    if (['doc', 'docx'].includes(ext)) return 'Word'
    if (['xls', 'xlsx'].includes(ext)) return 'Excel'
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'Bild'
    if (['zip', 'rar', '7z'].includes(ext)) return 'Archiv'
    
    return 'Datei'
  }

  function formatFileSize(bytes?: number) {
    if (!bytes || bytes === 0) return '-'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleDateString('de-DE')
  }

  function isEditable(item: FileItem) {
    const ext = item.name.split('.').pop()?.toLowerCase() || ''
    return EDITABLE_EXTS.includes(ext)
  }

  function openItem(item: FileItem) {
    if (item.is_folder) {
      navigateToFolder(item.id, item.name)
    } else if (isEditable(item)) {
      setActionFile(item)
    } else {
      downloadFile(item.id)
    }
  }

  const filteredFiles = searchQuery 
    ? allFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allFiles

  if (authLoading) {
    return null
  }

  function fileIconSvg(item: FileItem) {
    if (item.is_folder) return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
      </svg>
    )
    const ext = item.name.split('.').pop()?.toLowerCase() || ''
    if (ext === 'pdf') return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    )
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
    )
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    )
  }

  function fileIconColor(item: FileItem) {
    if (item.is_folder) return { color: '#d97706', bg: 'rgba(217,119,6,0.08)' }
    const ext = item.name.split('.').pop()?.toLowerCase() || ''
    if (ext === 'pdf') return { color: '#600812', bg: 'rgba(96,8,18,0.07)' }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { color: '#7c3aed', bg: 'rgba(124,58,237,0.07)' }
    return { color: '#8a7a68', bg: 'rgba(138,122,104,0.08)' }
  }

  function fileBorderColor(item: FileItem) {
    if (item.is_folder) return '#d97706'
    const ext = item.name.split('.').pop()?.toLowerCase() || ''
    if (ext === 'pdf') return '#600812'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '#7c3aed'
    return 'rgba(138,122,104,0.4)'
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>

      {/* MASTHEAD */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(96,8,18,0.12)', position: 'sticky', top: 0, zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/hub" style={{ display: 'flex', alignItems: 'center', color: '#600812', textDecoration: 'none', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </a>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: '#1a0e08' }}>Dateien</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{user?.organization_name || 'Responda'}</div>
          </div>
          <div style={{ width: 22 }} />
        </div>
      </div>

      {/* ACTION TOOLBAR */}
      <div className="files-actionbar">
        <button className="files-action-btn" onClick={() => setShowNewFolderModal(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
          <span className="files-action-label">Neuer Ordner</span>
        </button>
        <button className="files-action-btn" onClick={() => setShowUploadModal(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span className="files-action-label">Hochladen</span>
        </button>
      </div>

      {/* TOAST */}
      {message && (
        <div className={`files-toast files-toast-${message.type}`}>{message.text}</div>
      )}

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px 16px 120px', boxSizing: 'border-box' as const }}>

        {/* BREADCRUMBS */}
        {folderPath.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 12, background: '#fff', borderRadius: 10, padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <span onClick={() => navigateToFolder(null)} style={{ fontSize: 13, fontWeight: 700, color: '#600812', cursor: 'pointer' }}>Dateien</span>
            {folderPath.map((folder, idx) => (
              <span key={folder.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--warm-gray)" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                <span
                  onClick={() => navigateToFolder(folder.id)}
                  style={{ fontSize: 13, fontWeight: idx === folderPath.length - 1 ? 700 : 600, color: idx === folderPath.length - 1 ? '#1a0e08' : '#600812', cursor: idx === folderPath.length - 1 ? 'default' : 'pointer' }}
                >
                  {folder.name}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* SEARCH */}
        <div style={{ marginBottom: 12 }}>
          <input
            className="files-search"
            type="text"
            placeholder="Dateien durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* ERROR */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: 16, borderRadius: 12, marginBottom: 12, fontWeight: 600, fontSize: 13 }}>
            {error}
            <button onClick={() => loadFiles()} style={{ marginLeft: 16, background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#dc2626', fontFamily: 'inherit' }}>Erneut versuchen</button>
          </div>
        )}

        {/* FILE LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--warm-gray)', background: '#fff', borderRadius: 12, fontStyle: 'italic' }}>Lade Dateien...</div>
          ) : filteredFiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--warm-gray)', background: '#fff', borderRadius: 12 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25, marginBottom: 12 }} strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
              <div style={{ fontWeight: 700, marginBottom: 4, color: '#1a0e08' }}>Keine Dateien</div>
              <div style={{ fontStyle: 'italic', fontSize: 13 }}>Ordner erstellen oder Dateien hochladen</div>
            </div>
          ) : (
            filteredFiles.map(item => {
              const ic = fileIconColor(item)
              return (
                <div
                  key={item.id}
                  onClick={() => openItem(item)}
                  style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${fileBorderColor(item)}`, padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: ic.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: ic.color }}>
                    {fileIconSvg(item)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 14, color: '#1a0e08', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 2 }}>
                      {item.is_folder ? 'Ordner' : formatFileSize(item.file_size)} · {formatDate(item.created)}
                    </div>
                  </div>
                  <div className="file-menu-container" style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      className="menu-dots"
                      onClick={(e) => {
                        e.stopPropagation()
                        const menuId = `menu-${item.id}`
                        const menu = document.getElementById(menuId)
                        document.querySelectorAll('.file-menu-dropdown').forEach(m => { if (m.id !== menuId) m.classList.remove('show') })
                        menu?.classList.toggle('show')
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                    </button>
                    <div id={`menu-${item.id}`} className="file-menu-dropdown">
                      <button className="menu-item" onClick={(e) => { e.stopPropagation(); setCurrentRenameId(item.id); setRenameName(item.name); setShowRenameModal(true) }}>Umbenennen</button>
                      <button className="menu-item danger" onClick={(e) => { e.stopPropagation(); deleteItem(item.id, item.name, item.is_folder) }}>Löschen</button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* NEUER ORDNER MODAL */}
      {showNewFolderModal && (
        <div className="f-modal-overlay" onClick={() => setShowNewFolderModal(false)}>
          <div className="f-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Neuer Ordner</h3>
            <div className="f-field">
              <label>Ordnername</label>
              <input type="text" value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="z.B. Protokolle" onKeyPress={(e) => e.key === 'Enter' && createFolder()} autoFocus />
            </div>
            <div className="f-modal-actions">
              <button className="f-btn" onClick={() => setShowNewFolderModal(false)}>Abbrechen</button>
              <button className="f-btn primary" onClick={createFolder}>Erstellen</button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div className="f-modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="f-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Dateien hochladen</h3>
            <div
              ref={uploadAreaRef}
              className="upload-area"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('drag-over') }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files) }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35, marginBottom: 12, color: '#600812' }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <div style={{ fontWeight: 700, color: '#1a0e08', marginBottom: 4 }}>Dateien hierher ziehen</div>
              <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)' }}>oder tippen zum Auswählen</div>
            </div>
            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => e.target.files && handleFileUpload(e.target.files)} />
            {uploadProgress.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {uploadProgress.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--warm-bg)', borderRadius: 8, fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: '#1a0e08', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.name}</div>
                    <div style={{ fontStyle: 'italic', color: item.status === 'success' ? '#16a34a' : item.status === 'error' ? '#dc2626' : 'var(--warm-gray)', marginLeft: 12, flexShrink: 0 }}>
                      {item.status === 'uploading' ? 'Lädt...' : item.status === 'success' ? 'Fertig' : 'Fehler'}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="f-modal-actions">
              <button className="f-btn" onClick={() => { setShowUploadModal(false); setUploadProgress([]) }}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* DOKUMENT ÖFFNEN MODAL */}
      {actionFile && (
        <div className="f-modal-overlay" onClick={() => setActionFile(null)}>
          <div className="f-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontStyle: 'italic' }}>{actionFile.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <button
                className="f-btn primary"
                style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center' }}
                onClick={() => { navigate(`/office?open=${actionFile.id}`); setActionFile(null) }}
              >
                In Office öffnen
              </button>
              <button
                className="f-btn"
                style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center' }}
                onClick={() => { downloadFile(actionFile.id); setActionFile(null) }}
              >
                Herunterladen
              </button>
            </div>
            <div className="f-modal-actions">
              <button className="f-btn" onClick={() => setActionFile(null)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {/* UMBENENNEN MODAL */}
      {showRenameModal && (
        <div className="f-modal-overlay" onClick={() => setShowRenameModal(false)}>
          <div className="f-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Umbenennen</h3>
            <div className="f-field">
              <label>Neuer Name</label>
              <input type="text" value={renameName} onChange={(e) => setRenameName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && renameItem()} autoFocus />
            </div>
            <div className="f-modal-actions">
              <button className="f-btn" onClick={() => setShowRenameModal(false)}>Abbrechen</button>
              <button className="f-btn primary" onClick={renameItem}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .files-actionbar {
          background: #fff;
          border-bottom: 0.5px solid rgba(96,8,18,0.12);
          position: sticky;
          top: calc(env(safe-area-inset-top) + 60px);
          z-index: 99;
          display: flex;
          gap: 0;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          padding: 0 4px;
        }
        .files-actionbar::-webkit-scrollbar { display: none; }

        .files-action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          flex-shrink: 0;
          min-width: 72px;
          padding: 8px 6px;
          background: none;
          border: none;
          cursor: pointer;
          color: #600812;
          font-family: inherit;
        }
        .files-action-btn:hover { background: rgba(96,8,18,0.05); }

        .files-action-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #600812;
          white-space: nowrap;
        }

        .files-toast {
          position: fixed;
          bottom: calc(70px + env(safe-area-inset-bottom));
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          padding: 10px 20px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 13px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          white-space: nowrap;
        }
        .files-toast-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
        .files-toast-error   { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }

        .files-search {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 14px;
          border: 1px solid rgba(96,8,18,0.15);
          border-radius: 10px;
          background: #fff;
          font-size: 14px;
          font-family: inherit;
          color: #1a0e08;
        }
        .files-search:focus { outline: none; border-color: #600812; box-shadow: 0 0 0 3px rgba(96,8,18,0.08); }

        .menu-dots {
          background: #fff;
          border: 1px solid rgba(96,8,18,0.12);
          border-radius: 6px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--warm-gray);
        }
        .menu-dots:hover { color: #600812; }

        .file-menu-dropdown {
          position: absolute;
          top: 32px;
          right: 0;
          background: #fff;
          border: 1px solid rgba(96,8,18,0.12);
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          min-width: 140px;
          display: none;
          flex-direction: column;
          z-index: 100;
        }
        .file-menu-dropdown.show { display: flex; }

        .menu-item {
          background: none;
          border: none;
          cursor: pointer;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 600;
          text-align: left;
          white-space: nowrap;
          color: #1a0e08;
          font-family: inherit;
        }
        .menu-item:first-child { border-radius: 8px 8px 0 0; }
        .menu-item:last-child { border-radius: 0 0 8px 8px; }
        .menu-item:hover { background: rgba(96,8,18,0.05); }
        .menu-item.danger { color: #dc2626; }
        .menu-item.danger:hover { background: #fee2e2; }

        .f-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(26,14,8,0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .f-modal {
          background: #fff;
          border-radius: 16px;
          max-width: 480px;
          width: 100%;
          max-height: 88vh;
          overflow-y: auto;
          padding: 24px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.12);
        }

        .f-modal h3 {
          margin: 0 0 20px 0;
          color: #600812;
          font-weight: 800;
          font-size: 18px;
        }

        .f-field { margin-bottom: 16px; }
        .f-field label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #600812;
          margin-bottom: 6px;
        }
        .f-field input {
          width: 100%;
          padding: 10px 12px;
          border: 1.5px solid rgba(96,8,18,0.15);
          border-radius: 10px;
          background: #fff;
          font-size: 15px;
          font-family: inherit;
          color: #1a0e08;
          box-sizing: border-box;
          -webkit-appearance: none;
        }
        .f-field input:focus { outline: none; border-color: #600812; box-shadow: 0 0 0 3px rgba(96,8,18,0.1); }

        .f-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px; }

        .f-btn {
          background: #fff;
          color: #1a0e08;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          font-family: inherit;
          border: 1px solid rgba(96,8,18,0.15);
          font-size: 14px;
        }
        .f-btn:hover { background: rgba(96,8,18,0.05); }
        .f-btn.primary { background: #600812; color: #fff; border-color: #600812; }
        .f-btn.primary:hover { background: #7a0a16; }

        .upload-area {
          border: 2px dashed rgba(96,8,18,0.2);
          border-radius: 12px;
          padding: 32px;
          text-align: center;
          cursor: pointer;
          background: var(--warm-bg);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .upload-area:hover { border-color: #600812; background: rgba(96,8,18,0.03); }
        .upload-area.drag-over { border-color: #600812; background: rgba(96,8,18,0.05); }

        @media (max-width: 768px) {
          .f-modal { border-radius: 20px 20px 0 0; max-height: 80vh; }
          .f-modal-overlay { align-items: flex-end; padding: 0; }
        }
      `}</style>
    </div>
  )
}
