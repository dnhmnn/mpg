// Export eines Protokolls in den DIVI-Austauschdatensatz (NAEP).
//
// Erzeugt das kompakte Format `naep-daten.xml`: nur Codes, keine Klartexte.
// Die Empfängerseite löst sie über dasselbe Metamodell auf, aus dem auch
// unser Katalog erzeugt ist — deshalb muss hier nichts übersetzt werden.
//
// ERFASSTE WERTE sind eine flache Abbildung von NAEP-Code auf Wert. Was ein
// Code bedeutet, steht im Katalog; der Export schlägt dort nach, ob ein Wert
// als Zahl, Zeit, Datum, Text, Auswahl oder Antwort zu schreiben ist. So
// bleibt die Erfassung einfach und muss die Formate nicht kennen.

import {
  NAEP_ABSCHNITTE,
  NAEP_METAMODELL,
  NAEP_VERSION,
  type NaepAbschnitt,
  type NaepEingabe,
} from '../katalog/naep'

/** Werte eines Protokolls, nach NAEP-Code abgelegt. */
export type NaepWerte = Record<string, unknown>

export type NaepProtokoll = {
  werte: NaepWerte
  /**
   * Abschnitt- oder Auswahl-Code → Code der leer-Angabe, etwa D08 → D0F
   * ("kein"). In der Norm ist das keine Option, sondern eine eigene Aussage:
   * untersucht und nichts gefunden.
   */
  leer?: Record<string, string>
  /** Abschnitte, die gar nicht bearbeitet wurden — etwas anderes als leer. */
  nichtBearbeitet?: string[]
  /** Freitext zu einer Sonstiges-Angabe, nach dem Code ihrer Auswahl. */
  sonstiges?: Record<string, { code: string; text: string }>
}

const NS = 'dt'

