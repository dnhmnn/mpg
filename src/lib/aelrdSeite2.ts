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
  wortlaut,
  type Payload,
} from './aelrdDruck'
import { HOEHEN2, SEITE2 } from './aelrdLayout'
import { aelrdFeld } from '../katalog/aelrd'
import {
  GITTER, SPALTEN, SPALTEN_JE_BESCHRIFTUNG, VERLAUFSWERTE,
  anteilImGitter, hoeheAnteil, kurvenspalten, stelle, uhrzeit, zeitachse, type Gitter,
} from '../katalog/verlaufswerte'
import type { Kopfdaten } from './aelrdSeite1'

/** Der Wortlaut eines Feldes — bei Auswahlen der Optionstext, nicht der Schluessel. */
function w(p: Payload, id: string): string {
  return wortlaut(p, id)
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
 *
 * Die Zeichen sind die der Vorlage: Fuenfeck fuer SpO2, Sechseck fuer die
 * Atemfrequenz, gefuellte Kuppel fuer die Herzfrequenz, offene fuer den Puls,
 * Hantel fuer den Blutdruck. Welcher Wert auf welche Hoehe gehoert, rechnet
 * hoeheImGitter aus den Skalen der Vorlage.
 */
function zeichen(art: string, x: number, y: number, farbe: string): string {
  const voll = art.endsWith('_voll')
  const fuellung = voll ? farbe : 'none'
  const strich = `stroke="${farbe}" stroke-width="0.5" fill="${fuellung}"`
  // Die Zeichen sind in der Breite gestaucht, weil das Gitter auf 100 Einheiten
  // gerechnet wird, in der Hoehe aber auf Punkte: ein Kreis waere ein Strich.
  const b = 1.1
  const h = 2.2
  if (art.startsWith('fuenfeck')) {
    const punkte = [[0, -h], [b, -h * 0.2], [b * 0.6, h * 0.8], [-b * 0.6, h * 0.8], [-b, -h * 0.2]]
      .map(([dx, dy]) => `${(x + dx).toFixed(2)},${(y + dy).toFixed(2)}`).join(' ')
    return `<polygon points="${punkte}" ${strich} />`
  }
  if (art.startsWith('sechseck')) {
    const punkte = [[0, -h], [b, -h * 0.5], [b, h * 0.5], [0, h], [-b, h * 0.5], [-b, -h * 0.5]]
      .map(([dx, dy]) => `${(x + dx).toFixed(2)},${(y + dy).toFixed(2)}`).join(' ')
    return `<polygon points="${punkte}" ${strich} />`
  }
  if (art.startsWith('kuppel')) {
    return `<path d="M${(x - b).toFixed(2)} ${y.toFixed(2)} A ${b} ${h} 0 0 1 ${(x + b).toFixed(2)} ${y.toFixed(2)} Z" ${strich} />`
  }
  return ''
}

/** Der Blutdruck: zwei Spitzen, durch einen Strich verbunden. */
function druckzeichen(x: number, oben: number, unten: number, farbe: string): string {
  const b = 1.1
  const strich = `stroke="${farbe}" stroke-width="0.5" fill="none"`
  return [
    `<line x1="${x.toFixed(2)}" y1="${oben.toFixed(2)}" x2="${x.toFixed(2)}" y2="${unten.toFixed(2)}" ${strich} />`,
    `<path d="M${(x - b).toFixed(2)} ${(oben - 2.4).toFixed(2)} L${x.toFixed(2)} ${oben.toFixed(2)} L${(x + b).toFixed(2)} ${(oben - 2.4).toFixed(2)}" ${strich} />`,
    `<path d="M${(x - b).toFixed(2)} ${(unten + 2.4).toFixed(2)} L${x.toFixed(2)} ${unten.toFixed(2)} L${(x + b).toFixed(2)} ${(unten + 2.4).toFixed(2)}" ${strich} />`,
  ].join('')
}

/**
 * Was im Kasten der Verlaufsbeschreibung neben den Gittern noch Platz
 * braucht — gemessen am gedruckten Blatt, in Bildpunkten wie die Gitter.
 */
const VERLAUF_KOPF = 12.2      // die Überschrift
const VERLAUF_ZEITACHSE = 8    // die Zeile mit den Uhrzeiten
const VERLAUF_POLSTER = 4      // je Reihe 0,5 pt oben und unten

function verlaufsblatt(p: Payload): string {
  // Auf der Kurve steht nicht nur der Verlauf: Erstbefund und Übergabe
  // erheben dieselben Werte und gehören auf dieselbe Achse.
  const zeilen = kurvenspalten(p) as unknown as Payload[]
  // Die Gitter füllen den Kasten aus. Seine Höhe steht in Punkt, gezeichnet
  // wird in Bildpunkten — drei Punkt sind vier Bildpunkte.
  const frei = (SEITE2.verlauf.h * 4) / 3 - VERLAUF_KOPF - VERLAUF_ZEITACHSE - VERLAUF_POLSTER
  const hoeheVon = (g: Gitter) => Math.round(frei * g.anteil * 10) / 10
  // Die Achse steht fest, bevor der erste Punkt gezeichnet wird: die Punkte
  // sitzen auf ihrer Uhrzeit, nicht in der Reihenfolge der Eingabe.
  const achse = zeitachse(zeilen.map((z) => String(z.zeit ?? '')))
  const stelleVon = (z: Payload): number | null =>
    achse ? stelle(achse, String(z.zeit ?? '')) : null

  const werteVon = (z: Payload): Record<string, unknown> =>
    z.werte && typeof z.werte === 'object' ? (z.werte as Record<string, unknown>) : z

  const punkte = (gitterId: string, hoehe: number): string => {
    const aus: string[] = []
    zeilen.forEach((z) => {
      const w = werteVon(z)
      const x = stelleVon(z)
      if (x === null) return
      for (const v of VERLAUFSWERTE) {
        if (v.gitter !== gitterId) continue
        const roh = String(w[v.id] ?? '').replace(',', '.').trim()
        if (roh === '') continue
        const anteil = anteilImGitter(v.id, Number(roh))
        if (anteil === null) continue
        const y = anteil * hoehe
        if (v.zeichen === 'druck') {
          // Der systolische Wert traegt die Hantel; ohne diastolischen bleibt
          // sie eine Spitze.
          if (v.id !== 'rr_sys') continue
          const untenAnteil = anteilImGitter('rr_dia', Number(String(w.rr_dia ?? '').replace(',', '.')))
          aus.push(druckzeichen(x, y, untenAnteil === null ? y : untenAnteil * hoehe, v.farbe))
          continue
        }
        // Die Stufenlinie wird nicht Punkt fuer Punkt gezeichnet, sondern
        // als Ganzes — siehe stufenlinie().
        if (v.zeichen === 'stufe') continue
        aus.push(zeichen(v.zeichen, x, y, v.farbe))
      }
    })
    return aus.join('')
  }

  /**
   * Die O2-Gabe als Stufenlinie: sie gilt ab der Messung weiter, bis die
   * naechste sie aendert. Ein Punkt wuerde behaupten, dazwischen sei nichts
   * gegeben worden.
   */
  const stufenlinie = (gitterId: string, hoehe: number): string => {
    const v = VERLAUFSWERTE.find((x) => x.zeichen === 'stufe' && x.gitter === gitterId)
    if (!v) return ''
    const stellen: { x: number; y: number }[] = []
    zeilen.forEach((z) => {
      const roh = String(werteVon(z)[v.id] ?? '').replace(',', '.').trim()
      const x = stelleVon(z)
      if (roh === '' || x === null) return
      const anteil = anteilImGitter(v.id, Number(roh))
      if (anteil !== null) stellen.push({ x, y: anteil * hoehe })
    })
    stellen.sort((a, b) => a.x - b.x)
    if (stellen.length === 0) return ''
    const d: string[] = [`M${stellen[0].x.toFixed(2)} ${stellen[0].y.toFixed(2)}`]
    for (let i = 1; i < stellen.length; i += 1) {
      d.push(`L${stellen[i].x.toFixed(2)} ${stellen[i - 1].y.toFixed(2)}`)
      d.push(`L${stellen[i].x.toFixed(2)} ${stellen[i].y.toFixed(2)}`)
    }
    // Der letzte Wert gilt noch ein Feld weiter.
    const letzte = stellen[stellen.length - 1]
    d.push(`L${Math.min(100, letzte.x + 100 / SPALTEN).toFixed(2)} ${letzte.y.toFixed(2)}`)
    return `<path d="${d.join(' ')}" stroke="${v.farbe}" stroke-width="0.5" fill="none" />`
  }

  const gitter = (g: Gitter) => {
    const hoehe = hoeheVon(g)
    // Das feine Netz der Vorlage: sechsunddreissig Felder breit, und in der
    // Hoehe so viele, wie das Gitter fuehrt — beim Kreislauf liegt zwischen
    // zwei beschrifteten Linien noch eine.
    const senkrecht = Array.from({ length: SPALTEN + 1 }, (_, i) =>
      `<line x1="${((i / SPALTEN) * 100).toFixed(3)}%" y1="0" x2="${((i / SPALTEN) * 100).toFixed(3)}%" y2="${hoehe}" />`,
    ).join('')
    const waagrecht = Array.from({ length: g.zeilen + 1 }, (_, i) =>
      `<line x1="0" y1="${((i / g.zeilen) * hoehe).toFixed(2)}" x2="100%" y2="${((i / g.zeilen) * hoehe).toFixed(2)}" />`,
    ).join('')
    // Die Pfeile stehen auf den Linien, zu denen sie gehoeren — sonst waere
    // nicht abzulesen, welche Hoehe welchen Wert meint.
    const beschriftung = (liste: { text: string; wert: number }[], rechts: boolean) =>
      liste.map((s) => {
        const y = hoeheAnteil(g, s.wert, rechts)
        return `<span style="top:${(y * 100).toFixed(2)}%">${escapeHtml(s.text)}</span>`
      }).join('')
    return `<div class="dg">
      <div class="dg-s">${beschriftung(g.skala, false)}</div>
      <svg class="dg-g" viewBox="0 0 100 ${hoehe}" preserveAspectRatio="none" height="${hoehe}">
        <g stroke="#000" stroke-width="0.12">${senkrecht}${waagrecht}</g>
        ${stufenlinie(g.id, hoehe)}${punkte(g.id, hoehe)}
      </svg>
      ${g.skalaRechts ? `<div class="dg-s dg-r">${beschriftung(g.skalaRechts, true)}</div>` : ''}
    </div>`
  }

  // Unter dem Gitter steht alle sechs Felder eine Uhrzeit — wie auf der
  // Vorlage, und unabhaengig davon, wann gemessen wurde.
  const achsenbeschriftung = achse
    ? `<div class="dg-z">${Array.from(
        { length: Math.floor(SPALTEN / SPALTEN_JE_BESCHRIFTUNG) + 1 },
        (_, i) => {
          const feld = i * SPALTEN_JE_BESCHRIFTUNG
          const text = uhrzeit(achse.start + feld * achse.schritt)
          return `<span style="left:${((feld / SPALTEN) * 100).toFixed(2)}%">${escapeHtml(text)}</span>`
        },
      ).join('')}</div>`
    : '<div class="dg-z"></div>'

  const g = (id: string) => GITTER.find((x) => x.id === id)!

  return block(
    SEITE2.verlauf,
    `${ueberschrift('Verlaufsbeschreibung')}
     <div class="vb">
       <div class="vb-l"><span>SpO₂</span></div>
       ${gitter(g('spo2'))}
     </div>
     <div class="vb">
       <div class="vb-l"><span>AF</span><span>O₂ Gabe</span><span>CO Hb</span></div>
       ${gitter(g('af'))}
     </div>
     <div class="vb gross">
       <div class="vb-l"><span>HF</span><span>Puls</span><span>RR</span><span>Defi</span><span>CO₂</span><span>Transp. T-T</span><span>Intub. ↓</span><span>Extub. ↑</span></div>
       ${gitter(g('hf'))}
     </div>
     ${achsenbeschriftung}`,
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
       <div class="mw-zusatz"><span><span class="kl">mit O₂?</span> <b>${escapeHtml(w(p, 'ub_spo2_mit_o2'))}</b></span>
       </div>
       <div class="mw-reihe">
         ${mwPaar(p, 'ub_nibp_sys', 'ub_nibp_dia', 'NIBP', 'mmHg')}
         ${mwPaar(p, 'ub_ibp_sys', 'ub_ibp_dia', 'IBP', 'mmHg')}
         ${mw(p, 'ub_bz', 'BZ')}${mw(p, 'ub_temp', 'Temp.')}
       </div>
     </div>`,
  )
}

/**
 * Die gezeichnete Unterschrift als Bild über der Linie.
 *
 * Nur echte Bild-Datenadressen werden übernommen. Alles andere kommt nicht
 * ins Dokument: der Wert stammt aus der Payload, und was von dort in HTML
 * geschrieben wird, muss geprüft sein.
 */
function unterschriftBild(p: Payload): string {
  const roh = typeof p.signature === 'string' ? p.signature : ''
  if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(roh)) return '<div class="sig-raum"></div>'
  return `<div class="sig-raum"><img src="${roh}" alt=""></div>`
}

function fussbloecke(p: Payload): string {
  return `${block(
    SEITE2.besonderheiten,
    `<div class="fb"><span class="kl">Einsatzverlauf - Besonderheiten</span>${schreibflaeche(w(p, 'besonderheiten'), 5, 'unt-f')}</div>`,
  )}
  ${block(
    SEITE2.wertsachen,
    `<div class="fb"><span class="kl">Wertsachen</span>${schreibflaeche(w(p, 'wertsachen'), 5, 'unt-f')}${unterschriftBild(p)}<div class="unterschrift"><b>${escapeHtml(w(p, 'unterschrift'))}</b><span class="kl">Unterschrift</span></div></div>`,
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
.dg-s{flex:0 0 22pt;position:relative;font-size:${MASS.klein}pt;text-align:right}
.dg-s span{position:absolute;right:0;transform:translateY(-50%);white-space:nowrap}
.dg-r{flex:0 0 14pt;text-align:left}
.dg-r span{right:auto;left:0}
.dg-g{flex:1 1 auto;width:100%}
.dg-z{position:relative;height:6pt;margin:0 17pt 0 64pt;font-size:${MASS.klein}pt}
.dg-z span{position:absolute;transform:translateX(-50%);white-space:nowrap}

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
.sig-raum{margin-top:auto;text-align:center;line-height:0}
.sig-raum img{max-width:100%;max-height:26pt;object-fit:contain}
.unterschrift{border-top:${MASS.linie}pt solid #000;text-align:center}
.unterschrift b{display:block;font-size:${MASS.ueberschrift}pt}
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
