// Ablauf der Szene auf responda.systems als reine Rechnung (ohne DOM), mit Prüffällen in
// src/lib/__tests__/landingAblauf.test.ts. Alle Längen in Bildschirmhöhen (100svh) ab dem Anfang der Szene.
// Designrunde vom 27.11.2026: Auftakt (Handy aus der Tasche), Übersicht, vier Kapitel mit je einem großen
// Kapitelmoment, gewichtete Schritte je App, ein Schluss, der den Kreis schließt („Für den ganzen Dienst.
// In einer App.“). Bilder wechseln ohne Schleier: Das neue blendet über dem alten ein, das alte bleibt deckend.

export const klemm = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
/** Anteil von p zwischen a und b, weich (ohne Überschwingen) */
export const weich = (p: number, a: number, b: number) => { const t = klemm((p - a) / (b - a)); return t * t * (3 - 2 * t) }
export const zwischen = (a: number, b: number, t: number) => a + (b - a) * t

export type KapitelName = 'Im Einsatz' | 'Material' | 'Ausbildung' | 'Team und Organisation'

export interface Modul {
  name: string
  kapitel: KapitelName | ''
  titel: [string, string]
  text: string
  neu?: boolean
  /** Länge des Schritts in Bildschirmhöhen */
  laenge: number
  /** Bilder in public/website/ (ohne Endung); ein zweites Bild schiebt sich in der Mitte des Schritts herein */
  bilder: string[]
}

/** Die Apps in der Szene, je mit Bild der App (erfundene Daten). Owner, 26.11.2026: alle Apps, auch
 *  Einsätze und Ausbildungen (hebt die Festlegung vom 20.11.2026 auf). */
