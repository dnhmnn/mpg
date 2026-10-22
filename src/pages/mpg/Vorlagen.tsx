// Prüfvorlagen je Gerätetyp: Übersicht und Bearbeiten.

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMpg } from './MpgDaten'
import { useLadestand } from './Ladestand'
import { ICON, Karte, Leer, SeitenKopf, eingabe, knopfLeise, knopfRand, knopfVollWenn, kursivGrau, pik, useBreit, useZurueck } from './teile'
import { DEFAULT_CHECKLISTS, DEVICE_TYPES } from './typen'

export default function Vorlagen() {
  const { typ } = useParams()
  const m = useMpg()
  const breit = useBreit()
  const { blocker, banner } = useLadestand()
  if (blocker) return blocker
  // Erst mit geladenen Vorlagen — sonst begänne der Editor mit der Standardliste und
  // Speichern überschriebe die eigene Vorlage
  if (!m.vorlagenGeladen) {
    return m.ladefehler && !m.loading
      ? <Karte rand="#dc2626" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Prüfvorlagen konnten nicht geladen werden</div>
          <div style={{ ...kursivGrau, marginBottom: 12 }}>{m.ladefehler}</div>
          <button onClick={m.loadAll} style={knopfVollWenn(true)}>Erneut laden</button>
        </Karte>
      : <Leer>Lade Prüfvorlagen …</Leer>
  }
  if (typ) return <>{banner}<Editor key={typ} typ={typ} /></>
  const typen = [...new Set([...DEVICE_TYPES, ...m.checklists.map(c => c.device_type), ...m.devices.map(d => d.type)].filter(Boolean))]
  return (
    <>
      <SeitenKopf zurueck={breit ? undefined : '/mpg/mehr'} titel="Prüfvorlagen" unter="Prüfpunkte je Gerätetyp" />
      {banner}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640 }}>
        {typen.map(t => {
          const v = m.checklists.find(c => c.device_type === t)
          const anzahl = v?.items?.length || (DEFAULT_CHECKLISTS[t] || DEFAULT_CHECKLISTS['Sonstiges']).length
          const geraete = m.devices.filter(d => d.type === t).length
          return (
            <Karte key={t} rand="var(--lbf-akzent)">
              <Link to={`/mpg/vorlagen/${encodeURIComponent(t)}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{t}</div>
                  <div style={kursivGrau}>{anzahl} Prüfpunkte{v ? '' : ' (Standard)'} · {geraete} {geraete === 1 ? 'Gerät' : 'Geräte'}</div>
                </div>
                <span style={{ color: 'var(--warm-gray)' }}>{pik(ICON.weiter, 16)}</span>
              </Link>
            </Karte>
          )
        })}
      </div>
    </>
  )
}

function Editor({ typ }: { typ: string }) {
  const m = useMpg()
  const navigate = useNavigate()
  const standard = DEFAULT_CHECKLISTS[typ] || DEFAULT_CHECKLISTS['Sonstiges']
  const [punkte, setPunkte] = useState<string[]>(() => [...(m.checklists.find(c => c.device_type === typ)?.items ?? standard)])
  const [neu, setNeu] = useState('')
  const geheZurueck = useZurueck('/mpg/vorlagen')

  const verschiebe = (i: number, um: number) => {
    const j = i + um
    if (j < 0 || j >= punkte.length) return
    const a = [...punkte];[a[i], a[j]] = [a[j], a[i]]; setPunkte(a)
  }
  const hinzu = () => { if (neu.trim()) { setPunkte([...punkte, neu.trim()]); setNeu('') } }

  return (
    <>
      <SeitenKopf zurueck="/mpg/vorlagen" titel={typ} unter="Prüfvorlage bearbeiten" />
      <div style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {punkte.map((p, i) => (
            <Karte key={`${i}-${p}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
              <div style={{ flex: 1, fontSize: 14 }}>{p}</div>
              <button aria-label="nach oben" onClick={() => verschiebe(i, -1)} disabled={i === 0} style={{ ...knopfLeise, padding: 6, opacity: i === 0 ? 0.35 : 1 }}>{pik(<polyline points="18 15 12 9 6 15" />, 14)}</button>
              <button aria-label="nach unten" onClick={() => verschiebe(i, 1)} disabled={i === punkte.length - 1} style={{ ...knopfLeise, padding: 6, opacity: i === punkte.length - 1 ? 0.35 : 1 }}>{pik(<polyline points="6 9 12 15 18 9" />, 14)}</button>
              <button aria-label="entfernen" onClick={() => setPunkte(punkte.filter((_, j) => j !== i))} style={{ ...knopfLeise, padding: 6, color: 'var(--lbf-fehler-text)' }}>{pik(ICON.kreuz, 14)}</button>
            </Karte>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') hinzu() }} placeholder="Neuen Prüfpunkt eingeben …" style={{ ...eingabe, flex: 1 }} />
          <button onClick={hinzu} aria-label="Prüfpunkt hinzufügen" style={{ ...knopfVollWenn(!!neu.trim()), padding: '0 14px' }}>{pik(ICON.plus, 16)}</button>
        </div>
        {!punkte.length && <div style={{ ...kursivGrau, color: 'var(--lbf-fehler-text)', marginBottom: 10 }}>Eine Prüfvorlage braucht mindestens einen Prüfpunkt.</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => { if (confirm('Auf die Standardpunkte zurücksetzen?')) setPunkte([...standard]) }} style={{ ...knopfRand, color: 'var(--warm-gray)' }}>Standard</button>
          <button onClick={async () => { if (await m.speichereVorlage(typ, punkte)) geheZurueck() }} disabled={!punkte.length || m.busy} style={{ ...knopfVollWenn(!!punkte.length && !m.busy), flex: 1 }}>
            {m.busy ? 'Speichert…' : 'Speichern'}
          </button>
        </div>
        <div style={{ ...kursivGrau, marginTop: 10 }}>Gilt für Prüfungen, die danach begonnen werden.</div>
      </div>
    </>
  )
}
