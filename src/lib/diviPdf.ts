// DIVI-6.0-Notfallprotokoll als ausgefülltes PDF.
//
// Ansatz: Das offizielle Blanko-Protokoll (public/divi6-vorlage.pdf, A3 quer,
// 1190.5 x 841.89 pt) dient als Hintergrund; die Protokolldaten werden per
// pdf-lib an den Original-Positionen daraufgeschrieben ("Overlay") — das
// Ergebnis sieht exakt aus wie das handschriftlich ausgefüllte Papierprotokoll.
//
// Alle Koordinaten sind im "bbox-Raum" notiert (Ursprung oben links, y nach
// unten, ermittelt via pdftotext -bbox aus der Vorlage) und werden beim
// Zeichnen nach pdf-lib (Ursprung unten links) umgerechnet.
//
// pdf-lib wird lazy geladen, damit das Haupt-Bundle klein bleibt.

import type { PatientPayload } from '../pages/patienten/types'

const H = 841.89

function hhmm(s?: string): string {
  if (!s) return ''
  const m = s.match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''
}

function ddmmyyyy(s?: string): string {
  if (!s) return ''
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`
  return s
}

function parseNaca(s?: string): number {
  if (!s) return 0
  const roman: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 }
  const t = String(s).trim().toUpperCase()
  if (roman[t]) return roman[t]
  const n = parseInt(t, 10)
  return n >= 1 && n <= 7 ? n : 0
}

export async function generateDiviPdf(p: PatientPayload): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const res = await fetch('/divi6-vorlage.pdf')
  if (!res.ok) throw new Error('DIVI-Vorlage nicht gefunden (public/divi6-vorlage.pdf)')
  const doc = await PDFDocument.load(await res.arrayBuffer())
  const page = doc.getPage(0)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const INK = rgb(0.05, 0.05, 0.35)

  const text = (x: number, yTop: number, str?: string | number | null, size = 7) => {
    if (str === undefined || str === null || String(str).trim() === '') return
    // WinAnsi-inkompatible Zeichen ersetzen, damit drawText nicht wirft
    const safe = String(str).replace(/[^\x20-\x7EäöüÄÖÜßéèàáçâêîôû€°§]/g, '?')
    page.drawText(safe, { x, y: H - yTop, size, font, color: INK })
  }
  // yMid = vertikale Mitte der Checkbox
  const cross = (x: number, yMid: number, size = 5.5) => {
    const y0 = H - yMid - size / 2
    page.drawLine({ start: { x, y: y0 }, end: { x: x + size, y: y0 + size }, thickness: 1, color: INK })
    page.drawLine({ start: { x, y: y0 + size }, end: { x: x + size, y: y0 }, thickness: 1, color: INK })
  }
  const multiline = (x: number, yTop: number, str: string | undefined, width: number, size = 7, lh = 9, maxLines = 8) => {
    if (!str || !str.trim()) return
    const words = String(str).split(/\s+/)
    let line = ''
    const lines: string[] = []
    for (const w of words) {
      const t = line ? line + ' ' + w : w
      if (font.widthOfTextAtSize(t, size) > width) { lines.push(line); line = w } else line = t
    }
    if (line) lines.push(line)
    lines.slice(0, maxLines).forEach((l, i) => text(x, yTop + i * lh, l, size))
  }

  // ── Stammdaten (links oben) ──
  text(78, 45, p.name, 8)
  text(78, 63, p.vorname, 8)
  text(80, 82.5, ddmmyyyy(p.gebdatum), 8)
  text(78, 99, p.strasse, 8)
  text(78, 116.5, p.plz_ort, 8)
  text(78, 134, p.kasse, 8)
  text(78, 151.5, p.versnr, 8)
  text(216, 168, p.alter, 8)
  text(100, 224, p.einsatz_nr || p.auftrags_nr, 7)
  text(80, 242, p.fahrzeug, 7)

  // ── Einsatztechnische Daten ──
  text(340, 50, ddmmyyyy(p.zeit_einsatz), 8)
  multiline(345, 68, p.einsatz_adresse, 200, 7, 9, 2)
  text(340, 181, p.transport_ziel, 7)
  text(510, 240, p.rufname, 7)

  // ── Zeiten (Alarm, Ankunft am Pat., Abfahrt, Übergabe) ──
  text(512, 74, hhmm(p.zeit_einsatz), 8)
  text(512, 108, hhmm(p.zeit_eintreffen), 8)
  text(512, 129, hhmm(p.zeit_transport), 8)
  text(512, 147, hhmm(p.zeit_uebergabe), 8)

  // ── Notfallgeschehen / Anamnese / Vormedikation ──
  const anamnese = [
    p.notfallgeschehen,
    p.vorerkrankungen ? `Vorerkrankungen: ${p.vorerkrankungen}` : '',
    p.allergien ? `Allergien: ${p.allergien}` : '',
    p.vormedikation_patient ? `Vormedikation: ${p.vormedikation_patient}` : '',
  ].filter(Boolean).join(' — ')
  multiline(50, 274, anamnese, 320, 7, 9, 8)

  // ── Erstbefund Neurologie ──
  text(246, 359, hhmm(p.neu_zeit) || p.neu_zeit, 7)
  const gcs = (p.gcs_e || 0) + (p.gcs_v || 0) + (p.gcs_m || 0)
  if (gcs > 0) text(155, 506, String(gcs), 9)
  const pwRow: Record<string, number> = { eng: 495, mittel: 502, weit: 508.5 }
  if (p.pw_r && pwRow[p.pw_r]) cross(194.5, pwRow[p.pw_r], 5)
  if (p.pw_l && pwRow[p.pw_l]) cross(244.5, pwRow[p.pw_l], 5)
  if (p.pw_r_entrundet) cross(194.5, 515, 5)
  if (p.pw_l_entrundet) cross(244.5, 515, 5)
  const lrRow: Record<string, number> = { prompt: 540, 'träge': 546.5, traege: 546.5, keine: 553 }
  if (p.lr_r && lrRow[p.lr_r]) cross(194.5, lrRow[p.lr_r], 5)
  if (p.lr_l && lrRow[p.lr_l]) cross(244.5, lrRow[p.lr_l], 5)

  // ── Messwerte initial ──
  const schmerz = p.schmerz !== undefined && p.schmerz !== '' ? Number(p.schmerz) : NaN
  if (!isNaN(schmerz) && schmerz >= 0 && schmerz <= 10) cross(428 + schmerz * 12.7, 361)
  text(338, 384, p.rr_sys, 8)
  text(382, 384, p.rr_dia, 8)
  text(455, 384, p.hf, 8)
  text(525, 384, p.bz_mg, 8)
  text(340, 412, p.af, 8)
  text(395, 412, p.spo2, 8)
  text(468, 412, p.temp, 8)
  text(532, 412, p.etco2, 8)

  // ── Erstdiagnosen + NACA ──
  multiline(320, 750, p.erstdiagnose_text, 240, 7, 9, 5)
  const naca = parseNaca(p.naca)
  const nacaPos: Record<number, [number, number]> = { 1: [352, 815], 2: [420, 815], 3: [500, 815], 4: [352, 827], 5: [420, 827], 6: [500, 827], 7: [545, 827] }
  if (naca && nacaPos[naca]) cross(nacaPos[naca][0], nacaPos[naca][1])

  // ── Medikation (rechte Hälfte, 2 Spalten à 8 Zeilen) ──
  const meds = (p.medications || []).filter(m => m.name)
  meds.slice(0, 16).forEach((m, i) => {
    const col = i < 8 ? 0 : 160
    const row = (i % 8) * 12
    text(630 + col, 340 + row, m.name, 6.5)
    text(714 + col, 340 + row, [m.dose, m.unit].filter(Boolean).join(' '), 6.5)
  })

  // ── Übergabe-Block (rechts): letzte Verlaufs-Messung ──
  const last = (p.verlauf || []).filter(r => r.zeit || r.rr_sys || r.hf || r.spo2).slice(-1)[0]
  if (last) {
    text(712, 549, hhmm(last.zeit) || last.zeit, 8)
    text(652, 567, last.rr_sys, 8)
    text(690, 567, last.rr_dia, 8)
    text(760, 567, last.hf, 8)
    text(832, 567, last.bz, 8)
    text(645, 591, last.af, 8)
    text(695, 591, last.spo2, 8)
    text(770, 591, last.temp, 8)
    const us = last.schmerz !== undefined && last.schmerz !== '' ? Number(last.schmerz) : NaN
    if (!isNaN(us) && us >= 0 && us <= 10) cross(672 + us * 12.7, 606)
  }
  if (gcs > 0) text(880, 549, String(gcs), 9)

  // ── Bemerkungen + Übergabe an ──
  const bem = [p.bemerkungen, p.hausarzt ? `Hausarzt: ${p.hausarzt}` : '', p.angehoeriger ? `Angehörige: ${p.angehoeriger}` : '']
    .filter(Boolean).join(' — ')
  multiline(765, 648, bem, 280, 7, 9.5, 16)
  text(700, 820, p.uebergabe_name, 7)

  // ── Download ──
  const bytes = await doc.save()
  const ab = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(ab).set(bytes)
  const blob = new Blob([ab], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const datum = ddmmyyyy(p.zeit_einsatz).replace(/\./g, '-') || 'Protokoll'
  a.href = url
  a.download = `DIVI_${(p.name || 'Patient').replace(/\s+/g, '_')}_${datum}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
