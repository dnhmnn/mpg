import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'

type Stil = 'dunkel' | 'hell' | 'mittel'

interface Config {
  stil: Stil
  eyebrow: string
  zeile1: string
  zeile2: string
  zeile3: string
  subtext: string
  features: string
  url: string
  hashtags: string
  logoSichtbar: boolean
}

const DEF: Config = {
  stil: 'dunkel',
  eyebrow: 'Coming Soon',
  zeile1: 'Bald',
  zeile2: 'ist es',
  zeile3: 'so weit.',
  subtext: 'Einsätze, Patientenprotokolle, Lager und Ausbildungen — digital, sicher und von überall.',
  features: 'Feuerwehr · Rettungsdienst · Hilfsorganisationen',
  url: 'responda.systems',
  hashtags: '#Responda #Feuerwehr #Rettungsdienst',
  logoSichtbar: true,
}

const STILE: Record<Stil, { bg: string; text: string; sub: string; accent: string; line: string }> = {
  dunkel: { bg: '#3d0408', text: '#fde8d8', sub: 'rgba(253,232,216,0.6)', accent: 'rgba(253,232,216,0.35)', line: 'rgba(253,232,216,0.08)' },
  mittel: { bg: '#600812', text: '#fde8d8', sub: 'rgba(253,232,216,0.65)', accent: 'rgba(253,232,216,0.4)', line: 'rgba(253,232,216,0.1)' },
  hell: { bg: '#faf9f7', text: '#1a0e08', sub: '#8a7a68', accent: '#8a7a68', line: 'rgba(96,8,18,0.08)' },
}

