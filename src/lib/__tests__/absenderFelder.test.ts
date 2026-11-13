// Prüffälle der gemeinsamen Absender-Felder (Bauplan v2, 4.2, 4.3):
// Prüfzeile je Zweck, wer sendet, Knopftext, was vor dem Senden feststeht.
// Die Bauteile selbst (NamensFeld, AbsenderFeld, Warteschlange) holen ihre
// Sätze und Entscheidungen aus src/pages/public/absender/texte.ts.

import { describe, it, expect } from 'vitest'
import {
  ABSENDER_TEXTE, absenderAngabe, andererNameHinweis, besatzungFusszeile, lageAusErgebnis, lageAusFehler, modusAusStand, nameVergleichsform, namePruefbar,
  pruefzeile, sendeKnopfText, sendetAngemeldet, vorDemSenden, type NamensLage, type NamensZweck,
} from '../../pages/public/absender/texte'
import type { Stand } from '../formular/api'

function stand(patienten: 'passwort' | 'frei', angemeldet: { id: string; name: string } | null = null): Stand {
  const f = (modus: 'passwort' | 'frei' | 'anonym') => ({ modus, an: true, oeffentlich: true, ausstehend: true })
  return {
    version: 1,
    formulare: { patienten: f(patienten), produktausgabe: f('frei'), defektmeldung: f('frei'), cirs: f('anonym') },
    angemeldet,
  }
}

const GEDANKENSTRICH = /[–—]/

describe('Namensprüfung: wann gefragt wird', () => {
  it('fragt nur bei Vor- und Nachnamen mit mindestens 4 Zeichen', () => {
    expect(namePruefbar('Anna Berg')).toBe(true)
    expect(namePruefbar('Berg,Anna')).toBe(true)
    expect(namePruefbar('A B')).toBe(false)
    expect(namePruefbar('Anna')).toBe(false)
    expect(namePruefbar('   Anna   ')).toBe(false)
    expect(namePruefbar('Anna Berg')).toBe(true)
    expect(namePruefbar('')).toBe(false)
  })

  it('liest die Antwort des Servers als Lage', () => {
    expect(lageAusErgebnis({ vollstaendig: false, gefunden: false, eindeutig: false })).toBe('unvollstaendig')
    expect(lageAusErgebnis({ vollstaendig: true, gefunden: true, eindeutig: true })).toBe('eindeutig')
    expect(lageAusErgebnis({ vollstaendig: true, gefunden: true, eindeutig: false })).toBe('mehrfach')
    expect(lageAusErgebnis({ vollstaendig: true, gefunden: false, eindeutig: false })).toBe('unbekannt')
  })

  it('zeigt bei Fehlern ohne Netz oder gedrosselt einen Hinweis, sonst nichts', () => {
    expect(lageAusFehler('netz')).toBe('ohne_netz')
    expect(lageAusFehler('drossel')).toBe('gedrosselt')
    expect(lageAusFehler('server')).toBe('gedrosselt')
    expect(lageAusFehler('alter_server')).toBe('stumm')
    expect(lageAusFehler('formular_aus')).toBe('stumm')
    expect(lageAusFehler('organisation')).toBe('stumm')
  })
})

