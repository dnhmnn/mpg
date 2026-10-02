// Ausdruck des DIVI-Notfalleinsatzprotokolls 7.1 — genau zwei DIN-A4-Seiten.
//
// Der Vordruck der DIVI ist eine A3-Seite quer. Auf Papier faltet man sie;
// wir drucken sie als das, was sie inhaltlich ist: Vorderseite auf Blatt 1,
// Rueckseite auf Blatt 2. Beides entsteht aus dem Feldkatalog, damit Maske
// und Ausdruck nicht auseinanderlaufen koennen.

import {
  DIVI_VERSION,
  MEDIKATION_SPALTEN,
  VERLAUF_SPALTEN,
  rasterDerSeite,
  type Abschnitt,
  type Feld,
  type Gruppe,
} from '../katalog/divi'

export type Payload = Record<string, unknown>

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

function kaestchen(text: string, an: boolean, hinweis?: string): string {
  const klasse = an ? 'kast an' : 'kast'
  const zusatz = hinweis ? ` <span class="klein">(${escapeHtml(hinweis)})</span>` : ''
  return `<span class="${klasse}"><span class="box">${an ? '×' : ''}</span>${escapeHtml(text)}${zusatz}</span>`
}

/** Wiederholt die Feldbeschriftung nur die Zwischenueberschrift? Dann weg damit. */
function istWiederholung(label: string, gruppentitel?: string): boolean {
  if (!gruppentitel) return false
  const norm = (t: string) => t.toLowerCase().replace(/[^a-zäöüß]/g, '')
  return norm(label) === norm(gruppentitel)
}

function feldHtml(feld: Feld, payload: Payload, gruppentitel?: string): string {
  const wert = payload[feld.id]
  const beschriftung = istWiederholung(feld.label, gruppentitel) ? '' : feld.label

  if (feld.typ === 'verlauf') return verlaufHtml(payload)
  if (feld.typ === 'medikation') return medikationHtml(payload)

  if (feld.typ === 'check') {
    return `<div class="feld">${kaestchen(feld.label, Boolean(wert), feld.hinweis)}</div>`
  }

  if (feld.optionen && feld.optionen.length > 0) {
    const boxen = feld.optionen
      .map((o) => kaestchen(o.text, istGewaehlt(wert, o.wert), o.hinweis))
      .join('')
    return `<div class="feld"><span class="lbl">${escapeHtml(beschriftung)}</span><span class="boxen">${boxen}</span></div>`
  }

  if (feld.typ === 'skala') {
    const stufen: string[] = []
    for (let i = feld.min ?? 0; i <= (feld.max ?? 10); i++) {
      stufen.push(`<span class="stufe${String(wert) === String(i) ? ' an' : ''}">${i}</span>`)
    }
    return `<div class="feld"><span class="lbl">${escapeHtml(beschriftung)}</span><span class="skala">${stufen.join('')}</span></div>`
  }

  const text = wert === undefined || wert === null || wert === '' ? '' : String(wert)
  const einheit = text && feld.einheit ? ` <span class="klein">${escapeHtml(feld.einheit)}</span>` : ''
  const klasse = feld.typ === 'langtext' ? 'feld lang' : 'feld'
  return `<div class="${klasse}"><span class="lbl">${escapeHtml(beschriftung)}</span><span class="wert">${escapeHtml(text)}${einheit}</span></div>`
}

function verlaufHtml(payload: Payload): string {
  const zeilenRoh = payload.verlauf
  const zeilen = Array.isArray(zeilenRoh) ? (zeilenRoh as Payload[]) : []
  // Der Papiervordruck hat feste Spalten. Leere Zeilen bleiben zum Nachtragen.
  const anzahl = Math.max(zeilen.length, 10)
  const kopf = VERLAUF_SPALTEN.map(
    (s) => `<th class="${s.typ === 'check' ? 'schmal' : ''}">${escapeHtml(s.label)}</th>`,
  ).join('')
  const koerper = Array.from({ length: anzahl }, (_, i) => {
    const z = zeilen[i] ?? {}
    const zellen = VERLAUF_SPALTEN.map((s) => {
      const w = z[s.id]
      if (s.typ === 'check') return `<td class="schmal">${w ? '×' : ''}</td>`
      return `<td>${escapeHtml(w === undefined || w === null ? '' : w)}</td>`
    }).join('')
    return `<tr>${zellen}</tr>`
  }).join('')
  return `<table class="gitter"><thead><tr>${kopf}</tr></thead><tbody>${koerper}</tbody></table>`
}

