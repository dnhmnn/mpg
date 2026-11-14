/**
 * „Neu in Responda“: kurze Info des Supervisors nach einem Update.
 *
 * Erscheint einmal als ruhiges Blatt, wenn der Hub (oder die Lernbar) geöffnet wird und der neueste
 * veröffentlichte Hinweis noch nicht bestätigt ist; nach einem Login erst nach der Begrüßung
 * (`bereit`). „Verstanden“ (oder Escape) merkt ihn am Konto (users.hinweis_gesehen_am) und auf dem
 * Gerät. Fehlt die Sammlung, fehlt Netz oder geht etwas schief, erscheint nichts.
 *
 * Der Text wird nur über textBloecke() und Textknoten gezeigt, nie als HTML.
 * Logik: src/lib/hinweise.ts. Regeln: docs/pocketbase-regeln.md, „Hub und Hinweise“.
 */
import { useEffect, useId, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { pb } from '../lib/pocketbase'
import type { User } from '../types'
import {
  HINWEISE_SAMMLUNG, datumText, gesehenStand, hinweisSchluessel, hinweisZuZeigen, textBloecke, type Hinweis,
} from '../lib/hinweise'

/** Eigene Klassen (nr-): sieht im Hub (innerhalb von .bv), in der Lernbar und in der Vorschau des Supervisors gleich aus. */
const NR_CSS = `
.nr-grund{position:fixed;inset:0;z-index:900;background:rgba(26,14,8,.5);display:flex;align-items:flex-end;justify-content:center;touch-action:none;animation:nr-ein .2s ease-out}
.nr-blatt{box-sizing:border-box;width:100%;max-height:88dvh;display:flex;flex-direction:column;background:var(--warm-bg);color:var(--lbf-text);
  border-radius:24px 24px 0 0;padding:22px 20px calc(16px + env(safe-area-inset-bottom));font-family:inherit;
  padding-left:max(20px, env(safe-area-inset-left));padding-right:max(20px, env(safe-area-inset-right));
  box-shadow:0 -2px 24px rgba(26,14,8,.18);touch-action:auto}
.nr-blatt.nr-statisch{max-height:none;border-radius:20px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.07)}
.nr-inhalt{display:flex;flex-direction:column;min-height:0;flex:1 1 auto}
.nr-marke{font-size:13px;font-weight:700;color:var(--lbf-akzent);margin:0 0 6px;letter-spacing:0;text-transform:none;font-style:normal}
.nr-titel{font-size:22px;line-height:1.25;font-weight:800;color:var(--lbf-text);margin:0;outline:none;overflow-wrap:anywhere;font-style:normal;letter-spacing:-.01em}
.nr-datum{font-size:13px;color:var(--warm-gray);margin-top:4px;font-style:normal}
.nr-flaeche{margin-top:16px;background:var(--lbf-card);border-radius:14px;padding:16px;overflow-y:auto;min-height:0;flex:1 1 auto;
  overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y}
.nr-flaeche:focus-visible{outline:2px solid var(--lbf-akzent);outline-offset:2px}
.nr-statisch .nr-flaeche{overflow:visible}
.nr-absatz{margin:0 0 12px;font-size:15px;line-height:1.5;color:var(--lbf-text);overflow-wrap:anywhere;font-style:normal}
.nr-liste{margin:0 0 12px;padding:0;list-style:none}
.nr-liste li{position:relative;padding-left:18px;margin:0 0 8px;font-size:15px;line-height:1.5;color:var(--lbf-text);overflow-wrap:anywhere;font-style:normal}
.nr-liste li::before{content:"";position:absolute;left:3px;top:.62em;width:6px;height:6px;border-radius:50%;background:var(--lbf-akzent);opacity:.7}
.nr-flaeche > :last-child{margin-bottom:0}
.nr-leer{font-size:15px;color:var(--warm-gray)}
.nr-knopf{appearance:none;-webkit-appearance:none;border:0;margin:16px 0 0;width:100%;min-height:48px;border-radius:12px;
  background:var(--lbf-akzent-grund);color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer;flex-shrink:0;
  text-transform:none;letter-spacing:0;box-shadow:none;padding:0 16px}
.nr-knopf:focus-visible{outline:2px solid var(--lbf-akzent);outline-offset:3px}
.nr-knopf:active{opacity:.85}
.nr-fuss{font-size:13px;color:var(--warm-gray);text-align:center;margin-top:10px;flex-shrink:0;font-style:normal}
@media (min-width:640px){
  .nr-grund{align-items:center;padding:24px}
  .nr-blatt{max-width:560px;border-radius:24px;padding:28px 28px 22px;max-height:min(88dvh,760px)}
}
@keyframes nr-ein{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.nr-grund{animation:none}}
`

/** Titel, Datum und Text eines Hinweises, so wie er nach dem Anmelden erscheint (auch Vorschau im Supervisor). */
export function HinweisInhalt(p: { titel: string; text: string; datum?: string; titelId?: string; titelRef?: Ref<HTMLHeadingElement> }): JSX.Element {
  const bloecke = textBloecke(p.text)
  return (
    <div className="nr-inhalt">
      <style>{NR_CSS}</style>
      <p className="nr-marke">Neu in Responda</p>
      <h2 className="nr-titel" id={p.titelId} ref={p.titelRef} tabIndex={p.titelRef ? -1 : undefined}>{p.titel}</h2>
      {p.datum ? <div className="nr-datum">{p.datum}</div> : null}
      <div className="nr-flaeche" tabIndex={p.titelRef ? 0 : undefined} aria-label={p.titelRef ? 'Text des Hinweises' : undefined}>
        {bloecke.length === 0 ? <div className="nr-leer">Ohne weiteren Text.</div> : bloecke.map((b, i) => b.art === 'liste'
          ? <ul key={i} className="nr-liste">{b.punkte.map((x, j) => <li key={j}>{x}</li>)}</ul>
          : <p key={i} className="nr-absatz">{b.zeilen.map((z, j) => <span key={j}>{j > 0 ? <br /> : null}{z}</span>)}</p>)}
      </div>
    </div>
  )
}

/** In dieser Sitzung bestätigte Hinweise erscheinen nie wieder, auch wenn das Konto noch nichts weiß. */
const BESTAETIGT = new Set<string>()

const lokalLesen = (k: string): string => { try { return localStorage.getItem(k) || '' } catch { return '' } }

const FOKUSSIERBAR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function NeuInResponda({ user, bereit, onOffen }: { user: User | null; bereit: boolean; onOffen?: (offen: boolean) => void }): JSX.Element | null {
  const [hinweis, setHinweis] = useState<Hinweis | null>(null)
  const [offen, setOffen] = useState(false)
  const nutzerRef = useRef(user)
  nutzerRef.current = user
  const meldenRef = useRef(onOffen)
  meldenRef.current = onOffen
  const titelRef = useRef<HTMLHeadingElement>(null)
  const blattRef = useRef<HTMLDivElement>(null)
  const vorherRef = useRef<Element | null>(null)
  const titelId = useId()

  // Einmal je Benutzer laden: nur der neueste veröffentlichte zählt
  useEffect(() => {
    const u = nutzerRef.current
    setHinweis(null)
    if (!u?.id) return
    let vorbei = false
    pb.collection(HINWEISE_SAMMLUNG)
      // Nur, was das Blatt braucht (erstellt_von bleibt in der Verwaltung)
      .getList<Hinweis>(1, 1, { filter: 'veroeffentlicht = true', sort: '-veroeffentlicht_am,-id', fields: 'id,titel,text,veroeffentlicht,veroeffentlicht_am', requestKey: null })
      .then((r) => {
        if (vorbei) return
        const k = nutzerRef.current ?? u
        const roh = k as unknown as { hinweis_gesehen_am?: unknown; created?: unknown }
        const h = hinweisZuZeigen(r.items, { gesehenAm: roh.hinweis_gesehen_am, lokal: lokalLesen(hinweisSchluessel(k.id)), kontoAngelegt: roh.created })
        if (h && !BESTAETIGT.has(h.id)) setHinweis(h)
      })
      .catch(() => { /* Sammlung fehlt (404), ohne Netz oder abgewiesen: nichts zeigen */ })
    return () => { vorbei = true }
  }, [user?.id])

  // Erst zeigen, wenn die Seite bereit ist (Begrüßung und Einführung vorbei), dann kurz warten
  useEffect(() => {
    if (!hinweis || !bereit || offen) return
    const uhr = window.setTimeout(() => setOffen(true), 700)
    return () => window.clearTimeout(uhr)
  }, [hinweis, bereit, offen])

  // Der Seite melden, ob das Blatt offen ist; Fokus hinein und beim Schließen zurück
  const warOffen = useRef(false)
  useEffect(() => {
    if (offen === warOffen.current) return
    warOffen.current = offen
    meldenRef.current?.(offen)
    if (offen) {
      vorherRef.current = document.activeElement
      window.requestAnimationFrame(() => titelRef.current?.focus({ preventScroll: true }))
    } else {
      const v = vorherRef.current as HTMLElement | null
      if (v && typeof v.focus === 'function' && document.contains(v)) v.focus({ preventScroll: true })
    }
  }, [offen])
  useEffect(() => () => { if (warOffen.current) meldenRef.current?.(false) }, [])

  const verstanden = () => {
    const h = hinweis
    const u = nutzerRef.current
    setOffen(false)
    setHinweis(null)
    if (!h) return
    BESTAETIGT.add(h.id)
    if (!u?.id || !h.veroeffentlicht_am) return
    const schluessel = hinweisSchluessel(u.id)
    try { localStorage.setItem(schluessel, gesehenStand(h.veroeffentlicht_am, lokalLesen(schluessel))) } catch { /* Speicher voll oder gesperrt */ }
    // Ins Konto (fehlt das Feld noch, verwirft PocketBase es still; dann hält das Gerät die Bestätigung)
    pb.collection('users').update(u.id, { hinweis_gesehen_am: h.veroeffentlicht_am }, { requestKey: null }).catch(() => { /* still */ })
  }
  const verstandenRef = useRef(verstanden)
  verstandenRef.current = verstanden

  // Escape = Verstanden; Tab bleibt im Blatt
  useEffect(() => {
    if (!offen) return
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); verstandenRef.current(); return }
      if (e.key !== 'Tab' || !blattRef.current) return
      const ziele = [...blattRef.current.querySelectorAll<HTMLElement>(FOKUSSIERBAR)].filter((el) => el.offsetParent !== null)
      if (!ziele.length) { e.preventDefault(); return }
      const erstes = ziele[0], letztes = ziele[ziele.length - 1]
      const akt = document.activeElement
      const drin = akt instanceof HTMLElement && ziele.includes(akt)
      if (e.shiftKey && (akt === erstes || !drin)) { e.preventDefault(); letztes.focus() }
      else if (!e.shiftKey && (akt === letztes || !drin)) { e.preventDefault(); erstes.focus() }
    }
    document.addEventListener('keydown', taste, true)
    return () => document.removeEventListener('keydown', taste, true)
  }, [offen])

  if (!offen || !hinweis) return null
  return createPortal(
    <div className="nr-grund" data-probe="neu-in-responda">
      <div ref={blattRef} className="nr-blatt" role="dialog" aria-modal="true" aria-labelledby={titelId}>
        <HinweisInhalt titel={hinweis.titel} text={hinweis.text ?? ''} datum={datumText(hinweis.veroeffentlicht_am)} titelId={titelId} titelRef={titelRef} />
        <button type="button" className="nr-knopf" onClick={verstanden}>Verstanden</button>
        <div className="nr-fuss">Diesen Hinweis siehst du nur einmal.</div>
      </div>
    </div>,
    document.body,
  )
}
