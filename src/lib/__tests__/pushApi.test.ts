// Prüffälle für src/lib/push/api.ts (Bauplan Push 1.2, 6.6; Owner 12.3): Antworten und Fehler der
// Routen, „nicht eingerichtet“ bei fehlender Route, Drossel mit Minuten, Mitteilungen der
// Organisation (Anlegen, Zurückziehen, klare Texte bei 429 und 403).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientResponseError } from 'pocketbase'

const pbFake = vi.hoisted(() => {
  const coll = { getFullList: vi.fn(), create: vi.fn(), update: vi.fn() }
  return {
    send: vi.fn(),
    collection: vi.fn(() => coll),
    coll,
    filter: (f: string, p: Record<string, string>) => f.replace(/\{:(\w+)\}/g, (_, k) => JSON.stringify(p[k])),
  }
})
vi.mock('../pocketbase', () => ({ pb: pbFake }))

const api = await import('../push/api')
const { PUSH_TEXTE: T } = await import('../push/texte')

const fehler = (status: number, response?: unknown) => new ClientResponseError({ status, response })

beforeEach(() => {
  pbFake.send.mockReset()
  pbFake.coll.getFullList.mockReset()
  pbFake.coll.create.mockReset()
  pbFake.coll.update.mockReset()
})

describe('Fehler der Routen', () => {
  it('404 ohne grund (Route fehlt): nicht eingerichtet', async () => {
    pbFake.send.mockRejectedValue(fehler(404, { status: 404, message: "The requested resource wasn't found.", data: {} }))
    const r = await api.pushStand()
    expect(api.istFehler(r)).toBe(true)
    if (!api.istFehler(r)) return
    expect(r.fehler).toBe('nicht_eingerichtet')
    expect(r.text).toBe(T.nicht_eingerichtet)
  })

  it('404 mit grund nicht_gefunden bleibt nicht_gefunden', async () => {
    pbFake.send.mockRejectedValue(fehler(404, { status: 404, message: 'Dieses Gerät ist hier nicht angemeldet.', grund: 'nicht_gefunden' }))
    const r = await api.geraetAbmelden({ id: 'abcdefghijk1234' })
    if (!api.istFehler(r)) throw new Error('erwartet Fehler')
    expect(r.fehler).toBe('nicht_gefunden')
    expect(r.text).toBe('Dieses Gerät ist hier nicht angemeldet.')
  })

  it('503 mit fehlt', async () => {
    pbFake.send.mockRejectedValue(fehler(503, { status: 503, message: 'Push ist auf dem Server noch nicht eingerichtet.', grund: 'nicht_eingerichtet', fehlt: ['push_geraete', 'dienst', 3] }))
    const r = await api.probeSenden()
    if (!api.istFehler(r)) throw new Error('erwartet Fehler')
    expect(r.fehler).toBe('nicht_eingerichtet')
    expect(r.fehlt).toEqual(['push_geraete', 'dienst'])
  })

  it('429: Text des Servers unverändert, ohne Text mit Minuten', async () => {
    pbFake.send.mockRejectedValueOnce(fehler(429, { status: 429, message: 'Gerade kommen sehr viele Anfragen. Bitte in 3 Minuten erneut versuchen.', grund: 'drossel', sekunden: 150 }))
    const a = await api.einstellungenSpeichern({ aus: [] })
    if (!api.istFehler(a)) throw new Error('erwartet Fehler')
    expect(a.fehler).toBe('drossel')
    expect(a.sekunden).toBe(150)
    expect(a.text).toBe('Gerade kommen sehr viele Anfragen. Bitte in 3 Minuten erneut versuchen.')
    pbFake.send.mockRejectedValueOnce(fehler(429, { sekunden: 150 }))
    const b = await api.einstellungenSpeichern({ aus: [] })
    if (!api.istFehler(b)) throw new Error('erwartet Fehler')
    expect(b.text).toBe('Gerade kommen sehr viele Anfragen. Bitte in 3 Minuten erneut versuchen.')
    pbFake.send.mockRejectedValueOnce(fehler(429, {}))
    const c = await api.einstellungenSpeichern({ aus: [] })
    if (!api.istFehler(c)) throw new Error('erwartet Fehler')
    expect(c.text).toBe('Gerade kommen sehr viele Anfragen. Bitte in einer Minute erneut versuchen.')
    expect(api.fehlerLesen(429, { sekunden: 7200 }).text).toBe('Gerade kommen sehr viele Anfragen. Bitte in 2 Stunden erneut versuchen.')
  })

  it('409 schluessel_neu mit Schlüssel, 409 abgemeldet', async () => {
    pbFake.send.mockRejectedValueOnce(fehler(409, { status: 409, message: 'Push muss auf diesem Gerät neu eingeschaltet werden.', grund: 'schluessel_neu', schluessel: 'Bneu' }))
    const r = await api.geraetAnmelden({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'B', auth: 'a' } }, 'Android, Chrome', { ausdruecklich: false, schluessel: 'Balt' })
    if (!api.istFehler(r)) throw new Error('erwartet Fehler')
    expect(r.fehler).toBe('schluessel_neu')
    expect(r.schluessel).toBe('Bneu')
    pbFake.send.mockRejectedValueOnce(fehler(409, { status: 409, message: 'Dieses Gerät wurde in der Geräteliste abgemeldet.', grund: 'abgemeldet' }))
    const r2 = await api.geraetAnmelden({ endpoint: 'x' }, 'x', { ausdruecklich: false, schluessel: 'B' })
    if (!api.istFehler(r2)) throw new Error('erwartet Fehler')
    expect(r2.fehler).toBe('abgemeldet')
  })

  it('ohne Verbindung (Status 0, abgebrochen): netz', async () => {
    pbFake.send.mockRejectedValueOnce(fehler(0))
    const r = await api.pushStand()
    if (!api.istFehler(r)) throw new Error('erwartet Fehler')
    expect(r.fehler).toBe('netz')
    expect(r.text).toBe(T.netz)
    pbFake.send.mockRejectedValueOnce(new ClientResponseError({ isAbort: true }))
    const r2 = await api.pushStand()
    if (!api.istFehler(r2)) throw new Error('erwartet Fehler')
    expect(r2.fehler).toBe('netz')
  })

  it('englischer PocketBase-Text ohne grund wird durch einen eigenen ersetzt', () => {
    expect(api.fehlerLesen(403, { message: 'The request requires valid record authorization token.' }).text).toBe(T.nicht_berechtigt)
    expect(api.fehlerLesen(401, { message: 'x' }).fehler).toBe('nicht_angemeldet')
    expect(api.fehlerLesen(500, {}).fehler).toBe('server')
    expect(api.fehlerLesen(400, { grund: 'daten', feld: 'endpoint', message: 'Die Angaben sind unvollständig oder ungültig.' }).feld).toBe('endpoint')
  })
})

