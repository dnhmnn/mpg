// Hub (/hub): Startseite nach dem Login im Dunkelrot-Design.
//
// Rahmen wie die Benutzerverwaltung (Seite, BV_CSS, useStatusleiste; CLAUDE.md, „Seiten im
// Dunkelrot-Design“): roter Kopf mit Organisation, Datum und Gruß, darunter das Elfenbein-Blatt
// mit Mitteilung der Organisation, Neuigkeiten und den Apps. Die Seite rollt im Fenster; nichts
// ist fest oder klebend am Rand. Blätter (Kurzbefehle, Profil) gibt es nur, solange sie offen sind.
//
// Welche Apps im Hub stehen und in welcher Reihenfolge, entscheidet jeder selbst
// („Apps anpassen“, /hub?seite=apps; src/lib/hubApps.ts, Feld users.hub_apps).
// Nach Updates erscheint einmal „Neu in Responda“ (src/components/NeuInResponda.tsx),
// nach der Begrüßung und nach einer laufenden Einführung.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { useStatusleiste } from '../hooks/useStatusleiste'
import Einfuehrung, { EinfuehrungAutomatisch, useEinfuehrungStand } from '../components/Einfuehrung'
import NeuInResponda from '../components/NeuInResponda'
import { istVerantwortlich, vermerken, type Teil } from '../lib/einfuehrung'
import { befristetBis } from '../lib/hubApps'
import { pb } from '../lib/pocketbase'
import { BV_CSS } from './benutzer/stil'
import { Abschnitt, Icon, Seite } from './benutzer/bausteine'
import { HUB_CSS } from './hub/stil'
import { useHubApps } from './hub/useHubApps'
import Kacheln from './hub/Kacheln'
import NeuigkeitenListe from './hub/NeuigkeitenListe'
import Mitteilung from './hub/Mitteilung'
import KurzbefehleBlatt from './hub/KurzbefehleBlatt'
import ProfilBlatt, { anzeigeName, initialen } from './hub/ProfilBlatt'
import AppsSeite from './hub/AppsSeite'

// Die Seite rollt je nach Darstellung im Fenster oder im body (wie in Unitarii.tsx)
const scrollPos = () => Math.max(window.scrollY, document.body.scrollTop, document.documentElement.scrollTop)
function scrollZu(y: number) {
  window.scrollTo(0, y)
  document.body.scrollTop = y
  document.documentElement.scrollTop = y
}

interface InstallEreignis extends Event { prompt: () => Promise<void>; userChoice: Promise<unknown> }

export default function Hub() {
  // Statusleiste rot nur, solange der rote Kopf zu sehen ist (CLAUDE.md, Safari 26)
  useStatusleiste('--lbf-kopf', { kopf: '.bv-kopf' })
  const navigate = useNavigate()
  const location = useLocation()
  const [sp] = useSearchParams()
  const seiteApps = sp.get('seite') === 'apps'
  const { user, loading, logout, refresh } = useAuth()
  const apps = useHubApps(user)
  const { currentNotification, dismissNotification, remindLater } = useNotifications(user)

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
  const [blatt, setBlatt] = useState<'kurz' | 'profil' | null>(null)
  const schliessenBlatt = useCallback(() => setBlatt(null), [])

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

  // Zurück aus „Apps anpassen“: wieder dort, wo man war
  const hubScroll = useRef(0)
  useEffect(() => {
    if (seiteApps) scrollZu(0)
    else requestAnimationFrame(() => scrollZu(hubScroll.current))
  }, [seiteApps])

  function appsOeffnen() {
    hubScroll.current = scrollPos()
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

  const einfuehrungOffen = einfuehrungAuto || einfuehrungTeile !== null
  const datum = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  const ausgeblendet = apps.erlaubt.length - apps.kacheln.length
  const mitteilung = currentNotification && !hinweisOffen ? currentNotification : null
  const appErlaubt = (id: string) => apps.erlaubt.includes(id)

  // Eine Wurzel für Hub und „Apps anpassen“: Hinweis und Einführung bleiben beim Wechsel stehen
  return (
    <>
      {stil}
      {seiteApps ? <AppsSeite user={user} orgName={orgName} apps={apps} schliessen={appsSchliessen} /> : (
        <Seite titel={orgName} unter={datum}
          links={<span className="bv-rund hell hub-zeichen" aria-hidden="true"><img src="/logoklein.svg" alt="" /></span>}
          rechts={<>
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

          {mitteilung && (
            <Mitteilung titel={mitteilung.title} text={mitteilung.message} organisation={user?.organization_name}
              onVerstanden={dismissNotification} onSpaeter={remindLater} />
          )}

          <NeuigkeitenListe user={user} erst={!mitteilung} />

          <section data-probe="hub-apps">
            <Abschnitt titel="Apps" rechts={ausgeblendet > 0 ? `${apps.kacheln.length} von ${apps.erlaubt.length}` : undefined} />
            {apps.kacheln.length
              ? <Kacheln ids={apps.kacheln} befristetBis={(id) => apps.befristet.includes(id) ? befristetBis(user, id) : 0} />
              : <div className="bv-notiz"><p>Du hast noch keine Apps. Die Verantwortlichen deiner Organisation vergeben die Rechte.</p></div>}
            <div className="bv-flaeche" style={{ marginTop: 22 }}>
              <button type="button" className="bv-z" data-probe="hub-apps-anpassen-zeile" onClick={appsOeffnen}>
                <span className="bv-tx"><b>Apps anpassen</b><small>{ausgeblendet > 0 ? `${ausgeblendet} ausgeblendet` : 'Auswahl und Reihenfolge'}</small></span>
                <Icon n="weiter" className="bv-pfeil" />
              </button>
            </div>
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
        <NeuInResponda user={user} bereit={begruessungVorbei && !einfuehrungOffen && !seiteApps} onOffen={setHinweisOffen} />
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
