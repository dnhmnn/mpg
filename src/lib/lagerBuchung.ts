// Der eine Buchungsweg des Lagers.
//
// Vorher las jede Buchung den Bestand, rechnete im Gerät und schrieb die neue
// Zahl absolut zurück; Bestand und Journal waren getrennte Anfragen. Zwei
// schnelle Tipps oder zwei Geräte überschrieben sich, und ein Abbruch zwischen
// den Anfragen ließ Bestand und Journal auseinanderlaufen.
//
// Jetzt:
// - Bestand wird nur noch relativ geändert ("quantity-" / "quantity+"); der
//   Server rechnet, nicht das Gerät.
// - Bestand und Journal gehen als EINE Sammelbuchung (PocketBase-Batch) raus:
//   alles oder nichts.
// - Die erste Journalzeile trägt eine im Gerät vergebene ID (Client-ID). Wird
//   nach einem Abbruch erneut gesendet, lehnt der Server die doppelte ID ab —
//   die Buchung kommt genau einmal an. Dasselbe Muster wie bei EKS.
// - Buchungen eines Geräts laufen nacheinander, nie gleichzeitig.
//
// Die Planung ist reine Rechnung (planeBuchung, planeRueckgaengig) und hat
// Prüffälle in src/lib/__tests__/lagerBuchung.test.ts.

import { NOTIZ, entnahmeReihenfolge, summe } from './lagerRechnung'
import { newId } from './eks/ids'
import { pbFehlerText } from './pbFehler'

/** 15 Zeichen [a-z0-9] — als PocketBase-ID verwendbar. */
export const neueBuchungsId = newId

export interface Bestandszeile {
  id: string
  item_id: string
  location_id: string
  quantity: number
  expiry_date?: string | null
  batch?: string | null
  created?: string
}

export interface Wer {
  organization_id: string
  user: string
  /** Wer die Buchung schreibt (angemeldetes Konto) — Feld user_id, wenn es in PocketBase existiert */
  user_id?: string
  /** Wann die Buchung erfasst wurde, wenn das nicht jetzt war (offline vorgemerkt), ISO-Zeit */
  erfasst_am?: string
}

interface Gemeinsam {
  item_id: string
  location_id: string
  menge: number
  /** Vorangestellt vor „Charge …“ und „Einsatz …“ in der Bemerkung. */
  notiz?: string
  einsatz?: string
}

export interface Zugang extends Gemeinsam {
  art: 'zugang'
  typ?: 'einbuchung' | 'korrektur'
  expiry?: string | null
  batch?: string | null
}

export interface Abgang extends Gemeinsam {
  art: 'abgang'
  typ?: 'ausbuchung' | 'korrektur'
  /** Diese Bestandszeile zuerst (gewählte Charge), danach zuerst ablaufend zuerst. */
  bevorzugt?: string
  /** Gescannte Charge (GS1): die Zeile mit dieser Chargen-Nr. zuerst — bei mehreren die mit passendem MHD. */
  charge?: { batch: string; mhd?: string | null }
  /** Nur aus dieser Bestandszeile (Rückruf einer Charge). */
  nurZeile?: string
  /** Mit nurZeile: die ganze Zeile, egal wie viel gerade darin ist. */
  ganzeZeile?: boolean
  /** Eine Journalzeile für die ganze Menge statt einer je Charge (Inventur-Korrektur). */
  sammel?: boolean
}

/** Ware wandert mit Charge und MHD von einem Standort zum anderen. */
export interface Umlagerung {
  art: 'umlagerung'
  item_id: string
  von: string
  nach: string
  menge: number
  vonName: string
  nachName: string
}

export type Bewegung = Zugang | Abgang | Umlagerung

export interface Anfrage {
  collection: string
  aktion: 'create' | 'update'
  id: string
  body: Record<string, unknown>
}

/** Eine Journalzeile, wie sie gebucht wird — Grundlage für „Rückgängig“. */
export interface Posten {
  tx_id: string
  item_id: string
  location_id: string
  typ: string
  /** Mit Vorzeichen: Zugang +, Abgang −. */
  menge: number
  /** Betroffene Bestandszeile. Fehlt bei Abgang ohne Bestand und bei Sammelzeilen. */
  stock_id?: string
  batch?: string | null
  expiry_date?: string | null
  notiz: string
  einsatz?: string
}

