// Rechnungen im Lager, an denen Entscheidungen im Einsatz hängen: Was ist
// noch verwendbar, was läuft bald ab, was fehlt auf dem Fahrzeug, und welche
// Packung wird zuerst entnommen. Hier gesammelt und mit Prüffällen versehen
// (src/lib/__tests__/lagerRechnung.test.ts), statt verstreut in Lager.tsx.

/** Ab so vielen Tagen vor dem MHD gilt Ware als "läuft bald ab". */
export const VORLAUF_TAGE = 30

export interface BestandsZeile {
  id?: string
  quantity?: number
  expiry_date?: string | null
  created?: string
}

function zeitpunkt(datum: string | null | undefined): number | null {
  if (!datum) return null
  // PocketBase liefert "2027-01-31 00:00:00.000Z" — ältere WebKit-Versionen lesen das nur mit "T"
  const t = new Date(datum.replace(' ', 'T')).getTime()
  return Number.isFinite(t) ? t : null
}

/**
 * Entnahme-Reihenfolge "zuerst ablaufend zuerst" (FEFO): früheste MHD zuerst,
 * Ware ohne MHD zuletzt. PocketBase sortiert leere Daten nach vorn — ohne
 * diese Reihenfolge ginge Ware ohne MHD vor der bald ablaufenden weg.
 * Bei gleichem MHD die ältere Bestandszeile zuerst.
 */
export function fefo<T extends BestandsZeile>(zeilen: T[]): T[] {
  return [...zeilen].sort((a, b) => {
    const ta = zeitpunkt(a.expiry_date)
    const tb = zeitpunkt(b.expiry_date)
    if (ta !== tb) {
      if (ta === null) return 1
      if (tb === null) return -1
      return ta - tb
    }
    return (a.created || '').localeCompare(b.created || '')
  })
}

/** Wie fefo, aber eine bevorzugte Bestandszeile (z. B. die gescannte Charge) zuerst. */
export function entnahmeReihenfolge<T extends BestandsZeile>(zeilen: T[], bevorzugtId?: string): T[] {
  const sortiert = fefo(zeilen)
  if (!bevorzugtId) return sortiert
  return [...sortiert.filter(z => z.id === bevorzugtId), ...sortiert.filter(z => z.id !== bevorzugtId)]
}

/**
 * Tage vom heutigen Kalendertag bis zum MHD (0 = heute, negativ = vorbei).
 * In Kalendertagen, nicht Stunden: Ein MHD heißt "verwendbar bis einschließlich".
 */
export function tageBisMhd(mhd: string | null | undefined, jetzt = new Date()): number | null {
  if (!mhd) return null
  // Zuerst der Datumsteil selbst — unabhängig davon, was der Datums-Parser des Geräts kann
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(mhd)
  const ziel = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : zeitpunkt(mhd)
  if (ziel === null || !Number.isFinite(ziel)) return null
  const heute = Date.UTC(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate())
  return Math.round((ziel - heute) / 86_400_000)
}

/**
 * Ablauf einer Ware: abgelaufen, läuft innerhalb des Vorlaufs ab, oder in Ordnung.
 * Nur das MHD zählt — ob genug da ist, sagt unterSoll.
 */
export function ablaufStatus(mhd: string | null | undefined, jetzt = new Date(), vorlaufTage = VORLAUF_TAGE): 'ok' | 'warn' | 'exp' {
  const tage = tageBisMhd(mhd, jetzt)
  if (tage === null) return 'ok'
  if (tage < 0) return 'exp'
  if (tage < vorlaufTage) return 'warn'
  return 'ok'
}

/** Liegt der Bestand unter dem Soll? Ohne Soll nie. Auch ein leeres Fach mit Soll. */
export function unterSoll(menge: number, soll: number | null | undefined): boolean {
  return !!soll && soll > 0 && menge < soll
}

/**
 * Fehlt der Artikel an diesem Standort? Soll ist das eigene Standort-Soll, sonst
 * das Standard-Soll. Ein LEERES Fach zählt nur, wenn der Artikel hier geführt
 * wird (eigenes Soll, hier schon gebucht, oder es gibt nur einen Standort).
 * Sonst stünde jeder Lagerartikel mit Standard-Soll auf jedem Fahrzeug als
 * fehlend — auch die, die dort nie mitfahren. Das zuletzt verbrauchte Teil auf
 * dem RTW zählt dagegen weiter: Dort wurde ja gebucht.
 */
export function fehltAmStandort(menge: number, soll: number | null | undefined, gefuehrt: boolean): boolean {
  if (menge <= 0 && !gefuehrt) return false
  return unterSoll(menge, soll)
}

/** Summe der Mengen einer Liste von Bestandszeilen. */
export function summe(zeilen: BestandsZeile[]): number {
  return zeilen.reduce((s, z) => s + (z.quantity || 0), 0)
}

