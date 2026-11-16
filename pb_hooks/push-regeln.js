// Push-Benachrichtigungen: reine Regeln (Katalog, Empfänger, Einstellungen, Zeit, Texte, Abos).
//
// Eine Implementierung für drei Leser:
//   - die Hooks (push.pb.js, push-versand.js) laden sie per require() im Handler,
//   - vitest (src/lib/__tests__/pushRegeln.test.ts, pushGleichlauf.test.ts) per runInNewContext,
//   - die Hook-Prüfung vergleicht sie in der JSVM von PocketBase mit Node (Gleichlauf-Route).
//
// CommonJS, keine Seiteneffekte auf oberster Ebene und keine PocketBase-Globale ($app,
// $security, $http …): Wer Hashes oder Datensätze braucht, bekommt sie übergeben.
//
// Zwilling für die App: src/lib/push/regeln.ts (Katalog, Einstellungen, Ruhezeit). Gleiche
// Namen, gleiche Ergebnisse; pushGleichlauf.test.ts wacht darüber.
//
// Regex-Regel (JSVM): kein \s, kein \p{…} (in PocketBase still falsch), kein /u, kein
// Lookbehind; nur ausdrückliche Zeichenklassen. Zeit Europe/Berlin von Hand (Intl fehlt).
//
// Vertrag: Bauplan Push, Abschnitte 1.1, 1.3, 3, 4.1. Texte ohne Gedankenstriche, ohne Emojis.

// ── Katalog ─────────────────────────────────────────────────────────────────

/** Reihenfolge = Anzeige. Zwilling: ANLAESSE in src/lib/push/regeln.ts. */
const ANLAESSE = [
  { key: "mitteilung", gruppe: "organisation", titel: "Mitteilung der Organisation", beschreibung: "Was die Leitung oder der Supervisor an alle in der Organisation schickt.", art: "sofort", pflicht: true, modul: null },
  { key: "unterschrift", gruppe: "protokolle", titel: "Wartet auf deine Unterschrift", beschreibung: "Ein Protokoll, eine Produktausgabe, eine Einsendung oder eine Defektmeldung mit deinem Namen braucht deine Bestätigung.", art: "sofort", pflicht: false, modul: null },
  { key: "protokoll_neu", gruppe: "protokolle", titel: "Neues Patientenprotokoll", beschreibung: "Ein Patientenprotokoll ist eingegangen. Die Nachricht nennt keinen Namen und keinen Inhalt.", art: "sofort", pflicht: false, modul: "patienten" },
  { key: "mpg_gesperrt", gruppe: "mpg", titel: "Gerät gesperrt", beschreibung: "Ein Medizinprodukt wurde gesperrt, auch wenn seine STK oder MTK überfällig ist.", art: "sofort", pflicht: false, modul: "mpg" },
  { key: "mpg_defekt", gruppe: "mpg", titel: "Defekt oder Meldung von außen", beschreibung: "Ein Mangel wurde eingetragen oder eine Defektmeldung von außen ist eingegangen.", art: "sofort", pflicht: false, modul: "mpg" },
  { key: "mpg_bald", gruppe: "mpg", titel: "Prüfungen bald fällig", beschreibung: "Wie viele Prüfungen, STK und MTK bald fällig oder überfällig sind.", art: "woche", pflicht: false, modul: "mpg" },
  { key: "lager_mindestbestand", gruppe: "lager", titel: "Unter Mindestbestand", beschreibung: "Ein Artikel liegt an einem Standort unter dem Soll.", art: "sofort", pflicht: false, modul: "lager" },
  { key: "lager_abgelaufen", gruppe: "lager", titel: "Abgelaufen", beschreibung: "Artikel mit abgelaufenem Haltbarkeitsdatum, morgens gesammelt.", art: "morgens", pflicht: false, modul: "lager" },
  { key: "lager_ablauf", gruppe: "lager", titel: "Läuft bald ab", beschreibung: "Wie viele Artikel in den nächsten 30 Tagen ablaufen.", art: "woche", pflicht: false, modul: "lager" },
  { key: "produktausgabe", gruppe: "lager", titel: "Offene Produktausgabe", beschreibung: "Eine Produktausgabe ist eingegangen und wartet auf Bearbeitung.", art: "sofort", pflicht: false, modul: "lager" },
  { key: "einsendung", gruppe: "vorgaenge", titel: "Neue Einsendung", beschreibung: "Ein Formular der Organisation wurde eingesendet.", art: "sofort", pflicht: false, modul: "dokumente" },
  { key: "cirs_neu", gruppe: "vorgaenge", titel: "Neue CIRS-Meldung", beschreibung: "Eine CIRS-Meldung ist eingegangen. Die Nachricht nennt nicht ihren Text.", art: "sofort", pflicht: false, modul: "dokumente" },
  { key: "cirs_ueberfaellig", gruppe: "vorgaenge", titel: "CIRS überfällig", beschreibung: "Wie viele CIRS-Vorgänge ihre Frist überschritten haben.", art: "woche", pflicht: false, modul: "dokumente" },
  { key: "ausbildung", gruppe: "ausbildung", titel: "Zu- und Absagen", beschreibung: "Jemand sagt zu einem Ausbildungstermin zu oder ab.", art: "sofort", pflicht: false, modul: "ausbildungen" },
]

const GRUPPEN = [
  { key: "organisation", titel: "Organisation" },
  { key: "protokolle", titel: "Protokolle" },
  { key: "mpg", titel: "MPG" },
  { key: "lager", titel: "Lager" },
  { key: "vorgaenge", titel: "Vorgänge und CIRS" },
  { key: "ausbildung", titel: "Ausbildung" },
]

const RUHE_VORGABE = { an: true, von: "22:00", bis: "06:00" }

const GRENZEN = {
  titel: 80, text: 300, url: 200, tag: 64, payloadBytes: 2000, geraeteJePerson: 10,
  drosselMax: 8, drosselFensterMs: 600000, warteMaxMs: 72 * 3600000, warteJePerson: 50,
  geraetHoechstalterTage: 180, grabsteinTage: 30, schutzschalterMs: 60000, taktSperreMs: 300000,
  beanspruchtMs: 600000, mpgFensterMs: 120000, dienstZeitHookS: 1, dienstZeitTaktS: 3,
  // Owner 12.3: Mitteilungen der Leitung
  mitteilungTitel: 120, mitteilungText: 1000, mitteilungLeitungMax: 3, mitteilungLeitungFensterMs: 24 * 3600000,
  // Drosseln der Routen (1.2) und Abstände des Takts
  routeGeraet: { max: 30, fensterMs: 3600000 },
  routeEinstellungen: { max: 120, fensterMs: 3600000 },
  routeOrganisation: { max: 120, fensterMs: 3600000 },
  routeProbe: { max: 5, fensterMs: 600000 },
  lagerAbstandMs: 300000, dienstAlterMs: 600000, versucheMax: 5, nachrichtenJeAuftrag: 500,
}

/** Für alle Nachrichten gleich (1.1): Hersteller sollen die Art der Meldung nicht erkennen. */
const TTL_EINHEIT = 86400
const DRINGLICHKEIT_EINHEIT = "high"

/** Nur diese Tags sind Zustände (fester Tag, Topic, ersetzen sich). */
const ZUSTAND_TAGS = ["mitteilung:", "mpg_gesperrt:", "woche", "probe"]

/** Erlaubte Push-Hosts (gleiche Liste im Dienst, dienste/push/lib/pruefen.mjs). Punkt vorn = Endung. */
const HOSTS = ["fcm.googleapis.com", ".push.apple.com", "push.services.mozilla.com", ".push.services.mozilla.com", ".notify.windows.com"]

