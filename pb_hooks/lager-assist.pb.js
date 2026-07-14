// PocketBase hook: Lager-KI-Assistent (Mistral, EU)  (v0.23+)
//
// 1. POST /lager/assist  { frage }
//    Beantwortet natürlichsprachige Fragen zum Lager und gibt Bestell-
//    vorschläge. Der Bestandsüberblick (Bestände, Mindestbestand, MHD,
//    Chargen, 90-Tage-Verbrauch) wird serverseitig aus den Collections
//    gebaut — die KI sieht nur diese aggregierten Lagerdaten.
//
// 2. POST /lager/parse-buchung  { text }
//    Wandelt Freitext ("50 Handschuhe M eingebucht, Charge L123, MHD 2027")
//    in strukturierte Buchungen um, gemappt auf echte Artikel-IDs.
//
// Benötigt MISTRAL_API_KEY. Keine Personen-/Patientendaten an die KI.

function loadSnapshot(orgId) {
  const items = $app.findRecordsByFilter("inventory_items", "organization_id = {:o}", "name", 3000, 0, { o: orgId })
  const stock = $app.findRecordsByFilter("inventory_stock", "organization_id = {:o}", "", 10000, 0, { o: orgId })
  const now = Date.now(), since = now - 90 * 86400000
  let txns = []
  try { txns = $app.findRecordsByFilter("inventory_transactions", "organization_id = {:o}", "-created", 8000, 0, { o: orgId }) } catch (e) {}

  const qty = {}, exp = {}, batches = {}
  for (const s of stock) {
    const id = s.get("item_id")
    qty[id] = (qty[id] || 0) + (s.get("quantity") || 0)
    const ed = s.get("expiry_date")
    if (ed) { const t = new Date(ed).getTime(); if (!exp[id] || t < exp[id]) exp[id] = t }
    const b = s.get("batch")
    if (b) { if (!batches[id]) batches[id] = {}; batches[id][b] = true }
  }
  const verbrauch = {}
  for (const t of txns) {
    if (t.get("type") !== "ausbuchung") continue
    const created = new Date(t.get("created")).getTime()
    if (created < since) continue
    const id = t.get("item_id")
    verbrauch[id] = (verbrauch[id] || 0) + Math.abs(t.get("quantity") || 0)
  }

  const lines = []
  for (const it of items) {
    const id = it.id
    const q = qty[id] || 0
    const min = it.get("min_stock") || 0
    const unit = it.get("unit") || "Stück"
    const mhd = exp[id] ? new Date(exp[id]).toISOString().slice(0, 10) : "-"
    const ch = batches[id] ? Object.keys(batches[id]).join("/") : "-"
    const v = verbrauch[id] || 0
    lines.push(it.get("name") + " | Bestand " + q + " " + unit + " | Soll " + min + " | MHD " + mhd + " | Chargen " + ch + " | Verbrauch90T " + v)
  }
  return { count: items.length, text: lines.join("\n") }
}

routerAdd("POST", "/lager/assist", (e) => {
  const u = e.auth
  if (!u) return e.json(403, { success: false, error: "Nicht berechtigt" })
  const key = $os.getenv("MISTRAL_API_KEY")
  if (!key) return e.json(500, { success: false, error: "MISTRAL_API_KEY ist auf dem Server nicht gesetzt" })
  const orgId = u.get("organization_id")
  const body = e.requestInfo().body || {}
  const frage = (body.frage || "").toString().trim().slice(0, 500)
  if (!frage) return e.json(400, { success: false, error: "Frage erforderlich" })

  const snap = loadSnapshot(orgId)
  if (!snap.count) return e.json(200, { success: true, antwort: "Im Lager sind noch keine Artikel angelegt." })

  const today = new Date().toISOString().slice(0, 10)
  const system =
    "Du bist der Lager-Assistent von Responda für einen Rettungs-/Sanitätsdienst. Heute ist " + today + ". " +
    "Antworte auf Deutsch, kurz und konkret, ausschließlich auf Basis der folgenden Lagerdaten — erfinde nichts. " +
    "Bei Bestellvorschlägen: liste betroffene Artikel mit empfohlener Bestellmenge (mindestens Soll minus Bestand), " +
    "berücksichtige auch erhöhten Verbrauch. Rechne Mengen/Verbrauch bei Bedarf zusammen. " +
    "Formatiere mit '### ' Überschriften, '- ' Aufzählungen und **fett** für Zahlen/Artikel. " +
    "Wenn die Daten die Frage nicht hergeben, sage das ehrlich.\n\n" +
    "LAGERDATEN (" + snap.count + " Artikel; Spalten: Name | Bestand | Soll | MHD | Chargen | Verbrauch letzte 90 Tage):\n" + snap.text

  try {
    const res = $http.send({
      url: "https://api.mistral.ai/v1/chat/completions",
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral-small-latest",
        temperature: 0.2,
        max_tokens: 1000,
        messages: [{ role: "system", content: system }, { role: "user", content: frage }],
      }),
      timeout: 60,
    })
    const data = res.json || {}
    const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : ""
    if (!content) return e.json(502, { success: false, error: "Leere KI-Antwort" })
    return e.json(200, { success: true, antwort: content })
  } catch (err) {
    return e.json(502, { success: false, error: "KI-Anfrage fehlgeschlagen: " + err.message })
  }
}, $apis.requireAuth())

