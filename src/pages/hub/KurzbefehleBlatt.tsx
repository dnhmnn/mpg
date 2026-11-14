// Kurzbefehle: Sprünge in häufige Module und das Umschalten der Darstellung.
// Geöffnet über den Knopf mit den Reglern im roten Kopf. Welche erscheinen, legt jeder auf
// seinem Gerät fest („Bearbeiten“, localStorage hub_shortcuts); gezeigt werden nur
// Kurzbefehle, deren Modul der Benutzer nutzen darf.

import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTheme, setTheme, applyTheme } from '../../lib/theme'
import { ALL_APPS } from '../../lib/apps'
import { SchalterZeile } from '../benutzer/bausteine'
import Blatt from './Blatt'

export const KURZBEFEHLE = [
  { id: 'protokoll',   name: 'Protokoll anlegen',          url: '/patienten' },
  { id: 'mpg',         name: 'MPG Prüfung starten',        url: '/mpg' },
  { id: 'ausbildung',  name: 'Ausbildungstermin anlegen',  url: '/ausbildungen' },
  { id: 'lernmodul',   name: 'Lernmodul erstellen',        url: '/lernbar' },
  { id: 'lernkonzept', name: 'Lernkonzept erstellen',      url: '/lernbar' },
  { id: 'einbuchen',   name: 'Artikel einbuchen',          url: '/lager' },
  { id: 'ausbuchen',   name: 'Artikel ausbuchen',          url: '/lager' },
  { id: 'inventur',    name: 'Inventur starten',           url: '/lager' },
  { id: 'darkmode',    name: 'Darstellung umschalten',     url: null },
  { id: 'dateien',     name: 'Dateien suchen',             url: '/files' },
] as const

type KurzId = typeof KURZBEFEHLE[number]['id']

const PFADE: Record<KurzId, ReactNode> = {
  protokoll: <><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></>,
  mpg: <><path d="M9 12l2 2 4-4" /><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" /></>,
  ausbildung: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  lernmodul: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  lernkonzept: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
  einbuchen: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  ausbuchen: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  inventur: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><polyline points="3 6 4 7 6 5" /><polyline points="3 12 4 13 6 11" /><polyline points="3 18 4 19 6 17" /></>,
  darkmode: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  dateien: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
}

function lesen(): string[] {
  try {
    const roh = JSON.parse(localStorage.getItem('hub_shortcuts') || 'null')
    if (Array.isArray(roh)) return roh.filter((x): x is string => typeof x === 'string')
  } catch { /* unlesbar */ }
  return KURZBEFEHLE.map((k) => k.id)
}

export default function KurzbefehleBlatt({ appErlaubt, onClose }: { appErlaubt: (id: string) => boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [an, setAn] = useState<string[]>(lesen)
  const [bearbeiten, setBearbeiten] = useState(false)

  // Ein Kurzbefehl führt in ein Modul: nur zeigen, wenn dessen Kachel erlaubt ist
  const erlaubt = (url: string | null) => {
    if (!url) return true
    const id = Object.keys(ALL_APPS).find((k) => ALL_APPS[k].url === url) ?? (url === '/lernbar' ? 'lernbar' : undefined)
    return !id || appErlaubt(id)
  }
  const liste = KURZBEFEHLE.filter((k) => erlaubt(k.url))
  const sichtbar = liste.filter((k) => an.includes(k.id))

  function setzen(id: string, ein: boolean) {
    const neu = ein ? [...an.filter((x) => x !== id), id] : an.filter((x) => x !== id)
    setAn(neu)
    try { localStorage.setItem('hub_shortcuts', JSON.stringify(neu)) } catch { /* Speicher voll */ }
  }

  function los(id: KurzId, url: string | null) {
    onClose()
    if (id === 'darkmode') {
      const neu = getTheme() === 'dark' ? 'light' : 'dark'
      setTheme(neu); applyTheme(neu)
    } else if (url) navigate(url)
  }

  return (
    <Blatt titel="Kurzbefehle" probe="hub-kurzbefehle" onClose={onClose}
      aktion={{ text: bearbeiten ? 'Fertig' : 'Bearbeiten', onClick: () => setBearbeiten((b) => !b) }}>
      {bearbeiten ? (
        <>
          <p className="bv-hinweis oben">Wähle, welche Kurzbefehle erscheinen. Gilt auf diesem Gerät.</p>
          <div className="bv-flaeche">
            {liste.map((k) => <SchalterZeile key={k.id} titel={k.name} an={an.includes(k.id)} onChange={(ein) => setzen(k.id, ein)} />)}
          </div>
        </>
      ) : sichtbar.length ? (
        <div className="bv-flaeche">
          {sichtbar.map((k) => (
            <button key={k.id} type="button" className="bv-z" data-probe="hub-kurzbefehl" data-id={k.id} onClick={() => los(k.id, k.url)}>
              <span className="hub-kurz-symbol"><svg className="bv-i" viewBox="0 0 24 24" aria-hidden="true">{PFADE[k.id]}</svg></span>
              <span className="bv-tx"><b>{k.name}</b></span>
            </button>
          ))}
        </div>
      ) : (
        <p className="bv-leer">Keine Kurzbefehle gewählt. Tippe auf „Bearbeiten“.</p>
      )}
    </Blatt>
  )
}
