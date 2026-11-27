// Bild „lernbar“: die Lernbar (/lernbar) von Lena Berger, Feuerwehr Musterstadt, am 19.11.2026, 09:41, Reiter
// Bibliothek: oben das Nachschlagewerk (Wissensbasis der Organisation), darunter die Lernbücher, die die
// Ausbildenden geschrieben haben (angepinnt der Beitrag zum erfundenen Einsatz Lindenweg 14). Die Zahlen an den
// Reitern Termine und Module kommen aus denselben Terminen, Teilnahmen und Modulen wie im Bild „ausbildungen“
// (ausbildungsDaten in ausbildungen.mjs): heute Abend Sanitätsausbildung Modul 2, dazu zwei offene Module.
// Nur erfundene Daten: erfundene Feuerwehr, erfundene Personen, keine Patientendaten, keine Markennamen.

import { ausbildungsDaten, personRouten, pb } from './ausbildungen.mjs'

const SAMMLUNGEN = {}

// Lernbücher: Titel, Einband (Farben und Muster aus dem Editor in Ausbildungen), Schlagworte
const BUECHER = [
  { id: 'lbbuchrauch0001', typ: 'text', titel: 'Lindenweg 14: Was wir lernen', farbe: '#600812', muster: 'diamante', tags: ['Sanitätsdienst', 'Nachbereitung'], von: 'Anna Beispiel', am: ['2026-11-19', '08:15'], gepinnt: true },
  { id: 'lbbuchatemsch01', typ: 'text', titel: 'Zehn Regeln für den Trupp', farbe: '#1a0e08', muster: null, tags: ['Atemschutz'], von: 'Murat Aksoy', am: ['2026-11-14', '19:30'], gepinnt: true },
  { id: 'lbbuchquizhlw01', typ: 'quiz', titel: 'Quiz: HLW im Team', farbe: '#134e4a', muster: null, tags: ['Reanimation'], von: 'Sara Lindner', am: ['2026-11-03', '20:10'], gepinnt: true },
  { id: 'lbbuchblutung01', typ: 'text', titel: 'Starke Blutungen stillen', farbe: '#7c2d12', muster: null, tags: ['Sanitätsdienst', 'Trauma'], von: 'Anna Beispiel', am: ['2026-11-06', '21:00'] },
  { id: 'lbbuchfunk00001', typ: 'text', titel: 'Sprechfunk in fünf Minuten', farbe: '#713f12', muster: 'marmo', tags: ['Funk'], von: 'Max Mustermann', am: ['2026-10-29', '19:45'] },
  { id: 'lbbuchhygiene01', typ: 'text', titel: 'Schwarz-Weiß-Trennung', farbe: '#065f46', muster: 'venezia', tags: ['Hygiene'], von: 'Sara Lindner', am: ['2026-10-22', '21:30'] },
]

// Nachschlagewerk: Artikel der Wissensbasis (Fachgebiet Notfallmedizin)
const WISSEN = [
  { id: 'wissenabcde0001', titel: 'Das xABCDE-Schema', tags: ['Sanitätsdienst'],
    inhalt: 'x: kritische Blutung stoppen. A: Atemwege frei? B: Atmung, Frequenz, Sättigung. C: Kreislauf, Puls, Rekapillarisierung. D: Bewusstsein, GCS, Pupillen. E: Umgebung, Wärmeerhalt.' },
  { id: 'wissenseitenl01', titel: 'Stabile Seitenlage', tags: ['Sanitätsdienst'],
    inhalt: 'Ansprechen, Atmung prüfen. Atmet normal: stabile Seitenlage, Wärmeerhalt, ständig überwachen. Atmet nicht normal: Wiederbelebung beginnen, AED holen lassen.' },
  { id: 'wissenrauchgas1', titel: 'Rauchgas und CO', tags: ['Sanitätsdienst', 'Atemschutz'],
    inhalt: 'Anzeichen: Reizhusten, Kopfschmerz, Übelkeit, Rußspuren an Nase und Mund. Die Sättigung täuscht bei CO. Sauerstoff hochdosiert, Rettungsdienst nachfordern.' },
]

function aufbauen({ ORG, USER }) {
  const d = ausbildungsDaten(ORG, USER)
  const buecher = BUECHER.map((b) => ({
    id: b.id, collectionId: 'pbc_lernbar_beitraege', collectionName: 'lernbar_beitraege', typ: b.typ, titel: b.titel,
    // Wie der Editor speichert (Ausbildungen, Lernfeed): Fassung 2 mit Einband und Seiten
    inhalt: JSON.stringify({ v: 2, color: b.farbe, pattern: b.muster || undefined,
      pages: [{ id: 'seite1', blocks: [{ id: 'block1', type: 'text', text: b.titel }] }] }),
    bild: [], video_url: '', dateien: [], tags: JSON.stringify(b.tags), organisation_id: ORG.id,
    erstellt_von_name: b.von, gepinnt: !!b.gepinnt, quiz_daten: '',
    created: pb(...b.am), updated: pb(...b.am),
  }))
  const wissen = WISSEN.map((w) => ({
    id: w.id, collectionId: 'pbc_wissen', collectionName: 'wissen', titel: w.titel, inhalt: w.inhalt,
    tags: JSON.stringify(w.tags), bild: '', quelle: 'Ausbildungsunterlagen Feuerwehr Musterstadt', kategorie: 'Notfallmedizin',
    organization_id: ORG.id, created: pb('2026-09-20', '20:00'), updated: pb('2026-11-12', '20:00'),
  }))
  Object.assign(SAMMLUNGEN, {
    ausbildungen_termine: d.termine,
    ausbildungen_termine_user: d.teilnahmen,
    ausbildungen_dokumente: d.dokumente,
    ausbildungen_module: d.module,
    ausbildungen_module_progress: d.fortschritt,
    // Wie die Seite sie mit sort: '-gepinnt,-created' bzw. sort: 'titel' vom Server bekommt
    lernbar_beitraege: buecher,
    wissen: [...wissen].sort((a, b) => a.titel.localeCompare(b.titel, 'de')),
    responda_hinweise: [],
  })
}
import('../daten.mjs').then(aufbauen)

const zumReiter = (name) => async (page) => {
  await page.getByRole('button', { name: new RegExp(`^${name}`, 'i') }).last().click()
  await page.waitForTimeout(700)
}

export const bild = {
  name: 'lernbar',
  pfad: '/lernbar',
  warte: 1200,
  sammlungen: SAMMLUNGEN,
  routen: personRouten(SAMMLUNGEN),
  vorher: zumReiter('Bibliothek'),
}
