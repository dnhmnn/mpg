// Lade- und Fehlerzustand der Seiten: Solange nichts geladen ist, ersetzt er die Seite;
// scheitert ein späteres Laden (Funkloch), bleibt die Seite stehen und darüber ein Hinweis.

import { useMpg } from './MpgDaten'
import { Karte, Leer, knopfVoll, kursivGrau } from './teile'

export function useLadestand() {
  const m = useMpg()
  const nochNichts = !m.geraeteGeladen
  const blocker = nochNichts
    ? (m.ladefehler && !m.loading
        ? (
          <Karte rand="#dc2626" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Geräte konnten nicht geladen werden</div>
            <div style={{ ...kursivGrau, marginBottom: 12 }}>{m.ladefehler}</div>
            <button onClick={m.loadAll} style={knopfVoll}>Erneut laden</button>
          </Karte>
        )
        : <Leer>Lade Geräte …</Leer>)
    : null
  const banner = !nochNichts && m.ladefehler && !m.loading
    ? (
      <Karte rand="#dc2626" style={{ padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, fontSize: 12, fontStyle: 'italic' }}>Stand nicht aktuell — {m.ladefehler}</div>
        <button onClick={m.loadAll} style={{ ...knopfVoll, padding: '8px 12px', minHeight: 0, fontSize: 12 }}>Erneut laden</button>
      </Karte>
    )
    : null
  return { blocker, banner }
}
