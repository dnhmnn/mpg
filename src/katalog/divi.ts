// DIVI Notfalleinsatzprotokoll Version 7.1 (REL.1 — 28.08.2026)
//
// Der Vordruck ist eine A3-Seite quer: links die Vorderseite, rechts die
// Rueckseite. Fuer uns sind das zwei DIN-A4-Seiten hochkant — Seite 1 traegt
// alles bis zu den Erstdiagnosen, Seite 2 Verlauf, Massnahmen und Uebergabe.
//
// Dieser Katalog ist die einzige Quelle: Aus ihm entstehen die Eingabemaske
// (Protokollfassung 2.0) und der zweiseitige Ausdruck. Wer ein Feld aendert,
// aendert beides zugleich.
//
// Die Feld-IDs sind stabil. Sie landen so in der Payload und duerfen nicht
// umbenannt werden, sobald ein Protokoll damit gespeichert wurde.

export type FeldTyp =
  | 'text'      // einzeilig
  | 'langtext'  // mehrzeilig
  | 'zahl'
  | 'datum'
  | 'zeit'
  | 'check'     // ein einzelnes Kaestchen, boolean
  | 'radio'     // genau eine Option
  | 'mehrfach'  // beliebig viele Optionen
  | 'skala'     // numerische Skala, z. B. Schmerz 0–10
  | 'verlauf'   // Verlaufsprotokoll (Zeitreihe)
  | 'medikation' // Medikationstabelle

export type Option = {
  wert: string
  text: string
  /** Kleingedrucktes neben der Option im Vordruck. */
  hinweis?: string
}

export type Feld = {
  id: string
  label: string
  typ: FeldTyp
  optionen?: Option[]
  /** Einheit, die im Vordruck hinter dem Kaestchen steht. */
  einheit?: string
  /** Fussnote/Erlaeuterung aus dem Vordruck. */
  hinweis?: string
  /** Pflichtfeld nach MIND 3.1. */
  pflicht?: boolean
  /** Spaltenbreite im Raster, 1–12. Steuert Maske und Ausdruck. */
  breite?: number
  /** Nur anzeigen, wenn dieses Feld einen Wert hat. */
  wenn?: string
  min?: number
  max?: number
}

export type Gruppe = {
  id: string
  /** Zwischenueberschrift innerhalb eines Abschnitts (z. B. „ZNS"). */
  titel?: string
  felder: Feld[]
}

export type Abschnitt = {
  id: string
  titel: string
  seite: 1 | 2
  /**
   * Das Raster des Vordrucks. Der DIVI-Bogen ist in Baender (zeile) geteilt,
   * jedes Band in nebeneinanderliegende Saeulen (spalte). Mehrere Abschnitte
   * mit derselben zeile und spalte stehen untereinander, in der Reihenfolge
   * von `ordnung`. `spanne` ist die Breite der Saeule in Zwoelfteln.
   *
   * Maske und Ausdruck lesen beide dieses Raster. Wer den Papierbogen kennt,
   * findet in der App alles an derselben Stelle.
   */
  zeile: number
  spalte: number
  spanne: number
  /** Reihenfolge innerhalb derselben Saeule, von oben nach unten. */
  ordnung: number
  gruppen: Gruppe[]
}

const ja_nein: Option[] = [
  { wert: 'ja', text: 'Ja' },
  { wert: 'nein', text: 'Nein' },
]

const seiten_rl: Option[] = [
  { wert: 'rechts', text: 'rechts' },
  { wert: 'links', text: 'links' },
]

/** Eine Zeile der Verletzungstabelle: Schweregrad, offen/geschlossen, Besonderheit. */
function verlRegion(id: string, label: string, spezielle: Option[] = []): Feld {
  return {
    id,
    label,
    typ: 'mehrfach',
    breite: 12,
    optionen: [
      { wert: 'leicht', text: 'leicht' },
      { wert: 'mittel', text: 'mittel' },
      { wert: 'schwer', text: 'schwer' },
      { wert: 'geschlossen', text: 'geschlossen' },
      { wert: 'offen', text: 'offen' },
      ...spezielle,
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Seite 1 — Vorderseite
// ─────────────────────────────────────────────────────────────────────────────

const stammdaten: Abschnitt = {
  id: 'stammdaten',
  titel: 'Patienten-Stammdaten',
  seite: 1,
  zeile: 1,
  spalte: 1,
  spanne: 5,
  ordnung: 1,
  gruppen: [
    {
      id: 'person',
      felder: [
        { id: 'name', label: 'Name', typ: 'text', pflicht: true, breite: 6, hinweis: 'ggf. Pseudonym' },
        { id: 'vorname', label: 'Vorname', typ: 'text', breite: 6 },
        { id: 'name_pseudonym', label: 'Pseudonym vergeben', typ: 'check', breite: 6 },
        { id: 'gebdatum', label: 'Geb.-Datum', typ: 'datum', pflicht: true, breite: 6 },
        { id: 'gebdatum_geschaetzt', label: 'Geburtsdatum geschätzt', typ: 'check', breite: 6 },
        { id: 'strasse', label: 'Straße', typ: 'text', breite: 12 },
        { id: 'plz_ort', label: 'PLZ / Ort', typ: 'text', breite: 12 },
        { id: 'kasse', label: 'Kasse / Nr.', typ: 'text', breite: 6 },
        { id: 'versnr', label: 'Vers.-Nr.', typ: 'text', breite: 6 },
        {
          id: 'geschlecht',
          label: 'Geschlecht',
          typ: 'radio',
          pflicht: true,
          breite: 4,
          optionen: [
            { wert: 'maennlich', text: 'männlich' },
            { wert: 'weiblich', text: 'weiblich' },
            { wert: 'divers', text: 'divers' },
          ],
        },
        {
          id: 'bmi',
          label: 'BMI',
          typ: 'radio',
          breite: 4,
          hinweis: 'Gewicht [kg] / (Größe [m])²',
          optionen: [
            { wert: 'bis40', text: '≤ 40' },
            { wert: 'ueber40', text: '> 40' },
          ],
        },
        { id: 'alter_wert', label: 'Alter', typ: 'zahl', breite: 2, min: 0, max: 130 },
        {
          id: 'alter_einheit',
          label: 'Alter in',
          typ: 'radio',
          breite: 2,
          optionen: [
            { wert: 'jahre', text: 'Jahre' },
            { wert: 'monate', text: 'Monate' },
            { wert: 'tage', text: 'Tage' },
          ],
        },
      ],
    },
  ],
}

const einsatzdaten: Abschnitt = {
  id: 'einsatzdaten',
  titel: 'Einsatztechnische Daten',
  seite: 1,
  zeile: 1,
  spalte: 2,
  spanne: 4,
  ordnung: 1,
  gruppen: [
    {
      id: 'rettungsmittel',
      titel: 'Rettungsmittel',
      felder: [
        {
          id: 'rettungsmittel',
          label: 'Rettungsmittel',
          typ: 'mehrfach',
          pflicht: true,
          breite: 12,
          optionen: [
            { wert: 'nef', text: 'NEF' },
            { wert: 'selbstfahrer', text: 'Selbstfahrer' },
            { wert: 'naw', text: 'NAW' },
            { wert: 'ktw', text: 'KTW' },
            { wert: 'ith', text: 'ITH' },
            { wert: 'first_responder', text: 'First Resp.' },
            { wert: 'bergrettung', text: 'Bergrettung' },
            { wert: 'rtw', text: 'RTW' },
            { wert: 'rth', text: 'RTH' },
            { wert: 'itw', text: 'ITW' },
            { wert: 'wasserrettung', text: 'Wasserrett.' },
            { wert: 'lna', text: 'LNA' },
            { wert: 'orgl', text: 'OrgL' },
            { wert: 'schwerlast_rtw', text: 'SchwerlastRTW' },
            { wert: 'n_ktw', text: 'N-KTW' },
            { wert: 'mic', text: 'MIC' },
            { wert: 'telena', text: 'TeleNA' },
            { wert: 'ersthelfer_app', text: 'ErsthelferAPP' },
            { wert: 'single_responder', text: 'Single Resp. (REF, AEF …)' },
            { wert: 'ambulanzflugzeug', text: 'Ambulanzflugzeug' },
            { wert: 'flaechenflugzeug', text: 'Flächenflugzeug' },
          ],
        },
      ],
    },
    {
      id: 'einsatzort',
      titel: 'Einsatzort',
      felder: [
        { id: 'einsatz_datum', label: 'Einsatz-Datum', typ: 'datum', breite: 4, pflicht: true },
        { id: 'einsatz_strasse', label: 'Straße', typ: 'text', breite: 8 },
        { id: 'einsatz_gps_breite', label: 'GPS-Breitengrad', typ: 'text', breite: 4 },
        { id: 'einsatz_plz', label: 'PLZ', typ: 'text', breite: 2 },
        { id: 'einsatz_ort', label: 'Ort', typ: 'text', breite: 4 },
        { id: 'einsatz_gps_laenge', label: 'GPS-Längengrad', typ: 'text', breite: 4 },
        {
          id: 'einsatzstelle',
          label: 'Einsatzstelle',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'wohnung', text: 'Wohnung' },
            { wert: 'pflegeeinrichtung', text: 'Pflegeeinr.' },
            { wert: 'arbeitsplatz', text: 'Arbeitsplatz' },
            { wert: 'sportstaette', text: 'Sportstätte' },
            { wert: 'arztpraxis', text: 'Arztpraxis' },
            { wert: 'krankenhaus', text: 'Krankenhaus' },
            { wert: 'geburtshaus', text: 'Geburtshaus' },
            { wert: 'oeff_raum', text: 'öff. Raum' },
            { wert: 'strasse', text: 'Straße' },
            { wert: 'schule', text: 'Schule / Bildungseinrichtung' },
            { wert: 'massenveranstaltung', text: 'Massenveranstaltung' },
            { wert: 'unwegsames_gelaende', text: 'unwegsames Gelände' },
            { wert: 'sonstige', text: 'Sonstige' },
          ],
        },
      ],
    },
    {
      id: 'einsatzart',
      titel: 'Einsatz-Art',
      felder: [
        {
          id: 'einsatz_art',
          label: 'Einsatz-Art',
          typ: 'radio',
          pflicht: true,
          breite: 12,
          optionen: [
            { wert: 'primaer', text: 'Primäreinsatz' },
            { wert: 'sekundaer', text: 'Sekundäreinsatz' },
            { wert: 'gebietsabdeckung', text: 'Gebietsabdeckung' },
            { wert: 'verlegung', text: 'Verlegung' },
            { wert: 'bereitstellung', text: 'Bereitstellung' },
            { wert: 'fehleinsatz', text: 'Fehleinsatz' },
            { wert: 'na_nachforderung', text: 'Notarzt-Nachforderung' },
            { wert: 'telena_nachforderung', text: 'TeleNA-Nachforderung' },
            { wert: 'folgeeinsatz', text: 'Folgeeinsatz' },
          ],
        },
        {
          id: 'ohne_patient',
          label: 'Ohne Patientenkontakt',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'kein_patient', text: 'kein Patient' },
            { wert: 'abbestellt', text: 'abbestellt' },
            { wert: 'bereits_abtransportiert', text: 'Patient bereits abtransportiert' },
            { wert: 'boeswillige_alarmierung', text: 'böswillige Alarmierung' },
          ],
        },
        {
          id: 'einsatzabbruch',
          label: 'Einsatzabbruch',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'technisch', text: 'technische Gründe' },
            { wert: 'wetter', text: 'Wetter' },
            { wert: 'sonstige', text: 'Sonstige' },
          ],
        },
      ],
    },
  ],
}

const zeiten: Abschnitt = {
  id: 'zeiten',
  titel: 'Zeiten',
  seite: 1,
  zeile: 1,
  spalte: 3,
  spanne: 3,
  ordnung: 2,
  gruppen: [
    {
      id: 'zeiten',
      felder: [
        { id: 'zeit_alarm', label: 'Alarm', typ: 'zeit', pflicht: true, breite: 6 },
        { id: 'zeit_ankunft_einsatzort', label: 'Ankunft (Einsatzort)', typ: 'zeit', pflicht: true, breite: 6 },
        { id: 'zeit_ankunft_patient', label: 'Ankunft (am Patienten)', typ: 'zeit', breite: 6 },
        { id: 'vor_rettungsdienst', label: 'vor Rettungsdienst', typ: 'check', breite: 6 },
        { id: 'zeit_abfahrt', label: 'Abfahrt', typ: 'zeit', breite: 6 },
        { id: 'zeit_ankunft_zielort', label: 'Ankunft am Zielort', typ: 'zeit', breite: 6 },
        { id: 'zeit_uebergabe', label: 'Übergabe', typ: 'zeit', pflicht: true, breite: 6 },
        { id: 'zeit_ende', label: 'Ende', typ: 'zeit', breite: 6 },
      ],
    },
  ],
}

