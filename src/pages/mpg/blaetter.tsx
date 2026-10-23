// Die kurzen Dialoge des MPG — als ein Blatt, von jeder Seite aus zu öffnen
// (useMpg().setBlatt). Die Schreibwege sind die aus Paket 1: genau einmal, unklare
// Versuche festgeschrieben und nur unverändert erneut gesendet.

import { useState } from 'react'
import { istAusserBetrieb, pruefungNichtBestanden, sperrtDefekt } from '../../lib/mpg/zustand'
import {
  planeAusserBetrieb, planeBeheben, planeBestaetigung, planeDefekt, planeFreigabe, planeSperre, planeVermerk, planeWiederInBetrieb,
} from '../../lib/mpg/aktionen'
import { kalendertag, plusMonate, tagText } from '../../lib/mpg/fristen'
import { darfBeheben } from '../../lib/mpg/rechte'
import { batchIstAus, neueId, pbOptionen, type Anfrage } from '../../lib/mpg/schreiben'
import { pb } from '../../lib/pocketbase'
import { pbFehlerText } from '../../lib/pbFehler'
import { altenVersuchSenden, ohne, useMpg, type BlattVersuch, type DefektFormular } from './MpgDaten'
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
    case 'sperren': return <Sperren key={blatt.device.id} device={blatt.device} />
    case 'freigeben': return <Freigeben key={blatt.device.id} device={blatt.device} />
    case 'ausserBetrieb': return <AusserBetrieb key={blatt.device.id} device={blatt.device} />
    case 'wiederInBetrieb': return <WiederInBetrieb key={blatt.device.id} device={blatt.device} />
    case 'vermerk': return <Vermerk key={blatt.device.id + (blatt.bezug?.id ?? '')} device={blatt.device} bezug={blatt.bezug} />
  }
}

/**
 * Nach einem unklaren Speichern (keine Antwort) ist das Blatt fest: erneut gesendet wird genau
 * der gesendete Plan mit denselben Kennungen — eine Änderung ginge sonst als „schon
 * gespeichert“ verloren, und ein inzwischen geänderter Stand (Gerätebuch da oder nicht,
 * Recht abgelaufen) baute einen anderen Plan.
 */
/**
 * Der unklare Versuch eines Blatts: bleibt nach Schließen und Neuladen erhalten (MpgDaten,
 * Unklar), damit ein erneutes Öffnen nicht mit einem frischen Plan ohne Prüfung sendet.
 */
function useBlattVersuch(schluessel: string) {
  const m = useMpg()
  const [versuch, setVersuch] = useState<BlattVersuch | null>(() => m.blattVersuch(schluessel))
  const [id] = useState(() => versuch?.id ?? neueId())
  const merke = (v: BlattVersuch | null) => { setVersuch(v); m.merkeBlattVersuch(schluessel, v) }
  /** Nach dem ersten Senden festhalten: genau dieser Plan, die Serverzeit des Geräts davor */
  const unklarNach = (anfragen: Anfrage[], geraetId: string) => merke(versuch ?? {
    anfragen, id, seit: new Date().toISOString(), updatedVorher: m.devices.find(d => d.id === geraetId)?.updated ?? '', einzeln: batchIstAus(),
  })
  return { versuch, id, merke, unklarNach }
}

/** Text des Gerätebuch-Eintrags aus einem festgehaltenen Plan (zum Anzeigen nach dem Wiederöffnen) */
const eintragText = (v: BlattVersuch | null) => String(v?.anfragen.find(a => a.collection === 'mpg_ereignisse')?.body.text ?? '')
const geraetWert = (v: BlattVersuch | null, feld: string) => String(v?.anfragen.find(a => a.collection === 'mpg_devices' && feld in a.body)?.body[feld] ?? '')

/** Einen unklaren Versuch verwerfen — er kann angekommen sein, deshalb nachfragen. */
function verwerfen(merke: (v: BlattVersuch | null) => void, schliessen: () => void) {
  if (!confirm('Ob dieser Vorgang angekommen ist, ist unklar. Verwerfen? Danach bitte den Stand des Geräts prüfen.')) return
  merke(null)
  schliessen()
}

function UnklarHinweis() {
  return <Hinweis>Ob das gespeichert wurde, ist unklar. „Erneut senden“ schickt genau diesen Stand und legt nichts doppelt an.</Hinweis>
}

