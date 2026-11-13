import { describe, expect, it } from 'vitest'
import {
  ablegen, aktualisieren, alterEintrag, anzahlAlle, eintraege, entfernen, kennungAusInhalt, ohnePasswort,
  SCHLUESSEL_PREFIX, type NeuerEintrag,
} from '../formular/warteschlange'

/** Ein Speicher wie localStorage, mit Protokoll der Aufrufe. */
function speicher(start: Record<string, string> = {}) {
  const d = new Map(Object.entries(start))
  const log: string[] = []
  return {
    d, log,
    get length() { return d.size },
    key: (i: number) => [...d.keys()][i] ?? null,
    getItem: (k: string) => (d.has(k) ? d.get(k)! : null),
    setItem: (k: string, v: string) => { log.push(`set ${k}`); d.set(k, String(v)) },
    removeItem: (k: string) => { log.push(`remove ${k}`); d.delete(k) },
  }
}
function werfend(was: 'alles' | 'schreiben' | 'loeschen') {
  const s = speicher()
  return {
    ...s,
    get length() { return s.length },
    getItem: (k: string) => { if (was === 'alles') throw new Error('gesperrt'); return s.getItem(k) },
    setItem: (k: string, v: string) => { if (was !== 'loeschen') throw new Error('voll'); s.setItem(k, v) },
    removeItem: (k: string) => { if (was !== 'schreiben') throw new Error('gesperrt'); s.removeItem(k) },
  }
}

const neu = (x: Partial<NeuerEintrag> = {}): NeuerEintrag => ({
  id: 'abcdefghij01234', formular: 'patienten', maske: 'doku', orgCode: 'wache1', orgId: 'org1',
  absenderName: 'Anna Berg', angemeldetId: '', daten: { title: 'Patientendoku: Max Muster', payload: { name: 'Muster', unterschrift: 'Anna Berg' } },
  ...x,
})
const JETZT = new Date('2026-10-31T13:20:00.000Z')

describe('Warteschlange: kein Passwort auf dem Gerät', () => {
  it('ablegen entfernt passwort und password in jeder Tiefe, gleich welche Schreibweise', () => {
    const s = speicher()
    const e = neu({
      daten: { title: 't', payload: { passwort: 'geheim1', a: { password: 'geheim2', b: [{ Passwort: 'geheim3', c: 1 }] } }, absender: { name: 'Anna', PASSWORD: 'geheim4' } },
      alt: { payload: { passwort: 'geheim5' } },
    } as Partial<NeuerEintrag>)
    ;(e as Record<string, unknown>).passwort = 'geheim6'
    expect(ablegen(s, e, JETZT)).toBe(true)
    const roh = s.getItem(SCHLUESSEL_PREFIX + 'wache1')!
    expect(roh).not.toMatch(/geheim/)
    expect(roh.toLowerCase()).not.toMatch(/passwor[dt]/)
    expect(eintraege(s, 'wache1')[0].daten).toEqual({ title: 't', payload: { a: { b: [{ c: 1 }] } }, absender: { name: 'Anna' } })
  })

  it('aktualisieren entfernt es ebenso', () => {
    const s = speicher()
    ablegen(s, neu(), JETZT)
    aktualisieren(s, 'wache1', 'abcdefghij01234', (e) => ({ ...e, daten: { ...e.daten, passwort: 'geheim' } }))
    expect(s.getItem(SCHLUESSEL_PREFIX + 'wache1')).not.toMatch(/geheim/)
  })

  it('ohnePasswort ändert das Original nicht', () => {
    const o = { a: { passwort: 'x' } }
    expect(ohnePasswort(o)).toEqual({ a: {} })
    expect(o.a.passwort).toBe('x')
  })
})

