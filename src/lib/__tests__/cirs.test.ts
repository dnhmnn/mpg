import { describe, it, expect } from 'vitest'
import {
  auswerten, bearbeitungLesen, bewertungSetzen, csv, CirsFehler, fallAus, filtern, fristSetzen, fristUeberschritten,
  imZeitraum, inTagen, istUeberfaellig, massnahmeAbhaken, massnahmeHinzufuegen, massnahmeStreichen, meldungsNummer,
  notizHinzufuegen, payloadLesen, phaseSetzen, prioritaet, sortieren, speicherDaten, statusFuer, tageBisFrist,
  zaehlen, zustaendigSetzen,
  type Bearbeitung, type CirsDatensatz, type CirsFall, type Schritt,
} from '../cirs'

// Mittags Ortszeit — damit kein Test an der Tagesgrenze kippt
const HEUTE = new Date(2026, 9, 13, 12, 0, 0)

function schritt(wer = 'QM Weber', am = HEUTE): Schritt {
  let n = 0
  return { wer, am, neueId: () => `id${++n}` }
}

const MELDUNG = {
  datum: '2026-10-01', ort: 'Fahrzeughalle', kategorie: 'fahrzeug', schwere: 'mittel',
  was: 'Rettungswagen mit leerer Sauerstoffflasche übergeben.', warum: 'Checkliste nicht abgezeichnet',
  melder_name: 'Erika Muster', melder_kontakt: '0170 123456',
}

function datensatz(teil: Partial<CirsDatensatz> = {}, payload: Record<string, unknown> = MELDUNG): CirsDatensatz {
  return { id: 'abcdefgh12345xy', created: '2026-10-02 08:15:00.000Z', status: 'offen', organization_id: 'org1', payload, ...teil }
}

function mitBearbeitung(b: Partial<Bearbeitung>, teil: Partial<CirsDatensatz> = {}, meldung: Record<string, unknown> = MELDUNG): CirsFall {
  const grund = bearbeitungLesen({})
  return fallAus(datensatz(teil, { ...meldung, bearbeitung: { ...grund, ...b } }))
}

describe('CIRS: Lesen', () => {
  it('liest das payload auch als JSON-Text und übersteht Unsinn', () => {
    expect(payloadLesen('{"ort":"Wache"}')).toEqual({ ort: 'Wache' })
    expect(payloadLesen('kein json')).toEqual({})
    expect(payloadLesen(null)).toEqual({})
    expect(payloadLesen([1, 2])).toEqual({})
  })

  it('eine unbearbeitete Meldung ist neu, eine alte erledigte gilt als abgeschlossen', () => {
    expect(fallAus(datensatz()).bearbeitung.phase).toBe('neu')
    expect(fallAus(datensatz({ status: 'erledigt' })).bearbeitung.phase).toBe('abgeschlossen')
  })

  it('eine über die alte Übersicht erledigte Meldung gilt als abgeschlossen, auch mit offener Phase', () => {
    const f = fallAus(datensatz({ status: 'erledigt' }, { ...MELDUNG, bearbeitung: { ...bearbeitungLesen({}), phase: 'bewertung' } }))
    expect(f.bearbeitung.phase).toBe('abgeschlossen')
    expect(fallAus(datensatz({ status: 'erledigt' }, { ...MELDUNG, bearbeitung: { ...bearbeitungLesen({}), phase: 'kein_handlungsbedarf' } })).bearbeitung.phase).toBe('kein_handlungsbedarf')
  })

  it('verwirft kaputte Teile der Bearbeitung, statt daran zu scheitern', () => {
    const f = fallAus(datensatz({}, { ...MELDUNG, bearbeitung: {
      phase: 'quatsch', zustaendig: 'Weber', frist: 7, bewertung: { schwere: 'extrem', haeufigkeit: 'haeufig' },
      massnahmen: [{ id: 'm1', text: 'Checkliste' }, { text: 'ohne id' }, null], verlauf: 'x',
    } }))
    expect(f.bearbeitung.phase).toBe('neu')
    expect(f.bearbeitung.zustaendig).toBeNull()
    expect(f.bearbeitung.frist).toBeNull()
    expect(f.bearbeitung.bewertung).toEqual({ kategorie: undefined, schwere: undefined, haeufigkeit: 'haeufig' })
    expect(f.bearbeitung.massnahmen.map((m) => m.id)).toEqual(['m1'])
    expect(f.bearbeitung.verlauf).toEqual([])
  })

  it('trennt die Angaben des Melders von der Bearbeitung', () => {
    const f = mitBearbeitung({ phase: 'bewertung' })
    expect(f.meldung.was).toBe(MELDUNG.was)
    expect((f.meldung as Record<string, unknown>).bearbeitung).toBeUndefined()
  })

  it('vergibt die Nummer, die der Melder nach dem Absenden sieht', () => {
    expect(meldungsNummer('abcdefgh12345xy', '2026-10-02 08:15:00.000Z')).toBe('CIRS-2026-abcdefgh')
    expect(fallAus(datensatz()).nummer).toBe('CIRS-2026-abcdefgh')
  })
})

