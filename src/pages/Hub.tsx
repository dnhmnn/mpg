// Hub (/hub): Startseite nach dem Login im Dunkelrot-Design.
//
// Gemeinsamer Rahmen (Seite, BV_CSS, useStatusleiste; CLAUDE.md, „Seiten im Dunkelrot-Design“),
// als statische Seite („Statische Seiten“, festgelegt vom Owner am 14.11.2026): Der Hub rollt
// nicht. Roter Kopf mit Zeichen und den runden Knöpfen (Glocke, Kurzbefehle, Profil), darunter die
// Organisation voll ausgeschrieben, Datum und Gruß; im Elfenbein-Blatt nur die Apps. Passen nicht
// alle, stehen sie auf Seiten zum Wischen mit Pfeilen (hub/AppSeiten.tsx, src/lib/hubSeiten.ts).
// Passt nicht einmal eine Reihe (Zoom), rollt das Blatt innen (Notausgang, Seite rolltInnen).
// Neuigkeiten und die Mitteilung der Organisation stehen hinter der Glocke (hub/GlockeBlatt.tsx).
// Blätter (Glocke, Kurzbefehle, Profil) gibt es nur, solange sie offen sind.
//
// Welche Apps im Hub stehen und in welcher Reihenfolge, entscheidet jeder selbst
// („Apps anpassen“, /hub?seite=apps; src/lib/hubApps.ts, Feld users.hub_apps). Diese Unterseite
// ist eine normale rollende Seite im Standardrahmen.
// Nach Updates erscheint einmal „Neu in Responda“ (src/components/NeuInResponda.tsx),
// nach der Begrüßung und nach einer laufenden Einführung. Eine Mitteilung der Organisation öffnet
// das Blatt der Glocke einmal von selbst, wenn nichts anderes im Weg ist (useMitteilungAutomatisch).

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { useStatusleiste } from '../hooks/useStatusleiste'
import Einfuehrung, { EinfuehrungAutomatisch, useEinfuehrungStand } from '../components/Einfuehrung'
import NeuInResponda from '../components/NeuInResponda'
import { istVerantwortlich, vermerken, type Teil } from '../lib/einfuehrung'
import { befristetBis } from '../lib/hubApps'
import { glockeAnzahl } from '../lib/hubGlocke'
import { pb } from '../lib/pocketbase'
import { BV_CSS } from './benutzer/stil'
import { Seite } from './benutzer/bausteine'
import { HUB_CSS } from './hub/stil'
import { useHubApps } from './hub/useHubApps'
import { useNeuigkeiten } from './hub/useNeuigkeiten'
import AppSeiten from './hub/AppSeiten'
import GlockeKnopf, { useMitteilungAutomatisch } from './hub/Glocke'
import GlockeBlatt from './hub/GlockeBlatt'
import KurzbefehleBlatt from './hub/KurzbefehleBlatt'
import ProfilBlatt, { anzeigeName, initialen } from './hub/ProfilBlatt'
import AppsSeite from './hub/AppsSeite'

// „Apps anpassen“ rollt je nach Darstellung im Fenster oder im body (wie in Unitarii.tsx)
function nachOben() {
  window.scrollTo(0, 0)
  document.body.scrollTop = 0
  document.documentElement.scrollTop = 0
}

interface InstallEreignis extends Event { prompt: () => Promise<void>; userChoice: Promise<unknown> }

