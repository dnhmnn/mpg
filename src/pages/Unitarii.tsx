import React, { useState, useEffect } from 'react'
import PocketBase from 'pocketbase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import StatusBar from '../components/StatusBar'

const pb = new PocketBase('https://api.responda.systems')

interface UUser {
  id: string
  name: string
  email: string
  role?: string
  permissions?: Record<string, boolean>
  organization_id?: string
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
}

const PERM_LABELS = [
  { key: 'lernbar',            label: 'Unitas (Lernbar)' },
  { key: 'ausbildungen_manage', label: 'Ausbildungen' },
  { key: 'unitarii',           label: 'Unitarii' },
  { key: 'dashboard',          label: 'Dashboard' },
  { key: 'lager',              label: 'Lager' },
  { key: 'dateien',            label: 'Dateien' },
  { key: 'chat',               label: 'Chat' },
]

const EMPTY_PERMS = Object.fromEntries(PERM_LABELS.map(p => [p.key, false])) as Record<string, boolean>

export default function Unitarii() {
  const { user, loading: authLoading, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'benutzer' | 'neuigkeiten'>('benutzer')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const [users, setUsers] = useState<UUser[]>([])
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UUser | null>(null)
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: '', permissions: { ...EMPTY_PERMS } })
  const [savingUser, setSavingUser] = useState(false)

  const [neuigkeiten, setNeuigkeiten] = useState<Neuigkeit[]>([])
  const [showNModal, setShowNModal] = useState(false)
  const [editingN, setEditingN] = useState<Neuigkeit | null>(null)
  const [nForm, setNForm] = useState({ titel: '', inhalt: '', gepinnt: false })
  const [nAnhang, setNAnhang] = useState<File | null>(null)
  const [savingN, setSavingN] = useState(false)

  useEffect(() => { if (user) loadAll() }, [user])

  function showMsg(text: string, type: 'success' | 'error') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  async function loadAll() {
    setLoading(true)
    try {
      await Promise.all([loadUsers(), loadNeuigkeiten()])
    } finally {
      setLoading(false)
    }
  }

  async function loadUsers() {
    const r = await pb.collection('users').getFullList({
      filter: `organization_id = "${user!.organization_id}"`,
      sort: 'name',
      requestKey: `unitarii-users-${Date.now()}`
    })
    setUsers(r as any)
  }

  async function loadNeuigkeiten() {
    try {
      const r = await pb.collection('unitas_neuigkeiten').getFullList({
        sort: '-gepinnt,-created',
        requestKey: `unitarii-n-${Date.now()}`
      })
      setNeuigkeiten(r as any)
    } catch { /* collection may not exist yet */ }
  }

  function openUserModal(u?: UUser) {
    setEditingUser(u || null)
    setUserForm(u ? {
      name: u.name || '', email: u.email || '', password: '', role: u.role || '',
      permissions: { ...EMPTY_PERMS, ...u.permissions }
    } : { name: '', email: '', password: '', role: '', permissions: { ...EMPTY_PERMS } })
    setShowUserModal(true)
  }

  async function saveUser() {
    if (!userForm.name.trim() || !userForm.email.trim()) return
    if (!editingUser && !userForm.password.trim()) return
    setSavingUser(true)
    try {
      if (editingUser) {
        const data: any = { name: userForm.name, email: userForm.email, role: userForm.role, permissions: userForm.permissions }
        if (userForm.password.trim()) { data.password = userForm.password; data.passwordConfirm = userForm.password }
        await pb.collection('users').update(editingUser.id, data)
        showMsg('Benutzer aktualisiert', 'success')
      } else {
        await pb.collection('users').create({
          name: userForm.name, email: userForm.email,
          password: userForm.password, passwordConfirm: userForm.password,
          role: userForm.role, permissions: userForm.permissions,
          organization_id: user!.organization_id, emailVisibility: true
        })
        showMsg('Benutzer angelegt', 'success')
      }
      setShowUserModal(false)
      await loadUsers()
    } catch (e: any) {
      showMsg('Fehler: ' + e.message, 'error')
    } finally {
      setSavingUser(false)
    }
  }

  async function deleteUser(id: string) {
    if (!confirm('Benutzer wirklich löschen?')) return
    try {
      await pb.collection('users').delete(id)
      await loadUsers()
      showMsg('Gelöscht', 'success')
    } catch (e: any) {
      showMsg('Fehler: ' + e.message, 'error')
    }
  }

  function openNModal(n?: Neuigkeit) {
    setEditingN(n || null)
    setNForm(n ? { titel: n.titel, inhalt: n.inhalt, gepinnt: n.gepinnt } : { titel: '', inhalt: '', gepinnt: false })
    setNAnhang(null)
    setShowNModal(true)
  }

  async function saveN() {
    if (!nForm.titel.trim()) return
    setSavingN(true)
    try {
      let data: any
      if (nAnhang) {
        const fd = new FormData()
        fd.append('titel', nForm.titel); fd.append('inhalt', nForm.inhalt)
        fd.append('gepinnt', nForm.gepinnt ? 'true' : 'false')
        fd.append('erstellt_von', user?.name || user?.email || '')
        fd.append('anhang', nAnhang)
        data = fd
      } else {
        data = { titel: nForm.titel, inhalt: nForm.inhalt, gepinnt: nForm.gepinnt, erstellt_von: user?.name || user?.email || '' }
      }
      if (editingN) await pb.collection('unitas_neuigkeiten').update(editingN.id, data)
      else await pb.collection('unitas_neuigkeiten').create(data)
      setShowNModal(false)
      await loadNeuigkeiten()
      showMsg(editingN ? 'Neuigkeit aktualisiert' : 'Veröffentlicht', 'success')
    } catch (e: any) {
      showMsg('Fehler: ' + e.message, 'error')
    } finally {
      setSavingN(false)
    }
  }

  async function deleteN(id: string) {
    if (!confirm('Neuigkeit wirklich löschen?')) return
    try {
      await pb.collection('unitas_neuigkeiten').delete(id)
      await loadNeuigkeiten()
      showMsg('Gelöscht', 'success')
    } catch (e: any) {
      showMsg('Fehler: ' + e.message, 'error')
    }
  }

  if (authLoading) return null

  if (!user?.supervisor && (user as any)?.role !== 'mpg') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>Kein Zugriff</div>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Unitarii ist nur für Administratoren zugänglich.</div>
        <button onClick={() => navigate('/hub')} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'var(--btn-dark)', color: 'var(--btn-dark-text)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Zurück zum Hub</button>
      </div>
    )
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--text-secondary)' }}>Lade...</div>
    </div>
  )

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
    color: active ? 'var(--text)' : 'var(--text-secondary)',
    borderBottom: active ? '2px solid var(--btn-dark)' : '2px solid transparent',
    whiteSpace: 'nowrap'
  })

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'inherit', background: 'var(--bg-input)', color: 'var(--text)', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <StatusBar user={user} onLogout={logout} showBackButton onBackClick={() => navigate('/hub')} pageName="Unitarii" />

      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex' }}>
          <button style={tabStyle(tab === 'benutzer')} onClick={() => setTab('benutzer')}>
            Benutzer <span style={{ marginLeft: '5px', background: 'var(--btn-dark)', color: 'var(--btn-dark-text)', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }}>{users.length}</span>
          </button>
          <button style={tabStyle(tab === 'neuigkeiten')} onClick={() => setTab('neuigkeiten')}>
            Neuigkeiten {neuigkeiten.length > 0 && <span style={{ marginLeft: '5px', background: 'var(--btn-dark)', color: 'var(--btn-dark-text)', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }}>{neuigkeiten.length}</span>}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 20px' }}>

        {/* BENUTZER */}
        {tab === 'benutzer' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text)' }}>Benutzerverwaltung</h2>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Benutzer anlegen und Berechtigungen verwalten</p>
              </div>
              <button onClick={() => openUserModal()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'var(--btn-dark)', color: 'var(--btn-dark-text)', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Benutzer anlegen
              </button>
            </div>
            {users.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px 0' }}>Noch keine Benutzer</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {users.map(u => {
                  const perms = Object.entries(u.permissions || {}).filter(([, v]) => v).map(([k]) => k)
                  return (
                    <div key={u.id} style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--btn-dark), #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px', color: '#fff', flexShrink: 0 }}>
                        {(u.name || u.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>{u.name || '—'}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{u.email}</div>
                        {perms.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                            {perms.map(p => (
                              <span key={p} style={{ padding: '2px 8px', borderRadius: '10px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {PERM_LABELS.find(l => l.key === p)?.label || p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {u.role && <span style={{ padding: '3px 10px', borderRadius: '20px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>{u.role}</span>}
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => openUserModal(u)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Bearbeiten</button>
                        {u.id !== user?.id && <button onClick={() => deleteUser(u.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Löschen</button>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* NEUIGKEITEN */}
        {tab === 'neuigkeiten' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text)' }}>Neuigkeiten</h2>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Werden in Unitas für alle Benutzer angezeigt</p>
              </div>
              <button onClick={() => openNModal()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'var(--btn-dark)', color: 'var(--btn-dark-text)', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Neue Neuigkeit
              </button>
            </div>
            {neuigkeiten.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '48px 0' }}>Noch keine Neuigkeiten</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {neuigkeiten.map(n => (
                  <div key={n.id} style={{ background: 'var(--bg-card)', borderRadius: '14px', border: `1px solid ${n.gepinnt ? '#fde68a' : 'var(--border)'}`, overflow: 'hidden' }}>
                    {n.gepinnt && <div style={{ background: '#fef3c7', padding: '5px 16px', fontSize: '12px', fontWeight: 700, color: '#92400e' }}>Angeheftet</div>}
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)' }}>{n.titel}</div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => openNModal(n)} style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Bearbeiten</button>
                          <button onClick={() => deleteN(n.id)} style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Löschen</button>
                        </div>
                      </div>
                      {n.inhalt && <div style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '10px' }}>{n.inhalt}</div>}
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {n.erstellt_von && <span>{n.erstellt_von} · </span>}
                        {new Date(n.created).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* USER MODAL */}
      {showUserModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowUserModal(false)}>
          <div style={{ background: 'var(--bg-card-solid)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: '17px', color: 'var(--text)' }}>{editingUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div><label style={labelStyle}>Name *</label><input value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} placeholder="Max Mustermann" style={inputStyle} /></div>
              <div><label style={labelStyle}>E-Mail *</label><input type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} placeholder="max@example.com" style={inputStyle} /></div>
              <div><label style={labelStyle}>{editingUser ? 'Neues Passwort (leer = unverändert)' : 'Passwort *'}</label><input type="password" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" style={inputStyle} /></div>
              <div><label style={labelStyle}>Rolle (optional)</label><input value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))} placeholder="z.B. mpg, ausbildung, ..." style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Berechtigungen</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {PERM_LABELS.map(({ key, label }) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={userForm.permissions[key] || false} onChange={e => setUserForm(p => ({ ...p, permissions: { ...p.permissions, [key]: e.target.checked } }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                      <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setShowUserModal(false)} style={{ padding: '10px 18px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={saveUser} disabled={savingUser} style={{ padding: '10px 18px', borderRadius: '9px', border: 'none', background: 'var(--btn-dark)', color: 'var(--btn-dark-text)', fontWeight: 700, fontSize: '14px', cursor: savingUser ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: savingUser ? 0.6 : 1 }}>
                {savingUser ? 'Speichern...' : editingUser ? 'Speichern' : 'Anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEUIGKEIT MODAL */}
      {showNModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowNModal(false)}>
          <div style={{ background: 'var(--bg-card-solid)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: '17px', color: 'var(--text)' }}>{editingN ? 'Neuigkeit bearbeiten' : 'Neue Neuigkeit'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div><label style={labelStyle}>Titel *</label><input value={nForm.titel} onChange={e => setNForm(p => ({ ...p, titel: e.target.value }))} placeholder="Betreff / Titel" style={inputStyle} /></div>
              <div><label style={labelStyle}>Text</label><textarea value={nForm.inhalt} onChange={e => setNForm(p => ({ ...p, inhalt: e.target.value }))} rows={5} placeholder="Nachricht..." style={{ ...inputStyle, resize: 'vertical' }} /></div>
              <div><label style={labelStyle}>Anhang {editingN?.anhang && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>— aktuell: {editingN.anhang}</span>}</label><input type="file" onChange={e => setNAnhang(e.target.files?.[0] || null)} style={{ padding: '8px 0', fontFamily: 'inherit', fontSize: '14px' }} /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={nForm.gepinnt} onChange={e => setNForm(p => ({ ...p, gepinnt: e.target.checked }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>Angeheftet (wird oben angezeigt)</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => setShowNModal(false)} style={{ padding: '10px 18px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
              <button onClick={saveN} disabled={savingN || !nForm.titel.trim()} style={{ padding: '10px 18px', borderRadius: '9px', border: 'none', background: savingN || !nForm.titel.trim() ? 'var(--border)' : 'var(--btn-dark)', color: savingN || !nForm.titel.trim() ? 'var(--text-secondary)' : 'var(--btn-dark-text)', fontWeight: 700, fontSize: '14px', cursor: savingN || !nForm.titel.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {savingN ? 'Speichern...' : editingN ? 'Speichern' : 'Veröffentlichen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div style={{ position: 'fixed', bottom: '32px', right: '24px', zIndex: 9999, padding: '12px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: message.type === 'success' ? '#166534' : '#b91c1c', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          {message.text}
        </div>
      )}
    </div>
  )
}
