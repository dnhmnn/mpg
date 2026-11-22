// Benachrichtigungen (/benachrichtigungen): Push auf diesem Gerät, Anlässe, Ruhezeit, angemeldete
// Geräte; für die Leitung die Organisation (?seite=organisation) mit der Mitteilung an alle.
// Bauplan Push, 6.3; Owner 12.3 und 12.4.
//
// Gemeinsamer Rahmen (Seite, BV_CSS, useStatusleiste; CLAUDE.md, „Seiten im Dunkelrot-Design“),
// rollende Seite, Standard oben. Push ist keine Alarmierung; die Seite sagt das an jeder Stelle.
//
// Einschalten nur auf Tippen: pushEinschalten fragt als Erstes nach der Erlaubnis, ohne await
// davor (Safari). Der Schlüssel dafür kommt aus /stand, das die Seite beim Öffnen lädt.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useStatusleiste } from '../hooks/useStatusleiste'
import { BV_CSS } from './benutzer/stil'
import { Abschnitt, Icon, Seite, Toast } from './benutzer/bausteine'
import { PU_CSS } from './benachrichtigungen/stil'
import GeraetAbschnitt, { type Arbeit } from './benachrichtigungen/GeraetAbschnitt'
import AnlaesseAbschnitt from './benachrichtigungen/AnlaesseAbschnitt'
import RuheAbschnitt from './benachrichtigungen/RuheAbschnitt'
import GeraeteListe from './benachrichtigungen/GeraeteListe'
import OrganisationSeite from './benachrichtigungen/OrganisationSeite'
import { KeineAlarmierung } from './benachrichtigungen/Schalter'
import { ausUmschalten, darfMitteilung, geraetZustand } from './benachrichtigungen/logik'
import { einstellungenSpeichern, geraetAbmelden, istFehler, probeSenden, pushStand, type PushFehler, type PushStand, type StandAnlass, type StandGeraet } from '../lib/push/api'
import { pushAusschalten, pushEinschalten } from '../lib/push/abgleich'
import { aktuellesAbo, endpointKennung, erlaubnisLesen, merkerLesen, umgebungLesen, unterstuetzung, type PushMerker } from '../lib/push/geraet'
import type { Ruhe } from '../lib/push/regeln'
import { PUSH_TEXTE as T } from '../lib/push/texte'
import Zwischenschirm from '../components/Zwischenschirm'

// Die Seite rollt je nach Darstellung im Fenster oder im body (wie in Unitarii.tsx)
function nachOben() {
  window.scrollTo(0, 0)
  document.body.scrollTop = 0
  document.documentElement.scrollTop = 0
}

interface GeraetLage { kennung: string | null; merker: PushMerker | null; erlaubnis: string }

