// Diktat auswerten — gesprochenen Text in Protokollfelder übersetzen.
//
// WOFÜR: Die Schnelldokumentation. Wer eine Hand am Patienten hat, tippt nicht.
// Der Sanitäter diktiert „RR 120 zu 80, Puls 88, Sättigung 96", und daraus
// werden Felder.
//
// ────────────────────────────────────────────────────────────────────────
// DIE REGEL, AN DER HIER ALLES HÄNGT:
//
//   Das Diktat SCHLÄGT VOR. Der Mensch bestätigt. Der Wortlaut bleibt.
//
// Ein falsch verstandener Wert steht sonst als Messwert in einem Dokument,
// das nach dem Einsatz rechtlich zählt. Deshalb:
//
//   1. Nur übernehmen, was eindeutig ist. Im Zweifel nichts.
//   2. Unplausible Werte NICHT übernehmen, sondern melden — ein Puls von 880
//      ist ein Hörfehler, kein Messwert.
//   3. Der diktierte Wortlaut wird IMMER unverändert mitgeführt. Auch wenn
//      die Auswertung danebenliegt, steht die Quelle noch da.
//   4. Nie überschreiben, was schon eingetragen ist.
// ────────────────────────────────────────────────────────────────────────

export interface Messwert {
  feld: string
  wert: string
  /** Wortlaut, aus dem der Wert stammt — für die Rückschau. */
  quelle: string
}

export interface Verworfen {
  feld: string
  wert: string
  grund: string
  quelle: string
}

export interface Diktatergebnis {
  /** Übernommene Werte, Feldname wie im Protokoll. */
  werte: Messwert[]
  /** Erkannt, aber nicht übernommen — mit Begründung. */
  verworfen: Verworfen[]
  /** Der unveränderte Wortlaut. Kommt immer mit ins Protokoll. */
  wortlaut: string
}

/** Was plausibel ist. Außerhalb dieser Spannen wird nichts übernommen. */
const SPANNEN: Record<string, [number, number, string]> = {
  rr_sys: [40, 300, 'mmHg'],
  rr_dia: [20, 200, 'mmHg'],
  hf: [20, 300, '/min'],
  spo2: [50, 100, '%'],
  bz: [10, 900, 'mg/dl'],
  af: [4, 60, '/min'],
  gcs: [3, 15, 'Punkte'],
  temp: [25, 43, '°C'],
  schmerz: [0, 10, 'NRS'],
}

/**
 * Muster, in der Reihenfolge ihrer Anwendung.
 *
 * Der Blutdruck steht ZUERST, weil „120 zu 80" sonst von einem der
 * Einzelwertmuster halb erwischt würde.
 */
const MUSTER: Array<{ feld: string[]; re: RegExp }> = [
  // Blutdruck: „RR 120 zu 80", „Blutdruck 120/80", „RR 120 auf 80"
  { feld: ['rr_sys', 'rr_dia'], re: /\b(?:rr|blutdruck|druck)\D{0,12}?(\d{2,3})\s*(?:zu|\/|auf|zn)\s*(\d{2,3})/i },
  // Auch ohne Wort davor, wenn die Form eindeutig ist: „120 zu 80"
  { feld: ['rr_sys', 'rr_dia'], re: /\b(\d{2,3})\s*(?:zu|\/)\s*(\d{2,3})\b(?!\s*(?:jahre|prozent))/i },

  { feld: ['hf'], re: /\b(?:puls|herzfrequenz|hf|frequenz)\D{0,12}?(\d{1,3})/i },
  { feld: ['spo2'], re: /\b(?:spo\s*2|sp0\s*2|s[aä]ttigung|sauerstoffs[aä]ttigung|sato?2?)\D{0,12}?(\d{1,3})/i },
  { feld: ['bz'], re: /\b(?:bz|blutzucker|zucker|glukose)\D{0,12}?(\d{1,3})/i },
  { feld: ['af'], re: /\b(?:af|atemfrequenz|atmung)\D{0,12}?(\d{1,2})/i },
  { feld: ['gcs'], re: /\bgcs\D{0,12}?(\d{1,2})/i },
  { feld: ['temp'], re: /\b(?:temp|temperatur|fieber)\D{0,12}?(\d{2}(?:[.,]\d)?)/i },
  { feld: ['schmerz'], re: /\b(?:schmerz|schmerzen|nrs|vas)\D{0,12}?(\d{1,2})\b/i },
]

