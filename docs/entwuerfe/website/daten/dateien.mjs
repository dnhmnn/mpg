// Bild „dateien“: Dateien (/files), die gemeinsame Ablage der Feuerwehr Musterstadt am 19.11.2026, 09:41. Oberste
// Ebene: Ordner (Ausbildung, Dienstpläne, Fahrzeuge und Geräte, Hygiene, Verwaltung), darunter die meistgebrauchten
// Dateien (Hygieneplan, Dienstplan Dezember, Ausrückeordnung …). Dieselbe Ablage zeigt die Schreibstube
// (schreibstube.mjs, ABLAGE von hier): Die Schreibstube liest dieselbe Sammlung files.
// Die App holt alle Einträge der Organisation auf einmal (Filter organization_id) und ordnet selbst: Ordner zuerst,
// dann nach Namen (src/pages/dateien/logik.ts). Datum und Größe stehen unter dem Namen.
// Nur erfundene Daten: erfundene Feuerwehr, keine Personen, keine Patientendaten, keine Markennamen.

const ORG_ID = 'orgmusterstadt1' // wie ORG in daten.mjs (ein statischer Import hinge im Kreis fest)

// Ortszeit -> PocketBase-Zeit in UTC (bis 24.10.2026 Sommerzeit, UTC+2, danach MEZ, UTC+1)
const pb = (tag, hm) => new Date(`${tag}T${hm}:00${tag < '2026-10-25' ? '+02:00' : '+01:00'}`).toISOString().replace('T', ' ')
const KB = 1024
const MB = 1024 * 1024

const ORDNER = {
  ausbildung: 'dfordausbild001',
  dienst: 'dforddienst0001',
  fahrzeuge: 'dfordfahrzeug01',
  hygiene: 'dfordhygiene001',
  verwaltung: 'dfordverwalt001',
}

function ordner(id, name, tag, hm) {
  return {
    id, collectionId: 'pbc_files', collectionName: 'files', name, is_folder: true, parent_folder_id: '',
    organization_id: ORG_ID, file: '', file_size: 0, file_type: '', created: pb('2025-03-02', '10:00'), updated: pb(tag, hm),
  }
}

// Gespeicherte Datei wie PocketBase sie benennt: Name in Kleinbuchstaben mit Zufallsteil
let nr = 0
function datei(name, wo, groesse, tag, hm, typ) {
  nr++
  const punkt = name.lastIndexOf('.')
  const stamm = name.slice(0, punkt).toLowerCase().replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c])).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const id = `dfdatei${String(nr).padStart(8, '0')}`
  return {
    id, collectionId: 'pbc_files', collectionName: 'files', name, is_folder: false, parent_folder_id: wo,
    organization_id: ORG_ID, file: `${stamm}_${id.slice(-6)}${name.slice(punkt).toLowerCase()}`, file_size: groesse, file_type: typ,
    created: pb(tag, hm), updated: pb(tag, hm),
  }
}
const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

/** Die Ablage der Feuerwehr Musterstadt (Sammlung files). */
export const ABLAGE = [
  ordner(ORDNER.ausbildung, 'Ausbildung', '2026-11-18', '21:30'),
  ordner(ORDNER.dienst, 'Dienstpläne', '2026-11-19', '08:55'),
  ordner(ORDNER.fahrzeuge, 'Fahrzeuge und Geräte', '2026-11-19', '07:10'),
  ordner(ORDNER.hygiene, 'Hygiene', '2026-11-03', '19:00'),
  ordner(ORDNER.verwaltung, 'Verwaltung', '2026-11-12', '20:15'),

  // Oberste Ebene: was alle oft brauchen
  datei('Hygieneplan.pdf', '', 860 * KB, '2026-11-17', '19:20', PDF),
  datei('Dienstplan Dezember.xlsx', '', 48 * KB, '2026-11-19', '08:55', XLSX),
  datei('Ausrückeordnung.pdf', '', 1.2 * MB, '2026-10-02', '18:40', PDF),
  datei('Lageplan Feuerwache.pdf', '', 2.4 * MB, '2026-06-14', '11:05', PDF),
  datei('Wachbuch November.docx', '', 38 * KB, '2026-11-19', '07:25', DOCX),
  datei('Fotos Tag der offenen Tür.zip', '', 186 * MB, '2026-09-21', '16:30', 'application/zip'),
  datei('Wappen Feuerwehr Musterstadt.png', '', 312 * KB, '2025-03-02', '10:10', 'image/png'),

  // Ausbildung
  datei('Übungsplan 2027.docx', ORDNER.ausbildung, 64 * KB, '2026-11-18', '21:30', DOCX),
  datei('Unterweisung Atemschutz.pptx', ORDNER.ausbildung, 7.8 * MB, '2026-11-09', '20:10', PPTX),
  datei('Teilnehmerliste Grundlehrgang.xlsx', ORDNER.ausbildung, 22 * KB, '2026-10-28', '19:45', XLSX),

  // Dienstpläne
  datei('Dienstplan November.xlsx', ORDNER.dienst, 47 * KB, '2026-10-30', '18:00', XLSX),
  datei('Dienstplan Oktober.xlsx', ORDNER.dienst, 46 * KB, '2026-09-29', '18:30', XLSX),
  datei('Urlaubsplanung 2027.xlsx', ORDNER.dienst, 31 * KB, '2026-11-14', '10:20', XLSX),

  // Fahrzeuge und Geräte
  datei('Prüfliste HLF 20-1.docx', ORDNER.fahrzeuge, 52 * KB, '2026-11-19', '07:10', DOCX),
  datei('Beladeplan LF 10-2.pdf', ORDNER.fahrzeuge, 1.6 * MB, '2026-08-03', '19:00', PDF),
  datei('Fahrtenbuch MTW 19-1.xlsx', ORDNER.fahrzeuge, 28 * KB, '2026-11-16', '17:40', XLSX),

  // Hygiene
  datei('Desinfektionsplan Fahrzeuge.pdf', ORDNER.hygiene, 540 * KB, '2026-11-03', '19:00', PDF),
  datei('Schwarz-Weiß-Trennung Aushang.pdf', ORDNER.hygiene, 410 * KB, '2026-07-11', '09:30', PDF),

  // Verwaltung
  datei('Protokoll Wehrversammlung Oktober.docx', ORDNER.verwaltung, 41 * KB, '2026-11-12', '20:15', DOCX),
  datei('Haushaltsplan 2027.xlsx', ORDNER.verwaltung, 36 * KB, '2026-11-05', '21:00', XLSX),
  datei('Jahresbericht 2025.pptx', ORDNER.verwaltung, 12.4 * MB, '2026-02-20', '18:15', PPTX),
].map((e) => ({ ...e, file_size: Math.round(e.file_size) }))

export const bild = {
  name: 'dateien',
  pfad: '/files',
  warte: 1000,
  sammlungen: { files: ABLAGE },
}
