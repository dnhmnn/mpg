import { useNavigate } from 'react-router-dom'
import AppIcon from './AppIcon'
import type { App } from '../types'

interface DockProps {
  dockApps: App[]
  recentApps: App[]
  onAppClick: (id: string) => void
}

function DockBtn({ app, onAppClick }: { app: App; onAppClick: (id: string) => void }) {
  const navigate = useNavigate()
  const color = app.color?.match(/#[0-9a-fA-F]{6}/)?.[0] || 'var(--accent)'

  function handleClick(e: React.MouseEvent) {
    onAppClick(app.id)
    if (app.isInternal) { e.preventDefault(); navigate(app.url) }
  }

  return (
    <a href={app.url} className="dock-btn" onClick={handleClick}>
      <div className="dock-icon" style={{ background: 'var(--bg-card-solid)', color }}>
        <AppIcon icon={app.icon} />
      </div>
      <div className="dock-label">{app.name}</div>
    </a>
  )
}

export default function Dock({ dockApps, recentApps, onAppClick }: DockProps) {
  if (dockApps.length === 0) return null

  return (
    <div className="dock">
      {dockApps.map(app => <DockBtn key={app.id} app={app} onAppClick={onAppClick} />)}
      {recentApps.length > 0 && (
        <>
          <div className="dock-sep" />
          <div className="dock-recent">
            {recentApps.map(app => <DockBtn key={app.id} app={app} onAppClick={onAppClick} />)}
          </div>
        </>
      )}
    </div>
  )
}