/** Ohne „MPG verwalten“: sagen, wer es darf, statt eines Knopfs, der dann scheitert. */
function NurVerwalter({ was }: { was: string }) {
  const m = useMpg()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Hinweis>{was} braucht das Recht „MPG verwalten“ (Admin, MPG-Beauftragte oder freigeschaltet in der Benutzerverwaltung).</Hinweis>
      <button onClick={() => m.setBlatt(null)} style={{ ...knopfRand, color: 'var(--warm-gray)' }}>Schließen</button>
    </div>
  )
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
    const anfragen = planeDefekt({ geraet: device, beschreibung: form.description, schwere: form.severity, sperren, wer: m.wer(), id: form.id, buch: m.buch })
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
  // Eintrag „freigegeben“ im Gerätebuch: eine ID je Blatt — erneutes Tippen legt ihn nicht doppelt an
  const { versuch, id: ereignisId, merke, unklarNach } = useBlattVersuch(`beheben:${defekt.id}`)
  const unklar = !!versuch
  const [notiz, setNotiz] = useState(() => String(versuch?.anfragen.find(a => a.collection === 'mpg_defects')?.body.resolved_notes ?? ''))
  const [wieder, setWieder] = useState(() => geraetWert(versuch, 'operational') === 'true')
  const geraet = m.devices.find(d => d.id === defekt.device_id)
  const weitere = geraet ? m.offeneDefekteVon(geraet.id).filter(d => d.id !== defekt.id) : []
  const weitereSperrend = weitere.filter(d => sperrtDefekt(d.severity)).length

  // Ein unklarer Versuch bleibt erreichbar, auch wenn das Recht inzwischen fehlt — zum Verwerfen
  if (!darfBeheben(m.user, defekt.severity) && !versuch) {
    return (
      <Blatt titel="Defekt beheben" ueber={defekt.device_name} onClose={() => m.setBlatt(null)}>
        <NurVerwalter was={`Einen Defekt „${SCHWERE_NAME[defekt.severity]}“ zu schließen hebt die Sperre auf und`} />
      </Blatt>
    )
  }

  const fertig = () => { merke(null); m.setBlatt(null); Promise.all([m.loadDefects(), m.loadDevices()]).catch(() => undefined) }

  async function beheben() {
    const plan = versuch?.anfragen ?? planeBeheben({ defekt, notiz, wer: m.wer(), wiederEinsatzbereit: wieder && m.darfVerwalten, buch: m.buch ? { ereignisId } : undefined })
    const gibtFrei = plan.some(a => a.collection === 'mpg_devices' && a.body.operational === true)
    let anfragen = plan
    if (versuch && gibtFrei) {
      const v = await m.vorErneutemSenden({ versuch, geraetId: defekt.device_id, was: 'Defekt behoben, Gerät freigegeben' })
      if (v.weiter === 'schon') return fertig()
      if (v.weiter === 'abbrechen') return
      anfragen = v.anfragen
    }
    const r = await m.ausfuehren(anfragen, gibtFrei ? 'Defekt behoben — Gerät wieder einsatzbereit' : 'Defekt als behoben markiert')
    if (r === 'ok') fertig()
    else if (r === 'unklar') unklarNach(plan, defekt.device_id)
  }

  return (
    <Blatt titel="Defekt beheben" ueber={defekt.device_name} onClose={() => m.setBlatt(null)} gesperrt={m.busy}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ ...kursivGrau, fontSize: 13 }}>{defekt.description}</div>
        <Feld label="Was wurde gemacht? (optional)">
          <textarea value={notiz} onChange={e => setNotiz(e.target.value)} rows={3} readOnly={m.busy || unklar}
            placeholder="Ersatzteil, Reparatur, Austausch …" style={{ ...eingabe, resize: 'vertical' }} />
        </Feld>
        {geraet && geraet.operational === false && !istAusserBetrieb(geraet) && (weitereSperrend
          ? <Hinweis>Das Gerät bleibt gesperrt: {weitereSperrend === 1 ? 'ein weiterer Defekt' : `${weitereSperrend} weitere Defekte`} „hoch“ oder „kritisch“ offen.</Hinweis>
          : !m.darfVerwalten
          ? <Hinweis>Das Gerät bleibt gesperrt, bis jemand mit „MPG verwalten“ es freigibt.</Hinweis>
          : <Haken an={wieder} setAn={setWieder} gesperrt={m.busy || unklar} titel="Gerät wieder einsatzbereit" text={[
              weitere.length ? `Noch ${weitere.length === 1 ? 'ein Mangel' : `${weitere.length} Mängel`} offen.` : '',
              pruefungNichtBestanden(geraet) ? 'Die letzte Prüfung ist nicht bestanden — gesperrt bleibt es, bis eine Prüfung bestanden ist.' : 'Hebt die Sperre auf.',
            ].filter(Boolean).join(' ')} />)}
        {unklar && !m.busy && <UnklarHinweis />}
        <KnopfZeile abbrechen={unklar ? () => verwerfen(merke, () => m.setBlatt(null)) : () => m.setBlatt(null)} abbrechenText={unklar ? 'Verwerfen' : 'Abbrechen'}
          los={beheben} losText={unklar ? 'Erneut senden' : 'Als behoben markieren'} frei />
      </div>
    </Blatt>
  )
}

