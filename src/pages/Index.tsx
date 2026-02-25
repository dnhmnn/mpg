import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { pb } from '../lib/pocketbase'

interface Organization {
  org_name: string
  is_active: boolean
  org_code: string
  logo?: string
}

export default function Index() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const orgCode = urlParams.get('org')

    async function loadOrganization() {
      if (!orgCode) {
        setError('Keine Organisation in URL angegeben!')
        setLoading(false)
        return
      }

      try {
        const orgData = await pb.collection('organizations').getFirstListItem<Organization>(
          `org_code = "${orgCode}"`
        )

        if (!orgData.is_active) {
          setError('Diese Organisation ist nicht aktiv!')
          setLoading(false)
          return
        }

        setOrg(orgData)
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
          setError('Organisation nicht gefunden!')
        } else {
          setError('Fehler beim Laden der Organisation')
        }
      }

      setLoading(false)
    }

    loadOrganization()
  }, [])

  // Build organization logo URL - same as Hub
  let logoDisplay: JSX.Element | null = null
  if (org?.logo) {
    const logoUrl = pb.files.getUrl(org, org.logo, { thumb: '200x200' })
    logoDisplay = (
      <img
        src={logoUrl}
        alt={org.org_name}
        style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '8px' }}
      />
    )
  } else {
    logoDisplay = <div style={{ fontSize: '20px', lineHeight: 1 }}>🏢</div>
  }

  if (loading) {
    return null
  }

  if (error) {
    return (
      <div className="status-bar">
        <div className="logo">
          <svg width="120" height="32" viewBox="0 0 560 140">
            <rect x="20" y="20" width="100" height="100" rx="26" fill="rgba(255,255,255,0.25)"/>
            <path d="M45 42 L45 98 L60 98 L60 78 L72 78 L83 98 L100 98 L87 77 Q92 74 92 63 Q92 42 75 42 Z M60 52 L72 52 Q77 52 77 62 Q77 72 72 72 L60 72 Z" fill="white"/>
            <text x="140" y="80" fontFamily="Inter, sans-serif" fontSize="46" fontWeight="600" fill="white" letterSpacing="0">Responda</text>
          </svg>
        </div>
        <div className="org-logo">{logoDisplay}</div>
        <Link to="/login" className="logout-btn">Login</Link>
      </div>
    )
  }

  return (
    <>
      {/* Status Bar - Exactly like Hub */}
      <div className="status-bar">
        <div className="logo">
          <svg width="120" height="32" viewBox="0 0 560 140">
            <rect x="20" y="20" width="100" height="100" rx="26" fill="rgba(255,255,255,0.25)"/>
            <path d="M45 42 L45 98 L60 98 L60 78 L72 78 L83 98 L100 98 L87 77 Q92 74 92 63 Q92 42 75 42 Z M60 52 L72 52 Q77 52 77 62 Q77 72 72 72 L60 72 Z" fill="white"/>
            <text x="140" y="80" fontFamily="Inter, sans-serif" fontSize="46" fontWeight="600" fill="white" letterSpacing="0">Responda</text>
          </svg>
        </div>
        <div className="org-logo">{logoDisplay}</div>
        <Link to="/login" className="logout-btn">Login</Link>
      </div>

      {/* Content - Same as Hub */}
      <div className="content">
        {/* Widget */}
        <div className="widgets">
          <div className="widget">
            <div className="widget-title">Formulare</div>
            <div className="widget-value">{org?.org_name}</div>
            <div className="widget-label">Übersicht</div>
          </div>
        </div>

        {/* Apps Grid - Same as Hub */}
        <div className="apps">
          <Link to={`/hub?org=${org?.org_code}`} className="app">
            <div className="app-icon">
              <svg viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <span className="app-name">Patientendokumentation</span>
          </Link>

          <Link to={`/hub?org=${org?.org_code}`} className="app">
            <div className="app-icon">
              <svg viewBox="0 0 24 24">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <span className="app-name">Produktausgabe</span>
          </Link>

          <Link to={`/hub?org=${org?.org_code}`} className="app">
            <div className="app-icon">
              <svg viewBox="0 0 24 24">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <span className="app-name">CIRS-Meldung</span>
          </Link>
        </div>
      </div>
    </>
  )
}
