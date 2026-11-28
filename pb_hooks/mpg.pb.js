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
//                    Ein außer Betrieb genommenes Gerät lässt sich „löschen“ (Feld geloescht, Owner
//                    27.11.2026): Es verschwindet aus den Listen der App, seine Nachweise bleiben fünf
//                    Jahre (Medizinproduktebuch), gerechnet ab dem Löschen (Serverzeit), frühestens ab
//                    der Außerbetriebnahme, und werden danach von der nächtlichen Aufbewahrung unten
//                    endgültig gelöscht — nur von ihr, nie früher.
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

// Auch ohne API-Anfrage: „Truncate“ in der Admin-Oberfläche löscht Datensatz für Datensatz.
// Einzige Ausnahme: die Aufbewahrung unten nach Ablauf der fünf Jahre (Merker je Datensatz,
// nur während ihres eigenen Löschens gesetzt).
onRecordDelete((e) => {
  if ($app.store().get("responda:mpg_tilgen:" + e.record.id) === true) return e.next()
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
  if ($app.store().get("responda:mpg_tilgen:" + e.record.id) === true) return e.next()
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

// Löschen nach der Außerbetriebnahme (Feld geloescht): nur ein außer Betrieb genommenes Gerät,
// nur mit „MPG verwalten“ (zweite Ebene zur Regel ²), den Zeitpunkt setzt der Server — er ist der
// Beginn der Aufbewahrung, ein Datum vom Gerät zählt dafür nicht. Danach bleibt das Gerät, wie es
// ist — Gerätebuch, Prüfungen und Defekte sind Nachweise bis zum Ende der Aufbewahrung. Erlaubt ist
// nur das Wiederherstellen (geloescht leeren), und auch das ändert sonst nichts. Ebenso braucht der
// Abstand bei „alle N Tage“ (interval_days) „MPG verwalten“. Der Superuser darf korrigieren.
onRecordUpdateRequest((e) => {
  const alt = e.record.original()
  let vorher = "", jetzt = ""
  try { vorher = alt.getString("geloescht"); jetzt = e.record.getString("geloescht") } catch (err) { return e.next() }
  const gesetzt = (r, f) => { try { return String(r.getString(f) || "").trim() !== "" } catch (err) { return false } }
  // „MPG verwalten“ wie in den Regeln: Leitung, MPG-Beauftragte, Supervisor, Häkchen, auch befristet
  const verwalten = () => {
    const a = e.auth
    if (!a) return false
    try { if (a.getBool("supervisor")) return true } catch (err) { /* Feld fehlt */ }
    const rolle = a.getString("role")
    if (rolle === "admin" || rolle === "mpg") return true
    let p = {}, t = {}
    try { p = JSON.parse(a.getString("permissions") || "{}") || {} } catch (err) { p = {} }
    if (p.mpg_verwalten === true) return true
    try { t = JSON.parse(a.getString("temp_permissions") || "{}") || {} } catch (err) { t = {} }
    const bis = t.mpg_verwalten && typeof t.mpg_verwalten.until === "string" ? t.mpg_verwalten.until : ""
    return bis.indexOf(" ") > 0 && bis > new Date().toISOString().replace("T", " ")
  }
  if (!e.hasSuperuserAuth()) {
    let tageAlt = "", tageNeu = ""
    try { tageAlt = alt.getString("interval_days"); tageNeu = e.record.getString("interval_days") } catch (err) { /* Feld fehlt */ }
    if ((tageAlt !== tageNeu || vorher !== jetzt) && !verwalten()) {
      throw new ForbiddenError("Das braucht das Recht „MPG verwalten“.")
    }
  }
  if (!vorher && jetzt) {
    if (!gesetzt(alt, "ausser_betrieb") || !gesetzt(e.record, "ausser_betrieb")) {
      throw new BadRequestError("Löschen geht nur bei einem Gerät, das außer Betrieb genommen ist.")
    }
    e.record.set("geloescht", new Date().toISOString().replace("T", " "))
  } else if (vorher && !e.hasSuperuserAuth()) {
    const felder = ["name", "type", "serial_number", "location", "interval", "interval_days", "last_inspection", "last_inspection_passed",
      "next_inspection_due", "operational", "has_stk", "last_stk", "stk_interval_months", "has_mtk", "last_mtk", "mtk_interval_months",
      "ausser_betrieb", "ausser_betrieb_grund", "verbleib", "inbetriebnahme", "organization_id"]
    for (const f of felder) {
      let a = "", n = ""
      try { a = alt.getString(f); n = e.record.getString(f) } catch (err) { continue }
      if (a !== n) throw new BadRequestError("Das Gerät ist gelöscht und bleibt, wie es ist — zum Ändern erst wiederherstellen.")
    }
    if (jetzt && jetzt !== vorher) e.record.set("geloescht", vorher)
  }
  e.next()
}, "mpg_devices")

// Ein neues Gerät hat noch keinen Prüfstand — den gibt es erst mit dem ersten Protokoll. Und es ist nicht
// gelöscht: Löschen geht nur über das Ändern eines außer Betrieb genommenen Geräts (Zeitpunkt vom Server).
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth() && (e.record.getString("last_inspection") || e.record.getBool("last_inspection_passed"))) {
    throw new BadRequestError("Der Prüfstand eines Geräts folgt aus einem gespeicherten Prüfprotokoll — bitte eine Prüfung erfassen.")
  }
  let geloescht = ""
  try { geloescht = e.record.getString("geloescht") } catch (err) { geloescht = "" }
  if (geloescht && !e.hasSuperuserAuth()) throw new BadRequestError("Ein neues Gerät ist nicht gelöscht — löschen geht erst nach der Außerbetriebnahme.")
  e.next()
}, "mpg_devices")

