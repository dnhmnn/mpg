// Einsätze aus der Dokumentation (Owner, 22.11.2026: „abhängig davon, dass ein Protokoll oder eine
// Produktausgabe abgeschickt wird, automatisch ein Einsatz“; Alamos nicht mehr). Rein und ohne PocketBase,
// damit es in vitest läuft (src/lib/__tests__/einsatzRegeln.test.ts). CommonJS, läuft ab PocketBase 0.23.4.
// Der Hook dazu: pb_hooks/einsaetze.pb.js.
//
// Ins Einsatz-Feld kommen nur Einsatznummer, Datum und Einsatzart, nie Namen, Adressen oder anderes aus
// dem Protokoll (Patientendaten bleiben im Protokoll).

/** Status neuer Einsätze aus der Dokumentation. Die Dokumentation kommt nach dem Einsatz: abgeschlossen. */
const STATUS_NEU = "abgeschlossen"
/** Wie weit zurück ein Einsatz mit derselben Nummer als derselbe gilt. */
const GLEICH_TAGE = 60
const NR_MAX = 60

function istObjekt(x) { return !!x && typeof x === "object" && !Array.isArray(x) }

/** payload als Objekt (PocketBase-JSON kann Text oder doppelt kodiert sein). */
function payloadLesen(p) {
  let x = p
  for (let i = 0; i < 2 && typeof x === "string"; i++) {
    try { x = JSON.parse(x) } catch (err) { return {} }
  }
  return istObjekt(x) ? x : {}
}

/** Einsatznummer zum Anzeigen: Rand weg, Leerraum zusammengezogen, höchstens 60 Zeichen. */
function nummerSauber(roh) {
  return String(roh == null ? "" : roh).replace(/\s+/g, " ").trim().slice(0, NR_MAX)
}

/** Schlüssel zum Vergleichen: ohne Leerzeichen, klein („2025 - 001“ und „2025-001“ sind gleich). */
function nummerSchluessel(roh) {
  return nummerSauber(roh).toLowerCase().replace(/\s+/g, "")
}

function text(x) { return typeof x === "string" ? x.trim() : (typeof x === "number" ? String(x) : "") }

/**
 * Was aus einem abgeschickten Datensatz in den Einsatz darf, oder null (keine Nummer).
 * patients: payload.einsatz_nr, Datum aus einsatz_datum, Art aus einsatz_art.
 * product_outputs: payload.einsatz, Datum aus payload.datum.
 */
function ausDatensatz(sammlung, payloadRoh, created) {
  const p = payloadLesen(payloadRoh)
  let nr = ""
  let datum = ""
  let art = ""
  if (sammlung === "patients") {
    nr = text(p.einsatz_nr)
    datum = text(p.einsatz_datum)
    art = text(p.einsatz_art)
  } else if (sammlung === "product_outputs") {
    nr = text(p.einsatz)
    datum = text(p.datum)
  } else {
    return null
  }
  nr = nummerSauber(nr)
  if (!nr) return null
  return { nummer: nr, datum: datumIso(datum, created), art: art.slice(0, 120) }
}

/** Datum des Einsatzes: ein gültiges YYYY-MM-DD (12 Uhr, damit die Zeitzone den Tag nicht verschiebt), sonst das Anlegen. */
function datumIso(datum, created) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(datum || ""))
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0))
    if (!isNaN(d.getTime()) && d.getUTCFullYear() > 2000 && d.getUTCFullYear() < 2200) return d.toISOString()
  }
  const c = new Date(String(created || "").replace(" ", "T"))
  return isNaN(c.getTime()) ? new Date().toISOString() : c.toISOString()
}

/** Gibt es schon einen Einsatz mit dieser Nummer? kandidaten: { id, unit } derselben Organisation. */
function vorhanden(kandidaten, nummer) {
  const s = nummerSchluessel(nummer)
  if (!s) return null
  for (const k of kandidaten || []) if (nummerSchluessel(k.unit) === s) return k
  return null
}

/** Ab wann ein Einsatz derselben Nummer gesucht wird (PocketBase-Zeit). */
function suchenAb(jetzt) {
  return new Date(jetzt - GLEICH_TAGE * 24 * 60 * 60 * 1000).toISOString().replace("T", " ")
}

module.exports = { STATUS_NEU, GLEICH_TAGE, NR_MAX, payloadLesen, nummerSauber, nummerSchluessel, ausDatensatz, datumIso, vorhanden, suchenAb }