const zielklinik: Abschnitt = {
  id: 'zielklinik',
  titel: 'Transportziel',
  seite: 1,
  zeile: 1,
  spalte: 2,
  spanne: 4,
  ordnung: 2,
  gruppen: [
    {
      id: 'ziel',
      felder: [
        { id: 'transport_ziel', label: 'Transportziel', typ: 'text', breite: 12 },
        { id: 'voranmeldung', label: 'Voranmeldung', typ: 'check', breite: 3 },
        {
          id: 'voranmeldung_ressource',
          label: 'Angemeldete Ressource',
          typ: 'mehrfach',
          breite: 9,
          optionen: [
            { wert: 'stroke_unit', text: 'Stroke Unit' },
            { wert: 'herzkatheter', text: 'Herzkatheter' },
            { wert: 'traumazentrum', text: 'Traumazentrum' },
            { wert: 'schockraum', text: 'Schockraum' },
            { wert: 'sonstige', text: 'sonstige besondere Ressource' },
          ],
        },
        {
          id: 'zielklinik_auswahl',
          label: 'Auswahl der Zielklinik',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'durch_dritte', text: 'durch Dritte' },
            { wert: 'patientenwunsch', text: 'auf Patientenwunsch' },
          ],
        },
      ],
    },
  ],
}

const mannschaft: Abschnitt = {
  id: 'mannschaft',
  titel: 'Besetzung',
  seite: 1,
  zeile: 1,
  spalte: 2,
  spanne: 4,
  ordnung: 3,
  gruppen: [
    {
      id: 'besetzung',
      felder: [
        { id: 'notarzt', label: 'Notarzt', typ: 'text', breite: 12 },
        { id: 'assistenz', label: 'Assistenz', typ: 'text', breite: 12 },
        { id: 'team', label: 'Team', typ: 'text', breite: 12 },
      ],
    },
  ],
}

const notfallgeschehen: Abschnitt = {
  id: 'notfallgeschehen',
  titel: 'Notfallgeschehen, Anamnese, Erstbefund, Vormedikation, Vorbehandlung',
  seite: 1,
  zeile: 2,
  spalte: 1,
  spanne: 12,
  ordnung: 1,
  gruppen: [
    {
      id: 'freitext',
      felder: [
        { id: 'notfallgeschehen', label: 'Notfallgeschehen / Anamnese', typ: 'langtext', breite: 12, pflicht: true },
      ],
    },
    {
      id: 'umstaende',
      felder: [
        {
          id: 'az_vor_ereignis',
          label: 'AZ des Patienten vor dem Ereignis',
          typ: 'radio',
          breite: 12,
          hinweis: 'entspricht PES',
          optionen: [
            { wert: 'ohne_vorerkrankung', text: 'ohne Vorerkr.' },
            { wert: 'leicht_eingeschraenkt', text: 'leicht eingeschr.' },
            { wert: 'nennenswert_eingeschraenkt', text: 'nennenswert eingeschr.' },
            { wert: 'taeglich_unmoeglich', text: 'normales tägl. Leben unmöglich' },
            { wert: 'moribund', text: 'moribund' },
            { wert: 'unbekannt', text: 'unbekannt' },
          ],
        },
        {
          id: 'versorgungssituation',
          label: 'Versorgungssituation',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'unabhaengig', text: 'unabhängig' },
            { wert: 'pflege_zuhause', text: 'Pflege zuhause' },
            { wert: 'pflege_institution', text: 'Pflege in Institution' },
          ],
        },
        {
          id: 'antikoagulation',
          label: 'Antikoagulanzienmedikation vor dem Ereignis',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'tz_aggr_hemmer', text: 'TZ-Aggreg.hemmer' },
            { wert: 'vitk_antagonist', text: 'VitK-Antagonist' },
            { wert: 'heparin', text: 'Heparin(oide)' },
            { wert: 'doak', text: 'DOAK' },
            { wert: 'thrombin_hemmer', text: 'DOAK: Thrombin-Hemmer' },
            { wert: 'xa_hemmer', text: 'DOAK: Xa-Hemmer' },
            { wert: 'sonstige', text: 'Sonstige' },
          ],
        },
        {
          id: 'ersthelfermassnahmen',
          label: 'Ersthelfermaßnahmen (Laien)',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'suffizient', text: 'suffizient' },
            { wert: 'insuffizient', text: 'insuffizient' },
            { wert: 'keine', text: 'keine' },
          ],
        },
        { id: 'first_responder_vor_ort', label: 'First Responder vor Ort', typ: 'check', breite: 3 },
        { id: 'first_responder_zeit', label: 'Uhrzeit des Eintreffens', typ: 'zeit', breite: 3 },
        { id: 'dialysepflichtig', label: 'Dialysepflichtigkeit', typ: 'check', breite: 6 },
        { id: 'infektiositaet', label: 'Infektiosität', typ: 'check', breite: 6, hinweis: 'bitte im Text spezifizieren' },
        { id: 'vorerkrankungen', label: 'Vorerkrankungen', typ: 'langtext', breite: 12 },
        { id: 'vormedikation', label: 'Vormedikation', typ: 'langtext', breite: 12 },
        {
          id: 'vital_problem',
          label: 'Vital-Problem(e)',
          typ: 'mehrfach',
          breite: 12,
          hinweis: 'xABCDE-Schema s. Rückseite',
          optionen: [
            { wert: 'x', text: 'x' },
            { wert: 'a', text: 'A' },
            { wert: 'b', text: 'B' },
            { wert: 'c', text: 'C' },
            { wert: 'd', text: 'D' },
            { wert: 'e', text: 'E' },
          ],
        },
      ],
    },
  ],
}

const neurologie_erst: Abschnitt = {
  id: 'neurologie_erst',
  titel: 'Erste erhobene Befunde — Neurologie',
  seite: 1,
  zeile: 3,
  spalte: 1,
  spanne: 6,
  ordnung: 1,
  gruppen: [
    {
      id: 'rahmen',
      felder: [
        { id: 'neuro_zeitpunkt', label: 'Zeitpunkt', typ: 'zeit', breite: 4 },
        { id: 'neuro_ohne_befund', label: 'ohne path. Befund', typ: 'check', breite: 4 },
        { id: 'neuro_nicht_untersucht', label: 'nicht untersucht', typ: 'check', breite: 4 },
      ],
    },
    {
      id: 'gcs',
      titel: 'Glasgow Coma Scale',
      felder: [
        {
          id: 'gcs_augen',
          label: 'Augen öffnen',
          typ: 'radio',
          breite: 4,
          hinweis: 'Kinder-GCS siehe Randspalte',
          optionen: [
            { wert: '4', text: 'spontan (4)' },
            { wert: '3', text: 'auf Geräusch (3)' },
            { wert: '2', text: 'auf Druck (2)' },
            { wert: '1', text: 'nicht vorhanden (1)' },
          ],
        },
        {
          id: 'gcs_verbal',
          label: 'beste verbale Reaktion',
          typ: 'radio',
          breite: 4,
          optionen: [
            { wert: '5', text: 'konversationsfähig orientiert (5)' },
            { wert: '4', text: 'verwirrt (4)' },
            { wert: '3', text: 'Wörter (3)' },
            { wert: '2', text: 'Laute (2)' },
            { wert: '1', text: 'keine (1)' },
          ],
        },
        {
          id: 'gcs_motorik',
          label: 'beste motorische Reaktion',
          typ: 'radio',
          breite: 4,
          hinweis: 'Zur Summierung wird nur der Wert der Extremität mit der besten motorischen Reaktion verwendet',
          optionen: [
            { wert: '6', text: 'folgt Aufforderung (6)' },
            { wert: '5', text: 'lokalisiert (5)' },
            { wert: '4', text: 'beugt normal (4)' },
            { wert: '3', text: 'beugt abnormal (3)' },
            { wert: '2', text: 'streckt (2)' },
            { wert: '1', text: 'keine (1)' },
          ],
        },
        { id: 'gcs_summe', label: 'GCS (Summe)', typ: 'zahl', breite: 3, min: 3, max: 15, pflicht: true },
      ],
    },
    {
      id: 'bewusstsein',
      titel: 'Bewusstseinslage',
      felder: [
        {
          id: 'bewusstsein',
          label: 'Bewusstseinslage',
          typ: 'radio',
          breite: 12,
          pflicht: true,
          optionen: [
            { wert: 'nicht_beurteilbar', text: 'nicht beurteilbar' },
            { wert: 'wach', text: 'wach' },
            { wert: 'reaktion_ansprache', text: 'Reaktion auf Ansprache' },
            { wert: 'reaktion_schmerz', text: 'Reakt. auf Schmerzreiz' },
            { wert: 'bewusstlos', text: 'bewusstlos' },
            { wert: 'analgosediert', text: 'analgosediert / Narkose' },
          ],
        },
      ],
    },
    {
      id: 'auffaelligkeiten',
      titel: 'Akute Neurologische Auffälligkeiten',
      felder: [
        { id: 'neuro_auff_ohne_befund', label: 'ohne path. Befund', typ: 'check', breite: 6 },
        { id: 'neuro_auff_nicht_beurteilbar', label: 'nicht beurteilbar', typ: 'check', breite: 6 },
        {
          id: 'neuro_auffaelligkeiten',
          label: 'Auffälligkeiten',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'vorbestehende_defizite', text: 'vorbestehende neurologische Defizite' },
            { wert: 'gesichtslaehmung', text: 'Gesichtslähmung' },
            { wert: 'sehstoerung', text: 'Sehstörung' },
            { wert: 'sprachstoerung', text: 'Sprachstörung / Sprechstörung' },
            { wert: 'schluckstoerung', text: 'Schluckstörung' },
            { wert: 'herdblick', text: 'Herdblick' },
            { wert: 'querschnittssymptomatik', text: 'Querschnittssympt.' },
            { wert: 'sens_stoerung', text: 'Sens. Störung' },
            { wert: 'babinski', text: 'Babinski Zeichen' },
            { wert: 'meningismus', text: 'Meningismus' },
            { wert: 'uebelkeit_erbrechen', text: 'Übelkeit / Erbrechen' },
            { wert: 'kopfschmerz', text: 'Kopfschmerz' },
            { wert: 'gangunsicherheit', text: 'Gangunsicherheit / Schwindel' },
            { wert: 'sonstige', text: 'Sonstige' },
          ],
        },
        { id: 'neuro_auff_sonstige_text', label: 'Sonstige Auffälligkeiten', typ: 'text', breite: 12, wenn: 'neuro_auffaelligkeiten' },
      ],
    },
    {
      id: 'pupillen',
      titel: 'Pupillen',
      felder: [
        {
          id: 'pupillenweite_rechts',
          label: 'Pupillenweite rechts',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'eng', text: 'eng' },
            { wert: 'mittel', text: 'mittel' },
            { wert: 'weit', text: 'weit' },
            { wert: 'entrundet', text: 'entrundet' },
          ],
        },
        {
          id: 'pupillenweite_links',
          label: 'Pupillenweite links',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'eng', text: 'eng' },
            { wert: 'mittel', text: 'mittel' },
            { wert: 'weit', text: 'weit' },
            { wert: 'entrundet', text: 'entrundet' },
          ],
        },
        {
          id: 'lichtreaktion_rechts',
          label: 'Lichtreaktion rechts',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'prompt', text: 'prompt' },
            { wert: 'traege', text: 'träge' },
            { wert: 'keine', text: 'keine' },
          ],
        },
        {
          id: 'lichtreaktion_links',
          label: 'Lichtreaktion links',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'prompt', text: 'prompt' },
            { wert: 'traege', text: 'träge' },
            { wert: 'keine', text: 'keine' },
          ],
        },
      ],
    },
    {
      id: 'extremitaeten',
      titel: 'Extremitätenbewegung',
      felder: [
        {
          id: 'extremitaet_arm_re',
          label: 'Arm rechts',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'einseitig_absinken', text: 'einseitiges Absinken' },
            { wert: 'kein_anheben', text: 'kein Anheben' },
            { wert: 'keine_bewegung', text: 'keine Bewegung' },
          ],
        },
        {
          id: 'extremitaet_arm_li',
          label: 'Arm links',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'einseitig_absinken', text: 'einseitiges Absinken' },
            { wert: 'kein_anheben', text: 'kein Anheben' },
            { wert: 'keine_bewegung', text: 'keine Bewegung' },
          ],
        },
        {
          id: 'extremitaet_bein_re',
          label: 'Bein rechts',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'einseitig_absinken', text: 'einseitiges Absinken' },
            { wert: 'kein_anheben', text: 'kein Anheben' },
            { wert: 'keine_bewegung', text: 'keine Bewegung' },
          ],
        },
        {
          id: 'extremitaet_bein_li',
          label: 'Bein links',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'einseitig_absinken', text: 'einseitiges Absinken' },
            { wert: 'kein_anheben', text: 'kein Anheben' },
            { wert: 'keine_bewegung', text: 'keine Bewegung' },
          ],
        },
      ],
    },
  ],
}

