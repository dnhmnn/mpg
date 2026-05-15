import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const TAGLINES = [
  'Digitalisierung, die zuverlässig funktioniert.',
  'Einsatzbereit. Immer und überall.',
  'Dokumentation, die keine Zeit kostet.',
  'Zuverlässige Lösungen für den Rettungsdienst.',
  'Von der Idee zur digitalen Wirklichkeit.',
  'Sicher. Schnell. Vernetzt.',
]

export default function Index() {
  const navigate = useNavigate()
  const [taglineIndex, setTaglineIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [orgCode, setOrgCode] = useState('')
  const [orgError, setOrgError] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setTaglineIndex(i => (i + 1) % TAGLINES.length)
        setVisible(true)
      }, 500)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  function handleOrgSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = orgCode.trim().toLowerCase()
    if (!code) { setOrgError('Bitte einen Code eingeben.'); return }
    setOrgError('')
    navigate(`/${code}`)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px calc(48px + env(safe-area-inset-bottom))',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <style>{`
        @keyframes tagFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tagFadeOut {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-6px); }
        }
        .tagline-text { animation: tagFadeIn 0.5s ease forwards; }
        .tagline-text.hiding { animation: tagFadeOut 0.5s ease forwards; }
        .landing-btn { transition: background 0.15s, transform 0.12s; }
        .landing-btn:active { transform: scale(0.97); }
        .org-input:focus { outline: none; border-color: rgba(107,15,26,0.4) !important; }
        .org-input::placeholder { color: rgba(107,15,26,0.3); }
      `}</style>

      {/* Logo */}
      <div style={{ marginBottom: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <img src="/logo.svg" alt="Responda" width="120" height="120" />
        <span style={{ fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.01em', color: '#1d1d1f' }}>Responda</span>
      </div>

      {/* Animated tagline */}
      <div style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '48px', overflow: 'hidden' }}>
        <p
          className={`tagline-text${visible ? '' : ' hiding'}`}
          key={taglineIndex}
          style={{ fontSize: 'clamp(15px, 4vw, 18px)', fontWeight: 500, color: 'rgba(107,15,26,0.7)', textAlign: 'center', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.4, maxWidth: '320px' }}
        >
          {TAGLINES[taglineIndex]}
        </p>
      </div>

      {/* Login button */}
      <button
        className="landing-btn"
        onClick={() => navigate('/login')}
        style={{ width: '100%', maxWidth: '320px', padding: '15px', borderRadius: '14px', background: '#6B0F1A', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 700, color: '#fff', fontFamily: 'inherit', letterSpacing: '-0.01em', marginBottom: '12px' }}
      >
        Anmelden
      </button>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '320px', margin: '16px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(107,15,26,0.12)' }} />
        <span style={{ fontSize: '11px', color: 'rgba(107,15,26,0.35)', fontWeight: 600, letterSpacing: '.06em' }}>ODER</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(107,15,26,0.12)' }} />
      </div>

      {/* Org code section */}
      <form onSubmit={handleOrgSubmit} style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '12px', color: 'rgba(107,15,26,0.45)', textAlign: 'center', letterSpacing: '.04em', fontWeight: 600, textTransform: 'uppercase' }}>
          Organisations-Code
        </p>
        <input
          className="org-input"
          value={orgCode}
          onChange={e => { setOrgCode(e.target.value); setOrgError('') }}
          placeholder="z.B. feuerwehr-musterstadt"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', border: '1.5px solid rgba(107,15,26,0.15)', background: 'rgba(107,15,26,0.04)', fontSize: '15px', color: '#1d1d1f', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        {orgError && <p style={{ margin: 0, fontSize: '13px', color: '#c0392b', textAlign: 'center' }}>{orgError}</p>}
        <button
          type="submit"
          className="landing-btn"
          style={{ padding: '13px', borderRadius: '12px', background: 'rgba(107,15,26,0.06)', border: '1.5px solid rgba(107,15,26,0.15)', cursor: 'pointer', fontSize: '15px', fontWeight: 600, color: '#6B0F1A', fontFamily: 'inherit' }}
        >
          Weiter →
        </button>
      </form>

      {/* Footer */}
      <p style={{ position: 'fixed', bottom: 'calc(12px + env(safe-area-inset-bottom))', fontSize: '11px', color: 'rgba(107,15,26,0.2)', margin: 0, letterSpacing: '.03em' }}>
        © 2025 Responda Systems
      </p>
    </div>
  )
}

