// Felder der anpassbaren Standardformulare und der eigenen Formulare (Plan Vorgänge 1, 2.9).
//
// Zwilling von pb_hooks/formular-regeln.js (Abschnitt „Felder“): Katalog der Kernfelder,
// Einstellung lesen, Schema der Vorlagen lesen und prüfen, Werte prüfen und bereinigen. Der
// Server entscheidet, die App rechnet dasselbe für Anzeige und Prüfung vor dem Senden; ein
// Gleichlauf-Prüffall (formularFelderGleichlauf.test.ts) vergleicht beide über eine Tabelle.
// Keine Imports aus React oder PocketBase.

export type FeldTyp = 'text' | 'langtext' | 'zahl' | 'datum' | 'uhrzeit' | 'auswahl' | 'mehrfach' | 'janein'

export type FeldDef = {
  /** eigene Felder: 'e_' + 8 × [a-z0-9] (Standardformular), 'f_' + 8 (eigenes Formular); fest nach dem Anlegen */
  id: string
  typ: FeldTyp
  /** 1 bis 120 Zeichen, getrimmt */
  label: string
  /** bis 300 */
  hilfe?: string
  pflicht?: boolean
  /** ausgeblendet, aber nicht gelöscht */
  aus?: boolean
  /** nur auswahl/mehrfach: 2 bis 30, je 1 bis 80 Zeichen, eindeutig (getrimmt, klein) */
  optionen?: string[]
  /** nur zahl, bis 12 */
  einheit?: string
  min?: number
  max?: number
  /** nur eigene Formulare: Kennung eines Abschnitts */
  abschnitt?: string
}

export type Abschnitt = { id: string; titel: string; hilfe?: string }
export type Wert = string | number | boolean | string[]

/** Gespeicherte Angaben zu eigenen Feldern (product_outputs payload.eigene, mpg_defect_reports.eigene, cirs payload.eigene). */
export type Angaben = {
  v: 1
  /** Fassung, gegen die geprüft wurde */
  version: number
  /** Schnappschuss aller (nicht ausgeblendeten) Felder dieser Fassung */
  felder: FeldDef[]
  /** nur Ausgefülltes */
  werte: Record<string, Wert>
  /** Werte aus einer älteren Fassung, die nicht mehr passen, als Text */
  aelter?: { id: string; wert: string }[]
}

export type StandardFormular = 'produktausgabe' | 'defektmeldung' | 'cirs'
export type VorlageModus = 'passwort' | 'frei' | 'anonym'
export type EinsendungStatus = 'neu' | 'in_bearbeitung' | 'erledigt'

export type KernFeld = { id: string; label: string; fest: boolean; ausErlaubt: boolean; pflichtWaehlbar: boolean; pflichtVor: boolean }

export type StandardKonfig = {
  v: 1
  version: number
  felder: Record<string, { label?: string; hilfe?: string; aus?: boolean; pflicht?: boolean }>
  reihenfolge: string[]
  eigene: FeldDef[]
}

export type Baustein =
  | { art: 'kern'; id: string; label: string; hilfe: string; pflicht: boolean; aus: boolean; kern: KernFeld }
  | { art: 'eigen'; feld: FeldDef }

export type VorlageSchema = { abschnitte: Abschnitt[]; felder: FeldDef[] }

export type Einsendung = {
  id: string
  vorlage: string
  angelegt: string
  status: EinsendungStatus
  notiz: string
  titel: string
  angaben: Angaben & { abschnitte: Abschnitt[] }
  absenderModus: VorlageModus
  /** Einsendung von vor diesem Paket (flacher payload, ohne Status und Absender) */
  alt: boolean
  verlauf: { am: string; von: string; status?: string; notiz?: boolean }[]
}

export const FELD_TYPEN: FeldTyp[] = ['text', 'langtext', 'zahl', 'datum', 'uhrzeit', 'auswahl', 'mehrfach', 'janein']

export const FELD_TYP_NAME: Record<FeldTyp, string> = {
  text: 'Text', langtext: 'Langtext', zahl: 'Zahl', datum: 'Datum', uhrzeit: 'Uhrzeit', auswahl: 'Auswahl', mehrfach: 'Mehrfachauswahl', janein: 'Ja/Nein',
}

/** Grenzen (Plan 1.1), gleich FELD_GRENZEN im Server. */
export const FELD_GRENZEN = {
  eigene_standard: 30,
  felder: 80,
  abschnitte: 20,
  label: 120,
  hilfe: 300,
  optionen_min: 2,
  optionen: 30,
  option: 80,
  einheit: 12,
  text: 500,
  langtext: 4000,
  zahl: 1e9,
  mehrfach: 30,
  titel: 120,
  beschreibung: 500,
  notiz: 4000,
  werte_vorlage: 200000,
  werte_standard: 60000,
  aelter: 30,
  aelter_text: 4000,
  fassungen: 10,
  verlauf: 500,
} as const

