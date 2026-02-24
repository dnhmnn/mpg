import { useState, useEffect } from 'react'
import { pb } from '../lib/pocketbase'
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

  return { user, loading, logout }
}
