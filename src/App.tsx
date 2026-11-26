import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import NeueFassungHinweis from './components/NeueFassungHinweis'
import Zwischenschirm, { startVorbei } from './components/Zwischenschirm'
import Login from './pages/Login'
import Index from './pages/Index'
import { urlSicher } from './lib/push/geraet'
import { appEinblenden, appVonPfad, seite } from './lib/seitenLaden'

import './styles/globals.css'
import { applyTheme, getTheme } from './lib/theme'

/*
 * Jede Seite wird erst geladen, wenn sie gebraucht wird.
 *
 * Fest eingebunden lagen vierunddreißig Seiten in einem einzigen Brocken:
 * zwei Megabyte, die jedes Telefon beim ersten Öffnen zieht, auch wenn es
 * nur das Protokoll ausfüllen will. Und über zwei Megabyte legt der Service
 * Worker nichts mehr in den Vorrat — der Build brach daran ab.
 *
 * Anmeldung und Startseite bleiben fest: sie sind der erste Schirm, und
 * ein zweiter Rundweg wäre dort zu sehen.
 */
const Hub = seite('/hub')
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const SettingsPage = seite('/settings')
const Benachrichtigungen = seite('/benachrichtigungen')
const Ausbildungen = seite('/ausbildungen')
const Einladung = lazy(() => import('./pages/ausbildungen/Einladung'))
const Files = seite('/files')
const Lager = seite('/lager')
const MPG = seite('/mpg')
const Lernbar = seite('/lernbar')
const Unitas = seite('/unitas')
const Unitarii = seite('/unitarii')
const Patienten = seite('/patienten')
const ProtokollBearbeiten = lazy(() => import('./pages/ProtokollBearbeiten'))
const ProtokollMaske = lazy(() => import('./pages/ProtokollMaske'))
const Installieren = lazy(() => import('./pages/public/Installieren'))
const OrgSchnelldoku = lazy(() => import('./pages/public/OrgSchnelldoku'))
const Chat = seite('/chat')
const Supervisor = seite('/supervisor')
const Einsaetze = seite('/einsaetze')
const Hygiene = seite('/hygiene')
const Vorgaenge = seite('/vorgaenge')
const AVV = lazy(() => import('./pages/AVV'))
const Office = seite('/office')
const Notizen = seite('/notizen')
const Wissen = seite('/wissen')
const WebsiteEditor = lazy(() => import('./pages/WebsiteEditor'))
const OrgPublicLayout = lazy(() => import('./pages/public/OrgPublicLayout'))
// Aus demselben Baustein wie das Layout — ist beim Aufruf eines Formulars schon geladen
const FormularFrei = lazy(() => import('./pages/public/OrgPublicLayout').then(m => ({ default: m.FormularFrei })))
const OrgLanding = lazy(() => import('./pages/public/OrgLanding'))
const OrgPatienten = lazy(() => import('./pages/public/OrgPatienten'))
const OrgProduktausgabe = lazy(() => import('./pages/public/OrgProduktausgabe'))
const OrgCirs = lazy(() => import('./pages/public/OrgCirs'))
const OrgFormular = lazy(() => import('./pages/public/OrgFormular'))
const OrgDefektmeldung = lazy(() => import('./pages/public/OrgDefektmeldung'))
const PatientView = lazy(() => import('./pages/public/PatientView'))
const AelrdProtokoll = lazy(() => import('./pages/patienten/AelrdProtokoll'))
const NaepErfassung = lazy(() => import('./pages/patienten/NaepErfassung'))
const Doku = lazy(() => import('./pages/public/doku/Doku'))

// Die Protokollseite zieht Feldkatalog und Druckvorlagen nach sich.
// Beides wird erst gebraucht, wenn jemand das Protokoll oeffnet — im
// Hauptbuendel kostet es jeden Seitenaufruf mit, auch im Funkloch.

// Die normtreue Maske zieht den ganzen DIVI-Katalog nach sich — über
// vierhundert Optionen. Sie gehoert nicht ins Hauptbuendel.

// Der neue Aufbau der Patientendokumentation, vorerst neben dem alten
// Formular. Er zieht den Feldkatalog des Bogens nach sich.

applyTheme(getTheme())

const isMarketingDomain =
  window.location.hostname === 'responda.systems' ||
  window.location.hostname === 'www.responda.systems'

