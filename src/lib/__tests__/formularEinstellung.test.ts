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

const { formConfigLesen, formConfigAendern, absenderSetzen } = await import('../formular/einstellung')
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
