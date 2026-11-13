// Prüfen vor dem Senden und Ordnen der Bausteine (Bauplan Vorgänge 4.1, 4.2).
//
// Reine Teile ohne React und PocketBase (Prüffälle: src/lib/__tests__/vorlagenEditor.test.ts).
// Dieselben Regeln wie der Server (felder.ts ist der Zwilling von formular-regeln.js):
// Pflicht über pflichtFehlt, Werte über wertFehler.

import { pflichtFehlt, pflichtText, wertFehler, type Baustein, type FeldDef, type StandardFormular } from '../../../lib/formular/felder'

/** Kennung des Eingabeelements eines Felds (Fokus nach einem Fehler, `htmlFor`). */
export function feldElementId(id: string): string {
  return `feld-${id}`
}

/**
 * Fehler je Feld vor dem Senden, in Formularfolge: erst Pflicht („Bitte „…“ ausfüllen.“),
 * dann ungültige Werte („Bitte „…“ prüfen.“). `erster`: das Feld, das den Fokus bekommt.
 */
export function felderPruefen(defs: FeldDef[], werte: Record<string, unknown>): { fehler: Record<string, string>; erster: string | null } {
  const fehler: Record<string, string> = {}
  const fehlt = new Set(pflichtFehlt(defs, werte).map((d) => d.id))
  for (const d of defs) {
    if (!d || d.aus === true) continue
    if (fehlt.has(d.id)) { fehler[d.id] = pflichtText(d); continue }
    const t = wertFehler(d, Object.prototype.hasOwnProperty.call(werte, d.id) ? werte[d.id] : undefined)
    if (t) fehler[d.id] = t
  }
  const erster = defs.find((d) => d && fehler[d.id])?.id ?? null
  return { fehler, erster }
}

/**
 * Das Feld zu einer Ablehnung des Servers: `werte.<id>` (eigene Formulare) bzw. `eigene.<id>`
 * (eigene Felder der Standardformulare). Sonst null (der Text steht dann allgemein da).
 */
export function serverFeld(feld: string | undefined, praefix: 'werte' | 'eigene'): string | null {
  const m = new RegExp(`^${praefix}\\.(.+)$`).exec(String(feld ?? ''))
  return m ? m[1] : null
}

/** Den Fokus auf ein Feld legen und es in den Blick holen (im Browser; sonst nichts). */
export function fokusAuf(id: string): void {
  if (typeof document === 'undefined') return
  const el = document.getElementById(feldElementId(id)) as HTMLElement | null
  if (!el) return
  try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }) } catch { /* alter Browser */ }
  try { el.focus({ preventScroll: true }) } catch { el.focus() }
}

// ── Bausteine eines Standardformulars in Gruppen ────────────────────────────

/** Eine Fläche im Formular: mehrere Felder unter einem Titel, oder ein Kernblock für sich. */
export type Gruppe = { titel: string; teile: Baustein[]; block: string | null }

/** Kernfelder je Formular: Name ihrer Gruppe, oder null für einen eigenen Block (Positionen, Gerät …). */
const KERN_GRUPPE: Record<StandardFormular, Record<string, string | null>> = {
  produktausgabe: { einsatz: 'Kopfdaten', datum: 'Kopfdaten', positionen: null, lager_id: null },
  defektmeldung: { device_id: null, description: null, severity: null },
  cirs: {
    datum: 'Ereignis', ort: 'Ereignis', kategorie: 'Ereignis', schwere: 'Ereignis',
    was: 'Beschreibung', warum: 'Beschreibung', folgen: 'Beschreibung',
    vorschlag: 'Verbesserung',
    melder_name: 'Angaben zur Person', melder_kontakt: 'Angaben zur Person',
  },
}

/** Gruppen, in die eigene Felder nicht hineinrutschen (dann eine eigene Gruppe). */
const NICHT_ANSCHLIESSEN = new Set(['Angaben zur Person'])
export const WEITERE_ANGABEN = 'Weitere Angaben'

/**
 * Die Bausteine in Formularfolge zu Flächen ordnen: Kernfelder in ihre Gruppe, Kernblöcke
 * einzeln, eigene Felder in die Gruppe davor (oder „Weitere Angaben“). Aufeinanderfolgende
 * Teile derselben Gruppe stehen in einer Fläche.
 */
export function gruppieren(bs: Baustein[], f: StandardFormular): Gruppe[] {
  const karte = KERN_GRUPPE[f] ?? {}
  const aus: Gruppe[] = []
  for (const b of bs) {
    const letzte = aus[aus.length - 1]
    if (b.art === 'kern') {
      const g = Object.prototype.hasOwnProperty.call(karte, b.id) ? karte[b.id] : WEITERE_ANGABEN
      if (g === null) { aus.push({ titel: b.label, teile: [b], block: b.id }); continue }
      if (letzte && !letzte.block && letzte.titel === g) letzte.teile.push(b)
      else aus.push({ titel: g, teile: [b], block: null })
      continue
    }
    if (letzte && !letzte.block && !NICHT_ANSCHLIESSEN.has(letzte.titel)) letzte.teile.push(b)
    else aus.push({ titel: WEITERE_ANGABEN, teile: [b], block: null })
  }
  return aus
}

/** Die eigenen Felder unter den Bausteinen (sichtbar, in Formularfolge). */
export function eigeneFelder(bs: Baustein[]): FeldDef[] {
  return bs.flatMap((b) => (b.art === 'eigen' && b.feld.aus !== true ? [b.feld] : []))
}

/**
 * Bietet die Maske eigene Felder an? Nur, wenn der Server sie nimmt: Antwortet er mit
 * einem Stand ohne die Fähigkeit (`faehig` fehlt oder sagt nein), gingen sie still
 * verloren. Ohne Antwort (ohne Netz, aus der Organisation erschlossen: Version 0) und beim
 * alten Server (der alte Weg legt sie mit Schnappschuss ab) bietet sie sie an.
 */
export function eigeneAngeboten(f: StandardFormular, o: { stand: { version: number; faehig?: { eigene_felder?: Partial<Record<StandardFormular, boolean>> } } | null; alterServer: boolean }): boolean {
  if (o.alterServer || !o.stand || o.stand.version === 0) return true
  return o.stand.faehig?.eigene_felder?.[f] === true
}