describe('Prüfzeile (4.3, Tabelle)', () => {
  it('sagt je Zweck das Richtige', () => {
    expect(pruefzeile('eindeutig', 'besatzung', 'passwort')).toEqual({ text: 'Mitglied erkannt. Findet das Protokoll danach in Unitas.', erkannt: true })
    expect(pruefzeile('mehrfach', 'besatzung', 'passwort').text).toBe('Diesen Namen gibt es mehrfach. Steht nur auf dem Bogen.')
    expect(pruefzeile('unbekannt', 'besatzung', 'frei').text).toBe('Kein Mitglied mit genau diesem Namen. Steht nur auf dem Bogen.')

    expect(pruefzeile('eindeutig', 'absender', 'passwort')).toEqual({ text: 'Mitglied erkannt. Bitte mit deinem Passwort bestätigen.', erkannt: true })
    // Doppelte Namen: das Passwort entscheidet, also ebenfalls erkannt
    expect(pruefzeile('mehrfach', 'absender', 'passwort')).toEqual({ text: 'Mitglied erkannt. Bitte mit deinem Passwort bestätigen.', erkannt: true })
    expect(pruefzeile('unbekannt', 'absender', 'passwort').text).toBe('Kein aktives Mitglied mit genau diesem Namen. Bitte so eintragen, wie er in Responda steht.')

    expect(pruefzeile('eindeutig', 'absender', 'frei')).toEqual({ text: 'Passt auf ein Mitglied. Wird verknüpft und als nicht bestätigt markiert.', erkannt: true })
    expect(pruefzeile('mehrfach', 'absender', 'frei')).toEqual({ text: 'Wird als Name ohne Konto eingetragen.', erkannt: false })
    expect(pruefzeile('unbekannt', 'absender', 'frei').text).toBe('Wird als Name ohne Konto eingetragen.')

    expect(pruefzeile('eindeutig', 'ausstehend', 'passwort').text).toBe('Mitglied erkannt. Geht auch ohne Passwort und wartet dann auf die Unterschrift.')
    expect(pruefzeile('mehrfach', 'ausstehend', 'passwort')).toEqual({ text: 'Diesen Namen gibt es mehrfach. Bitte mit Passwort senden.', erkannt: false })
    expect(pruefzeile('unbekannt', 'ausstehend', 'passwort').text).toBe('Kein aktives Mitglied mit genau diesem Namen. Bitte so eintragen, wie er in Responda steht.')
  })

  it('sagt unvollständig, ohne Netz und gedrosselt für jeden Zweck gleich', () => {
    for (const zweck of ['absender', 'besatzung', 'ausstehend'] as NamensZweck[]) {
      for (const modus of ['passwort', 'frei'] as const) {
        expect(pruefzeile('unvollstaendig', zweck, modus).text).toBe('Bitte Vor- und Nachnamen eintragen.')
        expect(pruefzeile('ohne_netz', zweck, modus).text).toBe('Ohne Netz. Der Name wird beim Senden geprüft.')
        expect(pruefzeile('gedrosselt', zweck, modus).text).toBe('Prüfung gerade nicht möglich. Der Name wird beim Senden geprüft.')
        for (const still of ['leer', 'pruefe', 'stumm'] as NamensLage[]) expect(pruefzeile(still, zweck, modus).text).toBe('')
      }
    }
  })

  it('enthält in keiner Lage einen Gedankenstrich', () => {
    const lagen: NamensLage[] = ['leer', 'pruefe', 'stumm', 'unvollstaendig', 'eindeutig', 'mehrfach', 'unbekannt', 'ohne_netz', 'gedrosselt']
    for (const lage of lagen) for (const zweck of ['absender', 'besatzung', 'ausstehend'] as NamensZweck[]) for (const modus of ['passwort', 'frei'] as const) {
      expect(pruefzeile(lage, zweck, modus).text).not.toMatch(GEDANKENSTRICH)
    }
  })
})

describe('Besatzung: Fußzeile', () => {
  it('zählt die erkannten Mitglieder', () => {
    expect(besatzungFusszeile(0)).toBe('Noch niemand als Mitglied erkannt. Das Protokoll erscheint damit bei niemandem der Besatzung in Unitas.')
    expect(besatzungFusszeile(1)).toBe('Ein Besatzungsmitglied ist erkannt und findet das Protokoll in Unitas.')
    expect(besatzungFusszeile(3)).toBe('3 Besatzungsmitglieder sind erkannt und finden das Protokoll in Unitas.')
  })
})

