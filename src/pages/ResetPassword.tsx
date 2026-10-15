// Neues Passwort festlegen — Ziel des Links aus der E-Mail "Passwort
// zurücksetzen". Nimmt den Link in jeder Form an, die PocketBase verschicken
// kann (lib/resetLink.ts), und sagt bei einer Ablehnung, woran es liegt.

import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { resetEmail, resetFehler, resetToken } from '../lib/resetLink'

const LABEL: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--lbf-akzent)', marginBottom: 6 }

export default function ResetPassword() {
  const navigate = useNavigate()
  const ort = useLocation()
  const token = resetToken(ort)
  const email = token ? resetEmail(token) : ''
  const neuAnfordern = `/login?${email ? `email=${encodeURIComponent(email)}&` : ''}passwort=neu`

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== passwordConfirm) { setMsg('Die beiden Passwörter stimmen nicht überein.'); return }
    if (password.length < 8) { setMsg('Das Passwort braucht mindestens 8 Zeichen.'); return }
    setMsg('')
    setLoading(true)
    try {
      await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
      setDone(true)
    } catch (err: any) {
      setMsg(resetFehler(err?.status, err?.response?.data))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px calc(48px + env(safe-area-inset-bottom))' }}>
      <style>{`
        .rp-input { width: 100%; padding: 13px 14px; border-radius: 10px; border: 1.5px solid rgba(var(--lbf-rot-rgb),0.15); background: var(--lbf-card); color: var(--lbf-text); font-size: 15px; font-family: inherit; box-sizing: border-box; transition: border-color 0.2s; -webkit-appearance: none; }
        .rp-input:focus { outline: none; border-color: var(--lbf-akzent); }
        .rp-input::placeholder { color: var(--warm-gray); opacity: 0.7; }
        .rp-input:disabled { opacity: 0.5; }
        .rp-btn { transition: opacity 0.15s, transform 0.12s; }
        .rp-btn:active { transform: scale(0.97); }
      `}</style>

      <Link to="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 36 }}>
        <img src="/logo.svg" alt="Responda" width="120" height="120" />
        <span style={{ fontWeight: 700, fontSize: '1.4rem', letterSpacing: '-0.01em', color: 'var(--lbf-text)' }}>Responda</span>
      </Link>

      <div style={{ width: '100%', maxWidth: 360, background: 'var(--lbf-card)', borderRadius: 16, boxShadow: '0 2px 16px rgba(96,8,18,0.07)', padding: '28px 24px 24px', border: '0.5px solid var(--lbf-border-light)' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--lbf-akzent)', marginBottom: 6 }}>Passwort</div>
          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: 'var(--lbf-text)', lineHeight: 1.2 }}>
            {done ? 'Festgelegt' : !token ? 'Link unvollständig' : 'Neues Passwort'}
          </div>
          <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', marginTop: 4 }}>
            {done ? 'Du kannst dich jetzt mit deinem Passwort anmelden.'
              : !token ? 'In diesem Link fehlt der Teil, der dich ausweist. Fordere einen neuen an.'
              : email ? `Für ${email}` : 'Wähle ein Passwort mit mindestens 8 Zeichen.'}
          </div>
        </div>

        {done ? (
          <button className="rp-btn" onClick={() => navigate(email ? `/login?email=${encodeURIComponent(email)}` : '/login')}
            style={{ width: '100%', padding: '14px', borderRadius: 10, background: 'var(--lbf-akzent-grund)', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'inherit', letterSpacing: '0.02em' }}>
            Zur Anmeldung
          </button>
        ) : !token ? (
          <Link to={neuAnfordern} className="rp-btn"
            style={{ display: 'block', textAlign: 'center', padding: '14px', borderRadius: 10, background: 'var(--lbf-akzent-grund)', fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
            Neuen Link anfordern
          </Link>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Für den Passwort-Manager: zu welchem Zugang das Passwort gehört */}
            {email && <input type="email" autoComplete="username" value={email} readOnly hidden />}
            <div>
              <label style={LABEL}>Neues Passwort</label>
              <input className="rp-input" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen" required disabled={loading} />
            </div>
            <div>
              <label style={LABEL}>Wiederholen</label>
              <input className="rp-input" type="password" autoComplete="new-password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}
                placeholder="••••••••" required disabled={loading} />
            </div>

            {msg && (
              <div role="alert" style={{ padding: '10px 14px', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, fontSize: 13, fontStyle: 'italic', lineHeight: 1.45, color: 'var(--lbf-fehler-text-2)' }}>
                {msg}
              </div>
            )}

            <button type="submit" disabled={loading} className="rp-btn"
              style={{ marginTop: 4, padding: '14px', borderRadius: 10, background: 'var(--lbf-akzent-grund)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, letterSpacing: '0.02em' }}>
              {loading ? 'Wird gespeichert…' : 'Passwort festlegen'}
            </button>
            <Link to={neuAnfordern} style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--lbf-akzent)', textDecoration: 'none' }}>
              Neuen Link anfordern
            </Link>
          </form>
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', opacity: 0.6 }}>
        © 2025 Responda Systems
      </p>
    </div>
  )
}