export const MODULE: Modul[] = [
  { name: 'Responda', kapitel: '', titel: ['Alles an einem Ort.', 'Auf dem Handy.'], laenge: 0.6, bilder: ['hub'],
    text: 'Jede Einsatzkraft sieht die Apps, die sie braucht. Im Browser, ohne Installation. Gespeichert wird auf einem eigenen Server in Nürnberg.' },
  { name: 'Einsätze', kapitel: 'Im Einsatz', titel: ['Der Einsatz', 'hält alles zusammen.'], laenge: 0.8, bilder: ['einsaetze'],
    text: 'Protokolle und Produktausgaben mit derselben Einsatznummer gehören von selbst dazu, dazu Personen und beteiligte Organisationen.' },
  { name: 'Patientendokumentation', kapitel: 'Im Einsatz', titel: ['Das Protokoll entsteht', 'beim Patienten.'], laenge: 0.8, bilder: ['protokoll'],
    text: 'Feld für Feld am Telefon, auch ohne Netz. Danach unterschreiben und freigeben.' },
  { name: 'Patienten', kapitel: 'Im Einsatz', titel: ['Offene Protokolle', 'auf einen Blick.'], laenge: 0.5, bilder: ['patienten'],
    text: 'Prüfen, freigeben und archivieren, für die Leitung und die Verantwortlichen.' },
  { name: 'Vorgänge und CIRS', kapitel: 'Im Einsatz', titel: ['Formulare', 'statt Zettel.'], laenge: 0.5, bilder: ['vorgaenge'],
    text: 'Eigene Formulare und Anträge, CIRS-Meldungen auf Wunsch anonym, auch über Link oder QR-Code.' },
  { name: 'Medizinprodukte', kapitel: 'Material', titel: ['Schwerer Defekt', 'heißt gesperrt.'], laenge: 0.8, bilder: ['mpg'],
    text: 'Prüfen, STK und MTK im Blick, Defekte melden, auch über QR-Code. Ein schwerer Defekt sperrt das Gerät, bis er behoben und das Gerät freigegeben ist.' },
  { name: 'Hygiene', kapitel: 'Material', neu: true, titel: ['Desinfiziert.', 'Und nachgewiesen.'], laenge: 1.0, bilder: ['hygiene', 'hygiene-checkliste'],
    text: 'Fahrzeuge, Räume und Geräte nach Plan oder aus Anlass. Die Checkliste passt zum Fahrzeug, der Nachweis steht.' },
  { name: 'Lager', kapitel: 'Material', titel: ['Auffallen,', 'bevor es fehlt.'], laenge: 0.5, bilder: ['lager'],
    text: 'Bestand je Standort, vom Gerätehaus bis ins Fahrzeug, mit Ablaufdaten und Bestellen.' },
  { name: 'Ausbildungen', kapitel: 'Ausbildung', titel: ['Termine planen,', 'Teilnehmende einladen.'], laenge: 0.6, bilder: ['ausbildungen'],
    text: 'Ausbildungstermine und Lernmodule. Eingeladen wird per Link, Zu- und Absagen kommen von selbst an.' },
  { name: 'Lernbar', kapitel: 'Ausbildung', titel: ['Lernen', 'zwischen den Diensten.'], laenge: 0.5, bilder: ['lernbar'],
    text: 'Beiträge, Termine und Lernmodule der Organisation an einem Ort.' },
  { name: 'Unitas', kapitel: 'Team und Organisation', titel: ['Für jede', 'Einsatzkraft.'], laenge: 0.5, bilder: ['unitas'],
    text: 'Die eigenen Protokolle, Vorgänge und Termine auf einer Seite.' },
  { name: 'Chat', kapitel: 'Team und Organisation', titel: ['Im Team,', 'ohne fremde Dienste.'], laenge: 0.5, bilder: ['chat'],
    text: 'Direktnachrichten an Personen der Organisation, auf dem Gerät verschlüsselt.' },
  { name: 'Notizen', kapitel: 'Team und Organisation', titel: ['Notizen,', 'die bleiben.'], laenge: 0.5, bilder: ['notizen'],
    text: 'Persönlich oder mit der Organisation geteilt, mit Tags und Anpinnen.' },
  { name: 'Dateien', kapitel: 'Team und Organisation', titel: ['Alles Wichtige', 'abgelegt.'], laenge: 0.5, bilder: ['dateien'],
    text: 'Die gemeinsame Ablage der Organisation, vom Hygieneplan bis zum Dienstplan.' },
  { name: 'Schreibstube', kapitel: 'Team und Organisation', titel: ['Schreiben', 'im Browser.'], laenge: 0.5, bilder: ['schreibstube'],
    text: 'Dokumente, Tabellen und Präsentationen anlegen und im Office-Editor öffnen.' },
  { name: 'Benutzer und Rollen', kapitel: 'Team und Organisation', titel: ['Wer', 'was darf.'], laenge: 0.5, bilder: ['benutzer'],
    text: 'Eigene Rollen je Organisation, befristete Rechte und Zugänge für Gäste.' },
  { name: 'Benachrichtigungen', kapitel: 'Team und Organisation', titel: ['Bescheid wissen,', 'ohne Alarm.'], laenge: 0.8, bilder: ['benachrichtigungen'],
    text: 'Push auf Handy und PC, mit Ruhezeit. Push ist keine Alarmierung und ersetzt sie nicht.' },
]

export const KAPITEL: { name: KapitelName; titel: [string, string] }[] = [
  { name: 'Im Einsatz', titel: ['Im', 'Einsatz.'] },
  { name: 'Material', titel: ['', 'Material.'] },
  { name: 'Ausbildung', titel: ['', 'Ausbildung.'] },
  { name: 'Team und Organisation', titel: ['Team und', 'Organisation.'] },
]

/** Alle Bilder in der Reihenfolge ihres ersten Auftritts */
export const BILDER: string[] = MODULE.flatMap(m => m.bilder)

/** Nummer innerhalb des Kapitels (01, 02 …) */
export const NUMMER: string[] = (() => {
  const z = new Map<string, number>()
  return MODULE.map(m => { if (!m.kapitel) return ''; const n = (z.get(m.kapitel) ?? 0) + 1; z.set(m.kapitel, n); return String(n).padStart(2, '0') })
})()

