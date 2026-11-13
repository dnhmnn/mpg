import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ token: '', isValid: false, record: null as Record<string, unknown> | null, get model() { return this.record }, onChange: () => () => {} }))
vi.mock('../pocketbase', () => ({ pb: { baseURL: 'https://api.test', authStore: auth } }))

const {
  naechsterSchritt, altSatz, eintragAusfuehren, abarbeiten, formularSenden, sendenOderAblegen, ablegenMitMeldung, ohnePasswortMoeglich, schrittOhnePasswort,
  aenderungAbgewiesen, verwerfen, absenderNameSetzen, eintragKopf, eintragBezug, gesendetText, druckfeld, FEHLER_PAUSE_MS, MELDUNGEN,
  bleibenderFehler, bleibendHinweis, verwerfenFrageText, nameFalsch, BLEIBENDE_GRUENDE,
} = await import('../formular/versand')
const { ablegen, eintraege, OHNE_PASSWORT_NACH_MS } = await import('../formular/warteschlange')
const { datensatz, titel } = await import('../../pages/public/doku/absenden')
const { mitFassung, NEUE_FASSUNG } = await import('../protokoll')
type Warteeintrag = import('../formular/warteschlange').Warteeintrag
type Stand = import('../formular/api').Stand
type NeuerEintrag = import('../formular/warteschlange').NeuerEintrag

function speicher() {
  const d = new Map<string, string>()
  return {
    d,
    get length() { return d.size },
    key: (i: number) => [...d.keys()][i] ?? null,
    getItem: (k: string) => (d.has(k) ? d.get(k)! : null),
    setItem: (k: string, v: string) => { d.set(k, String(v)) },
    removeItem: (k: string) => { d.delete(k) },
  }
}

type Aufruf = { url: string; method: string; body: Record<string, unknown> | null; auth?: string }
let aufrufe: Aufruf[] = []
let antworten: (() => Response)[] = []
const json = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status })
const keinNetz = () => () => { throw new TypeError('Failed to fetch') }
const ALT404 = json(404, { status: 404, message: 'File not found.', data: {} })

let ls: ReturnType<typeof speicher>
beforeEach(() => {
  aufrufe = []; antworten = []
  ls = speicher()
  vi.stubGlobal('localStorage', ls)
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const h = (init.headers ?? {}) as Record<string, string>
    aufrufe.push({ url, method: String(init.method), body: init.body ? JSON.parse(String(init.body)) : null, auth: h.Authorization })
    const a = antworten.shift()
    if (!a) throw new Error('keine Antwort vorbereitet')
    return a()
  }))
  auth.token = ''; auth.isValid = false; auth.record = null
})
afterEach(() => { vi.unstubAllGlobals() })
const anmelden = (id = 'u1') => { auth.token = 'TOKEN-' + id; auth.isValid = true; auth.record = { id, name: 'Anna Berg', organization_id: 'org1' } }

const JETZT = new Date('2026-10-31T13:20:00.000Z')
const fs = (modus: 'passwort' | 'frei', ausstehend = true) => ({ modus, an: true, oeffentlich: true, ausstehend })
const stand = (modus: 'passwort' | 'frei', ausstehend = true): Stand => ({
  version: 1,
  formulare: { patienten: fs(modus, ausstehend), produktausgabe: fs(modus, ausstehend), defektmeldung: fs(modus, ausstehend), cirs: { modus: 'anonym', an: true, oeffentlich: true, ausstehend: false } },
  angemeldet: null,
})
const eintrag = (x: Partial<Warteeintrag> = {}): Warteeintrag => ({
  v: 2, id: 'abcdefghij01234', formular: 'patienten', maske: 'doku', orgCode: 'wache1', orgId: 'org1',
  angelegt: '2026-10-31T10:00:00.000Z', absenderName: 'Anna Berg', angemeldetId: '', versuche: 0,
  daten: { title: 'Patientendoku: Max Muster', payload: { name: 'Muster', unterschrift: 'Anna Berg' } },
  ...x,
})
const k = (x: Partial<Parameters<typeof naechsterSchritt>[1]> = {}) => ({ online: true, stand: stand('passwort'), serverAlt: false, tokenId: '', jetzt: JETZT, ...x })
const minuten = (m: number) => new Date(JETZT.getTime() - m * 60_000).toISOString()

describe('naechsterSchritt (1.18, Versandregeln)', () => {
  it('offline wartet, vor allem anderen', () => {
    expect(naechsterSchritt(eintrag({ ziel: 'zzzzzzzzzzzzzzz', angemeldetId: 'u1' }), k({ online: false, tokenId: 'u1', serverAlt: true }))).toEqual({ art: 'warten' })
  })

  it('naechsterVersuchAb in der Zukunft wartet bis dahin, vergangen nicht', () => {
    const bis = new Date(JETZT.getTime() + 30_000).toISOString()
    expect(naechsterSchritt(eintrag({ naechsterVersuchAb: bis, ziel: 'zzzzzzzzzzzzzzz' }), k())).toEqual({ art: 'warten', bis })
    expect(naechsterSchritt(eintrag({ naechsterVersuchAb: minuten(1) }), k({ stand: stand('frei') })).art).toBe('senden')
    expect(naechsterSchritt(eintrag({ naechsterVersuchAb: 'kaputt' }), k({ stand: stand('frei') })).art).toBe('senden')
  })

  it('ziel gesetzt: aendern, auch bei altem Server und Token', () => {
    expect(naechsterSchritt(eintrag({ ziel: 'zzzzzzzzzzzzzzz' }), k({ serverAlt: true }))).toEqual({ art: 'aendern', ziel: 'zzzzzzzzzzzzzzz' })
  })

  it('alter Server: alt, auch angemeldet und im Passwort-Modus', () => {
    expect(naechsterSchritt(eintrag({ angemeldetId: 'u1' }), k({ serverAlt: true, tokenId: 'u1' }))).toEqual({ art: 'alt' })
    expect(naechsterSchritt(eintrag(), k({ serverAlt: true, stand: null }))).toEqual({ art: 'alt' })
  })

  it('Token derselben Person: senden mit Token; fremdes oder fehlendes Token nie', () => {
    expect(naechsterSchritt(eintrag({ angemeldetId: 'u1' }), k({ tokenId: 'u1' }))).toEqual({ art: 'senden', absender: null, mitAnmeldung: true })
    // auch ohne Stand: die Anmeldung braucht ihn nicht
    expect(naechsterSchritt(eintrag({ angemeldetId: 'u1' }), k({ tokenId: 'u1', stand: null }))).toEqual({ art: 'senden', absender: null, mitAnmeldung: true })
    expect(naechsterSchritt(eintrag({ angemeldetId: 'u1' }), k({ tokenId: 'u2' }))).toEqual({ art: 'fragen' })
    expect(naechsterSchritt(eintrag({ angemeldetId: 'u1' }), k({ tokenId: '' }))).toEqual({ art: 'fragen' })
    expect(naechsterSchritt(eintrag({ angemeldetId: '' }), k({ tokenId: 'u1', stand: stand('frei') }))).toEqual({ art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: false })
  })

  it('ohne Stand (Modus unbekannt) wartet', () => {
    expect(naechsterSchritt(eintrag(), k({ stand: null }))).toEqual({ art: 'warten' })
  })

  it('Modus frei: senden ohne Token mit Namen', () => {
    expect(naechsterSchritt(eintrag({ formular: 'produktausgabe', maske: undefined }), k({ stand: stand('frei') }))).toEqual({ art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: false })
  })

  it('Passwort: fragen; nach 60 Minuten sichtbarer Frage bei eindeutigem Namen ausstehend', () => {
    const aus = { art: 'senden', absender: { name: 'Anna Berg', ausstehend: true }, mitAnmeldung: false }
    expect(naechsterSchritt(eintrag(), k())).toEqual({ art: 'fragen' })
    expect(naechsterSchritt(eintrag({ gefragtAb: minuten(59), nameEindeutig: true }), k())).toEqual({ art: 'fragen' })
    expect(naechsterSchritt(eintrag({ gefragtAb: minuten(61), nameEindeutig: true }), k())).toEqual(aus)
    expect(naechsterSchritt(eintrag({ gefragtAb: minuten(60), nameEindeutig: true }), k())).toEqual(aus)
    expect(naechsterSchritt(eintrag({ gefragtAb: minuten(61), nameEindeutig: false }), k())).toEqual({ art: 'fragen' })
    expect(naechsterSchritt(eintrag({ gefragtAb: minuten(61) }), k())).toEqual({ art: 'fragen' })
    // Server kennt „ausstehend“ nicht (Feld fehlt)
    expect(naechsterSchritt(eintrag({ gefragtAb: minuten(61), nameEindeutig: true }), k({ stand: stand('passwort', false) }))).toEqual({ art: 'fragen' })
    // gezählt ab gefragtAb, nicht ab angelegt
    expect(naechsterSchritt(eintrag({ angelegt: minuten(600), nameEindeutig: true }), k())).toEqual({ art: 'fragen' })
    expect(OHNE_PASSWORT_NACH_MS).toBe(60 * 60 * 1000)
  })

  it('Modus frei mit falschem Namen: korrigieren statt alle 60 Sekunden erneut senden', () => {
    const f = k({ stand: stand('frei') })
    expect(naechsterSchritt(eintrag({ letzterFehler: { grund: 'name', text: 't', am: '' } }), f)).toEqual({ art: 'korrigieren' })
    expect(naechsterSchritt(eintrag({ letzterFehler: { grund: 'daten', text: 't', am: '', feld: 'absender' } }), f)).toEqual({ art: 'korrigieren' })
    expect(naechsterSchritt(eintrag({ letzterFehler: { grund: 'daten', text: 't', am: '', feld: 'positionen' } }), f).art).toBe('senden')
    // im Modus Passwort steht das Namensfeld ohnehin in der Frage
    expect(naechsterSchritt(eintrag({ letzterFehler: { grund: 'name', text: 't', am: '' } }), k())).toEqual({ art: 'fragen' })
    expect(nameFalsch({ letzterFehler: { grund: 'name_unbekannt', text: '', am: '' } })).toBe(true)
    expect(nameFalsch({})).toBe(false)
  })

  it('„Ohne Passwort senden“ nur bei eindeutigem Namen und ausstehend möglich', () => {
    expect(ohnePasswortMoeglich(eintrag({ nameEindeutig: true }), stand('passwort'))).toBe(true)
    expect(ohnePasswortMoeglich(eintrag({ nameEindeutig: false }), stand('passwort'))).toBe(false)
    expect(ohnePasswortMoeglich(eintrag({}), stand('passwort'))).toBe(false)
    expect(ohnePasswortMoeglich(eintrag({ nameEindeutig: true }), stand('passwort', false))).toBe(false)
    expect(ohnePasswortMoeglich(eintrag({ nameEindeutig: true }), null)).toBe(false)
    expect(ohnePasswortMoeglich(eintrag({ nameEindeutig: true, absenderName: ' ' }), stand('passwort'))).toBe(false)
    expect(schrittOhnePasswort(eintrag())).toEqual({ art: 'senden', absender: { name: 'Anna Berg', ausstehend: true }, mitAnmeldung: false })
  })
})

