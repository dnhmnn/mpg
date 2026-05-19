import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { getTheme, setTheme, applyTheme } from '../lib/theme'
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

const PREDEFINED_SHORTCUTS = [
  { id: 'protokoll',   name: 'Protokoll anlegen',          url: '/patienten' },
  { id: 'mpg',         name: 'MPG Prüfung starten',        url: '/mpg' },
  { id: 'ausbildung',  name: 'Ausbildungstermin anlegen',  url: '/ausbildungen' },
  { id: 'lernmodul',   name: 'Lernmodul erstellen',        url: '/lernbar' },
  { id: 'lernkonzept', name: 'Lernkonzept erstellen',      url: '/lernbar' },
  { id: 'einbuchen',   name: 'Artikel einbuchen',          url: '/lager' },
  { id: 'ausbuchen',   name: 'Artikel ausbuchen',          url: '/lager' },
  { id: 'inventur',    name: 'Inventur starten',           url: '/lager' },
  { id: 'darkmode',    name: 'Dark Mode umschalten',       url: null },
  { id: 'dateien',     name: 'Dateien suchen',             url: '/files' },
  { id: 'qr',          name: 'QR Code generieren',        url: '/qr' },
] as const

type ShortcutId = typeof PREDEFINED_SHORTCUTS[number]['id']

