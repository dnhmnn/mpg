// Tresor: Warteschlange und Entwürfe verschlüsselt auf dem Gerät (Plan Vorgänge, 5.1, 5.2).
//
// Was ohne Netz abgelegt wird (`formular_warteschlange_<org>`, alt `offline_queue_<org>`)
// und begonnene Protokolle (`doku_entwurf_<ort>`, alte Maske `patientendoku_<org>`)
// enthalten Patientendaten. Sie liegen deshalb nicht mehr im Klartext in localStorage,
// sondern mit AES-GCM verschlüsselt in IndexedDB (`responda-tresor`). Der Schlüssel ist
// ein nicht exportierbarer CryptoKey in derselben Datenbank.
//
// WAS DER TRESOR SCHÜTZT UND WAS NICHT (F11, richtiggestellt nach Review):
// - Er verhindert, dass Patientendaten im Klartext auf dem Gerät liegen: eine Suche nach
//   Namen in den Browser-Dateien, ein Blick in localStorage oder in die Entwicklerwerkzeuge
//   findet nur Chiffrat. Der Schlüssel lässt sich über die Web-Schnittstelle nicht
//   exportieren.
// - Er schützt NICHT, wenn jemand die Browser-Dateien selbst ausliest (Sicherung, ausgelesenes
//   Gerät, Werkzeug mit Dateizugriff): Der Browser legt auch einen „nicht exportierbaren“
//   Schlüssel als Bytes in seine IndexedDB-Dateien, im selben Profil wie das Chiffrat (geprüft
//   mit Chromium). Wer beides hat, kann entschlüsseln. Dagegen hilft nur die Verschlüsselung
//   des Geräts selbst (Gerätesperre, Datenträgerverschlüsselung).
// - Er schützt NICHT gegen Schadcode, der auf der Seite selbst läuft: dort ist der Schlüssel
//   benutzbar.
//
// Aufbau
// - Synchrone Fassade (`tresorSpeicher`, Weiche in `geraeteSpeicher`): Lesen und
//   Schreiben im Arbeitsspeicher, Verschlüsseln und Ablegen gleich danach, je
//   Ablageschlüssel zusammengefasst. Die Warteschlange und ihre Prüffälle arbeiten
//   unverändert mit `getItem`/`setItem`/`removeItem`.
// - Listen je Eintrag: `formular_warteschlange_<org>` liegt als ein Datensatz je
//   Warteeintrag (`<schluessel>\u0000<id>`). Zwei Fenster und der Service Worker
//   überschreiben sich so nicht, solange sie nicht denselben Eintrag ändern.
// - Je Schreibvorgang ein neuer Zufalls-IV; zusätzliche Daten (AAD) = Ablageschlüssel.
// - Umzug: Klartext aus localStorage wird zusammengeführt, verschlüsselt, zurückgelesen,
//   verglichen und erst dann gelöscht. Gelöscht wird nie etwas, das nicht sicher
//   verschlüsselt liegt.
// - Kann der Browser das nicht (kein IndexedDB, kein crypto.subtle, privates Fenster),
//   bleibt alles wie bisher in localStorage (`tresorZustand() === 'klartext'`).
// - Unlesbare Datensätze werden nie überschrieben und nie gelöscht, nur umbenannt
//   (`…#unlesbar-<zeit>`) und gezählt.
//
// Keine Imports aus React oder PocketBase: die Prüffälle laufen in Node mit WebCrypto
// und einer Ablage im Speicher (src/lib/__tests__/tresor.test.ts).

import { openDB, type IDBPDatabase } from 'idb'
import { anzahlAlle } from './formular/warteschlange'

export type Speicher = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
/** localStorage oder ein Ersatz; `key`/`length` braucht nur der Umzug. */
export type KlarSpeicher = Speicher & Partial<Pick<Storage, 'key' | 'length'>>

/** Listen, die je Eintrag abgelegt werden. */
export const TRESOR_LISTEN: string[] = ['formular_warteschlange_']
/** Einzelwerte. */
export const TRESOR_EINZELN: string[] = ['offline_queue_', 'doku_entwurf_', 'patientendoku_']
/** Entwürfe (beim Abmelden gelöscht, F13). */
export const TRESOR_ENTWUERFE: string[] = ['doku_entwurf_', 'patientendoku_']
/** Nach dieser Zeit gilt ein Entwurf als vergessen: nicht mehr angeboten, beim nächsten Start entfernt. */
export const ENTWURF_FRIST_MS = 24 * 60 * 60 * 1000
/**
 * Ein Entwurf, der beim Zusammenführen unterlag, bleibt unter `<schluessel>~frueher-<ms>`
 * (Review F6: Zeitgrenze beim Öffnen). Die Masken bieten ihn an, sobald unter dem eigentlichen
 * Schlüssel nichts mehr liegt; nach ENTWURF_FRIST_MS fällt er weg wie jeder Entwurf.
 */
export const ENTWURF_FRUEHER = '~frueher-'

export const TRESOR_DB = 'responda-tresor'
export const TRESOR_KANAL = 'responda-tresor'
export const TRESOR_SPERRE = 'responda-tresor-umzug'
export const SCHLUESSEL_ID = 'aes-gcm-1'
/** Tag des Hintergrundversands (public/sw-formulare.js). */
export const SYNC_TAG = 'responda-formulare'
/** Ereignis im Fenster, wenn der Tresor Schlüssel aus einem anderen Fenster neu geladen hat. */
export const TRESOR_EREIGNIS = 'responda-tresor'
/** Ereignis im Fenster: der Tresor ist erst nach der Zeitgrenze offen (Masken lesen ihren Entwurf neu, Review F6). */
export const TRESOR_OFFEN_EREIGNIS = 'responda-tresor-offen'
/** Ereignis im Fenster: der Service Worker bittet, die Warteschlange jetzt abzuarbeiten. */
export const SENDEN_EREIGNIS = 'formular-warteschlange-senden'
/** Merkmal umbenannter, unlesbarer Datensätze. */
export const UNLESBAR = '#unlesbar-'
/** Kennungen aus dem Hintergrund bleiben so lange vermerkt. */
const ERLEDIGT_MS = 24 * 60 * 60 * 1000

/** Ein abgelegter Datensatz in IndexedDB (Speicher `daten`). */
export type Datensatz = {
  v: 1
  iv: Uint8Array
  ct: ArrayBuffer
  art: 'liste' | 'einzel'
  schluessel: string
  eintrag?: string
  /** Reihenfolge eines Listeneintrags (aufsteigend). */
  reihe?: number
  geaendert: string
}

/** Wo die Datensätze liegen: IndexedDB oder, in den Prüffällen, ein Speicher im Arbeitsspeicher. */
export type TresorAblage = {
  lesen(): Promise<Record<string, unknown>>
  schreiben(k: string, v: unknown): Promise<void>
  loeschen(k: string): Promise<void>
  schluessel(): Promise<CryptoKey | null>
  /** Legt den Schlüssel nur ab, wenn noch keiner da ist (zwei Fenster erzeugen nie zwei). */
  schluesselSetzen(c: CryptoKey): Promise<void>
  metaSetzen?(k: string, v: unknown): Promise<void>
  erledigtLesen?(): Promise<Record<string, unknown>>
  erledigtLoeschen?(ids: string[]): Promise<void>
}

/** Ein Kanal wie BroadcastChannel (in den Prüffällen nachgebildet). */
export type TresorKanal = { postMessage(m: unknown): void; onmessage: ((ev: { data: unknown }) => void) | null; close?(): void }

export type TresorZustand = 'verschluesselt' | 'klartext' | 'zu'
export type KlartextGrund = '' | 'nicht_moeglich' | 'fehler' | 'zeit'

// ── Hilfen ──────────────────────────────────────────────────────────────────

export function istListenSchluessel(k: string): boolean {
  return typeof k === 'string' && TRESOR_LISTEN.some((p) => k.startsWith(p)) && !k.includes('\u0000') && !k.includes(UNLESBAR)
}
export function istEinzelSchluessel(k: string): boolean {
  return typeof k === 'string' && TRESOR_EINZELN.some((p) => k.startsWith(p)) && !k.includes('\u0000') && !k.includes(UNLESBAR)
}
/** Gehört dieser Schlüssel in den Tresor? */
export function istTresorSchluessel(k: string): boolean {
  return istListenSchluessel(k) || istEinzelSchluessel(k)
}
function istEntwurf(k: string): boolean {
  return TRESOR_ENTWUERFE.some((p) => k.startsWith(p))
}

