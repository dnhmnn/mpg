// Ein Prüfprotokoll — im Gerätebuch und im Logbuch gleich. Aufklappbar mit den Punkten.

import { ergebnisVon } from '../../lib/mpg/pruefung'
import { ERGEBNIS_FARBE, ErgebnisMarke, ICON, Karte, fmtDateTime, kursivGrau, pik } from './teile'
import type { Inspection } from './typen'

export function PruefungEintrag({ p, mitGeraet }: { p: Inspection; mitGeraet?: boolean }) {
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
      </details>
    </Karte>
  )
}
