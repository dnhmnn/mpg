import { describe, it, expect } from 'vitest'
import {
  HUB_APPS_MAX, ausAlterListe, befristetBis, befristeteApps, erlaubteApps, hubKacheln, istFest, reihenfolgeAlle,
  umschalten, verschieben, wahlGleich, wahlLesen, wahlQuelle, wahlStandard, type HubAppsWahl,
} from '../hubApps'
import { ALL_APPS } from '../apps'
import type { User } from '../../types'

const JETZT = Date.parse('2026-11-14T10:00:00Z')
const SPAETER_PB = '2026-11-16 17:00:00.000Z'
const SPAETER_ISO = '2026-11-16T17:00:00.000Z'
const FRUEHER = '2026-11-13 08:00:00.000Z'

const nutzer = (u: Partial<User>): User => ({ id: 'u1', email: 'anna@example.test', ...u })
const grund = { dashboard: true, lernbar: true, chat: true, notizen: true }

describe('wahlLesen', () => {
  it('nichts Gespeichertes ergibt null', () => {
    for (const roh of [null, undefined, '', '  ', 'null', 42, true, '[1,2]', ['mpg'], 'kaputt{']) expect(wahlLesen(roh), String(roh)).toBeNull()
  })
  it('liest Objekt und JSON-Text', () => {
    expect(wahlLesen({ ausgeblendet: ['chat'], reihenfolge: ['mpg', 'lager'] })).toEqual({ ausgeblendet: ['chat'], reihenfolge: ['mpg', 'lager'] })
    expect(wahlLesen('{"ausgeblendet":["chat"],"reihenfolge":["mpg"]}')).toEqual({ ausgeblendet: ['chat'], reihenfolge: ['mpg'] })
    expect(wahlLesen({})).toEqual({ ausgeblendet: [], reihenfolge: [] })
  })
  it('räumt auf: kein Array, Nicht-Texte, Dubletten, zu lang, zu viele', () => {
    expect(wahlLesen({ ausgeblendet: 'chat', reihenfolge: { a: 1 } })).toEqual({ ausgeblendet: [], reihenfolge: [] })
    expect(wahlLesen({ ausgeblendet: ['chat', 3, null, '', 'chat', { x: 1 }], reihenfolge: ['mpg', 'mpg', 'lager'] }))
      .toEqual({ ausgeblendet: ['chat'], reihenfolge: ['mpg', 'lager'] })
    const lang = 'x'.repeat(41)
    expect(wahlLesen({ ausgeblendet: [lang, 'x'.repeat(40)], reihenfolge: [] })?.ausgeblendet).toEqual(['x'.repeat(40)])
    const viele = Array.from({ length: 80 }, (_, i) => `app${i}`)
    const w = wahlLesen({ ausgeblendet: viele, reihenfolge: viele })!
    expect(w.ausgeblendet).toHaveLength(HUB_APPS_MAX)
    expect(w.reihenfolge).toHaveLength(HUB_APPS_MAX)
    expect(w.reihenfolge[0]).toBe('app0')
  })
  it('Rundreise über JSON bleibt gleich', () => {
    const w: HubAppsWahl = { ausgeblendet: ['chat', 'neueapp'], reihenfolge: ['mpg', 'lager', 'settings'] }
    expect(wahlGleich(wahlLesen(JSON.stringify(w)), w)).toBe(true)
  })
})

describe('ausAlterListe (alter Hub: sichtbare Liste)', () => {
  it('übernimmt nur die Reihenfolge', () => {
    expect(ausAlterListe('["mpg","lager","settings"]')).toEqual({ ausgeblendet: [], reihenfolge: ['mpg', 'lager', 'settings'] })
  })
  it('kaputt, kein Array, leer → null', () => {
    for (const roh of ['["mpg"', '{"a":1}', '[]', '', null, undefined, 7, '[1,2]']) expect(ausAlterListe(roh), String(roh)).toBeNull()
  })
})

