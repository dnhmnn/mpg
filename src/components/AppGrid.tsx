import { useNavigate } from 'react-router-dom'
import AppIcon from './AppIcon'
import type { App } from '../types'

const ALL_APPS: Record<string, App> = {
  einsaetze:     { id: 'einsaetze',     name: 'Einsätze',     icon: 'siren',      url: '/einsaetze.html',                    permission: 'einsaetze',        color: 'linear-gradient(145deg, #ef4444, #dc2626)' },
  patienten:     { id: 'patienten',     name: 'Patienten',    icon: 'clipboard',  url: '/patientendokumentation-dateien.html', permission: 'patienten',        color: 'linear-gradient(145deg, #3b82f6, #2563eb)' },
  dokumente:     { id: 'dokumente',     name: 'Vorgänge',     icon: 'file',       url: '/dokumente-bearbeiten.html',          permission: 'dokumente',        color: 'linear-gradient(145deg, #8b5cf6, #7c3aed)' },
  lager:         { id: 'lager',         name: 'Lager',        icon: 'package',    url: '/lager',                              permission: 'lager',            color: 'linear-gradient(145deg, #f97316, #ea580c)', isInternal: true },
  produktausgabe:{ id: 'produktausgabe',name: 'Ausgabe',      icon: 'check',      url: '/produktausgabe.html',                permission: 'produktausgabe',   color: 'linear-gradient(145deg, #22c55e, #16a34a)' },
  dateien:       { id: 'dateien',       name: 'Dateien',      icon: 'folder',     url: '/files',                              permission: 'dateien',          color: 'linear-gradient(145deg, #f59e0b, #d97706)', isInternal: true },
  qr:            { id: 'qr',            name: 'QR-Codes',     icon: 'qrcode',     url: '/qr-code-generator.html',             permission: 'qr',               color: 'linear-gradient(145deg, #14b8a6, #0d9488)' },
  lernbar:       { id: 'lernbar',       name: 'Unitas',       icon: 'graduation', url: '/unitas',                             permission: 'lernbar',          color: 'linear-gradient(145deg, #6366f1, #4f46e5)', isInternal: true },
  ausbildungen:  { id: 'ausbildungen',  name: 'Ausbildungen', icon: 'book',       url: '/ausbildungen',                       permission: 'ausbildungen_manage', color: 'linear-gradient(145deg, #1d4ed8, #1e3a8a)', isInternal: true },
  unitarii:      { id: 'unitarii',      name: 'Unitarii',     icon: 'users',      url: '/unitarii',                           permission: 'unitarii',         color: 'linear-gradient(145deg, #64748b, #475569)', isInternal: true },
  mpg:           { id: 'mpg',           name: 'MPG',          icon: 'mpg',        url: '/mpg',                                permission: 'dashboard',        color: 'linear-gradient(145deg, #b91c1c, #7f1d1d)', isInternal: true },
  chat:          { id: 'chat',          name: 'Chat',         icon: 'chat',       url: '/chat.html',                          permission: 'chat',             color: 'linear-gradient(145deg, #10b981, #059669)' },
  dashboard:     { id: 'dashboard',     name: 'Dashboard',    icon: 'dashboard',  url: '/mpg-dashboard.html',                 permission: 'dashboard',        color: 'linear-gradient(145deg, #ec4899, #db2777)' },
  settings:      { id: 'settings',      name: 'Einstellungen',icon: 'settings',   url: '/settings',                           permission: 'dashboard',        color: 'linear-gradient(145deg, #6b7280, #4b5563)', isInternal: true },
}

interface AppGridProps {
  userApps: string[]
  onRemoveApp: (id: string) => void
}

export default function AppGrid({ userApps, onRemoveApp }: AppGridProps) {
  const navigate = useNavigate()

  function handleRemoveApp(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    if (id === 'settings') { alert('Einstellungen können nicht entfernt werden'); return }
    onRemoveApp(id)
  }

  function handleAppClick(e: React.MouseEvent, app: App) {
    if (app.isInternal) { e.preventDefault(); navigate(app.url) }
  }

  return (
    <div className="apps">
      {userApps.map(id => {
        const app = ALL_APPS[id]
        if (!app) return null
        return (
          <a key={id} href={app.url} className="app" onClick={(e) => handleAppClick(e, app)}>
            <div className="remove-btn" onClick={(e) => handleRemoveApp(e, id)}>−</div>
            <div className="app-icon" style={{ background: app.color || 'var(--bg-card)', color: app.color ? '#fff' : 'var(--accent)', border: app.color ? 'none' : undefined }}>
              <AppIcon icon={app.icon} />
            </div>
            <div className="app-name">{app.name}</div>
          </a>
        )
      })}
    </div>
  )
}
