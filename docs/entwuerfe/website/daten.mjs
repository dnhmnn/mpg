// Erfundene Testdaten für die Bilder der Website (aufnahme.mjs). Keine echten Personen, keine echten
// Organisationen, keine Patientendaten. Antworten wie PocketBase sie gibt, nur so viel wie nötig.

const JETZT = '2026-11-19 08:41:00.000Z'
const ORG_ID = 'orgmusterstadt1'
const USER_ID = 'lenaberger00001'

// Ein unsignierter Token, der nur für die App „gültig“ aussieht (Ablauf 2100); der Server antwortet nie
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ id: USER_ID, type: 'auth', collectionId: '_pb_users_auth_', exp: 4102444800 })}.probe`

const ALLE_RECHTE = Object.fromEntries(['dashboard', 'lernbar', 'chat', 'notizen', 'mpg_verwalten', 'einsaetze', 'lager', 'lager_verwalten',
  'produktausgabe', 'ausbildungen_manage', 'dokumente', 'patienten', 'dateien', 'qr', 'unitarii'].map((k) => [k, true]))

export const ORG = {
  id: ORG_ID, collectionId: 'pbc_org', collectionName: 'organizations', org_name: 'Feuerwehr Musterstadt', org_code: 'ff-musterstadt',
  logo: '', is_active: true, created: '2025-03-01 10:00:00.000Z', updated: JETZT, form_config: {},
}

export const USER = {
  id: USER_ID, collectionId: '_pb_users_auth_', collectionName: 'users', email: 'lena.berger@example.org', emailVisibility: false, verified: true,
  name: 'Lena Berger', organization_id: ORG_ID, organization_name: ORG.org_name, role: 'admin', zusatzrollen: [], supervisor: false,
  permissions: ALLE_RECHTE, permissions_migrated: true, disabled: false, expires_at: '', created: '2025-03-01 10:00:00.000Z', updated: JETZT,
  // Im Hub ausgeblendet (wie es jede Person selbst kann): Einsätze und Ausbildungen zeigt die Website nicht
  hub_apps: { ausgeblendet: ['einsaetze', 'ausbildungen'], reihenfolge: [] }, hinweis_gesehen_am: JETZT,
}

export const ANMELDUNG = { token: TOKEN, record: USER }

// Sammlungen: Name -> Datensätze. Seiten, die mehr brauchen, ergänzen hier.
export const SAMMLUNGEN = {
  organizations: [ORG],
  users: [USER],
}

function liste(items, url) {
  const perPage = Number(url.searchParams.get('perPage') || 30)
  return { page: 1, perPage, totalItems: items.length, totalPages: 1, items }
}

/**
 * Antwort auf eine Anfrage an die API; 'abbrechen' für Echtzeit. bild: das gerade aufgenommene Bild
 * (seine sammlungen ergänzen bzw. ersetzen die gemeinsamen, seine routen gehen vor).
 */
export function antwort(methode, url, body, bild = {}) {
  const p = url.pathname
  const eigen = bild.routen?.(methode, url, body)
  if (eigen) return eigen
  if (p.startsWith('/api/realtime')) return 'abbrechen'
  if (p === '/api/collections/users/auth-refresh') return { body: ANMELDUNG }
  const m = p.match(/^\/api\/collections\/([^/]+)\/records(?:\/([^/]+))?$/)
  if (m) {
    const daten = (bild.sammlungen && bild.sammlungen[m[1]]) || SAMMLUNGEN[m[1]] || []
    if (m[2]) {
      const d = daten.find((x) => x.id === m[2])
      return d ? { body: d } : { status: 404, body: { status: 404, message: 'Not found', data: {} } }
    }
    if (methode !== 'GET') return { body: { id: 'neu', ...(body ? JSON.parse(body) : {}) } }
    return { body: liste(daten, url) }
  }
  if (p.startsWith('/api/files/')) return { status: 404, body: {} }
  // Eigene Routen (Formulare, Push …): leer, aber gültig
  return { body: {} }
}

// Je Bild eine Datei in daten/ (export const bild = { name, pfad, thema?, warte?, sammlungen?, routen?, vorher? })
const ORDNER = new URL('./daten/', import.meta.url)
const { readdirSync, existsSync } = await import('node:fs')
const teile = existsSync(ORDNER) ? readdirSync(ORDNER).filter((f) => f.endsWith('.mjs')).sort() : []
const weitere = []
for (const f of teile) weitere.push((await import(new URL(f, ORDNER).href)).bild)

/** Die Bilder: Name, Pfad in der App, optional Thema und Schritte vor dem Bild. */
export const BILDER = [
  { name: 'hub', pfad: '/hub' },
  ...weitere,
]
