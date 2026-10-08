import { describe, it, expect } from 'vitest'
import { rueckfrageSeite } from '../rueckfrageDruck'
import type { Rueckfrage, Stellungnahme } from '../../pages/public/doku/rueckfrage'

const AM = new Date('2026-03-04T09:12:00.000Z')
const KOPF = { name: 'Mustermann Erika', einsatz: 'Einsatz-Nr. 2026-0815 · Atemnot', mannschaft: 'A. Berger, L. Kainz' }

const frage: Rueckfrage = {
  id: 'r1', frage: 'Der Puls passt nicht zum Blutdruck.', von: 'Dr. Weber',
  felder: ['hf', 'nibp_sys'], status: 'offen', created: '2026-03-04T08:00:00.000Z',
}
const antwort: Stellungnahme = {
  id: 's1', rueckfrage_id: 'r1', text: 'Am Oberarm bei Zittern gemessen, Kontrolle 110.',
  von: 'A. Berger', created: '2026-03-04T08:40:00.000Z',
}

describe('Rückfragen zum Ausdrucken', () => {
  it('nennt Frage, Antwort und beide Namen', () => {
    const s = rueckfrageSeite(KOPF, [frage], [antwort], { von: 'Dr. Weber', am: AM })
    expect(s).toContain('Der Puls passt nicht zum Blutdruck.')
    expect(s).toContain('Am Oberarm bei Zittern gemessen, Kontrolle 110.')
    expect(s).toContain('Dr. Weber')
    expect(s).toContain('A. Berger')
    expect(s).toContain('Mustermann Erika')
    expect(s).toContain('Einsatz-Nr. 2026-0815')
  })

  it('nennt die markierten Felder im Wortlaut des Bogens, nicht als Kennung', () => {
    const s = rueckfrageSeite(KOPF, [frage], [antwort], { am: AM })
    expect(s).toMatch(/Markiert im Protokoll: [^<]*HF/)
    expect(s).not.toContain('nibp_sys')
  })

  it('sagt es, wenn eine Stellungnahme fehlt', () => {
    const s = rueckfrageSeite(KOPF, [frage], [], { am: AM })
    expect(s).toContain('Noch keine Stellungnahme eingegangen.')
  })

  it('verlangt beim Vermerk des Systems keine Stellungnahme', () => {
    const vermerk: Rueckfrage = { id: 'v1', frage: 'Mannschaft nachgetragen.', created_by: 'System', status: 'offen', created: '' }
    const s = rueckfrageSeite(KOPF, [vermerk], [], { am: AM })
    expect(s).toContain('Vermerk')
    expect(s).not.toContain('Noch keine Stellungnahme eingegangen.')
  })

  it('sagt es, wenn es nichts zu drucken gibt', () => {
    expect(rueckfrageSeite(KOPF, [], [], { am: AM })).toContain('Keine Rückfragen vorhanden.')
  })

  it('lässt Schrift aus dem Protokoll keinen Code werden', () => {
    const bos: Rueckfrage = {
      id: 'r2', frage: '<script>alert(1)</script> & "Anführungszeichen"',
      von: '<b>Weber</b>', status: 'offen', created: '',
    }
    const s = rueckfrageSeite({ name: '<img src=x>' }, [bos], [], { am: AM })
    expect(s).not.toContain('<script>')
    expect(s).not.toContain('<img src=x>')
    expect(s).toContain('&lt;script&gt;')
    expect(s).toContain('&amp;')
  })

  it('zeigt mehrere Rückfragen in ihrer Reihenfolge, durchnummeriert', () => {
    const zwei: Rueckfrage = { ...frage, id: 'r2', frage: 'Und warum kein EKG?' }
    const s = rueckfrageSeite(KOPF, [frage, zwei], [antwort], { am: AM })
    expect(s.indexOf('Rückfrage 1')).toBeLessThan(s.indexOf('Rückfrage 2'))
    expect(s.indexOf('Der Puls passt')).toBeLessThan(s.indexOf('Und warum kein EKG?'))
  })
})