/** Texte zu Feldern, gleich EIGENE_TEXTE.pflicht und .wert im Server ({label} = Bezeichnung). */
export const FELD_TEXTE = {
  pflicht: 'Bitte „{label}“ ausfüllen.',
  wert: 'Bitte „{label}“ prüfen.',
} as const

const kf = (id: string, label: string, fest: boolean, ausErlaubt: boolean, pflichtWaehlbar: boolean, pflichtVor: boolean): KernFeld =>
  ({ id, label, fest, ausErlaubt, pflichtWaehlbar, pflichtVor })

/** Kernfelder der Standardformulare (Plan 1.2). Patientendoku hat keinen Katalog. */
export const STANDARD_FELDER: Record<StandardFormular, KernFeld[]> = {
  produktausgabe: [
    kf('einsatz', 'Einsatznummer', true, false, false, true),
    kf('datum', 'Datum', true, false, false, true),
    kf('positionen', 'Positionen', true, false, false, true),
    kf('lager_id', 'Verbrauchsort', true, false, false, true),
  ],
  defektmeldung: [
    kf('device_id', 'Gerät', true, false, false, true),
    kf('description', 'Beschreibung', true, false, false, true),
    kf('severity', 'Schweregrad', true, false, false, true),
  ],
  cirs: [
    kf('datum', 'Datum des Ereignisses', false, true, true, true),
    kf('ort', 'Ort', false, true, true, true),
    kf('kategorie', 'Kategorie', false, true, true, true),
    kf('schwere', 'Schweregrad', false, true, true, true),
    kf('was', 'Was ist passiert?', true, false, false, true),
    kf('warum', 'Warum ist es passiert?', false, true, true, false),
    kf('folgen', 'Folgen', false, true, true, false),
    kf('vorschlag', 'Wie lässt es sich verhindern?', false, true, true, false),
    kf('melder_name', 'Name (freiwillig)', false, true, false, false),
    kf('melder_kontakt', 'Kontakt (freiwillig)', false, true, false, false),
  ],
}

export const STANDARD_FORMULARE: StandardFormular[] = ['produktausgabe', 'defektmeldung', 'cirs']
export const VORLAGE_MODI: VorlageModus[] = ['passwort', 'frei', 'anonym']
export const EINSENDUNG_STATUS: EinsendungStatus[] = ['neu', 'in_bearbeitung', 'erledigt']

// ── Grundbausteine (wie im Server) ────────────────────────────────────────

type Obj = Record<string, unknown>

function istObjekt(x: unknown): x is Obj {
  return !!x && typeof x === 'object' && !Array.isArray(x)
}

function eigenes(o: unknown, k: string): boolean {
  return !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k)
}

/** JSON aus Text (auch doppelt kodiert) oder schon als Wert; Unlesbares null. */
function jsonLesen(x: unknown): unknown {
  let v = x
  for (let i = 0; i < 2 && typeof v === 'string'; i++) {
    try { v = JSON.parse(v) } catch { return null }
  }
  return v === undefined ? null : v
}

/** Kennung eines Felds oder Abschnitts: Buchstabe oder Ziffer, dann bis 39 aus [A-Za-z0-9_-]; keine Namen von Object.prototype. */
export function kennungOk(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(id) && !(id in Object.prototype)
}

function kuerzen(x: unknown, max: number): string {
  return typeof x === 'string' ? x.trim().slice(0, max).trim() : ''
}

function zahlOk(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= FELD_GRENZEN.zahl
}

function versionsZahl(x: unknown): number | null {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 1e9 ? x : null
}

function datumGueltig(d: unknown): boolean {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const t = new Date(d + 'T00:00:00Z')
  return Number.isFinite(t.getTime()) && t.toISOString().slice(0, 10) === d
}

function formConfigLesen(roh: unknown): Obj {
  let x = roh
  for (let i = 0; i < 2 && typeof x === 'string'; i++) {
    try { x = JSON.parse(x) } catch { return {} }
  }
  return istObjekt(x) ? x : {}
}

function optionenLesen(roh: unknown): string[] {
  const aus: string[] = []
  const gesehen: Record<string, true> = {}
  for (const o of Array.isArray(roh) ? roh : []) {
    const t = kuerzen(o, FELD_GRENZEN.option)
    if (!t) continue
    const k = t.toLowerCase()
    if (eigenes(gesehen, k)) continue
    gesehen[k] = true
    aus.push(t)
    if (aus.length >= FELD_GRENZEN.optionen) break
  }
  return aus
}

