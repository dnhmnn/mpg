// Atemschutz-Berechnungen nach FwDV 7.
//
// Bewusst REINE Funktionen: kein React, kein Date.now() — `now` ist immer ein
// Parameter. Dadurch sind alle Werte reproduzierbar und im Selbsttest prüfbar
// (siehe selbsttest.ts). Jede angezeigte Zahl muss ihre Herkunft mitführen:
// gemessen / berechnet / angenommen.
//
// UNTERSTÜTZUNGSWERKZEUG — ersetzt die Atemschutzüberwachung nach FwDV 7 nicht.

import type { AsConfig, AtemschutzTrupp, Flasche, Messung, TruppMitglied } from './types'

/** Luftvorrat in Litern: 1×6,8 l @300 bar = 2040 l · 2×4 l @300 bar = 2400 l */
export function vorratLiter(f: Flasche, druckBar: number): number {
  return f.anzahl * f.liter * druckBar
}

function ceil10(v: number): number { return Math.ceil(v / 10) * 10 }

/** Untergrenze, die der Rückzugsdruck nie unterschreiten darf. */
export function reserveBar(cfg: AsConfig): number {
  return Math.max(cfg.restdruckwarner_bar, cfg.hard_floor_bar) + cfg.sicherheitszuschlag_bar
}

export type RateHerkunft = 'gemessen' | 'angenommen'

/**
 * Verbrauchsrate in bar/min. Bevorzugt aus den tatsächlichen Druckabfragen —
 * das ist deutlich belastbarer als ein pauschaler Annahmewert.
 * Fenster unter 30 s werden verworfen (Ableserauschen).
 */
export function verbrauchsrate(
  messungen: Messung[], flasche: Flasche, cfg: AsConfig,
): { rate: number; herkunft: RateHerkunft } {
  const angenommen = cfg.angenommener_verbrauch_l_min / (flasche.anzahl * flasche.liter)
  const letzte = messungen.slice(-3)
  if (letzte.length >= 2) {
    const a = letzte[0], b = letzte[letzte.length - 1]
    const dp = a.druck - b.druck
    const dtMin = (new Date(b.t).getTime() - new Date(a.t).getTime()) / 60000
    if (dtMin > 0.5 && dp > 0) {
      return { rate: clamp(dp / dtMin, 0.5, 40), herkunft: 'gemessen' }
    }
  }
  return { rate: clamp(angenommen, 0.5, 40), herkunft: 'angenommen' }
}

function clamp(v: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, v)) }

/**
 * Rückzugsdruck einer Person.
 * `doppelter_hinweg` (Standard): derselbe Verbrauch wie für den Hinweg wird für
 * den Rückweg reserviert, plus Sicherheitsreserve. Beispiel 300 → 240 am Ziel:
 * Verbrauch 60 → 2×60 + 70 … die Praxisformel rechnet den Hinweg-Verbrauch
 * einmal für zurück plus Reserve; wir folgen der verbreiteten Auslegung
 * „Rückweg kostet wie der Hinweg" → p_r = 2×(p_start − p_ziel) + Reserve,
 * begrenzt nach unten durch Warndruck + Zuschlag.
 */
export function rueckzugsdruckPerson(
  pStart: number, pZiel: number | undefined, cfg: AsConfig,
): number {
  const res = reserveBar(cfg)
  let p: number
  switch (cfg.rueckzug_modell) {
    case 'doppelter_hinweg':
      if (pZiel === undefined) { p = cfg.rueckzug_fest_bar; break }
      p = 2 * (pStart - pZiel) + res
      break
    case 'drittel':
      p = pStart - (pStart - res) / 3
      break
    case 'zwei_drittel':
      p = pStart * (2 / 3)
      break
    case 'fest':
    default:
      p = cfg.rueckzug_fest_bar
  }
  return Math.max(ceil10(p), res)
}

