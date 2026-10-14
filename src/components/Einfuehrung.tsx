// Das Schritt-Fenster der Einführung, der Stand am Benutzer und der
// automatische Start beim ersten Login.
//
// Inhalt und Auswahl der Schritte stehen in lib/einfuehrung.ts — hier nur die
// Darstellung. Jeder Schritt hat eine kleine Abbildung im Responda-Stil, aus
// echten Bausteinen (Kachelfarben, Symbole), damit man wiedererkennt, was
// beschrieben wird.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { ALL_APPS, hatRecht, kachelFarbe } from '../lib/apps'
import {
  automatisch, cookieLesen, cookieText, schritte, standLesen, standVereinen, vermerken,
  type Bild, type EinfSchritt, type Stand, type Teil,
} from '../lib/einfuehrung'
import type { User } from '../types'
import AppIcon from './AppIcon'
import OrgCheckliste from './OrgCheckliste'

const SCHRIFT = "'Atkinson Hyperlegible', -apple-system, sans-serif"

// ── Stand: am Benutzer, mit Cookie als Rückhalt ──────────────────────────────
//
// Ein gemeinsamer Stand je Benutzer für alle Stellen der Seite: Die
// Einstellungen und die Checkliste darin halten sonst je eine eigene Kopie,
// und wer zuletzt speichert, überschreibt die Haken des anderen.

const staende = new Map<string, Stand>()
const zuhoerer = new Set<() => void>()

function standHolen(user: User): Stand {
  const da = staende.get(user.id)
  if (da) return da
  const s = standVereinen(standLesen((user as { einfuehrung?: unknown }).einfuehrung), cookieLesen(user.id))
  staende.set(user.id, s)
  return s
}

