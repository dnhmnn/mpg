// PocketBase hook: Lager-Bestellungen  (PocketBase v0.23+ API)
//
// 1. POST /lager/order — verschickt eine Bestell-Mail direkt an den Lieferanten
//    (über das konfigurierte SMTP/Brevo-Relay) und protokolliert jede Position
//    in der Collection "inventory_orders" (status: bestellt).
//    Body: { supplier_email, items: [{ item_id, name, qty, unit, supplier_item_no, supplier }] }
//
// 2. Cron "lager-auto-order" (täglich 07:30) — bestellt automatisch Artikel mit
//    auto_order = true, deren Gesamtbestand unter dem Mindestbestand liegt und
//    für die noch keine offene Bestellung existiert. Eine Mail je Lieferant.
//
// Benötigte Collection "inventory_orders":
//   item_id (text), item_name (text), qty (number), unit (text),
//   supplier (text), supplier_email (text), status (text: bestellt/geliefert),
//   user (text), organization_id (text)
// Benötigtes Feld an inventory_items: auto_order (bool)

routerAdd("POST", "/lager/order", (e) => {
  const u = e.auth
  if (!u) return e.json(403, { success: false, error: "Nicht berechtigt" })
  const orgId = u.get("organization_id")
  const body = e.requestInfo().body || {}
  const email = (body.supplier_email || "").toString().trim()
  const items = Array.isArray(body.items) ? body.items : []
  if (!email || !items.length) {
    return e.json(400, { success: false, error: "supplier_email und items erforderlich" })
  }

  let orgName = ""
  try { orgName = $app.findRecordById("organizations", orgId).get("name") || "" } catch (err) {}
  const userName = u.get("name") || u.get("email") || ""
  const userEmail = u.get("email") || ""

  const lines = items.map(it =>
    "<li>" + (it.qty || "") + " " + (it.unit || "Stück") + " — " + (it.name || "") +
    (it.supplier_item_no ? " (Art.-Nr. " + it.supplier_item_no + ")" : "") + "</li>"
  ).join("")

  const html =
    '<div style="font-family:Georgia,serif;font-size:15px;color:#1a0e08;line-height:1.7;max-width:560px;">' +
    "<p>Guten Tag,</p>" +
    "<p>hiermit bestellen wir folgende Artikel:</p>" +
    "<ul>" + lines + "</ul>" +
    "<p>Bitte senden Sie eine Auftragsbestätigung an diese Adresse.</p>" +
    "<p>Mit freundlichen Grüßen<br>" + (userName ? userName + "<br>" : "") + (orgName || "") + "</p>" +
    '<p style="font-size:12px;color:#8a7a68;font-style:italic;">Diese Bestellung wurde über Responda Lager versendet.</p>' +
    "</div>"

  try {
    const settings = $app.settings()
    const msg = new MailerMessage({
      from: { address: settings.meta.senderAddress, name: orgName || settings.meta.senderName },
      to: [{ address: email }],
      subject: "Bestellung " + (orgName || "") + " (" + items.length + " Position" + (items.length > 1 ? "en" : "") + ")",
      html: html,
      headers: userEmail ? { "Reply-To": userEmail } : {},
    })
    $app.newMailClient().send(msg)
  } catch (err) {
    return e.json(500, { success: false, error: "Mailversand fehlgeschlagen: " + err.message })
  }

  // Bestellungen protokollieren (Fehler hier verhindern den Versand nicht mehr)
  let logged = 0
  try {
    const col = $app.findCollectionByNameOrId("inventory_orders")
    for (const it of items) {
      try {
        const rec = new Record(col)
        rec.set("item_id", it.item_id || "")
        rec.set("item_name", it.name || "")
        rec.set("qty", Number(it.qty) || 0)
        rec.set("unit", it.unit || "")
        rec.set("supplier", it.supplier || "")
        rec.set("supplier_email", email)
        rec.set("status", "bestellt")
        rec.set("user", userName)
        rec.set("organization_id", orgId)
        $app.save(rec)
        logged++
      } catch (err) { console.log("lager-order log error:", err.message) }
    }
  } catch (err) { console.log("lager-order collection missing:", err.message) }

  return e.json(200, { success: true, sent: items.length, logged: logged })
}, $apis.requireAuth())

