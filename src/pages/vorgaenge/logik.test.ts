import { describe, it, expect } from 'vitest'
import {
  APP_ADRESSE, STANDARD_FORMULARE, adresseBauen, adresseLesen, dateiTitel, formularLink, formularZeile, hatZugriff,
  htmlSicher, istAnpassbar, istStandardId, oeffentlichAn, orgSeiteLink, qrDateiname, qrDruckHtml, reiterListe,
  schalterText, standardLabel, versteckteSetzen, vorgaengeVoll, vorlageLink, zahlAusText, zahlText,
} from './logik'
import { VG_TEXTE, frueherText, ANONYM_WAHL, MODUS_KURZ } from './texte'
import { VORGAENGE_TEXTE } from '../../lib/formular/verwaltung'

const suche = (s: string) => new URLSearchParams(s)

describe('Reiter je Recht und Modul (3.4, 3.10)', () => {
  const eingang = { key: 'eingang', label: 'Eingang' }

  it('mit Modul und Recht Vorgänge: Formulare, die Erweiterung, dann CIRS', () => {
    expect(reiterListe({ vorgaengeFrei: true, darfVorgaenge: true, extra: [eingang] }).map((r) => r.key))
      .toEqual(['formulare', 'eingang', 'cirs'])
  })

  it('ohne Erweiterung: Formulare und CIRS', () => {
    expect(reiterListe({ vorgaengeFrei: true, darfVorgaenge: true }).map((r) => r.key)).toEqual(['formulare', 'cirs'])
  })

  it('ohne Modul Vorgänge oder ohne Recht Vorgänge nur Formulare', () => {
    expect(reiterListe({ vorgaengeFrei: false, darfVorgaenge: true, extra: [eingang] }).map((r) => r.key)).toEqual(['formulare'])
    expect(reiterListe({ vorgaengeFrei: true, darfVorgaenge: false, extra: [eingang] }).map((r) => r.key)).toEqual(['formulare'])
  })

  it('doppelte und reservierte Schlüssel einer Erweiterung fallen weg', () => {
    const r = reiterListe({
      vorgaengeFrei: true, darfVorgaenge: true,
      extra: [eingang, { key: 'eingang', label: 'Nochmal' }, { key: 'cirs', label: 'Falsch' }, { key: 'formulare', label: 'Falsch' }, { key: '', label: 'Leer' }],
    })
    expect(r).toEqual([{ key: 'formulare', label: 'Formulare' }, eingang, { key: 'cirs', label: 'CIRS' }])
  })

  it('Zugriff: wer die Formulare einstellen darf oder das Recht Vorgänge hat', () => {
    expect(hatZugriff({ darfEinstellen: false, darfVorgaenge: false })).toBe(false)
    expect(hatZugriff({ darfEinstellen: true, darfVorgaenge: false })).toBe(true)
    expect(hatZugriff({ darfEinstellen: false, darfVorgaenge: true })).toBe(true)
    expect(vorgaengeVoll({ vorgaengeFrei: true, darfVorgaenge: false })).toBe(false)
    expect(vorgaengeVoll({ vorgaengeFrei: false, darfVorgaenge: true })).toBe(false)
    expect(vorgaengeVoll({ vorgaengeFrei: true, darfVorgaenge: true })).toBe(true)
  })
})

