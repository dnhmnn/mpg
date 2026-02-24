import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Hub from './pages/Hub'
import Login from './pages/Login'
import Index from './pages/Index'
import './styles/globals.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/hub" element={<Hub />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
