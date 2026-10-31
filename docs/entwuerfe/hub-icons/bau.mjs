// Richtung „j-kacheln": zwei Erscheinungen derselben 14 Motive.
//  Hell  (icons.json):        jede App hat ihre eigene tiefe, gedämpfte Kachelfarbe aus der
//                             erweiterten LBF-Palette; Motiv aus durchscheinenden Elfenbein-
//                             flächen (screen → Überlagerungen werden heller), höchstens ein
//                             kleines Messing-Detail. Rot nur dort, wo es etwas bedeutet
//                             (Einsätze, Patienten).
//  Dunkel (icons-dunkel.json): alle Kacheln Bordeaux. Die hintere Fläche („Ton“) wird zur
//                             deckenden Einlage im Echo der hellen Kachelfarbe (heller,
//                             gedämpft), getrennt durch schmale Bordeaux-Fugen. Messing bleibt.
// Aufruf: node bau.mjs  → icons.json und icons-dunkel.json im selben Ordner
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HIER = dirname(fileURLToPath(import.meta.url))

// ── Palette ───────────────────────────────────────────────────────────────
const ELF = '#faf3ea'      // Elfenbein, vorderste Fläche
const CREME = '#fde8d8'    // Creme, Zwischenstufe
const MESSING = '#c9a45c'  // gedämpftes Altgold, deckend
const HOCH = 0.9           // Hauptform
const MITTE = 0.5          // zweite Ebene
const TON = 0.26           // Tonfläche, Rückseite
const SCR = 'mix-blend-mode:screen'
const FUGE = 5             // Fugenbreite im Dunkelmodus (2,5 je Seite)

// Kachel oben, Kachel unten, Echo im Dunkelmodus (hell, gedämpft, auf Bordeaux lesbar)
const F = {
  rosso:      ['#8c1626', '#5f0d18', '#d06a56'], // rosso scuro — Alarm
  terracotta: ['#94412a', '#672b1a', '#dc9e78'], // Patienten
  oliva:      ['#5f6a34', '#3f4721', '#b6be86'], // Einsatzführung, Feld
  ardesia:    ['#564c45', '#3a322d', '#bfb2a6'], // Verwaltung
  tabacco:    ['#7a5432', '#553a21', '#d0a274'], // Karton, Lager
  petrolio:   ['#2f6066', '#1f4246', '#88b8b3'], // Medizintechnik
  senape:     ['#7f5f12', '#5a430b', '#dabb62'], // Lernen
  salvia:     ['#567562', '#3a5244', '#abc5b1'], // Ausbildung
  grafite:    ['#45403d', '#2c2826', '#b6aea6'], // Ablage
  prugna:     ['#62304a', '#421f32', '#ab97ae'], // Schreibstube
  schiefer:   ['#41607a', '#2c4255', '#9ab2c6'], // Kommunikation
  ocra:       ['#99691f', '#6e4a14', '#e2b76a'], // Notizen
  inchiostro: ['#343e5e', '#222940', '#9ba9cd'], // Personen
  cappuccino: ['#7d6d5a', '#584c3f', '#d3c1aa'], // System
}
// Auf diesen Kacheln trägt Messing nicht → Detail in Elfenbein
const MESSING_SCHWACH = new Set(['senape', 'ocra'])
const BORDEAUX = ['#680b16', '#43050b']

