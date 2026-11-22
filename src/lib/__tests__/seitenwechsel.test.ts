// Seitenwechsel ohne leere Zwischenfläche (Owner, 22.11.2026): der zuletzt bestätigte Benutzer
// (src/hooks/useAuth.ts) gilt nur für dieselbe gültige Anmeldung, und der Hub findet zu jeder App
// ihren Baustein zum Vorladen (src/lib/seitenLaden.ts).
import { describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => {
  const hoerer: ((token: string, rec: { id?: string } | null) => void)[] = []
  return {
    token: 't', isValid: true, record: { id: 'lena' } as { id?: string } | null,
    get model() { return this.record },
    onChange(f: (token: string, rec: { id?: string } | null) => void) { hoerer.push(f); return () => {} },
    melden(token: string, rec: { id?: string } | null) { this.token = token; this.record = rec; this.isValid = !!token; for (const f of hoerer) f(token, rec) },
  }
})
vi.mock('../pocketbase', () => ({ pb: { baseURL: 'https://api.test', authStore: auth } }))

const { zuletztBestaetigt, zuletztMerken, zuletztErgaenzen } = await import('../../hooks/useAuth')
const { appEinblenden, appVonPfad, bausteinFuer, SEITEN } = await import('../seitenLaden')

const lena = { id: 'lena', name: 'Lena Berger', hub_apps: null } as unknown as Parameters<typeof zuletztMerken>[0]

describe('zuletzt bestätigter Benutzer', () => {
  it('gilt für dieselbe gültige Anmeldung', () => {
    auth.melden('t', { id: 'lena' })
    zuletztMerken(lena)
    expect(zuletztBestaetigt()?.id).toBe('lena')
  })
  it('nicht, wenn die Anmeldung abgelaufen ist', () => {
    auth.melden('t', { id: 'lena' })
    zuletztMerken(lena)
    auth.isValid = false
    expect(zuletztBestaetigt()).toBeNull()
    auth.isValid = true
  })
  it('Abmelden vergisst ihn, auch bei erneuter Anmeldung derselben Person', () => {
    auth.melden('t', { id: 'lena' })
    zuletztMerken(lena)
    auth.melden('', null)
    auth.melden('t2', { id: 'lena' })
    expect(zuletztBestaetigt()).toBeNull()
  })
  it('andere Person auf dem Gerät: vergessen', () => {
    auth.melden('t', { id: 'lena' })
    zuletztMerken(lena)
    auth.melden('t3', { id: 'jonas' })
    expect(zuletztBestaetigt()).toBeNull()
    auth.melden('t4', { id: 'lena' })
    expect(zuletztBestaetigt()).toBeNull()
  })
  it('Erneuern derselben Anmeldung behält ihn; eigene Änderungen kommen dazu', () => {
    auth.melden('t', { id: 'lena' })
    zuletztMerken(lena)
    auth.melden('t-neu', { id: 'lena' })
    zuletztErgaenzen({ hub_apps: { ausgeblendet: ['chat'], reihenfolge: [] } })
    expect((zuletztBestaetigt() as unknown as { hub_apps: unknown }).hub_apps).toEqual({ ausgeblendet: ['chat'], reihenfolge: [] })
  })
})

describe('eigene Änderungen und ältere Prüfungen', () => {
  const u = (x: Record<string, unknown>) => x as unknown as Parameters<typeof zuletztMerken>[0]
  it('eigene Änderung über das SDK kommt gleich an, die Organisation bleibt', () => {
    auth.melden('t', { id: 'lena' })
    zuletztMerken(u({ id: 'lena', name: 'Lena Berger', updated: '2026-11-19 08:00:00.000Z', organization_name: 'Feuerwehr Musterstadt' }))
    auth.melden('t', { id: 'lena', name: 'Magdalena Berger', updated: '2026-11-19 09:00:00.000Z', organization_name: 'roh' } as { id: string })
    const z = zuletztBestaetigt() as unknown as Record<string, unknown>
    expect(z.name).toBe('Magdalena Berger')
    expect(z.organization_name).toBe('Feuerwehr Musterstadt')
  })
  it('ein älterer Stand überschreibt den neueren nicht', () => {
    auth.melden('t', { id: 'lena' })
    zuletztMerken(u({ id: 'lena', name: 'neu', updated: '2026-11-19 09:00:00.000Z', organization_name: 'alt' }))
    auth.melden('t', { id: 'lena', name: 'alt', updated: '2026-11-19 08:00:00.000Z' } as { id: string })
    expect((zuletztBestaetigt() as unknown as Record<string, unknown>).name).toBe('neu')
    // Prüfung kommt verspätet mit altem Stand, aber frischer Organisation
    const gilt = zuletztMerken(u({ id: 'lena', name: 'alt', updated: '2026-11-19 08:00:00.000Z', organization_name: 'Feuerwehr Musterstadt' })) as unknown as Record<string, unknown>
    expect(gilt.name).toBe('neu')
    expect(gilt.organization_name).toBe('Feuerwehr Musterstadt')
  })
})

