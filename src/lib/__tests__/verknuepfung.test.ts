import { describe, it, expect } from 'vitest'
import { STANDARD_VERKNUEPFUNGEN, ergaenzen, gleicheVerknuepfungen, haken, mitgebracht, verknuepfungen, vorlageMitVerknuepfungen } from '../verknuepfung'
import { PERM_LABELS, vergebbareRechte } from '../apps'

const STANDARD = verknuepfungen({})

describe('Verknüpfte Rechte: was gilt', () => {
  it('ohne Eintrag gilt die Voreinstellung: Lager bringt Dateien, MPG und Vorgänge', () => {
    for (const org of [{}, { verknuepfungen: null }, null, undefined, { verknuepfungen: 'kaputt' }]) {
      expect(verknuepfungen(org)).toEqual(STANDARD_VERKNUEPFUNGEN)
    }
    expect(mitgebracht('lager', STANDARD).sort()).toEqual(['dashboard', 'dateien', 'dokumente'])
  })

  it('ein leeres Objekt heißt: keine Verknüpfungen', () => {
    expect(verknuepfungen({ verknuepfungen: {} })).toEqual({})
    expect(mitgebracht('lager', verknuepfungen({ verknuepfungen: {} }))).toEqual([])
  })

  it('liest JSON-Text und verwirft Unbekanntes, Doppeltes und Selbstbezüge', () => {
    const v = verknuepfungen({ verknuepfungen: '{"lager":["dateien","dateien","lager","quatsch"],"quatsch":["chat"],"chat":"notizen"}' })
    expect(v).toEqual({ lager: ['dateien'] })
  })
})

describe('Verknüpfte Rechte: die Benutzerverwaltung kommt nie mit', () => {
  it('auch wenn sie eingetragen ist — weder direkt noch über eine Kette', () => {
    const v = verknuepfungen({ verknuepfungen: { lager: ['unitarii', 'dateien'], dateien: ['unitarii'] } })
    expect(v).toEqual({ lager: ['dateien'] })
    expect(mitgebracht('lager', { lager: ['unitarii', 'dateien'], dateien: ['unitarii'] })).toEqual(['dateien'])
    expect(haken({}, 'lager', true, { lager: ['unitarii'] }).unitarii).toBeUndefined()
  })

  it('als Auslöser darf sie etwas mitbringen', () => {
    expect(mitgebracht('unitarii', { unitarii: ['dashboard'] })).toEqual(['dashboard'])
  })
})

describe('Verknüpfte Rechte: Häkchen setzen', () => {
  it('Lager anhaken hakt die verknüpften mit an', () => {
    const r = haken({ lernbar: true, dokumente: false }, 'lager', true, STANDARD)
    expect(r).toEqual({ lernbar: true, lager: true, dateien: true, dashboard: true, dokumente: true })
  })

  it('Abwählen nimmt nichts mit weg — und ein verknüpftes lässt sich einzeln abwählen', () => {
    const an = haken({}, 'lager', true, STANDARD)
    const ohneVorgaenge = haken(an, 'dokumente', false, STANDARD)
    expect(ohneVorgaenge.dokumente).toBe(false)
    expect(ohneVorgaenge.lager).toBe(true)
    const ohneLager = haken(ohneVorgaenge, 'lager', false, STANDARD)
    expect(ohneLager).toEqual({ lager: false, dateien: true, dashboard: true, dokumente: false })
  })

  it('folgt Ketten und hält bei Kreisen an', () => {
    const v = { lager: ['dateien'], dateien: ['chat'], chat: ['lager'] }
    expect(mitgebracht('lager', v)).toEqual(['dateien', 'chat'])
    expect(haken({}, 'chat', true, v)).toEqual({ chat: true, lager: true, dateien: true })
  })

  it('bringt keine Rechte gesperrter Module mit und reicht über sie nichts weiter', () => {
    // Lager gebucht: Dateien, MPG und Vorgänge sind darin enthalten, Patienten nicht
    const org = { freigeschaltet: ['lager', 'chat'] }
    expect(mitgebracht('lager', STANDARD, org).sort()).toEqual(['dashboard', 'dateien', 'dokumente'])
    expect(mitgebracht('lager', { lager: ['patienten', 'dateien'] }, org)).toEqual(['dateien'])
    const kette = { lager: ['patienten'], patienten: ['chat'] }
    expect(mitgebracht('lager', kette, org)).toEqual([])
  })

  it('ein Recht eines gesperrten Moduls bringt nichts mit', () => {
    expect(mitgebracht('lager', STANDARD, { freigeschaltet: ['dateien', 'dokumente'] })).toEqual([])
  })
})

