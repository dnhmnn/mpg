// Ein Eintrag im Gerätebuch — auf der Seite des Geräts und im Logbuch gleich.

import { EREIGNIS_TEXT, type EreignisArt } from '../../lib/mpg/aktionen'
import { tagText } from '../../lib/mpg/fristen'
import { Karte, fmtDateTime, kursivGrau } from './teile'
import type { Ereignis } from './typen'

export const EREIGNIS_FARBE: Record<EreignisArt, string> = {
  gesperrt: '#dc2626', ausser_betrieb: '#dc2626', geloescht: '#dc2626',
  freigegeben: '#16a34a', wieder_in_betrieb: '#16a34a',
  angelegt: 'var(--lbf-akzent)', geaendert: 'var(--lbf-akzent)', stk: 'var(--lbf-akzent)', mtk: 'var(--lbf-akzent)',
  vermerk: 'rgba(var(--lbf-grau-rgb),0.4)',
}

const ROT: EreignisArt[] = ['gesperrt', 'ausser_betrieb', 'geloescht']

export function GeraetebuchEintrag({ e, mitGeraet, bezugText }: { e: Ereignis; mitGeraet?: boolean; bezugText?: string }) {
  const art: EreignisArt = e.art in EREIGNIS_TEXT ? e.art : 'vermerk'
  const aenderungen = Array.isArray(e.aenderungen) ? e.aenderungen : []
  // Angaben einer STK/MTK nur, wenn sie ein Objekt sind (von Hand oder anders geschrieben: nicht deuten)
  const a = e.angaben && typeof e.angaben === 'object' && !Array.isArray(e.angaben) ? e.angaben : null
  const durchgefallen = (art === 'stk' || art === 'mtk') && a?.ergebnis === 'nicht_bestanden'
  const rot = ROT.includes(art) || durchgefallen
  return (
    <Karte rand={durchgefallen ? '#dc2626' : EREIGNIS_FARBE[art]} style={{ padding: '10px 14px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: rot ? 'var(--lbf-fehler-text)' : 'var(--lbf-akzent)' }}>
        {EREIGNIS_TEXT[art]}
      </div>
      {mitGeraet && <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 15, marginTop: 2 }}>{e.device_name}</div>}
      {bezugText && <div style={{ ...kursivGrau, marginTop: 2 }}>{bezugText}</div>}
      {e.text && <div style={{ fontSize: 14, marginTop: 3, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{e.text}</div>}
      {art === 'angelegt' && aenderungen.length > 0 && (
        <div style={{ fontSize: 13, marginTop: 3 }}>{aenderungen.filter(a => a.neu && a.neu !== '—').map(a => `${a.name}: ${a.neu}`).join(' · ')}</div>
      )}
      {(art === 'stk' || art === 'mtk') && a && !durchgefallen && (typeof a.plakette === 'boolean' || a.naechste) && (
        <div style={{ ...kursivGrau, marginTop: 3 }}>
          {[typeof a.plakette === 'boolean' && (a.plakette ? 'Prüfplakette angebracht' : 'ohne Prüfplakette'),
            typeof a.naechste === 'string' && `nächste ${art === 'stk' ? 'STK' : 'MTK'} fällig bis ${tagText(a.naechste)}`].filter(Boolean).join(' · ')}
        </div>
      )}
      {art !== 'angelegt' && aenderungen.map(a => (
        <div key={a.feld} style={{ fontSize: 13, marginTop: 3 }}>
          <span style={{ fontWeight: 700 }}>{a.name}:</span> {a.alt} → {a.neu}
        </div>
      ))}
      <div style={{ ...kursivGrau, marginTop: 4 }}>{fmtDateTime(e.created)}{e.user_name ? ` · ${e.user_name}` : ''}</div>
    </Karte>
  )
}
