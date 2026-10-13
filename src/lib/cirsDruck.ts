// CIRS zum Ausdrucken: eine Meldung mit ihrer Bearbeitung, und die Auswertung
// für die Besprechung im QM.
//
// Die Seiten entstehen als Text, damit ein Prüffall sie lesen kann. Name und
// Kontakt des Melders stehen nur darauf, wenn ausdrücklich gewünscht — ein
// Ausdruck verlässt den Raum, in dem die Meldung vertraulich war.

import { escapeHtml } from './aelrdDruck'
import {
  fallPrioritaet, fristUeberschritten, geltendeKategorie, geltendeSchwere, haeufigkeitName, istAbgeschlossen, istUeberfaellig, kategorieName,
  phaseName, schwereName, tagText, zeitText,
  type Auswertung, type CirsFall,
} from './cirs'

export interface Gedruckt {
  von?: string
  am: Date
}

const STIL = `
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Atkinson Hyperlegible','Helvetica Neue',Arial,sans-serif;color:#1a0e08;padding:32px;background:#fff;line-height:1.5;max-width:860px;margin:0 auto}
  h1{font-size:20px;color:#600812;font-style:italic;margin-bottom:2px}
  .unter{font-size:12px;font-style:italic;color:#8a7a68;margin-bottom:18px}
  h2{font-size:10px;font-weight:700;color:#600812;text-transform:uppercase;letter-spacing:0.14em;margin:22px 0 8px;padding-bottom:4px;border-bottom:0.5px solid rgba(96,8,18,0.2)}
  .raster{display:grid;grid-template-columns:150px 1fr;gap:4px 14px;font-size:13px}
  .raster dt{font-size:10px;font-weight:700;color:#8a7a68;text-transform:uppercase;letter-spacing:0.1em;padding-top:2px}
  .absatz{font-size:13px;margin-bottom:10px;white-space:pre-wrap}
  .absatz strong{display:block;font-size:10px;font-weight:700;color:#8a7a68;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;font-size:10px;font-weight:700;color:#8a7a68;text-transform:uppercase;letter-spacing:0.08em;padding:4px 6px;border-bottom:0.5px solid rgba(96,8,18,0.25)}
  td{padding:5px 6px;border-bottom:0.5px solid rgba(96,8,18,0.1);vertical-align:top}
  .erledigt{color:#166534;font-weight:700}
  .ueber{color:#b91c1c;font-weight:700}
  .still{font-style:italic;color:#8a7a68}
  .marke{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:2px 8px;border-radius:99px;border:0.5px solid currentColor}
  .ergebnis{border-left:3px solid #16a34a;background:rgba(22,163,74,0.06);padding:8px 12px;font-size:13px;white-space:pre-wrap}
  .zahlen{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:6px}
  .zahl{border:0.5px solid rgba(96,8,18,0.15);border-radius:8px;padding:10px 12px}
  .zahl b{display:block;font-size:26px;font-weight:800;color:#600812;line-height:1.1}
  .zahl span{font-size:11px;font-style:italic;color:#8a7a68}
  .balken{display:grid;grid-template-columns:170px 1fr 34px;gap:6px 10px;align-items:center;font-size:12px}
  .balken i{display:block;height:9px;background:#600812;border-radius:2px;min-width:1px}
  .balken .n{text-align:right;font-weight:700}
  .fuss{margin-top:36px;border-top:0.5px solid rgba(96,8,18,0.2);padding-top:10px;font-size:11px;font-style:italic;color:#8a7a68}
  .knopf{position:fixed;bottom:24px;right:24px;background:#600812;color:#fff;border:none;padding:12px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:0.06em}
  tr,.absatz,.ergebnis{page-break-inside:avoid}
  @media print{.knopf{display:none}body{padding:0}}
`