const messwerte_erst: Abschnitt = {
  id: 'messwerte_erst',
  titel: 'Erste erhobene Messwerte / allgemeine Befunde',
  seite: 1,
  zeile: 3,
  spalte: 2,
  spanne: 6,
  ordnung: 1,
  gruppen: [
    {
      id: 'vitalwerte',
      felder: [
        { id: 'mw_keine', label: 'keine Messwerte', typ: 'check', breite: 3 },
        { id: 'schmerz', label: 'Schmerzen', typ: 'skala', breite: 9, min: 0, max: 10, pflicht: true },
        {
          id: 'schmerzerleben',
          label: 'Schmerzerleben',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'tolerabel', text: 'tolerabel' },
            { wert: 'nicht_tolerabel', text: 'nicht tolerabel' },
          ],
        },
        { id: 'rr_sys', label: 'RR systolisch', typ: 'zahl', einheit: 'mmHg', breite: 3, pflicht: true, min: 0, max: 300 },
        { id: 'rr_dia', label: 'RR diastolisch', typ: 'zahl', einheit: 'mmHg', breite: 3, min: 0, max: 200 },
        { id: 'hf', label: 'HF', typ: 'zahl', einheit: '/min', breite: 3, pflicht: true, min: 0, max: 300 },
        {
          id: 'hf_rhythmus',
          label: 'Rhythmus',
          typ: 'radio',
          breite: 3,
          optionen: [
            { wert: 'rhythmisch', text: 'rhythmisch' },
            { wert: 'arrhythmisch', text: 'arrhythmisch' },
          ],
        },
        { id: 'bz', label: 'BZ', typ: 'zahl', breite: 3, min: 0, max: 1000 },
        {
          id: 'bz_einheit',
          label: 'BZ-Einheit',
          typ: 'radio',
          breite: 3,
          optionen: [
            { wert: 'mgdl', text: 'mg/dl' },
            { wert: 'mmoll', text: 'mmol/l' },
          ],
        },
        {
          id: 'bz_grenze',
          label: 'BZ außerhalb Messbereich',
          typ: 'radio',
          breite: 3,
          optionen: [
            { wert: 'low', text: 'LOW' },
            { wert: 'high', text: 'HIGH' },
          ],
        },
        { id: 'af', label: 'AF', typ: 'zahl', einheit: '/min', breite: 3, pflicht: true, min: 0, max: 80 },
        { id: 'spo2', label: 'SpO₂', typ: 'zahl', einheit: '%', breite: 3, pflicht: true, min: 0, max: 100 },
        {
          id: 'spo2_bedingung',
          label: 'SpO₂ gemessen',
          typ: 'radio',
          breite: 3,
          optionen: [
            { wert: 'raumluft', text: 'bei Raumluft' },
            { wert: 'o2_gabe', text: 'unter O₂-Gabe' },
          ],
        },
        { id: 'temp', label: 'Temp', typ: 'zahl', einheit: '°C', breite: 3, min: 20, max: 45 },
        { id: 'etco2', label: 'etCO₂', typ: 'zahl', einheit: 'mmHg', breite: 3, min: 0, max: 150 },
        { id: 'qsofa', label: 'qSOFA', typ: 'zahl', breite: 3, min: 0, max: 3, hinweis: 'je 1 Punkt für AF ≥ 22, GCS < 15 und RRsys ≤ 100' },
        { id: 'news2', label: 'NEWS2', typ: 'zahl', breite: 3, min: 0, max: 20, hinweis: 'Score siehe Rückseite' },
        { id: 'rekap_zeit', label: 'Rekap-Zeit', typ: 'zahl', einheit: 'sek', breite: 3, min: 0, max: 20 },
      ],
    },
    {
      id: 'ekg',
      titel: 'EKG',
      felder: [
        { id: 'ekg_keines', label: 'kein EKG', typ: 'check', breite: 3 },
        {
          id: 'ekg_rhythmus',
          label: 'EKG-Rhythmus',
          typ: 'radio',
          breite: 9,
          optionen: [
            { wert: 'sinusrhythmus', text: 'Sinusrhythmus' },
            { wert: 'schrittmacher', text: 'Schrittmacherrhythmus' },
            { wert: 'abs_arrhythmie', text: 'Abs. Arrhythmie' },
            { wert: 'kammerflimmern', text: 'Kammerflimmern' },
            { wert: 'av_block_2', text: 'AV-Block II°' },
            { wert: 'pea_emd', text: 'PEA / EMD' },
            { wert: 'av_block_3', text: 'AV-Block III°' },
            { wert: 'asystolie', text: 'Asystolie' },
          ],
        },
        {
          id: 'ekg_befund',
          label: 'EKG-Befund',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'st_hebung', text: 'signifikante ST-Hebung' },
            { wert: 'schenkelblock', text: 'Schenkelblock' },
            { wert: 'schmale_tachykardie', text: 'schmale QRS-Tachykardie' },
            { wert: 'breite_tachykardie', text: 'breite QRS-Tachykardie' },
            { wert: 'sonstige', text: 'sonstige patholog. EKG-Veränderung' },
          ],
        },
        {
          id: 'ekg_art',
          label: 'EKG-Art',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'zwoelf_kanal', text: '12-Kanal EKG' },
            { wert: 'telemetrie', text: 'Telemetrie' },
            { wert: 'vorbehandler', text: 'EKG durch Vorbehandler' },
            { wert: 'nicht_durchfuehrbar', text: 'EKG nicht durchführbar' },
          ],
        },
      ],
    },
    {
      id: 'atmung',
      titel: 'Atmung',
      felder: [
        { id: 'atmung_nicht_us', label: 'Atmung nicht untersucht', typ: 'check', breite: 3 },
        {
          id: 'atmung',
          label: 'Atmung',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'unauffaellig', text: 'unauffällig' },
            { wert: 'apnoe', text: 'Apnoe' },
            { wert: 'stridor', text: 'Stridor' },
            { wert: 'hyperventilation', text: 'Hyperventilation' },
            { wert: 'nicht_beurteilbar', text: 'nicht beurteilbar' },
            { wert: 'beatmung', text: 'Beatmung' },
            { wert: 'zyanose', text: 'Zyanose' },
            { wert: 'atemwegsverlegung', text: 'Atemwegsverlegung' },
            { wert: 'schnappatmung', text: 'Schnappatmung' },
            { wert: 'spastik', text: 'Spastik' },
            { wert: 'rasselgeraeusche', text: 'Rasselgeräusche' },
            { wert: 'sonstiges_muster', text: 'sonstiges patholog. Atemmuster (Biot, Cheyne-Stokes etc.)' },
          ],
        },
      ],
    },
    {
      id: 'haut',
      titel: 'Haut',
      felder: [
        { id: 'haut_nicht_us', label: 'Haut nicht untersucht', typ: 'check', breite: 3 },
        {
          id: 'haut',
          label: 'Haut',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'unauffaellig', text: 'unauffällig' },
            { wert: 'stehende_hautfalten', text: 'stehende Hautfalten' },
            { wert: 'oedeme', text: 'Oedeme' },
            { wert: 'ikterus', text: 'Ikterus' },
            { wert: 'nicht_beurteilbar', text: 'nicht beurteilb.' },
            { wert: 'dekubitus', text: 'Dekubitus' },
            { wert: 'kaltschweissig', text: 'kaltschweißig' },
            { wert: 'marmoriert', text: 'Marmorierung' },
            { wert: 'exanthem', text: 'Exanthem / Erythem' },
            { wert: 'blass_fahl', text: 'blass / fahl' },
            { wert: 'sonst_effloreszenz', text: 'sonst. path. Effloreszenz' },
          ],
        },
      ],
    },
    {
      id: 'psyche',
      titel: 'Psyche',
      felder: [
        { id: 'psyche_nicht_us', label: 'Psyche nicht untersucht', typ: 'check', breite: 3 },
        {
          id: 'psyche',
          label: 'Psyche',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'unauffaellig', text: 'unauffällig' },
            { wert: 'erregt', text: 'erregt' },
            { wert: 'aggressiv', text: 'aggressiv' },
            { wert: 'verlangsamt', text: 'verlangsamt / stuporös' },
            { wert: 'nicht_beurteilbar', text: 'nicht beurteilbar' },
            { wert: 'depressiv', text: 'depressiv' },
            { wert: 'aengstlich', text: 'ängstlich' },
            { wert: 'manisch', text: 'manisch' },
            { wert: 'wahnhaft', text: 'wahnhaft' },
            { wert: 'verwirrt', text: 'verwirrt' },
            { wert: 'suizidal', text: 'suizidal' },
            { wert: 'motorisch_unruhig', text: 'motorisch unruhig' },
          ],
        },
      ],
    },
  ],
}

