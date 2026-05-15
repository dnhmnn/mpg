import { useNavigate } from 'react-router-dom'
import AppIcon from './AppIcon'
import type { App } from '../types'

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
  chat:         { id: 'chat',         name: 'Chat',         icon: 'chat',       url: '/chat',                                permission: 'chat',                color: 'linear-gradient(135deg, #34c759, #27a447)', isInternal: true },
  settings:     { id: 'settings',     name: 'Einstellungen',icon: 'settings',   url: '/settings',                            permission: 'dashboard',           color: 'linear-gradient(135deg, #8e8e93, #6c6c72)', isInternal: true },
}

interface AppGridProps {
  userApps: string[]
  onRemoveApp: (id: string) => void
  onAppClick?: (id: string) => void
  dockPinIds?: string[]
}

export default function AppGrid({ userApps, onRemoveApp, onAppClick, dockPinIds = [] }: AppGridProps) {
  const navigate = useNavigate()

  function handleRemoveApp(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    if (id === 'settings') { alert('Einstellungen können nicht entfernt werden'); return }
    onRemoveApp(id)
  }

  function handleAppClick(e: React.MouseEvent, app: App) {
    onAppClick?.(app.id)
    if (app.isInternal) { e.preventDefault(); navigate(app.url) }
  }

  return (
    <div className="apps">
      {userApps.map(id => {
        const app = ALL_APPS[id]
        if (!app) return null
        return (
          <a key={id} href={app.url} className={`app${dockPinIds.includes(id) ? ' app-dock-pinned' : ''}`} data-app-id={id} onClick={(e) => handleAppClick(e, app)}>
            <div className="remove-btn" onClick={(e) => handleRemoveApp(e, id)}>−</div>
            <div className="app-icon" style={{ background: 'var(--bg-card)', color: app.color?.match(/#[0-9a-fA-F]{6}/)?.[0] || 'var(--accent)' }}>
              <AppIcon icon={app.icon} />
            </div>
            <div className="app-name">{app.name}</div>
          </a>
        )
      })}
    </div>
  )
}
