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
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="110" height="110">
          <circle cx="100" cy="100" r="100" fill="#720016"/>
          <circle cx="100" cy="100" r="97" fill="none" stroke="white" strokeWidth="2"/>
          <circle cx="100" cy="100" r="89" fill="none" stroke="white" strokeWidth="6"/>
          <circle cx="100" cy="100" r="84" fill="none" stroke="#720016" strokeWidth="4"/>
          <path d="M76 46 Q72 28 84 20 Q94 13 100 16 Q106 13 116 20 Q128 28 124 46" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M74 44 Q65 34 68 24 Q70 19 74 22" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round"/>
          <path d="M126 44 Q135 34 132 24 Q130 19 126 22" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round"/>
          <path d="M 100 68 C 108 66 120 71 126 80 C 132 89 132 103 127 114 C 123 123 116 130 108 133 C 100 136 92 134 86 128 C 80 122 78 112 79 102 C 80 92 83 82 88 76 C 92 71 96 68 100 68 Z" fill="white"/>
          <path d="M 88 74 C 90 66 95 61 100 60 C 106 59 112 62 117 68 L 120 72 C 115 65 107 62 100 63 C 93 64 89 68 88 74 Z" fill="white"/>
          <path d="M 88 72 C 83 65 76 56 68 47 C 62 40 56 33 54 26 C 60 22 68 25 74 32 C 80 39 85 50 87 62 Z" fill="white"/>
          <line x1="57" y1="30" x2="66" y2="46" stroke="#720016" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="61" y1="28" x2="70" y2="44" stroke="#720016" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="65" y1="28" x2="74" y2="44" stroke="#720016" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="69" y1="29" x2="77" y2="45" stroke="#720016" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="73" y1="32" x2="80" y2="48" stroke="#720016" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="77" y1="37" x2="83" y2="52" stroke="#720016" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M 88 76 Q 104 72 118 75" fill="none" stroke="#720016" strokeWidth="4" strokeLinecap="round"/>
          <ellipse cx="120" cy="92" rx="5" ry="4" fill="#720016"/>
          <path d="M 114 85 Q 120 83 126 86" fill="none" stroke="#720016" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M 128 103 Q 132 109 128 116" fill="none" stroke="#720016" strokeWidth="2" strokeLinecap="round"/>
          <path d="M 82 82 C 76 90 70 100 69 110 C 68 118 70 125 74 130 C 76 125 74 118 75 110 C 76 102 80 92 82 82 Z" fill="white"/>
          <path d="M 80 92 C 74 102 70 113 71 122 C 74 115 77 104 80 94 Z" fill="white"/>
          <path d="M 78 102 C 73 110 72 120 74 128 C 76 120 75 112 78 104 Z" fill="white"/>
          <path d="M 96 134 C 94 140 94 148 96 154 L 104 154 C 106 148 106 140 104 134 Z" fill="white"/>
          <path d="M 86 152 Q 100 160 114 152 L 114 156 Q 100 164 86 156 Z" fill="white"/>
          <path d="M 90 154 Q 85 163 89 171 Q 93 176 100 176" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round"/>
          <path d="M 110 154 Q 115 163 111 171 Q 107 176 100 176" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round"/>
          <ellipse cx="100" cy="176" rx="13" ry="9" fill="white"/>
          <ellipse cx="93" cy="173" rx="2.5" ry="2" fill="#720016"/>
          <ellipse cx="107" cy="173" rx="2.5" ry="2" fill="#720016"/>
          <path d="M 96 184 Q 93 190 90 193 M 104 184 Q 107 190 110 193" stroke="#720016" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: '28px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.02em' }}>Responda</span>
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

