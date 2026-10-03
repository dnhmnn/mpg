// Ausdruck des Einsatzprotokolls im Layout des bayerischen ÄLRD-Bogens
// (NIDA/medDV, "EINSATZPROTOKOLL - RD Bayern").
//
// Der Bogen ist kein freies Layout, sondern ein festes Raster: jeder Block
// sitzt auf einer festen Position des A4-Blattes. Deshalb arbeitet dieses
// Modul mit absoluten Punktkoordinaten statt mit Fluss-Layout — nur so
// kommt der Ausdruck wirklich 1:1 heraus.
//
// Die Koordinaten stammen aus der Vermessung der Vorlage (A4, 595,32 x 841,92 pt).
// Die Felder kommen aus dem DIVI-7.1-Katalog; wo der Bogen ein Feld zeigt,
// das 7.1 anders nennt, steht die Zuordnung an der jeweiligen Stelle.

import { aelrdFeld } from '../katalog/aelrd'

export type Payload = Record<string, unknown>

// ── Masse der Vorlage ────────────────────────────────────────────────────
/** Blattmasse in Punkt. */
export const BLATT = { breite: 595.32, hoehe: 841.92 }

/** Gemessene Gestaltungswerte der Vorlage. */
export const MASS = {
  rahmen: 0.72,      // Hauptrahmen der Bloecke
  linie: 0.24,       // feine Trennlinien
  ueberschrift: 7.4, // Block-Ueberschrift
  beschriftung: 5.2, // Feldbeschriftung
  klein: 4.4,        // kleinste Beschriftung, meist rechts am Feld
  option: 5.2,       // Optionstexte
  wert: 8.0,         // eingetragener Wert, fett
  wertGross: 9.6,    // hervorgehobener Wert, fett
}

