import React, { useState, useEffect } from 'react'
import PocketBase from 'pocketbase'
import StatusBar from '../components/StatusBar'
import { useAuth } from '../hooks/useAuth'

const pb = new PocketBase('https://api.responda.systems')

interface Device {
  id: string
  name: string
  type: string
  serial_number: string
  location: string
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly'
  last_inspection?: string
  last_inspection_passed?: boolean
  next_inspection_due: string
  organization_id: string
  created: string
}

interface Inspection {
  id: string
  device_id: string
  device_name: string
  device_type: string
  user_name: string
  inspection_date: string
  passed: boolean
  notes: string
  checklist_results: ChecklistResult[]
}

interface ChecklistResult {
  item: string
  checked: boolean
  note: string
}

interface Checklist {
  id?: string
  device_type: string
  items: string[]
  organization_id?: string
}

interface DeviceForm {
  id?: string
  name: string
  type: string
  serial_number: string
  location: string
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

interface InspectionForm {
  device_id: string
  device_name: string
  device_type: string
  checklist_items: string[]
  checklist_results: ChecklistResult[]
  notes: string
  currentStep: number
}

interface SettingsForm {
  selectedType: string
  items: string[]
  newItem: string
}

const deviceTypes = [
  'AED',
  'BZ-Gerät',
  'Absaugpumpe',
  'Beatmungsgerät',
  'Sauerstoffgerät',
  'Pulsoximeter',
  'Blutdruckmessgerät',
  'Defibrillator',
  'Sonstiges'
]

const defaultChecklists: Record<string, string[]> = {
  'AED': [
    'Gerät auf äußere Beschädigungen prüfen',
    'Status-Anzeige kontrollieren (OK-Symbol)',
    'Batterie-Anzeige kontrollieren',
    'Elektroden Verfallsdatum prüfen',
    'Elektroden auf Beschädigungen prüfen',
    'Selbsttest-Funktion überprüfen',
    'Zubehör vollständig (Schere, Rasierer, Handschuhe)',
    'Standort und Beschilderung kontrollieren'
  ],
  'BZ-Gerät': [
    'Gerät auf äußere Beschädigungen prüfen',
    'Batteriestand kontrollieren',
    'Display-Funktion testen',
    'Teststreifen Verfallsdatum prüfen',
    'Kontrolllösung Verfallsdatum prüfen',
    'Funktionstest mit Kontrolllösung durchführen',
    'Stechhilfe auf Funktion prüfen',
    'Ausreichend Lanzetten vorhanden'
  ],
  'Absaugpumpe': [
    'Gerät auf äußere Beschädigungen prüfen',
    'Stromversorgung/Akkustand kontrollieren',
    'Saugschlauch auf Risse und Beschädigungen prüfen',
    'Saugkraft testen (Handfläche)',
    'Auffangbehälter leer und sauber',
    'Auffangbehälter auf Dichtigkeit prüfen',
    'Filter kontrollieren und ggf. wechseln',
    'Einwegmaterial vollständig und steril'
  ],
  'Sonstiges': [
    'Sichtprüfung auf Beschädigungen',
    'Funktionsprüfung durchführen',
    'Zubehör und Verbrauchsmaterial prüfen',
    'Reinigung und Desinfektion durchgeführt'
  ]
}

export default function MPG() {
  const { user, loading: authLoading, logout } = useAuth()
  
  const [devices, setDevices] = useState<Device[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null)
  
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false)
  const [showInspectionModal, setShowInspectionModal] = useState(false)
  const [showLogbookModal, setShowLogbookModal] = useState(false)
  const [showDeviceDetailModal, setShowDeviceDetailModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  
  const [deviceForm, setDeviceForm] = useState<DeviceForm>({
    name: '',
    type: 'AED',
    serial_number: '',
    location: '',
    interval: 'monthly'
  })
  
  const [inspectionForm, setInspectionForm] = useState<InspectionForm>({
    device_id: '',
    device_name: '',
    device_type: '',
    checklist_items: [],
    checklist_results: [],
    notes: '',
    currentStep: 0
  })
  
  const [settingsForm, setSettingsForm] = useState<SettingsForm>({
    selectedType: 'AED',
    items: [],
    newItem: ''
  })
  
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [deviceInspections, setDeviceInspections] = useState<Inspection[]>([])
  
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'warning' | 'overdue'>('all')

  useEffect(() => {
    if (user?.organization_id) {
      loadData()
    }
  }, [user])

  if (authLoading) {
    return null
  }

  async function loadData() {
    if (!user?.organization_id) return
    
    try {
      setLoading(true)
      await Promise.all([
        loadDevices(),
        loadInspections(),
        loadOrCreateChecklists()
      ])
    } catch(e: any) {
      console.error('Fehler beim Laden:', e)
      showMessage('Fehler beim Laden der Daten', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadDevices() {
    const records = await pb.collection('mpg_devices').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      sort: '-created'
    })
    setDevices(records)
  }

  async function loadInspections() {
    const records = await pb.collection('mpg_inspections').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      sort: '-inspection_date'
    })
    setInspections(records)
  }

