// PocketBase hook: Öffentliche Formulare, Absender  (PocketBase v0.23+ API)
//
// Patientendoku, Produktausgabe und Defektmeldung senden über eigene Routen unter
// /api/responda/formular/…  Der Server entscheidet, wer Absender ist:
//   - angemeldet mit einem Mitglieds-Token: die angemeldete Person (bestätigt),
//   - Modus „passwort“: voller Name und Passwort des Mitglieds (bestätigt), oder aus der
//     Warteschlange eines Geräts ohne Passwort „Unterschrift ausstehend“, nur bei genau einem
//     passenden Mitglied,
//   - Modus „frei“: ein Name; passt er genau auf ein Mitglied, verknüpft und „nicht bestätigt“.
// Er setzt Status, Frist, Absender und Besatzung selbst, nie der Client.
//
// Routen (Vertrag: docs/pocketbase-regeln.md, „Öffentliche Formulare: Absender“):
//   GET  /api/responda/formular/{code}/stand          Einstellung, Felder, angemeldet als
//   POST /api/responda/formular/{code}/name           Name bekannt? nur ja/nein
//   POST /api/responda/formular/{code}/absenden       anlegen (alle drei Formulare)
//   GET  /api/responda/formular/unterschriften        was wartet auf meine Unterschrift
//   POST /api/responda/formular/unterschreiben        nachträglich bestätigen
//   POST /api/responda/formular/zurueckweisen         „Das war ich nicht“ (statt zu unterschreiben)
//   POST /api/responda/formular/ohne-unterschrift     Notausgang der Leitung (Patientendoku)
//   GET  /api/responda/formular/mitglieder-pruefung   wer nicht mit Passwort bestätigen kann
//   GET  /api/responda/formular/diagnose              nur Superuser: IP, Proxy, Felder
//
// Dazu der Schutz direkter API-Aufrufe auf patients, product_outputs und mpg_defect_reports,
// solange deren Create-Regeln offen sind (alte App-Stände), und der Aufräum-Lauf der Drossel.
//
// Die Regeln selbst stehen in formular-regeln.js (reine Funktionen, mit Prüffällen in vitest).
// Rücknahme: nur diese Datei entfernen und PocketBase neu starten; die App nimmt dann den
// alten Weg (doku-frist.pb.js und mitglieder-namen.pb.js laufen ohne sie weiter).
//
// Der Hook gibt nie ein Token aus und schreibt nie Passwort, Begründung oder Body ins Log.
//
// HINWEIS (PocketBase-JSVM): Handler laufen isoliert, require() deshalb im Handler.
// $app.save() aus den Routen löst die *Request-Hooks nicht aus; die Routen prüfen selbst.

// Merker für mpg.pb.js und formular-felder.pb.js: diese Datei ist geladen (formular-regeln.js,
// FORMULAR_AKTIV). Beim allerersten Start außerdem die Statusfelder einmal leeren: Was dort vor
// den Hooks stand, hat niemand geprüft (statusfelderLeeren, Merker-Datei im Datenverzeichnis).
onBootstrap((e) => {
  e.next()
  e.app.store().set("responda:formular_aktiv", true)
  let R = null
  try { R = require(`${__hooks}/formular-regeln.js`) } catch (err) { return }
  const pfad = e.app.dataDir() + "/" + R.START_MERKER
  let schonGestartet = false
  try { $os.stat(pfad); schonGestartet = true } catch (err) { schonGestartet = false }
  if (schonGestartet) return
  try {
    const n = R.statusfelderLeeren(e.app)
    $os.writeFile(pfad, "Formular-Hooks zuerst gestartet am " + new Date().toISOString() + ". Statusfelder geleert: " + JSON.stringify(n) + "\n", 420)
    const summe = Object.keys(n).reduce((s, k) => s + n[k], 0)
    if (summe > 0) e.app.logger().warn("[formular] Erster Start: Statusfelder aus der Zeit vor den Hooks geleert", "anzahl", JSON.stringify(n))
    else e.app.logger().info("[formular] Erster Start, keine Statusfelder zu leeren")
  } catch (err) {
    e.app.logger().error("[formular] Erster Start: Statusfelder nicht geleert, nächster Start versucht es erneut", "fehler", String(err).slice(0, 300))
  }
})

// ── Stand ───────────────────────────────────────────────────────────────────

routerAdd("GET", "/api/responda/formular/{code}/stand", (e) => {
  const R = require(`${__hooks}/formular-regeln.js`)
  const jetzt = Date.now()
  const org = R.orgPerCode($app, e.request.pathValue("code"))
  if (!org) return R.antwort(e, 404, "organisation")

  // Einmal je Start: Warnung, wenn alle Anfragen von einer internen Adresse kommen
  try {
    const ip = R.realIP(e)
    if (R.ipPrivat(ip) && R.proxyKoepfe($app).length === 0 && R.einmalJe($app, "proxy", 0, jetzt)) {
      $app.logger().warn("[formular] Anfragen kommen von einer internen Adresse und Trusted proxy ist leer. Läuft PocketBase hinter einem Proxy, unter Settings den Trusted proxy eintragen.", "realIP", ip)
    }
  } catch (err) { /* nur Hinweis */ }

  const mitglied = R.mitgliedAusToken(e.auth ? R.personAusRecord(e.auth) : null, org.id, jetzt)
  const formulare = {}
  for (const f of R.FORMULARE) {
    const sammlung = R.SAMMLUNG[f]
    formulare[f] = {
      modus: R.absenderModus(org.form_config, f),
      an: R.formularAn(org, f),
      oeffentlich: R.formularOeffentlich(org, f),
      ausstehend: R.feldDa($app, sammlung, R.STATUSFELD[sammlung]),
    }
  }
  formulare.cirs = { modus: "anonym", an: R.formularAn(org, "cirs"), oeffentlich: R.formularOeffentlich(org, "cirs"), ausstehend: false }
  return e.json(200, {
    version: 1,
    formulare: formulare,
    angemeldet: mitglied ? { id: mitglied.id, name: R.kontoName(mitglied) } : null,
  })
})

