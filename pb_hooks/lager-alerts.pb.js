// PocketBase hook: Lager-Benachrichtigungen  (PocketBase v0.23+ API)
//
// Pro-Nutzer konfigurierbarer täglicher E-Mail-Digest über Artikel unter
// Mindestbestand sowie abgelaufene / bald ablaufende Artikel — im LBF-Design.
//
// Einstellungen liegen je Nutzer im users-Feld "lager_alerts" (JSON):
//   { "enabled":true, "low":true, "expired":true, "expiring":true, "leadDays":30, "email":"" }
//
// Aktiv, sobald SMTP konfiguriert ist (bei euch: Brevo-Relay).
//
// Testen (als eingeloggter Nutzer der Organisation):
//   GET /lager/alerts-test/{orgId}?send=1
//
// HINWEIS (PocketBase-JSVM): Handler laufen isoliert ohne gemeinsamen Scope —
// der HTML-Builder ist daher in beiden Handlern inline.

cronAdd("lager-daily-alerts", "0 7 * * *", () => {
  function buildHtml(low, expired, expiring, lead) {
    const section = (title, color, arr) => arr.length ? (
      '<div style="margin-bottom:22px;">' +
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#600812;margin-bottom:10px;">' + title + '</div>' +
      '<div style="background:#faf9f7;border-left:3px solid ' + color + ';border-radius:8px;padding:4px 14px;">' +
      arr.map(x => '<div style="font-size:14px;color:#1a0e08;padding:7px 0;border-bottom:1px solid rgba(96,8,18,0.05);">' + x + '</div>').join('') +
      '</div></div>'
    ) : ''
    const body =
      section('Unter Mindestbestand', '#600812', low) +
      section('Abgelaufen', '#dc2626', expired) +
      section('Läuft bald ab (' + lead + ' Tage)', '#d97706', expiring)
    return '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
      '<body style="background-color:#faf9f7;margin:0;padding:0;font-family:\'Atkinson Hyperlegible\',Georgia,serif;">' +
      '<div style="max-width:600px;margin:0 auto;padding:40px 20px;">' +
      '<div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">' +
      '<div style="background:#600812;padding:36px 36px 30px;text-align:center;">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(253,232,216,0.55);margin-bottom:8px;">Responda</div>' +
      '<div style="font-size:24px;font-weight:700;font-style:italic;color:#fde8d8;line-height:1.2;">Bestandswarnungen</div>' +
      '</div>' +
      '<div style="padding:36px;">' +
      '<div style="font-size:16px;color:#1a0e08;line-height:1.7;margin-bottom:24px;">Hallo,<br><br>folgende Artikel im Lager brauchen deine Aufmerksamkeit:</div>' +
      body +
      '<div style="height:1px;background:rgba(96,8,18,0.08);margin:28px 0;"></div>' +
      '<div style="font-size:13px;font-style:italic;color:#8a7a68;line-height:1.65;">Du erhältst diese Nachricht, weil du Lager-Benachrichtigungen aktiviert hast. Ändern kannst du das in der Responda-App unter Lager &rarr; Einstellungen.</div>' +
      '</div>' +
      '<div style="background:#faf9f7;border-top:1px solid rgba(96,8,18,0.08);padding:20px 36px;text-align:center;font-size:12px;font-style:italic;color:#8a7a68;">Responda &middot; Einsatzbereit.</div>' +
      '</div></div></body></html>'
  }

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
            html: buildHtml(low, expired, expiring, lead),
          }))
        } catch (err) { console.log("lager-alerts send error:", err.message) }
      }
    } catch (e) { console.log("lager-alerts org error:", e.message) }
  }
})

routerAdd("GET", "/lager/alerts-test/{orgId}", (e) => {
  function buildHtml(low, expired, expiring, lead) {
    const section = (title, color, arr) => arr.length ? (
      '<div style="margin-bottom:22px;">' +
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#600812;margin-bottom:10px;">' + title + '</div>' +
      '<div style="background:#faf9f7;border-left:3px solid ' + color + ';border-radius:8px;padding:4px 14px;">' +
      arr.map(x => '<div style="font-size:14px;color:#1a0e08;padding:7px 0;border-bottom:1px solid rgba(96,8,18,0.05);">' + x + '</div>').join('') +
      '</div></div>'
    ) : ''
    const body =
      section('Unter Mindestbestand', '#600812', low) +
      section('Abgelaufen', '#dc2626', expired) +
      section('Läuft bald ab (' + lead + ' Tage)', '#d97706', expiring)
    return '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
      '<body style="background-color:#faf9f7;margin:0;padding:0;font-family:\'Atkinson Hyperlegible\',Georgia,serif;">' +
      '<div style="max-width:600px;margin:0 auto;padding:40px 20px;">' +
      '<div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">' +
      '<div style="background:#600812;padding:36px 36px 30px;text-align:center;">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(253,232,216,0.55);margin-bottom:8px;">Responda</div>' +
      '<div style="font-size:24px;font-weight:700;font-style:italic;color:#fde8d8;line-height:1.2;">Bestandswarnungen</div>' +
      '</div>' +
      '<div style="padding:36px;">' +
      '<div style="font-size:16px;color:#1a0e08;line-height:1.7;margin-bottom:24px;">Hallo,<br><br>folgende Artikel im Lager brauchen deine Aufmerksamkeit:</div>' +
      body +
      '<div style="height:1px;background:rgba(96,8,18,0.08);margin:28px 0;"></div>' +
      '<div style="font-size:13px;font-style:italic;color:#8a7a68;line-height:1.65;">Du erhältst diese Nachricht, weil du Lager-Benachrichtigungen aktiviert hast. Ändern kannst du das in der Responda-App unter Lager &rarr; Einstellungen.</div>' +
      '</div>' +
      '<div style="background:#faf9f7;border-top:1px solid rgba(96,8,18,0.08);padding:20px 36px;text-align:center;font-size:12px;font-style:italic;color:#8a7a68;">Responda &middot; Einsatzbereit.</div>' +
      '</div></div></body></html>'
  }

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
        html: buildHtml(low, expired, expiring, lead),
      }))
      sent = 1
    } catch (err) { sendError = err.message }
  }

  return e.json(200, { low, expiring, expired, recipient: email, enabled: p.enabled === true, leadDays: lead, sent, sendError, sentRequested: doSend })
}, $apis.requireAuth())