export interface Plan {
  anfragen: Anfrage[]
  posten: Posten[]
  /** Menge, für die kein Bestand da war (nur bei ueberzug: 'protokollieren'). */
  ohneBestand: number
  /** Sammelzeilen lassen sich nicht zeilengenau zurücknehmen. */
  rueckgaengigMoeglich: boolean
}

export interface Ergebnis {
  client_id: string
  posten: Posten[]
  ohneBestand: number
  rueckgaengigMoeglich: boolean
  /** Die Buchung lag schon auf dem Server (Wiederholung nach Abbruch). */
  schonGebucht?: boolean
}

export type FehlerArt = 'netz' | 'bestand' | 'abgelehnt'

/** Was zu tun ist, wenn eine Buchung ohne Sammelbuchung mittendrin abbrach. */
export const TEXT_TEILWEISE = 'Verbindung während der Buchung abgebrochen — der Bestand kann schon geändert sein, ohne dass es im Journal steht. Bitte NICHT erneut buchen, sondern den Bestand zählen und notfalls per Inventur korrigieren.'

export class BuchungsFehler extends Error {
  art: FehlerArt
  /** Nur bei 'netz': Die Anfrage war schon unterwegs — vielleicht ist sie angekommen. */
  vielleichtGebucht: boolean
  /**
   * Nur bei 'netz' ohne Sammelbuchung (Batch in PocketBase aus): Die Einzelanfragen
   * brachen mittendrin ab — die Buchung kann TEILWEISE angekommen sein. Dann darf
   * sie nicht automatisch wiederholt werden; ein Mensch muss im Logbuch nachsehen.
   */
  teilweise: boolean
  ursache?: unknown
  constructor(text: string, art: FehlerArt, vielleichtGebucht = false, ursache?: unknown, teilweise = false) {
    super(text)
    this.name = 'BuchungsFehler'
    this.art = art
    this.vielleichtGebucht = vielleichtGebucht
    this.teilweise = teilweise
    this.ursache = ursache
  }
}

function bemerkung(...teile: (string | null | undefined | false)[]): string {
  return teile.filter(Boolean).join(' · ')
}

function pruefeMenge(menge: number) {
  if (!Number.isFinite(menge) || menge <= 0) throw new BuchungsFehler('Die Menge muss größer als 0 sein.', 'abgelehnt')
}

interface PlanOptionen {
  /** 'ablehnen' (Standard): mehr als vorhanden wird nicht gebucht. 'protokollieren': der Rest wird ohne Charge im Journal festgehalten (offline erfasste Entnahme, Produktausgabe). */
  ueberzug?: 'ablehnen' | 'protokollieren'
  neueId?: () => string
}

/**
 * Plant eine Buchung gegen den übergebenen Bestand. Reine Rechnung, schreibt nichts.
 * Reihenfolge der Anfragen: Bestand, Journal, und die Journalzeile mit der
 * Client-ID ganz zuletzt — ist sie auf dem Server, ist alles da.
 */