describe('CIRS: Priorität aus Schweregrad und Häufigkeit', () => {
  it('folgt der Matrix', () => {
    const erwartet: Record<string, Record<string, string>> = {
      gering: { einmalig: 'niedrig', gelegentlich: 'niedrig', haeufig: 'mittel' },
      mittel: { einmalig: 'niedrig', gelegentlich: 'mittel', haeufig: 'hoch' },
      hoch: { einmalig: 'mittel', gelegentlich: 'hoch', haeufig: 'hoch' },
    }
    for (const [s, zeile] of Object.entries(erwartet)) {
      for (const [h, p] of Object.entries(zeile)) expect(prioritaet(s as any, h as any), `${s}/${h}`).toBe(p)
    }
  })

  it('ohne Häufigkeit zählt die Meldung als einmalig, ohne Schweregrad gibt es keine Priorität', () => {
    expect(prioritaet('hoch')).toBe('mittel')
    expect(prioritaet(undefined, 'haeufig')).toBeNull()
  })
})

describe('CIRS: Fristen', () => {
  it('am Fristtag ist die Frist noch nicht überschritten, am Tag danach schon', () => {
    expect(fristUeberschritten('2026-10-13', HEUTE)).toBe(false)
    expect(fristUeberschritten('2026-10-12', HEUTE)).toBe(true)
    expect(fristUeberschritten(null, HEUTE)).toBe(false)
    expect(fristUeberschritten('13.10.2026', HEUTE)).toBe(false)
  })

  it('zählt Tage bis zur Frist auch über einen Monatswechsel', () => {
    expect(tageBisFrist('2026-10-13', HEUTE)).toBe(0)
    expect(tageBisFrist('2026-11-02', HEUTE)).toBe(20)
    expect(tageBisFrist('2026-10-10', HEUTE)).toBe(-3)
    expect(inTagen(HEUTE, 19)).toBe('2026-11-01')
  })

  it('überfällig ist die Meldung oder eine offene Maßnahme — Abgeschlossenes nie', () => {
    expect(istUeberfaellig(mitBearbeitung({ phase: 'bewertung', frist: '2026-10-12' }), HEUTE)).toBe(true)
    const massnahme = { id: 'm1', text: 'Checkliste', frist: '2026-10-01', angelegtAm: '', angelegtVon: '' }
    expect(istUeberfaellig(mitBearbeitung({ phase: 'massnahmen', massnahmen: [massnahme] }), HEUTE)).toBe(true)
    expect(istUeberfaellig(mitBearbeitung({ phase: 'massnahmen', massnahmen: [{ ...massnahme, erledigtAm: '2026-10-05T10:00:00Z' }] }), HEUTE)).toBe(false)
    expect(istUeberfaellig(mitBearbeitung({ phase: 'abgeschlossen', frist: '2026-10-01' }), HEUTE)).toBe(false)
  })
})