/** Ablageschlüssel eines Datensatzes; zugleich die zusätzlichen Daten (AAD) beim Verschlüsseln. */
export function ablageSchluessel(schluessel: string, eintrag?: string): string {
  return eintrag === undefined ? schluessel : `${schluessel}\u0000${eintrag}`
}

function istObjekt(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x)
}

/** Kanonisches JSON (sortierte Schlüssel): gleicher Inhalt, gleicher Text. */
function kanonisch(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x ?? null)
  if (Array.isArray(x)) return '[' + x.map(kanonisch).join(',') + ']'
  const o = x as Record<string, unknown>
  return '{' + Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ':' + kanonisch(o[k])).join(',') + '}'
}

function streuwert(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** Schlüssel der Einträge einer Liste: die Kennung (`id`), sonst ein Streuwert des Inhalts; Doppelte mit Zähler. */
export function eintragSchluessel(liste: unknown[]): string[] {
  const gesehen = new Set<string>()
  return liste.map((x) => {
    const id = istObjekt(x) ? x.id : undefined
    const basis = typeof id === 'string' && id && id.length <= 64 && !/[\u0000#~]/.test(id) ? id : `~${streuwert(kanonisch(x))}`
    let k = basis
    for (let n = 2; gesehen.has(k); n++) k = `${basis}~${n}`
    gesehen.add(k)
    return k
  })
}

function listeLesen(text: string | null | undefined): unknown[] | null {
  if (typeof text !== 'string') return null
  try {
    const l: unknown = JSON.parse(text)
    return Array.isArray(l) ? l : null
  } catch {
    return null
  }
}

function standVon(text: string | null): number {
  if (typeof text !== 'string') return NaN
  try {
    const o: unknown = JSON.parse(text)
    return istObjekt(o) && typeof o.stand === 'string' ? Date.parse(o.stand) : NaN
  } catch {
    return NaN
  }
}

/**
 * Klartext (`klar`) und Tresorwert (`tresor`) eines Schlüssels zusammenführen (5.2, Schritt 2).
 * - Listen: Vereinigung nach Kennung, der Tresor gewinnt bei gleicher Kennung.
 * - `offline_queue_`: Vereinigung nach Inhalt.
 * - Einzelwerte mit `stand` (Entwurf): der neuere; sonst der Klartext (er ist später geschrieben).
 */
export function zusammenfuehren(k: string, tresor: string | null, klar: string | null): string | null {
  if (tresor === null || tresor === undefined) return klar
  if (klar === null || klar === undefined || klar === tresor) return tresor
  if (istListenSchluessel(k)) {
    const t = listeLesen(tresor), c = listeLesen(klar)
    if (!t) return c ? klar : klar
    if (!c) return tresor
    const da = new Set(eintragSchluessel(t))
    const kSchl = eintragSchluessel(c)
    const dazu = c.filter((_, i) => !da.has(kSchl[i]))
    return JSON.stringify([...t, ...dazu])
  }
  if (k.startsWith('offline_queue_')) {
    const t = listeLesen(tresor), c = listeLesen(klar)
    if (!t) return klar
    if (!c) return tresor
    const da = new Set(t.map(kanonisch))
    return JSON.stringify([...t, ...c.filter((x) => !da.has(kanonisch(x)))])
  }
  const st = standVon(tresor), sc = standVon(klar)
  if (Number.isFinite(st) && Number.isFinite(sc)) return st > sc ? tresor : klar
  if (Number.isFinite(st) && !Number.isFinite(sc) && listeLesen(klar) === null && !istObjektText(klar)) return tresor
  return klar
}

function istObjektText(t: string): boolean {
  try { return istObjekt(JSON.parse(t)) } catch { return false }
}

/** Schlüssel eines Entwurfs ohne `~frueher-…`. */
export function entwurfBasis(k: string): string {
  const i = k.indexOf(ENTWURF_FRUEHER)
  return i >= 0 ? k.slice(0, i) : k
}

/** Die Werte eines Entwurfs: `{ stand, werte }` (neue Maske, Hülle der alten) oder das Objekt selbst (alte Maske). */
function entwurfWerte(text: string | null): Record<string, unknown> | null {
  if (typeof text !== 'string') return null
  try {
    const o: unknown = JSON.parse(text)
    if (!istObjekt(o)) return null
    return typeof o.stand === 'string' && istObjekt(o.werte) ? o.werte : o
  } catch {
    return null
  }
}

function wertDa(w: unknown): boolean {
  if (w === undefined || w === null || w === '' || w === false) return false
  if (Array.isArray(w)) return w.length > 0
  if (istObjekt(w)) return Object.keys(w).length > 0
  return true
}

/** Steht in diesem Entwurf überhaupt etwas? */
export function entwurfMitInhalt(text: string | null): boolean {
  const w = entwurfWerte(text)
  return !!w && Object.values(w).some(wertDa)
}

/** Gleicher Inhalt (ohne den Zeitpunkt)? */
function gleicherEntwurf(a: string | null, b: string | null): boolean {
  if (a === b) return true
  const x = entwurfWerte(a), y = entwurfWerte(b)
  return !!x && !!y && kanonisch(x) === kanonisch(y)
}

// ── Verschlüsseln ───────────────────────────────────────────────────────────

const kodierer = new TextEncoder()
const dekodierer = new TextDecoder()

function subtle(): SubtleCrypto | null {
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto
    return c && c.subtle && typeof c.getRandomValues === 'function' ? c.subtle : null
  } catch {
    return null
  }
}

/** Neuer, nicht exportierbarer AES-GCM-Schlüssel (256 Bit). */
export function schluesselErzeugen(): Promise<CryptoKey> {
  return subtle()!.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) as Promise<CryptoKey>
}

/** Verschlüsselt `klartext` für den Ablageschlüssel `ak` (AAD) mit neuem Zufalls-IV. */
export async function verschluesseln(key: CryptoKey, ak: string, klartext: string): Promise<{ iv: Uint8Array; ct: ArrayBuffer }> {
  const iv = (globalThis as { crypto: Crypto }).crypto.getRandomValues(new Uint8Array(12))
  const ct = await subtle()!.encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: kodierer.encode(ak) }, key, kodierer.encode(klartext))
  return { iv, ct }
}

function bytes(x: unknown): Uint8Array | null {
  if (x instanceof Uint8Array) return x
  if (x instanceof ArrayBuffer) return new Uint8Array(x)
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength)
  return null
}

/**
 * Einen Datensatz entschlüsseln. Er muss unter seinem eigenen Ablageschlüssel liegen
 * (`ak`); die AAD bindet den Inhalt an Schlüssel und Eintrag, vertauschte Datensätze
 * scheitern. Wirft bei allem, was nicht passt.
 */
export async function entschluesseln(key: CryptoKey, rec: unknown, ak: string): Promise<string> {
  if (!istObjekt(rec) || rec.v !== 1 || typeof rec.schluessel !== 'string') throw new Error('kein Datensatz')
  const eintrag = typeof rec.eintrag === 'string' ? rec.eintrag : undefined
  const soll = ablageSchluessel(rec.schluessel, eintrag)
  if (soll !== ak) throw new Error('falscher Ort')
  const iv = bytes(rec.iv), ct = bytes(rec.ct)
  if (!iv || iv.byteLength !== 12 || !ct) throw new Error('unvollständig')
  const klar = await subtle()!.decrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: kodierer.encode(soll) }, key, ct as BufferSource)
  return dekodierer.decode(klar)
}

// ── IndexedDB ───────────────────────────────────────────────────────────────

const SPEICHER = ['schluessel', 'daten', 'meta', 'erledigt'] as const

