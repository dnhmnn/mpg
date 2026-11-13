import { describe, expect, it } from 'vitest'
import {
  ABSENDER_ABZEICHEN, ABSENDER_VOREINSTELLUNG, angemeldetTrotzAusgeschaltet, ABSENDER_ZUSATZ, FRIST_MS, absenderLesen, absenderModus, absenderZeile,
  darfBearbeiten, darfFormulareEinstellen, darfOhneUnterschrift, einstellungsLinkZeigen, fristEndeVon, istMeinProtokoll,
  gepruefterPayload, kannAngemeldetSenden, minutenText, rechtAktiv, sammlungVon, wartetAufUnterschrift, type AbsenderEintrag,
} from '../formular/absender'
import { FRIST_MS as DOKU_FRIST_MS } from '../../pages/public/doku/absenden'
import type { User } from '../../types'

const JETZT = Date.parse('2026-10-31T12:00:00.000Z')
const STRICH = /[–—]/

const absender = (x: Partial<AbsenderEintrag>): AbsenderEintrag => ({ id: 'u1', name: 'Anna Berg', status: 'bestaetigt', weg: 'passwort', modus: 'passwort', am: '2026-10-31T11:00:00.000Z', ...x })

describe('Absender lesen: alle drei Sammlungen', () => {
  const a = absender({ feld: 'unterschrift' })

  it('patients: payload als Objekt, als Text und doppelt kodiert', () => {
    for (const payload of [{ absender: a }, JSON.stringify({ absender: a }), JSON.stringify(JSON.stringify({ absender: a }))]) {
      expect(absenderLesen({ payload, absender_status: 'bestaetigt' }, 'patients')).toEqual(a)
    }
  })

  it('product_outputs liest ebenso payload.absender (ohne feld)', () => {
    const b = absender({ status: 'nicht_bestaetigt', weg: '', modus: 'frei', am: '' })
    expect(absenderLesen({ payload: { absender: b, user_name: 'Anna Berg' }, absender_status: 'nicht_bestaetigt' }, 'product_outputs')).toEqual(b)
  })

  it('mpg_defect_reports aus reporter_status, reporter_name, reporter_user_id', () => {
    expect(absenderLesen({ reporter_status: 'ausstehend', reporter_name: 'Anna Berg', reporter_user_id: 'u1' }, 'mpg_defect_reports'))
      .toEqual({ id: 'u1', name: 'Anna Berg', status: 'ausstehend', weg: '', modus: 'passwort', am: '' })
    expect(absenderLesen({ reporter_status: 'ohne_konto', reporter_name: 'Hausmeister', reporter_user_id: '' }, 'mpg_defect_reports')?.modus).toBe('frei')
  })

  it('alter Satz ohne Angabe ergibt null', () => {
    expect(absenderLesen({ payload: { name: 'Muster' } }, 'patients')).toBeNull()
    expect(absenderLesen({ payload: '{kaputt' }, 'patients')).toBeNull()
    expect(absenderLesen({}, 'product_outputs')).toBeNull()
    expect(absenderLesen({ reporter_name: 'Anna Berg', reporter_user_id: 'u1' }, 'mpg_defect_reports')).toBeNull()
    expect(absenderLesen({ reporter_status: '' }, 'mpg_defect_reports')).toBeNull()
    expect(absenderLesen({ payload: { absender: { status: 'erfunden', id: 'u1' } } }, 'patients')).toBeNull()
  })

  it('abschluss bei ohne_unterschrift bleibt erhalten; Unbekanntes in weg wird leer', () => {
    const ab = { id: 'l1', name: 'Lea Leitung', am: '2026-10-31T12:00:00.000Z', grund: 'Absender nicht mehr erreichbar' }
    const r = absenderLesen({ payload: { absender: { ...absender({ status: 'ohne_unterschrift', weg: '' }), abschluss: ab } }, absender_status: 'ohne_unterschrift' }, 'patients')
    expect(r?.abschluss).toEqual(ab)
    expect(absenderLesen({ payload: { absender: { ...a, weg: 'erfunden' } }, absender_status: 'bestaetigt' }, 'patients')?.weg).toBe('')
  })

  it('payload.absender gilt nur mit passendem Statusfeld (Befund: Fälschung vor den Hooks und nach der Rücknahme)', () => {
    const p = { absender: a }
    // Ohne Feld (vor Schritt 5, nach der Rücknahme), leeres Feld (Satz aus der Zeit ohne Hooks), anderer Status
    expect(absenderLesen({ payload: p }, 'patients')).toBeNull()
    expect(absenderLesen({ payload: p, absender_status: '' }, 'patients')).toBeNull()
    expect(absenderLesen({ payload: p, absender_status: 'ausstehend' }, 'patients')).toBeNull()
    expect(absenderLesen({ payload: p, absender_status: 'bestaetigt' }, 'product_outputs')).toEqual(a)
    // gepruefterPayload: ohne passendes Feld ohne absender, sonst unverändert
    expect(gepruefterPayload({ payload: { ...p, x: 1 }, absender_status: '' })).toEqual({ x: 1 })
    expect(gepruefterPayload({ payload: JSON.stringify({ ...p, x: 1 }), absender_status: 'bestaetigt' })).toEqual({ ...p, x: 1 })
    expect(gepruefterPayload({ payload: { x: 1 } })).toEqual({ x: 1 })
    expect(gepruefterPayload({ payload: '{kaputt' })).toBeNull()
    expect(gepruefterPayload(null)).toBeNull()
    // Gefälscht „ausstehend“ für Anna: wartet nicht, gehört ihr nicht
    const falsch = { payload: { absender: absender({ status: 'ausstehend', id: 'anna' }), frist: '' }, absender_status: '' }
    expect(wartetAufUnterschrift(gepruefterPayload(falsch))).toBe(false)
    const best = { payload: { absender: absender({ id: 'anna' }), frist: new Date(JETZT + 3600_000).toISOString() }, absender_status: '' }
    expect(istMeinProtokoll(gepruefterPayload(best), 'anna')).toBe(false)
    expect(istMeinProtokoll(gepruefterPayload({ ...best, absender_status: 'bestaetigt' }), 'anna')).toBe(true)
  })
})

