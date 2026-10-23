// GERÄTE: Bestand nach Standort, das Dringendste zuerst; Suche und Filter nach Zustand.
// Außer Betrieb genommene Geräte stehen nur unter ihrem eigenen Filter.
// Breit: Tabelle links, das gewählte Gerät rechts daneben (dieselbe Adresse wie auf dem Telefon).

import { useMemo } from 'react'
import { Link, useNavigate, useOutlet, useParams, useSearchParams } from 'react-router-dom'
import { STUFEN, istAusserBetrieb, type Stufe } from '../../lib/mpg/zustand'
import { useMpg } from './MpgDaten'
import { GeraetKarte, naechsteFrist } from './GeraetKarte'
import { rundenVon } from './Heute'
import { useLadestand } from './Ladestand'
import { Abschnitt, Karte, Leer, STUFE_FARBE, ZustandMarke, ICON, eingabe, knopfVoll, kursivGrau, pik, useBreit } from './teile'
import { rundenPfad, type Device } from './typen'

type Filter = 'alle' | 'gesperrt' | 'handlung' | 'bald' | 'bereit' | 'ausser'
const FILTER: [Filter, string][] = [['alle', 'Alle'], ['gesperrt', 'Gesperrt'], ['handlung', 'Handeln'], ['bald', 'Bald fällig'], ['bereit', 'Bereit'], ['ausser', 'Außer Betrieb']]

function passt(f: Filter, s: Stufe): boolean {
  if (f === 'alle') return true
  if (f === 'ausser') return false
  if (f === 'bereit') return s === 'ok' || s === 'bald'
  return s === f
}