// https://, Host aus Kleinbuchstaben, Ziffern, Bindestrich und Punkt (kein Punkt am Ende, kein
// leeres Label), kein Port, kein Benutzerteil, Pfad nur aus [A-Za-z0-9._~:/%+=-], keine Query,
// kein Fragment, kein Backslash, kein @, kein #, kein Leerraum
const ENDPOINT_RE = /^https:\/\/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)(\/[A-Za-z0-9._~:\/%+=-]*)$/
// nur für Hosts auf .notify.windows.com zusätzlich: Pfad + "?token=" + [A-Za-z0-9%._~+=-]+
const ENDPOINT_WNS_RE = /^https:\/\/((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+notify\.windows\.com)(\/[A-Za-z0-9._~:\/%+=-]*)\?token=[A-Za-z0-9%._~+=-]+$/
// nur in Prüfungen (Liste gesetzt und Prüfbetrieb)
const ENDPOINT_TEST_RE = /^https:\/\/127\.0\.0\.1:([0-9]{2,5})(\/[A-Za-z0-9._~:\/%+=-]*)$/

const P256DH_RE = /^B[A-Za-z0-9_-]{86}$/
const AUTH_RE = /^[A-Za-z0-9_-]{22}$/

/** Formular → Modul, das frei sein muss (Unterschrift). */
const FORMULAR_MODUL = { patienten: "patienten", produktausgabe: "lager", defektmeldung: "mpg", eigen: "dokumente" }

// Module wie in src/lib/freigabe.ts (Kopie aus formular-regeln.js, damit Push ohne diese Datei läuft)
const MODUL_IDS = ["benutzer", "einsaetze", "eks", "patienten", "dokumente", "lager", "mpg", "dateien", "lernbar", "ausbildungen", "chat", "notizen"]
const ENTHAELT = { lager: ["dateien", "mpg", "dokumente"] }
const IMMER = ["benutzer"]

/** Katalog der CIRS-Kategorien (KATEGORIEN in src/lib/cirs.ts). */
const KATEGORIEN_CIRS = [
  { wert: "personal", name: "Personal / Besetzung" },
  { wert: "kommunikation", name: "Kommunikation" },
  { wert: "material", name: "Material / Ausrüstung" },
  { wert: "fahrzeug", name: "Fahrzeug" },
  { wert: "einsatz", name: "Einsatztaktik" },
  { wert: "organisation", name: "Organisation" },
  { wert: "sonstiges", name: "Sonstiges" },
]

const SCHWERE_TEXT = { low: "gering", medium: "mittel", high: "hoch", critical: "kritisch" }

// Leerraum wie LEERRAUM in formular-regeln.js (kein \s)
const LEERRAUM = /[ \t\n\r\f\v\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g
const LEERRAUM_OHNE_ZEILE = /[ \t\r\f\v\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g
// Steuerzeichen (ohne Tab und Zeilenumbruch, die LEERRAUM behandelt) und unsichtbare Zeichen
const STEUER = /[\u0000-\u0008\u000E-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g

// ── Kleine Hilfen ───────────────────────────────────────────────────────────

function istObjekt(x) {
  return !!x && typeof x === "object" && !Array.isArray(x)
}

/** Objekt aus einem Wert, auch aus Text oder doppelt kodiertem Text; Kaputtes → {}. */
function objektLesen(roh) {
  let x = roh
  for (let i = 0; i < 2 && typeof x === "string"; i++) {
    try { x = JSON.parse(x) } catch (err) { return {} }
  }
  return istObjekt(x) ? x : {}
}

function zwei(n) {
  return (n < 10 ? "0" : "") + n
}

function anlass(key) {
  for (let i = 0; i < ANLAESSE.length; i++) if (ANLAESSE[i].key === key) return ANLAESSE[i]
  return null
}

// ── Rechte und Module (3.1) ─────────────────────────────────────────────────

function zeitpunkt(text) {
  const t = Date.parse(String(text || "").trim().replace(" ", "T"))
  return Number.isFinite(t) ? t : NaN
}

function istUsers(u) {
  return !!u && (u.sammlung === undefined || u.sammlung === "users")
}

/** Nicht gesperrt und nicht abgelaufen. Ein unlesbares Ablaufdatum gilt als abgelaufen. */
function aktiv(u, jetztMs) {
  if (!u || u.disabled === true) return false
  const bis = u.expires_at
  if (bis === undefined || bis === null || String(bis).trim() === "") return true
  return zeitpunkt(bis) > jetztMs
}

/** Format von @now und Date-Feldern: "JJJJ-MM-TT HH:MM:SS.sssZ". */
function pbZeit(ms) {
  return new Date(ms).toISOString().replace("T", " ")
}

function rechteObjekt(u, feld) {
  return u && istObjekt(u[feld]) ? u[feld] : {}
}

/** Dauerhaftes Recht: permissions[recht] === true. */
function dauerhaft(u, recht) {
  return rechteObjekt(u, "permissions")[recht] === true
}

/**
 * Befristetes Recht genau wie in den API-Regeln: until ist Text, enthält ein Leerzeichen
 * (`~ " "`) und ist als Text größer als @now (`until > @now`).
 */
function befristetWieRegel(u, recht, jetztMs) {
  const t = rechteObjekt(u, "temp_permissions")[recht]
  const bis = istObjekt(t) ? t.until : undefined
  return typeof bis === "string" && bis.indexOf(" ") >= 0 && bis > pbZeit(jetztMs)
}

function rechtWieRegel(u, recht, jetztMs) {
  return dauerhaft(u, recht) || befristetWieRegel(u, recht, jetztMs)
}

/** Wie rechtAktiv in formular-regeln.js (beide Datumsformate). Nur für den Gleichlauf; Push nutzt es nicht. */
function rechtAktiv(u, recht, jetztMs) {
  if (!u) return false
  if (dauerhaft(u, recht)) return true
  const t = rechteObjekt(u, "temp_permissions")[recht]
  const bis = istObjekt(t) ? t.until : ""
  return !!bis && zeitpunkt(bis) > jetztMs
}

function gebucht(org) {
  if (!org || typeof org !== "object") return null
  let wert = org.freigeschaltet
  if (typeof wert === "string") {
    try { wert = JSON.parse(wert) } catch (err) { return null }
  }
  if (!Array.isArray(wert)) return null
  return wert.filter((x) => typeof x === "string" && MODUL_IDS.indexOf(x) >= 0)
}

function mitEnthaltenen(liste) {
  const frei = {}
  for (const id of IMMER.concat(liste)) frei[id] = true
  const offen = liste.slice()
  while (offen.length) {
    const id = offen.shift()
    for (const x of ENTHAELT[id] || []) {
      if (!frei[x]) { frei[x] = true; offen.push(x) }
    }
  }
  return MODUL_IDS.filter((id) => frei[id])
}

/** Ist das Modul frei? Gleiche Rechnung wie modulFrei in src/lib/freigabe.ts. */
function modulFrei(org, modulId) {
  const liste = gebucht(org)
  return liste === null || mitEnthaltenen(liste).indexOf(modulId) >= 0
}

function teilnehmer(u) {
  return u.role === "teilnehmer"
}

function supervisor(u) {
  return u.supervisor === true
}

/** Grundbedingung (3.1): Konto aus users, aktiv, Organisation des Ereignisses, Organisation aktiv. */
function grundbedingung(person, org, jetztMs) {
  return istUsers(person) && aktiv(person, jetztMs) && !!org && org.is_active === true && !!org.id && person.organization_id === org.id
}

function mpgZugang(u, jetztMs) {
  return rechtWieRegel(u, "dashboard", jetztMs) || supervisor(u)
}

function mpgVerwalten(u, jetztMs) {
  return u.role === "admin" || u.role === "mpg" || rechtWieRegel(u, "mpg_verwalten", jetztMs) || supervisor(u)
}

/** Recht je Anlass genau wie die API-Regel (Tabelle 3.1); ohne Grundbedingung und Modul. */
function rechtFuerAnlass(u, key, kontext, jetztMs) {
  switch (key) {
    case "mitteilung":
      // Owner 12.1: an alle aktiven Konten der Organisation, auch an Teilnehmende
      return true
    case "unterschrift":
      return !!kontext && !!kontext.ziel && kontext.ziel === u.id && !teilnehmer(u) && !supervisor(u)
    case "protokoll_neu":
      return !teilnehmer(u) && (u.role === "admin" || rechtWieRegel(u, "patienten", jetztMs) || supervisor(u))
    case "mpg_gesperrt":
    case "mpg_defekt":
    case "mpg_bald":
      return !teilnehmer(u) && mpgZugang(u, jetztMs) && mpgVerwalten(u, jetztMs)
    case "lager_mindestbestand":
    case "lager_abgelaufen":
    case "lager_ablauf":
    case "produktausgabe":
      return !teilnehmer(u) && (rechtWieRegel(u, "lager", jetztMs) || supervisor(u))
    case "einsendung":
      return !teilnehmer(u) && (supervisor(u) || u.role === "admin" || rechtWieRegel(u, "dokumente", jetztMs))
    case "cirs_neu":
    case "cirs_ueberfaellig":
      // Die Regel von cirs_reports kennt keine befristeten Rechte
      return supervisor(u) || dauerhaft(u, "dokumente")
    case "ausbildung":
      return !teilnehmer(u) && (supervisor(u) || dauerhaft(u, "ausbildungen_manage"))
    default:
      return false
  }
}

/** Modul, das für diesen Anlass frei sein muss (Unterschrift: je Formular); "" = keins; null = unbekannt. */
function modulFuer(key, kontext) {
  const a = anlass(key)
  if (!a) return null
  if (key === "unterschrift") {
    const f = kontext && kontext.formular
    return Object.prototype.hasOwnProperty.call(FORMULAR_MODUL, f) ? FORMULAR_MODUL[f] : null
  }
  return a.modul || ""
}

/**
 * Darf diese Person die Nachricht zu diesem Anlass bekommen? Tabelle 3.1, genau die API-Regel.
 * kontext = { ziel?, formular?, ausloeser? }. Ohne Einstellungen und Geräte (empfaengerFiltern).
 */
function darfAnlass(person, org, key, kontext, jetztMs) {
  if (!grundbedingung(person, org, jetztMs)) return false
  const k = kontext || {}
  if (k.ausloeser && k.ausloeser === person.id) return false
  const m = modulFuer(key, k)
  if (m === null) return false
  if (m && !modulFrei(org, m)) return false
  return rechtFuerAnlass(person, key, k, jetztMs)
}

/** Für /stand: kann die Person diesen Anlass grundsätzlich bekommen? */
function darfAnlassGrundsaetzlich(person, org, key, jetztMs) {
  if (key !== "unterschrift") return darfAnlass(person, org, key, {}, jetztMs)
  if (!grundbedingung(person, org, jetztMs) || teilnehmer(person) || supervisor(person)) return false
  for (const f of Object.keys(FORMULAR_MODUL)) if (modulFrei(org, FORMULAR_MODUL[f])) return true
  return false
}

/** Leitung (2.4): darf die Anlässe der Organisation festlegen. */
function darfOrganisation(person, orgId, jetztMs) {
  if (!istUsers(person) || !aktiv(person, jetztMs) || !orgId || person.organization_id !== orgId) return false
  return person.role === "admin" || rechtWieRegel(person, "unitarii", jetztMs) || supervisor(person)
}

/**
 * Mitteilungen der Organisation (2.7, Owner 12.3): "supervisor" (jede Organisation),
 * "leitung" (Rolle admin, nur die eigene Organisation) oder null. Immer aktives Konto aus users.
 */
function mitteilungRolle(person, orgId, jetztMs) {
  if (!istUsers(person) || !aktiv(person, jetztMs)) return null
  if (supervisor(person)) return "supervisor"
  if (person.role === "admin" && !!orgId && person.organization_id === orgId) return "leitung"
  return null
}

const MITTEILUNG_TEXTE = {
  verboten: "Mitteilungen der Organisation schicken nur der Supervisor und die Leitung der eigenen Organisation.",
  titel_leer: "Bitte einen Titel eingeben.",
  titel_lang: "Der Titel ist zu lang (höchstens 120 Zeichen).",
  text_lang: "Der Text ist zu lang (höchstens 1000 Zeichen).",
  html: "Bitte nur Text eingeben, ohne HTML.",
  organisation: "Diese Organisation gibt es nicht.",
  drossel: "Höchstens drei Mitteilungen je Organisation in 24 Stunden. Die nächste geht in {m} wieder.",
}

function zeichenZahl(s) {
  // Zeichen wie PocketBase (Max length zählt Zeichen, nicht UTF-16-Einheiten)
  let n = 0
  const t = String(s)
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < t.length) {
      const d = t.charCodeAt(i + 1)
      if (d >= 0xdc00 && d <= 0xdfff) i++
    }
    n++
  }
  return n
}

const HTML_RE = /<[A-Za-z!\/?]|&#?[A-Za-z0-9]{1,10};/

/** Titel und Text einer Mitteilung prüfen (12.3): Länge, nur Text. { ok } | { ok: false, feld, text }. */
function mitteilungPruefen(titel, text) {
  const t = typeof titel === "string" ? titel : titel === undefined || titel === null ? "" : String(titel)
  const m = typeof text === "string" ? text : text === undefined || text === null ? "" : String(text)
  if (!t.replace(LEERRAUM, "")) return { ok: false, feld: "title", text: MITTEILUNG_TEXTE.titel_leer }
  if (zeichenZahl(t) > GRENZEN.mitteilungTitel) return { ok: false, feld: "title", text: MITTEILUNG_TEXTE.titel_lang }
  if (zeichenZahl(m) > GRENZEN.mitteilungText) return { ok: false, feld: "message", text: MITTEILUNG_TEXTE.text_lang }
  if (HTML_RE.test(t)) return { ok: false, feld: "title", text: MITTEILUNG_TEXTE.html }
  if (HTML_RE.test(m)) return { ok: false, feld: "message", text: MITTEILUNG_TEXTE.html }
  return { ok: true }
}

/**
 * Drossel der Leitung (12.3): höchstens max Mitteilungen je Organisation im Fenster. alt = Liste
 * der Zeitpunkte im Speicher (zählt auch Gelöschtes), dbZeiten = Zeitpunkte aus hub_notifications
 * (überdauern einen Neustart). Es zählt die größere Liste. { erlaubt, neu, sekunden }.
 */
function mitteilungDrossel(alt, dbZeiten, jetztMs, max, fensterMs) {
  const imFenster = (l) => (Array.isArray(l) ? l : []).map(Number).filter((t) => Number.isFinite(t) && t > jetztMs - fensterMs && t <= jetztMs + 60000)
  const speicher = imFenster(alt)
  const db = imFenster(dbZeiten)
  const quelle = speicher.length >= db.length ? speicher : db
  if (quelle.length >= max) {
    const aeltester = Math.min.apply(null, quelle)
    return { erlaubt: false, neu: speicher, sekunden: Math.max(1, Math.ceil((aeltester + fensterMs - jetztMs) / 1000)) }
  }
  return { erlaubt: true, neu: speicher.concat([jetztMs]), sekunden: 0 }
}

/** „{m} Minuten“ bzw. „{h} Stunden“ aus Sekunden, aufgerundet. */
function dauerText(sekunden) {
  const s = Math.max(1, Number(sekunden) || 0)
  if (s > 5400) {
    const h = Math.ceil(s / 3600)
    return h === 1 ? "einer Stunde" : h + " Stunden"
  }
  const m = Math.max(1, Math.ceil(s / 60))
  return m === 1 ? "einer Minute" : m + " Minuten"
}

// ── Einstellungen (2.4) ─────────────────────────────────────────────────────

/** Abgeschaltete Anlässe: nur bekannte, nie Pflicht, ohne Doppelte, in Katalog-Reihenfolge. */
function ausLesen(roh) {
  if (!Array.isArray(roh)) return []
  const drin = {}
  for (const k of roh) if (typeof k === "string") drin[k] = true
  return ANLAESSE.filter((a) => !a.pflicht && drin[a.key] === true).map((a) => a.key)
}

function ruheZeit(wert, sonst) {
  const m = zeitLesen(wert)
  return m === null ? sonst : zeitText(m)
}

function ruheLesen(roh) {
  if (!istObjekt(roh)) return { an: RUHE_VORGABE.an, von: RUHE_VORGABE.von, bis: RUHE_VORGABE.bis }
  return {
    an: roh.an === true ? true : roh.an === false ? false : RUHE_VORGABE.an,
    von: ruheZeit(roh.von, RUHE_VORGABE.von),
    bis: ruheZeit(roh.bis, RUHE_VORGABE.bis),
  }
}

function personEinstellungenLesen(roh) {
  const x = objektLesen(roh)
  return { v: 1, aus: ausLesen(x.aus), ruhe: ruheLesen(x.ruhe), mitteilung_in_ruhe: x.mitteilung_in_ruhe !== false }
}

function personEinstellungenMischen(alt, teil) {
  const a = personEinstellungenLesen(alt)
  const t = objektLesen(teil)
  let ruhe = a.ruhe
  if (istObjekt(t.ruhe)) {
    const r = t.ruhe
    ruhe = {
      an: r.an === true ? true : r.an === false ? false : a.ruhe.an,
      von: r.von === undefined ? a.ruhe.von : ruheZeit(r.von, a.ruhe.von),
      bis: r.bis === undefined ? a.ruhe.bis : ruheZeit(r.bis, a.ruhe.bis),
    }
  }
  return {
    v: 1,
    aus: t.aus === undefined ? a.aus : ausLesen(t.aus),
    ruhe: ruhe,
    mitteilung_in_ruhe: t.mitteilung_in_ruhe === false ? false : t.mitteilung_in_ruhe === true ? true : a.mitteilung_in_ruhe,
  }
}

function orgEinstellungenLesen(roh) {
  return { v: 1, aus: ausLesen(objektLesen(roh).aus) }
}

function anlassAn(orgEinst, personEinst, key) {
  const a = anlass(key)
  if (!a) return false
  if (a.pflicht) return true
  const orgAus = orgEinst && Array.isArray(orgEinst.aus) ? orgEinst.aus : []
  const personAus = personEinst && Array.isArray(personEinst.aus) ? personEinst.aus : []
  return orgAus.indexOf(key) < 0 && personAus.indexOf(key) < 0
}

/** personen: { …person, push: PersonEinstellungen }; org mit push: OrgEinstellungen. */
function empfaengerFiltern(personen, org, key, kontext, jetztMs) {
  const orgEinst = org && org.push ? org.push : orgEinstellungenLesen(null)
  return (personen || []).filter((p) => darfAnlass(p, org, key, kontext, jetztMs) && anlassAn(orgEinst, p.push || personEinstellungenLesen(null), key))
}

// ── Zeit (Europe/Berlin von Hand) ───────────────────────────────────────────

function letzterSonntag(jahr, monat) {
  const ende = new Date(Date.UTC(jahr, monat + 1, 0))
  return Date.UTC(jahr, monat, ende.getUTCDate() - ende.getUTCDay(), 1)
}

/** 120 in der Sommerzeit (letzter Sonntag März 01:00 UTC bis letzter Sonntag Oktober 01:00 UTC), sonst 60. */
function berlinOffsetMinuten(ms) {
  const jahr = new Date(ms).getUTCFullYear()
  return ms >= letzterSonntag(jahr, 2) && ms < letzterSonntag(jahr, 9) ? 120 : 60
}

function berlinTeile(ms) {
  const d = new Date(ms + berlinOffsetMinuten(ms) * 60000)
  const jahr = d.getUTCFullYear()
  const monat = d.getUTCMonth() + 1
  const tagImMonat = d.getUTCDate()
  const stunde = d.getUTCHours()
  const minute = d.getUTCMinutes()
  const wt = d.getUTCDay()
  return {
    tag: jahr + "-" + zwei(monat) + "-" + zwei(tagImMonat),
    jahr: jahr, monat: monat, tagImMonat: tagImMonat, stunde: stunde, minute: minute,
    wochentag: wt === 0 ? 7 : wt,
    minutenImTag: stunde * 60 + minute,
  }
}

function berlinZuUtc(tag, minuten) {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(tag))
  if (!m) return NaN
  const wand = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + Math.floor(Number(minuten) || 0) * 60000
  const sommer = wand - 120 * 60000
  if (berlinOffsetMinuten(sommer) === 120) return sommer
  const winter = wand - 60 * 60000
  if (berlinOffsetMinuten(winter) === 60) return winter
  // Lücke der Umstellung im Frühjahr: der Beginn der Sommerzeit (03:00)
  return letzterSonntag(new Date(winter).getUTCFullYear(), 2)
}

/** Kalendertag + n Tage ("JJJJ-MM-TT"). */
function tagPlus(tag, n) {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(tag))
  if (!m) return ""
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n))
  return d.getUTCFullYear() + "-" + zwei(d.getUTCMonth() + 1) + "-" + zwei(d.getUTCDate())
}

