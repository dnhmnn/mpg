// Neue Version mit Bestätigung (src/lib/fassungPruefen.ts, Owner 19.11.2026).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  aktualisieren, fassungAbonnieren, fassungStand, fassungZuruecksetzen, hinweisZeigen, istEinsatzfuehrung,
  neueFassungMelden, PRUEFEN_FRUEHESTENS_MS, sollPruefen, spaeter, SPAETER_MS,
} from '../fassungPruefen'

afterEach(() => fassungZuruecksetzen())

describe('sollPruefen', () => {
  const t = 1_800_000_000_000
  it('nur sichtbar und mit Netz', () => {
    expect(sollPruefen({ jetzt: t, zuletzt: null, online: true, sichtbar: true })).toBe(true)
    expect(sollPruefen({ jetzt: t, zuletzt: null, online: false, sichtbar: true })).toBe(false)
    expect(sollPruefen({ jetzt: t, zuletzt: null, online: true, sichtbar: false })).toBe(false)
  })
  it('höchstens alle fünf Minuten', () => {
    expect(sollPruefen({ jetzt: t, zuletzt: t - PRUEFEN_FRUEHESTENS_MS + 1, online: true, sichtbar: true })).toBe(false)
    expect(sollPruefen({ jetzt: t, zuletzt: t - PRUEFEN_FRUEHESTENS_MS, online: true, sichtbar: true })).toBe(true)
  })
})

describe('hinweisZeigen', () => {
  const t = 1_800_000_000_000
  it('nur mit neuer Fassung', () => {
    expect(hinweisZeigen({ neu: false, pfad: '/hub', spaeterBis: null, jetzt: t })).toBe(false)
    expect(hinweisZeigen({ neu: true, pfad: '/hub', spaeterBis: null, jetzt: t })).toBe(true)
  })
  it('nach „Später“ erst wieder nach Ablauf', () => {
    expect(hinweisZeigen({ neu: true, pfad: '/hub', spaeterBis: t + 1, jetzt: t })).toBe(false)
    expect(hinweisZeigen({ neu: true, pfad: '/hub', spaeterBis: t, jetzt: t })).toBe(true)
  })
  it('nie in der Einsatzführung eines laufenden Einsatzes, sonst überall', () => {
    expect(istEinsatzfuehrung('/eks/abc123')).toBe(true)
    expect(istEinsatzfuehrung('/eks')).toBe(false)
    expect(istEinsatzfuehrung('/eks/')).toBe(false)
    expect(hinweisZeigen({ neu: true, pfad: '/eks/abc123', spaeterBis: null, jetzt: t })).toBe(false)
    for (const pfad of ['/', '/hub', '/eks', '/unitas', '/mpg/geraete', '/wache1/doku']) {
      expect(hinweisZeigen({ neu: true, pfad, spaeterBis: null, jetzt: t })).toBe(true)
    }
  })
})

describe('Speicher', () => {
  it('meldet eine neue Fassung an alle Hörer', () => {
    const f = vi.fn()
    const ab = fassungAbonnieren(f)
    neueFassungMelden(async () => {})
    expect(fassungStand().neu).toBe(true)
    expect(f).toHaveBeenCalledTimes(1)
    ab()
    spaeter()
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('„Später“ blendet eine Stunde aus', () => {
    spaeter(1000)
    expect(fassungStand().spaeterBis).toBe(1000 + SPAETER_MS)
  })
  it('„Aktualisieren“ ruft die Übernahme genau einmal, auch bei doppeltem Tippen', async () => {
    let fertig: () => void = () => {}
    const uebernehmen = vi.fn(() => new Promise<void>((ok) => { fertig = ok }))
    neueFassungMelden(uebernehmen)
    const a = aktualisieren()
    const b = aktualisieren()
    expect(fassungStand().laedt).toBe(true)
    fertig()
    await Promise.all([a, b])
    expect(uebernehmen).toHaveBeenCalledTimes(1)
  })
})

describe('Einbau', () => {
  const lesen = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
  it('vite.config.ts: neue Fassung wartet auf Bestätigung, kein stilles Übernehmen', () => {
    const c = lesen('../../../vite.config.ts')
    expect(c).toMatch(/registerType:\s*'prompt'/)
    expect(c).not.toMatch(/registerType:\s*'autoUpdate'/)
    expect(c).not.toMatch(/skipWaiting:\s*true/)
    expect(c).toMatch(/injectRegister:\s*false/)
  })
  it('main.tsx meldet an, App.tsx zeigt den Hinweis', () => {
    expect(lesen('../../main.tsx')).toMatch(/swAnmelden\(\)/)
    expect(lesen('../../App.tsx')).toMatch(/<NeueFassungHinweis \/>/)
  })
  it('die Service-Worker-Teile übernehmen nicht selbst', () => {
    for (const d of ['../../../public/sw-push.js', '../../../public/sw-formulare.js']) expect(lesen(d)).not.toMatch(/skipWaiting\s*\(/)
  })
})
