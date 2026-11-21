import { useEffect, useState } from 'react'
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { zielMitSitzung, zielNachAnmeldung, type AnmeldeKonto } from '../lib/anmeldung'
import { NEU_SEKUNDEN, anforderFehler, codeFehler, istEmail, maskiereEmail, restZeit } from '../lib/zweiFaktor'
import { anmeldeKennung } from '../lib/benutzername'
import { Feld } from './benutzer/bausteine'
import { ZugangRahmen, Zeichen } from './zugang/Rahmen'

/**
 * Anmeldung. Mit einer gültigen, gespeicherten Sitzung geht der einfache Aufruf von /login gleich weiter
 * (App vom Homebildschirm, Lesezeichen). Mit Hinweis (?reason=…) oder Link aus der Willkommens-E-Mail
 * (?email=…, ?passwort=neu) bleibt die Maske wie bisher.
 */
export default function Login() {
  const [searchParams] = useSearchParams()
  const mitAnlass = ['reason', 'email', 'passwort'].some((k) => searchParams.has(k))
  const ziel = mitAnlass ? null : zielMitSitzung(pb.authStore.isValid, pb.authStore.model as AnmeldeKonto | null, Date.now())
  return ziel ? <Navigate to={ziel} replace /> : <LoginMaske />
}

