// PocketBase hook: MPG — Gerätebuch und Prüfprotokolle sind Nachweise  (PocketBase v0.23+ API)
//
// Das Medizinproduktebuch muss vollständig und echt bleiben: wer wann geprüft, gesperrt,
// freigegeben, Stammdaten geändert oder ein Gerät außer Betrieb genommen hat.
//   mpg_ereignisse   Gerätebuch — nur anfügen, nie ändern oder löschen. Eine Korrektur
//                    ist ein neuer Eintrag (Vermerk), der auf den alten verweist (bezug).
//   mpg_inspections  Prüfprotokolle — ebenso unveränderlich, nie in der Zukunft datiert.
//   mpg_defects      Defekte — werden offen angelegt und geschlossen (behoben), nie gelöscht.
//   mpg_devices      Ein Gerät mit Prüfungen, Defekten, bestätigten Meldungen oder Einträgen
//                    im Gerätebuch wird außer Betrieb genommen statt gelöscht. Sein Prüfstand
//                    (zuletzt geprüft, bestanden) folgt aus einem gespeicherten Prüfprotokoll,
//                    im Zweifel zur sicheren Seite (siehe unten).
//
// Die API-Regeln sperren das meiste bereits (docs/pocketbase-regeln.md, „MPG: API-Regeln“).
// Diese Hooks sind die zweite Ebene: Superuser umgehen API-Regeln — auch in der
// Admin-Oberfläche, beim Leeren einer Sammlung („Truncate“), beim Import von Sammlungen
// und in Sammelbuchungen (Batch) —, diese Prüfung aber nicht. Nicht abgedeckt: Felder
// einer Sammlung in der Admin-Oberfläche entfernen (dabei gehen deren Werte verloren) —
// das bitte unterlassen.
//
// Muss in den Hook-Ordner der laufenden PocketBase (/opt/pb_hooks) kopiert werden;
// PocketBase lädt ihn nach einem Neustart.
//
// Hinweis: PocketBase führt jeden Handler für sich aus — Hilfsfunktionen müssen
// deshalb im Handler stehen, nicht oben in der Datei. In einer Sammelbuchung sieht
// nur e.app die Datensätze, die vorher in derselben Buchung angelegt wurden.
// Zeitpunkte vergleicht der Hook als Text im PocketBase-Format („2026-10-22 08:00:00.000Z“).

// ── Unveränderlich ──────────────────────────────────────────────────────────

onRecordUpdateRequest((e) => {
  throw new BadRequestError("Das Gerätebuch ist unveränderlich — eine Korrektur bitte als Vermerk eintragen.")
}, "mpg_ereignisse")

onRecordUpdateRequest((e) => {
  throw new BadRequestError("Prüfprotokolle sind unveränderlich — eine Korrektur bitte als Vermerk im Gerätebuch eintragen.")
}, "mpg_inspections")

onRecordDeleteRequest((e) => {
  throw new BadRequestError("Einträge im Gerätebuch dürfen nicht gelöscht werden.")
}, "mpg_ereignisse")

onRecordDeleteRequest((e) => {
  throw new BadRequestError("Prüfprotokolle dürfen nicht gelöscht werden.")
}, "mpg_inspections")

onRecordDeleteRequest((e) => {
  throw new BadRequestError("Defekte bleiben als Nachweis erhalten — bitte als behoben schließen.")
}, "mpg_defects")

// Auch ohne API-Anfrage: „Truncate“ in der Admin-Oberfläche löscht Datensatz für Datensatz
onRecordDelete((e) => {
  throw new BadRequestError("Nachweise im MPG werden nicht gelöscht.")
}, "mpg_ereignisse", "mpg_inspections", "mpg_defects")

// Sammlungen mit Nachweisen bleiben — auch beim Import mit „fehlende löschen“ — und
// behalten ihren Namen (umbenannt griffe keiner dieser Hooks mehr)
onCollectionDelete((e) => {
  if (["mpg_ereignisse", "mpg_inspections", "mpg_defects", "mpg_devices"].includes(e.collection.name)) {
    throw new BadRequestError("Diese Sammlung enthält Nachweise des MPG und bleibt.")
  }
  e.next()
})

onCollectionDeleteRequest((e) => {
  if (["mpg_ereignisse", "mpg_inspections", "mpg_defects", "mpg_devices"].includes(e.collection.name)) {
    throw new BadRequestError("Diese Sammlung enthält Nachweise des MPG und bleibt.")
  }
  e.next()
})

