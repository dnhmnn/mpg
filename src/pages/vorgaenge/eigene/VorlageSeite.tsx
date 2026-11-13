// Ein eigenes Formular im Baukasten (Bauplan Vorgänge 3.7): `?seite=vorlage&id=<id>`, ohne `id`
// ein neues.
//
// 1. Allgemein: Titel, Beschreibung
// 2. Absender: Mitglied mit Passwort, Name frei eintragen, Anonym
// 3. Felder nach Abschnitten, Reihenfolge ändern (Felder wandern an den Rändern in den
//    Nachbarabschnitt), Feld und Abschnitt hinzufügen
// 4. Öffentlich (gespeichert): Aktiv, Link und QR-Code
// 5. Eingang (gespeichert, wenn es die Seite gibt)
// 6. Weiteres: Vorschau, Archivieren oder Wiederherstellen, Löschen
//
// Die Seite und ihre Unterseiten arbeiten auf einem Entwurf in sessionStorage (entwurf.ts).
// „Speichern“ legt an bzw. ändert mit basis_version; ein Konflikt (409) lässt den Entwurf
// stehen. „Aktiv“ und „Archivieren“ speichern sofort für sich.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../../../lib/pocketbase'
import { hatRecht } from '../../../lib/apps'
import { pbFehlerText } from '../../../lib/pbFehler'
import { FELD_GRENZEN, schemaLesen, type VorlageModus } from '../../../lib/formular/felder'
import AbsenderWahl from '../AbsenderWahl'
import LinkTeilen from '../LinkTeilen'
import { Abschnitt, Feld, Hinweis, Leiste, Notiz, SchalterZeile, Seite, Zeile } from '../bausteine'
import { ERWEITERUNGEN } from '../erweiterung'
import type { VgKontext } from '../kontext'
import { vorgaengeVoll, vorlageLink, type VgModus } from '../logik'
import {
  abschnittVerschieben, entwurfAusVorlage, entwurfGeaendert, entwurfLesen, entwurfMerken, entwurfPruefen, entwurfVergessen,
  fehlendeFelder, feldVerschieben, gruppen, neuerEntwurf, speicherBody, type VorlageEntwurf,
} from './entwurf'
import { einsendungenZaehlen } from './daten'
import { NichtDa } from './FeldSeite'
import { Schieber } from './FelderSeite'
import { feldUnter, istKonflikt, vorlageFehlerText, vorlageSchluessel } from './logik'
import { E_TEXTE as T } from './texte'

type Rec = Record<string, unknown>

/** Fehler beim Speichern einer Vorlage, für Menschen lesbar. */
export function speicherFehler(e: unknown): string {
  return vorlageFehlerText(e, (x) => 'Nicht gespeichert: ' + pbFehlerText(x, { title: 'Titel', description: 'Beschreibung', schema: 'Felder', abschnitte: 'Abschnitte' }))
}

/** Die Vorlage frisch lesen (am Zwischenspeicher vorbei); ohne Netz aus dem Zwischenspeicher. */
export async function vorlageLaden(id: string): Promise<Rec> {
  try {
    return await pb.collection('form_templates').getOne(id, { query: { frisch: '1' }, requestKey: null }) as unknown as Rec
  } catch (e) {
    if ((e as { status?: number })?.status !== 0) throw e
    return await pb.collection('form_templates').getOne(id, { requestKey: null }) as unknown as Rec
  }
}

export type EntwurfZustand =
  | { art: 'laedt' }
  | { art: 'weg' }
  | { art: 'fehler'; text: string }
  | { art: 'ok'; e: VorlageEntwurf; rec: Rec | null; inzwischen: boolean }

/**
 * Den Entwurf einer Vorlage laden (Seite und Unterseiten): neu aus sessionStorage oder leer;
 * gespeichert vom Server, ein geänderter Entwurf aus sessionStorage hat Vorrang (Aktiv und
 * Archiviert kommen immer vom Server). Jede Änderung landet sofort wieder in sessionStorage.
 */
