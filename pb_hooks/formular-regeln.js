// Regeln der öffentlichen Formulare: Absender, Besatzung, Drossel, Datenprüfung.
//
// Eine Implementierung für drei Leser:
//   - die Hooks (formular.pb.js, mitglieder-namen.pb.js, doku-frist.pb.js) laden sie per
//     require() im Handler,
//   - vitest (src/lib/__tests__/formularRegeln.test.ts) lädt dieselbe Datei per
//     runInNewContext,
//   - das Vorprüfskript (scripts/formular-vorpruefung.mjs) per node:vm.
//
// CommonJS, keine Seiteneffekte auf oberster Ebene und keine PocketBase-Globale ($app,
// $security, Record …). Wer Datensätze oder die App braucht, bekommt sie übergeben
// (Abschnitt „Mit übergebenen PocketBase-Objekten“ ganz unten).
//
// Vertrag: scratchpad Plan-Formulare-Absender-v2.md, Abschnitte 1 und 2. Texte ohne
// Gedankenstriche (ein Prüffall wacht darüber).

// ── Grundwerte ──────────────────────────────────────────────────────────────

/** Änderungsfrist nach dem Absenden. Zwilling: FRIST_MS in src/pages/public/doku/absenden.ts. */
const FRIST_MS = 24 * 60 * 60 * 1000

const FORMULARE = ["patienten", "produktausgabe", "defektmeldung"]
const MASKEN = ["doku", "alt", "schnell"]

/** Voreinstellung je Formular (PO-Entscheidung 2: Patientendoku sofort mit Passwort). */
const VOREINSTELLUNG = { patienten: "passwort", produktausgabe: "frei", defektmeldung: "frei" }
const MODI = ["passwort", "frei"]

const SAMMLUNG = { patienten: "patients", produktausgabe: "product_outputs", defektmeldung: "mpg_defect_reports" }
const FORMULAR_AUS_SAMMLUNG = { patients: "patienten", product_outputs: "produktausgabe", mpg_defect_reports: "defektmeldung" }
/** Statusfeld je Sammlung (Index für Unterschriften und Obergrenze). */
const STATUSFELD = { patients: "absender_status", product_outputs: "absender_status", mpg_defect_reports: "reporter_status" }

/** Druckfeld des Absendernamens je Maske. */
const DRUCKFELD = { doku: "unterschrift", alt: "ausfueller_name", schnell: "ausfueller_name" }

/** Schlüssel im payload, die nur der Server setzt. `mannschaft` baut besatzungAufloesen neu. */
const SERVER_SCHLUESSEL = ["absender", "frist", "abgesendet", "eingang_sha256", "aenderungen"]

const POSTEN = [
  { pos: "tf", feld: "mannschaft_tf" },
  { pos: "m1", feld: "mannschaft_1" },
  { pos: "m2", feld: "mannschaft_2" },
  { pos: "m3", feld: "mannschaft_3" },
]

const PLATZHALTER_ENDUNG = "@kein-email.intern"

// Module wie in src/lib/freigabe.ts (MODULE). Kommt dort ein Modul dazu, hier ergänzen;
// der Prüffall formularAn gegen formularFrei schlägt sonst an.
const MODUL_IDS = ["benutzer", "einsaetze", "eks", "patienten", "dokumente", "lager", "mpg", "dateien", "lernbar", "ausbildungen", "chat", "notizen"]
const ENTHAELT = { lager: ["dateien", "mpg", "dokumente"] }
const IMMER = ["benutzer"]
const FORMULAR_MODULE = { patienten: "patienten", produktausgabe: "lager", defektmeldung: "mpg", cirs: "dokumente" }

// ── Texte ───────────────────────────────────────────────────────────────────

const TEXTE = {
  organisation: "Diese Organisation gibt es nicht oder sie ist nicht aktiv.",
  formular_aus: "Dieses Formular ist für eure Organisation ausgeschaltet.",
  daten: "Die Angaben sind unvollständig. Bitte prüfen und erneut senden.",
  kennung: "Diese Kennung ist schon vergeben.",
  aenderung_alt: "Diese Angaben gehören zu einem schon abgesendeten Protokoll.",
  name: "Bitte Vor- und Nachnamen vollständig eintragen.",
  name_unbekannt: "Unter diesem Namen ist kein aktives Mitglied eingetragen. Bitte den Namen so eintragen, wie er in Responda steht.",
  name_unbekannt_ausstehend: "Ohne Passwort geht das nur, wenn der Name genau zu einem Mitglied passt. Bitte den Namen so eintragen, wie er in Responda steht, oder mit Passwort senden.",
  passwort_noetig: "Bitte bestätige mit deinem Passwort.",
  passwort_falsch: "Das Passwort stimmt nicht. Noch {n} Versuche, dann ist die Bestätigung 15 Minuten gesperrt.",
  passwort_falsch_1: "Das Passwort stimmt nicht. Noch ein Versuch, dann ist die Bestätigung 15 Minuten gesperrt.",
  gesperrt: "Zu viele falsche Passwörter. Bitte in {m} erneut versuchen.",
  drossel: "Gerade kommen sehr viele Anfragen. Bitte in {m} erneut versuchen.",
  nicht_angemeldet: "Bitte melde dich an.",
  nicht_berechtigt: "Dafür fehlt dir das Recht.",
  nicht_gefunden: "Diesen Eintrag gibt es nicht.",
  fremd: "Dieser Eintrag wartet auf die Unterschrift einer anderen Person.",
  schon_bestaetigt: "Dieser Eintrag wartet nicht mehr auf eine Unterschrift.",
  server: "Das hat gerade nicht geklappt. Bitte erneut versuchen.",
}

/** Genauere Texte zu 400 `daten`, je `feld`. */
const DATEN_TEXTE = {
  formular: TEXTE.daten,
  maske: TEXTE.daten,
  id: TEXTE.daten,
  payload: TEXTE.daten,
  daten: TEXTE.daten,
  name: TEXTE.daten,
  absender: "Bitte einen Namen eintragen.",
  einsatz: "Bitte den Einsatz angeben.",
  datum: "Bitte ein gültiges Datum angeben.",
  positionen: "Bitte mindestens einen Artikel mit Menge angeben.",
  positionen_fremd: "Ein Artikel gehört nicht zu eurer Organisation.",
  lager_id: "Dieser Verbrauchsort gehört nicht zu eurer Organisation.",
  device_id: "Dieses Gerät gehört nicht zu eurer Organisation.",
  device_id_ausser_betrieb: "Dieses Gerät ist außer Betrieb genommen.",
  description: "Bitte den Defekt beschreiben.",
  grund: "Bitte einen Grund angeben, mindestens 10 Zeichen.",
  speichern: "Die Angaben ließen sich nicht speichern. Bitte prüfen und erneut senden.",
}

/** Texte der Hooks bei direkten API-Aufrufen (dort per throw). */
const HOOK_TEXTE = {
  alte_fassung: "Diese Fassung der App kann nicht mehr absenden. Bitte zuerst den Entwurf speichern, dann die App neu öffnen.",
  org_fehlt: "Organisation fehlt.",
  formular_aus: TEXTE.formular_aus,
  wartet: "Das Protokoll wartet noch auf die Unterschrift des Absenders. Ändern geht erst danach.",
  bestaetigt: "Dieses Protokoll ist bestätigt. Ändern geht nur angemeldet, in Unitas über „Bearbeiten“.",
  name_doppelt: "In eurer Organisation gibt es schon ein aktives Mitglied mit diesem Namen. Bitte den Namen unterscheidbar machen, etwa mit dem zweiten Vornamen.",
  name_schrift: "Bitte den Namen in einer Schrift schreiben, ohne Buchstaben aus anderen Alphabeten.",
  abgeschlossen: "Dieses Protokoll ist abgeschlossen oder seine Frist ist abgelaufen. Ändern geht nur angemeldet.",
  drossel: "Gerade kommen sehr viele Anfragen. Bitte in einer Minute erneut versuchen.",
}

/** „{m} Minuten“ aus Sekunden, aufgerundet, mindestens eine; bei 1 „einer Minute“. */
function minutenText(sekunden) {
  const m = Math.max(1, Math.ceil((Number(sekunden) || 0) / 60))
  return m === 1 ? "einer Minute" : m + " Minuten"
}

/** Der Text zu einem Grund, mit `sekunden` (gesperrt, drossel) bzw. `versuche_uebrig` (passwort_falsch). */
function meldung(grund, zusatz) {
  const z = zusatz || {}
  if (grund === "passwort_falsch") {
    const n = Number(z.versuche_uebrig)
    return n === 1 ? TEXTE.passwort_falsch_1 : TEXTE.passwort_falsch.replace("{n}", String(n))
  }
  if (grund === "gesperrt" || grund === "drossel") return TEXTE[grund].replace("{m}", minutenText(z.sekunden))
  if (grund === "daten" && z.feld && DATEN_TEXTE[z.feld]) return DATEN_TEXTE[z.feld]
  return TEXTE[grund] || TEXTE.server
}

// ── Namen ───────────────────────────────────────────────────────────────────