export default function Hub() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sp] = useSearchParams()
  const seiteApps = sp.get('seite') === 'apps'
  // Hub statisch: oben der feste rote Streifen, html und body hell und fest (kein Scrollen).
  // „Apps anpassen“ rollt wie die Benutzerverwaltung: rot nur, solange der Kopf zu sehen ist.
  // Der Wechsel räumt das eine auf, bevor das andere gilt (CLAUDE.md, Safari 26).
  useStatusleiste('--lbf-kopf', seiteApps ? { kopf: '.bv-kopf' } : { statisch: true })
  const { user, loading, logout, refresh } = useAuth()
  const apps = useHubApps(user)
  const { currentNotification, dismissNotification, remindLater } = useNotifications(user)
  // Einmal im Hub geladen, damit die Glocke ihre Zahl kennt, ohne dass das Blatt offen ist
  const neuigkeiten = useNeuigkeiten(user)

  // Einführung: automatisch beim ersten Login, sonst über das Profil
  const [einfuehrungTeile, setEinfuehrungTeile] = useState<Teil[] | null>(null)
  const [einfuehrungAuto, setEinfuehrungAuto] = useState(false)
  const { standRef: einfuehrungStandRef, speichern: einfuehrungSpeichern } = useEinfuehrungStand(user ?? null)

  // Begrüßung nach dem Login (2,4 s), danach aus dem DOM
  const [begruessung] = useState(() => {
    try {
      if (sessionStorage.getItem('justLoggedIn')) { sessionStorage.removeItem('justLoggedIn'); return true }
    } catch { /* gesperrt */ }
    return false
  })
  const [begruessungVorbei, setBegruessungVorbei] = useState(!begruessung)
  useEffect(() => {
    if (!begruessung || !user?.id) return
    const t = window.setTimeout(() => setBegruessungVorbei(true), 2400)
    return () => window.clearTimeout(t)
  }, [begruessung, user?.id])

  const [hinweisOffen, setHinweisOffen] = useState(false)
  const [blatt, setBlatt] = useState<'glocke' | 'kurz' | 'profil' | null>(null)
  const schliessenBlatt = useCallback(() => setBlatt(null), [])

  const einfuehrungOffen = einfuehrungAuto || einfuehrungTeile !== null
  // Eine Mitteilung der Organisation darf nicht untergehen: Das Blatt geht für jede einmal von selbst
  // auf, nach Begrüßung, Einführung und „Neu in Responda“, nie über einem anderen Blatt oder in „Apps anpassen“
  useMitteilungAutomatisch({
    nutzerId: user?.id,
    mitteilungId: currentNotification?.id,
    bereit: !!user && begruessungVorbei && !einfuehrungOffen && !hinweisOffen && !seiteApps && blatt === null,
    oeffnen: () => setBlatt('glocke'),
  })

  // Installation als App (Android, Chrome); Safari bietet das nicht an
  const installRef = useRef<InstallEreignis | null>(null)
  useEffect(() => {
    const merken = (e: Event) => { e.preventDefault(); installRef.current = e as InstallEreignis }
    window.addEventListener('beforeinstallprompt', merken)
    return () => window.removeEventListener('beforeinstallprompt', merken)
  }, [])
  async function installieren(): Promise<boolean> {
    const e = installRef.current
    if (!e) return false
    try { await e.prompt(); await e.userChoice } catch { /* abgebrochen */ }
    installRef.current = null
    return true
  }

  // Eigener Datensatz geändert (befristetes Recht, App-Auswahl auf einem anderen Gerät): neu laden
  useEffect(() => {
    if (!user?.id) return
    const id = user.id
    pb.collection('users').subscribe(id, async () => { await refresh() }).catch(() => { /* ohne Echtzeit: beim nächsten Öffnen */ })
    return () => { pb.collection('users').unsubscribe(id).catch(() => { /* egal */ }) }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // „Apps anpassen“ beginnt oben; zurück im Hub steht die Seite der Apps, auf der man war
  const appSeite = useRef(0)
  const appSeiteMerken = useCallback((n: number) => { appSeite.current = n }, [])
  // Notausgang: Passt nicht einmal eine Reihe Apps (Zoom, sehr wenig Höhe), rollt das Blatt innen
  const [rolltInnen, setRolltInnen] = useState(false)
  useEffect(() => { if (seiteApps) nachOben() }, [seiteApps])

  function appsOeffnen() {
    setBlatt(null)
    navigate({ search: '?seite=apps' }, { state: { hubUnter: true } })
  }
  function appsSchliessen() {
    // Selbst geöffnet: einen Schritt zurück, damit die Seite nicht im Verlauf hängen bleibt
    if ((location.state as { hubUnter?: boolean } | null)?.hubUnter) navigate(-1)
    else navigate({ pathname: '/hub', search: '' }, { replace: true })
  }

  const orgName = user?.organization_name || 'Responda'
  const vorname = anzeigeName(user).split(' ')[0]
  const stil = <style>{BV_CSS + HUB_CSS}</style>

  if (loading) return stil

  const datum = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  const ausgeblendet = apps.erlaubt.length - apps.kacheln.length
  const appErlaubt = (id: string) => apps.erlaubt.includes(id)

  // Eine Wurzel für Hub und „Apps anpassen“: Hinweis und Einführung bleiben beim Wechsel stehen
  return (
    <>
      {stil}
      {seiteApps ? <AppsSeite user={user} orgName={orgName} apps={apps} schliessen={appsSchliessen} /> : (
        <Seite titel={orgName} unter={datum} statisch rolltInnen={rolltInnen} titelUnten
          links={<span className="bv-rund hell hub-zeichen" aria-hidden="true"><img src="/logoklein.svg" alt="" /></span>}
          rechts={<>
            {/* Von Hand geöffnet merkt das Blatt die Mitteilung als gesehen: es geht für sie nicht mehr von selbst auf */}
            <GlockeKnopf anzahl={glockeAnzahl(neuigkeiten, currentNotification)} onClick={() => setBlatt('glocke')} />
            <button type="button" className="bv-rund hub-kopfknopf" aria-label="Kurzbefehle" aria-haspopup="dialog" data-probe="hub-kurzbefehle-knopf" onClick={() => setBlatt('kurz')}>
              <svg className="bv-i" viewBox="0 0 24 24" aria-hidden="true">
                <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
                <circle cx="9" cy="7" r="2.2" fill="var(--lbf-kopf-feld)" /><circle cx="15" cy="12" r="2.2" fill="var(--lbf-kopf-feld)" /><circle cx="10" cy="17" r="2.2" fill="var(--lbf-kopf-feld)" />
              </svg>
            </button>
            <button type="button" className="bv-rund hell hub-ini" aria-label="Profil und Abmelden" aria-haspopup="dialog" data-probe="hub-profil-knopf" onClick={() => setBlatt('profil')}>
              {initialen(anzeigeName(user))}
            </button>
          </>}
          reiter={<p className="hub-gruss" data-probe="hub-gruss">Servus, <em>{vorname}</em></p>}>

          <section className="hub-apps" data-probe="hub-apps" aria-labelledby="hub-apps-titel">
            <div className="bv-ab erst">
              <h2 id="hub-apps-titel">Apps</h2>
              <span className="hub-apps-rechts">
                {ausgeblendet > 0 && <span data-probe="hub-apps-zahl">{apps.kacheln.length} von {apps.erlaubt.length}</span>}
                <button type="button" className="hub-anpassen" aria-label="Apps anpassen" data-probe="hub-apps-anpassen-knopf" onClick={appsOeffnen}>Anpassen</button>
              </span>
            </div>
            {apps.kacheln.length
              ? <AppSeiten ids={apps.kacheln} befristetBis={(id) => apps.befristet.includes(id) ? befristetBis(user, id) : 0}
                  start={appSeite.current} onSeite={appSeiteMerken} onRolltInnen={setRolltInnen} />
              : <div className="bv-notiz"><p>Du hast noch keine Apps. Die Verantwortlichen deiner Organisation vergeben die Rechte.</p></div>}
          </section>
        </Seite>
      )}

      {/* Begrüßung nach dem Login, danach aus dem DOM */}
      {begruessung && !begruessungVorbei && user && !seiteApps && (
        <div className="hub-begruessung" data-probe="hub-begruessung" aria-hidden="true">
          <span>Servus,</span>
          <b>{vorname}</b>
        </div>
      )}

      {/* Einführung für neue Benutzer und Organisationen, nach der Begrüßung */}
      <EinfuehrungAutomatisch user={user} verzoegerung={begruessung ? 2600 : 500} onSichtbar={setEinfuehrungAuto} />
      {einfuehrungTeile && user && (
        <Einfuehrung user={user} teile={einfuehrungTeile}
          onEnde={() => { einfuehrungSpeichern(vermerken(einfuehrungStandRef.current, einfuehrungTeile, new Date())); setEinfuehrungTeile(null) }} />
      )}

      {user && (
        <NeuInResponda user={user} bereit={begruessungVorbei && !einfuehrungOffen && !seiteApps && blatt === null} onOffen={setHinweisOffen} />
      )}

      {blatt === 'glocke' && !seiteApps && (
        <GlockeBlatt user={user} neuigkeiten={neuigkeiten} mitteilung={currentNotification} organisation={user?.organization_name}
          onMitteilungVerstanden={dismissNotification} onMitteilungSpaeter={remindLater} onClose={schliessenBlatt} />
      )}
      {blatt === 'kurz' && !seiteApps && <KurzbefehleBlatt appErlaubt={appErlaubt} onClose={schliessenBlatt} />}
      {blatt === 'profil' && user && !seiteApps && (
        <ProfilBlatt user={user} onClose={schliessenBlatt}
          onApps={appsOeffnen}
          onEinstellungen={() => { setBlatt(null); navigate('/settings') }}
          onSupervisor={() => { setBlatt(null); navigate('/supervisor?tab=hinweise') }}
          onEinfuehrung={() => { setBlatt(null); setEinfuehrungTeile(istVerantwortlich(user) ? ['basis', 'organisation'] : ['basis']) }}
          onInstallieren={installieren}
          onAbmelden={() => { setBlatt(null); void logout() }} />
      )}
    </>
  )
}
