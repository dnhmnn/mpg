// Was eine Aktion der Hygiene schreibt — reine Planung, ohne Server. Ausgeführt wird mit
// schreibeZusammen (src/lib/mpg/schreiben.ts: alles oder nichts, genau einmal über die Kennung).
// Eine Durchführung ist ein unveränderlicher Nachweis und selbst der Anker: Ist sie angekommen, ist
// alles angekommen. Objekte werden nie gelöscht, nur archiviert (Nachweise verweisen auf sie).
// Prüffälle: selbsttest.ts.

import type { Anfrage } from '../mpg/schreiben'
import { punkteBereinigen } from './checklisten'
import { tageVon } from './fristen'
import {
  ANLAESSE, ARTEN, INTERVALLE, MAX_BEMERKUNG, MAX_NAME, MAX_PUNKTE,
  type HyAnlass, type HyArt, type HyDfArt, type HyIntervall, type HyObjekt, type HyPunktErgebnis, type HyQuelle, type HyVorlage,
} from './typen'

export interface Wer { organization_id: string; name: string }

/** Die Felder eines Objekts, die man einrichtet */
export type ObjektDaten = Pick<HyObjekt, 'name' | 'art' | 'standort' | 'intervall' | 'intervall_tage' | 'punkte' | 'quelle' | 'quelle_id' | 'quelle_name'> & { vorlage_id?: string }

/** Gültige Kennung einer Vorlage: '' (eigene Liste), 'std:…' (Responda) oder eine Kennung aus hygiene_vorlagen. */
export function vorlageIdGueltig(id: unknown): boolean {
  const s = String(id ?? '')
  return s === '' || /^std:[a-z_]{1,40}$/.test(s) || /^[a-z0-9]{15}$/.test(s)
}

const QUELLEN: HyQuelle[] = ['', 'mpg_geraet', 'lager_ort', 'lager_satz', 'lager_artikel']

/** Eingaben säubern; liefert die Felder, wie sie gespeichert werden, oder einen Fehlertext. */
export function objektPruefen(d: Partial<ObjektDaten>): { ok: true; daten: ObjektDaten } | { ok: false; fehler: string } {
  const name = String(d.name ?? '').replace(/\s+/g, ' ').trim()
  if (!name) return { ok: false, fehler: 'Bitte eine Bezeichnung eingeben.' }
  if (name.length > MAX_NAME) return { ok: false, fehler: `Die Bezeichnung ist zu lang (höchstens ${MAX_NAME} Zeichen).` }
  const art = (ARTEN as string[]).includes(String(d.art)) ? d.art as HyArt : null
  if (!art) return { ok: false, fehler: 'Bitte die Art wählen.' }
  const intervall = (INTERVALLE as string[]).includes(String(d.intervall)) ? d.intervall as HyIntervall : null
  if (!intervall) return { ok: false, fehler: 'Bitte das Intervall wählen.' }
  if (intervall === 'tage') {
    const n = Number(d.intervall_tage)
    if (!Number.isInteger(n) || n < 1 || n > 365) return { ok: false, fehler: 'Bitte bei „Alle … Tage“ eine ganze Zahl von 1 bis 365 eingeben.' }
  }
  const roh = Array.isArray(d.punkte) ? d.punkte.filter(p => String(p ?? '').trim()) : []
  if (roh.length > MAX_PUNKTE) return { ok: false, fehler: `Höchstens ${MAX_PUNKTE} Punkte in der Checkliste (jetzt ${roh.length}).` }
  const punkte = punkteBereinigen(d.punkte)
  if (!punkte.length) return { ok: false, fehler: 'Die Checkliste braucht mindestens einen Punkt.' }
  const quelle = QUELLEN.includes(d.quelle as HyQuelle) ? d.quelle as HyQuelle : ''
  return {
    ok: true,
    daten: {
      name, art, intervall, punkte, vorlage_id: vorlageIdGueltig(d.vorlage_id) ? String(d.vorlage_id ?? '') : '',
      standort: String(d.standort ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME),
      intervall_tage: intervall === 'tage' ? tageVon(d.intervall_tage) : 0,
      quelle, quelle_id: quelle ? String(d.quelle_id ?? '') : '', quelle_name: quelle ? String(d.quelle_name ?? '').slice(0, MAX_NAME) : '',
    },
  }
}

