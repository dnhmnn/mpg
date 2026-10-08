// Die Organisation des angemeldeten Benutzers.
//
// Die öffentliche Maske zieht sie aus dem Pfad (/<org-code>/…). In der
// angemeldeten App hängt sie am Benutzer — und wird an mehreren Stellen
// gebraucht: in der Protokollmaske und in jedem Fenster, das ein Protokoll
// zeigt. Deshalb steht das Laden hier und nicht dreimal nebeneinander.

import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { pb } from '../lib/pocketbase'
import type { Organization } from '../pages/public/OrgPublicLayout'

export function useOrganisation(): { org: Organization | null; fehler: string } {
  const { user } = useAuth()
  const [org, setOrg] = useState<Organization | null>(null)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    const id = user?.organization_id
    if (!id) return
    /*
     * Der Benutzer trägt sie meist schon bei sich — allerdings in der
     * schlankeren Form der App, der der org_code fehlen kann. Taugt sie, wird
     * sie genommen; sonst wird nachgeladen.
     */
    const dabei = (user as unknown as { organization?: Partial<Organization> }).organization
    if (dabei && typeof dabei.org_code === 'string' && dabei.org_code) {
      setOrg(dabei as Organization)
      return
    }
    let abgebrochen = false
    pb.collection('organizations').getOne<Organization>(id)
      .then((o) => { if (!abgebrochen) setOrg(o) })
      .catch(() => { if (!abgebrochen) setFehler('Die Organisation ließ sich nicht laden.') })
    return () => { abgebrochen = true }
  }, [user])

  return { org, fehler }
}
