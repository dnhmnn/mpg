// Bild „einsaetze“: Einsätze (/einsaetze), geöffnet der erfundene Einsatz E-2026-0417 „B3 Wohnungsbrand“ der
// Feuerwehr Musterstadt am 19.11.2026 (Lindenweg 14, Alarm 09:12; dieselbe Nummer wie in protokoll.mjs, unitas.mjs,
// mpg.mjs und hygiene.mjs). Der Einsatz läuft noch: Personen mit Funktion, beteiligte Organisationen, das Protokoll
// der erfundenen Bewohnerin „Erika Mustermann“ (über die Nummer) und die Produktausgabe vom HLF 20/1 (die Mengen
// passen zum Bestand in lager.mjs). Darunter weitere Einsätze des Monats, aus denen die App Organisationen vorschlägt.
//
// Wie die Seite rechnet (src/pages/Einsaetze.tsx, src/pages/einsaetze/logik.ts): Protokolle und Produktausgaben
// gehören über die gleiche Einsatznummer dazu (payload.einsatz_nr bzw. payload.einsatz), höchstens 60 Tage entfernt.
// Lena Berger ist Leitung (admin): Sie sieht Patientennamen, verwaltet den Einsatz und sieht CIRS (Recht dokumente).
// Die Besatzung im Protokoll hat Kennungen, die alle schon unter Personen stehen (kein Knopf „übernehmen“).
// Nur erfundene Daten: erfundene Feuerwehr, erfundene Personen, Platzhaltername für die Patientin, Musterstadt.

// ORG und USER kommen aus '../daten.mjs', nachgeladen wie in mpg.mjs (ein statischer Import hinge im Kreis fest).
const EINSAETZE = []
const PERSONEN = []
const PATIENTS = []
const AUSGABEN = []
const CIRS = []

const EINSATZ_ID = 'einsatz00000417'

// Ortszeit -> PocketBase-Zeit in UTC (bis 24.10.2026 Sommerzeit, UTC+2, danach MEZ, UTC+1)
const pb = (tag, hm) => new Date(`${tag}T${hm}:00${tag < '2026-10-25' ? '+02:00' : '+01:00'}`).toISOString().replace('T', ' ')
const iso = (tag, hm) => pb(tag, hm).replace(' ', 'T')

// Erfundene Personen der Feuerwehr Musterstadt (dieselben wie in den übrigen Bildern)
const PERSON = {
  lena: ['lenaberger00001', 'Lena Berger'],
  murat: ['murataksoy00001', 'Murat Aksoy'],
  sara: ['saralindner0001', 'Sara Lindner'],
  max: ['maxmustermann01', 'Max Mustermann'],
  anna: ['annabeispiel001', 'Anna Beispiel'],
}

