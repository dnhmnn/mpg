// Die Gesundheitskarte abfotografieren und das Aufgedruckte übernehmen.
//
// DAS BILD WIRD NICHT GESPEICHERT. Es lebt im Arbeitsspeicher, bis der Text
// erkannt ist, und wird dann verworfen — es geht weder in das Protokoll noch
// an einen Server. Die Texterkennung läuft auf dem Gerät; es verlässt kein
// Versichertendatum das Telefon.
//
// NICHTS WIRD UNGEFRAGT ÜBERNOMMEN. Was die Kamera gelesen hat, steht zum
// Vergleichen da, und erst ein Tipp trägt es ins Formular. Eine verlesene
// Ziffer in der Versichertennummer wäre sonst ein stiller Fehler, den
// niemand mehr findet.

import { useEffect, useRef, useState } from 'react'
import { egkLesen, kvnrGueltig, type EgkDaten } from '../../../lib/egk'

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.14)'

/** Die Texterkennung wird erst bei Bedarf geladen — sie ist mehrere Megabyte groß. */
const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js'

type Ziel = 'name' | 'vorname' | 'kasse'
type Stand = 'kamera' | 'lesen' | 'fertig' | 'fehler'

/** Das Seitenverhältnis einer Scheckkarte (ID-1): 85,6 × 54 mm. */
const KARTE = 85.6 / 54

type TesseractModul = {
  createWorker: (
    sprache: string,
    oem: number,
    optionen: { logger: (m: { status: string; progress: number }) => void },
  ) => Promise<{
    recognize: (bild: HTMLCanvasElement) => Promise<{ data?: { text?: string } }>
    terminate: () => Promise<void>
  }>
}

async function textErkennen(bild: HTMLCanvasElement, fortschritt: (p: number) => void): Promise<string> {
  const geladen = (await import(/* @vite-ignore */ TESSERACT)) as { default?: TesseractModul } & Partial<TesseractModul>
  // Der ESM-Build von tesseract.js hat nur einen Default-Export. Ohne diese
  // Zeile ist createWorker undefined und die Erkennung startet nie — genau
  // das war der Fehler, mit dem der Leser keine Karte erkannt hat.
  const tesseract = geladen.default ?? (geladen as TesseractModul)
  if (typeof tesseract?.createWorker !== 'function') {
    throw new Error('tesseract.js ohne createWorker geladen')
  }
  const worker = await tesseract.createWorker('deu', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') fortschritt(m.progress)
    },
  })
  try {
    const { data } = await worker.recognize(bild)
    return String(data?.text ?? '')
  } finally {
    await worker.terminate()
  }
}

/** Den Ausschnitt der Karte aus dem Videobild holen und für die Erkennung aufbereiten. */
function ausschnitt(video: HTMLVideoElement): HTMLCanvasElement {
  const vb = video.videoWidth
  const vh = video.videoHeight
  // Derselbe Rahmen, den die Vorschau zeigt: 86 % der Breite, Kartenformat.
  const breite = vb * 0.86
  const hoehe = breite / KARTE
  const x = (vb - breite) / 2
  const y = (vh - hoehe) / 2

  const c = document.createElement('canvas')
  // Doppelt so groß: kleine Schrift erkennt Tesseract sonst schlecht.
  c.width = Math.round(breite * 2)
  c.height = Math.round(hoehe * 2)
  const ctx = c.getContext('2d')!
  ctx.drawImage(video, x, y, breite, hoehe, 0, 0, c.width, c.height)

  // Graustufen mit kräftigerem Kontrast — die Karte ist bunt bedruckt.
  const bild = ctx.getImageData(0, 0, c.width, c.height)
  const d = bild.data
  for (let i = 0; i < d.length; i += 4) {
    const grau = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const stark = Math.max(0, Math.min(255, (grau - 128) * 1.6 + 128))
    d[i] = d[i + 1] = d[i + 2] = stark
  }
  ctx.putImageData(bild, 0, 0)
  return c
}

function Reihe({ marke, wert, hinweis }: { marke: string; wert?: string; hinweis?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '0.5px solid rgba(96,8,18,0.07)' }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: GRAU, paddingTop: 2 }}>{marke}</span>
      <span style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: wert ? TEXT : GRAU }}>{wert ?? 'nicht erkannt'}</span>
        {hinweis ? <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: GRAU }}>{hinweis}</span> : null}
      </span>
    </div>
  )
}

