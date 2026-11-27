// Bild „notizen“: Notizen (/notizen) von Lena Berger in der Feuerwehr Musterstadt am 19.11.2026, 09:41. Eigene
// (privat oder mit der Organisation geteilt) und von anderen geteilte Notizen, angepinnte zuerst, mit Farben und
// Tags; oben die Tags als Filter. Inhalt passt zum erfundenen Einsatz E-2026-0417 (Atemschutz in der Werkstatt,
// Material nachbestellen, Teststreifen wie im Bild „hygiene“) und zum Alltag der Wache. Nichts über die Patientin.
// Die App fragt eigene und geteilte Notizen der Organisation ab, sort: '-updated' (src/pages/Notizen.tsx).
// Nur erfundene Daten: erfundene Feuerwehr, erfundene Personen, keine Patientendaten, keine Markennamen.

const ORG_ID = 'orgmusterstadt1' // wie ORG in daten.mjs (ein statischer Import hinge im Kreis fest)
const PERSON = {
  lena: ['lenaberger00001', 'Lena Berger'],
  max: ['maxmustermann01', 'Max Mustermann'],
  sara: ['saralindner0001', 'Sara Lindner'],
  anna: ['annabeispiel001', 'Anna Beispiel'],
}

// Ortszeit (MEZ, UTC+1) -> PocketBase-Zeit in UTC
const pb = (tag, hm) => new Date(`${tag}T${hm}:00+01:00`).toISOString().replace('T', ' ')

let nr = 0
function notiz({ titel, inhalt, tags, farbe, wer, geteilt = false, angepinnt = false, tag, hm }) {
  nr++
  const [user_id, user_name] = PERSON[wer]
  return {
    id: `notiz${String(nr).padStart(10, '0')}`, collectionId: 'pbc_notizen', collectionName: 'notizen',
    title: titel, content: inhalt, tags, color: farbe, pinned: angepinnt, shared: geteilt,
    user_id, user_name, organization_id: ORG_ID, created: pb(tag, hm), updated: pb(tag, hm),
  }
}

// Farben wie NOTE_COLORS in Notizen.tsx
const ROT = '#600812'
const GRUEN = '#16a34a'
const AMBER = '#d97706'
const BLAU = '#1e3a8a'
const GRAU = '#8a7a68'

// Zuletzt geändert zuerst, wie der Server sie mit sort: '-updated' liefert
const NOTIZEN = [
  notiz({
    titel: 'Nach dem Brand im Lindenweg', wer: 'lena', farbe: ROT, tag: '2026-11-19', hm: '09:38',
    inhalt: 'HLF 20/1 wieder aufrüsten\nAbsaugpumpe meldet Murat im MPG, Ersatz aus dem Gerätehaus holen\nHandschuhe und Rettungsdecken im Lager nachbuchen\nDesinfektion HLF eintragen (Murat)',
    tags: ['HLF'],
  }),
  notiz({
    titel: 'Atemschutz in der Werkstatt', wer: 'sara', geteilt: true, farbe: AMBER, tag: '2026-11-19', hm: '09:37',
    inhalt: 'Zwei Pressluftatmer aus dem HLF gehen zur Prüfung in die Werkstatt, zurück voraussichtlich Montag.\nMasken 7 bis 10 liegen zur Reinigung bereit.',
    tags: ['Atemschutz'],
  }),
  notiz({
    titel: 'Fahrzeugpflege am Samstag', wer: 'lena', geteilt: true, angepinnt: true, farbe: ROT, tag: '2026-11-18', hm: '20:40',
    inhalt: 'Treffpunkt 9 Uhr an der Halle.\nHLF 20/1 und LF 10/2 innen und außen, MTW 19/1 nur innen.\nKaffee und Brötchen bringt Anna mit.',
    tags: ['Fahrzeuge'],
  }),
  notiz({
    titel: 'Bestellen', wer: 'lena', farbe: GRUEN, tag: '2026-11-18', hm: '19:05',
    inhalt: 'Teststreifen für das Dosiergerät (bestellt am 18.11.)\nDesinfektionstücher für die Fahrzeuge\nMüllbeutel für den Desinfektionsraum',
    tags: ['Lager'],
  }),
  notiz({
    titel: 'Hallentor 2', wer: 'max', geteilt: true, farbe: GRAU, tag: '2026-11-17', hm: '18:20',
    inhalt: 'Schließt nur mit Nachdrücken. Die Gemeinde ist informiert, Techniker kommt nächste Woche.',
    tags: ['Wache'],
  }),
  notiz({
    titel: 'Ideen Tag der offenen Tür', wer: 'lena', farbe: BLAU, tag: '2026-11-10', hm: '21:15',
    inhalt: 'Erste Hilfe zum Mitmachen für Kinder\nFahrzeugschau mit der Drehleiter der Nachbarwehr\nFlyer bis Ende Januar',
    tags: ['Ideen'],
  }),
]

export const bild = {
  name: 'notizen',
  pfad: '/notizen',
  warte: 1000,
  sammlungen: { notizen: NOTIZEN },
}
