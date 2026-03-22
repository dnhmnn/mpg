import { useState, useEffect, useRef } from ‘react’
import { Link } from ‘react-router-dom’
import { pb } from ‘../lib/pocketbase’
import { useAuth } from ‘../hooks/useAuth’

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
const { user, logout } = useAuth()

const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
const [folderPath, setFolderPath] = useState<FolderPath[]>([])
const [allFiles, setAllFiles] = useState<FileItem[]>([])
const [searchQuery, setSearchQuery] = useState(’’)
const [loading, setLoading] = useState(true)

const [showNewFolderModal, setShowNewFolderModal] = useState(false)
const [showUploadModal, setShowUploadModal] = useState(false)
const [showRenameModal, setShowRenameModal] = useState(false)

const [folderName, setFolderName] = useState(’’)
const [renameName, setRenameName] = useState(’’)
const [currentRenameId, setCurrentRenameId] = useState<string | null>(null)

const [message, setMessage] = useState<{text: string, type: ‘success’ | ‘error’} | null>(null)
const [uploadProgress, setUploadProgress] = useState<{name: string, status: ‘uploading’ | ‘success’ | ‘error’}[]>([])

const fileInputRef = useRef<HTMLInputElement>(null)
const uploadAreaRef = useRef<HTMLDivElement>(null)

useEffect(() => {
loadFiles()
}, [currentFolderId])

async function loadFiles() {
if (!user?.organization_id) return

try {
  setLoading(true)
  const filter = `organization_id = "${user.organization_id}" && parent_folder_id ${currentFolderId ? `= "${currentFolderId}"` : '= ""'}`
  
  const files = await pb.collection('files').getFullList<FileItem>({
    filter,
    sort: '-is_folder,name'
  })
  
  setAllFiles(files)
} catch(e: any) {
  console.error('Error loading files:', e)
  showMessage('Fehler beim Laden: ' + e.message, 'error')
} finally {
  setLoading(false)
}

}

function showMessage(text: string, type: ‘success’ | ‘error’ = ‘success’) {
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
setFolderPath([…folderPath, { id: folderId, name: folderName }])
}
}
}

async function createFolder() {
if (!folderName.trim()) {
alert(‘Bitte Ordnername eingeben’)
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
  showMessage('✅ Ordner erstellt!')
} catch(e: any) {
  alert('Fehler: ' + e.message)
}

}

async function handleFileUpload(files: FileList) {
const fileArray = Array.from(files)
setUploadProgress(fileArray.map(f => ({ name: f.name, status: ‘uploading’ })))

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
showMessage('✅ Dateien hochgeladen!')

}

async function downloadFile(fileId: string) {
try {
const file = await pb.collection(‘files’).getOne<FileItem>(fileId)

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
alert(‘Bitte Name eingeben’)
return
}

try {
  await pb.collection('files').update(currentRenameId, { name: renameName })
  
  setShowRenameModal(false)
  setCurrentRenameId(null)
  setRenameName('')
  await loadFiles()
  showMessage('✅ Umbenannt!')
} catch(e: any) {
  alert('Fehler: ' + e.message)
}

}

async function deleteItem(itemId: string, itemName: string, isFolder: boolean) {
const type = isFolder ? ‘Ordner’ : ‘Datei’

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
  showMessage('✅ Gelöscht!')
} catch(e: any) {
  alert('Fehler: ' + e.message)
}

}

function getFileIcon(item: FileItem) {
if (item.is_folder) return ‘📁’

const ext = item.name.split('.').pop()?.toLowerCase() || ''
const type = item.file_type || ''

if (type.startsWith('image/')) return '🖼️'
if (ext === 'pdf' || type === 'application/pdf') return '📄'
if (['doc', 'docx'].includes(ext)) return '📝'
if (['xls', 'xlsx'].includes(ext)) return '📊'
if (['zip', 'rar', '7z'].includes(ext)) return '🗜️'

return '📄'

}