describe('CIRS: Bearbeitungsschritte', () => {
  const neu = () => bearbeitungLesen({})

  it('Abschließen verlangt einen Vermerk und hält ihn fest', () => {
    expect(() => phaseSetzen(neu(), 'abgeschlossen', schritt())).toThrow(CirsFehler)
    expect(() => phaseSetzen(neu(), 'kein_handlungsbedarf', schritt(), '   ')).toThrow(CirsFehler)
    const b = phaseSetzen(neu(), 'abgeschlossen', schritt(), 'Checkliste um O2-Druck ergänzt')
    expect(b.phase).toBe('abgeschlossen')
    expect(b.abschluss).toEqual({ am: HEUTE.toISOString(), von: 'QM Weber', text: 'Checkliste um O2-Druck ergänzt' })
    expect(b.verlauf.map((e) => e.art)).toEqual(['phase', 'abschluss'])
    expect(statusFuer(b.phase)).toBe('erledigt')
  })

  it('Wiederöffnen steht im Verlauf; das alte Ergebnis gilt nicht mehr, bleibt aber im Verlauf lesbar', () => {
    const zu = phaseSetzen(neu(), 'kein_handlungsbedarf', schritt(), 'Einzelfall')
    const auf = phaseSetzen(zu, 'bewertung', schritt('QM Huber'))
    expect(auf.phase).toBe('bewertung')
    expect(statusFuer(auf.phase)).toBe('offen')
    expect(auf.verlauf.slice(-1)[0]).toMatchObject({ art: 'notiz', text: 'Wieder geöffnet', von: 'QM Huber' })
    expect(auf.abschluss).toBeNull()
    expect(auf.verlauf.some((e) => e.art === 'abschluss' && e.text === 'Einzelfall')).toBe(true)
  })

  it('eine wieder geöffnete Meldung hat in der CSV kein Ergebnis und kein Abschlussdatum', () => {
    const auf = phaseSetzen(phaseSetzen(neu(), 'abgeschlossen', schritt(), 'Alter Vermerk'), 'bewertung', schritt())
    const f = fallAus(datensatz({}, { ...MELDUNG, bearbeitung: auf }))
    const zeile = csv([f], HEUTE).split('\r\n')[1]
    expect(zeile).not.toContain('Alter Vermerk')
  })

  it('dieselbe Phase noch einmal ändert nichts', () => {
    const b = neu()
    expect(phaseSetzen(b, 'neu', schritt())).toBe(b)
  })

  it('wer eine neue Meldung zuweist, terminiert oder bewertet, hat sie in Bewertung genommen', () => {
    const z = zustaendigSetzen(neu(), { id: 'u1', name: 'Anna Berger' }, schritt())
    expect(z.phase).toBe('bewertung')
    expect(z.verlauf.map((e) => e.text)).toEqual(['Phase: In Bewertung', 'Zuständig: Anna Berger'])
    expect(fristSetzen(neu(), '2026-10-20', schritt()).phase).toBe('bewertung')
    expect(bewertungSetzen(neu(), { schwere: 'hoch' }, schritt()).phase).toBe('bewertung')
    expect(notizHinzufuegen(neu(), 'Rücksprache mit Wachleitung', schritt()).phase).toBe('bewertung')
  })

  it('weist keine ungültige Frist zu und lässt Gleiches unverändert', () => {
    expect(() => fristSetzen(neu(), '20.10.2026', schritt())).toThrow(CirsFehler)
    // Zwischenstände beim Tippen in ein Datumsfeld: Jahr 0002, 30. Februar
    expect(() => fristSetzen(neu(), '0002-10-20', schritt())).toThrow(CirsFehler)
    expect(() => fristSetzen(neu(), '2026-02-30', schritt())).toThrow(CirsFehler)
    expect(() => massnahmeHinzufuegen(neu(), { text: 'x', frist: '0020-01-01' }, schritt())).toThrow(CirsFehler)
    const b = fristSetzen(neu(), '2026-10-20', schritt())
    expect(fristSetzen(b, '2026-10-20', schritt())).toBe(b)
    expect(fristSetzen(b, null, schritt()).frist).toBeNull()
  })

  it('eine Maßnahme bringt die Meldung in die Phase "Maßnahmen laufen"', () => {
    const b = massnahmeHinzufuegen(neu(), { text: ' O2-Druck in Checkliste ', verantwortlich: 'Wachleitung', frist: '2026-10-30' }, schritt())
    expect(b.phase).toBe('massnahmen')
    expect(b.massnahmen).toHaveLength(1)
    expect(b.massnahmen[0]).toMatchObject({ text: 'O2-Druck in Checkliste', verantwortlich: 'Wachleitung', frist: '2026-10-30', angelegtVon: 'QM Weber' })
    expect(() => massnahmeHinzufuegen(neu(), { text: '  ' }, schritt())).toThrow(CirsFehler)
  })

  it('eine Maßnahme lässt eine geschlossene Meldung geschlossen', () => {
    const zu = phaseSetzen(neu(), 'abgeschlossen', schritt(), 'erledigt')
    expect(massnahmeHinzufuegen(zu, { text: 'Nachschulung' }, schritt()).phase).toBe('abgeschlossen')
  })

  it('abhaken, wieder öffnen, streichen', () => {
    let b = massnahmeHinzufuegen(neu(), { text: 'Checkliste' }, schritt())
    const mid = b.massnahmen[0].id
    b = massnahmeAbhaken(b, mid, true, schritt('A. Berger'))
    expect(b.massnahmen[0]).toMatchObject({ erledigtVon: 'A. Berger', erledigtAm: HEUTE.toISOString() })
    expect(() => massnahmeStreichen(b, mid, schritt())).toThrow(CirsFehler)
    b = massnahmeAbhaken(b, mid, false, schritt())
    expect(b.massnahmen[0].erledigtAm).toBeUndefined()
    b = massnahmeStreichen(b, mid, schritt())
    expect(b.massnahmen).toHaveLength(0)
    expect(b.verlauf.slice(-1)[0]?.text).toBe('Maßnahme gestrichen: Checkliste')
  })

  it('jeder Schritt steht mit Name und Zeit im Verlauf', () => {
    const b = notizHinzufuegen(phaseSetzen(neu(), 'bewertung', schritt()), 'Rücksprache erfolgt', schritt('QM Huber'))
    expect(b.verlauf.slice(-1)[0]).toEqual({ id: 'id1', am: HEUTE.toISOString(), von: 'QM Huber', art: 'notiz', text: 'Rücksprache erfolgt' })
  })
})

