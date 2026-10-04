// Die Besatzung eintragen — einmal, für das ganze Protokoll.
//
// Vier Posten, jeder entweder ein Benutzer der Organisation oder ein Name von
// Hand. Der Unterschied ist nicht kosmetisch: nur ein Benutzer bringt eine
// Kennung mit, und nur die Kennung öffnet das Protokoll später in Unitas.
// Deshalb steht am Posten, was er bewirkt, statt dass beides gleich aussieht.

import { useEffect, useRef, useState } from 'react'
import { pb } from '../../../lib/pocketbase'
import type { Werte } from './DokuFeld'
import { POSTEN, besatzungLesen, einsichtIds, type Besetzung, type Posten } from './besatzung'

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.14)'

type Treffer = { id: string; name: string; email: string }

/** Ein Posten: besetzt zeigen oder suchen lassen. */
function Platz({ posten, person, orgId, onSetzen }: {
  posten: Posten
  person: Besetzung | null
  orgId: string
  onSetzen: (person: Besetzung | null) => void
}) {
  const [frage, setFrage] = useState('')
  const [treffer, setTreffer] = useState<Treffer[]>([])
  const [sucht, setSucht] = useState(false)
  const [fehler, setFehler] = useState(false)
  const uhr = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(uhr.current), [])

  function tippen(q: string) {
    setFrage(q)
    clearTimeout(uhr.current)
    setFehler(false)
    if (q.trim().length < 2) { setTreffer([]); setSucht(false); return }
    setSucht(true)
    uhr.current = setTimeout(async () => {
      try {
        const res = await pb.collection('users').getList(1, 8, {
          filter: `organization_id = "${orgId}" && name ~ "${q.trim().replace(/"/g, '')}"`,
          sort: 'name',
        })
        setTreffer(res.items.map((u) => ({ id: u.id, name: String(u.name ?? ''), email: String(u.email ?? '') })))
      } catch {
        // Ohne Netz gibt es keine Liste — der Name geht trotzdem, nur ohne
        // Einsicht. Das sagt der Hinweis unter dem Feld.
        setTreffer([])
        setFehler(true)
      } finally {
        setSucht(false)
      }
    }, 300)
  }

  function nehmen(p: Besetzung | null) {
    onSetzen(p)
    setFrage('')
    setTreffer([])
    setFehler(false)
  }

  if (person) {
    const mitKonto = person.id !== ''
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
          {posten.label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 8, padding: '8px 10px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, flexShrink: 0, borderRadius: 14,
            background: mitKonto ? ROT : 'transparent',
            border: mitKonto ? 'none' : `1px solid ${LINIE}`,
            color: mitKonto ? '#fff' : GRAU, fontSize: 13, fontWeight: 700,
          }}>
            {person.name.charAt(0).toUpperCase()}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15, fontStyle: 'italic', fontWeight: 700, color: TEXT }}>
              {person.name}
            </span>
            <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: mitKonto ? ROT : GRAU }}>
              {mitKonto ? 'sieht das Protokoll in Unitas' : 'Name ohne Konto — keine Einsicht'}
            </span>
          </span>
          <button
            type="button" onClick={() => nehmen(null)} aria-label={`${posten.label} räumen`}
            style={{ background: 'none', border: 'none', color: GRAU, fontSize: 20, lineHeight: 1, padding: '0 3px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  const getippt = frage.trim()
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
        {posten.label}
      </div>
      <input
        type="text" value={frage} onChange={(e) => tippen(e.target.value)}
        placeholder="Name suchen oder eintragen"
        autoComplete="off"
        style={{ width: '100%', padding: '9px 10px', background: '#fff', border: `0.5px solid ${LINIE}`, borderRadius: 8, fontFamily: 'inherit', fontSize: 16, color: TEXT, boxSizing: 'border-box' }}
      />
      {getippt.length >= 2 ? (
        <div style={{ border: `0.5px solid ${LINIE}`, borderTop: 'none', borderRadius: '0 0 8px 8px', background: '#fff', overflow: 'hidden' }}>
          {treffer.map((t) => (
            <button
              key={t.id} type="button" onClick={() => nehmen({ id: t.id, name: t.name })}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', borderBottom: '0.5px solid rgba(96,8,18,0.06)', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0, borderRadius: 13, background: ROT, color: '#fff', fontSize: 12, fontWeight: 700 }}>
                {t.name.charAt(0).toUpperCase()}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontStyle: 'italic', fontWeight: 700, color: TEXT }}>{t.name}</span>
                <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: GRAU }}>{t.email}</span>
              </span>
            </button>
          ))}
          {/* Immer erreichbar, nicht erst wenn die Suche nichts findet:
              Praktikanten, Helfer anderer Organisationen und der Notarzt
              haben kein Konto, stehen aber auf dem Bogen. */}
          <button
            type="button" onClick={() => nehmen({ id: '', name: getippt })}
            style={{ display: 'block', width: '100%', padding: '8px 10px', background: 'rgba(250,249,247,0.8)', border: 'none', textAlign: 'left', fontFamily: 'inherit', fontSize: 13, color: TEXT, cursor: 'pointer' }}
          >
            „{getippt}“ ohne Konto eintragen
            <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: GRAU }}>
              {sucht ? 'sucht noch …' : fehler ? 'Suche nicht erreichbar — steht nur auf dem Bogen' : 'steht auf dem Bogen, sieht das Protokoll aber nicht'}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function Besatzung({ orgId, werte, onSetzen }: {
  orgId: string
  werte: Werte
  onSetzen: (pos: Posten['pos'], person: Besetzung | null) => void
}) {
  const besetzt = besatzungLesen(werte)
  const einsicht = einsichtIds(werte).length
  return (
    <div style={{ marginBottom: 6 }}>
      {POSTEN.map((p) => (
        <Platz key={p.pos} posten={p} person={besetzt[p.pos]} orgId={orgId}
          onSetzen={(person) => onSetzen(p.pos, person)} />
      ))}
      <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, lineHeight: 1.45, marginTop: 2 }}>
        {einsicht === 0
          ? 'Noch niemand mit Konto eingetragen — das Protokoll erscheint damit in keiner Unitas-Liste.'
          : einsicht === 1
            ? 'Ein Besatzungsmitglied findet das Protokoll in Unitas wieder.'
            : `${einsicht} Besatzungsmitglieder finden das Protokoll in Unitas wieder.`}
      </div>
    </div>
  )
}
