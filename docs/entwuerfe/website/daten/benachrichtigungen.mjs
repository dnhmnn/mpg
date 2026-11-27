// Bild „benachrichtigungen“: Benachrichtigungen (/benachrichtigungen) einer Einsatzkraft der Feuerwehr Musterstadt
// (Emre Yilmaz, Rolle Einsatzkraft wie im Bild „benutzer“) am 19.11.2026, 09:41, auf seinem iPhone (App vom
// Homebildschirm): Push auf diesem Gerät an, „Probe senden“, der Hinweis „Keine Alarmierung“, die Anlässe, die Ruhezeit
// (23:00 bis 06:00 Uhr, Mitteilungen der Organisation auch nachts) und darunter die angemeldeten Geräte (iPhone und PC).
// Eine Einsatzkraft statt der Leitung: Für die Leitung listet der Server alle 14 Anlässe, die Ruhezeit stünde weit
// unter dem Bildrand; eine Einsatzkraft bekommt genau zwei (Mitteilung der Organisation, Wartet auf deine Unterschrift).
// Antworten wie GET /api/responda/push/stand (routeStand in pb_hooks/push-versand.js, darfAnlassGrundsaetzlich in
// push-regeln.js: Patientenprotokolle, MPG, Lager, Vorgänge und Ausbildung brauchen Rechte, die die Grundrolle nicht hat).
// Push gibt es im kopflosen Testbrowser nicht (Service Worker gesperrt, keine Erlaubnis). Wie am Gerät nachgestellt:
// eine Erlaubnis „granted“ und ein Abo, dessen Kennung (sha256 des Endpoints, 16 Zeichen) in der Geräteliste steht;
// dann zeigt die Seite den Zustand „an“ (geraetZustand in src/pages/benachrichtigungen/logik.ts).
// Nur erfundene Daten: erfundene Feuerwehr, erfundene Person, kein echter Push-Dienst, kein echter Schlüssel.
import { createHash } from 'node:crypto'

// ORG kommt aus '../daten.mjs', nachgeladen wie in mpg.mjs (ein statischer Import hinge im Kreis fest).
const PERSON_ID = 'emreyilmaz00001'
const PERSON_REC = {}
const ANMELDUNG = { token: '', record: PERSON_REC }
const SAMMLUNG_USERS = []

// Ortszeit -> PocketBase-Zeit in UTC (bis 24.10.2026 Sommerzeit, UTC+2, danach MEZ, UTC+1)
const pb = (tag, hm) => new Date(`${tag}T${hm}:00${tag < '2026-10-25' ? '+02:00' : '+01:00'}`).toISOString().replace('T', ' ')
const kennung = (endpoint) => createHash('sha256').update(endpoint).digest('hex').slice(0, 16)
// Ein unsignierter Token wie in daten.mjs (Ablauf 2100); der Server antwortet nie
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

