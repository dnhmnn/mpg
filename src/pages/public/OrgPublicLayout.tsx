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

export default function OrgPublicLayout() {
  const { orgCode } = useParams<{ orgCode: string }>()
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgCode) { setError('Kein Organisationscode.'); setLoading(false); return }
    const cacheKey = `org_cache_${orgCode}`
    pb.collection('organizations').getFirstListItem<Organization>(`org_code = "${orgCode}"`)
      .then(r => {
        if (r.is_active) {
          localStorage.setItem(cacheKey, JSON.stringify(r))
          setOrg(r)
        } else {
          setError('Organisation nicht aktiv.')
        }
      })
      .catch(() => {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          setOrg(JSON.parse(cached))
        } else {
          setError('Organisation nicht gefunden.')
        }
      })
      .finally(() => setLoading(false))
  }, [orgCode])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 15 }}>Lade Organisation…</p>
      </div>
    </div>
  )

  if (error || !org) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 20, padding: '2rem', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
        <h2 style={{ color: 'var(--accent)', margin: '0 0 .5rem', fontSize: '1.2rem' }}>Fehler</h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 15 }}>{error}</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <OrgContext.Provider value={{ org, orgCode: orgCode! }}>
        <Outlet />
      </OrgContext.Provider>
    </div>
  )
}