function Vorschau({ c, scale = 1 }: { c: Config; scale?: number }) {
  const s = STILE[c.stil]
  const SIZE = 1080

  return (
    <div style={{
      width: SIZE, height: SIZE,
      background: s.bg,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 80,
      fontFamily: "'Atkinson Hyperlegible', Georgia, serif",
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      flexShrink: 0,
    }}>

      {/* Akzentlinie */}
      <div style={{
        position: 'absolute', top: 0, left: 210, width: 1, height: '100%',
        background: s.line,
        transform: 'rotate(12deg)', transformOrigin: 'top left',
      }} />

      {/* Hintergrund-Logo */}
      {c.logoSichtbar && (
        <img src="logo.svg" alt="" style={{
          position: 'absolute', bottom: -80, right: -80,
          width: 680, height: 680, opacity: 0.07,
          pointerEvents: 'none',
        }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: c.stil === 'hell' ? '#600812' : 'rgba(253,232,216,0.12)',
          border: `1px solid ${c.stil === 'hell' ? 'transparent' : 'rgba(253,232,216,0.25)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}>
          <img src="logo.svg" alt="Responda" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: s.text, letterSpacing: '0.02em' }}>Responda</div>
          <div style={{ fontSize: 11, fontStyle: 'italic', color: s.sub, letterSpacing: '0.04em', marginTop: 1 }}>Digitale Einsatzverwaltung</div>
        </div>
      </div>

      {/* Hauptinhalt */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 0', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: s.sub, marginBottom: 28 }}>
          {c.eyebrow}
        </div>
        <div style={{ fontSize: 96, fontWeight: 800, fontStyle: 'italic', color: s.text, lineHeight: 0.95, letterSpacing: '-0.03em', marginBottom: 40 }}>
          {c.zeile1 && <div>{c.zeile1}</div>}
          {c.zeile2 && <div style={{ color: c.stil === 'hell' ? 'rgba(26,14,8,0.3)' : 'rgba(253,232,216,0.3)' }}>{c.zeile2}</div>}
          {c.zeile3 && <div>{c.zeile3}</div>}
        </div>
        <div style={{ width: 64, height: 2, background: s.sub, opacity: 0.4, marginBottom: 36 }} />
        <div style={{ fontSize: 22, fontStyle: 'italic', color: s.sub, lineHeight: 1.45, maxWidth: 520 }}>
          {c.subtext}
        </div>
        {c.features && (
          <div style={{ display: 'flex', gap: 20, marginTop: 56, flexWrap: 'wrap' }}>
            {c.features.split('·').map((f, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: s.accent }}>Für</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: s.text }}>{f.trim()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 14, fontStyle: 'italic', color: s.accent, letterSpacing: '0.02em' }}>{c.url}</div>
        <div style={{ fontSize: 13, fontStyle: 'italic', fontWeight: 700, color: s.accent }}>{c.hashtags}</div>
      </div>
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(96,8,18,0.15)', background: '#fff',
  fontFamily: 'inherit', fontSize: 13, color: '#1a0e08', outline: 'none',
  boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#600812',
  textTransform: 'uppercase', letterSpacing: '0.14em',
  display: 'block', marginBottom: 5,
}
const field = (extra?: React.CSSProperties): React.CSSProperties => ({ marginBottom: 14, ...extra })

export default function KachelGenerator() {
  const [c, setC] = useState<Config>(DEF)
  const [loading, setLoading] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  function set(k: keyof Config, v: string | boolean) {
    setC(prev => ({ ...prev, [k]: v }))
  }

  const SCALE = 380 / 1080

  async function herunterladen() {
    if (!previewRef.current) return
    setLoading(true)
    try {
      const canvas = await html2canvas(previewRef.current, {
        width: 1080, height: 1080, scale: 2,
        useCORS: true, allowTaint: true,
        backgroundColor: STILE[c.stil].bg,
        logging: false,
      })
      const link = document.createElement('a')
      link.download = `responda-kachel-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) {
      console.error(e)
      alert('Download fehlgeschlagen. Bitte als Screenshot speichern.')
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '20px', display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

      {/* Linke Spalte: Formular */}
      <div style={{ flex: '0 0 320px', minWidth: 280 }}>

        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid #600812', padding: '16px 18px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>Stil</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['dunkel', 'mittel', 'hell'] as Stil[]).map(s => (
              <button key={s} onClick={() => set('stil', s)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${c.stil === s ? '#600812' : 'rgba(96,8,18,0.15)'}`,
                background: STILE[s].bg, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 11, fontWeight: 700, color: STILE[s].text,
                textTransform: 'capitalize', letterSpacing: '0.05em',
              }}>
                {s === 'dunkel' ? 'Dunkel' : s === 'mittel' ? 'Rot' : 'Hell'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid rgba(96,8,18,0.25)', padding: '16px 18px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>Text</div>

          <div style={field()}>
            <label style={lbl}>Eyebrow (oben klein)</label>
            <input style={inp} value={c.eyebrow} onChange={e => set('eyebrow', e.target.value)} placeholder="Coming Soon" />
          </div>

          <div style={field()}>
            <label style={lbl}>Headline Zeile 1</label>
            <input style={inp} value={c.zeile1} onChange={e => set('zeile1', e.target.value)} placeholder="Bald" />
          </div>
          <div style={field()}>
            <label style={lbl}>Headline Zeile 2 (gedimmt)</label>
            <input style={inp} value={c.zeile2} onChange={e => set('zeile2', e.target.value)} placeholder="ist es" />
          </div>
          <div style={field()}>
            <label style={lbl}>Headline Zeile 3</label>
            <input style={inp} value={c.zeile3} onChange={e => set('zeile3', e.target.value)} placeholder="so weit." />
          </div>

          <div style={field()}>
            <label style={lbl}>Subtext</label>
            <textarea style={{ ...inp, height: 68, resize: 'vertical' }} value={c.subtext} onChange={e => set('subtext', e.target.value)} />
          </div>

          <div style={field()}>
            <label style={lbl}>Features (mit · trennen)</label>
            <input style={inp} value={c.features} onChange={e => set('features', e.target.value)} placeholder="Feuerwehr · Rettungsdienst" />
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid rgba(96,8,18,0.25)', padding: '16px 18px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>Footer</div>
          <div style={field()}>
            <label style={lbl}>URL</label>
            <input style={inp} value={c.url} onChange={e => set('url', e.target.value)} placeholder="responda.systems" />
          </div>
          <div style={field({ marginBottom: 0 })}>
            <label style={lbl}>Hashtags</label>
            <input style={inp} value={c.hashtags} onChange={e => set('hashtags', e.target.value)} placeholder="#Responda #Feuerwehr" />
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid rgba(96,8,18,0.25)', padding: '16px 18px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#1a0e08', fontWeight: 600 }}>Logo anzeigen</span>
            <button onClick={() => set('logoSichtbar', !c.logoSichtbar)} style={{
              width: 44, height: 26, borderRadius: 13,
              background: c.logoSichtbar ? '#600812' : 'rgba(139,113,90,0.3)',
              border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                position: 'absolute', top: 3, left: c.logoSichtbar ? 21 : 3,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
        </div>

        <button onClick={herunterladen} disabled={loading} style={{
          width: '100%', padding: '14px', borderRadius: 12,
          background: loading ? 'rgba(96,8,18,0.4)' : '#600812', border: 'none',
          color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
          cursor: loading ? 'default' : 'pointer', letterSpacing: '0.04em',
        }}>
          {loading ? 'Wird erstellt…' : 'Als PNG herunterladen'}
        </button>
      </div>

      {/* Rechte Spalte: Vorschau */}
      <div style={{ flex: 1, minWidth: 300 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>
          Vorschau — 1080 × 1080 px
        </div>
        <div style={{
          width: 380, height: 380, overflow: 'hidden',
          borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          flexShrink: 0,
        }}>
          <div ref={previewRef} style={{ width: 1080, height: 1080, transformOrigin: 'top left', transform: `scale(${SCALE})` }}>
            <Vorschau c={c} />
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
          Vorschau ist skaliert — Download in voller Auflösung (2160 × 2160 px)
        </div>
      </div>

    </div>
  )
}