export function useEinfuehrungStand(user: User | null) {
  const [, neuZeichnen] = useState(0)
  useEffect(() => {
    const f = () => neuZeichnen((n) => n + 1)
    zuhoerer.add(f)
    return () => { zuhoerer.delete(f) }
  }, [])
  const stand: Stand = user ? standHolen(user) : { v: 1 }
  const standRef = useRef(stand)
  standRef.current = stand

  const speichern = useCallback(async (neu: Stand) => {
    if (!user) return
    staende.set(user.id, neu)
    standRef.current = neu
    zuhoerer.forEach((f) => f())
    try { document.cookie = cookieText(user.id, neu) } catch { /* Cookies gesperrt */ }
    // Fehlt das Feld "einfuehrung" in PocketBase, wird es stillschweigend ignoriert — der Cookie hält dann den Stand
    try { await pb.collection('users').update(user.id, { einfuehrung: neu }, { requestKey: null }) } catch { /* offline: der Cookie hält ihn */ }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return { stand, standRef, speichern }
}

// ── Automatisch beim ersten Login ────────────────────────────────────────────

/**
 * Zeigt die Einführung einmal, wenn sie dem Benutzer zusteht (siehe
 * automatisch in lib/einfuehrung). Im Hub wartet sie, bis die Begrüßung
 * durch ist.
 *
 * Geprüft wird einmal je Benutzer-ID. Das Hub lädt den Benutzer neu, sobald
 * sich sein Datensatz ändert — beim ersten Login etwa, wenn die Rechte aus der
 * Rollen-Vorlage nachgetragen werden. Hinge der Start am Benutzer-Objekt,
 * bräche dieses Neuladen die wartende Einführung ab.
 */
export function EinfuehrungAutomatisch({ user, verzoegerung = 0 }: { user: User | null; verzoegerung?: number }) {
  const { standRef, speichern } = useEinfuehrungStand(user)
  const [teile, setTeile] = useState<Teil[]>([])
  const nutzerRef = useRef(user)
  nutzerRef.current = user
  useEffect(() => {
    const u = nutzerRef.current
    if (!u) return
    const t = automatisch(u as User & { created?: string }, standHolen(u))
    if (!t.length) return
    const uhr = window.setTimeout(() => setTeile(t), verzoegerung)
    return () => window.clearTimeout(uhr)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !teile.length) return null
  return (
    <Einfuehrung user={user} teile={teile}
      onEnde={() => { speichern(vermerken(standRef.current, teile, new Date())); setTeile([]) }} />
  )
}

// ── Das Fenster ──────────────────────────────────────────────────────────────

interface Props {
  user: User
  teile: Teil[]
  /** Durchlaufen, übersprungen oder geschlossen — in jedem Fall gilt die Einführung als gesehen. */
  onEnde: () => void
}

export default function Einfuehrung({ user, teile, onEnde }: Props) {
  const liste = useMemo(() => schritte(user, teile), [user, teile])
  const [i, setI] = useState(0)
  const navigate = useNavigate()
  const fenster = useRef<HTMLDivElement>(null)
  const weiterKnopf = useRef<HTMLButtonElement>(null)
  const s = liste[Math.min(i, liste.length - 1)]
  const letzter = i >= liste.length - 1

  useEffect(() => { weiterKnopf.current?.focus() }, [i])

  // Tastatur: Pfeile blättern, Escape schließt, Tab bleibt im Fenster
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onEnde(); return }
      const ziel = e.target as HTMLElement | null
      const imFeld = ziel && /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName)
      if (!imFeld && e.key === 'ArrowRight') { e.preventDefault(); setI((x) => Math.min(x + 1, liste.length - 1)) }
      if (!imFeld && e.key === 'ArrowLeft') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)) }
      if (e.key === 'Tab' && fenster.current) {
        const ziele = [...fenster.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select')]
        if (!ziele.length) return
        const erstes = ziele[0], letztes = ziele[ziele.length - 1]
        if (e.shiftKey && document.activeElement === erstes) { e.preventDefault(); letztes.focus() }
        else if (!e.shiftKey && document.activeElement === letztes) { e.preventDefault(); erstes.focus() }
      }
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [liste.length, onEnde])

  // Wischen am Handy
  const wischStart = useRef<number | null>(null)

  if (!s) return null
  const teilName = s.teil === 'organisation' ? 'Organisation einrichten' : 'Willkommen'
  const nummerImTeil = liste.filter((x) => x.teil === s.teil).indexOf(s) + 1
  const anzahlImTeil = liste.filter((x) => x.teil === s.teil).length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(26,14,8,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))', fontFamily: SCHRIFT }}>
      <div ref={fenster} role="dialog" aria-modal="true" aria-labelledby="einf-titel" aria-describedby="einf-text"
        onTouchStart={(e) => { wischStart.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (wischStart.current === null) return
          const dx = e.changedTouches[0].clientX - wischStart.current
          wischStart.current = null
          if (dx < -60) setI((x) => Math.min(x + 1, liste.length - 1))
          if (dx > 60) setI((x) => Math.max(x - 1, 0))
        }}
        style={{ width: 'min(560px, 100%)', maxHeight: '100%', background: 'var(--lbf-card)', borderRadius: 18, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Kopf: Teil, Fortschritt, Überspringen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px 10px', borderBottom: '0.5px solid var(--lbf-border-light)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>{teilName}</div>
            <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 1 }}>Schritt {nummerImTeil} von {anzahlImTeil}</div>
          </div>
          {!letzter && (
            <button onClick={onEnde} style={{ background: 'none', border: 'none', color: 'var(--warm-gray)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: '6px 4px' }}>
              Überspringen
            </button>
          )}
        </div>

        {/* Inhalt */}
        <div style={{ overflowY: 'auto', padding: '18px 22px 6px' }}>
          <Abbildung bild={s.bild} user={user} schritt={s} />
          <h2 id="einf-titel" style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, lineHeight: 1.25, color: 'var(--lbf-text)', margin: '18px 0 8px' }}>{s.titel}</h2>
          <p id="einf-text" style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--lbf-text)', margin: 0 }}>{s.text}</p>
          {s.punkte && s.punkte.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {s.punkte.map((p) => (
                <li key={p} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.45, color: 'var(--lbf-text)' }}>
                  <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: 1, background: 'var(--lbf-akzent)', marginTop: 8, flexShrink: 0 }} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}
          {s.bild === 'checkliste' && (
            <div style={{ marginTop: 14 }}>
              <OrgCheckliste user={user} kompakt onGehe={(pfad) => { onEnde(); navigate(pfad) }} />
            </div>
          )}
          {s.hinweis && <p style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', margin: '14px 0 0', lineHeight: 1.5 }}>{s.hinweis}</p>}
        </div>

        {/* Fuß: Punkte und Knöpfe */}
        <div style={{ padding: '14px 18px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 40, height: 4, borderRadius: 2, background: 'rgba(var(--lbf-rot-rgb),0.12)', overflow: 'hidden' }}
            role="progressbar" aria-valuemin={1} aria-valuemax={liste.length} aria-valuenow={i + 1} aria-label="Fortschritt der Einführung">
            <div style={{ width: `${((i + 1) / liste.length) * 100}%`, height: '100%', background: 'var(--lbf-akzent)', borderRadius: 2, transition: 'width .25s' }} />
          </div>
          {i > 0 && (
            <button onClick={() => setI((x) => x - 1)} style={{ padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(var(--lbf-rot-rgb),0.2)', background: 'none', color: 'var(--lbf-akzent)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Zurück
            </button>
          )}
          <button ref={weiterKnopf} onClick={() => (letzter ? onEnde() : setI((x) => x + 1))}
            style={{ padding: '11px 20px', borderRadius: 10, border: 'none', background: 'var(--lbf-akzent-grund)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minWidth: 110 }}>
            {letzter ? 'Los geht’s' : 'Weiter'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Abbildungen ──────────────────────────────────────────────────────────────

function Flaeche({ children, hoehe = 150 }: { children: React.ReactNode; hoehe?: number }) {
  return (
    <div aria-hidden="true" style={{ height: hoehe, borderRadius: 14, background: 'var(--warm-bg)', border: '0.5px solid var(--lbf-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
      {children}
    </div>
  )
}

function Kachel({ id, gross = false }: { id: string; gross?: boolean }) {
  const app = ALL_APPS[id]
  if (!app) return null
  const k = gross ? 46 : 38
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: gross ? 72 : 60 }}>
      <div style={{ width: k, height: k, borderRadius: 11, background: kachelFarbe(app.color || '#600812'), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: k * 0.5, height: k * 0.5 }}><AppIcon icon={app.icon} /></div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-text)', textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{app.name}</span>
    </div>
  )
}

const ikon = (ch: React.ReactNode, gr = 22) => (
  <svg width={gr} height={gr} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{ch}</svg>
)

function initialen(name?: string) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function Abbildung({ bild, user, schritt }: { bild: Bild; user: User; schritt: EinfSchritt }) {
  const vorname = (user.name || user.email?.split('@')[0] || '').split(' ')[0]
  const meine = Object.keys(ALL_APPS).filter((id) => id !== 'settings' && hatRecht(user, ALL_APPS[id].permission))
  switch (bild) {
    case 'willkommen':
      return (
        <div aria-hidden="true" style={{ height: 150, borderRadius: 14, background: '#3d0408', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <span style={{ fontSize: 14, fontStyle: 'italic', color: 'rgba(253,232,216,0.55)' }}>Servus,</span>
          <span style={{ fontSize: 40, fontStyle: 'italic', fontWeight: 700, color: '#fde8d8', lineHeight: 1.05, maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vorname || 'willkommen'}</span>
          {user.organization_name && <span style={{ fontSize: 11, color: 'rgba(253,232,216,0.6)', textTransform: 'uppercase', letterSpacing: '0.16em', marginTop: 6 }}>{user.organization_name}</span>}
        </div>
      )
    case 'hub':
    case 'module': {
      const ids = (schritt.module?.length ? schritt.module : meine).slice(0, bild === 'hub' ? 8 : 12)
      return (
        <Flaeche hoehe={ids.length > 4 ? 170 : 110}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 8px', justifyContent: 'center', padding: '12px 10px', maxWidth: 360 }}>
            {ids.map((id) => <Kachel key={id} id={id} />)}
          </div>
        </Flaeche>
      )
    }
    case 'control':
      return (
        <Flaeche>
          <div style={{ position: 'absolute', top: 14, right: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 30, height: 3, borderRadius: 99, background: 'rgba(var(--lbf-rot-rgb),0.45)' }} />
            <div style={{ width: 22, height: 2, borderRadius: 99, background: 'rgba(var(--lbf-rot-rgb),0.3)' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--lbf-akzent)', letterSpacing: '0.14em' }}>CONTROL</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
            {[<><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></>,
              <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></>,
              <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM20 20h1" /></>,
              <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
            ].map((p, n) => (
              <div key={n} style={{ width: 46, height: 46, borderRadius: 12, background: n === 0 ? 'var(--lbf-akzent-grund)' : 'rgba(var(--lbf-rot-rgb),0.08)', color: n === 0 ? '#fff' : 'var(--lbf-akzent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ikon(p, 20)}</div>
            ))}
          </div>
        </Flaeche>
      )
    case 'profil':
      return (
        <Flaeche>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '1.5px solid var(--lbf-akzent)', color: 'var(--lbf-akzent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{initialen(user.name || user.email)}</div>
            <div style={{ width: 170, borderRadius: 12, background: 'var(--lbf-akzent-grund)', padding: '12px 14px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -18, right: -18, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
              <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(253,232,216,0.6)', letterSpacing: '0.2em' }}>RESPONDA</div>
              <div style={{ fontSize: 15, fontStyle: 'italic', fontWeight: 800, color: '#fde8d8', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || vorname}</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(253,232,216,0.65)', letterSpacing: '0.14em', marginTop: 2 }}>AUSWEIS</div>
            </div>
          </div>
        </Flaeche>
      )
    case 'unitas':
      return <Flaeche hoehe={110}><div style={{ display: 'flex', gap: 10 }}><Kachel id="lernbar" gross /></div></Flaeche>
    case 'patienten':
      // Die Erfassung: Reiter am Rand, rot = Pflichtfeld offen, grün = vollständig
      return (
        <Flaeche>
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', height: 112 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center' }}>
              {['#16a34a', '#16a34a', '#dc2626', 'rgba(var(--lbf-rot-rgb),0.25)', 'rgba(var(--lbf-rot-rgb),0.25)'].map((farbe, n) => (
                <div key={n} style={{ width: 26, height: 16, borderRadius: 4, background: 'var(--lbf-card)', borderLeft: `3px solid ${farbe}`, boxShadow: 'var(--lbf-shadow)' }} />
              ))}
            </div>
            <div style={{ width: 170, background: 'var(--lbf-card)', borderRadius: 10, boxShadow: 'var(--lbf-shadow)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--lbf-akzent)', letterSpacing: '0.14em' }}>EINSATZ</div>
              {[0.9, 0.7, 0.8].map((b, n) => (
                <div key={n} style={{ height: 8, width: `${b * 100}%`, borderRadius: 3, background: 'rgba(var(--lbf-rot-rgb),0.1)' }} />
              ))}
              <div style={{ marginTop: 'auto', alignSelf: 'flex-end', fontSize: 9, fontWeight: 700, padding: '4px 8px', borderRadius: 6, background: 'var(--lbf-akzent-grund)', color: '#fff' }}>Absenden</div>
            </div>
          </div>
        </Flaeche>
      )
    case 'einstellungen':
      return (
        <Flaeche>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['Hell', '#faf9f7', '#1a0e08'], ['Dunkel', '#0f0a07', '#f0e8e0'], ['System', 'linear-gradient(135deg,#faf9f7 50%,#0f0a07 50%)', '#8a7a68']].map(([n, g, t]) => (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 58, height: 72, borderRadius: 10, background: g, border: '0.5px solid var(--lbf-border)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8 }}>
                  <div style={{ width: 30, height: 4, borderRadius: 2, background: t, opacity: 0.6 }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-text)' }}>{n}</span>
              </div>
            ))}
          </div>
        </Flaeche>
      )
    case 'organisation':
      return (
        <Flaeche>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {(schritt.module?.length ? schritt.module : ['unitarii', 'dokumente', 'patienten']).filter((id) => ALL_APPS[id]).map((id) => <Kachel key={id} id={id} gross />)}
          </div>
        </Flaeche>
      )
    case 'checkliste':
      return null
    case 'fertig':
      return (
        <Flaeche hoehe={120}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--lbf-ok-grund-2)', color: 'var(--lbf-ok-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {ikon(<polyline points="20 6 9 17 4 12" />, 28)}
          </div>
        </Flaeche>
      )
  }
}
