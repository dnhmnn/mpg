// Checklisten-Vorlagen von Responda (Owner, 26.11.2026: „in ein Feuerwehrauto macht es keinen Sinn, die Trage
// zu reinigen“): je Fahrzeugart, Raum und Gegenstand eine eigene Vorlage. Nur ein Anfang — Organisationen legen
// eigene Vorlagen an (hygiene_vorlagen) und passen jede Liste an; maßgeblich ist ihr Hygieneplan.
// Ausgewählt wird nach Art und Namen (vorlageFuer). Prüffälle in selbsttest.ts.

import { MAX_PUNKTE, MAX_PUNKT_LAENGE, STD, type HyArt, type HyIntervall, type HyVorlage } from './typen'

const v = (id: string, name: string, art: HyArt, intervall: HyIntervall, punkte: string[]): HyVorlage =>
  ({ id: STD + id, name, art, intervall, intervall_tage: 0, punkte })

export const STD_VORLAGEN: HyVorlage[] = [
  v('rettungsdienst', 'Rettungsdienst-Fahrzeug (RTW, KTW, NEF)', 'fahrzeug', 'woechentlich', [
    'Trage: Liegefläche, Gurte und Griffe',
    'Kontaktflächen im Patientenraum (Griffe, Ablagen, Schalter, Sitze)',
    'Geräte und Kabel im Patientenraum abgewischt',
    'Fußboden im Patientenraum',
    'Fahrerraum: Lenkrad, Schalthebel, Funkgerät, Türgriffe',
    'Abfall entsorgt, Schutzausrüstung und Desinfektionsmittel aufgefüllt',
    'Einwirkzeit eingehalten',
  ]),
  v('feuerwehr', 'Feuerwehrfahrzeug (HLF, LF, TLF, DLK, RW)', 'fahrzeug', 'monatlich', [
    'Fahrerraum: Lenkrad, Schalthebel, Armaturen, Türgriffe',
    'Mannschaftsraum: Sitze, Haltegriffe, Gurtschlösser, Türgriffe',
    'Funkgeräte, Bedienteile und Handsprechfunkgeräte abgewischt',
    'Halterungen und Ablagen im Mannschaftsraum gereinigt',
    'Verschmutzte Einsatzkleidung und Gerät nicht im Mannschaftsraum (Schwarz-Weiß-Trennung)',
    'Erste-Hilfe-Material kontrolliert, Verbrauchtes ersetzt',
    'Boden und Trittstufen gereinigt',
    'Abfall entsorgt, Handschuhe und Desinfektionsmittel aufgefüllt',
  ]),
  v('mannschaft', 'Mannschafts- und Führungsfahrzeug (MTW, ELW, KdoW)', 'fahrzeug', 'monatlich', [
    'Fahrerraum: Lenkrad, Schalthebel, Armaturen, Türgriffe',
    'Sitze, Haltegriffe und Gurtschlösser',
    'Funkgeräte, Tablet und Bedienteile abgewischt',
    'Arbeitsplatz und Tisch (Führungsfahrzeug)',
    'Boden gereinigt',
    'Abfall entsorgt, Desinfektionsmittel aufgefüllt',
  ]),
  v('fahrzeug', 'Fahrzeug allgemein', 'fahrzeug', 'monatlich', [
    'Fahrerraum: Lenkrad, Schalthebel, Armaturen, Türgriffe',
    'Sitze und Haltegriffe',
    'Funkgerät und Bedienteile abgewischt',
    'Boden gereinigt',
    'Abfall entsorgt, Desinfektionsmittel aufgefüllt',
  ]),
  v('raum', 'Raum allgemein', 'raum', 'woechentlich', [
    'Arbeitsflächen und Tische',
    'Türgriffe und Lichtschalter',
    'Waschbecken, Seifen- und Desinfektionsspender aufgefüllt',
    'Fußboden',
    'Abfall entsorgt',
  ]),
  v('sanitaer', 'Sanitärraum und Umkleide', 'raum', 'woechentlich', [
    'Waschbecken und Armaturen',
    'Toiletten und Duschen',
    'Seifen-, Desinfektions- und Handtuchspender aufgefüllt',
    'Bänke, Spindgriffe und Türgriffe',
    'Fußboden',
    'Abfall entsorgt',
  ]),
  v('desinfektionsraum', 'Desinfektions- und Aufbereitungsraum', 'raum', 'woechentlich', [
    'Arbeitsflächen, rein und unrein getrennt',
    'Becken und Spüle',
    'Dosiergerät und Desinfektionsmittel: Konzentration und Haltbarkeit geprüft',
    'Schutzausrüstung vorrätig (Handschuhe, Schürzen, Schutzbrillen)',
    'Fußboden',
    'Abfall entsorgt',
  ]),
  v('rucksack', 'Rucksack oder Koffer', 'rucksack', 'monatlich', [
    'Außenhülle und Tragegurte abgewischt',
    'Innenfächer kontrolliert und gereinigt',
    'Wiederverwendbares Material im Inneren desinfiziert',
    'Einwirkzeit eingehalten, trocken eingeräumt',
  ]),
  v('geraet', 'Gerät allgemein', 'geraet', 'woechentlich', [
    'Gehäuse und Bedienfeld abgewischt',
    'Kabel, Sensoren und Zubehör desinfiziert',
    'Einwirkzeit eingehalten',
    'Funktion nach der Aufbereitung geprüft',
  ]),
  v('transport', 'Trage, Tragestuhl, Vakuummatratze', 'material', 'woechentlich', [
    'Liegefläche und Polster',
    'Gurte und Gurtschlösser',
    'Griffe und Gestell',
    'Räder und Bremsen gereinigt',
    'Einwirkzeit eingehalten',
  ]),
  v('material', 'Material (z. B. Blutdruckmanschette)', 'material', 'woechentlich', [
    'Oberfläche gereinigt und desinfiziert',
    'Einwirkzeit eingehalten',
    'Trocken und sauber verstaut',
  ]),
  v('sonstiges', 'Sonstiges', 'sonstiges', 'monatlich', [
    'Gereinigt und desinfiziert',
    'Einwirkzeit eingehalten',
  ]),
]

