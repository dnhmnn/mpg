// Prüffälle des Hintergrundversands (public/sw-formulare.js, Plan Vorgänge 5.6, 6.1).
//
// Der Service Worker ist reines JavaScript; hier läuft dieselbe Datei in einem eigenen
// Kontext. Geprüft wird: die Entscheidungstabelle 5.6, der Gleichlauf mit naechsterSchritt
// und fehlerAnwenden (versand.ts) und absendeBody (api.ts), nie Token oder Passwort, und ein
// ganzer Durchgang über echte, mit WebCrypto verschlüsselte Datensätze des Tresors.
//
// Nicht hier prüfbar (nur im Browser, siehe Browserprobe): IndexedDB, das Auslösen des Syncs
// durch Chrome, clients.matchAll und die Antwort der Fenster über einen MessageChannel.

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const auth = vi.hoisted(() => ({ token: '', isValid: false, record: null as Record<string, unknown> | null, get model() { return this.record }, onChange: () => () => {} }))
vi.mock('../pocketbase', () => ({ pb: { baseURL: 'https://api.test', authStore: auth } }))

const { naechsterSchritt, fehlerAnwenden, BLEIBENDE_GRUENDE } = await import('../formular/versand')
const { absendeBody, GRUENDE } = await import('../formular/api')
const { ablegen, aktualisieren, eintraege, SCHLUESSEL_PREFIX, OHNE_PASSWORT_NACH_MS } = await import('../formular/warteschlange')
const { TresorKern, ablageSchluessel, karteAn, kartenAntwort } = await import('../tresor')
type Warteeintrag = import('../formular/warteschlange').Warteeintrag
type NeuerEintrag = import('../formular/warteschlange').NeuerEintrag
type Stand = import('../formular/api').Stand
type TresorAblage = import('../tresor').TresorAblage

type SwSchritt = { art: 'ueberspringen' | 'name_pruefen' | 'senden'; absender?: { name: string; ausstehend?: boolean } | null; fenster?: boolean }
type Hintergrund = {
  TAG: string
  OHNE_PASSWORT_NACH_MS: number
  schritt: (e: unknown, lage: { stand: unknown; jetzt: number; erledigt?: string[]; eindeutig?: boolean; fensterOffen?: boolean }) => SwSchritt
  body: (e: unknown, absender: unknown) => Record<string, unknown>
  antwortLesen: (roh: { netz: boolean; status: number; body: unknown }) => Record<string, unknown>
  fehlerAnwenden: (x: unknown, f: unknown, o: { jetzt: number; aendern?: boolean; id?: string; neueId: () => string }) => Record<string, unknown>
  eintragGueltig: (e: unknown) => boolean
  neueKennung: (zufall: (a: Uint8Array) => Uint8Array) => string
  lauf: (u: Record<string, unknown>) => Promise<{ gesendet: number; nochmal: boolean; uebersprungen: number; imFenster: number }>
}

let H: Hintergrund
let syncHandler: ((ev: unknown) => void) | null = null
beforeAll(() => {
  const code = readFileSync(new URL('../../../public/sw-formulare.js', import.meta.url), 'utf8')
  const self: Record<string, unknown> = { addEventListener: (t: string, f: (ev: unknown) => void) => { if (t === 'sync') syncHandler = f } }
  runInNewContext(code, { self, TextEncoder, TextDecoder, setTimeout, clearTimeout, Uint8Array, ArrayBuffer, Promise, JSON, Date, Object, Array })
  H = self.RespondaHintergrund as Hintergrund
})

const JETZT = new Date('2026-11-07T10:20:00.000Z')
const fs = (modus: 'passwort' | 'frei', ausstehend: boolean) => ({ modus, an: true, oeffentlich: true, ausstehend })
function stand(modus: 'passwort' | 'frei', ausstehend: boolean, eigen: boolean | null = ausstehend): Stand {
  const s: Stand = {
    version: 2,
    formulare: { patienten: fs(modus, ausstehend), produktausgabe: fs(modus, ausstehend), defektmeldung: fs(modus, ausstehend), cirs: { modus: 'anonym', an: true, oeffentlich: true, ausstehend: false } },
    angemeldet: null,
  }
  if (eigen !== null) s.formulare.eigen = { modus: 'frei', an: true, oeffentlich: true, ausstehend: eigen }
  return s
}
const V1 = 'vvvvvvvvvvvvvv1'
const eintrag = (x: Partial<Warteeintrag> = {}): Warteeintrag => ({
  v: 2, id: 'abcdefghij01234', formular: 'patienten', maske: 'doku', orgCode: 'wache1', orgId: 'org1',
  angelegt: '2026-11-07T10:00:00.000Z', absenderName: 'Ida Imker', angemeldetId: '', versuche: 0,
  daten: { title: 'Patientendoku: Max Muster', payload: { name: 'Muster' } },
  ...x,
})

// ── Tabelle 5.6 ────────────────────────────────────────────────────────────