/** Alte Feldarten der Vorlagen (fieldType) in neue. */
const ALT_TYP: Record<string, FeldTyp> = { text: 'text', textarea: 'langtext', number: 'zahl', date: 'datum', time: 'uhrzeit', select: 'auswahl', checkbox: 'janein' }

/** Feld in neuer Schreibweise, alte Schlüssel (fieldType, required, hint, options) übersetzt, nichts geprüft. */
function feldRoh(x: unknown): unknown {
  if (!istObjekt(x)) return x
  const f: Obj = { ...x }
  if (f.typ === undefined && typeof x.fieldType === 'string') f.typ = eigenes(ALT_TYP, x.fieldType) ? ALT_TYP[x.fieldType] : x.fieldType
  if (f.pflicht === undefined && x.required !== undefined) f.pflicht = x.required === true
  if (f.hilfe === undefined && x.hint !== undefined) f.hilfe = x.hint
  if (f.optionen === undefined && x.options !== undefined) f.optionen = x.options
  delete f.fieldType
  delete f.required
  delete f.hint
  delete f.options
  return f
}

/** Ein Feld nachsichtig gelesen (Anzeige, Normalform); null, wenn Kennung oder Art nicht passen. */
export function feldLesen(x: unknown, mitAbschnitt = true): FeldDef | null {
  const f = feldRoh(x)
  if (!istObjekt(f) || !kennungOk(f.id) || !FELD_TYPEN.includes(f.typ as FeldTyp)) return null
  const d: FeldDef = { id: f.id, typ: f.typ as FeldTyp, label: kuerzen(f.label, FELD_GRENZEN.label) }
  const hilfe = kuerzen(f.hilfe, FELD_GRENZEN.hilfe)
  if (hilfe) d.hilfe = hilfe
  if (f.pflicht === true) d.pflicht = true
  if (f.aus === true) d.aus = true
  if (d.typ === 'auswahl' || d.typ === 'mehrfach') d.optionen = optionenLesen(f.optionen)
  if (d.typ === 'zahl') {
    const einheit = kuerzen(f.einheit, FELD_GRENZEN.einheit)
    if (einheit) d.einheit = einheit
    const min = zahlOk(f.min) ? f.min : null
    const max = zahlOk(f.max) ? f.max : null
    if (min !== null && (max === null || min <= max)) d.min = min
    if (max !== null && (min === null || min <= max)) d.max = max
  }
  if (mitAbschnitt && kennungOk(f.abschnitt)) d.abschnitt = f.abschnitt
  return d
}

function feldListeLesen(roh: unknown, mitAbschnitt: boolean, max: number): FeldDef[] {
  const liste = jsonLesen(roh)
  const aus: FeldDef[] = []
  const ids: Record<string, true> = {}
  for (const x of Array.isArray(liste) ? liste : []) {
    const d = feldLesen(x, mitAbschnitt)
    if (!d || eigenes(ids, d.id)) continue
    ids[d.id] = true
    aus.push(d)
    if (aus.length >= max) break
  }
  return aus
}

/** Abschnitte nachsichtig: { id, titel, hilfe? }, höchstens 20. */
export function abschnitteLesen(roh: unknown): Abschnitt[] {
  const liste = jsonLesen(roh)
  const aus: Abschnitt[] = []
  const ids: Record<string, true> = {}
  for (const x of Array.isArray(liste) ? liste : []) {
    if (!istObjekt(x) || !kennungOk(x.id) || eigenes(ids, x.id)) continue
    ids[x.id] = true
    const a: Abschnitt = { id: x.id, titel: kuerzen(x.titel, FELD_GRENZEN.titel) }
    const h = kuerzen(x.hilfe, FELD_GRENZEN.hilfe)
    if (h) a.hilfe = h
    aus.push(a)
    if (aus.length >= FELD_GRENZEN.abschnitte) break
  }
  return aus
}

function inAbschnitte(felder: FeldDef[], abschnitte: Abschnitt[]): FeldDef[] {
  if (!abschnitte.length) {
    return felder.map((f) => { const g = { ...f }; delete g.abschnitt; return g })
  }
  const pos: Record<string, number> = {}
  abschnitte.forEach((a, i) => { pos[a.id] = i })
  const mit = felder.map((f, i) => {
    const g = { ...f }
    if (!eigenes(pos, String(g.abschnitt))) g.abschnitt = abschnitte[0].id
    return { g, i }
  })
  mit.sort((a, b) => (pos[a.g.abschnitt as string] - pos[b.g.abschnitt as string]) || (a.i - b.i))
  return mit.map((x) => x.g)
}

// ── Standardformulare ─────────────────────────────────────────────────────