describe('altSatz: der Satz für den alten Weg', () => {
  it('patients wie datensatz() der Doku, Frist und Absendezeit aus angelegt', () => {
    const werte = { name: 'Muster', vorname: 'Max', unterschrift: 'Anna Berg', mannschaft_tf: 'Tom' }
    const angelegt = new Date('2026-10-31T10:00:00.000Z')
    const e = eintrag({ angelegt: angelegt.toISOString(), daten: { title: titel(werte), payload: mitFassung(werte, NEUE_FASSUNG) } })
    const { sammlung, satz } = altSatz(e)
    expect(sammlung).toBe('patients')
    expect(satz).toEqual({ id: e.id, ...datensatz(werte, 'org1', angelegt) })
  })

  it('patients: Server-Schlüssel fallen weg, leeres Druckfeld bekommt den Absender, Titel-Rückfall je Maske', () => {
    const e = eintrag({ maske: 'schnell', absenderName: 'Lena Schnell', daten: { title: '', payload: { absender: { status: 'bestaetigt' }, eingang_sha256: 'x', aenderungen: [1], passwort: 'pw' } } })
    const { satz } = altSatz(e)
    const p = satz.payload as Record<string, unknown>
    expect(p).not.toHaveProperty('absender')
    expect(p).not.toHaveProperty('eingang_sha256')
    expect(p).not.toHaveProperty('aenderungen')
    expect(p).not.toHaveProperty('passwort')
    expect(p.ausfueller_name).toBe('Lena Schnell')
    expect(satz.title).toBe('Schnelldoku')
    expect(altSatz(eintrag({ daten: { payload: { unterschrift: 'Schon Da' } } })).satz.payload).toMatchObject({ unterschrift: 'Schon Da' })
    expect(altSatz(eintrag({ daten: { payload: {} } })).satz).toMatchObject({ title: 'Patientendoku', payload: { unterschrift: 'Anna Berg' }, status: 'offen', organization_id: 'org1' })
    expect(druckfeld('doku')).toBe('unterschrift')
    expect(druckfeld('alt')).toBe('ausfueller_name')
    expect(druckfeld(undefined)).toBe('unterschrift')
  })

  it('Produktausgabe: alt der Maske, Name aus absenderName, Kennung und Org gesetzt', () => {
    const alt = { title: 'Produktausgabe E-117 (31.10.2026)', payload: { einsatz: 'E-117', datum: '2026-10-31', user_id: '', user_name: 'Alter Name', lager_id: 'l1', lager_name: 'RTW', positionen: [{ item_id: 'i1', name: 'Mullbinde', qty: 2, unit: 'Stk' }] }, status: 'offen', organization_id: 'falsch' }
    const e = eintrag({ formular: 'produktausgabe', maske: undefined, absenderName: 'Neuer Name', daten: { einsatz: 'E-117', datum: '2026-10-31', lager_id: 'l1', positionen: [{ item_id: 'i1', qty: 2 }] }, alt })
    expect(altSatz(e)).toEqual({ sammlung: 'product_outputs', satz: { ...alt, payload: { ...alt.payload, user_name: 'Neuer Name' }, id: e.id, organization_id: 'org1' } })
    // ohne alt: Rückfall aus daten
    expect(altSatz({ ...e, alt: undefined }).satz).toEqual({
      id: e.id, organization_id: 'org1', status: 'offen', title: 'Produktausgabe E-117 (31.10.2026)',
      payload: { einsatz: 'E-117', datum: '2026-10-31', user_id: '', user_name: 'Neuer Name', lager_id: 'l1', lager_name: '', positionen: [{ item_id: 'i1', qty: 2 }] },
    })
  })

  it('alter Server, angemeldet: nur die sendende Person selbst wird verknüpft (Befund Client-Abläufe 1)', () => {
    const selbst = { id: 'u1', name: 'Anna Berg' }
    const e = eintrag({ daten: { title: 'Patientendoku: Max', payload: { mannschaft_tf: 'Tom Teamführer', mannschaft_1: 'berg, anna', mannschaft_2: 'Jörg Müller', absender: { id: 'x', status: 'bestaetigt' } } } })
    const p = altSatz(e, selbst).satz.payload as Record<string, unknown>
    expect(p.mannschaft).toEqual({ m1: { id: 'u1', name: 'berg, anna' } })
    expect(p.absender).toBeUndefined()
    // ohne Token nie eine Kennung, auch nicht, wenn der Name passt
    expect((altSatz(e).satz.payload as Record<string, unknown>).mannschaft).toBeUndefined()
    // eine schon vorhandene (falsche) Kennung eines anderen Postens bleibt unangetastet, die eigene kommt dazu
    const f = eintrag({ maske: 'alt', daten: { payload: { mannschaft: { tf: { id: 'fremd', name: 'Tom Teamführer' } }, mannschaft_3: 'Anna  Berg' } } })
    expect((altSatz(f, selbst).satz.payload as Record<string, unknown>).mannschaft).toEqual({ tf: { id: 'fremd', name: 'Tom Teamführer' }, m3: { id: 'u1', name: 'Anna  Berg' } })
    // nicht in der Besatzung: nichts verknüpft
    expect((altSatz(eintrag(), selbst).satz.payload as Record<string, unknown>).mannschaft).toBeUndefined()
    // Produktausgabe und Defektmeldung: user_id bzw. reporter_user_id nur mit Token
    const pa = eintrag({ formular: 'produktausgabe', maske: undefined, daten: { einsatz: 'E1', datum: '2026-10-31', lager_id: 'l1', positionen: [] }, alt: { title: 't', payload: { user_id: 'u9', user_name: 'x' }, status: 'offen' } })
    expect((altSatz(pa).satz.payload as Record<string, unknown>).user_id).toBe('')
    expect((altSatz(pa, selbst).satz.payload as Record<string, unknown>).user_id).toBe('u1')
    const dm = eintrag({ formular: 'defektmeldung', maske: undefined, daten: { device_id: 'd1', description: 'Akku', severity: 'high' }, alt: { device_id: 'd1', reporter_user_id: 'u9' } })
    expect(altSatz(dm).satz.reporter_user_id).toBe('')
    expect(altSatz(dm, selbst).satz.reporter_user_id).toBe('u1')
  })

  it('Defektmeldung: alt der Maske, reporter_name aus absenderName, reporter_status nie', () => {
    const alt = { device_id: 'd1', device_name: 'Corpuls C3', reporter_name: 'x', reporter_user_id: '', reporter_status: 'bestaetigt', description: 'Akku', severity: 'high', status: 'pending' }
    const e = eintrag({ formular: 'defektmeldung', maske: undefined, daten: { device_id: 'd1', description: 'Akku', severity: 'high' }, alt })
    const { sammlung, satz } = altSatz(e)
    expect(sammlung).toBe('mpg_defect_reports')
    expect(satz).toEqual({ device_id: 'd1', device_name: 'Corpuls C3', reporter_name: 'Anna Berg', reporter_user_id: '', description: 'Akku', severity: 'high', status: 'pending', id: e.id, organization_id: 'org1' })
    expect(altSatz({ ...e, alt: undefined }).satz).toEqual({ device_id: 'd1', device_name: '', description: 'Akku', severity: 'high', status: 'pending', reporter_user_id: '', reporter_name: 'Anna Berg', id: e.id, organization_id: 'org1' })
  })
})

