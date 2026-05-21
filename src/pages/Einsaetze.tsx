import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Einsatz {
  id: string
  einsatz_nr: string
  stichwort?: string
  adresse?: string
  datum: string
  status: 'aktiv' | 'abgeschlossen' | 'abgebrochen'
  interne_vermerke?: string
  karte_geojson?: string
  organization_id: string
  alamos_id?: string
  created: string
}

interface EinsatzPerson {
  id: string
  einsatz_id: string
  user_id: string
  rolle?: string
  expand?: { user_id?: { id: string; name: string; email?: string } }
}

interface OrgUser { id: string; name: string; email: string }
interface Patient  { id: string; status: string; payload: any; created: string }
interface Output   { id: string; title?: string; status: string; payload: any; created: string }

type DetailTab = 'uebersicht' | 'personal' | 'protokolle' | 'lager' | 'karte'

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseDateTime(str?: string | null): Date {
  if (!str) return new Date(NaN)
  let s = str.trim().replace(' ', 'T')
  if (!s.endsWith('Z') && !s.includes('+') && !/[+-]\d{2}:\d{2}$/.test(s)) s += 'Z'
  return new Date(s)
}
function fmtDate(str?: string | null): string {
  const d = parseDateTime(str)
  if (isNaN(d.getTime())) return '–'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtTime(str?: string | null): string {
  const d = parseDateTime(str)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}
function nowLocalISO(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function safeJson(v: any): any {
  if (!v || typeof v !== 'string') return v || {}
  try { return JSON.parse(v) } catch { return {} }
}

// ── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; strip: string }> = {
  aktiv:         { label: 'Aktiv',         color: '#600812',              bg: 'rgba(96,8,18,0.08)',   strip: '#600812' },
  abgeschlossen: { label: 'Abgeschlossen', color: '#16a34a',              bg: '#dcfce7',              strip: '#16a34a' },
  abgebrochen:   { label: 'Abgebrochen',   color: '#8a7a68',              bg: 'rgba(139,113,90,0.1)', strip: 'rgba(139,113,90,0.4)' },
}

const ROLLEN = [
  'Teamführer', 'Notfallsanitäter', 'Rettungsassistent', 'Rettungssanitäter',
  'Fahrzeugführer', 'Fahrer', 'M1', 'M2', 'Melder', 'Sonstiges',
]

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'uebersicht',  label: 'Info' },
  { id: 'personal',    label: 'Personal' },
  { id: 'protokolle',  label: 'Protokolle' },
  { id: 'lager',       label: 'Lager' },
  { id: 'karte',       label: 'Karte' },
]