const erkrankungen: Abschnitt = {
  id: 'erkrankungen',
  titel: 'Erkrankungen',
  seite: 1,
  zeile: 4,
  spalte: 1,
  spanne: 6,
  ordnung: 1,
  gruppen: [
    {
      id: 'rahmen',
      felder: [
        { id: 'erkrankungen_keine', label: 'keine', typ: 'check', breite: 12, hinweis: 'Akut relevante Diagnosen ggf. bei Erstdiagnosen weiter spezifizieren. Nebendiagnosen nur bei Bemerkungen eintragen.' },
      ],
    },
    {
      id: 'zns',
      titel: 'ZNS',
      felder: [
        {
          id: 'erk_zns',
          label: 'ZNS',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'hirninfarkt_tia_blutung', text: 'Hirninfarkt, TIA, intrakranielle Blutung' },
            { wert: 'im_lysefenster', text: 'im Lysefenster', hinweis: 'Symptombeginn erfassen!' },
            { wert: 'tia', text: 'TIA' },
            { wert: 'hirninfarkt', text: 'Hirninfarkt' },
            { wert: 'icb', text: 'ICB' },
            { wert: 'sab', text: 'SAB' },
            { wert: 'krampfanfall', text: 'Krampfanfall' },
            { wert: 'status_epilepticus', text: 'Status epilepticus' },
            { wert: 'meningitis_encephalitis', text: 'Meningitis / Encephalitis' },
          ],
        },
        { id: 'erk_zns_sonstige', label: 'ZNS — Sonstige', typ: 'text', breite: 12 },
      ],
    },
    {
      id: 'herz_kreislauf',
      titel: 'Herz-Kreislauf',
      felder: [
        {
          id: 'erk_herz',
          label: 'Herz-Kreislauf',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'acs', text: 'Akutes Koronarsyndrom' },
            { wert: 'stemi_omi', text: 'STEMI / OMI' },
            { wert: 'vorderwand', text: 'Vorderwand' },
            { wert: 'hinterwand', text: 'Hinterwand' },
            { wert: 'thoraxschmerz_unklar', text: 'Thoraxschmerz unklarer Genese' },
            { wert: 'rhythmusstoerung', text: 'Rhythmusstörung' },
            { wert: 'tachy', text: 'tachy' },
            { wert: 'brady', text: 'brady' },
            { wert: 'lungenembolie', text: 'Lungenembolie' },
            { wert: 'thrombose', text: 'Thrombose / art. Verschl.' },
            { wert: 'orthostase', text: 'orthostatische Fehlregulation' },
            { wert: 'synkope', text: 'Synkope' },
            { wert: 'hypotonie', text: 'Hypotonie' },
            { wert: 'aortenaneurysma', text: 'Aortenaneurysma / -dissekt.' },
            { wert: 'herzinsuffizienz', text: 'Herzinsuffizienz' },
            { wert: 'lungenoedem', text: 'Lungenödem' },
            { wert: 'hypertens_entgleisung', text: 'hypertens. Entgleisung' },
            { wert: 'hypertens_notfall', text: 'hypertens. Notfall' },
            { wert: 'kardiogener_schock', text: 'Kardiogen. Schock' },
            { wert: 'haemorrhagischer_schock', text: 'hämorrhag. Schock' },
            { wert: 'schrittmacher_fehlfunktion', text: 'Schrittmacher-Fehlfkt.' },
            { wert: 'icd_fehlfunktion', text: 'ICD-Fehlfunktion' },
            { wert: 'herz_kreislauf_stillstand', text: 'Herz-Kreislauf-Stillstand' },
          ],
        },
        { id: 'erk_herz_sonstige', label: 'Herz-Kreislauf — Sonstige', typ: 'text', breite: 12 },
      ],
    },
    {
      id: 'atmung_erk',
      titel: 'Atmung',
      felder: [
        {
          id: 'erk_atmung',
          label: 'Atmung',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'asthma', text: 'Asthma (Anfall)' },
            { wert: 'status_asthmaticus', text: 'Status asthmaticus' },
            { wert: 'copd', text: 'COPD (ggf. Exazerbation)' },
            { wert: 'heimbeatmung', text: 'Heimbeatmung' },
            { wert: 'heimsauerstoff', text: 'Heimsauerstoff' },
            { wert: 'pneumonie', text: 'Pneumonie / Bronchit.' },
            { wert: 'anderer_resp_infekt', text: 'anderer resp. Infekt' },
            { wert: 'hyperventilationssyndrom', text: 'Hyperventilationssyndr.' },
            { wert: 'unklare_dyspnoe', text: 'unkl. Dyspnoe' },
            { wert: 'aspiration', text: 'Aspiration' },
            { wert: 'haemoptysen', text: 'Hämoptysen' },
            { wert: 'spontanpneumothorax', text: 'Spontanpneumothorax' },
          ],
        },
        { id: 'erk_atmung_sonstige', label: 'Atmung — Sonstige', typ: 'text', breite: 12 },
      ],
    },
    {
      id: 'abdomen',
      titel: 'Abdomen',
      felder: [
        {
          id: 'erk_abdomen',
          label: 'Abdomen',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'akutes_abdomen', text: 'Akutes Abdomen' },
            { wert: 'mesenterialinfarkt', text: 'Mesenterialinfarkt' },
            { wert: 'gi_blutung', text: 'GI-Blutung' },
            { wert: 'gi_blutung_obere', text: 'obere' },
            { wert: 'gi_blutung_untere', text: 'untere' },
            { wert: 'kolik', text: 'Kolik (z. B. Niere, Galle)' },
            { wert: 'enteritis', text: 'Enteritis' },
          ],
        },
        { id: 'erk_abdomen_sonstige', label: 'Abdomen — Sonstige', typ: 'text', breite: 12 },
      ],
    },
    {
      id: 'psychiatrie',
      titel: 'Psychiatrie',
      felder: [
        {
          id: 'erk_psychiatrie',
          label: 'Psychiatrie',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'psychose', text: 'Psychose, Manie, Erregungszustand' },
            { wert: 'angst_depression', text: 'Angst, Depression' },
            { wert: 'entzug_delir', text: 'Entzug, Delir' },
            { wert: 'psychosoziale_krise', text: 'Psychosoziale Krise' },
            { wert: 'suizidalitaet', text: 'Suizidalität' },
          ],
        },
        { id: 'erk_psychiatrie_sonstige', label: 'Psychiatrie — Sonstige', typ: 'text', breite: 12 },
      ],
    },
    {
      id: 'stoffwechsel',
      titel: 'Stoffwechsel',
      felder: [
        {
          id: 'erk_stoffwechsel',
          label: 'Stoffwechsel',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'hypoglykaemie', text: 'Hypoglykämie' },
            { wert: 'hyperglykaemie', text: 'Hyperglykämie' },
            { wert: 'exsikkose', text: 'Exsikkose' },
            { wert: 'elektrolytstoerung', text: 'Elektrolytstörung' },
            { wert: 'uraemie_anv', text: 'Urämie / ANV' },
          ],
        },
        { id: 'erk_stoffwechsel_sonstige', label: 'Stoffwechsel — Sonstige', typ: 'text', breite: 12 },
      ],
    },
    {
      id: 'paediatrie',
      titel: 'Pädiatrie',
      felder: [
        {
          id: 'erk_paediatrie',
          label: 'Pädiatrie',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'fieberkrampf', text: 'Fieberkrampf' },
            { wert: 'sids', text: 'SIDS / Near-SIDS' },
            { wert: 'pseudokrupp', text: 'Pseudokrupp' },
            { wert: 'epiglottitis', text: 'Epiglottitis' },
          ],
        },
        { id: 'erk_paediatrie_sonstige', label: 'Pädiatrie — Sonstige', typ: 'text', breite: 12 },
      ],
    },
    {
      id: 'gynaekologie',
      titel: 'Gynäkologie',
      felder: [
        {
          id: 'erk_gynaekologie',
          label: 'Gynäkologie',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'schwangerschaft', text: 'Schwangerschaft' },
            { wert: 'praeklinische_geburt', text: 'präklinische Geburt' },
            { wert: 'eklampsie', text: '(Prä-)Eklampsie / Schwangerschaftskompl.' },
            { wert: 'vaginale_blutung', text: 'vaginale Blutung' },
            { wert: 'extrauterine_graviditaet', text: 'extrauterine Gravidität' },
          ],
        },
        {
          id: 'schwangerschaftswoche',
          label: 'Schwangerschaftswoche',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'bis35', text: '≤ 35. SSW' },
            { wert: 'ueber35', text: '> 35. SSW' },
          ],
        },
        { id: 'erk_gynaekologie_sonstige', label: 'Gynäkologie — Sonstige', typ: 'text', breite: 12 },
      ],
    },
    {
      id: 'sonstige_erk',
      titel: 'Sonstige',
      felder: [
        {
          id: 'erk_sonstige',
          label: 'Sonstige',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'anaphylaktische_reaktion', text: 'anaphylakt. Reaktion' },
            { wert: 'hitzeerschoepfung', text: 'Hitzeerschöpfung, Hitzschlag' },
            { wert: 'unterkuehlung', text: 'Unterkühlung / Erfrierung' },
            { wert: 'sepsis', text: 'hochfieb. Infekt / Sepsis / sept. Schock' },
            { wert: 'hochkontagioeser_erreger', text: 'hochkontagiöser Erreger' },
            { wert: 'erysipel', text: 'Erysipel' },
            { wert: 'sonstige_infektion', text: 'sonstige Infektionserkrankung' },
            { wert: 'urologisch', text: 'Urologische Erkr.' },
            { wert: 'lumbago', text: 'akute Lumbago' },
            { wert: 'epistaxis', text: 'Epistaxis' },
            { wert: 'augenerkrankung', text: 'Augenerkrankung' },
            { wert: 'akuter_schmerzzustand', text: 'Akuter Schmerzzustand' },
            { wert: 'schock_unklar', text: 'Schock unklarer Genese' },
            { wert: 'soziales_problem', text: 'soziales Problem (ohne psychiatr. Störung)' },
            { wert: 'behandlungskomplikation', text: 'medizinische Behandlungskomplikation' },
            { wert: 'intoxikation', text: 'Intoxikation' },
          ],
        },
        {
          id: 'anaphylaxie_grad',
          label: 'Anaphylaxie-Grad',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'i_ii', text: 'I–II°' },
            { wert: 'iii_iv', text: 'III–IV°' },
          ],
        },
        {
          id: 'intoxikation_art',
          label: 'Intoxikation durch',
          typ: 'mehrfach',
          breite: 12,
          wenn: 'erk_sonstige',
          optionen: [
            { wert: 'akzidentell', text: 'akzidentell' },
            { wert: 'alkohol', text: 'Alkohol' },
            { wert: 'drogen', text: 'Drogen' },
            { wert: 'medikamente', text: 'Medikamente' },
            { wert: 'sonstige_toxine', text: 'sonstige Toxine' },
          ],
        },
        { id: 'erk_sonstige_text', label: 'Sonstige — Freitext', typ: 'text', breite: 12 },
      ],
    },
  ],
}

const verletzungen: Abschnitt = {
  id: 'verletzungen',
  titel: 'Verletzungen',
  seite: 1,
  zeile: 4,
  spalte: 2,
  spanne: 6,
  ordnung: 1,
  gruppen: [
    {
      id: 'rahmen',
      felder: [
        { id: 'verletzungen_keine', label: 'keine', typ: 'check', breite: 4 },
        { id: 'zshg_sport', label: 'Zusammenhang mit sportlicher Aktivität', typ: 'radio', breite: 4, optionen: ja_nein },
        { id: 'zshg_beruf', label: 'Zusammenhang mit beruflicher Aktivität', typ: 'radio', breite: 4, optionen: ja_nein },
      ],
    },
    {
      id: 'regionen',
      titel: 'Verletzungsregionen',
      // Jede Region traegt im Vordruck drei Spalten: Schweregrad, offen oder
      // geschlossen und eine regionsspezifische Auspraegung. Wir fuehren das
      // als eine Mehrfachauswahl je Region, damit eine Zeile eine Zeile bleibt.
      felder: [
        verlRegion('verl_schaedel_hirn', 'Schädel-Hirn'),
        verlRegion('verl_gesicht', 'Gesicht / Kopf / Hals', [{ wert: 'penetrierend', text: 'penetrierend' }]),
        verlRegion('verl_hws', 'HWS', [{ wert: 'instabil', text: 'instabil' }]),
        verlRegion('verl_thorax', 'Thorax', [
          { wert: 'instabil', text: 'instabil' },
          { wert: 'penetrierend', text: 'penetrierend' },
        ]),
        verlRegion('verl_abdomen', 'Abdomen', [{ wert: 'penetrierend', text: 'penetrierend' }]),
        verlRegion('verl_bws_lws', 'BWS, LWS', [{ wert: 'sensomotorisches_defizit', text: 'sensomotor. Defizit' }]),
        verlRegion('verl_becken', 'Becken', [{ wert: 'instabil', text: 'instabil' }]),
        verlRegion('verl_obere_extremitaeten', 'Obere Extremitäten', [{ wert: 'amputation', text: 'Amputation' }]),
        verlRegion('verl_untere_extremitaeten', 'Untere Extremitäten', [{ wert: 'amputation', text: 'Amputation' }]),
        verlRegion('verl_weichteile', 'Weichteile'),
        verlRegion('verl_gefaesse', 'Gefäße'),
      ],
    },
    {
      id: 'schwere',
      felder: [
        { id: 'polytrauma', label: 'Polytrauma nach Tscherne', typ: 'check', breite: 6, hinweis: 'Definition siehe Rückseite' },
        { id: 'fraktur_zwei_roehrenknochen', label: 'Fraktur von ≥ 2 großen Röhrenknochen', typ: 'check', breite: 6 },
      ],
    },
    {
      id: 'verbrennung',
      titel: 'Verbrennung, Verbrühung',
      felder: [
        { id: 'verbrennung', label: 'Verbrennung, Verbrühung', typ: 'check', breite: 12 },
        { id: 'verbrennung_grad1_kof', label: '1. Grades', typ: 'zahl', einheit: '% KOF', breite: 4, min: 0, max: 100 },
        { id: 'verbrennung_grad2_kof', label: '2. Grades', typ: 'zahl', einheit: '% KOF', breite: 4, min: 0, max: 100 },
        { id: 'verbrennung_grad3_kof', label: '3. Grades', typ: 'zahl', einheit: '% KOF', breite: 4, min: 0, max: 100 },
      ],
    },
    {
      id: 'mechanismus',
      titel: 'Unfallmechanismus',
      felder: [
        {
          id: 'unfall_sturz',
          label: 'Sturz',
          typ: 'radio',
          breite: 12,
          hinweis: 'Kinder: bis 2 Jahre Fallhöhe ≥ 90 cm, 2–14 Jahre Fallhöhe ≥ 1,5 m',
          optionen: [
            { wert: 'ebenerdig', text: 'ebenerdig' },
            { wert: 'unter3m', text: '< 3 m' },
            { wert: 'ab3m', text: '≥ 3 m' },
          ],
        },
        {
          id: 'unfall_verkehrsteilnehmer',
          label: 'Verkehrsteilnehmer',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'fussgaenger', text: 'Fußgänger' },
            { wert: 'e_scooter', text: 'E-Scooter' },
            { wert: 'fahrrad', text: 'Fahrrad' },
            { wert: 'e_bike', text: 'E-Bike u. Ä.' },
            { wert: 'motorrad', text: 'Motorrad / Sozius' },
            { wert: 'pkw', text: 'PKW-Insasse' },
            { wert: 'lkw', text: 'LKW-Insasse' },
            { wert: 'bus', text: 'Bus-Insasse' },
          ],
        },
        { id: 'hochrasanztrauma', label: 'Hochrasanztrauma', typ: 'check', breite: 12, hinweis: 'Δ Geschwindigkeit ≥ 30 km/h' },
        { id: 'helm_getragen', label: 'Helm getragen', typ: 'radio', breite: 6, optionen: [...ja_nein, { wert: 'unbekannt', text: 'unbekannt' }] },
        {
          id: 'unfall_weitere',
          label: 'Weitere Mechanismen',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'veraetzung', text: 'Verätzung' },
            { wert: 'explosion', text: 'Explosion / Verpuff.' },
            { wert: 'verschuettung', text: 'Verschüttung' },
            { wert: 'einklemmung', text: 'Einklemmung' },
            { wert: 'inhalationstrauma', text: 'Inhalationstrauma' },
            { wert: 'elektrounfall', text: 'Elektrounfall' },
            { wert: 'beinahe_ertrinken', text: 'Beinahe-Ertrinken' },
            { wert: 'tauchunfall', text: 'Tauchunfall' },
            { wert: 'suizidversuch', text: 'Suizid(versuch)' },
          ],
        },
        {
          id: 'gewaltanwendung',
          label: 'Gewaltanwendung',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'schlag', text: 'Schlag' },
            { wert: 'schuss', text: 'Schuss' },
            { wert: 'stich', text: 'Stich' },
            { wert: 'gewaltverbrechen', text: 'Gewaltverbrechen' },
            { wert: 'sonstige', text: 'Sonstige' },
          ],
        },
        { id: 'unfall_sonstige_text', label: 'Unfallmechanismus — Sonstige', typ: 'text', breite: 12 },
      ],
    },
  ],
}