describe('CIRS: Schutz vor erfundener Bearbeitung', () => {
  const erfunden = { ...bearbeitungLesen({}), phase: 'kein_handlungsbedarf', abschluss: { am: '2026-10-02T08:15:00.000Z', von: 'QM Weber', text: 'Einzelfall' },
    verlauf: [{ id: 'v1', am: '2026-10-02T08:15:00.000Z', von: 'QM Weber', art: 'abschluss', text: 'Einzelfall' }] }

  it('eine schon beim Anlegen mitgeschickte Bearbeitung zählt nicht', () => {
    const f = fallAus(datensatz({ created: '2026-10-02 08:15:00.000Z', updated: '2026-10-02 08:15:00.120Z' }, { ...MELDUNG, bearbeitung: erfunden }))
    expect(f.bearbeitung.phase).toBe('neu')
    expect(f.bearbeitung.verlauf).toEqual([])
    expect(f.bearbeitung.abschluss).toBeNull()
  })

  it('ohne bekannten Änderungszeitpunkt gilt die Bearbeitung — Abfragen müssen updated mitladen', () => {
    // Darum lädt der Hub-Hinweis 'updated' mit; ohne es greift dieser Schutz nicht
    const f = fallAus(datensatz({ created: '2026-10-02 08:15:00.000Z', updated: undefined }, { ...MELDUNG, bearbeitung: erfunden }))
    expect(f.bearbeitung.phase).toBe('kein_handlungsbedarf')
  })

  it('eine später gespeicherte Bearbeitung zählt', () => {
    const f = fallAus(datensatz({ created: '2026-10-02 08:15:00.000Z', updated: '2026-10-03 09:00:00.000Z' }, { ...MELDUNG, bearbeitung: erfunden }))
    expect(f.bearbeitung.phase).toBe('kein_handlungsbedarf')
  })

  it('Felder vom falschen Typ bringen nichts durcheinander', () => {
    const b = bearbeitungLesen({ bearbeitung: {
      phase: 'massnahmen', zustaendig: { id: 'u1', name: { x: 1 } }, frist: '0002-10-20',
      massnahmen: [{ id: 'm1', text: 'a', verantwortlich: { boese: true }, frist: 7, erledigtAm: 5 }],
      verlauf: [{ id: 'v1', text: 't', am: {}, von: [], art: 'unbekannt' }],
    } })
    expect(b.zustaendig).toEqual({ id: 'u1', name: '' })
    expect(b.frist).toBeNull()
    expect(b.massnahmen[0]).toMatchObject({ id: 'm1', text: 'a', verantwortlich: undefined, frist: undefined, erledigtAm: undefined })
    expect(b.verlauf[0]).toEqual({ id: 'v1', text: 't', am: '', von: '', art: 'notiz' })
  })
})