/**
 * Einstellung eines Standardformulars aus form_config.formulare.<formular> (Plan 1.2),
 * nachsichtig: Objekt, Text oder doppelt kodiert; Kaputtes ergibt die Vorgabe.
 * `reihenfolge` ist vollständig (fehlende Kernfelder in Katalogfolge, dann eigene).
 */
export function standardKonfig(cfg: unknown, f: StandardFormular): StandardKonfig {
  const G = FELD_GRENZEN
  const kern = eigenes(STANDARD_FELDER, f) ? STANDARD_FELDER[f] : []
  const alle = formConfigLesen(cfg).formulare
  const roh: Obj = istObjekt(alle) && eigenes(alle, f) && istObjekt(alle[f]) ? (alle[f] as Obj) : {}
  const version = versionsZahl(roh.version) ?? 0
  const kernIds: Record<string, true> = {}
  for (const k of kern) kernIds[k.id] = true
  const fr: Obj = istObjekt(roh.felder) ? roh.felder : {}
  const felder: StandardKonfig['felder'] = {}
  for (const k of kern) {
    if (!eigenes(fr, k.id) || !istObjekt(fr[k.id])) continue
    const x = fr[k.id] as Obj
    const e: StandardKonfig['felder'][string] = {}
    const label = kuerzen(x.label, G.label)
    if (label) e.label = label
    const hilfe = kuerzen(x.hilfe, G.hilfe)
    if (hilfe) e.hilfe = hilfe
    if (k.ausErlaubt && typeof x.aus === 'boolean') e.aus = x.aus
    if (k.pflichtWaehlbar && typeof x.pflicht === 'boolean') e.pflicht = x.pflicht
    if (Object.keys(e).length) felder[k.id] = e
  }
  const eigene: FeldDef[] = []
  const ids: Record<string, true> = {}
  for (const x of Array.isArray(roh.eigene) ? roh.eigene : []) {
    const d = feldLesen(x, false)
    if (!d || eigenes(kernIds, d.id) || eigenes(ids, d.id)) continue
    ids[d.id] = true
    eigene.push(d)
    if (eigene.length >= G.eigene_standard) break
  }
  const reihenfolge: string[] = []
  const drin: Record<string, true> = {}
  for (const id of Array.isArray(roh.reihenfolge) ? roh.reihenfolge : []) {
    if (typeof id !== 'string' || eigenes(drin, id) || !(eigenes(kernIds, id) || eigenes(ids, id))) continue
    drin[id] = true
    reihenfolge.push(id)
  }
  for (const k of kern) if (!eigenes(drin, k.id)) { drin[k.id] = true; reihenfolge.push(k.id) }
  for (const d of eigene) if (!eigenes(drin, d.id)) { drin[d.id] = true; reihenfolge.push(d.id) }
  return { v: 1, version, felder, reihenfolge, eigene }
}

/**
 * Bausteine eines Standardformulars in Formularfolge: Kernfelder mit Bezeichnung, Hilfetext,
 * Pflicht und aus nach der Einstellung, dazu die eigenen Felder. Ausgeblendete nur mit
 * `mitAusgeblendeten` (Feld-Editor). `pflicht` ist der eingestellte Wert; Pflicht gilt nie für
 * ausgeblendete Felder.
 */
export function bausteine(k: StandardKonfig, f: StandardFormular, o: { mitAusgeblendeten?: boolean } = {}): Baustein[] {
  const kern: Record<string, KernFeld> = {}
  for (const x of STANDARD_FELDER[f] || []) kern[x.id] = x
  const eigen: Record<string, FeldDef> = {}
  for (const d of k.eigene) eigen[d.id] = d
  const aus: Baustein[] = []
  for (const id of k.reihenfolge) {
    if (eigenes(kern, id)) {
      const kf2 = kern[id]
      const e = k.felder[id] || {}
      const ausgeblendet = kf2.ausErlaubt && e.aus === true
      if (ausgeblendet && !o.mitAusgeblendeten) continue
      const pflicht = kf2.pflichtWaehlbar && typeof e.pflicht === 'boolean' ? e.pflicht : kf2.pflichtVor
      aus.push({ art: 'kern', id, label: e.label || kf2.label, hilfe: e.hilfe || '', pflicht, aus: ausgeblendet, kern: kf2 })
    } else if (eigenes(eigen, id)) {
      const d = eigen[id]
      if (d.aus === true && !o.mitAusgeblendeten) continue
      aus.push({ art: 'eigen', feld: d })
    }
  }
  return aus
}

// ── Eigene Formulare ──────────────────────────────────────────────────────

/**
 * Schema einer Vorlage lesen (neue und alte Vorlagen): `vorlage` = { schema, abschnitte } (Liste
 * oder JSON-Text). Felder in Formularfolge; ohne Abschnitte gilt ein Abschnitt ohne Titel.
 */