const erstdiagnosen: Abschnitt = {
  id: 'erstdiagnosen',
  titel: 'Erstdiagnosen',
  seite: 1,
  zeile: 4,
  spalte: 2,
  spanne: 6,
  ordnung: 2,
  gruppen: [
    {
      id: 'diagnosen',
      felder: [
        { id: 'erstdiagnose_text', label: 'Erstdiagnosen', typ: 'langtext', breite: 12, pflicht: true },
        {
          id: 'naca',
          label: 'NACA-Score',
          typ: 'radio',
          breite: 12,
          pflicht: true,
          optionen: [
            { wert: 'I', text: 'I', hinweis: 'geringfügige Störung' },
            { wert: 'II', text: 'II', hinweis: 'leichte Störung' },
            { wert: 'III', text: 'III', hinweis: 'mäßige Störung' },
            { wert: 'IV', text: 'IV', hinweis: 'Lebensgefahr nicht auszuschließen' },
            { wert: 'V', text: 'V', hinweis: 'akute Lebensgefahr' },
            { wert: 'VI', text: 'VI', hinweis: 'Reanimation' },
            { wert: 'VII', text: 'VII', hinweis: 'Tod' },
          ],
        },
        { id: 'palliative_situation', label: 'Palliative Situation', typ: 'check', breite: 12 },
      ],
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Seite 2 — Rückseite
// ─────────────────────────────────────────────────────────────────────────────

const verlaufsprotokoll: Abschnitt = {
  id: 'verlaufsprotokoll',
  titel: 'Verlaufsprotokoll',
  seite: 2,
  zeile: 1,
  spalte: 1,
  spanne: 8,
  ordnung: 1,
  gruppen: [
    {
      id: 'verlauf',
      felder: [
        {
          id: 'verlauf',
          label: 'Verlauf',
          typ: 'verlauf',
          breite: 12,
          hinweis: 'Werte über 220 bzw. unter 40 werden in der obersten bzw. untersten Zeile zusammen mit dem zugehörigen Zeichen als Zahl eingetragen.',
        },
      ],
    },
  ],
}

/** Spalten einer Verlaufszeile. Die Reihenfolge ist die des Vordrucks. */
export const VERLAUF_SPALTEN: Feld[] = [
  { id: 'zeit', label: 'Zeit', typ: 'zeit' },
  { id: 'puls', label: 'Puls', typ: 'zahl', einheit: '/min', min: 0, max: 300 },
  { id: 'rr_sys', label: 'RR systolisch', typ: 'zahl', einheit: 'mmHg', min: 0, max: 300 },
  { id: 'rr_dia', label: 'RR diastolisch', typ: 'zahl', einheit: 'mmHg', min: 0, max: 200 },
  { id: 'hdm', label: 'HDM', typ: 'check' },
  { id: 'defi', label: 'Defibrillation', typ: 'check' },
  { id: 'transport', label: 'Transport', typ: 'check' },
  { id: 'intubation', label: 'Intubation', typ: 'check' },
  { id: 'suprarenin', label: 'Suprarenin', typ: 'zahl', einheit: 'mg' },
  { id: 'amiodaron', label: 'Amiodaron', typ: 'zahl', einheit: 'mg' },
  { id: 'o2', label: 'O₂', typ: 'zahl', einheit: 'l/min', min: 0, max: 15 },
  { id: 'spo2', label: 'SpO₂', typ: 'zahl', einheit: '%', min: 0, max: 100 },
  { id: 'etco2', label: 'etCO₂', typ: 'zahl', einheit: 'mmHg', min: 0, max: 150 },
]

const medikation: Abschnitt = {
  id: 'medikation',
  titel: 'Medikation',
  seite: 2,
  zeile: 1,
  spalte: 1,
  spanne: 8,
  ordnung: 2,
  gruppen: [
    {
      id: 'medikation',
      felder: [
        { id: 'medikation_keine', label: 'keine Medikation', typ: 'check', breite: 12 },
        { id: 'medikation', label: 'Medikation', typ: 'medikation', breite: 12 },
        {
          id: 'heilkundliche_intervention',
          label: 'Eigenständige oder eigenverantwortliche heilkundliche Interventionen durch RD',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'massnahmen', text: 'Maßnahmen' },
            { wert: 'medikamente', text: 'Medikamente' },
          ],
        },
        { id: 'heilkundliche_intervention_text', label: 'Intervention — Freitext', typ: 'text', breite: 12 },
        {
          id: 'lysetherapie',
          label: 'Lysetherapie',
          typ: 'radio',
          breite: 8,
          optionen: [
            { wert: 'vor_kreislaufstillstand', text: 'vor Kreislaufstillstand' },
            { wert: 'waehrend_kreislaufstillstand', text: 'während Kreislaufstillstand' },
            { wert: 'nach_rosc', text: 'nach ROSC' },
          ],
        },
        { id: 'lysetherapie_beginn', label: 'Lyse — Beginn', typ: 'zeit', breite: 4 },
      ],
    },
  ],
}

/** Spalten der Medikationstabelle. */
export const MEDIKATION_SPALTEN: Feld[] = [
  { id: 'wirkstoff', label: 'Wirkstoff / Handelsname / Infusion', typ: 'text' },
  { id: 'dosis', label: 'Dosis / Dosen', typ: 'text' },
  { id: 'applikation', label: 'Applikation', typ: 'text', hinweis: 'z. B. i.v., p.o., ossär, nasal …' },
]

const massnahmen: Abschnitt = {
  id: 'massnahmen',
  titel: 'Maßnahmen',
  seite: 2,
  zeile: 1,
  spalte: 2,
  spanne: 4,
  ordnung: 1,
  gruppen: [
    {
      id: 'zugaenge',
      titel: 'Zugänge',
      felder: [
        {
          id: 'zugang_art',
          label: 'Zugang',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'peripher', text: 'peripherer Zugang' },
            { wert: 'peripher_vorhanden', text: 'peripherer Zugang bereits vorhanden' },
            { wert: 'intraossaer', text: 'intraossäre Punktion' },
            { wert: 'intraossaer_vorhanden', text: 'intraossär bereits vorhanden' },
            { wert: 'zvk', text: 'ZVK' },
            { wert: 'zvk_vorhanden', text: 'ZVK bereits vorhanden' },
            { wert: 'arteriell', text: 'art. Zugang' },
            { wert: 'grosslumiger_katheter', text: 'großlum. Katheter (z. B. Shaldon)' },
            { wert: 'nasal_applikator', text: 'Nasal-Applikator' },
            { wert: 'sonstige', text: 'Sonstige' },
          ],
        },
        {
          id: 'zugang_peripher_ort',
          label: 'Peripherer Zugang — Ort',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'handruecken_r', text: 'Handrücken rechts' },
            { wert: 'handruecken_l', text: 'Handrücken links' },
            { wert: 'unterarm_r', text: 'Unterarm rechts' },
            { wert: 'unterarm_l', text: 'Unterarm links' },
            { wert: 'hals_r', text: 'Hals rechts' },
            { wert: 'hals_l', text: 'Hals links' },
            { wert: 'kopf', text: 'Kopf' },
            { wert: 'ellenbeuge_r', text: 'Ellenbeuge rechts' },
            { wert: 'ellenbeuge_l', text: 'Ellenbeuge links' },
            { wert: 'oberarm_r', text: 'Oberarm rechts' },
            { wert: 'oberarm_l', text: 'Oberarm links' },
            { wert: 'bein_r', text: 'Bein rechts' },
            { wert: 'bein_l', text: 'Bein links' },
            { wert: 'fuss_r', text: 'Fuß rechts' },
            { wert: 'fuss_l', text: 'Fuß links' },
          ],
        },
        {
          id: 'zugang_io_ort',
          label: 'Intraossär — Ort',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'tibia_prox_r', text: 'Tibia prox. rechts' },
            { wert: 'tibia_prox_l', text: 'Tibia prox. links' },
            { wert: 'tibia_dist_r', text: 'Tibia dist. rechts' },
            { wert: 'tibia_dist_l', text: 'Tibia dist. links' },
            { wert: 'humerus_r', text: 'Humerus rechts' },
            { wert: 'humerus_l', text: 'Humerus links' },
            { wert: 'sternum', text: 'Sternum' },
          ],
        },
        {
          id: 'zugang_zvk_ort',
          label: 'ZVK / arteriell — Ort',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'v_basilica_r', text: 'V. basilica / cephalica rechts' },
            { wert: 'v_basilica_l', text: 'V. basilica / cephalica links' },
            { wert: 'v_subclavia_r', text: 'V. subclavia rechts' },
            { wert: 'v_subclavia_l', text: 'V. subclavia links' },
            { wert: 'v_jug_int_r', text: 'V. jug. int. rechts' },
            { wert: 'v_jug_int_l', text: 'V. jug. int. links' },
            { wert: 'v_jug_ext_r', text: 'V. jug. ext. rechts' },
            { wert: 'v_jug_ext_l', text: 'V. jug. ext. links' },
            { wert: 'v_fem_r', text: 'V. fem. rechts' },
            { wert: 'v_fem_l', text: 'V. fem. links' },
            { wert: 'a_radialis_r', text: 'A. radialis rechts' },
            { wert: 'a_radialis_l', text: 'A. radialis links' },
            { wert: 'a_femoralis_r', text: 'A. femoralis rechts' },
            { wert: 'a_femoralis_l', text: 'A. femoralis links' },
          ],
        },
        {
          id: 'zugang_erschwert',
          label: 'Zugang erschwert',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'mehr_als_2_versuche', text: '> 2 Versuche' },
            { wert: 'unmoeglich', text: 'Zugang unmöglich → Verfahrenswechsel' },
          ],
        },
      ],
    },
    {
      id: 'atemweg',
      titel: 'Atemweg',
      felder: [
        { id: 'o2_flow', label: 'Sauerstoffgabe', typ: 'zahl', einheit: 'l/min', breite: 4, min: 0, max: 15 },
        { id: 'o2_praeoxygenierung', label: 'als Präoxygenierung', typ: 'check', breite: 4 },
        { id: 'absaugen', label: 'Absaugen', typ: 'check', breite: 4 },
        {
          id: 'atemweg_massnahmen',
          label: 'Atemwegsmaßnahmen',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'mechanisches_freimachen', text: 'mechan. Freimachen der Atemwege' },
            { wert: 'wendl_tubus', text: 'Wendl-Tubus' },
            { wert: 'guedel_tubus', text: 'Guedel-Tubus' },
            { wert: 'masken_beutel', text: 'Masken-/Beutel-Beatmung' },
            { wert: 'masken_beutel_unterstuetzend', text: 'Masken-/Beutel-Beatmung unterstützend' },
            { wert: 'masken_beutel_kontrolliert', text: 'Masken-/Beutel-Beatmung kontrolliert' },
            { wert: 'masken_beutel_nicht_moeglich', text: 'Masken-/Beutel-Beatmung nicht möglich' },
            { wert: 'supraglottisch', text: 'supraglottische Atemwegshilfe' },
            { wert: 'endotracheale_intubation', text: 'endotracheale Intubation' },
            { wert: 'videolaryngoskop', text: 'Videolaryngoskop' },
            { wert: 'koniotomie', text: 'Koniotomie / chirurgischer Atemweg' },
            { wert: 'trachealkanuelenwechsel', text: 'Trachealkanülenwechsel' },
            { wert: 'sonstiger_atemwegszugang', text: 'sonstiger Atemwegszugang' },
          ],
        },
        {
          id: 'supraglottisch_art',
          label: 'Supraglottische Atemwegshilfe',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'larynxmaske', text: 'Larynxmaske' },
            { wert: 'larynxtubus', text: 'Larynxtubus' },
          ],
        },
        {
          id: 'intubation_weg',
          label: 'Intubation',
          typ: 'radio',
          breite: 4,
          optionen: [
            { wert: 'oral', text: 'oral' },
            { wert: 'nasal', text: 'nasal' },
          ],
        },
        { id: 'tubus_groesse', label: 'Tubusgröße', typ: 'zahl', einheit: 'mm', breite: 4 },
        { id: 'intubation_erschwert', label: 'Intubation erschwert', typ: 'check', breite: 4 },
        { id: 'intubation_versuche', label: 'Anzahl Versuche', typ: 'zahl', breite: 4, min: 1, max: 10 },
      ],
    },
    {
      id: 'beatmung',
      titel: 'Beatmung',
      felder: [
        {
          id: 'beatmung_art',
          label: 'Beatmung',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'manuell', text: 'manuell' },
            { wert: 'maschinell', text: 'maschinell' },
          ],
        },
        {
          id: 'beatmung_modus',
          label: 'Modus',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'kontrolliert', text: 'kontrolliert' },
            { wert: 'assistiert', text: 'assistiert' },
            { wert: 'niv', text: 'NIV' },
          ],
        },
        { id: 'beatmung_fio2', label: 'FiO₂', typ: 'zahl', einheit: '%', breite: 3, min: 21, max: 100 },
        { id: 'beatmung_af', label: 'AF', typ: 'zahl', einheit: '/min', breite: 3, min: 0, max: 60 },
        { id: 'beatmung_amv', label: 'AMV', typ: 'zahl', einheit: 'l/min', breite: 3 },
        { id: 'beatmung_peep', label: 'PEEP', typ: 'zahl', einheit: 'mbar', breite: 3, min: 0, max: 30 },
        { id: 'beatmung_pmax', label: 'P max', typ: 'zahl', einheit: 'mbar', breite: 3, min: 0, max: 80 },
        { id: 'notfallnarkose', label: 'Notfallnarkose', typ: 'check', breite: 3 },
      ],
    },
    {
      id: 'defibrillation',
      titel: 'Defibrillation / Kardioversion',
      felder: [
        { id: 'defibrillation', label: 'Defibrillation', typ: 'check', breite: 6 },
        { id: 'kardioversion', label: 'Kardioversion', typ: 'check', breite: 6 },
        {
          id: 'defi_geraet',
          label: 'Gerät(e)',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'defi', text: 'Defi' },
            { wert: 'aed', text: 'AED' },
            { wert: 'public_access_aed', text: 'public access AED' },
          ],
        },
        { id: 'defi_erster_schock', label: '1. Schock (Zeitpunkt)', typ: 'zeit', breite: 6 },
        { id: 'rosc_zeitpunkt', label: '1. ROSC (Zeitpunkt)', typ: 'zeit', breite: 6 },
        { id: 'defi_anzahl', label: 'Anzahl Schock(s) insgesamt', typ: 'zahl', breite: 6, min: 0, max: 50 },
        { id: 'defi_energie_max', label: 'Energie max', typ: 'zahl', einheit: 'Joule', breite: 6 },
      ],
    },
    {
      id: 'reanimation_massnahmen',
      titel: 'Reanimation',
      felder: [
        { id: 'herzdruckmassage', label: 'Herzdruckmassage', typ: 'check', breite: 6 },
        { id: 'hdm_beginn', label: 'Beginn HDM', typ: 'zeit', breite: 6 },
        {
          id: 'hdm_hilfsmittel',
          label: 'Hilfsmittel',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'feedbacksystem', text: 'Feedbacksystem' },
            { wert: 'mechanisch', text: 'mechanisches Thoraxkompressionssystem' },
          ],
        },
        {
          id: 'rea_erweitert',
          label: 'Erweiterte Verfahren',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'ecpr', text: 'Extrakorporale CPR' },
            { wert: 'reboa', text: 'REBOA' },
            { wert: 'telefonreanimation', text: 'Telefonreanimation im Vorfeld' },
          ],
        },
      ],
    },
    {
      id: 'lagerung',
      titel: 'Spezielle Lagerung / Körpertemperatur-Management',
      felder: [
        {
          id: 'lagerung',
          label: 'Lagerung',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'schocklagerung', text: 'Schocklagerung' },
            { wert: 'stabile_seitenlage', text: 'stabile Seitenlage' },
            { wert: 'flachlagerung', text: 'Flachlagerung' },
            { wert: 'oberkoerper_hoch', text: 'Oberkörper-Hochlagerung' },
            { wert: 'sitzend', text: 'Sitzend' },
            { wert: 'inkubator', text: 'Inkubator' },
            { wert: 'zervikalstuetze', text: 'Zervikalstütze' },
            { wert: 'vakuummatratze', text: 'Vakuummatratze' },
            { wert: 'extremitaetenschiene', text: 'Extremitätenschiene' },
            { wert: 'schaufeltrage', text: 'Schaufeltrage' },
            { wert: 'spineboard', text: 'Spineboard' },
            { wert: 'lokale_kuehlung', text: 'lokale Kühlung' },
            { wert: 'systemische_kuehlung', text: 'system. Kühlung' },
            { wert: 'waermemanagement', text: 'Wärmemanagement' },
            { wert: 'sonstige', text: 'Sonstige' },
          ],
        },
        { id: 'lagerung_sonstige_text', label: 'Lagerung — Sonstige', typ: 'text', breite: 12 },
      ],
    },
    {
      id: 'weitere_massnahmen',
      titel: 'Weitere Maßnahmen',
      felder: [
        { id: 'spritzenpumpen_anzahl', label: 'Spritzenpumpe(n) — Anzahl', typ: 'zahl', breite: 4, min: 0, max: 10 },
        {
          id: 'weitere_massnahmen',
          label: 'Weitere Maßnahmen',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'invasiver_rr', text: 'invasiver RR' },
            { wert: 'ext_schrittmacher', text: 'ext. Schrittmacher' },
            { wert: 'zvd', text: 'ZVD' },
            { wert: 'icp', text: 'ICP' },
            { wert: 'impella', text: 'Impella' },
            { wert: 'iabp', text: 'IABP' },
            { wert: 'ecmo', text: 'ECMO' },
            { wert: 'verband', text: 'Verband' },
            { wert: 'reposition', text: 'Reposition' },
            { wert: 'thoraxverschlusspflaster', text: 'Thoraxverschlusspflaster' },
            { wert: 'thoraxdrainage_re', text: 'Thoraxdrainage re.' },
            { wert: 'thoraxdrainage_li', text: 'Thoraxdrainage li.' },
            { wert: 'thorakotomie', text: 'Thorakotomie' },
            { wert: 'entlastungspunktion_re', text: 'Entlastungspunktion re.' },
            { wert: 'entlastungspunktion_li', text: 'Entlastungspunktion li.' },
            { wert: 'ultraschall', text: 'Ultraschall' },
            { wert: 'magensonde', text: 'Magensonde' },
            { wert: 'blasenkatheter', text: 'Blasenkatheter' },
            { wert: 'tourniquet', text: 'Tourniquet' },
            { wert: 'beckenschlinge', text: 'Beckenschlinge' },
            { wert: 'haemostyptikum', text: 'Haemostyptikum' },
            { wert: 'entbindung', text: 'Entbindung' },
            { wert: 'neugeborenen_versorgung', text: 'Neugeborenen-Versorgung' },
            { wert: 'krisenintervention', text: 'Krisenintervention' },
            { wert: 'hygienemassnahmen', text: 'besondere Hygienemaßnahmen' },
            { wert: 'sonstige', text: 'Sonstige Maßnahmen' },
          ],
        },
        { id: 'weitere_massnahmen_text', label: 'Weitere Maßnahmen — Freitext', typ: 'text', breite: 12 },
      ],
    },
  ],
}

