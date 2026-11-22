import { useState, useEffect } from 'react'
import { pb } from '../lib/pocketbase'
import { ROLES, getRoleTemplate } from '../lib/apps'
import { verknuepfungen, vorlageMitVerknuepfungen } from '../lib/verknuepfung'
import { istEigeneRolleId, vorlageBereinigen } from '../lib/rollen'
import { leerenOhneWarteschlange, tresorEntwuerfe, tresorEntwuerfeLoeschen, tresorWartend, tresorZustand, verlassenErlauben } from '../lib/tresor'
import { apiZwischenspeicherLeeren } from '../lib/zwischenspeicher'
import { pushBeimAbmelden } from '../lib/push/abgleich'
import type { User } from '../types'

/**
 * Zieht dieser Start die Rollen-Vorlage am Benutzer nach (einmalig, für Altkonten
 * ohne permissions_migrated)? Nur mit Netz. Eine eigene Rolle der Organisation hat
 * keine Standardvorlage: Ohne frisch geladene Organisation würde "{}" geschrieben
 * und als erledigt vermerkt, und ihre Vorlage käme nie mehr an. Dann wartet es auf
 * den nächsten Start mit Organisation.
 */
export function vorlageNachziehen(u: Pick<User, 'role' | 'permissions_migrated'> | null | undefined, online: boolean, orgFrisch: boolean): boolean {
  if (!u || u.permissions_migrated === true || !online) return false
  return orgFrisch || !istEigeneRolleId(u.role || 'benutzer')
}

// Zuletzt bestätigter Benutzer samt Organisation, nur im Speicher dieser Sitzung. Jede Seite ruft
// useAuth neu auf; ohne diesen Stand zeigte jeder Seitenwechsel erst eine leere Fläche, bis
// authRefresh und Organisation (zwei Anfragen) zurück waren. Geprüft wird weiter bei jedem Öffnen,
// nur im Hintergrund: Gesperrte, abgelaufene oder abgelehnte Konten gehen wie bisher zu /login.
// Gilt nur für dieselbe gültige Anmeldung; jede Abmeldung oder andere Person leert ihn.
let zuletzt: User | null = null

/** Der zuletzt bestätigte Benutzer, wenn er zur jetzigen Anmeldung passt. */
export function zuletztBestaetigt(): User | null {
  const rec = pb.authStore.model as { id?: string } | null
  if (!zuletzt || !pb.authStore.isValid || !rec || rec.id !== zuletzt.id) return null
  return zuletzt
}

/** Stand eines Datensatzes (PocketBase „updated“, als Text sortierbar). */
const stand = (u: unknown): string => String((u as { updated?: unknown } | null)?.updated ?? '')

/**
 * Nach bestandener Prüfung merken (null: vergessen, etwa beim Abmelden). Ist inzwischen ein neuerer
 * Stand derselben Person da (eigene Änderung, während die Prüfung unterwegs war), bleibt der, nur die
 * frisch geladene Organisation kommt dazu. Gibt zurück, was jetzt gilt.
 */
export function zuletztMerken(u: User | null): User | null {
  if (u && zuletzt && u.id === zuletzt.id && stand(u) < stand(zuletzt)) {
    zuletzt = { ...zuletzt, organization_name: u.organization_name, organization_logo: u.organization_logo, organization: u.organization }
  } else {
    zuletzt = u
  }
  return zuletzt
}

/** Eigene Änderung am Benutzer (etwa die App-Auswahl im Hub) gleich in den letzten Stand übernehmen. */
export function zuletztErgaenzen(teil: Partial<User> & Record<string, unknown>): void {
  if (zuletzt) zuletzt = { ...zuletzt, ...teil }
}

pb.authStore.onChange((token, rec) => {
  if (!token || !rec || rec.id !== zuletzt?.id) { zuletzt = null; return }
  // Eigene Änderung über das SDK (update des eigenen Datensatzes legt ihn in die Anmeldung): gleich
  // übernehmen, damit die nächste Seite nicht erst den alten Stand zeigt. Die Felder der Organisation
  // setzt nur checkAuth; ein älterer Stand zählt nicht.
  if (stand(rec) < stand(zuletzt)) return
  const { organization_name: _n, organization_logo: _l, organization: _o, ...rest } = rec as Record<string, unknown>
  zuletzt = { ...zuletzt, ...rest } as User
})

