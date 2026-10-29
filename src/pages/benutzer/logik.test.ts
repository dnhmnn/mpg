import { describe, it, expect } from 'vitest'
import { PERM_LABELS, befristungBis, isPlaceholderEmail, neuePlatzhalterEmail, sichtbareEmail } from '../../lib/apps'
import {
  RECHTE_GRUPPEN, ROLLENFELD_TEXT, anlegeFehler, anmeldeAdresse, anzahl, anzahlRechte, anzeigeEmail, aufzaehlung, benutzerStatus, genPassword, inDauer,
  initialen, orgFehler, rechteGruppiert, suchen, type UUser,
} from './logik'

const JETZT = Date.parse('2026-10-29T12:00:00Z')
const H = 3600 * 1000
const u = (x: Partial<UUser> = {}): UUser => ({ id: 'u1', name: 'Anna Berger', email: 'anna@beispiel.de', role: 'benutzer', permissions: { lernbar: true }, ...x })

describe('Rechte nach Bereichen', () => {
  it('jedes Recht aus PERM_LABELS steht in genau einem Bereich', () => {
    const verteilt = RECHTE_GRUPPEN.flatMap(g => g.rechte)
    expect(new Set(verteilt).size).toBe(verteilt.length)
    expect([...verteilt].sort()).toEqual(PERM_LABELS.map(p => p.key).sort())
  })

  it('zeigt nur die vergebbaren Rechte, leere Bereiche entfallen, Unbekanntes kommt unter „Weitere“', () => {
    const g = rechteGruppiert([{ key: 'chat', label: 'Chat' }, { key: 'eks', label: 'EKS' }, { key: 'neu_x', label: 'Neu' }])
    expect(g.map(x => x.name)).toEqual(['Einsatz', 'Kommunikation', 'Weitere'])
    expect(g[0].rechte.map(r => r.key)).toEqual(['eks'])
  })

  it('zählt nur sichtbare Rechte, die wirklich angehakt sind', () => {
    const sichtbar = [{ key: 'chat', label: 'Chat' }, { key: 'lager', label: 'Lager' }]
    expect(anzahlRechte({ chat: true, lager: false, produktausgabe: true }, sichtbar)).toBe(1)
    expect(anzahlRechte(undefined, sichtbar)).toBe(0)
  })
})

describe('Status in der Liste', () => {
  it('gesperrt geht vor allem anderen', () => {
    expect(benutzerStatus(u({ disabled: true, permissions: {} }), JETZT)).toEqual({ text: 'gesperrt', art: 'gesperrt' })
  })

  it('abgelaufen, auch im PocketBase-Format', () => {
    expect(benutzerStatus(u({ expires_at: befristungBis(JETZT - H) }), JETZT)?.art).toBe('abgelaufen')
  })

  it('keine Rechte vor „läuft ab“, Teilnehmer und Supervisor zählen nicht als leer', () => {
    expect(benutzerStatus(u({ permissions: { lernbar: false }, expires_at: befristungBis(JETZT + 5 * H) }), JETZT)).toEqual({ text: 'keine Rechte', art: 'leer' })
    expect(benutzerStatus(u({ role: 'teilnehmer', permissions: {} }), JETZT)).toBeNull()
    expect(benutzerStatus(u({ supervisor: true, permissions: {} }), JETZT)).toBeNull()
  })

  it('ein noch laufendes befristetes Recht ist ein Recht', () => {
    const st = benutzerStatus(u({ permissions: {}, temp_permissions: { lager: { until: befristungBis(JETZT + 2 * H) } } }), JETZT)
    expect(st).toEqual({ text: '1 Recht befristet', art: 'befristet' })
  })

  it('läuft ab in Minuten, Stunden, Tagen', () => {
    expect(benutzerStatus(u({ expires_at: befristungBis(JETZT + 25 * 60000) }), JETZT)?.text).toBe('läuft ab in 25 Minuten')
    expect(benutzerStatus(u({ expires_at: befristungBis(JETZT + 26 * H) }), JETZT)?.text).toBe('läuft ab in 1 Tag')
    expect(benutzerStatus(u({ expires_at: new Date(JETZT + 3 * 24 * H).toISOString() }), JETZT)?.text).toBe('läuft ab in 3 Tagen')
  })

  it('ohne Auffälligkeit kein Status', () => {
    expect(benutzerStatus(u(), JETZT)).toBeNull()
  })
})

