// Die kurzen Dialoge des MPG — als ein Blatt, von jeder Seite aus zu öffnen
// (useMpg().setBlatt). Die Schreibwege sind die aus Paket 1: genau einmal, unklare
// Versuche festgeschrieben und nur unverändert erneut gesendet.

import { useState } from 'react'
import { sperrtDefekt } from '../../lib/mpg/zustand'
import { pruefungNichtBestanden } from '../../lib/mpg/zustand'
import { planeBeheben, planeBestaetigung, planeDefekt } from '../../lib/mpg/aktionen'
import { neueId, pbOptionen } from '../../lib/mpg/schreiben'
import { pb } from '../../lib/pocketbase'
import { pbFehlerText } from '../../lib/pbFehler'
import { altenVersuchSenden, ohne, useMpg, type DefektFormular } from './MpgDaten'
import { Blatt, Feld, Haken, Hinweis, eingabe, knopfRand, knopfVollWenn, kursivGrau } from './teile'
import { SCHWERE_NAME, type Defect, type Device, type ExternalReport, type Severity } from './typen'

export function Blaetter() {
  const { blatt } = useMpg()
  if (!blatt) return null
  switch (blatt.art) {
    case 'defekt': return <DefektMelden key={blatt.device.id} device={blatt.device} />
    case 'beheben': return <DefektBeheben key={blatt.defekt.id} defekt={blatt.defekt} />
    case 'bestaetigen': return <MeldungBestaetigen key={blatt.meldung.id} meldung={blatt.meldung} />
    case 'ablehnen': return <MeldungAblehnen key={blatt.meldung.id} meldung={blatt.meldung} />
  }
}

function KnopfZeile({ abbrechen, abbrechenText = 'Abbrechen', los, losText, frei, gefahr }: {
  abbrechen: () => void; abbrechenText?: string; los: () => void; losText: string; frei: boolean; gefahr?: boolean
}) {
  const { busy } = useMpg()
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
      <button onClick={abbrechen} disabled={busy} style={{ ...knopfRand, flex: 1, color: 'var(--warm-gray)' }}>{abbrechenText}</button>
      <button onClick={los} disabled={!frei || busy} style={{ ...knopfVollWenn(frei && !busy, gefahr ? '#dc2626' : undefined), flex: 2 }}>
        {busy ? 'Speichert…' : losText}
      </button>
    </div>
  )
}

// ── Defekt melden ─────────────────────────────────────────────────────────

