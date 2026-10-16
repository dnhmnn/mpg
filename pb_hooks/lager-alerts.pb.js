// PocketBase hook: Lager-Benachrichtigungen  (PocketBase v0.23+ API)
//
// Pro-Nutzer konfigurierbarer täglicher E-Mail-Digest über Artikel unter
// Mindestbestand sowie abgelaufene / bald ablaufende Artikel — im LBF-Design
// (Template inkl. eingebetteter Atkinson-Schrift + Logo in lager-email.js).
//
// Einstellungen liegen je Nutzer im users-Feld "lager_alerts" (JSON):
//   { "enabled":true, "low":true, "expired":true, "expiring":true, "leadDays":30, "email":"" }
//
// Aktiv, sobald SMTP konfiguriert ist (bei euch: Brevo-Relay).
//
// Testen (als eingeloggter Nutzer der Organisation):
//   GET /lager/alerts-test/{orgId}?send=1
//
// HINWEIS (PocketBase-JSVM): Handler laufen isoliert — require() daher im Handler.

cronAdd("lager-daily-alerts", "0 7 * * *", () => {
  const { buildAlertHtml } = require(`${__hooks}/lager-email.js`)
  const { lagerWarnungen, jsonFeld } = require(`${__hooks}/lager-regeln.js`)

  const orgs = $app.findRecordsByFilter("organizations", "id != ''", "", 1000, 0)
  for (const org of orgs) {
    try {
      const orgId = org.id
      const users = $app.findRecordsByFilter("users", "organization_id = {:o}", "", 1000, 0, { o: orgId })
      const settings = $app.settings()
      const client = $app.newMailClient()
      const jeVorlauf = {}   // Warnungen nur einmal je Vorlauf berechnen

      for (const u of users) {
        if (u.get("disabled") === true) continue
        const p = jsonFeld(u, "lager_alerts") || {}
        if (p.enabled !== true) continue

        const lead = (typeof p.leadDays === "number" && p.leadDays > 0) ? p.leadDays : 30
        if (!jeVorlauf[lead]) jeVorlauf[lead] = lagerWarnungen($app, orgId, lead, Date.now())
        const w = jeVorlauf[lead]
        const low = p.low !== false ? w.low : []
        const expired = p.expired !== false ? w.expired : []
        const expiring = p.expiring !== false ? w.expiring : []
        if (!low.length && !expiring.length && !expired.length) continue

        const email = (p.email && String(p.email).trim()) ? String(p.email).trim() : u.get("email")
        if (!email) continue

        try {
          client.send(new MailerMessage({
            from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
            to: [{ address: email }],
            subject: "Responda Lager – Bestandswarnungen",
            html: buildAlertHtml(low, expired, expiring, lead),
          }))
        } catch (err) { console.log("lager-alerts send error:", err.message) }
      }
    } catch (e) { console.log("lager-alerts org error:", e.message) }
  }
})

routerAdd("GET", "/lager/alerts-test/{orgId}", (e) => {
  const { buildAlertHtml } = require(`${__hooks}/lager-email.js`)
  const { lagerWarnungen, jsonFeld } = require(`${__hooks}/lager-regeln.js`)

  const orgId = e.request.pathValue("orgId")
  const u = e.auth
  if (!u || u.get("organization_id") !== orgId) {
    return e.json(403, { error: "Nicht berechtigt" })
  }
  const doSend = e.requestInfo().query["send"] === "1"

  const p = jsonFeld(u, "lager_alerts") || {}
  const lead = (typeof p.leadDays === "number" && p.leadDays > 0) ? p.leadDays : 30

  const w = lagerWarnungen($app, orgId, lead, Date.now())
  const low = p.low !== false ? w.low : []
  const expired = p.expired !== false ? w.expired : []
  const expiring = p.expiring !== false ? w.expiring : []

  const email = (p.email && String(p.email).trim()) ? String(p.email).trim() : u.get("email")
  let sent = 0, sendError = null
  if (doSend && (low.length || expiring.length || expired.length) && email) {
    const settings = $app.settings()
    try {
      $app.newMailClient().send(new MailerMessage({
        from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
        to: [{ address: email }],
        subject: "Responda Lager – Bestandswarnungen (Test)",
        html: buildAlertHtml(low, expired, expiring, lead),
      }))
      sent = 1
    } catch (err) { sendError = err.message }
  }

  return e.json(200, { low, expiring, expired, recipient: email, enabled: p.enabled === true, leadDays: lead, sent, sendError, sentRequested: doSend })
}, $apis.requireAuth())
