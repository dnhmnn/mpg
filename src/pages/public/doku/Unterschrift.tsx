// Unterschreiben, mit dem Finger auf dem Gerät.
//
// Das Gezeichnete wird als Bild-Datenadresse unter `signature` abgelegt —
// derselbe Schlüssel wie im alten Formular, damit alte und neue Protokolle
// dieselbe Unterschrift tragen und der Ausdruck sie ohne Umweg findet.
//
// Der getippte Name im Feld "Unterschrift" bleibt daneben bestehen: auf dem
// Bogen steht das Bild über der Linie und der Name darunter, so wie man es
// von Hand auch machen würde.

import { useEffect, useRef, useState } from 'react'

const ROT = 'var(--lbf-akzent)'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(var(--lbf-rot-rgb),0.14)'

/** Die Zeichenfläche in Gerätepunkten — gross genug, dass es gedruckt trägt. */
const BREITE = 800
const HOEHE = 220

export default function Unterschrift({ wert, onChange }: {
  wert: string
  onChange: (datenadresse: string) => void
}) {
  const flaeche = useRef<HTMLCanvasElement>(null)
  const zeichnet = useRef(false)
  const [etwasDa, setEtwasDa] = useState(Boolean(wert))

  // Eine gespeicherte Unterschrift wieder anzeigen — etwa nach dem Wechsel
  // auf einen anderen Reiter und zurück.
  useEffect(() => {
    const c = flaeche.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    if (!wert) { setEtwasDa(false); return }
    const bild = new Image()
    bild.onload = () => ctx.drawImage(bild, 0, 0, c.width, c.height)
    bild.src = wert
    setEtwasDa(true)
  }, [wert])

  function punkt(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = flaeche.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }
  }

  function anfangen(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const ctx = flaeche.current?.getContext('2d')
    if (!ctx) return
    // Den Zeiger einfangen: sonst reisst der Strich ab, sobald der Finger
    // kurz über den Rand der Fläche gerät. Scheitert das, wird trotzdem
    // gezeichnet — es wäre schade, am Einfangen zu scheitern.
    try { flaeche.current?.setPointerCapture(e.pointerId) } catch { /* ohne Einfangen weiter */ }
    zeichnet.current = true
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const p = punkt(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function ziehen(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnet.current) return
    e.preventDefault()
    const ctx = flaeche.current?.getContext('2d')
    if (!ctx) return
    const p = punkt(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setEtwasDa(true)
  }

  /**
   * Zuerst sichern, dann aufräumen.
   *
   * Vorher stand das Freigeben des Zeigers davor — und wenn der Browser die
   * Erfassung beim Loslassen bereits selbst freigegeben hat, wirft das, die
   * Zeile danach läuft nicht mehr, und die Unterschrift ist verloren. Sie war
   * auf dem Bildschirm zu sehen und stand trotzdem in keinem Protokoll.
   */
  function aufhoeren(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnet.current) return
    zeichnet.current = false
    const c = flaeche.current
    if (c) onChange(c.toDataURL('image/png'))
    try { c?.releasePointerCapture(e.pointerId) } catch { /* war schon frei */ }
  }

  function loeschen() {
    const c = flaeche.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    setEtwasDa(false)
    onChange('')
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
        Unterschrift
        <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 5, fontStyle: 'italic' }}>
          mit dem Finger
        </span>
      </div>

      <canvas
        ref={flaeche} width={BREITE} height={HOEHE}
        onPointerDown={anfangen} onPointerMove={ziehen}
        onPointerUp={aufhoeren} onPointerCancel={aufhoeren}
        onLostPointerCapture={aufhoeren}
        aria-label="Fläche zum Unterschreiben"
        style={{
          width: '100%', height: 150, display: 'block',
          // Die Zeichenfläche bleibt weiß mit dunkler Tinte — sie kommt aufs Papier.
          background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 8,
          // Ohne das scrollt die Seite, statt dass der Strich entsteht.
          touchAction: 'none', cursor: 'crosshair',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <span style={{ flex: 1, fontSize: 11, fontStyle: 'italic', color: etwasDa ? ROT : GRAU }}>
          {etwasDa ? 'Unterschrieben — steht auf dem Bogen über der Linie' : 'Noch nicht unterschrieben'}
        </span>
        <button
          type="button" onClick={loeschen} disabled={!etwasDa}
          style={{
            padding: '7px 13px', background: 'transparent',
            border: `0.5px solid ${etwasDa ? LINIE : 'transparent'}`, borderRadius: 8,
            color: etwasDa ? TEXT : GRAU, fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
            cursor: etwasDa ? 'pointer' : 'default',
          }}
        >
          Löschen
        </button>
      </div>
    </div>
  )
}
