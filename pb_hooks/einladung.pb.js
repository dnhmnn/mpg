// PocketBase hook: Einladungs-Rückmeldungen (RSVP)  (PocketBase v0.23+ API)
//
// Nimmt Zu-/Absagen vom öffentlichen Einladungslink entgegen und legt pro
// (Token + Name) genau EINEN Datensatz in "ausbildungen_einladungen" an bzw.
// aktualisiert ihn. Läuft mit Admin-Rechten ($app), daher braucht die
// Collection KEINE öffentlichen List-/Update-Regeln (sicherer).
//
//   POST /einladung/respond   Body: { token, name, status: "zusagen"|"absagen" }

routerAdd("POST", "/einladung/respond", (e) => {
  const data = e.requestInfo().body || {}
  const token = (data.token || "").toString().trim()
  const name = (data.name || "").toString().trim()
  const status = (data.status || "").toString().trim()

  if (!token || !name || (status !== "zusagen" && status !== "absagen")) {
    return e.json(400, { success: false, error: "Ungültige Eingabe" })
  }

  // Token prüfen + Termin/Organisation ermitteln
  let tok
  try {
    tok = $app.findFirstRecordByFilter("ausbildungen_einladungs_tokens", "token = {:t}", { t: token })
  } catch (err) {
    return e.json(404, { success: false, error: "Einladung nicht gefunden" })
  }
  const terminId = tok.get("termin_id")
  const orgId = tok.get("organization_id")

  try {
    // Bestehende Antwort gleichen Namens für diesen Token -> aktualisieren
    let rec = null
    try {
      rec = $app.findFirstRecordByFilter(
        "ausbildungen_einladungen",
        "token = {:t} && name = {:n}",
        { t: token, n: name }
      )
    } catch (err) { rec = null }

    if (rec) {
      rec.set("status", status)
      rec.set("termin_id", terminId)
      if (orgId) rec.set("organization_id", orgId)
      $app.save(rec)
    } else {
      const col = $app.findCollectionByNameOrId("ausbildungen_einladungen")
      rec = new Record(col)
      rec.set("token", token)
      rec.set("termin_id", terminId)
      rec.set("name", name)
      rec.set("status", status)
      if (orgId) rec.set("organization_id", orgId)
      $app.save(rec)
    }

    return e.json(200, { success: true, id: rec.id, status: status })
  } catch (err) {
    console.log("einladung respond error:", err.message)
    return e.json(500, { success: false, error: err.message })
  }
})