describe('wahlQuelle', () => {
  const konto = { ausgeblendet: ['chat'], reihenfolge: ['mpg'] }
  const lokal = JSON.stringify({ ausgeblendet: ['notizen'], reihenfolge: ['lager'] })
  const alt = '["dateien","mpg"]'
  it('Feld da mit Wert: das Konto gilt und gewinnt über das Gerät', () => {
    expect(wahlQuelle({ feldDa: true, server: konto, lokal, alt })).toEqual({ wahl: konto, quelle: 'konto', insKonto: false })
    expect(wahlQuelle({ feldDa: true, server: konto, lokal, alt, offen: false })).toEqual({ wahl: konto, quelle: 'konto', insKonto: false })
  })
  it('nicht gespeicherte Änderung auf dem Gerät (ohne Netz): gilt vor dem Konto und wird ins Konto geschrieben', () => {
    expect(wahlQuelle({ feldDa: true, server: konto, lokal, alt, offen: true }))
      .toEqual({ wahl: { ausgeblendet: ['notizen'], reihenfolge: ['lager'] }, quelle: 'geraet', insKonto: true })
    // Auch wenn das Konto noch leer ist
    expect(wahlQuelle({ feldDa: true, server: null, lokal, alt, offen: true })).toMatchObject({ quelle: 'geraet', insKonto: true })
  })
  it('gekennzeichnet, aber auf dem Gerät nichts Lesbares: das Konto gilt', () => {
    expect(wahlQuelle({ feldDa: true, server: konto, lokal: 'kaputt{', alt, offen: true })).toEqual({ wahl: konto, quelle: 'konto', insKonto: false })
    expect(wahlQuelle({ feldDa: true, server: konto, lokal: null, alt, offen: true })).toEqual({ wahl: konto, quelle: 'konto', insKonto: false })
  })
  it('Feld fehlt, gekennzeichnet: Gerät, nichts ins Konto', () => {
    expect(wahlQuelle({ feldDa: false, server: undefined, lokal, alt, offen: true })).toMatchObject({ quelle: 'geraet', insKonto: false })
  })
  it('Feld da, leer: Gerät (neue Form) wird übernommen', () => {
    expect(wahlQuelle({ feldDa: true, server: null, lokal, alt })).toEqual({ wahl: { ausgeblendet: ['notizen'], reihenfolge: ['lager'] }, quelle: 'geraet', insKonto: true })
  })
  it('Feld da, leer, nur alte Liste: alte Reihenfolge wird übernommen', () => {
    expect(wahlQuelle({ feldDa: true, server: '', lokal: null, alt })).toEqual({ wahl: { ausgeblendet: [], reihenfolge: ['dateien', 'mpg'] }, quelle: 'alt', insKonto: true })
  })
  it('Feld fehlt: Gerät, sonst alte Liste, nichts ins Konto', () => {
    expect(wahlQuelle({ feldDa: false, server: konto, lokal, alt })).toMatchObject({ quelle: 'geraet', insKonto: false })
    expect(wahlQuelle({ feldDa: false, server: undefined, lokal: null, alt })).toMatchObject({ quelle: 'alt', insKonto: false })
  })
  it('nichts gespeichert: Standard', () => {
    expect(wahlQuelle({ feldDa: true, server: null, lokal: null, alt: null })).toEqual({ wahl: null, quelle: 'standard', insKonto: false })
    expect(wahlQuelle({ feldDa: false, server: undefined, lokal: 'kaputt', alt: '[]' })).toEqual({ wahl: null, quelle: 'standard', insKonto: false })
  })
})

