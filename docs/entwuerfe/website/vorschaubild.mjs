// Vorschaubild beim Teilen (public/og-image.png, 1200x630) wie die Website: Dunkelrot, Zeichen, Satz, Handy mit der
// Übersicht (public/website/hub.webp, erfundene Daten). Aufruf: node docs/entwuerfe/website/vorschaubild.mjs public/og-image.png
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire('/home/user/mpg/package.json')
const pw = require('playwright')
const P = '/home/user/mpg/public'
const b64 = (f) => readFileSync(f).toString('base64')
const font = (w, st) => `@font-face{font-family:A;font-weight:${w};font-style:${st};src:url(data:font/woff2;base64,${b64(`${P}/fonts/atkinson-${w}${st === 'italic' ? '-italic' : ''}.woff2`)}) format('woff2')}`
const html = `<!doctype html><html lang="de"><head><style>
${font(400, 'normal')}${font(700, 'normal')}${font(700, 'italic')}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#3d0408;color:#fde8d8;font-family:A,sans-serif;overflow:hidden;position:relative}
.marke{position:absolute;left:80px;top:150px;display:flex;align-items:center;gap:16px;font-weight:700;font-size:30px}
.zeichen{width:58px;height:58px;border-radius:50%;background:#fde8d8;display:grid;place-items:center;padding:5px}
.zeichen img{width:100%;height:100%}
.vorzeile{position:absolute;left:82px;top:250px;font-size:17px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(253,232,216,.76)}
h1{position:absolute;left:78px;top:286px;width:640px;font-size:74px;line-height:1.02;font-weight:700;letter-spacing:-.03em}
h1 em{font-style:italic;display:block}
.handy{position:absolute;right:110px;top:70px;width:300px;border-radius:32px;padding:8px;background:#140405;box-shadow:0 30px 80px rgba(0,0,0,.5),inset 0 0 0 1px rgba(253,232,216,.1)}
.handy img{display:block;width:100%;border-radius:24px}
.schein{position:absolute;right:-20px;top:-40px;width:560px;height:720px;background:radial-gradient(closest-side,rgba(253,232,216,.13),rgba(253,232,216,0) 70%)}
</style></head><body>
<div class="schein"></div>
<div class="marke"><span class="zeichen"><img src="data:image/svg+xml;base64,${b64(`${P}/logo.svg`)}"></span>Responda</div>
<p class="vorzeile">In Erprobung</p>
<h1>Für den ganzen Dienst. <em>In einer App.</em></h1>
<div class="handy"><img src="data:image/webp;base64,${b64(`${P}/website/hub.webp`)}"></div>
</body></html>`
const b = await pw.chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await p.setContent(html); await p.waitForTimeout(500)
await p.screenshot({ path: process.argv[2], type: 'png' }); await b.close()