const OK = (id = 'abcdefghij01234', status = 'bestaetigt') => json(200, { ok: true, id, bereits: false, absender: { id: 'u1', name: 'Anna Berg', status, weg: '', modus: 'passwort', am: '' }, frist: '' })

describe('eintragAusfuehren', () => {
  const gelegt = (x: Partial<Warteeintrag> = {}) => {
    const e = eintrag(x)
    const { v: _v, versuche: _n, angelegt: _a, ...rest } = e
    ablegen(ls, rest, new Date(e.angelegt))
    return eintraege(ls, 'wache1').find((y) => y.id === e.id)!
  }

  it('Erfolg entfernt; bei ausstehend eigene Meldung', async () => {
    const e = gelegt()
    antworten.push(OK())
    expect(await eintragAusfuehren(ls, e, { art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: false }, { jetzt: JETZT })).toMatchObject({ ergebnis: 'gesendet', meldung: 'Protokoll Max Muster gesendet.' })
    expect(eintraege(ls, 'wache1')).toEqual([])
    const f = gelegt()
    antworten.push(OK(undefined, 'ausstehend'))
    expect((await eintragAusfuehren(ls, f, schrittOhnePasswort(f), { jetzt: JETZT })).meldung).toBe('Protokoll Max Muster gesendet. Wartet auf die Unterschrift von Anna Berg.')
    expect(aufrufe[1].body?.absender).toEqual({ name: 'Anna Berg', ausstehend: true })
  })

  it('bereits: true gilt als Erfolg', async () => {
    const e = gelegt()
    antworten.push(json(200, { ok: true, id: e.id, bereits: true, absender: { status: 'bestaetigt' }, frist: '' }))
    expect((await eintragAusfuehren(ls, e, { art: 'senden', absender: null, mitAnmeldung: false })).ergebnis).toBe('gesendet')
    expect(eintraege(ls, 'wache1')).toEqual([])
  })

  it('fragen ohne Passwort merkt gefragtAb einmal; mit Passwort sendet es, gespeichert wird es nie', async () => {
    const e = gelegt()
    expect(await eintragAusfuehren(ls, e, { art: 'fragen' }, { jetzt: JETZT })).toEqual({ ergebnis: 'fragen', meldung: '' })
    expect(eintraege(ls, 'wache1')[0].gefragtAb).toBe(JETZT.toISOString())
    await eintragAusfuehren(ls, eintraege(ls, 'wache1')[0], { art: 'fragen' }, { jetzt: new Date(JETZT.getTime() + 60_000) })
    expect(eintraege(ls, 'wache1')[0].gefragtAb).toBe(JETZT.toISOString())
    expect(aufrufe).toHaveLength(0)
    antworten.push(json(401, { grund: 'passwort_falsch', message: 'Das Passwort stimmt nicht. Noch 4 Versuche, dann ist die Bestätigung 15 Minuten gesperrt.', versuche_uebrig: 4 }))
    const r = await eintragAusfuehren(ls, eintraege(ls, 'wache1')[0], { art: 'fragen' }, { passwort: 'Geheim-9', jetzt: JETZT })
    expect(r).toMatchObject({ ergebnis: 'liegt', grund: 'passwort_falsch' })
    expect(r.meldung).toBe('Konnte nicht gesendet werden: Das Passwort stimmt nicht. Noch 4 Versuche, dann ist die Bestätigung 15 Minuten gesperrt.')
    expect(aufrufe[0].body?.absender).toEqual({ name: 'Anna Berg', passwort: 'Geheim-9' })
    expect(aufrufe[0].auth).toBeUndefined()
    for (const v of ls.d.values()) expect(v).not.toContain('Geheim-9')
    expect(eintraege(ls, 'wache1')[0]).toMatchObject({ versuche: 1, letzterFehler: { grund: 'passwort_falsch' } })
  })

  it('429 drossel setzt naechsterVersuchAb, nie Löschen', async () => {
    const e = gelegt()
    antworten.push(json(429, { grund: 'drossel', sekunden: 120 }))
    const r = await eintragAusfuehren(ls, e, { art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: false }, { jetzt: JETZT })
    expect(r.ergebnis).toBe('liegt')
    expect(r.meldung).toMatch(/^Wartet bis \d{2}:\d{2}, dann neuer Versuch\.$/)
    expect(eintraege(ls, 'wache1')[0].naechsterVersuchAb).toBe(new Date(JETZT.getTime() + 120_000).toISOString())
  })

  it('netz: liegt ohne Fehler; name_unbekannt: nameEindeutig false', async () => {
    const e = gelegt({ nameEindeutig: true })
    antworten.push(keinNetz())
    expect(await eintragAusfuehren(ls, e, schrittOhnePasswort(e), { jetzt: JETZT })).toMatchObject({ ergebnis: 'liegt', grund: 'netz', meldung: MELDUNGEN.ohneNetzWartet })
    expect(eintraege(ls, 'wache1')[0].letzterFehler).toBeUndefined()
    antworten.push(json(400, { grund: 'name_unbekannt', message: 'Ohne Passwort geht das nur, wenn der Name genau zu einem Mitglied passt.' }))
    await eintragAusfuehren(ls, eintraege(ls, 'wache1')[0], schrittOhnePasswort(e), { jetzt: JETZT })
    expect(eintraege(ls, 'wache1')[0]).toMatchObject({ nameEindeutig: false, letzterFehler: { grund: 'name_unbekannt' }, versuche: 2 })
  })

  it('bleibende Fehler (Formular aus, Daten) pausieren; nichts wird gelöscht', async () => {
    const e = gelegt()
    antworten.push(json(403, { grund: 'formular_aus' }))
    await eintragAusfuehren(ls, e, { art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: false }, { jetzt: JETZT })
    expect(eintraege(ls, 'wache1')[0]).toMatchObject({ naechsterVersuchAb: new Date(JETZT.getTime() + FEHLER_PAUSE_MS).toISOString(), letzterFehler: { grund: 'formular_aus' } })
    for (const [s, b] of [[500, { grund: 'server' }], [403, { grund: 'passwort_noetig' }], [429, { grund: 'gesperrt', sekunden: 900 }], [404, { grund: 'organisation' }]] as const) {
      antworten.push(json(s, b))
      await eintragAusfuehren(ls, eintraege(ls, 'wache1')[0], { art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: false }, { jetzt: JETZT })
      expect(eintraege(ls, 'wache1')).toHaveLength(1)
    }
  })

  it('429 gesperrt in der Karte: wartet bis zum Ende der Sperre statt sofort wieder zu fragen', async () => {
    const e = gelegt()
    antworten.push(json(429, { grund: 'gesperrt', sekunden: 600, message: 'Zu viele falsche Passwörter. Bitte in 10 Minuten erneut versuchen.' }))
    await eintragAusfuehren(ls, e, { art: 'fragen' }, { jetzt: JETZT, passwort: 'Geheim-x9' })
    const n = eintraege(ls, 'wache1')[0]
    expect(n.naechsterVersuchAb).toBe(new Date(JETZT.getTime() + 600_000).toISOString())
    expect(n.letzterFehler?.grund).toBe('gesperrt')
    expect(naechsterSchritt(n, k())).toEqual({ art: 'warten', bis: n.naechsterVersuchAb })
    expect(JSON.stringify(ls.d.get('formular_warteschlange_wache1'))).not.toContain('Geheim-x9')
  })

  it('eingeklappte Karte: die Passwortfrage zählt nicht als gestellt (gefragtAb bleibt leer)', async () => {
    const e = gelegt()
    await eintragAusfuehren(ls, e, { art: 'fragen' }, { jetzt: JETZT, frageSichtbar: false })
    expect(eintraege(ls, 'wache1')[0].gefragtAb).toBeUndefined()
    await abarbeiten(ls, 'wache1', { online: true, stand: stand('passwort'), serverAlt: false, tokenId: '', frageSichtbar: false })
    expect(eintraege(ls, 'wache1')[0].gefragtAb).toBeUndefined()
    await abarbeiten(ls, 'wache1', { online: true, stand: stand('passwort'), serverAlt: false, tokenId: '' })
    expect(eintraege(ls, 'wache1')[0].gefragtAb).toBeTruthy()
  })

  it('bleibende Fehler: mit Ausweg, verwerfbar nur nach Rückfrage; Netz, Drossel, Passwort und Name nie', async () => {
    const e = gelegt({ formular: 'defektmeldung', maske: undefined, daten: { device_id: 'd1', description: 'Akku', severity: 'high' } })
    antworten.push(json(400, { grund: 'daten', message: 'Dieses Gerät ist außer Betrieb genommen.', feld: 'device_id' }))
    const r = await eintragAusfuehren(ls, e, { art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: false }, { jetzt: JETZT })
    expect(r.meldung).toBe('Konnte nicht gesendet werden: Dieses Gerät ist außer Betrieb genommen.')
    const n = eintraege(ls, 'wache1')[0]
    expect(n.letzterFehler).toMatchObject({ grund: 'daten', feld: 'device_id' })
    expect(bleibenderFehler(n)).toBe(true)
    expect(bleibendHinweis(n)).toBe('In dieser Karte lässt sich das nicht ändern. Bitte neu erfassen und diesen Eintrag danach verwerfen.')
    expect(verwerfenFrageText(n)).toMatch(/^Die Defektmeldung wird von diesem Gerät gelöscht\./)
    for (const grund of ['netz', 'drossel', 'server', 'passwort_falsch', 'gesperrt', 'name', 'name_unbekannt', 'kennung', 'alter_server'] as const) {
      expect(bleibenderFehler(eintrag({ letzterFehler: { grund, text: '', am: '' } }))).toBe(false)
      expect(verwerfen(ls, { ...n, letzterFehler: { grund, text: '', am: '' } })).toBe(false)
    }
    // ein falscher Name (Modus frei, feld absender) ist zu korrigieren, nicht zu verwerfen
    expect(bleibenderFehler(eintrag({ letzterFehler: { grund: 'daten', text: '', am: '', feld: 'absender' } }))).toBe(false)
    expect(BLEIBENDE_GRUENDE).toEqual(expect.arrayContaining(['formular_aus', 'organisation', 'daten']))
    expect(bleibendHinweis({ formular: 'patienten', letzterFehler: { grund: 'formular_aus', text: '', am: '' } })).toMatch(/Leitung/)
    expect(bleibendHinweis({ formular: 'patienten', letzterFehler: { grund: 'daten', text: '', am: '' } })).toBe('In dieser Karte lässt sich das nicht ändern. Bitte die Leitung fragen, bevor du das Protokoll verwirfst.')
    expect(verwerfenFrageText(eintrag())).toBe('Das Protokoll Max Muster wird von diesem Gerät gelöscht. Es ist danach nirgends mehr gespeichert, das lässt sich nicht rückgängig machen.')
    expect(verwerfen(ls, n)).toBe(true)
    expect(eintraege(ls, 'wache1')).toEqual([])
  })

  it('409 kennung: sofort ein zweiter Versuch mit neuer Kennung; der Eintrag trägt sie', async () => {
    const e = gelegt()
    antworten.push(json(409, { grund: 'kennung' }), keinNetz())
    const r = await eintragAusfuehren(ls, e, { art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: false }, { jetzt: JETZT })
    expect(r.grund).toBe('netz')
    expect(aufrufe).toHaveLength(2)
    const zweite = aufrufe[1].body?.id as string
    expect(zweite).not.toBe(e.id)
    expect(zweite).toMatch(/^[a-z0-9]{15}$/)
    expect(eintraege(ls, 'wache1').map((x) => x.id)).toEqual([zweite])
    // gleiche Daten unter der neuen Kennung
    expect(aufrufe[1].body?.daten).toEqual(aufrufe[0].body?.daten)
    // Erfolg mit der neuen Kennung entfernt den Eintrag
    antworten.push(OK(zweite))
    const s = await eintragAusfuehren(ls, eintraege(ls, 'wache1')[0], { art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: false })
    expect(s).toMatchObject({ ergebnis: 'gesendet', id: zweite })
    expect(eintraege(ls, 'wache1')).toEqual([])
  })

  it('409 aenderung_alt: setzt ziel und trägt die Änderung dort ein', async () => {
    const e = gelegt({ uebernommen: true })
    antworten.push(json(409, { grund: 'aenderung_alt', ziel: 'zzzzzzzzzzzzzzz' }), json(200, { id: 'zzzzzzzzzzzzzzz' }))
    const r = await eintragAusfuehren(ls, e, { art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: false }, { jetzt: JETZT })
    expect(r.ergebnis).toBe('gesendet')
    expect(aufrufe[0].body?.uebernommen).toBe(true)
    expect(aufrufe[1]).toMatchObject({ method: 'PATCH', url: 'https://api.test/api/collections/patients/records/zzzzzzzzzzzzzzz', body: { title: e.daten.title, payload: e.daten.payload } })
    expect(eintraege(ls, 'wache1')).toEqual([])
  })

  it('abgewiesene Änderung bleibt, pausiert und lässt sich verwerfen', async () => {
    const e = gelegt({ uebernommen: true })
    const bestaetigt = 'Dieses Protokoll ist bestätigt. Ändern geht nur angemeldet, in Unitas über „Bearbeiten“.'
    antworten.push(json(409, { grund: 'aenderung_alt', ziel: 'zzzzzzzzzzzzzzz' }), json(403, { status: 403, message: bestaetigt, data: {} }))
    const r = await eintragAusfuehren(ls, e, { art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: false }, { jetzt: JETZT })
    expect(r.meldung).toBe(`Diese Änderung gehört zu einem schon abgesendeten Protokoll und ließ sich dort nicht eintragen: ${bestaetigt}`)
    const jetzt = eintraege(ls, 'wache1')[0]
    expect(jetzt).toMatchObject({ ziel: 'zzzzzzzzzzzzzzz', letzterFehler: { grund: 'nicht_berechtigt', text: bestaetigt } })
    expect(jetzt.naechsterVersuchAb).toBe(new Date(JETZT.getTime() + FEHLER_PAUSE_MS).toISOString())
    expect(aenderungAbgewiesen(jetzt)).toBe(true)
    // nur abgewiesene Änderungen lassen sich verwerfen
    expect(verwerfen(ls, eintrag())).toBe(false)
    expect(verwerfen(ls, jetzt)).toBe(true)
    expect(eintraege(ls, 'wache1')).toEqual([])
  })

  it('Änderung ohne Netz ist nicht abgewiesen', () => {
    expect(aenderungAbgewiesen(eintrag({ ziel: 'zzzzzzzzzzzzzzz', letzterFehler: { grund: 'netz', text: '', am: '' } }))).toBe(false)
    expect(aenderungAbgewiesen(eintrag({ ziel: 'zzzzzzzzzzzzzzz' }))).toBe(false)
    expect(aenderungAbgewiesen(eintrag({ letzterFehler: { grund: 'daten', text: '', am: '' } }))).toBe(false)
  })

  it('aendern mit Token nur, wenn es derselben Person gehört', async () => {
    anmelden('u1')
    antworten.push(json(200, {}), json(200, {}))
    await eintragAusfuehren(ls, gelegt({ ziel: 'zzzzzzzzzzzzzzz', angemeldetId: 'u1' }), { art: 'aendern', ziel: 'zzzzzzzzzzzzzzz' })
    await eintragAusfuehren(ls, gelegt({ ziel: 'zzzzzzzzzzzzzzz', angemeldetId: '' }), { art: 'aendern', ziel: 'zzzzzzzzzzzzzzz' })
    expect(aufrufe.map((a) => a.auth)).toEqual(['TOKEN-u1', undefined])
  })

  it('alt: direkt anlegen mit derselben Kennung; „id muss eindeutig sein“ gilt als gesendet', async () => {
    const e = gelegt()
    antworten.push(json(400, { data: { id: { code: 'validation_not_unique' } }, message: 'Failed to create record.' }))
    expect((await eintragAusfuehren(ls, e, { art: 'alt' })).ergebnis).toBe('gesendet')
    expect(aufrufe[0]).toMatchObject({ method: 'POST', url: 'https://api.test/api/collections/patients/records', body: { id: e.id, status: 'offen', organization_id: 'org1' } })
    expect(eintraege(ls, 'wache1')).toEqual([])
  })

  it('senden über die Route, Server alt: nimmt selbst den alten Weg', async () => {
    const e = gelegt()
    antworten.push(ALT404, json(200, { id: e.id }))
    expect((await eintragAusfuehren(ls, e, { art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: false })).ergebnis).toBe('gesendet')
    expect(aufrufe.map((a) => a.url)).toEqual(['https://api.test/api/responda/formular/wache1/absenden', 'https://api.test/api/collections/patients/records'])
    expect(aufrufe[1].body?.id).toBe(e.id)
  })

  it('warten tut nichts', async () => {
    expect(await eintragAusfuehren(ls, eintrag(), { art: 'warten' })).toEqual({ ergebnis: 'liegt', meldung: '' })
    expect(aufrufe).toHaveLength(0)
  })

  it('absenderNameSetzen ändert Name und Eindeutigkeit, löscht einen Namensfehler', () => {
    const e = gelegt({ letzterFehler: { grund: 'name_unbekannt', text: 'x', am: '' }, nameEindeutig: false })
    absenderNameSetzen(ls, 'wache1', e.id, 'Jörg Müller', { vollstaendig: true, gefunden: true, eindeutig: true })
    expect(eintraege(ls, 'wache1')[0]).toMatchObject({ absenderName: 'Jörg Müller', nameEindeutig: true })
    expect(eintraege(ls, 'wache1')[0].letzterFehler).toBeUndefined()
    absenderNameSetzen(ls, 'wache1', e.id, 'Max Mayer', { vollstaendig: true, gefunden: true, eindeutig: false })
    expect(eintraege(ls, 'wache1')[0].nameEindeutig).toBe(false)
    absenderNameSetzen(ls, 'wache1', e.id, 'Irgendwer', null)
    expect(eintraege(ls, 'wache1')[0].nameEindeutig).toBeUndefined()
  })

  it('eintragKopf nennt, worum es geht (Patient, Einsatz, Gerät)', () => {
    expect(eintragKopf(eintrag())).toMatch(/^Protokoll Max Muster vom \d{2}\.\d{2}\., \d{2}:\d{2} wartet auf das Senden$/)
    expect(eintragKopf(eintrag({ daten: { title: 'Patientendoku', payload: {} } }))).toMatch(/^Protokoll vom /)
    expect(eintragKopf(eintrag({ maske: 'schnell', daten: { title: 'Schnelldoku: Paul Kurz', payload: {} } }))).toMatch(/^Protokoll Paul Kurz vom /)
    expect(eintragKopf(eintrag({ formular: 'produktausgabe', daten: { einsatz: '2026-117' } }))).toMatch(/^Produktausgabe Einsatz 2026-117 vom /)
    expect(eintragKopf(eintrag({ formular: 'produktausgabe', daten: {} }))).toMatch(/^Produktausgabe vom /)
    expect(eintragKopf(eintrag({ formular: 'defektmeldung', angelegt: 'kaputt', daten: {} }))).toBe('Defektmeldung wartet auf das Senden')
    expect(eintragKopf(eintrag({ formular: 'defektmeldung', angelegt: 'kaputt', daten: {}, alt: { device_name: 'Corpuls C3' } }))).toBe('Defektmeldung Corpuls C3 wartet auf das Senden')
    expect(eintragBezug(eintrag({ daten: { title: 'Patientendoku: ' + 'X'.repeat(80) } })).length).toBe(60)
    expect(gesendetText(eintrag(), null)).toBe('Protokoll Max Muster gesendet.')
    expect(gesendetText(eintrag(), '')).toBe('Protokoll Max Muster gesendet. Wartet auf die Unterschrift des Absenders.')
  })
})

