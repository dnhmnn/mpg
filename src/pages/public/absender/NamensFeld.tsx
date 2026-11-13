// Ein Namensfeld mit Prüfzeile (Bauplan v2, 4.3).
//
// Ein Textfeld, KEINE Liste, keine Vorschläge: wer hier tippt, erfährt nur, ob
// der Name genau auf ein aktives Mitglied passt (ja, mehrfach, nein). Kennung,
// Schreibweise oder E-Mail gibt der Server nie heraus. Verknüpft wird allein
// am Server beim Absenden.
//
// Gefragt wird 600 ms nach dem letzten Tippen und nur, wenn der Text nach Vor-
// und Nachnamen aussieht. Ergebnisse merkt sich die Seite je Text, solange sie
// offen ist; `onErgebnis` meldet sie nach oben (null: nicht bekannt).

import { useEffect, useMemo, useRef, useState } from 'react'
import { nameGefunden, type NamensErgebnis } from '../../../lib/formular/api'
import type { AbsenderModus, FormularArt } from '../../../lib/formular/absender'
import { lageAusErgebnis, lageAusFehler, namePruefbar, pruefzeile, PRUEF_PAUSE_MS, type NamensLage, type NamensZweck } from './texte'

const ROT = 'var(--lbf-akzent)'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(var(--lbf-rot-rgb),0.14)'

/** Ergebnisse je Organisation, Formular (eigene: je Vorlage) und Text, solange die Seite offen ist. */
const gemerkt = new Map<string, NamensErgebnis>()
const merkSchluessel = (orgCode: string, formular: FormularArt, vorlage: string, text: string) => `${orgCode}\u0000${formular}\u0000${vorlage}\u0000${text}`

const UNVOLLSTAENDIG: NamensErgebnis = { vollstaendig: false, gefunden: false, eindeutig: false }

export default function NamensFeld(p: {
  orgCode: string
  formular: FormularArt
  /** Nur eigene Formulare (`formular="eigen"`): Kennung der Vorlage, die der Server prüft. */
  vorlage?: string
  wert: string
  onWert: (n: string) => void
  zweck: NamensZweck
  modus: AbsenderModus
  /** Token mitschicken (angemeldet, nicht „Anderer Absender“). */
  mitAnmeldung: boolean
  label: string
  platzhalter?: string
  /** Nur zeigen, nicht tippen (Doku: Name kommt aus dem Feld Unterschrift). */
  nurLesen?: boolean
  /** Der Posten trägt schon eine Kennung (geladener Satz): „verknüpft“, bis der Name geändert wird. */
  verknuepft?: boolean
  /** Ergebnis der Prüfung für den Text `text` (null: offen, ohne Netz, Fehler). */
  onErgebnis?: (r: NamensErgebnis | null, text: string) => void
  /** Zeigt ein „×“ zum Räumen, solange etwas eingetragen ist. */
  onLeeren?: () => void
  /** Kein Abstand unter dem Feld. */
  dicht?: boolean
  /** Nur die Prüfzeile zeigen (der Name steht schon daneben). */
  nurZeile?: boolean
}) {
  const { orgCode, formular, wert, mitAnmeldung, verknuepft, nurLesen } = p
  const vorlage = p.vorlage ?? ''
  const [lage, setLage] = useState<NamensLage>('leer')
  const nr = useRef(0)
  const onErgebnis = useRef(p.onErgebnis)
  onErgebnis.current = p.onErgebnis
  const eingabeName = useMemo(() => `name-${Math.random().toString(36).slice(2, 8)}`, [])

  useEffect(() => {
    const meine = ++nr.current
    const text = wert.trim()
    const melden = (r: NamensErgebnis | null) => { if (meine === nr.current) onErgebnis.current?.(r, wert) }
    if (!text) { setLage('leer'); melden(null); return }
    // Ein geladener, verknüpfter Posten wird nicht neu geprüft: der Server
    // behält die Verknüpfung, solange der Name gleich bleibt.
    if (verknuepft) { setLage('stumm'); return }
    const schon = gemerkt.get(merkSchluessel(orgCode, formular, vorlage, text))
    if (schon) { setLage(lageAusErgebnis(schon)); melden(schon); return }
    setLage('pruefe')
    const uhr = setTimeout(() => {
      if (meine !== nr.current) return
      if (!namePruefbar(text)) { setLage('unvollstaendig'); melden(UNVOLLSTAENDIG); return }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) { setLage('ohne_netz'); melden(null); return }
      void nameGefunden(orgCode, formular, text, { mitAnmeldung, vorlage }).then((r) => {
        if (meine !== nr.current) return
        if (r.ok === false) { setLage(lageAusFehler(r.grund)); melden(null); return }
        gemerkt.set(merkSchluessel(orgCode, formular, vorlage, text), r.wert)
        setLage(lageAusErgebnis(r.wert))
        melden(r.wert)
      })
    }, PRUEF_PAUSE_MS)
    return () => clearTimeout(uhr)
  }, [wert, orgCode, formular, vorlage, mitAnmeldung, verknuepft])

  useEffect(() => () => { nr.current++ }, [])

  const zeile = verknuepft && wert.trim()
    ? { text: 'verknüpft', erkannt: true }
    : pruefzeile(lage, p.zweck, p.modus)

  return (
    <div style={{ marginBottom: p.dicht ? 0 : 8 }}>
      {p.label ? (
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
          {p.label}
        </div>
      ) : null}
      {p.nurZeile ? null : nurLesen ? (
        <div style={{ fontSize: 15, fontStyle: 'italic', fontWeight: 700, color: TEXT, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
          {wert.trim() || p.platzhalter || ''}
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <input
            type="text" value={wert} name={eingabeName}
            onChange={(e) => p.onWert(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
            placeholder={p.platzhalter ?? 'Vor- und Nachname'}
            autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false}
            style={{
              width: '100%', padding: p.onLeeren && wert ? '9px 34px 9px 10px' : '9px 10px',
              background: 'var(--lbf-input-bg)', border: `0.5px solid ${LINIE}`, borderRadius: 8,
              fontFamily: 'inherit', fontSize: 16, color: TEXT, boxSizing: 'border-box',
            }}
          />
          {p.onLeeren && wert ? (
            <button
              type="button" onClick={p.onLeeren} aria-label={p.label ? `${p.label} räumen` : 'Name räumen'}
              style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: GRAU, fontSize: 20, lineHeight: 1, padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ×
            </button>
          ) : null}
        </div>
      )}
      {zeile.text ? (
        <div aria-live="polite" style={{ fontSize: 11, fontStyle: 'italic', color: zeile.erkannt ? ROT : GRAU, marginTop: 4, lineHeight: 1.4 }}>
          {zeile.text}
        </div>
      ) : null}
    </div>
  )
}
