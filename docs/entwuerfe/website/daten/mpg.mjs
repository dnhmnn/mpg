// Bild „mpg“: Schritt Gerät (10:05). Medizinprodukte, Ansicht „Heute“ der Feuerwehr Musterstadt während des
// erfundenen Einsatzes E-2026-0417 „B3 – Wohnungsbrand“ (Lindenweg 14). Die Absaugpumpe des HLF 20/1 ist im
// Einsatz ausgefallen, wurde über „Mangel melden“ als Defekt (hoch) gemeldet und dabei gesperrt
// (planeDefekt: Gerät operational = false, Eintrag „gesperrt“ im Gerätebuch, Defekt offen). Daneben die
// übrigen Geräte der Fahrzeuge und der Wache, einsatzbereit, mit anstehenden STK und MTK.
// Nur erfundene Testdaten: erfundene Feuerwehr, erfundene Personen, keine Markennamen.

// ORG und USER kommen aus '../daten.mjs', nachgeladen wie in eks.mjs (statischer Import hinge im Kreis fest).
const GERAETE = []
const DEFEKTE = []
const EREIGNISSE = []

// Ortszeit (November: MEZ, UTC+1) -> PocketBase-Zeit in UTC
const pb = (tag, hm) => new Date(`${tag}T${hm}:00+01:00`).toISOString().replace('T', ' ')
// Reines Datumsfeld wie PocketBase es liefert (letzte STK/MTK, Inbetriebnahme)
const datum = (tag) => `${tag} 00:00:00.000Z`

// Nächste Regelprüfung wie src/lib/mpg/fristen.ts (faelligFeld): Ende des Tages, Ortszeit
const INTERVALL_TAGE = { daily: 1, weekly: 7 }
function faellig(letzte, intervall) {
  const d = new Date(`${letzte}T12:00:00+01:00`)
  if (INTERVALL_TAGE[intervall]) d.setDate(d.getDate() + INTERVALL_TAGE[intervall])
  else if (intervall === 'monthly') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  const tag = d.toISOString().slice(0, 10)
  return new Date(`${tag}T23:59:59+01:00`).toISOString().replace('T', ' ')
}

function geraet(o, ORG) {
  const [tag, hm] = o.geprueft
  return {
    id: o.id, collectionId: 'pbc_mpg_devices', collectionName: 'mpg_devices',
    name: o.name, type: o.type, serial_number: o.sn, location: o.ort, interval: o.intervall,
    last_inspection: pb(tag, hm), last_inspection_passed: true, next_inspection_due: faellig(tag, o.intervall),
    organization_id: ORG.id, operational: o.operational ?? true,
    has_stk: !!o.stk, last_stk: o.stk ? datum(o.stk) : '', stk_interval_months: o.stk ? 24 : 0,
    has_mtk: !!o.mtk, last_mtk: o.mtk ? datum(o.mtk) : '', mtk_interval_months: o.mtk ? (o.mtkMonate ?? 24) : 0,
    inbetriebnahme: datum(o.seit), ausser_betrieb: '', ausser_betrieb_grund: '', verbleib: '',
    created: pb(o.seit, '10:00'), updated: o.geaendert ?? pb(tag, hm),
  }
}

const PUMPE_HLF = 'mpgabsaughlf201'
const DEFEKT_ID = 'mpgdefekt000417'
// Gemeldet und gesperrt um 09:34, während der Einsatz läuft
const GEMELDET = pb('2026-11-19', '09:34')