export function planeBuchung(
  bewegungen: Bewegung[], bestand: Bestandszeile[], wer: Wer, clientId: string,
  opts: PlanOptionen & { zusatz?: Anfrage[] } = {},
): Plan {
  const neueId = opts.neueId ?? newId
  const ueberzug = opts.ueberzug ?? 'ablehnen'
  if (!bewegungen.length) throw new BuchungsFehler('Nichts zu buchen.', 'abgelehnt')
  // Arbeitskopie, fortgeschrieben beim Planen: Betrifft eine Buchung denselben
  // Artikel mehrfach (Produktausgabe), geht nichts doppelt weg.
  const zeilen = bestand.map(z => ({ ...z }))
  const bestandsAnfragen: Anfrage[] = []
  const journal: Anfrage[] = []
  const posten: Posten[] = []
  let ohneBestand = 0
  let rueckgaengigMoeglich = true

  const journalZeile = (p: Omit<Posten, 'tx_id'>, einsatz?: string) => {
    const tx_id = journal.length === 0 ? clientId : neueId()
    journal.push({
      collection: 'inventory_transactions', aktion: 'create', id: tx_id,
      body: {
        id: tx_id, item_id: p.item_id, location_id: p.location_id, type: p.typ, quantity: p.menge,
        batch: p.batch || null, expiry_date: p.expiry_date || null, stock_id: p.stock_id || null,
        einsatz: (einsatz || '').trim() || null, note: p.notiz,
        // Alle Zeilen einer Buchung tragen dieselbe Vorgangs-Nummer — so fasst das Logbuch
        // sie exakt zusammen. Gibt es das Feld in PocketBase nicht, wird es ignoriert.
        vorgang: clientId,
        user: wer.user, organization_id: wer.organization_id,
        // Offline erfasst: der echte Zeitpunkt der Entnahme (created ist der der Übertragung)
        ...(wer.erfasst_am ? { erfasst_am: wer.erfasst_am } : {}),
        ...(wer.user_id ? { user_id: wer.user_id } : {}),
      },
    })
    posten.push({ tx_id, ...p, ...((einsatz || '').trim() ? { einsatz: (einsatz || '').trim() } : {}) })
  }

  const neueZeile = (item_id: string, location_id: string, menge: number, batch: string | null, expiry: string | null) => {
    const id = neueId()
    bestandsAnfragen.push({
      collection: 'inventory_stock', aktion: 'create', id,
      body: { id, item_id, location_id, quantity: menge, expiry_date: expiry, batch, organization_id: wer.organization_id },
    })
    zeilen.push({ id, item_id, location_id, quantity: menge, expiry_date: expiry, batch })
    return id
  }

  /** Bestandszeile zu einer gescannten Charge: gleiche Chargen-Nr., bei mehreren die mit gleichem MHD. */
  const zeileZurCharge = (item_id: string, location_id: string, c: { batch: string; mhd?: string | null }) => {
    const lot = c.batch.trim().toLowerCase()
    const passend = zeilen.filter(z => z.item_id === item_id && z.location_id === location_id && z.quantity > 0 && (z.batch || '').trim().toLowerCase() === lot)
    const mhd = (c.mhd || '').slice(0, 10)
    return (passend.find(z => mhd && (z.expiry_date || '').slice(0, 10) === mhd) ?? passend[0])?.id
  }

  /** Nimmt `menge` aus den Zeilen eines Artikels an einem Standort. */
  const entnimm = (item_id: string, location_id: string, menge: number, bevorzugt?: string, nurZeile?: string) => {
    const eigene = zeilen.filter(z => z.item_id === item_id && z.location_id === location_id && z.quantity > 0 && (!nurZeile || z.id === nurZeile))
    const verfuegbar = summe(eigene)
    if (menge > verfuegbar && ueberzug === 'ablehnen') {
      throw new BuchungsFehler(
        verfuegbar === 0 ? 'Kein Bestand mehr vorhanden.' : `Nicht genügend Bestand: vorhanden ${verfuegbar}, gebucht werden sollten ${menge}.`,
        'bestand')
    }
    let rest = menge
    const teile: { zeile: Bestandszeile; take: number }[] = []
    for (const z of entnahmeReihenfolge(eigene, bevorzugt)) {
      if (rest <= 0) break
      const take = Math.min(z.quantity, rest)
      z.quantity -= take
      rest -= take
      teile.push({ zeile: z, take })
      bestandsAnfragen.push({ collection: 'inventory_stock', aktion: 'update', id: z.id, body: { 'quantity-': take } })
    }
    return { teile, rest }
  }

  for (const b of bewegungen) {
    if (b.art === 'zugang') {
      pruefeMenge(b.menge)
      const batch = (b.batch || '').trim() || null
      const expiry = b.expiry || null
      const stock_id = neueZeile(b.item_id, b.location_id, b.menge, batch, expiry)
      journalZeile({
        item_id: b.item_id, location_id: b.location_id, typ: b.typ ?? 'einbuchung', menge: b.menge,
        stock_id, batch, expiry_date: expiry,
        notiz: bemerkung(b.notiz, batch && !(b.notiz || '').includes(`Charge ${batch}`) && `Charge ${batch}`, b.einsatz && `Einsatz ${b.einsatz.trim()}`),
      }, b.einsatz)
    } else if (b.art === 'abgang') {
      let menge = b.menge
      if (b.ganzeZeile && b.nurZeile) {
        menge = zeilen.find(z => z.id === b.nurZeile)?.quantity ?? 0
        if (menge <= 0) throw new BuchungsFehler('Diese Bestandszeile ist schon leer.', 'bestand')
      }
      pruefeMenge(menge)
      const typ = b.typ ?? 'ausbuchung'
      const bevorzugt = b.bevorzugt ?? (b.charge ? zeileZurCharge(b.item_id, b.location_id, b.charge) : undefined)
      const { teile, rest } = entnimm(b.item_id, b.location_id, menge, bevorzugt, b.nurZeile)
      if (b.sammel) {
        rueckgaengigMoeglich = false
        const gewaehlt = bevorzugt ? teile.find(t => t.zeile.id === bevorzugt) : undefined
        let zusatz: string | null = null
        if (gewaehlt) {
          const charge = gewaehlt.zeile.batch || 'ohne Charge'
          zusatz = gewaehlt.take === menge ? `Charge ${charge}` : `${gewaehlt.take} aus Charge ${charge}, Rest aus weiteren`
        }
        const eine = teile.length === 1 && rest === 0 ? teile[0].zeile : undefined
        journalZeile({
          item_id: b.item_id, location_id: b.location_id, typ, menge: -menge,
          stock_id: eine?.id, batch: eine?.batch ?? null, expiry_date: eine?.expiry_date ?? null,
          notiz: bemerkung(b.notiz, zusatz, b.einsatz && `Einsatz ${b.einsatz.trim()}`),
        }, b.einsatz)
      } else {
        for (const { zeile, take } of teile) {
          journalZeile({
            item_id: b.item_id, location_id: b.location_id, typ, menge: -take,
            stock_id: zeile.id, batch: zeile.batch ?? null, expiry_date: zeile.expiry_date ?? null,
            notiz: bemerkung(b.notiz, zeile.batch && `Charge ${zeile.batch}`, b.einsatz && `Einsatz ${b.einsatz.trim()}`),
          }, b.einsatz)
        }
        if (rest > 0) {
          // Physisch entnommen, aber im System nicht (mehr) vorhanden — ehrlich festhalten
          journalZeile({
            item_id: b.item_id, location_id: b.location_id, typ, menge: -rest,
            notiz: bemerkung(b.notiz, NOTIZ.ohneCharge, b.einsatz && `Einsatz ${b.einsatz.trim()}`),
          }, b.einsatz)
        }
      }
      ohneBestand += rest
    } else {
      pruefeMenge(b.menge)
      if (b.von === b.nach) throw new BuchungsFehler('Quelle und Ziel sind derselbe Standort.', 'abgelehnt')
      // Umlagerung nie ins Minus: Ware, die es nicht gibt, kann nicht wandern
      const verfuegbar = summe(zeilen.filter(z => z.item_id === b.item_id && z.location_id === b.von && z.quantity > 0))
      if (b.menge > verfuegbar) {
        throw new BuchungsFehler(`Nicht genügend Bestand am Standort: vorhanden ${verfuegbar}, umlagern wolltest du ${b.menge}.`, 'bestand')
      }
      const { teile } = entnimm(b.item_id, b.von, b.menge)
      for (const { zeile, take } of teile) {
        const batch = zeile.batch || null
        const expiry = zeile.expiry_date || null
        journalZeile({
          item_id: b.item_id, location_id: b.von, typ: 'ausbuchung', menge: -take,
          stock_id: zeile.id, batch, expiry_date: expiry,
          notiz: bemerkung(`${NOTIZ.umlagerungNach} ${b.nachName}`, batch && `Charge ${batch}`),
        })
        const ziel = neueZeile(b.item_id, b.nach, take, batch, expiry)
        journalZeile({
          item_id: b.item_id, location_id: b.nach, typ: 'einbuchung', menge: take,
          stock_id: ziel, batch, expiry_date: expiry,
          notiz: bemerkung(`${NOTIZ.umlagerungVon} ${b.vonName}`, batch && `Charge ${batch}`),
        })
      }
    }
  }

  const [basis, ...uebrige] = journal
  return {
    anfragen: [...bestandsAnfragen, ...uebrige, ...(opts.zusatz ?? []), basis],
    posten, ohneBestand, rueckgaengigMoeglich,
  }
}