describe('Verknüpfte Rechte: Rollen-Vorlage anwenden', () => {
  it('was die Vorlage anhakt, bringt seine Verknüpfungen mit', () => {
    // Standard-Vorlage "lager" kennt Vorgänge nicht — die Verknüpfung bringt es
    const vorlage = { dashboard: true, lager: true, produktausgabe: true, dateien: true, chat: true }
    expect(vorlageMitVerknuepfungen(vorlage, STANDARD)).toEqual({ ...vorlage, dokumente: true })
  })

  it('was die Vorlage selbst abwählt, bleibt abgewählt', () => {
    const vorlage = { lager: true, dateien: true, dashboard: true, dokumente: false, unitarii: false }
    expect(vorlageMitVerknuepfungen(vorlage, STANDARD)).toEqual(vorlage)
  })

  it('zieht keine Rechte nach, die der Benutzer schon hat', () => {
    // Benutzer hat Lager ohne Vorgänge; neue Rolle "benutzer" — Vorgänge bleibt weg
    const benutzer = { lager: true, dokumente: false }
    const neu = { ...benutzer, ...vorlageMitVerknuepfungen({ dashboard: true, lernbar: true, chat: true }, STANDARD) }
    expect(neu.dokumente).toBe(false)
  })

  it('ohne Verknüpfungen ändert sich nichts', () => {
    expect(vorlageMitVerknuepfungen({ lager: true }, {})).toEqual({ lager: true })
  })
})

describe('Verknüpfte Rechte: bestehende Benutzer nachziehen', () => {
  it('ergänzt Fehlendes, auch ausdrücklich abgewählte — und nimmt nichts weg', () => {
    const { rechte, dazu } = ergaenzen({ lager: true, dateien: true, dokumente: false, patienten: true, chat: false }, STANDARD)
    expect(dazu.sort()).toEqual(['dashboard', 'dokumente'])
    expect(rechte).toEqual({ lager: true, dateien: true, dokumente: true, dashboard: true, patienten: true, chat: false })
  })

  it('ändert nichts, wo nichts fehlt oder kein Lager da ist', () => {
    expect(ergaenzen({ lager: true, dateien: true, dashboard: true, dokumente: true }, STANDARD).dazu).toEqual([])
    expect(ergaenzen({ lager: false, chat: true }, STANDARD).dazu).toEqual([])
    expect(ergaenzen(undefined, STANDARD)).toEqual({ rechte: {}, dazu: [] })
  })
})

describe('Verknüpfte Rechte: Vergleich und Rechte-Liste', () => {
  it('Reihenfolge und leere Listen zählen nicht', () => {
    expect(gleicheVerknuepfungen({ lager: ['dateien', 'dokumente'] }, { lager: ['dokumente', 'dateien'], chat: [] })).toBe(true)
    expect(gleicheVerknuepfungen({ lager: ['dateien'] }, { lager: ['dokumente'] })).toBe(false)
    expect(gleicheVerknuepfungen({}, STANDARD)).toBe(false)
  })

  it('die Voreinstellung nennt nur Rechte, die es gibt', () => {
    const bekannt = new Set(PERM_LABELS.map((p) => p.key))
    for (const [von, ziele] of Object.entries(STANDARD_VERKNUEPFUNGEN)) {
      expect(bekannt.has(von)).toBe(true)
      for (const z of ziele) expect(bekannt.has(z), z).toBe(true)
    }
  })

  it('die vergebbaren Rechte sagen, dass Dateien die Schreibstube öffnet', () => {
    const r = vergebbareRechte({})
    expect(r.find((p) => p.key === 'dateien')?.label).toBe('Dateien & Schreibstube')
    expect(r.find((p) => p.key === 'dashboard')?.label).toBe('MPG & Einstellungen')
    expect(vergebbareRechte({ freigeschaltet: ['lernbar'] }).find((p) => p.key === 'dashboard')?.label).toBe('Einstellungen')
    expect(vergebbareRechte({ freigeschaltet: ['lernbar'] }).some((p) => p.key === 'lager')).toBe(false)
  })
})
