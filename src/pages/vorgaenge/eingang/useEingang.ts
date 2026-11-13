// Laden und Echtzeit für den Eingang eigener Formulare (Bauplan Vorgänge, 3.8, F7).
//
// Der Eingang liest und ändert über die Sammlung form_submissions: Die Regel lässt nur
// Mitglieder mit dem Recht Vorgänge der eigenen Organisation lesen, Echtzeit folgt der
// Regel. Trotzdem filtert jede Abfrage nach der Organisation: Steht die Regel noch
// offen, antwortet der Hook auf eine ungefilterte Liste mit 403 (Ergebnis Teil S).
// Ohne Recht antwortet die Liste mit 403; die Zahl am Reiter fängt das still ab.
// Abgemeldet wird nur über die Rückgabe von subscribe (B12), nie mit unsubscribe('*').

import { useCallback, useEffect, useRef, useState } from 'react'
import { pb } from '../../../lib/pocketbase'
import { gedrosselt } from '../../../lib/formular/verwaltung'
import { EINGANG_TEXTE, eingangFehlerText } from '../../../lib/formular/eingang'
import type { VgKontext } from '../kontext'
import { vorgaengeVoll } from '../logik'

type Satz = Record<string, unknown>
type Ereignis = { action?: string; record?: Satz }

/** Zählen höchstens alle 5 Sekunden (3.8.6). */
export const ZAEHLEN_MS = 5000

function status(e: unknown): number {
  return e && typeof e === 'object' && typeof (e as { status?: unknown }).status === 'number' ? (e as { status: number }).status : -1
}

/**
 * Echtzeit auf form_submissions, solange `aktiv`. Jedes Ereignis geht an `bei`; abgemeldet
 * wird beim Aushängen über die Rückgabe von subscribe.
 */
export function useAbo(aktiv: boolean, thema: string, bei: (e: Ereignis) => void): void {
  const ref = useRef(bei)
  ref.current = bei
  useEffect(() => {
    if (!aktiv || !thema) return
    let weg = false
    let ab: (() => Promise<void>) | null = null
    pb.collection('form_submissions').subscribe(thema, (e: Ereignis) => { if (!weg) ref.current(e) })
      .then((f) => { if (weg) void f().catch(() => undefined); else ab = f })
      .catch(() => { /* ohne Echtzeit: die Seite zeigt den geladenen Stand */ })
    return () => {
      weg = true
      if (ab) void ab().catch(() => undefined)
    }
  }, [aktiv, thema])
}

/** Filter der Organisation, optional einer Vorlage. */
export function orgFilter(orgId: string, vorlage?: string): string {
  return vorlage
    ? pb.filter('organization_id = {:o} && template_id = {:t}', { o: orgId, t: vorlage })
    : pb.filter('organization_id = {:o}', { o: orgId })
}

/**
 * Zahl der neuen Einsendungen der Organisation für den Reiter (3.8.6). Ohne Modul oder Recht
 * Vorgänge 0 und kein Abo. Fehlt das Feld `status` (vor Owner-Schritt 6), zählt jede Einsendung
 * als neu; ein Satz mit leerem Status ebenso.
 */
export function useNeuZahl(k: VgKontext): number {
  const aktiv = vorgaengeVoll(k) && !!k.orgId
  const orgId = k.orgId
  const [n, setN] = useState(0)
  const drossel = useRef<ReturnType<typeof gedrosselt> | null>(null)

  useEffect(() => {
    if (!aktiv) { setN(0); return }
    let weg = false
    const zaehlen = async () => {
      const liste = pb.collection('form_submissions')
      try {
        const r = await liste.getList(1, 1, { filter: `${orgFilter(orgId)} && (status = "neu" || status = "")`, fields: 'id', requestKey: null })
        if (!weg) setN(r.totalItems)
      } catch (e) {
        if (weg) return
        if (status(e) === 400) {
          // Feld status fehlt noch: alle zählen als neu
          try {
            const r = await liste.getList(1, 1, { filter: orgFilter(orgId), fields: 'id', requestKey: null })
            if (!weg) setN(r.totalItems)
          } catch { if (!weg) setN(0) }
        } else if (status(e) === 403 || status(e) === 401) setN(0)
        // Netz: die Zahl bleibt, wie sie war
      }
    }
    const d = gedrosselt(() => { void zaehlen() }, ZAEHLEN_MS)
    drossel.current = d
    d.sofort()
    return () => { weg = true; d.stoppen(); drossel.current = null }
  }, [aktiv, orgId])

  useAbo(aktiv, '*', () => drossel.current?.anstossen())
  return aktiv ? n : 0
}

export type Laden<T> = { daten: T; laedt: boolean; fehler: string; neuLaden: () => void }