// ── Name bekannt? ───────────────────────────────────────────────────────────

routerAdd("POST", "/api/responda/formular/{code}/name", (e) => {
  const R = require(`${__hooks}/formular-regeln.js`)
  const jetzt = Date.now()
  const G = R.grenzenMit({ sperreSekunden: $os.getenv("RESPONDA_FORMULAR_SPERRE_SEKUNDEN"), speicherMax: $os.getenv("RESPONDA_FORMULAR_SPEICHER_MAX") })
  const body = R.bodyLesen(e)
  if (!body) return R.antwort(e, 400, "daten", { feld: "daten" })
  const org = R.orgPerCode($app, e.request.pathValue("code"))
  if (!org) return R.antwort(e, 404, "organisation")
  if (R.FORMULARE.indexOf(body.formular) < 0) return R.antwort(e, 400, "daten", { feld: "formular" })
  const mitglied = R.mitgliedAusToken(e.auth ? R.personAusRecord(e.auth) : null, org.id, jetzt)
  if (!(mitglied ? R.formularAn(org, body.formular) : R.formularOeffentlich(org, body.formular))) return R.antwort(e, 403, "formular_aus")

  if (!mitglied && R.speicherVoll($app, G, jetzt)) return R.antwort(e, 429, "drossel", { sekunden: G.speicher_sekunden })
  const d = mitglied
    ? R.zaehlen($app, "name:u:" + mitglied.id, G.name_u, jetzt)
    : R.anonymZaehlen($app, "name", R.realIP(e), G, jetzt)
  if (!d.erlaubt) return R.antwort(e, 429, "drossel", { sekunden: d.sekunden })

  if (typeof body.name !== "string" || body.name.length > 120) return R.antwort(e, 400, "daten", { feld: "name" })
  const vollstaendig = R.nameVollstaendig(body.name)
  const t = vollstaendig ? R.treffer(R.mitgliederLaden($app, org.id), body.name, org.id, jetzt) : []
  return e.json(200, { vollstaendig: vollstaendig, gefunden: t.length >= 1, eindeutig: t.length === 1 })
})

// ── Absenden ────────────────────────────────────────────────────────────────

