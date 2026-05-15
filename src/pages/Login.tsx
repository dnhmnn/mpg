import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { pb } from '../lib/pocketbase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

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
      sessionStorage.setItem('justLoggedIn', '1')
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

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setResetMsg('')
    setResetLoading(true)
    try {
      await pb.collection('users').requestPasswordReset(resetEmail.trim())
      setResetMsg('✅ E-Mail gesendet! Bitte prüfe deinen Posteingang.')
    } catch {
      setResetMsg('❌ Fehler beim Senden. Bitte versuche es erneut.')
    } finally {
      setResetLoading(false)
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
        .login-field input {
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
        .login-field input:focus { outline: none; border-color: var(--accent); }
        .login-field input::placeholder { color: var(--text-placeholder); }
        .login-field input:disabled { opacity: 0.5; }
        .lbtn { transition: background 0.15s, transform 0.12s; }
        .lbtn:active { transform: scale(0.97); }
      `}</style>

      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <img src="/logo.svg" alt="Responda" width="120" height="120" />
        <span style={{ fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.01em', color: 'var(--text)' }}>Responda</span>
      </Link>

      <div style={{ width: '100%', maxWidth: '360px' }}>
        {!resetMode ? (
          <>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px', textAlign: 'center' }}>Willkommen zurück</h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 28px' }}>Melde dich an um fortzufahren</p>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="login-field">
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>E-Mail</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="deine@email.de" required disabled={loading} />
              </div>
              <div className="login-field">
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Passwort</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required disabled={loading} />
              </div>

              {error && (
                <div style={{ padding: '11px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 14, color: '#b91c1c', textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="lbtn"
                style={{ padding: '14px', borderRadius: 12, background: 'var(--accent)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'inherit', marginTop: 4, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Anmeldung läuft…' : 'Anmelden'}
              </button>
            </form>

            <button onClick={() => { setResetMode(true); setResetEmail(email) }}
              style={{ display: 'block', margin: '20px auto 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
              Passwort vergessen?
            </button>
          </>
        ) : (
          <>
            <button onClick={() => { setResetMode(false); setResetMsg('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, marginBottom: 24, padding: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              Zurück
            </button>

            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px', textAlign: 'center' }}>Passwort zurücksetzen</h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 28px' }}>Wir senden dir einen Reset-Link per E-Mail</p>

            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="login-field">
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>E-Mail</label>
                <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  placeholder="deine@email.de" required disabled={resetLoading} />
              </div>

              {resetMsg && (
                <div style={{ padding: '11px 14px', background: resetMsg.startsWith('✅') ? 'rgba(52,199,89,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${resetMsg.startsWith('✅') ? 'rgba(52,199,89,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 10, fontSize: 14, color: resetMsg.startsWith('✅') ? '#15803d' : '#b91c1c', textAlign: 'center' }}>
                  {resetMsg}
                </div>
              )}

              <button type="submit" disabled={resetLoading || !!resetMsg.startsWith('✅')} className="lbtn"
                style={{ padding: '14px', borderRadius: 12, background: 'var(--accent)', border: 'none', cursor: resetLoading ? 'not-allowed' : 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'inherit', marginTop: 4, opacity: resetLoading ? 0.7 : 1 }}>
                {resetLoading ? 'Wird gesendet…' : 'Reset-Link senden'}
              </button>
            </form>
          </>
        )}
      </div>

      <p style={{ position: 'fixed', bottom: 'calc(12px + env(safe-area-inset-bottom))', fontSize: 11, color: 'var(--text-secondary)', margin: 0, opacity: 0.5 }}>
        © 2025 Responda Systems
      </p>
    </div>
  )
}
