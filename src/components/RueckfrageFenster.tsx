// Rückfrage und Stellungnahme — nebeneinander mit dem Protokoll.
//
// Beide Seiten brauchen dasselbe: links das Wort, rechts das Protokoll. Der
// Beauftragte schreibt, was ihm unklar ist, und tippt dazu auf dem Protokoll
// die Felder an, um die es geht. Der Teamführer liest beides — die Frage und
// die markierten Stellen — und nimmt daneben Stellung.
//
// Das Protokoll selbst bleibt dabei unberührt. Was im Einsatz dokumentiert
// wurde, bleibt stehen; erklärt wird es daneben.
//
// Dasselbe Fenster dient dem Nachlesen: im Archiv gibt es nichts mehr zu
// fragen, aber alles zu lesen. Ein zweites Fenster dafür wäre eine zweite
// Darstellung desselben Vorgangs.

import { lazy, Suspense, useMemo, useState } from 'react'
import { pb } from '../lib/pocketbase'
import { rueckfrageDrucken } from '../lib/rueckfrageDruck'
import {
  feldname, istVermerk, offeneRueckfragen, rueckfrageStellen, rueckfragen, stellungNehmen,
  stellungnahmeZu, stellungnahmen, type Rueckfrage,
} from '../pages/public/doku/rueckfrage'

const ProtokollInhalt = lazy(() =>
  import('./ProtokollFenster').then((m) => ({ default: m.ProtokollInhalt })),
)

const ROT = 'var(--lbf-akzent)'
/** Der Akzent als gefüllte Fläche mit heller Schrift darauf. */
const ROT_GRUND = 'var(--lbf-akzent-grund)'
const GRUEN = '#16a34a'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'
const LINIE = 'var(--lbf-border)'

type Nutzlast = Record<string, unknown>
export type Rolle = 'fragen' | 'antworten' | 'lesen'

/** Eine Kennung, die nur in diesem Protokoll gelten muss. */
function kennung(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

const marke: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: ROT, textTransform: 'uppercase', letterSpacing: '0.14em',
}

const knopf: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 10, border: 'none', background: ROT_GRUND, color: '#fff',
  fontFamily: 'inherit', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', cursor: 'pointer',
}

const schreibfeld: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 10,
  border: `0.5px solid ${LINIE}`, background: 'var(--warm-bg)', color: TEXT,
  fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, resize: 'vertical',
}

/** Was im Kopf des Ausdrucks steht — aus dem Protokoll selbst. */
function druckkopf(p: Nutzlast, name: string) {
  const text = (id: string) => {
    const w = p[id]
    return typeof w === 'string' && w.trim() ? w.trim() : ''
  }
  const m = (p.mannschaft ?? {}) as Record<string, { name?: string } | null>
  return {
    name,
    einsatz: [
      text('einsatz_nr') && `Einsatz-Nr. ${text('einsatz_nr')}`,
      text('einsatz_art'),
      text('transport_von'),
    ].filter(Boolean).join(' · '),
    alarmzeit: text('zeit_alarm') || text('zeit_einsatz'),
    mannschaft: ['tf', 'm1', 'm2', 'm3'].map((k) => m[k]?.name).filter(Boolean).join(', '),
  }
}

/** Eine beantwortete Rückfrage, zum Nachlesen. */
function Verlauf({ rq, antwort }: { rq: Rueckfrage; antwort: { text: string; von?: string } | null }) {
  const felder = rq.felder ?? []
  return (
    <div style={{ marginTop: 10, padding: '9px 11px', background: antwort ? 'rgba(22,163,74,0.05)' : 'rgba(var(--lbf-rot-rgb),0.04)', border: `0.5px solid ${antwort ? 'rgba(22,163,74,0.25)' : LINIE}`, borderRadius: 10 }}>
      <div style={{ ...marke, color: GRAU, marginBottom: 4 }}>
        {istVermerk(rq) ? 'Vermerk' : rq.von ? `${rq.von} fragte` : 'Frage'}
      </div>
      <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5 }}>{rq.frage}</div>
      {felder.length > 0 ? (
        <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginTop: 4 }}>
          {felder.map(feldname).join(', ')}
        </div>
      ) : null}
      {antwort ? (
        <>
          <div style={{ ...marke, color: GRUEN, margin: '7px 0 2px' }}>Stellungnahme</div>
          <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5 }}>{antwort.text}</div>
        </>
      ) : istVermerk(rq) ? null : (
        <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginTop: 6 }}>
          Noch keine Stellungnahme eingegangen.
        </div>
      )}
    </div>
  )
}

