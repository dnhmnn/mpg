// Rahmen des MPG-Moduls: Kopf oben, auf dem Telefon die Tab-Leiste unten
// (HEUTE · GERÄTE · MELDUNGEN · MEHR), ab 960 px eine Seitenleiste. Darunter die Seite.

import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Blaetter } from './blaetter'
import { useMpg } from './MpgDaten'
import { ICON, SCHRIFT, abschnittKopf, pik, useBreit } from './teile'

interface Ziel { pfad: string; name: string; icon: keyof typeof ICON; ende?: boolean; auch?: string[] }

const TABS: Ziel[] = [
  { pfad: '/mpg', name: 'Heute', icon: 'heute', ende: true, auch: ['/mpg/runde'] },
  { pfad: '/mpg/geraete', name: 'Geräte', icon: 'geraete' },
  { pfad: '/mpg/meldungen', name: 'Meldungen', icon: 'meldungen' },
  { pfad: '/mpg/mehr', name: 'Mehr', icon: 'mehr', auch: ['/mpg/vorlagen', '/mpg/logbuch'] },
]

const LEISTE: { titel: string; ziele: Ziel[] }[] = [
  { titel: 'Arbeit', ziele: [{ pfad: '/mpg', name: 'Heute', icon: 'heute', ende: true, auch: ['/mpg/runde'] }, { pfad: '/mpg/meldungen', name: 'Meldungen', icon: 'meldungen' }] },
  { titel: 'Bestand', ziele: [{ pfad: '/mpg/geraete', name: 'Geräte', icon: 'geraete' }] },
  { titel: 'Einrichtung', ziele: [{ pfad: '/mpg/vorlagen', name: 'Prüfvorlagen', icon: 'vorlagen' }] },
  { titel: 'Nachweis', ziele: [{ pfad: '/mpg/logbuch', name: 'Logbuch', icon: 'logbuch' }] },
]

function istAktiv(z: Ziel, pfad: string): boolean {
  if (z.ende ? pfad === z.pfad || pfad === z.pfad + '/' : pfad.startsWith(z.pfad)) return true
  return (z.auch ?? []).some(a => pfad.startsWith(a))
}

export default function MpgLayout() {
  const m = useMpg()
  const breit = useBreit()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  if (m.authLoading) return null

  const eingang = m.externalReports.filter(r => r.status === 'pending').length
  const datum = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  // Kopf wie vor dem Umbau: zurück zum Hub, Modulname, Datum
  const kopf = (
    <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid var(--lbf-border)', padding: 'calc(env(safe-area-inset-top) + 14px) 20px 14px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100 }}>
      <button onClick={() => navigate('/hub')} aria-label="Zum Hub" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--lbf-akzent)', display: 'flex' }}>
        {pik(<><polyline points="15 18 9 12 15 6"/></>)}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>Medizinprodukte</div>
        <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>{datum}</div>
      </div>
    </div>
  )

  const zaehler = (z: Ziel) => z.pfad === '/mpg/meldungen' && eingang > 0 ? eingang : 0

  // Meldungen oben, solange ein Blatt offen ist — unten lägen dessen Knöpfe
  const toast = m.msg && (
    <div role="status" style={{
      position: 'fixed', left: 16, right: 16, margin: '0 auto', width: 'fit-content', maxWidth: 520, zIndex: 9999, pointerEvents: 'none',
      ...(m.blatt ? { top: 'calc(env(safe-area-inset-top) + 72px)' } : { bottom: breit ? 24 : 'calc(76px + env(safe-area-inset-bottom))' }),
      padding: '10px 20px', borderRadius: 14, fontWeight: 600, fontSize: 13, lineHeight: 1.4, textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      background: m.msg.type === 'success' ? 'var(--lbf-ok-grund)' : 'var(--lbf-fehler-grund)',
      border: `1px solid ${m.msg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
      color: m.msg.type === 'success' ? 'var(--lbf-ok-text)' : 'var(--lbf-fehler-text)',
    }}>{m.msg.text}</div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: SCHRIFT, color: 'var(--lbf-text)' }}>
      {kopf}
      {/* Gleicher Baum in beiden Breiten — sonst baute ein gedrehtes Tablet die Seite neu auf
          und Eingaben gingen verloren */}
      <div style={breit ? { display: 'flex', alignItems: 'flex-start' } : undefined}>
        {breit ? (
          <nav aria-label="MPG" style={{ width: 220, flexShrink: 0, position: 'sticky', top: 60, padding: '24px 12px', boxSizing: 'border-box', height: 'calc(100dvh - 60px)', borderRight: '0.5px solid var(--lbf-border-light)' }}>
            {LEISTE.map(g => (
              <div key={g.titel} style={{ marginBottom: 20 }}>
                <div style={{ ...abschnittKopf, padding: '0 12px', marginBottom: 6 }}>{g.titel}</div>
                {g.ziele.map(z => {
                  const aktiv = istAktiv(z, pathname)
                  return (
                    <NavLink key={z.pfad} to={z.pfad} end={z.ende} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, textDecoration: 'none', fontSize: 14,
                      fontWeight: aktiv ? 700 : 400, color: aktiv ? 'var(--lbf-akzent)' : 'var(--lbf-text)',
                      background: aktiv ? 'rgba(var(--lbf-rot-rgb),0.06)' : 'transparent',
                    }}>
                      {pik(ICON[z.icon], 17)}
                      <span style={{ flex: 1 }}>{z.name}</span>
                      {zaehler(z) > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--lbf-akzent)' }}>{zaehler(z)}</span>}
                    </NavLink>
                  )
                })}
              </div>
            ))}
          </nav>
        ) : null}
        <main style={breit
          ? { flex: 1, minWidth: 0, padding: '24px 28px 48px' }
          : { padding: '16px 16px calc(84px + env(safe-area-inset-bottom))', maxWidth: 720, margin: '0 auto' }}>
          <Outlet />
        </main>
      </div>
      {!breit && (
        <nav aria-label="MPG" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: 'var(--lbf-card)', borderTop: '0.5px solid var(--lbf-border)', display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {TABS.map(z => {
            const aktiv = istAktiv(z, pathname)
            return (
              <NavLink key={z.pfad} to={z.pfad} end={z.ende} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none', position: 'relative',
                color: aktiv ? 'var(--lbf-akzent)' : 'var(--warm-gray)',
                borderTop: aktiv ? '2px solid var(--lbf-akzent)' : '2px solid transparent', paddingTop: 10, paddingBottom: 8,
              }}>
                {pik(ICON[z.icon], 20)}
                {zaehler(z) > 0 && <span style={{ position: 'absolute', top: 6, left: 'calc(50% + 6px)', fontSize: 9, fontWeight: 700, color: '#fff', background: 'var(--lbf-akzent-grund)', borderRadius: 8, padding: '1px 5px' }}>{zaehler(z)}</span>}
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{z.name}</span>
              </NavLink>
            )
          })}
        </nav>
      )}
      {toast}
      <Blaetter />
    </div>
  )
}
