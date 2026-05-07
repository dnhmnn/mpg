import { useState, useRef, useEffect } from 'react'

export type DauerMed = { name: string; wirkstoff: string; dosis?: string; pzn?: string }

type Hit = { name: string; wirkstoff: string }

// ── Drug search via openFDA ───────────────────────────────────────────────────
async function searchFda(q: string): Promise<Hit[]> {
  try {
    const enc = encodeURIComponent(`"${q}"`)
    const url =
      `https://api.fda.gov/drug/label.json?search=` +
      `(openfda.brand_name:${enc}+openfda.generic_name:${enc})&limit=8`
    const r = await fetch(url)
    if (!r.ok) return []
    const d = await r.json()
    const seen = new Set<string>()
    const hits: Hit[] = []
    for (const item of d.results || []) {
      const brands: string[] = item.openfda?.brand_name || []
      const substances: string[] = item.openfda?.substance_name || []
      const wirkstoff = substances
        .map((s: string) => s.charAt(0) + s.slice(1).toLowerCase())
        .join(', ')
      for (const name of brands.slice(0, 2)) {
        const key = name.toLowerCase()
        if (!seen.has(key) && wirkstoff) { seen.add(key); hits.push({ name, wirkstoff }) }
        if (hits.length >= 6) break
      }
      if (hits.length >= 6) break
    }
    return hits
  } catch { return [] }
}

// ── PZN extraction from barcode raw value ────────────────────────────────────
function extractPzn(raw: string): string | null {
  const m = raw.match(/PZN[-\s]?0*(\d{7,8})/i) || raw.match(/^0*(\d{7})$/)
  return m ? m[1].padStart(8, '0') : null
}

const hasBarcodeDetector = () =>
  typeof window !== 'undefined' && 'BarcodeDetector' in window

// ── Styles ────────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '.5rem .6rem', border: '1px solid #e2e8f0',
  borderRadius: 8, fontSize: 15, boxSizing: 'border-box', fontFamily: 'inherit',
}
const fieldLbl: React.CSSProperties = {
  display: 'block', fontWeight: 700, fontSize: '.88rem',
  color: '#111827', marginBottom: 3,
}
const btn = (bg: string, disabled = false): React.CSSProperties => ({
  background: disabled ? '#e5e7eb' : bg,
  color: disabled ? '#9ca3af' : '#fff',
  border: 'none', borderRadius: 8, padding: '8px 14px',
  fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 14, fontFamily: 'inherit',
})