export const AUFTAKT = 1.8
export const KAPITEL_LAENGE = 0.5
export const SCHLUSS = 0.9
export const NACHLAUF = 0.5

export type Teil =
  | { art: 'auftakt'; von: number; bis: number }
  | { art: 'app'; von: number; bis: number; modul: number }
  | { art: 'kapitel'; von: number; bis: number; kapitel: number }
  | { art: 'schluss'; von: number; bis: number }
  | { art: 'nachlauf'; von: number; bis: number }

/** Der ganze Ablauf, lückenlos von 0 bis GESAMT */
export const TEILE: Teil[] = (() => {
  const t: Teil[] = [{ art: 'auftakt', von: 0, bis: AUFTAKT }]
  let s = AUFTAKT
  let kap = ''
  MODULE.forEach((m, i) => {
    if (m.kapitel && m.kapitel !== kap) {
      kap = m.kapitel
      const k = KAPITEL.findIndex(x => x.name === m.kapitel)
      t.push({ art: 'kapitel', von: r(s), bis: r(s + KAPITEL_LAENGE), kapitel: k })
      s += KAPITEL_LAENGE
    }
    t.push({ art: 'app', von: r(s), bis: r(s + m.laenge), modul: i })
    s += m.laenge
  })
  t.push({ art: 'schluss', von: r(s), bis: r(s + SCHLUSS) }); s += SCHLUSS
  t.push({ art: 'nachlauf', von: r(s), bis: r(s + NACHLAUF) }); s += NACHLAUF
  return t
})()
function r(x: number) { return Math.round(x * 1000) / 1000 }

export const GESAMT = TEILE[TEILE.length - 1].bis
export const SCHLUSS_VON = TEILE.find(t => t.art === 'schluss')!.von
/** Wo die Anker #apps und #module liegen: kurz nach dem Beginn der Übersicht */
export const ANKER = AUFTAKT + 0.06

/** Teile mit Text (Apps und Kapitelmomente), in der Reihenfolge des Ablaufs */
export const TEXTTEILE: Teil[] = TEILE.filter(t => t.art === 'app' || t.art === 'kapitel')

/** Index des Teils, in dem sv liegt */
export function teilBei(sv: number): number {
  for (let i = TEILE.length - 1; i >= 0; i--) if (sv >= TEILE[i].von) return i
  return 0
}

/** Deckkraft eines Texts (Index in TEXTTEILE): alter Text geht kurz vor der Grenze, neuer kommt kurz danach */
export function textDeckkraft(j: number, sv: number): { ein: number; aus: number; deckkraft: number } {
  const t = TEXTTEILE[j]
  const ein = weich(sv, t.von - 0.04, t.von + 0.05)
  // Der letzte Text (Benachrichtigungen) geht zum Schluss, der eigene Zeiten hat; davor nach derselben Regel
  const aus = 1 - weich(sv, t.bis - 0.07, t.bis)
  return { ein, aus, deckkraft: ein * aus }
}

export interface Wechsel { bild: number; von: number; bis: number; schieben?: boolean }

/** Wann welches Bild im Handy steht. Die Übersicht liegt von Anfang an (unter Schwarz und Zeichen). Beim Wechsel
 *  blendet das neue Bild über dem alten ein; das alte bleibt deckend, bis das neue steht. Im Kapitelmoment
 *  wechselt das Bild verdeckt (das Handy ist blass) auf die erste App des Kapitels. */
