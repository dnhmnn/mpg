// Seite 1 des ÄLRD-Bogens: Stammdaten, Einsatzdaten, Notfallgeschehen,
// Erstbefund, Neurologie, Verletzungen, Diagnosen.
//
// Jeder Block sitzt auf seiner vermessenen Position aus aelrdLayout, jede
// Optionsreihe steht so, wie sie auf dem Papier steht.

import {
  MASS,
  block,
  schreibflaeche,
  escapeHtml,
  option,
  raster,
  schmerzskala,
  ueberschrift,
  wertKasten,
  wertZeile,
  wortlaut,
  type Payload,
} from './aelrdDruck'
import { HOEHEN, SEITE1 } from './aelrdLayout'
import { aelrdFeld } from '../katalog/aelrd'

export type Kopfdaten = {
  organisation?: string
  protokollNr?: string
  erstellt?: string
}

/** Der Wortlaut eines Feldes — bei Auswahlen der Optionstext, nicht der Schluessel. */
function w(p: Payload, id: string): string {
  return wortlaut(p, id)
}

/**
 * Ein Besatzungsmitglied. Die App legt die Besatzung in zwei Formen ab:
 * flach als mannschaft_tf / mannschaft_1 … und verschachtelt als
 * mannschaft: { tf: { name }, m1: { name } … }. Aeltere Protokolle tragen
 * nur die zweite; wer nur die flache liest, druckt sie leer.
 */
function besatzungsname(p: Payload, feldId: string, schluessel: string): string {
  const flach = w(p, feldId)
  if (flach) return flach
  const verschachtelt = p.mannschaft
  if (verschachtelt && typeof verschachtelt === 'object') {
    const eintrag = (verschachtelt as Record<string, unknown>)[schluessel]
    if (eintrag && typeof eintrag === 'object') {
      const name = (eintrag as Record<string, unknown>).name
      if (typeof name === 'string') return name
    }
  }
  return ''
}

/** Ein einzelnes Kaestchen fuer ein Ja-Nein-Feld. */
function hak(p: Payload, id: string, text?: string): string {
  return option(text ?? aelrdFeld(id)?.label ?? id, Boolean(p[id]), true)
}

/** Ein Messwertfeld der Werteleiste: Beschriftung oben, Wert gross, Einheit klein. */
function mw(p: Payload, id: string, breit = false): string {
  const feld = aelrdFeld(id)
  return `<div class="zelle-mw${breit ? ' breit' : ''}">
    <span class="z-b">${escapeHtml(feld?.label ?? id)}</span>
    <span class="z-w">${escapeHtml(w(p, id))}</span>
    <span class="z-e">${escapeHtml(feld?.einheit ?? '')}</span>
  </div>`
}

/** Zwei Werte in einem Feld, durch Schraegstrich getrennt — NIBP und IBP. */
function mwPaar(p: Payload, idA: string, idB: string, titel: string, einheit: string): string {
  return `<div class="zelle-mw breit">
    <span class="z-b">${escapeHtml(titel)}</span>
    <span class="z-w">${escapeHtml(w(p, idA))}<span class="z-s">/</span>${escapeHtml(w(p, idB))}</span>
    <span class="z-e">${escapeHtml(einheit)}</span>
  </div>`
}

