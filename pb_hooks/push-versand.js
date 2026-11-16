// Push-Benachrichtigungen: Ein- und Ausgabe (Datenbank, Speicher, Dienst).
//
// Kein *.pb.js: push.pb.js lädt die Datei per require() im Handler und übergibt alles, was sie
// braucht, in U (Umgebung) und R (push-regeln.js), F (push-fristen.js), L (lager-regeln.js):
//   U = { app, http, security, os, store, Record, jetztMs, imTakt, abbrechenNach, log }
// So läuft sie isoliert in jedem Handler (die JSVM teilt nichts zwischen Handlern).
//
// Grundsätze (Bauplan Push, 1.1, 2, 3.2, 4.5):
// - Die Warteschlange speichert nur Anlass und Kennungen, nie Text. Texte entstehen erst beim
//   Zustellen (inhaltBauen), nachdem der Gegenstand neu geprüft ist.
// - Namen kommen nur aus den Stammdaten über die Kennung und aus derselben Organisation.
// - Patientenprotokolle: gelesen werden nur id, organization_id, created, status,
//   absender_status und payload.absender.id; nie title oder anderes aus payload.
// - CIRS: nur payload.kategorie, und nur aus dem festen Katalog.
// - Hooks und Routen warten höchstens 1 s auf den Dienst; ist er kürzlich gescheitert
//   (Schutzschalter offen), reihen sie nur ein. Der Takt versucht es immer (3 s).
// - Logs nie mit Inhalt, Endpoint oder Schlüssel; nur Anlass, Anzahl, Org-Kennung, Status.

const SAMMLUNGEN = ["push_geraete", "push_warteschlange", "push_merker"]
const FELDER = [["users", "push_einstellungen"], ["organizations", "push_anlaesse"]]
/** Nur diese Spalten schreibt spalteSchreiben (nie aus der Anfrage). */
const SPALTEN = { "users.push_einstellungen": true, "organizations.push_anlaesse": true }
const KENNUNG_RE = /^[a-z0-9]{15}$/
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
/** Grund einer Sperre als Code in der Warteschlange (nie Text). */
const GRUND_CODE = { "STK nicht bestanden": "stk", "MTK nicht bestanden": "mtk", "Prüfung nicht bestanden": "pruefung", "Defekt gemeldet": "defekt", "Meldung von außen bestätigt": "meldung", "von Hand gesperrt": "hand" }
const GRUND_TEXT = { stk: "STK nicht bestanden", mtk: "MTK nicht bestanden", pruefung: "Prüfung nicht bestanden", defekt: "Defekt gemeldet", meldung: "Meldung von außen bestätigt", hand: "von Hand gesperrt" }
const STATUSFELD = { patients: "absender_status", product_outputs: "absender_status", form_submissions: "absender_status", mpg_defect_reports: "reporter_status" }
const LISTE_MAX = 10

/**
 * store.setFunc gibt es erst in neueren PocketBase-Versionen; auf dem Server des Owners fehlte es
 * (16.11.2026, „Object has no member 'setFunc'“). Ohne setFunc: lesen, rechnen, schreiben. Das ist
 * nicht atomar: Drossel und Zähler können bei gleichzeitigen Anfragen um eins danebenliegen. Den
 * Doppelschutz der Nachrichten halten ohnehin Datenbank (eindeutige Indizes) und Dienst.
 */
function speicherSetzen(store, schluessel, fn) {
  if (store && typeof store.setFunc === "function") { store.setFunc(schluessel, fn); return }
  store.set(schluessel, fn(store.get(schluessel)))
}

/** Abbruch mitten im Morgenlauf (nur Prüfbetrieb, abbrechenNach). */
const ABBRUCH = "push:abbruch"

// ── Umgebung ────────────────────────────────────────────────────────────────

/** U bauen. o = { app, http, security, os, Record, imTakt, jetztMs?, abbrechenNach? }. */
function umgebung(o) {
  const app = o.app
  const U = {
    app: app, http: o.http, security: o.security, os: o.os, Record: o.Record,
    store: app.store(), imTakt: !!o.imTakt,
    jetztMs: Number.isFinite(o.jetztMs) ? o.jetztMs : Date.now(),
    abbrechenNach: o.abbrechenNach || "",
  }
  U.log = (stufe, text, daten) => {
    const args = ["[push] " + text]
    const d = daten || {}
    for (const k of Object.keys(d)) { args.push(k); args.push(typeof d[k] === "object" ? JSON.stringify(d[k]) : d[k]) }
    try { const l = app.logger(); (l[stufe] || l.info).apply(l, args) } catch (err) { /* ohne Log */ }
  }
  return U
}

function zufall(U, n) {
  return U.security.randomStringWithAlphabet(n || 15, ALPHABET)
}

function liste(x) {
  const a = []
  if (!x) return a
  for (const r of x) a.push(r)
  return a
}

function istObjekt(x) {
  return !!x && typeof x === "object" && !Array.isArray(x)
}

function jsonWert(rec, feld) {
  try {
    let v = JSON.parse(rec.getString(feld) || "null")
    if (typeof v === "string") {
      try { const w = JSON.parse(v); if (w && typeof w === "object") v = w } catch (err) { /* Text bleibt */ }
    }
    return v
  } catch (err) {
    return null
  }
}

function zeitMs(text) {
  const t = Date.parse(String(text || "").trim().replace(" ", "T"))
  return Number.isFinite(t) ? t : NaN
}

function pbZeit(ms) {
  return new Date(ms).toISOString().replace("T", " ")
}

/** true genau einmal je abstandMs (0: je Start). */
function einmalJe(U, schluessel, abstandMs) {
  let ja = false
  const t = U.jetztMs
  speicherSetzen(U.store, "push:log:" + schluessel, (alt) => {
    if (alt && (abstandMs === 0 || Number(alt.ende) > t)) return alt
    ja = true
    return { ende: abstandMs === 0 ? 8640000000000000 : t + abstandMs }
  })
  return ja
}

function sammlungDa(U, name) {
  try { return !!U.app.findCollectionByNameOrId(name) } catch (err) { return false }
}

function feldDa(U, sammlung, feld) {
  try { return !!U.app.findCollectionByNameOrId(sammlung).fields.getByName(feld) } catch (err) { return false }
}

function feldVersteckt(U, sammlung, feld) {
  try { return U.app.findCollectionByNameOrId(sammlung).fields.getByName(feld).hidden === true } catch (err) { return false }
}

// ── Konfiguration ───────────────────────────────────────────────────────────

function konfiguration(U) {
  const env = (k) => { try { return String(U.os.getenv(k) || "").trim() } catch (err) { return "" } }
  const url = (env("RESPONDA_PUSH_URL") || "http://127.0.0.1:8095").replace(/\/+$/, "")
  const geheimnis = env("RESPONDA_PUSH_GEHEIMNIS")
  const schluessel = env("RESPONDA_PUSH_SCHLUESSEL")
  const testzeit = env("RESPONDA_PUSH_TESTZEIT") === "1"
  const testRoh = env("RESPONDA_PUSH_TEST_HOSTS")
  const testHosts = testzeit && testRoh ? testRoh.split(",").map((s) => s.trim()).filter((s) => /^127\.0\.0\.1:[0-9]{2,5}$/.test(s)) : []
  const geheimnisOk = geheimnis.length >= 32
  const schluesselOk = /^B[A-Za-z0-9_-]{86}$/.test(schluessel)
  return {
    url: url, geheimnis: geheimnisOk ? geheimnis : "", schluessel: schluesselOk ? schluessel : "",
    geheimnisOk: geheimnisOk, schluesselOk: schluesselOk, eingerichtet: geheimnisOk && schluesselOk,
    testzeit: testzeit, testHosts: testHosts, testHostsGesetzt: !!testRoh,
  }
}

/** Was fehlt, damit Push arbeitet: Sammlungen, Felder, Geheimnis, öffentlicher Schlüssel. */
function eingerichtet(U) {
  const fehlt = []
  for (const s of SAMMLUNGEN) if (!sammlungDa(U, s)) fehlt.push(s)
  for (const f of FELDER) if (!feldDa(U, f[0], f[1])) fehlt.push(f[0] + "." + f[1])
  const k = konfiguration(U)
  if (!k.geheimnisOk) fehlt.push("dienst")
  if (!k.schluesselOk) fehlt.push("schluessel")
  return { ok: fehlt.length === 0, fehlt: fehlt }
}

/** Auslöser (Hooks und Takt): eingerichtet? Sonst einmal je Start eine Warnung. */
function bereit(U) {
  const e = eingerichtet(U)
  if (!e.ok && einmalJe(U, "nicht_eingerichtet", 0)) U.log("warn", "Push ist nicht eingerichtet, Auslöser tun nichts", { fehlt: e.fehlt.join(",") })
  return e.ok
}

// ── Laden ───────────────────────────────────────────────────────────────────

function personAusRecord(R, rec) {
  if (!rec) return null
  let sammlung = ""
  try { sammlung = rec.collection().name } catch (err) { sammlung = "" }
  const obj = (f) => { const v = jsonWert(rec, f); return istObjekt(v) ? v : {} }
  return {
    id: rec.id,
    sammlung: sammlung,
    name: rec.getString("name"),
    role: rec.getString("role"),
    supervisor: rec.getBool("supervisor"),
    disabled: rec.getBool("disabled"),
    expires_at: rec.getString("expires_at"),
    organization_id: rec.getString("organization_id"),
    permissions: obj("permissions"),
    temp_permissions: obj("temp_permissions"),
    push: R.personEinstellungenLesen(jsonWert(rec, "push_einstellungen")),
  }
}

function orgAusRecord(R, rec) {
  return {
    id: rec.id,
    org_name: rec.getString("org_name"),
    is_active: rec.getBool("is_active"),
    freigeschaltet: jsonWert(rec, "freigeschaltet"),
    push: R.orgEinstellungenLesen(jsonWert(rec, "push_anlaesse")),
  }
}

function orgLaden(U, R, orgId) {
  if (!orgId) return null
  try { return orgAusRecord(R, U.app.findRecordById("organizations", orgId)) } catch (err) { return null }
}

/** Aktive Konten der Organisation (Rückfall wie mitgliederLaden; die Regeln filtern noch einmal). */
function personenLaden(U, R, orgId) {
  if (!orgId) return []
  let l
  try {
    l = U.app.findRecordsByFilter("users", "organization_id = {:o} && disabled != true && (expires_at = '' || expires_at > @now)", "", 0, 0, { o: orgId })
  } catch (err) {
    try { l = U.app.findRecordsByFilter("users", "organization_id = {:o}", "", 0, 0, { o: orgId }) } catch (err2) { l = [] }
  }
  return liste(l).map((r) => personAusRecord(R, r))
}

function personLaden(U, R, userId) {
  if (!userId) return null
  try { return personAusRecord(R, U.app.findRecordById("users", userId)) } catch (err) { return null }
}

function geraetAusRecord(rec) {
  return {
    id: rec.id, user_id: rec.getString("user_id"), organization_id: rec.getString("organization_id"),
    endpoint: rec.getString("endpoint"), endpoint_hash: rec.getString("endpoint_hash"),
    p256dh: rec.getString("p256dh"), auth: rec.getString("auth"), geraet: rec.getString("geraet"),
    gemeldet_am: rec.getString("gemeldet_am"), created: rec.getString("created"),
  }
}

/** Geräte je Person: { userId: [geraet] }, Filter in Blöcken zu 50. */
function geraeteLaden(U, userIds) {
  const aus = {}
  const ids = []
  const gesehen = {}
  for (const id of userIds || []) if (id && !gesehen[id]) { gesehen[id] = true; ids.push(id) }
  for (let i = 0; i < ids.length; i += 50) {
    const block = ids.slice(i, i + 50)
    const p = {}
    const teile = block.map((id, j) => { p["u" + j] = id; return "user_id = {:u" + j + "}" })
    let l = []
    try { l = liste(U.app.findRecordsByFilter("push_geraete", teile.join(" || "), "created", 0, 0, p)) } catch (err) { l = [] }
    for (const r of l) {
      const g = geraetAusRecord(r)
      if (!aus[g.user_id]) aus[g.user_id] = []
      aus[g.user_id].push(g)
    }
  }
  return aus
}

/** Datensatz in derselben Organisation, sonst null. */
function datensatz(U, sammlung, id, orgId) {
  if (!id) return null
  try {
    const r = U.app.findRecordById(sammlung, id)
    if (orgId && r.getString("organization_id") !== orgId) return null
    return r
  } catch (err) {
    return null
  }
}

function nameVon(U, sammlung, id, orgId, feld) {
  const r = datensatz(U, sammlung, id, orgId)
  return r ? r.getString(feld || "name") : ""
}

// ── Schreiben ───────────────────────────────────────────────────────────────

function neuerDatensatz(U, sammlung, werte) {
  const rec = new U.Record(U.app.findCollectionByNameOrId(sammlung))
  for (const k of Object.keys(werte)) rec.set(k, werte[k])
  U.app.save(rec)
  return rec
}

