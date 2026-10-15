import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import { EMPTY_PERMS, ROLLEN, getRoleTemplate, isPlaceholderEmail, rollenName, vergebbareRechte } from '../lib/apps'
import { NIE_MITGEBRACHT, STANDARD_VERKNUEPFUNGEN, ergaenzen, gleicheVerknuepfungen, haken, mitgebracht, verknuepfungen, vorlageMitVerknuepfungen, type Verknuepfungen } from '../lib/verknuepfung'
import VerknuepfungHinweis, { verknuepfungZeilen } from '../components/VerknuepfungHinweis'

interface UUser {
  id: string
  name: string
  email: string
  contact_email?: string
  phone?: string
  role?: string
  permissions?: Record<string, boolean>
  organization_id?: string
  supervisor?: boolean
  disabled?: boolean
  expires_at?: string
  temp_permissions?: Record<string, { until: string; granted_by?: string }>
  created?: string
}

interface Neuigkeit {
  id: string
  titel: string
  inhalt: string
  anhang: string
  gepinnt: boolean
  erstellt_von: string
  created: string
  collectionId: string
  organisation_id?: string
}


// ── LBF styles ──
const INPUT: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 10,
  border: '0.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--lbf-card)',
  fontSize: 14, fontFamily: 'inherit', color: 'var(--lbf-text)', boxSizing: 'border-box',
  outline: 'none',
}
const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)',
  textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, display: 'block',
}
const BTN_PRIMARY: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 10, border: 'none',
  background: 'var(--lbf-akzent-grund)', color: '#fff', fontWeight: 700,
  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em',
}
const BTN_SECONDARY: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 10, border: '0.5px solid rgba(var(--lbf-rot-rgb),0.25)',
  background: 'var(--lbf-card)', color: 'var(--lbf-akzent)', fontWeight: 600,
  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
}

function genPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function fmtDateTimeLocal(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtCountdown(iso?: string): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'abgelaufen'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}min`
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
}

export default function Unitarii() {
  const { user, loading: authLoading } = useAuth()
  // Die Organisation frisch geladen (loadOrgRolePerms) — bis dahin die vom Login
  const [orgFrisch, setOrgFrisch] = useState<Record<string, unknown> | null>(null)
  const org: unknown = orgFrisch ?? user?.organization
  // Nur Rechte für Module, die der Organisation freigeschaltet sind (Supervisor).
  // Schon vergebene Rechte gesperrter Module bleiben am Benutzer stehen.
  const PERM_LABELS = vergebbareRechte(org)
  const rechtName = (k: string) => PERM_LABELS.find(p => p.key === k)?.label ?? k
  const navigate = useNavigate()
  const [tab, setTab] = useState<'benutzer' | 'neuigkeiten' | 'temp'>('benutzer')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const [users, setUsers] = useState<UUser[]>([])
  const [editingUser, setEditingUser] = useState<UUser | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [userForm, setUserForm] = useState({
    name: '', email: '', contact_email: '', phone: '', password: '', role: 'benutzer',
    permissions: { ...EMPTY_PERMS },
    supervisor: false, disabled: false, expires_at: '',
    temp_permissions: {} as Record<string, { until: string; granted_by?: string }>,
  })
  const [savingUser, setSavingUser] = useState(false)
  const [tempPermKey, setTempPermKey] = useState('')

  const [neuigkeiten, setNeuigkeiten] = useState<Neuigkeit[]>([])
  const [nOpen, setNOpen] = useState(false)
  const [editingN, setEditingN] = useState<Neuigkeit | null>(null)
  const [nForm, setNForm] = useState({ titel: '', inhalt: '', gepinnt: false })
  const [nAnhang, setNAnhang] = useState<File | null>(null)
  const [savingN, setSavingN] = useState(false)

  const [tempOpen, setTempOpen] = useState(false)
  const [tempForm, setTempForm] = useState({
    name: '', email: '', password: genPassword(),
    role: 'benutzer', permissions: { ...EMPTY_PERMS, lernbar: true } as Record<string, boolean>,
    durationHours: 24, customExpiresAt: '',
  })
  const [savingTemp, setSavingTemp] = useState(false)

  const [orgRolePerms, setOrgRolePerms] = useState<Record<string, Record<string, boolean>>>({})
  const [rolesOpen, setRolesOpen] = useState(false)
  const [templateRole, setTemplateRole] = useState('benutzer')
  const [templateDraft, setTemplateDraft] = useState<Record<string, boolean>>({ ...EMPTY_PERMS })
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Verknüpfte Rechte (lib/verknuepfung.ts). Ist die Organisation gar nicht
  // bekannt, wird nichts mitgebracht — nie stillschweigend die Voreinstellung.
  const orgVerkn: Verknuepfungen = org ? verknuepfungen(org) : {}
  const verknFeldDa = !orgFrisch || 'verknuepfungen' in orgFrisch
  const [verknOpen, setVerknOpen] = useState(false)
  const [verknDraft, setVerknDraft] = useState<Verknuepfungen>({})
  const [verknRecht, setVerknRecht] = useState('lager')
  const [savingVerkn, setSavingVerkn] = useState(false)
  const [anwenden, setAnwenden] = useState(false)

  useEffect(() => { if (user) loadAll() }, [user])

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3500)
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
      setOrgRolePerms((o.role_permissions as any) || {})
      setOrgFrisch(o)
    } catch { /* field may not exist yet */ }
  }

  async function loadUsers() {
    if (!user?.organization_id) return
    const r = await pb.collection('users').getFullList({
      filter: `organization_id = "${user.organization_id}"`,
      sort: 'name',
      requestKey: `bv-users-${Date.now()}`,
    })
    setUsers(r as any)
  }

  async function loadNeuigkeiten() {
    try {
      const r = await pb.collection('unitas_neuigkeiten').getFullList({
        sort: '-gepinnt,-created',
        requestKey: `bv-n-${Date.now()}`,
      })
      setNeuigkeiten(r as any)
    } catch { /* collection may not exist */ }
  }

  function openEditUser(u?: UUser) {
    setEditingUser(u || null)
    // Clean expired temp_permissions when loading
    const cleanTemp: Record<string, { until: string; granted_by?: string }> = {}
    if (u?.temp_permissions) {
      const now = Date.now()
      for (const [k, v] of Object.entries(u.temp_permissions)) {
        if (v?.until && new Date(v.until).getTime() > now) cleanTemp[k] = v
      }
    }
    setUserForm(u ? {
      name: u.name || '', email: u.email || '', contact_email: u.contact_email || '', phone: u.phone || '',
      password: '', role: u.role || 'benutzer',
      permissions: { ...EMPTY_PERMS, ...(u.permissions || {}) },
      supervisor: !!u.supervisor, disabled: !!u.disabled,
      expires_at: fmtDateTimeLocal(u.expires_at),
      temp_permissions: cleanTemp,
    } : {
      name: '', email: '', contact_email: '', phone: '', password: genPassword(),
      role: 'benutzer', permissions: { ...EMPTY_PERMS },
      supervisor: false, disabled: false, expires_at: '',
      temp_permissions: {},
    })
    setTempPermKey('')
    setEditOpen(true)
  }

  function addTempPerm(key: string, hours: number) {
    if (!key) return
    const until = new Date(Date.now() + hours * 3600 * 1000).toISOString()
    const von = user?.name || user?.email || ''
    setUserForm(p => {
      const temp = { ...p.temp_permissions, [key]: { until, granted_by: von } }
      // Verknüpfte Rechte gelten genauso lange — außer sie sind schon dauerhaft oder länger da
      for (const z of mitgebracht(key, orgVerkn, org)) {
        if (p.permissions[z]) continue
        const bisher = temp[z]?.until
        if (bisher && new Date(bisher).getTime() >= new Date(until).getTime()) continue
        temp[z] = { until, granted_by: von }
      }
      return { ...p, temp_permissions: temp }
    })
    setTempPermKey('')
  }

  function removeTempPerm(key: string) {
    setUserForm(p => {
      const next = { ...p.temp_permissions }
      delete next[key]
      return { ...p, temp_permissions: next }
    })
  }

  async function saveUser() {
    if (!userForm.name.trim() || !userForm.email.trim()) {
      showMsg('Name und E-Mail sind Pflicht', 'error'); return
    }
    if (!editingUser && !userForm.password.trim()) {
      showMsg('Passwort fehlt', 'error'); return
    }
    setSavingUser(true)
    try {
      const expIso = userForm.expires_at ? new Date(userForm.expires_at).toISOString() : null
      const base: any = {
        name: userForm.name.trim(), email: userForm.email.trim(),
        contact_email: userForm.contact_email.trim(),
        phone: userForm.phone.trim(), role: userForm.role,
        permissions: userForm.permissions, disabled: userForm.disabled,
        expires_at: expIso,
        temp_permissions: userForm.temp_permissions,
      }
      if (user?.supervisor) base.supervisor = userForm.supervisor

      if (editingUser) {
        if (userForm.password.trim()) {
          base.password = userForm.password
          base.passwordConfirm = userForm.password
        }
        await pb.collection('users').update(editingUser.id, base)
        showMsg('Benutzer aktualisiert')
      } else {
        await pb.collection('users').create({
          ...base,
          password: userForm.password,
          passwordConfirm: userForm.password,
          organization_id: user!.organization_id,
          emailVisibility: true,
        })
        showMsg('Benutzer angelegt')
      }
      setEditOpen(false)
      await loadUsers()
    } catch (e: any) { showMsg('Fehler: ' + (e?.message || e), 'error') }
    finally { setSavingUser(false) }
  }

  async function deleteUser(id: string) {
    if (!confirm('Benutzer endgültig löschen? Empfohlen: stattdessen deaktivieren.')) return
    try {
      await pb.collection('users').delete(id)
      await loadUsers()
      showMsg('Gelöscht')
    } catch (e: any) { showMsg('Fehler: ' + e.message, 'error') }
  }

  function openEditN(n?: Neuigkeit) {
    setEditingN(n || null)
    setNForm(n ? { titel: n.titel, inhalt: n.inhalt, gepinnt: n.gepinnt } : { titel: '', inhalt: '', gepinnt: false })
    setNAnhang(null)
    setNOpen(true)
  }

  async function saveN() {
    if (!nForm.titel.trim()) return
    setSavingN(true)
    try {
      const orgId = user?.organization_id || ''
      let data: any
      if (nAnhang) {
        const fd = new FormData()
        fd.append('titel', nForm.titel)
        fd.append('inhalt', nForm.inhalt)
        fd.append('gepinnt', nForm.gepinnt ? 'true' : 'false')
        fd.append('erstellt_von', user?.name || user?.email || '')
        if (orgId) fd.append('organisation_id', orgId)
        fd.append('anhang', nAnhang)
        data = fd
      } else {
        data = {
          titel: nForm.titel, inhalt: nForm.inhalt, gepinnt: nForm.gepinnt,
          erstellt_von: user?.name || user?.email || '',
          ...(orgId ? { organisation_id: orgId } : {}),
        }
      }
      if (editingN) await pb.collection('unitas_neuigkeiten').update(editingN.id, data)
      else await pb.collection('unitas_neuigkeiten').create(data)
      setNOpen(false)
      await loadNeuigkeiten()
      showMsg(editingN ? 'Neuigkeit aktualisiert' : 'Veröffentlicht')
    } catch (e: any) { showMsg('Fehler: ' + e.message, 'error') }
    finally { setSavingN(false) }
  }

  async function deleteN(id: string) {
    if (!confirm('Neuigkeit löschen?')) return
    try {
      await pb.collection('unitas_neuigkeiten').delete(id)
      await loadNeuigkeiten()
      showMsg('Gelöscht')
    } catch (e: any) { showMsg('Fehler: ' + e.message, 'error') }
  }

  function openTempCreate() {
    const ts = Date.now()
    setTempForm({
      name: 'Temporärer Zugang',
      email: `temp-${ts}@${user?.organization_id || 'org'}.local`,
      password: genPassword(),
      role: 'benutzer',
      permissions: { ...EMPTY_PERMS, lernbar: true },
      durationHours: 24, customExpiresAt: '',
    })
    setTempOpen(true)
  }

  async function saveTemp() {
    if (!tempForm.name.trim() || !tempForm.email.trim() || !tempForm.password.trim()) {
      showMsg('Name, E-Mail, Passwort sind Pflicht', 'error'); return
    }
    setSavingTemp(true)
    try {
      const expIso = tempForm.customExpiresAt
        ? new Date(tempForm.customExpiresAt).toISOString()
        : new Date(Date.now() + tempForm.durationHours * 3600 * 1000).toISOString()
      await pb.collection('users').create({
        name: tempForm.name.trim(), email: tempForm.email.trim(),
        password: tempForm.password, passwordConfirm: tempForm.password,
        role: tempForm.role, permissions: tempForm.permissions,
        organization_id: user!.organization_id, emailVisibility: true,
        disabled: false, expires_at: expIso,
      })
      setTempOpen(false)
      await loadUsers()
      showMsg('Temporärer Zugang erstellt')
    } catch (e: any) { showMsg('Fehler: ' + e.message, 'error') }
    finally { setSavingTemp(false) }
  }

  async function copyText(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); showMsg(`${label} kopiert`) }
    catch { showMsg('Kopieren fehlgeschlagen', 'error') }
  }

  function openRoleTemplates() {
    setTemplateRole('benutzer')
    setTemplateDraft({ ...EMPTY_PERMS, ...getRoleTemplate('benutzer', { role_permissions: orgRolePerms }) })
    setRolesOpen(true)
  }

  function selectTemplateRole(role: string) {
    setTemplateRole(role)
    setTemplateDraft({ ...EMPTY_PERMS, ...getRoleTemplate(role, { role_permissions: orgRolePerms }) })
  }

  function resetTemplateDraft() {
    setTemplateDraft({ ...EMPTY_PERMS, ...getRoleTemplate(templateRole, null) })
  }

  async function saveRoleTemplate() {
    if (!user?.organization_id) return
    setSavingTemplate(true)
    try {
      const updated = { ...orgRolePerms, [templateRole]: { ...templateDraft } }
      await pb.collection('organizations').update(user.organization_id, { role_permissions: updated })
      setOrgRolePerms(updated)
      showMsg('Rollen-Vorlage gespeichert')
    } catch (e: any) { showMsg('Fehler: ' + e.message, 'error') }
    finally { setSavingTemplate(false) }
  }

  function openVerkn() {
    setVerknDraft(orgVerkn)
    setVerknRecht(Object.keys(orgVerkn).find(k => PERM_LABELS.some(p => p.key === k)) ?? PERM_LABELS[0]?.key ?? 'lager')
    setVerknOpen(true)
  }

  function toggleVerkn(von: string, ziel: string, an: boolean) {
    setVerknDraft(d => {
      const liste = (d[von] ?? []).filter(z => z !== ziel)
      const neu = { ...d, [von]: an ? [...liste, ziel] : liste }
      if (!neu[von].length) delete neu[von]
      return neu
    })
  }

  async function saveVerkn() {
    if (!user?.organization_id) return
    setSavingVerkn(true)
    try {
      const o = await pb.collection('organizations').update(user.organization_id, { verknuepfungen: verknDraft })
      setOrgFrisch(o)
      if (!('verknuepfungen' in o)) {
        showMsg('Nicht gespeichert — das Feld „verknuepfungen“ fehlt in PocketBase', 'error')
        return
      }
      showMsg('Verknüpfungen gespeichert')
    } catch (e: any) { showMsg('Fehler: ' + (e?.message || e), 'error') }
    finally { setSavingVerkn(false) }
  }

  // Bestehende Benutzer nachziehen: fehlende verknüpfte Rechte ergänzen, nichts wegnehmen
  async function verknuepfungenAnwenden() {
    // Nur mit frisch geladener Organisation: ihre Verknüpfungen und gesperrten Module
    if (!user?.organization_id || !orgFrisch) return
    setAnwenden(true)
    try {
      const liste = await pb.collection('users').getFullList<UUser>({
        filter: pb.filter('organization_id = {:o}', { o: user.organization_id }),
        fields: 'id,name,email,permissions,supervisor', requestKey: null,
      })
      // Supervisor dürfen ohnehin alles
      const plan = liste.filter(u => !u.supervisor)
        .map(u => ({ u, dazu: ergaenzen(u.permissions, orgVerkn, org).dazu }))
        .filter(x => x.dazu.length)
      if (!plan.length) { showMsg('Alle Benutzer haben die verknüpften Rechte schon'); return }
      const zeilen = plan.slice(0, 12).map(x => `• ${x.u.name || x.u.email}: ${x.dazu.map(rechtName).join(', ')}`)
      if (plan.length > 12) zeilen.push(`… und ${plan.length - 12} weitere`)
      if (!confirm(`Bei ${plan.length} ${plan.length === 1 ? 'Benutzer' : 'Benutzern'} werden Rechte ergänzt:\n\n${zeilen.join('\n')}\n\nWeggenommen wird nichts.`)) return
      let ok = 0
      let fehler = 0
      for (const x of plan) {
        try {
          // Frisch lesen, damit eine Änderung von nebenan nicht verloren geht
          const frisch = await pb.collection('users').getOne<UUser>(x.u.id, { fields: 'id,permissions', requestKey: null })
          const { rechte, dazu } = ergaenzen(frisch.permissions, orgVerkn, org)
          if (dazu.length) await pb.collection('users').update(x.u.id, { permissions: rechte }, { requestKey: null })
          ok++
        } catch { fehler++ }
      }
      await loadUsers()
      showMsg(fehler
        ? `${ok} ergänzt, ${fehler} nicht gespeichert`
        : `Bei ${ok} ${ok === 1 ? 'Benutzer' : 'Benutzern'} ergänzt`, fehler ? 'error' : 'success')
    } catch (e: any) { showMsg('Fehler: ' + (e?.message || e), 'error') }
    finally { setAnwenden(false) }
  }

  if (authLoading) return null

  if (!user?.supervisor && !user?.permissions?.unitarii) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--warm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: 'var(--lbf-text)' }}>Kein Zugriff</div>
        <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Benutzerverwaltung ist nur für Administratoren zugänglich.</div>
        <button onClick={() => navigate('/hub')} style={BTN_PRIMARY}>Zurück zum Hub</button>
      </div>
    )
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontStyle: 'italic', color: 'var(--warm-gray)' }}>lädt…</div>
    </div>
  )

  const tempUsers = users.filter(u => u.expires_at).sort((a, b) =>
    new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime())
  const regularUsers = users

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-bg)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Masthead (Patienten/Lager-Stil) */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid var(--lbf-border)', position: 'sticky', top: 0, zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/hub" style={{ display: 'flex', color: 'var(--lbf-akzent)', textDecoration: 'none', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </a>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--lbf-text)' }}>Benutzerverwaltung</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{user?.organization_name || 'Responda'}</div>
          </div>
          {tab === 'benutzer' && (
            <>
              <button onClick={openRoleTemplates} title="Rollen-Vorlagen verwalten" style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(var(--lbf-rot-rgb),0.07)', color: 'var(--lbf-akzent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
              </button>
              <button onClick={() => openEditUser()} title="Benutzer anlegen" style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(var(--lbf-rot-rgb),0.07)', color: 'var(--lbf-akzent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </>
          )}
          {tab === 'neuigkeiten' && (
            <button onClick={() => openEditN()} title="Neue Neuigkeit" style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(var(--lbf-rot-rgb),0.07)', color: 'var(--lbf-akzent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          )}
          {tab === 'temp' && (
            <button onClick={openTempCreate} title="Temporären Zugang erstellen" style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(var(--lbf-rot-rgb),0.07)', color: 'var(--lbf-akzent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid var(--lbf-border-light)', display: 'flex', justifyContent: 'center', gap: 0 }}>
        {([
          { key: 'benutzer',    label: 'Benutzer',    count: regularUsers.length },
          { key: 'neuigkeiten', label: 'Neuigkeiten', count: neuigkeiten.length },
          { key: 'temp',        label: 'Temporär',    count: tempUsers.length },
        ] as const).map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => { setTab(t.key as any) }} style={{
              flex: 1, maxWidth: 200, padding: '12px 10px 10px', background: 'transparent', border: 'none',
              borderTop: active ? '2px solid var(--lbf-akzent)' : '2px solid transparent',
              fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: active ? 'var(--lbf-akzent)' : 'var(--warm-gray)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {t.label} {t.count > 0 && <span style={{ marginLeft: 4, opacity: 0.6 }}>· {t.count}</span>}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 100px' }}>

        {/* ── BENUTZER ── */}
        {tab === 'benutzer' && (
          <>
            <button onClick={openVerkn} aria-label="Verknüpfte Rechte bearbeiten" style={{ width: '100%', textAlign: 'left', background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', border: 'none', padding: '12px 14px', marginBottom: 20, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Verknüpfte Rechte</div>
                <div style={{ fontSize: 12.5, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 3, lineHeight: 1.45 }}>
                  {!org ? 'Organisation nicht geladen — es wird nichts mitgebracht'
                    : verknuepfungZeilen(PERM_LABELS, orgVerkn, org).join(' · ') || 'Keine — jedes Recht wird einzeln vergeben'}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--warm-gray)', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>Alle Benutzer</div>

            {regularUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch keine Benutzer</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {regularUsers.map(u => <UserCard key={u.id} u={u} onClick={() => openEditUser(u)} isSelf={u.id === user?.id} />)}
              </div>
            )}
          </>
        )}

        {/* ── NEUIGKEITEN ── */}
        {tab === 'neuigkeiten' && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>Veröffentlicht in Unitas</div>

            {neuigkeiten.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch keine Neuigkeiten</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {neuigkeiten.map(n => {
                  const url = n.anhang ? `https://api.responda.systems/api/files/${n.collectionId}/${n.id}/${n.anhang}` : null
                  return (
                    <div key={n.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', borderLeft: `3px solid ${n.gepinnt ? '#d97706' : 'var(--lbf-akzent)'}`, overflow: 'hidden' }}>
                      {n.gepinnt && (
                        <div style={{ background: 'rgba(217,119,6,0.08)', padding: '5px 14px', fontSize: 10, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Angeheftet</div>
                      )}
                      {url && (
                        <img src={url} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
                      )}
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)', marginBottom: 4 }}>{n.titel}</div>
                        {n.inhalt && <div style={{ fontSize: 13.5, color: 'var(--lbf-text)', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{n.inhalt}</div>}
                        <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            {n.erstellt_von && <>{n.erstellt_von} · </>}
                            {new Date(n.created).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}
                          </span>
                          <span style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openEditN(n)} style={{ ...BTN_SECONDARY, padding: '5px 11px', fontSize: 11 }}>Bearbeiten</button>
                            <button onClick={() => deleteN(n.id)} style={{ ...BTN_SECONDARY, padding: '5px 11px', fontSize: 11, color: 'var(--lbf-fehler-text-2)', borderColor: 'rgba(185,28,28,0.3)' }}>Löschen</button>
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── TEMPORÄRE ── */}
        {tab === 'temp' && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>Zugänge mit Ablaufdatum</div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginBottom: 14 }}>
              Echte Benutzer-Accounts die nach Ablauf automatisch deaktiviert werden.
            </div>

            {tempUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Keine temporären Zugänge</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tempUsers.map(u => <UserCard key={u.id} u={u} onClick={() => openEditUser(u)} isSelf={u.id === user?.id} />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── USER EDIT SHEET ── */}
      {editOpen && (
        <Sheet title={editingUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'} onClose={() => setEditOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Name *"><input value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} placeholder="Max Mustermann" style={INPUT} /></Field>
            {isPlaceholderEmail(userForm.email) ? (
              <Field label="Kontakt-E-Mail">
                <input type="email" value={userForm.contact_email} onChange={e => setUserForm(p => ({ ...p, contact_email: e.target.value }))} placeholder="max@example.com" style={INPUT} />
                <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 4 }}>
                  Dieser Benutzer hat keinen eigenen Login (automatisch generierte Adresse) — hier kann eine Kontakt-E-Mail hinterlegt werden.
                </div>
              </Field>
            ) : (
              <>
                <Field label="E-Mail *">
                  <input type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} placeholder="max@example.com" style={INPUT} />
                  {!editingUser && (
                    <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 4 }}>
                      Bekommt automatisch eine Willkommens-E-Mail mit Link zur App, Org-Code und „Passwort festlegen“.
                    </div>
                  )}
                </Field>
                <Field label="Kontakt-E-Mail (optional, falls abweichend)">
                  <input type="email" value={userForm.contact_email} onChange={e => setUserForm(p => ({ ...p, contact_email: e.target.value }))} placeholder="max@example.com" style={INPUT} />
                </Field>
              </>
            )}
            <Field label="Telefon"><input type="tel" value={userForm.phone} onChange={e => setUserForm(p => ({ ...p, phone: e.target.value }))} placeholder="+49 …" style={INPUT} /></Field>

            <Field label="Rolle">
              <select value={userForm.role} onChange={e => {
                const role = e.target.value
                const template = getRoleTemplate(role, { role_permissions: orgRolePerms })
                setUserForm(p => ({ ...p, role, permissions: { ...p.permissions, ...vorlageMitVerknuepfungen(template, orgVerkn, org) } }))
              }} style={INPUT}>
                {ROLLEN.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 4 }}>
                {ROLLEN.find(r => r.id === userForm.role)?.hinweis} Setzt die Häkchen unten — danach einzeln anpassbar.
              </div>
            </Field>

            <div>
              <div style={LABEL}>Zugriffsrechte (dauerhaft)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 12px', background: 'var(--lbf-card)', borderRadius: 10, border: '0.5px solid rgba(var(--lbf-rot-rgb),0.1)' }}>
                {PERM_LABELS.map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--lbf-text)' }}>
                    <input type="checkbox" checked={!!userForm.permissions[key]} onChange={e => { const an = e.target.checked; setUserForm(p => ({ ...p, permissions: haken(p.permissions, key, an, orgVerkn, org) })) }} style={{ width: 16, height: 16, accentColor: 'var(--lbf-akzent)' }} />
                    {label}
                  </label>
                ))}
              </div>
              <VerknuepfungHinweis rechte={PERM_LABELS} v={orgVerkn} org={org} />
            </div>

            <div>
              <div style={LABEL}>Temporäre Zusatzrechte</div>
              <div style={{ padding: '10px 12px', background: 'var(--lbf-card)', borderRadius: 10, border: '0.5px solid rgba(var(--lbf-rot-rgb),0.1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(userForm.temp_permissions).length === 0 ? (
                  <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Keine aktiv — Beispiel: Unitas-User für 4h Lager-Zugriff</div>
                ) : (
                  Object.entries(userForm.temp_permissions).map(([key, val]) => {
                    const label = PERM_LABELS.find(p => p.key === key)?.label || key
                    const left = fmtCountdown(val.until)
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(var(--lbf-rot-rgb),0.06)' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lbf-text)' }}>{label}</div>
                          <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>läuft in {left}</div>
                        </div>
                        <button onClick={() => removeTempPerm(key)} style={{ ...BTN_SECONDARY, padding: '5px 11px', fontSize: 11, color: 'var(--lbf-fehler-text-2)', borderColor: 'rgba(185,28,28,0.3)' }}>Entfernen</button>
                      </div>
                    )
                  })
                )}
                {/* Add new */}
                <div style={{ paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <select value={tempPermKey} onChange={e => setTempPermKey(e.target.value)} style={{ ...INPUT, padding: '9px 11px' }}>
                    <option value="">Berechtigung wählen…</option>
                    {PERM_LABELS.filter(p => !userForm.permissions[p.key] && !userForm.temp_permissions[p.key]).map(p => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[{ h: 1, l: '1h' }, { h: 4, l: '4h' }, { h: 12, l: '12h' }, { h: 24, l: '24h' }, { h: 24 * 7, l: '7 Tage' }].map(opt => (
                      <button
                        key={opt.h}
                        onClick={() => addTempPerm(tempPermKey, opt.h)}
                        disabled={!tempPermKey}
                        style={{ ...BTN_SECONDARY, padding: '6px 12px', fontSize: 11, opacity: !tempPermKey ? 0.4 : 1, cursor: !tempPermKey ? 'not-allowed' : 'pointer' }}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {user?.supervisor && (
              <ToggleRow label="Supervisor (voller Zugriff)" value={userForm.supervisor} onChange={v => setUserForm(p => ({ ...p, supervisor: v }))} />
            )}
            <ToggleRow label="Zugang aktiv" value={!userForm.disabled} onChange={v => setUserForm(p => ({ ...p, disabled: !v }))} />

            <Field label="Ablaufdatum (optional)">
              <input type="datetime-local" value={userForm.expires_at} onChange={e => setUserForm(p => ({ ...p, expires_at: e.target.value }))} style={INPUT} />
              {userForm.expires_at && <button onClick={() => setUserForm(p => ({ ...p, expires_at: '' }))} style={{ ...BTN_SECONDARY, marginTop: 6, padding: '6px 12px', fontSize: 11 }}>Ablauf entfernen</button>}
            </Field>

            <Field label={editingUser ? 'Neues Passwort (leer = unverändert)' : 'Passwort *'}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" style={{ ...INPUT, fontFamily: 'monospace' }} />
                <button onClick={() => setUserForm(p => ({ ...p, password: genPassword() }))} style={{ ...BTN_SECONDARY, padding: '0 12px' }}>Neu</button>
              </div>
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '0.5px solid var(--lbf-border-light)' }}>
            <button onClick={() => setEditOpen(false)} style={{ ...BTN_SECONDARY, flex: 1 }}>Abbrechen</button>
            {editingUser && editingUser.id !== user?.id && (
              <button onClick={() => { deleteUser(editingUser.id); setEditOpen(false) }} style={{ ...BTN_SECONDARY, color: 'var(--lbf-fehler-text-2)', borderColor: 'rgba(185,28,28,0.3)' }}>Löschen</button>
            )}
            <button onClick={saveUser} disabled={savingUser} style={{ ...BTN_PRIMARY, flex: 2, opacity: savingUser ? 0.5 : 1 }}>
              {savingUser ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </Sheet>
      )}

      {/* ── ROLLEN-VORLAGEN SHEET ── */}
      {rolesOpen && (
        <Sheet title="Rollen-Vorlagen" onClose={() => setRolesOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
              Legt fest, welche Häkchen bei "Neuer Benutzer" für eine Rolle vorgeschlagen werden. Bestehende Benutzer sind davon nicht betroffen.
            </div>

            <Field label="Rolle">
              <select value={templateRole} onChange={e => selectTemplateRole(e.target.value)} style={INPUT}>
                {ROLLEN.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>

            <div>
              <div style={LABEL}>Zugriffsrechte für Rolle „{rollenName(templateRole)}“</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 12px', background: 'var(--lbf-card)', borderRadius: 10, border: '0.5px solid rgba(var(--lbf-rot-rgb),0.1)' }}>
                {PERM_LABELS.map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--lbf-text)' }}>
                    <input type="checkbox" checked={!!templateDraft[key]} onChange={e => { const an = e.target.checked; setTemplateDraft(p => haken(p, key, an, orgVerkn, org)) }} style={{ width: 16, height: 16, accentColor: 'var(--lbf-akzent)' }} />
                    {label}
                  </label>
                ))}
              </div>
              <VerknuepfungHinweis rechte={PERM_LABELS} v={orgVerkn} org={org} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '0.5px solid var(--lbf-border-light)' }}>
            <button onClick={resetTemplateDraft} style={BTN_SECONDARY}>Auf Standard zurücksetzen</button>
            <button onClick={saveRoleTemplate} disabled={savingTemplate} style={{ ...BTN_PRIMARY, flex: 1, opacity: savingTemplate ? 0.5 : 1 }}>
              {savingTemplate ? 'Speichert…' : 'Vorlage speichern'}
            </button>
          </div>
        </Sheet>
      )}

      {/* ── VERKNÜPFTE RECHTE SHEET ── */}
      {verknOpen && (() => {
        const geaendert = !gleicheVerknuepfungen(verknDraft, orgVerkn)
        const ziele = PERM_LABELS.filter(p => p.key !== verknRecht && !NIE_MITGEBRACHT.includes(p.key))
        const zeilen = verknuepfungZeilen(PERM_LABELS, verknDraft, org)
        return (
          <Sheet title="Verknüpfte Rechte" onClose={() => setVerknOpen(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', lineHeight: 1.5 }}>
                Wer ein Recht bekommt, bekommt die verknüpften gleich mit angehakt — beim Anlegen, beim Bearbeiten, über die Rolle und bei temporären Rechten. Danach lässt sich jedes einzeln wieder abwählen.
              </div>

              <Field label="Recht">
                <select value={verknRecht} onChange={e => setVerknRecht(e.target.value)} style={INPUT}>
                  {PERM_LABELS.map(p => (
                    <option key={p.key} value={p.key}>{p.label}{verknDraft[p.key]?.length ? ` (bringt ${verknDraft[p.key].length} mit)` : ''}</option>
                  ))}
                </select>
              </Field>

              <div>
                <div style={LABEL}>{rechtName(verknRecht)} bringt mit</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 12px', background: 'var(--lbf-card)', borderRadius: 10, border: '0.5px solid rgba(var(--lbf-rot-rgb),0.1)' }}>
                  {ziele.map(({ key, label }) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--lbf-text)' }}>
                      <input type="checkbox" checked={!!verknDraft[verknRecht]?.includes(key)} onChange={e => toggleVerkn(verknRecht, key, e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--lbf-akzent)' }} />
                      {label}
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 6, lineHeight: 1.45 }}>
                  Die Benutzerverwaltung wird nie mitgebracht: Wer sie hat, kann jedes Recht vergeben, auch das für Patientendaten. Sie wird immer einzeln vergeben.
                </div>
              </div>

              <div>
                <div style={LABEL}>Eingestellt</div>
                <div style={{ fontSize: 13, color: 'var(--lbf-text)', lineHeight: 1.6 }}>
                  {zeilen.length ? zeilen.map(z => <div key={z}>{z}</div>) : <span style={{ fontStyle: 'italic', color: 'var(--warm-gray)' }}>Keine Verknüpfungen</span>}
                </div>
              </div>

              {!verknFeldDa && (
                <div role="alert" style={{ fontSize: 12, lineHeight: 1.5, padding: '10px 12px', borderRadius: 10, background: 'var(--lbf-warn-grund)', color: 'var(--lbf-warn-text)' }}>
                  Das Feld „verknuepfungen“ fehlt in PocketBase (Sammlung organizations, Typ JSON). Bis es angelegt ist, gilt die Voreinstellung (Lager bringt Dateien &amp; Schreibstube, MPG und Vorgänge mit), und Änderungen hier werden nicht gespeichert.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '0.5px solid var(--lbf-border-light)' }}>
              <button onClick={() => setVerknDraft(verknuepfungen({ verknuepfungen: STANDARD_VERKNUEPFUNGEN }))} style={BTN_SECONDARY}>Auf Standard zurücksetzen</button>
              <button onClick={saveVerkn} disabled={savingVerkn || !geaendert} style={{ ...BTN_PRIMARY, flex: 1, opacity: (savingVerkn || !geaendert) ? 0.5 : 1 }}>
                {savingVerkn ? 'Speichert…' : 'Speichern'}
              </button>
            </div>

            <div style={{ marginTop: 22, paddingTop: 14, borderTop: '0.5px solid var(--lbf-border-light)' }}>
              <div style={LABEL}>Bestehende Benutzer</div>
              <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', lineHeight: 1.5, marginBottom: 10 }}>
                Ergänzt bei allen Benutzern die verknüpften Rechte, die ihnen noch fehlen — etwa bei allen mit Lager. Es zählen die dauerhaften Rechte; weggenommen wird nichts. Vorher siehst du, wer was bekommt.
              </div>
              <button onClick={verknuepfungenAnwenden} disabled={anwenden || geaendert || !orgFrisch} style={{ ...BTN_SECONDARY, width: '100%', opacity: (anwenden || geaendert || !orgFrisch) ? 0.5 : 1, cursor: (anwenden || geaendert || !orgFrisch) ? 'not-allowed' : 'pointer' }}>
                {anwenden ? 'Wird angewendet…' : 'Verknüpfungen anwenden'}
              </button>
              {!orgFrisch
                ? <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 6 }}>Die Organisation konnte nicht geladen werden — ohne Verbindung wird nichts angewendet.</div>
                : geaendert && <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 6 }}>Erst speichern, dann anwenden.</div>}
            </div>
          </Sheet>
        )
      })()}

      {/* ── NEUIGKEIT SHEET ── */}
      {nOpen && (
        <Sheet title={editingN ? 'Neuigkeit bearbeiten' : 'Neue Neuigkeit'} onClose={() => setNOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Titel *"><input value={nForm.titel} onChange={e => setNForm(p => ({ ...p, titel: e.target.value }))} placeholder="Überschrift" style={INPUT} /></Field>
            <Field label="Text"><textarea value={nForm.inhalt} onChange={e => setNForm(p => ({ ...p, inhalt: e.target.value }))} rows={6} placeholder="Nachricht…" style={{ ...INPUT, resize: 'vertical', lineHeight: 1.5 }} /></Field>
            <Field label={`Bild ${editingN?.anhang ? `(aktuell: ${editingN.anhang})` : ''}`}>
              <input type="file" accept="image/*" onChange={e => setNAnhang(e.target.files?.[0] || null)} style={{ padding: '8px 0', fontFamily: 'inherit', fontSize: 13 }} />
            </Field>
            <ToggleRow label="Anpinnen (erscheint oben)" value={nForm.gepinnt} onChange={v => setNForm(p => ({ ...p, gepinnt: v }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '0.5px solid var(--lbf-border-light)' }}>
            <button onClick={() => setNOpen(false)} style={{ ...BTN_SECONDARY, flex: 1 }}>Abbrechen</button>
            <button onClick={saveN} disabled={savingN || !nForm.titel.trim()} style={{ ...BTN_PRIMARY, flex: 2, opacity: (savingN || !nForm.titel.trim()) ? 0.5 : 1 }}>
              {savingN ? 'Speichert…' : editingN ? 'Speichern' : 'Veröffentlichen'}
            </button>
          </div>
        </Sheet>
      )}

      {/* ── TEMP SHEET ── */}
      {tempOpen && (
        <Sheet title="Temporären Zugang erstellen" onClose={() => setTempOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Name *"><input value={tempForm.name} onChange={e => setTempForm(p => ({ ...p, name: e.target.value }))} placeholder="z.B. Gast Müller" style={INPUT} /></Field>
            <Field label="E-Mail *"><input type="email" value={tempForm.email} onChange={e => setTempForm(p => ({ ...p, email: e.target.value }))} style={{ ...INPUT, fontFamily: 'monospace', fontSize: 12 }} /></Field>
            <Field label="Passwort">
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={tempForm.password} onChange={e => setTempForm(p => ({ ...p, password: e.target.value }))} style={{ ...INPUT, fontFamily: 'monospace' }} />
                <button onClick={() => setTempForm(p => ({ ...p, password: genPassword() }))} style={{ ...BTN_SECONDARY, padding: '0 12px' }}>Neu</button>
                <button onClick={() => copyText(tempForm.password, 'Passwort')} style={{ ...BTN_SECONDARY, padding: '0 12px' }}>Kopieren</button>
              </div>
            </Field>
            <Field label="Rolle">
              <select value={tempForm.role} onChange={e => setTempForm(p => ({ ...p, role: e.target.value }))} style={INPUT}>
                {ROLLEN.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <div>
              <div style={LABEL}>Berechtigungen</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 12px', background: 'var(--lbf-card)', borderRadius: 10, border: '0.5px solid rgba(var(--lbf-rot-rgb),0.1)' }}>
                {PERM_LABELS.map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--lbf-text)' }}>
                    <input type="checkbox" checked={!!tempForm.permissions[key]} onChange={e => { const an = e.target.checked; setTempForm(p => ({ ...p, permissions: haken(p.permissions, key, an, orgVerkn, org) })) }} style={{ width: 16, height: 16, accentColor: 'var(--lbf-akzent)' }} />
                    {label}
                  </label>
                ))}
              </div>
              <VerknuepfungHinweis rechte={PERM_LABELS} v={orgVerkn} org={org} />
            </div>
            <Field label="Dauer">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[{ h: 1, l: '1h' }, { h: 4, l: '4h' }, { h: 24, l: '24h' }, { h: 24 * 7, l: '7 Tage' }, { h: 24 * 30, l: '30 Tage' }].map(opt => {
                  const active = !tempForm.customExpiresAt && tempForm.durationHours === opt.h
                  return (
                    <button key={opt.h} onClick={() => setTempForm(p => ({ ...p, durationHours: opt.h, customExpiresAt: '' }))} style={{
                      ...BTN_SECONDARY,
                      background: active ? 'var(--lbf-akzent-grund)' : 'var(--lbf-card)',
                      color: active ? '#fff' : 'var(--lbf-akzent)',
                      borderColor: active ? 'var(--lbf-akzent)' : 'rgba(var(--lbf-rot-rgb),0.25)',
                      padding: '7px 14px', fontSize: 12,
                    }}>{opt.l}</button>
                  )
                })}
              </div>
              <input type="datetime-local" value={tempForm.customExpiresAt} onChange={e => setTempForm(p => ({ ...p, customExpiresAt: e.target.value }))} style={{ ...INPUT, marginTop: 8 }} placeholder="oder exaktes Datum" />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '0.5px solid var(--lbf-border-light)' }}>
            <button onClick={() => setTempOpen(false)} style={{ ...BTN_SECONDARY, flex: 1 }}>Abbrechen</button>
            <button onClick={saveTemp} disabled={savingTemp} style={{ ...BTN_PRIMARY, flex: 2, opacity: savingTemp ? 0.5 : 1 }}>
              {savingTemp ? 'Erstellt…' : 'Zugang erstellen'}
            </button>
          </div>
        </Sheet>
      )}

      {/* Toast */}
      {message && (
        <div style={{
          position: 'fixed', bottom: 'calc(24px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, padding: '11px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: message.type === 'success' ? '#16a34a' : '#b91c1c', color: '#fff',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxWidth: '90vw',
        }}>{message.text}</div>
      )}
    </div>
  )
}