function DefektMelden({ device }: { device: Device }) {
  const m = useMpg()
  const [form, setForm] = useState<DefektFormular>(() =>
    m.unklarerDefekt(device.id) ?? { description: '', severity: 'medium', sperren: false, id: neueId(), unklar: false })
  const schliessen = () => m.setBlatt(null)

  function verwerfen() {
    m.aendereUnklar(u => ({ ...u, defekte: ohne(u.defekte, device.id) }))
    schliessen()
  }

  async function melden() {
    if (!form.description.trim()) { m.showMsg('Beschreibung fehlt', 'error'); return }
    // Hoch/kritisch sperrt ohnehin — dann auch als nicht einsatzbereit markieren
    const sperren = form.sperren || sperrtDefekt(form.severity)
    const anfragen = planeDefekt({ geraet: device, beschreibung: form.description, schwere: form.severity, sperren, wer: m.wer(), id: form.id })
    // Wiederholung: ist der Defekt (Anker, zuletzt geschrieben) schon da, ist alles angekommen
    if (form.unklar) {
      if (!altenVersuchSenden(form.seit)) return
      const r = await m.mitSperre(() => m.gibtEs('mpg_defects', form.id))
      if (!r.ok) return
      if (r.wert) {
        m.aendereUnklar(u => ({ ...u, defekte: ohne(u.defekte, device.id) }))
        m.showMsg('War bereits gespeichert')
        schliessen()
        Promise.all([m.loadDefects(), m.loadDevices()]).catch(() => undefined)
        return
      }
    }
    // Inhalt vor dem Senden festschreiben: erneut gesendet wird genau diese Meldung mit derselben ID
    const f = { ...form, unklar: true, seit: form.seit ?? new Date().toISOString() }
    m.aendereUnklar(u => ({ ...u, defekte: { ...u.defekte, [device.id]: f } }))
    const r = await m.ausfuehren(anfragen, sperren ? 'Defekt gemeldet — Gerät gesperrt' : 'Defekt gemeldet')
    if (r === 'ok') {
      m.aendereUnklar(u => ({ ...u, defekte: ohne(u.defekte, device.id) }))
      schliessen()
      Promise.all([m.loadDefects(), m.loadDevices()]).catch(() => undefined)
    } else if (r === 'unklar') {
      setForm(f)
    } else if (!form.unklar) {
      // Sicher abgelehnt: nichts geschrieben, Formular bleibt änderbar
      m.aendereUnklar(u => ({ ...u, defekte: ohne(u.defekte, device.id) }))
    }
  }

  const fest = form.unklar || m.busy
  return (
    <Blatt ueber={device.type} titel={`Mangel melden: ${device.name}`} onClose={schliessen} gesperrt={m.busy}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Feld label="Beschreibung *">
          <textarea autoFocus value={form.description} readOnly={fest} rows={4}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Was genau ist defekt? Wie macht sich der Fehler bemerkbar?" style={{ ...eingabe, resize: 'vertical' }} />
        </Feld>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--lbf-akzent)', marginBottom: 6 }}>Schweregrad</div>
          <div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(Object.keys(SCHWERE_NAME) as Severity[]).map(s => {
              const an = form.severity === s
              return (
                <button key={s} type="button" role="radio" aria-checked={an} disabled={fest} onClick={() => setForm({ ...form, severity: s })} style={{
                  padding: '11px 10px', borderRadius: 10, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: fest ? 'default' : 'pointer',
                  border: `1.5px solid ${an ? (sperrtDefekt(s) ? '#dc2626' : 'var(--lbf-akzent)') : 'var(--lbf-border)'}`,
                  background: an ? (sperrtDefekt(s) ? 'var(--lbf-fehler-grund)' : 'rgba(var(--lbf-rot-rgb),0.06)') : 'transparent',
                  color: sperrtDefekt(s) ? 'var(--lbf-fehler-text)' : 'var(--lbf-akzent)',
                }}>{SCHWERE_NAME[s]}</button>
              )
            })}
          </div>
        </div>
        {sperrtDefekt(form.severity)
          ? <Hinweis ton="warn">Bei „{SCHWERE_NAME[form.severity]}“ wird das Gerät gesperrt, bis der Defekt behoben ist.</Hinweis>
          : <Haken an={form.sperren} setAn={b => setForm({ ...form, sperren: b })} gesperrt={fest} titel="Gerät sperren" text="Als nicht einsatzbereit markieren" />}
        {form.unklar && !m.busy && <Hinweis>Ob diese Meldung gespeichert wurde, ist unklar. Erneut senden legt sie nicht doppelt an.</Hinweis>}
        <KnopfZeile abbrechen={form.unklar ? verwerfen : schliessen} abbrechenText={form.unklar ? 'Verwerfen' : 'Abbrechen'}
          los={melden} losText={form.unklar ? 'Erneut senden' : 'Mangel melden'} frei={!!form.description.trim()} gefahr />
      </div>
    </Blatt>
  )
}

// ── Defekt beheben ────────────────────────────────────────────────────────

