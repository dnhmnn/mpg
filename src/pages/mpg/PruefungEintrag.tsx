// Ein Prüfprotokoll — im Gerätebuch und im Logbuch gleich. Aufklappbar mit den Punkten.
// Ein Protokoll wird nie geändert; Vermerke dazu (Korrekturen) stehen darunter.

import { ergebnisVon } from '../../lib/mpg/pruefung'
import { ERGEBNIS_FARBE, ErgebnisMarke, ICON, Karte, fmtDateTime, knopfLeise, kursivGrau, pik } from './teile'
import type { Ereignis, Inspection } from './typen'

export function PruefungEintrag({ p, mitGeraet, vermerke = [], onVermerk }: { p: Inspection; mitGeraet?: boolean; vermerke?: Ereignis[]; onVermerk?: () => void }) {
  const erg = ergebnisVon(p)
  const punkte = Array.isArray(p.checklist_results) ? p.checklist_results : []
  return (
    <Karte rand={ERGEBNIS_FARBE[erg]}>
      <details>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {mitGeraet && <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 15 }}>{p.device_name}</div>}
            <div style={kursivGrau}>{fmtDateTime(p.inspection_date)} · {p.user_name}</div>
            {p.notes && <div style={{ fontSize: 13, fontStyle: 'italic', marginTop: 4 }}>{p.notes}</div>}
          </div>
          <ErgebnisMarke ergebnis={erg} />
        </summary>
        {punkte.length > 0 && (
          <div style={{ borderTop: '0.5px solid var(--lbf-border-light)', padding: '8px 14px 12px' }}>
            {punkte.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', alignItems: 'flex-start' }}>
                <span style={{ color: r.checked ? '#16a34a' : 'var(--lbf-fehler-text)', marginTop: 1 }} aria-label={r.checked ? 'in Ordnung' : 'nicht in Ordnung'}>{pik(r.checked ? ICON.haken : ICON.kreuz, 14)}</span>
                <div style={{ fontSize: 13 }}>
                  {r.item}
                  {r.note && <div style={kursivGrau}>{r.note}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
        {onVermerk && (
          <div style={{ borderTop: '0.5px solid var(--lbf-border-light)', padding: '8px 14px' }}>
            <button onClick={onVermerk} style={knopfLeise}>Vermerk dazu</button>
          </div>
        )}
      </details>
      {vermerke.map(v => (
        <div key={v.id} style={{ borderTop: '0.5px solid var(--lbf-border-light)', padding: '8px 14px', background: 'rgba(var(--lbf-rot-rgb),0.03)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Vermerk</div>
          <div style={{ fontSize: 13, whiteSpace: 'pre-line', marginTop: 2 }}>{v.text}</div>
          <div style={{ ...kursivGrau, marginTop: 2 }}>{fmtDateTime(v.created)} · {v.user_name}</div>
        </div>
      ))}
    </Karte>
  )
}