function medikationHtml(payload: Payload): string {
  const roh = payload.medikation ?? payload.medications
  const zeilen = Array.isArray(roh) ? (roh as Payload[]) : []
  const anzahl = Math.max(zeilen.length, 8)
  const kopf = MEDIKATION_SPALTEN.map((s) => `<th>${escapeHtml(s.label)}</th>`).join('')
  const koerper = Array.from({ length: anzahl }, (_, i) => {
    const z = zeilen[i] ?? {}
    const zellen = MEDIKATION_SPALTEN.map((s) => `<td>${escapeHtml(z[s.id] ?? z[s.id === 'wirkstoff' ? 'name' : s.id] ?? '')}</td>`).join('')
    return `<tr>${zellen}</tr>`
  }).join('')
  return `<table class="gitter"><thead><tr>${kopf}</tr></thead><tbody>${koerper}</tbody></table>`
}

function gruppeHtml(gruppe: Gruppe, payload: Payload): string {
  const titel = gruppe.titel ? `<div class="gtitel">${escapeHtml(gruppe.titel)}</div>` : ''
  return `${titel}<div class="raster">${gruppe.felder.map((f) => feldHtml(f, payload, gruppe.titel)).join('')}</div>`
}

function abschnittHtml(abschnitt: Abschnitt, payload: Payload): string {
  return `<section class="abschnitt"><h2>${escapeHtml(abschnitt.titel)}</h2>${abschnitt.gruppen
    .map((g) => gruppeHtml(g, payload))
    .join('')}</section>`
}

/** Eine Seite als das Raster des Vordrucks: Baender, darin Saeulen. */
function rasterHtml(seite: 1 | 2, payload: Payload): string {
  return rasterDerSeite(seite)
    .map(
      (band) =>
        `<div class="band">${band.saeulen
          .map(
            (saeule) =>
              `<div class="saeule s${saeule.spanne}">${saeule.abschnitte
                .map((a) => abschnittHtml(a, payload))
                .join('')}</div>`,
          )
          .join('')}</div>`,
    )
    .join('')
}