function LoginMaske() {
  const navigate = useNavigate()
  // Den Hub schon holen: nach der Anmeldung kein Aufblitzen zwischen Rot und Hub
  useEffect(() => { void import('./Hub').catch(() => {}) }, [])
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
    sessionStorage.setItem('justLoggedIn', '1')
    navigate(zielNachAnmeldung(record), { replace: true })
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
      let authData
      try {
        authData = await pb.collection('users').authWithPassword(id, password)
      } catch (err: any) {
        // Benutzernamen speichert Responda klein; ältere Server (aus PocketBase 0.22) können auch
        // „MaxMuster“ kennen, und PocketBase sucht genau. Darum erst wie getippt, dann klein.
        const klein = anmeldeKennung(id)
        if (err?.status !== 400 || klein === id) throw err
        authData = await pb.collection('users').authWithPassword(klein, password)
      }
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
      // Gesperrt nach falschen Passwörtern (pb_hooks/formular.pb.js): der Server nennt die Wartezeit
      else if (err?.status === 429) setError(typeof err?.response?.message === 'string' && err.response.message.startsWith('Zu viele') ? err.response.message : 'Zu viele Anmeldeversuche. Bitte warte kurz.')
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

  // Kopf je Schritt: zurück zur Startseite oder zum vorigen Schritt
  const zurueck = step === 'login'
    ? () => navigate('/')
    : step === 'mfa'
      ? () => { setStep('login'); setError(''); setInfo(''); setMfaCode('') }
      : () => { setStep('login'); setResetMsg('') }
  const gruss = step === 'login' ? <>Willkommen <em>zurück</em></>
    : step === 'mfa' ? <>Code <em>eingeben</em></>
    : neuesPasswort ? <>Passwort <em>festlegen</em></> : <>Passwort <em>zurücksetzen</em></>
  const zeile = step === 'login' ? 'Melde dich an, um fortzufahren.'
    : step === 'mfa'
      ? (otpId ? <>Wir haben einen Code an <b>{maskiereEmail(otpEmail)}</b> gesendet.</> : 'Den Code gibt es per E-Mail. An welche Adresse gehört dein Zugang?')
      : neuesPasswort ? 'Wir senden dir einen Link, mit dem du dein Passwort festlegst.' : 'Wir senden dir einen Link per E-Mail.'

  return (
    <ZugangRahmen
      zeichen={<Zeichen klein />}
      titel={gruss}
      zeile={zeile}
      zurueck={zurueck}
      zurueckLabel={step === 'login' ? 'Zur Startseite' : 'Zurück zur Anmeldung'}
    >
      <div className="zg-karte">
        {step === 'login' && (
          <form onSubmit={handleLogin}>
            <Feld label="E-Mail oder Benutzername" erst>
              <input className="bv-eingabe" type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                value={identifier} onChange={e => setIdentifier(e.target.value)}
                placeholder="name@beispiel.de" required disabled={loading} />
            </Feld>
            <Feld label="Passwort">
              <input className="bv-eingabe" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required disabled={loading} />
            </Feld>
            {!error && disabledHint && <Meldung art="fehler">Dein Zugang wurde deaktiviert oder ist abgelaufen. Bitte Admin kontaktieren.</Meldung>}
            {!error && betaHint && <Meldung art="fehler">Diese Beta-Umgebung ist nur für Supervisoren zugänglich.</Meldung>}
            {error && <Meldung art="fehler">{error}</Meldung>}
            <div className="zg-abstand">
              <button type="submit" disabled={loading} className="zg-haupt">{loading ? 'Anmeldung läuft …' : 'Anmelden'}</button>
            </div>
            <button type="button" className="zg-link" onClick={() => { setStep('reset'); setResetEmail(identifier.includes('@') ? identifier : '') }}>
              Passwort vergessen?
            </button>
          </form>
        )}

        {step === 'mfa' && (!otpId ? (
          <form onSubmit={adresseSenden}>
            <Feld label="E-Mail" erst>
              <input className="bv-eingabe" type="email" autoComplete="email" value={otpEmail} onChange={e => setOtpEmail(e.target.value)}
                placeholder="deine@email.de" required disabled={loading} autoFocus />
            </Feld>
            {error && <Meldung art="fehler">{error}</Meldung>}
            <div className="zg-abstand">
              <button type="submit" disabled={loading || gesperrt} className="zg-haupt">
                {gesperrt ? `Gesperrt — noch ${restZeit(sperreBis, jetzt)}` : loading ? 'Wird gesendet …' : 'Code senden'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleMfa}>
            <Feld label="Code" erst hinweis="Es gilt nur der Code aus der neuesten E-Mail, und nur wenige Minuten.">
              <input
                className="bv-eingabe zg-code"
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
              />
            </Feld>
            {info && <Meldung art="ok">{info}</Meldung>}
            {error && <Meldung art="fehler">{error}</Meldung>}
            <div className="zg-abstand">
              <button type="submit" disabled={loading || mfaCode.length < 4 || gesperrt} className="zg-haupt">
                {gesperrt ? `Gesperrt — noch ${restZeit(sperreBis, jetzt)}` : loading ? 'Wird geprüft …' : 'Bestätigen'}
              </button>
            </div>
            <button type="button" className="zg-link" onClick={neuerCode} disabled={loading || gesperrt || jetzt < neuAb}>
              {gesperrt ? `Neuer Code in ${restZeit(sperreBis, jetzt)}` : jetzt < neuAb ? `Neuen Code senden (in ${Math.ceil((neuAb - jetzt) / 1000)} s)` : 'Neuen Code senden'}
            </button>
          </form>
        ))}

        {step === 'reset' && (
          <form onSubmit={handleReset}>
            <Feld label="E-Mail" erst>
              <input className="bv-eingabe" type="email" autoComplete="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                placeholder="deine@email.de" required disabled={resetLoading} />
            </Feld>
            {resetMsg && <Meldung art={resetSuccess ? 'ok' : 'fehler'}>{resetMsg}</Meldung>}
            <div className="zg-abstand">
              <button type="submit" disabled={resetLoading || resetSuccess} className="zg-haupt">
                {resetLoading ? 'Wird gesendet …' : neuesPasswort ? 'Link senden' : 'Reset-Link senden'}
              </button>
            </div>
          </form>
        )}

      </div>
    </ZugangRahmen>
  )
}

// Rückmeldung in der Anmeldung (Fehler rot, Erfolg grün)
function Meldung({ art, children }: { art: 'ok' | 'fehler'; children: React.ReactNode }) {
  return <div role={art === 'ok' ? 'status' : 'alert'} className={`zg-meldung ${art}`}>{children}</div>
}
