import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ein nachgebildeter Server für organizations: getOne liest, update schreibt
const server = vi.hoisted(() => ({ form_config: null as unknown, getOne: [] as unknown[][], update: [] as unknown[][] }))
vi.mock('../pocketbase', () => ({
  pb: {
    collection: (name: string) => {
      if (name !== 'organizations') throw new Error('falsche Sammlung ' + name)
      return {
        getOne: async (...a: unknown[]) => { server.getOne.push(a); return { id: a[0], form_config: server.form_config } },
        update: async (...a: unknown[]) => { server.update.push(a); server.form_config = (a[1] as { form_config: unknown }).form_config; return {} },
      }
    },
  },
}))

const { formConfigLesen, formConfigAendern, absenderSetzen, standardSetzen } = await import('../formular/einstellung')
const { standardKonfig } = await import('../formular/felder')
const { DEFAULT_FORM_CONFIG } = await import('../../pages/public/formSchema')
const { absenderModus } = await import('../formular/absender')

beforeEach(() => { server.form_config = null; server.getOne = []; server.update = [] })

describe('form_config lesen', () => {
  const cfg = { hidden_forms: ['cirs'], hidden_fields: ['telefon'], hidden_sections: [], required_fields: ['einsatz_nr'], custom_fields: [], absender: { patienten: 'frei' }, eigener_schluessel: 7 }

  it('Objekt, Text, doppelt kodiert: gleich, unbekannte Schlüssel bleiben', () => {
    expect(formConfigLesen(cfg)).toEqual(cfg)
    expect(formConfigLesen(JSON.stringify(cfg))).toEqual(cfg)
    expect(formConfigLesen(JSON.stringify(JSON.stringify(cfg)))).toEqual(cfg)
  })

  it('kaputt, leer, keine Liste: Voreinstellung', () => {
    for (const roh of ['{kaputt', '', null, undefined, 7, [], 'null']) expect(formConfigLesen(roh)).toEqual(DEFAULT_FORM_CONFIG)
    expect(formConfigLesen({ hidden_forms: 'cirs' }).hidden_forms).toEqual([])
    // die Voreinstellung selbst wird nie verändert
    formConfigLesen(null).hidden_forms.push('x')
    expect(DEFAULT_FORM_CONFIG.hidden_forms).toEqual([])
  })
})

describe('form_config ändern, ohne zu überschreiben', () => {
  it('liest frisch (frisch=1, am Zwischenspeicher vorbei) und schreibt nur die Änderung auf den frischen Stand', async () => {
    // die Seite hat einen alten Stand; inzwischen hat jemand anderes hidden_forms geändert
    server.form_config = JSON.stringify({ hidden_forms: ['produktausgabe', 'patienten'], hidden_fields: ['telefon'], fremd: { a: 1 } })
    const neu = await formConfigAendern('org1', (c) => absenderSetzen(c, 'produktausgabe', 'passwort'))
    expect(server.getOne[0]).toEqual(['org1', { fields: 'form_config', query: { frisch: '1' }, requestKey: null }])
    expect(server.update).toHaveLength(1)
    expect(server.update[0][0]).toBe('org1')
    expect(neu).toEqual({ ...DEFAULT_FORM_CONFIG, hidden_forms: ['produktausgabe', 'patienten'], hidden_fields: ['telefon'], fremd: { a: 1 }, absender: { produktausgabe: 'passwort' } })
    expect(server.form_config).toEqual(neu)
    expect(absenderModus(server.form_config, 'produktausgabe')).toBe('passwort')
    expect(absenderModus(server.form_config, 'patienten')).toBe('passwort')
  })

  it('zweite Änderung baut auf der ersten auf; andere Formulare behalten ihren Modus', async () => {
    server.form_config = { absender: { patienten: 'frei' }, hidden_forms: [] }
    await formConfigAendern('org1', (c) => absenderSetzen(c, 'defektmeldung', 'passwort'))
    await formConfigAendern('org1', (c) => ({ ...c, hidden_forms: [...c.hidden_forms, 'cirs'] }))
    expect(server.form_config).toMatchObject({ absender: { patienten: 'frei', defektmeldung: 'passwort' }, hidden_forms: ['cirs'] })
  })

  it('die Änderung bekommt eine Kopie; Fehler gehen an den Aufrufer', async () => {
    const vorher = { hidden_forms: ['a'] }
    server.form_config = vorher
    await formConfigAendern('org1', (c) => { c.hidden_forms.push('b'); return c })
    expect(vorher.hidden_forms).toEqual(['a'])
    await expect(formConfigAendern('org1', () => { throw new Error('nein') })).rejects.toThrow('nein')
  })

  it('absenderSetzen: kaputtes absender wird ersetzt', () => {
    expect(absenderSetzen({ ...DEFAULT_FORM_CONFIG, absender: 'kaputt' as never }, 'patienten', 'frei').absender).toEqual({ patienten: 'frei' })
  })
})

