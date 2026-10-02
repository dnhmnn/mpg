// Seite 2 des ÄLRD-Bogens: Verlaufsbeschreibung, Medikation, Reanimation,
// Maßnahmen, Übergabe-Befund und die Fußblöcke.

import {
  MASS,
  block,
  schreibflaeche,
  escapeHtml,
  option,
  raster,
  schmerzskala,
  ueberschrift,
  type Payload,
} from './aelrdDruck'
import { HOEHEN2, SEITE2 } from './aelrdLayout'
import { aelrdFeld } from '../katalog/aelrd'
import type { Kopfdaten } from './aelrdSeite1'

function w(p: Payload, id: string): string {
  const v = p[id]
  return v === undefined || v === null ? '' : String(v)
}

function hak(p: Payload, id: string, text?: string): string {
  return option(text ?? aelrdFeld(id)?.label ?? id, Boolean(p[id]), true)
}

function mw(p: Payload, id: string, titel?: string, breit = false): string {
  const feld = aelrdFeld(id)
  return `<div class="zelle-mw${breit ? ' breit' : ''}">
    <span class="z-b">${escapeHtml(titel ?? feld?.label ?? id)}</span>
    <span class="z-w">${escapeHtml(w(p, id))}</span>
    <span class="z-e">${escapeHtml(feld?.einheit ?? '')}</span>
  </div>`
}