function ShortcutIcon({ id, color = 'currentColor' }: { id: ShortcutId; color?: string }) {
  const s = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  if (id === 'protokoll') return <svg width="18" height="18" viewBox="0 0 24 24" {...s}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
  if (id === 'mpg') return <svg width="18" height="18" viewBox="0 0 24 24" {...s}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
  if (id === 'ausbildung') return <svg width="18" height="18" viewBox="0 0 24 24" {...s}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  if (id === 'lernmodul') return <svg width="18" height="18" viewBox="0 0 24 24" {...s}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
  if (id === 'lernkonzept') return <svg width="18" height="18" viewBox="0 0 24 24" {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  if (id === 'einbuchen') return <svg width="18" height="18" viewBox="0 0 24 24" {...s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
  if (id === 'ausbuchen') return <svg width="18" height="18" viewBox="0 0 24 24" {...s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  if (id === 'inventur') return <svg width="18" height="18" viewBox="0 0 24 24" {...s}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/></svg>
  if (id === 'darkmode') return <svg width="18" height="18" viewBox="0 0 24 24" {...s}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
  if (id === 'dateien') return <svg width="18" height="18" viewBox="0 0 24 24" {...s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  if (id === 'qr') return <svg width="18" height="18" viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>
  return null
}

export default function Hub() {
  const navigate = useNavigate()
  const { user, loading, logout } = useAuth()
  const { currentNotification, dismissNotification, remindLater } = useNotifications(user)

  const [showGreeting] = useState(() => {
    const flag = sessionStorage.getItem('justLoggedIn')
    if (flag) { sessionStorage.removeItem('justLoggedIn'); return true }
    return false
  })
  const [greetingGone, setGreetingGone] = useState(false)

  useEffect(() => {
    if (!showGreeting) return
    const t = setTimeout(() => setGreetingGone(true), 2400)
    return () => clearTimeout(t)
  }, [showGreeting])

  const [editMode, setEditMode] = useState(false)
  const [userApps, setUserApps] = useState<string[]>([])
  const [availableApps, setAvailableApps] = useState<App[]>([])

  const [showSettings, setShowSettings] = useState(false)
  const [showAppsModal, setShowAppsModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showWidgetsModal, setShowWidgetsModal] = useState(false)
  const [recentApps, setRecentApps] = useState<string[]>([])
  const [newsOpen, setNewsOpen] = useState(false)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingShortcuts, setEditingShortcuts] = useState(false)
  const [enabledShortcuts, setEnabledShortcuts] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hub_shortcuts')
      return saved ? JSON.parse(saved) : PREDEFINED_SHORTCUTS.map(s => s.id)
    } catch { return PREDEFINED_SHORTCUTS.map(s => s.id) }
  })
  const touchStartY = useRef(0)

  function saveEnabledShortcuts(ids: string[]) {
    setEnabledShortcuts(ids)
    localStorage.setItem('hub_shortcuts', JSON.stringify(ids))
  }

  function toggleShortcut(id: string) {
    const next = enabledShortcuts.includes(id)
      ? enabledShortcuts.filter(x => x !== id)
      : [...enabledShortcuts, id]
    saveEnabledShortcuts(next)
  }

  function runShortcut(id: ShortcutId, url: string | null) {
    setSheetOpen(false)
    setEditingShortcuts(false)
    if (id === 'darkmode') {
      const next = getTheme() === 'dark' ? 'light' : 'dark'
      setTheme(next); applyTheme(next)
    } else if (url) {
      navigate(url)
    }
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
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

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
    <div style={{ background: 'var(--warm-bg)', height: '100dvh' } as React.CSSProperties}>
      {/* Full-viewport ivory backdrop — fills safe areas on iOS */}
      <div style={{ position: 'fixed', inset: 0, background: '#faf9f7', zIndex: 0, pointerEvents: 'none' }} />
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
          bottom: calc(10px + env(safe-area-inset-bottom));
          left: 50%;
          transform: translateX(-50%);
          background: #fff;
          border: 0.5px solid rgba(96,8,18,0.12);
          border-radius: 26px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 4px;
          box-shadow: none;
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
        .dock-btn:active { background: rgba(96,8,18,0.06); }
        .dock-icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
          background: var(--warm-bg);
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
          font-size: 9px;
          font-weight: 700;
          color: var(--warm-gray);
          text-align: center;
          max-width: 58px;
          overflow: hidden;
          text-overflow: ellipsis;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .dock-sep {
          width: 0.5px;
          height: 44px;
          background: rgba(96,8,18,0.12);
          margin: 0 6px;
          flex-shrink: 0;
        }
        .dock-recent {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 4px;
        }
        /* On mobile: compact dock — no labels, smaller icons */
        @media (max-width: 767px) {
          .dock-sep, .dock-recent { display: none; }
          .dock { padding: 8px 10px; border-radius: 22px; }
          .dock-btn { padding: 2px 5px; gap: 0; }
          .dock-label { display: none; }
          .dock-icon { width: 42px; height: 42px; }
          .dock-icon svg { width: 19px; height: 19px; }
        }
        /* Desktop dock: slightly larger icons */
        @media (min-width: 768px) {
          .dock-icon { width: 58px; height: 58px; border-radius: 50%; }
          .dock-icon svg { width: 26px; height: 26px; }
          .dock-label { font-size: 11px; max-width: 66px; }
          .dock-btn { padding: 4px 9px; }
        }
        @keyframes greetCurtainOut {
          0%   { opacity: 1; }
          60%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes greetNameSlide {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: none; }
        }
        .greeting-overlay {
          position: fixed; inset: 0; z-index: 999;
          background: #3d0408;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 10px;
          animation: greetCurtainOut 2.4s ease forwards;
          pointer-events: none;
        }
        .greeting-overlay.gone { display: none; }
        .greeting-sub {
          font-size: 15px; font-style: italic; font-weight: 400;
          color: rgba(253,232,216,0.5); letter-spacing: 0.04em;
          animation: greetNameSlide 0.5s ease-out both;
        }
        .greeting-name {
          font-style: italic; font-weight: 700;
          color: #fde8d8; line-height: 1;
          font-size: clamp(48px, 13vw, 80px);
          animation: greetNameSlide 0.5s 0.12s ease-out both;
        }
        @keyframes controlDrift {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          55% { transform: translateY(5px); opacity: 0.8; }
        }
        .control-handle-hub { animation: controlDrift 2.2s ease-in-out infinite; }
      `}</style>

      {showGreeting && !greetingGone && (
        <div className="greeting-overlay">
          <span className="greeting-sub">Servus,</span>
          <span className="greeting-name">
            {(user?.name || user?.email?.split('@')[0] || '').split(' ')[0]}
          </span>
        </div>
      )}

      <StatusBar user={user} onLogout={logout} />

      {/* Control handle — below the Abmelden button */}
      <div
        className="control-handle-hub"
        style={{ position: 'fixed', top: 62, right: 16, zIndex: 399, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
        onClick={() => setSheetOpen(true)}
        onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
        onTouchEnd={e => { if (touchStartY.current - e.changedTouches[0].clientY > 30) setSheetOpen(true) }}
      >
        <div style={{ width: 32, height: 3, borderRadius: 99, background: 'rgba(96,8,18,0.3)' }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: '#600812', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Control</span>
      </div>

      <div className="content hub-content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
        <div className="hub-layout">
          <div className="hub-widgets">
            <Widgets user={user} onNewsOpenChange={setNewsOpen} />
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

      {!newsOpen && (
        <>
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 'calc(80px + env(safe-area-inset-bottom))', background: 'var(--warm-bg)', zIndex: 398 }} />
          <Dock
            dockApps={dockApps}
            recentApps={recentDockApps}
            onAppClick={trackAppClick}
          />
        </>
      )}

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
        style={{ position: 'fixed', inset: 0, zIndex: 500, background: sheetOpen ? 'rgba(0,0,0,0.45)' : 'transparent', pointerEvents: sheetOpen ? 'all' : 'none', transition: 'background .3s', backdropFilter: sheetOpen ? 'blur(12px)' : 'none', WebkitBackdropFilter: sheetOpen ? 'blur(12px)' : 'none' }}
        onClick={() => { setSheetOpen(false); setEditingShortcuts(false) }}
      >
        <div
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(30,8,12,0.82)', borderRadius: '28px 28px 0 0', padding: '12px 20px calc(36px + env(safe-area-inset-bottom))', transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .38s cubic-bezier(0.32,0.72,0,1)', maxHeight: '75vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          onClick={e => e.stopPropagation()}
          onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
          onTouchEnd={e => { if (e.changedTouches[0].clientY - touchStartY.current > 50) { setSheetOpen(false); setEditingShortcuts(false) } }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.2)', margin: '0 auto 18px' }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '0.5px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff', letterSpacing: '-0.01em' }}>Kurzbefehle</span>
            <button
              onClick={() => setEditingShortcuts(e => !e)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 99, padding: '6px 14px', fontWeight: 600, fontSize: '.8rem', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.01em' }}
            >
              {editingShortcuts ? 'Fertig' : 'Bearbeiten'}
            </button>
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 10px' }}>
            {(editingShortcuts ? PREDEFINED_SHORTCUTS : PREDEFINED_SHORTCUTS.filter(s => enabledShortcuts.includes(s.id))).map(s => {
              const on = enabledShortcuts.includes(s.id)
              return (
                <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      onClick={() => editingShortcuts ? toggleShortcut(s.id) : runShortcut(s.id, s.url)}
                      style={{ width: 64, height: 64, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)', transition: 'background .2s, transform .1s' }}
                      onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)' }}
                      onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
                    >
                      <ShortcutIcon id={s.id} color={on ? '#6B0F1A' : 'rgba(255,255,255,0.85)'} />
                    </button>
                    {editingShortcuts && (
                      <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderRadius: '50%', background: on ? '#6B0F1A' : 'rgba(255,255,255,0.3)', border: '2px solid rgba(30,8,12,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        {on
                          ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        }
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 500, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 1.3, maxWidth: 68 }}>{s.name}</span>
                </div>
              )
            })}
            {!editingShortcuts && enabledShortcuts.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '.88rem', padding: '16px 0' }}>
                Tippe auf „Bearbeiten" um Kurzbefehle hinzuzufügen.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