describe('Sanft einblenden (Owner, 22.11.2026)', () => {
  it('beim Wechsel der App, auch zurück zum Hub über den Pfeil', () => {
    expect(appEinblenden('/hub', '/lager', 'PUSH')).toBe(true)
    expect(appEinblenden('/lager?seite=bestand', '/hub', 'PUSH')).toBe(true)
    expect(appEinblenden('/', '/hub', 'REPLACE')).toBe(true)
  })
  it('nicht bei Unterseiten derselben App und nicht bei Zurückwischen', () => {
    expect(appEinblenden('/lager', '/lager', 'PUSH')).toBe(false)
    expect(appEinblenden('/mpg/geraete', '/mpg/geraete/abc', 'PUSH')).toBe(false)
    expect(appEinblenden('/lager', '/hub', 'POP')).toBe(false)
  })
})

describe('Bausteine zum Vorladen', () => {
  it('App eines Pfads', () => {
    expect(appVonPfad('/mpg/geraete/abc')).toBe('/mpg')
    expect(appVonPfad('/mpg')).toBe('/mpg')
    expect(appVonPfad('/lager?seite=bestand')).toBe('/lager')
    expect(appVonPfad('/')).toBe('/')
  })
  it('findet den Baustein über die Wurzel des Pfads', () => {
    expect(bausteinFuer('/lager')).toBe(SEITEN['/lager'])
    expect(bausteinFuer('/lager?seite=bestand')).toBe(SEITEN['/lager'])
    expect(bausteinFuer('/mpg/geraete/abc')).toBe(SEITEN['/mpg'])
    expect(bausteinFuer('/files')).toBe(SEITEN['/files'])
  })
  it('nichts für Unbekanntes und Externes', () => {
    expect(bausteinFuer('/gibtsnicht')).toBeNull()
    expect(bausteinFuer('#settings')).toBeNull()
    expect(bausteinFuer('https://example.org/x')).toBeNull()
  })
  it('jede App des Hubs mit eigener Seite hat einen Baustein', async () => {
    const { ALL_APPS } = await import('../apps')
    const intern = Object.values(ALL_APPS).filter((a) => a.isInternal && a.url.startsWith('/'))
    for (const a of intern) expect(bausteinFuer(a.url), a.url).not.toBeNull()
  })
})

describe('Roter Zwischenbildschirm (src/components/Zwischenschirm.tsx)', async () => {
  const { zwischenAn, zeichenVerzug, startVorbei, ZEICHEN_NACH_MS } = await import('../../components/Zwischenschirm')
  const el = () => {
    const klassen = new Set<string>()
    return { klassen, classList: { add: (c: string) => { klassen.add(c) }, remove: (c: string) => { klassen.delete(c) } } }
  }
  it('färbt, solange er steht, und gibt danach frei', () => {
    const h = el()
    const weg = zwischenAn(h)
    expect(h.klassen.has('zwischen')).toBe(true)
    weg()
    expect(h.klassen.has('zwischen')).toBe(false)
  })
  it('Wechsel von Schirm zu Schirm im selben Bild: bleibt rot bis zum letzten', () => {
    const h = el()
    const ersatz = zwischenAn(h)
    const seite = zwischenAn(h)
    ersatz()
    expect(h.klassen.has('zwischen')).toBe(true)
    seite()
    expect(h.klassen.has('zwischen')).toBe(false)
  })
  it('doppeltes Verschwinden zählt nur einmal', () => {
    const h = el()
    const a = zwischenAn(h)
    const b = zwischenAn(h)
    a(); a()
    expect(h.klassen.has('zwischen')).toBe(true)
    b()
    expect(h.klassen.has('zwischen')).toBe(false)
  })
  it('Zeichen läuft über Übergänge weiter, statt neu einzublenden', () => {
    const h = el()
    startVorbei(h, 0)
    // neue rote Zeit lange nach dem Start: volle Verzögerung
    expect(zeichenVerzug(10_000)).toBe(ZEICHEN_NACH_MS)
    const ersatz = zwischenAn(h, 10_000)
    // 400 ms später übernimmt der Ladezweig der Seite im selben Bild: schon eingeblendet (negativ)
    const seite = zwischenAn(h, 10_400)
    ersatz(10_400)
    expect(zeichenVerzug(10_400)).toBe(ZEICHEN_NACH_MS - 400)
    seite(10_600)
    // Schirm weg, im selben Bild ein neuer (Wechsel): Zeit läuft weiter
    expect(zeichenVerzug(10_650)).toBe(ZEICHEN_NACH_MS - 650)
    // Später ein ganz neuer Schirm: wieder von vorn
    expect(zeichenVerzug(12_000)).toBe(ZEICHEN_NACH_MS)
    zwischenAn(h, 12_000)()
  })
})

