// STK und MTK eintragen — was die App vorschlägt und was eine Kontrolle schreibt.
//
// Grundlage: Medizinprodukte-Betreiberverordnung, Neufassung 2025 (Recherche 22.10.2026).
// - STK (sicherheitstechnische Kontrolle) für Defibrillatoren und AED, Beatmungsgeräte,
//   Spritzen- und Infusionspumpen: spätestens alle 24 Monate, mit Ablauf des Monats.
// - MTK (messtechnische Kontrolle) für Blutdruckmessung (auch das Modul im Defi-Monitor)
//   und Thermometer: in Jahren, mit Ablauf des Jahres, höchstens alle 2 Jahre; nach
//   Reparatur, Öffnen, Sturz oder Zweifel an der Messgenauigkeit sofort.
// - Nicht bestanden → gesperrt, bis eine bestandene eingetragen ist (zustand.ts); die Frist
//   läuft weiter ab der letzten bestandenen. Eine nachgetragene ältere, nicht bestandene
//   Kontrolle (vor der letzten bestandenen) kommt nur ins Gerätebuch.
// Die Vorschläge je Gerätetyp sind zum Abgleich mit der Gebrauchsanweisung gedacht, nie
// verbindlich — keine Paragrafen in der Oberfläche.
//
// Prüffälle: src/lib/mpg/selbsttest.ts

import { kalendertag, mtkJahre, naechsteMtk, naechsteStk, stkMonate, tagText, type Tag } from './fristen'
import { defektAusKontrolle, type KontrollStand } from './zustand'
import type { Wer } from './aktionen'
import type { Anfrage } from './schreiben'

export type KontrollArt = 'stk' | 'mtk'
export type KontrollErgebnis = 'bestanden' | 'maengel' | 'nicht_bestanden'

export const KONTROLLE_NAME: Record<KontrollArt, string> = { stk: 'STK', mtk: 'MTK' }
export const KONTROLLE_LANG: Record<KontrollArt, string> = { stk: 'Sicherheitstechnische Kontrolle', mtk: 'Messtechnische Kontrolle' }
export const ERGEBNIS_NAME: Record<KontrollErgebnis, string> = {
  bestanden: 'Bestanden', maengel: 'Bestanden mit Mängeln', nicht_bestanden: 'Nicht bestanden',
}
const ERGEBNIS_IM_SATZ: Record<KontrollErgebnis, string> = {
  bestanden: 'bestanden', maengel: 'mit Mängeln bestanden', nicht_bestanden: 'nicht bestanden',
}

/** Was zu einer Kontrolle im Gerätebuch steht (Feld „angaben“) — die Pflichtangaben des Medizinproduktebuchs. */
export interface KontrollAngaben {
  art: KontrollArt
  /** Tag der Kontrolle */
  datum: Tag
  ergebnis: KontrollErgebnis
  /** Prüfende Person — sie steht auch auf der Prüfplakette */
  pruefer: string
  firma: string
  protokoll: string
  /** Prüfplakette angebracht (STK: Monat und Jahr der nächsten, MTK: Jahr) */
  plakette: boolean
  /** MTK außerplanmäßig: nach Reparatur, Sturz oder Zweifel an der Messgenauigkeit */
  ausserplanmaessig: boolean
  maengel: string
  /** Nächste Fälligkeit, die mit dieser Kontrolle galt — null bei „nicht bestanden“ und bei
   *  einer nachgetragenen älteren (dann richtet sich die Frist nach der neueren) */
  naechste: Tag | null
  /** Älter als die zuletzt am Gerät eingetragene Kontrolle — nur nachgetragen */
  nachgetragen?: boolean
}

// ── Vorschläge je Gerätetyp ─────────────────────────────────────────────────

