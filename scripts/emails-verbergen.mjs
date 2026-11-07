#!/usr/bin/env node
// Bestehende Konten: E-Mail für andere Mitglieder verbergen (emailVisibility = false).
//
// Die App legt neue Konten schon mit emailVisibility false an. Dieses Skript stellt die
// bestehenden um. Wer die Manage-Regel von users erfüllt (Leitung, Benutzerverwaltung,
// Supervisor), sieht E-Mails weiter; andere Mitglieder nicht mehr.
//
// Erst NACH dem Schließen von users List/View (Einführung Schritt 7) ausführen.
//
// Aufruf (Superuser, es gibt KEINEN Vorgabewert für die Adresse):
//   PB_URL=https://… PB_SUPERUSER_EMAIL=… PB_SUPERUSER_PASSWORT=… node scripts/emails-verbergen.mjs              (Probelauf: zählt nur)
//   PB_URL=https://… PB_SUPERUSER_EMAIL=… PB_SUPERUSER_PASSWORT=… node scripts/emails-verbergen.mjs --ausfuehren (stellt um)

const URL_ = (process.env.PB_URL || '').replace(/\/+$/, '')
const EMAIL = process.env.PB_SUPERUSER_EMAIL || ''
const PASSWORT = process.env.PB_SUPERUSER_PASSWORT || ''
const AUSFUEHREN = process.argv.includes('--ausfuehren')

if (!URL_ || !EMAIL || !PASSWORT) {
  console.error('Bitte PB_URL, PB_SUPERUSER_EMAIL und PB_SUPERUSER_PASSWORT setzen. Es gibt keinen Vorgabewert für die Adresse.')
  process.exit(2)
}

const anmeldung = await fetch(`${URL_}/api/collections/_superusers/auth-with-password`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: EMAIL, password: PASSWORT }),
})
if (anmeldung.status !== 200) {
  console.error(`Anmeldung als Superuser fehlgeschlagen: ${anmeldung.status}`)
  process.exit(1)
}
const token = (await anmeldung.json()).token

async function sichtbare() {
  const ids = []
  for (let seite = 1; ; seite++) {
    const r = await fetch(`${URL_}/api/collections/users/records?page=${seite}&perPage=500&skipTotal=1&fields=id&filter=${encodeURIComponent('emailVisibility = true')}`, { headers: { Authorization: token } })
    if (r.status !== 200) throw new Error(`users lesen: ${r.status} ${await r.text()}`)
    const j = await r.json()
    ids.push(...j.items.map((x) => x.id))
    if (j.items.length < 500) return ids
  }
}

const ids = await sichtbare()
console.log(`Konten mit sichtbarer E-Mail: ${ids.length}`)
if (!AUSFUEHREN) {
  console.log('Probelauf, nichts geändert. Zum Umstellen mit --ausfuehren aufrufen.')
  process.exit(0)
}

let ok = 0
const fehler = []
for (const id of ids) {
  const r = await fetch(`${URL_}/api/collections/users/records/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: token }, body: JSON.stringify({ emailVisibility: false }),
  })
  if (r.status === 200) ok++
  else fehler.push(`${id}: ${r.status}`)
}
console.log(`Umgestellt: ${ok} von ${ids.length}`)
if (fehler.length) {
  console.log('Nicht umgestellt:')
  for (const f of fehler) console.log('  ' + f)
  process.exit(1)
}
const rest = await sichtbare()
console.log(`Danach noch sichtbar: ${rest.length}`)
process.exit(rest.length === 0 ? 0 : 1)
