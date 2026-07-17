// PocketBase hook: KI-Assistenz (Mistral, EU)  (PocketBase v0.23+ API)
//
// 1. POST /ki/chat — Lern-Assistent für Einsatzkräfte (Lernbar/Unitas).
//    RAG-lite: sucht zur Frage passende Fachartikel auf nerdfallmedizin.blog
//    und notfallguru.de, gibt deren Text der KI als primäre Grundlage mit
//    und liefert die verwendeten Quellen (Titel + URL) an den Client zurück.
//    Body: { messages: [{ role, content }] }  ->  { antwort, quellen: [{titel,url}] }
//
// 2. POST /ki/generate-buch — entwirft ein Lernfeed-Buch (Seiten mit Text-
//    und Quiz-Blöcken) zu einem Thema. Body: { thema, hinweise?, seiten? }
//
// Beide benötigen MISTRAL_API_KEY (systemctl edit pocketbase ->
// Environment=MISTRAL_API_KEY=...). Es werden keine Personen-/Patientendaten
// an die KI übertragen — nur die Frage bzw. das Thema.

routerAdd("POST", "/ki/chat", (e) => {
  const u = e.auth
  if (!u) return e.json(403, { success: false, error: "Nicht berechtigt" })
  const key = $os.getenv("MISTRAL_API_KEY")
  if (!key) return e.json(500, { success: false, error: "MISTRAL_API_KEY ist auf dem Server nicht gesetzt" })

  const body = e.requestInfo().body || {}
  const raw = Array.isArray(body.messages) ? body.messages : []
  const messages = []
  for (const m of raw.slice(-12)) {
    const role = m && m.role === "assistant" ? "assistant" : "user"
    const content = (m && m.content ? m.content : "").toString().slice(0, 4000)
    if (content.trim()) messages.push({ role: role, content: content })
  }
  if (!messages.length) return e.json(400, { success: false, error: "Keine Frage übermittelt" })

  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
  const fetchText = (url, timeout) => {
    try {
      const res = $http.send({ url: url, method: "GET", headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" }, timeout: timeout || 12 })
      return res.body ? toString(res.body) : ""
    } catch (err) { return "" }
  }
  const stripHtml = (html) => {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#\d+;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  // Fachquellen zur letzten Nutzerfrage suchen
  const frage = messages[messages.length - 1].content.slice(0, 200)
  const DOMAINS = ["nerdfallmedizin.blog", "notfallguru.de", "register.awmf.org"]
  const quellen = []

  for (const domain of DOMAINS) {
    if (quellen.length >= 3) break
    let hits = []
    // 1) WordPress-REST-Suche (liefert saubere Titel+URLs)
    try {
      const res = $http.send({
        url: "https://" + domain + "/wp-json/wp/v2/search?search=" + encodeURIComponent(frage) + "&per_page=3",
        method: "GET", headers: { "User-Agent": UA }, timeout: 10,
      })
      if (Array.isArray(res.json)) {
        hits = res.json.map(x => ({ titel: stripHtml((x.title || "").toString()), url: (x.url || "").toString(), id: x.id, domain: domain })).filter(h => h.url)
      }
    } catch (err) { /* keine WP-REST-API */ }
    // 2) Fallback: HTML-Suchseite
    if (!hits.length) {
      const html = fetchText("https://" + domain + "/?s=" + encodeURIComponent(frage))
      const re2 = new RegExp('<a[^>]+href="(https?://[^"]*' + domain.replace(/\./g, "\\.") + '[^"]*)"[^>]*>([\\s\\S]{4,120}?)</a>', "g")
      let m
      const seen = {}
      while ((m = re2.exec(html)) && hits.length < 3) {
        const url = m[1]
        if (seen[url] || /\/(tag|category|author|page)\//.test(url) || url.indexOf("?s=") !== -1 || url.replace("https://", "").replace(domain, "").length < 4) continue
        seen[url] = true
        const titel = stripHtml(m[2])
        if (titel.length > 3) hits.push({ titel: titel, url: url })
      }
    }
    for (const h of hits.slice(0, 2)) {
      if (quellen.length < 3 && !quellen.some(q => q.url === h.url)) quellen.push(h)
    }
  }

  // Abbildungen (echte EKGs/Schaubilder) aus dem Artikel-HTML ziehen
  const extractImages = (html, baseUrl) => {
    let origin = ""
    try { const mm = baseUrl.match(/^(https?:\/\/[^/]+)/); origin = mm ? mm[1] : "" } catch (er) {}
    const imgs = []
    const seen = {}
    const re = /<img\b[^>]*>/gi
    let tag
    while ((tag = re.exec(html)) && imgs.length < 6) {
      const t = tag[0]
      let src = ""
      // größte Auflösung aus srcset bevorzugen (letzter Eintrag), dann lazy-Attribute, dann src
      const ss = t.match(/srcset="([^"]+)"/i)
      if (ss) {
        const parts = ss[1].split(",").map(x => x.trim().split(/\s+/)[0]).filter(Boolean)
        if (parts.length) src = parts[parts.length - 1]
      }
      if (!src) { const m2 = t.match(/\sdata-(?:src|lazy-src|orig-file|large-file|original|srcset)="([^",\s]+)"/i); if (m2) src = m2[1] }
      if (!src) { const m1 = t.match(/\ssrc="([^"]+)"/i); if (m1) src = m1[1] }
      if (!src) continue
      if (src.startsWith("//")) src = "https:" + src
      else if (src.startsWith("/")) src = origin + src
      if (!/^https?:\/\//.test(src) || /^data:/i.test(src)) continue
      // Bild, wenn Bilddateiendung ODER klar aus dem Medienordner (WordPress-CDN oft ohne Endung)
      const isImg = /\.(jpe?g|png|webp)(\?|$|&)/i.test(src) || /\/wp-content\/uploads\//i.test(src) || /\/(media|images?|bilder|uploads)\//i.test(src)
      if (!isImg) continue
      if (/logo|icon|avatar|sprite|placeholder|emoji|badge|favicon|spinner|loading|gravatar|1x1|pixel|blank\.|spacer/i.test(src)) continue
      if (seen[src]) continue
      seen[src] = true
      imgs.push(src)
    }
    return imgs
  }

  const addBild = (src, q) => {
    if (src && bilder.length < 4 && !bilder.some(b => b.url === src)) bilder.push({ url: src, quelle: q.titel, quelleUrl: q.url })
  }

  // Artikeltexte + Abbildungen der Top-Quellen laden
  let kontext = ""
  const genutzt = []
  const bilder = []
  const dbg = { key: !!key, suchtreffer: quellen.length, quellen: [] }
  for (const q of quellen.slice(0, 2)) {
    const raw = fetchText(q.url)
    const text = stripHtml(raw).slice(0, 2600)
    const info = { url: q.url, hatId: !!q.id, textLen: text.length, mediaImgs: 0, htmlImgs: 0 }
    if (text.length > 300) {
      genutzt.push(q)
      kontext += "\n\n### Quelle: " + q.titel + " (" + q.url + ")\n" + text
    }
    // Bevorzugt: WordPress-Media-Endpunkt (saubere Bild-URLs, keine Lazy-Load-Probleme)
    if (q.id && q.domain) {
      try {
        const mres = $http.send({
          url: "https://" + q.domain + "/wp-json/wp/v2/media?parent=" + q.id + "&media_type=image&per_page=4",
          method: "GET", headers: { "User-Agent": UA }, timeout: 10,
        })
        if (Array.isArray(mres.json)) {
          for (const md of mres.json) {
            const su = md && md.source_url ? md.source_url.toString() : ""
            if (su && !/logo|icon|avatar|placeholder|favicon/i.test(su)) { addBild(su, q); info.mediaImgs++ }
          }
        }
      } catch (er) { /* Media-API nicht verfügbar */ }
    }
    // Ergänzend: Bilder aus dem Artikel-HTML
    if (text.length > 300) {
      const imgs = extractImages(raw, q.url)
      info.htmlImgs = imgs.length
      for (const src of imgs) addBild(src, q)
    }
    dbg.quellen.push(info)
  }
  dbg.bilder = bilder.length

  const system =
    "Du bist der Lern-Assistent von Responda für Einsatzkräfte (Rettungsdienst, Feuerwehr, Sanitätsdienst). " +
    "Beantworte Fragen zu medizinischen, notfallmedizinischen und einsatztaktischen Themen auf Deutsch — " +
    "klar strukturiert, fachlich korrekt, zu Lern- und Ausbildungszwecken. " +
    (kontext
      ? "Dir liegen Auszüge aus Fachartikeln von Nerdfallmedizin und Notfallguru vor. Stütze deine Antwort PRIMÄR auf diese Auszüge; ergänze nur wo nötig mit Leitlinienwissen (z.B. ERC). "
      : "Orientiere dich an aktuellen Leitlinien (z.B. ERC) und nenne wo passend Merkhilfen/Schemata (ABCDE, SAMPLER ...). ") +
    "WICHTIG: Deine Antworten dienen der Ausbildung und ersetzen weder (not-)ärztliche Entscheidungen noch " +
    "lokale SAA/Algorithmen oder Anweisungen des Ärztlichen Leiters. Weise bei heiklen Themen kurz darauf hin. " +
    "Fragen ohne Bezug zu Medizin, Rettungswesen oder Ausbildung lehnst du freundlich in einem Satz ab. " +
    "Baue JEDE Antwort so auf: zuerst eine Überschrift '### Kurzfassung' mit 1-2 Sätzen Kernaussage, " +
    "danach eine Überschrift '### Ausführlich' mit der detaillierten Erklärung (Absätze, Aufzählungen mit '- ', weitere '### '-Unterüberschriften erlaubt). " +
    "Halte den ausführlichen Teil kompakt (insgesamt max. ~350 Wörter), Wichtiges **fett**. Keine URLs im Text nennen — die Quellen werden separat angezeigt. " +
    "WICHTIG: Passende Abbildungen aus den Quellen (z.B. Beispiel-EKGs, Schaubilder) werden dem Nutzer AUTOMATISCH unterhalb deiner Antwort angezeigt. " +
    "Behaupte deshalb NIEMALS, dass du keine Bilder senden/zeigen kannst. Verweise stattdessen natürlich auf die Abbildungen unten (z.B. 'Im EKG unten siehst du ...') und beschreibe, worauf man achten soll." +
    (kontext ? "\n\nFACHARTIKEL-AUSZÜGE:" + kontext : "")

  try {
    const res = $http.send({
      url: "https://api.mistral.ai/v1/chat/completions",
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral-small-latest",
        temperature: 0.3,
        max_tokens: 900,
        messages: [{ role: "system", content: system }].concat(messages),
      }),
      timeout: 60,
    })
    const data = res.json || {}
    const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : ""
    if (!content) return e.json(502, { success: false, error: "Leere KI-Antwort" + (data.message ? ": " + data.message : "") })
    return e.json(200, { success: true, antwort: content, quellen: genutzt, bilder: bilder, debug: dbg })
  } catch (err) {
    return e.json(502, { success: false, error: "KI-Anfrage fehlgeschlagen: " + err.message })
  }
}, $apis.requireAuth())

routerAdd("POST", "/ki/generate-buch", (e) => {
  const u = e.auth
  if (!u) return e.json(403, { success: false, error: "Nicht berechtigt" })
  const key = $os.getenv("MISTRAL_API_KEY")
  if (!key) return e.json(500, { success: false, error: "MISTRAL_API_KEY ist auf dem Server nicht gesetzt" })

  const body = e.requestInfo().body || {}
  const thema = (body.thema || "").toString().trim().slice(0, 300)
  const hinweise = (body.hinweise || "").toString().trim().slice(0, 1000)
  let seiten = parseInt(body.seiten, 10)
  if (!seiten || seiten < 2) seiten = 4
  if (seiten > 8) seiten = 8
  if (!thema) return e.json(400, { success: false, error: "Thema erforderlich" })

  const prompt =
    "Erstelle ein Lern-Buch für die Ausbildung von Einsatzkräften (Rettungsdienst/Feuerwehr/Sanitätsdienst) " +
    "zum Thema: \"" + thema + "\"." + (hinweise ? " Zusätzliche Hinweise: " + hinweise : "") + "\n\n" +
    "Anforderungen:\n" +
    "- Genau " + seiten + " Seiten, didaktisch aufgebaut (Grundlagen -> Vertiefung -> Praxis).\n" +
    "- Jede Seite: EIN Text-Block mit 120-220 Wörtern (Deutsch, klar, mit Absätzen via \\n\\n, wo sinnvoll Aufzählungen mit '- ').\n" +
    "- Auf 2-3 Seiten zusätzlich einen Quiz-Block ans Seitenende (Frage, genau 4 Antwortoptionen, Index der richtigen Antwort 0-3). Die letzte Seite MUSS einen Quiz-Block haben.\n" +
    "- Fachlich korrekt nach aktuellen Leitlinien (z.B. ERC), Merkschemata nutzen (ABCDE, SAMPLER ...).\n" +
    "- 3-5 kurze Tags.\n\n" +
    "Antworte NUR als JSON in exakt dieser Struktur:\n" +
    '{"titel": "...", "tags": ["...", "..."], "seiten": [{"blocks": [{"type": "text", "text": "..."}, {"type": "quiz", "frage": "...", "antworten": ["a","b","c","d"], "richtige": 0}]}]}'

  try {
    const res = $http.send({
      url: "https://api.mistral.ai/v1/chat/completions",
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral-medium-latest",
        temperature: 0.4,
        max_tokens: 6000,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
      timeout: 120,
    })
    const data = res.json || {}
    const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : ""
    let buch
    try { buch = JSON.parse(content) } catch (err) {
      return e.json(502, { success: false, error: "KI-Antwort war kein gültiges JSON" })
    }
    if (!buch || !Array.isArray(buch.seiten) || !buch.seiten.length) {
      return e.json(502, { success: false, error: "KI lieferte keine Seiten" })
    }
    // Struktur absichern
    const seitenClean = []
    for (const s of buch.seiten.slice(0, 10)) {
      const blocks = []
      for (const b of (Array.isArray(s.blocks) ? s.blocks : []).slice(0, 4)) {
        if (b && b.type === "text" && (b.text || "").toString().trim()) {
          blocks.push({ type: "text", text: b.text.toString().slice(0, 4000) })
        } else if (b && b.type === "quiz" && (b.frage || "").toString().trim() && Array.isArray(b.antworten)) {
          const antworten = b.antworten.map(a => (a || "").toString().slice(0, 200)).slice(0, 4)
          while (antworten.length < 4) antworten.push("")
          let richtige = parseInt(b.richtige, 10)
          if (isNaN(richtige) || richtige < 0 || richtige > 3) richtige = 0
          blocks.push({ type: "quiz", frage: b.frage.toString().slice(0, 500), antworten: antworten, richtige: richtige })
        }
      }
      if (blocks.length) seitenClean.push({ blocks: blocks })
    }
    if (!seitenClean.length) return e.json(502, { success: false, error: "KI lieferte keine verwertbaren Blöcke" })

    return e.json(200, {
      success: true,
      buch: {
        titel: (buch.titel || thema).toString().slice(0, 200),
        tags: Array.isArray(buch.tags) ? buch.tags.map(t => (t || "").toString().slice(0, 40)).filter(Boolean).slice(0, 6) : [],
        seiten: seitenClean,
      },
    })
  } catch (err) {
    return e.json(502, { success: false, error: "KI-Anfrage fehlgeschlagen: " + err.message })
  }
}, $apis.requireAuth())
