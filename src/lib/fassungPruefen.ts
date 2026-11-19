// Neue Version von Responda: Hinweis mit Bestätigung (Owner, 19.11.2026).
//
// Bisher übernahm eine neue Fassung im Hintergrund (Service Worker mit skipWaiting), die geöffnete
// App lief aber mit der alten weiter, bis sie ganz geschlossen und neu gestartet wurde; als App vom
// Homebildschirm oft erst beim zweiten Start. Jetzt wartet die neue Fassung, bis man sie bestätigt
// (vite.config.ts: registerType 'prompt'). Die App fragt regelmäßig nach einer neuen Fassung,
// auch wenn sie aus dem Hintergrund zurückkommt, und zeigt dann den Hinweis
// (src/components/NeueFassungHinweis.tsx). „Aktualisieren“ lädt sie sofort; wird die App ganz
// geschlossen, gilt sie beim nächsten Start ohnehin.
//
// Hier steht nur die Rechnung (mit Prüffällen) und ein kleiner Speicher für den Hinweis; die
// Anmeldung beim Browser steht in src/lib/swAnmelden.ts.

/** Während die App offen ist, so oft nach einer neuen Fassung fragen (ms). */
export const PRUEFEN_TAKT_MS = 30 * 60 * 1000
/** Beim Zurückkommen aus dem Hintergrund höchstens so oft fragen (ms). */
export const PRUEFEN_FRUEHESTENS_MS = 5 * 60 * 1000
/** „Später“: so lange den Hinweis nicht wieder zeigen (ms). */
export const SPAETER_MS = 60 * 60 * 1000

/** Jetzt beim Server nach einer neuen Fassung fragen? Nur sichtbar, mit Netz und nicht zu oft. */
export function sollPruefen(o: { jetzt: number; zuletzt: number | null; online: boolean; sichtbar: boolean }): boolean {
  if (!o.online || !o.sichtbar) return false
  if (o.zuletzt === null) return true
  return o.jetzt - o.zuletzt >= PRUEFEN_FRUEHESTENS_MS
}

/**
 * Einsatzführung (EKS) eines laufenden Einsatzes: dort kein Hinweis, er läge über Knöpfen, die im
 * Einsatz gebraucht werden. Die neue Fassung gilt dort beim nächsten Start der App.
 */
export function istEinsatzfuehrung(pfad: string): boolean {
  return /^\/eks\/[^/]+/.test(pfad)
}

/** Den Hinweis jetzt zeigen? */
export function hinweisZeigen(o: { neu: boolean; pfad: string; spaeterBis: number | null; jetzt: number }): boolean {
  if (!o.neu) return false
  if (istEinsatzfuehrung(o.pfad)) return false
  return o.spaeterBis === null || o.jetzt >= o.spaeterBis
}

// ── Speicher für den Hinweis (ein Zustand für die ganze App) ──

export interface FassungStand {
  /** Eine neue Fassung wartet auf Bestätigung. */
  neu: boolean
  /** „Später“ gewählt: bis dahin kein Hinweis (ms seit 1970). */
  spaeterBis: number | null
  /** „Aktualisieren“ läuft. */
  laedt: boolean
}

let stand: FassungStand = { neu: false, spaeterBis: null, laedt: false }
const hoerer = new Set<() => void>()
let aktualisierenFn: (() => Promise<void>) | null = null

export function fassungStand(): FassungStand {
  return stand
}

export function fassungAbonnieren(f: () => void): () => void {
  hoerer.add(f)
  return () => { hoerer.delete(f) }
}

function setzen(teil: Partial<FassungStand>): void {
  stand = { ...stand, ...teil }
  for (const f of [...hoerer]) { try { f() } catch { /* einzelner Hörer egal */ } }
}

/** Vom Service Worker: eine neue Fassung wartet. */
export function neueFassungMelden(aktualisieren: () => Promise<void>): void {
  aktualisierenFn = aktualisieren
  setzen({ neu: true })
}

/** „Später“: Hinweis für SPAETER_MS ausblenden. */
export function spaeter(jetzt = Date.now()): void {
  setzen({ spaeterBis: jetzt + SPAETER_MS })
}

/** Nach einer erneuten Prüfung: den Hinweis wieder anstoßen (Hörer rechnen neu). */
export function fassungAnstossen(): void {
  setzen({})
}

/** „Aktualisieren“: neue Fassung übernehmen und neu laden. */
export async function aktualisieren(): Promise<void> {
  if (stand.laedt) return
  setzen({ laedt: true })
  try {
    if (aktualisierenFn) await aktualisierenFn()
    else window.location.reload()
  } catch {
    window.location.reload()
  }
}

/** Nur für Prüffälle: alles zurücksetzen. */
export function fassungZuruecksetzen(): void {
  stand = { neu: false, spaeterBis: null, laedt: false }
  aktualisierenFn = null
  hoerer.clear()
}