/**
 * Plant die Gegenbuchung zu einer Buchung: Was entnommen wurde, kommt in
 * dieselbe Bestandszeile zurück (oder wird mit derselben ID neu angelegt);
 * was eingebucht wurde, geht aus der angelegten Zeile wieder heraus. Das
 * Journal bekommt Gegenzeilen gleicher Art mit umgekehrtem Vorzeichen — so
 * gleicht sich die Statistik aus, und nichts wird gelöscht.
 */
export function planeRueckgaengig(
  e: Ergebnis, bestand: Bestandszeile[], wer: Wer, clientId: string, opts: { neueId?: () => string } = {},
): Plan {
  const neueId = opts.neueId ?? newId
  if (!e.rueckgaengigMoeglich) throw new BuchungsFehler('Diese Buchung lässt sich nicht zurücknehmen.', 'abgelehnt')
  const zeilen = new Map(bestand.map(z => [z.id, { ...z }]))
  const bestandsAnfragen: Anfrage[] = []
  const journal: Anfrage[] = []
  const posten: Posten[] = []
  // Rückwärts, damit z. B. bei einer Umlagerung erst das Ziel geleert, dann die Quelle aufgefüllt wird
  for (const p of [...e.posten].reverse()) {
    if (p.stock_id && p.menge > 0) {
      const z = zeilen.get(p.stock_id)
      if (!z || z.quantity < p.menge) {
        throw new BuchungsFehler('Von dieser Ware wurde inzwischen schon entnommen — Rückgängig ist nicht mehr möglich. Bitte normal ausbuchen.', 'bestand')
      }
      z.quantity -= p.menge
      bestandsAnfragen.push({ collection: 'inventory_stock', aktion: 'update', id: z.id, body: { 'quantity-': p.menge } })
    } else if (p.stock_id && p.menge < 0) {
      const z = zeilen.get(p.stock_id)
      if (z) {
        z.quantity += -p.menge
        bestandsAnfragen.push({ collection: 'inventory_stock', aktion: 'update', id: z.id, body: { 'quantity+': -p.menge } })
      } else {
        // Zeile war leer und wurde entfernt — mit derselben ID wieder anlegen, damit das Journal stimmt
        const neu = { id: p.stock_id, item_id: p.item_id, location_id: p.location_id, quantity: -p.menge, expiry_date: p.expiry_date || null, batch: p.batch || null }
        zeilen.set(neu.id, neu)
        bestandsAnfragen.push({ collection: 'inventory_stock', aktion: 'create', id: neu.id, body: { ...neu, organization_id: wer.organization_id } })
      }
    }
    // Abgang ohne Bestand: nur die Gegenzeile im Journal
    const tx_id = journal.length === 0 ? clientId : neueId()
    const notiz = bemerkung(NOTIZ.rueckgaengig, p.notiz)
    journal.push({
      collection: 'inventory_transactions', aktion: 'create', id: tx_id,
      body: {
        id: tx_id, item_id: p.item_id, location_id: p.location_id, type: p.typ, quantity: -p.menge,
        batch: p.batch || null, expiry_date: p.expiry_date || null, stock_id: p.stock_id || null,
        einsatz: p.einsatz || null, note: notiz, storno_von: p.tx_id, vorgang: clientId,
        user: wer.user, organization_id: wer.organization_id,
        ...(wer.user_id ? { user_id: wer.user_id } : {}),
      },
    })
    posten.push({ ...p, tx_id, menge: -p.menge, notiz })
  }
  const [basis, ...uebrige] = journal
  return { anfragen: [...bestandsAnfragen, ...uebrige, basis], posten, ohneBestand: 0, rueckgaengigMoeglich: false }
}

