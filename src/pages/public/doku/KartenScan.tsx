// Die Gesundheitskarte abfotografieren und das Aufgedruckte übernehmen.
//
// ZWEI WEGE, und der verlässlichere ist der erste:
//
// 1. DIE KAMERA-APP DES TELEFONS. Ein Dateifeld mit capture öffnet sie. Sie
//    hat Autofokus, Makro und ihren eigenen Blitz — alles, was eine Vorschau
//    im Browser nicht sicher kann. Für kleine Schrift auf einer glänzenden
//    Karte ist das der Unterschied zwischen lesbar und nicht lesbar.
//
// 2. DIE VORSCHAU IM BROWSER. Schneller, aber abhängig davon, was das Gerät
//    an getUserMedia und an Licht zulässt. Bleibt als Zweitweg.
//
// DAS BILD WIRD NICHT GESPEICHERT. Es lebt im Arbeitsspeicher, bis der Text
// erkannt ist, und geht weder ins Protokoll noch an einen Server. Die
// Texterkennung läuft auf dem Gerät.
//
// NICHTS WIRD UNGEFRAGT ÜBERNOMMEN. Was die Kamera gelesen hat, steht zum
// Vergleichen da, und erst ein Tipp trägt es ins Formular.

import { useEffect, useRef, useState } from 'react'
import { egkGenug, egkLeer, egkLesen, egkSammeln, kvnrGueltig, type EgkDaten } from '../../../lib/egk'

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.14)'

const TESSERACT_ESM = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js'
const TESSERACT_UMD = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'

type Stand = 'wahl' | 'live' | 'lesen' | 'fertig' | 'fehler'
type Ziel = 'name' | 'vorname' | 'kasse'

/** Das Seitenverhältnis einer Scheckkarte (ID-1): 85,6 × 54 mm. */
const KARTE = 85.6 / 54
/**
 * Wie breit das Bild in die Erkennung geht.
 *
 * Gemessen an einer glänzenden, leicht unscharfen Testkarte: 2200 px
 * brauchen 841 ms, 1200 px 480 ms, 700 px 343 ms — und gefunden wird in
 * allen Fällen dasselbe. Hochskalieren bringt nichts, es verdoppelt nur die
 * Arbeit: ein vergrößertes Bild enthält keine zusätzliche Information.
 *
 * Für das laufende Bild zählt die Geschwindigkeit, für das Foto die Reserve
 * bei schwieriger Schrift.
 */
const BREITE_LIVE = 1200
const BREITE_FOTO = 1600
/**
 * Wann das Lesen aus dem laufenden Bild aufgibt.
 *
 * Ohne Grenze liest es weiter, solange der Dialog offen ist — bei einer
 * Karte, deren Prüfziffer nicht aufgeht, also endlos. Im Einsatz hieße das
 * ein heiß werdendes Telefon und einen leeren Akku. Nach dieser Zeit wird
 * gezeigt, was da ist, und der Rest von Hand ergänzt.
 */
const LIVE_HOECHSTDAUER_MS = 45_000

type TesseractWorker = {
  recognize: (bild: HTMLCanvasElement) => Promise<{ data?: { text?: string } }>
  terminate: () => Promise<void>
}

type TesseractModul = {
  createWorker: (
    sprache: string,
    oem: number,
    optionen: { logger: (m: { status: string; progress: number }) => void },
  ) => Promise<TesseractWorker>
}

function umdLaden(): Promise<TesseractModul> {
  return new Promise((erfuellen, ablehnen) => {
    const vorhanden = (window as { Tesseract?: TesseractModul }).Tesseract
    if (vorhanden?.createWorker) return erfuellen(vorhanden)
    const skript = document.createElement('script')
    skript.src = TESSERACT_UMD
    skript.onload = () => {
      const t = (window as { Tesseract?: TesseractModul }).Tesseract
      if (t?.createWorker) erfuellen(t)
      else ablehnen(new Error('Skript geladen, aber ohne Tesseract'))
    }
    skript.onerror = () => ablehnen(new Error('Skript nicht erreichbar'))
    document.head.appendChild(skript)
  })
}

/**
 * Die Bibliothek holen — erst als Modul, sonst als Skript.
 *
 * Der ESM-Build hat NUR einen Default-Export; `createWorker` ist dort kein
 * benannter Export. Dieser Griff daneben war der Fehler, mit dem die
 * Erkennung nie ansprang.
 */
