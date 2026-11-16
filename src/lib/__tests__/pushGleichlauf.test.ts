import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as T from '../push/regeln'
import { modulFrei as modulFreiApp } from '../freigabe'
import { istVerantwortlich } from '../einfuehrung'
import { KATEGORIEN } from '../cirs'
import type { User } from '../../types'

// Gleichlauf (Bauplan Push, 4.7): der Server (pb_hooks/push-regeln.js) und sein Zwilling in der
// App (src/lib/push/regeln.ts) rechnen gleich; die Rechte folgen formular-regeln.js, freigabe.ts
// und den API-Regeln in docs/pocketbase-regeln.md.
function laden(datei: string) {
  const modul = { exports: {} as Record<string, unknown> }
  runInNewContext(readFileSync(new URL(`../../../pb_hooks/${datei}`, import.meta.url), 'utf8'), { module: modul, exports: modul.exports })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return modul.exports as any
}
const R = laden('push-regeln.js')
const FR = laden('formular-regeln.js')
const flach = <X>(x: X): X => JSON.parse(JSON.stringify(x))

// Fester Zufall (mulberry32), damit jeder Lauf dieselben Eingaben prüft
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
const rnd = zufall(20261115)
const wahl = <X>(l: readonly X[]): X => l[Math.floor(rnd() * l.length)]
const ganz = (n: number) => Math.floor(rnd() * n)

const KEYS = T.ANLAESSE.map((a) => a.key as string).concat(['gibtsnicht', '', 'MITTEILUNG'])
function zeitRoh(): unknown {
  return wahl<() => unknown>([
    () => `${ganz(30)}:${String(ganz(70)).padStart(2, '0')}`,
    () => `${String(ganz(25)).padStart(2, '0')}:${String(ganz(61)).padStart(2, '0')}`,
    () => `${ganz(24)}:${ganz(60)}`,
    () => ganz(1440),
    () => null,
    () => undefined,
    () => ' 06:00',
    () => '6:00 ',
    () => '',
    () => '22:00',
  ])()
}
function ruheRoh(): unknown {
  return wahl<() => unknown>([
    () => ({ an: wahl([true, false, 'ja', 1, null, undefined]), von: zeitRoh(), bis: zeitRoh() }),
    () => ({ von: zeitRoh() }),
    () => null,
    () => 'Unsinn',
    () => [],
  ])()
}
function einstellungRoh(): unknown {
  const o: Record<string, unknown> = {}
  if (rnd() < 0.8) o.aus = rnd() < 0.9 ? Array.from({ length: ganz(6) }, () => (rnd() < 0.9 ? wahl(KEYS) : ganz(9))) : 'cirs_neu'
  if (rnd() < 0.8) o.ruhe = ruheRoh()
  if (rnd() < 0.5) o.mitteilung_in_ruhe = wahl([true, false, 'false', 0, null])
  if (rnd() < 0.2) o.v = 2
  return wahl<() => unknown>([() => o, () => JSON.stringify(o), () => JSON.stringify(JSON.stringify(o)), () => '{kaputt', () => null, () => 42])()
}
const zeitpunkt = () => Date.UTC(2026, 0, 1) + Math.floor(rnd() * 5 * 365 * 86_400_000)

describe('Zwilling: Katalog und Gruppen', () => {
  it('ANLAESSE gleich (key, gruppe, titel, beschreibung, art, pflicht, modul)', () => {
    expect(flach(R.ANLAESSE)).toEqual(flach(T.ANLAESSE))
  })
  it('GRUPPEN und RUHE_VORGABE gleich', () => {
    expect(flach(R.GRUPPEN)).toEqual(flach(T.GRUPPEN))
    expect(flach(R.RUHE_VORGABE)).toEqual(flach(T.RUHE_VORGABE))
  })
})

