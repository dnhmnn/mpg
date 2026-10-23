// Was eine Aktion im MPG schreibt — reine Planung, ohne Server.
// Ausgeführt wird mit schreibeZusammen (alles oder nichts, genau einmal).
//
// Reihenfolge — wichtig, wenn der Batch in PocketBase aus ist und einzeln geschrieben wird
// und die Verbindung mittendrin abreißt. Jeder Teilstand muss auf der sicheren Seite liegen:
// - Was ein Gerät sperrt, kommt zuerst.
// - Der Datensatz, an dem man „angekommen“ erkennt (der Anker), danach: „Anker vorhanden“
//   heißt, alles davor ist auch angekommen.
// - Was ein Gerät „gut aussehen“ lässt (geprüft, bestanden, nächste Frist), kommt zuletzt.
// Vor dem erneuten Senden eines unklaren Versuchs wird nach dem Anker gefragt; ist er da,
// wird nur noch der Rest danach gesendet (restNachAnker).
//
// Gerätebuch (mpg_ereignisse): wird nur angefügt, nie geändert (Hook pb_hooks/mpg.pb.js).
// Darin steht, wer wann gesperrt, freigegeben, Stammdaten geändert, außer Betrieb genommen
// oder einen Vermerk geschrieben hat. Prüfungen und Defekte bleiben in ihren eigenen
// Collections. Fehlt die Collection in PocketBase noch (buch: false), schreiben die Pläne
// ohne Gerätebuch — nichts scheitert daran.
//
// Prüffälle: src/lib/mpg/selbsttest.ts

import { faelligFeld, INTERVALL_TEXT, intervallVon, kalendertag, monateVon, mtkAbweichend, mtkJahre, stkAbweichend, stkMonate, tagText, tagVonDatum, type FristFelder, type Tag } from './fristen'
import { defektText, maengelText, MANGEL_VERMERK, type PruefErgebnis, type Pruefpunkt } from './pruefung'
import type { Anfrage } from './schreiben'
import type { Schwere } from './zustand'

export interface Wer { organization_id: string; name: string }

export interface GeraetKurz extends FristFelder { id: string; name: string; type: string }

// ── Gerätebuch ───────────────────────────────────────────────────────────────

export type EreignisArt = 'angelegt' | 'geaendert' | 'gesperrt' | 'freigegeben' | 'ausser_betrieb' | 'wieder_in_betrieb' | 'vermerk' | 'geloescht' | 'stk' | 'mtk'

export const EREIGNIS_TEXT: Record<EreignisArt, string> = {
  angelegt: 'Angelegt', geaendert: 'Stammdaten geändert', gesperrt: 'Gesperrt', freigegeben: 'Freigegeben',
  ausser_betrieb: 'Außer Betrieb genommen', wieder_in_betrieb: 'Wieder in Betrieb genommen', vermerk: 'Vermerk', geloescht: 'Gelöscht',
  stk: 'Sicherheitstechnische Kontrolle', mtk: 'Messtechnische Kontrolle',
}

/** Was jede Person mit Zugang ins Gerätebuch schreiben darf — alles andere braucht „MPG verwalten“. */
export const EREIGNISSE_FUER_ALLE: EreignisArt[] = ['gesperrt', 'vermerk']

/** Eine Stammdatenänderung, lesbar festgehalten (alt → neu). */
export interface Aenderung { feld: string; name: string; alt: string; neu: string }

export function ereignis(o: { id: string; geraet: { id: string; name: string }; art: EreignisArt; text?: string; aenderungen?: Aenderung[]; bezug?: string; wer: Wer }): Anfrage {
  return {
    collection: 'mpg_ereignisse', aktion: 'create', id: o.id,
    body: {
      organization_id: o.wer.organization_id, device_id: o.geraet.id, device_name: o.geraet.name,
      art: o.art, text: (o.text ?? '').trim(), bezug: o.bezug ?? '', user_name: o.wer.name,
      ...(o.aenderungen ? { aenderungen: o.aenderungen } : {}),
    },
  }
}

// ── Stammdaten ───────────────────────────────────────────────────────────────

export interface Stammdaten {
  name: string; type: string; serial_number: string; location: string; interval: string
  has_stk: boolean; last_stk: string; stk_interval_months: number
  has_mtk: boolean; last_mtk: string; mtk_interval_months: number
  /** Datum der Inbetriebnahme — ab ihm läuft die erste STK und MTK */
  inbetriebnahme: string
}
/** So kommen Stammdaten aus PocketBase: jedes Feld kann fehlen oder leer sein. */
export type StammdatenRoh = { [K in keyof Stammdaten]?: Stammdaten[K] | null }