describe('standardSetzen: Einstellung eines Standardformulars (Plan Vorgänge 1.2)', () => {
  const fahrzeug = { id: 'e_k3j9x0a1', typ: 'text' as const, label: 'Fahrzeug', pflicht: true }

  it('schreibt normalisiert nach formulare.<formular>; andere Formulare und Schlüssel bleiben', () => {
    const cfg = { ...DEFAULT_FORM_CONFIG, hidden_forms: ['cirs'], formulare: { cirs: { v: 1, version: 2, felder: { warum: { aus: true } }, reihenfolge: [], eigene: [] } }, fremd: 1 } as never
    const neu = standardSetzen(cfg, 'produktausgabe', (k) => ({ ...k, eigene: [...k.eigene, fahrzeug] }))
    expect(neu.hidden_forms).toEqual(['cirs'])
    expect((neu as unknown as { fremd: number }).fremd).toBe(1)
    expect(neu.formulare?.cirs).toEqual({ v: 1, version: 2, felder: { warum: { aus: true } }, reihenfolge: [], eigene: [] })
    expect(neu.formulare?.produktausgabe).toEqual({
      v: 1, version: 1, felder: {}, reihenfolge: ['einsatz', 'datum', 'positionen', 'lager_id', 'e_k3j9x0a1'], eigene: [fahrzeug],
    })
    // Gelesen ergibt dasselbe
    expect(standardKonfig(neu, 'produktausgabe')).toEqual(neu.formulare?.produktausgabe)
  })

  it('Version: zählt bei eigenen Feldern und bei aus/Pflicht der Kernfelder, nicht bei Bezeichnung, Hilfetext, Reihenfolge', () => {
    let cfg = standardSetzen(DEFAULT_FORM_CONFIG, 'cirs', (k) => k)
    const v = () => standardKonfig(cfg, 'cirs').version
    expect(v()).toBe(0)
    const schritte: [string, (k: ReturnType<typeof standardKonfig>) => ReturnType<typeof standardKonfig>, number][] = [
      ['eigenes Feld anlegen', (k) => ({ ...k, eigene: [fahrzeug] }), 1],
      ['Bezeichnung des eigenen Felds', (k) => ({ ...k, eigene: [{ ...fahrzeug, label: 'Wagen' }] }), 0],
      ['Hilfetext des eigenen Felds', (k) => ({ ...k, eigene: [{ ...fahrzeug, label: 'Wagen', hilfe: 'Funkrufname' }] }), 0],
      ['Pflicht des eigenen Felds', (k) => ({ ...k, eigene: [{ ...k.eigene[0], pflicht: false }] }), 1],
      ['Art des eigenen Felds', (k) => ({ ...k, eigene: [{ ...k.eigene[0], typ: 'auswahl', optionen: ['RTW 1', 'RTW 2'] }] }), 1],
      ['Optionen', (k) => ({ ...k, eigene: [{ ...k.eigene[0], optionen: ['RTW 1', 'RTW 2', 'KTW'] }] }), 1],
      ['eigenes Feld ausblenden', (k) => ({ ...k, eigene: [{ ...k.eigene[0], aus: true }] }), 1],
      ['Kernfeld umbenennen', (k) => ({ ...k, felder: { ...k.felder, ort: { label: 'Wo?' } } }), 0],
      ['Kernfeld Hilfetext', (k) => ({ ...k, felder: { ...k.felder, ort: { label: 'Wo?', hilfe: 'Halle, Fahrzeug' } } }), 0],
      ['Kernfeld ausblenden', (k) => ({ ...k, felder: { ...k.felder, ort: { ...k.felder.ort, aus: true } } }), 1],
      ['Kernfeld Pflicht', (k) => ({ ...k, felder: { ...k.felder, warum: { pflicht: true } } }), 1],
      ['Reihenfolge', (k) => ({ ...k, reihenfolge: [...k.reihenfolge].reverse() }), 0],
      ['Unzulässiges (aus an festem Feld)', (k) => ({ ...k, felder: { ...k.felder, was: { aus: true } } }), 0],
      ['eigenes Feld entfernen', (k) => ({ ...k, eigene: [], reihenfolge: k.reihenfolge.filter((x) => x !== fahrzeug.id) }), 1],
    ]
    for (const [name, fn, plus] of schritte) {
      const vorher = v()
      cfg = standardSetzen(cfg, 'cirs', fn)
      expect([name, v()]).toEqual([name, vorher + plus])
    }
    // Unzulässiges fiel beim Schreiben weg
    expect(standardKonfig(cfg, 'cirs').felder.was).toBeUndefined()
  })

  it('kaputte Einstellung: von der Vorgabe aus; das Original bleibt unberührt', () => {
    const kaputt = { ...DEFAULT_FORM_CONFIG, formulare: 'kaputt' } as never
    const neu = standardSetzen(kaputt, 'defektmeldung', (k) => ({ ...k, eigene: [fahrzeug] }))
    expect(neu.formulare?.defektmeldung?.eigene).toEqual([fahrzeug])
    const cfg = { ...DEFAULT_FORM_CONFIG, formulare: { cirs: { v: 1, version: 1, felder: {}, reihenfolge: [], eigene: [] } } } as never
    standardSetzen(cfg, 'cirs', (k) => { k.eigene.push(fahrzeug); return k })
    expect((cfg as { formulare: { cirs: { eigene: unknown[] } } }).formulare.cirs.eigene).toEqual([])
  })

  it('mit formConfigAendern: auf dem frischen Stand, eine fremde Änderung bleibt', async () => {
    server.form_config = { hidden_forms: ['patienten'], formulare: { cirs: { felder: { ort: { aus: true } } } } }
    await formConfigAendern('org1', (c) => standardSetzen(c, 'produktausgabe', (k) => ({ ...k, felder: { einsatz: { label: 'Auftragsnummer' } } })))
    expect(server.form_config).toMatchObject({ hidden_forms: ['patienten'], formulare: { cirs: { felder: { ort: { aus: true } } }, produktausgabe: { felder: { einsatz: { label: 'Auftragsnummer' } }, version: 0 } } })
  })
})