// ── Meldung von außen bestätigen ──────────────────────────────────────────

function MeldungBestaetigen({ meldung }: { meldung: ExternalReport }) {
  const m = useMpg()
  if (!m.darfVerwalten) return <Blatt ueber="Meldung bestätigen" titel={m.geraeteName(meldung.device_id, meldung.device_name)} onClose={() => m.setBlatt(null)}><NurVerwalter was="Meldungen von außen bestätigen" /></Blatt>
  return <MeldungBestaetigenFormular meldung={meldung} />
}

function MeldungBestaetigenFormular({ meldung }: { meldung: ExternalReport }) {
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
      // Ist ein früherer Versuch teilweise angekommen (einzeln geschrieben), stehen Defekt oder
      // Eintrag mit der Kennung der Meldung schon da — dann nur noch den Rest senden
      const defektDa = offen ? await m.gibtEs('mpg_defects', meldung.id) : false
      const eintragDa = offen && m.buch ? await m.gibtEs('mpg_ereignisse', meldung.id) : false
      return { offen, geraetDa, defektDa, eintragDa }
    })
    if (!vorab.ok || !vorab.wert.offen) { Promise.all([m.loadExternalReports(), m.loadDefects(), m.loadDevices()]).catch(() => undefined); return }
    const stand = versuch ?? { anmerkung, sperren: sperren || sperrtDefekt(meldung.severity), seit: new Date().toISOString() }
    // Der Defekt trägt die ID der Meldung: Eine Meldung kann so nur einen Defekt erzeugen,
    // auch nach Neuladen, erneutem Öffnen oder von einem zweiten Gerät aus
    const anfragen = planeBestaetigung({ meldung: { ...meldung, device_name: m.geraeteName(meldung.device_id, meldung.device_name) }, anmerkung: stand.anmerkung, sperren: stand.sperren, geraetDa: vorab.wert.geraetDa, wer: m.wer(), defektId: meldung.id, buch: m.buch })
      .filter(a => !(a.aktion === 'create' && a.id === meldung.id && ((a.collection === 'mpg_defects' && vorab.wert.defektDa) || (a.collection === 'mpg_ereignisse' && vorab.wert.eintragDa))))
    m.aendereUnklar(u => ({ ...u, bestaetigungen: { ...u.bestaetigungen, [meldung.id]: stand } }))
    const gesperrt = anfragen.some(a => a.collection === 'mpg_devices')
    let r = await m.ausfuehren(anfragen, gesperrt ? 'Meldung bestätigt — Defekt angelegt, Gerät gesperrt' : 'Meldung bestätigt — Defekt angelegt')
    // „Angekommen“ heißt: die Meldung steht auf bestätigt (der Anker). Ist sie noch offen, war die
    // Kennung schon anderweitig belegt — dann nicht „gespeichert“ melden
    if (r === 'ok') {
      const nach = await pb.collection('mpg_defect_reports').getOne<ExternalReport>(meldung.id, { fields: 'id,status', ...pbOptionen() }).catch(() => null)
      if (nach?.status === 'pending') {
        m.showMsg('Bestätigung nicht gespeichert: Die Kennung dieser Meldung ist schon vergeben. Bitte den Administrator informieren.', 'error')
        r = 'fehler'
      }
    }
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
    <Blatt ueber="Meldung bestätigen" titel={m.geraeteName(meldung.device_id, meldung.device_name)} onClose={() => m.setBlatt(null)} gesperrt={m.busy}>
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
  if (!m.darfVerwalten) return <Blatt ueber="Meldung ablehnen" titel={m.geraeteName(meldung.device_id, meldung.device_name)} onClose={() => m.setBlatt(null)}><NurVerwalter was="Meldungen von außen ablehnen" /></Blatt>

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
    <Blatt ueber="Meldung ablehnen" titel={m.geraeteName(meldung.device_id, meldung.device_name)} onClose={() => m.setBlatt(null)} gesperrt={m.busy}>
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

