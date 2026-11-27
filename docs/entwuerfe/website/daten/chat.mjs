// Bild „chat“: Chat (/chat) der Feuerwehr Musterstadt am 19.11.2026, 09:41. Direktnachrichten zwischen Lena Berger
// und Murat Aksoy nach dem erfundenen Einsatz E-2026-0417 „B3 – Wohnungsbrand“ (Lindenweg 14): zurück an der Wache,
// Fahrzeug wieder aufrüsten, Atemschutz in die Werkstatt, Absaugpumpe im MPG melden (wie im Bild „mpg“), Material im
// Lager nachbuchen (wie im Bild „lager“), Desinfektion eintragen (wie im Bild „hygiene-checkliste“). Nichts über
// die Patientin. Im Verzeichnis (am Telefon vor der Unterhaltung) stehen weitere Direktnachrichten und zwei Kanäle.
//
// Der Chat ist auf dem Gerät verschlüsselt (src/lib/crypto.ts, src/lib/keyManager.ts): AES-GCM je Unterhaltung, der
// Schlüssel der Unterhaltung für jede Person mit ECDH (P-256) verschlüsselt (chat_channel_keys), öffentliche
// Schlüssel in user_keys. Dieses Skript erzeugt dafür bei jedem Lauf frische Testschlüssel und verschlüsselt die
// erfundenen Nachrichten genau so, wie die App es tut; die App entschlüsselt sie selbst. Den privaten Schlüssel von
// Lena Berger findet die App wie nach dem Login in sessionStorage („responda_sk“, verpackt mit dem Token der
// Anmeldung); vor dem Bild wird er dort abgelegt und die Seite neu geladen, dann die Unterhaltung angetippt.
// Nur erfundene Daten: erfundene Feuerwehr, erfundene Personen, Testschlüssel ohne Bedeutung.

const sub = globalThis.crypto.subtle
const b64 = (buf) => Buffer.from(buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf).toString('base64')
const vonB64 = (s) => new Uint8Array(Buffer.from(s, 'base64'))
const text = new TextEncoder()

// Wie src/lib/crypto.ts
async function verschluesseln(schluessel, daten) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const buf = new Uint8Array(await sub.encrypt({ name: 'AES-GCM', iv }, schluessel, text.encode(daten)))
  const alles = new Uint8Array(12 + buf.length)
  alles.set(iv)
  alles.set(buf, 12)
  return b64(alles)
}
const gemeinsam = (priv, pub) => sub.deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
async function schluesselFuer(dokSchluessel, absenderPriv, empfaengerPub) {
  const roh = b64(await sub.exportKey('raw', dokSchluessel))
  return verschluesseln(await gemeinsam(absenderPriv, empfaengerPub), roh)
}

// Ortszeit (MEZ, UTC+1) -> PocketBase-Zeit in UTC
const pb = (tag, hm) => new Date(`${tag}T${hm}:00+01:00`).toISOString().replace('T', ' ')

const ORG_ID = 'orgmusterstadt1' // wie ORG in daten.mjs (ein statischer Import hinge im Kreis fest)
const LENA = 'lenaberger00001'
// Erfundene Personen der Feuerwehr Musterstadt (dieselben wie in den übrigen Bildern)
const PERSONEN = [
  ['maxmustermann01', 'Max Mustermann', 'max.mustermann@example.org'],
  ['annabeispiel001', 'Anna Beispiel', 'anna.beispiel@example.org'],
  ['murataksoy00001', 'Murat Aksoy', 'murat.aksoy@example.org'],
  ['saralindner0001', 'Sara Lindner', 'sara.lindner@example.org'],
]
const NAME = Object.fromEntries([[LENA, 'Lena Berger'], ...PERSONEN.map(([id, name]) => [id, name])])

// Testschlüssel je Person, bei jedem Lauf neu
const PAARE = {}
for (const id of [LENA, ...PERSONEN.map(([i]) => i)]) {
  PAARE[id] = await sub.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
}
const USER_KEYS = []
for (const [id, paar] of Object.entries(PAARE)) {
  USER_KEYS.push({
    id: `uk${id.slice(0, 13)}`, collectionId: 'pbc_user_keys', collectionName: 'user_keys', user: id,
    public_key: b64(await sub.exportKey('spki', paar.publicKey)), encrypted_private_key: '',
    created: pb('2025-03-01', '11:00'), updated: pb('2025-03-01', '11:00'),
  })
}

