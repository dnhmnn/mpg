// Bild „schreibstube“: Schreibstube (/office) der Feuerwehr Musterstadt am 19.11.2026, 09:41. Oben „Neu“
// (Dokument, Tabelle, Präsentation), Suche und Filter nach Art, „Zuletzt geöffnet“ (Unterweisung Atemschutz, Haushaltsplan,
// Hygieneplan) und darunter alle Dokumente der Ablage, das zuletzt geänderte zuerst, je mit Ordner und Endung.
// Die Schreibstube liest dieselbe Sammlung files wie die Dateien: dieselbe erfundene Ablage (ABLAGE aus dateien.mjs).
// Was zuletzt geöffnet wurde, merkt sich das Gerät (localStorage „office_recent“, src/pages/Office.tsx); vor dem
// Bild wird es gesetzt und die Seite neu geladen, wie nach drei geöffneten Dokumenten. Den Editor selbst zeigt das
// Bild nicht: Er kommt vom Office-Server, den es hier nicht gibt.
// Nur erfundene Daten: erfundene Feuerwehr, keine Personen, keine Patientendaten, keine Markennamen.

import { ABLAGE } from './dateien.mjs'

const id = (name) => ABLAGE.find((e) => e.name === name).id
const ZULETZT = ['Unterweisung Atemschutz.pptx', 'Haushaltsplan 2027.xlsx', 'Hygieneplan.pdf'].map(id)

export const bild = {
  name: 'schreibstube',
  pfad: '/office',
  warte: 1000,
  sammlungen: { files: ABLAGE },
  vorher: async (page) => {
    await page.evaluate((ids) => localStorage.setItem('office_recent', JSON.stringify(ids)), ZULETZT)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
  },
}
