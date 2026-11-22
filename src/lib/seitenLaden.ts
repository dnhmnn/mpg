// Seitenbausteine der Apps an einer Stelle: App.tsx hängt sie mit seite() ein, der Hub lädt die seiner
// Kacheln im Leerlauf vor (vorladen). Ist ein Baustein schon da, erscheint die Seite sofort im selben
// Bild, ohne Ersatzfläche; sonst steht beim Laden der rote Zwischenbildschirm (Suspense in App.tsx).
//
// Nicht über React-Router `v7_startTransition` (Owner, 22.11.2026, Durchsicht): Damit liefen auch
// Adresswechsel aus Suchfeldern als Transition, und in Feldern, deren Wert an der Adresse hängt
// (Gerätesuche im MPG, Logbuch), sprang der Cursor und gingen Zeichen verloren.
import { createElement, lazy, useState, type ComponentType } from 'react'

type Modul = { default: ComponentType<any> } // eslint-disable-line @typescript-eslint/no-explicit-any
type Baustein = () => Promise<Modul>

export const SEITEN = {
  '/hub': () => import('../pages/Hub'),
  '/settings': () => import('../pages/SettingsPage'),
  '/benachrichtigungen': () => import('../pages/Benachrichtigungen'),
  '/ausbildungen': () => import('../pages/ausbildungen/Ausbildungen'),
  '/files': () => import('../pages/Files'),
  '/lager': () => import('../pages/Lager'),
  '/mpg': () => import('../pages/mpg'),
  '/lernbar': () => import('../pages/Lernbar'),
  '/unitas': () => import('../pages/Unitas'),
  '/unitarii': () => import('../pages/Unitarii'),
  '/patienten': () => import('../pages/patienten/Patienten'),
  '/chat': () => import('../pages/Chat'),
  '/supervisor': () => import('../pages/Supervisor'),
  '/einsaetze': () => import('../pages/Einsaetze'),
  '/vorgaenge': () => import('../pages/Vorgaenge'),
  '/office': () => import('../pages/Office'),
  '/notizen': () => import('../pages/Notizen'),
  '/wissen': () => import('../pages/Wissen'),
} satisfies Record<string, Baustein>

const fertig = new Map<Baustein, Modul>()
const unterwegs = new Map<Baustein, Promise<Modul>>()

/** Baustein laden (einmal; ein Fehlschlag darf beim nächsten Mal neu versucht werden). */
export function laden(b: Baustein): Promise<Modul> {
  const m = fertig.get(b)
  if (m) return Promise.resolve(m)
  let p = unterwegs.get(b)
  if (!p) {
    p = b().then((x) => { fertig.set(b, x); unterwegs.delete(b); return x })
    p.catch(() => { unterwegs.delete(b) })
    unterwegs.set(b, p)
  }
  return p
}

/** Ist der Baustein schon geladen? */
export function geladen(b: Baustein): boolean {
  return fertig.has(b)
}

/** Die App eines Pfads, sein erster Teil („/mpg/geraete/x?y“ → „/mpg“). */
export function appVonPfad(pfad: string): string {
  return '/' + (pfad.split(/[?#]/)[0].split('/')[1] || '')
}

/**
 * Blendet die neue App ein? Nur beim Wechsel der App (Hub → App, App → Hub, App → App), nicht bei
 * Unterseiten derselben App und nicht bei Zurück/Vor des Browsers (POP): Safari zeigt beim
 * Zurückwischen schon seine eigene Bewegung, sonst liefe es doppelt.
 */
export function appEinblenden(vorher: string, jetzt: string, art: 'POP' | 'PUSH' | 'REPLACE'): boolean {
  return art !== 'POP' && appVonPfad(vorher) !== appVonPfad(jetzt)
}

/** Der Baustein zu einem Pfad der App („/mpg/geraete“ gehört zu „/mpg“), sonst null. */
export function bausteinFuer(pfad: string): Baustein | null {
  return (SEITEN as Record<string, Baustein>)[appVonPfad(pfad)] ?? null
}

/**
 * Die Seite zu einem Pfad als Baustein für die Route. Schon geladen: sofort, ohne Ersatzfläche;
 * sonst über lazy (Ersatzfläche ist der rote Zwischenbildschirm). Welche der beiden Formen gilt,
 * steht beim Einhängen fest; wechselte sie danach, hinge React die ganze Seite neu ein.
 */
export function seite(pfad: keyof typeof SEITEN): ComponentType {
  const b: Baustein = SEITEN[pfad]
  const Spaeter = lazy(() => laden(b))
  function Seite() {
    const [Typ] = useState<ComponentType>(() => fertig.get(b)?.default ?? Spaeter)
    return createElement(Typ)
  }
  Seite.displayName = `Seite(${pfad})`
  return Seite
}

/**
 * Bausteine nacheinander vorladen, mit Pausen, damit Wischen und Tippen nicht stocken.
 * Gibt eine Funktion zum Abbrechen zurück (der Hub ruft sie beim Verlassen).
 */
export function vorladen(pfade: string[], o: { warten?: number; pause?: number } = {}): () => void {
  const liste = [...new Set(pfade.map(bausteinFuer).filter((b): b is Baustein => !!b))].filter((b) => !fertig.has(b))
  let aus = false
  let uhr = 0
  let i = 0
  const weiter = () => {
    if (aus || i >= liste.length) return
    laden(liste[i++]).catch(() => { /* ohne Netz nicht vorrätig: lädt beim Tippen */ })
      .finally(() => { if (!aus) uhr = window.setTimeout(weiter, o.pause ?? 150) })
  }
  if (liste.length) uhr = window.setTimeout(weiter, o.warten ?? 800)
  return () => { aus = true; window.clearTimeout(uhr) }
}