function zeitLesen(s) {
  if (typeof s !== "string") return null
  const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(s)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function zeitText(min) {
  const n = Math.floor(Number(min) || 0)
  const t = ((n % 1440) + 1440) % 1440
  return zwei(Math.floor(t / 60)) + ":" + zwei(t % 60)
}

function ruheGrenzen(r) {
  if (!r || r.an !== true) return null
  const von = zeitLesen(r.von)
  const bis = zeitLesen(r.bis)
  if (von === null || bis === null || von === bis) return null
  return { von: von, bis: bis }
}

function inRuhe(r, jetztMs) {
  const g = ruheGrenzen(r)
  if (!g) return false
  const m = berlinTeile(jetztMs).minutenImTag
  return g.von < g.bis ? m >= g.von && m < g.bis : m >= g.von || m < g.bis
}

function ruheEnde(r, jetztMs) {
  if (!inRuhe(r, jetztMs)) return null
  const g = ruheGrenzen(r)
  const t = berlinTeile(jetztMs)
  const ende = g.von > g.bis && t.minutenImTag >= g.von ? berlinZuUtc(tagPlus(t.tag, 1), g.bis) : berlinZuUtc(t.tag, g.bis)
  // In der doppelten Stunde im Herbst (zweites 02:xx) ist das Ende das zweite Vorkommen
  return ende > jetztMs ? ende : ende + 3600000
}

function ruheText(r) {
  const g = ruheGrenzen(r)
  if (!g) return "Aus"
  return "Von " + zeitText(g.von) + " bis " + zeitText(g.bis) + " Uhr"
}

/** Sofort oder später (Ruhezeit). Die Mitteilung kommt bei mitteilung_in_ruhe auch in der Ruhezeit. */
function zustellart(personEinst, key, jetztMs) {
  const p = personEinst || personEinstellungenLesen(null)
  if (key === "mitteilung" && p.mitteilung_in_ruhe !== false) return { art: "sofort" }
  if (inRuhe(p.ruhe, jetztMs)) return { art: "spaeter", faellig: ruheEnde(p.ruhe, jetztMs), grund: "ruhe" }
  return { art: "sofort" }
}

/** Drossel je Person: festes Fenster ab der ersten Nachricht. { erlaubt, neu: { start, n }, faellig }. */
function drossel(alt, jetztMs, max, fensterMs) {
  const a = istObjekt(alt) ? alt : null
  const start = a ? Number(a.start) : NaN
  if (!a || !Number.isFinite(start) || jetztMs >= start + fensterMs || start > jetztMs + 60000) {
    return { erlaubt: max >= 1, neu: { start: jetztMs, n: max >= 1 ? 1 : 0 }, faellig: jetztMs + fensterMs }
  }
  const n = Number(a.n) || 0
  if (n < max) return { erlaubt: true, neu: { start: start, n: n + 1 }, faellig: start + fensterMs }
  return { erlaubt: false, neu: { start: start, n: n }, faellig: start + fensterMs }
}

/** Morgenlauf ab 06:00 Berlin, Wochenlauf Montag ab 07:00, je nur am selben Tag und einmal. */
function laeufeFaellig(jetztMs, erledigt) {
  const e = erledigt || {}
  const t = berlinTeile(jetztMs)
  return {
    morgen: t.minutenImTag >= 360 && e.morgen !== t.tag ? t.tag : null,
    woche: t.wochentag === 1 && t.minutenImTag >= 420 && e.woche !== t.tag ? t.tag : null,
  }
}

// ── Texte (3.2) ─────────────────────────────────────────────────────────────

/** "15.11." */
function tagMonat(ms) {
  const t = berlinTeile(ms)
  return zwei(t.tagImMonat) + "." + zwei(t.monat) + "."
}

/** "14:20" */
function uhrzeit(ms) {
  const t = berlinTeile(ms)
  return zwei(t.stunde) + ":" + zwei(t.minute)
}

/** "15.11., 14:20" */
function datumKurz(ms) {
  return tagMonat(ms) + ", " + uhrzeit(ms)
}

/** "31.10.2026"; unlesbar → "". */
function tagText(tag) {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(String(tag || ""))
  return m ? m[3] + "." + m[2] + "." + m[1] : ""
}

/** Einzelne Ersatzzeichen (ohne Partner) durch U+FFFD ersetzen. */
function ersatzpaareHeilen(s) {
  let aus = ""
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = i + 1 < s.length ? s.charCodeAt(i + 1) : 0
      if (d >= 0xdc00 && d <= 0xdfff) { aus += s.charAt(i) + s.charAt(i + 1); i++ } else aus += "\uFFFD"
    } else if (c >= 0xdc00 && c <= 0xdfff) aus += "\uFFFD"
    else aus += s.charAt(i)
  }
  return aus
}