describe('Antworten der Routen', () => {
  it('stand wird gelesen und normalisiert', async () => {
    pbFake.send.mockResolvedValue({
      v: 1, eingerichtet: true, fehlt: [], dienst: true, schluessel: 'Bxyz',
      geraete: [{ id: 'abcdefghijk1234', kennung: '3f2a9c1b0d4e5f6a', geraet: 'iPhone, Homebildschirm', angemeldet: '2026-11-15 10:00:00.000Z' }, { kaputt: true }],
      anlaesse: [{ key: 'mpg_gesperrt', gruppe: 'mpg', titel: 'Gerät gesperrt', beschreibung: 'b', art: 'sofort', pflicht: false, org_an: true, person_an: false }, { key: 'woche', art: 'komisch' }],
      person: '{"v":1,"aus":["mpg_gesperrt","mitteilung"],"ruhe":{"an":true,"von":"21:00","bis":"6:00"}}',
      ruhe_jetzt: false, darf_organisation: true,
    })
    const r = await api.pushStand()
    const d = api.datenVon(r)
    expect(d).not.toBeNull()
    expect(d!.geraete).toHaveLength(1)
    expect(d!.anlaesse[0]).toMatchObject({ key: 'mpg_gesperrt', person_an: false, org_an: true })
    expect(d!.anlaesse[1].art).toBe('sofort')
    expect(d!.person).toEqual({ v: 1, aus: ['mpg_gesperrt'], ruhe: { an: true, von: '21:00', bis: '06:00' }, mitteilung_in_ruhe: true })
    expect(d!.darf_organisation).toBe(true)
    expect(pbFake.send).toHaveBeenCalledWith('/api/responda/push/stand', expect.objectContaining({ method: 'GET' }))
  })

  it('unlesbare Antwort: server', async () => {
    pbFake.send.mockResolvedValue('kaputt')
    const r = await api.pushStand()
    expect(api.istFehler(r) && r.fehler).toBe('server')
  })

  it('geraetAnmelden schickt genau die Felder des Vertrags als JSON', async () => {
    pbFake.send.mockResolvedValue({ ok: true, id: 'abcdefghijk1234', kennung: '3f2a9c1b0d4e5f6a' })
    const r = await api.geraetAnmelden({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'Bp', auth: 'au' }, expirationTime: null }, 'Android, Chrome', { ausdruecklich: true, schluessel: 'Bk' })
    expect(api.datenVon(r)).toEqual({ id: 'abcdefghijk1234', kennung: '3f2a9c1b0d4e5f6a' })
    const [pfad, opt] = pbFake.send.mock.calls[0] as [string, { method: string; body: string; headers: Record<string, string> }]
    expect(pfad).toBe('/api/responda/push/geraet')
    expect(opt.method).toBe('POST')
    expect(opt.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(opt.body)).toEqual({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'Bp', auth: 'au' }, geraet: 'Android, Chrome', ausdruecklich: true, schluessel: 'Bk' })
  })

  it('Organisation laden und speichern', async () => {
    pbFake.send.mockResolvedValueOnce({ aus: ['cirs_neu'], anlaesse: [{ key: 'cirs_neu', gruppe: 'vorgaenge', titel: 'Neue CIRS-Meldung', beschreibung: '', art: 'sofort', pflicht: false, modul_frei: false }] })
    const o = api.datenVon(await api.organisationLaden())
    expect(o).toEqual({ aus: ['cirs_neu'], anlaesse: [{ key: 'cirs_neu', gruppe: 'vorgaenge', titel: 'Neue CIRS-Meldung', beschreibung: '', art: 'sofort', pflicht: false, modul_frei: false }] })
    pbFake.send.mockResolvedValueOnce({ aus: ['cirs_neu', 'einsendung'] })
    expect(api.datenVon(await api.organisationSpeichern(['cirs_neu', 'einsendung']))).toEqual(['cirs_neu', 'einsendung'])
    expect(JSON.parse((pbFake.send.mock.calls[1][1] as { body: string }).body)).toEqual({ aus: ['cirs_neu', 'einsendung'] })
  })
})