export interface KontrollVorschlag {
  /** STK-Intervall in Monaten, null = keine STK nach Verordnung */
  stk: number | null
  /** MTK-Nachprüffrist in Monaten (ganze Jahre), null = keine MTK */
  mtk: number | null
  /** MTK-Fristen, die ebenfalls passen (Thermometer: jährlich oder alle 2 Jahre je nach Bauart) */
  mtkAuch?: number[]
  /** Hängt die MTK an einer Eigenschaft des Geräts? Dann fragt das Formular danach. */
  mtkFrage?: string
  hinweis: string
}

const STK_24 = 'STK spätestens alle 24 Monate'
const MIT_GERAET = 'Wird es zusammen mit einem Beatmungsgerät oder Defibrillator betrieben, kann es zu dessen STK gehören (Dienstleister fragen).'

export const KONTROLL_VORSCHLAG: Record<string, KontrollVorschlag> = {
  'AED': { stk: 24, mtk: null, hinweis: `${STK_24}. Entfallen kann sie nur bei einem AED für Laien mit Selbsttest und regelmäßiger Sichtprüfung (ab Inbetriebnahme 2027 zusätzlich mit Fernüberwachung der Selbsttests). Ob das für AED auf Fahrzeugen, bei First Respondern oder im Sanitätsdienst gilt, ist offen — die STK beibehalten, bis die Aufsichtsbehörde es bestätigt.` },
  'Defibrillator': { stk: 24, mtk: null, mtkFrage: 'Misst das Gerät Blutdruck (NIBP-Modul)? Dann zusätzlich MTK alle 2 Jahre.', hinweis: `${STK_24} — häufig verlangt die Gebrauchsanweisung 12 Monate.` },
  'Beatmungsgerät': { stk: 24, mtk: null, hinweis: `${STK_24}. Wartung und Akkutausch nach Hersteller kommen getrennt dazu.` },
  'Spritzenpumpe': { stk: 24, mtk: null, hinweis: `${STK_24}. Wartung und Akkutausch nach Hersteller kommen getrennt dazu.` },
  'Infusionspumpe': { stk: 24, mtk: null, hinweis: `${STK_24}. Wartung und Akkutausch nach Hersteller kommen getrennt dazu.` },
  'Transportinkubator': { stk: 24, mtk: null, hinweis: `${STK_24}.` },
  'Externer Schrittmacher': { stk: 24, mtk: null, hinweis: `${STK_24}.` },
  'Patientenmonitor': { stk: null, mtk: null, mtkFrage: 'Misst das Gerät Blutdruck (NIBP)? Dann MTK alle 2 Jahre.', hinweis: 'Keine gesetzlich vorgeschriebene STK. Mit Blutdruckmessung MTK alle 2 Jahre — im Zweifel mit der Eichbehörde klären.' },
  'Blutdruckmessgerät': { stk: null, mtk: 24, hinweis: 'MTK alle 2 Jahre — nach Reparatur, Öffnen, Sturz oder Zweifel an der Messgenauigkeit sofort.' },
  'Thermometer': { stk: null, mtk: 12, mtkAuch: [24], hinweis: 'MTK jährlich bei Infrarot-Thermometern (Ohr, Stirn), sonst alle 2 Jahre — nach Reparatur, Sturz oder Zweifel an der Messgenauigkeit sofort.' },
  'Absaugpumpe': { stk: null, mtk: null, hinweis: `Keine gesetzlich vorgeschriebene STK oder MTK — Funktionskontrolle und Wartung nach Hersteller. ${MIT_GERAET}` },
  'Pulsoximeter': { stk: null, mtk: null, hinweis: `Keine gesetzlich vorgeschriebene STK oder MTK — Wartung nach Hersteller. ${MIT_GERAET}` },
  'Sauerstoffgerät': { stk: null, mtk: null, hinweis: 'Keine gesetzlich vorgeschriebene STK oder MTK — Wartung der Armaturen nach Hersteller. Ist ein Beatmungsgerät eingebaut, das Beatmungsgerät eigens anlegen (STK).' },
  'BZ-Gerät': { stk: null, mtk: null, hinweis: 'Keine STK oder MTK — stattdessen Kontrollmessungen nach den Vorgaben der Bundesärztekammer.' },
}

