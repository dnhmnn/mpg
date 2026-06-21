// PocketBase hook: Alamos FE2 Webhook-Empfang
//
// Alamos (FE2) sendet bei Alarmierung einen HTTP-POST an:
//   https://api.responda.systems/alamos/<organization_id>
//
// Dieser Hook legt daraus automatisch einen Einsatz in der Collection
// "einsaetze" an. Die organization_id steckt im URL-Pfad, sodass jede
// Organisation ihre eigene, fertig vorbereitete Webhook-URL kopieren kann
// (siehe Alamos-Konfiguration in der Einsaetze-Seite).
//
// Felder der Collection "einsaetze" (müssen existieren):
//   unit (text), keyword (text), adresse (text), datum (date),
//   status (select: aktiv/abgeschlossen/abgebrochen), organization_id (text/relation),
//   alamos_id (text), karte_geojson (text), interne_vermerke (text)
//
// Der Body von Alamos ist frei konfigurierbar — daher akzeptieren wir mehrere
// gängige Feldnamen (deutsch/englisch). Mindestens "unit" und "keyword" sollten
// in Alamos aktiviert sein.

routerAdd("POST", "/alamos/:orgId", (c) => {
  const orgId = c.pathParam("orgId")
  if (!orgId) {
    return c.json(400, { success: false, error: "organization_id fehlt in der URL" })
  }

  // Organisation prüfen, damit falsch eingetragene URLs sofort auffallen
  try {
    $app.dao().findRecordById("organizations", orgId)
  } catch (e) {
    return c.json(404, { success: false, error: "Unbekannte organization_id: " + orgId })
  }

  const body = $apis.requestInfo(c).data || {}

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
      const existing = $app.dao().findFirstRecordByFilter(
        "einsaetze",
        "organization_id = {:org} && alamos_id = {:aid}",
        { org: orgId, aid: alamosId }
      )
      if (existing) {
        return c.json(200, { success: true, duplicate: true, id: existing.id })
      }
    } catch (e) {
      // kein Treffer -> normal weiter
    }
  }

  try {
    const collection = $app.dao().findCollectionByNameOrId("einsaetze")
    const record = new Record(collection)
    record.set("unit", unit || "Unbekannt")
    record.set("keyword", keyword)
    record.set("adresse", adresse)
    record.set("datum", datumIso)
    record.set("status", "aktiv")
    record.set("organization_id", orgId)
    record.set("alamos_id", alamosId)
    $app.dao().saveRecord(record)
    return c.json(200, { success: true, id: record.id })
  } catch (e) {
    console.log("alamos webhook error:", e.message)
    return c.json(500, { success: false, error: e.message })
  }
})
