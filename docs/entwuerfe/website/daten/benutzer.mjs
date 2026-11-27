// Bild „benutzer“: Benutzerverwaltung (/unitarii) der Feuerwehr Musterstadt am 19.11.2026, 09:41, Reiter Benutzer:
// alle Mitglieder nach Namen, je mit Farbfeld der ersten Rolle und ihren Rollen (mehrere zählen zusammen, src/lib/rollen.ts),
// dazu zwei eigene Rollen der Organisation (Atemschutzgerätewart, Hygienebeauftragte), Teilnehmende der Grundausbildung,
// ein befristetes Recht (Daniel Roth, Lager für die Inventur), ein Zugang mit Ablaufdatum (Hanna Weber, Hospitation) und
// ein gesperrtes Konto (Paul Richter).
// Gespeicherte Rechte (users.permissions) genau wie aus den Rollen gerechnet (rechteAusRollen samt verknüpfter Rechte:
// Lager bringt Dateien, MPG und Vorgänge mit), damit keine Abweichung gemeldet wird.
// Keine E-Mail-Adressen sichtbar: alle Konten mit Platzhalter-Adresse (…@kein-email.intern), die die Liste nie zeigt.
// Nur erfundene Daten: erfundene Feuerwehr, erfundene Personen (dieselben wie in den übrigen Bildern).

// ORG und USER kommen aus '../daten.mjs', nachgeladen wie in mpg.mjs (ein statischer Import hinge im Kreis fest).
const USERS = []
const ORGS = []

// Ortszeit -> PocketBase-Zeit in UTC (bis 24.10.2026 Sommerzeit, UTC+2, danach MEZ, UTC+1)
const pb = (tag, hm) => new Date(`${tag}T${hm}:00${tag < '2026-10-25' ? '+02:00' : '+01:00'}`).toISOString().replace('T', ' ')

// Vorlagen der Rollen wie ROLES in src/lib/apps.ts (die Organisation hat sie nicht angepasst)
const GRUND = { dashboard: true, lernbar: true, chat: true, notizen: true }
const VORLAGEN = {
  admin: { ...GRUND, mpg_verwalten: true, hygiene_verwalten: true, einsaetze: true, lager: true, lager_verwalten: true, produktausgabe: true, ausbildungen_manage: true, dokumente: true, patienten: true, dateien: true, qr: true, unitarii: true },
  benutzer: { ...GRUND },
  fuehrung: { ...GRUND, einsaetze: true, dateien: true },
  medizin: { ...GRUND, patienten: true },
  mpg: { ...GRUND, mpg_verwalten: true, lager: true, dateien: true },
  lager: { ...GRUND, lager: true, lager_verwalten: true, produktausgabe: true, dateien: true, dokumente: true },
  ausbildung: { ...GRUND, ausbildungen_manage: true, dateien: true },
  qm: { ...GRUND, dokumente: true, dateien: true },
}

// Eigene Rollen der Feuerwehr Musterstadt (organizations.eigene_rollen, Rechte in role_permissions)
const ATEMSCHUTZ = 'eigen_atemsch1'
const HYGIENE = 'eigen_hygiene1'
const EIGENE_ROLLEN = [
  { id: ATEMSCHUTZ, name: 'Atemschutzgerätewart', hinweis: 'Atemschutzgeräte und Masken prüfen, Material der Atemschutzwerkstatt.', farbe: 'cognac' },
  { id: HYGIENE, name: 'Hygienebeauftragte', hinweis: 'Hygieneplan, Intervalle und Checklisten einrichten.', farbe: 'salvia' },
]
const ROLE_PERMISSIONS = {
  [ATEMSCHUTZ]: { ...GRUND, lager: true, dateien: true },
  [HYGIENE]: { ...GRUND, hygiene_verwalten: true },
}
// Voreinstellung der verknüpften Rechte (src/lib/verknuepfung.ts)
const VERKNUEPFT = { lager: ['dateien', 'dashboard', 'dokumente'] }

