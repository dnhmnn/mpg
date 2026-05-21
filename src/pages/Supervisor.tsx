import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'

interface Org {
  id: string
  org_name: string
  org_code: string
  logo?: string
  is_active: boolean
  license_type?: string
  max_users?: number
  license_valid_until?: string
  userCount: number
}

interface OrgUser {
  id: string
  name: string
  email: string
  role?: string
  supervisor?: boolean
  organization_id?: string
}

const ROLE_LABELS: Record<string, string> = {
  mpg: 'MPG-Beauftragter',
  lager: 'Lagerwart',
  ausbildung: 'Ausbilder',
  qm: 'Qualitätsmanagement',
  benutzer: 'Benutzer'
}

function roleLabel(u: OrgUser) {
  if (u.supervisor) return 'Supervisor'
  return ROLE_LABELS[u.role || ''] || u.role || 'Benutzer'
}

function getInitials(name: string, email: string) {
  const src = name || email
  const parts = src.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

function formatDate(d?: string) {
  if (!d) return null
  try {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return d
  }
}

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 51,
        height: 31,
        borderRadius: 15.5,
        background: on ? '#34c759' : '#e5e5ea',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        padding: 0,
        flexShrink: 0
      }}
      aria-checked={on}
      role="switch"
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 22 : 2,
          width: 27,
          height: 27,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
          transition: 'left 0.2s'
        }}
      />
    </button>
  )
}

const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--warm-bg)',
  border: '1.5px solid rgba(96,8,18,0.15)',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  color: '#1a0e08',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box'
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#600812',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 6
}