function formatFileSize(bytes?: number) {
if (!bytes || bytes === 0) return ‘-’
const k = 1024
const sizes = [‘Bytes’, ‘KB’, ‘MB’, ‘GB’]
const i = Math.floor(Math.log(bytes) / Math.log(k))
return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ’ ’ + sizes[i]
}

function formatDate(dateStr: string) {
const date = new Date(dateStr)
return date.toLocaleDateString(‘de-DE’)
}

const filteredFiles = searchQuery
? allFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
: allFiles

return (
<div className="files-page">
<header className="files-header">
<div className="files-bar">
<h1>📁 Dateien</h1>
<div className="files-toolbar">
<Link to="/hub" className="topbtn">
🏠 Dashboard
</Link>
<button className="topbtn" onClick={logout}>
🚪 Logout
</button>
</div>
</div>
</header>

  <div className="files-wrap">
    {message && (
      <div className={`files-message ${message.type}`}>
        {message.text}
      </div>
    )}

    <div className="files-breadcrumbs">
      <span className="breadcrumb" onClick={() => navigateToFolder(null)}>
        🏠 Home
      </span>
      {folderPath.map((folder, idx) => (
        <span key={folder.id}>
          {' › '}
          <span 
            className={`breadcrumb ${idx === folderPath.length - 1 ? 'active' : ''}`}
            onClick={() => navigateToFolder(folder.id)}
          >
            {folder.name}
          </span>
        </span>
      ))}
    </div>

    <div className="files-actions">
      <div className="files-search">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Dateien durchsuchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <button className="btn primary" onClick={() => setShowNewFolderModal(true)}>
        📁 Neuer Ordner
      </button>
      <button className="btn primary" onClick={() => setShowUploadModal(true)}>
        ⬆️ Hochladen
      </button>
    </div>

    <div className="files-grid">
      {loading ? (
        <div className="files-empty">Lade Dateien...</div>
      ) : filteredFiles.length === 0 ? (
        <div className="files-empty">
          <div style={{fontSize: '3rem', marginBottom: '1rem', opacity: 0.3}}>📁</div>
          <div style={{fontWeight: 700, marginBottom: '.5rem'}}>Keine Dateien</div>
          <div>Erstelle einen Ordner oder lade Dateien hoch</div>
        </div>
      ) : (
        filteredFiles.map(item => (
          <div 
            key={item.id}
            className="file-item"
            onClick={() => item.is_folder ? navigateToFolder(item.id, item.name) : downloadFile(item.id)}
          >
            <div className="file-menu">
              <button 
                className="menu-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentRenameId(item.id)
                  setRenameName(item.name)
                  setShowRenameModal(true)
                }}
                title="Umbenennen"
              >
                ✏️
              </button>
              <button 
                className="menu-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteItem(item.id, item.name, item.is_folder)
                }}
                title="Löschen"
              >
                🗑️
              </button>
            </div>
            <div className="file-icon">{getFileIcon(item)}</div>
            <div className="file-name">{item.name}</div>
            <div className="file-meta">
              {item.is_folder ? 'Ordner' : formatFileSize(item.file_size)} • {formatDate(item.created)}
            </div>
          </div>
        ))
      )}
    </div>
  </div>

  {/* New Folder Modal */}
  {showNewFolderModal && (
    <div className="modal show" onClick={() => setShowNewFolderModal(false)}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>Neuer Ordner</h3>
        <div className="form-group">
          <label>Ordnername</label>
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="z.B. Protokolle"
            onKeyPress={(e) => e.key === 'Enter' && createFolder()}
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={() => setShowNewFolderModal(false)}>Abbrechen</button>
          <button className="btn primary" onClick={createFolder}>✓ Erstellen</button>
        </div>
      </div>
    </div>
  )}

  {/* Upload Modal */}
  {showUploadModal && (
    <div className="modal show" onClick={() => setShowUploadModal(false)}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>Dateien hochladen</h3>
        <div 
          ref={uploadAreaRef}
          className="upload-area"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.classList.add('drag-over')
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('drag-over')
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('drag-over')
            if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files)
          }}
        >
          <div style={{fontSize: '3rem', marginBottom: '1rem', opacity: 0.5}}>☁️</div>
          <div style={{fontWeight: 700, marginBottom: '.5rem'}}>Dateien hierher ziehen</div>
          <div style={{opacity: 0.6, fontSize: '.9rem'}}>oder klicken zum Auswählen</div>
        </div>
        <input 
          ref={fileInputRef}
          type="file" 
          multiple 
          style={{display: 'none'}}
          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
        />
        {uploadProgress.length > 0 && (
          <div style={{marginTop: '1rem'}}>
            {uploadProgress.map((item, idx) => (
              <div key={idx} className="upload-item">
                <div>
                  <div style={{fontWeight: 700}}>{item.name}</div>
                </div>
                <div>
                  {item.status === 'uploading' && '⏳'}
                  {item.status === 'success' && '✅'}
                  {item.status === 'error' && '❌'}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={() => {
            setShowUploadModal(false)
            setUploadProgress([])
          }}>Schließen</button>
        </div>
      </div>
    </div>
  )}

  {/* Rename Modal */}
  {showRenameModal && (
    <div className="modal show" onClick={() => setShowRenameModal(false)}>
      <div className="modal-box small" onClick={(e) => e.stopPropagation()}>
        <h3>Umbenennen</h3>
        <div className="form-group">
          <label>Neuer Name</label>
          <input
            type="text"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && renameItem()}
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={() => setShowRenameModal(false)}>Abbrechen</button>
          <button className="btn primary" onClick={renameItem}>✓ Speichern</button>
        </div>
      </div>
    </div>
  )}

  <style>{`
    .files-page {
      min-height: 100vh;
      background: #f5f5f7;
    }

    .files-header {
      position: sticky;
      top: 0;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      z-index: 10;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .files-bar {
      max-width: 1400px;
      margin: 0 auto;
      padding: .75rem 1rem;
      display: flex;
      gap: .5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .files-bar h1 {
      font-size: 1.05rem;
      margin: 0;
      font-weight: 800;
      color: #1d1d1f;
    }

    .files-toolbar {
      margin-left: auto;
      display: flex;
      gap: .5rem;
      flex-wrap: wrap;
    }

    .topbtn {
      background: #b91c1c;
      color: #fff;
      padding: .45rem .7rem;
      border-radius: .5rem;
      cursor: pointer;
      font-weight: 700;
      font-size: .9rem;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: none;
      font-family: inherit;
    }

    .topbtn:hover {
      background: #dc2626;
      transform: translateY(-1px);
    }

    .files-wrap {
      max-width: 1400px;
      margin: 1.5rem auto;
      padding: 0 1rem;
    }

    .files-message {
      padding: 12px 16px;
      border-radius: 10px;
      margin-bottom: 1rem;
      font-weight: 600;
    }

    .files-message.success {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
    }

    .files-message.error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
    }

    .files-breadcrumbs {
      display: flex;
      align-items: center;
      gap: .5rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding: .75rem 1rem;
      border-radius: .75rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }

    .breadcrumb {
      color: #64748b;
      cursor: pointer;
      transition: color 0.2s;
      font-weight: 600;
      font-size: .9rem;
    }

    .breadcrumb:hover {
      color: #b91c1c;
    }

    .breadcrumb.active {
      color: #1d1d1f;
      cursor: default;
    }

    .files-actions {
      display: flex;
      gap: .5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .btn {
      background: rgba(255, 255, 255, 0.9);
      color: #1d1d1f;
      padding: .6rem 1rem;
      border-radius: .5rem;
      cursor: pointer;
      font-weight: 700;
      transition: all 0.2s;
      font-family: inherit;
      border: 1px solid rgba(0, 0, 0, 0.08);
      display: inline-flex;
      align-items: center;
      gap: .5rem;
      font-size: .9rem;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .btn.primary {
      background: #b91c1c;
      color: #fff;
      border-color: #b91c1c;
    }

    .btn.primary:hover {
      background: #dc2626;
    }

    .files-search {
      flex: 1;
      min-width: 200px;
      position: relative;
    }

    .files-search input {
      width: 100%;
      padding: .6rem 1rem .6rem 2.5rem;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: .5rem;
      background: rgba(255, 255, 255, 0.9);
      font-size: .9rem;
      font-family: inherit;
    }

    .files-search input:focus {
      outline: none;
      border-color: #b91c1c;
      box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.1);
    }

    .search-icon {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
    }

    .files-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }

    .file-item {
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: .75rem;
      padding: 1.25rem;
      cursor: pointer;
      transition: all 0.2s;
      border: 2px solid transparent;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      position: relative;
    }

    .file-item:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
      border-color: rgba(185, 28, 28, 0.2);
    }

    .file-icon {
      font-size: 3rem;
      margin-bottom: .75rem;
      text-align: center;
    }

    .file-name {
      font-weight: 700;
      font-size: .95rem;
      margin-bottom: .5rem;
      word-break: break-word;
      color: #1d1d1f;
    }

    .file-meta {
      font-size: .8rem;
      color: #64748b;
    }

    .file-menu {
      position: absolute;
      top: .5rem;
      right: .5rem;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: .5rem;
      padding: .25rem;
      border: 1px solid rgba(0, 0, 0, 0.08);
      display: none;
      gap: .25rem;
    }

    .file-item:hover .file-menu {
      display: flex;
    }

    .menu-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: .35rem .5rem;
      font-size: .85rem;
      transition: all 0.2s;
      border-radius: .25rem;
    }

    .menu-btn:hover {
      background: #f3f4f6;
    }

    .files-empty {
      grid-column: 1 / -1;
      text-align: center;
      padding: 3rem 1rem;
      color: #64748b;
    }

    .modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .modal.show {
      display: flex;
    }

    .modal-box {
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(40px);
      -webkit-backdrop-filter: blur(40px);
      border-radius: 14px;
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      padding: 24px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    .modal-box.small {
      max-width: 400px;
    }

    .modal-box h3 {
      margin: 0 0 1rem 0;
      color: #b91c1c;
      font-weight: 800;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      font-weight: 700;
      font-size: .9rem;
      color: #374151;
      display: block;
      margin-bottom: .5rem;
    }

    .form-group input {
      padding: .6rem;
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: .5rem;
      background: #fff;
      font-size: 16px;
      font-family: inherit;
      width: 100%;
    }

    .form-group input:focus {
      outline: none;
      border-color: #b91c1c;
      box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.1);
    }

    .modal-actions {
      display: flex;
      gap: .5rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }

    .upload-area {
      border: 2px dashed rgba(0, 0, 0, 0.15);
      border-radius: .75rem;
      padding: 2rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      background: #fafafa;
    }

    .upload-area:hover {
      border-color: #b91c1c;
      background: #fff;
    }

    .upload-area.drag-over {
      border-color: #b91c1c;
      background: rgba(185, 28, 28, 0.05);
    }

    .upload-item {
      padding: .75rem;
      background: #f9fafb;
      border-radius: .5rem;
      margin-top: .5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    @media (max-width: 768px) {
      .files-bar {
        flex-direction: column;
        align-items: stretch;
      }

      .files-toolbar {
        margin-left: 0;
        width: 100%;
        justify-content: space-between;
      }

      .topbtn {
        flex: 1;
        justify-content: center;
      }

      .files-actions {
        flex-direction: column;
      }

      .btn {
        width: 100%;
        justify-content: center;
      }

      .files-search {
        width: 100%;
      }

      .files-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: .75rem;
      }

      .file-item {
        padding: 1rem;
      }

      .file-icon {
        font-size: 2.5rem;
      }
    }
  `}</style>
</div>

)
}
