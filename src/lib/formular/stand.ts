// Stand der Formulare für eine Organisation (Bauplan v2, 1.19, 4.12).
//
// Holt GET /stand beim Einhängen, bei `online` und wenn sich die Anmeldung
// ändert. Gemerkt wird der Stand OHNE `angemeldet` unter
// `formular_stand_<orgCode>`: wer angemeldet sendet, kommt nur aus der frischen
// Antwort oder, ohne Netz, aus der gespeicherten Sitzung dieses Geräts (nie aus
// dem Gemerkten, sonst sähe ein zweiter Mensch am Gerät „angemeldet als …“ des
// ersten). Der Service Worker speichert /api/responda/ nicht (vite.config.ts).

import { useCallback, useEffect, useRef, useState } from 'react'
import { pb } from '../pocketbase'
import { formularFrei, modulFrei } from '../freigabe'
import type { User } from '../../types'
import { absenderModus, FORMULARE, kannAngemeldetSenden, type FormularId } from './absender'
import { alterWegErlaubt, formularStand, geraeteSpeicher, standLesen, type FormularStand, type Speicher, type Stand } from './api'

/** Schlüssel des gemerkten Stands je Organisation (ohne `angemeldet`). */
export const STAND_PREFIX = 'formular_stand_'

type Gemerkt = { stand: Stand | null; alt: boolean }

/** Den Stand ohne `angemeldet` merken; `alt`: der Server hatte keine Formular-Routen. */
export function standMerken(orgCode: string, wert: { stand: Stand | null; alt: boolean }, s: Speicher | null = geraeteSpeicher(), jetzt = new Date()): void {
  if (!orgCode || !s) return
  try {
    const roh = wert.alt || !wert.stand
      ? { v: 1, am: jetzt.toISOString(), alt: wert.alt }
      : { v: 1, am: jetzt.toISOString(), alt: false, version: wert.stand.version, formulare: wert.stand.formulare, faehig: wert.stand.faehig }
    s.setItem(STAND_PREFIX + orgCode, JSON.stringify(roh))
  } catch { /* Speicher voll oder gesperrt: nicht merken */ }
}

/** Den gemerkten Stand lesen (immer ohne `angemeldet`); null, wenn nichts Lesbares da ist. */
export function gemerkterStand(orgCode: string, s: Speicher | null = geraeteSpeicher(), jetzt = new Date()): Gemerkt | null {
  if (!orgCode || !s) return null
  try {
    const roh = JSON.parse(s.getItem(STAND_PREFIX + orgCode) || 'null') as Record<string, unknown> | null
    if (!roh || roh.v !== 1) return null
    // Nach dem Enddatum gibt es keinen alten Weg mehr, also auch kein gemerktes „alt“
    if (roh.alt === true) return alterWegErlaubt(jetzt) ? { stand: null, alt: true } : null
    const stand = standLesen({ version: roh.version, formulare: roh.formulare, faehig: roh.faehig, angemeldet: null })
    return stand ? { stand, alt: false } : null
  } catch {
    return null
  }
}

/** Die Organisation aus `org_cache_<orgCode>` (öffentliche Seite), oder null. */
export function orgAusCache(orgCode: string, s: Speicher | null = geraeteSpeicher()): Record<string, unknown> | null {
  if (!orgCode || !s) return null
  try {
    const o = JSON.parse(s.getItem(`org_cache_${orgCode}`) || 'null')
    return o && typeof o === 'object' && !Array.isArray(o) ? o as Record<string, unknown> : null
  } catch {
    return null
  }
}

function versteckt(org: Record<string, unknown> | null): string[] {
  let cfg: unknown = org?.form_config
  for (let i = 0; i < 2 && typeof cfg === 'string'; i++) { try { cfg = JSON.parse(cfg) } catch { cfg = null } }
  const h = cfg && typeof cfg === 'object' ? (cfg as { hidden_forms?: unknown }).hidden_forms : null
  return Array.isArray(h) ? h.filter((x): x is string => typeof x === 'string') : []
}