/**
 * Die Vorlagen der Organisation (form_templates, öffentlich lesbar) und eine kurze Liste aller
 * Einsendungen (nur Kennung, Vorlage, Status, Eingang) für den Reiter Eingang; mit Echtzeit,
 * höchstens alle 5 Sekunden neu geladen.
 */
export function useUebersicht(k: VgKontext): Laden<{ vorlagen: Satz[]; einsendungen: Satz[] }> {
  const aktiv = vorgaengeVoll(k) && !!k.orgId
  const orgId = k.orgId
  const [daten, setDaten] = useState<{ vorlagen: Satz[]; einsendungen: Satz[] }>({ vorlagen: [], einsendungen: [] })
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')
  const lauf = useRef(0)
  const drossel = useRef<ReturnType<typeof gedrosselt> | null>(null)

  const laden = useCallback(async (still = false) => {
    if (!aktiv) return
    const nr = ++lauf.current
    if (!still) setLaedt(true)
    try {
      const [vorlagen, einsendungen] = await Promise.all([
        pb.collection('form_templates').getFullList<Satz>({ filter: orgFilter(orgId), sort: 'title', requestKey: null }),
        pb.collection('form_submissions').getFullList<Satz>({ filter: orgFilter(orgId), fields: 'id,template_id,organization_id,status,created', sort: '-created', requestKey: null }),
      ])
      if (nr !== lauf.current) return
      setDaten({ vorlagen, einsendungen })
      setFehler('')
    } catch (e) {
      if (nr !== lauf.current) return
      setFehler(eingangFehlerText(e, EINGANG_TEXTE.ladefehler))
    } finally {
      if (nr === lauf.current) setLaedt(false)
    }
  }, [aktiv, orgId])

  useEffect(() => {
    if (!aktiv) return
    const d = gedrosselt(() => { void laden(true) }, ZAEHLEN_MS)
    drossel.current = d
    void laden()
    return () => { d.stoppen(); drossel.current = null; lauf.current++ }
  }, [aktiv, laden])

  useAbo(aktiv, '*', () => drossel.current?.anstossen())
  return { daten, laedt: aktiv && laedt, fehler, neuLaden: () => { void laden() } }
}

/**
 * Eine Vorlage und ihre Einsendungen (ganz, mit payload), neueste zuerst. Echtzeit trägt neue
 * und geänderte Einsendungen derselben Vorlage sofort ein. Gehört die Vorlage nicht zur
 * Organisation, bleibt `vorlage` null.
 */
export function useVorlageEingang(k: VgKontext, vorlageId: string): Laden<{ vorlage: Satz | null; einsendungen: Satz[]; gefunden: boolean }> {
  const aktiv = vorgaengeVoll(k) && !!k.orgId && !!vorlageId
  const orgId = k.orgId
  const [daten, setDaten] = useState<{ vorlage: Satz | null; einsendungen: Satz[]; gefunden: boolean }>({ vorlage: null, einsendungen: [], gefunden: true })
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')
  const lauf = useRef(0)

  const laden = useCallback(async () => {
    if (!aktiv) return
    const nr = ++lauf.current
    setLaedt(true)
    try {
      let vorlage: Satz | null = null
      try {
        vorlage = await pb.collection('form_templates').getOne<Satz>(vorlageId, { requestKey: null })
      } catch (e) {
        if (status(e) !== 404) throw e
      }
      if (!vorlage || vorlage.organization_id !== orgId) {
        if (nr === lauf.current) { setDaten({ vorlage: null, einsendungen: [], gefunden: false }); setFehler('') }
        return
      }
      const einsendungen = await pb.collection('form_submissions').getFullList<Satz>({ filter: orgFilter(orgId, vorlageId), sort: '-created', requestKey: null })
      if (nr !== lauf.current) return
      setDaten({ vorlage, einsendungen, gefunden: true })
      setFehler('')
    } catch (e) {
      if (nr !== lauf.current) return
      setFehler(eingangFehlerText(e, EINGANG_TEXTE.ladefehler))
    } finally {
      if (nr === lauf.current) setLaedt(false)
    }
  }, [aktiv, orgId, vorlageId])

  useEffect(() => {
    void laden()
    return () => { lauf.current++ }
  }, [laden])

  useAbo(aktiv, '*', (e) => {
    const r = e.record
    if (!r || r.organization_id !== orgId || r.template_id !== vorlageId) return
    setDaten((d) => {
      if (!d.vorlage) return d
      const ohne = d.einsendungen.filter((x) => x.id !== r.id)
      if (e.action === 'delete') return { ...d, einsendungen: ohne }
      const da = d.einsendungen.findIndex((x) => x.id === r.id)
      if (da >= 0) return { ...d, einsendungen: d.einsendungen.map((x) => (x.id === r.id ? r : x)) }
      return { ...d, einsendungen: [r, ...ohne] }
    })
  })

  return { daten, laedt: aktiv && laedt, fehler, neuLaden: () => { void laden() } }
}
