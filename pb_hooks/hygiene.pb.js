// PocketBase hook: Hygiene — Durchführungen sind Nachweise  (läuft ab PocketBase 0.23.4)
//
// Owner, 23.11.2026: Fahrzeuge, Räume, Rucksäcke, Geräte und Material werden in einem Intervall nach
// Checkliste gereinigt und desinfiziert. Überfällig wird nur angezeigt, nichts wird gesperrt.
//   hygiene_objekte          was gereinigt wird (Intervall, Checkliste, Herkunft aus MPG oder Lager).
//                            Wird archiviert statt gelöscht, solange Durchführungen darauf verweisen.
//   hygiene_durchfuehrungen  Nachweise — nur anlegen, nie ändern oder löschen. Eine Korrektur ist
//                            eine neue Durchführung mit Bemerkung.
// Datenmodell und Grenzen: src/lib/hygiene/typen.ts (NACHTRAG_TAGE, MAX_PUNKTE, MAX_PUNKT_LAENGE,
// MAX_BEMERKUNG, MAX_NAME — hier dieselben Zahlen). Verweise auf MPG und Lager stehen als Text-Kennung
// mit einer Kopie des Namens am Objekt, nie als Relation.
//
// Die API-Regeln sperren das meiste bereits (docs/pocketbase-regeln.md, „Hygiene: API-Regeln“,
// eingerichtet mit scripts/hygiene-einrichten.py). Diese Hooks sind die zweite Ebene: Superuser
// umgehen API-Regeln — auch in der Admin-Oberfläche, beim Leeren einer Sammlung („Truncate“), beim
// Import von Sammlungen und in Sammelbuchungen (Batch) —, Unveränderlichkeit und Löschschutz aber
// nicht. Die Prüfung der Felder gilt für alle außer dem Superuser. Nicht abgedeckt: Felder einer
// Sammlung in der Admin-Oberfläche entfernen (dabei gehen deren Werte verloren) — das bitte unterlassen.
//
// Route (nur angemeldete, aktive Konten mit „Hygiene verwalten“, keine Teilnehmenden):
//   GET /api/responda/hygiene/quellen   Geräte, Lager-Orte, Sollausstattungen und Artikel der eigenen
//                                       Organisation für die Vorschläge (src/lib/hygiene/vorschlaege.ts)
//
// Muss in den Hook-Ordner der laufenden PocketBase (/opt/pb_hooks) kopiert werden; PocketBase lädt
// ihn nach einem Neustart.
//
// Hinweis: PocketBase führt jeden Handler für sich aus — Hilfsfunktionen stehen deshalb im Handler,
// nicht oben in der Datei. Ein Handler, der für zwei Ereignisse gilt (Anlegen und Ändern von
// Objekten), steht einmal als Konstante und darf nichts außerhalb seiner selbst benutzen. In einer
// Sammelbuchung sieht nur e.app die Datensätze, die vorher in derselben Buchung angelegt wurden.
// Zeitpunkte vergleicht der Hook als Text im PocketBase-Format („2026-11-23 08:00:00.000Z“).

// ── Unveränderlich ──────────────────────────────────────────────────────────

onRecordUpdateRequest((e) => {
  throw new BadRequestError("Nachweise der Hygiene sind unveränderlich — eine Korrektur bitte als neue Durchführung mit Bemerkung eintragen.")
}, "hygiene_durchfuehrungen")

onRecordDeleteRequest((e) => {
  throw new BadRequestError("Nachweise der Hygiene dürfen nicht gelöscht werden.")
}, "hygiene_durchfuehrungen")

// Auch ohne API-Anfrage: „Truncate“ in der Admin-Oberfläche löscht Datensatz für Datensatz
onRecordDelete((e) => {
  throw new BadRequestError("Nachweise der Hygiene werden nicht gelöscht.")
}, "hygiene_durchfuehrungen")

// Ein Objekt mit Durchführungen bleibt (archivieren statt löschen) — auch beim Leeren der Sammlung.
// Fehlt die Sammlung der Durchführungen, zählt sie nicht; jeder andere Fehler verhindert das Löschen.
// Zweimal: Beim Löschen über die API ersetzt PocketBase die Meldung aus onRecordDelete durch eine
// allgemeine („Failed to delete record …“), deshalb dieselbe Prüfung vorher mit eigener Meldung.
onRecordDeleteRequest((e) => {
  let da = true
  try { e.app.findCollectionByNameOrId("hygiene_durchfuehrungen") } catch (err) { da = false }
  if (da && e.app.findRecordsByFilter("hygiene_durchfuehrungen", "objekt_id = {:id}", "", 1, 0, { id: e.record.id }).length > 0) {
    throw new BadRequestError("Zu diesem Objekt gibt es Durchführungen — es bleibt als Nachweis erhalten. Bitte archivieren.")
  }
  e.next()
}, "hygiene_objekte")