/**
 * Stand ohne Netz und ohne Gemerktes, aus der Organisation erschlossen
 * (`version: 0`): Modus aus `form_config`, `ausstehend: true`. Ohne
 * Organisation gelten die Voreinstellungen und alles als an. Eigene Formulare
 * (`eigen`): an, wenn das Modul Vorgänge frei ist; den Absender kennt die Vorlage.
 */
export function standAusOrg(org: Record<string, unknown> | null): Stand {
  const aus = versteckt(org)
  const eins = (f: FormularId | 'cirs'): FormularStand => {
    const an = org ? formularFrei(org, f) : true
    return {
      modus: f === 'cirs' ? 'anonym' : absenderModus(org?.form_config, f),
      an,
      oeffentlich: an && !aus.includes(f),
      ausstehend: f !== 'cirs',
    }
  }
  const formulare = Object.fromEntries([...FORMULARE, 'cirs' as const].map((f) => [f, eins(f)])) as Stand['formulare']
  const eigeneAn = org ? modulFrei(org, 'dokumente') : true
  formulare.eigen = { modus: 'frei', an: eigeneAn, oeffentlich: eigeneAn, ausstehend: true }
  return { version: 0, formulare, angemeldet: null }
}

/**
 * Wer ohne Netz als angemeldet gilt: die gespeicherte Sitzung dieses Geräts,
 * wenn ihr Token noch gilt, sie zur Organisation gehört und angemeldet senden kann.
 */
export function angemeldetOhneNetz(orgId: string, konto: unknown, tokenGueltig: boolean, jetzt = Date.now()): { id: string; name: string } | null {
  if (!orgId || !tokenGueltig || !konto || typeof konto !== 'object') return null
  const u = konto as User
  if (u.organization_id !== orgId || !kannAngemeldetSenden(u, jetzt) || typeof u.id !== 'string' || !u.id) return null
  return { id: u.id, name: typeof u.name === 'string' ? u.name.trim() : '' }
}

/**
 * Ist auf diesem Gerät ein Mitglied dieser Organisation angemeldet (gültiges Token, auch ohne
 * Netz)? Ohne das zeigen die öffentlichen Seiten keine Patientendaten von selbst: die Karte der
 * Warteschlange nennt keinen Namen (5.4), ein Entwurf wird erst nach einer Frage eingesetzt
 * (Review F7).
 */
export function mitgliedAngemeldet(orgId: string): boolean {
  let gueltig = false, konto: unknown = null
  try { gueltig = pb.authStore.isValid; konto = pb.authStore.record ?? pb.authStore.model } catch { /* keine Sitzung */ }
  return !!angemeldetOhneNetz(orgId, konto, gueltig)
}

function sitzungFuer(org: Record<string, unknown> | null, jetzt: Date): Stand['angemeldet'] {
  let gueltig = false, konto: unknown = null
  try { gueltig = pb.authStore.isValid; konto = pb.authStore.record ?? pb.authStore.model } catch { /* keine Sitzung */ }
  return angemeldetOhneNetz(typeof org?.id === 'string' ? org.id : '', konto, gueltig, jetzt.getTime())
}

/**
 * Stand bei einem Server ohne Formular-Routen (alter Server, Einführung oder Rücknahme).
 * Ohne Anmeldung: `stand` null (die Masken senden auf dem alten Weg, Namen nur als Text).
 * Mit gültiger Sitzung eines Mitglieds dieser Organisation (nur mit `mitAnmeldung`): ein
 * aus der Organisation erschlossener Stand mit `angemeldet`, damit die Maske angemeldet
 * sendet („Als Anna Berg senden“, mit Token); der alte Weg verknüpft dann diese Person mit
 * sich selbst (versand.ts, altSatz). Befund Client-Abläufe 1.
 */
export function standAlterServer(orgCode: string, o: { mitAnmeldung?: boolean; org?: unknown } = {}, s: Speicher | null = geraeteSpeicher(), jetzt = new Date()): { stand: Stand | null; alterServer: true } {
  if (!o.mitAnmeldung) return { stand: null, alterServer: true }
  const org = o.org && typeof o.org === 'object' ? o.org as Record<string, unknown> : orgAusCache(orgCode, s)
  const angemeldet = sitzungFuer(org, jetzt)
  if (!angemeldet) return { stand: null, alterServer: true }
  return { stand: { ...standAusOrg(org), angemeldet }, alterServer: true }
}

