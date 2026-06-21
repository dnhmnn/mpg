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

  const orgs = $app.findRecordsByFilter("organizations", "id != ''", "", 1000, 0)
  for (const org of orgs) {
    try {
      const orgId = org.id
      const items = $app.findRecordsByFilter("inventory_items", "organization_id = {:o}", "", 5000, 0, { o: orgId })
      if (!items.length) continue
      const stock = $app.findRecordsByFilter("inventory_stock", "organization_id = {:o}", "", 10000, 0, { o: orgId })

      const qty = {}, exp = {}
      for (const s of stock) {
        const iid = s.get("item_id")
        qty[iid] = (qty[iid] || 0) + (s.get("quantity") || 0)
        const ed = s.get("expiry_date")
        if (ed) { const t = new Date(ed).getTime(); if (!exp[iid] || t < exp[iid]) exp[iid] = t }
      }

      const users = $app.findRecordsByFilter("users", "organization_id = {:o}", "", 1000, 0, { o: orgId })
      const settings = $app.settings()
      const client = $app.newMailClient()
      const now = Date.now()

      for (const u of users) {
        if (u.get("disabled") === true) continue
        let p = {}
        try { const r = u.get("lager_alerts"); p = typeof r === "string" ? JSON.parse(r) : (r || {}) } catch (er) {}
        if (!p || p.enabled !== true) continue

        const lead = (typeof p.leadDays === "number" && p.leadDays > 0) ? p.leadDays : 30
        const soon = now + lead * 86400000
        const low = [], expiring = [], expired = []
        for (const it of items) {
          if (p.low !== false) {
            const min = it.get("min_stock") || 0, q = qty[it.id] || 0
            if (min > 0 && q < min) low.push(it.get("name") + " (" + q + "/" + min + ")")
          }
          const t = exp[it.id]
          if (t) {
            const ds = new Date(t).toISOString().slice(0, 10)
            if (t < now) { if (p.expired !== false) expired.push(it.get("name") + " (" + ds + ")") }
            else if (t < soon) { if (p.expiring !== false) expiring.push(it.get("name") + " (" + ds + ")") }
          }
        }
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

  const orgId = e.request.pathValue("orgId")
  const u = e.auth
  if (!u || u.get("organization_id") !== orgId) {
    return e.json(403, { error: "Nicht berechtigt" })
  }
  const doSend = e.requestInfo().query["send"] === "1"

  let p = {}
  try { const r = u.get("lager_alerts"); p = typeof r === "string" ? JSON.parse(r) : (r || {}) } catch (er) {}
  const lead = (typeof p.leadDays === "number" && p.leadDays > 0) ? p.leadDays : 30

  const items = $app.findRecordsByFilter("inventory_items", "organization_id = {:o}", "", 5000, 0, { o: orgId })
  const stock = $app.findRecordsByFilter("inventory_stock", "organization_id = {:o}", "", 10000, 0, { o: orgId })

  const qty = {}, exp = {}
  for (const s of stock) {
    const iid = s.get("item_id")
    qty[iid] = (qty[iid] || 0) + (s.get("quantity") || 0)
    const ed = s.get("expiry_date")
    if (ed) { const t = new Date(ed).getTime(); if (!exp[iid] || t < exp[iid]) exp[iid] = t }
  }

  const now = Date.now(), soon = now + lead * 86400000
  const low = [], expiring = [], expired = []
  for (const it of items) {
    if (p.low !== false) {
      const min = it.get("min_stock") || 0, q = qty[it.id] || 0
      if (min > 0 && q < min) low.push(it.get("name") + " (" + q + "/" + min + ")")
    }
    const t = exp[it.id]
    if (t) {
      const ds = new Date(t).toISOString().slice(0, 10)
      if (t < now) { if (p.expired !== false) expired.push(it.get("name") + " (" + ds + ")") }
      else if (t < soon) { if (p.expiring !== false) expiring.push(it.get("name") + " (" + ds + ")") }
    }
  }

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
