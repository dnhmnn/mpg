// Vorschläge für Checklisten und Intervalle je Art — nur ein Anfang: Beim Einrichten lässt sich jede
// Liste anpassen, maßgeblich ist der Hygieneplan der Organisation. Prüffälle in selbsttest.ts.

import { MAX_PUNKTE, MAX_PUNKT_LAENGE, type HyArt, type HyIntervall } from './typen'

export const CHECKLISTE: Record<HyArt, string[]> = {
  fahrzeug: [
    'Trage: Liegefläche, Gurte und Griffe',
    'Kontaktflächen im Patientenraum (Griffe, Ablagen, Schalter, Sitze)',
    'Geräte und Kabel im Patientenraum abgewischt',
    'Fußboden im Patientenraum',
    'Fahrerraum: Lenkrad, Schalthebel, Funkgerät, Türgriffe',
    'Abfall entsorgt, Schutzausrüstung und Desinfektionsmittel aufgefüllt',
    'Einwirkzeit eingehalten',
  ],
  raum: [
    'Arbeitsflächen und Tische',
    'Türgriffe und Lichtschalter',
    'Waschbecken, Seifen- und Desinfektionsspender aufgefüllt',
    'Fußboden',
    'Abfall entsorgt',
  ],
  rucksack: [
    'Außenhülle und Tragegurte abgewischt',
    'Innenfächer kontrolliert und gereinigt',
    'Wiederverwendbares Material im Inneren desinfiziert',
    'Einwirkzeit eingehalten, trocken eingeräumt',
  ],
  geraet: [
    'Gehäuse und Bedienfeld abgewischt',
    'Kabel, Sensoren und Zubehör desinfiziert',
    'Einwirkzeit eingehalten',
    'Funktion nach der Aufbereitung geprüft',
  ],
  material: [
    'Oberfläche gereinigt und desinfiziert',
    'Einwirkzeit eingehalten',
    'Trocken und sauber verstaut',
  ],
  sonstiges: [
    'Gereinigt und desinfiziert',
    'Einwirkzeit eingehalten',
  ],
}

/** Erste Punkte je MPG-Gerätetyp (vor den allgemeinen Punkten für Geräte) */
const GERAET_ZUERST: Record<string, string[]> = {
  'Absaugpumpe': ['Sekretbehälter geleert, gereinigt und desinfiziert', 'Absaugschlauch und Filter gewechselt'],
  'Beatmungsgerät': ['Schlauchsystem und Filter gewechselt bzw. aufbereitet'],
  'Blutdruckmessgerät': ['Manschette gereinigt und desinfiziert'],
  'Pulsoximeter': ['Fingerclip bzw. Sensor desinfiziert'],
  'Thermometer': ['Messspitze desinfiziert'],
  'Patientenmonitor': ['Manschette, Sensoren und Klebeelektroden-Kabel desinfiziert'],
  'Defibrillator': ['Kabel und Paddles bzw. Anschlüsse desinfiziert'],
}

export const INTERVALL_VORSCHLAG: Record<HyArt, HyIntervall> = {
  fahrzeug: 'woechentlich', raum: 'woechentlich', rucksack: 'monatlich', geraet: 'woechentlich', material: 'woechentlich', sonstiges: 'monatlich',
}

/** Checkliste als Vorschlag: allgemein je Art, bei Geräten mit passenden ersten Punkten zum Typ. */
export function checklisteVorschlag(art: HyArt, geraeteTyp?: string): string[] {
  const zuerst = art === 'geraet' && geraeteTyp ? (GERAET_ZUERST[geraeteTyp.trim()] ?? []) : []
  return punkteBereinigen([...zuerst, ...CHECKLISTE[art]])
}

/** Punkte säubern: getrimmt, ohne leere und doppelte, höchstens MAX_PUNKTE, je höchstens MAX_PUNKT_LAENGE Zeichen. */
export function punkteBereinigen(punkte: unknown): string[] {
  if (!Array.isArray(punkte)) return []
  const gesehen = new Set<string>()
  const aus: string[] = []
  for (const p of punkte) {
    const t = String(p ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_PUNKT_LAENGE)
    const k = t.toLowerCase()
    if (!t || gesehen.has(k)) continue
    gesehen.add(k)
    aus.push(t)
    if (aus.length >= MAX_PUNKTE) break
  }
  return aus
}
