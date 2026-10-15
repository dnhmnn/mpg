import { useEffect, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { NEU_SEKUNDEN, anforderFehler, codeFehler, istEmail, maskiereEmail, restZeit } from '../lib/zweiFaktor'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const disabledHint = searchParams.get('reason') === 'disabled'
  const betaHint = searchParams.get('reason') === 'beta'
  // Aus der Willkommens-E-Mail: Adresse vorbelegt, "Passwort festlegen" öffnet gleich das Zurücksetzen
  const vorgabeEmail = searchParams.get('email') || ''
  const neuesPasswort = searchParams.get('passwort') === 'neu'

  const [step, setStep] = useState<'login' | 'mfa' | 'reset'>(neuesPasswort ? 'reset' : 'login')

  const [identifier, setIdentifier] = useState(vorgabeEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [mfaId, setMfaId] = useState('')
  const [otpId, setOtpId] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  // Wohin der Code geht (bei Anmeldung mit Benutzernamen fragt die Maske nach der Adresse)
  const [otpEmail, setOtpEmail] = useState('')
  const [codeGesendet, setCodeGesendet] = useState(0)
  const [sperreBis, setSperreBis] = useState(0)
  const [info, setInfo] = useState('')
  const [jetzt, setJetzt] = useState(() => Date.now())
  // Für Wartezeiten im Code-Schritt
  useEffect(() => {
    if (step !== 'mfa') return
    const t = setInterval(() => setJetzt(Date.now()), 1000)
    return () => clearInterval(t)
  }, [step])
  const gesperrt = sperreBis > jetzt
  const neuAb = codeGesendet + NEU_SEKUNDEN * 1000

  const [resetEmail, setResetEmail] = useState(neuesPasswort ? vorgabeEmail : '')
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
    // Leerzeichen aus dem Autofill stören die Anmeldung
    const id = identifier.trim()
    try {
      const authData = await pb.collection('users').authWithPassword(id, password)
      clearTimeout(timeoutId)
      await finishLogin(authData.record)
    } catch (err: any) {
      clearTimeout(timeoutId)
      const pendingMfaId = err.response?.mfaId
      if (pendingMfaId) {
        // Passwort stimmt — jetzt der Code per E-Mail
        setMfaId(pendingMfaId)
        setOtpId('')
        setMfaCode('')
        setInfo('')
        setSperreBis(0)
        setStep('mfa')
        if (istEmail(id)) {
          setOtpEmail(id)
          await codeAnfordern(id)
        } else {
          // Mit Benutzernamen angemeldet: Den Code gibt es nur an die E-Mail-Adresse
          setOtpEmail('')
        }
        setLoading(false)
        return
      }
      if (err?.status === 400) setError('E-Mail oder Passwort falsch')
      else if (err?.status === 429) setError('Zu viele Anmeldeversuche. Bitte warte kurz.')
      else if (err?.message?.includes('Failed to fetch') || !err?.status) setError('Keine Verbindung zum Server')
      else setError('Anmeldung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  // Code an die Adresse schicken; ein neuer Code macht die älteren ungültig
  async function codeAnfordern(email: string): Promise<boolean> {
    setError('')
    try {
      const result = await (pb.collection('users') as any).requestOTP(email.trim())
      setOtpId(result.otpId)
      setCodeGesendet(Date.now())
      setJetzt(Date.now())
      setMfaCode('')
      return true
    } catch (err: any) {
      const f = anforderFehler(err?.status)
      setError(f.text)
      if (f.sperreBis) setSperreBis(f.sperreBis)
      return false
    }
  }

  async function neuerCode() {
    setLoading(true)
    setInfo('')
    if (await codeAnfordern(otpEmail)) setInfo(`Neuer Code an ${maskiereEmail(otpEmail)} gesendet. Nur dieser gilt.`)
    setLoading(false)
  }

  async function adresseSenden(e: React.FormEvent) {
    e.preventDefault()
    if (!istEmail(otpEmail)) { setError('Bitte gib die E-Mail-Adresse deines Zugangs ein.'); return }
    setLoading(true)
    await codeAnfordern(otpEmail)
    setLoading(false)
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault()
    if (gesperrt) return
    setError('')
    setInfo('')
    setLoading(true)
    try {
      const resp = await fetch(`https://api.responda.systems/api/collections/users/auth-with-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpId, password: mfaCode, mfaId }),
      })
      if (!resp.ok) {
        let message = ''
        try { message = (await resp.json())?.message || '' } catch { /* keine Antwort */ }
        const f = codeFehler(resp.status, message)
        if (f.neuAnmelden) {
          setStep('login')
          setPassword('')
          setMfaCode('')
          setOtpId('')
        }
        if (f.sperreBis) setSperreBis(f.sperreBis)
        setError(f.text)
        setLoading(false)
        return
      }
      const data = await resp.json()
      pb.authStore.save(data.token, data.record)
      await finishLogin(data.record)
    } catch {
      setError('Keine Verbindung zum Server. Bitte versuche es erneut.')
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
          border: 1.5px solid rgba(var(--lbf-rot-rgb),0.15);
          background: var(--lbf-card);
          color: var(--lbf-text);
          font-size: 15px;
          font-family: inherit;
          box-sizing: border-box;
          transition: border-color 0.2s;
          -webkit-appearance: none;
        }
        .l-input:focus { outline: none; border-color: var(--lbf-akzent); }
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
      <div style={{ width: '100%', maxWidth: 360, background: 'var(--lbf-card)', borderRadius: 16, boxShadow: '0 2px 16px rgba(96,8,18,0.07)', padding: '28px 24px 24px', border: '0.5px solid var(--lbf-border-light)' }}>

        {step === 'login' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--lbf-akzent)', marginBottom: 6 }}>Anmeldung</div>
              <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: 'var(--lbf-text)', lineHeight: 1.2 }}>Willkommen zurück</div>
              <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', marginTop: 4 }}>Melde dich an um fortzufahren</div>
            </div>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--lbf-akzent)', marginBottom: 6 }}>E-Mail oder Benutzername</label>
                <input className="l-input" type="text" autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)}
                  placeholder="email@beispiel.de oder benutzername" required disabled={loading} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--lbf-akzent)', marginBottom: 6 }}>Passwort</label>
                <input className="l-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required disabled={loading} />
              </div>

              {!error && disabledHint && (
                <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--lbf-fehler-text-2)', fontStyle: 'italic' }}>
                  Dein Zugang wurde deaktiviert oder ist abgelaufen. Bitte Admin kontaktieren.
                </div>
              )}
              {!error && betaHint && (
                <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--lbf-fehler-text-2)', fontStyle: 'italic' }}>
                  Diese Beta-Umgebung ist nur für Supervisoren zugänglich.
                </div>
              )}
              {error && (
                <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--lbf-fehler-text-2)', fontStyle: 'italic' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="l-btn"
                style={{ marginTop: 4, padding: '14px', borderRadius: 10, background: 'var(--lbf-akzent-grund)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, letterSpacing: '0.02em' }}>
                {loading ? 'Anmeldung läuft…' : 'Anmelden'}
              </button>
            </form>

            <button onClick={() => { setStep('reset'); setResetEmail(identifier.includes('@') ? identifier : '') }}
              style={{ display: 'block', margin: '18px auto 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)', fontFamily: 'inherit' }}>
              Passwort vergessen?
            </button>
          </>
        )}

        {step === 'mfa' && (
          <>
            <button onClick={() => { setStep('login'); setError(''); setInfo(''); setMfaCode('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lbf-akzent)', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, marginBottom: 20, padding: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              Zurück
            </button>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--lbf-akzent)', marginBottom: 6 }}>Sicherheit</div>
              <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: 'var(--lbf-text)', lineHeight: 1.2 }}>Code eingeben</div>
              <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', marginTop: 4 }}>
                {otpId
                  ? <>Wir haben einen Code an <span style={{ fontWeight: 700 }}>{maskiereEmail(otpEmail)}</span> gesendet</>
                  : 'Den Code gibt es per E-Mail. An welche Adresse gehört dein Zugang?'}
              </div>
            </div>

            {!otpId ? (
              <form onSubmit={adresseSenden} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--lbf-akzent)', marginBottom: 6 }}>E-Mail</label>
                  <input className="l-input" type="email" autoComplete="email" value={otpEmail} onChange={e => setOtpEmail(e.target.value)}
                    placeholder="deine@email.de" required disabled={loading} autoFocus />
                </div>
                {error && <Meldung art="fehler">{error}</Meldung>}
                <button type="submit" disabled={loading || gesperrt} className="l-btn" style={knopf(loading || gesperrt)}>
                  {gesperrt ? `Gesperrt — noch ${restZeit(sperreBis, jetzt)}` : loading ? 'Wird gesendet…' : 'Code senden'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleMfa} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--lbf-akzent)', marginBottom: 6 }}>Code</label>
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
                  <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 6, lineHeight: 1.45 }}>
                    Es gilt nur der Code aus der neuesten E-Mail, und nur wenige Minuten.
                  </div>
                </div>

                {info && <Meldung art="ok">{info}</Meldung>}
                {error && <Meldung art="fehler">{error}</Meldung>}

                <button type="submit" disabled={loading || mfaCode.length < 4 || gesperrt} className="l-btn" style={knopf(loading || mfaCode.length < 4 || gesperrt)}>
                  {gesperrt ? `Gesperrt — noch ${restZeit(sperreBis, jetzt)}` : loading ? 'Wird geprüft…' : 'Bestätigen'}
                </button>
                <button type="button" onClick={neuerCode} disabled={loading || gesperrt || jetzt < neuAb}
                  style={{ background: 'none', border: 'none', padding: '4px 0', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--lbf-akzent)', cursor: (loading || gesperrt || jetzt < neuAb) ? 'default' : 'pointer', opacity: (loading || gesperrt || jetzt < neuAb) ? 0.5 : 1 }}>
                  {gesperrt ? `Neuer Code in ${restZeit(sperreBis, jetzt)}` : jetzt < neuAb ? `Neuen Code senden (in ${Math.ceil((neuAb - jetzt) / 1000)} s)` : 'Neuen Code senden'}
                </button>
              </form>
            )}
          </>
        )}

        {step === 'reset' && (
          <>
            <button onClick={() => { setStep('login'); setResetMsg('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lbf-akzent)', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, marginBottom: 20, padding: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              Zurück
            </button>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--lbf-akzent)', marginBottom: 6 }}>Passwort</div>
              <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: 'var(--lbf-text)', lineHeight: 1.2 }}>{neuesPasswort ? 'Festlegen' : 'Zurücksetzen'}</div>
              <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', marginTop: 4 }}>{neuesPasswort ? 'Wir senden dir einen Link, mit dem du dein Passwort festlegst' : 'Wir senden dir einen Reset-Link per E-Mail'}</div>
            </div>

            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--lbf-akzent)', marginBottom: 6 }}>E-Mail</label>
                <input className="l-input" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  placeholder="deine@email.de" required disabled={resetLoading} />
              </div>

              {resetMsg && (
                <div style={{ padding: '10px 14px', background: resetSuccess ? 'rgba(22,163,74,0.06)' : 'rgba(192,57,43,0.06)', border: `1px solid ${resetSuccess ? 'rgba(22,163,74,0.2)' : 'rgba(192,57,43,0.2)'}`, borderRadius: 8, fontSize: 13, fontStyle: 'italic', color: resetSuccess ? 'var(--lbf-ok-text-2)' : 'var(--lbf-fehler-text-2)' }}>
                  {resetMsg}
                </div>
              )}

              <button type="submit" disabled={resetLoading || resetSuccess} className="l-btn"
                style={{ marginTop: 4, padding: '14px', borderRadius: 10, background: 'var(--lbf-akzent-grund)', border: 'none', cursor: resetLoading ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'inherit', opacity: (resetLoading || resetSuccess) ? 0.7 : 1, letterSpacing: '0.02em' }}>
                {resetLoading ? 'Wird gesendet…' : neuesPasswort ? 'Link senden' : 'Reset-Link senden'}
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

// Rückmeldung in der Anmeldung (Fehler rot, Erfolg grün)
function Meldung({ art, children }: { art: 'ok' | 'fehler'; children: React.ReactNode }) {
  const ok = art === 'ok'
  return (
    <div role={ok ? 'status' : 'alert'} style={{ padding: '10px 14px', background: ok ? 'rgba(22,163,74,0.06)' : 'rgba(192,57,43,0.06)', border: `1px solid ${ok ? 'rgba(22,163,74,0.2)' : 'rgba(192,57,43,0.2)'}`, borderRadius: 8, fontSize: 13, fontStyle: 'italic', lineHeight: 1.45, color: ok ? 'var(--lbf-ok-text-2)' : 'var(--lbf-fehler-text-2)' }}>
      {children}
    </div>
  )
}

function knopf(aus: boolean): React.CSSProperties {
  return { marginTop: 4, padding: '14px', borderRadius: 10, background: 'var(--lbf-akzent-grund)', border: 'none', cursor: aus ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'inherit', opacity: aus ? 0.7 : 1, letterSpacing: '0.02em' }
}
