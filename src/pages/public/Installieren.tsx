import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'

// Installationsseite — „Link antippen, App ist auf dem Telefon".
//
// WARUM ES DIESE SEITE GIBT: Auf dem iPhone gibt es keinen Weg, eine App wie
// aus einem eigenen Laden zu laden. Alternative Marktplätze verlangen eine
// Bankbürgschaft über eine Million Euro, die Verteilung von der eigenen Seite
// zwei Jahre Mitgliedschaft und eine Million Installationen. Beides ist für
// Epic und Spotify gemacht.
//
// Was bleibt, ist die Web-App — und die kann fast alles, was eine
// Store-App kann. Der einzige Unterschied ist EIN Fingertipp, und den erklärt
// diese Seite, statt ihn dem Nutzer zu überlassen.
//
// Auf Android geht der Epic-Weg wirklich: die APK liegt auf dem eigenen
// Server und wird unmittelbar geladen.

// Adresse des Android-Pakets. Leer lassen, solange keines gebaut ist —
// ein Knopf, der ins Leere führt, ist schlimmer als kein Knopf.
const APK_URL = ''

type Geraet = 'ios' | 'android' | 'schreibtisch'

function geraetErkennen(): Geraet {
  const ua = navigator.userAgent || ''
  // iPadOS meldet sich seit Jahren als Mac — daran erkennt man es trotzdem.
  const istIpad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  if (/iPhone|iPod/.test(ua) || istIpad || /iPad/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'schreibtisch'
}

/** Auf iOS ist jeder Browser WebKit — „Zum Home-Bildschirm" hat aber nicht jeder. */
function istSafari(): boolean {
  const ua = navigator.userAgent || ''
  return !/CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(ua)
}

function istInstalliert(): boolean {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
    return (navigator as unknown as { standalone?: boolean }).standalone === true
  } catch { return false }
}

const AKZENT = '#600812'

export default function Installieren() {
  const geraet = useMemo(geraetErkennen, [])
  const installiert = useMemo(istInstalliert, [])
  const [qr, setQr] = useState('')
  const adresse = typeof window !== 'undefined' ? window.location.href : ''

  useEffect(() => {
    if (geraet !== 'schreibtisch' || !adresse) return
    QRCode.toDataURL(adresse, { width: 320, margin: 1, color: { dark: '#1a0e08', light: '#ffffff' } })
      .then(setQr).catch(() => setQr(''))
  }, [geraet, adresse])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-bg)', color: '#1a0e08' }}>
      <div style={{
        maxWidth: 560, margin: '0 auto',
        padding: '32px 20px 60px',
        paddingTop: 'max(32px, env(safe-area-inset-top))',
      }}>

        <div style={{ ...abschnitt }}>Auf dem Telefon einrichten</div>
        <h1 style={{
          fontSize: 30, fontWeight: 800, fontStyle: 'italic', color: AKZENT,
          margin: '4px 0 6px', lineHeight: 1.1,
        }}>
          Responda
        </h1>
        <p style={{ color: 'var(--warm-gray)', fontSize: 14, margin: '0 0 28px', fontStyle: 'italic' }}>
          Einsatzdokumentation, Lager, Ausbildung — auf dem Startbildschirm,
          offline nutzbar, ohne App Store.
        </p>

        {installiert ? (
          <Karte rand="#16a34a">
            <div style={{ ...abschnitt, color: '#16a34a' }}>Bereits eingerichtet</div>
            <p style={{ margin: '6px 0 0', fontSize: 15 }}>
              Du hast Responda schon auf dem Startbildschirm. Diese Seite
              brauchst du nicht mehr.
            </p>
          </Karte>
        ) : geraet === 'ios' ? (
          <IosAnleitung safari={istSafari()} />
        ) : geraet === 'android' ? (
          <AndroidAnleitung />
        ) : (
          <SchreibtischAnleitung qr={qr} adresse={adresse} />
        )}

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '0.5px solid rgba(96,8,18,0.12)' }}>
          <div style={abschnitt}>Warum nicht aus dem App Store</div>
          <p style={{ color: 'var(--warm-gray)', fontSize: 13, lineHeight: 1.6, margin: '6px 0 0' }}>
            Responda ist eine Anwendung für die eigene Organisation, kein
            Angebot für die Allgemeinheit. Der Weg über den Startbildschirm ist
            deshalb der richtige: sofort verfügbar, Änderungen sind ohne
            Wartezeit draußen, und es werden keine Daten an Apple oder Google
            übertragen.
          </p>
        </div>
      </div>
    </div>
  )
}

const abschnitt: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.14em', color: AKZENT,
}

