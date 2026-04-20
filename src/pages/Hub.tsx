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
  einsaetze:    { id: 'einsaetze',    name: 'Einsätze',     icon: 'siren',      url: '/einsaetze.html',                     permission: 'einsaetze',           color: 'linear-gradient(135deg, #ff3b30, #c03026)' },
  patienten:    { id: 'patienten',    name: 'Patienten',    icon: 'clipboard',  url: '/patientendokumentation-dateien.html', permission: 'patienten',           color: 'linear-gradient(135deg, #007aff, #0062cc)' },
  dokumente:    { id: 'dokumente',    name: 'Vorgänge',     icon: 'file',       url: '/dokumente-bearbeiten.html',           permission: 'dokumente',           color: 'linear-gradient(135deg, #af52de, #8e40b8)' },
  lager:        { id: 'lager',        name: 'Lager',        icon: 'package',    url: '/lager',                               permission: 'lager',               color: 'linear-gradient(135deg, #ff9500, #cc7800)', isInternal: true },
  dateien:      { id: 'dateien',      name: 'Dateien',      icon: 'folder',     url: '/files',                               permission: 'dateien',             color: 'linear-gradient(135deg, #ff9f0a, #cc8000)', isInternal: true },
  qr:           { id: 'qr',           name: 'QR-Codes',     icon: 'qrcode',     url: '/qr-code-generator.html',              permission: 'qr',                  color: 'linear-gradient(135deg, #32ade6, #2591c4)' },
  lernbar:      { id: 'lernbar',      name: 'Unitas',       icon: 'graduation', url: '/unitas',                              permission: 'lernbar',             color: 'linear-gradient(135deg, #5856d6, #4240b0)', isInternal: true },
  ausbildungen: { id: 'ausbildungen', name: 'Ausbildungen', icon: 'book',       url: '/ausbildungen',                        permission: 'ausbildungen_manage', color: 'linear-gradient(135deg, #1c7cd6, #1560a8)', isInternal: true },
  unitarii:     { id: 'unitarii',     name: 'Unitarii',     icon: 'users',      url: '/unitarii',                            permission: 'unitarii',            color: 'linear-gradient(135deg, #636e8a, #4a5370)', isInternal: true },
  mpg:          { id: 'mpg',          name: 'MPG',          icon: 'mpg',        url: '/mpg',                                 permission: 'dashboard',           color: 'linear-gradient(135deg, #c0392b, #962d22)', isInternal: true },
  chat:         { id: 'chat',         name: 'Chat',         icon: 'chat',       url: '/chat.html',                           permission: 'chat',                color: 'linear-gradient(135deg, #34c759, #27a447)' },
  settings:     { id: 'settings',     name: 'Einstellungen',icon: 'settings',   url: '#settings',                            permission: 'dashboard',           color: 'linear-gradient(135deg, #8e8e93, #6c6c72)', isInternal: true },
}

const ROLES: Record<string, { permissions: Record<string, boolean> }> = {
  mpg:       { permissions: { dashboard: true, einsaetze: true, lager: true, produktausgabe: true, lernbar: true, ausbildungen_manage: true, dokumente: true, patienten: true, dateien: true, qr: true, chat: true, unitarii: true } },
  lager:     { permissions: { dashboard: true, lager: true, produktausgabe: true, dateien: true, qr: true, chat: true } },
  ausbildung:{ permissions: { dashboard: true, einsaetze: true, lernbar: true, ausbildungen_manage: true, patienten: true, dateien: true, qr: true, chat: true } },
  qm:        { permissions: { dashboard: true, dokumente: true, dateien: true, qr: true, chat: true } },
  benutzer:  { permissions: { dashboard: true, lernbar: true, chat: true } },
}

export default function Hub() {
  const { user, loading, logout } = useAuth()
  const { currentNotification, dismissNotification, remindLater } = useNotifications(user)

  const [editMode, setEditMode] = useState(false)
  const [userApps, setUserApps] = useState<string[]>([])
  const [availableApps, setAvailableApps] = useState<App[]>([])

  const [showSettings, setShowSettings] = useState(false)
  const [showAppsModal, setShowAppsModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showWidgetsModal, setShowWidgetsModal] = useState(false)

  useEffect(() => {
    if (user) loadUserApps()
  }, [user])

  useEffect(() => {
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
      if (!apps.includes('settings')) apps.push('settings')
      // Auto-add newly permitted apps missing from saved layout
      const newApps = Object.keys(ALL_APPS).filter(id => {
        const app = ALL_APPS[id]
        return hasPermission(app.permission) && !apps.includes(id)
      })
      if (newApps.length > 0) {
        apps = [...apps, ...newApps]
        localStorage.setItem(`hub_apps_${user.id}`, JSON.stringify(apps))
      }
    } else {
      apps = Object.keys(ALL_APPS).filter(id => hasPermission(ALL_APPS[id].permission))
    }
    setUserApps(apps)
    updateAvailableApps(apps)
  }

  function updateAvailableApps(currentApps: string[]) {
    if (!user) return
    const available = Object.keys(ALL_APPS)
      .filter(id => id !== 'settings' && hasPermission(ALL_APPS[id].permission) && !currentApps.includes(id))
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

  if (loading) return null

  return (
    <>
      <style>{`
        @media (min-width: 768px) {
          .hub-layout {
            display: flex;
            flex-direction: row;
            gap: 32px;
            align-items: flex-start;
          }
          .hub-apps {
            flex: 1;
            min-width: 0;
            order: 1;
          }
          .hub-apps .apps {
            display: flex;
            flex-wrap: wrap;
            gap: 24px 20px;
            justify-content: center;
            padding: 0;
          }
          .hub-apps .app-icon {
            width: 64px;
            height: 64px;
            border-radius: 15px;
          }
          .hub-apps .app-icon svg {
            width: 30px;
            height: 30px;
          }
          .hub-apps .app-name {
            font-size: 12px;
            max-width: 70px;
          }
          .hub-widgets {
            flex: 1;
            min-width: 0;
            order: 2;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .hub-widgets .widgets {
            width: 100%;
            max-width: 380px;
            margin-bottom: 0;
          }
        }
        @media (min-width: 1100px) {
          .hub-layout { gap: 48px; }
        }
      `}</style>

      <StatusBar user={user} onLogout={logout} />

      <div className="content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: '20vh' }}>
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

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} user={user} />

      <AppsModal
        isOpen={showAppsModal}
        onClose={() => { setShowAppsModal(false); setEditMode(false) }}
        availableApps={availableApps}
        onAddApp={handleAddApp}
      />

      <EditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onEditApps={() => { setEditMode(true); setShowAppsModal(true) }}
        onEditWidgets={() => setShowWidgetsModal(true)}
      />

      <WidgetsModal isOpen={showWidgetsModal} onClose={() => setShowWidgetsModal(false)} />

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