describe('Wartet auf die Unterschrift', () => {
  it('Objekt, Text, doppelt kodiert, kaputt', () => {
    const p = { absender: absender({ status: 'ausstehend' }) }
    expect(wartetAufUnterschrift(p)).toBe(true)
    expect(wartetAufUnterschrift(JSON.stringify(p))).toBe(true)
    expect(wartetAufUnterschrift(JSON.stringify(JSON.stringify(p)))).toBe(true)
    expect(wartetAufUnterschrift('{kaputt')).toBe(false)
    expect(wartetAufUnterschrift(null)).toBe(false)
    expect(wartetAufUnterschrift({ absender: absender({}) })).toBe(false)
    expect(wartetAufUnterschrift({})).toBe(false)
  })
})

describe('Zeile und Zusatz', () => {
  it('Zusatz je Status, ohne Gedankenstriche', () => {
    expect(ABSENDER_ZUSATZ).toEqual({ bestaetigt: '', nicht_bestaetigt: 'nicht bestätigt', ohne_konto: 'ohne Konto', ausstehend: 'Unterschrift ausstehend', ohne_unterschrift: 'ohne Unterschrift abgeschlossen' })
    for (const t of Object.values(ABSENDER_ZUSATZ)) expect(t).not.toMatch(STRICH)
    for (const z of Object.values(ABSENDER_ABZEICHEN)) if (z) expect(z.text).not.toMatch(STRICH)
    expect(ABSENDER_ABZEICHEN.ausstehend?.text).toBe('UNTERSCHRIFT AUSSTEHEND')
    expect(ABSENDER_ABZEICHEN.ohne_unterschrift?.text).toBe('OHNE UNTERSCHRIFT')
    expect(ABSENDER_ABZEICHEN.bestaetigt).toBeNull()
  })

  it('absenderZeile', () => {
    expect(absenderZeile(null, 'Anonym')).toBe('Anonym')
    expect(absenderZeile(absender({}), 'Anonym')).toBe('Anna Berg')
    expect(absenderZeile(absender({ status: 'nicht_bestaetigt' }), 'Anonym')).toBe('Anna Berg · nicht bestätigt')
    expect(absenderZeile(absender({ status: 'ohne_konto', name: 'Hausmeister Meier' }), '')).toBe('Hausmeister Meier · ohne Konto')
    expect(absenderZeile(absender({ status: 'ausstehend' }), '')).toBe('Anna Berg · Unterschrift ausstehend')
    expect(absenderZeile(absender({ status: 'ohne_unterschrift' }), '')).toBe('Anna Berg · ohne Unterschrift abgeschlossen')
    // alte Stände ohne Namen: Rückfall, Zusatz bleibt
    expect(absenderZeile(absender({ status: 'ohne_konto', name: '  ' }), 'Anonym')).toBe('Anonym · ohne Konto')
    expect(absenderZeile(absender({ status: 'ohne_konto', name: '' }), '')).toBe('ohne Konto')
  })

  it('minutenText', () => {
    expect(minutenText(1)).toBe('einer Minute')
    expect(minutenText(60)).toBe('einer Minute')
    expect(minutenText(61)).toBe('2 Minuten')
    expect(minutenText(900)).toBe('15 Minuten')
    expect(minutenText(0)).toBe('einer Minute')
  })
})

