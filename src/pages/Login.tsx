import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { pb } from '../lib/pocketbase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="login-page">
      <div className="status-bar">
        <Link to="/" className="logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.svg" alt="Responda" style={{ width: 32, height: 32 }} />
          <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.01em', color: 'var(--text)' }}>Responda</span>
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
      </div>
    </div>
  )
}