onCollectionUpdate((e) => {
  const namen = ["mpg_ereignisse", "mpg_inspections", "mpg_defects", "mpg_devices"]
  let bisher = ""
  try { bisher = e.app.findCollectionByNameOrId(e.collection.id).name } catch (err) { bisher = "" }
  if (namen.includes(bisher) && e.collection.name !== bisher) {
    throw new BadRequestError("Diese Sammlung enthält Nachweise des MPG und behält ihren Namen.")
  }
  e.next()
})

// ── Geräte ──────────────────────────────────────────────────────────────────

// Löschen nur ohne Nachweise derselben Organisation — auch beim Leeren der Sammlung.
// Einträge „angelegt“, „geaendert“ und „geloescht“ zählen nicht, Meldungen von außen
// nur bestätigte (eine offene Meldung kann jeder ohne Anmeldung anlegen): Ein
// versehentlich angelegtes Gerät darf wieder weg. Fehlt eine Sammlung (z. B.
// mpg_ereignisse noch nicht angelegt), zählt sie nicht — jeder andere Fehler verhindert
// das Löschen.
onRecordDelete((e) => {
  const params = { id: e.record.id, org: e.record.getString("organization_id") }
  const hat = (collection, filter) => {
    try { e.app.findCollectionByNameOrId(collection) } catch (err) { return false }
    return e.app.findRecordsByFilter(collection, "organization_id = {:org} && device_id = {:id}" + filter, "", 1, 0, params).length > 0
  }
  if (
    hat("mpg_inspections", "") ||
    hat("mpg_defects", "") ||
    hat("mpg_defect_reports", " && status = 'confirmed'") ||
    hat("mpg_ereignisse", " && art != 'angelegt' && art != 'geaendert' && art != 'geloescht'")
  ) {
    throw new BadRequestError("Das Gerät hat Prüfungen, Defekte, Meldungen oder Einträge im Gerätebuch und bleibt als Nachweis erhalten — bitte außer Betrieb nehmen.")
  }
  e.next()
}, "mpg_devices")

// Ein neues Gerät hat noch keinen Prüfstand — den gibt es erst mit dem ersten Protokoll.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth() && (e.record.getString("last_inspection") || e.record.getBool("last_inspection_passed"))) {
    throw new BadRequestError("Der Prüfstand eines Geräts folgt aus einem gespeicherten Prüfprotokoll — bitte eine Prüfung erfassen.")
  }
  e.next()
}, "mpg_devices")

// Der Prüfstand (zuletzt geprüft, bestanden) folgt aus einem Prüfprotokoll desselben
// Geräts und derselben Organisation mit genau diesem Zeitpunkt und Ergebnis — und geht
// nur vorwärts: Ein durchgefallenes Gerät lässt sich nicht auf eine ältere, bestandene
// Prüfung zurücksetzen. Ist der gesendete Stand älter als der gespeicherte (andere
// Geräte-Uhr, später gesendet), gehen Protokoll, Defekt und Sperre trotzdem durch — nur der
// neuere Stand bleibt stehen. Zwei Ausnahmen, beide zur sicheren Seite: Ein gespeicherter
// Zeitpunkt nach der Serverzeit (Uhr ging vor) zählt nicht als neuer, und „nicht bestanden“
// setzt sich gegen ein gespeichertes „bestanden“ immer durch — dann muss das Gerät einmal
// mehr geprüft werden, statt nach einer Reparatur ohne bestandene Prüfung als
// einsatzbereit zu gelten. Die App legt das Protokoll in derselben Sammelbuchung vorher
// an. Der Superuser darf korrigieren.
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const alt = e.record.original()
    const zeit = e.record.getString("last_inspection")
    const bestanden = e.record.getBool("last_inspection_passed")
    const bisher = alt.getString("last_inspection")
    if (zeit !== bisher || bestanden !== alt.getBool("last_inspection_passed")) {
      // Etwas Spielraum für eine falsch gehende Geräte-Uhr
      const grenze = new Date(Date.now() + 60 * 60000).toISOString().replace("T", " ")
      let protokoll = null
      if (zeit && zeit <= grenze) {
        try {
          protokoll = e.app.findFirstRecordByFilter("mpg_inspections", "device_id = {:d} && organization_id = {:o} && inspection_date = {:z}",
            { d: e.record.id, o: e.record.getString("organization_id"), z: zeit })
        } catch (err) { protokoll = null }
      }
      if (!protokoll || protokoll.getBool("passed") !== bestanden) {
        throw new BadRequestError("Der Prüfstand eines Geräts folgt aus dem neuesten gespeicherten Prüfprotokoll — bitte eine Prüfung erfassen.")
      }
      // Älter als der gespeicherte (der liegt nicht nach der Serverzeit): stehen lassen —
      // außer ein Durchfallen gegen ein gespeichertes Bestehen
      const jetzt = new Date().toISOString().replace("T", " ")
      const durchfallen = !bestanden && alt.getBool("last_inspection_passed")
      if (!!bisher && bisher <= jetzt && zeit < bisher && !durchfallen) {
        e.record.set("last_inspection", bisher)
        e.record.set("last_inspection_passed", alt.getBool("last_inspection_passed"))
        e.record.set("next_inspection_due", alt.getString("next_inspection_due"))
      }
    }
  }
  e.next()
}, "mpg_devices")

