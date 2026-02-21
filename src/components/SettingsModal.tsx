import { useState, useEffect } from 'react'
import { pb } from '../lib/pocketbase'
import type { User } from '../types'
import Modal from './Modal'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
}

type Tab = 'profile' | 'password' | 'users' | 'license'

export default function SettingsModal({ isOpen, onClose, user }: SettingsModalProps) {
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
    if (isOpen && user) {
      setProfileName(user.name || '')
      setProfilePhone(user.phone || '')
    }
  }, [isOpen, user])

  useEffect(() => {
    if (isOpen && activeTab === 'users') {
      loadUsers()
    }
    if (isOpen && activeTab === 'license') {
      loadLicense()
    }
  }, [isOpen, activeTab])

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
      // Verify current password
      await pb.collection('users').authWithPassword(user.email, pwCurrent)
      
      // Update password
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Einstellungen">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto' }}>
        <button 
          className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profil
        </button>
        <button 
          className={`settings-tab ${activeTab === 'password' ? 'active' : ''}`}
          onClick={() => setActiveTab('password')}
        >
          Passwort
        </button>
        {canManageUsers && (
          <>
            <button 
              className={`settings-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              Benutzer
            </button>
            <button 
              className={`settings-tab ${activeTab === 'license' ? 'active' : ''}`}
              onClick={() => setActiveTab('license')}
            >
              Lizenz
            </button>
          </>
        )}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div>
          <div className="field">
            <label>E-Mail</label>
            <input 
              type="email" 
              value={user?.email || ''} 
              readOnly 
              style={{ background: '#f5f5f5' }}
            />
          </div>
          <div className="field">
            <label>Name</label>
            <input 
              type="text" 
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Dein Name"
            />
          </div>
          <div className="field">
            <label>Telefon</label>
            <input 
              type="tel" 
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              placeholder="+49 123 456789"
            />
          </div>
          {profileMsg && (
            <div style={{ marginTop: '12px', fontSize: '14px', color: profileMsg.includes('✅') ? '#16a34a' : '#ef4444' }}>
              {profileMsg}
            </div>
          )}
          <button className="btn" onClick={saveProfile} style={{ marginTop: '16px', width: '100%' }}>
            Profil speichern
          </button>
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div>
          <div className="field">
            <label>Aktuelles Passwort</label>
            <input 
              type="password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="field">
            <label>Neues Passwort (min. 8 Zeichen)</label>
            <input 
              type="password"
              value={pwNew1}
              onChange={(e) => setPwNew1(e.target.value)}
              placeholder="Neues Passwort"
            />
          </div>
          <div className="field">
            <label>Passwort wiederholen</label>
            <input 
              type="password"
              value={pwNew2}
              onChange={(e) => setPwNew2(e.target.value)}
              placeholder="Wiederholen"
            />
          </div>
          {pwMsg && (
            <div style={{ marginTop: '12px', fontSize: '14px', color: pwMsg.includes('✅') ? '#16a34a' : '#ef4444' }}>
              {pwMsg}
            </div>
          )}
          <button className="btn" onClick={changePassword} style={{ marginTop: '16px', width: '100%' }}>
            Passwort ändern
          </button>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: '#f8f8f8' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#1a1a1a', borderBottom: '2px solid #e0e0e0' }}>Name</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#1a1a1a', borderBottom: '2px solid #e0e0e0' }}>E-Mail</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#1a1a1a', borderBottom: '2px solid #e0e0e0' }}>Rolle</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                      Lade Benutzer...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                      Keine Benutzer gefunden
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const roleLabels: Record<string, string> = {
                      mpg: '👑 MPG',
                      lager: '📦 Lager',
                      ausbildung: '🎓 Ausbildung',
                      qm: '📋 QM',
                      benutzer: '👤 Benutzer'
                    }
                    const roleLabel = roleLabels[u.role] || '👤 Benutzer'
                    
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '12px' }}>{u.name || '—'}</td>
                        <td style={{ padding: '12px' }}>{u.email}</td>
                        <td style={{ padding: '12px' }}>{roleLabel}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* License Tab */}
      {activeTab === 'license' && license && (
        <div>
          <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', borderRadius: '16px', padding: '24px', color: '#fff', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>✓ Aktive Lizenz</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Organisation</div>
                <div style={{ fontWeight: 700, fontSize: '18px' }}>{license.org_name || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Lizenztyp</div>
                <div style={{ fontWeight: 700, fontSize: '18px' }}>
                  {license.license_type ? license.license_type.charAt(0).toUpperCase() + license.license_type.slice(1) : 'Standard'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Max. Benutzer</div>
                <div style={{ fontWeight: 700, fontSize: '18px' }}>{license.max_users || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Aktuelle Benutzer</div>
                <div style={{ fontWeight: 700, fontSize: '18px' }}>{users.length}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Gültig bis</div>
                <div style={{ fontWeight: 700, fontSize: '18px' }}>
                  {license.license_valid_until 
                    ? new Date(license.license_valid_until).toLocaleDateString('de-DE')
                    : 'Unbegrenzt'
                  }
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Status</div>
                <div style={{ fontWeight: 700, fontSize: '18px' }}>✓ Aktiv</div>
              </div>
            </div>
          </div>
          
          <div style={{ background: '#f8f8f8', borderRadius: '12px', padding: '20px' }}>
            <strong style={{ color: '#1a1a1a' }}>📞 Support kontaktieren</strong><br/>
            <span style={{ color: '#666', fontSize: '14px' }}>
              Bei Fragen zur Lizenz kontaktieren Sie uns unter:<br/>
              <strong>support@responda.systems</strong>
            </span>
          </div>
        </div>
      )}
    </Modal>
  )
}
