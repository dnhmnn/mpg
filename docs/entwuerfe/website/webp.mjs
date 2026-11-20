// PNG-Bilder aus aufnahme.mjs für die Website verkleinern und als WebP ablegen (780 px breit, Qualität 0,86).
// Aufruf: node docs/entwuerfe/website/webp.mjs <ordner-mit-png> [ziel, Vorgabe public/website]
import { createRequire } from 'node:module'
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
let pw
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright/index.js']) { try { pw = require(p); break } catch { /* nächster */ } }
const HIER = dirname(fileURLToPath(import.meta.url))
const [quelle, ziel = join(HIER, '..', '..', '..', 'public', 'website')] = process.argv.slice(2)
mkdirSync(ziel, { recursive: true })
const b = await pw.chromium.launch(); const p = await b.newPage()
for (const f of readdirSync(quelle).filter((f) => f.endsWith('.png'))) {
  const daten = readFileSync(join(quelle, f)).toString('base64')
  const url = await p.evaluate(async (d) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode()
    const c = document.createElement('canvas'); c.width = 780; c.height = Math.round(i.height * 780 / i.width)
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(i, 0, 0, c.width, c.height)
    return c.toDataURL('image/webp', 0.86)
  }, daten)
  const buf = Buffer.from(url.split(',')[1], 'base64')
  writeFileSync(join(ziel, f.replace(/\.png$/, '.webp')), buf)
  console.log(f, '→', Math.round(buf.length / 1024), 'KB')
}
await b.close()