describe('Warteschlange: Ablegen und Lesen', () => {
  it('setzt v, versuche und angelegt; Kennung bleibt', () => {
    const s = speicher()
    expect(ablegen(s, neu(), JETZT)).toBe(true)
    const [e] = eintraege(s, 'wache1')
    expect(e).toMatchObject({ v: 2, id: 'abcdefghij01234', versuche: 0, angelegt: JETZT.toISOString(), absenderName: 'Anna Berg' })
  })

  it('gleiche Kennung ersetzt den Eintrag (Ablage und angelegt bleiben)', () => {
    const s = speicher()
    ablegen(s, neu(), JETZT)
    ablegen(s, neu({ id: 'zzzzzzzzzzzzzzz' }), JETZT)
    ablegen(s, neu({ absenderName: 'Anna Maria Berg' }), new Date(JETZT.getTime() + 60_000))
    const l = eintraege(s, 'wache1')
    expect(l.map((e) => e.id)).toEqual(['abcdefghij01234', 'zzzzzzzzzzzzzzz'])
    expect(l[0].absenderName).toBe('Anna Maria Berg')
    expect(l[0].angelegt).toBe(JETZT.toISOString())
  })

  it('je Organisation getrennt', () => {
    const s = speicher()
    ablegen(s, neu(), JETZT)
    ablegen(s, neu({ orgCode: 'wache2', id: 'bbbbbbbbbbbbbbb' }), JETZT)
    expect(eintraege(s, 'wache1').map((e) => e.id)).toEqual(['abcdefghij01234'])
    expect(eintraege(s, 'wache2').map((e) => e.id)).toEqual(['bbbbbbbbbbbbbbb'])
  })

  it('ungültige Kennung wird nicht abgelegt', () => {
    const s = speicher()
    expect(ablegen(s, neu({ id: 'ABC' }), JETZT)).toBe(false)
    expect(eintraege(s, 'wache1')).toEqual([])
  })

  it('Kaputtes wird überlesen', () => {
    const gut = { ...neu(), v: 2, versuche: 0, angelegt: JETZT.toISOString() }
    const s = speicher({ [SCHLUESSEL_PREFIX + 'wache1']: JSON.stringify([null, 7, { v: 1 }, { ...gut, id: 'x' }, gut, { ...gut, id: 'ccccccccccccccc', formular: 'cirs' }]) })
    expect(eintraege(s, 'wache1').map((e) => e.id)).toEqual(['abcdefghij01234'])
    const kaputt = speicher({ [SCHLUESSEL_PREFIX + 'wache1']: '{kaputt' })
    expect(eintraege(kaputt, 'wache1')).toEqual([])
    // Ablegen überschreibt die unlesbare Zeile lieber, als das neue Protokoll zu verlieren
    expect(ablegen(kaputt, neu(), JETZT)).toBe(true)
    expect(eintraege(kaputt, 'wache1')).toHaveLength(1)
  })

  it('Speicher wirft: ablegen false, Lesen []', () => {
    expect(ablegen(werfend('alles'), neu(), JETZT)).toBe(false)
    expect(eintraege(werfend('alles'), 'wache1')).toEqual([])
    expect(ablegen(werfend('schreiben'), neu(), JETZT)).toBe(false)
    expect(aktualisieren(werfend('alles'), 'wache1', 'abcdefghij01234', (e) => e)).toBe(false)
    expect(entfernen(werfend('alles'), 'wache1', 'abcdefghij01234')).toBe(false)
  })

  it('aktualisieren und entfernen', () => {
    const s = speicher()
    ablegen(s, neu(), JETZT)
    ablegen(s, neu({ id: 'zzzzzzzzzzzzzzz' }), JETZT)
    expect(aktualisieren(s, 'wache1', 'zzzzzzzzzzzzzzz', (e) => ({ ...e, absenderName: 'Jörg Müller', nameEindeutig: true, versuche: e.versuche + 1 }))).toBe(true)
    expect(eintraege(s, 'wache1')[1]).toMatchObject({ absenderName: 'Jörg Müller', nameEindeutig: true, versuche: 1 })
    // Kennung wechseln (nach 409 kennung)
    aktualisieren(s, 'wache1', 'zzzzzzzzzzzzzzz', (e) => ({ ...e, id: 'yyyyyyyyyyyyyyy' }))
    expect(eintraege(s, 'wache1').map((e) => e.id)).toEqual(['abcdefghij01234', 'yyyyyyyyyyyyyyy'])
    // Unbekannte Kennung: nichts
    expect(aktualisieren(s, 'wache1', 'nnnnnnnnnnnnnnn', (e) => e)).toBe(false)
    // Ungültiges Ergebnis wird nicht gespeichert
    expect(aktualisieren(s, 'wache1', 'abcdefghij01234', (e) => ({ ...e, id: 'X' }))).toBe(false)
    expect(eintraege(s, 'wache1').map((e) => e.id)).toEqual(['abcdefghij01234', 'yyyyyyyyyyyyyyy'])
    entfernen(s, 'wache1', 'abcdefghij01234')
    expect(eintraege(s, 'wache1').map((e) => e.id)).toEqual(['yyyyyyyyyyyyyyy'])
    entfernen(s, 'wache1', 'yyyyyyyyyyyyyyy')
    expect(s.getItem(SCHLUESSEL_PREFIX + 'wache1')).toBeNull()
  })
})

