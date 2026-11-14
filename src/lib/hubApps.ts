// Welche Apps im Hub stehen und in welcher Reihenfolge: je Benutzer, am Konto.
//
// Gespeichert wird im JSON-Feld users.hub_apps (docs/hub-und-hinweise-einfuehrung.md)
// die AUSGEBLENDETEN Apps und die gewünschte Reihenfolge, nicht die sichtbaren:
// Bekommt jemand ein neues Recht, erscheint die App von selbst (hinten).
//
// Was gilt:
// - Im Hub steht nur, was der Benutzer nutzen darf (Recht und Modul frei), in der
//   Reihenfolge aus der Wahl, der Rest dahinter in der Reihenfolge von ALL_APPS.
// - Befristet freigegebene Apps und die Einstellungen stehen immer da (fest):
//   ausblenden lassen sie sich nicht, verschieben schon.
// - Unbekannte IDs (neuere App-Fassung, entzogenes Recht) bleiben gespeichert, werden
//   aber nicht gezeigt. Je Liste höchstens 50 Einträge, je ID höchstens 40 Zeichen.
//
// Rückhalt, solange das Konto das Feld nicht hat: localStorage hub_wahl_<id> (neue Form).
// Dort steht auch jede Änderung, die noch nicht im Konto ist (ohne Netz, Speichern läuft noch),
// gekennzeichnet mit hub_wahl_offen_<id>. Eine gekennzeichnete Wahl gilt vor dem Konto und wird
// beim nächsten Öffnen (oder wenn das Netz wiederkommt) ins Konto geschrieben; so geht eine
// ohne Netz gemachte Änderung nicht still verloren. Die letzte Änderung gewinnt, auch über eine
// Änderung, die inzwischen auf einem anderen Gerät gespeichert wurde.
// Der alte Hub hielt in hub_apps_<id> die sichtbare Liste; er hängte aber bei jedem Laden
// alle erlaubten, nicht gelisteten Apps wieder an, „Entfernen“ hielt also nie. Übernommen
// wird deshalb nur die Reihenfolge.

import { ALL_APPS, hatRecht, zeitpunktBefristung } from './apps'
import { appFrei } from './freigabe'
import type { User } from '../types'

export interface HubAppsWahl { ausgeblendet: string[]; reihenfolge: string[] }

export const HUB_APPS_MAX = 50
const ID_MAX = 40

export const hubWahlSchluessel = (id: string) => `hub_wahl_${id}`
export const hubAppsAltSchluessel = (id: string) => `hub_apps_${id}`
/** Kennzeichen: Die Wahl in hub_wahl_<id> ist noch nicht im Konto. */
export const hubWahlOffenSchluessel = (id: string) => `hub_wahl_offen_${id}`

/** Die App, die immer im Hub bleibt (sofern erlaubt) */
const IMMER = 'settings'

export const wahlStandard = (): HubAppsWahl => ({ ausgeblendet: [], reihenfolge: [] })

function idListe(roh: unknown): string[] {
  if (!Array.isArray(roh)) return []
  const aus: string[] = []
  for (const x of roh) {
    if (typeof x !== 'string' || !x || x.length > ID_MAX || aus.includes(x)) continue
    aus.push(x)
    if (aus.length >= HUB_APPS_MAX) break
  }
  return aus
}

function jsonLesen(roh: unknown): unknown {
  if (typeof roh !== 'string') return roh
  if (!roh.trim()) return null
  try { return JSON.parse(roh) } catch { return null }
}

/** Gespeicherte Wahl lesen (Objekt oder JSON-Text). null = nichts gespeichert. */
export function wahlLesen(roh: unknown): HubAppsWahl | null {
  const w = jsonLesen(roh)
  if (!w || typeof w !== 'object' || Array.isArray(w)) return null
  const o = w as Record<string, unknown>
  return { ausgeblendet: idListe(o.ausgeblendet), reihenfolge: idListe(o.reihenfolge) }
}

/** Die sichtbare Liste des alten Hubs: nur ihre Reihenfolge zählt. */
export function ausAlterListe(roh: unknown): HubAppsWahl | null {
  const w = jsonLesen(roh)
  if (!Array.isArray(w)) return null
  const reihenfolge = idListe(w)
  return reihenfolge.length ? { ausgeblendet: [], reihenfolge } : null
}

/**
 * Woher die Wahl kommt. Steht auf dem Gerät eine Änderung, die noch nicht im Konto ist
 * (offen), gilt sie und wird ins Konto geschrieben. Sonst gilt das Konto, wenn es das Feld und
 * einen Wert hat. Ist das Feld da, aber leer, wird eine Wahl vom Gerät (neue Form, sonst alte
 * Liste) ins Konto übernommen (insKonto). Fehlt das Feld, gilt das Gerät allein.
 */
export function wahlQuelle(q: { feldDa: boolean; server: unknown; lokal: unknown; alt: unknown; offen?: boolean }):
  { wahl: HubAppsWahl | null; quelle: 'konto' | 'geraet' | 'alt' | 'standard'; insKonto: boolean } {
  if (q.feldDa) {
    const nichtGespeichert = q.offen ? wahlLesen(q.lokal) : null
    if (nichtGespeichert) return { wahl: nichtGespeichert, quelle: 'geraet', insKonto: true }
    const konto = wahlLesen(q.server)
    if (konto) return { wahl: konto, quelle: 'konto', insKonto: false }
  }
  const lokal = wahlLesen(q.lokal)
  if (lokal) return { wahl: lokal, quelle: 'geraet', insKonto: q.feldDa }
  const alt = ausAlterListe(q.alt)
  if (alt) return { wahl: alt, quelle: 'alt', insKonto: q.feldDa }
  return { wahl: null, quelle: 'standard', insKonto: false }
}

