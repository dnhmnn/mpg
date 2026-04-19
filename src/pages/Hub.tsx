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
  einsaetze:     { id: 'einsaetze',     name: 'Einsätze',     icon: 'siren',      url: '/einsaetze.html',                    permission: 'einsaetze',           color: 'linear-gradient(145deg, #ef4444, #dc2626)' },
  patienten:     { id: 'patienten',     name: 'Patienten',    icon: 'clipboard',  url: '/patientendokumentation-dateien.html', permission: 'patienten',           color: 'linear-gradient(145deg, #3b82f6, #2563eb)' },
  dokumente:     { id: 'dokumente',     name: 'Vorgänge',     icon: 'file',       url: '/dokumente-bearbeiten.html',          permission: 'dokumente',           color: 'linear-gradient(145deg, #8b5cf6, #7c3aed)' },
  lager:         { id: 'lager',         name: 'Lager',        icon: 'package',    url: '/lager',                              permission: 'lager',               color: 'linear-gradient(145deg, #f97316, #ea580c)', isInternal: true },
  dateien:       { id: 'dateien',       name: 'Dateien',      icon: 'folder',     url: '/files',                              permission: 'dateien',             color: 'linear-gradient(145deg, #f59e0b, #d97706)', isInternal: true },
  lernbar:       { id: 'lernbar',       name: 'Unitas',       icon: 'graduation', url: '/unitas',                             permission: 'lernbar',             color: 'linear-gradient(145deg, #6366f1, #4f46e5)', isInternal: true },
  ausbildungen:  { id: 'ausbildungen',  name: 'Ausbildungen', icon: 'book',       url: '/ausbildungen',                       permission: 'ausbildungen_manage', color: 'linear-gradient(145deg, #1d4ed8, #1e3a8a)', isInternal: true },
  unitarii:      { id: 'unitarii',      name: 'Unitarii',     icon: 'users',      url: '/unitarii',                           permission: 'unitarii',            color: 'linear-gradient(145deg, #64748b, #475569)', isInternal: true },
  mpg:           { id: 'mpg',           name: 'MPG',          icon: 'mpg',        url: '/mpg',                                permission: 'dashboard',           color: 'linear-gradient(145deg, #b91c1c, #7f1d1d)', isInternal: true },
  chat:          { id: 'chat',          name: 'Chat',         icon: 'chat',       url: '/chat.html',                          permission: 'chat',                color: 'linear-gradient(145deg, #10b981, #059669)' },
  settings:      { id: 'settings',      name: 'Einstellungen',icon: 'settings',   url: '#settings',                           permission: 'dashboard',           color: 'linear-gradient(145deg, #6b7280, #4b5563)', isInternal: true },
}

const ROLES: Record<string, { permissions: Record<string, boolean> }> = {
  mpg:       { permissions: { dashboard: true, einsaetze: true, lager: true, lernbar: true, ausbildungen_manage: true, dokumente: true, patienten: true, dateien: true, chat: true, unitarii: true } },
  lager:     { permissions: { dashboard: true, lager: true, dateien: true, chat: true } },
  ausbildung:{ permissions: { dashboard: true, einsaetze: true, lernbar: true, ausbildungen_manage: true, patienten: true, dateien: true, chat: true } },
  qm:        { permissions: { dashboard: true, dokumente: true, dateien: true, chat: true } },
  benutzer:  { permissions: { dashboard: true, lernbar: true, chat: true } }
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
      
      <div className="content">
        <div className="hub-layout">
          <div className="hub-widgets">
            <Widgets user={user} />
          </div>
          <div className="hub-apps">
            <AppGrid
              userApps={userApps}
              onRemoveApp={handleRemoveApp}
            />
          </div>
        </div>
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