routerAdd("POST", "/api/responda/formular/{code}/absenden", (e) => {
  const R = require(`${__hooks}/formular-regeln.js`)
  const jetzt = Date.now()
  const G = R.grenzenMit({ sperreSekunden: $os.getenv("RESPONDA_FORMULAR_SPERRE_SEKUNDEN"), speicherMax: $os.getenv("RESPONDA_FORMULAR_SPEICHER_MAX") })

  // 1. Body, Org, Formular, Kennung
  const body = R.bodyLesen(e)
  if (!body) return R.antwort(e, 400, "daten", { feld: "daten" })
  const org = R.orgPerCode($app, e.request.pathValue("code"))
  if (!org) return R.antwort(e, 404, "organisation")
  const formular = body.formular
  if (R.FORMULARE.indexOf(formular) < 0) return R.antwort(e, 400, "daten", { feld: "formular" })
  const maske = formular === "patienten" ? body.maske : ""
  if (formular === "patienten" && R.MASKEN.indexOf(maske) < 0) return R.antwort(e, 400, "daten", { feld: "maske" })
  const id = body.id
  if (!R.kennungGueltig(id)) return R.antwort(e, 400, "daten", { feld: "id" })
  const daten = body.daten
  if (!daten || typeof daten !== "object" || Array.isArray(daten)) return R.antwort(e, 400, "daten", { feld: formular === "patienten" ? "payload" : "daten" })
  const person = e.auth ? R.personAusRecord(e.auth) : null
  const mitglied = R.mitgliedAusToken(person, org.id, jetzt)
  if (!(mitglied ? R.formularAn(org, formular) : R.formularOeffentlich(org, formular))) return R.antwort(e, 403, "formular_aus")

  // 2. Speicher und Drossel
  const realIp = R.realIP(e)
  const ip = R.ipTopf(realIp)
  if (!mitglied && R.speicherVoll($app, G, jetzt)) return R.antwort(e, 429, "drossel", { sekunden: G.speicher_sekunden })
  const d = mitglied ? R.zaehlen($app, "send:u:" + mitglied.id, G.send_u, jetzt) : R.anonymZaehlen($app, "send", realIp, G, jetzt)
  if (!d.erlaubt) return R.antwort(e, 429, "drossel", { sekunden: d.sekunden })

  const sammlung = R.SAMMLUNG[formular]
  const statusfeld = R.STATUSFELD[sammlung]

  // 3. Änderung aus der Warteschlange der alten Doku
  if (body.uebernommen === true && formular === "patienten") {
    const ziel = R.zielAlterAenderung($app, org.id, daten.payload)
    if (ziel) return R.antwort(e, 409, "aenderung_alt", { ziel: ziel })
  }

  // 4./5. Prüfsumme; Kennung schon da?
  const pruefsumme = $security.sha256(R.kanonisch(daten) || "")
  const schon = R.schonDa($app, formular, id, org.id, pruefsumme, daten)
  if (schon) return schon.bereits ? e.json(200, schon.antwort) : R.antwort(e, 409, "kennung")

  // 6. Daten
  const pr = R.datenPruefen(formular, daten, R.bestandLaden($app, formular, daten), { orgId: org.id, maske: maske })
  if (!pr.ok) return R.antwort(e, 400, "daten", { feld: pr.feld, text: pr.text })

  // 7. Absender
  const modus = R.absenderModus(org.form_config, formular)
  const feldVorhanden = R.feldDa($app, sammlung, statusfeld)
  const angabe = body.absender && typeof body.absender === "object" && !Array.isArray(body.absender) ? body.absender : {}
  const name = typeof angabe.name === "string" ? angabe.name.slice(0, 500) : ""
  const passwort = typeof angabe.passwort === "string" ? angabe.passwort : ""
  const mitglieder = R.mitgliederLaden($app, org.id)
  const k = {
    modus: modus, mitglied: mitglied, name: name, passwort: passwort !== "", ausstehend: angabe.ausstehend === true,
    treffer: R.treffer(mitglieder, name, org.id, jetzt), feldVorhanden: feldVorhanden,
  }
  let ent = R.absenderEntscheiden(k)

  if (ent.art === "passwort_pruefen") {
    // Jede Prüfung wird vorher atomar reserviert (je IP-Topf, je Konto und Topf, je Konto)
    const pr2 = R.passwortPruefen($app, ent.kandidaten, passwort, realIp, G, jetzt)
    if (pr2.grund === "gesperrt") return R.antwort(e, 429, "gesperrt", { sekunden: pr2.sekunden })
    if (pr2.grund === "passwort_falsch") return R.antwort(e, 401, "passwort_falsch", { versuche_uebrig: pr2.uebrig })
    k.passwortTreffer = pr2.person
    ent = R.absenderEntscheiden(k)
  }
  if (ent.art === "fehler") return R.antwort(e, ent.status, ent.grund, { feld: ent.feld, text: ent.text })

  if (ent.status === "ausstehend") {
    if (R.offeneAusstehende($app, org.id, ent.person.id) >= G.aus_offen) return R.antwort(e, 429, "drossel", { sekunden: 3600 })
    const a1 = R.zaehlen($app, "aus:ip:" + ip, G.aus_ip, jetzt)
    if (!a1.erlaubt) return R.antwort(e, 429, "drossel", { sekunden: a1.sekunden })
    const a2 = R.zaehlen($app, "aus:z:" + ent.person.id, G.aus_z, jetzt)
    if (!a2.erlaubt) return R.antwort(e, 429, "drossel", { sekunden: a2.sekunden })
  }

  // 8. Datensatz
  const absender = R.absenderEintrag(ent, modus, new Date(jetzt).toISOString())
  let antwortAbsender = absender
  let frist = ""
  let rec = null
  try {
    rec = new Record($app.findCollectionByNameOrId(sammlung))
    rec.set("id", id)
    rec.set("organization_id", org.id)
    if (feldVorhanden) rec.set(statusfeld, absender.status)
    if (formular === "patienten") {
      const payload = R.patientenPayload(pr.daten.payload, { maske: maske, absender: absender, eingangMs: jetzt, pruefsumme: pruefsumme, mitglieder: mitglieder, orgId: org.id, mitglied: !!mitglied, jetzt: jetzt })
      rec.set("title", pr.daten.title)
      rec.set("status", "offen")
      rec.set("payload", payload)
      antwortAbsender = payload.absender
      frist = payload.frist
    } else if (formular === "produktausgabe") {
      const payload = R.ausgabePayload(pr.daten, absender, pruefsumme)
      rec.set("title", R.ausgabeTitel(pr.daten))
      rec.set("status", "offen")
      rec.set("payload", payload)
      antwortAbsender = payload.absender
    } else {
      rec.set("device_id", pr.daten.device_id)
      rec.set("device_name", pr.daten.device_name)
      rec.set("description", pr.daten.description)
      rec.set("severity", pr.daten.severity)
      rec.set("status", "pending")
      rec.set("reporter_name", absender.name)
      rec.set("reporter_user_id", R.meldungReporterId(absender, feldVorhanden))
    }
    $app.save(rec)
  } catch (err) {
    // Zwei gleichzeitige Sendungen derselben Kennung: wie Schritt 5 antworten
    const nochmal = R.schonDa($app, formular, id, org.id, pruefsumme, daten)
    if (nochmal) return nochmal.bereits ? e.json(200, nochmal.antwort) : R.antwort(e, 409, "kennung")
    const text = String(err)
    if (/^(GoError: )?[A-Za-z0-9_.]+: /.test(text)) return R.antwort(e, 400, "daten", { feld: "speichern" })
    $app.logger().error("[formular] Absenden nicht gespeichert", "formular", formular, "id", id, "fehler", text.slice(0, 300))
    return R.antwort(e, 500, "server")
  }
  return e.json(200, { ok: true, id: id, bereits: false, absender: antwortAbsender, frist: frist })
})

// ── Unterschriften ──────────────────────────────────────────────────────────

routerAdd("GET", "/api/responda/formular/unterschriften", (e) => {
  const R = require(`${__hooks}/formular-regeln.js`)
  const jetzt = Date.now()
  const G = R.grenzenMit({})
  const person = e.auth ? R.personAusRecord(e.auth) : null
  const mitglied = person ? R.mitgliedAusToken(person, person.organization_id, jetzt) : null
  if (!mitglied) return R.antwort(e, 401, "nicht_angemeldet")
  const d = R.zaehlen($app, "ulist:u:" + mitglied.id, G.ulist_u, jetzt)
  if (!d.erlaubt) return R.antwort(e, 429, "drossel", { sekunden: d.sekunden })

  const org = mitglied.organization_id
  const eintraege = []
  for (const f of R.FORMULARE) {
    const sammlung = R.SAMMLUNG[f]
    const feld = R.STATUSFELD[sammlung]
    if (!R.feldDa($app, sammlung, feld)) continue
    let liste = []
    try {
      liste = sammlung === "mpg_defect_reports"
        ? $app.findRecordsByFilter(sammlung, "organization_id = {:o} && reporter_status = 'ausstehend' && reporter_user_id = {:z}", "-created", 0, 0, { o: org, z: mitglied.id })
        : $app.findRecordsByFilter(sammlung, "organization_id = {:o} && " + feld + " = 'ausstehend'", "-created", 0, 0, { o: org })
    } catch (err) { liste = [] }
    for (const rec of liste) {
      const abs = R.absenderAusSatz(rec, sammlung)
      if (R.darfUnterschreiben(abs, mitglied, org, jetzt)) eintraege.push(R.unterschriftEintrag(rec, f, abs))
    }
  }
  eintraege.sort((a, b) => (a.angelegt < b.angelegt ? 1 : a.angelegt > b.angelegt ? -1 : 0))
  return e.json(200, { eintraege: eintraege.slice(0, 200) })
})