/** Die Ablage in IndexedDB (`responda-tresor`, Version 1); public/sw-formulare.js liest dieselbe. */
export function idbAblage(): TresorAblage {
  let db: Promise<IDBPDatabase> | null = null
  const offen = () => {
    if (!db) {
      db = openDB(TRESOR_DB, 1, {
        upgrade(d) { for (const s of SPEICHER) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s) },
      })
      db.catch(() => { db = null })
    }
    return db
  }
  return {
    async lesen() {
      const d = await offen()
      const tx = d.transaction('daten', 'readonly')
      const [schl, werte] = await Promise.all([tx.store.getAllKeys(), tx.store.getAll()])
      await tx.done
      const aus: Record<string, unknown> = {}
      schl.forEach((k, i) => { if (typeof k === 'string') aus[k] = werte[i] })
      return aus
    },
    async schreiben(k, v) { await (await offen()).put('daten', v, k) },
    async loeschen(k) { await (await offen()).delete('daten', k) },
    async schluessel() {
      const c = await (await offen()).get('schluessel', SCHLUESSEL_ID)
      return c ? c as CryptoKey : null
    },
    async schluesselSetzen(c) {
      const d = await offen()
      const tx = d.transaction('schluessel', 'readwrite')
      // Innerhalb einer Transaktion: nur ablegen, wenn noch keiner da ist
      if (!(await tx.store.get(SCHLUESSEL_ID))) await tx.store.add(c, SCHLUESSEL_ID)
      await tx.done
    },
    async metaSetzen(k, v) { await (await offen()).put('meta', v, k) },
    async erledigtLesen() {
      const d = await offen()
      const tx = d.transaction('erledigt', 'readonly')
      const [schl, werte] = await Promise.all([tx.store.getAllKeys(), tx.store.getAll()])
      await tx.done
      const aus: Record<string, unknown> = {}
      schl.forEach((k, i) => { if (typeof k === 'string') aus[k] = werte[i] })
      return aus
    },
    async erledigtLoeschen(ids) {
      const d = await offen()
      const tx = d.transaction('erledigt', 'readwrite')
      await Promise.all(ids.map((id) => tx.store.delete(id)))
      await tx.done
    },
  }
}

// ── Der Kern ────────────────────────────────────────────────────────────────

type Op =
  | { art: 'schreiben'; schluessel: string; eintrag?: string; reihe?: number; klartext: string; ablage: 'liste' | 'einzel' }
  | { art: 'loeschen'; schluessel: string }

type Eintraege = Map<string, { json: string; reihe: number }>

/**
 * Ein Tresor (ein Fenster). Die App hat genau einen (`tresorOeffnen`); die Prüffälle
 * erzeugen mehrere, um zwei Fenster nachzubilden.
 */
export class TresorKern {
  zustand: 'zu' | 'oeffnet' | 'verschluesselt' | 'klartext' = 'zu'
  klartextGrund: KlartextGrund = ''
  private ablage: TresorAblage | null = null
  private key: CryptoKey | null = null
  klar: KlarSpeicher | null = null
  private cache = new Map<string, string>()
  private listen = new Map<string, Eintraege>()
  /** Einzelwerte unter einem Listenschlüssel (kein JSON-Array): Ablageschlüssel = Schlüssel. */
  private rohListen = new Set<string>()
  private offen = new Map<string, Op>()
  private fehl = new Map<string, Op>()
  /** Schlüssel, deren Inhalt weder verschlüsselt noch als Klartext sicher liegt. */
  private ungesichert = new Set<string>()
  /** Klartext in localStorage, der noch nicht sicher verschlüsselt liegt (Rückfall, offener Umzug). */
  private klarKopie = new Map<string, string>()
  private laeuft: Promise<void> | null = null
  private kanal: TresorKanal | null = null
  probleme = 0
  readonly erledigt = new Set<string>()
  /** Nach dem Öffnen: Schlüssel, die ein anderes Fenster geändert hat (Rückruf für die Prüffälle). */
  onNeuGeladen: ((schluessel: string[]) => void) | null = null

  // ── Lesen und Schreiben (synchron) ──

  getItem(k: string): string | null {
    return this.cache.has(k) ? this.cache.get(k)! : null
  }

  setItem(k: string, v: string): void {
    const wert = String(v)
    if (istListenSchluessel(k)) {
      const liste = listeLesen(wert)
      if (liste) { this.listeSetzen(k, liste); return }
      // Kein Array unter einem Listenschlüssel: als Ganzes ablegen
      this.listeLeeren(k)
      this.rohListen.add(k)
      this.cache.set(k, wert)
      this.planen(k, { art: 'schreiben', schluessel: k, klartext: wert, ablage: 'einzel' })
      return
    }
    this.cache.set(k, wert)
    this.planen(k, { art: 'schreiben', schluessel: k, klartext: wert, ablage: 'einzel' })
  }

  removeItem(k: string): void {
    if (istListenSchluessel(k)) {
      this.listeLeeren(k)
      this.cache.delete(k)
      // Liegt die Liste noch als Klartext (Rückfall, offener Umzug), muss auch der weg
      if (this.klarKopie.has(k)) this.planen(k, { art: 'loeschen', schluessel: k })
      return
    }
    const da = this.cache.delete(k)
    if (da || this.klarKopie.has(k)) this.planen(k, { art: 'loeschen', schluessel: k })
  }

  private listeLeeren(k: string): void {
    const alt = this.listen.get(k)
    if (alt) for (const e of alt.keys()) this.planen(ablageSchluessel(k, e), { art: 'loeschen', schluessel: k })
    this.listen.delete(k)
    if (this.rohListen.delete(k)) this.planen(k, { art: 'loeschen', schluessel: k })
  }

  private listeSetzen(k: string, roh: unknown[]): void {
    const liste = roh.filter((x) => !(istObjekt(x) && typeof x.id === 'string' && this.erledigt.has(x.id)))
    const schl = eintragSchluessel(liste)
    const alt = this.listen.get(k) ?? new Map()
    const neu: Eintraege = new Map()
    let letzte = -Infinity
    for (let i = 0; i < liste.length; i++) {
      const json = JSON.stringify(liste[i])
      const vorher = alt.get(schl[i])
      let reihe: number
      if (vorher && vorher.reihe > letzte) reihe = vorher.reihe
      else {
        // Zwischen den Vorgänger und den nächsten bekannten Nachfolger einsortieren
        let naechste = Infinity
        for (let j = i + 1; j < liste.length; j++) {
          const n = alt.get(schl[j])
          if (n && n.reihe > letzte) { naechste = n.reihe; break }
        }
        const unten = Number.isFinite(letzte) ? letzte : (Number.isFinite(naechste) ? naechste - 2 : 0)
        reihe = Number.isFinite(naechste) && naechste - unten > 1e-9 ? (unten + naechste) / 2 : unten + 1
      }
      letzte = reihe
      neu.set(schl[i], { json, reihe })
      if (!vorher || vorher.json !== json || vorher.reihe !== reihe) {
        this.planen(ablageSchluessel(k, schl[i]), { art: 'schreiben', schluessel: k, eintrag: schl[i], reihe, klartext: json, ablage: 'liste' })
      }
    }
    for (const e of alt.keys()) if (!neu.has(e)) this.planen(ablageSchluessel(k, e), { art: 'loeschen', schluessel: k })
    if (this.rohListen.delete(k)) this.planen(k, { art: 'loeschen', schluessel: k })
    if (neu.size > 0) this.listen.set(k, neu)
    else this.listen.delete(k)
    this.listeTextNeu(k)
  }

  private listeTextNeu(k: string): void {
    const m = this.listen.get(k)
    if (!m || m.size === 0) {
      if (!this.rohListen.has(k)) this.cache.delete(k)
      return
    }
    const sortiert = [...m.values()].sort((a, b) => a.reihe - b.reihe)
    this.cache.set(k, '[' + sortiert.map((e) => e.json).join(',') + ']')
  }

  /** Alle Schlüssel, die gerade im Tresor stehen. */
  schluessel(): string[] {
    return [...this.cache.keys()]
  }

  // ── Ablegen (asynchron) ──

  private planen(ak: string, op: Op): void {
    this.offen.set(ak, op)
    this.fehl.delete(ak)
    if (this.zustand === 'verschluesselt' || this.zustand === 'oeffnet') this.anstossen()
  }

  private anstossen(): void {
    if (this.laeuft || !this.ablage || !this.key) return
    for (const [ak, op] of this.fehl) if (!this.offen.has(ak)) this.offen.set(ak, op)
    this.fehl.clear()
    if (this.offen.size === 0) return
    this.laeuft = this.abarbeiten().finally(() => {
      this.laeuft = null
      if (this.offen.size > 0) this.anstossen()
    })
  }

  private async datensatz(ak: string, op: Extract<Op, { art: 'schreiben' }>): Promise<Datensatz> {
    const { iv, ct } = await verschluesseln(this.key!, ak, op.klartext)
    const d: Datensatz = { v: 1, iv, ct, art: op.ablage, schluessel: op.schluessel, geaendert: new Date().toISOString() }
    if (op.eintrag !== undefined) d.eintrag = op.eintrag
    if (op.reihe !== undefined) d.reihe = op.reihe
    return d
  }

