// Push-Benachrichtigungen: Fristen für den Morgen- und Wochenlauf (rein).
//
// Port von src/lib/mpg/fristen.ts (STK, MTK, Regelprüfung) und den CIRS-Fristen aus
// src/lib/cirs.ts. Einziger Unterschied: Zeitpunkte (keine reinen Datumsangaben) zählen nach
// deutscher Zeit (kalendertagBerlin) statt nach der Ortszeit des Geräts; der Server kennt die
// Zeitzone seines Prozesses nicht, und Intl fehlt in der JSVM.
//
// Prüffälle: src/lib/__tests__/pushFristen.test.ts vergleicht mit den TS-Dateien (TZ Berlin).
// CommonJS, keine Seiteneffekte, keine PocketBase-Globale (wie push-regeln.js).

// ── MPG (Port von src/lib/mpg/fristen.ts) ───────────────────────────────────

const INTERVALLE = ["daily", "weekly", "days", "monthly", "yearly"]

const INTERVALL_NAMEN = {
  daily: "daily", "täglich": "daily", taeglich: "daily", tag: "daily",
  weekly: "weekly", "wöchentlich": "weekly", woechentlich: "weekly", woche: "weekly",
  days: "days", tage: "days",
  monthly: "monthly", monatlich: "monthly", monat: "monthly",
  yearly: "yearly", annually: "yearly", "jährlich": "yearly", jaehrlich: "yearly", jahr: "yearly",
}

function intervallVon(wert) {
  const roh = Array.isArray(wert) ? wert[0] : wert
  const k = String(roh === undefined || roh === null ? "" : roh).trim().toLowerCase()
  return Object.prototype.hasOwnProperty.call(INTERVALL_NAMEN, k) ? INTERVALL_NAMEN[k] : "monthly"
}

const VORWARNUNG = { daily: 0, weekly: 1, monthly: 7, yearly: 30, stk: 30, mtk: 30 }

/** Gültige Zahl der Tage bei „alle N Tage“: 1 bis 365, sonst 7 (wie tageVon in fristen.ts). */
function tageVon(wert) {
  const n = Number(wert)
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : 7
}

/** Vorwarnung einer Regelprüfung; bei „alle N Tage“ ein Viertel des Abstands, höchstens 30. */
function vorwarnungVon(intervall, tage) {
  return intervall === "days" ? Math.min(30, Math.floor(tageVon(tage) / 4)) : VORWARNUNG[intervall]
}

function zahl2(n) {
  return (n < 10 ? "0" : "") + n
}

function tagAusUtc(ms) {
  const d = new Date(ms)
  return d.getUTCFullYear() + "-" + zahl2(d.getUTCMonth() + 1) + "-" + zahl2(d.getUTCDate())
}

function utcVon(tag) {
  const t = String(tag).split("-").map(Number)
  return Date.UTC(t[0], t[1] - 1, t[2])
}

function letzterSonntag(jahr, monat) {
  const ende = new Date(Date.UTC(jahr, monat + 1, 0))
  return Date.UTC(jahr, monat, ende.getUTCDate() - ende.getUTCDay(), 1)
}

/** Kalendertag eines Zeitpunkts nach deutscher Zeit (wie berlinTeile in push-regeln.js). */
function tagBerlin(ms) {
  const jahr = new Date(ms).getUTCFullYear()
  const sommer = ms >= letzterSonntag(jahr, 2) && ms < letzterSonntag(jahr, 9)
  return tagAusUtc(ms + (sommer ? 120 : 60) * 60000)
}

/**
 * Kalendertag aus einem PocketBase-Wert (wie kalendertag in fristen.ts):
 * - '2026-03-10' und '2026-03-10 00:00:00.000Z' sind reine Datumsangaben und gelten als genau
 *   dieser Tag, ohne Zeitzonen-Verschiebung;
 * - alles andere ist ein Zeitpunkt und zählt nach deutscher Zeit.
 */
