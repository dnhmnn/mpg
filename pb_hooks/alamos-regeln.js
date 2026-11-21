// Regeln für den Alamos-Eingang (pb_hooks/alamos.pb.js), rein und ohne PocketBase, damit sie
// in vitest laufen (src/lib/__tests__/alamosRegeln.test.ts). CommonJS, läuft ab PocketBase 0.23.4.
//
// Owner 21.11.2026: „Es ist verknüpft und ein Test kommt an, aber keine echten Einsätze.“ Was der alte
// Eingang falsch machte (am PocketBase 0.23.4 nachgestellt):
// - Ein Body mit Content-Type text/plain (oder ohne) lehnte PocketBase mit 400 ab, bevor der Hook ihn sah.
// - Schickt Alamos bei jedem Alarm dasselbe Feld "id", galt jeder weitere Alarm für immer als doppelt
//   und wurde still verworfen (Antwort 200, kein Einsatz).
// - Verschachtelte Angaben ({"data": {...}}) wurden nicht gelesen.

/** Wie lange ein gleicher Alarm (gleiche Nummer, gleiches Stichwort, gleicher Ort) als derselbe gilt. */
const DOPPELT_MIT_NUMMER_MS = 6 * 60 * 60 * 1000
/** Ohne Nummer: gleiches Stichwort und gleicher Ort kurz hintereinander (ein Aufruf je alarmierter Einheit). */
const DOPPELT_OHNE_NUMMER_MS = 10 * 60 * 1000
/** Größter Body, den der Eingang liest. */
const MAX_BODY = 512 * 1024

/** Verschachtelte Angaben, die zusätzlich gelesen werden (eine Ebene). */
const UNTER = ["data", "einsatz", "alarm", "alarmData", "parameters", "params", "payload", "message"]

const ALIAS = {
  unit: ["unit", "units", "einheit", "einheiten", "einheitenkennung", "unit_id", "unitName", "unit_name", "fahrzeug", "fahrzeuge", "vehicle", "vehicles", "alarmierteEinheiten"],
  keyword: ["keyword", "stichwort", "schlagwort", "einsatzstichwort", "keyword_description", "keywordDescription", "alarm", "einsatzart", "meldebild", "title", "subject", "message", "text"],
  adresse: ["adresse", "address", "einsatzort", "location", "fullAddress", "full_address", "einsatzadresse"],
  strasse: ["strasse", "straße", "street", "streetName"],
  hausnummer: ["hausnummer", "house", "houseNumber", "house_number", "nr"],
  stadt: ["ort", "stadt", "city", "gemeinde", "ortsteil", "district", "plz_ort"],
  nummer: ["alamos_id", "einsatznummer", "einsatz_nr", "einsatzNr", "einsatz_id", "externeNummer", "externalId", "external_id", "number", "nummer", "dbId", "id"],
  datum: ["datum", "alarmzeit", "alarmierung", "alarmTime", "alarm_time", "timestamp", "time", "zeit", "created", "date"],
}

function istObjekt(x) { return !!x && typeof x === "object" && !Array.isArray(x) }

/** Formular-Daten a=b&c=d lesen (wie application/x-www-form-urlencoded). */
function formularLesen(s) {
  const aus = {}
  for (const teil of s.split("&")) {
    if (!teil) continue
    const i = teil.indexOf("=")
    const k = i < 0 ? teil : teil.slice(0, i)
    const v = i < 0 ? "" : teil.slice(i + 1)
    try { aus[decodeURIComponent(k.replace(/\+/g, " "))] = decodeURIComponent(v.replace(/\+/g, " ")) } catch (err) { /* kaputte Kodierung: Teil weglassen */ }
  }
  return aus
}

/**
 * Den Body lesen, gleich welcher Content-Type: JSON (auch als text/plain), sonst Formular-Daten.
 * Gibt immer ein Objekt zurück und sagt, wie gelesen wurde.
 */
function bodyLesen(roh) {
  const s = String(roh == null ? "" : roh).replace(/^﻿/, "").trim()
  if (!s) return { body: {}, art: "leer" }
  if (s[0] === "{" || s[0] === "[") {
    try {
      const j = JSON.parse(s)
      if (istObjekt(j)) return { body: j, art: "json" }
      if (Array.isArray(j) && istObjekt(j[0])) return { body: j[0], art: "json-liste" }
    } catch (err) { /* weiter als Formular */ }
  }
  if (s.indexOf("=") > 0) return { body: formularLesen(s), art: "formular" }
  return { body: {}, art: "unbekannt" }
}

