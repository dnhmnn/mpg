import { Link } from 'react-router-dom'
import { useOrg } from './OrgPublicLayout'
import { pb } from '../../lib/pocketbase'

const items = [
  { to: 'patienten', icon: '🏥', label: 'Patientendokumentation', desc: 'Notfalleinsatz dokumentieren' },
  { to: 'produktausgabe', icon: '📦', label: 'Produktausgabe', desc: 'Materialausgabe erfassen' },
  { to: 'cirs', icon: '⚠️', label: 'CIRS-Meldung', desc: 'Kritisches Ereignis melden' },
]

export default function OrgLanding() {
  const { org, orgCode } = useOrg()
  const logoUrl = org.logo ? pb.files.getUrl(org, org.logo) : null

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        {logoUrl && <img src={logoUrl} alt="Logo" style={{ maxHeight: 72, marginBottom: '1rem', borderRadius: 8 }} />}
        <h1 style={{ color: '#fff', margin: 0, fontWeight: 800, fontSize: '1.6rem' }}>{org.org_name}</h1>
        <p style={{ color: 'rgba(255,255,255,.8)', margin: '.5rem 0 0' }}>Wähle eine Anwendung</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {items.map(({ to, icon, label, desc }) => (
          <Link key={to} to={`/${orgCode}/${to}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: '#fff', borderRadius: '0.75rem', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 2px 12px rgba(0,0,0,.1)', transition: 'transform .15s', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
              <span style={{ fontSize: '2rem' }}>{icon}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{label}</div>
                <div style={{ color: '#64748b', fontSize: '.9rem' }}>{desc}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '1.2rem' }}>›</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