describe('abarbeiten: eine Sendung zur Zeit', () => {
  const lege = (id: string, x: Partial<NeuerEintrag> = {}) => ablegen(ls, { id, formular: 'patienten', maske: 'doku', orgCode: 'wache1', orgId: 'org1', absenderName: 'Anna Berg', angemeldetId: '', daten: { title: 't', payload: {} }, ...x }, JETZT)

  it('der Reihe nach; nach drossel endet der Durchgang', async () => {
    lege('aaaaaaaaaaaaaaa'); lege('bbbbbbbbbbbbbbb'); lege('ccccccccccccccc')
    antworten.push(OK('aaaaaaaaaaaaaaa'), json(429, { grund: 'drossel', sekunden: 60 }))
    const lauf = await abarbeiten(ls, 'wache1', { online: true, stand: stand('frei'), serverAlt: false, tokenId: '' })
    expect(Object.keys(lauf)).toEqual(['aaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbb'])
    expect(lauf.aaaaaaaaaaaaaaa).toMatchObject({ ergebnis: 'gesendet', schritt: 'senden' })
    expect(lauf.bbbbbbbbbbbbbbb).toMatchObject({ ergebnis: 'liegt', grund: 'drossel' })
    expect(eintraege(ls, 'wache1').map((e) => e.id)).toEqual(['bbbbbbbbbbbbbbb', 'ccccccccccccccc'])
  })

  it('läuft schon ein Durchgang, kommt dessen Ergebnis (keine zweite Sendung)', async () => {
    lege('aaaaaaaaaaaaaaa')
    antworten.push(OK('aaaaaaaaaaaaaaa'))
    const kx = { online: true, stand: stand('frei'), serverAlt: false, tokenId: '' }
    const [a, b] = await Promise.all([abarbeiten(ls, 'wache1', kx), abarbeiten(ls, 'wache1', kx)])
    expect(a).toBe(b)
    expect(aufrufe).toHaveLength(1)
  })

  it('Passwort-Modus fragt und merkt gefragtAb; offline sendet nichts', async () => {
    lege('aaaaaaaaaaaaaaa')
    const offline = await abarbeiten(ls, 'wache1', { online: false, stand: stand('passwort'), serverAlt: false })
    expect(offline.aaaaaaaaaaaaaaa).toMatchObject({ ergebnis: 'liegt', schritt: 'warten' })
    expect(eintraege(ls, 'wache1')[0].gefragtAb).toBeUndefined()
    const lauf = await abarbeiten(ls, 'wache1', { online: true, stand: stand('passwort'), serverAlt: false })
    expect(lauf.aaaaaaaaaaaaaaa).toMatchObject({ ergebnis: 'fragen', schritt: 'fragen' })
    expect(eintraege(ls, 'wache1')[0].gefragtAb).toBeTruthy()
    expect(aufrufe).toHaveLength(0)
  })
})

