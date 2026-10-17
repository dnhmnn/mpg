// PocketBase hook: Willkommens-E-Mail  (PocketBase v0.23+ API)
//
// Jeder neue Benutzer mit echter Adresse bekommt eine Willkommens-E-Mail,
// automatisch — egal ob der Supervisor, die Benutzerverwaltung oder die
// Einstellungen ihn anlegen. Mit Link zur App, Organisation, Org-Code und
// "Passwort festlegen". Inhalt und Ausnahmen stehen in willkommen-mail.js,
// die eingebettete Schrift in willkommen-schrift.js.
//
// Der Versand läuft nach dem Speichern: Klappt er nicht (kein Mailserver,
// Adresse abgelehnt), ist der Benutzer trotzdem angelegt — der Fehler steht
// im PocketBase-Log.
//
// HINWEIS (PocketBase-JSVM): Handler laufen isoliert — require() daher im Handler.

onRecordAfterCreateSuccess((e) => {
  try {
    const { willkommenMail } = require(`${__hooks}/willkommen-mail.js`)
    const r = e.record

    let org = null
    const orgId = r.getString("organization_id")
    if (orgId) {
      try {
        const o = e.app.findRecordById("organizations", orgId)
        org = { name: o.getString("org_name"), code: o.getString("org_code") }
      } catch (err) { /* Organisation nicht gefunden — E-Mail ohne Org-Angaben */ }
    }

    let rechte = null
    try { rechte = JSON.parse(r.getString("permissions") || "null") } catch (err) { rechte = null }

    // Atkinson Hyperlegible eingebettet; fehlt die Datei, gilt die Ersatzschrift
    let schrift = ""
    try { schrift = require(`${__hooks}/willkommen-schrift.js`).css || "" } catch (err) { schrift = "" }

    const mail = willkommenMail({
      name: r.getString("name"),
      email: r.getString("email"),
      role: r.getString("role"),
      permissions: rechte,
      supervisor: r.getBool("supervisor"),
      org: org,
      schrift: schrift,
    })

    if (mail) {
      const settings = e.app.settings()
      e.app.newMailClient().send(new MailerMessage({
        from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
        to: [{ address: mail.an }],
        subject: mail.betreff,
        html: mail.html,
        text: mail.text,
      }))
    }
  } catch (err) {
    e.app.logger().warn("Willkommens-E-Mail nicht gesendet", "user", e.record.id, "error", String(err))
  }
  e.next()
}, "users")

// Willkommens-E-Mail gezielt senden — als Probe an sich selbst oder für einen
// Benutzer, der angelegt wurde, bevor dieser Hook auf dem Server lag. Die
// Antwort sagt, woran es hakt: Mailversand ausgeschaltet, Fehler des
// Mailservers, oder gesendet.
//
// Dürfen: Supervisor; Verwalter (Recht Benutzerverwaltung, auch befristet)
// für Benutzer der eigenen Organisation; jeder für sich selbst.
routerAdd("POST", "/willkommen/senden", (e) => {
  const { willkommenMail } = require(`${__hooks}/willkommen-mail.js`)
  const ich = e.auth
  let body = {}
  try { body = e.requestInfo().body || {} } catch (err) { body = {} }

  let ziel = null
  try { ziel = e.app.findRecordById("users", String(body.userId || ich.id)) } catch (err) { ziel = null }
  if (!ziel) return e.json(404, { fehler: "Benutzer nicht gefunden." })

  if (!ich.getBool("supervisor") && ziel.id !== ich.id) {
    let rechte = {}
    let befristet = {}
    try { rechte = JSON.parse(ich.getString("permissions") || "{}") || {} } catch (err) { rechte = {} }
    try { befristet = JSON.parse(ich.getString("temp_permissions") || "{}") || {} } catch (err) { befristet = {} }
    const bis = befristet.unitarii && befristet.unitarii.until ? new Date(String(befristet.unitarii.until).replace(" ", "T")).getTime() : 0
    const verwalter = rechte.unitarii === true || bis > Date.now()
    const org = ich.getString("organization_id")
    if (!verwalter || !org || org !== ziel.getString("organization_id")) {
      return e.json(403, { fehler: "Keine Berechtigung für diesen Benutzer." })
    }
  }

  let org = null
  const orgId = ziel.getString("organization_id")
  if (orgId) {
    try {
      const o = e.app.findRecordById("organizations", orgId)
      org = { name: o.getString("org_name"), code: o.getString("org_code") }
    } catch (err) { /* ohne Org-Angaben */ }
  }
  let rechte = null
  try { rechte = JSON.parse(ziel.getString("permissions") || "null") } catch (err) { rechte = null }

  let schrift = ""
  try { schrift = require(`${__hooks}/willkommen-schrift.js`).css || "" } catch (err) { schrift = "" }

  const settings = e.app.settings()
  const stand = { erweiterung: true, smtp: !!settings.smtp.enabled, absender: settings.meta.senderAddress || "" }

  const mail = willkommenMail({
    name: ziel.getString("name"),
    email: ziel.getString("email"),
    role: ziel.getString("role"),
    permissions: rechte,
    supervisor: ziel.getBool("supervisor"),
    org: org,
    schrift: schrift,
  })
  if (!mail) {
    return e.json(400, Object.assign({}, stand, { fehler: "Für diese Adresse gibt es keine Willkommens-E-Mail (Platzhalter oder temporärer Zugang)." }))
  }

  try {
    e.app.newMailClient().send(new MailerMessage({
      from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
      to: [{ address: mail.an }],
      subject: mail.betreff,
      html: mail.html,
      text: mail.text,
    }))
  } catch (err) {
    e.app.logger().warn("Willkommens-E-Mail nicht gesendet", "user", ziel.id, "error", String(err))
    return e.json(502, Object.assign({}, stand, { fehler: String(err) }))
  }
  return e.json(200, Object.assign({}, stand, { gesendet: true, an: mail.an }))
}, $apis.requireAuth("users"))