describe('Hintergrund: Entscheidungstabelle (5.6)', () => {
  const lage = (x: Partial<{ stand: Stand | null; erledigt: string[]; eindeutig: boolean; fensterOffen: boolean }> = {}) => ({ stand: stand('frei', true), jetzt: JETZT.getTime(), erledigt: [], ...x })

  it('überspringt Änderungen, Wartezeit, bleibende Fehler und schon Gesendetes', () => {
    expect(H.schritt(eintrag({ ziel: 'zzzzzzzzzzzzzzz' }), lage()).art).toBe('ueberspringen')
    expect(H.schritt(eintrag({ naechsterVersuchAb: new Date(JETZT.getTime() + 1000).toISOString() }), lage()).art).toBe('ueberspringen')
    expect(H.schritt(eintrag({ naechsterVersuchAb: new Date(JETZT.getTime() - 1000).toISOString() }), lage()).art).toBe('senden')
    expect(H.schritt(eintrag({ letzterFehler: { grund: 'formular_aus', text: 't', am: '' } }), lage()).art).toBe('ueberspringen')
    expect(H.schritt(eintrag(), lage({ erledigt: ['abcdefghij01234'] })).art).toBe('ueberspringen')
    expect(H.schritt({ v: 2, id: 'kurz' }, lage()).art).toBe('ueberspringen')
  })

  it('anonymes eigenes Formular: senden ohne Absender, auch ohne Stand', () => {
    const e = eintrag({ formular: 'eigen', vorlage: V1, modus: 'anonym', absenderName: '', daten: { version: 1, werte: {} } })
    expect(H.schritt(e, lage({ stand: null }))).toEqual({ art: 'senden', absender: null })
  })

  it('Name frei: senden mit Namen (Standard aus dem Stand, eigen aus dem Eintrag); falscher Name bleibt liegen', () => {
    expect(H.schritt(eintrag(), lage())).toEqual({ art: 'senden', absender: { name: 'Ida Imker' } })
    expect(H.schritt(eintrag({ formular: 'eigen', vorlage: V1, modus: 'frei', daten: { version: 1, werte: {} } }), lage({ stand: stand('passwort', true) })))
      .toEqual({ art: 'senden', absender: { name: 'Ida Imker' } })
    expect(H.schritt(eintrag({ letzterFehler: { grund: 'name_unbekannt', text: 't', am: '' } }), lage()).art).toBe('ueberspringen')
  })

  it('Passwort: nur „ausstehend“, nur bei genau einem Treffer, nie mit Passwort', () => {
    const pw = lage({ stand: stand('passwort', true) })
    expect(H.schritt(eintrag(), pw)).toEqual({ art: 'name_pruefen' })
    expect(H.schritt(eintrag(), { ...pw, eindeutig: true })).toEqual({ art: 'senden', absender: { name: 'Ida Imker', ausstehend: true } })
    expect(H.schritt(eintrag(), { ...pw, eindeutig: false }).art).toBe('ueberspringen')
    // Server kennt „ausstehend“ nicht, oder kein Name: liegen lassen
    expect(H.schritt(eintrag(), lage({ stand: stand('passwort', false), eindeutig: true })).art).toBe('ueberspringen')
    expect(H.schritt(eintrag({ absenderName: '  ' }), { ...pw, eindeutig: true }).art).toBe('ueberspringen')
    // Eigenes Formular mit Passwort: ausstehend aus stand.formulare.eigen
    const eig = eintrag({ formular: 'eigen', vorlage: V1, modus: 'passwort', daten: { version: 1, werte: {} } })
    expect(H.schritt(eig, { ...lage({ stand: stand('frei', true, true) }), eindeutig: true })).toEqual({ art: 'senden', absender: { name: 'Ida Imker', ausstehend: true } })
    expect(H.schritt(eig, { ...lage({ stand: stand('frei', true, false) }), eindeutig: true }).art).toBe('ueberspringen')
  })

  it('ohne Stand: liegen lassen (Modus unbekannt)', () => {
    expect(H.schritt(eintrag(), lage({ stand: null })).art).toBe('ueberspringen')
  })

  it('angemeldet abgelegt: im Hintergrund ohne Token, also nach den Regeln des Modus', () => {
    expect(H.schritt(eintrag({ angemeldetId: 'u1' }), lage())).toEqual({ art: 'senden', absender: { name: 'Ida Imker' } })
  })

  it('ein verdecktes Fenster meldet die Karten trotzdem (Review F3)', () => {
    const ab = karteAn('wache7')
    expect(kartenAntwort(false).orgs).toEqual(['wache7'])
    expect(kartenAntwort(true).orgs).toEqual(['wache7'])
    ab()
    expect(kartenAntwort(false).orgs).toEqual([])
  })

  it('offenes Fenster (auch verdeckt): Passwort und angemeldet Abgelegtes wartet, Name frei und anonym gehen (Review F3, F12)', () => {
    const pw = lage({ stand: stand('passwort', true), fensterOffen: true })
    // Passwort: nicht einmal der Name wird geprüft, auch bei bekannt eindeutigem Namen nicht
    expect(H.schritt(eintrag(), pw)).toEqual({ art: 'ueberspringen', fenster: true })
    expect(H.schritt(eintrag(), { ...pw, eindeutig: true })).toEqual({ art: 'ueberspringen', fenster: true })
    expect(H.schritt(eintrag({ formular: 'eigen', vorlage: V1, modus: 'passwort', daten: { version: 1, werte: {} } }), { ...pw, eindeutig: true })).toEqual({ art: 'ueberspringen', fenster: true })
    // angemeldet abgelegt: in jedem Modus erst ohne Fenster
    expect(H.schritt(eintrag({ angemeldetId: 'u1' }), lage({ fensterOffen: true }))).toEqual({ art: 'ueberspringen', fenster: true })
    // Name frei und anonym brauchen niemanden
    expect(H.schritt(eintrag(), lage({ fensterOffen: true }))).toEqual({ art: 'senden', absender: { name: 'Ida Imker' } })
    expect(H.schritt(eintrag({ formular: 'eigen', vorlage: V1, modus: 'anonym', absenderName: '', daten: { version: 1, werte: {} } }), lage({ fensterOffen: true }))).toEqual({ art: 'senden', absender: null })
    // ohne Fenster wie bisher
    expect(H.schritt(eintrag(), { ...pw, fensterOffen: false, eindeutig: true })).toEqual({ art: 'senden', absender: { name: 'Ida Imker', ausstehend: true } })
  })
})

