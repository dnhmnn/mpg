// PocketBase hook: Shop-Produktsuche für den Lager-Bestell-Link  (v0.23+)
//
// POST /lager/shop-products  Body: { supplier?, name, domain? }
//   -> { success, shop, products: [{ name, url, price? }] }
//
// Ruft die Trefferliste im (Shopware-)Shop des Lieferanten serverseitig ab
// und liest die Produkte aus. Der Nutzer wählt in Responda das richtige
// Produkt; dessen Link wird als Bestell-Link am Artikel gespeichert.
// Kein API-Key nötig — reines Abrufen + Parsen der öffentlichen Suchseite.
//
// Bekannte Shops sind fest hinterlegt (Suche-URL + Shopsystem). Für andere
// Shopware-Shops mit erreichbarer Suche funktioniert der generische Parser
// meist ebenfalls.

routerAdd("POST", "/lager/shop-products", (e) => {
  const u = e.auth
  if (!u) return e.json(403, { success: false, error: "Nicht berechtigt" })

  const body = e.requestInfo().body || {}
  const term = (body.name || "").toString().trim()
  const supplier = (body.supplier || "").toString().trim().toLowerCase()
  let domain = (body.domain || "").toString().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  if (!term) return e.json(400, { success: false, error: "Suchbegriff (Artikelname) erforderlich" })

  // Bekannte Lieferanten-Shops
  const SHOPS = [
    { match: ["wero"], domain: "www.wero.de", searchTpl: "https://www.wero.de/search?search={q}" },
    { match: ["söhngen", "soehngen", "sohngen"], domain: "www.soehngen.com", searchTpl: "https://www.soehngen.com/search?search={q}" },
  ]
  const shop = SHOPS.find(s => s.match.some(m => supplier.indexOf(m) !== -1))
    || (domain ? { domain: domain, searchTpl: "https://" + domain + "/search?search={q}" } : null)
  if (!shop) {
    return e.json(200, { success: true, products: [], shop: null, error: "Kein Shop bekannt — Lieferant angeben oder Shop-Domain ins Bestell-Link-Feld." })
  }

  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
  const fetchText = (url) => {
    try {
      const res = $http.send({ url: url, method: "GET", headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9", "Accept": "text/html" }, timeout: 20 })
      return res.body ? toString(res.body) : ""
    } catch (err) { return "" }
  }
  const decode = (s) => (s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'").replace(/&nbsp;/g, " ").replace(/&auml;/g, "ä").replace(/&ouml;/g, "ö").replace(/&uuml;/g, "ü").replace(/&Auml;/g, "Ä").replace(/&Ouml;/g, "Ö").replace(/&Uuml;/g, "Ü").replace(/&szlig;/g, "ß")
    .replace(/\s+/g, " ").trim()

  // Shopware 6: Produkt-Anker haben class "product-name" (Titel im title-Attribut/Text)
  const parseProducts = (html) => {
    const list = []
    const seen = {}
    // Preise grob in Reihenfolge einsammeln (best effort, optional)
    const prices = []
    const pr = /class="[^"]*product-price[^"]*"[^>]*>([\s\S]{0,60}?)([0-9][0-9.\s]*,[0-9]{2}\s*(?:€|EUR))/gi
    let pm
    while ((pm = pr.exec(html)) && prices.length < 60) prices.push(decode(pm[2]))
    let idx = 0

    const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
    let m
    while ((m = re.exec(html)) && list.length < 24) {
      const attrs = m[1]
      if (!/class="[^"]*product-name[^"]*"/i.test(attrs)) continue
      const hrefM = attrs.match(/href="([^"]+)"/i)
      if (!hrefM) continue
      let url = decode(hrefM[1])
      if (url.startsWith("/")) url = "https://" + shop.domain + url
      if (!/^https?:\/\//.test(url) || seen[url]) continue
      const titleM = attrs.match(/title="([^"]+)"/i)
      let name = decode(titleM ? titleM[1] : m[2].replace(/<[^>]+>/g, " "))
      if (!name) continue
      seen[url] = true
      const entry = { name: name.slice(0, 160), url: url }
      if (prices[idx]) entry.price = prices[idx]
      idx++
      list.push(entry)
    }
    return list
  }

  const searchUrl = shop.searchTpl.replace("{q}", encodeURIComponent(term))
  let html = fetchText(searchUrl)
  let products = parseProducts(html)

  // Fallback: Shopware-Suggest-Endpunkt
  if (!products.length) {
    html = fetchText("https://" + shop.domain + "/suggest?search=" + encodeURIComponent(term))
    products = parseProducts(html)
  }

  if (!products.length) {
    return e.json(200, {
      success: true, products: [], shop: shop.domain, searchUrl: searchUrl,
      error: html ? "Keine Produkte erkannt — evtl. anderer Suchbegriff nötig." : "Shop war nicht erreichbar.",
    })
  }

  return e.json(200, { success: true, shop: shop.domain, searchUrl: searchUrl, products: products })
}, $apis.requireAuth())
