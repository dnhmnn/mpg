// Werte früherer eigener Felder in Patientenprotokollen (Bauplan Vorgänge, B1, 4.5).
//
// Die Patientendokumentation ist fest (PO 2): niemand legt mehr eigene Felder an.
// Die alte Maske (/<org>/patienten-alt) schrieb sie bisher als `custom_<Zeitstempel>`
// oben in den payload; ihre Bezeichnung stand nur in
// `organizations.form_config.custom_fields`. Was so ausgefüllt wurde, bleibt im
// Protokoll stehen und soll in Ansicht, Druck und PDF sichtbar sein. Diese Datei
// sammelt die Werte und baut den Block für die Ausdrucke (escaped).
//
// Keine Imports aus React oder PocketBase: Prüffälle in
// src/lib/__tests__/patientenAltfelder.test.ts.

export type Altfeld = { id: string; label: string; wert: string }

/** Überschrift in Ansicht und Druck. */
export const ALTFELDER_TITEL = 'Weitere Angaben der Organisation'
/** Bezeichnung, wenn die Organisation das Feld nicht (mehr) beschreibt. */
export const ALTFELD_OHNE_NAME = 'Eigenes Feld'
/** Höchstens so viele Werte (ein kaputter payload soll keine Ansicht sprengen). */
const HOECHSTENS = 100

const CUSTOM_ID = /^custom_\d+$/

function lesen(roh: unknown): unknown {
  let w = roh
  for (let i = 0; i < 2 && typeof w === 'string'; i++) {
    try { w = JSON.parse(w) } catch { return null }
  }
  return w
}

function objekt(roh: unknown): Record<string, unknown> | null {
  const w = lesen(roh)
  return w && typeof w === 'object' && !Array.isArray(w) ? w as Record<string, unknown> : null
}

type Def = { id: string; label: string; fieldType: string }

/** Die beschriebenen eigenen Felder aus `form_config` (Objekt, Text oder doppelt kodiert). */
function definitionen(formConfig: unknown): Def[] {
  const cfg = objekt(formConfig)
  const liste = cfg && Array.isArray(cfg.custom_fields) ? cfg.custom_fields : []
  const aus: Def[] = []
  for (const x of liste) {
    const f = x && typeof x === 'object' ? x as Record<string, unknown> : null
    const id = f && typeof f.id === 'string' ? f.id.trim() : ''
    if (!id || id.length > 100 || aus.some((d) => d.id === id)) continue
    aus.push({
      id,
      label: typeof f!.label === 'string' ? f!.label.trim() : '',
      fieldType: typeof f!.fieldType === 'string' ? f!.fieldType : '',
    })
  }
  return aus
}

/** Wie viele eigene Felder die Organisation früher für die Patientendoku angelegt hatte. */
export function frueherEigeneFelder(formConfig: unknown): number {
  return definitionen(formConfig).length
}

function datumDeutsch(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s
}

/** Ein Wert als Text; leer heißt: nicht zeigen. `false` (Häkchen nicht gesetzt) zählt als leer. */
function wertText(w: unknown, typ: string): string {
  if (w === true) return 'Ja'
  if (w === false || w === null || w === undefined) return ''
  if (typeof w === 'number') return Number.isFinite(w) ? String(w).replace('.', ',') : ''
  if (typeof w === 'string') {
    const t = w.trim()
    if (!t) return ''
    if (typ === 'checkbox' && (t === 'true' || t === 'on')) return 'Ja'
    if (typ === 'checkbox' && t === 'false') return ''
    return typ === 'date' ? datumDeutsch(t) : t
  }
  if (Array.isArray(w)) return w.map((x) => wertText(x, '')).filter(Boolean).join(', ')
  return ''
}

/**
 * Die Werte früherer eigener Felder eines Protokolls: alle Schlüssel
 * `custom_<Ziffern>` und alle Kennungen aus `custom_fields`, sofern ausgefüllt.
 * Reihenfolge: erst wie in `custom_fields`, dann die übrigen nach ihrer Nummer
 * (dem Zeitpunkt des Anlegens). Bezeichnung aus `custom_fields`, sonst
 * „Eigenes Feld“. `true` wird „Ja“, `false` und Leeres fallen weg.
 */
export function altfelder(payload: unknown, formConfig?: unknown): Altfeld[] {
  const p = objekt(payload)
  if (!p) return []
  const defs = definitionen(formConfig)
  const ids: string[] = []
  for (const d of defs) if (d.id in p) ids.push(d.id)
  const uebrige = Object.keys(p)
    .filter((k) => CUSTOM_ID.test(k) && !ids.includes(k))
    .sort((a, b) => {
      const na = Number(a.slice(7)); const nb = Number(b.slice(7))
      return na === nb ? a.localeCompare(b) : na - nb
    })
  const aus: Altfeld[] = []
  for (const id of [...ids, ...uebrige]) {
    if (aus.length >= HOECHSTENS) break
    const d = defs.find((x) => x.id === id)
    const wert = wertText(p[id], d?.fieldType ?? '')
    if (!wert) continue
    aus.push({ id, label: d?.label || ALTFELD_OHNE_NAME, wert })
  }
  return aus
}

function html(x: unknown): string {
  return String(x ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Der Block für die Ausdrucke (Patientenverwaltung, PDF-Ansicht): eigene Seite,
 * eine Zeile je Wert, jeder Text HTML-sicher. Leer ohne Werte.
 * `klein`: für den alten Ausdruck mit seinen kleinen Schriftgrößen.
 */
export function altfelderHtml(liste: Altfeld[], o: { klein?: boolean } = {}): string {
  if (!liste.length) return ''
  const gross = o.klein ? { titel: '8pt', text: '6.5pt', pad: '1.5pt 3pt' } : { titel: '13pt', text: '10.5pt', pad: '5px 8px' }
  // Schriftgröße und Schreibweise ausdrücklich: die Blätter setzen th und td sonst klein und in Versalien
  const zelle = `vertical-align:top;padding:${gross.pad};border:0.5pt solid #bbb;font-size:${gross.text};text-transform:none;letter-spacing:normal;color:#000`
  const zeilen = liste.map((f) =>
    `<tr><th style="${zelle};text-align:left;font-weight:bold;width:34%;background:#f2f2f2">${html(f.label)}</th>`
    + `<td style="${zelle};white-space:pre-wrap;overflow-wrap:anywhere">${html(f.wert)}</td></tr>`,
  ).join('')
  return `<section class="altfelder" style="page-break-before:always;break-before:page;max-width:794px;margin:0 auto;padding:${o.klein ? '3.5mm 5mm' : '36px 40px'};box-sizing:border-box;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif">`
    + `<h2 style="font-size:${gross.titel};margin:0 0 8px">${html(ALTFELDER_TITEL)}</h2>`
    + `<table style="width:100%;border-collapse:collapse;font-size:${gross.text}">${zeilen}</table>`
    + '</section>'
}

/** Den Block vor `</body>` eines fertigen Blatts setzen; ohne Werte unverändert. */
export function mitAltfeldern(dokument: string, liste: Altfeld[], o: { klein?: boolean } = {}): string {
  const block = altfelderHtml(liste, o)
  if (!block) return dokument
  const i = dokument.lastIndexOf('</body>')
  return i < 0 ? dokument + block : dokument.slice(0, i) + block + dokument.slice(i)
}
