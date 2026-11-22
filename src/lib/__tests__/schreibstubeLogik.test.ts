// Schreibstube (src/pages/schreibstube/logik.ts, Owner 22.11.2026).
import { describe, expect, it } from 'vitest'
import { anzeigeName, artName, dokSchluessel, dokArt, dokumente, editorTyp, filtern, merken, merkerLesen, neuerName, ordnerWahl, wannText, zuletzt } from '../../pages/schreibstube/logik'
import type { Eintrag } from '../../pages/dateien/logik'

const e = (x: Partial<Eintrag>): Eintrag => ({ id: 'x', name: 'x', is_folder: false, parent_folder_id: '', organization_id: 'o', created: '2026-11-01 10:00:00.000Z', ...x })

describe('Dokumente der Ablage', () => {
  const alle = [
    e({ id: 'o', name: 'Ausbildung', is_folder: true }),
    e({ id: 'a', name: 'Dienstplan', file: 'dienstplan_x1.xlsx', updated: '2026-11-10 10:00:00.000Z' }),
    e({ id: 'b', name: 'Hygieneplan.docx', file: 'hygieneplan_x2.docx', updated: '2026-11-18 10:00:00.000Z' }),
    e({ id: 'c', name: 'Foto.jpg', file: 'foto_x3.jpg', updated: '2026-11-19 10:00:00.000Z' }),
    e({ id: 'd', name: 'ohne Datei.docx', updated: '2026-11-20 10:00:00.000Z' }),
    e({ id: 'p', name: 'AAO.pdf', file: 'aao_x4.pdf', updated: '2026-11-05 10:00:00.000Z' }),
  ]
  it('nur bearbeitbare mit Datei, keine Ordner, das zuletzt geänderte zuerst', () => {
    expect(dokumente(alle).map((x) => x.id)).toEqual(['b', 'a', 'p'])
  })
  it('Art nach der gespeicherten Datei, auch wenn der Name keine Endung hat', () => {
    expect(dokArt(alle[1])).toBe('tabelle')
    expect(artName(dokArt(alle[1]))).toBe('Tabelle')
    expect(artName('pdf')).toBe('PDF')
  })
  it('Filter nach Art und Suche', () => {
    const d = dokumente(alle)
    expect(filtern(d, 'tabelle', '').map((x) => x.id)).toEqual(['a'])
    expect(filtern(d, 'pdf', '').map((x) => x.id)).toEqual(['p'])
    expect(filtern(d, 'alle', 'hygiene').map((x) => x.id)).toEqual(['b'])
    expect(filtern(d, 'text', 'dienst')).toEqual([])
  })
})

describe('Anzeigename', () => {
  it('ohne Endung, die steht daneben', () => {
    expect(anzeigeName('Dienstplan Dezember.xlsx')).toBe('Dienstplan Dezember')
    expect(anzeigeName('Bericht')).toBe('Bericht')
    expect(anzeigeName('.docx')).toBe('.docx')
    expect(anzeigeName('Version 1.2 final.docx')).toBe('Version 1.2 final')
  })
})

describe('Editor-Typ', () => {
  it('nach Endung', () => {
    expect(editorTyp('a.docx')).toBe('word')
    expect(editorTyp('a.ODS')).toBe('cell')
    expect(editorTyp('a.pptx')).toBe('slide')
    expect(editorTyp('a.pdf')).toBe('pdf')
    expect(editorTyp('ohne')).toBe('word')
  })
})