/** Eine Ebene verschachtelter Angaben dazunehmen; oben Stehendes gewinnt. */
function flach(body) {
  const aus = Object.assign({}, body)
  for (const k of UNTER) {
    const u = body[k]
    if (!istObjekt(u)) continue
    for (const kk of Object.keys(u)) if (aus[kk] === undefined || istObjekt(aus[kk])) aus[kk] = u[kk]
  }
  return aus
}

/** Wert als Text: Listen werden zu „a, b“, Objekte mit name/title zu diesem Namen. */
function alsText(v) {
  if (v === undefined || v === null) return ""
  if (Array.isArray(v)) return v.map(alsText).filter(Boolean).join(", ")
  if (istObjekt(v)) return alsText(v.name !== undefined ? v.name : v.title !== undefined ? v.title : v.address !== undefined ? v.address : "")
  return String(v).trim()
}

/** Erstes nicht leeres Feld; Namen ohne Rücksicht auf Groß- und Kleinschreibung. */
function waehlen(body, namen) {
  const klein = {}
  for (const k of Object.keys(body)) if (klein[k.toLowerCase()] === undefined) klein[k.toLowerCase()] = k
  for (const n of namen) {
    const k = body[n] !== undefined ? n : klein[n.toLowerCase()]
    if (k === undefined) continue
    const t = alsText(body[k])
    if (t) return t
  }
  return ""
}

/** Zeitpunkt lesen: ISO-Text, „YYYY-MM-DD HH:MM:SS“, Sekunden oder Millisekunden. Sonst jetzt. */
function datumLesen(roh, jetzt) {
  const s = String(roh == null ? "" : roh).trim()
  if (/^\d{9,10}$/.test(s)) return new Date(Number(s) * 1000).toISOString()
  if (/^\d{12,13}$/.test(s)) return new Date(Number(s)).toISOString()
  if (s) {
    const d = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(s) ? s.replace(" ", "T") : s)
    if (!isNaN(d.getTime())) return d.toISOString()
    // 21.11.2026 14:03 (deutsch, Ortszeit des Servers)
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s)
    if (m) {
      const d2 = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0))
      if (!isNaN(d2.getTime())) return d2.toISOString()
    }
  }
  return new Date(jetzt).toISOString()
}

/** Die Angaben für einen Einsatz aus dem gelesenen Body. */
function alarmLesen(body, jetzt) {
  const b = flach(istObjekt(body) ? body : {})
  let adresse = waehlen(b, ALIAS.adresse)
  if (!adresse) {
    const strasse = [waehlen(b, ALIAS.strasse), waehlen(b, ALIAS.hausnummer)].filter(Boolean).join(" ")
    adresse = [strasse, waehlen(b, ALIAS.stadt)].filter(Boolean).join(", ")
  }
  return {
    unit: waehlen(b, ALIAS.unit).slice(0, 500),
    keyword: waehlen(b, ALIAS.keyword).slice(0, 500),
    adresse: adresse.slice(0, 1000),
    nummer: waehlen(b, ALIAS.nummer).slice(0, 200),
    datum: datumLesen(waehlen(b, ALIAS.datum), jetzt),
  }
}

/** Nur die Namen der Felder (für das Log: nie Werte wie Adressen oder Stichworte). */
function feldNamen(body) {
  const b = flach(istObjekt(body) ? body : {})
  return Object.keys(b).filter((k) => !istObjekt(b[k])).slice(0, 40)
}

const gleich = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase()

/**
 * Ist dieser Alarm schon angelegt? kandidaten: Einsätze derselben Organisation der letzten Stunden
 * ({ id, alamos_id, keyword, adresse, created }). Mit Nummer: gleiche Nummer, gleiches Stichwort und
 * gleicher Ort in 6 Stunden. Ohne: gleiches Stichwort und gleicher Ort in 10 Minuten. Eine gleiche
 * Nummer allein reicht nie (manche Alamos-Einstellungen schicken immer dieselbe).
 */
function doppelt(kandidaten, alarm, jetzt) {
  for (const k of kandidaten || []) {
    const alter = jetzt - new Date(String(k.created || "").replace(" ", "T")).getTime()
    if (!(alter >= 0)) continue
    if (!gleich(k.keyword, alarm.keyword) || !gleich(k.adresse, alarm.adresse)) continue
    if (alarm.nummer) {
      if (gleich(k.alamos_id, alarm.nummer) && alter <= DOPPELT_MIT_NUMMER_MS) return k
    } else if (alter <= DOPPELT_OHNE_NUMMER_MS) {
      return k
    }
  }
  return null
}

/** Einheiten zusammenführen, wenn derselbe Alarm für eine weitere Einheit kommt. */
function einheitenDazu(bisher, neu) {
  const liste = String(bisher || "").split(",").map((x) => x.trim()).filter((x) => x && x !== "Unbekannt")
  for (const n of String(neu || "").split(",").map((x) => x.trim()).filter(Boolean)) {
    if (!liste.some((x) => gleich(x, n))) liste.push(n)
  }
  return liste.join(", ").slice(0, 500)
}

