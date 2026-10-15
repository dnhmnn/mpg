// Baut die Willkommens-E-Mail für einen neuen Benutzer.
// Wird von willkommen.pb.js per require() genutzt (kein eigener Hook, daher
// .js statt .pb.js). Reine Funktion ohne PocketBase — so prüfen die Tests der
// App sie mit (src/lib/__tests__/willkommen.test.ts).
//
// Inhalt: Organisation und Org-Code, die Anmelde-Adresse, als erster Schritt
// "Passwort festlegen" (öffnet die Anmeldung mit "Passwort vergessen"), dann
// der Link zur App. Wer Benutzer anlegt, vergibt kein Passwort — der Benutzer
// legt es hier selbst fest. Ein Passwort steht nie in der E-Mail.
//
// Schrift: Atkinson Hyperlegible wie in der App. E-Mail-Programme haben sie
// nicht installiert; der Hook gibt sie eingebettet mit (n.schrift, aus
// willkommen-schrift.js). Fehlt sie, gilt die Ersatzschrift. Die Schrift steht
// an jedem Textelement, weil manche Programme sie in Tabellen nicht erben.

const APP = "https://app.responda.systems"

const ROT = "#600812"
const TEXT = "#1a0e08"
const GRAU = "#8a7a68"
const GRUND = "#faf9f7"
const SCHRIFT = "'Atkinson Hyperlegible',Helvetica,Arial,sans-serif"
const F = "font-family:" + SCHRIFT + ";"

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
}

/**
 * Bekommt diese Adresse eine Willkommens-E-Mail? Nicht Platzhalter
 * (…@kein-email.intern, Ausbildungs-Teilnehmer ohne eigene Anmeldung) und
 * nicht temporäre Zugänge (temp-…@….local).
 */
function echteAdresse(email) {
  const e = String(email || "").trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false
  if (/\.(local|intern)$/.test(e)) return false
  return true
}

/** Nur Unitas? Teilnehmer, oder als einziges Recht die Lernbar. */
function nurUnitas(n) {
  if (n.supervisor) return false
  if (n.role === "teilnehmer") return true
  const p = n.permissions && typeof n.permissions === "object" ? n.permissions : null
  if (!p) return false
  const an = Object.keys(p).filter((k) => p[k] === true)
  return an.length === 1 && an[0] === "lernbar"
}

/**
 * Die E-Mail für einen neuen Benutzer — oder null, wenn er keine bekommt.
 * n: { name, email, role, permissions, supervisor, org: { name, code } | null,
 *      schrift?: CSS mit den @font-face-Regeln zum Einbetten }
 */