export const WECHSEL: Wechsel[] = (() => {
  const w: Wechsel[] = [{ bild: 0, von: -1, bis: -1 }]
  let vorKapitel: Teil | null = null
  for (const t of TEILE) {
    if (t.art === 'kapitel') { vorKapitel = t; continue }
    if (t.art === 'app') {
      const m = MODULE[t.modul]
      const b = BILDER.indexOf(m.bilder[0])
      if (b > 0) {
        const g = vorKapitel ? vorKapitel.von + (vorKapitel.bis - vorKapitel.von) / 2 : t.von
        w.push({ bild: b, von: r(g - 0.08), bis: r(g + 0.02) })
      }
      vorKapitel = null
      if (m.bilder[1]) {
        const g2 = t.von + (t.bis - t.von) / 2
        w.push({ bild: BILDER.indexOf(m.bilder[1]), von: r(g2), bis: r(g2 + 0.12), schieben: true })
      }
    }
    if (t.art === 'schluss') {
      // Zum Schluss kehrt die Übersicht zurück (s 0,05 bis 0,25)
      w.push({ bild: 0, von: r(t.von + 0.05 * SCHLUSS), bis: r(t.von + 0.25 * SCHLUSS) })
    }
  }
  return w
})()

function wechselBei(sv: number): number {
  let w = 0
  for (let i = 0; i < WECHSEL.length; i++) if (sv >= WECHSEL[i].von) w = i
  return w
}

/** Das Bild, das gerade steht oder hereinkommt (Index in BILDER) */
export function bildIndexBei(sv: number): number { return WECHSEL[wechselBei(sv)].bild }

/** Bilder, die geladen und gezeigt sein sollen: zwei Wechsel zurück (das deckende darunter) bis vier voraus.
 *  Alle anderen dürfen aus dem Speicher (am iPhone wichtig). */
export function bildFenster(sv: number): Set<number> {
  const w = wechselBei(sv)
  const f = new Set<number>()
  for (let x = Math.max(0, w - 2); x <= Math.min(WECHSEL.length - 1, w + 4); x++) f.add(WECHSEL[x].bild)
  return f
}

/** Deckkraft aller Bilder. bereit[i]: Bild i ist geladen und dekodiert. oben: das Bild, das über den anderen liegt;
 *  schieben: Anteil, um den ein hereingeschobenes Bild schon da ist (1 = ganz). */
export function bildDeckkraft(sv: number, bereit: boolean[]): { deckkraft: number[]; oben: number; schieben: number; geschoben: boolean } {
  const d = new Array(BILDER.length).fill(0)
  const w = wechselBei(sv)
  const akt = WECHSEL[w]
  // Das zuletzt fertige Bild davor (dort bleibt man stehen, solange das neue nicht bereit ist)
  let k = w - 1
  while (k >= 0 && !bereit[WECHSEL[k].bild]) k--
  if (!bereit[akt.bild]) {
    if (k >= 0) d[WECHSEL[k].bild] = 1
    return { deckkraft: d, oben: k >= 0 ? WECHSEL[k].bild : -1, schieben: 1, geschoben: false }
  }
  const t = w === 0 ? 1 : weich(sv, akt.von, akt.bis)
  if (t >= 1 || k < 0) { d[akt.bild] = 1; return { deckkraft: d, oben: akt.bild, schieben: 1, geschoben: !!akt.schieben } }
  d[WECHSEL[k].bild] = 1
  d[akt.bild] = Math.max(d[akt.bild], t)
  // Kehrt ein Bild zurück, das auch unten liegt (z. B. dieselbe Übersicht), zählt das obere
  if (WECHSEL[k].bild === akt.bild) d[akt.bild] = 1
  return { deckkraft: d, oben: akt.bild, schieben: t, geschoben: !!akt.schieben }
}

/** Werte des Auftakts: Handy aus der Tasche, Jacke weg, Bildschirm an */
export function auftakt(sv: number) {
  const a = klemm(sv / AUFTAKT)
  const an = weich(a, 0.50, 0.64)
  return {
    held: weich(a, 0.10, 0.42),
    raus: weich(a, 0.06, 0.66),
    jacke: weich(a, 0.36, 0.90),
    jackeAus: weich(a, 0.50, 0.90),
    an,
    // Das Zeichen liegt deckend unter dem Schwarz (sonst schiene die Übersicht beim Einschalten durch)
    zeichen: 1 - weich(a, 0.78, 0.92),
    schein: an * 0.9,
    hinweis: 1 - weich(a, 0, 0.12),
    /** Am Rechner: Handy rückt nach rechts, links stehen die Texte */
    rechts: weich(sv, AUFTAKT - 0.12, AUFTAKT + 0.12),
    /** Bei weniger Bewegung blendet das Handy an seinem Platz ein */
    ruhigEin: weich(a, 0.4, 0.7),
  }
}

