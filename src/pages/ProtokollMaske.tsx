// Die Patientendokumentation für Angemeldete.
//
// Dieselbe Maske wie unter /<org-code>/patienten, nur dass die Organisation
// nicht aus dem Pfad kommt, sondern vom angemeldeten Benutzer — und das
// Protokoll aus der Kennung in der Route.
//
// Damit gibt es eine einzige Maske: im Fahrzeug über den öffentlichen Link,
// in Unitas über "Bearbeiten". Zwei Masken für dasselbe Protokoll hießen zwei
// Gliederungen, zwei Pflichtlisten und zwei Stellen, an denen etwas fehlt.

import { lazy, Suspense } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useOrganisation } from '../hooks/useOrganisation'
import { OrgKontext } from './public/OrgPublicLayout'

const Doku = lazy(() => import('./public/doku/Doku'))

const GRAU = 'var(--warm-gray)'

export default function ProtokollMaske() {
  const { patientId } = useParams<{ patientId: string }>()
  const [suche] = useSearchParams()
  const { org, fehler } = useOrganisation()
  // ?ansehen= öffnet dieselbe Maske, nur dass nichts geschrieben wird.
  const nurLesen = suche.get('ansehen') !== null

  if (fehler) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--warm-bg)' }}>
        <p style={{ color: GRAU, fontStyle: 'italic' }}>{fehler}</p>
      </div>
    )
  }
  if (!org) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--warm-bg)' }}>
        <p style={{ color: GRAU, fontStyle: 'italic' }}>Lade …</p>
      </div>
    )
  }

  return (
    <OrgKontext org={org} orgCode={org.org_code}>
      <Suspense fallback={null}><Doku protokollId={patientId} nurLesen={nurLesen} /></Suspense>
    </OrgKontext>
  )
}