/**
 * Kürzen: Steuerzeichen raus, Leerraum zusammenziehen (eine Zeile, oder bis zu `zeilen` Zeilen),
 * höchstens max UTF-16-Einheiten, nie ein Ersatzpaar trennen, "…" am Ende.
 */
function kuerzen(text, max, o) {
  const zeilen = o && Number(o.zeilen) > 1 ? Math.floor(Number(o.zeilen)) : 1
  let s = ersatzpaareHeilen(String(text === undefined || text === null ? "" : text)).replace(STEUER, "")
  if (zeilen > 1) {
    s = s.replace(/\r\n?/g, "\n").split("\n").map((z) => z.replace(LEERRAUM_OHNE_ZEILE, " ").replace(/^ +| +$/g, "")).filter((z) => z !== "").slice(0, zeilen).join("\n")
  } else {
    s = s.replace(LEERRAUM, " ").replace(/^ +| +$/g, "")
  }
  const g = Math.max(1, Math.floor(Number(max) || 1))
  if (s.length <= g) return s
  let n = g - 1
  const c = s.charCodeAt(n - 1)
  if (c >= 0xd800 && c <= 0xdbff) n--
  return s.slice(0, n).replace(/[ \n]+$/, "") + "…"
}

/** Name einer Person für Texte: höchstens 60 Zeichen; sieht er aus wie eine E-Mail (mit @) → "Jemand". */
function nameKurz(name) {
  const s = kuerzen(name, 60)
  if (!s || s.indexOf("@") >= 0 || s.indexOf("\uFF20") >= 0 || s.indexOf("\uFE6B") >= 0) return "Jemand"
  return s
}

