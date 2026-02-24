import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { pb } from '../lib/pocketbase'

interface Organization {
  org_name: string
  is_active: boolean
  org_code: string
}

export default function Index() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Organisation aus URL lesen
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

  if (loading) {
    return (
      <div className="index-page">
        <div className="index-loading">
          <span className="spinner">🔄</span> Lade Organisation...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="index-page">
        <div className="index-error">
          <span>❌</span> {error}
        </div>
      </div>
    )
  }

  return (
    <div className="index-page">
      {/* Header */}
      <div className="index-top-header">
        <div className="index-logo">
          <svg width="120" height="32" viewBox="0 0 560 140">
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#ffffff', stopOpacity: 0.9 }} />
              </linearGradient>
            </defs>
            <rect x="20" y="20" width="100" height="100" rx="26" fill="rgba(255,255,255,0.25)"/>
            <path d="M45 42 L45 98 L60 98 L60 78 L72 78 L83 98 L100 98 L87 77 Q92 74 92 63 Q92 42 75 42 Z M60 52 L72 52 Q77 52 77 62 Q77 72 72 72 L60 72 Z" fill="white"/>
            <text x="140" y="80" fontFamily="Inter, sans-serif" fontSize="46" fontWeight="600" fill="white" letterSpacing="0">Responda</text>
          </svg>
        </div>
        <Link to="/login" className="index-login-btn">Login</Link>
      </div>

      <div className="index-container">
        <div className="index-header">
          <p>Formulare</p>
        </div>

        <div className="index-body">
          <Link to={`/hub?org=${org?.org_code}`} className="index-card">
            <div className="index-icon">🧾</div>
            <h2>Patientendokumentation</h2>
            <p>Dokumentiere Einsätze und Patienteninformationen</p>
          </Link>

          <Link to={`/hub?org=${org?.org_code}`} className="index-card">
            <div className="index-icon">📦</div>
            <h2>Produktausgabe</h2>
            <p>Dokumentiere ausgegebene Materialien und Produkte</p>
          </Link>

          <Link to={`/hub?org=${org?.org_code}`} className="index-card">
            <div className="index-icon">⚠️</div>
            <h2>CIRS-Meldung</h2>
            <p>Melde kritische Ereignisse und Beinahe-Unfälle</p>
          </Link>
        </div>

        <div className="index-footer">
          <Link to="/hub">Zum Dashboard</Link>
        </div>
      </div>
    </div>
  )
}
