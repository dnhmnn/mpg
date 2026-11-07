import { createContext, useContext, useEffect, useState } from 'react'
import { useParams, Outlet } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { formularFrei } from '../../lib/freigabe'
import { formConfigLesen } from '../../lib/formular/einstellung'
import { angemeldetTrotzAusgeschaltet } from '../../lib/formular/absender'
import type { User } from '../../types'
import Warteschlange from './absender/Warteschlange'

export interface Organization {
  id: string
  org_code: string
  org_name: string
  logo: string
  is_active: boolean
  form_config?: Record<string, unknown>
  /** Freigeschaltete Module (Supervisor); fehlt es, ist alles frei. */
  freigeschaltet?: unknown
}

interface OrgCtx { org: Organization; orgCode: string }
const OrgContext = createContext<OrgCtx | null>(null)

/**
 * Die Organisation von außen setzen.
 *
 * Die öffentliche Maske holt sie aus dem Pfad (/<org-code>/…). In der
 * angemeldeten App steht sie am Benutzer — dieselbe Maske soll dort ohne
 * Umweg über den Pfad laufen, deshalb lässt sich der Zusammenhang auch
 * direkt stellen.
 */
export function OrgKontext({ org, orgCode, children }: {
  org: Organization; orgCode: string; children: React.ReactNode
}) {
  return <OrgContext.Provider value={{ org, orgCode }}>{children}</OrgContext.Provider>
}
/**
 * Ein öffentliches Formular nur zeigen, wenn sein Modul für die Organisation
 * freigeschaltet ist und die Organisation es nicht ausgeschaltet hat
 * (Vorgänge → Formulare). Wer über einen alten Link oder QR-Code kommt, sieht
 * einen Hinweis statt des Formulars.
 */
/** Die Anmeldung auf diesem Gerät, falls gültig (ohne Anfrage an den Server). */
export function angemeldeteSitzung(): User | null {
  try {
    if (!pb.authStore.isValid) return null
    return (pb.authStore.record ?? pb.authStore.model) as unknown as User | null
  } catch {
    return null
  }
}

/**
 * Was ein Mitglied tun kann, wenn der öffentliche Link aus ist (Befund Client-Abläufe 11).
 * Patientendoku: in Unitas „Neues Protokoll“; Produktausgabe und Defektmeldung: angemeldet
 * diesen Link oder QR-Code erneut öffnen.
 */
export function angemeldetWegText(formular: string): string {
  if (formular === 'patienten') {
    return 'Der öffentliche Link ist aus. Mitglieder eurer Organisation dokumentieren angemeldet weiter: anmelden, dann in Unitas „Neues Protokoll“.'
  }
  return 'Der öffentliche Link ist aus. Mitglieder eurer Organisation senden angemeldet weiter: anmelden, dann diesen Link oder QR-Code erneut öffnen.'
}

export function FormularFrei({ formular, children }: { formular: string; children: React.ReactNode }) {
  const { org, orgCode } = useOrg()
  // form_config kann als Objekt, als Text oder doppelt kodiert ankommen
  const aus = formConfigLesen(org.form_config).hidden_forms
  const ausgeschaltet = Array.isArray(aus) && aus.includes(formular)
  const frei = formularFrei(org, formular)
  if (frei && !ausgeschaltet) return <>{children}</>
  // Ausgeschaltet heißt nur „öffentlicher Link aus“: angemeldete Mitglieder der Organisation senden weiter
  if (frei && angemeldetTrotzAusgeschaltet(angemeldeteSitzung(), org.id, formular)) return <>{children}</>
  // Öffentlicher Link aus, aber Mitglieder senden angemeldet weiter (PO-Entscheidung 3): den Weg nennen
  const mitAnmeldung = frei && ausgeschaltet && ['patienten', 'produktausgabe', 'defektmeldung'].includes(formular)
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--lbf-card)', borderRadius: 16, boxShadow: 'var(--lbf-shadow)', padding: '28px 24px', maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>{org.org_name}</div>
        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 19, color: 'var(--lbf-text)', marginBottom: 8 }}>{mitAnmeldung ? 'Nur mit Anmeldung' : ausgeschaltet ? 'Ausgeschaltet' : 'Nicht freigeschaltet'}</div>
        {mitAnmeldung ? (
          <>
            <div style={{ fontSize: 14, color: 'var(--warm-gray)', lineHeight: 1.5, marginBottom: 18 }}>{angemeldetWegText(formular)}</div>
            <a href="/login" style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 10, background: 'var(--lbf-akzent-grund)', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Anmelden</a>
            <div style={{ marginTop: 14 }}>
              <a href={`/${orgCode}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--lbf-akzent)', textDecoration: 'none' }}>Zur Seite der Organisation</a>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: 'var(--warm-gray)', lineHeight: 1.5, marginBottom: 18 }}>{ausgeschaltet ? 'Eure Organisation hat dieses Formular ausgeschaltet.' : 'Dieses Formular ist für eure Organisation nicht freigeschaltet.'} Bei Fragen wende dich an die Verantwortlichen deiner Organisation.</div>
            <a href={`/${orgCode}`} style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 10, background: 'var(--lbf-akzent-grund)', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Zur Seite der Organisation</a>
          </>
        )}
      </div>
    </div>
  )
}

export function useOrg() {
  const c = useContext(OrgContext)
  if (!c) throw new Error('useOrg outside OrgPublicLayout')
  return c
}

export default function OrgPublicLayout() {
  const { orgCode } = useParams<{ orgCode: string }>()
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgCode) { setError('Kein Organisationscode.'); setLoading(false); return }
    const cacheKey = `org_cache_${orgCode}`
    pb.collection('organizations').getFirstListItem<Organization>(pb.filter('org_code = {:code}', { code: orgCode }))
      .then(r => {
        if (r.is_active) {
          localStorage.setItem(cacheKey, JSON.stringify(r))
          setOrg(r)
        } else {
          setError('Organisation nicht aktiv.')
        }
      })
      .catch(() => {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          setOrg(JSON.parse(cached))
        } else {
          setError('Organisation nicht gefunden.')
        }
      })
      .finally(() => setLoading(false))
  }, [orgCode])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 15 }}>Lade Organisation…</p>
      </div>
    </div>
  )

  if (error || !org) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 20, padding: '2rem', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-md)' }}>
        <h2 style={{ color: 'var(--accent)', margin: '0 0 .5rem', fontSize: '1.2rem' }}>Fehler</h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 15 }}>{error}</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <OrgContext.Provider value={{ org, orgCode: orgCode! }}>
        {/* Was auf diesem Gerät auf das Senden wartet (Bauplan v2, 4.3); leer: nichts */}
        <Warteschlange orgCode={orgCode!} org={org} />
        <Outlet />
      </OrgContext.Provider>
    </div>
  )
}