  private async abarbeiten(): Promise<void> {
    while (this.offen.size > 0) {
      const runde = [...this.offen]
      this.offen.clear()
      const beruehrt = new Set<string>()
      for (const [ak, op] of runde) {
        beruehrt.add(op.schluessel)
        try {
          // Ein unlesbarer Datensatz, der sich nicht umbenennen ließ, wird nie überschrieben
          if (this.gesperrt.has(ak)) throw new Error('gesperrt')
          if (op.art === 'loeschen') await this.ablage!.loeschen(ak)
          else await this.ablage!.schreiben(ak, await this.datensatz(ak, op))
        } catch {
          // Später erneut (beim nächsten Schreiben), solange nichts Neueres kam
          if (!this.offen.has(ak)) this.fehl.set(ak, op)
        }
      }
      await this.nachRunde(beruehrt)
    }
  }

  private fehltNoch(k: string): boolean {
    for (const op of this.fehl.values()) if (op.schluessel === k) return true
    for (const op of this.offen.values()) if (op.schluessel === k) return true
    return false
  }

  private async nachRunde(beruehrt: Set<string>): Promise<void> {
    for (const k of beruehrt) {
      let fehlgeschlagen = false
      for (const op of this.fehl.values()) if (op.schluessel === k) { fehlgeschlagen = true; break }
      if (fehlgeschlagen) {
        // Rückfall: der ganze Wert als Klartext in localStorage, damit nichts verloren geht
        const wert = this.cache.has(k) ? this.cache.get(k)! : null
        try {
          if (!this.klar) throw new Error('kein Speicher')
          if (wert === null) this.klar.removeItem(k)
          else this.klar.setItem(k, wert)
          if (wert === null) this.klarKopie.delete(k)
          else this.klarKopie.set(k, wert)
          this.ungesichert.delete(k)
        } catch {
          this.ungesichert.add(k)
        }
        continue
      }
      this.ungesichert.delete(k)
      if (this.klarKopie.has(k) && !this.fehltNoch(k)) await this.klarAufraeumen(k)
    }
    if (beruehrt.size > 0 && this.kanal) {
      try { this.kanal.postMessage({ art: 'geaendert', schluessel: [...beruehrt] }) } catch { /* Kanal zu */ }
    }
  }

  /** Liegt der Schlüssel vollständig und lesbar verschlüsselt? Dann den Klartext löschen, wenn er sich nicht geändert hat. */
  private async klarAufraeumen(k: string): Promise<void> {
    const kopie = this.klarKopie.get(k)
    if (kopie === undefined || !this.klar) return
    if (!(await this.abgleichen(k))) return
    try {
      if (this.klar.getItem(k) === kopie) this.klar.removeItem(k)
      this.klarKopie.delete(k)
    } catch { /* bleibt, nächster Versuch */ }
  }

  /** Zurücklesen, entschlüsseln, vergleichen (5.2, Schritt 3). */
  async abgleichen(k: string): Promise<boolean> {
    if (!this.ablage || !this.key) return false
    try {
      const roh = await this.ablage.lesen()
      if (istListenSchluessel(k) && !this.rohListen.has(k)) {
        const soll = this.listen.get(k) ?? new Map()
        let gefunden = 0
        for (const [ak, rec] of Object.entries(roh)) {
          if (!istObjekt(rec) || rec.schluessel !== k || rec.art !== 'liste') continue
          const eintrag = typeof rec.eintrag === 'string' ? rec.eintrag : ''
          const e = soll.get(eintrag)
          if (!e) return false
          if ((await entschluesseln(this.key, rec, ak)) !== e.json) return false
          gefunden++
        }
        return gefunden === soll.size
      }
      const wert = this.cache.has(k) ? this.cache.get(k)! : null
      const rec = roh[k]
      if (wert === null) return rec === undefined
      if (rec === undefined) return false
      return (await entschluesseln(this.key, rec, k)) === wert
    } catch {
      return false
    }
  }

  /** Wartet, bis alles abgelegt ist; false, wenn etwas weder verschlüsselt noch als Klartext sicher liegt. */
  async geschrieben(): Promise<boolean> {
    for (let i = 0; i < 1000 && this.laeuft; i++) { try { await this.laeuft } catch { /* weiter */ } }
    return this.ungesichert.size === 0
  }

  /** Liegt noch etwas nur im Arbeitsspeicher? (Warnung beim Verlassen.) */
  ausstehend(): boolean {
    return this.offen.size > 0 || !!this.laeuft || this.ungesichert.size > 0
  }

  // ── Öffnen, Laden, Umzug ──

  private async laden(): Promise<void> {
    const roh = await this.ablage!.lesen()
    const listen = new Map<string, Eintraege>()
    for (const [ak, rec] of Object.entries(roh)) {
      if (ak.includes(UNLESBAR)) { this.probleme++; continue }
      const k = istObjekt(rec) && typeof rec.schluessel === 'string' ? rec.schluessel : ak.split('\u0000')[0]
      if (!istTresorSchluessel(k)) continue
      let text: string
      try {
        text = await entschluesseln(this.key!, rec, ak)
      } catch {
        // Nie überschreiben, nie löschen: umbenennen und zählen
        this.probleme++
        try {
          await this.ablage!.schreiben(`${ak}${UNLESBAR}${Date.now()}`, rec)
          await this.ablage!.loeschen(ak)
        } catch { /* bleibt, wo er ist; ein Schreiben an derselben Stelle überschriebe ihn: deshalb gesperrt */ this.gesperrt.add(ak) }
        continue
      }
      const r = rec as Record<string, unknown>
      if (r.art === 'liste' && typeof r.eintrag === 'string' && istListenSchluessel(k)) {
        const m = listen.get(k) ?? new Map()
        m.set(r.eintrag, { json: text, reihe: typeof r.reihe === 'number' && Number.isFinite(r.reihe) ? r.reihe : 0 })
        listen.set(k, m)
      } else if (istListenSchluessel(k)) {
        this.rohListen.add(k)
        this.cache.set(k, text)
      } else {
        this.cache.set(k, text)
      }
    }
    for (const [k, m] of listen) {
      this.listen.set(k, m)
      this.rohListen.delete(k)
      this.listeTextNeu(k)
    }
  }

  /** Ablageschlüssel, die nicht beschrieben werden dürfen (unlesbar, Umbenennen scheiterte). */
  private gesperrt = new Set<string>()

  private async erledigtAnwenden(): Promise<void> {
    if (!this.ablage?.erledigtLesen) return
    let roh: Record<string, unknown> = {}
    try { roh = await this.ablage.erledigtLesen() } catch { return }
    const alt: string[] = []
    const jetzt = Date.now()
    for (const [id, w] of Object.entries(roh)) {
      this.erledigt.add(id)
      const am = istObjekt(w) && typeof w.am === 'string' ? Date.parse(w.am) : NaN
      if (!Number.isFinite(am) || jetzt - am > ERLEDIGT_MS) alt.push(id)
    }
    // Was im Hintergrund schon gesendet wurde, aus den Listen nehmen (falls dort noch etwas liegt)
    for (const k of [...this.listen.keys()]) {
      const liste = listeLesen(this.cache.get(k) ?? null) ?? []
      if (liste.some((x) => istObjekt(x) && typeof x.id === 'string' && this.erledigt.has(x.id))) this.listeSetzen(k, liste)
    }
    if (alt.length > 0) { try { await this.ablage.erledigtLoeschen?.(alt) } catch { /* beim nächsten Öffnen */ } }
  }

  /**
   * Klartext-Einträge aus localStorage in den Tresor holen (5.2). Gibt je Schlüssel den
   * gelesenen Klartext und ob er sicher verschlüsselt liegt zurück; gelöscht wird erst in
   * `abschliessen`, synchron.
   */
  private async umziehen(): Promise<{ k: string; roh: string; ok: boolean }[]> {
    const klar = this.klar
    if (!klar || typeof klar.key !== 'function' || typeof klar.length !== 'number') return []
    const schl: string[] = []
    try {
      for (let i = 0; i < (klar.length as number); i++) {
        const k = klar.key!(i)
        if (k && istTresorSchluessel(k)) schl.push(k)
      }
    } catch { return [] }
    const aus: { k: string; roh: string; ok: boolean }[] = []
    for (const k of schl) {
      let roh: string | null
      try { roh = klar.getItem(k) } catch { continue }
      if (roh === null) continue
      this.uebernehmen(k, roh)
      aus.push({ k, roh, ok: false })
    }
    if (aus.length === 0) return aus
    this.anstossen()
    await this.geschrieben()
    for (const a of aus) a.ok = !this.fehltNoch(a.k) && await this.abgleichen(a.k)
    return aus
  }