// ── Ausführen ────────────────────────────────────────────────────────────────

/** Was der Buchungsweg vom Server braucht. In der App PocketBase (pbServer), in den Prüffällen ein Nachbau. */
export interface Server {
  ladeBestand(paare: { item_id: string; location_id: string }[]): Promise<Bestandszeile[]>
  /** true, wenn es den Datensatz gibt; false bei 404. */
  gibtEs(collection: string, id: string): Promise<boolean>
  /** Alles oder nichts. Antwort je Anfrage der Datensatz danach. */
  sendeBatch(anfragen: Anfrage[]): Promise<unknown[]>
  sende(anfrage: Anfrage): Promise<unknown>
  loesche(collection: string, id: string): Promise<void>
}

interface PbFehlerRoh {
  status?: number
  message?: string
  response?: { message?: string; data?: Record<string, any> }
}

/** Bei einer abgelehnten Sammelbuchung steckt der eigentliche Grund in der Teilanfrage. */
export function innererFehler(e: unknown): PbFehlerRoh {
  const f = (e ?? {}) as PbFehlerRoh
  const teil = f.response?.data?.requests
  if (teil && typeof teil === 'object') {
    const erster = Object.values(teil as Record<string, any>).find(t => t?.response)
    if (erster?.response) return { status: erster.response.status, message: erster.response.message, response: erster.response }
  }
  return f
}

