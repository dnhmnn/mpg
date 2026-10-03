// Die Vorderseite der Gesundheitskarte lesen.
//
// WAS HIER NICHT PASSIERT: Der Chip wird nicht ausgelesen. Das kann ein
// Browser nicht — Web NFC spricht nur NDEF, eine Smartcard nur APDU. Hier
// wird das Aufgedruckte erkannt, und das ist weniger: die Adresse steht auf
// der Karte nicht, die gibt es nur aus dem Chip.
//
// WAS SICHER GEHT, sind die Muster: die Versichertennummer ist ein Buchstabe
// und neun Ziffern mit Prüfziffer, das Geburtsdatum hat vier Stellen im Jahr,
// die Kassennummer ist ein neunstelliges Institutionskennzeichen. Diese drei
// lassen sich aus dem Text herausziehen, ohne zu raten.
//
// NAMEN WERDEN NICHT GERATEN. Welche Zeile der Nachname ist und welche die
// Kasse, hängt vom Kartenlayout jeder Kasse ab. Statt zu raten, bietet die
// Maske die erkannten Zeilen zum Antippen an — ein Tipp je Feld, und es steht
// richtig da. Geraten und danebengelegen wäre schlimmer als gefragt.

export type EgkDaten = {
  versnr?: string
  gebdatum?: string
  kassennr?: string
  /** Alle Textzeilen, aus denen Name, Vorname und Kasse gewählt werden. */
  zeilen: string[]
}

/**
 * Die Prüfziffer einer Krankenversichertennummer.
 *
 * Verfahren nach § 290 SGB V: der Buchstabe wird durch seine Stelle im
 * Alphabet ersetzt (A=01 … Z=26), die so entstehenden zehn Ziffern werden von
 * links abwechselnd mit 1 und 2 multipliziert, von jedem Produkt die Quersumme
 * gebildet und alle addiert. Die letzte Stelle der Summe ist die Prüfziffer.
 *
 * Sie dient hier NUR als Hinweis beim Vergleichen — eine erkannte Nummer wird
 * nie verworfen, weil die Prüfziffer nicht passt. Eine Kamera, die sich
 * verliest, soll auffallen; ein Fehler in dieser Rechnung darf keine gültige
 * Karte blockieren.
 */
export function kvnrPruefziffer(ohnePruefziffer: string): number | null {
  const t = ohnePruefziffer.trim().toUpperCase()
  if (!/^[A-Z]\d{8}$/.test(t)) return null
  const buchstabe = String(t.charCodeAt(0) - 64).padStart(2, '0')
  const ziffern = (buchstabe + t.slice(1)).split('').map(Number)
  let summe = 0
  ziffern.forEach((z, i) => {
    const produkt = z * (i % 2 === 0 ? 1 : 2)
    summe += produkt >= 10 ? Math.floor(produkt / 10) + (produkt % 10) : produkt
  })
  return summe % 10
}

/** Hat diese Versichertennummer die richtige Form und Prüfziffer? */
export function kvnrGueltig(kvnr: string): boolean {
  const t = kvnr.trim().toUpperCase()
  if (!/^[A-Z]\d{9}$/.test(t)) return false
  const erwartet = kvnrPruefziffer(t.slice(0, 9))
  return erwartet !== null && erwartet === Number(t[9])
}

/** Verwechselbare Zeichen dort geraderücken, wo nur Ziffern stehen dürfen. */
function alsZiffern(text: string): string {
  return text
    .replace(/[OoDQ]/g, '0')
    .replace(/[IlL|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[B]/g, '8')
    .replace(/[Zz]/g, '2')
}

/**
 * Die Versichertennummer aus dem erkannten Text.
 *
 * Zuerst wird wörtlich gesucht; erst wenn das nichts ergibt, werden die
 * typischen Lesefehler der Kamera geradegerückt (O statt 0, I statt 1) und
 * nur ein Treffer mit stimmiger Prüfziffer übernommen. So wird aus einem
 * Verlesen keine falsche Nummer, die niemand mehr prüft.
 */
export function versichertennummerLesen(text: string): string | undefined {
  const woertlich = text.toUpperCase().match(/\b[A-Z]\d{9}\b/g) ?? []
  const gueltig = woertlich.find(kvnrGueltig)
  if (gueltig) return gueltig
  if (woertlich.length === 1) return woertlich[0]

  for (const roh of text.toUpperCase().match(/\b[A-Z][A-Z0-9|lIoOSsZB]{9}\b/g) ?? []) {
    const kandidat = roh[0] + alsZiffern(roh.slice(1))
    if (/^[A-Z]\d{9}$/.test(kandidat) && kvnrGueltig(kandidat)) return kandidat
  }
  return woertlich[0]
}

/**
 * Das Geburtsdatum, als ISO-Datum für das Formular.
 *
 * Auf der Karte stehen zwei Daten: das Geburtsdatum mit vierstelligem Jahr
 * und die Gültigkeit als MM/JJ. Nur das erste wird genommen, und nur, wenn es
 * in der Vergangenheit liegt — ein Datum in der Zukunft ist kein Geburtstag.
 */
export function geburtsdatumLesen(text: string, heute = new Date()): string | undefined {
  for (const m of text.matchAll(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})\b/g)) {
    const tag = Number(m[1])
    const monat = Number(m[2])
    const jahr = Number(m[3])
    if (monat < 1 || monat > 12 || tag < 1 || tag > 31) continue
    const d = new Date(Date.UTC(jahr, monat - 1, tag))
    if (d.getUTCMonth() !== monat - 1 || d.getUTCDate() !== tag) continue
    if (d.getTime() > heute.getTime()) continue
    if (jahr < 1890) continue
    return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
  }
  return undefined
}