/** Unveränderter Benutzer behält sein Objekt: Seiten mit [user] laden dann nicht doppelt. */
function gleich(a: User | null, b: User | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => zuletztBestaetigt())
  const [loading, setLoading] = useState(() => !zuletztBestaetigt())

  useEffect(() => {
    checkAuth()
  }, [])

  // Netzwerkfehler von echter Ablehnung unterscheiden. Offline darf die Sitzung
  // NICHT verworfen werden — sonst ist die App an der Einsatzstelle ausgeloggt
  // und der Token unwiederbringlich weg (Offlinebetrieb).
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
      // Eigene Rollen nur mit frisch geladener Organisation (vorlageNachziehen).
      if (userData && vorlageNachziehen(userData, navigator.onLine, orgFrisch)) {
        const rolle = userData.role || 'benutzer'
        const vorlage = {
          // Mit frisch geladener Organisation ihre eigene Rollen-Vorlage, sonst die Standardvorlage
          ...(orgFrisch ? vorlageBereinigen(getRoleTemplate(rolle, userData.organization as Parameters<typeof getRoleTemplate>[1])) : (ROLES[rolle]?.permissions || {})),
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

      const gilt = zuletztMerken(userData) ?? userData
      setUser((vorher) => (gleich(vorher, gilt) ? vorher : gilt))
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
    const u = { ...userData }
    const gilt = zuletztMerken(u) ?? u
    setUser((vorher) => (gleich(vorher, gilt) ? vorher : gilt))
    setLoading(false)
    document.body.classList.add('loaded')
  }

  async function logout() {
    // Ohne Netz abgeschickte Formulare warten verschlüsselt im Tresor (IndexedDB, src/lib/tresor.ts)
    // oder, wo der Browser das nicht zulässt, in localStorage. Sie bleiben beim Abmelden (F13);
    // begonnene Protokolle (Entwürfe) werden gelöscht, damit sie nicht für den Nächsten liegen bleiben.
    let formulare = 0, entwuerfe = 0
    try { formulare = tresorWartend() } catch { /* unlesbar: nicht zählen */ }
    try { entwuerfe = tresorEntwuerfe() } catch { /* nicht zählen */ }
    // Offline vorgemerkte Lager-Buchungen (IndexedDB) bleiben auf dem Gerät und hängen an der
    // Person, die sie erfasst hat. Gezählt wird nur, was die Abmeldende betrifft.
    let lagerEigene = 0, lagerProbleme = 0, lagerKollegen = 0
    let lagerModul: typeof import('../lib/lagerOffline') | null = null
    try {
      lagerModul = await import('../lib/lagerOffline')
      const ich = pb.authStore.model as unknown as { id?: string; organization_id?: string } | null
      for (const b of await lagerModul.queueAll()) {
        if (lagerModul.istEigener(b, ich)) {
          if (b.gesperrt || b.abgelehnt) lagerProbleme++
          else lagerEigene++
        } else if (lagerModul.darfFremdenUebertragen(b, ich)) lagerKollegen++
      }
    } catch { /* IndexedDB nicht verfügbar */ }
    // MPG: begonnene Prüfung und unklar gespeicherte Prüfungen oder Defektmeldungen
    let mpg = { unklar: 0, entwurf: false }
    try {
      const { offeneMpgDaten } = await import('../lib/mpg/lokal')
      const ich = pb.authStore.model as unknown as { id?: string; organization_id?: string } | null
      mpg = offeneMpgDaten(ich?.id, ich?.organization_id)
    } catch { /* nicht zählen */ }
    const warnungen: string[] = []
    if (mpg.unklar > 0) warnungen.push(`Im MPG ${mpg.unklar === 1 ? 'ist eine Speicherung' : `sind ${mpg.unklar} Speicherungen`} (Prüfung, Defektmeldung, Sperre, Freigabe oder Ähnliches) nicht sicher angekommen — bitte vorher im MPG erneut senden.`)
    if (mpg.entwurf) warnungen.push('Eine begonnene MPG-Prüfung ist noch nicht gespeichert.')
    const formularTeile: string[] = []
    const wie = tresorZustand() === 'verschluesselt' ? 'verschlüsselt hier' : 'hier'
    if (formulare > 0) formularTeile.push(formulare === 1
      ? `Ein ausgefülltes Formular wartet noch auf diesem Gerät. Es bleibt ${wie} und geht raus, sobald Netz da ist.`
      : `${formulare} ausgefüllte Formulare warten noch auf diesem Gerät. Sie bleiben ${wie} und gehen raus, sobald Netz da ist.`)
    if (entwuerfe > 0) warnungen.push(entwuerfe === 1 ? 'Ein begonnenes Protokoll auf diesem Gerät wird beim Abmelden gelöscht.' : `${entwuerfe} begonnene Protokolle auf diesem Gerät werden beim Abmelden gelöscht.`)
    const lagerTeile: string[] = []
    if (lagerEigene > 0) lagerTeile.push(`${lagerEigene} deiner Lager-Buchungen ${lagerEigene === 1 ? 'ist' : 'sind'} noch nicht übertragen. Sie bleiben auf diesem Gerät und gehen raus, sobald du dich hier wieder anmeldest — oder jemand aus deiner Organisation sie unter deinem Namen überträgt. Besser vorher mit Netz übertragen (Lager → Abzeichen).`)
    if (lagerProbleme > 0) lagerTeile.push(`${lagerProbleme} deiner Lager-Buchungen ${lagerProbleme === 1 ? 'braucht' : 'brauchen'} eine Entscheidung (teilweise übertragen oder abgelehnt) — siehe Lager → Abzeichen.`)
    if (lagerKollegen > 0) lagerTeile.push(`Außerdem warten ${lagerKollegen} Lager-Buchung${lagerKollegen === 1 ? '' : 'en'} von Kolleginnen und Kollegen auf diesem Gerät.`)
    const lagerHinweis = [...formularTeile, ...lagerTeile].length ? `\n\n${[...formularTeile, ...lagerTeile].join('\n')}` : ''
    const frage = warnungen.length
      ? `Achtung: ${warnungen.join(' ')}\n\nBeim Abmelden gehen lokale Daten verloren.${lagerHinweis}\n\nWirklich abmelden?`
      : lagerHinweis ? `${lagerHinweis.trim()}\n\nWirklich abmelden?` : 'Wirklich abmelden?'
    if (confirm(frage)) {
      zuletztMerken(null)
      const lager = localStorage.getItem('lager_pending_count')
      // Push: dieses Gerät beim Server abmelden (noch mit Anmeldung, höchstens 3 s), dann immer Abo
      // beenden, Merker löschen und angezeigte Benachrichtigungen schließen (src/lib/push/abgleich.ts)
      try { await pushBeimAbmelden({ timeoutMs: 3000 }) } catch { /* Abmelden geht immer weiter */ }
      pb.authStore.clear()
      // Entwürfe weg (auch im Tresor), Warteschlange bleibt; localStorage wie bisher leeren
      try { await tresorEntwuerfeLoeschen() } catch { /* was nicht gelöscht werden kann, war nicht gespeichert */ }
      leerenOhneWarteschlange(() => localStorage.clear())
      // Der Zähler gehört zur Warteschlange, nicht zur Anmeldung — wieder hinschreiben
      if (lager && lager !== '0') { try { localStorage.setItem('lager_pending_count', lager) } catch { /* egal */ } }
      // Zwischengespeicherten Lagerbestand löschen (die Warteschlange selbst bleibt)
      try { await lagerModul?.snapshotLeeren() } catch { /* egal */ }
      // Antworten der API im Zwischenspeicher des Service Workers (vor dem Seitenwechsel abwarten;
      // main.tsx leert bei jedem Wechsel der Person ebenfalls, das hier ist der sichere Weg)
      try { await apiZwischenspeicherLeeren() } catch { /* egal */ }
      // Die Warteschlange bleibt; die Rückfrage beim Verlassen ist hier schon beantwortet
      verlassenErlauben()
      window.location.href = '/login'
    }
  }

  async function refresh() {
    await checkAuth()
  }

  return { user, loading, logout, refresh }
}