export function useVorlagenEntwurf(k: VgKontext, schluessel: string) {
  const [z, setZRoh] = useState<EntwurfZustand>({ art: 'laedt' })
  // Der aktuelle Stand auch außerhalb des Renderns: setze() rechnet und merkt sofort, damit
  // eine Unterseite, die gleich danach schließt, nichts verliert
  const aktuell = useRef<EntwurfZustand>(z)
  const setZ = useCallback((neu: EntwurfZustand) => { aktuell.current = neu; setZRoh(neu) }, [])
  const [lauf, setLauf] = useState(0)

  useEffect(() => {
    let weg = false
    if (schluessel === 'neu') {
      const gemerkt = entwurfLesen('neu')
      setZ({ art: 'ok', e: gemerkt && !gemerkt.id ? gemerkt : neuerEntwurf(), rec: null, inzwischen: false })
      return
    }
    setZ({ art: 'laedt' })
    vorlageLaden(schluessel).then((rec) => {
      if (weg) return
      if (String(rec.organization_id ?? '') !== k.orgId) { setZ({ art: 'weg' }); return }
      const frisch = entwurfAusVorlage(rec)
      const gemerkt = entwurfLesen(schluessel)
      if (gemerkt && gemerkt.id === frisch.id && entwurfGeaendert(gemerkt)) {
        setZ({ art: 'ok', e: { ...gemerkt, aktiv: frisch.aktiv, archiviert: frisch.archiviert }, rec, inzwischen: gemerkt.basisVersion !== frisch.basisVersion })
      } else {
        setZ({ art: 'ok', e: frisch, rec, inzwischen: false })
      }
    }).catch((err) => {
      if (weg) return
      const st = (err as { status?: number })?.status
      setZ(st === 404 ? { art: 'weg' } : { art: 'fehler', text: st === 0 ? T.ohneNetzLaden : speicherFehler(err) })
    })
    return () => { weg = true }
  }, [schluessel, k.orgId, setZ, lauf])

  /** Den Entwurf ändern und sofort merken; gibt den neuen Entwurf zurück (null, solange keiner geladen ist). */
  const setze = useCallback((fn: (e: VorlageEntwurf) => VorlageEntwurf): VorlageEntwurf | null => {
    const alt = aktuell.current
    if (alt.art !== 'ok') return null
    const e = fn(alt.e)
    entwurfMerken(schluessel, e)
    setZ({ ...alt, e })
    return e
  }, [schluessel, setZ])

  /** Nach dem Speichern: der Datensatz des Servers gilt. */
  const gespeichert = useCallback((rec: Rec) => {
    const e = entwurfAusVorlage(rec)
    entwurfMerken(schluessel, e)
    setZ({ art: 'ok', e, rec, inzwischen: false })
  }, [schluessel, setZ])

  /** Konflikt beim Speichern (409): den Entwurf behalten und die Wahl anbieten. */
  const konflikt = useCallback(() => {
    const alt = aktuell.current
    if (alt.art === 'ok') setZ({ ...alt, inzwischen: true })
  }, [setZ])

  /** Den Entwurf verwerfen und die gespeicherte Fassung frisch laden. */
  const verwerfen = useCallback(() => {
    entwurfVergessen(schluessel)
    setLauf((n) => n + 1)
  }, [schluessel])

  /**
   * Die eigenen Änderungen behalten: auf die inzwischen gespeicherte Fassung setzen, damit das
   * nächste Speichern sie ersetzt (Felder nur, wenn sie hier geändert wurden, siehe speicherBody).
   */
  const behalten = useCallback(async (): Promise<boolean> => {
    const alt = aktuell.current
    if (alt.art !== 'ok' || !alt.e.id) return false
    try {
      const rec = await vorlageLaden(alt.e.id)
      const frisch = entwurfAusVorlage(rec)
      const jetzt = aktuell.current
      if (jetzt.art !== 'ok') return false
      const e = { ...jetzt.e, basisVersion: frisch.basisVersion, aktiv: frisch.aktiv, archiviert: frisch.archiviert }
      entwurfMerken(schluessel, e)
      setZ({ art: 'ok', e, rec, inzwischen: false })
      return true
    } catch {
      return false
    }
  }, [schluessel, setZ])

  return { z, setze, gespeichert, konflikt, verwerfen, behalten }
}

