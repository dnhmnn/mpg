import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Nur die Sitzung ist nachgebildet; Anfragen gehen an ein nachgebildetes fetch
const auth = vi.hoisted(() => ({ token: '', isValid: false, record: null as Record<string, unknown> | null, get model() { return this.record }, onChange: () => () => {} }))
vi.mock('../pocketbase', () => ({ pb: { baseURL: 'https://api.test/', authStore: auth } }))

const {
  ALTER_SERVER_BIS, TEXTE, absendeBody, absenden, alterWegErlaubt, direktAnlegen, formularStand, istFehler, kennungGueltig,
  mitgliederPruefung, nameGefunden, neueKennung, offeneUnterschriften, ohneUnterschrift, serverArt, serverGesehen, standLesen, unterschreiben, zurueckweisen,
} = await import('../formular/api')
const { standMerken, gemerkterStand, standOhneNetz, standAusOrg, angemeldetOhneNetz, standAlterServer } = await import('../formular/stand')

function speicher(start: Record<string, string> = {}) {
  const d = new Map(Object.entries(start))
  return {
    d,
    get length() { return d.size },
    key: (i: number) => [...d.keys()][i] ?? null,
    getItem: (k: string) => (d.has(k) ? d.get(k)! : null),
    setItem: (k: string, v: string) => { d.set(k, String(v)) },
    removeItem: (k: string) => { d.delete(k) },
    clear: () => d.clear(),
  }
}

type Aufruf = { url: string; init: RequestInit }
let aufrufe: Aufruf[] = []
let antworten: (() => Response | Promise<Response>)[] = []
const json = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const roh = (status: number, text: string) => () => new Response(text, { status })
const keinNetz = () => () => { throw new TypeError('Failed to fetch') }

let ls: ReturnType<typeof speicher>
beforeEach(() => {
  aufrufe = []
  antworten = []
  ls = speicher()
  vi.stubGlobal('localStorage', ls)
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    aufrufe.push({ url, init })
    const a = antworten.shift()
    if (!a) throw new Error('keine Antwort vorbereitet')
    return a()
  }))
  auth.token = ''; auth.isValid = false; auth.record = null
})
afterEach(() => { vi.unstubAllGlobals() })

const anmelden = (id = 'u1', x: Record<string, unknown> = {}) => {
  auth.token = 'TOKEN-' + id; auth.isValid = true
  auth.record = { id, name: 'Anna Berg', organization_id: 'org1', role: 'benutzer', ...x }
}
const kopf = (i = 0) => (aufrufe[i].init.headers ?? {}) as Record<string, string>

const STAND = {
  version: 1,
  formulare: {
    patienten: { modus: 'passwort', an: true, oeffentlich: true, ausstehend: true },
    produktausgabe: { modus: 'frei', an: true, oeffentlich: false, ausstehend: true },
    defektmeldung: { modus: 'frei', an: false, oeffentlich: false, ausstehend: false },
    cirs: { modus: 'anonym', an: true, oeffentlich: true, ausstehend: false },
  },
  angemeldet: { id: 'u1', name: 'Anna Berg' },
}

