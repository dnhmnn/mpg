import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import type { User } from '../types'

interface NewsItem {
  id: string
  label: string
  sub: string
  url: string
  rgb: string // Kennfarbe als CSS-Variable mit RGB-Tripel, damit sie im Dunkelmodus heller wird
}

interface WidgetsProps {
  user: User | null
}

// Volle Kennfarbe für Randstrich und Punkt. Das Rot nimmt den Akzent: dessen
// RGB-Tripel ist dunkel Sand (für Tönungen gedacht), der Akzent dagegen Rosé.
const linie = (rgb: string) => rgb === 'var(--lbf-rot-rgb)' ? 'var(--lbf-akzent)' : `rgb(${rgb})`

export default function Widgets({ user }: WidgetsProps) {
  const navigate = useNavigate()
  const [news, setNews] = useState<NewsItem[]>([])
  const [newsLoaded, setNewsLoaded] = useState(false)

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

    const prefs = (() => {
      try { return JSON.parse(localStorage.getItem('notif_prefs') || '{}') } catch { return {} }
    })()
    const enabled = (key: string) => prefs[key] !== false

    const queries: Promise<any>[] = []

    if (enabled('patienten')) queries.push(
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
          rgb: 'var(--lbf-rot-rgb)',
        })
      })
    )

    if (enabled('lager')) queries.push(
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
          rgb: 'var(--lbf-gold-rgb)',
        })
      })
    )

    if (enabled('ausbildungen')) queries.push(
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
            rgb: 'var(--lbf-schiefer-rgb)',
          })
        }
      })
    )

    if (enabled('mpg')) queries.push(
      pb.collection('mpg_devices').getList(1, 1, {
        filter: `organization_id="${org}"&&next_inspection_due<="${soonStr}"`,
        fields: 'id,next_inspection_due',
        requestKey: 'widget-mpg'
      }).then(r => {
        if (r.totalItems > 0) {
          const today = new Date().toISOString().split('T')[0]
          const overdueFilter = `organization_id="${org}"&&next_inspection_due<="${today}"`
          return pb.collection('mpg_devices').getList(1, 1, {
            filter: overdueFilter, fields: 'id', requestKey: 'widget-mpg-overdue'
          }).then(o => {
            const overdue = o.totalItems
            const warning = r.totalItems - overdue
            const parts: string[] = []
            if (overdue > 0) parts.push(`${overdue} überfällig`)
            if (warning > 0) parts.push(`${warning} bald fällig`)
            items.push({
              id: 'mpg',
              label: `MPG: ${parts.join(', ')}`,
              sub: 'Geräteprüfung',
              url: '/mpg',
              rgb: 'var(--lbf-rot-rgb)',
            })
          })
        }
      })
    )

    if (enabled('produktausgabe')) queries.push(
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
          rgb: 'var(--lbf-rot-rgb)',
        })
      })
    )

    await Promise.allSettled(queries)

    setNews(items)
    setNewsLoaded(true)
  }

  if (!newsLoaded) return null

  if (news.length === 0) return null

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)',
        textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12,
      }}>
        Neuigkeiten
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {news.map(item => (
          <div
            key={item.id}
            onClick={() => navigate(item.url)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px',
              background: 'var(--lbf-card)', borderRadius: 12,
              boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
              borderLeft: `3px solid ${linie(item.rgb)}`,
              cursor: 'pointer',
            }}
          >
            {/* Editorial icon square */}
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: `rgba(${item.rgb},0.086)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: linie(item.rgb) }} />
            </div>
            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lbf-text)', lineHeight: 1.3 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 3 }}>
                {item.sub}
              </div>
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(var(--lbf-rot-rgb),0.25)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        ))}
      </div>
    </div>
  )
}