const istNetz = (e: unknown) => ((e ?? {}) as PbFehlerRoh).status === 0
const istBatchAus = (e: unknown) => {
  const f = (e ?? {}) as PbFehlerRoh
  return f.status === 403 && /batch/i.test(f.response?.message || f.message || '')
}
/** Bestand reicht nicht mehr (anderes Gerät hat gerade entnommen) — Feld quantity mit min 0. */
const istBestandZuKlein = (e: unknown) => innererFehler(e).response?.data?.quantity?.code === 'validation_min_number_constraint'
/** Doppelte ID — liegt die Buchung schon auf dem Server? (wird danach per gibtEs bestätigt) */
const istDoppelt = (e: unknown) => innererFehler(e).response?.data?.id?.code === 'validation_not_unique'

const FELDNAMEN = { quantity: 'Menge', type: 'Buchungsart', item_id: 'Artikel', location_id: 'Standort', expiry_date: 'MHD', batch: 'Charge' }

const MAX_BATCH = 50   // PocketBase-Standard für Anfragen je Sammelbuchung
let batchAus = false

/** Für die Prüffälle: Zustand zwischen zwei Fällen zurücksetzen. */
export function _zuruecksetzen() { batchAus = false; kette = Promise.resolve() }

/**
 * Ohne Batch (in PocketBase ausgeschaltet oder zu groß): einzeln, Client-ID-Zeile
 * zuletzt. Lehnt der Server mittendrin ab, wird Bestand Schritt für Schritt
 * zurückgenommen. Bricht das Netz mittendrin ab, ist der Stand unklar.
 */
async function sendeEinzeln(server: Server, anfragen: Anfrage[]): Promise<unknown[]> {
  const erledigt: { a: Anfrage; antwort: unknown }[] = []
  try {
    for (const a of anfragen) erledigt.push({ a, antwort: await server.sende(a) })
    return erledigt.map(x => x.antwort)
  } catch (e) {
    // Netz weg: Was davon angekommen ist, weiß niemand — auch die gerade laufende Anfrage
    // kann der Server ausgeführt haben. Nicht zurückdrehen (das ginge ebenso ins Ungewisse),
    // sondern als „teilweise“ melden: Diese Buchung darf nicht automatisch wiederholt werden.
    if (istNetz(e)) throw Object.assign(new Error('teilweise übertragen'), { status: 0, teilweise: true, ursache: e })
    let zurueck = true
    for (const { a } of erledigt.reverse()) {
      try {
        if (a.collection === 'inventory_stock' && a.aktion === 'update') {
          const [feld, n] = Object.entries(a.body)[0]
          await server.sende({ ...a, body: { [feld === 'quantity-' ? 'quantity+' : 'quantity-']: n } })
        } else if (a.aktion === 'create') {
          await server.loesche(a.collection, a.id)
        }
      } catch { zurueck = false }
    }
    // Ließ sich nicht alles zurückdrehen, ist die Buchung teilweise angekommen
    if (!zurueck) throw Object.assign(new Error('teilweise übertragen'), { status: 0, teilweise: true, ursache: e })
    throw e
  }
}

