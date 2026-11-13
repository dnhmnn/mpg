// Eine Einsendung eines eigenen Formulars (Bauplan Vorgänge, 3.8.3,
// ?seite=einsendung&id=<einsendung>): Absender, Angaben nach Abschnitten,
// Bearbeitung (Status, interne Notiz, Verlauf), Drucken.
//
// Gespeichert wird immer auf dem frisch gelesenen Datensatz (wie CIRS): erst holen,
// dann prüfen, ob jemand anderes inzwischen etwas geändert hat, dann schreiben. Eine
// fremde Notiz wird nie überschrieben. Ändern darf der Hook ohnehin nur Status und
// Notiz (pb_hooks/eigene-formulare.pb.js); den Verlauf schreibt er selbst.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { pb } from '../../../lib/pocketbase'
import AngabenAnsicht from '../../../components/AngabenAnsicht'
import { absenderZeile } from '../../../lib/formular/absender'
import { EINSENDUNG_STATUS, FELD_GRENZEN, type EinsendungStatus } from '../../../lib/formular/felder'
import {
  EINGANG_TEXTE as T, STATUS_ERKLAERUNG, STATUS_NAME, bezeichnungen, einsendungAnsicht, einsendungDruck, eingangFehlerText,
  felderDa, frueherGesendet, leisteAktion, notizGeaendert, statusVon, verlaufLesen, verlaufText, vorlageTitel,
} from '../../../lib/formular/eingang'
import { druckFensterOeffnen } from '../../../lib/cirsDruck'
import { Abschnitt, Feld, Hinweis, Leer, Leiste, Notiz, Seite, VgIcon, WahlZeilen, Zeile } from '../bausteine'
import type { VgKontext } from '../kontext'
import { vorgaengeVoll } from '../logik'
import { EIN_CSS } from './stil'
import { useAbo } from './useEingang'

type Satz = Record<string, unknown>

function status(e: unknown): number {
  return e && typeof e === 'object' && typeof (e as { status?: unknown }).status === 'number' ? (e as { status: number }).status : -1
}

