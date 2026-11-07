// Der Abschluss: prüfen, Absender bestätigen, absenden.
//
// Was fehlt, steht hier, mit dem Grund, den die Regel nennt, und einem
// Griff, der zu dem Zettel springt, auf dem es steht. Ein Knopf, der nur
// "unvollständig" sagt, schickt einen suchen.
//
// Abgesendet wird über die Route des Servers (Bauplan v2, 4.2, 4.4): er prüft
// den Absender (Passwort, Anmeldung oder Name frei) und setzt Frist und
// Besatzung selbst. Ohne Netz, bei zu vielen Anfragen oder einer Störung
// liegt das Protokoll in der Warteschlange des Geräts, ohne Passwort.
// Ein schon abgesendetes Protokoll wird weiter direkt geändert; der Server
// schützt dabei Absender, Frist, Druckname und Besatzung. Ohne Netz geht das
// nicht: die Eingaben bleiben dann in der Maske.

import { useState } from 'react'
import { aelrdFeld } from '../../../katalog/aelrd'
import { mitFassung, NEUE_FASSUNG } from '../../../lib/protokoll'
import type { AbsenderEintrag } from '../../../lib/formular/absender'
import { aktuelleTokenId, direktAendern, neueKennung, type Stand } from '../../../lib/formular/api'
import { ablegenMitMeldung, sendenOderAblegen } from '../../../lib/formular/versand'
import type { NeuerEintrag } from '../../../lib/formular/warteschlange'
import type { Werte } from './DokuFeld'
import { aenderbar, fristRestText, protokollnummer, pruefen, titel } from './absenden'

export { aenderbar } from './absenden'
import { zettelVon } from './zettel'
import AbsenderFeld, { Textknopf, absenderAngabe, sendeKnopfText, vorDemSenden } from '../absender/AbsenderFeld'
import { warteschlangeMelden } from '../absender/Warteschlange'
import { ABSENDER_TEXTE as T, modusAusStand } from '../absender/texte'

const ROT = 'var(--lbf-akzent)'
/** Der Akzent als gefüllte Fläche mit heller Schrift darauf. */
const ROT_GRUND = 'var(--lbf-akzent-grund)'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(var(--lbf-rot-rgb),0.14)'

/** Was nach dem Absenden auf dem Schirm steht. */
export type Gesendet = {
  /** Protokollnummer, leer, wenn es auf dem Gerät liegt. */
  nummer: string
  offline: boolean
  /** Meldung der Ablage („Ohne Netz gespeichert …“). */
  meldung?: string
  /** Der gespeicherte Absender (Route), null beim alten Weg. */
  absender?: AbsenderEintrag | null
  /** Ein abgesendetes Protokoll wurde geändert. */
  geaendert?: boolean
  /** Auf dem alten Weg gesendet (Server ohne Formular-Hooks): die Besatzung ist dann nicht verknüpft. */
  alterWeg?: boolean
}

