import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { pb } from '../lib/pocketbase'

const inpSt: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '0.5px solid rgba(0,0,0,0.15)',
  borderRadius: 10, fontSize: 15, fontFamily: 'inherit', background: '#fff',
  color: '#1d1d1f', boxSizing: 'border-box',
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [shortcuts, setShortcuts] = useState<{ name: string; url: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('login_shortcuts') || '[]') } catch { return [] }
  })
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const touchStartY = useRef(0)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const timeoutId = setTimeout(() => {
      setLoading(false)
      setError('Zeitüberschreitung - Bitte versuche es erneut')
    }, 10000)
    try {
      const authData = await pb.collection('users').authWithPassword(email, password)
      clearTimeout(timeoutId)
      try {
        const { initializeAndUnlock } = await import('../lib/keyManager')
        await initializeAndUnlock(authData.record.id, password)
      } catch (keyErr) {
        console.warn('Key init failed, chat will prompt for password:', keyErr)
      }
      const perms = authData.record?.permissions || {}
      const isLernbarOnly = perms.lernbar && !Object.entries(perms).some(([k, v]) => k !== 'lernbar' && v)
      navigate(isLernbarOnly ? '/lernbar' : '/hub', { replace: true })
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err?.status === 400) setError('E-Mail oder Passwort falsch')
      else if (err?.message?.includes('Failed to fetch')) setError('Keine Verbindung zum Server')
      else setError('Anmeldung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  function saveShortcuts(list: { name: string; url: string }[]) {
    setShortcuts(list)
    localStorage.setItem('login_shortcuts', JSON.stringify(list))
  }

  function addShortcut() {
    if (!newName.trim() || !newUrl.trim()) return
    saveShortcuts([...shortcuts, { name: newName.trim(), url: newUrl.trim() }])
    setNewName(''); setNewUrl(''); setAdding(false)
  }

  return (
    <div className="login-page">
      <style>{`
        @keyframes controlDrift {
          0%, 100% { transform: translateY(0); opacity: 0.45; }
          55% { transform: translateY(6px); opacity: 0.85; }
        }
        .control-handle { animation: controlDrift 2.2s ease-in-out infinite; }
      `}</style>

      <div className="status-bar">
        <Link to="/" className="logo">
          <svg width="120" height="32" viewBox="0 0 560 140">
            <rect x="20" y="20" width="100" height="100" rx="26" fill="#1e3a8a" opacity="0.15"/>
            <path d="M45 42 L45 98 L60 98 L60 78 L72 78 L83 98 L100 98 L87 77 Q92 74 92 63 Q92 42 75 42 Z M60 52 L72 52 Q77 52 77 62 Q77 72 72 72 L60 72 Z" fill="#1e3a8a"/>
            <text x="140" y="80" fontFamily="Inter, sans-serif" fontSize="46" fontWeight="600" fill="#1d1d1f" letterSpacing="0">Responda</text>
          </svg>
        </Link>
      </div>

      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>Willkommen zurück</h1>
            <p>Melde dich an um fortzufahren</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="field">
              <label>E-Mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="deine@email.de" required disabled={loading} />
            </div>
            <div className="field">
              <label>Passwort</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required disabled={loading} />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" disabled={loading} className="login-btn">
              {loading ? 'Anmeldung läuft...' : 'Anmelden'}
            </button>
          </form>

          <div className="login-footer">
            Passwort vergessen?{' '}
            <a href="mailto:support@responda.systems">Support kontaktieren</a>
          </div>
        </div>

        {/* Animated Control handle */}
        <div
          className="control-handle"
          style={{ marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
          onClick={() => setSheetOpen(true)}
          onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
          onTouchEnd={e => { if (touchStartY.current - e.changedTouches[0].clientY > 30) setSheetOpen(true) }}
        >
          <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
            <path d="M2 2L11 11L20 2" stroke="rgba(0,0,0,0.32)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(0,0,0,0.28)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Control</span>
        </div>
      </div>

      {/* Bottom Sheet Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 100, background: sheetOpen ? 'rgba(0,0,0,0.25)' : 'transparent', pointerEvents: sheetOpen ? 'all' : 'none', transition: 'background .3s', backdropFilter: sheetOpen ? 'blur(4px)' : 'none' }}
        onClick={() => { setSheetOpen(false); setAdding(false) }}
      >
        <div
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '22px 22px 0 0', padding: '10px 20px calc(32px + env(safe-area-inset-bottom))', transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .35s cubic-bezier(0.32,0.72,0,1)', maxHeight: '70vh', overflowY: 'auto', boxShadow: '0 -4px 32px rgba(0,0,0,0.12)' }}
          onClick={e => e.stopPropagation()}
          onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
          onTouchEnd={e => { if (e.changedTouches[0].clientY - touchStartY.current > 50) { setSheetOpen(false); setAdding(false) } }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(0,0,0,0.15)', margin: '0 auto 18px' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1d1d1f' }}>Kurzbefehle</span>
            {!adding && (
              <button onClick={() => setAdding(true)} style={{ background: 'rgba(107,15,26,0.08)', border: 'none', borderRadius: 8, padding: '5px 12px', fontWeight: 700, fontSize: '.82rem', color: '#6B0F1A', cursor: 'pointer', fontFamily: 'inherit' }}>+ Neu</button>
            )}
          </div>

          {shortcuts.length === 0 && !adding && (
            <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: '.9rem', textAlign: 'center', margin: '24px 0' }}>Noch keine Kurzbefehle. Tippe auf „+ Neu".</p>
          )}

          {shortcuts.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(107,15,26,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B0F1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </div>
              <button
                onClick={() => { setSheetOpen(false); navigate(s.url) }}
                style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: '.95rem', color: '#1d1d1f', fontWeight: 600, padding: 0 }}
              >
                {s.name}
                <div style={{ fontSize: '.75rem', color: 'rgba(0,0,0,0.35)', fontWeight: 400, marginTop: 1 }}>{s.url}</div>
              </button>
              <button onClick={() => saveShortcuts(shortcuts.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.25)', fontSize: 20, lineHeight: 1, padding: '4px 6px', flexShrink: 0 }}>×</button>
            </div>
          ))}

          {adding && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input style={inpSt} placeholder="Name (z.B. Ausbildungstermin anlegen)" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
              <input style={inpSt} placeholder="URL (z.B. /ausbildungen/neu)" value={newUrl} onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addShortcut()} />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={addShortcut} style={{ flex: 1, background: '#6B0F1A', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '.9rem' }}>Hinzufügen</button>
                <button onClick={() => { setAdding(false); setNewName(''); setNewUrl('') }} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 10, padding: '11px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '.9rem', color: '#1d1d1f' }}>Abbrechen</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
