import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import type { User } from '../types'

interface InventoryItem {
  id: string
  name: string
  category: string
  unit: string
  min_stock: number
  organization_id: string
  created: string
}

interface StockItem {
  id: string
  item_id: string
  location_id: string
  quantity: number
  expiry_date?: string
  batch?: string
  organization_id: string
}

interface Location {
  id: string
  name: string
  icon: string
  organization_id: string
}

interface DisplayItem {
  id: string
  name: string
  category: string
  unit: string
  min_stock: number
  qty: number
  expiry?: string
  status: 'ok' | 'warn' | 'exp'
}

interface AuditItem {
  id: string
  audit_id: string
  item_id: string
  location_id: string
  expected_quantity: number
  actual_quantity: number
  checked: boolean
  organization_id: string
  expand?: {
    item_id?: InventoryItem
  }
}

export default function Lager() {
  const { user, loading: authLoading, logout } = useAuth()
  
  const [locations, setLocations] = useState<Location[]>([])
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null)
  const [allItems, setAllItems] = useState<InventoryItem[]>([])
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([])
  
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'warning' | 'expired'>('all')
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [showZeroOnly, setShowZeroOnly] = useState(false)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null)
  
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showItemsModal, setShowItemsModal] = useState(false)
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  const [showBuchungModal, setShowBuchungModal] = useState(false)
  const [buchungType, setBuchungType] = useState<'ein' | 'aus'>('ein')
  
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  
  const [itemFormData, setItemFormData] = useState({
    name: '',
    category: '',
    unit: 'Stück',
    min_stock: 0
  })
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  
  const [newLocationName, setNewLocationName] = useState('')
  
  // Inventur state
  const [currentAudit, setCurrentAudit] = useState<any>(null)
  const [auditItems, setAuditItems] = useState<AuditItem[]>([])
  const [auditIndex, setAuditIndex] = useState(0)
  
  // Buchung state
  const [selectedBuchungItem, setSelectedBuchungItem] = useState<string>('')
  const [buchungQty, setBuchungQty] = useState(1)
  const [buchungExpiry, setBuchungExpiry] = useState('')
  const [buchungBatch, setBuchungBatch] = useState('')

  useEffect(() => {
    if (user?.organization_id) {
      loadLocations()
    }
  }, [user])

  useEffect(() => {
    if (currentLocationId) {
      loadStock()
    }
  }, [currentLocationId])

  useEffect(() => {
    function closeMenus(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.item-menu-container')) {
        document.querySelectorAll('.item-menu-dropdown').forEach(menu => {
          menu.classList.remove('show')
        })
      }
    }
    document.addEventListener('click', closeMenus)
    return () => document.removeEventListener('click', closeMenus)
  }, [])

  async function loadLocations() {
    try {
      const locs = await pb.collection('inventory_locations').getFullList<Location>({
        filter: `organization_id = "${user?.organization_id}"`,
        sort: 'created'
      })
      
      if (!locs.length) {
        const defaultLoc = await pb.collection('inventory_locations').create({
          name: 'Lager',
          icon: 'box',
          organization_id: user?.organization_id
        })
        setLocations([defaultLoc])
        setCurrentLocationId(defaultLoc.id)
      } else {
        setLocations(locs)
        setCurrentLocationId(locs[0].id)
      }
    } catch(e: any) {
      console.error('Error loading locations:', e)
      setError('Fehler beim Laden der Standorte: ' + e.message)
    }
  }

  async function loadStock() {
    if (!currentLocationId) return
    
    try {
      setLoading(true)
      setError(null)
      
      const items = await pb.collection('inventory_items').getFullList<InventoryItem>({
        filter: `organization_id = "${user?.organization_id}"`,
        sort: 'name'
      })
      
      setAllItems(items)
      
      const stockData = await pb.collection('inventory_stock').getFullList<StockItem>({
        filter: `location_id = "${currentLocationId}" && organization_id = "${user?.organization_id}"`,
        expand: 'item_id'
      })
      
      const itemMap = new Map<string, DisplayItem>()
      
      for (const item of items) {
        itemMap.set(item.id, {
          id: item.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          min_stock: item.min_stock,
          qty: 0,
          expiry: undefined,
          status: 'ok'
        })
      }
      
      for (const stock of stockData) {
        const item = itemMap.get(stock.item_id)
        if (item) {
          item.qty += stock.quantity || 0
          if (stock.expiry_date && (!item.expiry || stock.expiry_date < item.expiry)) {
            item.expiry = stock.expiry_date
          }
        }
      }
      
      const items_list = Array.from(itemMap.values()).map(item => ({
        ...item,
        status: computeStatus(item.expiry)
      }))
      
      setDisplayItems(items_list)
      
    } catch(e: any) {
      console.error('Error loading stock:', e)
      setError('Fehler beim Laden: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function computeStatus(expiry?: string): 'ok' | 'warn' | 'exp' {
    if (!expiry) return 'ok'
    const today = new Date()
    const expiryDate = new Date(expiry)
    const diffDays = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return 'exp'
    if (diffDays < 30) return 'warn'
    return 'ok'
  }

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  async function adjustQty(itemId: string, delta: number) {
    const item = displayItems.find(it => it.id === itemId)
    if (!item) return
    
    if (delta < 0 && item.qty <= 0) {
      alert('Nicht genügend Bestand')
      return
    }
    
    try {
      const stockList = await pb.collection('inventory_stock').getFullList({
        filter: `item_id = "${itemId}" && location_id = "${currentLocationId}"`,
        sort: 'expiry_date'
      })
      
      if (delta > 0) {
        const expiry = prompt('Ablaufdatum (JJJJ-MM-TT) oder leer lassen:')
        await pb.collection('inventory_stock').create({
          item_id: itemId,
          location_id: currentLocationId,
          quantity: delta,
          expiry_date: expiry || null,
          organization_id: user?.organization_id
        })
        
        await pb.collection('inventory_transactions').create({
          item_id: itemId,
          location_id: currentLocationId,
          type: 'einbuchung',
          quantity: delta,
          expiry_date: expiry || null,
          user: user?.email || user?.id,
          organization_id: user?.organization_id
        })
        
      } else {
        let remaining = Math.abs(delta)
        
        for (const stock of stockList) {
          if (remaining <= 0) break
          
          const take = Math.min(stock.quantity, remaining)
          const newQty = stock.quantity - take
          
          if (newQty <= 0) {
            await pb.collection('inventory_stock').delete(stock.id)
          } else {
            await pb.collection('inventory_stock').update(stock.id, {
              quantity: newQty
            })
          }
          
          remaining -= take
        }
        
        await pb.collection('inventory_transactions').create({
          item_id: itemId,
          location_id: currentLocationId,
          type: 'ausbuchung',
          quantity: delta,
          user: user?.email || user?.id,
          organization_id: user?.organization_id
        })
      }
      
      await loadStock()
      showMsg(`✅ ${delta > 0 ? 'Eingebucht' : 'Ausgebucht'}: ${Math.abs(delta)} ${item.unit || 'Stück'}`, 'success')
      
    } catch(e: any) {
      setError('Fehler: ' + e.message)
    }
  }

  async function saveItem() {
    if (!itemFormData.name.trim()) {
      alert('Artikelname erforderlich')
      return
    }
    
    try {
      if (editingItemId) {
        await pb.collection('inventory_items').update(editingItemId, {
          ...itemFormData,
          organization_id: user?.organization_id
        })
        showMsg('✅ Artikel aktualisiert!', 'success')
      } else {
        await pb.collection('inventory_items').create({
          ...itemFormData,
          organization_id: user?.organization_id
        })
        showMsg('✅ Artikel angelegt!', 'success')
      }
      
      setShowAddItemModal(false)
      setEditingItemId(null)
      setItemFormData({ name: '', category: '', unit: 'Stück', min_stock: 0 })
      await loadStock()
      
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Artikel wirklich löschen? Alle Bestände gehen verloren!')) return
    
    try {
      const stockList = await pb.collection('inventory_stock').getFullList({
        filter: `item_id = "${itemId}"`
      })
      
      for (const stock of stockList) {
        await pb.collection('inventory_stock').delete(stock.id)
      }
      
      await pb.collection('inventory_items').delete(itemId)
      await loadStock()
      showMsg('✅ Artikel gelöscht!', 'success')
      
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function addLocation() {
    if (!newLocationName.trim()) {
      alert('Name erforderlich')
      return
    }
    
    try {
      await pb.collection('inventory_locations').create({
        name: newLocationName,
        icon: 'box',
        organization_id: user?.organization_id
      })
      
      setNewLocationName('')
      await loadLocations()
      showMsg('✅ Standort hinzugefügt!', 'success')
      
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function deleteLocation(locId: string) {
    if (locations.length <= 1) {
      alert('Der letzte Standort kann nicht gelöscht werden')
      return
    }
    
    if (!confirm('Standort löschen? Alle Bestände gehen verloren!')) return
    
    try {
      const stockList = await pb.collection('inventory_stock').getFullList({
        filter: `location_id = "${locId}"`
      })
      
      for (const stock of stockList) {
        await pb.collection('inventory_stock').delete(stock.id)
      }
      
      await pb.collection('inventory_locations').delete(locId)
      await loadLocations()
      showMsg('✅ Standort gelöscht!', 'success')
      
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // INVENTUR FUNKTIONEN
  async function startInventur() {
    if (!currentLocationId) return
    
    try {
      const audit = await pb.collection('inventory_audits').create({
        audit_date: new Date().toISOString(),
        status: 'offen',
        user: user?.email || user?.name || user?.id,
        organization_id: user?.organization_id
      })
      
      for (const item of displayItems) {
        await pb.collection('inventory_audit_items').create({
          audit_id: audit.id,
          item_id: item.id,
          location_id: currentLocationId,
          expected_quantity: item.qty,
          actual_quantity: 0,
          checked: false,
          organization_id: user?.organization_id
        })
      }
      
      setCurrentAudit(audit)
      await loadAuditItems(audit.id)
      setAuditIndex(0)
      showMsg('✅ Inventur gestartet!', 'success')
      
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function loadAuditItems(auditId: string) {
    try {
      const items = await pb.collection('inventory_audit_items').getFullList<AuditItem>({
        filter: `audit_id = "${auditId}" && location_id = "${currentLocationId}"`,
        expand: 'item_id',
        sort: 'checked,created'
      })
      
      setAuditItems(items)
      
      const firstUnchecked = items.findIndex(ai => !ai.checked)
      if (firstUnchecked >= 0) setAuditIndex(firstUnchecked)
      
    } catch(e: any) {
      console.error('Error loading audit items:', e)
    }
  }

  async function saveAuditItem(actual: number, checked: boolean) {
    if (!currentAudit || auditIndex >= auditItems.length) return
    
    const auditItem = auditItems[auditIndex]
    
    try {
      await pb.collection('inventory_audit_items').update(auditItem.id, {
        actual_quantity: actual,
        checked: checked
      })
      
      if (checked && actual !== auditItem.expected_quantity) {
        const diff = actual - auditItem.expected_quantity
        
        const stockList = await pb.collection('inventory_stock').getFullList({
          filter: `item_id = "${auditItem.item_id}" && location_id = "${currentLocationId}"`
        })
        
        if (diff > 0) {
          await pb.collection('inventory_stock').create({
            item_id: auditItem.item_id,
            location_id: currentLocationId,
            quantity: diff,
            organization_id: user?.organization_id
          })
        } else if (diff < 0 && stockList.length > 0) {
          let remaining = Math.abs(diff)
          for (const stock of stockList) {
            if (remaining <= 0) break
            
            const take = Math.min(stock.quantity, remaining)
            const newQty = stock.quantity - take
            
            if (newQty <= 0) {
              await pb.collection('inventory_stock').delete(stock.id)
            } else {
              await pb.collection('inventory_stock').update(stock.id, {
                quantity: newQty
              })
            }
            
            remaining -= take
          }
        }
        
        await pb.collection('inventory_transactions').create({
          item_id: auditItem.item_id,
          location_id: currentLocationId,
          type: 'korrektur',
          quantity: diff,
          note: `Inventur-Korrektur: ${auditItem.expected_quantity} → ${actual}`,
          user: user?.email || user?.id,
          organization_id: user?.organization_id
        })
      }
      
      if (auditIndex < auditItems.length - 1) {
        setAuditIndex(auditIndex + 1)
        await loadAuditItems(currentAudit.id)
      } else {
        await finishInventur()
      }
      
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function finishInventur() {
    if (!currentAudit) return
    
    try {
      await pb.collection('inventory_audits').update(currentAudit.id, {
        status: 'abgeschlossen'
      })
      
      setShowInventoryModal(false)
      setCurrentAudit(null)
      setAuditItems([])
      setAuditIndex(0)
      await loadStock()
      showMsg('✅ Inventur abgeschlossen!', 'success')
      
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // BUCHUNG FUNKTIONEN
  async function saveBuchung() {
    if (!selectedBuchungItem || !currentLocationId) {
      alert('Bitte Artikel auswählen')
      return
    }
    
    if (buchungQty <= 0) {
      alert('Menge muss größer 0 sein')
      return
    }
    
    const delta = buchungType === 'ein' ? buchungQty : -buchungQty
    
    try {
      await adjustQty(selectedBuchungItem, delta)
      setShowBuchungModal(false)
      setSelectedBuchungItem('')
      setBuchungQty(1)
      setBuchungExpiry('')
      setBuchungBatch('')
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  const filteredItems = displayItems.filter(item => {
    if (searchQuery) {
      const needle = searchQuery.toLowerCase()
      if (!item.name.toLowerCase().includes(needle) && 
          !item.category.toLowerCase().includes(needle)) {
        return false
      }
    }
    
    if (statusFilter === 'expired' && item.status !== 'exp') return false
    if (statusFilter === 'warning' && item.status !== 'warn') return false
    if (showLowOnly && item.qty >= item.min_stock) return false
    if (showZeroOnly && item.qty !== 0) return false
    
    return true
  })

  const stats = {
    ok: displayItems.filter(i => i.status === 'ok').length,
    warn: displayItems.filter(i => i.status === 'warn').length,
    exp: displayItems.filter(i => i.status === 'exp').length,
    total: displayItems.length
  }

  if (authLoading) {
    return null
  }

  const userName = user?.name || user?.email?.split('@')[0] || '—'
  return (
    <>
      {/* STATUSBAR WIE HUB/FILES */}
      <div className="status-bar">
        <div className="logo">
          <svg width="120" height="32" viewBox="0 0 560 140">
            <rect x="20" y="20" width="100" height="100" rx="26" fill="#1e3a8a" opacity="0.15"/>
            <path d="M45 42 L45 98 L60 98 L60 78 L72 78 L83 98 L100 98 L87 77 Q92 74 92 63 Q92 42 75 42 Z M60 52 L72 52 Q77 52 77 62 Q77 72 72 72 L60 72 Z" fill="#1e3a8a"/>
            <text x="140" y="80" fontFamily="Inter, sans-serif" fontSize="46" fontWeight="600" fill="#1d1d1f" letterSpacing="0">Responda</text>
          </svg>
        </div>
        <div className="user-name">Lager</div>
        <div className="status-actions">
          <button className="logout-btn" onClick={() => setShowItemsModal(true)} title="Artikel-Datenbank">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
          <button className="logout-btn" onClick={() => { setBuchungType('ein'); setShowBuchungModal(true) }} title="Einbuchen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button className="logout-btn" onClick={() => { setBuchungType('aus'); setShowBuchungModal(true) }} title="Ausbuchen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button className="logout-btn" onClick={() => setShowInventoryModal(true)} title="Inventur">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              <path d="M9 12h6m-6 4h6"/>
            </svg>
          </button>
          <button className="logout-btn" onClick={() => setShowSettingsModal(true)} title="Einstellungen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
            </svg>
          </button>
          <Link to="/hub" className="logout-btn">
            Hub
          </Link>
        </div>
      </div>
      
      <div className="content">
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card ok">
            <div className="stat-num">{stats.ok}</div>
            <div>In Ordnung</div>
          </div>
          <div className="stat-card warn">
            <div className="stat-num">{stats.warn}</div>
            <div>Bald fällig</div>
          </div>
          <div className="stat-card exp">
            <div className="stat-num">{stats.exp}</div>
            <div>Abgelaufen</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{stats.total}</div>
            <div>Gesamt</div>
          </div>
        </div>

        <div className="toolbar">
          <div className="search-box">
            <input
              type="text"
              placeholder="Artikel suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="filter-chips">
            <button 
              className={`chip ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Alle
            </button>
            <button 
              className={`chip ${statusFilter === 'warning' ? 'active' : ''}`}
              onClick={() => setStatusFilter('warning')}
            >
              Bald fällig
            </button>
            <button 
              className={`chip ${statusFilter === 'expired' ? 'active' : ''}`}
              onClick={() => setStatusFilter('expired')}
            >
              Abgelaufen
            </button>
            <button 
              className={`chip ${showLowOnly ? 'active' : ''}`}
              onClick={() => setShowLowOnly(!showLowOnly)}
            >
              Einbestellen
            </button>
            <button 
              className={`chip ${showZeroOnly ? 'active' : ''}`}
              onClick={() => setShowZeroOnly(!showZeroOnly)}
            >
              Nur 0
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={loadStock} style={{marginLeft: '16px'}}>Erneut versuchen</button>
          </div>
        )}

        <div className="items-list">
          {loading ? (
            <div className="empty-state">Lade Lagerdaten...</div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">
              <div style={{fontSize: '48px', marginBottom: '16px', opacity: 0.3}}>📦</div>
              <div style={{fontWeight: 700, marginBottom: '8px'}}>Keine Artikel gefunden</div>
              <div>Passen Sie die Filter an oder fügen Sie Artikel hinzu</div>
            </div>
          ) : (
            filteredItems.map(item => {
              const isLow = item.min_stock > 0 && item.qty < item.min_stock
              const isZero = item.qty === 0
              
              return (
                <div 
                  key={item.id}
                  className={`item-row ${isZero ? 'zero' : item.status}`}
                >
                  <div className="item-menu-container">
                    <button 
                      className="menu-dots"
                      onClick={(e) => {
                        e.stopPropagation()
                        const menuId = `menu-${item.id}`
                        const menu = document.getElementById(menuId)
                        const allMenus = document.querySelectorAll('.item-menu-dropdown')
                        allMenus.forEach(m => {
                          if (m.id !== menuId) m.classList.remove('show')
                        })
                        menu?.classList.toggle('show')
                      }}
                    >
                      ⋮
                    </button>
                    <div id={`menu-${item.id}`} className="item-menu-dropdown">
                      <button 
                        className="menu-item"
                        onClick={(e) => {
                          e.stopPropagation()
                          adjustQty(item.id, 1)
                        }}
                      >
                        Einbuchen (+1)
                      </button>
                      <button 
                        className="menu-item"
                        onClick={(e) => {
                          e.stopPropagation()
                          adjustQty(item.id, -1)
                        }}
                      >
                        Ausbuchen (-1)
                      </button>
                    </div>
                  </div>

                  <div className="item-header">
                    <div>
                      <div className="item-name">{item.name}</div>
                      {item.category && (
                        <div className="item-category">{item.category}</div>
                      )}
                    </div>
                    <div className="item-qty">
                      <div className={`qty-display ${isLow ? 'low' : ''}`}>
                        IST: {item.qty} {item.unit} / SOLL: {item.min_stock}
                      </div>
                      {item.expiry && (
                        <div className="expiry-date">
                          {new Date(item.expiry).toLocaleDateString('de-DE')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* FIXED LOCATION TABS */}
      <div className="location-tabs-fixed">
        {locations.map(loc => (
          <button
            key={loc.id}
            className={`location-tab ${currentLocationId === loc.id ? 'active' : ''}`}
            onClick={() => setCurrentLocationId(loc.id)}
          >
            {loc.name}
          </button>
        ))}
      </div>

      {/* ARTIKEL-DATENBANK MODAL */}
      {showItemsModal && (
        <div className="modal" onClick={() => setShowItemsModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Artikel-Datenbank</h3>
            
            <button 
              className="btn primary" 
              style={{width: '100%', marginBottom: '16px'}}
              onClick={() => {
                setItemFormData({ name: '', category: '', unit: 'Stück', min_stock: 0 })
                setEditingItemId(null)
                setShowAddItemModal(true)
              }}
            >
              Neuen Artikel anlegen
            </button>
            
            <div className="item-list">
              {allItems.length === 0 ? (
                <div className="empty-state">Keine Artikel vorhanden</div>
              ) : (
                allItems.map(item => (
                  <div key={item.id} className="item-card">
                    <div className="item-card-info">
                      <div className="item-card-name">{item.name}</div>
                      <div className="item-card-meta">
                        {item.category || 'Keine Kategorie'} • {item.unit || 'Stück'} • Min: {item.min_stock || 0}
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '8px'}}>
                      <button 
                        className="btn-small"
                        onClick={() => {
                          setItemFormData({
                            name: item.name,
                            category: item.category,
                            unit: item.unit,
                            min_stock: item.min_stock
                          })
                          setEditingItemId(item.id)
                          setShowAddItemModal(true)
                        }}
                      >
                        Bearbeiten
                      </button>
                      <button 
                        className="btn-small danger"
                        onClick={() => deleteItem(item.id)}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '24px'}}>
              <button className="btn" onClick={() => setShowItemsModal(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EINSTELLUNGEN MODAL (LAGER-STANDORTE) */}
      {showSettingsModal && (
        <div className="modal" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Lager-Standorte</h3>
            
            <div className="location-list">
              {locations.map(loc => (
                <div key={loc.id} className="location-card">
                  <div>{loc.name}</div>
                  <button 
                    className="btn-small danger"
                    onClick={() => deleteLocation(loc.id)}
                    disabled={locations.length <= 1}
                  >
                    Löschen
                  </button>
                </div>
              ))}
            </div>
            
            <div className="form-group" style={{marginTop: '16px'}}>
              <input
                type="text"
                placeholder="Neuer Standort-Name"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
              />
              <button className="btn primary" onClick={addLocation}>
                Standort hinzufügen
              </button>
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '24px'}}>
              <button className="btn" onClick={() => setShowSettingsModal(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVENTUR MODAL */}
      {showInventoryModal && (
        <div className="modal" onClick={() => setShowInventoryModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Inventur</h3>
            
            {!currentAudit ? (
              <div>
                <div className="empty-state" style={{marginBottom: '24px'}}>
                  <div style={{fontSize: '48px', marginBottom: '16px'}}>📋</div>
                  <div style={{fontWeight: 700, marginBottom: '8px'}}>Inventur durchführen</div>
                  <div>Zählen Sie alle Artikel und korrigieren Sie Bestände</div>
                </div>
                
                <button 
                  className="btn primary" 
                  style={{width: '100%'}}
                  onClick={startInventur}
                >
                  Inventur starten
                </button>
              </div>
            ) : (
              <div>
                <div style={{background: '#f0f9ff', padding: '12px', borderRadius: '8px', marginBottom: '16px'}}>
                  <strong>Fortschritt:</strong> {auditItems.filter(ai => ai.checked).length} / {auditItems.length} geprüft
                </div>
                
                {auditIndex < auditItems.length && (
                  <div>
                    <div style={{background: '#fafafa', padding: '16px', borderRadius: '8px', marginBottom: '16px'}}>
                      <h4 style={{margin: '0 0 8px 0'}}>{auditIndex + 1}. {auditItems[auditIndex]?.expand?.item_id?.name}</h4>
                      <div style={{color: '#64748b', fontSize: '0.9rem', marginBottom: '8px'}}>
                        {auditItems[auditIndex]?.expand?.item_id?.category || 'Keine Kategorie'} • {auditItems[auditIndex]?.expand?.item_id?.unit || 'Stück'}
                      </div>
                      
                      <div style={{background: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '12px'}}>
                        <div style={{color: '#64748b', fontSize: '0.85rem'}}>Erwarteter Bestand (laut System):</div>
                        <div style={{fontSize: '1.5rem', fontWeight: 700}}>{auditItems[auditIndex]?.expected_quantity} {auditItems[auditIndex]?.expand?.item_id?.unit || 'Stück'}</div>
                      </div>
                      
                      <div className="form-group">
                        <label>Tatsächlicher Bestand (gezählt):</label>
                        <input
                          type="number"
                          id="audit-actual"
                          defaultValue={auditItems[auditIndex]?.actual_quantity || 0}
                          min="0"
                          style={{fontSize: '1.2rem', fontWeight: 700}}
                        />
                      </div>
                      
                      <div style={{marginTop: '12px'}}>
                        <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                          <input type="checkbox" id="audit-checked" defaultChecked={auditItems[auditIndex]?.checked || false} />
                          <span>Als geprüft markieren</span>
                        </label>
                      </div>
                    </div>
                    
                    <div style={{display: 'flex', gap: '8px', justifyContent: 'space-between'}}>
                      <button 
                        className="btn" 
                        onClick={() => setAuditIndex(Math.max(0, auditIndex - 1))}
                        disabled={auditIndex === 0}
                      >
                        Zurück
                      </button>
                      <button 
                        className="btn primary"
                        onClick={() => {
                          const actual = parseInt((document.getElementById('audit-actual') as HTMLInputElement)?.value || '0')
                          const checked = (document.getElementById('audit-checked') as HTMLInputElement)?.checked || false
                          saveAuditItem(actual, checked)
                        }}
                      >
                        {auditIndex === auditItems.length - 1 ? 'Fertig' : 'Weiter'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '24px'}}>
              <button className="btn" onClick={() => {
                setShowInventoryModal(false)
                setCurrentAudit(null)
                setAuditItems([])
              }}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUCHUNG MODAL */}
      {showBuchungModal && (
        <div className="modal" onClick={() => setShowBuchungModal(false)}>
          <div className="modal-box small" onClick={(e) => e.stopPropagation()}>
            <h3>{buchungType === 'ein' ? 'Artikel einbuchen' : 'Artikel ausbuchen'}</h3>
            
            <div className="form-group">
              <label>Artikel auswählen *</label>
              <select 
                value={selectedBuchungItem}
                onChange={(e) => setSelectedBuchungItem(e.target.value)}
              >
                <option value="">-- Artikel wählen --</option>
                {allItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.category || 'Keine Kategorie'})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Menge *</label>
              <input
                type="number"
                value={buchungQty}
                onChange={(e) => setBuchungQty(parseInt(e.target.value) || 1)}
                min="1"
              />
            </div>
            
            {buchungType === 'ein' && (
              <>
                <div className="form-group">
                  <label>Ablaufdatum (optional)</label>
                  <input
                    type="date"
                    value={buchungExpiry}
                    onChange={(e) => setBuchungExpiry(e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label>Charge/Bemerkung (optional)</label>
                  <input
                    type="text"
                    value={buchungBatch}
                    onChange={(e) => setBuchungBatch(e.target.value)}
                    placeholder="z.B. Charge 12345"
                  />
                </div>
              </>
            )}
            
            <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px'}}>
              <button className="btn" onClick={() => setShowBuchungModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={saveBuchung}>
                {buchungType === 'ein' ? 'Einbuchen' : 'Ausbuchen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ITEM MODAL */}
      {showAddItemModal && (
        <div className="modal" onClick={() => setShowAddItemModal(false)}>
          <div className="modal-box small" onClick={(e) => e.stopPropagation()}>
            <h3>{editingItemId ? 'Artikel bearbeiten' : 'Artikel anlegen'}</h3>
            
            <div className="form-group">
              <label>Artikelname *</label>
              <input
                type="text"
                value={itemFormData.name}
                onChange={(e) => setItemFormData({...itemFormData, name: e.target.value})}
                placeholder="z.B. Einmalhandschuhe"
              />
            </div>
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
              <div className="form-group">
                <label>Kategorie</label>
                <input
                  type="text"
                  value={itemFormData.category}
                  onChange={(e) => setItemFormData({...itemFormData, category: e.target.value})}
                  placeholder="z.B. Verbandmaterial"
                />
              </div>
              
              <div className="form-group">
                <label>Einheit</label>
                <input
                  type="text"
                  value={itemFormData.unit}
                  onChange={(e) => setItemFormData({...itemFormData, unit: e.target.value})}
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Mindestbestand</label>
              <input
                type="number"
                value={itemFormData.min_stock}
                onChange={(e) => setItemFormData({...itemFormData, min_stock: parseInt(e.target.value) || 0})}
                min="0"
              />
            </div>
            
            <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px'}}>
              <button className="btn" onClick={() => setShowAddItemModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={saveItem}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .status-bar {
          background: #fff;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 4px rgba(0,0,0,0.04);
        }

        .logo svg {
          display: block;
        }

        .user-name {
          font-weight: 700;
          font-size: 1.05rem;
          color: #1d1d1f;
        }

        .status-actions {
          margin-left: auto;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .logout-btn {
          background: #fff;
          color: #1d1d1f;
          border: 1px solid rgba(0,0,0,0.08);
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
          gap: 6px;
        }

        .logout-btn:hover {
          background: #f9f9f9;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .logout-btn svg {
          flex-shrink: 0;
        }

        .content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem;
          padding-top: 20px;
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

        .error-message {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 24px;
          font-weight: 600;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .stat-card {
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 3px 12px rgba(0,0,0,0.06);
          padding: 20px;
        }

        .stat-num {
          font-size: 1.4rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }

        .stat-card.ok .stat-num {
          color: #16a34a;
        }

        .stat-card.warn .stat-num {
          color: #f59e0b;
        }

        .stat-card.exp .stat-num {
          color: #b91c1c;
        }

        .toolbar {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .search-box {
          flex: 1;
          min-width: 200px;
        }

        .search-box input {
          width: 100%;
          padding: 10px 16px;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 8px;
          background: #fff;
          font-size: 14px;
          font-family: inherit;
        }

        .search-box input:focus {
          outline: none;
          border-color: #b91c1c;
          box-shadow: 0 0 0 3px rgba(185,28,28,0.1);
        }

        .filter-chips {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .chip {
          border: 1px solid rgba(0,0,0,0.08);
          background: #fff;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          font-weight: 600;
          font-family: inherit;
        }

        .chip:hover {
          background: #f9f9f9;
        }

        .chip.active {
          background: #fee2e2;
          color: #b91c1c;
          border-color: #b91c1c;
        }

        .btn {
          background: #fff;
          color: #1d1d1f;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          transition: all 0.2s;
          font-family: inherit;
          border: 1px solid rgba(0,0,0,0.08);
          font-size: 14px;
        }

        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .btn.primary {
          background: #b91c1c;
          color: #fff;
          border-color: #b91c1c;
        }

        .btn.primary:hover {
          background: #dc2626;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .btn-small {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.08);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }

        .btn-small:hover {
          background: #f9f9f9;
        }

        .btn-small.danger {
          color: #b91c1c;
        }

        .btn-small:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .items-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .item-row {
          background: #fff;
          border-left: 4px solid;
          border-radius: 12px;
          padding: 1rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          position: relative;
          transition: all 0.2s;
        }

        .item-row:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .item-row.ok {
          border-color: #16a34a;
        }

        .item-row.warn {
          border-color: #f59e0b;
        }

        .item-row.exp {
          border-color: #b91c1c;
        }

        .item-row.zero {
          border-color: #64748b;
          opacity: 0.6;
        }

        .item-menu-container {
          position: absolute;
          top: 8px;
          right: 8px;
        }

        .menu-dots {
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0,0,0,0.08);
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
          opacity: 0;
        }

        .item-row:hover .menu-dots {
          opacity: 1;
        }

        .menu-dots:hover {
          background: #fff;
          color: #b91c1c;
          transform: scale(1.1);
        }

        .item-menu-dropdown {
          position: absolute;
          top: 32px;
          right: 0;
          background: rgba(255,255,255,0.98);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          min-width: 140px;
          display: none;
          flex-direction: column;
          z-index: 100;
        }

        .item-menu-dropdown.show {
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
          font-family: inherit;
        }

        .menu-item:first-child {
          border-radius: 8px 8px 0 0;
        }

        .menu-item:last-child {
          border-radius: 0 0 8px 8px;
        }

        .menu-item:hover {
          background: #f3f4f6;
          color: #b91c1c;
        }

        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .item-name {
          font-weight: 700;
          font-size: 1.05rem;
          margin-bottom: 0.25rem;
        }

        .item-category {
          font-size: 0.9rem;
          color: #64748b;
        }

        .item-qty {
          text-align: right;
        }

        .qty-display {
          font-weight: 700;
          font-size: 0.95rem;
        }

        .qty-display.low {
          color: #2563eb;
        }

        .expiry-date {
          font-size: 0.85rem;
          color: #64748b;
          margin-top: 0.25rem;
        }

        .location-tabs-fixed {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #fff;
          border-top: 1px solid rgba(0,0,0,0.08);
          padding: 12px;
          display: flex;
          gap: 8px;
          justify-content: center;
          z-index: 100;
          box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
        }

        .location-tab {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.08);
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          transition: all 0.2s;
          font-family: inherit;
        }

        .location-tab:hover {
          background: #f9f9f9;
        }

        .location-tab.active {
          background: #b91c1c;
          color: #fff;
          border-color: #b91c1c;
        }

        .empty-state {
          text-align: center;
          padding: 48px 16px;
          color: #64748b;
          background: #fff;
          border-radius: 12px;
        }

        .modal {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-box {
          background: #fff;
          border-radius: 14px;
          max-width: 800px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          padding: 24px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        }

        .modal-box.small {
          max-width: 500px;
        }

        .modal-box h3 {
          margin: 0 0 1rem 0;
          color: #b91c1c;
          font-weight: 800;
        }

        .modal-box h4 {
          margin: 0 0 0.5rem 0;
          color: #1d1d1f;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 12px;
        }

        .form-group label {
          font-weight: 700;
          font-size: 0.9rem;
          color: #374151;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          padding: 10px 12px;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 8px;
          background: #fff;
          font-size: 14px;
          font-family: inherit;
          width: 100%;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
          outline: none;
          border-color: #b91c1c;
          box-shadow: 0 0 0 3px rgba(185,28,28,0.1);
        }

        .item-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 400px;
          overflow-y: auto;
        }

        .item-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 8px;
          transition: all 0.2s;
        }

        .item-card:hover {
          background: #f9f9f9;
        }

        .item-card-info {
          flex: 1;
        }

        .item-card-name {
          font-weight: 700;
          margin-bottom: 4px;
        }

        .item-card-meta {
          font-size: 0.85rem;
          color: #64748b;
        }

        .location-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .location-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 8px;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .status-bar {
            flex-wrap: wrap;
            padding: 12px;
          }

          .user-name {
            order: 2;
            width: 100%;
            text-align: center;
            margin-top: 8px;
          }

          .logo {
            order: 1;
          }

          .status-actions {
            order: 3;
            width: 100%;
            margin-left: 0;
            margin-top: 8px;
            justify-content: space-between;
          }

          .logout-btn {
            flex: 1;
            font-size: 12px;
            padding: 8px 8px;
            min-width: 0;
          }

          .logout-btn svg {
            width: 14px;
            height: 14px;
          }

          .toolbar {
            flex-direction: column;
          }

          .search-box {
            width: 100%;
            min-width: auto;
          }

          .filter-chips {
            justify-content: space-between;
          }

          .chip {
            flex: 1;
            text-align: center;
            justify-content: center;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .item-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .item-qty {
            text-align: left;
          }

          .location-tabs-fixed {
            flex-wrap: wrap;
          }

          .location-tab {
            flex: 1;
            min-width: 100px;
            text-align: center;
          }
        }
      `}</style>
    </>
  )
}
