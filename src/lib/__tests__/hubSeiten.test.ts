import { describe, it, expect } from 'vitest'
import {
  REIHEN_ABSTAND, SEITEN_RAND, STEUER_HOEHE, aufSeiten, ganzeReihen, kachelHoehe, reihenFuerHoehe, seiteAusScroll, seiteBegrenzen,
  seiteNachUmbau, seitenPlan, spaltenFuerBreite,
} from '../hubSeiten'

describe('Hub-Seiten: Spalten und Kachelhöhe', () => {
  it('4 Spalten am Telefon, 5 ab 600 px, 6 ab 720 px', () => {
    expect(spaltenFuerBreite(320)).toBe(4)
    expect(spaltenFuerBreite(599)).toBe(4)
    expect(spaltenFuerBreite(600)).toBe(5)
    expect(spaltenFuerBreite(719)).toBe(5)
    expect(spaltenFuerBreite(720)).toBe(6)
    expect(spaltenFuerBreite(1440)).toBe(6)
  })

  it('nur mit Zoom schmaler als 300 px: 3 Spalten, unter 232 px 2, damit die Symbole nicht übereinanderliegen', () => {
    expect(spaltenFuerBreite(300)).toBe(4)
    expect(spaltenFuerBreite(299)).toBe(3)
    expect(spaltenFuerBreite(232)).toBe(3)
    expect(spaltenFuerBreite(231)).toBe(2)
    expect(spaltenFuerBreite(187)).toBe(2)
    // 2 Spalten passen noch: 2 × 60 + 6 Abstand + 8 Rand der Seite + 32 Rand des Blatts
    expect(2 * 60 + 6 + 8 + 32).toBeLessThanOrEqual(187)
  })

  it('Kachel 91 px, ab 600 px 95 px, mit „bis“-Zeile je 16 mehr', () => {
    expect(kachelHoehe(390, false)).toBe(91)
    expect(kachelHoehe(390, true)).toBe(107)
    expect(kachelHoehe(600, false)).toBe(95)
    expect(kachelHoehe(800, true)).toBe(111)
  })
})

describe('Hub-Seiten: Reihen aus der Höhe', () => {
  it('zählt nur ganze Reihen, der Abstand gilt nur zwischen den Reihen', () => {
    // 3 Reihen: 3 × 91 + 2 × 16 = 305
    expect(reihenFuerHoehe(305, 91)).toBe(3)
    expect(reihenFuerHoehe(304, 91)).toBe(2)
    expect(reihenFuerHoehe(91, 91)).toBe(1)
  })

  it('mindestens eine Reihe, auch wenn nichts passt oder noch nicht gemessen ist', () => {
    expect(reihenFuerHoehe(40, 91)).toBe(1)
    expect(reihenFuerHoehe(0, 91)).toBe(1)
    expect(reihenFuerHoehe(-20, 91)).toBe(1)
    expect(reihenFuerHoehe(Number.NaN, 91)).toBe(1)
    expect(reihenFuerHoehe(500, 0)).toBe(1)
  })

  it('der Abstand ist einstellbar', () => {
    expect(reihenFuerHoehe(300, 100, 0)).toBe(3)
    expect(reihenFuerHoehe(300, 100, 10)).toBe(2)
    expect(REIHEN_ABSTAND).toBe(16)
  })

  it('ganzeReihen: 0, wenn nicht einmal eine Reihe passt oder nichts gemessen ist', () => {
    expect(ganzeReihen(305, 91)).toBe(3)
    expect(ganzeReihen(91, 91)).toBe(1)
    expect(ganzeReihen(90, 91)).toBe(0)
    expect(ganzeReihen(3, 91)).toBe(0)
    for (const h of [0, -20, Number.NaN]) expect(ganzeReihen(h, 91), String(h)).toBe(0)
    expect(ganzeReihen(500, 0)).toBe(0)
    expect(ganzeReihen(300, 100, Number.NaN)).toBe(3)
  })
})