routerAdd("POST", "/lager/parse-buchung", (e) => {
  const u = e.auth
  if (!u) return e.json(403, { success: false, error: "Nicht berechtigt" })
  const key = $os.getenv("MISTRAL_API_KEY")
  if (!key) return e.json(500, { success: false, error: "MISTRAL_API_KEY ist auf dem Server nicht gesetzt" })
  const orgId = u.get("organization_id")
  const body = e.requestInfo().body || {}
  const text = (body.text || "").toString().trim().slice(0, 600)
  if (!text) return e.json(400, { success: false, error: "Text erforderlich" })

  const items = $app.findRecordsByFilter("inventory_items", "organization_id = {:o}", "name", 3000, 0, { o: orgId })
  if (!items.length) return e.json(200, { success: true, buchungen: [] })
  const liste = items.map(it => it.id + " = " + it.get("name") + " (" + (it.get("unit") || "Stück") + ")").join("\n")

  const prompt =
    "Wandle die folgende Lager-Anweisung in strukturierte Buchungen um. " +
    "Ordne jede Position EINEM Artikel aus der Liste zu (per Bedeutung, nicht nur exakt). " +
    "type: 'ein' = Einbuchen/Wareneingang/geliefert, 'aus' = Ausbuchen/Entnahme/verbraucht. " +
    "menge = positive Zahl. mhd = Datum YYYY-MM-DD falls genannt (z.B. 'läuft 2027 ab' -> 2027-12-31), sonst null. " +
    "charge = Chargen-/LOT-Nummer falls genannt, sonst null. Findest du keinen passenden Artikel, setze item_id null.\n\n" +
    "ARTIKEL (id = name):\n" + liste + "\n\n" +
    "ANWEISUNG: " + text + "\n\n" +
    'Antworte NUR als JSON: {"buchungen": [{"item_id": "...", "type": "ein", "menge": 50, "mhd": null, "charge": null}]}'

  try {
    const res = $http.send({
      url: "https://api.mistral.ai/v1/chat/completions",
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral-small-latest",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
      timeout: 45,
    })
    const data = res.json || {}
    const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : ""
    let parsed
    try { parsed = JSON.parse(content) } catch (err) { return e.json(502, { success: false, error: "KI-Antwort unlesbar" }) }
    const byId = {}
    for (const it of items) byId[it.id] = { name: it.get("name"), unit: it.get("unit") || "Stück" }
    const out = []
    for (const b of (Array.isArray(parsed.buchungen) ? parsed.buchungen : []).slice(0, 30)) {
      const id = (b.item_id || "").toString()
      if (!byId[id]) continue
      const menge = Math.abs(parseFloat(b.menge) || 0)
      if (menge <= 0) continue
      out.push({
        item_id: id, name: byId[id].name, unit: byId[id].unit,
        type: b.type === "aus" ? "aus" : "ein",
        menge: menge,
        mhd: b.mhd && /^\d{4}-\d{2}-\d{2}$/.test(b.mhd) ? b.mhd : "",
        charge: b.charge ? b.charge.toString().slice(0, 40) : "",
      })
    }
    return e.json(200, { success: true, buchungen: out })
  } catch (err) {
    return e.json(502, { success: false, error: "KI-Anfrage fehlgeschlagen: " + err.message })
  }
}, $apis.requireAuth())
