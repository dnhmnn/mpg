// Fälligkeit der Hygiene-Objekte — reine Rechnung, Prüffälle in selbsttest.ts.
// Gerechnet wird in Kalendertagen nach Ortszeit (wie im MPG, src/lib/mpg/fristen.ts).
// Grundlage ist die letzte VOLLSTÄNDIGE Durchführung (kein Punkt offen), ob nach Plan oder aus
// Anlass: Eine unvollständige Desinfektion setzt die Frist nicht neu (Owner, 23.11.2026).
// Überfällig wird nur angezeigt, nichts gesperrt.

import { kalendertag, plusMonate, plusTage, tageZwischen, tagText, type Tag } from '../mpg/fristen'
import type { HyDurchfuehrung, HyIntervall, HyObjekt } from './typen'

export type HyLage = 'offen' | 'ueberfaellig' | 'heute' | 'bald' | 'ok' | 'benutzung'

export interface HyStand {
  lage: HyLage
  /** Nächste Fälligkeit (null bei „nach Benutzung“ und „noch nie“) */
  faellig: Tag | null
  /** Tage bis zur Fälligkeit (negativ = überfällig) */
  tage: number | null
  /** Letzte vollständige Durchführung */
  letzte: HyDurchfuehrung | null
  /** Neuere Durchführung mit offenen Punkten (Mängel), falls es eine gibt */
  unvollstaendig: HyDurchfuehrung | null
}

/** Ab wie vielen Tagen vorher „bald fällig“ gilt. */
export function vorwarnung(intervall: HyIntervall, tage = 0): number {
  switch (intervall) {
    case 'taeglich': return 0
    case 'woechentlich': return 1
    case 'tage': return tage >= 14 ? 3 : tage >= 7 ? 1 : 0
    case 'monatlich': return 5
    case 'benutzung': return 0
  }
}

/** Gültige Zahl der Tage bei „alle N Tage“ (1 bis 365, sonst 7). */
export function tageVon(wert: unknown): number {
  const n = Math.round(Number(wert))
  return Number.isFinite(n) && n >= 1 && n <= 365 ? n : 7
}

/** Nächste Fälligkeit nach dem Tag der letzten vollständigen Durchführung. */
export function naechsteFaelligkeit(letzte: Tag, intervall: HyIntervall, tage?: number): Tag | null {
  switch (intervall) {
    case 'taeglich': return plusTage(letzte, 1)
    case 'woechentlich': return plusTage(letzte, 7)
    case 'tage': return plusTage(letzte, tageVon(tage))
    case 'monatlich': return plusMonate(letzte, 1)
    case 'benutzung': return null
  }
}

/** Ist die Durchführung vollständig (kein Punkt offen)? */
export function vollstaendig(d: Pick<HyDurchfuehrung, 'offen' | 'punkte'>): boolean {
  const offen = Number(d.offen)
  if (Number.isFinite(offen) && offen > 0) return false
  return !(Array.isArray(d.punkte) && d.punkte.some(p => p && p.erledigt === false))
}

const zeitVon = (d: HyDurchfuehrung) => d.zeitpunkt || d.created || ''

/**
 * Stand eines Objekts am Tag `heute` aus seinen Durchführungen (beliebige Reihenfolge, auch fremde
 * werden ignoriert). Eine Durchführung mit einem Tag nach heute zählt nicht (Uhr falsch gestellt).
 */
export function standVon(o: Pick<HyObjekt, 'id' | 'intervall' | 'intervall_tage'>, alle: HyDurchfuehrung[], heute: Tag): HyStand {
  const eigene = alle
    .filter(d => d.objekt_id === o.id && kalendertag(zeitVon(d)) !== null && (kalendertag(zeitVon(d)) as Tag) <= heute)
    .sort((a, b) => zeitVon(b).localeCompare(zeitVon(a)))
  const letzte = eigene.find(vollstaendig) ?? null
  const neuer = eigene.find(d => !vollstaendig(d))
  const unvollstaendig = neuer && (!letzte || zeitVon(neuer) > zeitVon(letzte)) ? neuer : null
  if (o.intervall === 'benutzung') return { lage: 'benutzung', faellig: null, tage: null, letzte, unvollstaendig }
  if (!letzte) return { lage: 'offen', faellig: null, tage: null, letzte: null, unvollstaendig }
  const faellig = naechsteFaelligkeit(kalendertag(zeitVon(letzte)) as Tag, o.intervall, o.intervall_tage)
  if (!faellig) return { lage: 'benutzung', faellig: null, tage: null, letzte, unvollstaendig }
  const tage = tageZwischen(heute, faellig)
  const lage: HyLage = tage < 0 ? 'ueberfaellig' : tage === 0 ? 'heute' : tage <= vorwarnung(o.intervall, o.intervall_tage) ? 'bald' : 'ok'
  return { lage, faellig, tage, letzte, unvollstaendig }
}

/** Ist jetzt etwas zu tun? (überfällig, heute fällig oder noch nie gemacht) */
export const istFaellig = (l: HyLage) => l === 'ueberfaellig' || l === 'heute' || l === 'offen'

/** Reihenfolge in Listen: Dringendes zuerst. */
export const LAGE_RANG: Record<HyLage, number> = { ueberfaellig: 0, offen: 1, heute: 2, bald: 3, ok: 4, benutzung: 5 }

/** Kurzer Text, z. B. „überfällig seit 2 Tagen“ oder „fällig am 30.11.2026“. */
export function standText(s: Pick<HyStand, 'lage' | 'tage' | 'faellig'>): string {
  const t = s.tage ?? 0
  switch (s.lage) {
    case 'offen': return 'noch nie durchgeführt'
    case 'benutzung': return 'nach jeder Benutzung'
    case 'ueberfaellig': return -t === 1 ? 'überfällig seit gestern' : `überfällig seit ${-t} Tagen`
    case 'heute': return 'heute fällig'
    case 'bald': return t === 1 ? 'morgen fällig' : `fällig in ${t} Tagen`
    case 'ok': return t === 1 ? 'morgen fällig' : `fällig am ${tagText(s.faellig)}`
  }
}

/** „täglich“, „wöchentlich“, „alle 14 Tage“, „monatlich“, „nach jeder Benutzung“ */
export function intervallText(intervall: HyIntervall, tage?: number): string {
  switch (intervall) {
    case 'taeglich': return 'täglich'
    case 'woechentlich': return 'wöchentlich'
    case 'tage': { const n = tageVon(tage); return n === 1 ? 'täglich' : `alle ${n} Tage` }
    case 'monatlich': return 'monatlich'
    case 'benutzung': return 'nach jeder Benutzung'
  }
}

/** Zählung für den Kopf: überfällig, jetzt fällig (heute oder noch nie), in Ordnung (Rest). */
export function zaehle(staende: HyLage[]): { ueberfaellig: number; faellig: number; ok: number } {
  let ueberfaellig = 0, faellig = 0, ok = 0
  for (const l of staende) {
    if (l === 'ueberfaellig') ueberfaellig++
    else if (l === 'heute' || l === 'offen') faellig++
    else ok++
  }
  return { ueberfaellig, faellig, ok }
}