async function tesseractHolen(): Promise<TesseractModul> {
  try {
    const geladen = (await import(/* @vite-ignore */ TESSERACT_ESM)) as
      { default?: TesseractModul } & Partial<TesseractModul>
    const t = geladen.default ?? (geladen as TesseractModul)
    if (typeof t?.createWorker === 'function') return t
  } catch {
    // Weiter mit dem Skriptweg.
  }
  return umdLaden()
}

/**
 * Einen Leser aufmachen.
 *
 * Beim Lesen aus dem laufenden Bild wird er für alle Bilder derselbe: ihn je
 * Bild neu aufzumachen hieße, die Sprachdaten jedes Mal neu zu laden, und
 * dann käme man nie über ein Bild hinaus.
 */
async function leserOeffnen(fortschritt: (p: number) => void): Promise<TesseractWorker> {
  const tesseract = await tesseractHolen()
  return tesseract.createWorker('deu', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') fortschritt(m.progress)
    },
  })
}

/** Graustufen mit kräftigerem Kontrast — die Karte ist bunt bedruckt. */
function aufbereiten(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext('2d')
  if (!ctx) return c
  const bild = ctx.getImageData(0, 0, c.width, c.height)
  const d = bild.data
  for (let i = 0; i < d.length; i += 4) {
    const grau = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const stark = Math.max(0, Math.min(255, (grau - 128) * 1.5 + 128))
    d[i] = d[i + 1] = d[i + 2] = stark
  }
  ctx.putImageData(bild, 0, 0)
  return c
}