export function schemaLesen(vorlage: unknown): VorlageSchema {
  const v: Obj = istObjekt(vorlage) ? vorlage : {}
  const abschnitte = abschnitteLesen(v.abschnitte)
  return { abschnitte, felder: inAbschnitte(feldListeLesen(v.schema, true, FELD_GRENZEN.felder), abschnitte) }
}

/**
 * Prüft ein Schema streng, wie der Server beim Speichern (alte Feldschlüssel werden übersetzt).
 * null = gültig, sonst { feld, text } (Grund ohne Punkt am Ende, wie in „Die Felder des Formulars
 * sind nicht gültig: {text}.“).
 */
export function schemaFehler(s: unknown): { feld: string; text: string } | null {
  const G = FELD_GRENZEN
  const fx = (feld: string, text: string) => ({ feld, text })
  const x: Obj = istObjekt(s) ? s : {}
  const abschnitte = x.abschnitte === undefined || x.abschnitte === null ? [] : x.abschnitte
  if (!Array.isArray(abschnitte)) return fx('abschnitte', 'Die Abschnitte sind unlesbar')
  if (abschnitte.length > G.abschnitte) return fx('abschnitte', 'Höchstens ' + G.abschnitte + ' Abschnitte')
  const aIds: Record<string, true> = {}
  for (let i = 0; i < abschnitte.length; i++) {
    const a = abschnitte[i]
    const n = i + 1
    if (!istObjekt(a)) return fx('abschnitte', 'Abschnitt ' + n + ' ist unlesbar')
    if (!kennungOk(a.id)) return fx('abschnitte', 'Abschnitt ' + n + ' hat keine gültige Kennung')
    if (eigenes(aIds, a.id)) return fx(a.id, 'Abschnitt ' + n + ': Kennung doppelt')
    aIds[a.id] = true
    const titel = typeof a.titel === 'string' ? a.titel.trim() : ''
    if (!titel) return fx(a.id, 'Abschnitt ' + n + ' hat keinen Titel')
    if (titel.length > G.titel) return fx(a.id, 'Titel von Abschnitt ' + n + ' ist zu lang, höchstens ' + G.titel + ' Zeichen')
    if (typeof a.hilfe === 'string' && a.hilfe.trim().length > G.hilfe) return fx(a.id, 'Hilfetext von Abschnitt ' + n + ' ist zu lang, höchstens ' + G.hilfe + ' Zeichen')
  }
  const felder = x.felder === undefined || x.felder === null ? [] : x.felder
  if (!Array.isArray(felder)) return fx('schema', 'Die Felder sind unlesbar')
  if (felder.length > G.felder) return fx('schema', 'Höchstens ' + G.felder + ' Felder')
  const ids: Record<string, true> = {}
  for (let i = 0; i < felder.length; i++) {
    const f = feldRoh(felder[i])
    const n = i + 1
    if (!istObjekt(f)) return fx('schema', 'Feld ' + n + ' ist unlesbar')
    if (!kennungOk(f.id)) return fx('schema', 'Feld ' + n + ' hat keine gültige Kennung')
    if (eigenes(ids, f.id)) return fx(f.id, 'Feld ' + n + ': Kennung doppelt')
    ids[f.id] = true
    if (!FELD_TYPEN.includes(f.typ as FeldTyp)) return fx(f.id, 'Feld ' + n + ' hat eine unbekannte Art')
    const label = typeof f.label === 'string' ? f.label.trim() : ''
    if (!label) return fx(f.id, 'Feld ' + n + ' hat keine Bezeichnung')
    if (label.length > G.label) return fx(f.id, 'Bezeichnung von Feld ' + n + ' ist zu lang, höchstens ' + G.label + ' Zeichen')
    if (typeof f.hilfe === 'string' && f.hilfe.trim().length > G.hilfe) return fx(f.id, 'Hilfetext von Feld ' + n + ' ist zu lang, höchstens ' + G.hilfe + ' Zeichen')
    if (f.typ === 'auswahl' || f.typ === 'mehrfach') {
      const opt = Array.isArray(f.optionen) ? f.optionen : []
      if (opt.length < G.optionen_min) return fx(f.id, 'Feld ' + n + ': Auswahl ohne Optionen, mindestens zwei')
      if (opt.length > G.optionen) return fx(f.id, 'Feld ' + n + ': höchstens ' + G.optionen + ' Optionen')
      const gesehen: Record<string, true> = {}
      for (let j = 0; j < opt.length; j++) {
        const t = typeof opt[j] === 'string' ? (opt[j] as string).trim() : ''
        if (!t || t.length > G.option) return fx(f.id, 'Feld ' + n + ': Option ' + (j + 1) + ' ist leer oder länger als ' + G.option + ' Zeichen')
        const k = t.toLowerCase()
        if (eigenes(gesehen, k)) return fx(f.id, 'Feld ' + n + ': Option doppelt')
        gesehen[k] = true
      }
    }
    if (f.typ === 'zahl') {
      if (typeof f.einheit === 'string' && f.einheit.trim().length > G.einheit) return fx(f.id, 'Einheit von Feld ' + n + ' ist zu lang, höchstens ' + G.einheit + ' Zeichen')
      const minDa = f.min !== undefined && f.min !== null
      const maxDa = f.max !== undefined && f.max !== null
      if ((minDa && !zahlOk(f.min)) || (maxDa && !zahlOk(f.max)) || (minDa && maxDa && (f.min as number) > (f.max as number))) {
        return fx(f.id, 'Feld ' + n + ': kleinster und größter Wert passen nicht')
      }
    }
    const ab = f.abschnitt
    if (abschnitte.length ? !eigenes(aIds, String(ab)) : (ab !== undefined && ab !== null && ab !== '')) {
      return fx(f.id, 'Feld ' + n + ' gehört zu keinem Abschnitt')
    }
  }
  return null
}

