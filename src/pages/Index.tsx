import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import LandingPage from './LandingPage'
import { pb } from '../lib/pocketbase'
import { zielMitSitzung, type AnmeldeKonto } from '../lib/anmeldung'
import { Feld } from './benutzer/bausteine'
import { ZugangRahmen, Zeichen } from './zugang/Rahmen'
import Zwischenschirm from '../components/Zwischenschirm'

const TAGLINES = [
  'Digitalisierung, die zuverlässig funktioniert.',
  'Einsatzbereit. Immer und überall.',
  'Dokumentation, die keine Zeit kostet.',
  'Zuverlässige Lösungen für den Rettungsdienst.',
  'Von der Idee zur digitalen Wirklichkeit.',
  'Sicher. Schnell. Vernetzt.',
]

/**
 * Startseite (/). Die App vom Homebildschirm startet hier: Mit einer gültigen, gespeicherten Sitzung
 * geht es gleich in den Hub (bzw. die Lernbar), sonst die Startseite mit „Anmelden“. Auf der
 * Marketing-Domain bleibt es die Website. Ohne eigene Hooks, damit die Weiche nie die Reihenfolge der
 * Hooks der Startseite ändert.
 */
export default function Index() {
  const website = window.location.hostname === 'responda.systems' || window.location.hostname === 'www.responda.systems'
  if (website) return <LandingPage />
  const ziel = zielMitSitzung(pb.authStore.isValid, pb.authStore.model as AnmeldeKonto | null, Date.now())
  // Weiterleiten mit Sitzung: bis der Hub (bzw. die Lernbar) steht, der rote Zwischenbildschirm, nie eine leere Fläche
  return ziel ? <><Zwischenschirm /><Navigate to={ziel} replace /></> : <IndexStart />
}

/** Startseite der App ohne Anmeldung, ganz in Dunkelrot (src/pages/zugang/Rahmen.tsx). */
function IndexStart() {
  const navigate = useNavigate()
  const [taglineIndex, setTaglineIndex] = useState(0)
  const [orgCode, setOrgCode] = useState('')
  const [orgError, setOrgError] = useState('')
  const [showOrgInput, setShowOrgInput] = useState(false)

  // Leitsatz wechselt alle vier Sekunden; mit reduzierter Bewegung bleibt der erste stehen
  useEffect(() => {
    try { if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return } catch { /* wechseln */ }
    const interval = setInterval(() => setTaglineIndex(i => (i + 1) % TAGLINES.length), 4000)
    return () => clearInterval(interval)
  }, [])

  function handleOrgSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = orgCode.trim().toLowerCase()
    if (!code) { setOrgError('Bitte einen Code eingeben.'); return }
    setOrgError('')
    navigate(`/${code}`)
  }

  return (
    <ZugangRahmen zeichen={<Zeichen />} titel="Responda" zeile={TAGLINES[taglineIndex]} zeileKey={taglineIndex}>
      <div className="zg-karte">
        <Link to="/login" className="zg-haupt">Anmelden</Link>
        <div className="zg-oder">oder</div>
        {!showOrgInput ? (
          <button type="button" className="zg-zweit" onClick={() => setShowOrgInput(true)}>Mit Organisations-Code</button>
        ) : (
          <form onSubmit={handleOrgSubmit}>
            <Feld label="Organisations-Code" fehler={orgError || undefined} erst>
              <input
                className={`bv-eingabe${orgError ? ' fehler' : ''}`}
                value={orgCode}
                onChange={e => { setOrgCode(e.target.value); setOrgError('') }}
                placeholder="z. B. feuerwehr-musterstadt"
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                spellCheck={false}
              />
            </Feld>
            <div className="zg-abstand"><button type="submit" className="zg-zweit">Weiter</button></div>
          </form>
        )}
      </div>
    </ZugangRahmen>
  )
}