/** Takt einer STK/MTK lesbar; weicht der gespeicherte Wert ab (Altbestand), steht er dabei. */
export function taktText(art: 'stk' | 'mtk', monate: number | null | undefined): string {
  const takt = art === 'stk' ? `alle ${stkMonate(monate)} Monate` : mtkJahre(monate) === 1 ? 'jährlich' : `alle ${mtkJahre(monate)} Jahre`
  const abweichend = art === 'stk' ? stkAbweichend(monate) : mtkAbweichend(monate)
  return abweichend ? `${takt} (eingetragen: ${monateVon(monate)} Monate)` : takt
}

function kontrolleText(art: 'stk' | 'mtk', an: boolean | null | undefined, letzte: string | null | undefined, monate: number | null | undefined): string {
  if (!an) return 'nicht erforderlich'
  return `${taktText(art, monate)} · zuletzt ${tagText(kalendertag(letzte))}`
}

/** Stammdaten lesbar, je Feld — so stehen sie im Gerätebuch und auf der Seite des Geräts. */
export function stammdatenText(d: StammdatenRoh): { feld: string; name: string; wert: string }[] {
  return [
    { feld: 'name', name: 'Bezeichnung', wert: (d.name ?? '').trim() || '—' },
    { feld: 'type', name: 'Gerätetyp', wert: (d.type ?? '').trim() || '—' },
    { feld: 'serial_number', name: 'Seriennummer', wert: (d.serial_number ?? '').trim() || '—' },
    { feld: 'location', name: 'Standort', wert: (d.location ?? '').trim() || '—' },
    { feld: 'interval', name: 'Prüfintervall', wert: INTERVALL_TEXT[intervallVon(d.interval)] },
    { feld: 'stk', name: 'STK', wert: kontrolleText('stk', d.has_stk, d.last_stk, d.stk_interval_months) },
    { feld: 'mtk', name: 'MTK', wert: kontrolleText('mtk', d.has_mtk, d.last_mtk, d.mtk_interval_months) },
    { feld: 'inbetriebnahme', name: 'Inbetriebnahme', wert: tagText(kalendertag(d.inbetriebnahme)) },
  ]
}

/** Was sich an den Stammdaten ändert — nur, was man auch sieht. */
export function stammdatenAenderungen(alt: StammdatenRoh, neu: StammdatenRoh): Aenderung[] {
  const vorher = stammdatenText(alt)
  return stammdatenText(neu)
    .map((n, i) => ({ feld: n.feld, name: n.name, alt: vorher[i].wert, neu: n.wert }))
    .filter(a => a.alt !== a.neu)
}

/** Neues Gerät — mit ID vom Gerät (genau einmal), im Gerätebuch „angelegt“ mit allen Stammdaten. */
export function planeNeuesGeraet(o: { id: string; daten: Stammdaten & { next_inspection_due: string }; wer: Wer; ereignisId: string; buch: boolean }): Anfrage[] {
  const anfragen: Anfrage[] = [{
    collection: 'mpg_devices', aktion: 'create', id: o.id,
    body: { ...o.daten, organization_id: o.wer.organization_id, operational: true },
  }]
  if (o.buch) {
    anfragen.push(ereignis({
      id: o.ereignisId, geraet: { id: o.id, name: o.daten.name }, art: 'angelegt', wer: o.wer,
      aenderungen: stammdatenText(o.daten).map(f => ({ feld: f.feld, name: f.name, alt: '', neu: f.wert })),
    }))
  }
  return anfragen
}

/** Hat ein Stammdatum denselben Wert? Daten als Kalendertag, Intervall gelesen, Text ohne Leerraum. */
export function gleichesStammdatum(k: keyof Stammdaten, a: unknown, b: unknown): boolean {
  if (k === 'last_stk' || k === 'last_mtk' || k === 'inbetriebnahme') return (kalendertag(a as string) ?? '') === (kalendertag(b as string) ?? '')
  if (k === 'interval') return intervallVon(a) === intervallVon(b)
  if (k === 'has_stk' || k === 'has_mtk') return !!a === !!b
  if (k === 'stk_interval_months' || k === 'mtk_interval_months') return monateVon(a as number) === monateVon(b as number)
  return String(a ?? '').trim() === String(b ?? '').trim()
}