  async function loadOrCreateChecklists() {
    console.log('📋 Lade Prüfvorlagen...')
    console.log('  Organization ID:', user?.organization_id)
    
    try {
      const records = await pb.collection('mpg_checklists').getFullList({
        filter: `organization_id = "${user?.organization_id}"`
      })
      
      console.log('  ✅ Gefundene Checklisten:', records.length)
      
      if (records.length === 0) {
        console.log('  ⚠️  Keine Checklisten gefunden, erstelle Defaults...')
        
        const newChecklists: Checklist[] = []
        for (const [type, items] of Object.entries(defaultChecklists)) {
          const created = await pb.collection('mpg_checklists').create({
            device_type: type,
            items: items,
            organization_id: user?.organization_id
          })
          newChecklists.push(created)
          console.log(`    ✓ ${type}: ${items.length} Punkte`)
        }
        setChecklists(newChecklists)
      } else {
        setChecklists(records)
        records.forEach(c => {
          console.log(`    ✓ ${c.device_type}: ${c.items.length} Punkte`)
        })
      }
    } catch(e: any) {
      console.error('  ❌ Error with checklists:', e)
    }
  }

  function showMessage(text: string, type: 'success' | 'error') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  function getDeviceStatus(device: Device): 'ok' | 'warning' | 'overdue' {
    if (device.last_inspection_passed === false) {
      return 'overdue'
    }
    
    const now = new Date()
    const dueDate = new Date(device.next_inspection_due)
    const diffDays = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return 'overdue'
    if (diffDays <= 7) return 'warning'
    return 'ok'
  }

  const stats = {
    total: devices.length,
    ok: devices.filter(d => getDeviceStatus(d) === 'ok').length,
    warning: devices.filter(d => getDeviceStatus(d) === 'warning').length,
    overdue: devices.filter(d => getDeviceStatus(d) === 'overdue').length
  }

  const filteredDevices = devices.filter(device => {
    const matchesSearch = 
      device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.location?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = 
      statusFilter === 'all' || getDeviceStatus(device) === statusFilter
    
    return matchesSearch && matchesStatus
  })

  function openAddDevice() {
    setDeviceForm({
      name: '',
      type: 'AED',
      serial_number: '',
      location: '',
      interval: 'monthly'
    })
    setShowAddDeviceModal(true)
  }

  function openEditDevice(device: Device) {
    setDeviceForm({
      id: device.id,
      name: device.name,
      type: device.type,
      serial_number: device.serial_number,
      location: device.location,
      interval: device.interval
    })
    setShowAddDeviceModal(true)
  }

  async function saveDevice() {
    if (!deviceForm.name) {
      alert('Bitte Bezeichnung eingeben')
      return
    }

    try {
      const nextDue = new Date()
      switch (deviceForm.interval) {
        case 'daily': nextDue.setDate(nextDue.getDate() + 1); break
        case 'weekly': nextDue.setDate(nextDue.getDate() + 7); break
        case 'monthly': nextDue.setMonth(nextDue.getMonth() + 1); break
        case 'yearly': nextDue.setFullYear(nextDue.getFullYear() + 1); break
      }

      const data = {
        ...deviceForm,
        next_inspection_due: nextDue.toISOString(),
        organization_id: user?.organization_id
      }

      if (deviceForm.id) {
        await pb.collection('mpg_devices').update(deviceForm.id, data)
        showMessage('Gerät aktualisiert', 'success')
      } else {
        await pb.collection('mpg_devices').create(data)
        showMessage('Gerät hinzugefügt', 'success')
      }

      setShowAddDeviceModal(false)
      await loadDevices()
    } catch(e: any) {
      alert('Fehler beim Speichern: ' + e.message)
    }
  }

