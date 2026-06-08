import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Hub from './pages/Hub'
import Login from './pages/Login'
import Index from './pages/Index'
import ResetPassword from './pages/ResetPassword'
import SettingsPage from './pages/SettingsPage'
import Ausbildungen from './pages/ausbildungen/Ausbildungen'
import Einladung from './pages/ausbildungen/Einladung'
import Files from './pages/Files'
import Lager from './pages/Lager'
import MPG from './pages/MPG'
import Lernbar from './pages/Lernbar'
import Unitas from './pages/Unitas'
import Unitarii from './pages/Unitarii'
import Patienten from './pages/patienten/Patienten'
import ProtokollBearbeiten from './pages/ProtokollBearbeiten'
import Chat from './pages/Chat'
import Supervisor from './pages/Supervisor'
import Einsaetze from './pages/Einsaetze'
import Vorgaenge from './pages/Vorgaenge'
import AVV from './pages/AVV'
import OrgPublicLayout from './pages/public/OrgPublicLayout'
import OrgLanding from './pages/public/OrgLanding'
import OrgPatienten from './pages/public/OrgPatienten'
import OrgProduktausgabe from './pages/public/OrgProduktausgabe'
import OrgCirs from './pages/public/OrgCirs'
import OrgFormular from './pages/public/OrgFormular'
import OrgDefektmeldung from './pages/public/OrgDefektmeldung'
import PatientView from './pages/public/PatientView'
import './styles/globals.css'
import { applyTheme, getTheme } from './lib/theme'

applyTheme(getTheme())

const isMarketingDomain =
  window.location.hostname === 'responda.systems' ||
  window.location.hostname === 'www.responda.systems'

// On the marketing domain, only / shows the landing page — everything else redirects to the app
if (isMarketingDomain && window.location.pathname !== '/') {
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
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
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
        <Route path="/protokoll/:patientId" element={<ProtokollBearbeiten />} />
        <Route path="/p/:code" element={<PatientView />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/supervisor" element={<Supervisor />} />
        <Route path="/einsaetze" element={<Einsaetze />} />
        <Route path="/vorgaenge" element={<Vorgaenge />} />
        <Route path="/avv" element={<AVV />} />
        <Route path="/:orgCode" element={<OrgPublicLayout />}>
          <Route index element={<OrgLanding />} />
          <Route path="patienten" element={<OrgPatienten />} />
          <Route path="produktausgabe" element={<OrgProduktausgabe />} />
          <Route path="cirs" element={<OrgCirs />} />
          <Route path="formular/:templateId" element={<OrgFormular />} />
          <Route path="defektmeldung" element={<OrgDefektmeldung />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