cronAdd("lager-auto-order", "30 7 * * *", () => {
  const orgs = $app.findRecordsByFilter("organizations", "id != ''", "", 1000, 0)
  for (const org of orgs) {
    try {
      const orgId = org.id
      const items = $app.findRecordsByFilter("inventory_items", "organization_id = {:o} && auto_order = true", "", 2000, 0, { o: orgId })
      if (!items.length) continue
      const stock = $app.findRecordsByFilter("inventory_stock", "organization_id = {:o}", "", 10000, 0, { o: orgId })
      const qty = {}
      for (const s of stock) qty[s.get("item_id")] = (qty[s.get("item_id")] || 0) + (s.get("quantity") || 0)

      // je Lieferant sammeln
      const bySupplier = {}
      for (const it of items) {
        const min = it.get("min_stock") || 0
        const email = (it.get("supplier_email") || "").trim()
        if (min <= 0 || !email) continue
        const have = qty[it.id] || 0
        if (have >= min) continue
        // schon offen bestellt? -> überspringen (Doppelbestellungs-Schutz)
        try {
          $app.findFirstRecordByFilter("inventory_orders", "item_id = {:i} && status = 'bestellt'", { i: it.id })
          continue
        } catch (err) { /* keine offene Bestellung -> weiter */ }
        if (!bySupplier[email]) bySupplier[email] = []
        bySupplier[email].push({
          item_id: it.id, name: it.get("name"), qty: min - have,
          unit: it.get("unit") || "Stück",
          supplier_item_no: it.get("supplier_item_no") || "",
          supplier: it.get("supplier") || "",
        })
      }

      const emails = Object.keys(bySupplier)
      if (!emails.length) continue
      const orgName = org.get("name") || ""
      const settings = $app.settings()
      const client = $app.newMailClient()

      for (const email of emails) {
        const list = bySupplier[email]
        const lines = list.map(it =>
          "<li>" + it.qty + " " + it.unit + " — " + it.name +
          (it.supplier_item_no ? " (Art.-Nr. " + it.supplier_item_no + ")" : "") + "</li>"
        ).join("")
        const html =
          '<div style="font-family:Georgia,serif;font-size:15px;color:#1a0e08;line-height:1.7;max-width:560px;">' +
          "<p>Guten Tag,</p><p>hiermit bestellen wir folgende Artikel:</p><ul>" + lines + "</ul>" +
          "<p>Bitte senden Sie eine Auftragsbestätigung an diese Adresse.</p>" +
          "<p>Mit freundlichen Grüßen<br>" + orgName + "</p>" +
          '<p style="font-size:12px;color:#8a7a68;font-style:italic;">Automatische Nachbestellung über Responda Lager (Mindestbestand unterschritten).</p>' +
          "</div>"
        try {
          client.send(new MailerMessage({
            from: { address: settings.meta.senderAddress, name: orgName || settings.meta.senderName },
            to: [{ address: email }],
            subject: "Bestellung " + orgName + " (" + list.length + " Position" + (list.length > 1 ? "en" : "") + ")",
            html: html,
          }))
        } catch (err) { console.log("auto-order send error:", err.message); continue }

        try {
          const col = $app.findCollectionByNameOrId("inventory_orders")
          for (const it of list) {
            try {
              const rec = new Record(col)
              rec.set("item_id", it.item_id)
              rec.set("item_name", it.name)
              rec.set("qty", it.qty)
              rec.set("unit", it.unit)
              rec.set("supplier", it.supplier)
              rec.set("supplier_email", email)
              rec.set("status", "bestellt")
              rec.set("user", "Automatik")
              rec.set("organization_id", orgId)
              $app.save(rec)
            } catch (err) { console.log("auto-order log error:", err.message) }
          }
        } catch (err) { console.log("auto-order collection missing:", err.message) }
      }
    } catch (err) { console.log("auto-order org error:", err.message) }
  }
})
