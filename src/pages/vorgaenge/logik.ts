// Reine Teile der Vorgänge-Schale (Bauplan Vorgänge, 3.3 bis 3.5, 3.10, 3.11):
// Reiter je Recht und Modul, Adressen, Zeilentexte, Links, QR-Blatt.
// Keine Imports aus React oder PocketBase: die Prüffälle laufen ohne DOM
// (src/pages/vorgaenge/logik.test.ts).

import { absenderModus } from '../../lib/formular/absender'
import { ausgeschaltetText, karteAusSuche } from '../../lib/formular/verwaltung'
import { MODUS_KURZ, VG_TEXTE } from './texte'

/** Basis aller Links und QR-Codes (die App, nicht die Website). */
export const APP_ADRESSE = 'https://app.responda.systems'

/** Die Standardformulare, die Felder anpassen lassen (Patientendoku ist fest, PO 2). */
export type StandardFormular = 'produktausgabe' | 'defektmeldung' | 'cirs'
/** Alle Standardformulare unter Vorgänge, auch die feste Patientendoku. */
export type StandardId = 'patienten' | StandardFormular
/** Wie ein Formular den Absender verlangt; „anonym“ nur bei eigenen Formularen. */
export type VgModus = 'passwort' | 'frei' | 'anonym'

/** Die vier Standardformulare in ihrer Reihenfolge, mit dem Pfad ihrer öffentlichen Seite. */
export const STANDARD_FORMULARE: { id: StandardId; label: string; pfad: string }[] = [
  { id: 'patienten', label: 'Patientendokumentation', pfad: 'doku' },
  { id: 'produktausgabe', label: 'Produktausgabe', pfad: 'produktausgabe' },
  { id: 'defektmeldung', label: 'Defektmeldung', pfad: 'defektmeldung' },
  { id: 'cirs', label: 'CIRS-Meldung', pfad: 'cirs' },
]

export function istStandardId(x: unknown): x is StandardId {
  return typeof x === 'string' && STANDARD_FORMULARE.some((f) => f.id === x)
}

/** Lassen sich die Felder dieses Formulars anpassen (alle außer der Patientendoku)? */
export function istAnpassbar(x: unknown): x is StandardFormular {
  return x === 'produktausgabe' || x === 'defektmeldung' || x === 'cirs'
}

export function standardLabel(id: string): string {
  return STANDARD_FORMULARE.find((f) => f.id === id)?.label ?? 'Formular'
}

function org(orgCode: string): string {
  return encodeURIComponent(String(orgCode ?? '').trim())
}

/** Öffentliche Adresse eines Standardformulars, z. B. https://app.responda.systems/wache1/doku. */
export function formularLink(orgCode: string, id: StandardId): string {
  const f = STANDARD_FORMULARE.find((x) => x.id === id)
  return `${APP_ADRESSE}/${org(orgCode)}/${f ? f.pfad : ''}`
}

/** Öffentliche Adresse eines eigenen Formulars (/<org>/formular/<id>). */
export function vorlageLink(orgCode: string, vorlageId: string): string {
  return `${APP_ADRESSE}/${org(orgCode)}/formular/${encodeURIComponent(String(vorlageId ?? ''))}`
}

/** Die Seite der Organisation (/<org>). */
export function orgSeiteLink(orgCode: string): string {
  return `${APP_ADRESSE}/${org(orgCode)}`
}

function versteckt(cfg: unknown): string[] {
  const c = cfg && typeof cfg === 'object' ? cfg as { hidden_forms?: unknown } : null
  return Array.isArray(c?.hidden_forms) ? c!.hidden_forms.filter((x): x is string => typeof x === 'string') : []
}

/** Ist der öffentliche Link eines Formulars an (nicht in `hidden_forms`)? */
export function oeffentlichAn(cfg: unknown, id: string): boolean {
  return !versteckt(cfg).includes(id)
}

/** `hidden_forms` mit (aus) oder ohne (an) dieses Formular, ohne Doppel; die anderen bleiben. */
export function versteckteSetzen(liste: unknown, id: string, an: boolean): string[] {
  const ohne = (Array.isArray(liste) ? liste : []).filter((x): x is string => typeof x === 'string' && x !== id)
  return an ? ohne : [...ohne, id]
}