function seite(titel: string, inhalt: string, gedruckt: Gedruckt): string {
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(titel)}</title><style>${STIL}</style></head>
<body>
${inhalt}
<div class="fuss">Ausgedruckt ${escapeHtml(gedruckt.am.toLocaleString('de-DE'))}${gedruckt.von ? ` · ${escapeHtml(gedruckt.von)}` : ''} · vertraulich, nur für das Qualitätsmanagement</div>
<button class="knopf" onclick="window.print()">Drucken / PDF</button>
</body></html>`
}

function zeile(name: string, wert?: string | null): string {
  return wert ? `<dt>${escapeHtml(name)}</dt><dd>${escapeHtml(wert)}</dd>` : ''
}

function absatz(name: string, wert?: string): string {
  return wert ? `<div class="absatz"><strong>${escapeHtml(name)}</strong>${escapeHtml(wert)}</div>` : ''
}

/** Eine Meldung mit allem, was zu ihr gehört. */
export function cirsSeite(f: CirsFall, optionen: { mitMelder?: boolean; gedruckt: Gedruckt }): string {
  const { meldung: m, bearbeitung: b } = f
  const heute = optionen.gedruckt.am
  const prio = fallPrioritaet(f)
  const melder = optionen.mitMelder && (m.melder_name || m.melder_kontakt)
  const massnahmen = b.massnahmen.length
    ? `<table><thead><tr><th>Maßnahme</th><th>Verantwortlich</th><th>Frist</th><th>Stand</th></tr></thead><tbody>${
      b.massnahmen.map((x) => {
        // Wie in der Liste: an einer geschlossenen Meldung ist nichts mehr überfällig
        const ueber = !istAbgeschlossen(b.phase) && !x.erledigtAm && fristUeberschritten(x.frist, heute)
        return `<tr><td>${escapeHtml(x.text)}</td><td>${escapeHtml(x.verantwortlich ?? '')}</td><td${ueber ? ' class="ueber"' : ''}>${escapeHtml(tagText(x.frist))}</td><td>${
          x.erledigtAm ? `<span class="erledigt">erledigt</span> <span class="still">${escapeHtml(zeitText(x.erledigtAm))}${x.erledigtVon ? `, ${escapeHtml(x.erledigtVon)}` : ''}</span>` : ueber ? '<span class="ueber">überfällig</span>' : 'offen'
        }</td></tr>`
      }).join('')}</tbody></table>`
    : '<div class="still" style="font-size:13px">Keine Maßnahmen angelegt.</div>'
  const verlauf = b.verlauf.length
    ? `<table><thead><tr><th style="width:130px">Zeit</th><th style="width:150px">Wer</th><th>Was</th></tr></thead><tbody>${
      b.verlauf.map((e) => `<tr><td>${escapeHtml(zeitText(e.am))}</td><td>${escapeHtml(e.von)}</td><td>${escapeHtml(e.text)}</td></tr>`).join('')
    }</tbody></table>`
    : '<div class="still" style="font-size:13px">Noch nichts bearbeitet.</div>'
  const inhalt = `
<h1>CIRS-Meldung ${escapeHtml(f.nummer)}</h1>
<div class="unter">Eingegangen ${escapeHtml(zeitText(f.eingang))} · ${escapeHtml(phaseName(b.phase))}${istUeberfaellig(f, heute) ? ' · <span class="ueber">überfällig</span>' : ''}</div>

<h2>Ereignis</h2>
<dl class="raster">
  ${zeile('Datum', tagText(m.datum))}
  ${zeile('Ort', m.ort)}
  ${zeile('Kategorie (gemeldet)', kategorieName(m.kategorie))}
  ${zeile('Schweregrad (gemeldet)', schwereName(m.schwere))}
</dl>

<h2>Beschreibung des Melders</h2>
${absatz('Was ist passiert?', m.was)}
${absatz('Warum ist es passiert?', m.warum)}
${absatz('Folgen', m.folgen)}
${absatz('Vorschlag zur Vermeidung', m.vorschlag)}
${melder ? `<dl class="raster">${zeile('Melder', m.melder_name)}${zeile('Kontakt', m.melder_kontakt)}</dl>` : ''}

<h2>Bewertung und Zuständigkeit</h2>
<dl class="raster">
  ${zeile('Kategorie', kategorieName(geltendeKategorie(f)))}
  ${zeile('Schweregrad', schwereName(geltendeSchwere(f)))}
  ${zeile('Häufigkeit', b.bewertung.haeufigkeit ? haeufigkeitName(b.bewertung.haeufigkeit) : 'nicht eingeschätzt')}
  ${zeile('Priorität', prio ? prio.charAt(0).toUpperCase() + prio.slice(1) : '')}
  ${zeile('Zuständig', b.zustaendig?.name || 'niemand zugewiesen')}
  ${zeile('Frist', b.frist ? tagText(b.frist) : 'keine')}
</dl>