// ── Style constants ───────────────────────────────────────────────────────────
const INPUT: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid rgba(96,8,18,0.15)', background: '#faf9f7',
  fontSize: 14, color: '#1a0e08', fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
}
const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#600812',
  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
}
const BTN_PRIMARY: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 8, border: 'none',
  background: '#600812', color: '#fff', fontWeight: 700, fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit',
}
const BTN_SECONDARY: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 8,
  border: '1px solid rgba(96,8,18,0.2)', background: 'transparent',
  color: '#8a7a68', fontWeight: 600, fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit',
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Einsaetze() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [einsaetze, setEinsaetze]           = useState<Einsatz[]>([])
  const [loading, setLoading]               = useState(true)
  const [message, setMessage]               = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Detail sheet
  const [selected, setSelected]             = useState<Einsatz | null>(null)
  const [detailTab, setDetailTab]           = useState<DetailTab>('uebersicht')
  const [personen, setPersonen]             = useState<EinsatzPerson[]>([])
  const [linkedPatients, setLinkedPatients] = useState<Patient[]>([])
  const [linkedOutputs, setLinkedOutputs]   = useState<Output[]>([])
  const [detailLoading, setDetailLoading]   = useState(false)

  // Übersicht edit
  const [editing, setEditing]               = useState(false)
  const [editForm, setEditForm]             = useState<{ stichwort: string; adresse: string; interne_vermerke: string }>({ stichwort: '', adresse: '', interne_vermerke: '' })
  const [saving, setSaving]                 = useState(false)

  // Personal
  const [allUsers, setAllUsers]             = useState<OrgUser[]>([])
  const [userSearch, setUserSearch]         = useState('')
  const [selectedUser, setSelectedUser]     = useState<OrgUser | null>(null)
  const [addRolle, setAddRolle]             = useState('')

  // New modal
  const [newModal, setNewModal]             = useState(false)
  const [newForm, setNewForm]               = useState({ einsatz_nr: '', stichwort: '', adresse: '', datum: nowLocalISO() })

  // Map refs
  const mapDivRef   = useRef<HTMLDivElement>(null)
  const mapRef      = useRef<any>(null)

  // ── Helpers ──────────────────────────────────────────────────────────────
  function showMsg(text: string, type: 'success' | 'error' | 'info' = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  // ── Load functions ────────────────────────────────────────────────────────
  async function loadEinsaetze() {
    if (!user?.organization_id) return
    try {
      const list = await pb.collection('einsaetze').getFullList({
        filter: `organization_id = "${user.organization_id}"`,
        sort: '-datum',
        requestKey: `e-list-${Date.now()}`,
      })
      setEinsaetze(list as any)
    } catch (e: any) { console.error(e) }
    finally { setLoading(false) }
  }

  async function loadUsers() {
    if (!user?.organization_id) return
    try {
      const list = await pb.collection('users').getFullList({
        filter: `organization_id = "${user.organization_id}"`,
        requestKey: `e-users-${Date.now()}`,
      })
      setAllUsers(list as any)
    } catch { /* non-critical */ }
  }

  async function loadDetail(e: Einsatz) {
    setDetailLoading(true)
    try {
      const [persList, allPat, allOut] = await Promise.all([
        pb.collection('einsatz_personen').getFullList({
          filter: `einsatz_id = "${e.id}"`,
          expand: 'user_id',
          requestKey: `ep-${Date.now()}`,
        }),
        pb.collection('patients').getFullList({
          filter: `organization_id = "${user!.organization_id}"`,
          requestKey: `ep-pat-${Date.now()}`,
        }),
        pb.collection('product_outputs').getFullList({
          filter: `organization_id = "${user!.organization_id}"`,
          requestKey: `ep-out-${Date.now()}`,
        }),
      ])
      setPersonen(persList as any)
      setLinkedPatients((allPat as any[]).filter((p: any) => safeJson(p.payload)?.einsatz_nr === e.einsatz_nr))
      setLinkedOutputs((allOut as any[]).filter((o: any) => safeJson(o.payload)?.einsatz === e.einsatz_nr))
    } catch (err) { console.error(err) }
    finally { setDetailLoading(false) }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    loadEinsaetze()
    loadUsers()
    pb.collection('einsaetze').subscribe('*', (ev) => {
      if (ev.action === 'create' && ev.record.organization_id === user.organization_id) {
        showMsg(`Neuer Alarm: ${ev.record.stichwort || ev.record.einsatz_nr || 'Einsatz'}`, 'info')
      }
      loadEinsaetze()
    })
    return () => { pb.collection('einsaetze').unsubscribe('*') }
  }, [user])

  // Cleanup map on unmount
  useEffect(() => () => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
  }, [])

  // Init map when Karte tab is shown
  useEffect(() => {
    if (detailTab !== 'karte' || !selected) return
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    // Small delay to ensure div is mounted
    const t = setTimeout(() => initLeafletMap(selected), 100)
    return () => clearTimeout(t)
  }, [detailTab, selected?.id])

  // ── Map ───────────────────────────────────────────────────────────────────
  function initLeafletMap(e: Einsatz) {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    if (!(window as any).L) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => createMap(e)
      document.head.appendChild(script)
    } else {
      createMap(e)
    }
  }

  function createMap(e: Einsatz) {
    if (!mapDivRef.current) return
    const L = (window as any).L

    const map = L.map(mapDivRef.current, { zoomControl: true }).setView([48.15, 11.57], 11)

    // BayernAtlas WMS as primary layer
    L.tileLayer.wms('https://geoservices.bayern.de/wms/v2/ogc_bay_dk.cgi', {
      layers: 'by_dk', format: 'image/png', transparent: false,
      attribution: '© Bayerische Vermessungsverwaltung',
    }).addTo(map)

    // Fallback OSM tiles
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', opacity: 0,
    }).addTo(map)
    osm.setOpacity(0) // OSM available but invisible under BayernAtlas

    // Load saved GeoJSON
    if (e.karte_geojson) {
      try { L.geoJSON(JSON.parse(e.karte_geojson)).addTo(map) } catch {}
    }

    // Geocode address and add marker
    if (e.adresse) {
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(e.adresse + ', Bayern, Deutschland')}&format=json&limit=1`, {
        headers: { 'User-Agent': 'Responda/1.0' },
      })
        .then(r => r.json())
        .then(res => {
          if (res?.[0]) {
            const { lat, lon } = res[0]
            L.marker([parseFloat(lat), parseFloat(lon)])
              .addTo(map)
              .bindPopup(`<b>${e.stichwort || e.einsatz_nr}</b><br>${e.adresse}`)
              .openPopup()
            map.setView([parseFloat(lat), parseFloat(lon)], 15)
          }
        })
        .catch(() => {})
    }

    mapRef.current = map
  }

  async function saveMap() {
    if (!mapRef.current || !selected) return
    const features: any[] = []
    mapRef.current.eachLayer((layer: any) => {
      if (typeof layer.toGeoJSON === 'function') {
        try { features.push(layer.toGeoJSON()) } catch {}
      }
    })
    const geojson = JSON.stringify({ type: 'FeatureCollection', features })
    try {
      await pb.collection('einsaetze').update(selected.id, { karte_geojson: geojson })
      showMsg('Karte gespeichert', 'success')
      setSelected(prev => prev ? { ...prev, karte_geojson: geojson } : prev)
      setEinsaetze(prev => prev.map(e => e.id === selected.id ? { ...e, karte_geojson: geojson } : e))
    } catch { showMsg('Fehler beim Speichern', 'error') }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function createEinsatz() {
    if (!user || !newForm.stichwort.trim()) return
    setSaving(true)
    try {
      const nr = newForm.einsatz_nr.trim() ||
        `E-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`
      await pb.collection('einsaetze').create({
        einsatz_nr: nr,
        stichwort: newForm.stichwort.trim(),
        adresse: newForm.adresse.trim(),
        datum: new Date(newForm.datum).toISOString(),
        status: 'aktiv',
        organization_id: user.organization_id,
        created_by: user.id,
      })
      showMsg('Einsatz angelegt', 'success')
      setNewModal(false)
      setNewForm({ einsatz_nr: '', stichwort: '', adresse: '', datum: nowLocalISO() })
    } catch (e: any) { showMsg('Fehler: ' + e.message, 'error') }
    finally { setSaving(false) }
  }

  async function updateStatus(id: string, status: Einsatz['status']) {
    try {
      await pb.collection('einsaetze').update(id, { status })
      setEinsaetze(prev => prev.map(e => e.id === id ? { ...e, status } : e))
      setSelected(prev => prev?.id === id ? { ...prev, status } : prev)
      showMsg(status === 'abgeschlossen' ? 'Einsatz abgeschlossen' : 'Status aktualisiert', 'success')
    } catch { showMsg('Fehler', 'error') }
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    try {
      await pb.collection('einsaetze').update(selected.id, editForm)
      const updated = { ...selected, ...editForm } as Einsatz
      setSelected(updated)
      setEinsaetze(prev => prev.map(e => e.id === updated.id ? updated : e))
      setEditing(false)
      showMsg('Gespeichert', 'success')
    } catch { showMsg('Fehler', 'error') }
    finally { setSaving(false) }
  }

  async function addPerson() {
    if (!selected || !selectedUser) return
    if (personen.find(p => p.user_id === selectedUser.id)) {
      showMsg('Person bereits zugeordnet', 'error'); return
    }
    try {
      await pb.collection('einsatz_personen').create({
        einsatz_id: selected.id,
        user_id: selectedUser.id,
        rolle: addRolle.trim() || null,
      })
      showMsg('Person hinzugefügt', 'success')
      setSelectedUser(null); setAddRolle(''); setUserSearch('')
      loadDetail(selected)
    } catch { showMsg('Fehler', 'error') }
  }

  async function removePerson(personId: string) {
    try {
      await pb.collection('einsatz_personen').delete(personId)
      setPersonen(prev => prev.filter(p => p.id !== personId))
    } catch { showMsg('Fehler', 'error') }
  }

  // ── Open detail ───────────────────────────────────────────────────────────
  function openDetail(e: Einsatz) {
    setSelected(e)
    setDetailTab('uebersicht')
    setEditing(false)
    setEditForm({ stichwort: e.stichwort || '', adresse: e.adresse || '', interne_vermerke: e.interne_vermerke || '' })
    loadDetail(e)
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Atkinson Hyperlegible', Inter, -apple-system, sans-serif" }}>
        <div style={{ color: 'var(--warm-gray)', fontSize: 15, fontStyle: 'italic' }}>Lade…</div>
      </div>
    )
  }

  const aktive    = einsaetze.filter(e => e.status === 'aktiv')
  const vergangen = einsaetze.filter(e => e.status !== 'aktiv')
  const filteredUsers = userSearch.trim()
    ? allUsers.filter(u =>
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()))
    : []

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', Inter, -apple-system, sans-serif" }}>

      {/* ── Masthead ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', borderBottom: '0.5px solid rgba(96,8,18,0.12)', paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, padding: '0 20px' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#600812', display: 'flex', alignItems: 'center', fontFamily: 'inherit', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ flex: 1, textAlign: 'center', padding: '0 12px' }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: '#1a0e08', lineHeight: 1.2 }}>Einsätze</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>
              {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <button onClick={() => setNewModal(true)} style={{ background: '#600812', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 48px' }}>

        {einsaetze.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--warm-gray)', padding: '80px 16px', fontStyle: 'italic', fontSize: 15 }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="rgba(96,8,18,0.2)" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 16px' }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.61 4.87 2 2 0 0 1 3.6 2.69h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.06a16 16 0 0 0 6 6z"/></svg>
            Noch keine Einsätze vorhanden
          </div>
        )}

        {aktive.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10, paddingLeft: 2 }}>Aktive Einsätze</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {aktive.map(e => <EinsatzCard key={e.id} einsatz={e} onClick={() => openDetail(e)} />)}
            </div>
          </div>
        )}

        {vergangen.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10, paddingLeft: 2 }}>Vergangen</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {vergangen.map(e => <EinsatzCard key={e.id} einsatz={e} onClick={() => openDetail(e)} />)}
            </div>
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {message && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, padding: '12px 20px', borderRadius: 12, fontSize: 14,
          fontWeight: 600, whiteSpace: 'nowrap',
          background: message.type === 'info' ? '#3d0408' : message.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: message.type === 'info' ? 'none' : message.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca',
          color: message.type === 'info' ? '#fde8d8' : message.type === 'success' ? '#166534' : '#b91c1c',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          {message.text}
        </div>
      )}

      {/* ── New Einsatz Modal ── */}
      {newModal && (
        <>
          <div onClick={() => setNewModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.5)', zIndex: 500 }} />
          <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 501, background: '#fff', borderRadius: 20, padding: '28px 24px', width: 'min(480px, calc(100vw - 40px))', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#1a0e08', marginBottom: 20 }}>Neuer Einsatz</div>

            {/* Alamos Webhook Info */}
            <div style={{ background: 'rgba(96,8,18,0.04)', border: '1px solid rgba(96,8,18,0.12)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
              <div style={{ ...LABEL, marginBottom: 6 }}>Alamos Webhook</div>
              <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic', lineHeight: 1.7, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                POST https://api.responda.systems/api/collections/einsaetze/records<br />
                Authorization: Bearer &lt;Admin-Token&gt;<br />
                {"{ \"organization_id\": \""}{user?.organization_id || '…'}{"\" }"}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={LABEL}>Stichwort *</div>
                <input value={newForm.stichwort} onChange={e => setNewForm(f => ({ ...f, stichwort: e.target.value }))} placeholder="z.B. RD B3, Brand Wohnung" style={INPUT} />
              </div>
              <div>
                <div style={LABEL}>Einsatznummer</div>
                <input value={newForm.einsatz_nr} onChange={e => setNewForm(f => ({ ...f, einsatz_nr: e.target.value }))} placeholder="Wird automatisch generiert wenn leer" style={INPUT} />
              </div>
              <div>
                <div style={LABEL}>Adresse</div>
                <input value={newForm.adresse} onChange={e => setNewForm(f => ({ ...f, adresse: e.target.value }))} placeholder="Musterstraße 1, 80331 München" style={INPUT} />
              </div>
              <div>
                <div style={LABEL}>Alarmzeit *</div>
                <input type="datetime-local" value={newForm.datum} onChange={e => setNewForm(f => ({ ...f, datum: e.target.value }))} style={INPUT} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={() => setNewModal(false)} style={{ ...BTN_SECONDARY, flex: 1 }}>Abbrechen</button>
              <button onClick={createEinsatz} disabled={saving || !newForm.stichwort.trim()} style={{ ...BTN_PRIMARY, flex: 2, opacity: saving || !newForm.stichwort.trim() ? 0.5 : 1 }}>
                {saving ? 'Speichern…' : 'Anlegen'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Detail Bottom Sheet ── */}
      {selected && (
        <>
          <div onClick={() => { setSelected(null); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }} style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.5)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: '#fff', borderRadius: '22px 22px 0 0', maxHeight: '92dvh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)' }}>

            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(96,8,18,0.2)' }} />
            </div>

            {/* Sheet header */}
            <div style={{ padding: '4px 20px 12px', borderBottom: '0.5px solid rgba(96,8,18,0.1)', display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17, color: '#1a0e08', lineHeight: 1.25 }}>
                  {selected.stichwort || selected.einsatz_nr || 'Einsatz'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 3 }}>
                  {fmtDate(selected.datum)}{fmtTime(selected.datum) ? ` · ${fmtTime(selected.datum)} Uhr` : ''} · Nr: {selected.einsatz_nr}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {(() => {
                  const cfg = STATUS_CFG[selected.status]
                  return (
                    <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: cfg?.bg, color: cfg?.color }}>
                      {cfg?.label}
                    </span>
                  )
                })()}
                <button onClick={() => { setSelected(null); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }} style={{ background: 'rgba(96,8,18,0.06)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--warm-gray)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(96,8,18,0.08)', flexShrink: 0 }}>
              {DETAIL_TABS.map(({ id, label }) => (
                <button key={id} onClick={() => setDetailTab(id)} style={{
                  flex: 1, padding: '10px 4px', border: 'none', background: 'none',
                  cursor: 'pointer', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.07em', fontFamily: 'inherit',
                  color: detailTab === id ? '#600812' : 'var(--warm-gray)',
                  borderBottom: detailTab === id ? '2px solid #600812' : '2px solid transparent',
                }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: detailTab === 'karte' ? 0 : '18px 20px 8px' }}>

              {/* ── ÜBERSICHT ── */}
              {detailTab === 'uebersicht' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 12 }}>
                  {editing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <div style={LABEL}>Stichwort</div>
                        <input value={editForm.stichwort} onChange={e => setEditForm(f => ({ ...f, stichwort: e.target.value }))} style={INPUT} />
                      </div>
                      <div>
                        <div style={LABEL}>Adresse</div>
                        <input value={editForm.adresse} onChange={e => setEditForm(f => ({ ...f, adresse: e.target.value }))} style={INPUT} />
                      </div>
                      <div>
                        <div style={LABEL}>Interne Vermerke</div>
                        <textarea value={editForm.interne_vermerke} onChange={e => setEditForm(f => ({ ...f, interne_vermerke: e.target.value }))} rows={4} style={{ ...INPUT, resize: 'vertical' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setEditing(false)} style={BTN_SECONDARY}>Abbrechen</button>
                        <button onClick={saveEdit} disabled={saving} style={{ ...BTN_PRIMARY, flex: 2, opacity: saving ? 0.6 : 1 }}>
                          {saving ? 'Speichern…' : 'Speichern'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <InfoField label="Stichwort" value={selected.stichwort} italic />
                        <InfoField label="Einsatz-Nr." value={selected.einsatz_nr} />
                        <InfoField label="Datum" value={fmtDate(selected.datum)} italic />
                        <InfoField label="Alarmzeit" value={fmtTime(selected.datum) ? fmtTime(selected.datum) + ' Uhr' : undefined} italic />
                        <InfoField label="Adresse" value={selected.adresse} italic span />
                      </div>

                      {selected.interne_vermerke && (
                        <div>
                          <div style={LABEL}>Interne Vermerke</div>
                          <div style={{ fontSize: 14, color: '#1a0e08', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: 'rgba(250,249,247,0.8)', borderRadius: 10, padding: '12px 14px', border: '0.5px solid rgba(96,8,18,0.08)' }}>
                            {selected.interne_vermerke}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => { setEditing(true) }} style={BTN_SECONDARY}>Bearbeiten</button>
                        {selected.status === 'aktiv' && (
                          <button onClick={() => updateStatus(selected.id, 'abgeschlossen')} style={{ ...BTN_PRIMARY, background: '#16a34a' }}>Abschließen</button>
                        )}
                        {selected.status === 'aktiv' && (
                          <button onClick={() => updateStatus(selected.id, 'abgebrochen')} style={BTN_SECONDARY}>Abbrechen</button>
                        )}
                        {selected.status !== 'aktiv' && (
                          <button onClick={() => updateStatus(selected.id, 'aktiv')} style={BTN_SECONDARY}>Reaktivieren</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── PERSONAL ── */}
              {detailTab === 'personal' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 12 }}>
                  {/* Add person */}
                  <div style={{ background: 'rgba(250,249,247,0.8)', border: '0.5px solid rgba(96,8,18,0.08)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ ...LABEL, marginBottom: 12 }}>Person hinzufügen</div>
                    <div style={{ position: 'relative', marginBottom: 10 }}>
                      <input
                        value={userSearch}
                        onChange={e => { setUserSearch(e.target.value); setSelectedUser(null) }}
                        placeholder="Name suchen…"
                        style={INPUT}
                      />
                      {filteredUsers.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid rgba(96,8,18,0.12)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 180, overflowY: 'auto' }}>
                          {filteredUsers.map(u => (
                            <button key={u.id} onClick={() => { setSelectedUser(u); setUserSearch(u.name) }} style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '0.5px solid rgba(96,8,18,0.06)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#1a0e08' }}>
                              {u.name} <span style={{ color: 'var(--warm-gray)', fontSize: 12 }}>{u.email}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select value={addRolle} onChange={e => setAddRolle(e.target.value)} style={{ ...INPUT, flex: 1 }}>
                        <option value="">Rolle (optional)</option>
                        {ROLLEN.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button onClick={addPerson} disabled={!selectedUser} style={{ ...BTN_PRIMARY, opacity: selectedUser ? 1 : 0.4, whiteSpace: 'nowrap' }}>
                        Hinzufügen
                      </button>
                    </div>
                  </div>

                  {/* Person list */}
                  {detailLoading ? (
                    <div style={{ textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic', padding: '16px 0' }}>Lade…</div>
                  ) : personen.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic', padding: '24px 0', fontSize: 14 }}>Noch niemand eingetragen</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {personen.map(p => {
                        const person = (p.expand?.user_id as any) || allUsers.find(u => u.id === p.user_id)
                        const initials = ((person as any)?.name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                        return (
                          <div key={p.id} style={{ background: '#fff', borderRadius: 10, borderLeft: '3px solid #600812', padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#600812', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                              {initials}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: '#1a0e08' }}>{(person as any)?.name || '–'}</div>
                              {p.rolle && <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>{p.rolle}</div>}
                            </div>
                            <button onClick={() => removePerson(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'flex' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── PROTOKOLLE ── */}
              {detailTab === 'protokolle' && (
                <div style={{ paddingBottom: 12 }}>
                  {detailLoading ? (
                    <div style={{ textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic', padding: '24px 0' }}>Lade…</div>
                  ) : linkedPatients.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic', padding: '40px 0 16px', fontSize: 14 }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(96,8,18,0.2)" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 12px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      Keine verknüpften Protokolle
                      <div style={{ fontSize: 12, marginTop: 4 }}>Einsatz-Nr. muss im Protokoll eingetragen sein</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {linkedPatients.map(p => {
                        const payload = safeJson(p.payload)
                        const name = [payload.name, payload.vorname].filter(Boolean).join(', ') || 'Unbekannt'
                        const sc: Record<string, string> = { offen: '#600812', freigegeben: '#16a34a', archiviert: '#8a7a68' }
                        return (
                          <div key={p.id} style={{ background: '#fff', borderRadius: 12, borderLeft: `3px solid ${sc[p.status] || '#600812'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: '#1a0e08' }}>{name}</div>
                              <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 2 }}>
                                {new Date(p.created).toLocaleDateString('de-DE')}
                              </div>
                            </div>
                            <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: `${sc[p.status] || '#600812'}1a`, color: sc[p.status] || '#600812' }}>
                              {p.status}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── LAGER ── */}
              {detailTab === 'lager' && (
                <div style={{ paddingBottom: 12 }}>
                  {detailLoading ? (
                    <div style={{ textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic', padding: '24px 0' }}>Lade…</div>
                  ) : linkedOutputs.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic', padding: '40px 0 16px', fontSize: 14 }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(96,8,18,0.2)" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 12px' }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                      Keine Produktausgaben für diesen Einsatz
                      <div style={{ fontSize: 12, marginTop: 4 }}>Einsatz-Nr. muss in der Produktausgabe eingetragen sein</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {linkedOutputs.map(o => {
                        const payload = safeJson(o.payload)
                        const positionen: any[] = payload.positionen || []
                        return (
                          <div key={o.id} style={{ background: '#fff', borderRadius: 12, borderLeft: '3px solid #600812', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                            <div style={{ padding: '12px 14px 10px' }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: '#1a0e08', marginBottom: 3 }}>
                                {payload.user_name || o.title || 'Ausgabe'}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
                                {payload.datum ? new Date(payload.datum).toLocaleDateString('de-DE') : new Date(o.created).toLocaleDateString('de-DE')}
                                {payload.lager_name ? ` · ${payload.lager_name}` : ''}
                              </div>
                              {positionen.length > 0 && (
                                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {positionen.map((pos: any, idx: number) => (
                                    <div key={idx} style={{ fontSize: 13, color: '#1a0e08', display: 'flex', gap: 8 }}>
                                      <span style={{ fontWeight: 700, color: '#600812', minWidth: 28 }}>{pos.qty}×</span>
                                      <span>{pos.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── KARTE ── */}
              {detailTab === 'karte' && (
                <div style={{ position: 'relative', height: 'calc(92dvh - 220px)', minHeight: 300 }}>
                  <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />
                  <button onClick={saveMap} style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 1000, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#600812', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                    Karte speichern
                  </button>
                </div>
              )}

            </div>
          </div>
        </>
      )}

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function EinsatzCard({ einsatz, onClick }: { einsatz: Einsatz; onClick: () => void }) {
  const cfg = STATUS_CFG[einsatz.status] || STATUS_CFG.aktiv
  const isPast = einsatz.status !== 'aktiv'
  return (
    <div onClick={onClick} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden', cursor: 'pointer', opacity: isPast ? 0.72 : 1 }}>
      <div style={{ height: 3, background: cfg.strip }} />
      <div style={{ padding: '12px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 16, color: '#1a0e08', lineHeight: 1.3 }}>
            {einsatz.stichwort || einsatz.einsatz_nr || 'Einsatz'}
          </div>
          <span style={{ flexShrink: 0, padding: '3px 9px', borderRadius: 99, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {einsatz.adresse && (
            <span style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>{einsatz.adresse}</span>
          )}
          <span style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
            {fmtDate(einsatz.datum)}{fmtTime(einsatz.datum) ? `, ${fmtTime(einsatz.datum)} Uhr` : ''}
            {einsatz.einsatz_nr && einsatz.stichwort ? ` · Nr: ${einsatz.einsatz_nr}` : ''}
          </span>
        </div>
      </div>
      <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'rgba(250,249,247,0.8)', padding: '7px 14px', display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 3 }}>
          Details
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
      </div>
    </div>
  )
}

function InfoField({ label, value, italic, span }: { label: string; value?: string; italic?: boolean; span?: boolean }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : {}}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: value ? '#1a0e08' : 'var(--warm-gray)', fontStyle: italic && value ? 'italic' : 'normal' }}>
        {value || '–'}
      </div>
    </div>
  )
}