export default function KartenScan({ onUebernehmen, onSchliessen }: {
  onUebernehmen: (werte: Record<string, string>) => void
  onSchliessen: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stromRef = useRef<MediaStream | null>(null)
  const [stand, setStand] = useState<Stand>('kamera')
  const [fehler, setFehler] = useState('')
  const [fortschritt, setFortschritt] = useState(0)
  const [daten, setDaten] = useState<EgkDaten | null>(null)
  const [rohtext, setRohtext] = useState('')
  const [zuordnung, setZuordnung] = useState<Partial<Record<Ziel, string>>>({})

  function kameraAus() {
    stromRef.current?.getTracks().forEach((t) => t.stop())
    stromRef.current = null
  }

  async function kameraAn() {
    try {
      const strom = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
      })
      stromRef.current = strom
      if (videoRef.current) videoRef.current.srcObject = strom
      else strom.getTracks().forEach((t) => t.stop())
    } catch {
      setStand('fehler')
      setFehler('Keine Kamera verfügbar. Die Seite braucht die Kameraerlaubnis des Browsers.')
    }
  }

  // Die Kamera läuft nur, solange das Bild gebraucht wird: beim Aufnehmen und
  // beim Schließen wird sie ausgeschaltet, nicht erst beim Verlassen der Seite.
  useEffect(() => {
    if (stand !== 'kamera') return
    let abgebrochen = false
    void kameraAn().then(() => { if (abgebrochen) kameraAus() })
    return () => { abgebrochen = true; kameraAus() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand])

  async function ausloesen() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const bild = ausschnitt(video)
    kameraAus()
    setStand('lesen')
    setFortschritt(0)
    try {
      const text = await textErkennen(bild, setFortschritt)
      setRohtext(text)
      setDaten(egkLesen(text))
      setStand('fertig')
    } catch {
      setStand('fehler')
      setFehler('Die Texterkennung konnte nicht geladen werden. Sie wird beim ersten Mal aus dem Netz geholt — danach geht es auch ohne Empfang.')
    } finally {
      // Das Bild wird nicht behalten.
      bild.width = 0
      bild.height = 0
    }
  }

  function uebernehmen() {
    const aus: Record<string, string> = {}
    if (daten?.versnr) aus.versnr = daten.versnr
    if (daten?.gebdatum) aus.gebdatum = daten.gebdatum
    for (const [ziel, zeile] of Object.entries(zuordnung)) if (zeile) aus[ziel] = zeile
    onUebernehmen(aus)
  }

  const zielUmschalten = (ziel: Ziel, zeile: string) =>
    setZuordnung((v) => ({ ...v, [ziel]: v[ziel] === zeile ? undefined : zeile }))

  const anzahl = (daten?.versnr ? 1 : 0) + (daten?.gebdatum ? 1 : 0) + Object.values(zuordnung).filter(Boolean).length

  return (
    <div
      role="dialog" aria-label="Gesundheitskarte fotografieren"
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(26,14,8,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) { kameraAus(); onSchliessen() } }}
    >
      <div style={{ background: 'var(--warm-bg)', width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px 16px 0 0', padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Gesundheitskarte</div>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>
              Vorderseite · Erkennung auf dem Gerät, das Bild wird nicht gespeichert
            </div>
          </div>
          <button type="button" onClick={() => { kameraAus(); onSchliessen() }}
            style={{ background: 'transparent', border: 'none', color: GRAU, fontSize: 22, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>×</button>
        </div>

        {stand === 'kamera' ? (
          <>
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block' }} />
              <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '86%', aspectRatio: String(KARTE), border: '2px solid rgba(255,255,255,0.9)', borderRadius: 10, boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)' }} />
              </div>
            </div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: GRAU, textAlign: 'center', margin: '8px 0 10px' }}>
              Karte in den Rahmen legen, Schrift scharf stellen
            </div>
            <button type="button" onClick={ausloesen}
              style={{ width: '100%', padding: '13px', background: ROT, border: 'none', borderRadius: 10, color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer' }}>
              Aufnehmen
            </button>
          </>
        ) : null}

        {stand === 'lesen' ? (
          <div style={{ padding: '28px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: TEXT, marginBottom: 10 }}>Karte wird gelesen…</div>
            <div style={{ height: 4, background: 'rgba(96,8,18,0.1)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round(fortschritt * 100)}%`, background: ROT, transition: 'width .2s' }} />
            </div>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginTop: 10 }}>
              Beim ersten Mal wird die Texterkennung geladen, das dauert einen Moment.
            </div>
          </div>
        ) : null}

        {stand === 'fehler' ? (
          <div style={{ padding: '14px 12px', background: '#fff', borderLeft: '3px solid #d97706', borderRadius: 8, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
            {fehler}
          </div>
        ) : null}

        {stand === 'fertig' && daten ? (
          <>
            <div style={{ background: '#fff', borderRadius: 12, borderLeft: `3px solid ${ROT}`, padding: '4px 12px 10px', marginBottom: 10 }}>
              <Reihe
                marke="Versicherten-Nr." wert={daten.versnr}
                hinweis={daten.versnr
                  ? (kvnrGueltig(daten.versnr) ? 'Prüfziffer passt' : 'Prüfziffer passt nicht — bitte vergleichen')
                  : undefined}
              />
              <Reihe marke="Geburtsdatum" wert={daten.gebdatum} />
              <Reihe marke="Kassennummer" wert={daten.kassennr} hinweis="wird nicht übernommen, nur zum Vergleichen" />
            </div>

            <div style={{ background: '#fff', borderRadius: 12, borderLeft: `3px solid ${ROT}`, padding: '11px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: ROT, marginBottom: 2 }}>
                Name zuordnen
              </div>
              <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginBottom: 8 }}>
                Welche Zeile was ist, steht auf jeder Karte woanders — deshalb wird es nicht geraten.
              </div>
              {daten.zeilen.length === 0 ? (
                <div style={{ fontSize: 13, fontStyle: 'italic', color: GRAU }}>Keine Textzeile erkannt.</div>
              ) : (
                daten.zeilen.map((zeile) => (
                  <div key={zeile} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '0.5px solid rgba(96,8,18,0.06)' }}>
                    <span style={{ flex: 1, fontSize: 14, color: TEXT, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{zeile}</span>
                    {(['name', 'vorname', 'kasse'] as Ziel[]).map((ziel) => (
                      <button
                        key={ziel} type="button" onClick={() => zielUmschalten(ziel, zeile)}
                        style={{
                          padding: '5px 9px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                          background: zuordnung[ziel] === zeile ? ROT : '#fff',
                          color: zuordnung[ziel] === zeile ? '#fff' : TEXT,
                          border: `0.5px solid ${zuordnung[ziel] === zeile ? ROT : LINIE}`,
                          fontWeight: zuordnung[ziel] === zeile ? 700 : 400,
                        }}
                      >
                        {ziel === 'name' ? 'Name' : ziel === 'vorname' ? 'Vorname' : 'Kasse'}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setDaten(null); setZuordnung({}); setStand('kamera') }}
                style={{ flex: 1, padding: '12px', background: 'transparent', border: `0.5px solid ${LINIE}`, borderRadius: 10, color: GRAU, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Neu aufnehmen
              </button>
              <button type="button" onClick={uebernehmen} disabled={anzahl === 0}
                style={{ flex: 2, padding: '12px', background: anzahl === 0 ? 'rgba(96,8,18,0.25)' : ROT, border: 'none', borderRadius: 10, color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: anzahl === 0 ? 'default' : 'pointer' }}>
                {anzahl === 0 ? 'Nichts zu übernehmen' : `${anzahl} Angaben übernehmen`}
              </button>
            </div>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, textAlign: 'center', marginTop: 8 }}>
              Die Adresse steht nicht auf der Karte — sie liegt nur im Chip.
            </div>

            {/* Wenn wenig erkannt wurde, hilft beim Melden nur, was die
                Kamera wirklich gelesen hat. */}
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 11, color: GRAU, cursor: 'pointer' }}>Erkannten Text anzeigen</summary>
              <pre style={{ margin: '6px 0 0', padding: 10, background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 8, fontSize: 11, lineHeight: 1.4, color: TEXT, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 180, overflow: 'auto' }}>
                {rohtext.trim() || 'Die Kamera hat keinen Text gelesen — Karte näher heran, mehr Licht, Schrift scharf stellen.'}
              </pre>
            </details>
          </>
        ) : null}
      </div>
    </div>
  )
}
