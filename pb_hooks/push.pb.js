// PocketBase hook: Push-Benachrichtigungen  (PocketBase v0.23+ API)
//
// Nur Registrierung. Die Regeln stehen in push-regeln.js (rein, Prüffälle in vitest), die
// Fristen in push-fristen.js, Ein- und Ausgabe in push-versand.js. Verschlüsselt und gesendet
// wird nicht hier, sondern im eigenen Push-Dienst (dienste/push, nur 127.0.0.1): Die JSVM kann
// weder RFC 8291 noch VAPID.
//
// Hier registriert:
//   - Schutz der Mitteilungen (hub_notifications): anlegen, ändern, löschen nur Superuser,
//     Supervisor (jede Organisation) oder Leitung (Rolle admin, nur die eigene Organisation),
//     aktives Konto; die Leitung höchstens 3 neue Mitteilungen je Organisation in 24 Stunden;
//     Titel höchstens 120, Text höchstens 1000 Zeichen, nur Text. created_by setzt der Hook.
//     Geprüft vor e.next(), unabhängig von den API-Regeln (Owner 12.3, Bauplan 2.7).
//   - Schutz der versteckten Felder users.push_einstellungen und organizations.push_anlaesse:
//     über die API (nicht Superuser) bleibt der gespeicherte Wert.
//   - Auslöser (Model-Hooks, auch Batch, Routen und Admin-Oberfläche): e.next() zuerst, alles
//     Weitere in try/catch, damit ein Push-Fehler nie etwas anderes stört.
//   - Konto gelöscht oder alle Anmeldungen ungültig (neuer tokenKey, also neues Passwort, auch vom
//     Supervisor gesetzt): Geräte und wartende Einträge weg.
//   - Routen unter /api/responda/push/… (Vertrag: Bauplan 1.2) und der Minutentakt
//     responda_push_takt (auch POST /api/crons/responda_push_takt).
//
// Rücknahme: diese Datei aus /opt/pb_hooks entfernen und PocketBase neu starten; die übrigen
// push-*.js sind passive Module. Ab dann sendet niemand mehr. Erst danach den Dienst stoppen.
//
// Logs nie mit Inhalt, Endpoint oder Schlüssel; nur Anlass, Anzahl, Org-Kennung.
// HINWEIS (PocketBase-JSVM): Handler laufen isoliert, require() deshalb im Handler.

onBootstrap((e) => {
  e.next()
  try {
    e.app.store().set("responda:push_aktiv", true)
    const V = require(`${__hooks}/push-versand.js`)
    const U = V.umgebung({ app: e.app, http: $http, security: $security, os: $os, Record: Record })
    const ein = V.eingerichtet(U)
    if (!ein.ok) U.log("warn", "Push ist noch nicht vollständig eingerichtet", { fehlt: ein.fehlt.join(",") })
    const k = V.konfiguration(U)
    if (k.testHostsGesetzt || k.testzeit) U.log("warn", "Prüfbetrieb gesetzt (RESPONDA_PUSH_TEST_HOSTS oder RESPONDA_PUSH_TESTZEIT): im Betrieb entfernen", {})
  } catch (err) {
    try { e.app.logger().error("[push] Start: Module nicht geladen", "fehler", String(err).slice(0, 200)) } catch (err2) { /* ohne Log */ }
  }
})

// ── Mitteilungen der Organisation schützen (vor e.next()) ───────────────────

// Scheitert das Speichern nach der Prüfung, zählt die Vormerkung der Drossel nicht.
onRecordCreateRequest((e) => {
  let V = null
  let U = null
  let p = null
  if (!e.hasSuperuserAuth()) {
    const R = require(`${__hooks}/push-regeln.js`)
    V = require(`${__hooks}/push-versand.js`)
    U = V.umgebung({ app: e.app, http: $http, security: $security, os: $os, Record: Record })
    p = V.mitteilungSchuetzen(U, R, "anlegen", e.auth, e.record)
    if (!p.ok) {
      if (p.status === 403) throw new ForbiddenError(p.text)
      if (p.status === 429) throw new TooManyRequestsError(p.text)
      throw new BadRequestError(p.text)
    }
  }
  try {
    e.next()
  } catch (err) {
    if (p && p.vorgemerkt) { try { V.mitteilungDrosselFreigeben(U, p.vorgemerkt.orgId, p.vorgemerkt.ms) } catch (err2) { /* egal */ } }
    throw err
  }
}, "hub_notifications")

onRecordUpdateRequest((e) => {
  let V = null
  let U = null
  let p = null
  if (!e.hasSuperuserAuth()) {
    const R = require(`${__hooks}/push-regeln.js`)
    V = require(`${__hooks}/push-versand.js`)
    U = V.umgebung({ app: e.app, http: $http, security: $security, os: $os, Record: Record })
    p = V.mitteilungSchuetzen(U, R, "aendern", e.auth, e.record)
    if (!p.ok) {
      if (p.status === 403) throw new ForbiddenError(p.text)
      if (p.status === 429) throw new TooManyRequestsError(p.text)
      throw new BadRequestError(p.text)
    }
  }
  try {
    e.next()
  } catch (err) {
    if (p && p.vorgemerkt) { try { V.mitteilungDrosselFreigeben(U, p.vorgemerkt.orgId, p.vorgemerkt.ms) } catch (err2) { /* egal */ } }
    throw err
  }
}, "hub_notifications")

onRecordDeleteRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const R = require(`${__hooks}/push-regeln.js`)
    const V = require(`${__hooks}/push-versand.js`)
    const U = V.umgebung({ app: e.app, http: $http, security: $security, os: $os, Record: Record })
    const p = V.mitteilungSchuetzen(U, R, "loeschen", e.auth, e.record)
    if (!p.ok) throw new ForbiddenError(p.text)
  }
  e.next()
}, "hub_notifications")

// ── Versteckte Felder: über die API nie schreibbar (nur die Routen) ─────────

onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const feld = e.record.collection().name === "users" ? "push_einstellungen" : "push_anlaesse"
    try { if (e.record.collection().fields.getByName(feld)) e.record.set(feld, null) } catch (err) { /* Feld fehlt */ }
  }
  e.next()
}, "users", "organizations")

onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const feld = e.record.collection().name === "users" ? "push_einstellungen" : "push_anlaesse"
    try { if (e.record.collection().fields.getByName(feld)) e.record.set(feld, e.record.original().get(feld)) } catch (err) { /* Feld fehlt */ }
  }
  e.next()
}, "users", "organizations")

// ── Auslöser (3.2) ──────────────────────────────────────────────────────────

onRecordAfterCreateSuccess((e) => {
  e.next()
  try {
    const R = require(`${__hooks}/push-regeln.js`)
    const V = require(`${__hooks}/push-versand.js`)
    V.ausloesen(V.umgebung({ app: $app, http: $http, security: $security, os: $os, Record: Record }), R, "anlegen", e.record, null)
  } catch (err) {
    try { $app.logger().error("[push] Auslöser gescheitert", "fehler", String(err).slice(0, 200)) } catch (err2) { /* ohne Log */ }
  }
}, "hub_notifications", "patients", "product_outputs", "form_submissions", "mpg_defect_reports", "mpg_defects", "mpg_ereignisse", "cirs_reports", "ausbildungen_einladungen", "inventory_transactions", "inventory_stock")

onRecordAfterUpdateSuccess((e) => {
  e.next()
  try {
    const R = require(`${__hooks}/push-regeln.js`)
    const V = require(`${__hooks}/push-versand.js`)
    V.ausloesen(V.umgebung({ app: $app, http: $http, security: $security, os: $os, Record: Record }), R, "aendern", e.record, e.record.original())
  } catch (err) {
    try { $app.logger().error("[push] Auslöser gescheitert", "fehler", String(err).slice(0, 200)) } catch (err2) { /* ohne Log */ }
  }
}, "hub_notifications", "mpg_devices", "ausbildungen_termine_user", "ausbildungen_einladungen", "inventory_stock", "inventory_items")

// Neues Passwort: PocketBase erneuert tokenKey, alle Anmeldungen der Person werden ungültig. Ihre
// Geräte bekämen sonst weiter Einzelheiten (ein verlorenes Telefon bis zum exp des alten Tokens).
// Vorab nur der Vergleich, damit gewöhnliche Änderungen an users keine Module laden.
onRecordAfterUpdateSuccess((e) => {
  e.next()
  try {
    if (e.record.getString("tokenKey") === e.record.original().getString("tokenKey")) return
    const R = require(`${__hooks}/push-regeln.js`)
    const V = require(`${__hooks}/push-versand.js`)
    V.ausloesen(V.umgebung({ app: $app, http: $http, security: $security, os: $os, Record: Record }), R, "aendern", e.record, e.record.original())
  } catch (err) {
    try { $app.logger().error("[push] Geräte nach neuem Passwort nicht abgemeldet", "fehler", String(err).slice(0, 200)) } catch (err2) { /* ohne Log */ }
  }
}, "users")

// Konto gelöscht über die API oder die Admin-Oberfläche: gleich nach dem Löschen aufräumen. In
// PocketBase 0.23.x geht das nur hier; in onRecordAfterDeleteSuccess unten scheitert dort jeder
// Datenbankzugriff („transaction has already been committed“). Was anders gelöscht wird, räumt der
// Takt ab (verwaisteEntfernen). Doppelt aufräumen schadet nicht.
onRecordDeleteRequest((e) => {
  e.next()
  try {
    const R = require(`${__hooks}/push-regeln.js`)
    const V = require(`${__hooks}/push-versand.js`)
    V.ausloesen(V.umgebung({ app: $app, http: $http, security: $security, os: $os, Record: Record }), R, "loeschen", e.record, null)
  } catch (err) {
    try { $app.logger().error("[push] Aufräumen nach dem Löschen gescheitert", "fehler", String(err).slice(0, 200)) } catch (err2) { /* ohne Log */ }
  }
}, "users")