/**
 * Stand für ein Formular ohne Antwort des Servers: gemerkt, sonst aus der
 * Organisation erschlossen; `angemeldet` aus der Sitzung (nur mit `mitAnmeldung`).
 */
export function standOhneNetz(orgCode: string, o: { mitAnmeldung?: boolean; org?: unknown } = {}, s: Speicher | null = geraeteSpeicher(), jetzt = new Date()): { stand: Stand | null; alterServer: boolean } {
  const g = gemerkterStand(orgCode, s, jetzt)
  if (g?.alt) return standAlterServer(orgCode, o, s, jetzt)
  const org = o.org && typeof o.org === 'object' ? o.org as Record<string, unknown> : orgAusCache(orgCode, s)
  const stand = g?.stand ?? standAusOrg(org)
  const angemeldet: Stand['angemeldet'] = o.mitAnmeldung ? sitzungFuer(org, jetzt) : null
  return { stand: { ...stand, angemeldet }, alterServer: false }
}

/**
 * Stand der Formulare einer Organisation für Masken und Warteschlange.
 * - `mitAnmeldung` (Vorgabe false): Token mitschicken; nach „Anderer Absender“ false.
 * - `org`: die Organisation, falls schon geladen (für den Stand ohne Netz;
 *   sonst `org_cache_<orgCode>`).
 * `alterServer: true` heißt: der Server hat keine Formular-Routen; dann ist
 * `stand` null (mit gültiger Sitzung eines Mitglieds: nur `angemeldet`, siehe
 * standAlterServer) und `formularSenden` nimmt den alten Weg (kein Passwortfeld,
 * Besatzung nur als Namen). 404 `organisation`: `stand` null.
 */
export function useFormularStand(orgCode: string, o: { mitAnmeldung?: boolean; org?: unknown } = {}): { stand: Stand | null; alterServer: boolean; laedt: boolean; neuLaden: () => void } {
  const mitAnmeldung = !!o.mitAnmeldung
  const orgRef = useRef(o.org)
  orgRef.current = o.org
  const [zustand, setZustand] = useState<{ stand: Stand | null; alterServer: boolean; laedt: boolean }>(() => ({ ...standOhneNetz(orgCode, { mitAnmeldung, org: o.org }), laedt: true }))
  const [anstoss, setAnstoss] = useState(0)
  const nr = useRef(0)
  const neuLaden = useCallback(() => setAnstoss((n) => n + 1), [])

  useEffect(() => {
    const neu = () => setAnstoss((n) => n + 1)
    window.addEventListener('online', neu)
    let abmelden: (() => void) | undefined
    try { abmelden = pb.authStore.onChange(neu) } catch { /* ohne Sitzung */ }
    return () => { window.removeEventListener('online', neu); abmelden?.() }
  }, [])

  useEffect(() => {
    const meine = ++nr.current
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    if (!orgCode) { setZustand({ stand: null, alterServer: false, laedt: false }); return }
    if (offline) { setZustand({ ...standOhneNetz(orgCode, { mitAnmeldung, org: orgRef.current }), laedt: false }); return }
    setZustand((z) => ({ ...z, laedt: true }))
    formularStand(orgCode, { mitAnmeldung }).then((r) => {
      if (meine !== nr.current) return
      if (r.ok) {
        standMerken(orgCode, { stand: r.wert, alt: false })
        setZustand({ stand: mitAnmeldung ? r.wert : { ...r.wert, angemeldet: null }, alterServer: false, laedt: false })
      } else if (r.grund === 'alter_server') {
        standMerken(orgCode, { stand: null, alt: true })
        setZustand({ ...standAlterServer(orgCode, { mitAnmeldung, org: orgRef.current }), laedt: false })
      } else if (r.grund === 'organisation') {
        setZustand({ stand: null, alterServer: false, laedt: false })
      } else {
        // Netz weg, Server gestört, gedrosselt: wie ohne Netz weiterarbeiten
        setZustand({ ...standOhneNetz(orgCode, { mitAnmeldung, org: orgRef.current }), laedt: false })
      }
    })
  }, [orgCode, mitAnmeldung, anstoss])

  return { ...zustand, neuLaden }
}
