// Prüffälle für src/lib/push/abgleich.ts (Bauplan Push 6.2 und 6.6; Owner 12.4):
// Entscheidungstabelle des stillen Abgleichs, Ablauf der Anmeldung im Merker, Einschalten (Erlaubnis
// zuerst), Ausschalten, Abmelden (Benachrichtigungen schließen, auch wenn die Route scheitert),
// Schlüsselwechsel und Grabstein.

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../pocketbase', () => ({ pb: { baseURL: 'https://api.test', authStore: { isValid: false, token: '', record: null, model: null, onChange: () => () => {} } } }))

const A = await import('../push/abgleich')
const { PUSH_TEXTE: T } = await import('../push/texte')
type Teile = import('../push/abgleich').AbgleichTeile
type Merker = import('../push/geraet').PushMerker
type Fehler = import('../push/api').PushFehler

const JETZT = Date.parse('2026-11-16T10:00:00.000Z')
const STUNDE = 3600_000
const P = 'personabc123456'
const Q = 'personxyz987654'
const E1 = 'https://fcm.googleapis.com/fcm/send/eins'

function abo(endpoint = E1, schluessel: string | null = 'Bschluessel') {
  return {
    endpoint,
    options: { applicationServerKey: null },
    toJSON: () => ({ endpoint, keys: { p256dh: 'Bp', auth: 'au' } }),
    unsubscribe: vi.fn(async () => true),
    _schluessel: schluessel,
  } as unknown as PushSubscription & { unsubscribe: ReturnType<typeof vi.fn>; _schluessel: string | null }
}
const merker = (x: Partial<Merker> = {}): Merker => ({ person: P, api: 'https://api.test', schluessel: 'Bschluessel', endpoint: E1, gemeldet: JETZT - STUNDE, ablauf: JETZT + STUNDE, ...x })
const fehler = (f: Partial<Fehler>): Fehler => ({ ok: false, fehler: 'server', status: 500, text: 'x', ...f })

