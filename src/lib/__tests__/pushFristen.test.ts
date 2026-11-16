// Fristen des Servers (pb_hooks/push-fristen.js) gegen die App (src/lib/mpg/fristen.ts,
// src/lib/cirs.ts). Die App rechnet in Ortszeit, der Server nach deutscher Zeit: Hier läuft die
// App deshalb mit TZ Europe/Berlin. Die Zeitzone muss gesetzt sein, bevor die Module laden;
// statische Imports würden vorher ausgewertet, daher await import(...).
const altTZ = process.env.TZ
process.env.TZ = 'Europe/Berlin'

import { describe, it, expect, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import type { FristFelder } from '../mpg/fristen'

const FT = await import('../mpg/fristen')
const C = await import('../cirs')

afterAll(() => {
  if (altTZ === undefined) delete process.env.TZ
  else process.env.TZ = altTZ
})

const modul = { exports: {} as Record<string, unknown> }
runInNewContext(readFileSync(new URL('../../../pb_hooks/push-fristen.js', import.meta.url), 'utf8'), { module: modul, exports: modul.exports })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const F = modul.exports as any
const flach = <X>(x: X): X => JSON.parse(JSON.stringify(x))

function zufall(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = zufall(4711)
const wahl = <X>(l: readonly X[]): X => l[Math.floor(rnd() * l.length)]
const ganz = (n: number) => Math.floor(rnd() * n)
const z2 = (n: number) => String(n).padStart(2, '0')

function tagZufall(von = 2022, bis = 2028) {
  const ms = Date.UTC(von, 0, 1) + Math.floor(rnd() * (bis - von) * 365 * 86_400_000)
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${z2(d.getUTCMonth() + 1)}-${z2(d.getUTCDate())}`
}
function datumWert(): string | null {
  return wahl<() => string | null>([
    () => tagZufall(),
    () => `${tagZufall()} 00:00:00.000Z`,
    () => `${tagZufall()} ${z2(ganz(24))}:${z2(ganz(60))}:00.000Z`,
    () => `${tagZufall()} ${wahl(['22', '23'])}:${z2(ganz(60))}:00.000Z`,
    () => `${tagZufall()}T${z2(ganz(24))}:${z2(ganz(60))}:00.000Z`,
    () => `${wahl(['2026-03-28', '2026-03-29', '2026-10-24', '2026-10-25', '2026-12-31', '2027-01-01'])} ${z2(ganz(24))}:${z2(ganz(60))}:00.000Z`,
    () => '2026-02-31',
    () => '2026-02-31 00:00:00.000Z',
    () => tagZufall(2027, 2031),
    () => '',
    () => null,
  ])()
}
function geraetZufall() {
  return {
    interval: wahl<unknown>(['daily', 'weekly', 'monthly', 'yearly', 'täglich', 'Wöchentlich', 'jaehrlich', 'annually', '', null, ['monthly'], ['yearly', 'daily'], 'xyz']) as string,
    last_inspection: datumWert(),
    has_stk: rnd() < 0.6,
    last_stk: datumWert(),
    stk_interval_months: wahl([0, null, 12, 24, 36, 6]),
    has_mtk: rnd() < 0.6,
    last_mtk: datumWert(),
    mtk_interval_months: wahl([12, 18, 24, 60, null, 0]),
    inbetriebnahme: datumWert(),
  }
}
const HEUTE = ['2026-12-31', '2027-01-01', '2026-03-29', '2026-03-30', '2026-10-25', '2026-10-26', '2026-02-28', '2028-02-29', '2026-11-15']

describe('fristenVon wie src/lib/mpg/fristen.ts (TZ Europe/Berlin)', () => {
  it('3000 erzeugte Geräte, heute über Jahresenden und Umstellungen', () => {
    for (let i = 0; i < 3000; i++) {
      const g = geraetZufall()
      const heute = rnd() < 0.5 ? wahl(HEUTE) : tagZufall(2025, 2029)
      const server = flach(F.fristenVon(g, heute))
      const app = flach(FT.fristenVon(g as FristFelder, heute))
      if (JSON.stringify(server) !== JSON.stringify(app)) expect({ g, heute, server }).toEqual({ g, heute, server: app })
    }
  })
  it('kalendertagBerlin wörtlich, unabhängig von der Zeitzone des Prozesses', () => {
    const fall: [string | null, string | null][] = [
      ['2026-03-29 23:30:00.000Z', '2026-03-30'],
      ['2026-01-15 23:30:00.000Z', '2026-01-16'],
      ['2026-01-15 22:59:00.000Z', '2026-01-15'],
      ['2026-07-01 21:59:00.000Z', '2026-07-01'],
      ['2026-07-01 22:00:00.000Z', '2026-07-02'],
      ['2026-03-10', '2026-03-10'],
      ['2026-03-10 00:00:00.000Z', '2026-03-10'],
      ['2026-02-31', null],
      ['', null],
      [null, null],
      ['Unsinn', null],
    ]
    for (const [w, soll] of fall) expect([w, F.kalendertagBerlin(w)]).toEqual([w, soll])
    for (let i = 0; i < 2000; i++) {
      const w = datumWert()
      expect([w, F.kalendertagBerlin(w)]).toEqual([w, FT.kalendertag(w)])
    }
  })
  it('Hilfen gleich: plusMonate, monatsende, naechsteStk, naechsteMtk, lageVon, intervallVon', () => {
    for (let i = 0; i < 2000; i++) {
      const t = tagZufall()
      const n = ganz(40) - 5
      expect(F.plusMonate(t, n)).toBe(FT.plusMonate(t, n))
      expect(F.monatsende(t)).toBe(FT.monatsende(t))
      const m = wahl([0, null, 1, 12, 18, 24, 36, 60])
      expect(F.naechsteStk(t, m)).toBe(FT.naechsteStk(t, m as number))
      expect(F.naechsteMtk(t, m)).toBe(FT.naechsteMtk(t, m as number))
      const h = tagZufall()
      expect(flach(F.lageVon(t, h, 30))).toEqual(FT.lageVon(t, h, 30))
    }
    for (const v of ['daily', 'Täglich', ' woche ', ['yearly'], null, 7, 'xyz']) expect(F.intervallVon(v)).toBe(FT.intervallVon(v))
  })
  it('ueberfaelligeKontrollen und wocheMpg', () => {
    const g = { has_stk: true, last_stk: '2024-01-10', stk_interval_months: 24, has_mtk: true, last_mtk: '2024-03-01', mtk_interval_months: 24, last_inspection: '2026-11-01', interval: 'monthly' }
    expect(flach(F.ueberfaelligeKontrollen(g, '2026-02-01'))).toEqual([{ art: 'stk', naechste: '2026-01-31' }])
    expect(flach(F.ueberfaelligeKontrollen(g, '2027-01-01'))).toEqual([{ art: 'stk', naechste: '2026-01-31' }, { art: 'mtk', naechste: '2026-12-31' }])
    expect(F.ueberfaelligeKontrollen({ ...g, ausser_betrieb: '2026-01-01 00:00:00.000Z' }, '2027-01-01')).toEqual([])
    const geraete = [
      { interval: 'monthly', last_inspection: '2026-11-10' }, // bald (10.12., 7 Tage Vorwarnung) am 05.12.
      { interval: 'monthly', last_inspection: '2026-10-01' }, // überfällig
      { interval: 'monthly', last_inspection: '' }, // Erstprüfung offen
      { interval: 'yearly', last_inspection: '2026-06-01' }, // ok
      { interval: 'monthly', last_inspection: '2026-10-01', ausser_betrieb: '2026-11-01' }, // außer Betrieb
    ]
    expect(flach(F.wocheMpg(geraete, '2026-12-05'))).toEqual({ bald: 1, ueberfaellig: 2 })
  })
})

describe('cirsUeberfaellig wie istUeberfaellig(fallAus(rec), heute)', () => {
  function meldungZufall(i: number) {
    const angelegt = Date.UTC(2026, ganz(12), 1 + ganz(28), ganz(24), ganz(60))
    const geaendert = angelegt + wahl([0, 500, 1999, 2000, 3600_000, 86_400_000 * 3])
    const tag = () => wahl([tagZufall(2026, 2027), '2026-11-14', '2026-11-15', '2026-11-16', '2026-13-01', '0002-01-01', '', null])
    const bearbeitung = rnd() < 0.8 ? {
      phase: wahl(['neu', 'bewertung', 'massnahmen', 'abgeschlossen', 'kein_handlungsbedarf', 'quatsch', undefined]),
      frist: tag(),
      massnahmen: Array.from({ length: ganz(4) }, (_, j) => (rnd() < 0.9 ? { id: `m${j}`, text: 'T', frist: tag(), erledigtAm: wahl(['', undefined, '2026-11-01T10:00:00.000Z']) } : { id: 7 })),
    } : undefined
    const payload = { was: 'GEHEIMTEXT', kategorie: 'material', bearbeitung }
    return {
      id: `cirs${String(i).padStart(11, '0')}`,
      created: new Date(angelegt).toISOString().replace('T', ' '),
      updated: new Date(geaendert).toISOString().replace('T', ' '),
      status: wahl(['offen', 'erledigt', '', undefined]),
      payload: rnd() < 0.5 ? payload : JSON.stringify(payload),
    }
  }
  it('2000 erzeugte Meldungen', () => {
    for (let i = 0; i < 2000; i++) {
      const rec = meldungZufall(i)
      const heute = wahl(['2026-11-15', '2026-11-16', '2027-01-01', tagZufall(2026, 2028)])
      const app = C.istUeberfaellig(C.fallAus(rec as Parameters<typeof C.fallAus>[0]), new Date(`${heute}T12:00:00`))
      expect([rec, heute, F.cirsUeberfaellig(rec, heute)]).toEqual([rec, heute, app])
    }
  })
  it('Bearbeitung beim Anlegen zählt nicht', () => {
    const rec = { id: 'c', created: '2026-11-01 10:00:00.000Z', updated: '2026-11-01 10:00:01.000Z', status: 'offen', payload: { bearbeitung: { phase: 'bewertung', frist: '2026-11-02' } } }
    expect(F.cirsUeberfaellig(rec, '2026-11-15')).toBe(false)
    expect(F.cirsUeberfaellig({ ...rec, updated: '2026-11-03 10:00:00.000Z' }, '2026-11-15')).toBe(true)
    expect(F.cirsUeberfaellig({ ...rec, updated: '2026-11-03 10:00:00.000Z', status: 'erledigt' }, '2026-11-15')).toBe(false)
  })
})