function kalendertagBerlin(wert) {
  if (!wert) return null
  const s = String(wert).trim()
  const nurDatum = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]00:00(?::00(?:\.0+)?)?Z?)?$/.exec(s)
  if (nurDatum) {
    const j = nurDatum[1], m = nurDatum[2], t = nurDatum[3]
    const ms = Date.UTC(+j, +m - 1, +t)
    return tagAusUtc(ms) === j + "-" + m + "-" + t ? j + "-" + m + "-" + t : null
  }
  const ms = parseZeit(s)
  return Number.isFinite(ms) ? tagBerlin(ms) : null
}

/**
 * Zeitpunkt wie new Date(s.replace(' ', 'T')) im Browser. Ohne Zeitzone (kein Z, kein ±hh:mm)
 * meint der Browser Ortszeit; auf dem Server zählt dann deutsche Zeit.
 */
function parseZeit(s) {
  const t = String(s).replace(" ", "T")
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(t) || /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const ms = Date.parse(t)
    return Number.isFinite(ms) ? ms : NaN
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?$/.exec(t)
  if (!m) {
    const ms = Date.parse(t)
    return Number.isFinite(ms) ? ms : NaN
  }
  const wand = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0), +((m[7] || "0") + "00").slice(0, 3))
  if (!Number.isFinite(wand)) return NaN
  const sommer = wand - 7200000
  const jahr = new Date(sommer).getUTCFullYear()
  if (sommer >= letzterSonntag(jahr, 2) && sommer < letzterSonntag(jahr, 9)) return sommer
  return wand - 3600000
}

function plusTage(tag, n) {
  return tagAusUtc(utcVon(tag) + n * 86400000)
}

function plusMonate(tag, n) {
  const t = String(tag).split("-").map(Number)
  const ziel = new Date(Date.UTC(t[0], t[1] - 1 + n, 1))
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0)).getUTCDate()
  return tagAusUtc(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth(), Math.min(t[2], letzter)))
}

function monatsende(tag) {
  const t = String(tag).split("-").map(Number)
  return tagAusUtc(Date.UTC(t[0], t[1], 0))
}

function tageZwischen(a, b) {
  return Math.round((utcVon(b) - utcVon(a)) / 86400000)
}

function naechstePruefung(letzte, intervall, tage) {
  switch (intervall) {
    case "daily": return plusTage(letzte, 1)
    case "weekly": return plusTage(letzte, 7)
    case "days": return plusTage(letzte, tageVon(tage))
    case "monthly": return plusMonate(letzte, 1)
    case "yearly": return plusMonate(letzte, 12)
  }
  return plusMonate(letzte, 1)
}

const STK_HOECHSTENS = 24
const MTK_HOECHSTENS_JAHRE = 2

function monateVon(wert) {
  const n = Number(wert)
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : 24
}

function stkMonate(wert) {
  return Math.min(monateVon(wert), STK_HOECHSTENS)
}

function mtkJahre(wert) {
  return Math.min(MTK_HOECHSTENS_JAHRE, Math.max(1, Math.floor(monateVon(wert) / 12)))
}

function naechsteStk(letzte, monate) {
  return monatsende(plusMonate(letzte, stkMonate(monate)))
}

function naechsteMtk(letzte, monate) {
  return (Number(String(letzte).slice(0, 4)) + mtkJahre(monate)) + "-12-31"
}

function lageVon(naechste, heute, vorwarnung) {
  if (!naechste) return { lage: "offen", tage: null }
  const tage = tageZwischen(heute, naechste)
  if (tage < 0) return { lage: "ueberfaellig", tage: tage }
  if (tage === 0) return { lage: "heute", tage: tage }
  if (tage <= vorwarnung) return { lage: "bald", tage: tage }
  return { lage: "ok", tage: tage }
}

function mit(a, b) {
  const aus = {}
  for (const k of Object.keys(a)) aus[k] = a[k]
  for (const k of Object.keys(b)) aus[k] = b[k]
  return aus
}