async function sendePlan(server: Server, plan: Plan): Promise<void> {
  let antworten: unknown[]
  if (!batchAus && plan.anfragen.length <= MAX_BATCH) {
    try {
      antworten = await server.sendeBatch(plan.anfragen)
    } catch (e) {
      if (!istBatchAus(e)) throw e
      batchAus = true
      antworten = await sendeEinzeln(server, plan.anfragen)
    }
  } else {
    antworten = await sendeEinzeln(server, plan.anfragen)
  }
  // Leere Bestandszeilen entfernen — nur die, die der Server nach dem Abzug mit 0 meldet.
  // Schlägt das fehl, bleibt eine Zeile mit 0 stehen; die Anzeige ignoriert sie.
  for (let i = 0; i < plan.anfragen.length; i++) {
    const a = plan.anfragen[i]
    const nachher = antworten[i] as { quantity?: number } | null
    if (a.collection === 'inventory_stock' && a.aktion === 'update' && 'quantity-' in a.body && nachher && (nachher.quantity ?? 1) <= 0) {
      try { await server.loesche('inventory_stock', a.id) } catch { /* bleibt als 0 stehen */ }
    }
  }
}

// Alle Buchungen dieses Geräts nacheinander — jede plant gegen den Stand nach der vorigen
let kette: Promise<unknown> = Promise.resolve()
function nacheinander<T>(f: () => Promise<T>): Promise<T> {
  const p = kette.then(f, f)
  kette = p.catch(() => undefined)
  return p
}

function paareVon(bewegungen: Bewegung[]): { item_id: string; location_id: string }[] {
  const s = new Map<string, { item_id: string; location_id: string }>()
  for (const b of bewegungen) {
    if (b.art === 'zugang') continue
    const loc = b.art === 'umlagerung' ? b.von : b.location_id
    s.set(`${b.item_id}|${loc}`, { item_id: b.item_id, location_id: loc })
  }
  return [...s.values()]
}

async function fuehreAus(
  server: Server, clientId: string, pruefeVorher: boolean,
  paare: { item_id: string; location_id: string }[],
  plane: (bestand: Bestandszeile[]) => Plan,
): Promise<Ergebnis> {
  let gesendet = false
  try {
    // Nach unklarem Ausgang: erst nachsehen, ob die Buchung schon angekommen ist
    if (pruefeVorher && await server.gibtEs('inventory_transactions', clientId)) {
      return { client_id: clientId, posten: [], ohneBestand: 0, rueckgaengigMoeglich: false, schonGebucht: true }
    }
    for (let versuch = 0; ; versuch++) {
      const bestand = paare.length ? await server.ladeBestand(paare) : []
      const plan = plane(bestand)
      try {
        gesendet = true
        await sendePlan(server, plan)
        return { client_id: clientId, posten: plan.posten, ohneBestand: plan.ohneBestand, rueckgaengigMoeglich: plan.rueckgaengigMoeglich }
      } catch (e) {
        if (istDoppelt(e) && await server.gibtEs('inventory_transactions', clientId).catch(() => false)) {
          return { client_id: clientId, posten: [], ohneBestand: 0, rueckgaengigMoeglich: false, schonGebucht: true }
        }
        // Ein anderes Gerät hat gerade entnommen: neu planen, höchstens zweimal
        if (istBestandZuKlein(e) && versuch < 2) { gesendet = false; continue }
        throw e
      }
    }
  } catch (e) {
    if (e instanceof BuchungsFehler) throw e
    if (istNetz(e)) {
      if ((e as { teilweise?: boolean }).teilweise) {
        throw new BuchungsFehler(TEXT_TEILWEISE, 'netz', true, e, true)
      }
      throw new BuchungsFehler(
        gesendet ? 'Keine Antwort vom Server — ob gebucht wurde, ist unklar.' : 'Keine Verbindung zum Server.',
        'netz', gesendet, e)
    }
    if (istBestandZuKlein(e)) throw new BuchungsFehler('Der Bestand hat sich gerade geändert und reicht nicht mehr. Bitte neu laden.', 'bestand', false, e)
    throw new BuchungsFehler(pbFehlerText(innererFehler(e), FELDNAMEN), 'abgelehnt', false, e)
  }
}

