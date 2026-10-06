// Das Protokoll absenden.
//
// Bis hierher war die Maske eine Vorschau: alles stand im Gerät, nichts kam
// an. Jetzt entsteht daraus ein Datensatz in `patients` — derselbe, den das
// alte Formular anlegt, mit demselben Status und derselben Form der
// Besatzung. Unitas liest ihn ohne Änderung, der Ausdruck ebenso.
//
// OHNE NETZ wandert er in dieselbe Warteschlange, die das alte Formular
// führt (`offline_queue_<orgCode>`), und wird beim nächsten Öffnen mit Netz
// abgeschickt — von welcher der beiden Masken, ist gleichgültig.

import type { Werte } from './DokuFeld'
import { offenePflicht, offeneErwartung, type Stand } from '../../../katalog/pflicht'

export type Datensatz = {
  title: string
  payload: Werte
  status: 'offen'
  organization_id: string
}

export type Warteeintrag = Datensatz & { type: 'full' }

export function warteschlangeSchluessel(orgCode: string): string {
  return `offline_queue_${orgCode}`
}

/**
 * Die Überschrift des Datensatzes.
 *
 * Das alte Formular schreibt "Patientendoku: Vorname Name". Ohne Namen — und
 * den gibt es oft nicht — tritt die Einsatznummer an seine Stelle, damit die
 * Liste in Unitas nicht aus lauter gleichen Zeilen besteht.
 */
export function titel(werte: Werte): string {
  const name = [werte.vorname, werte.name].map((w) => String(w ?? '').trim()).filter(Boolean).join(' ')
  if (name) return `Patientendoku: ${name}`
  const nr = String(werte.einsatz_nr ?? '').trim()
  return nr ? `Patientendoku: Einsatz ${nr}` : 'Patientendoku: ohne Namen'
}

export function datensatz(werte: Werte, organisationId: string): Datensatz {
  return { title: titel(werte), payload: werte, status: 'offen', organization_id: organisationId }
}

/** Was dem Absenden im Weg steht, und was nur fehlt. */
export function pruefen(werte: Werte): { haelt: Stand[]; fehlt: Stand[] } {
  return { haelt: offenePflicht(werte), fehlt: offeneErwartung(werte) }
}

export type Speicher = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** In die Warteschlange legen. Gibt zurück, ob das Gerät sie behalten hat. */
export function inWarteschlange(speicher: Speicher, orgCode: string, eintrag: Datensatz): boolean {
  try {
    /*
     * Gelesen wird über warteschlange(), und die überliest Kaputtes.
     *
     * Stünde hier ein eigenes JSON.parse, risse eine beschädigte Zeile die
     * ganze Ablage mit: das Protokoll, das gerade abgesendet wird, wäre weg.
     * Lieber die unlesbare Zeile verlieren als das Protokoll.
     */
    const vorhanden = warteschlange(speicher, orgCode)
    speicher.setItem(
      warteschlangeSchluessel(orgCode),
      JSON.stringify([...vorhanden, { type: 'full', ...eintrag }]),
    )
    return true
  } catch {
    return false
  }
}

/** Was in der Warteschlange liegt — kaputte Einträge bleiben draußen. */
export function warteschlange(speicher: Speicher, orgCode: string): Warteeintrag[] {
  try {
    const roh = speicher.getItem(warteschlangeSchluessel(orgCode))
    if (!roh) return []
    const liste: unknown = JSON.parse(roh)
    if (!Array.isArray(liste)) return []
    return liste.filter((e): e is Warteeintrag =>
      Boolean(e) && typeof e === 'object'
      && typeof (e as Warteeintrag).title === 'string'
      && typeof (e as Warteeintrag).organization_id === 'string',
    )
  } catch {
    return []
  }
}

export function warteschlangeLeeren(speicher: Speicher, orgCode: string): void {
  try {
    speicher.removeItem(warteschlangeSchluessel(orgCode))
  } catch {
    // Nichts zu löschen heißt: nichts gespeichert.
  }
}

/** Die Nummer, die nach dem Absenden auf dem Schirm steht. */
export function protokollnummer(id: string, jahr = new Date().getFullYear()): string {
  return `PAT-${jahr}-${id.slice(0, 8)}`
}
