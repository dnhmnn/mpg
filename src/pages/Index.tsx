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
      background: 'linear-gradient(160deg, #6B0F1A 0%, #3d0808 55%, #1a0303 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px calc(48px + env(safe-area-inset-bottom))',
      fontFamily: 'Inter, -apple-system, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,80,80,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tagFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tagFadeOut {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-6px); }
        }
        .tagline-text {
          animation: tagFadeIn 0.5s ease forwards;
        }
        .tagline-text.hiding {
          animation: tagFadeOut 0.5s ease forwards;
        }
        .landing-btn {
          transition: background 0.2s, transform 0.15s;
        }
        .landing-btn:active { transform: scale(0.97); }
        .org-input:focus { outline: none; border-color: rgba(255,255,255,0.5) !important; }
      `}</style>

      {/* Logo */}
      <div style={{ animation: 'fadeUp 0.7s ease forwards', marginBottom: '48px', textAlign: 'center' }}>
        <svg width="200" height="52" viewBox="0 0 560 140">
          <rect x="20" y="20" width="100" height="100" rx="26" fill="rgba(255,255,255,0.15)"/>
          <path d="M45 42 L45 98 L60 98 L60 78 L72 78 L83 98 L100 98 L87 77 Q92 74 92 63 Q92 42 75 42 Z M60 52 L72 52 Q77 52 77 62 Q77 72 72 72 L60 72 Z" fill="white"/>
          <text x="140" y="80" fontFamily="Inter, sans-serif" fontSize="46" fontWeight="600" fill="white" letterSpacing="0">Responda</text>
        </svg>
      </div>

      {/* Animated tagline */}
      <div style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '56px', overflow: 'hidden' }}>
        <p
          className={`tagline-text${visible ? '' : ' hiding'}`}
          key={taglineIndex}
          style={{ fontSize: 'clamp(15px, 4vw, 19px)', fontWeight: 500, color: 'rgba(255,255,255,0.82)', textAlign: 'center', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.4, maxWidth: '320px' }}
        >
          {TAGLINES[taglineIndex]}
        </p>
      </div>

      {/* Login button */}
      <button
        className="landing-btn"
        onClick={() => navigate('/login')}
        style={{ width: '100%', maxWidth: '320px', padding: '15px', borderRadius: '14px', background: 'rgba(255,255,255,0.95)', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 700, color: '#6B0F1A', fontFamily: 'inherit', letterSpacing: '-0.01em', marginBottom: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}
      >
        Anmelden
      </button>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '320px', margin: '20px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontWeight: 500, letterSpacing: '.05em' }}>ODER</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
      </div>

      {/* Org code section */}
      <form onSubmit={handleOrgSubmit} style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'rgba(255,255,255,0.45)', textAlign: 'center', letterSpacing: '.02em' }}>
          Organisations-Code eingeben
        </p>
        <input
          className="org-input"
          value={orgCode}
          onChange={e => { setOrgCode(e.target.value); setOrgError('') }}
          placeholder="z.B. feuerwehr-musterstadt"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', fontSize: '15px', color: '#fff', fontFamily: 'inherit', boxSizing: 'border-box', letterSpacing: '0.01em' }}
        />
        {orgError && <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,150,150,0.9)', textAlign: 'center' }}>{orgError}</p>}
        <button
          type="submit"
          className="landing-btn"
          style={{ padding: '13px', borderRadius: '12px', background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '15px', fontWeight: 600, color: '#fff', fontFamily: 'inherit' }}
        >
          Weiter →
        </button>
      </form>

      {/* Footer */}
      <p style={{ position: 'absolute', bottom: 'calc(16px + env(safe-area-inset-bottom))', fontSize: '11px', color: 'rgba(255,255,255,0.2)', margin: 0, letterSpacing: '.03em' }}>
        © 2025 Responda Systems
      </p>
    </div>
  )
}
