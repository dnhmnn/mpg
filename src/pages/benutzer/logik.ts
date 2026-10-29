// Benutzerverwaltung: reine Hilfen für Liste, Personen- und Rollenseite.
// Ohne React und ohne PocketBase, damit sie Prüffälle haben (logik.test.ts).

import { isPlaceholderEmail, ohneRechte, zeitpunktBefristung } from '../../lib/apps'
import { pbFehlerText } from '../../lib/pbFehler'

export interface UUser {
  id: string
  name: string
  email: string
  contact_email?: string
  phone?: string
  role?: string
  permissions?: Record<string, boolean>
  organization_id?: string
  supervisor?: boolean
  disabled?: boolean
  expires_at?: string
  temp_permissions?: Record<string, { until: string; granted_by?: string }>
  created?: string
}

export interface Neuigkeit {
  id: string
  titel: string
  inhalt: string
  anhang: string
  gepinnt: boolean
  erstellt_von: string
  created: string
  collectionId: string
  organisation_id?: string
}

export type Recht = { key: string; label: string }

/** Bereiche der Rechte, in der Reihenfolge, in der sie auf der Seite stehen */
export const RECHTE_GRUPPEN: { name: string; rechte: string[] }[] = [
  { name: 'Einsatz', rechte: ['einsaetze', 'eks', 'patienten'] },
  { name: 'Material', rechte: ['lager', 'lager_verwalten', 'dashboard', 'mpg_verwalten'] },
  { name: 'Ausbildung', rechte: ['lernbar', 'ausbildungen_manage'] },
  { name: 'Verwaltung', rechte: ['dokumente', 'dateien', 'unitarii', 'qr'] },
  { name: 'Kommunikation', rechte: ['chat', 'notizen'] },
]

/** Eine Zeile unter dem Namen, wo der Name allein nicht sagt, was das Recht erlaubt */
export const RECHT_BESCHREIBUNG: Record<string, string> = {
  eks: 'Atemschutz, Tagebuch und Kräfte im ELW',
  lager_verwalten: 'Artikel anlegen, Bestand buchen',
  mpg_verwalten: 'Geräte anlegen, sperren, freigeben',
  ausbildungen_manage: 'Termine und Module pflegen',
  unitarii: 'Benutzer anlegen, Rechte vergeben',
}

/**
 * Die vergebbaren Rechte nach Bereichen. Nur was in `rechte` steht, erscheint;
 * leere Bereiche entfallen. Ein Recht, das in keinem Bereich steht, kommt unter
 * „Weitere“ — so geht keins verloren, wenn PERM_LABELS wächst.
 */
export function rechteGruppiert(rechte: Recht[]): { name: string; rechte: Recht[] }[] {
  const nachKey = new Map(rechte.map(r => [r.key, r]))
  const verteilt = new Set<string>()
  const aus: { name: string; rechte: Recht[] }[] = []
  for (const g of RECHTE_GRUPPEN) {
    const liste = g.rechte.map(k => nachKey.get(k)).filter((r): r is Recht => !!r)
    liste.forEach(r => verteilt.add(r.key))
    if (liste.length) aus.push({ name: g.name, rechte: liste })
  }
  const rest = rechte.filter(r => !verteilt.has(r.key))
  if (rest.length) aus.push({ name: 'Weitere', rechte: rest })
  return aus
}

/** Wie viele der sichtbaren Rechte angehakt sind */
export function anzahlRechte(werte: Record<string, boolean> | undefined, rechte: Recht[]): number {
  return rechte.filter(r => werte?.[r.key] === true).length
}

/** "keine Person", "1 Person", "3 Personen" */
export function personen(n: number): string {
  return n === 0 ? 'keine Person' : anzahl(n, 'Person', 'Personen')
}

/** "1 Recht", "3 Rechte" */
export function anzahl(n: number, eins: string, mehr: string): string {
  return `${n} ${n === 1 ? eins : mehr}`
}

/** "A", "A und B", "A, B und C" */
export function aufzaehlung(teile: string[]): string {
  if (teile.length <= 1) return teile.join('')
  return `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`
}

/** Zeitspanne für „in …“: "in 25 Minuten", "in 1 Stunde", "in 3 Tagen" (abgerundet) */
export function inDauer(ms: number): string {
  const min = Math.max(1, Math.floor(ms / 60000))
  if (min < 60) return `in ${min} ${min === 1 ? 'Minute' : 'Minuten'}`
  const std = Math.floor(min / 60)
  if (std < 24) return `in ${std} ${std === 1 ? 'Stunde' : 'Stunden'}`
  const tage = Math.floor(std / 24)
  return `in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}`
}

export type StatusArt = 'gesperrt' | 'abgelaufen' | 'leer' | 'ablauf' | 'befristet'

/**
 * Was an einer Person in der Liste auffallen muss — sonst nichts.
 * Reihenfolge wie bisher: gesperrt, abgelaufen, keine Rechte, läuft ab.
 * Danach noch laufende befristete Rechte, ruhig.
 */
export function benutzerStatus(u: UUser, jetzt = Date.now()): { text: string; art: StatusArt } | null {
  if (u.disabled) return { text: 'gesperrt', art: 'gesperrt' }
  const ablauf = u.expires_at ? zeitpunktBefristung(u.expires_at) : 0
  if (u.expires_at && ablauf <= jetzt) return { text: 'abgelaufen', art: 'abgelaufen' }
  // Ein aktives Konto ohne ein einziges Recht sieht nach dem Anmelden nichts
  if (ohneRechte(u, jetzt)) return { text: 'keine Rechte', art: 'leer' }
  if (u.expires_at) return { text: `läuft ab ${inDauer(ablauf - jetzt)}`, art: 'ablauf' }
  const befristet = Object.values(u.temp_permissions || {}).filter(v => !!v?.until && zeitpunktBefristung(v.until) > jetzt).length
  if (befristet) return { text: `${anzahl(befristet, 'Recht', 'Rechte')} befristet`, art: 'befristet' }
  return null
}

