import { Link } from 'react-router-dom'
import { useOrg } from './OrgPublicLayout'
import { pb } from '../../lib/pocketbase'

const items = [
  {
    to: 'patienten',
    label: 'Patientendokumentation',
    desc: 'Notfalleinsatz dokumentieren',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
  },
  {
    to: 'produktausgabe',
    label: 'Produktausgabe',
    desc: 'Materialausgabe erfassen',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  },
  {
    to: 'cirs',
    label: 'CIRS-Meldung',
    desc: 'Kritisches Ereignis melden',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  },
]

export default function OrgLanding() {
  const { org, orgCode } = useOrg()
  const logoUrl = org.logo ? pb.files.getUrl(org, org.logo) : null

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px calc(48px + env(safe-area-inset-bottom))' }}>

      {/* Org header */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        {logoUrl && (
          <img src={logoUrl} alt="Logo" style={{ maxHeight: 80, maxWidth: '60%', marginBottom: 16, borderRadius: 10, objectFit: 'contain' }} />
        )}
        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: '#1a0e08', lineHeight: 1.2 }}>{org.org_name}</div>
        <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', marginTop: 6 }}>Wähle eine Anwendung</div>
      </div>

      {/* Cards */}
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#600812', marginBottom: 4 }}>
          Formulare
        </div>
        {items.map(({ to, icon, label, desc }) => (
          <Link key={to} to={`/${orgCode}/${to}`} style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#fff',
              borderRadius: 12,
              borderLeft: '3px solid #600812',
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(96,8,18,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1a0e08', lineHeight: 1.3 }}>{label}</div>
                <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{desc}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warm-gray)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </Link>
        ))}
      </div>

      <p style={{ marginTop: 36, fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', opacity: 0.6 }}>
        © 2025 Responda Systems
      </p>
    </div>
  )
}