// ── Sperren (jeder) ───────────────────────────────────────────────────────

function Sperren({ device }: { device: Device }) {
  const m = useMpg()
  // Eine ID je Blatt: erneutes Tippen nach einem Funkloch legt den Eintrag nicht doppelt an
  const { versuch, id, merke, unklarNach } = useBlattVersuch(`sperren:${device.id}`)
  const unklar = !!versuch
  const [grund, setGrund] = useState(() => eintragText(versuch))
  const schliessen = () => m.setBlatt(null)
  const frei = unklar || !m.buch || !!grund.trim()

  // Erneut sperren ist auf der sicheren Seite — ohne Rückfrage. Nur wenn der Eintrag im
  // Gerätebuch schon da ist, kam die Sperre davor an: nicht noch einmal (das Gerät kann
  // inzwischen geprüft und freigegeben sein — dann stünde eine Sperre ohne Grund im Buch)
  async function sperren() {
    const anfragen = versuch?.anfragen ?? planeSperre({ geraet: device, grund, wer: m.wer(), id, buch: m.buch })
    const eintrag = versuch?.anfragen.find(a => a.collection === 'mpg_ereignisse' && a.aktion === 'create')
    if (eintrag) {
      const da = await m.mitSperre(() => m.gibtEs('mpg_ereignisse', eintrag.id))
      if (!da.ok) return
      if (da.wert) { m.showMsg('War bereits gespeichert'); merke(null); schliessen(); m.loadDevices().catch(() => undefined); return }
    }
    const r = await m.ausfuehren(anfragen, 'Gerät gesperrt')
    if (r === 'ok') { merke(null); schliessen(); m.loadDevices().catch(() => undefined) }
    else if (r === 'unklar') unklarNach(anfragen, device.id)
  }

  return (
    <Blatt ueber={device.type} titel={`Sperren: ${device.name}`} onClose={schliessen} gesperrt={m.busy}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(versuch ? versuch.anfragen.some(a => a.collection === 'mpg_ereignisse') : m.buch) && (
          <Feld label="Grund *" hinweis="Steht im Gerätebuch.">
            <textarea autoFocus value={grund} onChange={e => setGrund(e.target.value)} rows={3} readOnly={m.busy || unklar}
              placeholder="z. B. Akku bläht sich, Gerät heruntergefallen, zur STK beim Dienstleister …" style={{ ...eingabe, resize: 'vertical' }} />
          </Feld>
        )}
        <Hinweis ton="warn">„{device.name}“ gilt danach als nicht einsatzbereit, bis jemand mit „MPG verwalten“ es freigibt.</Hinweis>
        <div style={{ ...kursivGrau }}>Ist etwas kaputt, besser „Mangel melden“ — dann steht der Defekt mit Beschreibung im Verlauf.</div>
        {unklar && !m.busy && <UnklarHinweis />}
        <KnopfZeile abbrechen={unklar ? () => verwerfen(merke, schliessen) : schliessen} abbrechenText={unklar ? 'Verwerfen' : 'Abbrechen'}
          los={sperren} losText={unklar ? 'Erneut senden' : 'Sperren'} frei={frei} gefahr />
      </div>
    </Blatt>
  )
}

// ── Freigeben (MPG verwalten) ─────────────────────────────────────────────

