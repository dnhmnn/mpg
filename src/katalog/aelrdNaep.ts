// Die Zuordnung des gedruckten ÄLRD-Bogens auf die Norm (DIVI 6.0 / NAEP).
//
// WARUM HIER UND NICHT BEIM EXPORT: Eine Übersetzung, die bei jedem Export
// läuft, kann bei jedem Export danebengehen — zweimal ist uns das in diesem
// Projekt fast passiert (der Druck der Fassung 2.0 lief durch die
// Übersetzung für die alten Feldnamen und verlor fünf von sechs Feldern;
// die Mehrfachauswahl nahm nur das erste Kreuz und machte aus "blass UND
// kaltschweißig" ein "blass"). Beides fiel nur beim Durchspielen im Browser
// auf. Diese Tabelle wird stattdessen einmal gelesen — beim Umstellen der
// Speicherung auf die Codes der Norm. Danach gibt es nur noch ein Format.
//
// VOLLSTÄNDIGKEIT IST ERZWUNGEN: aelrdNaep.test.ts schlägt fehl, sobald ein
// Feld oder eine Option des Bogens hier fehlt. Es gibt keinen dritten
// Zustand neben "hat ein Ziel in der Norm" und "gehört in den Anhang" —
// nichts kann stillschweigend liegenbleiben.
//
// DER ANHANG ist das, was der Bogen führt und die Norm nicht kennt. Es wird
// gespeichert und gedruckt, aber nicht übermittelt. Jeder Eintrag nennt den
// Grund, damit später nachvollziehbar ist, ob es eine Lücke der Norm ist
// oder eine Eigenheit des bayerischen Bogens.

import { AELRD_FELDER, type AelrdFeld } from './aelrd'

/** Wohin eine Angabe des Bogens in der Norm gehört. */
export type NaepZiel =
  /** Ein Feld oder Freitext der Norm. */
  | { art: 'wert'; code: string; hinweis?: string }
  /** Ein Pfad in einem strukturierten Block (Stammdaten, Einsatzort, …). */
  | { art: 'struktur'; code: string; pfad: string; hinweis?: string }
  /** Eine Option einer Auswahl. */
  | { art: 'option'; auswahl: string; option: string; hinweis?: string }
  /** Die leer-Angabe eines Abschnitts oder einer Auswahl. */
  | { art: 'leer'; ziel: string; code: string; hinweis?: string }
  /** Eine Ja/Nein-Frage der Norm. */
  | { art: 'frage'; code: string; antwort: 'J' | 'N' | 'UB'; hinweis?: string }
  /** Der Sonstiges-Freitext einer Auswahl. */
  | { art: 'sonstiges'; auswahl: string; code: string; hinweis?: string }
  /** Ein Feld des Bogens, das in der Norm auf mehrere trifft. */
  | { art: 'geteilt'; ziele: NaepZiel[]; hinweis?: string }
  /**
   * Gehört in die Norm, aber der Bogen hat die falsche Form: ein Freitext,
   * wo die Norm eine Auswahl führt, ein Haken, wo sie eine Bewertung je
   * Gliedmaße verlangt. Diese Einträge sind die Arbeitsliste für den Umbau
   * der Maske — bis dahin lässt sich das Feld nicht verlustfrei übermitteln.
   */
  | { art: 'umbau'; code: string; was: string }
  /**
   * Das zweite Kästchen des Bogens für eine Angabe, die anderswo erfasst
   * wird. Es hat kein eigenes Ziel in der Norm, weil es keine eigene Angabe
   * ist — siehe aelrdSpiegel.ts.
   */
  | { art: 'spiegel'; quelle: string }
  /** Die Norm kennt es nicht. Bleibt im Responda-Anhang. */
  | { art: 'anhang'; grund: string }

const wert = (code: string, hinweis?: string): NaepZiel => ({ art: 'wert', code, hinweis })
const str = (code: string, pfad: string, hinweis?: string): NaepZiel =>
  ({ art: 'struktur', code, pfad, hinweis })
const opt = (auswahl: string, option: string, hinweis?: string): NaepZiel =>
  ({ art: 'option', auswahl, option, hinweis })
const leer = (ziel: string, code: string, hinweis?: string): NaepZiel =>
  ({ art: 'leer', ziel, code, hinweis })
const frage = (code: string, hinweis?: string): NaepZiel =>
  ({ art: 'frage', code, antwort: 'J', hinweis })
const sonst = (auswahl: string, code: string, hinweis?: string): NaepZiel =>
  ({ art: 'sonstiges', auswahl, code, hinweis })
const geteilt = (ziele: NaepZiel[], hinweis?: string): NaepZiel => ({ art: 'geteilt', ziele, hinweis })
const umbau = (code: string, was: string): NaepZiel => ({ art: 'umbau', code, was })
const spiegel = (quelle: string): NaepZiel => ({ art: 'spiegel', quelle })
const anhang = (grund: string): NaepZiel => ({ art: 'anhang', grund })

export type AelrdNaepZuordnung = {
  /** Für Felder ohne Optionen. */
  feld?: NaepZiel
  /** Für Felder mit Optionen: Speicherwert des Bogens → Ziel. */
  optionen?: Record<string, NaepZiel>
}

const KEIN_ATEMWEGSBLOCK = 'Die Norm hat keinen Befundblock Atemwege; sie führt nur die Atmung'
const KEIN_KREISLAUFBLOCK = 'Die Norm hat keinen Befundblock Kreislauf'
const KEIN_MESSORT = 'Die Norm führt den Messort der Temperatur nicht'
const KEINE_UB_NEURO = 'Die Norm erhebt bei der Übergabe nur das Bewusstsein, keine Neurologie'