function DefektBeheben({ defekt }: { defekt: Defect }) {
  const m = useMpg()
  const [notiz, setNotiz] = useState('')
  const [wieder, setWieder] = useState(false)
  const geraet = m.devices.find(d => d.id === defekt.device_id)
  const weitere = geraet ? m.offeneDefekteVon(geraet.id).filter(d => d.id !== defekt.id) : []
  const weitereSperrend = weitere.filter(d => sperrtDefekt(d.severity)).length

  async function beheben() {
    const anfragen = planeBeheben({ defekt, notiz, wer: m.wer(), wiederEinsatzbereit: wieder })
    if (await m.ausfuehren(anfragen, wieder ? 'Defekt behoben — Gerät wieder einsatzbereit' : 'Defekt als behoben markiert') === 'ok') {
      m.setBlatt(null)
      Promise.all([m.loadDefects(), m.loadDevices()]).catch(() => undefined)
    }
  }

  return (
    <Blatt titel="Defekt beheben" ueber={defekt.device_name} onClose={() => m.setBlatt(null)} gesperrt={m.busy}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ ...kursivGrau, fontSize: 13 }}>{defekt.description}</div>
        <Feld label="Was wurde gemacht? (optional)">
          <textarea value={notiz} onChange={e => setNotiz(e.target.value)} rows={3} readOnly={m.busy}
            placeholder="Ersatzteil, Reparatur, Austausch …" style={{ ...eingabe, resize: 'vertical' }} />
        </Feld>
        {geraet && geraet.operational === false && (weitereSperrend
          ? <Hinweis>Das Gerät bleibt gesperrt: {weitereSperrend === 1 ? 'ein weiterer Defekt' : `${weitereSperrend} weitere Defekte`} „hoch“ oder „kritisch“ offen.</Hinweis>
          : <Haken an={wieder} setAn={setWieder} gesperrt={m.busy} titel="Gerät wieder einsatzbereit" text={[
              weitere.length ? `Noch ${weitere.length === 1 ? 'ein Mangel' : `${weitere.length} Mängel`} offen.` : '',
              pruefungNichtBestanden(geraet) ? 'Die letzte Prüfung ist nicht bestanden — gesperrt bleibt es, bis eine Prüfung bestanden ist.' : 'Hebt die Sperre auf.',
            ].filter(Boolean).join(' ')} />)}
        <KnopfZeile abbrechen={() => m.setBlatt(null)} los={beheben} losText="Als behoben markieren" frei />
      </div>
    </Blatt>
  )
}

// ── Meldung von außen bestätigen ──────────────────────────────────────────

function MeldungBestaetigen({ meldung }: { meldung: ExternalReport }) {
  const m = useMpg()
  // Ging eine Bestätigung unklar aus, wird genau sie erneut gesendet
  const [versuch, setVersuch] = useState(() => m.unklareBestaetigung(meldung.id))
  const [anmerkung, setAnmerkung] = useState(versuch?.anmerkung ?? '')
  const [sperren, setSperren] = useState(versuch?.sperren ?? sperrtDefekt(meldung.severity))
  const geraetGeladen = m.devices.some(d => d.id === meldung.device_id)

  async function bestaetigen() {
    if (versuch && !altenVersuchSenden(versuch.seit)) return
    const vorab = await m.mitSperre(async () => {
      const offen = await m.meldungNochOffen(meldung.id)
      // Ob es das Gerät noch gibt, sagt der Server — die Liste ist vielleicht nicht geladen
      const geraetDa = offen ? await m.gibtEs('mpg_devices', meldung.device_id) : true
      return { offen, geraetDa }
    })
    if (!vorab.ok || !vorab.wert.offen) { Promise.all([m.loadExternalReports(), m.loadDefects(), m.loadDevices()]).catch(() => undefined); return }
    const stand = versuch ?? { anmerkung, sperren: sperren || sperrtDefekt(meldung.severity), seit: new Date().toISOString() }
    // Der Defekt trägt die ID der Meldung: Eine Meldung kann so nur einen Defekt erzeugen,
    // auch nach Neuladen, erneutem Öffnen oder von einem zweiten Gerät aus
    const anfragen = planeBestaetigung({ meldung, anmerkung: stand.anmerkung, sperren: stand.sperren, geraetDa: vorab.wert.geraetDa, wer: m.wer(), defektId: meldung.id })
    m.aendereUnklar(u => ({ ...u, bestaetigungen: { ...u.bestaetigungen, [meldung.id]: stand } }))
    const gesperrt = anfragen.some(a => a.collection === 'mpg_devices')
    const r = await m.ausfuehren(anfragen, gesperrt ? 'Meldung bestätigt — Defekt angelegt, Gerät gesperrt' : 'Meldung bestätigt — Defekt angelegt')
    if (r === 'ok' || (r !== 'unklar' && !versuch)) m.aendereUnklar(u => ({ ...u, bestaetigungen: ohne(u.bestaetigungen, meldung.id) }))
    if (r === 'ok') {
      m.setBlatt(null)
      m.loadAll()
    } else if (r === 'unklar') {
      setVersuch(stand)
    }
  }

  const fest = !!versuch || m.busy
  return (
    <Blatt ueber="Meldung bestätigen" titel={meldung.device_name} onClose={() => m.setBlatt(null)} gesperrt={m.busy}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 14, color: 'var(--lbf-text)', lineHeight: 1.5 }}>{meldung.description}</div>
          <div style={{ ...kursivGrau, marginTop: 4 }}>Gemeldet von {meldung.reporter_name || 'Anonym'}</div>
        </div>
        <Feld label="Anmerkung (optional)">
          <textarea value={anmerkung} readOnly={fest} onChange={e => setAnmerkung(e.target.value)} rows={3}
            placeholder="z. B. Gerät gesichtet, Ersatz auf RTW 2 gelegt …" style={{ ...eingabe, resize: 'vertical' }} />
        </Feld>
        {m.geraeteGeladen && !geraetGeladen
          ? <Hinweis>Das Gerät gibt es nicht mehr — es wird nur der Defekt-Eintrag angelegt.</Hinweis>
          : sperrtDefekt(meldung.severity)
            ? <Hinweis ton="warn">Ein Defekt-Eintrag wird angelegt. Bei „{SCHWERE_NAME[meldung.severity]}“ wird das Gerät gesperrt, bis der Defekt behoben ist.</Hinweis>
            : <Haken an={sperren} setAn={setSperren} gesperrt={fest} titel="Gerät sperren" text="Als nicht einsatzbereit markieren. Ein Defekt-Eintrag wird in jedem Fall angelegt." />}
        {versuch && !m.busy && <Hinweis>Ob diese Bestätigung gespeichert wurde, ist unklar. Erneut senden legt den Defekt nicht doppelt an.</Hinweis>}
        <KnopfZeile abbrechen={() => m.setBlatt(null)} abbrechenText={versuch ? 'Schließen' : 'Abbrechen'}
          los={bestaetigen} losText={versuch ? 'Erneut senden' : 'Bestätigen & Defekt anlegen'} frei />
      </div>
    </Blatt>
  )
}

