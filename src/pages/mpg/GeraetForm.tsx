// Gerät anlegen oder bearbeiten — als eigene Seite statt im Bottom-Sheet. Braucht „MPG verwalten“;
// was sich ändert, steht im Gerätebuch (alt → neu).

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { INTERVALL_TEXT, INTERVALLE, intervallVon, kalendertag } from '../../lib/mpg/fristen'
import { neueId, type Anfrage } from '../../lib/mpg/schreiben'
import { istAusserBetrieb } from '../../lib/mpg/zustand'
import { useMpg, type GeraetFelder } from './MpgDaten'
import { useLadestand } from './Ladestand'
import { Feld, Haken, Hinweis, Leer, SeitenKopf, eingabe, knopfRand, knopfVollWenn, kursivGrau, useZurueck } from './teile'
import { DEVICE_TYPES, type Device } from './typen'

function felderVon(d?: Device): GeraetFelder {
  return {
    name: d?.name ?? '', type: d?.type ?? 'AED', serial_number: d?.serial_number ?? '', location: d?.location ?? '',
    interval: intervallVon(d?.interval ?? 'monthly'),
    has_stk: !!d?.has_stk, last_stk: kalendertag(d?.last_stk) ?? '', stk_interval_months: d?.stk_interval_months || 24,
    has_mtk: !!d?.has_mtk, last_mtk: kalendertag(d?.last_mtk) ?? '', mtk_interval_months: d?.mtk_interval_months || 24,
  }
}

export default function GeraetForm() {
  const { id } = useParams()
  const m = useMpg()
  const { blocker } = useLadestand()
  if (blocker) return blocker
  const device = id ? m.devices.find(d => d.id === id) : undefined
  if (id && !device) return <><SeitenKopf zurueck="/mpg/geraete" titel="Gerät nicht gefunden" /><Leer>Dieses Gerät gibt es nicht (mehr).</Leer></>
  const titel = device ? 'Gerät bearbeiten' : 'Neues Gerät'
  const zurueck = device ? `/mpg/geraete/${device.id}` : '/mpg/geraete'
  if (!m.darfVerwalten) {
    return <><SeitenKopf zurueck={zurueck} titel={titel} /><Hinweis>Geräte anlegen und ändern braucht das Recht „MPG verwalten“ (Admin, MPG-Beauftragte oder freigeschaltet in der Benutzerverwaltung).</Hinweis></>
  }
  if (device && istAusserBetrieb(device)) {
    return <><SeitenKopf zurueck={zurueck} titel={titel} unter={device.name} /><Hinweis>Das Gerät ist außer Betrieb genommen. Zum Ändern erst wieder in Betrieb nehmen.</Hinweis></>
  }
  return <Formular key={id ?? 'neu'} device={device} />
}

