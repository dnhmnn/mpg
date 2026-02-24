import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Hub from './pages/Hub'
import Login from './pages/Login'
import './styles/globals.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/hub" element={<Hub />} />
        <Route path="/" element={<Hub />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