/** Absender-Art einer Vorlage: passwort, frei oder anonym; fehlt oder unbekannt: frei. */
export function vorlageModus(vorlage: unknown): VorlageModus {
  const a = istObjekt(vorlage) ? vorlage.absender : undefined
  return VORLAGE_MODI.includes(a as VorlageModus) ? (a as VorlageModus) : 'frei'
}

// ── Werte ─────────────────────────────────────────────────────────────────

/** Leer: fehlt, null, Text nur aus Leerzeichen, leere Liste. Nein (false) ist nicht leer. */
export function wertLeer(w: unknown): boolean {
  if (w === undefined || w === null) return true
  if (typeof w === 'string') return w.trim() === ''
  if (Array.isArray(w)) return w.length === 0
  return false
}

/** Ein (nicht leerer) Wert gegen sein Feld: { ok: true, wert } normalisiert, sonst { ok: false }. Wie wertPruefen im Server. */
export function wertPruefen(def: FeldDef, w: unknown): { ok: true; wert: Wert } | { ok: false } {
  const G = FELD_GRENZEN
  const NEIN = { ok: false as const }
  const ja = (x: Wert) => ({ ok: true as const, wert: x })
  if (!istObjekt(def)) return NEIN
  const opt = Array.isArray(def.optionen) ? def.optionen : []
  if (def.typ === 'text') {
    if (typeof w !== 'string') return NEIN
    const t = w.trim()
    return t.length <= G.text ? ja(t) : NEIN
  }
  if (def.typ === 'langtext') {
    if (typeof w !== 'string') return NEIN
    const t = w.replace(/\r\n?/g, '\n').trim()
    return t.length <= G.langtext ? ja(t) : NEIN
  }
  if (def.typ === 'zahl') {
    let n: unknown = w
    if (typeof w === 'string' && /^ *-?[0-9]+([.,][0-9]+)? *$/.test(w)) n = Number(w.trim().replace(',', '.'))
    if (!zahlOk(n)) return NEIN
    if (zahlOk(def.min) && n < def.min) return NEIN
    if (zahlOk(def.max) && n > def.max) return NEIN
    return ja(n === 0 ? 0 : n)
  }
  if (def.typ === 'datum') {
    return typeof w === 'string' && datumGueltig(w.trim()) ? ja(w.trim()) : NEIN
  }
  if (def.typ === 'uhrzeit') {
    return typeof w === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(w.trim()) ? ja(w.trim()) : NEIN
  }
  if (def.typ === 'auswahl') {
    if (typeof w !== 'string') return NEIN
    const t = w.trim()
    return opt.includes(t) ? ja(t) : NEIN
  }
  if (def.typ === 'mehrfach') {
    if (!Array.isArray(w) || w.length > G.mehrfach) return NEIN
    const gewaehlt: Record<string, true> = {}
    for (const x of w) {
      if (typeof x !== 'string') return NEIN
      const t = x.trim()
      if (!opt.includes(t) || eigenes(gewaehlt, t)) return NEIN
      gewaehlt[t] = true
    }
    return ja(opt.filter((o) => eigenes(gewaehlt, o)))
  }
  if (def.typ === 'janein') return typeof w === 'boolean' ? ja(w) : NEIN
  return NEIN
}

function einsetzen(text: string, wert: string): string {
  return text.replace('{label}', () => wert)
}

