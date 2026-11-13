// Vorgänge (/vorgaenge): Formulare der Organisation, Eingang eigener Formulare, CIRS.
//
// Gestaltet wie die Benutzerverwaltung (src/pages/Unitarii.tsx): dunkelroter Kopf
// mit Reitern, darunter das Elfenbein-Blatt mit ruhigen Zeilen. Unterseiten öffnen
// als ganze Seite mit Zurück; welche offen ist, steht in der Adresse
// (?tab=…&seite=…&id=…), damit „Zurück“ im Browser und am Handy wirkt.
//
// Diese Datei ist nur die Schale (Bauplan Vorgänge, 3.2): Laden, Rechte, Adresse,
// Reiter, Seiten-Weiche. Die Teile liegen in src/pages/vorgaenge/; eigene Formulare
// (E) und der Eingang (I) hängen sich über ERWEITERUNGEN ein (erweiterung.ts).
// Alte Verweise bleiben gültig: ?karte=<formular> (MPG, Lager) öffnet die Seite des
// Formulars, ?bereich=cirs&meldung=<id> (Hub, Widgets) den Reiter CIRS.

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import { useStatusleiste } from '../hooks/useStatusleiste'
import { hatRecht } from '../lib/apps'
import { modulFrei } from '../lib/freigabe'
import { darfFormulareEinstellen } from '../lib/formular/absender'
import { formConfigAendern, formConfigLesen } from '../lib/formular/einstellung'
import { formularStand, istFehler, mitgliederPruefung, type MitgliederPruefung, type Stand } from '../lib/formular/api'
import { DEFAULT_FORM_CONFIG, type FormConfig } from './public/formSchema'
import type { User } from '../types'
import { BV_CSS } from './benutzer/stil'
import { orgFehler } from './benutzer/logik'
import CirsVerwaltung from './vorgaenge/CirsVerwaltung'
import { VG_CSS } from './vorgaenge/stil'
import { Notiz, Seite, Toast, VgIcon } from './vorgaenge/bausteine'
import { ERWEITERUNGEN } from './vorgaenge/erweiterung'
import FormulareReiter from './vorgaenge/FormulareReiter'
import StandardSeite from './vorgaenge/StandardSeite'
import type { VgKontext } from './vorgaenge/kontext'
import { adresseBauen, adresseLesen, hatZugriff, reiterListe, vorgaengeVoll } from './vorgaenge/logik'
import { VG_TEXTE as T } from './vorgaenge/texte'

type SeitenKomponente = ComponentType<{ k: VgKontext; id?: string }>

/** Alle Seiten unter ?seite=: die der Erweiterungen, dazu `formular` (gehört der Schale). */
let seitenListe: Record<string, SeitenKomponente> | null = null
function seitenAlle(): Record<string, SeitenKomponente> {
  if (!seitenListe) {
    const s: Record<string, SeitenKomponente> = {}
    for (const e of ERWEITERUNGEN) Object.assign(s, e.seiten ?? {})
    s.formular = StandardSeite
    seitenListe = s
  }
  return seitenListe
}

// Die Seite rollt je nach Darstellung im Fenster oder im body (globals.css)
const scrollPos = () => Math.max(window.scrollY, document.body.scrollTop, document.documentElement.scrollTop)
function scrollZu(y: number) {
  window.scrollTo(0, y)
  document.body.scrollTop = y
  document.documentElement.scrollTop = y
}

const STIL = BV_CSS + VG_CSS

export default function Vorgaenge() {
  const { user, loading } = useAuth()
  // Statusleiste im Dunkelrot des Kopfs, solange der rote Kopf zu sehen ist
  useStatusleiste('--lbf-kopf', { kopf: '.bv-kopf' })
  const navigate = useNavigate()
  if (loading) return null
  if (!user) {
    return (
      <>
        <style>{STIL}</style>
        <Seite titel={T.titel} unter="Responda" zurueck={() => navigate('/hub')} zurueckLabel={T.zurueckHub}>
          <Notiz titel={T.keinZugriffTitel}>{T.keinZugriff}</Notiz>
        </Seite>
      </>
    )
  }
  return <Schale user={user} />
}