function Karte({ children, rand = AKZENT }: { children: React.ReactNode; rand?: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, borderLeft: `3px solid ${rand}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '16px 18px', marginBottom: 14,
    }}>
      {children}
    </div>
  )
}

function Schritt({ nr, titel, children }: { nr: number; titel: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
      <div style={{
        flex: '0 0 auto', width: 30, height: 30, borderRadius: '50%',
        background: AKZENT, color: '#fde8d8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 15, fontStyle: 'italic',
      }}>
        {nr}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{titel}</div>
        {children && <div style={{ color: 'var(--warm-gray)', fontSize: 14, marginTop: 4 }}>{children}</div>}
      </div>
    </div>
  )
}

/** Das Teilen-Symbol von iOS, damit man nicht raten muss, was gemeint ist. */
function TeilenSymbol() {
  return (
    <svg width="17" height="21" viewBox="0 0 24 30" fill="none" stroke={AKZENT} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-4px', margin: '0 3px' }}
      aria-label="Teilen-Symbol">
      <path d="M12 2v18M12 2L7 7M12 2l5 5" />
      <path d="M5 13H3v14h18V13h-2" />
    </svg>
  )
}

function IosAnleitung({ safari }: { safari: boolean }) {
  return (
    <>
      {!safari && (
        <Karte rand="#d97706">
          <div style={{ ...abschnitt, color: '#d97706' }}>Bitte in Safari öffnen</div>
          <p style={{ margin: '6px 0 0', fontSize: 15 }}>
            Du bist gerade in einem anderen Browser. Zum Startbildschirm
            hinzufügen geht auf dem iPhone zuverlässig nur in Safari — diese
            Seite dort noch einmal aufrufen.
          </p>
        </Karte>
      )}

      <Karte>
        <div style={{ ...abschnitt, marginBottom: 16 }}>Zwei Schritte</div>

        <Schritt nr={1} titel="Unten auf das Teilen-Symbol tippen">
          Das Quadrat mit dem Pfeil nach oben <TeilenSymbol /> — in der
          Leiste am unteren Bildschirmrand.
        </Schritt>

        <Schritt nr={2} titel={'\u201EZum Home-Bildschirm\u201C wählen'}>
          In der Liste nach unten streichen. Danach auf „Hinzufügen" tippen.
        </Schritt>

        <div style={{
          borderTop: '0.5px solid rgba(96,8,18,0.08)', paddingTop: 12, marginTop: 2,
          color: 'var(--warm-gray)', fontSize: 13, fontStyle: 'italic',
        }}>
          Danach liegt Responda als Symbol auf dem Startbildschirm und startet
          im Vollbild — ohne Browserleiste.
        </div>
      </Karte>
    </>
  )
}

function AndroidAnleitung() {
  return (
    <>
      {APK_URL ? (
        <Karte>
          <div style={abschnitt}>Unmittelbar laden</div>
          <p style={{ margin: '6px 0 12px', fontSize: 15 }}>
            Auf Android lässt sich Responda als Paket unmittelbar installieren.
          </p>
          <a href={APK_URL} download
            style={{
              display: 'block', textAlign: 'center', background: AKZENT, color: '#fde8d8',
              textDecoration: 'none', borderRadius: 10, padding: '15px 0',
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
            Responda herunterladen
          </a>
          <p style={{ color: 'var(--warm-gray)', fontSize: 13, marginTop: 12, marginBottom: 0 }}>
            Beim ersten Mal fragt Android, ob dieser Browser Apps installieren
            darf. Das ist normal — die Erlaubnis gilt nur für ihn.
          </p>
        </Karte>
      ) : (
        <Karte>
          <div style={{ ...abschnitt, marginBottom: 16 }}>Zwei Schritte</div>
          <Schritt nr={1} titel="Auf die drei Punkte oben rechts tippen" />
          <Schritt nr={2} titel={'\u201EApp installieren\u201C oder \u201EZum Startbildschirm hinzufügen\u201C wählen'}>
            Je nach Browser heißt es etwas anders.
          </Schritt>
          <div style={{
            borderTop: '0.5px solid rgba(96,8,18,0.08)', paddingTop: 12,
            color: 'var(--warm-gray)', fontSize: 13, fontStyle: 'italic',
          }}>
            Danach liegt Responda als Symbol auf dem Startbildschirm und startet
            im Vollbild.
          </div>
        </Karte>
      )}
    </>
  )
}

function SchreibtischAnleitung({ qr, adresse }: { qr: string; adresse: string }) {
  return (
    <Karte>
      <div style={abschnitt}>Mit dem Telefon scannen</div>
      <p style={{ margin: '6px 0 16px', fontSize: 15 }}>
        Responda gehört aufs Telefon. Scanne den Code mit der Kamera —
        dann öffnet sich diese Seite dort, mit der passenden Anleitung.
      </p>
      {qr ? (
        <img src={qr} alt="QR-Code zu dieser Seite"
          style={{ display: 'block', width: 220, height: 220, margin: '0 auto', borderRadius: 8 }} />
      ) : (
        <div style={{ color: 'var(--warm-gray)', fontSize: 14, textAlign: 'center', padding: '30px 0' }}>
          Code wird erzeugt …
        </div>
      )}
      <div style={{
        marginTop: 16, textAlign: 'center', color: 'var(--warm-gray)',
        fontSize: 13, wordBreak: 'break-all', fontStyle: 'italic',
      }}>
        {adresse}
      </div>
    </Karte>
  )
}