export default function RueckfrageFenster({ patientId, titel, payload: anfang, rolle, name, onGeschrieben, onSchliessen }: {
  patientId: string
  /** Die Überschrift des Fensters — meist der Name des Patienten. */
  titel?: string
  payload: Nutzlast
  /** Fragen tut der Beauftragte, antworten der Teamführer, lesen beide. */
  rolle: Rolle
  /** Wer gerade handelt — der Name steht an der Frage und an der Antwort. */
  name?: string
  /** Nach dem Schreiben: die aufrufende Seite lädt neu. */
  onGeschrieben?: () => void
  onSchliessen: () => void
}) {
  const [payload, setPayload] = useState<Nutzlast>(anfang)
  const [markiert, setMarkiert] = useState<string[]>([])
  const [frage, setFrage] = useState('')
  const [antwort, setAntwort] = useState('')
  /** Welche Rückfrage der Teamführer gerade beantwortet. */
  const [gewaehlt, setGewaehlt] = useState('')
  const [schreibt, setSchreibt] = useState(false)
  const [fehler, setFehler] = useState('')

  const offen = useMemo(() => offeneRueckfragen(payload), [payload])
  const alle = useMemo(() => rueckfragen(payload), [payload])
  const dran: Rueckfrage | undefined = offen.find((r) => r.id === gewaehlt) ?? offen[0]

  /** Ein Feld antippen — zweimal antippen nimmt es wieder heraus. */
  const umschalten = (feldId: string) =>
    setMarkiert((v) => (v.includes(feldId) ? v.filter((f) => f !== feldId) : [...v, feldId]))

  /**
   * Geschrieben wird gegen den Stand im Server, nicht gegen den im Fenster.
   *
   * Zwischen Öffnen und Absenden kann der andere geantwortet haben; sein
   * Eintrag darf dabei nicht verloren gehen.
   */
  async function schreiben(aendern: (roh: Nutzlast) => Nutzlast): Promise<boolean> {
    setSchreibt(true)
    setFehler('')
    try {
      const rec = await pb.collection('patients').getOne(patientId)
      const roh = typeof rec.payload === 'string' ? JSON.parse(rec.payload) : (rec.payload ?? {})
      const neu = aendern(roh as Nutzlast)
      await pb.collection('patients').update(patientId, { payload: neu })
      setPayload(neu)
      onGeschrieben?.()
      return true
    } catch (e: unknown) {
      setFehler(e instanceof Error ? e.message : 'Das ließ sich nicht speichern.')
      return false
    } finally {
      setSchreibt(false)
    }
  }

  async function fragenSenden() {
    if (!frage.trim()) return
    const felder = [...markiert]
    const text = frage.trim()
    const ging = await schreiben((roh) =>
      rueckfrageStellen(roh, { frage: text, felder, von: name, id: kennung(), jetzt: new Date() }))
    if (ging) { setFrage(''); setMarkiert([]) }
  }

  async function antwortSenden() {
    if (!dran || !antwort.trim()) return
    const text = antwort.trim()
    const rqId = dran.id
    const ging = await schreiben((roh) =>
      stellungNehmen(roh, { rueckfrageId: rqId, text, von: name, id: kennung(), jetzt: new Date() }))
    if (ging) { setAntwort(''); setGewaehlt('') }
  }

  function drucken() {
    const ging = rueckfrageDrucken(
      druckkopf(payload, titel || 'Protokoll'),
      alle, stellungnahmen(payload), { von: name, am: new Date() },
    )
    if (!ging) setFehler('Zum Drucken muss das Fenster erlaubt sein.')
  }

  // Rechts wird hervorgehoben, worum es gerade geht: beim Fragen das
  // Angetippte, sonst die Felder der Frage, die dran ist.
  const hervorgehoben = rolle === 'fragen' ? [] : rolle === 'antworten' ? dran?.felder ?? [] : offen.flatMap((r) => r.felder ?? [])

  const ueberschrift = rolle === 'fragen' ? 'Rückfrage stellen' : rolle === 'antworten' ? 'Stellungnahme' : 'Rückfragen'

  return (
    <div
      role="dialog" aria-label={ueberschrift}
      // Über allem, was die aufrufende Seite stapelt — wie das Protokollfenster.
      style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'var(--warm-bg)', display: 'flex', flexDirection: 'column' }}
    >
      <style>{`
        .rf-raster { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; }
        .rf-wort { background: var(--lbf-card); border-bottom: 0.5px solid ${LINIE}; padding: 12px 14px; }
        @media (min-width: 880px) {
          .rf-raster { flex-direction: row; overflow: hidden; }
          .rf-wort { width: 370px; flex-shrink: 0; border-bottom: none; border-right: 0.5px solid ${LINIE}; overflow-y: auto; }
          .rf-protokoll { flex: 1; min-width: 0; overflow-y: auto; }
        }
      `}</style>

      <header style={{ flexShrink: 0, background: 'var(--lbf-card)', borderBottom: `0.5px solid ${LINIE}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontStyle: 'italic', color: TEXT }}>{titel || 'Protokoll'}</div>
          <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU }}>
            {rolle === 'lesen' ? 'Rückfragen und Stellungnahmen' : `${ueberschrift} · das Protokoll bleibt unverändert`}
          </div>
        </div>
        <button
          type="button" onClick={onSchliessen} aria-label="Schließen"
          style={{ background: 'none', border: 'none', color: GRAU, fontSize: 26, lineHeight: 1, padding: '0 4px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          ×
        </button>
      </header>

      <div className="rf-raster">
        <aside className="rf-wort">
          {rolle === 'fragen' ? (
            <>
              <div style={{ ...marke, marginBottom: 8 }}>Rückfrage an den Teamführer</div>
              <textarea
                value={frage} onChange={(e) => setFrage(e.target.value)} rows={5}
                placeholder="Was ist nicht nachvollziehbar?"
                style={schreibfeld}
              />
              <div style={{ ...marke, margin: '10px 0 4px' }}>Angetippte Felder</div>
              {markiert.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, fontStyle: 'italic', color: GRAU, lineHeight: 1.5 }}>
                  Noch keines. Tippen Sie im Protokoll die Felder an, um die es geht —
                  dann weiß der Teamführer, welche Angabe gemeint ist.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {markiert.map((f) => (
                    <button
                      key={f} type="button" onClick={() => umschalten(f)}
                      aria-label={`${feldname(f)} wieder herausnehmen`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px', background: 'var(--lbf-akzent-weich)', border: `0.5px solid ${LINIE}`, borderRadius: 999, color: ROT, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, fontStyle: 'italic', cursor: 'pointer' }}
                    >
                      {feldname(f)}
                      <span aria-hidden="true" style={{ fontSize: 13, fontStyle: 'normal', lineHeight: 1 }}>×</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button" onClick={fragenSenden}
                disabled={schreibt || !frage.trim()}
                style={{ ...knopf, width: '100%', marginTop: 12, background: frage.trim() && !schreibt ? ROT_GRUND : 'rgba(var(--lbf-rot-rgb),0.2)', cursor: frage.trim() && !schreibt ? 'pointer' : 'default' }}
              >
                {schreibt ? 'Sendet …' : 'Rückfrage senden'}
              </button>
            </>
          ) : rolle === 'antworten' ? (
            <>
              <div style={{ ...marke, marginBottom: 8 }}>
                {offen.length > 0 ? `Offene Rückfragen (${offen.length})` : 'Rückfragen'}
              </div>
              {offen.length > 1 ? (
                // Mehrere Fragen: welche gerade dran ist, entscheidet, was
                // rechts hervorgehoben wird.
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {offen.map((rq, i) => (
                    <button
                      key={rq.id} type="button" onClick={() => { setGewaehlt(rq.id); setAntwort('') }}
                      style={{ padding: '5px 10px', borderRadius: 999, border: `0.5px solid ${LINIE}`, background: dran?.id === rq.id ? ROT_GRUND : 'transparent', color: dran?.id === rq.id ? '#fff' : ROT, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {`Nr. ${i + 1}`}
                    </button>
                  ))}
                </div>
              ) : null}
              {dran ? (
                <>
                  <div style={{ padding: '9px 11px', background: 'rgba(var(--lbf-rot-rgb),0.04)', border: `0.5px solid ${LINIE}`, borderRadius: 10, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
                    <div style={{ ...marke, color: GRAU, marginBottom: 4 }}>
                      {dran.von ? `${dran.von} fragt` : 'Frage'}
                    </div>
                    {dran.frage}
                  </div>
                  {(dran.felder ?? []).length > 0 ? (
                    <div style={{ marginTop: 8, fontSize: 12, fontStyle: 'italic', color: GRAU, lineHeight: 1.5 }}>
                      Markiert im Protokoll: {(dran.felder ?? []).map(feldname).join(', ')}
                    </div>
                  ) : null}
                  <div style={{ ...marke, margin: '12px 0 6px' }}>Ihre Stellungnahme</div>
                  <textarea
                    value={antwort} onChange={(e) => setAntwort(e.target.value)} rows={6}
                    placeholder="Wie kam die Angabe zustande?"
                    style={schreibfeld}
                  />
                  <button
                    type="button" onClick={antwortSenden}
                    disabled={schreibt || !antwort.trim()}
                    style={{ ...knopf, width: '100%', marginTop: 10, background: antwort.trim() && !schreibt ? ROT_GRUND : 'rgba(var(--lbf-rot-rgb),0.2)', cursor: antwort.trim() && !schreibt ? 'pointer' : 'default' }}
                  >
                    {schreibt ? 'Sendet …' : 'Stellungnahme absenden'}
                  </button>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 12, fontStyle: 'italic', color: GRAU, lineHeight: 1.5 }}>
                  Keine Rückfrage offen.
                </p>
              )}
            </>
          ) : (
            <div style={{ ...marke, marginBottom: 2 }}>
              {alle.length > 0 ? `Vorgang (${alle.length})` : 'Vorgang'}
            </div>
          )}

          {/* Was gefragt und geantwortet wurde, bleibt lesbar — es gehört zum
              Protokoll. Beim Antworten steht die Frage, die dran ist, schon
              oben; hier folgt der übrige Verlauf. */}
          {alle
            .filter((rq) => (rolle === 'antworten' ? rq.id !== dran?.id : true))
            .map((rq) => {
              const sn = stellungnahmeZu(payload, rq.id)
              return <Verlauf key={rq.id} rq={rq} antwort={sn} />
            })}

          {rolle !== 'fragen' && alle.length === 0 ? (
            <p style={{ margin: '8px 0 0', fontSize: 12, fontStyle: 'italic', color: GRAU }}>
              Keine Rückfragen vorhanden.
            </p>
          ) : null}

          {alle.length > 0 ? (
            <button
              type="button" onClick={drucken}
              style={{ marginTop: 12, padding: '7px 12px', background: 'transparent', border: `0.5px solid ${LINIE}`, borderRadius: 8, color: ROT, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}
            >
              Drucken / PDF
            </button>
          ) : null}

          {fehler ? (
            <p style={{ marginTop: 10, padding: '8px 11px', background: 'var(--lbf-fehler-grund)', border: '0.5px solid #fca5a5', borderRadius: 10, fontSize: 12, fontStyle: 'italic', color: 'var(--lbf-fehler-text)' }}>
              {fehler}
            </p>
          ) : null}
        </aside>

        <div className="rf-protokoll">
          <Suspense fallback={null}>
            <ProtokollInhalt
              patientId={patientId}
              payload={payload}
              markieren={rolle === 'fragen'}
              markiert={markiert}
              onMarkieren={umschalten}
              hervorgehoben={hervorgehoben}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