describe('Token: nur wenn ausdrücklich gewollt', () => {
  it('ohne mitAnmeldung nie, mit nur bei gültigem Token', async () => {
    anmelden()
    antworten.push(json(200, STAND), json(200, STAND))
    await formularStand('wache1')
    await formularStand('wache1', { mitAnmeldung: true })
    expect(kopf(0).Authorization).toBeUndefined()
    expect(kopf(1).Authorization).toBe('TOKEN-u1')
    auth.isValid = false
    antworten.push(json(200, { vollstaendig: true, gefunden: true, eindeutig: true }))
    await nameGefunden('wache1', 'patienten', 'Anna Berg', { mitAnmeldung: true })
    expect(kopf(2).Authorization).toBeUndefined()
  })

  it('Routen mit Anmeldung immer mit Token; ohne gültiges Token gar nicht erst gefragt', async () => {
    for (const f of [offeneUnterschriften, () => unterschreiben('patienten', 'x'), () => ohneUnterschrift('x', 'Ein ausreichend langer Grund'), mitgliederPruefung]) {
      const r = await f()
      expect(r).toMatchObject({ ok: false, grund: 'nicht_angemeldet', status: 401, text: 'Bitte melde dich an.' })
    }
    expect(aufrufe).toHaveLength(0)
    anmelden()
    antworten.push(json(200, { eintraege: [] }), json(200, { ok: true, absender: {}, frist: '' }), json(200, { ok: true, absender: {} }), json(200, { gesamt: 0, koennen_nicht: 0, eintraege: [] }))
    await offeneUnterschriften(); await unterschreiben('patienten', 'x'); await ohneUnterschrift('x', 'Ein ausreichend langer Grund'); await mitgliederPruefung()
    expect(aufrufe.map((a) => (a.init.headers as Record<string, string>).Authorization)).toEqual(['TOKEN-u1', 'TOKEN-u1', 'TOKEN-u1', 'TOKEN-u1'])
    expect(aufrufe.map((a) => `${a.init.method} ${a.url}`)).toEqual([
      'GET https://api.test/api/responda/formular/unterschriften',
      'POST https://api.test/api/responda/formular/unterschreiben',
      'POST https://api.test/api/responda/formular/ohne-unterschrift',
      'GET https://api.test/api/responda/formular/mitglieder-pruefung',
    ])
  })

  it('absenden: Token nach o.mitAnmeldung; JSON mit Content-Type; Code in der URL kodiert', async () => {
    anmelden()
    antworten.push(json(200, { ok: true, id: 'abcdefghij01234', bereits: false, absender: { id: 'u1', name: 'Anna Berg', status: 'bestaetigt', weg: 'anmeldung', modus: 'passwort', am: 'x', feld: 'unterschrift' }, frist: 'f' }))
    const r = await absenden('wache 1', { formular: 'patienten', maske: 'doku', id: 'abcdefghij01234', absender: null, daten: { title: 't', payload: {} } }, { mitAnmeldung: true })
    expect(r).toEqual({ ok: true, wert: { id: 'abcdefghij01234', bereits: false, absender: { id: 'u1', name: 'Anna Berg', status: 'bestaetigt', weg: 'anmeldung', modus: 'passwort', am: 'x', feld: 'unterschrift' }, frist: 'f' } })
    expect(aufrufe[0].url).toBe('https://api.test/api/responda/formular/wache%201/absenden')
    expect(kopf().Authorization).toBe('TOKEN-u1')
    expect(kopf()['Content-Type']).toBe('application/json')
    expect(JSON.parse(String(aufrufe[0].init.body))).toEqual({ formular: 'patienten', maske: 'doku', id: 'abcdefghij01234', absender: null, daten: { title: 't', payload: {} } })
  })
})

describe('Body von /absenden', () => {
  const basis = { formular: 'patienten' as const, maske: 'doku' as const, id: 'abcdefghij01234', daten: {} }
  it('leeres Passwort fällt weg, Passwort vor ausstehend, maske nur bei patienten, uebernommen nur wenn true', () => {
    expect(absendeBody({ ...basis, absender: { name: 'Anna', passwort: '' } }).absender).toEqual({ name: 'Anna' })
    expect(absendeBody({ ...basis, absender: { name: 'Anna', passwort: 'pw', ausstehend: true } }).absender).toEqual({ name: 'Anna', passwort: 'pw' })
    expect(absendeBody({ ...basis, absender: { name: 'Anna', ausstehend: true } }).absender).toEqual({ name: 'Anna', ausstehend: true })
    expect(absendeBody({ ...basis, absender: null }).absender).toBeNull()
    expect(absendeBody({ ...basis, formular: 'produktausgabe', absender: null })).not.toHaveProperty('maske')
    expect(absendeBody({ ...basis, absender: null, uebernommen: false })).not.toHaveProperty('uebernommen')
    expect(absendeBody({ ...basis, absender: null, uebernommen: true }).uebernommen).toBe(true)
  })
})