/** Query-Parameter eines GET-Aufrufs (aPager PRO ohne „HTTP POST statt GET“, AMweb) als Body. */
function queryLesen(q) {
  const aus = {}
  for (const k of Object.keys(q || {})) {
    const v = q[k]
    aus[k] = Array.isArray(v) ? String(v[0] == null ? "" : v[0]) : String(v == null ? "" : v)
  }
  return aus
}

/** Taugt ein GET-Aufruf für einen Einsatz? Ohne Einheit und Stichwort nicht (Browser, Vorschau, AMweb „kein Alarm mehr“). */
function getTaugt(alarm) {
  return !!(alarm.unit || alarm.keyword)
}

/**
 * Den Alarm verarbeiten (beide Routen): Organisation prüfen, Doppelte erkennen, Einsatz anlegen, eine Zeile ins Log.
 * app: $app; neuerRecord: (collection) => new Record(collection); gibt { status, json } zurück.
 */
function eingang(app, orgId, gelesen, ct, jetzt, neuerRecord, methode) {
  const kurz = String(orgId || "").slice(0, 6)
  if (!orgId) return { status: 400, json: { success: false, error: "organization_id fehlt in der URL" } }
  try { app.findRecordById("organizations", orgId) } catch (err) {
    app.logger().warn("[alamos] unbekannte Organisation", "org", kurz, "methode", methode)
    return { status: 404, json: { success: false, error: "Unbekannte organization_id: " + orgId } }
  }
  const alarm = alarmLesen(gelesen.body, jetzt)
  const felder = feldNamen(gelesen.body).join(",")
  if (methode === "GET" && !getTaugt(alarm)) {
    app.logger().info("[alamos] ohne Angaben", "org", kurz, "methode", methode, "felder", felder)
    return { status: 200, json: { success: false, hinweis: "Kein Einsatz angelegt: unit oder keyword fehlt." } }
  }
  let kandidaten = []
  try {
    const seit = new Date(jetzt - DOPPELT_MIT_NUMMER_MS).toISOString().replace("T", " ")
    const recs = app.findRecordsByFilter("einsaetze", "organization_id = {:org} && created >= {:seit}", "-created", 50, 0, { org: orgId, seit: seit })
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i]
      kandidaten.push({ id: r.id, alamos_id: r.getString("alamos_id"), keyword: r.getString("keyword"), adresse: r.getString("adresse"), created: r.getString("created"), unit: r.getString("unit") })
    }
  } catch (err) {
    kandidaten = []
  }
  const schon = doppelt(kandidaten, alarm, jetzt)
  if (schon) {
    try {
      const neu = einheitenDazu(schon.unit, alarm.unit)
      if (neu && neu !== schon.unit) {
        const rec = app.findRecordById("einsaetze", schon.id)
        rec.set("unit", neu)
        app.save(rec)
      }
    } catch (err) { /* Einheit nicht ergänzt, der Einsatz steht trotzdem */ }
    app.logger().info("[alamos] doppelt", "org", kurz, "methode", methode, "art", gelesen.art, "contentType", String(ct).slice(0, 60), "felder", felder)
    return { status: 200, json: { success: true, duplicate: true, id: schon.id } }
  }
  try {
    const record = neuerRecord(app.findCollectionByNameOrId("einsaetze"))
    record.set("unit", alarm.unit || "Unbekannt")
    record.set("keyword", alarm.keyword)
    record.set("adresse", alarm.adresse)
    record.set("datum", alarm.datum)
    record.set("status", "aktiv")
    record.set("organization_id", orgId)
    record.set("alamos_id", alarm.nummer)
    app.save(record)
    app.logger().info("[alamos] neu", "org", kurz, "methode", methode, "art", gelesen.art, "contentType", String(ct).slice(0, 60), "felder", felder,
      "stichwort", alarm.keyword ? "ja" : "fehlt", "ort", alarm.adresse ? "ja" : "fehlt")
    return { status: 200, json: { success: true, id: record.id } }
  } catch (err) {
    app.logger().error("[alamos] nicht angelegt", "org", kurz, "methode", methode, "art", gelesen.art, "felder", felder, "fehler", String(err).slice(0, 300))
    return { status: 500, json: { success: false, error: String(err && err.message || err) } }
  }
}

module.exports = {
  DOPPELT_MIT_NUMMER_MS, DOPPELT_OHNE_NUMMER_MS, MAX_BODY, ALIAS,
  bodyLesen, flach, alarmLesen, datumLesen, feldNamen, doppelt, einheitenDazu, queryLesen, getTaugt, eingang,
}
