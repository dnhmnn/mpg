// Gemeinsamer Rahmen der Blätter im Hub (Kurzbefehle, Profil).
// Nur im DOM, solange offen: Ein durchsichtiges festes Element am Rand könnte Safari
// sonst die Leistenfarbe halten lassen. Am Telefon unten, ab 640 px mittig.
// Schließen: Knopf, daneben tippen, Escape, an der Kopfzeile nach unten wischen.

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from '../benutzer/bausteine'

export default function Blatt({ titel, onClose, aktion, probe, children }: {
  titel: string
  onClose: () => void
  /** Textknopf rechts in der Kopfzeile (z. B. „Bearbeiten“) */
  aktion?: { text: string; onClick: () => void }
  probe?: string
  children: ReactNode
}) {
  const id = useId()
  const blatt = useRef<HTMLDivElement>(null)
  const titelRef = useRef<HTMLHeadingElement>(null)
  const zu = useRef(onClose)
  zu.current = onClose
  const wisch = useRef<number | null>(null)

  // Fokus beim Öffnen auf den Titel, beim Schließen zurück auf den Auslöser
  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null
    titelRef.current?.focus()
    return () => { if (vorher && document.contains(vorher)) vorher.focus() }
  }, [])

  // Escape schließt, Tab bleibt im Blatt
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.key === 'Escape') { e.preventDefault(); zu.current(); return }
      if (e.key !== 'Tab' || !blatt.current) return
      const ziele = [...blatt.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex="0"]')]
      if (!ziele.length) return
      const erstes = ziele[0], letztes = ziele[ziele.length - 1]
      const da = document.activeElement
      if (!blatt.current.contains(da)) { e.preventDefault(); (e.shiftKey ? letztes : erstes).focus() }
      else if (e.shiftKey && (da === erstes || da === titelRef.current)) { e.preventDefault(); letztes.focus() }
      else if (!e.shiftKey && da === letztes) { e.preventDefault(); erstes.focus() }
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [])

  return (
    <div className="bv hub-ueber" data-probe={probe} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={blatt} className="hub-blatt" role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="hub-blatt-kopf"
          onTouchStart={(e) => { wisch.current = e.touches[0].clientY }}
          onTouchCancel={() => { wisch.current = null }}
          onTouchEnd={(e) => {
            const start = wisch.current
            wisch.current = null
            if (start != null && e.changedTouches[0].clientY - start > 50) onClose()
          }}>
          <h2 id={id} ref={titelRef} tabIndex={-1}>{titel}</h2>
          {aktion && <button type="button" className="hub-textknopf" onClick={aktion.onClick}>{aktion.text}</button>}
          <button type="button" className="hub-zu" aria-label="Schließen" onClick={onClose}><i><Icon n="kreuz" /></i></button>
        </div>
        <div className="hub-blatt-inhalt">{children}</div>
      </div>
    </div>
  )
}
