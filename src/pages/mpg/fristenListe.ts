// STK und MTK des Bestands, eingeteilt wie auf der Seite „Fristen“ — dieselbe Einteilung
// zählt auch die Karte auf „Heute“, damit beide dieselben Zahlen zeigen.

import type { Frist, Tag } from '../../lib/mpg/fristen'
import { typLegtNahe, type KontrollArt } from '../../lib/mpg/kontrollen'
import { kontrolleNichtBestanden } from '../../lib/mpg/zustand'
import type { MpgDaten } from './MpgDaten'
import type { Device } from './typen'

export interface FristEintrag {
  device: Device
  frist: Frist & { art: KontrollArt }
  /** Neueste Kontrolle nicht bestanden — gesperrt, bis eine bestandene eingetragen ist */
  nichtBestanden: boolean
}

export const ABSCHNITTE = ['Gesperrt — überfällig oder nicht bestanden', 'Diesen Monat', 'Ohne Datum', 'In den nächsten drei Monaten', 'Später'] as const

/** Abschnitt einer Frist: gesperrt, dieser Monat, ohne Datum, nächste 3 Monate, später */
export function abschnittVon(e: FristEintrag, heute: Tag): number {
  const f = e.frist
  if (e.nichtBestanden || f.lage === 'ueberfaellig') return 0
  if (!f.naechste) return 2
  if (f.naechste.slice(0, 7) === heute.slice(0, 7)) return 1
  return (f.tage ?? 0) <= 92 ? 3 : 4
}

/** Alle STK und MTK des Bestands (außer Betrieb genommene zählen nicht) */
export function fristenEintraege(m: Pick<MpgDaten, 'bestand' | 'zustand' | 'mitKontrollen' | 'heute'>): FristEintrag[] {
  return m.bestand.flatMap(device => m.zustand(device).fristen
    .filter((f): f is Frist & { art: KontrollArt } => f.art === 'stk' || f.art === 'mtk')
    .map(frist => ({ device, frist, nichtBestanden: kontrolleNichtBestanden(m.mitKontrollen(device), frist.art, m.heute) })))
}

/** Geräte, deren Typ STK oder MTK nahelegt, ohne dass sie angehakt ist — zum Entscheiden */
export function nichtAngehakt(bestand: Device[]): { device: Device; fehlt: KontrollArt[] }[] {
  return bestand
    .map(device => {
      const n = typLegtNahe(device.type)
      const fehlt = ([n.stk && !device.has_stk && 'stk', n.mtk && !device.has_mtk && 'mtk'].filter(Boolean)) as KontrollArt[]
      return { device, fehlt }
    })
    .filter(x => x.fehlt.length)
}