function willkommenMail(n) {
  if (!n || !echteAdresse(n.email)) return null
  const email = String(n.email).trim()
  const name = String(n.name || "").trim()
  const org = n.org && (n.org.name || n.org.code) ? n.org : null
  const unitas = nurUnitas(n)

  const q = "email=" + encodeURIComponent(email)
  const anmelden = APP + "/login?" + q
  const passwort = APP + "/login?" + q + "&passwort=neu"
  const seite = org && org.code && !unitas ? APP + "/" + encodeURIComponent(org.code) : ""

  const betreff = "Willkommen bei Responda" + (org && org.name ? " — " + org.name : "")
  const einleitung = "für dich wurde ein Zugang zu Responda eingerichtet" + (org && org.name ? " — bei " + org.name : "") + "."
  const wofuer = unitas
    ? "Nach der Anmeldung findest du Unitas: Neuigkeiten, Termine und Lernmodule deiner Organisation."
    : "Nach der Anmeldung findest du alles, wofür du freigeschaltet bist."

  const zeile = (label, wert) =>
    '<tr><td style="' + F + 'padding:9px 16px 6px 0;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:' + ROT + ';white-space:nowrap;vertical-align:top;">' + label + "</td>" +
    '<td style="' + F + 'padding:6px 0;font-size:15px;color:' + TEXT + ';word-break:break-all;">' + wert + "</td></tr>"

  const inhalt =
    '<div style="' + F + 'background:' + GRUND + ';padding:24px 12px;">' +
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border-left:3px solid ' + ROT + ';padding:28px 24px;' + F + 'color:' + TEXT + ';line-height:1.6;">' +
    '<div style="' + F + 'font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:' + ROT + ';margin-bottom:6px;">Willkommen</div>' +
    '<div style="' + F + 'font-size:24px;font-weight:700;font-style:italic;color:' + ROT + ';margin-bottom:16px;">Servus' + (name ? " " + esc(name) : "") + ",</div>" +
    '<p style="' + F + 'margin:0 0 18px;font-size:15px;">' + esc(einleitung) + " " + esc(wofuer) + "</p>" +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 22px;">' +
    (org && org.name ? zeile("Organisation", esc(org.name)) : "") +
    (org && org.code ? zeile("Org-Code", '<span style="' + F + 'font-weight:700;font-style:italic;color:' + ROT + ';">' + esc(org.code) + "</span>") : "") +
    zeile("Anmeldung", esc(email)) +
    "</table>" +
    '<p style="' + F + 'margin:0 0 12px;font-size:15px;">Als Erstes legst du dein Passwort fest:</p>' +
    '<a href="' + esc(passwort) + '" style="' + F + 'display:inline-block;background:' + ROT + ';color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;">Passwort festlegen</a>' +
    '<p style="' + F + 'margin:22px 0 0;font-size:14px;">Danach meldest du dich mit deiner E-Mail-Adresse an: ' +
    '<a href="' + esc(anmelden) + '" style="' + F + 'color:' + ROT + ';font-weight:700;">Zur App</a>. ' +
    "Hat dir dein Verwalter schon ein Passwort genannt, kannst du dich gleich damit anmelden.</p>" +
    (seite
      ? '<p style="' + F + 'margin:14px 0 0;font-size:14px;">Die Seite deiner Organisation mit ihren Formularen, etwa für CIRS-Meldungen: <a href="' + esc(seite) + '" style="' + F + 'color:' + ROT + ';">' + esc(seite.replace(/^https:\/\//, "")) + "</a></p>"
      : "") +
    '<p style="' + F + 'margin:14px 0 0;font-size:14px;font-style:italic;color:' + GRAU + ';">Tipp: Öffne die App auf dem Handy im Browser und wähle „Zum Home-Bildschirm“ — dann startet Responda wie eine App.</p>' +
    '<p style="' + F + 'margin:24px 0 0;padding-top:14px;border-top:0.5px solid rgba(96,8,18,0.12);font-size:12px;font-style:italic;color:' + GRAU + ';">Diese E-Mail hat Responda automatisch verschickt. Hast du keinen Zugang erwartet, kannst du sie ignorieren.</p>' +
    "</div></div>"

  // Ganzes Dokument: Nur im <head> nehmen E-Mail-Programme die eingebettete Schrift an
  const html =
    '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    "<title>" + esc(betreff) + "</title>" +
    "<style>" + (typeof n.schrift === "string" ? n.schrift : "") +
    "body{margin:0;padding:0;background:" + GRUND + ";" + F + "-webkit-text-size-adjust:100%;}</style>" +
    '</head><body style="margin:0;padding:0;background:' + GRUND + ';">' + inhalt + "</body></html>"

  const text = [
    "Servus" + (name ? " " + name : "") + ",",
    "",
    einleitung + " " + wofuer,
    "",
    org && org.name ? "Organisation: " + org.name : "",
    org && org.code ? "Org-Code: " + org.code : "",
    "Anmeldung: " + email,
    "",
    "Als Erstes legst du dein Passwort fest:",
    passwort,
    "",
    "Danach meldest du dich mit deiner E-Mail-Adresse an: " + anmelden,
    "Hat dir dein Verwalter schon ein Passwort genannt, kannst du dich gleich damit anmelden.",
    seite ? "\nDie Seite deiner Organisation mit ihren Formularen: " + seite : "",
    "",
    "Tipp: Öffne die App auf dem Handy im Browser und wähle „Zum Home-Bildschirm“ — dann startet Responda wie eine App.",
    "",
    "Diese E-Mail hat Responda automatisch verschickt. Hast du keinen Zugang erwartet, kannst du sie ignorieren.",
  ].filter((z, i, a) => z !== "" || a[i - 1] !== "").join("\n")

  return { an: email, betreff: betreff, html: html, text: text }
}

module.exports = { willkommenMail, echteAdresse, nurUnitas, APP }