describe('erlaubteApps und befristeteApps', () => {
  it('Grundrechte: Unitas, MPG, Chat, Notizen, Einstellungen in ALL_APPS-Reihenfolge', () => {
    expect(erlaubteApps(nutzer({ permissions: grund }), JETZT)).toEqual(['lernbar', 'mpg', 'chat', 'notizen', 'settings'])
  })
  it('Supervisor alles; Leitung hat die Benutzerverwaltung auch ohne Häkchen', () => {
    expect(erlaubteApps(nutzer({ supervisor: true }), JETZT)).toEqual(Object.keys(ALL_APPS))
    expect(erlaubteApps(nutzer({ role: 'admin', permissions: {} }), JETZT)).toEqual(['unitarii'])
    expect(erlaubteApps(null, JETZT)).toEqual([])
  })
  it('gesperrtes Modul erscheint nicht', () => {
    const org = { id: 'o', org_name: 'Wache Eins', freigeschaltet: ['lernbar'] }
    expect(erlaubteApps(nutzer({ permissions: { ...grund, patienten: true }, organization: org }), JETZT)).toEqual(['lernbar', 'settings'])
  })
  it('befristet: laufend drin, abgelaufen nicht, dauerhaft nicht, Supervisor keine', () => {
    const u = nutzer({ permissions: grund, temp_permissions: { patienten: { until: SPAETER_PB }, eks: { until: FRUEHER }, dashboard: { until: SPAETER_PB } } })
    expect(befristeteApps(u, JETZT)).toEqual(['patienten'])
    expect(erlaubteApps(u, JETZT)).toContain('patienten')
    expect(erlaubteApps(u, JETZT)).not.toContain('eks')
    expect(befristeteApps(nutzer({ supervisor: true, temp_permissions: { patienten: { until: SPAETER_PB } } }), JETZT)).toEqual([])
  })
  it('befristet: altes ISO-Format und PocketBase-Format', () => {
    expect(befristeteApps(nutzer({ temp_permissions: { patienten: { until: SPAETER_ISO } } }), JETZT)).toEqual(['patienten'])
    expect(befristeteApps(nutzer({ temp_permissions: { patienten: { until: SPAETER_PB } } }), JETZT)).toEqual(['patienten'])
    expect(befristetBis(nutzer({ temp_permissions: { patienten: { until: SPAETER_PB } } }), 'patienten')).toBe(Date.parse(SPAETER_ISO))
    expect(befristetBis(nutzer({}), 'patienten')).toBe(0)
  })
  it('befristet, aber Modul gesperrt: nicht drin', () => {
    const org = { id: 'o', org_name: 'Wache Eins', freigeschaltet: ['lernbar'] }
    expect(befristeteApps(nutzer({ organization: org, temp_permissions: { patienten: { until: SPAETER_PB } } }), JETZT)).toEqual([])
  })
})

describe('hubKacheln', () => {
  const erlaubt = ['lernbar', 'mpg', 'chat', 'notizen', 'settings']
  it('ohne Wahl: erlaubte in Standardreihenfolge', () => {
    expect(hubKacheln(null, erlaubt, [])).toEqual(erlaubt)
    expect(hubKacheln(wahlStandard(), erlaubt, [])).toEqual(erlaubt)
  })
  it('ausgeblendete fehlen, Reihenfolge gilt, der Rest dahinter', () => {
    expect(hubKacheln({ ausgeblendet: ['chat'], reihenfolge: ['settings', 'mpg'] }, erlaubt, [])).toEqual(['settings', 'mpg', 'lernbar', 'notizen'])
  })
  it('unbekannte und nicht erlaubte IDs erscheinen nie', () => {
    expect(hubKacheln({ ausgeblendet: [], reihenfolge: ['gibtsnicht', 'patienten', 'mpg'] }, erlaubt, [])).toEqual(['mpg', 'lernbar', 'chat', 'notizen', 'settings'])
  })
  it('neu erlaubte App steht hinter den geordneten und ist nicht ausgeblendet', () => {
    const wahl = { ausgeblendet: ['chat'], reihenfolge: ['settings', 'notizen', 'mpg', 'lernbar', 'chat'] }
    expect(hubKacheln(wahl, ['eks', ...erlaubt], [])).toEqual(['settings', 'notizen', 'mpg', 'lernbar', 'eks'])
  })
  it('befristete und Einstellungen erscheinen auch, wenn sie ausgeblendet sind', () => {
    const wahl = { ausgeblendet: ['settings', 'patienten', 'chat'], reihenfolge: [] }
    expect(hubKacheln(wahl, ['patienten', ...erlaubt], ['patienten'])).toEqual(['patienten', 'lernbar', 'mpg', 'notizen', 'settings'])
    expect(istFest('settings', [])).toBe(true)
    expect(istFest('patienten', ['patienten'])).toBe(true)
    expect(istFest('chat', ['patienten'])).toBe(false)
  })
  it('Einstellungen nur, wenn erlaubt', () => {
    expect(hubKacheln(null, ['lernbar'], [])).toEqual(['lernbar'])
  })
})