// STK, MTK und Inbetriebnahme liegen nie in der Zukunft — ein Tippfehler im Jahr oder eine
// vorgehende Uhr gäbe sonst ein überfälliges Gerät für Jahre frei (ein Tag Spielraum für die
// Zeitzone). Beim Ändern nur, was sich ändert: ein alter Wert blockiert nichts anderes.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const grenze = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    for (const f of ["last_stk", "last_mtk", "inbetriebnahme"]) {
      let wert = ""
      try { wert = e.record.getString(f).slice(0, 10) } catch (err) { /* Feld fehlt */ }
      if (wert && wert > grenze) throw new BadRequestError("Ein Datum liegt in der Zukunft — bitte prüfen (letzte STK, letzte MTK, Inbetriebnahme).")
    }
  }
  e.next()
}, "mpg_devices")

onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const alt = e.record.original()
    const grenze = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    for (const f of ["last_stk", "last_mtk", "inbetriebnahme"]) {
      let wert = "", vorher = ""
      try { wert = e.record.getString(f).slice(0, 10); vorher = alt.getString(f).slice(0, 10) } catch (err) { /* Feld fehlt */ }
      if (wert && wert !== vorher && wert > grenze) throw new BadRequestError("Ein Datum liegt in der Zukunft — bitte prüfen (letzte STK, letzte MTK, Inbetriebnahme).")
    }
  }
  e.next()
}, "mpg_devices")

