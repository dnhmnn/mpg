// PocketBase hook: Einsätze (läuft ab PocketBase 0.23.4)
//
// 1. Einsatz aus der Dokumentation
// Owner 22.11.2026: Einsätze entstehen nicht mehr über Alamos, sondern sobald ein Patientenprotokoll
// (patients, Feld payload.einsatz_nr) oder eine Produktausgabe (product_outputs, payload.einsatz) mit
// einer Einsatznummer abgeschickt wird. Gibt es in der Organisation schon einen Einsatz mit derselben
// Nummer (letzte 60 Tage, ohne Rücksicht auf Leerzeichen und Groß/Klein), bleibt es bei diesem.
// In den Einsatz kommen nur Nummer, Datum und Einsatzart, nie Namen oder Adressen.
// Regeln: pb_hooks/einsatz-regeln.js (Prüffälle src/lib/__tests__/einsatzRegeln.test.ts).
//
// Läuft nach dem Speichern (auch aus Routen, Transaktionen und dem Batch). Ein Fehler hier hält das
// Protokoll nie auf: Es ist schon gespeichert, der Einsatz fehlt dann nur und steht im Log.

onRecordAfterCreateSuccess((e) => {
  try {
    const R = require(`${__hooks}/einsatz-regeln.js`)
    const rec = e.record
    const sammlung = rec.collection().name
    const org = rec.getString("organization_id")
    const daten = org ? R.ausDatensatz(sammlung, rec.getString("payload"), rec.getString("created")) : null
    if (daten) {
      let kandidaten = []
      try {
        const ab = R.suchenAb(Date.now())
        const recs = $app.findRecordsByFilter("einsaetze", "organization_id = {:org} && created >= {:ab}", "-created", 500, 0, { org: org, ab: ab })
        for (let i = 0; i < recs.length; i++) kandidaten.push({ id: recs[i].id, unit: recs[i].getString("unit") })
      } catch (err) {
        // Sammlung ohne created (sehr alt): ohne Zeitgrenze suchen
        const recs = $app.findRecordsByFilter("einsaetze", "organization_id = {:org}", "", 500, 0, { org: org })
        for (let i = 0; i < recs.length; i++) kandidaten.push({ id: recs[i].id, unit: recs[i].getString("unit") })
      }
      const schon = R.vorhanden(kandidaten, daten.nummer)
      if (schon) {
        $app.logger().info("[einsatz] vorhanden", "aus", sammlung, "einsatz", schon.id)
      } else {
        const neu = new Record($app.findCollectionByNameOrId("einsaetze"))
        neu.set("unit", daten.nummer)
        neu.set("keyword", daten.art)
        neu.set("adresse", "")
        neu.set("datum", daten.datum)
        neu.set("status", R.STATUS_NEU)
        neu.set("organization_id", org)
        neu.set("alamos_id", "")
        $app.save(neu)
        $app.logger().info("[einsatz] angelegt", "aus", sammlung, "einsatz", neu.id)
      }
    }
  } catch (err) {
    $app.logger().warn("[einsatz] nicht angelegt", "fehler", String(err).slice(0, 300))
  }
  return e.next()
}, "patients", "product_outputs")

// 2. Einsatz löschen (Owner, 22.11.2026: Leitung und Recht Einsätze, Regel deleteRule der Sammlung):
// Protokolle, Produktausgaben und CIRS-Meldungen bleiben. Weg sind danach die Personen des Einsatzes, und
// CIRS-Meldungen verlieren den Verweis (Feld einsatz_id, das nur CIRS-Berechtigte sehen und das die
// Löschende vielleicht selbst nicht ändern dürfte). Nach e.next(): in PocketBase 0.23.4 scheitert jeder
// Datenbankzugriff in onRecordAfterDeleteSuccess.
onRecordDeleteRequest((e) => {
  const id = e.record.id
  // Vorher merken: Ist einsatz_id ein Verweis ohne cascadeDelete, leert PocketBase ihn beim Löschen,
  // danach fände der Filter nichts mehr (Durchsicht 22.11.2026)
  let personen = []
  try {
    const ps = $app.findRecordsByFilter("einsatz_personen", "einsatz_id = {:id}", "", 1000, 0, { id: id })
    for (let i = 0; i < ps.length; i++) personen.push(ps[i].id)
  } catch (err) { personen = [] }
  e.next()
  try {
    for (let i = 0; i < personen.length; i++) {
      try { $app.delete($app.findRecordById("einsatz_personen", personen[i])) } catch (err) { /* schon weg (cascadeDelete) */ }
    }
  } catch (err) {
    $app.logger().warn("[einsatz] Personen nicht aufgeräumt", "einsatz", id, "fehler", String(err).slice(0, 200))
  }
  try {
    const cs = $app.findRecordsByFilter("cirs_reports", "einsatz_id = {:id}", "", 1000, 0, { id: id })
    for (let i = 0; i < cs.length; i++) { cs[i].set("einsatz_id", ""); $app.save(cs[i]) }
  } catch (err) {
    // Ohne Feld einsatz_id an cirs_reports gibt es nichts zu lösen
  }
  $app.logger().info("[einsatz] gelöscht", "einsatz", id)
}, "einsaetze")