/** Merker anlegen; false, wenn es ihn schon gibt (eindeutiger Index auf schluessel). */
function beanspruchen(U, schluessel, art, orgId, bisMs, wert) {
  try {
    neuerDatensatz(U, "push_merker", {
      schluessel: String(schluessel).slice(0, 200), art: art, organization_id: orgId || "",
      wert: wert === undefined ? null : wert, bis: Number.isFinite(bisMs) ? pbZeit(bisMs) : "",
    })
    return true
  } catch (err) {
    return false
  }
}

function merkerDa(U, schluessel) {
  try { U.app.findFirstRecordByFilter("push_merker", "schluessel = {:s}", { s: schluessel }); return true } catch (err) { return false }
}

function merkerLoeschen(U, schluessel) {
  try { U.app.delete(U.app.findFirstRecordByFilter("push_merker", "schluessel = {:s}", { s: schluessel })); return true } catch (err) { return false }
}

/**
 * Nur diese eine Spalte schreiben (nie $app.save: ein ganzer Datensatz überschriebe eine
 * gleichzeitige Sperre, Rollen oder hub_apps mit dem eben gelesenen Stand).
 */
function spalteSchreiben(U, R, tabelle, spalte, id, wert, maxBytes) {
  if (!SPALTEN[tabelle + "." + spalte]) return false
  if (!KENNUNG_RE.test(String(id || ""))) return false
  const json = JSON.stringify(wert)
  if (R.utf8Laenge(json) > maxBytes) return false
  const n = U.app.db().newQuery("UPDATE `" + tabelle + "` SET `" + spalte + "` = {:v} WHERE id = {:id}").bind({ v: json, id: id }).execute().rowsAffected()
  return n === 1
}

function ausfuehren(U, sql, werte) {
  try { return U.app.db().newQuery(sql).bind(werte || {}).execute().rowsAffected() } catch (err) {
    U.log("error", "Datenbank-Anweisung gescheitert", { fehler: String(err).slice(0, 200) })
    return 0
  }
}

function loeschenNachId(U, sammlung, ids) {
  let n = 0
  for (const id of ids || []) {
    if (!KENNUNG_RE.test(String(id))) continue
    n += ausfuehren(U, "DELETE FROM `" + sammlung + "` WHERE id = {:id}", { id: id })
  }
  return n
}

// ── Schutzschalter und Dienst ───────────────────────────────────────────────

function schutzschalter(U, R, ereignis) {
  let wert = null
  if (ereignis) speicherSetzen(U.store, "push:dienst", (alt) => { wert = R.schutzschalterNeu(alt, ereignis, U.jetztMs); return wert })
  else wert = U.store.get("push:dienst") || null
  return { offen: R.schutzschalterOffen(wert, U.jetztMs), wert: wert }
}

function antwortJson(res) {
  try { if (res.json && typeof res.json === "object") return res.json } catch (err) { /* weiter */ }
  try { return JSON.parse(String(res.raw || "")) } catch (err) { return null }
}

/**
 * POST /v1/senden. Hooks und Routen nur bei geschlossenem Schutzschalter, der Takt immer.
 * { ok, status, angenommen, doppelt, abgelehnt, netz, offen, wiederholen, nichtEingerichtet }.
 */