/** Für Gerätetypen ohne eigenen Vorschlag (Sonstiges, ältere Typen) */
export const KEIN_VORSCHLAG = 'Kein Vorschlag für diesen Gerätetyp. Ob STK oder MTK nötig ist, mit Gebrauchsanweisung und Dienstleister klären — z. B. externer Schrittmacher: STK; Gerät mit Blutdruck- oder Temperaturmessung: MTK.'

export function vorschlagFuer(typ: string): KontrollVorschlag | null {
  return KONTROLL_VORSCHLAG[typ] ?? null
}

/** Legt der Gerätetyp eine STK bzw. MTK nahe? (MTK auch, wenn nur eine Eigenschaft sie verlangt) */
export function typLegtNahe(typ: string): { stk: boolean; mtk: boolean } {
  const v = vorschlagFuer(typ)
  return { stk: !!v?.stk, mtk: !!v?.mtk }
}

// ── Eintragen ────────────────────────────────────────────────────────────────

/** Nächste Fälligkeit nach einer bestandenen Kontrolle an diesem Tag. */
export function naechsteNachKontrolle(art: KontrollArt, datum: Tag, monate: number | null | undefined): Tag {
  return art === 'stk' ? naechsteStk(datum, monate ?? 24) : naechsteMtk(datum, monate ?? 24)
}

/** Intervall lesbar: „alle 24 Monate“ bzw. „alle 2 Jahre“. */
export function intervallText(art: KontrollArt, monate: number | null | undefined): string {
  if (art === 'stk') { const m = stkMonate(monate); return m === 1 ? 'jeden Monat' : `alle ${m} Monate` }
  const j = mtkJahre(monate)
  return j === 1 ? 'jährlich' : `alle ${j} Jahre`
}

/** Was auf der Prüfplakette stehen sollte: STK Monat und Jahr, MTK das Jahr. */
export function plakettenText(art: KontrollArt, naechste: Tag): string {
  return art === 'stk' ? `${naechste.slice(5, 7)}/${naechste.slice(0, 4)}` : naechste.slice(0, 4)
}

/** Eine Zeile fürs Gerätebuch, z. B. „STK bestanden am 10.03.2026 · Medtech GmbH (M. Muster) · Protokoll 4711“. */
export function kontrolleText(a: Pick<KontrollAngaben, 'art' | 'datum' | 'ergebnis' | 'pruefer' | 'firma' | 'protokoll' | 'maengel' | 'ausserplanmaessig'>): string {
  const wer = [a.firma.trim(), a.pruefer.trim() && (a.firma.trim() ? `(${a.pruefer.trim()})` : a.pruefer.trim())].filter(Boolean).join(' ')
  return [
    `${KONTROLLE_NAME[a.art]} ${ERGEBNIS_IM_SATZ[a.ergebnis]} am ${tagText(a.datum)}${a.ausserplanmaessig ? ' (außerplanmäßig)' : ''}`,
    wer, a.protokoll.trim() && `Protokoll ${a.protokoll.trim()}`,
  ].filter(Boolean).join(' · ') + (a.maengel.trim() ? `\n${a.maengel.trim()}` : '')
}

/**
 * Eine eingetragene STK oder MTK. Reihenfolge wie überall (src/lib/mpg/aktionen.ts):
 * Was sperrt, zuerst; der Eintrag im Gerätebuch ist der Anker; was das Gerät „gut
 * aussehen“ lässt (neues Datum der letzten Kontrolle), zuletzt.
 * - bestanden: Eintrag, neues Datum (nur wenn neuer als das bisherige)
 * - mit Mängeln: Defekt „mittel“ mit den Mängeln, Eintrag, neues Datum
 * - nicht bestanden: Sperre, Defekt „hoch“, Eintrag — das Datum bleibt beim letzten bestandenen.
 *   Gesperrt bleibt das Gerät, bis eine bestandene eingetragen ist (zustand.ts).
 * - nachgetragen (älter als die letzte bestandene): nur der Eintrag — ein längst behobener
 *   Fehlschlag sperrt kein Gerät, das seitdem bestanden hat
 * @param bisher Datum der letzten bestandenen Kontrolle laut Server (frisch gelesen) — eine
 *   nachgetragene ältere Kontrolle überschreibt keine neuere
 */