describe('Zwilling: Einstellungen und Zeit auf je 2000 zufälligen Eingaben', () => {
  it('personEinstellungenLesen, orgEinstellungenLesen', () => {
    for (let i = 0; i < 2000; i++) {
      const roh = einstellungRoh()
      expect(flach(R.personEinstellungenLesen(roh))).toEqual(flach(T.personEinstellungenLesen(roh)))
      expect(flach(R.orgEinstellungenLesen(roh))).toEqual(flach(T.orgEinstellungenLesen(roh)))
    }
  })
  it('personEinstellungenMischen', () => {
    for (let i = 0; i < 2000; i++) {
      const alt = T.personEinstellungenLesen(einstellungRoh())
      const teil = einstellungRoh()
      expect(flach(R.personEinstellungenMischen(alt, teil))).toEqual(flach(T.personEinstellungenMischen(alt, teil)))
    }
  })
  it('anlassAn', () => {
    for (let i = 0; i < 2000; i++) {
      const o = T.orgEinstellungenLesen(einstellungRoh())
      const p = T.personEinstellungenLesen(einstellungRoh())
      const k = wahl(KEYS) as T.AnlassKey
      expect(R.anlassAn(o, p, k)).toBe(T.anlassAn(o, p, k))
    }
  })
  it('zeitLesen und zeitText', () => {
    for (let i = 0; i < 2000; i++) {
      const z = zeitRoh()
      expect(R.zeitLesen(z)).toBe(T.zeitLesen(z))
      const m = ganz(5000) - 1000
      expect(R.zeitText(m)).toBe(T.zeitText(m))
    }
  })
  it('berlinTeile und berlinZuUtc', () => {
    for (let i = 0; i < 2000; i++) {
      const ms = zeitpunkt()
      expect(flach(R.berlinTeile(ms))).toEqual(T.berlinTeile(ms))
      const t = T.berlinTeile(ms)
      const min = rnd() < 0.5 ? t.minutenImTag : ganz(1440)
      expect(R.berlinZuUtc(t.tag, min)).toBe(T.berlinZuUtc(t.tag, min))
    }
    // um die Umstellungen
    for (const tag of ['2026-03-29', '2026-10-25', '2027-03-28', '2027-10-31']) {
      for (let m = 0; m < 1440; m++) expect(R.berlinZuUtc(tag, m)).toBe(T.berlinZuUtc(tag, m))
    }
  })
  it('inRuhe, ruheEnde, ruheText', () => {
    for (let i = 0; i < 2000; i++) {
      const r = T.personEinstellungenLesen({ ruhe: ruheRoh() }).ruhe
      const ms = rnd() < 0.3 ? Date.parse(wahl(['2026-03-29T00:30:00Z', '2026-03-29T01:10:00Z', '2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z'])) + ganz(7200) * 1000 : zeitpunkt()
      expect(R.inRuhe(r, ms)).toBe(T.inRuhe(r, ms))
      expect(R.ruheEnde(r, ms)).toBe(T.ruheEnde(r, ms))
      expect(R.ruheText(r)).toBe(T.ruheText(r))
      const e = T.ruheEnde(r, ms)
      if (e !== null) {
        expect(e).toBeGreaterThan(ms)
        expect(T.inRuhe(r, e)).toBe(false)
      }
    }
  })
})

const JETZT = Date.parse('2026-11-15T12:00:00.000Z')
const pbZeit = (ms: number) => new Date(ms).toISOString().replace('T', ' ')
const RECHTE = ['dokumente', 'patienten', 'lager', 'dashboard', 'mpg_verwalten', 'unitarii', 'ausbildungen_manage']
function personZufall(neuesFormat: boolean, nurDauerhaft = false) {
  const permissions: Record<string, unknown> = {}
  const temp: Record<string, unknown> = {}
  for (const r of RECHTE) {
    if (rnd() < 0.3) permissions[r] = wahl([true, false, 'true', 1])
    if (!nurDauerhaft && rnd() < 0.3) {
      const ms = JETZT + (ganz(4) - 2) * 3600_000
      temp[r] = { until: neuesFormat ? pbZeit(ms) : wahl([pbZeit(ms), new Date(ms).toISOString(), '', 'morgen']) }
    }
  }
  return {
    id: 'u' + String(ganz(1e9)).padStart(14, '0'), sammlung: 'users', organization_id: wahl(['o1', 'o1', 'o1', 'o2', '']),
    role: wahl(['admin', 'benutzer', 'teilnehmer', 'mpg', 'lager', '']), supervisor: rnd() < 0.15, disabled: rnd() < 0.1,
    expires_at: wahl(['', '', '', pbZeit(JETZT - 1000), pbZeit(JETZT + 86_400_000)]), permissions, temp_permissions: temp,
  }
}

