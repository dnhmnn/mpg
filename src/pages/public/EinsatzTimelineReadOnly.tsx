import { useRef, useEffect } from 'react'

interface Props {
  standort?: string
  einsatzort?: string
  alarmzeit?: string
  zeitStatus3?: string
  zeitEintreffen?: string
  zeitUebergabe?: string
  zeitStatus1?: string
  zeitStatus2?: string
}

const STEP_COLORS = ['#6B1A2A', '#9E2A3A', '#C94D6A', '#2563eb', '#16a34a', '#166534']

const fmtDT = (v?: string) => {
  if (!v) return null
  try {
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  } catch { return null }
}

export default function EinsatzTimelineReadOnly({
  standort, einsatzort, alarmzeit,
  zeitStatus3, zeitEintreffen, zeitUebergabe, zeitStatus1, zeitStatus2,
}: Props) {
  const mapDiv = useRef<HTMLDivElement>(null)
  const lMap = useRef<any>(null)
  const rLayer = useRef<any>(null)

  useEffect(() => {
    const L = (window as any).L
    if (L) { initMap(L); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s.onload = () => initMap((window as any).L)
    document.head.appendChild(s)
  }, [])

  function initMap(L: any) {
    if (!mapDiv.current || lMap.current) return
    const map = L.map(mapDiv.current, { center: [49.38, 10.18], zoom: 11, scrollWheelZoom: false, zoomControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    lMap.current = map
    if (einsatzort?.trim()) calcRoute(L, map)
  }

  async function geocode(addr: string): Promise<[number, number] | null> {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({ q: addr + ', Deutschland', format: 'json', limit: '1', countrycodes: 'de' }),
        { headers: { 'Accept-Language': 'de' } }
      )
      const d = await r.json()
      return d.length ? [parseFloat(d[0].lat), parseFloat(d[0].lon)] : null
    } catch { return null }
  }

  async function calcRoute(L: any, map: any) {
    try {
      const fromC = await geocode(standort || 'Deutschland')
      await new Promise(r => setTimeout(r, 1100))
      const toC = einsatzort ? await geocode(einsatzort) : null
      if (!fromC || !toC) return

      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/` +
        `${fromC[1]},${fromC[0]};${toC[1]},${toC[0]}?overview=full&geometries=geojson`
      )
      const d = await res.json()
      if (!d.routes?.length) return

      if (rLayer.current) map.removeLayer(rLayer.current)
      const grp = L.layerGroup()

      L.geoJSON(d.routes[0].geometry, {
        style: { color: '#C94D6A', weight: 4, opacity: 0.85 },
      }).addTo(grp)

      const dot = (c: string, label: string) => L.divIcon({
        html: `<div title="${label}" style="width:13px;height:13px;background:${c};border-radius:50%;border:2.5px solid #fff;box-shadow:0 0 8px ${c}88"></div>`,
        className: '', iconSize: [13, 13], iconAnchor: [6, 6],
      })
      L.marker(fromC, { icon: dot('#6B1A2A', standort || '') }).bindPopup(`<b>Wache</b><br>${standort || ''}`).addTo(grp)
      L.marker(toC, { icon: dot('#C94D6A', einsatzort || '') }).bindPopup(`<b>Einsatzort</b><br>${einsatzort || ''}`).addTo(grp)

      grp.addTo(map)
      rLayer.current = grp

      const pad = 0.015
      map.fitBounds([
        [Math.min(fromC[0], toC[0]) - pad, Math.min(fromC[1], toC[1]) - pad],
        [Math.max(fromC[0], toC[0]) + pad, Math.max(fromC[1], toC[1]) + pad],
      ], { padding: [24, 24] })
    } catch {}
  }

  const steps = [
    { label: 'Alarm',    sub: 'Meldungseingang',  badge: '!', time: fmtDT(alarmzeit) },
    { label: 'Status 3', sub: 'Ausgerückt',        badge: '3', time: fmtDT(zeitStatus3) },
    { label: 'Status 4', sub: 'Eintreffen',        badge: '4', time: fmtDT(zeitEintreffen) },
    { label: 'Übergabe', sub: 'Patient übergeben', badge: '✓', time: fmtDT(zeitUebergabe) },
    { label: 'Status 1', sub: 'Wieder frei',       badge: '1', time: fmtDT(zeitStatus1) },
    { label: 'Status 2', sub: 'Am Standort',       badge: '2', time: fmtDT(zeitStatus2) },
  ]

  const ctrlVal: React.CSSProperties = {
    padding: '7px 9px', borderRadius: 7,
    border: '0.5px solid var(--border-medium)',
    background: 'var(--bg-subtle)', color: 'var(--text)',
    fontSize: '.88rem', width: '100%',
  }
  const ctrlLbl: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 3,
    fontSize: '.8rem', fontWeight: 600, color: 'var(--text-secondary)',
  }

  return (
    <div style={{ border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-card)' }}>

      {/* Info row — same layout as EinsatzTimeline controls but read-only */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '.65rem', padding: '1rem',
        background: 'var(--bg-subtle)', borderBottom: '0.5px solid var(--border)',
      }}>
        <div style={ctrlLbl}>
          Standort (Wache)
          <div style={ctrlVal}>{standort || '—'}</div>
        </div>
        <div style={ctrlLbl}>
          Einsatzort
          <div style={ctrlVal}>{einsatzort || '—'}</div>
        </div>
        <div style={ctrlLbl}>
          Alarmzeit
          <div style={ctrlVal}>{fmtDT(alarmzeit) ?? '—'}</div>
        </div>
      </div>

      {/* Map */}
      <div ref={mapDiv} style={{ height: 260, background: 'var(--bg-subtle)' }} />

      {/* Timeline — identical visual to EinsatzTimeline */}
      <div style={{ padding: '1.25rem 1rem 1.1rem', overflowX: 'auto' }}>
        <div style={{ display: 'flex', position: 'relative', minWidth: 520 }}>
          <div style={{
            position: 'absolute',
            left: `calc(100% / ${steps.length * 2})`,
            right: `calc(100% / ${steps.length * 2})`,
            top: 13, height: 2, background: 'var(--border)',
          }} />
          {steps.map((step, i) => {
            const color = STEP_COLORS[i]
            const known = !!step.time
            return (
              <div key={step.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {i > 0 && known && (
                  <div style={{ position: 'absolute', right: '50%', top: 13, height: 2, left: 0, background: color, zIndex: 0 }} />
                )}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', position: 'relative', zIndex: 1, flexShrink: 0,
                  background: known ? color : 'var(--bg)',
                  border: `2px solid ${known ? color : 'var(--border-medium)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: known ? `0 0 0 4px ${color}22` : 'none',
                }}>
                  <span style={{ fontSize: '.62rem', fontWeight: 800, color: known ? '#fff' : 'var(--text-secondary)', lineHeight: 1 }}>
                    {step.badge}
                  </span>
                </div>
                <div style={{ textAlign: 'center', marginTop: 8, padding: '0 3px' }}>
                  <div style={{ fontSize: '.76rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{step.label}</div>
                  <div style={{ fontSize: '.67rem', color: 'var(--text-secondary)', lineHeight: 1.3, whiteSpace: 'nowrap' }}>{step.sub}</div>
                  <div style={{ fontSize: '.9rem', fontWeight: 800, marginTop: 6, color: known ? color : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '.01em' }}>
                    {step.time ?? '–'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
