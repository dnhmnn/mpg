import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Im nativen Bau KEIN Service Worker.
//
// Die PWA-Registrierung ist im Browser richtig, in der Capacitor-WebView aber
// schädlich: dort liegen die Dateien ohnehin im Programmpaket, und nach einem
// App-Update kann der Zwischenspeicher des Service Workers den alten Stand
// ausliefern — die App zeigt dann trotz neuer Fassung das Alte.
//
// Nebenbei räumt das den api-cache mit, der Serverantworten 24 Stunden lang
// aufbewahrt. Auf einem Gerät mit Patientendaten ist das nichts, was man
// ungefragt liegen lassen will.
declare global {
  interface Window { Capacitor?: { isNativePlatform?: () => boolean } }
}
if (window.Capacitor?.isNativePlatform?.()) {
  navigator.serviceWorker?.getRegistrations?.()
    .then(rs => rs.forEach(r => r.unregister()))
    .catch(() => {})
  globalThis.caches?.keys?.()
    .then(ks => ks.forEach(k => globalThis.caches.delete(k)))
    .catch(() => {})
}

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
    console.error('React Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          fontFamily: 'Inter, sans-serif',
          maxWidth: '600px',
          margin: '100px auto',
          background: '#fee2e2',
          borderRadius: '12px',
          border: '2px solid #ef4444'
        }}>
          <h1 style={{ color: '#ef4444', fontSize: '24px', marginBottom: '16px' }}>
            ⚠️ Fehler beim Laden der App
          </h1>
          <p style={{ marginBottom: '16px', color: '#991b1b' }}>
            <strong>Error:</strong> {this.state.error?.message}
          </p>
          <pre style={{
            background: '#fff',
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
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
}