// ── Geometrie ─────────────────────────────────────────────────────────────
const z = (n) => Math.round(n * 100) / 100
const rr = (x, y, w, h, r) => {
  const [a, b, c, d] = [x, y, x + w, y + h].map(z)
  if (!r) return `M${a} ${b}H${c}V${d}H${a}Z`
  return `M${z(x + r)} ${b}H${z(x + w - r)}A${r} ${r} 0 0 1 ${c} ${z(y + r)}V${z(y + h - r)}A${r} ${r} 0 0 1 ${z(x + w - r)} ${d}H${z(x + r)}A${r} ${r} 0 0 1 ${a} ${z(y + h - r)}V${z(y + r)}A${r} ${r} 0 0 1 ${z(x + r)} ${b}Z`
}
/** Kreis im Uhrzeigersinn (damit Vereinigungen mit anderen Teilpfaden keine Löcher geben) */
const kreisD = (cx, cy, r) => `M${z(cx - r)} ${cy}A${r} ${r} 0 1 1 ${z(cx + r)} ${cy}A${r} ${r} 0 1 1 ${z(cx - r)} ${cy}Z`
/** Punkt auf Kreis; 0° = oben, im Uhrzeigersinn */
const pol = (cx, cy, r, g) => {
  const w = (g - 90) * Math.PI / 180
  return [z(cx + r * Math.cos(w)), z(cy + r * Math.sin(w))]
}
const bogen = (cx, cy, r, a, b) => {
  const [x1, y1] = pol(cx, cy, r, a)
  const [x2, y2] = pol(cx, cy, r, b)
  return `M${x1} ${y1}A${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x2} ${y2}`
}
/** Ringsegment zwischen ri und ra, Winkel a..b */
const sektor = (cx, cy, ri, ra, a, b) => {
  const [x1, y1] = pol(cx, cy, ra, a), [x2, y2] = pol(cx, cy, ra, b)
  const [x3, y3] = pol(cx, cy, ri, b), [x4, y4] = pol(cx, cy, ri, a)
  return `M${x1} ${y1}A${ra} ${ra} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${ri} ${ri} 0 0 0 ${x4} ${y4}Z`
}

// Schnitte (Aussparungen) als Maskenmarkup in Schwarz
const schnitt = (d) => `<path d="${d}" fill="#000"/>`
const schnittLinie = (d, w, cap = 'round') =>
  `<path d="${d}" fill="none" stroke="#000" stroke-width="${w}" stroke-linecap="${cap}" stroke-linejoin="round"/>`

// ── Bauteile ──────────────────────────────────────────────────────────────
// rd: Rolle im Dunkelmodus, falls abweichend (z. B. Glashaube: hell Elfenbein, dunkel Echo)
// T  Tonfläche / Rückseite   hell: Elfenbein 26 % screen   dunkel: Echo-Farbe deckend, mit Fugen
// V  Vorderfläche            beide: Elfenbein 90 % screen
// M  Zwischenfläche          beide: Creme 50 % screen
// A  Messing-Detail          hell: Messing (auf Senf/Ocker Elfenbein)   dunkel: Messing
// L  helle Linie             (echo: true → im Dunkelmodus wie T)
// AL Messing-Linie
const T = (d, o = {}) => ({ r: 'T', d, ...o })
const V = (d, o = {}) => ({ r: 'V', d, ...o })
const M = (d, o = {}) => ({ r: 'M', d, ...o })
const A = (d, o = {}) => ({ r: 'A', d, ...o })
const L = (d, w, o = {}) => ({ r: 'L', d, w, ...o })
const AL = (d, w, o = {}) => ({ r: 'AL', d, w, ...o })

let mz = 0
const maske = (schnitte) => {
  const id = `m${++mz}`
  return [id, `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#fff"/>${schnitte}</mask>`]
}
const mitTf = (tf, s) => (tf ? `<g transform="${tf}">${s}</g>` : s)
/** Gruppe mit optionaler Maske, Deckkraft und screen */
const gruppe = (inhalt, { schnitte = '', o = 1, scr = false }) => {
  const att = (o < 1 ? ` opacity="${o}"` : '') + (scr ? ` style="${SCR}"` : '')
  if (!schnitte) return `<g${att}>${inhalt}</g>`
  const [id, m] = maske(schnitte)
  return `${m}<g mask="url(#${id})"${att}>${inhalt}</g>`
}
const form = (p, c) => mitTf(p.tf, `<path d="${p.d}" fill="${c}"/>`)
const strich = (p, c) => mitTf(p.tf, `<path d="${p.d}" fill="none" stroke="${c}" stroke-width="${p.w}" stroke-linecap="${p.cap ?? 'round'}" stroke-linejoin="round"/>`)
/** Fuge: späteres Teil samt Rand aus der Ton-Einlage schneiden */
const fugeVon = (q, fw) => {
  if (q.r === 'L' || q.r === 'AL') return mitTf(q.tf, `<path d="${q.d}" fill="none" stroke="#000" stroke-width="${q.w + fw}" stroke-linecap="${q.cap ?? 'round'}" stroke-linejoin="round"/>`)
  return mitTf(q.tf, `<path d="${q.umriss ?? q.d}" fill="#000" stroke="#000" stroke-width="${fw}" stroke-linejoin="round"/>`)
}