/** Text für ein Pflichtfeld ohne Wert: „Bitte „{Bezeichnung}“ ausfüllen.“ */
export function pflichtText(def: FeldDef): string {
  return einsetzen(FELD_TEXTE.pflicht, def.label || def.id)
}

/** '' oder „Bitte „{Bezeichnung}“ prüfen.“ (ein leerer Wert ist hier kein Fehler; Pflicht: pflichtFehlt). */
export function wertFehler(def: FeldDef, w: unknown): string {
  if (wertLeer(w)) return ''
  return wertPruefen(def, w).ok ? '' : einsetzen(FELD_TEXTE.wert, def.label || def.id)
}

/** Sichtbare Pflichtfelder ohne Wert, in Formularfolge. */
export function pflichtFehlt(defs: FeldDef[], werte: Record<string, unknown>): FeldDef[] {
  const w: Obj = istObjekt(werte) ? werte : {}
  return (Array.isArray(defs) ? defs : []).filter((d) => istObjekt(d) && d.aus !== true && d.pflicht === true && wertLeer(eigenes(w, d.id) ? w[d.id] : undefined))
}

/** Nur die gültigen, nicht leeren Werte sichtbarer Felder, normalisiert (so sendet die App). Wie im Server. */
export function werteBereinigen(defs: FeldDef[], werte: Record<string, unknown>): Record<string, Wert> {
  const aus: Record<string, Wert> = {}
  const w: Obj = istObjekt(werte) ? werte : {}
  for (const d of Array.isArray(defs) ? defs : []) {
    if (!istObjekt(d) || !kennungOk(d.id) || d.aus === true || !eigenes(w, d.id) || wertLeer(w[d.id])) continue
    const r = wertPruefen(d, w[d.id])
    if (r.ok) aus[d.id] = r.wert
  }
  return aus
}

function istWert(x: unknown): x is Wert {
  return typeof x === 'string' || typeof x === 'boolean' || (typeof x === 'number' && Number.isFinite(x)) ||
    (Array.isArray(x) && x.every((y) => typeof y === 'string'))
}

function werteLesen(roh: unknown): Record<string, Wert> {
  const aus: Record<string, Wert> = {}
  if (!istObjekt(roh)) return aus
  for (const k of Object.keys(roh)) if (kennungOk(k) && istWert(roh[k])) aus[k] = roh[k] as Wert
  return aus
}

function aelterLesen(roh: unknown): { id: string; wert: string }[] {
  return (Array.isArray(roh) ? roh : [])
    .filter((x): x is Obj => istObjekt(x) && typeof x.id === 'string' && typeof x.wert === 'string')
    .map((x) => ({ id: String(x.id).slice(0, 64), wert: String(x.wert).slice(0, FELD_GRENZEN.aelter_text) }))
    .slice(0, FELD_GRENZEN.aelter)
}

/**
 * Gespeicherte Angaben lesen (product_outputs payload.eigene, mpg_defect_reports.eigene, CIRS
 * payload.eigene); Objekt oder JSON-Text. null, wenn nichts Lesbares da ist. Ohne Schnappschuss
 * (CIRS-Rückfall ohne formular-regeln.js) ist `felder` leer: Bezeichnungen dann aus der
 * aktuellen Einstellung nehmen, sonst die Kennung.
 */
export function angabenLesen(roh: unknown): Angaben | null {
  const a = jsonLesen(roh)
  if (!istObjekt(a)) return null
  const felder = feldListeLesen(a.felder, true, FELD_GRENZEN.felder)
  const werte = werteLesen(a.werte)
  const aelter = aelterLesen(a.aelter)
  if (!felder.length && !Object.keys(werte).length && !aelter.length) return null
  const aus: Angaben = { v: 1, version: versionsZahl(a.version) ?? 0, felder, werte }
  if (aelter.length) aus.aelter = aelter
  return aus
}

function statusLesen(x: unknown): EinsendungStatus {
  return EINSENDUNG_STATUS.includes(x as EinsendungStatus) ? (x as EinsendungStatus) : 'neu'
}

/** Art eines unbekannten Werts einer alten Einsendung (nur für die Anzeige). */
function typAusWert(w: Wert): FeldTyp {
  if (typeof w === 'boolean') return 'janein'
  if (typeof w === 'number') return 'zahl'
  if (Array.isArray(w)) return 'mehrfach'
  return w.includes('\n') ? 'langtext' : 'text'
}

/**
 * Eine Einsendung (form_submissions) lesen, neue (payload.v 2, vom Server gebaut) und alte
 * (flacher payload { <feldId>: wert }, ohne Status und Absender). Alte Einsendungen bekommen die
 * Felder der aktuellen Vorlage (falls mitgegeben), unbekannte Kennungen die Kennung als
 * Bezeichnung. Fehlender Status zählt als „neu“.
 */
