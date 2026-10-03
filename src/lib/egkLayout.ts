// Die Karte über ihre Geometrie lesen, nicht über Textraten.
//
// Die Texterkennung liefert nicht nur Text, sondern jede Zeile mit Rahmen und
// Zuversicht. Auf einer Karte steht in diesen Zahlen mehr als im Text:
//
//   y= 228  x= 360  h= 15  "Name"          ← Beschriftung, klein
//   y= 258  x= 362  h= 30  "Mustermann"    ← Wert, doppelt so hoch
//   y= 348  x= 359  h= 15  "Vorname"
//   y= 377  x= 362  h= 31  "Heinz"
//
// Beschriftungen sind klein, Werte groß, und der Wert steht direkt unter
// seiner Beschriftung in derselben Spalte. Das gilt unabhängig davon, wie die
// Texterkennung die Zeilen sortiert — und genau daran ist das Raten über die
// Zeilenreihenfolge vorher gescheitert.
//
// Ohne Beschriftungen bleibt die Stellung: die großen Zeilen der Datenspalte,
// von oben nach unten, sind Nachname und Vorname; die Kasse steht oben in
// einer anderen Spalte.

export type ErkannteZeile = {
  text: string
  /** Rahmen der Zeile im erkannten Bild. */
  x0: number
  y0: number
  x1: number
  y1: number
  /** 0 bis 100. */
  confidence: number
}

export type Zuordnung = {
  name?: string
  vorname?: string
  kasse?: string
  /** Woher die Zuordnung kommt — steht in der Oberfläche als Begründung. */
  quelle: 'beschriftung' | 'stellung' | 'keine'
}

/** Beschriftungen der Karte und das Feld, das darunter steht. */
const BESCHRIFTUNG: [RegExp, 'name' | 'vorname' | 'kasse'][] = [
  // Vorname zuerst: "Name" steckt als Wort in "Vorname".
  [/^vorname\b/i, 'vorname'],
  [/^(familienname|nachname|name)\b/i, 'name'],
  [/^(kasse|krankenkasse|kostentr(ä|ae)ger)\b/i, 'kasse'],
]

/** Zeilen, die nie ein Wert sind. */
const NIE_WERT = [
  /^gesundheitskarte$/i,
  /^(europ(ä|ae)ische )?krankenversicherungskarte$/i,
  /^european health insurance card$/i,
  /^g(ü|ue)ltig\b/i,
  /^can\b/i,
  /^versicherten/i,
  /^geburtsdatum$/i,
  /^kennnummer/i,
]

/**
 * Aufschriften der Karte, die mit im Kassennamen stehen können.
 *
 * Die Kamera liest "AOK Bayern Gesundheitskarte" als eine Zeile — und oft
 * nur als "AOK Bayern Gesund", weil der Rest im Glanz untergeht. Deshalb
 * wird auch ein ABGESCHNITTENES Wort erkannt.
 */
const AUFSCHRIFT_IM_NAMEN = [
  /\bgesundheits?(karte|kart|kar|ka|k)?\b/gi,
  /\bgesund\b/gi,
  /\bkrankenversicherungskarte\b/gi,
  /\beuropean health insurance card\b/gi,
  /\bprivat\b/gi,
  /\bg\s?2(\.1)?\b/gi,
]

/** Den Kassennamen aus einer Zeile holen, die auch die Aufschrift trägt. */
export function kassenname(zeile: string): string | undefined {
  let t = zeile
  for (const m of AUFSCHRIFT_IM_NAMEN) t = t.replace(m, ' ')
  t = t.replace(/\s+/g, ' ').replace(/^[\s.,:;·|-]+|[\s.,:;·|-]+$/g, '').trim()
  return t.length >= 2 ? t : undefined
}

/** Titel, die vor dem Vornamen stehen können und nicht dazugehören. */
const TITEL = /^(dr|prof|dipl|ing|med|dent|rer|nat|phil|jur|habil|h\.?c|mag|lic|bsc|msc|ba|ma|em)\.?$/i

/**
 * Vorsatzwörter: sie gehören zum Familiennamen, nicht zum Vornamen.
 * "Heinz von Mustermann" hat den Familiennamen "von Mustermann".
 */
const VORSATZ = new Set([
  'von', 'vom', 'van', 'van der', 'de', 'del', 'della', 'der', 'den', 'di', 'du',
  'la', 'le', 'zu', 'zur', 'zum', 'ten', 'ter', 'af', 'av', 'dos', 'das', 'el', 'al',
])