routerAdd("POST", "/api/responda/formular/unterschreiben", (e) => {
  const R = require(`${__hooks}/formular-regeln.js`)
  const jetzt = Date.now()
  const G = R.grenzenMit({})
  const person = e.auth ? R.personAusRecord(e.auth) : null
  const mitglied = person ? R.mitgliedAusToken(person, person.organization_id, jetzt) : null
  if (!mitglied) return R.antwort(e, 401, "nicht_angemeldet")
  const d = R.zaehlen($app, "sign:u:" + mitglied.id, G.sign_u, jetzt)
  if (!d.erlaubt) return R.antwort(e, 429, "drossel", { sekunden: d.sekunden })
  const body = R.bodyLesen(e)
  if (!body) return R.antwort(e, 400, "daten", { feld: "daten" })
  if (R.FORMULARE.indexOf(body.formular) < 0) return R.antwort(e, 400, "daten", { feld: "formular" })
  if (!R.kennungGueltig(body.id)) return R.antwort(e, 400, "daten", { feld: "id" })
  const sammlung = R.SAMMLUNG[body.formular]
  const feld = R.STATUSFELD[sammlung]
  if (!R.feldDa($app, sammlung, feld)) return R.antwort(e, 404, "nicht_gefunden")

  const org = mitglied.organization_id
  const mitglieder = sammlung === "patients" ? R.mitgliederLaden($app, org) : []
  const name = R.kontoName(mitglied)
  const am = new Date(jetzt).toISOString()
  let ergebnis = null
  try {
    $app.runInTransaction((tx) => {
      let rec = null
      try { rec = tx.findRecordById(sammlung, body.id) } catch (err) { rec = null }
      if (!rec || rec.getString("organization_id") !== org) { ergebnis = { status: 404, grund: "nicht_gefunden" }; return }
      if (rec.getString(feld) !== "ausstehend") { ergebnis = { status: 409, grund: "schon_bestaetigt" }; return }
      const abs = R.absenderAusSatz(rec, sammlung)
      if (!R.darfUnterschreiben(abs, mitglied, org, jetzt)) { ergebnis = { status: 403, grund: "fremd" }; return }
      if (sammlung === "mpg_defect_reports") {
        rec.set("reporter_user_id", mitglied.id)
        rec.set("reporter_name", name)
        ergebnis = { absender: { id: mitglied.id, name: name, status: "bestaetigt", weg: "nachgereicht", modus: "passwort", am: am }, frist: "" }
      } else {
        const p = R.payloadLesen(R.jsonWert(rec, "payload")) || {}
        const neu = Object.assign({}, abs, { id: mitglied.id, name: name, status: "bestaetigt", weg: "nachgereicht", am: am })
        let q = Object.assign({}, p, { absender: neu })
        if (sammlung === "patients") {
          q = R.besatzungAufloesen(q, null, mitglieder, { orgId: org, mitglied: false, ausstehend: false, jetzt: jetzt })
          q.frist = new Date(jetzt + R.FRIST_MS).toISOString()
          if (neu.feld) q[neu.feld] = name
        } else {
          q.user_id = mitglied.id
          q.user_name = name
        }
        rec.set("payload", q)
        ergebnis = { absender: neu, frist: sammlung === "patients" ? q.frist : "" }
      }
      rec.set(feld, "bestaetigt")
      tx.save(rec)
    })
  } catch (err) {
    $app.logger().error("[formular] Unterschreiben nicht gespeichert", "id", String(body.id), "fehler", String(err).slice(0, 300))
    return R.antwort(e, 500, "server")
  }
  if (!ergebnis) return R.antwort(e, 500, "server")
  if (ergebnis.grund) return R.antwort(e, ergebnis.status, ergebnis.grund)
  const aus = { ok: true, absender: ergebnis.absender }
  if (sammlung === "patients") aus.frist = ergebnis.frist
  return e.json(200, aus)
})

// ── Das war ich nicht (statt zu unterschreiben) ───────────────────────────
//
// Die genannte Person sagt, sie habe den ausstehenden Eintrag nicht abgegeben. Sie unterschreibt
// dann nie mehr (darfUnterschreiben), der Eintrag verschwindet aus ihrer Liste.
//   patients:         wartet weiter (Besatzung nur als Namen, keine Frist, für niemanden
//                     änderbar); die Leitung schließt ihn mit „Ohne Unterschrift abschließen“ ab.
//   product_outputs:  ohne Konto unter dem eingetragenen Namen (absender_status ohne_konto).
//   mpg_defect_reports: ebenso ohne Konto (reporter_status ohne_konto, reporter_user_id leer).
// In payload.absender (patients, product_outputs) steht danach `zurueckgewiesen` mit Kennung,
// Name und Zeit; payload.absender setzt nur der Server.

