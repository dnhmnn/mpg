import { useEffect, useMemo, useRef, useState } from 'react'
import {
  alarmeFuerTrupp, berechneTrupp, doktrinHinweise, fmtDauer, hoechster,
  type Alarm, type TruppBerechnung,
} from '../../lib/eks/atemschutz'
import { alarmStarten, alarmStoppen, audioEntsperrt, audioFreischalten, startHeartbeat, testTon, wakeLockAn, wakeLockAus, wakeLockUnterstuetzt } from '../../lib/eks/alarm'
import { newId } from '../../lib/eks/ids'
import type { AtemschutzTrupp, EksEventType, EksState, Flasche } from '../../lib/eks/types'

const RED = '#600812', GREEN = '#16a34a', AMBER = '#d97706', CRIT = '#dc2626'

interface Props {
  state: EksState
  dispatch: (t: EksEventType, p: any) => Promise<void>
}

export default function TabAtemschutz({ state, dispatch }: Props) {
  const [, setTick] = useState(0)
  const [letzterTick, setLetzterTick] = useState(Date.now())
  const [tonAn, setTonAn] = useState(audioEntsperrt())
  const [wakeOk, setWakeOk] = useState(false)
  const [anmelden, setAnmelden] = useState(false)
  const [abfrage, setAbfrage] = useState<AtemschutzTrupp | null>(null)
  const [luecke, setLuecke] = useState<number | null>(null)
  const letzterAlarm = useRef<string>('')

  const trupps = useMemo(() => Object.values(state.trupps).sort((a, b) => a.name.localeCompare(b.name)), [state.trupps])
  const aktive = trupps.filter(t => t.status !== 'abgemeldet')

  // Alle Werte werden aus Zeitstempeln neu berechnet — nie aus laufenden Zählern.
  const now = Date.now()
  const berechnet = useMemo(() => {
    const m = new Map<string, { b: TruppBerechnung; alarme: Alarm[] }>()
    for (const t of trupps) {
      const b = berechneTrupp(t, state.config, now)
      m.set(t.id, { b, alarme: alarmeFuerTrupp(t, b, state.config) })
    }
    return m
  }, [trupps, state.config, now])

  const offeneAlarme = useMemo(() => {
    const out: Alarm[] = []
    for (const t of trupps) {
      const e = berechnet.get(t.id)
      if (!e) continue
      for (const a of e.alarme) if (!t.quittiert[a.key]) out.push(a)
    }
    return out
  }, [trupps, berechnet])

  const top = hoechster(offeneAlarme)

  // Herzschlag: macht einen stehengebliebenen Takt sichtbar statt still
  useEffect(() => {
    return startHeartbeat({
      onTick: () => { setTick(t => t + 1); setLetzterTick(Date.now()) },
      onLuecke: (dauer, grund) => {
        setLuecke(dauer)
        dispatch('as.ueberwachung.luecke', { dauer_ms: dauer, grund })
      },
    })
  }, [dispatch])

  // Bildschirm wachhalten, solange ein Trupp unter PA ist
  useEffect(() => {
    if (aktive.length > 0) { wakeLockAn().then(setWakeOk) } else { wakeLockAus(); setWakeOk(false) }
    const onVis = () => { if (!document.hidden && aktive.length > 0) wakeLockAn().then(setWakeOk) }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [aktive.length])

  // Ton nur bei Änderung der Alarmstufe neu anstoßen
  useEffect(() => {
    const key = offeneAlarme.map(a => a.key).sort().join('|')
    if (key === letzterAlarm.current) return
    letzterAlarm.current = key
    if (!top) { alarmStoppen(); return }
    alarmStarten(top)
  }, [offeneAlarme, top])

  const hinweise = useMemo(() => doktrinHinweise(trupps), [trupps])
  const tickAlter = Math.round((Date.now() - letzterTick) / 1000)

  async function tonAktivieren() {
    const ok = await audioFreischalten()
    setTonAn(ok)
    if (ok) testTon()
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Vollbild-Alarm — die eigentliche Sicherung, unabhängig vom Ton */}
      {top === 'critical' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: CRIT, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.85 }}>Alarm</div>
          {offeneAlarme.filter(a => a.level === 'critical').map(a => {
            const t = state.trupps[a.trupp_id]
            const b = berechnet.get(a.trupp_id)?.b
            return (
              <div key={a.key} style={{ margin: '18px 0' }}>
                <div style={{ fontSize: 30, fontWeight: 800, fontStyle: 'italic' }}>{t?.name}</div>
                {t?.funkrufname && <div style={{ fontSize: 15, opacity: 0.85 }}>{t.funkrufname}</div>}
                <div style={{ fontSize: 19, fontWeight: 700, marginTop: 8 }}>{a.text}</div>
                {b && <div style={{ fontSize: 15, opacity: 0.9, marginTop: 4 }}>{b.pTrupp} bar · Rückzug bei {b.rueckzugsdruckTrupp} bar</div>}
              </div>
            )
          })}
          <button onClick={() => { alarmStoppen(); offeneAlarme.filter(a => a.level === 'critical').forEach(a => dispatch('as.alarm.quittiert', { trupp_id: a.trupp_id, alarm_key: a.key, level: a.level })) }}
            style={{ marginTop: 16, background: '#fff', color: CRIT, border: 'none', borderRadius: 12, padding: '15px 30px', fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
            Zur Kenntnis genommen
          </button>
          <div style={{ fontSize: 11, fontStyle: 'italic', opacity: 0.8, marginTop: 12, maxWidth: 380 }}>
            Quittieren stoppt nur den Ton. Der Alarm bleibt sichtbar, bis die Ursache behoben ist.
          </div>
        </div>
      )}

      {/* Betriebszustand der Überwachung */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Chip ok={tonAn} label={tonAn ? 'Ton bereit' : 'Ton NICHT freigegeben'} onClick={tonAn ? testTon : tonAktivieren} />
        <Chip ok={wakeOk || aktive.length === 0} label={wakeOk ? 'Bildschirm bleibt an' : wakeLockUnterstuetzt() ? 'Bildschirm-Sperre aktiv' : 'Auto-Sperre am Gerät aus!'} />
        <Chip ok={tickAlter < 5} label={`Takt vor ${tickAlter}s`} />
      </div>

      {!tonAn && (
        <Box farbe={CRIT} text={'Der Alarmton ist noch nicht freigegeben. Auf dem Tablet zuerst „Ton bereit“ antippen — sonst warnt die App nur optisch.'} />
      )}
      {luecke !== null && (
        <div style={{ background: '#fef2f2', border: `1px solid ${CRIT}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: CRIT, fontSize: 14 }}>Überwachung war {Math.round(luecke / 1000)} s unterbrochen</div>
          <div style={{ fontSize: 13, color: 'var(--lbf-text)', margin: '4px 0 8px' }}>Bitte alle Trupps prüfen und Drücke neu abfragen.</div>
          <button onClick={() => setLuecke(null)} style={btn(CRIT, true)}>Geprüft</button>
        </div>
      )}

      {hinweise.length > 0 && (
        <div style={{ background: 'rgba(217,119,6,0.08)', borderLeft: `3px solid ${AMBER}`, borderRadius: '0 10px 10px 0', padding: '10px 12px', marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: AMBER, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>Hinweise</div>
          {hinweise.map((h, i) => <div key={i} style={{ fontSize: 12.5, color: 'var(--lbf-text)', lineHeight: 1.5 }}>{h}</div>)}
        </div>
      )}

      <button onClick={() => setAnmelden(true)} style={{ ...btn(RED, true), width: '100%', padding: 13, marginBottom: 14 }}>
        Trupp anmelden
      </button>

      {trupps.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 14 }}>
          Noch kein Atemschutztrupp angemeldet.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {trupps.map(t => {
          const e = berechnet.get(t.id)
          if (!e) return null
          const stufe = hoechster(e.alarme.filter(a => !t.quittiert[a.key]))
          const farbe = stufe === 'critical' ? CRIT : stufe === 'warn' ? AMBER : t.status === 'abgemeldet' ? 'rgba(139,113,90,0.4)' : GREEN
          return (
            <TruppKarte key={t.id} t={t} b={e.b} alarme={e.alarme} farbe={farbe}
              onAbfrage={() => setAbfrage(t)}
              onEreignis={dispatch}
              config={state.config} />
          )
        })}
      </div>

      {/* Dauerhafter Verantwortungs-Hinweis */}
      <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
        Unterstützungswerkzeug nach FwDV 7 · Die Verantwortung für die Atemschutzüberwachung
        bleibt beim Atemschutzüberwacher · Papier-Rückfallebene bereithalten
      </div>

      {anmelden && <AnmeldenModal state={state} onClose={() => setAnmelden(false)} onSave={async (p) => { await dispatch('as.trupp.anmelden', p); setAnmelden(false) }} />}
      {abfrage && <AbfrageModal trupp={abfrage} onClose={() => setAbfrage(null)}
        onSave={async (readings, ziel) => {
          await dispatch(ziel ? 'as.trupp.ziel_erreicht' : 'as.messung', { trupp_id: abfrage.id, readings, quelle: 'funk' })
          setAbfrage(null)
        }} />}
    </div>
  )
}

function btn(farbe: string, voll = false): React.CSSProperties {
  return {
    border: voll ? 'none' : `1px solid ${farbe}44`, background: voll ? farbe : 'transparent',
    color: voll ? '#fff' : farbe, borderRadius: 9, padding: '8px 13px',
    fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
  }
}

function Chip({ ok, label, onClick }: { ok: boolean; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} style={{
      border: `1px solid ${ok ? GREEN : CRIT}`, background: ok ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
      color: ok ? GREEN : CRIT, borderRadius: 999, padding: '4px 11px', fontSize: 11.5, fontWeight: 700,
      cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit',
    }}>{label}</button>
  )
}

function Box({ farbe, text }: { farbe: string; text: string }) {
  return (
    <div style={{ background: `${farbe}12`, borderLeft: `3px solid ${farbe}`, borderRadius: '0 10px 10px 0', padding: '10px 12px', marginBottom: 12, fontSize: 12.5, color: 'var(--lbf-text)', lineHeight: 1.5 }}>{text}</div>
  )
}

function TruppKarte({ t, b, alarme, farbe, onAbfrage, onEreignis, config }: {
  t: AtemschutzTrupp; b: TruppBerechnung; alarme: Alarm[]; farbe: string
  onAbfrage: () => void; onEreignis: (t: EksEventType, p: any) => Promise<void>; config: any
}) {
  const [offen, setOffen] = useState(false)
  const beendet = t.status === 'abgemeldet'
  const statusText: Record<string, string> = {
    angemeldet: 'angemeldet', unter_pa: 'unter PA', am_ziel: 'am Einsatzziel',
    rueckweg: 'auf dem Rückweg', abgemeldet: 'abgemeldet',
  }

  return (
    <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', borderLeft: `3px solid ${farbe}`, overflow: 'hidden', opacity: beendet ? 0.65 : 1 }}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <div style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 17, color: 'var(--lbf-text)' }}>{t.name}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: farbe, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{statusText[t.status]}</div>
        </div>
        <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>
          {t.funkrufname && `${t.funkrufname} · `}{t.mitglieder.map(m => m.name).join(', ')}
          {t.auftrag && ` · ${t.auftrag}`}
        </div>

        {!beendet && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
            <Wert label="Druck (min)" wert={`${b.pTrupp} bar`} gross farbe={farbe} />
            <Wert label="Rückzug bei" wert={`${b.rueckzugsdruckTrupp} bar`} />
            <Wert label="Rest bis Rückzug" wert={b.tBisRueckzugMin === null ? '–' : `${Math.max(0, Math.round(b.tBisRueckzugMin))} min`} />
            <Wert label="Unter PA" wert={fmtDauer(b.tUnterPaSek)} />
            <Wert label="Nächste Abfrage" wert={b.naechsteAbfrageInSek === null ? '–' : fmtDauer(Math.abs(b.naechsteAbfrageInSek))} warn={(b.naechsteAbfrageInSek ?? 1) <= 0} />
            <Wert label={`Verbrauch (${b.herkunft})`} wert={`${b.rateTrupp.toFixed(1)} bar/min`} />
          </div>
        )}

        {alarme.length > 0 && !beendet && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {alarme.map(a => (
              <div key={a.key} style={{ fontSize: 12.5, fontWeight: 700, color: a.level === 'critical' ? CRIT : a.level === 'warn' ? AMBER : 'var(--warm-gray)' }}>
                {a.level === 'critical' ? '● ' : a.level === 'warn' ? '▲ ' : '· '}{a.text}
                {t.quittiert[a.key] && <span style={{ fontWeight: 400, fontStyle: 'italic' }}> (quittiert)</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {!beendet && (
        <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'rgba(250,249,247,0.8)', padding: '8px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {t.status === 'angemeldet' && (
            <button onClick={() => onEreignis('as.trupp.einsatzbeginn', { trupp_id: t.id })} style={btn(RED, true)}>Einsatzbeginn (unter PA)</button>
          )}
          {t.status !== 'angemeldet' && <button onClick={onAbfrage} style={btn(RED, true)}>Druckabfrage</button>}
          {t.status === 'unter_pa' && (
            <button onClick={onAbfrage} style={btn(RED)}>Ziel erreicht</button>
          )}
          {(t.status === 'unter_pa' || t.status === 'am_ziel') && (
            <button onClick={() => { const g = prompt('Grund des Rückzugs?') ?? ''; onEreignis('as.trupp.rueckzug_angeordnet', { trupp_id: t.id, grund: g }) }} style={btn(AMBER)}>Rückzug anordnen</button>
          )}
          <button onClick={() => { if (confirm(`${t.name} abmelden?`)) onEreignis('as.trupp.abgemeldet', { trupp_id: t.id, enddruecke: [] }) }} style={btn('var(--warm-gray)')}>Abmelden</button>
          <button onClick={() => { const txt = prompt('MAYDAY — kurze Lagemeldung:'); if (txt) onEreignis('as.mayday', { trupp_id: t.id, text: txt }) }} style={btn(CRIT)}>MAYDAY</button>
          <button onClick={() => setOffen(o => !o)} style={btn('var(--warm-gray)')}>{offen ? 'Rechenweg zu' : 'Rechenweg'}</button>
        </div>
      )}

      {offen && (
        <div style={{ padding: '10px 14px', borderTop: '0.5px solid rgba(96,8,18,0.08)', fontSize: 12, color: 'var(--lbf-text)', lineHeight: 1.7 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Rechenweg</div>
          <div>Modell: <b>{config.rueckzug_modell}</b> · Reserve {Math.max(config.restdruckwarner_bar, config.hard_floor_bar) + config.sicherheitszuschlag_bar} bar</div>
          {b.personen.map(p => (
            <div key={p.person_id} style={{ marginTop: 6 }}>
              <b>{p.name}</b>: zuletzt {p.pLetzte} bar{p.tLetzte ? ` um ${new Date(p.tLetzte).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''} ·
              geschätzt jetzt {p.pJetzt} bar · {p.rate.toFixed(1)} bar/min ({p.herkunft}) · Rückzug {p.rueckzugsdruck} bar
            </div>
          ))}
          <div style={{ marginTop: 6, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
            Maßgeblich ist immer der ungünstigste Wert im Trupp.
          </div>
        </div>
      )}
    </div>
  )
}

function Wert({ label, wert, gross, warn, farbe }: { label: string; wert: string; gross?: boolean; warn?: boolean; farbe?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontSize: gross ? 22 : 15, fontWeight: gross ? 800 : 700, color: warn ? CRIT : farbe || 'var(--lbf-text)', lineHeight: 1.2 }}>{wert}</div>
    </div>
  )
}

