#!/usr/bin/env node
// Vorprüfung vor der Einführung der Absender in den öffentlichen Formularen (nur lesend).
//
// Zeigt je Organisation, wer nicht mit Passwort bestätigen kann (Name unvollständig, Name
// doppelt, ohne E-Mail und damit ohne Passwort), dazu als Hinweis „E-Mail nie bestätigt“, und
// prüft den Server: fehlende Felder (absender_status, reporter_status), Trusted proxy, offene
// Protokolle mit abgelaufener Frist (die schließt der reparierte Frist-Lauf beim ersten Lauf
// auf einmal ab), alte Entwürfe, ob users ohne Anmeldung lesbar ist und wie viele Konten ihre
// E-Mail zeigen.
//
// Aufruf (Superuser, es gibt KEINEN Vorgabewert für die Adresse):
//   PB_URL=https://… PB_SUPERUSER_EMAIL=… PB_SUPERUSER_PASSWORT=… node scripts/formular-vorpruefung.mjs [--json]
//
// Schreibt nichts. Dieselben Regeln wie der Server (pb_hooks/formular-regeln.js, per node:vm).

import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const URL_ = (process.env.PB_URL || '').replace(/\/+$/, '')
const EMAIL = process.env.PB_SUPERUSER_EMAIL || ''
const PASSWORT = process.env.PB_SUPERUSER_PASSWORT || ''
const ALS_JSON = process.argv.includes('--json')

if (!URL_ || !EMAIL || !PASSWORT) {
  console.error('Bitte PB_URL, PB_SUPERUSER_EMAIL und PB_SUPERUSER_PASSWORT setzen. Es gibt keinen Vorgabewert für die Adresse.')
  process.exit(2)
}

const modul = { exports: {} }
runInNewContext(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'pb_hooks', 'formular-regeln.js'), 'utf8'), { module: modul, exports: modul.exports })
const R = modul.exports

async function hole(pfad, token) {
  const r = await fetch(URL_ + pfad, { headers: token ? { Authorization: token } : {} })
  let json = null
  try { json = await r.json() } catch { json = null }
  return { status: r.status, json }
}

async function alle(sammlung, token, felder, filter = '') {
  const aus = []
  for (let seite = 1; ; seite++) {
    const q = `?page=${seite}&perPage=500&skipTotal=1${felder ? `&fields=${encodeURIComponent(felder)}` : ''}${filter ? `&filter=${encodeURIComponent(filter)}` : ''}`
    const r = await hole(`/api/collections/${sammlung}/records${q}`, token)
    if (r.status !== 200) throw new Error(`${sammlung}: ${r.status} ${JSON.stringify(r.json)}`)
    aus.push(...r.json.items)
    if (r.json.items.length < 500) return aus
  }
}

const anmeldung = await fetch(`${URL_}/api/collections/_superusers/auth-with-password`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: EMAIL, password: PASSWORT }),
})
if (anmeldung.status !== 200) {
  console.error(`Anmeldung als Superuser fehlgeschlagen: ${anmeldung.status}`)
  process.exit(1)
}
const token = (await anmeldung.json()).token
const jetzt = Date.now()

// Felder
const felder = {}
for (const [s, f] of [['patients', 'absender_status'], ['product_outputs', 'absender_status'], ['mpg_defect_reports', 'reporter_status']]) {
  const c = await hole(`/api/collections/${s}`, token)
  felder[`${s}.${f}`] = c.status === 200 ? (c.json.fields || []).some((x) => x.name === f) : null
}

// Laufen die Hooks schon? (Die Felder erst danach anlegen, Schritt 5)
const hooksDa = (await hole('/api/responda/formular/diagnose', token)).status === 200

// Trusted proxy
const settings = await hole('/api/settings', token)
const proxy = settings.json?.trustedProxy?.headers || []

// users ohne Anmeldung lesbar?
const anonym = await hole('/api/collections/users/records?perPage=1')
const usersAnonym = anonym.status === 200 && (anonym.json?.totalItems > 0 || anonym.json?.items?.length > 0)

const orgs = await alle('organizations', token, 'id,org_code,org_name,is_active')
const users = await alle('users', token, '')
const offen = await alle('patients', token, felder['patients.absender_status'] ? 'id,organization_id,title,payload,absender_status' : 'id,organization_id,title,payload', "status = 'offen'")

const personen = users.map((u) => ({
  id: u.id, name: u.name || '', email: u.email || '', verified: !!u.verified, role: u.role || '', supervisor: u.supervisor === true,
  disabled: u.disabled === true, expires_at: u.expires_at || '', organization_id: u.organization_id || '',
  permissions: u.permissions || {}, temp_permissions: u.temp_permissions || {}, emailVisibility: u.emailVisibility === true,
}))