/** Ein aufgenommenes Foto auf eine für die Erkennung sinnvolle Größe bringen. */
async function ausDatei(datei: File): Promise<HTMLCanvasElement> {
  // imageOrientation dreht das Bild so, wie das Telefon es gehalten hat.
  const bitmap = await createImageBitmap(datei, { imageOrientation: 'from-image' })
  const faktor = Math.min(1, BREITE_FOTO / Math.max(bitmap.width, bitmap.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bitmap.width * faktor)
  c.height = Math.round(bitmap.height * faktor)
  c.getContext('2d')?.drawImage(bitmap, 0, 0, c.width, c.height)
  bitmap.close()
  return aufbereiten(c)
}

/** Den Ausschnitt der Karte aus dem laufenden Videobild holen. */
function ausVideo(video: HTMLVideoElement): HTMLCanvasElement {
  const vb = video.videoWidth
  const vh = video.videoHeight
  const breite = vb * 0.86
  const hoehe = Math.min(breite / KARTE, vh)
  const x = (vb - breite) / 2
  const y = (vh - hoehe) / 2
  const c = document.createElement('canvas')
  // In der Größe des Kamerabildes, höchstens so breit wie nötig.
  c.width = Math.round(Math.min(breite, BREITE_LIVE))
  c.height = Math.round((c.width / breite) * hoehe)
  c.getContext('2d')?.drawImage(video, x, y, breite, hoehe, 0, 0, c.width, c.height)
  return aufbereiten(c)
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

const knopfGross: React.CSSProperties = {
  width: '100%', padding: '14px', borderRadius: 10, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.07em',
}

export default function KartenScan({ onUebernehmen, onSchliessen }: {
  onUebernehmen: (werte: Record<string, string>) => void
  onSchliessen: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stromRef = useRef<MediaStream | null>(null)
  const dateiRef = useRef<HTMLInputElement>(null)
  const [stand, setStand] = useState<Stand>('wahl')
  const [fehler, setFehler] = useState('')
  const [fortschritt, setFortschritt] = useState(0)
  const [daten, setDaten] = useState<EgkDaten | null>(null)
  const [rohtext, setRohtext] = useState('')
  const [zuordnung, setZuordnung] = useState<Partial<Record<Ziel, string>>>({})
  const [lichtDa, setLichtDa] = useState(false)
  const [licht, setLicht] = useState(false)
  const [lichtFehler, setLichtFehler] = useState('')
  const [befund, setBefund] = useState<string[]>([])
  const [liveStand, setLiveStand] = useState('')
  const [aufgegeben, setAufgegeben] = useState('')
  const [liveDaten, setLiveDaten] = useState<EgkDaten>(egkLeer)
  const leserRef = useRef<TesseractWorker | null>(null)
  const laeuftRef = useRef(false)
  /** Der Leser wird schon geholt, während noch gewählt wird. */
  const vorratRef = useRef<Promise<TesseractWorker> | null>(null)

  const merken = (zeile: string) => setBefund((v) => [...v, zeile])

  /**
   * Den Leser besorgen — beim ersten Mal mit Laden, danach sofort.
   *
   * Das Laden beginnt schon, während die Besatzung noch wählt und die Karte
   * hinhält. Diese Sekunden sind sonst Wartezeit.
   */
  function leserBesorgen(): Promise<TesseractWorker> {
    if (!vorratRef.current) vorratRef.current = leserOeffnen(setFortschritt)
    return vorratRef.current
  }

  // Sobald der Dialog offen ist, im Hintergrund laden.
  useEffect(() => {
    void leserBesorgen().catch(() => {
      // Der Fehler wird dort gemeldet, wo jemand auf das Ergebnis wartet.
      vorratRef.current = null
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function kameraAus() {
    stromRef.current?.getTracks().forEach((t) => t.stop())
    stromRef.current = null
    setLicht(false)
    setLichtDa(false)
  }

  /**
   * Das Licht der Kamera schalten.
   *
   * Es wird nachgesehen, ob es wirklich an ist: manche Geräte melden die
   * Fähigkeit, nehmen den Befehl entgegen und schalten trotzdem nichts.
   * Dann soll dastehen, dass es nicht ging, statt dass der Knopf leuchtet.
   */
  async function lichtSchalten(an: boolean) {
    const spur = stromRef.current?.getVideoTracks()[0]
    if (!spur) {
      setLichtFehler('Kein Kamerabild — Licht lässt sich nicht schalten.')
      return
    }
    try {
      await spur.applyConstraints({ advanced: [{ torch: an }] } as unknown as MediaTrackConstraints)
      const jetzt = (spur.getSettings() as { torch?: boolean }).torch
      merken(`Licht ${an ? 'an' : 'aus'} geschaltet, Gerät meldet zurück: ${String(jetzt)}`)
      if (an && jetzt === false) {
        setLichtFehler('Das Gerät nimmt den Befehl an, schaltet das Licht aber nicht. Mit "Lieber ein Foto aufnehmen" geht der Blitz der Kamera-App.')
        setLicht(false)
        return
      }
      setLichtFehler('')
      setLicht(an)
    } catch (f) {
      merken(`Licht nicht schaltbar: ${(f as { name?: string })?.name ?? 'Fehler'}`)
      setLichtFehler(`Dieses Gerät lässt das Licht aus dem Browser nicht schalten (${(f as { name?: string })?.name ?? 'Fehler'}). Mit "Lieber ein Foto aufnehmen" geht der Blitz der Kamera-App.`)
    }
  }

  async function kameraAn() {
    try {
      const strom = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
      })
      stromRef.current = strom
      if (!videoRef.current) {
        strom.getTracks().forEach((t) => t.stop())
        stromRef.current = null
        return
      }
      videoRef.current.srcObject = strom
      await videoRef.current.play().catch(() => {})
      const spur = strom.getVideoTracks()[0]

      // Erst nachsehen, wenn die Kamera wirklich läuft: manche Geräte melden
      // ihre Fähigkeiten vorher nicht. Deshalb wird nach dem ersten Bild
      // noch einmal gefragt.
      const kannLicht = () =>
        Boolean((spur?.getCapabilities?.() as { torch?: boolean } | undefined)?.torch)
      setLichtDa(kannLicht())
      window.setTimeout(() => { if (stromRef.current === strom && kannLicht()) setLichtDa(true) }, 900)

      merken(`Kamera: ${spur?.label || 'ohne Namen'}, Licht gemeldet: ${kannLicht() ? 'ja' : 'nein'}`)
    } catch (f) {
      const name = (f as { name?: string })?.name
      setStand('fehler')
      setFehler(
        name === 'NotAllowedError'
          ? 'Der Browser hat die Kamera nicht freigegeben. In den Seiteneinstellungen die Kamera erlauben und neu laden.'
          : name === 'NotFoundError'
            ? 'Dieses Gerät meldet keine Kamera.'
            : `Die Kamera lässt sich nicht öffnen (${name ?? 'unbekannter Fehler'}). Die Seite muss über https geöffnet sein.`,
      )
    }
  }

  /** Ein Einzelbild lesen und in das bisher Gesammelte eintragen. */
  async function einBildLesen(): Promise<EgkDaten | null> {
    const video = videoRef.current
    const leser = leserRef.current
    if (!video || !video.videoWidth || !leser) return null
    const bild = ausVideo(video)
    try {
      const { data } = await leser.recognize(bild)
      return egkLesen(String(data?.text ?? ''))
    } finally {
      // Das Einzelbild wird sofort verworfen; es wird nie zu einer Datei.
      bild.width = 0
      bild.height = 0
    }
  }

  /**
   * Aus dem laufenden Bild lesen, bis es reicht.
   *
   * Kein Foto, keine Datei, nichts im Speicher des Telefons: jedes Einzelbild
   * geht aus der Kamera in den Arbeitsspeicher und von dort wieder weg. Die
   * Prüfziffer sagt, wann es reicht — stimmt sie und steht das Geburtsdatum,
   * schaltet die Kamera sich ab.
   */
  async function liveLesen() {
    laeuftRef.current = true
    setLiveStand('Texterkennung wird geladen…')
    try {
      leserRef.current = await leserBesorgen()
    } catch (f) {
      laeuftRef.current = false
      setStand('fehler')
      setFehler(`Die Texterkennung lief nicht an: ${(f as { message?: string })?.message ?? 'unbekannt'}.`)
      return
    }
    setLiveStand('Karte in den Rahmen halten')

    let gesammelt = egkLeer()
    let durchgang = 0
    const bis = Date.now() + LIVE_HOECHSTDAUER_MS
    while (laeuftRef.current) {
      if (Date.now() > bis) {
        merken(`live aufgegeben nach ${durchgang} Bildern`)
        laeuftRef.current = false
        kameraAus()
        setDaten(gesammelt)
        setAufgegeben(
          gesammelt.versnr
            ? 'Die Prüfziffer der gelesenen Nummer geht nicht auf. Bitte vergleichen und bei Bedarf von Hand berichtigen.'
            : 'Aus dem Kamerabild war nichts Verwertbares zu lesen. Mit mehr Licht erneut versuchen oder ein Foto aufnehmen.',
        )
        setStand('fertig')
        return
      }
      const neu = await einBildLesen()
      if (!laeuftRef.current) break
      if (neu) {
        durchgang += 1
        gesammelt = egkSammeln(gesammelt, neu)
        setLiveDaten(gesammelt)
        setLiveStand(
          egkGenug(gesammelt)
            ? 'Karte gelesen'
            : `Lese… (${durchgang}. Bild${gesammelt.versnr ? ', Nummer erkannt' : ''})`,
        )
        if (egkGenug(gesammelt)) {
          merken(`live gelesen nach ${durchgang} Bildern`)
          laeuftRef.current = false
          kameraAus()
          setDaten(gesammelt)
          setStand('fertig')
          return
        }
      }
      // Kurz Luft lassen, damit die Oberfläche bedienbar bleibt.
      await new Promise((r) => setTimeout(r, 120))
    }
  }

  /** Das Lesen anhalten. Der Leser bleibt offen für den nächsten Versuch. */
  function liveAus() {
    laeuftRef.current = false
    leserRef.current = null
  }

  /** Beim Schließen des Dialogs wird der Leser wirklich beendet. */
  function leserSchliessen() {
    const vorrat = vorratRef.current
    vorratRef.current = null
    void vorrat?.then((l) => l.terminate()).catch(() => {})
  }

  useEffect(() => {
    if (stand !== 'live') return
    let abgebrochen = false
    void (async () => {
      await kameraAn()
      if (abgebrochen) { kameraAus(); return }
      await liveLesen()
    })()
    return () => { abgebrochen = true; liveAus(); kameraAus() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand])

  async function erkennen(bild: HTMLCanvasElement, woher: string) {
    setStand('lesen')
    setFortschritt(0)
    merken(`${woher}: ${bild.width}×${bild.height} px`)
    let leser: TesseractWorker | null = null
    try {
      leser = await leserBesorgen()
      const { data } = await leser.recognize(bild)
      const text = String(data?.text ?? '')
      merken(`erkannt: ${text.replace(/\s+/g, ' ').trim().length} Zeichen`)
      setRohtext(text)
      setDaten(egkLesen(text))
      setStand('fertig')
    } catch (f) {
      setStand('fehler')
      setFehler(`Die Texterkennung lief nicht an: ${(f as { message?: string })?.message ?? 'unbekannt'}.`)
    } finally {
      // Nicht schließen: derselbe Leser wird für den nächsten Versuch
      // gebraucht, und ihn neu aufzumachen hieße neu zu laden.
      void leser
      bild.width = 0
      bild.height = 0
    }
  }

  /** Das bisher Gelesene nehmen, ohne auf die Prüfziffer zu warten. */
  function liveUebernehmen() {
    liveAus()
    kameraAus()
    setDaten(liveDaten)
    setStand('fertig')
  }

  async function ausFoto(datei: File | undefined) {
    if (!datei) return
    try {
      const bild = await ausDatei(datei)
      await erkennen(bild, `Foto (${Math.round(datei.size / 1024)} kB)`)
    } catch (f) {
      setStand('fehler')
      setFehler(`Das Foto ließ sich nicht öffnen: ${(f as { message?: string })?.message ?? 'unbekannt'}.`)
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

  function schliessen() {
    liveAus()
    leserSchliessen()
    kameraAus()
    onSchliessen()
  }

  return (
    <div
      role="dialog" aria-label="Gesundheitskarte fotografieren"
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(26,14,8,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) schliessen() }}
    >
      <div style={{ background: 'var(--warm-bg)', width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px 16px 0 0', padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Gesundheitskarte</div>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>
              Vorderseite · Erkennung auf dem Gerät, das Bild wird nicht gespeichert
            </div>
            <div style={{ fontSize: 10, color: GRAU, opacity: 0.8 }}>Fassung {__BUILD__}</div>
          </div>
          <button type="button" onClick={schliessen}
            style={{ background: 'transparent', border: 'none', color: GRAU, fontSize: 22, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>×</button>
        </div>

        {/* Immer vorhanden, damit der Knopf das Feld sicher erreicht. */}
        <input
          ref={dateiRef} type="file" accept="image/*" capture="environment"
          onChange={(e) => { void ausFoto(e.target.files?.[0]); e.target.value = '' }}
          style={{ display: 'none' }}
        />

        {stand === 'wahl' ? (
          <>
            <button type="button" onClick={() => { setLiveDaten(egkLeer()); setStand('live') }}
              style={{ ...knopfGross, background: ROT, border: 'none', color: '#fff', marginBottom: 8 }}>
              Karte vor die Kamera halten
            </button>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, textAlign: 'center', marginBottom: 14, lineHeight: 1.45 }}>
              Liest fortlaufend aus dem Kamerabild. Es entsteht kein Foto — kein
              Bild der Karte landet in der Galerie des Telefons und damit auch in
              keiner Cloud-Sicherung.
            </div>
            <button type="button" onClick={() => dateiRef.current?.click()}
              style={{ ...knopfGross, background: 'transparent', border: `0.5px solid ${LINIE}`, color: GRAU }}>
              Stattdessen ein Foto aufnehmen
            </button>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, textAlign: 'center', marginTop: 8, lineHeight: 1.45 }}>
              Öffnet die Kamera-App mit Autofokus und Blitz — hilft bei
              schwieriger Schrift, legt aber je nach Telefon ein Foto in der Galerie ab.
            </div>
          </>
        ) : null}

        {stand === 'live' ? (
          <>
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', minHeight: 160 }} />
              <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '86%', aspectRatio: String(KARTE), border: '2px solid rgba(255,255,255,0.9)', borderRadius: 10, boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)' }} />
              </div>
              {/* Auch ohne Meldung anbieten: manche Geräte können es, sagen
                  es aber nicht. Geht es nicht, steht der Grund darunter. */}
              {lichtDa || !lichtFehler ? (
                <button
                  type="button" onClick={() => void lichtSchalten(!licht)}
                  aria-label={licht ? 'Licht aus' : 'Licht an'}
                  style={{
                    position: 'absolute', right: 10, top: 10, width: 46, height: 46,
                    borderRadius: 23, cursor: 'pointer', fontFamily: 'inherit', fontSize: 20,
                    background: licht ? '#fff' : 'rgba(0,0,0,0.5)',
                    color: licht ? ROT : '#fff',
                    border: '0.5px solid rgba(255,255,255,0.6)',
                  }}
                >
                  ☼
                </button>
              ) : null}
            </div>

            {lichtFehler ? (
              <div style={{ margin: '8px 0 0', padding: '8px 10px', background: '#fff', borderLeft: '3px solid #d97706', borderRadius: 8, fontSize: 12, color: TEXT, lineHeight: 1.45 }}>
                {lichtFehler}
              </div>
            ) : null}

            <div style={{ fontSize: 12, color: TEXT, textAlign: 'center', margin: '10px 0 4px', fontWeight: 700 }}>
              {liveStand || 'Kamera startet…'}
            </div>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, textAlign: 'center', marginBottom: 10 }}>
              Es wird kein Foto gemacht — jedes Bild wird gelesen und sofort verworfen.
            </div>

            {/* Was schon dasteht, während weitergelesen wird. */}
            <div style={{ background: '#fff', borderRadius: 12, borderLeft: `3px solid ${ROT}`, padding: '4px 12px 8px', marginBottom: 10 }}>
              <Reihe
                marke="Versicherten-Nr." wert={liveDaten.versnr}
                hinweis={liveDaten.versnr && kvnrGueltig(liveDaten.versnr) ? 'Prüfziffer passt' : undefined}
              />
              <Reihe marke="Geburtsdatum" wert={liveDaten.gebdatum} />
            </div>

            <button type="button" onClick={liveUebernehmen}
              style={{ ...knopfGross, background: ROT, border: 'none', color: '#fff', marginBottom: 8 }}>
              Übernehmen, was bisher da ist
            </button>
            <button type="button" onClick={() => { liveAus(); kameraAus(); dateiRef.current?.click() }}
              style={{ ...knopfGross, background: 'transparent', border: `0.5px solid ${LINIE}`, color: GRAU }}>
              Lieber ein Foto aufnehmen
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
              Beim ersten Mal wird die Texterkennung geladen — das dauert eine Weile,
              und der Balken bewegt sich erst danach.
            </div>
          </div>
        ) : null}

        {stand === 'fehler' ? (
          <>
            <div style={{ padding: '14px 12px', background: '#fff', borderLeft: '3px solid #d97706', borderRadius: 8, fontSize: 13, color: TEXT, lineHeight: 1.5, marginBottom: 10 }}>
              {fehler}
            </div>
            <button type="button" onClick={() => { setFehler(''); setStand('wahl') }}
              style={{ ...knopfGross, background: ROT, border: 'none', color: '#fff' }}>
              Von vorn
            </button>
          </>
        ) : null}

        {stand === 'fertig' && daten ? (
          <>
            {aufgegeben ? (
              <div style={{ padding: '10px 12px', background: '#fff', borderLeft: '3px solid #d97706', borderRadius: 8, fontSize: 12, color: TEXT, lineHeight: 1.45, marginBottom: 10 }}>
                {aufgegeben}
              </div>
            ) : null}
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
              <button type="button" onClick={() => { setDaten(null); setZuordnung({}); setRohtext(''); setAufgegeben(''); setStand('wahl') }}
                style={{ ...knopfGross, flex: 1, background: 'transparent', border: `0.5px solid ${LINIE}`, color: GRAU, textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>
                Neu aufnehmen
              </button>
              <button type="button" onClick={uebernehmen} disabled={anzahl === 0}
                style={{ ...knopfGross, flex: 2, background: anzahl === 0 ? 'rgba(96,8,18,0.25)' : ROT, border: 'none', color: '#fff', fontSize: 12, cursor: anzahl === 0 ? 'default' : 'pointer' }}>
                {anzahl === 0 ? 'Nichts zu übernehmen' : `${anzahl} Angaben übernehmen`}
              </button>
            </div>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, textAlign: 'center', marginTop: 8 }}>
              Die Adresse steht nicht auf der Karte — sie liegt nur im Chip.
            </div>
          </>
        ) : null}

        {/* Was das Gerät gemeldet hat. Ohne das bleibt bei "geht nicht" nur Raten. */}
        {stand !== 'wahl' ? (
          <details style={{ marginTop: 10 }}>
            <summary style={{ fontSize: 11, color: GRAU, cursor: 'pointer' }}>Erkannten Text und Gerätemeldungen anzeigen</summary>
            <pre style={{ margin: '6px 0 0', padding: 10, background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 8, fontSize: 11, lineHeight: 1.4, color: TEXT, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflow: 'auto' }}>
              {[`Fassung ${__BUILD__}`, ...befund, '', rohtext.trim() || '(kein Text erkannt)'].join('\n')}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  )
}