// ── Gleichlauf mit der App ─────────────────────────────────────────────────

describe('Hintergrund: Gleichlauf mit naechsterSchritt (versand.ts)', () => {
  const formulare: Warteeintrag['formular'][] = ['patienten', 'produktausgabe', 'defektmeldung', 'eigen']
  const modiEigen: (Warteeintrag['modus'] | undefined)[] = [undefined, 'frei', 'passwort', 'anonym']
  const fehler: (Warteeintrag['letzterFehler'] | undefined)[] = [
    undefined,
    ...(GRUENDE as Warteeintrag['letzterFehler'][keyof object][]).map((g) => ({ grund: g as Warteeintrag['letzterFehler']['grund'], text: 't', am: '' })),
    { grund: 'daten', text: 't', am: '', feld: 'absender' },
  ]
  const zeiten = [undefined, new Date(JETZT.getTime() + 60_000).toISOString(), new Date(JETZT.getTime() - 60_000).toISOString()]
  const staende: (Stand | null)[] = [null, stand('frei', true), stand('frei', false), stand('passwort', true), stand('passwort', false), stand('passwort', true, null), stand('frei', true, false)]

  function* lagen() {
    for (const formular of formulare) for (const modus of formular === 'eigen' ? modiEigen : [undefined]) for (const f of fehler) for (const zeit of zeiten)
      for (const ziel of [undefined, 'zzzzzzzzzzzzzzz']) for (const name of ['Ida Imker', '']) for (const angemeldetId of ['', 'u1'])
        for (const st of staende) for (const eindeutig of [undefined, true, false]) {
          const e = eintrag({
            formular, absenderName: name, angemeldetId,
            ...(formular === 'eigen' ? { vorlage: V1, daten: { version: 1, werte: { f_aaaaaaaa: 'x' } } } : {}),
            ...(modus ? { modus } : {}), ...(f ? { letzterFehler: f } : {}), ...(zeit ? { naechsterVersuchAb: zeit } : {}), ...(ziel ? { ziel } : {}),
          })
          yield { e, st, eindeutig }
        }
  }

  it('was der Hintergrund sendet, sendet die App genauso (ohne Token, gleicher Absender); umgekehrt bis auf bleibende Fehler', () => {
    let n = 0, gesendet = 0
    for (const { e, st, eindeutig } of lagen()) {
      n++
      let sw = H.schritt(e, { stand: st, jetzt: JETZT.getTime(), erledigt: [] })
      if (sw.art === 'name_pruefen') sw = H.schritt(e, { stand: st, jetzt: JETZT.getTime(), erledigt: [], eindeutig: eindeutig ?? false })
      // Die App nach einer Stunde sichtbarer Frage, mit dem Ergebnis der Namensprüfung, ohne Token
      const app = naechsterSchritt({ ...e, gefragtAb: '2026-11-07T08:00:00.000Z', ...(eindeutig === undefined ? {} : { nameEindeutig: eindeutig }) }, { online: true, stand: st, serverAlt: false, tokenId: '', jetzt: JETZT })
      const ort = JSON.stringify({ e, st, eindeutig })
      if (sw.art === 'senden') {
        gesendet++
        expect(app.art, ort).toBe('senden')
        if (app.art === 'senden') {
          expect(app.mitAnmeldung, ort).toBe(false)
          expect(app.absender, ort).toEqual(sw.absender)
        }
        // Nie ein Passwort
        expect(Object.keys(sw.absender ?? {}).every((k) => k === 'name' || k === 'ausstehend'), ort).toBe(true)
      } else {
        expect(sw.art, ort).toBe('ueberspringen')
        // Die App sendet hier nur, wenn ein bleibender Fehler nach der Pause erneut versucht wird
        // oder der Passwort-Modus „ausstehend“ mit leerem Namen ginge (in der App nie eindeutig)
        if (app.art === 'senden' && !e.ziel) {
          const bleibend = !!e.letzterFehler && (BLEIBENDE_GRUENDE as string[]).includes(e.letzterFehler.grund)
          expect(bleibend || !e.absenderName.trim(), ort).toBe(true)
        }
      }
    }
    expect(n).toBeGreaterThan(10_000)
    expect(gesendet).toBeGreaterThan(500)
  })

  it('Body gleich absendeBody (api.ts)', () => {
    const faelle: [Warteeintrag, { name: string; ausstehend?: boolean } | null][] = [
      [eintrag(), { name: 'Ida Imker' }],
      [eintrag({ maske: 'schnell', uebernommen: true }), { name: 'Ida Imker', ausstehend: true }],
      [eintrag({ formular: 'produktausgabe', maske: undefined, daten: { einsatz: 'E-1', datum: '2026-11-07', positionen: [] } }), { name: 'Ida Imker' }],
      [eintrag({ formular: 'eigen', vorlage: V1, modus: 'anonym', absenderName: '', daten: { version: 3, werte: { f_aaaaaaaa: 'x' } } }), null],
      [eintrag({ formular: 'eigen', vorlage: V1, modus: 'passwort', daten: { version: 3, werte: {} } }), { name: 'Ida Imker', ausstehend: true }],
    ]
    for (const [e, absender] of faelle) {
      const app = absendeBody({ formular: e.formular, maske: e.maske, id: e.id, absender, daten: e.daten, uebernommen: e.uebernommen, vorlage: e.vorlage })
      expect(JSON.parse(JSON.stringify(H.body(e, absender)))).toEqual(JSON.parse(JSON.stringify(app)))
    }
  })

  it('fehlerAnwenden gleich versand.ts, für jeden Grund', () => {
    const jetzt = JETZT
    for (const g of GRUENDE) for (const feld of [undefined, 'absender']) for (const sekunden of [undefined, 120]) for (const aendern of [false, true])
      for (const e of [eintrag(), eintrag({ formular: 'eigen', vorlage: V1, modus: 'anonym', daten: { version: 1, werte: {} } }), eintrag({ formular: 'eigen', vorlage: V1, modus: 'frei', daten: { version: 1, werte: {} }, versuche: 2 })]) {
        const f = { grund: g, text: `Text ${g}`, ...(feld ? { feld } : {}), ...(sekunden ? { sekunden } : {}) }
        const app = fehlerAnwenden(e, f, { jetzt, aendern, neueId: () => 'neuekennung0001' })
        const sw = H.fehlerAnwenden(e, f, { jetzt: jetzt.getTime(), aendern, neueId: () => 'neuekennung0001' })
        expect(JSON.parse(JSON.stringify(sw)), `${g} ${feld} ${sekunden} ${aendern}`).toEqual(JSON.parse(JSON.stringify(app)))
      }
  })

  it('neue Kennung: 15 × [a-z0-9]', () => {
    const k = H.neueKennung((a) => crypto.getRandomValues(a))
    expect(k).toMatch(/^[a-z0-9]{15}$/)
  })
})