function teile(o: { abo?: PushSubscription | null; merker?: Merker | null; person?: { id: string; ablauf: number | null } | null; erlaubnis?: string } & Omit<Partial<Teile>, 'person' | 'erlaubnis'> = {}) {
  let m: Merker | null = o.merker === undefined ? null : o.merker
  const geschrieben: Merker[] = []
  const t: Teile & { geschrieben: Merker[]; merkerJetzt: () => Merker | null } = {
    aktuellesAbo: vi.fn(async () => (o.abo === undefined ? null : o.abo)),
    abonnieren: vi.fn(async (_k: string) => abo('https://fcm.googleapis.com/fcm/send/neu')),
    aboSchluessel: (a: PushSubscription) => (a as unknown as { _schluessel: string | null })._schluessel,
    merkerLesen: vi.fn(async () => m),
    merkerSchreiben: vi.fn(async (x: Merker) => { m = x; geschrieben.push(x) }),
    merkerLoeschen: vi.fn(async () => { m = null }),
    benachrichtigungenSchliessen: vi.fn(async () => {}),
    geraetAnmelden: vi.fn(async () => ({ ok: true as const, daten: { id: 'abcdefghijk1234', kennung: '0123456789abcdef' } })),
    geraetAbmelden: vi.fn(async () => ({ ok: true as const, daten: { geloescht: 1 } })),
    erlaubnis: () => o.erlaubnis ?? 'granted',
    erlaubnisAnfragen: vi.fn(async () => o.erlaubnis ?? 'granted'),
    person: () => (o.person === undefined ? { id: P, ablauf: JETZT + 2 * STUNDE } : o.person),
    geraetName: () => 'Android, Chrome',
    api: () => 'https://api.test',
    jetzt: () => JETZT,
    geschrieben,
    merkerJetzt: () => m,
  }
  // Nur ersetzte Funktionen übernehmen (abo, merker, person, erlaubnis sind Ausgangslage)
  const { abo: _a, merker: _m, person: _p, erlaubnis: _e, ...ersatz } = o
  return Object.assign(t, ersatz) as typeof t
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('abgleichSchritt: Tabelle 6.2', () => {
  const l = (x: Partial<Parameters<typeof A.abgleichSchritt>[0]> = {}) => A.abgleichSchritt({ abo: { endpoint: E1 }, merker: merker(), person: P, erlaubnis: 'granted', jetzt: JETZT, ...x })

  it('kein Abo: nichts', () => {
    expect(l({ abo: null })).toBe('nichts')
    expect(l({ abo: null, merker: null, person: null })).toBe('nichts')
  })

  it('Abo, niemand angemeldet (Sitzung abgelaufen oder abgelehnt): nichts, Push bleibt an', () => {
    expect(l({ person: null })).toBe('nichts')
    expect(l({ person: null, erlaubnis: 'denied' })).toBe('nichts')
    expect(l({ person: null, merker: null })).toBe('nichts')
  })

  it('Abo, andere Person oder kein Merker: lokal abmelden', () => {
    expect(l({ person: Q })).toBe('abmelden_lokal')
    expect(l({ merker: null })).toBe('abmelden_lokal')
    expect(l({ merker: { abgemeldet: true } })).toBe('abmelden_lokal')
    expect(l({ merker: { endpoint: E1 } })).toBe('abmelden_lokal')
  })

  it('dieselbe Person, Erlaubnis entzogen: abmelden', () => {
    expect(l({ erlaubnis: 'denied' })).toBe('abmelden')
  })

  it('dieselbe Person, erlaubt: neu melden bei anderem Endpoint, nach 24 h, nach Aboänderung', () => {
    expect(l({ abo: { endpoint: 'https://fcm.googleapis.com/fcm/send/anders' } })).toBe('neu_melden')
    expect(l({ merker: merker({ gemeldet: JETZT - 25 * STUNDE }) })).toBe('neu_melden')
    expect(l({ merker: merker({ gemeldet: JETZT - 23 * STUNDE }) })).toBe('nichts')
    expect(l({ merker: merker({ gemeldet: undefined }) })).toBe('neu_melden')
    expect(l({ merker: merker({ gemeldet: JETZT + 5 * STUNDE }) })).toBe('neu_melden')
    expect(l({ merker: merker({ abo_geaendert: true }) })).toBe('neu_melden')
    expect(l()).toBe('nichts')
    expect(l({ erlaubnis: 'default' })).toBe('nichts')
  })

  it('dieselbe Person nach vorbei gewesener Anmeldung wieder da: neu melden (neues Passwort meldet beim Server ab)', () => {
    expect(l({ merker: merker({ ablauf: JETZT - 1 }) })).toBe('neu_melden')
    expect(l({ merker: merker({ ablauf: JETZT }) })).toBe('neu_melden')
    expect(l({ merker: merker({ ablauf: JETZT + 1 }) })).toBe('nichts')
    expect(l({ merker: merker({ ablauf: null }) })).toBe('nichts')
    expect(l({ merker: merker({ ablauf: undefined }) })).toBe('nichts')
    // niemand angemeldet bleibt nichts, eine andere Person lokal abmelden
    expect(l({ merker: merker({ ablauf: JETZT - 1 }), person: null })).toBe('nichts')
    expect(l({ merker: merker({ ablauf: JETZT - 1 }), person: Q })).toBe('abmelden_lokal')
    expect(A.sitzungWarVorbei(null, JETZT)).toBe(false)
    expect(l({ merker: merker({ ablauf: JETZT - 1 }), erlaubnis: 'default' })).toBe('nichts')
    // eben in dieser Seite angemeldet (Merker noch mit altem, gültigem Ablauf): ebenso neu melden
    expect(l({ anmeldungNeu: true })).toBe('neu_melden')
    expect(l({ anmeldungNeu: true, person: null })).toBe('nichts')
    expect(l({ anmeldungNeu: true, person: Q })).toBe('abmelden_lokal')
  })
})

describe('Ablauf der Anmeldung im Merker (Owner 12.4)', () => {
  it('merkerNachSitzung', () => {
    expect(A.merkerNachSitzung(merker(), { id: P, ablauf: JETZT + STUNDE }, JETZT)).toBeNull()
    expect(A.merkerNachSitzung(merker(), { id: P, ablauf: JETZT + 9 * STUNDE }, JETZT)).toMatchObject({ ablauf: JETZT + 9 * STUNDE })
    expect(A.merkerNachSitzung(merker(), null, JETZT)).toMatchObject({ person: P, ablauf: JETZT })
    expect(A.merkerNachSitzung(merker({ ablauf: JETZT - 1 }), null, JETZT)).toBeNull()
    expect(A.merkerNachSitzung(merker({ ablauf: null }), null, JETZT)).toMatchObject({ ablauf: JETZT })
    expect(A.merkerNachSitzung(merker(), { id: Q, ablauf: JETZT }, JETZT)).toBeNull()
    expect(A.merkerNachSitzung({ abgemeldet: true }, null, JETZT)).toBeNull()
    expect(A.merkerNachSitzung(null, null, JETZT)).toBeNull()
  })

  it('sitzungsAblauf: exp des Tokens, früher abgelaufener Zugang gewinnt, Unsinn → null', () => {
    const token = (p: object) => 'x.' + Buffer.from(JSON.stringify(p)).toString('base64url') + '.y'
    const exp = Math.floor(JETZT / 1000) + 7200
    expect(A.sitzungsAblauf(token({ exp }))).toBe(exp * 1000)
    expect(A.sitzungsAblauf(token({ exp }), '2026-11-16 10:30:00.000Z')).toBe(Date.parse('2026-11-16T10:30:00.000Z'))
    expect(A.sitzungsAblauf(token({ exp }), '2027-01-01 00:00:00.000Z')).toBe(exp * 1000)
    expect(A.sitzungsAblauf('kaputt')).toBeNull()
    expect(A.sitzungsAblauf('')).toBeNull()
  })
})

describe('abgleichLaufen', () => {
  it('niemand angemeldet mit Abo: Abo und Merker bleiben, Einzelheiten nur bis jetzt (Owner 12.4)', async () => {
    const a = abo()
    const t = teile({ abo: a, merker: merker(), person: null })
    expect(await A.abgleichLaufen(t)).toBe('nichts')
    expect(a.unsubscribe).not.toHaveBeenCalled()
    expect(t.merkerLoeschen).not.toHaveBeenCalled()
    expect(t.merkerJetzt()).toMatchObject({ person: P, endpoint: E1, ablauf: JETZT })
  })

  it('dieselbe Person wieder angemeldet: gleich still neu melden, Ablauf aus dem neuen Token', async () => {
    const t = teile({ abo: abo(), merker: merker({ ablauf: JETZT - STUNDE }), person: { id: P, ablauf: JETZT + 14 * 24 * STUNDE } })
    expect(await A.abgleichLaufen(t)).toBe('neu_melden')
    expect(t.geraetAnmelden).toHaveBeenCalledWith({ endpoint: E1, keys: { p256dh: 'Bp', auth: 'au' } }, 'Android, Chrome', { ausdruecklich: false, schluessel: 'Bschluessel' })
    expect(t.merkerJetzt()).toEqual({ person: P, api: 'https://api.test', schluessel: 'Bschluessel', endpoint: E1, gemeldet: JETZT, ablauf: JETZT + 14 * 24 * STUNDE })
    // danach ruhig, bis wieder etwas anders ist
    expect(await A.abgleichLaufen(teile({ abo: abo(), merker: t.merkerJetzt(), person: { id: P, ablauf: JETZT + 14 * 24 * STUNDE } }))).toBe('nichts')
  })

  it('eben angemeldet (anmeldungNeu), Merker noch gültig: still neu melden; ohne Netz beim nächsten Mal', async () => {
    const t = teile({ abo: abo(), merker: merker() })
    expect(await A.abgleichLaufen(t, { anmeldungNeu: true })).toBe('neu_melden')
    expect(t.geraetAnmelden).toHaveBeenCalledTimes(1)
    expect(t.merkerJetzt()).toMatchObject({ gemeldet: JETZT, ablauf: JETZT + 2 * STUNDE })
    const t2 = teile({ abo: abo(), merker: merker(), geraetAnmelden: vi.fn(async () => fehler({ fehler: 'netz', status: 0 })) })
    expect(await A.abgleichLaufen(t2, { anmeldungNeu: true })).toBe('neu_melden')
    const m = t2.merkerJetzt()
    expect(m && 'gemeldet' in m).toBe(false)
    expect(A.abgleichSchritt({ abo: { endpoint: E1 }, merker: m, person: P, erlaubnis: 'granted', jetzt: JETZT })).toBe('neu_melden')
  })

  it('wieder angemeldet, aber ohne Netz: Einzelheiten wieder an, beim nächsten Abgleich erneut melden', async () => {
    const t = teile({ abo: abo(), merker: merker({ ablauf: JETZT - STUNDE }), person: { id: P, ablauf: JETZT + 14 * 24 * STUNDE }, geraetAnmelden: vi.fn(async () => fehler({ fehler: 'netz', status: 0 })) })
    expect(await A.abgleichLaufen(t)).toBe('neu_melden')
    const m = t.merkerJetzt()
    expect(m).toMatchObject({ person: P, endpoint: E1, ablauf: JETZT + 14 * 24 * STUNDE })
    expect(m && 'gemeldet' in m).toBe(false)
    const t2 = teile({ abo: abo(), merker: m, person: { id: P, ablauf: JETZT + 14 * 24 * STUNDE } })
    expect(await A.abgleichLaufen(t2)).toBe('neu_melden')
    expect(t2.merkerJetzt()).toMatchObject({ gemeldet: JETZT })
  })

  it('andere Person: lokal abmelden und Benachrichtigungen schließen', async () => {
    const a = abo()
    const t = teile({ abo: a, merker: merker(), person: { id: Q, ablauf: JETZT + STUNDE } })
    expect(await A.abgleichLaufen(t)).toBe('abmelden_lokal')
    expect(a.unsubscribe).toHaveBeenCalled()
    expect(t.merkerLoeschen).toHaveBeenCalled()
    expect(t.benachrichtigungenSchliessen).toHaveBeenCalled()
    expect(t.geraetAbmelden).not.toHaveBeenCalled()
  })

  it('Erlaubnis entzogen: beim Server abmelden, Merker weg', async () => {
    const a = abo()
    const t = teile({ abo: a, merker: merker(), erlaubnis: 'denied' })
    expect(await A.abgleichLaufen(t)).toBe('abmelden')
    expect(t.geraetAbmelden).toHaveBeenCalledWith({ endpoint: E1 })
    expect(t.merkerJetzt()).toBeNull()
  })

  it('neu melden: still (ausdruecklich false), Merker mit gemeldet und Ablauf', async () => {
    const t = teile({ abo: abo(), merker: merker({ gemeldet: JETZT - 30 * STUNDE }) })
    expect(await A.abgleichLaufen(t)).toBe('neu_melden')
    expect(t.geraetAnmelden).toHaveBeenCalledWith({ endpoint: E1, keys: { p256dh: 'Bp', auth: 'au' } }, 'Android, Chrome', { ausdruecklich: false, schluessel: 'Bschluessel' })
    expect(t.merkerJetzt()).toEqual({ person: P, api: 'https://api.test', schluessel: 'Bschluessel', endpoint: E1, gemeldet: JETZT, ablauf: JETZT + 2 * STUNDE })
  })

  it('409 abgemeldet (Grabstein): Abo weg, Merker nur noch { abgemeldet: true }', async () => {
    const a = abo()
    const t = teile({ abo: a, merker: merker({ abo_geaendert: true }), geraetAnmelden: vi.fn(async () => fehler({ fehler: 'abgemeldet', status: 409 })) })
    await A.abgleichLaufen(t)
    expect(a.unsubscribe).toHaveBeenCalled()
    expect(t.merkerJetzt()).toEqual({ abgemeldet: true })
  })

  it('409 schluessel_neu: altes Abo weg, mit dem neuen Schlüssel still neu abonnieren und anmelden', async () => {
    const a = abo()
    const anmelden = vi.fn()
      .mockResolvedValueOnce(fehler({ fehler: 'schluessel_neu', status: 409, schluessel: 'Bneu' }))
      .mockResolvedValueOnce({ ok: true, daten: { id: 'abcdefghijk1234', kennung: 'k' } })
    const t = teile({ abo: a, merker: merker({ gemeldet: 0 }), geraetAnmelden: anmelden })
    await A.abgleichLaufen(t)
    expect(a.unsubscribe).toHaveBeenCalled()
    expect(t.abonnieren).toHaveBeenCalledWith('Bneu')
    expect(anmelden.mock.calls[1][2]).toEqual({ ausdruecklich: false, schluessel: 'Bneu' })
    expect(t.merkerJetzt()).toMatchObject({ person: P, schluessel: 'Bneu', endpoint: 'https://fcm.googleapis.com/fcm/send/neu' })
  })

  it('409 schluessel_neu und der Browser verweigert ohne Geste: Merker neu_einschalten', async () => {
    const t = teile({
      abo: abo(), merker: merker({ gemeldet: 0 }),
      geraetAnmelden: vi.fn(async () => fehler({ fehler: 'schluessel_neu', status: 409, schluessel: 'Bneu' })),
      abonnieren: vi.fn(async () => { throw new Error('NotAllowedError') }),
    })
    await A.abgleichLaufen(t)
    expect(t.merkerJetzt()).toEqual({ neu_einschalten: true, person: P, schluessel: 'Bneu' })
    expect(await A.abgleichLaufen(teile({ abo: null, merker: t.merkerJetzt(), person: { id: P, ablauf: 1 } }))).toBe('nichts')
  })

  it('ohne Netz: nichts verloren, beim nächsten Mal', async () => {
    const t = teile({ abo: abo(), merker: merker({ gemeldet: 0 }), geraetAnmelden: vi.fn(async () => fehler({ fehler: 'netz', status: 0 })) })
    await A.abgleichLaufen(t)
    expect(t.merkerJetzt()).toMatchObject({ person: P, endpoint: E1, gemeldet: 0 })
  })

  it('kein Abo: Abo-Merker weg, Hinweis-Merker bleiben (nur für dieselbe Person)', async () => {
    const t1 = teile({ abo: null, merker: merker() })
    await A.abgleichLaufen(t1)
    expect(t1.merkerJetzt()).toBeNull()
    const t2 = teile({ abo: null, merker: { abgemeldet: true } })
    await A.abgleichLaufen(t2)
    expect(t2.merkerJetzt()).toEqual({ abgemeldet: true })
    const t3 = teile({ abo: null, merker: { neu_einschalten: true, person: Q, schluessel: 'B' } })
    await A.abgleichLaufen(t3)
    expect(t3.merkerJetzt()).toBeNull()
  })
})

describe('Einschalten, Ausschalten', () => {
  it('fragt als Erstes und ohne await nach der Erlaubnis', () => {
    const t = teile()
    void A.pushEinschalten({ id: P }, { schluessel: 'Bk' }, t)
    // noch synchron im selben Aufruf: die Erlaubnis ist schon angefragt, abonniert noch nicht
    expect(t.erlaubnisAnfragen).toHaveBeenCalledTimes(1)
    expect(t.abonnieren).not.toHaveBeenCalled()
  })

  it('abgelehnt und nicht erlaubt', async () => {
    expect(await A.pushEinschalten({ id: P }, { schluessel: 'Bk' }, teile({ erlaubnis: 'denied' }))).toEqual({ ok: false, zustand: 'abgelehnt', text: T.abgelehnt })
    const r = await A.pushEinschalten({ id: P }, { schluessel: 'Bk' }, teile({ erlaubnis: 'default' }))
    expect(r.zustand).toBe('nicht_erlaubt')
  })

  it('erlaubt: abonnieren, ausdrücklich anmelden, Merker mit Ablauf', async () => {
    const t = teile()
    expect(await A.pushEinschalten({ id: P }, { schluessel: 'Bk' }, t)).toEqual({ ok: true, text: '' })
    expect(t.abonnieren).toHaveBeenCalledWith('Bk')
    expect((t.geraetAnmelden as ReturnType<typeof vi.fn>).mock.calls[0][2]).toEqual({ ausdruecklich: true, schluessel: 'Bk' })
    expect(t.merkerJetzt()).toEqual({ person: P, api: 'https://api.test', schluessel: 'Bk', endpoint: 'https://fcm.googleapis.com/fcm/send/neu', gemeldet: JETZT, ablauf: JETZT + 2 * STUNDE })
  })

  it('Server lehnt ab: Abo wieder weg, Text des Servers', async () => {
    const neu = abo('https://fcm.googleapis.com/fcm/send/neu')
    const t = teile({ abonnieren: vi.fn(async () => neu), geraetAnmelden: vi.fn(async () => fehler({ fehler: 'dienst_fehlt', status: 503, text: T.dienst_fehlt })) })
    expect(await A.pushEinschalten({ id: P }, { schluessel: 'Bk' }, t)).toEqual({ ok: false, zustand: 'fehler', text: T.dienst_fehlt })
    expect(neu.unsubscribe).toHaveBeenCalled()
    expect(t.merkerSchreiben).not.toHaveBeenCalled()
  })

  it('Schlüssel inzwischen gewechselt: einmal mit dem neuen', async () => {
    const anmelden = vi.fn()
      .mockResolvedValueOnce(fehler({ fehler: 'schluessel_neu', status: 409, schluessel: 'Bneu' }))
      .mockResolvedValueOnce({ ok: true, daten: { id: 'i', kennung: 'k' } })
    const t = teile({ geraetAnmelden: anmelden })
    expect((await A.pushEinschalten({ id: P }, { schluessel: 'Balt' }, t)).ok).toBe(true)
    expect(t.abonnieren).toHaveBeenNthCalledWith(2, 'Bneu')
    expect(t.merkerJetzt()?.schluessel).toBe('Bneu')
  })

  it('Ausschalten: Server zuerst, dann Abo, Merker, Benachrichtigungen; ohne Netz trotzdem aus', async () => {
    const a = abo()
    const t = teile({ abo: a, merker: merker() })
    expect(await A.pushAusschalten(t)).toEqual({ ok: true, server: true })
    expect(t.geraetAbmelden).toHaveBeenCalledWith({ endpoint: E1 })
    expect(a.unsubscribe).toHaveBeenCalled()
    expect(t.merkerJetzt()).toBeNull()
    expect(t.benachrichtigungenSchliessen).toHaveBeenCalled()
    const b = abo()
    const t2 = teile({ abo: b, merker: merker(), geraetAbmelden: vi.fn(async () => fehler({ fehler: 'netz', status: 0 })) })
    expect(await A.pushAusschalten(t2)).toEqual({ ok: true, server: false })
    expect(b.unsubscribe).toHaveBeenCalled()
  })
})

describe('Abmelden mit echtem navigator.serviceWorker (gestubbt)', () => {
  function geraetStub() {
    const a = abo()
    const n1 = { close: vi.fn() }
    const n2 = { close: vi.fn() }
    const reg = { pushManager: { getSubscription: vi.fn(async () => a) }, getNotifications: vi.fn(async () => [n1, n2]) }
    const nav = { serviceWorker: { getRegistration: vi.fn(async () => reg) }, clearAppBadge: vi.fn(async () => {}) }
    vi.stubGlobal('navigator', nav)
    return { a, n1, n2, reg, nav }
  }
  const echt = { aktuellesAbo: undefined, benachrichtigungenSchliessen: undefined, merkerLoeschen: undefined, merkerLesen: undefined } as Partial<Teile>
  function ohne(t: ReturnType<typeof teile>): Partial<Teile> {
    // die Browser-Teile aus geraet.ts nehmen (nur Server, Person und Uhr ersetzt)
    const x: Partial<Teile> = { ...t }
    for (const k of Object.keys(echt) as (keyof Teile)[]) delete x[k]
    return x
  }

  it('pushBeimAbmelden: Route gerufen, Abo weg, getNotifications und close je Benachrichtigung, clearAppBadge', async () => {
    const s = geraetStub()
    const t = teile()
    await A.pushBeimAbmelden({ timeoutMs: 100 }, ohne(t))
    expect(t.geraetAbmelden).toHaveBeenCalledWith({ endpoint: E1 }, expect.anything())
    expect(s.a.unsubscribe).toHaveBeenCalled()
    expect(s.reg.getNotifications).toHaveBeenCalled()
    expect(s.n1.close).toHaveBeenCalled()
    expect(s.n2.close).toHaveBeenCalled()
    expect(s.nav.clearAppBadge).toHaveBeenCalled()
  })

  it('pushBeimAbmelden: Route scheitert oder hängt, trotzdem alles geschlossen', async () => {
    for (const abmelden of [vi.fn(async () => { throw new Error('netz') }), vi.fn(() => new Promise<never>(() => {}))]) {
      const s = geraetStub()
      const t = teile({ geraetAbmelden: abmelden as unknown as Teile['geraetAbmelden'] })
      const start = Date.now()
      await A.pushBeimAbmelden({ timeoutMs: 80 }, ohne(t))
      expect(Date.now() - start).toBeLessThan(2000)
      expect(s.a.unsubscribe).toHaveBeenCalled()
      expect(s.n1.close).toHaveBeenCalled()
      expect(s.n2.close).toHaveBeenCalled()
      expect(s.nav.clearAppBadge).toHaveBeenCalled()
    }
  })

  it('pushBeimAbmelden ohne gültige Anmeldung: keine Route, lokal trotzdem alles weg', async () => {
    const s = geraetStub()
    const t = teile({ person: null })
    await A.pushBeimAbmelden({ timeoutMs: 100 }, ohne(t))
    expect(t.geraetAbmelden).not.toHaveBeenCalled()
    expect(s.a.unsubscribe).toHaveBeenCalled()
    expect(s.n1.close).toHaveBeenCalled()
  })

  it('abmelden_lokal (andere Person) schließt die angezeigten Benachrichtigungen', async () => {
    const s = geraetStub()
    const t = teile({ merker: merker(), person: { id: Q, ablauf: JETZT + STUNDE } })
    const x = ohne(t)
    x.merkerLesen = t.merkerLesen
    expect(await A.abgleichLaufen(x)).toBe('abmelden_lokal')
    expect(s.a.unsubscribe).toHaveBeenCalled()
    expect(s.n1.close).toHaveBeenCalled()
    expect(s.nav.clearAppBadge).toHaveBeenCalled()
  })
})
