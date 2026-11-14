// App-Auswahl im Hub: lesen, ändern, speichern (Konto, sonst Gerät).
//
// - Woher die Wahl kommt, entscheidet wahlQuelle (src/lib/hubApps.ts): eine noch nicht
//   gespeicherte Änderung auf dem Gerät (hub_wahl_<id> mit Kennzeichen hub_wahl_offen_<id>),
//   sonst das Konto (users.hub_apps), sonst das Gerät (hub_wahl_<id>), sonst die alte Liste des
//   alten Hubs (hub_apps_<id>). Hat das Konto das Feld, ist es aber leer, wird die Wahl vom Gerät
//   einmal ins Konto geschrieben; danach sind die Geräte-Schlüssel weg.
// - Jede Änderung steht sofort auf dem Gerät, gekennzeichnet, bis sie im Konto ist. Ging das
//   Speichern nicht (ohne Netz), bleibt sie gekennzeichnet und gilt weiter vor dem Kontowert; sie
//   wird beim nächsten Öffnen, wenn das Netz wiederkommt und wenn die App wieder in den Vordergrund
//   kommt, erneut geschrieben.
// - Ob das Konto das Feld hat: authRefresh liefert jedes vorhandene Feld, auch leer (null).
//   Fehlt der Schlüssel, fehlt das Feld. PocketBase verwirft unbekannte Felder still: Fehlt das
//   Feld in der Antwort auf das Speichern, war es nicht da.
// - Änderungen gelten sofort; ins Konto geschrieben nach 500 ms Ruhe (letzter Stand gewinnt),
//   beim Verlassen von „Apps anpassen“ sofort. Unverändertes wird nicht geschrieben: jedes
//   Speichern lädt im Hub den Benutzer neu (Abo auf den eigenen Datensatz).
// - Die Effekte hängen an der Benutzer-ID und dem Feldinhalt als Text, nicht am Objekt: Der Hub
//   lädt den Benutzer bei jeder Änderung des eigenen Datensatzes neu.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pb } from '../../lib/pocketbase'
import {
  befristeteApps, erlaubteApps, hubAppsAltSchluessel, hubKacheln, hubWahlOffenSchluessel, hubWahlSchluessel, wahlLesen,
  wahlQuelle, type HubAppsWahl,
} from '../../lib/hubApps'
import type { User } from '../../types'

/** konto: im Konto gespeichert; geraet: Konto kann es nicht (Feld fehlt); fehler: Speichern ins Konto ging nicht */
export type Speicherstand = 'konto' | 'geraet' | 'fehler'

const lsLesen = (k: string): string | null => { try { return localStorage.getItem(k) } catch { return null } }
const lsSetzen = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* Speicher voll oder gesperrt */ } }
const lsWeg = (k: string) => { try { localStorage.removeItem(k) } catch { /* egal */ } }

const istNetzfehler = (e: unknown) => {
  const s = (e as { status?: number; isAbort?: boolean } | null)?.status
  return s === 0 || s === undefined || (typeof navigator !== 'undefined' && !navigator.onLine)
}

