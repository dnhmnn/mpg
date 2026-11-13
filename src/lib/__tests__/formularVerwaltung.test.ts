// Teil D: Texte und reine Regeln für Vorgänge, Unitas und die Patientenverwaltung
// (src/lib/formular/verwaltung.ts, Bauplan v2, 3.3, 4.9, 4.10).

import { describe, expect, it, vi } from 'vitest'
import {
  ABSENDER_MODI, ABSENDER_WAHL, DIALOG_TEXTE, GRUND_MAX, GRUND_MIN, PRUEF_GRUND_TEXT, UNITAS_TEXTE, UNTERSCHREIBEN_TEXT,
  VORGAENGE_TEXTE, WARTET_HINWEIS, abschlussLesen, abschlussZeile, besatzungZeile, datumLang, datumText, gedrosselt,
  doppeltText, grundPruefen, hatAbsenderWahl, karteAusSuche, koennenNichtText, mannschaftNachtragen, mannschaftNachtragenZeigen, ohneUnterschriftErklaerung, pruefungZeigen,
  pruefEintraege, pruefEintragText, selbstFreigabeFaellig, unterschriftenNach, unterschriftTitel, zeitpunkt,
  ZURUECKGEWIESEN_TEXT, ZURUECKWEISEN_TEXT, ausgeschaltetText, statText, zurueckgewiesenZeile,
} from '../formular/verwaltung'
import { GRUND_MAX as API_GRUND_MAX, GRUND_MIN as API_GRUND_MIN, type MitgliederPruefung, type Unterschrift } from '../formular/api'
import { FRIST_MS, type AbsenderEintrag } from '../formular/absender'
import { besatzungLesen } from '../../pages/public/doku/besatzung'

const STRICH = /[–—]/
const JETZT = Date.parse('2026-10-31T12:00:00.000Z')

const absender = (x: Partial<AbsenderEintrag>): AbsenderEintrag => ({ id: 'u1', name: 'Anna Berg', status: 'bestaetigt', weg: 'passwort', modus: 'passwort', am: '2026-10-31T11:00:00.000Z', ...x })

function alleTexte(): string[] {
  const aus: string[] = []
  for (const m of ABSENDER_MODI) aus.push(...Object.values(ABSENDER_WAHL[m]))
  aus.push(...Object.values(VORGAENGE_TEXTE), ...Object.values(PRUEF_GRUND_TEXT), ...Object.values(UNITAS_TEXTE))
  aus.push(...Object.values(UNTERSCHREIBEN_TEXT), ...Object.values(DIALOG_TEXTE), WARTET_HINWEIS)
  aus.push(koennenNichtText(0), koennenNichtText(1), koennenNichtText(7), doppeltText(1), doppeltText(2))
  aus.push(ohneUnterschriftErklaerung('Anna Berg'), ohneUnterschriftErklaerung(''))
  aus.push(grundPruefen('kurz').zaehler, grundPruefen('lang genug begründet').zaehler)
  aus.push(abschlussZeile({ id: 'l1', name: 'Lea Leitung', am: '2026-10-31T12:00:00.000Z', grund: 'Absender ist nicht mehr im Dienst' }))
  aus.push(...Object.values(ZURUECKWEISEN_TEXT), ...Object.values(ZURUECKGEWIESEN_TEXT), zurueckgewiesenZeile('Jörg Müller'), zurueckgewiesenZeile(''))
  aus.push(statText(1), statText(2), ...['patienten', 'produktausgabe', 'defektmeldung', 'cirs', 'eigen'].map(ausgeschaltetText))
  return aus
}