export function stdVorlage(id: string | null | undefined): HyVorlage | undefined {
  return STD_VORLAGEN.find(x => x.id === id)
}
const std = (id: string) => stdVorlage(STD + id)!

const RETTUNGSDIENST = /\b(rtw|ktw|nef|naw|itw|rth|ktw-b|mzf|seg)\b|rettungswagen|krankenwagen|notarzt/i
const FEUERWEHR = /\b(hlf|lf|tlf|stlf|mlf|klf|tsf|tsf-w|dlk|dla|rw|gw|gw-l|swa|ulf|vlf)\b|löschfahrzeug|loeschfahrzeug|drehleiter|rüstwagen|ruestwagen/i
const MANNSCHAFT = /\b(mtw|mtf|elw|kdow|kdw|bt-kombi)\b|mannschaft|kommando|einsatzleit/i
const SANITAER = /sanitär|sanitaer|\bwc\b|toilette|umkleide|dusch/i
const AUFBEREITUNG = /desinfektion|aufbereitung/i
const TRANSPORT = /trage|tragestuhl|vakuum|schaufel|spineboard/i

/** Die passende Vorlage von Responda für ein Objekt nach Art und Namen (z. B. „HLF 20/1“ → Feuerwehrfahrzeug). */
export function vorlageFuer(art: HyArt, name = ''): HyVorlage {
  switch (art) {
    case 'fahrzeug':
      if (RETTUNGSDIENST.test(name)) return std('rettungsdienst')
      if (FEUERWEHR.test(name)) return std('feuerwehr')
      if (MANNSCHAFT.test(name)) return std('mannschaft')
      return std('fahrzeug')
    case 'raum':
      if (SANITAER.test(name)) return std('sanitaer')
      if (AUFBEREITUNG.test(name)) return std('desinfektionsraum')
      return std('raum')
    case 'material': return TRANSPORT.test(name) ? std('transport') : std('material')
    default: return std(art)
  }
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

/** Intervall-Vorschlag je Art (für Objekte ohne Vorlage) */
export const INTERVALL_VORSCHLAG: Record<HyArt, HyIntervall> = {
  fahrzeug: 'monatlich', raum: 'woechentlich', rucksack: 'monatlich', geraet: 'woechentlich', material: 'woechentlich', sonstiges: 'monatlich',
}

/** Checkliste als Vorschlag: die passende Vorlage, bei Geräten mit ersten Punkten zum MPG-Gerätetyp. */
export function checklisteVorschlag(art: HyArt, geraeteTyp?: string, name = ''): string[] {
  const zuerst = art === 'geraet' && geraeteTyp ? (GERAET_ZUERST[geraeteTyp.trim()] ?? []) : []
  return punkteBereinigen([...zuerst, ...vorlageFuer(art, name).punkte])
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

const gleichePunkte = (a: string[], b: string[]) => {
  const x = punkteBereinigen(a), y = punkteBereinigen(b)
  return x.length === y.length && x.every((p, i) => p === y[i])
}

/**
 * Eine eigene Vorlage wurde geändert: Welche Objekte, die sie nutzen, bekommen die neue Checkliste?
 * Nur die, deren Liste noch genau der bisherigen Vorlage entspricht; von Hand angepasste bleiben, wie sie
 * sind (abweichend), archivierte werden nicht angefasst.
 */
export function uebertragen(vorlageId: string, bisher: string[], objekte: { id: string; vorlage_id?: string; punkte: string[]; archiviert?: string }[]): { gleich: string[]; abweichend: string[] } {
  const nutzen = objekte.filter(o => o.vorlage_id === vorlageId && !o.archiviert)
  return {
    gleich: nutzen.filter(o => gleichePunkte(o.punkte, bisher)).map(o => o.id),
    abweichend: nutzen.filter(o => !gleichePunkte(o.punkte, bisher)).map(o => o.id),
  }
}
