// Selbsttest des MPG-Rechenkerns: Fristen, Gerätezustand, Prüfergebnis, Schreibpläne.
// An diesen Rechnungen hängt, ob ein Gerät als einsatzbereit gilt — deshalb Prüffälle.
// Läuft in der CI (src/lib/__tests__/mpg.test.ts) und ist in der App aufrufbar.
// Alle Fälle rechnen mit festen Tagen und Ortszeit-Zeitpunkten, unabhängig von heute.

import {
  fristenVon, faelligFeld, intervallVon, kalendertag, lageVon, lageText, monateVon, naechsteMtk, naechstePruefung,
  naechsteStk, plusMonate, tageZwischen, VORWARNUNG,
} from './fristen'
import { istAusserBetrieb, pruefungNichtBestanden, zustandVon, zaehleStufen } from './zustand'
import { ergebnisVon, moeglicheErgebnisse, restInOrdnung, setzePunkt, vorlageWaehlen, MANGEL_VERMERK, type PunktStatus, type Pruefpunkt } from './pruefung'
import {
  anker, ausserBetriebText, planeAusserBetrieb, planeBeheben, planeBestaetigung, planeDefekt, planeFreigabe, planeGeraetAenderung,
  planeLoeschen, planeNeuesGeraet, planePruefung, planeSperre, planeVermerk, planeWiederInBetrieb, restNachAnker, stammdatenAenderungen,
  stammdatenText, type Stammdaten,
} from './aktionen'

export interface TestErgebnis { name: string; ok: boolean; erwartet: string; erhalten: string }

function eq(name: string, erhalten: unknown, erwartet: unknown): TestErgebnis {
  const e = JSON.stringify(erwartet), h = JSON.stringify(erhalten)
  return { name, ok: e === h, erwartet: e, erhalten: h }
}

/** Zeitpunkt nach Ortszeit als ISO-Text, wie ihn PocketBase liefert. */
const um = (j: number, m: number, t: number, h = 8, min = 0) => new Date(j, m - 1, t, h, min).toISOString().replace('T', ' ')

const punkte = (...ok: boolean[]): Pruefpunkt[] => ok.map((c, i) => ({ item: `Punkt ${i + 1}`, checked: c, note: '' }))

