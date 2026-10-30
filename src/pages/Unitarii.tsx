// Benutzerverwaltung (/unitarii): Benutzer, Rollen, Neuigkeiten, temporäre Zugänge.
//
// Dunkelroter Kopf mit Reitern, darunter das Elfenbein-Blatt. Personen, Rollen,
// Vorlagen, verknüpfte Rechte, Neuigkeiten und temporäre Zugänge öffnen als
// ganze Seite (src/pages/benutzer/). Welche Seite offen ist, steht in der
// Adresse (?seite=person&id=…), damit „Zurück“ im Browser und am Handy wirkt.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import { useStatusleiste } from '../hooks/useStatusleiste'
import { ROLLEN, hatRecht, vergebbareRechte } from '../lib/apps'
import { MAX_EIGENE_ROLLEN, eigeneRollen, rolleWiederherstellen } from '../lib/rollen'
import { verknuepfungen, type Verknuepfungen } from '../lib/verknuepfung'
import { BV_CSS } from './benutzer/stil'
import { Icon, Seite, Toast } from './benutzer/bausteine'
import { BenutzerReiter, NeuigkeitenReiter, RollenReiter, TempReiter, type Unterseite } from './benutzer/Listen'
import PersonSeite from './benutzer/PersonSeite'
import { EigeneRolleSeite, FELD_FEHLT, VorlageSeite, eigeneFeldDa, orgLesen } from './benutzer/RolleSeite'
import VerknSeite from './benutzer/VerknSeite'
import NeuigkeitSeite from './benutzer/NeuigkeitSeite'
import ZugangSeite from './benutzer/ZugangSeite'
import AbgleichSeite from './benutzer/AbgleichSeite'
import { orgFehler, type Neuigkeit, type UUser } from './benutzer/logik'
import type { BvKontext } from './benutzer/kontext'

type Reiter = 'benutzer' | 'rollen' | 'neuigkeiten' | 'temp'
const REITER: Reiter[] = ['benutzer', 'rollen', 'neuigkeiten', 'temp']
const SEITEN: Unterseite[] = ['person', 'rolle', 'vorlage', 'verkn', 'neuigkeit', 'zugang', 'abgleich']

// Die Seite rollt je nach Darstellung im Fenster oder im body (globals.css)
const scrollPos = () => Math.max(window.scrollY, document.body.scrollTop, document.documentElement.scrollTop)
function scrollZu(y: number) {
  window.scrollTo(0, y)
  document.body.scrollTop = y
  document.documentElement.scrollTop = y
}

