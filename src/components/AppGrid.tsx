import { useNavigate } from 'react-router-dom'
import AppIcon from './AppIcon'
import type { App } from '../types'

const ALL_APPS: Record<string, App> = {
  einsaetze:    { id: 'einsaetze',    name: 'Einsätze',      icon: 'siren',      url: '/einsaetze',                permission: 'einsaetze',           color: '#600812', isInternal: true },
  patienten:    { id: 'patienten',    name: 'Patienten',     icon: 'clipboard',  url: '/patienten',                 permission: 'patienten',           color: '#600812', isInternal: true },
  dokumente:    { id: 'dokumente',    name: 'Vorgänge',      icon: 'file',       url: '/vorgaenge',                 permission: 'dokumente',           color: '#7a1020', isInternal: true },
  lager:        { id: 'lager',        name: 'Lager',         icon: 'package',    url: '/lager',                     permission: 'lager',               color: '#5c3800', isInternal: true },
  dateien:      { id: 'dateien',      name: 'Dateien',       icon: 'folder',     url: '/files',                     permission: 'dateien',             color: '#8a7a68', isInternal: true },
  qr:           { id: 'qr',           name: 'QR-Codes',      icon: 'qrcode',     url: '/qr-code-generator.html',    permission: 'qr',                  color: '#3d5c6e' },
  lernbar:      { id: 'lernbar',      name: 'Unitas',        icon: 'graduation', url: '/unitas',                    permission: 'lernbar',             color: '#600812', isInternal: true },
  ausbildungen: { id: 'ausbildungen', name: 'Ausbildungen',  icon: 'book',       url: '/ausbildungen',              permission: 'ausbildungen_manage', color: '#7a1020', isInternal: true },
  unitarii:     { id: 'unitarii',     name: 'Benutzer',      icon: 'users',      url: '/unitarii',                  permission: 'unitarii',            color: '#3d0408', isInternal: true },
  mpg:          { id: 'mpg',          name: 'MPG',           icon: 'mpg',        url: '/mpg',                       permission: 'dashboard',           color: '#600812', isInternal: true },
  chat:         { id: 'chat',         name: 'Chat',          icon: 'chat',       url: '/chat',                      permission: 'chat',                color: '#3d5c6e', isInternal: true },
  office:       { id: 'office',       name: 'Office',        icon: 'file-text',  url: '/office',                    permission: 'dateien',             color: '#1e3a8a', isInternal: true },
  settings:     { id: 'settings',     name: 'Einstellungen', icon: 'settings',   url: '#settings',                  permission: 'dashboard',           color: '#8a7a68', isInternal: true },
}

function extractColor(colorStr = ''): string {
  const m = colorStr.match(/#[0-9a-fA-F]{6}/)
  return m ? m[0] : '#600812'
}

interface AppGridProps {
  userApps: string[]
  editMode?: boolean
  onRemoveApp: (id: string) => void
  onAppClick?: (id: string) => void
}

export default function AppGrid({ userApps, editMode = false, onRemoveApp, onAppClick }: AppGridProps) {
  const navigate = useNavigate()

  function handleAppClick(app: App) {
    onAppClick?.(app.id)
    if (app.id === 'settings') {
      navigate('/settings')
      return
    }
    if (app.isInternal) navigate(app.url)
    else window.location.href = app.url
  }

  return (
    <div className="hub-app-grid" style={{ display: 'grid', gap: 12 }}>
      {userApps.map(id => {
        const app = ALL_APPS[id]
        if (!app) return null
        const iconColor = extractColor(app.color)
        return (
          <div key={id} style={{ position: 'relative' }}>
            {editMode && id !== 'settings' && (
              <button
                onClick={() => onRemoveApp(id)}
                style={{
                  position: 'absolute', top: -6, right: -6, zIndex: 10,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#600812', border: '2px solid #faf9f7',
                  color: '#fff', fontSize: 16, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontWeight: 700,
                }}
              >−</button>
            )}
            <button
              className="hub-app-card"
              onClick={() => handleAppClick(app)}
              style={{
                width: '100%', background: 'var(--lbf-card)', borderRadius: 14,
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: 'none',
                cursor: 'pointer', padding: '16px 8px 12px',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 8, fontFamily: 'inherit', transition: 'transform .12s',
              }}
              onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)' }}
              onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
            >
              <div className="hub-app-icon-wrap" style={{
                width: 52, height: 52, borderRadius: 14,
                background: iconColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', flexShrink: 0,
              }}>
                <div style={{ width: 26, height: 26 }}>
                  <AppIcon icon={app.icon} />
                </div>
              </div>
              <span className="hub-app-label" style={{
                fontSize: 12, fontWeight: 700, color: 'var(--lbf-text)',
                textAlign: 'center', lineHeight: 1.3, maxWidth: 80,
              }}>{app.name}</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