// Auf der Marketing-Domain zeigt / die Startseite. Einteilige Pfade können eigene
// Website-Unterseiten sein — die prüft LandingPage selbst und leitet sonst weiter.
// Mehrteilige Pfade (App-Routen wie /protokoll/xyz) gehen direkt zur App.
if (isMarketingDomain && window.location.pathname.replace(/^\/+|\/+$/g, '').includes('/')) {
  window.location.replace('https://app.responda.systems' + window.location.pathname + window.location.search)
}

// Fix html/body background before first paint so dark-mode globals.css doesn't flash black
if (isMarketingDomain) {
  document.documentElement.style.background = '#faf9f7'
  document.body.style.background = '#faf9f7'
}

/**
 * Tippen auf eine Push-Benachrichtigung bei offenem Fenster: Der Service Worker (public/sw-push.js)
 * holt das Fenster nach vorn und schickt { art: 'push-oeffnen', url }. Die App führt dorthin, nur
 * für Pfade der App (urlSicher, Zwilling der Prüfung im Service Worker).
 */
function PushNavigation() {
  const navigate = useNavigate()
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const sw = navigator.serviceWorker
    const beiNachricht = (e: MessageEvent) => {
      const d = e.data as { art?: unknown; url?: unknown } | null
      if (!d || d.art !== 'push-oeffnen' || typeof d.url !== 'string') return
      if (urlSicher(d.url) !== d.url) return
      navigate(d.url)
    }
    sw.addEventListener('message', beiNachricht)
    return () => sw.removeEventListener('message', beiNachricht)
  }, [navigate])
  return null
}

/**
 * Neue App beginnt oben, und zwar vor ihrem ersten Bild. Sonst stand sie ein Bild lang an der
 * Rollposition der vorigen (der rote Kopf weggerollt, die Statusleiste hell) und sprang dann.
 * Nur beim Wechsel der App (erster Teil des Pfads): Innerhalb einer App regelt sie das selbst
 * (Unterseiten ?seite=, im MPG Liste und Gerät nebeneinander, die Liste bleibt stehen).
 */
function ObenBeginnen() {
  const app = appVonPfad(useLocation().pathname)
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    document.body.scrollTop = 0
    document.documentElement.scrollTop = 0
  }, [app])
  return null
}

/**
 * Sanft einblenden beim Wechsel der App (Owner, 22.11.2026: „Sanft einblenden“): Die neue App kommt in
 * 0,2 s von 35 % Deckkraft, das helle Blatt hebt sich dabei 8 px (CSS html.app-ein in globals.css).
 * Gesetzt vor dem ersten Bild der neuen Seite, nach dem Ende wieder weg, damit später eingehängte
 * Blätter (Unterseiten) nicht mitlaufen. Kein transform auf #root: feste Elemente blieben sonst nicht am Rand.
 */
let einblendenUhr = 0
function AppEinblenden() {
  const { pathname } = useLocation()
  const art = useNavigationType()
  const vorher = useRef(pathname)
  useLayoutEffect(() => {
    const alt = vorher.current
    vorher.current = pathname
    if (!appEinblenden(alt, pathname, art)) return
    const h = document.documentElement
    window.clearTimeout(einblendenUhr)
    h.classList.remove('app-ein')
    void h.offsetWidth // neu starten, falls die vorige Einblendung noch läuft
    h.classList.add('app-ein')
    einblendenUhr = window.setTimeout(() => h.classList.remove('app-ein'), 400)
  }, [pathname, art])
  return null
}