// Nach einer nicht bestandenen STK/MTK bleibt das Gerät gesperrt, bis eine bestandene im
// Gerätebuch steht: Freigeben (operational → true) und ein späteres Datum der letzten
// Kontrolle am Gerät gehen erst dann — sonst hinge die Sperre allein an der App. Wird die
// Kontrolle wieder verlangt (Häkchen an), wird das Gerät gesperrt. Die neueste Kontrolle zählt
// nach ihrem Tag (angaben.datum, sonst Tag des Eintrags), bei gleichem Tag nach der
// Eintragszeit; fehlt der Eintrag, zählt ihr Defekt („STK nicht bestanden: …“). Gleiche Regel
// in der App (src/lib/mpg/kontrollen.ts). Nur Einträge und Defekte der Organisation des Geräts.
// Eine nachgetragene ältere zählt nicht, wenn am Gerät schon eine neuere bestandene steht.
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const alt = e.record.original()
    const org = alt.getString("organization_id")
    const grenze = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const freigabe = e.record.getBool("operational") && !alt.getBool("operational")
    for (const art of ["stk", "mtk"]) {
      const name = art === "stk" ? "STK" : "MTK"
      let anNeu = false, anAlt = false, neu = "", vorher = ""
      try {
        anNeu = e.record.getBool("has_" + art)
        anAlt = alt.getBool("has_" + art)
        neu = e.record.getString("last_" + art).slice(0, 10)
        vorher = alt.getString("last_" + art).slice(0, 10)
      } catch (err) { continue }
      const spaeter = !!neu && neu !== vorher
      const wiederAn = anNeu && !anAlt
      if (!((freigabe && (anNeu || anAlt)) || spaeter || wiederAn)) continue
      // Neueste Kontrolle dieser Art
      let beste = null
      const vergleiche = (tag, created, bestanden) => {
        if (!beste || tag > beste.tag || (tag === beste.tag && created > beste.created)) beste = { tag, created, bestanden }
      }
      let eintraege = []
      try {
        eintraege = e.app.findRecordsByFilter("mpg_ereignisse", "device_id = {:d} && organization_id = {:o} && art = {:a}", "-created", 500, 0, { d: e.record.id, o: org, a: art })
      } catch (err) { eintraege = [] }
      const verknuepft = {}
      for (const x of eintraege) {
        let angaben = {}
        try { angaben = JSON.parse(x.getString("angaben") || "null") || {} } catch (err) { angaben = {} }
        if (x.getString("bezug")) verknuepft[x.getString("bezug")] = true
        const created = x.getString("created")
        let tag = String(angaben.datum || "").trim()
        if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || tag > grenze) tag = created.slice(0, 10)
        const ergebnis = angaben.ergebnis || (/nicht bestanden/.test(x.getString("text").split("\n")[0]) ? "nicht_bestanden" : "bestanden")
        vergleiche(tag, created, ergebnis !== "nicht_bestanden")
      }
      // Defekte aus nicht bestandenen Kontrollen ohne eigenen Eintrag
      let defekte = []
      try {
        defekte = e.app.findRecordsByFilter("mpg_defects", "device_id = {:d} && organization_id = {:o} && description ~ {:p}", "-created", 500, 0, { d: e.record.id, o: org, p: name + " nicht bestanden:" })
      } catch (err) { defekte = [] }
      for (const d of defekte) {
        if (verknuepft[d.id] || d.getString("description").indexOf(name + " nicht bestanden:") !== 0) continue
        vergleiche(d.getString("created").slice(0, 10), d.getString("created"), false)
      }
      if (!beste || beste.bestanden) continue
      const letzte = vorher && vorher <= grenze ? vorher : ""
      if (letzte && beste.tag < letzte) continue
      if (spaeter && neu >= beste.tag) throw new BadRequestError(`Letzte ${name} nicht bestanden — eine neue ${name} bitte über „Eintragen“ mit Prüfer und Protokoll erfassen.`)
      if (freigabe && (anNeu || anAlt) && !(anAlt && !anNeu)) throw new BadRequestError(`Letzte ${name} nicht bestanden — erst eine bestandene ${name} eintragen, dann freigeben.`)
      if (wiederAn) e.record.set("operational", false)
    }
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