describe('Hub-Seiten: der Plan', () => {
  const telefon = { spalten: 4, kachel: 91 }

  it('passt alles auf eine Seite, gibt es keine Steuerung', () => {
    // 2 Reihen Platz (2 × 91 + 16 + Rand), 7 Apps
    const p = seitenPlan({ ...telefon, anzahl: 7, hoehe: 198 + SEITEN_RAND })
    expect(p).toEqual({ spalten: 4, reihen: 2, proSeite: 8, seiten: 1, steuerung: false, passt: true })
  })

  it('genau voll ist noch eine Seite', () => {
    expect(seitenPlan({ ...telefon, anzahl: 8, hoehe: 198 + SEITEN_RAND }).seiten).toBe(1)
  })

  it('mehr Apps als Platz: die Steuerung geht von der Höhe ab, dann wird geteilt', () => {
    // Ohne Steuerung 3 Reihen (305 + Rand), mit Steuerung nur noch 2
    const p = seitenPlan({ ...telefon, anzahl: 13, hoehe: 305 + SEITEN_RAND })
    expect(p.steuerung).toBe(true)
    expect(p.reihen).toBe(2)
    expect(p.proSeite).toBe(8)
    expect(p.seiten).toBe(2)
  })

  it('reicht die Höhe auch mit Steuerung, bleibt die Reihenzahl', () => {
    const p = seitenPlan({ ...telefon, anzahl: 30, hoehe: 305 + SEITEN_RAND + STEUER_HOEHE })
    expect(p).toEqual({ spalten: 4, reihen: 3, proSeite: 12, seiten: 3, steuerung: true, passt: true })
  })

  it('kurzer Bildschirm (quer): eine Reihe mit Steuerung passt gerade, also eine Reihe je Seite', () => {
    const p = seitenPlan({ spalten: 6, kachel: 95, anzahl: 15, hoehe: 95 + SEITEN_RAND + STEUER_HOEHE })
    expect(p).toEqual({ spalten: 6, reihen: 1, proSeite: 6, seiten: 3, steuerung: true, passt: true })
  })

  it('Notausgang: Höhe kleiner als eine Reihe, alle Apps auf einer Seite ohne Steuerung', () => {
    // 568 × 227 mit langem Namen: 3 px Band, 14 Apps
    const p = seitenPlan({ ...telefon, anzahl: 14, hoehe: 55 })
    expect(p).toEqual({ spalten: 4, reihen: 4, proSeite: 16, seiten: 1, steuerung: false, passt: false })
    expect(aufSeiten(Array.from({ length: 14 }, (_, i) => i), p.proSeite)).toHaveLength(1)
    // Wenige Apps, aber nicht einmal eine Reihe hoch
    expect(seitenPlan({ ...telefon, anzahl: 3, hoehe: 90 })).toMatchObject({ reihen: 1, seiten: 1, steuerung: false, passt: false })
  })

  it('Notausgang: eine Reihe passt ohne Steuerung, aber nicht alle Apps, und mit Steuerung keine Reihe', () => {
    // 682 × 272 (iPhone quer mit Seitenzoom 125 %): 140 px frei, 6 Apps bei 5 Spalten
    const p = seitenPlan({ spalten: 5, kachel: 95, anzahl: 6, hoehe: 140 })
    expect(p).toEqual({ spalten: 5, reihen: 2, proSeite: 10, seiten: 1, steuerung: false, passt: false })
    // Ein Pixel mehr für die Steuerung, und es geht wieder mit Seiten
    expect(seitenPlan({ spalten: 5, kachel: 95, anzahl: 6, hoehe: 95 + SEITEN_RAND + STEUER_HOEHE })).toMatchObject({ seiten: 2, steuerung: true, passt: true })
    expect(seitenPlan({ spalten: 5, kachel: 95, anzahl: 6, hoehe: 95 + SEITEN_RAND + STEUER_HOEHE - 1 }).passt).toBe(false)
  })

  it('genau eine Reihe hoch und alles passt hinein: keine Steuerung, kein Notausgang', () => {
    expect(seitenPlan({ ...telefon, anzahl: 4, hoehe: 91 + SEITEN_RAND })).toEqual({ spalten: 4, reihen: 1, proSeite: 4, seiten: 1, steuerung: false, passt: true })
    expect(seitenPlan({ ...telefon, anzahl: 4, hoehe: 91 + SEITEN_RAND - 1 }).passt).toBe(false)
  })

  it('ohne Apps eine Seite ohne Steuerung; Unsinn wird abgefangen', () => {
    expect(seitenPlan({ ...telefon, anzahl: 0, hoehe: 400 })).toMatchObject({ seiten: 1, steuerung: false, passt: true })
    // Noch nicht gemessen (0) oder Unsinn: Notausgang, alles auf einer Seite
    expect(seitenPlan({ spalten: 0, kachel: 91, anzahl: 3, hoehe: 0 })).toEqual({ spalten: 1, reihen: 3, proSeite: 3, seiten: 1, steuerung: false, passt: false })
    expect(seitenPlan({ ...telefon, anzahl: 5, hoehe: Number.NaN })).toMatchObject({ seiten: 1, passt: false })
  })
})