// ── Sub-components ──

function UserCard({ u, onClick, isSelf }: { u: UUser; onClick: () => void; isSelf: boolean }) {
  const expSoon = u.expires_at && new Date(u.expires_at).getTime() > Date.now()
  const expired = u.expires_at && new Date(u.expires_at).getTime() <= Date.now()
  const stripColor = u.disabled || expired ? 'rgba(var(--lbf-grau-rgb),0.5)' : (expSoon ? '#d97706' : 'var(--lbf-akzent)')
  const statusLabel = u.disabled
    ? 'DEAKTIVIERT'
    : expired ? 'ABGELAUFEN'
    : (expSoon ? `LÄUFT AB · ${fmtCountdown(u.expires_at!)}` : 'AKTIV')
  const statusColor = u.disabled || expired ? 'var(--warm-gray)' : (expSoon ? '#d97706' : '#16a34a')
  const displayEmail = u.contact_email || (isPlaceholderEmail(u.email) ? '' : u.email)

  return (
    <div onClick={onClick} style={{
      background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)',
      borderLeft: `3px solid ${stripColor}`, padding: '12px 14px', display: 'flex',
      alignItems: 'center', gap: 12, cursor: 'pointer',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%', background: 'var(--lbf-akzent-grund)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 15, flexShrink: 0,
      }}>{(u.name || displayEmail || '?').charAt(0).toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 16, color: 'var(--lbf-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || '—'}</div>
          {isSelf && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>· du</span>}
        </div>
        {displayEmail && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayEmail}</div>}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          {u.role && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 7px', background: 'rgba(var(--lbf-rot-rgb),0.06)', borderRadius: 4 }}>{rollenName(u.role)}</span>}
          {u.supervisor && <span style={{ fontSize: 9, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Supervisor</span>}
          {(() => {
            const tempActive = Object.values(u.temp_permissions || {}).filter(v => v?.until && new Date(v.until).getTime() > Date.now()).length
            return tempActive > 0
              ? <span style={{ fontSize: 9, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 7px', background: 'rgba(22,163,74,0.08)', borderRadius: 4 }}>+{tempActive} temp</span>
              : null
          })()}
        </div>
      </div>
      <div style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>
        {statusLabel}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={LABEL}>{label}</div>
      {children}
    </div>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--lbf-card)', borderRadius: 10, border: '0.5px solid rgba(var(--lbf-rot-rgb),0.1)', cursor: 'pointer' }}>
      <span style={{ fontSize: 13, color: 'var(--lbf-text)', fontWeight: 600 }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{
        width: 42, height: 24, borderRadius: 12, background: value ? 'var(--lbf-akzent-grund)' : 'rgba(var(--lbf-grau-rgb),0.3)',
        position: 'relative', transition: 'background 0.15s',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: value ? 20 : 2, width: 20, height: 20, borderRadius: '50%',
          background: 'var(--lbf-card)', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
    </label>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.5)', zIndex: 300 }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 301,
        background: 'var(--lbf-card)', borderRadius: '22px 22px 0 0',
        maxHeight: '94dvh', display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(var(--lbf-rot-rgb),0.2)' }} />
        </div>
        <div style={{ padding: '4px 20px 14px', borderBottom: '0.5px solid rgba(var(--lbf-rot-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'rgba(var(--lbf-rot-rgb),0.06)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--warm-gray)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 10px' }}>
          {children}
        </div>
      </div>
    </>
  )
}