/** Wurde vor oder nach den Buchungen gezählt, die seit dem Start der Inventur liefen? */
export type Zaehlzeitpunkt = 'vorher' | 'nachher'

/**
 * Was die Inventur für eine Position bucht — oder null, wenn erst gefragt werden muss.
 *
 * Seit dem Start nichts gebucht (aktuell = erwartet): eindeutig, Zählung − Bestand.
 * Sonst hängt es daran, WANN gezählt wurde, und das weiß nur, wer gezählt hat:
 *   vorher:  Die Buchungen seitdem kamen nach der Zählung — Zählung − Start.
 *   nachher: Die Zählung enthält sie schon — Zählung − aktueller Bestand.
 * Eine Annahme an dieser Stelle bucht in einem der beiden Fälle falsch, deshalb
 * fragt die App nach (null).
 */
export function inventurDifferenz(gezaehlt: number, erwartetBeimStart: number, aktuell: number, wann?: Zaehlzeitpunkt): number | null {
  if (aktuell === erwartetBeimStart) return gezaehlt - aktuell
  if (wann === 'vorher') return gezaehlt - erwartetBeimStart
  if (wann === 'nachher') return gezaehlt - aktuell
  return null
}

/** Der Bestand, gegen den gezählt wurde — wird an der Inventur-Position als Soll vermerkt. */
export function inventurBasis(erwartetBeimStart: number, aktuell: number, wann?: Zaehlzeitpunkt): number {
  return wann === 'nachher' ? aktuell : erwartetBeimStart
}

// ── Journal auswerten ────────────────────────────────────────────────────────
// Fehlbuchungen werden nicht gelöscht, sondern mit einer Gegenbuchung gleicher
// Art und umgekehrten Vorzeichens zurückgenommen („Rückgängig“). Auswertungen
// rechnen deshalb mit Vorzeichen — dann gleicht sich beides von selbst aus.

export interface JournalZeile {
  id?: string
  item_id: string
  type: string
  quantity: number
  note?: string
  stock_id?: string | null
  batch?: string | null
  created?: string
}

/** Umlagerungen sind kein Verbrauch und kein Zugang — auch nicht ihre Rücknahme. */
export function istUmlagerung(note?: string | null): boolean {
  return /^(Rückgängig · )?Umlagerung/.test(note || '')
}

/** Ist das die Gegenbuchung zu einer Fehlbuchung? */
export function istRuecknahme(t: JournalZeile): boolean {
  return (t.note || '').startsWith('Rückgängig')
}

export interface Summen {
  ein: number
  aus: number
  ausJeArtikel: Record<string, number>
  jeMonat: Record<string, { ein: number; aus: number }>
}

/** Eingebucht und verbraucht, Gegenbuchungen verrechnet, Umlagerungen ausgenommen. */
export function journalSummen(zeilen: JournalZeile[]): Summen {
  const s: Summen = { ein: 0, aus: 0, ausJeArtikel: {}, jeMonat: {} }
  for (const t of zeilen) {
    if (istUmlagerung(t.note)) continue
    const q = t.quantity || 0
    const m = (t.created || '').slice(0, 7)
    const monat = s.jeMonat[m] ?? (s.jeMonat[m] = { ein: 0, aus: 0 })
    if (t.type === 'ausbuchung') {
      // Ausbuchung ist negativ; ihre Rücknahme positiv und zieht den Verbrauch wieder ab
      s.aus -= q; monat.aus -= q
      s.ausJeArtikel[t.item_id] = (s.ausJeArtikel[t.item_id] || 0) - q
    } else if (t.type === 'einbuchung') {
      s.ein += q; monat.ein += q
    }
  }
  return s
}

/**
 * Ausbuchungen, die nicht zurückgenommen wurden — für die Rückruf-Suche:
 * Wohin ist die Charge WIRKLICH gegangen? Jede Gegenbuchung hebt die
 * ursprüngliche Zeile derselben Bestandszeile und Menge auf.
 */
export function wirklichAusgegeben<T extends JournalZeile>(zeilen: T[]): T[] {
  const nachZeit = [...zeilen].sort((a, b) => (a.created || '').localeCompare(b.created || ''))
  const offen: T[] = []
  for (const t of nachZeit) {
    if (t.type !== 'ausbuchung') continue
    if (t.quantity < 0) { offen.push(t); continue }
    // Die Gegenbuchung gehört zur jüngsten passenden Ausgabe, am liebsten zur gleichlautenden
    const passt = (o: T) => (o.stock_id || '') === (t.stock_id || '') && (o.batch || '') === (t.batch || '') && o.quantity === -t.quantity
    const original = (t.note || '').replace(/^Rückgängig( · )?/, '')
    let i = -1
    for (let k = offen.length - 1; k >= 0; k--) {
      if (!passt(offen[k])) continue
      if ((offen[k].note || '') === original) { i = k; break }
      if (i < 0) i = k
    }
    if (i >= 0) offen.splice(i, 1)
  }
  return zeilen.filter(t => offen.includes(t))
}