onRecordDelete((e) => {
  let da = true
  try { e.app.findCollectionByNameOrId("hygiene_durchfuehrungen") } catch (err) { da = false }
  if (da && e.app.findRecordsByFilter("hygiene_durchfuehrungen", "objekt_id = {:id}", "", 1, 0, { id: e.record.id }).length > 0) {
    throw new BadRequestError("Zu diesem Objekt gibt es Durchführungen — es bleibt als Nachweis erhalten. Bitte archivieren.")
  }
  e.next()
}, "hygiene_objekte")

// Sammlungen mit Nachweisen bleiben — auch beim Import mit „fehlende löschen“ — und behalten ihren
// Namen (umbenannt griffe keiner dieser Hooks mehr)
onCollectionDelete((e) => {
  if (["hygiene_objekte", "hygiene_durchfuehrungen"].includes(e.collection.name)) {
    throw new BadRequestError("Diese Sammlung enthält Nachweise der Hygiene und bleibt.")
  }
  e.next()
})

onCollectionDeleteRequest((e) => {
  if (["hygiene_objekte", "hygiene_durchfuehrungen"].includes(e.collection.name)) {
    throw new BadRequestError("Diese Sammlung enthält Nachweise der Hygiene und bleibt.")
  }
  e.next()
})

onCollectionUpdate((e) => {
  const namen = ["hygiene_objekte", "hygiene_durchfuehrungen"]
  let bisher = ""
  try { bisher = e.app.findCollectionByNameOrId(e.collection.id).name } catch (err) { bisher = "" }
  if (namen.includes(bisher) && e.collection.name !== bisher) {
    throw new BadRequestError("Diese Sammlung enthält Nachweise der Hygiene und behält ihren Namen.")
  }
  e.next()
})

// ── Objekte ────────────────────────────────────────────────────────────────

