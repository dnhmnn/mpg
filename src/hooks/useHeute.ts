// Der heutige Kalendertag nach Ortszeit — und er bleibt aktuell. Eine über Nacht offene App
// (Tab auf der Wache, PWA im Hintergrund) würde sonst ein Gerät, dessen STK um Mitternacht
// abläuft, am nächsten Morgen weiter als bereit zeigen. Geprüft wird regelmäßig und beim
// Zurückkehren in die App: Im Hintergrund drosseln Browser die Zeitgeber oder halten sie an.
import { useEffect, useState } from 'react'
import { tagVonDatum, type Tag } from '../lib/mpg/fristen'

export function useHeute(): Tag {
  const [heute, setHeute] = useState(() => tagVonDatum(new Date()))
  useEffect(() => {
    // Gleicher Tag → gleicher Text → kein neues Zeichnen
    const pruefe = () => setHeute(tagVonDatum(new Date()))
    const sichtbar = () => { if (document.visibilityState === 'visible') pruefe() }
    const takt = setInterval(pruefe, 30_000)
    document.addEventListener('visibilitychange', sichtbar)
    window.addEventListener('focus', pruefe)
    window.addEventListener('pageshow', pruefe)
    window.addEventListener('online', pruefe)
    return () => {
      clearInterval(takt)
      document.removeEventListener('visibilitychange', sichtbar)
      window.removeEventListener('focus', pruefe)
      window.removeEventListener('pageshow', pruefe)
      window.removeEventListener('online', pruefe)
    }
  }, [])
  return heute
}
