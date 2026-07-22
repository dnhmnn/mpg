// Feste Fachgebiete (übergeordnete Struktur) für die Wissensbasis — Reihenfolge = Anzeige-Reihenfolge.
// Wird auch vom KI-Import genutzt (pb_hooks/ki-assist.pb.js hält dieselbe Liste).
export const WISSEN_KATEGORIEN = [
  'Notfallmedizin',
  'Kardiologie & EKG',
  'Atmung & Beatmung',
  'Trauma & Chirurgie',
  'Neurologie',
  'Innere Medizin',
  'Pädiatrie',
  'Gynäkologie & Geburtshilfe',
  'Psychiatrie & Krisenintervention',
  'Medikamente & Pharmakologie',
  'Anatomie & Physiologie',
  'Hygiene & Recht',
  'Einsatztaktik & Organisation',
  'Geräte & Technik',
  'Sonstiges',
]

export function kategorieOrDefault(k: string | undefined | null): string {
  const v = (k || '').trim()
  return WISSEN_KATEGORIEN.includes(v) ? v : 'Sonstiges'
}
