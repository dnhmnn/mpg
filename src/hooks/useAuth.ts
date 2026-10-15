import { useState, useEffect } from 'react'
import { pb } from '../lib/pocketbase'
import { ROLES, getRoleTemplate } from '../lib/apps'
import { verknuepfungen, vorlageMitVerknuepfungen } from '../lib/verknuepfung'
import type { User } from '../types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  // Netzwerkfehler von echter Ablehnung unterscheiden. Offline darf die Sitzung
  // NICHT verworfen werden — sonst ist die App an der Einsatzstelle ausgeloggt
  // und der Token unwiederbringlich weg (siehe EKS-Offlinebetrieb).
  function isNetworkError(e: any): boolean {
    if (!navigator.onLine) return true
    const s = e?.status ?? e?.originalError?.status
    return s === 0 || s === undefined || e?.isAbort === true
  }

  const ORG_CACHE = (id: string) => `org_cache_${id}`

  async function checkAuth() {
    try {
      if (!pb.authStore.isValid) {
        window.location.href = '/login'
        return
      }

      // Offline: gar nicht erst refreshen, direkt mit der gespeicherten Sitzung weiterarbeiten
      if (!navigator.onLine) { hydrateOffline(); return }

      await pb.collection('users').authRefresh()
      let userData = pb.authStore.model as unknown as User

      const isExpired = userData?.expires_at && new Date(userData.expires_at).getTime() < Date.now()
      if (userData?.disabled || isExpired) {
        pb.authStore.clear()
        window.location.href = '/login?reason=disabled'
        return
      }

      let orgFrisch = false
      if (userData && userData.organization_id) {
        try {
          const org = await pb.collection('organizations').getOne(userData.organization_id)
          orgFrisch = true
          userData.organization_name = org.org_name
          userData.organization_logo = org.logo || '🏢'
          userData.organization = org as any
          // Für den Offlinestart spiegeln
          try { localStorage.setItem(ORG_CACHE(userData.organization_id), JSON.stringify(org)) } catch { /* Speicher voll */ }
        } catch (e) {
          applyCachedOrg(userData)
        }
      }

      // Nach dem Laden der Organisation: Die Rollen-Vorlage bringt ihre verknüpften
      // Rechte mit (Benutzer, die der Supervisor nur mit einer Rolle angelegt hat) —
      // aber nur mit frisch geladener Organisation, sonst stünden Voreinstellung und
      // gesperrte Module für immer am Benutzer. Was am Benutzer schon ausdrücklich
      // steht — auch ein abgewähltes Häkchen —, gilt weiter.
      if (userData && userData.permissions_migrated !== true && navigator.onLine) {
        const rolle = userData.role || 'benutzer'
        const vorlage = {
          // Mit frisch geladener Organisation ihre eigene Rollen-Vorlage, sonst die Standardvorlage
          ...(orgFrisch ? getRoleTemplate(rolle, userData.organization as Parameters<typeof getRoleTemplate>[1]) : (ROLES[rolle]?.permissions || {})),
          ...(userData.lernbar_access ? { lernbar: true } : {}),
        }
        const merged = {
          ...(orgFrisch ? vorlageMitVerknuepfungen(vorlage, verknuepfungen(userData.organization), userData.organization) : vorlage),
          ...(userData.permissions || {}),
        }
        try {
          await pb.collection('users').update(userData.id, { permissions: merged, permissions_migrated: true })
          userData = { ...userData, permissions: merged, permissions_migrated: true }
        } catch (e) {
          console.error('Permission migration failed:', e)
        }
      }

      setUser(userData)
      setLoading(false)
      document.body.classList.add('loaded')
    } catch (e: any) {
      // Nur bei echter Ablehnung abmelden — nie bei fehlender Verbindung
      if (isNetworkError(e) && pb.authStore.isValid) { hydrateOffline(); return }
      pb.authStore.clear()
      window.location.href = '/login'
    }
  }

  function applyCachedOrg(userData: User) {
    if (!userData.organization_id) return
    try {
      const raw = localStorage.getItem(ORG_CACHE(userData.organization_id))
      if (!raw) return
      const org = JSON.parse(raw)
      userData.organization_name = org.org_name
      userData.organization_logo = org.logo || '🏢'
      userData.organization = org
    } catch { /* kein Cache */ }
  }

  // Offline-Start: gespeicherte Sitzung verwenden, Organisation aus dem Cache
  function hydrateOffline() {
    const userData = pb.authStore.model as unknown as User | null
    if (!userData) { window.location.href = '/login'; return }
    const isExpired = userData.expires_at && new Date(userData.expires_at).getTime() < Date.now()
    if (userData.disabled || isExpired) {
      pb.authStore.clear()
      window.location.href = '/login?reason=disabled'
      return
    }
    applyCachedOrg(userData)
    setUser({ ...userData })
    setLoading(false)
    document.body.classList.add('loaded')
  }

  function logout() {
    // EKS hält Einsatzdaten lokal. localStorage.clear() darf sie nicht stillschweigend vernichten.
    const pending = Number(localStorage.getItem('eks_pending_count') || '0')
    // Ohne Netz abgeschickte Protokolle warten im lokalen Speicher (offline_queue_<org>)
    // und gingen mit localStorage.clear() verloren
    let protokolle = 0
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k || !k.startsWith('offline_queue_')) continue
        const q = JSON.parse(localStorage.getItem(k) || '[]')
        if (Array.isArray(q)) protokolle += q.length
      }
    } catch { /* unlesbar: nicht zählen */ }
    const warnungen: string[] = []
    if (pending > 0) warnungen.push(`${pending} EKS-Eintrag/Einträge sind noch nicht übertragen.`)
    if (protokolle > 0) warnungen.push(`${protokolle} Protokoll${protokolle === 1 ? ' wartet' : 'e warten'} noch auf diesem Gerät auf die Übertragung.`)
    const frage = warnungen.length
      ? `Achtung: ${warnungen.join(' ')}\n\nBeim Abmelden gehen lokale Daten verloren. Wirklich abmelden?`
      : 'Wirklich abmelden?'
    if (confirm(frage)) {
      pb.authStore.clear()
      localStorage.clear()
      window.location.href = '/login'
    }
  }

  async function refresh() {
    await checkAuth()
  }

  return { user, loading, logout, refresh }
}
