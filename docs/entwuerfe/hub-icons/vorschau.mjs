// Vorschau der Hub-Icons im Hub, hell und dunkel: node docs/entwuerfe/hub-icons/vorschau.mjs
// Liest icons.json (hell) und icons-dunkel.json (dunkel) aus diesem Ordner, schreibt vorschau.png.
// { "<app>": "<SVG-Innenleben für viewBox 0 0 100 100, samt Hintergrund>" }
// IDs (Verläufe, Filter) werden je Icon automatisch eindeutig gemacht.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const { chromium } = createRequire(import.meta.url)('playwright')
const ordner = dirname(fileURLToPath(import.meta.url))
const R = resolve(ordner, '../../..')
const b64 = (p) => readFileSync(p).toString('base64')
const hell = JSON.parse(readFileSync(`${ordner}/icons.json`, 'utf8'))
const dunkel = JSON.parse(readFileSync(`${ordner}/icons-dunkel.json`, 'utf8'))
const APPS = [
  ['einsaetze', 'Einsätze'], ['eks', 'EKS'], ['patienten', 'Patienten'], ['dokumente', 'Vorgänge'],
  ['lager', 'Lager'], ['mpg', 'MPG'], ['lernbar', 'Unitas'], ['ausbildungen', 'Ausbildungen'],
  ['dateien', 'Dateien'], ['office', 'Schreibstube'], ['chat', 'Chat'], ['notizen', 'Notizen'],
  ['unitarii', 'Benutzer'], ['settings', 'Einstellungen'],
]
let n = 0
const svg = (id, px, daten) => {
  const p = `i${++n}_`
  const inhalt = (daten[id] ?? '').replace(/id="([^"]+)"/g, `id="${p}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`).replace(/href="#([^"]+)"/g, `href="#${p}$1"`)
  return `<svg viewBox="0 0 100 100" width="${px}" height="${px}" style="border-radius:${px * 0.2237}px;display:block">${inhalt}</svg>`
}
const fehlt = APPS.filter(([id]) => !hell[id] || !dunkel[id]).map(a => a[0])
if (fehlt.length) console.log('FEHLT:', fehlt.join(', '))
const schrift = `@font-face{font-family:'A';font-weight:700;src:url(data:font/woff2;base64,${b64(`${R}/public/fonts/atkinson-700.woff2`)}) format('woff2')}`
const kachel = (daten) => ([id, name]) => `<div class="k"><div class="sq">${svg(id, 52, daten)}</div><span>${name}</span></div>`
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${schrift}
body{margin:0;background:#faf9f7;font-family:'A',sans-serif;color:#1a0e08;-webkit-font-smoothing:antialiased}
.handy{width:390px;padding:20px 16px}.t{font-weight:700;font-size:17px;margin:4px 2px 12px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.k{background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.07);padding:16px 6px 12px;display:flex;flex-direction:column;align-items:center;gap:8px}
.sq{width:52px;height:52px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.18))}
.k span{font-size:12px;font-weight:700;text-align:center;line-height:1.3;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tafel{display:grid;grid-template-columns:repeat(7,150px);gap:22px;padding:24px 16px 30px;width:max-content}
.tafel.d{background:#0f0a07}
.tafel>div{filter:drop-shadow(0 3px 8px rgba(0,0,0,.2))}
.dunkel{background:#0f0a07;color:#f3ece4}.dunkel .k{background:#1c1008;box-shadow:none}
</style></head><body>
<div style="display:flex"><div class="handy"><div class="t">Apps</div><div class="grid">${APPS.map(kachel(hell)).join('')}</div></div>
<div class="handy dunkel"><div class="t">Apps (Dunkelmodus)</div><div class="grid">${APPS.map(kachel(dunkel)).join('')}</div></div></div>
<div class="tafel">${APPS.map(([id]) => `<div>${svg(id, 150, hell)}</div>`).join('')}</div>
<div class="tafel d">${APPS.map(([id]) => `<div>${svg(id, 150, dunkel)}</div>`).join('')}</div>
</body></html>`
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1200, height: 600 }, deviceScaleFactor: 2 })
await p.setContent(html, { waitUntil: 'load' }); await p.waitForTimeout(300)
await p.screenshot({ path: `${ordner}/vorschau.png`, fullPage: true })
await b.close()
console.log('ok', `${ordner}/vorschau.png`)