/** Name eines Stammdatums, wie er im Gerätebuch steht (STK- und MTK-Felder unter „STK“ bzw. „MTK“) */
export function stammdatenName(k: keyof Stammdaten): string {
  const feld = k.includes('stk') ? 'stk' : k.includes('mtk') ? 'mtk' : k
  return stammdatenText({}).find(f => f.feld === feld)?.name ?? k
}

const STAMMFELDER: (keyof Stammdaten)[] = ['name', 'type', 'serial_number', 'location', 'interval', 'has_stk', 'last_stk', 'stk_interval_months', 'has_mtk', 'last_mtk', 'mtk_interval_months', 'inbetriebnahme']

/** Welche Stammdaten unterscheiden sich? */
export function geaenderteStammdaten(von: StammdatenRoh, nach: Stammdaten): (keyof Stammdaten)[] {
  return STAMMFELDER.filter(k => k in nach && !gleichesStammdatum(k, von[k], nach[k]))
}

/**
 * Stammdaten ändern; im Gerätebuch steht, was sich geändert hat. Gesendet wird nur, was im
 * Formular geändert wurde (gegenüber `ausgang`, dem Stand beim Öffnen) — sonst setzte ein
 * Formular, das vor einer inzwischen eingetragenen STK geöffnet wurde, deren Datum zurück.
 * Nichts geändert → nichts zu schreiben.
 * @param alt der Stand am Server (frisch gelesen) — daraus „alt → neu“ im Gerätebuch
 * @param ausgang der Stand beim Öffnen des Formulars (Standard: alt)
 * @param begruendung steht im Gerätebuch beim Eintrag (z. B. warum die STK entfällt)
 */
export function planeGeraetAenderung(o: {
  id: string; alt: StammdatenRoh; ausgang?: StammdatenRoh; daten: Stammdaten & { next_inspection_due: string }
  wer: Wer; ereignisId: string; buch: boolean; begruendung?: string
}): Anfrage[] {
  // Ist eine Kontrolle am Ende abgeschaltet, gehen ihr Datum und Intervall nicht mit (sonst ließe
  // sich das Datum „hinter dem Häkchen“ ändern, ohne dass es im Gerätebuch erscheint)
  const aus = (k: keyof Stammdaten) => (!o.daten.has_stk && (k === 'last_stk' || k === 'stk_interval_months'))
    || (!o.daten.has_mtk && (k === 'last_mtk' || k === 'mtk_interval_months'))
  const geaendert = geaenderteStammdaten(o.ausgang ?? o.alt, o.daten).filter(k => !aus(k) && !gleichesStammdatum(k, o.alt[k], o.daten[k]))
  if (!geaendert.length) return []
  const body: Record<string, unknown> = Object.fromEntries(geaendert.map(k => [k, o.daten[k]]))
  if ('interval' in body) body.next_inspection_due = o.daten.next_inspection_due
  const aenderungen = stammdatenAenderungen(o.alt, { ...o.alt, ...body } as StammdatenRoh)
  const anfragen: Anfrage[] = [{ collection: 'mpg_devices', aktion: 'update', id: o.id, body }]
  if (o.buch && (aenderungen.length || o.begruendung?.trim())) {
    anfragen.push(ereignis({ id: o.ereignisId, geraet: { id: o.id, name: o.daten.name }, art: 'geaendert', aenderungen, text: o.begruendung, wer: o.wer }))
  }
  return anfragen
}

/** Ein Gerät ohne Nachweise löschen; das Gerätebuch hält fest, wer es gelöscht hat. */
export function planeLoeschen(o: { geraet: { id: string; name: string }; wer: Wer; id: string; buch: boolean }): Anfrage[] {
  const anfragen: Anfrage[] = [{ collection: 'mpg_devices', aktion: 'delete', id: o.geraet.id, body: {} }]
  if (o.buch) anfragen.push(ereignis({ id: o.id, geraet: o.geraet, art: 'geloescht', wer: o.wer }))
  return anfragen
}

// ── Sperren, Freigeben, Außerbetriebnahme, Vermerk ─────────────────────────