export function useHubApps(user: User | null) {
  const id = user?.id ?? ''
  const roh = user as (User & { hub_apps?: unknown }) | null
  const feldDa = !!roh && 'hub_apps' in roh
  const kontoText = feldDa ? JSON.stringify(roh!.hub_apps ?? null) : ''

  const [wahl, setWahl] = useState<HubAppsWahl | null>(null)
  const [stand, setStand] = useState<Speicherstand | null>(null)
  const [fehlerText, setFehlerText] = useState('')
  // Was im Konto steht (zuletzt gelesen oder geschrieben), als Text: Unverändertes nicht schreiben
  const imKonto = useRef<string>('')
  const feldDaRef = useRef(feldDa)
  feldDaRef.current = feldDa
  // Eigene Änderung, die noch nicht im Konto ist (wartet auf die Ruhe oder läuft gerade)
  const offen = useRef<HubAppsWahl | null | undefined>(undefined)
  const uhr = useRef<number | undefined>(undefined)
  const laeuft = useRef<Promise<void> | null>(null)

  /** Die Wahl ist im Konto: Geräte-Schlüssel weg, außer eine neuere Änderung wartet schon */
  const geraetAufraeumen = useCallback((text: string) => {
    lsWeg(hubAppsAltSchluessel(id))
    const lokal = lsLesen(hubWahlSchluessel(id))
    if (lokal !== null && lokal !== text) return
    lsWeg(hubWahlSchluessel(id))
    lsWeg(hubWahlOffenSchluessel(id))
  }, [id])

  const schreiben = useCallback(async (w: HubAppsWahl | null): Promise<void> => {
    if (!id) return
    const text = JSON.stringify(w)
    if (!feldDaRef.current) {
      if (w) lsSetzen(hubWahlSchluessel(id), text)
      setStand('geraet'); setFehlerText('')
      return
    }
    if (text === imKonto.current) {
      // Steht schon so im Konto (etwa: Speichern ging durch, nur die Antwort kam nicht an)
      geraetAufraeumen(text)
      return
    }
    try {
      const r = await pb.collection('users').update(id, { hub_apps: w }, { requestKey: null })
      if (!('hub_apps' in r)) {
        // Das Konto hat das Feld (doch) nicht: nur das Gerät
        if (w) lsSetzen(hubWahlSchluessel(id), text)
        lsWeg(hubWahlOffenSchluessel(id))
        setStand('geraet'); setFehlerText('')
        return
      }
      imKonto.current = text
      geraetAufraeumen(text)
      setStand('konto'); setFehlerText('')
    } catch (e) {
      // Gekennzeichnet auf dem Gerät lassen: gilt weiter und wird später nachgeholt
      if (w) { lsSetzen(hubWahlSchluessel(id), text); lsSetzen(hubWahlOffenSchluessel(id), '1') }
      setStand('fehler')
      setFehlerText(istNetzfehler(e)
        ? 'Nicht im Konto gespeichert: keine Verbindung. Auf diesem Gerät gemerkt; wird nachgeholt, sobald wieder Netz da ist.'
        : 'Nicht im Konto gespeichert. Auf diesem Gerät gemerkt; wird beim nächsten Öffnen erneut versucht.')
    }
  }, [id, geraetAufraeumen])

  // Ausstehendes sofort schreiben (beim Verlassen, im Hintergrund)
  const jetztSpeichern = useCallback(async () => {
    window.clearTimeout(uhr.current)
    uhr.current = undefined
    if (laeuft.current) await laeuft.current
    const w = offen.current
    if (w === undefined) return
    const lauf = schreiben(w).finally(() => {
      if (offen.current === w) offen.current = undefined
      laeuft.current = null
    })
    laeuft.current = lauf
    await lauf
  }, [schreiben])

  // Wahl aus Gerät (nicht gespeichert), Konto, Gerät oder alter Liste; bei Bedarf ins Konto schreiben
  useEffect(() => {
    if (!id || !roh) return
    // Eine eigene Änderung wartet noch: die gilt, nicht der (ältere) Stand vom Server
    if (offen.current !== undefined) return
    const q = wahlQuelle({
      feldDa, server: roh.hub_apps, lokal: lsLesen(hubWahlSchluessel(id)), alt: lsLesen(hubAppsAltSchluessel(id)),
      offen: lsLesen(hubWahlOffenSchluessel(id)) !== null,
    })
    imKonto.current = feldDa ? kontoText : ''
    setWahl(q.wahl)
    if (q.quelle === 'konto') {
      // Was noch auf dem Gerät liegt, ist überholt
      lsWeg(hubWahlSchluessel(id))
      lsWeg(hubAppsAltSchluessel(id))
      lsWeg(hubWahlOffenSchluessel(id))
    }
    if (q.insKonto && q.wahl) {
      offen.current = q.wahl
      void jetztSpeichern()
    }
  }, [id, feldDa, kontoText]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nicht Gespeichertes nachholen: Netz wieder da, App wieder im Vordergrund
  const nachholen = useCallback(() => {
    if (!id || !feldDaRef.current || offen.current !== undefined || laeuft.current) return
    if (lsLesen(hubWahlOffenSchluessel(id)) === null) return
    const w = wahlLesen(lsLesen(hubWahlSchluessel(id)))
    if (!w) return
    offen.current = w
    void jetztSpeichern()
  }, [id, jetztSpeichern])

  // Beim Wechsel in den Hintergrund nichts liegen lassen; zurück im Vordergrund nachholen
  useEffect(() => {
    const weg = () => { if (document.visibilityState === 'hidden') void jetztSpeichern(); else nachholen() }
    const ende = () => { void jetztSpeichern() }
    window.addEventListener('online', nachholen)
    document.addEventListener('visibilitychange', weg)
    window.addEventListener('pagehide', ende)
    return () => {
      window.removeEventListener('online', nachholen)
      document.removeEventListener('visibilitychange', weg)
      window.removeEventListener('pagehide', ende)
      void jetztSpeichern()
    }
  }, [jetztSpeichern, nachholen])

  /** Neue Wahl: gilt sofort, gespeichert nach 500 ms Ruhe (sofort: jetzt = true) */
  const aendern = useCallback((neu: HubAppsWahl, jetzt = false) => {
    setWahl(neu)
    offen.current = neu
    // Gleich aufs Gerät, damit nichts verloren geht; mit Feld gekennzeichnet, bis es im Konto ist
    if (id) {
      lsSetzen(hubWahlSchluessel(id), JSON.stringify(neu))
      if (feldDaRef.current) lsSetzen(hubWahlOffenSchluessel(id), '1')
      else setStand('geraet')
    }
    window.clearTimeout(uhr.current)
    if (jetzt) void jetztSpeichern()
    else uhr.current = window.setTimeout(() => { void jetztSpeichern() }, 500)
  }, [id, jetztSpeichern])

  // Rechte und Befristungen ändern sich mit dem Benutzer; eine Befristung läuft ab: jede halbe Minute neu prüfen
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60000))
  useEffect(() => {
    const t = window.setInterval(() => setMinute(Math.floor(Date.now() / 60000)), 30000)
    return () => window.clearInterval(t)
  }, [])
  const rechteText = JSON.stringify([user?.supervisor, user?.role, user?.permissions ?? null, user?.temp_permissions ?? null, (user?.organization as { freigeschaltet?: unknown } | undefined)?.freigeschaltet ?? null])
  const erlaubt = useMemo(() => erlaubteApps(user, Date.now()), [id, rechteText, minute]) // eslint-disable-line react-hooks/exhaustive-deps
  const befristet = useMemo(() => befristeteApps(user, Date.now()), [id, rechteText, minute]) // eslint-disable-line react-hooks/exhaustive-deps
  const kacheln = useMemo(() => hubKacheln(wahl, erlaubt, befristet), [wahl, erlaubt, befristet])

  return { wahl, erlaubt, befristet, kacheln, feldDa, stand, fehlerText, aendern, jetztSpeichern }
}

export type HubApps = ReturnType<typeof useHubApps>