describe('Texte', () => {
  it('ohne Gedankenstriche', () => {
    for (const t of alleTexte()) expect(t, t).not.toMatch(STRICH)
  })

  it('Stat-Karte: Einzahl bei einer Unterschrift (Befund Client-Abläufe 15)', () => {
    expect(statText(1)).toBe('wartet auf dich')
    expect(statText(0)).toBe('warten auf dich')
    expect(statText(3)).toBe('warten auf dich')
  })

  it('Ausgeschaltet: was mit Anmeldung weiter geht, je Formular (Befund Client-Abläufe 10)', () => {
    expect(ausgeschaltetText('patienten')).toBe(VORGAENGE_TEXTE.patientenOeffentlichAus)
    expect(ausgeschaltetText('produktausgabe')).toBe('Öffentlicher Link aus. Angemeldete Mitglieder senden über Link oder QR-Code weiter.')
    expect(ausgeschaltetText('defektmeldung')).toBe(ausgeschaltetText('produktausgabe'))
    expect(ausgeschaltetText('cirs')).toBe('Aus, auch über Links und QR-Codes nicht erreichbar')
    expect(ausgeschaltetText('eigenes_formular')).toBe(VORGAENGE_TEXTE.formularAus)
  })

  it('„Das war ich nicht“: Rückfrage, Ergebnis und Zeile für die Leitung (Befund Client-Abläufe 12)', () => {
    expect(DIALOG_TEXTE.warIchNicht).toBe('Das war ich nicht')
    expect(ZURUECKWEISEN_TEXT.patienten).toMatch(/Leitung schließt es ohne deine Unterschrift ab/)
    expect(ZURUECKWEISEN_TEXT.defektmeldung).toMatch(/Der Defekt selbst bleibt gemeldet/)
    expect(zurueckgewiesenZeile('Jörg Müller')).toBe('Jörg Müller hat angegeben, dieses Protokoll nicht abgegeben zu haben. Bitte ohne Unterschrift abschließen.')
    expect(zurueckgewiesenZeile(' ')).toMatch(/^Die genannte Person hat angegeben/)
  })

  it('Wahlknöpfe und Erklärungen wie im Plan (3.3)', () => {
    expect(ABSENDER_WAHL.passwort.knopf).toBe('Mitglied mit Passwort')
    expect(ABSENDER_WAHL.frei.knopf).toBe('Name frei eintragen')
    expect(ABSENDER_WAHL.passwort.erklaerung).toBe('Der Absender tippt seinen vollen Namen und bestätigt mit seinem Passwort. Angemeldete Mitglieder brauchen kein Passwort.')
    expect(ABSENDER_WAHL.frei.erklaerung).toBe('Der Absender trägt seinen Namen ein. Passt er genau auf ein Mitglied, wird er verknüpft und als nicht bestätigt markiert.')
    expect(ABSENDER_WAHL.passwort.anzeige).toBe('Absender: Mitglied mit Passwort')
    expect(ABSENDER_WAHL.frei.anzeige).toBe('Absender: Name frei eintragen')
    expect(ABSENDER_MODI).toEqual(['passwort', 'frei'])
  })

  it('Unterschreiben je Formular (4.9)', () => {
    expect(UNTERSCHREIBEN_TEXT.patienten).toBe('Du bestätigst, dass du dieses Protokoll abgegeben hast. Danach hast du einen Tag Zeit für Änderungen.')
    expect(UNTERSCHREIBEN_TEXT.produktausgabe).toBe('Du bestätigst, dass du diese Produktausgabe abgegeben hast.')
    expect(UNTERSCHREIBEN_TEXT.defektmeldung).toBe('Du bestätigst, dass du diese Meldung abgegeben hast.')
    expect(DIALOG_TEXTE.unterschrieben).toBe('Unterschrieben.')
  })

  it('Ohne Unterschrift: Erklärung mit Namen, ohne Namen „der Absender“ (4.10)', () => {
    const nachtragen = ' Die Besatzung steht nur als Namen darin; verknüpfen lässt sie sich danach unter „Freigegeben“ mit „Mannschaft nachtragen“.'
    expect(ohneUnterschriftErklaerung(' Anna Berg ')).toBe('Das Protokoll wird abgeschlossen, ohne dass Anna Berg bestätigt hat. Es bleibt als nicht bestätigt gekennzeichnet.' + nachtragen)
    expect(ohneUnterschriftErklaerung('')).toBe('Das Protokoll wird abgeschlossen, ohne dass der Absender bestätigt hat. Es bleibt als nicht bestätigt gekennzeichnet.' + nachtragen)
  })

  it('Mannschaft nachtragen: offen wie bisher, freigegeben nur nach „Ohne Unterschrift abschließen“ (Befund)', () => {
    const ohne = { status: 'freigegeben', absender_status: 'ohne_unterschrift', payload: { absender: { id: 'u1', name: 'Tom', status: 'ohne_unterschrift' }, mannschaft_tf: 'Tom Fuehrer' } }
    expect(mannschaftNachtragenZeigen(ohne)).toBe(true)
    expect(mannschaftNachtragenZeigen({ ...ohne, payload: { ...ohne.payload, mannschaft: { tf: { id: 'tom', name: 'Tom Fuehrer' } } } })).toBe(false)
    expect(mannschaftNachtragenZeigen({ ...ohne, absender_status: '' })).toBe(false)
    expect(mannschaftNachtragenZeigen({ status: 'freigegeben', payload: { mannschaft_tf: 'Tom Fuehrer' } })).toBe(false)
    expect(mannschaftNachtragenZeigen({ status: 'offen', payload: { mannschaft_tf: 'Tom Fuehrer' } })).toBe(true)
    expect(mannschaftNachtragenZeigen({ status: 'offen', absender_status: 'ausstehend', payload: { absender: { id: 'u1', name: 'A', status: 'ausstehend' } } })).toBe(false)
    expect(mannschaftNachtragenZeigen({ status: 'archiviert', absender_status: 'ohne_unterschrift', payload: ohne.payload })).toBe(false)
    expect(mannschaftNachtragenZeigen({ status: 'offen', payload: '{kaputt' })).toBe(false)
  })
})