describe('Mitteilungen der Organisation (Owner 12.3)', () => {
  it('Senden legt eine aktive Mitteilung der eigenen Organisation an, ohne created_by', async () => {
    pbFake.coll.create.mockResolvedValue({ id: 'm1' })
    expect(await api.mitteilungSenden('org1', 'Halle gesperrt', 'Bitte umparken.')).toEqual({ ok: true, text: '' })
    expect(pbFake.collection).toHaveBeenCalledWith('hub_notifications')
    const daten = pbFake.coll.create.mock.calls[0][0] as Record<string, unknown>
    expect(daten).toEqual({ organization_id: 'org1', title: 'Halle gesperrt', message: 'Bitte umparken.', type: 'info', active: true })
  })

  it('429 und 403: Text des Servers, sonst eigener klarer Text', async () => {
    pbFake.coll.create.mockRejectedValueOnce(fehler(429, { status: 429, message: 'Höchstens drei Mitteilungen je Organisation in 24 Stunden. Die nächste geht in 5 Stunden wieder.', data: {} }))
    expect((await api.mitteilungSenden('org1', 't', '')).text).toBe('Höchstens drei Mitteilungen je Organisation in 24 Stunden. Die nächste geht in 5 Stunden wieder.')
    pbFake.coll.create.mockRejectedValueOnce(fehler(429, { status: 429, message: 'Too Many Requests.' }))
    expect((await api.mitteilungSenden('org1', 't', '')).text).toBe(T.mitteilungDrossel)
    pbFake.coll.create.mockRejectedValueOnce(fehler(403, { status: 403, message: 'Mitteilungen der Organisation schicken nur der Supervisor und die Leitung der eigenen Organisation.' }))
    expect((await api.mitteilungSenden('org2', 't', '')).text).toBe('Mitteilungen der Organisation schicken nur der Supervisor und die Leitung der eigenen Organisation.')
    pbFake.coll.create.mockRejectedValueOnce(fehler(403, { status: 403, message: 'Only superusers can perform this action.' }))
    expect((await api.mitteilungSenden('org2', 't', '')).text).toBe(T.mitteilungVerboten)
    pbFake.coll.create.mockRejectedValueOnce(fehler(400, { status: 400, message: 'Failed to create record.', data: { title: { code: 'validation_max_text_constraint' } } }))
    expect((await api.mitteilungSenden('org1', 't', '')).text).toBe(T.mitteilungTitelLang)
    pbFake.coll.create.mockRejectedValueOnce(fehler(0))
    const n = await api.mitteilungSenden('org1', 't', '')
    expect(n).toEqual({ ok: false, text: T.netz })
  })

  it('Zurückziehen setzt active auf false', async () => {
    pbFake.coll.update.mockResolvedValue({})
    expect((await api.mitteilungZurueckziehen('m1')).ok).toBe(true)
    expect(pbFake.coll.update).toHaveBeenCalledWith('m1', { active: false }, expect.anything())
  })

  it('Liste: nur aktive der eigenen Organisation, neueste zuerst', async () => {
    pbFake.coll.getFullList.mockResolvedValue([{ id: 'm1', title: 'A', message: 'x', created: '2026-11-15 10:00:00.000Z', active: true, organization_id: 'org1' }, null])
    const r = await api.mitteilungenLaden('org1')
    expect(r.liste).toHaveLength(1)
    const o = pbFake.coll.getFullList.mock.calls[0][0] as { filter: string; sort: string }
    expect(o.filter).toBe('organization_id = "org1" && active = true')
    expect(o.sort).toBe('-created')
    pbFake.coll.getFullList.mockRejectedValue(fehler(0))
    expect(await api.mitteilungenLaden('org1')).toEqual({ liste: null, text: T.mitteilungListeFehler })
  })
})
