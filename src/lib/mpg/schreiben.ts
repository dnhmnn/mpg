// Mehrteilige Schreibvorgänge im MPG — alles oder nichts, genau einmal.
//
// Eine Prüfung ist Prüfprotokoll + Gerätestand (+ Defekt), das Bestätigen einer
// Meldung ist Defekt + Gerät + Meldung. Bisher waren das einzelne Aufrufe: Ein
// Abbruch dazwischen hinterließ halbe Stände, ein zweiter Tipp doppelte Defekte.
//
// Jetzt gehen sie als EINE Sammelbuchung (PocketBase-Batch) raus. Neue Datensätze
// tragen eine im Gerät vergebene ID; wird nach einem Abbruch mit DENSELBEN Anfragen
// erneut gesendet, lehnt der Server die doppelte ID ab — es kommt nichts doppelt an.
// Ist der Batch in PocketBase ausgeschaltet, wird einzeln geschrieben; ein erneuter
// Versuch überspringt dann, was schon angelegt ist, und setzt den Rest.

import { newId } from '../eks/ids'
import { innererFehler } from '../lagerBuchung'
import { pbFehlerText } from '../pbFehler'

export const neueId = newId

export interface Anfrage {
  collection: string
  aktion: 'create' | 'update' | 'delete'
  id: string
  body: Record<string, unknown>
}

export interface Server {
  /** Alles oder nichts. */
  sendeBatch(anfragen: Anfrage[]): Promise<unknown>
  sende(anfrage: Anfrage): Promise<unknown>
}

export class SchreibFehler extends Error {
  constructor(
    message: string,
    /** netz: keine Antwort — ob geschrieben wurde, ist offen; mit denselben Anfragen erneut senden */
    public art: 'netz' | 'abgelehnt',
    /** nur ein Teil ist geschrieben (einzeln, ohne Batch) */
    public teilweise = false,
    public ursache?: unknown,
  ) { super(message) }
}

interface PbFehlerRoh { status?: number; message?: string; response?: { message?: string; data?: Record<string, any> } }

const istNetz = (e: unknown) => ((e ?? {}) as PbFehlerRoh).status === 0
const istBatchAus = (e: unknown) => {
  const f = (e ?? {}) as PbFehlerRoh
  return f.status === 403 && /batch/i.test(f.response?.message || f.message || '')
}
const istDoppelt = (e: unknown) => innererFehler(e).response?.data?.id?.code === 'validation_not_unique'
const istWeg = (e: unknown) => ((e ?? {}) as PbFehlerRoh).status === 404
/** 5xx oder 429 (Proxy, Überlast): ob geschrieben wurde, ist offen — wie keine Antwort behandeln */
const istServerFehler = (e: unknown) => { const s = ((e ?? {}) as PbFehlerRoh).status ?? 0; return s >= 500 || s === 429 }
const istAblehnung = (s: number | undefined) => !!s && s >= 400 && s < 500
/** Welche Teilanfrage einer Sammelbuchung abgelehnt wurde, und mit welchem Status */
function abgelehnteTeilanfrage(e: unknown): { index: number; status: number } | null {
  const teile = ((e ?? {}) as PbFehlerRoh).response?.data?.requests
  if (!teile || typeof teile !== 'object') return null
  for (const [k, t] of Object.entries(teile as Record<string, { response?: { status?: number } }>)) {
    if (t?.response) return { index: Number(k), status: Number(t.response.status) }
  }
  return null
}

const FELDNAMEN: Record<string, string> = {
  description: 'Beschreibung', severity: 'Schweregrad', device_id: 'Gerät', notes: 'Bemerkung',
  inspection_date: 'Prüfdatum', status: 'Status', name: 'Bezeichnung',
  interval: 'Prüfintervall', type: 'Gerätetyp', serial_number: 'Seriennummer', location: 'Standort',
  last_stk: 'Letzte STK', last_mtk: 'Letzte MTK', stk_interval_months: 'STK-Intervall', mtk_interval_months: 'MTK-Intervall',
}

let batchAus = false
/** Für die Prüffälle. */
export function _zuruecksetzen() { batchAus = false }
/** Schreibt die App gerade einzeln (Batch in PocketBase aus)? Dann kann ein Vorgang teilweise ankommen. */
export const batchIstAus = () => batchAus

const TEXT_NETZ = 'Keine Antwort vom Server — ob gespeichert wurde, ist unklar. Bitte erneut auf Speichern tippen; doppelt wird nichts angelegt.'

/**
 * Schreibt alle Anfragen gemeinsam. Bei einem Fehler mit DENSELBEN Anfragen
 * (gleiche IDs) erneut aufrufen. Gibt 'schon' zurück, wenn ein früherer Versuch
 * bereits angekommen war.
 *
 * @param verzichtbar Anfragen, an denen der Vorgang nicht scheitern darf (der Eintrag im
 *   Gerätebuch: Sperren, Mängel und Prüfungen gehen vor). Werden sie abgelehnt, wird ohne
 *   sie geschrieben und 'ohne' zurückgegeben. Besteht der Vorgang nur aus ihnen, zählen
 *   sie als nötig.
 */