export function escapeHtml(wert: unknown): string {
  return String(wert ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Ist diese Option im Protokoll angekreuzt? */
export function istGewaehlt(wert: unknown, option: string): boolean {
  if (Array.isArray(wert)) return wert.map(String).includes(option)
  return String(wert ?? '') === option
}

export type Kasten = { x: number; y: number; b: number; h: number }

/** Ein Block auf fester Position. */
export function block(kasten: Kasten, inhalt: string, randlos = false): string {
  const rahmen = randlos ? 'none' : `${MASS.rahmen}pt solid #000`
  return `<div class="blk" style="left:${kasten.x}pt;top:${kasten.y}pt;width:${kasten.b}pt;height:${kasten.h}pt;border:${rahmen}">${inhalt}</div>`
}

/** Block-Ueberschrift, wie auf dem Bogen: normal gesetzt, nicht fett. */
export function ueberschrift(text: string): string {
  return `<div class="ueb">${escapeHtml(text)}</div>`
}

/**
 * Das Gestaltungsprinzip des Bogens: der eingetragene Wert steht gross und
 * fett, seine Beschriftung klein und rechtsbuendig daneben. Leere Felder
 * zeigen nur die Beschriftung — so wie der Bogen auch leer gedruckt wird.
 */
export function wertZeile(wert: unknown, beschriftung: string, gross = false): string {
  const text = wert === undefined || wert === null || wert === '' ? '' : String(wert)
  const groesse = gross ? MASS.wertGross : MASS.wert
  return `<div class="wz"><span class="wz-w" style="font-size:${groesse}pt">${escapeHtml(text)}</span><span class="wz-b">${escapeHtml(beschriftung)}</span></div>`
}

/** Ein Wert in einem umrandeten Kaestchen mit Beschriftung darunter — die Zeitenleiste. */
export function wertKasten(wert: unknown, beschriftung: string): string {
  const text = wert === undefined || wert === null || wert === '' ? '' : String(wert)
  return `<div class="wk"><span class="wk-b">${escapeHtml(beschriftung)}</span><span class="wk-w">${escapeHtml(text)}</span></div>`
}

/** Eine Option: runder Knopf fuer Einfachwahl, eckiges Kaestchen fuer Mehrfachwahl. */
export function option(text: string, an: boolean, rund = true): string {
  return `<span class="opt"><span class="${rund ? 'kreis' : 'eck'}${an ? ' an' : ''}"></span>${escapeHtml(text)}</span>`
}

/**
 * Eine Optionsreihe aus einem Katalogfeld. Der Bogen zeigt immer alle
 * Optionen — auch die nicht gewaehlten, sonst stuende im Protokoll eine
 * andere Auswahl als vor Ort zur Wahl stand.
 */
export function optionen(feldId: string, payload: Payload): string {
  const feld = aelrdFeld(feldId)
  if (!feld || !feld.optionen) return ''
  const wert = payload[feldId]
  // Der Bogen zeichnet durchweg runde Knoepfe, auch wo mehrere Optionen
  // zugleich gelten duerfen. Die Form folgt dem Papier, nicht der Technik.
  const inhalt = feld.optionen.map((o) => option(o.text, istGewaehlt(wert, o.wert), true)).join('')
  return `<div class="opts">${inhalt}</div>`
}

/**
 * Ein Optionsraster, Reihe fuer Reihe wie auf dem Bogen. Die Reihen des
 * Vordrucks sind nicht gleichmaessig gefuellt — manche beginnen erst in
 * Spalte 2 —, deshalb werden sie hier ausgeschrieben statt umgebrochen.
 * null laesst eine Rasterzelle frei.
 */
export function raster(feldId: string, payload: Payload, reihen: (string | null)[][]): string {
  const feld = aelrdFeld(feldId)
  if (!feld || !feld.optionen) return ''
  const wert = payload[feldId]
  const spalten = Math.max(...reihen.map((r) => r.length))
  const zellen = reihen
    .map((reihe) =>
      reihe
        .map((text) => {
          if (text === null) return '<span class="zelle"></span>'
          const o = feld.optionen?.find((k) => k.text === text)
          if (!o) return `<span class="zelle">${escapeHtml(text)}</span>`
          return `<span class="zelle">${option(o.text, istGewaehlt(wert, o.wert), true)}</span>`
        })
        .join(''),
    )
    .join('')
  return `<div class="rst" style="grid-template-columns:repeat(${spalten},auto)">${zellen}</div>`
}

/** Beschriftete Optionsreihe: Beschriftung links, Optionen rechts daneben. */
export function optionsZeile(beschriftung: string, feldId: string, payload: Payload, reihen?: (string | null)[][]): string {
  const inhalt = reihen ? raster(feldId, payload, reihen) : optionen(feldId, payload)
  return `<div class="oz"><span class="oz-b">${escapeHtml(beschriftung)}</span><span class="oz-o">${inhalt}</span></div>`
}

/** Die Schmerzskala des Bogens: eine Reihe verbundener Knoepfe von 0 bis 10. */
export function schmerzskala(feldId: string, payload: Payload): string {
  const wert = payload[feldId]
  const knoepfe = Array.from({ length: 11 }, (_, i) =>
    `<span class="sk-p${String(wert) === String(i) ? ' an' : ''}"></span>`,
  ).join('')
  return `<div class="sk">${knoepfe}<div class="sk-z"><span>0</span><span>5</span><span>10</span></div></div>`
}

/** Ein Messwert in der Werteleiste: grosse fette Zahl, Beschriftung darueber, Einheit dahinter. */
export function messwert(beschriftung: string, wert: unknown, einheit: string): string {
  const text = wert === undefined || wert === null || wert === '' ? '' : String(wert)
  return `<div class="mw"><span class="mw-b">${escapeHtml(beschriftung)}</span><span class="mw-w">${escapeHtml(text)}</span><span class="mw-e">${escapeHtml(einheit)}</span></div>`
}

export const STIL = `
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{background:#fff}
body{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:${MASS.option}pt;line-height:1.25}
@page{size:A4 portrait;margin:0}
.blatt{position:relative;width:${BLATT.breite}pt;height:${BLATT.hoehe}pt;overflow:hidden;background:#fff}
.blatt + .blatt{page-break-before:always}
.blk{position:absolute;overflow:hidden}
.ueb{font-size:${MASS.ueberschrift}pt;padding:0.6pt 3pt 0;letter-spacing:0.02em;line-height:1.15}

/* Wert gross und fett, Beschriftung klein und rechts — das Kennzeichen des Bogens. */
.wz{display:flex;align-items:baseline;justify-content:space-between;gap:3pt;padding:0.2pt 3pt;border-bottom:${MASS.linie}pt solid #000;line-height:1.1}
.wz-w{font-weight:bold;min-height:8.6pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wz-b{font-size:${MASS.klein}pt;white-space:nowrap;flex-shrink:0}

.wk{display:flex;align-items:center;gap:3pt;padding:0.3pt 2pt}
.wk-b{font-size:${MASS.beschriftung}pt;width:52pt;flex-shrink:0}
.wk-w{display:inline-block;font-size:${MASS.beschriftung}pt;font-weight:bold;border:${MASS.rahmen}pt solid #000;padding:0 4pt;min-width:48pt;height:8.4pt;line-height:7pt;text-align:center;margin-left:auto}

.opt{display:inline-flex;align-items:center;gap:1.4pt;font-size:${MASS.option}pt;margin-right:4pt;white-space:nowrap;line-height:1.25}
.kreis{display:inline-block;width:3.6pt;height:3.6pt;flex-shrink:0;border-radius:50%;border:${MASS.linie * 2}pt solid #000}
.kreis.an{background:#000}
.eck{display:inline-block;width:3.6pt;height:3.6pt;flex-shrink:0;border:${MASS.linie * 2}pt solid #000}
.eck.an{background:#000}
.opts{padding:0.5pt 3pt}
.oz{display:flex;align-items:baseline;gap:4pt;padding:0.5pt 3pt}
.oz-b{font-size:${MASS.beschriftung}pt;flex-shrink:0}
.oz-o{flex:1 1 auto;min-width:0}
.oz-o .opts{padding:0}
.rst{display:grid;column-gap:2pt;row-gap:0;align-items:baseline;min-width:0}
.zelle{display:flex;align-items:center;white-space:nowrap;min-width:0;overflow:hidden;line-height:1}
.zelle{display:block;white-space:nowrap;min-width:0}
.rst .opt{margin-right:0}

.sk{padding:1pt 3pt}
.sk-p{display:inline-block;width:4.4pt;height:4.4pt;border-radius:50%;border:${MASS.linie * 2}pt solid #000;margin-right:3pt}
.sk-p.an{background:#000}
.sk-z{display:flex;justify-content:space-between;width:81pt;font-size:${MASS.klein}pt}

.mw{display:inline-flex;flex-direction:column;align-items:flex-start;border-right:${MASS.linie}pt solid #000;padding:0.5pt 4pt;min-width:40pt}
.mw-b{font-size:${MASS.klein}pt}
.mw-w{font-size:${MASS.wertGross}pt;font-weight:bold;min-height:${MASS.wertGross}pt}
.mw-e{font-size:${MASS.klein}pt}

.kopf{position:absolute;left:24pt;top:3pt;width:529pt;display:flex;justify-content:space-between;align-items:baseline;font-size:${MASS.beschriftung}pt;gap:8pt}
.kopf .zeile{flex:1 1 0;display:flex;gap:3pt;align-items:baseline}
.kopf .zeile b{flex:1 1 auto;min-height:7pt}
.kopf .stempel{font-size:8.9pt;font-weight:bold}
/* Freitextflaechen bleiben leer, wie auf dem Vordruck — keine Schreiblinien. */
.linien{position:relative}
.linien > .lz{height:8.44pt}
.linien > .inhalt{position:absolute;left:0;right:0;top:0;padding:0 1pt;white-space:pre-wrap}
.knopf{position:fixed;bottom:16px;right:16px;background:#600812;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:bold;cursor:pointer;font-family:inherit;z-index:99}
@media print{/* Freitextflaechen bleiben leer, wie auf dem Vordruck — keine Schreiblinien. */
.linien{position:relative}
.linien > .lz{height:8.44pt}
.linien > .inhalt{position:absolute;left:0;right:0;top:0;padding:0 1pt;white-space:pre-wrap}
.knopf{display:none}}
`

/**
 * Eine beschreibbare Fläche. Sie hält die Zeilenhöhe des Bogens, bleibt aber
 * ohne Linien — der Vordruck lässt diese Felder leer, und der eingetragene
 * Text soll auf dem Papier für sich stehen.
 */
export function schreibflaeche(text: string, zeilen: number, klasse = ''): string {
  const linien = Array.from({ length: zeilen }, () => '<div class="lz"></div>').join('')
  return `<div class="linien ${klasse}">${linien}<div class="inhalt">${escapeHtml(text)}</div></div>`
}