export default function Unitarii() {
  const { user, loading: authLoading } = useAuth()
  // Statusleiste (Uhr, Akku) im Dunkelrot des Kopfs, solange die Seite offen ist
  useStatusleiste()
  const navigate = useNavigate()
  const location = useLocation()
  const [sp] = useSearchParams()
  // Die Organisation frisch geladen (loadOrgRolePerms) — bis dahin die vom Login
  const [orgFrisch, setOrgFrisch] = useState<Record<string, unknown> | null>(null)
  const org: unknown = orgFrisch ?? user?.organization
  // Nur Rechte für Module, die der Organisation freigeschaltet sind (Supervisor).
  // Schon vergebene Rechte gesperrter Module bleiben am Benutzer stehen.
  const PERM_LABELS = vergebbareRechte(org)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const msgTimer = useRef<number | undefined>(undefined)

  const [users, setUsers] = useState<UUser[]>([])
  const [neuigkeiten, setNeuigkeiten] = useState<Neuigkeit[]>([])
  const [orgRolePerms, setOrgRolePerms] = useState<Record<string, Record<string, boolean>>>({})
  const [q, setQ] = useState('')
  const [archivOffen, setArchivOffen] = useState(false)
  const [stellt, setStellt] = useState('')

  // Verknüpfte Rechte (lib/verknuepfung.ts). Ist die Organisation gar nicht
  // bekannt, wird nichts mitgebracht — nie stillschweigend die Voreinstellung.
  const orgVerkn: Verknuepfungen = org ? verknuepfungen(org) : {}

  const tabParam = sp.get('tab') as Reiter | null
  const tab: Reiter = tabParam && REITER.includes(tabParam) ? tabParam : 'benutzer'
  const seiteParam = sp.get('seite') as Unterseite | null
  const seite = seiteParam && SEITEN.includes(seiteParam) ? seiteParam : null
  const seiteId = sp.get('id') || undefined
  const listScroll = useRef(0)

  useEffect(() => { if (user) loadAll() }, [user])

  // Neue Seite beginnt oben, zurück in der Liste steht man wieder, wo man war
  useEffect(() => {
    if (seite) scrollZu(0)
    else requestAnimationFrame(() => scrollZu(listScroll.current))
  }, [seite, seiteId])

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    window.clearTimeout(msgTimer.current)
    setMessage({ text, type })
    msgTimer.current = window.setTimeout(() => setMessage(null), type === 'error' ? 7000 : 3500)
  }

  async function loadAll() {
    setLoading(true)
    try { await Promise.all([loadUsers(), loadNeuigkeiten(), loadOrgRolePerms()]) }
    finally { setLoading(false) }
  }

  async function loadOrgRolePerms() {
    if (!user?.organization_id) return
    try {
      const o = await pb.collection('organizations').getOne(user.organization_id)
      setOrgRolePerms((o.role_permissions as Record<string, Record<string, boolean>> | undefined) || {})
      setOrgFrisch(o)
    } catch { /* field may not exist yet */ }
  }

  async function loadUsers() {
    if (!user?.organization_id) return
    const r = await pb.collection('users').getFullList<UUser>({
      filter: pb.filter('organization_id = {:o}', { o: user.organization_id }),
      sort: 'name',
      requestKey: `bv-users-${Date.now()}`,
    })
    setUsers(r)
  }

  async function loadNeuigkeiten() {
    // Nur die eigene Organisation — Neuigkeiten anderer Organisationen gehen niemanden hier an
    if (!user?.organization_id) { setNeuigkeiten([]); return }
    try {
      const r = await pb.collection('unitas_neuigkeiten').getFullList<Neuigkeit>({
        filter: pb.filter('organisation_id = {:o}', { o: user.organization_id }),
        sort: '-gepinnt,-created',
        requestKey: `bv-n-${Date.now()}`,
      })
      setNeuigkeiten(r)
    } catch { /* collection may not exist */ }
  }

  async function deleteN(id: string) {
    if (!confirm('Neuigkeit löschen?')) return
    try {
      await pb.collection('unitas_neuigkeiten').delete(id)
      await loadNeuigkeiten()
      showMsg('Gelöscht')
    } catch (e: any) { showMsg('Fehler: ' + e.message, 'error') }
  }

  async function wiederherstellen(id: string) {
    if (!user?.organization_id) return
    setStellt(id)
    try {
      const frisch = await orgLesen(user.organization_id)
      if (!('eigene_rollen' in frisch)) { setOrgFrisch(frisch); showMsg(FELD_FEHLT, 'error'); return }
      const liste = eigeneRollen(frisch)
      if (!liste.some(r => r.id === id && r.archiviert)) { setOrgFrisch(frisch); showMsg('Diese Rolle gibt es nicht mehr archiviert. Die Liste ist jetzt aktuell.', 'error'); return }
      if (liste.filter(r => !r.archiviert).length >= MAX_EIGENE_ROLLEN) {
        showMsg(`Nicht wiederhergestellt: Höchstens ${MAX_EIGENE_ROLLEN} eigene Rollen.`, 'error'); return
      }
      const o = await pb.collection('organizations').update(user.organization_id, { eigene_rollen: rolleWiederherstellen(liste, id) }, { requestKey: null })
      setOrgFrisch(o)
      if (!('eigene_rollen' in o)) { showMsg(FELD_FEHLT, 'error'); return }
      setOrgRolePerms((o.role_permissions as Record<string, Record<string, boolean>> | undefined) ?? {})
      showMsg(`Rolle „${liste.find(r => r.id === id)?.name ?? ''}“ wiederhergestellt`)
    } catch (e) { showMsg(orgFehler(e), 'error') }
    finally { setStellt('') }
  }

  // Adresse: ?tab=…&seite=…&id=… — der Reiter bleibt stehen, wenn eine Seite offen ist
  function adresse(neu: { tab?: Reiter; seite?: Unterseite; id?: string }): string {
    const n = new URLSearchParams()
    const t = neu.tab ?? tab
    if (t !== 'benutzer') n.set('tab', t)
    if (neu.seite) n.set('seite', neu.seite)
    if (neu.id) n.set('id', neu.id)
    const s = n.toString()
    return s ? `?${s}` : ''
  }
  function setTab(t: Reiter) { navigate({ search: adresse({ tab: t }) }, { replace: true }) }
  function oeffne(s: Unterseite, id?: string) {
    listScroll.current = scrollPos()
    // Eine alte Meldung gehört nicht auf die neue Seite
    setMessage(null)
    navigate({ search: adresse({ seite: s, id }) }, { state: { bvUnter: true } })
  }
  function schliessen() {
    // Selbst geöffnet: einen Schritt zurück, damit die Seite nicht im Verlauf hängen bleibt
    if ((location.state as { bvUnter?: boolean } | null)?.bvUnter) navigate(-1)
    else navigate({ search: adresse({}) }, { replace: true })
  }

  const orgName = user?.organization_name || (orgFrisch?.org_name as string | undefined) || 'Responda'
  const stil = <style>{BV_CSS}</style>
  const toast = message && <Toast text={message.text} fehler={message.type === 'error'} hoch={!!seite} onClose={() => setMessage(null)} />

  if (authLoading) return null

  // Wie Kachel und Server-Regeln: auch ein befristetes Recht „Benutzerverwaltung“ öffnet die Seite
  if (!hatRecht(user, 'unitarii')) {
    return (
      <>
        {stil}
        <Seite titel="Benutzer" unter={orgName} zurueck={() => navigate('/hub')} zurueckLabel="Zurück zum Hub">
          <div className="bv-notiz"><b>Kein Zugriff</b><p>Die Benutzerverwaltung ist nur mit dem Recht „Benutzerverwaltung“ zugänglich.</p></div>
        </Seite>
      </>
    )
  }

  if (loading) return (
    <>
      {stil}
      <Seite titel="Benutzer" unter={orgName} zurueck={() => navigate('/hub')} zurueckLabel="Zurück zum Hub">
        <div className="bv-leer" role="status">Lädt…</div>
      </Seite>
    </>
  )

  const k: BvKontext = {
    user, org, orgFrisch, orgName, rechte: PERM_LABELS, orgVerkn, orgRolePerms: orgFrisch ? orgRolePerms : ((user?.organization as { role_permissions?: Record<string, Record<string, boolean>> } | undefined)?.role_permissions ?? orgRolePerms), users,
    showMsg, loadUsers, setOrgFrisch, setOrgRolePerms, schliessen,
  }

  const nichtGefunden = (was: string) => (
    <Seite titel={was} unter={orgName} zurueck={schliessen}>
      <div className="bv-notiz"><b>Nicht gefunden</b><p>Der Eintrag ist nicht mehr da. Vielleicht wurde er gerade gelöscht.</p></div>
    </Seite>
  )

  // ── Ganze Seiten ──
  if (seite) {
    let inhalt: ReactNode
    if (seite === 'person') {
      const u = seiteId ? users.find(x => x.id === seiteId) : undefined
      inhalt = seiteId && !u ? nichtGefunden('Benutzer') : <PersonSeite key={seiteId ?? 'neu'} k={k} editingUser={u ?? null} />
    } else if (seite === 'rolle') {
      inhalt = <EigeneRolleSeite key={seiteId ?? 'neu'} k={k} rolleId={seiteId} />
    } else if (seite === 'vorlage') {
      inhalt = seiteId && ROLLEN.some(r => r.id === seiteId) ? <VorlageSeite key={seiteId} k={k} rolle={seiteId} /> : nichtGefunden('Vorlage')
    } else if (seite === 'verkn') {
      inhalt = <VerknSeite k={k} recht={seiteId} />
    } else if (seite === 'neuigkeit') {
      const n = seiteId ? neuigkeiten.find(x => x.id === seiteId) : undefined
      inhalt = seiteId && !n ? nichtGefunden('Neuigkeit') : <NeuigkeitSeite key={seiteId ?? 'neu'} k={k} editingN={n ?? null} neuLaden={loadNeuigkeiten} />
    } else if (seite === 'abgleich') {
      inhalt = <AbgleichSeite k={k} oeffne={oeffne} />
    } else {
      inhalt = <ZugangSeite k={k} />
    }
    return <>{stil}{inhalt}{toast}</>
  }

  // ── Liste mit Reitern ──
  const tempUsers = users.filter(u => u.expires_at).sort((a, b) =>
    new Date(a.expires_at!.replace(' ', 'T')).getTime() - new Date(b.expires_at!.replace(' ', 'T')).getTime())
  const rollenVoll = eigeneRollen(orgFrisch ?? org).filter(r => !r.archiviert).length >= MAX_EIGENE_ROLLEN
  const plus: Record<Reiter, { label: string; los: () => void; aus?: boolean }> = {
    benutzer: { label: 'Neuer Benutzer', los: () => oeffne('person') },
    rollen: { label: 'Neue Rolle', los: () => oeffne('rolle'), aus: !eigeneFeldDa(orgFrisch) || rollenVoll },
    neuigkeiten: { label: 'Neue Neuigkeit', los: () => oeffne('neuigkeit') },
    temp: { label: 'Neuer temporärer Zugang', los: () => oeffne('zugang') },
  }
  const p = plus[tab]
  const reiter: { key: Reiter; label: string; zahl?: number }[] = [
    { key: 'benutzer', label: 'Benutzer', zahl: users.length },
    { key: 'rollen', label: 'Rollen' },
    { key: 'neuigkeiten', label: 'Neuigkeiten' },
    { key: 'temp', label: 'Temporär', zahl: tempUsers.length },
  ]

  return (
    <>
      {stil}
      <Seite titel="Benutzer" unter={orgName} zurueck={() => navigate('/hub')} zurueckLabel="Zurück zum Hub"
        rechts={
          <button type="button" className="bv-rund hell" aria-label={p.label} title={p.label} onClick={p.los} disabled={p.aus} style={p.aus ? { opacity: 0.45 } : undefined}>
            <Icon n="plus" />
          </button>
        }
        reiter={
          <nav className="bv-reiter" role="tablist" aria-label="Bereiche">
            {reiter.map(t => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
                {t.label}{t.zahl ? <em>{t.zahl}</em> : null}
              </button>
            ))}
          </nav>
        }>
        {tab === 'benutzer' && <BenutzerReiter k={k} q={q} setQ={setQ} oeffne={oeffne} />}
        {tab === 'rollen' && <RollenReiter k={k} oeffne={oeffne} archivOffen={archivOffen} setArchivOffen={setArchivOffen} wiederherstellen={wiederherstellen} laeuft={stellt} />}
        {tab === 'neuigkeiten' && <NeuigkeitenReiter neuigkeiten={neuigkeiten} oeffne={oeffne} loeschen={deleteN} />}
        {tab === 'temp' && <TempReiter k={k} tempUsers={tempUsers} oeffne={oeffne} />}
      </Seite>
      {toast}
    </>
  )
}
