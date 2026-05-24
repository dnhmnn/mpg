import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LandingPage from './LandingPage'

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

  if (window.location.hostname === 'responda.systems' || window.location.hostname === 'www.responda.systems') {
    return <LandingPage />
  }
  const [taglineIndex, setTaglineIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [orgCode, setOrgCode] = useState('')
  const [orgError, setOrgError] = useState('')
  const [showOrgInput, setShowOrgInput] = useState(false)

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
      background: 'var(--warm-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px calc(48px + env(safe-area-inset-bottom))',
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
        .landing-btn { transition: opacity 0.15s, transform 0.12s; }
        .landing-btn:active { transform: scale(0.97); }
        .org-input { -webkit-appearance: none; }
        .org-input:focus { outline: none; border-color: #600812 !important; }
        .org-input::placeholder { color: var(--warm-gray); opacity: 0.7; }
      `}</style>

      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <img src="/logo.svg" alt="Responda" width="120" height="120" />
        <span style={{ fontWeight: 700, fontSize: '1.4rem', letterSpacing: '-0.01em', color: '#1a0e08' }}>Responda</span>
      </div>

      {/* Animated tagline */}
      <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 44, overflow: 'hidden' }}>
        <p
          className={`tagline-text${visible ? '' : ' hiding'}`}
          key={taglineIndex}
          style={{ fontStyle: 'italic', fontSize: 'clamp(14px, 4vw, 17px)', fontWeight: 400, color: 'var(--warm-gray)', textAlign: 'center', margin: 0, lineHeight: 1.4, maxWidth: 300 }}
        >
          {TAGLINES[taglineIndex]}
        </p>
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(96,8,18,0.07)', padding: '28px 24px 24px', border: '0.5px solid rgba(96,8,18,0.08)' }}>

        {/* Anmelden */}
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#600812', marginBottom: 12 }}>Zugang</div>
        <button
          className="landing-btn"
          onClick={() => navigate('/login')}
          style={{ width: '100%', padding: '14px', borderRadius: 10, background: '#600812', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'inherit', letterSpacing: '0.02em' }}
        >
          Anmelden
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <div style={{ flex: 1, height: '0.5px', background: 'rgba(96,8,18,0.12)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--warm-gray)', textTransform: 'uppercase' }}>oder</span>
          <div style={{ flex: 1, height: '0.5px', background: 'rgba(96,8,18,0.12)' }} />
        </div>

        {/* Org code */}
        {!showOrgInput ? (
          <button
            className="landing-btn"
            onClick={() => setShowOrgInput(true)}
            style={{ width: '100%', padding: '13px', borderRadius: 10, background: 'rgba(96,8,18,0.06)', border: '1px solid rgba(96,8,18,0.15)', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#600812', fontFamily: 'inherit', letterSpacing: '0.02em' }}
          >
            Mit Organisations-Code
          </button>
        ) : (
          <form onSubmit={handleOrgSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#600812' }}>
              Organisations-Code
            </label>
            <input
              className="org-input"
              value={orgCode}
              onChange={e => { setOrgCode(e.target.value); setOrgError('') }}
              placeholder="z.B. feuerwehr-musterstadt"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              spellCheck={false}
              style={{ width: '100%', padding: '13px 14px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: '#1a0e08', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            {orgError && (
              <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic', color: '#b91c1c', textAlign: 'center' }}>{orgError}</p>
            )}
            <button
              type="submit"
              className="landing-btn"
              style={{ padding: '13px', borderRadius: 10, background: 'rgba(96,8,18,0.06)', border: '1px solid rgba(96,8,18,0.15)', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#600812', fontFamily: 'inherit', letterSpacing: '0.02em' }}
            >
              Weiter →
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <p style={{ marginTop: 28, fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', opacity: 0.6 }}>
        © 2025 Responda Systems
      </p>
    </div>
  )
}