describe('CIRS: Speichern', () => {
  it('verändert eine Meldung in unbekanntem Format nicht', () => {
    expect(() => speicherDaten('kein json, sondern Text des Melders', bearbeitungLesen({}))).toThrow(CirsFehler)
    expect(() => speicherDaten('[1,2]', bearbeitungLesen({}))).toThrow(CirsFehler)
    expect(speicherDaten(null, bearbeitungLesen({})).payload).toHaveProperty('bearbeitung')
    expect(speicherDaten({}, bearbeitungLesen({})).payload).toHaveProperty('bearbeitung')
  })

  it('lässt die Angaben des Melders stehen und leitet den Status aus der Phase ab', () => {
    const b = phaseSetzen(bearbeitungLesen({}), 'abgeschlossen', schritt(), 'erledigt')
    const d = speicherDaten(JSON.stringify({ ...MELDUNG, bearbeitung: { phase: 'neu' } }), b)
    expect(d.status).toBe('erledigt')
    expect(d.payload.was).toBe(MELDUNG.was)
    expect(d.payload.melder_name).toBe('Erika Muster')
    expect((d.payload.bearbeitung as Bearbeitung).phase).toBe('abgeschlossen')
  })
})

describe('CIRS: Liste', () => {
  const faelle = [
    mitBearbeitung({ phase: 'neu' }, { id: 'neu000000000001', created: '2026-10-10 10:00:00.000Z' }),
    mitBearbeitung({ phase: 'bewertung', zustaendig: { id: 'u1', name: 'Anna Berger' }, frist: '2026-10-11' },
      { id: 'ueber0000000001', created: '2026-09-01 10:00:00.000Z' }),
    mitBearbeitung({ phase: 'massnahmen', bewertung: { schwere: 'hoch', haeufigkeit: 'haeufig' } },
      { id: 'hoch00000000001', created: '2026-08-01 10:00:00.000Z' }, { ...MELDUNG, ort: 'Übergabe Notaufnahme' }),
    mitBearbeitung({ phase: 'abgeschlossen', abschluss: { am: '2026-10-05T10:00:00.000Z', von: 'x', text: 'ok' } },
      { id: 'zu0000000000001', created: '2026-07-01 10:00:00.000Z', status: 'erledigt' }, { ...MELDUNG, kategorie: 'material' }),
  ]

  it('zählt die Ansichten', () => {
    expect(zaehlen(faelle, 'u1', HEUTE)).toEqual({ offen: 3, neu: 1, meine: 1, ueberfaellig: 1, abgeschlossen: 1, alle: 4 })
    expect(zaehlen(faelle, undefined, HEUTE).meine).toBe(0)
  })

  it('filtert nach Ansicht, Kategorie und Suche — auch ohne Umlaut', () => {
    expect(filtern(faelle, { ansicht: 'offen' }, 'u1', HEUTE).map((f) => f.id)).not.toContain('zu0000000000001')
    expect(filtern(faelle, { ansicht: 'alle', kategorie: 'material' }, 'u1', HEUTE).map((f) => f.id)).toEqual(['zu0000000000001'])
    expect(filtern(faelle, { ansicht: 'alle', suche: 'ubergabe' }, 'u1', HEUTE).map((f) => f.id)).toEqual(['hoch00000000001'])
    expect(filtern(faelle, { ansicht: 'alle', suche: 'Anna sauerstoffflasche' }, 'u1', HEUTE).map((f) => f.id)).toEqual(['ueber0000000001'])
    expect(filtern(faelle, { ansicht: 'alle', suche: 'CIRS-2026-neu00000' }, 'u1', HEUTE).map((f) => f.id)).toEqual(['neu000000000001'])
  })

  it('die Bewertung geht vor der Meldung', () => {
    expect(filtern(faelle, { ansicht: 'alle', schwere: 'hoch' }, undefined, HEUTE).map((f) => f.id)).toEqual(['hoch00000000001'])
  })

  it('ordnet Überfälliges, dann Neues, dann nach Priorität — Abgeschlossenes zuletzt', () => {
    expect(sortieren(faelle, HEUTE).map((f) => f.id)).toEqual(['ueber0000000001', 'neu000000000001', 'hoch00000000001', 'zu0000000000001'])
  })
})