function Schale({ user }: { user: User }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sp] = useSearchParams()
  const adr = adresseLesen(sp)

  // Die Organisation frisch geladen; bis dahin (und ohne Netz) die vom Login
  const [orgFrisch, setOrgFrisch] = useState<Record<string, unknown> | null>(null)
  const orgLogin = (user.organization ?? null) as unknown as Record<string, unknown> | null
  const org = orgFrisch ?? orgLogin
  const orgId = String(orgFrisch?.id ?? user.organization_id ?? '')
  const orgCode = String(org?.org_code ?? '')
  const orgName = user.organization_name || String(org?.org_name ?? '') || 'Responda'

  const darfEinstellen = darfFormulareEinstellen(user)
  const darfVorgaenge = hatRecht(user, 'dokumente')
  const vorgaengeFrei = modulFrei(org, 'dokumente')
  const zugriff = hatZugriff({ darfEinstellen, darfVorgaenge })
  const voll = vorgaengeVoll({ vorgaengeFrei, darfVorgaenge })

  /*
   * form_config: angezeigt wird sofort, gespeichert auf dem frisch gelesenen
   * Stand (formConfigAendern), alle Änderungen nacheinander, damit zwei schnelle
   * Klicks sich nicht überschreiben. Geht etwas schief, zeigt die Seite wieder
   * den zuletzt gespeicherten Stand.
   */
  const [cfg, setCfg] = useState<FormConfig>(() => ({ ...DEFAULT_FORM_CONFIG, ...formConfigLesen(orgLogin?.form_config) }))
  const gespeichert = useRef<FormConfig>(cfg)
  const kette = useRef<Promise<unknown>>(Promise.resolve())
  const offen = useRef(0)

  const [pruefung, setPruefung] = useState<MitgliederPruefung | null>(null)
  const [stand, setStand] = useState<Stand | null>(null)
  const [cirsZahlen, setCirsZahlen] = useState({ neu: 0, ueberfaellig: 0 })
  // Aus dem Hub: diese CIRS-Meldung gleich öffnen (nur beim ersten Einhängen)
  const [startMeldung, setStartMeldung] = useState<string | null>(() => adr.meldung || null)

  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null)
  const msgUhr = useRef<number | undefined>(undefined)
  const listScroll = useRef(0)

  const showMsg = useCallback((text: string, fehler = false) => {
    window.clearTimeout(msgUhr.current)
    setMeldung({ text, fehler })
    msgUhr.current = window.setTimeout(() => setMeldung(null), fehler ? 7000 : 3500)
  }, [])
  useEffect(() => () => window.clearTimeout(msgUhr.current), [])

  // Alte Verweise einmal auf die neue Adresse umschreiben, ohne Eintrag im Verlauf
  useEffect(() => {
    if (adr.umleiten !== null) navigate({ search: adr.umleiten }, { replace: true })
  }, [adr.umleiten, navigate])

  useEffect(() => {
    const id = user.organization_id
    if (!id) return
    let weg = false
    pb.collection('organizations').getOne(id, { requestKey: null })
      .then((o) => {
        if (weg) return
        const frisch = o as unknown as Record<string, unknown>
        setOrgFrisch(frisch)
        // form_config als Objekt, Text oder doppelt kodiert
        const gelesen: FormConfig = { ...DEFAULT_FORM_CONFIG, ...formConfigLesen(frisch.form_config) }
        gespeichert.current = gelesen
        if (offen.current === 0) setCfg(gelesen)
      })
      .catch(() => { /* ohne Netz: die Organisation vom Login */ })
    return () => { weg = true }
  }, [user.organization_id])

  // Zählung für die Absender-Wahl, einmal je Seitenaufruf; Fehler: die Zeile entfällt still
  useEffect(() => {
    if (!darfEinstellen) { setPruefung(null); return }
    let aktiv = true
    mitgliederPruefung().then((r) => { if (aktiv) setPruefung(istFehler(r) ? null : r.wert) })
    return () => { aktiv = false }
  }, [user.id, darfEinstellen])

  // Stand des Servers mit Anmeldung (`faehig`: was der Server schon kann)
  useEffect(() => {
    if (!orgCode || !zugriff) return
    let aktiv = true
    formularStand(orgCode, { mitAnmeldung: true }).then((r) => { if (aktiv) setStand(istFehler(r) ? null : r.wert) })
    return () => { aktiv = false }
  }, [orgCode, user.id, zugriff])

  // Neue Seite beginnt oben, zurück in der Liste steht man wieder, wo man war
  useEffect(() => {
    if (adr.seite) scrollZu(0)
    else requestAnimationFrame(() => scrollZu(listScroll.current))
  }, [adr.seite, adr.id])

  // CIRS hat die Meldung aus dem Hub beim Einhängen übernommen; später nicht noch einmal öffnen
  useEffect(() => {
    if (startMeldung && voll && !adr.seite) setStartMeldung(null)
  }, [voll]) // eslint-disable-line react-hooks/exhaustive-deps

  const aendern = useCallback((fn: (c: FormConfig) => FormConfig): Promise<boolean> => {
    if (!orgId) { showMsg(T.orgNichtGeladen, true); return Promise.resolve(false) }
    setCfg((c) => fn(JSON.parse(JSON.stringify(c)) as FormConfig))
    offen.current += 1
    const lauf = kette.current.then(async () => {
      try {
        gespeichert.current = await formConfigAendern(orgId, fn)
        return true
      } catch (e) {
        showMsg(orgFehler(e), true)
        return false
      } finally {
        offen.current -= 1
        if (offen.current === 0) setCfg(gespeichert.current)
      }
    })
    kette.current = lauf
    return lauf
  }, [orgId, showMsg])

  // ── Adresse ──
  const roh: VgKontext = {
    user, org, orgId, orgCode, orgName, cfg, aendern,
    darfEinstellen, darfVorgaenge, vorgaengeFrei, pruefung, stand, showMsg,
    oeffne, ersetze, schliessen, tab: adr.tab, setTab,
  }
  const extra = ERWEITERUNGEN.flatMap((e) => (e.reiter && voll && e.reiter.zeigen(roh) ? [e.reiter] : []))
  const reiter = reiterListe({ vorgaengeFrei, darfVorgaenge, extra })
  const tab = reiter.some((r) => r.key === adr.tab) ? adr.tab : 'formulare'
  const k: VgKontext = { ...roh, tab }

  // Zahlen der Erweiterungen für ihre Reiter: in fester Folge, bei jedem Rendern (Hook-Regeln)
  const zahlen = ERWEITERUNGEN.map((e) => (e.reiter?.useZahl ? e.reiter.useZahl(k) : 0))

  function setTab(t: string) { navigate({ search: adresseBauen({ tab: t }) }, { replace: true }) }
  function oeffne(seite: string, id?: string) {
    if (!adr.seite) listScroll.current = scrollPos()
    // Eine alte Meldung gehört nicht auf die neue Seite
    setMeldung(null)
    navigate({ search: adresseBauen({ tab, seite, id }) }, { state: { vgUnter: true } })
  }
  function ersetze(seite: string, id?: string) {
    navigate({ search: adresseBauen({ tab, seite, id }) }, { replace: true, state: location.state })
  }
  function schliessen() {
    // Selbst geöffnet: einen Schritt zurück, damit die Seite nicht im Verlauf hängen bleibt
    if ((location.state as { vgUnter?: boolean } | null)?.vgUnter) navigate(-1)
    else navigate({ search: adresseBauen({ tab }) }, { replace: true })
  }

  const stil = <style>{STIL}</style>
  const toast = meldung && <Toast text={meldung.text} fehler={meldung.fehler} hoch={!!adr.seite} onClose={() => setMeldung(null)} />

  // Ohne Recht Vorgänge und ohne Recht, die Formulare einzustellen: nichts zu sehen (Schreiben schützen die Regeln)
  if (!zugriff) {
    return (
      <>
        {stil}
        <Seite titel={T.titel} unter={orgName} zurueck={() => navigate('/hub')} zurueckLabel={T.zurueckHub}>
          <Notiz titel={T.keinZugriffTitel}>{T.keinZugriff}</Notiz>
        </Seite>
      </>
    )
  }

  // ── Ganze Seiten ──
  if (adr.seite) {
    const S = seitenAlle()[adr.seite]
    const inhalt = S
      ? <S key={`${adr.seite}:${adr.id}`} k={k} id={adr.id || undefined} />
      : (
        <Seite titel={T.nichtGefundenTitel} unter={orgName} zurueck={schliessen}>
          <Notiz titel={T.nichtGefundenTitel}>{T.nichtGefunden}</Notiz>
        </Seite>
      )
    return <>{stil}{inhalt}{toast}</>
  }

  // ── Hauptseite mit Reitern ──
  const zahlAm = (key: string): number => {
    if (key === 'cirs') return cirsZahlen.neu
    const i = ERWEITERUNGEN.findIndex((e) => e.reiter?.key === key)
    return i >= 0 ? zahlen[i] : 0
  }
  const Inhalt = extra.find((r) => r.key === tab)?.Inhalt
  const neu = tab === 'formulare' && voll && seitenAlle().vorlage ? (
    <button type="button" className="bv-rund hell" aria-label={T.neuesFormular} title={T.neuesFormular} onClick={() => oeffne('vorlage')}>
      <VgIcon n="plus" />
    </button>
  ) : undefined

  return (
    <>
      {stil}
      <Seite
        titel={T.titel} unter={orgName} zurueck={() => navigate('/hub')} zurueckLabel={T.zurueckHub} rechts={neu}
        reiter={reiter.length > 1 ? (
          <nav className="bv-reiter" role="tablist" aria-label={T.reiterAria}>
            {reiter.map((r) => {
              const n = zahlAm(r.key)
              return (
                <button key={r.key} type="button" role="tab" aria-selected={tab === r.key} onClick={() => setTab(r.key)}>
                  {r.label}{n > 0 ? <em>{n}</em> : null}
                </button>
              )
            })}
          </nav>
        ) : undefined}
      >
        {tab === 'formulare' ? <FormulareReiter k={k} /> : null}
        {Inhalt ? <Inhalt k={k} /> : null}
        {/* CIRS bleibt eingehängt, damit der Reiter die Zahl der neuen Meldungen zeigt */}
        {voll ? (
          <div hidden={tab !== 'cirs'}>
            <CirsVerwaltung user={user} orgId={orgId || null} orgName={orgName} startMeldung={startMeldung} onZahlen={setCirsZahlen} formConfig={cfg} />
          </div>
        ) : null}
      </Seite>
      {toast}
    </>
  )
}
