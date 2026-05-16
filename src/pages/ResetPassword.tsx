import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { pb } from '../lib/pocketbase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== passwordConfirm) { setMsg('Die Passwörter stimmen nicht überein.'); return }
    if (password.length < 8) { setMsg('Das Passwort muss mindestens 8 Zeichen lang sein.'); return }
    setMsg('')
    setLoading(true)
    try {
      await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
      setDone(true)
    } catch {
      setMsg('Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px calc(48px + env(safe-area-inset-bottom))',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <style>{`
        .rp-field input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 12px;
          border: 1.5px solid var(--border);
          background: var(--bg-input);
          color: var(--text);
          font-size: 15px;
          font-family: inherit;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .rp-field input:focus { outline: none; border-color: var(--accent); }
        .rp-field input::placeholder { color: var(--text-placeholder); }
        .rp-btn { transition: background 0.15s, transform 0.12s; }
        .rp-btn:active { transform: scale(0.97); }
      `}</style>

      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <img src="/logo.svg" alt="Responda" width="120" height="120" />
        <span style={{ fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.01em', color: 'var(--text)' }}>Responda</span>
      </Link>

      <div style={{ width: '100%', maxWidth: '360px' }}>
        {done ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(52,199,89,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Passwort geändert</h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>Du kannst dich jetzt mit deinem neuen Passwort anmelden.</p>
            <button
              className="rp-btn"
              onClick={() => navigate('/login')}
              style={{ marginTop: 8, padding: '14px 32px', borderRadius: 12, background: 'var(--accent)', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'inherit' }}
            >
              Zum Login
            </button>
          </div>
        ) : !token ? (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Ungültiger Link</h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 24px' }}>Bitte fordere einen neuen Reset-Link an.</p>
            <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>Zurück zum Login</Link>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px', textAlign: 'center' }}>Neues Passwort</h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 28px' }}>Gib dein neues Passwort ein</p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="rp-field">
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Neues Passwort</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen" required disabled={loading} />
              </div>
              <div className="rp-field">
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Passwort bestätigen</label>
                <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••" required disabled={loading} />
              </div>

              {msg && (
                <div style={{ padding: '11px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 14, color: '#b91c1c', textAlign: 'center' }}>
                  {msg}
                </div>
              )}

              <button type="submit" disabled={loading} className="rp-btn"
                style={{ padding: '14px', borderRadius: 12, background: 'var(--accent)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'inherit', marginTop: 4, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Wird gespeichert…' : 'Passwort speichern'}
              </button>
            </form>

            <Link to="/login" style={{ display: 'block', textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>
              Zurück zum Login
            </Link>
          </>
        )}
      </div>

      <p style={{ position: 'fixed', bottom: 'calc(12px + env(safe-area-inset-bottom))', fontSize: 11, color: 'var(--text-secondary)', margin: 0, opacity: 0.5 }}>
        © 2025 Responda Systems
      </p>
    </div>
  )
}