  async function deleteDevice(id: string, name: string) {
    if (!confirm(`Gerät "${name}" wirklich löschen?`)) return

    try {
      await pb.collection('mpg_devices').delete(id)
      showMessage('Gerät gelöscht', 'success')
      await loadDevices()
    } catch(e: any) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  function startInspection(device: Device) {
    console.log('🔍 Starte Prüfung für:', device.name, '(', device.type, ')')
    console.log('  Device Type (exakt):', JSON.stringify(device.type))
    console.log('  Verfügbare Templates:', checklists.length)
    
    checklists.forEach(c => {
      console.log(`    - Template: "${c.device_type}" (${c.items.length} Items)`)
    })
    
    const template = checklists.find(c => c.device_type === device.type)
    console.log('  Template gefunden?', template ? 'JA' : 'NEIN')
    
    if (!template) {
      console.log('  ⚠️  KEIN TEMPLATE GEFUNDEN! Suche "Sonstiges"...')
      const sonstigesTemplate = checklists.find(c => c.device_type === 'Sonstiges')
      console.log('  Sonstiges gefunden?', sonstigesTemplate ? 'JA' : 'NEIN')
    }
    
    const finalTemplate = template || checklists.find(c => c.device_type === 'Sonstiges')
    const items = finalTemplate?.items || defaultChecklists['Sonstiges']
    
    console.log('  Verwendetes Template:', finalTemplate?.device_type || 'Default Sonstiges')
    console.log('  Anzahl Prüfpunkte:', items.length)
    console.log('  Prüfpunkte:', items)
    
    setInspectionForm({
      device_id: device.id,
      device_name: device.name,
      device_type: device.type,
      checklist_items: items,
      checklist_results: items.map(item => ({ item, checked: false, note: '' })),
      notes: '',
      currentStep: 0
    })
    
    setShowInspectionModal(true)
  }

  function toggleChecklistItem(index: number) {
    const updated = [...inspectionForm.checklist_results]
    updated[index].checked = !updated[index].checked
    setInspectionForm({ ...inspectionForm, checklist_results: updated })
  }

  function updateChecklistItemNote(index: number, note: string) {
    const updated = [...inspectionForm.checklist_results]
    updated[index].note = note
    setInspectionForm({ ...inspectionForm, checklist_results: updated })
  }

  function nextInspectionStep() {
    setInspectionForm({ 
      ...inspectionForm, 
      currentStep: inspectionForm.currentStep + 1 
    })
  }

  function prevInspectionStep() {
    setInspectionForm({ 
      ...inspectionForm, 
      currentStep: inspectionForm.currentStep - 1 
    })
  }

  async function saveInspection(passed: boolean) {
    try {
      const inspectionData = {
        device_id: inspectionForm.device_id,
        device_name: inspectionForm.device_name,
        device_type: inspectionForm.device_type,
        user_name: user?.name || user?.email || 'Unbekannt',
        inspection_date: new Date().toISOString(),
        passed: passed,
        notes: inspectionForm.notes,
        checklist_results: inspectionForm.checklist_results,
        organization_id: user?.organization_id
      }
      
      await pb.collection('mpg_inspections').create(inspectionData)
      
      await pb.collection('mpg_devices').update(inspectionForm.device_id, {
        last_inspection: new Date().toISOString(),
        last_inspection_passed: passed
      })
      
      setShowInspectionModal(false)
      showMessage(passed ? 'Prüfung bestanden!' : 'Prüfung nicht bestanden', passed ? 'success' : 'error')
      await loadData()
    } catch(e: any) {
      alert('Fehler beim Speichern: ' + e.message)
    }
  }

  async function viewDeviceHistory(device: Device) {
    setSelectedDevice(device)
    const deviceInspections = inspections.filter(i => i.device_id === device.id)
    setDeviceInspections(deviceInspections)
    setShowDeviceDetailModal(true)
  }

  function openSettings() {
    console.log('⚙️ Öffne Einstellungen...')
    console.log('  Verfügbare Checklisten:', checklists.length)
    
    loadChecklistForType('AED')
    setShowSettingsModal(true)
  }

  function loadChecklistForType(type: string) {
    console.log('📋 Lade Template für:', type)
    
    const template = checklists.find(c => c.device_type === type)
    
    if (template) {
      console.log('  ✅ Template gefunden:', template.items.length, 'Items')
      setSettingsForm({
        selectedType: type,
        items: [...template.items],
        newItem: ''
      })
    } else {
      console.log('  ⚠️  Template nicht gefunden, nutze Default')
      setSettingsForm({
        selectedType: type,
        items: [...(defaultChecklists[type] || defaultChecklists['Sonstiges'])],
        newItem: ''
      })
    }
  }

  function addChecklistItem() {
    if (!settingsForm.newItem.trim()) return
    
    setSettingsForm({
      ...settingsForm,
      items: [...settingsForm.items, settingsForm.newItem.trim()],
      newItem: ''
    })
  }

  function removeChecklistItem(index: number) {
    const updated = settingsForm.items.filter((_, i) => i !== index)
    setSettingsForm({ ...settingsForm, items: updated })
  }

  function moveChecklistItem(index: number, direction: 'up' | 'down') {
    const updated = [...settingsForm.items]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    
    if (newIndex < 0 || newIndex >= updated.length) return
    
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    setSettingsForm({ ...settingsForm, items: updated })
  }

  async function saveChecklistTemplate() {
    console.log('💾 Speichere Template:', settingsForm.selectedType)
    console.log('  Items:', settingsForm.items.length)
    
    try {
      const existing = checklists.find(c => c.device_type === settingsForm.selectedType)
      
      if (existing) {
        console.log('  → Update existierendes Template')
        await pb.collection('mpg_checklists').update(existing.id!, {
          items: settingsForm.items
        })
      } else {
        console.log('  → Erstelle neues Template')
        await pb.collection('mpg_checklists').create({
          device_type: settingsForm.selectedType,
          items: settingsForm.items,
          organization_id: user?.organization_id
        })
      }
      
      await loadOrCreateChecklists()
      showMessage('Prüfvorlage gespeichert', 'success')
      setShowSettingsModal(false)
    } catch(e: any) {
      console.error('  ❌ Fehler:', e)
      alert('Fehler beim Speichern: ' + e.message)
    }
  }

  function resetChecklistTemplate() {
    if (!confirm('Vorlage auf Standard zurücksetzen?')) return
    
    const defaultItems = defaultChecklists[settingsForm.selectedType] || defaultChecklists['Sonstiges']
    setSettingsForm({
      ...settingsForm,
      items: [...defaultItems]
    })
  }

  return (
    <>
      <StatusBar user={user} onLogout={logout} pageName="MPG" showHubLink={true} />
      
      {/* ICON TOOLBAR */}
      <div className="action-toolbar">
        <button className="action-btn" onClick={openAddDevice} title="Gerät hinzufügen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <button className="action-btn" onClick={() => setShowLogbookModal(true)} title="Prüfungslogbuch">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </button>
        <button className="action-btn" onClick={openSettings} title="Prüfvorlagen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2l4.2-4.2"/>
          </svg>
        </button>
      </div>

      <div className="content">
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* STATISTICS - MIT KEY FÜR KORREKTES RE-RENDERING */}
        <div className="stats-grid" key={devices.length}>
          <div className="stat-card ok">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div className="stat-number">{stats.ok}</div>
            <div className="stat-label">Geprüft</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="stat-number">{stats.warning}</div>
            <div className="stat-label">Bald fällig</div>
          </div>
          <div className="stat-card overdue">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <div className="stat-number">{stats.overdue}</div>
            <div className="stat-label">Überfällig</div>
          </div>
          <div className="stat-card total">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">Gesamt</div>
          </div>
        </div>

        {/* SEARCH AND FILTERS */}
        <div className="filter-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Geräte durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="filter-buttons">
            <button 
              className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Alle
            </button>
            <button 
              className={`filter-btn ${statusFilter === 'ok' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ok')}
            >
              Geprüft
            </button>
            <button 
              className={`filter-btn ${statusFilter === 'warning' ? 'active' : ''}`}
              onClick={() => setStatusFilter('warning')}
            >
              Bald fällig
            </button>
            <button 
              className={`filter-btn ${statusFilter === 'overdue' ? 'active' : ''}`}
              onClick={() => setStatusFilter('overdue')}
            >
              Überfällig
            </button>
          </div>
        </div>

        {/* DEVICE CARDS */}
        {loading ? (
          <div className="empty-state">Lade Geräte...</div>
        ) : filteredDevices.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity: 0.3, marginBottom: '16px'}}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            <div style={{fontWeight: 700, marginBottom: '8px'}}>Keine Geräte</div>
            <div>Füge dein erstes Prüfgerät hinzu</div>
          </div>
        ) : (
          <div className="devices-grid">
            {filteredDevices.map(device => {
              const status = getDeviceStatus(device)
              const lastInspection = inspections.find(i => i.device_id === device.id)
              
              return (
                <div key={device.id} className={`device-card status-${status}`}>
                  <div className="device-menu-container">
                    <button 
                      className="menu-dots"
                      onClick={(e) => {
                        e.stopPropagation()
                        const menuId = `menu-${device.id}`
                        const menu = document.getElementById(menuId)
                        const allMenus = document.querySelectorAll('.device-menu-dropdown')
                        allMenus.forEach(m => {
                          if (m.id !== menuId) m.classList.remove('show')
                        })
                        menu?.classList.toggle('show')
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="1"/>
                        <circle cx="12" cy="5" r="1"/>
                        <circle cx="12" cy="19" r="1"/>
                      </svg>
                    </button>
                    <div id={`menu-${device.id}`} className="device-menu-dropdown">
                      <button 
                        className="menu-item"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditDevice(device)
                        }}
                      >
                        Bearbeiten
                      </button>
                      <button 
                        className="menu-item"
                        onClick={(e) => {
                          e.stopPropagation()
                          viewDeviceHistory(device)
                        }}
                      >
                        Historie anzeigen
                      </button>
                      <button 
                        className="menu-item danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteDevice(device.id, device.name)
                        }}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                  
                  <div className="device-type">{device.type}</div>
                  <div className="device-name">{device.name}</div>
                  <div className="device-meta">
                    {device.serial_number && <div>S/N: {device.serial_number}</div>}
                    {device.location && <div>{device.location}</div>}
                  </div>
                  
                  <div className="device-status-info">
                    {status === 'ok' && (
                      <div className="status-badge ok">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>In Ordnung</span>
                      </div>
                    )}
                    {status === 'warning' && (
                      <div className="status-badge warning">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span>Bald fällig</span>
                      </div>
                    )}
                    {status === 'overdue' && (
                      <div className="status-badge overdue">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="15" y1="9" x2="9" y2="15"/>
                          <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <span>Überfällig</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="device-dates">
                    <div>Fällig: {new Date(device.next_inspection_due).toLocaleDateString('de-DE')}</div>
                    {lastInspection && (
                      <div style={{fontSize: '12px', opacity: 0.7}}>
                        Zuletzt: {new Date(lastInspection.inspection_date).toLocaleDateString('de-DE')}
                      </div>
                    )}
                  </div>
                  
                  <button 
                    className="device-inspect-btn"
                    onClick={() => startInspection(device)}
                  >
                    Prüfung starten
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ADD/EDIT DEVICE MODAL */}
      {showAddDeviceModal && (
        <div className="modal show" onClick={() => setShowAddDeviceModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{deviceForm.id ? 'Gerät bearbeiten' : 'Gerät hinzufügen'}</h3>
            
            <div className="field">
              <label>Gerätetyp *</label>
              <select 
                value={deviceForm.type}
                onChange={(e) => setDeviceForm({ ...deviceForm, type: e.target.value })}
              >
                {deviceTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div className="field">
              <label>Bezeichnung *</label>
              <input
                type="text"
                value={deviceForm.name}
                onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                placeholder="z.B. AED Eingangsbereich"
                autoFocus
              />
            </div>
            
            <div className="field">
              <label>Seriennummer</label>
              <input
                type="text"
                value={deviceForm.serial_number}
                onChange={(e) => setDeviceForm({ ...deviceForm, serial_number: e.target.value })}
                placeholder="Optional"
              />
            </div>
            
            <div className="field">
              <label>Standort</label>
              <input
                type="text"
                value={deviceForm.location}
                onChange={(e) => setDeviceForm({ ...deviceForm, location: e.target.value })}
                placeholder="z.B. Fahrzeug 1, Büro"
              />
            </div>
            
            <div className="field">
              <label>Prüfintervall *</label>
              <select 
                value={deviceForm.interval}
                onChange={(e) => setDeviceForm({ ...deviceForm, interval: e.target.value as any })}
              >
                <option value="daily">Täglich</option>
                <option value="weekly">Wöchentlich</option>
                <option value="monthly">Monatlich</option>
                <option value="yearly">Jährlich</option>
              </select>
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAddDeviceModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={saveDevice}>
                {deviceForm.id ? 'Speichern' : 'Hinzufügen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECTION MODAL */}
      {showInspectionModal && (
        <div className="modal show" onClick={() => setShowInspectionModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>Prüfung: {inspectionForm.device_name}</h3>
            <div style={{fontSize: '14px', color: '#64748b', marginBottom: '24px'}}>
              {inspectionForm.device_type}
            </div>
            
            {inspectionForm.currentStep < inspectionForm.checklist_results.length ? (
              <>
                {/* CHECKLIST STEP */}
                <div className="inspection-progress">
                  Schritt {inspectionForm.currentStep + 1} von {inspectionForm.checklist_results.length}
                </div>
                
                <div className="inspection-step">
                  <div className="step-item">
                    <input
                      type="checkbox"
                      id="current-check"
                      checked={inspectionForm.checklist_results[inspectionForm.currentStep].checked}
                      onChange={() => toggleChecklistItem(inspectionForm.currentStep)}
                      className="big-checkbox"
                    />
                    <label htmlFor="current-check" className="step-label">
                      {inspectionForm.checklist_results[inspectionForm.currentStep].item}
                    </label>
                  </div>
                  
                  <div className="field" style={{marginTop: '20px'}}>
                    <label>Bemerkung zu diesem Prüfpunkt (optional)</label>
                    <textarea
                      value={inspectionForm.checklist_results[inspectionForm.currentStep].note}
                      onChange={(e) => updateChecklistItemNote(inspectionForm.currentStep, e.target.value)}
                      rows={3}
                      placeholder="z.B. Kleine Beschädigung an der Ecke, Batterie bei 80%, etc."
                    />
                  </div>
                </div>
                
                <div className="inspection-nav">
                  <button 
                    className="btn"
                    onClick={prevInspectionStep}
                    disabled={inspectionForm.currentStep === 0}
                  >
                    Zurück
                  </button>
                  <button 
                    className="btn primary"
                    onClick={nextInspectionStep}
                  >
                    {inspectionForm.currentStep === inspectionForm.checklist_results.length - 1 
                      ? 'Zur Zusammenfassung' 
                      : 'Weiter'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* SUMMARY */}
                <div className="inspection-summary">
                  <h4>Zusammenfassung</h4>
                  <div className="checklist-review">
                    {inspectionForm.checklist_results.map((result, idx) => (
                      <div key={idx} className="review-item">
                        <div style={{display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1}}>
                          <span className={result.checked ? 'check-ok' : 'check-fail'}>
                            {result.checked ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            )}
                          </span>
                          <div style={{flex: 1}}>
                            <div>{result.item}</div>
                            {result.note && (
                              <div style={{fontSize: '13px', color: '#64748b', marginTop: '4px', fontStyle: 'italic'}}>
                                → {result.note}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="field" style={{marginTop: '24px'}}>
                    <label>Anmerkungen / Mängel</label>
                    <textarea
                      value={inspectionForm.notes}
                      onChange={(e) => setInspectionForm({ ...inspectionForm, notes: e.target.value })}
                      rows={4}
                      placeholder="Optional: Besondere Vorkommnisse, festgestellte Mängel..."
                    />
                  </div>
                </div>
                
                <div className="modal-actions">
                  <button 
                    className="btn"
                    onClick={prevInspectionStep}
                  >
                    Zurück zur Prüfung
                  </button>
                  <button 
                    className="btn danger"
                    onClick={() => saveInspection(false)}
                  >
                    Nicht bestanden
                  </button>
                  <button 
                    className="btn primary"
                    onClick={() => saveInspection(true)}
                  >
                    Bestanden
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* LOGBOOK MODAL */}
      {showLogbookModal && (
        <div className="modal show" onClick={() => setShowLogbookModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>Prüfungslogbuch</h3>
            
            {inspections.length === 0 ? (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity: 0.3, marginBottom: '16px'}}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <div>Noch keine Prüfungen durchgeführt</div>
              </div>
            ) : (
              <div className="logbook-list">
                {inspections.map(inspection => (
                  <div key={inspection.id} className={`logbook-entry ${inspection.passed ? 'passed' : 'failed'}`}>
                    <div className="logbook-header">
                      <div>
                        <div className="logbook-device">{inspection.device_name}</div>
                        <div className="logbook-meta">
                          {new Date(inspection.inspection_date).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })} • {inspection.user_name}
                        </div>
                      </div>
                      <div className={`status-badge ${inspection.passed ? 'passed' : 'failed'}`}>
                        {inspection.passed ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            <span>Bestanden</span>
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                            <span>Nicht bestanden</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {inspection.notes && (
                      <div className="logbook-notes">
                        <strong>Anmerkungen:</strong> {inspection.notes}
                      </div>
                    )}
                    
                    {inspection.checklist_results && (
                      <details className="logbook-details">
                        <summary>Prüfpunkte anzeigen</summary>
                        <div className="checklist-results">
                          {inspection.checklist_results.map((result, idx) => (
                            <div key={idx} className="result-item">
                              <div style={{display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1}}>
                                <span className={result.checked ? 'check-ok' : 'check-fail'}>
                                  {result.checked ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                      <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                  ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                      <line x1="18" y1="6" x2="6" y2="18"/>
                                      <line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                  )}
                                </span>
                                <div style={{flex: 1}}>
                                  <div>{result.item}</div>
                                  {result.note && (
                                    <div style={{fontSize: '12px', color: '#64748b', marginTop: '2px', fontStyle: 'italic'}}>
                                      → {result.note}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowLogbookModal(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEVICE DETAIL MODAL */}
      {showDeviceDetailModal && selectedDevice && (
        <div className="modal show" onClick={() => setShowDeviceDetailModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedDevice.name}</h3>
            <div style={{fontSize: '14px', color: '#64748b', marginBottom: '24px'}}>
              {selectedDevice.type} • {selectedDevice.location}
            </div>
            
            <h4 style={{marginTop: '24px', marginBottom: '16px'}}>Prüfungshistorie</h4>
            
            {deviceInspections.length === 0 ? (
              <div className="empty-state">Noch keine Prüfungen</div>
            ) : (
              <div className="logbook-list">
                {deviceInspections.map(inspection => (
                  <div key={inspection.id} className={`logbook-entry ${inspection.passed ? 'passed' : 'failed'}`}>
                    <div className="logbook-header">
                      <div>
                        <div className="logbook-meta">
                          {new Date(inspection.inspection_date).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })} • {inspection.user_name}
                        </div>
                      </div>
                      <div className={`status-badge ${inspection.passed ? 'passed' : 'failed'}`}>
                        {inspection.passed ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            <span>Bestanden</span>
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                            <span>Nicht bestanden</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {inspection.notes && (
                      <div className="logbook-notes">
                        <strong>Anmerkungen:</strong> {inspection.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowDeviceDetailModal(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL - CHECKLIST TEMPLATES */}
      {showSettingsModal && (
        <div className="modal show" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>Prüfvorlagen verwalten</h3>
            
            <div className="field">
              <label>Gerätetyp</label>
              <select 
                value={settingsForm.selectedType}
                onChange={(e) => loadChecklistForType(e.target.value)}
              >
                {deviceTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div style={{marginTop: '24px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                <label style={{fontWeight: 700, fontSize: '14px', margin: 0}}>Prüfpunkte</label>
                <button className="btn-small" onClick={resetChecklistTemplate}>
                  Auf Standard zurücksetzen
                </button>
              </div>
              
              <div className="checklist-editor">
                {settingsForm.items.map((item, idx) => (
                  <div key={idx} className="checklist-item">
                    <div className="item-controls">
                      <button 
                        className="btn-icon"
                        onClick={() => moveChecklistItem(idx, 'up')}
                        disabled={idx === 0}
                        title="Nach oben"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="18 15 12 9 6 15"/>
                        </svg>
                      </button>
                      <button 
                        className="btn-icon"
                        onClick={() => moveChecklistItem(idx, 'down')}
                        disabled={idx === settingsForm.items.length - 1}
                        title="Nach unten"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                      <button 
                        className="btn-icon danger"
                        onClick={() => removeChecklistItem(idx)}
                        title="Löschen"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                    <div className="item-text">{item}</div>
                  </div>
                ))}
              </div>
              
              <div className="add-item-box">
                <input
                  type="text"
                  value={settingsForm.newItem}
                  onChange={(e) => setSettingsForm({ ...settingsForm, newItem: e.target.value })}
                  placeholder="Neuen Prüfpunkt hinzufügen..."
                  onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
                />
                <button className="btn primary" onClick={addChecklistItem}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Hinzufügen
                </button>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowSettingsModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={saveChecklistTemplate}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem;
          padding-top: 140px;
          padding-bottom: 100px;
        }

        .message {
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-weight: 600;
        }

        .message.success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        .message.error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .action-toolbar {
          background: #fff;
          border-bottom: 1px solid #e5e7eb;
          padding: 0.5rem 1rem;
          display: flex;
          gap: 0.5rem;
          justify-content: center;
          position: sticky;
          top: 60px;
          z-index: 99;
        }

        .action-btn {
          border: 1px solid rgba(0,0,0,0.1);
          background: rgba(0,0,0,0.03);
          color: #1d1d1f;
          padding: 0.6rem;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
          min-width: 44px;
          height: 44px;
        }

        .action-btn:hover {
          background: #f3f4f6;
          transform: translateY(-2px);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          border: 2px solid transparent;
          transition: all 0.2s;
        }

        .stat-card.ok {
          border-color: rgba(34, 197, 94, 0.2);
        }

        .stat-card.warning {
          border-color: rgba(234, 179, 8, 0.2);
        }

        .stat-card.overdue {
          border-color: rgba(239, 68, 68, 0.2);
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .stat-icon {
          margin-bottom: 12px;
          opacity: 0.6;
        }

        .stat-icon svg {
          display: block;
        }

        .stat-card.ok .stat-icon {
          color: #16a34a;
        }

        .stat-card.warning .stat-icon {
          color: #ca8a04;
        }

        .stat-card.overdue .stat-icon {
          color: #dc2626;
        }

        .stat-number {
          font-size: 32px;
          font-weight: 800;
          color: #1d1d1f;
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
        }

        .filter-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .search-input {
          flex: 1;
          min-width: 200px;
          padding: 10px 16px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          font-family: inherit;
        }

        .search-input:focus {
          outline: none;
          border-color: #b91c1c;
          box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.1);
        }

        .filter-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filter-btn {
          padding: 8px 16px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          background: rgba(255, 255, 255, 0.9);
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
          font-family: inherit;
        }

        .filter-btn:hover {
          background: #f3f4f6;
        }

        .filter-btn.active {
          background: #b91c1c;
          color: #fff;
          border-color: #b91c1c;
        }

        .devices-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .device-card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 12px;
          padding: 20px;
          border: 2px solid transparent;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          position: relative;
          transition: all 0.2s;
        }

        .device-card.status-ok {
          border-color: rgba(34, 197, 94, 0.2);
        }

        .device-card.status-warning {
          border-color: rgba(234, 179, 8, 0.2);
        }

        .device-card.status-overdue {
          border-color: rgba(239, 68, 68, 0.3);
        }

        .device-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
        }

        .device-menu-container {
          position: absolute;
          top: 12px;
          right: 12px;
        }

        .menu-dots {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 6px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 18px;
          color: #64748b;
          transition: all 0.2s;
        }

        .menu-dots:hover {
          background: #fff;
          color: #b91c1c;
          transform: scale(1.1);
        }

        .device-menu-dropdown {
          position: absolute;
          top: 32px;
          right: 0;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          min-width: 160px;
          display: none;
          flex-direction: column;
          z-index: 100;
        }

        .device-menu-dropdown.show {
          display: flex;
        }

        .menu-item {
          background: none;
          border: none;
          cursor: pointer;
          padding: 10px 16px;
          font-size: 14px;
          transition: all 0.2s;
          font-weight: 600;
          text-align: left;
          white-space: nowrap;
          color: #1d1d1f;
        }

        .menu-item:first-child {
          border-radius: 8px 8px 0 0;
        }

        .menu-item:last-child {
          border-radius: 0 0 8px 8px;
        }

        .menu-item:hover {
          background: #f3f4f6;
        }

        .menu-item.danger {
          color: #dc2626;
        }

        .menu-item.danger:hover {
          background: #fee2e2;
        }

        .device-type {
          font-size: 12px;
          font-weight: 700;
          color: #b91c1c;
          text-transform: uppercase;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }

        .device-name {
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 8px;
          color: #1d1d1f;
        }

        .device-meta {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 12px;
        }

        .device-status-info {
          margin: 12px 0;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
        }

        .status-badge svg {
          flex-shrink: 0;
        }

        .status-badge.ok {
          background: #f0fdf4;
          color: #166534;
        }

        .status-badge.warning {
          background: #fefce8;
          color: #854d0e;
        }

        .status-badge.overdue {
          background: #fef2f2;
          color: #dc2626;
        }

        .status-badge.passed {
          background: #f0fdf4;
          color: #166534;
        }

        .status-badge.failed {
          background: #fef2f2;
          color: #dc2626;
        }

        .device-dates {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 12px;
        }

        .device-inspect-btn {
          width: 100%;
          padding: 10px;
          background: #b91c1c;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .device-inspect-btn:hover {
          background: #dc2626;
          transform: translateY(-2px);
        }

        .empty-state {
          text-align: center;
          padding: 48px 16px;
          color: #64748b;
        }

        .modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal.show {
          display: flex;
        }

        .modal-content {
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border-radius: 14px;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        .modal-content.large {
          max-width: 700px;
        }

        .modal-content h3 {
          margin: 0 0 16px 0;
          color: #b91c1c;
          font-weight: 800;
        }

        .modal-content h4 {
          margin: 0 0 12px 0;
          color: #1d1d1f;
          font-weight: 700;
        }

        .field {
          margin-bottom: 16px;
        }

        .field label {
          font-weight: 700;
          font-size: 14px;
          color: #374151;
          display: block;
          margin-bottom: 8px;
        }

        .field input,
        .field select,
        .field textarea {
          padding: 10px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 8px;
          background: #fff;
          font-size: 16px;
          font-family: inherit;
          width: 100%;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          outline: none;
          border-color: #b91c1c;
          box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.1);
        }

        .modal-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 24px;
        }

        .btn {
          background: rgba(255, 255, 255, 0.9);
          color: #1d1d1f;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          transition: all 0.2s;
          font-family: inherit;
          border: 1px solid rgba(0, 0, 0, 0.08);
          font-size: 14px;
        }

        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .btn.primary {
          background: #b91c1c;
          color: #fff;
          border-color: #b91c1c;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .btn.primary:hover {
          background: #dc2626;
        }

        .btn.danger {
          background: #dc2626;
          color: #fff;
          border-color: #dc2626;
        }

        .btn.danger:hover {
          background: #ef4444;
        }

        .btn-small {
          background: rgba(255, 255, 255, 0.9);
          color: #1d1d1f;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
          font-family: inherit;
          border: 1px solid rgba(0, 0, 0, 0.08);
          font-size: 12px;
        }

        .btn-small:hover {
          background: #f3f4f6;
        }

        .btn-icon {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: #64748b;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }

        .btn-icon:hover {
          background: #f3f4f6;
          color: #1d1d1f;
        }

        .btn-icon:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .btn-icon.danger:hover {
          background: #fee2e2;
          color: #dc2626;
        }

        .inspection-progress {
          background: #f3f4f6;
          padding: 12px;
          border-radius: 8px;
          text-align: center;
          font-weight: 700;
          margin-bottom: 24px;
        }

        .inspection-step {
          padding: 32px 0;
        }

        .step-item {
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }

        .big-checkbox {
          width: 24px;
          height: 24px;
          cursor: pointer;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .step-label {
          font-size: 18px;
          line-height: 1.6;
          cursor: pointer;
          flex: 1;
        }

        .inspection-nav {
          display: flex;
          gap: 12px;
          justify-content: space-between;
          margin-top: 32px;
        }

        .inspection-summary {
          margin-bottom: 24px;
        }

        .checklist-review {
          background: #f9fafb;
          padding: 16px;
          border-radius: 8px;
          margin-top: 12px;
        }

        .review-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }

        .review-item:last-child {
          border-bottom: none;
        }

        .check-ok {
          color: #16a34a;
          display: flex;
          align-items: center;
        }

        .check-fail {
          color: #dc2626;
          display: flex;
          align-items: center;
        }

        .logbook-list {
          max-height: 500px;
          overflow-y: auto;
        }

        .logbook-entry {
          background: #f9fafb;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 12px;
          border-left: 4px solid #d1d5db;
        }

        .logbook-entry.passed {
          border-left-color: #22c55e;
        }

        .logbook-entry.failed {
          border-left-color: #ef4444;
        }

        .logbook-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 8px;
        }

        .logbook-device {
          font-weight: 700;
          font-size: 15px;
          color: #1d1d1f;
        }

        .logbook-meta {
          font-size: 13px;
          color: #64748b;
          margin-top: 4px;
        }

        .logbook-notes {
          margin-top: 12px;
          font-size: 14px;
          color: #374151;
          padding: 12px;
          background: #fff;
          border-radius: 6px;
        }

        .logbook-details {
          margin-top: 12px;
        }

        .logbook-details summary {
          cursor: pointer;
          font-weight: 600;
          color: #b91c1c;
          font-size: 14px;
          padding: 8px 0;
        }

        .checklist-results {
          margin-top: 12px;
          background: #fff;
          padding: 12px;
          border-radius: 6px;
        }

        .result-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 0;
          font-size: 14px;
        }

        .checklist-editor {
          background: #f9fafb;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 8px;
          padding: 12px;
          max-height: 400px;
          overflow-y: auto;
        }

        .checklist-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          background: #fff;
          border-radius: 6px;
          margin-bottom: 8px;
          border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .item-controls {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }

        .item-text {
          flex: 1;
          font-size: 14px;
          line-height: 1.5;
        }

        .add-item-box {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        .add-item-box input {
          flex: 1;
          padding: 10px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
        }

        .add-item-box input:focus {
          outline: none;
          border-color: #b91c1c;
          box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.1);
        }

        @media (max-width: 768px) {
          .action-toolbar {
            flex-wrap: wrap;
            padding: 0.5rem;
            gap: 0.4rem;
          }

          .action-btn {
            flex: 1;
            min-width: 40px;
            height: 40px;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .filter-bar {
            flex-direction: column;
          }

          .filter-buttons {
            width: 100%;
          }

          .filter-btn {
            flex: 1;
          }

          .devices-grid {
            grid-template-columns: 1fr;
          }

          .content {
            padding-top: 160px;
          }
        }
      `}</style>
    </>
  )
}
