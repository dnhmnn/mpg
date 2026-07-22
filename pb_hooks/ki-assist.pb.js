// PocketBase hook: KI-Assistenz (Mistral, EU)  (PocketBase v0.23+ API)
//
// 1. POST /ki/chat — Lern-Assistent für Einsatzkräfte (Lernbar/Unitas).
//    Beantwortet Fragen PRIMÄR aus der EIGENEN, vom Supervisor gepflegten
//    Wissensbasis (Collection "wissen") + passenden Abbildungen daraus.
//    Body: { messages: [{ role, content }] }  ->  { antwort, quellen, bilder }
//
// 2. POST /ki/generate-buch — entwirft ein Lernfeed-Buch (Seiten mit Text-
//    und Quiz-Blöcken) zu einem Thema.
//
// Benötigt MISTRAL_API_KEY. Keine Personen-/Patientendaten an die KI.
//
// Collection "wissen": titel (text), inhalt (text), tags (text/json),
//   bild (file, optional), quelle (text), organization_id (text).

const FILE_BASE = "https://api.responda.systems"

routerAdd("POST", "/ki/chat", (e) => {
  const u = e.auth
  if (!u) return e.json(403, { success: false, error: "Nicht berechtigt" })
  const key = $os.getenv("MISTRAL_API_KEY")
  if (!key) return e.json(500, { success: false, error: "MISTRAL_API_KEY ist auf dem Server nicht gesetzt" })
  const orgId = u.get("organization_id")

  const body = e.requestInfo().body || {}
  const raw = Array.isArray(body.messages) ? body.messages : []
  const messages = []
  for (const m of raw.slice(-12)) {
    const role = m && m.role === "assistant" ? "assistant" : "user"
    const content = (m && m.content ? m.content : "").toString().slice(0, 4000)
    if (content.trim()) messages.push({ role: role, content: content })
  }
  if (!messages.length) return e.json(400, { success: false, error: "Keine Frage übermittelt" })

  const frage = messages[messages.length - 1].content

  // ── Wissensbasis der Organisation laden und zur Frage passende Artikel finden ──
  let artikel = []
  try { artikel = $app.findRecordsByFilter("wissen", "organization_id = {:o}", "-created", 1000, 0, { o: orgId }) } catch (err) {}

  const tokens = frage.toLowerCase().replace(/[^a-zäöüß0-9\s]/gi, " ").split(/\s+/).filter(t => t.length > 3)
  const parseTags = (v) => {
    try { if (typeof v === "string") { const p = JSON.parse(v); return Array.isArray(p) ? p : String(v).split(",") } return Array.isArray(v) ? v : [] } catch (err) { return String(v || "").split(",") }
  }
  const scored = []
  for (const a of artikel) {
    const titel = (a.get("titel") || "").toString().toLowerCase()
    const inhalt = (a.get("inhalt") || "").toString().toLowerCase()
    const tags = parseTags(a.get("tags")).map(t => String(t).toLowerCase()).join(" ")
    let score = 0
    for (const t of tokens) {
      if (titel.indexOf(t) !== -1) score += 4
      if (tags.indexOf(t) !== -1) score += 4
      if (inhalt.indexOf(t) !== -1) score += 1
    }
    if (score > 0) scored.push({ a: a, score: score })
  }
  scored.sort((x, y) => y.score - x.score)
  const treffer = scored.slice(0, 3).map(s => s.a)

  // Kontext + Abbildungen aus den Treffern
  let kontext = ""
  const quellen = []
  const bilder = []
  for (const a of treffer) {
    const titel = (a.get("titel") || "Artikel").toString()
    const inhalt = (a.get("inhalt") || "").toString().slice(0, 2800)
    kontext += "\n\n### " + titel + "\n" + inhalt
    const q = (a.get("quelle") || "").toString()
    quellen.push({ titel: titel + (q ? " — " + q : ""), url: "" })
    const bild = (a.get("bild") || "").toString()
    if (bild) {
      let path = ""
      try { path = a.baseFilesPath() } catch (err) { path = "" }
      if (path) bilder.push({ url: FILE_BASE + "/api/files/" + path + "/" + bild, quelle: titel, quelleUrl: "" })
    }
  }

  // ── Passende AWMF-Leitlinien (kuratierte Metadaten, verlinkt aufs offizielle Register) ──
  let awmfTreffer = []
  try {
    const awmf = require(`${__hooks}/awmf-leitlinien.js`).LEITLINIEN
    const awmfScored = []
    for (const l of awmf) {
      const lt = l.titel.toLowerCase()
      let score = 0
      let tagHit = false
      for (const t of tokens) {
        if (l.tags.indexOf(t) !== -1) { score += 4; tagHit = true }
        if (lt.indexOf(t) !== -1) score += 3
      }
      // Mindestens ein kuratiertes Schlagwort muss passen — Titelwörter allein
      // (z.B. "beim Erwachsenen") erzeugen sonst falsche Treffer
      if (tagHit) awmfScored.push({ l: l, score: score })
    }
    awmfScored.sort((x, y) => y.score - x.score)
    awmfTreffer = awmfScored.slice(0, 3).map(s => s.l)
    for (const l of awmfTreffer) {
      quellen.push({ titel: "AWMF-Leitlinie: " + l.titel + " (" + l.nr + ")", url: "https://register.awmf.org/de/leitlinien/detail/" + l.nr })
    }
  } catch (err) {}

  const dbg = { key: !!key, artikelGesamt: artikel.length, treffer: treffer.length, bilder: bilder.length, awmf: awmfTreffer.length }

  // Weiterführende Quellen — nur Verweise (Suchlinks), keine Inhalte kopiert
  const enc = encodeURIComponent
  const weiterlesen = [
    { name: "Nerdfallmedizin", url: "https://www.google.com/search?q=" + enc("site:nerdfallmedizin.blog " + frage.slice(0, 120)) },
    { name: "Notfallguru", url: "https://www.google.com/search?q=" + enc("site:notfallguru.de " + frage.slice(0, 120)) },
    { name: "AWMF-Leitlinien", url: "https://www.google.com/search?q=" + enc("site:register.awmf.org " + frage.slice(0, 120)) },
  ]

  const system =
    "Du bist der Lern-Assistent von Responda für Einsatzkräfte (Rettungsdienst, Feuerwehr, Sanitätsdienst). " +
    "Beantworte Fragen zu medizinischen, notfallmedizinischen und einsatztaktischen Themen auf Deutsch — " +
    "klar strukturiert, fachlich korrekt, zu Lern- und Ausbildungszwecken. " +
    (kontext
      ? "Dir liegen Auszüge aus der EIGENEN, geprüften Wissensbasis der Organisation vor. Stütze deine Antwort PRIMÄR auf diese Auszüge; ergänze nur wo nötig mit fundiertem Leitlinienwissen (z.B. ERC). "
      : "In der Wissensbasis der Organisation gibt es zu dieser Frage (noch) keinen Eintrag. Beantworte die Frage aus fundiertem Leitlinienwissen (z.B. ERC) mit Merkschemata (ABCDE, SAMPLER ...) und weise am ENDE dezent in einem Satz darauf hin, dass dazu noch kein interner Wissenseintrag existiert. ") +
    "WICHTIG: Deine Antworten dienen der Ausbildung und ersetzen weder (not-)ärztliche Entscheidungen noch " +
    "lokale SAA/Algorithmen oder Anweisungen des Ärztlichen Leiters. Weise bei heiklen Themen kurz darauf hin. " +
    "Fragen ohne Bezug zu Medizin, Rettungswesen oder Ausbildung lehnst du freundlich in einem Satz ab. " +
    "Baue JEDE Antwort so auf: zuerst eine Überschrift '### Kurzfassung' mit 1-2 Sätzen Kernaussage, " +
    "danach eine Überschrift '### Ausführlich' mit der detaillierten Erklärung (Absätze, Aufzählungen mit '- ', weitere '### '-Unterüberschriften erlaubt). " +
    "Halte den ausführlichen Teil kompakt (insgesamt max. ~350 Wörter), Wichtiges **fett**. " +
    "Passende Abbildungen aus der Wissensbasis werden dem Nutzer AUTOMATISCH unterhalb deiner Antwort angezeigt. " +
    "Behaupte deshalb NIEMALS, dass du keine Bilder senden/zeigen kannst; verweise natürlich auf die Abbildungen unten, falls vorhanden." +
    (awmfTreffer.length
      ? "\n\nZur Frage passen diese AWMF-Leitlinien (werden dem Nutzer unten automatisch verlinkt): " +
        awmfTreffer.map(l => l.titel + " (AWMF-Reg.-Nr. " + l.nr + ")").join("; ") + ". " +
        "Beziehe dich, wo einschlägig, ausdrücklich auf sie (Name + Registernummer) und richte deine Aussagen an ihnen aus. Zitiere keine wörtlichen Passagen."
      : "") +
    (kontext ? "\n\nWISSENSBASIS-AUSZÜGE:" + kontext : "")

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
    return e.json(200, { success: true, antwort: content, quellen: quellen, bilder: bilder, weiterlesen: weiterlesen, debug: dbg })
  } catch (err) {
    return e.json(502, { success: false, error: "KI-Anfrage fehlgeschlagen: " + err.message })
  }
}, $apis.requireAuth())