/** Grund einer Sperre nur als feste Kategorie, nie der Freitext (Textanfänge aus src/lib/mpg/aktionen.ts). */
function grundAusEreignis(art, text, angaben) {
  const a = String(art || "")
  if (a === "stk" || a === "mtk") {
    const g = objektLesen(angaben)
    return g.ergebnis === "nicht_bestanden" ? (a === "stk" ? "STK nicht bestanden" : "MTK nicht bestanden") : ""
  }
  if (a !== "gesperrt") return ""
  const t = String(text || "").trim()
  if (t === "Prüfung nicht bestanden" || t.indexOf("Prüfung nicht bestanden") === 0) return "Prüfung nicht bestanden"
  if (t.indexOf("Defekt gemeldet:") === 0 || t === "Defekt gemeldet") return "Defekt gemeldet"
  if (t.indexOf("Meldung von außen bestätigt:") === 0 || t === "Meldung von außen bestätigt") return "Meldung von außen bestätigt"
  return "von Hand gesperrt"
}

function aufzaehlen(namen, max) {
  const n = namen.length
  if (n <= max) return namen.join(", ")
  return namen.slice(0, max).join(", ") + " und " + (n - max) + " weitere"
}

function kennung(x) {
  const s = String(x || "")
  return /^[A-Za-z0-9_-]{1,40}$/.test(s) ? s : "x"
}

function textMitteilung(o) {
  const org = kuerzen(o.orgName, 30)
  const titel = kuerzen(o.titel, GRENZEN.titel) || "Mitteilung"
  return {
    titel: kuerzen(org ? org + ": " + titel : titel, GRENZEN.titel),
    text: kuerzen(o.text, GRENZEN.text, { zeilen: 5 }),
    url: "/hub",
    tag: "mitteilung:" + kennung(o.id),
  }
}

function positionenText(n) {
  const z = Math.max(0, Math.floor(Number(n) || 0))
  return z + (z === 1 ? " Position" : " Positionen")
}

function textUnterschrift(o) {
  const wann = Number.isFinite(o.angelegtMs) ? " vom " + datumKurz(o.angelegtMs) : ""
  let text
  if (o.formular === "produktausgabe") text = "Eine Produktausgabe" + wann + " (" + positionenText(o.positionen) + ") wartet auf deine Unterschrift."
  else if (o.formular === "eigen") {
    const v = kuerzen(o.vorlageTitel, 60)
    text = "Eine Einsendung" + (v ? " (" + v + ")" : "") + wann + " wartet auf deine Unterschrift."
  } else if (o.formular === "defektmeldung") {
    const g = kuerzen(o.geraetName, 60)
    text = "Deine Defektmeldung" + (g ? " zu " + g : "") + " wartet auf deine Unterschrift."
  } else text = "Ein Protokoll" + wann + " wartet auf deine Unterschrift."
  return { titel: "Wartet auf deine Unterschrift", text: kuerzen(text, GRENZEN.text), url: "/unitas", tag: "unterschrift:" + kennung(o.id) }
}

/** Nimmt bewusst nur Zeitpunkt und Kennung: nie Titel oder Inhalt eines Protokolls. */
function textProtokollNeu(o) {
  const ms = o && Number(o.angelegtMs)
  const text = Number.isFinite(ms) ? "Eingegangen am " + tagMonat(ms) + " um " + uhrzeit(ms) + ". Zum Gegenzeichnen unter Patienten." : "Zum Gegenzeichnen unter Patienten."
  return { titel: "Neues Patientenprotokoll", text: text, url: "/patienten", tag: "protokoll_neu:" + kennung(o && o.id) }
}

function textMpgGesperrt(o) {
  const liste = (o && Array.isArray(o.geraete) ? o.geraete : []).filter((g) => g && g.id)
  if (liste.length === 1) {
    const g = liste[0]
    const name = kuerzen(g.name, 60) || "Ein Gerät"
    return {
      titel: kuerzen("MPG: " + name + " gesperrt", GRENZEN.titel),
      text: g.grund ? "Grund: " + g.grund + "." : "Den Grund nennt das Gerätebuch.",
      url: "/mpg/geraete/" + kennung(g.id),
      tag: "mpg_gesperrt:" + kennung(g.id),
    }
  }
  const namen = liste.map((g) => kuerzen(g.name, 40) || "Gerät")
  return {
    titel: "MPG: " + liste.length + " Geräte gesperrt",
    text: kuerzen(aufzaehlen(namen, 3) + ".", GRENZEN.text),
    url: "/mpg/geraete",
    tag: "mpg_mehr:" + kennung(liste.length ? liste[0].id : ""),
  }
}

function artText(art) {
  return art === "mtk" ? "MTK" : "STK"
}

