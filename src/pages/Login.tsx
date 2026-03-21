import { useState } from ‘react’
import { useNavigate, Link } from ‘react-router-dom’
import { pb } from ‘../lib/pocketbase’

export default function Login() {
const navigate = useNavigate()
const [email, setEmail] = useState(’’)
const [password, setPassword] = useState(’’)
const [error, setError] = useState(’’)
const [loading, setLoading] = useState(false)

async function handleLogin(e) {
e.preventDefault()
setError(’’)
setLoading(true)

```
const timeoutId = setTimeout(() => {
  setLoading(false)
  setError('Zeitüberschreitung - Bitte versuche es erneut')
}, 10000)

try {
  await pb.collection('users').authWithPassword(email, password)
  clearTimeout(timeoutId)
  navigate('/hub', { replace: true })
} catch (err) {
  clearTimeout(timeoutId)
  console.error('Login error:', err)
  
  if (err?.status === 400) {
    setError('E-Mail oder Passwort falsch')
  } else if (err?.message?.includes('Failed to fetch')) {
    setError('Keine Verbindung zum Server')
  } else {
    setError('Anmeldung fehlgeschlagen')
  }
} finally {
  setLoading(false)
}
```

}

return (
<div className="login-page">
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

```
  <div className="login-container">
    <div className="login-card">
      <div className="login-header">
        <h1>Willkommen zurück</h1>
        <p>Melde dich an um fortzufahren</p>
      </div>

      <form onSubmit={handleLogin} className="login-form">
        <div className="field">
          <label>E-Mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="deine@email.de"
            required
            disabled={loading}
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
            disabled={loading}
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

      <div className="login-footer">
        Passwort vergessen?{' '}
        <a href="mailto:support@responda.systems">
          Support kontaktieren
        </a>
      </div>
    </div>
  </div>

  <style>{`
    .login-page {
      min-height: 100vh;
      background: #f5f5f7;
      display: flex;
      flex-direction: column;
    }

    .status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .logo {
      text-decoration: none;
      transition: opacity 0.2s;
    }

    .logo:hover {
      opacity: 0.8;
    }

    .login-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
    }

    .login-card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 48px;
      width: 100%;
      max-width: 440px;
      box-shadow: 
        0 4px 20px rgba(0, 0, 0, 0.08),
        0 0 0 1px rgba(255, 255, 255, 0.5) inset;
    }

    .login-header {
      margin-bottom: 32px;
      text-align: center;
    }

    .login-header h1 {
      font-size: 28px;
      font-weight: 600;
      color: #1d1d1f;
      margin: 0 0 8px 0;
    }

    .login-header p {
      font-size: 16px;
      color: #86868b;
      margin: 0;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .field label {
      font-size: 14px;
      font-weight: 500;
      color: #1d1d1f;
    }

    .field input {
      padding: 12px 16px;
      font-size: 16px;
      border: 1px solid #d2d2d7;
      border-radius: 10px;
      transition: all 0.2s;
      font-family: inherit;
      background: rgba(255, 255, 255, 0.9);
    }

    .field input:focus {
      outline: none;
      border-color: #0071e3;
      box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.1);
      background: white;
    }

    .field input:disabled {
      background: #f5f5f7;
      cursor: not-allowed;
      opacity: 0.6;
    }

    .login-error {
      padding: 12px 16px;
      background: #fff3f3;
      border: 1px solid #ffdddd;
      border-radius: 10px;
      color: #d70015;
      font-size: 14px;
      text-align: center;
    }

    .login-btn {
      padding: 14px 24px;
      font-size: 16px;
      font-weight: 500;
      color: white;
      background: #0071e3;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    }

    .login-btn:hover:not(:disabled) {
      background: #0077ed;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 113, 227, 0.3);
    }

    .login-btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .login-btn:disabled {
      background: #86868b;
      cursor: not-allowed;
      transform: none;
    }

    .login-footer {
      margin-top: 24px;
      text-align: center;
      font-size: 14px;
      color: #86868b;
    }

    .login-footer a {
      color: #0071e3;
      text-decoration: none;
      font-weight: 500;
    }

    .login-footer a:hover {
      text-decoration: underline;
    }

    @media (max-width: 640px) {
      .login-card {
        padding: 32px 24px;
      }

      .login-header h1 {
        font-size: 24px;
      }
    }
  `}</style>
</div>
```

)
}