export function laufeMpgSelbsttest(): TestErgebnis[] {
  const r: TestErgebnis[] = []
  const HEUTE = '2026-10-17'

  // ── Kalendertage ──
  r.push(eq('Datum ohne Uhrzeit bleibt der Tag', kalendertag('2026-03-10'), '2026-03-10'))
  r.push(eq('Datumsfeld aus PocketBase (Mitternacht UTC) bleibt der Tag', kalendertag('2026-03-10 00:00:00.000Z'), '2026-03-10'))
  r.push(eq('Zeitpunkt zählt nach Ortszeit (23:30)', kalendertag(um(2026, 10, 17, 23, 30)), '2026-10-17'))
  r.push(eq('Zeitpunkt zählt nach Ortszeit (00:15)', kalendertag(um(2026, 10, 18, 0, 15)), '2026-10-18'))
  r.push(eq('31. Februar ist kein Tag', kalendertag('2026-02-31'), null))
  r.push(eq('leer ist kein Tag', kalendertag(''), null))
  r.push(eq('Unsinn ist kein Tag', kalendertag('morgen'), null))
  r.push(eq('Sommerzeit-Umstellung verschluckt keinen Tag', tageZwischen('2026-03-28', '2026-03-30'), 2))
  r.push(eq('Winterzeit-Umstellung verdoppelt keinen Tag', tageZwischen('2026-10-24', '2026-10-26'), 2))

  // ── Monate ohne Überlauf (vorher: 31.01. + 1 Monat = 03.03.) ──
  r.push(eq('31.01. + 1 Monat = 28.02.', plusMonate('2026-01-31', 1), '2026-02-28'))
  r.push(eq('31.01. + 1 Monat im Schaltjahr = 29.02.', plusMonate('2028-01-31', 1), '2028-02-29'))
  r.push(eq('29.02. + 12 Monate = 28.02.', plusMonate('2024-02-29', 12), '2025-02-28'))
  r.push(eq('31.03. − 1 Monat = 28.02.', plusMonate('2026-03-31', -1), '2026-02-28'))
  r.push(eq('über den Jahreswechsel', plusMonate('2026-11-15', 3), '2027-02-15'))

  // ── Regelprüfung ──
  r.push(eq('täglich: am nächsten Tag', naechstePruefung('2026-10-16', 'daily'), '2026-10-17'))
  r.push(eq('wöchentlich: 7 Tage später', naechstePruefung('2026-10-16', 'weekly'), '2026-10-23'))
  r.push(eq('monatlich: monatsende-sicher', naechstePruefung('2026-01-31', 'monthly'), '2026-02-28'))
  r.push(eq('jährlich: vom 29.02. auf den 28.02.', naechstePruefung('2024-02-29', 'yearly'), '2025-02-28'))

  // ── STK / MTK ──
  r.push(eq('STK mit Ablauf des Monats (10.03.2024 + 24 Mon.)', naechsteStk('2024-03-10', 24), '2026-03-31'))
  r.push(eq('STK mit Ablauf des Monats im Schaltjahr', naechsteStk('2024-01-31', 1), '2024-02-29'))
  r.push(eq('MTK taggenau', naechsteMtk('2024-03-10', 24), '2026-03-10'))
  r.push(eq('Intervall 0 Monate → 24', monateVon(0), 24))
  r.push(eq('Intervall leer → 24', monateVon(null), 24))
  r.push(eq('Intervall 12 bleibt', monateVon(12), 12))

  // ── Lage einer Frist (vorher: täglich/wöchentlich immer „Bald“) ──
  r.push(eq('täglich, morgen fällig: in Ordnung', lageVon('2026-10-18', HEUTE, VORWARNUNG.daily).lage, 'ok'))
  r.push(eq('täglich, heute fällig: heute', lageVon(HEUTE, HEUTE, VORWARNUNG.daily).lage, 'heute'))
  r.push(eq('wöchentlich, morgen fällig: bald', lageVon('2026-10-18', HEUTE, VORWARNUNG.weekly).lage, 'bald'))
  r.push(eq('wöchentlich, in 2 Tagen: in Ordnung', lageVon('2026-10-19', HEUTE, VORWARNUNG.weekly).lage, 'ok'))
  r.push(eq('monatlich, in 7 Tagen: bald', lageVon('2026-10-24', HEUTE, VORWARNUNG.monthly).lage, 'bald'))
  r.push(eq('monatlich, in 8 Tagen: in Ordnung', lageVon('2026-10-25', HEUTE, VORWARNUNG.monthly).lage, 'ok'))
  r.push(eq('gestern fällig: überfällig', lageVon('2026-10-16', HEUTE, VORWARNUNG.monthly), { lage: 'ueberfaellig', tage: -1 }))
  r.push(eq('ohne Datum: offen', lageVon(null, HEUTE, 7).lage, 'offen'))
  r.push(eq('Text überfällig', lageText({ lage: 'ueberfaellig', tage: -3 }), 'überfällig seit 3 Tagen'))

  // ── Fälligkeit am Gerät ──
  r.push(eq('nie geprüft: Erstprüfung offen', fristenVon({ interval: 'monthly' }, HEUTE)[0].lage, 'offen'))
  const mitAltwert = { interval: 'monthly', last_inspection: um(2026, 9, 1), next_inspection_due: '2026-12-01 10:00:00.000Z' }
  r.push(eq('gespeichertes next_inspection_due zählt nicht (Speichern setzte es zurück)', zustandVon(mitAltwert, [], [], HEUTE).stufe, 'handlung'))
  r.push(eq('Intervall als Liste (Auswahl mit Mehrfachwahl in PocketBase)', fristenVon({ interval: ['weekly'], last_inspection: um(2026, 10, 15) }, HEUTE)[0].naechste, '2026-10-22'))
  r.push(eq('Intervall als deutsches Wort', [intervallVon('Wöchentlich'), intervallVon(' täglich '), intervallVon('JÄHRLICH'), intervallVon('monatlich')], ['weekly', 'daily', 'yearly', 'monthly']))
  r.push(eq('unbekanntes Intervall zählt monatlich', fristenVon({ interval: 'quartal', last_inspection: um(2026, 10, 1) }, HEUTE)[0].naechste, '2026-11-01'))
  r.push(eq('next_inspection_due: Ende des Fälligkeitstags', kalendertag(faelligFeld({ interval: 'daily', last_inspection: um(2026, 10, 16, 8) }, HEUTE)), '2026-10-17'))
  r.push(eq('next_inspection_due: nie geprüft → heute', kalendertag(faelligFeld({ interval: 'yearly' }, HEUTE)), HEUTE))
  r.push(eq('next_inspection_due: monatsende-sicher', kalendertag(faelligFeld({ interval: 'monthly', last_inspection: um(2026, 1, 31) }, HEUTE)), '2026-02-28'))

  // ── Zustand ──
  const geprueft = { interval: 'monthly', last_inspection: um(2026, 10, 1), last_inspection_passed: true, operational: true }
  r.push(eq('geprüft, nichts offen: einsatzbereit', zustandVon(geprueft, [], [], HEUTE).stufe, 'ok'))
  r.push(eq('nicht einsatzbereit markiert: gesperrt', zustandVon({ ...geprueft, operational: false }, [], [], HEUTE).stufe, 'gesperrt'))
  r.push(eq('letzte Prüfung nicht bestanden: gesperrt (vorher „Fällig“)', zustandVon({ ...geprueft, last_inspection_passed: false }, [], [], HEUTE).stufe, 'gesperrt'))
  r.push(eq('offener kritischer Defekt: gesperrt, auch wenn „einsatzbereit“ markiert', zustandVon(geprueft, [{ severity: 'critical' }], [], HEUTE).stufe, 'gesperrt'))
  r.push(eq('offener Defekt „hoch“: gesperrt', zustandVon(geprueft, [{ severity: 'high' }], [], HEUTE).stufe, 'gesperrt'))
  r.push(eq('offener Mangel „gering“: Handlungsbedarf', zustandVon(geprueft, [{ severity: 'low' }], [], HEUTE).stufe, 'handlung'))
  r.push(eq('offene Meldung von außen: Handlungsbedarf (vorher ohne Wirkung)', zustandVon(geprueft, [], [{ severity: 'critical' }], HEUTE).stufe, 'handlung'))
  r.push(eq('nie geprüft: Handlungsbedarf (vorher OK)', zustandVon({ interval: 'monthly' }, [], [], HEUTE).gruende[0].text, 'Erstprüfung offen'))
  // So liefert PocketBase ein nie geprüftes Gerät: leere Ja/Nein-Felder sind false, leere Zahlen 0
  const pbNeu = { interval: 'monthly', last_inspection: '', last_inspection_passed: false, operational: true, has_stk: false, last_stk: '', stk_interval_months: 0, has_mtk: false, last_mtk: '', mtk_interval_months: 0 }
  r.push(eq('nie geprüft (PocketBase-Form): nicht gesperrt, sondern Erstprüfung offen', [zustandVon(pbNeu, [], [], HEUTE).stufe, zustandVon(pbNeu, [], [], HEUTE).gruende.map(g => g.text)], ['handlung', ['Erstprüfung offen']]))
  r.push(eq('nicht bestanden zählt nur mit Prüfdatum', [pruefungNichtBestanden(pbNeu), pruefungNichtBestanden({ last_inspection: um(2026, 10, 1), last_inspection_passed: false })], [false, true]))
  r.push(eq('monatlich, in 5 Tagen fällig: bald', zustandVon({ ...geprueft, last_inspection: um(2026, 9, 22) }, [], [], HEUTE).stufe, 'bald'))
  r.push(eq('monatlich, überfällig: Handlungsbedarf', zustandVon({ ...geprueft, last_inspection: um(2026, 9, 10) }, [], [], HEUTE).stufe, 'handlung'))
  r.push(eq('täglich, heute schon geprüft: einsatzbereit', zustandVon({ ...geprueft, interval: 'daily', last_inspection: um(2026, 10, 17, 7) }, [], [], HEUTE).stufe, 'ok'))
  r.push(eq('täglich, gestern geprüft: heute fällig', zustandVon({ ...geprueft, interval: 'daily', last_inspection: um(2026, 10, 16, 7) }, [], [], HEUTE).gruende[0].text, 'Prüfung heute fällig'))
  r.push(eq('STK verlangt, kein Datum: Handlungsbedarf', zustandVon({ ...geprueft, has_stk: true }, [], [], HEUTE).gruende[0].text, 'Letzte STK nicht eingetragen'))
  r.push(eq('STK überfällig: Handlungsbedarf', zustandVon({ ...geprueft, has_stk: true, last_stk: '2024-09-05', stk_interval_months: 24 }, [], [], HEUTE).stufe, 'handlung'))
  r.push(eq('STK fällig bis Monatsende (31.10.): bald', zustandVon({ ...geprueft, has_stk: true, last_stk: '2024-10-02', stk_interval_months: 24 }, [], [], HEUTE).stufe, 'bald'))
  r.push(eq('STK ohne Häkchen zählt nicht', zustandVon({ ...geprueft, has_stk: false, last_stk: '2020-01-01' }, [], [], HEUTE).stufe, 'ok'))
  r.push(eq('schwerster Grund zuerst',
    zustandVon({ ...geprueft, operational: false, last_inspection: um(2026, 9, 1) }, [{ severity: 'low' }], [], HEUTE).gruende.map(g => g.stufe),
    ['gesperrt', 'handlung', 'handlung']))
  r.push(eq('Zählung je Stufe', zaehleStufen([
    { id: 'a', ...geprueft }, { id: 'b', ...geprueft, operational: false }, { id: 'c', ...pbNeu },
  ], [{ device_id: 'a', severity: 'critical' }], [], HEUTE), { gesperrt: 2, handlung: 1, bald: 0, ok: 0 }))

  // ── Prüfergebnis (vorher: „Bestanden“ mit offenen Punkten möglich) ──
  r.push(eq('alle Punkte i.O.: nur Bestanden ohne Bemerkung', moeglicheErgebnisse(punkte(true, true), ''), { bestanden: true, mangel: false, nicht_bestanden: false, hinweis: '' }))
  r.push(eq('ein Punkt offen, ohne Bemerkung: nichts speicherbar', [moeglicheErgebnisse(punkte(true, false), '')].map(w => [w.bestanden, w.mangel, w.nicht_bestanden])[0], [false, false, false]))
  r.push(eq('ein Punkt offen, mit Bemerkung: Mangel oder nicht bestanden', [moeglicheErgebnisse(punkte(true, false), 'Akku 20 %')].map(w => [w.bestanden, w.mangel, w.nicht_bestanden])[0], [false, true, true]))
  r.push(eq('ohne Prüfpunkte kein Bestanden', moeglicheErgebnisse([], '').bestanden, false))
  // Je Punkt entschieden (Prüfseite)
  const jp = (...st: PunktStatus[]): Pruefpunkt[] => st.map((x, i) => setzePunkt({ item: `P${i + 1}`, checked: false, note: '' }, x))
  const wahl = (pk: Pruefpunkt[], b = '') => { const w = moeglicheErgebnisse(pk, b); return [w.bestanden, w.mangel, w.nicht_bestanden] }
  r.push(eq('je Punkt: alle i.O. → nur Bestanden', wahl(jp('ok', 'ok')), [true, false, false]))
  r.push(eq('je Punkt: ein Punkt noch offen → nichts speicherbar', wahl(jp('ok', 'offen'), 'Bemerkung'), [false, false, false]))
  r.push(eq('je Punkt: Mangel ohne Notiz → nichts speicherbar', wahl(jp('ok', 'mangel')), [false, false, false]))
  const mitNotiz = jp('ok', 'mangel'); mitNotiz[1] = { ...mitNotiz[1], note: 'Akku 20 %' }
  r.push(eq('je Punkt: Mangel mit Notiz → Mangel oder nicht bestanden, ohne Bemerkung', wahl(mitNotiz), [false, true, true]))
  r.push(eq('je Punkt: alle i.O., Problem außerhalb der Liste → mit Bemerkung', [wahl(jp('ok'), ''), wahl(jp('ok'), 'Gehäuse nass')], [[true, false, false], [true, true, true]]))
  const teilweise = jp('offen', 'mangel', 'offen'); teilweise[1] = { ...teilweise[1], note: 'Gehäuse gerissen' }
  r.push(eq('„Übrige in Ordnung“ lässt einen erfassten Mangel samt Notiz stehen', restInOrdnung(teilweise).map(p => [p.status, p.note]), [['ok', ''], ['mangel', 'Gehäuse gerissen'], ['ok', '']]))
  r.push(eq('„Übrige in Ordnung“ macht „Bestanden“ bei einem Mangel nicht möglich', moeglicheErgebnisse(restInOrdnung(teilweise), '').bestanden, false))
  r.push(eq('je Punkt: i.O. hält „abgehakt“ für ältere Leser stimmig', [setzePunkt(jp('offen')[0], 'ok').checked, setzePunkt(jp('ok')[0], 'mangel').checked], [true, false]))
  r.push(eq('je Punkt: Protokoll ohne Bemerkung nennt die Mängel', planePruefung({ geraet: { id: 'g', name: 'G', type: 'AED', interval: 'monthly' }, punkte: mitNotiz, bemerkung: '', ergebnis: 'mangel', wer: { organization_id: 'o', name: 'A' }, jetzt: new Date(2026, 0, 1), ids: { pruefung: 'p', defekt: 'd' } }).find(a => a.collection === 'mpg_inspections')?.body.notes, MANGEL_VERMERK + 'P2: Akku 20 %'))
  r.push(eq('je Punkt: Defekt ohne Bemerkung', planePruefung({ geraet: { id: 'g', name: 'G', type: 'AED', interval: 'monthly' }, punkte: mitNotiz, bemerkung: '', ergebnis: 'nicht_bestanden', wer: { organization_id: 'o', name: 'A' }, jetzt: new Date(2026, 0, 1), ids: { pruefung: 'p', defekt: 'd' } }).find(a => a.collection === 'mpg_defects')?.body.description, 'Prüfung nicht bestanden\nNicht in Ordnung: P2 (Akku 20 %)'))
  r.push(eq('gespeichert: nicht bestanden', ergebnisVon({ passed: false, checklist_results: punkte(true) }), 'nicht_bestanden'))
  r.push(eq('gespeichert: bestanden', ergebnisVon({ passed: true, checklist_results: punkte(true, true) }), 'bestanden'))
  r.push(eq('gespeichert früher: bestanden mit offenen Punkten → Mangel', ergebnisVon({ passed: true, checklist_results: punkte(true, false) }), 'mangel'))
  r.push(eq('gespeichert: Mangel-Vermerk', ergebnisVon({ passed: true, notes: MANGEL_VERMERK + 'Delle', checklist_results: punkte(true) }), 'mangel'))

  // ── Was beim Speichern geschrieben wird ──
  const wer = { organization_id: 'org', name: 'Anna' }
  const geraet = { id: 'g1', name: 'Defi RTW 1', type: 'Defibrillator', interval: 'monthly' }
  const jetzt = new Date(2026, 0, 31, 9, 0)
  const ids = { pruefung: 'p1', defekt: 'd1' }
  const plan = (ergebnis: 'bestanden' | 'mangel' | 'nicht_bestanden') =>
    planePruefung({ geraet, punkte: punkte(true, ergebnis === 'bestanden'), bemerkung: ' Elektroden abgelaufen ', ergebnis, wer, jetzt, ids })
  // Was ein Plan je Collection schreibt, zusammengefasst (die Reihenfolge prüfen eigene Fälle)
  const teil = (plan: ReturnType<typeof planePruefung>, c: string): Record<string, unknown> => Object.assign({}, ...plan.filter(a => a.collection === c).map(a => a.body))
  const bestanden = plan('bestanden')
  r.push(eq('bestanden: Protokoll (Anker), dann Prüfstand am Gerät, kein Defekt', bestanden.map(a => a.collection), ['mpg_inspections', 'mpg_devices']))
  r.push(eq('bestanden: Gerät nicht freigegeben oder gesperrt', 'operational' in teil(bestanden, 'mpg_devices'), false))
  r.push(eq('bestanden: nächste Prüfung monatsende-sicher', kalendertag(teil(bestanden, 'mpg_devices').next_inspection_due as string), '2026-02-28'))
  const mangel = plan('mangel')
  r.push(eq('Mangel: Defekt gering, Protokoll, zuletzt Prüfstand', [mangel.map(a => a.collection), teil(mangel, 'mpg_defects').severity, teil(mangel, 'mpg_inspections').passed], [['mpg_defects', 'mpg_inspections', 'mpg_devices'], 'low', true]))
  r.push(eq('Mangel: Gerät bleibt einsatzbereit', 'operational' in teil(mangel, 'mpg_devices'), false))
  r.push(eq('Mangel: Vermerk im Protokoll', teil(mangel, 'mpg_inspections').notes, MANGEL_VERMERK + 'Elektroden abgelaufen'))
  r.push(eq('Mangel: Defekt nennt den offenen Punkt', teil(mangel, 'mpg_defects').description, 'Mangel bei Prüfung: Elektroden abgelaufen\nNicht in Ordnung: Punkt 2'))
  const nicht = plan('nicht_bestanden')
  r.push(eq('nicht bestanden: Defekt hoch und Sperre', [teil(nicht, 'mpg_defects').severity, teil(nicht, 'mpg_devices').operational, teil(nicht, 'mpg_inspections').passed, teil(nicht, 'mpg_devices').last_inspection_passed], ['high', false, false, false]))
  r.push(eq('nicht bestanden: IDs vom Gerät, Anker ist das Protokoll', [nicht.find(a => a.collection === 'mpg_defects')?.id, anker(nicht)], ['d1', { collection: 'mpg_inspections', id: 'p1' }]))
  r.push(eq('nicht bestanden: Sperre zuerst, Prüfstand zuletzt', nicht.map(a => a.collection === 'mpg_devices' ? Object.keys(a.body).join('+') : a.collection),
    ['operational', 'mpg_defects', 'mpg_inspections', 'last_inspection+last_inspection_passed+next_inspection_due']))
  // Bricht die Verbindung mittendrin ab (einzeln geschrieben), darf kein Teilstand das Gerät
  // „geprüft“ oder „bestanden“ aussehen lassen, ohne dass das Protokoll da ist
  for (const e of ['bestanden', 'mangel', 'nicht_bestanden'] as const) {
    const pl = plan(e)
    const vorAnker = pl.slice(0, pl.indexOf(pl.find(a => a.collection === 'mpg_inspections')!))
    r.push(eq(`${e}: vor dem Protokoll nichts, was das Gerät gut aussehen lässt`, vorAnker.some(a => 'last_inspection' in a.body || a.body.operational === true), false))
  }
  r.push(eq('Rest nach dem Anker: nur der Prüfstand', restNachAnker(bestanden).map(a => Object.keys(a.body).sort().join('+')), ['last_inspection+last_inspection_passed+next_inspection_due']))
  // Ein älterer Entwurf wird erst nach einer neueren Prüfung gesendet
  const gesendet = new Date('2026-03-01T10:00:00Z')
  const spaet = (ergebnis: 'bestanden' | 'nicht_bestanden', serverLetzte: string, serverBestanden: boolean | null = true) =>
    planePruefung({ geraet, punkte: punkte(true), bemerkung: 'x', ergebnis, wer, jetzt, ids, serverLetzte, serverBestanden, sendezeit: gesendet })
  r.push(eq('älterer Versuch überschreibt keinen neueren Gerätestand', spaet('bestanden', '2026-02-01 10:00:00.000Z').map(a => a.collection), ['mpg_inspections']))
  r.push(eq('älterer Versuch, Anker schon da: nichts mehr zu senden', restNachAnker(spaet('bestanden', '2026-02-01 10:00:00.000Z')), []))
  r.push(eq('älterer Versuch „bestanden“ setzt kein neueres Durchfallen zurück', spaet('bestanden', '2026-02-01 10:00:00.000Z', false).map(a => a.collection), ['mpg_inspections']))
  r.push(eq('älterer Versuch „nicht bestanden“ gegen neueres Durchfallen: nur die Sperre', spaet('nicht_bestanden', '2026-02-01 10:00:00.000Z', false).filter(a => a.collection === 'mpg_devices').map(a => a.body), [{ operational: false }]))
  r.push(eq('„nicht bestanden“ setzt sich gegen ein neueres „bestanden“ durch', teil(spaet('nicht_bestanden', '2026-02-01 10:00:00.000Z', true), 'mpg_devices').last_inspection_passed, false))
  r.push(eq('„nicht bestanden“ gegen unbekannten Stand: Durchfallen gilt', teil(spaet('nicht_bestanden', '2026-02-01 10:00:00.000Z', null), 'mpg_devices').last_inspection_passed, false))
  r.push(eq('Serverstand nach der Sendezeit (Uhr ging vor) zählt nicht', 'last_inspection' in teil(spaet('bestanden', '2026-03-01 10:30:00.000Z', false), 'mpg_devices'), true))
  r.push(eq('gleicher Zeitpunkt (Teil schon angekommen) schreibt den Gerätestand', 'last_inspection' in teil(spaet('bestanden', jetzt.toISOString().replace('T', ' ')), 'mpg_devices'), true))
  r.push(eq('ohne Serverstand wie bisher', 'last_inspection' in teil(planePruefung({ geraet, punkte: punkte(true), bemerkung: '', ergebnis: 'bestanden', wer, jetzt, ids, serverLetzte: '' }), 'mpg_devices'), true))

  r.push(eq('Defekt melden ohne Sperre', planeDefekt({ geraet, beschreibung: 'Display flackert', schwere: 'medium', sperren: false, wer, id: 'x' }).map(a => a.collection), ['mpg_defects']))
  const mitSperre = planeDefekt({ geraet, beschreibung: 'Display flackert', schwere: 'high', sperren: true, wer, id: 'x' })
  r.push(eq('Defekt melden mit Sperre: erst Sperre, Defekt als Anker zuletzt', [mitSperre[0].body, anker(mitSperre)], [{ operational: false }, { collection: 'mpg_defects', id: 'x' }]))
  r.push(eq('Beheben gibt nicht von selbst frei', planeBeheben({ defekt: { id: 'd', device_id: 'g', device_name: 'G' }, notiz: '', wer, wiederEinsatzbereit: false }).length, 1))
  r.push(eq('Beheben mit Freigabe', planeBeheben({ defekt: { id: 'd', device_id: 'g', device_name: 'G' }, notiz: '', wer, wiederEinsatzbereit: true })[1].body, { operational: true }))
  const meldung = { id: 'm1', device_id: 'g1', device_name: 'Defi', description: 'Kabel lose', severity: 'high' as const }
  const best = planeBestaetigung({ meldung, anmerkung: 'Gesehen', sperren: true, geraetDa: true, wer, defektId: 'd9' })
  r.push(eq('Bestätigen: Defekt vor der Sperre, zuletzt der Status der Meldung', best.map(a => `${a.collection}:${a.aktion}`), ['mpg_defects:create', 'mpg_devices:update', 'mpg_defect_reports:update']))
  r.push(eq('Bestätigen: Anmerkung wird gespeichert', best.find(a => a.collection === 'mpg_defects')?.body.description, 'Kabel lose\n\nAnmerkung bei Bestätigung (Anna): Gesehen'))
  r.push(eq('Bestätigen: gelöschtes Gerät wird nicht angefasst',
    planeBestaetigung({ meldung, anmerkung: '', sperren: true, geraetDa: false, wer, defektId: 'd9' }).map(a => a.collection), ['mpg_defects', 'mpg_defect_reports']))

  // ── Außer Betrieb (Paket 3): verlässt den Bestand, gilt nie als einsatzbereit ──
  const ab = { ...geprueft, ausser_betrieb: '2026-10-01 00:00:00.000Z' }
  r.push(eq('außer Betrieb: gesperrt mit Datum, auch wenn sonst alles stimmt', [zustandVon(ab, [], [], HEUTE).stufe, zustandVon(ab, [], [], HEUTE).gruende.map(g => g.text)], ['gesperrt', ['Außer Betrieb seit 01.10.2026']]))
  r.push(eq('außer Betrieb: keine Fristen mehr', zustandVon({ ...ab, last_inspection: um(2025, 1, 1) }, [], [], HEUTE).fristen, []))
  r.push(eq('außer Betrieb: unlesbares Datum zählt trotzdem', zustandVon({ ...geprueft, ausser_betrieb: 'irgendwann' }, [], [], HEUTE).stufe, 'gesperrt'))
  r.push(eq('in Betrieb: leeres Feld (PocketBase-Form) und fehlendes Feld', [istAusserBetrieb({ ausser_betrieb: '' }), istAusserBetrieb({}), istAusserBetrieb({ ausser_betrieb: null })], [false, false, false]))
  r.push(eq('Zählung lässt außer Betrieb genommene weg', zaehleStufen([{ id: 'a', ...geprueft }, { id: 'b', ...ab }], [{ device_id: 'b', severity: 'critical' }], [], HEUTE), { gesperrt: 0, handlung: 0, bald: 0, ok: 1 }))

  // ── Gerätebuch (Paket 3) ──
  const g1 = { id: 'g1', name: 'Defi RTW 1' }
  const arten = (pl: { collection: string; body: Record<string, unknown> }[]) => pl.map(a => a.collection === 'mpg_ereignisse' ? `buch:${a.body.art}` : a.collection === 'mpg_devices' ? Object.keys(a.body).join('+') || 'delete' : a.collection)
  r.push(eq('Sperren: Sperre zuerst, dann der Grund im Gerätebuch', arten(planeSperre({ geraet: g1, grund: ' Akku bläht sich ', wer, id: 'e1', buch: true })), ['operational', 'buch:gesperrt']))
  r.push(eq('Sperren: Grund und Name im Gerätebuch', planeSperre({ geraet: g1, grund: ' Akku bläht sich ', wer, id: 'e1', buch: true })[1].body,
    { organization_id: 'org', device_id: 'g1', device_name: 'Defi RTW 1', art: 'gesperrt', text: 'Akku bläht sich', bezug: '', user_name: 'Anna' }))
  r.push(eq('Sperren ohne Gerätebuch (Collection fehlt): nur die Sperre', arten(planeSperre({ geraet: g1, grund: 'x', wer, id: 'e1', buch: false })), ['operational']))
  const frei = planeFreigabe({ geraet: g1, bemerkung: 'repariert', wer, id: 'e2', buch: true })
  r.push(eq('Freigeben: erst ins Gerätebuch (Anker), die Freigabe zuletzt', [arten(frei), anker(frei), frei[1].body], [['buch:freigegeben', 'operational'], { collection: 'mpg_ereignisse', id: 'e2' }, { operational: true }]))
  r.push(eq('Freigeben: Rest nach dem Anker ist nur die Freigabe', restNachAnker(frei).map(a => a.body), [{ operational: true }]))
  const beh = planeBeheben({ defekt: { id: 'd', device_id: 'g1', device_name: 'Defi RTW 1' }, notiz: 'Akku getauscht', wer, wiederEinsatzbereit: true, buch: { ereignisId: 'e3' } })
  r.push(eq('Beheben mit Freigabe: Defekt, Gerätebuch, Freigabe zuletzt', [arten(beh), beh[1].body.text, beh[1].body.bezug], [['mpg_defects', 'buch:freigegeben', 'operational'], 'Defekt behoben: Akku getauscht', 'd']))
  r.push(eq('Beheben ohne Freigabe: kein Eintrag „freigegeben“', arten(planeBeheben({ defekt: { id: 'd', device_id: 'g1', device_name: 'G' }, notiz: '', wer, wiederEinsatzbereit: false, buch: { ereignisId: 'e3' } })), ['mpg_defects']))
  const nichtBuch = planePruefung({ geraet, punkte: punkte(true, false), bemerkung: 'Pads fehlen', ergebnis: 'nicht_bestanden', wer, jetzt, ids, buch: true })
  r.push(eq('nicht bestanden mit Gerätebuch: Sperre, Eintrag, Defekt, Protokoll (Anker), Prüfstand', [arten(nichtBuch), anker(nichtBuch)],
    [['operational', 'buch:gesperrt', 'mpg_defects', 'mpg_inspections', 'last_inspection+last_inspection_passed+next_inspection_due'], { collection: 'mpg_inspections', id: 'p1' }]))
  r.push(eq('nicht bestanden: Eintrag trägt die ID der Prüfung (genau einmal beim erneuten Senden)', [nichtBuch[1].id, nichtBuch[1].body.bezug], ['p1', 'p1']))
  r.push(eq('bestanden mit Gerätebuch: kein Eintrag', plan('bestanden').length, planePruefung({ geraet, punkte: punkte(true, true), bemerkung: '', ergebnis: 'bestanden', wer, jetzt, ids, buch: true }).length))
  const defBuch = planeDefekt({ geraet, beschreibung: 'Display flackert', schwere: 'high', sperren: true, wer, id: 'x', buch: true })
  r.push(eq('Defekt mit Sperre und Gerätebuch: Anker bleibt der Defekt', [arten(defBuch), anker(defBuch), defBuch[1].id], [['operational', 'buch:gesperrt', 'mpg_defects'], { collection: 'mpg_defects', id: 'x' }, 'x']))
  r.push(eq('Defekt ohne Sperre: kein Eintrag', arten(planeDefekt({ geraet, beschreibung: 'Kratzer', schwere: 'low', sperren: false, wer, id: 'x', buch: true })), ['mpg_defects']))
  const bestBuch = planeBestaetigung({ meldung, anmerkung: '', sperren: true, geraetDa: true, wer, defektId: 'm1', buch: true })
  r.push(eq('Bestätigen mit Sperre und Gerätebuch: Status der Meldung bleibt zuletzt', arten(bestBuch), ['mpg_defects', 'operational', 'buch:gesperrt', 'mpg_defect_reports']))
  r.push(eq('Bestätigen ohne Gerät: kein Eintrag', arten(planeBestaetigung({ meldung, anmerkung: '', sperren: true, geraetDa: false, wer, defektId: 'm1', buch: true })), ['mpg_defects', 'mpg_defect_reports']))

  const aus = planeAusserBetrieb({ geraet: g1, datum: '2026-10-20', grund: ' Sturzschaden ', verbleib: ' verschrottet ', wer, id: 'e4', buch: true })
  r.push(eq('außer Betrieb nehmen: Gerät zuerst (und gesperrt), dann das Gerätebuch', [arten(aus), aus[0].body],
    [['ausser_betrieb+ausser_betrieb_grund+verbleib+operational', 'buch:ausser_betrieb'], { ausser_betrieb: '2026-10-20', ausser_betrieb_grund: 'Sturzschaden', verbleib: 'verschrottet', operational: false }]))
  r.push(eq('außer Betrieb: Text im Gerätebuch', aus[1].body.text, 'Sturzschaden\nVerbleib: verschrottet\nAußer Betrieb seit 20.10.2026'))
  r.push(eq('außer Betrieb ohne Verbleib', ausserBetriebText({ datum: '2026-10-20', grund: 'Ersetzt', verbleib: ' ' }), 'Ersetzt\nAußer Betrieb seit 20.10.2026'))
  const wieder = planeWiederInBetrieb({ geraet: g1, bemerkung: 'irrtümlich', wer, id: 'e5', buch: true })
  r.push(eq('wieder in Betrieb: Gerätebuch zuerst, kommt gesperrt zurück (auch wenn inzwischen freigegeben)', [arten(wieder), wieder[1].body.operational], [['buch:wieder_in_betrieb', 'ausser_betrieb+ausser_betrieb_grund+verbleib+operational'], false]))
  r.push(eq('Vermerk zu einer Prüfung (Korrektur)', planeVermerk({ geraet: g1, text: ' Datum war falsch ', bezug: 'p7', wer, id: 'e6' }).map(a => [a.collection, a.id, a.body.art, a.body.text, a.body.bezug]), [['mpg_ereignisse', 'e6', 'vermerk', 'Datum war falsch', 'p7']]))
  const loe = planeLoeschen({ geraet: g1, wer, id: 'e7', buch: true })
  r.push(eq('Löschen: Gerät weg, Gerätebuch hält es fest (Anker)', [loe.map(a => `${a.collection}:${a.aktion}`), anker(loe)], [['mpg_devices:delete', 'mpg_ereignisse:create'], { collection: 'mpg_ereignisse', id: 'e7' }]))

  // ── Stammdaten im Gerätebuch ──
  const stamm: Stammdaten = { name: 'Defi RTW 1', type: 'AED', serial_number: 'SN1', location: 'RTW 1', interval: 'monthly', has_stk: true, last_stk: '2025-03-10', stk_interval_months: 24, has_mtk: false, last_mtk: '', mtk_interval_months: 24 }
  r.push(eq('Stammdaten lesbar', stammdatenText(stamm).map(f => f.wert), ['Defi RTW 1', 'AED', 'SN1', 'RTW 1', 'Monatlich', 'alle 24 Monate · zuletzt 10.03.2025', 'nicht erforderlich']))
  r.push(eq('Stammdaten aus PocketBase (Datum mit Uhrzeit, leere Felder)', stammdatenText({ name: 'X', last_stk: '2025-03-10 00:00:00.000Z', has_stk: true, stk_interval_months: 0, serial_number: null }).map(f => f.wert),
    ['X', '—', '—', '—', 'Monatlich', 'alle 24 Monate · zuletzt 10.03.2025', 'nicht erforderlich']))
  r.push(eq('Änderung: nur was man sieht, alt → neu', stammdatenAenderungen({ ...stamm, last_stk: '2025-03-10 00:00:00.000Z' }, { ...stamm, location: 'RTW 2', interval: 'weekly' }),
    [{ feld: 'location', name: 'Standort', alt: 'RTW 1', neu: 'RTW 2' }, { feld: 'interval', name: 'Prüfintervall', alt: 'Monatlich', neu: 'Wöchentlich' }]))
  r.push(eq('Änderung: Leerzeichen und Datumsform sind keine Änderung', stammdatenAenderungen({ ...stamm, name: 'Defi RTW 1 ', last_stk: '2025-03-10 00:00:00.000Z' }, stamm), []))
  r.push(eq('Änderung: STK-Monate bei abgeschalteter STK zählen nicht', stammdatenAenderungen({ ...stamm, has_stk: false }, { ...stamm, has_stk: false, stk_interval_months: 12 }), []))
  const daten = { ...stamm, next_inspection_due: '2026-11-01 21:59:59.999Z' }
  r.push(eq('Ändern ohne Änderung: nichts zu schreiben', planeGeraetAenderung({ id: 'g1', alt: stamm, daten, wer, ereignisId: 'e8', buch: true }), []))
  const aend = planeGeraetAenderung({ id: 'g1', alt: stamm, daten: { ...daten, serial_number: 'SN2' }, wer, ereignisId: 'e8', buch: true })
  r.push(eq('Ändern: Gerät, dann Gerätebuch mit alt → neu', [arten(aend).length, aend[1].body.art, aend[1].body.aenderungen], [2, 'geaendert', [{ feld: 'serial_number', name: 'Seriennummer', alt: 'SN1', neu: 'SN2' }]]))
  const neuG = planeNeuesGeraet({ id: 'g9', daten, wer, ereignisId: 'e9', buch: true })
  r.push(eq('Neues Gerät: ID vom Gerät, einsatzbereit markiert, im Gerätebuch angelegt (Anker)',
    [neuG[0].id, neuG[0].aktion, neuG[0].body.operational, neuG[0].body.organization_id, anker(neuG), (neuG[1].body.aenderungen as unknown[]).length],
    ['g9', 'create', true, 'org', { collection: 'mpg_ereignisse', id: 'e9' }, 7]))
  // ── Prüfvorlage (vorher: nur „Sonstiges“ angepasst → jeder AED mit der allgemeinen Liste) ──
  const STD = { AED: ['Elektroden', 'Akku', 'Selbsttest'], Sonstiges: ['Sichtprüfung'] }
  const quelle = (typ: string, eigene: { device_type: string; items?: string[] | null }[]) => { const v = vorlageWaehlen(typ, eigene, STD); return [v.quelle, v.punkte.length] }
  r.push(eq('Vorlage: eigene des Typs', quelle('AED', [{ device_type: 'AED', items: ['a'] }]), ['eigen', 1]))
  r.push(eq('Vorlage: nur „Sonstiges“ angepasst → AED behält seine Standardliste', quelle('AED', [{ device_type: 'Sonstiges', items: ['x', 'y', 'z', 'w', 'v'] }]), ['standard', 3]))
  r.push(eq('Vorlage: Typ ohne Standardliste → eigene „Sonstiges“', quelle('Beatmungsgerät', [{ device_type: 'Sonstiges', items: ['x', 'y'] }]), ['sonstiges', 2]))
  r.push(eq('Vorlage: Typ ohne alles → allgemeine Standardliste', quelle('Beatmungsgerät', []), ['allgemein', 1]))
  r.push(eq('Vorlage: leere eigene Vorlage zählt nicht', quelle('AED', [{ device_type: 'AED', items: [] }]), ['standard', 3]))
  r.push(eq('Neues Gerät ohne Gerätebuch: Anker ist das Gerät', anker(planeNeuesGeraet({ id: 'g9', daten, wer, ereignisId: 'e9', buch: false })), { collection: 'mpg_devices', id: 'g9' }))

  return r
}