const bauen = (k, teile, dunkel) => {
  mz = 0
  const [oben, unten, echo] = F[k]
  const [g1, g2] = dunkel ? BORDEAUX : [oben, unten]
  const messing = dunkel || !MESSING_SCHWACH.has(k)
  const rolle = (p) => (dunkel && p.rd) || p.r
  const ton = (q) => rolle(q) === 'T' || (q.r === 'L' && q.echo)
  const out = teile.map((p0, i) => {
    // Deckkraft-Angaben gelten nur für die helle Rolle
    const p = { ...p0, r: rolle(p0), ...(dunkel && p0.rd ? { o: undefined } : {}) }
    const istTon = ton(p0)
    if (istTon && dunkel) {
      const fugen = p.fuge === false ? '' : teile.slice(i + 1)
        .filter((q) => !ton(q) && !q.ohneFuge)
        .map((q) => fugeVon(q, p.fw ?? FUGE)).join('')
      return gruppe(p.r === 'L' ? strich(p, echo) : form(p, echo), { schnitte: (p.schnitte ?? '') + fugen })
    }
    if (dunkel && (p.r === 'M' || p.r === 'L') && !p.gleich) {
      // halbdeckendes Creme würde auf Bordeaux rosa — deckend im Echo-Ton
      return gruppe(p.r === 'L' ? strich(p, echo) : form(p, echo), { schnitte: p.schnitte })
    }
    switch (p.r) {
      case 'T': return gruppe(form(p, ELF), { schnitte: p.schnitte, o: p.o ?? TON, scr: true })
      case 'V': return gruppe(form(p, p.c ?? ELF), { schnitte: p.schnitte, o: p.o ?? HOCH, scr: true })
      case 'M': return gruppe(form(p, p.c ?? CREME), { schnitte: p.schnitte, o: p.o ?? MITTE, scr: true })
      case 'L': return gruppe(strich(p, p.c ?? ELF), { schnitte: p.schnitte, o: p.o ?? MITTE, scr: true })
      case 'A': return messing
        ? gruppe(form(p, MESSING), { schnitte: p.schnitte })
        : gruppe(form(p, ELF), { schnitte: p.schnitte, o: HOCH, scr: true })
      case 'AL': return messing
        ? gruppe(strich(p, MESSING), { schnitte: p.schnitte })
        : gruppe(strich(p, ELF), { schnitte: p.schnitte, o: HOCH, scr: true })
    }
    throw new Error(p.r)
  })
  const grund = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${g1}"/><stop offset="1" stop-color="${g2}"/></linearGradient></defs><rect width="100" height="100" fill="url(#bg)"/>`
  const kante = `<rect x="0.5" y="0.5" width="99" height="99" rx="21.87" fill="none" stroke="${ELF}" stroke-opacity="${dunkel ? 0.17 : 0.13}" stroke-width="1"/>`
  return `<g style="isolation:isolate">${grund}${out.join('')}</g>${kante}`
}

// ── Formen ────────────────────────────────────────────────────────────────
const STIFT = 'M0 -5.5 H30 L41 0 L30 5.5 H0 Q-2.5 5.5 -2.5 3 V-3 Q-2.5 -5.5 0 -5.5 Z'
const STIFT_TF = 'translate(48 76) rotate(-45)'
const NOTIZBLATT = 'M26 17 H56 L71 32 V73 Q71 77 67 77 H26 Q22 77 22 73 V21 Q22 17 26 17 Z'

// Prüfplakette: Elfenbeinscheibe, Ring aus 12 Monatsfeldern (ohne Ziffern), ein Feld markiert
const PK = [64.5, 63]
const PR = 11.5
const plaketteSchnitte = schnittLinie(kreisD(PK[0], PK[1], 6.6), 1.3) +
  Array.from({ length: 12 }, (_, i) => {
    const [x1, y1] = pol(PK[0], PK[1], 6.6, 15 + i * 30)
    const [x2, y2] = pol(PK[0], PK[1], PR - 1.6, 15 + i * 30)
    return schnittLinie(`M${x1} ${y1}L${x2} ${y2}`, 1.3, 'butt')
  }).join('')

// ── Die 14 Icons ──────────────────────────────────────────────────────────
// Hub-Raster (4 je Zeile), keine gleichen Nachbarn:
//   rosso      oliva      terracotta  ardesia
//   tabacco    petrolio   senape      salvia
//   grafite    prugna     schiefer    ocra
//   inchiostro cappuccino
const MOTIVE = {
  // Einsätze: Rundumkennleuchte — Glashaube mit Glanzkante auf kaum breiterem Sockel
  // (kein Hutrand). Hell: Haube Elfenbein, Sockel dunkler; dunkel: Haube im Echo-Rot.
  einsaetze: ['rosso',
    V('M30 58 V41 A20 20 0 0 1 70 41 V58 Z', { rd: 'T', schnitte: schnittLinie(bogen(50, 41, 13.5, 290, 334), 3.2) }),
    T(rr(27, 61.5, 46, 15, 3.5), { o: 0.36, rd: 'V' }),
  ],

  // EKS: Finimeter — Rundinstrument mit Warnbereich, Anschlussmutter, Schlauch
  eks: ['oliva',
    T(kreisD(50, 41, 24), { fuge: false }),
    L('M50 70 V74 Q50 79 55 79 H77', 6, { o: MITTE, c: CREME }),
    V(rr(44, 62, 12, 9, 2)),
    V(kreisD(50, 41, 19.5), {
      schnitte: `<g transform="translate(50 41) rotate(40)">${schnitt('M-2.6 0 L0 -15 L2.6 0 Z')}</g>` + schnitt(kreisD(50, 41, 4)),
    }),
    AL(bogen(50, 41, 14.6, 216, 266), 5, { cap: 'butt' }),
  ],

  // Patienten: Klemmbrett mit Protokollblatt und kurzer Vitalkurve, Klemme in Messing
  patienten: ['terracotta',
    T(rr(23, 22, 54, 59, 6)),
    V(rr(30, 31, 40, 43, 3), {
      schnitte: schnittLinie('M35 48.5 H43 L46.5 40.5 L52 57.5 L55.5 48.5 H65', 3.6) + schnitt(rr(35, 63.5, 22, 4.5, 2.25)),
    }),
    A(rr(38, 17, 24, 10, 4)),
  ],

  // Vorgänge: zwei gestaffelte Blätter, vorn drei Zeilen
  dokumente: ['ardesia',
    T(rr(22, 18, 40, 52, 4)),
    V(rr(36, 30, 42, 52, 4), {
      schnitte: schnitt(rr(44, 42, 26, 4.5, 2.25)) + schnitt(rr(44, 52, 26, 4.5, 2.25)) + schnitt(rr(44, 62, 17, 4.5, 2.25)),
    }),
  ],

  // Lager: Versandkarton frontal — Deckelkante, Front, Klebeband in Messing über Deckel und Front
  lager: ['tabacco',
    T(rr(18, 23, 64, 14, 3), { o: 0.34 }),
    V(rr(21, 39.5, 58, 40, 3), {
      schnitte: schnitt(rr(58, 66, 14, 3.6, 1.8)) + schnitt(rr(58, 72, 9, 3.6, 1.8)),
    }),
    A('M44.5 23 H55.5 V55 H44.5 Z'),
  ],

  // MPG: Medizingerät (Monitor mit Kurve, Tragegriff); auf der Front die runde
  // Prüfplakette mit Monatsring ohne Ziffern, der Prüfmonat in Messing
  mpg: ['petrolio',
    T(rr(34, 17, 30, 14, 5.5), { schnitte: schnitt(rr(40, 22, 18, 5, 2.5)) }),
    V(rr(18, 26, 62, 52, 7), {
      schnitte: schnitt(rr(25, 33, 48, 15, 3)) + schnitt(kreisD(PK[0], PK[1], PR + 2)),
    }),
    L('M29.5 41 H39 L42 36.5 L46 45 L49 41 H68.5', 2.6, { o: 0.85 }),
    V(kreisD(PK[0], PK[1], PR), { schnitte: plaketteSchnitte }),
    A(sektor(PK[0], PK[1], 7.6, PR - 1, -13, 13)),
  ],

  // Unitas: aufgeschlagenes Buch
  lernbar: ['senape',
    T('M18 35 V77 C31.5 73.5 42 75 50 80 C58 75 68.5 73.5 82 77 V35 Z', { fw: 3.5 }),
    V('M48.5 29 C41 23 31.5 21.5 22 23 V70 C31.5 68.5 41 70 48.5 76 Z'),
    V('M51.5 29 C59 23 68.5 21.5 78 23 V70 C68.5 68.5 59 70 51.5 76 Z'),
  ],

  // Ausbildungen: Kalenderblatt, ein Tag in Messing markiert
  ausbildungen: ['salvia',
    T(rr(20, 25, 60, 56, 6)),
    V('M20 39 V31 Q20 25 26 25 H74 Q80 25 80 31 V39 Z'),
    V(rr(31.5, 17, 6, 13, 3) + rr(62.5, 17, 6, 13, 3)),
    A(rr(54, 56, 15, 15, 2.5)),
  ],

  // Dateien: Mappe mit eingelegtem Blatt
  dateien: ['grafite',
    T('M18 28 Q18 23 23 23 H38.5 Q41 23 43 25 L46.5 29 H77 Q82 29 82 34 V73 Q82 78 77 78 H23 Q18 78 18 73 Z'),
    M(rr(26, 33, 48, 24, 2)),
    V(rr(18, 43, 64, 35, 5)),
  ],

  // Schreibstube: Umschlag mit eingestecktem Brief
  office: ['prugna',
    T(rr(28, 18, 44, 30, 3), { schnitte: schnitt(rr(35, 25, 30, 3.6, 1.8)) }),
    V(rr(18, 34, 64, 46, 5), { schnitte: schnittLinie('M20.5 37.5 L50 59 L79.5 37.5', 3.4) }),
  ],

  // Chat: zwei Sprechblasen
  chat: ['schiefer',
    T(rr(18, 20, 44, 32, 12) + 'M25 46 L37 50 L22 61 Z'),
    V(rr(38, 40, 44, 32, 12) + 'M75 66 L78 81 L63 70 Z'),
  ],

  // Notizen: Blatt mit Eselsohr und zwei Zeilen, Stift (auf Ocker in Elfenbein)
  notizen: ['ocra',
    T('M56 17 V28 Q56 32 60 32 H71 Z', { o: 0.34 }),
    V(NOTIZBLATT, {
      schnitte: schnitt(rr(29, 40, 26, 4.5, 2.25)) + schnitt(rr(29, 50, 18, 4.5, 2.25)) +
        `<path transform="${STIFT_TF}" d="${STIFT}" fill="#000" stroke="#000" stroke-width="6" stroke-linejoin="round"/>`,
    }),
    A(STIFT, { tf: STIFT_TF, schnitte: `<g transform="${STIFT_TF}">${schnittLinie('M30 -7 V7', 1.6, 'butt')}</g>` }),
  ],

  // Benutzer: zwei Personen, gestaffelt
  unitarii: ['inchiostro',
    T(kreisD(61, 30, 10) + 'M43 72 V63 Q43 45 61 45 Q79 45 79 63 V72 Z'),
    V(kreisD(41, 39, 11.5) + 'M20 80 V71 Q20 53 41 53 Q62 53 62 71 V80 Z'),
  ],

  // Einstellungen: drei Schieberegler
  settings: ['cappuccino',
    L('M22 30 H78 M22 50 H78 M22 70 H78', 5, { o: TON + 0.1, echo: true, fw: 4 }),
    V(kreisD(36, 30, 8.5) + kreisD(64, 50, 8.5) + kreisD(44, 70, 8.5)),
  ],
}

const hell = {}, dunkel = {}
for (const [app, [k, ...teile]] of Object.entries(MOTIVE)) {
  hell[app] = bauen(k, teile, false)
  dunkel[app] = bauen(k, teile, true)
}
writeFileSync(`${HIER}/icons.json`, JSON.stringify(hell, null, 1))
writeFileSync(`${HIER}/icons-dunkel.json`, JSON.stringify(dunkel, null, 1))
console.log('icons.json + icons-dunkel.json:', Object.keys(hell).length, 'Icons')
