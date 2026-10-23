// Prüfrunde an einem Standort: alle Geräte dort, das Dringendste zuerst.
// Nach einer Prüfung geht es hierher zurück.

import { useParams } from 'react-router-dom'
import { STUFEN } from '../../lib/mpg/zustand'
import { kalendertag } from '../../lib/mpg/fristen'
import { useMpg } from './MpgDaten'
import { GeraetKarte } from './GeraetKarte'
import { rundenVon } from './Heute'
import { useLadestand } from './Ladestand'
import { Leer, SeitenKopf } from './teile'
import { rundenPfad } from './typen'

export default function Runde() {
  const { standort = '' } = useParams()
  const m = useMpg()
  const { blocker, banner } = useLadestand()
  if (blocker) return blocker
  const runde = rundenVon(m.bestand).find(r => r.schluessel === standort)
  if (!runde) return <><SeitenKopf zurueck="/mpg" titel="Prüfrunde" /><Leer>An diesem Standort gibt es keine Geräte mehr.</Leer></>
  const geraete = [...runde.geraete].sort((a, b) =>
    STUFEN.indexOf(m.zustand(a).stufe) - STUFEN.indexOf(m.zustand(b).stufe) || a.name.localeCompare(b.name, 'de'))
  const geprueft = runde.geraete.filter(d => kalendertag(d.last_inspection) === m.heute).length
  return (
    <>
      <SeitenKopf zurueck="/mpg" titel={runde.name} unter={`Prüfrunde · ${geprueft} von ${runde.geraete.length} heute geprüft`} />
      {banner}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {geraete.map(d => <GeraetKarte key={d.id} device={d} zurueck={rundenPfad(standort)} />)}
      </div>
    </>
  )
}
