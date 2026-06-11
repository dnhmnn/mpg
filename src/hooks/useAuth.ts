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

  async function checkAuth() {
    try {
      if (!pb.authStore.isValid) {
        window.location.href = '/login'
        return
      }

      await pb.collection('users').authRefresh()
      let userData = pb.authStore.model as User

      const isExpired = userData?.expires_at && new Date(userData.expires_at).getTime() < Date.now()
      if (userData?.disabled || isExpired) {
        pb.authStore.clear()
        window.location.href = '/login?reason=disabled'
        return
      }

      if (userData && userData.permissions_migrated !== true) {
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
        } catch (e) {
          console.log('Could not load organization:', e)
        }
      }

      setUser(userData)
      setLoading(false)
      document.body.classList.add('loaded')
    } catch (e) {
      pb.authStore.clear()
      window.location.href = '/login'
    }
  }

  function logout() {
    if (confirm('Wirklich abmelden?')) {
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
