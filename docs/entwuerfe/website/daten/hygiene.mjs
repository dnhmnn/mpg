// Bilder „hygiene“ und „hygiene-checkliste“: Hygiene (/hygiene) der Feuerwehr Musterstadt am 19.11.2026, 09:41,
// kurz nach dem erfundenen Einsatz E-2026-0417 „B3 – Wohnungsbrand“ (Lindenweg 14).
// - hygiene: die Startseite mit den Zahlen im roten Kopf (1 überfällig, 2 jetzt dran), den Kacheln, „Zu tun“
//   (RTW 83/1 seit gestern überfällig, Desinfektionsraum und HLF 20/1 heute fällig, der Desinfektionsraum mit
//   einem offenen Punkt vom Vortag) und „Bald fällig“.
// - hygiene-checkliste: Desinfektion eintragen für das HLF 20/1 mit der Vorlage „Feuerwehrfahrzeug“ von Responda
//   (std:feuerwehr, keine Trage), die ersten Punkte abgehakt.
// Fälligkeit rechnet die App aus den Durchführungen (src/lib/hygiene/fristen.ts): maßgeblich ist die letzte
// vollständige, eine unvollständige setzt die Frist nicht neu. Die Checklisten sind Kopien der Vorlagen in
// src/lib/hygiene/checklisten.ts (am Objekt gespeichert, wie es die App beim Anlegen tut).
// Nur erfundene Daten: erfundene Feuerwehr, erfundene Personen, keine Patientendaten, keine Markennamen.

// ORG und USER kommen aus '../daten.mjs', nachgeladen wie in mpg.mjs (ein statischer Import hinge im Kreis fest).
const OBJEKTE = []
const DURCHFUEHRUNGEN = []

// Ortszeit -> PocketBase-Zeit in UTC (bis 24.10.2026 Sommerzeit, UTC+2, danach MEZ, UTC+1)
const pb = (tag, hm) => new Date(`${tag}T${hm}:00${tag < '2026-10-25' ? '+02:00' : '+01:00'}`).toISOString().replace('T', ' ')

// Checklisten wie die Vorlagen von Responda (src/lib/hygiene/checklisten.ts)
const VORLAGE = {
  rettungsdienst: [
    'Trage: Liegefläche, Gurte und Griffe',
    'Kontaktflächen im Patientenraum (Griffe, Ablagen, Schalter, Sitze)',
    'Geräte und Kabel im Patientenraum abgewischt',
    'Fußboden im Patientenraum',
    'Fahrerraum: Lenkrad, Schalthebel, Funkgerät, Türgriffe',
    'Abfall entsorgt, Schutzausrüstung und Desinfektionsmittel aufgefüllt',
    'Einwirkzeit eingehalten',
  ],
  feuerwehr: [
    'Fahrerraum: Lenkrad, Schalthebel, Armaturen, Türgriffe',
    'Mannschaftsraum: Sitze, Haltegriffe, Gurtschlösser, Türgriffe',
    'Funkgeräte, Bedienteile und Handsprechfunkgeräte abgewischt',
    'Halterungen und Ablagen im Mannschaftsraum gereinigt',
    'Verschmutzte Einsatzkleidung und Gerät nicht im Mannschaftsraum (Schwarz-Weiß-Trennung)',
    'Erste-Hilfe-Material kontrolliert, Verbrauchtes ersetzt',
    'Boden und Trittstufen gereinigt',
    'Abfall entsorgt, Handschuhe und Desinfektionsmittel aufgefüllt',
  ],
  mannschaft: [
    'Fahrerraum: Lenkrad, Schalthebel, Armaturen, Türgriffe',
    'Sitze, Haltegriffe und Gurtschlösser',
    'Funkgeräte, Tablet und Bedienteile abgewischt',
    'Arbeitsplatz und Tisch (Führungsfahrzeug)',
    'Boden gereinigt',
    'Abfall entsorgt, Desinfektionsmittel aufgefüllt',
  ],
  sanitaer: [
    'Waschbecken und Armaturen',
    'Toiletten und Duschen',
    'Seifen-, Desinfektions- und Handtuchspender aufgefüllt',
    'Bänke, Spindgriffe und Türgriffe',
    'Fußboden',
    'Abfall entsorgt',
  ],
  desinfektionsraum: [
    'Arbeitsflächen, rein und unrein getrennt',
    'Becken und Spüle',
    'Dosiergerät und Desinfektionsmittel: Konzentration und Haltbarkeit geprüft',
    'Schutzausrüstung vorrätig (Handschuhe, Schürzen, Schutzbrillen)',
    'Fußboden',
    'Abfall entsorgt',
  ],
  rucksack: [
    'Außenhülle und Tragegurte abgewischt',
    'Innenfächer kontrolliert und gereinigt',
    'Wiederverwendbares Material im Inneren desinfiziert',
    'Einwirkzeit eingehalten, trocken eingeräumt',
  ],
  // Gerät allgemein, vorn die Punkte zum MPG-Gerätetyp Absaugpumpe (checklisteVorschlag)
  absaugpumpe: [
    'Sekretbehälter geleert, gereinigt und desinfiziert',
    'Absaugschlauch und Filter gewechselt',
    'Gehäuse und Bedienfeld abgewischt',
    'Kabel, Sensoren und Zubehör desinfiziert',
    'Einwirkzeit eingehalten',
    'Funktion nach der Aufbereitung geprüft',
  ],
  material: [
    'Oberfläche gereinigt und desinfiziert',
    'Einwirkzeit eingehalten',
    'Trocken und sauber verstaut',
  ],
}