/** Sperren mit Grund — darf jeder. Die Sperre zuerst. */
export function planeSperre(o: { geraet: { id: string; name: string }; grund: string; wer: Wer; id: string; buch: boolean }): Anfrage[] {
  const anfragen: Anfrage[] = [{ collection: 'mpg_devices', aktion: 'update', id: o.geraet.id, body: { operational: false } }]
  if (o.buch) anfragen.push(ereignis({ id: o.id, geraet: o.geraet, art: 'gesperrt', text: o.grund, wer: o.wer }))
  return anfragen
}

/** Freigeben — braucht „MPG verwalten“. Die Freigabe selbst zuletzt. */
export function planeFreigabe(o: { geraet: { id: string; name: string }; bemerkung: string; wer: Wer; id: string; buch: boolean }): Anfrage[] {
  const anfragen: Anfrage[] = []
  if (o.buch) anfragen.push(ereignis({ id: o.id, geraet: o.geraet, art: 'freigegeben', text: o.bemerkung, wer: o.wer }))
  anfragen.push({ collection: 'mpg_devices', aktion: 'update', id: o.geraet.id, body: { operational: true } })
  return anfragen
}

/** Grund, Verbleib und Datum der Außerbetriebnahme als ein Text fürs Gerätebuch. */
export function ausserBetriebText(o: { datum: Tag; grund: string; verbleib: string }): string {
  return [o.grund.trim(), o.verbleib.trim() && `Verbleib: ${o.verbleib.trim()}`, `Außer Betrieb seit ${tagText(o.datum)}`].filter(Boolean).join('\n')
}

/**
 * Außer Betrieb nehmen statt löschen: Das Gerät verlässt den Bestand, sein Gerätebuch
 * bleibt. Es wird zugleich gesperrt — kommt es wieder, muss es erst freigegeben werden.
 */
export function planeAusserBetrieb(o: { geraet: { id: string; name: string }; datum: Tag; grund: string; verbleib: string; wer: Wer; id: string; buch: boolean }): Anfrage[] {
  const anfragen: Anfrage[] = [{
    collection: 'mpg_devices', aktion: 'update', id: o.geraet.id,
    body: { ausser_betrieb: o.datum, ausser_betrieb_grund: o.grund.trim(), verbleib: o.verbleib.trim(), operational: false },
  }]
  if (o.buch) anfragen.push(ereignis({ id: o.id, geraet: o.geraet, art: 'ausser_betrieb', text: ausserBetriebText(o), wer: o.wer }))
  return anfragen
}

/** Wieder in Betrieb nehmen: zurück in den Bestand — gesperrt, bis jemand freigibt (auch wenn es inzwischen freigegeben wurde). */
export function planeWiederInBetrieb(o: { geraet: { id: string; name: string }; bemerkung: string; wer: Wer; id: string; buch: boolean }): Anfrage[] {
  const anfragen: Anfrage[] = []
  if (o.buch) anfragen.push(ereignis({ id: o.id, geraet: o.geraet, art: 'wieder_in_betrieb', text: o.bemerkung, wer: o.wer }))
  anfragen.push({ collection: 'mpg_devices', aktion: 'update', id: o.geraet.id, body: { ausser_betrieb: '', ausser_betrieb_grund: '', verbleib: '', operational: false } })
  return anfragen
}

/**
 * Vermerk ins Gerätebuch — auch als Korrektur: Ein gespeichertes Prüfprotokoll wird nie
 * geändert, ein Fehler darin wird mit einem Vermerk dazu richtiggestellt (bezug).
 */
export function planeVermerk(o: { geraet: { id: string; name: string }; text: string; bezug?: string; wer: Wer; id: string }): Anfrage[] {
  return [ereignis({ id: o.id, geraet: o.geraet, art: 'vermerk', text: o.text, bezug: o.bezug, wer: o.wer })]
}

/** Liegt der Zeitpunkt `a` (PocketBase- oder ISO-Format) nach `b`? */
function spaeter(a: string | null | undefined, b: Date): boolean {
  if (!a) return false
  const t = new Date(String(a).replace(' ', 'T')).getTime()
  return Number.isFinite(t) && t > b.getTime()
}

/**
 * Prüfprotokoll + Gerätestand; bei Mangel oder „nicht bestanden“ dazu ein Defekt (und die Sperre).
 * @param serverLetzte last_inspection laut Server. Ist sie neuer als dieser Versuch (ein älterer
 *   Entwurf wird später erneut gesendet), bleibt der Gerätestand der neueren Prüfung stehen —
 *   Protokoll und Defekt werden trotzdem angelegt, eine Sperre trotzdem gesetzt. Wie im
 *   Server-Hook (pb_hooks/mpg.pb.js) zwei Ausnahmen zur sicheren Seite: Ein Serverstand nach
 *   `sendezeit` (Uhr ging vor) zählt nicht als neuer, und „nicht bestanden“ setzt sich gegen
 *   ein gespeichertes „bestanden“ (oder unbekanntes) immer durch.
 * @param serverBestanden last_inspection_passed laut Server
 * @param sendezeit jetzt, beim Senden (Standard: die Uhr des Geräts)
 */
