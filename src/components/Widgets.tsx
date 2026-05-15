import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import type { User } from '../types'

interface NewsItem {
  id: string
  label: string
  sub: string
  url: string
  color: string
}

interface WidgetsProps {
  user: User | null
}

export default function Widgets({ user }: WidgetsProps) {
  const navigate = useNavigate()
  const [now, setNow] = useState(new Date())
  const [news, setNews] = useState<NewsItem[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [newsLoaded, setNewsLoaded] = useState(false)
  const touchStartY = useRef(0)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!user?.organization_id) return
    fetchNews(user.organization_id)
  }, [user])

  async function fetchNews(org: string) {
    const items: NewsItem[] = []
    const soon = new Date()
    soon.setDate(soon.getDate() + 30)
    const soonStr = soon.toISOString().split('T')[0]
    const week = new Date()
    week.setDate(week.getDate() - 7)
    const weekStr = week.toISOString().replace('T', ' ').substring(0, 19)

    await Promise.allSettled([
      pb.collection('patients').getList(1, 1, {
        filter: `status="offen"&&organization_id="${org}"`,
        fields: 'id',
        requestKey: 'widget-patients'
      }).then(r => {
        if (r.totalItems > 0) items.push({
          id: 'patienten',
          label: `${r.totalItems} offene${r.totalItems === 1 ? 's' : ''} Protokoll${r.totalItems === 1 ? '' : 'e'}`,
          sub: 'Zum Gegenzeichnen oder Bearbeiten',
          url: '/patienten',
          color: '#007aff',
        })
      }),

      pb.collection('inventory_stock').getList(1, 1, {
        filter: `organization_id="${org}"&&expiry_date!=""&&expiry_date<="${soonStr}"`,
        fields: 'id',
        requestKey: 'widget-lager'
      }).then(r => {
        if (r.totalItems > 0) items.push({
          id: 'lager',
          label: `${r.totalItems} Artikel laufen ab`,
          sub: 'Im Lager in den nächsten 30 Tagen',
          url: '/lager',
          color: '#ff9500',
        })
      }),

      pb.collection('ausbildungen_termine_user').getList(1, 50, {
        filter: `updated>="${weekStr}"&&(status="abgesagt"||status="zugesagt")`,
        fields: 'id,status',
        requestKey: 'widget-ausb'
      }).then(r => {
        if (r.totalItems > 0) {
          const abgesagt = r.items.filter((i: any) => i.status === 'abgesagt').length
          const zugesagt = r.items.filter((i: any) => i.status === 'zugesagt').length
          const parts: string[] = []
          if (zugesagt > 0) parts.push(`${zugesagt} Zusage${zugesagt > 1 ? 'n' : ''}`)
          if (abgesagt > 0) parts.push(`${abgesagt} Absage${abgesagt > 1 ? 'n' : ''}`)
          items.push({
            id: 'ausbildungen',
            label: parts.join(', '),
            sub: 'Rückmeldungen in den letzten 7 Tagen',
            url: '/ausbildungen',
            color: '#1c7cd6',
          })
        }
      }),

      pb.collection('product_outputs').getList(1, 1, {
        filter: `organization_id="${org}"&&status="offen"`,
        fields: 'id',
        requestKey: 'widget-outputs'
      }).then(r => {
        if (r.totalItems > 0) items.push({
          id: 'produktausgabe',
          label: `${r.totalItems} offene Produktausgabe${r.totalItems === 1 ? '' : 'n'}`,
          sub: 'Noch nicht ins Lager gebucht',
          url: '/lager',
          color: '#ff3b30',
        })
      }),
    ])

    setNews(items)
    setNewsLoaded(true)
  }

  const orgName = user?.organization_name || 'Responda'
  const orgLogoFile = user?.organization_logo || ''

  let logoDisplay: JSX.Element
  if (orgLogoFile && user?.organization && orgLogoFile !== '🏢') {
    const logoUrl = pb.files.getUrl(user.organization, orgLogoFile, { thumb: '500x500' })
    logoDisplay = (
      <img src={logoUrl} alt={orgName}
        style={{ width: '70%', height: '70%', objectFit: 'contain', borderRadius: '12px' }} />
    )
  } else {
    logoDisplay = <div style={{ fontSize: '100px', lineHeight: 1 }}>🏢</div>
  }

  const secDeg = now.getSeconds() * 6

  return (
    <>
      <div className="widgets">
        {/* Clock widget */}
        <div className="widget">
          <div className="widget-title">Heute</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="widget-value" style={{ marginBottom: 0 }}>{now.getDate()}</div>
            <svg width="36" height="36" viewBox="-18 -18 36 36" style={{ flexShrink: 0 }}>
              <circle cx="0" cy="0" r="16" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
              <line x1="0" y1="2" x2="0" y2="-12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                transform={`rotate(${secDeg})`} />
              <circle cx="0" cy="0" r="2" fill="currentColor" />
            </svg>
          </div>
          <div className="widget-label">{now.toLocaleDateString('de-DE', { weekday: 'long' })}</div>
        </div>

        {/* Logo widget */}
        <div className="widget" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {logoDisplay}
        </div>

        {/* Neuigkeiten widget */}
        <div className="widget">
          <div className="widget-title">Neuigkeiten</div>
          {!newsLoaded ? (
            <div style={{ fontSize: '13px', opacity: 0.4, marginTop: '8px' }}>Lädt…</div>
          ) : news.length === 0 ? (
            <div style={{ fontSize: '14px', lineHeight: 1.6, opacity: 0.9, marginTop: '8px' }}>
              Willkommen zurück! Keine neuen Nachrichten.
            </div>
          ) : (
            <button
              onClick={() => setDetailOpen(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%', marginTop: '8px', fontFamily: 'inherit' }}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, textAlign: 'left' }}>
                {news.length === 1 ? news[0].label : `${news.length} neue Hinweise`}
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: 8 }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Detail bottom sheet */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 600, background: detailOpen ? 'rgba(0,0,0,0.25)' : 'transparent', pointerEvents: detailOpen ? 'all' : 'none', transition: 'background .3s', backdropFilter: detailOpen ? 'blur(4px)' : 'none' }}
        onClick={() => setDetailOpen(false)}
      >
        <div
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '22px 22px 0 0', padding: '10px 20px calc(110px + env(safe-area-inset-bottom))', transform: detailOpen ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .35s cubic-bezier(0.32,0.72,0,1)', maxHeight: '75vh', overflowY: 'auto', boxShadow: '0 -4px 32px rgba(0,0,0,0.12)' }}
          onClick={e => e.stopPropagation()}
          onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
          onTouchEnd={e => { if (e.changedTouches[0].clientY - touchStartY.current > 50) setDetailOpen(false) }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(0,0,0,0.15)', margin: '0 auto 18px' }} />
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1d1d1f', marginBottom: 16 }}>Neuigkeiten</div>

          {news.map(item => (
            <button
              key={item.id}
              onClick={() => { setDetailOpen(false); navigate(item.url) }}
              style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 0', borderTop: '0.5px solid rgba(0,0,0,0.07)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: item.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1d1d1f' }}>{item.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>{item.sub}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          ))}

          {news.length === 0 && (
            <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: '.9rem', textAlign: 'center', margin: '24px 0' }}>Keine Nachrichten.</p>
          )}
        </div>
      </div>
    </>
  )
}
