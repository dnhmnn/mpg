// Was eine Aktion im MPG schreibt — reine Planung, ohne Server.
// Ausgeführt wird mit schreibeZusammen (alles oder nichts, genau einmal).
//
// Reihenfolge — wichtig, wenn der Batch in PocketBase aus ist und einzeln geschrieben wird
// und die Verbindung mittendrin abreißt. Jeder Teilstand muss auf der sicheren Seite liegen:
// - Was ein Gerät sperrt, kommt zuerst.
// - Der Datensatz, an dem man „angekommen“ erkennt (der Anker), danach: „Anker vorhanden“
//   heißt, alles davor ist auch angekommen.
// - Was ein Gerät „gut aussehen“ lässt (geprüft, bestanden, nächste Frist), kommt zuletzt.
// Vor dem erneuten Senden eines unklaren Versuchs wird nach dem Anker gefragt; ist er da,
// wird nur noch der Rest danach gesendet (restNachAnker).

//
// Prüffälle: src/lib/mpg/selbsttest.ts

import { faelligFeld, tagVonDatum, type FristFelder } from './fristen'
import { defektText, MANGEL_VERMERK, type PruefErgebnis, type Pruefpunkt } from './pruefung'
import type { Anfrage } from './schreiben'
import type { Schwere } from './zustand'

export interface Wer { organization_id: string; name: string }

export interface GeraetKurz extends FristFelder { id: string; name: string; type: string }

/** Liegt der Zeitpunkt `a` (PocketBase- oder ISO-Format) nach `b`? */
function spaeter(a: string | null | undefined, b: Date): boolean {
  if (!a) return false
  const t = new Date(String(a).replace(' ', 'T')).getTime()
  return Number.isFinite(t) && t > b.getTime()
}

/**
 * Prüfprotokoll + Gerätestand; bei Mangel oder „nicht bestanden“ dazu ein Defekt (und die Sperre).
 * @param serverLetzte last_inspection laut Server. Ist sie neuer als dieser Versuch (ein älterer
 *   Entwurf wird später erneut gesendet), bleibt der Gerätestand der neueren Prüfung stehen —
 *   Protokoll und Defekt werden trotzdem angelegt, eine Sperre trotzdem gesetzt.
 */
export function planePruefung(o: {
  geraet: GeraetKurz
  punkte: Pruefpunkt[]
  bemerkung: string
  ergebnis: PruefErgebnis
  wer: Wer
  jetzt: Date
  ids: { pruefung: string; defekt: string }
  serverLetzte?: string | null
}): Anfrage[] {
  const { geraet, ergebnis, wer } = o
  const zeit = o.jetzt.toISOString()
  const bestanden = ergebnis !== 'nicht_bestanden'
  const bemerkung = o.bemerkung.trim()
  const ueberholt = spaeter(o.serverLetzte, o.jetzt)
  const anfragen: Anfrage[] = []
  // 1. Sperre zuerst
  if (ergebnis === 'nicht_bestanden') anfragen.push({ collection: 'mpg_devices', aktion: 'update', id: geraet.id, body: { operational: false } })
  // 2. Defekt
  if (ergebnis !== 'bestanden') {
    anfragen.push({
      collection: 'mpg_defects', aktion: 'create', id: o.ids.defekt,
      body: {
        device_id: geraet.id, device_name: geraet.name, reported_by: wer.name,
        description: defektText(ergebnis, o.punkte, bemerkung),
        severity: ergebnis === 'mangel' ? 'low' : 'high', status: 'open',
        organization_id: wer.organization_id,
      },
    })
  }
  // 3. Anker: das Prüfprotokoll
  anfragen.push({
    collection: 'mpg_inspections', aktion: 'create', id: o.ids.pruefung,
    body: {
      device_id: geraet.id, device_name: geraet.name, device_type: geraet.type,
      user_name: wer.name, inspection_date: zeit, passed: bestanden,
      notes: ergebnis === 'mangel' ? MANGEL_VERMERK + bemerkung : bemerkung,
      checklist_results: o.punkte, organization_id: wer.organization_id,
    },
  })
  // 4. Zuletzt der Prüfstand am Gerät — außer eine neuere Prüfung steht schon dort
  if (!ueberholt) {
    anfragen.push({
      collection: 'mpg_devices', aktion: 'update', id: geraet.id,
      body: {
        last_inspection: zeit, last_inspection_passed: bestanden,
        next_inspection_due: faelligFeld({ ...geraet, last_inspection: zeit }, tagVonDatum(o.jetzt)),
      },
    })
  }
  return anfragen
}