// POST /ki/wissen-import — strukturiert einen hochgeladenen Textauszug (aus PDF/
// Textdatei/ZIP, clientseitig extrahiert) automatisch zu fertigen Wissens-
// einträgen. Nur Supervisor. Body: { dateiname, text } -> { eintraege: [{titel,inhalt,tags}] }
// HINWEIS DSGVO: Der Freitext wird zur Strukturierung an Mistral (EU) gesendet.
// Der Supervisor bestätigt clientseitig, dass das Material keine Patienten-/
// Personendaten enthält (siehe Wissen.tsx). Nur zur Ausbildung gedachtes Fachmaterial.
routerAdd("POST", "/ki/wissen-import", (e) => {
  const u = e.auth
  if (!u) return e.json(403, { success: false, error: "Nicht berechtigt" })
  if (!u.get("supervisor")) return e.json(403, { success: false, error: "Nur Supervisor darf die Wissensbasis importieren" })
  const key = $os.getenv("MISTRAL_API_KEY")
  if (!key) return e.json(500, { success: false, error: "MISTRAL_API_KEY ist auf dem Server nicht gesetzt" })

  const body = e.requestInfo().body || {}
  const dateiname = (body.dateiname || "Dokument").toString().slice(0, 200)
  const text = (body.text || "").toString().slice(0, 14000)
  if (text.trim().length < 40) return e.json(400, { success: false, error: "Zu wenig Text zum Auswerten" })

  // Muss mit src/lib/wissenKategorien.ts übereinstimmen
  const KATEGORIEN = [
    "Notfallmedizin", "Kardiologie & EKG", "Atmung & Beatmung", "Trauma & Chirurgie",
    "Neurologie", "Innere Medizin", "Pädiatrie", "Gynäkologie & Geburtshilfe",
    "Psychiatrie & Krisenintervention", "Medikamente & Pharmakologie", "Anatomie & Physiologie",
    "Hygiene & Recht", "Einsatztaktik & Organisation", "Geräte & Technik", "Sonstiges",
  ]

  const prompt =
    "Du strukturierst hochgeladenes Fachmaterial (Datei: \"" + dateiname + "\") für die geprüfte Wissensbasis " +
    "einer Rettungsdienst-/Feuerwehr-/Sanitätsdienst-Organisation. Zerlege den folgenden Textauszug in 1 bis 6 " +
    "in sich geschlossene Wissenseinträge (bei nur einem Thema genau 1 Eintrag).\n\n" +
    "Regeln pro Eintrag:\n" +
    "- titel: prägnant, ohne Nummerierung.\n" +
    "- inhalt: klar gegliederter deutscher Fachtext im Nachschlagewerk-Stil. Beginne mit 1-2 Sätzen Kurzfassung " +
    "(ohne Überschrift), gliedere danach in Kapitel mit '## '-Überschriften (z.B. ## Definition, ## Ursachen, " +
    "## Symptomatik, ## Diagnostik, ## Therapie / Vorgehen, ## Besonderheiten — nur Kapitel, die der Text hergibt; " +
    "Absätze, Aufzählungen mit '- ', Wichtiges **fett**). Kritische Warnungen als eigene Zeile '!!! cave <Satz>', " +
    "zentrale Merksätze als '!!! merke <Satz>'. Verwende AUSSCHLIESSLICH Informationen, die im Textauszug stehen — " +
    "nichts hinzuerfinden, nicht ausschmücken, keine externen Fakten ergänzen; Unklares oder Bruchstückhaftes weglassen.\n" +
    "- tags: 3-6 kurze Schlagwörter in Kleinschreibung, an denen man den Eintrag zu einer Frage findet.\n" +
    "- kategorie: GENAU EINE aus dieser Liste (wörtlich übernehmen): " + KATEGORIEN.join(" | ") + ".\n" +
    "- Lasse Kopf-/Fußzeilen, Seitenzahlen, Inhaltsverzeichnisse und personenbezogene Daten weg.\n" +
    "Enthält der Auszug keinen verwertbaren Fachinhalt, gib {\"eintraege\":[]} zurück.\n\n" +
    "Antworte AUSSCHLIESSLICH als JSON in exakt dieser Struktur:\n" +
    '{"eintraege":[{"titel":"...","inhalt":"...","tags":["...","..."],"kategorie":"..."}]}\n\n' +
    "TEXTAUSZUG:\n" + text

  try {
    const res = $http.send({
      url: "https://api.mistral.ai/v1/chat/completions",
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral-medium-latest",
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
      timeout: 120,
    })
    const data = res.json || {}
    const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : ""
    let parsed
    try { parsed = JSON.parse(content) } catch (err) { return e.json(502, { success: false, error: "KI-Antwort war kein gültiges JSON" }) }
    const arr = parsed && Array.isArray(parsed.eintraege) ? parsed.eintraege : []
    const eintraege = []
    for (const it of arr.slice(0, 6)) {
      const titel = (it && it.titel ? it.titel : "").toString().trim().slice(0, 200)
      const inhalt = (it && it.inhalt ? it.inhalt : "").toString().trim().slice(0, 6000)
      if (!inhalt) continue // Titel-ohne-Inhalt verwerfen — sonst leere Wissenseinträge
      let tags = []
      if (it && Array.isArray(it.tags)) tags = it.tags.map(t => (t || "").toString().trim().slice(0, 40)).filter(Boolean).slice(0, 6)
      let kategorie = (it && it.kategorie ? it.kategorie : "").toString().trim()
      if (KATEGORIEN.indexOf(kategorie) === -1) kategorie = ""
      eintraege.push({ titel: titel || dateiname, inhalt: inhalt, tags: tags, kategorie: kategorie })
    }
    return e.json(200, { success: true, eintraege: eintraege })
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