function Freigeben({ device }: { device: Device }) {
  const m = useMpg()
  const { versuch, id, merke, unklarNach } = useBlattVersuch(`freigeben:${device.id}`)
  const unklar = !!versuch
  const [bemerkung, setBemerkung] = useState(() => eintragText(versuch))
  const schliessen = () => m.setBlatt(null)
  if (!m.darfVerwalten && !versuch) return <Blatt ueber={device.type} titel={`Freigeben: ${device.name}`} onClose={schliessen}><NurVerwalter was="Ein Gerät freigeben" /></Blatt>

  const offen = m.offeneDefekteVon(device.id)
  const sperrend = offen.filter(d => sperrtDefekt(d.severity))
  const nichtBestanden = pruefungNichtBestanden(device)

  const fertig = () => { merke(null); schliessen(); m.loadDevices().catch(() => undefined) }

  async function freigeben() {
    const plan = versuch?.anfragen ?? planeFreigabe({ geraet: device, bemerkung, wer: m.wer(), id, buch: m.buch })
    let anfragen = plan
    if (versuch) {
      const v = await m.vorErneutemSenden({ versuch, geraetId: device.id, was: 'Freigabe' })
      if (v.weiter === 'schon') return fertig()
      if (v.weiter === 'abbrechen') return
      anfragen = v.anfragen
    }
    const r = await m.ausfuehren(anfragen, 'Gerät freigegeben')
    if (r === 'ok') fertig()
    else if (r === 'unklar') unklarNach(plan, device.id)
  }

  return (
    <Blatt ueber={device.type} titel={`Freigeben: ${device.name}`} onClose={schliessen} gesperrt={m.busy}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sperrend.length > 0
          ? <Hinweis ton="warn">Noch {sperrend.length === 1 ? 'ein Defekt' : `${sperrend.length} Defekte`} „hoch“ oder „kritisch“ offen. Erst beheben, dann freigeben.</Hinweis>
          : <>
              {m.buch && (
                <Feld label="Bemerkung (optional)" hinweis="Steht im Gerätebuch.">
                  <textarea value={bemerkung} onChange={e => setBemerkung(e.target.value)} rows={3} readOnly={m.busy || unklar}
                    placeholder="z. B. Akku getauscht, Funktionsprüfung in Ordnung …" style={{ ...eingabe, resize: 'vertical' }} />
                </Feld>
              )}
              {offen.length > 0 && <Hinweis>Es {offen.length === 1 ? 'ist noch ein Mangel' : `sind noch ${offen.length} Mängel`} offen — sie sperren nicht.</Hinweis>}
              {nichtBestanden && <Hinweis ton="warn">Die letzte Prüfung ist nicht bestanden — gesperrt bleibt es, bis eine Prüfung bestanden ist.</Hinweis>}
            </>}
        {unklar && !m.busy && <UnklarHinweis />}
        <KnopfZeile abbrechen={unklar ? () => verwerfen(merke, schliessen) : schliessen} abbrechenText={unklar ? 'Verwerfen' : 'Abbrechen'}
          los={freigeben} losText={unklar ? 'Erneut senden' : 'Freigeben'} frei={sperrend.length === 0} />
      </div>
    </Blatt>
  )
}

// ── Außer Betrieb nehmen (MPG verwalten) ──────────────────────────────────

const VERBLEIB = ['Verschrottet / entsorgt', 'An Hersteller zurückgegeben', 'Verkauft / abgegeben', 'Eingelagert']
/** Wie lange die Nachweise eines außer Betrieb genommenen Geräts aufzubewahren sind */
export const AUFBEWAHRUNG_JAHRE = 5