describe('Warteschlange: Übernahme aus offline_queue_<org>', () => {
  const doku = { type: 'full', title: 'Patientendoku: Max Muster', payload: { name: 'Muster', unterschrift: 'Anna Berg', abgesendet: '2026-10-30T08:00:00.000Z', frist: '2026-10-31T08:00:00.000Z' }, status: 'offen', organization_id: 'org1' }
  const alt = { type: 'full', title: 'Patientendoku: Eva Alt', payload: { name: 'Alt', ausfueller_name: 'Jörg Müller' }, status: 'offen', organization_id: 'org1', draftId: null }
  const schnell = { type: 'full', title: 'Schnelldoku: Paul', payload: { schnelldoku: true, ausfueller_name: 'Lena Schnell' }, status: 'offen', organization_id: 'org1' }
  const entwurf = { type: 'draft', payload: { mannschaft: {} }, status: 'offen', organization_id: 'org1' }

  it('type full wird übernommen (doku, alt, schnell, mit uebernommen), draft verworfen', () => {
    const s = speicher({ offline_queue_wache1: JSON.stringify([doku, alt, entwurf, schnell, { type: 'full' }]) })
    const l = eintraege(s, 'wache1')
    expect(l.map((e) => [e.maske, e.absenderName, e.uebernommen, e.orgId, e.angemeldetId, e.formular])).toEqual([
      ['doku', 'Anna Berg', true, 'org1', '', 'patienten'],
      ['alt', 'Jörg Müller', true, 'org1', '', 'patienten'],
      ['schnell', 'Lena Schnell', true, 'org1', '', 'patienten'],
    ])
    expect(l[0].daten).toEqual({ title: doku.title, payload: doku.payload })
    expect(l[0].angelegt).toBe('2026-10-30T08:00:00.000Z')
    expect(l.every((e) => /^[a-z0-9]{15}$/.test(e.id))).toBe(true)
    expect(new Set(l.map((e) => e.id)).size).toBe(3)
    expect(s.getItem('offline_queue_wache1')).toBeNull()
  })

  it('die ohne Netz gespeicherte Besatzung der alten Maske (draft) geht als Namen in das Protokoll danach', () => {
    const besatzung = { type: 'draft', payload: { mannschaft: { tf: { id: 'u1', name: 'Tom Teamführer' }, m1: { id: 'u2', name: 'Anna Berg' }, m2: null } }, status: 'offen', organization_id: 'org1' }
    const altOhne = { ...alt, payload: { name: 'Alt', ausfueller_name: 'Jörg Müller', mannschaft: {} } }
    const s = speicher({ offline_queue_wache1: JSON.stringify([besatzung, altOhne, doku]) })
    const l = eintraege(s, 'wache1')
    expect(l).toHaveLength(2)
    const p0 = l[0].daten.payload as Record<string, unknown>
    // nur Namen, nie Kennungen aus dem Gerät
    expect(p0).toMatchObject({ mannschaft_tf: 'Tom Teamführer', mannschaft_1: 'Anna Berg' })
    expect(p0.mannschaft_2).toBeUndefined()
    expect(JSON.stringify(p0)).not.toContain('u1')
    // das zweite Protokoll bekommt die Besatzung nicht noch einmal
    expect((l[1].daten.payload as Record<string, unknown>).mannschaft_tf).toBeUndefined()
    // die Kennung hängt nur am Protokoll selbst: gleich wie ohne draft
    expect(l[0].id).toBe(kennungAusInhalt('wache1', altOhne))
    // ein Protokoll mit eigener Besatzung behält sie
    const mit = { ...alt, title: 'Patientendoku: Mit', payload: { name: 'Mit', mannschaft_tf: 'Eigene Leitung' } }
    const s2 = speicher({ offline_queue_wache1: JSON.stringify([besatzung, mit]) })
    expect((eintraege(s2, 'wache1')[0].daten.payload as Record<string, unknown>).mannschaft_tf).toBe('Eigene Leitung')
    // ein draft ohne folgendes Protokoll trägt nur Namen und wird verworfen
    const s3 = speicher({ offline_queue_wache1: JSON.stringify([doku, besatzung]) })
    const l3 = eintraege(s3, 'wache1')
    expect(l3).toHaveLength(1)
    expect((l3[0].daten.payload as Record<string, unknown>).mannschaft_tf).toBeUndefined()
    expect(s3.getItem('offline_queue_wache1')).toBeNull()
  })

  it('erst neu schreiben, dann den alten Schlüssel löschen', () => {
    const s = speicher({ offline_queue_wache1: JSON.stringify([doku]) })
    eintraege(s, 'wache1')
    expect(s.log).toEqual([`set ${SCHLUESSEL_PREFIX}wache1`, 'remove offline_queue_wache1'])
  })

  it('scheitert das Schreiben, bleibt die alte Schlange und nichts wird gemeldet', () => {
    const s = werfend('schreiben')
    s.d.set('offline_queue_wache1', JSON.stringify([doku]))
    expect(eintraege(s, 'wache1')).toEqual([])
    expect(s.d.get('offline_queue_wache1')).toBe(JSON.stringify([doku]))
  })

  it('zweimal übernehmen ergibt dieselbe Kennung, kein Doppel', () => {
    expect(kennungAusInhalt('wache1', doku)).toBe(kennungAusInhalt('wache1', JSON.parse(JSON.stringify(doku))))
    expect(kennungAusInhalt('wache1', doku)).not.toBe(kennungAusInhalt('wache2', doku))
    expect(kennungAusInhalt('wache1', doku)).not.toBe(kennungAusInhalt('wache1', { ...doku, title: 'anders' }))
    // Löschen des alten Schlüssels scheitert: beim nächsten Lesen wieder da, aber dieselbe Kennung
    const s = speicher({ offline_queue_wache1: JSON.stringify([doku]) })
    const gesperrt = { ...s, get length() { return s.length }, removeItem: () => { throw new Error('gesperrt') } }
    const erst = eintraege(gesperrt, 'wache1')
    const dann = eintraege(gesperrt, 'wache1')
    expect(dann.map((e) => e.id)).toEqual(erst.map((e) => e.id))
    expect(dann).toHaveLength(1)
  })

  it('neue Einträge bleiben vorn, Übernommenes kommt dazu', () => {
    const s = speicher()
    ablegen(s, neu(), JETZT)
    s.setItem('offline_queue_wache1', JSON.stringify([doku]))
    expect(eintraege(s, 'wache1').map((e) => e.uebernommen ?? false)).toEqual([false, true])
  })

  it('alterEintrag: nur type full mit title und organization_id', () => {
    expect(alterEintrag('wache1', entwurf)).toBeNull()
    expect(alterEintrag('wache1', { type: 'full', title: 'x' })).toBeNull()
    expect(alterEintrag('wache1', { ...doku, payload: 'kaputt' })?.daten).toEqual({ title: doku.title, payload: {} })
  })
})

