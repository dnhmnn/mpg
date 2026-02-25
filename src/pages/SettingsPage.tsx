import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import type { User } from '../types'
import StatusBar from '../components/StatusBar'

interface SettingsPageProps {
  user: User | null
}

type Tab = 'profile' | 'password' | 'users' | 'license'

export default function SettingsPage({ user }: SettingsPageProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('profile')

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

  const canManageUsers = user?.supervisor || user?.role === 'mpg'

  // iOS-style settings items
  const settingsItems = [
    { id: 'profile', label: 'Profil', icon: 'person', tab: 'profile' as Tab },
    { id: 'password', label: 'Passwort', icon: 'lock', tab: 'password' as Tab },
    ...(canManageUsers ? [
      { id: 'users', label: 'Benutzer', icon: 'people', tab: 'users' as Tab },
      { id: 'license', label: 'Lizenz', icon: 'key', tab: 'license' as Tab }
    ] : [])
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
                    style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
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

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="settings-section">
              <div className="settings-section-header">BENUTZER</div>
              <div className="settings-section-content">
                {loadingUsers ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>
                    Lade Benutzer...
                  </div>
                ) : users.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>
                    Keine Benutzer gefunden
                  </div>
                ) : (
                  users.map((u) => {
                    const roleLabels: Record<string, string> = {
                      mpg: 'MPG',
                      lager: 'Lager',
                      ausbildung: 'Ausbildung',
                      qm: 'QM',
                      benutzer: 'Benutzer'
                    }
                    return (
                      <div key={u.id} className="user-row">
                        <div className="user-avatar">
                          {(u.name || u.email)[0].toUpperCase()}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{u.name || '—'}</div>
                          <div className="user-email">{u.email}</div>
                        </div>
                        <div className="user-role">{roleLabels[u.role] || 'Benutzer'}</div>
                      </div>
                    )
                  })
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
    </div>
  )
}
