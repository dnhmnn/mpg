import { useState, useEffect } from 'react'
import { pb } from '../lib/pocketbase'
import { ROLES } from '../lib/apps'
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

      if (userData && userData.permissions_migrated !== true && navigator.onLine) {
        const template = ROLES[userData.role || 'benutzer']?.permissions || {}
        const merged = {
          ...template,
          ...(userData.lernbar_access ? { lernbar: true } : {}),
          ...(userData.permissions || {}),
        }
        try {
          await pb.collection('users').update(userData.id, { permissions: merged, permissions_migrated: true })
          userData = { ...userData, permissions: merged, permissions_migrated: true }
        } catch (e) {
          console.error('Permission migration failed:', e)
        }
      }

      if (userData && userData.organization_id) {
        try {
          const org = await pb.collection('organizations').getOne(userData.organization_id)
          userData.organization_name = org.org_name
          userData.organization_logo = org.logo || '🏢'
          userData.organization = org as any
          // Für den Offlinestart spiegeln
          try { localStorage.setItem(ORG_CACHE(userData.organization_id), JSON.stringify(org)) } catch { /* Speicher voll */ }
        } catch (e) {
          applyCachedOrg(userData)
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
    const frage = pending > 0
      ? `Achtung: ${pending} EKS-Eintrag/Einträge sind noch nicht übertragen.\n\nBeim Abmelden gehen lokale Daten verloren. Wirklich abmelden?`
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