/** Kapitelmoment: das Handy tritt zurück (0 bis 1), der große Name steht */
export function zurueck(sv: number): number {
  const t = TEILE[teilBei(sv)]
  if (t.art !== 'kapitel') return 0
  const u = (sv - t.von) / (t.bis - t.von)
  return weich(u, 0, 0.3) * (1 - weich(u, 0.7, 1))
}

/** Werte des Schlusses (s = Anteil im Schluss) */
export function schluss(sv: number) {
  const s = (sv - SCHLUSS_VON) / SCHLUSS
  return {
    s,
    mitte: weich(s, 0, 0.3),
    handyAus: weich(s, 0.3, 0.5),
    vor: 0.2 * weich(s, 0.45, 0.52),
    zeile1: weich(s, 0.5, 0.65),
    zeile2: weich(s, 0.62, 0.77),
    knopf: weich(s, 0.78, 0.92),
    /** Bei weniger Bewegung: Satz und Knopf erst, wenn das Handy weg ist */
    ruhig: weich(s, 0.5, 0.68),
  }
}

/** Kapitelzeile (am Rechner): aktives Kapitel, Anteil darin, Sichtbarkeit */
export const KAPITEL_SPANNEN: { von: number; bis: number }[] = (() => {
  const v = TEILE.filter(t => t.art === 'kapitel').map(t => t.von)
  return v.map((von, i) => ({ von, bis: i + 1 < v.length ? v[i + 1] : SCHLUSS_VON }))
})()
export function kapitelBei(sv: number): { kapitel: number; anteil: number; sichtbar: number } {
  let k = 0
  KAPITEL_SPANNEN.forEach((s, i) => { if (sv >= s.von) k = i })
  const sp = KAPITEL_SPANNEN[k]
  const anteil = klemm((sv - sp.von) / (sp.bis - sp.von))
  const erst = KAPITEL_SPANNEN[0].von
  const sichtbar = weich(sv, erst, erst + 0.15) * (1 - weich(sv, SCHLUSS_VON - 0.15, SCHLUSS_VON))
  return { kapitel: k, anteil, sichtbar }
}

/** Lesezeilen der Grundsätze: blass unten, hell ab gut der Mitte. anteil = Lage der Zeilenmitte im Bildschirm (0 oben, 1 unten) */
export function zeileHell(anteil: number): number { return 0.2 + 0.8 * (1 - weich(anteil, 0.62, 0.92)) }

/** Grundsätze und „Für wen“ (Texte hier, damit die Prüffälle sie mit lesen) */
export const GRUNDSAETZE: { name: [string, string]; text: string }[] = [
  { name: ['In', 'Nürnberg.'], text: 'Gespeichert wird auf einem eigenen Server in Nürnberg.' },
  { name: ['Im', 'Browser.'], text: 'Ohne Installation auf Handy, Tablet und PC.' },
  { name: ['Im', 'Funkloch.'], text: 'Protokolle, Produktausgaben und Meldungen, die ohne Netz abgeschickt werden, gehen raus, sobald Netz da ist.' },
  { name: ['Patientendaten', 'nie im Push.'], text: 'Benachrichtigungen nennen nie Patientendaten.' },
  { name: ['In', 'eurer Hand.'], text: 'Jede Organisation legt Rollen, Rechte und Formulare selbst fest.' },
]
export const FUER_WEN = ['Sanitätsdienste', 'Wasser- und Bergrettung', 'Feuerwehren', 'Betriebe']
export const SCHLUSSSATZ: [string, string] = ['Für den ganzen Dienst.', 'In einer App.']