function kopfzeile(k: Kopfdaten): string {
  return `<div class="kopf">
    <span class="zeile">Organisation: <b>${escapeHtml(k.organisation ?? '')}</b></span>
    <span class="zeile">Protokoll-Nr.: <b>${escapeHtml(k.protokollNr ?? '')}</b></span>
    <span class="zeile">Datum / Uhrzeit: <b>${escapeHtml(k.erstellt ?? '')}</b></span>
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
  return block(
    SEITE1.person,
    `<div class="drei">
      <div class="zelle-g">
        <div class="r"><span class="rb">Geschlecht</span>${raster('geschlecht', p, [['männlich']])}</div>
        <div class="r">${raster('geschlecht', p, [['divers', 'weiblich']])}</div>
      </div>
      <div class="zelle-b">
        <span class="rb">BMI</span>
        <div class="bmi">${raster('bmi', p, [['< 40'], ['> 40']])}</div>
      </div>
      <div class="zelle-a">
        <div class="r"><span class="rw">${escapeHtml(w(p, 'alter_wert'))}</span><span class="rb">Alter</span><span class="re">Jahre</span></div>
        <div class="r">${raster('alter_einheit', p, [['1-7 Tg', '8-28 Tg']])}</div>
      </div>
    </div>`,
  )
}

function titel(): string {
  return block(
    SEITE1.titel,
    `<div class="titel">Einsatzprotokoll - Responda</div>
     <div class="untertitel">In Anlehnung an das DIVI-Notfalleinsatzprotokoll 6.0</div>`,
    true,
  )
}

function kennung(p: Payload): string {
  return block(
    SEITE1.kennung,
    `<div class="halb">${wertZeile(w(p, 'einsatz_nr'), 'Einsatz Nr.')}</div>
     <div class="zwei">
       ${wertZeile(w(p, 'leitstelle_nr'), 'Leitst. Nr.')}
       ${wertZeile(w(p, 'rufname'), 'Rufname')}
     </div>
     ${wertZeile(w(p, 'standort'), 'Standort', true)}`,
  )
}

function einsatzdaten(p: Payload): string {
  return block(
    SEITE1.einsatzdaten,
    `${ueberschrift('Einsatztechnische Daten')}
     <div class="ed">
       <div class="ed-links">
         ${wertZeile(w(p, 'einsatz_datum'), 'Einsatz-Datum', true)}
         ${wertZeile(w(p, 'einsatzort_art'), 'Art des Einsatzortes')}
         ${wertZeile(w(p, 'transport_von'), 'Transport von')}
         ${wertZeile(w(p, 'transport_ziel'), 'Transportziel')}
         ${wertZeile(w(p, 'einsatz_art'), 'Einsatz-Art')}
         ${wertZeile(w(p, 'versorgung'), 'Versorgung')}
         <div class="vm">${hak(p, 'voranmeldung', 'Voranmeldung')}</div>
         <div class="bes">
           <div class="bes-t">Besatzung</div>
           ${wertZeile(besatzungsname(p, 'mannschaft_tf', 'tf'), 'Teamführer')}
           ${wertZeile(besatzungsname(p, 'mannschaft_1', 'm1'), '1. Mannschaft')}
           ${wertZeile(besatzungsname(p, 'mannschaft_2', 'm2'), '2. Mannschaft')}
           ${wertZeile(besatzungsname(p, 'mannschaft_3', 'm3'), '3. Mannschaft')}
         </div>
       </div>
       <div class="ed-mitte">
         <div class="kl">Sondersignal</div>
         ${raster('sondersignal', p, [['Anfahrt'], ['Transport']])}
       </div>
       <div class="ed-rechts">
         <div class="kl rechts">beteiligtes RM</div>
         <div class="rm">${escapeHtml(w(p, 'beteiligtes_rm'))}</div>
         <div class="sb">
           <span class="kl">Symptom-Beginn</span>
           <span class="sb-g">${hak(p, 'symptombeginn_geschaetzt', 'geschätzt')}</span>
         </div>
         ${hak(p, 'kollaps_beobachtet', 'Kollaps beobachtet')}
         ${hak(p, 'symptombeginn_ueber24h', 'vor > 24 Stunden')}
         <div class="zeiten">
           ${wertKasten(w(p, 'symptombeginn'), '')}
           ${wertKasten(w(p, 'zeit_alarm'), 'Alarm')}
           ${wertKasten(w(p, 'zeit_uebernahme'), 'Einsatzübernahme')}
           ${wertKasten(w(p, 'zeit_ankunft_ort'), 'Ankunft (E.-Ort)')}
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
  return block(
    SEITE1.notfallgeschehen,
    `<div class="ng-kopf">
       ${ueberschrift('Notfallgeschehen, Anamnese, Erstbefund, Vormedikation, Vorbehandlung')}
       <span class="ng-eh">Ersthelfermaßnahmen (Laien) <b>${escapeHtml(
         aelrdFeld('ersthelfermassnahmen')?.optionen?.find((o) => o.wert === p.ersthelfermassnahmen)?.text ?? '',
       )}</b></span>
     </div>
     ${schreibflaeche(w(p, 'notfallgeschehen'), 24, 'ng-text')}
     <div class="ng-fuss">
       <span class="kl">AZ des Pat. vor Ereignis</span>
       <span class="ng-az">${escapeHtml(w(p, 'az_vor_ereignis'))}</span>
       <span>${hak(p, 'first_responder', 'First Responder')}</span>
     </div>`,
  )
}