export function planeKontrolle(o: {
  geraet: { id: string; name: string; stk_interval_months?: number | null; mtk_interval_months?: number | null }
  angaben: Omit<KontrollAngaben, 'naechste'>
  bisher: Tag | null
  wer: Wer
  ids: { ereignis: string; defekt: string }
  /** heute — ein bisheriges Datum danach (Tippfehler im Jahr) zählt nicht */
  heute?: Tag
}): Anfrage[] {
  // Nur, was zum Ergebnis gehört: Mängel nicht bei „bestanden“, keine Plakette bei „nicht
  // bestanden“, außerplanmäßig nur bei der MTK (das Blatt behält Eingaben beim Umschalten)
  const a = {
    ...o.angaben,
    pruefer: o.angaben.pruefer.trim(), firma: o.angaben.firma.trim(), protokoll: o.angaben.protokoll.trim(),
    maengel: o.angaben.ergebnis === 'bestanden' ? '' : o.angaben.maengel.trim(),
    plakette: o.angaben.ergebnis !== 'nicht_bestanden' && o.angaben.plakette,
    ausserplanmaessig: o.angaben.art === 'mtk' && o.angaben.ausserplanmaessig,
  }
  const feld = a.art === 'stk' ? 'last_stk' : 'last_mtk'
  const monate = a.art === 'stk' ? o.geraet.stk_interval_months : o.geraet.mtk_interval_months
  const bisher = o.bisher && (!o.heute || o.bisher <= o.heute) ? o.bisher : null
  const nachgetragen = !!bisher && a.datum < bisher
  const naechste = a.ergebnis === 'nicht_bestanden' || nachgetragen ? null : naechsteNachKontrolle(a.art, a.datum, monate)
  const folgen = !(a.ergebnis === 'nicht_bestanden' && nachgetragen)
  const name = KONTROLLE_NAME[a.art]
  const anfragen: Anfrage[] = []
  if (a.ergebnis === 'nicht_bestanden' && folgen) {
    anfragen.push({ collection: 'mpg_devices', aktion: 'update', id: o.geraet.id, body: { operational: false } })
  }
  if (a.ergebnis !== 'bestanden' && folgen) {
    anfragen.push({
      collection: 'mpg_defects', aktion: 'create', id: o.ids.defekt,
      body: {
        device_id: o.geraet.id, device_name: o.geraet.name, reported_by: o.wer.name,
        description: `${name} ${a.ergebnis === 'nicht_bestanden' ? 'nicht bestanden' : 'mit Mängeln'}: ${a.maengel}`,
        severity: a.ergebnis === 'nicht_bestanden' ? 'high' : 'medium', status: 'open',
        organization_id: o.wer.organization_id,
      },
    })
  }
  anfragen.push({
    collection: 'mpg_ereignisse', aktion: 'create', id: o.ids.ereignis,
    body: {
      organization_id: o.wer.organization_id, device_id: o.geraet.id, device_name: o.geraet.name,
      art: a.art, text: kontrolleText(a) + (nachgetragen ? `\nNachgetragen — die Frist richtet sich nach der ${name} vom ${tagText(bisher)}` : ''),
      bezug: a.ergebnis === 'bestanden' || !folgen ? '' : o.ids.defekt, user_name: o.wer.name,
      angaben: { ...a, naechste, ...(nachgetragen ? { nachgetragen: true } : {}) },
    },
  })
  if (a.ergebnis !== 'nicht_bestanden' && (!bisher || a.datum > bisher)) {
    anfragen.push({ collection: 'mpg_devices', aktion: 'update', id: o.geraet.id, body: { [feld]: a.datum } })
  }
  return anfragen
}

