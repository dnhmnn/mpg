// Vorschläge aus MPG und Lager (Owner, 23.11.2026: „bestehende Artikel aus MPG oder Lager können
// verknüpft bzw. vorgeschlagen werden“). Reine Rechnung, Prüffälle in selbsttest.ts. Die Quellen
// liefert die Route GET /api/responda/hygiene/quellen (pb_hooks/hygiene.pb.js), nur der eigenen
// Organisation, ohne außer Betrieb genommene und archivierte.
//
// Es gibt keine Liste der Fahrzeuge oder Räume: Lager-Orte und MPG-Standorte sind freier Text,
// Sollausstattungen heißen „RTW 1 – Notfallrucksack“, Artikel haben keine Kategorie. Eingeordnet
// wird deshalb am Namen, und nichts wird ohne Bestätigung übernommen.

import { checklisteVorschlag, vorlageFuer } from './checklisten'
import type { HyArt, HyIntervall, HyObjekt, HyQuelle } from './typen'

export interface Quellen {
  geraete: { id: string; name: string; type?: string; location?: string }[]
  orte: { id: string; name: string }[]
  saetze: { id: string; name: string }[]
  artikel: { id: string; name: string }[]
}

export interface Vorschlag {
  /** Eindeutig je Vorschlag (für Auswahl und Ausblenden) */
  schluessel: string
  name: string
  art: HyArt
  standort: string
  quelle: HyQuelle
  quelle_id: string
  quelle_name: string
  /** Woher, kurz: „MPG · Absaugpumpe“, „Lager-Ort“, „Standort im MPG“ … */
  herkunft: string
  intervall: HyIntervall
  punkte: string[]
  /** Vorlage von Responda, aus der Checkliste und Intervall stammen */
  vorlage_id: string
}

/** Vergleichsschlüssel für Namen: klein, ohne Leerzeichen, Binde- und Schrägstriche („RTW 1“ = „rtw1“). */
export function namensSchluessel(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/[\s\-–—_/.]+/g, '')
}

const FAHRZEUG = /\b(rtw|ktw|nef|naw|itw|mzf|elw|hlf|lf|tlf|gw|mtw|mtf|kdow|seg|rth|dlk|dla|rw|gw-san|ktw-b)\b|\b\d{1,3}\s*\/\s*\d{1,3}(\s*\/\s*\d{1,3})?\b|fahrzeug|wagen/i
const RAUM = /wache|raum|halle|gerätehaus|geraetehaus|lager|umkleide|desinfektion|büro|buero|küche|kueche|sanitär|sanitaer|werkstatt|garage|stellplatz|aufenthalt/i
const BEHAELTER = /rucksack|koffer|tasche|notfallset|box\b|kiste/i

/** Ort einordnen: Fahrzeug, Raum, oder null, wenn der Name nichts verrät. */
export function ortArt(name: string): 'fahrzeug' | 'raum' | null {
  if (FAHRZEUG.test(name)) return 'fahrzeug'
  if (RAUM.test(name)) return 'raum'
  return null
}

/** Mehrweg-Material im Lager, das gereinigt wird — nur am Namen erkennbar, deshalb nur Vorschlag. */
const MEHRWEG = /manschette|blutdruck|stethoskop|beatmungsbeutel|beatmungsmaske|laryngoskop|schiene|vakuum|trage|tragestuhl|schaufel|spineboard|ked\b|absaug|thermometer|pulsoxi|rucksack|koffer|tasche|helm|schutzbrille|kühlbox|kuehlbox/i
const EINMAL = /einmal|einweg|steril|handschuh|kompresse|verband|pflaster|tupfer|spritze|kanüle|kanuele|lanzette|teststreifen|elektrode|rettungsdecke|tuch|tücher|tuecher|beutel|maske|filter|katheter|sonde|infusion|ampulle|tablette|batterie/i
export function istMehrweg(name: string): boolean {
  // Beatmungsbeutel und -maske sind Mehrweg; ohne Lookbehind im Ausdruck (Safari vor 16.4 kennt ihn nicht)
  return MEHRWEG.test(name) && !EINMAL.test(name.replace(/beatmungs(?:beutel|maske)/gi, ''))
}

/** Reihenfolge der MPG-Geräte: zuerst die mit Sekret oder Atemwegen, dann Hautkontakt, dann der Rest. */
const GERAET_RANG: Record<string, number> = {
  'Absaugpumpe': 0, 'Beatmungsgerät': 0,
  'Blutdruckmessgerät': 1, 'Pulsoximeter': 1, 'Thermometer': 1, 'BZ-Gerät': 1, 'Defibrillator': 1, 'AED': 1, 'Patientenmonitor': 1,
}

/** „RTW 1 – Notfallrucksack“ → { vorne: 'RTW 1', hinten: 'Notfallrucksack' } */
export function satzTeilen(name: string): { vorne: string; hinten: string } {
  const m = name.split(/\s+[–—-]\s+/)
  if (m.length < 2) return { vorne: '', hinten: name.trim() }
  return { vorne: m[0].trim(), hinten: m.slice(1).join(' – ').trim() }
}

