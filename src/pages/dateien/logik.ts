// Dateien (/files) im Dunkelrot-Design, Owner 22.11.2026. Reine Rechnung ohne PocketBase
// (Prüffälle: src/lib/__tests__/dateienLogik.test.ts).

export interface Eintrag {
  id: string
  name: string
  is_folder: boolean
  parent_folder_id: string
  organization_id: string
  file?: string
  file_size?: number
  file_type?: string
  created: string
  updated?: string
}

export type Art = 'ordner' | 'pdf' | 'text' | 'tabelle' | 'praesentation' | 'bild' | 'archiv' | 'datei'

/** In der Schreibstube öffnen lassen sich diese Endungen. */
export const BEARBEITBAR = ['docx', 'doc', 'odt', 'rtf', 'txt', 'xlsx', 'xls', 'ods', 'csv', 'pptx', 'ppt', 'odp', 'pdf']

export function endung(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function art(e: Pick<Eintrag, 'name' | 'is_folder'>): Art {
  if (e.is_folder) return 'ordner'
  const x = endung(e.name)
  if (x === 'pdf') return 'pdf'
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(x)) return 'text'
  if (['xls', 'xlsx', 'ods', 'csv'].includes(x)) return 'tabelle'
  if (['ppt', 'pptx', 'odp', 'key'].includes(x)) return 'praesentation'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'svg'].includes(x)) return 'bild'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(x)) return 'archiv'
  return 'datei'
}

export function bearbeitbar(e: Pick<Eintrag, 'name' | 'is_folder'>): boolean {
  return !e.is_folder && BEARBEITBAR.includes(endung(e.name))
}

export function groesse(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} Byte`
  const einheiten = ['KB', 'MB', 'GB']
  let n = bytes / 1024
  let i = 0
  while (n >= 1024 && i < einheiten.length - 1) { n /= 1024; i++ }
  return `${n.toLocaleString('de-DE', { maximumFractionDigits: n < 10 ? 1 : 0 })} ${einheiten[i]}`
}

/** Ordner zuerst, dann nach Namen (deutsch, Zahlen natürlich: „Datei 2“ vor „Datei 10“). */
export function sortieren(liste: Eintrag[]): Eintrag[] {
  return [...liste].sort((a, b) => (a.is_folder === b.is_folder ? a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' }) : a.is_folder ? -1 : 1))
}

/** Pfad von der Wurzel bis zu diesem Ordner; ordner: alle bekannten Ordner. Bricht bei Schleifen ab. */
export function pfad(ordnerId: string, ordner: Pick<Eintrag, 'id' | 'name' | 'parent_folder_id'>[]): { id: string; name: string }[] {
  const nachId = new Map(ordner.map((o) => [o.id, o]))
  const aus: { id: string; name: string }[] = []
  const gesehen = new Set<string>()
  let id = ordnerId
  while (id && nachId.has(id) && !gesehen.has(id)) {
    gesehen.add(id)
    const o = nachId.get(id)!
    aus.unshift({ id: o.id, name: o.name })
    id = o.parent_folder_id
  }
  return aus
}

/** Alles unter einem Ordner (alle Ebenen), die tiefsten zuerst: so lässt es sich der Reihe nach löschen. */
export function nachkommen(ordnerId: string, alle: Pick<Eintrag, 'id' | 'parent_folder_id' | 'is_folder'>[]): string[] {
  const kinder = new Map<string, string[]>()
  for (const e of alle) {
    const l = kinder.get(e.parent_folder_id) || []
    l.push(e.id)
    kinder.set(e.parent_folder_id, l)
  }
  const aus: string[] = []
  const gesehen = new Set<string>([ordnerId])
  const besuchen = (id: string) => {
    for (const k of kinder.get(id) || []) {
      if (gesehen.has(k)) continue
      gesehen.add(k)
      besuchen(k)
      aus.push(k)
    }
  }
  besuchen(ordnerId)
  return aus
}

/** Name für einen neuen Ordner oder beim Umbenennen: ohne / und Steuerzeichen, höchstens 120 Zeichen. */
export function nameSauber(roh: string): string {
  return roh.replace(/[\u0000-\u001f\u007f/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}

/** Beim Umbenennen einer Datei bleibt die Endung, wenn sie fehlt („Bericht“ → „Bericht.pdf“). */
export function umbenennen(alt: Eintrag, neu: string): string {
  const n = nameSauber(neu)
  if (!n || alt.is_folder) return n
  const x = endung(alt.name)
  return x && endung(n) !== x ? `${n}.${x}` : n
}

/** Gibt es im Ordner schon einen Eintrag mit diesem Namen (Groß/Klein egal)? */
export function nameVergeben(liste: Pick<Eintrag, 'id' | 'name'>[], name: string, ausser = ''): boolean {
  const n = name.trim().toLowerCase()
  return !!n && liste.some((e) => e.id !== ausser && e.name.trim().toLowerCase() === n)
}

/** Suche über den Namen, alle Wörter müssen vorkommen. */
export function passt(e: Pick<Eintrag, 'name'>, suche: string): boolean {
  const q = suche.trim().toLowerCase()
  if (!q) return true
  const n = e.name.toLowerCase()
  return q.split(/\s+/).every((w) => n.includes(w))
}
