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
// Eigene Formulare (docs/formulare-absender-einfuehrung.md, Schritt 0): die Felder von
// form_templates, form_submissions und mpg_defect_reports.eigene (welche vor der App, welche erst
// nach den Hooks), die heutigen Regeln von form_templates, form_submissions und cirs_reports (zum
// Notieren für eine Rücknahme, verglichen mit docs/pocketbase-regeln.md), ob Einsendungen ohne
// Anmeldung lesbar sind, ob template_id Text oder Relation ist und wie groß die JSON-Felder sein
// dürfen.
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

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const modul = { exports: {} }
runInNewContext(readFileSync(join(REPO, 'pb_hooks', 'formular-regeln.js'), 'utf8'), { module: modul, exports: modul.exports })
const R = modul.exports

/** Regel aus docs/pocketbase-regeln.md (Codeblock nach **label** im Abschnitt), sonst null. */
function regelAusDoku(abschnittTitel, endeTitel, label) {
  let doku = ''
  try { doku = readFileSync(join(REPO, 'docs', 'pocketbase-regeln.md'), 'utf8') } catch { return null }
  const start = doku.indexOf(abschnittTitel)
  if (start < 0) return null
  const ende = doku.indexOf(endeTitel, start + 1)
  const abschnitt = doku.slice(start, ende < 0 ? undefined : ende)
  const i = abschnitt.indexOf(`**${label}**`)
  if (i < 0) return null
  const a = abschnitt.indexOf('```\n', i) + 4
  const b = abschnitt.indexOf('\n```', a)
  return abschnitt.slice(a, b).trim()
}
const ohneLeerraum = (x) => (x === null || x === undefined ? null : String(x).replace(/\s+/g, ' ').trim())

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

// Laufen die Hooks schon? (Die Felder erst danach anlegen, Schritt 6 der Einführung)
const hooksDa = (await hole('/api/responda/formular/diagnose', token)).status === 200

