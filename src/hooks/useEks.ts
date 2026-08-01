// Bindeglied zwischen IndexedDB-Ereignislog und React.
// Zustand entsteht ausschließlich aus dem Log — geschrieben wird nur über `dispatch`.

import { useCallback, useEffect, useRef, useState } from 'react'
import { appendEvent } from '../lib/eks/events'
import { eventsOf, incidentGet, incidentPut, pendingCount, speicherSichern } from '../lib/eks/db'
import { fold } from '../lib/eks/reducer'
import { pull, subscribe, syncNow } from '../lib/eks/sync'
import type { EksEventType, EksState } from '../lib/eks/types'
import { emptyState } from '../lib/eks/types'
import type { User } from '../types'

export function useEks(einsatzId: string | undefined, user: User | null) {
  const [state, setState] = useState<EksState>(() => emptyState(einsatzId || ''))
  const [bereit, setBereit] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [offen, setOffen] = useState(0)
  const [persistent, setPersistent] = useState<boolean | null>(null)
  const mounted = useRef(true)

  const neuLaden = useCallback(async () => {
    if (!einsatzId) return
    const evs = await eventsOf(einsatzId)
    const s = fold(einsatzId, evs)
    const inc = await incidentGet(einsatzId)
    if (inc?.header) s.einsatz = { ...inc.header, ...s.einsatz, id: einsatzId }
    if (!mounted.current) return
    setState(s)
    setOffen(await pendingCount())
  }, [einsatzId])

  // Erststart
  useEffect(() => {
    mounted.current = true
    if (!einsatzId) return
    ;(async () => {
      setPersistent(await speicherSichern())
      await neuLaden()
      setBereit(true)
      if (navigator.onLine) { await syncNow(einsatzId); await neuLaden() }
    })()
    return () => { mounted.current = false }
  }, [einsatzId, neuLaden])

  // Netzstatus + regelmäßiger Abgleich
  useEffect(() => {
    if (!einsatzId) return
    const on = async () => { setOnline(true); await syncNow(einsatzId); await neuLaden() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const iv = window.setInterval(async () => {
      if (navigator.onLine) { await syncNow(einsatzId); await neuLaden() }
    }, 30000)
    const unsub = subscribe(einsatzId, neuLaden)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      window.clearInterval(iv)
      unsub()
    }
  }, [einsatzId, neuLaden])

  /** Schreibt ein Ereignis — immer zuerst lokal, Übertragung passiert nebenher. */
  const dispatch = useCallback(async (type: EksEventType, payload: any) => {
    if (!einsatzId || !user) return
    await appendEvent({
      einsatz_id: einsatzId,
      organization_id: user.organization_id || '',
      type, payload,
      actor_user: user.id,
      actor_name: user.name || user.email || 'Unbekannt',
    })
    await neuLaden()
    if (navigator.onLine) { syncNow(einsatzId).then(neuLaden).catch(() => { /* später erneut */ }) }
  }, [einsatzId, user, neuLaden])

  const einsatzCachen = useCallback(async (header: any) => {
    if (!einsatzId) return
    const inc = await incidentGet(einsatzId)
    await incidentPut({ id: einsatzId, organization_id: header?.organization_id, header, last_pull_iso: inc?.last_pull_iso })
    await neuLaden()
  }, [einsatzId, neuLaden])

  const jetztSynchronisieren = useCallback(async () => {
    if (!einsatzId) return
    await syncNow(einsatzId)
    await pull(einsatzId)
    await neuLaden()
  }, [einsatzId, neuLaden])

  return { state, bereit, online, offen, persistent, dispatch, neuLaden, einsatzCachen, jetztSynchronisieren }
}