/** Alle Fristen eines Geräts: Regelprüfung, dazu STK und MTK, wenn verlangt (wie fristenVon in fristen.ts). */
function fristenVon(g, heute) {
  const intervall = intervallVon(g.interval)
  const letzte = kalendertagBerlin(g.last_inspection)
  const naechste = letzte ? naechstePruefung(letzte, intervall, g.interval_days) : null
  const liste = [mit({ art: "pruefung", bezeichnung: "Prüfung", letzte: letzte, naechste: naechste }, lageVon(naechste, heute, vorwarnungVon(intervall, g.interval_days)))]
  const gueltig = (t) => (t && t <= heute ? t : null)
  const inbetriebRoh = kalendertagBerlin(g.inbetriebnahme)
  const inbetrieb = gueltig(inbetriebRoh)
  const kontrolle = (art, roh, naechsteVon) => {
    const l = gueltig(roh)
    const bezug = l || inbetrieb
    const n = bezug ? naechsteVon(bezug) : null
    return mit({
      art: art, bezeichnung: art === "stk" ? "STK" : "MTK", letzte: l, naechste: n, abInbetriebnahme: !roh && !!inbetrieb,
      zukunft: (!!roh && !l) || (!l && !!inbetriebRoh && !inbetrieb),
    }, lageVon(n, heute, VORWARNUNG[art]))
  }
  const zahlOder = (w, v) => (w === undefined || w === null ? v : w)
  if (g.has_stk) liste.push(kontrolle("stk", kalendertagBerlin(g.last_stk), (b) => naechsteStk(b, zahlOder(g.stk_interval_months, STK_HOECHSTENS))))
  if (g.has_mtk) liste.push(kontrolle("mtk", kalendertagBerlin(g.last_mtk), (b) => naechsteMtk(b, zahlOder(g.mtk_interval_months, 24))))
  return liste
}

function ausserBetrieb(g) {
  return !!String(g && g.ausser_betrieb !== undefined && g.ausser_betrieb !== null ? g.ausser_betrieb : "").trim()
}

/** Überfällige STK/MTK eines Geräts (nicht außer Betrieb): [{ art, naechste }]. */
function ueberfaelligeKontrollen(g, heute) {
  if (!g || ausserBetrieb(g)) return []
  return fristenVon(g, heute).filter((f) => (f.art === "stk" || f.art === "mtk") && f.lage === "ueberfaellig").map((f) => ({ art: f.art, naechste: f.naechste }))
}

/**
 * Zahlen für den Wochenüberblick (Geräte nicht außer Betrieb): ueberfaellig = Geräte mit einer
 * überfälligen Frist oder offener Erstprüfung; bald = übrige Geräte mit einer Frist heute oder bald.
 */
function wocheMpg(geraete, heute) {
  let bald = 0
  let ueberfaellig = 0
  for (const g of geraete || []) {
    if (!g || ausserBetrieb(g)) continue
    const f = fristenVon(g, heute)
    if (f.some((x) => x.lage === "ueberfaellig" || (x.art === "pruefung" && x.lage === "offen"))) ueberfaellig++
    else if (f.some((x) => x.lage === "bald" || x.lage === "heute")) bald++
  }
  return { bald: bald, ueberfaellig: ueberfaellig }
}

// ── CIRS (Port von src/lib/cirs.ts) ─────────────────────────────────────────

function payloadLesen(roh) {
  if (roh && typeof roh === "object" && !Array.isArray(roh)) return roh
  if (typeof roh === "string" && roh.trim()) {
    try {
      const p = JSON.parse(roh)
      if (p && typeof p === "object" && !Array.isArray(p)) return p
    } catch (err) { /* kein JSON: wie leer */ }
  }
  return {}
}

const TAG_MUSTER = /^\d{4}-\d{2}-\d{2}$/
const PHASEN = ["neu", "bewertung", "massnahmen", "abgeschlossen", "kein_handlungsbedarf"]