describe('Masken: formularSenden und sendenOderAblegen', () => {
  const ne = (x: Partial<NeuerEintrag> = {}): NeuerEintrag => ({ id: 'abcdefghij01234', formular: 'patienten', maske: 'doku', orgCode: 'wache1', orgId: 'org1', absenderName: 'Anna Berg', angemeldetId: '', daten: { title: 't', payload: { unterschrift: 'Anna Berg' } }, ...x })

  it('formularSenden: neue Kennung nach 409 steht in wert.id', async () => {
    antworten.push(json(409, { grund: 'kennung' }), (() => { const f = OK('zzzzzzzzzzzzzzz'); return f })())
    const r = await formularSenden(ne(), { absender: { name: 'Anna Berg', passwort: 'pw' }, mitAnmeldung: false })
    expect(r.ok).toBe(true)
    expect(aufrufe[1].body?.id).not.toBe('abcdefghij01234')
    expect(r.wert?.id).toBe('zzzzzzzzzzzzzzz')
  })

  it('formularSenden: alter Server, alter Weg mit derselben Kennung', async () => {
    antworten.push(ALT404, json(200, { id: 'abcdefghij01234' }))
    const r = await formularSenden(ne(), { absender: { name: 'Anna Berg', passwort: 'pw' }, mitAnmeldung: false })
    expect(r).toEqual({ ok: true, wert: { id: 'abcdefghij01234', bereits: false, alterWeg: true } })
    expect(JSON.stringify(aufrufe[1].body)).not.toContain('pw')
  })

  it('ohne Netz: ablegen ohne Anfrage, Meldung je Modus; angemeldetId nur mit mitAnmeldung', async () => {
    anmelden('u1')
    expect(await sendenOderAblegen(ne(), { absender: { name: 'Anna Berg', passwort: 'pw' }, mitAnmeldung: false }, { modus: 'passwort', s: ls, online: false }))
      .toEqual({ art: 'abgelegt', meldung: 'Ohne Netz gespeichert. Sobald wieder Netz da ist, fragt die App nach dem Passwort von Anna Berg.' })
    expect(aufrufe).toHaveLength(0)
    expect(eintraege(ls, 'wache1')[0].angemeldetId).toBe('')
    for (const v of ls.d.values()) expect(v).not.toContain('"pw"')
    expect(await sendenOderAblegen(ne({ id: 'zzzzzzzzzzzzzzz', angemeldetId: 'falsch' }), { absender: null, mitAnmeldung: true }, { modus: 'passwort', s: ls, online: false }))
      .toEqual({ art: 'abgelegt', meldung: 'Ohne Netz gespeichert. Geht raus, sobald wieder Netz da ist.' })
    expect(eintraege(ls, 'wache1')[1].angemeldetId).toBe('falsch')
    expect(await sendenOderAblegen(ne({ id: 'yyyyyyyyyyyyyyy' }), { absender: { name: 'Anna Berg' }, mitAnmeldung: false }, { modus: 'frei', s: ls, online: false }))
      .toEqual({ art: 'abgelegt', meldung: 'Ohne Netz gespeichert. Geht raus, sobald wieder Netz da ist.' })
    expect(await sendenOderAblegen(ne(), { absender: null, mitAnmeldung: true }, { modus: 'passwort', s: null, online: false }))
      .toEqual({ art: 'nicht_abgelegt', meldung: 'Ohne Netz und ohne Speicher. Das lässt sich gerade nicht ablegen.' })
  })

  it('mitAnmeldung ohne angemeldetId: die Kennung der Sitzung', async () => {
    anmelden('u7')
    await sendenOderAblegen(ne(), { absender: null, mitAnmeldung: true }, { modus: 'passwort', s: ls, online: false })
    expect(eintraege(ls, 'wache1')[0].angemeldetId).toBe('u7')
  })

  it('netz, server und drossel legen ab; gesperrt bietet das Ablegen an; andere sind Fehler', async () => {
    antworten.push(keinNetz())
    expect((await sendenOderAblegen(ne(), { absender: { name: 'Anna Berg', passwort: 'pw' }, mitAnmeldung: false }, { modus: 'passwort', s: ls })).art).toBe('abgelegt')
    antworten.push(json(500, { grund: 'server' }))
    expect(await sendenOderAblegen(ne({ id: 'bbbbbbbbbbbbbbb' }), { absender: { name: 'Anna Berg' }, mitAnmeldung: false }, { modus: 'frei', s: ls }))
      .toEqual({ art: 'abgelegt', meldung: 'Der Server hat es gerade nicht angenommen. Es ist auf dem Gerät gespeichert und geht später raus.' })
    antworten.push(json(429, { grund: 'drossel', sekunden: 300 }))
    expect(await sendenOderAblegen(ne({ id: 'ccccccccccccccc' }), { absender: { name: 'Anna Berg' }, mitAnmeldung: false }, { modus: 'frei', s: ls }))
      .toEqual({ art: 'abgelegt', meldung: 'Gerade kommen sehr viele Anfragen. Es ist auf dem Gerät gespeichert und geht in 5 Minuten raus.' })
    expect(eintraege(ls, 'wache1').find((e) => e.id === 'ccccccccccccccc')?.naechsterVersuchAb).toBeTruthy()
    antworten.push(json(429, { grund: 'gesperrt', sekunden: 900, message: 'Zu viele falsche Passwörter. Bitte in 15 Minuten erneut versuchen.' }))
    expect(await sendenOderAblegen(ne({ id: 'ddddddddddddddd' }), { absender: { name: 'Anna Berg', passwort: 'x' }, mitAnmeldung: false }, { modus: 'passwort', s: ls }))
      .toEqual({ art: 'fehler', grund: 'gesperrt', meldung: 'Zu viele falsche Passwörter. Bitte in 15 Minuten erneut versuchen.', ablegenAnbieten: true, feld: undefined, versucheUebrig: undefined, sekunden: 900 })
    for (const grund of ['passwort_falsch', 'name', 'name_unbekannt', 'passwort_noetig', 'daten', 'formular_aus', 'organisation']) {
      antworten.push(json(400, { grund, message: 'm' }))
      const r = await sendenOderAblegen(ne({ id: 'eeeeeeeeeeeeeee' }), { absender: { name: 'Anna Berg', passwort: 'x' }, mitAnmeldung: false }, { modus: 'passwort', s: ls })
      expect(r).toMatchObject({ art: 'fehler', grund, ablegenAnbieten: false })
    }
    expect(eintraege(ls, 'wache1').map((e) => e.id)).toEqual(['abcdefghij01234', 'bbbbbbbbbbbbbbb', 'ccccccccccccccc'])
  })

  it('nach gesperrt „Auf dem Gerät ablegen“: wartet bis zum Ende der Sperre, erst dann fragt die Karte', () => {
    const vorher = Date.now()
    const r = ablegenMitMeldung(ne(), { modus: 'passwort', mitAnmeldung: false, s: ls, anlass: 'gesperrt', sekunden: 600, text: 'Zu viele falsche Passwörter.' })
    const e = eintraege(ls, 'wache1')[0]
    const bis = Date.parse(e.naechsterVersuchAb ?? '')
    expect(bis - vorher).toBeGreaterThanOrEqual(600_000 - 50)
    expect(bis - vorher).toBeLessThan(600_000 + 5_000)
    expect(e.gefragtAb).toBeUndefined()
    expect(e.letzterFehler?.grund).toBe('gesperrt')
    expect(r.gespeichert).toBe(true)
    expect(r.meldung).toMatch(/^Auf dem Gerät gespeichert\. Die Passwortbestätigung für Anna Berg ist bis \d{2}:\d{2} gesperrt\. Danach fragt die Karte „Wartet auf dem Gerät“ oben erneut\.$/)
    // Während der Sperre: warten, mit der Uhrzeit; danach fragen
    expect(naechsterSchritt(e, k({ jetzt: new Date(bis - 1000) }))).toEqual({ art: 'warten', bis: e.naechsterVersuchAb })
    expect(naechsterSchritt(e, k({ jetzt: new Date(bis + 1000) }))).toEqual({ art: 'fragen' })
    expect(MELDUNGEN.gesperrtBis(e.naechsterVersuchAb!, 'Otto Sechs')).toMatch(/^Passwort für Otto Sechs gesperrt bis \d{2}:\d{2}\. Danach fragt diese Karte erneut\.$/)
    // Ohne Angabe des Servers 15 Minuten
    ablegenMitMeldung(ne({ id: 'fffffffffffffff' }), { modus: 'passwort', mitAnmeldung: false, s: ls, anlass: 'gesperrt' })
    const f = eintraege(ls, 'wache1').find((x) => x.id === 'fffffffffffffff')!
    expect(Date.parse(f.naechsterVersuchAb!) - Date.now()).toBeGreaterThan(14 * 60_000)
  })

  it('„Kein Passwort zur Hand? Auf dem Gerät ablegen“: liegt ohne Passwort, ohne Wartezeit, mit Hinweis auf die Karte', () => {
    const r = ablegenMitMeldung(ne({ daten: { title: 'T', payload: { passwort: 'x' } } }), { modus: 'passwort', mitAnmeldung: false, s: ls, anlass: 'ohne_passwort' })
    expect(r).toEqual({ gespeichert: true, meldung: MELDUNGEN.ohnePasswortAbgelegt('Anna Berg') })
    expect(r.meldung).toContain('Anna Berg')
    const e = eintraege(ls, 'wache1')[0]
    expect(e.naechsterVersuchAb).toBeUndefined()
    expect(e.gefragtAb).toBeUndefined()
    expect(e.angemeldetId).toBe('')
    expect(JSON.stringify(ls.d.get('formular_warteschlange_wache1'))).not.toMatch(/passwort/i)
    // Mit Netz fragt die Karte sofort
    expect(naechsterSchritt(e, k())).toEqual({ art: 'fragen' })
  })

  it('Erfolg: Kennung, Absender, Frist; ohne Ablage', async () => {
    antworten.push(json(200, { ok: true, id: 'abcdefghij01234', bereits: false, absender: { id: 'u1', name: 'Anna Berg', status: 'bestaetigt', weg: 'passwort', modus: 'passwort', am: 'a', feld: 'unterschrift' }, frist: 'f' }))
    expect(await sendenOderAblegen(ne(), { absender: { name: 'Anna Berg', passwort: 'pw' }, mitAnmeldung: false }, { modus: 'passwort', s: ls })).toEqual({
      art: 'gesendet', id: 'abcdefghij01234', bereits: false, frist: 'f', alterWeg: false,
      absender: { id: 'u1', name: 'Anna Berg', status: 'bestaetigt', weg: 'passwort', modus: 'passwort', am: 'a', feld: 'unterschrift' },
    })
    expect(eintraege(ls, 'wache1')).toEqual([])
  })

  it('Meldungen ohne Gedankenstriche', () => {
    const texte = Object.values(MELDUNGEN).map((m) => typeof m === 'function' ? (m as (x: never) => string)('Anna Berg' as never) : m)
    for (const f of ['patienten', 'produktausgabe', 'defektmeldung'] as const) {
      for (const grund of ['formular_aus', 'daten'] as const) texte.push(bleibendHinweis({ formular: f, letzterFehler: { grund, text: '', am: '' } }))
      texte.push(verwerfenFrageText({ formular: f, daten: {} }))
    }
    texte.push(MELDUNGEN.gesperrtAbgelegt('', ''), MELDUNGEN.gesperrtBis('2026-10-31T13:20:00.000Z', ''), MELDUNGEN.ohnePasswortAbgelegt(''))
    for (const t of texte) expect(t).not.toMatch(/[–—]/)
  })
})