function Formular({ device }: { device?: Device }) {
  const m = useMpg()
  const navigate = useNavigate()
  const [f, setF] = useState<GeraetFelder>(() => felderVon(device))
  // Einmal je Formular vergeben: Wer nach einem Funkloch erneut tippt, legt nichts doppelt an.
  // Deshalb ist das Formular nach einem unklaren Speichern fest — erneut gesendet wird genau
  // dieser Stand (sonst ginge eine Korrektur als „schon gespeichert“ verloren).
  const [ids] = useState(() => ({ geraet: neueId(), ereignis: neueId() }))
  const [voriger, setVoriger] = useState<Anfrage[] | undefined>(undefined)
  const unklar = !!voriger
  const set = <K extends keyof GeraetFelder>(k: K, v: GeraetFelder[K]) => setF(x => ({ ...x, [k]: v }))
  const zurueck = device ? `/mpg/geraete/${device.id}` : '/mpg/geraete'
  // Vorhandene Standorte vorschlagen — gleich geschrieben ergeben sie eine Prüfrunde
  const standorte = [...new Set(m.bestand.map(d => d.location?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'))
  const typen = [...new Set([...DEVICE_TYPES, ...m.devices.map(d => d.type).filter(Boolean)])]

  const geheZurueck = useZurueck(zurueck)
  async function speichern() {
    const r = await m.speichereGeraet(device?.id, f, ids, voriger)
    if (r.unklar) setVoriger(r.unklar)
    if (!r.id) return
    // Bearbeitet: zurück, woher man kam. Neu: das Formular durch das neue Gerät ersetzen.
    if (device) geheZurueck()
    else navigate(`/mpg/geraete/${r.id}`, { replace: true })
  }

  const frei = !!f.name.trim()
  return (
    <>
      <SeitenKopf zurueck={zurueck} titel={device ? 'Gerät bearbeiten' : 'Neues Gerät'} unter={device?.name} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
        <fieldset disabled={unklar || m.busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label="Bezeichnung *">
          <input autoFocus value={f.name} onChange={e => set('name', e.target.value)} placeholder="z. B. Defi RTW 1" style={eingabe} />
        </Feld>
        <Feld label="Gerätetyp *" hinweis="Bestimmt die Prüfvorlage.">
          <select value={f.type} onChange={e => set('type', e.target.value)} style={eingabe}>
            {typen.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Feld>
        <Feld label="Seriennummer">
          <input value={f.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="Optional" style={eingabe} />
        </Feld>
        <Feld label="Standort" hinweis="Fahrzeug oder Raum — gleich geschriebene Standorte bilden eine Prüfrunde.">
          <input value={f.location} onChange={e => set('location', e.target.value)} list="mpg-standorte" placeholder="z. B. RTW 1" style={eingabe} />
          <datalist id="mpg-standorte">{standorte.map(s => <option key={s} value={s} />)}</datalist>
        </Feld>
        <Feld label="Prüfintervall *">
          <select value={f.interval} onChange={e => set('interval', intervallVon(e.target.value))} style={eingabe}>
            {INTERVALLE.map(v => <option key={v} value={v}>{INTERVALL_TEXT[v]}</option>)}
          </select>
        </Feld>
        <div style={{ background: 'var(--lbf-card)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: 'var(--lbf-shadow)' }}>
          <Haken an={f.has_stk} setAn={b => set('has_stk', b)} titel="STK erforderlich" text="Sicherheitstechnische Kontrolle — fällig mit Ablauf des Monats" />
          {f.has_stk && (
            <div style={{ display: 'flex', gap: 10, paddingLeft: 32 }}>
              <Feld label="Letzte STK"><input type="date" value={f.last_stk} onChange={e => set('last_stk', e.target.value)} style={eingabe} /></Feld>
              <Feld label="Monate"><input type="number" min={1} max={120} value={f.stk_interval_months} onChange={e => set('stk_interval_months', Number(e.target.value))} style={{ ...eingabe, width: 90 }} /></Feld>
            </div>
          )}
          <Haken an={f.has_mtk} setAn={b => set('has_mtk', b)} titel="MTK erforderlich" text="Messtechnische Kontrolle" />
          {f.has_mtk && (
            <div style={{ display: 'flex', gap: 10, paddingLeft: 32 }}>
              <Feld label="Letzte MTK"><input type="date" value={f.last_mtk} onChange={e => set('last_mtk', e.target.value)} style={eingabe} /></Feld>
              <Feld label="Monate"><input type="number" min={1} max={120} value={f.mtk_interval_months} onChange={e => set('mtk_interval_months', Number(e.target.value))} style={{ ...eingabe, width: 90 }} /></Feld>
            </div>
          )}
        </div>
        </fieldset>
        {unklar && !m.busy && <Hinweis>Ob das gespeichert wurde, ist unklar. „Erneut senden“ schickt genau diesen Stand und legt nichts doppelt an. Für eine Änderung erst abbrechen und das Gerät neu öffnen.</Hinweis>}
        {!device && <div style={kursivGrau}>Ein neues Gerät steht auf „Erstprüfung offen“, bis es zum ersten Mal geprüft ist.</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={geheZurueck} disabled={m.busy} style={{ ...knopfRand, flex: 1, color: 'var(--warm-gray)' }}>Abbrechen</button>
          <button onClick={speichern} disabled={!frei || m.busy} style={{ ...knopfVollWenn(frei && !m.busy), flex: 2 }}>
            {m.busy ? 'Speichert…' : unklar ? 'Erneut senden' : device ? 'Speichern' : 'Anlegen'}
          </button>
        </div>
      </div>
    </>
  )
}
