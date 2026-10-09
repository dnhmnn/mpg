// Der Abschluss: prüfen und absenden.
//
// Was fehlt, steht hier — mit dem Grund, den die Regel nennt, und einem
// Griff, der zu dem Zettel springt, auf dem es steht. Ein Knopf, der nur
// "unvollständig" sagt, schickt einen suchen.

import { useState } from 'react'
import { pb } from '../../../lib/pocketbase'
import { aelrdFeld } from '../../../katalog/aelrd'
import type { Werte } from './DokuFeld'
import { datensatz, fristLaeuft, fristText, inWarteschlange, protokollnummer, pruefen } from './absenden'
import { zettelVon } from './zettel'

const ROT = 'var(--lbf-akzent)'
/** Der Akzent als gefüllte Fläche mit heller Schrift darauf. */
const ROT_GRUND = 'var(--lbf-akzent-grund)'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(var(--lbf-rot-rgb),0.14)'

export default function Absenden({ werte, orgId, orgCode, protokollId, onGesendet, onSpringen }: {
  werte: Werte
  orgId: string
  orgCode: string
  /** Gesetzt, wenn ein schon abgesendetes Protokoll geändert wird. */
  protokollId?: string
  onGesendet: (nummer: string, offline: boolean) => void
  onSpringen: (zettelId: string) => void
}) {
  const [sendet, setSendet] = useState(false)
  const [meldung, setMeldung] = useState('')
  const { haelt, fehlt } = pruefen(werte)

  const aendert = Boolean(protokollId)
  const inFrist = aendert ? fristLaeuft(werte) : true

  async function absenden() {
    if (haelt.length > 0 || !inFrist) return
    setSendet(true)
    setMeldung('')
    // Beim Ändern bleibt die Frist, wie sie ist — sonst verlängerte jede
    // Änderung sie um einen weiteren Tag.
    const satz = aendert
      ? { ...datensatz(werte, orgId), payload: werte }
      : datensatz(werte, orgId)
    if (!navigator.onLine) {
      const ging = inWarteschlange(window.localStorage, orgCode, satz)
      setSendet(false)
      if (ging) onGesendet('', true)
      else setMeldung('Ohne Netz und ohne Speicher — das Protokoll lässt sich gerade nicht ablegen.')
      return
    }
    try {
      const rec = aendert
        ? await pb.collection('patients').update(protokollId!, { title: satz.title, payload: satz.payload })
        : await pb.collection('patients').create(satz)
      onGesendet(protokollnummer(String(rec.id)), false)
    } catch (e) {
      // Nicht verloren: in die Warteschlange, und die Maske sagt es.
      const ging = inWarteschlange(window.localStorage, orgCode, satz)
      setMeldung(ging
        ? 'Der Server hat es nicht angenommen — das Protokoll liegt in der Warteschlange und geht beim nächsten Öffnen raus.'
        : `Senden fehlgeschlagen: ${e instanceof Error ? e.message : 'unbekannter Fehler'}`)
      if (ging) onGesendet('', true)
    } finally {
      setSendet(false)
    }
  }

  const liste = (eintraege: typeof haelt, farbe: string) => (
    <div style={{ border: `0.5px solid ${LINIE}`, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      {eintraege.map((s, i) => {
        const z = zettelVon(s.feld)
        return (
          <button
            key={s.feld} type="button" onClick={() => z && onSpringen(z.id)}
            style={{
              display: 'flex', alignItems: 'baseline', gap: 8, width: '100%',
              padding: '8px 10px', background: 'var(--lbf-card)', border: 'none',
              borderBottom: i < eintraege.length - 1 ? '0.5px solid rgba(var(--lbf-rot-rgb),0.06)' : 'none',
              fontFamily: 'inherit', textAlign: 'left', cursor: z ? 'pointer' : 'default',
            }}
          >
            <span style={{ color: farbe, fontWeight: 800, flexShrink: 0 }}>*</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: TEXT }}>
                {aelrdFeld(s.feld)?.label ?? s.feld}
              </span>
              <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: GRAU }}>
                {s.grund}
              </span>
            </span>
            {z ? <span style={{ fontSize: 11, fontStyle: 'italic', color: ROT, flexShrink: 0 }}>{z.titel}</span> : null}
          </button>
        )
      })}
    </div>
  )

  return (
    <section
      style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${ROT}`, overflow: 'clip', marginBottom: 10 }}
    >
      <div style={{ padding: '11px 12px', borderBottom: `0.5px solid ${LINIE}` }}>
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: ROT }}>
          Absenden
        </h2>
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        {haelt.length > 0 ? (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--lbf-fehler-text-2)', marginBottom: 5 }}>
              {haelt.length === 1 ? 'Eine Pflichtangabe fehlt' : `${haelt.length} Pflichtangaben fehlen`}
            </div>
            {liste(haelt, 'var(--lbf-fehler-text-2)')}
          </>
        ) : null}
        {fehlt.length > 0 ? (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--lbf-warn-text-2)', marginBottom: 5 }}>
              {fehlt.length === 1 ? 'Eine Angabe wird erwartet' : `${fehlt.length} Angaben werden erwartet`}
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', marginLeft: 5, color: GRAU }}>
                halten nicht auf
              </span>
            </div>
            {liste(fehlt, 'var(--lbf-warn-text-2)')}
          </>
        ) : null}

        {meldung ? (
          <div style={{ padding: '8px 11px', marginBottom: 10, background: 'var(--lbf-warn-grund)', border: '0.5px solid #fde047', borderRadius: 8, fontSize: 12, fontStyle: 'italic', color: 'var(--lbf-warn-text)', lineHeight: 1.45 }}>
            {meldung}
          </div>
        ) : null}

        <button
          type="button" onClick={absenden} disabled={haelt.length > 0 || sendet || !inFrist}
          style={{
            width: '100%', padding: '13px 12px', border: 'none', borderRadius: 12,
            background: haelt.length > 0 || !inFrist ? 'rgba(var(--lbf-rot-rgb),0.15)' : ROT_GRUND, color: '#fff',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            cursor: haelt.length > 0 || sendet || !inFrist ? 'default' : 'pointer',
          }}
        >
          {sendet ? 'Sendet …'
            : haelt.length > 0 ? 'Noch nicht vollständig'
            : !inFrist ? 'Frist abgelaufen'
            : aendert ? 'Änderungen übernehmen' : 'Protokoll absenden'}
        </button>
        <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginTop: 6, lineHeight: 1.45 }}>
          {aendert
            ? inFrist
              ? `Änderungsfrist ${fristText(werte)} — danach ist das Protokoll eingereicht.`
              : 'Die Frist ist abgelaufen; das Protokoll ist eingereicht.'
            : 'Abgesendet steht es in Unitas — bei der Besatzung, die oben eingetragen ist. '
              + 'Danach bleibt einen Tag Zeit, es zu ändern. '
              + 'Ohne Netz wartet es auf dem Gerät und geht beim nächsten Öffnen raus.'}
        </div>
      </div>
    </section>
  )
}
