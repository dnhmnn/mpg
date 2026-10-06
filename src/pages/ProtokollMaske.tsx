// Die Patientendokumentation für Angemeldete.
//
// Dieselbe Maske wie unter /<org-code>/patienten, nur dass die Organisation
// nicht aus dem Pfad kommt, sondern vom angemeldeten Benutzer — und das
// Protokoll aus der Kennung in der Route.
//
// Damit gibt es eine einzige Maske: im Fahrzeug über den öffentlichen Link,
// in Unitas über "Bearbeiten". Zwei Masken für dasselbe Protokoll hießen zwei
// Gliederungen, zwei Pflichtlisten und zwei Stellen, an denen etwas fehlt.

import { lazy, Suspense, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { pb } from '../lib/pocketbase'
import { OrgKontext, type Organization } from './public/OrgPublicLayout'

const Doku = lazy(() => import('./public/doku/Doku'))

const GRAU = 'var(--warm-gray)'

export default function ProtokollMaske() {
  const { patientId } = useParams<{ patientId: string }>()
  const { user } = useAuth()
  const [org, setOrg] = useState<Organization | null>(null)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    const id = user?.organization_id
    if (!id) return
    /*
     * Der Benutzer trägt die Organisation meist schon bei sich — allerdings
     * in der schlankeren Form der App (ohne org_code). Taugt sie, wird sie
     * genommen; sonst wird nachgeladen.
     */
    const dabei = (user as unknown as { organization?: Partial<Organization> }).organization
    if (dabei && typeof dabei.org_code === 'string' && dabei.org_code) {
      setOrg(dabei as Organization)
      return
    }
    pb.collection('organizations').getOne<Organization>(id)
      .then(setOrg)
      .catch(() => setFehler('Die Organisation ließ sich nicht laden.'))
  }, [user])

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

  // Die Maske liest die Kennung aus ?id= — in der angemeldeten App steht sie
  // im Pfad. Sie wird einmal nachgetragen, ohne einen Eintrag im Verlauf.
  if (patientId && !new URLSearchParams(window.location.search).get('id')) {
    const url = new URL(window.location.href)
    url.searchParams.set('id', patientId)
    window.history.replaceState(null, '', url.toString())
  }

  return (
    <OrgKontext org={org} orgCode={org.org_code}>
      <Suspense fallback={null}><Doku /></Suspense>
    </OrgKontext>
  )
}
