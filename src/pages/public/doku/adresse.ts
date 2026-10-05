// Adressen eingeben, wie das alte Formular es tat: Straße, PLZ, Ort.
//
// Der Bogen führt für "Transport von" und "Transportziel" je eine
// Schreiblinie. Eine Linie ist zum Drucken richtig und zum Tippen falsch —
// im Fahrzeug entsteht darauf "KH Harlaching" oder gar nichts.
//
// Erfasst wird deshalb in drei Feldern; gedruckt wird die Zeile, die daraus
// entsteht. Die Teile stehen zusätzlich im Protokoll, damit eine Adresse
// später wieder zu bearbeiten ist, ohne sie aus der Zeile zu raten.

import type { Werte } from './DokuFeld'

export type Adressteil = 'strasse' | 'plz' | 'ort'

export type Adresse = { strasse: string; plz: string; ort: string }

export const ADRESSFELDER = ['transport_von', 'transport_ziel'] as const

/** Der Schlüssel, unter dem ein Teil im Protokoll steht. */
export function teilSchluessel(feld: string, teil: Adressteil): string {
  return `${feld}_${teil}`
}

function text(werte: Werte, id: string): string {
  return typeof werte[id] === 'string' ? (werte[id] as string).trim() : ''
}

/** Aus den drei Teilen die Zeile des Bogens. */
export function adresseZeile(a: Adresse): string {
  const hinten = [a.plz, a.ort].filter(Boolean).join(' ')
  return [a.strasse, hinten].filter(Boolean).join(', ')
}

/**
 * Eine Zeile in ihre Teile zerlegen.
 *
 * Gedacht für das, was diese Maske selbst geschrieben hat, und für die
 * übliche Schreibweise "Straße 1, 80331 München". Was sich nicht zerlegen
 * lässt, bleibt als Ganzes in der Straße stehen — sichtbar und änderbar,
 * statt stillschweigend verloren.
 */
export function adresseZerlegen(zeile: string): Adresse {
  const t = zeile.trim()
  if (!t) return { strasse: '', plz: '', ort: '' }
  const teile = t.split(',').map((x) => x.trim()).filter(Boolean)
  const letzter = teile[teile.length - 1] ?? ''
  const m = /^(\d{4,5})\s+(.+)$/.exec(letzter)
  if (teile.length >= 2 && m) {
    return { strasse: teile.slice(0, -1).join(', '), plz: m[1], ort: m[2] }
  }
  if (teile.length === 1 && m) return { strasse: '', plz: m[1], ort: m[2] }
  return { strasse: t, plz: '', ort: '' }
}

/**
 * Die Adresse eines Feldes.
 *
 * Stehen die Teile im Protokoll, gelten sie. Sonst wird die Zeile zerlegt —
 * so lassen sich auch Protokolle weiterbearbeiten, die vor dieser Maske
 * entstanden sind.
 */
export function adresseLesen(werte: Werte, feld: string): Adresse {
  const teile: Adresse = {
    strasse: text(werte, teilSchluessel(feld, 'strasse')),
    plz: text(werte, teilSchluessel(feld, 'plz')),
    ort: text(werte, teilSchluessel(feld, 'ort')),
  }
  if (teile.strasse || teile.plz || teile.ort) return teile
  return adresseZerlegen(text(werte, feld))
}

/** Einen Teil setzen — und die Zeile des Bogens neu schreiben. */
export function adresseSetzen(werte: Werte, feld: string, teil: Adressteil, wert: string): Werte {
  const neu: Adresse = { ...adresseLesen(werte, feld), [teil]: wert }
  const aus: Werte = { ...werte }
  for (const t of ['strasse', 'plz', 'ort'] as Adressteil[]) {
    aus[teilSchluessel(feld, t)] = neu[t].trim()
  }
  aus[feld] = adresseZeile({
    strasse: neu.strasse.trim(), plz: neu.plz.trim(), ort: neu.ort.trim(),
  })
  return aus
}
