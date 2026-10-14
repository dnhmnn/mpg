import { useState, useEffect } from 'react'
import { pb } from '../lib/pocketbase'
import type { User } from '../types'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'update'
  organization_id: string
  active: boolean
}

export function useNotifications(user: User | null) {
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null)

  // An Benutzer und Organisation gebunden, nicht an das Objekt: das Hub lädt den
  // Benutzer bei jeder Änderung seines Datensatzes neu — eine mit "Später"
  // zurückgestellte Mitteilung käme sonst sofort wieder
  useEffect(() => {
    if (user?.organization_id) {
      checkForNotifications()
    }
  }, [user?.id, user?.organization_id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function checkForNotifications() {
    if (!user || !user.organization_id) return

    try {
      const notifications = await pb.collection('hub_notifications').getFullList<Notification>({
        filter: `organization_id = "${user.organization_id}" && active = true`,
        sort: '-created'
      })

      if (notifications.length === 0) return

      for (const notif of notifications) {
        const statusRecords = await pb.collection('notification_status').getFullList({
          filter: `notification_id = "${notif.id}" && user_id = "${user.id}" && status = "dismissed"`
        })

        if (statusRecords.length === 0) {
          setCurrentNotification(notif)
          break
        }
      }
    } catch (error) {
      console.error('Error checking notifications:', error)
    }
  }

  async function dismissNotification() {
    if (!currentNotification || !user) return

    try {
      await pb.collection('notification_status').create({
        notification_id: currentNotification.id,
        user_id: user.id,
        status: 'dismissed',
        dismissed_at: new Date().toISOString(),
        organization_id: user.organization_id
      })

      setCurrentNotification(null)
    } catch (error) {
      console.error('Error dismissing notification:', error)
      setCurrentNotification(null)
    }
  }

  function remindLater() {
    setCurrentNotification(null)
  }

  return {
    currentNotification,
    dismissNotification,
    remindLater
  }
}