export function planePruefung(o: {
  geraet: GeraetKurz
  punkte: Pruefpunkt[]
  bemerkung: string
  ergebnis: PruefErgebnis
  wer: Wer
  jetzt: Date
  ids: { pruefung: string; defekt: string }
  serverLetzte?: string | null
  serverBestanden?: boolean | null
  sendezeit?: Date
  /** Gerätebuch vorhanden: eine Sperre wird dort festgehalten (Eintrag mit der ID der Prüfung) */
  buch?: boolean
}): Anfrage[] {
  const { geraet, ergebnis, wer } = o
  const zeit = o.jetzt.toISOString()
  const bestanden = ergebnis !== 'nicht_bestanden'
  const bemerkung = o.bemerkung.trim()
  const ueberholt = spaeter(o.serverLetzte, o.jetzt) && !spaeter(o.serverLetzte, o.sendezeit ?? new Date())
    && !(ergebnis === 'nicht_bestanden' && o.serverBestanden !== false)
  const anfragen: Anfrage[] = []
  // 1. Sperre zuerst
  if (ergebnis === 'nicht_bestanden') {
    anfragen.push({ collection: 'mpg_devices', aktion: 'update', id: geraet.id, body: { operational: false } })
    if (o.buch) anfragen.push(ereignis({ id: o.ids.pruefung, geraet, art: 'gesperrt', text: 'Prüfung nicht bestanden', bezug: o.ids.pruefung, wer }))
  }
  // 2. Defekt
  if (ergebnis !== 'bestanden') {
    anfragen.push({
      collection: 'mpg_defects', aktion: 'create', id: o.ids.defekt,
      body: {
        device_id: geraet.id, device_name: geraet.name, reported_by: wer.name,
        description: defektText(ergebnis, o.punkte, bemerkung),
        severity: ergebnis === 'mangel' ? 'low' : 'high', status: 'open',
        organization_id: wer.organization_id,
      },
    })
  }
  // 3. Anker: das Prüfprotokoll
  anfragen.push({
    collection: 'mpg_inspections', aktion: 'create', id: o.ids.pruefung,
    body: {
      device_id: geraet.id, device_name: geraet.name, device_type: geraet.type,
      user_name: wer.name, inspection_date: zeit, passed: bestanden,
      notes: ergebnis === 'mangel' ? MANGEL_VERMERK + (bemerkung || maengelText(o.punkte)) : bemerkung,
      checklist_results: o.punkte.map(({ item, checked, note, status }) => status ? { item, checked, note, status } : { item, checked, note }),
      organization_id: wer.organization_id,
    },
  })
  // 4. Zuletzt der Prüfstand am Gerät — außer eine neuere Prüfung steht schon dort
  if (!ueberholt) {
    anfragen.push({
      collection: 'mpg_devices', aktion: 'update', id: geraet.id,
      body: {
        last_inspection: zeit, last_inspection_passed: bestanden,
        next_inspection_due: faelligFeld({ ...geraet, last_inspection: zeit }, tagVonDatum(o.jetzt)),
      },
    })
  }
  return anfragen
}

/** Defekt anlegen, auf Wunsch zugleich das Gerät sperren. */
export function planeDefekt(o: {
  geraet: { id: string; name: string }
  beschreibung: string
  schwere: Schwere
  sperren: boolean
  wer: Wer
  id: string
  buch?: boolean
}): Anfrage[] {
  const anfragen: Anfrage[] = []
  if (o.sperren) {
    anfragen.push({ collection: 'mpg_devices', aktion: 'update', id: o.geraet.id, body: { operational: false } })
    if (o.buch) anfragen.push(ereignis({ id: o.id, geraet: o.geraet, art: 'gesperrt', text: `Defekt gemeldet: ${o.beschreibung.trim()}`, bezug: o.id, wer: o.wer }))
  }
  // Anker: der Defekt
  anfragen.push({
    collection: 'mpg_defects', aktion: 'create', id: o.id,
    body: {
      device_id: o.geraet.id, device_name: o.geraet.name, reported_by: o.wer.name,
      description: o.beschreibung.trim(), severity: o.schwere, status: 'open',
      organization_id: o.wer.organization_id,
    },
  })
  return anfragen
}