describe('Wer sendet (4.2)', () => {
  const anna = { id: 'u1annaberg00000', name: 'Anna Berg' }

  it('angemeldet erkannt: mit Token, ohne Absenderangabe', () => {
    expect(absenderAngabe({ stand: stand('passwort', anna), formular: 'patienten', anderer: false, name: 'Jemand Anders', passwort: 'geheim' }))
      .toEqual({ mitAnmeldung: true, absender: null })
    expect(sendetAngemeldet(stand('passwort', anna), false)).toBe(true)
  })

  it('„Anderer Absender“: ohne Token, mit Name und Passwort', () => {
    expect(absenderAngabe({ stand: stand('passwort', anna), formular: 'patienten', anderer: true, name: ' Max Mayer ', passwort: 'pw' }))
      .toEqual({ mitAnmeldung: false, absender: { name: 'Max Mayer', passwort: 'pw' } })
    expect(sendetAngemeldet(stand('passwort', anna), true)).toBe(false)
  })

  it('Modus Passwort ohne Passwort: nur der Name (der Server sagt dann passwort_noetig)', () => {
    expect(absenderAngabe({ stand: stand('passwort'), formular: 'patienten', anderer: false, name: 'Anna Berg', passwort: '' }))
      .toEqual({ mitAnmeldung: false, absender: { name: 'Anna Berg' } })
  })

  it('Modus frei: nie ein Passwort, auch wenn eins getippt wurde', () => {
    expect(absenderAngabe({ stand: stand('frei'), formular: 'patienten', anderer: false, name: 'Hausmeister Meier', passwort: 'pw' }))
      .toEqual({ mitAnmeldung: false, absender: { name: 'Hausmeister Meier' } })
    // Produktausgabe ist in diesem Stand frei
    expect(absenderAngabe({ stand: stand('passwort'), formular: 'produktausgabe', anderer: false, name: 'X Y', passwort: 'pw' }).absender)
      .toEqual({ name: 'X Y' })
  })

  it('ohne Stand gilt die Voreinstellung (Patienten mit Passwort)', () => {
    expect(modusAusStand(null, 'patienten')).toBe('passwort')
    expect(modusAusStand(null, 'defektmeldung')).toBe('frei')
    expect(absenderAngabe({ stand: null, formular: 'patienten', anderer: false, name: 'Anna Berg', passwort: 'pw' }))
      .toEqual({ mitAnmeldung: false, absender: { name: 'Anna Berg', passwort: 'pw' } })
  })

  it('Knopf: „Als Anna Berg senden“ nur, wenn angemeldet erkannt', () => {
    expect(sendeKnopfText({ stand: stand('passwort', anna), anderer: false })).toBe('Als Anna Berg senden')
    expect(sendeKnopfText({ stand: stand('passwort', anna), anderer: true })).toBe('Absenden')
    expect(sendeKnopfText({ stand: stand('passwort'), anderer: false }, 'Protokoll absenden')).toBe('Protokoll absenden')
    expect(sendeKnopfText({ stand: stand('passwort', { id: 'x', name: '' }), anderer: false })).toBe('Angemeldet senden')
  })
})

describe('Angemeldet, aber ein anderer Name im Feld Unterschrift (Befund)', () => {
  const anna = { id: 'u1annaberg00000', name: 'Anna Berg' }
  it('Hinweis nur, wenn angemeldet gesendet wird und der Name im Feld ein anderer ist', () => {
    const h = andererNameHinweis({ stand: stand('passwort', anna), anderer: false, name: 'Max Mayer', herkunft: 'Unterschrift' })
    expect(h).toBe('Im Feld Unterschrift steht „Max Mayer“. Gesendet wird angemeldet als Anna Berg, auch im Feld steht danach Anna Berg. Gibt Max Mayer ab, bitte „Anderer Absender“ wählen.')
    expect(h).not.toMatch(GEDANKENSTRICH)
    for (const name of ['Anna Berg', 'anna  berg', 'Berg, Anna', ' ANNA BERG ', '']) {
      expect(andererNameHinweis({ stand: stand('passwort', anna), anderer: false, name, herkunft: 'Unterschrift' })).toBe('')
    }
    expect(andererNameHinweis({ stand: stand('passwort', anna), anderer: true, name: 'Max Mayer', herkunft: 'Unterschrift' })).toBe('')
    expect(andererNameHinweis({ stand: stand('passwort'), anderer: false, name: 'Max Mayer', herkunft: 'Unterschrift' })).toBe('')
  })
  it('Vergleichsform: Umlaute, Akzente, Komma, unsichtbare Zeichen', () => {
    expect(nameVergleichsform('Jörg Müller')).toBe(nameVergleichsform('Joerg Mueller'))
    expect(nameVergleichsform('Berg, Anna')).toBe('anna berg')
    expect(nameVergleichsform('José  García\u200e')).toBe('jose garcia')
    expect(nameVergleichsform('Anne - Marie')).toBe('anne-marie')
  })
})