// Unterhaltungen, die zuletzt aktive zuerst (die App fragt mit sort: '-updated')
const MURAT = 'murataksoy00001'
const DM_MURAT = 'chdmlenamurat01'
const KANAELE = [
  { id: DM_MURAT, name: `${MURAT}_${LENA}`, is_direct: true, members: [MURAT, LENA], von: MURAT, updated: pb('2026-11-19', '09:41') },
  { id: 'chzug1000000001', name: 'Zug 1', is_direct: false, members: [LENA, 'maxmustermann01', 'annabeispiel001', MURAT, 'saralindner0001'], von: LENA, updated: pb('2026-11-19', '09:12') },
  { id: 'chdmlenaanna001', name: `${LENA}_annabeispiel001`, is_direct: true, members: [LENA, 'annabeispiel001'], von: LENA, updated: pb('2026-11-18', '20:47') },
  { id: 'chgeraetewart01', name: 'Gerätewarte', is_direct: false, members: [LENA, 'maxmustermann01', MURAT], von: 'maxmustermann01', updated: pb('2026-11-17', '18:05') },
  { id: 'chdmlenamax0001', name: `maxmustermann01_${LENA}`, is_direct: true, members: ['maxmustermann01', LENA], von: 'maxmustermann01', updated: pb('2026-11-16', '19:30') },
]

// Die Unterhaltung im Bild: [Uhrzeit, von, Text]
const VERLAUF = [
  ['18.11. 20:02', MURAT, 'Bin morgen ab sieben auf der Wache, falls du etwas brauchst.'],
  ['18.11. 20:05', LENA, 'Gut, ich komme gegen neun dazu.'],
  ['09:31', MURAT, 'Sind zurück an der Wache. Das HLF wird gerade wieder aufgerüstet.'],
  ['09:32', LENA, 'Danke! Wie sieht es mit dem Atemschutz aus?'],
  ['09:34', MURAT, 'Zwei Pressluftatmer gehen in die Werkstatt, Ersatz ist schon auf dem Fahrzeug.'],
  ['09:35', MURAT, 'Die Absaugpumpe hat beim Einsatz gestreikt. Ich melde sie gleich im MPG.'],
  ['09:36', LENA, 'Gut, dann ist sie gesperrt, bis sie geprüft ist. Ich schaue, ob im Gerätehaus noch eine steht.'],
  ['09:38', MURAT, 'Handschuhe und Rettungsdecken auf dem HLF sind auch knapp.'],
  ['09:39', LENA, 'Sehe ich im Lager, ich buche nach. Trägst du die Desinfektion vom HLF ein?'],
  ['09:40', MURAT, 'Mache ich, sobald die Halle frei ist.'],
  ['09:41', LENA, 'Danke dir, gute Arbeit heute früh!'],
]

const KANAL_SCHLUESSEL = []
const NACHRICHTEN = []
for (const k of KANAELE) {
  const schluessel = await sub.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  // Wie in Chat.tsx: der Schlüssel der Unterhaltung, von der Person verschlüsselt, die sie angelegt hat
  KANAL_SCHLUESSEL.push({
    id: `ck${k.id.slice(2)}`, collectionId: 'pbc_chat_channel_keys', collectionName: 'chat_channel_keys', channel: k.id, user: LENA, sender: k.von,
    encrypted_key: await schluesselFuer(schluessel, PAARE[k.von].privateKey, PAARE[LENA].publicKey), organization: ORG_ID,
    created: pb('2026-11-01', '18:00'), updated: pb('2026-11-01', '18:00'),
  })
  if (k.id !== DM_MURAT) continue
  let i = 0
  for (const [wann, von, inhalt] of VERLAUF) {
    const [tag, hm] = wann.includes(' ') ? [`2026-11-${wann.slice(0, 2)}`, wann.split(' ')[1]] : ['2026-11-19', wann]
    i++
    NACHRICHTEN.push({
      id: `cm${String(i).padStart(13, '0')}`, collectionId: 'pbc_chat_messages', collectionName: 'chat_messages', channel: k.id, sender: von,
      encrypted_content: await verschluesseln(schluessel, inhalt), organization: ORG_ID, created: pb(tag, hm), updated: pb(tag, hm),
      expand: { sender: { id: von, collectionName: 'users', name: NAME[von] } },
    })
  }
}