// Anlegen und Ändern (nicht Superuser): Felder prüfen und säubern, Organisation bleibt, Herkunft aus
// MPG oder Lager nur aus derselben Organisation (Name der Quelle setzt der Server), Zeitpunkt des
// Archivierens setzt der Server.
const hygieneObjektPruefen = (e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const MAX_NAME = 120, MAX_PUNKTE = 40, MAX_PUNKT_LAENGE = 200
  const ARTEN = ["fahrzeug", "raum", "rucksack", "geraet", "material", "sonstiges"]
  const INTERVALLE = ["taeglich", "woechentlich", "tage", "monatlich", "benutzung"]
  const QUELLEN = { mpg_geraet: "mpg_devices", lager_ort: "inventory_locations", lager_satz: "inventory_kits", lager_artikel: "inventory_items" }
  const r = e.record
  const neu = r.isNew()
  const alt = neu ? null : r.original()
  const text = (f) => { try { return String(r.getString(f) || "") } catch (err) { return "" } }
  const sauber = (s) => String(s).replace(/\s+/g, " ").trim()

  let sammlung = ""
  try { sammlung = e.auth ? e.auth.collection().name : "" } catch (err) { sammlung = "" }
  if (!e.auth || sammlung !== "users") throw new ForbiddenError("Bitte melde dich an.")
  const org = text("organization_id")
  if (!neu && org !== alt.getString("organization_id")) throw new BadRequestError("Ein Objekt bleibt in seiner Organisation.")
  if (!org || org !== e.auth.getString("organization_id")) throw new ForbiddenError("Objekte nur in der eigenen Organisation.")

  const name = sauber(text("name"))
  if (!name) throw new BadRequestError("Bitte eine Bezeichnung eingeben.")
  if (name.length > MAX_NAME) throw new BadRequestError("Die Bezeichnung ist zu lang (höchstens " + MAX_NAME + " Zeichen).")
  r.set("name", name)
  if (!ARTEN.includes(text("art"))) throw new BadRequestError("Bitte die Art wählen (Fahrzeug, Raum, Rucksack oder Koffer, Gerät, Material, Sonstiges).")
  const standort = sauber(text("standort"))
  if (standort.length > MAX_NAME) throw new BadRequestError("Der Standort ist zu lang (höchstens " + MAX_NAME + " Zeichen).")
  r.set("standort", standort)

  const intervall = text("intervall")
  if (!INTERVALLE.includes(intervall)) throw new BadRequestError("Bitte das Intervall wählen.")
  if (intervall === "tage") {
    let tage = NaN
    try { tage = Number(r.get("intervall_tage")) } catch (err) { tage = NaN }
    if (!Number.isInteger(tage) || tage < 1 || tage > 365) throw new BadRequestError("Bitte angeben, alle wie viele Tage (1 bis 365).")
  } else {
    r.set("intervall_tage", 0)
  }

  let punkte = null
  try { punkte = JSON.parse(text("punkte") || "null") } catch (err) { punkte = null }
  if (!Array.isArray(punkte) || punkte.length === 0) throw new BadRequestError("Die Checkliste braucht mindestens einen Punkt.")
  if (punkte.length > MAX_PUNKTE) throw new BadRequestError("Die Checkliste hat zu viele Punkte (höchstens " + MAX_PUNKTE + ").")
  const liste = []
  for (const p of punkte) {
    if (typeof p !== "string") throw new BadRequestError("Die Punkte der Checkliste bitte als Text angeben.")
    const t = sauber(p)
    if (!t) throw new BadRequestError("Ein Punkt der Checkliste ist leer.")
    if (t.length > MAX_PUNKT_LAENGE) throw new BadRequestError("Ein Punkt der Checkliste ist zu lang (höchstens " + MAX_PUNKT_LAENGE + " Zeichen).")
    liste.push(t)
  }
  r.set("punkte", liste)

  // Herkunft: nur prüfen, wenn sie neu ist oder sich ändert — ein später gelöschtes Gerät oder ein
  // archivierter Artikel blockiert das Ändern eines Objekts nie, und der gespeicherte Name bleibt.
  const quelle = text("quelle")
  if (quelle !== "" && !QUELLEN[quelle]) throw new BadRequestError("Unbekannte Herkunft.")
  const quelleId = text("quelle_id").trim()
  if (!quelle) {
    r.set("quelle_id", "")
    r.set("quelle_name", "")
  } else if (!neu && quelle === alt.getString("quelle") && quelleId === alt.getString("quelle_id")) {
    r.set("quelle_id", alt.getString("quelle_id"))
    r.set("quelle_name", alt.getString("quelle_name"))
  } else {
    if (!quelleId || quelleId.length > 64) throw new BadRequestError("Die Herkunft wurde in deiner Organisation nicht gefunden.")
    let da = true
    try { e.app.findCollectionByNameOrId(QUELLEN[quelle]) } catch (err) { da = false }
    if (da) {
      // Nicht gefunden und andere Organisation sagen dasselbe (keine Auskunft über fremde Kennungen)
      let q = null
      try { q = e.app.findRecordById(QUELLEN[quelle], quelleId) } catch (err) { q = null }
      if (!q || q.getString("organization_id") !== org) throw new BadRequestError("Die Herkunft wurde in deiner Organisation nicht gefunden.")
      r.set("quelle_name", sauber(q.getString("name")).slice(0, MAX_NAME))
    } else {
      // Sammlung fehlt auf diesem Server: nichts zu prüfen, die Kopie des Namens bleibt, wie gesendet
      r.set("quelle_name", sauber(text("quelle_name")).slice(0, MAX_NAME))
    }
    r.set("quelle_id", quelleId)
  }

  // Archivieren: Zeitpunkt setzt der Server; ein schon archiviertes Objekt behält seinen Zeitpunkt
  const archiviert = text("archiviert")
  const vorher = neu ? "" : alt.getString("archiviert")
  if (archiviert && vorher) r.set("archiviert", vorher)
  else if (archiviert) r.set("archiviert", new Date().toISOString().replace("T", " "))
  return e.next()
}

onRecordCreateRequest(hygieneObjektPruefen, "hygiene_objekte")
onRecordUpdateRequest(hygieneObjektPruefen, "hygiene_objekte")

// ── Durchführungen ─────────────────────────────────────────────────────────