function erstbefund(p: Payload): string {
  return block(
    SEITE1.erstbefund,
    `<div class="eb-kopf" style="height:${HOEHEN.ebKopf}pt">
       ${ueberschrift('Erstbefund')}
       <span class="eb-zp"><span class="kl">Zeitpunkt</span><span class="eb-zw">${escapeHtml(w(p, 'erstbefund_zeitpunkt'))}</span></span>
     </div>

     <div class="bf" style="height:${HOEHEN.ebAtemwege}pt">
       <span class="bf-t">Atemwege</span>
       ${raster('atemwege', p, [
         [null, 'frei', 'gefährdet', 'Stridor exsp.', null],
         ['nicht untersucht', 'nicht beurteilbar', 'Stridor insp.', 'Atemwegsverlegung', null],
       ])}
     </div>

     <div class="bf" style="height:${HOEHEN.ebAtmung}pt">
       <span class="bf-t">Atmung</span>
       ${raster('atmung', p, [
         [null, 'unauffällig', 'Tachypnoe', 'Rasselgeräusche', 'Apnoe', null],
         ['nicht untersucht', 'nicht beurteilbar', 'Bradypnoe', 'Schnappatmung', 'Spastik', null],
         ['Belastungsdyspnoe', 'Ruhedyspnoe', 'Beatmung', 'Hyperventilation', 'Zyanose', 'Sonstige'],
       ])}
     </div>

     <div class="krsl" style="height:${HOEHEN.ebKreislauf}pt">
       <div class="krsl-o">
         <span class="bf-t">Kreislauf</span>
         <div class="kr-l">
           ${raster('kreislauf', p, [[null, 'unauffällig'], ['nicht untersucht', 'Blutung']])}
         </div>
         <div class="kr-r">
           <div class="kr-z"><span class="kl">Puls regelmäßig:</span><b>${escapeHtml(w(p, 'puls_regelmaessig'))}</b><b class="kr-rp">${escapeHtml(w(p, 'radialispuls'))}</b></div>
           <div class="kr-z"><span class="kl">Rekap. Zeit:</span><b>${escapeHtml(w(p, 'rekap_zeit'))}</b><b class="kr-rp">${escapeHtml(w(p, 'schockzeichen'))}</b></div>
         </div>
       </div>
       <div class="krsl-u"><span class="kl">path. Auffälligkeiten:</span><span class="frei">${escapeHtml(w(p, 'kreislauf_auffaelligkeiten'))}</span></div>
     </div>

     <div class="bf" style="height:${HOEHEN.ebHaut}pt">
       <span class="bf-t">Haut</span>
       ${raster('haut', p, [
         [null, 'unauffällig', 'Oedeme', 'kaltschweißig', 'stehende Hautfalten'],
         ['nicht untersucht', 'nicht beurteilbar', 'Dekubitus', 'Exantheme', 'Sonstige'],
       ])}
     </div>

     <div class="bf" style="height:${HOEHEN.ebEkg - 8}pt">
       <span class="bf-t">EKG</span>
       ${raster('ekg', p, [['kein EKG', 'Sinusrhythmus', 'nicht beurteilbar']])}
     </div>
     <div class="bf-frei"><span class="frei">${escapeHtml(w(p, 'ekg_text'))}</span></div>

     <div class="mwi" style="height:${HOEHEN.ebMesswerte}pt">
       ${ueberschrift('Messwerte initial')}
       <div class="mw-reihe">
         ${mw(p, 'af')}${mw(p, 'spo2')}${mw(p, 'co_hb')}${mw(p, 'hf')}${mw(p, 'puls')}${mw(p, 'etco2')}
       </div>
       <div class="mw-zusatz">
         <span><span class="kl">mit O₂?</span> <b>${escapeHtml(w(p, 'spo2_mit_o2'))}</b></span>
         <span><span class="kl">Messort Temp.</span> <b>${escapeHtml(w(p, 'temp_ort'))}</b></span>
       </div>
       <div class="mw-reihe">
         ${mwPaar(p, 'nibp_sys', 'nibp_dia', 'NIBP', 'mmHg')}
         ${mwPaar(p, 'ibp_sys', 'ibp_dia', 'IBP', 'mmHg')}
         ${mw(p, 'bz')}${mw(p, 'temp')}
       </div>
     </div>`,
  )
}