describe('Adressen (3.3)', () => {
  it('ohne Angaben: Reiter Formulare, keine Seite, keine Umleitung', () => {
    expect(adresseLesen(suche(''))).toEqual({ tab: 'formulare', seite: '', id: '', meldung: '', umleiten: null })
  })

  it('Reiter, Seite und Kennung', () => {
    expect(adresseLesen(suche('tab=eingang&seite=einsendung&id=abc'))).toEqual({ tab: 'eingang', seite: 'einsendung', id: 'abc', meldung: '', umleiten: null })
  })

  it('eine Kennung ohne Seite zählt nicht', () => {
    expect(adresseLesen(suche('id=abc')).id).toBe('')
  })

  it('?karte= aus MPG und Lager öffnet die Seite des Formulars, ersetzt die Adresse', () => {
    const a = adresseLesen(suche('karte=defektmeldung'))
    expect(a).toMatchObject({ tab: 'formulare', seite: 'formular', id: 'defektmeldung' })
    expect(a.umleiten).toBe('?seite=formular&id=defektmeldung')
    // Die neue Adresse leitet nicht noch einmal um
    expect(adresseLesen(suche(a.umleiten!.slice(1))).umleiten).toBeNull()
  })

  it('?karte= mit Unbekanntem landet in der Liste', () => {
    const a = adresseLesen(suche('karte=gibtsnicht'))
    expect(a).toMatchObject({ tab: 'formulare', seite: '', id: '' })
    expect(a.umleiten).toBe('')
  })

  it('?bereich=cirs&meldung= aus dem Hub: Reiter CIRS, die Meldung bleibt für den Start', () => {
    const a = adresseLesen(suche('bereich=cirs&meldung=m1'))
    expect(a).toMatchObject({ tab: 'cirs', seite: '', meldung: 'm1' })
    expect(a.umleiten).toBe('?tab=cirs')
    expect(adresseLesen(suche('bereich=cirs')).tab).toBe('cirs')
    expect(adresseLesen(suche('meldung=m2'))).toMatchObject({ tab: 'cirs', meldung: 'm2', umleiten: '?tab=cirs' })
  })

  it('ein gesetzter Reiter wird nicht umgeschrieben', () => {
    expect(adresseLesen(suche('tab=cirs&meldung=m1'))).toMatchObject({ tab: 'cirs', meldung: 'm1', umleiten: null })
  })

  it('Adresse bauen: Formulare ohne tab, Kennung nur mit Seite, Sonderzeichen kodiert', () => {
    expect(adresseBauen({})).toBe('')
    expect(adresseBauen({ tab: 'formulare' })).toBe('')
    expect(adresseBauen({ tab: 'cirs' })).toBe('?tab=cirs')
    expect(adresseBauen({ tab: 'formulare', seite: 'formular', id: 'cirs' })).toBe('?seite=formular&id=cirs')
    expect(adresseBauen({ tab: 'eingang', seite: 'feld', id: 'produktausgabe:neu' })).toBe('?tab=eingang&seite=feld&id=produktausgabe%3Aneu')
    expect(adresseBauen({ tab: 'cirs', id: 'x' })).toBe('?tab=cirs')
    // Hin und zurück
    const a = adresseLesen(suche(adresseBauen({ tab: 'eingang', seite: 'feld', id: 'produktausgabe:neu' }).slice(1)))
    expect(a).toMatchObject({ tab: 'eingang', seite: 'feld', id: 'produktausgabe:neu' })
  })
})

describe('Standardformulare: Liste, Zeilen, Schalter (3.4, 3.5)', () => {
  it('vier Formulare, nur die Patientendoku ist fest', () => {
    expect(STANDARD_FORMULARE.map((f) => f.id)).toEqual(['patienten', 'produktausgabe', 'defektmeldung', 'cirs'])
    expect(STANDARD_FORMULARE.filter((f) => istAnpassbar(f.id)).map((f) => f.id)).toEqual(['produktausgabe', 'defektmeldung', 'cirs'])
    expect(istAnpassbar('patienten')).toBe(false)
    expect(istStandardId('patienten')).toBe(true)
    expect(istStandardId('eigen')).toBe(false)
    expect(istStandardId(undefined)).toBe(false)
    expect(standardLabel('defektmeldung')).toBe('Defektmeldung')
    expect(standardLabel('xyz')).toBe('Formular')
  })

  it('Zeile unter dem Namen: öffentlich mit Absender, aus mit angemeldetem Weg, CIRS anonym oder aus', () => {
    const cfg = { hidden_forms: ['produktausgabe', 'cirs'], absender: { defektmeldung: 'passwort' } }
    expect(formularZeile('patienten', {})).toBe('Öffentlich · Mitglied mit Passwort')
    expect(formularZeile('defektmeldung', cfg)).toBe('Öffentlich · Mitglied mit Passwort')
    expect(formularZeile('defektmeldung', {})).toBe('Öffentlich · Name frei eintragen')
    expect(formularZeile('produktausgabe', cfg)).toBe('Öffentlicher Link aus · angemeldet weiter möglich')
    expect(formularZeile('cirs', {})).toBe('Öffentlich · anonym')
    expect(formularZeile('cirs', cfg)).toBe('Aus')
    // Kaputtes form_config: Vorgaben
    expect(formularZeile('produktausgabe', null)).toBe('Öffentlich · Name frei eintragen')
    expect(formularZeile('produktausgabe', { hidden_forms: 'produktausgabe' })).toBe('Öffentlich · Name frei eintragen')
  })

  it('öffentlicher Link an oder aus, die anderen bleiben, keine Doppel', () => {
    expect(oeffentlichAn({ hidden_forms: ['cirs'] }, 'cirs')).toBe(false)
    expect(oeffentlichAn({ hidden_forms: ['cirs'] }, 'patienten')).toBe(true)
    expect(oeffentlichAn(undefined, 'patienten')).toBe(true)
    expect(versteckteSetzen(['cirs', 'patienten'], 'cirs', true)).toEqual(['patienten'])
    expect(versteckteSetzen(['patienten'], 'cirs', false)).toEqual(['patienten', 'cirs'])
    expect(versteckteSetzen(['cirs', 'cirs'], 'cirs', false)).toEqual(['cirs'])
    expect(versteckteSetzen(undefined, 'cirs', false)).toEqual(['cirs'])
    expect(versteckteSetzen([1, 'x', null], 'cirs', true)).toEqual(['x'])
  })

  it('Satz unter dem Schalter', () => {
    expect(schalterText('produktausgabe', true)).toBe(VG_TEXTE.erreichbarAn)
    expect(schalterText('patienten', false)).toBe(VORGAENGE_TEXTE.patientenOeffentlichAus)
    expect(schalterText('defektmeldung', false)).toBe(VORGAENGE_TEXTE.angemeldetOeffentlichAus)
    expect(schalterText('cirs', false)).toBe(VORGAENGE_TEXTE.formularAus)
  })
})