describe('verschieben', () => {
  const erlaubt = ['lernbar', 'mpg', 'chat', 'notizen', 'settings']
  it('hoch und runter tauschen mit dem Nachbarn', () => {
    expect(verschieben(null, erlaubt, 'mpg', -1).reihenfolge).toEqual(['mpg', 'lernbar', 'chat', 'notizen', 'settings'])
    expect(verschieben(null, erlaubt, 'mpg', 1).reihenfolge).toEqual(['lernbar', 'chat', 'mpg', 'notizen', 'settings'])
  })
  it('am Rand unverändert', () => {
    const w = { ausgeblendet: ['chat'], reihenfolge: ['mpg'] }
    expect(verschieben(w, erlaubt, 'mpg', -1)).toEqual(w)
    expect(verschieben(null, erlaubt, 'settings', 1)).toEqual(wahlStandard())
    expect(verschieben(w, erlaubt, 'gibtsnicht', 1)).toEqual(w)
  })
  it('über ausgeblendete hinweg (volle Liste), ausgeblendete bleiben', () => {
    const w = { ausgeblendet: ['chat'], reihenfolge: [] }
    const neu = verschieben(w, erlaubt, 'notizen', -1)
    expect(neu).toEqual({ ausgeblendet: ['chat'], reihenfolge: ['lernbar', 'mpg', 'notizen', 'chat', 'settings'] })
    expect(hubKacheln(neu, erlaubt, [])).toEqual(['lernbar', 'mpg', 'notizen', 'settings'])
  })
  it('unbekannte alte Einträge bleiben hinten erhalten, höchstens 50', () => {
    const w = { ausgeblendet: [], reihenfolge: ['neueapp', 'mpg', 'patienten'] }
    expect(verschieben(w, erlaubt, 'lernbar', -1).reihenfolge).toEqual(['lernbar', 'mpg', 'chat', 'notizen', 'settings', 'neueapp', 'patienten'])
    const viele = { ausgeblendet: [], reihenfolge: Array.from({ length: 50 }, (_, i) => `alt${i}`) }
    expect(verschieben(viele, erlaubt, 'mpg', 1).reihenfolge).toHaveLength(HUB_APPS_MAX)
  })
  it('liefert eine neue Wahl, die alte bleibt unberührt', () => {
    const w = { ausgeblendet: [], reihenfolge: ['chat'] }
    verschieben(w, erlaubt, 'chat', 1)
    expect(w).toEqual({ ausgeblendet: [], reihenfolge: ['chat'] })
  })
})

describe('umschalten', () => {
  it('aus blendet aus, an zeigt wieder', () => {
    const aus = umschalten(null, 'chat', false, [])
    expect(aus).toEqual({ ausgeblendet: ['chat'], reihenfolge: [] })
    expect(umschalten(aus, 'chat', true, [])).toEqual({ ausgeblendet: [], reihenfolge: [] })
    expect(umschalten(aus, 'chat', false, [])).toEqual(aus)
  })
  it('Einstellungen und befristete lassen sich nicht ausblenden', () => {
    expect(umschalten(null, 'settings', false, [])).toEqual(wahlStandard())
    expect(umschalten({ ausgeblendet: [], reihenfolge: ['mpg'] }, 'patienten', false, ['patienten'])).toEqual({ ausgeblendet: [], reihenfolge: ['mpg'] })
  })
  it('fremde IDs in ausgeblendet bleiben', () => {
    expect(umschalten({ ausgeblendet: ['neueapp'], reihenfolge: [] }, 'chat', false, [])).toEqual({ ausgeblendet: ['neueapp', 'chat'], reihenfolge: [] })
    expect(umschalten({ ausgeblendet: ['neueapp', 'chat'], reihenfolge: [] }, 'chat', true, [])).toEqual({ ausgeblendet: ['neueapp'], reihenfolge: [] })
  })
  it('höchstens 50', () => {
    const voll = { ausgeblendet: Array.from({ length: 50 }, (_, i) => `alt${i}`), reihenfolge: [] }
    const neu = umschalten(voll, 'chat', false, [])
    expect(neu.ausgeblendet).toHaveLength(HUB_APPS_MAX)
    expect(neu.ausgeblendet).toContain('chat')
  })
})

describe('wahlGleich und reihenfolgeAlle', () => {
  it('vergleicht Inhalt und Reihenfolge', () => {
    expect(wahlGleich(null, null)).toBe(true)
    expect(wahlGleich(null, wahlStandard())).toBe(false)
    expect(wahlGleich({ ausgeblendet: ['a'], reihenfolge: ['b', 'c'] }, { ausgeblendet: ['a'], reihenfolge: ['b', 'c'] })).toBe(true)
    expect(wahlGleich({ ausgeblendet: [], reihenfolge: ['b', 'c'] }, { ausgeblendet: [], reihenfolge: ['c', 'b'] })).toBe(false)
  })
  it('reihenfolgeAlle zeigt auch ausgeblendete', () => {
    expect(reihenfolgeAlle({ ausgeblendet: ['chat'], reihenfolge: ['chat'] }, ['mpg', 'chat'])).toEqual(['chat', 'mpg'])
  })
})
