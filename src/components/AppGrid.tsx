import AppIcon from './AppIcon'
import type { App } from '../types'

interface AppGridProps {
  userApps: string[]
  onRemoveApp: (id: string) => void
}

const ALL_APPS: Record<string, App> = {
  einsaetze: { id: 'einsaetze', name: 'Einsätze', icon: 'siren', url: '/einsaetze.html', permission: 'einsaetze' },
  patienten: { id: 'patienten', name: 'Patienten', icon: 'clipboard', url: '/patientendokumentation-dateien.html', permission: 'patienten' },
  dokumente: { id: 'dokumente', name: 'Vorgänge', icon: 'file', url: '/dokumente-bearbeiten.html', permission: 'dokumente' },
  lager: { id: 'lager', name: 'Lager', icon: 'package', url: '/lagerverwaltung.html', permission: 'lager' },
  produktausgabe: { id: 'produktausgabe', name: 'Ausgabe', icon: 'check', url: '/produktausgabe.html', permission: 'produktausgabe' },
  dateien: { id: 'dateien', name: 'Dateien', icon: 'folder', url: '/dateien.html', permission: 'dateien' },
  qr: { id: 'qr', name: 'QR-Codes', icon: 'qrcode', url: '/qr-code-generator.html', permission: 'qr' },
  lernbar: { id: 'lernbar', name: 'Lernbar', icon: 'graduation', url: '/lernbar.html', permission: 'lernbar' },
  ausbildungen: { id: 'ausbildungen', name: 'Ausbildungen', icon: 'book', url: '/ausbildungen.html', permission: 'ausbildungen_manage' },
  chat: { id: 'chat', name: 'Chat', icon: 'chat', url: '/chat.html', permission: 'chat' },
  dashboard: { id: 'dashboard', name: 'Dashboard', icon: 'dashboard', url: '/mpg-dashboard.html', permission: 'dashboard' },
  settings: { id: 'settings', name: 'Einstellungen', icon: 'settings', url: '#settings', permission: 'dashboard', isInternal: true }
}

export default function AppGrid({ userApps, onRemoveApp }: AppGridProps) {
  function handleRemoveApp(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    
    if (id === 'settings') {
      alert('Einstellungen können nicht entfernt werden')
      return
    }
    
    onRemoveApp(id)
  }

  function handleAppClick(e: React.MouseEvent, app: App) {
    if (app.isInternal) {
      e.preventDefault()
      // Trigger settings modal
      const event = new CustomEvent('openSettings')
      window.dispatchEvent(event)
    }
  }

  return (
    <div className="apps">
      {userApps.map(id => {
        const app = ALL_APPS[id]
        if (!app) return null
        
        return (
          <a
            key={id}
            href={app.url}
            className="app"
            onClick={(e) => handleAppClick(e, app)}
          >
            <div 
              className="remove-btn" 
              onClick={(e) => handleRemoveApp(e, id)}
            >
              −
            </div>
            <div className="app-icon">
              <AppIcon icon={app.icon} />
            </div>
            <div className="app-name">{app.name}</div>
          </a>
        )
      })}
    </div>
  )
}