export const AELRD_NAEP: Record<string, AelrdNaepZuordnung> = {
  // ── Stammdaten ────────────────────────────────────────────────────────
  name: { feld: str('A08', 'Patient.Name') },
  vorname: { feld: str('A08', 'Patient.Vorname') },
  gebdatum: { feld: str('A08', 'Patient.GebDat') },
  strasse: { feld: str('A08', 'Adresse.Strasse') },
  plz_ort: {
    feld: geteilt([str('A08', 'Adresse.PLZ'), str('A08', 'Adresse.Ort')],
      'Der Bogen führt ein Feld, die Norm zwei — beim Umstellen zu trennen'),
  },
  kasse: {
    feld: geteilt([str('A08', 'Versicherung.Kasse'), str('A08', 'Versicherung.Kasse@nr')],
      'Der Bogen schreibt "Kasse / Nr." in ein Feld, die Norm trennt Name und Nummer'),
  },
  versnr: { feld: str('A08', 'Versicherung.VersNr') },
  geschlecht: {
    optionen: {
      maennlich: opt('A0F', 'A0T'),
      divers: opt('A0F', 'A11'),
      weiblich: opt('A0F', 'A10'),
    },
  },
  bmi: {
    optionen: {
      unter_40: opt('A17', 'A1E', 'Die Norm schreibt "<=40", der Bogen "< 40"'),
      ueber_40: opt('A17', 'A1L'),
    },
  },
  alter_wert: { feld: wert('A26') },
  alter_einheit: {
    optionen: {
      jahre: wert('A26', 'Jahre ist der erste Arm des Entweder-oder A1S; der Wert steht in A26'),
      '1_7_tg': opt('A2D', 'A2K'),
      '8_28_tg': opt('A2D', 'A2R'),
    },
  },

  // ── Einsatzkennung ────────────────────────────────────────────────────
  einsatz_nr: { feld: str('B08', 'EinsatzNr') },
  leitstelle_nr: { feld: str('B08', 'LeitstelleKFZ', 'Die Norm meint hier das KFZ-Kennzeichen der Leitstelle') },
  rufname: { feld: wert('BBW') },
  standort: { feld: str('B08', 'Standort') },

  // ── Einsatztechnische Daten ───────────────────────────────────────────
  einsatz_datum: { feld: wert('B0F') },
  sondersignal: {
    optionen: {
      anfahrt: anhang('Die Norm vermerkt Sondersignal nur für den Transport'),
      transport: opt('M17', 'M28'),
    },
  },
  beteiligtes_rm: { feld: sonst('BC3', 'BE1', 'Die Norm führt die Rettungsmittel als Auswahl; der Freitext geht in ihr Sonstiges-Feld') },
  einsatzort_art: { feld: sonst('B0T', 'B3C', 'Die Norm führt eine Liste von Einsatzorten; der Freitext geht in ihr Sonstiges-Feld') },
  transport_von: { feld: anhang('Die Norm führt nur das Transportziel, nicht die Herkunft') },
  transport_ziel: { feld: wert('B6U') },
  einsatz_art: { feld: umbau('B3J', 'Freitext wird zur Auswahl (Primär-, Folge-, Fehleinsatz …)') },
  versorgung: { feld: anhang('Eigenheit des bayerischen Bogens ohne Entsprechung in der Norm') },
  voranmeldung: { feld: frage('B71') },

  // ── Besatzung ─────────────────────────────────────────────────────────
  // Die Norm hat ein einziges Textfeld für das Team. Alle vier Namen gehen
  // dorthin; der Bogen behält seine vier Zeilen.
  mannschaft_tf: { feld: wert('BBP', 'Die Norm führt ein Textfeld für das gesamte Team') },
  mannschaft_1: { feld: wert('BBP', 'Die Norm führt ein Textfeld für das gesamte Team') },
  mannschaft_2: { feld: wert('BBP', 'Die Norm führt ein Textfeld für das gesamte Team') },
  mannschaft_3: { feld: wert('BBP', 'Die Norm führt ein Textfeld für das gesamte Team') },

  // ── Symptom-Beginn und Zeiten ─────────────────────────────────────────
  symptombeginn_geschaetzt: { feld: anhang('Die Norm unterscheidet nicht zwischen genauem und geschätztem Beginn') },
  kollaps_beobachtet: { feld: frage('BET') },
  symptombeginn_ueber24h: { feld: frage('BEM') },
  symptombeginn: { feld: wert('BEF', 'Die Norm führt nur die Uhrzeit, der Bogen ein Datum') },
  zeit_uebernahme: {
    feld: anhang('Weder Bogen noch Norm führen die Einsatzübernahme (Status 3)'),
  },
  zeit_alarm: { feld: wert('BF0') },
  zeit_ankunft_ort: { feld: wert('BF7') },
  zeit_ankunft_patient: { feld: wert('BFE') },
  zeit_abfahrt: { feld: wert('BFS') },
  zeit_uebergabe: { feld: wert('BFZ') },
  zeit_einsatzbereit: { feld: wert('BG6') },
  zeit_ende: { feld: wert('BGD') },

  // ── Notfallgeschehen ──────────────────────────────────────────────────
  notfallgeschehen: { feld: wert('C08') },
  ersthelfermassnahmen: {
    optionen: {
      suffizient: opt('C1L', 'C1Z'),
      insuffizient: opt('C1L', 'C26'),
      keine: leer('C1L', 'C1S'),
    },
  },
  az_vor_ereignis: { feld: umbau('C0F', 'Freitext wird zur Auswahl nach ASA (gesund … moribund)') },
  first_responder: { feld: frage('C2D') },

  // ── Erstbefund ────────────────────────────────────────────────────────
  erstbefund_zeitpunkt: { feld: wert('D0T') },
  atemwege: {
    optionen: {
      frei: anhang(KEIN_ATEMWEGSBLOCK),
      gefaehrdet: anhang(KEIN_ATEMWEGSBLOCK),
      stridor_exsp: opt('DM7', 'DME', 'Die Norm kennt nur "Stridor"; insp./exsp. bleibt im Anhang'),
      nicht_untersucht: anhang(KEIN_ATEMWEGSBLOCK),
      nicht_beurteilbar: anhang(KEIN_ATEMWEGSBLOCK),
      stridor_insp: opt('DM7', 'DME', 'Die Norm kennt nur "Stridor"; insp./exsp. bleibt im Anhang'),
      atemwegsverlegung: opt('DM7', 'DN6'),
    },
  },
  atmung: {
    optionen: {
      unauffaellig: opt('DLM', 'DLT'),
      tachypnoe: anhang('Die Norm führt keine Tachypnoe'),
      rasselgeraeusche: opt('DM7', 'DND'),
      apnoe: opt('DLM', 'DNR'),
      nicht_untersucht: leer('DL8', 'DLF'),
      nicht_beurteilbar: anhang('Die Norm unterscheidet nicht untersucht und nicht beurteilbar nicht'),
      bradypnoe: anhang('Die Norm führt keine Bradypnoe'),
      schnappatmung: opt('DLM', 'DNK'),
      spastik: opt('DM7', 'DMS'),
      belastungsdyspnoe: opt('DLM', 'DM0', 'Die Norm kennt nur "Dyspnoe"; Belastung/Ruhe bleibt im Anhang'),
      ruhedyspnoe: opt('DLM', 'DM0', 'Die Norm kennt nur "Dyspnoe"; Belastung/Ruhe bleibt im Anhang'),
      beatmung: opt('DLM', 'DNY'),
      hyperventilation: opt('DM7', 'DMZ'),
      zyanose: opt('DM7', 'DML'),
      sonstige: opt('DLM', 'DO5'),
    },
  },
  kreislauf: {
    optionen: {
      unauffaellig: anhang(KEIN_KREISLAUFBLOCK),
      nicht_untersucht: anhang(KEIN_KREISLAUFBLOCK),
      blutung: anhang(KEIN_KREISLAUFBLOCK),
    },
  },
  puls_regelmaessig: { feld: umbau('DF0', 'Freitext wird zur Auswahl rhythmisch / arrhythmisch') },
  // Die drei Fragen des Kreislaufblocks sind seit der Umstellung auf Knoepfe
  // Auswahlen; die Norm fuehrt sie weiterhin nicht, auch nicht ihre Optionen.
  radialispuls: {
    optionen: { ja: anhang(KEIN_KREISLAUFBLOCK), nein: anhang(KEIN_KREISLAUFBLOCK) },
  },
  rekap_zeit: {
    optionen: { unter_2_s: anhang(KEIN_KREISLAUFBLOCK), ueber_2_s: anhang(KEIN_KREISLAUFBLOCK) },
  },
  schockzeichen: {
    optionen: { ja: anhang(KEIN_KREISLAUFBLOCK), nein: anhang(KEIN_KREISLAUFBLOCK) },
  },
  kreislauf_auffaelligkeiten: { feld: anhang(KEIN_KREISLAUFBLOCK) },
  haut: {
    optionen: {
      unauffaellig: opt('DOQ', 'DOX'),
      oedeme: opt('DPB', 'DQ3'),
      kaltschweissig: opt('DPB', 'DQA'),
      stehende_hautfalten: opt('DPB', 'DPI'),
      nicht_untersucht: leer('DOC', 'DOJ'),
      nicht_beurteilbar: anhang('Die Norm unterscheidet nicht untersucht und nicht beurteilbar nicht'),
      dekubitus: opt('DPB', 'DPP'),
      exantheme: opt('DPB', 'DPW'),
      sonstige: opt('DOQ', 'DP4', 'Die Norm hat hier nur "pathologisch" ohne Freitext'),
    },
  },
  ekg: {
    optionen: {
      kein_ekg: leer('DHX', 'DI4'),
      sinusrhythmus: opt('DIB', 'DII'),
      nicht_beurteilbar: anhang('Die Norm führt für das EKG kein "nicht beurteilbar"'),
    },
  },
  ekg_text: { feld: anhang('Die Norm führt das EKG nur als Auswahl, ohne Befundtext') },

  // ── Messwerte initial ─────────────────────────────────────────────────
  af: { feld: wert('DGK') },
  spo2: { feld: wert('DGR') },
  spo2_mit_o2: { feld: umbau('DGY', 'Freitext wird zur Auswahl bei Raumluft / unter O2-Gabe') },
  co_hb: { feld: anhang('Die Norm führt kein CO-Hb') },
  hf: { feld: wert('DET') },
  puls: { feld: anhang('Die Norm führt im Erstbefund nur die Herzfrequenz; den Puls erst im Verlauf') },
  etco2: { feld: wert('DHQ') },
  nibp_sys: { feld: wert('DEF') },
  nibp_dia: { feld: wert('DEM') },
  ibp_sys: { feld: anhang('Die Norm unterscheidet nicht invasiv und nicht invasiv gemessenen Druck') },
  ibp_dia: { feld: anhang('Die Norm unterscheidet nicht invasiv und nicht invasiv gemessenen Druck') },
  bz: { feld: wert('DFS') },
  temp: { feld: wert('DHJ') },
  temp_ort: {
    optionen: {
      aurikulaer: anhang(KEIN_MESSORT),
      oral: anhang(KEIN_MESSORT),
      rektal: anhang(KEIN_MESSORT),
      axillaer: anhang(KEIN_MESSORT),
      inguinal: anhang(KEIN_MESSORT),
      oesophageal: anhang(KEIN_MESSORT),
      vesikal: anhang(KEIN_MESSORT),
      stirn: anhang(KEIN_MESSORT),
    },
  },

  // ── Neurologie ────────────────────────────────────────────────────────
  neuro_ohne_befund: { feld: leer('D08', 'D0M') },
  bewusstsein: { feld: umbau('D71', 'Freitext wird zur Auswahl wach / getrübt / bewusstlos / analgosediert') },
  gcs_augen: { feld: umbau('D10', 'Punktzahl wird zur Auswahl; die Norm führt den Punktwert an der Option') },
  gcs_verbal: { feld: umbau('D1Z', 'Punktzahl wird zur Auswahl; die Norm führt den Punktwert an der Option') },
  gcs_motorik: { feld: umbau('D35', 'Ein Wert wird zur besten motorischen Reaktion je Gliedmaße') },
  gcs_summe: { feld: wert('D5A') },
  pupillen_weite_re: { feld: umbau('DBI', 'Freitext wird zur Auswahl eng / mittel / weit / entrundet') },
  pupillen_weite_li: { feld: umbau('DBP', 'Freitext wird zur Auswahl eng / mittel / weit / entrundet') },
  pupillen_licht_re: { feld: umbau('DCV', 'Freitext wird zur Auswahl prompt / träge / keine') },
  pupillen_licht_li: { feld: umbau('DD2', 'Freitext wird zur Auswahl prompt / träge / keine') },
  neuro_auffaelligkeiten: {
    optionen: {
      keine: leer('D8S', 'D8Z'),
      nicht_untersucht: leer('D08', 'D0F'),
      nicht_beurteilbar: leer('D8S', 'D96'),
      gesichtslaehmung: opt('D8S', 'D9K', 'Die Norm nennt es "kein Lächeln" (FAST)'),
      kopfschmerzen: anhang('Die Norm führt Kopfschmerzen nicht als neurologische Auffälligkeit'),
      gangunsicherheit_schwindel: anhang('Die Norm führt Gangunsicherheit und Schwindel nicht'),
      herdblick: anhang('Die Norm führt den Herdblick nicht einzeln, sondern unter Seitenzeichen'),
      motorik_arme: umbau('D5H', 'Ein Haken wird zur Bewertung der Extremitätenbewegung je Arm'),
      demenz: opt('D8S', 'DA5'),
      querschnittssymptomatik: opt('D8S', 'DAC'),
      sensibilitaetsstoerung: anhang('Die Norm führt Sensibilitätsstörungen nicht einzeln'),
      motorik_beine: umbau('D5H', 'Ein Haken wird zur Bewertung der Extremitätenbewegung je Bein'),
      sehstoerung: opt('D8S', 'D9Y'),
      babinski_zeichen: opt('D8S', 'DAJ'),
      uebelkeit_erbrechen: anhang('Die Norm führt Übelkeit und Erbrechen nicht als neurologische Auffälligkeit'),
      sprachstoerung: opt('D8S', 'D9R'),
      meningismus: opt('D8S', 'DAQ'),
      vorbestehende_neurologische_defizite: opt('D8S', 'DAX'),
      sonstige: sonst('D8S', 'DB4'),
    },
  },
  schmerz: { feld: wert('DE8') },
  schmerz_nicht_beurteilbar: { feld: anhang('Die Norm führt die Schmerzskala ohne "nicht beurteilbar"') },
  schmerz_tolerabel: { feld: anhang('Die Norm führt kein Schmerzerleben') },

  // ── Untersuchung und Psyche ───────────────────────────────────────────
  untersuchung: { feld: anhang('Die Norm führt einen einzigen Freitext für das Notfallgeschehen (C08)') },
  psyche: {
    optionen: {
      unauffaellig: leer('DQH', 'DQV'),
      aggressiv: opt('DR9', 'DS8'),
      verwirrt: opt('DR9', 'DS1'),
      verlangsamt: opt('DR9', 'DST'),
      suizidal: opt('DR9', 'DSM'),
      nicht_untersucht: leer('DQH', 'DQO'),
      nicht_beurteilbar: leer('DQH', 'DR2'),
      depressiv: opt('DR9', 'DRU'),
      erregt: opt('DR9', 'DRN'),
      euphorisch: opt('DR9', 'DT0'),
      sonstige: anhang('Die Auswahl der Norm hat kein Sonstiges-Feld'),
      wahnhaft: opt('DR9', 'DRG'),
      aengstlich: opt('DR9', 'DSF'),
      motorisch_unruhig: opt('DR9', 'DT7'),
    },
  },

  // ── Verletzungen ──────────────────────────────────────────────────────
  verletzung_zusammenhang: { feld: umbau('F0F', 'Freitext wird zu den Fragen nach sportlicher und beruflicher Aktivität') },
  verletzungsmuster: { feld: anhang('Die Norm bewertet jede Körperregion einzeln, ohne zusammenfassenden Text') },
  verl_sht: { feld: umbau('F10', 'Freitext wird zur Bewertung leicht / mittel / schwer, geschlossen / offen') },
  verl_gesicht: { feld: umbau('F17', 'Freitext wird zur Bewertung leicht / mittel / schwer, geschlossen / offen') },
  verl_hws: { feld: umbau('F1E', 'Die Norm führt den Hals, der Bogen die HWS') },
  verl_thorax: { feld: umbau('F1L', 'Freitext wird zur Bewertung leicht / mittel / schwer, geschlossen / offen') },
  verl_abdomen: { feld: umbau('F1S', 'Freitext wird zur Bewertung leicht / mittel / schwer, geschlossen / offen') },
  verl_bws_lws: { feld: umbau('F1Z', 'Die Norm führt die Wirbelsäule als Ganzes') },
  verl_becken: { feld: umbau('F26', 'Freitext wird zur Bewertung leicht / mittel / schwer, geschlossen / offen') },
  verl_obere_extr: { feld: umbau('F2D', 'Freitext wird zur Bewertung leicht / mittel / schwer, geschlossen / offen') },
  verl_untere_extr: { feld: umbau('F2K', 'Freitext wird zur Bewertung leicht / mittel / schwer, geschlossen / offen') },
  verl_weichteile: { feld: umbau('F2R', 'Freitext wird zur Bewertung leicht / mittel / schwer, geschlossen / offen') },
  unfallmechanismus: {
    optionen: {
      stumpf: opt('F7F', 'F7M'),
      penetrierend: opt('F7F', 'F7T'),
      nicht_bekannt: anhang('Die Norm führt keinen unbekannten Unfallmechanismus'),
    },
  },
  spezielle_traumata: {
    optionen: {
      inhalationstrauma: opt('F4B', 'F62'),
      tauchunfall: opt('F4B', 'F6N'),
      elektrounfall: opt('F4B', 'F69'),
      sonstige_strahlen_barotrauma: sonst('F4B', 'F71'),
      beinahe_ertrinken: opt('F4B', 'F6G'),
      veraetzung: opt('F4B', 'F5H'),
    },
  },
  verbrennung_1: { feld: wert('F4P') },
  verbrennung_2: { feld: wert('F4W') },
  verbrennung_3: { feld: wert('F53') },
  unfallhergang: {
    optionen: {
      motorradfahrer: opt('F8S', 'F9D'),
      fussgaenger_angefahren: opt('F8S', 'F8Z'),
      schlag: opt('F9Y', 'FA5'),
      explosion_verpuffung: anhang('Die Norm führt Explosion und Verpuffung nicht'),
      pkw_insasse: opt('F8S', 'F9H'),
      fahrrad: opt('F8S', 'F96'),
      sonstiger_verkehrsunfall: anhang('Die Auswahl der Verkehrsteilnehmer hat kein Sonstiges-Feld'),
      schuss: opt('F9Y', 'FAJ'),
      verschuettung: opt('F4B', 'F5O', 'Die Norm führt die Verschüttung unter den speziellen Traumen'),
      lkw_insasse: opt('F8S', 'F9K'),
      e_bike_pedelec: opt('F8S', 'F97'),
      stich: opt('F9Y', 'FAC'),
      andere_unfallarten: sonst('F9Y', 'FAX'),
      bus_insasse: opt('F8S', 'F9L'),
      e_scooter: opt('F8S', 'F9Z'),
    },
  },
  sturz: {
    optionen: {
      ebenerdig: opt('F80', 'F86'),
      unter_3m: opt('F80', 'F87'),
      ab_3m: opt('F80', 'F8E'),
      nicht_bekannt: anhang('Die Norm führt keine unbekannte Sturzhöhe'),
    },
  },

  // ── Erkrankungen und Score ────────────────────────────────────────────
  tracerdiagnose: { feld: anhang('Die Tracerdiagnose ist eine Kennzahl der bayerischen ÄLRD, nicht der Norm') },
  // Die Maske traegt hier die Organgruppe ein (ZNS, Herz-Kreislauf, …) und in
  // der Tracerdiagnose die Diagnose daraus. Beides zusammen ist in der Norm
  // ein Eintrag des Abschnitts Erkrankungen: die Gruppe ist die Auswahl, die
  // Diagnose ihre Option. Der Umbau ist damit die Uebersetzung dieses Paars.
  fuehrende_diagnose: { feld: umbau('G07', 'Organgruppe der Erkrankungen (E01); mit der Tracerdiagnose zusammen ein Eintrag der Erstdiagnosen') },
  weitere_diagnosen: { feld: umbau('G07', 'Freitext wird zu weiteren Einträgen der Erstdiagnosen mit ICD-10') },
  diagnosetext: { feld: wert('G08') },
  naca_initial: { feld: umbau('G0F', 'Freitext wird zur Auswahl NACA I bis VII') },
  news_score: { feld: anhang('Die Norm führt den NEWS-Score nicht; sie hat stattdessen qSOFA') },
  roter_warnwert: { feld: anhang('Eigenheit des bayerischen Bogens ohne Entsprechung in der Norm') },

  // ── Medikation und Lyse ───────────────────────────────────────────────
  keine_medikation: { feld: leer('I01', 'I08') },
  medikation: { feld: str('I0F', 'Einzeldosis') },
  lysetherapie: {
    optionen: {
      vor_kreislaufstillstand: opt('I2D', 'I2K'),
      nach_kreislaufstillstand: anhang('Die Norm kennt nur "während Kreislaufstillstand" und "nach ROSC"'),
      nach_rosc: opt('I2D', 'I2Y'),
    },
  },
  lyse_zeitpunkt: { feld: wert('I35') },

  // ── Reanimation / Tod ─────────────────────────────────────────────────
  rea_situation: { feld: umbau('K08', 'Freitext wird zur Auswahl Reanimation / keine Reanimation mit Ergebnis') },
  rea_ursache: { feld: anhang('Die Norm führt keine vermutete Ursache der Reanimation') },
  tod_ursache: { feld: anhang('Die Norm führt keine vermutete Todesursache') },
  todesart: { feld: umbau('K4I', 'Freitext wird zur Auswahl natürlich / unklar / nicht natürlich') },
  kollaps_durch: { feld: anhang('Die Norm fragt nur, ob der Kollaps beobachtet wurde, nicht von wem') },
  hdm_durch: { feld: umbau('K1E', 'Freitext wird zur Auswahl Ersthelfer / First Responder / Rettungsdienst / Notarzt') },
  defi1_durch: { feld: umbau('JBP', 'Freitext wird zur Auswahl Laien / First Responder / Rettungsdienst / Arzt') },
  defi1_zeit: { feld: wert('JDG') },
  rosc_zeit: { feld: wert('JDN') },
  kh_aufnahme: { feld: umbau('K2D', 'Freitext wird zur Auswahl mit ROSC / laufende Reanimation') },
  leichenschau: { feld: umbau('K4B', 'Freitext wird zur Frage nach der Todesfeststellung') },
  todeszeitpunkt: { feld: wert('K5H') },

  // ── Maßnahmen ─────────────────────────────────────────────────────────
  pvk_vorhanden: { feld: frage('J0T') },
  zugaenge: { feld: umbau('J0F', 'Freitext wird zur Auswahl peripher / intraossär / transnasal mit Art, Ort, Größe') },
  zugang_erschwert: {
    optionen: {
      unmoeglich: opt('J2Y', 'J3C'),
      ueber_2_vers: opt('J2Y', 'J35'),
      verfahrenswechsel: opt('J2Y', 'J3C', 'Die Norm fasst Unmöglichkeit und Verfahrenswechsel zusammen'),
    },
  },
  atemweg_massnahme: {
    optionen: {
      absaugen: opt('J3Q', 'J4K'),
      ueber_2_intub_versuche: frage('J7M', 'Die Norm führt die Zahl der Versuche als eigenes Feld J7T'),
      atemwege_freimachen: opt('J3Q', 'J4I'),
      maskenbeatm_unmoeglich: opt('J4W', 'J5H'),
      entlastungspunktion: spiegel('sonstige_massnahme.entlastungspunktion'),
      verfahrenswechsel: anhang('Die Norm vermerkt den Verfahrenswechsel nur beim Zugang, nicht beim Atemweg'),
    },
  },
  intubation: { feld: umbau('J6N', 'Freitext wird zur Auswahl oral / nasal mit Größe und Versuchen') },
  tubus_groesse: { feld: umbau('J7F', 'Freitext wird zur Zahl in Millimetern') },
  o2_gabe: { feld: wert('J44') },
  beatmung_art: {
    optionen: {
      spontanatmung: anhang('Die Norm führt unter Beatmung nur manuell und maschinell'),
      kontrollierte_beatmung: opt('J9D', 'J9K'),
    },
  },
  beatmung_fio2: { feld: wert('JA5') },
  beatmung_af: { feld: wert('JAC') },
  beatmung_amv: { feld: wert('JAJ') },
  beatmung_peep: { feld: wert('JAQ') },
  beatmung_pinsp: { feld: wert('JAX') },
  beatmung_mode: { feld: umbau('J9D', 'Freitext wird zur Auswahl kontrolliert / assistiert / NIV') },
  beatmung_art2: { feld: umbau('J8S', 'Freitext wird zur Auswahl manuell / maschinell') },
  beatmung_flow: { feld: anhang('Die Norm führt beim Beatmungsgerät kein Flow') },
  beatmung_manuell: {
    optionen: {
      demandventil: opt('J4W', 'J5A'),
      rueckatmung: anhang('Die Norm führt keine Rückatmung'),
    },
  },
  defi_art: {
    optionen: {
      monophasisch: opt('JCV', 'JD2'),
      biphasisch: opt('JCV', 'JD9'),
    },
  },
  defi_joule_1: { feld: anhang('Die Norm führt nur die höchste Energie, nicht die des ersten Schocks') },
  defi_gesamt: { feld: wert('JDU') },
  defi_joule_letzte: { feld: wert('JE1', 'Die Norm meint die höchste Energie, der Bogen die des letzten Schocks') },
  rosc_1: { feld: spiegel('rosc_zeit') },
  pacer_frequenz: { feld: anhang('Die Norm vermerkt den externen Schrittmacher, ohne seine Einstellungen') },
  pacer_intensitaet: { feld: anhang('Die Norm vermerkt den externen Schrittmacher, ohne seine Einstellungen') },
  pacer_mode: { feld: anhang('Die Norm vermerkt den externen Schrittmacher, ohne seine Einstellungen') },
  rea_massnahme: {
    optionen: {
      herzdruckmassage: opt('JEF', 'JEM'),
      feedbacksystem: opt('JF0', 'JF7'),
      mechanische_thoraxkompression: opt('JF0', 'JFE'),
    },
  },
  aktive_kuehlung: {
    optionen: {
      infusion: opt('JFS', 'JFZ'),
      kuehlpackungen: opt('JFS', 'JG6'),
      technisch: opt('JFS', 'JGD'),
      andere: anhang('Die Auswahl der Norm hat kein Sonstiges-Feld'),
    },
  },
  lagerung: { feld: umbau('JH5', 'Freitext wird zur Auswahl der Lagerungs- und Rettungstechniken') },
  sonstige_massnahme: {
    optionen: {
      thoraxdrainage: opt('JJV', 'JM7', 'Die Norm trennt Thoraxdrainage rechts (JM7) und links (JME)'),
      entlastungspunktion: opt('JJV', 'JMG', 'Die Norm nennt es Nadeldekompression'),
      magensonde: opt('JJV', 'JMS'),
    },
  },
  blutentnahme: {
    optionen: {
      venoes: anhang('Die Norm vermerkt keine Blutentnahme'),
      arteriell: anhang('Die Norm vermerkt keine Blutentnahme'),
    },
  },
  waermeerhalt: {
    optionen: {
      passiv: opt('JH5', 'JHJ', 'Die Norm unterscheidet passiven und aktiven Wärmeerhalt nicht'),
      aktiv: opt('JH5', 'JHJ', 'Die Norm unterscheidet passiven und aktiven Wärmeerhalt nicht'),
    },
  },
  erweitertes_monitoring: {
    optionen: {
      kein_erw_monitoring: anhang('Die Norm führt kein ausdrückliches "kein erweitertes Monitoring"'),
      '12_kanal_ekg': opt('JJV', 'JK2'),
      invasiver_rr: opt('JJV', 'JKU'),
      kapnometrie: anhang('Die Norm führt die Kapnometrie über den Messwert etCO2, nicht als Maßnahme'),
      zvd: anhang('Die Norm führt keinen ZVD'),
      icp: anhang('Die Norm führt keinen ICP'),
      '12_kanal_ekg_vorhanden_durch_andere': opt('JJV', 'JK2', 'Die Norm vermerkt nicht, wer das EKG geschrieben hat'),
      sonstiges_monitoring: anhang('Die Auswahl der Norm hat kein Sonstiges-Feld'),
    },
  },
  medizintechnik: {
    optionen: {
      keine_medizintechnik: anhang('Die Norm führt kein ausdrückliches "keine Medizintechnik"'),
      spritzenpumpe_n: opt('JJV', 'JKN'),
      ultraschall_sono_echo: opt('JJV', 'JMZ'),
      notfallpacer: opt('JJV', 'JKG'),
      funk_ekg_uebermittlung: opt('JJV', 'JK9'),
      videolaryngoskopie: opt('J3Q', 'J80'),
      transportinkubator: opt('JH5', 'JI4'),
      ecmo: opt('JEF', 'JFF', 'Die Norm trennt VV-ECMO (JFF) und VA-ECMO (JFG)'),
      mechanische_thoraxkompression: spiegel('rea_massnahme.mechanische_thoraxkompression'),
      andere_medtech: anhang('Die Auswahl der Norm hat kein Sonstiges-Feld'),
    },
  },

  // ── Übergabe-Befund ───────────────────────────────────────────────────
  ub_zeitpunkt: { feld: wert('BFZ', 'Die Norm führt die Übergabezeit nur einmal, bei den Einsatzzeiten') },
  ub_atemwege: {
    optionen: {
      frei: anhang(KEIN_ATEMWEGSBLOCK),
      stridor_insp: opt('L8L', 'L8S', 'Die Norm kennt nur "Stridor"; insp./exsp. bleibt im Anhang'),
      stridor_exsp: opt('L8L', 'L8S', 'Die Norm kennt nur "Stridor"; insp./exsp. bleibt im Anhang'),
      nicht_untersucht: anhang(KEIN_ATEMWEGSBLOCK),
      nicht_beurteilbar: anhang(KEIN_ATEMWEGSBLOCK),
      atemwegsverlegung: opt('L8L', 'L9K'),
      gefaehrdet: anhang(KEIN_ATEMWEGSBLOCK),
    },
  },
  ub_atmung: {
    optionen: {
      unauffaellig: opt('L80', 'L87'),
      spastik: opt('L8L', 'L96'),
      rasselgeraeusche: opt('L8L', 'L9R'),
      apnoe: opt('L80', 'LA5'),
      sonstige: opt('L80', 'LAJ'),
      nicht_untersucht: leer('L7M', 'L7T'),
      nicht_beurteilbar: anhang('Die Norm unterscheidet nicht untersucht und nicht beurteilbar nicht'),
      ruhedyspnoe: opt('L80', 'L8E', 'Die Norm kennt nur "Dyspnoe"; Belastung/Ruhe bleibt im Anhang'),
      schnappatmung: opt('L80', 'L9Y'),
      beatmung: opt('L80', 'LAC'),
      belastungsdyspnoe: opt('L80', 'L8E', 'Die Norm kennt nur "Dyspnoe"; Belastung/Ruhe bleibt im Anhang'),
      tachypnoe: anhang('Die Norm führt keine Tachypnoe'),
      zyanose: opt('L8L', 'L8Z'),
      hyperventilation: opt('L8L', 'L9D'),
      bradypnoe: anhang('Die Norm führt keine Bradypnoe'),
    },
  },
  ub_kreislauf: {
    optionen: {
      unauffaellig: anhang(KEIN_KREISLAUFBLOCK),
      nicht_untersucht: anhang(KEIN_KREISLAUFBLOCK),
    },
  },
  ub_puls_regelmaessig: { feld: umbau('L1E', 'Freitext wird zur Auswahl rhythmisch / arrhythmisch') },
  ub_radialispuls: {
    optionen: { ja: anhang(KEIN_KREISLAUFBLOCK), nein: anhang(KEIN_KREISLAUFBLOCK) },
  },
  ub_rekap: {
    optionen: { unter_2_s: anhang(KEIN_KREISLAUFBLOCK), ueber_2_s: anhang(KEIN_KREISLAUFBLOCK) },
  },
  ub_schockzeichen: {
    optionen: { ja: anhang(KEIN_KREISLAUFBLOCK), nein: anhang(KEIN_KREISLAUFBLOCK) },
  },
  ub_ekg: {
    optionen: {
      kein_ekg: leer('L4B', 'L4I'),
      sinusrhythmus: opt('L4P', 'L4W'),
    },
  },
  ub_psyche: {
    optionen: Object.fromEntries(
      ['aggressiv', 'verwirrt', 'verlangsamt', 'suizidal', 'nicht_beurteilbar', 'unauffaellig',
        'depressiv', 'erregt', 'euphorisch', 'sonstige', 'nicht_untersucht', 'wahnhaft',
        'aengstlich', 'motorisch_unruhig']
        .map((k) => [k, anhang('Die Norm erhebt die Psyche nur im Erstbefund, nicht bei der Übergabe')]),
    ),
  },
  ub_untersuchung: { feld: anhang('Die Norm führt einen einzigen Freitext für das Notfallgeschehen (C08)') },

  // ── Neurologie und Messwerte bei Übergabe ─────────────────────────────
  ub_neuro_ohne_befund: { feld: anhang(KEINE_UB_NEURO) },
  ub_bewusstsein: { feld: umbau('LB4', 'Freitext wird zur Auswahl wach / getrübt / bewusstlos / analgosediert') },
  ub_gcs_augen: { feld: anhang(KEINE_UB_NEURO) },
  ub_gcs_verbal: { feld: anhang(KEINE_UB_NEURO) },
  ub_gcs_motorik: { feld: anhang(KEINE_UB_NEURO) },
  ub_gcs_summe: { feld: anhang(KEINE_UB_NEURO) },
  ub_pupillen_weite_re: { feld: anhang(KEINE_UB_NEURO) },
  ub_pupillen_weite_li: { feld: anhang(KEINE_UB_NEURO) },
  ub_pupillen_licht_re: { feld: anhang(KEINE_UB_NEURO) },
  ub_pupillen_licht_li: { feld: anhang(KEINE_UB_NEURO) },
  ub_schmerz: { feld: wert('L0M') },
  ub_schmerz_nicht_beurteilbar: { feld: anhang('Die Norm führt die Schmerzskala ohne "nicht beurteilbar"') },
  ub_schmerz_tolerabel: { feld: anhang('Die Norm führt kein Schmerzerleben') },
  ub_af: { feld: wert('L2Y') },
  ub_spo2: { feld: wert('L35') },
  ub_spo2_mit_o2: { feld: umbau('L3C', 'Freitext wird zur Auswahl bei Raumluft / unter O2-Gabe') },
  ub_hf: { feld: wert('L17') },
  ub_puls: { feld: anhang('Die Norm führt bei der Übergabe nur die Herzfrequenz') },
  ub_etco2: { feld: wert('L44') },
  ub_nibp_sys: { feld: wert('L0T') },
  ub_nibp_dia: { feld: wert('L10') },
  ub_ibp_sys: { feld: anhang('Die Norm unterscheidet nicht invasiv und nicht invasiv gemessenen Druck') },
  ub_ibp_dia: { feld: anhang('Die Norm unterscheidet nicht invasiv und nicht invasiv gemessenen Druck') },
  ub_bz: { feld: wert('L26') },
  ub_temp: { feld: wert('L3X') },

  // ── Fußblöcke ─────────────────────────────────────────────────────────
  besonderheiten: { feld: umbau('M3C', 'Freitext wird zur Auswahl der Besonderheiten des Einsatzverlaufs') },
  wertsachen: { feld: anhang('Die Norm vermerkt keine Wertsachen') },
  uebergabe_an: { feld: wert('M80') },
  uebergabeort: { feld: umbau('M53', 'Freitext wird zur Auswahl ZNA / Schockraum / Stroke Unit …') },
  aelrd_delegationen: { feld: anhang('Die Delegationen der bayerischen ÄLRD sind nicht Teil der Norm') },
  bemerkungen: { feld: wert('M8E') },
  naca_uebergabe: { feld: anhang('Die Norm führt den NACA-Score nur einmal, bei den Erstdiagnosen') },
  notarzt_nachgefordert: { feld: opt('B3J', 'B69') },
  unterschrift: { feld: anhang('Die Norm führt keine Unterschrift des Ausfüllenden') },
}

