import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Index from './pages/Index'

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
const Hub = lazy(() => import('./pages/Hub'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const Ausbildungen = lazy(() => import('./pages/ausbildungen/Ausbildungen'))
const Einladung = lazy(() => import('./pages/ausbildungen/Einladung'))
const Files = lazy(() => import('./pages/Files'))
const Lager = lazy(() => import('./pages/Lager'))
const MPG = lazy(() => import('./pages/MPG'))
const Lernbar = lazy(() => import('./pages/Lernbar'))
const Unitas = lazy(() => import('./pages/Unitas'))
const Unitarii = lazy(() => import('./pages/Unitarii'))
const Patienten = lazy(() => import('./pages/patienten/Patienten'))
const ProtokollBearbeiten = lazy(() => import('./pages/ProtokollBearbeiten'))
const ProtokollMaske = lazy(() => import('./pages/ProtokollMaske'))
const Installieren = lazy(() => import('./pages/public/Installieren'))
const OrgSchnelldoku = lazy(() => import('./pages/public/OrgSchnelldoku'))
const Chat = lazy(() => import('./pages/Chat'))
const Supervisor = lazy(() => import('./pages/Supervisor'))
const Einsaetze = lazy(() => import('./pages/Einsaetze'))
const Vorgaenge = lazy(() => import('./pages/Vorgaenge'))
const AVV = lazy(() => import('./pages/AVV'))
const Office = lazy(() => import('./pages/Office'))
const Notizen = lazy(() => import('./pages/Notizen'))
const Wissen = lazy(() => import('./pages/Wissen'))
const WebsiteEditor = lazy(() => import('./pages/WebsiteEditor'))
const EKS = lazy(() => import('./pages/eks/EKS'))
const EksAuswahl = lazy(() => import('./pages/eks/EksAuswahl'))
const OrgPublicLayout = lazy(() => import('./pages/public/OrgPublicLayout'))
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

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--warm-bg)' }} />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/app" element={<Installieren />} />
        <Route path="/hub" element={<Hub />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/ausbildungen" element={<Ausbildungen />} />
        <Route path="/lager" element={<Lager />} />
        <Route path="/files" element={<Files />} />
        <Route path="/mpg" element={<MPG />} />
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
        <Route path="/protokoll/:patientId" element={<ProtokollMaske />} />
        <Route path="/protokoll-alt/:patientId" element={<ProtokollBearbeiten />} />
        <Route path="/protokoll-2" element={<Suspense fallback={null}><AelrdProtokoll /></Suspense>} />
        <Route path="/datensatz" element={<Suspense fallback={null}><NaepErfassung /></Suspense>} />
        <Route path="/p/:code" element={<PatientView />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/supervisor" element={<Supervisor />} />
        <Route path="/einsaetze" element={<Einsaetze />} />
        <Route path="/vorgaenge" element={<Vorgaenge />} />
        <Route path="/avv" element={<AVV />} />
        <Route path="/office" element={<Office />} />
        <Route path="/notizen" element={<Notizen />} />
        <Route path="/wissen" element={<Wissen />} />
        <Route path="/website" element={<WebsiteEditor />} />
        <Route path="/eks" element={<EksAuswahl />} />
        <Route path="/eks/:einsatzId" element={<EKS />} />
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
            <Route path="patienten" element={<Suspense fallback={null}><Doku /></Suspense>} />
            <Route path="doku" element={<Suspense fallback={null}><Doku /></Suspense>} />
            <Route path="patienten-alt" element={<OrgPatienten />} />
            <Route path="schnelldoku" element={<OrgSchnelldoku />} />
            <Route path="produktausgabe" element={<OrgProduktausgabe />} />
            <Route path="cirs" element={<OrgCirs />} />
            <Route path="formular/:templateId" element={<OrgFormular />} />
            <Route path="defektmeldung" element={<OrgDefektmeldung />} />
          </Route>
        )}
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