// Eine STK oder MTK: Tag der Kontrolle als JJJJ-MM-TT und nicht in der Zukunft. Einträge
// gehören zur Organisation ihres Geräts — sonst zählte ein fremder Eintrag für dessen Sperre.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const art = e.record.getString("art")
    if (art === "stk" || art === "mtk") {
      let datum = ""
      try { datum = String((JSON.parse(e.record.getString("angaben") || "null") || {}).datum || "").trim() } catch (err) { datum = "" }
      if (datum && !/^\d{4}-\d{2}-\d{2}$/.test(datum)) throw new BadRequestError("Den Tag der Kontrolle bitte als JJJJ-MM-TT angeben.")
      if (datum && datum > new Date(Date.now() + 86400000).toISOString().slice(0, 10)) {
        throw new BadRequestError("Der Tag der Kontrolle liegt in der Zukunft — bitte prüfen.")
      }
    }
    let geraet = null
    try { geraet = e.app.findRecordById("mpg_devices", e.record.getString("device_id")) } catch (err) { geraet = null }
    if (geraet && geraet.getString("organization_id") !== e.record.getString("organization_id")) {
      throw new ForbiddenError("Dieses Gerät gehört zu einer anderen Organisation.")
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
      // Die Kennung des Melders nur, wenn der Server ihn bestätigt hat (Passwort, Anmeldung oder
      // nachgereichte Unterschrift, reporter_status, formular.pb.js). Sonst nur der Name: Eine
      // nicht bestätigte Kennung beweist nicht, wer gemeldet hat. reporter_status zählt nur, wenn
      // formular.pb.js geladen ist (Merker beim Start): Ohne die Datei (Rücknahme) setzt niemand
      // das Feld, und die offene Create-Regel nähme einen gefälschten Wert an.
      let melderId = ""
      try {
        const aktiv = $app.store().get("responda:formular_aktiv") === true
        if (aktiv && meldung.getString("reporter_status") === "bestaetigt") melderId = meldung.getString("reporter_user_id")
      } catch (err) { melderId = "" }
      try { e.record.set("reported_by", meldung.getString("reporter_name") || "Externe Meldung") } catch (err) { /* Feld fehlt */ }
      try { e.record.set("reported_by_id", melderId) } catch (err) { /* Feld fehlt */ }
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
    // reporter_status setzt nur der Server (formular.pb.js: Absenden, Unterschreiben)
    const fest = ["device_id", "device_name", "organization_id", "reporter_name", "reporter_user_id", "reporter_status", "description", "severity"]
    if (alt.getString("status") !== "pending") fest.push("rejected_reason")
    for (const f of fest) {
      try { e.record.set(f, alt.getString(f)) } catch (err) { /* Feld fehlt */ }
    }
    // Eigene Angaben (JSON, setzt nur formular.pb.js beim Absenden) bleiben, wie gemeldet
    let mitEigenen = false
    try { mitEigenen = !!e.record.collection().fields.getByName("eigene") } catch (err) { mitEigenen = false }
    if (mitEigenen) {
      try { e.record.set("eigene", alt.get("eigene")) } catch (err) { /* Feld ohne Wert */ }
    }
  }
  e.next()
}, "mpg_defect_reports")

// ── Aufbewahrung ───────────────────────────────────────────────────────────