/**
 * Die Zeile unter dem Namen eines Standardformulars in der Liste (3.4):
 * „Öffentlich · Mitglied mit Passwort“, „Öffentlicher Link aus · angemeldet
 * weiter möglich“, CIRS „Öffentlich · anonym“ oder „Aus“.
 */
export function formularZeile(id: StandardId, cfg: unknown): string {
  const an = oeffentlichAn(cfg, id)
  if (id === 'cirs') return an ? `Öffentlich · ${MODUS_KURZ.anonym}` : 'Aus'
  if (!an) return 'Öffentlicher Link aus · angemeldet weiter möglich'
  return `Öffentlich · ${MODUS_KURZ[absenderModus(cfg, id)]}`
}

/** Satz unter dem Schalter „Über Link und QR-Code erreichbar“ (3.5). */
export function schalterText(id: StandardId, an: boolean): string {
  return an ? VG_TEXTE.erreichbarAn : ausgeschaltetText(id)
}

// ── Rechte und Reiter (3.4, 3.10) ───────────────────────────────────────────

/** Darf diese Person Vorgänge überhaupt öffnen? Sonst „Kein Zugriff“. */
export function hatZugriff(o: { darfEinstellen: boolean; darfVorgaenge: boolean }): boolean {
  return o.darfEinstellen || o.darfVorgaenge
}

/** Sieht die Person eigene Formulare, Eingang und CIRS (Modul und Recht Vorgänge)? */
export function vorgaengeVoll(o: { vorgaengeFrei: boolean; darfVorgaenge: boolean }): boolean {
  return o.vorgaengeFrei && o.darfVorgaenge
}

export type ReiterEintrag = { key: string; label: string }

/**
 * Die Reiter in fester Folge: Formulare, dann die der Erweiterungen (I: Eingang),
 * dann CIRS. Erweiterungen und CIRS nur mit Modul und Recht Vorgänge; doppelte
 * oder reservierte Schlüssel einer Erweiterung fallen weg.
 */
export function reiterListe(o: { vorgaengeFrei: boolean; darfVorgaenge: boolean; extra?: ReiterEintrag[] }): ReiterEintrag[] {
  const aus: ReiterEintrag[] = [{ key: 'formulare', label: 'Formulare' }]
  if (!vorgaengeVoll(o)) return aus
  for (const r of o.extra ?? []) {
    if (!r || !r.key || r.key === 'cirs' || aus.some((x) => x.key === r.key)) continue
    aus.push({ key: r.key, label: r.label })
  }
  aus.push({ key: 'cirs', label: 'CIRS' })
  return aus
}

// ── Adresse (3.3) ────────────────────────────────────────────────────────────

export type Adresse = {
  tab: string
  seite: string
  id: string
  /** `?meldung=` aus dem Hub: diese CIRS-Meldung gleich öffnen. */
  meldung: string
  /**
   * Alte Verweise (`?karte=`, `?bereich=cirs&meldung=`) werden einmal auf die neue
   * Form umgeschrieben, ohne Eintrag im Verlauf: die neue Suche, sonst null.
   */
  umleiten: string | null
}

type Suche = { get(name: string): string | null }

/** Die Suche einer Adresse bauen: Formulare ohne `tab`, Seite und Kennung nur, wenn gesetzt. */
export function adresseBauen(a: { tab?: string; seite?: string; id?: string }): string {
  const n = new URLSearchParams()
  if (a.tab && a.tab !== 'formulare') n.set('tab', a.tab)
  if (a.seite) n.set('seite', a.seite)
  if (a.seite && a.id) n.set('id', a.id)
  const s = n.toString()
  return s ? `?${s}` : ''
}

/**
 * Die Adresse lesen (3.3): `?tab=formulare|eingang|cirs&seite=<name>&id=<id>`.
 * Erhalten bleiben `?bereich=cirs&meldung=<id>` (Hub, Widgets: Reiter CIRS) und
 * `?karte=<formular>` (MPG, Lager: Seite des Formulars, ersetzt).
 */
