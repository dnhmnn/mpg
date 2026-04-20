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

  const secDeg = now.getSeconds() * 6

  return (
    <div className="widgets">
      <div className="widget">
        <div className="widget-title">Heute</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="widget-value" style={{ marginBottom: 0 }}>{now.getDate()}</div>
          <svg width="36" height="36" viewBox="-18 -18 36 36" style={{ flexShrink: 0 }}>
            <circle cx="0" cy="0" r="16" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
            <line
              x1="0" y1="2" x2="0" y2="-12"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
              transform={`rotate(${secDeg})`}
            />
            <circle cx="0" cy="0" r="2" fill="currentColor" />
          </svg>
        </div>
        <div className="widget-label">
          {now.toLocaleDateString('de-DE', { weekday: 'long' })}
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
