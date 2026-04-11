import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Hub from './pages/Hub'
import Login from './pages/Login'
import Index from './pages/Index'
import SettingsPage from './pages/SettingsPage'
import Ausbildungen from './pages/ausbildungen/Ausbildungen'  // ← GEÄNDERT
import Files from './pages/Files'
import Lager from './pages/Lager'
import MPG from './pages/MPG'
import './styles/globals.css'

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
      </Routes>
    </BrowserRouter>
  )
}

export default App
