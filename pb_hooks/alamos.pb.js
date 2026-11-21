// PocketBase hook: Alamos-Eingang (läuft ab PocketBase 0.23.4)
//
// aPager PRO („Allgemeine Webhooks“ in der App, Smart-Home-Paket) oder FE2 rufen bei einem Alarm auf:
//   https://api.responda.systems/alamos/<organization_id>
// per POST (JSON {"unit","keyword"}, auch als text/plain oder Formular) oder per GET mit ?unit=…&keyword=…
// (aPager PRO ohne „HTTP POST statt GET“, iOS vor 1.22.0, AMweb).
//
// Daraus entsteht ein Einsatz in "einsaetze" (Felder: unit, keyword, adresse, datum,
// status aktiv/abgeschlossen/abgebrochen, organization_id, alamos_id). Lesen, Zuordnen, Doppelte und
// Anlegen: pb_hooks/alamos-regeln.js (Prüffälle in src/lib/__tests__/alamosRegeln.test.ts).
// Je Aufruf eine Zeile im Log von PocketBase („[alamos] …“): nur Feldnamen und Ergebnis, nie Werte.
// Hintergrund (Owner 21.11.2026, Test kam an, echte Alarme nicht): docs/pocketbase-regeln.md, „Alamos-Eingang“.

routerAdd("POST", "/alamos/{orgId}", (e) => {
  const R = require(`${__hooks}/alamos-regeln.js`)
  let roh = ""
  try { roh = toString(e.request.body, R.MAX_BODY) } catch (err) { roh = "" }
  let ct = ""
  try { ct = String(e.request.header.get("Content-Type") || "") } catch (err) { ct = "" }
  const r = R.eingang($app, e.request.pathValue("orgId"), R.bodyLesen(roh), ct, Date.now(), (c) => new Record(c), "POST")
  return e.json(r.status, r.json)
})

routerAdd("GET", "/alamos/{orgId}", (e) => {
  const R = require(`${__hooks}/alamos-regeln.js`)
  let q = {}
  try { q = e.requestInfo().query || {} } catch (err) { q = {} }
  const r = R.eingang($app, e.request.pathValue("orgId"), { body: R.queryLesen(q), art: "query" }, "", Date.now(), (c) => new Record(c), "GET")
  return e.json(r.status, r.json)
})
