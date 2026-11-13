// Patientendoku fest (Bauplan Vorgänge, PO 2, B1, 4.5): Werte früherer eigener
// Felder bleiben sichtbar, Bearbeiten behält sie, keine Maske liest mehr die
// Feld-Einstellungen aus form_config.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALTFELDER_TITEL, ALTFELD_OHNE_NAME, altfelder, altfelderHtml, frueherEigeneFelder, mitAltfeldern,
} from '../patientenAltfelder'
import { payloadZusammenfuehren } from '../payloadZusammenfuehren'
import { datensatz } from '../../pages/public/doku/absenden'
import { besatzungSetzen } from '../../pages/public/doku/besatzung'

const CFG = {
  hidden_sections: ['zeitstrahl'],
  hidden_fields: ['rufname'],
  required_fields: ['einsatz_art'],
  custom_fields: [
    { id: 'custom_1700000000002', sectionId: 'einsatzdaten', label: 'Wachbezirk', fieldType: 'select', options: ['Nord', 'Süd'] },
    { id: 'custom_1700000000001', sectionId: 'uebergabe', label: 'Desinfektion erfolgt', fieldType: 'checkbox' },
    { id: 'custom_1700000000003', sectionId: 'anamnese', label: 'Termin Nachsorge', fieldType: 'date' },
    { id: 'custom_1700000000004', sectionId: 'messwerte', label: 'Körpergewicht', fieldType: 'number' },
  ],
}

describe('Werte früherer eigener Felder', () => {
  it('mit Bezeichnung aus custom_fields, in deren Reihenfolge; Ja, Datum, Zahl', () => {
    const p = {
      name: 'Muster', vorname: 'Max',
      custom_1700000000001: true,
      custom_1700000000002: 'Nord',
      custom_1700000000003: '2026-11-07',
      custom_1700000000004: 82.5,
    }
    expect(altfelder(p, CFG)).toEqual([
      { id: 'custom_1700000000002', label: 'Wachbezirk', wert: 'Nord' },
      { id: 'custom_1700000000001', label: 'Desinfektion erfolgt', wert: 'Ja' },
      { id: 'custom_1700000000003', label: 'Termin Nachsorge', wert: '07.11.2026' },
      { id: 'custom_1700000000004', label: 'Körpergewicht', wert: '82,5' },
    ])
  })

  it('ohne Beschreibung „Eigenes Feld“, nach Nummer, nach den beschriebenen', () => {
    const p = { custom_30: 'drei', custom_1700000000002: 'Süd', custom_4: 'vier', custom_x: 'kein Treffer', customer: 'nein' }
    expect(altfelder(p, CFG)).toEqual([
      { id: 'custom_1700000000002', label: 'Wachbezirk', wert: 'Süd' },
      { id: 'custom_4', label: ALTFELD_OHNE_NAME, wert: 'vier' },
      { id: 'custom_30', label: ALTFELD_OHNE_NAME, wert: 'drei' },
    ])
    // Ganz ohne form_config: alle unter „Eigenes Feld“
    expect(altfelder({ custom_1700000000001: 'x' }).map((f) => f.label)).toEqual([ALTFELD_OHNE_NAME])
  })

  it('leer, false, null, Leerzeichen und nicht angehakte Häkchen fallen weg', () => {
    const p = {
      custom_1700000000001: false, custom_1700000000002: '', custom_1700000000003: '   ',
      custom_1700000000004: null, custom_5: undefined, custom_6: 'false', custom_7: [],
    }
    expect(altfelder(p, CFG)).toEqual([{ id: 'custom_6', label: ALTFELD_OHNE_NAME, wert: 'false' }])
    expect(altfelder({ custom_1700000000001: 'false' }, CFG)).toEqual([])
    expect(altfelder({ custom_1700000000001: 'on' }, CFG)[0].wert).toBe('Ja')
  })

  it('Kennungen aus custom_fields zählen auch ohne die Form custom_<Zahl>', () => {
    const cfg = { custom_fields: [{ id: 'f_alt', label: 'Altes Feld', fieldType: 'text' }] }
    expect(altfelder({ f_alt: 'Wert', g_alt: 'nicht' }, cfg)).toEqual([{ id: 'f_alt', label: 'Altes Feld', wert: 'Wert' }])
  })

  it('payload und form_config als Text oder doppelt kodiert; Kaputtes ergibt nichts', () => {
    const p = { custom_1700000000002: 'Nord' }
    expect(altfelder(JSON.stringify(p), JSON.stringify(CFG))[0].label).toBe('Wachbezirk')
    expect(altfelder(JSON.stringify(JSON.stringify(p)), JSON.stringify(JSON.stringify(CFG)))[0].label).toBe('Wachbezirk')
    expect(altfelder('{kaputt', CFG)).toEqual([])
    expect(altfelder(null, CFG)).toEqual([])
    expect(altfelder([1, 2], CFG)).toEqual([])
    expect(altfelder(p, '{kaputt')).toEqual([{ id: 'custom_1700000000002', label: ALTFELD_OHNE_NAME, wert: 'Nord' }])
    expect(altfelder(p, { custom_fields: 'nein' })[0].label).toBe(ALTFELD_OHNE_NAME)
    expect(altfelder(p, { custom_fields: [null, 3, { id: '' }, { label: 'ohne Kennung' }] })[0].label).toBe(ALTFELD_OHNE_NAME)
  })

  it('Listen mit Komma, höchstens 100 Werte', () => {
    expect(altfelder({ custom_1: ['a', ' ', 'b', true] })[0].wert).toBe('a, b, Ja')
    const viele: Record<string, string> = {}
    for (let i = 0; i < 150; i++) viele[`custom_${i}`] = `w${i}`
    expect(altfelder(viele)).toHaveLength(100)
  })

  it('zählt frühere eigene Felder ohne Doppel und Kaputtes', () => {
    expect(frueherEigeneFelder(CFG)).toBe(4)
    expect(frueherEigeneFelder({ custom_fields: [{ id: 'a' }, { id: 'a' }, { id: ' ' }, null] })).toBe(1)
    expect(frueherEigeneFelder(undefined)).toBe(0)
    expect(frueherEigeneFelder(JSON.stringify(CFG))).toBe(4)
  })
})

