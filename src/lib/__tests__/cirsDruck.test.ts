import { describe, it, expect } from 'vitest'
import { auswerten, bearbeitungLesen, fallAus, massnahmeAbhaken, massnahmeHinzufuegen, phaseSetzen, type Schritt } from '../cirs'
import { auswertungSeite, cirsSeite } from '../cirsDruck'

const AM = new Date(2026, 9, 13, 12, 0, 0)
const s = (wer = 'QM Weber'): Schritt => ({ wer, am: AM })

const MELDUNG = {
  datum: '2026-10-01', ort: 'Fahrzeughalle', kategorie: 'fahrzeug', schwere: 'mittel',
  was: 'Leere <Sauerstoffflasche> übergeben.', warum: 'Checkliste nicht abgezeichnet',
  melder_name: 'Erika Muster', melder_kontakt: '0170 123456',
}

function fall() {
  let b = bearbeitungLesen({})
  b = massnahmeHinzufuegen(b, { text: 'O2-Druck in die Checkliste', verantwortlich: 'Wachleitung', frist: '2026-10-01' }, s())
  b = massnahmeAbhaken(b, b.massnahmen[0].id, true, s('A. Berger'))
  b = phaseSetzen(b, 'abgeschlossen', s('QM Huber'), 'Checkliste geändert, Team informiert')
  return fallAus({ id: 'abcdefgh12345xy', created: '2026-10-02 08:15:00.000Z', status: 'erledigt', payload: { ...MELDUNG, bearbeitung: b } })
}

describe('CIRS zum Ausdrucken: eine Meldung', () => {
  it('enthält Meldung, Maßnahme, Ergebnis und Verlauf', () => {
    const html = cirsSeite(fall(), { gedruckt: { am: AM, von: 'QM Weber' } })
    expect(html).toContain('CIRS-2026-abcdefgh')
    expect(html).toContain('Fahrzeughalle')
    expect(html).toContain('O2-Druck in die Checkliste')
    expect(html).toContain('Checkliste geändert, Team informiert')
    expect(html).toContain('QM Huber')
    expect(html).toContain('A. Berger')
    expect(html).toContain('Abgeschlossen')
  })

  it('maskiert, was der Melder geschrieben hat', () => {
    const html = cirsSeite(fall(), { gedruckt: { am: AM } })
    expect(html).toContain('Leere &lt;Sauerstoffflasche&gt; übergeben.')
    expect(html).not.toContain('<Sauerstoffflasche>')
  })

  it('nennt den Melder nur, wenn es ausdrücklich gewünscht ist', () => {
    expect(cirsSeite(fall(), { gedruckt: { am: AM } })).not.toContain('Erika Muster')
    const mit = cirsSeite(fall(), { mitMelder: true, gedruckt: { am: AM } })
    expect(mit).toContain('Erika Muster')
    expect(mit).toContain('0170 123456')
  })

  it('eine offene Maßnahme mit verstrichener Frist ist überfällig — eine erledigte nicht, und an einer geschlossenen Meldung nichts', () => {
    const offen = fallAus({ id: 'x2345678', created: '2026-10-02 08:15:00.000Z', payload: {
      ...MELDUNG, bearbeitung: massnahmeHinzufuegen(bearbeitungLesen({}), { text: 'Nachschulung', frist: '2026-10-01' }, s()),
    } })
    expect(cirsSeite(offen, { gedruckt: { am: AM } })).toContain('<span class="ueber">überfällig</span>')
    expect(cirsSeite(fall(), { gedruckt: { am: AM } })).not.toContain('<span class="ueber">überfällig</span>')
    const zuMitOffener = fallAus({ id: 'x2345679', created: '2026-10-02 08:15:00.000Z', payload: {
      ...MELDUNG, bearbeitung: phaseSetzen(massnahmeHinzufuegen(bearbeitungLesen({}), { text: 'Nachschulung', frist: '2026-10-01' }, s()), 'abgeschlossen', s(), 'ok'),
    } })
    expect(cirsSeite(zuMitOffener, { gedruckt: { am: AM } })).not.toContain('<span class="ueber">überfällig</span>')
  })
})

describe('CIRS zum Ausdrucken: Auswertung', () => {
  it('zeigt Zahlen, Verteilung und die Meldungen des Zeitraums — ohne Melder', () => {
    const f = fall()
    const html = auswertungSeite(auswerten([f], AM), [f], { zeitraum: 'Letzte 12 Monate', organisation: 'Testwache', gedruckt: { am: AM } })
    expect(html).toContain('CIRS-Auswertung')
    expect(html).toContain('Letzte 12 Monate')
    expect(html).toContain('Testwache')
    expect(html).toContain('Fahrzeug')
    expect(html).toContain('CIRS-2026-abcdefgh')
    expect(html).not.toContain('Erika Muster')
  })

  it('sagt es, wenn im Zeitraum nichts einging', () => {
    expect(auswertungSeite(auswerten([], AM), [], { zeitraum: '2025', gedruckt: { am: AM } })).toContain('Im Zeitraum ist keine Meldung eingegangen.')
  })
})