// ── Plan Vorgänge 5.3, 5.4, 5.7: eigene Formulare, ohne Namen, ohne Hintergrundversand ──

describe('Eigene Formulare in der Warteschlange (5.3)', () => {
  const V = 'vvvvvvvvvvvvvv1'
  const eig = (x: Partial<Warteeintrag> = {}) => eintrag({ formular: 'eigen', maske: undefined, vorlage: V, modus: 'frei', titel: 'Fahrzeugcheck', daten: { version: 2, werte: { f_aaaaaaaa: 'RTW 1' } }, ...x })
  const mitEigen = (ausstehend: boolean, modus: 'passwort' | 'frei' = 'passwort'): Stand => ({ ...stand(modus), formulare: { ...stand(modus).formulare, eigen: { modus: 'frei', an: true, oeffentlich: true, ausstehend } } })

  it('Modus kommt vom Eintrag (der Vorlage), nicht vom Stand der Standardformulare', () => {
    expect(naechsterSchritt(eig(), k({ stand: mitEigen(true, 'passwort') }))).toEqual({ art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: false })
    expect(naechsterSchritt(eig({ modus: 'passwort' }), k({ stand: mitEigen(true, 'frei') }))).toEqual({ art: 'fragen' })
    // Ohne Angabe gilt „Name frei“
    expect(naechsterSchritt(eig({ modus: undefined }), k({ stand: mitEigen(true) })).art).toBe('senden')
    // „ausstehend“ aus stand.formulare.eigen
    const alt = eig({ modus: 'passwort', gefragtAb: minuten(61), nameEindeutig: true })
    expect(naechsterSchritt(alt, k({ stand: mitEigen(true) }))).toEqual({ art: 'senden', absender: { name: 'Anna Berg', ausstehend: true }, mitAnmeldung: false })
    expect(naechsterSchritt(alt, k({ stand: mitEigen(false) }))).toEqual({ art: 'fragen' })
    expect(ohnePasswortMoeglich(eig({ modus: 'passwort', nameEindeutig: true }), mitEigen(true))).toBe(true)
    expect(ohnePasswortMoeglich(eig({ modus: 'passwort', nameEindeutig: true }), mitEigen(false))).toBe(false)
  })

  it('anonym: nie ein Token, nie ein Name, auch mit passender Anmeldung und ohne Stand', () => {
    const a = eig({ modus: 'anonym', absenderName: '', angemeldetId: 'u1' })
    expect(naechsterSchritt(a, k({ stand: null, tokenId: 'u1' }))).toEqual({ art: 'senden', absender: null, mitAnmeldung: false })
    expect(ohnePasswortMoeglich({ ...a, absenderName: 'Anna Berg', nameEindeutig: true }, mitEigen(true))).toBe(false)
  })

  it('Senden: vorlage im Body; anonym ohne Token und ohne Absender, auch wenn der Aufrufer etwas mitgibt', async () => {
    anmelden('u1')
    ablegen(ls, eig({ modus: 'anonym', absenderName: '', angemeldetId: 'u1' }), JETZT)
    antworten.push(json(200, { ok: true, id: 'abcdefghij01234', bereits: false, absender: null, anonym: true }))
    const e = eintraege(ls, 'wache1')[0]
    const r = await eintragAusfuehren(ls, e, { art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: true }, { jetzt: JETZT })
    expect(r.ergebnis).toBe('gesendet')
    expect(r.meldung).toBe('Fahrzeugcheck gesendet.')
    expect(aufrufe[0].auth).toBeUndefined()
    expect(aufrufe[0].body).toEqual({ formular: 'eigen', id: 'abcdefghij01234', absender: null, daten: { version: 2, werte: { f_aaaaaaaa: 'RTW 1' } }, vorlage: V })
    // Name frei: mit Namen
    ablegen(ls, eig(), JETZT)
    antworten.push(json(200, { ok: true, id: 'abcdefghij01234', bereits: false, absender: { id: '', name: 'Anna Berg', status: 'ohne_konto', weg: '', modus: 'frei', am: '' } }))
    await eintragAusfuehren(ls, eintraege(ls, 'wache1')[0], naechsterSchritt(eintraege(ls, 'wache1')[0], k({ stand: mitEigen(true) })), { jetzt: JETZT })
    expect(aufrufe[1].body).toMatchObject({ formular: 'eigen', vorlage: V, absender: { name: 'Anna Berg' } })
  })

  it('Vorlage inzwischen mit Passwort: die Karte fragt; nicht mehr anonym: Name eintragen', async () => {
    ablegen(ls, eig(), JETZT)
    antworten.push(json(401, { grund: 'passwort_noetig', message: 'Bitte bestätige mit deinem Passwort.' }))
    await eintragAusfuehren(ls, eintraege(ls, 'wache1')[0], { art: 'senden', absender: { name: 'Anna Berg' }, mitAnmeldung: false }, { jetzt: JETZT })
    const e = eintraege(ls, 'wache1')[0]
    expect(e.modus).toBe('passwort')
    expect(naechsterSchritt(e, k({ stand: mitEigen(true) }))).toEqual({ art: 'fragen' })

    ablegen(ls, eig({ id: 'zzzzzzzzzzzzzzz', modus: 'anonym', absenderName: '' }), JETZT)
    antworten.push(json(400, { grund: 'name', message: 'Bitte Vor- und Nachnamen vollständig eintragen.' }))
    await eintragAusfuehren(ls, eintraege(ls, 'wache1')[1], { art: 'senden', absender: null, mitAnmeldung: false }, { jetzt: JETZT })
    const a = eintraege(ls, 'wache1')[1]
    expect(a.modus).toBe('frei')
    expect(naechsterSchritt(a, k({ stand: mitEigen(true) }))).toEqual({ art: 'korrigieren' })
  })

  it('alter Weg: Einsendung wie bisher (Werte flach), nie Status, Notiz oder Absender vom Client', () => {
    expect(altSatz(eig())).toEqual({ sammlung: 'form_submissions', satz: { template_id: V, org_code: 'wache1', payload: { f_aaaaaaaa: 'RTW 1' }, id: 'abcdefghij01234', organization_id: 'org1' } })
    const mitAlt = altSatz(eig({ alt: { template_id: 'x', organization_id: 'fremd', org_code: 'wache1', payload: { f_aaaaaaaa: 'RTW 1' }, status: 'erledigt', notiz: 'n', absender_status: 'bestaetigt' } }))
    expect(mitAlt.satz).toEqual({ template_id: V, organization_id: 'org1', org_code: 'wache1', payload: { f_aaaaaaaa: 'RTW 1' }, id: 'abcdefghij01234' })
  })

  it('Ablage: anonym ohne Namen und ohne Anmeldung gespeichert; Modus der Vorlage geht mit', () => {
    anmelden('u1')
    const r = ablegenMitMeldung({ id: 'abcdefghij01234', formular: 'eigen', vorlage: V, titel: 'Hinweisbox', orgCode: 'wache1', orgId: 'org1', absenderName: 'Anna Berg', angemeldetId: 'u1', daten: { version: 1, werte: {} } }, { modus: 'anonym', mitAnmeldung: true, s: ls })
    expect(r).toEqual({ gespeichert: true, meldung: MELDUNGEN.ohneNetzFrei })
    const e = eintraege(ls, 'wache1')[0]
    expect([e.modus, e.absenderName, e.angemeldetId]).toEqual(['anonym', '', ''])
    expect(ls.d.get('formular_warteschlange_wache1')).not.toContain('Anna')
    // Passwort-Vorlage: Meldung nach dem Modus der Vorlage
    expect(ablegenMitMeldung({ id: 'zzzzzzzzzzzzzzz', formular: 'eigen', vorlage: V, orgCode: 'wache1', orgId: 'org1', absenderName: 'Anna Berg', angemeldetId: '', daten: { version: 1, werte: {} } }, { modus: 'passwort', mitAnmeldung: false, s: ls }).meldung)
      .toBe(MELDUNGEN.ohneNetzPasswort('Anna Berg'))
  })

  it('Texte der Karte: Titel der Vorlage, Rückfrage beim Verwerfen', () => {
    const e = eig()
    expect(eintragKopf(e)).toMatch(/^Fahrzeugcheck vom \d{2}\.\d{2}\., \d{2}:\d{2} wartet auf das Senden$/)
    expect(eintragKopf({ ...e, titel: undefined })).toMatch(/^Formular vom /)
    expect(gesendetText(e, 'Anna Berg')).toBe('Fahrzeugcheck gesendet. Wartet auf die Unterschrift von Anna Berg.')
    expect(verwerfenFrageText(e)).toBe('Das Formular „Fahrzeugcheck“ wird von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.')
    expect(bleibendHinweis({ formular: 'eigen', letzterFehler: { grund: 'daten', text: '', am: '' } })).toBe('In dieser Karte lässt sich das nicht ändern. Bitte neu erfassen und diesen Eintrag danach verwerfen.')
  })
})

