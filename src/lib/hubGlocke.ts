// Glocke im Hub: was sie zählt, was im Abzeichen steht, wie der Knopf heißt und wann das Blatt
// „Neuigkeiten“ von selbst aufgeht. Rein, ohne React und ohne Speicher; die Seite gibt die Werte
// hinein. Prüffälle: src/lib/__tests__/hubGlocke.test.ts.
//
// Was gilt:
// - Gezählt wird jede Zeile der Neuigkeiten (eine Zeile je Modul, nicht die Zahl darin) und eine
//   ungelesene Mitteilung der Organisation. Solange die Neuigkeiten noch laden, zählen sie 0.
// - Im Abzeichen steht nichts bei 0 und „9+“ über 9; der Name des Knopfs nennt die genaue Zahl.
// - Von selbst geht das Blatt nur für eine Mitteilung auf, und für jede Mitteilung nur einmal je
//   Benutzer (gemerkt für die laufende Sitzung des Browsers, Glocke.tsx). Neuigkeiten allein
//   öffnen es nie. Mit „Später“ zurückgestellt, steht sie nach dem nächsten Start der App wieder
//   da und geht dann noch einmal von selbst auf, bis jemand „Verstanden“ drückt.
// - Gemerkt wird erst, wenn das Blatt wirklich offen ist (GlockeBlatt), und von selbst geht es nur
//   auf, solange der Hub selbst zu sehen ist (amHub): nicht in „Apps anpassen“ und nicht, wenn
//   schon eine andere Seite lädt und der Hub nur noch verdeckt im Hintergrund steht.

/** Höchstens so viele gemerkte Mitteilungen (älteste fallen weg) */
export const GLOCKE_GEMERKT_MAX = 20
/** Schlüssel in sessionStorage: Mitteilungen, für die das Blatt schon von selbst aufging */
export const GLOCKE_AUTO_SCHLUESSEL = 'hub_mitteilung_auto'

const ganz = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)

/** Wie viel Neues die Glocke zählt: Zeilen der Neuigkeiten plus eine ungelesene Mitteilung. */
export function glockeAnzahl(neuigkeiten: readonly unknown[] | null | undefined, mitteilung: unknown): number {
  return (Array.isArray(neuigkeiten) ? neuigkeiten.length : 0) + (mitteilung ? 1 : 0)
}

/** Text im Abzeichen der Glocke: null bei nichts Neuem, über 9 „9+“. */
export function glockeAbzeichen(anzahl: number): string | null {
  const n = ganz(anzahl)
  if (!n) return null
  return n > 9 ? '9+' : String(n)
}

/** Name des Knopfs für Screenreader, mit der genauen Zahl. */
export function glockeLabel(anzahl: number): string {
  const n = ganz(anzahl)
  return n ? `Neuigkeiten, ${n} neu` : 'Neuigkeiten, nichts Neues'
}

/** Gemerkte Mitteilungen aus dem Speicher lesen; Unlesbares ergibt eine leere Liste. */
export function autoGezeigtLesen(roh: string | null | undefined): string[] {
  if (!roh) return []
  try {
    const wert: unknown = JSON.parse(roh)
    if (!Array.isArray(wert)) return []
    const ids = wert.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 80)
    return [...new Set(ids)].slice(-GLOCKE_GEMERKT_MAX)
  } catch {
    return []
  }
}

/** Eine Mitteilung als gezeigt merken; höchstens GLOCKE_GEMERKT_MAX, die neueste zuletzt. */
export function autoGezeigtMerken(liste: readonly string[], id: string): string[] {
  if (!id) return [...liste]
  return [...liste.filter((x) => x !== id), id].slice(-GLOCKE_GEMERKT_MAX)
}

/** Was gemerkt wird: Benutzer und Mitteilung (ein anderer Benutzer im selben Fenster bekommt sie auch). */
export function autoSchluessel(nutzerId: string | null | undefined, mitteilungId: string | null | undefined): string {
  return mitteilungId ? `${nutzerId || '-'}/${mitteilungId}` : ''
}

/**
 * Ob das Blatt jetzt von selbst aufgeht: nur mit einer Mitteilung, die diesem Benutzer noch nicht
 * von selbst gezeigt wurde, und nur, wenn nichts anderes im Weg ist (bereit: Begrüßung vorbei,
 * keine Einführung, kein „Neu in Responda“, kein Blatt offen, nicht „Apps anpassen“).
 */
export function mitteilungAutomatisch(p: {
  nutzerId: string | null | undefined; mitteilungId: string | null | undefined; bereit: boolean; schonGezeigt: readonly string[]
}): boolean {
  const k = autoSchluessel(p.nutzerId, p.mitteilungId)
  return !!k && p.bereit && !p.schonGezeigt.includes(k)
}

/**
 * Ist der Hub selbst die gezeigte Seite? Aus der Adresse des Fensters (pathname und search):
 * /hub, aber nicht „Apps anpassen“ (/hub?seite=apps). Wechselt man auf eine Seite, die noch lädt,
 * steht die neue Adresse schon da, während der Hub verdeckt noch eingehängt ist.
 */
export function amHub(pfad: string | null | undefined, suche: string | null | undefined): boolean {
  const p = String(pfad ?? '').replace(/\/+$/, '')
  if (p !== '/hub') return false
  try {
    return new URLSearchParams(String(suche ?? '')).get('seite') !== 'apps'
  } catch {
    return true
  }
}
