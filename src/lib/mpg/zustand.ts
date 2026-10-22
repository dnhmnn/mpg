// Zustand eines Medizinprodukts — eine Regel für alle Ansichten (Liste, Hub-Widget).
//
// Rangfolge, die schwerste Stufe gewinnt:
//   GESPERRT     nicht einsatzbereit markiert, letzte Prüfung nicht bestanden,
//                offener Defekt „hoch“ oder „kritisch“
//   HANDLUNG     offener Mangel (gering/mittel), offene Meldung von außen,
//                Frist überfällig, heute fällig oder noch nie geprüft
//   BALD         Frist innerhalb der Vorwarnung
//   OK           einsatzbereit
// Jede Stufe nennt ihre Gründe im Klartext.
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

export interface ZustandGeraet extends FristFelder {
  operational?: boolean | null
  last_inspection_passed?: boolean | null
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

function fristGrund(f: Frist): Grund | null {
  const was = f.art === 'pruefung' ? 'Prüfung' : f.bezeichnung
  switch (f.lage) {
    case 'offen':
      return { stufe: 'handlung', text: f.art === 'pruefung' ? 'Erstprüfung offen' : `Letzte ${was} nicht eingetragen` }
    case 'ueberfaellig':
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
  }

  gruende.sort((a, b) => rang(a.stufe) - rang(b.stufe))
  return { stufe: gruende[0]?.stufe ?? 'ok', gruende, fristen }
}

/** Zählt Geräte je Stufe — z. B. für das Hub-Widget. */
export function zaehleStufen<T extends ZustandGeraet & { id: string }>(
  geraete: T[],
  defekte: { device_id: string; severity?: string | null }[],
  meldungen: { device_id: string; severity?: string | null }[],
  heute: Tag,
): Record<Stufe, number> {
  const zahl: Record<Stufe, number> = { gesperrt: 0, handlung: 0, bald: 0, ok: 0 }
  for (const g of geraete) {
    const z = zustandVon(g, defekte.filter(d => d.device_id === g.id), meldungen.filter(m => m.device_id === g.id), heute)
    zahl[z.stufe]++
  }
  return zahl
}
