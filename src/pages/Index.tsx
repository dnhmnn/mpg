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
      <div className="index-container">
        <div className="index-header">
          <h1>{org?.org_name}</h1>
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
