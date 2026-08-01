import { useMemo, useState } from 'react'
import { pruefeKette } from '../../lib/eks/events'
import { eventsOf } from '../../lib/eks/db'
import type { EksEventType, EksState } from '../../lib/eks/types'
import { Feld, Overlay } from './TabAtemschutz'

const RED = '#600812'

export default function TabETB({ state, dispatch, offen }: {
  state: EksState
  dispatch: (t: EksEventType, p: any) => Promise<void>
  offen: number
}) {
  const [text, setText] = useState('')
  const [filter, setFilter] = useState<'alle' | 'manuell' | 'atemschutz'>('alle')
  const [korrektur, setKorrektur] = useState<string | null>(null)
  const [kette, setKette] = useState<{ device_id: string; ok: boolean; anzahl: number }[] | null>(null)

  const eintraege = useMemo(() => {
    return state.etb.filter(e => {
      if (filter === 'manuell') return e.typ === 'manuell' || e.typ === 'korrektur'
      if (filter === 'atemschutz') return e.typ.startsWith('as.')
      return true
    })
  }, [state.etb, filter])

  async function pruefen() {
    const evs = await eventsOf(state.einsatz.id)
    setKette(await pruefeKette(evs))
  }

  function drucken() {
    const w = window.open('', '_blank')
    if (!w) return
    const zeile = (e: any) => `
      <tr${e.korrigiert_durch ? ' class="alt"' : ''}>
        <td>${new Date(e.zeit).toLocaleString('de-DE')}${e.zeit_ungeprueft ? ' <span class="warn">(Uhrzeit ungeprüft)</span>' : ''}</td>
        <td>${esc(e.autor)}</td>
        <td>${esc(e.typ)}</td>
        <td>${e.korrigiert_durch ? '<s>' + esc(e.text) + '</s>' : esc(e.text)}${e.korrektur_von ? ' <i>(Korrektur' + (e.grund ? ': ' + esc(e.grund) : '') + ')</i>' : ''}</td>
      </tr>`
    const as = Object.values(state.trupps).map(t => `
      <h3>${esc(t.name)}${t.funkrufname ? ' · ' + esc(t.funkrufname) : ''}</h3>
      <p>${t.mitglieder.map(m => `${esc(m.name)} (Anfangsdruck ${m.anfangsdruck} bar, ${m.flasche.anzahl}×${m.flasche.liter} l)`).join('<br>')}</p>
      <p>Unter PA: ${t.t_unter_pa ? new Date(t.t_unter_pa).toLocaleString('de-DE') : '–'} · Abgemeldet: ${t.t_ende ? new Date(t.t_ende).toLocaleString('de-DE') : '–'}</p>
      <table><tr><th>Zeit</th><th>Person</th><th>Druck</th></tr>
      ${t.mitglieder.flatMap(m => (t.messungen[m.person_id] || []).map(ms =>
        `<tr><td>${new Date(ms.t).toLocaleTimeString('de-DE')}</td><td>${esc(m.name)}</td><td>${ms.druck} bar</td></tr>`)).join('')}
      </table>`).join('')

    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Einsatztagebuch</title><style>
      body{font-family:Georgia,serif;color:#1a0e08;padding:28px;line-height:1.5}
      h1{font-size:20px;color:#600812;margin:0 0 4px} h2{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:#600812;margin:22px 0 6px}
      h3{font-size:13px;margin:14px 0 4px} table{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px}
      th{text-align:left;border-bottom:1.5px solid #600812;padding:4px} td{border-bottom:.5px solid #ddd;padding:4px;vertical-align:top}
      .alt{color:#888} .warn{color:#b45309;font-style:italic} .rot{background:#fee2e2;border:1px solid #dc2626;padding:8px;margin-bottom:12px}
      p{margin:4px 0;font-size:11px}</style></head><body>
      ${offen > 0 ? `<div class="rot"><b>Achtung:</b> ${offen} Einträge sind noch nicht synchronisiert — dieser Ausdruck kann unvollständig sein.</div>` : ''}
      <h1>Einsatztagebuch</h1>
      <p>${esc(state.einsatz.keyword || '')} · Einsatz-Nr. ${esc(state.einsatz.unit || '')}<br>
      ${esc(state.einsatz.adresse || '')}<br>Einsatzleiter: ${esc(state.einsatz.einsatzleiter || '–')}</p>
      <h2>Chronologie</h2>
      <table><tr><th>Zeit</th><th>Erfasser</th><th>Typ</th><th>Eintrag</th></tr>${eintraege.map(zeile).join('')}</table>
      ${as ? '<h2>Anlage: Atemschutzüberwachung</h2>' + as : ''}
      <p style="margin-top:20px;font-size:10px;color:#888">Erstellt ${new Date().toLocaleString('de-DE')} · Responda EKS</p>
      </body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', padding: 12, marginBottom: 12 }}>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Eintrag ins Einsatztagebuch…"
          className="eks-input" style={{ resize: 'vertical', marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={drucken} style={b('var(--warm-gray)')}>Drucken / PDF</button>
          <button disabled={!text.trim()} onClick={async () => { await dispatch('etb.entry', { text: text.trim() }); setText('') }}
            style={{ ...b(RED, true), opacity: text.trim() ? 1 : 0.5 }}>Eintragen</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {([['alle', 'Alle'], ['manuell', 'Manuell'], ['atemschutz', 'Atemschutz']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            border: `1px solid ${filter === k ? RED : 'rgba(96,8,18,0.2)'}`, background: filter === k ? RED : 'transparent',
            color: filter === k ? '#fff' : RED, borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{l}</button>
        ))}
        <button onClick={pruefen} style={{ ...b('var(--warm-gray)'), marginLeft: 'auto' }}>Kette prüfen</button>
      </div>

      {kette && (
        <div style={{ background: 'var(--lbf-card)', borderRadius: 10, padding: 12, marginBottom: 10, boxShadow: 'var(--lbf-shadow)' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: RED, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Unveränderlichkeit</div>
          {kette.map(k => (
            <div key={k.device_id} style={{ fontSize: 12.5, color: k.ok ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
              Gerät {k.device_id.slice(0, 6)} · {k.anzahl} Einträge · {k.ok ? 'Kette ungebrochen' : 'KETTE UNTERBROCHEN'}
            </div>
          ))}
          <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 6 }}>
            Ein Bruch bedeutet Manipulation oder Datenverlust — beides ist bedeutsam.
          </div>
        </div>
      )}

      {eintraege.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch keine Einträge.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {eintraege.map(e => (
            <div key={e.id} style={{
              background: 'var(--lbf-card)', borderRadius: 10, padding: '10px 12px', boxShadow: 'var(--lbf-shadow)',
              borderLeft: `3px solid ${e.typ === 'manuell' ? RED : e.typ === 'korrektur' ? '#d97706' : 'rgba(139,113,90,0.4)'}`,
              opacity: e.korrigiert_durch ? 0.55 : 1,
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--lbf-text)' }}>
                  {new Date(e.zeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', flex: 1 }}>
                  {e.autor}{e.zeit_ungeprueft ? ' · Uhrzeit ungeprüft' : ''}
                </span>
                {e.typ === 'manuell' && !e.korrigiert_durch && (
                  <button onClick={() => setKorrektur(e.id)} style={{ ...b('var(--warm-gray)'), padding: '3px 8px', fontSize: 11 }}>Korrigieren</button>
                )}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--lbf-text)', marginTop: 3, textDecoration: e.korrigiert_durch ? 'line-through' : 'none' }}>{e.text}</div>
              {e.korrektur_von && <div style={{ fontSize: 11, fontStyle: 'italic', color: '#d97706', marginTop: 2 }}>Korrektur{e.grund ? ` — ${e.grund}` : ''}</div>}
            </div>
          ))}
        </div>
      )}

      {korrektur && <KorrekturModal onClose={() => setKorrektur(null)} onSave={async (t, g) => { await dispatch('etb.correct', { target_id: korrektur, text: t, grund: g }); setKorrektur(null) }} />}
    </div>
  )
}

function KorrekturModal({ onClose, onSave }: { onClose: () => void; onSave: (t: string, g: string) => void }) {
  const [text, setText] = useState('')
  const [grund, setGrund] = useState('')
  return (
    <Overlay titel="Eintrag korrigieren" onClose={onClose}>
      <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', marginBottom: 10 }}>
        Der ursprüngliche Eintrag bleibt erhalten und wird durchgestrichen — er wird nie gelöscht.
      </div>
      <Feld label="Richtigstellung"><textarea value={text} onChange={e => setText(e.target.value)} rows={3} className="eks-input" style={{ resize: 'vertical' }} /></Feld>
      <Feld label="Grund"><input value={grund} onChange={e => setGrund(e.target.value)} className="eks-input" /></Feld>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose} style={b('var(--warm-gray)')}>Abbrechen</button>
        <button disabled={!text.trim()} onClick={() => onSave(text.trim(), grund)} style={{ ...b(RED, true), opacity: text.trim() ? 1 : 0.5 }}>Speichern</button>
      </div>
    </Overlay>
  )
}

function esc(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function b(farbe: string, voll = false): React.CSSProperties {
  return {
    border: voll ? 'none' : `1px solid ${farbe}44`, background: voll ? farbe : 'transparent',
    color: voll ? '#fff' : farbe, borderRadius: 9, padding: '7px 12px',
    fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
  }
}
