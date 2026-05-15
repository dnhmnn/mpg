import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import type { User } from '../types'
import StatusBar from '../components/StatusBar'
import { getTheme, setTheme, type ThemeMode } from '../lib/theme'
import { ALL_APPS, getDockPins, setDockPins, MAX_DOCK_PINS } from '../lib/apps'
import AppIcon from '../components/AppIcon'

interface SettingsPageProps {
  user?: User | null
}

type View = 'main' | 'profile' | 'password' | 'appearance' | 'notifications' | 'users' | 'license'

interface NotifPrefs {
  patienten: boolean
  lager: boolean
  mpg: boolean
  ausbildungen: boolean
  produktausgabe: boolean
  email: boolean
}

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  patienten: true,
  lager: true,
  mpg: true,
  ausbildungen: true,
  produktausgabe: true,
  email: true
}

function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem('notif_prefs')
    if (raw) return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULT_NOTIF_PREFS }
}

// ─── Inline styles / design tokens ────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column' as const
  },
  contentWrapper: {
    flex: 1,
    position: 'relative' as const,
    overflow: 'hidden' as const
  },
  panel: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflowY: 'auto' as const,
    transition: 'transform 0.32s cubic-bezier(0.4,0,0.2,1)',
    willChange: 'transform' as const,
    background: '#ffffff'
  },
  mainList: {
    padding: '20px 16px 40px'
  },
  detailPanel: {
    padding: '20px 16px 40px'
  },
  // iOS-style group
  group: {
    background: '#ffffff',
    borderRadius: '12px',
    overflow: 'hidden' as const,
    border: '1px solid rgba(107,15,26,0.12)',
    marginBottom: '24px'
  },
  groupHeader: {
    fontSize: '11px',
    fontVariant: 'small-caps' as const,
    color: 'rgba(107,15,26,0.5)',
    letterSpacing: '0.06em',
    fontWeight: 600,
    marginBottom: '6px',
    paddingLeft: '4px'
  },
  item: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '14px',
    padding: '13px 16px',
    background: '#ffffff',
    border: 'none',
    borderBottom: '1px solid rgba(107,15,26,0.08)',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
    fontFamily: 'inherit'
  },
  itemLast: {
    borderBottom: 'none'
  },
  itemIcon: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    background: '#6B0F1A',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0
  },
  itemLabel: {
    flex: 1,
    fontSize: '16px',
    color: '#1c1c1e',
    fontWeight: 400
  },
  chevron: {
    width: '16px',
    height: '16px',
    color: 'rgba(107,15,26,0.35)'
  },
  // Detail header
  detailHeader: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '10px',
    marginBottom: '24px'
  },
  backBtn: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6B0F1A',
    fontSize: '16px',
    fontFamily: 'inherit',
    padding: '4px 0',
    fontWeight: 500
  },
  detailTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1c1c1e',
    flex: 1
  },
  sectionHeader: {
    fontSize: '11px',
    fontVariant: 'small-caps' as const,
    color: 'rgba(107,15,26,0.5)',
    letterSpacing: '0.06em',
    fontWeight: 600,
    marginBottom: '6px',
    paddingLeft: '4px'
  },
  card: {
    background: 'rgba(107,15,26,0.06)',
    borderRadius: '12px',
    border: '1px solid rgba(107,15,26,0.12)',
    overflow: 'hidden' as const,
    marginBottom: '20px'
  },
  // Form field
  field: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '6px',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(107,15,26,0.08)'
  },
  fieldLast: {
    borderBottom: 'none'
  },
  fieldLabel: {
    fontSize: '12px',
    color: 'rgba(107,15,26,0.5)',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em'
  },
  fieldInput: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: '16px',
    color: '#1c1c1e',
    fontFamily: 'inherit',
    padding: '2px 0'
  },
  fieldInputReadonly: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: '16px',
    color: 'rgba(107,15,26,0.4)',
    fontFamily: 'inherit',
    padding: '2px 0'
  },
  primaryBtn: {
    display: 'block' as const,
    width: '100%',
    padding: '14px',
    background: '#6B0F1A',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '16px'
  },
  msg: (ok: boolean) => ({
    fontSize: '14px',
    color: ok ? '#34c759' : '#ff3b30',
    marginTop: '10px',
    padding: '0 4px'
  })
}

