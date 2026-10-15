// Baut die Willkommens-E-Mail für einen neuen Benutzer.
// Wird von willkommen.pb.js per require() genutzt (kein eigener Hook, daher
// .js statt .pb.js). Reine Funktion ohne PocketBase — so prüfen die Tests der
// App sie mit (src/lib/__tests__/willkommen.test.ts).
//
// Inhalt: Link zur App, Organisation und Org-Code, die Anmelde-Adresse und
// "Passwort festlegen" (öffnet die Anmeldung mit "Passwort vergessen"). Ein
// Passwort steht nie in der E-Mail.

const APP = "https://app.responda.systems"

const ROT = "#600812"
const TEXT = "#1a0e08"
const GRAU = "#8a7a68"
const GRUND = "#faf9f7"

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
 * n: { name, email, role, permissions, supervisor, org: { name, code } | null }
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
    '<tr><td style="padding:9px 16px 6px 0;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:' + ROT + ';white-space:nowrap;vertical-align:top;">' + label + "</td>" +
    '<td style="padding:6px 0;font-size:15px;color:' + TEXT + ';word-break:break-all;">' + wert + "</td></tr>"

  const html =
    '<div style="background:' + GRUND + ';padding:24px 12px;">' +
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border-left:3px solid ' + ROT + ";padding:28px 24px;font-family:'Atkinson Hyperlegible',Helvetica,Arial,sans-serif;color:" + TEXT + ';line-height:1.6;">' +
    '<div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:' + ROT + ';margin-bottom:6px;">Willkommen</div>' +
    '<div style="font-size:24px;font-weight:700;font-style:italic;color:' + ROT + ';margin-bottom:16px;">Servus' + (name ? " " + esc(name) : "") + ",</div>" +
    '<p style="margin:0 0 18px;font-size:15px;">' + esc(einleitung) + " " + esc(wofuer) + "</p>" +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 22px;">' +
    (org && org.name ? zeile("Organisation", esc(org.name)) : "") +
    (org && org.code ? zeile("Org-Code", '<span style="font-weight:700;font-style:italic;color:' + ROT + ';">' + esc(org.code) + "</span>") : "") +
    zeile("Anmeldung", esc(email)) +
    "</table>" +
    '<a href="' + esc(anmelden) + '" style="display:inline-block;background:' + ROT + ';color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;">Zur App</a>' +
    '<p style="margin:22px 0 0;font-size:14px;">Hast du von deinem Verwalter schon ein Passwort bekommen, meldest du dich damit an. Sonst legst du hier selbst eines fest: ' +
    '<a href="' + esc(passwort) + '" style="color:' + ROT + ';font-weight:700;">Passwort festlegen</a></p>' +
    (seite
      ? '<p style="margin:14px 0 0;font-size:14px;">Die Seite deiner Organisation mit ihren Formularen, etwa für CIRS-Meldungen: <a href="' + esc(seite) + '" style="color:' + ROT + ';">' + esc(seite.replace(/^https:\/\//, "")) + "</a></p>"
      : "") +
    '<p style="margin:14px 0 0;font-size:14px;font-style:italic;color:' + GRAU + ';">Tipp: Öffne die App auf dem Handy im Browser und wähle „Zum Home-Bildschirm“ — dann startet Responda wie eine App.</p>' +
    '<p style="margin:24px 0 0;padding-top:14px;border-top:0.5px solid rgba(96,8,18,0.12);font-size:12px;font-style:italic;color:' + GRAU + ';">Diese E-Mail hat Responda automatisch verschickt. Hast du keinen Zugang erwartet, kannst du sie ignorieren.</p>' +
    "</div></div>"

  const text = [
    "Servus" + (name ? " " + name : "") + ",",
    "",
    einleitung + " " + wofuer,
    "",
    org && org.name ? "Organisation: " + org.name : "",
    org && org.code ? "Org-Code: " + org.code : "",
    "Anmeldung: " + email,
    "",
    "Zur App: " + anmelden,
    "",
    "Hast du von deinem Verwalter schon ein Passwort bekommen, meldest du dich damit an. Sonst legst du hier selbst eines fest:",
    passwort,
    seite ? "\nDie Seite deiner Organisation mit ihren Formularen: " + seite : "",
    "",
    "Tipp: Öffne die App auf dem Handy im Browser und wähle „Zum Home-Bildschirm“ — dann startet Responda wie eine App.",
    "",
    "Diese E-Mail hat Responda automatisch verschickt. Hast du keinen Zugang erwartet, kannst du sie ignorieren.",
  ].filter((z, i, a) => z !== "" || a[i - 1] !== "").join("\n")

  return { an: email, betreff: betreff, html: html, text: text }
}

module.exports = { willkommenMail, echteAdresse, nurUnitas, APP }