export interface BuchOptionen {
  wer: Wer
  /** Vorher vergeben, wenn die Buchung bei Abbruch in die Warteschlange soll. */
  clientId?: string
  ueberzug?: 'ablehnen' | 'protokollieren'
  /** Nach unklarem Ausgang: zuerst prüfen, ob die Buchung schon angekommen ist. */
  pruefeVorher?: boolean
  /** Weitere Änderungen, die mit der Buchung stehen oder fallen (z. B. Status der Produktausgabe). */
  zusatz?: Anfrage[]
}

/** Bucht Bewegungen genau einmal: alles oder nichts, nacheinander mit anderen Buchungen dieses Geräts. */
export function buche(server: Server, bewegungen: Bewegung[], o: BuchOptionen): Promise<Ergebnis> {
  if (!o.wer.organization_id || !o.wer.user) {
    return Promise.reject(new BuchungsFehler('Nicht angemeldet — es wurde nichts gebucht.', 'abgelehnt'))
  }
  const clientId = o.clientId ?? newId()
  return nacheinander(() => fuehreAus(server, clientId, !!o.pruefeVorher, paareVon(bewegungen),
    bestand => planeBuchung(bewegungen, bestand, o.wer, clientId, { ueberzug: o.ueberzug, zusatz: o.zusatz })))
}

/** Nimmt eine Buchung als Gegenbuchung zurück. clientId wiederverwenden, falls der erste Versuch unklar endete. */
export function macheRueckgaengig(server: Server, e: Ergebnis, wer: Wer, clientId = newId(), pruefeVorher = false): Promise<Ergebnis> {
  if (!wer.organization_id || !wer.user) {
    return Promise.reject(new BuchungsFehler('Nicht angemeldet — es wurde nichts zurückgenommen.', 'abgelehnt'))
  }
  const paare = new Map(e.posten.map(p => [`${p.item_id}|${p.location_id}`, { item_id: p.item_id, location_id: p.location_id }]))
  return nacheinander(() => fuehreAus(server, clientId, pruefeVorher, [...paare.values()],
    bestand => planeRueckgaengig(e, bestand, wer, clientId)))
}

// ── PocketBase ───────────────────────────────────────────────────────────────

interface PbLike {
  filter(raw: string, params?: Record<string, unknown>): string
  collection(name: string): any
  createBatch(): any
}

/** Lieber nach 15 s abbrechen und in die Warteschlange, als im Funkloch ewig zu warten. */
const WARTEZEIT_MS = 15_000

function zeitlimit(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal === 'undefined') return undefined
  if ('timeout' in AbortSignal) return (AbortSignal as any).timeout(ms)
  const c = new AbortController()
  setTimeout(() => c.abort(), ms)
  return c.signal
}

export function pbServer(pb: PbLike, wartezeitMs = WARTEZEIT_MS): Server {
  // requestKey: null — sonst bricht das SDK gleichartige Anfragen gegenseitig ab
  const opt = () => ({ requestKey: null, signal: zeitlimit(wartezeitMs) })
  return {
    async ladeBestand(paare) {
      const filter = paare.map(p => pb.filter('(item_id = {:i} && location_id = {:l})', { i: p.item_id, l: p.location_id })).join(' || ')
      return pb.collection('inventory_stock').getFullList({ filter, ...opt() })
    },
    async gibtEs(collection, id) {
      try {
        await pb.collection(collection).getOne(id, { fields: 'id', ...opt() })
        return true
      } catch (e) {
        if ((e as PbFehlerRoh)?.status === 404) return false
        throw e
      }
    },
    async sendeBatch(anfragen) {
      const b = pb.createBatch()
      for (const a of anfragen) {
        if (a.aktion === 'create') b.collection(a.collection).create(a.body)
        else b.collection(a.collection).update(a.id, a.body)
      }
      const res: { status: number; body: unknown }[] = await b.send(opt())
      return res.map(r => r.body)
    },
    async sende(a) {
      return a.aktion === 'create'
        ? pb.collection(a.collection).create(a.body, opt())
        : pb.collection(a.collection).update(a.id, a.body, opt())
    },
    async loesche(collection, id) {
      await pb.collection(collection).delete(id, opt())
    },
  }
}
