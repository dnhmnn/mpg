// Prüffälle des Hygiene-Rechenkerns: Fälligkeit, Checklisten, Vorschläge aus MPG und Lager, Pläne.
// Angebunden an vitest in src/lib/__tests__/hygiene.test.ts (Europe/Berlin und UTC).

import { anker, restNachAnker } from '../mpg/aktionen'
import { einsatzNummerBereinigen, objektPruefen, planeArchiv, planeDurchfuehrung, planeObjektAenderung, planeObjekte, planeUebertragen, planeVorlage, vorlageIdGueltig, vorlagePruefen } from './aktionen'
import { checklisteVorschlag, punkteBereinigen, STD_VORLAGEN, uebertragen, vorlageFuer } from './checklisten'
import { intervallText, istFaellig, naechsteFaelligkeit, standText, standVon, tageVon, vollstaendig, zaehle } from './fristen'
import { darfHygiene, darfHygieneVerwalten } from './rechte'
import { istMehrweg, namensSchluessel, ortArt, satzTeilen, vorschlaegeVon, type Quellen } from './vorschlaege'
import type { HyDurchfuehrung, HyObjekt } from './typen'
import type { User } from '../../types'

export interface TestErgebnis { name: string; ok: boolean; erwartet: string; erhalten: string }

function eq(name: string, erhalten: unknown, erwartet: unknown): TestErgebnis {
  const e = JSON.stringify(erwartet), h = JSON.stringify(erhalten)
  return { name, ok: e === h, erwartet: e, erhalten: h }
}

/** Zeitpunkt nach Ortszeit als ISO-Text, wie ihn PocketBase liefert. */
const um = (j: number, m: number, t: number, h = 8, min = 0) => new Date(j, m - 1, t, h, min).toISOString().replace('T', ' ')

const obj = (x: Partial<HyObjekt> = {}): HyObjekt => ({
  id: 'o1', organization_id: 'org', name: 'RTW 83/1', art: 'fahrzeug', standort: '', intervall: 'woechentlich', intervall_tage: 0,
  punkte: ['Trage', 'Boden'], quelle: '', quelle_id: '', quelle_name: '', vorlage_id: '', archiviert: '', ...x,
})
let n = 0
const df = (zeit: string, x: Partial<HyDurchfuehrung> = {}): HyDurchfuehrung => ({
  id: `d${++n}`, organization_id: 'org', objekt_id: 'o1', objekt_name: 'RTW 83/1', art: 'plan', anlass: '', einsatz_nummer: '',
  punkte: [{ text: 'Trage', erledigt: true }, { text: 'Boden', erledigt: true }], offen: 0, bemerkung: '', zeitpunkt: zeit, ...x,
})
const mangel = (zeit: string) => df(zeit, { punkte: [{ text: 'Trage', erledigt: true }, { text: 'Boden', erledigt: false }], offen: 1 })