// Ausdrückliche Zeichenklassen statt \s und \p{…} (beides verhält sich in PocketBase
// anders oder fehlt). Geprüft auf 0.28.4 und 0.40.5 gegen Node (Gleichlauf-Hook).
//
// Unsichtbar: weiche Trennung, Nullbreiten, Richtungszeichen (LRM, RLM, Einbettungen,
// Isolates), unsichtbare Operatoren, Füller (Hangul, Khmer, Mongolisch), Variantenwähler,
// Tags. Sie verschwinden ganz, auch aus dem gespeicherten Namen (sonst sähe „Anna Berg“ mit
// angehängtem LRM aus wie Anna Berg und wäre doch ein anderer Name).
const UNSICHTBAR = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF9-\uFFFB]|\uDB40[\uDC00-\uDDEF]|\uD82F[\uDCA0-\uDCA3]/g
const APOSTROPHE = /[\u2018\u2019\u02BC\u00B4`]/g
const STRICHE = /[\u2010-\u2015\u2212]/g
const LEERRAUM = /[ \t\n\r\f\v\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g
const AKZENTE = /[\u0300-\u036F]/g

// Buchstaben anderer Schriften, die wie lateinische aussehen (Auszug aus den Verwechslern nach
// Unicode UTS 39: Kyrillisch, Griechisch, Armenisch, Lisu und lateinische Sonderformen).
// normName bildet sie auf das lateinische Gegenstück ab: „Аnna Berg“ mit kyrillischem А ist
// derselbe Name wie „Anna Berg“, der Namens-Hook weist ihn deshalb als doppelt ab.
const VERWECHSLER = {
  // Kyrillisch
  "\u0410": "A", "\u0412": "B", "\u0415": "E", "\u041A": "K", "\u041C": "M", "\u041D": "H", "\u041E": "O", "\u0420": "P",
  "\u0421": "C", "\u0422": "T", "\u0423": "Y", "\u0425": "X", "\u0405": "S", "\u0406": "I", "\u0408": "J", "\u04AE": "Y",
  "\u04C0": "I", "\u051A": "Q", "\u051C": "W", "\u0474": "V",
  "\u0430": "a", "\u0435": "e", "\u043E": "o", "\u0440": "p", "\u0441": "c", "\u0443": "y", "\u0445": "x", "\u0455": "s",
  "\u0456": "i", "\u0458": "j", "\u04BB": "h", "\u0501": "d", "\u051B": "q", "\u051D": "w", "\u04AF": "y", "\u04CF": "l",
  "\u0475": "v",
  // Griechisch
  "\u0391": "A", "\u0392": "B", "\u0395": "E", "\u0396": "Z", "\u0397": "H", "\u0399": "I", "\u039A": "K", "\u039C": "M",
  "\u039D": "N", "\u039F": "O", "\u03A1": "P", "\u03A4": "T", "\u03A5": "Y", "\u03A7": "X", "\u03F9": "C", "\u037F": "J",
  "\u03BF": "o", "\u03BD": "v", "\u03B9": "i", "\u03C1": "p", "\u03B1": "a", "\u03F2": "c", "\u03F3": "j",
  // Armenisch
  "\u0555": "O", "\u054D": "U", "\u053C": "L", "\u0585": "o", "\u057D": "u", "\u0578": "n", "\u0570": "h", "\u0566": "q",
  // Lisu (nur Großbuchstaben-Formen)
  "\uA4D0": "B", "\uA4D1": "P", "\uA4D3": "D", "\uA4D4": "T", "\uA4D6": "G", "\uA4D7": "K", "\uA4D9": "J", "\uA4DA": "C",
  "\uA4DC": "Z", "\uA4DD": "F", "\uA4DF": "M", "\uA4E0": "N", "\uA4E1": "L", "\uA4E2": "S", "\uA4E3": "R", "\uA4E6": "V",
  "\uA4E7": "H", "\uA4EA": "W", "\uA4EB": "X", "\uA4EC": "Y", "\uA4EE": "A", "\uA4F0": "E", "\uA4F2": "I", "\uA4F3": "O",
  "\uA4F4": "U",
  // Lateinische Sonderformen
  "\u0251": "a", "\u0261": "g", "\u0131": "i", "\u0237": "j", "\u0269": "i",
}
const VERWECHSLER_RE = new RegExp("[" + Object.keys(VERWECHSLER).join("") + "]", "g")

/**
 * Bereinigt einen Namen: Unicode NFKC (Vollbreite, Ligaturen, mathematische Buchstaben
 * werden normale Zeichen), unsichtbare Zeichen raus, Apostrophe, Striche und Leerraum
 * vereinheitlicht.
 */
function vorbereiten(x) {
  return String(x === undefined || x === null ? "" : x)
    .normalize("NFKC")
    .replace(UNSICHTBAR, "")
    .replace(APOSTROPHE, "'")
    .replace(STRICHE, "-")
    .replace(LEERRAUM, " ")
    .trim()
}

/** Verwechselbare Buchstaben anderer Schriften als lateinische (zerlegt, damit auch „ӧ“ zu „ö“ wird). */
function skelett(s) {
  return s.normalize("NFD").replace(VERWECHSLER_RE, (c) => VERWECHSLER[c]).normalize("NFC")
}

/** Vergleichsform eines Namens (2.2): „Berg, Anna“ = „anna berg“ = „ANNA  BERG“, Jörg = Joerg. */
function normName(x) {
  let s = skelett(vorbereiten(x))
  // Genau ein Komma mit Teilen links und rechts: „Berg, Anna“ → „Anna Berg“
  const teile = s.split(",")
  if (teile.length === 2 && teile[0].trim() && teile[1].trim()) s = teile[1].trim() + " " + teile[0].trim()
  else s = s.replace(/,/g, " ")
  s = s.replace(/ +/g, " ").trim().replace(/ ?- ?/g, "-")
  s = s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  return s.normalize("NFD").replace(AKZENTE, "").normalize("NFC")
}

function buchstabeOderZiffer(c) {
  if (c >= "0" && c <= "9") return true
  if (c.toLowerCase() !== c.toUpperCase()) return true
  // Schriften ohne Groß/klein (etwa CJK) zählen als Buchstaben
  return c.charCodeAt(0) >= 0x2e80
}

/** Vor- und Nachname: mindestens zwei Teile, zusammen mindestens 4 Buchstaben oder Ziffern. */
function nameVollstaendig(x) {
  const n = normName(x)
  const teile = n.split(" ").filter(Boolean)
  if (teile.length < 2) return false
  let zahl = 0
  for (const c of n) if (buchstabeOderZiffer(c)) zahl++
  return zahl >= 4
}

/** Schrift eines Zeichens für schriftGemischt; null bei Ziffern, Satzzeichen, Leerraum, Akzenten. */
function schrift(c) {
  const z = c.charCodeAt(0)
  if (z < 0x80) return /[A-Za-z]/.test(c) ? "latein" : null
  if ((z >= 0xc0 && z <= 0x24f && z !== 0xd7 && z !== 0xf7) || (z >= 0x250 && z <= 0x2af) || (z >= 0x1d00 && z <= 0x1dbf) ||
    (z >= 0x1e00 && z <= 0x1eff) || (z >= 0x2c60 && z <= 0x2c7f) || (z >= 0xa720 && z <= 0xa7ff) || (z >= 0xab30 && z <= 0xab6f)) return "latein"
  if (z < 0xc0 || (z >= 0x2b0 && z <= 0x36f) || (z >= 0x2000 && z <= 0x2bff) || (z >= 0x3000 && z <= 0x303f) || (z >= 0xfe10 && z <= 0xfe6f)) return null
  if ((z >= 0x370 && z <= 0x3ff) || (z >= 0x1f00 && z <= 0x1fff)) return "griechisch"
  if ((z >= 0x400 && z <= 0x52f) || (z >= 0x1c80 && z <= 0x1c8f) || (z >= 0x2de0 && z <= 0x2dff) || (z >= 0xa640 && z <= 0xa69f)) return "kyrillisch"
  if ((z >= 0x590 && z <= 0x5ff) || (z >= 0xfb1d && z <= 0xfb4f)) return "hebraeisch"
  if ((z >= 0x600 && z <= 0x6ff) || (z >= 0x750 && z <= 0x77f) || (z >= 0x8a0 && z <= 0x8ff) || (z >= 0xfb50 && z <= 0xfdff) || (z >= 0xfe70 && z <= 0xfeff)) return "arabisch"
  if ((z >= 0x1100 && z <= 0x11ff) || (z >= 0x3130 && z <= 0x318f) || (z >= 0xac00 && z <= 0xd7af)) return "hangul"
  // Japanisch mischt Kanji und Kana in einem Namen: eine Schrift
  if ((z >= 0x3040 && z <= 0x30ff) || (z >= 0x3400 && z <= 0x4dbf) || (z >= 0x4e00 && z <= 0x9fff) || (z >= 0xf900 && z <= 0xfaff)) return "cjk"
  // Sonst grob je Block von 256 Zeichen; Ersatzpaare (Ebene 1 und höher) zählen als eine Schrift
  if (z >= 0xd800 && z <= 0xdfff) return "ebene1"
  return "andere:" + (z >> 8)
}

/**
 * Mischt der Name Schriften (etwa lateinisch und kyrillisch)? Echte Namen stehen in einer
 * Schrift; gemischte sind fast immer Verwechsler („Аnna Berg“ mit kyrillischem А). Der
 * Namens-Hook weist sie ab.
 */
function schriftGemischt(x) {
  const s = vorbereiten(x).normalize("NFD")
  let erste = null
  for (let i = 0; i < s.length; i++) {
    const sch = schrift(s.charAt(i))
    if (!sch) continue
    if (erste === null) erste = sch
    else if (sch !== erste) return true
  }
  return false
}

/** So wird ein nicht verknüpfter Name gespeichert: bereinigt, Schreibweise bleibt, höchstens 120 Zeichen. */
function anzeigeName(x) {
  return vorbereiten(x).replace(/ +/g, " ").slice(0, 120).trim()
}

/** Kontoname eines Mitglieds, wie er im Datensatz steht. */
function kontoName(m) {
  return String((m && m.name) || "").trim()
}

// ── Rechte (2.4) ────────────────────────────────────────────────────────────

function ms(jetzt) {
  if (typeof jetzt === "number") return jetzt
  // Kein instanceof: ein Date aus einem anderen Kontext (vitest, vm) zählt auch
  if (jetzt && typeof jetzt.getTime === "function") return jetzt.getTime()
  return Date.now()
}

function zeitpunkt(text) {
  const t = Date.parse(String(text || "").trim().replace(" ", "T"))
  return Number.isFinite(t) ? t : NaN
}

function istUsers(u) {
  return !!u && (u.sammlung === undefined || u.sammlung === "users")
}

/** Nicht gesperrt und nicht abgelaufen. Ein unlesbares Ablaufdatum gilt als abgelaufen. */
function aktiv(u, jetzt) {
  if (!u || u.disabled === true) return false
  const bis = u.expires_at
  if (bis === undefined || bis === null || String(bis).trim() === "") return true
  return zeitpunkt(bis) > ms(jetzt)
}

/** Recht dauerhaft (`permissions[recht] === true`) oder befristet und noch gültig (beide Datumsformate). */
function rechtAktiv(u, recht, jetzt) {
  if (!u) return false
  const p = u.permissions && typeof u.permissions === "object" ? u.permissions : {}
  if (p[recht] === true) return true
  const t = u.temp_permissions && typeof u.temp_permissions === "object" ? u.temp_permissions : {}
  const bis = t[recht] && typeof t[recht] === "object" ? t[recht].until : ""
  return !!bis && zeitpunkt(bis) > ms(jetzt)
}

/** Wer als Absender, Besatzung oder Ziel einer Unterschrift in Frage kommt (Festlegung 1). */
function istVerknuepfbar(u, orgId, jetzt) {
  return istUsers(u) && !!orgId && u.organization_id === orgId && aktiv(u, jetzt) && u.role !== "teilnehmer" && u.supervisor !== true
}

/** Das Token-Konto, wenn es als Mitglied dieser Org zählt, sonst null (Fall 1 nur mit Mitglieds-Token). */
function mitgliedAusToken(person, orgId, jetzt) {
  return person && person.sammlung === "users" && istVerknuepfbar(person, orgId, jetzt) ? person : null
}

/** Darf ändern (Änderungsregeln 1.11): aktiv, kein Teilnehmer, Supervisor oder eigene Org. */
function darfAendern(u, orgId, jetzt) {
  return istUsers(u) && aktiv(u, jetzt) && u.role !== "teilnehmer" && (u.supervisor === true || (!!orgId && u.organization_id === orgId))
}

/** Darf diese Person den ausstehenden Eintrag unterschreiben? */
function darfUnterschreiben(absender, person, orgId, jetzt) {
  if (!absender || absender.status !== "ausstehend") return false
  // „Das war ich nicht“: wer zurückgewiesen hat, unterschreibt nicht mehr (die Leitung schließt ab)
  if (absender.zurueckgewiesen) return false
  const id = String(absender.id || "")
  return id !== "" && !!person && person.id === id && istVerknuepfbar(person, orgId, jetzt)
}

/** Notausgang „Ohne Unterschrift abschließen“: Leitung oder Recht `patienten` (auch befristet), Supervisor. */
function darfOhneUnterschrift(u, orgId, jetzt) {
  if (!istUsers(u) || !aktiv(u, jetzt) || u.role === "teilnehmer") return false
  if (u.supervisor === true) return true
  return !!orgId && u.organization_id === orgId && (u.role === "admin" || rechtAktiv(u, "patienten", jetzt))
}

/** Wie die Update-Regel von organizations: Supervisor, Leitung, Benutzerverwaltung, Vorgänge. */
function darfFormulareEinstellen(u, jetzt) {
  if (!istUsers(u) || !aktiv(u, jetzt)) return false
  return u.supervisor === true || u.role === "admin" || rechtAktiv(u, "unitarii", jetzt) || rechtAktiv(u, "dokumente", jetzt)
}

/** Alle verknüpfbaren Mitglieder mit genau diesem Namen (nach normName), nach Kennung aufsteigend. */
function treffer(mitglieder, name, orgId, jetzt) {
  if (!nameVollstaendig(name)) return []
  const n = normName(name)
  return (mitglieder || [])
    .filter((m) => istVerknuepfbar(m, orgId, jetzt) && normName(m.name) === n)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

// ── Einstellung und Module ─────────────────────────────────────────────────

function istObjekt(x) {
  return !!x && typeof x === "object" && !Array.isArray(x)
}

/** form_config als Objekt, auch aus Text oder doppelt kodiertem Text; Kaputtes → {}. */
function formConfigLesen(roh) {
  let x = roh
  for (let i = 0; i < 2 && typeof x === "string"; i++) {
    try { x = JSON.parse(x) } catch (err) { return {} }
  }
  return istObjekt(x) ? x : {}
}

/** Modus je Formular aus form_config.absender; sonst die Voreinstellung (unbekanntes Formular: frei). */
function absenderModus(cfg, formular) {
  const a = formConfigLesen(cfg).absender
  const wert = istObjekt(a) ? a[formular] : undefined
  if (MODI.indexOf(wert) >= 0) return wert
  return VOREINSTELLUNG[formular] || "frei"
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

/** Formular an = sein Modul ist frei (wie formularFrei in src/lib/freigabe.ts). */
function formularAn(org, formular) {
  const m = FORMULAR_MODULE[formular]
  return !m || modulFrei(org, m)
}

/** Öffentlich = an und nicht in form_config.hidden_forms. */
function formularOeffentlich(org, formular) {
  if (!formularAn(org, formular)) return false
  const aus = formConfigLesen(org && org.form_config).hidden_forms
  return !(Array.isArray(aus) && aus.indexOf(formular) >= 0)
}

// ── payload ─────────────────────────────────────────────────────────────────

/** payload als Objekt, auch aus Text oder doppelt kodiert; sonst null. */
function payloadLesen(x) {
  let p = x
  for (let i = 0; i < 2 && typeof p === "string"; i++) {
    try { p = JSON.parse(p) } catch (err) { return null }
  }
  return istObjekt(p) ? p : null
}

function wartetAufUnterschrift(payload) {
  const p = payloadLesen(payload)
  return !!(p && istObjekt(p.absender) && p.absender.status === "ausstehend")
}

function flach(x) {
  return JSON.parse(JSON.stringify(x === undefined ? null : x))
}

function ohneServerSchluessel(p) {
  const aus = {}
  for (const k of Object.keys(p || {})) if (SERVER_SCHLUESSEL.indexOf(k) < 0) aus[k] = p[k]
  return aus
}

/** Welche Maske ein direkt angelegtes Protokoll gefüllt hat (Druckfeld des Absenders). */
function maskeAusPayload(p) {
  if (p && p.schnelldoku === true) return "schnell"
  // Die alte Maske setzt auch protokoll_version 2, schreibt den Namen aber immer (auch leer)
  // in ausfueller_name; die neue Doku kennt dieses Feld nicht.
  if (p && typeof p.ausfueller_name === "string" && !voll(p.unterschrift)) return "alt"
  if (p && Number(p.protokoll_version) === 2) return "doku"
  return "alt"
}

function voll(x) {
  return typeof x === "string" && x.trim() !== ""
}

/**
 * Das Druckfeld, in dem der Name jetzt steht: das gespeicherte, außer es ist leer und das
 * andere (unterschrift bzw. ausfueller_name) gefüllt (Sätze, die vor der Erkennung der alten
 * Maske angelegt wurden).
 */
function druckfeldIn(p, feld) {
  const anderes = feld === "unterschrift" ? "ausfueller_name" : feld === "ausfueller_name" ? "unterschrift" : ""
  if (p && anderes && !voll(p[feld]) && voll(p[anderes])) return anderes
  return feld
}

/** JSON mit rekursiv sortierten Schlüsseln, Listen in Reihenfolge, undefined weggelassen. */
function kanonisch(x) {
  if (x === undefined || typeof x === "function") return undefined
  if (x === null || typeof x !== "object") return JSON.stringify(x)
  if (Array.isArray(x)) {
    return "[" + x.map((v) => { const k = kanonisch(v); return k === undefined ? "null" : k }).join(",") + "]"
  }
  const teile = []
  for (const k of Object.keys(x).sort()) {
    const v = kanonisch(x[k])
    if (v !== undefined) teile.push(JSON.stringify(k) + ":" + v)
  }
  return "{" + teile.join(",") + "}"
}

// ── Besatzung (2.5) ─────────────────────────────────────────────────────────

function nestEintrag(p, pos) {
  const m = p && istObjekt(p.mannschaft) ? p.mannschaft : null
  const e = m ? m[pos] : null
  return istObjekt(e) ? e : null
}

/**
 * Name eines Postens. Wie besatzungLesen in der App: Ein leeres flaches Feld heißt „nicht
 * angegeben“, dann gilt der verschachtelte Name. Geräumt ist ein Posten erst, wenn beide leer
 * sind (besatzungSetzen räumt beide). Sonst löschte ein vorbelegtes leeres Feld (EMPTY_PAYLOAD
 * der Patientenverwaltung) die Besatzung alter Protokolle, die sie nur verschachtelt führen.
 */
function postenName(p, posten) {
  if (!p) return ""
  const flachName = typeof p[posten.feld] === "string" ? anzeigeName(p[posten.feld]) : ""
  if (flachName) return flachName
  const e = nestEintrag(p, posten.pos)
  return e ? anzeigeName(e.name) : ""
}

/**
 * Die Besatzung auflösen: flache Namen (Bogen) und verschachtelte Kennungen (Unitas).
 * `o = { orgId, mitglied, ausstehend, jetzt }`; `alt` = payload des Originals oder null.
 * Gibt eine Kopie von `neu` zurück, `mannschaft` neu gebaut.
 */
function besatzungAufloesen(neu, alt, mitglieder, o) {
  const opt = o || {}
  const aus = Object.assign({}, neu || {})
  const mannschaft = {}
  for (const posten of POSTEN) {
    const nameN = postenName(neu, posten)
    if (!nameN) { aus[posten.feld] = ""; mannschaft[posten.pos] = null; continue }
    if (opt.ausstehend) { aus[posten.feld] = nameN; mannschaft[posten.pos] = null; continue }
    // Kennung aus einer angemeldeten Anfrage (Wahl der Leitung): nur passend zu einem verknüpfbaren Mitglied
    const nestN = nestEintrag(neu, posten.pos)
    if (opt.mitglied && nestN && typeof nestN.id === "string" && nestN.id !== "" && normName(nestN.name) === normName(nameN)) {
      const m = (mitglieder || []).find((x) => x.id === nestN.id)
      if (m && istVerknuepfbar(m, opt.orgId, opt.jetzt)) {
        aus[posten.feld] = kontoName(m)
        mannschaft[posten.pos] = { id: m.id, name: kontoName(m) }
        continue
      }
    }
    // Unveränderter Name behält seine Verknüpfung
    if (alt) {
      const nameO = postenName(alt, posten)
      const nestO = nestEintrag(alt, posten.pos)
      const idO = nestO && typeof nestO.id === "string" ? nestO.id : ""
      if (idO && nameO && normName(nameN) === normName(nameO)) {
        aus[posten.feld] = nameO
        mannschaft[posten.pos] = { id: idO, name: nameO }
        continue
      }
    }
    const t = treffer(mitglieder, nameN, opt.orgId, opt.jetzt)
    if (t.length === 1) {
      aus[posten.feld] = kontoName(t[0])
      mannschaft[posten.pos] = { id: t[0].id, name: kontoName(t[0]) }
    } else {
      aus[posten.feld] = nameN
      mannschaft[posten.pos] = null
    }
  }
  aus.mannschaft = mannschaft
  return aus
}

// ── Absender (1.5) ─────────────────────────────────────────────────────────

function fehler(status, grund, zusatz) {
  return Object.assign({ art: "fehler", status: status, grund: grund }, zusatz || {})
}

/**
 * Wer ist Absender? Reine Entscheidung nach der Tabelle in 1.5.
 * k = { modus, mitglied (Token-Person oder null), name, passwort (bool, mitgeschickt),
 *       ausstehend (bool), treffer (Liste), feldVorhanden (bool), passwortTreffer }
 * passwortTreffer: undefined = noch nicht geprüft, null = keiner passt, sonst das Mitglied.
 * Ergebnis: { art: "anlegen", status, person, weg, name } | { art: "passwort_pruefen", kandidaten }
 *         | { art: "fehler", status, grund, feld?, text? }
 */
function absenderEntscheiden(k) {
  const t = k.treffer || []
  // 1: angemeldet
  if (k.mitglied) return { art: "anlegen", status: "bestaetigt", person: k.mitglied, weg: "anmeldung", name: kontoName(k.mitglied) }
  const name = anzeigeName(k.name)
  if (k.modus === "frei") {
    if (name.length < 2) return fehler(400, "daten", { feld: "absender" })
    if (t.length === 1) return { art: "anlegen", status: "nicht_bestaetigt", person: t[0], weg: "", name: kontoName(t[0]) }
    return { art: "anlegen", status: "ohne_konto", person: null, weg: "", name: name }
  }
  const nurAusstehend = !!k.ausstehend && !k.passwort
  // 4, 5, 12
  if (!nameVollstaendig(name)) return fehler(400, "name")
  if (t.length === 0) return fehler(400, "name_unbekannt", nurAusstehend ? { text: TEXTE.name_unbekannt_ausstehend } : {})
  if (nurAusstehend && !k.feldVorhanden) return fehler(403, "passwort_noetig")
  // 2, 3
  if (k.passwort) {
    if (k.passwortTreffer === undefined) return { art: "passwort_pruefen", kandidaten: t }
    if (k.passwortTreffer) return { art: "anlegen", status: "bestaetigt", person: k.passwortTreffer, weg: "passwort", name: kontoName(k.passwortTreffer) }
    return fehler(401, "passwort_falsch")
  }
  // 6, 7
  if (k.ausstehend) {
    if (t.length === 1) return { art: "anlegen", status: "ausstehend", person: t[0], weg: "", name: kontoName(t[0]) }
    return fehler(400, "name_unbekannt", { text: TEXTE.name_unbekannt_ausstehend })
  }
  // 8
  return fehler(403, "passwort_noetig")
}

/** Der Eintrag `absender` aus einer Entscheidung. */
function absenderEintrag(ent, modus, jetztIso) {
  return {
    id: ent.person ? ent.person.id : "",
    name: ent.name,
    status: ent.status,
    weg: ent.weg,
    modus: modus,
    am: ent.status === "bestaetigt" ? jetztIso : "",
  }
}

/** Ist der Absender mit einem Konto verknüpft (bestätigt, nicht bestätigt, ausstehend)? */
function verknuepft(absender) {
  return !!absender && !!absender.id && ["bestaetigt", "nicht_bestaetigt", "ausstehend"].indexOf(absender.status) >= 0
}

/**
 * Frist eines Patientenprotokolls (ISO) nach dem Status des Absenders.
 * Ausstehend: keine (beginnt mit dem Unterschreiben); ohne Unterschrift abgeschlossen: keine.
 * Abweichung vom Plan 1.13 (dort nur „bestätigt“): auch nicht bestätigte und Sätze ohne
 * Konto (Modus frei) bekommen die Frist, sonst schlösse der Frist-Lauf sie nie ab.
 */
function fristFuer(status, eingangMs) {
  if (status === "ausstehend" || status === "ohne_unterschrift") return ""
  return new Date(eingangMs + FRIST_MS).toISOString()
}

/**
 * payload eines Patientenprotokolls, wie der Server es speichert (1.13).
 * o = { maske, absender, eingangMs, pruefsumme, mitglieder, orgId, mitglied, jetzt }
 */
function patientenPayload(payload, o) {
  const roh = ohneServerSchluessel(payloadLesen(payload) || {})
  const p = besatzungAufloesen(roh, null, o.mitglieder, { orgId: o.orgId, mitglied: !!o.mitglied, ausstehend: o.absender.status === "ausstehend", jetzt: o.jetzt })
  const feld = DRUCKFELD[o.maske] || DRUCKFELD.alt
  const absender = Object.assign({}, o.absender, { feld: feld })
  if (verknuepft(absender)) p[feld] = absender.name
  p.absender = absender
  p.frist = fristFuer(absender.status, o.eingangMs)
  p.abgesendet = new Date(o.eingangMs).toISOString()
  p.eingang_sha256 = o.pruefsumme || ""
  p.aenderungen = []
  return p
}

/** Titel eines Patientenprotokolls: gekürzt, sonst je Maske. */
function patientenTitel(title, maske) {
  const t = typeof title === "string" ? title.trim().slice(0, 200).trim() : ""
  if (t) return t
  return maske === "schnell" ? "Schnelldoku" : "Patientendoku"
}

function datumDe(datum) {
  const t = String(datum || "").split("-")
  return t.length === 3 ? t[2] + "." + t[1] + "." + t[0] : String(datum || "")
}

/** payload einer Produktausgabe (1.13) aus geprüften Daten. */
function ausgabePayload(d, absender, pruefsumme) {
  const a = Object.assign({}, absender)
  delete a.feld
  return {
    einsatz: d.einsatz,
    datum: d.datum,
    lager_id: d.lager_id,
    lager_name: d.lager_name,
    positionen: d.positionen,
    user_id: a.id && (a.status === "bestaetigt" || a.status === "nicht_bestaetigt") ? a.id : "",
    user_name: a.name,
    absender: a,
    eingang_sha256: pruefsumme || "",
  }
}

function ausgabeTitel(d) {
  return "Produktausgabe " + d.einsatz + " (" + datumDe(d.datum) + ")"
}

/** Kennung des Melders an der Meldung: verknüpft; ohne Statusfeld nur bei „bestätigt“. */
function meldungReporterId(absender, feldVorhanden) {
  if (!absender || !absender.id) return ""
  if (!feldVorhanden) return absender.status === "bestaetigt" ? absender.id : ""
  return verknuepft(absender) ? absender.id : ""
}

// ── Datenprüfung (1.5) ─────────────────────────────────────────────────────

function datenFehler(feld, textFeld) {
  return { ok: false, feld: feld, text: DATEN_TEXTE[textFeld || feld] || TEXTE.daten }
}

function datumGueltig(d) {
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const t = new Date(d + "T00:00:00Z")
  return Number.isFinite(t.getTime()) && t.toISOString().slice(0, 10) === d
}

const SCHWERE = ["low", "medium", "high", "critical"]

/**
 * Prüft `daten` je Formular und gibt nur Bekanntes zurück.
 * bestand = { orte: {id: {organization_id, name, archiviert}}, artikel: {id: {organization_id, name, unit, archiviert}},
 *             geraete: {id: {organization_id, name, ausser_betrieb}} } (nur nachgeschlagene Kennungen)
 * o = { orgId, maske }
 * Ergebnis: { ok: true, daten } | { ok: false, feld, text }
 */
function datenPruefen(formular, daten, bestand, o) {
  const opt = o || {}
  const b = bestand || {}
  if (!istObjekt(daten)) return datenFehler(formular === "patienten" ? "payload" : "daten")
  if (formular === "patienten") {
    const p = payloadLesen(daten.payload)
    if (!p || typeof daten.payload !== "object") return datenFehler("payload")
    return { ok: true, daten: { title: patientenTitel(daten.title, opt.maske), payload: ohneServerSchluessel(p) } }
  }
  if (formular === "produktausgabe") {
    const einsatz = typeof daten.einsatz === "string" ? daten.einsatz.trim() : ""
    if (!einsatz || einsatz.length > 80) return datenFehler("einsatz")
    if (!datumGueltig(daten.datum)) return datenFehler("datum")
    const ort = typeof daten.lager_id === "string" ? (b.orte || {})[daten.lager_id] : null
    if (!ort || ort.organization_id !== opt.orgId || ort.archiviert === true) return datenFehler("lager_id")
    const roh = Array.isArray(daten.positionen) ? daten.positionen : []
    const pos = roh.filter((x) => istObjekt(x) && typeof x.item_id === "string" && x.item_id !== "" && x.qty !== 0)
    if (pos.length < 1 || pos.length > 50) return datenFehler("positionen")
    const positionen = []
    for (const x of pos) {
      if (typeof x.qty !== "number" || !Number.isFinite(x.qty) || x.qty <= 0 || x.qty > 10000) return datenFehler("positionen")
      const a = (b.artikel || {})[x.item_id]
      if (!a || a.organization_id !== opt.orgId || a.archiviert === true) return datenFehler("positionen", "positionen_fremd")
      positionen.push({ item_id: x.item_id, name: String(a.name || ""), qty: x.qty, unit: String(a.unit || "") })
    }
    return { ok: true, daten: { einsatz: einsatz, datum: daten.datum, lager_id: daten.lager_id, lager_name: String(ort.name || ""), positionen: positionen } }
  }
  if (formular === "defektmeldung") {
    const g = typeof daten.device_id === "string" ? (b.geraete || {})[daten.device_id] : null
    if (!g || g.organization_id !== opt.orgId) return datenFehler("device_id")
    if (String(g.ausser_betrieb || "").trim() !== "") return datenFehler("device_id", "device_id_ausser_betrieb")
    const description = typeof daten.description === "string" ? daten.description.trim() : ""
    if (!description || description.length > 4000) return datenFehler("description")
    const severity = SCHWERE.indexOf(daten.severity) >= 0 ? daten.severity : "medium"
    return { ok: true, daten: { device_id: daten.device_id, device_name: String(g.name || ""), description: description, severity: severity } }
  }
  return datenFehler("formular")
}

// ── Drossel und Sperre (1.12) ──────────────────────────────────────────────

const PREFIX = "responda:formular:"
/**
 * Merker im Speicher: formular.pb.js ist geladen (beim Start gesetzt, außerhalb von PREFIX,
 * damit der Aufräum-Lauf ihn nicht entfernt). mpg.pb.js glaubt reporter_status nur damit:
 * Ohne formular.pb.js (Rücknahme) setzt niemand das Feld, ein mitgeschickter Wert wäre gefälscht.
 */
const FORMULAR_AKTIV = "responda:formular_aktiv"

const GRENZEN = {
  name_ip: { fensterMs: 5 * 60000, max: 120 },
  name_u: { fensterMs: 5 * 60000, max: 200 },
  send_ip: { fensterMs: 10 * 60000, max: 60 },
  send_u: { fensterMs: 10 * 60000, max: 120 },
  aus_ip: { fensterMs: 60 * 60000, max: 20 },
  aus_z: { fensterMs: 60 * 60000, max: 10 },
  aus_offen: 20,
  // Passwort: je Konto und IP-Topf (5), je Konto über alle Töpfe (30), je IP-Topf über alle Konten (30)
  pw_kt: { max: 5, sperreMs: 15 * 60000, verfallMs: 15 * 60000 },
  pw_u: { max: 30, sperreMs: 15 * 60000, verfallMs: 15 * 60000 },
  pw_ip: { fensterMs: 15 * 60000, max: 30, sperreMs: 15 * 60000 },
  // Anonyme Anfragen je IPv6-/48 (alle /64 darin zusammen), höchstens 1 % des Speichers je Fenster;
  // Passwortprüfungen ebenso (auch die Anmeldung legt sonst je /64 Schlüssel an)
  name_blk: { fensterMs: 5 * 60000, max: 500 },
  send_blk: { fensterMs: 10 * 60000, max: 240 },
  pw_blk: { fensterMs: 15 * 60000, max: 100, sperreMs: 15 * 60000 },
  blk_anteil: 100,
  ulist_u: { fensterMs: 10 * 60000, max: 120 },
  sign_u: { fensterMs: 10 * 60000, max: 30 },
  mpruef_u: { fensterMs: 10 * 60000, max: 30 },
  speicher_max: 50000,
  speicher_sekunden: 60,
}

/** GRENZEN mit den Schaltern der Prüfumgebung (nur aus der Umgebung des Servers, nie aus dem Body). */
function grenzenMit(env) {
  const g = flach(GRENZEN)
  const e = env || {}
  const sperre = parseInt(String(e.sperreSekunden || ""), 10)
  if (sperre > 0) { g.pw_kt.sperreMs = sperre * 1000; g.pw_u.sperreMs = sperre * 1000; g.pw_ip.sperreMs = sperre * 1000; g.pw_blk.sperreMs = sperre * 1000 }
  const max = parseInt(String(e.speicherMax || ""), 10)
  if (max > 0) g.speicher_max = max
  // Ein /48 belegt nie mehr als speicher_max / blk_anteil Einträge je Fenster
  const anteil = Math.max(1, Math.floor(g.speicher_max / g.blk_anteil))
  g.name_blk.max = Math.min(g.name_blk.max, anteil)
  g.send_blk.max = Math.min(g.send_blk.max, anteil)
  g.pw_blk.max = Math.min(g.pw_blk.max, anteil)
  return g
}

function restSekunden(bis, jetzt) {
  return Math.max(1, Math.ceil((bis - ms(jetzt)) / 1000))
}

/** Festes Fenster { n, ab, ende }. */
function fensterZaehlen(alt, jetzt, fensterMs, max) {
  const t = ms(jetzt)
  const a = alt && typeof alt === "object" ? alt : null
  if (!a || !(Number(a.ab) + fensterMs > t)) {
    if (max < 1) return { neu: a, erlaubt: false, sekunden: restSekunden(t + fensterMs, t) }
    return { neu: { n: 1, ab: t, ende: t + fensterMs }, erlaubt: true, sekunden: 0 }
  }
  const n = Number(a.n) || 0
  const ab = Number(a.ab)
  if (n >= max) return { neu: a, erlaubt: false, sekunden: restSekunden(ab + fensterMs, t) }
  return { neu: { n: n + 1, ab: ab, ende: ab + fensterMs }, erlaubt: true, sekunden: 0 }
}

/**
 * Einen Passwortversuch je Konto und IP-Topf atomar reservieren (im setFunc des Speichers).
 * { n, letzter, bis, ende }. Mit der Reservierung der max-ten beginnt die Sperre; ein Versuch
 * verfällt verfallMs nach dem letzten; nach Sperrende fängt es neu an. uebrig = Versuche nach
 * diesem; frisch = vorher kein Versuch in der Zählung.
 */
function pwReservieren(alt, jetzt, cfg) {
  const t = ms(jetzt)
  const a = alt && typeof alt === "object" ? alt : null
  if (a && Number(a.bis) > t) return { neu: a, erlaubt: false, sekunden: restSekunden(Number(a.bis), t), uebrig: 0, frisch: false, sperreSekunden: restSekunden(Number(a.bis), t) }
  const frisch = !a || Number(a.bis) > 0 || !(t - Number(a.letzter) < cfg.verfallMs) || !(Number(a.n) > 0)
  const n = (frisch ? 0 : Number(a.n) || 0) + 1
  const bis = n >= cfg.max ? t + cfg.sperreMs : 0
  return {
    neu: { n: n, letzter: t, bis: bis, ende: Math.max(bis, t + cfg.verfallMs) }, erlaubt: true, sekunden: 0,
    uebrig: Math.max(0, cfg.max - n), frisch: frisch, sperreSekunden: bis ? restSekunden(bis, t) : 0,
  }
}

/**
 * Einen Passwortversuch je Konto über alle IP-Topfe reservieren. Wie pwReservieren, aber eine
 * laufende Sperre hält nur Töpfe auf, die für dieses Konto schon Versuche haben: Ein Topf ohne
 * eigene Versuche (`sauber`) darf trotzdem prüfen (dann uebrig 0). So sperrt niemand ein Konto
 * aus der Ferne, nur weil er den Namen kennt, und verteilte Versuche bleiben begrenzt.
 */
function pwKontoReservieren(alt, jetzt, cfg, sauber) {
  const t = ms(jetzt)
  const a = alt && typeof alt === "object" ? alt : null
  if (a && Number(a.bis) > t) {
    if (!sauber) return { neu: a, erlaubt: false, sekunden: restSekunden(Number(a.bis), t), uebrig: 0 }
    const n = (Number(a.n) || 0) + 1
    return { neu: Object.assign({}, a, { n: n, letzter: t, ende: Math.max(Number(a.bis), t + cfg.verfallMs) }), erlaubt: true, sekunden: 0, uebrig: 0, sperreSekunden: restSekunden(Number(a.bis), t) }
  }
  return pwReservieren(alt, jetzt, cfg)
}

/**
 * Eine Passwortprüfung je IP-Topf reservieren { n, ab, bis, ende }: höchstens max Prüfungen je
 * Fenster, die nicht wieder freigegeben wurden (ein richtiges Passwort gibt frei); danach
 * beginnt die Sperre. Atomar, auch gleichzeitige Anfragen prüfen höchstens max.
 */
function pwIpReservieren(alt, jetzt, cfg) {
  const t = ms(jetzt)
  const a = alt && typeof alt === "object" ? alt : null
  if (a && Number(a.bis) > t) return { neu: a, erlaubt: false, sekunden: restSekunden(Number(a.bis), t) }
  const neuesFenster = !a || Number(a.bis) > 0 || !(Number(a.ab) + cfg.fensterMs > t)
  const n = neuesFenster ? 0 : Number(a.n) || 0
  const ab = neuesFenster ? t : Number(a.ab)
  if (n >= cfg.max) {
    const bis = t + cfg.sperreMs
    return { neu: { n: n, ab: ab, bis: bis, ende: bis }, erlaubt: false, sekunden: restSekunden(bis, t) }
  }
  return { neu: { n: n + 1, ab: ab, bis: 0, ende: ab + cfg.fensterMs }, erlaubt: true, sekunden: 0 }
}

/** Eine Reservierung zurückgeben (richtiges Passwort): n um eins kleiner, Sperre bleibt. */
function pwFreigeben(alt) {
  if (!alt || typeof alt !== "object") return alt
  return Object.assign({}, alt, { n: Math.max(0, (Number(alt.n) || 0) - 1) })
}

/** Restsekunden einer Sperre { bis } oder 0. */
function sperreRest(wert, jetzt) {
  const t = ms(jetzt)
  return wert && Number(wert.bis) > t ? restSekunden(Number(wert.bis), t) : 0
}

/** Darf der Aufräum-Lauf den Wert entfernen? */
function abgelaufen(wert, jetzt) {
  if (!wert || typeof wert !== "object") return true
  const ende = Number(wert.ende)
  return !Number.isFinite(ende) || ende <= ms(jetzt)
}

function ipv4Gueltig(s) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return false
  return s.split(".").every((x) => Number(x) <= 255)
}

/** IPv6 als 8 Zahlen, sonst null. */
function ipv6Gruppen(s) {
  let text = s
  const tail = []
  if (text.indexOf(".") >= 0) {
    // Eingebettete IPv4 am Ende („::ffff:1.2.3.4“, „64:ff9b::1.2.3.4“) als zwei Gruppen
    const letzter = text.lastIndexOf(":")
    const v4 = text.slice(letzter + 1)
    if (!ipv4Gueltig(v4)) return null
    const z = v4.split(".").map(Number)
    tail.push(z[0] * 256 + z[1], z[2] * 256 + z[3])
    const vorne = text.slice(0, letzter + 1)
    text = vorne.slice(-2) === "::" ? vorne : vorne.slice(0, -1)
  }
  const doppel = text.split("::")
  if (doppel.length > 2) return null
  const teil = (x) => (x === "" ? [] : x.split(":"))
  const links = teil(doppel[0])
  const rechts = doppel.length === 2 ? teil(doppel[1]) : []
  const soll = 8 - tail.length
  let gruppen
  if (doppel.length === 2) {
    const fehlt = soll - links.length - rechts.length
    if (fehlt < 1) return null
    gruppen = links.concat(new Array(fehlt).fill("0"), rechts)
  } else {
    gruppen = links
  }
  if (gruppen.length !== soll) return null
  const zahlen = []
  for (const g of gruppen) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null
    zahlen.push(parseInt(g, 16))
  }
  return zahlen.concat(tail)
}

/** Topf für Drossel und Sperre: IPv4 unverändert, IPv6 je /64, Unlesbares „unbekannt“. */
function ipTopf(ip) {
  let s = String(ip === undefined || ip === null ? "" : ip).trim()
  if (s.charAt(0) === "[") s = s.slice(1, s.indexOf("]") > 0 ? s.indexOf("]") : s.length)
  const zone = s.indexOf("%")
  if (zone >= 0) s = s.slice(0, zone)
  if (ipv4Gueltig(s)) return s
  if (s.indexOf(":") < 0) return "unbekannt"
  const g = ipv6Gruppen(s)
  if (!g) return "unbekannt"
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) {
    return [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join(".")
  }
  return g.slice(0, 4).map((x) => x.toString(16)).join(":") + "::/64"
}

/** Block für die Grenze je Netz: IPv6 je /48 („2001:db8:1::/48“); IPv4 und Unlesbares "" (keine eigene Grenze). */
function ipBlock(ip) {
  const t = ipTopf(ip)
  if (t.indexOf("::/64") < 0) return ""
  return t.replace("::/64", "").split(":").slice(0, 3).join(":") + "::/48"
}

/** Privat oder Loopback (für die Warnung zum Trusted proxy). */
function ipPrivat(ip) {
  const t = ipTopf(ip)
  if (t === "unbekannt") return false
  if (t.indexOf("::/64") < 0) {
    const z = t.split(".").map(Number)
    return z[0] === 127 || z[0] === 10 || (z[0] === 172 && z[1] >= 16 && z[1] <= 31) || (z[0] === 192 && z[1] === 168) || (z[0] === 169 && z[1] === 254)
  }
  const g = ipv6Gruppen(String(ip).trim().split("%")[0].replace(/^\[|\]$/g, ""))
  if (!g) return false
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true
  return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80
}

/** Kennung eines neuen Satzes: 15 × [a-z0-9], vom Client. */
function kennungGueltig(id) {
  return typeof id === "string" && /^[a-z0-9]{15}$/.test(id)
}

// ── Vorprüfung, Karte unter Vorgänge (1.9) ─────────────────────────────────

/**
 * Mitglieder mit Hindernissen. Nicht mit Passwort bestätigen kann, wessen Name unvollständig
 * ist oder wer keine E-Mail (also kein Passwort) hat: `koennen_nicht`. Ein doppelter Name
 * hindert das Passwort nicht (der Server prüft jeden Kandidaten), wohl aber die Verknüpfung in
 * der Besatzung, „Unterschrift ausstehend“ und den Modus frei: `doppelt`.
 */
function mitgliederPruefen(mitglieder, orgId, jetzt) {
  const v = (mitglieder || []).filter((m) => istVerknuepfbar(m, orgId, jetzt))
  const zahl = {}
  for (const m of v) {
    const n = normName(m.name)
    if (n) zahl[n] = (zahl[n] || 0) + 1
  }
  const eintraege = []
  for (const m of v) {
    const gruende = []
    const n = normName(m.name)
    if (!nameVollstaendig(m.name)) gruende.push("name_unvollstaendig")
    if (n && zahl[n] > 1) gruende.push("name_doppelt")
    if (String(m.email || "").trim().toLowerCase().endsWith(PLATZHALTER_ENDUNG)) gruende.push("ohne_email")
    if (gruende.length) eintraege.push({ id: m.id, name: kontoName(m), gruende: gruende })
  }
  eintraege.sort((a, b) => a.name.localeCompare(b.name, "de") || (a.id < b.id ? -1 : 1))
  const koennenNicht = eintraege.filter((e) => e.gruende.indexOf("name_unvollstaendig") >= 0 || e.gruende.indexOf("ohne_email") >= 0).length
  const doppelt = eintraege.filter((e) => e.gruende.indexOf("name_doppelt") >= 0).length
  return { gesamt: v.length, koennen_nicht: koennenNicht, doppelt: doppelt, eintraege: eintraege }
}

// ── Mit übergebenen PocketBase-Objekten ────────────────────────────────────
// Diese Helfer rufen nur Methoden der übergebenen Objekte auf (Datensatz, App, Ereignis).

/** JSON-Feld eines Datensatzes als Wert (wie das SDK ihn liefert); doppelt kodierten Text einmal mehr. */
function jsonWert(rec, feld) {
  try {
    let v = JSON.parse(rec.getString(feld) || "null")
    if (typeof v === "string") {
      try { const w = JSON.parse(v); if (w && typeof w === "object") v = w } catch (err) { /* Text bleibt Text */ }
    }
    return v
  } catch (err) {
    return null
  }
}

function jsonObjekt(rec, feld) {
  const v = jsonWert(rec, feld)
  return istObjekt(v) ? v : {}
}

/** Ein users-Datensatz als einfaches Objekt für die Regeln. */
function personAusRecord(rec) {
  if (!rec) return null
  let sammlung = ""
  try { sammlung = rec.collection().name } catch (err) { sammlung = "" }
  return {
    id: rec.id,
    sammlung: sammlung,
    name: rec.getString("name"),
    email: rec.getString("email"),
    verified: rec.getBool("verified"),
    role: rec.getString("role"),
    supervisor: rec.getBool("supervisor"),
    disabled: rec.getBool("disabled"),
    expires_at: rec.getString("expires_at"),
    organization_id: rec.getString("organization_id"),
    permissions: jsonObjekt(rec, "permissions"),
    temp_permissions: jsonObjekt(rec, "temp_permissions"),
  }
}

/** Eine Organisation als einfaches Objekt (freigeschaltet und form_config als Wert). */
function orgAusRecord(rec) {
  return {
    id: rec.id,
    org_code: rec.getString("org_code"),
    org_name: rec.getString("org_name"),
    is_active: rec.getBool("is_active"),
    freigeschaltet: jsonWert(rec, "freigeschaltet"),
    form_config: jsonWert(rec, "form_config"),
  }
}

/** Organisation per org_code, nur aktive; sonst null. */
function orgPerCode(app, code) {
  if (typeof code !== "string" || !code || code.length > 100) return null
  try {
    const o = orgAusRecord(app.findFirstRecordByFilter("organizations", "org_code = {:c}", { c: code }))
    return o.is_active ? o : null
  } catch (err) {
    return null
  }
}

/** Organisation per Kennung, auch inaktive (mit is_active); sonst null. */
function orgPerId(app, id) {
  if (!id) return null
  try { return orgAusRecord(app.findRecordById("organizations", id)) } catch (err) { return null }
}

/** Aktive Mitglieder einer Org als einfache Objekte (verknüpfbar filtern die Regeln). */
function mitgliederLaden(app, orgId) {
  if (!orgId) return []
  let liste
  try {
    liste = app.findRecordsByFilter("users", "organization_id = {:org} && disabled != true && (expires_at = '' || expires_at > @now)", "", 0, 0, { org: orgId })
  } catch (err) {
    // Feld disabled oder expires_at fehlt: alle der Org, die Regeln filtern
    try { liste = app.findRecordsByFilter("users", "organization_id = {:org}", "", 0, 0, { org: orgId }) } catch (err2) { liste = [] }
  }
  return liste.map(personAusRecord)
}

/** Gibt es das Feld in der Sammlung? */
function feldDa(app, sammlung, feld) {
  try { return !!app.findCollectionByNameOrId(sammlung).fields.getByName(feld) } catch (err) { return false }
}

/** Fenster im Speicher zählen (atomar). Ergebnis aus fensterZaehlen. */
function zaehlen(app, schluessel, cfg, jetzt) {
  let erg = null
  app.store().setFunc(PREFIX + schluessel, (alt) => {
    erg = fensterZaehlen(alt, jetzt, cfg.fensterMs, cfg.max)
    return erg.neu
  })
  return erg || { erlaubt: true, sekunden: 0 }
}

/**
 * Anonyme Anfrage je Netz zählen: erst je IPv6-/48 (nur IPv6), dann je IP-Topf. Ein Netz mit
 * vielen /64 legt so nicht beliebig viele Schlüssel an. `art` ist "name" oder "send".
 * Ergebnis wie zaehlen.
 */
function anonymZaehlen(app, art, ip, g, jetzt) {
  const blk = ipBlock(ip)
  if (blk) {
    const b = zaehlen(app, art + ":blk:" + blk, g[art + "_blk"], jetzt)
    if (!b.erlaubt) return b
  }
  return zaehlen(app, art + ":ip:" + ipTopf(ip), g[art + "_ip"], jetzt)
}

/**
 * Ein Passwort gegen die Kandidaten prüfen, mit den Sperren aus 1.12. Jede Prüfung wird vorher
 * atomar reserviert: je IPv6-/48 (pw_blk), je IP-Topf (pw_ip), je Konto und Topf (pw_kt), je Konto über alle Töpfe
 * (pw_u; ein Topf ohne eigene Versuche für dieses Konto darf trotz dieser Sperre). Gilt für die
 * Route /absenden und für die Anmeldung (auth-with-password), damit sich die Sperre nicht über
 * den anderen Weg umgehen lässt. Ein richtiges Passwort gibt seine Reservierungen zurück und
 * löscht den Zähler je Konto und Topf.
 * Ergebnis: { person } | { grund: "gesperrt", sekunden } | { grund: "passwort_falsch", uebrig }
 */
function passwortPruefen(app, kandidaten, passwort, ip, g, jetzt) {
  const store = app.store()
  const topf = ipTopf(ip)
  const blk = ipBlock(ip)
  const reservieren = (schluessel, f) => {
    let r = null
    store.setFunc(PREFIX + schluessel, (alt) => { r = f(alt); return r.neu })
    return r || { erlaubt: false, sekunden: 1, uebrig: 0 }
  }
  const freigeben = (schluessel) => { store.setFunc(PREFIX + schluessel, (alt) => pwFreigeben(alt)) }
  const sperreSek = Math.ceil(g.pw_kt.sperreMs / 1000)
  let kleinste = 0
  const merke = (s) => { kleinste = kleinste ? Math.min(kleinste, s) : s }
  let geprueft = 0
  let uebrig = 0
  // IPv6: zuerst je /48, damit ein Netz mit vielen /64 nicht beliebig viele Schlüssel anlegt
  const netz = blk ? ["pw:blk:" + blk, "pw:ip:" + topf] : ["pw:ip:" + topf]
  const netzFreigeben = () => { for (const k of netz) freigeben(k) }
  for (const kand of kandidaten) {
    let netzOk = true
    for (let i = 0; i < netz.length; i++) {
      const r = reservieren(netz[i], (alt) => pwIpReservieren(alt, jetzt, i === 0 && blk ? g.pw_blk : g.pw_ip))
      if (!r.erlaubt) { for (let j = 0; j < i; j++) freigeben(netz[j]); merke(r.sekunden); netzOk = false; break }
    }
    if (!netzOk) break
    const kt = "pw:kt:" + kand.id + ":" + topf
    const rKt = reservieren(kt, (alt) => pwReservieren(alt, jetzt, g.pw_kt))
    if (!rKt.erlaubt) { netzFreigeben(); merke(rKt.sekunden); continue }
    const rU = reservieren("pw:u:" + kand.id, (alt) => pwKontoReservieren(alt, jetzt, g.pw_u, rKt.frisch))
    if (!rU.erlaubt) { netzFreigeben(); merke(rU.sekunden); continue }
    geprueft++
    let passt = false
    try { passt = app.findRecordById("users", kand.id).validatePassword(passwort) } catch (err) { passt = false }
    if (passt) {
      store.remove(PREFIX + kt)
      freigeben("pw:u:" + kand.id)
      netzFreigeben()
      return { person: kand }
    }
    const rest = Math.min(rKt.uebrig, rU.uebrig)
    uebrig = Math.max(uebrig, rest)
    if (rest === 0) merke(Math.max(rKt.uebrig === 0 ? rKt.sperreSekunden : 0, rU.uebrig === 0 ? rU.sperreSekunden : 0) || sperreSek)
  }
  if (geprueft === 0 || uebrig === 0) return { grund: "gesperrt", sekunden: kleinste || sperreSek }
  return { grund: "passwort_falsch", uebrig: uebrig }
}

/** Schlüssel des payload, die nur Mitglieder ändern (Rückfragen der Leitung, Stellungnahmen der Besatzung). */
const MITGLIEDS_SCHLUESSEL = ["rueckfragen", "stellungnahmen"]

/**
 * Der Absender, dem der Server glaubt. Mit Statusfeld (absender_status) nur, wenn das Feld
 * denselben Status trägt wie payload.absender: Das Feld setzt nur der Server (Route, Hooks),
 * ein payload.absender ohne passendes Feld stammt aus der Zeit ohne Hooks und gilt als alter
 * Satz. Ohne das Feld (Betrieb ohne Felder) der payload.
 */
function gesicherterAbsender(feldWert, absender, hatFeld) {
  if (!absender || typeof absender !== "object" || Array.isArray(absender)) return null
  if (hatFeld) return feldWert !== "" && absender.status === feldWert ? absender : null
  return absender
}

/** Gegenzeichnung der Leitung (Patientenverwaltung, Archivieren): setzt nur ein Mitglied. */
const GEGENZEICHNUNG = ["admin_name", "admin_datum", "admin_unterschrift"]

/**
 * Felder der Liste aus dem Original übernehmen (beim Anlegen: original null, dann leeren), soweit
 * die Sammlung sie hat.
 */
function felderBehalten(rec, original, liste) {
  let felder = null
  try { felder = rec.collection().fields } catch (err) { return }
  for (const name of liste) {
    let da = false
    try { da = !!felder.getByName(name) } catch (err) { da = false }
    if (!da) continue
    try { rec.set(name, original ? original.get(name) : "") } catch (err) { /* Feld ohne Wert */ }
  }
}

/** Alle Felder außer `ausser`, id und Zeitstempeln aus dem Original zurücksetzen (Schutz gesperrter Sätze). */
function felderZuruecksetzen(rec, original, ausser) {
  let felder = []
  try { felder = rec.collection().fields } catch (err) { return }
  for (let i = 0; i < felder.length; i++) {
    let name = ""
    let typ = ""
    try { name = felder[i].getName(); typ = felder[i].type() } catch (err) { continue }
    if (!name || name === "id" || ausser.indexOf(name) >= 0 || typ === "autodate" || typ === "password") continue
    try { rec.set(name, original.get(name)) } catch (err) { /* Feld ohne Wert */ }
  }
}

/** Fehlerantwort im Format 1.1 (Zusatzfelder ohne undefined). */
function antwort(e, status, grund, zusatz) {
  const z = {}
  for (const k of Object.keys(zusatz || {})) if (zusatz[k] !== undefined && zusatz[k] !== null && zusatz[k] !== "") z[k] = zusatz[k]
  const text = z.text || meldung(grund, z)
  delete z.text
  return e.json(status, Object.assign({ status: status, message: text, grund: grund }, z))
}

/** JSON-Body einer Anfrage als einfaches Objekt; ohne Content-Type application/json oder unlesbar: null. */
function bodyLesen(e) {
  let ct = ""
  try { ct = String(e.request.header.get("Content-Type") || "") } catch (err) { ct = "" }
  if (ct.toLowerCase().split(";")[0].trim() !== "application/json") return null
  try {
    const b = flach(e.requestInfo().body || {})
    return istObjekt(b) ? b : null
  } catch (err) {
    return null
  }
}

/** Schlüssel des Bodys (auch multipart), ohne Fehler. */
function bodySchluessel(e) {
  try { return Object.keys(e.requestInfo().body || {}) } catch (err) { return [] }
}

function realIP(e) {
  try { return String(e.realIP() || "") } catch (err) { return "" }
}

function proxyKoepfe(app) {
  const aus = []
  try {
    const h = app.settings().trustedProxy.headers || []
    for (let i = 0; i < h.length; i++) aus.push(String(h[i]))
  } catch (err) { /* keine */ }
  return aus
}

/** true genau einmal je `abstandMs` (bzw. je Start bei abstandMs 0), atomar. */
function einmalJe(app, schluessel, abstandMs, jetzt) {
  let ja = false
  const t = ms(jetzt)
  app.store().setFunc(PREFIX + "log:" + schluessel, (alt) => {
    if (alt && (abstandMs === 0 || Number(alt.ende) > t)) return alt
    ja = true
    return { ende: abstandMs === 0 ? 8640000000000000 : t + abstandMs }
  })
  return ja
}

/** Abgelaufene Schlüssel der Drossel entfernen (Aufräum-Lauf und voller Speicher). Gibt die Zahl zurück. */
function aufraeumen(app, jetzt) {
  let weg = 0
  const alle = app.store().getAll()
  for (const k of Object.keys(alle)) {
    if (k.indexOf(PREFIX) !== 0) continue
    if (abgelaufen(alle[k], jetzt)) { app.store().remove(k); weg++ }
  }
  return weg
}

function speicherLaenge(app) {
  try { return app.store().length() } catch (err) { return 0 }
}

/**
 * Speicher über der Obergrenze? Zuerst sofort aufräumen (höchstens alle 30 Sekunden); bleibt er
 * voll, bleiben anonyme Anfragen draußen (Log höchstens alle 10 Minuten).
 */
function speicherVoll(app, g, jetzt) {
  let n = speicherLaenge(app)
  if (n <= g.speicher_max) return false
  if (einmalJe(app, "aufraeumen", 30000, jetzt)) {
    try { aufraeumen(app, jetzt) } catch (err) { /* bleibt voll */ }
    n = speicherLaenge(app)
    if (n <= g.speicher_max) return false
  }
  if (einmalJe(app, "speicher", 10 * 60000, jetzt)) {
    try { app.logger().warn("[formular] Speicher der Drossel voll, anonyme Anfragen werden abgewiesen", "eintraege", n) } catch (err) { /* ohne Log */ }
  }
  return true
}

/** Bestand für datenPruefen nachschlagen (nur die genannten Kennungen). */
function bestandLaden(app, formular, daten) {
  const b = { orte: {}, artikel: {}, geraete: {} }
  const lies = (c, id) => { try { return app.findRecordById(c, id) } catch (err) { return null } }
  if (!istObjekt(daten)) return b
  if (formular === "produktausgabe") {
    if (typeof daten.lager_id === "string" && daten.lager_id) {
      const o = lies("inventory_locations", daten.lager_id)
      if (o) b.orte[o.id] = { organization_id: o.getString("organization_id"), name: o.getString("name"), archiviert: o.getBool("archiviert") }
    }
    const pos = (Array.isArray(daten.positionen) ? daten.positionen : []).filter((x) => istObjekt(x) && typeof x.item_id === "string" && x.item_id !== "" && x.qty !== 0)
    if (pos.length <= 50) {
      for (const x of pos) {
        if (b.artikel[x.item_id]) continue
        const a = lies("inventory_items", x.item_id)
        if (a) b.artikel[a.id] = { organization_id: a.getString("organization_id"), name: a.getString("name"), unit: a.getString("unit"), archiviert: a.getBool("archiviert") }
      }
    }
  }
  if (formular === "defektmeldung" && typeof daten.device_id === "string" && daten.device_id) {
    const g = lies("mpg_devices", daten.device_id)
    if (g) b.geraete[g.id] = { organization_id: g.getString("organization_id"), name: g.getString("name"), ausser_betrieb: g.getString("ausser_betrieb") }
  }
  return b
}

/** Der gespeicherte Absender eines Satzes (payload.absender bzw. reporter_*), oder null bei alten Sätzen. */
function absenderAusSatz(rec, sammlung) {
  if (sammlung === "mpg_defect_reports") {
    const status = rec.getString("reporter_status")
    if (!status) return null
    return { id: rec.getString("reporter_user_id"), name: rec.getString("reporter_name"), status: status, weg: "", modus: "", am: "" }
  }
  const p = payloadLesen(jsonWert(rec, "payload"))
  return p && istObjekt(p.absender) ? p.absender : null
}

/** Antwort für eine schon gespeicherte Sendung mit derselben Kennung (bereits: true). */
function gespeicherteAntwort(rec, sammlung) {
  const p = sammlung === "mpg_defect_reports" ? {} : payloadLesen(jsonWert(rec, "payload")) || {}
  return { ok: true, id: rec.id, bereits: true, absender: absenderAusSatz(rec, sammlung), frist: sammlung === "patients" ? String(p.frist || "") : "" }
}

/**
 * Kennung schon vergeben? null = frei; { bereits: true, antwort } = dieselbe Sendung noch einmal;
 * { bereits: false } = Kennung mit anderen Daten, anderer Org oder in einer anderen Sammlung (409).
 */
function schonDa(app, formular, id, orgId, pruefsumme, daten) {
  const sammlung = SAMMLUNG[formular]
  let rec = null
  try { rec = app.findRecordById(sammlung, id) } catch (err) { rec = null }
  if (rec) {
    if (rec.getString("organization_id") !== orgId) return { bereits: false }
    if (sammlung === "mpg_defect_reports") {
      const d = istObjekt(daten) ? daten : {}
      const gleich = rec.getString("device_id") === d.device_id &&
        rec.getString("description") === (typeof d.description === "string" ? d.description.trim() : "") &&
        rec.getString("severity") === (SCHWERE.indexOf(d.severity) >= 0 ? d.severity : "medium")
      return gleich ? { bereits: true, antwort: gespeicherteAntwort(rec, sammlung) } : { bereits: false }
    }
    const p = payloadLesen(jsonWert(rec, "payload")) || {}
    return pruefsumme && p.eingang_sha256 === pruefsumme ? { bereits: true, antwort: gespeicherteAntwort(rec, sammlung) } : { bereits: false }
  }
  if (formular === "defektmeldung") {
    for (const c of ["mpg_defects", "mpg_ereignisse"]) {
      try { app.findRecordById(c, id); return { bereits: false } } catch (err) { /* frei oder Sammlung fehlt */ }
    }
  }
  return null
}

function pbZeit(t) {
  return new Date(t).toISOString().replace("T", " ")
}

/**
 * Eine übernommene Änderung der alten Doku erkennen: ein Satz der Org trägt genau dieses
 * `abgesendet` (angelegt bis 12 Stunden davor oder danach). Gibt dessen Kennung oder "".
 */
function zielAlterAenderung(app, orgId, payload) {
  const p = payloadLesen(payload)
  const x = p && typeof p.abgesendet === "string" ? p.abgesendet : ""
  const t = Date.parse(x)
  if (!x || !Number.isFinite(t) || !/^\d{4}-\d{2}-\d{2}T/.test(x)) return ""
  const halb = 12 * 60 * 60 * 1000
  for (let offset = 0; offset < 100000; offset += 200) {
    let seite = []
    try {
      seite = app.findRecordsByFilter("patients", "organization_id = {:o} && created >= {:von} && created <= {:bis}", "created", 200, offset, { o: orgId, von: pbZeit(t - halb), bis: pbZeit(t + halb) })
    } catch (err) { return "" }
    for (const r of seite) {
      const q = payloadLesen(jsonWert(r, "payload"))
      if (q && q.abgesendet === x) return r.id
    }
    if (seite.length < 200) break
  }
  return ""
}

/** Offene „ausstehend“ für dieses Ziel über alle drei Sammlungen der Org. */
function offeneAusstehende(app, orgId, zielId) {
  let n = 0
  for (const sammlung of ["patients", "product_outputs", "mpg_defect_reports"]) {
    const feld = STATUSFELD[sammlung]
    if (!feldDa(app, sammlung, feld)) continue
    try {
      if (sammlung === "mpg_defect_reports") {
        n += app.findRecordsByFilter(sammlung, "organization_id = {:o} && reporter_status = 'ausstehend' && reporter_user_id = {:z}", "", 0, 0, { o: orgId, z: zielId }).length
      } else {
        for (const r of app.findRecordsByFilter(sammlung, "organization_id = {:o} && absender_status = 'ausstehend'", "", 0, 0, { o: orgId })) {
          const a = absenderAusSatz(r, sammlung)
          if (a && a.id === zielId) n++
        }
      }
    } catch (err) { /* Sammlung nicht lesbar: zählt nicht */ }
  }
  return n
}

/** Datei im Datenverzeichnis: Die Formular-Hooks sind schon einmal gestartet (statusfelderLeeren lief). */
const START_MERKER = "responda_formular_start.txt"

/**
 * Statusfelder leeren, beim allerersten Start von formular.pb.js (Merker START_MERKER). Werte,
 * die vorher in absender_status oder reporter_status standen, hat kein Hook gesetzt: Die
 * Create- und Update-Regeln sind offen, jeder konnte „bestätigt“ oder „ausstehend“ mit einem
 * fremden Absender eintragen. Danach gilt der Satz als alter Satz ohne Absender (die App und
 * der Server glauben payload.absender nur, wenn das Feld denselben Status trägt).
 * Gibt je Sammlung die Zahl der geleerten Sätze zurück.
 */
function statusfelderLeeren(app) {
  const aus = {}
  for (const sammlung of ["patients", "product_outputs", "mpg_defect_reports"]) {
    const feld = STATUSFELD[sammlung]
    if (!feldDa(app, sammlung, feld)) continue
    let n = 0
    try { n = app.findRecordsByFilter(sammlung, feld + " != ''", "", 0, 0).length } catch (err) { n = 0 }
    if (n > 0) app.db().newQuery("UPDATE `" + sammlung + "` SET `" + feld + "` = '' WHERE `" + feld + "` != ''").execute()
    aus[sammlung] = n
  }
  return aus
}

/** Ein Eintrag der Liste „Wartet auf deine Unterschrift“ (1.6). */
function unterschriftEintrag(rec, formular, absender) {
  const kurz = (s) => String(s || "").slice(0, 120)
  let titel = rec.getString("title")
  let zus = titel
  if (formular === "produktausgabe") {
    const p = payloadLesen(jsonWert(rec, "payload")) || {}
    const n = Array.isArray(p.positionen) ? p.positionen.length : 0
    zus = String(p.einsatz || "") + ", " + n + (n === 1 ? " Position" : " Positionen")
  } else if (formular === "defektmeldung") {
    titel = "Defekt: " + rec.getString("device_name")
    zus = rec.getString("device_name") + ": " + rec.getString("description")
  }
  return { formular: formular, id: rec.id, titel: titel, zusammenfassung: kurz(zus), angelegt: rec.getString("created"), absender_name: String((absender && absender.name) || "") }
}

module.exports = {
  FRIST_MS, FORMULARE, MASKEN, VOREINSTELLUNG, SAMMLUNG, FORMULAR_AUS_SAMMLUNG, STATUSFELD, DRUCKFELD,
  SERVER_SCHLUESSEL, POSTEN, PLATZHALTER_ENDUNG, MODUL_IDS, ENTHAELT, IMMER, FORMULAR_MODULE,
  TEXTE, DATEN_TEXTE, HOOK_TEXTE, GRENZEN, PREFIX,
  minutenText, meldung,
  normName, nameVollstaendig, anzeigeName, kontoName, schriftGemischt,
  aktiv, rechtAktiv, istVerknuepfbar, mitgliedAusToken, darfAendern, darfUnterschreiben, darfOhneUnterschrift, darfFormulareEinstellen, treffer,
  formConfigLesen, absenderModus, modulFrei, formularAn, formularOeffentlich,
  payloadLesen, wartetAufUnterschrift, ohneServerSchluessel, maskeAusPayload, druckfeldIn, kanonisch,
  besatzungAufloesen, absenderEntscheiden, absenderEintrag, verknuepft, fristFuer,
  patientenPayload, patientenTitel, ausgabePayload, ausgabeTitel, meldungReporterId,
  datenPruefen,
  grenzenMit, fensterZaehlen, pwReservieren, pwKontoReservieren, pwIpReservieren, pwFreigeben, sperreRest, abgelaufen, ipTopf, ipBlock, ipPrivat, kennungGueltig,
  mitgliederPruefen,
  MITGLIEDS_SCHLUESSEL, FORMULAR_AKTIV,
  jsonWert, jsonObjekt, personAusRecord, orgAusRecord, orgPerCode, orgPerId, mitgliederLaden, feldDa, zaehlen, anonymZaehlen, passwortPruefen,
  gesicherterAbsender, felderZuruecksetzen, GEGENZEICHNUNG, felderBehalten, antwort,
  bodyLesen, bodySchluessel, realIP, proxyKoepfe, einmalJe, aufraeumen, speicherVoll, bestandLaden, absenderAusSatz, gespeicherteAntwort,
  schonDa, pbZeit, zielAlterAenderung, offeneAusstehende, unterschriftEintrag,
  START_MERKER, statusfelderLeeren,
}