/** Geschätzter aktueller Druck zwischen zwei Abfragen (extrapoliert!). */
export function druckJetzt(messungen: Messung[], rate: number, nowMs: number): number {
  if (!messungen.length) return 0
  const last = messungen[messungen.length - 1]
  const dtMin = (nowMs - new Date(last.t).getTime()) / 60000
  return Math.max(0, last.druck - rate * Math.max(0, dtMin))
}

export interface PersonBerechnung {
  person_id: string
  name: string
  pLetzte: number
  tLetzte: string | null
  pJetzt: number
  rate: number
  herkunft: RateHerkunft
  rueckzugsdruck: number
}

export interface TruppBerechnung {
  personen: PersonBerechnung[]
  /** Maßgeblich ist immer der schwächste Trupp-Angehörige. */
  pTrupp: number
  rateTrupp: number
  rueckzugsdruckTrupp: number
  herkunft: RateHerkunft
  tBisRueckzugMin: number | null
  tBisWarnerMin: number | null
  tUnterPaSek: number | null
  naechsteAbfrageInSek: number | null
  letzteAbfrage: string | null
}

export function berechneTrupp(t: AtemschutzTrupp, cfg: AsConfig, nowMs: number): TruppBerechnung {
  const personen: PersonBerechnung[] = t.mitglieder.map((m: TruppMitglied) => {
    const ms = t.messungen[m.person_id] || []
    const alle: Messung[] = [{ t: t.t_unter_pa || t.t_ziel || new Date(nowMs).toISOString(), druck: m.anfangsdruck }, ...ms]
    const { rate, herkunft } = verbrauchsrate(alle, m.flasche, cfg)
    const last = alle[alle.length - 1]
    return {
      person_id: m.person_id,
      name: m.name,
      pLetzte: last.druck,
      tLetzte: ms.length ? ms[ms.length - 1].t : null,
      pJetzt: Math.round(druckJetzt(alle, rate, nowMs)),
      rate,
      herkunft,
      rueckzugsdruck: rueckzugsdruckPerson(m.anfangsdruck, t.ziel_druecke?.[m.person_id], cfg),
    }
  })

  const pTrupp = personen.length ? Math.min(...personen.map(p => p.pJetzt)) : 0
  const rateTrupp = personen.length ? Math.max(...personen.map(p => p.rate)) : 1
  const rueckzugsdruckTrupp = personen.length ? Math.max(...personen.map(p => p.rueckzugsdruck)) : cfg.rueckzug_fest_bar
  const herkunft: RateHerkunft = personen.some(p => p.herkunft === 'angenommen') ? 'angenommen' : 'gemessen'

  const alleZeiten = personen.map(p => p.tLetzte).filter(Boolean) as string[]
  const letzteAbfrage = alleZeiten.length ? alleZeiten.sort()[alleZeiten.length - 1] : null
  const bezug = letzteAbfrage || t.t_unter_pa || null

  return {
    personen, pTrupp, rateTrupp, rueckzugsdruckTrupp, herkunft,
    tBisRueckzugMin: rateTrupp > 0 ? (pTrupp - rueckzugsdruckTrupp) / rateTrupp : null,
    tBisWarnerMin: rateTrupp > 0 ? (pTrupp - cfg.restdruckwarner_bar) / rateTrupp : null,
    tUnterPaSek: t.t_unter_pa ? (nowMs - new Date(t.t_unter_pa).getTime()) / 1000 : null,
    naechsteAbfrageInSek: bezug ? cfg.abfrage_intervall_s - (nowMs - new Date(bezug).getTime()) / 1000 : null,
    letzteAbfrage,
  }
}

// ── Alarme ───────────────────────────────────────────────────────────────────
// Ausschließlich aus Zustand + `now` abgeleitet: jedes Gerät kommt zum selben
// Ergebnis, und Timer-Drosselung im Hintergrund kann nichts verfälschen.

export type AlarmLevel = 'info' | 'warn' | 'critical'
export interface Alarm { key: string; level: AlarmLevel; text: string; trupp_id: string }

