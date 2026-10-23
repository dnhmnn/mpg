// MELDUNGEN: Eingang (Meldungen von außen), offene Defekte, behobene Defekte.
// Breit: Liste links, der Fall rechts daneben.

import { Link, useOutlet, useParams, useSearchParams } from 'react-router-dom'
import { darfBeheben } from '../../lib/mpg/rechte'
import { useMpg } from './MpgDaten'
import { useLadestand } from './Ladestand'
import { Aktionen, Karte, Leer, Reiter, SCHWERE_RAND, SchwereMarke, fmtDate, knopfLeise, kursivGrau, relativeDate, useBreit } from './teile'
import type { Defect } from './typen'

type Teil = 'eingang' | 'offen' | 'behoben'

export default function Meldungen() {
  const m = useMpg()
  const breit = useBreit()
  const detail = useOutlet()
  const { id: gewaehlt } = useParams()
  const [such, setSuch] = useSearchParams()
  const { blocker, banner } = useLadestand()


  const eingang = m.externalReports.filter(r => r.status === 'pending')
  const offen = m.defects.filter(d => d.status !== 'resolved')
  const alleBehoben = m.defects.filter(d => d.status === 'resolved')
  const behoben = alleBehoben.slice(0, 50)
  const vorgabe: Teil = eingang.length ? 'eingang' : 'offen'
  const teil = (['eingang', 'offen', 'behoben'].includes(such.get('teil') || '') ? such.get('teil') : vorgabe) as Teil
  const setTeil = (t: Teil) => { const n = new URLSearchParams(such); n.set('teil', t); setSuch(n, { replace: true }) }

  const defektKarte = (d: Defect) => (
    <Karte key={d.id} rand={d.status === 'resolved' ? 'rgba(var(--lbf-grau-rgb),0.4)' : SCHWERE_RAND[d.severity]}
      style={d.id === gewaehlt ? { boxShadow: '0 0 0 1.5px var(--lbf-akzent)' } : undefined}>
      <Link to={`/mpg/meldungen/${d.id}?teil=${teil}`} replace={breit && !!gewaehlt} style={{ display: 'block', padding: '12px 14px', textDecoration: 'none', color: 'inherit' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 16 }}>{m.geraeteName(d.device_id, d.device_name)}</div>
          {d.status === 'resolved' ? <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Behoben</span> : <SchwereMarke severity={d.severity} />}
        </div>
        <div style={{ fontSize: 14, marginTop: 4, whiteSpace: 'pre-line', lineHeight: 1.45 }}>{d.description}</div>
        <div style={{ ...kursivGrau, marginTop: 6 }}>
          {d.status === 'resolved' ? `gemeldet ${fmtDate(d.created)} · behoben von ${d.resolved_by || '—'}` : `${relativeDate(d.created)} · ${d.reported_by}`}
        </div>
      </Link>
      {d.status !== 'resolved' && (
        <Aktionen>
          {darfBeheben(m.user, d.severity) && <button onClick={() => m.setBlatt({ art: 'beheben', defekt: d })} style={{ ...knopfLeise, background: '#16a34a', color: '#fff' }}>Beheben</button>}
          <Link to={`/mpg/geraete/${d.device_id}`} style={{ ...knopfLeise, textDecoration: 'none' }}>Zum Gerät</Link>
        </Aktionen>
      )}
    </Karte>
  )

  const liste = (
    <>
      {banner}
      <Reiter wert={teil} onWahl={setTeil} optionen={[['eingang', `Eingang (${eingang.length})`], ['offen', `Offen (${offen.length})`], ['behoben', 'Behoben']]} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {teil === 'eingang' && eingang.length > 0 && !m.darfVerwalten && <div style={kursivGrau}>Bestätigen oder ablehnen kann, wer „MPG verwalten“ hat.</div>}
        {teil === 'eingang' && (eingang.length === 0 ? <Leer>Keine neuen Meldungen</Leer> : eingang.map(r => (
          <Karte key={r.id} rand={SCHWERE_RAND[r.severity]}>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <Link to={`/mpg/geraete/${r.device_id}`} style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 16, color: 'var(--lbf-text)', textDecoration: 'none' }}>{m.geraeteName(r.device_id, r.device_name)}</Link>
                <SchwereMarke severity={r.severity} />
              </div>
              <div style={{ fontSize: 14, marginTop: 4, lineHeight: 1.45 }}>{r.description}</div>
              <div style={{ ...kursivGrau, marginTop: 6 }}>{relativeDate(r.created)} · {r.reporter_name || 'Anonym'}</div>
              {m.unklareBestaetigung(r.id) && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--lbf-fehler-text)', marginTop: 4 }}>Bestätigung nicht sicher gespeichert — bitte erneut senden</div>}
            </div>
            {m.darfVerwalten && (
              <Aktionen>
                <button onClick={() => m.setBlatt({ art: 'bestaetigen', meldung: r })} style={{ ...knopfLeise, background: 'var(--lbf-akzent-grund)', color: '#fff' }}>Bestätigen</button>
                <button onClick={() => m.setBlatt({ art: 'ablehnen', meldung: r })} style={knopfLeise}>Ablehnen</button>
              </Aktionen>
            )}
          </Karte>
        )))}
        {teil === 'offen' && (offen.length === 0 ? <Leer>Keine offenen Defekte</Leer> : offen.map(defektKarte))}
        {teil === 'behoben' && (behoben.length === 0 ? <Leer>Noch nichts behoben</Leer> : behoben.map(defektKarte))}
        {teil === 'behoben' && alleBehoben.length > behoben.length && (
          <div style={{ ...kursivGrau, textAlign: 'center', padding: 8 }}>Die letzten {behoben.length} von {alleBehoben.length} — ältere stehen im Verlauf des jeweiligen Geräts.</div>
        )}
      </div>
    </>
  )

  // Gleicher Baum in beiden Breiten (siehe Geraete.tsx); auf dem Telefon ersetzt der Fall die Liste
  return (
    <div style={breit ? { display: 'flex', gap: 24, alignItems: 'flex-start' } : undefined}>
      {breit || !detail ? (
        <div style={breit ? { flex: detail ? '0 0 46%' : 1, minWidth: 0, maxWidth: detail ? undefined : 760 } : undefined}>{blocker ?? liste}</div>
      ) : null}
      {detail ? (
        <div style={breit ? { flex: 1, minWidth: 0, position: 'sticky', top: 84, maxHeight: 'calc(100dvh - 108px)', overflowY: 'auto' } : undefined}>{detail}</div>
      ) : null}
    </div>
  )
}
