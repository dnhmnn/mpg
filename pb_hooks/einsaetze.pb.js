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
  try { require(`${__hooks}/einsatz-regeln.js`).ausDoku($app, e.record, true, (c) => new Record(c)) } catch (err) {
    $app.logger().warn("[einsatz] nicht angelegt", "fehler", String(err).slice(0, 300))
  }
  return e.next()
}, "patients", "product_outputs")

// Mannschaft später nachgetragen (Patienten → „Mannschaft nachtragen“): neue Personen kommen zum vorhandenen
// Einsatz dazu. Einen Einsatz legt ein Ändern nie an (ein gelöschter Einsatz käme sonst zurück).
onRecordAfterUpdateSuccess((e) => {
  try { require(`${__hooks}/einsatz-regeln.js`).ausDoku($app, e.record, false, (c) => new Record(c)) } catch (err) {
    $app.logger().warn("[einsatz] Personen nicht ergänzt", "fehler", String(err).slice(0, 300))
  }
  return e.next()
}, "patients")

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