const RANK: Record<AlarmLevel, number> = { info: 0, warn: 1, critical: 2 }
export function hoechster(alarme: Alarm[]): AlarmLevel | null {
  if (!alarme.length) return null
  return alarme.reduce((a, b) => (RANK[b.level] > RANK[a.level] ? b : a)).level
}

export function alarmeFuerTrupp(t: AtemschutzTrupp, b: TruppBerechnung, cfg: AsConfig): Alarm[] {
  const out: Alarm[] = []
  if (t.status === 'abgemeldet' || t.status === 'angemeldet') return out
  const add = (key: string, level: AlarmLevel, text: string) => out.push({ key: `${t.id}:${key}`, level, text, trupp_id: t.id })

  if (t.mayday) add('mayday', 'critical', 'MAYDAY — ' + t.mayday)
  if (b.pTrupp <= cfg.restdruckwarner_bar) add('warndruck', 'critical', `Restdruckwarner erreicht (${b.pTrupp} bar)`)
  else if (b.pTrupp <= b.rueckzugsdruckTrupp) add('rueckzug', 'critical', `Rückzugsdruck erreicht (${b.pTrupp} von ${b.rueckzugsdruckTrupp} bar)`)

  if (b.naechsteAbfrageInSek !== null) {
    if (b.naechsteAbfrageInSek <= -cfg.abfrage_ueberfaellig_s) add('abfrage', 'critical', 'Druckabfrage überfällig')
    else if (b.naechsteAbfrageInSek <= 0) add('abfrage', 'warn', 'Druckabfrage fällig')
    else if (b.naechsteAbfrageInSek <= cfg.abfrage_vorwarnung_s) add('abfrage', 'info', 'Druckabfrage in Kürze fällig')
  }

  if (b.tUnterPaSek !== null) {
    if (b.tUnterPaSek >= cfg.max_einsatzzeit_s) add('einsatzzeit', 'critical', 'Maximale Einsatzzeit überschritten')
    else if (b.tUnterPaSek >= 0.8 * cfg.max_einsatzzeit_s) add('einsatzzeit', 'warn', 'Einsatzzeit fast erreicht')
  }

  if (b.tBisRueckzugMin !== null && b.tBisRueckzugMin > 0 && b.tBisRueckzugMin * 60 <= cfg.warnzeit_vor_rueckzug_s) {
    add('rueckzug_bald', 'warn', `Rückzug in ca. ${Math.max(0, Math.round(b.tBisRueckzugMin))} min`)
  }
  return out
}

/** Weiche Hinweise auf Abweichungen von der Einsatzlehre — warnen, nie blockieren. */
export function doktrinHinweise(trupps: AtemschutzTrupp[]): string[] {
  const hin: string[] = []
  const aktiv = trupps.filter(t => t.status !== 'abgemeldet' && t.status !== 'angemeldet')
  const hatSicherheit = trupps.some(t => t.typ === 'sicherheit' && t.status !== 'abgemeldet')
  if (aktiv.length > 0 && !hatSicherheit) hin.push('Kein Sicherheitstrupp bereitgestellt, obwohl ein Trupp unter PA ist.')
  for (const t of aktiv) {
    if (t.mitglieder.length < 2 || t.mitglieder.length > 3) hin.push(`${t.name}: Truppstärke ${t.mitglieder.length} (üblich sind 2–3).`)
    for (const m of t.mitglieder) {
      if (m.flasche.nenndruck >= 300 && m.anfangsdruck < 270) hin.push(`${t.name} · ${m.name}: Anfangsdruck nur ${m.anfangsdruck} bar.`)
    }
    if (!t.funkrufname) hin.push(`${t.name}: kein Funkrufname hinterlegt.`)
    if (!t.auftrag) hin.push(`${t.name}: kein Auftrag hinterlegt.`)
  }
  return hin
}

export function fmtDauer(sek: number | null): string {
  if (sek === null || !isFinite(sek)) return '–'
  const s = Math.max(0, Math.floor(sek))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
