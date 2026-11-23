// Rahmen des MPG-Moduls im Dunkelrot-Design (Owner, 22.11.2026: Startseite mit Kacheln, jeder Bereich eine
// eigene Seite mit Zurück; keine Leiste unten, keine Seitenleiste mehr). Ein roter Kopf (Seite aus
// benutzer/bausteine); Titel, Zurück, Knöpfe und Reiter meldet die Ansicht, die vorne ist (kopf.tsx).
// Am Rechner stehen Geräte und Meldungen weiter neben ihrem Detail.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useStatusleiste } from '../../hooks/useStatusleiste'
import { Seite } from '../benutzer/bausteine'
import { BV_CSS } from '../benutzer/stil'
import { Blaetter } from './blaetter'
import { useMpg } from './MpgDaten'
import { KopfKontext, gleicherKopf, siegerVon, type KopfEintrag } from './kopf'
import { MP_CSS } from './stil'
import { rollZiel } from './rollen'
import { hatVerlauf, useBreit } from './teile'
import Zwischenschirm from '../../components/Zwischenschirm'

const STIL = BV_CSS + MP_CSS

export default function MpgLayout() {
  const m = useMpg()
  const breit = useBreit()
  const navigate = useNavigate()
  useStatusleiste('--lbf-kopf', { kopf: '.bv-kopf' })

  const [eintraege, setEintraege] = useState<Map<number, KopfEintrag>>(() => new Map())
  const [rechtsZiel, setRechtsZiel] = useState<HTMLElement | null>(null)
  const [reiterZiel, setReiterZiel] = useState<HTMLElement | null>(null)
  const melden = useCallback((e: KopfEintrag) => setEintraege((alt) => (gleicherKopf(alt.get(e.id), e) ? alt : new Map(alt).set(e.id, e))), [])
  const weg = useCallback((id: number) => setEintraege((alt) => {
    if (!alt.has(id)) return alt
    const neu = new Map(alt)
    neu.delete(id)
    return neu
  }), [])
  // Rollposition: neue Seite oben, mit Zurück dort, wo man in der Liste war; am Rechner bleibt die Liste
  // stehen, wenn nur das Gerät daneben wechselt (rollZiel in rollen.ts)
  const ort = useLocation()
  const art = useNavigationType()
  const stellen = useRef(new Map<string, number>())
  const vorher = useRef(ort.pathname)
  useEffect(() => {
    let geplant = 0
    const merken = () => {
      if (geplant) return
      geplant = requestAnimationFrame(() => { geplant = 0; stellen.current.set(window.location.pathname, window.scrollY) })
    }
    window.addEventListener('scroll', merken, { passive: true })
    return () => { window.removeEventListener('scroll', merken); cancelAnimationFrame(geplant) }
  }, [])
  useLayoutEffect(() => {
    const alt = vorher.current
    vorher.current = ort.pathname
    const y = rollZiel({ alt, neu: ort.pathname, zurueck: art === 'POP', breit, gemerkt: stellen.current.get(ort.pathname) })
    if (y === null) return
    window.scrollTo(0, y)
    document.body.scrollTop = y
    document.documentElement.scrollTop = y
  }, [ort.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const sieger = siegerVon(eintraege.values())
  const wert = useMemo(() => ({ melden, weg, sieger: sieger?.id ?? null, rechtsZiel, reiterZiel }), [melden, weg, sieger?.id, rechtsZiel, reiterZiel])

  if (m.authLoading) return <><style>{STIL}</style><Zwischenschirm /></>

  const org = m.user?.organization_name || 'Responda'
  const zurueck = () => {
    const ziel = sieger?.zurueck ?? '/hub'
    // Startseite: immer in den Hub; sonst dorthin, woher man kam, ohne Verlauf zur festen Elternseite
    if (!sieger || sieger.fest) navigate(ziel)
    else if (hatVerlauf()) navigate(-1)
    else navigate(ziel, { replace: true })
  }

  // Meldungen oben, solange ein Blatt offen ist (unten lägen dessen Knöpfe)
  const toast = m.msg && (
    <div role="status" style={{
      position: 'fixed', left: 16, right: 16, margin: '0 auto', width: 'fit-content', maxWidth: 520, zIndex: 9999, pointerEvents: 'none',
      ...(m.blatt ? { top: 'calc(env(safe-area-inset-top) + 72px)' } : { bottom: breit ? 24 : 'calc(20px + env(safe-area-inset-bottom))' }),
      padding: '10px 20px', borderRadius: 14, fontWeight: 600, fontSize: 13, lineHeight: 1.4, textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      background: m.msg.type === 'success' ? 'var(--lbf-ok-grund)' : 'var(--lbf-fehler-grund)',
      border: `1px solid ${m.msg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
      color: m.msg.type === 'success' ? 'var(--lbf-ok-text)' : 'var(--lbf-fehler-text)',
    }}>{m.msg.text}</div>
  )

  return (
    <KopfKontext.Provider value={wert}>
      <style>{STIL}</style>
      <Seite titel={sieger?.titel ?? 'Medizinprodukte'} unter={sieger?.unter ?? org}
        zurueck={zurueck} zurueckLabel={!sieger || sieger.tiefe === 0 ? 'Zurück zur Übersicht' : 'Zurück'}
        rechts={<span ref={setRechtsZiel} className="mp-rechts" />}
        reiter={<div ref={setReiterZiel} className="mp-reiter" />}>
        <div className="mp-innen"><Outlet /></div>
      </Seite>
      {toast}
      <Blaetter />
    </KopfKontext.Provider>
  )
}
