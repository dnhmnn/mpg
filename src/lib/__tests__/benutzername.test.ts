// Benutzername zum Anmelden (src/lib/benutzername.ts, Owner 21.11.2026).
import { describe, expect, it } from 'vitest'
import { anmeldeKennung, automatisch, normalisieren, pruefen, speicherFehler, uebernommen } from '../benutzername'

describe('pruefen', () => {
  it('nimmt einfache Namen und schreibt sie klein', () => {
    expect(pruefen('Lena.Berger')).toEqual({ wert: 'lena.berger', fehler: '' })
    expect(pruefen('  jonas_weber-2 ')).toEqual({ wert: 'jonas_weber-2', fehler: '' })
    expect(pruefen('abc').fehler).toBe('')
    expect(pruefen('a'.repeat(32)).fehler).toBe('')
  })
  it('leer heißt entfernen, kein Fehler', () => {
    expect(pruefen('   ')).toEqual({ wert: '', fehler: '' })
  })
  it('Leerzeichen in der Mitte fallen weg', () => {
    expect(pruefen('lena berger').wert).toBe('lenaberger')
  })
  it('lehnt ab: zu kurz, zu lang, @, Umlaute und andere Zeichen', () => {
    expect(pruefen('ab').fehler).toMatch(/Mindestens 3/)
    expect(pruefen('a'.repeat(33)).fehler).toMatch(/Höchstens 32/)
    expect(pruefen('lena@beispiel.de').fehler).toMatch(/kein @/)
    expect(pruefen('jürgen').fehler).toMatch(/Umlaute/)
    expect(pruefen('straße').fehler).toMatch(/ß/)
    expect(pruefen('lena/berger').fehler).not.toBe('')
    expect(pruefen('lena+1').fehler).not.toBe('')
  })
  it('vereinheitlicht zusammengesetzte Zeichen vor dem Prüfen', () => {
    expect(normalisieren('Jürgen')).toBe('jürgen')
  })
})

describe('anmeldeKennung', () => {
  it('E-Mail bleibt, wie sie ist (ohne Rand)', () => {
    expect(anmeldeKennung('  Lena.Berger@Beispiel.de ')).toBe('Lena.Berger@Beispiel.de')
  })
  it('Benutzername klein', () => {
    expect(anmeldeKennung(' Lena.Berger ')).toBe('lena.berger')
  })
})

describe('speicherFehler', () => {
  const fehler = (status: number, data?: Record<string, { code: string }>) => ({ status, response: { data: data ?? {} } })
  it('schon vergeben', () => {
    expect(speicherFehler(fehler(400, { username: { code: 'validation_not_unique' } }))).toMatch(/schon jemand/)
  })
  it('Pflicht auf dem Server', () => {
    expect(speicherFehler(fehler(400, { username: { code: 'validation_required' } }))).toMatch(/Pflicht/)
  })
  it('anderes Problem mit dem Feld', () => {
    expect(speicherFehler(fehler(400, { username: { code: 'validation_invalid_format' } }))).toMatch(/nimmt der Server nicht an/)
  })
  it('keine Erlaubnis, keine Verbindung', () => {
    expect(speicherFehler(fehler(403))).toMatch(/gerade nicht ändern/)
    expect(speicherFehler(fehler(404))).toMatch(/gerade nicht ändern/)
    expect(speicherFehler({ status: 0 })).toMatch(/Keine Verbindung/)
  })
})

describe('uebernommen', () => {
  it('Server kennt das Feld nicht', () => {
    expect(uebernommen({ id: 'x', name: 'Lena' }, 'lena')).toBe('nicht_eingerichtet')
    expect(uebernommen(null, 'lena')).toBe('nicht_eingerichtet')
  })
  it('übernommen oder anders gespeichert', () => {
    expect(uebernommen({ username: 'lena' }, 'lena')).toBe('ja')
    expect(uebernommen({ username: '' }, '')).toBe('ja')
    expect(uebernommen({ username: 'users123456' }, '')).toBe('anders')
  })
})

describe('automatisch', () => {
  it('erkennt die zufälligen Namen aus PocketBase 0.22', () => {
    expect(automatisch('users482913')).toBe(true)
    expect(automatisch('users12345')).toBe(true)
  })
  it('selbst gewählte Namen nicht', () => {
    expect(automatisch('lena.berger')).toBe(false)
    expect(automatisch('users')).toBe(false)
    expect(automatisch('userslena')).toBe(false)
    expect(automatisch('')).toBe(false)
    expect(automatisch(undefined)).toBe(false)
  })
})
