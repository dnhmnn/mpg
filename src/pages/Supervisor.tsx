import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import KachelGenerator from './KachelGenerator'

interface LandingContent {
  id?: string
  hero_title: string
  hero_subtitle: string
  nav_items: {label:string;href:string}[]
  audience: { title: string; description: string }[]
  features: { title: string; description: string }[]
  pricing: {name:string;price:string;period:string;features:string[];featured?:boolean;badge?:string;cta?:string}[]
  contact_email: string
  show: { features: boolean; audience: boolean; pricing: boolean; contact: boolean }
}

const DEFAULT_LANDING: LandingContent = {
  hero_title: 'Das <em>digitale Rückgrat</em><br>deiner Organisation.',
  hero_subtitle: 'Einsätze, Protokolle, Lager, Ausbildungen und mehr — sicher, schnell und von überall erreichbar.',
  audience: [
    { title: 'Freiwillige Feuerwehren', description: 'Einsatzverwaltung, Alamos-Integration, Ausbildungsplanung und digitale Dokumentation für den Ehrenamt-Alltag.' },
    { title: 'Bereitschaften & Hilfsorganisationen', description: 'BRK, DRK, ASB, MHD, JUH — Responda passt sich eurer Struktur an, nicht umgekehrt.' },
    { title: 'Werkfeuerwehren & Betriebssanitäter', description: 'MPG-Prüfungen, Lagerverwaltung und digitale Protokolle für betriebliche Sicherheitsorganisationen.' },
    { title: 'Ausbildungseinrichtungen', description: 'Lernplattform, Terminverwaltung und Nachweisführung für Schulungs- und Ausbildungszentren.' },
  ],
  features: [
    { title: 'Einsatzverwaltung', description: 'Einsätze manuell anlegen oder per Alamos-Webhook automatisch empfangen. Realtime-Übersicht für alle.' },
    { title: 'Patientenprotokolle', description: 'Lückenlose Dokumentation mit Freigabe-Workflow zwischen Teamleader und Administration.' },
    { title: 'Lagerverwaltung', description: 'Bestände überwachen, Produktausgaben erfassen und Inventur digital abwickeln.' },
    { title: 'Unitas — Lernplattform', description: 'Interne Wissensmodule, Quizze und Neuigkeiten für das gesamte Team an einem Ort.' },
    { title: 'Ausbildungsmanagement', description: 'Termine anlegen, Teilnehmer einladen und Nachweise digital verwalten.' },
    { title: 'MPG-Prüfungen', description: 'Medizinprodukte prüfen, Ergebnisse dokumentieren und Fristen im Blick behalten.' },
    { title: 'Verschlüsselter Chat', description: 'Ende-zu-Ende-verschlüsselte Kommunikation für das gesamte Team — ohne externe Dienste.' },
    { title: 'Dateiverwaltung', description: 'Zentrale Ablage für alle Organisationsdokumente, sicher und zugriffsgesteuert.' },
    { title: 'Benutzerverwaltung', description: 'Rollen, individuelle Rechte, temporäre Zugänge und Supervisor-Funktionen für Admins.' },
  ],
  contact_email: 'info@responda.systems',
  show: { features: true, audience: true, pricing: true, contact: true },
  nav_items: [
    {label:'Features', href:'#features'},
    {label:'Für wen', href:'#fuer-wen'},
    {label:'Preise', href:'#preise'},
    {label:'Kontakt', href:'#kontakt'},
  ],
  pricing: [
    {name:'Starter', price:'49', period:'pro Monat · bis 25 Nutzer', features:['Einsatzverwaltung','Patientenprotokolle','Unitas Lernplattform','Team-Chat','Dateiverwaltung'], cta:'Jetzt anfragen'},
    {name:'Team', price:'149', period:'pro Monat · bis 100 Nutzer', features:['Alles aus Starter','Lagerverwaltung','Ausbildungsmanagement','MPG-Prüfungen','Alamos-Webhook','Prioritäts-Support'], featured:true, badge:'Empfohlen', cta:'Jetzt anfragen'},
    {name:'Enterprise', price:'Auf Anfrage', period:'unbegrenzte Nutzer · individuell', features:['Alles aus Team','Mehrere Standorte','Individuelle Integrationen','Dedizierter Ansprechpartner','SLA-Vereinbarung'], cta:'Kontakt aufnehmen'},
  ],
}