export default function Benachrichtigungen() {
  const { user, loading } = useAuth()
  // Rot nur, solange der rote Kopf zu sehen ist (rollende Seite, CLAUDE.md)
  useStatusleiste('--lbf-kopf', { kopf: '.bv-kopf' })
  const navigate = useNavigate()
  const location = useLocation()
  const [sp] = useSearchParams()
  const seiteOrg = sp.get('seite') === 'organisation'

  const [stand, setStand] = useState<PushStand | null>(null)
  const [standFehler, setStandFehler] = useState<PushFehler | null>(null)
  const [geraet, setGeraet] = useState<GeraetLage | null>(null)
  const [arbeit, setArbeit] = useState<Arbeit>(null)
  const [geraetLaeuft, setGeraetLaeuft] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null)
  const [jetzt, setJetzt] = useState(() => Date.now())
  const unterst = useMemo(() => unterstuetzung(umgebungLesen()), [])
  const aktuell = useRef<PushStand | null>(null)
  aktuell.current = stand
  const reihe = useRef<Promise<void>>(Promise.resolve())
  const msgTimer = useRef<number | undefined>(undefined)

  const zeigen = useCallback((text: string, fehler = false) => {
    window.clearTimeout(msgTimer.current)
    setMeldung({ text, fehler })
    msgTimer.current = window.setTimeout(() => setMeldung(null), fehler ? 7000 : 3500)
  }, [])
  useEffect(() => () => window.clearTimeout(msgTimer.current), [])

  const standLaden = useCallback(async () => {
    const r = await pushStand()
    if (istFehler(r)) { setStandFehler(r); if (r.fehler === 'nicht_eingerichtet') setStand(null) } else { setStand(r.daten); setStandFehler(null) }
  }, [])
  const geraetLaden = useCallback(async () => {
    const [abo, merker] = await Promise.all([aktuellesAbo(), merkerLesen()])
    const kennung = abo ? await endpointKennung(abo.endpoint) : null
    setGeraet({ kennung, merker, erlaubnis: erlaubnisLesen() })
  }, [])

  useEffect(() => {
    if (!user?.id) return
    void standLaden()
    void geraetLaden()
  }, [user?.id, standLaden, geraetLaden])

  // Zurück aus den Einstellungen des Geräts (Erlaubnis geändert) und für „Gerade Ruhezeit bis …“
  useEffect(() => {
    if (!user?.id) return
    const sichtbar = () => {
      if (document.visibilityState !== 'visible') return
      setJetzt(Date.now())
      void geraetLaden()
      void standLaden()
    }
    document.addEventListener('visibilitychange', sichtbar)
    const uhr = window.setInterval(() => setJetzt(Date.now()), 60_000)
    return () => { document.removeEventListener('visibilitychange', sichtbar); window.clearInterval(uhr) }
  }, [user?.id, geraetLaden, standLaden])

  // Meldung vom Profil-Blatt („Push neu einschalten“)
  useEffect(() => {
    const m = (location.state as { pushMeldung?: { text: string; fehler?: boolean } } | null)?.pushMeldung
    if (m?.text) {
      zeigen(m.text, !!m.fehler)
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => { nachOben() }, [seiteOrg])

  const eingerichtet = stand ? stand.eingerichtet : standFehler?.fehler === 'nicht_eingerichtet' ? false : null
  const standKaputt = !!standFehler && standFehler.fehler !== 'nicht_eingerichtet' && !stand
  const zustand = geraetZustand({
    eingerichtet: geraet ? eingerichtet : null,
    unterstuetzung: unterst,
    erlaubnis: geraet?.erlaubnis ?? 'default',
    aboKennung: geraet?.kennung ?? null,
    kennungen: stand?.geraete.map((g) => g.kennung) ?? [],
    merker: geraet?.merker ?? null,
    personId: user?.id ?? '',
  })

  function einschalten() {
    if (!user || !stand?.schluessel || arbeit) return
    // Als Erstes, ohne await davor: die Erlaubnis (Safari verlangt die direkte Geste)
    const p = pushEinschalten({ id: user.id }, { schluessel: stand.schluessel })
    setArbeit('ein')
    void p.then(async (r) => {
      await Promise.all([geraetLaden(), standLaden()])
      setArbeit(null)
      if (r.ok) zeigen(T.eingeschaltet)
      else zeigen(r.text, true)
    })
  }

  async function ausschalten() {
    if (arbeit) return
    setArbeit('aus')
    const r = await pushAusschalten()
    await Promise.all([geraetLaden(), standLaden()])
    setArbeit(null)
    zeigen(r.server ? T.ausgeschaltet : T.ausschaltenFehler, !r.server)
  }

  async function probe() {
    if (arbeit) return
    setArbeit('probe')
    const r = await probeSenden()
    setArbeit(null)
    if (istFehler(r)) zeigen(r.text, true)
    else zeigen(r.daten.geraete ? T.probeGesendet : T.probeOhneGeraet)
  }

  /** Nacheinander speichern, immer den neuesten Stand; bei Fehler den Stand des Servers neu laden. */
  function speichern(was: 'aus' | 'ruhe') {
    reihe.current = reihe.current.then(async () => {
      const st = aktuell.current
      if (!st) return
      const teil = was === 'aus' ? { aus: st.person.aus } : { ruhe: st.person.ruhe, mitteilung_in_ruhe: st.person.mitteilung_in_ruhe }
      const r = await einstellungenSpeichern(teil)
      if (istFehler(r)) { zeigen(r.text || T.speichernFehler, true); await standLaden() }
    })
  }

  function anlassUmschalten(a: StandAnlass, an: boolean) {
    const s = aktuell.current
    if (!s || a.pflicht || !a.org_an) return
    const aus = ausUmschalten(s.person.aus, a.key, an)
    const neu: PushStand = { ...s, person: { ...s.person, aus }, anlaesse: s.anlaesse.map((x) => (x.key === a.key ? { ...x, person_an: an } : x)) }
    aktuell.current = neu
    setStand(neu)
    speichern('aus')
  }

  function ruheAendern(teil: Partial<Ruhe>, mitteilungInRuhe?: boolean) {
    const s = aktuell.current
    if (!s) return
    const neu: PushStand = {
      ...s,
      person: { ...s.person, ruhe: { ...s.person.ruhe, ...teil }, mitteilung_in_ruhe: mitteilungInRuhe ?? s.person.mitteilung_in_ruhe },
    }
    aktuell.current = neu
    setStand(neu)
    setJetzt(Date.now())
    speichern('ruhe')
  }

  async function geraetAbmeldenListe(g: StandGeraet, dieses: boolean) {
    if (dieses) { await ausschalten(); return }
    setGeraetLaeuft(g.id)
    const r = await geraetAbmelden({ id: g.id })
    setGeraetLaeuft(null)
    if (!istFehler(r) || r.fehler === 'nicht_gefunden') zeigen(T.geraetAbgemeldet)
    else zeigen(r.text, true)
    await standLaden()
  }

  function zurueck() {
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate('/hub')
  }
  function orgOeffnen() {
    navigate({ search: '?seite=organisation' }, { state: { puUnter: true } })
  }
  function orgSchliessen() {
    if ((location.state as { puUnter?: boolean } | null)?.puUnter) navigate(-1)
    else navigate({ search: '' }, { replace: true })
  }

  const orgName = user?.organization_name || 'Responda'
  const stil = <style>{BV_CSS + PU_CSS}</style>
  const toast = meldung && <Toast text={meldung.text} fehler={meldung.fehler} onClose={() => setMeldung(null)} />

  if (loading || !user) return <>{stil}<Zwischenschirm /></>

  if (seiteOrg) {
    return (
      <>
        {stil}
        <OrganisationSeite user={user} orgName={orgName} zurueck={orgSchliessen} zeigen={zeigen} />
        {toast}
      </>
    )
  }

  return (
    <>
      {stil}
      <Seite titel={T.seitenTitel} unter={orgName} zurueck={zurueck}>
        <div data-probe="push-seite" data-zustand={zustand}>
          {standKaputt ? (
            <>
              <Abschnitt titel={T.abschnittGeraet} erst />
              <div className="bv-notiz" data-probe="push-stand-fehler">
                <p>{standFehler?.text}</p>
                <button type="button" className="bv-knopf" onClick={() => { void standLaden(); void geraetLaden() }}>Erneut laden</button>
              </div>
              <KeineAlarmierung text={T.keineAlarmierung} />
            </>
          ) : (
            <GeraetAbschnitt zustand={zustand} arbeit={arbeit} onEin={einschalten} onAus={() => void ausschalten()} onProbe={() => void probe()} />
          )}

          {stand?.eingerichtet && (
            <>
              <AnlaesseAbschnitt anlaesse={stand.anlaesse} onSchalter={anlassUmschalten} />
              <RuheAbschnitt person={stand.person} jetzt={jetzt} onRuhe={(t) => ruheAendern(t)} onMitteilungInRuhe={(an) => ruheAendern({}, an)} />
              <GeraeteListe geraete={stand.geraete} dieseKennung={geraet?.kennung ?? null} laeuft={geraetLaeuft}
                onAbmelden={(g, dieses) => void geraetAbmeldenListe(g, dieses)} />
            </>
          )}

          {stand?.darf_organisation && (
            <>
              <Abschnitt titel="Leitung" />
              <div className="bv-flaeche">
                <button type="button" className="bv-z" data-probe="push-org-link" onClick={orgOeffnen}>
                  <span className="bv-tx">
                    <b>{T.orgZeile}</b>
                    <small>{darfMitteilung(user) ? 'Anlässe der Organisation und Mitteilung an alle' : T.orgZeileUnter}</small>
                  </span>
                  <Icon n="weiter" className="bv-pfeil" />
                </button>
              </div>
            </>
          )}
        </div>
      </Seite>
      {toast}
    </>
  )
}