describe('Hintergrund: Antworten lesen wie api.ts', () => {
  it('Erfolg, Gründe mit Text, alter Server, Drossel, Daten, Störung, Netz', () => {
    expect(H.antwortLesen({ netz: false, status: 200, body: { ok: true, id: 'x' } })).toMatchObject({ ok: true })
    expect(H.antwortLesen({ netz: false, status: 200, body: null })).toMatchObject({ ok: false, grund: 'server' })
    expect(H.antwortLesen({ netz: false, status: 403, body: { grund: 'formular_aus', message: 'Aus.' } })).toMatchObject({ ok: false, grund: 'formular_aus', text: 'Aus.' })
    expect(H.antwortLesen({ netz: false, status: 429, body: { grund: 'drossel', message: 'M', sekunden: 30 } })).toMatchObject({ grund: 'drossel', sekunden: 30 })
    expect(H.antwortLesen({ netz: false, status: 409, body: { grund: 'aenderung_alt', message: 'M', ziel: 'zzzzzzzzzzzzzzz' } })).toMatchObject({ grund: 'aenderung_alt', ziel: 'zzzzzzzzzzzzzzz' })
    expect(H.antwortLesen({ netz: false, status: 400, body: { grund: 'daten', message: 'M', feld: 'werte.f_x' } })).toMatchObject({ grund: 'daten', feld: 'werte.f_x' })
    expect(H.antwortLesen({ netz: false, status: 404, body: { message: 'File not found.' } })).toMatchObject({ grund: 'alter_server' })
    expect(H.antwortLesen({ netz: false, status: 404, body: { grund: 'organisation', message: 'O' } })).toMatchObject({ grund: 'organisation' })
    expect(H.antwortLesen({ netz: false, status: 429, body: null })).toMatchObject({ grund: 'drossel', sekunden: 60 })
    expect(H.antwortLesen({ netz: false, status: 400, body: { message: 'english' } })).toMatchObject({ grund: 'daten' })
    expect(H.antwortLesen({ netz: false, status: 500, body: { grund: 'erfunden' } })).toMatchObject({ grund: 'server' })
    expect(H.antwortLesen({ netz: true, status: 0, body: null })).toMatchObject({ grund: 'netz' })
  })
})

// ── Ein ganzer Durchgang über den Tresor ───────────────────────────────────