describe('Zählung der Mitglieder (3.3)', () => {
  it('doppelte Namen getrennt: sie bestätigen mit Passwort (Befund)', () => {
    expect(doppeltText(0)).toBe('')
    expect(doppeltText(1)).toBe('Ein Mitglied trägt einen Namen, den es mehrfach gibt. Mit Passwort bestätigt es, in der Besatzung und ohne Passwort wird es nicht erkannt.')
    expect(doppeltText(2)).toBe('2 Mitglieder tragen Namen, die es mehrfach gibt. Mit Passwort bestätigen sie, in der Besatzung und ohne Passwort werden sie nicht erkannt.')
    expect(pruefungZeigen(null)).toBe(false)
    expect(pruefungZeigen({ gesamt: 3, koennen_nicht: 0, doppelt: 0, eintraege: [] })).toBe(false)
    expect(pruefungZeigen({ gesamt: 3, koennen_nicht: 0, doppelt: 2, eintraege: [] })).toBe(true)
    expect(pruefungZeigen({ gesamt: 3, koennen_nicht: 1, doppelt: 0, eintraege: [] })).toBe(true)
  })
  it('0, 1 und mehrere', () => {
    expect(koennenNichtText(0)).toBe('Alle Mitglieder können mit Passwort bestätigen.')
    expect(koennenNichtText(-3)).toBe('Alle Mitglieder können mit Passwort bestätigen.')
    expect(koennenNichtText(Number.NaN)).toBe('Alle Mitglieder können mit Passwort bestätigen.')
    expect(koennenNichtText(1)).toBe('Ein Mitglied kann nicht mit Passwort bestätigen.')
    expect(koennenNichtText(3)).toBe('3 Mitglieder können nicht mit Passwort bestätigen.')
  })

  it('Eintrag „Name · Grund“, mehrere Gründe, ohne Namen', () => {
    expect(pruefEintragText({ name: 'Anna', gruende: ['name_unvollstaendig'] })).toBe('Anna · Name unvollständig')
    expect(pruefEintragText({ name: 'Max Mayer', gruende: ['name_doppelt'] })).toBe('Max Mayer · Name doppelt')
    expect(pruefEintragText({ name: 'Paul Wagner', gruende: ['ohne_email'] })).toBe('Paul Wagner · ohne E-Mail, kein Passwort')
    expect(pruefEintragText({ name: 'Lena', gruende: ['name_unvollstaendig', 'ohne_email'] })).toBe('Lena · Name unvollständig · ohne E-Mail, kein Passwort')
    expect(pruefEintragText({ name: '  ', gruende: ['ohne_email'] })).toBe('Ohne Namen · ohne E-Mail, kein Passwort')
  })

  it('Liste: nur mit Grund, nach Namen (deutsch) sortiert; ohne Antwort leer', () => {
    const p: MitgliederPruefung = {
      gesamt: 5, koennen_nicht: 2, doppelt: 1,
      eintraege: [
        { id: '3', name: 'Paul Wagner', gruende: ['ohne_email'] },
        { id: '1', name: 'Ärzte Team', gruende: ['name_doppelt'] },
        { id: '2', name: 'Anna', gruende: ['name_unvollstaendig'] },
        { id: '4', name: 'Zoe Ziegler', gruende: [] },
      ],
    }
    expect(pruefEintraege(p).map((e) => e.id)).toEqual(['2', '1', '3'])
    expect(pruefEintraege(null)).toEqual([])
  })
})