// Anlegen (nicht Superuser): Person aus der Anmeldung, Objekt der eigenen Organisation und nicht
// archiviert (sein Name kommt vom Server), feste Anlässe statt freiem Grund (keine Patientendaten),
// Punkte nur als Text und erledigt, Zahl der offenen Punkte zählt der Server, Zeitpunkt höchstens
// 10 Minuten in der Zukunft (Geräte-Uhr) und höchstens NACHTRAG_TAGE (+1 Tag Puffer) zurück.
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const NACHTRAG_TAGE = 7, MAX_PUNKTE = 40, MAX_PUNKT_LAENGE = 200, MAX_BEMERKUNG = 1000
  const ANLAESSE = ["infektion", "verschmutzung", "sonstiges"]
  const r = e.record
  const text = (f) => { try { return String(r.getString(f) || "") } catch (err) { return "" } }
  const sauber = (s) => String(s).replace(/\s+/g, " ").trim()
  const pbZeit = (ms) => new Date(ms).toISOString().replace("T", " ")

  let sammlung = ""
  try { sammlung = e.auth ? e.auth.collection().name : "" } catch (err) { sammlung = "" }
  if (!e.auth || sammlung !== "users") throw new ForbiddenError("Bitte melde dich an.")
  const org = text("organization_id")
  if (!org || org !== e.auth.getString("organization_id")) throw new ForbiddenError("Durchführungen nur in der eigenen Organisation.")

  // Objekt: nicht gefunden und andere Organisation sagen dasselbe
  let objekt = null
  try { objekt = e.app.findRecordById("hygiene_objekte", text("objekt_id")) } catch (err) { objekt = null }
  if (!objekt || objekt.getString("organization_id") !== org) throw new BadRequestError("Dieses Objekt gibt es in deiner Organisation nicht.")
  if (objekt.getString("archiviert")) throw new BadRequestError("Dieses Objekt ist archiviert — Durchführungen nur an Objekten in Gebrauch.")
  r.set("objekt_name", objekt.getString("name"))

  const art = text("art")
  const anlass = text("anlass")
  if (art === "plan") {
    if (anlass) throw new BadRequestError("Eine Durchführung nach Plan hat keinen Anlass.")
  } else if (art === "anlass") {
    if (!ANLAESSE.includes(anlass)) throw new BadRequestError("Bitte den Anlass wählen (nach Infektionstransport, sichtbare Verschmutzung, sonstiger Anlass).")
  } else {
    throw new BadRequestError("Bitte angeben, ob nach Plan oder aus Anlass gereinigt wurde.")
  }
  const nummer = sauber(text("einsatz_nummer"))
  if (nummer.length > 40) throw new BadRequestError("Die Einsatznummer ist zu lang (höchstens 40 Zeichen).")
  r.set("einsatz_nummer", nummer)

  let punkte = null
  try { punkte = JSON.parse(text("punkte") || "[]") } catch (err) { punkte = null }
  if (!Array.isArray(punkte)) throw new BadRequestError("Die Punkte der Checkliste bitte als Liste angeben.")
  if (punkte.length > MAX_PUNKTE) throw new BadRequestError("Zu viele Punkte (höchstens " + MAX_PUNKTE + ").")
  const liste = []
  let offen = 0
  for (const p of punkte) {
    if (!p || typeof p !== "object" || Array.isArray(p) || typeof p.text !== "string" || typeof p.erledigt !== "boolean") {
      throw new BadRequestError("Jeder Punkt braucht einen Text und erledigt (ja oder nein).")
    }
    const t = sauber(p.text)
    if (!t) throw new BadRequestError("Ein Punkt der Checkliste ist leer.")
    if (t.length > MAX_PUNKT_LAENGE) throw new BadRequestError("Ein Punkt der Checkliste ist zu lang (höchstens " + MAX_PUNKT_LAENGE + " Zeichen).")
    // Nur Text und erledigt — weitere Angaben werden nicht gespeichert
    liste.push({ text: t, erledigt: p.erledigt })
    if (!p.erledigt) offen++
  }
  r.set("punkte", liste)
  r.set("offen", offen)

  const bemerkung = text("bemerkung").trim()
  if (bemerkung.length > MAX_BEMERKUNG) throw new BadRequestError("Die Bemerkung ist zu lang (höchstens " + MAX_BEMERKUNG + " Zeichen).")
  r.set("bemerkung", bemerkung)

  const zeitpunkt = text("zeitpunkt")
  const jetzt = Date.now()
  if (!zeitpunkt) throw new BadRequestError("Bitte angeben, wann gereinigt wurde.")
  if (zeitpunkt > pbZeit(jetzt + 10 * 60000)) throw new BadRequestError("Der Zeitpunkt liegt in der Zukunft — bitte Datum und Uhrzeit des Geräts prüfen.")
  if (zeitpunkt < pbZeit(jetzt - (NACHTRAG_TAGE + 1) * 86400000)) throw new BadRequestError("Nachtragen geht nur bis " + NACHTRAG_TAGE + " Tage zurück.")

  // Wer, setzt der Server aus der Anmeldung — nie die E-Mail-Adresse
  r.set("user_id", e.auth.id)
  r.set("user_name", sauber(e.auth.getString("name")).slice(0, 200) || "Unbekannt")
  return e.next()
}, "hygiene_durchfuehrungen")