const STIL = `
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:Arial,Helvetica,sans-serif;font-size:4.4pt;line-height:1.2;color:#000;background:#fff}
@page{size:A4 portrait;margin:5mm}
.seite{width:200mm;margin:0 auto}
.seite + .seite{page-break-before:always}
.kopf{display:flex;justify-content:space-between;align-items:center;border:0.8pt solid #000;padding:1.5pt 4pt;margin-bottom:1.5pt}
.kopf .titel{font-size:7pt;font-weight:bold;letter-spacing:.5pt;text-transform:uppercase}
.kopf .meta{font-size:4.4pt;color:#333}
.band{display:flex;align-items:stretch;gap:1.2pt;margin-bottom:1.2pt}
.saeule{display:flex;flex-direction:column;gap:1.2pt;min-width:0}
.s3{width:25%}.s4{width:33.333%}.s5{width:41.666%}.s6{width:50%}.s8{width:66.666%}.s12{width:100%}
.abschnitt{border:0.4pt solid #666;break-inside:avoid}
.abschnitt h2{font-size:4.6pt;font-weight:bold;text-transform:uppercase;letter-spacing:.3pt;background:#dcdcdc;border-bottom:0.4pt solid #888;padding:0.6pt 2pt}
.gtitel{font-size:4.1pt;font-weight:bold;text-transform:uppercase;letter-spacing:.25pt;color:#333;padding:0.8pt 2pt 0;border-top:0.3pt dotted #bbb}
.raster{padding:0.6pt 2pt 1.2pt}
.feld{display:flex;align-items:baseline;gap:2pt;padding:0.25pt 0}
.feld.lang{display:block}
.lbl{flex:0 0 auto;max-width:45%;font-size:3.9pt;text-transform:uppercase;letter-spacing:.2pt;color:#555}
.wert{flex:1 1 auto;min-width:0;font-size:5pt;font-weight:bold;min-height:5.4pt;border-bottom:0.3pt dotted #999;word-break:break-word}
.feld.lang .lbl{display:block;max-width:100%;margin-bottom:0.6pt}
.lang .wert{display:block;min-height:13pt;white-space:pre-wrap;font-weight:normal;font-size:4.6pt;border-bottom:none;border:0.3pt dotted #999;padding:1pt}
.boxen{flex:1 1 auto;min-width:0}
.kast{display:inline-block;margin:0.2pt 2.5pt 0.2pt 0;font-size:4.1pt}
.kast .box{display:inline-block;width:4pt;height:4pt;border:0.4pt solid #333;margin-right:1pt;text-align:center;line-height:3.8pt;font-size:3.8pt;font-weight:bold;vertical-align:-0.3pt}
.kast.an{font-weight:bold}
.kast.an .box{background:#000;color:#fff;border-color:#000}
.klein{font-size:3.5pt;color:#555;font-weight:normal}
.skala{flex:1 1 auto}
.skala .stufe{display:inline-block;width:6.5pt;text-align:center;border:0.4pt solid #333;margin-right:0.6pt;font-size:4.2pt}
.skala .stufe.an{background:#000;color:#fff}
table.gitter{width:100%;border-collapse:collapse;margin:0.8pt 0}
table.gitter th{background:#e4e4e4;border:0.3pt solid #888;font-size:3.6pt;text-transform:uppercase;letter-spacing:.15pt;padding:0.6pt 1pt}
table.gitter td{border:0.3pt solid #bbb;font-size:4.4pt;height:7pt;padding:0.3pt 1pt;text-align:center}
table.gitter .schmal{width:5.5%}
.fuss{display:flex;justify-content:space-between;font-size:3.8pt;color:#444;margin-top:1.5pt;border-top:0.3pt solid #999;padding-top:1pt}
.knopf{position:fixed;bottom:16px;right:16px;background:#600812;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:bold;cursor:pointer;font-family:inherit}
@media print{.knopf{display:none}}
`

export type Kopfdaten = {
  organisation?: string
  erstellt?: string
}

/** Das vollstaendige Druckdokument: Seite 1 Vorderseite, Seite 2 Rueckseite. */
export function diviDruckHtml(payload: Payload, kopf: Kopfdaten = {}): string {
  const erstellt = kopf.erstellt ?? new Date().toLocaleString('de-DE')
  const org = kopf.organisation ? ` · ${escapeHtml(kopf.organisation)}` : ''

  const seite = (nr: 1 | 2, beschriftung: string) => `
    <div class="seite">
      <div class="kopf">
        <div class="titel">Notfall-Einsatzprotokoll</div>
        <div class="meta">Version ${DIVI_VERSION} · ${beschriftung} · Erstellt: ${escapeHtml(erstellt)}${org}</div>
        <div class="titel">Seite ${nr} / 2</div>
      </div>
      ${rasterHtml(nr, payload)}
      <div class="fuss"><span>Empfehlung der DIVI — Notfall-Einsatzprotokoll Version ${DIVI_VERSION}</span><span>Seite ${nr} von 2</span></div>
    </div>`

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>DIVI Notfall-Einsatzprotokoll ${DIVI_VERSION}</title><style>${STIL}</style></head><body>
${seite(1, 'Vorderseite')}
${seite(2, 'Rückseite')}
<button class="knopf" onclick="window.print()">Drucken / PDF</button>
</body></html>`
}

/** Oeffnet den Ausdruck in einem neuen Fenster. Gibt false zurueck, wenn der Browser blockt. */
export function diviDrucken(payload: Payload, kopf: Kopfdaten = {}): boolean {
  const fenster = window.open('', '_blank', 'width=1000,height=750')
  if (!fenster) return false
  fenster.document.write(diviDruckHtml(payload, kopf))
  fenster.document.close()
  return true
}