function dienstSenden(U, R, nachrichten, timeoutS) {
  const k = konfiguration(U)
  const leer = { ok: true, status: 202, angenommen: 0, doppelt: 0, abgelehnt: [], netz: false, offen: false, wiederholen: false }
  if (!k.eingerichtet) return { ok: false, status: 0, nichtEingerichtet: true, wiederholen: false, angenommen: 0, doppelt: 0, abgelehnt: [] }
  if (!nachrichten || !nachrichten.length) return leer
  if (!U.imTakt && schutzschalter(U, R, null).offen) return { ok: false, status: 0, offen: true, wiederholen: true, angenommen: 0, doppelt: 0, abgelehnt: [] }
  const erg = { ok: true, status: 202, angenommen: 0, doppelt: 0, abgelehnt: [], netz: false, offen: false, wiederholen: false }
  for (let i = 0; i < nachrichten.length; i += R.GRENZEN.nachrichtenJeAuftrag) {
    const teil = nachrichten.slice(i, i + R.GRENZEN.nachrichtenJeAuftrag)
    let res
    try {
      res = U.http.send({
        url: k.url + "/v1/senden", method: "POST",
        body: JSON.stringify({ auftrag: zufall(U, 15), nachrichten: teil }),
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + k.geheimnis },
        timeout: timeoutS,
      })
    } catch (err) {
      schutzschalter(U, R, "fehler")
      U.log("warn", "Push-Dienst nicht erreicht", { nachrichten: teil.length, fehler: String(err).replace(/https?:\/\/[^ "]+/g, "<url>").slice(0, 120) })
      return { ok: false, status: 0, netz: true, wiederholen: true, angenommen: erg.angenommen, doppelt: erg.doppelt, abgelehnt: erg.abgelehnt }
    }
    const status = Number(res.statusCode) || 0
    if (status === 202 || status === 200) {
      schutzschalter(U, R, "ok")
      const j = antwortJson(res) || {}
      erg.angenommen += Number(j.angenommen) || 0
      erg.doppelt += Number(j.doppelt) || 0
      const ab = Array.isArray(j.abgelehnt) ? j.abgelehnt : liste(j.abgelehnt)
      for (const a of ab) if (a && a.id) erg.abgelehnt.push({ id: String(a.id), grund: String(a.grund || "") })
      continue
    }
    if (status === 401 || status === 503 || status >= 500) {
      schutzschalter(U, R, "fehler")
      if (status !== 401 || einmalJe(U, "dienst_401", 3600000)) U.log("warn", "Push-Dienst lehnt ab", { status: status, nachrichten: teil.length })
      return { ok: false, status: status, wiederholen: true, angenommen: erg.angenommen, doppelt: erg.doppelt, abgelehnt: erg.abgelehnt }
    }
    U.log("error", "Push-Dienst: Anfrage ungültig (Fehler im Code)", { status: status, nachrichten: teil.length })
    return { ok: false, status: status, wiederholen: false, angenommen: erg.angenommen, doppelt: erg.doppelt, abgelehnt: erg.abgelehnt }
  }
  // Abgelehnte Abos: endpoint oder keys → Gerät löschen (gleiche Prüfung wie hier); sonst nur Log
  const weg = []
  const andere = {}
  for (const a of erg.abgelehnt) {
    if (a.grund === "endpoint" || a.grund === "keys") weg.push(a.id)
    else andere[a.grund] = (andere[a.grund] || 0) + 1
  }
  if (weg.length) {
    const n = loeschenNachId(U, "push_geraete", weg)
    U.log("info", "Abgelehnte Abos gelöscht", { anzahl: n })
  }
  if (Object.keys(andere).length) U.log("warn", "Push-Dienst lehnte Nachrichten ab", { gruende: andere })
  return erg
}

/** GET/POST an den Dienst für Diagnose und Rückmeldungen. */
function dienstAnfrage(U, methode, pfad, mitGeheimnis, timeoutS) {
  const k = konfiguration(U)
  const kopf = { "Content-Type": "application/json" }
  if (mitGeheimnis) kopf.Authorization = "Bearer " + k.geheimnis
  try {
    const res = U.http.send({ url: k.url + pfad, method: methode, body: methode === "POST" ? "{}" : "", headers: kopf, timeout: timeoutS })
    return { status: Number(res.statusCode) || 0, json: antwortJson(res) }
  } catch (err) {
    return { status: 0, json: null }
  }
}

// ── Nachrichten ─────────────────────────────────────────────────────────────

/** Eine Nachricht je Gerät (1.1): Schlüssel, Abo, Payload, feste TTL und Dringlichkeit, Topic nur für Zustände. */
function nachrichtenFuer(U, R, geraete, eintragSchl, inhalt, anlassKey, userId) {
  const k = konfiguration(U)
  const payload = R.payloadBauen({ titel: inhalt.titel, text: inhalt.text, url: inhalt.url, tag: inhalt.tag, anlass: anlassKey, fuer: userId, zeitMs: U.jetztMs })
  const topic = R.topicBauen((d, g) => U.security.hs256(d, g), k.geheimnis, userId, payload.tag)
  return (geraete || []).map((g) => {
    const n = { id: g.id, schluessel: R.nachrichtSchluessel(eintragSchl, g.id), abo: { endpoint: g.endpoint, keys: { p256dh: g.p256dh, auth: g.auth } }, payload: payload, ttl: R.TTL_EINHEIT, urgency: R.DRINGLICHKEIT_EINHEIT }
    if (topic) n.topic = topic
    return n
  })
}

function sha(U) {
  return (t) => U.security.sha256(t)
}

// ── Warteschlange ───────────────────────────────────────────────────────────

function kontextBegrenzen(R, kontext) {
  let k = kontext || {}
  if (R.utf8Laenge(JSON.stringify(k)) <= 1000) return k
  k = JSON.parse(JSON.stringify(k))
  for (const f of ["geraete", "paare", "artikel"]) if (Array.isArray(k[f])) k[f] = k[f].slice(0, 3)
  return R.utf8Laenge(JSON.stringify(k)) <= 1000 ? k : { q: k.q || "", id: k.id || "" }
}

/**
 * Eintrag anlegen: { userId, orgId, anlass, kontext, schluessel, grund, faelligMs, buendel?, versuche? }.
 * Nur Kennungen im kontext. Höchstens GRENZEN.warteJePerson Einträge (ruhe, drossel) je Person,
 * darüber zählt ein Eintrag „ueberlauf“ hoch. Derselbe Schlüssel wird nicht zweimal eingereiht.
 */
function einreihen(U, R, e) {
  try {
    try {
      U.app.findFirstRecordByFilter("push_warteschlange", "schluessel = {:s} && user_id = {:u}", { s: e.schluessel, u: e.userId })
      return "schon"
    } catch (err) { /* neu */ }
    if (e.grund === "ruhe" || e.grund === "drossel") {
      let n = 0
      try { n = liste(U.app.findRecordsByFilter("push_warteschlange", "user_id = {:u} && anlass != 'ueberlauf' && (grund = 'ruhe' || grund = 'drossel')", "", R.GRENZEN.warteJePerson + 1, 0, { u: e.userId })).length } catch (err) { n = 0 }
      if (n >= R.GRENZEN.warteJePerson) {
        let ue = null
        try { ue = U.app.findFirstRecordByFilter("push_warteschlange", "user_id = {:u} && anlass = 'ueberlauf'", { u: e.userId }) } catch (err) { ue = null }
        if (ue) {
          const k = jsonWert(ue, "kontext") || {}
          ue.set("kontext", { n: (Number(k.n) || 0) + 1 })
          U.app.save(ue)
        } else {
          neuerDatensatz(U, "push_warteschlange", {
            user_id: e.userId, organization_id: e.orgId || "", anlass: "ueberlauf", kontext: { n: 1 },
            schluessel: R.eintragSchluessel(sha(U), "ueberlauf", String(U.jetztMs) + ":" + zufall(U, 6), e.userId),
            grund: e.grund, faellig_am: pbZeit(e.faelligMs), versuche: 0, lauf: "", buendel: "",
          })
        }
        return "ueberlauf"
      }
    }
    neuerDatensatz(U, "push_warteschlange", {
      user_id: e.userId, organization_id: e.orgId || "", anlass: e.anlass, kontext: kontextBegrenzen(R, e.kontext),
      schluessel: e.schluessel, grund: e.grund || "", faellig_am: pbZeit(Number.isFinite(e.faelligMs) ? e.faelligMs : U.jetztMs),
      versuche: Number(e.versuche) || 0, lauf: "", buendel: e.buendel || "",
    })
    return "neu"
  } catch (err) {
    U.log("error", "Eintrag nicht eingereiht", { anlass: e.anlass, fehler: String(err).slice(0, 200) })
    return "fehler"
  }
}

/** Wartende ruhe-Einträge der Person neu planen (Route einstellungen). */
function ruheNeuPlanen(U, R, userId, personEinst) {
  const ende = R.ruheEnde(personEinst.ruhe, U.jetztMs)
  const faellig = ende === null ? U.jetztMs : ende
  return ausfuehren(U, "UPDATE push_warteschlange SET faellig_am = {:f} WHERE user_id = {:u} AND grund = 'ruhe'", { f: pbZeit(faellig), u: userId })
}

// ── Inhalte (Gegenstand neu prüfen, Text bauen) ─────────────────────────────

function payloadVon(rec) {
  const p = jsonWert(rec, "payload")
  return istObjekt(p) ? p : {}
}

/**
 * Den Gegenstand neu laden und prüfen, dann den Text bauen. null = entfallen.
 * Einziger Weg zu Texten, sofort wie aus der Warteschlange. orgId = Organisation des Eintrags.
 */
function inhaltBauen(U, R, anlassKey, kontext, jetztMs, orgId, F, opt) {
  const k = istObjekt(kontext) ? kontext : {}
  const frisch = !!(opt && opt.frisch)
  try {
    switch (anlassKey) {
      case "mitteilung": {
        const r = datensatz(U, "hub_notifications", k.id, orgId)
        if (!r || !r.getBool("active")) return null
        const org = orgLaden(U, R, orgId)
        return R.textMitteilung({ orgName: org ? org.org_name : "", titel: r.getString("title"), text: r.getString("message"), id: r.id })
      }
      case "unterschrift": {
        const sammlung = Object.prototype.hasOwnProperty.call(STATUSFELD, k.q) ? k.q : ""
        const r = sammlung ? datensatz(U, sammlung, k.id, orgId) : null
        if (!r || r.getString(STATUSFELD[sammlung]) !== "ausstehend") return null
        const o = { formular: k.f, id: r.id, angelegtMs: zeitMs(r.getString("created")) }
        if (sammlung === "product_outputs") {
          const p = payloadVon(r)
          o.positionen = Array.isArray(p.positionen) ? p.positionen.length : 0
        } else if (sammlung === "form_submissions") {
          o.vorlageTitel = nameVon(U, "form_templates", r.getString("template_id"), orgId, "title")
        } else if (sammlung === "mpg_defect_reports") {
          o.geraetName = nameVon(U, "mpg_devices", r.getString("device_id"), orgId)
        }
        return R.textUnterschrift(o)
      }
      case "protokoll_neu": {
        const r = datensatz(U, "patients", k.id, orgId)
        if (!r || r.getString("status") !== "offen") return null
        return R.textProtokollNeu({ angelegtMs: zeitMs(r.getString("created")), id: r.id })
      }
      case "mpg_gesperrt": {
        if (k.q === "mpg_frist") {
          if (!F) return null
          const tag = R.berlinTeile(jetztMs).tag
          const gueltig = []
          for (const x of Array.isArray(k.geraete) ? k.geraete : []) {
            const r = datensatz(U, "mpg_devices", x.id, orgId)
            if (!r) continue
            const g = geraetFelder(r)
            const offen = F.ueberfaelligeKontrollen(g, tag).filter((f) => f.art === x.art)
            if (offen.length) gueltig.push({ id: r.id, name: g.name, art: x.art, naechste: offen[0].naechste })
          }
          if (!gueltig.length) return null
          const t = R.textMpgFristen({ geraete: gueltig, tag: k.tag })
          return mitWeiteren(R, t, Number(k.n) - (Array.isArray(k.geraete) ? k.geraete.length : 0))
        }
        const gueltig = []
        for (const x of Array.isArray(k.geraete) ? k.geraete : []) {
          const r = datensatz(U, "mpg_devices", x.id, orgId)
          if (!r || r.getBool("operational") || String(r.getString("ausser_betrieb")).trim()) continue
          gueltig.push({ id: r.id, name: r.getString("name"), grund: GRUND_TEXT[x.g] || "" })
        }
        if (!gueltig.length) return null
        return R.textMpgGesperrt({ geraete: gueltig })
      }
      case "mpg_defekt": {
        if (k.q === "mpg_defect_reports") {
          const r = datensatz(U, "mpg_defect_reports", k.id, orgId)
          if (!r || r.getString("status") !== "pending") return null
          return R.textMpgDefekt({ quelle: "meldung", id: r.id, deviceName: nameVon(U, "mpg_devices", r.getString("device_id"), orgId), schwere: r.getString("severity") })
        }
        const r = datensatz(U, "mpg_defects", k.id, orgId)
        if (!r || r.getString("status") === "resolved") return null
        return R.textMpgDefekt({ quelle: "defekt", id: r.id, deviceName: nameVon(U, "mpg_devices", r.getString("device_id"), orgId), schwere: r.getString("severity") })
      }
      case "lager_mindestbestand": {
        const paare = Array.isArray(k.paare) ? k.paare : []
        const l = []
        for (const x of paare) {
          // Aus der Warteschlange: nur Paare, die noch unter Soll stehen (Merker da). Sofort: frisch geprüft.
          if (!frisch && !merkerDa(U, R.lagerSchluessel(orgId, x.i, x.l))) continue
          const item = nameVon(U, "inventory_items", x.i, orgId)
          if (!item) continue
          l.push({ item: item, ort: k.m ? nameVon(U, "inventory_locations", x.l, orgId) : "", ist: x.ist, soll: x.soll })
        }
        if (!l.length) return null
        return mitWeiteren(R, R.textLagerUnter(l, jetztMs), Number(k.n) - paare.length)
      }
      case "lager_abgelaufen": {
        const artikel = Array.isArray(k.artikel) ? k.artikel : []
        const l = []
        for (const x of artikel) {
          const r = datensatz(U, "inventory_items", x.i, orgId)
          if (!r) continue
          let arch = false
          try { arch = r.getBool("archiviert") } catch (err) { arch = false }
          if (arch) continue
          l.push({ item: r.getString("name"), datum: x.d })
        }
        if (!l.length) return null
        return mitWeiteren(R, R.textLagerAbgelaufen(l, k.tag), Number(k.n) - artikel.length)
      }
      case "produktausgabe": {
        const r = datensatz(U, "product_outputs", k.id, orgId)
        if (!r || r.getString("status") !== "offen") return null
        const p = payloadVon(r)
        const lagerId = typeof p.lager_id === "string" ? p.lager_id : ""
        return R.textProduktausgabe({ id: r.id, lagerName: lagerId ? nameVon(U, "inventory_locations", lagerId, orgId) : "", positionen: Array.isArray(p.positionen) ? p.positionen.length : 0, angelegtMs: zeitMs(r.getString("created")) })
      }
      case "einsendung": {
        const r = datensatz(U, "form_submissions", k.id, orgId)
        if (!r) return null
        return R.textEinsendung({ id: r.id, titel: nameVon(U, "form_templates", r.getString("template_id"), orgId, "title"), angelegtMs: zeitMs(r.getString("created")) })
      }
      case "cirs_neu": {
        const r = datensatz(U, "cirs_reports", k.id, orgId)
        if (!r) return null
        const p = payloadVon(r)
        return R.textCirsNeu({ id: r.id, kategorie: typeof p.kategorie === "string" ? p.kategorie : "" })
      }
      case "ausbildung": {
        const sammlung = k.q === "ausbildungen_einladungen" ? "ausbildungen_einladungen" : "ausbildungen_termine_user"
        const r = datensatz(U, sammlung, k.id, orgId)
        if (!r || r.getString("status") !== k.s) return null
        const terminId = r.getString("termin_id")
        const termin = datensatz(U, "ausbildungen_termine", terminId, orgId)
        if (!termin) return null
        const name = sammlung === "ausbildungen_einladungen" ? r.getString("name") : nameVon(U, "users", r.getString("teilnehmer_id"), orgId)
        const zusage = k.s === "zugesagt" || k.s === "zusagen"
        return R.textAusbildung({ terminId: terminId, antwortId: r.id, terminName: termin.getString("name"), startMs: zeitMs(termin.getString("start_datetime")), name: name, status: zusage ? "zugesagt" : "abgesagt" })
      }
      case "woche":
        return R.textWoche(istObjekt(k.woche) ? k.woche : {})
      case "probe":
        return R.textProbe()
    }
  } catch (err) {
    U.log("error", "Inhalt nicht gebaut", { anlass: anlassKey, fehler: String(err).slice(0, 200) })
  }
  return null
}

/** „und n weitere“ an den Text hängen (gekürzte Listen im kontext). */
function mitWeiteren(R, t, weitere) {
  const n = Math.floor(Number(weitere) || 0)
  if (n <= 0) return t
  return { titel: t.titel, text: R.kuerzen(t.text + " Und " + n + " weitere.", R.GRENZEN.text), url: t.url, tag: t.tag }
}

function textOderErster(v) {
  if (typeof v === "string") return v
  if (v && typeof v !== "string" && v.length !== undefined) { try { return String(v[0] || "") } catch (err) { return "" } }
  return v === undefined || v === null ? "" : String(v)
}

function zahlOderNull(v) {
  if (v === undefined || v === null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Felder eines Geräts für die Fristen (push-fristen.js). */
function geraetFelder(r) {
  let iv = ""
  try { iv = textOderErster(r.get("interval")) } catch (err) { iv = "" }
  const s = (f) => { try { return r.getString(f) } catch (err) { return "" } }
  const b = (f) => { try { return r.getBool(f) } catch (err) { return false } }
  const z = (f) => { try { return zahlOderNull(r.get(f)) } catch (err) { return null } }
  return {
    id: r.id, name: s("name"), interval: iv, last_inspection: s("last_inspection"),
    has_stk: b("has_stk"), last_stk: s("last_stk"), stk_interval_months: z("stk_interval_months"),
    has_mtk: b("has_mtk"), last_mtk: s("last_mtk"), mtk_interval_months: z("mtk_interval_months"),
    inbetriebnahme: s("inbetriebnahme"), ausser_betrieb: s("ausser_betrieb"), operational: b("operational"),
  }
}

// ── Zustellen ───────────────────────────────────────────────────────────────

function zahlen() {
  return { sofort: 0, spaeter: 0, ohneGeraet: 0, entfallen: 0, wiederholen: 0, empfaenger: 0 }
}

/**
 * Gesammelte Gruppen senden; scheitert es (Netz, 401, 503, Schutzschalter offen), je Gruppe
 * einreihen mit grund wiederholen und gleichem Schlüssel. gruppen: [{ userId, orgId, anlass,
 * kontext, schluessel, nachrichten }].
 */
function sendenOderEinreihen(U, R, gruppen, z) {
  const alle = []
  for (const g of gruppen) for (const n of g.nachrichten) alle.push(n)
  if (!alle.length) return
  const res = dienstSenden(U, R, alle, U.imTakt ? R.GRENZEN.dienstZeitTaktS : R.GRENZEN.dienstZeitHookS)
  if (res.ok) { z.sofort += gruppen.length; return }
  if (res.nichtEingerichtet || !res.wiederholen) return
  for (const g of gruppen) {
    const naechster = U.imTakt ? U.jetztMs + 60000 : U.jetztMs
    einreihen(U, R, { userId: g.userId, orgId: g.orgId, anlass: g.anlass, kontext: g.kontext, schluessel: g.schluessel, grund: "wiederholen", faelligMs: naechster, versuche: U.imTakt ? 1 : 0 })
    z.wiederholen++
  }
}

/**
 * Für alle Empfänger eines Anlasses: Rechte, Modul, Schalter, Geräte; Ruhezeit und Drossel;
 * sofort senden oder einreihen. auftrag = { anlass, orgId, kontext, ereignisKennung,
 * nurPersonen?, ausloeser?, ziel?, formular? }. Gibt Zahlen zurück.
 */
function zustellen(U, R, auftrag, F) {
  const z = zahlen()
  const org = orgLaden(U, R, auftrag.orgId)
  if (!org) { z.entfallen++; return z }
  const personen = auftrag.nurPersonen ? auftrag.nurPersonen.map((id) => personLaden(U, R, id)).filter((p) => !!p) : personenLaden(U, R, org.id)
  const kont = { ziel: auftrag.ziel, formular: auftrag.formular, ausloeser: auftrag.ausloeser }
  const empf = R.empfaengerFiltern(personen, org, auftrag.anlass, kont, U.jetztMs)
  z.empfaenger = empf.length
  if (!empf.length) return z
  const geraete = geraeteLaden(U, empf.map((p) => p.id))
  const mit = empf.filter((p) => (geraete[p.id] || []).length > 0)
  z.ohneGeraet = empf.length - mit.length
  if (!mit.length) return z
  const inhalt = inhaltBauen(U, R, auftrag.anlass, auftrag.kontext, U.jetztMs, org.id, F, { frisch: true })
  if (!inhalt) { z.entfallen += mit.length; return z }
  const gruppen = []
  for (const p of mit) {
    const schl = R.eintragSchluessel(sha(U), auftrag.anlass, auftrag.ereignisKennung, p.id)
    const eintrag = { userId: p.id, orgId: org.id, anlass: auftrag.anlass, kontext: auftrag.kontext, schluessel: schl }
    const za = R.zustellart(p.push, auftrag.anlass, U.jetztMs)
    if (za.art === "spaeter") {
      einreihen(U, R, Object.assign({}, eintrag, { grund: "ruhe", faelligMs: za.faellig }))
      z.spaeter++
      continue
    }
    if (auftrag.anlass !== "mitteilung") {
      let d = null
      speicherSetzen(U.store, "push:drossel:" + p.id, (alt) => { d = R.drossel(alt, U.jetztMs, R.GRENZEN.drosselMax, R.GRENZEN.drosselFensterMs); return d.neu })
      if (d && !d.erlaubt) {
        einreihen(U, R, Object.assign({}, eintrag, { grund: "drossel", faelligMs: d.faellig }))
        z.spaeter++
        continue
      }
    }
    gruppen.push(Object.assign({}, eintrag, { nachrichten: nachrichtenFuer(U, R, geraete[p.id], schl, inhalt, auftrag.anlass, p.id) }))
  }
  sendenOderEinreihen(U, R, gruppen, z)
  return z
}

// ── Takt: Warteschlange ─────────────────────────────────────────────────────

function eintragAusRecord(r) {
  return {
    rec: r, id: r.id, userId: r.getString("user_id"), orgId: r.getString("organization_id"), anlass: r.getString("anlass"),
    kontext: jsonWert(r, "kontext") || {}, schluessel: r.getString("schluessel"), grund: r.getString("grund"),
    versuche: Number(r.get("versuche")) || 0, buendel: r.getString("buendel"),
  }
}

function zurueckstellen(U, R, eintraege, z) {
  for (const e of eintraege) {
    const v = e.versuche + 1
    if (v > R.GRENZEN.versucheMax) {
      loeschenNachId(U, "push_warteschlange", [e.id])
      z.verworfen++
      continue
    }
    const faellig = U.jetztMs + Math.pow(2, v - 1) * 60000
    ausfuehren(U, "UPDATE push_warteschlange SET versuche = {:v}, faellig_am = {:f} WHERE id = {:id}", { v: v, f: pbZeit(faellig), id: e.id })
    z.zurueck++
  }
  if (z.verworfen) U.log("warn", "Einträge nach 5 Versuchen verworfen", { anzahl: z.verworfen })
}

/**
 * Fällige Einträge beanspruchen (eine Anweisung, SQLite atomar), neu prüfen, bündeln, senden.
 * Erfolg: löschen; Fehler: versuche + 1, später erneut (1, 2, 4, 8, 16 min), danach verwerfen.
 */
function warteschlangeAbarbeiten(U, R, F) {
  const z = { beansprucht: 0, gesendet: 0, entfallen: 0, verschoben: 0, zurueck: 0, verworfen: 0, alt: 0, buendel: 0 }
  z.alt = ausfuehren(U, "DELETE FROM push_warteschlange WHERE created < {:g}", { g: pbZeit(U.jetztMs - R.GRENZEN.warteMaxMs) })
  if (z.alt) U.log("info", "Alte Einträge (über 72 Stunden) gelöscht", { anzahl: z.alt })
  const lauf = zufall(U, 15)
  z.beansprucht = ausfuehren(U, "UPDATE push_warteschlange SET lauf = {:t}, faellig_am = {:spaeter} WHERE id IN (SELECT id FROM push_warteschlange WHERE faellig_am <= {:jetzt} ORDER BY faellig_am LIMIT 500)", {
    t: lauf, spaeter: pbZeit(U.jetztMs + R.GRENZEN.beanspruchtMs), jetzt: pbZeit(U.jetztMs),
  })
  if (!z.beansprucht) return z
  const recs = liste(U.app.findRecordsByFilter("push_warteschlange", "lauf = {:t}", "faellig_am", 0, 0, { t: lauf }))
  const jePerson = {}
  const reihe = []
  for (const r of recs) {
    const e = eintragAusRecord(r)
    if (!jePerson[e.userId]) { jePerson[e.userId] = []; reihe.push(e.userId) }
    jePerson[e.userId].push(e)
  }
  const geraete = geraeteLaden(U, reihe)
  const gruppen = []
  const weg = []
  for (const uid of reihe) {
    const es = jePerson[uid]
    const person = personLaden(U, R, uid)
    const org = person ? orgLaden(U, R, person.organization_id) : null
    if (!person || !R.aktiv(person, U.jetztMs) || !org || !org.is_active) { for (const e of es) weg.push(e.id); z.entfallen += es.length; continue }
    const g = geraete[uid] || []
    if (!g.length) { for (const e of es) weg.push(e.id); z.entfallen += es.length; continue }
    // Gerade (wieder) in Ruhezeit: auf das neue Ende verschieben (Mitteilung mit mitteilung_in_ruhe ausgenommen)
    const ende = R.ruheEnde(person.push.ruhe, U.jetztMs)
    const jetztFaellig = []
    for (const e of es) {
      if (ende !== null && !(e.anlass === "mitteilung" && person.push.mitteilung_in_ruhe !== false)) {
        ausfuehren(U, "UPDATE push_warteschlange SET faellig_am = {:f} WHERE id = {:id}", { f: pbZeit(ende), id: e.id })
        z.verschoben++
      } else jetztFaellig.push(e)
    }
    const gueltig = []
    let ueberlauf = []
    for (const e of jetztFaellig) {
      if (e.anlass === "ueberlauf") { ueberlauf.push(e); continue }
      if (e.orgId !== person.organization_id) { weg.push(e.id); z.entfallen++; continue }
      let darf
      if (e.anlass === "woche") {
        // Je Zeile Recht, Modul und Schalter neu prüfen (3.2); übrig bleiben nur erlaubte Zahlen
        const zeilen = R.wocheZeilen(istObjekt(e.kontext.woche) ? e.kontext.woche : {}, (key) => R.darfAnlass(person, org, key, {}, U.jetztMs) && R.anlassAn(org.push, person.push, key))
        e.kontext = { woche: zeilen }
        darf = Object.keys(zeilen).length > 0
      } else darf = R.darfAnlass(person, org, e.anlass, { ziel: uid, formular: e.kontext.f }, U.jetztMs) && R.anlassAn(org.push, person.push, e.anlass)
      if (!darf) { weg.push(e.id); z.entfallen++; continue }
      const inhalt = inhaltBauen(U, R, e.anlass, e.kontext, U.jetztMs, org.id, F)
      if (!inhalt) { weg.push(e.id); z.entfallen++; continue }
      e.inhalt = inhalt
      gueltig.push(e)
    }
    // Wiederholungen einzeln mit ihrem Schlüssel; gleiche buendel als dasselbe Bündel; Rest als neues Bündel
    const mitBuendel = {}
    const rest = []
    for (const e of gueltig) {
      if (e.grund === "wiederholen") gruppen.push({ eintraege: [e], schluessel: e.schluessel, nachrichten: nachrichtenFuer(U, R, g, e.schluessel, e.inhalt, e.anlass, uid) })
      else if (e.buendel) { if (!mitBuendel[e.buendel]) mitBuendel[e.buendel] = []; mitBuendel[e.buendel].push(e) }
      else rest.push(e)
    }
    const ueAlt = {}
    const ueNeu = []
    for (const u of ueberlauf) { if (u.buendel) ueAlt[u.buendel] = u; else ueNeu.push(u) }
    const buendelGruppe = (teile, ue, schluessel) => {
      const n = ue.reduce((s, u) => s + (Number(u.kontext.n) || 0), 0)
      const alle = teile.concat(ue)
      const grund = alle.length && alle.every((e) => e.grund === "drossel") ? "drossel" : "ruhe"
      const b = R.buendeln(teile.map((e) => Object.assign({}, e.inhalt, { anlass: e.anlass })), grund, U.jetztMs, n)
      const anlassKey = b.anlass || (teile[0] && teile[0].anlass) || "buendel"
      gruppen.push({ eintraege: teile.concat(ue), schluessel: schluessel, nachrichten: nachrichtenFuer(U, R, g, schluessel, b, anlassKey, uid) })
      z.buendel++
    }
    for (const b of Object.keys(mitBuendel)) buendelGruppe(mitBuendel[b], ueAlt[b] ? [ueAlt[b]] : [], b)
    for (const b of Object.keys(ueAlt)) if (!mitBuendel[b]) buendelGruppe([], [ueAlt[b]], b)
    if (rest.length === 1 && !ueNeu.length) {
      const e = rest[0]
      gruppen.push({ eintraege: [e], schluessel: e.schluessel, nachrichten: nachrichtenFuer(U, R, g, e.schluessel, e.inhalt, e.anlass, uid) })
    } else if (rest.length || ueNeu.length) {
      const teile = rest.concat(ueNeu)
      const bs = R.buendelSchluessel(sha(U), teile.map((e) => e.schluessel), uid)
      for (const e of teile) ausfuehren(U, "UPDATE push_warteschlange SET buendel = {:b} WHERE id = {:id}", { b: bs, id: e.id })
      buendelGruppe(rest, ueNeu, bs)
    }
  }
  if (weg.length) loeschenNachId(U, "push_warteschlange", weg)
  // Senden in Aufträgen bis 500 Nachrichten, an den Grenzen der Gruppen
  let stapel = []
  let zahl = 0
  const absenden = () => {
    if (!stapel.length) return
    const alle = []
    for (const gr of stapel) for (const n of gr.nachrichten) alle.push(n)
    const res = dienstSenden(U, R, alle, R.GRENZEN.dienstZeitTaktS)
    const eintraege = []
    for (const gr of stapel) for (const e of gr.eintraege) eintraege.push(e)
    if (res.ok) { loeschenNachId(U, "push_warteschlange", eintraege.map((e) => e.id)); z.gesendet += stapel.length }
    else if (res.wiederholen) zurueckstellen(U, R, eintraege, z)
    else if (!res.nichtEingerichtet) { loeschenNachId(U, "push_warteschlange", eintraege.map((e) => e.id)); z.verworfen += eintraege.length }
    stapel = []
    zahl = 0
  }
  for (const gr of gruppen) {
    if (zahl + gr.nachrichten.length > R.GRENZEN.nachrichtenJeAuftrag) absenden()
    stapel.push(gr)
    zahl += gr.nachrichten.length
  }
  absenden()
  return z
}

/** Abgemeldete Abos abholen (nur 404/410 löschen); die Warnung „auth“ merken. */
function rueckmeldungenAbholen(U, R) {
  const z = { weg: 0, fehler: 0, warnung: null, erreicht: false }
  const a = dienstAnfrage(U, "POST", "/v1/rueckmeldungen", true, R.GRENZEN.dienstZeitTaktS)
  if (a.status !== 200 || !a.json) { schutzschalter(U, R, "fehler"); return z }
  z.erreicht = true
  schutzschalter(U, R, "ok")
  const weg = (Array.isArray(a.json.weg) ? a.json.weg : liste(a.json.weg)).map(String).filter((id) => KENNUNG_RE.test(id))
  z.fehler = (Array.isArray(a.json.fehler) ? a.json.fehler : liste(a.json.fehler)).length
  z.warnung = a.json.warnung ? String(a.json.warnung) : null
  U.store.set("push:warnung", z.warnung || "")
  if (weg.length) {
    z.weg = loeschenNachId(U, "push_geraete", weg)
    U.log("info", "Abgemeldete Abos gelöscht", { anzahl: z.weg })
  }
  if (z.warnung && einmalJe(U, "warnung_auth", 3600000)) U.log("warn", "Push-Dienst hält Löschungen zurück (VAPID-Schlüssel oder Subject prüfen)", { warnung: z.warnung })
  return z
}

// ── Lager ───────────────────────────────────────────────────────────────────

/** Organisation als geändert merken (Buchungen, Bestand, Artikel). */
function lagerGeaendert(U, orgId) {
  if (!orgId) return
  speicherSetzen(U.store, "push:lager:geaendert", (alt) => {
    let o = {}
    try { o = alt ? JSON.parse(String(alt)) : {} } catch (err) { o = {} }
    o[orgId] = U.jetztMs
    return JSON.stringify(o)
  })
}

function merkerSchluesselVon(U, art, orgId) {
  try { return liste(U.app.findRecordsByFilter("push_merker", "art = {:a} && organization_id = {:o}", "", 0, 0, { a: art, o: orgId })).map((r) => r.getString("schluessel")) } catch (err) { return [] }
}

function zahlenAddieren(a, b) {
  for (const k of Object.keys(b || {})) if (typeof b[k] === "number") a[k] = (a[k] || 0) + b[k]
  return a
}

/** Paare unter Soll: Zustand (Merker) immer, Senden nur über die Empfänger-Filter. */
function lagerPruefen(U, R, L, orgId, o) {
  const z = { neu: 0, weg: 0, still: false }
  if (!L || typeof L.lagerWarnungenDaten !== "function") {
    if (einmalJe(U, "lager_alt", 0)) U.log("warn", "lager-regeln.js ohne lagerWarnungenDaten: Lager-Anlässe ausgelassen", {})
    return z
  }
  const w = L.lagerWarnungenDaten(U.app, orgId, 30, U.jetztMs)
  const low = liste(w.low).map((x) => ({ item_id: String(x.item_id), item: String(x.item), location_id: String(x.location_id), ort: String(x.ort || ""), ist: Number(x.ist) || 0, soll: Number(x.soll) || 0 }))
  const diff = R.lagerDiff(merkerSchluesselVon(U, "lager_unter", orgId), { low: low }, orgId)
  for (const s of diff.weg) if (merkerLoeschen(U, s)) z.weg++
  const erster = beanspruchen(U, "start:lager:" + orgId, "start", orgId, NaN)
  z.still = erster || !!(o && o.still)
  if (diff.neu.length && !z.still) {
    const paare = diff.neu.map((x) => ({ i: x.item_id, l: x.location_id, ist: x.ist, soll: x.soll }))
    const mehrere = diff.neu.some((x) => !!x.ort)
    const kennung = "lager_unter:" + R.berlinTeile(U.jetztMs).tag + ":" + diff.neu.map((x) => x.schluessel).sort().join(",")
    zahlenAddieren(z, zustellen(U, R, { anlass: "lager_mindestbestand", orgId: orgId, kontext: { q: "lager_unter", paare: paare.slice(0, LISTE_MAX), n: paare.length, m: mehrere }, ereignisKennung: U.security.sha256(kennung) }))
  }
  // Merker nach der Übergabe (Zustand immer, auch still): bricht es davor ab, wiederholt der
  // nächste Takt mit demselben Schlüssel, und der Dienst verwirft Doppelte
  for (const x of diff.neu) beanspruchen(U, x.schluessel, "lager_unter", orgId, NaN, null)
  z.neu = diff.neu.length
  return z
}

/** Geänderte Organisationen höchstens alle 5 Minuten prüfen. */
function lagerGeaenderteOrgs(U, R, L, erneuern) {
  const z = { orgs: 0 }
  let geaendert = {}
  try { const v = U.store.get("push:lager:geaendert"); geaendert = v ? JSON.parse(String(v)) : {} } catch (err) { geaendert = {} }
  for (const orgId of Object.keys(geaendert)) {
    const zuletzt = Number(U.store.get("push:lager:zuletzt:" + orgId)) || 0
    if (zuletzt && U.jetztMs - zuletzt < R.GRENZEN.lagerAbstandMs) continue
    U.store.set("push:lager:zuletzt:" + orgId, U.jetztMs)
    speicherSetzen(U.store, "push:lager:geaendert", (alt) => {
      let o = {}
      try { o = alt ? JSON.parse(String(alt)) : {} } catch (err) { o = {} }
      if (Number(o[orgId]) <= Number(geaendert[orgId])) delete o[orgId]
      return JSON.stringify(o)
    })
    const org = orgLaden(U, R, orgId)
    if (!org || !org.is_active) continue
    try { zahlenAddieren(z, lagerPruefen(U, R, L, orgId, {})) } catch (err) { U.log("error", "Lagerprüfung gescheitert", { org: orgId, fehler: String(err).slice(0, 200) }) }
    z.orgs++
    erneuern()
  }
  return z
}

// ── Morgen- und Wochenlauf ──────────────────────────────────────────────────

function aktiveOrgs(U, R) {
  try { return liste(U.app.findRecordsByFilter("organizations", "is_active = true", "created", 0, 0)).map((r) => orgAusRecord(R, r)) } catch (err) { return [] }
}

function geraeteDerOrg(U, orgId) {
  try { return liste(U.app.findRecordsByFilter("mpg_devices", "organization_id = {:o}", "created", 0, 0, { o: orgId })).map(geraetFelder) } catch (err) { return [] }
}

function abbrechenPruefen(U, art, orgId, teil) {
  if (U.abbrechenNach && U.abbrechenNach === art + ":" + orgId + ":" + teil) throw { abbruch: ABBRUCH }
}

function morgenMpg(U, R, F, org, tag) {
  const z = { neu: 0 }
  if (!F) {
    if (einmalJe(U, "fristen_fehlt", 0)) U.log("warn", "push-fristen.js fehlt: MPG im Morgenlauf ausgelassen", {})
    return z
  }
  const erster = beanspruchen(U, "start:mpg:" + org.id, "start", org.id, NaN)
  const neu = []
  for (const g of geraeteDerOrg(U, org.id)) {
    for (const f of F.ueberfaelligeKontrollen(g, tag)) {
      const s = "mpg_frist:" + g.id + ":" + f.art + ":" + f.naechste
      if (!merkerDa(U, s)) neu.push({ id: g.id, art: f.art, naechste: f.naechste, schluessel: s })
    }
  }
  if (neu.length && !erster) {
    zahlenAddieren(z, zustellen(U, R, { anlass: "mpg_gesperrt", orgId: org.id, kontext: { q: "mpg_frist", geraete: neu.slice(0, LISTE_MAX).map((x) => ({ id: x.id, art: x.art, naechste: x.naechste })), n: neu.length, tag: tag }, ereignisKennung: "mpg_frist:" + tag + ":" + org.id }, F))
  }
  // Merker nach der Übergabe (bei einem Abbruch davor wiederholt der nächste Takt mit gleichem Schlüssel)
  for (const x of neu) beanspruchen(U, x.schluessel, "mpg_frist", org.id, U.jetztMs + 400 * 86400000, null)
  z.neu = neu.length
  return z
}

function morgenLagerAbgelaufen(U, R, L, org, tag) {
  const z = { neu: 0 }
  if (!L || typeof L.lagerWarnungenDaten !== "function") return z
  const erster = beanspruchen(U, "start:lager_abgelaufen:" + org.id, "start", org.id, NaN)
  const w = L.lagerWarnungenDaten(U.app, org.id, 30, U.jetztMs)
  const neu = []
  for (const x of liste(w.expired)) {
    const s = "lager_abgelaufen:" + x.item_id + ":" + x.datum
    if (!merkerDa(U, s)) neu.push({ i: String(x.item_id), d: String(x.datum), schluessel: s })
  }
  if (neu.length && !erster) {
    zahlenAddieren(z, zustellen(U, R, { anlass: "lager_abgelaufen", orgId: org.id, kontext: { q: "lager_abgelaufen", artikel: neu.slice(0, LISTE_MAX).map((x) => ({ i: x.i, d: x.d })), n: neu.length, tag: tag }, ereignisKennung: "lager_abgelaufen:" + tag + ":" + org.id }))
  }
  for (const x of neu) beanspruchen(U, x.schluessel, "lager_abgelaufen", org.id, U.jetztMs + 60 * 86400000, null)
  z.neu = neu.length
  return z
}

/** Aufräumen: Merker mit bis vorbei, Warteschlange über 72 h, Geräte inaktiver Konten und über dem Höchstalter. */
function aufraeumen(U, R) {
  const z = { merker: 0, eintraege: 0, geraeteKonto: 0, geraeteAlt: 0, speicher: 0 }
  z.merker = ausfuehren(U, "DELETE FROM push_merker WHERE bis != '' AND bis < {:j}", { j: pbZeit(U.jetztMs) })
  z.eintraege = ausfuehren(U, "DELETE FROM push_warteschlange WHERE created < {:g}", { g: pbZeit(U.jetztMs - R.GRENZEN.warteMaxMs) })
  const grenze = pbZeit(U.jetztMs - R.GRENZEN.geraetHoechstalterTage * 86400000)
  z.geraeteAlt = ausfuehren(U, "DELETE FROM push_geraete WHERE (gemeldet_am != '' AND gemeldet_am < {:g}) OR (gemeldet_am = '' AND created < {:g})", { g: grenze })
  const ids = {}
  try { for (const r of liste(U.app.findRecordsByFilter("push_geraete", "id != ''", "", 0, 0))) ids[r.getString("user_id")] = true } catch (err) { /* keine */ }
  try { for (const r of liste(U.app.findRecordsByFilter("push_warteschlange", "id != ''", "", 0, 0))) ids[r.getString("user_id")] = true } catch (err) { /* keine */ }
  for (const uid of Object.keys(ids)) {
    const p = personLaden(U, R, uid)
    if (p && R.aktiv(p, U.jetztMs)) continue
    z.geraeteKonto += ausfuehren(U, "DELETE FROM push_geraete WHERE user_id = {:u}", { u: uid })
    z.eintraege += ausfuehren(U, "DELETE FROM push_warteschlange WHERE user_id = {:u}", { u: uid })
  }
  // Abgelaufene Drosseln im Speicher
  try {
    const alle = U.store.getAll()
    for (const k of Object.keys(alle)) {
      if (k.indexOf("push:drossel:") === 0 || k.indexOf("push:route:") === 0) {
        const v = alle[k]
        const ende = v ? Number(v.start || v.ab) + 3600000 : 0
        if (!ende || ende < U.jetztMs) { U.store.remove(k); z.speicher++ }
      }
    }
  } catch (err) { /* egal */ }
  if (z.geraeteAlt || z.geraeteKonto) U.log("info", "Geräte aufgeräumt", { hoechstalter: z.geraeteAlt, konten: z.geraeteKonto })
  return z
}

function morgenlauf(U, R, F, L, tag, erneuern) {
  const z = { orgs: 0, mpg: 0, lager_abgelaufen: 0, lager_unter: 0 }
  for (const org of aktiveOrgs(U, R)) {
    const teile = [
      ["mpg", () => { z.mpg += morgenMpg(U, R, F, org, tag).neu }],
      ["lager_abgelaufen", () => { z.lager_abgelaufen += morgenLagerAbgelaufen(U, R, L, org, tag).neu }],
      ["lager_unter", () => { z.lager_unter += lagerPruefen(U, R, L, org.id, {}).neu }],
    ]
    for (const t of teile) {
      const m = "lauf:morgen:" + tag + ":" + org.id + ":" + t[0]
      if (merkerDa(U, m)) continue
      try { t[1]() } catch (err) {
        if (err && err.abbruch === ABBRUCH) throw err
        U.log("error", "Morgenlauf: Teil gescheitert", { org: org.id, teil: t[0], fehler: String(err).slice(0, 200) })
      }
      beanspruchen(U, m, "lauf", org.id, U.jetztMs + 3 * 86400000, null)
      abbrechenPruefen(U, "morgen", org.id, t[0])
    }
    z.orgs++
    erneuern()
  }
  const a = "lauf:morgen:" + tag + ":aufraeumen"
  if (!merkerDa(U, a)) {
    z.aufraeumen = aufraeumen(U, R)
    beanspruchen(U, a, "lauf", "", U.jetztMs + 3 * 86400000, null)
  }
  beanspruchen(U, "lauf:morgen:" + tag, "lauf", "", U.jetztMs + 14 * 86400000, null)
  return z
}

/** Zahlen der Organisation für den Wochenüberblick. */
function wochenZahlen(U, R, F, L, org, tag) {
  const w = {}
  if (F) {
    w.mpg = F.wocheMpg(geraeteDerOrg(U, org.id), tag)
    let n = 0
    try {
      for (const r of liste(U.app.findRecordsByFilter("cirs_reports", "organization_id = {:o} && status != 'erledigt'", "", 0, 0, { o: org.id }))) {
        if (F.cirsUeberfaellig({ payload: jsonWert(r, "payload"), status: r.getString("status"), created: r.getString("created"), updated: r.getString("updated") }, tag)) n++
      }
    } catch (err) { n = 0 }
    w.cirs = { ueberfaellig: n }
  }
  if (L && typeof L.lagerWarnungenDaten === "function") {
    try { w.lager = { anzahl: liste(L.lagerWarnungenDaten(U.app, org.id, 30, U.jetztMs).expiring).length } } catch (err) { /* ohne Lager */ }
  }
  return w
}

function wochenlauf(U, R, F, L, tag, erneuern) {
  const z = { orgs: 0, personen: 0, sofort: 0, spaeter: 0 }
  for (const org of aktiveOrgs(U, R)) {
    const m = "lauf:woche:" + tag + ":" + org.id
    if (merkerDa(U, m)) continue
    try {
      const w = wochenZahlen(U, R, F, L, org, tag)
      const personen = personenLaden(U, R, org.id)
      const geraete = geraeteLaden(U, personen.map((p) => p.id))
      const gruppen = []
      for (const p of personen) {
        if (!(geraete[p.id] || []).length) continue
        const zeilen = R.wocheZeilen(w, (key) => R.darfAnlass(p, org, key, {}, U.jetztMs) && R.anlassAn(org.push, p.push, key))
        const inhalt = R.textWoche(zeilen)
        if (!inhalt) continue
        z.personen++
        const kontext = { woche: zeilen }
        const schl = R.eintragSchluessel(sha(U), "woche", "lauf:woche:" + tag, p.id)
        const za = R.zustellart(p.push, "woche", U.jetztMs)
        if (za.art === "spaeter") {
          einreihen(U, R, { userId: p.id, orgId: org.id, anlass: "woche", kontext: kontext, schluessel: schl, grund: "ruhe", faelligMs: za.faellig })
          z.spaeter++
          continue
        }
        gruppen.push({ userId: p.id, orgId: org.id, anlass: "woche", kontext: kontext, schluessel: schl, nachrichten: nachrichtenFuer(U, R, geraete[p.id], schl, inhalt, "woche", p.id) })
      }
      sendenOderEinreihen(U, R, gruppen, z)
    } catch (err) {
      U.log("error", "Wochenlauf: Organisation gescheitert", { org: org.id, fehler: String(err).slice(0, 200) })
    }
    beanspruchen(U, m, "lauf", org.id, U.jetztMs + 14 * 86400000, null)
    z.orgs++
    erneuern()
  }
  beanspruchen(U, "lauf:woche:" + tag, "lauf", "", U.jetztMs + 14 * 86400000, null)
  return z
}

// ── Takt ────────────────────────────────────────────────────────────────────

function taktSperre(U, R, token, art) {
  let erg = { erfolg: false }
  speicherSetzen(U.store, "push:takt", (alt) => { erg = R.taktSperreNeu(alt, token, U.jetztMs, art); return erg.wert })
  return erg.erfolg
}

/**
 * Minutentakt: Sperre mit Erneuerung; Rückmeldungen, Warteschlange, Lager (geänderte Orgs),
 * Morgenlauf (ab 06:00 Berlin), Wochenlauf (Montag ab 07:00). Gibt Zahlen zurück.
 */
/**
 * Geräte und wartende Einträge von Konten, die es nicht mehr gibt. Sicherheitsnetz für PocketBase
 * 0.23.x: Dort geht nach dem Löschen (onRecordAfterDeleteSuccess) kein Zugriff auf die Datenbank
 * („transaction has already been committed“), das Aufräumen dort scheitert also. push.pb.js räumt
 * deshalb schon in onRecordDeleteRequest auf; was anders gelöscht wurde, räumt hier der Takt ab.
 */
function verwaisteEntfernen(U) {
  let n = 0
  if (sammlungDa(U, "push_geraete")) n += ausfuehren(U, "DELETE FROM push_geraete WHERE user_id NOT IN (SELECT id FROM users)", {})
  if (sammlungDa(U, "push_warteschlange")) n += ausfuehren(U, "DELETE FROM push_warteschlange WHERE user_id NOT IN (SELECT id FROM users)", {})
  if (n) U.log("info", "Einträge gelöschter Konten entfernt", { anzahl: n })
  return n
}

function takt(U, R, F, L) {
  const token = zufall(U, 20)
  if (!taktSperre(U, R, token, "nehmen")) return { gesperrt: true }
  const z = {}
  const erneuern = () => { taktSperre(U, R, token, "erneuern") }
  try {
    if (!bereit(U)) return { eingerichtet: false }
    z.verwaist = verwaisteEntfernen(U)
    z.rueckmeldungen = rueckmeldungenAbholen(U, R)
    erneuern()
    z.warteschlange = warteschlangeAbarbeiten(U, R, F)
    erneuern()
    z.lager = lagerGeaenderteOrgs(U, R, L, erneuern)
    erneuern()
    const heute = R.berlinTeile(U.jetztMs).tag
    const erledigt = { morgen: merkerDa(U, "lauf:morgen:" + heute) ? heute : null, woche: merkerDa(U, "lauf:woche:" + heute) ? heute : null }
    const f = R.laeufeFaellig(U.jetztMs, erledigt)
    if (f.morgen) z.morgen = morgenlauf(U, R, F, L, f.morgen, erneuern)
    if (f.woche) z.woche = wochenlauf(U, R, F, L, f.woche, erneuern)
  } catch (err) {
    if (err && err.abbruch === ABBRUCH) { z.abgebrochen = true; return z }
    U.log("error", "Takt gescheitert", { fehler: String(err).slice(0, 300) })
    z.fehler = true
  } finally {
    taktSperre(U, R, token, "geben")
  }
  return z
}

// ── Auslöser (Model-Hooks, 3.2) ─────────────────────────────────────────────

const LAGER_SAMMLUNGEN = { inventory_transactions: true, inventory_stock: true, inventory_items: true }

function absenderId(rec) {
  const p = payloadVon(rec)
  return istObjekt(p.absender) && typeof p.absender.id === "string" ? p.absender.id : ""
}

/** Gerät gesperrt: Ereignis und Rückfall desselben Geräts ergeben eine Nachricht (Store 120 s, atomar). */
function mpgSperreBeanspruchen(U, R, deviceId) {
  let frei = false
  speicherSetzen(U.store, "push:mpg:" + deviceId, (alt) => {
    if (alt && Number(alt.bis) > U.jetztMs) return alt
    frei = true
    return { bis: U.jetztMs + R.GRENZEN.mpgFensterMs }
  })
  return frei
}

function geraetGesperrt(U, deviceId, orgId) {
  const d = datensatz(U, "mpg_devices", deviceId, orgId)
  return !!d && !d.getBool("operational") && !String(d.getString("ausser_betrieb")).trim()
}

function mitteilungAusloesen(U, R, rec) {
  const orgId = rec.getString("organization_id")
  if (!orgId || !rec.getBool("active")) return
  const kennung = rec.id + ":" + rec.getString("updated")
  if (!beanspruchen(U, "mitteilung:" + kennung, "mitteilung", orgId, U.jetztMs + 30 * 86400000, null)) return
  const z = zustellen(U, R, { anlass: "mitteilung", orgId: orgId, kontext: { q: "hub_notifications", id: rec.id }, ereignisKennung: kennung })
  U.log("info", "Mitteilung", { org: orgId, empfaenger: z.empfaenger, sofort: z.sofort, spaeter: z.spaeter, wiederholen: z.wiederholen })
}

function unterschriftAusloesen(U, R, rec, sammlung, formular, ziel) {
  if (!ziel || rec.getString(STATUSFELD[sammlung]) !== "ausstehend") return
  zustellen(U, R, { anlass: "unterschrift", orgId: rec.getString("organization_id"), kontext: { q: sammlung, id: rec.id, f: formular }, ereignisKennung: rec.id, nurPersonen: [ziel], ziel: ziel, formular: formular })
}

/** Neuer tokenKey: PocketBase hat alle Anmeldungen der Person ungültig gemacht (neues Passwort). */
function anmeldungenUngueltig(rec, alt) {
  try {
    const neu = rec.getString("tokenKey")
    const vorher = alt.getString("tokenKey")
    return !!neu && !!vorher && neu !== vorher
  } catch (err) {
    return false
  }
}

/**
 * Ein Auslöser aus push.pb.js. art "anlegen" | "aendern" | "loeschen"; alt = Stand vorher
 * (original()) beim Ändern. Jeder Teil für sich: ein Fehler stört die übrigen nicht.
 */
function ausloesen(U, R, art, rec, alt) {
  let sammlung = ""
  try { sammlung = rec.collection().name } catch (err) { return }
  if (LAGER_SAMMLUNGEN[sammlung]) { lagerGeaendert(U, rec.getString("organization_id")); return }
  if (sammlung === "users") {
    // Konto gelöscht, oder alle Anmeldungen ungültig (neuer tokenKey: neues Passwort, auch vom
    // Supervisor gesetzt): Geräte und wartende Einträge weg. Sonst bekäme ein verlorenes Gerät mit
    // alter Anmeldung weiter Einzelheiten (Owner 12.4); die App meldet sich nach der neuen
    // Anmeldung wieder an (src/lib/push/abgleich.ts).
    if (art === "loeschen" || (art === "aendern" && alt && anmeldungenUngueltig(rec, alt))) {
      let n = 0
      if (sammlungDa(U, "push_geraete")) n = ausfuehren(U, "DELETE FROM push_geraete WHERE user_id = {:u}", { u: rec.id })
      if (sammlungDa(U, "push_warteschlange")) ausfuehren(U, "DELETE FROM push_warteschlange WHERE user_id = {:u}", { u: rec.id })
      if (art === "aendern" && n) U.log("info", "Anmeldungen ungültig: Geräte der Person abgemeldet", { anzahl: n })
    }
    return
  }
  if (!bereit(U)) return
  const org = rec.getString("organization_id")
  const teil = (name, f) => { try { f() } catch (err) { U.log("error", "Auslöser gescheitert", { sammlung: sammlung, teil: name, fehler: String(err).slice(0, 200) }) } }
  switch (sammlung) {
    case "hub_notifications":
      if (art === "anlegen" || (art === "aendern" && alt && !alt.getBool("active") && rec.getBool("active"))) teil("mitteilung", () => mitteilungAusloesen(U, R, rec))
      return
    case "patients": {
      if (art !== "anlegen") return
      const ab = absenderId(rec)
      teil("unterschrift", () => unterschriftAusloesen(U, R, rec, "patients", "patienten", ab))
      if (rec.getString("status") === "offen") teil("protokoll_neu", () => zustellen(U, R, { anlass: "protokoll_neu", orgId: org, kontext: { q: "patients", id: rec.id }, ereignisKennung: rec.id, ausloeser: ab }))
      return
    }
    case "product_outputs": {
      if (art !== "anlegen") return
      const ab = absenderId(rec)
      teil("unterschrift", () => unterschriftAusloesen(U, R, rec, "product_outputs", "produktausgabe", ab))
      if (rec.getString("status") === "offen") teil("produktausgabe", () => zustellen(U, R, { anlass: "produktausgabe", orgId: org, kontext: { q: "product_outputs", id: rec.id }, ereignisKennung: rec.id, ausloeser: ab }))
      return
    }
    case "form_submissions": {
      if (art !== "anlegen") return
      const ab = absenderId(rec)
      teil("unterschrift", () => unterschriftAusloesen(U, R, rec, "form_submissions", "eigen", ab))
      teil("einsendung", () => zustellen(U, R, { anlass: "einsendung", orgId: org, kontext: { q: "form_submissions", id: rec.id }, ereignisKennung: rec.id, ausloeser: ab }))
      return
    }
    case "mpg_defect_reports": {
      if (art !== "anlegen") return
      const melder = rec.getString("reporter_user_id")
      teil("unterschrift", () => unterschriftAusloesen(U, R, rec, "mpg_defect_reports", "defektmeldung", melder))
      if (rec.getString("status") === "pending") teil("mpg_defekt", () => zustellen(U, R, { anlass: "mpg_defekt", orgId: org, kontext: { q: "mpg_defect_reports", id: rec.id }, ereignisKennung: rec.id, ausloeser: melder }))
      return
    }
    case "mpg_defects": {
      if (art !== "anlegen") return
      teil("mpg_defekt", () => {
        const dev = rec.getString("device_id")
        // Gesperrt: nur mpg_gesperrt. Bestätigte Meldung (gleiche id): schon als Meldung gekommen.
        if (geraetGesperrt(U, dev, org)) return
        if (datensatz(U, "mpg_defect_reports", rec.id, "")) return
        if (rec.getString("status") === "resolved") return
        zustellen(U, R, { anlass: "mpg_defekt", orgId: org, kontext: { q: "mpg_defects", id: rec.id }, ereignisKennung: rec.id, ausloeser: rec.getString("reported_by_id") })
      })
      return
    }
    case "mpg_ereignisse": {
      if (art !== "anlegen") return
      teil("mpg_gesperrt", () => {
        const a = rec.getString("art")
        const grund = R.grundAusEreignis(a, rec.getString("text"), jsonWert(rec, "angaben"))
        if (!(a === "gesperrt" || ((a === "stk" || a === "mtk") && grund))) return
        const dev = rec.getString("device_id")
        if (!geraetGesperrt(U, dev, org)) return
        if (!mpgSperreBeanspruchen(U, R, dev)) return
        zustellen(U, R, { anlass: "mpg_gesperrt", orgId: org, kontext: { q: "mpg_devices", geraete: [{ id: dev, g: GRUND_CODE[grund] || "hand" }] }, ereignisKennung: rec.id, ausloeser: rec.getString("user_id") })
      })
      return
    }
    case "mpg_devices": {
      if (art !== "aendern" || !alt) return
      teil("mpg_gesperrt", () => {
        if (!alt.getBool("operational") || rec.getBool("operational") || String(rec.getString("ausser_betrieb")).trim()) return
        // Rückfall nur ohne jeden Gerätebuch-Eintrag dieses Geräts in den letzten 120 s
        if (sammlungDa(U, "mpg_ereignisse")) {
          try {
            U.app.findFirstRecordByFilter("mpg_ereignisse", "device_id = {:d} && created >= {:t}", { d: rec.id, t: pbZeit(U.jetztMs - R.GRENZEN.mpgFensterMs) })
            return
          } catch (err) { /* keiner: Rückfall */ }
        }
        if (!mpgSperreBeanspruchen(U, R, rec.id)) return
        zustellen(U, R, { anlass: "mpg_gesperrt", orgId: org, kontext: { q: "mpg_devices", geraete: [{ id: rec.id, g: "" }] }, ereignisKennung: rec.id + ":" + rec.getString("updated") })
      })
      return
    }
    case "cirs_reports":
      if (art === "anlegen") teil("cirs_neu", () => zustellen(U, R, { anlass: "cirs_neu", orgId: org, kontext: { q: "cirs_reports", id: rec.id }, ereignisKennung: rec.id }))
      return
    case "ausbildungen_termine_user": {
      if (art !== "aendern" || !alt) return
      const st = rec.getString("status")
      if (st === alt.getString("status") || (st !== "zugesagt" && st !== "abgesagt")) return
      teil("ausbildung", () => zustellen(U, R, { anlass: "ausbildung", orgId: org, kontext: { q: "ausbildungen_termine_user", id: rec.id, s: st }, ereignisKennung: rec.id + ":" + rec.getString("updated"), ausloeser: rec.getString("teilnehmer_id") }))
      return
    }
    case "ausbildungen_einladungen": {
      const st = rec.getString("status")
      if (st !== "zusagen" && st !== "absagen") return
      if (art === "aendern" && (!alt || alt.getString("status") === st)) return
      if (art !== "anlegen" && art !== "aendern") return
      teil("ausbildung", () => zustellen(U, R, { anlass: "ausbildung", orgId: org, kontext: { q: "ausbildungen_einladungen", id: rec.id, s: st }, ereignisKennung: rec.id + ":" + rec.getString("updated") }))
      return
    }
  }
}

// ── Mitteilungen der Organisation: Schutz (2.7, Owner 12.3) ─────────────────

/**
 * Drossel der Leitung: höchstens 3 je Organisation in 24 Stunden (Speicher und Datenbank).
 * Mitteilungen des Supervisors und des Superusers (created_by leer) zählen nicht. Ergebnis
 * { erlaubt, sekunden, ms }: ms ist der vorgemerkte Zeitpunkt (für mitteilungDrosselFreigeben).
 */
function mitteilungDrosselPruefen(U, R, orgId) {
  const fenster = R.GRENZEN.mitteilungLeitungFensterMs
  const dbZeiten = []
  try {
    const l = liste(U.app.findRecordsByFilter("hub_notifications", "organization_id = {:o} && created >= {:s}", "", 0, 0, { o: orgId, s: pbZeit(U.jetztMs - fenster) }))
    for (const r of l) {
      const von = r.getString("created_by")
      if (!von) continue
      let sup = false
      try { sup = U.app.findRecordById("users", von).getBool("supervisor") } catch (err) { sup = false }
      if (!sup) dbZeiten.push(zeitMs(r.getString("created")))
    }
  } catch (err) { /* ohne Datenbank-Zählung */ }
  let erg = { erlaubt: true, sekunden: 0 }
  speicherSetzen(U.store, "push:mitteilung:" + orgId, (alt) => {
    let l = []
    try { l = alt ? JSON.parse(String(alt)) : [] } catch (err) { l = [] }
    erg = R.mitteilungDrossel(l, dbZeiten, U.jetztMs, R.GRENZEN.mitteilungLeitungMax, fenster)
    return JSON.stringify(erg.neu)
  })
  return { erlaubt: erg.erlaubt, sekunden: erg.sekunden, ms: erg.erlaubt ? U.jetztMs : null }
}

/** Vormerkung zurücknehmen, wenn das Speichern danach scheiterte (zählt dann nicht). */
function mitteilungDrosselFreigeben(U, orgId, ms) {
  if (!orgId || !Number.isFinite(ms)) return
  speicherSetzen(U.store, "push:mitteilung:" + orgId, (alt) => {
    let l = []
    try { l = alt ? JSON.parse(String(alt)) : [] } catch (err) { l = [] }
    const i = l.map(Number).indexOf(ms)
    if (i >= 0) l.splice(i, 1)
    return JSON.stringify(l)
  })
}

/**
 * Prüfung vor dem Anlegen, Ändern oder Löschen einer Mitteilung (nicht Superuser).
 * art "anlegen" | "aendern" | "loeschen". Ergebnis { ok } oder { ok:false, status, text }.
 * Setzt beim Anlegen created_by und hält es beim Ändern fest.
 */
function mitteilungSchuetzen(U, R, art, auth, rec) {
  const person = auth ? personAusRecord(R, auth) : null
  const T = R.MITTEILUNG_TEXTE
  const orgNeu = rec.getString("organization_id")
  const alt = art === "anlegen" ? null : rec.original()
  const orgAlt = alt ? alt.getString("organization_id") : orgNeu
  const rolleAlt = R.mitteilungRolle(person, orgAlt, U.jetztMs)
  const rolleNeu = R.mitteilungRolle(person, orgNeu, U.jetztMs)
  if (!rolleAlt || !rolleNeu) return { ok: false, status: 403, text: T.verboten }
  if (art === "loeschen") return { ok: true }
  if (art === "anlegen" || orgNeu !== orgAlt) {
    if (!orgNeu || !datensatz(U, "organizations", orgNeu, "")) return { ok: false, status: 400, text: T.organisation }
  }
  const titel = rec.getString("title")
  const text = rec.getString("message")
  if (art === "anlegen" || titel !== alt.getString("title") || text !== alt.getString("message")) {
    const p = R.mitteilungPruefen(titel, text)
    if (!p.ok) return { ok: false, status: 400, text: p.text }
  }
  if (art === "anlegen") rec.set("created_by", auth.id)
  else rec.set("created_by", alt.getString("created_by"))
  const sendet = art === "anlegen" ? rec.getBool("active") : (!alt.getBool("active") && rec.getBool("active"))
  if (rolleNeu === "leitung" && sendet) {
    const d = mitteilungDrosselPruefen(U, R, orgNeu)
    if (!d.erlaubt) return { ok: false, status: 429, text: T.drossel.replace("{m}", R.dauerText(d.sekunden)), sekunden: d.sekunden }
    return { ok: true, vorgemerkt: { orgId: orgNeu, ms: d.ms } }
  }
  return { ok: true }
}

// ── Routen (1.2) ────────────────────────────────────────────────────────────

const ROUTEN_TEXTE = {
  nicht_angemeldet: "Bitte melde dich an.",
  nicht_berechtigt: "Dafür fehlt dir das Recht.",
  nicht_eingerichtet: "Push ist auf dem Server noch nicht eingerichtet.",
  dienst_fehlt: "Der Push-Dienst antwortet gerade nicht. Bitte später erneut versuchen.",
  daten: "Die Angaben sind unvollständig oder ungültig.",
  drossel: "Gerade kommen sehr viele Anfragen. Bitte in {m} erneut versuchen.",
  nicht_gefunden: "Dieses Gerät ist hier nicht angemeldet.",
  abgemeldet: "Dieses Gerät wurde in der Geräteliste abgemeldet.",
  schluessel_neu: "Push muss auf diesem Gerät neu eingeschaltet werden.",
  server: "Das hat gerade nicht geklappt. Bitte erneut versuchen.",
}

function antwort(R, e, status, grund, zusatz) {
  const z = zusatz || {}
  let text = ROUTEN_TEXTE[grund] || ROUTEN_TEXTE.server
  if (grund === "drossel") text = text.replace("{m}", R.dauerText(z.sekunden))
  return e.json(status, Object.assign({ status: status, message: text, grund: grund }, z))
}

function bodyLesen(e) {
  let ct = ""
  try { ct = String(e.request.header.get("Content-Type") || "") } catch (err) { ct = "" }
  if (ct.toLowerCase().split(";")[0].trim() !== "application/json") return null
  try {
    const b = JSON.parse(JSON.stringify(e.requestInfo().body || {}))
    return istObjekt(b) ? b : null
  } catch (err) {
    return null
  }
}

/** Angemeldet: e.auth aus users, aktiv, mit organization_id; sonst null. */
function angemeldet(U, R, e) {
  if (!e.auth) return null
  const p = personAusRecord(R, e.auth)
  if (!p || p.sammlung !== "users" || !R.aktiv(p, U.jetztMs) || !p.organization_id) return null
  return p
}

function routeZaehlen(U, R, art, uid, cfg) {
  let erg = { erlaubt: true, sekunden: 0 }
  speicherSetzen(U.store, "push:route:" + art + ":" + uid, (alt) => { erg = R.zaehlen(alt, U.jetztMs, cfg.fensterMs, cfg.max); return erg.neu })
  return erg
}

function dienstOk(U, R) {
  const s = schutzschalter(U, R, null)
  const letzter = s.wert ? Number(s.wert.letzter_ok) || 0 : 0
  return !s.offen && letzter > 0 && U.jetztMs - letzter <= R.GRENZEN.dienstAlterMs
}

function routeStand(U, R, e) {
  const p = angemeldet(U, R, e)
  if (!p) return antwort(R, e, 401, "nicht_angemeldet")
  const ein = eingerichtet(U)
  const k = konfiguration(U)
  const aus = {
    v: 1, eingerichtet: ein.ok, fehlt: ein.fehlt, dienst: dienstOk(U, R), schluessel: k.schluessel,
    geraete: [], anlaesse: [], person: p.push, ruhe_jetzt: R.inRuhe(p.push.ruhe, U.jetztMs),
    darf_organisation: R.darfOrganisation(p, p.organization_id, U.jetztMs),
    // Owner 12.3: Mitteilungen an die eigene Organisation schicken (Leitung mit Rolle admin, Supervisor)
    darf_mitteilung: R.mitteilungRolle(p, p.organization_id, U.jetztMs) !== null,
  }
  if (ein.ok) {
    const org = orgLaden(U, R, p.organization_id)
    aus.geraete = (geraeteLaden(U, [p.id])[p.id] || []).map((g) => ({ id: g.id, kennung: g.endpoint_hash.slice(0, 16), geraet: g.geraet, angemeldet: g.gemeldet_am || g.created }))
    aus.anlaesse = org ? R.ANLAESSE.filter((a) => R.darfAnlassGrundsaetzlich(p, org, a.key, U.jetztMs)).map((a) => ({
      key: a.key, gruppe: a.gruppe, titel: a.titel, beschreibung: a.beschreibung, art: a.art, pflicht: a.pflicht,
      org_an: a.pflicht || org.push.aus.indexOf(a.key) < 0, person_an: a.pflicht || p.push.aus.indexOf(a.key) < 0,
    })) : []
  }
  return e.json(200, aus)
}

function grabsteinDa(U, hash) {
  try {
    const m = U.app.findFirstRecordByFilter("push_merker", "schluessel = {:s}", { s: "grab:" + hash })
    const bis = zeitMs(m.getString("bis"))
    if (Number.isFinite(bis) && bis < U.jetztMs) { U.app.delete(m); return false }
    return true
  } catch (err) {
    return false
  }
}

function routeGeraet(U, R, e) {
  const p = angemeldet(U, R, e)
  if (!p) return antwort(R, e, 401, "nicht_angemeldet")
  const ein = eingerichtet(U)
  if (!ein.ok) return antwort(R, e, 503, "nicht_eingerichtet", { fehlt: ein.fehlt })
  const d = routeZaehlen(U, R, "geraet", p.id, R.GRENZEN.routeGeraet)
  if (!d.erlaubt) return antwort(R, e, 429, "drossel", { sekunden: d.sekunden })
  const b = bodyLesen(e)
  if (!b) return antwort(R, e, 400, "daten", { feld: "body" })
  const k = konfiguration(U)
  const pr = R.aboPruefen({ endpoint: b.endpoint, keys: b.keys }, k.testzeit ? k.testHosts : [])
  if (!pr.ok) return antwort(R, e, 400, "daten", { feld: pr.feld })
  if (typeof b.schluessel !== "string" || !b.schluessel) return antwort(R, e, 400, "daten", { feld: "schluessel" })
  const hash = U.security.sha256(pr.abo.endpoint)
  if (b.schluessel !== k.schluessel) {
    // Das Gerät sagt selbst, dass dieses Abo zu einem alten Schlüssel gehört: den eigenen Eintrag
    // löschen (ohne Grabstein). Sonst stünde das Gerät doppelt in der Liste, und Sendungen an den
    // toten Endpoint gäben 403, die im Dienst jedes Löschen zurückhalten (Bauplan 13, Einwand 2).
    ausfuehren(U, "DELETE FROM push_geraete WHERE endpoint_hash = {:h} AND user_id = {:u}", { h: hash, u: p.id })
    return antwort(R, e, 409, "schluessel_neu", { schluessel: k.schluessel })
  }
  if (grabsteinDa(U, hash)) {
    if (b.ausdruecklich !== true) return antwort(R, e, 409, "abgemeldet")
    merkerLoeschen(U, "grab:" + hash)
  }
  const geraet = R.geraetBezeichnung(b.geraet)
  let rec = null
  try { rec = U.app.findFirstRecordByFilter("push_geraete", "endpoint_hash = {:h}", { h: hash }) } catch (err) { rec = null }
  if (rec && rec.getString("user_id") !== p.id) {
    // Ein Browser gehört der zuletzt angemeldeten Person: umhängen
    U.app.delete(rec)
    rec = null
  }
  if (rec) {
    rec.set("p256dh", pr.abo.keys.p256dh)
    rec.set("auth", pr.abo.keys.auth)
    rec.set("geraet", geraet)
    rec.set("organization_id", p.organization_id)
    rec.set("gemeldet_am", pbZeit(U.jetztMs))
    U.app.save(rec)
  } else {
    rec = neuerDatensatz(U, "push_geraete", {
      user_id: p.id, organization_id: p.organization_id, endpoint: pr.abo.endpoint, endpoint_hash: hash,
      p256dh: pr.abo.keys.p256dh, auth: pr.abo.keys.auth, geraet: geraet, gemeldet_am: pbZeit(U.jetztMs),
    })
  }
  // Höchstens 10 Geräte je Person: das am längsten nicht gemeldete fällt weg
  const alle = (geraeteLaden(U, [p.id])[p.id] || []).sort((a, b2) => {
    const x = zeitMs(a.gemeldet_am || a.created), y = zeitMs(b2.gemeldet_am || b2.created)
    return x !== y ? x - y : (a.created < b2.created ? -1 : 1)
  })
  if (alle.length > R.GRENZEN.geraeteJePerson) loeschenNachId(U, "push_geraete", alle.slice(0, alle.length - R.GRENZEN.geraeteJePerson).filter((g) => g.id !== rec.id).map((g) => g.id))
  return e.json(200, { ok: true, id: rec.id, kennung: hash.slice(0, 16) })
}

function routeAbmelden(U, R, e) {
  const p = angemeldet(U, R, e)
  if (!p) return antwort(R, e, 401, "nicht_angemeldet")
  if (!sammlungDa(U, "push_geraete")) return antwort(R, e, 503, "nicht_eingerichtet", { fehlt: eingerichtet(U).fehlt })
  const b = bodyLesen(e)
  if (!b) return antwort(R, e, 400, "daten", { feld: "body" })
  let rec = null
  if (typeof b.id === "string" && KENNUNG_RE.test(b.id)) {
    try { rec = U.app.findFirstRecordByFilter("push_geraete", "id = {:i} && user_id = {:u}", { i: b.id, u: p.id }) } catch (err) { rec = null }
    if (!rec) return antwort(R, e, 404, "nicht_gefunden")
    const hash = rec.getString("endpoint_hash")
    U.app.delete(rec)
    // Grabstein: das Gerät meldet sich beim nächsten Öffnen nicht still wieder an (30 Tage)
    merkerLoeschen(U, "grab:" + hash)
    beanspruchen(U, "grab:" + hash, "grab", p.organization_id, U.jetztMs + R.GRENZEN.grabsteinTage * 86400000, null)
    return e.json(200, { ok: true, geloescht: 1 })
  }
  if (typeof b.endpoint === "string" && b.endpoint && b.endpoint.length <= 1000) {
    const hash = U.security.sha256(b.endpoint)
    try { rec = U.app.findFirstRecordByFilter("push_geraete", "endpoint_hash = {:h} && user_id = {:u}", { h: hash, u: p.id }) } catch (err) { rec = null }
    if (!rec) return antwort(R, e, 404, "nicht_gefunden")
    U.app.delete(rec)
    return e.json(200, { ok: true, geloescht: 1 })
  }
  return antwort(R, e, 400, "daten", { feld: "endpoint" })
}

function routeEinstellungen(U, R, e) {
  const p = angemeldet(U, R, e)
  if (!p) return antwort(R, e, 401, "nicht_angemeldet")
  if (!feldDa(U, "users", "push_einstellungen")) return antwort(R, e, 503, "nicht_eingerichtet", { fehlt: eingerichtet(U).fehlt })
  const d = routeZaehlen(U, R, "einstellungen", p.id, R.GRENZEN.routeEinstellungen)
  if (!d.erlaubt) return antwort(R, e, 429, "drossel", { sekunden: d.sekunden })
  const b = bodyLesen(e)
  if (!b) return antwort(R, e, 400, "daten", { feld: "body" })
  const neu = R.personEinstellungenMischen(p.push, b)
  if (!spalteSchreiben(U, R, "users", "push_einstellungen", p.id, neu, 2000)) return antwort(R, e, 500, "server")
  if (JSON.stringify(neu.ruhe) !== JSON.stringify(p.push.ruhe) && sammlungDa(U, "push_warteschlange")) ruheNeuPlanen(U, R, p.id, neu)
  return e.json(200, { person: neu })
}

function routeOrganisation(U, R, e, schreiben) {
  const p = angemeldet(U, R, e)
  if (!p) return antwort(R, e, 401, "nicht_angemeldet")
  if (!R.darfOrganisation(p, p.organization_id, U.jetztMs)) return antwort(R, e, 403, "nicht_berechtigt")
  if (!feldDa(U, "organizations", "push_anlaesse")) return antwort(R, e, 503, "nicht_eingerichtet", { fehlt: eingerichtet(U).fehlt })
  const org = orgLaden(U, R, p.organization_id)
  if (!org) return antwort(R, e, 403, "nicht_berechtigt")
  let aus = org.push.aus
  if (schreiben) {
    const d = routeZaehlen(U, R, "organisation", p.id, R.GRENZEN.routeOrganisation)
    if (!d.erlaubt) return antwort(R, e, 429, "drossel", { sekunden: d.sekunden })
    const b = bodyLesen(e)
    if (!b || !Array.isArray(b.aus)) return antwort(R, e, 400, "daten", { feld: "aus" })
    const neu = R.orgEinstellungenLesen({ aus: b.aus })
    if (!spalteSchreiben(U, R, "organizations", "push_anlaesse", org.id, neu, 1000)) return antwort(R, e, 500, "server")
    return e.json(200, { aus: neu.aus })
  }
  return e.json(200, {
    aus: aus,
    anlaesse: R.ANLAESSE.map((a) => ({ key: a.key, gruppe: a.gruppe, titel: a.titel, beschreibung: a.beschreibung, art: a.art, pflicht: a.pflicht, modul_frei: a.key === "unterschrift" ? Object.keys(R.FORMULAR_MODUL).some((f) => R.modulFrei(org, R.FORMULAR_MODUL[f])) : (!a.modul || R.modulFrei(org, a.modul)) })),
  })
}

function routeProbe(U, R, e) {
  const p = angemeldet(U, R, e)
  if (!p) return antwort(R, e, 401, "nicht_angemeldet")
  const ein = eingerichtet(U)
  if (!ein.ok) return antwort(R, e, 503, "nicht_eingerichtet", { fehlt: ein.fehlt })
  const d = routeZaehlen(U, R, "probe", p.id, R.GRENZEN.routeProbe)
  if (!d.erlaubt) return antwort(R, e, 429, "drossel", { sekunden: d.sekunden })
  const g = geraeteLaden(U, [p.id])[p.id] || []
  if (!g.length) return e.json(200, { ok: true, geraete: 0, angenommen: 0 })
  if (schutzschalter(U, R, null).offen) return antwort(R, e, 503, "dienst_fehlt")
  const schl = R.eintragSchluessel(sha(U), "probe", String(U.jetztMs) + ":" + zufall(U, 8), p.id)
  const res = dienstSenden(U, R, nachrichtenFuer(U, R, g, schl, R.textProbe(), "probe", p.id), R.GRENZEN.dienstZeitTaktS)
  if (!res.ok) return antwort(R, e, 503, "dienst_fehlt")
  return e.json(200, { ok: true, geraete: g.length, angenommen: res.angenommen })
}

const REGEL_QUELLEN = ["patients", "product_outputs", "form_submissions", "cirs_reports", "mpg_devices", "mpg_defects", "mpg_defect_reports", "ausbildungen_termine_user", "ausbildungen_einladungen"]

/** Regel als Text; null = gesperrt. Die JSVM liefert Regeln als Zeiger auf Text (String() löst ihn auf). */
function regelText(r) {
  return r === null || r === undefined ? null : String(r)
}

function routeDiagnose(U, R, e) {
  if (!e.hasSuperuserAuth()) return antwort(R, e, 403, "nicht_berechtigt")
  const warnungen = []
  const sammlungen = {}
  for (const s of SAMMLUNGEN) {
    sammlungen[s] = sammlungDa(U, s)
    if (!sammlungen[s]) warnungen.push("Die Sammlung " + s + " fehlt.")
  }
  const felder = {}
  for (const f of FELDER) {
    const da = feldDa(U, f[0], f[1])
    const versteckt = da && feldVersteckt(U, f[0], f[1])
    felder[f[0] + "." + f[1]] = { da: da, versteckt: versteckt }
    if (!da) warnungen.push(f[0] + "." + f[1] + " fehlt.")
    else if (!versteckt) warnungen.push(f[0] + "." + f[1] + " ist nicht versteckt: " + (f[0] === "users" ? "Ruhezeiten wären über die API lesbar." : "die Einstellung der Organisation wäre öffentlich lesbar."))
  }
  const regelnOffen = []
  for (const s of SAMMLUNGEN) {
    if (!sammlungen[s]) continue
    const c = U.app.findCollectionByNameOrId(s)
    if ([c.listRule, c.viewRule, c.createRule, c.updateRule, c.deleteRule].some((r) => regelText(r) !== null)) {
      regelnOffen.push(s)
      warnungen.push("Die Sammlung " + s + " hat eine API-Regel: bitte alle fünf sperren (Schloss).")
    }
  }
  const regeln = {}
  try {
    const c = U.app.findCollectionByNameOrId("hub_notifications")
    regeln.hub_notifications = { list: regelText(c.listRule), view: regelText(c.viewRule), create: regelText(c.createRule), update: regelText(c.updateRule), delete: regelText(c.deleteRule) }
    if (regelText(c.createRule) === "" || regelText(c.updateRule) === "") warnungen.push("Die Create- oder Update-Regel von hub_notifications ist offen. Der Hook schützt trotzdem; bitte die Regeln aus docs/pocketbase-regeln.md eintragen.")
  } catch (err) { regeln.hub_notifications = null }
  for (const s of REGEL_QUELLEN) {
    try { regeln[s] = { list: regelText(U.app.findCollectionByNameOrId(s).listRule) } } catch (err) { regeln[s] = null }
  }
  if (regeln.patients && regeln.patients.list === "") warnungen.push("Die List-Regel von patients ist offen: Protokolle wären ohne Anmeldung lesbar.")
  const k = konfiguration(U)
  if (k.testHostsGesetzt) warnungen.push("RESPONDA_PUSH_TEST_HOSTS ist gesetzt: im Betrieb entfernen.")
  if (k.testzeit) warnungen.push("RESPONDA_PUSH_TESTZEIT ist gesetzt: im Betrieb entfernen.")
  if (!k.geheimnisOk) warnungen.push("RESPONDA_PUSH_GEHEIMNIS fehlt oder ist kürzer als 32 Zeichen.")
  if (!k.schluesselOk) warnungen.push("RESPONDA_PUSH_SCHLUESSEL fehlt oder ist kein öffentlicher VAPID-Schlüssel.")
  const dienst = { konfiguriert: k.eingerichtet, erreichbar: false, schluessel_gleich: false, schutzschalter: schutzschalter(U, R, null).offen, stand: null }
  if (k.eingerichtet) {
    dienst.erreichbar = dienstAnfrage(U, "GET", "/v1/gesund", false, R.GRENZEN.dienstZeitTaktS).status === 200
    const s = dienstAnfrage(U, "GET", "/v1/schluessel", true, R.GRENZEN.dienstZeitTaktS)
    dienst.schluessel_gleich = s.status === 200 && !!s.json && s.json.publicKey === k.schluessel
    const st = dienstAnfrage(U, "GET", "/v1/stand", true, R.GRENZEN.dienstZeitTaktS)
    dienst.stand = st.status === 200 ? st.json : null
    if (!dienst.erreichbar) warnungen.push("Der Push-Dienst ist nicht erreichbar.")
    else if (!dienst.schluessel_gleich) warnungen.push("Öffentlicher Schlüssel in PocketBase passt nicht zum Dienst: Geräte könnten nicht anmelden.")
    if ((dienst.stand && dienst.stand.warnung === "auth") || String(U.store.get("push:warnung") || "") === "auth") warnungen.push("Der Push-Dienst hält Löschungen zurück (Antworten 401 oder 403): VAPID-Schlüssel oder Subject prüfen.")
  }
  const zahl = (s) => { try { return liste(U.app.findRecordsByFilter(s, "id != ''", "", 0, 0)).length } catch (err) { return 0 } }
  const letzter = (praefix) => {
    try {
      const l = liste(U.app.findRecordsByFilter("push_merker", "art = 'lauf' && schluessel ~ {:p}", "-created", 50, 0, { p: praefix }))
      for (const r of l) { const m = /^lauf:(morgen|woche):([0-9]{4}-[0-9]{2}-[0-9]{2})$/.exec(r.getString("schluessel")); if (m) return m[2] }
    } catch (err) { /* keiner */ }
    return null
  }
  return e.json(200, {
    sammlungen: sammlungen, felder: felder, regeln_offen: regelnOffen, regeln: regeln, dienst: dienst,
    geraete: sammlungen.push_geraete ? zahl("push_geraete") : 0, wartend: sammlungen.push_warteschlange ? zahl("push_warteschlange") : 0,
    laeufe: { morgen: letzter("lauf:morgen:"), woche: letzter("lauf:woche:") }, warnungen: warnungen,
  })
}

module.exports = {
  SAMMLUNGEN, FELDER, GRUND_CODE, GRUND_TEXT, STATUSFELD,
  umgebung, konfiguration, eingerichtet, bereit, einmalJe, sammlungDa, feldDa, feldVersteckt, jsonWert, zeitMs, pbZeit, zufall, liste,
  personAusRecord, orgAusRecord, orgLaden, personenLaden, personLaden, geraeteLaden, geraetAusRecord, datensatz, nameVon,
  neuerDatensatz, beanspruchen, merkerDa, merkerLoeschen, spalteSchreiben, ausfuehren, loeschenNachId,
  schutzschalter, dienstSenden, dienstAnfrage, nachrichtenFuer, einreihen, ruheNeuPlanen, inhaltBauen, geraetFelder,
  zustellen, warteschlangeAbarbeiten, rueckmeldungenAbholen, lagerGeaendert, lagerPruefen, morgenlauf, wochenlauf, aufraeumen, takt,
  ausloesen, mitteilungSchuetzen, mitteilungDrosselPruefen, mitteilungDrosselFreigeben, ROUTEN_TEXTE, antwort, bodyLesen, angemeldet,
  routeStand, routeGeraet, routeAbmelden, routeEinstellungen, routeOrganisation, routeProbe, routeDiagnose,
}