describe('Links (3.5, 3.11)', () => {
  it('Standardformulare, eigene Formulare, Seite der Organisation', () => {
    expect(APP_ADRESSE).toBe('https://app.responda.systems')
    expect(formularLink('wache1', 'patienten')).toBe('https://app.responda.systems/wache1/doku')
    expect(formularLink('wache1', 'produktausgabe')).toBe('https://app.responda.systems/wache1/produktausgabe')
    expect(formularLink('wache1', 'defektmeldung')).toBe('https://app.responda.systems/wache1/defektmeldung')
    expect(formularLink('wache1', 'cirs')).toBe('https://app.responda.systems/wache1/cirs')
    expect(vorlageLink('wache1', 'k3j9x0a1b2c3d4e')).toBe('https://app.responda.systems/wache1/formular/k3j9x0a1b2c3d4e')
    expect(orgSeiteLink(' wache1 ')).toBe('https://app.responda.systems/wache1')
  })

  it('kodiert, was nicht in eine Adresse gehört', () => {
    expect(formularLink('a/b?c', 'cirs')).toBe('https://app.responda.systems/a%2Fb%3Fc/cirs')
    expect(vorlageLink('w', '../x')).toBe('https://app.responda.systems/w/formular/..%2Fx')
  })
})

describe('Texte', () => {
  it('frühere eigene Felder: Satz nur mit Anzahl', () => {
    expect(frueherText(0)).toBe('')
    expect(frueherText(-1)).toBe('')
    expect(frueherText(NaN)).toBe('')
    expect(frueherText(3)).toContain('(3)')
  })

  it('keine Gedankenstriche in den neuen Texten', () => {
    const alle = [
      ...Object.values(VG_TEXTE), ...Object.values(ANONYM_WAHL), ...Object.values(MODUS_KURZ), frueherText(2),
    ]
    for (const t of alle) expect(t, t).not.toMatch(/[–—]/)
  })
})

describe('Kleinteile', () => {
  it('Zahlen mit Komma lesen und schreiben', () => {
    expect(zahlAusText('12,5')).toBe(12.5)
    expect(zahlAusText(' 12.5 ')).toBe(12.5)
    expect(zahlAusText('-3')).toBe(-3)
    expect(zahlAusText(',5')).toBe(0.5)
    expect(zahlAusText('')).toBeNull()
    expect(zahlAusText('  ')).toBeNull()
    expect(zahlAusText('1e3')).toBeNaN()
    expect(zahlAusText('12,5,1')).toBeNaN()
    expect(zahlAusText('abc')).toBeNaN()
    expect(zahlText(12.5)).toBe('12,5')
    expect(zahlText(null)).toBe('')
    expect(zahlText(NaN)).toBe('')
  })

  it('Dateinamen: nur Buchstaben, Ziffern, Umlaute, Bindestrich', () => {
    expect(dateiTitel('Fahrzeug-Check / Woche 3')).toBe('Fahrzeug-Check-Woche-3')
    expect(dateiTitel('Übergabe größer')).toBe('Übergabe-größer')
    expect(dateiTitel('???')).toBe('Formular')
    expect(dateiTitel('x'.repeat(80)).length).toBe(60)
    expect(qrDateiname('Produktausgabe')).toBe('QR-Produktausgabe.png')
    expect(qrDateiname('<script>')).toBe('QR-script.png')
  })

  it('HTML-sicher, auch Apostroph', () => {
    expect(htmlSicher(`<a href="x" onclick='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;')
    expect(htmlSicher(null)).toBe('')
  })

  it('QR-Blatt: jeder Text escaped, nur ein eingebettetes PNG als Bild', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo='
    const h = qrDruckHtml({ orgName: '<b>Wache</b>', titel: 'Check "A" & B', url: 'https://app.responda.systems/w/x?<y>', bild: png })
    expect(h).toContain('&lt;b&gt;Wache&lt;/b&gt;')
    expect(h).toContain('Check &quot;A&quot; &amp; B')
    expect(h).toContain('x?&lt;y&gt;')
    expect(h).toContain(`<img src="${png}"`)
    expect(h).not.toContain('<b>Wache')
    const boese = qrDruckHtml({ orgName: 'W', titel: 'T', url: 'u', bild: 'javascript:alert(1)' })
    expect(boese).not.toContain('<img')
    const boese2 = qrDruckHtml({ orgName: 'W', titel: 'T', url: 'u', bild: 'data:image/png;base64,AAA" onerror="x' })
    expect(boese2).not.toContain('<img')
  })
})