describe('Zwilling: Mitteilung der Organisation (Owner 12.3)', () => {
  it('Grenzen und Texte gleich', () => {
    expect(T.MITTEILUNG_GRENZEN.titel).toBe(R.GRENZEN.mitteilungTitel)
    expect(T.MITTEILUNG_GRENZEN.text).toBe(R.GRENZEN.mitteilungText)
    expect(T.MITTEILUNG_GRENZEN.leitungJeTag).toBe(R.GRENZEN.mitteilungLeitungMax)
    expect(flach(T.MITTEILUNG_TEXTE)).toEqual(flach(R.MITTEILUNG_TEXTE))
  })
  it('mitteilungPruefen auf 2000 zufälligen Eingaben gleich', () => {
    const teile = ['Halle', ' ', '\n', '\t', 'ä', '\u{1F692}', '<b>', '</', '<!--', '&amp;', '&#39;', '& ', '< 3', 'x'.repeat(50), '\u00A0', '', '?', 'A&B;']
    const text = () => Array.from({ length: ganz(30) }, () => wahl(teile)).join('')
    for (let i = 0; i < 2000; i++) {
      const titel = wahl<() => unknown>([text, text, text, () => 'ä'.repeat(115 + ganz(10)), () => null, () => 7])()
      const nachricht = wahl<() => unknown>([text, text, () => 'ö'.repeat(995 + ganz(10)), () => '\u{1F692}'.repeat(995 + ganz(10)), () => undefined])()
      expect(flach(T.mitteilungPruefen(titel, nachricht))).toEqual(flach(R.mitteilungPruefen(titel, nachricht)))
    }
  })
})

describe('Rechte und Module gegen formular-regeln.js und freigabe.ts', () => {
  it('rechtAktiv wie formular-regeln.js', () => {
    for (let i = 0; i < 2000; i++) {
      const p = personZufall(false)
      for (const r of RECHTE) expect(R.rechtAktiv(p, r, JETZT)).toBe(FR.rechtAktiv(p, r, JETZT))
    }
  })
  it('rechtWieRegel ist nie lockerer als rechtAktiv, im neuen Format gleich', () => {
    for (let i = 0; i < 2000; i++) {
      const alt = personZufall(false)
      const neu = personZufall(true)
      for (const r of RECHTE) {
        if (R.rechtWieRegel(alt, r, JETZT)) expect(FR.rechtAktiv(alt, r, JETZT)).toBe(true)
        expect(R.rechtWieRegel(neu, r, JETZT)).toBe(FR.rechtAktiv(neu, r, JETZT))
      }
    }
  })
  it('modulFrei wie formular-regeln.js und freigabe.ts', () => {
    const werte: unknown[] = [undefined, null, [], ['lager'], ['mpg'], ['patienten', 'dokumente'], '["lager"]', '{kaputt', 'lager', [1, 'x'], ['benutzer'], ['ausbildungen', 'lager']]
    const module = ['benutzer', 'einsaetze', 'eks', 'patienten', 'dokumente', 'lager', 'mpg', 'dateien', 'lernbar', 'ausbildungen', 'chat', 'notizen', 'gibtsnicht']
    for (const f of werte) {
      const org = { freigeschaltet: f }
      for (const m of module) {
        expect([f, m, R.modulFrei(org, m)]).toEqual([f, m, FR.modulFrei(org, m)])
        expect([f, m, R.modulFrei(org, m)]).toEqual([f, m, modulFreiApp(org, m)])
      }
    }
    expect(flach(R.MODUL_IDS)).toEqual(flach(FR.MODUL_IDS))
  })
  it('darfAnlass(einsendung) wie darfVorgaenge (neues Datumsformat, Org aktiv, Modul frei); nie lockerer', () => {
    const org = { id: 'o1', is_active: true }
    for (let i = 0; i < 2000; i++) {
      const neu = personZufall(true)
      expect(R.darfAnlass(neu, org, 'einsendung', {}, JETZT)).toBe(FR.darfVorgaenge(neu, 'o1', JETZT))
      const alt = personZufall(false)
      if (R.darfAnlass(alt, org, 'einsendung', {}, JETZT)) expect(FR.darfVorgaenge(alt, 'o1', JETZT)).toBe(true)
    }
  })
  it('Leitung (darfOrganisation) wie istVerantwortlich bei dauerhaften Rechten, aktiv, eigene Organisation', () => {
    for (let i = 0; i < 2000; i++) {
      const p = { ...personZufall(true, true), disabled: false, expires_at: '', organization_id: 'o1' }
      const app = istVerantwortlich(p as unknown as User) && (p.supervisor === true || p.role === 'admin' || p.permissions.unitarii === true)
      expect(R.darfOrganisation(p, 'o1', JETZT)).toBe(app)
    }
  })
  it('KATEGORIEN_CIRS gleich KATEGORIEN aus src/lib/cirs.ts', () => {
    expect(flach(R.KATEGORIEN_CIRS)).toEqual(KATEGORIEN.map((k) => ({ wert: k.wert, name: k.name })))
  })
})