function aufbauen({ ORG }) {
  const einsatz = (o) => ({
    id: o.id, collectionId: 'pbc_einsaetze', collectionName: 'einsaetze', organization_id: ORG.id,
    unit: o.unit, keyword: o.keyword, adresse: o.adresse || '', datum: pb(o.tag, o.hm), status: o.status || 'abgeschlossen',
    interne_vermerke: o.vermerke || '', karte_geojson: '', organisationen: o.orgs || [], verknuepfungen: [],
    created: pb(o.tag, o.angelegt || o.hm), updated: pb(o.tag, o.angelegt || o.hm),
  })
  // Neueste zuerst, wie die Seite sie mit sort: '-datum' vom Server bekommt
  EINSAETZE.push(
    einsatz({
      id: EINSATZ_ID, unit: 'E-2026-0417', keyword: 'B3 Wohnungsbrand', tag: '2026-11-19', hm: '09:12', angelegt: '09:39', status: 'aktiv',
      adresse: 'Lindenweg 14, 12345 Musterstadt',
      vermerke: 'Zimmerbrand im 2. OG. Brandwache durch LF 10/2 bis 11:30 Uhr.',
      orgs: ['Rettungsdienst Musterstadt', 'Polizei', 'Stadtwerke Musterstadt'],
    }),
    einsatz({ id: 'einsatz00000416', unit: 'E-2026-0416', keyword: 'B1 Brandmeldeanlage', tag: '2026-11-17', hm: '14:26', adresse: 'Industriestraße 3, 12345 Musterstadt', orgs: ['Polizei'] }),
    einsatz({ id: 'einsatz00000415', unit: 'E-2026-0415', keyword: 'TH Ölspur', tag: '2026-11-15', hm: '07:48', adresse: 'Bahnhofstraße, 12345 Musterstadt', orgs: ['Straßenmeisterei', 'Polizei'] }),
    einsatz({ id: 'einsatz00000414', unit: 'E-2026-0414', keyword: 'TH Verkehrsunfall', tag: '2026-11-13', hm: '07:55', adresse: 'Kreisstraße zwischen Musterstadt und Beispielhausen', orgs: ['Rettungsdienst Musterstadt', 'Polizei', 'Notarzt'] }),
    einsatz({ id: 'einsatz00000413', unit: 'E-2026-0413', keyword: 'Türöffnung akut', tag: '2026-11-11', hm: '22:31', adresse: 'Am Markt 2, 12345 Musterstadt', orgs: ['Rettungsdienst Musterstadt', 'Polizei'] }),
  )

  // Personen im Einsatz mit ihrer Funktion (ROLLEN_IM_EINSATZ), Konten der eigenen Organisation
  const person = (n, wer, rolle, hm) => {
    const [id, name] = PERSON[wer]
    return {
      id: `ezperson0000${n}`.padEnd(15, '0'), collectionId: 'pbc_einsatz_personen', collectionName: 'einsatz_personen',
      einsatz_id: EINSATZ_ID, user_id: id, rolle, created: pb('2026-11-19', hm), updated: pb('2026-11-19', hm),
      expand: { user_id: { id, name } },
    }
  }
  PERSONEN.push(
    person(1, 'lena', 'Fahrzeugführer', '09:39'),
    person(2, 'murat', 'Teamführer', '09:39'),
    person(3, 'sara', 'Rettungssanitäter', '09:39'),
    person(4, 'max', 'Maschinist', '09:41'),
    person(5, 'anna', 'Atemschutz', '09:41'),
  )

  // Das Protokoll der Bewohnerin (wie protokoll.mjs und unitas.mjs): abgesendet, wartet auf die Unterschrift
  const abgesendet = iso('2026-11-19', '09:39')
  PATIENTS.push({
    id: 'protokollerika1', collectionId: 'pbc_patients', collectionName: 'patients',
    title: 'Patientendoku: Erika Mustermann', status: 'offen', organization_id: ORG.id, absender_status: 'ausstehend',
    payload: {
      protokoll_version: 2, vorname: 'Erika', name: 'Mustermann', einsatz_nr: 'E-2026-0417', einsatz_datum: '2026-11-19', rufname: 'HLF 20/1',
      mannschaft_tf: 'Murat Aksoy', mannschaft_1: 'Sara Lindner',
      mannschaft: { tf: { id: PERSON.murat[0], name: 'Murat Aksoy' }, m1: { id: PERSON.sara[0], name: 'Sara Lindner' } },
      abgesendet, frist: new Date(Date.parse(abgesendet) + 24 * 3600_000).toISOString(),
    },
    created: pb('2026-11-19', '09:39'), updated: pb('2026-11-19', '09:39'),
  })

  // Produktausgabe vom HLF 20/1 nach der Versorgung (Mengen wie der Fehlbestand in lager.mjs)
  AUSGABEN.push({
    id: 'ausgabe00000417', collectionId: 'pbc_product_outputs', collectionName: 'product_outputs',
    title: 'Produktausgabe HLF 20/1', status: 'offen', organization_id: ORG.id,
    payload: {
      einsatz: 'E-2026-0417', user_name: 'Sara Lindner', standort: 'HLF 20/1',
      positionen: [
        { qty: 3, name: 'Rettungsdecke 210 × 160 cm' },
        { qty: 1, name: 'Sauerstoffmaske, Erw.' },
        { qty: 24, name: 'Einmalhandschuhe Nitril, Gr. L' },
      ],
    },
    created: pb('2026-11-19', '09:58'), updated: pb('2026-11-19', '09:58'),
  })

  // Eine CIRS-Meldung zum Einsatz (dieselbe Kennung und dieselben Angaben wie in vorgaenge.mjs, ohne Angaben zu
  // Patienten): die Absaugpumpe des HLF 20/1 fiel aus (mpg.mjs). Die Seite zeigt davon nur Datum und Status,
  // verknüpft über einsatz_id.
  CIRS.push({
    id: 'q7m2x9ka4tb1c3d', collectionId: 'pbc_cirs_reports', collectionName: 'cirs_reports',
    title: 'CIRS-Meldung', status: 'offen', organization_id: ORG.id, einsatz_id: EINSATZ_ID,
    payload: {
      datum: '2026-11-19', ort: 'Einsatzstelle, HLF 20/1', kategorie: 'material', schwere: 'mittel',
      was: 'Die Absaugpumpe des HLF 20/1 baute keinen Unterdruck auf. Absaugung vom Rettungsdienst übernommen.',
      warum: 'Bei der Wochenprüfung am Montag lief sie noch. Akku oder Dichtung?',
      vorschlag: 'Zweite Absaugung im Fahrzeug oder Prüfung mit Probelauf unter Last.',
    },
    created: pb('2026-11-19', '10:24'), updated: pb('2026-11-19', '10:24'),
  })
}
import('../daten.mjs').then(aufbauen)

const sammlungen = {
  einsaetze: EINSAETZE,
  einsatz_personen: PERSONEN,
  patients: PATIENTS,
  product_outputs: AUSGABEN,
  cirs_reports: CIRS,
}

/** Die Seite rollt je nach Darstellung im Fenster oder im body (globals.css). */
async function rollen(page, y) {
  await page.evaluate((y) => { window.scrollTo(0, y); document.body.scrollTop = y; document.documentElement.scrollTop = y }, y)
  await page.waitForTimeout(500)
}

// Ein Bild für die Website, so weit gerollt, dass alles zu sehen ist, was die Website dazu sagt (Startseite.tsx).
// Oben die letzten Personen mit Funktion und „Person hinzufügen“, dann die beteiligten Organisationen (mit Vorschlägen
// aus früheren Einsätzen), das Protokoll und die Produktausgabe „Über Nr.“; unten endet das Bild mit der Fläche der
// Produktausgaben. Der rote Kopf mit Stichwort und Nummer liegt darüber (ohne vorher: Bild ab dem Kopf).
export const bild = {
  name: 'einsaetze',
  pfad: `/einsaetze?seite=einsatz&id=${EINSATZ_ID}`,
  warte: 1200,
  sammlungen,
  vorher: async (page) => {
    const y = await page.evaluate(() => {
      const h = [...document.querySelectorAll('h2')].find((e) => e.textContent.trim().startsWith('Produktausgaben'))
      // Die Fläche nach der Überschrift (Abschnitt steht für sich, die Fläche folgt ihm)
      let f = h
      while (f && !(f.classList && f.classList.contains('bv-flaeche'))) f = f.nextElementSibling || f.parentElement?.nextElementSibling
      return f ? Math.round(f.getBoundingClientRect().bottom + window.scrollY + 20 - window.innerHeight) : 0
    })
    await rollen(page, y)
  },
}