describe('Karte ohne Patientennamen (5.4)', () => {
  it('Protokoll: nur Einsatznummer und Zeit; andere Formulare wie bisher', () => {
    const e = eintrag({ daten: { title: 'Patientendoku: Max Muster', payload: { name: 'Muster', vorname: 'Max', einsatz_nr: '2026-117' } } })
    expect(eintragKopf(e)).toContain('Max Muster')
    const ohne = eintragKopf(e, { ohneNamen: true })
    expect(ohne).toMatch(/^Protokoll zum Einsatz 2026-117 vom \d{2}\.\d{2}\., \d{2}:\d{2} wartet auf das Senden$/)
    expect(ohne).not.toContain('Muster')
    expect(eintragKopf(eintrag(), { ohneNamen: true })).toMatch(/^Protokoll vom /)
    expect(gesendetText(e, null, { ohneNamen: true })).toBe('Protokoll zum Einsatz 2026-117 gesendet.')
    expect(gesendetText(e, 'Anna Berg', { ohneNamen: true })).toBe('Protokoll zum Einsatz 2026-117 gesendet. Wartet auf die Unterschrift von Anna Berg.')
    expect(verwerfenFrageText(e, { ohneNamen: true })).not.toContain('Muster')
    expect(verwerfenFrageText(e, { ohneNamen: true })).toContain('zum Einsatz 2026-117')
    const pa = eintrag({ formular: 'produktausgabe', maske: undefined, daten: { einsatz: 'E-117', datum: '2026-11-07', positionen: [] } })
    expect(eintragKopf(pa, { ohneNamen: true })).toBe(eintragKopf(pa))
  })

  it('auch die Meldung nach dem Senden aus der Karte nennt keinen Namen', async () => {
    ablegen(ls, eintrag({ daten: { title: 'Patientendoku: Max Muster', payload: { name: 'Muster', einsatz_nr: '7' } } }), JETZT)
    antworten.push(json(200, { ok: true, id: 'abcdefghij01234', bereits: false, absender: { id: 'u1', name: 'Anna Berg', status: 'ausstehend', weg: '', modus: 'passwort', am: '' } }))
    const r = await eintragAusfuehren(ls, eintraege(ls, 'wache1')[0], { art: 'senden', absender: { name: 'Anna Berg', ausstehend: true }, mitAnmeldung: false }, { jetzt: JETZT, ohneNamen: true })
    expect(r.meldung).toBe('Protokoll zum Einsatz 7 gesendet. Wartet auf die Unterschrift von Anna Berg.')
  })
})

