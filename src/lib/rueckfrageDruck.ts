// Rückfragen und Stellungnahmen zum Ausdrucken.
//
// Was der Beauftragte gefragt und der Teamführer geantwortet hat, gehört zum
// Protokoll — und manchmal in die Akte. Die Seite entsteht deshalb hier,
// einmal, als Text: so kann ein Prüffall sie lesen, und beide Stellen, die
// sie brauchen (das Rückfragefenster und das Archiv), zeigen dasselbe.
//
// Vorher gab es zwei Fassungen davon, eine in Unitas und eine in der
// Patientenverwaltung. Zwei Fassungen heißen zwei Stände.

import { escapeHtml } from './aelrdDruck'
import { feldname, istVermerk, type Rueckfrage, type Stellungnahme } from '../pages/public/doku/rueckfrage'

export type Kopf = {
  /** Der Name des Patienten, oder was an seiner Stelle steht. */
  name: string
  /** Einsatznummer, Stichwort, Einsatzort — was davon vorhanden ist. */
  einsatz?: string
  alarmzeit?: string
  mannschaft?: string
}

function zeit(wert?: string): string {
  if (!wert) return ''
  const d = new Date(wert)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('de-DE')
}

/**
 * Eine Rückfrage mit ihrer Stellungnahme, als Block.
 *
 * Die angetippten Felder stehen dabei im Wortlaut des Bogens — "HF",
 * "NIBP systolisch" —, nicht als Kennung: der Ausdruck wird von Menschen
 * gelesen, die den Bogen kennen, nicht den Quelltext.
 */
function frageBlock(rq: Rueckfrage, sn: Stellungnahme | null, nummer: number): string {
  const wer = rq.von || rq.created_by
  const felder = (rq.felder ?? []).map(feldname)
  return `
    <div class="rq">
      <div class="rq-kopf">${istVermerk(rq) ? 'Vermerk' : `Rückfrage ${nummer}`}${wer ? ` <span class="still">— ${escapeHtml(wer)}${zeit(rq.created) ? `, ${escapeHtml(zeit(rq.created))}` : ''}</span>` : ''}</div>
      <div class="rq-text">${escapeHtml(rq.frage)}</div>
      ${felder.length ? `<div class="felder">Markiert im Protokoll: ${escapeHtml(felder.join(', '))}</div>` : ''}
      ${sn
        ? `<div class="sn-kopf">Stellungnahme${sn.von ? ` — ${escapeHtml(sn.von)}` : ''}${zeit(sn.created) ? `, ${escapeHtml(zeit(sn.created))}` : ''}</div>
           <div class="sn-text">${escapeHtml(sn.text)}</div>`
        : istVermerk(rq) ? '' : '<div class="offen">Noch keine Stellungnahme eingegangen.</div>'}
    </div>`
}

/** Die ganze Seite, fertig zum Drucken. */
export function rueckfrageSeite(
  kopf: Kopf,
  rueckfragen: Rueckfrage[],
  stellungnahmen: Stellungnahme[],
  gedruckt: { von?: string; am: Date },
): string {
  const bloecke = rueckfragen
    .map((rq, i) => frageBlock(rq, stellungnahmen.find((s) => s.rueckfrage_id === rq.id) ?? null, i + 1))
    .join('')
  const zeile = (beschriftung: string, wert?: string) =>
    wert ? `<div class="zeile"><strong>${beschriftung}</strong> ${escapeHtml(wert)}</div>` : ''
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Rückfragen — ${escapeHtml(kopf.name)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Atkinson Hyperlegible','Helvetica Neue',Arial,sans-serif;color:#1a0e08;padding:32px;background:#fff;line-height:1.5}
  h1{font-size:19px;color:#600812;margin-bottom:10px;font-style:italic}
  .zeile{font-size:13px;margin-bottom:3px}
  .zeile strong{display:inline-block;min-width:104px;color:#600812;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.12em}
  hr{border:none;border-top:0.5px solid rgba(96,8,18,0.2);margin:16px 0 20px}
  .rq{margin-bottom:20px;page-break-inside:avoid;border-left:3px solid #600812;padding-left:12px}
  .rq-kopf{font-size:10px;font-weight:700;color:#600812;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:5px}
  .rq-kopf .still{font-style:italic;color:#8a7a68;font-weight:400;text-transform:none;letter-spacing:0}
  .rq-text{font-size:13px;margin-bottom:6px}
  .felder{font-size:12px;font-style:italic;color:#8a7a68;margin-bottom:8px}
  .sn-kopf{font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:4px}
  .sn-text{font-size:13px;background:rgba(22,163,74,0.06);border-left:2px solid #16a34a;padding:8px 12px;border-radius:4px}
  .offen{font-size:13px;font-style:italic;color:#8a7a68}
  .leer{font-size:13px;font-style:italic;color:#8a7a68}
  .fuss{margin-top:36px;border-top:0.5px solid rgba(96,8,18,0.2);padding-top:10px;font-size:11px;font-style:italic;color:#8a7a68}
  .knopf{position:fixed;bottom:24px;right:24px;background:#600812;color:#fff;border:none;padding:12px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:0.06em}
  @media print{.knopf{display:none}}
</style></head>
<body>
<h1>Rückfragen und Stellungnahmen</h1>
${zeile('Patient', kopf.name)}
${zeile('Einsatz', kopf.einsatz)}
${zeile('Alarmzeit', kopf.alarmzeit)}
${zeile('Mannschaft', kopf.mannschaft)}
<hr>
${bloecke || '<div class="leer">Keine Rückfragen vorhanden.</div>'}
<div class="fuss">Ausgedruckt ${escapeHtml(gedruckt.am.toLocaleString('de-DE'))}${gedruckt.von ? ` · ${escapeHtml(gedruckt.von)}` : ''}</div>
<button class="knopf" onclick="window.print()">Drucken / PDF</button>
</body></html>`
}

/**
 * Die Seite in einem Fenster öffnen.
 *
 * Gibt zurück, ob es ging — ein geblockter Aufruf darf nicht stillschweigend
 * nichts tun.
 */
export function rueckfrageDrucken(
  kopf: Kopf,
  rueckfragen: Rueckfrage[],
  stellungnahmen: Stellungnahme[],
  gedruckt: { von?: string; am: Date },
): boolean {
  const w = window.open('', '_blank', 'width=900,height=1100')
  if (!w) return false
  w.document.write(rueckfrageSeite(kopf, rueckfragen, stellungnahmen, gedruckt))
  w.document.close()
  return true
}