// ─────────────────────────────────────────────────────────────────────────────
export default function DauermedikationPicker({
  value, onChange,
}: {
  value: DauerMed[]
  onChange: (v: DauerMed[]) => void
}) {
  const [open, setOpen]           = useState(false)
  const [name, setName]           = useState('')
  const [wirkstoff, setWirkstoff] = useState('')
  const [dosis, setDosis]         = useState('')
  const [pzn, setPzn]             = useState('')
  const [query, setQuery]         = useState('')
  const [hits, setHits]           = useState<Hit[]>([])
  const [searching, setSearching] = useState(false)
  const [showHits, setShowHits]   = useState(false)
  const [scanning, setScanning]   = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [scanMsg, setScanMsg]     = useState('')
  const [scanError, setScanError] = useState('')

  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef    = useRef<number>()
  const timer     = useRef<ReturnType<typeof setTimeout>>()
  const hitsRef   = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)
  const nameRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (hitsRef.current && !hitsRef.current.contains(e.target as Node))
        setShowHits(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => () => stopScan(), [])

  // Focus name field whenever form resets after an add
  function focusName() {
    setTimeout(() => nameRef.current?.focus(), 50)
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  function onQueryChange(q: string) {
    setQuery(q)
    clearTimeout(timer.current)
    if (!q.trim()) { setHits([]); setShowHits(false); return }
    timer.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchFda(q.trim())
      setHits(res); setShowHits(res.length > 0)
      setSearching(false)
    }, 400)
  }

  function pickHit(h: Hit) {
    setName(h.name); setWirkstoff(h.wirkstoff)
    setQuery(''); setHits([]); setShowHits(false)
  }

  // ── Add one entry (form stays open for next) ───────────────────────────────
  function addEntry() {
    if (!name.trim() || !wirkstoff.trim()) return
    onChange([...value, {
      name: name.trim(),
      wirkstoff: wirkstoff.trim(),
      dosis: dosis.trim() || undefined,
      pzn: pzn.trim() || undefined,
    }])
    // Clear only the entry fields — keep form open for the next medication
    setName(''); setWirkstoff(''); setDosis(''); setPzn('')
    setQuery(''); setHits([]); setScanMsg(''); setScanError('')
    setPhotoPreview(null); stopScan()
    focusName()
  }

  function closeForm() {
    setOpen(false)
    setName(''); setWirkstoff(''); setDosis(''); setPzn('')
    setQuery(''); setHits([]); setScanMsg(''); setScanError('')
    setPhotoPreview(null); stopScan()
  }

  // ── Live camera (BarcodeDetector — Chrome / Edge / Android) ───────────────
  async function startLiveScan() {
    setScanMsg(''); setScanError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      setScanning(true)

      const BD = (window as any).BarcodeDetector
      const detector = new BD({
        formats: ['code_39', 'code_128', 'data_matrix', 'ean_13', 'ean_8', 'qr_code'],
      })
      let found = false

      const tick = async () => {
        if (found || !videoRef.current || videoRef.current.readyState < 2) {
          if (!found) rafRef.current = requestAnimationFrame(tick)
          return
        }
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0) {
            found = true
            await handleDecodedValue(codes[0].rawValue)
            stopScan()
            return
          }
        } catch {}
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (e: any) {
      setScanError('Kamera nicht verfügbar: ' + (e.message || 'Zugriff verweigert'))
    }
  }

  function stopScan() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setScanning(false)
  }

  // ── Photo capture (iOS / Safari fallback) ─────────────────────────────────
  async function handlePhotoFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)

    if (hasBarcodeDetector()) {
      try {
        const bitmap = await createImageBitmap(file)
        const bd = new (window as any).BarcodeDetector({
          formats: ['code_39', 'code_128', 'data_matrix', 'ean_13', 'ean_8'],
        })
        const codes = await bd.detect(bitmap)
        if (codes.length > 0) {
          await handleDecodedValue(codes[0].rawValue)
          setPhotoPreview(null)
          return
        }
      } catch {}
    }
    setScanMsg('PZN vom Foto ablesen und unten eintragen.')
  }

  async function handleDecodedValue(raw: string) {
    const p = extractPzn(raw)
    if (p) {
      setPzn(p)
      setScanMsg(`PZN ${p} erkannt — Medikamentname und Wirkstoff eintragen.`)
      setSearching(true)
      const res = await searchFda(p)
      if (res.length > 0) { setHits(res); setShowHits(true) }
      setSearching(false)
    } else {
      setScanMsg(`Code erkannt: ${raw}`)
      setName(raw)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Chip list of added medications */}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: '.75rem' }}>
          {value.map((m, i) => (
            <div key={i} style={{
              display: 'inline-flex', alignItems: 'flex-start', gap: 6,
              background: '#fef9c3', border: '1px solid #fde047',
              borderRadius: 10, padding: '6px 10px', fontSize: 13,
            }}>
              <div>
                <span style={{ fontWeight: 700, color: '#111827' }}>{m.name}</span>
                <span style={{ color: '#78350f', marginLeft: 5 }}>({m.wirkstoff})</span>
                {m.dosis && <span style={{ color: '#92400e', marginLeft: 5 }}>{m.dosis}</span>}
                {m.pzn && (
                  <span style={{ color: '#b45309', marginLeft: 5, fontSize: 11 }}>
                    PZN {m.pzn}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b45309', fontSize: 16, lineHeight: 1, padding: 0, marginLeft: 2, fontFamily: 'inherit' }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Entry form */}
      {open ? (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem' }}>

          {/* Search + barcode row */}
          <div style={{ marginBottom: '.75rem', position: 'relative' }} ref={hitsRef}>
            <label style={fieldLbl}>Medikamentendatenbank durchsuchen</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  style={inp}
                  type="search"
                  value={query}
                  onChange={e => onQueryChange(e.target.value)}
                  onFocus={() => hits.length > 0 && setShowHits(true)}
                  placeholder="Medikamentname eingeben…"
                  autoComplete="off"
                />
                {searching && (
                  <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#6b7280' }}>
                    sucht…
                  </div>
                )}
              </div>

              {hasBarcodeDetector() ? (
                <button
                  type="button"
                  onClick={scanning ? stopScan : startLiveScan}
                  style={btn(scanning ? '#dc2626' : '#1d4ed8')}
                >
                  {scanning ? 'Stop' : 'Barcode'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    style={btn('#1d4ed8')}
                    title="Foto der Verpackung aufnehmen (PZN ablesen)"
                  >
                    Barcode
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) handlePhotoFile(f)
                      e.target.value = ''
                    }}
                  />
                </>
              )}
            </div>

            {!hasBarcodeDetector() && !photoPreview && !scanMsg && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Foto der Verpackung aufnehmen — PZN vom Bild ablesen und unten eintragen.
              </div>
            )}

            {/* Search dropdown */}
            {showHits && hits.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                background: '#fff', border: '1px solid #e2e8f0',
                borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,.1)',
                zIndex: 100, overflow: 'hidden', marginTop: 2,
              }}>
                <div style={{ padding: '6px 12px 4px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  Wirkstoff übernehmen
                </div>
                {hits.map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => pickHit(h)}
                    style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '9px 12px', cursor: 'pointer', textAlign: 'left', borderBottom: i < hits.length - 1 ? '0.5px solid #f1f5f9' : 'none', fontFamily: 'inherit' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                      Wirkstoff: <strong style={{ color: '#374151' }}>{h.wirkstoff}</strong>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Live camera feed */}
          {scanning && (
            <div style={{ marginBottom: '.75rem' }}>
              <video
                ref={videoRef}
                style={{ width: '100%', maxHeight: 220, borderRadius: 10, background: '#000', display: 'block' }}
                playsInline muted
              />
              <div style={{ fontSize: 13, color: '#374151', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'blink 1s infinite' }} />
                Kamera aktiv — Barcode-Aufkleber vor die Kamera halten
              </div>
              <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
            </div>
          )}

          {/* Photo preview (iOS) */}
          {photoPreview && (
            <div style={{ marginBottom: '.75rem' }}>
              <img
                src={photoPreview}
                alt="Aufgenommenes Foto"
                style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}
              />
              <button
                type="button"
                onClick={() => { setPhotoPreview(null); setScanMsg('') }}
                style={{ marginTop: 4, background: 'none', border: 'none', fontSize: 12, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
              >
                Foto entfernen
              </button>
            </div>
          )}

          {scanMsg && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#166534', marginBottom: '.75rem' }}>
              {scanMsg}
            </div>
          )}
          {scanError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#991b1b', marginBottom: '.75rem' }}>
              {scanError}
            </div>
          )}

          {/* Entry fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: '.6rem', marginBottom: '.75rem' }}>
            <div>
              <label style={fieldLbl}>Medikamentname *</label>
              <input
                ref={nameRef}
                style={inp}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEntry()}
                placeholder="z.B. Novalgin"
              />
            </div>
            <div>
              <label style={fieldLbl}>Wirkstoff *</label>
              <input
                style={inp}
                type="text"
                value={wirkstoff}
                onChange={e => setWirkstoff(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEntry()}
                placeholder="z.B. Metamizol-Natrium"
              />
            </div>
            <div>
              <label style={fieldLbl}>Dosis / Einnahme</label>
              <input
                style={inp}
                type="text"
                value={dosis}
                onChange={e => setDosis(e.target.value)}
                placeholder="z.B. 500 mg 3x/Tag"
              />
            </div>
            <div>
              <label style={fieldLbl}>PZN</label>
              <input
                style={{ ...inp, fontFamily: 'monospace', letterSpacing: '.08em' }}
                type="text"
                value={pzn}
                onChange={e => setPzn(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="12345678"
                inputMode="numeric"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={addEntry}
              disabled={!name.trim() || !wirkstoff.trim()}
              style={btn('#16a34a', !name.trim() || !wirkstoff.trim())}
            >
              Hinzufügen
            </button>
            <button type="button" onClick={closeForm} style={btn('#6b7280')}>
              Fertig
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setOpen(true); focusName() }}
          style={{
            background: '#f8fafc', border: '1.5px dashed #94a3b8',
            borderRadius: 8, padding: '8px 16px',
            cursor: 'pointer', color: '#374151', fontWeight: 600,
            fontSize: '.9rem', fontFamily: 'inherit',
          }}
        >
          + Medikament hinzufügen
        </button>
      )}
    </div>
  )
}
