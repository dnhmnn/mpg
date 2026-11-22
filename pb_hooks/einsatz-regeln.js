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

/** Die vier Posten der Besatzung im Protokoll (Zwilling von POSTEN in src/pages/public/doku/besatzung.ts). */
const POSTEN = [
  { pos: "tf", feld: "mannschaft_tf", rolle: "Teamführer" },
  { pos: "m1", feld: "mannschaft_1", rolle: "" },
  { pos: "m2", feld: "mannschaft_2", rolle: "" },
  { pos: "m3", feld: "mannschaft_3", rolle: "" },
]

/**
 * Besatzung eines Protokolls mit Konto: [{ id, rolle }]. Wie besatzungLesen in der App: Der flache Name
 * gilt; die Kennung aus payload.mannschaft nur, wenn dort derselbe Name steht. Namen ohne Konto fallen weg
 * (einsatz_personen braucht ein Konto). Ob das Konto zur Organisation gehört, prüft der Hook.
 */
function besatzung(payloadRoh) {
  const w = payloadLesen(payloadRoh)
  const m = istObjekt(w.mannschaft) ? w.mannschaft : {}
  const aus = []
  for (const p of POSTEN) {
    const flach = typeof w[p.feld] === "string" ? w[p.feld].trim() : ""
    const e = istObjekt(m[p.pos]) ? m[p.pos] : null
    const name = e && typeof e.name === "string" ? e.name.trim() : ""
    const id = e && typeof e.id === "string" ? e.id : ""
    if (!name || !/^[a-z0-9]{15}$/.test(id)) continue
    if (flach && flach !== name) continue
    if (aus.some((x) => x.id === id)) continue
    aus.push({ id: id, rolle: p.rolle })
  }
  return aus
}

/**
 * Einsatz zum Datensatz finden oder (anlegen = true) anlegen; aus einem Protokoll kommt die Besatzung mit
 * Konto dazu (Owner 22.11.2026), nur Konten derselben Organisation, jede Person einmal.
 * app: $app; neuerRecord: (collection) => new Record(collection). Aufgerufen aus pb_hooks/einsaetze.pb.js
 * (die Rümpfe der Hooks sehen nichts, was in der Datei außerhalb steht).
 */
function ausDoku(app, rec, anlegen, neuerRecord) {
  const R = module.exports
  const sammlung = rec.collection().name
  const org = rec.getString("organization_id")
  const roh = rec.getString("payload")
  const daten = org ? R.ausDatensatz(sammlung, roh, rec.getString("created")) : null
  if (!daten) return
  let kandidaten = []
  try {
    const recs = app.findRecordsByFilter("einsaetze", "organization_id = {:org} && created >= {:ab}", "-created", 500, 0, { org: org, ab: R.suchenAb(Date.now()) })
    for (let i = 0; i < recs.length; i++) kandidaten.push({ id: recs[i].id, unit: recs[i].getString("unit") })
  } catch (err) {
    const recs = app.findRecordsByFilter("einsaetze", "organization_id = {:org}", "", 500, 0, { org: org })
    for (let i = 0; i < recs.length; i++) kandidaten.push({ id: recs[i].id, unit: recs[i].getString("unit") })
  }
  let einsatzId = ""
  const schon = R.vorhanden(kandidaten, daten.nummer)
  if (schon) {
    einsatzId = schon.id
    if (anlegen) app.logger().info("[einsatz] vorhanden", "aus", sammlung, "einsatz", einsatzId)
  } else if (anlegen) {
    const neu = neuerRecord(app.findCollectionByNameOrId("einsaetze"))
    neu.set("unit", daten.nummer)
    neu.set("keyword", daten.art)
    neu.set("adresse", "")
    neu.set("datum", daten.datum)
    neu.set("status", R.STATUS_NEU)
    neu.set("organization_id", org)
    neu.set("alamos_id", "")
    try {
      app.save(neu)
    } catch (err) {
      // Ältere Sammlungen haben Stichwort oder Ort als Pflicht (die alte Seite verlangte ein Stichwort):
      // dann „Einsatz <Nummer>“ und „–“, nie etwas aus dem Protokoll. scripts/einsaetze-einrichten.py hebt die Pflicht auf.
      if (!neu.getString("keyword")) neu.set("keyword", "Einsatz " + daten.nummer)
      if (!neu.getString("adresse")) neu.set("adresse", "–")
      app.save(neu)
    }
    einsatzId = neu.id
    app.logger().info("[einsatz] angelegt", "aus", sammlung, "einsatz", einsatzId)
  }
  if (!einsatzId || sammlung !== "patients") return
  const leute = R.besatzung(roh)
  if (!leute.length) return
  let col = null
  try { col = app.findCollectionByNameOrId("einsatz_personen") } catch (err) { return }
  let dazu = 0
  for (let i = 0; i < leute.length; i++) {
    const p = leute[i]
    try {
      const u = app.findRecordById("users", p.id)
      if (u.getString("organization_id") !== org) continue
    } catch (err) { continue }
    try {
      app.findFirstRecordByFilter("einsatz_personen", "einsatz_id = {:e} && user_id = {:u}", { e: einsatzId, u: p.id })
      continue
    } catch (err) { /* noch nicht da */ }
    const ep = neuerRecord(col)
    ep.set("einsatz_id", einsatzId)
    ep.set("user_id", p.id)
    ep.set("rolle", p.rolle)
    app.save(ep)
    dazu++
  }
  if (dazu) app.logger().info("[einsatz] Besatzung", "einsatz", einsatzId, "dazu", dazu)
}

module.exports = { STATUS_NEU, GLEICH_TAGE, NR_MAX, POSTEN, payloadLesen, nummerSauber, nummerSchluessel, ausDatensatz, datumIso, vorhanden, suchenAb, besatzung, ausDoku }