describe('Karten unter Vorgänge (3.3, 3.4)', () => {
  it('Absender-Wahl nur bei Patienten, Produktausgabe, Defektmeldung', () => {
    expect(['patienten', 'produktausgabe', 'defektmeldung', 'cirs', 'formular'].filter(hatAbsenderWahl)).toEqual(['patienten', 'produktausgabe', 'defektmeldung'])
  })

  it('?karte= nur für Standardformulare', () => {
    expect(karteAusSuche('defektmeldung')).toBe('defektmeldung')
    expect(karteAusSuche('produktausgabe')).toBe('produktausgabe')
    expect(karteAusSuche('cirs')).toBe('cirs')
    expect(karteAusSuche(null)).toBe('')
    expect(karteAusSuche('<script>')).toBe('')
  })

})

describe('Unitas (4.9)', () => {
  const u = (formular: Unterschrift['formular'], id: string, titel = ''): Unterschrift => ({ formular, id, titel, zusammenfassung: '', angelegt: '2026-10-31 13:20:05.120Z', absender_name: 'Anna Berg' })

  it('Unterschriften je Formular, auch eigene Formulare; Reihenfolge bleibt, Unbekanntes fällt weg', () => {
    const liste = [u('patienten', 'p2'), u('defektmeldung', 'd1'), u('eigen', 'e2'), u('patienten', 'p1'), u('produktausgabe', 'a1'), u('eigen', 'e1'),
      u('toString' as Unterschrift['formular'], 'x1'), u('cirs' as Unterschrift['formular'], 'x2')]
    const n = unterschriftenNach(liste)
    expect(n.patienten.map((x) => x.id)).toEqual(['p2', 'p1'])
    expect(n.produktausgabe.map((x) => x.id)).toEqual(['a1'])
    expect(n.defektmeldung.map((x) => x.id)).toEqual(['d1'])
    expect(n.eigen.map((x) => x.id)).toEqual(['e2', 'e1'])
    expect(Object.values(n).flat()).toHaveLength(6)
    expect(unterschriftenNach(null)).toEqual({ patienten: [], produktausgabe: [], defektmeldung: [], eigen: [] })
  })

  it('Titel des Servers, sonst je Formular', () => {
    expect(unterschriftTitel(u('patienten', 'p', 'Patientendoku: Max Muster'))).toBe('Patientendoku: Max Muster')
    expect(unterschriftTitel(u('patienten', 'p'))).toBe('Protokoll')
    expect(unterschriftTitel(u('produktausgabe', 'a', '  '))).toBe('Produktausgabe')
    expect(unterschriftTitel(u('defektmeldung', 'd'))).toBe('Defektmeldung')
    expect(unterschriftTitel(u('eigen', 'e', 'Fahrzeugcheck'))).toBe('Fahrzeugcheck')
    expect(unterschriftTitel(u('eigen', 'e'))).toBe('Formular')
  })

  it('Unterschreiben und „Das war ich nicht“ auch für eigene Formulare', () => {
    expect(UNTERSCHREIBEN_TEXT.eigen).toBe('Du bestätigst, dass du dieses Formular abgegeben hast.')
    expect(ZURUECKWEISEN_TEXT.eigen).toMatch(/ohne Konto unter dem eingetragenen Namen/)
    expect(ZURUECKGEWIESEN_TEXT.eigen).toMatch(/nicht mehr mit deinem Konto verknüpft/)
    expect(UNITAS_TEXTE.eigeneFormulare).toBe('Eigene Formulare')
  })

  it('Datum aus dem PocketBase-Format mit Leerzeichen', () => {
    expect(zeitpunkt('2026-10-31 13:20:05.120Z')).toBe(Date.parse('2026-10-31T13:20:05.120Z'))
    expect(Number.isNaN(zeitpunkt(''))).toBe(true)
    expect(Number.isNaN(zeitpunkt(42))).toBe(true)
    expect(datumText('2026-10-31 10:20:05.120Z')).toBe('31.10.2026')
    expect(datumLang('2026-10-31 10:20:05.120Z')).toBe('31. Oktober')
    expect(datumText('kaputt')).toBe('')
  })
})

