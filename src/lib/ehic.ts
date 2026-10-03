// Die Rückseite der Gesundheitskarte lesen — die Europäische
// Krankenversicherungskarte.
//
// WARUM DIE RÜCKSEITE DIE BESSERE SEITE IST. Die Vorderseite trägt den Namen
// ohne jede Beschriftung, als eine Zeichenkette in natürlicher Reihenfolge,
// in einheitlicher Schriftgröße, und ein Geburtsdatum muss sie nicht führen.
// Jede Angabe muss dort erraten werden. Die Rückseite ist EU-weit nach einer
// gemeinsamen Vorgabe gestaltet und NUMMERIERT ihre Felder:
//
//   3  Name (Familienname)          6  Persönliche Kennnummer
//   4  Vornamen                     7  Kennnummer des Trägers
//   5  Geburtsdatum                 8  Kennnummer der Karte
//                                   9  Ablaufdatum
//
// So liest die Kamera eine solche Karte wirklich:
//
//   3 Name Mustermann
//   4 Vornamen Heinz Peter
//   5 Geburtsdatum 09/03/1958
//   6 Persönlkıche Kennnummer K987654329
//
// DIE NUMMER IST DER ANKER, NICHT DIE BESCHRIFTUNG. Eine einzelne Ziffer
// liest die Kamera fast immer richtig; die Beschriftung verliest sie, wie
// "Persönlkıche" zeigt. Darauf zu bauen hieße, denselben Fehler wie auf der
// Vorderseite zu machen, nur mit mehr Zuversicht.
//
// Wo es möglich ist, wird der Wert zusätzlich über seine FORM geholt —
// Datum, Versichertennummer, Kennnummern sind an ihrem Muster zu erkennen.
// Nur bei Name und Vornamen gibt es keine Form, dort wird die Beschriftung
// abgeschnitten.

import { kvnrGueltig, versichertennummerLesen } from './egk'

export type EhicDaten = {
  name?: string
  vorname?: string
  gebdatum?: string
  versnr?: string
  kassennr?: string
  kasse?: string
  ablauf?: string
  /** Welche Feldnummern gelesen wurden — für die Rückmeldung. */
  felder: number[]
}

/** Die Beschriftungen, die vor dem Wert stehen können, je Feldnummer. */
const BESCHRIFTUNGEN: Record<number, string[]> = {
  3: ['name', 'familienname', 'surname'],
  4: ['vornamen', 'vorname', 'given names', 'given name'],
  5: ['geburtsdatum', 'date of birth'],
  6: ['persönliche kennnummer', 'persoenliche kennnummer', 'personal identification number'],
  7: ['kennnummer des trägers', 'kennnummer des traegers', 'identification number of the institution'],
  8: ['kennnummer der karte', 'identification number of the card'],
  9: ['ablaufdatum', 'gültigkeitsdauer', 'expiry date'],
}

/** Zwei Wörter, die sich in den ersten Zeichen gleichen — die Kamera verliest den Rest. */
function aehnlich(wort: string, erwartet: string): boolean {
  const a = wort.toLowerCase().replace(/[^a-zäöüß]/g, '')
  const b = erwartet.toLowerCase().replace(/[^a-zäöüß]/g, '')
  if (a.length === 0 || b.length === 0) return false
  const n = Math.min(4, Math.min(a.length, b.length))
  return a.slice(0, n) === b.slice(0, n)
}

/**
 * Die Beschriftung vom Anfang abschneiden.
 *
 * Verglichen wird nur der Wortanfang: aus "Persönlkıche Kennnummer" wird so
 * trotzdem die Beschriftung erkannt. Was übrig bleibt, ist der Wert.
 */
function ohneBeschriftung(rest: string, nummer: number): string {
  const worte = rest.trim().split(/\s+/).filter(Boolean)
  for (const beschriftung of BESCHRIFTUNGEN[nummer] ?? []) {
    const teile = beschriftung.split(' ')
    if (worte.length <= teile.length) continue
    const passt = teile.every((t, i) => aehnlich(worte[i] ?? '', t))
    if (passt) return worte.slice(teile.length).join(' ')
  }
  return worte.join(' ')
}

const datum = (t: string): string | undefined => {
  const m = t.match(/\b(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})\b/)
  if (!m) return undefined
  const [, tag, monat, jahr] = m
  const d = new Date(Date.UTC(Number(jahr), Number(monat) - 1, Number(tag)))
  if (d.getUTCMonth() !== Number(monat) - 1 || d.getUTCDate() !== Number(tag)) return undefined
  return `${jahr}-${monat.padStart(2, '0')}-${tag.padStart(2, '0')}`
}

