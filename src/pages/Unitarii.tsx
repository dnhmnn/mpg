import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'

interface UUser {
  id: string
  name: string
  email: string
  phone?: string
  role?: string
  permissions?: Record<string, boolean>
  organization_id?: string
  supervisor?: boolean
  disabled?: boolean
  expires_at?: string
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

const PERM_LABELS: { key: string; label: string }[] = [
  { key: 'lernbar',            label: 'Unitas' },
  { key: 'patienten',          label: 'Patienten' },
  { key: 'einsaetze',          label: 'Einsätze' },
  { key: 'dokumente',          label: 'Vorgänge' },
  { key: 'lager',              label: 'Lager' },
  { key: 'dateien',            label: 'Dateien' },
  { key: 'qr',                 label: 'QR-Codes' },
  { key: 'ausbildungen_manage',label: 'Ausbildungen' },
  { key: 'unitarii',           label: 'Benutzerverwaltung' },
  { key: 'dashboard',          label: 'MPG-Dashboard' },
  { key: 'chat',               label: 'Chat' },
]

const ROLES = ['benutzer', 'mpg', 'lager', 'ausbildung', 'qm']

const EMPTY_PERMS = Object.fromEntries(PERM_LABELS.map(p => [p.key, false])) as Record<string, boolean>

// ── LBF styles ──
const INPUT: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 10,
  border: '0.5px solid rgba(96,8,18,0.15)', background: '#fff',
  fontSize: 14, fontFamily: 'inherit', color: '#1a0e08', boxSizing: 'border-box',
  outline: 'none',
}
const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#600812',
  textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, display: 'block',
}
const BTN_PRIMARY: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 10, border: 'none',
  background: '#600812', color: '#fff', fontWeight: 700,
  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em',
}
const BTN_SECONDARY: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 10, border: '0.5px solid rgba(96,8,18,0.25)',
  background: '#fff', color: '#600812', fontWeight: 600,
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
  const navigate = useNavigate()
  const [tab, setTab] = useState<'benutzer' | 'neuigkeiten' | 'temp'>('benutzer')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const [users, setUsers] = useState<UUser[]>([])
  const [editingUser, setEditingUser] = useState<UUser | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [userForm, setUserForm] = useState({
    name: '', email: '', phone: '', password: '', role: 'benutzer',
    permissions: { ...EMPTY_PERMS },
    supervisor: false, disabled: false, expires_at: '',
  })
  const [savingUser, setSavingUser] = useState(false)

  const [neuigkeiten, setNeuigkeiten] = useState<Neuigkeit[]>([])
  const [nOpen, setNOpen] = useState(false)
  const [editingN, setEditingN] = useState<Neuigkeit | null>(null)
  const [nForm, setNForm] = useState({ titel: '', inhalt: '', gepinnt: false })
  const [nAnhang, setNAnhang] = useState<File | null>(null)
  const [savingN, setSavingN] = useState(false)

  const [tempOpen, setTempOpen] = useState(false)
  const [tempForm, setTempForm] = useState({
    name: '', email: '', password: genPassword(),
    role: 'benutzer', permissions: { ...EMPTY_PERMS, lernbar: true },
    durationHours: 24, customExpiresAt: '',
  })
  const [savingTemp, setSavingTemp] = useState(false)

  useEffect(() => { if (user) loadAll() }, [user])

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3500)
  }

  async function loadAll() {
    setLoading(true)
    try { await Promise.all([loadUsers(), loadNeuigkeiten()]) }
    finally { setLoading(false) }
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
    setUserForm(u ? {
      name: u.name || '', email: u.email || '', phone: u.phone || '',
      password: '', role: u.role || 'benutzer',
      permissions: { ...EMPTY_PERMS, ...(u.permissions || {}) },
      supervisor: !!u.supervisor, disabled: !!u.disabled,
      expires_at: fmtDateTimeLocal(u.expires_at),
    } : {
      name: '', email: '', phone: '', password: genPassword(),
      role: 'benutzer', permissions: { ...EMPTY_PERMS },
      supervisor: false, disabled: false, expires_at: '',
    })
    setEditOpen(true)
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
        phone: userForm.phone.trim(), role: userForm.role,
        permissions: userForm.permissions, disabled: userForm.disabled,
        expires_at: expIso,
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

  if (authLoading) return null

  if (!user?.supervisor && (user as any)?.role !== 'mpg') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--warm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: '#1a0e08' }}>Kein Zugriff</div>
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

      {/* Masthead */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '0.5px solid rgba(96,8,18,0.12)', padding: '0 16px', display: 'flex', alignItems: 'center', height: 60, gap: 12 }}>
        <button onClick={() => navigate('/hub')} style={{ background: 'rgba(96,8,18,0.06)', border: 'none', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#600812' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a0e08', letterSpacing: '-0.01em' }}>Benutzerverwaltung</div>
          <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
          </div>
        </div>
        <div style={{ width: 34 }} />
      </div>

      {/* Tab Bar */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(96,8,18,0.08)', display: 'flex', justifyContent: 'center', gap: 0 }}>
        {([
          { key: 'benutzer',   label: 'Benutzer',  count: regularUsers.length },
          { key: 'neuigkeiten', label: 'Neuigkeiten', count: neuigkeiten.length },
          { key: 'temp',       label: 'Temporär',  count: tempUsers.length },
        ] as const).map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, maxWidth: 200, padding: '12px 10px 10px', background: 'transparent', border: 'none',
              borderTop: active ? '2px solid #600812' : '2px solid transparent',
              fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: active ? '#600812' : 'var(--warm-gray)',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Alle Benutzer</div>
              <button onClick={() => openEditUser()} style={BTN_PRIMARY}>+ Hinzufügen</button>
            </div>

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Veröffentlicht in Unitas</div>
              <button onClick={() => openEditN()} style={BTN_PRIMARY}>+ Neuigkeit</button>
            </div>

            {neuigkeiten.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch keine Neuigkeiten</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {neuigkeiten.map(n => {
                  const url = n.anhang ? `https://api.responda.systems/api/files/${n.collectionId}/${n.id}/${n.anhang}` : null
                  return (
                    <div key={n.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${n.gepinnt ? '#d97706' : '#600812'}`, overflow: 'hidden' }}>
                      {n.gepinnt && (
                        <div style={{ background: 'rgba(217,119,6,0.08)', padding: '5px 14px', fontSize: 10, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Angeheftet</div>
                      )}
                      {url && (
                        <img src={url} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
                      )}
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: '#1a0e08', marginBottom: 4 }}>{n.titel}</div>
                        {n.inhalt && <div style={{ fontSize: 13.5, color: '#1a0e08', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{n.inhalt}</div>}
                        <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            {n.erstellt_von && <>{n.erstellt_von} · </>}
                            {new Date(n.created).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}
                          </span>
                          <span style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openEditN(n)} style={{ ...BTN_SECONDARY, padding: '5px 11px', fontSize: 11 }}>Bearbeiten</button>
                            <button onClick={() => deleteN(n.id)} style={{ ...BTN_SECONDARY, padding: '5px 11px', fontSize: 11, color: '#b91c1c', borderColor: 'rgba(185,28,28,0.3)' }}>Löschen</button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Zugänge mit Ablaufdatum</div>
              <button onClick={openTempCreate} style={BTN_PRIMARY}>+ Erstellen</button>
            </div>
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
            <Field label="E-Mail *"><input type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} placeholder="max@example.com" style={INPUT} /></Field>
            <Field label="Telefon"><input type="tel" value={userForm.phone} onChange={e => setUserForm(p => ({ ...p, phone: e.target.value }))} placeholder="+49 …" style={INPUT} /></Field>

            <Field label="Rolle">
              <select value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))} style={INPUT}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>

            <div>
              <div style={LABEL}>Zugriffsrechte</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 12px', background: '#fff', borderRadius: 10, border: '0.5px solid rgba(96,8,18,0.1)' }}>
                {PERM_LABELS.map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1a0e08' }}>
                    <input type="checkbox" checked={!!userForm.permissions[key]} onChange={e => setUserForm(p => ({ ...p, permissions: { ...p.permissions, [key]: e.target.checked } }))} style={{ width: 16, height: 16, accentColor: '#600812' }} />
                    {label}
                  </label>
                ))}
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

          <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '0.5px solid rgba(96,8,18,0.08)' }}>
            <button onClick={() => setEditOpen(false)} style={{ ...BTN_SECONDARY, flex: 1 }}>Abbrechen</button>
            {editingUser && editingUser.id !== user?.id && (
              <button onClick={() => { deleteUser(editingUser.id); setEditOpen(false) }} style={{ ...BTN_SECONDARY, color: '#b91c1c', borderColor: 'rgba(185,28,28,0.3)' }}>Löschen</button>
            )}
            <button onClick={saveUser} disabled={savingUser} style={{ ...BTN_PRIMARY, flex: 2, opacity: savingUser ? 0.5 : 1 }}>
              {savingUser ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </Sheet>
      )}

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
          <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '0.5px solid rgba(96,8,18,0.08)' }}>
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
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <div>
              <div style={LABEL}>Berechtigungen</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 12px', background: '#fff', borderRadius: 10, border: '0.5px solid rgba(96,8,18,0.1)' }}>
                {PERM_LABELS.map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1a0e08' }}>
                    <input type="checkbox" checked={!!tempForm.permissions[key]} onChange={e => setTempForm(p => ({ ...p, permissions: { ...p.permissions, [key]: e.target.checked } }))} style={{ width: 16, height: 16, accentColor: '#600812' }} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Dauer">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[{ h: 1, l: '1h' }, { h: 4, l: '4h' }, { h: 24, l: '24h' }, { h: 24 * 7, l: '7 Tage' }, { h: 24 * 30, l: '30 Tage' }].map(opt => {
                  const active = !tempForm.customExpiresAt && tempForm.durationHours === opt.h
                  return (
                    <button key={opt.h} onClick={() => setTempForm(p => ({ ...p, durationHours: opt.h, customExpiresAt: '' }))} style={{
                      ...BTN_SECONDARY,
                      background: active ? '#600812' : '#fff',
                      color: active ? '#fff' : '#600812',
                      borderColor: active ? '#600812' : 'rgba(96,8,18,0.25)',
                      padding: '7px 14px', fontSize: 12,
                    }}>{opt.l}</button>
                  )
                })}
              </div>
              <input type="datetime-local" value={tempForm.customExpiresAt} onChange={e => setTempForm(p => ({ ...p, customExpiresAt: e.target.value }))} style={{ ...INPUT, marginTop: 8 }} placeholder="oder exaktes Datum" />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '0.5px solid rgba(96,8,18,0.08)' }}>
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
  const stripColor = u.disabled || expired ? 'rgba(139,113,90,0.5)' : (expSoon ? '#d97706' : '#600812')
  const statusLabel = u.disabled
    ? 'DEAKTIVIERT'
    : expired ? 'ABGELAUFEN'
    : (expSoon ? `LÄUFT AB · ${fmtCountdown(u.expires_at!)}` : 'AKTIV')
  const statusColor = u.disabled || expired ? 'var(--warm-gray)' : (expSoon ? '#d97706' : '#16a34a')

  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      borderLeft: `3px solid ${stripColor}`, padding: '12px 14px', display: 'flex',
      alignItems: 'center', gap: 12, cursor: 'pointer',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%', background: '#600812',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 15, flexShrink: 0,
      }}>{(u.name || u.email || '?').charAt(0).toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 16, color: '#1a0e08', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || '—'}</div>
          {isSelf && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>· du</span>}
        </div>
        <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          {u.role && <span style={{ fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 7px', background: 'rgba(96,8,18,0.06)', borderRadius: 4 }}>{u.role}</span>}
          {u.supervisor && <span style={{ fontSize: 9, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Supervisor</span>}
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
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fff', borderRadius: 10, border: '0.5px solid rgba(96,8,18,0.1)', cursor: 'pointer' }}>
      <span style={{ fontSize: 13, color: '#1a0e08', fontWeight: 600 }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{
        width: 42, height: 24, borderRadius: 12, background: value ? '#600812' : 'rgba(139,113,90,0.3)',
        position: 'relative', transition: 'background 0.15s',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: value ? 20 : 2, width: 20, height: 20, borderRadius: '50%',
          background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
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
        background: '#fff', borderRadius: '22px 22px 0 0',
        maxHeight: '94dvh', display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(96,8,18,0.2)' }} />
        </div>
        <div style={{ padding: '4px 20px 14px', borderBottom: '0.5px solid rgba(96,8,18,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#1a0e08' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'rgba(96,8,18,0.06)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--warm-gray)' }}>
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