/**
 * Den aufgedruckten Namen in Vorname und Familienname zerlegen.
 *
 * Die eGK trägt den Namen als EINE Zeichenkette in natürlicher Reihenfolge —
 * "Titel Vorname Namenszusatz Familienname" — ohne jede Beschriftung. Der
 * Familienname steht also HINTEN, nicht in einer eigenen Zeile darüber. Eine
 * Zuordnung, die die obere Zeile für den Nachnamen hält, dreht jeden Namen um.
 *
 * Quelle: gemSpec_eGK_Opt, Bedruckung des Personalisierungsfeldes.
 */
export function namenZerlegen(gedruckt: string): { vorname?: string; name?: string } {
  const teile = sauber(gedruckt)
    .split(' ')
    .map((t) => t.replace(/^[.,;:]+|[.,;:]+$/g, ''))
    .filter((t) => t.length > 0)
    .filter((t) => !TITEL.test(t))
  if (teile.length === 0) return {}
  if (teile.length === 1) return { name: teile[0] }

  // Ab dem ersten Vorsatzwort gehört alles zum Familiennamen.
  const ab = teile.findIndex((t, i) => i > 0 && i < teile.length - 1 && VORSATZ.has(t.toLowerCase()))
  const schnitt = ab === -1 ? teile.length - 1 : ab
  return {
    vorname: teile.slice(0, schnitt).join(' ') || undefined,
    name: teile.slice(schnitt).join(' ') || undefined,
  }
}

const hoehe = (z: ErkannteZeile) => z.y1 - z.y0
const sauber = (t: string) => t.replace(/\s+/g, ' ').trim()

function istWert(z: ErkannteZeile): boolean {
  const t = sauber(z.text)
  if (t.length < 2 || t.length > 40) return false
  if (NIE_WERT.some((m) => m.test(t))) return false
  if (BESCHRIFTUNG.some(([m]) => m.test(t))) return false
  const buchstaben = (t.match(/[A-Za-zÄÖÜäöüß]/g) ?? []).length
  return buchstaben >= t.length * 0.55
}

