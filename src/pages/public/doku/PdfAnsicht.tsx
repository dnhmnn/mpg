// Das Protokoll ansehen, wie es gedruckt aussieht.
//
// Der Bogen ist auf zwei A4-Seiten mit festen Punktkoordinaten gesetzt — er
// ist 794 Pixel breit und passt damit auf kein Telefon. Deshalb zwei
// Ansichten: eingepasst, um die ganze Seite zu überblicken, und in
// Originalgröße zum Lesen, mit Scrollen in beide Richtungen.
//
// Die Vorlage wird erst beim Öffnen geladen. Sie zieht den Feldkatalog und
// beide Seitenvorlagen nach sich; im Weg der Erfassung hat das nichts zu
// suchen.

import { useEffect, useMemo, useRef, useState } from 'react'

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.14)'

/** Breite des gesetzten Bogens in Pixeln — A4 bei 96 dpi. */
const BOGEN_BREITE = 794
/** Bis die wirkliche Höhe gemessen ist: zwei A4-Seiten plus Luft. */
const HOEHE_VORLAEUFIG = Math.round(BOGEN_BREITE * 2.95)

type Vorlage = {
  aelrdHtml: (p: Record<string, unknown>, kopf: Record<string, string>) => string
  aelrdDrucken: (p: Record<string, unknown>, kopf: Record<string, string>) => boolean
}

export default function PdfAnsicht({ werte, organisation, onSchliessen }: {
  werte: Record<string, unknown>
  organisation: string
  onSchliessen: () => void
}) {
  const [vorlage, setVorlage] = useState<Vorlage | null>(null)
  const [fehler, setFehler] = useState('')
  const [eingepasst, setEingepasst] = useState(true)
  const [blockiert, setBlockiert] = useState(false)
  const rahmenRef = useRef<HTMLDivElement>(null)
  const [breite, setBreite] = useState(0)
  /**
   * Die Höhe wird gemessen, nicht gerechnet.
   *
   * Erst stand hier das Verhältnis zweier A4-Seiten als Faktor — und schnitt
   * die zweite Seite unten ab, weil der gesetzte Bogen höher baut als das
   * Papierformat. Der Rahmen stammt aus derselben Seite, ist also auslesbar.
   */
  const [hoehe, setHoehe] = useState(HOEHE_VORLAEUFIG)

  useEffect(() => {
    let weg = false
    void import('../../../lib/aelrdProtokoll')
      .then((m) => { if (!weg) setVorlage(m as unknown as Vorlage) })
      .catch((f) => { if (!weg) setFehler(`Die Druckvorlage ließ sich nicht laden: ${(f as { message?: string })?.message ?? 'unbekannt'}`) })
    return () => { weg = true }
  }, [])

  // Die verfügbare Breite messen, um den Bogen darauf einzupassen.
  useEffect(() => {
    const messen = () => setBreite(rahmenRef.current?.clientWidth ?? 0)
    messen()
    window.addEventListener('resize', messen)
    return () => window.removeEventListener('resize', messen)
  }, [vorlage])

  const kopf = useMemo(
    () => ({ organisation, protokollNr: '', erstellt: '' }),
    [organisation],
  )
  const html = useMemo(
    () => (vorlage ? vorlage.aelrdHtml(werte, kopf) : ''),
    [vorlage, werte, kopf],
  )

  const faktor = eingepasst && breite > 0 ? Math.min(1, breite / BOGEN_BREITE) : 1

  return (
    <div
      role="dialog" aria-label="Protokoll ansehen"
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--warm-bg)', display: 'flex', flexDirection: 'column' }}
    >
      <header style={{ flexShrink: 0, background: '#fff', borderBottom: `0.5px solid ${LINIE}`, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Protokoll</div>
          <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>
            so wird es gedruckt · zwei Seiten A4
          </div>
        </div>

        <button
          type="button" onClick={() => setEingepasst((v) => !v)}
          style={{ padding: '7px 11px', background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 8, color: TEXT, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {eingepasst ? 'Originalgröße' : 'Einpassen'}
        </button>

        <button
          type="button"
          onClick={() => { if (vorlage) setBlockiert(!vorlage.aelrdDrucken(werte, kopf)) }}
          disabled={!vorlage}
          style={{ padding: '7px 13px', background: vorlage ? ROT : 'rgba(96,8,18,0.25)', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: vorlage ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
        >
          PDF
        </button>

        <button type="button" onClick={onSchliessen} aria-label="Schließen"
          style={{ background: 'transparent', border: 'none', color: GRAU, fontSize: 24, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit', padding: '0 2px' }}>×</button>
      </header>

      {blockiert ? (
        <div style={{ flexShrink: 0, margin: '10px 12px 0', padding: '9px 12px', background: '#fff', borderLeft: '3px solid #d97706', borderRadius: 8, fontSize: 12, color: TEXT }}>
          Der Browser hat das Druckfenster blockiert. Pop-ups für diese Seite erlauben, dann erneut auf PDF tippen.
        </div>
      ) : null}

      {fehler ? (
        <div style={{ margin: 12, padding: '14px 12px', background: '#fff', borderLeft: '3px solid #d97706', borderRadius: 8, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
          {fehler}
        </div>
      ) : null}

      <div
        ref={rahmenRef}
        style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 10, WebkitOverflowScrolling: 'touch' }}
      >
        {!vorlage && !fehler ? (
          <div style={{ padding: '40px 12px', textAlign: 'center', fontSize: 13, color: GRAU, fontStyle: 'italic' }}>
            Druckvorlage wird geladen…
          </div>
        ) : null}

        {vorlage ? (
          <div style={{ width: BOGEN_BREITE * faktor, height: hoehe * faktor, position: 'relative' }}>
            <iframe
              title="Protokoll, wie es gedruckt wird"
              srcDoc={html}
              onLoad={(e) => {
                const d = e.currentTarget.contentDocument
                const gemessen = d?.documentElement?.scrollHeight ?? 0
                if (gemessen > 100) setHoehe(gemessen + 8)
              }}
              style={{
                width: BOGEN_BREITE,
                height: hoehe,
                border: `0.5px solid ${LINIE}`,
                background: '#fff',
                transform: `scale(${faktor})`,
                transformOrigin: 'top left',
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
