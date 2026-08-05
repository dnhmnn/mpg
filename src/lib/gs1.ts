// GS1-Auswertung für DataMatrix- und GS1-128-Codes auf Medizinprodukten.
//
// Ein solcher Code trägt Artikelnummer, Charge und Verfallsdatum in EINEM Symbol.
// Bisher wurde der ganze zusammengesetzte String als Barcode gespeichert — der
// trifft beim nächsten Los nie wieder, und Charge und MHD mußten abgetippt werden.
//
// Bewusst reine Funktionen ohne Abhängigkeiten, damit sie prüfbar sind
// (siehe gs1.selbsttest.ts).

/** ASCII 29 — so übersetzt zxing das FNC1-Trennzeichen im DataMatrix. */
export const GS = String.fromCharCode(29)

export interface Gs1Daten {
  gtin?: string      // 14-stellig, normalisiert
  lot?: string       // Chargen-/LOT-Nummer
  expiry?: string    // JJJJ-MM-TT
  produced?: string  // Herstelldatum, JJJJ-MM-TT
  serial?: string
}

// Anwendungskennzeichen mit fester Länge (Datenteil ohne das Kennzeichen selbst)
const FESTE_LAENGE: Record<string, number> = {
  '00': 18, '01': 14, '02': 14,
  '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6,
  '20': 2, '7003': 10,
}

// Kennzeichen mit variabler Länge — enden am Trennzeichen oder am Stringende
const VARIABEL = new Set(['10', '21', '22', '240', '241', '30', '37', '90', '91', '92', '93'])

/** GTIN auf 14 Stellen bringen. Ein EAN-13 und die GTIN-14 desselben Produkts
 *  unterscheiden sich nur durch die führende Null — ohne diese Normalisierung
 *  würde der Abgleich genau dann scheitern, wenn er gebraucht wird. */
export function normalizeGtin(code: string): string {
  const nur = (code || '').replace(/\D/g, '')
  if (!nur) return ''
  if (nur.length > 14) return nur.slice(-14)
  return nur.padStart(14, '0')
}

/** Zwei Codes bezeichnen dasselbe Produkt? (rein numerisch → über GTIN-14) */
export function sameCode(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const na = (a || '').replace(/\D/g, ''), nb = (b || '').replace(/\D/g, '')
  if (!na || !nb) return false
  // Nur numerische Codes sinnvoller Länge als GTIN behandeln
  if (na.length < 8 || nb.length < 8 || na.length > 14 || nb.length > 14) return false
  return normalizeGtin(na) === normalizeGtin(nb)
}

function jjmmtt(v: string): string | undefined {
  if (!/^\d{6}$/.test(v)) return undefined
  const jj = parseInt(v.slice(0, 2), 10)
  const mm = parseInt(v.slice(2, 4), 10)
  let tt = parseInt(v.slice(4, 6), 10)
  if (mm < 1 || mm > 12) return undefined
  // GS1: Jahrhundert-Fenster; 00-49 → 20xx, 50-99 → 19xx
  const jahr = jj <= 49 ? 2000 + jj : 1900 + jj
  // TT = 00 bedeutet "Ende des Monats"
  if (tt === 0) tt = new Date(jahr, mm, 0).getDate()
  if (tt < 1 || tt > 31) return undefined
  return `${jahr}-${String(mm).padStart(2, '0')}-${String(tt).padStart(2, '0')}`
}

/**
 * Wertet einen gescannten String als GS1-Code aus.
 * Gibt null zurück, wenn es kein GS1-Code ist (dann greift der bisherige Weg).
 */
export function parseGs1(raw: string): Gs1Daten | null {
  if (!raw) return null
  let s = raw

  // Symbologie-Kennung abschneiden (]d2 = DataMatrix GS1, ]C1 = GS1-128, ]e0 = GS1 DataBar)
  const sym = s.match(/^\](?:d2|C1|e0|Q3)/)
  if (sym) s = s.slice(sym[0].length)
  // Führendes Trennzeichen ignorieren
  while (s.startsWith(GS)) s = s.slice(1)

  // Ein reiner EAN/UPC ist kein GS1-Element-String
  if (/^\d{8,14}$/.test(s)) return null

  const out: Gs1Daten = {}
  let i = 0
  let gefunden = 0
  let sicherheit = 0

  while (i < s.length && sicherheit++ < 50) {
    if (s[i] === GS) { i++; continue }

    // Kennzeichen ermitteln: 2, dann 3, dann 4 Stellen probieren
    let ai = ''
    for (const len of [2, 3, 4]) {
      const kand = s.slice(i, i + len)
      if (kand.length < len) break
      if (FESTE_LAENGE[kand] !== undefined || VARIABEL.has(kand)) { ai = kand; break }
    }
    if (!ai) break                       // unbekanntes Kennzeichen → abbrechen

    i += ai.length
    let wert: string

    if (FESTE_LAENGE[ai] !== undefined) {
      wert = s.slice(i, i + FESTE_LAENGE[ai])
      if (wert.length < FESTE_LAENGE[ai]) break
      i += FESTE_LAENGE[ai]
    } else {
      const ende = s.indexOf(GS, i)
      wert = ende === -1 ? s.slice(i) : s.slice(i, ende)
      i = ende === -1 ? s.length : ende + 1
    }

    if (!wert) continue
    gefunden++

    switch (ai) {
      case '01':
      case '02': out.gtin = normalizeGtin(wert); break
      case '10': out.lot = wert; break
      case '21': out.serial = wert; break
      case '17': { const d = jjmmtt(wert); if (d) out.expiry = d; break }
      case '15': { const d = jjmmtt(wert); if (d && !out.expiry) out.expiry = d; break }
      case '11': { const d = jjmmtt(wert); if (d) out.produced = d; break }
      default: break                     // andere Kennzeichen überspringen wir bewusst
    }
  }

  if (!gefunden || (!out.gtin && !out.lot && !out.expiry)) return null
  return out
}

/** Kurzfassung für die Anzeige, z.B. „GTIN 04012345678901 · LOT 22H041 · MHD 31.03.2027" */
export function beschreibeGs1(d: Gs1Daten): string {
  const t: string[] = []
  if (d.gtin) t.push(`GTIN ${d.gtin}`)
  if (d.lot) t.push(`LOT ${d.lot}`)
  if (d.expiry) t.push(`MHD ${new Date(d.expiry).toLocaleDateString('de-DE')}`)
  return t.join(' · ')
}
