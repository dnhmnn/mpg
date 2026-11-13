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
import { ABSENDER_ABZEICHEN, absenderAusObjekt } from '../../../lib/formular/absender'
import { altfelder, mitAltfeldern } from '../../../lib/patientenAltfelder'
import { useOrg } from '../OrgPublicLayout'

const ROT = 'var(--lbf-akzent)'
/** Der Akzent als gefüllte Fläche mit heller Schrift darauf. */
const ROT_GRUND = 'var(--lbf-akzent-grund)'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(var(--lbf-rot-rgb),0.14)'

/** Breite des gesetzten Bogens in Pixeln — A4 bei 96 dpi. */
const BOGEN_BREITE = 794
/** Bis die wirkliche Höhe gemessen ist: zwei A4-Seiten plus Luft. */
const HOEHE_VORLAEUFIG = Math.round(BOGEN_BREITE * 2.95)

type Vorlage = {
  aelrdHtml: (p: Record<string, unknown>, kopf: Record<string, string>) => string
  aelrdDrucken: (p: Record<string, unknown>, kopf: Record<string, string>) => boolean
}

export default function PdfAnsicht({ werte, organisation, onSchliessen, zumFormular = false, hinweis = '', formConfig }: {
  werte: Record<string, unknown>
  organisation: string
  onSchliessen: () => void
  /**
   * form_config der Organisation: beschriftet Werte früherer eigener Felder
   * (Bauplan Vorgänge, B1). Fehlt es, gilt das der Organisation, in der die
   * Maske steht (PdfAnsicht öffnet nur aus Doku, also im OrgKontext).
   */
  formConfig?: unknown
  /**
   * Diese Ansicht ist der Einstieg, nicht ein Fenster darüber.
   *
   * Dann schließt sie nicht, sondern führt weiter: zum Formular, das hinter
   * ihr liegt. Ein Kreuz sagte dort das Falsche — es sähe aus, als ginge
   * damit das Protokoll zu.
   */
  zumFormular?: boolean
  /** Ein Satz, der zum Zugang gehört — etwa, bis wann er gilt. */
  hinweis?: string
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
  /*
   * Werte früherer eigener Felder der Organisation (die Patientendoku ist fest,
   * PO 2): auf einer eigenen Seite hinter dem Bogen, in Ansicht und Ausdruck.
   * Der Bogen selbst bleibt, wie er ist.
   */
  const { org } = useOrg()
  const alte = useMemo(
    () => altfelder(werte, formConfig ?? org?.form_config),
    [werte, formConfig, org],
  )
  const html = useMemo(
    () => (vorlage ? mitAltfeldern(vorlage.aelrdHtml(werte, kopf), alte) : ''),
    [vorlage, werte, kopf, alte],
  )

  /** PDF: der Bogen im eigenen Fenster; mit früheren eigenen Feldern dasselbe Blatt wie in der Ansicht. */
  function drucken(): boolean {
    if (!vorlage) return true
    if (alte.length === 0) return vorlage.aelrdDrucken(werte, kopf)
    const fenster = window.open('', '_blank', 'width=1000,height=750')
    if (!fenster) return false
    fenster.document.write(html)
    fenster.document.close()
    return true
  }

  const faktor = eingepasst && breite > 0 ? Math.min(1, breite / BOGEN_BREITE) : 1

  /*
   * Ist der Absender nicht bestätigt, steht das über dem Bogen (Bauplan v2,
   * 4.4). Der gedruckte Bogen selbst bleibt, wie er ist (ÄLRD-Layout).
   */
  const absender = absenderAusObjekt(werte.absender)
  const absenderHinweis = absender?.status === 'ausstehend'
    ? `Absender nicht bestätigt. Das Protokoll wartet auf die Unterschrift von ${absender.name.trim() || 'dem Absender'}.`
    : absender?.status === 'ohne_unterschrift' ? 'Ohne Unterschrift des Absenders abgeschlossen.' : ''
  const abzeichen = absender ? ABSENDER_ABZEICHEN[absender.status] : null

  return (
    <div
      role="dialog" aria-label="Protokoll ansehen"
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--warm-bg)', display: 'flex', flexDirection: 'column' }}
    >
      <header style={{ flexShrink: 0, background: 'var(--lbf-card)', borderBottom: `0.5px solid ${LINIE}`, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Protokoll</div>
          {/* Umbrechen statt abschneiden: auf dem Telefon fiele sonst gerade
              das Ende weg — und dort steht, bis wann der Zugang gilt. */}
          <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, lineHeight: 1.35 }}>
            {/* Steht ein Hinweis zum Zugang an, hat er Vorrang: auf dem
                Telefon ist für beides kein Platz, und dass der Bogen
                gedruckt aussieht, sieht man ohnehin. */}
            {hinweis || 'so wird es gedruckt · zwei Seiten A4'}
          </div>
        </div>

        <button
          type="button" onClick={() => setEingepasst((v) => !v)}
          style={{ padding: '7px 11px', background: 'var(--lbf-card)', border: `0.5px solid ${LINIE}`, borderRadius: 8, color: TEXT, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {eingepasst ? 'Originalgröße' : 'Einpassen'}
        </button>

        <button
          type="button"
          onClick={() => { if (vorlage) setBlockiert(!drucken()) }}
          disabled={!vorlage}
          style={{ padding: '7px 13px', background: vorlage ? ROT_GRUND : 'rgba(var(--lbf-rot-rgb),0.25)', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: vorlage ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
        >
          PDF
        </button>

        {zumFormular ? (
          <button
            type="button" onClick={onSchliessen}
            aria-label="Formular ansehen" title="Formular ansehen"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 38, height: 38, flexShrink: 0, borderRadius: 19,
              background: 'var(--lbf-card)', border: `0.5px solid ${LINIE}`, color: ROT,
              cursor: 'pointer', fontFamily: 'inherit', padding: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        ) : (
          <button type="button" onClick={onSchliessen} aria-label="Schließen"
            style={{ background: 'transparent', border: 'none', color: GRAU, fontSize: 24, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit', padding: '0 2px' }}>×</button>
        )}
      </header>

      {absenderHinweis ? (
        <div style={{ flexShrink: 0, margin: '10px 12px 0', padding: '9px 12px', background: 'var(--lbf-card)', borderLeft: `3px solid ${abzeichen?.farbe ?? GRAU}`, borderRadius: 8 }}>
          {abzeichen ? (
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: abzeichen.farbe, marginBottom: 3 }}>
              {abzeichen.text}
            </div>
          ) : null}
          <div style={{ fontSize: 12, fontStyle: 'italic', color: TEXT, lineHeight: 1.45 }}>{absenderHinweis}</div>
        </div>
      ) : null}

      {blockiert ? (
        <div style={{ flexShrink: 0, margin: '10px 12px 0', padding: '9px 12px', background: 'var(--lbf-card)', borderLeft: '3px solid #d97706', borderRadius: 8, fontSize: 12, color: TEXT }}>
          Der Browser hat das Druckfenster blockiert. Pop-ups für diese Seite erlauben, dann erneut auf PDF tippen.
        </div>
      ) : null}

      {fehler ? (
        <div style={{ margin: 12, padding: '14px 12px', background: 'var(--lbf-card)', borderLeft: '3px solid #d97706', borderRadius: 8, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
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
                // Das Blatt selbst bleibt Papier — weiß, auch im Dunkelmodus.
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