export async function schreibeZusammen(server: Server, anfragen: Anfrage[], verzichtbar: (a: Anfrage) => boolean = () => false): Promise<'ok' | 'schon' | 'ohne'> {
  if (!anfragen.length) return 'ok'
  const noetig = anfragen.filter(a => !verzichtbar(a))
  const kannOhne = (a: Anfrage) => noetig.length > 0 && verzichtbar(a)
  if (!batchAus) {
    try {
      await server.sendeBatch(anfragen)
      return 'ok'
    } catch (e) {
      if (istNetz(e) || istServerFehler(e)) throw new SchreibFehler(TEXT_NETZ, 'netz', false, e)
      // Ein Batch ist atomar: Gibt es eine der neuen IDs schon, ist ein früherer Versuch durchgegangen
      if (istDoppelt(e)) return 'schon'
      if (!istBatchAus(e)) {
        // Abgelehnt heißt: nichts geschrieben. Hat PocketBase genau eine verzichtbare Anfrage
        // abgelehnt, ohne das Verzichtbare noch einmal — scheitert auch das, nennt der Fehler
        // den eigentlichen Grund. Jede andere Ablehnung bleibt ein Fehler.
        const teil = abgelehnteTeilanfrage(e)
        const a = teil ? anfragen[teil.index] : undefined
        if (a && kannOhne(a) && istAblehnung(teil?.status)) {
          await schreibeZusammen(server, noetig)
          return 'ohne'
        }
        throw new SchreibFehler(pbFehlerText(innererFehler(e), FELDNAMEN), 'abgelehnt', false, e)
      }
      batchAus = true
    }
  }
  let geschrieben = 0
  let schonDa = 0
  let ausgelassen = 0
  for (const a of anfragen) {
    try {
      await server.sende(a)
      geschrieben++
    } catch (e) {
      if (a.aktion === 'create' && istDoppelt(e)) { schonDa++; continue }
      // Schon gelöscht (ein früherer Versuch war durchgegangen)
      if (a.aktion === 'delete' && istWeg(e)) { schonDa++; continue }
      // Verzichtbares abgelehnt (4xx): weiter mit dem Rest
      if (kannOhne(a) && istAblehnung(((e ?? {}) as PbFehlerRoh).status)) { ausgelassen++; continue }
      const teilweise = geschrieben + schonDa > 0
      if (istNetz(e) || istServerFehler(e)) throw new SchreibFehler(TEXT_NETZ, 'netz', teilweise, e)
      const grund = pbFehlerText(e, FELDNAMEN)
      throw new SchreibFehler(
        teilweise ? `Nur teilweise gespeichert: ${grund} Bitte erneut versuchen — Angelegtes wird nicht doppelt angelegt.` : grund,
        'abgelehnt', teilweise, e)
    }
  }
  if (ausgelassen) return 'ohne'
  return geschrieben === 0 && schonDa > 0 ? 'schon' : 'ok'
}

// ── PocketBase ───────────────────────────────────────────────────────────────

interface PbLike { collection(name: string): any; createBatch(): any }

const WARTEZEIT_MS = 15_000

function zeitlimit(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal === 'undefined') return undefined
  if ('timeout' in AbortSignal) return (AbortSignal as any).timeout(ms)
  const c = new AbortController()
  setTimeout(() => c.abort(), ms)
  return c.signal
}

/**
 * Optionen für einzelne Anfragen, während die Oberfläche auf sie wartet: lieber nach
 * 15 s mit „keine Antwort“ abbrechen, als im Funkloch ewig zu hängen.
 * requestKey: null — sonst bricht das SDK gleichartige Anfragen gegenseitig ab.
 */
export function pbOptionen(wartezeitMs = WARTEZEIT_MS) {
  return { requestKey: null, signal: zeitlimit(wartezeitMs) }
}

export function pbSchreiber(pb: PbLike, wartezeitMs = WARTEZEIT_MS): Server {
  const opt = () => pbOptionen(wartezeitMs)
  return {
    async sendeBatch(anfragen) {
      const b = pb.createBatch()
      for (const a of anfragen) {
        if (a.aktion === 'create') b.collection(a.collection).create({ id: a.id, ...a.body })
        else if (a.aktion === 'delete') b.collection(a.collection).delete(a.id)
        else b.collection(a.collection).update(a.id, a.body)
      }
      return b.send(opt())
    },
    async sende(a) {
      if (a.aktion === 'create') return pb.collection(a.collection).create({ id: a.id, ...a.body }, opt())
      if (a.aktion === 'delete') return pb.collection(a.collection).delete(a.id, opt())
      return pb.collection(a.collection).update(a.id, a.body, opt())
    },
  }
}