  /**
   * Klartext `roh` unter `k` mit dem Tresorwert zusammenführen (zusammenfuehren). Bei einem
   * Entwurf geht der unterlegene Stand nicht verloren (Review F6): Hat die Seite nach der
   * Zeitgrenze im Klartext weitergeschrieben, während der ältere Entwurf im Tresor lag, bleibt
   * der ältere unter `k~frueher-<ms>`.
   */
  private uebernehmen(k: string, roh: string): void {
    const t = this.getItem(k)
    const wert = zusammenfuehren(k, t, roh)
    if (istEntwurf(k) && t !== null && wert !== null && t !== roh) {
      const verlierer = wert === t ? roh : wert === roh ? t : null
      if (verlierer !== null && entwurfMitInhalt(verlierer) && !gleicherEntwurf(verlierer, wert)) {
        const fk = this.frueherFrei(k, verlierer)
        if (fk) this.setItem(fk, verlierer)
      }
    }
    if (wert !== null && wert !== this.getItem(k)) this.setItem(k, wert)
  }

  /** Ein freier Schlüssel `k~frueher-<ms>` für `text` (schon da mit gleichem Inhalt: null). */
  private frueherFrei(k: string, text: string): string | null {
    const basis = entwurfBasis(k)
    const ms = Number.isFinite(standVon(text)) ? standVon(text) : Date.now()
    for (let n = 0; n < 100; n++) {
      const fk = `${basis}${ENTWURF_FRUEHER}${ms}${n ? `-${n}` : ''}`
      const da = this.getItem(fk)
      if (da === null) return fk
      if (gleicherEntwurf(da, text)) return null
    }
    return null
  }

  /** Den Umzug abschließen: geprüfte Klartexte löschen, wenn sie sich nicht geändert haben (synchron). */
  private abschliessen(umzug: { k: string; roh: string; ok: boolean }[]): void {
    for (const { k, roh, ok } of umzug) {
      let jetzt: string | null = null
      try { jetzt = this.klar?.getItem(k) ?? null } catch { jetzt = roh }
      if (jetzt !== roh) {
        // Inzwischen neu geschrieben (anderes Fenster, alte Fassung, Klartext während des Öffnens)
        if (jetzt !== null) {
          this.uebernehmen(k, jetzt)
          this.klarKopie.set(k, jetzt)
        }
        continue
      }
      if (ok) {
        try { this.klar?.removeItem(k) } catch { this.klarKopie.set(k, roh) }
      } else {
        this.klarKopie.set(k, roh)
      }
    }
    // Erst nach dem Lesen der Schlüssel im Klartext entstanden (die Seite lief nach der
    // Zeitgrenze schon im Klartext, ein anderes Fenster mit alter Fassung): jetzt noch
    // übernehmen, damit die Seite es nach dem Umschalten sieht. Der Klartext bleibt, bis
    // er verschlüsselt und geprüft liegt (klarAufraeumen), spätestens bis zum nächsten Start.
    const klar = this.klar
    if (!klar || typeof klar.key !== 'function' || typeof klar.length !== 'number') return
    const gesehen = new Set(umzug.map((u) => u.k))
    try {
      const spaeter: string[] = []
      for (let i = 0; i < (klar.length as number); i++) {
        const k = klar.key!(i)
        if (k && istTresorSchluessel(k) && !gesehen.has(k)) spaeter.push(k)
      }
      for (const k of spaeter) {
        const roh = klar.getItem(k)
        if (roh === null) continue
        this.uebernehmen(k, roh)
        this.klarKopie.set(k, roh)
      }
    } catch { /* der nächste Start zieht um */ }
  }

  /**
   * Öffnen: Schlüssel holen oder erzeugen, alles entschlüsseln, Klartext umziehen.
   * `istAbgebrochen`: wird vor dem Abschluss gefragt (Zeitgrenze überschritten und jemand
   * anderes hat inzwischen übernommen); dann bleibt der Klartext unangetastet.
   */
  async oeffnen(ablage: TresorAblage, klar: KlarSpeicher | null, o: { api?: string; kanal?: TresorKanal | null } = {}): Promise<void> {
    this.ablage = ablage
    this.klar = klar
    let key = await ablage.schluessel()
    if (!key) {
      await ablage.schluesselSetzen(await schluesselErzeugen())
      key = await ablage.schluessel()
      if (!key) throw new Error('kein Schlüssel')
    }
    this.key = key
    if (o.api && ablage.metaSetzen) { try { await ablage.metaSetzen('api', o.api) } catch { /* der Hintergrund fragt dann nicht */ } }
    const arbeit = async () => {
      await this.laden()
      await this.erledigtAnwenden()
      const umzug = await this.umziehen()
      // Abschluss und Umschalten in einem Zug: dazwischen darf niemand mehr in den Klartext schreiben
      this.abschliessen(umzug)
      this.zustand = 'verschluesselt'
      this.klartextGrund = ''
    }
    const locks = (globalThis as { navigator?: { locks?: { request(n: string, f: () => Promise<void>): Promise<void> } } }).navigator?.locks
    if (locks && typeof locks.request === 'function') await locks.request(TRESOR_SPERRE, arbeit)
    else await arbeit()
    if (o.kanal !== undefined) this.kanal = o.kanal
    if (this.kanal) this.kanal.onmessage = (ev) => { void this.nachricht(ev?.data) }
    this.anstossen()
  }

  private async nachricht(d: unknown): Promise<void> {
    if (!istObjekt(d) || d.art !== 'geaendert' || !Array.isArray(d.schluessel)) return
    await this.neuLaden(d.schluessel.filter((x): x is string => typeof x === 'string' && istTresorSchluessel(x)))
  }

  /**
   * Schlüssel neu aus der Ablage lesen, die ein anderes Fenster oder der Service Worker
   * geändert hat. Was dieses Fenster selbst noch nicht abgelegt hat, bleibt (je Eintrag).
   */
  async neuLaden(schluessel: string[]): Promise<void> {
    if (!this.ablage || !this.key || schluessel.length === 0) return
    let roh: Record<string, unknown>
    try { roh = await this.ablage.lesen() } catch { return }
    if (this.ablage.erledigtLesen) {
      try { for (const id of Object.keys(await this.ablage.erledigtLesen())) this.erledigt.add(id) } catch { /* ohne */ }
    }
    const ziel = new Set(schluessel)
    const listen = new Map<string, Eintraege>()
    const einzeln = new Map<string, string>()
    for (const [ak, rec] of Object.entries(roh)) {
      if (ak.includes(UNLESBAR) || !istObjekt(rec) || typeof rec.schluessel !== 'string' || !ziel.has(rec.schluessel)) continue
      let text: string
      try { text = await entschluesseln(this.key, rec, ak) } catch { continue }
      if (rec.art === 'liste' && typeof rec.eintrag === 'string') {
        const m = listen.get(rec.schluessel) ?? new Map()
        m.set(rec.eintrag, { json: text, reihe: typeof rec.reihe === 'number' ? rec.reihe : 0 })
        listen.set(rec.schluessel, m)
      } else einzeln.set(rec.schluessel, text)
    }
    const lokal = (ak: string) => this.offen.get(ak) ?? this.fehl.get(ak)
    for (const k of ziel) {
      if (istListenSchluessel(k) && !this.rohListen.has(k)) {
        const vorher = this.listen.get(k) ?? new Map()
        const neu: Eintraege = new Map()
        for (const [e, w] of listen.get(k) ?? new Map()) {
          const op = lokal(ablageSchluessel(k, e))
          if (op?.art === 'loeschen') continue
          if (op?.art === 'schreiben') { neu.set(e, { json: op.klartext, reihe: op.reihe ?? w.reihe }); continue }
          let id: unknown
          try { id = (JSON.parse(w.json) as Record<string, unknown>)?.id } catch { id = undefined }
          if (typeof id === 'string' && this.erledigt.has(id)) continue
          neu.set(e, w)
        }
        // Eigene, noch nicht abgelegte Einträge behalten
        for (const [e, w] of vorher) {
          const op = lokal(ablageSchluessel(k, e))
          if (op?.art === 'schreiben' && !neu.has(e)) neu.set(e, w)
        }
        if (neu.size > 0) this.listen.set(k, neu)
        else this.listen.delete(k)
        this.listeTextNeu(k)
        continue
      }
      const op = lokal(k)
      if (op) continue
      if (einzeln.has(k)) this.cache.set(k, einzeln.get(k)!)
      else this.cache.delete(k)
    }
    this.onNeuGeladen?.([...ziel])
  }