export function adresseLesen(sp: Suche): Adresse {
  const roh = (k: string) => String(sp.get(k) ?? '').trim()
  const karte = karteAusSuche(sp.get('karte'))
  const meldung = roh('meldung')
  const bereichCirs = roh('bereich') === 'cirs'
  let tab = roh('tab') || ((bereichCirs || meldung) ? 'cirs' : 'formulare')
  let seite = roh('seite')
  let id = seite ? roh('id') : ''
  let umleiten: string | null = null
  if (karte && !seite) {
    tab = 'formulare'; seite = 'formular'; id = karte
    umleiten = adresseBauen({ tab, seite, id })
  } else if ((bereichCirs || meldung || sp.get('karte') !== null) && !roh('tab')) {
    umleiten = adresseBauen({ tab, seite, id })
  }
  return { tab, seite, id, meldung, umleiten }
}

// ── Kleinteile für die Bausteine ─────────────────────────────────────────────

/** „12,5“ oder „12.5“ → 12.5; leer → null; nicht lesbar → NaN (ZahlFeld zeigt den Fehler). */
export function zahlAusText(t: string): number | null {
  const s = String(t ?? '').trim().replace(/\s/g, '').replace(',', '.')
  if (!s) return null
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

/** Eine Zahl so, wie man sie tippt (deutsches Komma); null → leer. */
export function zahlText(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? String(n).replace('.', ',') : ''
}

/** Text HTML-sicher für die Druckblätter (auch Apostroph). */
export function htmlSicher(x: unknown): string {
  return String(x ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Titel für Dateinamen: nur Buchstaben, Ziffern, Umlaute und Bindestrich; höchstens 60 Zeichen. */
export function dateiTitel(titel: string, ersatz = 'Formular'): string {
  const t = String(titel ?? '')
    .replace(/[^A-Za-z0-9äöüÄÖÜß-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '')
  return t || ersatz
}

/** Dateiname des QR-Bilds: „QR-Produktausgabe.png“. */
export function qrDateiname(titel: string): string {
  return `QR-${dateiTitel(titel)}.png`
}

/** Nur ein eingebettetes PNG-Bild kommt ins Druckblatt. */
function pngQuelle(x: unknown): string {
  return typeof x === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(x) ? x : ''
}

/**
 * Das Druckblatt des QR-Codes (3.11): Organisation, Titel, Code, Adresse.
 * Jeder Text HTML-sicher, das Bild nur als eingebettetes PNG.
 */
export function qrDruckHtml(o: { orgName: string; titel: string; url: string; bild: string }): string {
  const bild = pngQuelle(o.bild)
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>${htmlSicher(`QR-Code ${o.titel}`)}</title>
<style>
@page{size:A4;margin:18mm}
*{box-sizing:border-box}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#1a0e08;background:#fff;text-align:center}
.blatt{max-width:170mm;margin:0 auto;padding:12mm 0}
.org{font-size:14pt;color:#5a4a3a;margin:0 0 4mm}
h1{font-size:26pt;margin:0 0 10mm;line-height:1.15}
img{width:110mm;height:110mm;image-rendering:pixelated;display:block;margin:0 auto}
.adresse{font-size:12pt;margin:8mm 0 2mm;word-break:break-all}
.hinweis{font-size:11pt;color:#5a4a3a;margin:0}
button{position:fixed;bottom:20px;right:20px;background:#1a0e08;color:#fff;border:0;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer}
@media print{button{display:none}}
</style></head><body>
<div class="blatt">
<p class="org">${htmlSicher(o.orgName)}</p>
<h1>${htmlSicher(o.titel)}</h1>
${bild ? `<img src="${bild}" alt="QR-Code">` : ''}
<p class="adresse">${htmlSicher(o.url)}</p>
<p class="hinweis">${htmlSicher(VG_TEXTE.qrDruckHinweis)}</p>
</div>
<button onclick="window.print()">Drucken</button>
</body></html>`
}