describe('Warteschlange: anzahlAlle', () => {
  it('zählt neue und alte Schlange über alle Organisationen, Übernommenes einmal', () => {
    const s = speicher()
    ablegen(s, neu(), JETZT)
    ablegen(s, neu({ id: 'zzzzzzzzzzzzzzz' }), JETZT)
    ablegen(s, neu({ orgCode: 'wache2', id: 'bbbbbbbbbbbbbbb' }), JETZT)
    const full = { type: 'full', title: 'Patientendoku: X', payload: {}, status: 'offen', organization_id: 'o3' }
    s.setItem('offline_queue_wache3', JSON.stringify([full, { type: 'draft', payload: {} }, { ...full, title: 'Y' }]))
    s.setItem('anderer_schluessel', '[1,2,3]')
    expect(anzahlAlle(s)).toBe(5)
    // Übernehmen ändert die Zahl nicht
    eintraege(s, 'wache3')
    expect(anzahlAlle(s)).toBe(5)
  })

  it('schon übernommen, alter Schlüssel noch da: einmal gezählt', () => {
    const full = { type: 'full', title: 'Patientendoku: X', payload: {}, status: 'offen', organization_id: 'o1' }
    const s = speicher({ offline_queue_wache1: JSON.stringify([full]) })
    const gesperrt = { ...s, get length() { return s.length }, removeItem: () => { throw new Error('gesperrt') } }
    eintraege(gesperrt, 'wache1')
    expect(s.d.has('offline_queue_wache1')).toBe(true)
    expect(anzahlAlle(s)).toBe(1)
  })

  it('Kaputtes zählt nicht, wirft nicht', () => {
    const s = speicher({ [SCHLUESSEL_PREFIX + 'wache1']: '{kaputt', offline_queue_wache1: 'null' })
    expect(anzahlAlle(s)).toBe(0)
    expect(anzahlAlle({ get length(): number { throw new Error('x') }, key: () => null, getItem: () => null })).toBe(0)
  })
})

