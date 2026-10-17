// PocketBase hook: CIRS-Meldungen  (PocketBase v0.23+ API)
//
// CIRS-Meldungen sind vertraulich, oft anonym. Die App zeigt sie nur Nutzern
// mit dem Recht für Vorgänge ("dokumente"). Diese Hooks halten dieselbe Regel
// auf dem Server — wer die API direkt anspricht, kommt nicht weiter als in der
// App:
//
//   Anlegen  : offen (die Meldeseite der Organisation). Eine mitgeschickte
//              "bearbeitung" wird entfernt, der Status ist immer "offen" —
//              eine Bearbeitung entsteht nur durch ein späteres Update.
//   Lesen    : nur mit Recht "dokumente" (oder Supervisor, oder befristetem
//              Recht, das noch läuft) und nur in der eigenen Organisation.
//   Ändern   : ebenso. Die Angaben des Melders (Ereignis, Beschreibung,
//              Name, Kontakt), Organisation und Titel bleiben, wie gemeldet —
//              geändert werden nur Bearbeitung und Status.
//   Löschen  : nur Superuser (z.B. für offensichtlichen Unsinn).
//
// Superuser (Admin-Oberfläche) sind von den Prüfungen ausgenommen.
//
// Die App prüft dasselbe noch einmal (bearbeitungAus in src/lib/cirs.ts,
// hatRecht in src/lib/apps.ts) — die Hooks sind die Ebene, an der niemand
// vorbeikommt.
//
// Wichtig: PocketBase führt jeden Handler isoliert aus — Hilfsfunktionen
// außerhalb sind darin nicht sichtbar. Deshalb steht die Rechteprüfung in
// jedem Handler selbst.
//
// Empfohlene API-Regeln für "cirs_reports" (zusätzlich zu den Hooks; an
// PocketBase 0.28 geprüft, auch für Echtzeit-Abos):
//   Create      : organization_id != ""
//   List/View/Update :
//     @request.auth.id != "" && organization_id = @request.auth.organization_id && (@request.auth.supervisor = true || @request.auth.permissions.dokumente = true)
//   (Ohne befristete Rechte: "temp_permissions.….until > @now" vergleicht als
//   Text und lässt ein am selben Tag abgelaufenes Recht bis Mitternacht
//   gelten — siehe docs/pocketbase-regeln.md.)
//   Delete      : gesperrt (Schloss in der Admin-Oberfläche, also null — nicht
//                 als leerer Text, das hieße "öffentlich")

onRecordCreateRequest((e) => {
  let payload = null
  try {
    payload = JSON.parse(e.record.getString("payload") || "null")
    // Manche Meldungen kommen doppelt kodiert als JSON-Text
    if (typeof payload === "string") payload = JSON.parse(payload)
  } catch (err) {
    payload = null
  }
  if (payload && typeof payload === "object" && !Array.isArray(payload) && payload.bearbeitung !== undefined) {
    delete payload.bearbeitung
    e.record.set("payload", payload)
  }
  e.record.set("status", "offen")
  e.next()
}, "cirs_reports")

onRecordsListRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const nutzer = e.auth
  let darf = false
  if (nutzer) {
    let rechte = {}, befristet = {}
    try { rechte = JSON.parse(nutzer.getString("permissions") || "{}") || {} } catch (err) { rechte = {} }
    try { befristet = JSON.parse(nutzer.getString("temp_permissions") || "{}") || {} } catch (err) { befristet = {} }
    const bis = befristet && befristet.dokumente && befristet.dokumente.until ? new Date(String(befristet.dokumente.until).replace(" ", "T")).getTime() : 0
    darf = nutzer.getBool("supervisor") || rechte.dokumente === true || bis > Date.now()
  }
  if (!darf) throw new ForbiddenError("CIRS-Meldungen sind nur mit dem Recht für Vorgänge einsehbar.")
  e.next()
}, "cirs_reports")

onRecordViewRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const nutzer = e.auth
  let darf = false
  if (nutzer && nutzer.getString("organization_id") === e.record.getString("organization_id")) {
    let rechte = {}, befristet = {}
    try { rechte = JSON.parse(nutzer.getString("permissions") || "{}") || {} } catch (err) { rechte = {} }
    try { befristet = JSON.parse(nutzer.getString("temp_permissions") || "{}") || {} } catch (err) { befristet = {} }
    const bis = befristet && befristet.dokumente && befristet.dokumente.until ? new Date(String(befristet.dokumente.until).replace(" ", "T")).getTime() : 0
    darf = nutzer.getBool("supervisor") || rechte.dokumente === true || bis > Date.now()
  }
  if (!darf) throw new ForbiddenError("CIRS-Meldungen sind nur mit dem Recht für Vorgänge einsehbar.")
  e.next()
}, "cirs_reports")

onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const original = e.record.original()
  const nutzer = e.auth
  let darf = false
  if (nutzer && nutzer.getString("organization_id") === original.getString("organization_id")) {
    let rechte = {}, befristet = {}
    try { rechte = JSON.parse(nutzer.getString("permissions") || "{}") || {} } catch (err) { rechte = {} }
    try { befristet = JSON.parse(nutzer.getString("temp_permissions") || "{}") || {} } catch (err) { befristet = {} }
    const bis = befristet && befristet.dokumente && befristet.dokumente.until ? new Date(String(befristet.dokumente.until).replace(" ", "T")).getTime() : 0
    darf = nutzer.getBool("supervisor") || rechte.dokumente === true || bis > Date.now()
  }
  if (!darf) throw new ForbiddenError("CIRS-Meldungen dürfen nur mit dem Recht für Vorgänge bearbeitet werden.")

  const lesen = (text) => {
    try {
      let p = JSON.parse(text || "null")
      if (typeof p === "string") p = JSON.parse(p)
      return p && typeof p === "object" && !Array.isArray(p) ? p : null
    } catch (err) {
      return null
    }
  }
  const vorher = lesen(original.getString("payload"))
  const nachher = lesen(e.record.getString("payload"))
  // Die Angaben des Melders bleiben, wie gemeldet — nur Bearbeitung und Status ändern sich
  const MELDER = ["datum", "ort", "kategorie", "schwere", "was", "warum", "folgen", "vorschlag", "melder_name", "melder_kontakt"]
  if (vorher) {
    const zusammen = nachher || {}
    for (const k of MELDER) {
      if (vorher[k] !== undefined) zusammen[k] = vorher[k]
      else delete zusammen[k]
    }
    // Der Verlauf wird nur ergänzt: was schon drinsteht, bleibt wörtlich stehen,
    // neue Einträge kommen dahinter. Wer alte Einträge ändert oder streicht,
    // bekommt sie zurück — ein Verlauf, den man umschreiben kann, belegt nichts.
    const alteB = vorher.bearbeitung && typeof vorher.bearbeitung === "object" ? vorher.bearbeitung : null
    if (alteB) {
      if (!zusammen.bearbeitung || typeof zusammen.bearbeitung !== "object" || Array.isArray(zusammen.bearbeitung)) {
        zusammen.bearbeitung = alteB
      } else if (Array.isArray(alteB.verlauf)) {
        const alt = alteB.verlauf.filter((x) => x && typeof x.id === "string")
        const ids = {}
        for (const x of alt) ids[x.id] = true
        const neu = (Array.isArray(zusammen.bearbeitung.verlauf) ? zusammen.bearbeitung.verlauf : []).filter((x) => x && typeof x.id === "string" && !ids[x.id])
        zusammen.bearbeitung.verlauf = alt.concat(neu)
      }
    }
    e.record.set("payload", zusammen)
  } else if (original.getString("payload") && original.getString("payload") !== "null") {
    // Ein payload, das sich nicht lesen lässt, enthält trotzdem die Meldung — nicht überschreiben
    e.record.set("payload", original.get("payload"))
  }
  e.record.set("organization_id", original.getString("organization_id"))
  e.record.set("title", original.getString("title"))
  e.next()
}, "cirs_reports")

// Echtzeit prüft PocketBase nur gegen die API-Regeln, nicht gegen die Hooks oben.
// Ohne Recht im Regeltext käme eine neue Meldung über ein Abo trotzdem an —
// deshalb hier dieselbe Prüfung für jede Echtzeit-Nachricht zu cirs_reports.
onRealtimeMessageSend((e) => {
  const name = e.message ? String(e.message.name || "") : ""
  if (name.indexOf("cirs_reports/") !== 0) return e.next()
  const nutzer = e.client.get("auth")
  let darf = false
  if (nutzer) {
    if (nutzer.isSuperuser && nutzer.isSuperuser()) return e.next()
    let rechte = {}, befristet = {}
    try { rechte = JSON.parse(nutzer.getString("permissions") || "{}") || {} } catch (err) { rechte = {} }
    try { befristet = JSON.parse(nutzer.getString("temp_permissions") || "{}") || {} } catch (err) { befristet = {} }
    const bis = befristet && befristet.dokumente && befristet.dokumente.until ? new Date(String(befristet.dokumente.until).replace(" ", "T")).getTime() : 0
    darf = nutzer.getBool("supervisor") || rechte.dokumente === true || bis > Date.now()
  }
  // Ohne Recht: die Nachricht nicht weitergeben
  if (darf) e.next()
})

onRecordDeleteRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  throw new ForbiddenError("CIRS-Meldungen werden nicht gelöscht — eine erledigte Meldung wird abgeschlossen.")
}, "cirs_reports")
