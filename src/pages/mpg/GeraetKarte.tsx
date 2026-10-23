// Ein Gerät als Karte — in Heute, Prüfrunde und Geräteliste gleich.

import { Link } from 'react-router-dom'
import { tagText } from '../../lib/mpg/fristen'
import { istAusserBetrieb } from '../../lib/mpg/zustand'
import { useMpg } from './MpgDaten'
import { Aktionen, Karte, Marke, STUFE_FARBE, ZustandMarke, knopfLeise, kursivGrau, relativeDate } from './teile'
import type { Device } from './typen'

export function naechsteFrist(z: ReturnType<ReturnType<typeof useMpg>['zustand']>): string {
  return z.fristen.map(f => f.naechste
    ? `${f.art === 'pruefung' ? 'Prüfung' : f.bezeichnung} ${tagText(f.naechste)}`
    : f.art === 'pruefung' ? 'Prüfung offen' : `${f.bezeichnung}: Datum fehlt`).join(' · ')
}

export function GeraetKarte({ device, mitAktionen = true, zurueck, gruende = 3 }: { device: Device; mitAktionen?: boolean; zurueck?: string; gruende?: number }) {
  const m = useMpg()
  const z = m.zustand(device)
  const unklar = m.unklarerDefekt(device.id)
  const ausser = istAusserBetrieb(device)
  return (
    <Karte rand={ausser ? 'rgba(var(--lbf-grau-rgb),0.4)' : STUFE_FARBE[z.stufe]}>
      <Link to={`/mpg/geraete/${device.id}`} style={{ display: 'block', padding: '12px 14px', textDecoration: 'none', color: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 3 }}>{device.type}</div>
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)' }}>{device.name}</div>
            {(device.location || device.serial_number) && (
              <div style={{ ...kursivGrau, marginTop: 2 }}>{[device.location, device.serial_number && `S/N ${device.serial_number}`].filter(Boolean).join(' · ')}</div>
            )}
          </div>
          {ausser ? <Marke grund="rgba(var(--lbf-grau-rgb),0.12)" schrift="var(--warm-gray)">Außer Betrieb</Marke> : <ZustandMarke stufe={z.stufe} />}
        </div>
        {z.gruende.slice(0, gruende).map((g, i) => (
          <div key={i} style={{ fontSize: 13, fontStyle: 'italic', marginTop: i ? 1 : 8, color: g.stufe === 'gesperrt' ? 'var(--lbf-fehler-text)' : 'var(--lbf-text)' }}>{g.text}</div>
        ))}
        {z.gruende.length > gruende && <div style={{ ...kursivGrau, marginTop: 1 }}>und {z.gruende.length - gruende} weitere</div>}
        {unklar && <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--lbf-fehler-text)', marginTop: 4 }}>Defektmeldung nicht sicher gespeichert — erneut senden</div>}
        <div style={{ ...kursivGrau, marginTop: 6 }}>
          {naechsteFrist(z)}{device.last_inspection ? ` · zuletzt ${relativeDate(device.last_inspection)}` : ''}
        </div>
      </Link>
      {mitAktionen && !ausser && (
        <Aktionen>
          <Link to={`/mpg/geraete/${device.id}/pruefen`} state={zurueck ? { zurueck } : undefined} style={{ ...knopfLeise, background: 'var(--lbf-akzent-grund)', color: '#fff', textDecoration: 'none', flex: 1, textAlign: 'center' }}>Prüfen</Link>
          <button onClick={() => m.setBlatt({ art: 'defekt', device })} style={{ ...knopfLeise, flex: 1, color: unklar ? 'var(--lbf-fehler-text)' : 'var(--lbf-akzent)' }}>{unklar ? 'Erneut senden' : 'Mangel melden'}</button>
        </Aktionen>
      )}
      {/* Außer Betrieb: nur noch eine unklar gesendete Meldung erneut senden */}
      {mitAktionen && ausser && unklar && (
        <Aktionen>
          <button onClick={() => m.setBlatt({ art: 'defekt', device })} style={{ ...knopfLeise, flex: 1, color: 'var(--lbf-fehler-text)' }}>Erneut senden</button>
        </Aktionen>
      )}
    </Karte>
  )
}