describe('Warteschlange: eigene Formulare (Plan Vorgänge 5.3)', () => {
  const V = 'vvvvvvvvvvvvvv1'
  const eig = (x: Partial<NeuerEintrag> = {}): NeuerEintrag => neu({ formular: 'eigen', maske: undefined, vorlage: V, modus: 'frei', titel: 'Fahrzeugcheck', daten: { version: 1, werte: { f_aaaaaaaa: 'RTW 1' } }, ...x })

  it('mit gültiger Vorlage abgelegt und gelesen', () => {
    const s = speicher()
    expect(ablegen(s, eig(), JETZT)).toBe(true)
    expect(ablegen(s, eig({ id: 'zzzzzzzzzzzzzzz', modus: 'anonym', absenderName: '' }), JETZT)).toBe(true)
    const l = eintraege(s, 'wache1')
    expect(l.map((e) => [e.formular, e.vorlage, e.modus, e.titel])).toEqual([['eigen', V, 'frei', 'Fahrzeugcheck'], ['eigen', V, 'anonym', 'Fahrzeugcheck']])
    expect(anzahlAlle(s)).toBe(2)
  })

  it('ohne oder mit falscher Vorlage, unbekanntem Modus: nicht abgelegt', () => {
    const s = speicher()
    expect(ablegen(s, eig({ vorlage: undefined }), JETZT)).toBe(false)
    expect(ablegen(s, eig({ vorlage: 'kurz' }), JETZT)).toBe(false)
    expect(ablegen(s, eig({ modus: 'offen' as never }), JETZT)).toBe(false)
    expect(ablegen(s, eig({ titel: 7 as never }), JETZT)).toBe(false)
    expect(ablegen(s, neu({ formular: 'cirs' as never }), JETZT)).toBe(false)
    expect(s.d.size).toBe(0)
  })
})