function speicherAblage() {
  const daten = new Map<string, unknown>()
  const erledigt = new Map<string, unknown>()
  const key = { k: null as CryptoKey | null }
  const ablage: TresorAblage = {
    async lesen() { return Object.fromEntries([...daten].map(([k, v]) => [k, structuredClone(v)])) },
    async schreiben(k, v) { daten.set(k, structuredClone(v)) },
    async loeschen(k) { daten.delete(k) },
    async schluessel() { return key.k },
    async schluesselSetzen(c) { if (!key.k) key.k = c },
    async erledigtLesen() { return Object.fromEntries(erledigt) },
    async erledigtLoeschen(ids) { for (const id of ids) erledigt.delete(id) },
  }
  // Dieselben Daten, wie public/sw-formulare.js sie aus IndexedDB liest
  const sw = {
    schluessel: async () => key.k,
    api: async () => 'https://api.test/',
    erledigtLesen: async () => [...erledigt.keys()],
    eintraege: async () => [...daten].map(([k, v]) => [k, structuredClone(v)]),
    schreiben: async (ak: string, d: unknown) => { daten.set(ak, structuredClone(d)) },
    loeschen: async (ak: string) => { daten.delete(ak) },
    erledigtSetzen: async (id: string, w: unknown) => { erledigt.set(id, w) },
  }
  return { daten, erledigt, key, ablage, sw }
}

type Anfrage = { url: string; method: string; headers: Record<string, string>; body: Record<string, unknown> | null; credentials?: string }

/** Ein Server, der je Pfad antwortet. */
function server(antwort: (a: Anfrage) => { status: number; body: unknown } | 'netz') {
  const anfragen: Anfrage[] = []
  const holen = async (url: string, init: { method: string; headers: Record<string, string>; body?: string; credentials?: string }) => {
    const a: Anfrage = { url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : null, credentials: init.credentials }
    anfragen.push(a)
    const r = antwort(a)
    if (r === 'netz') throw new TypeError('Failed to fetch')
    return { status: r.status, text: async () => JSON.stringify(r.body) }
  }
  return { anfragen, holen }
}

const neu = (id: string, x: Partial<NeuerEintrag> = {}): NeuerEintrag => ({
  id, formular: 'patienten', maske: 'doku', orgCode: 'wache1', orgId: 'org1', absenderName: 'Ida Imker', angemeldetId: '',
  daten: { title: 'Patientendoku: Max Muster', payload: { name: 'Muster' } }, ...x,
})
const STAND_W1 = { version: 2, formulare: { patienten: fs('frei', true), produktausgabe: fs('passwort', true), defektmeldung: fs('passwort', true), cirs: { modus: 'anonym', an: true, oeffentlich: true, ausstehend: false }, eigen: { modus: 'frei', an: true, oeffentlich: true, ausstehend: true } }, angemeldet: null }
const ID = (n: number) => `aaaaaaaaaaaaa${String(n).padStart(2, '0')}`

async function tresorMit(eintraegeNeu: NeuerEintrag[], nachher?: (s: InstanceType<typeof TresorKern>) => void) {
  const a = speicherAblage()
  const k = new TresorKern()
  await k.oeffnen(a.ablage, null, { kanal: null })
  for (const e of eintraegeNeu) ablegen(k, e, JETZT)
  nachher?.(k)
  expect(await k.geschrieben()).toBe(true)
  return a
}

async function lesen(a: ReturnType<typeof speicherAblage>, org = 'wache1') {
  const k = new TresorKern()
  await k.oeffnen(a.ablage, null, { kanal: null })
  return eintraege(k, org)
}

const ANTWORTEN_EINDEUTIG = (q: { url: string; body?: Record<string, unknown> }) => {
  if (q.url.endsWith('/stand')) return { status: 200, body: STAND_W1 }
  if (q.url.endsWith('/name')) return { status: 200, body: { vollstaendig: true, gefunden: true, eindeutig: true } }
  return { status: 200, body: { ok: true, id: q.body?.id } }
}

