// Dateien (src/pages/dateien/logik.ts, Owner 22.11.2026).
import { describe, expect, it } from 'vitest'
import { art, bearbeitbar, groesse, nachkommen, nameSauber, nameVergeben, passt, pfad, sortieren, umbenennen, type Eintrag } from '../../pages/dateien/logik'

const e = (x: Partial<Eintrag>): Eintrag => ({ id: 'x', name: 'x', is_folder: false, parent_folder_id: '', organization_id: 'o', created: '', ...x })

describe('Art und Größe', () => {
  it('erkennt Arten an der Endung', () => {
    expect(art(e({ is_folder: true, name: 'Ordner.pdf' }))).toBe('ordner')
    expect(art(e({ name: 'Bericht.PDF' }))).toBe('pdf')
    expect(art(e({ name: 'Dienstplan.xlsx' }))).toBe('tabelle')
    expect(art(e({ name: 'Foto.jpeg' }))).toBe('bild')
    expect(art(e({ name: 'ohne_endung' }))).toBe('datei')
    expect(art(e({ name: '.versteckt' }))).toBe('datei')
  })
  it('bearbeitbar nur Dokumente, nie Ordner', () => {
    expect(bearbeitbar(e({ name: 'a.docx' }))).toBe(true)
    expect(bearbeitbar(e({ name: 'a.jpg' }))).toBe(false)
    expect(bearbeitbar(e({ name: 'a.docx', is_folder: true }))).toBe(false)
  })
  it('Größe lesbar', () => {
    expect(groesse(0)).toBe('')
    expect(groesse(512)).toBe('512 Byte')
    expect(groesse(1536)).toBe('1,5 KB')
    expect(groesse(5 * 1024 * 1024)).toBe('5 MB')
  })
})

describe('Ordnung und Pfad', () => {
  it('Ordner zuerst, Zahlen natürlich', () => {
    const l = sortieren([e({ id: '1', name: 'Datei 10.pdf' }), e({ id: '2', name: 'Datei 2.pdf' }), e({ id: '3', name: 'Zeta', is_folder: true })])
    expect(l.map((x) => x.id)).toEqual(['3', '2', '1'])
  })
  it('Pfad von oben, Schleifen brechen ab', () => {
    const o = [e({ id: 'a', name: 'A' }), e({ id: 'b', name: 'B', parent_folder_id: 'a' }), e({ id: 'c', name: 'C', parent_folder_id: 'b' })]
    expect(pfad('c', o).map((x) => x.name)).toEqual(['A', 'B', 'C'])
    expect(pfad('x', o)).toEqual([])
    const schleife = [e({ id: 'p', name: 'P', parent_folder_id: 'q' }), e({ id: 'q', name: 'Q', parent_folder_id: 'p' })]
    expect(pfad('p', schleife).length).toBe(2)
  })
  it('Nachkommen aller Ebenen, die tiefsten zuerst', () => {
    const alle = [
      e({ id: 'a', is_folder: true }), e({ id: 'b', is_folder: true, parent_folder_id: 'a' }), e({ id: 'c', parent_folder_id: 'b' }),
      e({ id: 'd', parent_folder_id: 'a' }), e({ id: 'z', parent_folder_id: '' }),
    ]
    const n = nachkommen('a', alle)
    expect(new Set(n)).toEqual(new Set(['b', 'c', 'd']))
    expect(n.indexOf('c')).toBeLessThan(n.indexOf('b'))
    expect(nachkommen('z', alle)).toEqual([])
  })
})

describe('Namen und Suche', () => {
  it('säubert Namen', () => {
    expect(nameSauber('  Ein/Ordner\n ')).toBe('Ein Ordner')
    expect(nameSauber('x'.repeat(200)).length).toBe(120)
  })
  it('Endung bleibt beim Umbenennen', () => {
    expect(umbenennen(e({ name: 'Bericht.pdf' }), 'Einsatzbericht')).toBe('Einsatzbericht.pdf')
    expect(umbenennen(e({ name: 'Bericht.pdf' }), 'Neu.pdf')).toBe('Neu.pdf')
    expect(umbenennen(e({ name: 'Ordner', is_folder: true }), 'Neu')).toBe('Neu')
  })
  it('Name schon vergeben, Groß/Klein egal', () => {
    const l = [e({ id: '1', name: 'Dienstplan.xlsx' })]
    expect(nameVergeben(l, 'dienstplan.XLSX')).toBe(true)
    expect(nameVergeben(l, 'dienstplan.xlsx', '1')).toBe(false)
  })
  it('Suche über Wörter', () => {
    expect(passt(e({ name: 'Dienstplan November.xlsx' }), 'november dienst')).toBe(true)
    expect(passt(e({ name: 'Dienstplan.xlsx' }), 'oktober')).toBe(false)
  })
})