// ── Quellen für die Vorschläge ─────────────────────────────────────────────

// Nur angemeldete, aktive Konten (nicht gesperrt, nicht abgelaufen) aus users, keine Teilnehmenden,
// mit „Hygiene verwalten“ (Leitung und Supervisor immer, sonst das Häkchen, auch befristet wie in den
// API-Regeln). Nur die eigene Organisation, ohne außer Betrieb genommene Geräte und ohne archivierte
// Orte, Sollausstattungen und Artikel, je nach Name, höchstens 2000. Fehlt eine Sammlung: leere Liste.
routerAdd("GET", "/api/responda/hygiene/quellen", (e) => {
  const antwort = (status, grund, text) => e.json(status, { status: status, message: text, grund: grund })
  const a = e.auth
  if (!a) return antwort(401, "nicht_angemeldet", "Bitte melde dich an.")
  let sammlung = ""
  try { sammlung = a.collection().name } catch (err) { sammlung = "" }
  if (sammlung !== "users") return antwort(403, "nicht_berechtigt", "Dafür fehlt dir das Recht „Hygiene verwalten“.")
  const s = (f) => { try { return String(a.getString(f) || "") } catch (err) { return "" } }
  const b = (f) => { try { return a.getBool(f) === true } catch (err) { return false } }
  const obj = (f) => {
    try {
      const v = JSON.parse(a.getString(f) || "null")
      return v && typeof v === "object" && !Array.isArray(v) ? v : {}
    } catch (err) { return {} }
  }
  const jetzt = new Date().toISOString().replace("T", " ")
  const bis = s("expires_at")
  if (b("disabled") || (bis !== "" && !(bis > jetzt))) return antwort(401, "nicht_angemeldet", "Bitte melde dich an.")
  const org = s("organization_id")
  const role = s("role")
  const befristet = obj("temp_permissions").hygiene_verwalten
  const darf = role !== "teilnehmer" && !!org && (
    b("supervisor") || role === "admin" || obj("permissions").hygiene_verwalten === true ||
    (!!befristet && typeof befristet === "object" && typeof befristet.until === "string" && befristet.until.indexOf(" ") >= 0 && befristet.until > jetzt)
  )
  if (!darf) return antwort(403, "nicht_berechtigt", "Dafür fehlt dir das Recht „Hygiene verwalten“.")

  const liste = (name, ohne, felder) => {
    let c = null
    try { c = $app.findCollectionByNameOrId(name) } catch (err) { return [] }
    const hat = (f) => { try { return !!c.fields.getByName(f) } catch (err) { return false } }
    if (!hat("organization_id")) return []
    let filter = "organization_id = {:o}"
    if (ohne === "ausser_betrieb" && hat("ausser_betrieb")) filter += " && ausser_betrieb = ''"
    if (ohne === "archiviert" && hat("archiviert")) filter += " && archiviert != true"
    let recs = []
    try { recs = $app.findRecordsByFilter(name, filter, hat("name") ? "name" : "", 2000, 0, { o: org }) } catch (err) { return [] }
    const aus = []
    for (let i = 0; i < recs.length; i++) {
      const x = recs[i]
      const feld = (f) => { try { return String(x.getString(f) || "") } catch (err) { return "" } }
      if (ohne === "ausser_betrieb" && feld("ausser_betrieb").trim()) continue
      if (ohne === "archiviert") {
        let weg = false
        try { weg = x.getBool("archiviert") === true } catch (err) { weg = false }
        if (weg) continue
      }
      const o = { id: x.id }
      for (const f of felder) o[f] = feld(f)
      aus.push(o)
    }
    return aus
  }
  return e.json(200, {
    geraete: liste("mpg_devices", "ausser_betrieb", ["name", "type", "location"]),
    orte: liste("inventory_locations", "archiviert", ["name"]),
    saetze: liste("inventory_kits", "archiviert", ["name"]),
    artikel: liste("inventory_items", "archiviert", ["name"]),
  })
})
