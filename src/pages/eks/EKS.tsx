import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useEks } from '../../hooks/useEks'
import { pb } from '../../lib/pocketbase'
import { newId } from '../../lib/eks/ids'
import { speicherInfo } from '../../lib/eks/db'
import { alarmeFuerTrupp, berechneTrupp, hoechster } from '../../lib/eks/atemschutz'
import TabAtemschutz, { Feld, Overlay } from './TabAtemschutz'
import TabETB from './TabETB'
import TabKraefte from './TabKraefte'
import type { EksEventType, EksState } from '../../lib/eks/types'

const RED = '#600812', CRIT = '#dc2626'
type Tab = 'lage' | 'atemschutz' | 'etb' | 'kraefte' | 'abschnitte'

const CSS = `
.eks-input{padding:9px 12px;border:1px solid var(--lbf-input-border);border-radius:8px;background:var(--lbf-input-bg);color:var(--lbf-text);font-size:14px;font-family:inherit;width:100%;box-sizing:border-box;outline:none}
.eks-input:focus{border-color:#600812;box-shadow:0 0 0 3px rgba(96,8,18,0.08)}
.eks-modal-overlay{position:fixed;inset:0;background:rgba(26,14,8,0.55);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
.eks-modal{background:var(--lbf-card);border-radius:16px;max-width:560px;width:100%;max-height:88dvh;overflow-y:auto;padding:22px;box-shadow:0 12px 32px rgba(0,0,0,0.18)}
@media(max-width:768px){.eks-modal-overlay{align-items:flex-end;padding:0}.eks-modal{border-radius:16px 16px 0 0;max-height:88dvh;padding:20px 16px calc(20px + env(safe-area-inset-bottom))}}
`