/** Zählt Einsendungen dieser Vorlage (gesamt und neu); ohne Recht oder Feld still null. */
function useEinsendungen(k: VgKontext, id: string): { gesamt: number | null; neu: number | null } {
  const [n, setN] = useState<{ gesamt: number | null; neu: number | null }>({ gesamt: null, neu: null })
  useEffect(() => {
    if (!id || !k.orgId) return
    let weg = false
    void einsendungenZaehlen(k.orgId, id).then((r) => { if (!weg) setN(r) })
    return () => { weg = true }
  }, [id, k.orgId])
  return n
}

export default function VorlageSeite({ k, id }: { k: VgKontext; id?: string }) {
  const schluessel = vorlageSchluessel(id)
  if (id && schluessel === 'neu') return <NichtDa k={k} />
  if (!vorgaengeVoll(k)) return <NichtDa k={k} titel={T.keinZugriffTitel} text={T.keinZugriff} />
  return <VorlageInhalt k={k} schluessel={schluessel} />
}

function VorlageInhalt({ k, schluessel }: { k: VgKontext; schluessel: string }) {
  const navigate = useNavigate()
  const { z, setze, gespeichert, konflikt, verwerfen, behalten } = useVorlagenEntwurf(k, schluessel)
  const [ordnen, setOrdnen] = useState(false)
  const [laeuft, setLaeuft] = useState<'' | 'speichern' | 'aktiv' | 'archiv' | 'loeschen'>('')
  const [versucht, setVersucht] = useState(false)
  const gespeichertId = z.art === 'ok' ? z.e.id : ''
  const einsendungen = useEinsendungen(k, gespeichertId)

  if (z.art === 'laedt') {
    return <Seite titel={T.eigeneFormulare} unter={k.orgName} zurueck={k.schliessen}><Hinweis oben>{T.laedt}</Hinweis></Seite>
  }
  if (z.art === 'weg') return <NichtDa k={k} titel={T.nichtGefundenTitel} text={T.nichtGefunden} />
  if (z.art === 'fehler') {
    return <Seite titel={T.eigeneFormulare} unter={k.orgName} zurueck={k.schliessen}><Notiz titel={T.nichtGefundenTitel}>{z.text}</Notiz></Seite>
  }

  const e = z.e
  // PocketBase verwirft Felder, die es nicht kennt, still: am geladenen bzw. gespeicherten Satz sichtbar
  const fehlend = z.rec ? fehlendeFelder(z.rec) : []
  const neu = !e.id
  const geaendert = entwurfGeaendert(e)
  const pruef = entwurfPruefen(e)
  const zeigeFehler = (feld: 'titel' | 'beschreibung' | 'schema') => (versucht && pruef?.feld === feld ? pruef.text : undefined)
  const gespeicherteFelder = z.rec ? schemaLesen(z.rec).felder.filter((f) => !f.aus).length : 0
  const eingangSeite = ERWEITERUNGEN.some((x) => !!x.seiten?.eingang)
  const titel = e.titel.trim() || (neu ? T.neuesFormular : T.eigeneFormulare)

  function zurueck() {
    if (geaendert && !window.confirm(T.verwerfenFrage)) return
    if (geaendert) entwurfVergessen(schluessel)
    k.schliessen()
  }

  async function speichern() {
    setVersucht(true)
    if (pruef) { k.showMsg(pruef.text, true); return }
    setLaeuft('speichern')
    try {
      const body = speicherBody(e, { orgId: k.orgId })
      if (neu) {
        const rec = await pb.collection('form_templates').create(body, { requestKey: null }) as unknown as Rec
        entwurfVergessen('neu')
        const fehlt = fehlendeFelder(rec)
        k.showMsg(fehlt.length ? T.feldFehlt(fehlt[0]) : T.angelegt, fehlt.length > 0)
        k.ersetze('vorlage', String(rec.id))
      } else {
        const rec = await pb.collection('form_templates').update(e.id, body, { requestKey: null }) as unknown as Rec
        gespeichert(rec)
        setVersucht(false)
        const fehlt = fehlendeFelder(rec)
        k.showMsg(fehlt.length ? T.feldFehlt(fehlt[0]) : T.gespeichert, fehlt.length > 0)
      }
    } catch (err) {
      // Konflikt: jemand anderes hat gespeichert; der Entwurf bleibt, der Text kommt vom Server
      if (istKonflikt(err)) {
        konflikt()
        k.showMsg(vorlageFehlerText(err, () => T.inzwischenGeaendert), true)
      } else {
        k.showMsg(speicherFehler(err), true)
      }
    } finally {
      setLaeuft('')
    }
  }

  async function aktivSetzen(an: boolean) {
    if (neu || laeuft) return
    if (an && gespeicherteFelder === 0) { k.showMsg(T.aktivOhneFelder, true); return }
    if (an && !k.vorgaengeFrei) { k.showMsg(T.aktivModul, true); return }
    setLaeuft('aktiv')
    try {
      const rec = await pb.collection('form_templates').update(e.id, { is_active: an }, { requestKey: null }) as unknown as Rec
      setze((x) => ({ ...x, aktiv: rec.is_active === true, archiviert: rec.archiviert === true, basisVersion: typeof rec.version === 'number' ? rec.version : x.basisVersion }))
      k.showMsg(rec.is_active === true ? T.aktiviert : T.deaktiviert)
    } catch (err) {
      k.showMsg(speicherFehler(err), true)
    } finally {
      setLaeuft('')
    }
  }

  async function archivSetzen() {
    if (neu || laeuft) return
    const ziel = !e.archiviert
    setLaeuft('archiv')
    try {
      const body: Rec = ziel ? { archiviert: true, is_active: false } : { archiviert: false }
      const rec = await pb.collection('form_templates').update(e.id, body, { requestKey: null }) as unknown as Rec
      if (!('archiviert' in rec)) { k.showMsg(T.feldFehlt('archiviert'), true); return }
      setze((x) => ({ ...x, aktiv: rec.is_active === true, archiviert: rec.archiviert === true, basisVersion: typeof rec.version === 'number' ? rec.version : x.basisVersion }))
      k.showMsg(rec.archiviert === true ? T.archiviertMeldung : T.wiederhergestellt)
    } catch (err) {
      k.showMsg(speicherFehler(err), true)
    } finally {
      setLaeuft('')
    }
  }

  async function loeschen() {
    if (neu || laeuft || !window.confirm(T.loeschenFrage(e.titel.trim() || T.eigeneFormulare))) return
    setLaeuft('loeschen')
    try {
      await pb.collection('form_templates').delete(e.id, { requestKey: null })
      entwurfVergessen(schluessel)
      k.showMsg(T.geloescht)
      k.schliessen()
    } catch (err) {
      // Mit Einsendungen lehnt der Server ab („Bitte archivieren statt löschen.“)
      k.showMsg(speicherFehler(err), true)
    } finally {
      setLaeuft('')
    }
  }

  const leiste = (
    <Leiste
      titel={neu ? T.neuNichtGespeichert : geaendert ? T.nichtGespeichert : T.gespeichertStand}
      unter={e.titel.trim() || undefined} knopf={T.speichern} icon="haken"
      onClick={() => { void speichern() }} laeuft={laeuft === 'speichern'} disabled={!neu && !geaendert}
    />
  )

  const gr = gruppen(e)
  const vorlageKey = e.id || 'neu'

  return (
    <Seite titel={titel} unter={k.orgName} zurueck={zurueck} leiste={leiste}>
      {fehlend.length ? (
        <Notiz titel={T.feldFehltTitel}>{fehlend.map((f) => <p key={f}>{T.feldFehlt(f)}</p>)}</Notiz>
      ) : null}
      {z.inzwischen ? (
        <>
          <Notiz titel={T.konfliktTitel}>{T.inzwischenGeaendert}</Notiz>
          <div className="bv-flaeche vg-abstand">
            <Zeile titel={T.konfliktVerwerfen} unter={T.konfliktVerwerfenUnter} art="akzent" disabled={!!laeuft}
              onClick={() => { if (window.confirm(T.konfliktVerwerfenFrage)) verwerfen() }} />
            <Zeile titel={T.konfliktBehalten} unter={T.konfliktBehaltenUnter} art="akzent" disabled={!!laeuft}
              onClick={() => { void behalten().then((ok) => { if (!ok) k.showMsg(T.ohneNetzLaden, true) }) }} />
          </div>
        </>
      ) : null}

      <Abschnitt titel={T.allgemein} erst={!fehlend.length && !z.inzwischen} />
      <Feld label={T.titel} erst fehler={zeigeFehler('titel')}>
        <input className={`bv-eingabe${zeigeFehler('titel') ? ' fehler' : ''}`} type="text" value={e.titel} maxLength={160} autoComplete="off"
          onChange={(ev) => { const v = ev.target.value; setze((x) => ({ ...x, titel: v })) }} />
      </Feld>
      <Feld label={T.beschreibung} zusatz={T.freiwillig} hinweis={T.beschreibungHinweis} fehler={zeigeFehler('beschreibung')}>
        <textarea className={`bv-eingabe${zeigeFehler('beschreibung') ? ' fehler' : ''}`} rows={3} value={e.beschreibung} maxLength={600}
          onChange={(ev) => { const v = ev.target.value; setze((x) => ({ ...x, beschreibung: v })) }} />
      </Feld>

      <Abschnitt titel={T.absender} />
      <AbsenderWahl
        modi={['passwort', 'frei', 'anonym']} modus={e.absender} darf onWahl={(m: VgModus) => setze((x) => ({ ...x, absender: m as VorlageModus }))}
        label={`${T.absender} ${titel}`} pruefung={k.pruefung}
        benutzerLink={hatRecht(k.user, 'unitarii')}
        onBenutzer={() => navigate('/unitarii')}
        onPerson={(pid) => navigate(`/unitarii?seite=person&id=${encodeURIComponent(pid)}`)}
      />

      <Abschnitt
        titel={T.felder}
        rechts={e.felder.length > 1 || e.abschnitte.length > 1 ? (
          <button type="button" className="vg-textknopf" onClick={() => setOrdnen(!ordnen)}>{ordnen ? T.fertig : T.reihenfolgeAendern}</button>
        ) : undefined}
      />
      {zeigeFehler('schema') ? <p className="bv-fehltext" role="alert" style={{ margin: '-4px 2px 10px' }}>{zeigeFehler('schema')}</p> : null}
      {gr.map((g, gi) => (
        <section key={g.abschnitt?.id ?? 'ohne'}>
          {g.abschnitt && !ordnen ? <h3 className="bv-gruppe">{g.abschnitt.titel || T.abschnittOhneTitel}</h3> : null}
          <div className={`bv-flaeche${gi > 0 && (ordnen || !g.abschnitt) ? ' vg-abstand' : ''}`}>
            {ordnen && g.abschnitt ? (
              <div className="bv-z">
                <span className="bv-tx"><b>{g.abschnitt.titel || T.abschnittOhneTitel}</b><small>{T.abschnittTitel}</small></span>
                <Schieber name={g.abschnitt.titel || T.abschnittTitel} oben={gi > 0} unten={gi < gr.length - 1}
                  onOben={() => setze((x) => abschnittVerschieben(x, g.abschnitt!.id, -1))} onUnten={() => setze((x) => abschnittVerschieben(x, g.abschnitt!.id, 1))} />
              </div>
            ) : null}
            {g.felder.length === 0 && !ordnen && !g.abschnitt ? <div className="bv-z"><span className="bv-tx"><small>{T.keineFelder}</small></span></div> : null}
            {g.felder.map((f) => {
              const pos = e.felder.findIndex((x) => x.id === f.id)
              if (ordnen) {
                // Am Rand eines Abschnitts geht es in den Nachbarabschnitt, solange es einen gibt
                const ersterGanz = pos === 0 && gi === 0
                const letzterGanz = pos === e.felder.length - 1 && gi === gr.length - 1
                return (
                  <div key={f.id} className="bv-z">
                    <span className="bv-tx"><b>{f.label || f.id}</b><small>{feldUnter(f)}</small></span>
                    <Schieber name={f.label || f.id} oben={!ersterGanz} unten={!letzterGanz}
                      onOben={() => setze((x) => feldVerschieben(x, f.id, -1))} onUnten={() => setze((x) => feldVerschieben(x, f.id, 1))} />
                  </div>
                )
              }
              return <Zeile key={f.id} titel={f.label || f.id} unter={feldUnter(f)} pfeil onClick={() => k.oeffne('vorlage-feld', `${vorlageKey}:${f.id}`)} />
            })}
            {!ordnen ? (
              <Zeile titel={T.feldHinzufuegen} art="neu" disabled={e.felder.length >= FELD_GRENZEN.felder}
                onClick={() => k.oeffne('vorlage-feld', `${vorlageKey}:${g.abschnitt ? `neu.${g.abschnitt.id}` : 'neu'}`)} />
            ) : null}
            {!ordnen && g.abschnitt ? (
              <Zeile titel={T.abschnittBearbeiten} pfeil onClick={() => k.oeffne('vorlage-abschnitt', `${vorlageKey}:${g.abschnitt!.id}`)} />
            ) : null}
          </div>
        </section>
      ))}
      {!ordnen ? (
        <div className="bv-flaeche vg-abstand">
          <Zeile titel={T.abschnittHinzufuegen} art="neu" disabled={e.abschnitte.length >= FELD_GRENZEN.abschnitte} onClick={() => k.oeffne('vorlage-abschnitt', `${vorlageKey}:neu`)} />
        </div>
      ) : null}
      {(einsendungen.gesamt ?? 0) > 0 ? <Hinweis>{T.fassungHinweis}</Hinweis> : null}

      {!neu ? (
        <>
          <Abschnitt titel={T.oeffentlich} />
          <div className="bv-flaeche">
            <SchalterZeile titel={T.aktivSchalter} unter={e.aktiv ? T.aktivAn : T.aktivUnter} an={e.aktiv}
              onChange={(an) => { void aktivSetzen(an) }} disabled={e.archiviert || !!laeuft} />
          </div>
          {e.archiviert ? <Hinweis>{T.archivierenUnter}</Hinweis> : null}
          {e.aktiv && k.orgCode ? (
            <>
              <Abschnitt titel={T.linkUndQr} />
              <LinkTeilen url={vorlageLink(k.orgCode, e.id)} titel={z.rec && typeof z.rec.title === 'string' ? z.rec.title : e.titel} orgName={k.orgName} onMeldung={k.showMsg} />
            </>
          ) : null}
          {eingangSeite ? (
            <>
              <Abschnitt titel={T.eingang} />
              <div className="bv-flaeche">
                <Zeile titel={T.einsendungen} pfeil onClick={() => k.oeffne('eingang', e.id)}
                  unter={einsendungen.gesamt === null ? undefined : einsendungen.gesamt === 0 ? T.eingangLeer : T.eingangUnter(einsendungen.neu ?? 0, einsendungen.gesamt)} />
              </div>
            </>
          ) : null}
        </>
      ) : (
        <Hinweis>{T.aktivErstSpeichern}</Hinweis>
      )}

      <Abschnitt titel={T.weiteres} />
      <div className="bv-flaeche">
        <Zeile titel={T.vorschau} unter={T.vorschauUnter} pfeil onClick={() => k.oeffne('vorschau', `vorlage:${vorlageKey}`)} />
        {!neu ? (
          <Zeile titel={e.archiviert ? T.wiederherstellen : T.archivieren} unter={e.archiviert ? T.wiederherstellenUnter : T.archivierenUnter}
            art="akzent" disabled={!!laeuft} onClick={() => { void archivSetzen() }} />
        ) : null}
        {!neu ? <Zeile titel={T.loeschen} unter={T.loeschenUnter} art="gefahr" disabled={!!laeuft} onClick={() => { void loeschen() }} /> : null}
      </div>
    </Seite>
  )
}