  /** Auf Klartext bleiben (kein Tresor möglich oder Öffnen gescheitert). */
  klartext(grund: KlartextGrund): void {
    this.zustand = 'klartext'
    this.klartextGrund = grund
  }

  /** Wie viele Formulare im Tresor warten (alle Organisationen, neue und alte Schlange). */
  wartend(): number {
    const schl = [...this.cache.keys()].filter((k) => istListenSchluessel(k) || k.startsWith('offline_queue_'))
    return anzahlAlle({ length: schl.length, key: (i: number) => schl[i] ?? null, getItem: (k: string) => this.getItem(k) })
  }

  /** Schlüssel begonnener Protokolle mit Inhalt. */
  entwuerfe(): string[] {
    return [...this.cache.keys()].filter((k) => istEntwurf(k))
  }

  /** Der Tresor als Ganzes für den Abgleich in den Prüffällen. */
  momentaufnahme(): Record<string, string> {
    return Object.fromEntries(this.cache)
  }

  /** Klartextkopien, die noch in localStorage liegen (Prüffälle). */
  klarKopien(): string[] {
    return [...this.klarKopie.keys()]
  }
}

// ── Der Tresor der App ──────────────────────────────────────────────────────

let kern = new TresorKern()
let weicheObjekt: Speicher | null = null
/** Das laufende Öffnen (für tresorBereit). */
let oeffnenLauf: Promise<unknown> | null = null

/** localStorage, wenn das Gerät ihn hergibt (privates Fenster, gesperrt: null). */
export function lokalerSpeicher(): KlarSpeicher | null {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage
    if (!s) return null
    s.getItem('formular_probe')
    return s
  } catch {
    return null
  }
}

function idbVerfuegbar(): boolean {
  try { return typeof (globalThis as { indexedDB?: unknown }).indexedDB === 'object' && (globalThis as { indexedDB?: unknown }).indexedDB !== null } catch { return false }
}

function warte(ms: number): Promise<'zeit'> {
  return new Promise((r) => setTimeout(() => r('zeit'), ms))
}

/**
 * Den Tresor öffnen (main.tsx, vor dem ersten Rendern). Grenze `zeitMs` (Vorgabe 1500):
 * danach arbeitet die Seite vorerst im Klartext weiter; ist der Tresor später offen,
 * zieht er den Klartext dieser Sitzung um und übernimmt (nichts geht verloren).
 * Geht es auf dem Gerät gar nicht, bleibt es beim Klartext wie bisher.
 */
export async function tresorOeffnen(o: { zeitMs?: number; ablage?: TresorAblage; klar?: KlarSpeicher | null; api?: string; kanal?: TresorKanal | null } = {}): Promise<'verschluesselt' | 'klartext'> {
  if (kern.zustand === 'verschluesselt') return 'verschluesselt'
  if (kern.zustand === 'oeffnet' || kern.zustand === 'klartext') return 'klartext'
  const klar = o.klar !== undefined ? o.klar : lokalerSpeicher()
  kern.klar = klar
  const ablage = o.ablage ?? (idbVerfuegbar() && subtle() ? idbAblage() : null)
  if (!ablage || !subtle()) { kern.klartext('nicht_moeglich'); return 'klartext' }
  let kanal: TresorKanal | null = null
  if (o.kanal !== undefined) kanal = o.kanal
  else {
    // Nur im Fenster (in Node hielte ein offener Kanal den Prozess am Leben)
    try { kanal = typeof window !== 'undefined' && typeof BroadcastChannel === 'function' ? new BroadcastChannel(TRESOR_KANAL) as unknown as TresorKanal : null } catch { kanal = null }
  }
  const dieser = kern
  dieser.zustand = 'oeffnet'
  // Ein anderes Fenster oder der Service Worker hat etwas geändert: die Karten lesen neu
  dieser.onNeuGeladen = (schl) => {
    try { window.dispatchEvent(new CustomEvent(TRESOR_EREIGNIS, { detail: schl })) } catch { /* ohne Fenster */ }
  }
  const lauf = dieser.oeffnen(ablage, klar, { api: o.api, kanal }).then(() => 'offen' as const, () => {
    dieser.klartext('fehler')
    try { kanal?.close?.() } catch { /* zu */ }
    return 'fehler' as const
  })
  oeffnenLauf = lauf
  const r = await Promise.race([lauf, warte(o.zeitMs ?? 1500)])
  if (r === 'offen') return 'verschluesselt'
  if (r === 'zeit') {
    dieser.klartextGrund = 'zeit'
    // Erst nach der Zeitgrenze offen: die Masken sollen ihren Entwurf jetzt aus dem Tresor lesen
    void lauf.then((x) => {
      if (x !== 'offen') return
      try { window.dispatchEvent(new Event(TRESOR_OFFEN_EREIGNIS)) } catch { /* ohne Fenster */ }
    })
  }
  return 'klartext'
}

/** Öffnet der Tresor noch (nach der Zeitgrenze)? Dann liegt ein Entwurf vielleicht noch verschlüsselt und ungelesen. */
export function tresorOeffnetNoch(): boolean {
  return kern.zustand === 'oeffnet'
}

/**
 * Wartet, bis das Öffnen fertig ist (offen oder gescheitert), höchstens `zeitMs` (Vorgabe 8000).
 * Die Masken lesen ihren Entwurf erst danach (Review F6), damit sie keinen verschlüsselten
 * Entwurf übersehen und überschreiben.
 */
export async function tresorBereit(zeitMs = 8000): Promise<TresorZustand> {
  if (kern.zustand === 'oeffnet' && oeffnenLauf) await Promise.race([oeffnenLauf.catch(() => {}), warte(zeitMs)])
  return tresorZustand()
}

/** Zustand für Hinweise: verschlüsselt, Klartext (auch: öffnet noch) oder zu (nicht geöffnet, etwa in Prüffällen). */
export function tresorZustand(): TresorZustand {
  if (kern.zustand === 'verschluesselt') return 'verschluesselt'
  if (kern.zustand === 'zu') return 'zu'
  return 'klartext'
}

/** Warum Klartext: `nicht_moeglich`/`fehler` (Browser lässt es nicht zu), `zeit` (öffnet noch). */
export function tresorKlartextGrund(): KlartextGrund {
  return kern.zustand === 'verschluesselt' ? '' : kern.klartextGrund
}

/** Die synchrone Fassade für Tresor-Schlüssel (nur gültig, solange der Tresor offen ist). */
export function tresorSpeicher(): Speicher {
  return { getItem: (k) => kern.getItem(k), setItem: (k, v) => kern.setItem(k, v), removeItem: (k) => kern.removeItem(k) }
}

/**
 * Speicher für die Formulare (`geraeteSpeicher` in src/lib/formular/api.ts): Tresor-Schlüssel
 * an den Tresor, alles andere an localStorage. Ist der Tresor nicht geöffnet, wie bisher
 * localStorage bzw. null.
 */
export function tresorWeiche(): Speicher | null {
  const klar = lokalerSpeicher()
  if (kern.zustand === 'zu') return klar
  if (kern.zustand !== 'verschluesselt' && !klar) return null
  if (!weicheObjekt) {
    weicheObjekt = {
      getItem(k: string) {
        if (kern.zustand === 'verschluesselt' && istTresorSchluessel(k)) return kern.getItem(k)
        const s = lokalerSpeicher()
        return s ? s.getItem(k) : null
      },
      setItem(k: string, v: string) {
        if (kern.zustand === 'verschluesselt' && istTresorSchluessel(k)) { kern.setItem(k, v); return }
        const s = lokalerSpeicher()
        if (!s) throw new Error('Kein Speicher auf diesem Gerät.')
        s.setItem(k, v)
      },
      removeItem(k: string) {
        if (kern.zustand === 'verschluesselt' && istTresorSchluessel(k)) { kern.removeItem(k); return }
        lokalerSpeicher()?.removeItem(k)
      },
    }
  }
  return weicheObjekt
}