// ── Prüfprotokolle ─────────────────────────────────────────────────────────

onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const grenze = new Date(Date.now() + 60 * 60000).toISOString().replace("T", " ")
    if (e.record.getString("inspection_date") > grenze) {
      throw new BadRequestError("Das Prüfdatum liegt in der Zukunft — bitte Datum und Uhrzeit des Geräts prüfen.")
    }
    if (e.auth) {
      // Wer geprüft hat, setzt der Server aus der Anmeldung — Name und, wenn angelegt, Kennung
      try { e.record.set("user_name", e.auth.getString("name") || e.auth.getString("email")) } catch (err) { /* Feld fehlt */ }
      try { e.record.set("user_id", e.auth.id) } catch (err) { /* Feld fehlt — dann eben nicht */ }
    }
  }
  e.next()
}, "mpg_inspections")

// ── Gerätebuch ─────────────────────────────────────────────────────────────

onRecordCreateRequest((e) => {
  if (e.auth) {
    try { e.record.set("user_id", e.auth.id) } catch (err) { /* Feld fehlt — dann eben nicht */ }
    if (!e.hasSuperuserAuth()) {
      try { e.record.set("user_name", e.auth.getString("name") || e.auth.getString("email")) } catch (err) { /* Feld fehlt */ }
    }
  }
  e.next()
}, "mpg_ereignisse")

// ── Defekte und Meldungen von außen ────────────────────────────────────────

// Defekt und Eintrag mit der Kennung einer Meldung von außen entstehen beim Bestätigen
// (so kann eine Meldung nur einen Defekt erzeugen). Anlegen darf sie nur, wer die Meldung
// auch bearbeiten darf — sonst könnte jemand die Kennung vorab belegen und das
// Bestätigen blockieren. Als Melder steht dann der Name aus der Meldung.
onRecordCreateRequest((e) => {
  let meldung = null
  if (e.record.id) {
    try { meldung = e.app.findRecordById("mpg_defect_reports", e.record.id) } catch (err) { meldung = null }
  }
  if (meldung && !e.hasSuperuserAuth()) {
    const regel = meldung.collection().updateRule
    let darf = false
    try { darf = regel !== null && regel !== undefined && e.app.canAccessRecord(meldung, e.requestInfo(), regel) } catch (err) { darf = false }
    if (!darf) throw new ForbiddenError("Diese Kennung gehört zu einer Meldung von außen — sie bestätigt, wer „MPG verwalten“ hat.")
  }
  if (e.record.collection().name === "mpg_defects" && !e.hasSuperuserAuth()) {
    if (e.record.getString("status") !== "open") throw new BadRequestError("Ein Defekt wird offen angelegt.")
    if (meldung) {
      // Nur der Name: Die Kennung in einer Meldung von außen stammt aus dem Formular ohne
      // Anmeldung und ist nicht geprüft
      try { e.record.set("reported_by", meldung.getString("reporter_name") || "Externe Meldung") } catch (err) { /* Feld fehlt */ }
      try { e.record.set("reported_by_id", "") } catch (err) { /* Feld fehlt */ }
    } else if (e.auth) {
      try { e.record.set("reported_by", e.auth.getString("name") || e.auth.getString("email")) } catch (err) { /* Feld fehlt */ }
      try { e.record.set("reported_by_id", e.auth.id) } catch (err) { /* Feld fehlt — dann eben nicht */ }
    }
  }
  e.next()
}, "mpg_defects", "mpg_ereignisse")