export function einsendungLesen(rec: Record<string, unknown>, vorlage?: unknown): Einsendung {
  const r: Obj = istObjekt(rec) ? rec : {}
  const p = jsonLesen(r.payload)
  const payload: Obj = istObjekt(p) ? p : {}
  const v: Obj = istObjekt(vorlage) ? vorlage : {}
  const b = jsonLesen(r.bearbeitung)
  const verlauf = (istObjekt(b) && Array.isArray(b.verlauf) ? b.verlauf : [])
    .filter(istObjekt)
    .map((x) => {
      const von = istObjekt(x.von) ? String(x.von.name || '') : ''
      const e: Einsendung['verlauf'][number] = { am: String(x.am || ''), von }
      if (typeof x.status === 'string' && x.status) e.status = x.status
      if (typeof x.notiz === 'boolean') e.notiz = x.notiz
      return e
    })
  const basis = {
    id: String(r.id || ''),
    vorlage: String(r.template_id || ''),
    angelegt: String(r.created || ''),
    status: statusLesen(r.status),
    notiz: typeof r.notiz === 'string' ? r.notiz : '',
    verlauf,
  }
  if (payload.v === 2) {
    const angaben: Einsendung['angaben'] = {
      v: 1,
      version: versionsZahl(payload.version) ?? 0,
      felder: feldListeLesen(payload.felder, true, FELD_GRENZEN.felder),
      werte: werteLesen(payload.werte),
      abschnitte: abschnitteLesen(payload.abschnitte),
    }
    const aelter = aelterLesen(payload.aelter)
    if (aelter.length) angaben.aelter = aelter
    return {
      ...basis,
      titel: kuerzen(payload.titel, FELD_GRENZEN.titel) || kuerzen(v.title, FELD_GRENZEN.titel) || 'Formular',
      angaben,
      absenderModus: VORLAGE_MODI.includes(payload.absender_modus as VorlageModus) ? (payload.absender_modus as VorlageModus) : 'frei',
      alt: false,
    }
  }
  const s = schemaLesen(vorlage)
  const werte = werteLesen(payload)
  const felder = s.felder.slice()
  const bekannt: Record<string, true> = {}
  for (const f of felder) bekannt[f.id] = true
  for (const k of Object.keys(werte)) {
    if (eigenes(bekannt, k)) continue
    const w = werte[k]
    const d: FeldDef = { id: k, typ: typAusWert(w), label: k }
    if (d.typ === 'mehrfach') d.optionen = (w as string[]).slice()
    if (s.abschnitte.length) d.abschnitt = s.abschnitte[s.abschnitte.length - 1].id
    felder.push(d)
  }
  return {
    ...basis,
    titel: kuerzen(v.title, FELD_GRENZEN.titel) || 'Formular',
    angaben: { v: 1, version: 0, felder, werte, abschnitte: s.abschnitte },
    absenderModus: 'frei',
    alt: true,
  }
}

function zahlDe(n: number): string {
  return String(n).replace('.', ',')
}

/** Ein Wert zum Anzeigen: „Ja“/„Nein“, Datum TT.MM.JJJJ, Mehrfach mit „, “, Zahl mit Komma und Einheit; leer ''. */
export function wertText(def: FeldDef | undefined, w: unknown): string {
  if (wertLeer(w)) return ''
  if (typeof w === 'boolean') return w ? 'Ja' : 'Nein'
  if (Array.isArray(w)) return w.map((x) => String(x)).join(', ')
  if (typeof w === 'number') return zahlDe(w) + (def?.einheit ? ' ' + def.einheit : '')
  const t = String(w)
  if (def?.typ === 'datum' && /^\d{4}-\d{2}-\d{2}$/.test(t.trim())) {
    const [j, m, d] = t.trim().split('-')
    return `${d}.${m}.${j}`
  }
  if (def?.typ === 'zahl' && def.einheit) return t + ' ' + def.einheit
  if (def?.typ === 'janein' && (t === 'true' || t === 'false')) return t === 'true' ? 'Ja' : 'Nein'
  return t
}

/** Neue Kennung: 'e_' (eigenes Feld eines Standardformulars), 'f_' (Feld eines eigenen Formulars), 'a_' (Abschnitt) + 8 × [a-z0-9]. */
export function neueFeldId(praefix: 'e' | 'f' | 'a'): string {
  const z = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const n = 8
  const zahlen = new Uint8Array(n)
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(zahlen)
  else for (let i = 0; i < n; i++) zahlen[i] = Math.floor(Math.random() * 256)
  let s = ''
  for (let i = 0; i < n; i++) s += z[zahlen[i] % z.length]
  return praefix + '_' + s
}
