import { useRef, useState, useEffect } from 'react'

interface Times {
  status3: string   // datetime-local format
  eintreffen: string
  uebergabe: string
  status1: string
  status2: string
}

interface Props {
  alarmzeit: string
  defaultStandort?: string
  defaultEinsatzort?: string
  onTimesChange?: (times: Times) => void
}

const STEP_COLORS = ['#6B1A2A', '#9E2A3A', '#C94D6A', '#2563eb', '#16a34a', '#166534']

const toLocalDT = (d: Date | null): string => {
  if (!d) return ''
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function EinsatzTimeline({ alarmzeit, defaultStandort, defaultEinsatzort, onTimesChange }: Props) {
  const mapDiv = useRef<HTMLDivElement>(null)
  const lMap = useRef<any>(null)
  const rLayer = useRef<any>(null)

  const [standort, setStandort] = useState(defaultStandort || '')
  const [einsatzort, setEinsatzort] = useState(defaultEinsatzort || '')
  const [ausruecke, setAusruecke] = useState(3)   // Alarm → Status 3 (min)
  const [szene, setSzene] = useState(15)           // Status 4 → Übergabe (min)
  const [routeSecs, setRouteSecs] = useState<number | null>(null)
  const [routeKm, setRouteKm] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  // Keep einsatzort in sync when parent form changes
  useEffect(() => {
    if (defaultEinsatzort && !einsatzort) setEinsatzort(defaultEinsatzort)
  }, [defaultEinsatzort])

  // Load Leaflet dynamically
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
    const map = L.map(mapDiv.current, { center: [49.38, 10.18], zoom: 11, scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    lMap.current = map
  }

  async function geocode(addr: string): Promise<[number, number] | null> {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      new URLSearchParams({ q: addr + ', Deutschland', format: 'json', limit: '1', countrycodes: 'de' }),
      { headers: { 'Accept-Language': 'de' } }
    )
    const d = await r.json()
    return d.length ? [parseFloat(d[0].lat), parseFloat(d[0].lon)] : null
  }

  async function calcRoute() {
    if (!einsatzort.trim()) return
    setLoading(true); setErr('')
    try {
      const fromC = await geocode(standort || 'Rothenburg ob der Tauber, Bayern')
      // Nominatim rate limit: 1 req/s
      await new Promise(r => setTimeout(r, 1100))
      const toC = await geocode(einsatzort)

      if (!fromC) { setErr(`Standort nicht gefunden: „${standort}"`); return }
      if (!toC)   { setErr(`Einsatzort nicht gefunden: „${einsatzort}"`); return }

      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/` +
        `${fromC[1]},${fromC[0]};${toC[1]},${toC[0]}?overview=full&geometries=geojson`
      )
      const d = await res.json()
      if (!d.routes?.length) { setErr('Route nicht berechenbar'); return }

      const route = d.routes[0]
      setRouteSecs(route.duration)
      setRouteKm(route.distance / 1000)

      const L = (window as any).L
      const map = lMap.current
      if (L && map) {
        if (rLayer.current) map.removeLayer(rLayer.current)
        const grp = L.layerGroup()

        // Route line
        L.geoJSON(route.geometry, {
          style: { color: '#C94D6A', weight: 4, opacity: 0.85 },
        }).addTo(grp)

        // Markers
        const dot = (c: string, label: string) => L.divIcon({
          html: `<div title="${label}" style="width:13px;height:13px;background:${c};border-radius:50%;border:2.5px solid #fff;box-shadow:0 0 8px ${c}88"></div>`,
          className: '', iconSize: [13, 13], iconAnchor: [6, 6],
        })
        L.marker(fromC, { icon: dot('#6B1A2A', standort) }).bindPopup(`<b>Wache</b><br>${standort}`).addTo(grp)
        L.marker(toC,   { icon: dot('#C94D6A', einsatzort) }).bindPopup(`<b>Einsatzort</b><br>${einsatzort}`).addTo(grp)

        grp.addTo(map)
        rLayer.current = grp

        const pad = 0.015
        map.fitBounds([
          [Math.min(fromC[0], toC[0]) - pad, Math.min(fromC[1], toC[1]) - pad],
          [Math.max(fromC[0], toC[0]) + pad, Math.max(fromC[1], toC[1]) + pad],
        ], { padding: [24, 24] })
      }
    } catch {
      setErr('Verbindungsfehler – bitte Internetverbindung prüfen')
    } finally {
      setLoading(false)
    }
  }

  // ── Timeline calculation ──────────────────────────────────────────────
  const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60_000)
  const fmt = (d: Date | null) =>
    d ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–'
  const fmtDur = (secs: number) => {
    const m = Math.ceil(secs / 60)
    return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
  }

  const base = alarmzeit ? new Date(alarmzeit) : new Date()
  const routeMin = routeSecs ? Math.ceil(routeSecs / 60) : null

  const t0 = base                                        // Alarmzeit
  const t1 = addMin(t0, ausruecke)                       // Status 3
  const t2 = routeMin ? addMin(t1, routeMin) : null      // Status 4 / Eintreffen
  const t3 = t2 ? addMin(t2, szene) : null               // Übergabe
  const t4 = t3                                          // Status 1 (direkt nach Übergabe)
  const t5 = routeMin && t4 ? addMin(t4, routeMin) : null // Status 2

  // Notify parent whenever calculated times change
  useEffect(() => {
    if (!onTimesChange) return
    onTimesChange({
      status3:    toLocalDT(t1),
      eintreffen: toLocalDT(t2),
      uebergabe:  toLocalDT(t3),
      status1:    toLocalDT(t4),
      status2:    toLocalDT(t5),
    })
  }, [toLocalDT(t1), toLocalDT(t2), toLocalDT(t3), toLocalDT(t4), toLocalDT(t5)])

  interface Step { label: string; sub: string; badge: string; time: Date | null; toNext: string | null }
  const steps: Step[] = [
    { label: 'Alarm',      sub: 'Meldungseingang', badge: '!', time: t0, toNext: `${ausruecke} min` },
    { label: 'Status 3',   sub: 'Ausgerückt',      badge: '3', time: t1, toNext: routeMin ? `${routeMin} min (Route)` : null },
    { label: 'Status 4',   sub: 'Eintreffen',      badge: '4', time: t2, toNext: `${szene} min` },
    { label: 'Übergabe',   sub: 'Patient übergeben', badge: '✓', time: t3, toNext: '–' },
    { label: 'Status 1',   sub: 'Wieder frei',     badge: '1', time: t4, toNext: routeMin ? `${routeMin} min (Route)` : null },
    { label: 'Status 2',   sub: 'Am Standort',     badge: '2', time: t5, toNext: null },
  ]

  // ── Shared styles ─────────────────────────────────────────────────────
  const ctrlInp: React.CSSProperties = {
    padding: '7px 9px', borderRadius: 7,
    border: '0.5px solid var(--border-medium)',
    background: 'var(--bg)', color: 'var(--text)',
    fontSize: '.88rem', fontFamily: 'inherit', width: '100%',
  }
  const ctrlLbl: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 3,
    fontSize: '.8rem', fontWeight: 600, color: 'var(--text-secondary)',
  }

  return (
    <div style={{ border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-card)' }}>

      {/* Controls */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '.65rem', padding: '1rem',
        background: 'var(--bg-subtle)', borderBottom: '0.5px solid var(--border)',
      }}>
        <label style={ctrlLbl}>
          Standort (Wache)
          <input style={ctrlInp} value={standort} onChange={e => setStandort(e.target.value)}
            placeholder="z. B. Feuerwehr Rothenburg ob der Tauber" />
        </label>
        <label style={ctrlLbl}>
          Einsatzort
          <input style={ctrlInp} value={einsatzort} onChange={e => setEinsatzort(e.target.value)}
            placeholder="Straße, Hausnummer, Ort" />
        </label>
        <label style={ctrlLbl}>
          Alarm → Status 3
          <select style={{ ...ctrlInp, cursor: 'pointer' }} value={ausruecke}
            onChange={e => setAusruecke(+e.target.value)}>
            {[1, 2, 3, 4, 5, 6, 7].map(m =>
              <option key={m} value={m}>{m} Minute{m > 1 ? 'n' : ''}</option>
            )}
          </select>
        </label>
        <label style={ctrlLbl}>
          Status 4 → Übergabe
          <select style={{ ...ctrlInp, cursor: 'pointer' }} value={szene}
            onChange={e => setSzene(+e.target.value)}>
            {[5, 10, 15, 20, 25, 30, 45, 60].map(m =>
              <option key={m} value={m}>{m} Minuten</option>
            )}
          </select>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'flex-end' }}>
          <button
            onClick={calcRoute}
            disabled={loading || !einsatzort.trim()}
            style={{
              padding: '8px 14px', borderRadius: 7, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700,
              fontSize: '.88rem', cursor: loading || !einsatzort.trim() ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: loading || !einsatzort.trim() ? 0.55 : 1,
            }}
          >
            {loading ? 'Berechne…' : 'Route berechnen'}
          </button>
          {routeKm !== null && (
            <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              {routeKm.toFixed(1)} km · {fmtDur(routeSecs!)}
            </div>
          )}
        </div>
      </div>

      {err && (
        <div style={{ padding: '6px 14px', background: '#fef2f2', color: '#dc2626', fontSize: '.82rem', borderBottom: '0.5px solid #fecaca' }}>
          {err}
        </div>
      )}

      {/* Map */}
      <div ref={mapDiv} style={{ height: 260, background: 'var(--bg-subtle)' }} />

      {/* Timeline */}
      <div style={{ padding: '1.25rem 1rem 1.1rem', overflowX: 'auto' }}>
        <div style={{ display: 'flex', position: 'relative', minWidth: 520 }}>

          {/* Background track line */}
          <div style={{
            position: 'absolute',
            left: `calc(100% / ${steps.length * 2})`,
            right: `calc(100% / ${steps.length * 2})`,
            top: 13, height: 2, background: 'var(--border)',
          }} />

          {steps.map((step, i) => {
            const known = !!step.time
            const color = STEP_COLORS[i]
            return (
              <div key={step.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>

                {/* Filled track segment up to this dot */}
                {i > 0 && known && (
                  <div style={{
                    position: 'absolute', right: '50%', top: 13, height: 2,
                    left: 0, background: color, zIndex: 0,
                  }} />
                )}

                {/* Dot */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', position: 'relative', zIndex: 1, flexShrink: 0,
                  background: known ? color : 'var(--bg)',
                  border: `2px solid ${known ? color : 'var(--border-medium)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: known ? `0 0 0 4px ${color}22` : 'none',
                  transition: 'all .3s',
                }}>
                  <span style={{ fontSize: '.62rem', fontWeight: 800, color: known ? '#fff' : 'var(--text-secondary)', lineHeight: 1 }}>
                    {step.badge}
                  </span>
                </div>

                {/* Labels */}
                <div style={{ textAlign: 'center', marginTop: 8, padding: '0 3px' }}>
                  <div style={{ fontSize: '.76rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: '.67rem', color: 'var(--text-secondary)', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                    {step.sub}
                  </div>
                  <div style={{
                    fontSize: '.9rem', fontWeight: 800, marginTop: 6,
                    color: known ? color : 'var(--text-secondary)',
                    fontVariantNumeric: 'tabular-nums', letterSpacing: '.01em',
                  }}>
                    {fmt(step.time)}
                  </div>
                  {/* Duration to next step */}
                  {step.toNext && i < steps.length - 1 && (
                    <div style={{ fontSize: '.67rem', color: 'var(--text-secondary)', marginTop: 3, whiteSpace: 'nowrap' }}>
                      +{step.toNext}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {!routeSecs && (
          <p style={{ textAlign: 'center', fontSize: '.78rem', color: 'var(--text-secondary)', margin: '.75rem 0 0' }}>
            Einsatzort eingeben und „Route berechnen" für vollständigen Zeitstrahl.
          </p>
        )}
      </div>
    </div>
  )
}