/**
 * Defekt als behoben schließen; nur auf ausdrücklichen Wunsch das Gerät wieder freigeben
 * (braucht „MPG verwalten“). Die Freigabe zuletzt.
 */
export function planeBeheben(o: {
  defekt: { id: string; device_id: string; device_name: string }
  notiz: string
  wer: Wer
  wiederEinsatzbereit: boolean
  /** Gerätebuch vorhanden: die Freigabe wird dort mit dieser ID festgehalten */
  buch?: { ereignisId: string }
}): Anfrage[] {
  const anfragen: Anfrage[] = [{
    collection: 'mpg_defects', aktion: 'update', id: o.defekt.id,
    body: { status: 'resolved', resolved_by: o.wer.name, resolved_notes: o.notiz.trim() },
  }]
  if (o.wiederEinsatzbereit) {
    if (o.buch) {
      anfragen.push(ereignis({
        id: o.buch.ereignisId, geraet: { id: o.defekt.device_id, name: o.defekt.device_name }, art: 'freigegeben',
        text: o.notiz.trim() ? `Defekt behoben: ${o.notiz.trim()}` : 'Defekt behoben', bezug: o.defekt.id, wer: o.wer,
      }))
    }
    anfragen.push({ collection: 'mpg_devices', aktion: 'update', id: o.defekt.device_id, body: { operational: true } })
  }
  return anfragen
}

/**
 * Meldung von außen bestätigen: Defekt anlegen, auf Wunsch sperren, Meldung schließen.
 * Anker ist hier der Status der Meldung (zuletzt) — vor jedem Senden wird er gelesen.
 * Der Defekt (mit der ID der Meldung) steht vor der Sperre: Eine Sperre ohne Defekt kann so
 * nicht entstehen, und Ablehnen erkennt eine teilweise gespeicherte Bestätigung am Defekt.
 */
export function planeBestaetigung(o: {
  meldung: { id: string; device_id: string; device_name: string; reporter_name?: string; description: string; severity: Schwere }
  anmerkung: string
  sperren: boolean
  /** Gibt es das Gerät noch? Sonst wird nur der Defekt angelegt. */
  geraetDa: boolean
  wer: Wer
  defektId: string
  buch?: boolean
}): Anfrage[] {
  const { meldung: m } = o
  const anmerkung = o.anmerkung.trim()
  const anfragen: Anfrage[] = []
  anfragen.push({
    collection: 'mpg_defects', aktion: 'create', id: o.defektId,
    body: {
      device_id: m.device_id, device_name: m.device_name,
      reported_by: m.reporter_name || 'Externe Meldung',
      description: anmerkung ? `${m.description}\n\nAnmerkung bei Bestätigung (${o.wer.name}): ${anmerkung}` : m.description,
      severity: m.severity, status: 'open', organization_id: o.wer.organization_id,
    },
  })
  if (o.sperren && o.geraetDa) {
    anfragen.push({ collection: 'mpg_devices', aktion: 'update', id: m.device_id, body: { operational: false } })
    if (o.buch) anfragen.push(ereignis({ id: o.defektId, geraet: { id: m.device_id, name: m.device_name }, art: 'gesperrt', text: `Meldung von außen bestätigt: ${m.description}`, bezug: m.id, wer: o.wer }))
  }
  anfragen.push({ collection: 'mpg_defect_reports', aktion: 'update', id: m.id, body: { status: 'confirmed' } })
  return anfragen
}

/** Der Anker eines Plans: der zuletzt angelegte Datensatz. */
export function anker(anfragen: Anfrage[]): { collection: string; id: string } | null {
  const a = [...anfragen].reverse().find(x => x.aktion === 'create')
  return a ? { collection: a.collection, id: a.id } : null
}

/** Was nach dem Anker kommt — ist der Anker schon angekommen, fehlt höchstens das noch. */
export function restNachAnker(anfragen: Anfrage[]): Anfrage[] {
  const a = anker(anfragen)
  if (!a) return anfragen
  const i = anfragen.findIndex(x => x.aktion === 'create' && x.collection === a.collection && x.id === a.id)
  return anfragen.slice(i + 1)
}
