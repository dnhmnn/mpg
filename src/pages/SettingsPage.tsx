import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import type { User } from '../types'
import StatusBar from '../components/StatusBar'
import { getTheme, setTheme, type ThemeMode } from '../lib/theme'
import { ALL_APPS, getDockPins, setDockPins, MAX_DOCK_PINS } from '../lib/apps'
import AppIcon from '../components/AppIcon'

interface SettingsPageProps {
  user: User | null
}

type Tab = 'profile' | 'password' | 'appearance' | 'users' | 'license'

export default function SettingsPage({ user }: SettingsPageProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [themeMode, setThemeMode] = useState<ThemeMode>(getTheme())
  const [dockPins, setDockPinsState] = useState<string[]>(() =>
    user ? getDockPins(user.id) : []
  )

  function toggleDockPin(id: string) {
    if (!user) return
    setDockPinsState(prev => {
      const next = prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < MAX_DOCK_PINS ? [...prev, id] : prev
      setDockPins(user.id, next)
      return next
    })
  }

  // Profile tab
  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileMsg, setProfileMsg] = useState('')

  // Password tab
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew1, setPwNew1] = useState('')
  const [pwNew2, setPwNew2] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  // Users tab
  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // User modal
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [userFormName, setUserFormName] = useState('')
  const [userFormEmail, setUserFormEmail] = useState('')
  const [userFormPassword, setUserFormPassword] = useState('')
  const [userFormRole, setUserFormRole] = useState('benutzer')
  const [userFormMsg, setUserFormMsg] = useState('')
  const [savingUser, setSavingUser] = useState(false)

  // License tab
  const [license, setLicense] = useState<any>(null)

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '')
      setProfilePhone(user.phone || '')
    }
  }, [user])

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers()
    }
    if (activeTab === 'license') {
      loadLicense()
    }
  }, [activeTab])

  async function saveProfile() {
    if (!user) return
    try {
      await pb.collection('users').update(user.id, {
        name: profileName,
        phone: profilePhone
      })
      setProfileMsg('✅ Profil gespeichert!')
      setTimeout(() => setProfileMsg(''), 3000)
    } catch (e: any) {
      setProfileMsg('❌ Fehler: ' + e.message)
    }
  }

  async function changePassword() {
    if (!user) return
    setPwMsg('')

    if (!pwCurrent) {
      setPwMsg('❌ Aktuelles Passwort eingeben')
      return
    }
    if (!pwNew1 || pwNew1.length < 8) {
      setPwMsg('❌ Neues Passwort: mind. 8 Zeichen')
      return
    }
    if (pwNew1 !== pwNew2) {
      setPwMsg('❌ Passwörter stimmen nicht überein')
      return
    }

    try {
      await pb.collection('users').authWithPassword(user.email, pwCurrent)
      await pb.collection('users').update(user.id, {
        password: pwNew1,
        passwordConfirm: pwNew1,
        oldPassword: pwCurrent
      })
      setPwMsg('✅ Passwort geändert! Du wirst abgemeldet...')
      setTimeout(() => {
        pb.authStore.clear()
        localStorage.clear()
        window.location.href = '/login'
      }, 2000)
    } catch (e: any) {
      setPwMsg('❌ Fehler: ' + e.message)
    }
  }

  async function loadUsers() {
    if (!user?.organization_id) return
    setLoadingUsers(true)
    try {
      const result = await pb.collection('users').getFullList({
        filter: `organization_id = "${user.organization_id}"`,
        sort: '-created'
      })
      setUsers(result)
    } catch (e) {
      console.error('Error loading users:', e)
    } finally {
      setLoadingUsers(false)
    }
  }

  async function loadLicense() {
    if (!user?.organization_id) return
    try {
      const org = await pb.collection('organizations').getOne(user.organization_id)
      setLicense(org)
    } catch (e) {
      console.error('Error loading license:', e)
    }
  }

  // User management functions
  function openAddUser() {
    setEditingUser(null)
    setUserFormName('')
    setUserFormEmail('')
    setUserFormPassword('')
    setUserFormRole('benutzer')
    setUserFormMsg('')
    setShowUserModal(true)
  }

  function openEditUser(u: any) {
    setEditingUser(u)
    setUserFormName(u.name || '')
    setUserFormEmail(u.email)
    setUserFormPassword('')
    setUserFormRole(u.role || 'benutzer')
    setUserFormMsg('')
    setShowUserModal(true)
  }

  async function saveUser() {
    if (!user?.organization_id) return
    setUserFormMsg('')
    setSavingUser(true)

    if (!userFormEmail || !userFormEmail.includes('@')) {
      setUserFormMsg('❌ Gültige E-Mail eingeben')
      setSavingUser(false)
      return
    }

    try {
      if (editingUser) {
        // Edit existing user
        const updateData: any = {
          name: userFormName,
          role: userFormRole
        }

        if (userFormPassword) {
          updateData.password = userFormPassword
          updateData.passwordConfirm = userFormPassword
        }

        await pb.collection('users').update(editingUser.id, updateData)
        setUserFormMsg('✅ Benutzer aktualisiert!')
      } else {
        // Create new user - PocketBase requires a password, but user will get email to set their own
        // Generate a random temporary password
        const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'

        await pb.collection('users').create({
          email: userFormEmail,
          name: userFormName,
          role: userFormRole,
          password: tempPassword,
          passwordConfirm: tempPassword,
          organization_id: user.organization_id
        })

        // Request password reset so user can set their own password via email
        await pb.collection('users').requestPasswordReset(userFormEmail)

        setUserFormMsg('✅ Benutzer erstellt! E-Mail zur Passwortfestlegung wurde gesendet.')
      }

      setTimeout(() => {
        setShowUserModal(false)
        loadUsers()
      }, 2000)
    } catch (e: any) {
      setUserFormMsg('❌ Fehler: ' + e.message)
    } finally {
      setSavingUser(false)
    }
  }

  async function deleteUser(userId: string) {
    if (!confirm('Möchten Sie diesen Benutzer wirklich löschen?')) return

    try {
      await pb.collection('users').delete(userId)
      loadUsers()
    } catch (e: any) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  const canManageUsers = user?.supervisor || user?.role === 'mpg'

  function handleThemeChange(mode: ThemeMode) {
    setTheme(mode)
    setThemeMode(mode)
  }

  // iOS-style settings items
  const settingsItems = [
    { id: 'profile', label: 'Profil', icon: 'person', tab: 'profile' as Tab },
    { id: 'password', label: 'Passwort', icon: 'lock', tab: 'password' as Tab },
    { id: 'appearance', label: 'Darstellung', icon: 'appearance', tab: 'appearance' as Tab },
    ...(canManageUsers ? [
      { id: 'users', label: 'Benutzer', icon: 'people', tab: 'users' as Tab },
      { id: 'license', label: 'Lizenz', icon: 'key', tab: 'license' as Tab }
    ] : [])
  ]

  const roleLabels: Record<string, string> = {
    mpg: 'MPG',
    lager: 'Lager',
    ausbildung: 'Ausbildung',
    qm: 'QM',
    benutzer: 'Benutzer'
  }

  const roleOptions = [
    { value: 'benutzer', label: 'Benutzer' },
    { value: 'lager', label: 'Lager' },
    { value: 'ausbildung', label: 'Ausbildung' },
    { value: 'qm', label: 'QM' },
    { value: 'mpg', label: 'MPG' }
  ]

  return (
    <div className="settings-page">
      <StatusBar
        user={user}
        onLogout={() => {
          pb.authStore.clear()
          localStorage.clear()
          navigate('/login')
        }}
        showBackButton={true}
        onBackClick={() => navigate('/hub')}
      />

      <div className="settings-content">
        {/* iOS-style grouped list */}
        <div className="settings-group">
          {settingsItems.map((item) => (
            <button
              key={item.id}
              className={`settings-item ${activeTab === item.tab ? 'active' : ''}`}
              onClick={() => setActiveTab(item.tab)}
            >
              <div className="settings-item-icon">
                {item.icon === 'person' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                )}
                {item.icon === 'lock' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                )}
                {item.icon === 'people' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                )}
                {item.icon === 'key' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                  </svg>
                )}
                {item.icon === 'appearance' && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                  </svg>
                )}
              </div>
              <span className="settings-item-label">{item.label}</span>
              <div className="settings-item-chevron">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="settings-panel">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="settings-section">
              <div className="settings-section-header">PROFIL</div>
              <div className="settings-section-content">
                <div className="ios-field">
                  <label>E-Mail</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                  />
                </div>
                <div className="ios-field">
                  <label>Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Dein Name"
                  />
                </div>
                <div className="ios-field">
                  <label>Telefon</label>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="+49 123 456789"
                  />
                </div>
                {profileMsg && (
                  <div style={{ marginTop: '12px', fontSize: '14px', color: profileMsg.includes('✅') ? '#34c759' : '#ff3b30' }}>
                    {profileMsg}
                  </div>
                )}
                <button className="ios-button" onClick={saveProfile}>
                  Profil speichern
                </button>
              </div>
            </div>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <div className="settings-section">
              <div className="settings-section-header">PASSWORT ÄNDERN</div>
              <div className="settings-section-content">
                <div className="ios-field">
                  <label>Aktuelles Passwort</label>
                  <input
                    type="password"
                    value={pwCurrent}
                    onChange={(e) => setPwCurrent(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="ios-field">
                  <label>Neues Passwort</label>
                  <input
                    type="password"
                    value={pwNew1}
                    onChange={(e) => setPwNew1(e.target.value)}
                    placeholder="Min. 8 Zeichen"
                  />
                </div>
                <div className="ios-field">
                  <label>Bestätigen</label>
                  <input
                    type="password"
                    value={pwNew2}
                    onChange={(e) => setPwNew2(e.target.value)}
                    placeholder="Wiederholen"
                  />
                </div>
                {pwMsg && (
                  <div style={{ marginTop: '12px', fontSize: '14px', color: pwMsg.includes('✅') ? '#34c759' : '#ff3b30' }}>
                    {pwMsg}
                  </div>
                )}
                <button className="ios-button" onClick={changePassword}>
                  Passwort ändern
                </button>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="settings-section">
              <div className="settings-section-header">DARSTELLUNG</div>
              <div className="settings-section-content">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {([
                    { value: 'light', label: 'Hell', icon: '☀️', desc: 'Helles Design' },
                    { value: 'dark', label: 'Dunkel', icon: '🌙', desc: 'Dunkles Design' },
                    { value: 'system', label: 'System', icon: '⚙️', desc: 'Geräteeinstellung' },
                    { value: 'retro', label: 'Retro', icon: '📟', desc: 'CRT Terminal — grüner Phosphor' }
                  ] as { value: ThemeMode; label: string; icon: string; desc: string }[]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleThemeChange(opt.value)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: themeMode === opt.value ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                        background: themeMode === opt.value ? 'var(--bg-subtle)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s',
                        width: '100%'
                      }}
                    >
                      <span style={{ fontSize: '22px', lineHeight: 1 }}>{opt.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text)' }}>{opt.label}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{opt.desc}</div>
                      </div>
                      {themeMode === opt.value && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Dock Tab */}
          {activeTab === 'appearance' && (
            <div className="settings-section" style={{ marginTop: '16px' }}>
              <div className="settings-section-header">DOCK</div>
              <div className="settings-section-content">
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  Wähle bis zu {MAX_DOCK_PINS} Apps für das Dock. Zuletzt geöffnete Apps erscheinen auf iPad/Mac automatisch rechts daneben.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '10px' }}>
                  {Object.values(ALL_APPS).filter(a => a.id !== 'settings').map(app => {
                    const pinned = dockPins.includes(app.id)
                    const blocked = !pinned && dockPins.length >= MAX_DOCK_PINS
                    const colorMatch = app.color?.match(/#[0-9a-fA-F]{6}/)?.[0] || 'var(--accent)'
                    return (
                      <button
                        key={app.id}
                        onClick={() => toggleDockPin(app.id)}
                        disabled={blocked}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                          padding: '10px 6px', borderRadius: '14px', border: 'none', cursor: blocked ? 'not-allowed' : 'pointer',
                          background: pinned ? 'var(--bg-subtle)' : 'transparent',
                          outline: pinned ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                          outlineOffset: '-1.5px',
                          opacity: blocked ? 0.35 : 1,
                          transition: 'all 0.15s', fontFamily: 'inherit',
                          position: 'relative'
                        }}
                      >
                        <div style={{
                          width: '46px', height: '46px', borderRadius: '12px',
                          background: pinned ? app.color || 'var(--accent)' : 'var(--bg-card-solid)',
                          color: pinned ? '#fff' : colorMatch,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)', transition: 'all 0.15s'
                        }}>
                          <AppIcon icon={app.icon} />
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text)', fontWeight: pinned ? 600 : 400, textAlign: 'center', lineHeight: 1.2 }}>
                          {app.name}
                        </span>
                        {pinned && (
                          <div style={{
                            position: 'absolute', top: '4px', right: '4px',
                            width: '14px', height: '14px', borderRadius: '50%',
                            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  {dockPins.length} / {MAX_DOCK_PINS} gepinnt
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="settings-section">
              <div className="settings-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>BENUTZER</span>
                {canManageUsers && (
                  <button
                    onClick={openAddUser}
                    style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    + Hinzufügen
                  </button>
                )}
              </div>
              <div className="settings-section-content">
                {loadingUsers ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    Lade Benutzer...
                  </div>
                ) : users.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    Keine Benutzer gefunden
                  </div>
                ) : (
                  users.map((u) => (
                    <div key={u.id} className="user-row">
                      <div className="user-avatar">
                        {(u.name || u.email)[0].toUpperCase()}
                      </div>
                      <div className="user-info">
                        <div className="user-name">{u.name || '—'}</div>
                        <div className="user-email">{u.email}</div>
                      </div>
                      <div className="user-role">{roleLabels[u.role] || 'Benutzer'}</div>
                      {canManageUsers && u.id !== user?.id && (
                        <div className="user-actions">
                          <button
                            onClick={() => openEditUser(u)}
                            className="user-action-btn edit"
                            title="Bearbeiten"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteUser(u.id)}
                            className="user-action-btn delete"
                            title="Löschen"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* License Tab */}
          {activeTab === 'license' && license && (
            <div className="settings-section">
              <div className="settings-section-header">LIZENZ</div>
              <div className="settings-section-content">
                <div className="license-card">
                  <div className="license-status">✓ Aktiv</div>
                  <div className="license-title">{license.org_name || 'Organisation'}</div>
                  <div className="license-details">
                    <div className="license-row">
                      <span>Lizenztyp</span>
                      <span>{license.license_type ? license.license_type.charAt(0).toUpperCase() + license.license_type.slice(1) : 'Standard'}</span>
                    </div>
                    <div className="license-row">
                      <span>Benutzer</span>
                      <span>{users.length} / {license.max_users || '∞'}</span>
                    </div>
                    <div className="license-row">
                      <span>Gültig bis</span>
                      <span>{license.license_valid_until ? new Date(license.license_valid_until).toLocaleDateString('de-DE') : 'Unbegrenzt'}</span>
                    </div>
                  </div>
                </div>

                <div className="support-card">
                  <div className="support-title">Support</div>
                  <div className="support-text">
                    Bei Fragen zur Lizenz kontaktieren Sie uns unter:
                  </div>
                  <div className="support-email">support@responda.systems</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingUser ? 'Benutzer bearbeiten' : 'Benutzer hinzufügen'}</h3>
              <button className="modal-close" onClick={() => setShowUserModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="ios-field">
                <label>Name</label>
                <input
                  type="text"
                  value={userFormName}
                  onChange={(e) => setUserFormName(e.target.value)}
                  placeholder="Name eingeben"
                />
              </div>
              <div className="ios-field">
                <label>E-Mail {editingUser && '(nicht änderbar)'}</label>
                <input
                  type="email"
                  value={userFormEmail}
                  onChange={(e) => setUserFormEmail(e.target.value)}
                  placeholder="email@beispiel.de"
                  disabled={!!editingUser}
                  style={editingUser ? { background: 'var(--bg-subtle)', color: 'var(--text-secondary)' } : {}}
                />
              </div>
              {editingUser && (
                <div className="ios-field">
                  <label>Neues Passwort (optional)</label>
                  <input
                    type="password"
                    value={userFormPassword}
                    onChange={(e) => setUserFormPassword(e.target.value)}
                    placeholder="Leer lassen für kein Passwort"
                  />
                </div>
              )}
              <div className="ios-field">
                <label>Rolle</label>
                <select
                  value={userFormRole}
                  onChange={(e) => setUserFormRole(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', background: 'var(--bg-input)', border: '0.5px solid var(--border-medium)', borderRadius: '10px', color: 'var(--text)', fontSize: '16px', outline: 'none', appearance: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {roleOptions.map(opt => (
                    <option key={opt.value} value={opt.value} style={{ background: 'var(--bg-card-solid)' }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {userFormMsg && (
                <div style={{ marginTop: '12px', fontSize: '14px', color: userFormMsg.includes('✅') ? '#34c759' : '#ff3b30' }}>
                  {userFormMsg}
                </div>
              )}
              <button
                className="ios-button"
                onClick={saveUser}
                disabled={savingUser}
                style={{ opacity: savingUser ? 0.7 : 1 }}
              >
                {savingUser ? 'Speichern...' : (editingUser ? 'Änderungen speichern' : 'Benutzer erstellen')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