describe('Ausdruck der früheren eigenen Felder', () => {
  const liste = altfelder(
    { custom_1: `<img src=x onerror="alert(1)">`, custom_2: "Zeile 1\nZeile 2 & 'mehr'" },
    { custom_fields: [{ id: 'custom_1', label: '<b>Feld</b>', fieldType: 'text' }] },
  )

  it('jeder Text HTML-sicher, Titel, eigene Seite', () => {
    const h = altfelderHtml(liste)
    expect(h).toContain(ALTFELDER_TITEL)
    expect(h).toContain('&lt;b&gt;Feld&lt;/b&gt;')
    expect(h).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
    expect(h).toContain('Zeile 1\nZeile 2 &amp; &#39;mehr&#39;')
    expect(h).not.toContain('<img')
    expect(h).not.toContain('<b>Feld')
    expect(h).toContain('page-break-before:always')
  })

  it('ohne Werte kein Block, das Blatt bleibt unverändert', () => {
    expect(altfelderHtml([])).toBe('')
    const blatt = '<html><body><p>Bogen</p></body></html>'
    expect(mitAltfeldern(blatt, [])).toBe(blatt)
  })

  it('der Block steht vor dem letzten </body>; ohne </body> am Ende', () => {
    const blatt = '<html><body><p>Bogen</p><script>"</body>"</script></body></html>'
    const mit = mitAltfeldern(blatt, liste, { klein: true })
    expect(mit.startsWith('<html><body><p>Bogen</p><script>"</body>"</script><section')).toBe(true)
    expect(mit.endsWith('</section></body></html>')).toBe(true)
    expect(mit).toContain('font-size:6.5pt')
    expect(mitAltfeldern('<p>ohne</p>', liste).startsWith('<p>ohne</p><section')).toBe(true)
  })
})

describe('Bearbeiten behält die Werte früherer eigener Felder', () => {
  const alt = { name: 'Muster', vorname: 'Max', custom_1700000000002: 'Nord', custom_1700000000001: true }

  it('Nachbearbeitung (ProtokollBearbeiten, alte Maske): was das Formular nicht zeigt, bleibt', () => {
    const neu = payloadZusammenfuehren(alt, { name: 'Muster-Neu', bemerkungen: 'nachgetragen' })
    expect(neu.custom_1700000000002).toBe('Nord')
    expect(neu.custom_1700000000001).toBe(true)
    expect(neu.name).toBe('Muster-Neu')
  })

  it('neue Maske: der Datensatz trägt alle geladenen Werte weiter', () => {
    const d = datensatz(alt, 'org1', new Date('2026-11-07T10:00:00Z'))
    expect(d.payload.custom_1700000000002).toBe('Nord')
    expect(d.payload.custom_1700000000001).toBe(true)
  })

  it('Besatzung setzen lässt die übrigen Werte stehen', () => {
    const w = besatzungSetzen(alt, 'tf', { id: 'u1', name: 'Ida Imker' })
    expect(w.custom_1700000000002).toBe('Nord')
  })
})

describe('Patientendoku fest: keine Maske liest die Feld-Einstellungen', () => {
  const wurzel = join(__dirname, '..', '..')
  const datei = (pfad: string) => readFileSync(join(wurzel, pfad), 'utf-8')
  const masken = [
    'pages/public/OrgPatienten.tsx',
    'pages/public/OrgSchnelldoku.tsx',
    'pages/public/OrgPatientenMannschaft.tsx',
    'pages/public/AelrdFelder.tsx',
    'pages/ProtokollMaske.tsx',
    'pages/ProtokollBearbeiten.tsx',
    'pages/patienten/PatientEditModal.tsx',
    ...readdirSync(join(wurzel, 'pages/public/doku'))
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .map((f) => `pages/public/doku/${f}`),
  ]

  it.each(masken)('%s', (pfad) => {
    const text = datei(pfad)
    for (const schluessel of ['hidden_sections', 'hidden_fields', 'required_fields', 'custom_fields']) {
      expect(text.includes(schluessel), `${pfad} nennt ${schluessel}`).toBe(false)
    }
  })

  it('die Vorgänge bieten für die Patientendoku keinen Feld-Editor', () => {
    const texte = ['pages/Vorgaenge.tsx', 'pages/vorgaenge/StandardSeite.tsx', 'pages/vorgaenge/FormulareReiter.tsx'].map(datei).join('\n')
    expect(texte).not.toMatch(/Protokoll-Felder|toggleSection|toggleRequired|addCustomField|custom_fields/)
  })
})