export default function EinsendungSeite({ k, id }: { k: VgKontext; id?: string }) {
  const einsendungId = id ?? ''
  const voll = vorgaengeVoll(k)
  const location = useLocation()

  const [rec, setRec] = useState<Satz | null>(null)
  const [vorlage, setVorlage] = useState<Satz | null>(null)
  const [laedt, setLaedt] = useState(true)
  const [ladefehler, setLadefehler] = useState('')
  const [nichtDa, setNichtDa] = useState(false)

  // Notiz: Entwurf und der Stand, auf dem er beruht
  const [entwurf, setEntwurf] = useState('')
  const [basis, setBasis] = useState('')
  const [konflikt, setKonflikt] = useState(false)
  const [verworfen, setVerworfen] = useState('')
  const [fehler, setFehler] = useState('')
  const [laeuft, setLaeuft] = useState<'' | 'status' | 'notiz'>('')

  const entwurfRef = useRef(entwurf)
  entwurfRef.current = entwurf
  const basisRef = useRef(basis)
  basisRef.current = basis
  const recRef = useRef(rec)
  recRef.current = rec

  /** Einen neuen Stand übernehmen; die Notiz nur, solange niemand hier daran schreibt. */
  const uebernehmen = useCallback((r: Satz) => {
    setRec(r)
    const n = typeof r.notiz === 'string' ? r.notiz : ''
    if (entwurfRef.current === basisRef.current) { setEntwurf(n); setBasis(n) }
  }, [])

  const laden = useCallback(async () => {
    if (!voll || !einsendungId) { setLaedt(false); return }
    setLaedt(true)
    setLadefehler('')
    try {
      const r = await pb.collection('form_submissions').getOne<Satz>(einsendungId, { requestKey: null })
      if (r.organization_id !== k.orgId) { setNichtDa(true); return }
      let v: Satz | null = null
      try {
        v = await pb.collection('form_templates').getOne<Satz>(String(r.template_id ?? ''), { requestKey: null })
      } catch { v = null }
      setVorlage(v && v.organization_id === k.orgId ? v : null)
      setRec(r)
      const n = typeof r.notiz === 'string' ? r.notiz : ''
      setEntwurf(n)
      setBasis(n)
      setNichtDa(false)
    } catch (e) {
      if (status(e) === 404) setNichtDa(true)
      else setLadefehler(eingangFehlerText(e, T.einsendungLadefehler))
    } finally {
      setLaedt(false)
    }
  }, [voll, einsendungId, k.orgId])

  useEffect(() => { void laden() }, [laden])

  // Ändert jemand anderes die Einsendung, steht hier gleich der neue Stand
  useAbo(voll && !!rec, einsendungId, (e) => {
    if (e.action === 'update' && e.record && e.record.id === einsendungId) uebernehmen(e.record)
  })

  // Ein Schritt nach dem anderen: zwei Lese-Schreib-Runden würden sich sonst überschreiben
  const kette = useRef<Promise<unknown>>(Promise.resolve())
  const nacheinander = (f: () => Promise<void>) => {
    const lauf = kette.current.then(f)
    kette.current = lauf.catch(() => undefined)
    return lauf
  }

  const a = useMemo(() => (rec ? einsendungAnsicht(rec, vorlage) : null), [rec, vorlage])
  const namen = useMemo(() => bezeichnungen(vorlage), [vorlage])
  const verlauf = useMemo(() => verlaufLesen(rec).slice().reverse(), [rec])
  const da = felderDa(rec)
  const faehig = k.stand?.faehig ? k.stand.faehig.eingang !== false : true
  const gesperrt = !da || !faehig
  const aktuell: EinsendungStatus = statusVon(rec)

  function zurueck() {
    // Von hier geöffnet: einen Schritt zurück; sonst zur Liste des Formulars
    if ((location.state as { vgUnter?: boolean } | null)?.vgUnter || !rec?.template_id) k.schliessen()
    else k.ersetze('eingang', String(rec.template_id))
  }

  function statusSetzen(ziel: EinsendungStatus) {
    if (gesperrt || laeuft || !rec || ziel === aktuell) return
    const gezeigt = aktuell
    setFehler('')
    setLaeuft('status')
    void nacheinander(async () => {
      try {
        const frisch = await pb.collection('form_submissions').getOne<Satz>(einsendungId, { requestKey: null })
        if (statusVon(frisch) !== gezeigt) {
          uebernehmen(frisch)
          setFehler(T.statusKonflikt)
          return
        }
        if (!felderDa(frisch)) { uebernehmen(frisch); return }
        const neu = await pb.collection('form_submissions').update<Satz>(einsendungId, { status: ziel }, { requestKey: null })
        uebernehmen(neu)
        k.showMsg(`${T.gespeichert}: ${STATUS_NAME[statusVon(neu)]}`)
      } catch (e) {
        setFehler(eingangFehlerText(e, T.nichtGespeichert))
      } finally {
        setLaeuft('')
      }
    })
  }

  const notizZuLang = entwurf.trim().length > FELD_GRENZEN.notiz
  const notizGeaendertHier = notizGeaendert(basis, entwurf)

  function notizSpeichern() {
    if (gesperrt || laeuft || !rec || !notizGeaendertHier || notizZuLang) return
    const text = entwurf
    const auf = basis
    setFehler('')
    setLaeuft('notiz')
    void nacheinander(async () => {
      try {
        const frisch = await pb.collection('form_submissions').getOne<Satz>(einsendungId, { requestKey: null })
        if (notizGeaendert(auf, frisch.notiz)) {
          setRec(frisch)
          setKonflikt(true)
          return
        }
        const neu = await pb.collection('form_submissions').update<Satz>(einsendungId, { notiz: text }, { requestKey: null })
        setRec(neu)
        const n = typeof neu.notiz === 'string' ? neu.notiz : ''
        setBasis(n)
        // Weitergeschrieben, während gespeichert wurde: den neuen Text behalten
        if (entwurfRef.current === text) setEntwurf(n)
        setKonflikt(false)
        setVerworfen('')
        k.showMsg(T.notizGespeichert)
      } catch (e) {
        setFehler(eingangFehlerText(e, T.nichtGespeichert))
      } finally {
        setLaeuft('')
      }
    })
  }

  /** Nach einem Konflikt: die gespeicherte Notiz zeigen, den eigenen Text zum Kopieren stehen lassen. */
  function notizNeuLaden() {
    const r = recRef.current
    const n = typeof r?.notiz === 'string' ? r.notiz : ''
    if (entwurf.trim() && notizGeaendert(n, entwurf)) setVerworfen(entwurf)
    setEntwurf(n)
    setBasis(n)
    setKonflikt(false)
  }

  function drucken(mitNotiz: boolean) {
    if (!rec) return
    const html = einsendungDruck(rec, vorlage, { orgName: k.orgName, mitNotiz, gedruckt: { von: k.user.name || undefined, am: new Date() } })
    if (!druckFensterOeffnen(html)) k.showMsg(T.druckBlockiert, true)
  }

  // ── Darstellung ──
  if (!voll) {
    return (
      <Seite titel={T.eingang} unter={k.orgName} zurueck={k.schliessen}>
        <Notiz titel={T.keinZugriffTitel}>{T.keinZugriff}</Notiz>
      </Seite>
    )
  }
  if (nichtDa) {
    return (
      <Seite titel={T.nichtGefundenTitel} unter={k.orgName} zurueck={k.schliessen}>
        <Notiz titel={T.nichtGefundenTitel}>{T.nichtGefunden}</Notiz>
      </Seite>
    )
  }
  if (!rec || !a) {
    return (
      <Seite titel={T.eingang} unter={k.orgName} zurueck={k.schliessen}>
        <style>{EIN_CSS}</style>
        {ladefehler
          ? <Notiz titel={T.einsendungLadefehler} knopf={{ text: T.erneutLaden, onClick: () => { void laden() } }}>{ladefehler}</Notiz>
          : <div className="bv-flaeche"><Leer>{T.laedt}</Leer></div>}
      </Seite>
    )
  }

  const titel = a.e.titel || vorlageTitel(vorlage)
  const aktion = leisteAktion(aktuell)
  const absenderText = a.anonym ? T.anonym : absenderZeile(a.absender, T.ohneNamen)

  return (
    <Seite
      titel={titel} unter={`${T.eingegangen} ${a.eingang}`} zurueck={zurueck} zurueckLabel={T.zurueckEingang}
      leiste={(
        <Leiste
          titel={STATUS_NAME[aktuell]} unter={gesperrt ? T.gesperrt : STATUS_ERKLAERUNG[aktuell]}
          knopf={aktion.knopf} onClick={() => statusSetzen(aktion.ziel)}
          laeuft={laeuft === 'status'} disabled={gesperrt || !!laeuft}
        />
      )}
    >
      <style>{EIN_CSS}</style>
      {fehler ? (
        <div className="ein-meldung fehler" role="alert">
          <span>{fehler}</span>
          <button type="button" onClick={() => setFehler('')}>Schließen</button>
        </div>
      ) : null}

      <Abschnitt titel={T.absender} erst />
      <div className="bv-flaeche">
        <Zeile titel={absenderText} unter={a.anonym ? T.anonymHinweis : undefined} />
      </div>
      {a.ausstehend ? <Hinweis>{T.wartet}</Hinweis> : null}

      <Abschnitt titel={T.angaben} />
      {frueherGesendet(a.e, vorlage) ? <Hinweis oben>{T.frueher}</Hinweis> : null}
      {a.e.angaben.felder.length || Object.keys(a.e.angaben.werte).length || a.e.angaben.aelter?.length
        ? <AngabenAnsicht angaben={a.e.angaben} bezeichnung={namen} />
        : <div className="bv-flaeche"><Leer>{T.keineAngaben}</Leer></div>}

      <Abschnitt titel={T.bearbeitung} />
      {gesperrt ? <Hinweis oben>{T.gesperrt}</Hinweis> : null}
      <WahlZeilen<EinsendungStatus>
        label={T.statusAria} wert={aktuell} disabled={gesperrt || !!laeuft}
        optionen={EINSENDUNG_STATUS.map((s) => ({ wert: s, titel: STATUS_NAME[s], unter: STATUS_ERKLAERUNG[s] }))}
        onWahl={statusSetzen}
      />

      <Feld label={T.notizLabel} zusatz={T.notizZusatz} hinweis={T.notizHinweis} fehler={notizZuLang ? T.notizZuLang : undefined}>
        <textarea
          className={`bv-eingabe${notizZuLang ? ' fehler' : ''}`} rows={4} value={entwurf} disabled={gesperrt}
          onChange={(e) => setEntwurf(e.target.value)} maxLength={FELD_GRENZEN.notiz + 200}
        />
      </Feld>
      {konflikt ? (
        <div className="ein-meldung fehler vg-abstand" role="alert">
          <span>{T.notizKonflikt}</span>
          <button type="button" onClick={notizNeuLaden}>{T.neuLaden}</button>
        </div>
      ) : null}
      {verworfen ? (
        <div className="vg-abstand">
          <Notiz titel="Dein Text wurde nicht gespeichert" knopf={{ text: 'Ausblenden', onClick: () => setVerworfen('') }}>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{verworfen}</p>
          </Notiz>
        </div>
      ) : null}
      <div className="ein-knoepfe">
        <button type="button" className="bv-knopf" onClick={notizSpeichern} disabled={gesperrt || !!laeuft || !notizGeaendertHier || notizZuLang || konflikt}>
          {laeuft === 'notiz' ? 'Speichert…' : T.notizSpeichern}
        </button>
      </div>

      <Abschnitt titel={T.verlauf} />
      <div className="bv-flaeche">
        {verlauf.length ? verlauf.map((v) => (
          <div key={v.id} className="bv-z"><span className="bv-tx"><small className="ein-lang" style={{ marginTop: 0, fontSize: 14, color: 'var(--lbf-text)' }}>{verlaufText(v)}</small></span></div>
        )) : <Leer>{T.verlaufLeer}</Leer>}
      </div>

      <Abschnitt titel={T.drucken} />
      <div className="bv-flaeche">
        <Zeile titel={T.drucken} unter={T.druckenUnter} onClick={() => drucken(false)} rechts={<VgIcon n="drucken" className="vg-icon-rechts" />} />
        {a.e.notiz.trim() ? (
          <Zeile titel={T.druckenNotiz} unter={T.druckenNotizUnter} onClick={() => drucken(true)} rechts={<VgIcon n="drucken" className="vg-icon-rechts" />} />
        ) : null}
      </div>
    </Seite>
  )
}
