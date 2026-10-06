// Das Protokoll ansehen — in der Gliederung der Maske.
//
// Bisher zeigten Unitas und die Patientenverwaltung den Bogen nach seinen
// Abschnitten, die Maske aber nach Zetteln und Schritten. Wer beides benutzt,
// sucht dasselbe Feld zweimal an verschiedenen Stellen. Hier steht es so, wie
// es eingegeben wurde: dieselben elf Zettel, dieselbe Reihenfolge, dieselben
// Schritte des xABCDE.
//
// UND NICHTS FÄLLT UNTER DEN TISCH. Was das Protokoll führt und diese Ansicht
// nicht kennt, steht am Ende unter "Weitere Angaben" — lieber roh angezeigt
// als stillschweigend verschwiegen. Ein Prüffall hält fest, dass jedes Feld
// des Bogens vorkommt.

import { aelrdFeld, type AelrdFeld } from '../katalog/aelrd'
import { normOptionen } from '../katalog/aelrdOptionen'
import { massnahmeKategorie, artText, rechtsgrund } from '../katalog/massnahmenArten'
import { VERLAUFSWERTE } from '../katalog/verlaufswerte'
import { POSTEN } from '../pages/public/doku/besatzung'
import { zettelMitFeldern } from '../pages/public/doku/zettel'

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.12)'

type Payload = Record<string, unknown>

/**
 * Schlüssel, die diese Ansicht an eigener Stelle zeigt oder bewusst übergeht.
 *
 * Alles andere landet unter "Weitere Angaben". Die Liste hier ist der Grund,
 * warum das funktioniert — und warum sie gepflegt gehört.
 */
const EIGENS = new Set([
  'mannschaft', 'massnahmen', 'verlauf', 'signature',
  'frist', 'abgesendet', 'rueckfragen', 'stellungnahmen',
  'access_code', 'access_code_created', 'tf_reopen',
  '_changed_fields', '_tf_changed_fields', 'photos',
])

/** Teile einer Adresse, die aus der Zeile des Bogens entstehen. */
const ADRESSTEIL = /_(strasse|plz|ort)$/

function istGefuellt(w: unknown): boolean {
  if (w === undefined || w === null || w === '' || w === false) return false
  if (Array.isArray(w)) return w.length > 0
  if (typeof w === 'object') return Object.keys(w as object).length > 0
  return true
}

function Marke({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 3 }}>
      {text}
    </div>
  )
}

/** Ein Feld mit seinem Wert — Auswahlen als Knöpfe, wie in der Maske. */
function Feld({ feld, payload, markiert, onMarkieren }: {
  feld: AelrdFeld; payload: Payload
  markiert?: Set<string>; onMarkieren?: (feldId: string) => void
}) {
  const wert = payload[feld.id]
  const optionen = feld.optionen ?? normOptionen(feld.id) ?? undefined
  const gewaehlt = (o: string) =>
    Array.isArray(wert) ? wert.map(String).includes(o) : String(wert ?? '') === o
  const an = markiert?.has(feld.id) ?? false

  const inhalt = optionen && optionen.length > 0 ? (
    <div>
      {optionen.map((o) => (
        <span
          key={o.wert}
          style={{
            display: 'inline-block', padding: '4px 9px', margin: '0 4px 4px 0', borderRadius: 999,
            fontSize: 12, lineHeight: 1.3,
            background: gewaehlt(o.wert) ? ROT : 'transparent',
            color: gewaehlt(o.wert) ? '#fff' : GRAU,
            border: `0.5px solid ${gewaehlt(o.wert) ? ROT : LINIE}`,
            fontWeight: gewaehlt(o.wert) ? 700 : 400,
          }}
        >
          {o.text}
        </span>
      ))}
    </div>
  ) : (
    <div style={{
      fontSize: 15, color: istGefuellt(wert) ? TEXT : GRAU,
      fontStyle: istGefuellt(wert) ? 'normal' : 'italic',
      whiteSpace: 'pre-wrap', lineHeight: 1.45,
    }}>
      {istGefuellt(wert) ? String(wert) : '—'}
      {feld.einheit && istGefuellt(wert) ? <span style={{ fontSize: 11, color: GRAU }}> {feld.einheit}</span> : null}
    </div>
  )

  const rahmen: React.CSSProperties = {
    marginBottom: 10, padding: onMarkieren ? '6px 8px' : 0,
    borderRadius: 8,
    background: an ? '#fffbeb' : 'transparent',
    border: an ? '0.5px solid #fde047' : onMarkieren ? '0.5px solid transparent' : 'none',
    cursor: onMarkieren ? 'pointer' : 'default',
  }

  const kern = (
    <>
      <Marke text={feld.label} />
      {inhalt}
    </>
  )

  // Beim Markieren ist jedes Feld anklickbar — dann ist es ein Knopf, kein
  // Textblock, damit es auch mit der Tastatur erreichbar bleibt.
  return onMarkieren ? (
    <button
      type="button" onClick={() => onMarkieren(feld.id)} aria-pressed={an}
      style={{ ...rahmen, display: 'block', width: '100%', textAlign: 'left', fontFamily: 'inherit' }}
    >
      {kern}
    </button>
  ) : (
    <div style={rahmen}>{kern}</div>
  )
}

function Zeile({ titel, text }: { titel: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '5px 0', borderBottom: `0.5px solid ${LINIE}` }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: ROT, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{titel}</span>
      <span style={{ flex: 1, fontSize: 13, fontStyle: 'italic', color: TEXT, lineHeight: 1.45 }}>{text}</span>
    </div>
  )
}