type Nutzer = User | null | undefined

/** Recht ohne Befristung: Supervisor, gespeichertes Recht, Benutzerverwaltung der Leitung (wie hatRecht) */
function dauerhaft(user: Nutzer, recht: string): boolean {
  if (!user) return false
  if (user.supervisor || user.permissions?.[recht]) return true
  return recht === 'unitarii' && user.role === 'admin'
}

/** Alle Apps, die der Benutzer nutzen darf (Recht, auch befristet, und Modul frei), in ALL_APPS-Reihenfolge */
export function erlaubteApps(user: Nutzer, jetzt = Date.now()): string[] {
  if (!user) return []
  return Object.keys(ALL_APPS).filter((id) => hatRecht(user, ALL_APPS[id].permission, jetzt) && appFrei(user.organization, id))
}

/** Apps, die nur über ein laufendes befristetes Recht erlaubt sind */
export function befristeteApps(user: Nutzer, jetzt = Date.now()): string[] {
  if (!user || user.supervisor) return []
  const temp = user.temp_permissions ?? {}
  return Object.keys(ALL_APPS).filter((id) => {
    const recht = ALL_APPS[id].permission
    const bis = temp[recht]?.until
    return !!bis && typeof bis === 'string' && zeitpunktBefristung(bis) > jetzt && !dauerhaft(user, recht) && appFrei(user.organization, id)
  })
}

/** Bis wann eine befristete App läuft (ms), sonst 0 */
export function befristetBis(user: Nutzer, id: string): number {
  const bis = ALL_APPS[id] ? user?.temp_permissions?.[ALL_APPS[id].permission]?.until : undefined
  return typeof bis === 'string' ? zeitpunktBefristung(bis) : 0
}

/** Alle erlaubten Apps in der gewünschten Reihenfolge (auch ausgeblendete) */
export function reihenfolgeAlle(wahl: HubAppsWahl | null, erlaubt: string[]): string[] {
  const vorn = (wahl?.reihenfolge ?? []).filter((id) => erlaubt.includes(id))
  return [...vorn, ...erlaubt.filter((id) => !vorn.includes(id))]
}

/** Bleibt immer im Hub: die Einstellungen und befristet freigegebene Apps */
export function istFest(id: string, befristet: string[]): boolean {
  return id === IMMER || befristet.includes(id)
}

/** Die Kacheln im Hub, in Reihenfolge */
export function hubKacheln(wahl: HubAppsWahl | null, erlaubt: string[], befristet: string[]): string[] {
  const aus = wahl?.ausgeblendet ?? []
  return reihenfolgeAlle(wahl, erlaubt).filter((id) => !aus.includes(id) || istFest(id, befristet))
}

/** App zeigen (an) oder ausblenden. Feste Apps bleiben, wie sie sind. */
export function umschalten(wahl: HubAppsWahl | null, id: string, an: boolean, befristet: string[]): HubAppsWahl {
  const w = wahl ?? wahlStandard()
  if (istFest(id, befristet)) return { ausgeblendet: [...w.ausgeblendet], reihenfolge: [...w.reihenfolge] }
  const rest = w.ausgeblendet.filter((x) => x !== id)
  return { ausgeblendet: an ? rest : [...rest, id].slice(-HUB_APPS_MAX), reihenfolge: [...w.reihenfolge] }
}

/**
 * Eine App eine Stelle nach oben (-1) oder unten (1), über die ganze Liste der erlaubten
 * (auch über ausgeblendete hinweg). Am Rand bleibt alles, wie es ist. Unbekannte und nicht
 * mehr erlaubte Einträge der alten Reihenfolge bleiben hinten erhalten.
 */
export function verschieben(wahl: HubAppsWahl | null, erlaubt: string[], id: string, richtung: -1 | 1): HubAppsWahl {
  const w = wahl ?? wahlStandard()
  const alle = reihenfolgeAlle(w, erlaubt)
  const i = alle.indexOf(id)
  const j = i + richtung
  if (i < 0 || j < 0 || j >= alle.length) return { ausgeblendet: [...w.ausgeblendet], reihenfolge: [...w.reihenfolge] }
  ;[alle[i], alle[j]] = [alle[j], alle[i]]
  const rest = w.reihenfolge.filter((x) => !alle.includes(x))
  return { ausgeblendet: [...w.ausgeblendet], reihenfolge: [...alle, ...rest].slice(0, HUB_APPS_MAX) }
}

export function wahlGleich(a: HubAppsWahl | null, b: HubAppsWahl | null): boolean {
  if (!a || !b) return a === b
  const gleich = (x: string[], y: string[]) => x.length === y.length && x.every((v, i) => v === y[i])
  return gleich(a.ausgeblendet, b.ausgeblendet) && gleich(a.reihenfolge, b.reihenfolge)
}