// Eigene Formulare: Felder (vor der App / nach den Hooks), Regeln, Größen, template_id
const EIGENE_FELDER = [
  ['form_templates', 'absender', 'vor'], ['form_templates', 'archiviert', 'vor'], ['form_templates', 'abschnitte', 'vor'],
  ['form_templates', 'version', 'nach'], ['form_templates', 'fassungen', 'nach'],
  ['form_submissions', 'status', 'nach'], ['form_submissions', 'notiz', 'nach'], ['form_submissions', 'absender_status', 'nach'], ['form_submissions', 'bearbeitung', 'nach'],
  ['mpg_defect_reports', 'eigene', 'nach'],
]
const sammlungen = {}
for (const s of ['form_templates', 'form_submissions', 'cirs_reports', 'mpg_defect_reports']) {
  const c = await hole(`/api/collections/${s}`, token)
  sammlungen[s] = c.status === 200 ? c.json : null
}
const feldVon = (s, f) => (sammlungen[s]?.fields || []).find((x) => x.name === f) || null
const felderEigene = {}
for (const [s, f, wann] of EIGENE_FELDER) felderEigene[`${s}.${f}`] = { da: sammlungen[s] ? !!feldVon(s, f) : null, wann }
const REGEL_ARTEN = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']
const EIG = (label) => regelAusDoku('### Eigene Formulare: API-Regeln', '### Felder', label)
const einsendungenRegel = EIG('Einsendungen List, View und Update')
// Soll nach Schritt 2 (undefined: nicht vorgegeben, bleibt wie es ist)
const SOLL = {
  form_templates: { listRule: '', viewRule: '', createRule: EIG('Vorlagen Create'), updateRule: EIG('Vorlagen Update'), deleteRule: EIG('Vorlagen Delete') },
  form_submissions: { listRule: einsendungenRegel, viewRule: einsendungenRegel, createRule: undefined, updateRule: einsendungenRegel, deleteRule: null },
  cirs_reports: {},
}
const regeln = {}
const regelnWieDoku = {}
for (const s of Object.keys(SOLL)) {
  if (!sammlungen[s]) { regeln[s] = null; continue }
  regeln[s] = Object.fromEntries(REGEL_ARTEN.map((k) => [k, sammlungen[s][k] === undefined ? null : sammlungen[s][k]]))
  for (const k of REGEL_ARTEN) {
    if (!(k in SOLL[s]) || SOLL[s][k] === undefined) continue
    regelnWieDoku[`${s}.${k}`] = ohneLeerraum(regeln[s][k]) === ohneLeerraum(SOLL[s][k])
  }
}
// Einsendungen ohne Anmeldung lesbar? (offen hieße: alle Einsendungen aller Organisationen öffentlich)
const einsAnonym = sammlungen.form_submissions ? await hole('/api/collections/form_submissions/records?perPage=1') : { status: 0 }
const einsendungenAnonymLesbar = einsAnonym.status === 200 && (einsAnonym.json?.totalItems > 0 || einsAnonym.json?.items?.length > 0)
// Offen heißt: List oder View als leerer Text. Mit den Hooks hält eigene-formulare.pb.js die Liste trotzdem dicht.
const einsendungenRegelOffen = !!regeln.form_submissions && (regeln.form_submissions.listRule === '' || regeln.form_submissions.viewRule === '')
const templateIdTyp = feldVon('form_submissions', 'template_id')?.type || null
// Größe der JSON-Felder (PocketBase: 0 heißt 1 MB). Empfehlung aus docs/pocketbase-regeln.md, „Felder“
const GROESSE_EMPFOHLEN = { 'form_templates.schema': 2_000_000, 'form_templates.fassungen': 8_000_000, 'form_submissions.payload': 2_000_000 }
const jsonGroessen = {}
for (const k of Object.keys(GROESSE_EMPFOHLEN)) {
  const [s, f] = k.split('.')
  const x = feldVon(s, f)
  jsonGroessen[k] = x ? { maxSize: x.maxSize || 0, empfohlen: GROESSE_EMPFOHLEN[k] } : null
}
let vorlagenZahl = null, einsendungenZahl = null
if (sammlungen.form_templates) vorlagenZahl = (await hole('/api/collections/form_templates/records?perPage=1', token)).json?.totalItems ?? null
if (sammlungen.form_submissions) einsendungenZahl = (await hole('/api/collections/form_submissions/records?perPage=1', token)).json?.totalItems ?? null

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
  eigene: {
    felder: felderEigene,
    regeln,
    regeln_wie_doku: regelnWieDoku,
    einsendungen_anonym_lesbar: einsendungenAnonymLesbar,
    einsendungen_regel_offen: einsendungenRegelOffen,
    template_id_typ: templateIdTyp,
    json_groessen: jsonGroessen,
    vorlagen: vorlagenZahl,
    einsendungen: einsendungenZahl,
  },
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
z.push(`  Formular-Hooks: ${hooksDa ? 'laufen' : 'noch nicht da (Schritt 5)'}`)
const feldText = (v) => {
  if (v === null) return 'Sammlung fehlt'
  if (hooksDa) return v ? 'da' : 'FEHLT (Schritt 6: jetzt anlegen, Plain text, nicht Pflicht)'
  // Vor den Hooks setzt niemand die Felder: ein Wert darin wäre ungeprüft
  return v ? 'schon da, vor den Hooks. Der erste Start der Hooks leert gesetzte Werte einmal.' : 'noch nicht da (richtig: erst nach den Hooks anlegen, Schritt 6)'
}
for (const [k, v] of Object.entries(felder)) z.push(`  Feld ${k}: ${feldText(v)}`)
z.push(`  Trusted proxy: ${proxy.length ? proxy.join(', ') : 'leer (richtig nur ohne Proxy; Schritt 1 prüfen)'}`)
z.push(`  users ohne Anmeldung lesbar: ${usersAnonym ? 'JA (Schritt 8 schließt das)' : 'nein'}`)
z.push(`  Konten mit sichtbarer E-Mail: ${gesamt.konten_mit_sichtbarer_email} (Schritt 8: scripts/emails-verbergen.mjs)`)
z.push('')
z.push('EIGENE FORMULARE')
z.push(`  Vorlagen: ${vorlagenZahl ?? 'Sammlung form_templates fehlt'}, Einsendungen: ${einsendungenZahl ?? 'Sammlung form_submissions fehlt'}`)
const eigenesFeldText = (v) => {
  if (v.da === null) return 'Sammlung fehlt'
  if (v.wann === 'vor') return v.da ? 'da' : 'FEHLT (Schritt 2: vor der App anlegen)'
  if (hooksDa) return v.da ? 'da' : 'FEHLT (Schritt 6: jetzt anlegen, nach den Hooks)'
  return v.da ? 'schon da, vor den Hooks. Was dort steht, setzt bis zu den Hooks niemand geprüft.' : 'noch nicht da (richtig: erst nach den Hooks anlegen, Schritt 6)'
}
for (const [k, v] of Object.entries(felderEigene)) z.push(`  Feld ${k}: ${eigenesFeldText(v)}`)
z.push(`  Einsendungen ohne Anmeldung lesbar: ${einsendungenAnonymLesbar ? 'JA, alle Einsendungen aller Organisationen (Schritt 2 schließt das)' : einsendungenRegelOffen ? 'Regel offen, die Hooks halten dicht (Regel trotzdem setzen, Schritt 2)' : 'nein'}`)
z.push(`  form_submissions.template_id: ${templateIdTyp === null ? 'fehlt' : templateIdTyp === 'relation' ? 'Relation (geht)' : templateIdTyp === 'text' ? 'Text (geht)' : templateIdTyp}`)
for (const [k, v] of Object.entries(jsonGroessen)) {
  if (!v) { z.push(`  Größe ${k}: Feld fehlt`); continue }
  const ist = v.maxSize || 1_000_000
  z.push(`  Größe ${k}: ${v.maxSize ? v.maxSize + ' Bytes' : 'Vorgabe (1 MB)'}${ist < v.empfohlen ? `, bitte auf ${v.empfohlen} setzen` : ', reicht'}`)
}
z.push('  Regeln heute (für eine Rücknahme notieren):')
const regelText = (x) => (x === null ? 'gesperrt (null)' : x === '' ? 'öffentlich (leer)' : x)
for (const [s, r] of Object.entries(regeln)) {
  if (!r) { z.push(`    ${s}: Sammlung fehlt`); continue }
  for (const k of REGEL_ARTEN) {
    const vergleich = regelnWieDoku[`${s}.${k}`]
    const zusatz = vergleich === undefined ? '' : vergleich ? '  [wie in der Doku]' : '  [ANDERS als in der Doku, Schritt 2]'
    z.push(`    ${s}.${k}: ${regelText(r[k])}${zusatz}`)
  }
}
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