export default function EKS() {
  const { einsatzId } = useParams<{ einsatzId: string }>()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const eks = useEks(einsatzId, user)
  const [tab, setTab] = useState<Tab>('lage')
  const [einstellungen, setEinstellungen] = useState(false)

  // Einsatzkopf laden (online) und lokal spiegeln, damit er offline verfügbar bleibt
  useEffect(() => {
    if (!einsatzId || !user || !navigator.onLine) return
    pb.collection('einsaetze').getOne(einsatzId, { requestKey: `eks-head-${Date.now()}` })
      .then(r => eks.einsatzCachen(r))
      .catch(() => { /* offline oder gelöscht — lokaler Stand bleibt */ })
  }, [einsatzId, user])

  const st = eks.state
  const alarmStufe = useMemo(() => {
    const now = Date.now()
    const alle = Object.values(st.trupps).flatMap(t => {
      const b = berechneTrupp(t, st.config, now)
      return alarmeFuerTrupp(t, b, st.config).filter(a => !t.quittiert[a.key])
    })
    return hoechster(alle)
  }, [st.trupps, st.config])

  if (authLoading) return null
  if (user && !user.supervisor && !(user as any).permissions?.eks) {
    return <KeinZugriff onBack={() => navigate('/hub')} />
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'lage', label: 'Lage' },
    { id: 'atemschutz', label: 'Atemschutz' },
    { id: 'etb', label: 'ETB' },
    { id: 'kraefte', label: 'Kräfte' },
    { id: 'abschnitte', label: 'Abschnitte' },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>
      <style>{CSS}</style>

      {/* Masthead */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', position: 'sticky', top: 0, zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}>
        <div style={{ height: 58, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/einsaetze')} style={{ border: 'none', background: 'none', color: RED, cursor: 'pointer', padding: 0, display: 'flex' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {st.einsatz.keyword || 'Einsatzführung'}
            </div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>
              EKS{st.einsatz.unit ? ` · ${st.einsatz.unit}` : ''}
            </div>
          </div>
          <SyncChip online={eks.online} offen={eks.offen} onClick={eks.jetztSynchronisieren} />
          <button onClick={() => setEinstellungen(true)} style={{ border: 'none', background: 'none', color: RED, cursor: 'pointer', padding: 4, lineHeight: 0 }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </button>
        </div>
        <div style={{ display: 'flex', overflowX: 'auto', borderTop: '0.5px solid rgba(96,8,18,0.08)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '10px 15px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', position: 'relative',
              color: tab === t.id ? RED : 'var(--warm-gray)',
              borderBottom: tab === t.id ? `2px solid ${RED}` : '2px solid transparent',
            }}>
              {t.label}
              {t.id === 'atemschutz' && alarmStufe && (
                <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: alarmStufe === 'critical' ? CRIT : '#d97706' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '14px 16px calc(24px + env(safe-area-inset-bottom))' }}>
        {!eks.bereit ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Lade Einsatzdaten…</div>
        ) : !st.disclaimerOk ? (
          <DisclaimerGate onOk={() => eks.dispatch('system.disclaimer', {})} />
        ) : (
          <>
            {tab === 'lage' && <TabLage st={st} dispatch={eks.dispatch} persistent={eks.persistent} offen={eks.offen} />}
            {tab === 'atemschutz' && <TabAtemschutz state={st} dispatch={eks.dispatch} />}
            {tab === 'etb' && <TabETB state={st} dispatch={eks.dispatch} offen={eks.offen} />}
            {tab === 'kraefte' && <TabKraefte state={st} dispatch={eks.dispatch} />}
            {tab === 'abschnitte' && <TabAbschnitte st={st} dispatch={eks.dispatch} />}
          </>
        )}
      </div>

      {einstellungen && <EinstellungenModal st={st} dispatch={eks.dispatch} onClose={() => setEinstellungen(false)} />}
    </div>
  )
}

function SyncChip({ online, offen, onClick }: { online: boolean; offen: number; onClick: () => void }) {
  const ok = online && offen === 0
  const farbe = !online ? '#d97706' : offen > 0 ? '#d97706' : '#16a34a'
  return (
    <button onClick={onClick} title="Jetzt abgleichen" style={{
      border: `1px solid ${farbe}`, background: `${farbe}14`, color: farbe, borderRadius: 999,
      padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    }}>
      {ok ? 'Synchron' : online ? `${offen} offen` : `Offline${offen ? ` · ${offen}` : ''}`}
    </button>
  )
}

function DisclaimerGate({ onOk }: { onOk: () => void }) {
  const [ok, setOk] = useState(false)
  return (
    <div style={{ background: 'var(--lbf-card)', borderRadius: 14, boxShadow: 'var(--lbf-shadow)', borderLeft: `3px solid ${RED}`, padding: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>Vor dem Einsatz bestätigen</div>
      <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--lbf-text)', margin: '0 0 14px' }}>
        Responda EKS ist ein <b>Unterstützungs- und Dokumentationswerkzeug</b>. Die Verantwortung für die
        Atemschutzüberwachung liegt unverändert beim Atemschutzüberwacher nach <b>FwDV 7</b>.
        Halten Sie eine <b>papierbasierte Rückfallebene</b> bereit. Die App darf nie die einzige Sicherung sein.
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--warm-gray)', fontStyle: 'italic', margin: '0 0 16px' }}>
        Auf Tablets muss der Bildschirm eingeschaltet und diese Ansicht im Vordergrund bleiben,
        damit Alarme zuverlässig ausgelöst werden.
      </p>
      <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 14 }}>
        <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} style={{ width: 18, height: 18, accentColor: RED, marginTop: 1 }} />
        <span style={{ fontSize: 13.5, color: 'var(--lbf-text)' }}>Verstanden — ich übernehme die Verantwortung für die Überwachung.</span>
      </label>
      <button disabled={!ok} onClick={onOk} style={{
        width: '100%', border: 'none', background: RED, color: '#fff', borderRadius: 10, padding: 13,
        fontWeight: 800, fontSize: 14, cursor: ok ? 'pointer' : 'not-allowed', opacity: ok ? 1 : 0.5, fontFamily: 'inherit',
      }}>Einsatzführung starten</button>
    </div>
  )
}