// ── Modale ───────────────────────────────────────────────────────────────────

function AnmeldenModal({ state, onClose, onSave }: { state: EksState; onClose: () => void; onSave: (p: any) => void }) {
  const f: Flasche = state.config.default_flasche
  const [name, setName] = useState('Angriffstrupp')
  const [typ, setTyp] = useState('angriff')
  const [funk, setFunk] = useState('')
  const [auftrag, setAuftrag] = useState('')
  const [abschnitt, setAbschnitt] = useState('')
  const [mitglieder, setMitglieder] = useState([
    { person_id: newId(), name: '', flasche: f, anfangsdruck: f.nenndruck },
    { person_id: newId(), name: '', flasche: f, anfangsdruck: f.nenndruck },
  ])

  return (
    <Overlay onClose={onClose} titel="Atemschutztrupp anmelden">
      <Feld label="Bezeichnung"><input value={name} onChange={e => setName(e.target.value)} className="eks-input" /></Feld>
      <Feld label="Art">
        <select value={typ} onChange={e => setTyp(e.target.value)} className="eks-input">
          <option value="angriff">Angriffstrupp</option><option value="sicherheit">Sicherheitstrupp</option>
          <option value="wasser">Wassertrupp</option><option value="sonstiges">Sonstiges</option>
        </select>
      </Feld>
      <Feld label="Funkrufname"><input value={funk} onChange={e => setFunk(e.target.value)} className="eks-input" /></Feld>
      <Feld label="Auftrag"><input value={auftrag} onChange={e => setAuftrag(e.target.value)} className="eks-input" /></Feld>
      {Object.values(state.abschnitte).filter(a => !a.entfernt).length > 0 && (
        <Feld label="Einsatzabschnitt">
          <select value={abschnitt} onChange={e => setAbschnitt(e.target.value)} className="eks-input">
            <option value="">—</option>
            {Object.values(state.abschnitte).filter(a => !a.entfernt).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Feld>
      )}

      <div style={{ fontSize: 9, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: '0.14em', margin: '14px 0 6px' }}>Truppangehörige</div>
      {mitglieder.map((m, i) => (
        <div key={m.person_id} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <input value={m.name} placeholder={`Name ${i + 1}`} className="eks-input" style={{ flex: 1 }}
            onChange={e => setMitglieder(p => p.map((x, k) => k === i ? { ...x, name: e.target.value } : x))} />
          <input type="number" value={m.anfangsdruck} className="eks-input" style={{ width: 88, textAlign: 'center', fontWeight: 700 }}
            onChange={e => setMitglieder(p => p.map((x, k) => k === i ? { ...x, anfangsdruck: Number(e.target.value) } : x))} />
          <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>bar</span>
          {mitglieder.length > 2 && <button onClick={() => setMitglieder(p => p.filter((_, k) => k !== i))} style={btn(CRIT)}>×</button>}
        </div>
      ))}
      {mitglieder.length < 3 && (
        <button onClick={() => setMitglieder(p => [...p, { person_id: newId(), name: '', flasche: f, anfangsdruck: f.nenndruck }])} style={btn(RED)}>+ Person</button>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
        <button onClick={onClose} style={btn('var(--warm-gray)')}>Abbrechen</button>
        <button style={btn(RED, true)} onClick={() => {
          if (mitglieder.some(m => !m.name.trim())) { alert('Bitte alle Namen eintragen.'); return }
          onSave({ trupp_id: newId(), name, typ, funkrufname: funk, auftrag, abschnitt_id: abschnitt || undefined, mitglieder })
        }}>Anmelden</button>
      </div>
    </Overlay>
  )
}

function AbfrageModal({ trupp, onClose, onSave }: {
  trupp: AtemschutzTrupp; onClose: () => void; onSave: (readings: any[], ziel: boolean) => void
}) {
  const [werte, setWerte] = useState<Record<string, number>>(() => {
    const o: Record<string, number> = {}
    for (const m of trupp.mitglieder) {
      const ms = trupp.messungen[m.person_id] || []
      o[m.person_id] = ms.length ? ms[ms.length - 1].druck : m.anfangsdruck
    }
    return o
  })
  const [ziel, setZiel] = useState(false)

  return (
    <Overlay onClose={onClose} titel={`Druckabfrage · ${trupp.name}`}>
      {trupp.mitglieder.map(m => (
        <div key={m.person_id} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lbf-text)', marginBottom: 5 }}>{m.name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setWerte(w => ({ ...w, [m.person_id]: Math.max(0, w[m.person_id] - 10) }))} style={{ ...btn(RED), padding: '12px 18px', fontSize: 18 }}>−10</button>
            <input type="number" value={werte[m.person_id]} onChange={e => setWerte(w => ({ ...w, [m.person_id]: Number(e.target.value) }))}
              className="eks-input" style={{ flex: 1, textAlign: 'center', fontSize: 24, fontWeight: 800, padding: '12px 8px' }} />
            <button onClick={() => setWerte(w => ({ ...w, [m.person_id]: w[m.person_id] + 10 }))} style={{ ...btn(RED), padding: '12px 18px', fontSize: 18 }}>+10</button>
          </div>
        </div>
      ))}
      {trupp.status === 'unter_pa' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--lbf-text)', cursor: 'pointer', marginTop: 4 }}>
          <input type="checkbox" checked={ziel} onChange={e => setZiel(e.target.checked)} style={{ width: 17, height: 17, accentColor: RED }} />
          Einsatzziel erreicht — dieser Wert bestimmt den Rückzugsdruck
        </label>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
        <button onClick={onClose} style={btn('var(--warm-gray)')}>Abbrechen</button>
        <button style={btn(RED, true)} onClick={() => onSave(trupp.mitglieder.map(m => ({ person_id: m.person_id, druck: werte[m.person_id] })), ziel)}>Übernehmen</button>
      </div>
    </Overlay>
  )
}

export function Overlay({ titel, onClose, children }: { titel: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="eks-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="eks-modal">
        <div style={{ fontSize: 10, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>{titel}</div>
        {children}
      </div>
    </div>
  )
}

export function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}
