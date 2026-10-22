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
  aktion: 'create' | 'update'
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

const FELDNAMEN: Record<string, string> = {
  description: 'Beschreibung', severity: 'Schweregrad', device_id: 'Gerät', notes: 'Bemerkung',
  inspection_date: 'Prüfdatum', status: 'Status', name: 'Bezeichnung',
}

let batchAus = false
/** Für die Prüffälle. */
export function _zuruecksetzen() { batchAus = false }

const TEXT_NETZ = 'Keine Antwort vom Server — ob gespeichert wurde, ist unklar. Bitte erneut auf Speichern tippen; doppelt wird nichts angelegt.'

/**
 * Schreibt alle Anfragen gemeinsam. Bei einem Fehler mit DENSELBEN Anfragen
 * (gleiche IDs) erneut aufrufen. Gibt 'schon' zurück, wenn ein früherer Versuch
 * bereits angekommen war.
 */
export async function schreibeZusammen(server: Server, anfragen: Anfrage[]): Promise<'ok' | 'schon'> {
  if (!anfragen.length) return 'ok'
  if (!batchAus) {
    try {
      await server.sendeBatch(anfragen)
      return 'ok'
    } catch (e) {
      if (istNetz(e)) throw new SchreibFehler(TEXT_NETZ, 'netz', false, e)
      // Ein Batch ist atomar: Gibt es eine der neuen IDs schon, ist ein früherer Versuch durchgegangen
      if (istDoppelt(e)) return 'schon'
      if (!istBatchAus(e)) throw new SchreibFehler(pbFehlerText(innererFehler(e), FELDNAMEN), 'abgelehnt', false, e)
      batchAus = true
    }
  }
  let geschrieben = 0
  let schonDa = 0
  for (const a of anfragen) {
    try {
      await server.sende(a)
      geschrieben++
    } catch (e) {
      if (a.aktion === 'create' && istDoppelt(e)) { schonDa++; continue }
      const teilweise = geschrieben + schonDa > 0
      if (istNetz(e)) throw new SchreibFehler(TEXT_NETZ, 'netz', teilweise, e)
      const grund = pbFehlerText(e, FELDNAMEN)
      throw new SchreibFehler(
        teilweise ? `Nur teilweise gespeichert: ${grund} Bitte erneut versuchen — Angelegtes wird nicht doppelt angelegt.` : grund,
        'abgelehnt', teilweise, e)
    }
  }
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
        else b.collection(a.collection).update(a.id, a.body)
      }
      return b.send(opt())
    },
    async sende(a) {
      return a.aktion === 'create'
        ? pb.collection(a.collection).create({ id: a.id, ...a.body }, opt())
        : pb.collection(a.collection).update(a.id, a.body, opt())
    },
  }
}
