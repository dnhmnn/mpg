import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'
import { useParams, Outlet, useMatch } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { formularFrei } from '../../lib/freigabe'
import { formConfigLesen } from '../../lib/formular/einstellung'
import { angemeldetTrotzAusgeschaltet } from '../../lib/formular/absender'
import type { User } from '../../types'
import Warteschlange from './absender/Warteschlange'
import { ZugangRahmen, Zeichen } from '../zugang/Rahmen'

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

interface OrgCtx {
  org: Organization
  orgCode: string
  /** Eine Seite im roten Zugangsrahmen (Hinweis „Formular aus“) meldet sich an: Das Layout zeigt dann weder
   *  eigenen Hintergrund noch die Warteschlange oben, die Seite bettet sie selbst ein. */
  rahmen?: (an: boolean) => void
}
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
  const { org, orgCode, rahmen } = useOrg()
  // form_config kann als Objekt, als Text oder doppelt kodiert ankommen
  const aus = formConfigLesen(org.form_config).hidden_forms
  const ausgeschaltet = Array.isArray(aus) && aus.includes(formular)
  const frei = formularFrei(org, formular)
  // Ausgeschaltet heißt nur „öffentlicher Link aus“: angemeldete Mitglieder der Organisation senden weiter
  const offen = frei && (!ausgeschaltet || angemeldetTrotzAusgeschaltet(angemeldeteSitzung(), org.id, formular))
  // Der Hinweis steht im roten Rahmen: dem Layout vor dem Zeichnen Bescheid geben
  useLayoutEffect(() => {
    if (offen || !rahmen) return
    rahmen(true)
    return () => rahmen(false)
  }, [offen, rahmen])
  if (offen) return <>{children}</>
  // Öffentlicher Link aus, aber Mitglieder senden angemeldet weiter (PO-Entscheidung 3): den Weg nennen
  const mitAnmeldung = frei && ausgeschaltet && ['patienten', 'produktausgabe', 'defektmeldung'].includes(formular)
  return (
    <OrgHinweisSeite
      titel={org.org_name}
      gruss={mitAnmeldung ? 'Nur mit Anmeldung' : ausgeschaltet ? 'Ausgeschaltet' : 'Nicht freigeschaltet'}
      text={mitAnmeldung
        ? angemeldetWegText(formular)
        : `${ausgeschaltet ? 'Eure Organisation hat dieses Formular ausgeschaltet.' : 'Dieses Formular ist für eure Organisation nicht freigeschaltet.'} Bei Fragen wende dich an die Verantwortlichen deiner Organisation.`}
      orgCode={orgCode}
      anmelden={mitAnmeldung}
      warteschlange={rahmen ? <Warteschlange orgCode={orgCode} org={org} eingebettet /> : undefined}
    />
  )
}

/** Hinweisseite ganz in Dunkelrot (Formular aus, Organisation nicht gefunden, keine Verbindung, Laden). */
function OrgHinweisSeite({ titel, gruss, text, orgCode, anmelden, laedt, erneut, warteschlange }: {
  titel: string; gruss: string; text?: string; orgCode?: string; anmelden?: boolean; laedt?: boolean
  /** Ohne Verbindung: „Erneut versuchen“ lädt neu. */
  erneut?: boolean
  /** Die Warteschlange, eingebettet über dem Hinweis (nur Hinweise innerhalb einer Organisation). */
  warteschlange?: React.ReactNode
}) {
  return (
    <ZugangRahmen zeichen={<Zeichen klein />} titel={gruss} zeile={titel}>
      {warteschlange}
      {laedt
        ? <p className="zg-fuss" role="status">Einen Moment …</p>
        : (
          <div className="zg-karte">
            {text && <p className="zg-text">{text}</p>}
            {anmelden && <div className="zg-abstand"><a href="/login" className="zg-haupt">Anmelden</a></div>}
            {erneut && <div className="zg-abstand"><button type="button" className="zg-haupt" onClick={() => window.location.reload()}>Erneut versuchen</button></div>}
            {orgCode
              ? (anmelden
                ? <a href={`/${orgCode}`} className="zg-link">Zur Seite der Organisation</a>
                : <div className="zg-abstand"><a href={`/${orgCode}`} className="zg-haupt">Zur Seite der Organisation</a></div>)
              : erneut
                ? <a href="/" className="zg-link">Zur Startseite</a>
                : <div className="zg-abstand"><a href="/" className="zg-haupt">Zur Startseite</a></div>}
          </div>
        )}
    </ZugangRahmen>
  )
}

export function useOrg() {
  const c = useContext(OrgContext)
  if (!c) throw new Error('useOrg outside OrgPublicLayout')
  return c
}

export default function OrgPublicLayout() {
  const { orgCode } = useParams<{ orgCode: string }>()
  const startseite = !!useMatch({ path: '/:orgCode', end: true })
  // Hinweis „Formular aus“ im roten Rahmen (FormularFrei meldet sich über den Zusammenhang)
  const [imRahmen, setImRahmen] = useState(false)
  const rot = startseite || imRahmen
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Die Startseite der Organisation schon holen, während die Organisation lädt (kein Aufblitzen danach)
  useEffect(() => { void import('./OrgLanding').catch(() => {}) }, [])

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
      .catch((err: { status?: number }) => {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          setOrg(JSON.parse(cached))
        } else {
          // Nur „gibt es nicht“, wenn der Server das sagt; sonst fehlt die Verbindung
          setError(err?.status === 404 ? 'Organisation nicht gefunden.' : 'Keine Verbindung.')
        }
      })
      .finally(() => setLoading(false))
  }, [orgCode])

  if (loading) return <OrgHinweisSeite titel={orgCode || 'Organisation'} gruss="Wird geladen" laedt />

  if (error === 'Keine Verbindung.') return <OrgHinweisSeite titel={orgCode || 'Organisation'} gruss="Keine Verbindung" erneut
    text="Die Organisation ließ sich gerade nicht laden. Prüfe die Verbindung und versuche es erneut." />

  if (error || !org) return <OrgHinweisSeite titel={orgCode || 'Organisation'} gruss={error === 'Organisation nicht aktiv.' ? 'Nicht aktiv' : 'Nicht gefunden'}
    text={error === 'Organisation nicht aktiv.' ? 'Diese Organisation ist zurzeit nicht aktiv.' : 'Zu diesem Code gibt es keine Organisation. Prüfe den Code oder frag die Verantwortlichen deiner Organisation.'} />

  return (
    // Rote Zugangsseiten (Startseite der Organisation, Hinweis „Formular aus“): ohne eigene Fläche, sonst
    // läge unter der roten Seite ein heller Streifen. Dasselbe Element, nur der Stil wechselt (kein Neuaufbau).
    <div style={rot ? undefined : { minHeight: '100vh', background: 'var(--bg)' }}>
      <OrgContext.Provider value={{ org, orgCode: orgCode!, rahmen: setImRahmen }}>
        {/* Was auf diesem Gerät auf das Senden wartet (Bauplan v2, 4.3); leer: nichts. Auf den roten Seiten
            steht die Karte eingebettet in der Seite (OrgLanding, Hinweis „Formular aus“), sonst hier oben.
            Beim Wechsel wird sie neu aufgebaut; doppeltes Senden fängt der Server über die Kennung ab. */}
        {!rot && <Warteschlange orgCode={orgCode!} org={org} />}
        <Outlet />
      </OrgContext.Provider>
    </div>
  )
}
