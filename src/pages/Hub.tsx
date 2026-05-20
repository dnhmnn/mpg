import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { getTheme, setTheme, applyTheme } from '../lib/theme'
import Widgets from '../components/Widgets'
import AppGrid from '../components/AppGrid'
import SettingsModal from '../components/SettingsModal'
import AppsModal from '../components/AppsModal'
import EditModal from '../components/EditModal'
import WidgetsModal from '../components/WidgetsModal'
import NotificationModal from '../components/NotificationModal'
import { ALL_APPS, ROLES } from '../lib/apps'
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

function initials(name?: string | null): string {
  if (!name) return 'R'
  const p = name.trim().split(/\s+/)
  return p.length > 1 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

export default function Hub() {
  const navigate = useNavigate()
  const { user, loading, logout } = useAuth()
  const { currentNotification, dismissNotification, remindLater } = useNotifications(user)

  const [logoError, setLogoError] = useState(false)

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
    if (user) loadUserApps()
  }, [user])

  function trackAppClick(id: string) {
    if (!user) return
    const key = `hub_recent_${user.id}`
    const prev = (() => { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } })()
    localStorage.setItem(key, JSON.stringify([id, ...prev.filter((r: string) => r !== id)].slice(0, 20)))
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

  const firstName = (user?.name || user?.email?.split('@')[0] || '').split(' ')[0]

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>
      <style>{`
        @keyframes greetCurtainOut { 0%,60%{opacity:1} 100%{opacity:0} }
        @keyframes greetNameSlide { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
        .hub-greeting-overlay {
          position:fixed;inset:0;z-index:9999;background:#3d0408;
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
          animation:greetCurtainOut 2.4s ease forwards;pointer-events:none;
        }
        @keyframes controlDrift {
          0%,100%{transform:translateY(0);opacity:0.45}
          55%{transform:translateY(5px);opacity:0.9}
        }
        .hub-control-handle { animation: controlDrift 2.2s ease-in-out infinite; }

        /* App grid + card sizing — mobile first (4 cols, compact) */
        .hub-app-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .hub-app-card { padding: 10px 4px 8px !important; }
        .hub-app-icon-wrap { width: 38px !important; height: 38px !important; border-radius: 10px !important; }
        .hub-app-icon-wrap > div { width: 18px !important; height: 18px !important; }
        .hub-app-label { font-size: 10px !important; max-width: 64px !important; }

        /* Mobile column order: greeting+news first, apps second */
        .hub-cols { display: flex; flex-direction: column; gap: 16px; }
        .hub-side-col { order: 1; }
        .hub-module-col { order: 2; }

        /* Tablet+ two-column layout */
        @media (min-width: 768px) {
          .hub-body { max-width: 1100px !important; }
          .hub-cols {
            display: grid;
            grid-template-columns: 1fr 320px;
            gap: 48px;
            align-items: start;
          }
          .hub-side-col { order: 2; }
          .hub-module-col { order: 1; }
          .hub-app-grid { grid-template-columns: repeat(4, 1fr); gap: 12px; }
          .hub-app-card { padding: 16px 8px 12px !important; }
          .hub-app-icon-wrap { width: 52px !important; height: 52px !important; border-radius: 14px !important; }
          .hub-app-icon-wrap > div { width: 26px !important; height: 26px !important; }
          .hub-app-label { font-size: 12px !important; max-width: 80px !important; }
        }
        @media (min-width: 1100px) {
          .hub-body { max-width: 1400px !important; }
          .hub-cols { grid-template-columns: 1fr 360px; gap: 64px; }
          .hub-app-grid { grid-template-columns: repeat(5, 1fr); }
        }
      `}</style>

      {/* Greeting overlay */}
      {showGreeting && !greetingGone && (
        <div className="hub-greeting-overlay">
          <span style={{ fontSize: 15, fontStyle: 'italic', color: 'rgba(253,232,216,0.5)', letterSpacing: '0.04em', animation: 'greetNameSlide 0.5s ease-out both' }}>Servus,</span>
          <span style={{ fontStyle: 'italic', fontWeight: 700, color: '#fde8d8', fontSize: 'clamp(48px,13vw,80px)', lineHeight: 1, animation: 'greetNameSlide 0.5s 0.12s ease-out both' }}>
            {firstName}
          </span>
        </div>
      )}

      {/* Masthead header — sticky, handles safe area */}
      <div style={{
        background: '#fff',
        borderBottom: '0.5px solid rgba(96,8,18,0.12)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'max(20px, env(safe-area-inset-left))',
        paddingRight: 'max(20px, env(safe-area-inset-right))',
      } as React.CSSProperties}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {!logoError
              ? <img src="/logo.png" alt="Responda" onError={() => setLogoError(true)} style={{ height: 34, width: 34, objectFit: 'contain' }} />
              : <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#600812', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>R</span></div>
            }
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '0 12px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: '#1a0e08', lineHeight: 1.2 }}>
              {user?.organization_name || 'Responda'}
            </div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>
              {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            style={{ width: 34, height: 34, borderRadius: '50%', border: '1.5px solid #600812', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#600812', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' } as React.CSSProperties}
          >
            {initials(user?.name || user?.email)}
          </button>
        </div>
      </div>

      {/* Page content */}
      <div className="hub-body" style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '24px max(20px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 48px)',
      } as React.CSSProperties}>
        <div className="hub-cols">

          {/* Left / main column: Module grid */}
          <div className="hub-module-col" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Module</div>
              <button
                onClick={() => setEditMode(prev => !prev)}
                style={{ fontSize: 11, fontWeight: 600, color: editMode ? '#600812' : 'var(--warm-gray)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 0' }}
              >
                {editMode ? 'Fertig' : 'Bearbeiten'}
              </button>
            </div>
            <AppGrid
              userApps={userApps}
              editMode={editMode}
              onRemoveApp={handleRemoveApp}
              onAppClick={trackAppClick}
            />
            {editMode && (
              <button
                onClick={() => { setEditMode(false); setShowAppsModal(true) }}
                style={{ width: '100%', padding: '12px', background: '#fff', border: '1px dashed rgba(96,8,18,0.2)', borderRadius: 12, fontSize: 13, fontWeight: 600, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                + App hinzufügen
              </button>
            )}
          </div>

          {/* Right / side column: Greeting + News */}
          <div className="hub-side-col" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1a0e08', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Servus, <span style={{ color: '#600812', fontStyle: 'italic' }}>{firstName}</span>
              </div>
            </div>
            <Widgets user={user} />
          </div>

        </div>


      </div>

      {/* Animated Control handle — fixed below header, above user avatar */}
      <div
        className="hub-control-handle"
        style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 68px)', right: 16, zIndex: 399, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
        onClick={() => setSheetOpen(true)}
        onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
        onTouchEnd={e => { if (touchStartY.current - e.changedTouches[0].clientY > 30) setSheetOpen(true) }}
      >
        <div style={{ width: 32, height: 3, borderRadius: 99, background: 'rgba(96,8,18,0.3)' }} />
        <div style={{ width: 24, height: 2, borderRadius: 99, background: 'rgba(96,8,18,0.18)' }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: '#600812', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 1 }}>Control</span>
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

      {/* Kurzbefehle bottom sheet */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 500, background: sheetOpen ? 'rgba(0,0,0,0.3)' : 'transparent', pointerEvents: sheetOpen ? 'all' : 'none', transition: 'background .3s', backdropFilter: sheetOpen ? 'blur(8px)' : 'none', WebkitBackdropFilter: sheetOpen ? 'blur(8px)' : 'none' } as React.CSSProperties}
        onClick={() => { setSheetOpen(false); setEditingShortcuts(false) }}
      >
        <div
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '22px 22px 0 0', padding: '12px 20px calc(24px + env(safe-area-inset-bottom))', transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .38s cubic-bezier(0.32,0.72,0,1)', maxHeight: '75vh', overflowY: 'auto', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)' } as React.CSSProperties}
          onClick={e => e.stopPropagation()}
          onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
          onTouchEnd={e => { if (e.changedTouches[0].clientY - touchStartY.current > 50) { setSheetOpen(false); setEditingShortcuts(false) } }}
        >
          <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(96,8,18,0.15)', margin: '0 auto 20px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '0.5px solid rgba(96,8,18,0.08)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Kurzbefehle</span>
            <button
              onClick={() => setEditingShortcuts(prev => !prev)}
              style={{ background: 'rgba(96,8,18,0.06)', border: 'none', borderRadius: 99, padding: '6px 14px', fontWeight: 600, fontSize: 11, color: '#600812', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {editingShortcuts ? 'Fertig' : 'Bearbeiten'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 10px' }}>
            {(editingShortcuts ? PREDEFINED_SHORTCUTS : PREDEFINED_SHORTCUTS.filter(s => enabledShortcuts.includes(s.id))).map(s => {
              const on = enabledShortcuts.includes(s.id)
              return (
                <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => editingShortcuts ? toggleShortcut(s.id) : runShortcut(s.id, s.url)}
                      style={{ width: 60, height: 60, borderRadius: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? '#600812' : 'rgba(96,8,18,0.07)', transition: 'background .2s, transform .1s' }}
                      onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)' }}
                      onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
                    >
                      <ShortcutIcon id={s.id} color={on ? '#fff' : '#600812'} />
                    </button>
                    {editingShortcuts && (
                      <div style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: on ? '#600812' : 'rgba(96,8,18,0.2)', border: '2px solid var(--warm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {on
                          ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        }
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: on ? '#1a0e08' : 'var(--warm-gray)', textAlign: 'center', lineHeight: 1.3, maxWidth: 64 }}>{s.name}</span>
                </div>
              )
            })}
            {!editingShortcuts && enabledShortcuts.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--warm-gray)', fontSize: 13, fontStyle: 'italic', padding: '16px 0' }}>
                Tippe auf „Bearbeiten" um Kurzbefehle hinzuzufügen.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