export default function Absenden({
  werte, orgId, orgCode, protokollId, angelegt = '', stand, alterServer, anderer, onAnderer,
  kennung, onKennung, onGesendet, onSpringen,
}: {
  werte: Werte
  orgId: string
  orgCode: string
  /** Gesetzt, wenn ein schon abgesendetes Protokoll geändert wird. */
  protokollId?: string
  /** `created` des geladenen Protokolls (Frist älterer Sätze). */
  angelegt?: string
  stand: Stand | null
  alterServer: boolean
  /** „Anderer Absender“: ohne Token senden, obwohl jemand angemeldet ist. */
  anderer: boolean
  onAnderer: (v: boolean) => void
  /** Kennung des neuen Satzes; entsteht beim ersten Versuch und bleibt in der Maske. */
  kennung: string
  onKennung: (id: string) => void
  onGesendet: (g: Gesendet) => void
  onSpringen: (zettelId: string) => void
}) {
  const [sendet, setSendet] = useState(false)
  const [meldung, setMeldung] = useState('')
  const [passwort, setPasswort] = useState('')
  /** Nach „gesperrt“: dieser Eintrag lässt sich auf dem Gerät ablegen, bis zum Ende der Sperre. */
  const [ablage, setAblage] = useState<{ e: NeuerEintrag; mitAnmeldung: boolean; sekunden?: number; text: string } | null>(null)
  const { haelt, fehlt } = pruefen(werte)

  const aendert = Boolean(protokollId)
  const zustand = aendert ? aenderbar(werte, angelegt) : 'ja'
  const inFrist = zustand === 'ja'
  const modus = modusAusStand(stand, 'patienten')
  const unterschrift = String(werte.unterschrift ?? '')

  async function aendern() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setMeldung(T.aendernOhneNetz); return }
    setSendet(true)
    setMeldung('')
    try {
      // Mit Token, wenn dieses Gerät eine gültige Sitzung hat (Unitas über „Bearbeiten“)
      const r = await direktAendern('patients', protokollId!, { title: titel(werte), payload: werte }, { mitAnmeldung: aktuelleTokenId() !== '' })
      if (r.ok === false) {
        setMeldung(r.grund === 'netz' ? T.aendernOhneNetz : (r.text || T.aendernFehler))
        return
      }
      onGesendet({ nummer: protokollnummer(protokollId!), offline: false, geaendert: true })
    } finally {
      setSendet(false)
    }
  }

  async function absenden() {
    if (haelt.length > 0 || !inFrist || sendet) return
    setAblage(null)
    if (aendert) { await aendern(); return }

    const online = typeof navigator === 'undefined' || navigator.onLine !== false
    const vorher = vorDemSenden({ stand, alterServer, formular: 'patienten', anderer, name: unterschrift, passwort, online })
    if (vorher) { setMeldung(vorher); return }

    setSendet(true)
    setMeldung('')
    const id = kennung || neueKennung()
    if (!kennung) onKennung(id)
    const angabe = absenderAngabe({ stand, formular: 'patienten', anderer, name: unterschrift, passwort })
    // Das Passwort lebt nur in diesem Aufruf; das Feld ist danach leer
    setPasswort('')
    const e: NeuerEintrag = {
      id, formular: 'patienten', maske: 'doku', orgCode, orgId,
      absenderName: angabe.mitAnmeldung ? (stand?.angemeldet?.name ?? '') : unterschrift.trim(),
      angemeldetId: '',
      daten: { title: titel(werte), payload: mitFassung(werte, NEUE_FASSUNG) },
    }
    try {
      const r = await sendenOderAblegen(e, angabe, { modus })
      if (r.art === 'gesendet') {
        onGesendet({ nummer: protokollnummer(r.id), offline: false, absender: r.absender, alterWeg: r.alterWeg })
      } else if (r.art === 'abgelegt') {
        warteschlangeMelden()
        onGesendet({ nummer: '', offline: true, meldung: r.meldung })
      } else if (r.art === 'nicht_abgelegt') {
        setMeldung(r.meldung)
      } else {
        setMeldung(r.meldung)
        if (r.ablegenAnbieten) setAblage({ e, mitAnmeldung: angabe.mitAnmeldung, sekunden: r.sekunden, text: r.meldung })
      }
    } finally {
      setSendet(false)
    }
  }

  function aufGeraetAblegen() {
    if (!ablage) return
    const r = ablegenMitMeldung(ablage.e, { modus, mitAnmeldung: ablage.mitAnmeldung, anlass: 'gesperrt', sekunden: ablage.sekunden, text: ablage.text })
    setAblage(null)
    if (!r.gespeichert) { setMeldung(r.meldung); return }
    warteschlangeMelden()
    onGesendet({ nummer: '', offline: true, meldung: r.meldung })
  }

  /**
   * Modus Passwort, kein Passwort zur Hand: ohne Passwort auf dem Gerät ablegen (Befund
   * Client-Abläufe 5). Die Karte der Warteschlange fragt weiter nach dem Passwort und
   * bietet bei eindeutigem Namen „Ohne Passwort senden“ (PO-Entscheidung 1).
   */
  function ohnePasswortAblegen() {
    if (haelt.length > 0 || !inFrist || sendet || aendert) return
    if (!unterschrift.trim()) { setMeldung('Bitte einen Namen eintragen.'); return }
    setAblage(null)
    setPasswort('')
    const id = kennung || neueKennung()
    if (!kennung) onKennung(id)
    const e: NeuerEintrag = {
      id, formular: 'patienten', maske: 'doku', orgCode, orgId,
      absenderName: unterschrift.trim(), angemeldetId: '',
      daten: { title: titel(werte), payload: mitFassung(werte, NEUE_FASSUNG) },
    }
    const r = ablegenMitMeldung(e, { modus, mitAnmeldung: false, anlass: 'ohne_passwort' })
    if (!r.gespeichert) { setMeldung(r.meldung); return }
    warteschlangeMelden()
    onGesendet({ nummer: '', offline: true, meldung: r.meldung })
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

  const gesperrt = haelt.length > 0 || !inFrist
  const knopf = sendet ? 'Sendet …'
    : haelt.length > 0 ? 'Noch nicht vollständig'
    : zustand === 'ausstehend' ? 'Wartet auf Unterschrift'
    : !inFrist ? 'Frist abgelaufen'
    : aendert ? 'Änderungen übernehmen'
    : sendeKnopfText({ stand, anderer }, 'Protokoll absenden')

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

        {/* Wer abgibt: nur beim neuen Protokoll. Beim Ändern bleibt der Absender, wie er ist. */}
        {!aendert ? (
          <AbsenderFeld
            orgCode={orgCode} formular="patienten" stand={stand} alterServer={alterServer}
            name={unterschrift} passwort={passwort} onPasswort={setPasswort}
            anderer={anderer} onAnderer={onAnderer} nameHerkunft="Unterschrift"
            onSenden={() => { void absenden() }}
            onAblegen={gesperrt ? undefined : ohnePasswortAblegen}
            onZumNamen={() => { const z = zettelVon('unterschrift'); if (z) onSpringen(z.id) }}
          />
        ) : null}

        {zustand === 'ausstehend' ? (
          <Warnung>{T.aendernAusstehend}</Warnung>
        ) : null}

        {meldung ? <Warnung>{meldung}</Warnung> : null}
        {ablage ? (
          <div style={{ marginBottom: 10 }}>
            <Textknopf onClick={aufGeraetAblegen}>{T.ablegen}</Textknopf>
          </div>
        ) : null}

        <button
          type="button" onClick={() => { void absenden() }} disabled={gesperrt || sendet}
          style={{
            width: '100%', padding: '13px 12px', border: 'none', borderRadius: 12,
            background: gesperrt ? 'rgba(var(--lbf-rot-rgb),0.15)' : ROT_GRUND, color: '#fff',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            cursor: gesperrt || sendet ? 'default' : 'pointer',
          }}
        >
          {knopf}
        </button>
        <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginTop: 6, lineHeight: 1.45 }}>
          {aendert
            ? inFrist
              ? `Änderungsfrist ${fristRestText(werte, angelegt)}. Danach ist das Protokoll eingereicht.`
              : zustand === 'ausstehend' ? '' : 'Die Frist ist abgelaufen. Das Protokoll ist eingereicht.'
            : T.dokuHinweis}
        </div>
      </div>
    </section>
  )
}

function Warnung({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '8px 11px', marginBottom: 10, background: 'var(--lbf-warn-grund)', border: '0.5px solid #fde047', borderRadius: 8, fontSize: 12, fontStyle: 'italic', color: 'var(--lbf-warn-text)', lineHeight: 1.45 }}>
      {children}
    </div>
  )
}