/**
 * Die Kassennummer — ein neunstelliges Institutionskennzeichen.
 *
 * Es beginnt mit 10. Die Kartennummer auf derselben Karte ist deutlich
 * länger und beginnt mit 80276; sie darf nicht verwechselt werden, deshalb
 * zählt nur eine freistehende neunstellige Zahl.
 */
export function kassennummerLesen(text: string): string | undefined {
  return (text.match(/\b10\d{7}\b/g) ?? [])[0]
}

/**
 * Die Aufschriften der Karte selbst.
 *
 * Sie werden aus der Zeile herausgeschnitten, nicht die Zeile verworfen: die
 * Kamera liest "AOK Bayern Gesundheitskarte" als eine Zeile, und der
 * Kassenname darin ist brauchbar. Erst gestrichen wird, was danach übrig
 * bleibt — nämlich nichts.
 */
const AUFSCHRIFTEN = [
  /gesundheitskarte/gi,
  /krankenversicherungskarte/gi,
  /versicherten-?\s?nr\.?/gi,
  /versichertennummer/gi,
  /kennnummer/gi,
  /geburtsdatum/gi,
  /g(ü|ue)ltig\s+bis/gi,
  /\bvorname\b/gi,
  /\bname\b/gi,
  /\bcan\b/gi,
  /european health insurance card/gi,
  /europ(ä|ae)ische krankenversicherungskarte/gi,
]

/**
 * Zeilen, die als Name, Vorname oder Kasse in Frage kommen.
 *
 * Alles, was nach Abzug der Kartenaufschriften überwiegend aus Buchstaben
 * besteht und lang genug ist. Welche davon was ist, entscheidet die
 * Besatzung mit einem Tipp.
 */
export function namenszeilen(text: string): string[] {
  const aus: string[] = []
  for (const roh of text.split('\n')) {
    let zeile = roh.replace(/\s+/g, ' ').trim()
    for (const muster of AUFSCHRIFTEN) zeile = zeile.replace(muster, ' ')
    zeile = zeile.replace(/\s+/g, ' ').replace(/^[\s.,:;·|-]+|[\s.,:;·|-]+$/g, '').trim()
    if (zeile.length < 2 || zeile.length > 40) continue
    const buchstaben = (zeile.match(/[A-Za-zÄÖÜäöüß]/g) ?? []).length
    if (buchstaben < zeile.length * 0.6) continue
    if (!aus.includes(zeile)) aus.push(zeile)
  }
  return aus
}

/** Alles, was sich aus dem erkannten Text der Kartenvorderseite lesen lässt. */
export function egkLesen(text: string, heute = new Date()): EgkDaten {
  return {
    versnr: versichertennummerLesen(text),
    gebdatum: geburtsdatumLesen(text, heute),
    kassennr: kassennummerLesen(text),
    zeilen: namenszeilen(text),
  }
}

/** Die Felder des Bogens, die aus der Karte gefüllt werden können. */
export const EGK_FELDER = ['name', 'vorname', 'gebdatum', 'versnr', 'kasse'] as const

// ── Mehrere Bilder zu einem Ergebnis ────────────────────────────────────────
//
// Beim Lesen aus dem laufenden Bild kommt nicht jedes Einzelbild vollständig
// durch: in einem steht die Nummer scharf, im nächsten das Geburtsdatum.
// Deshalb wird gesammelt statt ersetzt.

/** Trägt ein neu gelesenes Bild in das bisher Gesammelte ein. */
export function egkSammeln(bisher: EgkDaten, neu: EgkDaten): EgkDaten {
  const zeilen = [...bisher.zeilen]
  for (const z of neu.zeilen) if (!zeilen.includes(z)) zeilen.push(z)

  // Eine Nummer mit stimmiger Prüfziffer schlägt eine ohne — sonst bleibt das
  // erste, möglicherweise verlesene Ergebnis für immer stehen.
  const besser =
    neu.versnr !== undefined &&
    (bisher.versnr === undefined ||
      (kvnrGueltig(neu.versnr) && !kvnrGueltig(bisher.versnr)))

  return {
    versnr: besser ? neu.versnr : bisher.versnr,
    gebdatum: bisher.gebdatum ?? neu.gebdatum,
    kassennr: bisher.kassennr ?? neu.kassennr,
    // Die Liste bleibt überschaubar, sonst wächst sie mit jedem Bild.
    zeilen: zeilen.slice(0, 14),
  }
}

/**
 * Reicht das Gesammelte, um aufzuhören?
 *
 * Die Prüfziffer ist das verlässliche Zeichen: stimmt sie, ist die Nummer
 * mit hoher Wahrscheinlichkeit richtig gelesen. Zusammen mit dem
 * Geburtsdatum ist das genug, um die Kamera auszuschalten — die Namen werden
 * ohnehin von Hand zugeordnet.
 */
export function egkGenug(d: EgkDaten): boolean {
  return Boolean(d.versnr && kvnrGueltig(d.versnr) && d.gebdatum)
}

/** Ein leeres Sammelergebnis. */
export function egkLeer(): EgkDaten {
  return { zeilen: [] }
}
