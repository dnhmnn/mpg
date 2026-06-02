import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { pb } from '../lib/pocketbase'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const disabledHint = searchParams.get('reason') === 'disabled'
  const betaHint = searchParams.get('reason') === 'beta'

  const [step, setStep] = useState<'login' | 'mfa' | 'reset'>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [mfaId, setMfaId] = useState('')
  const [otpId, setOtpId] = useState('')
  const [mfaCode, setMfaCode] = useState('')

  const [resetEmail, setResetEmail] = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  async function finishLogin(record: any) {
    const u = record as any
    const expired = u?.expires_at && new Date(u.expires_at).getTime() < Date.now()
    if (u?.disabled || expired) {
      pb.authStore.clear()
      setError('Dein Zugang wurde deaktiviert oder ist abgelaufen. Bitte Admin kontaktieren.')
      setLoading(false)
      return
    }
    try {
      const { initializeAndUnlock } = await import('../lib/keyManager')
      await initializeAndUnlock(record.id, password)
    } catch (keyErr) {
      console.warn('Key init failed, chat will prompt for password:', keyErr)
    }
    const perms = record?.permissions || {}
    const isLernbarOnly = perms.lernbar && !Object.entries(perms).some(([k, v]) => k !== 'lernbar' && v)
    sessionStorage.setItem('justLoggedIn', '1')
    navigate(isLernbarOnly ? '/lernbar' : '/hub', { replace: true })
  }

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
      await finishLogin(authData.record)
    } catch (err: any) {
      clearTimeout(timeoutId)
      const pendingMfaId = err.response?.mfaId
      if (pendingMfaId) {
        try {
          const result = await (pb.collection('users') as any).requestOTP(email)
          setMfaId(pendingMfaId)
          setOtpId(result.otpId)
          setStep('mfa')
          setError('')
        } catch {
          setError('2FA erforderlich, aber Code konnte nicht gesendet werden.')
        }
        setLoading(false)
        return
      }
      if (err?.status === 400) setError('E-Mail oder Passwort falsch')
      else if (err?.message?.includes('Failed to fetch')) setError('Keine Verbindung zum Server')
      else setError('Anmeldung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const resp = await fetch(`https://api.responda.systems/api/collections/users/auth-with-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpId, password: mfaCode, mfaId }),
      })
      if (!resp.ok) {
        setError('Ungültiger Code. Bitte prüfe deine E-Mail und versuche es erneut.')
        setLoading(false)
        return
      }
      const data = await resp.json()
      pb.authStore.save(data.token, data.record)
      await finishLogin(data.record)
    } catch {
      setError('Verbindungsfehler. Bitte versuche es erneut.')
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
      setResetMsg('E-Mail gesendet! Bitte prüfe deinen Posteingang.')
    } catch {
      setResetMsg('Fehler beim Senden. Bitte versuche es erneut.')
    } finally {
      setResetLoading(false)
    }
  }

  const resetSuccess = resetMsg.startsWith('E-Mail gesendet')

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
        .l-input {
          width: 100%;
          padding: 13px 14px;
          border-radius: 10px;
          border: 1.5px solid rgba(96,8,18,0.15);
          background: var(--lbf-card);
          color: var(--lbf-text);
          font-size: 15px;
          font-family: inherit;
          box-sizing: border-box;
          transition: border-color 0.2s;
          -webkit-appearance: none;
        }
        .l-input:focus { outline: none; border-color: #600812; }
        .l-input::placeholder { color: var(--warm-gray); opacity: 0.7; }
        .l-input:disabled { opacity: 0.5; }
        .l-btn { transition: opacity 0.15s, transform 0.12s; }
        .l-btn:active { transform: scale(0.97); }
      `}</style>

      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 36 }}>
        <img src="/logo.svg" alt="Responda" width="120" height="120" />
        <span style={{ fontWeight: 700, fontSize: '1.4rem', letterSpacing: '-0.01em', color: 'var(--lbf-text)' }}>Responda</span>
      </Link>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 360, background: 'var(--lbf-card)', borderRadius: 16, boxShadow: '0 2px 16px rgba(96,8,18,0.07)', padding: '28px 24px 24px', border: '0.5px solid rgba(96,8,18,0.08)' }}>

        {step === 'login' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#600812', marginBottom: 6 }}>Anmeldung</div>
              <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: 'var(--lbf-text)', lineHeight: 1.2 }}>Willkommen zurück</div>
              <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', marginTop: 4 }}>Melde dich an um fortzufahren</div>
            </div>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#600812', marginBottom: 6 }}>E-Mail</label>
                <input className="l-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="deine@email.de" required disabled={loading} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#600812', marginBottom: 6 }}>Passwort</label>
                <input className="l-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required disabled={loading} />
              </div>

              {!error && disabledHint && (
                <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, fontSize: 13, color: '#b91c1c', fontStyle: 'italic' }}>
                  Dein Zugang wurde deaktiviert oder ist abgelaufen. Bitte Admin kontaktieren.
                </div>
              )}
              {!error && betaHint && (
                <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, fontSize: 13, color: '#b91c1c', fontStyle: 'italic' }}>
                  Diese Beta-Umgebung ist nur für Supervisoren zugänglich.
                </div>
              )}
              {error && (
                <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, fontSize: 13, color: '#b91c1c', fontStyle: 'italic' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="l-btn"
                style={{ marginTop: 4, padding: '14px', borderRadius: 10, background: '#600812', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, letterSpacing: '0.02em' }}>
                {loading ? 'Anmeldung läuft…' : 'Anmelden'}
              </button>
            </form>

            <button onClick={() => { setStep('reset'); setResetEmail(email) }}
              style={{ display: 'block', margin: '18px auto 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)', fontFamily: 'inherit' }}>
              Passwort vergessen?
            </button>
          </>
        )}

        {step === 'mfa' && (
          <>
            <button onClick={() => { setStep('login'); setError(''); setMfaCode('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#600812', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, marginBottom: 20, padding: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              Zurück
            </button>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#600812', marginBottom: 6 }}>Sicherheit</div>
              <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: 'var(--lbf-text)', lineHeight: 1.2 }}>Code eingeben</div>
              <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', marginTop: 4 }}>
                Wir haben einen Code an <span style={{ color: 'var(--lbf-text)', fontWeight: 700 }}>{email}</span> gesendet
              </div>
            </div>

            <form onSubmit={handleMfa} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#600812', marginBottom: 6 }}>Code</label>
                <input
                  className="l-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="000000"
                  required
                  disabled={loading}
                  autoComplete="one-time-code"
                  autoFocus
                  style={{ letterSpacing: '0.25em', fontSize: 20, textAlign: 'center' }}
                />
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, fontSize: 13, color: '#b91c1c', fontStyle: 'italic' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading || mfaCode.length < 4} className="l-btn"
                style={{ marginTop: 4, padding: '14px', borderRadius: 10, background: '#600812', border: 'none', cursor: (loading || mfaCode.length < 4) ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'inherit', opacity: (loading || mfaCode.length < 4) ? 0.7 : 1, letterSpacing: '0.02em' }}>
                {loading ? 'Wird geprüft…' : 'Bestätigen'}
              </button>
            </form>
          </>
        )}

        {step === 'reset' && (
          <>
            <button onClick={() => { setStep('login'); setResetMsg('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#600812', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, marginBottom: 20, padding: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              Zurück
            </button>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#600812', marginBottom: 6 }}>Passwort</div>
              <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: 'var(--lbf-text)', lineHeight: 1.2 }}>Zurücksetzen</div>
              <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', marginTop: 4 }}>Wir senden dir einen Reset-Link per E-Mail</div>
            </div>

            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#600812', marginBottom: 6 }}>E-Mail</label>
                <input className="l-input" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  placeholder="deine@email.de" required disabled={resetLoading} />
              </div>

              {resetMsg && (
                <div style={{ padding: '10px 14px', background: resetSuccess ? 'rgba(22,163,74,0.06)' : 'rgba(192,57,43,0.06)', border: `1px solid ${resetSuccess ? 'rgba(22,163,74,0.2)' : 'rgba(192,57,43,0.2)'}`, borderRadius: 8, fontSize: 13, fontStyle: 'italic', color: resetSuccess ? '#15803d' : '#b91c1c' }}>
                  {resetMsg}
                </div>
              )}

              <button type="submit" disabled={resetLoading || resetSuccess} className="l-btn"
                style={{ marginTop: 4, padding: '14px', borderRadius: 10, background: '#600812', border: 'none', cursor: resetLoading ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'inherit', opacity: (resetLoading || resetSuccess) ? 0.7 : 1, letterSpacing: '0.02em' }}>
                {resetLoading ? 'Wird gesendet…' : 'Reset-Link senden'}
              </button>
            </form>
          </>
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', opacity: 0.6 }}>
        © 2025 Responda Systems
      </p>
    </div>
  )
}