describe('Modus und Frist', () => {
  it('Voreinstellung: Patienten mit Passwort, sonst frei', () => {
    expect(ABSENDER_VOREINSTELLUNG).toEqual({ patienten: 'passwort', produktausgabe: 'frei', defektmeldung: 'frei' })
    expect(absenderModus(undefined, 'patienten')).toBe('passwort')
    expect(absenderModus({ absender: { patienten: 'frei' } }, 'patienten')).toBe('frei')
    expect(absenderModus(JSON.stringify({ absender: { defektmeldung: 'passwort' } }), 'defektmeldung')).toBe('passwort')
    expect(absenderModus({ absender: { produktausgabe: 'Passwort' } }, 'produktausgabe')).toBe('frei')
  })

  it('FRIST_MS ist 24 Stunden, gleich der Doku', () => {
    expect(FRIST_MS).toBe(24 * 60 * 60 * 1000)
    expect(FRIST_MS).toBe(DOKU_FRIST_MS)
  })

  it('fristEndeVon: payload.frist, sonst ein Tag ab dem Anlegen (auch PocketBase-Format)', () => {
    expect(fristEndeVon({ frist: '2026-11-01T10:00:00.000Z' }, '2026-10-01 10:00:00.000Z')).toBe(Date.parse('2026-11-01T10:00:00.000Z'))
    expect(fristEndeVon({}, '2026-10-31 10:00:00.000Z')).toBe(Date.parse('2026-10-31T10:00:00.000Z') + FRIST_MS)
    expect(fristEndeVon({ frist: '' }, 'kaputt')).toBe(0)
  })
})