describe('Hintergrund: ein Durchgang über verschlüsselte Einträge', () => {
  const umgebung = (a: ReturnType<typeof speicherAblage>, holen: unknown, x: Record<string, unknown> = {}) => {
    const gemeldet: string[][] = []
    return {
      gemeldet,
      u: { ablage: a.sw, holen, crypto: globalThis.crypto, fenster: async () => ({ alle: false, orgs: [] }), melden: (s: string[]) => gemeldet.push(s), jetzt: () => JETZT.getTime(), ...x },
    }
  }

  it('sendet nach den Regeln, löscht nur Gesendetes, vermerkt es, hält Fehler fest; nie Token, nie Passwort', async () => {
    const a = await tresorMit([
      neu(ID(1)),                                                                                     // Patientendoku, Name frei → senden
      neu(ID(2), { formular: 'produktausgabe', maske: undefined, absenderName: 'Paul Probe', daten: { einsatz: 'E-1', datum: '2026-11-07', positionen: [] } }), // Passwort, eindeutig → ausstehend
      neu(ID(3), { formular: 'defektmeldung', maske: undefined, absenderName: 'Doppel Name', daten: { device_id: 'd', description: 'x', severity: 'low' } }), // Passwort, nicht eindeutig → liegt
      neu(ID(4), { formular: 'eigen', maske: undefined, vorlage: V1, modus: 'anonym', titel: 'Hinweisbox', absenderName: 'Wird entfernt', daten: { version: 1, werte: { f_aaaaaaaa: 'x' } } }), // anonym
      neu(ID(5)),                                                                                     // bleibender Fehler → liegt
      neu(ID(6)),                                                                                     // 429 → Wartezeit
    ], (k) => {
      aktualisieren(k, 'wache1', ID(5), (e) => ({ ...e, letzterFehler: { grund: 'formular_aus', text: 'Aus.', am: '' } }))
      // Ein Passwort könnte nie im Eintrag stehen; selbst wenn: es geht nicht raus
      aktualisieren(k, 'wache1', ID(1), (e) => ({ ...e, passwort: 'geheim' } as Warteeintrag))
    })
    expect(JSON.stringify([...a.daten.values()].map((d) => Buffer.from(new Uint8Array((d as { ct: ArrayBuffer }).ct)).toString('latin1')))).not.toMatch(/Max Muster|Ida Imker|Paul Probe/)
    const srv = server((q) => {
      if (q.url.endsWith('/stand')) return { status: 200, body: STAND_W1 }
      if (q.url.endsWith('/name')) return { status: 200, body: { vollstaendig: true, gefunden: true, eindeutig: q.body?.name === 'Paul Probe' } }
      if (q.body?.id === ID(6)) return { status: 429, body: { status: 429, grund: 'drossel', message: 'Gerade viel los.', sekunden: 120 } }
      return { status: 200, body: { ok: true, id: q.body?.id, bereits: false, absender: null } }
    })
    const { u, gemeldet } = umgebung(a, srv.holen)
    const r = await H.lauf(u)
    expect(r.gesendet).toBe(3)
    expect(r.nochmal).toBe(true)

    // Keine Anmeldung, kein Passwort, keine Cookies
    for (const q of srv.anfragen) {
      expect(q.headers.Authorization).toBeUndefined()
      expect(q.credentials).toBe('omit')
      expect(JSON.stringify(q.body ?? {}).toLowerCase()).not.toMatch(/passwor[dt]/)
      expect(q.url.startsWith('https://api.test/api/responda/formular/wache1/')).toBe(true)
    }
    const gesendet = srv.anfragen.filter((q) => q.url.endsWith('/absenden')).map((q) => [q.body?.id, q.body?.absender])
    expect(gesendet).toEqual([[ID(1), { name: 'Ida Imker' }], [ID(2), { name: 'Paul Probe', ausstehend: true }], [ID(4), null], [ID(6), { name: 'Ida Imker' }]])
    // Nach der Drossel endet der Durchgang dieser Organisation (wie in der App)
    expect(srv.anfragen.filter((q) => q.url.endsWith('/name')).map((q) => q.body)).toEqual([{ formular: 'produktausgabe', name: 'Paul Probe' }, { formular: 'defektmeldung', name: 'Doppel Name' }])

    // Gesendetes ist weg und vermerkt, der Rest liegt (mit Fehler bzw. Wartezeit)
    expect([...a.erledigt.keys()].sort()).toEqual([ID(1), ID(2), ID(4)])
    const rest = await lesen(a)
    expect(rest.map((e) => e.id)).toEqual([ID(3), ID(5), ID(6)])
    expect(rest[2].naechsterVersuchAb).toBe(new Date(JETZT.getTime() + 120_000).toISOString())
    expect(rest[2].versuche).toBe(1)
    expect(rest[0].letzterFehler).toBeUndefined()
    expect(rest[1].letzterFehler?.grund).toBe('formular_aus')
    expect(gemeldet).toEqual([[SCHLUESSEL_PREFIX + 'wache1']])
  })

  it('anonym abgelegt: ohne Namen gespeichert und gesendet', async () => {
    const a = await tresorMit([neu(ID(1), { formular: 'eigen', maske: undefined, vorlage: V1, modus: 'anonym', absenderName: '', daten: { version: 1, werte: {} } })])
    const srv = server((q) => (q.url.endsWith('/stand') ? { status: 200, body: STAND_W1 } : { status: 200, body: { ok: true, id: q.body?.id, bereits: false, absender: null, anonym: true } }))
    await H.lauf(umgebung(a, srv.holen).u)
    expect(srv.anfragen[1].body).toEqual({ formular: 'eigen', id: ID(1), absender: null, daten: { version: 1, werte: {} }, vorlage: V1 })
  })

  it('Kennung schon vergeben: neue Kennung, neuer Datensatz, alter weg', async () => {
    const a = await tresorMit([neu(ID(1))])
    const srv = server((q) => (q.url.endsWith('/stand') ? { status: 200, body: STAND_W1 } : { status: 409, body: { grund: 'kennung', message: 'Diese Kennung ist schon vergeben.' } }))
    const r = await H.lauf(umgebung(a, srv.holen).u)
    expect(r.gesendet).toBe(0)
    const rest = await lesen(a)
    expect(rest).toHaveLength(1)
    expect(rest[0].id).not.toBe(ID(1))
    expect(rest[0].id).toMatch(/^[a-z0-9]{15}$/)
    expect([...a.daten.keys()]).toEqual([ablageSchluessel(SCHLUESSEL_PREFIX + 'wache1', rest[0].id)])
  })

  it('Änderung eines schon abgesendeten Protokolls: ziel gesetzt, die App trägt sie später ein', async () => {
    const a = await tresorMit([neu(ID(1), { uebernommen: true })])
    const srv = server((q) => (q.url.endsWith('/stand') ? { status: 200, body: STAND_W1 } : { status: 409, body: { grund: 'aenderung_alt', message: 'M', ziel: 'zzzzzzzzzzzzzzz' } }))
    await H.lauf(umgebung(a, srv.holen).u)
    const rest = await lesen(a)
    expect(rest[0].ziel).toBe('zzzzzzzzzzzzzzz')
    expect(rest[0].letzterFehler).toBeUndefined()
  })

  it('ein Fenster mit Karte (auch verdeckt) arbeitet die Organisation selbst ab: nichts senden; antwortet ein Fenster nicht: gar nichts, aber später erneut', async () => {
    const a = await tresorMit([neu(ID(1)), neu(ID(2), { orgCode: 'wache2' })])
    const srv = server((q) => (q.url.endsWith('/stand') ? { status: 200, body: STAND_W1 } : { status: 200, body: { ok: true, id: q.body?.id } }))
    const r1 = await H.lauf(umgebung(a, srv.holen, { fenster: async () => ({ offen: true, alle: false, orgs: ['wache1'] }) }).u)
    expect(srv.anfragen.map((q) => q.url.replace('https://api.test/api/responda/formular/', ''))).toEqual(['wache2/stand', 'wache2/absenden'])
    // Was das sichtbare Fenster hält, soll ein späterer Versuch noch senden können (falls es danach geschlossen wird)
    expect(r1).toMatchObject({ gesendet: 1, nochmal: true, imFenster: 1 })
    // Ist dort nichts mehr offen (gesendet, im Hintergrund erledigt), kein weiterer Versuch
    const srv1b = server((q) => (q.url.endsWith('/stand') ? { status: 200, body: STAND_W1 } : { status: 200, body: { ok: true, id: q.body?.id } }))
    const nurW1 = await tresorMit([neu(ID(3))])
    nurW1.erledigt.set(ID(3), { am: JETZT.toISOString() })
    const r1b = await H.lauf(umgebung(nurW1, srv1b.holen, { fenster: async () => ({ offen: true, alle: false, orgs: ['wache1'] }) }).u)
    expect(r1b).toMatchObject({ gesendet: 0, nochmal: false, imFenster: 0 })
    const srv2 = server(() => ({ status: 200, body: STAND_W1 }))
    const r2 = await H.lauf(umgebung(a, srv2.holen, { fenster: async () => ({ offen: true, alle: true, orgs: [] }) }).u)
    expect(srv2.anfragen).toHaveLength(0)
    expect(r2).toMatchObject({ gesendet: 0, nochmal: true })
    expect((await lesen(a)).map((e) => e.id)).toEqual([ID(1)])
  })

  it('Fenster offen ohne Karte dieser Organisation (etwa EKS): hält nichts auf, sendet wie ohne Fenster (Nachprüfung)', async () => {
    const pw = (id: string, x: Partial<NeuerEintrag> = {}) => neu(id, { formular: 'produktausgabe', maske: undefined, absenderName: 'Paul Probe', daten: { einsatz: 'E-1', datum: '2026-11-07', positionen: [] }, ...x })
    const a = await tresorMit([neu(ID(1)), pw(ID(2)), neu(ID(3), { angemeldetId: 'u1' })])
    const srv = server(ANTWORTEN_EINDEUTIG)
    const r = await H.lauf(umgebung(a, srv.holen, { fenster: async () => ({ offen: true, alle: false, orgs: [], sichtbar: [] }) }).u)
    expect(r).toMatchObject({ gesendet: 3, nochmal: false, imFenster: 0 })
    expect(srv.anfragen.filter((q) => q.url.endsWith('/absenden')).map((q) => [q.body?.id, q.body?.absender])).toEqual([[ID(1), { name: 'Ida Imker' }], [ID(2), { name: 'Paul Probe', ausstehend: true }], [ID(3), { name: 'Ida Imker' }]])
    for (const q of srv.anfragen) expect(q.headers.Authorization).toBeUndefined()
    expect(await lesen(a)).toEqual([])
  })

  it('sichtbares Fenster mit Karte: hält alles zurück, auch nach der Stundenmarke', async () => {
    const pw = neu(ID(4), { formular: 'produktausgabe', maske: undefined, absenderName: 'Paul Probe', daten: { einsatz: 'E-1', datum: '2026-11-07', positionen: [] } })
    const a = await tresorMit([pw])
    const srv = server(ANTWORTEN_EINDEUTIG)
    const spaet = JETZT.getTime() + 3 * 60 * 60 * 1000
    const r = await H.lauf(umgebung(a, srv.holen, { jetzt: () => spaet, fenster: async () => ({ offen: true, alle: false, orgs: [], sichtbar: ['wache1'] }) }).u)
    expect(srv.anfragen).toHaveLength(0)
    expect(r).toMatchObject({ gesendet: 0, nochmal: true, imFenster: 1 })
  })

  it('verdecktes oder stummes Fenster mit Karte: wartet bis zur Stundenmarke, dann Passwort als „ausstehend“; angemeldet Abgelegtes bleibt (Nachprüfung)', async () => {
    expect(H.OHNE_PASSWORT_NACH_MS).toBe(OHNE_PASSWORT_NACH_MS)
    const pw = neu(ID(5), { formular: 'produktausgabe', maske: undefined, absenderName: 'Paul Probe', daten: { einsatz: 'E-1', datum: '2026-11-07', positionen: [] } })
    const angemeldet = neu(ID(6), { angemeldetId: 'u1' })
    for (const fenster of [
      async () => ({ offen: true, alle: false, orgs: ['wache1'], sichtbar: [] }),
      async () => ({ offen: true, alle: true, orgs: [], sichtbar: [] }),
    ]) {
      const a = await tresorMit([pw, angemeldet])
      // vor der Marke: nichts
      const srv1 = server(ANTWORTEN_EINDEUTIG)
      const knapp = JETZT.getTime() + OHNE_PASSWORT_NACH_MS - 1000
      const r1 = await H.lauf(umgebung(a, srv1.holen, { jetzt: () => knapp, fenster }).u)
      expect(srv1.anfragen).toHaveLength(0)
      expect(r1).toMatchObject({ gesendet: 0, nochmal: true, imFenster: 2 })
      // nach der Marke: Passwort-Eintrag geht als „ausstehend“, ohne Token; der angemeldete bleibt
      const srv2 = server(ANTWORTEN_EINDEUTIG)
      const spaet = JETZT.getTime() + OHNE_PASSWORT_NACH_MS + 1000
      const r2 = await H.lauf(umgebung(a, srv2.holen, { jetzt: () => spaet, fenster }).u)
      expect(srv2.anfragen.filter((q) => q.url.endsWith('/absenden')).map((q) => [q.body?.id, q.body?.absender])).toEqual([[ID(5), { name: 'Paul Probe', ausstehend: true }]])
      for (const q of srv2.anfragen) expect(q.headers.Authorization).toBeUndefined()
      expect(r2).toMatchObject({ gesendet: 1, nochmal: true, imFenster: 1 })
      expect((await lesen(a)).map((e) => e.id)).toEqual([ID(6)])
    }
  })

  it('alter Server oder kein Netz beim Stand: nichts geändert; ohne Netz später erneut', async () => {
    const a = await tresorMit([neu(ID(1))])
    const vorher = structuredClone([...a.daten])
    const alt = server(() => ({ status: 404, body: { message: 'Not found.' } }))
    expect((await H.lauf(umgebung(a, alt.holen).u)).nochmal).toBe(false)
    const weg = server(() => 'netz')
    expect((await H.lauf(umgebung(a, weg.holen).u)).nochmal).toBe(true)
    expect(alt.anfragen).toHaveLength(1)
    expect([...a.daten].map(([k]) => k)).toEqual(vorher.map(([k]) => k))
    expect((await lesen(a))[0].versuche).toBe(0)
  })

  it('Netz bricht beim Senden ab: Eintrag bleibt, Versuch gezählt, später erneut', async () => {
    const a = await tresorMit([neu(ID(1)), neu(ID(2))])
    const srv = server((q) => (q.url.endsWith('/stand') ? { status: 200, body: STAND_W1 } : 'netz'))
    const r = await H.lauf(umgebung(a, srv.holen).u)
    expect(r.nochmal).toBe(true)
    // Nach dem ersten Netzfehler endet der Durchgang
    expect(srv.anfragen.filter((q) => q.url.endsWith('/absenden'))).toHaveLength(1)
    const rest = await lesen(a)
    expect(rest.map((e) => [e.id, e.versuche, e.letzterFehler])).toEqual([[ID(1), 1, undefined], [ID(2), 0, undefined]])
  })

  it('ohne Schlüssel oder ohne Server-Adresse: nichts', async () => {
    const a = speicherAblage()
    const srv = server(() => ({ status: 200, body: STAND_W1 }))
    expect((await H.lauf(umgebung(a, srv.holen).u)).gesendet).toBe(0)
    expect(srv.anfragen).toHaveLength(0)
  })

  it('der Tresor der App übernimmt das Ergebnis: Gesendetes taucht nicht wieder auf', async () => {
    const a = await tresorMit([neu(ID(1)), neu(ID(2))])
    // Ein Fenster, das die Liste noch kennt (verdeckt, mit altem Stand)
    const fenster = new TresorKern()
    await fenster.oeffnen(a.ablage, null, { kanal: null })
    const srv = server((q) => (q.url.endsWith('/stand') ? { status: 200, body: STAND_W1 } : q.body?.id === ID(1) ? { status: 200, body: { ok: true, id: ID(1) } } : 'netz'))
    await H.lauf(umgebung(a, srv.holen).u)
    await fenster.neuLaden([SCHLUESSEL_PREFIX + 'wache1'])
    expect(eintraege(fenster, 'wache1').map((e) => e.id)).toEqual([ID(2)])
    // Schreibt das Fenster seine alte Liste trotzdem, legt es ID1 nicht wieder an
    fenster.setItem(SCHLUESSEL_PREFIX + 'wache1', JSON.stringify((await lesen(a)).concat()))
    await fenster.geschrieben()
    expect([...a.daten.keys()]).toEqual([ablageSchluessel(SCHLUESSEL_PREFIX + 'wache1', ID(2))])
  })
})

describe('Hintergrund: sync-Ereignis', () => {
  it('hört nur auf den eigenen Tag', () => {
    expect(H.TAG).toBe('responda-formulare')
    expect(typeof syncHandler).toBe('function')
    const waitUntil = vi.fn()
    syncHandler!({ tag: 'anderes', waitUntil })
    expect(waitUntil).not.toHaveBeenCalled()
  })
})
