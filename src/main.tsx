import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { einmalNeuLaden, istLadefehler, neueFassungAbfangen, wirdNeuGeladen } from './lib/neueFassung'
import { pb } from './lib/pocketbase'
import { entwuerfeAufraeumen, fensterEinrichten, tresorBereit, tresorOeffnen } from './lib/tresor'
import { ohneAnmeldungLeeren, veralteteLoeschen, wechselBeobachten } from './lib/zwischenspeicher'

// Nach einer Veröffentlichung fehlen der alten Fassung im Gerät Teile — dann einmal neu laden
neueFassungAbfangen()

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Teil der App fehlt (alte Fassung nach Veröffentlichung): einmal neu laden statt Fehler
    if (istLadefehler(error) && einmalNeuLaden()) { this.forceUpdate(); return }
    console.error('React Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError && wirdNeuGeladen()) {
      return (
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--warm-bg)' }}>
          <div style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--warm-gray)' }}>Responda wird aktualisiert …</div>
        </div>
      )
    }
    if (this.state.hasError && istLadefehler(this.state.error)) {
      // Neuladen gerade schon versucht — ruhig erklären statt Fehlerseite
      return (
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--warm-bg)', padding: 24 }}>
          <div style={{ maxWidth: 360, background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', borderLeft: '3px solid var(--lbf-akzent)', padding: '20px 22px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--lbf-akzent)', marginBottom: 8 }}>Neue Fassung</div>
            <div style={{ fontSize: 15, color: 'var(--lbf-text)', lineHeight: 1.5, marginBottom: 16 }}>
              Responda wurde aktualisiert, ein Teil der App ließ sich aber noch nicht laden. Bitte lade die Seite neu — bei schwacher Verbindung kurz warten.
            </div>
            <button onClick={() => window.location.reload()}
              style={{ padding: '11px 18px', borderRadius: 10, border: 'none', background: 'var(--lbf-akzent-grund)', color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
              Seite neu laden
            </button>
          </div>
        </div>
      )
    }
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          fontFamily: 'Inter, sans-serif',
          maxWidth: '600px',
          margin: '100px auto',
          background: 'var(--lbf-fehler-grund-2)',
          borderRadius: '12px',
          border: '2px solid #ef4444'
        }}>
          <h1 style={{ color: '#ef4444', fontSize: '24px', marginBottom: '16px' }}>
            ⚠️ Fehler beim Laden der App
          </h1>
          <p style={{ marginBottom: '16px', color: 'var(--lbf-fehler-text)' }}>
            <strong>Error:</strong> {this.state.error?.message}
          </p>
          <pre style={{
            background: '#fff', // bleibt hell: Stacktrace-Schrift #1a1a1a ist hart, kein Token dafuer
            padding: '12px',
            borderRadius: '8px',
            overflow: 'auto',
            fontSize: '12px',
            color: '#1a1a1a'
          }}>
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '12px 24px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Seite neu laden
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

const root = document.getElementById('root')

if (!root) {
  document.body.innerHTML = `
    <div style="padding: 40px; font-family: Inter, sans-serif; text-align: center;">
      <h1 style="color: #ef4444;">❌ Root Element nicht gefunden!</h1>
      <p>Das div mit id="root" fehlt in index.html</p>
    </div>
  `
} else {
  // Erst den Tresor öffnen (Warteschlange und Entwürfe verschlüsselt auf dem Gerät, höchstens
  // 1,5 Sekunden), dann rendern: die Masken lesen ihren Entwurf schon beim Aufbau. Scheitert es,
  // arbeitet die App wie bisher mit localStorage weiter; nichts geht verloren.
  const zeigen = () => {
    try { fensterEinrichten() } catch { /* ohne Warnung und Hintergrundversand */ }
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    )
  }
  tresorOeffnen({ api: String(pb.baseURL || '') }).then(zeigen, zeigen)
  // Verfallene Entwürfe (älter als ein Tag) vom Gerät nehmen, sobald der Tresor offen ist (Review F5)
  void tresorBereit(30_000).then(() => { try { entwuerfeAufraeumen() } catch { /* beim nächsten Start */ } })
  // Wechselt die angemeldete Person (Abmelden, andere Person, Anmeldung abgelaufen): Antworten im
  // Zwischenspeicher des Service Workers löschen, damit die Nächste am Gerät nichts davon findet
  try {
    const kennung = () => { try { return String((pb.authStore.model as { id?: unknown } | null)?.id ?? '') } catch { return '' } }
    wechselBeobachten(kennung(), (f) => pb.authStore.onChange(() => f(kennung())))
    // Ohne gültige Anmeldung (abgemeldet, auf /login umgeleitet): leeren, kurz darauf noch einmal
    ohneAnmeldungLeeren(() => { try { return !!kennung() && pb.authStore.isValid } catch { return false } })
    // Antworten älter als 24 Stunden bei jedem Start löschen (Workbox täte es erst bei der nächsten Anfrage)
    void veralteteLoeschen()
  } catch { /* ohne */ }
}
