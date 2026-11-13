// Welche Antworten der API nie in den Zwischenspeicher des Service Workers dürfen.
//
// Dieselbe Liste steht in vite.config.ts (Regel NetworkOnly; die Konfiguration darf keine
// Dateien aus src laden). Der Prüffall in src/lib/__tests__/zwischenspeicher.test.ts hält beide
// gleich.
//
// Darin: alles mit Patienten- oder Gesundheitsdaten (Protokolle, Nacherfassungen, Zugriffs- und
// Änderungsprotokolle mit Patientennamen, Einsätze mit Einsatzort), Personen (Konten, Mannschaft
// eines Einsatzes, Chat samt Schlüsseln) und persönliche Notizen. Solche Antworten fragt die App
// immer frisch beim Server ab; ohne Netz zeigt sie dafür keinen alten Stand.
export const OHNE_ZWISCHENSPEICHER_SAMMLUNGEN = [
  'patients',
  'patient_docs_nacherfassung',
  'access_logs',
  'audit_logs',
  'users',
  'einsaetze',
  'einsatz_personen',
  'chat_messages',
  'chat_channel_keys',
  'user_keys',
  'notizen',
] as const

/** Trifft jede Anfrage an diese Sammlungen: Liste, einzelner Satz, mit und ohne Abfrage. */
export const OHNE_ZWISCHENSPEICHER = new RegExp(
  `^https://api\\.responda\\.systems/api/collections/(${OHNE_ZWISCHENSPEICHER_SAMMLUNGEN.join('|')})/`,
  'i',
)