routerAdd("POST", "/api/responda/formular/zurueckweisen", (e) => {
  const R = require(`${__hooks}/formular-regeln.js`)
  const jetzt = Date.now()
  const G = R.grenzenMit({})
  const person = e.auth ? R.personAusRecord(e.auth) : null
  const mitglied = person ? R.mitgliedAusToken(person, person.organization_id, jetzt) : null
  if (!mitglied) return R.antwort(e, 401, "nicht_angemeldet")
  const d = R.zaehlen($app, "sign:u:" + mitglied.id, G.sign_u, jetzt)
  if (!d.erlaubt) return R.antwort(e, 429, "drossel", { sekunden: d.sekunden })
  const body = R.bodyLesen(e)
  if (!body) return R.antwort(e, 400, "daten", { feld: "daten" })
  if (R.FORMULARE.indexOf(body.formular) < 0) return R.antwort(e, 400, "daten", { feld: "formular" })
  if (!R.kennungGueltig(body.id)) return R.antwort(e, 400, "daten", { feld: "id" })
  const sammlung = R.SAMMLUNG[body.formular]
  const feld = R.STATUSFELD[sammlung]
  if (!R.feldDa($app, sammlung, feld)) return R.antwort(e, 404, "nicht_gefunden")

  const org = mitglied.organization_id
  const am = new Date(jetzt).toISOString()
  const vermerk = { id: mitglied.id, name: R.kontoName(mitglied), am: am }
  let ergebnis = null
  try {
    $app.runInTransaction((tx) => {
      let rec = null
      try { rec = tx.findRecordById(sammlung, body.id) } catch (err) { rec = null }
      if (!rec || rec.getString("organization_id") !== org) { ergebnis = { status: 404, grund: "nicht_gefunden" }; return }
      if (rec.getString(feld) !== "ausstehend") { ergebnis = { status: 409, grund: "schon_bestaetigt" }; return }
      const abs = R.absenderAusSatz(rec, sammlung)
      if (!R.darfUnterschreiben(abs, mitglied, org, jetzt)) { ergebnis = { status: 403, grund: "fremd" }; return }
      if (sammlung === "mpg_defect_reports") {
        rec.set("reporter_user_id", "")
        rec.set(feld, "ohne_konto")
        ergebnis = { absender: { id: "", name: rec.getString("reporter_name"), status: "ohne_konto", weg: "", modus: "", am: "" } }
      } else {
        const p = R.payloadLesen(R.jsonWert(rec, "payload")) || {}
        let neu = null
        if (sammlung === "patients") {
          neu = Object.assign({}, abs, { zurueckgewiesen: vermerk })
        } else {
          neu = Object.assign({}, abs, { id: "", status: "ohne_konto", zurueckgewiesen: vermerk })
          rec.set(feld, "ohne_konto")
        }
        const q = Object.assign({}, p, { absender: neu })
        if (sammlung === "product_outputs") q.user_id = ""
        rec.set("payload", q)
        ergebnis = { absender: neu }
      }
      tx.save(rec)
    })
  } catch (err) {
    $app.logger().error("[formular] Zurückweisen nicht gespeichert", "id", String(body.id), "fehler", String(err).slice(0, 300))
    return R.antwort(e, 500, "server")
  }
  if (!ergebnis) return R.antwort(e, 500, "server")
  if (ergebnis.grund) return R.antwort(e, ergebnis.status, ergebnis.grund)
  return e.json(200, { ok: true, absender: ergebnis.absender })
})

// ── Ohne Unterschrift abschließen (Notausgang, nur Patientendoku) ─────────

routerAdd("POST", "/api/responda/formular/ohne-unterschrift", (e) => {
  const R = require(`${__hooks}/formular-regeln.js`)
  const jetzt = Date.now()
  const G = R.grenzenMit({})
  const person = e.auth ? R.personAusRecord(e.auth) : null
  if (!person || person.sammlung !== "users") return R.antwort(e, 401, "nicht_angemeldet")
  // Ohne Supervisor gilt nur die eigene Org; deren Recht zuerst (eine fremde Kennung verrät nichts)
  if (person.supervisor !== true && !R.darfOhneUnterschrift(person, person.organization_id, jetzt)) return R.antwort(e, 403, "nicht_berechtigt")
  const d = R.zaehlen($app, "sign:u:" + person.id, G.sign_u, jetzt)
  if (!d.erlaubt) return R.antwort(e, 429, "drossel", { sekunden: d.sekunden })
  const body = R.bodyLesen(e)
  if (!body) return R.antwort(e, 400, "daten", { feld: "daten" })
  if (body.formular !== "patienten") return R.antwort(e, 400, "daten", { feld: "formular" })
  if (!R.kennungGueltig(body.id)) return R.antwort(e, 400, "daten", { feld: "id" })
  const grund = typeof body.grund === "string" ? body.grund.trim() : ""
  if (grund.length < 10 || grund.length > 500) return R.antwort(e, 400, "daten", { feld: "grund" })
  const hatFeld = R.feldDa($app, "patients", "absender_status")

  let ergebnis = null
  try {
    $app.runInTransaction((tx) => {
      let rec = null
      try { rec = tx.findRecordById("patients", body.id) } catch (err) { rec = null }
      const orgId = rec ? rec.getString("organization_id") : ""
      if (!rec || (person.supervisor !== true && orgId !== person.organization_id)) { ergebnis = { status: 404, grund: "nicht_gefunden" }; return }
      if (!R.darfOhneUnterschrift(person, orgId, jetzt)) { ergebnis = { status: 403, grund: "nicht_berechtigt" }; return }
      const org = R.orgPerId(tx, orgId)
      if (!org || !R.formularAn(org, "patienten")) { ergebnis = { status: 403, grund: "formular_aus" }; return }
      const p = R.payloadLesen(R.jsonWert(rec, "payload")) || {}
      const abs = p.absender && typeof p.absender === "object" ? p.absender : null
      const status = hatFeld ? rec.getString("absender_status") : (abs ? abs.status : "")
      if (status !== "ausstehend" || !abs || abs.status !== "ausstehend") { ergebnis = { status: 409, grund: "schon_bestaetigt" }; return }
      const neu = Object.assign({}, abs, {
        status: "ohne_unterschrift",
        abschluss: { id: person.id, name: R.kontoName(person), am: new Date(jetzt).toISOString(), grund: grund },
      })
      rec.set("payload", Object.assign({}, p, { absender: neu, frist: "" }))
      if (hatFeld) rec.set("absender_status", "ohne_unterschrift")
      rec.set("status", "freigegeben")
      tx.save(rec)
      ergebnis = { absender: neu }
    })
  } catch (err) {
    $app.logger().error("[formular] Ohne Unterschrift nicht gespeichert", "id", String(body.id), "fehler", String(err).slice(0, 300))
    return R.antwort(e, 500, "server")
  }
  if (!ergebnis) return R.antwort(e, 500, "server")
  if (ergebnis.grund) return R.antwort(e, ergebnis.status, ergebnis.grund)
  return e.json(200, { ok: true, absender: ergebnis.absender })
})

// ── Mitglieder-Prüfung (Karte unter Vorgänge) ─────────────────────────────

