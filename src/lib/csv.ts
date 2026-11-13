// CSV für Excel: Semikolon, BOM für die Umlaute, Zeilenende CRLF, Formelschutz.
//
// Gemeinsam für CIRS (src/lib/cirs.ts) und den Eingang eigener Formulare
// (src/lib/formular/eingang.ts). Reine Rechnung bis auf `herunterladen`, das im
// Browser eine Datei anbietet.

/**
 * Ein Feld: Zeilenumbrüche vereinheitlicht, Formeln entschärft (Excel liest
 * „=…“, „+…“, „-…“, „@…“ und ein führendes Tabulatorzeichen sonst als Rechnung),
 * in Anführungszeichen, wenn Semikolon, Anführungszeichen oder Umbruch darin stehen.
 */
export function csvFeld(wert: unknown): string {
  const s = String(wert ?? '').replace(/\r\n?/g, '\n')
  const sicher = /^[=+\-@\t]/.test(s) ? `'${s}` : s
  return /[;"\n]/.test(sicher) ? `"${sicher.replace(/"/g, '""')}"` : sicher
}

/** Zeilen (erste: Kopf) als CSV-Text mit BOM und CRLF. */
export function csvText(zeilen: unknown[][]): string {
  return '\uFEFF' + zeilen.map((z) => z.map(csvFeld).join(';')).join('\r\n')
}

/** Eine Datei im Browser anbieten (Text, etwa CSV). */
export function herunterladen(name: string, inhalt: string, typ: string): void {
  const url = URL.createObjectURL(new Blob([inhalt], { type: typ }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
