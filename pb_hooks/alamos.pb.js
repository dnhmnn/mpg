// PocketBase hook: Alamos FE2 Webhook-Empfang  (PocketBase v0.23+ API)
//
// Alamos (FE2) sendet bei Alarmierung einen HTTP-POST an:
//   https://api.responda.systems/alamos/<organization_id>
//
// Dieser Hook legt daraus automatisch einen Einsatz in der Collection
// "einsaetze" an. Die organization_id steckt im URL-Pfad, sodass jede
// Organisation ihre eigene, fertig vorbereitete Webhook-URL kopieren kann.
//
// Felder der Collection "einsaetze" (müssen existieren):
//   unit (text), keyword (text), adresse (text), datum (date),
//   status (select: aktiv/abgeschlossen/abgebrochen), organization_id (text/relation),
//   alamos_id (text)
//
// Der Body von Alamos ist frei konfigurierbar — daher akzeptieren wir mehrere
// gängige Feldnamen (deutsch/englisch). Mindestens "unit" und "keyword" sollten
// in Alamos aktiviert sein.

routerAdd("POST", "/alamos/{orgId}", (e) => {
  const orgId = e.request.pathValue("orgId")
  if (!orgId) {
    return e.json(400, { success: false, error: "organization_id fehlt in der URL" })
  }

  // Organisation prüfen, damit falsch eingetragene URLs sofort auffallen
  try {
    $app.findRecordById("organizations", orgId)
  } catch (err) {
    return e.json(404, { success: false, error: "Unbekannte organization_id: " + orgId })
  }

  const body = e.requestInfo().body || {}

  // Feld-Mapping mit Aliassen (Alamos-Platzhalter sind frei benannt)
  const pick = (...keys) => {
    for (let i = 0; i < keys.length; i++) {
      const v = body[keys[i]]
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim()
    }
    return ""
  }

  const unit     = pick("unit", "einheit", "einheiten", "einheitenkennung", "unit_id")
  const keyword  = pick("keyword", "stichwort", "schlagwort", "einsatzstichwort", "alarm")
  let   adresse  = pick("adresse", "address", "ort", "einsatzort", "location")
  if (!adresse) {
    const strasse = pick("strasse", "street")
    const ort     = pick("stadt", "city", "ortsteil")
    adresse = [strasse, ort].filter(Boolean).join(", ")
  }
  const alamosId = pick("alamos_id", "id", "einsatznummer", "einsatz_id", "externeNummer", "number")
  const datumRaw = pick("datum", "alarmzeit", "timestamp", "time", "alarmierung", "created")

  // Datum parsen, sonst aktuelle Serverzeit
  let datumIso
  if (datumRaw) {
    const d = new Date(datumRaw)
    datumIso = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
  } else {
    datumIso = new Date().toISOString()
  }

  // Doppelte Alarme vermeiden: existiert dieser alamos_id für die Org schon?
  if (alamosId) {
    try {
      const existing = $app.findFirstRecordByFilter(
        "einsaetze",
        "organization_id = {:org} && alamos_id = {:aid}",
        { org: orgId, aid: alamosId }
      )
      if (existing) {
        return e.json(200, { success: true, duplicate: true, id: existing.id })
      }
    } catch (err) {
      // kein Treffer -> normal weiter
    }
  }

  try {
    const collection = $app.findCollectionByNameOrId("einsaetze")
    const record = new Record(collection)
    record.set("unit", unit || "Unbekannt")
    record.set("keyword", keyword)
    record.set("adresse", adresse)
    record.set("datum", datumIso)
    record.set("status", "aktiv")
    record.set("organization_id", orgId)
    record.set("alamos_id", alamosId)
    $app.save(record)
    return e.json(200, { success: true, id: record.id })
  } catch (err) {
    console.log("alamos webhook error:", err.message)
    return e.json(500, { success: false, error: err.message })
  }
})