/** Ein oder mehrere Objekte anlegen (aus Vorschlägen: höchstens 50 je Sammelbuchung). */
export function planeObjekte(o: { neu: { id: string; daten: ObjektDaten }[]; wer: Wer }): Anfrage[] {
  return o.neu.map(n => ({
    collection: 'hygiene_objekte', aktion: 'create' as const, id: n.id,
    body: { ...n.daten, organization_id: o.wer.organization_id, archiviert: '' },
  }))
}

export function planeObjektAenderung(o: { id: string; daten: ObjektDaten }): Anfrage[] {
  // Herkunft bleibt, wie sie ist: Wer ein Objekt ändert, hängt es nicht an eine andere Quelle
  const { quelle: _q, quelle_id: _i, quelle_name: _n, ...rest } = o.daten
  return [{ collection: 'hygiene_objekte', aktion: 'update', id: o.id, body: rest }]
}

// ── Checklisten-Vorlagen der Organisation (hygiene_vorlagen) ─────────────────────

export type VorlageDaten = Pick<HyVorlage, 'name' | 'art' | 'intervall' | 'intervall_tage' | 'punkte'>

/** Vorlage prüfen wie ein Objekt (Name, Art, Intervall, Punkte). */
export function vorlagePruefen(d: Partial<VorlageDaten>): { ok: true; daten: VorlageDaten } | { ok: false; fehler: string } {
  const p = objektPruefen({ ...d, standort: '', quelle: '', quelle_id: '', quelle_name: '', vorlage_id: '' })
  if ('fehler' in p) return p
  const { name, art, intervall, intervall_tage, punkte } = p.daten
  return { ok: true, daten: { name, art, intervall, intervall_tage, punkte } }
}

export function planeVorlage(o: { id: string; neu: boolean; daten: VorlageDaten; wer: Wer }): Anfrage[] {
  return [o.neu
    ? { collection: 'hygiene_vorlagen', aktion: 'create', id: o.id, body: { ...o.daten, organization_id: o.wer.organization_id, archiviert: '' } }
    : { collection: 'hygiene_vorlagen', aktion: 'update', id: o.id, body: { ...o.daten } }]
}

export function planeVorlageArchiv(o: { id: string; seit: string }): Anfrage[] {
  return [{ collection: 'hygiene_vorlagen', aktion: 'update', id: o.id, body: { archiviert: o.seit } }]
}

/** Neue Checkliste einer Vorlage auf Objekte übertragen (die Kennungen aus uebertragen().gleich). */
export function planeUebertragen(o: { objekte: string[]; punkte: string[] }): Anfrage[] {
  return o.objekte.map(id => ({ collection: 'hygiene_objekte', aktion: 'update' as const, id, body: { punkte: o.punkte } }))
}

/** Archivieren (seit = Zeitpunkt) oder wieder in Gebrauch nehmen (seit = ''). */
export function planeArchiv(o: { id: string; seit: string }): Anfrage[] {
  return [{ collection: 'hygiene_objekte', aktion: 'update', id: o.id, body: { archiviert: o.seit } }]
}

/** Einsatznummer: getrimmt, höchstens 40 Zeichen. */
export function einsatzNummerBereinigen(roh: unknown): string {
  return String(roh ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
}

/**
 * Eine Durchführung (nach Plan oder aus Anlass). Name und Person setzt der Server; offen zählt er
 * selbst nach. Die Punkte stehen mit ihrem Text drin, damit der Nachweis auch nach einer Änderung
 * der Checkliste lesbar bleibt.
 */
export function planeDurchfuehrung(o: {
  id: string
  objekt: Pick<HyObjekt, 'id' | 'name'>
  art: HyDfArt
  anlass: HyAnlass
  einsatzNummer: string
  punkte: HyPunktErgebnis[]
  bemerkung: string
  zeitpunkt: string
  wer: Wer
}): Anfrage[] {
  const anlass = o.art === 'anlass' && (ANLAESSE as string[]).includes(o.anlass) ? o.anlass : ''
  const punkte = o.punkte.map(p => ({ text: String(p.text).trim(), erledigt: p.erledigt === true })).filter(p => p.text)
  return [{
    collection: 'hygiene_durchfuehrungen', aktion: 'create', id: o.id,
    body: {
      organization_id: o.wer.organization_id, objekt_id: o.objekt.id, objekt_name: o.objekt.name,
      art: o.art, anlass, einsatz_nummer: o.art === 'anlass' ? einsatzNummerBereinigen(o.einsatzNummer) : '',
      punkte, offen: punkte.filter(p => !p.erledigt).length,
      bemerkung: o.bemerkung.trim().slice(0, MAX_BEMERKUNG), zeitpunkt: o.zeitpunkt,
      user_name: o.wer.name,
    },
  }]
}