// Gelöschte Geräte (außer Betrieb genommen, dann gelöscht) mit allen Nachweisen endgültig löschen,
// sobald die Aufbewahrung abgelaufen ist: fünf Jahre nach dem spätesten von Datum der
// Außerbetriebnahme, Zeitpunkt des Löschens (setzt der Server) und neuestem Eintrag im Gerätebuch.
// So löscht ein rückdatiertes oder vertipptes Datum nie früher, und ein später nachgetragener Vermerk
// verlängert die Frist. Die App zeigt „mindestens bis“ aus Datum und Löschen, also nie später als hier.
// Einmal in der Nacht, je Gerät in einer Transaktion, die alles noch einmal selbst liest (wird ein
// Gerät gerade wiederhergestellt, bleibt es).
cronAdd("mpg_aufbewahrung", "23 3 * * *", () => {
  const plusJahre = (tag, n) => {
    const t = String(tag).split("-").map(Number)
    const ziel = new Date(Date.UTC(t[0] + n, t[1] - 1, 1))
    const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0)).getUTCDate()
    return new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth(), Math.min(t[2], letzter))).toISOString().slice(0, 10)
  }
  const tag = (s) => { const t = String(s || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "" }
  // Ende der Aufbewahrung eines Geräts, alles über app gelesen (in der Transaktion: tx)
  const ende = (app, g) => {
    const seit = tag(g.getString("ausser_betrieb")), geloescht = tag(g.getString("geloescht"))
    if (!seit || !geloescht) return ""
    let ab = seit > geloescht ? seit : geloescht
    try {
      const neuester = app.findRecordsByFilter("mpg_ereignisse", "device_id = {:d} && organization_id = {:o}", "-created", 1, 0, { d: g.id, o: g.getString("organization_id") })
      if (neuester.length) { const t = tag(neuester[0].getString("created")); if (t > ab) ab = t }
    } catch (err) { /* ohne Gerätebuch zählen Datum und Löschen */ }
    return plusJahre(ab, 5)
  }
  const heute = new Date().toISOString().slice(0, 10)
  let geraete = []
  try {
    $app.findCollectionByNameOrId("mpg_devices").fields.getByName("geloescht").name
    geraete = $app.findRecordsByFilter("mpg_devices", "geloescht != '' && ausser_betrieb != ''", "", 0, 0)
  } catch (err) { return }
  for (const kandidat of geraete) {
    const org = kandidat.getString("organization_id")
    try {
      const bis = ende($app, kandidat)
      if (!bis || heute <= bis) continue
      const zahl = { ereignisse: 0, pruefungen: 0, defekte: 0, meldungen: 0 }
      let getilgt = false
      $app.runInTransaction((tx) => {
        // Noch einmal in der Transaktion: inzwischen wiederhergestellt oder die Frist verlängert → bleibt
        let g = null
        try { g = tx.findRecordById("mpg_devices", kandidat.id) } catch (err) { g = null }
        if (!g) return
        const b = ende(tx, g)
        if (!b || heute <= b) return
        const weg = (r) => {
          const k = "responda:mpg_tilgen:" + r.id
          $app.store().set(k, true)
          try { tx.delete(r) } finally { $app.store().remove(k) }
        }
        for (const [c, z] of [["mpg_ereignisse", "ereignisse"], ["mpg_inspections", "pruefungen"], ["mpg_defects", "defekte"], ["mpg_defect_reports", "meldungen"]]) {
          try { tx.findCollectionByNameOrId(c) } catch (err) { continue }
          const liste = tx.findRecordsByFilter(c, "device_id = {:d} && organization_id = {:o}", "", 0, 0, { d: g.id, o: org })
          for (const r of liste) { weg(r); zahl[z]++ }
        }
        weg(g)
        getilgt = true
      })
      if (getilgt) {
        $app.logger().info("MPG: gelöschtes Gerät nach Ablauf der Aufbewahrung endgültig gelöscht",
          "device", kandidat.id, "organization", org, "ausser_betrieb", tag(kandidat.getString("ausser_betrieb")), "geloescht", tag(kandidat.getString("geloescht")),
          "ereignisse", zahl.ereignisse, "pruefungen", zahl.pruefungen, "defekte", zahl.defekte, "meldungen", zahl.meldungen)
      }
    } catch (err) {
      $app.logger().error("MPG: Aufbewahrung — endgültiges Löschen fehlgeschlagen", "device", kandidat.id, "organization", org, "error", String(err))
    }
  }
})

// Welche Fassung dieses Hooks läuft (für scripts/mpg-einrichten.py; nur Superuser).
// Fassung 2: Löschen nach der Außerbetriebnahme mit Aufbewahrung, Prüfintervall „alle N Tage“.
// Fassung 3: Aufbewahrung ab dem Löschen (Serverzeit), Löschen und Tage nur mit „MPG verwalten“.
routerAdd("GET", "/api/responda/mpg/fassung", (e) => {
  return e.json(200, { fassung: 3 })
}, $apis.requireSuperuserAuth())
