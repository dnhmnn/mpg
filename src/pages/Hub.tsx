import React, { useState, useEffect, useRef } from 'react'
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
import { ALL_APPS, ROLES, getDockPins, MAX_DOCK_RECENT } from '../lib/apps'
import type { App } from '../types'

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

  const [sheetOpen, setSheetOpen] = useState(false)
  const [shortcuts, setShortcuts] = useState<{ name: string; url: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('hub_shortcuts') || '[]') } catch { return [] }
  })
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const touchStartY = useRef(0)

  function saveShortcuts(list: { name: string; url: string }[]) {
    setShortcuts(list)
    localStorage.setItem('hub_shortcuts', JSON.stringify(list))
  }

  function addShortcut() {
    if (!newName.trim() || !newUrl.trim()) return
    saveShortcuts([...shortcuts, { name: newName.trim(), url: newUrl.trim() }])
    setNewName(''); setNewUrl(''); setAdding(false)
  }

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

  const dockPinIds = user ? getDockPins(user.id) : []
  const dockApps = dockPinIds
    .filter(id => ALL_APPS[id] && hasPermission(ALL_APPS[id].permission))
    .map(id => ALL_APPS[id])

  const recentDockApps = recentApps
    .filter(id => !dockPinIds.includes(id) && userApps.includes(id) && ALL_APPS[id])
    .slice(0, MAX_DOCK_RECENT)
    .map(id => ALL_APPS[id])

  return (
    <div style={{ '--bg-card': 'rgba(107,15,26,0.06)', '--bg-subtle': 'rgba(107,15,26,0.03)', '--border': 'rgba(107,15,26,0.12)', '--border-medium': 'rgba(107,15,26,0.15)', '--shadow-sm': '0 2px 16px rgba(107,15,26,0.08)' } as React.CSSProperties}>
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
            border-radius: 50%;
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
            border-radius: 50%;
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
          bottom: calc(4px + env(safe-area-inset-bottom));
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
        .dock-recent {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 4px;
        }
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
        @keyframes controlDrift {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          55% { transform: translateY(5px); opacity: 0.8; }
        }
        .control-handle-hub { animation: controlDrift 2.2s ease-in-out infinite; }
      `}</style>

      <StatusBar user={user} onLogout={logout} />

      {/* Control handle — below the Abmelden button */}
      <div
        className="control-handle-hub"
        style={{ position: 'fixed', top: 62, right: 16, zIndex: 399, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
        onClick={() => setSheetOpen(true)}
        onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
        onTouchEnd={e => { if (touchStartY.current - e.changedTouches[0].clientY > 30) setSheetOpen(true) }}
      >
        <div style={{ width: 32, height: 4, borderRadius: 99, background: 'rgba(0,0,0,0.22)' }} />
        <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(0,0,0,0.28)', letterSpacing: '.06em' }}>control</span>
      </div>

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
              dockPinIds={dockPinIds}
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

      {/* Bottom Sheet Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 500, background: sheetOpen ? 'rgba(0,0,0,0.25)' : 'transparent', pointerEvents: sheetOpen ? 'all' : 'none', transition: 'background .3s', backdropFilter: sheetOpen ? 'blur(4px)' : 'none' }}
        onClick={() => { setSheetOpen(false); setAdding(false) }}
      >
        <div
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '22px 22px 0 0', padding: '10px 20px calc(32px + env(safe-area-inset-bottom))', transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .35s cubic-bezier(0.32,0.72,0,1)', maxHeight: '70vh', overflowY: 'auto', boxShadow: '0 -4px 32px rgba(0,0,0,0.12)' }}
          onClick={e => e.stopPropagation()}
          onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
          onTouchEnd={e => { if (e.changedTouches[0].clientY - touchStartY.current > 50) { setSheetOpen(false); setAdding(false) } }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(0,0,0,0.15)', margin: '0 auto 18px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1d1d1f' }}>Kurzbefehle</span>
            {!adding && (
              <button onClick={() => setAdding(true)} style={{ background: 'rgba(107,15,26,0.08)', border: 'none', borderRadius: 8, padding: '5px 12px', fontWeight: 700, fontSize: '.82rem', color: '#6B0F1A', cursor: 'pointer', fontFamily: 'inherit' }}>+ Neu</button>
            )}
          </div>
          {shortcuts.length === 0 && !adding && (
            <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: '.9rem', textAlign: 'center', margin: '24px 0' }}>Noch keine Kurzbefehle. Tippe auf „+ Neu".</p>
          )}
          {shortcuts.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(107,15,26,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B0F1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </div>
              <button
                onClick={() => { setSheetOpen(false); window.location.href = s.url }}
                style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: '.95rem', color: '#1d1d1f', fontWeight: 600, padding: 0 }}
              >
                {s.name}
                <div style={{ fontSize: '.75rem', color: 'rgba(0,0,0,0.35)', fontWeight: 400, marginTop: 1 }}>{s.url}</div>
              </button>
              <button onClick={() => saveShortcuts(shortcuts.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.25)', fontSize: 20, lineHeight: 1, padding: '4px 6px', flexShrink: 0 }}>×</button>
            </div>
          ))}
          {adding && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                style={{ width: '100%', padding: '10px 14px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', background: '#fff', color: '#1d1d1f', boxSizing: 'border-box' }}
                placeholder="Name (z.B. Ausbildungstermin anlegen)"
                value={newName} onChange={e => setNewName(e.target.value)} autoFocus
              />
              <input
                style={{ width: '100%', padding: '10px 14px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', background: '#fff', color: '#1d1d1f', boxSizing: 'border-box' }}
                placeholder="URL (z.B. /ausbildungen/neu)"
                value={newUrl} onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addShortcut()}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={addShortcut} style={{ flex: 1, background: '#6B0F1A', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '.9rem' }}>Hinzufügen</button>
                <button onClick={() => { setAdding(false); setNewName(''); setNewUrl('') }} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 10, padding: '11px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '.9rem', color: '#1d1d1f' }}>Abbrechen</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