export default function DokuProtokollView({ payload, markiert, onMarkieren }: {
  payload: Payload
  /** Felder, die jemand als unklar markiert hat. */
  markiert?: Set<string>
  /** Gesetzt, wenn markiert werden darf — dann ist jedes Feld anklickbar. */
  onMarkieren?: (feldId: string) => void
}) {
  const zettel = zettelMitFeldern()

  const besatzung = (payload.mannschaft ?? {}) as Record<string, { name?: string } | null>
  const massnahmen = Array.isArray(payload.massnahmen) ? (payload.massnahmen as Payload[]) : []
  const verlauf = Array.isArray(payload.verlauf) ? (payload.verlauf as Payload[]) : []

  const gezeigt = new Set<string>(zettel.flatMap((z) => z.felder.map((f) => f.id)))
  const rest = Object.entries(payload).filter(([k, v]) =>
    istGefuellt(v) && !gezeigt.has(k) && !EIGENS.has(k) && !ADRESSTEIL.test(k))

  return (
    <div style={{ maxWidth: 830, margin: '0 auto' }}>
      {zettel.map((z) => (
        <section
          key={z.id}
          style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${ROT}`, overflow: 'clip', marginBottom: 10 }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '11px 12px', borderBottom: `0.5px solid ${LINIE}` }}>
            <h3 style={{ flex: 1, margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: ROT }}>
              {z.titel}
            </h3>
            <span style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>{z.kurz}</span>
          </div>
          <div style={{ padding: '10px 12px 12px' }}>
            {z.teile.map((teil) => (
              <div key={teil.id}>
                {z.teile.length > 1 ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '10px 0 7px', paddingBottom: 4, borderBottom: `0.5px solid ${LINIE}` }}>
                    {teil.kennung ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 20, height: 20, borderRadius: 10, flexShrink: 0,
                        background: ROT, color: '#fff', fontSize: 11, fontWeight: 800,
                      }}>
                        {teil.kennung}
                      </span>
                    ) : null}
                    <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: ROT }}>
                      {teil.titel}
                    </span>
                  </div>
                ) : null}
                {teil.felder.map((f) => (
                  <Feld key={f.id} feld={f} payload={payload} markiert={markiert} onMarkieren={onMarkieren} />
                ))}
              </div>
            ))}

            {/* Die Besatzung steht im Protokoll zweimal: als Name auf dem
                Bogen und mit Kennung für die Einsicht. Gezeigt wird beides. */}
            {z.id === 'einsatz' ? (
              <div style={{ marginTop: 6 }}>
                <Marke text="Besatzung mit Kennung" />
                {POSTEN.map((p) => {
                  const e = besatzung[p.pos]
                  return (
                    <Zeile key={p.pos} titel={p.label} text={e?.name ? `${e.name} · sieht das Protokoll in Unitas` : '—'} />
                  )
                })}
              </div>
            ) : null}

            {z.id === 'massnahmen' && massnahmen.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <Marke text={`${massnahmen.length} Maßnahmen im Verlauf`} />
                {massnahmen.map((m, i) => {
                  const kat = massnahmeKategorie(String(m.kategorie))
                  const art = kat?.frei ? String(m.art) : artText(String(m.kategorie), String(m.art))
                  const grund = m.grund ? rechtsgrund(String(m.grund))?.text : ''
                  const durch = m.durch ? besatzung[String(m.durch)]?.name : ''
                  return (
                    <Zeile
                      key={String(m.id ?? i)} titel={String(m.zeit ?? '--:--')}
                      text={[art, kat?.titel, grund, durch && `durch ${durch}`].filter(Boolean).join(' · ')}
                    />
                  )
                })}
              </div>
            ) : null}

            {z.id === 'verlauf' ? (
              <div>
                <Marke text={verlauf.length > 0 ? `${verlauf.length} Messungen` : 'Keine Messungen im Verlauf'} />
                {verlauf.map((s, i) => {
                  const w = (s.werte ?? {}) as Record<string, unknown>
                  const text = VERLAUFSWERTE
                    .filter((v) => istGefuellt(w[v.id]))
                    .map((v) => `${v.label} ${String(w[v.id])}`)
                    .join(' · ')
                  return <Zeile key={String(s.id ?? i)} titel={String(s.zeit ?? '--:--')} text={text || '—'} />
                })}
              </div>
            ) : null}

            {z.id === 'abschluss' && typeof payload.signature === 'string' && payload.signature.startsWith('data:image/') ? (
              <div style={{ marginTop: 6 }}>
                <Marke text="Unterschrift" />
                <img
                  src={payload.signature} alt="Unterschrift"
                  style={{ maxWidth: '100%', height: 90, objectFit: 'contain', background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 8 }}
                />
              </div>
            ) : null}
          </div>
        </section>
      ))}

      {/* Was diese Ansicht nicht kennt — roh, aber sichtbar. */}
      {rest.length > 0 ? (
        <section style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid rgba(139,113,90,0.5)', overflow: 'clip', marginBottom: 10 }}>
          <div style={{ padding: '11px 12px', borderBottom: `0.5px solid ${LINIE}` }}>
            <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: GRAU }}>
              Weitere Angaben
            </h3>
          </div>
          <div style={{ padding: '10px 12px 12px' }}>
            {rest.map(([k, v]) => (
              <Zeile key={k} titel={k} text={typeof v === 'object' ? JSON.stringify(v) : String(v)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