describe('Antworten übersetzen', () => {
  const senden = () => absenden('wache1', { formular: 'patienten', maske: 'doku', id: 'abcdefghij01234', absender: { name: 'Anna Berg', passwort: 'pw' }, daten: {} }, { mitAnmeldung: false })

  it('Netzfehler (TypeError) → netz', async () => {
    antworten.push(keinNetz())
    expect(await senden()).toEqual({ ok: false, grund: 'netz', text: 'Keine Verbindung zum Server.', status: 0 })
  })

  it('grund und message des Servers samt Zusatzfeldern', async () => {
    antworten.push(json(401, { status: 401, message: 'Das Passwort stimmt nicht. Noch 4 Versuche, dann ist die Bestätigung 15 Minuten gesperrt.', grund: 'passwort_falsch', versuche_uebrig: 4 }))
    expect(await senden()).toEqual({ ok: false, grund: 'passwort_falsch', status: 401, text: 'Das Passwort stimmt nicht. Noch 4 Versuche, dann ist die Bestätigung 15 Minuten gesperrt.', versucheUebrig: 4 })
    antworten.push(json(429, { status: 429, message: 'Zu viele falsche Passwörter. Bitte in 15 Minuten erneut versuchen.', grund: 'gesperrt', sekunden: 900 }))
    expect(await senden()).toMatchObject({ grund: 'gesperrt', sekunden: 900 })
    antworten.push(json(409, { status: 409, message: 'x', grund: 'aenderung_alt', ziel: 'zzzzzzzzzzzzzzz' }))
    expect(await senden()).toMatchObject({ grund: 'aenderung_alt', ziel: 'zzzzzzzzzzzzzzz' })
    antworten.push(json(400, { status: 400, message: 'Bitte einen Namen eintragen.', grund: 'daten', feld: 'absender' }))
    expect(await senden()).toMatchObject({ grund: 'daten', feld: 'absender', text: 'Bitte einen Namen eintragen.' })
  })

  it('grund ohne message: Rückfalltext; unbekannter grund zählt nicht', async () => {
    antworten.push(json(429, { grund: 'drossel', sekunden: 125 }))
    expect(await senden()).toMatchObject({ grund: 'drossel', sekunden: 125, text: 'Gerade kommen sehr viele Anfragen. Bitte in 3 Minuten erneut versuchen.' })
    antworten.push(json(403, { grund: 'formular_aus' }))
    expect(await senden()).toMatchObject({ grund: 'formular_aus', text: TEXTE.formular_aus })
    antworten.push(json(500, { grund: 'erfunden', message: 'Something' }))
    expect(await senden()).toMatchObject({ grund: 'server', text: TEXTE.server })
  })

  it('429 ohne grund (Drossel von PocketBase) → drossel, 60 Sekunden', async () => {
    antworten.push(json(429, { status: 429, message: 'Too Many Requests.', data: {} }))
    expect(await senden()).toEqual({ ok: false, grund: 'drossel', status: 429, sekunden: 60, text: 'Gerade kommen sehr viele Anfragen. Bitte in einer Minute erneut versuchen.' })
  })

  it('400 ohne grund → daten; unlesbarer Body → server; 200 unlesbar → server', async () => {
    antworten.push(json(400, { status: 400, message: 'Something went wrong while processing your request.', data: {} }))
    expect(await senden()).toMatchObject({ grund: 'daten', text: TEXTE.daten })
    antworten.push(roh(502, '<html>Bad Gateway</html>'))
    expect(await senden()).toMatchObject({ grund: 'server', status: 502, text: TEXTE.server })
    antworten.push(roh(200, 'kein json'))
    expect(await senden()).toMatchObject({ grund: 'server', status: 200 })
  })

  it('404 ohne grund: alter Server, solange der neue nicht kürzlich gesehen wurde', async () => {
    antworten.push(json(404, { status: 404, message: 'File not found.', data: {} }))
    expect(await senden()).toEqual({ ok: false, grund: 'alter_server', status: 404, text: '' })
    // einmal den neuen Server gesehen: ein 404 ist jetzt ein Serverfehler
    antworten.push(json(200, STAND))
    await formularStand('wache1')
    antworten.push(json(404, { status: 404, message: 'File not found.', data: {} }))
    expect(await senden()).toMatchObject({ grund: 'server', text: 'Der Server nimmt gerade keine Formulare an. Es bleibt auf dem Gerät und geht später raus.' })
  })

  it('404 ohne grund bei Routen mit Anmeldung: nie stumm, mit Text für den Dialog (Befund Client-Abläufe 2)', async () => {
    anmelden('u1')
    antworten.push(json(404, { status: 404, message: 'File not found.', data: {} }))
    const r = await unterschreiben('patienten', 'abcdefghij01234')
    expect(r).toMatchObject({ ok: false, grund: 'alter_server', status: 404 })
    expect(r.text).toBe('Der Server bietet das gerade nicht an. Bitte später erneut versuchen oder die Leitung fragen.')
    antworten.push(json(404, { status: 404, message: 'File not found.', data: {} }))
    expect((await ohneUnterschrift('abcdefghij01234', 'Absender nicht erreichbar')).text).toBe('Der Server bietet das gerade nicht an. Bitte später erneut versuchen oder die Leitung fragen.')
    antworten.push(json(404, { status: 404, message: 'File not found.', data: {} }))
    expect((await zurueckweisen('patienten', 'abcdefghij01234')).text).toBe('Der Server bietet das gerade nicht an. Bitte später erneut versuchen oder die Leitung fragen.')
  })

  it('zurueckweisen: POST mit Token, liest den Absender', async () => {
    expect(await zurueckweisen('patienten', 'abcdefghij01234')).toMatchObject({ ok: false, grund: 'nicht_angemeldet' })
    anmelden('u1')
    antworten.push(json(200, { ok: true, absender: { id: 'u1', name: 'Anna Berg', status: 'ausstehend', weg: '', modus: 'passwort', am: 'a', zurueckgewiesen: { id: 'u1', name: 'Anna Berg', am: 'b' } } }))
    const r = await zurueckweisen('produktausgabe', 'abcdefghij01234')
    expect(r.ok).toBe(true)
    expect(r.wert?.absender?.zurueckgewiesen).toEqual({ id: 'u1', name: 'Anna Berg', am: 'b' })
    const a = aufrufe[aufrufe.length - 1]
    expect(a.url).toBe('https://api.test/api/responda/formular/zurueckweisen')
    expect(JSON.parse(String(a.init.body))).toEqual({ formular: 'produktausgabe', id: 'abcdefghij01234' })
    expect((a.init.headers as Record<string, string>).Authorization).toBeTruthy()
    antworten.push(json(403, { grund: 'fremd', message: 'Dieser Eintrag wartet auf die Unterschrift einer anderen Person.' }))
    expect(await zurueckweisen('patienten', 'abcdefghij01234')).toMatchObject({ ok: false, grund: 'fremd' })
  })

  it('404 mit grund organisation heißt: neuer Server', async () => {
    antworten.push(json(404, { status: 404, message: TEXTE.organisation, grund: 'organisation' }))
    expect(await formularStand('wache9')).toMatchObject({ grund: 'organisation' })
    expect(JSON.parse(ls.getItem('formular_server_wache9')!).gesehen).toBeTruthy()
  })

  it('Antworten der Routen gelesen', async () => {
    antworten.push(json(200, STAND))
    expect(await formularStand('wache1')).toEqual({ ok: true, wert: STAND })
    antworten.push(json(200, { vollstaendig: true, gefunden: true, eindeutig: false, extra: 1 }))
    expect(await nameGefunden('wache1', 'patienten', 'Max Mayer')).toEqual({ ok: true, wert: { vollstaendig: true, gefunden: true, eindeutig: false } })
    expect(JSON.parse(String(aufrufe[1].init.body))).toEqual({ formular: 'patienten', name: 'Max Mayer' })
    anmelden()
    antworten.push(json(200, { eintraege: [{ formular: 'patienten', id: 'p1', titel: 'T', zusammenfassung: 'Z', angelegt: 'A', absender_name: 'Anna Berg' }, { formular: 'cirs', id: 'x' }, null] }))
    expect(await offeneUnterschriften()).toEqual({ ok: true, wert: [{ formular: 'patienten', id: 'p1', titel: 'T', zusammenfassung: 'Z', angelegt: 'A', absender_name: 'Anna Berg' }] })
    antworten.push(json(200, { gesamt: 23, koennen_nicht: 2, eintraege: [{ id: 'a', name: 'Anna', gruende: ['name_unvollstaendig', 'erfunden'] }, { id: 'b', name: 'Max Mayer', gruende: ['name_doppelt'], email: 'nie@zeigen' }] }))
    const m = await mitgliederPruefung()
    // Ohne `doppelt` (älterer Server) zählt die App selbst
    expect(m).toEqual({ ok: true, wert: { gesamt: 23, koennen_nicht: 2, doppelt: 1, eintraege: [{ id: 'a', name: 'Anna', gruende: ['name_unvollstaendig'] }, { id: 'b', name: 'Max Mayer', gruende: ['name_doppelt'] }] } })
  })

  it('istFehler engt ein', async () => {
    antworten.push(keinNetz())
    const r = await formularStand('wache1')
    expect(istFehler(r)).toBe(true)
    if (istFehler(r)) expect(r.grund).toBe('netz')
  })

  it('ohne Unterschrift: zu kurzer oder zu langer Grund wird nicht gesendet', async () => {
    anmelden()
    expect(await ohneUnterschrift('x', '  kurz   ')).toMatchObject({ grund: 'daten', feld: 'grund', text: 'Bitte einen Grund angeben, mindestens 10 Zeichen.' })
    expect(await ohneUnterschrift('x', 'x'.repeat(501))).toMatchObject({ grund: 'daten', feld: 'grund' })
    expect(aufrufe).toHaveLength(0)
    antworten.push(json(200, { ok: true, absender: { id: 'u2', name: 'Paul', status: 'ohne_unterschrift', weg: '', modus: 'passwort', am: '' } }))
    await ohneUnterschrift('x', '  Absender nicht erreichbar  ')
    expect(JSON.parse(String(aufrufe[0].init.body))).toEqual({ formular: 'patienten', id: 'x', grund: 'Absender nicht erreichbar' })
  })
})

