// Hygiene (/hygiene) im Dunkelrot-Design, Owner 23.11.2026: Fahrzeuge, Räume, Rucksäcke, Geräte und Material
// (z. B. Blutdruckmanschette) mit Intervall und Checkliste; Desinfektionen nach Plan oder aus Anlass (mit
// Einsatznummer) werden als unveränderlicher Nachweis eingetragen. Überfällig wird nur angezeigt, nichts
// gesperrt. Vorschläge aus MPG und Lager über die Route /api/responda/hygiene/quellen.
// Eintragen: jede Person mit Zugang; Einrichten: „Hygiene verwalten“ (src/lib/hygiene/rechte.ts).
// Seiten in der Adresse wie bei den Einsätzen: ?seite=objekte, objekt&id, durchfuehren&id(&anlass=1),
// neu, bearbeiten&id, vorschlaege, nachweise, nachweis&id. Rechnung in src/lib/hygiene/.
import React, { useLayoutEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useStatusleiste } from '../hooks/useStatusleiste'
import { darfHygiene, darfHygieneVerwalten } from '../lib/hygiene/rechte'
import { Hinweis, Seite, Toast } from './benutzer/bausteine'
import { BV_CSS } from './benutzer/stil'
import { HY_CSS } from './hygiene/stil'
import { useHygieneDaten } from './hygiene/daten'
import { Nachweis, Nachweise, Objekt, Objekte, Start } from './hygiene/seiten'
import { Durchfuehren, ObjektForm, Vorschlaege } from './hygiene/formulare'
import Zwischenschirm from '../components/Zwischenschirm'

const STIL = BV_CSS + HY_CSS
const scrollOben = () => { window.scrollTo(0, 0); document.body.scrollTop = 0; document.documentElement.scrollTop = 0 }

export interface HyProps {
  d: ReturnType<typeof useHygieneDaten>
  user: ReturnType<typeof useAuth>['user']
  orgName: string
  verwalten: boolean
  oeffne: (seite: string, p?: Record<string, string>) => void
  /** Ersetzt die aktuelle Unterseite (nach dem Speichern) */
  ersetze: (seite: string, p?: Record<string, string>) => void
  zurueck: () => void
  zurHub: () => void
}

export default function Hygiene() {
  const { user, loading: authLoading } = useAuth()
  useStatusleiste('--lbf-kopf', { kopf: '.bv-kopf' })
  const navigate = useNavigate()
  const ort = useLocation()
  const [adr] = useSearchParams()
  const seite = adr.get('seite') || ''
  const id = adr.get('id') || ''
  const d = useHygieneDaten(user)
  useLayoutEffect(() => { scrollOben() }, [seite, id])

  function oeffne(s: string, p: Record<string, string> = {}) {
    navigate({ search: `?${new URLSearchParams({ seite: s, ...p })}` }, { state: { hyUnter: true } })
  }
  function ersetze(s: string, p: Record<string, string> = {}) {
    navigate({ search: s ? `?${new URLSearchParams({ seite: s, ...p })}` : '' }, { replace: true, state: ort.state })
  }
  function zurueck() {
    if ((ort.state as { hyUnter?: boolean } | null)?.hyUnter) navigate(-1)
    else navigate({ search: '' }, { replace: true })
  }

  const orgName = user?.organization_name || 'Responda'
  if (authLoading) return <><style>{STIL}</style><Zwischenschirm /></>
  if (!darfHygiene(user)) {
    return (
      <><style>{STIL}</style>
        <Seite titel="Hygiene" unter={orgName} zurueck={() => navigate('/hub')} zurueckLabel="Zurück zur Übersicht">
          <Hinweis oben>Für die Hygiene fehlt dir der Zugang. Die Leitung kann ihn in der Benutzerverwaltung geben.</Hinweis>
        </Seite>
      </>
    )
  }
  const p: HyProps = { d, user, orgName, verwalten: darfHygieneVerwalten(user), oeffne, ersetze, zurueck, zurHub: () => navigate('/hub') }
  const anlass = adr.get('anlass') === '1'
  // Vom Objekt aus geöffnet? Dann nach dem Speichern zurück statt die Objektseite ein zweites Mal in den Verlauf
  const vonObjekt = adr.get('von') === 'objekt'

  let inhalt: React.ReactNode
  switch (seite) {
    case 'objekte': inhalt = <Objekte {...p} filter={adr.get('lage') || ''} waehlen={adr.get('waehlen') === '1'} anlass={anlass} />; break
    case 'objekt': inhalt = <Objekt {...p} id={id} />; break
    case 'durchfuehren': inhalt = <Durchfuehren key={`${id}:${anlass}`} {...p} id={id} anlass={anlass} vonObjekt={vonObjekt} />; break
    case 'neu': inhalt = <ObjektForm key="neu" {...p} />; break
    case 'bearbeiten': inhalt = <ObjektForm key={id} {...p} id={id} vonObjekt={vonObjekt} />; break
    case 'vorschlaege': inhalt = <Vorschlaege {...p} org={user?.organization_id || ''} />; break
    case 'nachweise': inhalt = <Nachweise {...p} />; break
    case 'nachweis': inhalt = <Nachweis {...p} id={id} />; break
    default: inhalt = <Start {...p} />
  }
  const mitLeiste = ['durchfuehren', 'neu', 'bearbeiten', 'vorschlaege'].includes(seite)
  return (
    <>
      <style>{STIL}</style>
      {inhalt}
      {d.meldung && <Toast text={d.meldung.text} fehler={d.meldung.fehler} hoch={mitLeiste} onClose={() => d.setMeldung(null)} />}
    </>
  )
}