describe('Ohne Hintergrundversand: Hinweis nach dem Ablegen (5.7)', () => {
  const ne = (x: Partial<NeuerEintrag> = {}): NeuerEintrag => ({ id: 'abcdefghij01234', formular: 'patienten', maske: 'doku', orgCode: 'wache1', orgId: 'org1', absenderName: 'Anna Berg', angemeldetId: '', daten: { title: 't', payload: {} }, ...x })

  it('ohne SyncManager (iOS, Firefox) an jede Ablage-Meldung, je Formular', () => {
    vi.stubGlobal('window', {})
    const r = ablegenMitMeldung(ne(), { modus: 'frei', mitAnmeldung: false, s: ls })
    expect(r.meldung).toBe(`${MELDUNGEN.ohneNetzFrei} Bitte diese Seite später mit Netz wieder öffnen, sonst kommt das Protokoll nicht an.`)
    expect(ablegenMitMeldung(ne({ id: 'b'.repeat(15), formular: 'produktausgabe' }), { modus: 'frei', mitAnmeldung: false, s: ls }).meldung).toMatch(/sonst kommt die Produktausgabe nicht an\.$/)
    expect(ablegenMitMeldung(ne({ id: 'c'.repeat(15), formular: 'defektmeldung' }), { modus: 'frei', mitAnmeldung: false, s: ls, anlass: 'drossel', sekunden: 60 }).meldung).toMatch(/sonst kommt die Defektmeldung nicht an\.$/)
    expect(ablegenMitMeldung(ne({ id: 'd'.repeat(15), formular: 'eigen', vorlage: 'v'.repeat(15) }), { modus: 'frei', mitAnmeldung: false, s: ls, anlass: 'ohne_passwort' }).meldung).toMatch(/sonst kommt das Formular nicht an\.$/)
    expect(MELDUNGEN.ohneHintergrund(['patienten', 'eigen'])).toBe('Bitte diese Seite später mit Netz wieder öffnen, sonst kommen die Einträge nicht an.')
    // Nicht gespeichert: kein Hinweis
    expect(ablegenMitMeldung(ne({ id: 'e'.repeat(15) }), { modus: 'frei', mitAnmeldung: false, s: null }).meldung).toBe(MELDUNGEN.ohneNetzOhneSpeicher)
  })

  it('mit Background Sync, aber der Tresor ist nicht offen (Klartext): ebenso, denn der Service Worker liest nur den Tresor', () => {
    vi.stubGlobal('window', { SyncManager: function () {} })
    expect(ablegenMitMeldung(ne(), { modus: 'frei', mitAnmeldung: false, s: ls }).meldung).toMatch(/sonst kommt das Protokoll nicht an\.$/)
  })

  it('außerhalb eines Browsers kein Hinweis (die übrigen Prüffälle bleiben, wie sie sind)', () => {
    expect(ablegenMitMeldung(ne(), { modus: 'frei', mitAnmeldung: false, s: ls }).meldung).toBe(MELDUNGEN.ohneNetzFrei)
  })
})

describe('Ablage im Tresor: erst „abgelegt“, wenn es wirklich liegt (5.5)', () => {
  it('weder verschlüsselt noch als Klartext sicher: nicht abgelegt; sonst abgelegt', async () => {
    const { _tresorNeu, tresorOeffnen, tresorWeiche } = await import('../tresor')
    const daten = new Map<string, unknown>()
    let key: CryptoKey | null = null
    let kaputt = true
    const ablage = {
      async lesen() { return Object.fromEntries(daten) },
      async schreiben(k: string, v: unknown) { if (kaputt) throw new Error('voll'); daten.set(k, v) },
      async loeschen(k: string) { daten.delete(k) },
      async schluessel() { return key },
      async schluesselSetzen(c: CryptoKey) { if (!key) key = c },
    }
    _tresorNeu()
    try {
      const klar = { ...ls, setItem: () => { throw new Error('voll') }, get length() { return ls.length } }
      vi.stubGlobal('localStorage', klar)
      expect(await tresorOeffnen({ ablage, kanal: null, klar })).toBe('verschluesselt')
      const ne: NeuerEintrag = { id: 'abcdefghij01234', formular: 'patienten', maske: 'doku', orgCode: 'wache1', orgId: 'org1', absenderName: 'Anna Berg', angemeldetId: '', daten: { title: 't', payload: {} } }
      expect(await sendenOderAblegen(ne, { absender: { name: 'Anna Berg' }, mitAnmeldung: false }, { modus: 'frei', s: tresorWeiche(), online: false }))
        .toEqual({ art: 'nicht_abgelegt', meldung: MELDUNGEN.ohneNetzOhneSpeicher })
      kaputt = false
      expect(await sendenOderAblegen({ ...ne, id: 'zzzzzzzzzzzzzzz' }, { absender: { name: 'Anna Berg' }, mitAnmeldung: false }, { modus: 'frei', s: tresorWeiche(), online: false }))
        .toEqual({ art: 'abgelegt', meldung: MELDUNGEN.ohneNetzFrei })
      expect([...daten.keys()].length).toBe(2)
    } finally {
      _tresorNeu()
    }
  })
})