function neurologie(p: Payload): string {
  return block(
    SEITE1.neurologie,
    `<div class="nr-kopf" style="height:${HOEHEN.nrKopf}pt">
       ${ueberschrift('Neurologie')}
       ${hak(p, 'neuro_ohne_befund', 'ohne path. Befund')}
       <div class="nr-bw">
         <div><span class="kl">Bewusstsein:</span> <b>${escapeHtml(w(p, 'bewusstsein'))}</b></div>
         <div class="gcs">
           <span class="gz"><b>${escapeHtml(w(p, 'gcs_augen'))}</b><span class="kl">Augen</span></span>
           <span class="gz"><b>${escapeHtml(w(p, 'gcs_verbal'))}</b><span class="kl">Verbal</span></span>
           <span class="gz"><b>${escapeHtml(w(p, 'gcs_motorik'))}</b><span class="kl">Motorik</span></span>
           <span class="gz"><b>${escapeHtml(w(p, 'gcs_summe'))}</b><span class="kl">Summe</span></span>
           <span class="gcs-t">GCS</span>
         </div>
       </div>
     </div>

     <div class="pup" style="height:${HOEHEN.nrPupillen}pt">
       <div class="pup-k"><span class="bf-t">Pupillenstatus</span><span class="pup-s">rechts</span><span class="pup-s">links</span></div>
       <div class="pup-z"><span class="kl">Weite</span><span>${escapeHtml(w(p, 'pupillen_weite_re'))}</span><span>${escapeHtml(w(p, 'pupillen_weite_li'))}</span></div>
       <div class="pup-z"><span class="kl">Lichtreaktion</span><span>${escapeHtml(w(p, 'pupillen_licht_re'))}</span><span>${escapeHtml(w(p, 'pupillen_licht_li'))}</span></div>
     </div>

     <div class="bf auff" style="height:${HOEHEN.nrAuffaelligkeiten}pt">
       <span class="bf-t">Auffälligkeiten</span>
       ${raster('neuro_auffaelligkeiten', p, [
         ['keine', 'nicht untersucht', 'nicht beurteilbar', 'Gesichtslähmung'],
         ['Kopfschmerzen', 'Gangunsicherheit / Schwindel', 'Herdblick', 'Motorik Arme'],
         ['Demenz', 'Querschnittssymptomatik', 'Sensibilitätsstörung', 'Motorik Beine'],
         ['Sehstörung', 'Babinski Zeichen', 'Übelkeit / Erbrechen', 'Sprachstörung'],
         ['Meningismus', 'vorbestehende neurologische Defizite', 'Sonstige', null],
       ])}
     </div>

     <div class="schm" style="height:${HOEHEN.nrSchmerzen}pt">
       <span class="bf-t">Schmerzen</span>
       ${schmerzskala('schmerz', p)}
       <div class="schm-r">
         ${hak(p, 'schmerz_nicht_beurteilbar', 'NRS nicht beurteilbar')}
         <div class="schm-t"><b>${escapeHtml(w(p, 'schmerz_tolerabel'))}</b></div>
       </div>
     </div>

     <div class="unt" style="height:${HOEHEN.nrUntersuchung}pt">
       ${ueberschrift('Untersuchung')}
       ${schreibflaeche(w(p, 'untersuchung'), 2, 'unt-f')}
     </div>

     <div class="bf psy" style="height:${HOEHEN.nrPsyche}pt">
       <span class="bf-t">Psyche</span>
       ${raster('psyche', p, [
         [null, 'unauffällig', 'aggressiv', 'verwirrt', 'verlangsamt', 'suizidal'],
         ['nicht untersucht', 'nicht beurteilbar', 'depressiv', 'erregt', 'euphorisch', 'Sonstige'],
         [null, 'wahnhaft', 'ängstlich', 'motorisch unruhig', null, null],
       ])}
     </div>`,
  )
}