describe('Vor dem Senden (ohne Server)', () => {
  const basis = { stand: stand('passwort'), alterServer: false, formular: 'patienten' as const, anderer: false, name: 'Anna Berg', passwort: '', online: true }

  it('verlangt online im Modus Passwort das Passwort', () => {
    expect(vorDemSenden(basis)).toBe('Bitte bestätige mit deinem Passwort. Ist keins zur Hand, lässt es sich auf dem Gerät ablegen.')
    expect(vorDemSenden({ ...basis, passwort: 'pw' })).toBe('')
  })

  it('ohne Netz oder bei altem Server genügt der Name (die Warteschlange fragt später)', () => {
    expect(vorDemSenden({ ...basis, online: false })).toBe('')
    expect(vorDemSenden({ ...basis, alterServer: true, stand: null })).toBe('')
  })

  it('verlangt immer einen Namen, außer angemeldet', () => {
    expect(vorDemSenden({ ...basis, name: '  ', online: false })).toBe('Bitte einen Namen eintragen.')
    expect(vorDemSenden({ ...basis, name: '', stand: stand('passwort', { id: 'u', name: 'Anna Berg' }) })).toBe('')
    expect(vorDemSenden({ ...basis, stand: stand('frei') })).toBe('')
  })
})

describe('Texte ohne Gedankenstriche', () => {
  it('in allen festen und zusammengesetzten Sätzen', () => {
    for (const [k, w] of Object.entries(ABSENDER_TEXTE)) {
      const text = typeof w === 'function' ? (w as (...a: unknown[]) => string)('Anna Berg', 'Unterschrift') : w
      expect(text, k).not.toMatch(GEDANKENSTRICH)
      if (typeof w === 'function') expect((w as (...a: unknown[]) => string)('', 'Unterschrift'), k).not.toMatch(GEDANKENSTRICH)
    }
    for (const n of [0, 1, 2]) expect(besatzungFusszeile(n)).not.toMatch(GEDANKENSTRICH)
  })
})

describe('Eigene Formulare: Absender nach der Vorlage (Plan Vorgänge 5.3, F6)', () => {
  const angemeldet = stand('frei', { id: 'u1', name: 'Anna Berg' })

  it('Modus der Vorlage hat Vorrang vor dem Stand', () => {
    expect(modusAusStand(stand('frei'), 'eigen', 'passwort')).toBe('passwort')
    expect(modusAusStand(stand('passwort'), 'eigen', 'frei')).toBe('frei')
    expect(modusAusStand(stand('passwort'), 'eigen')).toBe('frei')
    expect(modusAusStand(stand('passwort'), 'eigen', 'anonym')).toBe('frei')
  })

  it('anonym: nie Token, nie Name, nie Passwort, keine Vorprüfung, Knopf ohne Namen', () => {
    expect(absenderAngabe({ stand: angemeldet, formular: 'eigen', anderer: false, name: 'Anna Berg', passwort: 'pw', modus: 'anonym' })).toEqual({ mitAnmeldung: false, absender: null })
    expect(sendetAngemeldet(angemeldet, false, 'anonym')).toBe(false)
    expect(vorDemSenden({ stand: stand('passwort'), alterServer: false, formular: 'eigen', anderer: false, name: '', passwort: '', online: true, modus: 'anonym' })).toBe('')
    expect(sendeKnopfText({ stand: angemeldet, anderer: false, modus: 'anonym' })).toBe('Absenden')
  })

  it('Passwort und frei wie bei den Standardformularen; angemeldete Mitglieder werden erkannt', () => {
    expect(absenderAngabe({ stand: stand('frei'), formular: 'eigen', anderer: false, name: ' Ida Imker ', passwort: 'pw', modus: 'passwort' })).toEqual({ mitAnmeldung: false, absender: { name: 'Ida Imker', passwort: 'pw' } })
    expect(absenderAngabe({ stand: stand('passwort'), formular: 'eigen', anderer: false, name: 'Ida Imker', passwort: 'pw', modus: 'frei' })).toEqual({ mitAnmeldung: false, absender: { name: 'Ida Imker' } })
    expect(absenderAngabe({ stand: angemeldet, formular: 'eigen', anderer: false, name: '', passwort: '', modus: 'passwort' })).toEqual({ mitAnmeldung: true, absender: null })
    expect(vorDemSenden({ stand: stand('frei'), alterServer: false, formular: 'eigen', anderer: false, name: 'Ida Imker', passwort: '', online: true, modus: 'passwort' })).toMatch(/Passwort/)
  })

  it('neue Texte ohne Gedankenstriche', () => {
    for (const t of [ABSENDER_TEXTE.anonymHinweis, ABSENDER_TEXTE.absenderAnonym, ABSENDER_TEXTE.unverschluesselt, ABSENDER_TEXTE.unlesbar(1), ABSENDER_TEXTE.unlesbar(3)]) expect(t).not.toMatch(GEDANKENSTRICH)
  })
})