/**
 * Vorschläge aus den Quellen, ohne die, die es als Objekt schon gibt (gleiche Quelle oder gleicher
 * Name, auch archiviert — wer archiviert hat, wollte es nicht mehr) und ohne ausgeblendete Schlüssel.
 */
export function vorschlaegeVon(q: Quellen, objekte: Pick<HyObjekt, 'name' | 'quelle' | 'quelle_id'>[], ausgeblendet: string[] = []): Vorschlag[] {
  const vergeben = new Set(objekte.filter(o => o.quelle && o.quelle_id).map(o => `${o.quelle}:${o.quelle_id}`))
  // Gleicher Name wie ein vorhandenes Objekt: nicht noch einmal vorschlagen
  const namen = new Set(objekte.map(o => namensSchluessel(o.name)))
  // Orte nur einmal (Lager-Ort und gleich geschriebener Standort aus dem MPG); Vorschläge mit eigener
  // Kennung (Geräte, Artikel) zählen je Kennung, auch wenn zwei gleich heißen
  const orte = new Set<string>()
  const weg = new Set(ausgeblendet)
  const aus: Vorschlag[] = []
  const dazu = (v: Omit<Vorschlag, 'intervall' | 'punkte' | 'vorlage_id'> & { typ?: string }) => {
    const k = namensSchluessel(v.name)
    if (!k || weg.has(v.schluessel) || namen.has(k)) return
    if (v.quelle && v.quelle_id && vergeben.has(`${v.quelle}:${v.quelle_id}`)) return
    const istOrt = v.quelle === 'lager_ort' || !v.quelle_id
    if (istOrt && orte.has(k)) return
    if (istOrt) orte.add(k)
    const { typ, ...rest } = v
    const vorlage = vorlageFuer(v.art, v.name)
    aus.push({ ...rest, intervall: vorlage.intervall, punkte: checklisteVorschlag(v.art, typ, v.name), vorlage_id: vorlage.id })
  }

  // Fahrzeuge und Räume: Lager-Orte (mit Kennung) vor freien Standorten aus dem MPG
  for (const o of [...q.orte].sort((a, b) => a.name.localeCompare(b.name, 'de'))) {
    dazu({ schluessel: `lager_ort:${o.id}`, name: o.name.trim(), art: ortArt(o.name) ?? 'raum', standort: '', quelle: 'lager_ort', quelle_id: o.id, quelle_name: o.name, herkunft: 'Lager-Ort' })
  }
  const standorte = new Map<string, string>()
  for (const g of q.geraete) {
    const s = (g.location || '').trim()
    if (s && !standorte.has(namensSchluessel(s))) standorte.set(namensSchluessel(s), s)
  }
  for (const [k, s] of [...standorte].sort((a, b) => a[1].localeCompare(b[1], 'de'))) {
    const art = ortArt(s)
    if (art) dazu({ schluessel: `standort:${k}`, name: s, art, standort: '', quelle: '', quelle_id: '', quelle_name: '', herkunft: 'Standort im MPG' })
  }
  // Rucksäcke und Koffer aus den Sollausstattungen
  for (const s of [...q.saetze].sort((a, b) => a.name.localeCompare(b.name, 'de'))) {
    const { vorne, hinten } = satzTeilen(s.name)
    if (!BEHAELTER.test(hinten) && !BEHAELTER.test(s.name)) continue
    dazu({ schluessel: `lager_satz:${s.id}`, name: s.name.trim(), art: 'rucksack', standort: vorne, quelle: 'lager_satz', quelle_id: s.id, quelle_name: s.name, herkunft: 'Sollausstattung im Lager' })
  }
  // Geräte aus dem MPG; heißen mehrere gleich (oft das Modell), steht der Standort dabei
  const gleich = new Map<string, number>()
  for (const g of q.geraete) gleich.set(namensSchluessel(g.name), (gleich.get(namensSchluessel(g.name)) ?? 0) + 1)
  const geraeteName = (g: Quellen['geraete'][number]) => (gleich.get(namensSchluessel(g.name))! > 1 && (g.location || '').trim() ? `${g.name.trim()} (${(g.location || '').trim()})` : g.name.trim())
  const geraete = [...q.geraete].sort((a, b) => (GERAET_RANG[a.type || ''] ?? 2) - (GERAET_RANG[b.type || ''] ?? 2) || a.name.localeCompare(b.name, 'de'))
  for (const g of geraete) {
    dazu({ schluessel: `mpg_geraet:${g.id}`, name: geraeteName(g), art: 'geraet', standort: (g.location || '').trim(), quelle: 'mpg_geraet', quelle_id: g.id, quelle_name: g.name, herkunft: g.type ? `MPG · ${g.type}` : 'MPG', typ: g.type })
  }
  // Mehrweg-Material aus dem Lager
  for (const a of [...q.artikel].sort((x, y) => x.name.localeCompare(y.name, 'de'))) {
    if (!istMehrweg(a.name)) continue
    dazu({ schluessel: `lager_artikel:${a.id}`, name: a.name.trim(), art: /rucksack|koffer|tasche/i.test(a.name) ? 'rucksack' : 'material', standort: '', quelle: 'lager_artikel', quelle_id: a.id, quelle_name: a.name, herkunft: 'Lager-Artikel' })
  }
  return aus
}