function verletzungen(p: Payload): string {
  return block(
    SEITE1.verletzungen,
    `<div class="vrl-kopf" style="height:${HOEHEN.vrKopf}pt">
       <span class="bf-t">Verletzungen</span>
       <div class="vrl-z">
         <div><span class="kl">Zusammenhang mit</span> <b>${escapeHtml(w(p, 'verletzung_zusammenhang'))}</b></div>
         <div><span class="kl">Verletzungsmuster</span> <b>${escapeHtml(w(p, 'verletzungsmuster'))}</b></div>
       </div>
     </div>
     <div class="vrl-haupt" style="height:${HOEHEN.vrHaupt}pt">
       <div class="vrl-links">
         <div class="vrl-t">Lokalisation und Schweregrad</div>
         ${[
           ['verl_sht', 'SHT'],
           ['verl_gesicht', 'Gesicht'],
           ['verl_hws', 'HWS'],
           ['verl_thorax', 'Thorax'],
           ['verl_abdomen', 'Abdomen'],
           ['verl_bws_lws', 'BWS / LWS'],
           ['verl_becken', 'Becken'],
           ['verl_obere_extr', 'obere Extr.'],
           ['verl_untere_extr', 'untere Extr.'],
           ['verl_weichteile', 'Weichteile'],
         ]
           .map(([id, text]) => `<div class="vrl-zeile"><span>${escapeHtml(text)}</span><b>${escapeHtml(w(p, id))}</b></div>`)
           .join('')}
       </div>
       <div class="vrl-rechts">
         <div class="vrl-t">Unfallursache</div>
         <div class="vrl-u">Unfallmechanismus</div>
         ${raster('unfallmechanismus', p, [['stumpf', 'penetrierend', 'nicht bekannt']])}
         <div class="vrl-u">Spezielle Traumata</div>
         ${raster('spezielle_traumata', p, [
           ['Inhalationstrauma', 'Tauchunfall'],
           ['Elektrounfall', 'sonstige (Strahlen, Barotrauma)'],
           ['(beinahe-) Ertrinken', 'Verätzung'],
         ])}
         <div class="vrl-u">Verbrennung / Verbrühung</div>
         <div class="vbr">
           <span>I° <b>${escapeHtml(w(p, 'verbrennung_1'))}</b> %</span>
           <span>II° <b>${escapeHtml(w(p, 'verbrennung_2'))}</b> %</span>
           <span>III° <b>${escapeHtml(w(p, 'verbrennung_3'))}</b> %</span>
         </div>
       </div>
     </div>
     <div class="vrl-herg" style="height:${HOEHEN.vrHergang}pt">
       <div class="vrl-u">Unfallhergang</div>
       ${raster('unfallhergang', p, [
         [null, 'Motorradfahrer', 'Fußgänger angefahren', 'Schlag', 'Explosion/Verpuffung'],
         ['PKW-Insasse', 'Fahrrad', 'sonstiger Verkehrsunfall', 'Schuss', 'Verschüttung'],
         ['LKW-Insasse', 'E-Bike / Pedelec', null, 'Stich', 'andere Unfallarten'],
       ])}
       <div class="sturz">
         ${raster('unfallhergang', p, [['Bus-Insasse', 'E-Scooter']])}
         <span class="kl">Sturz</span>
         ${raster('sturz', p, [['ebenerdig', '< 3m', '>= 3m', 'nicht bekannt']])}
       </div>
     </div>`,
  )
}

