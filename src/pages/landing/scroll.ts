// Scroll auf responda.systems: ein passiver scroll-Listener und ein requestAnimationFrame für alles, was am
// Scrollen hängt (Szene, Lesezeilen). Die Bildschirmhöhe H kommt allein aus `.rs-mass` (100svh, Rückfall 100vh),
// gelesen im ResizeObserver: am iPhone ändert sie sich nicht, wenn Safari seine Leisten ein- und ausfährt.
// Nie window.innerHeight, kein resize-Listener, und malen liest kein Layout.

import { useLayoutEffect, type RefObject } from 'react'

export interface Mass { H: number; vw: number; breit: boolean }

export interface Teilnehmer {
  /** Größen und Lagen lesen (Layout lesen ist hier erlaubt). voll: Breite, Höhe oder breit/schmal anders */
  messen: (m: Mass, voll: boolean) => void
  /** Nur schreiben, nie Layout lesen */
  malen: (y: number, m: Mass) => void
  /** Vor dem Messen bei anderer Größe: die Lage merken (z. B. Bildschirmhöhen in der Szene), sonst null */
  lageVor?: (y: number, m: Mass) => number | null
  /** Nach dem Messen: wohin rollen, damit dieselbe Stelle im Bild bleibt (Drehen, anderes Fenster) */
  lageNach?: (lage: number, m: Mass) => number | null
}

/** Schreibt nur, was sich geändert hat (Zahlen auf drei Stellen gerundet) */
const zwischenspeicher = new WeakMap<HTMLElement, Map<string, string>>()
export function setz(el: HTMLElement | null | undefined, eigenschaft: string, wert: string | number) {
  if (!el) return
  const w = typeof wert === 'number' ? String(Math.round(wert * 1000) / 1000) : wert
  let m = zwischenspeicher.get(el)
  if (!m) { m = new Map(); zwischenspeicher.set(el, m) }
  if (m.get(eigenschaft) === w) return
  m.set(eigenschaft, w)
  if (eigenschaft.startsWith('--')) el.style.setProperty(eigenschaft, w)
  else (el.style as unknown as Record<string, string>)[eigenschaft] = w
}

/** Beobachtet Scrollen und Größe; ruft messen vor dem ersten Bild und malen je Bild höchstens einmal */
export function useScrollMaler(rootRef: RefObject<HTMLElement | null>, teilnehmer: (anstossen: () => void) => Teilnehmer[], deps: unknown[]) {
  useLayoutEffect(() => {
    const root = rootRef.current
    const massEl = root?.querySelector<HTMLElement>('.rs-mass')
    if (!root || !massEl) return
    let m: Mass = { H: 0, vw: 0, breit: false }
    let geplant = 0
    let tn: Teilnehmer[] = []
    const malen = () => { geplant = 0; const y = window.scrollY; for (const t of tn) t.malen(y, m) }
    const anstossen = () => { if (!geplant) geplant = requestAnimationFrame(malen) }
    tn = teilnehmer(anstossen)
    const messen = () => {
      const H = massEl.getBoundingClientRect().height || massEl.offsetHeight || 1
      const vw = root.clientWidth || document.documentElement.clientWidth
      const breit = vw >= 900 || vw > 1.2 * H
      // Jede andere Größe misst voll neu (H kommt aus 100svh und ändert sich am iPhone nicht mit den Leisten)
      const voll = vw !== m.vw || H !== m.H || breit !== m.breit
      // Beim Drehen oder anderem Fenster dieselbe Stelle halten (scrollY in px bliebe sonst gleich)
      const alt = m, y = window.scrollY
      const lagen = alt.H && voll ? tn.map(t => t.lageVor?.(y, alt) ?? null) : []
      m = { H, vw, breit }
      for (const t of tn) t.messen(m, voll)
      for (let i = 0; i < lagen.length; i++) {
        const l = lagen[i]
        const ziel = l === null ? null : tn[i].lageNach?.(l, m) ?? null
        if (ziel !== null && Math.abs(ziel - window.scrollY) > 1) { window.scrollTo(0, ziel); break }
      }
    }
    messen(); malen()
    let messenGeplant = 0
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { if (!messenGeplant) messenGeplant = requestAnimationFrame(() => { messenGeplant = 0; messen(); malen() }) })
      : null
    ro?.observe(massEl); ro?.observe(root)
    window.addEventListener('scroll', anstossen, { passive: true })
    return () => { window.removeEventListener('scroll', anstossen); ro?.disconnect(); cancelAnimationFrame(geplant); cancelAnimationFrame(messenGeplant) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Ruhige Einblendung (Klasse .rs-ein) für alles nach der Szene: einmal, beim ersten Erscheinen */
export function useEinblenden(rootRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    root.classList.add('rs-js')
    const io = new IntersectionObserver((eintraege) => {
      for (const e of eintraege) {
        // Schon oberhalb (etwa nach einem Sprung zu #kontakt) oder im Bild: sofort da
        if (e.isIntersecting || e.boundingClientRect.bottom < 0) { e.target.classList.add('da'); io.unobserve(e.target) }
      }
    }, { rootMargin: '0px 0px -12% 0px' })
    root.querySelectorAll('.rs-ein').forEach(el => io.observe(el))
    return () => { io.disconnect(); root.classList.remove('rs-js') }
  }, [rootRef])
}