describe('Mein Protokoll und Bearbeiten (Unitas)', () => {
  const angelegt = '2026-10-31 10:00:00.000Z'
  const frist = new Date(JETZT + 3600_000).toISOString()
  const vorbei = new Date(JETZT - 1000).toISOString()
  const mannschaft = { tf: { id: 'tf1', name: 'Tom Fuehrer' }, m1: { id: 'm1', name: 'Mia Eins' }, m2: null, m3: null }

  const faelle: { name: string; payload: unknown; user: string; mein: boolean; bearbeiten: boolean }[] = [
    { name: 'Teamführer, Frist läuft', payload: { mannschaft, frist }, user: 'tf1', mein: true, bearbeiten: true },
    { name: 'Teamführer, Frist vorbei', payload: { mannschaft, frist: vorbei }, user: 'tf1', mein: true, bearbeiten: false },
    { name: 'Mannschaft, kein Teamführer', payload: { mannschaft, frist }, user: 'm1', mein: true, bearbeiten: false },
    { name: 'bestätigter Absender', payload: { absender: absender({ id: 'a1' }), frist }, user: 'a1', mein: true, bearbeiten: true },
    { name: 'bestätigter Absender, Frist vorbei', payload: { absender: absender({ id: 'a1' }), frist: vorbei }, user: 'a1', mein: true, bearbeiten: false },
    { name: 'nicht bestätigter Absender', payload: { absender: absender({ id: 'a1', status: 'nicht_bestaetigt' }), frist }, user: 'a1', mein: true, bearbeiten: false },
    { name: 'ohne Konto', payload: { absender: absender({ id: '', status: 'ohne_konto' }), frist }, user: '', mein: false, bearbeiten: false },
    { name: 'ausstehend: Absender', payload: { absender: absender({ id: 'a1', status: 'ausstehend' }), frist: '' }, user: 'a1', mein: false, bearbeiten: false },
    { name: 'ausstehend: Teamführer mit Kennung', payload: { absender: absender({ id: 'a1', status: 'ausstehend' }), mannschaft, frist: '' }, user: 'tf1', mein: false, bearbeiten: false },
    { name: 'ohne Unterschrift: Absender', payload: { absender: absender({ id: 'a1', status: 'ohne_unterschrift' }) }, user: 'a1', mein: false, bearbeiten: false },
    { name: 'ohne Unterschrift: Teamführer nachgetragen', payload: { absender: absender({ id: 'a1', status: 'ohne_unterschrift' }), mannschaft, frist }, user: 'tf1', mein: true, bearbeiten: false },
    { name: 'alter Satz ohne Frist, Teamführer, vor zwei Stunden angelegt', payload: { mannschaft }, user: 'tf1', mein: true, bearbeiten: true },
    { name: 'fremde Person', payload: { mannschaft, absender: absender({ id: 'a1' }), frist }, user: 'x9', mein: false, bearbeiten: false },
    { name: 'ohne Kennung', payload: { mannschaft, frist }, user: '', mein: false, bearbeiten: false },
    { name: 'payload als Text', payload: JSON.stringify({ mannschaft, frist }), user: 'tf1', mein: true, bearbeiten: true },
    { name: 'kaputter payload', payload: '{kaputt', user: 'tf1', mein: false, bearbeiten: false },
  ]
  for (const f of faelle) {
    it(f.name, () => {
      expect(istMeinProtokoll(f.payload, f.user)).toBe(f.mein)
      expect(darfBearbeiten(f.payload, angelegt, f.user, JETZT)).toBe(f.bearbeiten)
    })
  }

  it('alter Satz ohne Frist: ein Tag ab dem Anlegen', () => {
    expect(darfBearbeiten({ mannschaft }, '2026-10-31 11:00:00.000Z', 'tf1', JETZT)).toBe(true)
    expect(darfBearbeiten({ mannschaft }, '2026-10-30 11:00:00.000Z', 'tf1', JETZT)).toBe(false)
  })
})