/**
 * Trägt dieses Erkennungsergebnis die Rückseite?
 *
 * Erkannt an den nummerierten Feldern — drei verschiedene Nummern aus dem
 * Bereich 3 bis 9 am Zeilenanfang gibt es auf der Vorderseite nicht — oder am
 * Titel der Karte.
 */
export function istRueckseite(text: string): boolean {
  if (/krankenversicherungskarte|health insurance card/i.test(text)) return true
  const nummern = new Set<number>()
  for (const zeile of text.split('\n')) {
    const m = zeile.trim().match(/^([3-9])\s+\S/)
    if (m) nummern.add(Number(m[1]))
  }
  return nummern.size >= 3
}

/**
 * Die Rückseite auswerten.
 *
 * Jede Zeile, die mit einer Feldnummer beginnt, wird ihrem Feld zugeordnet.
 * Der Wert kommt über seine Form, wo er eine hat, und sonst durch Abschneiden
 * der Beschriftung.
 */
export function ehicLesen(text: string): EhicDaten {
  const aus: EhicDaten = { felder: [] }

  for (const rohZeile of text.split('\n')) {
    const zeile = rohZeile.replace(/\s+/g, ' ').trim()
    // Ein führender Strich oder Balken ist der Rand, den die Kamera mitliest.
    const m = zeile.replace(/^[|\\/\]\[l!]+\s*/, '').match(/^([3-9])\s+(.+)$/)
    if (!m) continue
    const nummer = Number(m[1])
    const rest = m[2]

    if (nummer === 3) {
      const wert = ohneBeschriftung(rest, 3)
      if (wert && !/\d/.test(wert)) { aus.name = wert; aus.felder.push(3) }
    } else if (nummer === 4) {
      const wert = ohneBeschriftung(rest, 4)
      if (wert && !/\d/.test(wert)) { aus.vorname = wert; aus.felder.push(4) }
    } else if (nummer === 5) {
      const d = datum(rest)
      if (d) { aus.gebdatum = d; aus.felder.push(5) }
    } else if (nummer === 6) {
      const nr = versichertennummerLesen(rest)
      if (nr) { aus.versnr = nr; aus.felder.push(6) }
    } else if (nummer === 7) {
      // Das Institutionskennzeichen, und dahinter oft der Kassenname.
      const ik = rest.match(/\b\d{9}\b/)
      if (ik) {
        aus.kassennr = ik[0]
        aus.felder.push(7)
        const dahinter = rest.slice((ik.index ?? 0) + ik[0].length).trim()
        const kasse = dahinter.replace(/^[\s.,:;·|-]+/, '').trim()
        if (kasse.length >= 2 && /[A-Za-zÄÖÜäöüß]/.test(kasse)) aus.kasse = kasse
      }
    } else if (nummer === 8) {
      const kartennr = rest.match(/\b\d{12,}\b/)
      if (kartennr) { aus.felder.push(8) }
    } else if (nummer === 9) {
      const d = datum(rest)
      if (d) { aus.ablauf = d; aus.felder.push(9) }
    }
  }

  return aus
}

/**
 * Reicht das, um aufzuhören?
 *
 * Die Prüfziffer der Versichertennummer ist das einzige selbstprüfende
 * Merkmal auf der Karte. Steht sie zusammen mit Name und Vornamen, ist die
 * Rückseite gelesen — auf das Ablaufdatum kommt es für die Dokumentation
 * nicht an.
 */
export function ehicGenug(d: EhicDaten): boolean {
  return Boolean(d.versnr && kvnrGueltig(d.versnr) && d.name && d.vorname)
}

/** Mehrere Bilder zu einem Ergebnis sammeln. */
export function ehicSammeln(bisher: EhicDaten, neu: EhicDaten): EhicDaten {
  const besser =
    neu.versnr !== undefined &&
    (bisher.versnr === undefined || (kvnrGueltig(neu.versnr) && !kvnrGueltig(bisher.versnr)))
  return {
    name: bisher.name ?? neu.name,
    vorname: bisher.vorname ?? neu.vorname,
    gebdatum: bisher.gebdatum ?? neu.gebdatum,
    versnr: besser ? neu.versnr : bisher.versnr,
    kassennr: bisher.kassennr ?? neu.kassennr,
    kasse: bisher.kasse ?? neu.kasse,
    ablauf: bisher.ablauf ?? neu.ablauf,
    felder: [...new Set([...bisher.felder, ...neu.felder])].sort(),
  }
}

export function ehicLeer(): EhicDaten {
  return { felder: [] }
}