describe('Alter oder neuer Server (serverArt)', () => {
  const s = () => speicher()
  const jetzt = new Date('2026-11-15T12:00:00.000Z')
  const vor = (h: number) => new Date(jetzt.getTime() - h * 3600_000)

  it('nie gesehen → alt; vor 23 Stunden → server; vor 25 Stunden → alt; nach ALTER_SERVER_BIS → server', () => {
    expect(serverArt('wache1', { status: 404 }, jetzt, s())).toBe('alter_server')
    const a = s(); serverGesehen('wache1', vor(23), a)
    expect(serverArt('wache1', { status: 404 }, jetzt, a)).toBe('server')
    const b = s(); serverGesehen('wache1', vor(25), b)
    expect(serverArt('wache1', { status: 404 }, jetzt, b)).toBe('alter_server')
    const danach = new Date(`${ALTER_SERVER_BIS}T00:00:00.000Z`)
    expect(serverArt('wache1', { status: 404 }, danach, s())).toBe('server')
    expect(serverArt('wache1', { status: 404 }, new Date(danach.getTime() - 1), s())).toBe('alter_server')
    expect(alterWegErlaubt(danach)).toBe(false)
  })

  it('Erfolg oder grund merkt „gesehen“, je Organisation', () => {
    const a = s()
    expect(serverArt('wache1', { status: 200 }, vor(1), a)).toBe('neu')
    expect(serverArt('wache1', { status: 404 }, jetzt, a)).toBe('server')
    expect(serverArt('wache2', { status: 404 }, jetzt, a)).toBe('alter_server')
    expect(serverArt('wache2', { status: 403, grund: 'formular_aus' }, jetzt, a)).toBe('neu')
    expect(serverArt('wache2', { status: 404 }, jetzt, a)).toBe('server')
  })

  it('anderes sagt nichts; unlesbares Gemerktes zählt als nie gesehen; ohne Speicher alt', () => {
    expect(serverArt('wache1', { status: 500 }, jetzt, s())).toBe('unklar')
    expect(serverArt('wache1', { status: 404 }, jetzt, s())).toBe('alter_server')
    const k = speicher({ formular_server_wache1: '{kaputt' })
    expect(serverArt('wache1', { status: 404 }, jetzt, k)).toBe('alter_server')
    expect(serverArt('wache1', { status: 404 }, jetzt, null)).toBe('alter_server')
  })
})

