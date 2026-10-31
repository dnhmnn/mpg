import { describe, expect, it, vi, beforeEach } from 'vitest'
import PocketBase from 'pocketbase'

// Echte Filter-Bindung des SDK, nur die Anfrage selbst ist ersetzt
const echt = new PocketBase('http://localhost')
const getList = vi.fn()
vi.mock('../pocketbase', () => ({
  pb: {
    filter: (f: string, p: Record<string, unknown>) => echt.filter(f, p),
    collection: () => ({ getList }),
  },
}))

const { mitgliederSuchen, neueSuche, suchtext } = await import('../../pages/public/mitgliederSuche')

const antwort = (namen: string[]) => ({ items: namen.map((n, i) => ({ id: `u${i}`, name: n, email: `${i}@test.invalid` })) })
/** Eine Anfrage, deren Antwort der Test selbst auslöst */
function offen() {
  let fertig!: (v: unknown) => void, fehl!: (e: unknown) => void
  getList.mockImplementationOnce(() => new Promise((res, rej) => { fertig = res; fehl = rej }))
  return { fertig: (v: unknown) => fertig(v), fehl: (e: unknown) => fehl(e) }
}

describe('Mitgliedersuche der öffentlichen Formulare', () => {
  beforeEach(() => { getList.mockReset(); getList.mockResolvedValue(antwort(['Anna Berg'])) })

  it('fragt nur Kennung und Name ab und gibt keine E-Mail weiter', async () => {
    expect(await mitgliederSuchen('org1', 'Anna')).toEqual([{ id: 'u0', name: 'Anna Berg' }])
    expect(getList.mock.calls[0][2].fields).toBe('id,name')
  })

  it('bindet die Eingabe sicher: Anführungszeichen öffnen keine andere Organisation', async () => {
    await mitgliederSuchen('org1', 'x" || name != "')
    await mitgliederSuchen('org1', "x' || name != '")
    // Doppelte stehen im einfach gequoteten Wert, einfache werden maskiert: beides bleibt Suchtext
    expect(getList.mock.calls[0][2].filter).toBe(`organization_id = 'org1' && name ~ 'x" || name != "'`)
    expect(getList.mock.calls[1][2].filter).toBe(`organization_id = 'org1' && name ~ 'x\\' || name != \\''`)
  })

  it('Platzhalter % und _ zählen nicht: „%%“ oder „__“ listet nicht alle', async () => {
    expect(suchtext(' A%n_na ')).toBe('Anna')
    expect(await mitgliederSuchen('org1', '%%')).toEqual([])
    expect(await mitgliederSuchen('org1', '__')).toEqual([])
    expect(await mitgliederSuchen('org1', 'a%')).toEqual([])
    expect(getList).not.toHaveBeenCalled()
  })

  it('sucht erst ab 2 Zeichen und nie ohne Organisation', async () => {
    expect(await mitgliederSuchen('org1', ' a ')).toEqual([])
    expect(await mitgliederSuchen('', 'Anna')).toEqual([])
    expect(getList).not.toHaveBeenCalled()
  })
})

describe('Suche je Eingabefeld: nur die neueste Antwort kommt an', () => {
  beforeEach(() => getList.mockReset())

  it('eine langsame ältere Antwort überschreibt die neuere nicht', async () => {
    const s = neueSuche()
    const alt = offen(), neu = offen()
    const a = s.suchen('org1', 'Ma'), b = s.suchen('org1', 'Max')
    neu.fertig(antwort(['Max Muster']))
    alt.fertig(antwort(['Maria Alt', 'Max Muster']))
    expect(await b).toEqual([{ id: 'u0', name: 'Max Muster' }])
    expect(await a).toBeNull()
  })

  it('Feld geleert oder Name gewählt: die laufende Antwort öffnet keine Liste mehr', async () => {
    const s = neueSuche()
    const lauf = offen()
    const a = s.suchen('org1', 'Mü')
    s.abbrechen()
    lauf.fertig(antwort(['Müller']))
    expect(await a).toBeNull()
  })

  it('ein Fehler der älteren Anfrage (Funkloch) verdrängt gültige Treffer nicht', async () => {
    const s = neueSuche()
    const alt = offen(), neu = offen()
    const a = s.suchen('org1', 'An'), b = s.suchen('org1', 'Ann')
    neu.fertig(antwort(['Anna Berg']))
    alt.fehl(new Error('offline'))
    expect(await b).toEqual([{ id: 'u0', name: 'Anna Berg' }])
    expect(await a).toBeNull()
  })

  it('der Fehler der neuesten Anfrage kommt an', async () => {
    const s = neueSuche()
    getList.mockRejectedValueOnce(new Error('offline'))
    await expect(s.suchen('org1', 'Anna')).rejects.toThrow('offline')
  })

  it('jedes Feld zählt für sich', async () => {
    const tf = neueSuche(), m1 = neueSuche()
    const x = offen(), y = offen()
    const a = tf.suchen('org1', 'Anna'), b = m1.suchen('org1', 'Bernd')
    y.fertig(antwort(['Bernd Kurz'])); x.fertig(antwort(['Anna Berg']))
    expect(await a).toEqual([{ id: 'u0', name: 'Anna Berg' }])
    expect(await b).toEqual([{ id: 'u0', name: 'Bernd Kurz' }])
  })
})
