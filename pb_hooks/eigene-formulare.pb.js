// PocketBase hook: Eigene Formulare der Organisationen  (PocketBase v0.23+ API)
//
// form_templates (Vorlagen, verwaltet unter Vorgänge) und form_submissions (Einsendungen,
// Eingang unter Vorgänge). Vertrag: docs/pocketbase-regeln.md, „Eigene Formulare“.
//
//   Vorlagen anlegen, ändern: nur Mitglieder mit Recht Vorgänge der eigenen Organisation (wie
//     die Regel). Felder und Abschnitte werden geprüft und in die Normalform gebracht, mit den
//     alten Schlüsseln (fieldType, required, hint, options) für alte Seiten. Titel 1 bis 120
//     Zeichen, Beschreibung bis 500, Absender passwort, frei oder anonym (sonst frei),
//     archiviert heißt inaktiv. version und fassungen setzt nur dieser Hook (+1 bei geänderten
//     Feldern, die letzten 10 Fassungen). Ein Body mit basis_version, die nicht mehr stimmt:
//     409. Die Organisation bleibt beim Ändern.
//   Vorlagen löschen: nur ohne Einsendungen (sonst archivieren).
//   Einsendungen anlegen: nur über die Route in formular.pb.js (dort gesperrt); ohne
//     formular.pb.js (Rücknahme) der alte Weg, siehe formular-felder.pb.js.
//   Einsendungen ändern: nur Mitglieder mit Recht Vorgänge derselben Organisation, und nur
//     status (neu, in_bearbeitung, erledigt) und notiz (bis 4000 Zeichen); alles andere bleibt.
//     Jede Änderung steht in bearbeitung.verlauf.
//   Einsendungen lesen: nur Mitglieder mit Recht Vorgänge derselben Organisation (Regel; hier
//     zusätzlich für List und View). Echtzeit folgt der Regel.
//   Einsendungen löschen: nur Superuser.
//
// Superuser (Admin-Oberfläche) sind ausgenommen. Bleibt bei einer Rücknahme von formular.pb.js
// liegen. Fehlt formular-regeln.js, gelten nur die Regeln; Einsendungen bleiben trotzdem auf
// status und notiz beschränkt und werden nicht gelöscht.
//
// HINWEIS (PocketBase-JSVM): Handler laufen isoliert, require() deshalb im Handler.

// ── form_templates ──────────────────────────────────────────────────────────

onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  let R = null
  try { R = require(`${__hooks}/formular-regeln.js`) } catch (err) {
    e.app.logger().warn("[eigene] formular-regeln.js fehlt, Vorlage ohne Prüfung angelegt")
    return e.next()
  }
  const jetzt = Date.now()
  const person = e.auth ? R.personAusRecord(e.auth) : null
  if (!R.darfVorgaenge(person, e.record.getString("organization_id"), jetzt)) throw new ForbiddenError(R.EIGENE_TEXTE.vorlage_recht)
  const r = R.vorlageImHook(e.app, e.record, null, undefined, new Date(jetzt).toISOString())
  if (!r.ok) throw new BadRequestError(r.text)
  e.next()
}, "form_templates")

onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  let R = null
  try { R = require(`${__hooks}/formular-regeln.js`) } catch (err) {
    e.app.logger().warn("[eigene] formular-regeln.js fehlt, Vorlage ohne Prüfung geändert")
    return e.next()
  }
  const jetzt = Date.now()
  const original = e.record.original()
  const person = e.auth ? R.personAusRecord(e.auth) : null
  if (!R.darfVorgaenge(person, original.getString("organization_id"), jetzt)) throw new ForbiddenError(R.EIGENE_TEXTE.vorlage_recht)
  let basis = undefined
  try { basis = (e.requestInfo().body || {}).basis_version } catch (err) { basis = undefined }
  const r = R.vorlageImHook(e.app, e.record, original, basis, new Date(jetzt).toISOString())
  if (!r.ok) {
    if (r.status === 409) throw new ApiError(409, r.text)
    throw new BadRequestError(r.text)
  }
  e.next()
}, "form_templates")

onRecordDeleteRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  let R = null
  try { R = require(`${__hooks}/formular-regeln.js`) } catch (err) {
    // Ohne Regeln lieber nichts löschen, was Einsendungen haben könnte
    throw new BadRequestError("Dieses Formular lässt sich gerade nicht löschen. Bitte archivieren.")
  }
  const person = e.auth ? R.personAusRecord(e.auth) : null
  if (!R.darfVorgaenge(person, e.record.getString("organization_id"), Date.now())) throw new ForbiddenError(R.EIGENE_TEXTE.vorlage_recht)
  if (R.vorlageHatEinsendungen(e.app, e.record.id)) throw new BadRequestError(R.EIGENE_TEXTE.vorlage_loeschen)
  e.next()
}, "form_templates")

// ── form_submissions ────────────────────────────────────────────────────────

onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const original = e.record.original()
  let R = null
  try { R = require(`${__hooks}/formular-regeln.js`) } catch (err) { R = null }
  const felder = e.record.collection().fields
  const da = (f) => { try { return !!felder.getByName(f) } catch (err) { return false } }
  let schluessel = []
  try { schluessel = Object.keys(e.requestInfo().body || {}) } catch (err) { schluessel = [] }

  if (!R) {
    // Rückfall ohne formular-regeln.js: das Recht prüft die Regel; nur status und notiz
    if (da("status") && schluessel.indexOf("status") >= 0 && ["neu", "in_bearbeitung", "erledigt"].indexOf(e.record.getString("status")) < 0) {
      throw new BadRequestError("Diesen Status gibt es nicht.")
    }
    if (da("notiz") && e.record.getString("notiz").length > 4000) throw new BadRequestError("Die Notiz ist zu lang. Höchstens 4000 Zeichen.")
    for (let i = 0; i < felder.length; i++) {
      let name = ""
      let typ = ""
      try { name = felder[i].getName(); typ = felder[i].type() } catch (err) { continue }
      if (!name || name === "id" || name === "status" || name === "notiz" || typ === "autodate" || typ === "password") continue
      try { e.record.set(name, original.get(name)) } catch (err) { /* Feld ohne Wert */ }
    }
    e.app.logger().warn("[eigene] formular-regeln.js fehlt, Einsendung ohne Verlauf geändert", "id", e.record.id)
    return e.next()
  }

  const jetzt = Date.now()
  const person = e.auth ? R.personAusRecord(e.auth) : null
  if (!R.darfVorgaenge(person, original.getString("organization_id"), jetzt)) throw new ForbiddenError(R.EIGENE_TEXTE.einsendung_recht)
  const mitStatus = da("status")
  const mitNotiz = da("notiz")
  const mitVerlauf = da("bearbeitung")
  const body = {}
  if (mitStatus && schluessel.indexOf("status") >= 0) body.status = e.record.getString("status")
  if (mitNotiz && schluessel.indexOf("notiz") >= 0) body.notiz = e.record.getString("notiz")
  const r = R.einsendungAendern({
    status: mitStatus ? original.getString("status") : "",
    notiz: mitNotiz ? original.getString("notiz") : "",
    bearbeitung: mitVerlauf ? R.jsonWert(original, "bearbeitung") : null,
    body: body,
    von: { id: person.id, name: R.kontoName(person) },
    am: new Date(jetzt).toISOString(),
    id: $security.randomString(15),
    mitVerlauf: mitVerlauf,
  })
  if (!r.ok) throw new BadRequestError(r.text)
  // Alles andere (payload, Absender, Vorlage, Organisation) bleibt, wie der Server es gesetzt hat
  R.felderZuruecksetzen(e.record, original, ["status", "notiz", "bearbeitung"])
  if (mitStatus) e.record.set("status", r.status)
  if (mitNotiz) e.record.set("notiz", r.notiz)
  if (mitVerlauf) e.record.set("bearbeitung", r.bearbeitung)
  e.next()
}, "form_submissions")

onRecordDeleteRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  let text = "Einsendungen werden nicht gelöscht. Erledigte stehen im Archiv."
  try { text = require(`${__hooks}/formular-regeln.js`).EIGENE_TEXTE.einsendung_loeschen } catch (err) { /* Text von oben */ }
  throw new ForbiddenError(text)
}, "form_submissions")

// Lesen zusätzlich zur Regel: Wer das Recht Vorgänge in seiner Organisation nicht hat, liest
// keine Einsendungen, auch wenn die Regel noch offen stünde (Plan Vorgänge B2). Die Regel
// beschränkt die Liste auf die eigene Organisation; steht trotzdem eine Einsendung einer anderen
// Organisation in der Liste (Regel noch offen), antwortet der Hook mit 403 statt sie zu zeigen
// und schreibt es ins Log. View prüft Recht und Organisation hier noch einmal. Echtzeit folgt nur
// der Regel (docs/pocketbase-regeln.md, „Eigene Formulare“).
onRecordsListRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  let R = null
  try { R = require(`${__hooks}/formular-regeln.js`) } catch (err) { return e.next() }
  const person = e.auth ? R.personAusRecord(e.auth) : null
  if (!person || !R.darfVorgaenge(person, person.organization_id, Date.now())) throw new ForbiddenError(R.EIGENE_TEXTE.einsendung_recht)
  let fremd = 0
  try {
    const liste = e.records || []
    for (let i = 0; i < liste.length; i++) {
      if (liste[i].getString("organization_id") !== person.organization_id) fremd++
    }
  } catch (err) { fremd = 0 }
  if (fremd > 0) {
    e.app.logger().error("[eigene] List-Regel von form_submissions zeigt fremde Einsendungen, bitte die Regel setzen", "anzahl", fremd)
    throw new ForbiddenError(R.EIGENE_TEXTE.eingang_regel)
  }
  e.next()
}, "form_submissions")

onRecordViewRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  let R = null
  try { R = require(`${__hooks}/formular-regeln.js`) } catch (err) { return e.next() }
  const person = e.auth ? R.personAusRecord(e.auth) : null
  if (!R.darfVorgaenge(person, e.record.getString("organization_id"), Date.now())) throw new ForbiddenError(R.EIGENE_TEXTE.einsendung_recht)
  e.next()
}, "form_submissions")