export function laufeHygieneSelbsttest(): TestErgebnis[] {
  const r: TestErgebnis[] = []
  const HEUTE = '2026-11-23'
  const lage = (o: HyObjekt, d: HyDurchfuehrung[]) => standVon(o, d, HEUTE).lage

  // ── Fälligkeit ──
  r.push(eq('wöchentlich: vor 7 Tagen gemacht → heute fällig', lage(obj(), [df(um(2026, 11, 16))]), 'heute'))
  r.push(eq('wöchentlich: vor 8 Tagen → überfällig seit gestern', standText(standVon(obj(), [df(um(2026, 11, 15))], HEUTE)), 'überfällig seit gestern'))
  r.push(eq('wöchentlich: vor 6 Tagen → morgen fällig (Vorwarnung 1 Tag)', [lage(obj(), [df(um(2026, 11, 17))]), standText(standVon(obj(), [df(um(2026, 11, 17))], HEUTE))], ['bald', 'morgen fällig']))
  r.push(eq('wöchentlich: heute gemacht → in Ordnung, fällig am 30.11.', [lage(obj(), [df(um(2026, 11, 23))]), standText(standVon(obj(), [df(um(2026, 11, 23))], HEUTE))], ['ok', 'fällig am 30.11.2026']))
  r.push(eq('täglich: gestern gemacht → heute fällig, vorgestern → überfällig', [lage(obj({ intervall: 'taeglich' }), [df(um(2026, 11, 22))]), lage(obj({ intervall: 'taeglich' }), [df(um(2026, 11, 21))])], ['heute', 'ueberfaellig']))
  r.push(eq('täglich: heute gemacht → in Ordnung (keine Vorwarnung)', lage(obj({ intervall: 'taeglich' }), [df(um(2026, 11, 23, 0, 5))]), 'ok'))
  r.push(eq('alle 14 Tage: nach 11 Tagen bald, nach 10 Tagen in Ordnung', [lage(obj({ intervall: 'tage', intervall_tage: 14 }), [df(um(2026, 11, 12))]), lage(obj({ intervall: 'tage', intervall_tage: 14 }), [df(um(2026, 11, 13))])], ['bald', 'ok']))
  r.push(eq('monatlich: 31.10. → fällig 30.11. (Monatsende)', standVon(obj({ intervall: 'monatlich' }), [df(um(2026, 10, 31))], HEUTE).faellig, '2026-11-30'))
  r.push(eq('nach jeder Benutzung: nie fällig, auch ohne Durchführung', [lage(obj({ intervall: 'benutzung' }), []), lage(obj({ intervall: 'benutzung' }), [df(um(2025, 1, 1))])], ['benutzung', 'benutzung']))
  r.push(eq('noch nie durchgeführt → offen und zählt als fällig', [lage(obj(), []), istFaellig('offen')], ['offen', true]))
  r.push(eq('unvollständige Durchführung setzt die Frist nicht neu', lage(obj(), [df(um(2026, 11, 10)), mangel(um(2026, 11, 22))]), 'ueberfaellig'))
  const mitMangel = standVon(obj(), [df(um(2026, 11, 10)), mangel(um(2026, 11, 22))], HEUTE)
  r.push(eq('unvollständige wird als neuere Durchführung mit Mängeln gemeldet', [mitMangel.unvollstaendig?.offen, mitMangel.letzte?.zeitpunkt], [1, um(2026, 11, 10)]))
  r.push(eq('ältere unvollständige vor einer vollständigen wird nicht gemeldet', standVon(obj(), [mangel(um(2026, 11, 10)), df(um(2026, 11, 20))], HEUTE).unvollstaendig, null))
  r.push(eq('nur unvollständige → noch nie vollständig (offen)', lage(obj(), [mangel(um(2026, 11, 22))]), 'offen'))
  r.push(eq('Durchführung aus Anlass zählt wie nach Plan', lage(obj(), [df(um(2026, 11, 10)), df(um(2026, 11, 22), { art: 'anlass', anlass: 'infektion' })]), 'ok'))
  r.push(eq('Durchführung mit Tag nach heute zählt nicht', lage(obj(), [df(um(2026, 11, 24))]), 'offen'))
  r.push(eq('fremde Objekte zählen nicht', lage(obj(), [df(um(2026, 11, 22), { objekt_id: 'o2' })]), 'offen'))
  r.push(eq('neueste vollständige zählt, unabhängig von der Reihenfolge', standVon(obj(), [df(um(2026, 11, 22)), df(um(2026, 11, 1)), df(um(2026, 11, 15))], HEUTE).faellig, '2026-11-29'))
  r.push(eq('kurz nach Mitternacht zählt der neue Tag', standVon(obj({ intervall: 'taeglich' }), [df(um(2026, 11, 23, 0, 1))], HEUTE).faellig, '2026-11-24'))
  r.push(eq('vollständig: offen 0 und alle erledigt; offen fehlt, Punkt offen → nicht', [vollstaendig({ offen: 0, punkte: [] }), vollstaendig({ offen: 0, punkte: [{ text: 'a', erledigt: false }] }), vollstaendig({ offen: 2, punkte: [] })], [true, false, false]))
  r.push(eq('alle N Tage: unsinnige Zahl → 7', [tageVon(0), tageVon(400), tageVon('x'), tageVon(3)], [7, 7, 7, 3]))
  r.push(eq('nächste Fälligkeit je Intervall', ['taeglich', 'woechentlich', 'monatlich', 'benutzung'].map(i => naechsteFaelligkeit('2026-01-31', i as HyObjekt['intervall'])), ['2026-02-01', '2026-02-07', '2026-02-28', null]))
  r.push(eq('Intervall als Text', [intervallText('tage', 14), intervallText('tage', 1), intervallText('benutzung'), intervallText('woechentlich')], ['alle 14 Tage', 'täglich', 'nach jeder Benutzung', 'wöchentlich']))
  r.push(eq('Zählung für den Kopf', zaehle(['ueberfaellig', 'offen', 'heute', 'bald', 'ok', 'benutzung', 'ueberfaellig']), { ueberfaellig: 2, faellig: 2, ok: 3 }))

  // ── Checklisten ──
  r.push(eq('Punkte säubern: Leerzeichen, leere und doppelte weg', punkteBereinigen(['  Trage ', '', 'trage', 'Boden  wischen', null]), ['Trage', 'Boden wischen']))
  r.push(eq('Punkte: höchstens 40, je höchstens 200 Zeichen', [punkteBereinigen(Array.from({ length: 50 }, (_, i) => `P${i}`)).length, punkteBereinigen(['x'.repeat(300)])[0].length], [40, 200]))
  r.push(eq('Punkte: kein Array → leer', punkteBereinigen('Trage'), []))
  r.push(eq('Checkliste Absaugpumpe beginnt mit dem Sekretbehälter', checklisteVorschlag('geraet', 'Absaugpumpe')[0], 'Sekretbehälter geleert, gereinigt und desinfiziert'))
  r.push(eq('Checkliste Gerät ohne bekannten Typ: allgemein', checklisteVorschlag('geraet', 'Sonstiges')[0], 'Gehäuse und Bedienfeld abgewischt'))

  // ── Vorschläge ──
  r.push(eq('Orte einordnen', ['RTW 83/1', 'HLF 20/1', 'NEF', 'Fahrzeughalle', 'Gerätehaus', 'Desinfektionsraum', 'Schrank 3', 'Florian Musterstadt 1/83/1'].map(ortArt),
    ['fahrzeug', 'fahrzeug', 'fahrzeug', 'fahrzeug', 'raum', 'raum', null, 'fahrzeug']))
  r.push(eq('Namen vergleichen: RTW 1 = rtw-1 = RTW1', [namensSchluessel('RTW 1'), namensSchluessel('rtw-1'), namensSchluessel('RTW1')], ['rtw1', 'rtw1', 'rtw1']))
  r.push(eq('Sollausstattung teilen', [satzTeilen('RTW 1 – Notfallrucksack'), satzTeilen('Notfallrucksack')], [{ vorne: 'RTW 1', hinten: 'Notfallrucksack' }, { vorne: '', hinten: 'Notfallrucksack' }]))
  r.push(eq('Mehrweg: Beatmungsmaske ja, Einmalbeutel und Maske nein', ['Beatmungsmaske Gr. 4', 'Urinbeutel', 'FFP2-Maske'].map(istMehrweg), [true, false, false]))
  r.push(eq('Mehrweg erkennen', ['Blutdruckmanschette Erwachsene', 'Stethoskop', 'Einmal-Blutdruckmanschette', 'Beatmungsbeutel Erwachsene', 'Einmalhandschuhe M', 'Vakuummatratze', 'Mullkompresse'].map(istMehrweg),
    [true, true, false, true, false, true, false]))
  const q: Quellen = {
    geraete: [
      { id: 'g1', name: 'Defibrillator RTW 83/1', type: 'Defibrillator', location: 'RTW 83/1' },
      { id: 'g2', name: 'Absaugpumpe HLF 20/1', type: 'Absaugpumpe', location: 'HLF 20/1' },
      { id: 'g3', name: 'AED Wache', type: 'AED', location: 'Schrank 3' },
    ],
    orte: [{ id: 'l1', name: 'RTW 83/1' }, { id: 'l2', name: 'Gerätehaus' }],
    saetze: [{ id: 's1', name: 'RTW 83/1 – Notfallrucksack' }, { id: 's2', name: 'RTW 83/1' }],
    artikel: [{ id: 'a1', name: 'Blutdruckmanschette Erwachsene' }, { id: 'a2', name: 'Einmalhandschuhe M' }],
  }
  const vs = vorschlaegeVon(q, [])
  r.push(eq('Vorschläge: Orte, Standorte, Rucksack, Geräte (Absaugung zuerst), Mehrweg', vs.map(v => `${v.art}:${v.name}`), [
    'raum:Gerätehaus', 'fahrzeug:RTW 83/1', 'fahrzeug:HLF 20/1', 'rucksack:RTW 83/1 – Notfallrucksack',
    'geraet:Absaugpumpe HLF 20/1', 'geraet:AED Wache', 'geraet:Defibrillator RTW 83/1', 'material:Blutdruckmanschette Erwachsene',
  ]))
  r.push(eq('Vorschlag Lager-Ort trägt die Kennung, MPG-Standort nicht', [vs[1].quelle, vs[1].quelle_id, vs[2].quelle, vs[2].quelle_id], ['lager_ort', 'l1', '', '']))
  r.push(eq('Vorschlag Rucksack: Standort aus dem Namen', vs[3].standort, 'RTW 83/1'))
  r.push(eq('Vorschlag Gerät: Standort, Herkunft und Checkliste zum Typ', [vs[4].standort, vs[4].herkunft, vs[4].punkte[0]], ['HLF 20/1', 'MPG · Absaugpumpe', 'Sekretbehälter geleert, gereinigt und desinfiziert']))
  r.push(eq('Vorschläge ohne Vorhandenes (gleiche Quelle oder gleicher Name, auch anders geschrieben)',
    vorschlaegeVon(q, [{ name: 'rtw 83-1', quelle: '', quelle_id: '' }, { name: 'Pumpe', quelle: 'mpg_geraet', quelle_id: 'g2' }]).map(v => v.name),
    ['Gerätehaus', 'HLF 20/1', 'RTW 83/1 – Notfallrucksack', 'AED Wache', 'Defibrillator RTW 83/1', 'Blutdruckmanschette Erwachsene']))
  r.push(eq('ausgeblendete Vorschläge kommen nicht wieder', vorschlaegeVon(q, [], ['lager_ort:l2', 'lager_artikel:a1']).map(v => v.name).includes('Gerätehaus'), false))
  r.push(eq('Vorschläge haben eindeutige Schlüssel', new Set(vs.map(v => v.schluessel)).size, vs.length))
  const zwei: Quellen = { geraete: [{ id: 'x1', name: 'Absaugpumpe Accuvac', type: 'Absaugpumpe', location: 'RTW 1' }, { id: 'x2', name: 'Absaugpumpe Accuvac', type: 'Absaugpumpe', location: 'RTW 2' }], orte: [], saetze: [], artikel: [] }
  r.push(eq('gleich benannte Geräte: beide, mit Standort im Namen', vorschlaegeVon(zwei, []).filter(v => v.art === 'geraet').map(v => v.name), ['Absaugpumpe Accuvac (RTW 1)', 'Absaugpumpe Accuvac (RTW 2)']))
  r.push(eq('gleich benannte Geräte: das zweite bleibt nach Übernahme des ersten', vorschlaegeVon(zwei, [{ name: 'Absaugpumpe Accuvac (RTW 1)', quelle: 'mpg_geraet', quelle_id: 'x1' }]).filter(v => v.art === 'geraet').map(v => v.quelle_id), ['x2']))

  // ── Pläne ──
  const wer = { organization_id: 'org', name: 'Lena Berger' }
  const gut = objektPruefen({ name: '  RTW  83/1 ', art: 'fahrzeug', intervall: 'tage', intervall_tage: 14, punkte: [' Trage ', 'trage'], standort: ' Wache ' })
  r.push(eq('Objekt prüfen: säubert Name, Standort und Punkte', gut, { ok: true, daten: { name: 'RTW 83/1', art: 'fahrzeug', intervall: 'tage', punkte: ['Trage'], vorlage_id: '', standort: 'Wache', intervall_tage: 14, quelle: '', quelle_id: '', quelle_name: '' } }))
  r.push(eq('Objekt prüfen: ungültige Tage werden gemeldet, nicht still ersetzt', [400, 0, 3.5, NaN].map(t => objektPruefen({ name: 'x', art: 'raum', intervall: 'tage', intervall_tage: t, punkte: ['a'] }).ok), [false, false, false, false]))
  r.push(eq('Objekt prüfen: mehr als 40 Punkte werden gemeldet, nicht abgeschnitten', objektPruefen({ name: 'x', art: 'raum', intervall: 'monatlich', punkte: Array.from({ length: 41 }, (_, i) => `P${i}`) }).ok, false))
  r.push(eq('Objekt prüfen: Fehler ohne Namen, Art, Intervall oder Punkte', [
    objektPruefen({ name: ' ', art: 'raum', intervall: 'monatlich', punkte: ['a'] }).ok,
    objektPruefen({ name: 'x', art: 'boot' as HyObjekt['art'], intervall: 'monatlich', punkte: ['a'] }).ok,
    objektPruefen({ name: 'x', art: 'raum', intervall: 'jaehrlich' as HyObjekt['intervall'], punkte: ['a'] }).ok,
    objektPruefen({ name: 'x', art: 'raum', intervall: 'monatlich', punkte: [' '] }).ok,
  ], [false, false, false, false]))
  r.push(eq('Objekt prüfen: Intervall ohne „Tage“ speichert 0 Tage', (objektPruefen({ name: 'x', art: 'raum', intervall: 'monatlich', intervall_tage: 9, punkte: ['a'] }) as { daten: { intervall_tage: number } }).daten.intervall_tage, 0))
  const anlegen = planeObjekte({ neu: [{ id: 'n1', daten: (gut as { daten: Parameters<typeof planeObjektAenderung>[0]['daten'] }).daten }], wer })
  r.push(eq('Objekt anlegen: mit Organisation, nicht archiviert, Anker ist das Objekt', [anlegen[0].body.organization_id, anlegen[0].body.archiviert, anker(anlegen)], ['org', '', { collection: 'hygiene_objekte', id: 'n1' }]))
  r.push(eq('Objekt ändern: Herkunft bleibt unberührt', Object.keys(planeObjektAenderung({ id: 'o1', daten: { ...(gut as { daten: Parameters<typeof planeObjektAenderung>[0]['daten'] }).daten, quelle: 'mpg_geraet', quelle_id: 'x', quelle_name: 'y' } })[0].body).sort(),
    ['art', 'intervall', 'intervall_tage', 'name', 'punkte', 'standort', 'vorlage_id']))
  r.push(eq('Archivieren und zurückholen', [planeArchiv({ id: 'o1', seit: '2026-11-23 10:00:00.000Z' })[0].body, planeArchiv({ id: 'o1', seit: '' })[0].body], [{ archiviert: '2026-11-23 10:00:00.000Z' }, { archiviert: '' }]))
  const plan = planeDurchfuehrung({ id: 'h1', objekt: { id: 'o1', name: 'RTW 83/1' }, art: 'anlass', anlass: 'infektion', einsatzNummer: ' E-2026-0417 ', punkte: [{ text: 'Trage', erledigt: true }, { text: 'Boden', erledigt: false }, { text: ' ', erledigt: true }], bemerkung: ' ok ', zeitpunkt: '2026-11-23 10:00:00.000Z', wer })
  r.push(eq('Durchführung aus Anlass: Anlass, Nummer, offen gezählt, leere Punkte weg', [plan[0].body.anlass, plan[0].body.einsatz_nummer, plan[0].body.offen, (plan[0].body.punkte as unknown[]).length, plan[0].body.bemerkung], ['infektion', 'E-2026-0417', 1, 2, 'ok']))
  r.push(eq('Durchführung ist ihr eigener Anker (nichts danach)', [anker(plan), restNachAnker(plan)], [{ collection: 'hygiene_durchfuehrungen', id: 'h1' }, []]))
  const nachPlan = planeDurchfuehrung({ id: 'h2', objekt: { id: 'o1', name: 'RTW 83/1' }, art: 'plan', anlass: 'infektion', einsatzNummer: 'E-1', punkte: [], bemerkung: '', zeitpunkt: 'x', wer })
  r.push(eq('Durchführung nach Plan: kein Anlass, keine Einsatznummer', [nachPlan[0].body.anlass, nachPlan[0].body.einsatz_nummer], ['', '']))
  r.push(eq('Durchführung aus Anlass mit unbekanntem Anlass: leer (Server lehnt ab)', planeDurchfuehrung({ id: 'h3', objekt: { id: 'o1', name: 'x' }, art: 'anlass', anlass: 'irgendwas' as HyDurchfuehrung['anlass'], einsatzNummer: '', punkte: [], bemerkung: '', zeitpunkt: 'x', wer })[0].body.anlass, ''))
  r.push(eq('Einsatznummer: höchstens 40 Zeichen', einsatzNummerBereinigen('x'.repeat(60)).length, 40))

  // ── Checklisten-Vorlagen (Owner, 26.11.2026: keine Trage im Feuerwehrauto) ──
  r.push(eq('Vorlage nach Fahrzeugname', ['RTW 83/1', 'KTW 85/2', 'HLF 20/1', 'LF 10', 'TLF 3000', 'DLK 23/12', 'MTW', 'ELW 1', 'Florian Musterstadt 1/83/1', 'Bus'].map(n => vorlageFuer('fahrzeug', n).id),
    ['std:rettungsdienst', 'std:rettungsdienst', 'std:feuerwehr', 'std:feuerwehr', 'std:feuerwehr', 'std:feuerwehr', 'std:mannschaft', 'std:mannschaft', 'std:fahrzeug', 'std:fahrzeug']))
  r.push(eq('Feuerwehrfahrzeug ohne Trage, Rettungswagen mit', [vorlageFuer('fahrzeug', 'HLF 20/1').punkte.some(p => /trage/i.test(p)), vorlageFuer('fahrzeug', 'RTW 83/1').punkte.some(p => /trage/i.test(p))], [false, true]))
  r.push(eq('Vorlage nach Raumname und Material', [vorlageFuer('raum', 'Umkleide Herren').id, vorlageFuer('raum', 'Desinfektionsraum').id, vorlageFuer('raum', 'Fahrzeughalle').id, vorlageFuer('material', 'Tragestuhl').id, vorlageFuer('material', 'Blutdruckmanschette').id, vorlageFuer('rucksack').id],
    ['std:sanitaer', 'std:desinfektionsraum', 'std:raum', 'std:transport', 'std:material', 'std:rucksack']))
  r.push(eq('Vorlagen von Responda: eindeutige Kennungen, je Art mindestens eine, jede mit Punkten', [new Set(STD_VORLAGEN.map(x => x.id)).size === STD_VORLAGEN.length, ['fahrzeug', 'raum', 'rucksack', 'geraet', 'material', 'sonstiges'].every(a => STD_VORLAGEN.some(x => x.art === a)), STD_VORLAGEN.every(x => x.punkte.length > 0 && vorlageIdGueltig(x.id))], [true, true, true]))
  const vsF = vorschlaegeVon({ geraete: [], orte: [{ id: 'f1', name: 'HLF 20/1' }, { id: 'f2', name: 'RTW 83/1' }], saetze: [], artikel: [] }, [])
  r.push(eq('Vorschläge: Fahrzeug bekommt die passende Vorlage', vsF.map(x => [x.name, x.vorlage_id, x.punkte.some(p => /trage/i.test(p))]), [['HLF 20/1', 'std:feuerwehr', false], ['RTW 83/1', 'std:rettungsdienst', true]]))
  r.push(eq('Kennung einer Vorlage', ['', 'std:feuerwehr', 'abcdefghij12345', 'std:Feuer', 'x', 'std:'].map(vorlageIdGueltig), [true, true, true, false, false, false]))
  r.push(eq('Objekt prüfen: ungültige Vorlage wird leer', (objektPruefen({ name: 'x', art: 'raum', intervall: 'monatlich', punkte: ['a'], vorlage_id: '../x' }) as { daten: { vorlage_id: string } }).daten.vorlage_id, ''))
  const objs = [
    { id: 'a', vorlage_id: 'v1', punkte: ['Sitze', 'Boden'] },
    { id: 'b', vorlage_id: 'v1', punkte: ['Sitze', 'Boden', 'Extra'] },
    { id: 'c', vorlage_id: 'v2', punkte: ['Sitze', 'Boden'] },
    { id: 'd', vorlage_id: 'v1', punkte: ['Sitze', 'Boden'], archiviert: '2026-11-01 00:00:00.000Z' },
    { id: 'e', vorlage_id: 'v1', punkte: [' sitze', 'Boden '] },
  ]
  r.push(eq('Übertragen: nur unveränderte Objekte dieser Vorlage, archivierte nie', uebertragen('v1', ['Sitze', 'Boden'], objs), { gleich: ['a'], abweichend: ['b', 'e'] }))
  r.push(eq('Übertragen: Plan ändert nur die Punkte', planeUebertragen({ objekte: ['a'], punkte: ['Sitze'] }), [{ collection: 'hygiene_objekte', aktion: 'update', id: 'a', body: { punkte: ['Sitze'] } }]))
  const vp = vorlagePruefen({ name: ' Feuerwehr ', art: 'fahrzeug', intervall: 'monatlich', punkte: ['Sitze'] })
  r.push(eq('Vorlage prüfen und anlegen', [vp.ok, planeVorlage({ id: 'v9', neu: true, daten: (vp as { daten: Parameters<typeof planeVorlage>[0]['daten'] }).daten, wer })[0].body], [true, { name: 'Feuerwehr', art: 'fahrzeug', intervall: 'monatlich', intervall_tage: 0, punkte: ['Sitze'], organization_id: 'org', archiviert: '' }]))
  r.push(eq('Vorlage ohne Punkte: Fehler', vorlagePruefen({ name: 'x', art: 'raum', intervall: 'monatlich', punkte: [] }).ok, false))

  // ── Rechte ──
  const u = (x: Partial<User>) => ({ id: 'u', email: 'probe@example.invalid', name: 'Probe', ...x }) as User
  const jetzt = new Date('2026-11-23T10:00:00Z').getTime()
  r.push(eq('Eintragen: mit Grundrecht ja, Teilnehmende nie, ohne nein', [
    darfHygiene(u({ permissions: { dashboard: true } }), jetzt), darfHygiene(u({ role: 'teilnehmer', permissions: { dashboard: true } }), jetzt), darfHygiene(u({ permissions: {} }), jetzt),
  ], [true, false, false]))
  r.push(eq('Verwalten: Leitung, Supervisor, Recht, befristet; sonst nein', [
    darfHygieneVerwalten(u({ role: 'admin', permissions: {} }), jetzt), darfHygieneVerwalten(u({ supervisor: true }), jetzt),
    darfHygieneVerwalten(u({ permissions: { hygiene_verwalten: true } }), jetzt),
    darfHygieneVerwalten(u({ permissions: {}, temp_permissions: { hygiene_verwalten: { until: '2026-11-24 10:00:00.000Z' } } }), jetzt),
    darfHygieneVerwalten(u({ permissions: {}, temp_permissions: { hygiene_verwalten: { until: '2026-11-22 10:00:00.000Z' } } }), jetzt),
    darfHygieneVerwalten(u({ permissions: { dashboard: true } }), jetzt),
  ], [true, true, true, true, false, false]))
  return r
}