routerAdd("GET", "/api/responda/formular/mitglieder-pruefung", (e) => {
  const R = require(`${__hooks}/formular-regeln.js`)
  const jetzt = Date.now()
  const G = R.grenzenMit({})
  const person = e.auth ? R.personAusRecord(e.auth) : null
  if (!person || person.sammlung !== "users") return R.antwort(e, 401, "nicht_angemeldet")
  if (!R.darfFormulareEinstellen(person, jetzt)) return R.antwort(e, 403, "nicht_berechtigt")
  if (!person.organization_id) return R.antwort(e, 400, "daten", { feld: "organisation" })
  const d = R.zaehlen($app, "mpruef:u:" + person.id, G.mpruef_u, jetzt)
  if (!d.erlaubt) return R.antwort(e, 429, "drossel", { sekunden: d.sekunden })
  return e.json(200, R.mitgliederPruefen(R.mitgliederLaden($app, person.organization_id), person.organization_id, jetzt))
})

// ── Diagnose (nur Superuser, beim Einführen) ──────────────────────────────

routerAdd("GET", "/api/responda/formular/diagnose", (e) => {
  const R = require(`${__hooks}/formular-regeln.js`)
  if (!e.hasSuperuserAuth()) return R.antwort(e, 403, "nicht_berechtigt")
  const real = R.realIP(e)
  let remote = ""
  try { remote = String(e.remoteIP() || "") } catch (err) { remote = "" }
  const koepfe = R.proxyKoepfe($app)
  const privat = R.ipPrivat(real)
  const felder = {}
  for (const s of ["patients", "product_outputs", "mpg_defect_reports"]) felder[s + "." + R.STATUSFELD[s]] = R.feldDa($app, s, R.STATUSFELD[s])
  let speicher = 0
  try { speicher = $app.store().length() } catch (err) { speicher = 0 }
  return e.json(200, {
    realIP: real,
    remoteIP: remote,
    ipTopf: R.ipTopf(real),
    trustedProxyHeaders: koepfe,
    privat: privat,
    warnung: privat && koepfe.length === 0 ? "Alle Anfragen kommen von derselben internen Adresse. Läuft PocketBase hinter einem Proxy, unter Settings den Trusted proxy eintragen." : "",
    felder: felder,
    speicher: speicher,
  })
})

// ── Anmeldung mit Passwort: dieselbe Sperre wie die Bestätigung ───────────
// Sonst ließe sich die Sperre der Route über auth-with-password umgehen: dort prüft PocketBase
// dasselbe Passwort ohne eigene Grenze. Gesperrt: 429 mit deutschem Text; falsch: PocketBase
// antwortet wie immer (400). Ein Topf ohne eigene Fehlversuche für das Konto meldet sich auch
// während einer Sperre des Kontos an (pwKontoReservieren), damit niemand ein Konto aus der Ferne
// aussperrt.

onRecordAuthWithPasswordRequest((e) => {
  if (!e.record) return e.next()
  // Fehlt formular-regeln.js, geht die Anmeldung trotzdem (ohne diese Sperre), nie alle aussperren
  let R = null
  try { R = require(`${__hooks}/formular-regeln.js`) } catch (err) {
    e.app.logger().warn("[formular] formular-regeln.js fehlt, Anmeldung ohne gemeinsame Sperre")
    return e.next()
  }
  const jetzt = Date.now()
  const G = R.grenzenMit({ sperreSekunden: $os.getenv("RESPONDA_FORMULAR_SPERRE_SEKUNDEN"), speicherMax: $os.getenv("RESPONDA_FORMULAR_SPEICHER_MAX") })
  const r = R.passwortPruefen(e.app, [{ id: e.record.id }], String(e.password || ""), R.realIP(e), G, jetzt)
  if (r.grund === "gesperrt") throw new TooManyRequestsError(R.meldung("gesperrt", { sekunden: r.sekunden }))
  return e.next()
}, "users")

// ── Schutz direkter API-Aufrufe: Anlegen ───────────────────────────────────
// Solange die Create-Regeln offen sind, legen alte App-Stände direkt an. Der Server setzt
// Absender, Status und Frist selbst; im Modus „passwort“ geht es ohne Mitglieds-Token nicht.
// Läuft auch im Batch (ein abgelehnter Teil rollt den ganzen Batch zurück).

onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const R = require(`${__hooks}/formular-regeln.js`)
  const jetzt = Date.now()
  const G = R.grenzenMit({ sperreSekunden: $os.getenv("RESPONDA_FORMULAR_SPERRE_SEKUNDEN"), speicherMax: $os.getenv("RESPONDA_FORMULAR_SPEICHER_MAX") })
  const sammlung = e.record.collection().name
  const formular = R.FORMULAR_AUS_SAMMLUNG[sammlung]
  const org = R.orgPerId(e.app, e.record.getString("organization_id"))
  if (!org) throw new BadRequestError(R.HOOK_TEXTE.org_fehlt)

  const person = e.auth ? R.personAusRecord(e.auth) : null
  const mitglied = R.mitgliedAusToken(person, org.id, jetzt)
  const modus = R.absenderModus(org.form_config, formular)
  const iso = new Date(jetzt).toISOString()
  const mitglieder = R.mitgliederLaden(e.app, org.id)
  let roh = {}
  if (sammlung !== "mpg_defect_reports") roh = R.payloadLesen(R.jsonWert(e.record, "payload")) || {}

  let absender
  if (mitglied) {
    if (!R.formularAn(org, formular)) throw new ForbiddenError(R.HOOK_TEXTE.formular_aus)
    absender = { id: mitglied.id, name: R.kontoName(mitglied), status: "bestaetigt", weg: "anmeldung", modus: modus, am: iso }
  } else {
    if (!org.is_active || !R.formularOeffentlich(org, formular)) throw new ForbiddenError(R.HOOK_TEXTE.formular_aus)
    if (R.speicherVoll(e.app, G, jetzt)) throw new TooManyRequestsError(R.HOOK_TEXTE.drossel)
    const d = R.anonymZaehlen(e.app, "send", R.realIP(e), G, jetzt)
    if (!d.erlaubt) throw new TooManyRequestsError(R.meldung("drossel", { sekunden: d.sekunden }))
    if (modus === "passwort") throw new ForbiddenError(R.HOOK_TEXTE.alte_fassung)
    // Modus frei (Fall 9/10); ein leerer Name alter Stände wird „ohne Konto“
    let eingabe = ""
    if (sammlung === "patients") eingabe = roh[R.DRUCKFELD[R.maskeAusPayload(roh)]]
    else if (sammlung === "product_outputs") eingabe = roh.user_name
    else eingabe = e.record.getString("reporter_name")
    eingabe = typeof eingabe === "string" ? eingabe : ""
    const t = R.treffer(mitglieder, eingabe, org.id, jetzt)
    absender = t.length === 1
      ? { id: t[0].id, name: R.kontoName(t[0]), status: "nicht_bestaetigt", weg: "", modus: modus, am: "" }
      : { id: "", name: R.anzeigeName(eingabe), status: "ohne_konto", weg: "", modus: modus, am: "" }
  }

  const statusfeld = R.STATUSFELD[sammlung]
  const feldVorhanden = R.feldDa(e.app, sammlung, statusfeld)
  if (feldVorhanden) e.record.set(statusfeld, absender.status)

  if (sammlung === "patients") {
    const maske = R.maskeAusPayload(roh)
    // Gegenzeichnung nur von der Leitung, nie beim Anlegen
    if (!mitglied) R.felderBehalten(e.record, null, R.GEGENZEICHNUNG)
    e.record.set("payload", R.patientenPayload(roh, { maske: maske, absender: absender, eingangMs: jetzt, pruefsumme: "", mitglieder: mitglieder, orgId: org.id, mitglied: !!mitglied, jetzt: jetzt }))
    e.record.set("title", R.patientenTitel(e.record.getString("title"), maske))
    e.record.set("status", "offen")
  } else if (sammlung === "product_outputs") {
    const daten = { einsatz: roh.einsatz, datum: roh.datum, lager_id: roh.lager_id, positionen: roh.positionen }
    const pr = R.datenPruefen("produktausgabe", daten, R.bestandLaden(e.app, "produktausgabe", daten), { orgId: org.id })
    if (!pr.ok) throw new BadRequestError(pr.text)
    e.record.set("payload", R.ausgabePayload(pr.daten, absender, ""))
    e.record.set("title", R.ausgabeTitel(pr.daten))
    e.record.set("status", "offen")
  } else {
    const daten = { device_id: e.record.getString("device_id"), description: e.record.getString("description"), severity: e.record.getString("severity") }
    const pr = R.datenPruefen("defektmeldung", daten, R.bestandLaden(e.app, "defektmeldung", daten), { orgId: org.id })
    if (!pr.ok) throw new BadRequestError(pr.text)
    e.record.set("device_name", pr.daten.device_name)
    e.record.set("description", pr.daten.description)
    e.record.set("severity", pr.daten.severity)
    e.record.set("status", "pending")
    e.record.set("reporter_name", absender.name)
    e.record.set("reporter_user_id", R.meldungReporterId(absender, feldVorhanden))
  }
  e.next()
}, "patients", "product_outputs", "mpg_defect_reports")

// ── Schutz direkter API-Aufrufe: Ändern ────────────────────────────────────

