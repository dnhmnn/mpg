import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Hub from './pages/Hub'
import Login from './pages/Login'
import Index from './pages/Index'
import SettingsPage from './pages/SettingsPage'
import { useAuth } from './hooks/useAuth'
import './styles/globals.css'

function App() {
  const { user } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/hub" element={<Hub />} />
        <Route path="/settings" element={<SettingsPage user={user} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
