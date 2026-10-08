import { describe, it, expect } from 'vitest'
import {
  archivHindernis, feldname, markierteFelder, offeneRueckfragen, rueckfrageStellen,
  stellungNehmen, stellungnahmeZu, stellungnahmen, rueckfragen,
} from '../../pages/public/doku/rueckfrage'

const JETZT = new Date('2026-03-04T09:12:00.000Z')

describe('Rückfrage stellen', () => {
  it('hängt die Frage mit ihren Feldern an', () => {
    const p = rueckfrageStellen({}, {
      frage: '  Der Puls passt nicht zum Blutdruck.  ',
      felder: ['hf', 'nibp_sys'], von: 'Dr. Weber', id: 'r1', jetzt: JETZT,
    })
    const rq = rueckfragen(p)[0]
    expect(rueckfragen(p)).toHaveLength(1)
    expect(rq.frage).toBe('Der Puls passt nicht zum Blutdruck.')
    expect(rq.felder).toEqual(['hf', 'nibp_sys'])
    expect(rq.von).toBe('Dr. Weber')
    expect(rq.status).toBe('offen')
    expect(rq.created).toBe('2026-03-04T09:12:00.000Z')
  })

  it('lässt vorhandene Rückfragen und das übrige Protokoll stehen', () => {
    const eins = rueckfrageStellen({ name: 'Mustermann', hf: '120' }, { frage: 'A', id: 'r1', jetzt: JETZT })
    const zwei = rueckfrageStellen(eins, { frage: 'B', id: 'r2', jetzt: JETZT })
    expect(rueckfragen(zwei).map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(zwei.name).toBe('Mustermann')
    expect(zwei.hf).toBe('120')
  })

  it('kommt mit einem Protokoll ohne Rückfrageliste zurecht', () => {
    expect(rueckfragen(null)).toEqual([])
    expect(rueckfragen({ rueckfragen: 'kaputt' })).toEqual([])
    expect(stellungnahmen(undefined)).toEqual([])
  })
})

describe('Stellung nehmen', () => {
  const gefragt = rueckfrageStellen({ hf: '120' }, {
    frage: 'Warum kein EKG?', felder: ['ekg_rhythmus'], von: 'Dr. Weber', id: 'r1', jetzt: JETZT,
  })

  it('setzt die Antwort neben die Frage, ohne das Protokoll zu ändern', () => {
    const p = stellungNehmen(gefragt, {
      rueckfrageId: 'r1', text: 'Patient lehnte ab.', von: 'Huber', id: 's1', jetzt: JETZT,
    })
    expect(stellungnahmeZu(p, 'r1')?.text).toBe('Patient lehnte ab.')
    expect(stellungnahmeZu(p, 'r1')?.von).toBe('Huber')
    expect(rueckfragen(p)[0].status).toBe('beantwortet')
    // Das Dokumentierte bleibt stehen — die Erklärung steht daneben.
    expect(p.hf).toBe('120')
    expect(rueckfragen(p)[0].frage).toBe('Warum kein EKG?')
  })

  it('zählt eine beantwortete Rückfrage nicht mehr als offen', () => {
    expect(offeneRueckfragen(gefragt)).toHaveLength(1)
    const p = stellungNehmen(gefragt, { rueckfrageId: 'r1', text: 'Abgelehnt.', id: 's1', jetzt: JETZT })
    expect(offeneRueckfragen(p)).toHaveLength(0)
  })

  it('erkennt eine Antwort auch dann, wenn der Stand fehlt', () => {
    // Ältere Protokolle führten den Stand nicht immer mit.
    const alt = { rueckfragen: [{ id: 'r1', frage: 'A', status: 'offen', created: '' }],
                  stellungnahmen: [{ id: 's1', rueckfrage_id: 'r1', text: 'B', created: '' }] }
    expect(offeneRueckfragen(alt)).toHaveLength(0)
  })
})

describe('Vermerke des Systems', () => {
  const p = { rueckfragen: [
    { id: 'v1', frage: 'Protokoll wurde geöffnet.', created_by: 'System', status: 'offen', created: '' },
  ] }

  it('verlangen keine Stellungnahme', () => {
    expect(offeneRueckfragen(p)).toHaveLength(0)
    expect(archivHindernis(p)).toBe('')
  })
})

describe('markierte Felder', () => {
  it('führt jedes Feld einmal, über alle offenen Rückfragen', () => {
    const eins = rueckfrageStellen({}, { frage: 'A', felder: ['hf', 'nibp_sys'], id: 'r1', jetzt: JETZT })
    const zwei = rueckfrageStellen(eins, { frage: 'B', felder: ['nibp_sys', 'gcs_summe'], id: 'r2', jetzt: JETZT })
    expect(markierteFelder(zwei)).toEqual(['hf', 'nibp_sys', 'gcs_summe'])
  })

  it('lässt die Felder einer beantworteten Rückfrage fallen', () => {
    const eins = rueckfrageStellen({}, { frage: 'A', felder: ['hf'], id: 'r1', jetzt: JETZT })
    const zwei = rueckfrageStellen(eins, { frage: 'B', felder: ['bz'], id: 'r2', jetzt: JETZT })
    const beantwortet = stellungNehmen(zwei, { rueckfrageId: 'r1', text: 'X', id: 's1', jetzt: JETZT })
    expect(markierteFelder(beantwortet)).toEqual(['bz'])
  })

  it('nennt die Felder so, wie sie auf dem Bogen heißen', () => {
    expect(feldname('hf')).not.toBe('hf')
    expect(feldname('hf').length).toBeGreaterThan(1)
    // Ein Feld, das der Bogen nicht führt, behält seine Kennung.
    expect(feldname('gibtsnicht')).toBe('gibtsnicht')
  })
})

describe('archivieren', () => {
  it('ist frei, solange keine Rückfrage offen ist', () => {
    expect(archivHindernis({})).toBe('')
    const p = rueckfrageStellen({}, { frage: 'A', id: 'r1', jetzt: JETZT })
    expect(archivHindernis(stellungNehmen(p, { rueckfrageId: 'r1', text: 'B', id: 's1', jetzt: JETZT }))).toBe('')
  })

  it('nennt die offenen Rückfragen als Hindernis', () => {
    const eins = rueckfrageStellen({}, { frage: 'A', id: 'r1', jetzt: JETZT })
    expect(archivHindernis(eins)).toMatch(/Eine Rückfrage/)
    const zwei = rueckfrageStellen(eins, { frage: 'B', id: 'r2', jetzt: JETZT })
    expect(archivHindernis(zwei)).toMatch(/^2 Rückfragen/)
  })
})

/**
 * Die Nachbearbeitung ist abgeschafft.
 *
 * Sie öffnete ein abgesendetes Protokoll noch einmal zum Schreiben — damit
 * ließ sich nachträglich ändern, was im Einsatz dokumentiert wurde. An ihre
 * Stelle tritt die Rückfrage mit der Stellungnahme daneben. Ein Prüffall
 * dafür, weil sich so etwas leicht wieder einschleicht.
 */
describe('kein zweites Schreibfenster', () => {
  const dateien = [
    'src/pages/Unitas.tsx',
    'src/pages/patienten/Patienten.tsx',
    'src/components/RueckfrageFenster.tsx',
    'src/pages/public/doku/rueckfrage.ts',
  ]

  it('legt nirgends mehr eine Nachbearbeitung an', async () => {
    const { readFileSync } = await import('node:fs')
    const schreibt = dateien.filter((d) => /tf_reopen/.test(readFileSync(d, 'utf8')))
    expect(schreibt).toEqual([])
  })
})