function TabLage({ st, dispatch, persistent, offen }: { st: EksState; dispatch: (t: EksEventType, p: any) => Promise<void>; persistent: boolean | null; offen: number }) {
  const [lage, setLage] = useState(st.einsatz.lage || '')
  const [el, setEl] = useState(st.einsatz.einsatzleiter || '')
  const [speicher, setSpeicher] = useState<{ usage: number; quota: number } | null>(null)
  useEffect(() => { speicherInfo().then(setSpeicher) }, [])

  const aktiveTrupps = Object.values(st.trupps).filter(t => t.status !== 'abgemeldet' && t.status !== 'angemeldet').length
  const kraefte = Object.values(st.kraefte).filter(k => !k.entfernt)
  const personal = kraefte.reduce((s, k) => s + (k.besatzung || 0), 0)

  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        <Stat zahl={kraefte.length} label="Einsatzmittel" />
        <Stat zahl={personal} label="Kräfte" />
        <Stat zahl={aktiveTrupps} label="Trupps unter PA" />
      </div>

      <Karte titel="Lage">
        <textarea value={lage} onChange={e => setLage(e.target.value)} onBlur={() => { if (lage !== (st.einsatz.lage || '')) dispatch('einsatz.patch', { fields: { lage } }) }}
          rows={4} placeholder="Aktuelle Lage…" className="eks-input" style={{ resize: 'vertical' }} />
      </Karte>

      <Karte titel="Einsatzleitung">
        <input value={el} onChange={e => setEl(e.target.value)} onBlur={() => { if (el !== (st.einsatz.einsatzleiter || '')) dispatch('einsatz.patch', { fields: { einsatzleiter: el } }) }}
          placeholder="Name des Einsatzleiters" className="eks-input" />
        {st.einsatz.adresse && <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 8 }}>{st.einsatz.adresse}</div>}
      </Karte>

      <Karte titel="Datensicherheit">
        <Zeile ok={persistent === true} text={persistent ? 'Speicher dauerhaft — Daten bleiben auch offline erhalten' : 'Speicher nicht dauerhaft angefordert (Browser könnte aufräumen)'} />
        <Zeile ok={offen === 0} text={offen === 0 ? 'Alle Einträge übertragen' : `${offen} Einträge nur lokal vorhanden`} />
        {speicher && (
          <div style={{ fontSize: 11.5, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 6 }}>
            Belegt: {(speicher.usage / 1048576).toFixed(1)} MB von {(speicher.quota / 1048576).toFixed(0)} MB
          </div>
        )}
        <button onClick={() => dispatch('system.papier', {})} style={{ ...bt(RED), marginTop: 10 }}>Papier-Rückfallebene aktiviert vermerken</button>
      </Karte>
    </div>
  )
}

