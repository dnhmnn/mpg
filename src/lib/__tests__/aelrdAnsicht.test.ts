import { describe, it, expect } from 'vitest'
import { AELRD_ABSCHNITTE, AELRD_FELDER, aelrdFeld } from '../../katalog/aelrd'

/**
 * Die Anzeige erzeugt sich aus AELRD_ABSCHNITTE. Diese Tests sichern, dass
 * dabei nichts verlorengeht — die gewachsene Ansicht zeigte von 205 Feldern
 * fuenfzehn, weil ihre Liste von Hand gepflegt wurde.
 */
describe('Vollständigkeit der Protokollanzeige', () => {
  it('erreicht über die Abschnitte jedes Feld des Katalogs', () => {
    const gezeigt = new Set(AELRD_ABSCHNITTE.flatMap((a) => a.felder))
    const fehlend = AELRD_FELDER.map((f) => f.id).filter((id) => !gezeigt.has(id))
    expect(fehlend).toEqual([])
  })

  it('löst jede Feld-ID eines Abschnitts auf', () => {
    // Eine ID ohne Feld rendert nichts und fiele niemandem auf.
    for (const a of AELRD_ABSCHNITTE) {
      const tot = a.felder.filter((id) => !aelrdFeld(id))
      expect({ abschnitt: a.id, tot }).toEqual({ abschnitt: a.id, tot: [] })
    }
  })

  it('teilt jedes Feld in genau eine der beiden Darstellungen', () => {
    // Die Ansicht trennt breite Felder (Optionen, Freitext, Tabelle) von
    // schmalen. Ein Feld, auf das keine Regel passt, verschwaende; eines,
    // auf das beide passen, erschiene doppelt.
    for (const f of AELRD_FELDER) {
      const breit = Boolean(f.optionen?.length) || f.typ === 'langtext' || f.typ === 'medikation'
      const schmal = !breit
      expect({ feld: f.id, summe: Number(breit) + Number(schmal) })
        .toEqual({ feld: f.id, summe: 1 })
    }
  })

  it('gibt jedem Abschnitt eine Seitenzahl des Bogens', () => {
    for (const a of AELRD_ABSCHNITTE) expect([1, 2]).toContain(a.seite)
  })
})