onRecordAfterDeleteSuccess((e) => {
  e.next()
  try {
    const R = require(`${__hooks}/push-regeln.js`)
    const V = require(`${__hooks}/push-versand.js`)
    V.ausloesen(V.umgebung({ app: $app, http: $http, security: $security, os: $os, Record: Record }), R, "loeschen", e.record, null)
  } catch (err) {
    try { $app.logger().error("[push] Aufräumen nach dem Löschen gescheitert", "fehler", String(err).slice(0, 200)) } catch (err2) { /* ohne Log */ }
  }
}, "users", "inventory_stock")

// ── Routen (1.2) ────────────────────────────────────────────────────────────

routerAdd("GET", "/api/responda/push/stand", (e) => {
  const R = require(`${__hooks}/push-regeln.js`)
  const V = require(`${__hooks}/push-versand.js`)
  return V.routeStand(V.umgebung({ app: $app, http: $http, security: $security, os: $os, Record: Record }), R, e)
})

routerAdd("POST", "/api/responda/push/geraet", (e) => {
  const R = require(`${__hooks}/push-regeln.js`)
  const V = require(`${__hooks}/push-versand.js`)
  return V.routeGeraet(V.umgebung({ app: $app, http: $http, security: $security, os: $os, Record: Record }), R, e)
})

routerAdd("POST", "/api/responda/push/geraet/abmelden", (e) => {
  const R = require(`${__hooks}/push-regeln.js`)
  const V = require(`${__hooks}/push-versand.js`)
  return V.routeAbmelden(V.umgebung({ app: $app, http: $http, security: $security, os: $os, Record: Record }), R, e)
})

routerAdd("POST", "/api/responda/push/einstellungen", (e) => {
  const R = require(`${__hooks}/push-regeln.js`)
  const V = require(`${__hooks}/push-versand.js`)
  return V.routeEinstellungen(V.umgebung({ app: $app, http: $http, security: $security, os: $os, Record: Record }), R, e)
})

routerAdd("GET", "/api/responda/push/organisation", (e) => {
  const R = require(`${__hooks}/push-regeln.js`)
  const V = require(`${__hooks}/push-versand.js`)
  return V.routeOrganisation(V.umgebung({ app: $app, http: $http, security: $security, os: $os, Record: Record }), R, e, false)
})

routerAdd("POST", "/api/responda/push/organisation", (e) => {
  const R = require(`${__hooks}/push-regeln.js`)
  const V = require(`${__hooks}/push-versand.js`)
  return V.routeOrganisation(V.umgebung({ app: $app, http: $http, security: $security, os: $os, Record: Record }), R, e, true)
})

routerAdd("POST", "/api/responda/push/probe", (e) => {
  const R = require(`${__hooks}/push-regeln.js`)
  const V = require(`${__hooks}/push-versand.js`)
  return V.routeProbe(V.umgebung({ app: $app, http: $http, security: $security, os: $os, Record: Record }), R, e)
})

routerAdd("GET", "/api/responda/push/diagnose", (e) => {
  const R = require(`${__hooks}/push-regeln.js`)
  const V = require(`${__hooks}/push-versand.js`)
  return V.routeDiagnose(V.umgebung({ app: $app, http: $http, security: $security, os: $os, Record: Record }), R, e)
})

// Takt sofort (nur Superuser). jetzt und abbrechenNach nur im Prüfbetrieb (RESPONDA_PUSH_TESTZEIT=1).
routerAdd("POST", "/api/responda/push/takt", (e) => {
  const R = require(`${__hooks}/push-regeln.js`)
  const V = require(`${__hooks}/push-versand.js`)
  if (!e.hasSuperuserAuth()) return V.antwort(R, e, 403, "nicht_berechtigt")
  let F = null
  let L = null
  try { F = require(`${__hooks}/push-fristen.js`) } catch (err) { F = null }
  try { L = require(`${__hooks}/lager-regeln.js`) } catch (err) { L = null }
  const o = { app: $app, http: $http, security: $security, os: $os, Record: Record, imTakt: true }
  if (String($os.getenv("RESPONDA_PUSH_TESTZEIT") || "") === "1") {
    const b = V.bodyLesen(e) || {}
    const t = Date.parse(String(b.jetzt || ""))
    if (Number.isFinite(t)) o.jetztMs = t
    if (typeof b.abbrechenNach === "string") o.abbrechenNach = b.abbrechenNach
  }
  const erledigt = V.takt(V.umgebung(o), R, F, L)
  return e.json(200, { ok: true, erledigt: erledigt })
})

cronAdd("responda_push_takt", "* * * * *", () => {
  try {
    const R = require(`${__hooks}/push-regeln.js`)
    const V = require(`${__hooks}/push-versand.js`)
    let F = null
    let L = null
    try { F = require(`${__hooks}/push-fristen.js`) } catch (err) { F = null }
    try { L = require(`${__hooks}/lager-regeln.js`) } catch (err) { L = null }
    V.takt(V.umgebung({ app: $app, http: $http, security: $security, os: $os, Record: Record, imTakt: true }), R, F, L)
  } catch (err) {
    try { $app.logger().error("[push] Takt gescheitert", "fehler", String(err).slice(0, 200)) } catch (err2) { /* ohne Log */ }
  }
})
