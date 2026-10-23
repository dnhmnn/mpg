// Gerät anlegen oder bearbeiten — als eigene Seite statt im Bottom-Sheet. Braucht „MPG verwalten“;
// was sich ändert, steht im Gerätebuch (alt → neu).

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { INTERVALL_TEXT, INTERVALLE, intervallVon, kalendertag, monateVon, mtkAbweichend, mtkJahre, stkAbweichend, stkMonate, STK_HOECHSTENS } from '../../lib/mpg/fristen'
import { KEIN_VORSCHLAG, vorschlagFuer } from '../../lib/mpg/kontrollen'
import { neueId, type Anfrage } from '../../lib/mpg/schreiben'
import { istAusserBetrieb, kontrolleNichtBestanden, zustandVon } from '../../lib/mpg/zustand'
import { useMpg, type GeraetFelder } from './MpgDaten'
import { useLadestand } from './Ladestand'
import { Feld, Haken, Hinweis, Leer, SeitenKopf, eingabe, knopfRand, knopfVollWenn, kursivGrau, useZurueck } from './teile'
import { DEVICE_TYPES, type Device } from './typen'

function felderVon(d?: Device): GeraetFelder {
  return {
    name: d?.name ?? '', type: d?.type ?? 'AED', serial_number: d?.serial_number ?? '', location: d?.location ?? '',
    interval: intervallVon(d?.interval ?? 'monthly'),
    // Intervalle wie gespeichert — ein Altwert (z. B. 36 Monate) bleibt, solange ihn niemand anfasst
    has_stk: !!d?.has_stk, last_stk: kalendertag(d?.last_stk) ?? '', stk_interval_months: monateVon(d?.stk_interval_months),
    has_mtk: !!d?.has_mtk, last_mtk: kalendertag(d?.last_mtk) ?? '', mtk_interval_months: monateVon(d?.mtk_interval_months),
    inbetriebnahme: kalendertag(d?.inbetriebnahme) ?? '',
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

const ROT = { ...kursivGrau, color: 'var(--lbf-fehler-text)', marginTop: 4 }

function Formular({ device }: { device?: Device }) {
  const m = useMpg()
  const navigate = useNavigate()
  // Stand beim Öffnen: Gesendet wird nur, was sich gegenüber ihm ändert (MpgDaten, speichereGeraet)
  const [ausgang] = useState<GeraetFelder>(() => felderVon(device))
  const [f, setF] = useState<GeraetFelder>(ausgang)
  // Einmal je Formular vergeben: Wer nach einem Funkloch erneut tippt, legt nichts doppelt an.
  // Deshalb ist das Formular nach einem unklaren Speichern fest — erneut gesendet wird genau
  // dieser Stand (sonst ginge eine Korrektur als „schon gespeichert“ verloren).
  const [ids] = useState(() => ({ geraet: neueId(), ereignis: neueId() }))
  const [voriger, setVoriger] = useState<Anfrage[] | undefined>(undefined)
  const unklar = !!voriger
  const set = <K extends keyof GeraetFelder>(k: K, v: GeraetFelder[K]) => setF(x => ({ ...x, [k]: v }))
  // STK-Monate als Text, damit sich die Zahl frei löschen und neu tippen lässt
  const [stkText, setStkText] = useState(() => String(ausgang.stk_interval_months))
  const [begruendung, setBegruendung] = useState('')
  const [ohneNibp, setOhneNibp] = useState(false)
  const zurueck = device ? `/mpg/geraete/${device.id}` : '/mpg/geraete'
  // Vorhandene Standorte vorschlagen — gleich geschrieben ergeben sie eine Prüfrunde
  const standorte = [...new Set(m.bestand.map(d => d.location?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'))
  const typen = [...new Set([...DEVICE_TYPES, ...m.devices.map(d => d.type).filter(Boolean)])]

  // Prüfungen vor dem Speichern
  const zukunft = (t: string) => !!t && t > m.heute
  const stkZahl = Number(stkText)
  const stkFalsch = f.has_stk && !(Number.isInteger(stkZahl) && stkZahl >= 1)
  const datumFalsch = zukunft(f.inbetriebnahme) || (f.has_stk && zukunft(f.last_stk)) || (f.has_mtk && zukunft(f.last_mtk))
  // Was eine Begründung im Gerätebuch braucht: alles, was eine Sperre aus STK/MTK aufhebt —
  // abgeschaltet, Datum gelöscht oder verschoben, Inbetriebnahme geändert. Abgeleitet aus dem
  // Zustand vorher und nachher, nicht aus einer Liste von Feldern.
  const abgeschaltet = !!device && ((ausgang.has_stk && !f.has_stk) || (ausgang.has_mtk && !f.has_mtk))
  const geloescht = !!device && ((f.has_stk && !!ausgang.last_stk && !f.last_stk) || (f.has_mtk && !!ausgang.last_mtk && !f.last_mtk))
  const kontrollSperren = (g: Parameters<typeof zustandVon>[0]) => device
    ? zustandVon(g, m.offeneDefekteVon(device.id), m.offeneMeldungenVon(device.id), m.heute).gruende.filter(x => x.stufe === 'gesperrt' && /STK|MTK/.test(x.text)).map(x => x.text.replace(/seit \d+ Tagen|seit gestern/, ''))
    : []
  const vorherGesperrt = device ? kontrollSperren(m.mitKontrollen(device)) : []
  const nachherGesperrt = device ? kontrollSperren({ ...m.mitKontrollen(device), ...f }) : []
  const hebtAuf = vorherGesperrt.some(t => !nachherGesperrt.includes(t))
  // Nach einer nicht bestandenen Kontrolle gilt eine neue nur mit Eintrag (Prüfer, Protokoll) —
  // das Datum hier darf nicht auf oder nach sie rücken (der Server lehnt es ebenso ab)
  // (unabhängig vom Häkchen — sonst ließe sich die Sperre über „aus, Datum, an“ umgehen)
  const durchgefallen = (a: 'stk' | 'mtk') => !!device && m.buch && kontrolleNichtBestanden({ ...m.mitKontrollen(device), has_stk: true, has_mtk: true }, a, m.heute) ? m.mitKontrollen(device).kontrollen?.[a]?.datum ?? null : null
  const wiederGesperrt = (['stk', 'mtk'] as const).filter(a => !!durchgefallen(a) && (a === 'stk' ? !ausgang.has_stk && f.has_stk : !ausgang.has_mtk && f.has_mtk))
  const vorgezogen = (['stk', 'mtk'] as const).filter(a => { const d = durchgefallen(a); const neu = a === 'stk' ? f.last_stk : f.last_mtk; return !!d && !!neu && neu !== (a === 'stk' ? ausgang.last_stk : ausgang.last_mtk) && neu >= d })
  const brauchtGrund = (abgeschaltet || geloescht || hebtAuf) && m.buch
  const frei = !!f.name.trim() && !datumFalsch && !stkFalsch && !vorgezogen.length && (!brauchtGrund || !!begruendung.trim())

  const geheZurueck = useZurueck(zurueck)
  async function speichern() {
    if ((geloescht || hebtAuf) && !m.buch && !confirm('Diese Änderung hebt eine Sperre aus STK oder MTK auf. Nur, wenn das bisherige Datum falsch war. Trotzdem speichern?')) return
    const r = await m.speichereGeraet(device?.id, f, ids, voriger, { ausgang: device ? ausgang : undefined, begruendung: brauchtGrund ? begruendung.trim() : undefined })
    if (r.unklar) setVoriger(r.unklar)
    if (!r.id) return
    // Bearbeitet: zurück, woher man kam. Neu: das Formular durch das neue Gerät ersetzen.
    if (device) geheZurueck()
    else navigate(`/mpg/geraete/${r.id}`, { replace: true })
  }

  // Vorschlag je Gerätetyp: schaltet nur ein, was er empfiehlt — abschalten tut er nichts
  const vorschlag = vorschlagFuer(f.type)
  const mtkPasst = (soll: number) => f.has_mtk && (mtkJahre(f.mtk_interval_months) * 12 <= soll || (vorschlag?.mtkAuch ?? []).includes(mtkJahre(f.mtk_interval_months) * 12))
  const passtZumVorschlag = !!vorschlag
    && (!vorschlag.stk || (f.has_stk && stkMonate(f.stk_interval_months) <= vorschlag.stk))
    && (!vorschlag.mtk || mtkPasst(vorschlag.mtk))
  function vorschlagUebernehmen() {
    if (!vorschlag) return
    if (vorschlag.stk) setStkText(String(Math.min(stkMonate(f.stk_interval_months), vorschlag.stk)))
    setF(x => ({
      ...x,
      ...(vorschlag.stk ? { has_stk: true, stk_interval_months: Math.min(stkMonate(x.stk_interval_months), vorschlag.stk) } : {}),
      ...(vorschlag.mtk ? { has_mtk: true, mtk_interval_months: vorschlag.mtk } : {}),
    }))
  }
  const nibpFrage = !!vorschlag?.mtkFrage && !f.has_mtk && !ohneNibp

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
        {(m.inbetriebnahmeMoeglich || f.inbetriebnahme) && (
          <Feld label="Inbetriebnahme" hinweis="Ab diesem Tag läuft die Frist für die erste STK und MTK.">
            <input type="date" value={f.inbetriebnahme} max={m.heute} onChange={e => set('inbetriebnahme', e.target.value)} style={eingabe} />
            {zukunft(f.inbetriebnahme) && <div style={ROT}>Das Datum darf nicht in der Zukunft liegen.</div>}
          </Feld>
        )}
        <div style={{ background: 'var(--lbf-card)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: 'var(--lbf-shadow)' }}>
          <div style={{ fontSize: 12, lineHeight: 1.45, padding: '10px 12px', borderRadius: 10, background: 'rgba(var(--lbf-rot-rgb),0.05)' }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{vorschlag ? `Vorschlag für ${f.type}` : 'STK und MTK'}</div>
            <div style={{ fontStyle: 'italic' }}>{vorschlag ? `${vorschlag.hinweis} Bitte mit der Gebrauchsanweisung abgleichen.` : KEIN_VORSCHLAG}</div>
            {nibpFrage && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 700 }}>{vorschlag!.mtkFrage}</div>
                {!device && <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setF(x => ({ ...x, has_mtk: true, mtk_interval_months: 24 }))} style={{ ...knopfRand, padding: '6px 12px', fontSize: 12 }}>Ja — MTK alle 2 Jahre</button>
                  <button type="button" onClick={() => setOhneNibp(true)} style={{ ...knopfRand, padding: '6px 12px', fontSize: 12, color: 'var(--warm-gray)' }}>Nein</button>
                </div>}
              </div>
            )}
            {vorschlag && (vorschlag.stk || vorschlag.mtk) && !passtZumVorschlag && (
              <button type="button" onClick={vorschlagUebernehmen} style={{ ...knopfRand, marginTop: 8, padding: '6px 12px', fontSize: 12 }}>Vorschlag übernehmen</button>
            )}
          </div>
          <Haken an={f.has_stk} setAn={b => set('has_stk', b)} titel="STK erforderlich" text="Sicherheitstechnische Kontrolle — fällig mit Ablauf des Monats, spätestens alle 24 Monate" />
          {f.has_stk && (
            <div style={{ display: 'flex', gap: 10, paddingLeft: 32, flexWrap: 'wrap' }}>
              <Feld label="Monate" hinweis="Kürzer, wenn der Hersteller es vorgibt oder die Einsatzbedingungen (Fahrzeug, Erschütterung, Kälte, Hitze) es nahelegen.">
                <input type="number" inputMode="numeric" min={1} max={STK_HOECHSTENS} value={stkText}
                  onChange={e => { setStkText(e.target.value); const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1) set('stk_interval_months', Math.min(STK_HOECHSTENS, n)) }}
                  onBlur={() => { if (!stkFalsch && stkText !== String(ausgang.stk_interval_months)) { const n = stkMonate(stkZahl); setStkText(String(n)); set('stk_interval_months', n) } }} style={{ ...eingabe, width: 90 }} />
                {stkFalsch && <div style={ROT}>Bitte 1 bis 24 Monate eintragen.</div>}
                {!stkFalsch && stkZahl > STK_HOECHSTENS && stkText !== String(ausgang.stk_interval_months) && <div style={ROT}>Höchstens 24 Monate — wird auf 24 gesetzt.</div>}
                {!stkFalsch && stkAbweichend(f.stk_interval_months) && stkText === String(ausgang.stk_interval_months) && <div style={ROT}>Eingetragen: {monateVon(f.stk_interval_months)} Monate — höchstens 24 sind zulässig, gerechnet wird mit 24.</div>}
              </Feld>
              <Feld label="Letzte STK" hinweis={m.buch ? 'Nur für den Altbestand — neue STK am Gerät eintragen.' : 'Datum der letzten bestandenen STK.'}>
                <input type="date" value={f.last_stk} max={m.heute} onChange={e => set('last_stk', e.target.value)} style={eingabe} />
                {zukunft(f.last_stk) && <div style={ROT}>Das Datum darf nicht in der Zukunft liegen.</div>}
                {vorgezogen.includes('stk') && <div style={ROT}>Die letzte STK ist nicht bestanden — eine neue STK bitte am Gerät über „Eintragen“ mit Prüfer und Protokoll erfassen.</div>}
              </Feld>
            </div>
          )}
          <Haken an={f.has_mtk} setAn={b => set('has_mtk', b)} titel="MTK erforderlich" text="Messtechnische Kontrolle — fällig mit Ablauf des Jahres (31.12.), spätestens alle 2 Jahre" />
          {f.has_mtk && (
            <div style={{ display: 'flex', gap: 10, paddingLeft: 32, flexWrap: 'wrap' }}>
              <Feld label="Wie oft">
                <select value={mtkAbweichend(f.mtk_interval_months) ? 'eingetragen' : mtkJahre(f.mtk_interval_months)} onChange={e => set('mtk_interval_months', Number(e.target.value) * 12)} style={{ ...eingabe, width: 200, maxWidth: '100%' }}>
                  {/* Altwert (z. B. 18 Monate): als eigene Zeile, damit sich „jährlich“ wählen lässt */}
                  {mtkAbweichend(f.mtk_interval_months) && <option value="eingetragen" disabled>{monateVon(f.mtk_interval_months)} Monate (alt)</option>}
                  <option value={1}>jährlich</option>
                  <option value={2}>alle 2 Jahre</option>
                </select>
                {mtkAbweichend(f.mtk_interval_months) && <div style={ROT}>Eingetragen: {monateVon(f.mtk_interval_months)} Monate — gerechnet wird {mtkJahre(f.mtk_interval_months) === 1 ? 'jährlich' : 'alle 2 Jahre'}. Bitte festlegen.</div>}
              </Feld>
              <Feld label="Letzte MTK" hinweis={m.buch ? 'Nur für den Altbestand — neue MTK am Gerät eintragen.' : 'Datum der letzten bestandenen MTK.'}>
                <input type="date" value={f.last_mtk} max={m.heute} onChange={e => set('last_mtk', e.target.value)} style={eingabe} />
                {zukunft(f.last_mtk) && <div style={ROT}>Das Datum darf nicht in der Zukunft liegen.</div>}
                {vorgezogen.includes('mtk') && <div style={ROT}>Die letzte MTK ist nicht bestanden — eine neue MTK bitte am Gerät über „Eintragen“ mit Prüfer und Protokoll erfassen.</div>}
              </Feld>
            </div>
          )}
          {(f.has_stk || f.has_mtk) && !m.inbetriebnahmeMoeglich && !f.inbetriebnahme && (
            <div style={kursivGrau}>In PocketBase fehlt noch das Feld „inbetriebnahme“ (Datum) an mpg_devices — bis dahin zählt die erste Frist erst ab einer eingetragenen Kontrolle.</div>
          )}
        </div>
        {brauchtGrund && (
          <Feld label="Begründung *" hinweis="Steht im Gerätebuch.">
            <textarea value={begruendung} onChange={e => setBegruendung(e.target.value)} rows={2}
              placeholder={abgeschaltet ? 'Warum entfällt die Kontrolle? z. B. Ausnahme Laien-AED, bestätigt durch …' : 'Warum ändert sich das Datum? z. B. falsch eingetragen'}
              style={{ ...eingabe, resize: 'vertical' }} />
          </Feld>
        )}
        {hebtAuf
          ? <Hinweis ton="warn">Diese Änderung hebt eine Sperre aus STK oder MTK auf ({vorherGesperrt.filter(t => !nachherGesperrt.includes(t)).map(t => t.trim()).join(', ')}). Nur, wenn das bisherige Datum falsch war — eine neue Kontrolle am Gerät über „Eintragen“ erfassen.</Hinweis>
          : geloescht && <Hinweis>Ohne Datum der letzten Kontrolle zählt die Frist ab der Inbetriebnahme — oder sie bleibt offen.</Hinweis>}
        {wiederGesperrt.length > 0 && <Hinweis ton="warn">Die letzte {wiederGesperrt.map(a => a.toUpperCase()).join(' und ')} ist nicht bestanden — mit dem Häkchen wird das Gerät wieder gesperrt, bis eine bestandene eingetragen ist.</Hinweis>}
        </fieldset>
        {unklar && !m.busy && <Hinweis>Ob das gespeichert wurde, ist unklar. „Erneut senden“ schickt genau diesen Stand und legt nichts doppelt an. Für eine Änderung erst abbrechen und das Gerät neu öffnen.</Hinweis>}
        {!device && <div style={kursivGrau}>Ein neues Gerät steht auf „Erstprüfung offen“, bis es zum ersten Mal geprüft ist.</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={geheZurueck} disabled={m.busy} style={{ ...knopfRand, flex: 1, color: 'var(--warm-gray)' }}>Abbrechen</button>
          <button onClick={speichern} disabled={(!frei && !unklar) || m.busy} style={{ ...knopfVollWenn((frei || unklar) && !m.busy), flex: 2 }}>
            {m.busy ? 'Speichert…' : unklar ? 'Erneut senden' : device ? 'Speichern' : 'Anlegen'}
          </button>
        </div>
      </div>
    </>
  )
}