/** Wartet, bis alles abgelegt ist. false: etwas liegt weder verschlüsselt noch als Klartext sicher. */
export function tresorGeschrieben(): Promise<boolean> {
  if (kern.zustand !== 'verschluesselt') return Promise.resolve(true)
  return kern.geschrieben()
}

/** Ist noch etwas nicht abgelegt? (Warnung beim Verlassen.) */
export function tresorUngeschrieben(): boolean {
  return kern.zustand === 'verschluesselt' && kern.ausstehend()
}

/** Einträge aller Warteschlangen auf dem Gerät (Warnung beim Verlassen, Abmelden). */
export function tresorWartend(): number {
  if (kern.zustand === 'verschluesselt') {
    let n = kern.wartend()
    // Klartext, der (noch) nicht umgezogen ist, etwa von einer alten Fassung in einem anderen Tab
    const klar = lokalerSpeicher()
    if (klar) {
      try {
        const schl: string[] = []
        for (let i = 0; i < klar.length; i++) {
          const k = klar.key(i)
          if (k && (istListenSchluessel(k) || k.startsWith('offline_queue_')) && kern.getItem(k) === null) schl.push(k)
        }
        if (schl.length) n += anzahlAlle({ length: schl.length, key: (i) => schl[i] ?? null, getItem: (k) => klar.getItem(k) })
      } catch { /* nicht zählen */ }
    }
    return n
  }
  const klar = lokalerSpeicher()
  if (!klar) return 0
  try { return anzahlAlle(klar as Storage) } catch { return 0 }
}

/** Gibt es ein begonnenes Protokoll auf dem Gerät? */
export function tresorEntwuerfe(): number {
  const schl = new Set<string>(kern.zustand === 'verschluesselt' ? kern.entwuerfe() : [])
  const klar = lokalerSpeicher()
  if (klar) {
    try {
      for (let i = 0; i < klar.length; i++) {
        const k = klar.key(i)
        if (k && istEntwurf(k) && klar.getItem(k)) schl.add(k)
      }
    } catch { /* nicht zählen */ }
  }
  return schl.size
}

/** Alle Entwurfsschlüssel auf dem Gerät (Tresor und localStorage), mit Fundort. */
function entwurfsSchluessel(): { k: string; tresor: boolean }[] {
  const aus = new Map<string, boolean>()
  if (kern.zustand === 'verschluesselt') for (const k of kern.entwuerfe()) aus.set(k, true)
  const klar = lokalerSpeicher()
  if (klar) {
    try {
      for (let i = 0; i < klar.length; i++) {
        const k = klar.key(i)
        if (k && istEntwurf(k) && !aus.has(k)) aus.set(k, false)
      }
    } catch { /* nicht lesbar */ }
  }
  return [...aus].map(([k, tresor]) => ({ k, tresor }))
}

function entwurfText(k: string, tresor: boolean): string | null {
  try { return tresor ? kern.getItem(k) : (lokalerSpeicher()?.getItem(k) ?? null) } catch { return null }
}
function entwurfSetzen(k: string, tresor: boolean, v: string): void {
  try { if (tresor) kern.setItem(k, v); else lokalerSpeicher()?.setItem(k, v) } catch { /* bleibt, wie es ist */ }
}
function entwurfWeg(k: string, tresor: boolean): void {
  try { if (tresor) kern.removeItem(k); else lokalerSpeicher()?.removeItem(k) } catch { /* bleibt */ }
}

/**
 * Verfallene Entwürfe vom Gerät nehmen (Review F5), einmal beim Start (main.tsx), sobald der
 * Tresor offen ist. Ein Entwurf mit Zeitpunkt (`{ stand, werte }`) verfällt nach
 * ENTWURF_FRIST_MS (auch ein Zeitpunkt so weit in der Zukunft). Ein Entwurf der alten Maske
 * ohne Zeitpunkt (aus der Zeit vor dieser Regel) bekommt jetzt einen und verfällt einen Tag
 * später. Unlesbares unter `doku_entwurf_` kann keine Maske mehr anbieten und fällt weg.
 * Gibt die Zahl der entfernten Entwürfe zurück.
 */
export function entwuerfeAufraeumen(jetzt = Date.now()): number {
  let n = 0
  for (const { k, tresor } of entwurfsSchluessel()) {
    const text = entwurfText(k, tresor)
    if (text === null) continue
    let o: unknown = null
    try { o = JSON.parse(text) } catch { o = null }
    const stand = istObjekt(o) && typeof o.stand === 'string' ? Date.parse(o.stand) : NaN
    if (Number.isFinite(stand) && istObjekt(o) && istObjekt(o.werte)) {
      if (Math.abs(jetzt - stand) > ENTWURF_FRIST_MS) { entwurfWeg(k, tresor); n++ }
      continue
    }
    if (k.startsWith('patientendoku_') && istObjekt(o)) {
      // Alte Maske, alter Stand ohne Zeitpunkt: ab jetzt einen Tag
      entwurfSetzen(k, tresor, JSON.stringify({ entwurf: 1, stand: new Date(jetzt).toISOString(), werte: o }))
      continue
    }
    entwurfWeg(k, tresor)
    n++
  }
  return n
}

/**
 * Liegt unter `basis` kein Entwurf mehr, aber ein aufgehobener (`basis~frueher-…`), rückt der
 * neueste nach und wird damit wie jeder Entwurf angeboten (Review F6). Gibt true zurück, wenn
 * einer nachgerückt ist.
 */
export function entwurfNachruecken(basis: string): boolean {
  const alle = entwurfsSchluessel()
  const haupt = alle.find((x) => x.k === basis)
  if (haupt && entwurfText(haupt.k, haupt.tresor) !== null) return false
  const frueher = alle.filter((x) => x.k.startsWith(basis + ENTWURF_FRUEHER))
  if (frueher.length === 0) return false
  const zahl = (k: string) => Number(k.slice((basis + ENTWURF_FRUEHER).length).split('-')[0]) || 0
  frueher.sort((a, b) => zahl(b.k) - zahl(a.k))
  const neu = frueher[0]
  const text = entwurfText(neu.k, neu.tresor)
  if (text === null) return false
  // Erst schreiben, dann den aufgehobenen löschen: nichts geht verloren
  const ziel = kern.zustand === 'verschluesselt'
  entwurfSetzen(basis, ziel, text)
  if (entwurfText(basis, ziel) !== text) return false
  entwurfWeg(neu.k, neu.tresor)
  return true
}

/** Begonnene Protokolle löschen (Abmelden, F13); die Warteschlange bleibt. */
export async function tresorEntwuerfeLoeschen(): Promise<void> {
  if (kern.zustand === 'verschluesselt') {
    for (const k of kern.entwuerfe()) kern.removeItem(k)
    await kern.geschrieben()
  }
  const klar = lokalerSpeicher()
  if (!klar) return
  try {
    const weg: string[] = []
    for (let i = 0; i < klar.length; i++) {
      const k = klar.key(i)
      if (k && istEntwurf(k)) weg.push(k)
    }
    for (const k of weg) klar.removeItem(k)
  } catch { /* nichts gespeichert */ }
}

/**
 * localStorage leeren (Abmelden), ohne die Warteschlange zu verlieren: Klartext der
 * Warteschlange (kein Tresor möglich, Rückfall, alte Schlange) wird danach wieder
 * hingeschrieben. Entwürfe gehen mit.
 */
export function leerenOhneWarteschlange(leeren: () => void): void {
  const klar = lokalerSpeicher()
  const behalten: [string, string][] = []
  if (klar) {
    try {
      for (let i = 0; i < klar.length; i++) {
        const k = klar.key(i)
        if (!k || !(istListenSchluessel(k) || k.startsWith('offline_queue_'))) continue
        const v = klar.getItem(k)
        if (v !== null) behalten.push([k, v])
      }
    } catch { /* unlesbar */ }
  }
  leeren()
  const nach = lokalerSpeicher()
  for (const [k, v] of behalten) { try { nach?.setItem(k, v) } catch { /* voll */ } }
}

/** Unlesbare Datensätze auf diesem Gerät. */
export function tresorProbleme(): number {
  return kern.probleme
}

/** Kennungen, die der Hintergrundversand schon gesendet hat. */
export function erledigtVomHintergrund(): Set<string> {
  return new Set(kern.erledigt)
}

