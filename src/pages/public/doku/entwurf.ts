// Der Entwurf im Gerät: damit ein Neuladen kein Protokoll kostet.
//
// Die Maske hielt alles im Arbeitsspeicher. Ein versehentliches Neuladen,
// ein Absturz, ein Telefon, das die Seite im Hintergrund wegräumt — und eine
// halbe Stunde Dokumentation war weg. Im Fahrzeug passiert genau das.
//
// Geschrieben wird deshalb nach jeder Änderung in den Speicher des Geräts.
// Das ist kein Speichern im Sinne des Protokolls: der Entwurf liegt allein
// auf diesem Gerät, niemand sonst sieht ihn, und er ersetzt das Absenden
// nicht. Er fängt nur den Verlust ab.
//
// ZU DEN DATEN: Darin stehen Patientendaten. Sie bleiben liegen, bis der
// Entwurf abgesendet oder verworfen wird — auf einem geteilten Tablet also
// möglicherweise für den Nächsten sichtbar. Deshalb drei Dinge: der Entwurf
// sagt beim Öffnen, dass er da ist, er lässt sich mit einem Griff verwerfen,
// und nach einem Tag verfällt er von selbst.

export type Entwurf = {
  /** Wann zuletzt geschrieben wurde — ISO. */
  stand: string
  werte: Record<string, unknown>
}

/** Nach dieser Zeit gilt ein Entwurf als vergessen und wird nicht mehr angeboten. */
export const ENTWURF_FRIST_MS = 24 * 60 * 60 * 1000

/** Ein Speicher, wie der Browser ihn stellt — nur das, was hier gebraucht wird. */
export type Speicher = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function entwurfSchluessel(orgCode: string): string {
  return `doku_entwurf_${orgCode}`
}

/** Ob überhaupt etwas drinsteht, das sich zu behalten lohnt. */
export function lohntSichzuBehalten(werte: Record<string, unknown>): boolean {
  return Object.values(werte).some((w) => {
    if (w === undefined || w === null || w === '' || w === false) return false
    if (Array.isArray(w)) return w.length > 0
    if (typeof w === 'object') return Object.keys(w as object).length > 0
    return true
  })
}

/**
 * Den Entwurf schreiben.
 *
 * Gibt zurück, ob es geklappt hat: im privaten Fenster, bei vollem Speicher
 * oder abgeschalteten Site-Daten wirft der Browser — und dann soll die Maske
 * es sagen können, statt stillschweigend nichts zu sichern.
 */
export function entwurfSchreiben(
  speicher: Speicher, orgCode: string, werte: Record<string, unknown>, jetzt = new Date(),
): boolean {
  try {
    if (!lohntSichzuBehalten(werte)) {
      speicher.removeItem(entwurfSchluessel(orgCode))
      return true
    }
    const e: Entwurf = { stand: jetzt.toISOString(), werte }
    speicher.setItem(entwurfSchluessel(orgCode), JSON.stringify(e))
    return true
  } catch {
    return false
  }
}

/** Den Entwurf lesen — null, wenn keiner da, kaputt oder zu alt. */
export function entwurfLesen(speicher: Speicher, orgCode: string, jetzt = new Date()): Entwurf | null {
  let roh: string | null = null
  try {
    roh = speicher.getItem(entwurfSchluessel(orgCode))
  } catch {
    return null
  }
  if (!roh) return null
  let e: unknown
  try {
    e = JSON.parse(roh)
  } catch {
    return null
  }
  if (!e || typeof e !== 'object') return null
  const stand = (e as Entwurf).stand
  const werte = (e as Entwurf).werte
  if (typeof stand !== 'string' || !werte || typeof werte !== 'object') return null
  const alter = jetzt.getTime() - new Date(stand).getTime()
  if (!Number.isFinite(alter) || alter < 0 || alter > ENTWURF_FRIST_MS) return null
  if (!lohntSichzuBehalten(werte)) return null
  return { stand, werte }
}

export function entwurfVerwerfen(speicher: Speicher, orgCode: string): void {
  try {
    speicher.removeItem(entwurfSchluessel(orgCode))
  } catch {
    // Lässt sich nichts löschen, ist auch nichts gespeichert worden.
  }
}

/** Wie alt der Entwurf ist, in Worten. */
export function standText(stand: string, jetzt = new Date()): string {
  const alter = jetzt.getTime() - new Date(stand).getTime()
  if (!Number.isFinite(alter)) return ''
  const minuten = Math.floor(alter / 60000)
  if (minuten < 1) return 'gerade eben'
  if (minuten < 60) return `vor ${minuten} Minute${minuten === 1 ? '' : 'n'}`
  const stunden = Math.floor(minuten / 60)
  return `vor ${stunden} Stunde${stunden === 1 ? '' : 'n'}`
}