/** Die Adresse, die in der Liste steht: keine erzeugte Platzhalter-Adresse */
export function anzeigeEmail(u: Pick<UUser, 'email' | 'contact_email'>): string {
  return u.contact_email || (isPlaceholderEmail(u.email) ? '' : u.email)
}

/** Zwei Anfangsbuchstaben: "Anna Berger" → "AB", "Lea" → "L" */
export function initialen(name: string | undefined, ersatz = ''): string {
  const woerter = (name || '').trim().split(/\s+/).filter(Boolean)
  const z = woerter.length ? woerter.slice(0, 2).map(w => w[0]).join('') : (ersatz.trim()[0] ?? '?')
  return z.toLocaleUpperCase('de-DE')
}

/** Suche in Name und E-Mail, ohne Groß/klein */
export function suchen(liste: UUser[], q: string): UUser[] {
  const s = q.trim().toLocaleLowerCase('de-DE')
  if (!s) return liste
  return liste.filter(u => [u.name, u.email, u.contact_email].some(f => (f || '').toLocaleLowerCase('de-DE').includes(s)))
}

export function fmtDateTimeLocal(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Lesbares Passwort für Zugänge ohne eigene E-Mail (wird angezeigt und weitergegeben) */
export function genPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export const BENUTZER_FELDER: Record<string, string> = {
  email: 'Die E-Mail-Adresse', name: 'Der Name', contact_email: 'Die Kontakt-E-Mail', phone: 'Die Telefonnummer',
  password: 'Das Passwort', passwordConfirm: 'Die Passwort-Wiederholung', expires_at: 'Das Ablaufdatum',
}

export const ROLLENFELD_TEXT = 'In PocketBase ist das Feld „role“ bei users eine Auswahlliste. Für eigene Rollen bitte auf Text („Plain text“) umstellen.'

// PocketBase sagt nur „Failed to create record.“ — hier steht, woran es liegt
export function anlegeFehler(e: unknown, neu: boolean): string {
  const f = (e ?? {}) as { status?: number; response?: { data?: Record<string, unknown> } }
  const felder = Object.keys(f.response?.data ?? {})
  // Ohne Feldangabe hat die Regel abgelehnt: Wer anlegt, braucht Admin oder das Recht Benutzerverwaltung
  if (neu && f.status === 400 && felder.length === 0) {
    return 'Nicht angelegt: Der Server lässt das mit diesem Konto nicht zu. Nötig ist die Rolle Admin oder das Recht „Benutzerverwaltung“ (bei einem befristeten Recht müssen die PocketBase-Regeln aktuell sein).'
  }
  if (felder.includes('email') && /not_unique/.test(JSON.stringify(f.response?.data?.email ?? ''))) {
    return 'Diese E-Mail-Adresse hat schon ein Konto, eventuell in einer anderen Organisation.'
  }
  // Das Feld role lehnt eine eigene Rolle ab: Auswahlliste (Select), zu kurze Höchstlänge oder ein Muster.
  // Unterscheidbar am Code (gegen PocketBase 0.28.4 und 0.40.5 geprüft).
  if (felder.includes('role')) {
    const code = String((f.response?.data?.role as { code?: string } | undefined)?.code ?? '')
    const vorn = neu ? 'Nicht angelegt: ' : 'Nicht gespeichert: '
    if (code === 'validation_max_text_constraint') return vorn + 'In PocketBase ist das Feld „role“ bei users zu kurz eingestellt. Bitte „Max length“ auf mindestens 14 setzen (oder 0 für unbegrenzt).'
    if (code === 'validation_invalid_format') return vorn + 'In PocketBase hat das Feld „role“ bei users ein Muster (Pattern), das eigene Rollen nicht zulässt. Bitte das Muster um eigen_[a-z0-9]{8} ergänzen.'
    return vorn + ROLLENFELD_TEXT
  }
  return (neu ? 'Nicht angelegt: ' : 'Nicht gespeichert: ') + pbFehlerText(e, BENUTZER_FELDER)
}

/** Fehler beim Schreiben in die Organisation (Rollen, Vorlagen, Verknüpfungen) */
export function orgFehler(e: unknown): string {
  const f = (e ?? {}) as { status?: number }
  if (f.status === 404) return 'Nicht gespeichert: Der Server lässt das Ändern der Organisation nicht zu.'
  const felder = Object.keys((e as { response?: { data?: Record<string, unknown> } })?.response?.data ?? {})
  const ORG_FELDER: Record<string, string> = { eigene_rollen: '„eigene_rollen“', role_permissions: '„role_permissions“', verknuepfungen: '„verknuepfungen“' }
  const technisch = felder.find(x => ORG_FELDER[x])
  // Ein JSON-Feld lehnt ab (meist zu kleine „Max size“) — der Rohtext von PocketBase ist englisch und technisch
  if (technisch) return `Nicht gespeichert: Das Feld ${ORG_FELDER[technisch]} bei organizations nimmt den Inhalt nicht an. In PocketBase prüfen: Typ JSON, „Max size“ ausreichend groß (z. B. 50000).`
  return 'Nicht gespeichert: ' + pbFehlerText(e)
}