function aufbauen({ ORG }) {
  Object.assign(PERSON_REC, {
    id: PERSON_ID, collectionId: '_pb_users_auth_', collectionName: 'users', email: `${PERSON_ID}@kein-email.intern`, emailVisibility: false,
    verified: true, name: 'Emre Yilmaz', organization_id: ORG.id, organization_name: ORG.org_name, role: 'benutzer', zusatzrollen: [],
    supervisor: false, permissions: { dashboard: true, lernbar: true, chat: true, notizen: true }, permissions_migrated: true,
    temp_permissions: {}, disabled: false, expires_at: '', hub_apps: { ausgeblendet: [], reihenfolge: [] },
    created: pb('2025-03-01', '10:00'), updated: pb('2026-11-01', '10:00'), hinweis_gesehen_am: pb('2026-11-19', '07:30'),
  })
  ANMELDUNG.token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ id: PERSON_ID, type: 'auth', collectionId: '_pb_users_auth_', exp: 4102444800 })}.probe`
  SAMMLUNG_USERS.push(PERSON_REC)
}
import('../daten.mjs').then(aufbauen)

// Erfundene Abos (.invalid: keine Adresse, die es geben kann)
const ENDPOINT_IPHONE = 'https://push.responda-probe.invalid/abo/iphone-emre-yilmaz'
const ENDPOINT_PC = 'https://push.responda-probe.invalid/abo/pc-emre-yilmaz'

// Öffentlicher Schlüssel in der Form, die die App erwartet (65 Byte, erstes Byte 4); erfunden, gehört zu nichts
const SCHLUESSEL = Buffer.concat([Buffer.from([4]), createHash('sha512').update('responda-website-probe').digest()]).toString('base64url')

// Einstellungen der Person (users.push_einstellungen): Ruhezeit etwas später als vorgegeben, Mitteilungen auch nachts
const PERSON = { v: 1, aus: [], ruhe: { an: true, von: '23:00', bis: '06:00' }, mitteilung_in_ruhe: true }

// Texte wie ANLAESSE in pb_hooks/push-regeln.js; für die Grundrolle nur diese beiden
const ANLAESSE = [
  { key: 'mitteilung', gruppe: 'organisation', titel: 'Mitteilung der Organisation', beschreibung: 'Was die Leitung oder der Supervisor an alle in der Organisation schickt.', art: 'sofort', pflicht: true },
  { key: 'unterschrift', gruppe: 'protokolle', titel: 'Wartet auf deine Unterschrift', beschreibung: 'Ein Protokoll, eine Produktausgabe, eine Einsendung oder eine Defektmeldung mit deinem Namen braucht deine Bestätigung.', art: 'sofort', pflicht: false },
]

const STAND = {
  v: 1, eingerichtet: true, fehlt: [], dienst: true, schluessel: SCHLUESSEL,
  geraete: [
    { id: 'pushgeraetiph01', kennung: kennung(ENDPOINT_IPHONE), geraet: 'iPhone, Homebildschirm', angemeldet: pb('2026-11-16', '07:52') },
    { id: 'pushgeraetpc001', kennung: kennung(ENDPOINT_PC), geraet: 'Windows, Edge', angemeldet: pb('2026-11-03', '18:20') },
  ],
  // Die Organisation hat nichts abgeschaltet (organizations.push_anlaesse), die Person auch nicht
  anlaesse: ANLAESSE.map((a) => ({ ...a, org_an: true, person_an: true })),
  person: PERSON,
  ruhe_jetzt: false,
  darf_organisation: false,
  darf_mitteilung: false,
}

/** Im Browser, vor dem ersten Skript der App: angemeldet als die Person, Erlaubnis erteilt, ein Abo dieses Geräts (wie am iPhone). */
function wieAmGeraet({ endpoint, anmeldung }) {
  try { localStorage.setItem('pocketbase_auth', JSON.stringify(anmeldung)) } catch { /* ohne */ }
  try {
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => 'granted' })
  } catch { /* ohne */ }
  try {
    const abo = {
      endpoint, expirationTime: null, options: { applicationServerKey: null, userVisibleOnly: true },
      getKey: () => null, toJSON: () => ({ endpoint, keys: { p256dh: '', auth: '' } }), unsubscribe: async () => true,
    }
    const reg = {
      scope: location.origin + '/', active: null, installing: null, waiting: null,
      pushManager: { getSubscription: async () => abo, subscribe: async () => abo, permissionState: async () => 'granted' },
      getNotifications: async () => [], update: async () => {}, unregister: async () => true,
      addEventListener() {}, removeEventListener() {},
    }
    const sw = navigator.serviceWorker
    if (sw) Object.defineProperty(sw, 'getRegistration', { configurable: true, value: async () => reg })
  } catch { /* ohne */ }
}

export const bild = {
  name: 'benachrichtigungen',
  pfad: '/benachrichtigungen',
  warte: 1200,
  sammlungen: { users: SAMMLUNG_USERS },
  routen: (methode, url) => {
    // Angemeldet ist hier die Einsatzkraft (der Server bestätigt die Anmeldung mit ihrem Datensatz)
    if (url.pathname === '/api/collections/users/auth-refresh') return { body: ANMELDUNG }
    if (url.pathname === '/api/responda/push/stand' && methode === 'GET') return { body: STAND }
    return undefined
  },
  // Anmeldung und Abo müssen vor der App da sein: einmal mit der Nachstellung neu laden
  vorher: async (page) => {
    await page.addInitScript(wieAmGeraet, { endpoint: ENDPOINT_IPHONE, anmeldung: ANMELDUNG })
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    // Oben bleiben: Kopf, Gerät, „Keine Alarmierung“, Anlässe und die Ruhezeit (Von und Bis stehen am unteren Rand;
    // ihre Uhrzeiten zeigte der Testbrowser ohne deutsche Sprache des Systems als „11:00 PM“)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(300)
    // Zur Kontrolle: wer angemeldet ist und welcher Zustand gilt
    const lage = await page.evaluate(() => ({
      person: JSON.parse(localStorage.getItem('pocketbase_auth') || '{}')?.record?.name,
      zustand: document.querySelector('[data-probe="push-geraet"]')?.getAttribute('data-zustand'),
    }))
    if (process.env.PROTOKOLL) console.log('  ', lage)
  },
}
