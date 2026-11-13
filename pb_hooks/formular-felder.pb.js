// PocketBase hook: Statusfelder der Formulare, auch ohne formular.pb.js  (PocketBase v0.23+ API)
//
// absender_status (patients, product_outputs) und reporter_status (mpg_defect_reports) setzt nur
// der Server. Solange formular.pb.js läuft, tut es das selbst (Merker „responda:formular_aktiv“,
// gesetzt beim Start). Fehlt es (Rücknahme), sind die Create- und Update-Regeln der drei
// Sammlungen offen und nichts prüft: Ohne Anmeldung ließe sich ein Satz mit „bestätigt“ oder
// „ausstehend“ und einem fremden Absender anlegen, und nach der Wiedereinführung gälte er als
// echt (stünde in „Wartet auf deine Unterschrift“, zählte als bestätigt).
//
// Deshalb, nur solange formular.pb.js fehlt (Superuser ausgenommen):
//   - Anlegen: das Statusfeld bleibt leer. Der Satz ist ein alter Satz ohne Absender.
//   - Ändern patients, product_outputs: das Statusfeld bleibt, wie es war. Hat der Server es
//     gesetzt, bleiben auch Organisation und die Schlüssel des Servers im payload (Absender,
//     Frist, Prüfsumme, Änderungsliste bzw. Empfänger). Bestätigte und ohne Unterschrift
//     abgeschlossene Sätze ändert ohne Anmeldung niemand, ausstehende gar niemand (wie mit
//     formular.pb.js).
//   - mpg_defect_reports ändert mpg.pb.js (reporter_status gehört zu den festen Feldern).
//   - form_submissions (eigene Formulare): Anlegen geht wieder direkt (alter Weg), status „neu“,
//     absender_status und notiz leer, bearbeitung leer. Ändern schützt eigene-formulare.pb.js.
//
// Kommt ohne formular-regeln.js aus und bleibt bei einer Rücknahme liegen
// (docs/formulare-absender-einfuehrung.md, „Rücknahme“).
//
// HINWEIS (PocketBase-JSVM): Handler laufen isoliert, Hilfen deshalb im Handler.

onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth() || e.app.store().get("responda:formular_aktiv") === true) return e.next()
  const sammlung = e.record.collection().name
  const feld = sammlung === "mpg_defect_reports" ? "reporter_status" : "absender_status"
  let da = false
  try { da = !!e.record.collection().fields.getByName(feld) } catch (err) { da = false }
  if (da) e.record.set(feld, "")
  e.next()
}, "patients", "product_outputs", "mpg_defect_reports")

// form_submissions (eigene Formulare): ohne formular.pb.js geht der alte Weg wieder (direkt
// anlegen). Die Felder, die sonst nur der Server setzt, bleiben leer bzw. „neu“ (Plan Vorgänge
// 2.7.6); geprüft wird die Einsendung dann nicht (wie vor diesem Paket).
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth() || e.app.store().get("responda:formular_aktiv") === true) return e.next()
  const felder = e.record.collection().fields
  const da = (f) => { try { return !!felder.getByName(f) } catch (err) { return false } }
  if (da("status")) e.record.set("status", "neu")
  if (da("absender_status")) e.record.set("absender_status", "")
  if (da("notiz")) e.record.set("notiz", "")
  if (da("bearbeitung")) e.record.set("bearbeitung", null)
  e.next()
}, "form_submissions")

onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth() || e.app.store().get("responda:formular_aktiv") === true) return e.next()
  const sammlung = e.record.collection().name
  let da = false
  try { da = !!e.record.collection().fields.getByName("absender_status") } catch (err) { da = false }
  if (!da) return e.next()
  const original = e.record.original()
  const status = original.getString("absender_status")
  e.record.set("absender_status", status)
  if (!status) return e.next()

  // Mitglied: angemeldet in users, aktiv, keine Teilnehmenden, eigene Org oder Supervisor
  const org = original.getString("organization_id")
  let mitglied = false
  try {
    const a = e.auth
    if (a && a.collection().name === "users" && !a.getBool("disabled") && a.getString("role") !== "teilnehmer") {
      const bis = a.getString("expires_at")
      const aktiv = !bis || Date.parse(bis.replace(" ", "T")) > Date.now()
      mitglied = aktiv && (a.getBool("supervisor") || (!!org && a.getString("organization_id") === org))
    }
  } catch (err) { mitglied = false }
  if (status === "ausstehend") throw new BadRequestError("Das Protokoll wartet noch auf die Unterschrift des Absenders. Ändern geht erst danach.")
  if (!mitglied && (status === "bestaetigt" || status === "ohne_unterschrift")) {
    throw new ForbiddenError("Dieser Eintrag ist bestätigt. Ändern geht nur angemeldet.")
  }

  e.record.set("organization_id", org)
  const lesen = (rec) => {
    try {
      let p = JSON.parse(rec.getString("payload") || "null")
      if (typeof p === "string") p = JSON.parse(p)
      return p && typeof p === "object" && !Array.isArray(p) ? p : null
    } catch (err) { return null }
  }
  const O = lesen(original)
  if (!O) return e.next()
  const N = lesen(e.record)
  if (!N) { e.record.set("payload", O); return e.next() }
  const fest = sammlung === "patients"
    ? ["absender", "frist", "abgesendet", "eingang_sha256", "aenderungen"]
    : ["absender", "user_id", "user_name", "eingang_sha256"]
  for (const k of fest) {
    if (Object.prototype.hasOwnProperty.call(O, k)) N[k] = O[k]
    else delete N[k]
  }
  e.record.set("payload", N)
  e.next()
}, "patients", "product_outputs")