export default function Supervisor() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  const [orgs, setOrgs] = useState<Org[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null)
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])
  const [orgUsersLoading, setOrgUsersLoading] = useState(false)

  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editLicenseType, setEditLicenseType] = useState('')
  const [editMaxUsers, setEditMaxUsers] = useState('')
  const [editValidUntil, setEditValidUntil] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [saveMsg, setSaveMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const [showNewOrgModal, setShowNewOrgModal] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgCode, setNewOrgCode] = useState('')
  const [newOrgLicenseType, setNewOrgLicenseType] = useState('standard')
  const [newOrgError, setNewOrgError] = useState('')
  const [creatingOrg, setCreatingOrg] = useState(false)

  const [showNewUserSheet, setShowNewUserSheet] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState('benutzer')
  const [newUserMsg, setNewUserMsg] = useState('')
  const [creatingUser, setCreatingUser] = useState(false)

  const [editingUser, setEditingUser] = useState<OrgUser | null>(null)
  const [userFormName, setUserFormName] = useState('')
  const [userFormEmail, setUserFormEmail] = useState('')
  const [userFormRole, setUserFormRole] = useState('benutzer')
  const [userFormPassword, setUserFormPassword] = useState('')
  const [userFormMsg, setUserFormMsg] = useState('')
  const [savingUser, setSavingUser] = useState(false)

  useEffect(() => {
    if (!loading && user && !user.supervisor) {
      navigate('/hub')
    }
  }, [loading, user, navigate])

  useEffect(() => {
    if (!loading && user?.supervisor) {
      loadOrgs()
    }
  }, [loading, user])

  async function loadOrgs() {
    setDataLoading(true)
    try {
      const [orgList, userList] = await Promise.all([
        pb.collection('organizations').getFullList({ sort: 'org_name' }),
        pb.collection('users').getFullList({ fields: 'id,organization_id' })
      ])
      const countMap: Record<string, number> = {}
      userList.forEach((u: any) => {
        if (u.organization_id) countMap[u.organization_id] = (countMap[u.organization_id] || 0) + 1
      })
      setOrgs(orgList.map((o: any) => ({ ...o, userCount: countMap[o.id] || 0 })))
    } catch (e) {
      console.error('Error loading orgs:', e)
    } finally {
      setDataLoading(false)
    }
  }

  async function loadOrgUsers(orgId: string) {
    setOrgUsersLoading(true)
    try {
      const result = await pb.collection('users').getFullList({
        filter: `organization_id = "${orgId}"`,
        sort: 'name'
      })
      setOrgUsers(result as unknown as OrgUser[])
    } catch (e) {
      console.error('Error loading org users:', e)
    } finally {
      setOrgUsersLoading(false)
    }
  }

  function openOrg(org: Org) {
    setSelectedOrg(org)
    setEditName(org.org_name || '')
    setEditCode(org.org_code || '')
    setEditLicenseType(org.license_type || '')
    setEditMaxUsers(org.max_users ? String(org.max_users) : '')
    setEditValidUntil(org.license_valid_until ? org.license_valid_until.slice(0, 10) : '')
    setEditActive(org.is_active)
    setSaveMsg('')
    setShowNewUserSheet(false)
    setNewUserName('')
    setNewUserEmail('')
    setNewUserPassword('')
    setNewUserRole('benutzer')
    setNewUserMsg('')
    loadOrgUsers(org.id)
  }

  function closeSheet() {
    setSelectedOrg(null)
    setOrgUsers([])
    setShowNewUserSheet(false)
  }

  async function saveOrg() {
    if (!selectedOrg) return
    setSaving(true)
    setSaveMsg('')
    try {
      await pb.collection('organizations').update(selectedOrg.id, {
        org_name: editName,
        org_code: editCode,
        license_type: editLicenseType || null,
        max_users: editMaxUsers ? parseInt(editMaxUsers) : null,
        license_valid_until: editValidUntil || null,
        is_active: editActive
      })
      setSaveMsg('Gespeichert.')
      setOrgs(prev => prev.map(o => o.id === selectedOrg.id ? {
        ...o,
        org_name: editName,
        org_code: editCode,
        license_type: editLicenseType || undefined,
        max_users: editMaxUsers ? parseInt(editMaxUsers) : undefined,
        license_valid_until: editValidUntil || undefined,
        is_active: editActive
      } : o))
      setSelectedOrg(prev => prev ? {
        ...prev,
        org_name: editName,
        org_code: editCode,
        license_type: editLicenseType || undefined,
        max_users: editMaxUsers ? parseInt(editMaxUsers) : undefined,
        license_valid_until: editValidUntil || undefined,
        is_active: editActive
      } : null)
    } catch (e: any) {
      setSaveMsg('Fehler: ' + (e?.message || 'Unbekannt'))
    } finally {
      setSaving(false)
    }
  }

  async function createOrg() {
    setNewOrgError('')
    if (!newOrgName.trim()) { setNewOrgError('Name erforderlich'); return }
    if (!newOrgCode.trim()) { setNewOrgError('Kürzel erforderlich'); return }
    setCreatingOrg(true)
    try {
      await pb.collection('organizations').create({
        org_name: newOrgName,
        org_code: newOrgCode,
        is_active: true,
        license_type: newOrgLicenseType || 'standard'
      })
      setShowNewOrgModal(false)
      setNewOrgName('')
      setNewOrgCode('')
      setNewOrgLicenseType('standard')
      await loadOrgs()
    } catch (e: any) {
      setNewOrgError('Fehler: ' + (e?.message || 'Unbekannt'))
    } finally {
      setCreatingOrg(false)
    }
  }

  async function createUser() {
    if (!selectedOrg) return
    setNewUserMsg('')
    if (!newUserName.trim()) { setNewUserMsg('Name erforderlich'); return }
    if (!newUserEmail.trim() || !newUserEmail.includes('@')) { setNewUserMsg('Gültige E-Mail erforderlich'); return }
    if (!newUserPassword || newUserPassword.length < 8) { setNewUserMsg('Passwort mind. 8 Zeichen'); return }
    setCreatingUser(true)
    try {
      await pb.collection('users').create({
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        passwordConfirm: newUserPassword,
        role: newUserRole,
        organization_id: selectedOrg.id,
        organization_name: selectedOrg.org_name,
        emailVisibility: true
      })
      setNewUserMsg('Benutzer erstellt.')
      setNewUserName('')
      setNewUserEmail('')
      setNewUserPassword('')
      setNewUserRole('benutzer')
      setShowNewUserSheet(false)
      await loadOrgUsers(selectedOrg.id)
      setOrgs(prev => prev.map(o => o.id === selectedOrg.id ? { ...o, userCount: o.userCount + 1 } : o))
    } catch (e: any) {
      setNewUserMsg('Fehler: ' + (e?.message || 'Unbekannt'))
    } finally {
      setCreatingUser(false)
    }
  }

  async function deleteUser(id: string) {
    if (!confirm('Benutzer wirklich löschen?')) return
    try {
      await pb.collection('users').delete(id)
      if (selectedOrg) {
        await loadOrgUsers(selectedOrg.id)
        setOrgs(prev => prev.map(o => o.id === selectedOrg.id ? { ...o, userCount: Math.max(0, o.userCount - 1) } : o))
      }
    } catch (e: any) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  function openEditUser(u: OrgUser) {
    setEditingUser(u)
    setUserFormName(u.name || '')
    setUserFormEmail(u.email)
    setUserFormRole(u.role || 'benutzer')
    setUserFormPassword('')
    setUserFormMsg('')
  }

  async function saveEditUser() {
    if (!editingUser) return
    setSavingUser(true)
    setUserFormMsg('')
    try {
      const updates: any = { name: userFormName, role: userFormRole }
      if (userFormPassword) {
        updates.password = userFormPassword
        updates.passwordConfirm = userFormPassword
      }
      await pb.collection('users').update(editingUser.id, updates)
      setUserFormMsg('Gespeichert.')
      if (selectedOrg) await loadOrgUsers(selectedOrg.id)
      setTimeout(() => {
        setEditingUser(null)
      }, 1200)
    } catch (e: any) {
      setUserFormMsg('Fehler: ' + (e?.message || 'Unbekannt'))
    } finally {
      setSavingUser(false)
    }
  }

  const filtered = orgs.filter(o => {
    const q = search.toLowerCase()
    return !q || o.org_name?.toLowerCase().includes(q) || o.org_code?.toLowerCase().includes(q)
  })

  const totalUsers = orgs.reduce((s, o) => s + o.userCount, 0)
  const activeCount = orgs.filter(o => o.is_active).length

  if (loading || (!user?.supervisor && !loading)) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 14, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Laden...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)' }}>
      <div style={{
        background: '#fff',
        borderBottom: '0.5px solid rgba(96,8,18,0.12)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'max(20px, env(safe-area-inset-left))',
        paddingRight: 'max(20px, env(safe-area-inset-right))'
      }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <a
            href="/hub"
            style={{ display: 'flex', alignItems: 'center', color: '#600812', textDecoration: 'none', flexShrink: 0 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </a>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1a0e08', letterSpacing: '-0.01em' }}>Supervisor</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>Organisationsverwaltung</div>
          </div>
          <div style={{ width: 22 }} />
        </div>
      </div>

      <div style={{
        padding: '20px max(20px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 40px)',
        maxWidth: 640,
        margin: '0 auto'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'ORGANISATIONEN', value: orgs.length },
            { label: 'AKTIV', value: activeCount },
            { label: 'BENUTZER', value: totalUsers }
          ].map(stat => (
            <div key={stat.label} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '14px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 48, fontWeight: 800, color: '#600812', lineHeight: 1 }}>
                {dataLoading ? '—' : stat.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen..."
            style={{
              flex: 1,
              background: '#fff',
              border: '1px solid rgba(96,8,18,0.12)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 14,
              color: '#1a0e08',
              fontFamily: 'inherit',
              outline: 'none'
            }}
          />
          <button
            onClick={() => {
              setNewOrgName('')
              setNewOrgCode('')
              setNewOrgLicenseType('standard')
              setNewOrgError('')
              setShowNewOrgModal(true)
            }}
            style={{
              background: '#600812',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 16px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            + Organisation
          </button>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>
          ORGANISATIONEN
        </div>

        {dataLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 14 }}>
            Laden...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 14 }}>
            Keine Organisationen gefunden
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(org => (
              <button
                key={org.id}
                onClick={() => openOrg(org)}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  borderLeft: `3px solid ${org.is_active ? '#600812' : 'rgba(138,122,104,0.4)'}`,
                  padding: '14px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  width: '100%'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: '#1a0e08' }}>
                    {org.org_name}
                  </div>
                  <div style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: org.is_active ? '#16a34a' : 'var(--warm-gray)',
                    background: org.is_active ? 'rgba(22,163,74,0.1)' : 'rgba(138,122,104,0.1)',
                    borderRadius: 4,
                    padding: '2px 6px'
                  }}>
                    {org.is_active ? 'AKTIV' : 'INAKTIV'}
                  </div>
                </div>
                <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginBottom: 2 }}>
                  {org.org_code}
                  {' · '}
                  {org.userCount} {org.userCount === 1 ? 'Benutzer' : 'Benutzer'}
                  {org.license_type ? ` · ${org.license_type}` : ''}
                </div>
                <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>
                  {org.license_valid_until
                    ? `Gültig bis ${formatDate(org.license_valid_until)}`
                    : 'Unbegrenzt'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedOrg && (
        <div
          onClick={closeSheet}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 600,
            background: 'rgba(26,14,8,0.5)',
            display: 'flex',
            alignItems: 'flex-end'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#fff',
              borderRadius: '22px 22px 0 0',
              maxHeight: '88vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 20px 8px',
              flexShrink: 0,
              position: 'relative'
            }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(96,8,18,0.15)' }} />
              <button
                onClick={closeSheet}
                style={{
                  position: 'absolute',
                  right: 16,
                  top: 10,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(96,8,18,0.08)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 16,
                  color: '#600812',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'inherit'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '0 20px calc(env(safe-area-inset-bottom) + 32px)', flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>
                ORGANISATION BEARBEITEN
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={fieldLabelStyle}>Name</div>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Organisationsname"
                  style={fieldInputStyle}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={fieldLabelStyle}>Code</div>
                <input
                  type="text"
                  value={editCode}
                  onChange={e => setEditCode(e.target.value)}
                  placeholder="z.B. brk-muenchen"
                  style={fieldInputStyle}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={fieldLabelStyle}>Lizenztyp</div>
                <select
                  value={editLicenseType}
                  onChange={e => setEditLicenseType(e.target.value)}
                  style={{ ...fieldInputStyle }}
                >
                  <option value="">—</option>
                  <option value="standard">Standard</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={fieldLabelStyle}>Max. Benutzer</div>
                <input
                  type="number"
                  value={editMaxUsers}
                  onChange={e => setEditMaxUsers(e.target.value)}
                  placeholder="Unbegrenzt"
                  style={fieldInputStyle}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={fieldLabelStyle}>Gültig bis</div>
                <input
                  type="date"
                  value={editValidUntil}
                  onChange={e => setEditValidUntil(e.target.value)}
                  style={fieldInputStyle}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Aktiv</div>
                <ToggleSwitch on={editActive} onChange={() => setEditActive(v => !v)} />
              </div>

              {saveMsg && (
                <div style={{
                  fontSize: 13,
                  fontStyle: 'italic',
                  color: saveMsg.startsWith('Fehler') ? '#dc2626' : '#16a34a',
                  marginBottom: 10
                }}>
                  {saveMsg}
                </div>
              )}

              <button
                onClick={saveOrg}
                disabled={saving}
                style={{
                  width: '100%',
                  background: '#600812',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '13px',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: saving ? 0.7 : 1,
                  marginBottom: 24
                }}
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>

              <div style={{ height: '0.5px', background: 'rgba(96,8,18,0.08)', marginBottom: 20 }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                  BENUTZER
                </div>
                <button
                  onClick={() => {
                    setShowNewUserSheet(v => !v)
                    setNewUserMsg('')
                  }}
                  style={{
                    background: '#600812',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  + Benutzer
                </button>
              </div>

              {orgUsersLoading ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 13 }}>
                  Laden...
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 16 }}>
                  {orgUsers.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 13 }}>
                      Keine Benutzer
                    </div>
                  ) : orgUsers.map((u, idx) => (
                    <div
                      key={u.id}
                      style={{
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        borderBottom: idx < orgUsers.length - 1 ? '0.5px solid rgba(96,8,18,0.06)' : 'none',
                        cursor: 'pointer'
                      }}
                      onClick={() => openEditUser(u)}
                    >
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        border: '1.5px solid #600812',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 12,
                        color: '#600812',
                        flexShrink: 0,
                        background: 'rgba(96,8,18,0.04)'
                      }}>
                        {getInitials(u.name, u.email)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 13, color: '#1a0e08', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.name || '—'}
                        </div>
                        <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.email}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#600812',
                        letterSpacing: '0.06em',
                        flexShrink: 0
                      }}>
                        {roleLabel(u)}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteUser(u.id) }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#dc2626',
                          fontSize: 18,
                          lineHeight: 1,
                          padding: '0 2px',
                          fontFamily: 'inherit',
                          flexShrink: 0
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showNewUserSheet && (
                <div style={{ background: 'var(--warm-bg)', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>
                    NEUER BENUTZER
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={fieldLabelStyle}>Name</div>
                    <input
                      type="text"
                      value={newUserName}
                      onChange={e => setNewUserName(e.target.value)}
                      placeholder="Vollständiger Name"
                      style={fieldInputStyle}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={fieldLabelStyle}>E-Mail</div>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={e => setNewUserEmail(e.target.value)}
                      placeholder="email@beispiel.de"
                      style={fieldInputStyle}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={fieldLabelStyle}>Passwort</div>
                    <input
                      type="password"
                      value={newUserPassword}
                      onChange={e => setNewUserPassword(e.target.value)}
                      placeholder="Mind. 8 Zeichen"
                      style={fieldInputStyle}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={fieldLabelStyle}>Rolle</div>
                    <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} style={fieldInputStyle}>
                      <option value="benutzer">Benutzer</option>
                      <option value="mpg">MPG-Beauftragter</option>
                      <option value="lager">Lagerwart</option>
                      <option value="ausbildung">Ausbilder</option>
                      <option value="qm">Qualitätsmanagement</option>
                    </select>
                  </div>
                  {newUserMsg && (
                    <div style={{ fontSize: 13, fontStyle: 'italic', color: newUserMsg.startsWith('Fehler') ? '#dc2626' : '#16a34a', marginBottom: 10 }}>
                      {newUserMsg}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={createUser}
                      disabled={creatingUser}
                      style={{
                        flex: 1,
                        background: '#600812',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '11px',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        opacity: creatingUser ? 0.7 : 1
                      }}
                    >
                      {creatingUser ? 'Erstellen...' : 'Erstellen'}
                    </button>
                    <button
                      onClick={() => setShowNewUserSheet(false)}
                      style={{
                        background: 'rgba(96,8,18,0.06)',
                        color: '#600812',
                        border: 'none',
                        borderRadius: 10,
                        padding: '11px 16px',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showNewOrgModal && (
        <div
          onClick={() => setShowNewOrgModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 700,
            background: 'rgba(26,14,8,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 24,
              maxWidth: 360,
              width: 'calc(100% - 40px)',
              margin: 20
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 17, color: '#1a0e08', marginBottom: 20 }}>Neue Organisation</div>

            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabelStyle}>Name</div>
              <input
                type="text"
                value={newOrgName}
                onChange={e => setNewOrgName(e.target.value)}
                placeholder="Organisationsname"
                style={fieldInputStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabelStyle}>Code</div>
              <input
                type="text"
                value={newOrgCode}
                onChange={e => setNewOrgCode(e.target.value)}
                placeholder="URL-Kürzel z.B. brk-muenchen"
                style={fieldInputStyle}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={fieldLabelStyle}>Lizenztyp</div>
              <select value={newOrgLicenseType} onChange={e => setNewOrgLicenseType(e.target.value)} style={fieldInputStyle}>
                <option value="standard">Standard</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            {newOrgError && (
              <div style={{ fontSize: 13, fontStyle: 'italic', color: '#dc2626', marginBottom: 12 }}>
                {newOrgError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={createOrg}
                disabled={creatingOrg}
                style={{
                  flex: 1,
                  background: '#600812',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: creatingOrg ? 0.7 : 1
                }}
              >
                {creatingOrg ? 'Erstellen...' : 'Erstellen'}
              </button>
              <button
                onClick={() => setShowNewOrgModal(false)}
                style={{
                  background: 'rgba(96,8,18,0.06)',
                  color: '#600812',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 16px',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div
          onClick={() => setEditingUser(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 800,
            background: 'rgba(26,14,8,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 24,
              maxWidth: 360,
              width: 'calc(100% - 40px)',
              margin: 20
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 17, color: '#1a0e08', marginBottom: 20 }}>Benutzer bearbeiten</div>

            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabelStyle}>Name</div>
              <input
                type="text"
                value={userFormName}
                onChange={e => setUserFormName(e.target.value)}
                placeholder="Name"
                style={fieldInputStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabelStyle}>E-Mail</div>
              <input
                type="email"
                value={userFormEmail}
                readOnly
                style={{ ...fieldInputStyle, color: 'var(--warm-gray)' }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabelStyle}>Passwort (optional)</div>
              <input
                type="password"
                value={userFormPassword}
                onChange={e => setUserFormPassword(e.target.value)}
                placeholder="Leer lassen für keine Änderung"
                style={fieldInputStyle}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={fieldLabelStyle}>Rolle</div>
              <select value={userFormRole} onChange={e => setUserFormRole(e.target.value)} style={fieldInputStyle}>
                <option value="benutzer">Benutzer</option>
                <option value="mpg">MPG-Beauftragter</option>
                <option value="lager">Lagerwart</option>
                <option value="ausbildung">Ausbilder</option>
                <option value="qm">Qualitätsmanagement</option>
              </select>
            </div>

            {userFormMsg && (
              <div style={{ fontSize: 13, fontStyle: 'italic', color: userFormMsg.startsWith('Fehler') ? '#dc2626' : '#16a34a', marginBottom: 12 }}>
                {userFormMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={saveEditUser}
                disabled={savingUser}
                style={{
                  flex: 1,
                  background: '#600812',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: savingUser ? 0.7 : 1
                }}
              >
                {savingUser ? 'Speichern...' : 'Speichern'}
              </button>
              <button
                onClick={() => setEditingUser(null)}
                style={{
                  background: 'rgba(96,8,18,0.06)',
                  color: '#600812',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 16px',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Abbrechen
              </button>
            </div>
            <button
              onClick={() => {
                if (!editingUser) return
                deleteUser(editingUser.id).then(() => setEditingUser(null))
              }}
              style={{
                width: '100%',
                background: 'none',
                color: '#dc2626',
                border: 'none',
                borderRadius: 10,
                padding: '10px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginTop: 10
              }}
            >
              Benutzer löschen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
