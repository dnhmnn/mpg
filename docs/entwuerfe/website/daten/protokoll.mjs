// Bild „protokoll“: Patientendokumentation der erfundenen Bewohnerin „Erika Mustermann“ (leichte
// Rauchgasvergiftung) aus dem erfundenen Einsatz E-2026-0417 (siehe eks.mjs). Ein abgesendetes, voll
// ausgefülltes Protokoll in der Maske /protokoll/:id, so wie Unitas es zum Ansehen und Ändern öffnet
// (ProtokollMaske, Doku mit protokollId). Alle Pflichtangaben stehen da, die Reiter sind also grün.
// Nur erfundene Daten: erfundene Feuerwehr, erfundene Personen, Musterstadt, Platzhaltername.

// ORG kommt aus '../daten.mjs', nachgeladen wie in eks.mjs (ein statischer Import hinge im Kreis fest).
const PATIENTS = []

const PROTOKOLL_ID = 'protokollerika1'

// Ortszeit am 19.11.2026 (MEZ, UTC+1) -> ISO in UTC
const z = (hm) => new Date(`2026-11-19T${hm}:00+01:00`).toISOString()
const pbZeit = (iso) => iso.replace('T', ' ')

const WERTE = {
  // Patient und Einsatznummer
  name: 'Mustermann', vorname: 'Erika', gebdatum: '1956-03-12',
  strasse: 'Lindenweg 14', plz_ort: '12345 Musterstadt', kasse: 'Musterkasse', versnr: 'M123456789',
  geschlecht: 'weiblich', bmi: 'unter_40', alter_wert: '70', alter_einheit: 'jahre',
  einsatz_nr: 'E-2026-0417', auftrags_nr: '2611190912-0417', rufname: 'HLF 20/1', standort: 'Feuerwache Musterstadt',
  // Einsatz und Besatzung
  einsatz_datum: '2026-11-19', sondersignal: 'anfahrt', einsatzort_art: 'Wohnung, Mehrfamilienhaus',
  einsatz_art: 'Primäreinsatz', versorgung: 'Erstversorgung, Übergabe an den Rettungsdienst',
  transport_von: 'Lindenweg 14, 12345 Musterstadt', transport_von_strasse: 'Lindenweg 14', transport_von_plz: '12345', transport_von_ort: 'Musterstadt',
  transport_ziel: 'Klinikum Musterstadt, 12345 Musterstadt', transport_ziel_strasse: 'Klinikum Musterstadt', transport_ziel_plz: '12345', transport_ziel_ort: 'Musterstadt',
  mannschaft_tf: 'Murat Aksoy', mannschaft_1: 'Sara Lindner',
  // Zeiten
  zeit_alarm: '09:12', zeit_uebernahme: '09:13', zeit_ankunft_ort: '09:14', zeit_ankunft_patient: '09:19', zeit_uebergabe: '09:27',
  // Notfallgeschehen und Anamnese
  notfallgeschehen: 'Zimmerbrand im 2. OG. Bewohnerin hat die Wohnung über den verrauchten Treppenraum selbst verlassen, '
    + 'an der Einsatzstelle übernommen. Reizhusten, leichte Kopfschmerzen, keine Bewusstlosigkeit, keine Verbrennungen. '
    + 'Vorerkrankung: Bluthochdruck.',
  ersthelfermassnahmen: 'keine', az_vor_ereignis: 'leicht eingeschränkt',
  // Erstbefund nach xABCDE
  erstbefund_zeitpunkt: '09:20',
  kreislauf: 'unauffaellig', atemwege: ['frei'], atmung: ['tachypnoe'],
  puls_regelmaessig: 'rhythmisch', radialispuls: 'ja', rekap_zeit: 'unter_2_s', schockzeichen: 'nein', ekg: 'sinusrhythmus',
  bewusstsein: 'wach', gcs_augen: '4', gcs_verbal: '5', gcs_motorik: '6', gcs_summe: '15',
  pupillen_weite_re: 'mittel', pupillen_weite_li: 'mittel', pupillen_licht_re: 'prompt', pupillen_licht_li: 'prompt',
  neuro_auffaelligkeiten: ['kopfschmerzen'], psyche: ['aengstlich'],
  haut: ['unauffaellig'], schmerz: '2',
  untersuchung: 'Rußspuren an Nase und Mund, Lunge seitengleich belüftet, keine Verbrennungen.',
  // Messwerte initial
  af: '22', spo2: '94', spo2_mit_o2: 'bei Raumluft', co_hb: '6', hf: '102', puls: '102',
  nibp_sys: '152', nibp_dia: '88', bz: '118', temp: '36.7', temp_ort: 'aurikulaer',
  // Erkrankungen und Score
  tracerdiagnose: 'Intoxikation', fuehrende_diagnose: 'Rauchgasinhalation',
  diagnosetext: 'Leichte Rauchgasvergiftung (CO-Hb 6 %), Reizhusten, keine Verbrennungen.',
  naca_initial: 'II (leichte Störung)',
  // Maßnahmen
  medizintechnik: ['keine_medizintechnik'], erweitertes_monitoring: ['kein_erw_monitoring'],
  lagerung: 'Oberkörperhochlagerung', waermeerhalt: 'passiv', keine_medikation: true, o2_gabe: '15',
  evm_aufgeklaert: 'ja', evm_aufklaerung_zeit: '09:21', evm_einwilligung: 'alle', evm_einwilligung_zeit: '09:21',
  // Verlauf der Messwerte
  verlauf: [
    { id: 'v1', zeit: '09:24', werte: { spo2: '97', af: '20', o2: '15', cohb: '5', hf: '94', rr_sys: '144', rr_dia: '84' } },
  ],
  // Übergabe-Befund nach xABCDE
  ub_zeitpunkt: '09:27',
  ub_kreislauf: 'unauffaellig', ub_atemwege: ['frei'], ub_atmung: ['unauffaellig'],
  ub_puls_regelmaessig: 'rhythmisch', ub_radialispuls: 'ja', ub_rekap: 'unter_2_s', ub_schockzeichen: 'nein', ub_ekg: 'sinusrhythmus',
  ub_bewusstsein: 'wach', ub_gcs_augen: '4', ub_gcs_verbal: '5', ub_gcs_motorik: '6', ub_gcs_summe: '15',
  ub_pupillen_weite_re: 'mittel', ub_pupillen_weite_li: 'mittel', ub_pupillen_licht_re: 'prompt', ub_pupillen_licht_li: 'prompt',
  ub_psyche: ['unauffaellig'], ub_schmerz: '1',
  ub_af: '18', ub_spo2: '98', ub_spo2_mit_o2: 'unter O2-Gabe', ub_hf: '90', ub_puls: '90',
  ub_nibp_sys: '140', ub_nibp_dia: '84', ub_bz: '115', ub_temp: '36.7',
  // Abschluss
  uebergabe_an: 'Besatzung RTW 83/1', uebergabeort: 'Einsatzstelle', naca_uebergabe: 'II',
  besonderheiten: 'Sauerstoff über Maske 15 l/min, Transport durch RTW 83/1 ins Klinikum Musterstadt.',
  unterschrift: 'Murat Aksoy',
  // Wie datensatz() beim Absenden (absenden.ts): Fassung, Absendezeit, Änderungsfrist ein Tag
  protokoll_version: 2, abgesendet: z('09:39'), frist: new Date(Date.parse(z('09:39')) + 24 * 3600_000).toISOString(),
}

function aufbauen({ ORG }) {
  PATIENTS.push({
    id: PROTOKOLL_ID, collectionId: 'pbc_patients', collectionName: 'patients',
    title: 'Patientendoku: Erika Mustermann', status: 'offen', organization_id: ORG.id,
    payload: WERTE, absender_status: '',
    created: pbZeit(z('09:39')), updated: pbZeit(z('09:39')),
  })
}
import('../daten.mjs').then(aufbauen)

export const bild = {
  name: 'protokoll',
  pfad: `/protokoll/${PROTOKOLL_ID}`,
  warte: 1500,
  sammlungen: {
    patients: PATIENTS,
  },
  vorher: async (page) => {
    // Der Reiter am Rand: Messwerte initial (wie ein Tipp am Telefon)
    await page.getByRole('button', { name: /^VITAL/ }).click()
    await page.waitForTimeout(800)
  },
}