/** Morgenlauf: überfällige STK/MTK. geraete: [{ id, name, art, naechste }], tag = Kalendertag des Laufs. */
function textMpgFristen(o) {
  const liste = (o && Array.isArray(o.geraete) ? o.geraete : []).filter((g) => g && g.id)
  const je = {}
  const reihe = []
  for (const g of liste) {
    if (!je[g.id]) { je[g.id] = { id: g.id, name: g.name, fristen: [] }; reihe.push(je[g.id]) }
    je[g.id].fristen.push({ art: g.art, naechste: g.naechste })
  }
  if (reihe.length === 1) {
    const g = reihe[0]
    const name = kuerzen(g.name, 60) || "Ein Gerät"
    const saetze = g.fristen.map((f) => artText(f.art) + " war bis " + tagText(f.naechste) + " fällig.")
    return { titel: kuerzen("MPG: " + name + " gesperrt", GRENZEN.titel), text: kuerzen(saetze.join(" "), GRENZEN.text), url: "/mpg/geraete/" + kennung(g.id), tag: "mpg_gesperrt:" + kennung(g.id) }
  }
  const arten = {}
  for (const g of liste) arten[artText(g.art)] = true
  const art = arten.STK && arten.MTK ? "STK oder MTK" : arten.MTK ? "MTK" : "STK"
  const namen = reihe.map((g) => kuerzen(g.name, 40) || "Gerät")
  return {
    titel: "MPG: " + reihe.length + " Geräte gesperrt",
    text: kuerzen(art + " überfällig: " + aufzaehlen(namen, 3) + ".", GRENZEN.text),
    url: "/mpg/fristen",
    tag: "mpg_frist:" + kennung(o && o.tag),
  }
}

function textMpgDefekt(o) {
  const name = kuerzen(o.deviceName, 60)
  const schwere = SCHWERE_TEXT[o.schwere] || ""
  if (o.quelle === "meldung") {
    return {
      titel: kuerzen("MPG: Defektmeldung zu " + (name || "einem Gerät"), GRENZEN.titel),
      text: (schwere ? "Schwere: " + schwere + ". " : "") + "Bitte prüfen und bestätigen.",
      url: "/mpg/meldungen",
      tag: "mpg_defekt:" + kennung(o.id),
    }
  }
  return {
    titel: kuerzen("MPG: Mangel an " + (name || "einem Gerät"), GRENZEN.titel),
    text: schwere ? "Schwere: " + schwere + "." : "Bitte im Gerätebuch ansehen.",
    url: "/mpg/meldungen/" + kennung(o.id),
    tag: "mpg_defekt:" + kennung(o.id),
  }
}

/** liste: [{ item, ort, ist, soll }] (Namen aus den Stammdaten), zeitMs für den eindeutigen Tag. */
function textLagerUnter(liste, zeitMs) {
  const l = Array.isArray(liste) ? liste : []
  const zahl = (x) => String(Math.round(Number(x) || 0))
  if (l.length === 1) {
    const e = l[0]
    const ort = kuerzen(e.ort, 40)
    return {
      titel: kuerzen("Lager: " + (kuerzen(e.item, 50) || "Ein Artikel") + " unter Mindestbestand", GRENZEN.titel),
      text: (ort ? ort + ": " : "") + zahl(e.ist) + " von " + zahl(e.soll) + ".",
      url: "/lager",
      tag: "lager_unter:" + Math.floor(Number(zeitMs) || 0),
    }
  }
  const teile = l.map((e) => {
    const ort = kuerzen(e.ort, 30)
    return (kuerzen(e.item, 40) || "Artikel") + (ort ? " (" + ort + ")" : "") + " " + zahl(e.ist) + " von " + zahl(e.soll)
  })
  return {
    titel: "Lager: " + l.length + " Artikel unter Mindestbestand",
    text: kuerzen(aufzaehlen(teile, 5) + ".", GRENZEN.text),
    url: "/lager",
    tag: "lager_unter:" + Math.floor(Number(zeitMs) || 0),
  }
}

/** liste: [{ item, datum }], tag = Kalendertag des Laufs. */
function textLagerAbgelaufen(liste, tag) {
  const l = Array.isArray(liste) ? liste : []
  const t = "lager_abgelaufen:" + kennung(tag)
  if (l.length === 1) {
    return { titel: kuerzen("Lager: " + (kuerzen(l[0].item, 50) || "Ein Artikel") + " abgelaufen", GRENZEN.titel), text: "MHD " + tagText(l[0].datum) + ".", url: "/lager", tag: t }
  }
  const teile = l.map((e) => (kuerzen(e.item, 40) || "Artikel") + " (MHD " + tagText(e.datum) + ")")
  return { titel: "Lager: " + l.length + " Artikel abgelaufen", text: kuerzen(aufzaehlen(teile, 5) + ".", GRENZEN.text), url: "/lager", tag: t }
}

function textProduktausgabe(o) {
  const lager = kuerzen(o.lagerName, 40)
  const wann = Number.isFinite(o.angelegtMs) ? ", eingegangen " + datumKurz(o.angelegtMs) : ""
  return {
    titel: "Produktausgabe offen",
    text: kuerzen(positionenText(o.positionen) + (lager ? " aus Lager " + lager : "") + wann + ".", GRENZEN.text),
    url: "/lager",
    tag: "produktausgabe:" + kennung(o.id),
  }
}

function textEinsendung(o) {
  const t = kuerzen(o.titel, 60)
  const ms = Number(o.angelegtMs)
  return {
    titel: kuerzen(t ? "Neue Einsendung: " + t : "Neue Einsendung", GRENZEN.titel),
    text: Number.isFinite(ms) ? "Eingegangen am " + tagMonat(ms) + " um " + uhrzeit(ms) + "." : "Unter Vorgänge im Eingang.",
    url: "/vorgaenge?tab=eingang&seite=einsendung&id=" + kennung(o.id),
    tag: "einsendung:" + kennung(o.id),
  }
}

function kategorieName(wert) {
  for (const k of KATEGORIEN_CIRS) if (k.wert === wert) return k.name
  return ""
}

function textCirsNeu(o) {
  const k = kategorieName(o.kategorie)
  return {
    titel: "Neue CIRS-Meldung",
    text: (k ? "Kategorie: " + k + ". " : "") + "Zur Bewertung unter Vorgänge.",
    url: "/vorgaenge?tab=cirs&meldung=" + kennung(o.id),
    tag: "cirs:" + kennung(o.id),
  }
}

/** status "zugesagt" oder "abgesagt". */
function textAusbildung(o) {
  const ab = o.status === "abgesagt"
  const art = ab ? "Absage" : "Zusage"
  const wann = Number.isFinite(o.startMs) ? " " + tagMonat(o.startMs) : ""
  const termin = kuerzen(o.terminName, 60)
  return {
    titel: "Ausbildung" + wann + ": " + art,
    text: kuerzen(nameKurz(o.name) + (ab ? " hat abgesagt" : " hat zugesagt") + (termin ? " (" + termin + ")" : "") + ".", GRENZEN.text),
    url: "/ausbildungen",
    tag: kuerzen("ausbildung:" + kennung(o.terminId) + ":" + kennung(o.antwortId), GRENZEN.tag),
  }
}

function anzahl(n, eins, mehr) {
  return n + " " + (n === 1 ? eins : mehr)
}

/** Wochenüberblick: Teil der Zeile und der Anlass, der ihn freigibt (3.1, 3.2). */
const WOCHE_ANLASS = { mpg: "mpg_bald", lager: "lager_ablauf", cirs: "cirs_ueberfaellig" }

/**
 * Zeilen des Wochenüberblicks für eine Person: nur Teile, deren Anlass `darf(key)` erlaubt (Recht,
 * Modul, Schalter der Organisation und der Person) und deren Zahlen nicht null sind. Nur Zahlen,
 * nie Namen. Gilt beim Wochenlauf und noch einmal beim Zustellen aus der Warteschlange (3.2:
 * Rechte, Modul und Schalter neu prüfen), dort mit den Zahlen aus dem kontext.
 */