describe('Hub-Seiten: Aufteilen', () => {
  it('Reihenfolge bleibt, die letzte Seite darf kürzer sein', () => {
    expect(aufSeiten(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']])
    expect(aufSeiten(['a', 'b'], 8)).toEqual([['a', 'b']])
  })

  it('ohne Apps eine leere Seite, Seitengröße mindestens 1', () => {
    expect(aufSeiten([], 8)).toEqual([[]])
    expect(aufSeiten(['a', 'b'], 0)).toEqual([['a'], ['b']])
  })
})

describe('Hub-Seiten: welche Seite zu sehen ist', () => {
  it('aus der Lage des Wischbereichs, ab halber Strecke die nächste', () => {
    expect(seiteAusScroll(0, 360, 3)).toBe(0)
    expect(seiteAusScroll(179, 360, 3)).toBe(0)
    expect(seiteAusScroll(180, 360, 3)).toBe(1)
    expect(seiteAusScroll(720, 360, 3)).toBe(2)
  })

  it('über das Ende hinaus (Nachfedern) bleibt es bei der letzten, ohne Breite bei der ersten', () => {
    expect(seiteAusScroll(1200, 360, 3)).toBe(2)
    expect(seiteAusScroll(-40, 360, 3)).toBe(0)
    expect(seiteAusScroll(400, 0, 3)).toBe(0)
  })

  it('begrenzen: weniger Seiten nach Drehen oder Anpassen', () => {
    expect(seiteBegrenzen(2, 2)).toBe(1)
    expect(seiteBegrenzen(-1, 2)).toBe(0)
    expect(seiteBegrenzen(1, 0)).toBe(0)
    expect(seiteBegrenzen(Number.NaN, 3)).toBe(0)
    expect(seiteBegrenzen(1.7, 3)).toBe(1)
  })

  it('nach einem Umbau die Seite, auf der die erste App der bisherigen Seite jetzt steht', () => {
    // Seite 2 (Apps 8 bis 11) bei 4 je Seite: bei 12 je Seite auf Seite 0
    expect(seiteNachUmbau(2, 4, 12, 2)).toBe(0)
    // Seite 1 (Apps 12 bis 23) bei 12 je Seite: bei 6 je Seite auf Seite 2
    expect(seiteNachUmbau(1, 12, 6, 3)).toBe(2)
    // Es gibt weniger Seiten: auf die letzte
    expect(seiteNachUmbau(3, 6, 6, 2)).toBe(1)
    expect(seiteNachUmbau(0, 0, 0, 1)).toBe(0)
  })
})
