// Zustand eines Medizinprodukts — eine Regel für alle Ansichten (Liste, Hub-Widget).
//
// Rangfolge, die schwerste Stufe gewinnt:
//   GESPERRT     außer Betrieb genommen, nicht einsatzbereit markiert, letzte Prüfung
//                nicht bestanden, offener Defekt „hoch“ oder „kritisch“, STK oder MTK
//                überfällig (Entscheidung des Betreibers, 22.10.2026 — nach naheliegender
//                Auslegung wäre ein Weiterbetrieb nicht verordnungskonform), letzte STK oder
//                MTK nicht bestanden — bis eine bestandene eingetragen ist, wie bei der
//                Prüfung (Entscheidung des Betreibers, 23.10.2026)
//   HANDLUNG     offener Mangel (gering/mittel), offene Meldung von außen, Prüfung
//                überfällig, heute fällig oder noch nie geprüft, STK/MTK heute fällig,
//                ohne Datum oder mit einem Datum in der Zukunft
//   BALD         Frist innerhalb der Vorwarnung
//   OK           einsatzbereit
// Jede Stufe nennt ihre Gründe im Klartext.
//
// Ein außer Betrieb genommenes Gerät gehört nicht mehr zum Bestand: Listen und Zählungen
// lassen es weg. Wo es doch bewertet wird, gilt es als gesperrt — nie als einsatzbereit.
//
// Prüffälle: src/lib/mpg/selbsttest.ts

import { fristenVon, kalendertag, lageText, tagText, type Frist, type FristFelder, type Tag } from './fristen'

export type Stufe = 'gesperrt' | 'handlung' | 'bald' | 'ok'

export const STUFEN: Stufe[] = ['gesperrt', 'handlung', 'bald', 'ok']

export const STUFE_TEXT: Record<Stufe, string> = {
  gesperrt: 'Gesperrt', handlung: 'Handlungsbedarf', bald: 'Bald fällig', ok: 'Einsatzbereit',
}

export type Schwere = 'low' | 'medium' | 'high' | 'critical'

/** Schwere, ab der ein offener Defekt das Gerät sperrt. */
export function sperrtDefekt(schwere: string | null | undefined): boolean {
  return schwere === 'high' || schwere === 'critical'
}

export const SCHWERE_TEXT: Record<Schwere, string> = {
  low: 'gering', medium: 'mittel', high: 'hoch', critical: 'kritisch',
}

/** Die neueste eingetragene STK bzw. MTK laut Gerätebuch (kontrollen.ts, neuesteKontrollen) */
export interface KontrollStand { datum: Tag; bestanden: boolean; /** Zeit des Eintrags (created) */ eingetragen?: string }

export interface ZustandGeraet extends FristFelder {
  operational?: boolean | null
  last_inspection_passed?: boolean | null
  /** Datum der Außerbetriebnahme; leer = in Betrieb */
  ausser_betrieb?: string | null
  /** Neueste STK und MTK aus dem Gerätebuch — fehlt es, zählt nur, was am Gerät steht */
  kontrollen?: Partial<Record<'stk' | 'mtk', KontrollStand>>
}

/** Außer Betrieb genommen? Jeder eingetragene Wert zählt — im Zweifel nicht einsatzbereit. */
export function istAusserBetrieb(g: Pick<ZustandGeraet, 'ausser_betrieb'>): boolean {
  return !!String(g.ausser_betrieb ?? '').trim()
}

export interface Grund { stufe: Stufe; text: string }

export interface Zustand {
  stufe: Stufe
  /** schwerste zuerst */
  gruende: Grund[]
  fristen: Frist[]
}

const rang = (s: Stufe) => STUFEN.indexOf(s)

/**
 * Ist die letzte Prüfung nicht bestanden? Nur mit Prüfdatum — PocketBase liefert ein
 * nie gesetztes Ja/Nein-Feld als false, ein nie geprüftes Gerät ist aber nicht durchgefallen.
 */
export function pruefungNichtBestanden(g: Pick<ZustandGeraet, 'last_inspection' | 'last_inspection_passed'>): boolean {
  return !!kalendertag(g.last_inspection) && g.last_inspection_passed === false
}

/**
 * Ist die neueste STK bzw. MTK nicht bestanden? Dann bleibt das Gerät gesperrt, bis eine
 * bestandene eingetragen ist. Eine nachgetragene ältere zählt nicht, wenn am Gerät schon
 * eine neuere bestandene steht — ein Datum am Gerät nach heute ist aber keine (Tippfehler).
 * Freigeben und ein späteres Datum am Gerät lehnt der Server dann ab (pb_hooks/mpg.pb.js).
 */
export function kontrolleNichtBestanden(g: Pick<ZustandGeraet, 'has_stk' | 'has_mtk' | 'last_stk' | 'last_mtk' | 'kontrollen'>, art: 'stk' | 'mtk', heute: Tag): boolean {
  const k = g.kontrollen?.[art]
  if (!(art === 'stk' ? g.has_stk : g.has_mtk) || !k || k.bestanden) return false
  const letzte = kalendertag(art === 'stk' ? g.last_stk : g.last_mtk)
  return !letzte || letzte > heute || k.datum >= letzte
}