export const HLF_ID = 'hyhlf2010000001'

// Erfundene Personen der Feuerwehr Musterstadt (dieselben wie in den übrigen Bildern)
const PERSON = {
  lena: ['lenaberger00001', 'Lena Berger'],
  max: ['maxmustermann01', 'Max Mustermann'],
  murat: ['murataksoy00001', 'Murat Aksoy'],
  sara: ['saralindner0001', 'Sara Lindner'],
}

function aufbauen({ ORG }) {
  const objekt = (o) => ({
    id: o.id, collectionId: 'pbc_hygiene_objekte', collectionName: 'hygiene_objekte', organization_id: ORG.id,
    name: o.name, art: o.art, standort: o.standort || '', intervall: o.intervall, intervall_tage: 0,
    punkte: VORLAGE[o.liste], quelle: o.quelle || '', quelle_id: o.quelleId || '', quelle_name: o.quelleId ? o.name : '',
    vorlage_id: o.vorlage, archiviert: '', created: pb('2026-11-03', '19:00'), updated: pb('2026-11-03', '19:00'),
  })
  // Nach Namen sortiert, wie die App sie mit sort: 'name' vom Server bekommt
  const objekte = [
    { id: 'hyabsaugrtw8311', name: 'Absaugpumpe RTW 83/1', art: 'geraet', standort: 'RTW 83/1', intervall: 'woechentlich', liste: 'absaugpumpe', vorlage: 'std:geraet', quelle: 'mpg_geraet', quelleId: 'mpgabsaugrtw831' },
    { id: 'hybdmanschrtw81', name: 'Blutdruckmanschette RTW 83/1', art: 'material', standort: 'RTW 83/1', intervall: 'woechentlich', liste: 'material', vorlage: 'std:material' },
    { id: 'hydesinfraum001', name: 'Desinfektionsraum', art: 'raum', standort: 'Feuerwache', intervall: 'woechentlich', liste: 'desinfektionsraum', vorlage: 'std:desinfektionsraum' },
    { id: HLF_ID, name: 'HLF 20/1', art: 'fahrzeug', intervall: 'monatlich', liste: 'feuerwehr', vorlage: 'std:feuerwehr' },
    { id: 'hylf10200000001', name: 'LF 10/2', art: 'fahrzeug', intervall: 'monatlich', liste: 'feuerwehr', vorlage: 'std:feuerwehr' },
    { id: 'hymtw1910000001', name: 'MTW 19/1', art: 'fahrzeug', intervall: 'monatlich', liste: 'mannschaft', vorlage: 'std:mannschaft' },
    { id: 'hyrucksackhlf01', name: 'Notfallrucksack HLF 20/1', art: 'rucksack', standort: 'HLF 20/1', intervall: 'monatlich', liste: 'rucksack', vorlage: 'std:rucksack' },
    { id: 'hyrtw8310000001', name: 'RTW 83/1', art: 'fahrzeug', intervall: 'woechentlich', liste: 'rettungsdienst', vorlage: 'std:rettungsdienst' },
    { id: 'hysanitaer00001', name: 'Sanitärraum und Umkleide', art: 'raum', standort: 'Feuerwache', intervall: 'woechentlich', liste: 'sanitaer', vorlage: 'std:sanitaer' },
  ].map(objekt)
  OBJEKTE.push(...objekte)

  // Durchführung nach Plan: alle Punkte abgehakt, außer den Nummern in `offen` (Mängel)
  const df = (id, objektId, tag, hm, wer, { offen = [], bemerkung = '' } = {}) => {
    const o = objekte.find((x) => x.id === objektId)
    const punkte = o.punkte.map((text, i) => ({ text, erledigt: !offen.includes(i) }))
    const [user_id, user_name] = PERSON[wer]
    return {
      id, collectionId: 'pbc_hygiene_durchfuehrungen', collectionName: 'hygiene_durchfuehrungen', organization_id: ORG.id,
      objekt_id: o.id, objekt_name: o.name, art: 'plan', anlass: '', einsatz_nummer: '', punkte, offen: offen.length,
      bemerkung, zeitpunkt: pb(tag, hm), user_id, user_name, created: pb(tag, hm), updated: pb(tag, hm),
    }
  }
  DURCHFUEHRUNGEN.push(
    // Heute früh bei Dienstbeginn
    df('hydf00000000012', 'hysanitaer00001', '2026-11-19', '07:05', 'murat'),
    // Gestern unvollständig: Teststreifen für die Konzentration fehlten; die Frist läuft weiter (heute fällig)
    df('hydf00000000011', 'hydesinfraum001', '2026-11-18', '18:20', 'sara', { offen: [2], bemerkung: 'Teststreifen aufgebraucht, sind bestellt.' }),
    df('hydf00000000010', 'hybdmanschrtw81', '2026-11-16', '07:45', 'max'),
    df('hydf00000000009', 'hyabsaugrtw8311', '2026-11-13', '07:30', 'max'),
    df('hydf00000000008', 'hydesinfraum001', '2026-11-12', '18:40', 'sara'),
    // Wöchentlich: zuletzt am 11.11., also seit gestern überfällig
    df('hydf00000000007', 'hyrtw8310000001', '2026-11-11', '19:40', 'max'),
    df('hydf00000000006', 'hymtw1910000001', '2026-11-10', '19:10', 'lena'),
    df('hydf00000000005', 'hylf10200000001', '2026-11-05', '19:30', 'murat'),
    df('hydf00000000004', 'hyrucksackhlf01', '2026-10-24', '10:20', 'sara'),
    // Monatlich: zuletzt am 19.10., also heute fällig
    df('hydf00000000003', HLF_ID, '2026-10-19', '19:15', 'murat'),
  )
}
import('../daten.mjs').then(aufbauen)

const sammlungen = {
  hygiene_objekte: OBJEKTE,
  hygiene_durchfuehrungen: DURCHFUEHRUNGEN,
  // Keine eigenen Vorlagen: es gelten die Vorlagen von Responda
  hygiene_vorlagen: [],
}

export const bilder = [
  { name: 'hygiene', pfad: '/hygiene', warte: 1200, sammlungen },
  {
    name: 'hygiene-checkliste',
    pfad: `/hygiene?seite=durchfuehren&id=${HLF_ID}`,
    warte: 1200,
    sammlungen,
    // Wie am Gerät: die ersten Punkte abhaken, der Rest steht noch aus
    vorher: async (page) => {
      const punkte = page.locator('button.hy-punkt')
      for (let i = 0; i < 5; i++) {
        await punkte.nth(i).click()
        await page.waitForTimeout(120)
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(500)
    },
  },
]
