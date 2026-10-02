// Seite 1 des ÄLRD-Bogens: Einsatzdaten, Notfallgeschehen, Erstbefund, Diagnosen.
//
// Jeder Block sitzt auf seiner vermessenen Position aus aelrdLayout.
// Die Inhalte kommen aus dem DIVI-7.1-Katalog.

import {
  MASS,
  block,
  escapeHtml,
  istGewaehlt,
  messwert,
  option,
  optionen,
  schmerzskala,
  ueberschrift,
  wertKasten,
  wertZeile,
  type Payload,
} from './aelrdDruck'
import { SEITE1 } from './aelrdLayout'
import { feldFinden } from '../katalog/divi'

export type Kopfdaten = {
  organisation?: string
  protokollNr?: string
  erstellt?: string
}

function w(payload: Payload, id: string): string {
  const v = payload[id]
  return v === undefined || v === null ? '' : String(v)
}

/** Ein einzelner Optionsknopf aus einem Katalogfeld, fuer von Hand gesetzte Reihen. */
function opt(payload: Payload, feldId: string, wert: string, text?: string): string {
  const feld = feldFinden(feldId)
  const beschriftung = text ?? feld?.optionen?.find((o) => o.wert === wert)?.text ?? wert
  return option(beschriftung, istGewaehlt(payload[feldId], wert), feld?.typ !== 'mehrfach')
}

/** Ein einzelnes Kaestchen fuer ein Ja-Nein-Feld des Katalogs. */
function hak(payload: Payload, feldId: string, text?: string): string {
  const feld = feldFinden(feldId)
  return option(text ?? feld?.label ?? feldId, Boolean(payload[feldId]), true)
}

/** Der Text der gewaehlten Option eines Katalogfeldes. */
function gewaehlt(payload: Payload, feldId: string): string {
  return feldFinden(feldId)?.optionen?.find((o) => o.wert === payload[feldId])?.text ?? ''
}

function kopfzeile(kopf: Kopfdaten): string {
  return `<div class="kopf">
    <span>Organisation: <b>${escapeHtml(kopf.organisation ?? '')}</b></span>
    <span>Protokoll-Nr.: <b>${escapeHtml(kopf.protokollNr ?? '')}</b></span>
    <span class="stempel">${escapeHtml(kopf.erstellt ?? '')}</span>
  </div>`
}

function stammdaten(p: Payload): string {
  return block(
    SEITE1.stammdaten,
    `${wertZeile(w(p, 'name'), 'Name')}
     ${wertZeile(w(p, 'vorname'), 'Vorname')}
     ${wertZeile(w(p, 'gebdatum'), 'Geburtsdatum')}
     ${wertZeile(w(p, 'strasse'), 'Straße')}
     ${wertZeile(w(p, 'plz_ort'), 'PLZ / Ort')}
     ${wertZeile(w(p, 'kasse'), 'Kasse / Nr.')}
     ${wertZeile(w(p, 'versnr'), 'Vers.-Nr.')}`,
  )
}

function person(p: Payload): string {
  const alterEinheit = feldFinden('alter_einheit')
  return block(
    SEITE1.person,
    `<div class="reihe">
      <span class="rb">Geschlecht</span>
      ${opt(p, 'geschlecht', 'maennlich')}${opt(p, 'geschlecht', 'weiblich')}${opt(p, 'geschlecht', 'divers')}
      <span class="rb">BMI</span>
      ${opt(p, 'bmi', 'bis40', '< 40')}${opt(p, 'bmi', 'ueber40', '> 40')}
      <span class="rw">${escapeHtml(w(p, 'alter_wert'))}</span><span class="rb">Alter</span>
      ${(alterEinheit?.optionen ?? []).map((o) => option(o.text, istGewaehlt(p.alter_einheit, o.wert), true)).join('')}
    </div>`,
  )
}

function titel(kopf: Kopfdaten): string {
  return block(
    SEITE1.titel,
    `<div class="titel">Einsatzprotokoll${kopf.organisation ? ` — ${escapeHtml(kopf.organisation)}` : ''}</div>
     <div class="untertitel">In Anlehnung an das DIVI-Notfalleinsatzprotokoll 7.1</div>`,
    true,
  )
}

function kennung(p: Payload): string {
  return block(
    SEITE1.kennung,
    `${wertZeile(w(p, 'einsatz_nr'), 'Einsatz-Nr.')}
     <div class="zwei">
       ${wertZeile(w(p, 'leitstelle'), 'Leitstellen-Nr.')}
       ${wertZeile(w(p, 'fahrzeug'), 'Rufname')}
     </div>
     ${wertZeile(w(p, 'standort'), 'Standort')}`,
  )
}