describe('Texte', () => {
  it('Dauer und Mengen', () => {
    expect(inDauer(0)).toBe('in 1 Minute')
    expect(inDauer(H)).toBe('in 1 Stunde')
    expect(inDauer(5 * H)).toBe('in 5 Stunden')
    expect(anzahl(1, 'Person', 'Personen')).toBe('1 Person')
    expect(anzahl(0, 'Person', 'Personen')).toBe('0 Personen')
    expect(aufzaehlung([])).toBe('')
    expect(aufzaehlung(['A'])).toBe('A')
    expect(aufzaehlung(['A', 'B', 'C'])).toBe('A, B und C')
  })

  it('Initialen und Adresse', () => {
    expect(initialen('Anna Berger')).toBe('AB')
    expect(initialen('  lea  ')).toBe('L')
    expect(initialen('', 'x@y.de')).toBe('X')
    expect(anzeigeEmail({ email: 't1@kein-email.intern' })).toBe('')
    expect(anzeigeEmail({ email: 't1@kein-email.intern', contact_email: 'k@x.de' })).toBe('k@x.de')
    expect(anzeigeEmail({ email: 'a@x.de' })).toBe('a@x.de')
  })

  it('Suche in Name und E-Mail, ohne Groß/klein', () => {
    const liste = [u({ id: '1', name: 'Anna Berger' }), u({ id: '2', name: 'Jonas Keller', email: 'jk@wache.de' }), u({ id: '3', name: 'Ömer', email: 'x@y.de', contact_email: 'oemer@privat.de' })]
    expect(suchen(liste, '').length).toBe(3)
    expect(suchen(liste, 'BERG').map(x => x.id)).toEqual(['1'])
    expect(suchen(liste, 'wache').map(x => x.id)).toEqual(['2'])
    expect(suchen(liste, 'privat').map(x => x.id)).toEqual(['3'])
    expect(suchen(liste, 'öm').map(x => x.id)).toEqual(['3'])
  })

  it('Suche findet keine Platzhalter-Adresse', () => {
    const liste = [u({ id: '1', name: 'Paul Wagner', email: 'ohne-email-abc123def456@kein-email.intern' })]
    expect(suchen(liste, 'kein-email')).toEqual([])
    expect(suchen(liste, 'intern')).toEqual([])
    expect(suchen(liste, 'paul').map(x => x.id)).toEqual(['1'])
  })
})

