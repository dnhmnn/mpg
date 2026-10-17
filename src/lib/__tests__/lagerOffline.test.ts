import { describe, it, expect } from 'vitest'
import { darfFremdenUebertragen, eintragStatus, istEigener, laeuftGerade, positionen, sichtbarFuer, type PendingBuchung } from '../lagerOffline'

const eintrag = (teil: Partial<PendingBuchung> = {}): PendingBuchung => ({
  id: 'q1', location_id: 'rtw1', item_id: 'hand', item_name: 'Handschuhe M', delta: -1,
  created_at: 1, tries: 0, ...teil,
})

describe('Lager-Warteschlange: wer überträgt was', () => {
  const anna = { id: 'u_anna', organization_id: 'org1' }
  const ben = { id: 'u_ben', organization_id: 'org1' }
  const fremdeOrg = { id: 'u_x', organization_id: 'org2' }

  it('automatisch nur die eigenen Buchungen — nie unter fremdem Namen', () => {
    const vonAnna = eintrag({ user_id: 'u_anna', organization_id: 'org1' })
    expect(istEigener(vonAnna, anna)).toBe(true)
    expect(istEigener(vonAnna, ben)).toBe(false)
    expect(istEigener(vonAnna, fremdeOrg)).toBe(false)
    expect(istEigener(vonAnna, null)).toBe(false)
  })

  it('Einträge von vor diesem Stand (ohne Person) gelten als eigene — wie bisher', () => {
    expect(istEigener(eintrag(), anna)).toBe(true)
    expect(istEigener(eintrag({ organization_id: 'org2' }), anna)).toBe(false)
  })

  it('fremde Einträge ausdrücklich übertragen: nur in der eigenen Organisation', () => {
    expect(darfFremdenUebertragen(eintrag({ organization_id: 'org1' }), ben)).toBe(true)
    expect(darfFremdenUebertragen(eintrag({ organization_id: 'org1' }), fremdeOrg)).toBe(false)
    expect(darfFremdenUebertragen(eintrag({ organization_id: 'org1' }), null)).toBe(false)
  })
})

describe('Lager-Warteschlange: Zustand und Positionen', () => {
  it('teilweise vor abgelehnt vor unklar vor wartet', () => {
    expect(eintragStatus(eintrag({ gesperrt: true, abgelehnt: true, unklar: true }))).toBe('teilweise')
    expect(eintragStatus(eintrag({ abgelehnt: true, unklar: true }))).toBe('abgelehnt')
    expect(eintragStatus(eintrag({ unklar: true }))).toBe('unklar')
    expect(eintragStatus(eintrag())).toBe('wartet')
  })

  it('erste Position plus weitere, in dieser Reihenfolge', () => {
    const b = eintrag({ weitere: [{ item_id: 'nacl', item_name: 'NaCl', delta: -2 }] })
    expect(positionen(b).map(p => [p.item_id, p.delta])).toEqual([['hand', -1], ['nacl', -2]])
  })
})

describe('Lager-Warteschlange: abgebrochene Übertragung und Sichtbarkeit', () => {
  it('läuft unter einer Minute; danach gilt sie als unklar (kann angekommen sein)', () => {
    const jetzt = 1_000_000
    expect(laeuftGerade(eintrag({ in_uebertragung: jetzt - 30_000 }), jetzt)).toBe(true)
    expect(eintragStatus(eintrag({ in_uebertragung: jetzt - 30_000 }), jetzt)).toBe('laeuft')
    expect(eintragStatus(eintrag({ in_uebertragung: jetzt - 90_000 }), jetzt)).toBe('unklar')
    expect(eintragStatus(eintrag({ in_uebertragung: jetzt - 90_000, gesperrt: true }), jetzt)).toBe('teilweise')
  })

  it('Buchungen einer fremden Organisation sind nicht einsehbar', () => {
    const anna = { id: 'u_anna', organization_id: 'org1' }
    expect(sichtbarFuer(eintrag({ user_id: 'u_ben', organization_id: 'org1' }), anna)).toBe(true)
    expect(sichtbarFuer(eintrag({ user_id: 'u_x', organization_id: 'org2' }), anna)).toBe(false)
    expect(sichtbarFuer(eintrag({ user_id: 'u_anna', organization_id: 'org1' }), anna)).toBe(true)
  })
})