// ── Meldung ablehnen ──────────────────────────────────────────────────────

function MeldungAblehnen({ meldung }: { meldung: ExternalReport }) {
  const m = useMpg()
  const [grund, setGrund] = useState('')

  async function ablehnen() {
    const id = meldung.id
    const r = await m.mitSperre(async () => {
      if (!await m.meldungNochOffen(id)) return 'erledigt'
      // Eine Bestätigung kann schon teilweise angekommen sein (Defekt mit der ID der Meldung)
      if (await m.gibtEs('mpg_defects', id)) return 'teilweise'
      await pb.collection('mpg_defect_reports').update(id, { status: 'rejected', rejected_reason: grund.trim() }, pbOptionen())
      return 'abgelehnt'
    })
    if (r.ok && r.wert === 'teilweise') {
      m.showMsg('Zu dieser Meldung ist schon ein Defekt angelegt — die Bestätigung ist teilweise gespeichert. Bitte die Bestätigung erneut senden statt abzulehnen.', 'error')
      m.setBlatt(null)
    } else if (r.ok && r.wert === 'abgelehnt') {
      if (m.unklareBestaetigung(id)) m.aendereUnklar(u => ({ ...u, bestaetigungen: ohne(u.bestaetigungen, id) }))
      m.setBlatt(null)
      m.showMsg('Meldung abgelehnt')
    }
    Promise.all([m.loadExternalReports(), m.loadDefects(), m.loadDevices()]).catch(() => undefined)
  }

  return (
    <Blatt ueber="Meldung ablehnen" titel={meldung.device_name} onClose={() => m.setBlatt(null)} gesperrt={m.busy}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ ...kursivGrau, fontSize: 13 }}>{meldung.description}</div>
        <Feld label="Grund (optional)">
          <textarea value={grund} onChange={e => setGrund(e.target.value)} rows={3} readOnly={m.busy}
            placeholder="z. B. falsches Gerät angegeben, kein Defekt …" style={{ ...eingabe, resize: 'vertical' }} />
        </Feld>
        <KnopfZeile abbrechen={() => m.setBlatt(null)} los={ablehnen} losText="Ablehnen" frei gefahr />
      </div>
    </Blatt>
  )
}