// ─── Toggle Switch component ────────────────────────────────────────────────
function ToggleSwitch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: '51px',
        height: '31px',
        borderRadius: '15.5px',
        background: on ? '#34c759' : '#e5e5ea',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
        padding: 0
      }}
      aria-checked={on}
      role="switch"
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: on ? '22px' : '2px',
          width: '27px',
          height: '27px',
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
          transition: 'left 0.2s'
        }}
      />
    </button>
  )
}

// ─── Icon helpers ───────────────────────────────────────────────────────────
function IconPerson() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}
function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  )
}
function IconPeople() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function IconKey() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  )
}
function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={S.chevron}>
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}
function IconBack() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function SettingsPage({ user }: SettingsPageProps) {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('main')
  const [themeMode, setThemeMode] = useState<ThemeMode>(getTheme())
  const [dockPins, setDockPinsState] = useState<string[]>(() =>
    user ? getDockPins(user.id) : []
  )
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(loadNotifPrefs)

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

  function toggleNotif(key: keyof NotifPrefs) {
    setNotifPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem('notif_prefs', JSON.stringify(next))
      return next
    })
  }

  // Profile
  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileMsg, setProfileMsg] = useState('')

  // Password
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew1, setPwNew1] = useState('')
  const [pwNew2, setPwNew2] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  // Users
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

  // License
  const [license, setLicense] = useState<any>(null)

  const canManageUsers = user?.supervisor || user?.role === 'mpg'

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '')
      setProfilePhone(user.phone || '')
    }
  }, [user])

  useEffect(() => {
    if (view === 'users') loadUsers()
    if (view === 'license') loadLicense()
  }, [view])

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
    if (!pwCurrent) { setPwMsg('❌ Aktuelles Passwort eingeben'); return }
    if (!pwNew1 || pwNew1.length < 8) { setPwMsg('❌ Neues Passwort: mind. 8 Zeichen'); return }
    if (pwNew1 !== pwNew2) { setPwMsg('❌ Passwörter stimmen nicht überein'); return }
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
        const updateData: any = { name: userFormName, role: userFormRole }
        if (userFormPassword) {
          updateData.password = userFormPassword
          updateData.passwordConfirm = userFormPassword
        }
        await pb.collection('users').update(editingUser.id, updateData)
        setUserFormMsg('✅ Benutzer aktualisiert!')
      } else {
        const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
        await pb.collection('users').create({
          email: userFormEmail,
          name: userFormName,
          role: userFormRole,
          password: tempPassword,
          passwordConfirm: tempPassword,
          organization_id: user.organization_id
        })
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

  function handleThemeChange(mode: ThemeMode) {
    setTheme(mode)
    setThemeMode(mode)
  }

  const roleLabels: Record<string, string> = {
    mpg: 'MPG', lager: 'Lager', ausbildung: 'Ausbildung', qm: 'QM', benutzer: 'Benutzer'
  }
  const roleOptions = [
    { value: 'benutzer', label: 'Benutzer' },
    { value: 'lager', label: 'Lager' },
    { value: 'ausbildung', label: 'Ausbildung' },
    { value: 'qm', label: 'QM' },
    { value: 'mpg', label: 'MPG' }
  ]

  const isMain = view === 'main'
  const mainTransform = isMain ? 'translateX(0)' : 'translateX(-100%)'
  const detailTransform = isMain ? 'translateX(100%)' : 'translateX(0)'

  function goBack() { setView('main') }
  function goTo(v: View) { setView(v) }

  // Title for current detail view
  const viewTitles: Partial<Record<View, string>> = {
    profile: 'Profil',
    password: 'Passwort',
    appearance: 'Darstellung',
    notifications: 'Benachrichtigungen',
    users: 'Benutzer',
    license: 'Lizenz'
  }

  // ─── Render helpers ────────────────────────────────────────────────────────

  function MainListItem({
    icon,
    label,
    target,
    isLast = false
  }: {
    icon: React.ReactNode
    label: string
    target: View
    isLast?: boolean
  }) {
    return (
      <button
        style={{ ...S.item, ...(isLast ? S.itemLast : {}) }}
        onClick={() => goTo(target)}
      >
        <div style={S.itemIcon}>{icon}</div>
        <span style={S.itemLabel}>{label}</span>
        <IconChevron />
      </button>
    )
  }

  function DetailHeader({ title }: { title: string }) {
    return (
      <div style={S.detailHeader}>
        <button style={S.backBtn} onClick={goBack}>
          <IconBack />
          Zurück
        </button>
        <span style={S.detailTitle}>{title}</span>
      </div>
    )
  }

  // ─── Main list ─────────────────────────────────────────────────────────────
  const mainPanel = (
    <div style={S.mainList}>
      {/* Group 1 */}
      <div style={S.group}>
        <MainListItem icon={<IconPerson />} label="Profil" target="profile" />
        <MainListItem icon={<IconLock />} label="Passwort" target="password" isLast />
      </div>

      {/* Group 2 – Neuigkeiten */}
      <div style={S.groupHeader}>Neuigkeiten</div>
      <div style={S.group}>
        <MainListItem icon={<IconBell />} label="Benachrichtigungen" target="notifications" isLast />
      </div>

      {/* Group 3 – Darstellung */}
      <div style={S.group}>
        <MainListItem icon={<IconSun />} label="Darstellung" target="appearance" isLast />
      </div>

      {/* Group 4 – admin only */}
      {canManageUsers && (
        <div style={S.group}>
          <MainListItem icon={<IconPeople />} label="Benutzer" target="users" />
          <MainListItem icon={<IconKey />} label="Lizenz" target="license" isLast />
        </div>
      )}
    </div>
  )

  // ─── Detail panels ─────────────────────────────────────────────────────────

  // Profile
  const profilePanel = (
    <div style={S.detailPanel}>
      <DetailHeader title="Profil" />
      <div style={S.sectionHeader}>PROFIL</div>
      <div style={S.card}>
        <div style={S.field}>
          <div style={S.fieldLabel}>E-Mail</div>
          <input
            type="email"
            value={user?.email || ''}
            readOnly
            style={{ ...S.fieldInputReadonly, width: '100%' }}
          />
        </div>
        <div style={S.field}>
          <div style={S.fieldLabel}>Name</div>
          <input
            type="text"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Dein Name"
            style={{ ...S.fieldInput, width: '100%' }}
          />
        </div>
        <div style={{ ...S.field, ...S.fieldLast }}>
          <div style={S.fieldLabel}>Telefon</div>
          <input
            type="tel"
            value={profilePhone}
            onChange={(e) => setProfilePhone(e.target.value)}
            placeholder="+49 123 456789"
            style={{ ...S.fieldInput, width: '100%' }}
          />
        </div>
      </div>
      {profileMsg && (
        <div style={S.msg(profileMsg.includes('✅'))}>{profileMsg}</div>
      )}
      <button style={S.primaryBtn} onClick={saveProfile}>Profil speichern</button>
    </div>
  )

  // Password
  const passwordPanel = (
    <div style={S.detailPanel}>
      <DetailHeader title="Passwort" />
      <div style={S.sectionHeader}>PASSWORT ÄNDERN</div>
      <div style={S.card}>
        <div style={S.field}>
          <div style={S.fieldLabel}>Aktuelles Passwort</div>
          <input
            type="password"
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
            placeholder="••••••••"
            style={{ ...S.fieldInput, width: '100%' }}
          />
        </div>
        <div style={S.field}>
          <div style={S.fieldLabel}>Neues Passwort</div>
          <input
            type="password"
            value={pwNew1}
            onChange={(e) => setPwNew1(e.target.value)}
            placeholder="Min. 8 Zeichen"
            style={{ ...S.fieldInput, width: '100%' }}
          />
        </div>
        <div style={{ ...S.field, ...S.fieldLast }}>
          <div style={S.fieldLabel}>Bestätigen</div>
          <input
            type="password"
            value={pwNew2}
            onChange={(e) => setPwNew2(e.target.value)}
            placeholder="Wiederholen"
            style={{ ...S.fieldInput, width: '100%' }}
          />
        </div>
      </div>
      {pwMsg && (
        <div style={S.msg(pwMsg.includes('✅'))}>{pwMsg}</div>
      )}
      <button style={S.primaryBtn} onClick={changePassword}>Passwort ändern</button>
    </div>
  )

  // Notifications
  const notifItems: { key: keyof NotifPrefs; label: string }[] = [
    { key: 'patienten', label: 'Offene Patientenprotokolle' },
    { key: 'lager', label: 'Ablaufende Lagerartikel' },
    { key: 'mpg', label: 'MPG-Geräteprüfungen' },
    { key: 'ausbildungen', label: 'Ausbildungs-Rückmeldungen' },
    { key: 'produktausgabe', label: 'Offene Produktausgaben' }
  ]

  const notificationsPanel = (
    <div style={S.detailPanel}>
      <DetailHeader title="Benachrichtigungen" />
      <div style={S.sectionHeader}>HINWEISE</div>
      <div style={S.card}>
        {notifItems.map((item, idx) => {
          const isLast = idx === notifItems.length - 1
          return (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '13px 16px',
                borderBottom: isLast ? 'none' : '1px solid rgba(107,15,26,0.08)',
                gap: '12px'
              }}
            >
              <span style={{ flex: 1, fontSize: '16px', color: '#1c1c1e' }}>{item.label}</span>
              <ToggleSwitch on={notifPrefs[item.key]} onChange={() => toggleNotif(item.key)} />
            </div>
          )
        })}
      </div>

      <div style={{ ...S.sectionHeader, marginTop: '8px' }}>E-MAIL</div>
      <div style={{ fontSize: '12px', color: 'rgba(107,15,26,0.5)', marginBottom: '8px', paddingLeft: '4px' }}>
        Erhalte eine E-Mail wenn neue Hinweise vorliegen
      </div>
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', gap: '12px' }}>
          <span style={{ flex: 1, fontSize: '16px', color: '#1c1c1e' }}>Per E-Mail benachrichtigen</span>
          <ToggleSwitch on={notifPrefs.email} onChange={() => toggleNotif('email')} />
        </div>
      </div>
    </div>
  )

  // Appearance
  const appearancePanel = (
    <div style={S.detailPanel}>
      <DetailHeader title="Darstellung" />
      <div style={S.sectionHeader}>DARSTELLUNG</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
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
              border: themeMode === opt.value
                ? '2px solid #6B0F1A'
                : '1.5px solid rgba(107,15,26,0.12)',
              background: themeMode === opt.value ? 'rgba(107,15,26,0.06)' : '#ffffff',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              width: '100%'
            }}
          >
            <span style={{ fontSize: '22px', lineHeight: 1 }}>{opt.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '15px', color: '#1c1c1e' }}>{opt.label}</div>
              <div style={{ fontSize: '12px', color: 'rgba(107,15,26,0.5)', marginTop: '2px' }}>{opt.desc}</div>
            </div>
            {themeMode === opt.value && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B0F1A" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </button>
        ))}
      </div>

      <div style={{ ...S.sectionHeader, marginTop: '4px' }}>DOCK</div>
      <div style={{ fontSize: '12px', color: 'rgba(107,15,26,0.5)', marginBottom: '12px', paddingLeft: '4px' }}>
        Wähle bis zu {MAX_DOCK_PINS} Apps für das Dock.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '10px' }}>
        {Object.values(ALL_APPS).filter(a => a.id !== 'settings').map(app => {
          const pinned = dockPins.includes(app.id)
          const blocked = !pinned && dockPins.length >= MAX_DOCK_PINS
          const colorMatch = app.color?.match(/#[0-9a-fA-F]{6}/)?.[0] || '#6B0F1A'
          return (
            <button
              key={app.id}
              onClick={() => toggleDockPin(app.id)}
              disabled={blocked}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                padding: '10px 6px', borderRadius: '14px', border: 'none', cursor: blocked ? 'not-allowed' : 'pointer',
                background: pinned ? 'rgba(107,15,26,0.06)' : 'transparent',
                outline: pinned ? '2px solid #6B0F1A' : '1.5px solid rgba(107,15,26,0.12)',
                outlineOffset: '-1.5px',
                opacity: blocked ? 0.35 : 1,
                transition: 'all 0.15s', fontFamily: 'inherit',
                position: 'relative'
              }}
            >
              <div style={{
                width: '46px', height: '46px', borderRadius: '12px',
                background: pinned ? app.color || '#6B0F1A' : 'rgba(107,15,26,0.06)',
                color: pinned ? '#fff' : colorMatch,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)', transition: 'all 0.15s'
              }}>
                <AppIcon icon={app.icon} />
              </div>
              <span style={{ fontSize: '10px', color: '#1c1c1e', fontWeight: pinned ? 600 : 400, textAlign: 'center', lineHeight: 1.2 }}>
                {app.name}
              </span>
              {pinned && (
                <div style={{
                  position: 'absolute', top: '4px', right: '4px',
                  width: '14px', height: '14px', borderRadius: '50%',
                  background: '#6B0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: '12px', fontSize: '12px', color: 'rgba(107,15,26,0.5)', textAlign: 'center' }}>
        {dockPins.length} / {MAX_DOCK_PINS} gepinnt
      </div>
    </div>
  )

  // Users
  const usersPanel = (
    <div style={S.detailPanel}>
      <DetailHeader title="Benutzer" />
      <div style={{ ...S.sectionHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>BENUTZER</span>
        {canManageUsers && (
          <button
            onClick={openAddUser}
            style={{
              background: '#6B0F1A', border: 'none', borderRadius: '8px',
              padding: '6px 12px', color: '#fff', fontSize: '13px',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            + Hinzufügen
          </button>
        )}
      </div>
      <div style={S.card}>
        {loadingUsers ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(107,15,26,0.4)' }}>
            Lade Benutzer...
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(107,15,26,0.4)' }}>
            Keine Benutzer gefunden
          </div>
        ) : (
          users.map((u, idx) => (
            <div
              key={u.id}
              className="user-row"
              style={{ borderBottom: idx === users.length - 1 ? 'none' : '1px solid rgba(107,15,26,0.08)' }}
            >
              <div className="user-avatar">{(u.name || u.email)[0].toUpperCase()}</div>
              <div className="user-info">
                <div className="user-name">{u.name || '—'}</div>
                <div className="user-email">{u.email}</div>
              </div>
              <div className="user-role">{roleLabels[u.role] || 'Benutzer'}</div>
              {canManageUsers && u.id !== user?.id && (
                <div className="user-actions">
                  <button onClick={() => openEditUser(u)} className="user-action-btn edit" title="Bearbeiten">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button onClick={() => deleteUser(u.id)} className="user-action-btn delete" title="Löschen">
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
  )

  // License
  const licensePanel = (
    <div style={S.detailPanel}>
      <DetailHeader title="Lizenz" />
      <div style={S.sectionHeader}>LIZENZ</div>
      {license && (
        <>
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
            <div className="support-text">Bei Fragen zur Lizenz kontaktieren Sie uns unter:</div>
            <div className="support-email">support@responda.systems</div>
          </div>
        </>
      )}
    </div>
  )

  // Which detail panel to render
  const detailContent = (() => {
    switch (view) {
      case 'profile':       return profilePanel
      case 'password':      return passwordPanel
      case 'notifications': return notificationsPanel
      case 'appearance':    return appearancePanel
      case 'users':         return usersPanel
      case 'license':       return licensePanel
      default:              return null
    }
  })()

  return (
    <div style={S.page}>
      <StatusBar
        user={user}
        onLogout={() => {
          pb.authStore.clear()
          localStorage.clear()
          navigate('/login')
        }}
        showBackButton={true}
        onBackClick={() => {
          if (view !== 'main') {
            goBack()
          } else {
            navigate('/hub')
          }
        }}
        pageName={view !== 'main' ? viewTitles[view] : 'Einstellungen'}
      />

      <div style={S.contentWrapper}>
        {/* Main list panel */}
        <div
          style={{
            ...S.panel,
            transform: mainTransform
          }}
        >
          {mainPanel}
        </div>

        {/* Detail panel */}
        <div
          style={{
            ...S.panel,
            transform: detailTransform
          }}
        >
          {detailContent}
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
                  style={{
                    width: '100%', padding: '12px 14px',
                    background: 'var(--bg-input)',
                    border: '0.5px solid var(--border-medium)',
                    borderRadius: '10px', color: 'var(--text)',
                    fontSize: '16px', outline: 'none',
                    appearance: 'none', cursor: 'pointer', fontFamily: 'inherit'
                  }}
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
