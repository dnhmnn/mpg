// Logbuch: alle Prüfungen der Organisation, seitenweise, mit Filtern für Gerät, Zeitraum und Prüfer.
// Die Filter stehen in der Adresse — eine Ansicht lässt sich so weitergeben.

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { pbFehlerText } from '../../lib/pbFehler'
import { useMpg } from './MpgDaten'
import { PruefungEintrag } from './PruefungEintrag'
import { Feld, Leer, SeitenKopf, eingabe, knopfLeise, knopfRand, kursivGrau, useBreit } from './teile'
import type { Inspection } from './typen'

const SEITE = 30

/** Lokaler Tagesbeginn als PocketBase-Zeit (UTC) */
function tagBeginn(tag: string, plus = 0): string {
  const [j, mo, t] = tag.split('-').map(Number)
  return new Date(j, mo - 1, t + plus).toISOString().replace('T', ' ')
}

export default function Logbuch() {
  const m = useMpg()
  const breit = useBreit()
  const [such, setSuch] = useSearchParams()
  const geraet = such.get('geraet') ?? ''
  const von = such.get('von') ?? ''
  const bis = such.get('bis') ?? ''
  const pruefer = such.get('pruefer') ?? ''
  const [liste, setListe] = useState<Inspection[]>([])
  const [gesamt, setGesamt] = useState(0)
  const [seite, setSeite] = useState(1)
  const [mehr, setMehr] = useState(false)
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')

  // Nur die Antwort der neuesten Anfrage zählt (Filter schnell gewechselt, Funkloch)
  const gen = useRef(0)
  const setze = (k: string, v: string) => { const n = new URLSearchParams(such); if (v) n.set(k, v); else n.delete(k); setSuch(n, { replace: true }) }

  async function lade(s: number) {
    if (!m.user?.organization_id) return
    const g = ++gen.current
    if (s === 1) { setListe([]); setMehr(false) }
    setLaedt(true)
    const teile = ['organization_id = {:o}']
    const werte: Record<string, string> = { o: m.user.organization_id }
    if (geraet) { teile.push('device_id = {:g}'); werte.g = geraet }
    if (von) { teile.push('inspection_date >= {:von}'); werte.von = tagBeginn(von) }
    if (bis) { teile.push('inspection_date < {:bis}'); werte.bis = tagBeginn(bis, 1) }
    if (pruefer.trim()) { teile.push('user_name ~ {:p}'); werte.p = pruefer.trim() }
    try {
      const r = await pb.collection('mpg_inspections').getList<Inspection>(s, SEITE, { filter: pb.filter(teile.join(' && '), werte), sort: '-inspection_date', requestKey: null })
      if (g !== gen.current) return
      setListe(l => s === 1 ? r.items : [...l, ...r.items])
      setGesamt(r.totalItems)
      setMehr(r.page < r.totalPages)
      setSeite(s)
      setFehler('')
    } catch (e) {
      if (g === gen.current) setFehler(pbFehlerText(e))
    } finally {
      if (g === gen.current) setLaedt(false)
    }
  }
  useEffect(() => { const t = setTimeout(() => lade(1), pruefer ? 300 : 0); return () => clearTimeout(t) }, [m.user?.organization_id, geraet, von, bis, pruefer])

  const geraete = [...m.devices].sort((a, b) => a.name.localeCompare(b.name, 'de'))
  return (
    <>
      <SeitenKopf zurueck={breit ? undefined : '/mpg/mehr'} titel="Logbuch" unter={laedt && liste.length === 0 ? 'Lädt …' : `${gesamt} ${gesamt === 1 ? 'Prüfung' : 'Prüfungen'}`} />
      <div style={{ display: 'grid', gridTemplateColumns: breit ? '2fr 1fr 1fr 1.4fr' : '1fr 1fr', gap: 10, marginBottom: 16, maxWidth: 900 }}>
        <div style={{ gridColumn: breit ? undefined : '1 / -1' }}>
          <Feld label="Gerät">
            <select value={geraet} onChange={e => setze('geraet', e.target.value)} style={eingabe}>
              <option value="">Alle Geräte</option>
              {geraete.map(d => <option key={d.id} value={d.id}>{d.name}{d.location ? ` · ${d.location}` : ''}</option>)}
            </select>
          </Feld>
        </div>
        <Feld label="Von"><input type="date" value={von} onChange={e => setze('von', e.target.value)} style={eingabe} /></Feld>
        <Feld label="Bis"><input type="date" value={bis} onChange={e => setze('bis', e.target.value)} style={eingabe} /></Feld>
        <div style={{ gridColumn: breit ? undefined : '1 / -1' }}>
          <Feld label="Prüfer"><input value={pruefer} onChange={e => setze('pruefer', e.target.value)} placeholder="Name enthält …" style={eingabe} /></Feld>
        </div>
      </div>
      {(geraet || von || bis || pruefer) && <button onClick={() => setSuch(new URLSearchParams(), { replace: true })} style={{ ...knopfLeise, marginBottom: 12 }}>Filter zurücksetzen</button>}
      {fehler && <div style={{ ...kursivGrau, color: 'var(--lbf-fehler-text)', marginBottom: 10 }}>{fehler} <button onClick={() => lade(1)} style={knopfLeise}>Erneut</button></div>}
      {!laedt && !fehler && liste.length === 0 && <Leer>Keine Prüfungen gefunden</Leer>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 900 }}>
        {liste.map(p => <PruefungEintrag key={p.id} p={p} mitGeraet={!geraet} />)}
      </div>
      {laedt && liste.length > 0 && <div style={{ ...kursivGrau, marginTop: 8 }}>Lädt …</div>}
      {mehr && !laedt && <button onClick={() => lade(seite + 1)} style={{ ...knopfRand, marginTop: 12, width: '100%', maxWidth: 900 }}>Ältere laden</button>}
    </>
  )
}
