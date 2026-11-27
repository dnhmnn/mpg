// Ablauf der Szene auf responda.systems (src/pages/landing/ablauf.ts): Grenzen, Texte nie doppelt, Bilder ohne Schleier.
import { describe, expect, it } from 'vitest'
import {
  ANKER, AUFTAKT, BILDER, FUER_WEN, GESAMT, GRUNDSAETZE, KAPITEL, MODULE, SCHLUSSSATZ, SCHLUSS_VON, TEILE, TEXTTEILE, WECHSEL,
  auftakt, bildDeckkraft, bildFenster, kapitelBei, schluss, teilBei, textDeckkraft, zeileHell, zurueck,
} from '../../pages/landing/ablauf'

const nah = (a: number, b: number) => Math.abs(a - b) < 1e-9

describe('Ablauf der Szene', () => {
  it('ist lückenlos und steigend, Summe 15,6', () => {
    expect(TEILE[0].von).toBe(0)
    for (let i = 1; i < TEILE.length; i++) {
      expect(nah(TEILE[i].von, TEILE[i - 1].bis)).toBe(true)
      expect(TEILE[i].bis).toBeGreaterThan(TEILE[i].von)
    }
    expect(nah(GESAMT, 15.6)).toBe(true)
    expect(AUFTAKT).toBe(1.8)
    expect(nah(ANKER, 1.86)).toBe(true)
  })

  it('hat die vereinbarten Grenzen', () => {
    const name = (t: (typeof TEILE)[number]) => t.art === 'app' ? MODULE[t.modul].name : t.art === 'kapitel' ? `Kapitel ${t.kapitel + 1}` : t.art
    const grenzen = Object.fromEntries(TEILE.map(t => [name(t), t.von]))
    expect(grenzen).toEqual({
      auftakt: 0, Responda: 1.8,
      'Kapitel 1': 2.4, Einsätze: 2.9, Patientendokumentation: 3.7, Patienten: 4.5, 'Vorgänge und CIRS': 5.0,
      'Kapitel 2': 5.5, Medizinprodukte: 6.0, Hygiene: 6.8, Lager: 7.8,
      'Kapitel 3': 8.3, Ausbildungen: 8.8, Lernbar: 9.4,
      'Kapitel 4': 9.9, Unitas: 10.4, Chat: 10.9, Notizen: 11.4, Dateien: 11.9, Schreibstube: 12.4, 'Benutzer und Rollen': 12.9, Benachrichtigungen: 13.4,
      schluss: 14.2, nachlauf: 15.1,
    })
    expect(SCHLUSS_VON).toBe(14.2)
    // Die Checkliste der Hygiene schiebt sich in der Mitte des Schritts herein
    const cl = WECHSEL.find(w => BILDER[w.bild] === 'hygiene-checkliste')!
    expect(cl.von).toBe(7.3); expect(cl.schieben).toBe(true)
  })

  it('zeigt jede App genau einmal, Kapitel in Reihenfolge direkt vor ihrer ersten App', () => {
    const apps = TEILE.filter(t => t.art === 'app').map(t => t.art === 'app' ? t.modul : -1)
    expect(apps).toEqual(MODULE.map((_, i) => i))
    const kap = TEILE.filter(t => t.art === 'kapitel').map(t => t.art === 'kapitel' ? t.kapitel : -1)
    expect(kap).toEqual([0, 1, 2, 3])
    TEILE.forEach((t, i) => {
      if (t.art !== 'kapitel') return
      const n = TEILE[i + 1]
      expect(n.art).toBe('app')
      if (n.art === 'app') expect(MODULE[n.modul].kapitel).toBe(KAPITEL[t.kapitel].name)
    })
    expect(MODULE.find(m => m.name === 'Unitas')!.kapitel).toBe('Team und Organisation')
    expect(new Set(BILDER).size).toBe(BILDER.length)
  })

  it('zeigt nie zwei Texte zugleich deutlich und lässt nie lange keinen Text', () => {
    let ohne = 0, laengsteLuecke = 0
    for (let sv = 1.85; sv <= SCHLUSS_VON - 0.07 + 1e-9; sv += 0.005) {
      const d = TEXTTEILE.map((_, j) => textDeckkraft(j, sv).deckkraft)
      const sichtbar = d.map((x, j) => [x, j] as const).filter(([x]) => x > 0.01)
      expect(sichtbar.length).toBeLessThanOrEqual(2)
      if (sichtbar.length === 2) expect(Math.abs(sichtbar[0][1] - sichtbar[1][1])).toBe(1)
      expect(d.filter(x => x > 0.35).length).toBeLessThanOrEqual(1)
      if (d.some(x => x >= 0.5)) ohne = 0
      else { ohne += 0.005; laengsteLuecke = Math.max(laengsteLuecke, ohne) }
    }
    expect(laengsteLuecke).toBeLessThanOrEqual(0.06)
  })

  it('hat von 1,71 bis 14,5 immer ein deckendes Bild, nie einen Schleier', () => {
    const alle = BILDER.map(() => true)
    for (let sv = 1.71; sv <= 14.5; sv += 0.005) {
      const { deckkraft } = bildDeckkraft(sv, alle)
      expect(deckkraft.some(x => x === 1)).toBe(true)
      // höchstens das deckende und eines, das darüber hereinkommt
      expect(deckkraft.filter(x => x > 0).length).toBeLessThanOrEqual(2)
    }
  })

  it('hält jedes sichtbare Bild im Fenster der geladenen Bilder', () => {
    const alle = BILDER.map(() => true)
    for (let sv = 0; sv <= GESAMT; sv += 0.005) {
      const f = bildFenster(sv)
      expect(f.size).toBeLessThanOrEqual(7)
      bildDeckkraft(sv, alle).deckkraft.forEach((d, i) => { if (d > 0) expect(f.has(i)).toBe(true) })
    }
  })

  it('wartet auf ein Bild, das noch nicht bereit ist', () => {
    const w = WECHSEL.find(x => BILDER[x.bild] === 'patienten')!
    const bereit = BILDER.map(b => b !== 'patienten')
    const vorher = BILDER.indexOf('protokoll'), neu = BILDER.indexOf('patienten')
    for (const sv of [w.von + 0.01, w.bis, w.bis + 0.2]) {
      const { deckkraft } = bildDeckkraft(sv, bereit)
      expect(deckkraft[vorher]).toBe(1)
      expect(deckkraft[neu]).toBe(0)
    }
    expect(bildDeckkraft(w.bis + 0.01, BILDER.map(() => true)).deckkraft[neu]).toBe(1)
  })

  it('wechselt das Bild im Kapitelmoment nur, wenn das Handy blass ist', () => {
    for (const w of WECHSEL) {
      const t = TEILE[teilBei(w.von)]
      if (t.art !== 'kapitel') continue
      expect(zurueck(w.von)).toBe(1)
      expect(zurueck(w.bis)).toBe(1)
    }
  })

  it('führt im Auftakt und im Schluss in der richtigen Reihenfolge', () => {
    expect(auftakt(0).held).toBe(0)
    expect(auftakt(AUFTAKT).raus).toBe(1)
    expect(auftakt(AUFTAKT).zeichen).toBe(0)
    expect(auftakt(1.16).an).toBe(1)
    const s = (x: number) => schluss(SCHLUSS_VON + x * 0.9)
    expect(s(0.301).mitte).toBe(1)
    expect(s(0.5).zeile1).toBe(0)
    expect(s(0.651).zeile1).toBe(1)
    expect(s(0.771).zeile2).toBe(1)
    expect(s(0.921).knopf).toBe(1)
    expect(s(0.601).handyAus).toBe(1)
    // Zum Schluss steht die Übersicht wieder deckend im Handy
    expect(bildDeckkraft(SCHLUSS_VON + 0.251 * 0.9, BILDER.map(() => true)).deckkraft[0]).toBe(1)
  })

  it('zeigt die Kapitelzeile nur zwischen erstem Kapitel und Schluss', () => {
    expect(kapitelBei(2.0).sichtbar).toBe(0)
    expect(kapitelBei(4.0).sichtbar).toBe(1)
    expect(kapitelBei(4.0).kapitel).toBe(0)
    expect(kapitelBei(7.0).kapitel).toBe(1)
    expect(kapitelBei(14.3).sichtbar).toBe(0)
  })

  it('hellt Lesezeilen ab gut der Mitte auf', () => {
    expect(zeileHell(0.95)).toBe(0.2)
    expect(zeileHell(0.92)).toBeCloseTo(0.2)
    expect(zeileHell(0.62)).toBe(1)
    expect(zeileHell(0.1)).toBe(1)
    let vorher = 1
    for (let a = 0.62; a <= 0.92; a += 0.01) { const h = zeileHell(a); expect(h).toBeLessThanOrEqual(vorher + 1e-12); vorher = h }
  })

  it('hält die Texte knapp: kein Gedankenstrich, kein du, Push ist keine Alarmierung', () => {
    const texte = [
      ...MODULE.flatMap(m => [m.name, ...m.titel, m.text]),
      ...KAPITEL.flatMap(k => k.titel),
      ...GRUNDSAETZE.flatMap(g => [...g.name, g.text]),
      ...FUER_WEN, ...SCHLUSSSATZ,
    ]
    for (const t of texte) {
      expect(t).not.toMatch(/[–—]/)
      expect(t).not.toMatch(/\b(du|dich|dir|dein|deine|deinen|deinem|deiner)\b/i)
    }
    expect(MODULE.find(m => m.name === 'Benachrichtigungen')!.text).toMatch(/keine Alarmierung/)
  })
})
