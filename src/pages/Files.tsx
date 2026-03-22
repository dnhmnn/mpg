import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import StatusBar from '../components/StatusBar'

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

  const filteredFiles = searchQuery 
    ? allFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allFiles

  if (authLoading) {
    return null
  }

  return (
    <>
      <StatusBar user={user} onLogout={logout} pageName="Dateien" showHubLink={true} />
      
      <div className="content">
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="breadcrumbs">
          <span className="breadcrumb" onClick={() => navigateToFolder(null)}>
            Home
          </span>
          {folderPath.map((folder, idx) => (
            <span key={folder.id}>
              <span style={{margin: '0 8px', opacity: 0.5}}>›</span>
              <span 
                className={`breadcrumb ${idx === folderPath.length - 1 ? 'active' : ''}`}
                onClick={() => navigateToFolder(folder.id)}
              >
                {folder.name}
              </span>
            </span>
          ))}
        </div>

        <div className="actions-bar">
          <div className="search-box">
            <input
              type="text"
              placeholder="Dateien durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn primary" onClick={() => setShowNewFolderModal(true)}>
            Neuer Ordner
          </button>
          <button className="btn primary" onClick={() => setShowUploadModal(true)}>
            Hochladen
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => loadFiles()} style={{marginLeft: '16px'}}>Erneut versuchen</button>
          </div>
        )}

        <div className="files-grid">
          {loading ? (
            <div className="empty-state">Lade Dateien...</div>
          ) : filteredFiles.length === 0 ? (
            <div className="empty-state">
              <div style={{fontSize: '48px', marginBottom: '16px', opacity: 0.3}}>📁</div>
              <div style={{fontWeight: 700, marginBottom: '8px'}}>Keine Dateien</div>
              <div>Erstelle einen Ordner oder lade Dateien hoch</div>
            </div>
          ) : (
            filteredFiles.map(item => (
              <div 
                key={item.id}
                className="file-card"
                onClick={() => item.is_folder ? navigateToFolder(item.id, item.name) : downloadFile(item.id)}
              >
                <div className="file-menu-container">
                  <button 
                    className="menu-dots"
                    onClick={(e) => {
                      e.stopPropagation()
                      const menuId = `menu-${item.id}`
                      const menu = document.getElementById(menuId)
                      const allMenus = document.querySelectorAll('.file-menu-dropdown')
                      allMenus.forEach(m => {
                        if (m.id !== menuId) m.classList.remove('show')
                      })
                      menu?.classList.toggle('show')
                    }}
                  >
                    ⋮
                  </button>
                  <div id={`menu-${item.id}`} className="file-menu-dropdown">
                    <button 
                      className="menu-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCurrentRenameId(item.id)
                        setRenameName(item.name)
                        setShowRenameModal(true)
                      }}
                    >
                      Umbenennen
                    </button>
                    <button 
                      className="menu-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteItem(item.id, item.name, item.is_folder)
                      }}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
                <div className="file-type">{getFileIcon(item)}</div>
                <div className="file-name">{item.name}</div>
                <div className="file-meta">
                  {item.is_folder ? 'Ordner' : formatFileSize(item.file_size)} • {formatDate(item.created)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import StatusBar from '../components/StatusBar'

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

  const filteredFiles = searchQuery 
    ? allFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allFiles

  if (authLoading) {
    return null
  }

  return (
    <>
      <StatusBar user={user} onLogout={logout} pageName="Dateien" showHubLink={true} />
      
      <div className="content">
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="breadcrumbs">
          <span className="breadcrumb" onClick={() => navigateToFolder(null)}>
            Home
          </span>
          {folderPath.map((folder, idx) => (
            <span key={folder.id}>
              <span style={{margin: '0 8px', opacity: 0.5}}>›</span>
              <span 
                className={`breadcrumb ${idx === folderPath.length - 1 ? 'active' : ''}`}
                onClick={() => navigateToFolder(folder.id)}
              >
                {folder.name}
              </span>
            </span>
          ))}
        </div>

        <div className="actions-bar">
          <div className="search-box">
            <input
              type="text"
              placeholder="Dateien durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn primary" onClick={() => setShowNewFolderModal(true)}>
            Neuer Ordner
          </button>
          <button className="btn primary" onClick={() => setShowUploadModal(true)}>
            Hochladen
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => loadFiles()} style={{marginLeft: '16px'}}>Erneut versuchen</button>
          </div>
        )}

        <div className="files-grid">
          {loading ? (
            <div className="empty-state">Lade Dateien...</div>
          ) : filteredFiles.length === 0 ? (
            <div className="empty-state">
              <div style={{fontSize: '48px', marginBottom: '16px', opacity: 0.3}}>📁</div>
              <div style={{fontWeight: 700, marginBottom: '8px'}}>Keine Dateien</div>
              <div>Erstelle einen Ordner oder lade Dateien hoch</div>
            </div>
          ) : (
            filteredFiles.map(item => (
              <div 
                key={item.id}
                className="file-card"
                onClick={() => item.is_folder ? navigateToFolder(item.id, item.name) : downloadFile(item.id)}
              >
                <div className="file-menu-container">
                  <button 
                    className="menu-dots"
                    onClick={(e) => {
                      e.stopPropagation()
                      const menuId = `menu-${item.id}`
                      const menu = document.getElementById(menuId)
                      const allMenus = document.querySelectorAll('.file-menu-dropdown')
                      allMenus.forEach(m => {
                        if (m.id !== menuId) m.classList.remove('show')
                      })
                      menu?.classList.toggle('show')
                    }}
                  >
                    ⋮
                  </button>
                  <div id={`menu-${item.id}`} className="file-menu-dropdown">
                    <button 
                      className="menu-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCurrentRenameId(item.id)
                        setRenameName(item.name)
                        setShowRenameModal(true)
                      }}
                    >
                      Umbenennen
                    </button>
                    <button 
                      className="menu-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteItem(item.id, item.name, item.is_folder)
                      }}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
                <div className="file-type">{getFileIcon(item)}</div>
                <div className="file-name">{item.name}</div>
                <div className="file-meta">
                  {item.is_folder ? 'Ordner' : formatFileSize(item.file_size)} • {formatDate(item.created)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      `}</style>
    </>
  )
}