const bericht = []
for (const o of orgs) {
  const eigene = personen.filter((p) => p.organization_id === o.id)
  const pr = R.mitgliederPruefen(eigene, o.id, jetzt)
  const nieBestaetigt = eigene.filter((p) => R.istVerknuepfbar(p, o.id, jetzt) && !p.verified && !p.email.toLowerCase().endsWith(R.PLATZHALTER_ENDUNG))
  const protokolle = offen.filter((x) => x.organization_id === o.id)
  let abgelaufen = 0, entwuerfe = 0, ausstehend = 0
  for (const x of protokolle) {
    const p = R.payloadLesen(x.payload) || {}
    // Wie der Frist-Lauf: mit Feld zählt nur das Feld (ein payload.absender ohne Feld stammt aus der Zeit ohne Hooks)
    const wartet = felder['patients.absender_status'] ? x.absender_status === 'ausstehend' : R.wartetAufUnterschrift(p)
    if (wartet) { ausstehend++; continue }
    const f = Date.parse(String(p.frist || ''))
    if (Number.isFinite(f) && f <= jetzt) abgelaufen++
    if (/^Entwurf/.test(String(x.title || ''))) entwuerfe++
  }
  bericht.push({
    org: { id: o.id, code: o.org_code, name: o.org_name, aktiv: o.is_active === true },
    mitglieder: pr.gesamt,
    koennen_nicht: pr.koennen_nicht,
    doppelt: pr.doppelt,
    eintraege: pr.eintraege,
    email_nie_bestaetigt: nieBestaetigt.map((p) => ({ id: p.id, name: p.name })),
    offen_frist_abgelaufen: abgelaufen,
    offen_entwuerfe: entwuerfe,
    offen_ausstehend: ausstehend,
  })
}

const gesamt = {
  felder,
  hooks_da: hooksDa,
  trusted_proxy: proxy,
  users_anonym_lesbar: usersAnonym,
  konten_mit_sichtbarer_email: personen.filter((p) => p.emailVisibility).length,
  organisationen: bericht,
}

if (ALS_JSON) {
  console.log(JSON.stringify(gesamt, null, 2))
  process.exit(0)
}

const GRUND = { name_unvollstaendig: 'Name unvollständig', name_doppelt: 'Name doppelt', ohne_email: 'ohne E-Mail, kein Passwort' }
const z = []
z.push(`Vorprüfung ${URL_} (${new Date(jetzt).toISOString()}), nur lesend`)
z.push('')
z.push('SERVER')
z.push(`  Formular-Hooks: ${hooksDa ? 'laufen' : 'noch nicht da (Schritt 4)'}`)
const feldText = (v) => {
  if (v === null) return 'Sammlung fehlt'
  if (hooksDa) return v ? 'da' : 'FEHLT (Schritt 5: jetzt anlegen, Plain text, nicht Pflicht)'
  // Vor den Hooks setzt niemand die Felder: ein Wert darin wäre ungeprüft
  return v ? 'schon da, vor den Hooks. Der erste Start der Hooks leert gesetzte Werte einmal.' : 'noch nicht da (richtig: erst nach den Hooks anlegen, Schritt 5)'
}
for (const [k, v] of Object.entries(felder)) z.push(`  Feld ${k}: ${feldText(v)}`)
z.push(`  Trusted proxy: ${proxy.length ? proxy.join(', ') : 'leer (richtig nur ohne Proxy; Schritt 1 prüfen)'}`)
z.push(`  users ohne Anmeldung lesbar: ${usersAnonym ? 'JA (Schritt 7 schließt das)' : 'nein'}`)
z.push(`  Konten mit sichtbarer E-Mail: ${gesamt.konten_mit_sichtbarer_email} (Schritt 7: scripts/emails-verbergen.mjs)`)
for (const b of bericht) {
  z.push('')
  z.push(`ORGANISATION ${b.org.name} (${b.org.code})${b.org.aktiv ? '' : ', nicht aktiv'}`)
  z.push(`  Mitglieder, die verknüpft werden können: ${b.mitglieder}`)
  // Doppelte Namen bestätigen mit Passwort (der Server prüft jeden Kandidaten); sie fehlen nur in der Besatzung und ohne Passwort
  const nichtPw = b.eintraege.filter((e) => e.gruende.includes('name_unvollstaendig') || e.gruende.includes('ohne_email'))
  const doppelte = b.eintraege.filter((e) => e.gruende.includes('name_doppelt'))
  z.push(`  Können nicht mit Passwort bestätigen: ${b.koennen_nicht}`)
  for (const e of nichtPw) z.push(`    ${e.name || '(ohne Namen)'} · ${e.gruende.map((g) => GRUND[g] || g).join(', ')}`)
  if (doppelte.length) {
    z.push(`  Name doppelt (Passwort geht; in der Besatzung und ohne Passwort nicht erkannt): ${b.doppelt}`)
    for (const e of doppelte) z.push(`    ${e.name || '(ohne Namen)'}`)
  }
  if (b.email_nie_bestaetigt.length) {
    z.push(`  Hinweis, E-Mail nie bestätigt (vielleicht nie ein Passwort festgelegt): ${b.email_nie_bestaetigt.length}`)
    for (const p of b.email_nie_bestaetigt) z.push(`    ${p.name || '(ohne Namen)'}`)
  }
  z.push(`  Offene Protokolle mit abgelaufener Frist: ${b.offen_frist_abgelaufen} (schließt der erste Frist-Lauf ab)`)
  z.push(`  Offene alte Entwürfe: ${b.offen_entwuerfe}`)
  if (b.offen_ausstehend) z.push(`  Offen, Unterschrift ausstehend: ${b.offen_ausstehend}`)
}
console.log(z.join('\n'))
