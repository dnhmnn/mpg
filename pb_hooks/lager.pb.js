// PocketBase hook: Lager — Buchungen sind unveränderlich  (PocketBase v0.23+ API)
//
// Das Lagerjournal (inventory_transactions) ist der Nachweis, wer wann was
// entnommen, eingebucht oder korrigiert hat — für Rückrufe (Charge, MHD),
// Inventuren und Prüfungen muss es vollständig bleiben. Buchungen werden deshalb
// NIE geändert oder gelöscht: Ein Fehler wird als Gegenbuchung („Stornieren“,
// Feld storno_von) erfasst, die auf die Originalzeile verweist. Bestand
// (inventory_stock) ist nur die Summe daraus und darf sich weiter ändern.
//
// Die API-Regeln der Collection sperren Update/Delete bereits (Schloss stehen
// lassen, nicht leeren Text — der hieße „öffentlich“). Diese Hooks sind die
// zweite Ebene: Superuser umgehen API-Regeln — auch in der Admin-Oberfläche
// und in Sammelbuchungen (Batch) —, diese Prüfung aber nicht. Serverseitiger Code ($app.save / $app.delete in anderen Hooks)
// läuft nicht über die API und ist davon nicht betroffen.
//
// Muss in den Hook-Ordner der laufenden PocketBase (/opt/pb_hooks) kopiert
// werden; PocketBase lädt ihn nach einem Neustart.
//
// Felder an inventory_transactions (neu in Paket 4, beide nicht Pflicht):
//   user_id (Text)    — wer die Buchung geschrieben hat; setzt dieser Hook aus der
//                       Anmeldung (Text statt Relation: Wird ein Konto gelöscht, ändert
//                       PocketBase sonst still die Journalzeilen)
//   storno_von (Text) — Gegenbuchung verweist auf die Originalzeile
//
// Empfohlene Regeln (vollständig in docs/pocketbase-regeln.md, „Lager: API-Regeln“):
//   List/View : @request.auth.id != "" && organization_id = @request.auth.organization_id
//               && (@request.auth.permissions.lager = true || @request.auth.supervisor = true)
//   Create    : @request.auth.id != "" && @request.body.organization_id = @request.auth.organization_id
//               && (@request.auth.permissions.lager = true || @request.auth.supervisor = true)
//   Update    : gesperrt (Schloss)
//   Delete    : gesperrt (Schloss)

onRecordUpdateRequest((e) => {
  throw new BadRequestError("Buchungen sind unveränderlich — Korrekturen als Gegenbuchung (Stornieren) erfassen.")
}, "inventory_transactions")

onRecordDeleteRequest((e) => {
  throw new BadRequestError("Buchungen dürfen nicht gelöscht werden.")
}, "inventory_transactions")

// Wer schreibt, setzt der Server aus der Anmeldung — nicht das Gerät. So steht der
// echte Schreiber auch an Buchungen älterer App-Stände (iOS vor dem nächsten Update,
// lange offene Tabs), die user_id noch nicht mitschicken; ein mitgeschickter Wert
// wird überschrieben. Gilt auch für Buchungen in einer Sammelbuchung (Batch).
onRecordCreateRequest((e) => {
  if (e.auth) {
    try { e.record.set("user_id", e.auth.id) } catch (err) { /* Feld fehlt — dann eben nicht */ }
  }
  e.next()
}, "inventory_transactions")