const reanimation: Abschnitt = {
  id: 'reanimation',
  titel: 'Reanimation / Tod / Todesfeststellung',
  seite: 2,
  zeile: 1,
  spalte: 1,
  spanne: 8,
  ordnung: 3,
  gruppen: [
    {
      id: 'rea',
      felder: [
        { id: 'rea', label: 'Reanimation', typ: 'check', breite: 4 },
        {
          id: 'rea_ergebnis',
          label: 'Ergebnis',
          typ: 'radio',
          breite: 8,
          optionen: [
            { wert: 'rosc_im_verlauf', text: 'ROSC im Verlauf' },
            { wert: 'niemals_rosc', text: 'niemals ROSC' },
            { wert: 'erfolglos', text: 'erfolglos' },
          ],
        },
        { id: 'keine_rea', label: 'keine Reanimation', typ: 'check', breite: 4 },
        {
          id: 'keine_rea_grund',
          label: 'Grund',
          typ: 'radio',
          breite: 8,
          optionen: [
            { wert: 'nicht_gewuenscht', text: 'nicht gewünscht / Patientenverfügung' },
            { wert: 'sichere_todeszeichen', text: 'sichere Todeszeichen' },
            { wert: 'aussichtslose_grunderkrankung', text: 'aussichtslose Grunderkrankung' },
            { wert: 'rosc_beim_eintreffen', text: 'Rea durch Vorbehandler mit ROSC beim Eintreffen' },
            { wert: 'sonstige', text: 'Sonstige' },
          ],
        },
        { id: 'keine_rea_grund_text', label: 'Grund — Freitext', typ: 'text', breite: 12 },
        {
          id: 'kh_uebergabe_rea',
          label: 'KH-Übergabe',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'mit_rosc', text: 'mit ROSC' },
            { wert: 'laufende_reanimation', text: 'laufende Reanimation' },
          ],
        },
      ],
    },
    {
      id: 'tod',
      titel: 'Tod',
      felder: [
        { id: 'tod', label: 'Tod', typ: 'check', breite: 4 },
        { id: 'tod_waehrend_transport', label: 'während des Transports', typ: 'check', breite: 4 },
        { id: 'todesfeststellung', label: 'Todesfeststellung', typ: 'check', breite: 4, hinweis: 'durch dokument. Rettungsmittel' },
        {
          id: 'todesart',
          label: 'Todesart',
          typ: 'radio',
          breite: 8,
          optionen: [
            { wert: 'natuerlich', text: 'natürlich' },
            { wert: 'unklar', text: 'unklar' },
            { wert: 'nicht_natuerlich', text: 'nicht natürlich' },
          ],
        },
        { id: 'todeszeitpunkt', label: 'Zeitpunkt', typ: 'zeit', breite: 4 },
        { id: 'todeszeitpunkt_unbestimmbar', label: 'Todeszeitpunkt nicht bestimmbar', typ: 'check', breite: 12 },
      ],
    },
    {
      id: 'ursache',
      titel: 'Vermutete Ursache Kreislaufstillstand',
      felder: [
        {
          id: 'rea_ursache',
          label: 'Vermutete Ursache',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'kardial', text: 'kardial' },
            { wert: 'trauma', text: 'Trauma' },
            { wert: 'ertrinken', text: 'Ertrinken' },
            { wert: 'hypoxie', text: 'Hypoxie' },
            { wert: 'intoxikation', text: 'Intoxikation' },
            { wert: 'icb_sab', text: 'ICB / SAB' },
            { wert: 'anaphylaxie', text: 'Anaphylaxie' },
            { wert: 'sepsis', text: 'Sepsis' },
            { wert: 'sids', text: 'SIDS' },
            { wert: 'verbluten', text: 'Verbluten' },
            { wert: 'stroke', text: 'Stroke' },
            { wert: 'metabolisch', text: 'metabolisch' },
            { wert: 'stromschlag', text: 'Stromschlag' },
            { wert: 'sonstige', text: 'Sonst.' },
          ],
        },
        { id: 'rea_bei_sportlicher_aktivitaet', label: 'bei sportl. Aktivität', typ: 'check', breite: 12 },
        {
          id: 'kollaps_beobachtet_durch',
          label: 'Kollaps beobachtet durch',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'ersthelfer', text: 'Ersthelfer' },
            { wert: 'app_ersthelfer', text: 'APP-Ersthelfer' },
            { wert: 'first_responder', text: 'First Resp.' },
            { wert: 'ktw', text: 'KTW-Besatzung' },
            { wert: 'rtw', text: 'RTW-Besatzg.' },
            { wert: 'na', text: 'NA-Besatzg' },
            { wert: 'sonst', text: 'Sonst' },
          ],
        },
        {
          id: 'hdm_beginn_durch',
          label: 'Beginn HDM durch',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'ersthelfer', text: 'Ersthelfer' },
            { wert: 'app_ersthelfer', text: 'APP-Ersthelfer' },
            { wert: 'first_responder', text: 'First Resp.' },
            { wert: 'ktw', text: 'KTW-Besatzung' },
            { wert: 'rtw', text: 'RTW-Besatzg.' },
            { wert: 'na', text: 'NA-Besatzg' },
            { wert: 'sonst', text: 'Sonst' },
          ],
        },
        {
          id: 'erste_defi_durch',
          label: 'Erste Defibrillation durch',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'ersthelfer', text: 'Ersthelfer' },
            { wert: 'app_ersthelfer', text: 'APP-Ersthelfer' },
            { wert: 'first_responder', text: 'First Resp.' },
            { wert: 'ktw', text: 'KTW-Besatzung' },
            { wert: 'rtw', text: 'RTW-Besatzg.' },
            { wert: 'na', text: 'NA-Besatzg' },
            { wert: 'sonst', text: 'Sonst' },
          ],
        },
      ],
    },
  ],
}