function aufbauen({ ORG }) {
  const g = (o) => geraet(o, ORG)
  // Nach Namen sortiert, wie die Seite sie mit sort: 'name' vom Server bekommt
  GERAETE.push(
    // HLF 20/1: wöchentliche Prüfung am Montag; die Absaugpumpe ist im Einsatz ausgefallen
    g({ id: PUMPE_HLF, name: 'Absaugpumpe HLF 20/1', type: 'Absaugpumpe', sn: 'AP-2019-0381', ort: 'HLF 20/1', intervall: 'weekly',
      geprueft: ['2026-11-16', '18:40'], seit: '2019-05-14', operational: false, geaendert: GEMELDET }),
    // RTW 83/1: tägliche Prüfung bei Dienstbeginn, heute früh
    g({ id: 'mpgabsaugrtw831', name: 'Absaugpumpe RTW 83/1', type: 'Absaugpumpe', sn: 'AP-2022-1172', ort: 'RTW 83/1', intervall: 'daily',
      geprueft: ['2026-11-19', '07:14'], seit: '2022-09-01' }),
    g({ id: 'mpgaedfeuerwach', name: 'AED Feuerwache', type: 'AED', sn: 'AED-2021-5530', ort: 'Feuerwache', intervall: 'monthly',
      geprueft: ['2026-11-02', '19:20'], seit: '2021-03-10', stk: '2025-09-23' }),
    g({ id: 'mpgaedhlf201000', name: 'AED HLF 20/1', type: 'AED', sn: 'AED-2019-2207', ort: 'HLF 20/1', intervall: 'weekly',
      geprueft: ['2026-11-16', '18:35'], seit: '2019-05-14', stk: '2025-06-17' }),
    // LF 10/2: Wochenprüfung heute fällig, STK zum Monatsende
    g({ id: 'mpgaedlf102000', name: 'AED LF 10/2', type: 'AED', sn: 'AED-2020-3148', ort: 'LF 10/2', intervall: 'weekly',
      geprueft: ['2026-11-12', '19:05'], seit: '2020-11-05', stk: '2024-11-05' }),
    g({ id: 'mpgbdrtw8310000', name: 'Blutdruckmessgerät RTW 83/1', type: 'Blutdruckmessgerät', sn: 'BD-2022-0904', ort: 'RTW 83/1', intervall: 'weekly',
      geprueft: ['2026-11-16', '07:30'], seit: '2022-09-01', mtk: '2024-12-03' }),
    g({ id: 'mpgbzrtw8310000', name: 'BZ-Messgerät RTW 83/1', type: 'BZ-Gerät', sn: 'BZ-2024-1187', ort: 'RTW 83/1', intervall: 'weekly',
      geprueft: ['2026-11-16', '07:35'], seit: '2024-02-12' }),
    // Defibrillator mit Blutdruckmessung: STK zum Monatsende fällig, dazu MTK
    g({ id: 'mpgdefirtw83100', name: 'Defibrillator RTW 83/1', type: 'Defibrillator', sn: 'DF-2022-0417', ort: 'RTW 83/1', intervall: 'daily',
      geprueft: ['2026-11-19', '07:10'], seit: '2022-09-01', stk: '2024-11-12', mtk: '2025-02-14' }),
    g({ id: 'mpgbeatmrtw8310', name: 'Notfallbeatmungsgerät RTW 83/1', type: 'Beatmungsgerät', sn: 'BG-2022-0779', ort: 'RTW 83/1', intervall: 'daily',
      geprueft: ['2026-11-19', '07:12'], seit: '2022-09-01', stk: '2025-01-20' }),
    g({ id: 'mpgthermortw831', name: 'Ohrthermometer RTW 83/1', type: 'Thermometer', sn: 'TH-2023-2290', ort: 'RTW 83/1', intervall: 'weekly',
      geprueft: ['2026-11-16', '07:38'], seit: '2023-06-19', mtk: '2025-12-02', mtkMonate: 12 }),
    g({ id: 'mpgpulsoxrtw831', name: 'Pulsoximeter RTW 83/1', type: 'Pulsoximeter', sn: 'PO-2023-0651', ort: 'RTW 83/1', intervall: 'weekly',
      geprueft: ['2026-11-16', '07:33'], seit: '2023-06-19' }),
    g({ id: 'mpgsauerhlf2010', name: 'Sauerstoffeinheit HLF 20/1', type: 'Sauerstoffgerät', sn: 'O2-2019-0328', ort: 'HLF 20/1', intervall: 'weekly',
      geprueft: ['2026-11-16', '18:45'], seit: '2019-05-14' }),
    // Monatsprüfung in fünf Tagen
    g({ id: 'mpgsauerlf10200', name: 'Sauerstoffeinheit LF 10/2', type: 'Sauerstoffgerät', sn: 'O2-2020-0716', ort: 'LF 10/2', intervall: 'monthly',
      geprueft: ['2026-10-24', '10:15'], seit: '2020-11-05' }),
    g({ id: 'mpgspritzrtw831', name: 'Spritzenpumpe RTW 83/1', type: 'Spritzenpumpe', sn: 'SP-2022-0533', ort: 'RTW 83/1', intervall: 'weekly',
      geprueft: ['2026-11-16', '07:41'], seit: '2022-09-01', stk: '2025-04-08' }),
  )

  // Im Einsatz gemeldet: Defekt „hoch“ mit Sperre (planeDefekt), Eintrag im Gerätebuch mit gleicher Kennung
  const text = 'Pumpe baut keinen Unterdruck mehr auf, Saugleistung bricht nach wenigen Sekunden ab. Ausgefallen beim Einsatz Lindenweg 14, Absaugung vom RTW 83/1 übernommen.'
  DEFEKTE.push({
    id: DEFEKT_ID, collectionId: 'pbc_mpg_defects', collectionName: 'mpg_defects',
    device_id: PUMPE_HLF, device_name: 'Absaugpumpe HLF 20/1', reported_by: 'Sara Lindner',
    description: text, severity: 'high', status: 'open', resolved_by: '', resolved_notes: '',
    organization_id: ORG.id, created: GEMELDET, updated: GEMELDET,
  })
  EREIGNISSE.push({
    id: DEFEKT_ID, collectionId: 'pbc_mpg_ereignisse', collectionName: 'mpg_ereignisse',
    organization_id: ORG.id, device_id: PUMPE_HLF, device_name: 'Absaugpumpe HLF 20/1',
    art: 'gesperrt', text: `Defekt gemeldet: ${text}`, aenderungen: null, angaben: null, bezug: DEFEKT_ID,
    user_name: 'Sara Lindner', created: GEMELDET, updated: GEMELDET,
  })
}
import('../daten.mjs').then(aufbauen)

export const bild = {
  name: 'mpg',
  pfad: '/mpg',
  warte: 900,
  sammlungen: {
    mpg_devices: GERAETE,
    mpg_defects: DEFEKTE,
    mpg_ereignisse: EREIGNISSE,
    mpg_defect_reports: [],
    mpg_checklists: [],
    mpg_inspections: [],
  },
}
