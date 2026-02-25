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

    try {
      await pb.collection('users').authWithPassword(email, password)

      // Erfolgreich eingeloggt - zum Hub
      navigate('/hub')
    } catch (err: unknown) {
      console.error('Login error:', err)
      setError('E-Mail oder Passwort falsch')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Status Bar */}
      <div className="status-bar">
        <Link to="/" className="logo">
          <svg width="120" height="32" viewBox="0 0 560 140">
            <rect x="20" y="20" width="100" height="100" rx="26" fill="rgba(255,255,255,0.25)"/>
            <path d="M45 42 L45 98 L60 98 L60 78 L72 78 L83 98 L100 98 L87 77 Q92 74 92 63 Q92 42 75 42 Z M60 52 L72 52 Q77 52 77 62 Q77 72 72 72 L60 72 Z" fill="white"/>
            <text x="140" y="80" fontFamily="Inter, sans-serif" fontSize="46" fontWeight="600" fill="white" letterSpacing="0">Responda</text>
          </svg>
        </Link>
        <div></div>
        <div></div>
      </div>

      {/* Login Form */}
      <div className="login-container">
        <div className="login-card">
          {/* Header */}
          <div className="login-header">
            <h1>Willkommen zurück</h1>
            <p>Melde dich an um fortzufahren</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="login-form">
            <div className="field">
              <label>E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deine@email.de"
                required
              />
            </div>

            <div className="field">
              <label>Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="login-btn"
            >
              {loading ? 'Anmeldung läuft...' : 'Anmelden'}
            </button>
          </form>

          {/* Footer */}
          <div className="login-footer">
            Passwort vergessen?{' '}
            <a href="mailto:support@responda.systems">
              Support kontaktieren
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