describe('Personen ohne E-Mail', () => {
  const P = 'ohne-email-aaaaaaaaaaaa@kein-email.intern'
  const neu = () => P

  it('Platzhalter-Adresse: gültig für PocketBase, nie angezeigt, jedes Mal anders', () => {
    const a = neuePlatzhalterEmail(), b = neuePlatzhalterEmail()
    expect(a).toMatch(/^ohne-email-[a-z0-9]{12}@kein-email\.intern$/)
    expect(isPlaceholderEmail(a)).toBe(true)
    expect(a).not.toBe(b)
    expect(sichtbareEmail(a)).toBe('')
    expect(sichtbareEmail('anna@beispiel.de')).toBe('anna@beispiel.de')
    expect(sichtbareEmail(undefined)).toBe('')
    expect(anzeigeEmail({ email: a })).toBe('')
  })

  it('Neu ohne E-Mail: Platzhalter; mit E-Mail: die eingegebene', () => {
    expect(anmeldeAdresse('', undefined, neu)).toEqual({ email: P, nachgetragen: false })
    expect(anmeldeAdresse('   ', undefined, neu)).toEqual({ email: P, nachgetragen: false })
    expect(anmeldeAdresse(' anna@beispiel.de ', undefined, neu)).toEqual({ email: 'anna@beispiel.de', nachgetragen: false })
    // Eine selbst eingetippte Platzhalter-Adresse zählt wie keine: frische Adresse statt einer geratenen
    expect(anmeldeAdresse('x@kein-email.intern', undefined, neu)).toEqual({ email: P, nachgetragen: false })
  })

  it('Bisher ohne E-Mail: leer lässt den Platzhalter, eine Adresse wird nachgetragen', () => {
    expect(anmeldeAdresse('', 'alt@kein-email.intern', neu)).toEqual({ nachgetragen: false })
    expect(anmeldeAdresse('anna@beispiel.de', 'alt@kein-email.intern', neu)).toEqual({ email: 'anna@beispiel.de', nachgetragen: true })
  })

  it('Echte Adresse: ändern ja, entfernen nein, unverändert wird nicht mitgeschickt', () => {
    expect(anmeldeAdresse('anna@beispiel.de', 'anna@beispiel.de', neu)).toEqual({ nachgetragen: false })
    expect(anmeldeAdresse('neu@beispiel.de', 'anna@beispiel.de', neu)).toEqual({ email: 'neu@beispiel.de', nachgetragen: false })
    expect(anmeldeAdresse('', 'anna@beispiel.de', neu)).toEqual({ fehler: expect.stringMatching(/nicht entfernen/) })
  })

  it('Passwort für temporäre Zugänge: lesbar, ohne verwechselbare Zeichen', () => {
    const p = genPassword()
    expect(p).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{12}$/)
    expect(genPassword(20)).toHaveLength(20)
  })
})

describe('Fehlermeldungen beim Speichern', () => {
  const pb = (status: number, data: Record<string, unknown> = {}) => ({ status, response: { data } })

  it('Ablehnung durch die Regel beim Anlegen', () => {
    expect(anlegeFehler(pb(400), true)).toMatch(/Server lässt das mit diesem Konto nicht zu/)
  })

  it('doppelte Adresse', () => {
    expect(anlegeFehler(pb(400, { email: { code: 'validation_not_unique' } }), true)).toMatch(/schon ein Konto/)
  })

  it('echte Adresse ändern verboten (strengere Manage-Regel)', () => {
    expect(anlegeFehler(pb(400, { email: { code: 'validation_values_mismatch', message: "Values don't match." } }), false))
      .toBe('Nicht gespeichert: Eine E-Mail-Adresse, mit der sich die Person schon anmeldet, ändert nur der Supervisor.')
  })

  it('Feld „role“ abgelehnt: Hinweis auf die Auswahlliste in PocketBase', () => {
    expect(anlegeFehler(pb(400, { role: { code: 'validation_invalid_value' } }), true)).toBe('Nicht angelegt: ' + ROLLENFELD_TEXT)
    expect(anlegeFehler(pb(400, { role: { code: 'validation_invalid_value' } }), false)).toBe('Nicht gespeichert: ' + ROLLENFELD_TEXT)
    // Zu kurze Höchstlänge oder ein Muster am Feld: eigener Hinweis statt „Auswahlliste“
    expect(anlegeFehler(pb(400, { role: { code: 'validation_max_text_constraint' } }), true)).toMatch(/Max length/)
    expect(anlegeFehler(pb(400, { role: { code: 'validation_invalid_format' } }), false)).toMatch(/Muster/)
  })

  it('Organisation: 404 heißt, der Server lässt das Ändern nicht zu', () => {
    expect(orgFehler(pb(404))).toBe('Nicht gespeichert: Der Server lässt das Ändern der Organisation nicht zu.')
    expect(orgFehler({ status: 0 })).toMatch(/Keine Verbindung/)
  })
})