/** Ein Eintrag im Gerätebuch, soweit er für den Stand der Kontrollen zählt */
export interface KontrollEintrag {
  device_id: string
  art: string
  created: string
  text?: string | null
  angaben?: unknown
  /** Defekt, den die Kontrolle angelegt hat (nicht bestanden, mit Mängeln) */
  bezug?: string | null
}

/**
 * Neueste STK und MTK je Gerät aus dem Gerätebuch (gleiche Regel im Server-Hook pb_hooks/mpg.pb.js) — nach dem Tag der Kontrolle, bei gleichem
 * Tag nach der Reihenfolge des Eintragens. Fehlen die Angaben (Feld noch nicht angelegt),
 * zählen der Tag des Eintrags und die Zeile im Gerätebuch.
 */
export function neuesteKontrollen(eintraege: KontrollEintrag[], heute: Tag): Map<string, Partial<Record<KontrollArt, KontrollStand>>> {
  const beste = new Map<string, { stand: KontrollStand; created: string }>()
  for (const e of eintraege) {
    if (e.art !== 'stk' && e.art !== 'mtk') continue
    const a = (e.angaben && typeof e.angaben === 'object' && !Array.isArray(e.angaben) ? e.angaben : {}) as Partial<KontrollAngaben>
    // Ein Tag der Kontrolle nach heute zählt nicht (dann der Tag des Eintrags)
    // Nur ein Tag der Form JJJJ-MM-TT zählt (wie im Hook) — „23.10.2026“ oder „02062-…“ nicht
    const roh = typeof a.datum === 'string' ? a.datum.trim() : ''
    const angegeben = /^\d{4}-\d{2}-\d{2}$/.test(roh) ? kalendertag(roh) : null
    const datum = (angegeben && angegeben <= heute ? angegeben : null) ?? kalendertag(e.created)
    if (!datum) continue
    const ergebnis = a.ergebnis ?? (/nicht bestanden/.test(String(e.text ?? '').split('\n')[0]) ? 'nicht_bestanden' : 'bestanden')
    const k = `${e.device_id}|${e.art}`
    const bisher = beste.get(k)
    if (!bisher || datum > bisher.stand.datum || (datum === bisher.stand.datum && e.created > bisher.created)) {
      beste.set(k, { stand: { datum, bestanden: ergebnis !== 'nicht_bestanden', eingetragen: e.created }, created: e.created })
    }
  }
  const je = new Map<string, Partial<Record<KontrollArt, KontrollStand>>>()
  for (const [k, { stand }] of beste) {
    const [id, art] = k.split('|') as [string, KontrollArt]
    je.set(id, { ...je.get(id), [art]: stand })
  }
  return je
}

/**
 * Fehlt der Eintrag einer nicht bestandenen STK/MTK im Gerätebuch (abgelehnt, ein unklarer
 * Versuch verworfen), bleibt ihr Defekt („STK nicht bestanden: …“, offen oder behoben). Er zählt
 * dann als nicht bestandene Kontrolle am Tag seines Anlegens — solange keine neuere bestandene
 * im Gerätebuch steht. Gleiche Regel im Hook (pb_hooks/mpg.pb.js).
 */
export function mitDefektFallback(
  stand: Map<string, Partial<Record<KontrollArt, KontrollStand>>>,
  defekte: { id: string; device_id: string; description?: string | null; created: string }[],
  eintraege: KontrollEintrag[],
): Map<string, Partial<Record<KontrollArt, KontrollStand>>> {
  const verknuepft = new Set(eintraege.map(e => e.bezug).filter(Boolean))
  const neu = new Map(stand)
  for (const d of defekte) {
    const art = defektAusKontrolle(d.description)
    const tag = kalendertag(d.created)
    if (!art || !tag || verknuepft.has(d.id)) continue
    const k = neu.get(d.device_id)?.[art]
    if (!k || k.datum < tag || (k.datum === tag && (k.eingetragen ?? '') < d.created)) {
      neu.set(d.device_id, { ...neu.get(d.device_id), [art]: { datum: tag, bestanden: false, eingetragen: d.created } })
    }
  }
  return neu
}
