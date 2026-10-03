// Die strukturierten Blöcke des NAEP-Datensatzes.
//
// Fünf Abschnitte folgen nicht dem Metamodell, sondern einem eigenen Schema:
// referenz/naep/xsd/naep-strukturen-std.xsd. Ihre Felder stehen deshalb hier,
// von Hand nachgebildet — es sind wenige, und sie ändern sich nicht mit jeder
// Protokollfassung.
//
// Die Pfade sind die Elementnamen des Schemas, mit Punkt getrennt; ein `@`
// trennt ein Attribut ab, ein `.` allein meint den Textinhalt des Blocks
// selbst. Sie werden beim Export eins zu eins zu XML, weshalb sie nicht
// umbenannt werden dürfen.
//
// `pflicht` ist nicht als Komfort gesetzt, sondern aus dem Schema gelesen:
// `minOccurs="1"` am Element, `use="required"` am Attribut, `minLength="1"`
// am Typ. Ein Block, dem ein Pflichtfeld fehlt, ist kein unvollständiger
// Block — er ist nach der Norm überhaupt keiner und wird nicht übermittelt.

export type NaepStrukturFeld = {
  /** Pfad im Schema, etwa `Patient.Name`. */
  pfad: string
  label: string
  typ: 'text' | 'zahl' | 'datum' | 'zeit' | 'jaNein'
  /** Nach dem Schema zwingend, damit der Block übermittelt werden kann. */
  pflicht?: boolean
  hinweis?: string
  muster?: string
}

export type NaepStrukturDef = {
  /** Der Typname aus dem Schema, wie ihn das Metamodell nennt. */
  typ: string
  titel: string
  felder: NaepStrukturFeld[]
  /** Wiederholbare Blöcke: Medikation und Erstdiagnosen. */
  liste?: { pfad: string; titel: string; felder: NaepStrukturFeld[] }
}

export const NAEP_STRUKTUREN: NaepStrukturDef[] = [
  {
    typ: 'PatStammdaten',
    titel: 'Patient — Stammdaten',
    // Das Schema verlangt hier alles: Patient, Adresse und Versicherung sind
    // je minOccurs="1", und ihre Felder sind TypText mit minLength="1".
    felder: [
      { pfad: 'Patient.Name', label: 'Name', typ: 'text', pflicht: true },
      { pfad: 'Patient.Vorname', label: 'Vorname', typ: 'text', pflicht: true },
      { pfad: 'Patient.GebDat', label: 'Geburtsdatum', typ: 'datum', pflicht: true },
      { pfad: 'Patient@pseudonym', label: 'Name ist ein Pseudonym', typ: 'jaNein', pflicht: true },
      { pfad: 'Adresse.Strasse', label: 'Straße', typ: 'text', pflicht: true },
      { pfad: 'Adresse.PLZ', label: 'PLZ', typ: 'text', pflicht: true, muster: '[0-9]{5}', hinweis: 'fünf Ziffern' },
      { pfad: 'Adresse.Ort', label: 'Ort', typ: 'text', pflicht: true },
      { pfad: 'Versicherung.Kasse', label: 'Krankenkasse', typ: 'text', pflicht: true },
      { pfad: 'Versicherung.Kasse@nr', label: 'Kassen-Nr.', typ: 'text', pflicht: true },
      { pfad: 'Versicherung.VersNr', label: 'Versicherten-Nr.', typ: 'text', pflicht: true },
    ],
  },
  {
    typ: 'EinsatztechnischeDaten',
    titel: 'Einsatztechnische Daten',
    felder: [
      { pfad: 'EinsatzNr', label: 'Einsatz-Nr.', typ: 'text' },
      { pfad: 'AuftrNr', label: 'Auftrags-Nr.', typ: 'text' },
      { pfad: 'PatNr', label: 'Patienten-Nr.', typ: 'text' },
      { pfad: 'PersNr', label: 'Personal-Nr.', typ: 'text' },
      { pfad: 'Standort', label: 'Standort', typ: 'text' },
      { pfad: 'LeitstelleKFZ', label: 'Leitstelle (KFZ-Kennzeichen)', typ: 'text' },
    ],
  },
  {
    typ: 'Einsatzort',
    titel: 'Einsatzort',
    // Adresse ist hier optional — aber wenn sie kommt, dann vollständig.
    felder: [
      { pfad: 'Adresse.Strasse', label: 'Straße', typ: 'text' },
      { pfad: 'Adresse.PLZ', label: 'PLZ', typ: 'text', muster: '[0-9]{5}', hinweis: 'fünf Ziffern' },
      { pfad: 'Adresse.Ort', label: 'Ort', typ: 'text' },
      { pfad: 'GPSKoordinate@lat', label: 'Breitengrad', typ: 'zahl', hinweis: 'WGS84' },
      { pfad: 'GPSKoordinate@lon', label: 'Längengrad', typ: 'zahl', hinweis: 'WGS84' },
    ],
  },
  {
    typ: 'Medikation',
    titel: 'Medikation',
    felder: [],
    liste: {
      pfad: 'Einzeldosis',
      titel: 'Einzeldosis',
      felder: [
        { pfad: 'Medikament', label: 'Handelsname', typ: 'text' },
        { pfad: 'Wirkstoff', label: 'Wirkstoff', typ: 'text', pflicht: true },
        { pfad: 'Menge', label: 'Menge', typ: 'zahl' },
        { pfad: 'Menge@einheit', label: 'Einheit', typ: 'text' },
        { pfad: 'Volumen', label: 'Volumen', typ: 'zahl' },
        { pfad: 'Volumen@einheit', label: 'Einheit', typ: 'text' },
        { pfad: 'Zeit@start', label: 'Beginn', typ: 'zeit' },
        { pfad: 'Zeit@ende', label: 'Ende', typ: 'zeit' },
        // Applikation ist TypCodeTerm: code und term sind beide
        // use="required". Ohne Code bleibt das Element weg, der Rest der
        // Einzeldosis wird trotzdem übermittelt.
        { pfad: 'Applikation@code', label: 'Applikation — Code', typ: 'text', hinweis: 'Schlüssel der Zielstelle' },
        { pfad: 'Applikation@term', label: 'Applikation', typ: 'text', hinweis: 'z. B. i.v.' },
        { pfad: 'ATC', label: 'ATC-Code', typ: 'text', hinweis: 'höchstens 7 Zeichen' },
      ],
    },
  },
  {
    typ: 'Erstdiagnosen',
    titel: 'Erstdiagnosen',
    felder: [],
    liste: {
      pfad: 'Diagnose',
      titel: 'Diagnose',
      felder: [
        { pfad: '@code', label: 'ICD-10', typ: 'text', hinweis: 'z. B. J18.9' },
        { pfad: '.', label: 'Bezeichnung', typ: 'text', pflicht: true },
      ],
    },
  },
]

const register = new Map(NAEP_STRUKTUREN.map((s) => [s.typ, s]))

/** Eine Struktur anhand ihres Typnamens aus dem Metamodell. */
export function naepStruktur(typ: string): NaepStrukturDef | undefined {
  return register.get(typ)
}

/** Ein Pfad, in Element-Schritte und ein etwaiges Attribut zerlegt. */
export function pfadTeile(pfad: string): { schritte: string[]; attribut?: string } {
  const [vorn, attribut] = pfad.split('@')
  const schritte = vorn === '' || vorn === '.' ? [] : vorn.split('.')
  return { schritte, attribut }
}