function schuetzen(wert: unknown): string {
  return String(wert ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function leerWert(wert: unknown): boolean {
  if (wert === undefined || wert === null || wert === '') return true
  return Array.isArray(wert) && wert.length === 0
}

/** Ein Feld als wrt-Element, mit dem Attribut, das zu seinem Typ passt. */
function feldZeile(eingabe: Extract<NaepEingabe, { art: 'feld' }>, wert: unknown): string {
  const f = schuetzen(eingabe.code)
  if (eingabe.typ === 'Zahl') {
    const einheit = eingabe.einheit ? ` e="${schuetzen(eingabe.einheit)}"` : ''
    return `<${NS}:wrt f="${f}" n="${schuetzen(wert)}"${einheit}/>`
  }
  if (eingabe.typ === 'Zeit') return `<${NS}:wrt f="${f}" z="${schuetzen(wert)}"/>`
  if (eingabe.typ === 'Datum') return `<${NS}:wrt f="${f}" d="${schuetzen(wert)}"/>`
  return `<${NS}:wrt f="${f}" t="${schuetzen(wert)}"/>`
}

/** Die gewählten Optionen einer Auswahl als sel-Elemente. */
function auswahlZeilen(auswahlCode: string, wert: unknown): string[] {
  const gewaehlt = Array.isArray(wert) ? wert : [wert]
  return gewaehlt
    .filter((o) => !leerWert(o))
    .map((o) => `<${NS}:sel a="${schuetzen(auswahlCode)}" o="${schuetzen(o)}"/>`)
}

/** Eine Eingabe zu null oder mehr Zeilen des Austauschformats. */
function eingabeZeilen(eingabe: NaepEingabe, p: NaepProtokoll): string[] {
  const wert = p.werte[eingabe.code]
  const zeilen: string[] = []

  if (eingabe.art === 'feld') {
    if (!leerWert(wert)) zeilen.push(feldZeile(eingabe, wert))
  } else if (eingabe.art === 'auswahl') {
    const leerCode = p.leer?.[eingabe.code]
    if (leerCode) zeilen.push(`<${NS}:leer a="${schuetzen(eingabe.code)}" c="${schuetzen(leerCode)}"/>`)
    else if (!leerWert(wert)) zeilen.push(...auswahlZeilen(eingabe.code, wert))
  } else if (eingabe.art === 'auswahlgruppe') {
    // Jede Auswahl der Gruppe traegt ihren eigenen Wert.
    for (const a of eingabe.auswahlen) {
      const w = p.werte[a.code]
      if (!leerWert(w)) zeilen.push(...auswahlZeilen(a.code, w))
    }
  } else if (eingabe.art === 'frage') {
    if (!leerWert(wert)) zeilen.push(`<${NS}:ant f="${schuetzen(eingabe.code)}" w="${schuetzen(wert)}"/>`)
  } else if (eingabe.art === 'freitext') {
    const roh = Array.isArray(wert) ? wert : String(wert ?? '').split('\n')
    const gefuellt = roh.filter((z) => String(z).trim() !== '')
    if (gefuellt.length > 0) {
      zeilen.push(
        `<${NS}:txt c="${schuetzen(eingabe.code)}">` +
          gefuellt.map((z) => `<${NS}:z>${schuetzen(z)}</${NS}:z>`).join('') +
          `</${NS}:txt>`,
      )
    }
  }

  // Eine Sonstiges-Angabe gehoert zu ihrer Auswahl.
  const sonst = p.sonstiges?.[eingabe.code]
  if (sonst) {
    zeilen.push(
      `<${NS}:sonst a="${schuetzen(eingabe.code)}" c="${schuetzen(sonst.code)}" t="${schuetzen(sonst.text)}"/>`,
    )
  }

  // Alles, was unter dieser Eingabe haengt.
  if ('zusatz' in eingabe && eingabe.zusatz) {
    for (const k of eingabe.zusatz.kinder) zeilen.push(...eingabeZeilen(k, p))
  }
  if (eingabe.art === 'gruppe' || eingabe.art === 'oder') {
    for (const k of eingabe.kinder) zeilen.push(...eingabeZeilen(k, p))
  }
  if (eingabe.art === 'frage' && eingabe.wennJa && String(wert) === 'J') {
    // Die Unterangaben gelten nur, wenn die Frage bejaht wurde.
    for (const k of eingabe.wennJa) zeilen.push(...eingabeZeilen(k, p))
  }
  if (eingabe.art === 'auswahl' || eingabe.art === 'auswahlgruppe') {
    const gewaehlt = new Set((Array.isArray(wert) ? wert : [wert]).map(String))
    for (const o of eingabe.optionen) {
      if (o.zusatz && gewaehlt.has(o.code)) {
        for (const k of o.zusatz.kinder) zeilen.push(...eingabeZeilen(k, p))
      }
    }
  }

  return zeilen
}

/** Die Verlaufsreihen eines Abschnitts. */
function verlaufXml(a: NaepAbschnitt, p: NaepProtokoll): string {
  const v = a.verlauf
  if (!v) return ''
  const c = schuetzen(v.code)
  const reihen = p.werte[v.code]
  if (!Array.isArray(reihen) || reihen.length === 0) {
    const leer = p.leer?.[v.code] ?? v.leer[0]?.code
    return leer ? `<${NS}:ver c="${c}"><${NS}:leer c="${schuetzen(leer)}"/></${NS}:ver>` : ''
  }
  const inhalt = (reihen as NaepWerte[])
    .map((reihe) => {
      const zeilen = v.spalten.flatMap((s) => eingabeZeilen(s, { ...p, werte: reihe }))
      return `<${NS}:r>${zeilen.join('')}</${NS}:r>`
    })
    .join('')
  return `<${NS}:ver c="${c}">${inhalt}</${NS}:ver>`
}

function abschnittXml(a: NaepAbschnitt, p: NaepProtokoll): string {
  const c = schuetzen(a.code)

  if (p.nichtBearbeitet?.includes(a.code)) return `<${NS}:abs c="${c}"><${NS}:nb/></${NS}:abs>`

  const kinder = (a.kinder ?? []).map((k) => abschnittXml(k, p)).join('')
  if (a.verlauf) return `<${NS}:abs c="${c}">${verlaufXml(a, p)}${kinder}</${NS}:abs>`

  const zeilen = (a.formular ?? []).flatMap((e) => eingabeZeilen(e, p))
  if (zeilen.length > 0) return `<${NS}:abs c="${c}"><${NS}:dat>${zeilen.join('')}</${NS}:dat>${kinder}</${NS}:abs>`

  // Ohne Angaben: ausdrücklich leer, wenn der Abschnitt das anbietet —
  // sonst gilt er als nicht bearbeitet. Das ist ein Unterschied, auf den es
  // ankommt: "untersucht, nichts gefunden" ist eine Aussage, "nicht
  // bearbeitet" keine.
  const leer = p.leer?.[a.code] ?? a.leer?.[0]?.code
  if (leer) return `<${NS}:abs c="${c}"><${NS}:leer c="${schuetzen(leer)}"/>${kinder}</${NS}:abs>`
  if (kinder) return `<${NS}:abs c="${c}">${kinder}</${NS}:abs>`
  return `<${NS}:abs c="${c}"><${NS}:nb/></${NS}:abs>`
}

/**
 * Ein Protokoll als NAEP-Austauschdatensatz.
 *
 * Das Ergebnis folgt `referenz/naep/xsd/naep-daten.xsd`.
 */
export function naepDatenXml(p: NaepProtokoll): string {
  const inhalt = NAEP_ABSCHNITTE.map((a) => abschnittXml(a, p)).join('')
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<${NS}:naep xmlns:${NS}="http://naep.divi.de/daten"` +
    ` xmlns:std="http://naep.divi.de/strukturen/std"` +
    ` xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"` +
    ` schemaVersion="1.0">` +
    `<${NS}:version protokoll="${schuetzen(NAEP_VERSION)}" metamodell="${schuetzen(NAEP_METAMODELL)}"/>` +
    `<${NS}:abschnitte>${inhalt}</${NS}:abschnitte>` +
    `</${NS}:naep>`
  )
}

/** Dateiname für den Export eines Protokolls. */
export function naepDateiname(protokollNr: string): string {
  const sauber = protokollNr.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return `naep-${sauber || 'protokoll'}.xml`
}
