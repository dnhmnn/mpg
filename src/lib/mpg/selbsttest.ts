// Selbsttest des MPG-Rechenkerns: Fristen, Gerätezustand, Prüfergebnis, Schreibpläne.
// An diesen Rechnungen hängt, ob ein Gerät als einsatzbereit gilt — deshalb Prüffälle.
// Läuft in der CI (src/lib/__tests__/mpg.test.ts) und ist in der App aufrufbar.
// Alle Fälle rechnen mit festen Tagen und Ortszeit-Zeitpunkten, unabhängig von heute.

import {
  fristenVon, faelligFeld, intervallVon, kalendertag, lageVon, lageText, monateVon, mtkAbweichend, mtkJahre, naechsteMtk, naechstePruefung,
  naechsteStk, plusMonate, stkAbweichend, stkMonate, tageZwischen, VORWARNUNG,
} from './fristen'
import { bleibtGesperrt, defektAusKontrolle, istAusserBetrieb, kontrolleNichtBestanden, pruefungNichtBestanden, zustandVon, zaehleStufen } from './zustand'
import { ergebnisVon, moeglicheErgebnisse, restInOrdnung, setzePunkt, vorlageWaehlen, MANGEL_VERMERK, type PunktStatus, type Pruefpunkt } from './pruefung'
import {
  anker, ausserBetriebText, planeAusserBetrieb, planeBeheben, planeBestaetigung, planeDefekt, planeFreigabe, planeGeraetAenderung,
  planeLoeschen, planeNeuesGeraet, planePruefung, planeSperre, planeVermerk, planeWiederInBetrieb, restNachAnker, stammdatenAenderungen,
  stammdatenText, type Stammdaten,
} from './aktionen'
import { kontrolleText, mitDefektFallback, neuesteKontrollen, plakettenText, planeKontrolle, typLegtNahe, vorschlagFuer, type KontrollAngaben } from './kontrollen'

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
  r.push(eq('MTK mit Ablauf des Jahres (10.03.2024 + 2 Jahre)', naechsteMtk('2024-03-10', 24), '2026-12-31'))
  r.push(eq('MTK am 31.12. und am 01.01.: ein Jahr Unterschied', [naechsteMtk('2024-12-31', 24), naechsteMtk('2025-01-01', 24)], ['2026-12-31', '2027-12-31']))
  r.push(eq('MTK jährlich (Infrarot-Thermometer)', naechsteMtk('2025-11-05', 12), '2026-12-31'))
  r.push(eq('MTK: angebrochene Jahre zählen nicht, im Zweifel früher (18 → 1, 13 → 1, 25 → 2, 6 → 1)', [mtkJahre(18), mtkJahre(13), mtkJahre(25), mtkJahre(6)], [1, 1, 2, 1]))
  r.push(eq('MTK höchstens 2 Jahre, auch wenn mehr eingetragen ist (36, 60, 120 Monate)', [mtkJahre(36), mtkJahre(60), naechsteMtk('2022-07-01', 60), naechsteMtk('2018-04-01', 120)], [2, 2, '2024-12-31', '2020-12-31']))
  r.push(eq('Abweichend eingetragen: STK 36, MTK 18 und 60 — 24, 12, leer und 0 nicht', [stkAbweichend(36), mtkAbweichend(18), mtkAbweichend(60), stkAbweichend(24), mtkAbweichend(12), stkAbweichend(null), mtkAbweichend(0)], [true, true, true, false, false, false, false]))
  r.push(eq('STK höchstens 24 Monate, auch wenn mehr eingetragen ist', [stkMonate(36), naechsteStk('2024-03-10', 36)], [24, '2026-03-31']))
  r.push(eq('STK kürzer, wenn der Betreiber es festlegt (12 Monate)', naechsteStk('2024-03-10', 12), '2025-03-31'))
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
  const ohneDatum = zustandVon({ ...geprueft, has_stk: true }, [], [], HEUTE)
  r.push(eq('STK verlangt, weder Datum noch Inbetriebnahme: Handlungsbedarf', [ohneDatum.stufe, ohneDatum.gruende[0].text], ['handlung', 'STK: Datum fehlt']))
  r.push(eq('STK überfällig: gesperrt (Entscheidung des Betreibers)', zustandVon({ ...geprueft, has_stk: true, last_stk: '2024-09-05', stk_interval_months: 24 }, [], [], HEUTE).stufe, 'gesperrt'))
  r.push(eq('MTK überfällig: gesperrt', zustandVon({ ...geprueft, has_mtk: true, last_mtk: '2023-05-01', mtk_interval_months: 24 }, [], [], HEUTE).gruende[0], { stufe: 'gesperrt', text: 'MTK überfällig seit 290 Tagen' }))
  r.push(eq('MTK bis 31.12. dieses Jahres: in Ordnung (vorher taggenau schon überfällig)', zustandVon({ ...geprueft, has_mtk: true, last_mtk: '2024-05-01', mtk_interval_months: 24 }, [], [], HEUTE).stufe, 'ok'))
  const stkErste = fristenVon({ ...geprueft, has_stk: true, inbetriebnahme: '2025-07-15' }, HEUTE).find(f => f.art === 'stk')
  r.push(eq('Erste STK ab Inbetriebnahme (15.07.2025 → 31.07.2027)', [stkErste?.naechste, stkErste?.abInbetriebnahme], ['2027-07-31', true]))
  const mtkFrist = (x: Record<string, unknown>) => fristenVon({ ...geprueft, has_mtk: true, mtk_interval_months: 12, inbetriebnahme: '2025-11-05', ...x }, HEUTE).find(f => f.art === 'mtk')?.naechste
  r.push(eq('Erste MTK ab Inbetriebnahme, danach ab der letzten', [mtkFrist({}), mtkFrist({ last_mtk: '2026-02-01' })], ['2026-12-31', '2027-12-31']))
  r.push(eq('STK in 14 Tagen fällig: bald (Zeit zum Planen)', zustandVon({ ...geprueft, has_stk: true, last_stk: '2024-10-02', stk_interval_months: 24 }, [], [], HEUTE).stufe, 'bald'))
  // Grenzen der Entscheidung: 30 Tage Vorwarnung, am Fälligkeitstag Handlungsbedarf, ab dem Tag danach gesperrt
  const stkAm = (heute: string) => { const z = zustandVon({ ...geprueft, last_inspection: um(2026, 9, 30), interval: 'yearly', has_stk: true, last_stk: '2024-10-15', stk_interval_months: 24 }, [], [], heute); return [z.stufe, z.gruende[0]?.text ?? ''] }
  r.push(eq('STK fällig 31.10.2026: am 30.09. in Ordnung, am 01.10. bald, am 31.10. heute, am 01.11. gesperrt',
    [stkAm('2026-09-30'), stkAm('2026-10-01'), stkAm('2026-10-31'), stkAm('2026-11-01')],
    [['ok', ''], ['bald', 'STK fällig in 30 Tagen (31.10.2026)'], ['handlung', 'STK heute fällig'], ['gesperrt', 'STK überfällig seit gestern']]))
  const mtkAm = (heute: string) => zustandVon({ ...geprueft, last_inspection: um(2026, 11, 30), interval: 'yearly', has_mtk: true, last_mtk: '2024-05-01', mtk_interval_months: 24 }, [], [], heute).stufe
  r.push(eq('MTK fällig 31.12.2026: am 30.11. in Ordnung, am 01.12. bald, am 31.12. heute, am 01.01. gesperrt',
    [mtkAm('2026-11-30'), mtkAm('2026-12-01'), mtkAm('2026-12-31'), mtkAm('2027-01-01')], ['ok', 'bald', 'handlung', 'gesperrt']))
  const stkNach = (x: Record<string, unknown>) => fristenVon({ ...geprueft, has_stk: true, stk_interval_months: 24, ...x }, HEUTE).find(f => f.art === 'stk')?.naechste
  r.push(eq('STK zählt ab der letzten STK, nicht ab der Inbetriebnahme (davor oder danach)',
    [stkNach({ inbetriebnahme: '2019-01-01', last_stk: '2025-10-10' }), stkNach({ inbetriebnahme: '2026-01-01', last_stk: '2025-10-10' })], ['2027-10-31', '2027-10-31']))
  r.push(eq('STK/MTK ohne Häkchen zählen nicht', [zustandVon({ ...geprueft, has_stk: false, last_stk: '2020-01-01' }, [], [], HEUTE).stufe, zustandVon({ ...geprueft, has_mtk: false, last_mtk: '2020-01-01' }, [], [], HEUTE).stufe], ['ok', 'ok']))
  r.push(eq('MTK ohne eingetragene Frist: alle 2 Jahre', fristenVon({ ...geprueft, has_mtk: true, last_mtk: '2025-03-01' }, HEUTE).find(f => f.art === 'mtk')?.naechste, '2027-12-31'))
  // Ein Datum in der Zukunft (Tippfehler im Jahr) gibt nichts frei
  const zukunft = zustandVon({ ...geprueft, has_stk: true, last_stk: '2062-09-05' }, [], [], HEUTE)
  r.push(eq('Letzte STK in der Zukunft: zählt nicht, Handlungsbedarf mit Grund', [zukunft.stufe, zukunft.gruende[0].text, zukunft.fristen[1].naechste], ['handlung', 'STK: eingetragenes Datum liegt in der Zukunft — bitte prüfen', null]))
  const zukunftMitInbetrieb = zustandVon({ ...geprueft, has_stk: true, last_stk: '2062-09-05', inbetriebnahme: '2019-01-01' }, [], [], HEUTE)
  r.push(eq('… mit Inbetriebnahme: Frist ab der Inbetriebnahme — überfällig, gesperrt', [zukunftMitInbetrieb.stufe, zukunftMitInbetrieb.gruende.map(g => g.text)], ['gesperrt', ['STK überfällig seit 2085 Tagen', 'STK: eingetragenes Datum liegt in der Zukunft — bitte prüfen']]))
  r.push(eq('Inbetriebnahme in der Zukunft: zählt nicht', zustandVon({ ...geprueft, has_mtk: true, inbetriebnahme: '2027-05-01' }, [], [], HEUTE).gruende[0].text, 'MTK: eingetragenes Datum liegt in der Zukunft — bitte prüfen'))
  // Nicht bestandene STK/MTK sperrt, bis eine bestandene eingetragen ist (Entscheidung des Betreibers, 23.10.2026)
  const mitKontrolle = { ...geprueft, has_stk: true, last_stk: '2025-03-01', stk_interval_months: 24 }
  const durchgefallen = zustandVon({ ...mitKontrolle, kontrollen: { stk: { datum: '2026-10-01', bestanden: false } } }, [], [], HEUTE)
  r.push(eq('Letzte STK nicht bestanden: gesperrt, auch nach Freigabe und behobenem Defekt', [durchgefallen.stufe, durchgefallen.gruende[0].text], ['gesperrt', 'Letzte STK nicht bestanden']))
  r.push(eq('… danach bestanden (neueres Datum am Gerät): frei', zustandVon({ ...mitKontrolle, last_stk: '2026-10-10', kontrollen: { stk: { datum: '2026-10-01', bestanden: false } } }, [], [], HEUTE).stufe, 'ok'))
  r.push(eq('… am selben Tag erst bestanden, dann nicht: gesperrt', kontrolleNichtBestanden({ ...mitKontrolle, last_stk: '2026-10-01', kontrollen: { stk: { datum: '2026-10-01', bestanden: false } } }, 'stk', HEUTE), true))
  r.push(eq('… nachgetragen, älter als die letzte bestandene: zählt nicht', kontrolleNichtBestanden({ ...mitKontrolle, kontrollen: { stk: { datum: '2024-06-01', bestanden: false } } }, 'stk', HEUTE), false))
  r.push(eq('… erste Kontrolle nicht bestanden (noch kein Datum am Gerät): gesperrt', kontrolleNichtBestanden({ has_mtk: true, kontrollen: { mtk: { datum: '2026-10-01', bestanden: false } } }, 'mtk', HEUTE), true))
  r.push(eq('… Datum am Gerät in der Zukunft (Tippfehler) hebt sie nicht auf', kontrolleNichtBestanden({ ...mitKontrolle, last_stk: '2062-03-10', kontrollen: { stk: { datum: '2026-10-15', bestanden: false } } }, 'stk', HEUTE), true))
  r.push(eq('… am selben Tag wie die letzte bestandene: sperrt', kontrolleNichtBestanden({ ...mitKontrolle, last_stk: '2026-10-15', kontrollen: { stk: { datum: '2026-10-15', bestanden: false } } }, 'stk', HEUTE), true))
  r.push(eq('Fallback: Defekt aus nicht bestandener Kontrolle erkennen', [defektAusKontrolle('STK nicht bestanden: Ableitstrom'), defektAusKontrolle('MTK nicht bestanden: 8 mmHg'), defektAusKontrolle('STK mit Mängeln: x'), defektAusKontrolle('Display')], ['stk', 'mtk', null, null]))
  r.push(eq('STK von heute zählt (nicht als Zukunft)', fristenVon({ ...geprueft, has_stk: true, last_stk: HEUTE }, HEUTE).find(f => f.art === 'stk')?.letzte, HEUTE))
  r.push(eq('… ohne Häkchen: zählt nicht', kontrolleNichtBestanden({ has_stk: false, kontrollen: { stk: { datum: '2026-10-01', bestanden: false } } }, 'stk', HEUTE), false))
  r.push(eq('Folgezustand: Freigabe hebt eine überfällige STK nicht auf',
    bleibtGesperrt({ ...geprueft, operational: false, has_stk: true, last_stk: '2024-09-05', stk_interval_months: 24 }, [], [], HEUTE, { operational: true }).map(g => g.text), ['STK überfällig seit 17 Tagen']))
  r.push(eq('Folgezustand: nur die Sperre → nach Freigabe nichts mehr', bleibtGesperrt({ ...geprueft, operational: false }, [], [], HEUTE, { operational: true }), []))
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
  const stamm: Stammdaten = { name: 'Defi RTW 1', type: 'AED', serial_number: 'SN1', location: 'RTW 1', interval: 'monthly', has_stk: true, last_stk: '2025-03-10', stk_interval_months: 24, has_mtk: false, last_mtk: '', mtk_interval_months: 24, inbetriebnahme: '' }
  r.push(eq('Stammdaten lesbar', stammdatenText(stamm).map(f => f.wert), ['Defi RTW 1', 'AED', 'SN1', 'RTW 1', 'Monatlich', 'alle 24 Monate · zuletzt 10.03.2025', 'nicht erforderlich', '—']))
  r.push(eq('Stammdaten: MTK in Jahren, STK höchstens 24 Monate (abweichend eingetragen steht dabei), Inbetriebnahme', stammdatenText({ ...stamm, stk_interval_months: 36, has_mtk: true, mtk_interval_months: 12, last_mtk: '2025-05-01', inbetriebnahme: '2023-01-15' }).slice(5).map(f => f.wert),
    ['alle 24 Monate (eingetragen: 36 Monate) · zuletzt 10.03.2025', 'jährlich · zuletzt 01.05.2025', '15.01.2023']))
  r.push(eq('Stammdaten aus PocketBase (Datum mit Uhrzeit, leere Felder)', stammdatenText({ name: 'X', last_stk: '2025-03-10 00:00:00.000Z', has_stk: true, stk_interval_months: 0, serial_number: null }).map(f => f.wert),
    ['X', '—', '—', '—', 'Monatlich', 'alle 24 Monate · zuletzt 10.03.2025', 'nicht erforderlich', '—']))
  r.push(eq('Änderung: nur was man sieht, alt → neu', stammdatenAenderungen({ ...stamm, last_stk: '2025-03-10 00:00:00.000Z' }, { ...stamm, location: 'RTW 2', interval: 'weekly' }),
    [{ feld: 'location', name: 'Standort', alt: 'RTW 1', neu: 'RTW 2' }, { feld: 'interval', name: 'Prüfintervall', alt: 'Monatlich', neu: 'Wöchentlich' }]))
  r.push(eq('Änderung: Leerzeichen und Datumsform sind keine Änderung', stammdatenAenderungen({ ...stamm, name: 'Defi RTW 1 ', last_stk: '2025-03-10 00:00:00.000Z' }, stamm), []))
  r.push(eq('Änderung: STK-Monate bei abgeschalteter STK zählen nicht', stammdatenAenderungen({ ...stamm, has_stk: false }, { ...stamm, has_stk: false, stk_interval_months: 12 }), []))
  const daten = { ...stamm, next_inspection_due: '2026-11-01 21:59:59.999Z' }
  r.push(eq('Ändern ohne Änderung: nichts zu schreiben', planeGeraetAenderung({ id: 'g1', alt: stamm, daten, wer, ereignisId: 'e8', buch: true }), []))
  const aend = planeGeraetAenderung({ id: 'g1', alt: stamm, daten: { ...daten, serial_number: 'SN2' }, wer, ereignisId: 'e8', buch: true })
  r.push(eq('Ändern: Gerät, dann Gerätebuch mit alt → neu', [arten(aend).length, aend[1].body.art, aend[1].body.aenderungen], [2, 'geaendert', [{ feld: 'serial_number', name: 'Seriennummer', alt: 'SN1', neu: 'SN2' }]]))
  r.push(eq('Ändern: nur geänderte Felder gehen an den Server', aend[0].body, { serial_number: 'SN2' }))
  // Inzwischen trug jemand eine STK ein (Server 22.10.2026); das Formular war mit dem alten Stand offen
  const server = { ...stamm, last_stk: '2026-10-22 00:00:00.000Z' }
  const nurOrt = planeGeraetAenderung({ id: 'g1', alt: server, ausgang: stamm, daten: { ...daten, location: 'RTW 2' }, wer, ereignisId: 'e8', buch: true })
  r.push(eq('Ändern mit altem Formular: die neuere STK bleibt, nur der Standort geht raus', [nurOrt[0].body, nurOrt[1].body.aenderungen], [{ location: 'RTW 2' }, [{ feld: 'location', name: 'Standort', alt: 'RTW 1', neu: 'RTW 2' }]]))
  r.push(eq('Ändern: Altwert STK 36 bleibt, solange niemand die Monate anfasst', planeGeraetAenderung({ id: 'g1', alt: { ...stamm, stk_interval_months: 36 }, ausgang: { ...stamm, stk_interval_months: 36 }, daten: { ...daten, stk_interval_months: 36, location: 'RTW 2' }, wer, ereignisId: 'e8', buch: false })[0].body, { location: 'RTW 2' }))
  r.push(eq('Ändern: Intervall als Liste gespeichert ist keine Änderung', planeGeraetAenderung({ id: 'g1', alt: { ...stamm, interval: ['monthly'] as unknown as string }, daten, wer, ereignisId: 'e8', buch: true }), []))
  const neuerTakt = planeGeraetAenderung({ id: 'g1', alt: stamm, daten: { ...daten, interval: 'weekly' }, wer, ereignisId: 'e8', buch: true })
  r.push(eq('Ändern: neues Prüfintervall bringt die Fälligkeit mit', Object.keys(neuerTakt[0].body).sort(), ['interval', 'next_inspection_due']))
  r.push(eq('Ändern: Datum hinter abgeschaltetem Häkchen geht nicht mit', planeGeraetAenderung({ id: 'g1', alt: { ...stamm, has_stk: false }, daten: { ...daten, has_stk: false, last_stk: '2026-10-17' }, wer, ereignisId: 'e8', buch: true }), []))
  r.push(eq('Ändern: STK 24 → 12 Monate geht raus', planeGeraetAenderung({ id: 'g1', alt: stamm, daten: { ...daten, stk_interval_months: 12 }, wer, ereignisId: 'e8', buch: false })[0].body, { stk_interval_months: 12 }))
  const ohneStk = planeGeraetAenderung({ id: 'g1', alt: stamm, daten: { ...daten, has_stk: false }, wer, ereignisId: 'e8', buch: true, begruendung: 'Laien-AED, Ausnahme bestätigt durch Aufsicht' })
  r.push(eq('Ändern mit Begründung: steht im Gerätebuch', [ohneStk[0].body, ohneStk[1].body.text], [{ has_stk: false }, 'Laien-AED, Ausnahme bestätigt durch Aufsicht']))
  const neuG = planeNeuesGeraet({ id: 'g9', daten, wer, ereignisId: 'e9', buch: true })
  r.push(eq('Neues Gerät: ID vom Gerät, einsatzbereit markiert, im Gerätebuch angelegt (Anker)',
    [neuG[0].id, neuG[0].aktion, neuG[0].body.operational, neuG[0].body.organization_id, anker(neuG), (neuG[1].body.aenderungen as unknown[]).length],
    ['g9', 'create', true, 'org', { collection: 'mpg_ereignisse', id: 'e9' }, 8]))
  // ── Prüfvorlage (vorher: nur „Sonstiges“ angepasst → jeder AED mit der allgemeinen Liste) ──
  const STD = { AED: ['Elektroden', 'Akku', 'Selbsttest'], Sonstiges: ['Sichtprüfung'] }
  const quelle = (typ: string, eigene: { device_type: string; items?: string[] | null }[]) => { const v = vorlageWaehlen(typ, eigene, STD); return [v.quelle, v.punkte.length] }
  r.push(eq('Vorlage: eigene des Typs', quelle('AED', [{ device_type: 'AED', items: ['a'] }]), ['eigen', 1]))
  r.push(eq('Vorlage: nur „Sonstiges“ angepasst → AED behält seine Standardliste', quelle('AED', [{ device_type: 'Sonstiges', items: ['x', 'y', 'z', 'w', 'v'] }]), ['standard', 3]))
  r.push(eq('Vorlage: Typ ohne Standardliste → eigene „Sonstiges“', quelle('Beatmungsgerät', [{ device_type: 'Sonstiges', items: ['x', 'y'] }]), ['sonstiges', 2]))
  r.push(eq('Vorlage: Typ ohne alles → allgemeine Standardliste', quelle('Beatmungsgerät', []), ['allgemein', 1]))
  r.push(eq('Vorlage: leere eigene Vorlage zählt nicht', quelle('AED', [{ device_type: 'AED', items: [] }]), ['standard', 3]))
  // ── STK und MTK eintragen ──
  const kontrolle = (x: Partial<KontrollAngaben> = {}): Omit<KontrollAngaben, 'naechste'> => ({ art: 'stk', datum: '2026-10-15', ergebnis: 'bestanden', pruefer: ' M. Muster ', firma: ' Medtech GmbH ', protokoll: ' 4711 ', plakette: true, ausserplanmaessig: false, maengel: '', ...x })
  const kg = { id: 'g1', name: 'Defi RTW 1', stk_interval_months: 24, mtk_interval_months: 24 }
  const kids = { ereignis: 'k1', defekt: 'kd1' }
  const kArten = (pl: { collection: string; body: Record<string, unknown> }[]) => pl.map(a => a.collection === 'mpg_ereignisse' ? `buch:${a.body.art}` : a.collection === 'mpg_devices' ? Object.keys(a.body).join('+') : `${a.collection}:${a.body.severity}`)
  const kb = planeKontrolle({ geraet: kg, angaben: kontrolle(), bisher: '2024-10-10', wer, ids: kids })
  r.push(eq('STK bestanden: Eintrag (Anker), dann das neue Datum', [kArten(kb), anker(kb), kb[1].body], [['buch:stk', 'last_stk'], { collection: 'mpg_ereignisse', id: 'k1' }, { last_stk: '2026-10-15' }]))
  r.push(eq('STK bestanden: Angaben im Gerätebuch, nächste Fälligkeit mit Ablauf des Monats', [(kb[0].body.angaben as KontrollAngaben).naechste, (kb[0].body.angaben as KontrollAngaben).firma, (kb[0].body.angaben as KontrollAngaben).pruefer], ['2028-10-31', 'Medtech GmbH', 'M. Muster']))
  r.push(eq('STK: Zeile im Gerätebuch', kb[0].body.text, 'STK bestanden am 15.10.2026 · Medtech GmbH (M. Muster) · Protokoll 4711'))
  const km = planeKontrolle({ geraet: kg, angaben: kontrolle({ art: 'mtk', ergebnis: 'maengel', maengel: 'Manschette undicht' }), bisher: null, wer, ids: kids })
  r.push(eq('MTK mit Mängeln: Defekt „mittel“, Eintrag, Datum (bis 31.12. in 2 Jahren)', [kArten(km), (km[1].body.angaben as KontrollAngaben).naechste, km[0].body.description], [['mpg_defects:medium', 'buch:mtk', 'last_mtk'], '2028-12-31', 'MTK mit Mängeln: Manschette undicht']))
  const kn = planeKontrolle({ geraet: kg, angaben: kontrolle({ ergebnis: 'nicht_bestanden', maengel: 'Ableitstrom zu hoch' }), bisher: '2024-10-10', wer, ids: kids })
  r.push(eq('STK nicht bestanden: Sperre zuerst, Defekt „hoch“, Eintrag — Datum bleibt beim letzten bestandenen', [kArten(kn), kn[2].body.bezug, (kn[2].body.angaben as KontrollAngaben).naechste], [['operational', 'mpg_defects:high', 'buch:stk'], 'kd1', null]))
  const kAlt = planeKontrolle({ geraet: kg, angaben: kontrolle({ datum: '2024-01-10' }), bisher: '2024-10-10', wer, ids: kids })
  r.push(eq('Nachgetragene ältere STK überschreibt keine neuere — und nennt keine Frist, die nicht gilt',
    [kArten(kAlt), (kAlt[0].body.angaben as KontrollAngaben).naechste, (kAlt[0].body.angaben as KontrollAngaben).nachgetragen, String(kAlt[0].body.text).split('\n')[1]],
    [['buch:stk'], null, true, 'Nachgetragen — die Frist richtet sich nach der STK vom 10.10.2024']))
  const kAltNicht = planeKontrolle({ geraet: kg, angaben: kontrolle({ datum: '2024-01-10', ergebnis: 'nicht_bestanden', maengel: 'Ableitstrom' }), bisher: '2024-10-10', wer, ids: kids })
  r.push(eq('Nachgetragene ältere „nicht bestanden“: nur ins Gerätebuch — keine Sperre, kein Defekt', [kArten(kAltNicht), kAltNicht[0].body.bezug], [['buch:stk'], '']))
  r.push(eq('„Nicht bestanden“ am selben Tag wie die letzte bestandene: Sperre, Defekt, Eintrag', kArten(planeKontrolle({ geraet: kg, angaben: kontrolle({ datum: '2026-10-15', ergebnis: 'nicht_bestanden', maengel: 'x' }), bisher: '2026-10-15', wer, ids: kids })), ['operational', 'mpg_defects:high', 'buch:stk']))
  const kZukunft = (ergebnis: 'bestanden' | 'nicht_bestanden') => planeKontrolle({ geraet: kg, angaben: kontrolle({ datum: '2026-10-15', ergebnis, maengel: 'x' }), bisher: '2062-03-10', heute: '2026-10-17', wer, ids: kids })
  r.push(eq('Bisheriges Datum in der Zukunft zählt nicht: „nicht bestanden“ sperrt, „bestanden“ ersetzt es', [kArten(kZukunft('nicht_bestanden')), kArten(kZukunft('bestanden')), String(kZukunft('bestanden')[0].body.text).includes('Nachgetragen')],
    [['operational', 'mpg_defects:high', 'buch:stk'], ['buch:stk', 'last_stk'], false]))
  // Das Blatt behält Eingaben beim Umschalten des Ergebnisses — der Plan nimmt nur, was dazu gehört
  const kUm = planeKontrolle({ geraet: kg, angaben: kontrolle({ ergebnis: 'bestanden', maengel: 'Schutzleiter grenzwertig' }), bisher: null, wer, ids: kids })
  r.push(eq('Bestanden nach Umschalten: keine Mängel in Zeile und Angaben', [kUm[0].body.text, (kUm[0].body.angaben as KontrollAngaben).maengel], ['STK bestanden am 15.10.2026 · Medtech GmbH (M. Muster) · Protokoll 4711', '']))
  r.push(eq('Nicht bestanden: keine Prüfplakette', (kn[2].body.angaben as KontrollAngaben).plakette, false))
  r.push(eq('STK: nie außerplanmäßig (nur MTK)', (planeKontrolle({ geraet: kg, angaben: kontrolle({ ausserplanmaessig: true }), bisher: null, wer, ids: kids })[0].body.angaben as KontrollAngaben).ausserplanmaessig, false))
  r.push(eq('Gleicher Tag wie die letzte: das Datum am Gerät bleibt', kArten(planeKontrolle({ geraet: kg, angaben: kontrolle(), bisher: '2026-10-15', wer, ids: kids })), ['buch:stk']))
  r.push(eq('Zeile: nur Person, außerplanmäßig, Mängel in eigener Zeile', kontrolleText({ ...kontrolle({ art: 'mtk', firma: '', protokoll: '', ausserplanmaessig: true, ergebnis: 'maengel', maengel: 'leicht' }) }), 'MTK mit Mängeln bestanden am 15.10.2026 (außerplanmäßig) · M. Muster\nleicht'))
  r.push(eq('Prüfplakette: STK Monat/Jahr, MTK Jahr', [plakettenText('stk', '2028-10-31'), plakettenText('mtk', '2028-12-31')], ['10/2028', '2028']))
  r.push(eq('Typ legt nahe: Defibrillator STK (MTK nur mit NIBP — Frage), Blutdruck MTK, Sonstiges nichts', [typLegtNahe('Defibrillator'), typLegtNahe('Blutdruckmessgerät'), typLegtNahe('Sonstiges'), !!vorschlagFuer('Defibrillator')?.mtkFrage],
    [{ stk: true, mtk: false }, { stk: false, mtk: true }, { stk: false, mtk: false }, true]))
  // Stand der Kontrollen aus dem Gerätebuch: nach Tag der Kontrolle, nicht nach Eintragszeit
  const kStand = neuesteKontrollen([
    { device_id: 'g', art: 'stk', created: '2026-10-20 08:00:00.000Z', angaben: { datum: '2026-10-01', ergebnis: 'nicht_bestanden' } },
    { device_id: 'g', art: 'stk', created: '2026-10-21 08:00:00.000Z', angaben: { datum: '2024-05-01', ergebnis: 'bestanden' } },
    { device_id: 'g', art: 'mtk', created: '2026-10-21 08:00:00.000Z', text: 'MTK nicht bestanden am 20.10.2026', angaben: null },
    { device_id: 'h', art: 'vermerk', created: '2026-10-21 08:00:00.000Z' },
  ], '2026-10-31')
  r.push(eq('Neueste Kontrollen: später nachgetragene ältere verdrängt die neuere nicht; ohne Angaben zählt die Zeile', [kStand.get('g'), kStand.has('h')],
    [{ stk: { datum: '2026-10-01', bestanden: false, eingetragen: '2026-10-20 08:00:00.000Z' }, mtk: { datum: '2026-10-21', bestanden: false, eingetragen: '2026-10-21 08:00:00.000Z' } }, false]))
  const gleicherTag = (erst: string, dann: string) => neuesteKontrollen([
    { device_id: 'g', art: 'stk', created: '2026-10-20 08:00:00.000Z', angaben: { datum: '2026-10-20', ergebnis: erst } },
    { device_id: 'g', art: 'stk', created: '2026-10-20 09:00:00.000Z', angaben: { datum: '2026-10-20', ergebnis: dann } },
  ], '2026-10-31').get('g')?.stk?.bestanden
  r.push(eq('Am selben Tag gilt die später eingetragene (in beiden Reihenfolgen)', [gleicherTag('nicht_bestanden', 'bestanden'), gleicherTag('bestanden', 'nicht_bestanden')], [true, false]))
  r.push(eq('Nicht bestanden am 01.10., bestanden am 15.10. (später eingetragen): bestanden', neuesteKontrollen([
    { device_id: 'g', art: 'stk', created: '2026-10-16 08:00:00.000Z', angaben: { datum: '2026-10-15', ergebnis: 'bestanden' } },
    { device_id: 'g', art: 'stk', created: '2026-10-02 08:00:00.000Z', angaben: { datum: '2026-10-01', ergebnis: 'nicht_bestanden' } },
  ], '2026-10-31').get('g')?.stk, { datum: '2026-10-15', bestanden: true, eingetragen: '2026-10-16 08:00:00.000Z' }))
  r.push(eq('„Mit Mängeln“ zählt als bestanden; Tag in der Zukunft zählt nicht', [
    neuesteKontrollen([{ device_id: 'g', art: 'mtk', created: '2026-10-02 08:00:00.000Z', angaben: { datum: '2026-10-01', ergebnis: 'maengel' } }], '2026-10-31').get('g')?.mtk?.bestanden,
    neuesteKontrollen([{ device_id: 'g', art: 'mtk', created: '2026-10-02 08:00:00.000Z', angaben: { datum: '2062-10-01', ergebnis: 'bestanden' } }], '2026-10-17').get('g')?.mtk?.datum,
  ], [true, '2026-10-02']))
  r.push(eq('Tag der Kontrolle nur als JJJJ-MM-TT (sonst Tag des Eintrags)', ['23.10.2026', '02062-10-01', ' 2026-10-01 '].map(datum =>
    neuesteKontrollen([{ device_id: 'g', art: 'stk', created: '2026-10-05 08:00:00.000Z', angaben: { datum, ergebnis: 'bestanden' } }], '2026-10-31').get('g')?.stk?.datum), ['2026-10-05', '2026-10-05', '2026-10-01']))
  // Fehlt der Eintrag einer nicht bestandenen (abgelehnt, verworfen), zählt ihr Defekt
  const ohneEintrag = (stk: { datum: string; bestanden: boolean; eingetragen?: string } | undefined, eintraege: { device_id: string; art: string; created: string; bezug?: string }[] = []) =>
    mitDefektFallback(new Map(stk ? [['g', { stk }]] : []), [{ id: 'dx', device_id: 'g', description: 'STK nicht bestanden: Ableitstrom', created: '2026-10-10 08:00:00.000Z' }], eintraege).get('g')?.stk?.bestanden
  r.push(eq('Defekt aus nicht bestandener STK ohne Eintrag: zählt (ohne Kontrolle, nach älterer bestandener) — nicht nach neuerer bestandener, nicht mit eigenem Eintrag',
    [ohneEintrag(undefined), ohneEintrag({ datum: '2026-03-01', bestanden: true }), ohneEintrag({ datum: '2026-10-12', bestanden: true }), ohneEintrag(undefined, [{ device_id: 'g', art: 'stk', created: '2026-10-10 08:00:00.000Z', bezug: 'dx' }])],
    [false, false, true, undefined]))
  r.push(eq('Vorschläge: AED STK 24, Blutdruck MTK 2 Jahre, Thermometer jährlich, Absaugung nichts, unbekannt nichts',
    [vorschlagFuer('AED')?.stk, vorschlagFuer('AED')?.mtk, vorschlagFuer('Blutdruckmessgerät')?.mtk, vorschlagFuer('Thermometer')?.mtk, vorschlagFuer('Absaugpumpe')?.stk, vorschlagFuer('Absaugpumpe')?.mtk, vorschlagFuer('Eigenbau')],
    [24, null, 24, 12, null, null, null]))
  r.push(eq('Neues Gerät ohne Gerätebuch: Anker ist das Gerät', anker(planeNeuesGeraet({ id: 'g9', daten, wer, ereignisId: 'e9', buch: false })), { collection: 'mpg_devices', id: 'g9' }))

  return r
}