/** Rechte aus den Rollen wie rechteAusRollen (nur die angehakten). */
function rechte(rollen) {
  const aus = {}
  for (const r of rollen) for (const [k, w] of Object.entries(ROLE_PERMISSIONS[r] || VORLAGEN[r] || {})) if (w) aus[k] = true
  for (const k of Object.keys(aus)) for (const z of VERKNUEPFT[k] || []) aus[z] = true
  return aus
}

// [Kennung, Name, erste Rolle, weitere Rollen, Zusatz]
const MITGLIEDER = [
  ['annabeispiel001', 'Anna Beispiel', 'medizin', ['ausbildung']],
  ['benfischer00001', 'Ben Fischer', 'teilnehmer'],
  // Für die Inventur am Wochenende befristet im Lager
  ['danielroth00001', 'Daniel Roth', 'fuehrung', [], { temp_permissions: { lager: { until: pb('2026-11-22', '20:00'), granted_by: 'lenaberger00001' } } }],
  ['emreyilmaz00001', 'Emre Yilmaz', 'benutzer'],
  ['felixneumann001', 'Felix Neumann', 'lager'],
  // Hospitation bis Ende November: Zugang mit Ablaufdatum
  ['hannaweber00001', 'Hanna Weber', 'benutzer', [], { expires_at: pb('2026-11-30', '23:59') }],
  ['janbecker000001', 'Jan Becker', 'teilnehmer'],
  ['jonaskeller0001', 'Jonas Keller', 'fuehrung'],
  ['katrinschulz001', 'Katrin Schulz', 'qm'],
  ['laurawagner0001', 'Laura Wagner', 'benutzer'],
  ['lenaberger00001', 'Lena Berger', 'admin'],
  ['leonievogel0001', 'Leonie Vogel', 'teilnehmer'],
  ['maxmustermann01', 'Max Mustermann', 'fuehrung', ['ausbildung']],
  ['miaschroeder001', 'Mia Schröder', 'teilnehmer'],
  ['murataksoy00001', 'Murat Aksoy', ATEMSCHUTZ],
  ['ninahoffmann001', 'Nina Hoffmann', 'benutzer'],
  // Ausgetreten: gesperrt statt gelöscht, seine Einträge bleiben nachvollziehbar
  ['paulrichter0001', 'Paul Richter', 'benutzer', [], { disabled: true }],
  ['saralindner0001', 'Sara Lindner', 'mpg', [HYGIENE]],
  ['sophiekrueger01', 'Sophie Krüger', 'benutzer'],
  ['tobiashahn00001', 'Tobias Hahn', 'fuehrung'],
]

function aufbauen({ ORG, USER }) {
  ORGS.push({ ...ORG, eigene_rollen: EIGENE_ROLLEN, role_permissions: ROLE_PERMISSIONS })
  const liste = MITGLIEDER.map(([id, name, role, zusatz = [], extra = {}]) => ({
    ...(id === USER.id ? USER : {}),
    id, collectionId: '_pb_users_auth_', collectionName: 'users',
    // Platzhalter: die Liste zeigt keine Adresse
    email: `${id}@kein-email.intern`, emailVisibility: false, verified: true, contact_email: '', phone: '',
    name, organization_id: ORG.id, organization_name: ORG.org_name, role, zusatzrollen: zusatz, supervisor: false,
    permissions: role === 'teilnehmer' ? { lernbar: true } : rechte([role, ...zusatz]),
    temp_permissions: {}, disabled: false, expires_at: '',
    created: pb('2025-03-01', '10:00'), updated: pb('2026-11-01', '10:00'),
    ...extra,
  }))
  // Wie die Seite sie mit sort: 'name' vom Server bekommt
  USERS.push(...liste.sort((a, b) => (a.name < b.name ? -1 : 1)))
}
import('../daten.mjs').then(aufbauen)

export const bild = {
  name: 'benutzer',
  pfad: '/unitarii',
  warte: 1200,
  sammlungen: { users: USERS, organizations: ORGS, unitas_neuigkeiten: [] },
}