function wocheZeilen(w, darf) {
  const x = istObjekt(w) ? w : {}
  const zahl = (v) => Math.max(0, Math.floor(Number(v) || 0))
  const z = {}
  if (istObjekt(x.mpg) && darf(WOCHE_ANLASS.mpg)) {
    const bald = zahl(x.mpg.bald)
    const ueber = zahl(x.mpg.ueberfaellig)
    if (bald > 0 || ueber > 0) z.mpg = { bald: bald, ueberfaellig: ueber }
  }
  if (istObjekt(x.lager) && darf(WOCHE_ANLASS.lager)) {
    const n = zahl(x.lager.anzahl)
    if (n > 0) z.lager = { anzahl: n }
  }
  if (istObjekt(x.cirs) && darf(WOCHE_ANLASS.cirs)) {
    const n = zahl(x.cirs.ueberfaellig)
    if (n > 0) z.cirs = { ueberfaellig: n }
  }
  return z
}

/** Wochenüberblick; null ohne Zeile. */
function textWoche(o) {
  const z = []
  const x = o || {}
  const zahl = (v) => Math.max(0, Math.floor(Number(v) || 0))
  if (x.mpg) {
    const bald = zahl(x.mpg.bald)
    const ueber = zahl(x.mpg.ueberfaellig)
    const teile = []
    if (bald > 0) teile.push(anzahl(bald, "Gerät", "Geräte") + " bald fällig")
    if (ueber > 0) teile.push(anzahl(ueber, "Prüfung", "Prüfungen") + " überfällig")
    if (teile.length) z.push("MPG: " + teile.join(", ") + ".")
  }
  if (x.lager) {
    const n = zahl(x.lager.anzahl)
    if (n > 0) z.push("Lager: " + anzahl(n, "Artikel läuft", "Artikel laufen") + " in den nächsten 30 Tagen ab.")
  }
  if (x.cirs) {
    const n = zahl(x.cirs.ueberfaellig)
    if (n > 0) z.push("CIRS: " + anzahl(n, "Vorgang", "Vorgänge") + " überfällig.")
  }
  if (!z.length) return null
  return { titel: "Responda: Wochenüberblick", text: z.join("\n"), url: "/hub", tag: "woche" }
}

function textProbe() {
  return { titel: "Responda: Probe", text: "So sehen Benachrichtigungen auf diesem Gerät aus.", url: "/benachrichtigungen", tag: "probe" }
}

/**
 * Mehrere Einträge einer Person als eine Nachricht. eintraege: [{ titel, text, url, tag, anlass }]
 * schon gebaut; grund "ruhe" oder "drossel"; ueberlaufN = Zahl aus dem Überlauf-Eintrag.
 * Ein Eintrag ohne Überlauf: unverändert.
 */
function buendeln(eintraege, grund, zeitMs, ueberlaufN) {
  const l = Array.isArray(eintraege) ? eintraege : []
  const extra = Math.max(0, Math.floor(Number(ueberlaufN) || 0))
  if (l.length === 1 && !extra) {
    const e = l[0]
    return { titel: e.titel, text: e.text, url: e.url, tag: e.tag, anlass: e.anlass }
  }
  const gesamt = l.length + extra
  const titel = grund === "drossel" ? gesamt + " Benachrichtigungen zusammengefasst" : "Aus der Ruhezeit: " + gesamt + " Benachrichtigungen"
  const zeilen = l.slice(0, 4).map((e) => kuerzen(e.titel, 70))
  if (gesamt > zeilen.length) zeilen.push("und " + (gesamt - zeilen.length) + " weitere")
  let url = l.length ? l[0].url : "/hub"
  for (const e of l) if (e.url !== url) url = "/hub"
  return { titel: titel, text: kuerzen(zeilen.join("\n"), GRENZEN.text, { zeilen: 5 }), url: urlSicher(url), tag: "buendel:" + Math.floor(Number(zeitMs) || 0), anlass: "buendel" }
}

/**
 * Nur Pfade der App: "/" + [A-Za-z0-9/_-?=&.%:]*, nicht "//", kein "\"; sonst "/hub".
 * Gleiche Fassung in src/lib/push/geraet.ts und public/sw-push.js (Dreiwege-Prüfung).
 */
function urlSicher(url) {
  if (typeof url !== "string") return "/hub"
  if (!/^\/[A-Za-z0-9\/_\-?=&.%:]*$/.test(url)) return "/hub"
  if (url.indexOf("//") === 0 || url.indexOf("\\") >= 0) return "/hub"
  return url
}

/** Bytes in UTF-8 (einzelne Ersatzzeichen zählen wie U+FFFD). */
function utf8Laenge(s) {
  const t = String(s)
  let n = 0
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i)
    if (c < 0x80) n += 1
    else if (c < 0x800) n += 2
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < t.length && t.charCodeAt(i + 1) >= 0xdc00 && t.charCodeAt(i + 1) <= 0xdfff) { n += 4; i++ }
    else n += 3
  }
  return n
}

/** Payload für das Gerät (1.3): kürzt erst den Text, dann den Titel, bis das JSON höchstens 2000 Bytes hat. Nie Feld "f". */
function payloadBauen(o) {
  let textMax = GRENZEN.text
  let titelMax = GRENZEN.titel
  const bau = () => ({
    v: 1,
    titel: kuerzen(o.titel, titelMax) || "Responda",
    text: kuerzen(o.text, textMax, { zeilen: 5 }),
    url: urlSicher(o.url),
    tag: String(o.tag || "responda").replace(/[^A-Za-z0-9:_-]/g, "").slice(0, GRENZEN.tag) || "responda",
    anlass: String(o.anlass || "").replace(/[^a-z_]/g, "").slice(0, 40),
    fuer: String(o.fuer || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40),
    zeit: new Date(Number.isFinite(o.zeitMs) ? o.zeitMs : 0).toISOString(),
  })
  let p = bau()
  for (let i = 0; i < 40 && utf8Laenge(JSON.stringify(p)) > GRENZEN.payloadBytes; i++) {
    if (textMax > 20) textMax = Math.floor(textMax * 0.8)
    else if (titelMax > 20) titelMax = Math.floor(titelMax * 0.8)
    else break
    p = bau()
  }
  return p
}

function istZustandsTag(tag) {
  const t = String(tag || "")
  for (const z of ZUSTAND_TAGS) {
    if (z.charAt(z.length - 1) === ":" ? t.indexOf(z) === 0 && t.length > z.length : t === z) return true
  }
  return false
}

/** Topic nur für Zustände: erste 32 Zeichen von hs256(userId + ":" + tag, geheimnis); sonst null. */
function topicBauen(hs256, geheimnis, userId, tag) {
  if (!istZustandsTag(tag)) return null
  return String(hs256(String(userId) + ":" + String(tag), String(geheimnis))).slice(0, 32)
}

/** Eintragsschlüssel (3.2): erste 32 Hex-Zeichen von sha256(anlass:ereignisKennung:userId). */
function eintragSchluessel(sha256, anlassKey, ereignisKennung, userId) {
  return String(sha256(String(anlassKey) + ":" + String(ereignisKennung) + ":" + String(userId))).slice(0, 32)
}

function nachrichtSchluessel(eintrag, geraetId) {
  return String(eintrag) + ":" + String(geraetId)
}

function buendelSchluessel(sha256, schluessel, userId) {
  const l = (Array.isArray(schluessel) ? schluessel : []).map(String).sort()
  return String(sha256("buendel:" + String(userId) + ":" + l.join(","))).slice(0, 32)
}

// ── Abos (1.1) ──────────────────────────────────────────────────────────────

function hostErlaubt(host, testHosts) {
  const h = String(host || "")
  if (!h) return false
  for (const e of HOSTS) {
    if (e.charAt(0) === ".") { if (h.length > e.length && h.slice(h.length - e.length) === e) return true }
    else if (h === e) return true
  }
  const t = Array.isArray(testHosts) ? testHosts : []
  return t.indexOf(h) >= 0
}

