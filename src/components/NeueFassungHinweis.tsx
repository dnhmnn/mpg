// Hinweis „Neue Version von Responda“ (src/lib/fassungPruefen.ts): unten über allen Seiten, im
// Kopf-Dunkelrot. „Aktualisieren“ übernimmt die neue Fassung und lädt neu, „Später“ blendet den
// Hinweis eine Stunde aus.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { aktualisieren, fassungAbonnieren, fassungStand, hinweisZeigen, spaeter } from '../lib/fassungPruefen'

const CSS = `
.nf{ position: fixed; left: max(12px, env(safe-area-inset-left)); right: max(12px, env(safe-area-inset-right));
  bottom: calc(12px + env(safe-area-inset-bottom)); z-index: 9500; max-width: 520px; margin: 0 auto;
  background: var(--lbf-kopf); color: var(--lbf-kopf-text); border-radius: 14px; box-shadow: 0 6px 24px rgba(0,0,0,0.22);
  padding: 14px 14px 14px 18px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  font-family: 'Atkinson Hyperlegible', -apple-system, sans-serif; }
.nf-text{ flex: 1 1 220px; min-width: 0; }
.nf-text b{ display: block; font-size: 15px; line-height: 1.25; }
.nf-text span{ display: block; font-size: 13px; line-height: 1.35; color: var(--lbf-kopf-text-2); margin-top: 3px; }
.nf-knoepfe{ display: flex; gap: 8px; margin-left: auto; }
.nf button{ font: inherit; font-size: 14px; font-weight: 700; min-height: 44px; padding: 0 16px; border-radius: 10px; border: 0; cursor: pointer; }
.nf .nf-spaeter{ background: transparent; color: var(--lbf-kopf-text-2); }
.nf .nf-los{ background: var(--lbf-kopf-text); color: var(--lbf-kopf); }
.nf button:disabled{ cursor: default; opacity: 0.7; }
.nf button:focus-visible{ outline: 2px solid var(--lbf-kopf-text); outline-offset: 2px; }
`

export default function NeueFassungHinweis() {
  const stand = useSyncExternalStore(fassungAbonnieren, fassungStand, fassungStand)
  const { pathname } = useLocation()
  const [jetzt, setJetzt] = useState(() => Date.now())
  // Nach „Später“: zur rechten Zeit neu rechnen
  useEffect(() => {
    setJetzt(Date.now())
    if (stand.spaeterBis === null) return
    const warten = stand.spaeterBis - Date.now()
    if (warten <= 0) return
    const t = window.setTimeout(() => setJetzt(Date.now()), warten + 50)
    return () => window.clearTimeout(t)
  }, [stand])
  if (!hinweisZeigen({ neu: stand.neu, pfad: pathname, spaeterBis: stand.spaeterBis, jetzt })) return null
  return (
    <div className="nf" role="status" aria-live="polite" data-probe="neue-fassung">
      <style>{CSS}</style>
      <div className="nf-text">
        <b>Neue Version von Responda</b>
        <span>Aktualisieren lädt sie jetzt. Nicht gespeicherte Eingaben vorher sichern.</span>
      </div>
      <div className="nf-knoepfe">
        <button type="button" className="nf-spaeter" data-probe="neue-fassung-spaeter" disabled={stand.laedt} onClick={() => spaeter()}>Später</button>
        <button type="button" className="nf-los" data-probe="neue-fassung-los" disabled={stand.laedt} onClick={() => { void aktualisieren() }}>
          {stand.laedt ? 'Wird geladen …' : 'Aktualisieren'}
        </button>
      </div>
    </div>
  )
}
