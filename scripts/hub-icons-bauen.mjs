#!/usr/bin/env node
// Baut die Hub-Symbole („Farbkacheln“) in die App ein: npm run hub-icons
//
// Quelle bleibt docs/entwuerfe/hub-icons/bau.mjs (vom Owner abgenommener Entwurf). Dieses
// Skript führt es aus, liest icons.json (hell) und icons-dunkel.json (dunkel) und schreibt
// src/lib/hubIcons.ts: je App ein vollständiges, rundes SVG als data:-Adresse für <img>.
//
// - IDs (Verläufe, Masken) bekommen je Symbol und Darstellung ein Präfix (<app>-h- / <app>-d-),
//   wie in vorschau.mjs; so stören sich die Symbole nie, auch nicht eingebettet.
// - Die Kachel ist selbst rund (Ausschnitt rx 22,37 bei 100), braucht also kein CSS.
// - Bricht ab, wenn zu einer App aus ALL_APPS (src/lib/apps.ts) ein Symbol fehlt, oder wenn
//   ein Symbol etwas enthält, das in ein Bild nicht gehört (Skript, Ereignis, fremde Adresse).
//
// Eigene Zeichnungen, nichts von Apple, kein Schutzzeichen.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const R = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENTWURF = `${R}/docs/entwuerfe/hub-icons`
const ZIEL = `${R}/src/lib/hubIcons.ts`

// Die Apps aus ALL_APPS (src/lib/apps.ts); dieselbe Liste wie in vorschau.mjs
const APPS = ['einsaetze', 'eks', 'patienten', 'dokumente', 'lager', 'mpg', 'lernbar', 'ausbildungen',
  'dateien', 'office', 'chat', 'notizen', 'unitarii', 'settings']

// Abgleich mit apps.ts: kommt eine App dazu, soll das hier auffallen
const appsTs = readFileSync(`${R}/src/lib/apps.ts`, 'utf8')
const block = appsTs.slice(appsTs.indexOf('export const ALL_APPS'), appsTs.indexOf('\n}\n', appsTs.indexOf('export const ALL_APPS')))
const inApps = [...block.matchAll(/^\s+(\w+):\s+\{ id: '(\w+)'/gm)].map((m) => m[2])
const nichtGelistet = inApps.filter((id) => !APPS.includes(id))
if (!inApps.length || nichtGelistet.length) {
  console.error('ALL_APPS und die Liste in scripts/hub-icons-bauen.mjs passen nicht zusammen:', nichtGelistet.join(', ') || 'ALL_APPS nicht gefunden')
  process.exit(1)
}

execFileSync(process.execPath, [`${ENTWURF}/bau.mjs`], { stdio: 'inherit' })
const hell = JSON.parse(readFileSync(`${ENTWURF}/icons.json`, 'utf8'))
const dunkel = JSON.parse(readFileSync(`${ENTWURF}/icons-dunkel.json`, 'utf8'))

const fehlt = APPS.filter((id) => typeof hell[id] !== 'string' || typeof dunkel[id] !== 'string')
if (fehlt.length) {
  console.error('Symbol fehlt für:', fehlt.join(', '))
  process.exit(1)
}

function svg(app, art, inhalt) {
  if (/<script|<foreignObject|\son\w+\s*=|href="(?!#)|url\((?!#)/i.test(inhalt)) {
    console.error(`${app} (${art}): unerlaubter Inhalt`)
    process.exit(1)
  }
  const p = `${app}-${art}-`
  const innen = inhalt
    .replace(/id="([^"]+)"/g, `id="${p}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${p}$1"`)
  const ganz = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><clipPath id="${p}k"><rect width="100" height="100" rx="22.37"/></clipPath></defs><g clip-path="url(#${p}k)">${innen}</g></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(ganz)
}

const zeilen = APPS.map((id) => `  ${id}: {\n    hell: ${JSON.stringify(svg(id, 'h', hell[id]))},\n    dunkel: ${JSON.stringify(svg(id, 'd', dunkel[id]))},\n  },`)
const ts = `// Erzeugt von scripts/hub-icons-bauen.mjs aus docs/entwuerfe/hub-icons/bau.mjs.
// Nicht von Hand ändern: npm run hub-icons
// Die Hub-Symbole „Farbkacheln“: je App ein rundes SVG für hell und dunkel (Retro nimmt hell).
// Eigene Zeichnungen, nichts von Apple, kein Schutzzeichen.

export const HUB_ICONS: Record<string, { hell: string; dunkel: string }> = {
${zeilen.join('\n')}
}
`
writeFileSync(ZIEL, ts)
console.log(`src/lib/hubIcons.ts: ${APPS.length} Symbole, ${Math.round(ts.length / 1024)} KB`)
