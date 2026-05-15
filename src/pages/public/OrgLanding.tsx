import React from 'react'
import { Link } from 'react-router-dom'
import { useOrg } from './OrgPublicLayout'
import { pb } from '../../lib/pocketbase'

const items = [
  { to: 'patienten', label: 'Patientendokumentation', desc: 'Notfalleinsatz dokumentieren',
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg> },
  { to: 'produktausgabe', label: 'Produktausgabe', desc: 'Materialausgabe erfassen',
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> },
  { to: 'cirs', label: 'CIRS-Meldung', desc: 'Kritisches Ereignis melden',
    icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
]

export default function OrgLanding() {
  const { org, orgCode } = useOrg()
  const logoUrl = org.logo ? pb.files.getUrl(org, org.logo) : null

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', '--bg-card': 'rgba(107,15,26,0.06)', '--bg-subtle': 'rgba(107,15,26,0.03)', '--border': 'rgba(107,15,26,0.12)', '--border-medium': 'rgba(107,15,26,0.15)', '--shadow-sm': '0 2px 16px rgba(107,15,26,0.08)' } as React.CSSProperties}>
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        {logoUrl && <img src={logoUrl} alt="Logo" style={{ maxHeight: 120, maxWidth: '80%', marginBottom: '1rem', borderRadius: 12 }} />}
        <h1 style={{ color: 'var(--text)', margin: 0, fontWeight: 800, fontSize: '1.5rem' }}>{org.org_name}</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '.5rem 0 0', fontSize: 15 }}>Wähle eine Anwendung</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {items.map(({ to, icon, label, desc }) => (
          <Link key={to} to={`/${orgCode}/${to}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: 'var(--bg-card)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '0.5px solid var(--border)', borderRadius: 20, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: 'var(--shadow-sm)', transition: 'transform .15s, box-shadow .15s', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)' }}>
              <div style={{ width: 56, height: 56, background: 'var(--accent)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{label}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '.875rem', marginTop: 2 }}>{desc}</div>
              </div>
              <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
    </div>
  )
}