// ── Dauerhafter Speicher, Hintergrundversand (5.5, 5.6, 5.7) ──────────────

let persistGefragt = false
/** Einmal je Sitzung um dauerhaften Speicher bitten (Ergebnis egal, Fehler still). */
export function dauerhaftAnfragen(): void {
  if (persistGefragt) return
  persistGefragt = true
  try {
    const st = (globalThis as { navigator?: { storage?: { persist?: () => Promise<boolean> } } }).navigator?.storage
    const p = st?.persist?.()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } catch { /* ohne */ }
}

let dienstBereit: boolean | null = null
/** Prüfen, ob ein Service Worker mit Background Sync bereitsteht (main.tsx, einmal). */
export function hintergrundPruefen(zeitMs = 5000): void {
  try {
    const sw = (globalThis as { navigator?: { serviceWorker?: ServiceWorkerContainer } }).navigator?.serviceWorker
    if (!sw) { dienstBereit = false; return }
    const uhr = setTimeout(() => { if (dienstBereit === null) dienstBereit = false }, zeitMs)
    sw.ready.then((r) => { clearTimeout(uhr); dienstBereit = !!(r as ServiceWorkerRegistration & { sync?: unknown }).sync }, () => { dienstBereit = false })
  } catch {
    dienstBereit = false
  }
}

/**
 * Kann dieses Gerät abgelegte Formulare im Hintergrund senden (Background Sync)? Ohne
 * (iOS, Firefox) sagt die App, dass die Seite später mit Netz wieder geöffnet werden muss.
 * Außerhalb eines Browsers (Prüffälle in Node) gibt es keinen Hinweis.
 */
export function hintergrundMoeglich(): boolean {
  const w = (globalThis as unknown as { window?: object }).window
  if (!w) return true
  if (!('SyncManager' in w)) return false
  // Der Service Worker liest nur den Tresor, nie localStorage
  if (kern.zustand !== 'verschluesselt') return false
  return dienstBereit !== false
}

/**
 * Den Hintergrundversand anmelden (Background Sync, Tag `responda-formulare`). Mehrfach
 * anmelden schadet nicht: Chrome führt je Tag einen Sync. Ohne Service Worker oder ohne
 * Background Sync still nichts.
 */
export function syncAnmelden(): void {
  try {
    const sw = (globalThis as { navigator?: { serviceWorker?: ServiceWorkerContainer } }).navigator?.serviceWorker
    if (!sw) return
    sw.ready.then((r) => {
      const sync = (r as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync
      return sync?.register(SYNC_TAG)
    }).catch(() => { /* ohne Hintergrundversand */ })
  } catch { /* ohne */ }
}

/** Nach jedem Ablegen: dauerhaften Speicher erbitten und den Hintergrundversand anmelden. */
export function nachAblage(): void {
  dauerhaftAnfragen()
  syncAnmelden()
}

// ── Karten der Warteschlange (für den Service Worker) ─────────────────────

const karten = new Map<string, number>()
/** Eine Karte der Warteschlange ist eingehängt (sie arbeitet die Schlange dieser Organisation ab). */
export function karteAn(orgCode: string): () => void {
  karten.set(orgCode, (karten.get(orgCode) ?? 0) + 1)
  return () => {
    const n = (karten.get(orgCode) ?? 1) - 1
    if (n <= 0) karten.delete(orgCode)
    else karten.set(orgCode, n)
  }
}
/** Organisationen, deren Warteschlange ein Fenster gerade abarbeitet. */
export function kartenOrgs(): string[] {
  return [...karten.keys()]
}

// ── Fenster: Warnung beim Verlassen, Nachrichten des Service Workers ──────

/** Nachricht des Service Workers an die Fenster (public/sw-formulare.js). */
export const SW_FRAGE = 'formulare-senden'
/** Antwort eines Fensters an den Service Worker. */
export const SW_ANTWORT = 'formulare-karten'

let verlassenFrei = false
/** Die App verlässt die Seite selbst (Abmelden): keine Rückfrage des Browsers mehr. */
export function verlassenErlauben(): void {
  verlassenFrei = true
}

/** Soll der Browser vor dem Schließen warnen? Ein Formular wartet oder ist noch nicht abgelegt (5.5). */
export function verlassenWarnen(): boolean {
  if (verlassenFrei) return false
  try { return tresorWartend() > 0 || tresorUngeschrieben() } catch { return false }
}

/** Der Handler für `beforeunload`: der Browser zeigt seinen eigenen Text (iOS fragt nie). */
export function beimVerlassen(ev: { preventDefault(): void; returnValue?: unknown }): void {
  if (!verlassenWarnen()) return
  ev.preventDefault()
  // Ältere Chrome-Fassungen verlangen returnValue
  try { ev.returnValue = '' } catch { /* schreibgeschützt */ }
}

/**
 * Antwort an den Service Worker: welche Organisationen dieses Fenster selbst abarbeitet.
 * Auch ein verdecktes Fenster meldet seine Karten (Review F3): Die Karte arbeitet weiter,
 * sobald die Seite wieder sichtbar ist (etwa nach einem Blick in den Passwortmanager).
 * Dass überhaupt ein Fenster offen ist, sieht der Service Worker an der Antwort; Einträge im
 * Modus Passwort und angemeldet abgelegte sendet er dann nicht (F12).
 */
export function kartenAntwort(sichtbar: boolean): { art: string; orgs: string[]; sichtbar: boolean } {
  return { art: SW_ANTWORT, orgs: kartenOrgs(), sichtbar }
}

/**
 * Einmal beim Start (main.tsx, nach `tresorOeffnen`): Warnung beim Verlassen, Antwort
 * auf den Service Worker, dauerhafter Speicher, wenn schon etwas wartet, und die Frage,
 * ob es Background Sync gibt. Gibt eine Funktion zum Abmelden der Handler zurück.
 */
export function fensterEinrichten(): () => void {
  const w = (globalThis as unknown as { window?: Window }).window
  if (!w) return () => {}
  const weg: (() => void)[] = []
  try {
    w.addEventListener('beforeunload', beimVerlassen)
    weg.push(() => w.removeEventListener('beforeunload', beimVerlassen))
  } catch { /* ohne */ }
  try {
    const sw = w.navigator?.serviceWorker
    if (sw) {
      const nachricht = (ev: MessageEvent) => {
        const d = ev.data as { art?: unknown } | null
        if (!d || d.art !== SW_FRAGE) return
        const sichtbar = typeof document === 'undefined' || document.visibilityState === 'visible'
        try { ev.ports?.[0]?.postMessage(kartenAntwort(sichtbar)) } catch { /* Port zu */ }
        try { w.dispatchEvent(new Event(SENDEN_EREIGNIS)) } catch { /* ohne */ }
      }
      sw.addEventListener('message', nachricht)
      weg.push(() => sw.removeEventListener('message', nachricht))
    }
  } catch { /* ohne Service Worker */ }
  // Wird die Seite verdeckt oder geschlossen, während etwas wartet: Hintergrundversand (erneut) anmelden.
  // Chrome versucht einen Sync nur wenige Male; so bekommt jeder Besuch eine neue Gelegenheit.
  try {
    const verdeckt = () => { if (document.visibilityState === 'hidden' && tresorWartend() > 0) syncAnmelden() }
    document.addEventListener('visibilitychange', verdeckt)
    weg.push(() => document.removeEventListener('visibilitychange', verdeckt))
    // Beim Schließen (pagehide) und wenn das Netz zurückkommt ebenfalls (Nachprüfung): Chrome hat
    // die wenigen Versuche eines älteren Syncs dann vielleicht schon verbraucht
    const wartet = () => { if (tresorWartend() > 0) syncAnmelden() }
    w.addEventListener('pagehide', wartet)
    w.addEventListener('online', wartet)
    weg.push(() => { w.removeEventListener('pagehide', wartet); w.removeEventListener('online', wartet) })
  } catch { /* ohne Dokument */ }
  hintergrundPruefen()
  if (tresorWartend() > 0) nachAblage()
  return () => { for (const f of weg) { try { f() } catch { /* egal */ } } }
}

/** Nur für Prüffälle: einen frischen Tresor einsetzen. */
export function _tresorNeu(k: TresorKern = new TresorKern()): TresorKern {
  kern = k
  weicheObjekt = null
  oeffnenLauf = null
  persistGefragt = false
  dienstBereit = null
  verlassenFrei = false
  karten.clear()
  return k
}
