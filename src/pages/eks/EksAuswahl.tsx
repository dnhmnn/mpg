import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { pb } from '../../lib/pocketbase'
import { incidentsAll, metaGet, metaSet, deviceId } from '../../lib/eks/db'

const RED = '#600812'

interface Zeile { id: string; keyword?: string; unit?: string; adresse?: string; datum?: string; status?: string; lokal?: boolean }

export default function EksAuswahl() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [liste, setListe] = useState<Zeile[]>([])
  const [online] = useState(navigator.onLine)
  const [geraet, setGeraet] = useState('')
  const [devId, setDevId] = useState('')

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setDevId(await deviceId())
      setGeraet((await metaGet<string>('device_name')) || '')
      // Lokal vorhandene Einsätze immer zeigen — die funktionieren auch offline
      const lokal = await incidentsAll()
      const lokalZeilen: Zeile[] = lokal.map(i => ({ id: i.id, ...(i.header || {}), lokal: true }))
      if (navigator.onLine) {
        try {
          const l = await pb.collection('einsaetze').getFullList({
            filter: `organization_id = "${user.organization_id}" && status = "aktiv"`,
            sort: '-datum', requestKey: `eks-pick-${Date.now()}`,
          })
          const server: Zeile[] = l.map((r: any) => ({ id: r.id, keyword: r.keyword, unit: r.unit, adresse: r.adresse, datum: r.datum, status: r.status }))
          const ids = new Set(server.map(s => s.id))
          setListe([...server, ...lokalZeilen.filter(z => !ids.has(z.id))])
          return
        } catch { /* offline oder Fehler */ }
      }
      setListe(lokalZeilen)
    })()
  }, [user])

  if (loading) return null
  if (user && !user.supervisor && !(user as any).permissions?.eks) {
    return (
      <Huelle>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--lbf-text)' }}>Kein Zugriff</div>
          <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', marginTop: 6 }}>Für die Einsatzführung fehlt dir die Berechtigung.</div>
        </div>
      </Huelle>
    )
  }

  return (
    <Huelle>
      <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', padding: 13, marginBottom: 14 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Dieses Gerät</div>
        <input value={geraet} onChange={e => setGeraet(e.target.value)} onBlur={() => metaSet('device_name', geraet)}
          placeholder="z.B. ELW-Laptop oder Tablet Sammelplatz"
          style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--lbf-input-border)', borderRadius: 8, background: 'var(--lbf-input-bg)', color: 'var(--lbf-text)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 6 }}>
          Kennung {devId.slice(0, 6)} · erscheint im Einsatztagebuch bei jedem Eintrag dieses Geräts.
        </div>
      </div>

      {!online && (
        <div style={{ background: 'rgba(217,119,6,0.1)', borderLeft: '3px solid #d97706', borderRadius: '0 10px 10px 0', padding: '10px 12px', marginBottom: 12, fontSize: 12.5, color: 'var(--lbf-text)' }}>
          Offline — es werden nur bereits auf diesem Gerät geöffnete Einsätze angezeigt.
        </div>
      )}

      <div style={{ fontSize: 9, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Einsatz wählen</div>
      {liste.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 14 }}>
          Kein aktiver Einsatz. Einsätze entstehen über das Modul „Einsätze" oder per Alamos-Alarm.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {liste.map(e => (
            <div key={e.id} onClick={() => navigate(`/eks/${e.id}`)}
              style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', borderLeft: `3px solid ${RED}`, padding: '12px 14px', cursor: 'pointer' }}>
              <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 15, color: 'var(--lbf-text)' }}>{e.keyword || 'Einsatz'}</div>
              <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                {[e.unit, e.adresse, e.datum ? new Date(e.datum.replace(' ', 'T')).toLocaleString('de-DE') : null].filter(Boolean).join(' · ')}
              </div>
              {e.lokal && <div style={{ fontSize: 11, color: '#d97706', fontWeight: 700, marginTop: 4 }}>lokal vorhanden</div>}
            </div>
          ))}
        </div>
      )}
    </Huelle>
  )
}

function Huelle({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', position: 'sticky', top: 0, zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/hub')} style={{ border: 'none', background: 'none', color: RED, cursor: 'pointer', padding: 0, display: 'flex' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>Responda EKS</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>Elektronische Koordinationsstelle</div>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 16px calc(24px + env(safe-area-inset-bottom))' }}>{children}</div>
    </div>
  )
}