// Wer behoben hat, setzt der Server beim Schließen — danach bleibt es, wie es ist
// (auch die Notiz dazu), auch in Sammelbuchungen. Behoben ist endgültig; Gerät, Melder und
// Organisation bleiben, wie angelegt (sonst ließe sich ein Defekt auf ein anderes Gerät
// umhängen und das ursprüngliche danach löschen), nach dem Beheben auch Beschreibung und
// Schwere.
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const alt = e.record.original()
    if (alt.getString("status") === "resolved" && e.record.getString("status") !== "resolved") {
      throw new BadRequestError("Ein behobener Defekt bleibt behoben — einen neuen Mangel bitte neu melden.")
    }
    if (!["open", "in_progress", "resolved"].includes(e.record.getString("status"))) {
      throw new BadRequestError("Unbekannter Status.")
    }
    // Ein behobener Defekt ist Nachweis: auch was gemeldet wurde, bleibt
    const fest = alt.getString("status") === "resolved"
      ? ["device_id", "organization_id", "reported_by", "reported_by_id", "device_name", "description", "severity"]
      : ["device_id", "organization_id", "reported_by", "reported_by_id"]
    for (const f of fest) {
      try { e.record.set(f, alt.getString(f)) } catch (err) { /* Feld fehlt */ }
    }
    if (e.auth && e.record.getString("status") === "resolved" && alt.getString("status") !== "resolved") {
      try { e.record.set("resolved_by", e.auth.getString("name") || e.auth.getString("email")) } catch (err) { /* Feld fehlt */ }
      try { e.record.set("resolved_by_id", e.auth.id) } catch (err) { /* Feld fehlt — dann eben nicht */ }
    } else {
      try { e.record.set("resolved_by", alt.getString("resolved_by")) } catch (err) { /* Feld fehlt */ }
      try { e.record.set("resolved_by_id", alt.getString("resolved_by_id")) } catch (err) { /* Feld fehlt */ }
      if (alt.getString("status") === "resolved") {
        try { e.record.set("resolved_notes", alt.getString("resolved_notes")) } catch (err) { /* Feld fehlt */ }
      }
    }
  }
  e.next()
}, "mpg_defects")

// Eine Meldung von außen darf keine Kennung tragen, die schon ein Defekt oder ein
// Eintrag im Gerätebuch hat — sonst sähe das Bestätigen sie als „schon angelegt“.
onRecordCreateRequest((e) => {
  if (e.record.id && !e.hasSuperuserAuth()) {
    let belegt = false
    for (const c of ["mpg_defects", "mpg_ereignisse"]) {
      try { e.app.findRecordById(c, e.record.id); belegt = true } catch (err) { /* frei oder Sammlung fehlt */ }
    }
    if (belegt) throw new BadRequestError("Diese Kennung ist schon vergeben.")
  }
  e.next()
}, "mpg_defect_reports")

// Eine bearbeitete Meldung (bestätigt oder abgelehnt) bleibt, wie sie ist — auch der
// Ablehnungsgrund; was gemeldet wurde — Gerät, Melder, Beschreibung, Schwere — bleibt
// immer, wie es ankam. Ablehnen geht nicht mehr, sobald aus der Meldung ein Defekt oder
// Eintrag entstanden ist (teilweise gespeicherte Bestätigung von einem anderen Gerät).
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const alt = e.record.original()
    const status = e.record.getString("status")
    if (alt.getString("status") !== "pending" && status !== alt.getString("status")) {
      throw new BadRequestError("Diese Meldung ist schon bearbeitet.")
    }
    if (!["pending", "confirmed", "rejected"].includes(status)) {
      throw new BadRequestError("Unbekannter Status.")
    }
    if (status === "rejected" && alt.getString("status") === "pending") {
      for (const c of ["mpg_defects", "mpg_ereignisse"]) {
        let da = false
        try { e.app.findRecordById(c, e.record.id); da = true } catch (err) { /* nicht da oder Sammlung fehlt */ }
        if (da) throw new BadRequestError("Aus dieser Meldung ist schon ein Defekt entstanden — sie wird bestätigt, nicht abgelehnt.")
      }
    }
    const fest = ["device_id", "device_name", "organization_id", "reporter_name", "reporter_user_id", "description", "severity"]
    if (alt.getString("status") !== "pending") fest.push("rejected_reason")
    for (const f of fest) {
      try { e.record.set(f, alt.getString(f)) } catch (err) { /* Feld fehlt */ }
    }
  }
  e.next()
}, "mpg_defect_reports")