/** Defekt aus einer nicht bestandenen STK/MTK? (Fallback, falls ihr Eintrag im Gerätebuch fehlt) */
export function defektAusKontrolle(beschreibung: string | null | undefined): 'stk' | 'mtk' | null {
  const m = /^(STK|MTK) nicht bestanden:/.exec(String(beschreibung ?? ''))
  return m ? (m[1] === 'STK' ? 'stk' : 'mtk') : null
}

function fristGrund(f: Frist): Grund | null {
  const was = f.art === 'pruefung' ? 'Prüfung' : f.bezeichnung
  if (f.zukunft && !f.naechste) return { stufe: 'handlung', text: `${was}: eingetragenes Datum liegt in der Zukunft — bitte prüfen` }
  switch (f.lage) {
    case 'offen':
      return { stufe: 'handlung', text: f.art === 'pruefung' ? 'Erstprüfung offen' : `${was}: Datum fehlt` }
    case 'ueberfaellig':
      return { stufe: f.art === 'pruefung' ? 'handlung' : 'gesperrt', text: `${was} ${lageText(f)}` }
    case 'heute':
      return { stufe: 'handlung', text: `${was} ${lageText(f)}` }
    case 'bald':
      return { stufe: 'bald', text: `${was} ${lageText(f)} (${tagText(f.naechste)})` }
    case 'ok':
      return null
  }
}

/**
 * @param defekte offene Defekte dieses Geräts (Status nicht „resolved“)
 * @param meldungen offene Meldungen von außen zu diesem Gerät (Status „pending“)
 */
export function zustandVon(
  g: ZustandGeraet,
  defekte: { severity?: string | null }[],
  meldungen: { severity?: string | null }[],
  heute: Tag,
): Zustand {
  if (istAusserBetrieb(g)) {
    const seit = kalendertag(g.ausser_betrieb)
    return { stufe: 'gesperrt', gruende: [{ stufe: 'gesperrt', text: seit ? `Außer Betrieb seit ${tagText(seit)}` : 'Außer Betrieb' }], fristen: [] }
  }
  const gruende: Grund[] = []
  if (g.operational === false) gruende.push({ stufe: 'gesperrt', text: 'Als nicht einsatzbereit markiert' })
  if (pruefungNichtBestanden(g)) gruende.push({ stufe: 'gesperrt', text: 'Letzte Prüfung nicht bestanden' })

  const sperrend = defekte.filter(d => sperrtDefekt(d.severity))
  const leicht = defekte.length - sperrend.length
  if (sperrend.length) gruende.push({ stufe: 'gesperrt', text: sperrend.length === 1 ? `Offener Defekt (${SCHWERE_TEXT[sperrend[0].severity as Schwere]})` : `${sperrend.length} offene Defekte (hoch/kritisch)` })
  if (leicht) gruende.push({ stufe: 'handlung', text: leicht === 1 ? 'Offener Mangel' : `${leicht} offene Mängel` })
  if (meldungen.length) gruende.push({ stufe: 'handlung', text: meldungen.length === 1 ? 'Meldung von außen offen' : `${meldungen.length} Meldungen von außen offen` })

  const fristen = fristenVon(g, heute)
  for (const f of fristen) {
    const gr = fristGrund(f)
    if (gr) gruende.push(gr)
    if (f.zukunft && f.naechste) gruende.push({ stufe: 'handlung', text: `${f.bezeichnung}: eingetragenes Datum liegt in der Zukunft — bitte prüfen` })
  }
  for (const art of ['stk', 'mtk'] as const) {
    if (kontrolleNichtBestanden(g, art, heute)) gruende.push({ stufe: 'gesperrt', text: `Letzte ${art === 'stk' ? 'STK' : 'MTK'} nicht bestanden` })
  }

  gruende.sort((a, b) => rang(a.stufe) - rang(b.stufe))
  return { stufe: gruende[0]?.stufe ?? 'ok', gruende, fristen }
}

/**
 * Was ein Gerät nach einer Änderung (Defekt behoben, freigegeben …) noch sperren würde — damit
 * ein Blatt nicht „wieder einsatzbereit“ sagt, wo z. B. eine überfällige STK weiter sperrt.
 * @param nach die Änderung am Gerät (z. B. { operational: true })
 */
export function bleibtGesperrt(
  g: ZustandGeraet,
  defekte: { severity?: string | null }[],
  meldungen: { severity?: string | null }[],
  heute: Tag,
  nach: Partial<ZustandGeraet>,
): Grund[] {
  return zustandVon({ ...g, ...nach }, defekte, meldungen, heute).gruende.filter(x => x.stufe === 'gesperrt')
}

/** Zählt Geräte je Stufe — z. B. für das Hub-Widget. Außer Betrieb genommene zählen nicht mit. */
export function zaehleStufen<T extends ZustandGeraet & { id: string }>(
  geraete: T[],
  defekte: { device_id: string; severity?: string | null }[],
  meldungen: { device_id: string; severity?: string | null }[],
  heute: Tag,
): Record<Stufe, number> {
  const zahl: Record<Stufe, number> = { gesperrt: 0, handlung: 0, bald: 0, ok: 0 }
  for (const g of geraete) {
    if (istAusserBetrieb(g)) continue
    const z = zustandVon(g, defekte.filter(d => d.device_id === g.id), meldungen.filter(m => m.device_id === g.id), heute)
    zahl[z.stufe]++
  }
  return zahl
}
