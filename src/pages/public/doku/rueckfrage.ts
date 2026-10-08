// Rückfrage und Stellungnahme.
//
// Der Weg eines Protokolls endet nicht mit dem Absenden. Ein Beauftragter
// liest es gegen und stößt dabei auf Stellen, die er nicht nachvollziehen
// kann. Bisher öffnete er dafür das Protokoll zur Nachbearbeitung — der
// Teamführer durfte dann noch einmal hineinschreiben. Das ist für ein
// Dokument, das im Einsatz entstanden ist, der falsche Weg: was damals
// dokumentiert wurde, bleibt stehen. Erklärt wird es daneben.
//
// Deshalb gibt es nur noch zwei Schritte:
//
// RÜCKFRAGE. Der Beauftragte schreibt, was ihm unklar ist, und klickt dazu
// auf dem Protokoll die Felder an, um die es geht. Die Felder gehören zur
// Frage — sonst müsste der Teamführer aus "bei den Vitalwerten" erraten,
// welche Zahl gemeint ist.
//
// STELLUNGNAHME. Der Teamführer antwortet im Wortlaut. Das Protokoll bleibt
// wie es war, die Stellungnahme steht dazu. Erst wenn keine Rückfrage mehr
// offen ist, kann der Beauftragte archivieren.

import { aelrdFeld } from '../../../katalog/aelrd'

export type Rueckfrage = {
  id: string
  frage: string
  /** Wer gefragt hat — der Name des Beauftragten. */
  von?: string
  /** Die Felder des Bogens, um die es geht. */
  felder?: string[]
  status: 'offen' | 'beantwortet'
  created: string
  /**
   * Vermerke, die nicht von einem Menschen kommen.
   *
   * Vor dem Umbau legte die Nachbearbeitung solche Einträge an. Sie bleiben
   * lesbar, verlangen aber keine Stellungnahme und halten das Archivieren
   * nicht auf.
   */
  created_by?: string
}

export type Stellungnahme = {
  id: string
  rueckfrage_id: string
  text: string
  /** Wer Stellung genommen hat. */
  von?: string
  created: string
}

type Nutzlast = Record<string, unknown>

function liste<T>(w: unknown): T[] {
  return Array.isArray(w) ? (w as T[]) : []
}

export function rueckfragen(p: Nutzlast | null | undefined): Rueckfrage[] {
  return liste<Rueckfrage>(p?.rueckfragen)
}

export function stellungnahmen(p: Nutzlast | null | undefined): Stellungnahme[] {
  return liste<Stellungnahme>(p?.stellungnahmen)
}

/** Ein Vermerk des Systems ist keine Frage an den Teamführer. */
export function istVermerk(rq: Rueckfrage): boolean {
  return rq.created_by === 'System'
}

export function stellungnahmeZu(p: Nutzlast | null | undefined, rqId: string): Stellungnahme | null {
  return stellungnahmen(p).find((s) => s.rueckfrage_id === rqId) ?? null
}

/**
 * Die Rückfragen, die noch auf eine Stellungnahme warten.
 *
 * Geprüft wird beides — der Stand und ob eine Stellungnahme dazu vorliegt.
 * Ältere Protokolle führen den Stand nicht immer mit.
 */
export function offeneRueckfragen(p: Nutzlast | null | undefined): Rueckfrage[] {
  return rueckfragen(p).filter(
    (rq) => !istVermerk(rq) && rq.status !== 'beantwortet' && !stellungnahmeZu(p, rq.id),
  )
}

/** Die Felder, zu denen gerade eine Rückfrage offen ist — ohne Doppelte. */
export function markierteFelder(p: Nutzlast | null | undefined): string[] {
  const aus: string[] = []
  for (const rq of offeneRueckfragen(p)) {
    for (const f of rq.felder ?? []) if (!aus.includes(f)) aus.push(f)
  }
  return aus
}

/** Wie das Feld auf dem Bogen heißt — für die Frage im Wortlaut. */
export function feldname(id: string): string {
  return aelrdFeld(id)?.label ?? id
}

/**
 * Eine Rückfrage anlegen.
 *
 * Die Kennung und die Zeit kommen von außen: so ist die Funktion prüfbar und
 * schreibt nicht heimlich die Uhr des Geräts ins Protokoll.
 */
export function rueckfrageStellen(
  p: Nutzlast | null | undefined,
  { frage, felder = [], von, id, jetzt }: { frage: string; felder?: string[]; von?: string; id: string; jetzt: Date },
): Nutzlast {
  const rq: Rueckfrage = {
    id,
    frage: frage.trim(),
    felder: [...felder],
    status: 'offen',
    created: jetzt.toISOString(),
    ...(von ? { von, created_by: von } : {}),
  }
  return { ...(p ?? {}), rueckfragen: [...rueckfragen(p), rq] }
}

/**
 * Stellung nehmen.
 *
 * Die Antwort tritt neben die Frage; die Frage selbst gilt damit als
 * beantwortet. Am Protokoll ändert sich nichts.
 */
export function stellungNehmen(
  p: Nutzlast | null | undefined,
  { rueckfrageId, text, von, id, jetzt }: { rueckfrageId: string; text: string; von?: string; id: string; jetzt: Date },
): Nutzlast {
  const sn: Stellungnahme = {
    id,
    rueckfrage_id: rueckfrageId,
    text: text.trim(),
    created: jetzt.toISOString(),
    ...(von ? { von } : {}),
  }
  return {
    ...(p ?? {}),
    rueckfragen: rueckfragen(p).map((rq) =>
      rq.id === rueckfrageId ? { ...rq, status: 'beantwortet' as const } : rq,
    ),
    stellungnahmen: [...stellungnahmen(p), sn],
  }
}

/**
 * Was dem Archivieren noch entgegensteht — leer, wenn nichts.
 *
 * Archiviert wird erst, wenn jede Rückfrage ihre Stellungnahme hat. Sonst
 * verschwände die Frage mit dem Protokoll im Archiv, unbeantwortet.
 */
export function archivHindernis(p: Nutzlast | null | undefined): string {
  const offen = offeneRueckfragen(p)
  if (offen.length === 0) return ''
  return offen.length === 1
    ? 'Eine Rückfrage wartet noch auf die Stellungnahme des Teamführers.'
    : `${offen.length} Rückfragen warten noch auf die Stellungnahme des Teamführers.`
}
