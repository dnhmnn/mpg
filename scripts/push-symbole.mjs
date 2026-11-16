#!/usr/bin/env node
// Erzeugt die zwei Bilder der Push-Benachrichtigungen aus public/logoklein.svg (Bauplan Push, 6.1):
//
//   public/push-symbol-192.png    Symbol neben der Benachrichtigung: Zeichen hell auf Dunkelrot #600812
//   public/push-abzeichen-96.png  Abzeichen in der Statusleiste (Android): nur die Form, weiß auf
//                                 durchsichtig (Android nimmt nur den Alphakanal)
//
// Einmalig erzeugt und eingecheckt; neu nur, wenn sich das Zeichen ändert. Braucht Playwright mit
// Chromium (nicht in package.json, weil die App es nicht braucht):
//
//   node scripts/push-symbole.mjs
//   PLAYWRIGHT_MODUL=/pfad/zu/playwright/index.js CHROMIUM=/pfad/zu/chromium node scripts/push-symbole.mjs
//
// Das SVG wird nur mit festen Farben gezeichnet; Skripte, Ereignisse oder fremde Adressen darin
// brechen ab.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const R = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUELLE = `${R}/public/logoklein.svg`
const ROT = '#600812'
const HELL = '#fcfbfb'

const svg = readFileSync(QUELLE, 'utf8')
if (/<script|<foreignObject|\son\w+\s*=|href="(?!#)|url\((?!#)/i.test(svg)) {
  console.error('logoklein.svg enthält etwas, das in ein Bild nicht gehört (Skript, Ereignis, fremde Adresse).')
  process.exit(1)
}
const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1]
if (!viewBox) { console.error('logoklein.svg: viewBox fehlt'); process.exit(1) }
const [, , vbB, vbH] = viewBox.split(/[ ,]+/).map(Number)
// Inhalt ohne Kopf, ohne <defs> (die Farben setzt dieses Skript selbst)
const innen = svg
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<defs>[\s\S]*?<\/defs>/, '')

/** Zeichen mit festen Farben für die beiden Klassen; mittig in einem Quadrat der Kante `kante`, Höhe `anteil`. */
function zeichen(kante, anteil, farbe1, farbe2) {
  const h = kante * anteil
  const b = h * (vbB / vbH)
  const inhalt = innen.replace(/class="cls-1"/g, `fill="${farbe1}"`).replace(/class="cls-2"/g, `fill="${farbe2}"`)
  return `<svg x="${(kante - b) / 2}" y="${(kante - h) / 2}" width="${b}" height="${h}" viewBox="${viewBox}">${inhalt}</svg>`
}

function symbol() {
  const k = 192
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${k}" height="${k}" viewBox="0 0 ${k} ${k}"><rect width="${k}" height="${k}" fill="${ROT}"/>${zeichen(k, 0.7, HELL, ROT)}</svg>`
}

function abzeichen() {
  const k = 96
  // Maske: helle Teile sichtbar, dunkle Einzelheiten ausgeschnitten
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${k}" height="${k}" viewBox="0 0 ${k} ${k}"><defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${k}" height="${k}"><rect width="${k}" height="${k}" fill="#000"/>${zeichen(k, 0.86, '#fff', '#000')}</mask></defs><rect width="${k}" height="${k}" fill="#fff" mask="url(#m)"/></svg>`
}

async function playwrightLaden() {
  const pfad = process.env.PLAYWRIGHT_MODUL
  try {
    const m = await import(pfad ? pathToFileURL(pfad).href : 'playwright')
    return m.chromium ? m : m.default
  } catch {
    console.error('Playwright fehlt. Mit PLAYWRIGHT_MODUL=/pfad/zu/playwright/index.js aufrufen (und ggf. CHROMIUM=/pfad/zu/chromium).')
    process.exit(1)
  }
}

/** Breite und Höhe aus dem Kopf einer PNG-Datei. */
function pngGroesse(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null
  return { b: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

const pw = await playwrightLaden()
const browser = await pw.chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
try {
  const seite = await browser.newPage({ deviceScaleFactor: 1 })
  for (const [datei, inhalt, kante, durchsichtig] of [
    ['push-symbol-192.png', symbol(), 192, false],
    ['push-abzeichen-96.png', abzeichen(), 96, true],
  ]) {
    await seite.setViewportSize({ width: kante, height: kante })
    await seite.setContent(`<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style></head><body>${inhalt}</body></html>`)
    const bild = await seite.locator('svg').first().screenshot({ omitBackground: durchsichtig, type: 'png' })
    const g = pngGroesse(bild)
    if (!g || g.b !== kante || g.h !== kante) { console.error(`${datei}: falsche Größe`, g); process.exit(1) }
    writeFileSync(`${R}/public/${datei}`, bild)
    console.log(`public/${datei}: ${kante} x ${kante}, ${bild.length} Byte`)
  }
} finally {
  await browser.close()
}