describe('Rechte (Spiegel der Regeln)', () => {
  const ORG = { id: 'o1' }
  const bis = (ms: number) => new Date(JETZT + ms).toISOString().replace('T', ' ')
  const u = (x: Partial<User>): User => ({ id: 'u1', email: 'u1@example.com', name: 'Anna Berg', role: 'benutzer', organization_id: 'o1', permissions: {}, ...x })

  it('rechtAktiv: dauerhaft, befristet (beide Formate), abgelaufen', () => {
    expect(rechtAktiv(u({ permissions: { patienten: true } }), 'patienten', JETZT)).toBe(true)
    expect(rechtAktiv(u({ permissions: { patienten: false } }), 'patienten', JETZT)).toBe(false)
    expect(rechtAktiv(u({ temp_permissions: { patienten: { until: bis(60_000) } } }), 'patienten', JETZT)).toBe(true)
    expect(rechtAktiv(u({ temp_permissions: { patienten: { until: new Date(JETZT + 60_000).toISOString() } } }), 'patienten', JETZT)).toBe(true)
    expect(rechtAktiv(u({ temp_permissions: { patienten: { until: bis(-60_000) } } }), 'patienten', JETZT)).toBe(false)
    expect(rechtAktiv(u({ temp_permissions: { patienten: { until: 'kaputt' } } }), 'patienten', JETZT)).toBe(false)
  })

  const tabelle: { name: string; user: User | null; ohne: boolean; einstellen: boolean; angemeldet: boolean }[] = [
    { name: 'Leitung', user: u({ role: 'admin' }), ohne: true, einstellen: true, angemeldet: true },
    { name: 'Recht patienten dauerhaft', user: u({ permissions: { patienten: true } }), ohne: true, einstellen: false, angemeldet: true },
    { name: 'patienten befristet gültig', user: u({ temp_permissions: { patienten: { until: bis(60_000) } } }), ohne: true, einstellen: false, angemeldet: true },
    { name: 'patienten befristet abgelaufen', user: u({ temp_permissions: { patienten: { until: bis(-60_000) } } }), ohne: false, einstellen: false, angemeldet: true },
    { name: 'ohne Recht', user: u({}), ohne: false, einstellen: false, angemeldet: true },
    { name: 'Benutzerverwaltung', user: u({ permissions: { unitarii: true } }), ohne: false, einstellen: true, angemeldet: true },
    { name: 'Vorgänge befristet', user: u({ temp_permissions: { dokumente: { until: bis(60_000) } } }), ohne: false, einstellen: true, angemeldet: true },
    { name: 'Supervisor ohne Org', user: u({ supervisor: true, organization_id: '' }), ohne: true, einstellen: true, angemeldet: false },
    { name: 'Supervisor mit Org', user: u({ supervisor: true }), ohne: true, einstellen: true, angemeldet: false },
    { name: 'Teilnehmer mit patienten', user: u({ role: 'teilnehmer', permissions: { patienten: true } }), ohne: false, einstellen: false, angemeldet: false },
    { name: 'Leitung gesperrt', user: u({ role: 'admin', disabled: true }), ohne: false, einstellen: false, angemeldet: false },
    { name: 'Leitung abgelaufen', user: u({ role: 'admin', expires_at: bis(-1000) }), ohne: false, einstellen: false, angemeldet: false },
    { name: 'Leitung, Ablauf in der Zukunft', user: u({ role: 'admin', expires_at: bis(3600_000) }), ohne: true, einstellen: true, angemeldet: true },
    { name: 'Leitung anderer Org', user: u({ role: 'admin', organization_id: 'o2' }), ohne: false, einstellen: true, angemeldet: true },
    { name: 'Mitglied ohne Org', user: u({ organization_id: '' }), ohne: false, einstellen: false, angemeldet: false },
    { name: 'niemand', user: null, ohne: false, einstellen: false, angemeldet: false },
  ]
  for (const t of tabelle) {
    it(t.name, () => {
      expect(darfOhneUnterschrift(t.user, ORG, JETZT)).toBe(t.ohne)
      expect(darfFormulareEinstellen(t.user, JETZT)).toBe(t.einstellen)
      expect(kannAngemeldetSenden(t.user, JETZT)).toBe(t.angemeldet)
    })
  }

  it('ohne Unterschrift nur, wenn das Modul Patienten frei ist', () => {
    expect(darfOhneUnterschrift(u({ role: 'admin' }), { id: 'o1', freigeschaltet: ['mpg'] }, JETZT)).toBe(false)
    expect(darfOhneUnterschrift(u({ role: 'admin' }), { id: 'o1', freigeschaltet: ['patienten'] }, JETZT)).toBe(true)
    expect(darfOhneUnterschrift(u({ supervisor: true }), { id: 'o1', freigeschaltet: ['mpg'] }, JETZT)).toBe(false)
  })

  it('Einstellungs-Link nur ohne Modul Vorgänge', () => {
    const leitung = u({ role: 'admin', permissions: { dokumente: true, unitarii: true } })
    expect(einstellungsLinkZeigen(leitung, { id: 'o1' })).toBe(false)
    expect(einstellungsLinkZeigen(leitung, { id: 'o1', freigeschaltet: ['mpg'] })).toBe(true)
    expect(einstellungsLinkZeigen(leitung, { id: 'o1', freigeschaltet: ['mpg', 'patienten'] })).toBe(true)
    expect(einstellungsLinkZeigen(leitung, { id: 'o1', freigeschaltet: ['dokumente'] })).toBe(false)
    // Lager schließt Vorgänge ein
    expect(einstellungsLinkZeigen(leitung, { id: 'o1', freigeschaltet: ['lager'] })).toBe(false)
    expect(einstellungsLinkZeigen(u({}), { id: 'o1', freigeschaltet: ['mpg'] })).toBe(false)
    expect(einstellungsLinkZeigen(null, { id: 'o1', freigeschaltet: ['mpg'] })).toBe(false)
  })

  it('ausgeschaltetes Formular bleibt für angemeldete Mitglieder derselben Org offen (Befund 10)', () => {
    for (const f of ['patienten', 'produktausgabe', 'defektmeldung']) {
      expect(angemeldetTrotzAusgeschaltet(u({}), 'o1', f, JETZT)).toBe(true)
      expect(angemeldetTrotzAusgeschaltet(u({ role: 'admin' }), 'o1', f, JETZT)).toBe(true)
      // andere Org, Teilnehmer, Supervisor, gesperrt, abgelaufen, niemand: nein
      expect(angemeldetTrotzAusgeschaltet(u({}), 'o2', f, JETZT)).toBe(false)
      expect(angemeldetTrotzAusgeschaltet(u({ role: 'teilnehmer' }), 'o1', f, JETZT)).toBe(false)
      expect(angemeldetTrotzAusgeschaltet(u({ supervisor: true }), 'o1', f, JETZT)).toBe(false)
      expect(angemeldetTrotzAusgeschaltet(u({ disabled: true }), 'o1', f, JETZT)).toBe(false)
      expect(angemeldetTrotzAusgeschaltet(u({ expires_at: '2026-10-30 12:00:00.000Z' }), 'o1', f, JETZT)).toBe(false)
      expect(angemeldetTrotzAusgeschaltet(null, 'o1', f, JETZT)).toBe(false)
      expect(angemeldetTrotzAusgeschaltet(u({}), '', f, JETZT)).toBe(false)
    }
    // CIRS ist anonym, ein unbekanntes Formular ebenso nie
    expect(angemeldetTrotzAusgeschaltet(u({}), 'o1', 'cirs', JETZT)).toBe(false)
    expect(angemeldetTrotzAusgeschaltet(u({}), 'o1', 'unbekannt', JETZT)).toBe(false)
  })
})

