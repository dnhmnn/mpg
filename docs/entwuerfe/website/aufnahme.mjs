// Bilder der App für die Website responda.systems (public/website/*.png).
// Nimmt die gebaute App (dist/) im Telefonformat auf. Alle Anfragen an den Server beantwortet dieses
// Skript selbst aus daten.mjs: nur erfundene Testdaten, nie der echte Server, nie echte Personen.
//
// Aufruf (nach `npm run build`):  node docs/entwuerfe/website/aufnahme.mjs [name …]
// Ohne Namen alle Bilder. Playwright wird aus dem Projekt oder global geladen.
import { createRequire } from 'node:module'
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { extname, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BILDER, antwort, ANMELDUNG } from './daten.mjs'

const HIER = dirname(fileURLToPath(import.meta.url))
const REPO = join(HIER, '..', '..', '..')
const DIST = join(REPO, 'dist')
const ZIEL = process.env.WEBSITE_BILDER || join(REPO, 'public', 'website')
const require = createRequire(import.meta.url)
let pw
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright/index.js']) { try { pw = require(p); break } catch { /* nächster */ } }
if (!pw) { console.error('Playwright fehlt'); process.exit(1) }

const TYP = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.webp': 'image/webp' }
const APP = 'https://app.responda.systems'

const nur = process.argv.slice(2)
mkdirSync(ZIEL, { recursive: true })
const browser = await pw.chromium.launch()
const fehler = []
for (const bild of BILDER.filter((b) => !nur.length || nur.includes(b.name))) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    colorScheme: bild.thema || 'light', serviceWorkers: 'block', locale: 'de-DE', timezoneId: 'Europe/Berlin',
  })
  // Feste Uhrzeit, damit Daten und Fristen stimmen
  await ctx.addInitScript(({ auth, thema, jetzt, user }) => {
    const echt = Date
    const versatz = jetzt - echt.now()
    // eslint-disable-next-line no-global-assign
    Date = class extends echt { constructor(...a) { super(...(a.length ? a : [echt.now() + versatz])) } static now() { return echt.now() + versatz } }
    // Bildschirm wachhalten (Wake Lock) kann das iPhone, der kopflose Testbrowser nicht: wie am Gerät nachstellen
    try {
      const sperre = { released: false, type: 'screen', onrelease: null, release: async () => {}, addEventListener() {}, removeEventListener() {} }
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => sperre } })
    } catch { /* ohne */ }
    try {
      localStorage.setItem('theme', thema)
      if (auth) localStorage.setItem('pocketbase_auth', JSON.stringify(auth))
      const stand = encodeURIComponent(JSON.stringify({ v: 1, basis: '2026-01-01T08:00:00.000Z', organisation: '2026-01-01T08:00:00.000Z' }))
      document.cookie = `responda_einfuehrung_${user}=${stand}; path=/`
    } catch { /* ohne */ }
  }, { auth: bild.ohneAnmeldung ? null : ANMELDUNG, thema: bild.thema || 'light', jetzt: Date.parse('2026-11-19T09:41:00+01:00'), user: ANMELDUNG.record.id })
  await ctx.route(`${APP}/**`, (route) => {
    const u = new URL(route.request().url())
    let p = join(DIST, decodeURIComponent(u.pathname))
    if (!existsSync(p) || statSync(p).isDirectory()) p = join(DIST, 'index.html')
    route.fulfill({ status: 200, contentType: TYP[extname(p)] || 'application/octet-stream', body: readFileSync(p) })
  })
  await ctx.route('https://api.responda.systems/**', async (route) => {
    const r = route.request()
    const a = antwort(r.method(), new URL(r.url()), r.postData(), bild)
    if (process.env.PROTOKOLL) console.log('  ', r.method(), new URL(r.url()).pathname, a === 'abbrechen' ? 'abgebrochen' : (a.status || 200))
    if (a === 'abbrechen') return route.abort()
    await route.fulfill({ status: a.status || 200, contentType: a.typ || 'application/json', body: typeof a.body === 'string' || Buffer.isBuffer(a.body) ? a.body : JSON.stringify(a.body) })
  })
  // Alles andere (Schriften von Google usw.) darf nicht fehlen, aber auch nichts verraten: abbrechen
  await ctx.route(/^https:\/\/(?!app\.responda\.systems|api\.responda\.systems)/, (route) => route.abort())
  const page = await ctx.newPage()
  page.on('pageerror', (e) => fehler.push(`${bild.name}: ${e.message}`))
  if (process.env.PROTOKOLL) page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('  Konsole:', m.text().slice(0, 200)) })
  await page.goto(APP + bild.pfad, { waitUntil: 'networkidle' })
  await page.waitForTimeout(bild.warte ?? 900)
  if (bild.vorher) await bild.vorher(page)
  await page.screenshot({ path: join(ZIEL, `${bild.name}.png`) })
  console.log('Bild', bild.name)
  await ctx.close()
}
await browser.close()
if (fehler.length) { console.log('Seitenfehler:\n' + fehler.join('\n')); process.exitCode = 1 }
