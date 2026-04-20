import { useState, useEffect } from 'react'
import { pb } from '../lib/pocketbase'
import type { User } from '../types'

interface WidgetsProps {
  user: User | null
}

export default function Widgets({ user }: WidgetsProps) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const orgName = user?.organization_name || 'Responda'
  const orgLogoFile = user?.organization_logo || ''

  let logoDisplay: JSX.Element
  if (orgLogoFile && user?.organization && orgLogoFile !== '🏢') {
    const logoUrl = pb.files.getUrl(user.organization, orgLogoFile, { thumb: '500x500' })
    logoDisplay = (
      <img
        src={logoUrl}
        alt={orgName}
        style={{ width: '100px', height: '100px', objectFit: 'contain', borderRadius: '12px' }}
      />
    )
  } else {
    logoDisplay = <div style={{ fontSize: '100px', lineHeight: 1 }}>🏢</div>
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  const secStr = pad(now.getSeconds())

  return (
    <div className="widgets">
      <div className="widget">
        <div className="widget-title">Heute</div>
        <div className="widget-value">{now.getDate()}</div>
        <div className="widget-label">
          {now.toLocaleDateString('de-DE', { weekday: 'long' })}
        </div>
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '0.5px' }}>{timeStr}</span>
          <span style={{ fontSize: '14px', fontWeight: 500, opacity: 0.6 }}>{secStr}</span>
        </div>
      </div>

      <div className="widget" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {logoDisplay}
      </div>

      <div className="widget large">
        <div className="widget-title">Neuigkeiten</div>
        <div style={{ fontSize: '14px', lineHeight: 1.6, opacity: 0.9, marginTop: '8px' }}>
          Willkommen zurück! Keine neuen Nachrichten.
        </div>
      </div>
    </div>
  )
}
