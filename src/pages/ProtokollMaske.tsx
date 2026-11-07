// Die Patientendokumentation für Angemeldete.
//
// Dieselbe Maske wie unter /<org-code>/patienten, nur dass die Organisation
// nicht aus dem Pfad kommt, sondern vom angemeldeten Benutzer, und das
// Protokoll aus der Kennung in der Route.
//
// Damit gibt es eine einzige Maske: im Fahrzeug über den öffentlichen Link,
// in Unitas über "Bearbeiten". Zwei Masken für dasselbe Protokoll hießen zwei
// Gliederungen, zwei Pflichtlisten und zwei Stellen, an denen etwas fehlt.
//
// /protokoll/neu (Unitas „Neues Protokoll“, Bauplan v2, 4.9): ein neues
// Protokoll, gesendet mit der Anmeldung. Das ist der Hauptweg der Mitglieder
// auf ihren eigenen Telefonen und hängt nicht am öffentlichen Link
// (`hidden_forms`), nur daran, ob das Modul Patienten frei ist und ob dieses
// Konto angemeldet senden kann (PO-Entscheidung 3).
//
// Mit Kennung zeigt eine Karte über der Maske, ob das Protokoll auf eine
// Unterschrift wartet; wartet es auf die eigene, lässt es sich hier
// unterschreiben (Befund 3c).

import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useOrganisation } from '../hooks/useOrganisation'
import { pb } from '../lib/pocketbase'
import { formularFrei } from '../lib/freigabe'
import { ABSENDER_ABZEICHEN, absenderLesen, kannAngemeldetSenden, type AbsenderEintrag } from '../lib/formular/absender'
import { UNITAS_TEXTE, zurueckgewiesenZeile } from '../lib/formular/verwaltung'
import { OrgKontext } from './public/OrgPublicLayout'
import Warteschlange from './public/absender/Warteschlange'
import UnterschreibenDialog from '../components/UnterschreibenDialog'

const Doku = lazy(() => import('./public/doku/Doku'))

const GRAU = 'var(--warm-gray)'
const TEXT = 'var(--lbf-text)'
const WARN = 'var(--lbf-warn-text-2)'

