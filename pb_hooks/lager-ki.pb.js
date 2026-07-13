// PocketBase hook: KI-Link-Vorschlag für Lager-Artikel  (PocketBase v0.23+ API)
//
// POST /lager/suggest-link  Body: { name, supplier?, supplier_item_no?, domain? }
//
// Ablauf (der API-Key bleibt auf dem Server, die KI sieht nur Artikelnamen):
//   1. Websuche (DuckDuckGo HTML) nach dem Artikel — mit site:-Filter,
//      falls die Shop-Domain des Lieferanten bekannt ist
//   2. Mistral (mistral-small-latest, EU-gehostet) wählt aus den Treffern
//      den passenden Produktlink aus
//
// Setup: Umgebungsvariable MISTRAL_API_KEY am PocketBase-Dienst setzen
//   (systemctl edit pocketbase ->  [Service]  Environment=MISTRAL_API_KEY=...)

routerAdd("POST", "/lager/suggest-link", (e) => {
  const u = e.auth
  if (!u) return e.json(403, { success: false, error: "Nicht berechtigt" })

  const key = $os.getenv("MISTRAL_API_KEY")
  if (!key) return e.json(500, { success: false, error: "MISTRAL_API_KEY ist auf dem Server nicht gesetzt" })

  const body = e.requestInfo().body || {}
  const name = (body.name || "").toString().trim()
  const supplier = (body.supplier || "").toString().trim()
  const itemNo = (body.supplier_item_no || "").toString().trim()
  const domain = (body.domain || "").toString().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  if (!name) return e.json(400, { success: false, error: "Artikelname erforderlich" })

  // 1) Websuche
  let query = name
  if (itemNo) query += " " + itemNo
  if (domain) query = "site:" + domain + " " + query
  else if (supplier) query = supplier + " " + query + " kaufen"

  let candidates = []
  try {
    const res = $http.send({
      url: "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query),
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Responda-Lager" },
      timeout: 20,
    })
    const html = res.body ? toString(res.body) : ""
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    let m
    while ((m = re.exec(html)) && candidates.length < 8) {
      let href = m[1]
      const uddg = href.match(/uddg=([^&]+)/)
      if (uddg) { try { href = decodeURIComponent(uddg[1]) } catch (err) {} }
      const title = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      if (href.startsWith("http")) candidates.push({ url: href, title: title })
    }
  } catch (err) {
    return e.json(502, { success: false, error: "Websuche fehlgeschlagen: " + err.message })
  }

  if (!candidates.length) {
    return e.json(200, { success: true, url: null, begruendung: "Keine Suchtreffer gefunden.", candidates: 0 })
  }

  // 2) Mistral wählt den passenden Treffer
  const prompt =
    "Du hilfst einer Lagerverwaltung, den Bestell-Link für einen Artikel zu finden.\n" +
    "Artikel: " + name + (itemNo ? " (Artikelnr. " + itemNo + ")" : "") + "\n" +
    (supplier ? "Lieferant: " + supplier + "\n" : "") +
    "Kandidaten (Suchtreffer):\n" +
    candidates.map((c, i) => (i + 1) + ". " + c.title + " | " + c.url).join("\n") + "\n\n" +
    "Wähle den Link, der am wahrscheinlichsten die PRODUKTSEITE genau dieses Artikels ist " +
    "(keine Kategorieseiten, keine Ratgeber, keine PDFs). " +
    'Antworte NUR als JSON: {"url": "<gewählter Link oder null>", "begruendung": "<max. 15 Wörter Deutsch>"}'

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
      timeout: 30,
    })
    const data = res.json || {}
    const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : ""
    let parsed = {}
    try { parsed = JSON.parse(content) } catch (err) {
      return e.json(502, { success: false, error: "KI-Antwort unlesbar" })
    }
    // Sicherheitsnetz: nur URLs zulassen, die wirklich unter den Kandidaten waren
    const url = parsed.url && candidates.some(c => c.url === parsed.url) ? parsed.url : null
    return e.json(200, { success: true, url: url, begruendung: parsed.begruendung || "", candidates: candidates.length })
  } catch (err) {
    return e.json(502, { success: false, error: "Mistral-Anfrage fehlgeschlagen: " + err.message })
  }
}, $apis.requireAuth())
