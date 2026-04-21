import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Hub from './pages/Hub'
import Login from './pages/Login'
import Index from './pages/Index'
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
import Chat from './pages/Chat'
import './styles/globals.css'
import { applyTheme, getTheme } from './lib/theme'

applyTheme(getTheme())

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
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
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