const uebergabebefund: Abschnitt = {
  id: 'uebergabebefund',
  titel: 'Übergabe — Befund bei Einsatzende',
  seite: 2,
  zeile: 2,
  spalte: 1,
  spanne: 12,
  ordnung: 1,
  gruppen: [
    {
      id: 'rahmen',
      felder: [
        { id: 'ub_keine', label: 'keine Übergabe', typ: 'check', breite: 4 },
        { id: 'ub_zeitpunkt', label: 'Zeitpunkt', typ: 'zeit', breite: 4 },
        { id: 'ub_gcs', label: 'Glasgow Coma Scale', typ: 'zahl', breite: 4, min: 3, max: 15 },
      ],
    },
    {
      id: 'werte',
      felder: [
        { id: 'ub_rr_sys', label: 'RR systolisch', typ: 'zahl', einheit: 'mmHg', breite: 3, min: 0, max: 300 },
        { id: 'ub_rr_dia', label: 'RR diastolisch', typ: 'zahl', einheit: 'mmHg', breite: 3, min: 0, max: 200 },
        { id: 'ub_hf', label: 'HF', typ: 'zahl', einheit: '/min', breite: 3, min: 0, max: 300 },
        {
          id: 'ub_hf_rhythmus',
          label: 'Rhythmus',
          typ: 'radio',
          breite: 3,
          optionen: [
            { wert: 'rhythmisch', text: 'rhythmisch' },
            { wert: 'arrhythmisch', text: 'arrhythmisch' },
          ],
        },
        { id: 'ub_bz', label: 'BZ', typ: 'zahl', breite: 3, min: 0, max: 1000 },
        {
          id: 'ub_bz_einheit',
          label: 'BZ-Einheit',
          typ: 'radio',
          breite: 3,
          optionen: [
            { wert: 'mgdl', text: 'mg/dl' },
            { wert: 'mmoll', text: 'mmol/l' },
          ],
        },
        {
          id: 'ub_bz_grenze',
          label: 'BZ außerhalb Messbereich',
          typ: 'radio',
          breite: 3,
          optionen: [
            { wert: 'low', text: 'LOW' },
            { wert: 'high', text: 'HIGH' },
          ],
        },
        { id: 'ub_af', label: 'AF', typ: 'zahl', einheit: '/min', breite: 3, min: 0, max: 80 },
        { id: 'ub_spo2', label: 'SpO₂', typ: 'zahl', einheit: '%', breite: 3, min: 0, max: 100 },
        {
          id: 'ub_spo2_bedingung',
          label: 'SpO₂ gemessen',
          typ: 'radio',
          breite: 3,
          optionen: [
            { wert: 'raumluft', text: 'bei Raumluft' },
            { wert: 'o2_gabe', text: 'unter O₂-Gabe' },
          ],
        },
        { id: 'ub_temp', label: 'Temp', typ: 'zahl', einheit: '°C', breite: 3, min: 20, max: 45 },
        { id: 'ub_etco2', label: 'etCO₂', typ: 'zahl', einheit: 'mmHg', breite: 3, min: 0, max: 150 },
        { id: 'ub_schmerz', label: 'Schmerzen', typ: 'skala', breite: 9, min: 0, max: 10 },
        {
          id: 'ub_schmerzerleben',
          label: 'Schmerzerleben',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'tolerabel', text: 'tolerabel' },
            { wert: 'nicht_tolerabel', text: 'nicht tolerabel' },
          ],
        },
      ],
    },
    {
      id: 'befunde',
      felder: [
        { id: 'ub_atmung_nicht_us', label: 'Atmung nicht untersucht', typ: 'check', breite: 3 },
        {
          id: 'ub_atmung',
          label: 'Atmung',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'unauffaellig', text: 'unauffällig' },
            { wert: 'apnoe', text: 'Apnoe' },
            { wert: 'stridor', text: 'Stridor' },
            { wert: 'hyperventilation', text: 'Hyperventilation' },
            { wert: 'dyspnoe', text: 'Dyspnoe' },
            { wert: 'beatmung', text: 'Beatmung' },
            { wert: 'zyanose', text: 'Zyanose' },
            { wert: 'atemwegsverlegung', text: 'Atemwegsverlegung' },
            { wert: 'schnappatmung', text: 'Schnappatmung' },
            { wert: 'spastik', text: 'Spastik' },
            { wert: 'rasselgeraeusche', text: 'Rasselgeräusche' },
            { wert: 'sonstiges_muster', text: 'sonstige patholog. Atemmuster (Biot, Cheyne-Stokes etc.)' },
          ],
        },
        { id: 'ub_bewusstsein_nicht_us', label: 'Bewusstsein nicht untersucht', typ: 'check', breite: 3 },
        {
          id: 'ub_bewusstsein',
          label: 'Bewusstsein',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'wach', text: 'wach' },
            { wert: 'reaktion_ansprache', text: 'Reakt. auf Ansprache' },
            { wert: 'reaktion_schmerz', text: 'Reakt. auf Schmerzreiz' },
            { wert: 'bewusstlos', text: 'bewusstlos' },
            { wert: 'nicht_beurteilbar', text: 'nicht beurteilbar' },
            { wert: 'analgosediert', text: 'analgosediert / Narkose' },
          ],
        },
      ],
    },
  ],
}

const einsatzverlauf: Abschnitt = {
  id: 'einsatzverlauf',
  titel: 'Einsatzverlauf — Besonderheiten',
  seite: 2,
  zeile: 3,
  spalte: 1,
  spanne: 4,
  ordnung: 1,
  gruppen: [
    {
      id: 'besonderheiten',
      felder: [
        {
          id: 'besonderheiten',
          label: 'Besonderheiten',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'kein_notarzt_verfuegbar', text: 'zeitnah ist kein Notarzt verfügbar' },
            { wert: 'uebernahme_arztbesetzt', text: 'Übernahme aus arztbesetztem Rettungsmittel' },
            { wert: 'uebergabe_arztbesetzt', text: 'Übergabe an arztbesetztes Rettungsmittel' },
            { wert: 'transport_klinik', text: 'Transport in Klinik' },
            { wert: 'naechste_klinik_nimmt_nicht_auf', text: 'nächste Klinik nimmt nicht auf' },
            { wert: 'zwangsbelegung', text: 'Zwangsbelegung' },
            { wert: 'zwangsunterbringung', text: 'Zwangsunterbringung' },
            { wert: 'nur_untersuchung', text: 'nur Untersuchung und Behandlung' },
            { wert: 'erschwerter_zugang', text: 'erschwerter Pat.-Zugang' },
            { wert: 'techn_rettung', text: 'techn. Rettung' },
            { wert: 'infektionstransport', text: 'Infektionstransport' },
            { wert: 'infektionstransport_hoher_aufwand', text: '… mit hohem Aufwand' },
            { wert: 'lna_am_einsatz', text: 'LNA am Einsatz' },
            { wert: 'manv', text: 'MANV' },
            { wert: 'mehrere_patienten', text: 'Behandlung mehrerer Patienten' },
            { wert: 'abbruch_folgeeinsatz', text: 'Abbruch wegen Folgeeinsatz' },
            { wert: 'gewalt_gegen_einsatzkraefte', text: 'Gewalt gegen Einsatzkräfte' },
          ],
        },
      ],
    },
  ],
}

const transport: Abschnitt = {
  id: 'transport',
  titel: 'Patienten-Transport',
  seite: 2,
  zeile: 3,
  spalte: 2,
  spanne: 4,
  ordnung: 1,
  gruppen: [
    {
      id: 'kein_transport',
      titel: 'kein Transport',
      felder: [
        {
          id: 'kein_transport_grund',
          label: 'kein Transport',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'kein_patient', text: 'kein Patient' },
            { wert: 'tod', text: 'Tod' },
            { wert: 'ambulante_versorgung', text: 'ambulante Versorgung' },
            { wert: 'transport_abgelehnt', text: 'Pat. lehnt Transport ab' },
            { wert: 'therapieverzicht', text: 'Bewusster Therapieverzicht / -beschränkg.' },
            { wert: 'verweis_amb_sektor', text: 'Verweis an amb. Sektor (HA, ÄBD etc.)' },
            { wert: 'uebergabe_polizei', text: 'Patientenübergabe an Polizei' },
            { wert: 'ausfall_rettungsmittel', text: 'Ausfall Rettungsmittel (Unfall, Defekt etc.)' },
            { wert: 'rettungsmittel_nicht_geeignet', text: 'Rettungsmittel nicht geeignet' },
            { wert: 'transport_durch_dritte', text: 'Transport durch Dritte (Taxi etc.)' },
            { wert: 'sonstiger_transport', text: 'Sonstiger Transport' },
          ],
        },
      ],
    },
    {
      id: 'transport_durch',
      titel: 'Transport durch',
      felder: [
        {
          id: 'transport_durch',
          label: 'Transport durch',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'rtw', text: 'RTW' },
            { wert: 'naw', text: 'NAW' },
            { wert: 'ktw', text: 'KTW' },
            { wert: 'rth_ith', text: 'RTH / ITH' },
            { wert: 'n_ktw', text: 'N-KTW' },
            { wert: 's_rtw', text: 'S-RTW' },
            { wert: 'itw', text: 'ITW' },
            { wert: 'sonstige', text: 'Sonstige' },
          ],
        },
        { id: 'sondersignal', label: 'Transport mit Sondersignal', typ: 'check', breite: 12 },
        {
          id: 'transportbegleitung',
          label: 'ärztliche Transportbegleitung durch',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'keine', text: 'keine ärztliche Begleitung' },
            { wert: 'notarzt', text: 'Notarzt (bodengebunden)' },
            { wert: 'notarzt_rth', text: 'Notarzt RTH / ITH' },
            { wert: 'klinik_arzt', text: 'Klinik-Arzt' },
            { wert: 'niedergelassener_arzt', text: 'niedergel. Arzt' },
            { wert: 'sonstiger_arzt', text: 'sonstiger Arzt' },
          ],
        },
        { id: 'telenotarzt', label: 'Telenotarzt', typ: 'check', breite: 12 },
        {
          id: 'spezieller_einsatz',
          label: 'Spezieller Einsatz',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'intensivtransport', text: 'Intensivtransport' },
            { wert: 'hilfeleistung', text: 'Hilfeleistung' },
            { wert: 'personaltransport', text: 'Personaltransport' },
            { wert: 'materialtransport', text: 'Materialtransport' },
            { wert: 'unterstuetzung_anderes_rm', text: 'Unterstützung für anderes Rettungsmittel' },
          ],
        },
      ],
    },
  ],
}

const uebergabe: Abschnitt = {
  id: 'uebergabe',
  titel: 'Übergabe',
  seite: 2,
  zeile: 3,
  spalte: 1,
  spanne: 4,
  ordnung: 2,
  gruppen: [
    {
      id: 'uebergabe',
      felder: [
        {
          id: 'uebergabe_ziel',
          label: 'Übergabe an',
          typ: 'radio',
          breite: 12,
          optionen: [
            { wert: 'keine', text: 'keine' },
            { wert: 'hausarzt', text: 'Hausarzt / KV-Arzt vor Ort' },
            { wert: 'einsatzstelle', text: 'Einsatzstelle' },
            { wert: 'fachambulanz', text: 'Fachambulanz' },
            { wert: 'op_direkt', text: 'OP direkt' },
            { wert: 'zna', text: 'ZNA / INA / PINA' },
            { wert: 'schockraum', text: 'Schockraum' },
            { wert: 'inz_kinz', text: 'INZ / KINZ' },
            { wert: 'stroke_unit', text: 'Stroke Unit' },
            { wert: 'herzkatheterlabor', text: 'Herzkatheterlabor' },
            { wert: 'cpu', text: 'CPU' },
            { wert: 'intensivstation', text: 'Intensivstation' },
            { wert: 'allgemeinstation', text: 'Allgemeinstation' },
            { wert: 'ct_mr', text: 'CT / MR' },
            { wert: 'praxis', text: 'Praxis' },
            { wert: 'kv_bereitschaftspraxis', text: 'KV-Bereitschaftspraxis' },
            { wert: 'kreisssaal', text: 'Kreißsaal' },
            { wert: 'sonstige', text: 'Sonstige' },
          ],
        },
        { id: 'uebergabe_ziel_text', label: 'Übergabe an — Freitext', typ: 'text', breite: 12 },
        { id: 'uebergabe_verzoegert', label: 'Übergabe verzögert', typ: 'check', breite: 12 },
        { id: 'uebergabe_name', label: 'Übergabe an (Name)', typ: 'text', breite: 12 },
      ],
    },
  ],
}

const bemerkungen: Abschnitt = {
  id: 'bemerkungen',
  titel: 'Bemerkungen',
  seite: 2,
  zeile: 3,
  spalte: 3,
  spanne: 4,
  ordnung: 2,
  gruppen: [
    {
      id: 'bemerkungen',
      felder: [
        {
          id: 'behandlungsgrenzen',
          label: 'Behandlungsgrenzen',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'massnahmenverweigerung', text: 'Massnahmenverweigerung durch Patient' },
            { wert: 'therapieverzicht', text: 'bewusster Therapieverzicht' },
            { wert: 'kontraindikation', text: 'Indizierte Maßn. wg. Kontraindikation unterlassen' },
          ],
        },
        {
          id: 'bemerkungen',
          label: 'Bemerkungen',
          typ: 'langtext',
          breite: 12,
          hinweis: 'z. B. Verlauf, Hausarzt, Vormedikation, Telefonnummer der Angehörigen, Notkompetenz-Maßnahmen …',
        },
        { id: 'hausarzt', label: 'Hausarzt', typ: 'text', breite: 6 },
        { id: 'angehoeriger', label: 'Angehöriger / Telefon', typ: 'text', breite: 6 },
      ],
    },
    {
      id: 'unterschrift',
      felder: [
        { id: 'ausfueller_name', label: 'Unterschrift Dokumentverantwortlicher', typ: 'text', breite: 8, pflicht: true, hinweis: 'Name zusätzlich in Druckschrift, ggf. Funktion, ggf. Rückruf-Telefon-Nr.' },
        { id: 'ausfueller_zeit', label: 'Zeitpunkt', typ: 'zeit', breite: 4 },
      ],
    },
  ],
}