/** Die Zuordnung eines Feldes des Bogens. */
export function aelrdNaep(id: string): AelrdNaepZuordnung | undefined {
  return AELRD_NAEP[id]
}

/** Das Ziel einer einzelnen Option. */
export function aelrdNaepOption(id: string, wertDerOption: string): NaepZiel | undefined {
  return AELRD_NAEP[id]?.optionen?.[wertDerOption]
}

function alleZiele(): NaepZiel[] {
  const aus: NaepZiel[] = []
  for (const z of Object.values(AELRD_NAEP)) {
    if (z.feld) aus.push(z.feld)
    for (const o of Object.values(z.optionen ?? {})) aus.push(o)
  }
  return aus
}

/**
 * Wie viele Angaben des Bogens in der Norm ankommen, wie viele im Anhang
 * bleiben und wie viele erst umgebaut werden müssen.
 */
export function aelrdNaepUmfang(): {
  norm: number
  anhang: number
  umbau: number
  spiegel: number
} {
  let norm = 0
  let anhang = 0
  let umbau = 0
  let spiegel = 0
  for (const z of alleZiele()) {
    if (z.art === 'anhang') anhang++
    else if (z.art === 'umbau') umbau++
    else if (z.art === 'spiegel') spiegel++
    else norm++
  }
  return { norm, anhang, umbau, spiegel }
}

/** Angaben des Bogens, die die Norm nicht kennt — der Responda-Anhang. */
export function anhangZiele(): { grund: string }[] {
  return alleZiele().filter((z): z is Extract<NaepZiel, { art: 'anhang' }> => z.art === 'anhang')
}

/**
 * Felder, deren Form sich ändern muss, bevor sie verlustfrei übermittelt
 * werden können — die Arbeitsliste für den Umbau der Maske.
 */
export function umbauFelder(): (AelrdFeld & { umbau: string; naep: string })[] {
  const aus: (AelrdFeld & { umbau: string; naep: string })[] = []
  for (const f of AELRD_FELDER) {
    const z = AELRD_NAEP[f.id]
    const ziel = z?.feld
    if (ziel?.art === 'umbau') aus.push({ ...f, umbau: ziel.was, naep: ziel.code })
  }
  return aus
}