function erkrankungen(p: Payload): string {
  return block(
    SEITE1.erkrankungen,
    `${ueberschrift('Erkrankungen')}
     ${wertZeile(w(p, 'tracerdiagnose'), 'Tracerdiagnose')}
     ${wertZeile(w(p, 'fuehrende_diagnose'), 'führende Diagnose')}
     <div class="erk-frei"><span class="kl">weitere Diagnosen</span><span class="frei">${escapeHtml(
       w(p, 'weitere_diagnosen'),
     )}</span></div>
     <div class="erk-frei"><span class="kl">Diagnosetext</span><span class="frei">${escapeHtml(
       w(p, 'diagnosetext'),
     )}</span></div>`,
  )
}

function naca(p: Payload): string {
  return block(
    SEITE1.naca,
    `<div class="naca"><span class="kl">NACA SCORE initial</span><b>${escapeHtml(w(p, 'naca_initial'))}</b></div>`,
  )
}

function news(p: Payload): string {
  return block(
    SEITE1.news,
    `<div class="news"><b>NEWS Score (berechnet/manuell): ${escapeHtml(w(p, 'news_score'))} / Roter Warnwert: ${escapeHtml(
      w(p, 'roter_warnwert'),
    )}</b></div>`,
  )
}

export const STIL_SEITE1 = `
.drei{display:flex;height:100%;align-items:flex-start}
.drei .opt{line-height:1.25}
.zelle-g{flex:0 0 77pt;border-right:${MASS.linie}pt solid #000;padding:0.6pt 3pt}
.zelle-b{flex:0 0 64pt;border-right:${MASS.linie}pt solid #000;padding:0.6pt 3pt;display:flex;gap:3pt}
.zelle-a{flex:1 1 auto;padding:0.6pt 3pt}
.r{display:flex;align-items:baseline;gap:3pt;line-height:1.05}
.rb{font-size:${MASS.beschriftung}pt}
.re{font-size:${MASS.beschriftung}pt}
.rw{font-size:8.2pt;font-weight:bold;line-height:1}
.bmi .rst{row-gap:0}
.titel{font-size:9.6pt;font-weight:bold;padding:1.5pt 3pt 0;line-height:1.15}
.untertitel{font-size:${MASS.beschriftung}pt;padding:0 3pt}
.halb{width:53%}
.zwei{display:flex}
.zwei > *{flex:1 1 50%}

.ed{display:flex;height:calc(100% - 9pt)}
.ed-links{flex:1 1 auto;min-width:0;padding-right:2pt}
.ed-mitte{width:46pt;flex-shrink:0;padding:1pt 2pt}
.ed-rechts{width:112pt;flex-shrink:0;padding:0 2pt}
.kl{font-size:${MASS.klein}pt}
.kl.rechts{display:block;text-align:right}
.rm{height:11pt;border-bottom:${MASS.linie}pt solid #000}
.sb{display:flex;justify-content:space-between;align-items:baseline;margin-top:2pt}
.sb-g{font-weight:normal}
.vm{padding:1pt 3pt}
.bes{margin-top:3pt;border-top:${MASS.linie}pt solid #000}
.bes-t{font-size:${MASS.ueberschrift}pt;padding:2pt 3pt 1pt}
/* Die Besatzung wird von Hand eingetragen — die Zeilen bekommen Luft,
   der Platz darunter ist ohnehin frei. */
.bes .wz{padding:2.5pt 3pt 0.4pt}
.bes .wz-w{min-height:9.5pt}
.zeiten{margin-top:1pt}

.ng-kopf{display:flex;justify-content:space-between;align-items:baseline;padding-right:4pt}
.ng-eh{font-size:${MASS.beschriftung}pt}
.ng-text{margin:0 4pt;height:206pt;overflow:hidden}
.ng-text .inhalt{font-size:7.4pt;line-height:8.44pt}
.unt-f .inhalt{font-size:${MASS.beschriftung}pt;line-height:8.44pt}
.ng-fuss{position:absolute;left:0;right:0;bottom:1pt;display:flex;align-items:baseline;gap:6pt;padding:0 4pt}
.ng-az{font-size:${MASS.beschriftung}pt;font-weight:bold;flex:1 1 auto}

.eb-kopf{display:flex;justify-content:space-between;align-items:baseline;padding-right:4pt;overflow:hidden}
.eb-zp{display:inline-flex;align-items:baseline;gap:3pt}
.eb-zw{display:inline-block;font-size:9.6pt;font-weight:bold;border:${MASS.rahmen}pt solid #000;padding:0 4pt;min-width:56pt;height:12pt;line-height:11pt;text-align:center;vertical-align:middle}
.bf{display:flex;align-items:flex-start;gap:3pt;padding:0.3pt 2.5pt;border-top:${MASS.linie}pt solid #000;overflow:hidden}
.bf-t{font-size:6.7pt;flex:0 0 40pt;line-height:1.1}
.bf .rst{flex:1 1 auto}
.bf-frei{padding:0 3pt;height:8pt;overflow:hidden}
.frei{display:block;font-size:${MASS.beschriftung}pt;min-height:5pt;white-space:pre-wrap}
.frei.gross{min-height:17pt}
.krsl{border-top:${MASS.linie}pt solid #000;overflow:hidden;display:flex;flex-direction:column}
.krsl-o{display:flex;align-items:flex-start;gap:3pt;padding:0.3pt 2.5pt;flex:1 1 auto;min-height:0}
.krsl-u{padding:0 2.5pt 0.5pt;border-top:${MASS.linie}pt solid #000;flex-shrink:0}
.kr-l{flex:0 0 88pt}
.kr-r{flex:1 1 auto;border-left:${MASS.linie}pt solid #000;padding-left:3pt}
.kr-z{display:flex;gap:4pt;font-size:${MASS.beschriftung}pt;line-height:1.2}
.kr-z b:first-of-type{flex:0 0 28pt}
.kr-rp{margin-left:auto}

.mwi{border-top:${MASS.rahmen}pt solid #000;padding:0 2pt;overflow:hidden}
.mwi .ueb{padding:0.3pt 1pt 0}
.mw-zusatz{display:flex;gap:8pt;font-size:${MASS.klein}pt;padding:0 2pt;line-height:1}
.mw-reihe{display:flex;border-top:${MASS.linie}pt solid #000}
.zelle-mw{flex:1 1 0;min-width:0;border-right:${MASS.linie}pt solid #000;padding:0 2pt;display:flex;flex-direction:column;line-height:1.05}
.zelle-mw.breit{flex:1.6 1 0}
.zelle-mw:last-child{border-right:none}
.z-b{font-size:${MASS.klein}pt}
.z-w{font-size:9.6pt;font-weight:bold;min-height:9.6pt;line-height:1}
.z-s{font-weight:normal;margin:0 2pt}
.z-e{font-size:${MASS.klein}pt;text-align:right}

.nr-kopf{display:flex;align-items:flex-start;gap:4pt;padding:0.3pt 3pt;overflow:hidden}
.nr-bw{margin-left:auto;border-left:${MASS.linie}pt solid #000;padding-left:4pt;min-width:112pt}
.gcs{display:flex;gap:2pt;align-items:flex-end;margin-top:0}
.gz{display:flex;flex-direction:column;align-items:center;min-width:20pt;border-bottom:${MASS.linie}pt solid #000}
.gz b{font-size:${MASS.beschriftung}pt}
.gcs-t{font-size:${MASS.ueberschrift}pt;margin-left:3pt}
.pup{border-top:${MASS.rahmen}pt solid #000;padding:0.3pt 3pt;overflow:hidden}
.pup-k,.pup-z{display:flex;gap:4pt}
.pup-k > *,.pup-z > *{flex:1 1 0;font-size:${MASS.beschriftung}pt}
.pup-k .bf-t{flex:1 1 0}
.pup-s{font-size:${MASS.beschriftung}pt;text-align:center}
.auff{border-top:${MASS.rahmen}pt solid #000}
.auff .opt,.psy .opt,.vrl-rechts .opt,.vrl-herg .opt{font-size:4.7pt}
.auff .bf-t,.psy .bf-t{flex:0 0 36pt}
.auff .rst,.psy .rst{column-gap:1.5pt}
.schm{display:flex;align-items:flex-start;gap:4pt;padding:0.3pt 3pt;border-top:${MASS.rahmen}pt solid #000;overflow:hidden}
.schm-r{margin-left:auto;text-align:right}
.schm-t{font-size:${MASS.beschriftung}pt}

.unt{padding:0.3pt 3pt;border-top:${MASS.rahmen}pt solid #000;overflow:hidden}
.psy{border-top:${MASS.rahmen}pt solid #000}
.vrl{border-top:${MASS.rahmen}pt solid #000}
.vrl-kopf{display:flex;gap:6pt;padding:0.3pt 3pt;overflow:hidden}
.vrl-z{font-size:${MASS.beschriftung}pt;margin-left:auto;text-align:right}
.vrl-haupt{display:flex;border-top:${MASS.linie}pt solid #000;overflow:hidden}
.vrl-links{flex:0 0 50%;border-right:${MASS.linie}pt solid #000;padding:0.6pt 3pt}
.vrl-rechts{flex:1 1 auto;padding:0.6pt 3pt;min-width:0;overflow:hidden}
.vrl-t{font-size:${MASS.beschriftung}pt;border-bottom:${MASS.linie}pt solid #000;display:inline-block;margin-bottom:0.5pt}
.vrl-u{font-size:${MASS.beschriftung}pt;border-bottom:${MASS.linie}pt solid #000;display:inline-block;margin:0.5pt 0 0.3pt}
.vrl-zeile{display:flex;justify-content:space-between;gap:4pt;font-size:${MASS.beschriftung}pt;line-height:1.25}
.vrl-zeile b{flex:1 1 auto}
.vbr{display:flex;gap:6pt;font-size:${MASS.beschriftung}pt}
.vbr b{display:inline-block;min-width:16pt;border-bottom:${MASS.linie}pt solid #000}
.vrl-herg{border-top:${MASS.linie}pt solid #000;padding:0.2pt 3pt;overflow:hidden}
.vrl-herg .vrl-u{margin:0 0 0.2pt}
.vrl-herg .opt{line-height:1.05}
.sturz{display:flex;align-items:center;gap:3pt;line-height:1}

.erk-frei{padding:1pt 3pt;border-top:${MASS.linie}pt solid #000}
.erk-frei .frei{min-height:12pt}
.naca{display:flex;align-items:baseline;gap:4pt;padding:3pt 4pt;font-size:${MASS.ueberschrift}pt}
.news{font-size:${MASS.beschriftung}pt;padding:2pt 4pt}
`

/** Seite 1 als Blatt. */
export function seite1(p: Payload, kopf: Kopfdaten): string {
  return `<div class="blatt">
    ${kopfzeile(kopf)}
    ${stammdaten(p)}
    ${person(p)}
    ${titel()}
    ${kennung(p)}
    ${einsatzdaten(p)}
    ${notfallgeschehen(p)}
    ${erstbefund(p)}
    ${neurologie(p)}
    ${verletzungen(p)}
    ${erkrankungen(p)}
    ${naca(p)}
    ${news(p)}
  </div>`
}
