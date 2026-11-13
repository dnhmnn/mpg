// Link und QR-Code eines Formulars (Bauplan Vorgänge, 3.5, 3.11): Link kopieren,
// öffnen, QR-Code zeigen, als Bild laden und als Blatt drucken. Eine Fläche mit
// Zeilen. Das Druckblatt entsteht in ./logik.ts (qrDruckHtml), alles escaped.

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { VgIcon, Zeile } from './bausteine'
import { qrDateiname, qrDruckHtml } from './logik'
import { VG_TEXTE as T } from './texte'

/** In die Zwischenablage; ohne Clipboard-API über ein markiertes Textfeld. */
async function kopieren(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true }
  } catch { /* weiter mit dem Rückfall */ }
  try {
    const feld = document.createElement('textarea')
    feld.value = text
    feld.setAttribute('readonly', '')
    feld.style.position = 'fixed'
    feld.style.opacity = '0'
    document.body.appendChild(feld)
    feld.select()
    const ok = document.execCommand('copy')
    feld.remove()
    return ok
  } catch {
    return false
  }
}

export default function LinkTeilen({ url, titel, orgName, onMeldung }: {
  url: string
  /** Name des Formulars: Dateiname des Bilds und Überschrift des Druckblatts. */
  titel: string
  orgName: string
  /** Rückmeldung (Kopieren ging nicht, Druckfenster blockiert); fehlt sie, bleibt es still. */
  onMeldung?: (text: string, fehler?: boolean) => void
}) {
  const [kopiert, setKopiert] = useState(false)
  const [qrOffen, setQrOffen] = useState(false)
  const [bild, setBild] = useState<{ url: string; daten: string } | null>(null)
  const [qrFehler, setQrFehler] = useState(false)
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (uhr.current) clearTimeout(uhr.current) }, [])

  // Den Code erst erzeugen, wenn er aufgeklappt wird; für eine neue Adresse neu
  useEffect(() => {
    if (!qrOffen || (bild && bild.url === url)) return
    let weg = false
    setQrFehler(false)
    QRCode.toDataURL(url, { margin: 2, width: 640, errorCorrectionLevel: 'M', color: { dark: '#1a0e08', light: '#ffffff' } })
      .then((daten) => { if (!weg) setBild({ url, daten }) })
      .catch(() => { if (!weg) setQrFehler(true) })
    return () => { weg = true }
  }, [qrOffen, url, bild])

  const aktuell = bild && bild.url === url ? bild.daten : ''

  async function linkKopieren() {
    if (await kopieren(url)) {
      setKopiert(true)
      if (uhr.current) clearTimeout(uhr.current)
      uhr.current = setTimeout(() => setKopiert(false), 2000)
    } else {
      onMeldung?.(T.kopierenFehler, true)
    }
  }

  function bildLaden() {
    if (!aktuell) return
    const a = document.createElement('a')
    a.href = aktuell
    a.download = qrDateiname(titel)
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function drucken() {
    if (!aktuell) return
    const w = window.open('', '_blank', 'width=900,height=1100')
    if (!w) { onMeldung?.(T.druckBlockiert, true); return }
    w.document.write(qrDruckHtml({ orgName, titel, url, bild: aktuell }))
    w.document.close()
  }

  return (
    <div className="bv-flaeche">
      <Zeile
        titel={T.linkKopieren} unter={<span className="vg-adresse">{url}</span>} onClick={linkKopieren}
        rechts={kopiert ? <span className="vg-rechts akzent" role="status">{T.kopiert}</span> : <VgIcon n="link" className="vg-icon-rechts" />}
      />
      <Zeile titel={T.oeffnen} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} rechts={<VgIcon n="oeffnen" className="vg-icon-rechts" />} />
      <Zeile
        titel={T.qrCode} unter={qrOffen ? undefined : T.qrUnter} onClick={() => setQrOffen(!qrOffen)} expanded={qrOffen}
        rechts={<VgIcon n={qrOffen ? 'hoch' : 'qr'} className="vg-icon-rechts" />}
      />
      {qrOffen ? (
        <>
          <div className="vg-qr">
            {aktuell
              ? <img src={aktuell} alt={`QR-Code für ${titel}`} />
              : <p role="status">{qrFehler ? T.qrFehler : T.qrErzeugt}</p>}
          </div>
          <Zeile titel={T.bildLaden} unter={T.bildLadenUnter} onClick={bildLaden} disabled={!aktuell} rechts={<VgIcon n="laden" className="vg-icon-rechts" />} />
          <Zeile titel={T.drucken} unter={T.druckenUnter} onClick={drucken} disabled={!aktuell} rechts={<VgIcon n="drucken" className="vg-icon-rechts" />} />
        </>
      ) : null}
    </div>
  )
}