describe('Zuletzt geöffnet', () => {
  it('Merker: vorne dazu, ohne Doppelte, höchstens 10', () => {
    expect(merken(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c'])
    expect(merken(Array.from({ length: 10 }, (_, i) => String(i)), 'neu')).toHaveLength(10)
  })
  it('kaputte Merker ergeben eine leere Liste', () => {
    expect(merkerLesen(null)).toEqual([])
    expect(merkerLesen('kaputt')).toEqual([])
    expect(merkerLesen('{"a":1}')).toEqual([])
    expect(merkerLesen('["a",2,"b"]')).toEqual(['a', 'b'])
  })
  it('nur was es noch gibt, in der Reihenfolge des Merkers', () => {
    const l = [e({ id: 'a' }), e({ id: 'b' })]
    expect(zuletzt(['weg', 'b', 'a'], l).map((x) => x.id)).toEqual(['b', 'a'])
  })
})

describe('Neues Dokument', () => {
  it('Name gesäubert, Endung richtig', () => {
    expect(neuerName('  Dienstplan Dezember ', 'xlsx')).toBe('Dienstplan Dezember.xlsx')
    expect(neuerName('Bericht.docx', 'docx')).toBe('Bericht.docx')
    expect(neuerName('Bericht.xlsx', 'docx')).toBe('Bericht.docx')
    expect(neuerName('a/b', 'pptx')).toBe('a b.pptx')
    expect(neuerName('   ', 'docx')).toBe('')
  })
  it('Ordner mit Pfad zur Auswahl', () => {
    const alle = [e({ id: 'a', name: 'Ausbildung', is_folder: true }), e({ id: 'b', name: '2027', is_folder: true, parent_folder_id: 'a' }), e({ id: 'c', name: 'Dienstpläne', is_folder: true })]
    expect(ordnerWahl(alle).map((o) => o.titel)).toEqual(['Ausbildung', 'Ausbildung › 2027', 'Dienstpläne'])
  })
})

describe('Wann', () => {
  const jetzt = Date.parse('2026-11-19T10:00:00Z')
  it('relativ, später als Datum', () => {
    expect(wannText('2026-11-19 09:59:40.000Z', jetzt)).toBe('gerade eben')
    expect(wannText('2026-11-19 09:15:00.000Z', jetzt)).toBe('vor 45 Min.')
    expect(wannText('2026-11-19 07:00:00.000Z', jetzt)).toBe('vor 3 Std.')
    expect(wannText('2026-11-18 09:00:00.000Z', jetzt)).toBe('vor 1 Tag')
    expect(wannText('2026-11-15 09:00:00.000Z', jetzt)).toBe('vor 4 Tagen')
    expect(wannText('2026-10-01 09:00:00.000Z', jetzt)).toBe('1.10.2026')
    expect(wannText('', jetzt)).toBe('')
  })
})

describe('Schlüssel für den Office-Server', () => {
  const d = { sammlung: 'ausbildungen_termine', id: 'termin000000001', feld: 'anhang', nr: 0, datei: 'ablauf_x1.docx', stand: '2026-11-19 08:00:00.000Z' }
  it('verschiedene Anhänge desselben Datensatzes, verschiedene Schlüssel', () => {
    expect(dokSchluessel(d)).not.toBe(dokSchluessel({ ...d, nr: 1, datei: 'liste_x2.xlsx' }))
    expect(dokSchluessel(d)).not.toBe(dokSchluessel({ ...d, feld: 'dateien' }))
  })
  it('neuer Stand, neuer Schlüssel; gleicher Stand, gleicher Schlüssel', () => {
    expect(dokSchluessel(d)).toBe(dokSchluessel({ ...d }))
    expect(dokSchluessel(d)).not.toBe(dokSchluessel({ ...d, stand: '2026-11-19 09:00:00.000Z' }))
  })
  it('nur erlaubte Zeichen, höchstens 128', () => {
    const lang = dokSchluessel({ ...d, datei: 'ä'.repeat(200) + '.docx' })
    for (const k of [dokSchluessel(d), lang]) {
      expect(k).toMatch(/^[0-9A-Za-z._=-]+$/)
      expect(k.length).toBeLessThanOrEqual(128)
    }
    expect(lang).not.toBe(dokSchluessel({ ...d, datei: 'ö'.repeat(200) + '.docx' }))
  })
})