const CHANNELS = KANAELE.map(({ von, ...k }) => ({
  ...k, collectionId: 'pbc_chat_channels', collectionName: 'chat_channels', organization: ORG_ID, created: pb('2026-11-01', '18:00'),
}))

const USERS = PERSONEN.map(([id, name, email]) => ({
  id, collectionId: '_pb_users_auth_', collectionName: 'users', name, email, emailVisibility: true, verified: true,
  organization_id: ORG_ID, organization_name: 'Feuerwehr Musterstadt', role: 'benutzer', disabled: false,
  created: pb('2025-03-01', '10:00'), updated: pb('2026-11-01', '10:00'),
}))

// Session wie nach dem Login: privater und öffentlicher Schlüssel, verpackt mit dem Token (keyManager.ts, persistSession)
let ANMELDUNG = null
async function sitzung() {
  const basis = await sub.importKey('raw', text.encode(ANMELDUNG.token), 'PBKDF2', false, ['deriveKey'])
  const huelle = await sub.deriveKey({ name: 'PBKDF2', salt: text.encode('responda-session-v1'), iterations: 1000, hash: 'SHA-256' },
    basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const paar = PAARE[LENA]
  return verschluesseln(huelle, JSON.stringify({ priv: b64(await sub.exportKey('pkcs8', paar.privateKey)), pub: b64(await sub.exportKey('spki', paar.publicKey)) }))
}

const SAMMLUNG_USERS = [...USERS]
import('../daten.mjs').then((d) => { ANMELDUNG = d.ANMELDUNG; SAMMLUNG_USERS.unshift(d.USER) })

// Die App fragt Schlüssel und Nachrichten mit Filtern ab (getFirstListItem); die gemeinsame Antwort kennt keine Filter
const werte = (filter, feld) => [...filter.matchAll(new RegExp(`(?:^|[^_a-z])${feld}\\s*=\\s*"([^"]+)"`, 'g'))].map((m) => m[1])
function routen(methode, url) {
  // Echtzeit: Chat.tsx abonniert neue Nachrichten ohne Fehlerbehandlung (ein Abbruch wäre ein Seitenfehler).
  // Darum hier wie PocketBase eine Verbindung bestätigen (PB_CONNECT, Neuversuch erst nach einer Minute) und das
  // Anmelden der Abos (POST) annehmen. Neue Nachrichten kommen keine.
  if (url.pathname === '/api/realtime') {
    return methode === 'GET'
      ? { typ: 'text/event-stream', body: 'retry: 60000\nid: probeverbindung\nevent: PB_CONNECT\ndata: {"clientId":"probeverbindung"}\n\n' }
      : { status: 204, body: '' }
  }
  if (methode !== 'GET') return undefined
  const m = url.pathname.match(/^\/api\/collections\/(user_keys|chat_channel_keys|chat_messages)\/records$/)
  if (!m) return undefined
  const filter = url.searchParams.get('filter') || ''
  let items = []
  if (m[1] === 'user_keys') items = USER_KEYS.filter((x) => werte(filter, 'user').includes(x.user))
  if (m[1] === 'chat_channel_keys') items = KANAL_SCHLUESSEL.filter((x) => werte(filter, 'channel').includes(x.channel) && werte(filter, 'user').includes(x.user))
  if (m[1] === 'chat_messages') items = NACHRICHTEN.filter((x) => werte(filter, 'channel').includes(x.channel))
  const perPage = Number(url.searchParams.get('perPage') || 30)
  return { body: { page: 1, perPage, totalItems: items.length, totalPages: 1, items } }
}

export const bild = {
  name: 'chat',
  pfad: '/chat',
  warte: 900,
  sammlungen: { users: SAMMLUNG_USERS, chat_channels: CHANNELS },
  routen,
  vorher: async (page) => {
    await page.evaluate((s) => sessionStorage.setItem('responda_sk', s), await sitzung())
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    await page.locator('.chat-channel-item', { hasText: 'Murat Aksoy' }).click()
    await page.waitForTimeout(1500)
  },
}