describe('Passwort bleibt nicht auf dem Gerät', () => {
  it('nach Erfolg, Fehler und ohne Netz steht es nirgends in localStorage und nie in der URL', async () => {
    const pw = 'Sehr-Geheim-42'
    ls.setItem('vorher', 'x')
    antworten.push(json(200, { ok: true, id: 'abcdefghij01234', bereits: false, absender: { status: 'bestaetigt' }, frist: '' }), json(401, { grund: 'passwort_falsch', versuche_uebrig: 3 }), keinNetz())
    for (let i = 0; i < 3; i++) {
      await absenden('wache1', { formular: 'patienten', maske: 'doku', id: 'abcdefghij01234', absender: { name: 'Anna Berg', passwort: pw }, daten: {} }, { mitAnmeldung: false })
    }
    for (const v of ls.d.values()) expect(v).not.toContain(pw)
    for (const a of aufrufe) expect(a.url).not.toContain(pw)
    expect(String(aufrufe[0].init.body)).toContain(pw)
  })
})

describe('Kennungen und direkter Weg', () => {
  it('neueKennung: 15 × [a-z0-9]', () => {
    for (let i = 0; i < 50; i++) expect(kennungGueltig(neueKennung())).toBe(true)
    expect(kennungGueltig('ABCDEFGHIJ01234')).toBe(false)
    expect(kennungGueltig('abc')).toBe(false)
  })

  it('direkt anlegen: doppelte Kennung gilt als gesendet; Hook-Text gezeigt, englischer nie', async () => {
    const satz = { id: 'abcdefghij01234', title: 't' }
    antworten.push(json(200, { id: satz.id }))
    expect(await direktAnlegen('patients', satz, { mitAnmeldung: false })).toEqual({ ok: true, wert: { id: satz.id, bereits: false } })
    antworten.push(json(400, { data: { id: { code: 'validation_not_unique', message: 'Value must be unique.' } }, message: 'Failed to create record.', status: 400 }))
    expect(await direktAnlegen('patients', satz, { mitAnmeldung: false })).toEqual({ ok: true, wert: { id: satz.id, bereits: true } })
    antworten.push(json(400, { data: { title: { code: 'x' } }, message: 'Failed to create record.', status: 400 }))
    expect(await direktAnlegen('patients', satz, { mitAnmeldung: false })).toMatchObject({ ok: false, grund: 'daten', text: TEXTE.daten })
    const alt = 'Diese Fassung der App kann nicht mehr absenden. Bitte zuerst den Entwurf speichern, dann die App neu öffnen.'
    antworten.push(json(403, { data: {}, message: alt, status: 403 }))
    expect(await direktAnlegen('patients', satz, { mitAnmeldung: false, orgCode: 'wache1' })).toMatchObject({ ok: false, grund: 'nicht_berechtigt', text: alt })
    // daran erkennt das Gerät den neuen Server
    expect(serverArt('wache1', { status: 404 })).toBe('server')
    expect(aufrufe[0].url).toBe('https://api.test/api/collections/patients/records')
    expect(kopf(0).Authorization).toBeUndefined()
  })
})