function gueltigerTag(wert) {
  if (typeof wert !== "string" || !TAG_MUSTER.test(wert)) return false
  const t = wert.split("-").map(Number)
  const d = new Date(Date.UTC(t[0], t[1] - 1, t[2]))
  return t[0] >= 2000 && t[0] <= 2099 && d.getUTCMonth() === t[1] - 1 && d.getUTCDate() === t[2]
}

function istAbgeschlossen(phase) {
  return phase === "abgeschlossen" || phase === "kein_handlungsbedarf"
}

/** Zeitpunkt wie zeitpunkt() in cirs.ts. */
function zeitpunktMs(wert) {
  if (!wert) return NaN
  const s = String(wert)
  return parseZeit(s.indexOf(" ") >= 0 && s.indexOf("T") < 0 ? s.replace(" ", "T") : s)
}

/** Nur was die Frist bestimmt: Phase, Frist, Maßnahmen (frist, erledigtAm). Wie bearbeitungLesen. */
function bearbeitungLesen(payload, status) {
  const b = payload.bearbeitung
  const grund = { phase: status === "erledigt" ? "abgeschlossen" : "neu", frist: null, massnahmen: [] }
  if (!b || typeof b !== "object" || Array.isArray(b)) return grund
  let phase = PHASEN.indexOf(b.phase) >= 0 ? b.phase : grund.phase
  if (status === "erledigt" && !istAbgeschlossen(phase)) phase = "abgeschlossen"
  const massnahmen = []
  if (Array.isArray(b.massnahmen)) {
    for (const x of b.massnahmen) {
      if (!x || typeof x !== "object" || typeof x.id !== "string" || typeof x.text !== "string") continue
      massnahmen.push({ frist: gueltigerTag(x.frist) ? x.frist : undefined, erledigtAm: typeof x.erledigtAm === "string" && x.erledigtAm ? x.erledigtAm : undefined })
    }
  }
  return { phase: phase, frist: gueltigerTag(b.frist) ? b.frist : null, massnahmen: massnahmen }
}

/** Bearbeitung beim Anlegen zählt nicht (updated − created < 2000 ms), wie bearbeitungAus. */
function bearbeitungAus(rec) {
  const payload = payloadLesen(rec.payload)
  const angelegt = zeitpunktMs(rec.created)
  const geaendert = zeitpunktMs(rec.updated)
  const unveraendert = Number.isFinite(angelegt) && Number.isFinite(geaendert) && Math.abs(geaendert - angelegt) < 2000
  if (unveraendert && payload.bearbeitung !== undefined) {
    const rest = {}
    for (const k of Object.keys(payload)) if (k !== "bearbeitung") rest[k] = payload[k]
    return bearbeitungLesen(rest, rec.status === "erledigt" ? "offen" : rec.status)
  }
  return bearbeitungLesen(payload, rec.status)
}

/** Ist an der Meldung etwas überfällig (Frist oder offene Maßnahme vor heute)? heuteTag = "JJJJ-MM-TT". */
function cirsUeberfaellig(rec, heuteTag) {
  const b = bearbeitungAus(rec || {})
  if (istAbgeschlossen(b.phase)) return false
  const vorbei = (f) => !!f && /^\d{4}-\d{2}-\d{2}$/.test(f) && f < heuteTag
  if (vorbei(b.frist)) return true
  return b.massnahmen.some((m) => !m.erledigtAm && vorbei(m.frist))
}

module.exports = {
  INTERVALLE, VORWARNUNG, STK_HOECHSTENS, MTK_HOECHSTENS_JAHRE,
  intervallVon, tageVon, vorwarnungVon, kalendertagBerlin, tagBerlin, parseZeit, plusTage, plusMonate, monatsende, tageZwischen, naechstePruefung,
  monateVon, stkMonate, mtkJahre, naechsteStk, naechsteMtk, lageVon, fristenVon, ueberfaelligeKontrollen, wocheMpg,
  payloadLesen, gueltigerTag, bearbeitungAus, cirsUeberfaellig,
}