export default function Geraete() {
  const m = useMpg()
  const breit = useBreit()
  const detail = useOutlet()
  const { id: gewaehlt } = useParams()
  const navigate = useNavigate()
  const [such, setSuch] = useSearchParams()
  const q = such.get('q') ?? ''
  const filter = (FILTER.some(([f]) => f === such.get('zustand')) ? such.get('zustand') : 'alle') as Filter
  const { blocker, banner } = useLadestand()

  const setze = (k: string, v: string) => {
    const n = new URLSearchParams(such)
    if (v && v !== 'alle') n.set(k, v); else n.delete(k)
    setSuch(n, { replace: true })
  }

  const rang = (d: Device) => STUFEN.indexOf(m.zustand(d).stufe)
  const ausser = useMemo(() => m.devices.filter(istAusserBetrieb), [m.devices])
  const treffer = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (filter === 'ausser' ? ausser : m.bestand)
      .filter(d => !t || [d.name, d.type, d.location, d.serial_number].some(f => (f || '').toLowerCase().includes(t)))
      .filter(d => filter === 'ausser' || passt(filter, m.zustand(d).stufe))
      .sort((a, b) => rang(a) - rang(b) || a.name.localeCompare(b.name, 'de'))
  }, [m.bestand, ausser, m.zustand, q, filter])

  const zahl = (f: Filter) => f === 'ausser' ? ausser.length : m.bestand.filter(d => passt(f, m.zustand(d).stufe)).length
  const kopf = (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <input value={q} onChange={e => setze('q', e.target.value)} placeholder="Name, Typ, Standort, Seriennummer …" aria-label="Geräte durchsuchen" style={{ ...eingabe, flex: 1 }} />
        {m.darfVerwalten && (
          <Link to="/mpg/geraete/neu" style={{ ...knopfVoll, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            {pik(ICON.plus, 16)} Gerät
          </Link>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 2 }}>
        {FILTER.filter(([f]) => f !== 'ausser' || ausser.length > 0 || filter === 'ausser').map(([f, name]) => {
          const an = filter === f
          return (
            <button key={f} onClick={() => setze('zustand', f)} aria-pressed={an} style={{
              border: `1px solid ${an ? 'var(--lbf-akzent)' : 'var(--lbf-border)'}`, background: an ? 'rgba(var(--lbf-rot-rgb),0.06)' : 'var(--lbf-card)',
              color: an ? 'var(--lbf-akzent)' : 'var(--lbf-text)', borderRadius: 8, padding: '8px 11px', fontSize: 12, fontWeight: 700,
              fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{name} <span style={{ color: 'var(--warm-gray)', fontWeight: 400 }}>{zahl(f)}</span></button>
          )
        })}
      </div>
    </>
  )
  const leer = <Leer>{m.devices.length ? 'Keine Geräte gefunden' : 'Noch keine Geräte angelegt'}</Leer>
  const aus = (d: Device) => istAusserBetrieb(d)
  const zelle = { padding: '10px 12px', borderBottom: '0.5px solid var(--lbf-border-light)' }
  const zuGeraet = (id: string) => `/mpg/geraete/${id}${such.toString() ? `?${such}` : ''}`

  // Breit: Tabelle. Der Name ist ein Link (Tastatur), die Zeile zusätzlich anklickbar.
  const tabelle = treffer.length === 0 ? leer : (
    <Karte>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            {['Gerät', 'Standort', ...(detail ? [] : ['Seriennummer', 'Nächste Fristen']), 'Zustand'].map(h => (
              <th key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--lbf-akzent)', padding: '12px 12px 8px', borderBottom: '0.5px solid var(--lbf-border-light)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {treffer.map(d => {
            const z = m.zustand(d)
            const an = d.id === gewaehlt
            return (
              <tr key={d.id} onClick={e => { if (!(e.target as HTMLElement).closest('a')) navigate(zuGeraet(d.id), { replace: !!gewaehlt }) }}
                style={{ cursor: 'pointer', background: an ? 'rgba(var(--lbf-rot-rgb),0.05)' : undefined, boxShadow: `inset 3px 0 0 ${STUFE_FARBE[z.stufe]}` }}>
                <td style={zelle}>
                  <Link to={zuGeraet(d.id)} replace={!!gewaehlt} aria-current={an ? 'page' : undefined} style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)', textDecoration: 'none' }}>{d.name}</Link>
                  <div style={{ ...kursivGrau, fontSize: 11 }}>{d.type}{z.gruende[0] ? ` · ${z.gruende[0].text}` : ''}</div>
                </td>
                <td style={{ ...zelle, ...kursivGrau }}>{d.location || '—'}</td>
                {!detail && <td style={{ ...zelle, ...kursivGrau }}>{d.serial_number || '—'}</td>}
                {!detail && <td style={{ ...zelle, ...kursivGrau }}>{naechsteFrist(z)}</td>}
                <td style={zelle}>{aus(d) ? <span style={{ ...kursivGrau }}>außer Betrieb</span> : <ZustandMarke stufe={z.stufe} />}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Karte>
  )

  // Telefon: nach Standort gruppiert
  const gruppiert = treffer.length === 0 ? leer : rundenVon(treffer).map(g => (
    <Abschnitt key={g.schluessel} titel={`${g.name} (${g.geraete.length})`}
      rechts={filter === 'ausser' ? undefined : <Link to={rundenPfad(g.schluessel)} style={{ fontSize: 11, fontWeight: 700, color: 'var(--lbf-akzent)', textDecoration: 'none', padding: '10px 8px', margin: '-10px -8px', letterSpacing: '0.08em' }}>Prüfrunde</Link>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {g.geraete
          .sort((a, b) => rang(a) - rang(b) || a.name.localeCompare(b.name, 'de'))
          .map(d => <GeraetKarte key={d.id} device={d} />)}
      </div>
    </Abschnitt>
  ))

  // Gleicher Baum in beiden Breiten: das Detail (z. B. ein halb ausgefülltes Formular) bleibt
  // erhalten, wenn ein Tablet gedreht wird. Auf dem Telefon ersetzt das Detail die Liste.
  return (
    <div style={breit ? { display: 'flex', gap: 24, alignItems: 'flex-start' } : undefined}>
      {breit || !detail ? (
        <div style={breit ? { flex: detail ? '0 0 46%' : 1, minWidth: 0 } : undefined}>
          {blocker ?? <>{banner}{kopf}{breit ? tabelle : gruppiert}</>}
        </div>
      ) : null}
      {detail ? (
        <div style={breit ? { flex: 1, minWidth: 0, position: 'sticky', top: 84, maxHeight: 'calc(100dvh - 108px)', overflowY: 'auto', paddingRight: 4 } : undefined}>{detail}</div>
      ) : null}
    </div>
  )
}