// Die Rechte je Anlass bilden die API-Regeln nach (3.1). Ändert jemand eine Regel in der Doku,
// schlägt dieser Test an: dann darfAnlass in pb_hooks/push-regeln.js anpassen (Bauplan 3.1).
describe('Rechte gegen die Regeltexte in docs/pocketbase-regeln.md', () => {
  const DOKU = readFileSync(new URL('../../../docs/pocketbase-regeln.md', import.meta.url), 'utf8')
  function abschnitt(titel: string, ende: string) {
    const a = DOKU.indexOf(titel)
    const b = DOKU.indexOf(ende, a + titel.length)
    if (a < 0 || b < 0) throw new Error(`Abschnitt fehlt: ${titel}`)
    return DOKU.slice(a, b)
  }
  function regel(text: string, label: string) {
    const i = text.indexOf(`**${label}**`)
    if (i < 0) throw new Error(`Regel fehlt: ${label}`)
    const a = text.indexOf('```\n', i) + 4
    return text.slice(a, text.indexOf('\n```', a)).trim()
  }
  it('cirs_reports: List-Regel ohne befristete Rechte (Push: nur dauerhaft dokumente oder Supervisor)', () => {
    const r = regel(abschnitt('## cirs_reports', '## Befristete'), 'List/Search')
    expect(r).toContain('@request.auth.permissions.dokumente = true')
    expect(r).toContain('@request.auth.supervisor = true')
    expect(r).not.toContain('temp_permissions')
    expect(r).not.toContain('role')
    const p = { id: 'x', organization_id: 'o1', role: 'benutzer', temp_permissions: { dokumente: { until: pbZeit(JETZT + 3600_000) } }, permissions: {} }
    expect(R.darfAnlass(p, { id: 'o1', is_active: true }, 'cirs_neu', {}, JETZT)).toBe(false)
  })
  it('form_submissions: Regel mit Leitung, dokumente auch befristet im neuen Format, ohne Teilnehmende', () => {
    const r = regel(abschnitt('### Eigene Formulare: API-Regeln', '### Felder'), 'Einsendungen List, View und Update')
    for (const t of ['@request.auth.role != "teilnehmer"', '@request.auth.role = "admin"', '@request.auth.permissions.dokumente = true', '@request.auth.temp_permissions.dokumente.until ~ " "', '@request.auth.temp_permissions.dokumente.until > @now', '@request.auth.supervisor = true', '@request.auth.disabled != true']) expect(r).toContain(t)
  })
  it('MPG: Bausteine Zugang (dashboard) und Verwalten (admin, mpg, mpg_verwalten), beide auch befristet', () => {
    const b = abschnitt('## MPG: API-Regeln', '### Übersicht')
    const zugang = regel(b, 'R — Lesen')
    for (const t of ['@request.auth.permissions.dashboard = true', '@request.auth.temp_permissions.dashboard.until ~ " "', '@request.auth.supervisor = true']) expect(zugang).toContain(t)
    const verwalten = regel(b, 'V — Ändern oder löschen mit „MPG verwalten“')
    for (const t of ['@request.auth.permissions.mpg_verwalten = true', '@request.auth.role = "admin"', '@request.auth.role = "mpg"', '@request.auth.temp_permissions.mpg_verwalten.until ~ " "']) expect(verwalten).toContain(t)
  })
  it('Lager: Baustein Lager (lager, Supervisor, befristet)', () => {
    const r = regel(abschnitt('## Lager: API-Regeln', '### Übersicht'), 'L — Lesen')
    for (const t of ['@request.auth.permissions.lager = true', '@request.auth.supervisor = true', '@request.auth.temp_permissions.lager.until ~ " "', '@request.auth.temp_permissions.lager.until > @now']) expect(r).toContain(t)
  })
  it('Befristete Rechte: Vergleich als Text mit Leerzeichen (wie befristetWieRegel)', () => {
    const b = abschnitt('## Befristete Rechte in Regeln', '## Lager: Buchungen')
    expect(b).toContain('(@request.auth.temp_permissions.<recht>.until ~ " " && @request.auth.temp_permissions.<recht>.until > @now)')
    const u = (until: string) => ({ temp_permissions: { lager: { until } } })
    expect(R.befristetWieRegel(u(pbZeit(JETZT + 1000)), 'lager', JETZT)).toBe(true)
    expect(R.befristetWieRegel(u(pbZeit(JETZT - 1000)), 'lager', JETZT)).toBe(false)
    expect(R.befristetWieRegel(u(new Date(JETZT + 86_400_000).toISOString()), 'lager', JETZT)).toBe(false)
  })
})
