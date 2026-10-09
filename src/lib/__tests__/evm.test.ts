import { describe, it, expect } from 'vitest'
import { evmText } from '../aelrdEvm'
import { pflichtKarte } from '../../katalog/pflicht'

describe('Aufklärung und Einwilligung auf dem Bogen', () => {
  it('schreibt beides mit Uhrzeit, in der Reihenfolge der Maske', () => {
    expect(evmText({
      evm_aufgeklaert: 'ja', evm_aufklaerung_zeit: '08:40',
      evm_einwilligung: 'alle', evm_einwilligung_zeit: '08:45',
    })).toBe('Aufklärung über alle Maßnahmen: ja, 08:40 · Einwilligung: in alle Maßnahmen, 08:45')
  })

  it('nennt bei der mutmaßlichen Einwilligung den Rechtsgrund', () => {
    expect(evmText({ evm_einwilligung: 'mutmasslich', evm_einwilligung_zeit: '09:02' }))
      .toBe('Einwilligung: mutmaßliche Einwilligung gem. § 630d; 677 BGB, 09:02')
  })

  it('hängt die Auflistung an, wenn nur in folgende Maßnahmen eingewilligt wurde', () => {
    const t = evmText({
      evm_einwilligung: 'nur_folgende', evm_einwilligung_zeit: '08:45',
      evm_einwilligung_folgende: 'Zugang, Sauerstoff',
    })
    expect(t).toContain('Einwilligung: nur in folgende Maßnahmen, 08:45')
    expect(t).toContain('nur folgende Maßnahmen: Zugang, Sauerstoff')
  })

  it('zeigt eine Uhrzeit auch ohne Wahl — ein Befund, den der Bogen nicht verschluckt', () => {
    expect(evmText({ evm_einwilligung_zeit: '08:45' })).toBe('Einwilligung, 08:45')
  })

  it('bleibt leer, solange nichts dasteht', () => {
    expect(evmText({})).toBe('')
    expect(evmText({ evm_einwilligung_folgende: '   ' })).toBe('')
  })
})

describe('Aufklärung und Einwilligung als Pflicht', () => {
  it('verlangt beides mit Uhrzeit, sobald ein Patient versorgt wurde', () => {
    const k = pflichtKarte({ einsatz_art: 'Primäreinsatz' })
    for (const feld of ['evm_aufgeklaert', 'evm_aufklaerung_zeit', 'evm_einwilligung', 'evm_einwilligung_zeit']) {
      expect({ feld, stufe: k.get(feld)?.stufe }).toEqual({ feld, stufe: 'pflicht' })
    }
  })

  it('verlangt sie beim Fehleinsatz nicht', () => {
    const k = pflichtKarte({ einsatz_art: 'Fehleinsatz' })
    expect(k.get('evm_aufgeklaert')).toBeUndefined()
    expect(k.get('evm_einwilligung_zeit')).toBeUndefined()
  })

  it('verlangt die Auflistung nur bei „nur in folgende Maßnahmen"', () => {
    const alle = pflichtKarte({ einsatz_art: 'Primäreinsatz', evm_einwilligung: 'alle' })
    expect(alle.get('evm_einwilligung_folgende')).toBeUndefined()
    const folgende = pflichtKarte({ einsatz_art: 'Primäreinsatz', evm_einwilligung: 'nur_folgende' })
    expect(folgende.get('evm_einwilligung_folgende')?.stufe).toBe('pflicht')
  })
})
