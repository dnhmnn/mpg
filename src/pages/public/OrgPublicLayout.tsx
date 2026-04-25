import { createContext, useContext, useEffect, useState } from 'react'
import { useParams, Outlet } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'

export interface Organization {
  id: string
  org_code: string
  org_name: string
  logo: string
  is_active: boolean
}

interface OrgCtx { org: Organization; orgCode: string }
const OrgContext = createContext<OrgCtx | null>(null)
export function useOrg() {
  const c = useContext(OrgContext)
  if (!c) throw new Error('useOrg outside OrgPublicLayout')
  return c
}

const bg: React.CSSProperties = { minHeight: '100vh', background: 'linear-gradient(135deg,#667eea,#764ba2)', fontFamily: 'system-ui,sans-serif' }
const center: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }
const card: React.CSSProperties = { background: '#fff', borderRadius: '0.75rem', padding: '2rem', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.15)' }

export default function OrgPublicLayout() {
  const { orgCode } = useParams<{ orgCode: string }>()
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgCode) { setError('Kein Organisationscode.'); setLoading(false); return }
    pb.collection('organizations').getFirstListItem<Organization>(`org_code = "${orgCode}"`)
      .then(r => r.is_active ? setOrg(r) : setError('Organisation nicht aktiv.'))
      .catch(() => setError('Organisation nicht gefunden.'))
      .finally(() => setLoading(false))
  }, [orgCode])

  if (loading) return (
    <div style={bg}><div style={center}><div style={card}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 48, height: 48, border: '4px solid #e2e8f0', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 1rem' }} />
      <p style={{ color: '#666', margin: 0 }}>Lade Organisation…</p>
    </div></div></div>
  )

  if (error || !org) return (
    <div style={bg}><div style={center}><div style={{ ...card, border: '2px solid #c8102e' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
      <h2 style={{ color: '#c8102e', margin: '0 0 .5rem' }}>Fehler</h2>
      <p style={{ color: '#555', margin: 0 }}>{error}</p>
    </div></div></div>
  )

  return (
    <div style={bg}>
      <OrgContext.Provider value={{ org, orgCode: orgCode! }}>
        <Outlet />
      </OrgContext.Provider>
    </div>
  )
}
