// Schreibstube (/office) im Dunkelrot-Design, Owner 22.11.2026. Reine Rechnung ohne PocketBase
// (Prüffälle: src/lib/__tests__/schreibstubeLogik.test.ts). Arten, Endungen und Pfade wie in den Dateien.
import { art, bearbeitbar, endung, nameSauber, passt, pfad, type Art, type Eintrag } from '../dateien/logik'

export { bearbeitbar }

/** Was die Schreibstube neu anlegen kann (Endung der leeren Vorlage des Office-Servers). */
export type NeuArt = 'text' | 'tabelle' | 'praesentation'
export const NEU: { art: NeuArt; titel: string; endung: string; vorgabe: string }[] = [
  { art: 'text', titel: 'Dokument', endung: 'docx', vorgabe: 'Neues Dokument' },
  { art: 'tabelle', titel: 'Tabelle', endung: 'xlsx', vorgabe: 'Neue Tabelle' },
  { art: 'praesentation', titel: 'Präsentation', endung: 'pptx', vorgabe: 'Neue Präsentation' },
]

/** Filter der Liste. */
export type Filter = 'alle' | 'text' | 'tabelle' | 'praesentation' | 'pdf'
export const FILTER: { id: Filter; titel: string }[] = [
  { id: 'alle', titel: 'Alle' },
  { id: 'text', titel: 'Texte' },
  { id: 'tabelle', titel: 'Tabellen' },
  { id: 'praesentation', titel: 'Präsentationen' },
  { id: 'pdf', titel: 'PDF' },
]

/** Name der Art für den Kopf des Editors. */
export function artName(a: Art): string {
  return a === 'tabelle' ? 'Tabelle' : a === 'praesentation' ? 'Präsentation' : a === 'pdf' ? 'PDF' : 'Dokument'
}

/** Editor-Typ des Office-Servers zur Endung der gespeicherten Datei. */
export function editorTyp(dateiname: string): 'word' | 'cell' | 'slide' | 'pdf' {
  const x = endung(dateiname)
  if (x === 'pdf') return 'pdf'
  if (['xlsx', 'xls', 'ods', 'csv'].includes(x)) return 'cell'
  if (['pptx', 'ppt', 'odp'].includes(x)) return 'slide'
  return 'word'
}

/** Die bearbeitbaren Dokumente der Ablage (mit Datei, keine Ordner), das zuletzt geänderte zuerst. */
export function dokumente(alle: Eintrag[]): Eintrag[] {
  return alle
    .filter((e) => !e.is_folder && !!e.file && bearbeitbar({ name: e.file || '', is_folder: false }))
    .sort((a, b) => (b.updated || b.created).localeCompare(a.updated || a.created))
}

/** Art eines Dokuments nach seiner gespeicherten Datei (der Name kann ohne Endung sein). */
export function dokArt(e: Pick<Eintrag, 'name' | 'file'>): Art {
  return art({ name: e.file || e.name, is_folder: false })
}

/** Liste nach Art und Suche. */
export function filtern(liste: Eintrag[], filter: Filter, suche: string): Eintrag[] {
  return liste.filter((e) => (filter === 'alle' || dokArt(e) === filter) && passt(e, suche))
}

/** Zuletzt geöffnet, in der Reihenfolge des Merkers, nur was es noch gibt. */
export function zuletzt(ids: string[], liste: Eintrag[], n = 4): Eintrag[] {
  const nachId = new Map(liste.map((e) => [e.id, e]))
  return ids.map((id) => nachId.get(id)).filter((e): e is Eintrag => !!e).slice(0, n)
}

/** Merker „zuletzt geöffnet“: vorne dazu, ohne Doppelte, höchstens 10. */
export function merken(ids: string[], id: string): string[] {
  return [id, ...ids.filter((x) => x !== id)].slice(0, 10)
}

/** Merker lesen (localStorage), kaputte oder fremde Werte ergeben eine leere Liste. */
export function merkerLesen(roh: string | null): string[] {
  try {
    const v = JSON.parse(roh || '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 10) : []
  } catch {
    return []
  }
}

/** Dateiname für ein neues Dokument: gesäubert, eine schon getippte Endung weg, die richtige dran. */
export function neuerName(eingabe: string, endungNeu: string): string {
  const n = nameSauber(eingabe).replace(/\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf|txt|csv|pdf)$/i, '').trim()
  return n ? `${n}.${endungNeu}` : ''
}

/** Ordner zur Auswahl beim Anlegen, mit Pfad („Ausbildung › 2027“), nach Pfad sortiert. */
export function ordnerWahl(alle: Eintrag[]): { id: string; titel: string }[] {
  const ordner = alle.filter((e) => e.is_folder)
  return ordner
    .map((o) => ({ id: o.id, titel: pfad(o.id, ordner).map((p) => p.name).join(' › ') }))
    .sort((a, b) => a.titel.localeCompare(b.titel, 'de', { numeric: true, sensitivity: 'base' }))
}

/** Name zum Anzeigen ohne Endung (die steht daneben): „Dienstplan.xlsx“ → „Dienstplan“; ohne Endung unverändert. */
export function anzeigeName(name: string): string {
  const x = endung(name)
  return x ? name.slice(0, -(x.length + 1)) || name : name
}

/**
 * Schlüssel des Dokuments für den Office-Server. Er erkennt ein Dokument allein daran und nimmt bei
 * bekanntem Schlüssel seinen Zwischenspeicher: Darum gehören Sammlung, Feld, Nummer und die gespeicherte
 * Datei dazu (sonst teilten sich zwei Anhänge desselben Termins einen Schlüssel), dazu der Stand.
 * Erlaubt sind nur [0-9A-Za-z._=-] und höchstens 128 Zeichen; Längeres wird kurz gehasht.
 */
export function dokSchluessel(d: { sammlung: string; id: string; feld: string; nr: number; datei: string; stand: string }): string {
  const t = new Date((d.stand || '').replace(' ', 'T')).getTime() || 0
  const quelle = [d.sammlung, d.id, d.feld, String(d.nr), d.datei, String(t)].join('_')
  const roh = quelle.replace(/[^0-9A-Za-z._=-]/g, '-')
  if (roh.length <= 128 && roh === quelle) return roh
  // Zu lang oder mit ersetzten Zeichen: Prüfwert aus dem Original, damit „ä“ und „ö“ nicht zusammenfallen.
  // FNV-1a, zweimal mit verschiedenem Anfang: kurz, ohne Abhängigkeiten, immer gleich
  const fnv = (s: string, h: number) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 } return h.toString(16).padStart(8, '0') }
  return `${roh.slice(0, 100)}_${fnv(quelle, 2166136261)}${fnv(quelle, 33554467)}`
}

/** „vor 5 Min.“, „vor 3 Std.“, „vor 2 Tagen“, sonst das Datum. */
export function wannText(stand: string, jetzt = Date.now()): string {
  const t = new Date(stand.replace(' ', 'T')).getTime()
  if (!Number.isFinite(t)) return ''
  const min = Math.floor((jetzt - t) / 60000)
  if (min < 1) return 'gerade eben'
  if (min < 60) return `vor ${min} Min.`
  const std = Math.floor(min / 60)
  if (std < 24) return `vor ${std} Std.`
  const tage = Math.floor(std / 24)
  if (tage < 7) return `vor ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}`
  return new Date(t).toLocaleDateString('de-DE')
}