function einsatzdaten(p: Payload): string {
  return block(
    SEITE1.einsatzdaten,
    `${ueberschrift('Einsatztechnische Daten')}
     <div class="ed">
       <div class="ed-links">
         ${wertZeile(w(p, 'einsatz_datum'), 'Einsatz-Datum', true)}
         ${wertZeile(gewaehlt(p, 'einsatzstelle'), 'Art des Einsatzortes')}
         ${wertZeile(w(p, 'einsatz_strasse'), 'Einsatzort')}
         ${wertZeile([w(p, 'einsatz_plz'), w(p, 'einsatz_ort')].filter(Boolean).join(' '), 'PLZ / Ort')}
         ${wertZeile(w(p, 'transport_ziel'), 'Transportziel')}
         ${wertZeile(gewaehlt(p, 'einsatz_art'), 'Einsatz-Art')}
         ${wertZeile(gewaehlt(p, 'transportbegleitung'), 'Versorgung')}
         <div class="vm">${hak(p, 'voranmeldung', 'Voranmeldung')}${optionen('voranmeldung_ressource', p)}</div>
       </div>
       <div class="ed-rechts">
         <div class="kl">Sondersignal</div>
         ${opt(p, 'sondersignal_wann', 'anfahrt', 'Anfahrt')}${opt(p, 'sondersignal_wann', 'transport', 'Transport')}
         <div class="kl" style="margin-top:4pt">Symptom-Beginn</div>
         ${opt(p, 'symptombeginn_art', 'geschaetzt', 'geschätzt')}
         ${hak(p, 'kollaps_beobachtet', 'Kollaps beobachtet')}
         ${hak(p, 'symptombeginn_ueber24h', 'vor > 24 Stunden')}
         <div class="zeiten">
           ${wertKasten(w(p, 'symptombeginn_zeit'), 'Symptom-Beginn')}
           ${wertKasten(w(p, 'zeit_alarm'), 'Alarm')}
           ${wertKasten(w(p, 'zeit_ankunft_einsatzort'), 'Ankunft (E.-Ort)')}
           ${wertKasten(w(p, 'zeit_ankunft_patient'), 'Ankunft (Patient)')}
           ${wertKasten(w(p, 'zeit_abfahrt'), 'Abfahrt')}
           ${wertKasten(w(p, 'zeit_uebergabe'), 'Übergabe')}
           ${wertKasten(w(p, 'zeit_einsatzbereit'), 'Einsatzbereit')}
           ${wertKasten(w(p, 'zeit_ende'), 'Ende')}
         </div>
       </div>
     </div>`,
  )
}

function notfallgeschehen(p: Payload): string {
  const az = gewaehlt(p, 'az_vor_ereignis')
  return block(
    SEITE1.notfallgeschehen,
    `<div class="ng-kopf">
       ${ueberschrift('Notfallgeschehen, Anamnese, Erstbefund, Vormedikation, Vorbehandlung')}
       <span class="ng-eh">Ersthelfermaßnahmen (Laien) <b>${escapeHtml(gewaehlt(p, 'ersthelfermassnahmen'))}</b></span>
     </div>
     <div class="ng-text">${escapeHtml(w(p, 'notfallgeschehen'))}</div>
     <div class="ng-fuss">
       <span class="kl">AZ des Pat. vor Ereignis</span>
       <span class="ng-az">${escapeHtml(az)}</span>
       <span>${hak(p, 'first_responder_vor_ort', 'First Responder')}</span>
     </div>`,
  )
}

function naca(p: Payload): string {
  const text = feldFinden('naca')?.optionen?.find((o) => o.wert === p.naca)
  return block(
    SEITE1.naca,
    `<div class="naca"><span class="kl">NACA-Score initial</span><b>${escapeHtml(
      text ? `${text.text} (${text.hinweis ?? ''})` : '',
    )}</b></div>`,
  )
}

function news(p: Payload): string {
  return block(
    SEITE1.news,
    `<div class="news">NEWS2-Score: <b>${escapeHtml(w(p, 'news2'))}</b> &nbsp;·&nbsp; qSOFA: <b>${escapeHtml(
      w(p, 'qsofa'),
    )}</b></div>`,
  )
}

/** Zusatzstil, den nur Seite 1 braucht. */
export const STIL_SEITE1 = `
.reihe{display:flex;align-items:center;gap:3pt;padding:2pt 3pt;flex-wrap:wrap}
.rb{font-size:${MASS.beschriftung}pt;margin-right:1pt}
.rw{font-size:${MASS.wertGross}pt;font-weight:bold}
.titel{font-size:${MASS.wertGross}pt;font-weight:bold;padding:2pt 3pt 0}
.untertitel{font-size:${MASS.beschriftung}pt;padding:0 3pt}
.zwei{display:flex}
.zwei > *{flex:1 1 50%}
.ed{display:flex;height:calc(100% - 10pt)}
.ed-links{flex:1 1 auto;min-width:0;padding-right:2pt}
.ed-rechts{width:128pt;flex-shrink:0;border-left:${MASS.linie}pt solid #000;padding:1pt 3pt}
.kl{font-size:${MASS.klein}pt;display:block}
.vm{padding:1pt 3pt}
.zeiten{margin-top:2pt}
.ng-kopf{display:flex;justify-content:space-between;align-items:baseline;padding-right:4pt}
.ng-eh{font-size:${MASS.beschriftung}pt}
.ng-text{font-size:7.4pt;white-space:pre-wrap;padding:2pt 4pt;line-height:1.35}
.ng-fuss{position:absolute;left:0;right:0;bottom:1pt;display:flex;align-items:baseline;gap:6pt;padding:0 4pt;border-top:${MASS.linie}pt solid #000}
.ng-az{font-size:${MASS.beschriftung}pt;font-weight:bold;flex:1 1 auto}
.naca{display:flex;align-items:baseline;gap:4pt;padding:4pt 4pt;font-size:${MASS.ueberschrift}pt}
.news{font-size:${MASS.beschriftung}pt;padding:2pt 4pt}
`

/** Seite 1 als Blatt. Erstbefund, Neurologie, Untersuchung und Erkrankungen folgen. */
export function seite1(p: Payload, kopf: Kopfdaten): string {
  return `<div class="blatt">
    ${kopfzeile(kopf)}
    ${stammdaten(p)}
    ${person(p)}
    ${titel(kopf)}
    ${kennung(p)}
    ${einsatzdaten(p)}
    ${notfallgeschehen(p)}
    ${naca(p)}
    ${news(p)}
  </div>`
}

export { schmerzskala, messwert }