// patients: Server-Schlüssel bleiben, Ausstehendes ist gesperrt, Bestätigtes ändert nur ein
// Mitglied, die Besatzung behält unveränderte Verknüpfungen, jede Änderung steht in
// payload.aenderungen. Gesperrte Sätze behalten auch alle anderen Felder (Titel, Gegenzeichnung
// admin_*). Ohne Mitglied geht nur, was offen und in der Frist ist; Rückfragen und
// Stellungnahmen bleiben. Ein unlesbarer payload führt nie zu einem Fehler.
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  const R = require(`${__hooks}/formular-regeln.js`)
  const jetzt = Date.now()
  const original = e.record.original()
  const org = original.getString("organization_id")
  const hatFeld = R.feldDa(e.app, "patients", "absender_status")
  e.record.set("organization_id", org)
  if (hatFeld) e.record.set("absender_status", original.getString("absender_status"))

  const person = e.auth ? R.personAusRecord(e.auth) : null
  const mitglied = R.darfAendern(person, org, jetzt)
  const O = R.payloadLesen(R.jsonWert(original, "payload")) || {}
  // Der Absender, dem der Server glaubt: mit Feld nur, wenn Feld und payload übereinstimmen
  const absO = R.gesicherterAbsender(hatFeld ? original.getString("absender_status") : "", O.absender, hatFeld)
  const st = absO && typeof absO.status === "string" ? absO.status : ""
  const fristO = Date.parse(String(O.frist || ""))
  // Ohne Mitglied ist zu, was nicht mehr offen oder dessen Frist abgelaufen ist (die alte App
  // ändert nur in der Frist; eine übernommene Änderung alter Stände darf das nicht überschreiben)
  const zu = original.getString("status") !== "offen" || (Number.isFinite(fristO) && fristO <= jetzt)
  const gesperrt = !mitglied && (st === "bestaetigt" || st === "ohne_unterschrift" || st === "ausstehend" || zu)
  // Gesperrt: alle Felder außer payload aus dem Original; ausstehend auch für Mitglieder (bis auf status)
  if (st === "ausstehend") R.felderZuruecksetzen(e.record, original, ["payload", "status"])
  else if (gesperrt) R.felderZuruecksetzen(e.record, original, ["payload"])
  // Die Gegenzeichnung (admin_*) setzt nur ein Mitglied, auch bei offenen Sätzen (Druck der Leitung)
  if (!mitglied) R.felderBehalten(e.record, original, R.GEGENZEICHNUNG)

  const schluessel = R.bodySchluessel(e)
  const hatPayload = schluessel.indexOf("payload") >= 0
  const hatStatus = schluessel.indexOf("status") >= 0
  if (!hatPayload && !hatStatus) return e.next()

  const N = hatPayload ? Object.assign({}, R.payloadLesen(R.jsonWert(e.record, "payload")) || {}) : Object.assign({}, O)
  // 1. Server-Schlüssel aus dem Original; ohne Mitglied auch Rückfragen und Stellungnahmen
  const fest = mitglied ? R.SERVER_SCHLUESSEL : R.SERVER_SCHLUESSEL.concat(R.MITGLIEDS_SCHLUESSEL)
  for (const k of fest) {
    if (Object.prototype.hasOwnProperty.call(O, k)) N[k] = O[k]
    else delete N[k]
  }
  const geaendert = R.kanonisch(N) !== R.kanonisch(O)
  // 2. Ausstehend: nichts ändern, kein Statuswechsel (auch nicht durch die Leitung)
  if (st === "ausstehend" && (geaendert || e.record.getString("status") !== "offen")) throw new BadRequestError(R.HOOK_TEXTE.wartet)
  // 3. Ohne Mitglied bleibt der Status
  if (!mitglied) e.record.set("status", original.getString("status"))
  // 4. Bestätigtes ändert nur ein Mitglied; Abgeschlossenes oder Abgelaufenes ohne Mitglied niemand
  if (!mitglied && geaendert && (st === "bestaetigt" || st === "ohne_unterschrift")) throw new ForbiddenError(R.HOOK_TEXTE.bestaetigt)
  if (!mitglied && geaendert && zu) throw new ForbiddenError(R.HOOK_TEXTE.abgeschlossen)

  let aus = N
  if (geaendert) {
    try {
      const mitglieder = R.mitgliederLaden(e.app, org)
      let q = R.besatzungAufloesen(N, O, mitglieder, { orgId: org, mitglied: mitglied, ausstehend: false, jetzt: jetzt })
      const feldO = absO && typeof absO.feld === "string" ? absO.feld : ""
      // Druckname und gezeichnete Unterschrift bleiben beim bestätigten Absender
      if (st === "bestaetigt" && (!person || person.id !== absO.id)) {
        for (const f of [feldO, "signature"]) {
          if (!f) continue
          if (Object.prototype.hasOwnProperty.call(O, f)) q[f] = O[f]
          else delete q[f]
        }
      }
      // Modus frei: geänderter Druckname bestimmt den Absender neu (Fall 9/10). Das Druckfeld ist
      // das gespeicherte, außer dort steht nichts und im anderen Namensfeld ein Name (alte Maske).
      if (absO && absO.modus === "frei" && (st === "nicht_bestaetigt" || st === "ohne_konto") && feldO) {
        const feld = R.druckfeldIn(q, feldO)
        if (feld !== feldO || R.anzeigeName(q[feld]) !== R.anzeigeName(O[feld])) {
          const t = R.treffer(mitglieder, typeof q[feld] === "string" ? q[feld] : "", org, jetzt)
          const neu = t.length === 1
            ? Object.assign({}, absO, { id: t[0].id, name: R.kontoName(t[0]), status: "nicht_bestaetigt", feld: feld })
            : Object.assign({}, absO, { id: "", name: R.anzeigeName(q[feld]), status: "ohne_konto", feld: feld })
          if (t.length === 1) q[feld] = neu.name
          q.absender = neu
          if (hatFeld) e.record.set("absender_status", neu.status)
        }
      }
      const liste = Array.isArray(O.aenderungen) ? O.aenderungen : []
      q.aenderungen = liste.concat([{ am: new Date(jetzt).toISOString(), weg: mitglied ? "mitglied" : "anonym", id: person ? person.id : "", name: person ? R.kontoName(person) : "" }]).slice(-200)
      aus = q
    } catch (err) {
      try { e.app.logger().warn("[formular] Änderung ohne Nachbearbeitung gespeichert", "id", e.record.id, "fehler", String(err).slice(0, 200)) } catch (x) { /* ohne Log */ }
    }
  }
  if (hatPayload || aus !== N) e.record.set("payload", aus)
  e.next()
}, "patients")

// product_outputs: Absender und Empfänger bleiben, wie der Server sie gesetzt hat. Ein Body
// nur mit status (Lager „Ausbuchen“ im Batch) bleibt unberührt.
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  try {
    const R = require(`${__hooks}/formular-regeln.js`)
    const jetzt = Date.now()
    const original = e.record.original()
    const org = original.getString("organization_id")
    e.record.set("organization_id", org)
    if (R.feldDa(e.app, "product_outputs", "absender_status")) e.record.set("absender_status", original.getString("absender_status"))
    const person = e.auth ? R.personAusRecord(e.auth) : null
    if (!R.darfAendern(person, org, jetzt)) e.record.set("status", original.getString("status"))
    if (R.bodySchluessel(e).indexOf("payload") >= 0) {
      const O = R.payloadLesen(R.jsonWert(original, "payload"))
      if (O) {
        const N = Object.assign({}, R.payloadLesen(R.jsonWert(e.record, "payload")) || {})
        for (const k of ["absender", "user_id", "user_name", "eingang_sha256"]) {
          if (Object.prototype.hasOwnProperty.call(O, k)) N[k] = O[k]
          else delete N[k]
        }
        e.record.set("payload", N)
      }
    }
  } catch (err) {
    try { e.app.logger().warn("[formular] Produktausgabe ohne Prüfung geändert", "id", e.record.id, "fehler", String(err).slice(0, 200)) } catch (x) { /* ohne Log */ }
  }
  e.next()
}, "product_outputs")

// ── Aufräumen der Drossel ──────────────────────────────────────────────────
// Zum Prüfen: POST /api/crons/responda_formular_aufraeumen (Superuser).

cronAdd("responda_formular_aufraeumen", "*/10 * * * *", () => {
  const R = require(`${__hooks}/formular-regeln.js`)
  const jetzt = Date.now()
  let weg = 0
  try {
    weg = R.aufraeumen($app, jetzt)
  } catch (err) {
    $app.logger().warn("[formular] Aufräumen der Drossel fehlgeschlagen", "fehler", String(err).slice(0, 200))
  }
  if (weg > 0) $app.logger().info("[formular] Drossel aufgeräumt", "entfernt", weg)
})
