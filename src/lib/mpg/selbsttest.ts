// Selbsttest des MPG-Rechenkerns: Fristen, Gerätezustand, Prüfergebnis, Schreibpläne.
// An diesen Rechnungen hängt, ob ein Gerät als einsatzbereit gilt — deshalb Prüffälle.
// Läuft in der CI (src/lib/__tests__/mpg.test.ts) und ist in der App aufrufbar.
// Alle Fälle rechnen mit festen Tagen und Ortszeit-Zeitpunkten, unabhängig von heute.

import {
  fristenVon, faelligFeld, kalendertag, lageVon, lageText, monateVon, naechsteMtk, naechstePruefung,
  naechsteStk, plusMonate, tageZwischen, VORWARNUNG,
} from './fristen'
import { pruefungNichtBestanden, zustandVon, zaehleStufen } from './zustand'
import { ergebnisVon, moeglicheErgebnisse, restInOrdnung, setzePunkt, MANGEL_VERMERK, type PunktStatus, type Pruefpunkt } from './pruefung'
import { anker, planeBeheben, planeBestaetigung, planeDefekt, planePruefung, restNachAnker } from './aktionen'

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
  const spaet = (ergebnis: 'bestanden' | 'nicht_bestanden', serverLetzte: string) => planePruefung({ geraet, punkte: punkte(true), bemerkung: 'x', ergebnis, wer, jetzt, ids, serverLetzte })
  r.push(eq('älterer Versuch überschreibt keinen neueren Gerätestand', spaet('bestanden', '2026-02-01 10:00:00.000Z').map(a => a.collection), ['mpg_inspections']))
  r.push(eq('älterer Versuch, Anker schon da: nichts mehr zu senden', restNachAnker(spaet('bestanden', '2026-02-01 10:00:00.000Z')), []))
  r.push(eq('älterer Versuch „nicht bestanden“ sperrt trotzdem', spaet('nicht_bestanden', '2026-02-01 10:00:00.000Z').filter(a => a.collection === 'mpg_devices').map(a => a.body), [{ operational: false }]))
  r.push(eq('gleicher Zeitpunkt (Teil schon angekommen) schreibt den Gerätestand', 'last_inspection' in teil(spaet('bestanden', jetzt.toISOString().replace('T', ' ')), 'mpg_devices'), true))
  r.push(eq('ohne Serverstand wie bisher', 'last_inspection' in teil(planePruefung({ geraet, punkte: punkte(true), bemerkung: '', ergebnis: 'bestanden', wer, jetzt, ids, serverLetzte: '' }), 'mpg_devices'), true))

  r.push(eq('Defekt melden ohne Sperre', planeDefekt({ geraet, beschreibung: 'Display flackert', schwere: 'medium', sperren: false, wer, id: 'x' }).map(a => a.collection), ['mpg_defects']))
  const mitSperre = planeDefekt({ geraet, beschreibung: 'Display flackert', schwere: 'high', sperren: true, wer, id: 'x' })
  r.push(eq('Defekt melden mit Sperre: erst Sperre, Defekt als Anker zuletzt', [mitSperre[0].body, anker(mitSperre)], [{ operational: false }, { collection: 'mpg_defects', id: 'x' }]))
  r.push(eq('Beheben gibt nicht von selbst frei', planeBeheben({ defekt: { id: 'd', device_id: 'g' }, notiz: '', wer, wiederEinsatzbereit: false }).length, 1))
  r.push(eq('Beheben mit Freigabe', planeBeheben({ defekt: { id: 'd', device_id: 'g' }, notiz: '', wer, wiederEinsatzbereit: true })[1].body, { operational: true }))
  const meldung = { id: 'm1', device_id: 'g1', device_name: 'Defi', description: 'Kabel lose', severity: 'high' as const }
  const best = planeBestaetigung({ meldung, anmerkung: 'Gesehen', sperren: true, geraetDa: true, wer, defektId: 'd9' })
  r.push(eq('Bestätigen: Defekt vor der Sperre, zuletzt der Status der Meldung', best.map(a => `${a.collection}:${a.aktion}`), ['mpg_defects:create', 'mpg_devices:update', 'mpg_defect_reports:update']))
  r.push(eq('Bestätigen: Anmerkung wird gespeichert', best.find(a => a.collection === 'mpg_defects')?.body.description, 'Kabel lose\n\nAnmerkung bei Bestätigung (Anna): Gesehen'))
  r.push(eq('Bestätigen: gelöschtes Gerät wird nicht angefasst',
    planeBestaetigung({ meldung, anmerkung: '', sperren: true, geraetDa: false, wer, defektId: 'd9' }).map(a => a.collection), ['mpg_defects', 'mpg_defect_reports']))

  return r
}