function AusserBetrieb({ device }: { device: Device }) {
  const m = useMpg()
  const { versuch, id, merke, unklarNach } = useBlattVersuch(`ausserBetrieb:${device.id}`)
  const unklar = !!versuch
  const [datum, setDatum] = useState(() => geraetWert(versuch, 'ausser_betrieb') || m.heute)
  const [grund, setGrund] = useState(() => geraetWert(versuch, 'ausser_betrieb_grund'))
  const [verbleib, setVerbleib] = useState(() => geraetWert(versuch, 'verbleib'))
  const schliessen = () => m.setBlatt(null)
  const titel = `Außer Betrieb: ${device.name}`
  if (!m.darfVerwalten && !versuch) return <Blatt ueber={device.type} titel={titel} onClose={schliessen}><NurVerwalter was="Ein Gerät außer Betrieb nehmen" /></Blatt>
  if (!m.ausserBetriebMoeglich && !versuch) {
    return (
      <Blatt ueber={device.type} titel={titel} onClose={schliessen}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Hinweis>In PocketBase fehlen noch die Felder für die Außerbetriebnahme (ausser_betrieb, ausser_betrieb_grund, verbleib an mpg_devices). Bis dahin das Gerät bitte sperren.</Hinweis>
          <button onClick={schliessen} style={{ ...knopfRand, color: 'var(--warm-gray)' }}>Schließen</button>
        </div>
      </Blatt>
    )
  }
  const tag = kalendertag(datum)
  const frei = unklar || (!!tag && tag <= m.heute && !!grund.trim())
  const offen = m.offeneDefekteVon(device.id).length + m.offeneMeldungenVon(device.id).length

  const fertig = () => { merke(null); schliessen(); m.loadDevices().catch(() => undefined) }

  async function ausserBetrieb() {
    if (!versuch && !tag) return
    const plan = versuch?.anfragen ?? planeAusserBetrieb({ geraet: device, datum: tag!, grund, verbleib, wer: m.wer(), id, buch: m.buch })
    let anfragen = plan
    if (versuch) {
      const v = await m.vorErneutemSenden({ versuch, geraetId: device.id, was: 'Außerbetriebnahme' })
      if (v.weiter === 'schon') return fertig()
      if (v.weiter === 'abbrechen') return
      anfragen = v.anfragen
    }
    const r = await m.ausfuehren(anfragen, 'Gerät außer Betrieb genommen')
    if (r === 'ok') fertig()
    else if (r === 'unklar') unklarNach(plan, device.id)
  }

  return (
    <Blatt ueber={device.type} titel={titel} onClose={schliessen} gesperrt={m.busy}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Feld label="Außer Betrieb seit *">
          <input type="date" value={datum} max={m.heute} onChange={e => setDatum(e.target.value)} readOnly={m.busy || unklar} style={eingabe} />
        </Feld>
        <Feld label="Grund *">
          <textarea value={grund} onChange={e => setGrund(e.target.value)} rows={2} readOnly={m.busy || unklar}
            placeholder="z. B. Sturzschaden, nicht mehr reparabel, durch Neugerät ersetzt …" style={{ ...eingabe, resize: 'vertical' }} />
        </Feld>
        <Feld label="Verbleib">
          <input value={verbleib} onChange={e => setVerbleib(e.target.value)} list="mpg-verbleib" readOnly={m.busy || unklar} placeholder="Was ist mit dem Gerät passiert?" style={eingabe} />
          <datalist id="mpg-verbleib">{VERBLEIB.map(v => <option key={v} value={v} />)}</datalist>
        </Feld>
        <Hinweis>
          Das Gerät verschwindet aus Bestand, Heute und Prüfrunden. Sein Gerätebuch mit allen Prüfungen und Defekten
          bleibt erhalten{tag ? ` — aufzubewahren bis ${tagText(plusMonate(tag, AUFBEWAHRUNG_JAHRE * 12))}` : ''}.
          {offen > 0 ? ` ${offen === 1 ? 'Ein offener Defekt oder eine offene Meldung bleibt' : `${offen} offene Defekte oder Meldungen bleiben`} stehen.` : ''}
        </Hinweis>
        {tag && tag > m.heute && <div style={{ ...kursivGrau, color: 'var(--lbf-fehler-text)' }}>Das Datum darf nicht in der Zukunft liegen.</div>}
        {unklar && !m.busy && <UnklarHinweis />}
        <KnopfZeile abbrechen={unklar ? () => verwerfen(merke, schliessen) : schliessen} abbrechenText={unklar ? 'Verwerfen' : 'Abbrechen'}
          los={ausserBetrieb} losText={unklar ? 'Erneut senden' : 'Außer Betrieb nehmen'} frei={frei} gefahr />
      </div>
    </Blatt>
  )
}

// ── Wieder in Betrieb nehmen (MPG verwalten) ──────────────────────────────