<h2>Maßnahmen</h2>
${massnahmen}

${istAbgeschlossen(b.phase) && b.abschluss ? `<h2>Ergebnis</h2>
<div class="ergebnis">${escapeHtml(b.abschluss.text)}</div>
<div class="still" style="font-size:11px;margin-top:4px">${escapeHtml(phaseName(b.phase))} ${escapeHtml(zeitText(b.abschluss.am))}${b.abschluss.von ? `, ${escapeHtml(b.abschluss.von)}` : ''}</div>` : ''}

<h2>Verlauf</h2>
${verlauf}
`
  return seite(`CIRS ${f.nummer}`, inhalt, optionen.gedruckt)
}

function balken(reihe: { name: string; anzahl: number }[]): string {
  const max = Math.max(1, ...reihe.map((r) => r.anzahl))
  return `<div class="balken">${reihe.map((r) =>
    `<div>${escapeHtml(r.name)}</div><div><i style="width:${r.anzahl ? Math.max(1, Math.round((r.anzahl / max) * 100)) : 0}%"></i></div><div class="n">${r.anzahl}</div>`).join('')}</div>`
}

/** Die Auswertung eines Zeitraums, mit der Liste der Meldungen darin. */
export function auswertungSeite(a: Auswertung, faelle: CirsFall[], optionen: { zeitraum: string; organisation?: string; gedruckt: Gedruckt }): string {
  const heute = optionen.gedruckt.am
  const liste = faelle.length
    ? `<table><thead><tr><th>Nummer</th><th>Eingang</th><th>Kategorie</th><th>Schwere</th><th>Phase</th><th>Ergebnis</th></tr></thead><tbody>${
      faelle.map((f) => `<tr><td>${escapeHtml(f.nummer)}</td><td>${escapeHtml(zeitText(f.eingang).slice(0, 10))}</td><td>${escapeHtml(kategorieName(geltendeKategorie(f)))}</td><td>${escapeHtml(schwereName(geltendeSchwere(f)))}</td><td${istUeberfaellig(f, heute) ? ' class="ueber"' : ''}>${escapeHtml(phaseName(f.bearbeitung.phase))}</td><td>${escapeHtml(istAbgeschlossen(f.bearbeitung.phase) ? f.bearbeitung.abschluss?.text ?? '' : '')}</td></tr>`).join('')
    }</tbody></table>`
    : '<div class="still" style="font-size:13px">Im Zeitraum ist keine Meldung eingegangen.</div>'
  const inhalt = `
<h1>CIRS-Auswertung</h1>
<div class="unter">${escapeHtml(optionen.zeitraum)}${optionen.organisation ? ` · ${escapeHtml(optionen.organisation)}` : ''}</div>

<div class="zahlen">
  <div class="zahl"><b>${a.gesamt}</b><span>Meldungen</span></div>
  <div class="zahl"><b>${a.offen}</b><span>in Bearbeitung${a.ueberfaellig ? `, davon ${a.ueberfaellig} überfällig` : ''}</span></div>
  <div class="zahl"><b>${a.abgeschlossen + a.keinHandlungsbedarf}</b><span>abgeschlossen${a.keinHandlungsbedarf ? `, davon ${a.keinHandlungsbedarf} ohne Handlungsbedarf` : ''}</span></div>
  <div class="zahl"><b>${a.mittlereDauerTage ?? '—'}</b><span>Tage bis zum Abschluss im Mittel</span></div>
</div>
<div class="still" style="font-size:12px">Maßnahmen: ${a.massnahmen.erledigt} von ${a.massnahmen.gesamt} erledigt</div>

<h2>Nach Kategorie</h2>
${balken(a.nachKategorie)}

<h2>Nach Schweregrad</h2>
${balken(a.nachSchwere)}

${a.nachMonat.length ? `<h2>Eingang nach Monat</h2>${balken(a.nachMonat)}` : ''}

<h2>Meldungen im Zeitraum</h2>
${liste}
`
  return seite('CIRS-Auswertung', inhalt, optionen.gedruckt)
}

/**
 * Die Seite in einem Fenster öffnen. Gibt zurück, ob es ging — ein
 * geblockter Aufruf darf nicht stillschweigend nichts tun.
 */
export function druckFensterOeffnen(html: string): boolean {
  const w = window.open('', '_blank', 'width=900,height=1100')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  return true
}