/** Defekt anlegen, auf Wunsch zugleich das Gerät sperren. */
export function planeDefekt(o: {
  geraet: { id: string; name: string }
  beschreibung: string
  schwere: Schwere
  sperren: boolean
  wer: Wer
  id: string
}): Anfrage[] {
  const anfragen: Anfrage[] = []
  if (o.sperren) anfragen.push({ collection: 'mpg_devices', aktion: 'update', id: o.geraet.id, body: { operational: false } })
  // Anker: der Defekt
  anfragen.push({
    collection: 'mpg_defects', aktion: 'create', id: o.id,
    body: {
      device_id: o.geraet.id, device_name: o.geraet.name, reported_by: o.wer.name,
      description: o.beschreibung.trim(), severity: o.schwere, status: 'open',
      organization_id: o.wer.organization_id,
    },
  })
  return anfragen
}

/** Defekt als behoben schließen; nur auf ausdrücklichen Wunsch das Gerät wieder freigeben. */
export function planeBeheben(o: {
  defekt: { id: string; device_id: string }
  notiz: string
  wer: Wer
  wiederEinsatzbereit: boolean
}): Anfrage[] {
  const anfragen: Anfrage[] = [{
    collection: 'mpg_defects', aktion: 'update', id: o.defekt.id,
    body: { status: 'resolved', resolved_by: o.wer.name, resolved_notes: o.notiz.trim() },
  }]
  if (o.wiederEinsatzbereit) anfragen.push({ collection: 'mpg_devices', aktion: 'update', id: o.defekt.device_id, body: { operational: true } })
  return anfragen
}

/**
 * Meldung von außen bestätigen: Defekt anlegen, auf Wunsch sperren, Meldung schließen.
 * Anker ist hier der Status der Meldung (zuletzt) — vor jedem Senden wird er gelesen.
 * Der Defekt (mit der ID der Meldung) steht vor der Sperre: Eine Sperre ohne Defekt kann so
 * nicht entstehen, und Ablehnen erkennt eine teilweise gespeicherte Bestätigung am Defekt.
 */
export function planeBestaetigung(o: {
  meldung: { id: string; device_id: string; device_name: string; reporter_name?: string; description: string; severity: Schwere }
  anmerkung: string
  sperren: boolean
  /** Gibt es das Gerät noch? Sonst wird nur der Defekt angelegt. */
  geraetDa: boolean
  wer: Wer
  defektId: string
}): Anfrage[] {
  const { meldung: m } = o
  const anmerkung = o.anmerkung.trim()
  const anfragen: Anfrage[] = []
  anfragen.push({
    collection: 'mpg_defects', aktion: 'create', id: o.defektId,
    body: {
      device_id: m.device_id, device_name: m.device_name,
      reported_by: m.reporter_name || 'Externe Meldung',
      description: anmerkung ? `${m.description}\n\nAnmerkung bei Bestätigung (${o.wer.name}): ${anmerkung}` : m.description,
      severity: m.severity, status: 'open', organization_id: o.wer.organization_id,
    },
  })
  if (o.sperren && o.geraetDa) anfragen.push({ collection: 'mpg_devices', aktion: 'update', id: m.device_id, body: { operational: false } })
  anfragen.push({ collection: 'mpg_defect_reports', aktion: 'update', id: m.id, body: { status: 'confirmed' } })
  return anfragen
}

/** Der Anker eines Plans: der zuletzt angelegte Datensatz. */
export function anker(anfragen: Anfrage[]): { collection: string; id: string } | null {
  const a = [...anfragen].reverse().find(x => x.aktion === 'create')
  return a ? { collection: a.collection, id: a.id } : null
}

/** Was nach dem Anker kommt — ist der Anker schon angekommen, fehlt höchstens das noch. */
export function restNachAnker(anfragen: Anfrage[]): Anfrage[] {
  const a = anker(anfragen)
  if (!a) return anfragen
  const i = anfragen.findIndex(x => x.aktion === 'create' && x.collection === a.collection && x.id === a.id)
  return anfragen.slice(i + 1)
}
