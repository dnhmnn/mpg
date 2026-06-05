import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useOrg } from './OrgPublicLayout'
import { pb } from '../../lib/pocketbase'
import type { FormTemplate } from './formSchema'

const STATIC_ITEMS = [
  {
    id: 'patienten',
    to: 'patienten',
    label: 'Patientendokumentation',
    desc: 'Notfalleinsatz dokumentieren',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <path d="M9 12h6M9 16h4"/>
      </svg>
    ),
  },
  {
    id: 'produktausgabe',
    to: 'produktausgabe',
    label: 'Produktausgabe',
    desc: 'Materialausgabe erfassen',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'cirs',
    to: 'cirs',
    label: 'CIRS-Meldung',
    desc: 'Kritisches Ereignis melden',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
]

const CUSTOM_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="12" x2="12" y2="18"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
)

const CHEVRON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warm-gray)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M9 18l6-6-6-6"/>
  </svg>
)

export default function OrgLanding() {
  const { org, orgCode } = useOrg()
  const logoUrl = org.logo ? pb.files.getUrl(org, org.logo) : null
  const hiddenForms: string[] = (org.form_config as any)?.hidden_forms || []

  const [customTemplates, setCustomTemplates] = useState<FormTemplate[]>([])

  useEffect(() => {
    pb.collection('form_templates').getFullList<FormTemplate>({
      filter: `organization_id = "${org.id}" && is_active = true`,
      sort: 'created',
    }).then(setCustomTemplates).catch(() => {})
  }, [org.id])

  const visibleStatic = STATIC_ITEMS.filter(item => !hiddenForms.includes(item.id))
  const hasAnyForm = visibleStatic.length > 0 || customTemplates.length > 0

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px calc(48px + env(safe-area-inset-bottom))' }}>

      {/* Org header */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        {logoUrl && (
          <img src={logoUrl} alt="Logo" style={{ maxHeight: 110, maxWidth: '70%', marginBottom: 16, borderRadius: 10, objectFit: 'contain' }} />
        )}
        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: '#1a0e08', lineHeight: 1.2 }}>{org.org_name}</div>
        <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', marginTop: 6 }}>
          {hasAnyForm ? 'Wähle eine Anwendung' : 'Zurzeit sind keine Formulare verfügbar.'}
        </div>
      </div>

      {/* Cards */}
      {hasAnyForm && (
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Static forms */}
          {visibleStatic.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.14em', color: '#600812', marginBottom: 4 }}>
                Formulare
              </div>
              {visibleStatic.map(({ id, to, icon, label, desc }) => (
                <Link key={id} to={`/${orgCode}/${to}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#fff', borderRadius: 12, borderLeft: '3px solid #600812', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(96,8,18,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1a0e08', lineHeight: 1.3 }}>{label}</div>
                      <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{desc}</div>
                    </div>
                    {CHEVRON}
                  </div>
                </Link>
              ))}
            </>
          )}

          {/* Custom templates */}
          {customTemplates.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.14em', color: '#600812', marginBottom: 4, marginTop: visibleStatic.length > 0 ? 10 : 0 }}>
                Eigene Formulare
              </div>
              {customTemplates.map(template => (
                <Link key={template.id} to={`/${orgCode}/formular/${template.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#fff', borderRadius: 12, borderLeft: '3px solid #600812', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(96,8,18,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {CUSTOM_ICON}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1a0e08', lineHeight: 1.3 }}>{template.title}</div>
                      {template.description
                        ? <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{template.description}</div>
                        : <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{template.schema.length} Felder</div>
                      }
                    </div>
                    {CHEVRON}
                  </div>
                </Link>
              ))}
            </>
          )}
        </div>
      )}

      <p style={{ marginTop: 36, fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', opacity: 0.6 }}>
        © 2025 Responda Systems
      </p>
    </div>
  )
}