function median(zahlen: number[]): number {
  if (zahlen.length === 0) return 0
  const s = [...zahlen].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/**
 * Die Zeile, die als Wert unter dieser Beschriftung steht.
 *
 * In derselben Spalte (die Kamera verschiebt um ein paar Pixel), darunter,
 * und nicht weiter weg als drei Beschriftungshöhen — sonst gehört sie zu
 * etwas anderem.
 */
function wertUnter(beschriftung: ErkannteZeile, zeilen: ErkannteZeile[]): ErkannteZeile | undefined {
  const h = Math.max(hoehe(beschriftung), 8)
  return zeilen
    .filter((z) => z !== beschriftung)
    .filter((z) => z.y0 > beschriftung.y0)
    .filter((z) => z.y0 - beschriftung.y1 < h * 3)
    .filter((z) => Math.abs(z.x0 - beschriftung.x0) < Math.max(h * 4, 60))
    .filter(istWert)
    .sort((a, b) => a.y0 - b.y0)[0]
}

/**
 * Name, Vorname und Kasse aus den erkannten Zeilen bestimmen.
 *
 * Erst über die Beschriftungen der Karte, dann über die Stellung. Es wird
 * zugeordnet, nicht zur Auswahl gestellt: wer eine Karte scannt, will das
 * Ergebnis, nicht eine Liste.
 */
export function zuordnen(rohZeilen: ErkannteZeile[], anker?: { gebdatum?: string; versnr?: string }): Zuordnung {
  const zeilen = rohZeilen
    .map((z) => ({ ...z, text: sauber(z.text) }))
    .filter((z) => z.text.length > 0 && z.confidence >= 45)
  if (zeilen.length === 0) return { quelle: 'keine' }

  const aus: Zuordnung = { quelle: 'keine' }

  // ── 1. Über die Beschriftungen ───────────────────────────────────────────
  for (const z of zeilen) {
    const treffer = BESCHRIFTUNG.find(([m]) => m.test(z.text))
    if (!treffer) continue
    const wert = wertUnter(z, zeilen)
    if (wert && !aus[treffer[1]]) {
      aus[treffer[1]] = wert.text
      aus.quelle = 'beschriftung'
    }
  }

  // ── 2. Über die Stellung, für das, was noch fehlt ────────────────────────
  const werte = zeilen.filter(istWert)
  if (werte.length === 0) return aus

  /*
   * Die Schriftgröße trennt hier NICHT Wert von Beschriftung: das
   * Personalisierungsfeld der eGK ist einheitlich in einer Größe gesetzt,
   * Name und Nummern sind gleich hoch. Eine Schwelle am Median hat deshalb
   * die Namenszeile weggeworfen, sobald nur zwei Zeilen erkannt wurden.
   *
   * Was die Größe sehr wohl verrät, sind die beiden 5-pt-Legenden
   * ("Versicherung", "Versichertennummer") — die sind ein Bruchteil hoch.
   * Darauf, und nur darauf, zielt die Schwelle.
   */
  const hMed = median(werte.map(hoehe))
  const hMax = Math.max(...werte.map(hoehe))
  const gross = werte.filter((z) => hoehe(z) >= hMax * 0.4)

  /**
   * Welche Spalte die Personendaten trägt, wird NICHT über die Anzahl
   * bestimmt — bei Gleichstand gewann sonst die Kassenspalte, und die Kasse
   * bekam den Nachnamen. Maßgeblich sind die Anker: Geburtsdatum und
   * Versichertennummer stehen immer in der Datenspalte.
   */
  const ankerZeilen = zeilen.filter((z) =>
    /\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4}\b/.test(z.text) ||
    /\b[A-Z]\d{9}\b/.test(z.text.toUpperCase()),
  )
  const zugeordnet = zeilen.filter((z) => z.text === aus.name || z.text === aus.vorname)
  const massgeblich = [...ankerZeilen, ...zugeordnet]
  const toleranz = Math.max(hMed * 3, 50)
  const inDatenspalte = (z: ErkannteZeile) =>
    massgeblich.length > 0 && massgeblich.some((a) => Math.abs(a.x0 - z.x0) < toleranz)

  const daten = (massgeblich.length > 0 ? gross.filter(inDatenspalte) : gross)
    .slice()
    .sort((a, b) => a.y0 - b.y0)

  if (!aus.kasse) {
    // Die Kasse steht oben und außerhalb der Datenspalte. Steht alles in
    // einer Spalte, ist es die oberste Zeile — aber nur, wenn darunter noch
    // genug für Nachname und Vorname übrig bleibt. Sonst wäre der Nachname
    // die Kasse, und das ist der schlimmere Fehler.
    const ausserhalb = gross.filter((z) => !inDatenspalte(z))
    const einspaltig = ausserhalb.length === 0
    const oben = (einspaltig ? daten : ausserhalb).slice().sort((a, b) => a.y0 - b.y0)[0]
    const genugUebrig = daten.length >= 3
    if (oben && (!daten.includes(oben) || (einspaltig && genugUebrig))) {
      // "AOK Bayern Gesundheitskarte" ist eine Zeile — die Aufschrift der
      // Karte gehört nicht zum Kassennamen.
      const ohneAufschrift = kassenname(oben.text)
      if (ohneAufschrift) {
        aus.kasse = ohneAufschrift
        if (aus.quelle === 'keine') aus.quelle = 'stellung'
      }
    }
  }

  if (!aus.name && !aus.vorname) {
    /*
     * Der Name steht auf der eGK ohne Beschriftung, als eine Zeichenkette,
     * direkt ÜBER der Zahlenzeile mit Institutionskennzeichen und
     * Versichertennummer. Diese Zahlenzeile ist der einzige harte Anker auf
     * der Karte — sie trägt eine Prüfziffer, die sich nachrechnen lässt.
     *
     * Die Schriftgröße hilft hier nicht: das Personalisierungsfeld ist
     * einheitlich in einer Größe gesetzt, Name und Nummern sind gleich hoch.
     */
    const zahlenzeile = zeilen
      .filter((z) => /\b[A-Z]\d{9}\b/.test(z.text.toUpperCase()) || /\b10\d{7}\b/.test(z.text))
      .sort((a, b) => a.y0 - b.y0)[0]

    const kandidaten = (zahlenzeile
      ? daten.filter((z) => z.y1 <= zahlenzeile.y0 + hMed)
      : daten
    ).filter((z) => z.text !== aus.kasse)

    // Bis zu zwei Namenszeilen: ab 28 Zeichen bricht die Karte um.
    const namenszeilen = kandidaten.slice(-2)
    const gedruckt = namenszeilen.map((z) => z.text).join(' ')
    const zerlegt = namenZerlegen(gedruckt)
    if (zerlegt.name || zerlegt.vorname) {
      aus.name = zerlegt.name
      aus.vorname = zerlegt.vorname
      if (aus.quelle === 'keine') aus.quelle = 'stellung'
    }
  } else if (!aus.name || !aus.vorname) {
    // Eine Beschriftung hat nur eines von beiden geliefert — der Rest steckt
    // dann meist in derselben Zeile.
    const einzeln = aus.name ?? aus.vorname ?? ''
    const zerlegt = namenZerlegen(einzeln)
    if (zerlegt.name && zerlegt.vorname) {
      aus.name = aus.name ? zerlegt.name : aus.name
      aus.vorname = aus.vorname ? aus.vorname : zerlegt.vorname
    }
  }

  return aus
}