describe('gedrosselt: höchstens alle 30 Sekunden, nachlaufend (Befund 22)', () => {
  function uhr() {
    let jetzt = 0
    const wartend: { bis: number; f: () => void; aus: boolean }[] = []
    return {
      jetzt: () => jetzt,
      spaeter: (f: () => void, ms: number) => { const h = { bis: jetzt + ms, f, aus: false }; wartend.push(h); return h },
      abbrechen: (h: unknown) => { (h as { aus: boolean }).aus = true },
      vor(ms: number) {
        jetzt += ms
        for (const h of wartend) if (!h.aus && h.bis <= jetzt) { h.aus = true; h.f() }
      },
      offen: () => wartend.filter((h) => !h.aus).length,
    }
  }

  it('erster Anstoß sofort, weitere in der Wartezeit ergeben genau einen Lauf an ihrem Ende', () => {
    const u = uhr()
    const lauf = vi.fn()
    const d = gedrosselt(lauf, 30_000, u)
    d.anstossen()
    expect(lauf).toHaveBeenCalledTimes(1)
    u.vor(1000); d.anstossen()
    u.vor(1000); d.anstossen()
    u.vor(1000); d.anstossen()
    expect(lauf).toHaveBeenCalledTimes(1)
    expect(u.offen()).toBe(1)
    u.vor(26_999)
    expect(lauf).toHaveBeenCalledTimes(1)
    u.vor(1)
    expect(lauf).toHaveBeenCalledTimes(2)
    // 60 Ereignisse in 10 Minuten: höchstens 21 Läufe
    for (let i = 0; i < 60; i++) { u.vor(10_000); d.anstossen() }
    expect(lauf.mock.calls.length).toBeLessThanOrEqual(2 + 21)
  })

  it('sofort läuft gleich, bricht den wartenden Lauf ab und beginnt die Wartezeit neu', () => {
    const u = uhr()
    const lauf = vi.fn()
    const d = gedrosselt(lauf, 30_000, u)
    d.sofort()
    u.vor(5000); d.anstossen()
    expect(u.offen()).toBe(1)
    d.sofort()
    expect(lauf).toHaveBeenCalledTimes(2)
    expect(u.offen()).toBe(0)
    u.vor(10_000); d.anstossen()
    expect(lauf).toHaveBeenCalledTimes(2)
    u.vor(20_000)
    expect(lauf).toHaveBeenCalledTimes(3)
  })

  it('stoppen bricht den wartenden Lauf ab', () => {
    const u = uhr()
    const lauf = vi.fn()
    const d = gedrosselt(lauf, 30_000, u)
    d.anstossen(); u.vor(1000); d.anstossen()
    d.stoppen()
    u.vor(60_000)
    expect(lauf).toHaveBeenCalledTimes(1)
  })
})

describe('Ohne Unterschrift abschließen: Grund (1.8)', () => {
  it('Grenzen wie der Server und wie api.ts', () => {
    expect(GRUND_MIN).toBe(10)
    expect(GRUND_MAX).toBe(500)
    expect(GRUND_MIN).toBe(API_GRUND_MIN)
    expect(GRUND_MAX).toBe(API_GRUND_MAX)
  })

  it('getrimmt gezählt, 10 bis 500 Zeichen', () => {
    expect(grundPruefen('   ')).toEqual({ laenge: 0, gueltig: false, zaehler: '0 von mindestens 10 Zeichen' })
    expect(grundPruefen('  123456789  ').gueltig).toBe(false)
    expect(grundPruefen('1234567890')).toEqual({ laenge: 10, gueltig: true, zaehler: '10 von höchstens 500 Zeichen' })
    expect(grundPruefen('x'.repeat(500)).gueltig).toBe(true)
    expect(grundPruefen('x'.repeat(501)).gueltig).toBe(false)
  })
})