interface LegalContent {
  id?: string
  impressum: string
  datenschutz: string
}

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
          background: 'var(--lbf-card)',
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
  color: 'var(--lbf-text)',
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

  const [tab, setTab] = useState<'orgs' | 'profil' | 'website' | 'legal' | 'kachel'>('orgs')

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

  // Profil tab state
  const [profilName, setProfilName] = useState('')
  const [profilEmail, setProfilEmail] = useState('')
  const [profilPhone, setProfilPhone] = useState('')
  const [profilPassword, setProfilPassword] = useState('')
  const [profilSaving, setProfilSaving] = useState(false)
  const [profilMsg, setProfilMsg] = useState('')

  // Website tab state
  const [website, setWebsite] = useState<LandingContent>({ ...DEFAULT_LANDING })
  const [websiteLoading, setWebsiteLoading] = useState(false)
  const [websiteSaving, setWebsiteSaving] = useState(false)

  // Legal tab state
  const [legal, setLegal] = useState<LegalContent>({ impressum: '', datenschutz: '' })
  const [legalLoading, setLegalLoading] = useState(false)
  const [legalSaving, setLegalSaving] = useState(false)

  useEffect(() => {
    if (!loading && user && !user.supervisor) {
      navigate('/hub')
    }
  }, [loading, user, navigate])

  useEffect(() => {
    if (!loading && user?.supervisor) {
      loadOrgs()
      if (user) {
        setProfilName(user.name || '')
        setProfilEmail(user.email || '')
        setProfilPhone((user as any).phone || '')
      }
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

  async function loadWebsite() {
    setWebsiteLoading(true)
    try {
      const list = await pb.collection('landing_content').getFullList({ sort: '-created', limit: 1 })
      if (list.length > 0) {
        const r = list[0] as any
        setWebsite({
          id: r.id,
          hero_title: r.hero_title || DEFAULT_LANDING.hero_title,
          hero_subtitle: r.hero_subtitle || DEFAULT_LANDING.hero_subtitle,
          nav_items: r.nav_items?.length ? r.nav_items : DEFAULT_LANDING.nav_items,
          audience: r.audience || DEFAULT_LANDING.audience,
          features: r.features || DEFAULT_LANDING.features,
          pricing: r.pricing?.length ? r.pricing : DEFAULT_LANDING.pricing,
          contact_email: r.contact_email || DEFAULT_LANDING.contact_email,
          show: r.show ?? DEFAULT_LANDING.show,
        })
      }
    } catch (e) { console.error(e) }
    finally { setWebsiteLoading(false) }
  }

  async function saveWebsite() {
    setWebsiteSaving(true)
    try {
      const data = {
        hero_title: website.hero_title,
        hero_subtitle: website.hero_subtitle,
        nav_items: website.nav_items,
        audience: website.audience,
        features: website.features,
        pricing: website.pricing,
        contact_email: website.contact_email,
        show: website.show,
      }
      if (website.id) {
        await pb.collection('landing_content').update(website.id, data)
      } else {
        const rec = await pb.collection('landing_content').create(data)
        setWebsite(prev => ({ ...prev, id: (rec as any).id }))
      }
      setSaveMsg('Website-Inhalt gespeichert')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (e: any) {
      setSaveMsg('Fehler: ' + e.message)
    } finally {
      setWebsiteSaving(false)
    }
  }

  function addAudience() { setWebsite(prev => ({ ...prev, audience: [...prev.audience, { title: '', description: '' }] })) }
  function removeAudience(i: number) { setWebsite(prev => ({ ...prev, audience: prev.audience.filter((_, idx) => idx !== i) })) }
  function updateAudience(i: number, field: 'title' | 'description', value: string) {
    setWebsite(prev => {
      const a = [...prev.audience]
      a[i] = { ...a[i], [field]: value }
      return { ...prev, audience: a }
    })
  }
  function updateFeature(i: number, field: 'title' | 'description', value: string) {
    setWebsite(prev => {
      const f = [...prev.features]
      f[i] = { ...f[i], [field]: value }
      return { ...prev, features: f }
    })
  }
  function addFeature() { setWebsite(prev => ({ ...prev, features: [...prev.features, { title: '', description: '' }] })) }
  function removeFeature(i: number) { setWebsite(prev => ({ ...prev, features: prev.features.filter((_, idx) => idx !== i) })) }
  function addNavItem() { setWebsite(prev => ({ ...prev, nav_items: [...prev.nav_items, { label: '', href: '' }] })) }
  function removeNavItem(i: number) { setWebsite(prev => ({ ...prev, nav_items: prev.nav_items.filter((_, idx) => idx !== i) })) }
  function updateNavItem(i: number, field: 'label'|'href', value: string) {
    setWebsite(prev => { const a = [...prev.nav_items]; a[i] = { ...a[i], [field]: value }; return { ...prev, nav_items: a } })
  }
  function addPricingTier() { setWebsite(prev => ({ ...prev, pricing: [...prev.pricing, { name: '', price: '', period: '', features: [''], cta: 'Jetzt anfragen' }] })) }
  function removePricingTier(i: number) { setWebsite(prev => ({ ...prev, pricing: prev.pricing.filter((_, idx) => idx !== i) })) }
  function updatePricingTier(i: number, field: string, value: any) {
    setWebsite(prev => { const p = [...prev.pricing]; p[i] = { ...p[i], [field]: value }; return { ...prev, pricing: p } })
  }
  function updatePricingFeatures(i: number, text: string) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    updatePricingTier(i, 'features', lines.length ? lines : [''])
  }

  async function loadLegal() {
    setLegalLoading(true)
    try {
      const list = await pb.collection('landing_content').getFullList({ sort: '-created', limit: 1 })
      if (list.length > 0) {
        const r = list[0] as any
        setLegal({ id: r.id, impressum: r.impressum || '', datenschutz: r.datenschutz || '' })
      }
    } catch (e) { console.error(e) }
    finally { setLegalLoading(false) }
  }

  async function saveLegal() {
    setLegalSaving(true)
    try {
      const list = await pb.collection('landing_content').getFullList({ sort: '-created', limit: 1 })
      const data = { impressum: legal.impressum, datenschutz: legal.datenschutz }
      if (list.length > 0) {
        await pb.collection('landing_content').update(list[0].id, data)
      } else {
        await pb.collection('landing_content').create(data)
      }
      setSaveMsg('Rechtliche Texte gespeichert')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (e: any) {
      setSaveMsg('Fehler: ' + e.message)
    } finally {
      setLegalSaving(false)
    }
  }

  async function saveProfil() {
    setProfilSaving(true)
    setProfilMsg('')
    try {
      const data: Record<string, any> = { name: profilName, email: profilEmail, phone: profilPhone }
      if (profilPassword) { data.password = profilPassword; data.passwordConfirm = profilPassword }
      await pb.collection('users').update(user!.id, data)
      setProfilPassword('')
      setProfilMsg('Profil gespeichert')
      setTimeout(() => setProfilMsg(''), 3000)
    } catch (e: any) {
      setProfilMsg('Fehler: ' + e.message)
    } finally {
      setProfilSaving(false)
    }
  }

  const filtered = orgs.filter(o => {
    const q = search.toLowerCase()
    return !q || o.org_name?.toLowerCase().includes(q) || o.org_code?.toLowerCase().includes(q)
  })

  const totalUsers = orgs.reduce((s, o) => s + o.userCount, 0)
  const activeCount = orgs.filter(o => o.is_active).length

  const inputStyle: React.CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '0.5px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', fontSize: 14, fontFamily: 'inherit', color: 'var(--lbf-text)', boxSizing: 'border-box', outline: 'none' }
  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, display: 'block' }

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
        background: 'var(--lbf-card)',
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
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)', letterSpacing: '-0.01em' }}>Supervisor</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>
              {tab === 'orgs' ? 'Organisationsverwaltung' : tab === 'profil' ? 'Mein Profil' : tab === 'website' ? 'Website-Inhalt' : tab === 'kachel' ? 'Kachel-Generator' : 'Rechtliche Texte'}
            </div>
          </div>
          <button onClick={() => navigate('/wissen')} title="Wissensbasis für den KI-Assistenten" style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 10, background: '#600812', color: '#fff', padding: '8px 13px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z"/></svg>
            Wissen
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', display: 'flex', overflowX: 'auto', paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}>
        {([
          { key: 'orgs', label: 'Organisationen' },
          { key: 'profil', label: 'Mein Profil' },
          { key: 'website', label: 'Website' },
          { key: 'legal', label: 'Rechtliches' },
          { key: 'kachel', label: 'Kachel' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key)
              if (t.key === 'website' && !website.id && !websiteLoading) loadWebsite()
              if (t.key === 'legal' && !legal.impressum && !legalLoading) loadLegal()
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 700,
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
              color: tab === t.key ? '#600812' : 'var(--warm-gray)',
              borderTop: `2px solid ${tab === t.key ? '#600812' : 'transparent'}`,
              padding: '12px 14px', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'orgs' && <div style={{
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
            <div key={stat.label} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', padding: '14px 12px' }}>
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
              background: 'var(--lbf-card)',
              border: '1px solid rgba(96,8,18,0.12)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 14,
              color: 'var(--lbf-text)',
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
                  background: 'var(--lbf-card)',
                  borderRadius: 12,
                  boxShadow: 'var(--lbf-shadow)',
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
                  <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>
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
      </div>}

      {tab === 'profil' && (
        <div style={{ padding: '20px max(20px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 40px)', maxWidth: 600, margin: '0 auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 16 }}>MEIN PROFIL</div>
          <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Name', value: profilName, setter: setProfilName, type: 'text' },
              { label: 'E-Mail', value: profilEmail, setter: setProfilEmail, type: 'email' },
              { label: 'Telefon', value: profilPhone, setter: setProfilPhone, type: 'tel' },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{f.label}</div>
                <input type={f.type} value={f.value} onChange={e => f.setter(e.target.value)}
                  style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: '0.5px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', fontSize: 14, fontFamily: 'inherit', color: 'var(--lbf-text)', boxSizing: 'border-box' as const, outline: 'none' }} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Neues Passwort <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--warm-gray)' }}>(leer = unverändert)</span></div>
              <input type="text" value={profilPassword} onChange={e => setProfilPassword(e.target.value)} placeholder="••••••••"
                style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: '0.5px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', fontSize: 14, fontFamily: 'monospace', color: 'var(--lbf-text)', boxSizing: 'border-box' as const, outline: 'none' }} />
            </div>
            {profilMsg && <div style={{ fontSize: 13, fontStyle: 'italic', color: profilMsg.startsWith('Fehler') ? '#b91c1c' : '#16a34a' }}>{profilMsg}</div>}
            <button onClick={saveProfil} disabled={profilSaving}
              style={{ background: '#600812', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: profilSaving ? 'not-allowed' : 'pointer', opacity: profilSaving ? 0.7 : 1 }}>
              {profilSaving ? 'Speichern…' : 'Profil speichern'}
            </button>
          </div>
        </div>
      )}

      {tab === 'website' && (
        <div style={{ padding: '20px max(20px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 40px)', maxWidth: 640, margin: '0 auto' }}>
          {websiteLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Laden…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

              {/* Sichtbarkeit */}
              <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', padding: '20px 24px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>ABSCHNITTE</div>
                <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginBottom: 16 }}>Abschnitte ein- oder ausblenden</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {([
                    { key: 'features', label: 'Features' },
                    { key: 'audience', label: 'Für wen' },
                    { key: 'pricing', label: 'Preise' },
                    { key: 'contact', label: 'Kontakt' },
                  ] as const).map((s, i, arr) => (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: i < arr.length - 1 ? '0.5px solid rgba(96,8,18,0.08)' : 'none' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: website.show[s.key] ? 'var(--lbf-text)' : 'var(--warm-gray)' }}>{s.label}</span>
                      <ToggleSwitch on={website.show[s.key]} onChange={() => setWebsite(p => ({ ...p, show: { ...p.show, [s.key]: !p.show[s.key] } }))} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Hero */}
              <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', padding: '20px 24px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 16 }}>HERO</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Überschrift <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--warm-gray)' }}>(HTML erlaubt: &lt;em&gt; für kursiv, &lt;br&gt; für Zeilenumbruch)</span></label>
                    <input value={website.hero_title} onChange={e => setWebsite(p => ({ ...p, hero_title: e.target.value }))} style={inputStyle} placeholder="Das <em>digitale Rückgrat</em><br>deiner Organisation." />
                  </div>
                  <div>
                    <label style={labelStyle}>Untertitel</label>
                    <textarea value={website.hero_subtitle} onChange={e => setWebsite(p => ({ ...p, hero_subtitle: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Kurze Beschreibung unter der Überschrift..." />
                  </div>
                  <div>
                    <label style={labelStyle}>Kontakt-E-Mail (im Footer + Impressum)</label>
                    <input type="email" value={website.contact_email} onChange={e => setWebsite(p => ({ ...p, contact_email: e.target.value }))} style={inputStyle} placeholder="info@responda.systems" />
                  </div>
                </div>
              </div>

              {/* Zielgruppen */}
              <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>ZIELGRUPPEN</div>
                  <button onClick={addAudience} style={{ fontSize: 12, fontWeight: 700, color: '#600812', background: 'rgba(96,8,18,0.07)', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>+ Hinzufügen</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {website.audience.map((a, i) => (
                    <div key={i} style={{ background: 'var(--warm-bg)', borderRadius: 10, padding: '14px', border: '0.5px solid rgba(96,8,18,0.1)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input value={a.title} onChange={e => updateAudience(i, 'title', e.target.value)} style={{ ...inputStyle, fontWeight: 700 }} placeholder="Titel" />
                        <textarea value={a.description} onChange={e => updateAudience(i, 'description', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Beschreibung..." />
                      </div>
                      <button onClick={() => removeAudience(i)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation */}
              <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>NAVIGATION</div>
                  <button onClick={addNavItem} style={{ fontSize: 12, fontWeight: 700, color: '#600812', background: 'rgba(96,8,18,0.07)', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>+ Hinzufügen</button>
                </div>
                <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginBottom: 12 }}>Links in der Navigationsleiste. Href: #section-id für Seitenabschnitte oder https://... für externe Links.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {website.nav_items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input value={item.label} onChange={e => updateNavItem(i, 'label', e.target.value)} style={{ ...inputStyle, width: '40%', fontWeight: 700 }} placeholder="Label z.B. Über uns" />
                      <input value={item.href} onChange={e => updateNavItem(i, 'href', e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="#ueber-uns oder https://..." />
                      <button onClick={() => removeNavItem(i)} style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>FEATURES</div>
                  <button onClick={addFeature} style={{ fontSize: 12, fontWeight: 700, color: '#600812', background: 'rgba(96,8,18,0.07)', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>+ Hinzufügen</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {website.features.map((f, i) => (
                    <div key={i} style={{ background: 'var(--warm-bg)', borderRadius: 10, padding: '12px 14px', border: '0.5px solid rgba(96,8,18,0.1)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input value={f.title} onChange={e => updateFeature(i, 'title', e.target.value)} style={{ ...inputStyle, fontWeight: 700 }} placeholder="Feature-Name" />
                        <textarea value={f.description} onChange={e => updateFeature(i, 'description', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', fontSize: 13 }} placeholder="Kurze Beschreibung..." />
                      </div>
                      <button onClick={() => removeFeature(i)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preise */}
              <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>PREISE</div>
                  <button onClick={addPricingTier} style={{ fontSize: 12, fontWeight: 700, color: '#600812', background: 'rgba(96,8,18,0.07)', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>+ Tier hinzufügen</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {website.pricing.map((tier, i) => (
                    <div key={i} style={{ background: 'var(--warm-bg)', borderRadius: 12, padding: '16px', border: `0.5px solid ${tier.featured ? '#600812' : 'rgba(96,8,18,0.1)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: tier.featured ? '#600812' : 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          {tier.name || 'Neuer Tier'}{tier.featured ? ' · EMPFOHLEN' : ''}
                        </div>
                        <button onClick={() => removePricingTier(i)} style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>× Entfernen</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={labelStyle}>Name</label>
                          <input value={tier.name} onChange={e => updatePricingTier(i, 'name', e.target.value)} style={inputStyle} placeholder="z.B. Starter" />
                        </div>
                        <div>
                          <label style={labelStyle}>Preis (Zahl oder Text)</label>
                          <input value={tier.price} onChange={e => updatePricingTier(i, 'price', e.target.value)} style={inputStyle} placeholder="49 oder Auf Anfrage" />
                        </div>
                        <div>
                          <label style={labelStyle}>Zeitraum / Nutzer</label>
                          <input value={tier.period} onChange={e => updatePricingTier(i, 'period', e.target.value)} style={inputStyle} placeholder="pro Monat · bis 25 Nutzer" />
                        </div>
                        <div>
                          <label style={labelStyle}>Button-Text</label>
                          <input value={tier.cta||''} onChange={e => updatePricingTier(i, 'cta', e.target.value)} style={inputStyle} placeholder="Jetzt anfragen" />
                        </div>
                        <div>
                          <label style={labelStyle}>Badge-Text (optional)</label>
                          <input value={tier.badge||''} onChange={e => updatePricingTier(i, 'badge', e.target.value || undefined)} style={inputStyle} placeholder="z.B. Empfohlen" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 18 }}>
                          <label style={{ ...labelStyle, marginBottom: 0 }}>Hervorgehoben</label>
                          <button
                            onClick={() => updatePricingTier(i, 'featured', !tier.featured)}
                            style={{ width: 44, height: 26, borderRadius: 13, background: tier.featured ? '#600812' : '#e5e5ea', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', padding: 0, flexShrink: 0 }}
                          >
                            <span style={{ position: 'absolute', top: 2, left: tier.featured ? 20 : 2, width: 22, height: 22, borderRadius: '50%', background: 'var(--lbf-card)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Features (eine pro Zeile)</label>
                        <textarea
                          value={tier.features.join('\n')}
                          onChange={e => updatePricingFeatures(i, e.target.value)}
                          rows={Math.max(3, tier.features.length + 1)}
                          style={{ ...inputStyle, resize: 'vertical', fontSize: 13 }}
                          placeholder={'Feature 1\nFeature 2\nFeature 3'}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {saveMsg && <div style={{ fontSize: 13, fontStyle: 'italic', color: saveMsg.startsWith('Fehler') ? '#b91c1c' : '#16a34a' }}>{saveMsg}</div>}
              <button onClick={saveWebsite} disabled={websiteSaving}
                style={{ background: '#600812', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontWeight: 700, fontSize: 15, fontFamily: 'inherit', cursor: websiteSaving ? 'not-allowed' : 'pointer', opacity: websiteSaving ? 0.7 : 1 }}>
                {websiteSaving ? 'Speichern…' : 'Änderungen speichern'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'legal' && (
        <div style={{ padding: '20px max(20px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 40px)', maxWidth: 640, margin: '0 auto' }}>
          {legalLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Laden…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', padding: '20px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>IMPRESSUM</div>
                <textarea
                  value={legal.impressum}
                  onChange={e => setLegal(p => ({ ...p, impressum: e.target.value }))}
                  rows={12}
                  placeholder="Angaben gemäß § 5 TMG..."
                  style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: '0.5px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', fontSize: 13, fontFamily: 'inherit', color: 'var(--lbf-text)', boxSizing: 'border-box', outline: 'none', resize: 'vertical' }}
                />
              </div>
              <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', padding: '20px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>DATENSCHUTZ</div>
                <textarea
                  value={legal.datenschutz}
                  onChange={e => setLegal(p => ({ ...p, datenschutz: e.target.value }))}
                  rows={12}
                  placeholder="Datenschutzerklärung gemäß DSGVO..."
                  style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: '0.5px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', fontSize: 13, fontFamily: 'inherit', color: 'var(--lbf-text)', boxSizing: 'border-box', outline: 'none', resize: 'vertical' }}
                />
              </div>
              {saveMsg && <div style={{ fontSize: 13, fontStyle: 'italic', color: saveMsg.startsWith('Fehler') ? '#b91c1c' : '#16a34a' }}>{saveMsg}</div>}
              <button onClick={saveLegal} disabled={legalSaving}
                style={{ background: '#600812', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontWeight: 700, fontSize: 15, fontFamily: 'inherit', cursor: legalSaving ? 'not-allowed' : 'pointer', opacity: legalSaving ? 0.7 : 1 }}>
                {legalSaving ? 'Speichern…' : 'Rechtliche Texte speichern'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'kachel' && <KachelGenerator />}

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
              background: 'var(--lbf-card)',
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
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--lbf-input-border)' }} />
              <button
                onClick={closeSheet}
                style={{
                  position: 'absolute',
                  right: 16,
                  top: 10,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--lbf-border-light)',
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

              <div style={{ height: '0.5px', background: 'var(--lbf-border-light)', marginBottom: 20 }} />

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
                <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', overflow: 'hidden', marginBottom: 16 }}>
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
                        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 13, color: 'var(--lbf-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                      <option value="teilnehmer">Teilnehmer (Ausbildungen)</option>
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
              background: 'var(--lbf-card)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 360,
              width: 'calc(100% - 40px)',
              margin: 20
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)', marginBottom: 20 }}>Neue Organisation</div>

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
              background: 'var(--lbf-card)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 360,
              width: 'calc(100% - 40px)',
              margin: 20
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--lbf-text)', marginBottom: 20 }}>Benutzer bearbeiten</div>

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
                <option value="teilnehmer">Teilnehmer (Ausbildungen)</option>
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