function WiederInBetrieb({ device }: { device: Device }) {
  const m = useMpg()
  const { versuch, id, merke, unklarNach } = useBlattVersuch(`wiederInBetrieb:${device.id}`)
  const unklar = !!versuch
  const [bemerkung, setBemerkung] = useState(() => eintragText(versuch))
  const schliessen = () => m.setBlatt(null)
  const titel = `Wieder in Betrieb: ${device.name}`
  if (!m.darfVerwalten && !versuch) return <Blatt ueber={device.type} titel={titel} onClose={schliessen}><NurVerwalter was="Ein Gerät wieder in Betrieb nehmen" /></Blatt>

  const fertig = () => { merke(null); schliessen(); m.loadDevices().catch(() => undefined) }

  async function wieder() {
    const plan = versuch?.anfragen ?? planeWiederInBetrieb({ geraet: device, bemerkung, wer: m.wer(), id, buch: m.buch })
    let anfragen = plan
    if (versuch) {
      const v = await m.vorErneutemSenden({ versuch, geraetId: device.id, was: 'Wieder in Betrieb' })
      if (v.weiter === 'schon') return fertig()
      if (v.weiter === 'abbrechen') return
      anfragen = v.anfragen
    }
    const r = await m.ausfuehren(anfragen, 'Wieder in Betrieb — Gerät gesperrt, bis es freigegeben ist')
    if (r === 'ok') fertig()
    else if (r === 'unklar') unklarNach(plan, device.id)
  }

  return (
    <Blatt ueber={device.type} titel={titel} onClose={schliessen} gesperrt={m.busy}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {m.buch && (
          <Feld label="Bemerkung (optional)" hinweis="Steht im Gerätebuch.">
            <textarea value={bemerkung} onChange={e => setBemerkung(e.target.value)} rows={2} readOnly={m.busy || unklar}
              placeholder="z. B. irrtümlich außer Betrieb genommen, aus dem Lager zurück …" style={{ ...eingabe, resize: 'vertical' }} />
          </Feld>
        )}
        <Hinweis ton="warn">Das Gerät kommt gesperrt in den Bestand zurück — vor dem Einsatz prüfen und freigeben.</Hinweis>
        {unklar && !m.busy && <UnklarHinweis />}
        <KnopfZeile abbrechen={unklar ? () => verwerfen(merke, schliessen) : schliessen} abbrechenText={unklar ? 'Verwerfen' : 'Abbrechen'}
          los={wieder} losText={unklar ? 'Erneut senden' : 'Wieder in Betrieb nehmen'} frei />
      </div>
    </Blatt>
  )
}

// ── Vermerk ins Gerätebuch (jeder) ────────────────────────────────────────

function Vermerk({ device, bezug }: { device: Device; bezug?: { id: string; text: string } }) {
  const m = useMpg()
  const { versuch, id, merke, unklarNach } = useBlattVersuch(`vermerk:${device.id}:${bezug?.id ?? ''}`)
  const unklar = !!versuch
  const [text, setText] = useState(() => eintragText(versuch))
  const schliessen = () => m.setBlatt(null)

  async function eintragen() {
    const anfragen = versuch?.anfragen ?? planeVermerk({ geraet: device, text, bezug: bezug?.id, wer: m.wer(), id })
    const r = await m.ausfuehren(anfragen, 'Vermerk eingetragen')
    if (r === 'ok') { merke(null); schliessen() }
    else if (r === 'unklar') unklarNach(anfragen, device.id)
  }

  return (
    <Blatt ueber={device.name} titel={bezug ? 'Vermerk zur Prüfung' : 'Vermerk ins Gerätebuch'} onClose={schliessen} gesperrt={m.busy}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!m.buch
          ? <Hinweis>Das Gerätebuch ist in PocketBase noch nicht eingerichtet (Sammlung mpg_ereignisse).</Hinweis>
          : <>
              {bezug && <div style={{ ...kursivGrau, fontSize: 13 }}>{bezug.text}</div>}
              <Feld label="Vermerk *">
                <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={4} readOnly={m.busy || unklar}
                  placeholder={bezug ? 'Was war falsch, was ist richtig?' : 'z. B. Akku getauscht, Software aktualisiert, gereinigt …'} style={{ ...eingabe, resize: 'vertical' }} />
              </Feld>
              <div style={kursivGrau}>{bezug
                ? 'Das Prüfprotokoll selbst bleibt unverändert — der Vermerk steht daneben, mit Namen und Zeit.'
                : 'Einträge im Gerätebuch bleiben unverändert stehen, mit Namen und Zeit.'}</div>
            </>}
        {unklar && !m.busy && <UnklarHinweis />}
        <KnopfZeile abbrechen={unklar ? () => verwerfen(merke, schliessen) : schliessen} abbrechenText={unklar ? 'Verwerfen' : 'Abbrechen'}
          los={eintragen} losText={unklar ? 'Erneut senden' : 'Eintragen'} frei={unklar || (m.buch && !!text.trim())} />
      </div>
    </Blatt>
  )
}