function mwPaar(p: Payload, a: string, b: string, titel: string, einheit: string): string {
  return `<div class="zelle-mw breit">
    <span class="z-b">${escapeHtml(titel)}</span>
    <span class="z-w">${escapeHtml(w(p, a))}<span class="z-s">/</span>${escapeHtml(w(p, b))}</span>
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

/**
 * Das Kurvenblatt. Der Bogen hat drei uebereinanderliegende Gitter mit
 * eigenen Skalen; die Messwerte des Verlaufs werden als Punkte eingetragen.
 */
function verlaufsblatt(p: Payload): string {
  const zeilen = Array.isArray(p.verlauf) ? (p.verlauf as Payload[]) : []
  const spalten = Math.max(zeilen.length, 18)

  const gitter = (hoehe: number, skala: string[]) => {
    const senkrecht = Array.from({ length: spalten + 1 }, (_, i) =>
      `<line x1="${(i / spalten) * 100}%" y1="0" x2="${(i / spalten) * 100}%" y2="${hoehe}" />`,
    ).join('')
    const waagrecht = Array.from({ length: 7 }, (_, i) =>
      `<line x1="0" y1="${(i / 6) * hoehe}" x2="100%" y2="${(i / 6) * hoehe}" />`,
    ).join('')
    return `<div class="dg">
      <div class="dg-s">${skala.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>
      <svg class="dg-g" viewBox="0 0 100 ${hoehe}" preserveAspectRatio="none" height="${hoehe}">
        <g stroke="#000" stroke-width="0.12">${senkrecht}${waagrecht}</g>
      </svg>
    </div>`
  }

  const zeitachse = zeilen.length
    ? `<div class="dg-z">${zeilen.map((z) => `<span>${escapeHtml(z.zeit ?? '')}</span>`).join('')}</div>`
    : '<div class="dg-z"></div>'

  return block(
    SEITE2.verlauf,
    `${ueberschrift('Verlaufsbeschreibung')}
     <div class="vb">
       <div class="vb-l"><span>SpO₂</span></div>
       ${gitter(26, ['90 →', '80 →'])}
     </div>
     <div class="vb">
       <div class="vb-l"><span>AF</span><span>O₂ Gabe</span><span>CO Hb</span></div>
       ${gitter(34, ['20 →', '10 →'])}
     </div>
     <div class="vb gross">
       <div class="vb-l"><span>HF</span><span>Puls</span><span>RR</span><span>Defi</span><span>CO₂</span><span>Transp. T-T</span><span>Intub. ↓</span><span>Extub. ↑</span></div>
       ${gitter(132, ['250 →', '200 →', '150 →', '100 →', '50 →'])}
     </div>
     ${zeitachse}`,
  )
}

function medikation(p: Payload): string {
  const zeilen = Array.isArray(p.medikation) ? (p.medikation as Payload[]) : []
  return block(
    SEITE2.medikation,
    `<div class="md-kopf" style="height:${HOEHEN2.mdKopf}pt">
       ${ueberschrift('Medikation')}
       <span class="md-k">${hak(p, 'keine_medikation', 'keine Medikation')}</span>
     </div>
     <div class="md-liste" style="height:${HOEHEN2.mdListe}pt">
       ${schreibflaeche(
         zeilen
           .map((z) => [z.zeit, z.wirkstoff, z.dosis, z.applikation].filter(Boolean).join('   '))
           .join('\n'),
         13,
         'md-f',
       )}
     </div>
     <div class="md-lyse" style="height:${HOEHEN2.mdLyse}pt">
       <span class="bf-t">Lysetherapie</span>
       ${raster('lysetherapie', p, [
         ['vor Kreislaufstillstand', 'nach ROSC'],
         ['nach Kreislaufstillstand', null],
       ])}
       <span class="md-lz"><span class="kl">Zeitpunkt Lyse</span><b>${escapeHtml(w(p, 'lyse_zeitpunkt'))}</b></span>
     </div>`,
  )
}

function reanimation(p: Payload): string {
  const z = (beschriftung: string, id: string) =>
    `<div class="re-z"><span class="kl">${escapeHtml(beschriftung)}</span><b>${escapeHtml(w(p, id))}</b></div>`
  return block(
    SEITE2.reanimation,
    `${ueberschrift('Reanimation / Tod / Todesfeststellung')}
     <div class="re">
       <div class="re-l">
         ${z('Reanimationssituation:', 'rea_situation')}
         ${z('Vermutete Ursache Rea:', 'rea_ursache')}
         ${z('Vermutete Ursache Tod:', 'tod_ursache')}
         ${z('Kollaps beobachtet durch', 'kollaps_durch')}
         ${z('HDM gestartet durch', 'hdm_durch')}
         ${z('1. Defibrillation durch', 'defi1_durch')}
         ${z('ROSC', 'rosc_zeit')}
         ${z('Krankenhausaufnahme', 'kh_aufnahme')}
         ${z('Leichenschau durchgeführt', 'leichenschau')}
       </div>
       <div class="re-r">
         ${z('Todesart:', 'todesart')}
         ${z('Zeitpunkt Defibrillation', 'defi1_zeit')}
         ${z('Todeszeitpunkt', 'todeszeitpunkt')}
       </div>
     </div>`,
  )
}

function massnahmen(p: Payload): string {
  return block(
    SEITE2.massnahmen,
    `<div class="ma-kopf" style="height:${HOEHEN2.maKopf}pt">
       ${ueberschrift('Maßnahmen')}
       <span class="ma-pvk">${hak(p, 'pvk_vorhanden', 'PVK vorhanden')}</span>
     </div>
     <div class="ma-b" style="height:${HOEHEN2.maZugaenge}pt">
       <div class="ma-t">Zugänge</div>
       <div class="frei">${escapeHtml(w(p, 'zugaenge'))}</div>
       <div class="ma-u"><span class="kl">Zugang erschwert</span>${raster('zugang_erschwert', p, [
         ['unmöglich', '> 2 Vers.', 'Verfahrenswechsel'],
       ])}</div>
     </div>
     <div class="ma-b" style="height:${HOEHEN2.maAtemweg}pt">
       <div class="ma-t">Atemweg</div>
       ${raster('atemweg_massnahme', p, [
         ['Absaugen', '> 2 Intub.-Versuche'],
         ['Atemwege freimachen', 'Maskenbeatm. unmöglich'],
         ['Entlastungspunktion', 'Verfahrenswechsel'],
       ])}
       <div class="ma-z">
         <span><span class="kl">Intubation</span> <b>${escapeHtml(w(p, 'intubation'))}</b></span>
         <span><span class="kl">Größe</span> <b>${escapeHtml(w(p, 'tubus_groesse'))}</b></span>
         <span><span class="kl">O₂-Gabe</span> <b>${escapeHtml(w(p, 'o2_gabe'))}</b> <span class="kl">Liter/min</span></span>
       </div>
     </div>
     <div class="ma-b" style="height:${HOEHEN2.maBeatmung}pt">
       <div class="ma-t">Beatmung</div>
       <div class="ma-z">${raster('beatmung_art', p, [['Spontanatmung', 'kontrollierte Beatmung']])}</div>
       <div class="ma-w">
         ${['beatmung_fio2', 'beatmung_af', 'beatmung_amv', 'beatmung_peep', 'beatmung_pinsp']
           .map((id) => `<span class="ma-f"><span class="kl">${escapeHtml(aelrdFeld(id)?.label ?? '')}</span><b>${escapeHtml(w(p, id))}</b></span>`)
           .join('')}
       </div>
       <div class="ma-w">
         ${['beatmung_mode', 'beatmung_art2', 'beatmung_flow']
           .map((id) => `<span class="ma-f"><span class="kl">${escapeHtml(aelrdFeld(id)?.label ?? '')}</span><b>${escapeHtml(w(p, id))}</b></span>`)
           .join('')}
       </div>
       <div class="ma-u"><span class="kl">manuell</span>${raster('beatmung_manuell', p, [['Demandventil', 'Rückatmung']])}</div>
     </div>
     <div class="ma-b" style="height:${HOEHEN2.maDefi}pt">
       <div class="ma-zwei">
         <div>
           <div class="ma-t">Defibrillation</div>
           ${raster('defi_art', p, [['monophasisch'], ['biphasisch']])}
           <div class="ma-z"><b>${escapeHtml(w(p, 'defi_joule_1'))}</b> <span class="kl">Joule — 1. Defibrillation</span></div>
           <div class="ma-z"><b>${escapeHtml(w(p, 'defi_gesamt'))}</b> <span class="kl">Defibrillationen Gesamt</span></div>
           <div class="ma-z"><b>${escapeHtml(w(p, 'defi_joule_letzte'))}</b> <span class="kl">Joule — letzte Defibrillation</span></div>
           <div class="ma-z"><b>${escapeHtml(w(p, 'rosc_1'))}</b> <span class="kl">1. ROSC</span></div>
         </div>
         <div class="ma-pacer">
           <div class="ma-t">Pacer</div>
           ${['pacer_frequenz', 'pacer_intensitaet', 'pacer_mode']
             .map((id) => `<div class="ma-z"><span class="kl">${escapeHtml(aelrdFeld(id)?.label ?? '')}</span> <b>${escapeHtml(w(p, id))}</b></div>`)
             .join('')}
         </div>
       </div>
     </div>
     <div class="ma-b" style="height:${HOEHEN2.maRest}pt">
       <div class="ma-zwei">
         <div class="ma-links">
           <div class="ma-t">Reanimation</div>
           ${raster('rea_massnahme', p, [['Herzdruckmassage'], ['Feedbacksystem'], ['mechanische Thoraxkompression']])}
           <div class="ma-t">Aktive Kühlung</div>
           ${raster('aktive_kuehlung', p, [['Infusion', 'Kühlpackungen'], ['technisch', 'andere']])}
           <div class="ma-t">Lagerungs- und Rettungstechnik</div>
           <div class="frei">${escapeHtml(w(p, 'lagerung'))}</div>
           <div class="ma-t">Sonstige</div>
           ${raster('sonstige_massnahme', p, [['Thoraxdrainage /', 'Entlastungspunktion'], ['Magensonde', null]])}
           <div class="ma-u"><span class="kl">Blutentnahme</span>${raster('blutentnahme', p, [['venös', 'arteriell']])}</div>
           <div class="ma-u"><span class="kl">Wärmeerhalt</span>${raster('waermeerhalt', p, [['passiv', 'aktiv']])}</div>
         </div>
         <div class="ma-rechts">
           <div class="ma-t">Erweitertes Monitoring</div>
           ${raster('erweitertes_monitoring', p, [
             ['kein erw. Monitoring'], ['12-Kanal EKG'], ['invasiver RR'], ['Kapnometrie'],
             ['ZVD'], ['ICP'], ['12-Kanal EKG vorhanden/durch Andere'], ['sonstiges Monitoring'],
           ])}
           <div class="ma-t">Medizintechnik</div>
           ${raster('medizintechnik', p, [
             ['keine Medizintechnik'], ['Spritzenpumpe(n)'], ['Ultraschall (Sono/Echo)'], ['Notfallpacer'],
             ['Funk EKG Übermittlung'], ['Videolaryngoskopie'], ['Transportinkubator'], ['ECMO'],
             ['mechanische Thoraxkompression'], ['andere MedTech'],
           ])}
         </div>
       </div>
     </div>`,
  )
}

function uebergabeBefund(p: Payload): string {
  return block(
    SEITE2.uebergabe,
    `<div class="eb-kopf" style="height:${HOEHEN2.ubKopf}pt">
       ${ueberschrift('Übergabe')}
       <span class="eb-zp"><span class="eb-zw">${escapeHtml(w(p, 'ub_zeitpunkt'))}</span><span class="kl">Zeitpunkt</span></span>
     </div>
     <div class="bf" style="height:${HOEHEN2.ubAtemwege}pt">
       <span class="bf-t">Atemwege</span>
       ${raster('ub_atemwege', p, [
         [null, 'frei', 'Stridor insp.', 'Stridor exsp.'],
         ['nicht untersucht', 'nicht beurteilbar', 'Atemwegsverlegung', 'gefährdet'],
       ])}
     </div>
     <div class="bf" style="height:${HOEHEN2.ubAtmung}pt">
       <span class="bf-t">Atmung</span>
       ${raster('ub_atmung', p, [
         [null, 'unauffällig', 'Spastik', 'Rasselgeräusche', 'Apnoe', 'Sonstige'],
         ['nicht untersucht', 'nicht beurteilbar', 'Ruhedyspnoe', 'Schnappatmung', 'Beatmung', null],
         ['Belastungsdyspnoe', 'Tachypnoe', 'Zyanose', 'Hyperventilation', 'Bradypnoe', null],
       ])}
     </div>
     <div class="krsl" style="height:${HOEHEN2.ubKreislauf}pt">
       <div class="krsl-o">
         <span class="bf-t">Kreislauf</span>
         <div class="kr-l">${raster('ub_kreislauf', p, [[null, 'unauffällig'], ['nicht untersucht', null]])}</div>
         <div class="kr-r">
           <div class="kr-z"><span class="kl">Puls regelmäßig:</span><b>${escapeHtml(w(p, 'ub_puls_regelmaessig'))}</b><b class="kr-rp">${escapeHtml(w(p, 'ub_radialispuls'))}</b></div>
           <div class="kr-z"><span class="kl">Rekap. Zeit:</span><b>${escapeHtml(w(p, 'ub_rekap'))}</b><b class="kr-rp">${escapeHtml(w(p, 'ub_schockzeichen'))}</b></div>
         </div>
       </div>
     </div>
     <div class="bf" style="height:${HOEHEN2.ubEkg}pt">
       <span class="bf-t">EKG</span>
       ${raster('ub_ekg', p, [['kein EKG', 'Sinusrhythmus']])}
     </div>
     <div class="bf" style="height:${HOEHEN2.ubPsyche}pt">
       <span class="bf-t">Psyche</span>
       ${raster('ub_psyche', p, [
         ['aggressiv', 'verwirrt', 'verlangsamt', 'suizidal', 'nicht beurteilbar'],
         ['unauffällig', 'depressiv', 'erregt', 'euphorisch', 'Sonstige', 'nicht untersucht'],
         [null, 'wahnhaft', 'ängstlich', 'motorisch unruhig', null, null],
       ])}
     </div>
     <div class="unt" style="height:${HOEHEN2.ubUntersuchung}pt">
       ${ueberschrift('Untersuchung Übergabe')}
       ${schreibflaeche(w(p, 'ub_untersuchung'), 3, 'unt-f')}
     </div>`,
  )
}

function neurologieUebergabe(p: Payload): string {
  return block(
    SEITE2.neurologieUebergabe,
    `<div class="nr-kopf" style="height:${HOEHEN2.nuKopf}pt">
       <div class="nr-l">
         ${ueberschrift('Neurologie')}
         ${hak(p, 'ub_neuro_ohne_befund', 'ohne path. Befund')}
         <div class="pup-k"><span class="kl">Pupillenstatus</span><span class="pup-s">rechts</span><span class="pup-s">links</span></div>
         <div class="pup-z"><span class="kl">Weite</span><span>${escapeHtml(w(p, 'ub_pupillen_weite_re'))}</span><span>${escapeHtml(w(p, 'ub_pupillen_weite_li'))}</span></div>
         <div class="pup-z"><span class="kl">Lichtreaktion</span><span>${escapeHtml(w(p, 'ub_pupillen_licht_re'))}</span><span>${escapeHtml(w(p, 'ub_pupillen_licht_li'))}</span></div>
       </div>
       <div class="nr-bw">
         <div><span class="kl">Bewusstsein:</span> <b>${escapeHtml(w(p, 'ub_bewusstsein'))}</b></div>
         <div class="gcs">
           ${['ub_gcs_augen', 'ub_gcs_verbal', 'ub_gcs_motorik', 'ub_gcs_summe']
             .map((id) => `<span class="gz"><b>${escapeHtml(w(p, id))}</b><span class="kl">${escapeHtml(aelrdFeld(id)?.label ?? '')}</span></span>`)
             .join('')}
           <span class="gcs-t">GCS</span>
         </div>
       </div>
     </div>
     <div class="schm" style="height:${HOEHEN2.nuSchmerzen}pt">
       <span class="bf-t">Schmerzen</span>
       ${schmerzskala('ub_schmerz', p)}
       <div class="schm-r">
         ${hak(p, 'ub_schmerz_nicht_beurteilbar', 'NRS nicht beurteilbar')}
         <div class="schm-t"><b>${escapeHtml(w(p, 'ub_schmerz_tolerabel'))}</b></div>
       </div>
     </div>
     <div class="mwi" style="height:${HOEHEN2.nuMesswerte}pt">
       ${ueberschrift('Messwerte Übergabe')}
       <div class="mw-reihe">
         ${mw(p, 'ub_af', 'AF')}${mw(p, 'ub_spo2', 'SpO₂')}${mw(p, 'ub_hf', 'HF')}${mw(p, 'ub_puls', 'Puls')}${mw(p, 'ub_etco2', 'etCO₂')}
       </div>
       <div class="mw-reihe">
         ${mwPaar(p, 'ub_nibp_sys', 'ub_nibp_dia', 'NIBP', 'mmHg')}
         ${mwPaar(p, 'ub_ibp_sys', 'ub_ibp_dia', 'IBP', 'mmHg')}
         ${mw(p, 'ub_bz', 'BZ')}${mw(p, 'ub_temp', 'Temp.')}
       </div>
     </div>`,
  )
}

function fussbloecke(p: Payload): string {
  return `${block(
    SEITE2.besonderheiten,
    `<div class="fb"><span class="kl">Einsatzverlauf - Besonderheiten</span>${schreibflaeche(w(p, 'besonderheiten'), 5, 'unt-f')}</div>`,
  )}
  ${block(
    SEITE2.wertsachen,
    `<div class="fb"><span class="kl">Wertsachen</span>${schreibflaeche(w(p, 'wertsachen'), 5, 'unt-f')}<div class="unterschrift"><span class="kl">Unterschrift</span></div></div>`,
  )}
  ${block(
    SEITE2.uebergabeAn,
    `<div class="fb">
       <span class="kl">Übergabe an</span><div class="fb-w linie">${escapeHtml(w(p, 'uebergabe_an'))}</div>
       <span class="kl">Übergabeort</span><div class="fb-w linie">${escapeHtml(w(p, 'uebergabeort'))}</div>
     </div>`,
  )}
  ${block(
    SEITE2.bemerkungen,
    `<div class="fb">
       <span class="kl">ÄLRD Delegationen</span>${schreibflaeche(w(p, 'aelrd_delegationen'), 2, 'unt-f')}
       <span class="kl">Bemerkungen (z.B. Hausarzt)</span>${schreibflaeche(w(p, 'bemerkungen'), 3, 'unt-f')}
       <div class="fb-naca"><span class="kl">NACA SCORE Übergabe:</span> <b>${escapeHtml(
         w(p, 'naca_uebergabe'),
       )}</b><span class="fb-nf">${hak(p, 'notarzt_nachgefordert', 'Notarzt nachgefordert')}</span></div>
     </div>`,
  )}`
}

export const STIL_SEITE2 = `
.vb{display:flex;align-items:stretch;gap:2pt;padding:0.5pt 3pt}
.vb-l{flex:0 0 40pt;display:flex;flex-direction:column;font-size:${MASS.klein}pt;line-height:1.3}
.vb.gross .vb-l{justify-content:space-between}
.dg{flex:1 1 auto;display:flex;gap:2pt;min-width:0}
.dg-s{flex:0 0 22pt;display:flex;flex-direction:column;justify-content:space-between;font-size:${MASS.klein}pt;text-align:right}
.dg-g{flex:1 1 auto;width:100%}
.dg-z{display:flex;justify-content:space-between;padding:0 3pt 0 64pt;font-size:${MASS.klein}pt}

.md-kopf{display:flex;justify-content:space-between;align-items:baseline;padding-right:4pt;overflow:hidden}
.md-liste{padding:1pt 3pt;overflow:hidden}
.md-f .inhalt{font-size:${MASS.beschriftung}pt;line-height:8.44pt;font-weight:bold}
.md-z{display:flex;gap:6pt;font-size:${MASS.beschriftung}pt;line-height:1.5}
.md-lyse{display:flex;align-items:flex-start;gap:4pt;padding:0.5pt 3pt;border-top:${MASS.linie}pt solid #000;overflow:hidden}
.md-lz{margin-left:auto;text-align:right;font-size:${MASS.beschriftung}pt}

.re{display:flex;gap:6pt;padding:0.5pt 3pt;overflow:hidden}
.re-l{flex:1 1 60%}
.re-r{flex:1 1 40%}
.re-z{display:flex;gap:4pt;font-size:${MASS.klein}pt;line-height:1.35}
.re-z b{flex:1 1 auto}

.ma-kopf{display:flex;justify-content:space-between;align-items:baseline;padding-right:4pt;overflow:hidden}
.ma-b{padding:0.5pt 3pt;border-top:${MASS.linie}pt solid #000;overflow:hidden}
.ma-t{font-size:${MASS.beschriftung}pt;margin-top:0.5pt}
.ma-u{display:flex;align-items:baseline;gap:3pt;margin-top:0.5pt}
.ma-z{font-size:${MASS.klein}pt;line-height:1.4;display:flex;gap:3pt;align-items:baseline}
.ma-z b{flex:0 0 26pt;min-height:6pt}
.ma-w{display:flex;gap:3pt;margin-top:0.5pt}
.ma-f{display:flex;flex-direction:column-reverse;flex:1 1 0;min-width:0;font-size:${MASS.klein}pt}
.ma-f b{min-height:7pt}
.ma-zwei{display:flex;gap:4pt;height:100%}
.ma-zwei > *{flex:1 1 0;min-width:0}
.ma-pacer{border-left:${MASS.linie}pt solid #000;padding-left:3pt;flex:0 0 42%}
.ma-links{flex:1 1 58%}
.ma-rechts{flex:0 0 40%;border-left:${MASS.linie}pt solid #000;padding-left:3pt}

.nr-l{flex:1 1 auto;min-width:0}
.fb{padding:1pt 3pt;height:100%;display:flex;flex-direction:column}
.fb-w{font-size:${MASS.ueberschrift}pt;margin-bottom:3pt}
.fb-w.linie{min-height:11pt}
.fb-fl{flex:1 1 auto;border-bottom:none}
.fb-naca{margin-top:auto;display:flex;align-items:baseline;gap:4pt;font-size:${MASS.ueberschrift}pt}
.fb-nf{margin-left:auto}
.unterschrift{margin-top:auto;border-top:${MASS.linie}pt solid #000;text-align:center}
`

/** Seite 2 als Blatt. */
export function seite2(p: Payload, kopf: Kopfdaten): string {
  return `<div class="blatt">
    ${kopfzeile(kopf)}
    ${verlaufsblatt(p)}
    ${medikation(p)}
    ${reanimation(p)}
    ${massnahmen(p)}
    ${uebergabeBefund(p)}
    ${neurologieUebergabe(p)}
    ${fussbloecke(p)}
  </div>`
}
