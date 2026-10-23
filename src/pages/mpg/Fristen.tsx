// FRISTEN: alle STK und MTK des Bestands — zum Planen mit dem Dienstleister (Prüftag).
// Gesperrte zuerst: Eine überfällige oder nicht bestandene Kontrolle sperrt das Gerät.

import { useSearchParams, Link } from 'react-router-dom'
import { tagText } from '../../lib/mpg/fristen'
import { taktText } from '../../lib/mpg/aktionen'
import { KONTROLLE_NAME, type KontrollArt } from '../../lib/mpg/kontrollen'
import { useMpg } from './MpgDaten'
import { useLadestand } from './Ladestand'
import { ABSCHNITTE, abschnittVon, fristenEintraege, nichtAngehakt, type FristEintrag } from './fristenListe'
import { Abschnitt, Hinweis, Karte, Leer, SeitenKopf, knopfLeise, kursivGrau, useBreit } from './teile'

type Filter = 'alle' | KontrollArt

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export default function Fristen() {
  const m = useMpg()
  const breit = useBreit()
  const [such, setSuch] = useSearchParams()
  const filter = (['stk', 'mtk'].includes(such.get('art') || '') ? such.get('art') : 'alle') as Filter
  const { blocker, banner } = useLadestand()
  if (blocker) return blocker

  const alle = fristenEintraege(m)
  const liste = alle
    .filter(e => filter === 'alle' || e.frist.art === filter)
    .sort((a, b) => (a.frist.naechste ?? '9999').localeCompare(b.frist.naechste ?? '9999') || a.device.name.localeCompare(b.device.name, 'de'))
  const gruppen = ABSCHNITTE.map((titel, i) => ({ titel, i, eintraege: liste.filter(e => abschnittVon(e, m.heute) === i) })).filter(g => g.eintraege.length)
  const zahl = (f: Filter) => alle.filter(e => f === 'alle' || e.frist.art === f).length
  const setze = (f: Filter) => { const n = new URLSearchParams(such); if (f === 'alle') n.delete('art'); else n.set('art', f); setSuch(n, { replace: true }) }
  // Nur für „MPG verwalten“ — wer es nicht ändern darf, kann hier nichts entscheiden
  const offenZuEntscheiden = m.darfVerwalten ? nichtAngehakt(m.bestand).filter(x => filter === 'alle' || x.fehlt.includes(filter)) : []
  const ohneDatumTitel = m.darfVerwalten ? `Ohne Datum — letzte Kontrolle${m.inbetriebnahmeMoeglich ? ' oder Inbetriebnahme' : ''} eintragen` : 'Ohne Datum'

  return (
    <>
      <SeitenKopf zurueck={breit ? undefined : '/mpg/mehr'} titel="Fristen" unter="Sicherheitstechnische (STK) und messtechnische Kontrollen (MTK)" />
      {banner}
      {m.darfVerwalten && !m.buch && alle.length > 0 && (
        <div style={{ marginBottom: 14, maxWidth: 760 }}>
          <Hinweis>STK und MTK mit Prüfer und Protokoll eintragen geht, sobald das Gerätebuch in PocketBase eingerichtet ist. Bis dahin das Datum der letzten Kontrolle beim Gerät unter „Bearbeiten“ eintragen.</Hinweis>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['alle', 'stk', 'mtk'] as Filter[]).map(f => {
          const an = filter === f
          return (
            <button key={f} onClick={() => setze(f)} aria-pressed={an} style={{
              border: `1px solid ${an ? 'var(--lbf-akzent)' : 'var(--lbf-border)'}`, background: an ? 'rgba(var(--lbf-rot-rgb),0.06)' : 'var(--lbf-card)',
              color: an ? 'var(--lbf-akzent)' : 'var(--lbf-text)', borderRadius: 8, padding: '8px 11px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            }}>{f === 'alle' ? 'Alle' : KONTROLLE_NAME[f]} <span style={{ color: 'var(--warm-gray)', fontWeight: 400 }}>{zahl(f)}</span></button>
          )
        })}
      </div>
      {liste.length === 0 && <Leer>{alle.length ? 'Keine Fristen in dieser Auswahl'
        : `Bei keinem Gerät ist STK oder MTK eingetragen.${m.darfVerwalten ? ' Ob eines sie braucht, steht beim Bearbeiten unter „Vorschlag“.' : ''}`}</Leer>}
      <div style={{ maxWidth: 760 }}>
        {gruppen.map(g => (
          <Abschnitt key={g.titel} titel={`${g.i === 2 ? ohneDatumTitel : g.titel} (${g.eintraege.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {g.eintraege.map(e => <Zeile key={e.device.id + e.frist.art} e={e} />)}
            </div>
          </Abschnitt>
        ))}
        {offenZuEntscheiden.length > 0 && (
          <Abschnitt titel={`Prüfen: STK/MTK nicht angehakt (${offenZuEntscheiden.length})`}>
            <div style={{ ...kursivGrau, marginBottom: 8 }}>Der Gerätetyp legt eine Kontrolle nahe — bitte beim Gerät entscheiden. Ist sie bewusst nicht angehakt (z. B. Ausnahme Laien-AED), kann das Gerät hier stehen bleiben.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {offenZuEntscheiden.map(({ device, fehlt }) => (
                <Karte key={device.id} rand="var(--lbf-akzent)">
                  <Link to={m.darfVerwalten ? `/mpg/geraete/${device.id}/bearbeiten` : `/mpg/geraete/${device.id}`} style={{ display: 'block', padding: '10px 14px', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, fontStyle: 'italic' }}>{device.name}</div>
                    <div style={{ ...kursivGrau, marginTop: 2 }}>{[device.type, device.location].filter(Boolean).join(' · ')} — {fehlt.map(a => KONTROLLE_NAME[a]).join(' und ')} nicht angehakt</div>
                  </Link>
                </Karte>
              ))}
            </div>
          </Abschnitt>
        )}
      </div>
    </>
  )
}

function Zeile({ e }: { e: FristEintrag }) {
  const m = useMpg()
  const { device, frist, nichtBestanden } = e
  const rot = frist.lage === 'ueberfaellig' || nichtBestanden
  const monat = frist.naechste ? Number(frist.naechste.slice(5, 7)) - 1 : null
  const lage = frist.lage === 'ok' ? 'in Ordnung' : frist.lage === 'bald' ? 'bald fällig' : frist.lage === 'heute' ? 'heute fällig' : 'überfällig'
  return (
    <Karte rand={rot ? '#dc2626' : 'var(--lbf-akzent)'}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ width: 64, flexShrink: 0, textAlign: 'center', padding: '10px 0', borderRight: '0.5px solid rgba(var(--lbf-rot-rgb),0.1)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warm-gray)' }}>{KONTROLLE_NAME[frist.art]}</div>
          <div style={{ fontSize: 22, fontStyle: 'italic', fontWeight: 700, color: rot ? 'var(--lbf-fehler-text)' : 'var(--lbf-akzent)', lineHeight: 1.2 }}>{monat === null ? '—' : MONATE[monat]}</div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--warm-gray)' }}>{frist.naechste?.slice(0, 4) ?? ''}</div>
        </div>
        <Link to={`/mpg/geraete/${device.id}`} style={{ flex: 1, minWidth: 0, padding: '10px 14px', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontWeight: 700, fontSize: 15, fontStyle: 'italic' }}>{device.name}</div>
          <div style={{ ...kursivGrau, marginTop: 2 }}>
            {[device.type, device.location, taktText(frist.art, frist.art === 'stk' ? device.stk_interval_months : device.mtk_interval_months)].filter(Boolean).join(' · ')}
          </div>
          <div style={{ fontSize: 12, marginTop: 3, color: rot ? 'var(--lbf-fehler-text)' : 'var(--lbf-text)' }}>
            {nichtBestanden ? `zuletzt nicht bestanden — erst nach bestandener ${KONTROLLE_NAME[frist.art]} wieder einsetzen`
              : frist.naechste ? `fällig bis ${tagText(frist.naechste)} — ${lage}`
              : frist.zukunft ? 'Datum liegt in der Zukunft — bitte prüfen' : 'Datum fehlt'}
            {!nichtBestanden && (frist.letzte ? ` · zuletzt ${tagText(frist.letzte)}` : frist.abInbetriebnahme ? ' · erste Kontrolle' : '')}
          </div>
        </Link>
        {m.darfVerwalten && m.buch && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px' }}>
            <button onClick={() => m.setBlatt({ art: 'kontrolle', device, kontrolle: frist.art })} style={knopfLeise}>Eintragen</button>
          </div>
        )}
      </div>
    </Karte>
  )
}
