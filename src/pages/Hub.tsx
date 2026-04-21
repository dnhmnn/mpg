import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import StatusBar from '../components/StatusBar'
import Widgets from '../components/Widgets'
import AppGrid from '../components/AppGrid'
import Dock from '../components/Dock'
import SettingsModal from '../components/SettingsModal'
import AppsModal from '../components/AppsModal'
import EditModal from '../components/EditModal'
import WidgetsModal from '../components/WidgetsModal'
import NotificationModal from '../components/NotificationModal'
import type { App } from '../types'

const DOCK_APP_IDS = ['einsaetze', 'patienten', 'ausbildungen', 'mpg']

const ALL_APPS: Record<string, App> = {
  einsaetze:    { id: 'einsaetze',    name: 'Einsätze',     icon: 'siren',      url: '/einsaetze.html',                     permission: 'einsaetze',           color: 'linear-gradient(135deg, #ff3b30, #c03026)' },
  patienten:    { id: 'patienten',    name: 'Patienten',    icon: 'clipboard',  url: '/patienten',                           permission: 'patienten',           color: 'linear-gradient(135deg, #007aff, #0062cc)', isInternal: true },
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
  const [recentApps, setRecentApps] = useState<string[]>([])

  useEffect(() => {
    if (user) {
      loadUserApps()
      const saved = localStorage.getItem(`hub_recent_${user.id}`)
      setRecentApps(saved ? JSON.parse(saved) : [])
    }
  }, [user])

  function trackAppClick(id: string) {
    if (!user) return
    setRecentApps(prev => {
      const updated = [id, ...prev.filter(r => r !== id)].slice(0, 20)
      localStorage.setItem(`hub_recent_${user.id}`, JSON.stringify(updated))
      return updated
    })
  }

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

  const dockApps = DOCK_APP_IDS
    .filter(id => ALL_APPS[id] && hasPermission(ALL_APPS[id].permission))
    .map(id => ALL_APPS[id])

  const recentDockApps = recentApps
    .filter(id => !DOCK_APP_IDS.includes(id) && userApps.includes(id) && ALL_APPS[id])
    .slice(0, 3)
    .map(id => ALL_APPS[id])

  return (
    <>
      <style>{`
        @media (min-width: 768px) {
          .hub-layout {
            display: flex;
            flex-direction: row;
            gap: 32px;
            align-items: stretch;
          }
          .hub-apps {
            flex: 1;
            min-width: 0;
            order: 1;
            display: flex;
            align-items: center;
          }
          .hub-apps .apps {
            display: flex;
            flex-wrap: wrap;
            gap: 24px 20px;
            justify-content: center;
            padding: 0;
          }
          .hub-apps .app-icon {
            width: 76px;
            height: 76px;
            border-radius: 18px;
          }
          .hub-apps .app-icon svg {
            width: 34px;
            height: 34px;
          }
          .hub-apps .app-name {
            font-size: 12px;
            max-width: 80px;
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
          .hub-widgets .widget {
            min-height: 140px;
            padding: 20px;
            border-radius: 24px;
          }
          .hub-widgets .widget-title { font-size: 14px; }
          .hub-widgets .widget-value { font-size: 36px; }
          .hub-widgets .widget-label { font-size: 15px; }
        }
        .hub-content { padding-bottom: 8vh; }
        @media (max-width: 767px) {
          .hub-content { padding-top: 110px; }
          .hub-widgets .widget { min-height: 70px; padding: 8px 12px; }
          .hub-widgets .widget-title { font-size: 11px; margin-bottom: 2px; }
          .hub-widgets .widget-value { font-size: 22px; }
          .hub-widgets .widget-label { font-size: 12px; margin-top: 2px; }
        }
        @media (min-width: 768px) {
          .hub-content { justify-content: center; padding-bottom: 32vh; }
        }
        @media (min-width: 1100px) {
          .hub-layout { gap: 48px; }
          .hub-widgets .widgets {
            max-width: 480px;
            gap: 16px;
          }
          .hub-widgets .widget {
            min-height: 170px;
            padding: 26px;
            border-radius: 28px;
          }
          .hub-widgets .widget-title { font-size: 15px; }
          .hub-widgets .widget-value { font-size: 48px; }
          .hub-widgets .widget-label { font-size: 17px; }
          .hub-apps .apps { gap: 28px 24px; }
          .hub-apps .app-icon {
            width: 96px;
            height: 96px;
            border-radius: 22px;
          }
          .hub-apps .app-icon svg {
            width: 44px;
            height: 44px;
          }
          .hub-apps .app-name {
            font-size: 13px;
            max-width: 96px;
          }
        }

        /* ── Dock ── */
        .dock {
          position: fixed;
          bottom: calc(14px + env(safe-area-inset-bottom));
          left: 50%;
          transform: translateX(-50%);
          background: var(--bg-card);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 0.5px solid var(--border);
          border-radius: 26px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 4px;
          box-shadow: 0 6px 28px rgba(0,0,0,0.14);
          z-index: 400;
          white-space: nowrap;
        }
        .dock-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          text-decoration: none;
          color: inherit;
          padding: 4px 7px;
          border-radius: 14px;
          transition: background 0.15s;
        }
        .dock-btn:active { background: var(--bg-hover); }
        .dock-icon {
          width: 52px;
          height: 52px;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .dock-icon svg {
          width: 24px;
          height: 24px;
          stroke: currentColor;
          fill: none;
          stroke-width: 1.5;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .dock-label {
          font-size: 10px;
          font-weight: 400;
          color: var(--text);
          text-align: center;
          max-width: 58px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dock-sep {
          width: 1px;
          height: 44px;
          background: var(--border-medium);
          margin: 0 6px;
          flex-shrink: 0;
        }
        /* Hide dock apps from main grid on all screen sizes */
        .app[data-app-id="einsaetze"],
        .app[data-app-id="patienten"],
        .app[data-app-id="ausbildungen"],
        .app[data-app-id="mpg"] { display: none; }
        /* On mobile: hide recent section in dock */
        @media (max-width: 767px) {
          .dock-sep, .dock-recent { display: none; }
        }
        /* Desktop dock: slightly larger icons */
        @media (min-width: 768px) {
          .dock-icon { width: 58px; height: 58px; border-radius: 14px; }
          .dock-icon svg { width: 26px; height: 26px; }
          .dock-label { font-size: 11px; max-width: 66px; }
          .dock-btn { padding: 4px 9px; }
        }
      `}</style>

      <StatusBar user={user} onLogout={logout} />

      <div className="content hub-content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
        <div className="hub-layout">
          <div className="hub-widgets">
            <Widgets user={user} />
          </div>
          <div className="hub-apps">
            <AppGrid
              userApps={userApps}
              onRemoveApp={handleRemoveApp}
              onAppClick={trackAppClick}
            />
          </div>
        </div>
      </div>

      <Dock
        dockApps={dockApps}
        recentApps={recentDockApps}
        onAppClick={trackAppClick}
      />

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
