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
try {
  await pb.collection('users').authWithPassword(email, password)
  navigate('/hub')
} catch (err) {
  console.error('Login error:', err)
  setError('Login fehlgeschlagen')
} finally {
  setLoading(false)
}
```

}

return (
<div style={{ minHeight: ‘100vh’, background: ‘#f5f5f7’, display: ‘flex’, flexDirection: ‘column’ }}>
<div style={{ padding: ‘16px 24px’, background: ‘white’, borderBottom: ‘1px solid #ddd’ }}>
<Link to="/">Responda</Link>
</div>

```
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
    <div style={{ background: 'white', borderRadius: '16px', padding: '48px', width: '100%', maxWidth: '440px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 600, margin: '0 0 8px 0' }}>Willkommen zurück</h1>
        <p style={{ fontSize: '16px', color: '#86868b', margin: 0 }}>Melde dich an</p>
      </div>

      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>E-Mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} style={{ width: '100%', padding: '12px 16px', fontSize: '16px', border: '1px solid #d2d2d7', borderRadius: '8px', boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Passwort</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} style={{ width: '100%', padding: '12px 16px', fontSize: '16px', border: '1px solid #d2d2d7', borderRadius: '8px', boxSizing: 'border-box' }} />
        </div>

        {error && <div style={{ padding: '12px 16px', background: '#fff3f3', border: '1px solid #ffdddd', borderRadius: '8px', color: '#d70015', fontSize: '14px', textAlign: 'center', marginBottom: '20px' }}>{error}</div>}

        <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px 24px', fontSize: '16px', fontWeight: 500, color: 'white', background: loading ? '#86868b' : '#0071e3', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Lädt...' : 'Anmelden'}
        </button>
      </form>

      <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#86868b' }}>
        Passwort vergessen? <a href="mailto:support@responda.systems" style={{ color: '#0071e3', textDecoration: 'none' }}>Support kontaktieren</a>
      </div>
    </div>
  </div>
</div>
```

)
}