describe('Eigene Formulare: Einsendungen in form_submissions (Plan Vorgänge 5.3)', () => {
  it('Sammlung je Formular', () => {
    expect(sammlungVon('eigen')).toBe('form_submissions')
    expect(sammlungVon('patienten')).toBe('patients')
    expect(sammlungVon('defektmeldung')).toBe('mpg_defect_reports')
  })

  it('Absender wie bei der Produktausgabe: nur mit passendem Statusfeld; anonym und alte Einsendungen ohne', () => {
    const a = absender({ status: 'nicht_bestaetigt', modus: 'frei', weg: '' })
    expect(absenderLesen({ payload: { v: 2, absender: a }, absender_status: 'nicht_bestaetigt' }, 'form_submissions')).toEqual(a)
    expect(absenderLesen({ payload: JSON.stringify({ v: 2, absender: a }), absender_status: 'nicht_bestaetigt' }, 'form_submissions')).toEqual(a)
    // Vor den Hooks oder nach einer Rücknahme: ohne Statusfeld nicht geglaubt
    expect(absenderLesen({ payload: { v: 2, absender: a } }, 'form_submissions')).toBeNull()
    expect(absenderLesen({ payload: { v: 2, absender: a }, absender_status: 'bestaetigt' }, 'form_submissions')).toBeNull()
    // Anonym und alte, flache Einsendung
    expect(absenderLesen({ payload: { v: 2, absender_modus: 'anonym' }, absender_status: '' }, 'form_submissions')).toBeNull()
    expect(absenderLesen({ payload: { f_aaaaaaaa: 'x' } }, 'form_submissions')).toBeNull()
    expect(absenderZeile(absenderLesen({ payload: { v: 2, absender: absender({ status: 'ausstehend' }) }, absender_status: 'ausstehend' }, 'form_submissions'), 'Anonym'))
      .toBe('Anna Berg · Unterschrift ausstehend')
  })
})
