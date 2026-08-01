// Selbsttest der Atemschutz-Formeln mit bekannten Referenzwerten.
// Aufrufbar über /eks/selbsttest — und per Node prüfbar (siehe unten).
// Grund: die Rechnung ist sicherheitskritisch; sie muß nachweisbar stimmen,
// bevor eine Oberfläche darauf aufsetzt.

import {
  vorratLiter, rueckzugsdruckPerson, verbrauchsrate, druckJetzt, reserveBar,
} from './atemschutz'
import { DEFAULT_AS_CONFIG, type AsConfig, type Flasche, type Messung } from './types'

export interface TestErgebnis { name: string; ok: boolean; erwartet: string; erhalten: string }

const F300: Flasche = { anzahl: 1, liter: 6.8, nenndruck: 300 }
const F2x4: Flasche = { anzahl: 2, liter: 4, nenndruck: 300 }
const F2x4_200: Flasche = { anzahl: 2, liter: 4, nenndruck: 200 }

function eq(name: string, erhalten: number, erwartet: number, tol = 0.001): TestErgebnis {
  return { name, ok: Math.abs(erhalten - erwartet) <= tol, erwartet: String(erwartet), erhalten: String(Math.round(erhalten * 1000) / 1000) }
}

export function laufeSelbsttest(): TestErgebnis[] {
  const cfg: AsConfig = { ...DEFAULT_AS_CONFIG }
  const r: TestErgebnis[] = []

  // Luftvorrat — die klassischen Referenzwerte
  r.push(eq('Vorrat 1×6,8 l @300 bar = 2040 l', vorratLiter(F300, 300), 2040))
  r.push(eq('Vorrat 2×4 l @300 bar = 2400 l', vorratLiter(F2x4, 300), 2400))
  r.push(eq('Vorrat 2×4 l @200 bar = 1600 l', vorratLiter(F2x4_200, 200), 1600))

  // Reserve = max(55, 60) + 10 = 70
  r.push(eq('Reserve = 70 bar', reserveBar(cfg), 70))

  // Doppelter Hinweg: Start 300, am Ziel 240 → Verbrauch 60 → 2×60 + 70 = 190
  r.push(eq('Rückzug doppelter Hinweg (300→240)', rueckzugsdruckPerson(300, 240, cfg), 190))

  // Ohne Zielmeldung fällt das Modell auf den festen Wert zurück (100), Untergrenze 70 greift nicht
  r.push(eq('Rückzug ohne Zielmeldung → fester Wert', rueckzugsdruckPerson(300, undefined, cfg), 100))

  // Zwei-Drittel-Regel: 300 → 200
  r.push(eq('Rückzug Zwei-Drittel (300)', rueckzugsdruckPerson(300, undefined, { ...cfg, rueckzug_modell: 'zwei_drittel' }), 200))

  // Drittelregel: 300 − (300−70)/3 = 300 − 76,67 = 223,33 → aufgerundet auf 230
  r.push(eq('Rückzug Drittelregel (300)', rueckzugsdruckPerson(300, undefined, { ...cfg, rueckzug_modell: 'drittel' }), 230))

  // Untergrenze: fester Wert 20 bar muß auf die Reserve (70) angehoben werden
  r.push(eq('Untergrenze greift (fest 20 → 70)', rueckzugsdruckPerson(300, undefined, { ...cfg, rueckzug_modell: 'fest', rueckzug_fest_bar: 20 }), 70))

  // Verbrauchsrate gemessen: 300 → 240 in 10 min = 6 bar/min
  const t0 = new Date('2026-01-01T10:00:00Z').toISOString()
  const t10 = new Date('2026-01-01T10:10:00Z').toISOString()
  const ms: Messung[] = [{ t: t0, druck: 300 }, { t: t10, druck: 240 }]
  const vr = verbrauchsrate(ms, F300, cfg)
  r.push(eq('Verbrauchsrate gemessen = 6 bar/min', vr.rate, 6))
  r.push({ name: 'Verbrauchsrate als "gemessen" gekennzeichnet', ok: vr.herkunft === 'gemessen', erwartet: 'gemessen', erhalten: vr.herkunft })

  // Fallback ohne zweite Messung: 40 l/min / 6,8 l = 5,882 bar/min
  const vr1 = verbrauchsrate([{ t: t0, druck: 300 }], F300, cfg)
  r.push(eq('Verbrauchsrate angenommen (40 l/min ÷ 6,8 l)', vr1.rate, 40 / 6.8, 0.01))
  r.push({ name: 'Fallback als "angenommen" gekennzeichnet', ok: vr1.herkunft === 'angenommen', erwartet: 'angenommen', erhalten: vr1.herkunft })

  // Extrapolation: 5 min nach der letzten Messung bei 6 bar/min → 240 − 30 = 210
  const now = new Date('2026-01-01T10:15:00Z').getTime()
  r.push(eq('Extrapolierter Druck nach 5 min', druckJetzt(ms, 6, now), 210))

  // Druck darf nie unter 0 laufen
  r.push(eq('Druck nie negativ', druckJetzt(ms, 6, new Date('2026-01-01T20:00:00Z').getTime()), 0))

  return r
}