const protokollkennung: Abschnitt = {
  id: 'protokollkennung',
  titel: 'Notfall-Einsatzprotokoll',
  seite: 1,
  zeile: 1,
  spalte: 1,
  spanne: 5,
  ordnung: 2,
  gruppen: [
    {
      id: 'kennung',
      felder: [
        { id: 'einsatz_nr', label: 'Einsatz-Nr.', typ: 'text', breite: 4, pflicht: true },
        { id: 'auftrags_nr', label: 'Pat.-/Auftrags-Nr.', typ: 'text', breite: 4 },
        { id: 'pers_nr', label: 'Pers.-Nr.', typ: 'text', breite: 4 },
        { id: 'standort', label: 'Standort', typ: 'text', breite: 6 },
        { id: 'leitstelle', label: 'Leitstelle', typ: 'text', breite: 6, hinweis: 'KFZ-Kennzeichen' },
        {
          id: 'dokumentierend',
          label: 'Dokumentierend',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'arzt', text: '(Not-)Arzt' },
            { wert: 'rettungsdienst', text: 'Rettungsdienst' },
          ],
        },
      ],
    },
  ],
}

const symptombeginn: Abschnitt = {
  id: 'symptombeginn',
  titel: 'Symptom-Beginn',
  seite: 1,
  zeile: 1,
  spalte: 3,
  spanne: 3,
  ordnung: 1,
  gruppen: [
    {
      id: 'symptombeginn',
      titel: 'Symptom-Beginn',
      felder: [
        { id: 'symptombeginn_zeit', label: 'Symptom-Beginn', typ: 'zeit', breite: 3 },
        {
          id: 'symptombeginn_art',
          label: 'Angabe',
          typ: 'radio',
          breite: 3,
          optionen: [
            { wert: 'gesichert', text: 'gesichert' },
            { wert: 'geschaetzt', text: 'geschätzt' },
          ],
        },
        { id: 'symptombeginn_ueber24h', label: 'vor über 24 h', typ: 'check', breite: 2 },
        { id: 'kollaps_beobachtet', label: 'Kollaps beobachtet', typ: 'check', breite: 2 },
        { id: 'symptombeginn_unbekannt', label: 'Unbekannt', typ: 'check', breite: 2 },
      ],
    },
  ],
}

const qualifikation: Abschnitt = {
  id: 'qualifikation',
  titel: 'Qualifikation',
  seite: 1,
  zeile: 1,
  spalte: 3,
  spanne: 3,
  ordnung: 3,
  gruppen: [
    {
      id: 'qualifikation',
      felder: [
        {
          id: 'arzt_status',
          label: 'Arzt',
          typ: 'radio',
          breite: 4,
          optionen: [
            { wert: 'weiterbildung', text: 'Arzt in Weiterbildung' },
            { wert: 'facharzt', text: 'Facharzt' },
          ],
        },
        {
          id: 'arzt_fach',
          label: 'Fachrichtung',
          typ: 'mehrfach',
          breite: 8,
          optionen: [
            { wert: 'anaesthesie', text: 'Anästhesie' },
            { wert: 'paediatrie', text: 'Pädiatrie' },
            { wert: 'chirurgie', text: 'Chirurgie' },
            { wert: 'neurologie', text: 'Neurologie' },
            { wert: 'innere', text: 'Innere' },
            { wert: 'allgemeinmedizin', text: 'Allg. Medizin' },
            { wert: 'notfallmedizin', text: 'Notfallmed.' },
            { wert: 'intensivmedizin', text: 'Intensivmed.' },
            { wert: 'kanm', text: 'KANM' },
            { wert: 'andere', text: 'Andere' },
          ],
        },
        {
          id: 'qualifikation_rd',
          label: 'Qualifikation Rettungsdienst',
          typ: 'radio',
          breite: 8,
          optionen: [
            { wert: 'rett_ass', text: 'Rett.-Ass.' },
            { wert: 'rett_san', text: 'Rett.-San.' },
            { wert: 'notfallsan', text: 'Notfallsanitäter' },
            { wert: 'int_pflege', text: '(Int.-)Pflege' },
          ],
        },
        { id: 'fahrzeug', label: 'Standort / Rufname eigenes Fahrzeug', typ: 'text', breite: 12 },
      ],
    },
  ],
}

const neurologie_ende: Abschnitt = {
  id: 'neurologie_ende',
  titel: 'Neurologie bei Einsatzende',
  seite: 2,
  zeile: 3,
  spalte: 3,
  spanne: 4,
  ordnung: 1,
  gruppen: [
    {
      id: 'neuro_ende',
      titel: 'Neurologie bei Einsatzende',
      felder: [
        {
          id: 'ub_neuro_status',
          label: 'Neurologie bei Einsatzende',
          typ: 'radio',
          breite: 8,
          optionen: [
            { wert: 'unveraendert', text: 'unverändert' },
            { wert: 'neu_erhoben', text: 'neu erhoben' },
          ],
        },
        {
          id: 'ub_extremitaet_arm_re',
          label: 'Arm rechts',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'einseitig_absinken', text: 'einseitiges Absinken' },
            { wert: 'kein_anheben', text: 'kein Anheben' },
            { wert: 'keine_bewegung', text: 'keine Bewegung' },
          ],
        },
        {
          id: 'ub_extremitaet_arm_li',
          label: 'Arm links',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'einseitig_absinken', text: 'einseitiges Absinken' },
            { wert: 'kein_anheben', text: 'kein Anheben' },
            { wert: 'keine_bewegung', text: 'keine Bewegung' },
          ],
        },
        {
          id: 'ub_extremitaet_bein_re',
          label: 'Bein rechts',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'einseitig_absinken', text: 'einseitiges Absinken' },
            { wert: 'kein_anheben', text: 'kein Anheben' },
            { wert: 'keine_bewegung', text: 'keine Bewegung' },
          ],
        },
        {
          id: 'ub_extremitaet_bein_li',
          label: 'Bein links',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'einseitig_absinken', text: 'einseitiges Absinken' },
            { wert: 'kein_anheben', text: 'kein Anheben' },
            { wert: 'keine_bewegung', text: 'keine Bewegung' },
          ],
        },
        {
          id: 'ub_neuro_auffaelligkeiten',
          label: 'Auffälligkeiten',
          typ: 'mehrfach',
          breite: 12,
          optionen: [
            { wert: 'ohne_befund', text: 'ohne path. Befund' },
            { wert: 'nicht_beurteilbar', text: 'nicht beurteilbar' },
            { wert: 'gesichtslaehmung', text: 'Gesichtslähmung' },
            { wert: 'sehstoerung', text: 'Sehstörung' },
            { wert: 'herdblick', text: 'Herdblick' },
            { wert: 'sprachstoerung', text: 'Sprachstörung / Sprechstörung' },
            { wert: 'schluckstoerung', text: 'Schluckstörung' },
            { wert: 'querschnittssymptomatik', text: 'Querschnittssympt.' },
            { wert: 'babinski', text: 'Babinski Zeichen' },
            { wert: 'meningismus', text: 'Meningismus' },
            { wert: 'uebelkeit_erbrechen', text: 'Übelkeit / Erbrechen' },
            { wert: 'kopfschmerz', text: 'Kopfschmerz' },
            { wert: 'gangunsicherheit', text: 'Gangunsicherheit / Schwindel' },
            { wert: 'sonstige', text: 'Sonstige' },
          ],
        },
        { id: 'ub_neuro_sonstige_text', label: 'Sonstige — Freitext', typ: 'text', breite: 12 },
        {
          id: 'ub_lichtreaktion_rechts',
          label: 'Pupillenreaktion rechts',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'prompt', text: 'prompt' },
            { wert: 'traege', text: 'träge' },
            { wert: 'keine', text: 'keine' },
          ],
        },
        {
          id: 'ub_lichtreaktion_links',
          label: 'Pupillenreaktion links',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'prompt', text: 'prompt' },
            { wert: 'traege', text: 'träge' },
            { wert: 'keine', text: 'keine' },
          ],
        },
        {
          id: 'ub_pupillenweite_rechts',
          label: 'Pupillenweite rechts',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'eng', text: 'eng' },
            { wert: 'mittel', text: 'mittel' },
            { wert: 'weit', text: 'weit' },
            { wert: 'entrundet', text: 'entrundet' },
          ],
        },
        {
          id: 'ub_pupillenweite_links',
          label: 'Pupillenweite links',
          typ: 'radio',
          breite: 6,
          optionen: [
            { wert: 'eng', text: 'eng' },
            { wert: 'mittel', text: 'mittel' },
            { wert: 'weit', text: 'weit' },
            { wert: 'entrundet', text: 'entrundet' },
          ],
        },
      ],
    },
  ],
}

export const DIVI_ABSCHNITTE: Abschnitt[] = [
  stammdaten,
  protokollkennung,
  einsatzdaten,
  symptombeginn,
  zeiten,
  qualifikation,
  zielklinik,
  mannschaft,
  notfallgeschehen,
  neurologie_erst,
  messwerte_erst,
  erkrankungen,
  verletzungen,
  erstdiagnosen,
  verlaufsprotokoll,
  medikation,
  massnahmen,
  reanimation,
  uebergabebefund,
  neurologie_ende,
  einsatzverlauf,
  transport,
  uebergabe,
  bemerkungen,
]

/** Version des Vordrucks, auf dem dieser Katalog beruht. */
export const DIVI_VERSION = '7.1'

/** Alle Abschnitte einer der beiden A4-Seiten, in Druckreihenfolge. */
export function abschnitteDerSeite(seite: 1 | 2): Abschnitt[] {
  return DIVI_ABSCHNITTE.filter((a) => a.seite === seite).sort(
    (a, b) => a.zeile - b.zeile || a.spalte - b.spalte || a.ordnung - b.ordnung,
  )
}

/** Eine Saeule des Vordrucks: alles, was in einem Band untereinander steht. */
export type Saeule = { spalte: number; spanne: number; abschnitte: Abschnitt[] }

/** Ein Band des Vordrucks, von links nach rechts in Saeulen geteilt. */
export type Band = { zeile: number; saeulen: Saeule[] }

/**
 * Das Raster einer Seite, so wie es auf dem Papier liegt: Baender von oben
 * nach unten, darin Saeulen von links nach rechts, darin Abschnitte
 * untereinander. Maske und Ausdruck bauen beide hierauf auf.
 */
export function rasterDerSeite(seite: 1 | 2): Band[] {
  const baender = new Map<number, Map<number, Saeule>>()
  for (const abschnitt of abschnitteDerSeite(seite)) {
    let band = baender.get(abschnitt.zeile)
    if (!band) {
      band = new Map()
      baender.set(abschnitt.zeile, band)
    }
    let saeule = band.get(abschnitt.spalte)
    if (!saeule) {
      saeule = { spalte: abschnitt.spalte, spanne: abschnitt.spanne, abschnitte: [] }
      band.set(abschnitt.spalte, saeule)
    }
    saeule.abschnitte.push(abschnitt)
  }
  return [...baender.entries()]
    .sort(([a], [b]) => a - b)
    .map(([zeile, band]) => ({
      zeile,
      saeulen: [...band.values()]
        .sort((a, b) => a.spalte - b.spalte)
        .map((s) => ({ ...s, abschnitte: [...s.abschnitte].sort((a, b) => a.ordnung - b.ordnung) })),
    }))
}

/** Jedes Feld des Katalogs, flach. */
export function alleFelder(): Feld[] {
  return DIVI_ABSCHNITTE.flatMap((a) => a.gruppen.flatMap((g) => g.felder))
}

/** Ein Feld anhand seiner ID. */
export function feldFinden(id: string): Feld | undefined {
  return alleFelder().find((f) => f.id === id)
}

/** Die Pflichtfelder nach MIND. */
export function pflichtfelder(): Feld[] {
  return alleFelder().filter((f) => f.pflicht)
}

/** Lesbarer Text zu einem gespeicherten Wert. */
export function wertText(feld: Feld, wert: unknown): string {
  if (wert === undefined || wert === null || wert === '') return ''
  if (feld.typ === 'check') return wert ? 'ja' : ''
  if (feld.optionen && feld.optionen.length > 0) {
    const liste = Array.isArray(wert) ? wert : [wert]
    return liste
      .map((w) => feld.optionen?.find((o) => o.wert === w)?.text ?? String(w))
      .join(', ')
  }
  const text = String(wert)
  return feld.einheit ? `${text} ${feld.einheit}` : text
}