function TabAbschnitte({ st, dispatch }: { st: EksState; dispatch: (t: EksEventType, p: any) => Promise<void> }) {
  const [neu, setNeu] = useState(false)
  const abschnitte = Object.values(st.abschnitte).filter(a => !a.entfernt)
  const FARBEN = ['#600812', '#1e3a8a', '#065f46', '#7c2d12', '#4c1d95']

  return (
    <div style={{ paddingBottom: 20 }}>
      <button onClick={() => setNeu(true)} style={{ ...bt(RED, true), width: '100%', padding: 12, marginBottom: 14 }}>Einsatzabschnitt bilden</button>
      {abschnitte.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch keine Abschnitte gebildet.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {abschnitte.map(a => {
          const zug = Object.values(st.kraefte).filter(k => !k.entfernt && k.abschnitt_id === a.id)
          const tr = Object.values(st.trupps).filter(t => t.abschnitt_id === a.id && t.status !== 'abgemeldet')
          return (
            <div key={a.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', borderLeft: `3px solid ${a.farbe || RED}`, padding: '11px 13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 15, color: 'var(--lbf-text)' }}>{a.name}</div>
                  <div style={{ fontStyle: 'italic', fontSize: 11.5, color: 'var(--warm-gray)' }}>
                    {[a.leiter && `Leitung: ${a.leiter}`, a.funkkanal && `Kanal ${a.funkkanal}`, `${zug.length} Mittel`, tr.length ? `${tr.length} Trupp(s)` : null].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <button onClick={() => { if (confirm(`Abschnitt „${a.name}" auflösen?`)) dispatch('abschnitt.remove', { id: a.id }) }}
                  style={{ background: 'none', border: 'none', color: 'var(--warm-gray)', cursor: 'pointer', padding: 4, lineHeight: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {neu && <AbschnittModal farben={FARBEN} anzahl={abschnitte.length} onClose={() => setNeu(false)}
        onSave={async p => { await dispatch('abschnitt.set', { ...p, id: newId(), neu: true }); setNeu(false) }} />}
    </div>
  )
}

function AbschnittModal({ farben, anzahl, onClose, onSave }: { farben: string[]; anzahl: number; onClose: () => void; onSave: (p: any) => void }) {
  const [name, setName] = useState('')
  const [leiter, setLeiter] = useState('')
  const [funkkanal, setKanal] = useState('')
  const farbe = farben[anzahl % farben.length]
  return (
    <Overlay titel="Einsatzabschnitt bilden" onClose={onClose}>
      <Feld label="Bezeichnung"><input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Brandbekämpfung" className="eks-input" autoFocus /></Feld>
      <Feld label="Abschnittsleiter"><input value={leiter} onChange={e => setLeiter(e.target.value)} className="eks-input" /></Feld>
      <Feld label="Funkkanal"><input value={funkkanal} onChange={e => setKanal(e.target.value)} className="eks-input" /></Feld>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose} style={bt('var(--warm-gray)')}>Abbrechen</button>
        <button disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), leiter, funkkanal, farbe })}
          style={{ ...bt(RED, true), opacity: name.trim() ? 1 : 0.5 }}>Bilden</button>
      </div>
    </Overlay>
  )
}

function EinstellungenModal({ st, dispatch, onClose }: { st: EksState; dispatch: (t: EksEventType, p: any) => Promise<void>; onClose: () => void }) {
  const [c, setC] = useState({ ...st.config })
  return (
    <Overlay titel="Atemschutz-Einstellungen" onClose={onClose}>
      <Feld label="Rückzugsdruck-Modell">
        <select value={c.rueckzug_modell} onChange={e => setC({ ...c, rueckzug_modell: e.target.value as any })} className="eks-input">
          <option value="doppelter_hinweg">Doppelter Hinweg-Verbrauch + Reserve</option>
          <option value="zwei_drittel">Zwei-Drittel-Regel</option>
          <option value="drittel">Drittelregel</option>
          <option value="fest">Fester Wert</option>
        </select>
      </Feld>
      <Feld label="Fester Rückzugsdruck (bar)"><input type="number" value={c.rueckzug_fest_bar} onChange={e => setC({ ...c, rueckzug_fest_bar: Number(e.target.value) })} className="eks-input" /></Feld>
      <Feld label="Sicherheitszuschlag (bar)"><input type="number" value={c.sicherheitszuschlag_bar} onChange={e => setC({ ...c, sicherheitszuschlag_bar: Number(e.target.value) })} className="eks-input" /></Feld>
      <Feld label="Restdruckwarner (bar)"><input type="number" value={c.restdruckwarner_bar} onChange={e => setC({ ...c, restdruckwarner_bar: Number(e.target.value) })} className="eks-input" /></Feld>
      <Feld label="Abfrage-Intervall (Minuten)"><input type="number" value={c.abfrage_intervall_s / 60} onChange={e => setC({ ...c, abfrage_intervall_s: Number(e.target.value) * 60 })} className="eks-input" /></Feld>
      <Feld label="Max. Einsatzzeit unter PA (Minuten)"><input type="number" value={c.max_einsatzzeit_s / 60} onChange={e => setC({ ...c, max_einsatzzeit_s: Number(e.target.value) * 60 })} className="eks-input" /></Feld>
      <Feld label="Angenommener Verbrauch (l/min)"><input type="number" value={c.angenommener_verbrauch_l_min} onChange={e => setC({ ...c, angenommener_verbrauch_l_min: Number(e.target.value) })} className="eks-input" /></Feld>
      <div style={{ fontSize: 11.5, fontStyle: 'italic', color: 'var(--warm-gray)', lineHeight: 1.5, marginTop: 8 }}>
        Der Rückzugsdruck wird nie unter Restdruckwarner + Sicherheitszuschlag gesetzt, unabhängig vom gewählten Modell.
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} style={bt('var(--warm-gray)')}>Abbrechen</button>
        <button onClick={async () => { await dispatch('as.config', { fields: c }); onClose() }} style={bt(RED, true)}>Übernehmen</button>
      </div>
    </Overlay>
  )
}

function KeinZugriff({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, fontFamily: "'Atkinson Hyperlegible', sans-serif" }}>
      <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)' }}>Kein Zugriff</div>
      <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', textAlign: 'center' }}>Für die Einsatzführung fehlt dir die Berechtigung.</div>
      <button onClick={onBack} style={bt(RED, true)}>Zurück</button>
    </div>
  )
}

function Karte({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', padding: 13, marginBottom: 12 }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>{titel}</div>
      {children}
    </div>
  )
}

function Stat({ zahl, label }: { zahl: number; label: string }) {
  return (
    <div style={{ background: 'var(--lbf-card)', borderRadius: 10, boxShadow: 'var(--lbf-shadow)', padding: '11px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: RED, lineHeight: 1 }}>{zahl}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function Zeile({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--lbf-text)', marginBottom: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? '#16a34a' : '#d97706', flexShrink: 0, marginTop: 5 }} />
      <span>{text}</span>
    </div>
  )
}

function bt(farbe: string, voll = false): React.CSSProperties {
  return {
    border: voll ? 'none' : `1px solid ${farbe}44`, background: voll ? farbe : 'transparent',
    color: voll ? '#fff' : farbe, borderRadius: 9, padding: '8px 13px',
    fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
  }
}
