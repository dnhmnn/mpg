import { describe, it, expect } from 'vitest'
import { nichtImFormular, payloadZusammenfuehren } from '../payloadZusammenfuehren'

describe('Protokolldaten zusammenführen', () => {
  it('lässt Felder stehen, die das Formular nicht zeigt', () => {
    // Der eigentliche Zweck: eine Maske, die nur die Hälfte der Felder
    // kennt, darf die andere Hälfte nicht aus dem Protokoll löschen.
    const bestehend = { name: 'Mustermann', ub_hf: '90', tracerdiagnose: 'Abdomen unklar' }
    const ausDemFormular = { name: 'Musterfrau' }
    expect(payloadZusammenfuehren(bestehend, ausDemFormular)).toEqual({
      name: 'Musterfrau', ub_hf: '90', tracerdiagnose: 'Abdomen unklar',
    })
  })

  it('übernimmt eine geleerte Eingabe — leeren ist eine Aussage', () => {
    expect(payloadZusammenfuehren({ name: 'Mustermann' }, { name: '' }).name).toBe('')
  })

  it('übernimmt false aus einem abgewählten Kästchen', () => {
    expect(payloadZusammenfuehren({ voranmeldung: true }, { voranmeldung: false }).voranmeldung).toBe(false)
  })

  it('kommt mit einem leeren Protokoll zurecht', () => {
    expect(payloadZusammenfuehren({}, { name: 'X' })).toEqual({ name: 'X' })
    expect(payloadZusammenfuehren({ name: 'X' }, {})).toEqual({ name: 'X' })
  })

  it('nennt die Felder, die das Formular nicht abdeckt', () => {
    const offen = nichtImFormular(
      { name: 'X', ub_hf: '90', leer: '', nichts: null },
      { name: 'X' },
    )
    expect(offen).toEqual(['ub_hf'])
  })
})
