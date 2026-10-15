// PocketBase hook: Willkommens-E-Mail  (PocketBase v0.23+ API)
//
// Jeder neue Benutzer mit echter Adresse bekommt eine Willkommens-E-Mail,
// automatisch — egal ob der Supervisor, die Benutzerverwaltung oder die
// Einstellungen ihn anlegen. Mit Link zur App, Organisation, Org-Code und
// "Passwort festlegen". Inhalt und Ausnahmen stehen in willkommen-mail.js.
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

    const mail = willkommenMail({
      name: r.getString("name"),
      email: r.getString("email"),
      role: r.getString("role"),
      permissions: rechte,
      supervisor: r.getBool("supervisor"),
      org: org,
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