describe('Patientenverwaltung (4.10)', () => {
  const angelegt = '2026-10-30 10:00:00.000Z'

  it('Selbstfreigabe nach payload.frist', () => {
    expect(selbstFreigabeFaellig({ frist: '2026-10-31T11:59:59.000Z', absender: absender({}) }, angelegt, JETZT)).toBe(true)
    expect(selbstFreigabeFaellig({ frist: '2026-10-31T12:00:01.000Z', absender: absender({}) }, angelegt, JETZT)).toBe(false)
  })

  it('ohne Frist: Anlegen + 24 Stunden (auch mit Leerzeichen im Datum)', () => {
    expect(selbstFreigabeFaellig({}, angelegt, Date.parse('2026-10-31T10:00:00.001Z'))).toBe(true)
    expect(selbstFreigabeFaellig({}, angelegt, Date.parse('2026-10-31T09:59:59.999Z'))).toBe(false)
    expect(selbstFreigabeFaellig({ frist: '' }, angelegt, Date.parse(angelegt.replace(' ', 'T')) + FRIST_MS + 1)).toBe(true)
  })

  it('wartet auf Unterschrift: nie, auch lange nach dem Anlegen; payload als Text', () => {
    const p = { frist: '', absender: absender({ status: 'ausstehend', weg: '', am: '' }) }
    expect(selbstFreigabeFaellig(p, angelegt, JETZT + 365 * FRIST_MS)).toBe(false)
    expect(selbstFreigabeFaellig(JSON.stringify(p), angelegt, JETZT + 365 * FRIST_MS)).toBe(false)
  })

  it('ohne lesbares Datum und ohne Frist: nie', () => {
    expect(selbstFreigabeFaellig({}, '', JETZT)).toBe(false)
    expect(selbstFreigabeFaellig({}, 'kaputt', JETZT)).toBe(false)
  })

  it('Abschluss ohne Unterschrift lesen und als Zeile', () => {
    const abschluss = { id: 'l1', name: 'Lea Leitung', am: '2026-10-31T10:00:00.000Z', grund: 'Absender nicht mehr im Dienst' }
    const p = { absender: absender({ status: 'ohne_unterschrift', weg: '', am: '', abschluss }) }
    expect(abschlussLesen(p)).toEqual(abschluss)
    expect(abschlussLesen(JSON.stringify(p))).toEqual(abschluss)
    expect(abschlussLesen({ absender: absender({}) })).toBeNull()
    expect(abschlussLesen({})).toBeNull()
    expect(abschlussZeile(abschluss)).toBe('Ohne Unterschrift abgeschlossen von Lea Leitung am 31.10.2026. Grund: Absender nicht mehr im Dienst')
    expect(abschlussZeile({ id: '', name: '', am: '', grund: '' })).toBe('Ohne Unterschrift abgeschlossen.')
  })

  it('Mannschaft nachtragen schreibt verschachtelt und flach, lässt andere Posten unverändert (Befund 9)', () => {
    const alt = {
      vorname: 'Max',
      mannschaft_tf: 'max mayer', mannschaft_1: 'Jörg Müller', mannschaft_2: '', mannschaft_3: '',
      mannschaft: { tf: null, m1: { id: 'u2', name: 'Jörg Müller' }, m2: null, m3: null },
    }
    const neu = mannschaftNachtragen(alt, { tf: { id: 'u9', name: 'Max Mayer' }, m2: null, m3: { id: '', name: 'Ohne Kennung' } })
    expect(neu.mannschaft_tf).toBe('Max Mayer')
    expect((neu.mannschaft as Record<string, unknown>).tf).toEqual({ id: 'u9', name: 'Max Mayer' })
    expect(neu.mannschaft_1).toBe('Jörg Müller')
    expect((neu.mannschaft as Record<string, unknown>).m1).toEqual({ id: 'u2', name: 'Jörg Müller' })
    expect(neu.mannschaft_3).toBe('')
    expect(neu.vorname).toBe('Max')
    // Was besatzungLesen daraus macht: Name und Kennung passen zusammen
    expect(besatzungLesen(neu).tf).toEqual({ id: 'u9', name: 'Max Mayer' })
    // Das Original bleibt unverändert
    expect(alt.mannschaft_tf).toBe('max mayer')
  })

  it('Besatzungszeile: flache Namen zuerst, sonst verschachtelt; payload als Text', () => {
    const p = { mannschaft_tf: 'Anna Berg', mannschaft_1: '', mannschaft: { tf: { id: 'u1', name: 'Alter Name' }, m1: { id: 'u2', name: 'Jörg Müller' } } }
    expect(besatzungZeile(p)).toBe('Anna Berg · Jörg Müller')
    expect(besatzungZeile(JSON.stringify(p), ', ')).toBe('Anna Berg, Jörg Müller')
    expect(besatzungZeile(null)).toBe('')
  })
})
