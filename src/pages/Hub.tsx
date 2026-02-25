import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import StatusBar from '../components/StatusBar'
import Widgets from '../components/Widgets'
import AppGrid from '../components/AppGrid'
import SettingsModal from '../components/SettingsModal'
import AppsModal from '../components/AppsModal'
import EditModal from '../components/EditModal'
import WidgetsModal from '../components/WidgetsModal'
import NotificationModal from '../components/NotificationModal'
import type { App } from '../types'

const ALL_APPS: Record<string, App> = {
  einsaetze: { id: 'einsaetze', name: 'Einsätze', icon: 'siren', url: '/einsaetze.html', permission: 'einsaetze' },
  patienten: { id: 'patienten', name: 'Patienten', icon: 'clipboard', url: '/patientendokumentation-dateien.html', permission: 'patienten' },
  dokumente: { id: 'dokumente', name: 'Vorgänge', icon: 'file', url: '/dokumente-bearbeiten.html', permission: 'dokumente' },
  lager: { id: 'lager', name: 'Lager', icon: 'package', url: '/lagerverwaltung.html', permission: 'lager' },
  produktausgabe: { id: 'produktausgabe', name: 'Ausgabe', icon: 'check', url: '/produktausgabe.html', permission: 'produktausgabe' },
  dateien: { id: 'dateien', name: 'Dateien', icon: 'folder', url: '/dateien.html', permission: 'dateien' },
  qr: { id: 'qr', name: 'QR-Codes', icon: 'qrcode', url: '/qr-code-generator.html', permission: 'qr' },
  lernbar: { id: 'lernbar', name: 'Lernbar', icon: 'graduation', url: '/lernbar.html', permission: 'lernbar' },
  ausbildungen: { id: 'ausbildungen', name: 'Ausbildungen', icon: 'book', url: '/ausbildungen', permission: 'ausbildungen_manage', isInternal: true },
  chat: { id: 'chat', name: 'Chat', icon: 'chat', url: '/chat.html', permission: 'chat' },
  dashboard: { id: 'dashboard', name: 'Dashboard', icon: 'dashboard', url: '/mpg-dashboard.html', permission: 'dashboard' },
  settings: { id: 'settings', name: 'Einstellungen', icon: 'settings', url: '#settings', permission: 'dashboard', isInternal: true }
}

const ROLES: Record<string, { permissions: Record<string, boolean> }> = {
  mpg: { permissions: { dashboard: true, einsaetze: true, lager: true, produktausgabe: true, lernbar: true, ausbildungen_manage: true, dokumente: true, patienten: true, dateien: true, qr: true, chat: true } },
  lager: { permissions: { dashboard: true, lager: true, produktausgabe: true, dateien: true, qr: true, chat: true } },
  ausbildung: { permissions: { dashboard: true, einsaetze: true, lernbar: true, ausbildungen_manage: true, patienten: true, dateien: true, qr: true, chat: true } },
  qm: { permissions: { dashboard: true, dokumente: true, dateien: true, qr: true, chat: true } },
  benutzer: { permissions: { dashboard: true, lernbar: true, chat: true } }
}

export default function Hub() {
  const { user, loading, logout } = useAuth()
  const { currentNotification, dismissNotification, remindLater } = useNotifications(user)
  
  const [editMode, setEditMode] = useState(false)
  const [userApps, setUserApps] = useState<string[]>([])
  const [availableApps, setAvailableApps] = useState<App[]>([])
  
  // Modal states
  const [showSettings, setShowSettings] = useState(false)
  const [showAppsModal, setShowAppsModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showWidgetsModal, setShowWidgetsModal] = useState(false)

  useEffect(() => {
    if (user) {
      loadUserApps()
    }
  }, [user])

  useEffect(() => {
    // Listen for settings open event from AppGrid
    const handleOpenSettings = () => setShowSettings(true)
    window.addEventListener('openSettings', handleOpenSettings)
    return () => window.removeEventListener('openSettings', handleOpenSettings)
  }, [])

  function hasPermission(perm: string): boolean {
    if (!user) return false
    if (user.supervisor) return true
    const perms = user.permissions || {}
    const role = ROLES[user.role || 'benutzer']
    if (perms[perm]) return true
    if (role?.permissions[perm]) return true
    if (perm === 'lernbar' && user.lernbar_access) return true
    return false
  }

  function loadUserApps() {
    if (!user) return
    
    const saved = localStorage.getItem(`hub_apps_${user.id}`)
    
    let apps: string[]
    if (saved) {
      apps = JSON.parse(saved)
      if (!apps.includes('settings')) {
        apps.push('settings')
      }
    } else {
      apps = Object.keys(ALL_APPS).filter(id => {
        const app = ALL_APPS[id]
        return hasPermission(app.permission)
      })
    }
    
    setUserApps(apps)
    updateAvailableApps(apps)
  }

  function updateAvailableApps(currentApps: string[]) {
    if (!user) return
    
    const available = Object.keys(ALL_APPS)
      .filter(id => {
        const app = ALL_APPS[id]
        return id !== 'settings' && hasPermission(app.permission) && !currentApps.includes(id)
      })
      .map(id => ALL_APPS[id])
    
    setAvailableApps(available)
  }

  function saveUserApps(apps: string[]) {
    if (!user) return
    localStorage.setItem(`hub_apps_${user.id}`, JSON.stringify(apps))
  }

  function handleRemoveApp(id: string) {
    const newApps = userApps.filter(x => x !== id)
    setUserApps(newApps)
    saveUserApps(newApps)
    updateAvailableApps(newApps)
  }

  function handleAddApp(id: string) {
    if (userApps.includes(id)) return
    const newApps = [...userApps, id]
    setUserApps(newApps)
    saveUserApps(newApps)
    updateAvailableApps(newApps)
  }

  if (loading) {
    return null
  }

  return (
    <>
      <StatusBar user={user} onLogout={logout} />
      
      <div className={`content ${editMode ? 'edit-mode' : ''}`}>
        <Widgets user={user} />
        <AppGrid 
          userApps={userApps}
          onRemoveApp={handleRemoveApp}
        />
        
        {/* Edit Button */}
        <button 
          className="edit-button"
          onClick={() => setShowEditModal(true)}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '0.5px solid rgba(255, 255, 255, 0.3)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            margin: '32px auto 0',
            display: 'block',
            width: 'fit-content'
          }}
        >
          Hub bearbeiten
        </button>
      </div>

      {/* Modals */}
      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        user={user}
      />

      <AppsModal 
        isOpen={showAppsModal}
        onClose={() => {
          setShowAppsModal(false)
          setEditMode(false)
        }}
        availableApps={availableApps}
        onAddApp={handleAddApp}
      />

      <EditModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onEditApps={() => {
          setEditMode(true)
          setShowAppsModal(true)
        }}
        onEditWidgets={() => setShowWidgetsModal(true)}
      />

      <WidgetsModal 
        isOpen={showWidgetsModal}
        onClose={() => setShowWidgetsModal(false)}
      />

      {currentNotification && (
        <NotificationModal 
          isOpen={true}
          type={currentNotification.type}
          title={currentNotification.title}
          message={currentNotification.message}
          onDismiss={dismissNotification}
          onRemindLater={remindLater}
        />
      )}
    </>
  )
}