function App() {
  // Erstes Bild der App: Der rote Start aus index.html geht, im selben Bild steht schon die Seite
  // oder der rote Zwischenbildschirm (Ersatzfläche) – kein helles Aufblitzen dazwischen
  useLayoutEffect(() => { startVorbei() }, [])
  return (
    // Ohne v7_startTransition (an der Adresse hängende Suchfelder verloren damit Zeichen): Vorgeladene
    // Seiten erscheinen sofort (src/lib/seitenLaden.ts), sonst steht beim Laden der rote Zwischenbildschirm
    <BrowserRouter>
      <ObenBeginnen />
      <AppEinblenden />
      <PushNavigation />
      <NeueFassungHinweis />
      {/* Ersatzfläche, solange der Baustein einer Seite lädt: der rote Zwischenbildschirm */}
      <Suspense fallback={<Zwischenschirm />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Derselbe Link in anderen Formen: Token im Pfad, alte Seite, PocketBase-Standard mit der App als APP_URL */}
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/password-reset.html" element={<ResetPassword />} />
        <Route path="/_/*" element={<ResetPassword />} />
        <Route path="/app" element={<Installieren />} />
        <Route path="/hub" element={<Hub />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/benachrichtigungen" element={<Benachrichtigungen />} />
        <Route path="/ausbildungen" element={<Ausbildungen />} />
        <Route path="/lager" element={<Lager />} />
        <Route path="/files" element={<Files />} />
        <Route path="/mpg/*" element={<MPG />} />
        <Route path="/einladung/:token" element={<Einladung />} />
        <Route path="/lernbar" element={<Lernbar />} />
        <Route path="/unitas" element={<Unitas />} />
        <Route path="/unitarii" element={<Unitarii />} />
        <Route path="/patienten" element={<Patienten />} />
        {/*
          * Die neue Maske, auch für Angemeldete: ein Protokoll wird überall
          * gleich erfasst und gleich geändert. Das alte Formular bleibt unter
          * /protokoll-alt/:patientId erreichbar.
          */}
        {/* Neues Protokoll aus Unitas, angemeldet gesendet (Bauplan v2, 4.9); vor /protokoll/:patientId */}
        <Route path="/protokoll/neu" element={<ProtokollMaske neu />} />
        <Route path="/protokoll/:patientId" element={<ProtokollMaske />} />
        <Route path="/protokoll-alt/:patientId" element={<ProtokollBearbeiten />} />
        <Route path="/protokoll-2" element={<Suspense fallback={<Zwischenschirm />}><AelrdProtokoll /></Suspense>} />
        <Route path="/datensatz" element={<Suspense fallback={<Zwischenschirm />}><NaepErfassung /></Suspense>} />
        <Route path="/p/:code" element={<PatientView />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/supervisor" element={<Supervisor />} />
        <Route path="/einsaetze" element={<Einsaetze />} />
        <Route path="/hygiene" element={<Hygiene />} />
        <Route path="/vorgaenge" element={<Vorgaenge />} />
        <Route path="/avv" element={<AVV />} />
        <Route path="/office" element={<Office />} />
        <Route path="/notizen" element={<Notizen />} />
        <Route path="/wissen" element={<Wissen />} />
        <Route path="/website" element={<WebsiteEditor />} />
        {/* EKS ist entfernt (Owner, 22.11.2026): alte Lesezeichen und Verknüpfungen führen zu den Einsätzen */}
        <Route path="/eks/*" element={<><Zwischenschirm /><Navigate to="/einsaetze" replace /></>} />
        {isMarketingDomain ? (
          // Auf responda.systems sind einteilige Pfade Website-Unterseiten
          <Route path="/:slug" element={<Index />} />
        ) : (
          <Route path="/:orgCode" element={<OrgPublicLayout />}>
            <Route index element={<OrgLanding />} />
            {/*
              * Die Patientendokumentation ist die neue Maske. Sie liegt auf
              * dem bisherigen Pfad, damit gedruckte Links und Lesezeichen
              * weiter stimmen; /doku bleibt als zweiter Name bestehen.
              *
              * Das alte Formular ist unter /patienten-alt erreichbar — es
              * bleibt, bis die neue Maske im Dienst bestanden hat.
              */}
            <Route path="patienten" element={<FormularFrei formular="patienten"><Suspense fallback={<Zwischenschirm />}><Doku /></Suspense></FormularFrei>} />
            <Route path="doku" element={<FormularFrei formular="patienten"><Suspense fallback={<Zwischenschirm />}><Doku /></Suspense></FormularFrei>} />
            <Route path="patienten-alt" element={<FormularFrei formular="patienten"><OrgPatienten /></FormularFrei>} />
            <Route path="schnelldoku" element={<FormularFrei formular="patienten"><OrgSchnelldoku /></FormularFrei>} />
            <Route path="produktausgabe" element={<FormularFrei formular="produktausgabe"><OrgProduktausgabe /></FormularFrei>} />
            <Route path="cirs" element={<FormularFrei formular="cirs"><OrgCirs /></FormularFrei>} />
            <Route path="formular/:templateId" element={<OrgFormular />} />
            <Route path="defektmeldung" element={<FormularFrei formular="defektmeldung"><OrgDefektmeldung /></FormularFrei>} />
          </Route>
        )}
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
