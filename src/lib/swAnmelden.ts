// Service Worker beim Browser anmelden und nach neuen Fassungen fragen (src/lib/fassungPruefen.ts).
//
// vite.config.ts baut den Service Worker mit registerType 'prompt': Eine neue Fassung wird
// installiert, wartet dann aber, bis jemand „Aktualisieren“ tippt. Dann schickt registerSW ihr
// SKIP_WAITING, sie übernimmt, und die Seite lädt neu. Kommt das nicht innerhalb von
// NEULADEN_SPAETESTENS_MS (etwa weil die wartende Fassung schon weg ist), lädt die Seite selbst neu.
import { registerSW } from 'virtual:pwa-register'
import { fassungAnstossen, neueFassungMelden, PRUEFEN_TAKT_MS, sollPruefen } from './fassungPruefen'

const NEULADEN_SPAETESTENS_MS = 6000

let angemeldet = false

export function swAnmelden(): void {
  if (angemeldet || typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  angemeldet = true
  let registrierung: ServiceWorkerRegistration | undefined
  let zuletzt: number | null = null

  const pruefen = () => {
    const r = registrierung
    if (!r) return
    const jetzt = Date.now()
    if (!sollPruefen({ jetzt, zuletzt, online: navigator.onLine !== false, sichtbar: document.visibilityState === 'visible' })) return
    zuletzt = jetzt
    // Ohne Netz oder bei einem Fehler des Servers einfach beim nächsten Mal
    r.update().catch(() => {}).finally(() => fassungAnstossen())
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      neueFassungMelden(async () => {
        window.setTimeout(() => window.location.reload(), NEULADEN_SPAETESTENS_MS)
        await updateSW(true)
      })
    },
    onRegisteredSW(_url, r) {
      registrierung = r
      zuletzt = Date.now()
      window.setInterval(pruefen, PRUEFEN_TAKT_MS)
    },
    onRegisterError() { /* ohne Service Worker läuft die App wie eine Webseite */ },
  })

  // Zurück aus dem Hintergrund (App vom Homebildschirm, anderer Tab) und wieder mit Netz
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pruefen() })
  window.addEventListener('online', pruefen)
}