function schluesselOhneGleich(x) {
  return typeof x === "string" ? x.replace(/={1,2}$/, "") : ""
}

/** Abo prüfen. testHosts nur im Prüfbetrieb (Liste "127.0.0.1:<port>"). { ok:true, abo, host } | { ok:false, feld }. */
function aboPruefen(abo, testHosts) {
  const a = istObjekt(abo) ? abo : {}
  const e = a.endpoint
  if (typeof e !== "string" || !e || e.length > 1000) return { ok: false, feld: "endpoint" }
  let host = ""
  const t = Array.isArray(testHosts) ? testHosts : []
  const mt = t.length ? ENDPOINT_TEST_RE.exec(e) : null
  if (mt && t.indexOf("127.0.0.1:" + mt[1]) >= 0) host = "127.0.0.1:" + mt[1]
  else {
    const m = ENDPOINT_RE.exec(e)
    if (m && hostErlaubt(m[1], [])) host = m[1]
    else {
      const w = ENDPOINT_WNS_RE.exec(e)
      if (w && hostErlaubt(w[1], [])) host = w[1]
    }
  }
  if (!host) return { ok: false, feld: "endpoint" }
  const k = istObjekt(a.keys) ? a.keys : {}
  const p256dh = schluesselOhneGleich(k.p256dh)
  const auth = schluesselOhneGleich(k.auth)
  if (!P256DH_RE.test(p256dh) || !AUTH_RE.test(auth)) return { ok: false, feld: "keys" }
  return { ok: true, abo: { endpoint: e, keys: { p256dh: p256dh, auth: auth } }, host: host }
}

/** Kurze Bezeichnung eines Geräts: nur [A-Za-z0-9ÄÖÜäöüß ,.()/-], höchstens 80, leer → "Gerät". */
function geraetBezeichnung(roh) {
  const s = String(roh === undefined || roh === null ? "" : roh)
    .replace(LEERRAUM, " ")
    .replace(/[^A-Za-z0-9ÄÖÜäöüß ,.()\/-]/g, "")
    .replace(/ +/g, " ")
    .replace(/^ +| +$/g, "")
    .slice(0, 80)
    .replace(/ +$/, "")
  return s || "Gerät"
}

// ── Lager und Läufe ─────────────────────────────────────────────────────────

function lagerSchluessel(orgId, itemId, locId) {
  return "lager_unter:" + orgId + ":" + itemId + ":" + locId
}

/**
 * Vergleich der Merker (Paare unter Soll) mit den Warnungen: neu = jetzt unter Soll und noch kein
 * Merker (mit `schluessel`), weg = Merker ohne Paar unter Soll.
 */
function lagerDiff(alteSchluessel, warnungen, orgId) {
  const alt = {}
  for (const s of alteSchluessel || []) alt[String(s)] = true
  const jetzt = {}
  const neu = []
  const low = warnungen && Array.isArray(warnungen.low) ? warnungen.low : []
  for (const w of low) {
    const s = lagerSchluessel(orgId, w.item_id, w.location_id)
    if (jetzt[s]) continue
    jetzt[s] = true
    if (!alt[s]) neu.push(Object.assign({}, w, { schluessel: s }))
  }
  const weg = Object.keys(alt).filter((s) => !jetzt[s])
  return { neu: neu, weg: weg }
}

/** Drossel der Routen: festes Fenster { n, ab }. { erlaubt, neu, sekunden }. */
function zaehlen(alt, jetztMs, fensterMs, max) {
  const a = istObjekt(alt) ? alt : null
  const ab = a ? Number(a.ab) : NaN
  if (!a || !Number.isFinite(ab) || ab + fensterMs <= jetztMs || ab > jetztMs + 60000) {
    if (max < 1) return { erlaubt: false, neu: a, sekunden: Math.max(1, Math.ceil(fensterMs / 1000)) }
    return { erlaubt: true, neu: { n: 1, ab: jetztMs }, sekunden: 0 }
  }
  const n = Number(a.n) || 0
  if (n >= max) return { erlaubt: false, neu: a, sekunden: Math.max(1, Math.ceil((ab + fensterMs - jetztMs) / 1000)) }
  return { erlaubt: true, neu: { n: n + 1, ab: ab }, sekunden: 0 }
}

/** Schutzschalter (1.1): Fehler öffnet für 60 s, Erfolg schließt. Wert { aus_bis, fehler, letzter_ok }. */
function schutzschalterNeu(alt, ereignis, jetztMs) {
  const a = istObjekt(alt) ? alt : {}
  const letzter = Number(a.letzter_ok) || 0
  if (ereignis === "ok") return { aus_bis: 0, fehler: 0, letzter_ok: jetztMs }
  if (ereignis === "fehler") return { aus_bis: jetztMs + GRENZEN.schutzschalterMs, fehler: (Number(a.fehler) || 0) + 1, letzter_ok: letzter }
  return { aus_bis: Number(a.aus_bis) || 0, fehler: Number(a.fehler) || 0, letzter_ok: letzter }
}

function schutzschalterOffen(wert, jetztMs) {
  return istObjekt(wert) && Number(wert.aus_bis) > jetztMs
}

/** Takt-Sperre (3.2): nehmen, erneuern, geben, nur mit eigenem Token. { wert, erfolg }. */
function taktSperreNeu(alt, token, jetztMs, art) {
  const a = istObjekt(alt) && alt.token ? alt : null
  const eigen = !!a && a.token === token
  if (art === "nehmen") {
    if (!a || !(Number(a.bis) > jetztMs) || eigen) return { wert: { token: token, bis: jetztMs + GRENZEN.taktSperreMs }, erfolg: true }
    return { wert: a, erfolg: false }
  }
  if (art === "erneuern") {
    if (eigen) return { wert: { token: token, bis: jetztMs + GRENZEN.taktSperreMs }, erfolg: true }
    return { wert: a, erfolg: false }
  }
  if (art === "geben") {
    if (eigen) return { wert: null, erfolg: true }
    return { wert: a, erfolg: false }
  }
  return { wert: a, erfolg: false }
}

module.exports = {
  ANLAESSE, GRUPPEN, RUHE_VORGABE, GRENZEN, TTL_EINHEIT, DRINGLICHKEIT_EINHEIT, ZUSTAND_TAGS, HOSTS,
  ENDPOINT_RE, ENDPOINT_WNS_RE, ENDPOINT_TEST_RE, FORMULAR_MODUL, MODUL_IDS, ENTHAELT, IMMER, KATEGORIEN_CIRS, SCHWERE_TEXT,
  MITTEILUNG_TEXTE,
  anlass, objektLesen,
  istUsers, aktiv, pbZeit, dauerhaft, befristetWieRegel, rechtWieRegel, rechtAktiv, modulFrei,
  darfAnlass, darfAnlassGrundsaetzlich, darfOrganisation, mitteilungRolle, mitteilungPruefen, mitteilungDrossel, dauerText,
  personEinstellungenLesen, personEinstellungenMischen, orgEinstellungenLesen, anlassAn, empfaengerFiltern,
  berlinOffsetMinuten, berlinTeile, berlinZuUtc, tagPlus, zeitLesen, zeitText, inRuhe, ruheEnde, ruheText, zustellart, drossel, laeufeFaellig,
  datumKurz, tagText, kuerzen, nameKurz, grundAusEreignis,
  textMitteilung, textUnterschrift, textProtokollNeu, textMpgGesperrt, textMpgFristen, textMpgDefekt, textLagerUnter,
  textLagerAbgelaufen, textProduktausgabe, textEinsendung, textCirsNeu, textAusbildung, WOCHE_ANLASS, wocheZeilen, textWoche, textProbe,
  buendeln, urlSicher, utf8Laenge, payloadBauen, istZustandsTag, topicBauen, eintragSchluessel, nachrichtSchluessel, buendelSchluessel,
  hostErlaubt, aboPruefen, geraetBezeichnung,
  lagerSchluessel, lagerDiff, zaehlen, schutzschalterNeu, schutzschalterOffen, taktSperreNeu,
}
