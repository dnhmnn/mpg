// PocketBase hook: KI-Link-Vorschlag für Lager-Artikel  (PocketBase v0.23+ API)
//
// POST /lager/suggest-link  Body: { name, supplier?, supplier_item_no?, domain? }
//
// Suchquellen mit Fallback (Suchmaschinen blocken Rechenzentrums-IPs gern):
//   1. Shop-Suche des Lieferanten direkt (wenn Domain bekannt):
//      Shopify suggest.json -> /search?q= -> /?s=
//   2. DuckDuckGo HTML
//   3. DuckDuckGo Lite
// Auswahl des besten Treffers: Mistral (wenn MISTRAL_API_KEY gesetzt),
// sonst Heuristik. Es werden nur echte Suchtreffer akzeptiert.
//
// Setup (optional): systemctl edit pocketbase -> Environment=MISTRAL_API_KEY=...

routerAdd("POST", "/lager/suggest-link", (e) => {
  const u = e.auth
  if (!u) return e.json(403, { success: false, error: "Nicht berechtigt" })

  const key = $os.getenv("MISTRAL_API_KEY")
  const body = e.requestInfo().body || {}
  const name = (body.name || "").toString().trim()
  const supplier = (body.supplier || "").toString().trim()
  const itemNo = (body.supplier_item_no || "").toString().trim()
  let domain = (body.domain || "").toString().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  if (!name) return e.json(400, { success: false, error: "Artikelname erforderlich" })

  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
  const fetchText = (url) => {
    try {
      const res = $http.send({ url: url, method: "GET", headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" }, timeout: 15 })
      return res.body ? toString(res.body) : ""
    } catch (err) { return "" }
  }

  const candidates = []
  const seen = {}
  const push = (url, title) => {
    if (!url || !url.startsWith("http") || seen[url] || candidates.length >= 12) return
    seen[url] = true
    candidates.push({ url: url, title: (title || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 120) })
  }
  const sources = []

  const q = name + (itemNo ? " " + itemNo : "")

  // 0) Keine Domain bekannt? -> Mistral nach der Shop-Domain des Lieferanten fragen
  //    (mit Erreichbarkeits-Check, damit keine erfundene Domain durchrutscht)
  let effDomain = domain
  if (!effDomain && supplier && key) {
    try {
      const res = $http.send({
        url: "https://api.mistral.ai/v1/chat/completions",
        method: "POST",
        headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mistral-small-latest",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content:
            'Wie lautet die Domain des offiziellen deutschen Online-Shops des Anbieters/Händlers "' + supplier + '" ' +
            "(Kontext: Sanitäts-, Medizin- oder Rettungsdienstbedarf)? " +
            'Antworte NUR als JSON: {"domain": "shop.beispiel.de"} — oder {"domain": null}, wenn du es nicht sicher weißt. Keine erfundenen Domains.' }],
        }),
        timeout: 20,
      })
      const data = res.json || {}
      const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : ""
      const parsed = JSON.parse(content)
      let d = (parsed.domain || "").toString().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
      if (d) {
        // Erreichbarkeit prüfen (sonst verwerfen)
        if (fetchText("https://" + d)) effDomain = d
        else if (fetchText("https://www." + d)) effDomain = "www." + d
        if (effDomain) sources.push("domain-ki:" + effDomain)
      }
    } catch (err) { /* dann eben ohne Domain weiter */ }
  }
  domain = effDomain

  // 1) Shop-Suche direkt
  if (domain) {
    const base = "https://" + domain
    // Shopify: saubere JSON-Suche
    try {
      const res = $http.send({ url: base + "/search/suggest.json?q=" + encodeURIComponent(q) + "&resources[type]=product&resources[limit]=8", method: "GET", headers: { "User-Agent": UA }, timeout: 15 })
      const prods = res.json && res.json.resources && res.json.resources.results ? (res.json.resources.results.products || []) : []
      for (const p of prods) push(p.url && p.url.startsWith("http") ? p.url : base + p.url, p.title)
      if (prods.length) sources.push("shopify")
    } catch (err) { /* kein Shopify */ }
    // Generische Shop-Suchseiten
    if (!candidates.length) {
      for (const path of ["/search?q=", "/?s=", "/suche?q="]) {
        const html = fetchText(base + path + encodeURIComponent(q))
        if (!html) continue
        const re = /<a[^>]+href="([^"#?][^"]*)"[^>]*>([\s\S]{3,150}?)<\/a>/g
        let m
        let found = 0
        while ((m = re.exec(html)) && candidates.length < 12) {
          let href = m[1]
          if (href.startsWith("/")) href = base + href
          if (!href.startsWith("http") || href.indexOf(domain) === -1) continue
          // nur produktseiten-artige Pfade
          if (!/\/(product|products|produkt|produkte|artikel|item|p|shop|detail)[s]?\//i.test(href) && !/\d{4,}/.test(href)) continue
          push(href, m[2])
          found++
        }
        if (found) { sources.push("shopsearch"); break }
      }
    }
  }

  // 2) DuckDuckGo HTML
  if (!candidates.length) {
    let query = q
    if (domain) query = "site:" + domain + " " + query
    else if (supplier) query = supplier + " " + query + " kaufen"
    const html = fetchText("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query))
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    let m
    while ((m = re.exec(html)) && candidates.length < 10) {
      let href = m[1]
      const uddg = href.match(/uddg=([^&]+)/)
      if (uddg) { try { href = decodeURIComponent(uddg[1]) } catch (err) {} }
      push(href, m[2])
    }
    // Fallback-Parser: beliebige uddg-Redirect-Links (Markup-Varianten von DDG)
    if (!candidates.length && html) {
      const re2 = /href="[^"]*uddg=([^&"]+)[^"]*"[^>]*>([\s\S]{3,150}?)<\/a>/g
      while ((m = re2.exec(html)) && candidates.length < 10) {
        try { push(decodeURIComponent(m[1]), m[2]) } catch (err) {}
      }
    }
    if (candidates.length) sources.push("ddg")
  }

  // 3) DuckDuckGo Lite
  if (!candidates.length) {
    let query = q
    if (domain) query = "site:" + domain + " " + query
    else if (supplier) query = supplier + " " + query
    const html = fetchText("https://lite.duckduckgo.com/lite/?q=" + encodeURIComponent(query))
    const re = /<a[^>]+href="([^"]+)"[^>]*class="result-link"[^>]*>([\s\S]*?)<\/a>|<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    let m
    while ((m = re.exec(html)) && candidates.length < 10) {
      let href = m[1] || m[3] || ""
      const uddg = href.match(/uddg=([^&]+)/)
      if (uddg) { try { href = decodeURIComponent(uddg[1]) } catch (err) {} }
      push(href, m[2] || m[4])
    }
    if (candidates.length) sources.push("ddg-lite")
  }

  // 4) Bing HTML (direkte Ergebnis-Links, Bing-eigene Redirects überspringen)
  if (!candidates.length) {
    let query = q
    if (domain) query = "site:" + domain + " " + query
    else if (supplier) query = supplier + " " + query + " kaufen"
    const html = fetchText("https://www.bing.com/search?q=" + encodeURIComponent(query) + "&setlang=de")
    const re = /<h2[^>]*>\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    let m
    while ((m = re.exec(html)) && candidates.length < 10) {
      if (m[1].indexOf("bing.com") !== -1 || m[1].indexOf("microsoft.com") !== -1) continue
      push(m[1], m[2])
    }
    if (candidates.length) sources.push("bing")
  }

  if (!candidates.length) {
    return e.json(200, {
      success: true, url: null, candidates: 0, sources: sources,
      begruendung: domain
        ? "Weder Shop-Suche noch Websuche lieferten Treffer — Shop-Domain korrekt?"
        : "Websuche vom Server blockiert oder keine Treffer. Tipp: Shop-Startseite ins Bestell-Link-Feld einfügen und erneut suchen.",
    })
  }

  // Heuristik-Score (auch als Fallback bei KI-Ausfall)
  const tokens = name.toLowerCase().split(/\s+/).filter(t => t.length > 3)
  const scoreOf = (c) => {
    const hay = (c.url + " " + c.title).toLowerCase()
    let s = 0
    if (itemNo && hay.indexOf(itemNo.toLowerCase()) !== -1) s += 4
    for (const t of tokens) if (hay.indexOf(t) !== -1) s += 1
    if (domain && c.url.toLowerCase().indexOf(domain.toLowerCase()) !== -1) s += 2
    if (/\.pdf($|\?)/i.test(c.url)) s -= 5
    return s
  }

  // Mit Key: Mistral wählt; ohne: Heuristik
  if (key) {
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
      const parsed = JSON.parse(content)
      const url = parsed.url && candidates.some(c => c.url === parsed.url) ? parsed.url : null
      if (url) return e.json(200, { success: true, url: url, begruendung: parsed.begruendung || "", candidates: candidates.length, sources: sources })
      // KI fand nichts Passendes -> Heuristik versuchen
    } catch (err) { /* KI-Ausfall -> Heuristik */ }
  }

  let best = null
  let bestScore = 0
  for (const c of candidates) {
    const s = scoreOf(c)
    if (s > bestScore) { bestScore = s; best = c }
  }
  if (best && bestScore >= 1) {
    return e.json(200, { success: true, url: best.url, begruendung: "Bester Suchtreffer" + (key ? "" : " (heuristisch, ohne KI)"), candidates: candidates.length, sources: sources })
  }
  return e.json(200, { success: true, url: null, candidates: candidates.length, sources: sources, begruendung: "Treffer gefunden, aber keiner passt eindeutig — Artikelname präzisieren." })
}, $apis.requireAuth())