/** Die Karte über der Maske: wartet auf eine Unterschrift, oder ohne Unterschrift abgeschlossen. */
function AbsenderKarte({ absender, eigene, onUnterschreiben }: { absender: AbsenderEintrag; eigene: boolean; onUnterschreiben: () => void }) {
  const zurueckgewiesen = !!absender.zurueckgewiesen
  // Nach „Das war ich nicht“ wartet es auf niemanden mehr, sondern auf die Leitung
  const ausstehend = absender.status === 'ausstehend' && !zurueckgewiesen
  const abzeichen = ABSENDER_ABZEICHEN[absender.status]
  const name = absender.name.trim() || 'dem Absender'
  const text = absender.status === 'ausstehend'
    ? (zurueckgewiesen
      ? (eigene ? 'Du hast angegeben, dieses Protokoll nicht abgegeben zu haben. Die Leitung schließt es ohne deine Unterschrift ab.' : zurueckgewiesenZeile(absender.name))
      : eigene ? 'Dieses Protokoll wartet auf deine Unterschrift.' : `Dieses Protokoll wartet auf die Unterschrift von ${name}.`)
    : `Ohne Unterschrift abgeschlossen: ${absender.abschluss?.grund?.trim() || 'ohne Angabe'}`
  return (
    <div style={{ padding: '10px 14px 0', maxWidth: 830, margin: '0 auto', boxSizing: 'border-box' }}>
      <section style={{
        background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        borderLeft: `3px solid ${ausstehend ? WARN : 'rgba(var(--lbf-grau-rgb),0.4)'}`, overflow: 'hidden',
      }}>
        <div style={{ padding: '11px 14px 12px' }}>
          {abzeichen ? (
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: abzeichen.farbe, marginBottom: 4 }}>{abzeichen.text}</div>
          ) : null}
          <div style={{ fontSize: 14, color: TEXT, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{text}</div>
          {ausstehend && eigene ? (
            <div style={{ fontSize: 12, fontStyle: 'italic', color: GRAU, marginTop: 4, lineHeight: 1.4 }}>
              Bis dahin lässt es sich nicht ändern und nicht freigeben.
            </div>
          ) : null}
        </div>
        {ausstehend && eigene ? (
          <div style={{ borderTop: '0.5px solid rgba(var(--lbf-rot-rgb),0.08)', background: 'var(--lbf-fuss)', padding: '8px 12px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button" onClick={onUnterschreiben}
              style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: 'var(--lbf-akzent-grund)', color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}
            >
              {UNITAS_TEXTE.unterschreiben}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default function ProtokollMaske({ neu = false }: { neu?: boolean }) {
  const { patientId } = useParams<{ patientId: string }>()
  const [suche] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { org, fehler } = useOrganisation()
  // ?ansehen= öffnet dieselbe Maske, nur dass nichts geschrieben wird.
  const nurLesen = suche.get('ansehen') !== null
  const id = neu ? '' : (patientId ?? '')

  /** Der Absender des geladenen Protokolls (null: alter Satz oder noch nicht gelesen). */
  const [absender, setAbsender] = useState<AbsenderEintrag | null>(null)
  const [dialog, setDialog] = useState(false)
  /** Nach dem Unterschreiben wird die Maske neu geladen (Frist, Änderbarkeit). */
  const [fassung, setFassung] = useState(0)

  const absenderHolen = useCallback(() => {
    if (!id) { setAbsender(null); return }
    pb.collection('patients').getOne(id, { fields: 'payload,absender_status', requestKey: null })
      .then((rec) => setAbsender(absenderLesen(rec as unknown as Record<string, unknown>, 'patients')))
      .catch(() => setAbsender(null)) // Den Ladefehler zeigt die Maske selbst
  }, [id])
  useEffect(() => { absenderHolen() }, [absenderHolen])

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

  // Neues Protokoll nur, wenn dieses Konto angemeldet senden kann und das Modul frei ist
  if (neu && !(kannAngemeldetSenden(user ?? null) && formularFrei(org, 'patienten'))) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--warm-bg)' }}>
        <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid var(--lbf-akzent)', padding: '18px 18px 16px', maxWidth: 420, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>{UNITAS_TEXTE.neuesProtokoll}</div>
          <div style={{ fontSize: 14, color: TEXT, lineHeight: 1.5 }}>{UNITAS_TEXTE.keinProtokoll}</div>
          <button
            type="button" onClick={() => navigate('/unitas')}
            style={{ marginTop: 14, background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--lbf-akzent)', cursor: 'pointer' }}
          >
            Zurück zu Unitas
          </button>
        </div>
      </div>
    )
  }

  const zeigen = absender && (absender.status === 'ausstehend' || absender.status === 'ohne_unterschrift')
  const eigene = !!absender && !!user?.id && absender.id === user.id

  return (
    <OrgKontext org={org} orgCode={org.org_code}>
      {/* Was auf diesem Gerät auf das Senden wartet (Bauplan v2, 4.3); leer: nichts */}
      <Warteschlange orgCode={org.org_code} org={org} />
      {zeigen ? <AbsenderKarte absender={absender} eigene={eigene} onUnterschreiben={() => setDialog(true)} /> : null}
      <Suspense fallback={null}>
        {neu
          ? <Doku imApp />
          : <Doku key={fassung} protokollId={patientId} nurLesen={nurLesen} />}
      </Suspense>
      {/* Bleibt nach dem Unterschreiben eingehängt, bis geschlossen: sonst verschwände „Unterschrieben.“ sofort */}
      {id ? (
        <UnterschreibenDialog
          formular="patienten" id={id} offen={dialog}
          onZu={() => setDialog(false)}
          onFertig={() => { absenderHolen(); setFassung((n) => n + 1) }}
          onVeraltet={() => { absenderHolen(); setFassung((n) => n + 1) }}
        />
      ) : null}
    </OrgKontext>
  )
}