describe('Stand ohne Netz (stand.ts)', () => {
  const org = { id: 'org1', org_code: 'wache1', form_config: { hidden_forms: ['produktausgabe'], absender: { produktausgabe: 'passwort' } }, freigeschaltet: ['patienten', 'lager'] }

  it('gemerkt wird ohne angemeldet', () => {
    const s = speicher()
    standMerken('wache1', { stand: standLesen(STAND)!, alt: false }, s)
    expect(s.getItem('formular_stand_wache1')).not.toContain('Anna')
    expect(gemerkterStand('wache1', s)?.stand).toEqual({ ...STAND, angemeldet: null })
  })

  it('gemerktes „alt“ gilt nur bis ALTER_SERVER_BIS', () => {
    const s = speicher()
    standMerken('wache1', { stand: null, alt: true }, s)
    expect(gemerkterStand('wache1', s, new Date('2026-12-01T00:00:00Z'))).toEqual({ stand: null, alt: true })
    expect(gemerkterStand('wache1', s, new Date('2027-02-01T00:00:00Z'))).toBeNull()
    expect(standOhneNetz('wache1', {}, s, new Date('2026-12-01T00:00:00Z'))).toEqual({ stand: null, alterServer: true })
  })

  it('ohne Gemerktes aus der Organisation (Modus, an, öffentlich, ausstehend: true), version 0', () => {
    const st = standAusOrg(org)
    expect(st.version).toBe(0)
    expect(st.formulare.patienten).toEqual({ modus: 'passwort', an: true, oeffentlich: true, ausstehend: true })
    expect(st.formulare.produktausgabe).toEqual({ modus: 'passwort', an: true, oeffentlich: false, ausstehend: true })
    // Lager schließt MPG und Vorgänge ein
    expect(st.formulare.defektmeldung).toEqual({ modus: 'frei', an: true, oeffentlich: true, ausstehend: true })
    expect(st.formulare.cirs.modus).toBe('anonym')
    expect(standAusOrg({ id: 'o', freigeschaltet: ['mpg'] }).formulare.patienten.an).toBe(false)
    expect(standAusOrg(null).formulare.patienten).toEqual({ modus: 'passwort', an: true, oeffentlich: true, ausstehend: true })
    // form_config als Text
    expect(standAusOrg({ id: 'o', form_config: JSON.stringify({ absender: { patienten: 'frei' } }) }).formulare.patienten.modus).toBe('frei')
  })

  it('Organisation aus org_cache_<code>, angemeldet nur aus der Sitzung, passend zur Organisation', () => {
    const s = speicher({ org_cache_wache1: JSON.stringify(org) })
    anmelden('u1')
    expect(standOhneNetz('wache1', { mitAnmeldung: true }, s).stand?.angemeldet).toEqual({ id: 'u1', name: 'Anna Berg' })
    expect(standOhneNetz('wache1', { mitAnmeldung: false }, s).stand?.angemeldet).toBeNull()
    expect(standOhneNetz('wache1', { mitAnmeldung: true }, speicher()).stand?.angemeldet).toBeNull()
    expect(standOhneNetz('wache1', { mitAnmeldung: true, org: { ...org, id: 'org2' } }, s).stand?.angemeldet).toBeNull()
    auth.isValid = false
    expect(standOhneNetz('wache1', { mitAnmeldung: true }, s).stand?.angemeldet).toBeNull()
  })

  it('alter Server: ohne Anmeldung kein Stand; mit Sitzung eines Mitglieds nur angemeldet (Befund Client-Abläufe 1)', () => {
    const s = speicher({ org_cache_wache1: JSON.stringify(org) })
    expect(standAlterServer('wache1', { mitAnmeldung: true }, s)).toEqual({ stand: null, alterServer: true })
    anmelden('u1')
    const r = standAlterServer('wache1', { mitAnmeldung: true }, s)
    expect(r.alterServer).toBe(true)
    expect(r.stand?.angemeldet).toEqual({ id: 'u1', name: 'Anna Berg' })
    expect(r.stand?.version).toBe(0)
    // „Anderer Absender“ (ohne Anmeldung) und fremde Organisation: kein Stand
    expect(standAlterServer('wache1', { mitAnmeldung: false }, s)).toEqual({ stand: null, alterServer: true })
    expect(standAlterServer('wache1', { mitAnmeldung: true, org: { ...org, id: 'org2' } }, s)).toEqual({ stand: null, alterServer: true })
    // ohne Netz mit gemerktem „alt“ dasselbe
    standMerken('wache1', { stand: null, alt: true }, s)
    expect(standOhneNetz('wache1', { mitAnmeldung: true }, s, new Date('2026-12-01T00:00:00Z')).stand?.angemeldet).toEqual({ id: 'u1', name: 'Anna Berg' })
    // gemerkt wird nie, wer angemeldet war
    expect(s.getItem('formular_stand_wache1')).not.toContain('u1')
  })

  it('angemeldetOhneNetz: Teilnehmer, Supervisor, gesperrt nie', () => {
    const u = { id: 'u1', name: ' Anna Berg ', organization_id: 'org1', role: 'benutzer' }
    expect(angemeldetOhneNetz('org1', u, true)).toEqual({ id: 'u1', name: 'Anna Berg' })
    expect(angemeldetOhneNetz('org1', { ...u, role: 'teilnehmer' }, true)).toBeNull()
    expect(angemeldetOhneNetz('org1', { ...u, supervisor: true }, true)).toBeNull()
    expect(angemeldetOhneNetz('org1', { ...u, disabled: true }, true)).toBeNull()
    expect(angemeldetOhneNetz('org1', u, false)).toBeNull()
    expect(angemeldetOhneNetz('', u, true)).toBeNull()
  })
})