describe('CIRS: Auswertung', () => {
  const faelle = [
    mitBearbeitung({ phase: 'abgeschlossen', abschluss: { am: '2026-08-11T10:00:00.000Z', von: 'x', text: 'ok' },
      massnahmen: [{ id: 'm1', text: 'a', erledigtAm: '2026-08-10T00:00:00Z', angelegtAm: '', angelegtVon: '' }] },
    { id: 'a', created: '2026-08-01 10:00:00.000Z' }),
    mitBearbeitung({ phase: 'kein_handlungsbedarf', abschluss: { am: '2026-10-06T10:00:00.000Z', von: 'x', text: 'ok' } },
      { id: 'b', created: '2026-10-01 10:00:00.000Z' }, { ...MELDUNG, kategorie: 'material', schwere: 'hoch' }),
    mitBearbeitung({ phase: 'massnahmen', frist: '2026-10-01',
      massnahmen: [{ id: 'm2', text: 'b', angelegtAm: '', angelegtVon: '' }] },
    { id: 'c', created: '2026-10-03 10:00:00.000Z' }, { ...MELDUNG, kategorie: 'unbekannt', schwere: '' }),
  ]

  it('zählt Phasen, Überfälliges, Maßnahmen und die mittlere Dauer', () => {
    const a = auswerten(faelle, HEUTE)
    expect(a).toMatchObject({ gesamt: 3, offen: 1, abgeschlossen: 1, keinHandlungsbedarf: 1, ueberfaellig: 1, mittlereDauerTage: 7.5 })
    expect(a.massnahmen).toEqual({ gesamt: 2, erledigt: 1 })
  })

  it('verteilt nach Kategorie und Schweregrad, ohne Unbekanntes zu verschlucken', () => {
    const a = auswerten(faelle, HEUTE)
    expect(a.nachKategorie.find((k) => k.wert === 'fahrzeug')?.anzahl).toBe(1)
    expect(a.nachKategorie.find((k) => k.wert === 'material')?.anzahl).toBe(1)
    expect(a.nachKategorie.find((k) => k.wert === 'unbekannt')?.anzahl).toBe(1)
    expect(a.nachSchwere.find((s) => s.wert === 'ohne')?.anzahl).toBe(1)
    expect(a.nachKategorie.reduce((s, k) => s + k.anzahl, 0)).toBe(3)
  })

  it('die Monatsreihe reicht über den ganzen gewählten Zeitraum, auch über leere Monate am Ende', () => {
    const reihe = auswerten(faelle, HEUTE, { von: new Date(2026, 6, 1), bis: null }).nachMonat.map((m) => [m.name, m.anzahl])
    expect(reihe).toEqual([['Jul 26', 0], ['Aug 26', 1], ['Sep 26', 0], ['Okt 26', 2]])
    const vorjahr = auswerten([mitBearbeitung({}, { id: 'v', created: '2025-03-05 10:00:00.000Z' })], HEUTE, { von: new Date(2025, 0, 1), bis: new Date(2026, 0, 1) }).nachMonat
    expect(vorjahr).toHaveLength(12)
    expect(vorjahr[0].name).toBe('Jan 25')
    expect(vorjahr[11].name).toBe('Dez 25')
  })

  it('die Monatsreihe hat keine Lücken', () => {
    expect(auswerten(faelle, HEUTE).nachMonat.map((m) => [m.name, m.anzahl])).toEqual([['Aug 26', 1], ['Sep 26', 0], ['Okt 26', 2]])
    expect(auswerten([], HEUTE).nachMonat).toEqual([])
  })

  it('wählt den Zeitraum nach dem Eingang', () => {
    const von = new Date('2026-09-01T00:00:00Z')
    expect(imZeitraum(faelle, von, null).map((f) => f.id)).toEqual(['b', 'c'])
    expect(imZeitraum(faelle, null, von).map((f) => f.id)).toEqual(['a'])
  })
})

describe('CIRS: CSV', () => {
  const f = mitBearbeitung({ phase: 'abgeschlossen', abschluss: { am: '2026-10-05T10:00:00.000Z', von: 'x', text: 'Checkliste; ergänzt' } },
    { status: 'erledigt' }, { ...MELDUNG, was: '=HYPERLINK("x")\nzweite Zeile' })
  const text = csv([f], HEUTE)

  it('ist für Excel lesbar: BOM, Semikolon, Felder mit Trennzeichen in Anführungszeichen', () => {
    expect(text.startsWith('﻿Nummer;Eingang;')).toBe(true)
    expect(text).toContain('"Checkliste; ergänzt"')
    expect(text.split('\r\n')).toHaveLength(2)
  })

  it('lässt Formeln nicht ausführen', () => {
    expect(text).toContain(`"'=HYPERLINK(""x"")\nzweite Zeile"`)
  })

  it('enthält weder Name noch Kontakt des Melders', () => {
    expect(text).not.toContain('Erika Muster')
    expect(text).not.toContain('0170 123456')
  })
})