/** Komma als Dezimaltrenner, wie im Deutschen gesprochen. */
function zahl(s: string): number {
  return Number(String(s).replace(',', '.'))
}

/**
 * Einen diktierten Satz auswerten.
 *
 * `vorhanden` sind Felder, die schon einen Wert haben — die werden NICHT
 * angefasst. Wer etwas eingetippt hat, hat es so gemeint.
 */
export function diktatAuswerten(text: string, vorhanden: Record<string, unknown> = {}): Diktatergebnis {
  const wortlaut = String(text || '')
  const werte: Messwert[] = []
  const verworfen: Verworfen[] = []
  const belegt = new Set(
    Object.keys(vorhanden).filter(k => {
      const v = vorhanden[k]
      return v !== undefined && v !== null && String(v).trim() !== ''
    }),
  )

  for (const { feld, re } of MUSTER) {
    // Schon gefunden? Das erste Muster gewinnt — die spezifischeren stehen oben.
    if (feld.every(f => werte.some(w => w.feld === f))) continue
    const t = wortlaut.match(re)
    if (!t) continue

    for (let i = 0; i < feld.length; i++) {
      const f = feld[i]
      if (werte.some(w => w.feld === f)) continue
      const roh = t[i + 1]
      if (roh === undefined) continue

      if (belegt.has(f)) {
        verworfen.push({ feld: f, wert: roh, grund: 'schon eingetragen — nicht überschrieben', quelle: t[0].trim() })
        continue
      }

      const spanne = SPANNEN[f]
      const n = zahl(roh)
      if (spanne && (!Number.isFinite(n) || n < spanne[0] || n > spanne[1])) {
        verworfen.push({
          feld: f, wert: roh,
          grund: `außerhalb des Plausiblen (${spanne[0]}–${spanne[1]} ${spanne[2]})`,
          quelle: t[0].trim(),
        })
        continue
      }
      werte.push({ feld: f, wert: roh.replace('.', ','), quelle: t[0].trim() })
    }
  }

  // Ein Blutdruck nur halb erkannt ist keiner — aber er darf auch nicht
  // lautlos verschwinden. Wer „RR 120" sagt, hat etwas gemeint; wenn daraus
  // nichts wird, muss er das sehen.
  if (!werte.some(w => w.feld === 'rr_sys' || w.feld === 'rr_dia')) {
    const halb = wortlaut.match(/\b(?:rr|blutdruck|druck)\D{0,12}?(\d{2,3})\b/i)
    if (halb) {
      verworfen.push({
        feld: 'rr_sys', wert: halb[1],
        grund: 'nur ein halber Blutdruck erkannt — bitte systolisch und diastolisch angeben',
        quelle: halb[0].trim(),
      })
    }
  }

  const sys = werte.find(w => w.feld === 'rr_sys')
  const dia = werte.find(w => w.feld === 'rr_dia')
  if (sys && !dia) {
    werte.splice(werte.indexOf(sys), 1)
    verworfen.push({ feld: 'rr_sys', wert: sys.wert, grund: 'nur ein halber Blutdruck erkannt', quelle: sys.quelle })
  }
  if (dia && !sys) {
    werte.splice(werte.indexOf(dia), 1)
    verworfen.push({ feld: 'rr_dia', wert: dia.wert, grund: 'nur ein halber Blutdruck erkannt', quelle: dia.quelle })
  }

  return { werte, verworfen, wortlaut }
}

/** Anzeigename eines Feldes — für die Bestätigung durch den Menschen. */
export const FELDNAME: Record<string, string> = {
  rr_sys: 'Blutdruck systolisch',
  rr_dia: 'Blutdruck diastolisch',
  hf: 'Herzfrequenz',
  spo2: 'Sättigung',
  bz: 'Blutzucker',
  af: 'Atemfrequenz',
  gcs: 'GCS',
  temp: 'Temperatur',
  schmerz: 'Schmerz',
}

/** Einheit eines Feldes, rein zur Anzeige. */
export function einheit(feld: string): string {
  return SPANNEN[feld] ? SPANNEN[feld][2] : ''
}
