// Einsatznummer vergleichen: Zwilling von nummerSchluessel in pb_hooks/einsatz-regeln.js (der Server legt
// Einsätze aus Protokoll und Produktausgabe an, Owner 22.11.2026). Gleich hält sie einsatzRegeln.test.ts.

/** Schlüssel zum Vergleichen: ohne Leerzeichen, klein, höchstens 60 Zeichen („2025 - 001“ und „2025-001“ sind gleich). */
export function nummerSchluessel(roh: unknown): string {
  return String(roh == null ? '' : roh).replace(/\s+/g, ' ').trim().slice(0, 60).toLowerCase().replace(/\s+/g, '')
}
