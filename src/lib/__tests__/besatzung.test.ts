import { describe, it, expect } from 'vitest'
import {
  POSTEN, besatzungLesen, besatzungLeer, besatzungSetzen, einsichtIds,
} from '../../pages/public/doku/besatzung'
import { AELRD_ABSCHNITTE, aelrdFeld } from '../../katalog/aelrd'

/**
 * Die Regel, an der Unitas entscheidet, wessen Liste ein Protokoll erscheint
 * — wortgleich aus `loadPatients()` in Unitas.tsx. Weicht die Form der
 * Besatzung davon ab, sieht sie niemand mehr, und zwar lautlos.
 */
const sichtbarFuer = (payload: Record<string, unknown>, userId: string): boolean =>
  ['tf', 'm1', 'm2', 'm3'].some(
    (k) => (payload.mannschaft as Record<string, { id?: string }> | undefined)?.[k]?.id === userId,
  )

describe('Die Besatzung des Protokolls', () => {
  it('steht mit ihren Feldern so im Katalog, wie die Maske sie führt', () => {
    // Bekommt der Bogen einen vierten Platz, soll das hier auffallen und
    // nicht daran, dass ein Name nirgends mehr ankommt.
    const abschnitt = AELRD_ABSCHNITTE.find((a) => a.id === 'besatzung')
    expect(abschnitt?.felder).toEqual(POSTEN.map((p) => p.feld))
    for (const p of POSTEN) expect(aelrdFeld(p.feld)).toBeTruthy()
  })

  it('schreibt den Namen für den Bogen und die Kennung für die Einsicht', () => {
    const w = besatzungSetzen({}, 'tf', { id: 'u1', name: 'A. Berger' })
    expect(w.mannschaft_tf).toBe('A. Berger')
    expect(w.mannschaft).toEqual({ tf: { id: 'u1', name: 'A. Berger' } })
    expect(sichtbarFuer(w, 'u1')).toBe(true)
  })

  it('macht das Protokoll für die ganze Besatzung sichtbar', () => {
    let w = besatzungSetzen({}, 'tf', { id: 'u1', name: 'A. Berger' })
    w = besatzungSetzen(w, 'm1', { id: 'u2', name: 'B. Costa' })
    w = besatzungSetzen(w, 'm2', { id: 'u3', name: 'C. Dorn' })
    expect(einsichtIds(w)).toEqual(['u1', 'u2', 'u3'])
    for (const id of ['u1', 'u2', 'u3']) expect(sichtbarFuer(w, id)).toBe(true)
    expect(sichtbarFuer(w, 'fremd')).toBe(false)
  })

  it('zählt denselben Menschen auf zwei Posten nur einmal', () => {
    let w = besatzungSetzen({}, 'tf', { id: 'u1', name: 'A. Berger' })
    w = besatzungSetzen(w, 'm1', { id: 'u1', name: 'A. Berger' })
    expect(einsichtIds(w)).toEqual(['u1'])
  })

  it('gibt einem Namen ohne Konto keine Einsicht, druckt ihn aber', () => {
    const w = besatzungSetzen({}, 'm1', { id: '', name: 'Praktikant Hofer' })
    expect(w.mannschaft_1).toBe('Praktikant Hofer')
    expect(einsichtIds(w)).toEqual([])
    // Ein leerer Schlüssel darf niemandem die Tür öffnen: ohne Kennung gibt
    // es gar keinen Eintrag, an dem Unitas vergleichen könnte.
    expect(w.mannschaft).toEqual({ m1: null })
    expect(sichtbarFuer(w, '')).toBe(false)
    expect(besatzungLesen(w).m1).toEqual({ id: '', name: 'Praktikant Hofer' })
  })

  it('räumt beide Formen, wenn ein Posten wieder frei wird', () => {
    const besetzt = besatzungSetzen({}, 'tf', { id: 'u1', name: 'A. Berger' })
    const leer = besatzungSetzen(besetzt, 'tf', null)
    expect(leer.mannschaft_tf).toBe('')
    expect(einsichtIds(leer)).toEqual([])
    expect(sichtbarFuer(leer, 'u1')).toBe(false)
    expect(besatzungLeer(leer)).toBe(true)
  })

  it('lässt die übrigen Posten stehen', () => {
    let w = besatzungSetzen({}, 'tf', { id: 'u1', name: 'A. Berger' })
    w = besatzungSetzen(w, 'm1', { id: 'u2', name: 'B. Costa' })
    w = besatzungSetzen(w, 'tf', null)
    expect(besatzungLesen(w).m1).toEqual({ id: 'u2', name: 'B. Costa' })
    expect(w.mannschaft_1).toBe('B. Costa')
  })

  it('liest ältere Protokolle, die nur die verschachtelte Form führen', () => {
    // So hat das alte Formular gespeichert: die flachen Felder gab es nicht.
    const alt = { mannschaft: { tf: { id: 'u7', name: 'D. Esser' }, m1: null } }
    expect(besatzungLesen(alt).tf).toEqual({ id: 'u7', name: 'D. Esser' })
    expect(besatzungLesen(alt).m1).toBeNull()
    expect(einsichtIds(alt)).toEqual(['u7'])
    expect(besatzungLeer(alt)).toBe(false)
  })

  it('behauptet keine Einsicht, wenn der gedruckte Name ein anderer ist', () => {
    // Von Hand über einen gewählten Benutzer getippt: gedruckt wird der neue
    // Name, die Kennung gehört zum alten. Sie darf nicht mitwandern.
    const w = { mannschaft_tf: 'E. Frank', mannschaft: { tf: { id: 'u9', name: 'A. Berger' } } }
    expect(besatzungLesen(w).tf).toEqual({ id: '', name: 'E. Frank' })
    expect(einsichtIds(w)).toEqual([])
  })

  it('kommt mit einer leeren und einer kaputten Mannschaft zurecht', () => {
    expect(besatzungLeer({})).toBe(true)
    expect(besatzungLesen({ mannschaft: 'nichts' }).tf).toBeNull()
    expect(besatzungLesen({ mannschaft: ['a'] }).tf).toBeNull()
    expect(besatzungLesen({ mannschaft: { tf: { id: 'u1' } } }).tf).toBeNull()
    expect(einsichtIds({ mannschaft: null })).toEqual([])
  })

  it('übergeht Leerzeichen statt sie als Namen zu drucken', () => {
    const w = besatzungSetzen({}, 'm2', { id: 'u1', name: '   ' })
    expect(w.mannschaft_2).toBe('')
    expect(besatzungLesen(w).m2).toBeNull()
    expect(einsichtIds(w)).toEqual([])
  })
})
