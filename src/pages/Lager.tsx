import { useState, useEffect } from 'react'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import StatusBar from '../components/StatusBar'


interface InventoryItem {
  id: string
  name: string
  unit: string
  min_stock: number
  notes?: string
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
  unit: string
  min_stock: number
  qty: number
  expiry?: string
  notes?: string
  status: 'ok' | 'warn' | 'exp'
}

interface Transaction {
  id: string
  item_id: string
  location_id: string
  type: string
  quantity: number
  expiry_date?: string
  note?: string
  user: string
  created: string
  expand?: {
    item_id?: InventoryItem
    location_id?: Location
  }
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

interface Audit {
  id: string
  audit_date: string
  status: string
  user: string
  location_id?: string
  organization_id: string
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
  
  const [showLogModal, setShowLogModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showItemsModal, setShowItemsModal] = useState(false)
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  const [showBuchungModal, setShowBuchungModal] = useState(false)
  const [buchungType, setBuchungType] = useState<'ein' | 'aus'>('ein')
  
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  
  const [itemFormData, setItemFormData] = useState({
    name: '',
    unit: 'Stück',
    min_stock: 0
  })
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  
  const [newLocationName, setNewLocationName] = useState('')
  
  // Log/Transaction state
  const [transactions, setTransactions] = useState<Transaction[]>([])
  
  // Inventur state
  const [inventoryTab, setInventoryTab] = useState<'new' | 'history' | 'schedule'>('new')
  const [currentAudit, setCurrentAudit] = useState<Audit | null>(null)
  const [auditItems, setAuditItems] = useState<AuditItem[]>([])
  const [auditIndex, setAuditIndex] = useState(0)
  const [auditLocationId, setAuditLocationId] = useState<string | null>(null)
  const [auditHistory, setAuditHistory] = useState<Audit[]>([])
  const [openAudits, setOpenAudits] = useState<Audit[]>([])
  const [selectedHistoryAudit, setSelectedHistoryAudit] = useState<Audit | null>(null)
  const [historyAuditItems, setHistoryAuditItems] = useState<AuditItem[]>([])
  const [inventurSchedule, setInventurSchedule] = useState<{interval: string}>(() => {
    const saved = localStorage.getItem('lager_inventur_schedule')
    return saved ? JSON.parse(saved) : { interval: 'monthly' }
  })
  
  // Buchung state
  const [selectedBuchungItem, setSelectedBuchungItem] = useState<string>('')
  const [buchungQty, setBuchungQty] = useState(1)
  const [buchungExpiry, setBuchungExpiry] = useState('')
  const [buchungBatch, setBuchungBatch] = useState('')

  // Item detail state
  const [showItemDetailModal, setShowItemDetailModal] = useState(false)
  const [detailItem, setDetailItem] = useState<DisplayItem | null>(null)
  const [detailTransactions, setDetailTransactions] = useState<Transaction[]>([])
  const [detailStockEntries, setDetailStockEntries] = useState<StockItem[]>([])
  const [detailNote, setDetailNote] = useState('')
  const [detailSoll, setDetailSoll] = useState(0)
  const [detailExpiry, setDetailExpiry] = useState('')
  const [detailLoadingData, setDetailLoadingData] = useState(false)

  // Multi-buchung state
  const [showMultiBuchungModal, setShowMultiBuchungModal] = useState(false)
  const [multiBuchungItems, setMultiBuchungItems] = useState<Array<{itemId: string, qty: number, expiry: string}>>([])
  const [multiBuchungType, setMultiBuchungType] = useState<'ein' | 'aus'>('ein')
  const [multiBuchungNewItemId, setMultiBuchungNewItemId] = useState('')
  const [multiBuchungNewQty, setMultiBuchungNewQty] = useState(1)
  const [multiBuchungNewExpiry, setMultiBuchungNewExpiry] = useState('')

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
          unit: item.unit,
          min_stock: item.min_stock,
          qty: 0,
          expiry: undefined,
          notes: item.notes,
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
        status: computeStatus(item.expiry, item.qty, item.min_stock)
      }))

      setDisplayItems(items_list)
      
    } catch(e: any) {
      console.error('Error loading stock:', e)
      setError('Fehler beim Laden: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function computeStatus(expiry?: string, qty?: number, min_stock?: number): 'ok' | 'warn' | 'exp' {
    if (expiry) {
      const today = new Date()
      const expiryDate = new Date(expiry)
      const diffDays = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays < 0) return 'exp'
      if (diffDays < 30) return 'warn'
    }
    if (min_stock && min_stock > 0 && qty !== undefined && qty < min_stock) return 'warn'
    return 'ok'
  }

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  // LOG FUNKTIONEN
  async function loadTransactions() {
    try {
      const txns = await pb.collection('inventory_transactions').getFullList<Transaction>({
        filter: `organization_id = "${user?.organization_id}"`,
        expand: 'item_id,location_id',
        sort: '-created',
        limit: 100
      })
      
      setTransactions(txns)
    } catch(e: any) {
      console.error('Error loading transactions:', e)
    }
  }

  async function adjustQty(itemId: string, delta: number, expiryParam?: string) {
    const item = displayItems.find(it => it.id === itemId)
    if (!item) return

    if (delta < 0 && item.qty + delta < 0) {
      alert('Nicht genügend Bestand')
      return
    }

    try {
      const stockList = await pb.collection('inventory_stock').getFullList({
        filter: `item_id = "${itemId}" && location_id = "${currentLocationId}"`,
        sort: 'expiry_date'
      })

      if (delta > 0) {
        const expiry = expiryParam || null
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
      setItemFormData({ name: '', unit: 'Stück', min_stock: 0 })
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
  async function loadAuditHistory() {
    try {
      const audits = await pb.collection('inventory_audits').getFullList<Audit>({
        filter: `organization_id = "${user?.organization_id}" && status = "abgeschlossen"`,
        sort: '-audit_date',
        limit: 200
      })
      setAuditHistory(audits)
    } catch(e: any) {
      console.error('Error loading audit history:', e)
    }
  }

  async function loadOpenAudits() {
    try {
      const audits = await pb.collection('inventory_audits').getFullList<Audit>({
        filter: `organization_id = "${user?.organization_id}" && status = "offen"`,
        sort: '-audit_date'
      })
      setOpenAudits(audits)
    } catch(e: any) {
      console.error('Error loading open audits:', e)
    }
  }

  async function resumeAudit(audit: Audit) {
    const locId = audit.location_id || currentLocationId || ''
    setAuditLocationId(locId)
    setCurrentAudit(audit)
    await loadAuditItems(audit.id, locId)
    setInventoryTab('new')
  }

  async function loadHistoryAuditItems(auditId: string) {
    try {
      const items = await pb.collection('inventory_audit_items').getFullList<AuditItem>({
        filter: `audit_id = "${auditId}"`,
        expand: 'item_id',
        sort: 'created'
      })
      setHistoryAuditItems(items)
    } catch(e: any) {
      console.error('Error loading history audit items:', e)
    }
  }

  function saveSchedule() {
    localStorage.setItem('lager_inventur_schedule', JSON.stringify(inventurSchedule))
    showMsg('✅ Zeitplan gespeichert!', 'success')
  }

  function getNextDueDateForLocation(locationId: string): Date | null {
    if (inventurSchedule.interval === 'disabled') return null
    const lastAudit = auditHistory
      .filter(a => a.location_id === locationId)
      .sort((a, b) => new Date(b.audit_date).getTime() - new Date(a.audit_date).getTime())[0]
    if (!lastAudit) return null
    const next = new Date(lastAudit.audit_date)
    if (inventurSchedule.interval === 'weekly')    next.setDate(next.getDate() + 7)
    if (inventurSchedule.interval === 'monthly')   next.setMonth(next.getMonth() + 1)
    if (inventurSchedule.interval === 'quarterly') next.setMonth(next.getMonth() + 3)
    if (inventurSchedule.interval === 'biannual')  next.setMonth(next.getMonth() + 6)
    if (inventurSchedule.interval === 'annual')    next.setFullYear(next.getFullYear() + 1)
    return next
  }

  async function startInventur(locationId: string) {
    if (!locationId) return

    try {
      const [itemsList, stockData] = await Promise.all([
        pb.collection('inventory_items').getFullList<InventoryItem>({
          filter: `organization_id = "${user?.organization_id}"`,
          sort: 'name'
        }),
        pb.collection('inventory_stock').getFullList<StockItem>({
          filter: `location_id = "${locationId}" && organization_id = "${user?.organization_id}"`
        })
      ])

      const qtyMap = new Map<string, number>()
      for (const s of stockData) {
        qtyMap.set(s.item_id, (qtyMap.get(s.item_id) || 0) + (s.quantity || 0))
      }

      const audit = await pb.collection('inventory_audits').create({
        audit_date: new Date().toISOString(),
        status: 'offen',
        user: user?.email || user?.name || user?.id,
        location_id: locationId,
        organization_id: user?.organization_id
      })

      const itemsToAudit = itemsList.filter(item => (qtyMap.get(item.id) || 0) > 0)
      for (const item of itemsToAudit) {
        await pb.collection('inventory_audit_items').create({
          audit_id: audit.id,
          item_id: item.id,
          location_id: locationId,
          expected_quantity: qtyMap.get(item.id) || 0,
          actual_quantity: 0,
          checked: false,
          organization_id: user?.organization_id
        })
      }

      setAuditLocationId(locationId)
      setCurrentAudit(audit)
      await loadAuditItems(audit.id, locationId)
      setAuditIndex(0)
      showMsg('✅ Inventur gestartet!', 'success')

    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function loadAuditItems(auditId: string, locationId?: string) {
    const locId = locationId || currentLocationId
    try {
      const items = await pb.collection('inventory_audit_items').getFullList<AuditItem>({
        filter: `audit_id = "${auditId}" && location_id = "${locId}"`,
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
    const locId = auditLocationId || currentLocationId

    try {
      await pb.collection('inventory_audit_items').update(auditItem.id, {
        actual_quantity: actual,
        checked: checked
      })

      if (checked && actual !== auditItem.expected_quantity) {
        const diff = actual - auditItem.expected_quantity

        const stockList = await pb.collection('inventory_stock').getFullList({
          filter: `item_id = "${auditItem.item_id}" && location_id = "${locId}"`
        })

        if (diff > 0) {
          await pb.collection('inventory_stock').create({
            item_id: auditItem.item_id,
            location_id: locId,
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
          location_id: locId,
          type: 'korrektur',
          quantity: diff,
          note: `Inventur-Korrektur: ${auditItem.expected_quantity} → ${actual}`,
          user: user?.email || user?.id,
          organization_id: user?.organization_id
        })
      }

      if (auditIndex < auditItems.length - 1) {
        setAuditIndex(auditIndex + 1)
        await loadAuditItems(currentAudit.id, locId)
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
      
      setCurrentAudit(null)
      setAuditItems([])
      setAuditIndex(0)
      setAuditLocationId(null)
      setInventoryTab('new')
      await loadAuditHistory()
      await loadOpenAudits()
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
      await adjustQty(selectedBuchungItem, delta, buchungExpiry || undefined)
      setShowBuchungModal(false)
      setSelectedBuchungItem('')
      setBuchungQty(1)
      setBuchungExpiry('')
      setBuchungBatch('')
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function saveMultiBuchung() {
    if (multiBuchungItems.length === 0) {
      alert('Keine Artikel hinzugefügt')
      return
    }
    for (const entry of multiBuchungItems) {
      const delta = multiBuchungType === 'ein' ? entry.qty : -entry.qty
      await adjustQty(entry.itemId, delta, entry.expiry || undefined)
    }
    setShowMultiBuchungModal(false)
    setMultiBuchungItems([])
    setMultiBuchungNewItemId('')
    setMultiBuchungNewQty(1)
    setMultiBuchungNewExpiry('')
  }

  async function openItemDetail(item: DisplayItem) {
    setDetailItem(item)
    setDetailNote(item.notes || '')
    setDetailSoll(item.min_stock)
    setDetailExpiry(item.expiry ? item.expiry.slice(0, 10) : '')
    setDetailTransactions([])
    setDetailStockEntries([])
    setShowItemDetailModal(true)
    setDetailLoadingData(true)
    try {
      const [txns, stocks] = await Promise.all([
        pb.collection('inventory_transactions').getFullList<Transaction>({
          filter: `item_id = "${item.id}"`,
          sort: '-created',
          limit: 50
        }),
        pb.collection('inventory_stock').getFullList<StockItem>({
          filter: `item_id = "${item.id}" && location_id = "${currentLocationId}"`,
          sort: 'expiry_date'
        })
      ])
      setDetailTransactions(txns)
      setDetailStockEntries(stocks)
    } catch(e: any) {
      console.error('Error loading item detail:', e)
    } finally {
      setDetailLoadingData(false)
    }
  }

  async function reloadDetailStocks() {
    if (!detailItem) return
    const stocks = await pb.collection('inventory_stock').getFullList<StockItem>({
      filter: `item_id = "${detailItem.id}" && location_id = "${currentLocationId}"`,
      sort: 'expiry_date'
    })
    setDetailStockEntries(stocks)
    // Sync qty back to detailItem
    const newQty = stocks.reduce((s, st) => s + (st.quantity || 0), 0)
    setDetailItem(prev => prev ? { ...prev, qty: newQty } : null)
    setDisplayItems(prev => prev.map(i => i.id === detailItem.id ? { ...i, qty: newQty } : i))
  }

  async function saveItemDetail() {
    if (!detailItem) return
    try {
      const updated = await pb.collection('inventory_items').update(detailItem.id, {
        min_stock: detailSoll,
        notes: detailNote
      })
      if (Number(updated.min_stock) !== detailSoll) {
        alert(`PocketBase hat min_stock nicht gespeichert!\nGesendet: ${detailSoll}\nZurückbekommen: ${updated.min_stock}\n\nBitte im PocketBase Admin das Feld "min_stock" (Typ: Number) in der inventory_items Collection anlegen.`)
        return
      }
      // Save expiry date on all stock entries for this item/location
      const stocks = await pb.collection('inventory_stock').getFullList({
        filter: `item_id = "${detailItem.id}" && location_id = "${currentLocationId}"`
      })
      for (const s of stocks) {
        await pb.collection('inventory_stock').update(s.id, { expiry_date: detailExpiry || null })
      }
      await loadStock()
      setDetailItem(prev => prev ? { ...prev, notes: detailNote, min_stock: detailSoll, expiry: detailExpiry || undefined } : null)
      showMsg('✅ Gespeichert!', 'success')
    } catch(e: any) {
      const detail = e?.data ? JSON.stringify(e.data) : e.message
      alert(`Fehler: ${detail}`)
    }
  }

  function exportPDF() {
    const location = locations.find(l => l.id === currentLocationId)
    const locName = location?.name || 'Lager'
    const date = new Date().toLocaleDateString('de-DE')
    const rows = displayItems
      .filter(i => i.qty > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(item => `
        <tr>
          <td>${item.name}</td>
          <td style="text-align:center">${item.qty} ${item.unit}</td>
          <td style="text-align:center">${item.min_stock || '—'}</td>
          <td style="text-align:center">${item.expiry ? new Date(item.expiry).toLocaleDateString('de-DE') : '—'}</td>
        </tr>
      `).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Bestand ${locName} – ${date}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .sub { color: #555; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #b91c1c; color: #fff; padding: 8px 10px; text-align: left; }
        td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) td { background: #f9fafb; }
      </style></head><body>
      <h1>Bestandsliste – ${locName}</h1>
      <div class="sub">Erstellt am ${date}</div>
      <table>
        <thead><tr><th>Artikel</th><th>Bestand</th><th>SOLL</th><th>Ablaufdatum</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  const filteredItems = displayItems.filter(item => {
    if (item.qty === 0 && !showZeroOnly) return false

    if (searchQuery) {
      const needle = searchQuery.toLowerCase()
      if (!item.name.toLowerCase().includes(needle)) {
        return false
      }
    }

    if (statusFilter === 'expired' && item.status !== 'exp') return false
    if (statusFilter === 'warning' && item.status !== 'warn') return false
    if (showLowOnly && item.qty >= item.min_stock) return false
    if (showZeroOnly && item.qty !== 0) return false

    return true
  })

  const activeItems = displayItems.filter(i => i.qty > 0)
  const stats = {
    ok: activeItems.filter(i => i.status === 'ok').length,
    warn: activeItems.filter(i => i.status === 'warn').length,
    exp: activeItems.filter(i => i.status === 'exp').length,
    total: activeItems.length
  }

  if (authLoading) {
    return null
  }
  return (
    <>
          {/* STATUSBAR WIE FILES - NUR LOGO, LAGER, HUB */}
      <StatusBar user={user} onLogout={logout} pageName="Lager" showHubLink={true} />
      
      {/* ICON-TOOLBAR UNTER STATUSBAR */}
      <div className="action-toolbar">
        <button className="action-btn" onClick={() => { loadTransactions(); setShowLogModal(true) }} title="Logbuch">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>
        <button className="action-btn" onClick={() => setShowItemsModal(true)} title="Artikel-Datenbank">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
          </svg>
        </button>
        <button className="action-btn" onClick={() => { setBuchungType('ein'); setShowBuchungModal(true) }} title="Einbuchen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <button className="action-btn" onClick={() => { setBuchungType('aus'); setShowBuchungModal(true) }} title="Ausbuchen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <button className="action-btn" onClick={() => { setMultiBuchungType('ein'); setShowMultiBuchungModal(true) }} title="Mehrfachbuchung">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="5" rx="1"/>
            <rect x="14" y="3" width="7" height="5" rx="1"/>
            <rect x="3" y="13" width="7" height="5" rx="1"/>
            <rect x="14" y="13" width="7" height="5" rx="1"/>
            <line x1="17.5" y1="19" x2="17.5" y2="23"/><line x1="15.5" y1="21" x2="19.5" y2="21"/>
          </svg>
        </button>
        <button className="action-btn" onClick={exportPDF} title="PDF Export">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9 15 12 18 15 15"/>
          </svg>
        </button>
        <button className="action-btn" onClick={() => { loadAuditHistory(); loadOpenAudits(); setShowInventoryModal(true) }} title="Inventur">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            <path d="M9 12h6m-6 4h6"/>
          </svg>
        </button>
        <button className="action-btn" onClick={() => setShowSettingsModal(true)} title="Einstellungen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
          </svg>
        </button>
      </div>
      
      {message && (
        <div className={`toast toast-${message.type}`}>{message.text}</div>
      )}

      <div className="content">
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
                  onClick={() => openItemDetail(item)}
                  style={{cursor: 'pointer'}}
                >
                  <div className="item-header">
                    <div className="item-info">
                      <div className="item-name">{item.name}</div>
                      {item.notes && (
                        <div className="item-category" style={{fontStyle: 'italic'}}>{item.notes}</div>
                      )}
                    </div>
                    <div className="item-right">
                      <div className="item-qty">
                        <div className={`qty-display ${isLow ? 'low' : ''}`}>
                          {item.qty}{item.min_stock > 0 ? ` / ${item.min_stock}` : ''} {item.unit}
                        </div>
                        {item.expiry && (
                          <div className="expiry-date">
                            Ablaufdatum: {new Date(item.expiry).toLocaleDateString('de-DE')}
                          </div>
                        )}
                      </div>
                      <div className="item-quick-btns">
                        <button
                          className="quick-btn minus"
                          onClick={(e) => { e.stopPropagation(); adjustQty(item.id, -1) }}
                          title="Ausbuchen (-1)"
                        >−</button>
                        <button
                          className="quick-btn plus"
                          onClick={(e) => {
                            e.stopPropagation()
                            adjustQty(item.id, 1, '')
                          }}
                          title="Einbuchen (+1)"
                        >+</button>
                      </div>
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

      {/* LOGBUCH MODAL */}
      {showLogModal && (
        <div className="modal" onClick={() => setShowLogModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Logbuch - Alle Transaktionen</h3>
            
            <div className="log-list">
              {transactions.length === 0 ? (
                <div className="empty-state">Keine Transaktionen vorhanden</div>
              ) : (
                transactions.map(txn => (
                  <div key={txn.id} className="log-entry">
                    <div className="log-header">
                      <div className="log-date">
                        {new Date(txn.created).toLocaleString('de-DE')}
                      </div>
                      <div className={`log-type ${txn.type}`}>
                        {txn.type === 'einbuchung' ? '➕ Einbuchung' : 
                         txn.type === 'ausbuchung' ? '➖ Ausbuchung' : 
                         '✏️ Korrektur'}
                      </div>
                    </div>
                    <div className="log-details">
                      <div><strong>Artikel:</strong> {txn.expand?.item_id?.name || 'Unbekannt'}</div>
                      <div><strong>Standort:</strong> {txn.expand?.location_id?.name || 'Unbekannt'}</div>
                      <div><strong>Menge:</strong> {txn.quantity > 0 ? '+' : ''}{txn.quantity} {txn.expand?.item_id?.unit || 'Stück'}</div>
                      <div><strong>Benutzer:</strong> {txn.user}</div>
                      {txn.note && <div><strong>Notiz:</strong> {txn.note}</div>}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '24px'}}>
              <button className="btn" onClick={() => setShowLogModal(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARTIKEL-DATENBANK MODAL */}
      {showItemsModal && (
        <div className="modal" onClick={() => setShowItemsModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Artikel-Datenbank</h3>
            
            <button 
              className="btn primary" 
              style={{width: '100%', marginBottom: '16px'}}
              onClick={() => {
                setItemFormData({ name: '', unit: 'Stück', min_stock: 0 })
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
                        {item.unit || 'Stück'} • SOLL: {item.min_stock || 0}
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '8px'}}>
                      <button 
                        className="btn-small"
                        onClick={() => {
                          setItemFormData({
                            name: item.name,
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

      {/* EINSTELLUNGEN MODAL */}
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

      {/* INVENTUR MODAL MIT TABS */}
      {showInventoryModal && (
        <div className="modal" onClick={() => setShowInventoryModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Inventur</h3>

            {/* TABS */}
            <div className="tabs">
              <button className={`tab ${inventoryTab === 'new' ? 'active' : ''}`} onClick={() => setInventoryTab('new')}>
                Inventur
              </button>
              <button className={`tab ${inventoryTab === 'history' ? 'active' : ''}`} onClick={() => { setInventoryTab('history'); loadAuditHistory() }}>
                Historie
              </button>
              <button className={`tab ${inventoryTab === 'schedule' ? 'active' : ''}`} onClick={() => setInventoryTab('schedule')}>
                Zeitplan
              </button>
            </div>

            {/* TAB: INVENTUR – alle Lager */}
            {inventoryTab === 'new' && (
              currentAudit ? (
                /* Aktive Zählung */
                <div>
                  <div style={{background: '#f0f9ff', padding: '12px', borderRadius: '8px', marginBottom: '16px'}}>
                    <div style={{fontWeight: 700, fontSize: '0.9rem', color: '#0369a1', marginBottom: '2px'}}>
                      {locations.find(l => l.id === auditLocationId)?.name || 'Lager'}
                    </div>
                    <span><strong>Fortschritt:</strong> {auditItems.filter(ai => ai.checked).length} / {auditItems.length} geprüft</span>
                  </div>

                  {auditIndex < auditItems.length && (
                    <div>
                      <div style={{background: '#fafafa', padding: '16px', borderRadius: '8px', marginBottom: '16px'}}>
                        <h4 style={{margin: '0 0 8px 0'}}>{auditIndex + 1}. {auditItems[auditIndex]?.expand?.item_id?.name}</h4>
                        <div style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px'}}>
                          {auditItems[auditIndex]?.expand?.item_id?.unit || 'Stück'}
                        </div>

                        <div style={{background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', marginBottom: '12px'}}>
                          <div style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>Erwarteter Bestand (laut System):</div>
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
                        <button className="btn" onClick={() => setAuditIndex(Math.max(0, auditIndex - 1))} disabled={auditIndex === 0}>
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
              ) : (
                /* Übersicht aller Lager */
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  {locations.map(loc => {
                    const openAudit = openAudits.find(a => a.location_id === loc.id)
                    const lastAudit = auditHistory
                      .filter(a => a.location_id === loc.id)
                      .sort((a, b) => new Date(b.audit_date).getTime() - new Date(a.audit_date).getTime())[0]
                    const nextDue = getNextDueDateForLocation(loc.id)
                    const neverAudited = !lastAudit && inventurSchedule.interval !== 'disabled'
                    const isOverdue = neverAudited || (nextDue !== null && nextDue < new Date())

                    return (
                      <div key={loc.id} style={{
                        background: '#fafafa', borderRadius: '12px', padding: '16px',
                        border: `1px solid ${isOverdue ? '#fecaca' : '#e5e7eb'}`,
                        borderLeft: `4px solid ${isOverdue ? '#b91c1c' : openAudit ? '#f59e0b' : '#e5e7eb'}`
                      }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                          <div style={{fontWeight: 700, fontSize: '1rem'}}>{loc.name}</div>
                          <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
                            {openAudit && (
                              <span style={{fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '999px', fontWeight: 700}}>
                                Offen
                              </span>
                            )}
                            {isOverdue && (
                              <span style={{fontSize: '0.75rem', background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '999px', fontWeight: 700}}>
                                Überfällig
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{fontSize: '0.85rem', color: '#64748b', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '2px'}}>
                          <div>
                            Letzte Inventur:{' '}
                            {lastAudit
                              ? `${new Date(lastAudit.audit_date).toLocaleDateString('de-DE')} · ${lastAudit.user}`
                              : 'Noch nie durchgeführt'}
                          </div>
                          {inventurSchedule.interval !== 'disabled' && (
                            <div style={{color: isOverdue ? '#b91c1c' : '#64748b'}}>
                              Nächste fällig:{' '}
                              {neverAudited ? 'Sofort' : nextDue?.toLocaleDateString('de-DE')}
                            </div>
                          )}
                        </div>

                        <div style={{display: 'flex', gap: '8px'}}>
                          {openAudit && (
                            <button className="btn primary" onClick={() => resumeAudit(openAudit)}>
                              Weiterführen
                            </button>
                          )}
                          <button className="btn" onClick={() => startInventur(loc.id)}>
                            {openAudit ? 'Neu starten' : 'Inventur starten'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* TAB: HISTORIE */}
            {inventoryTab === 'history' && (
              <div>
                {selectedHistoryAudit ? (
                  <div>
                    <button className="btn" style={{marginBottom: '16px'}} onClick={() => { setSelectedHistoryAudit(null); setHistoryAuditItems([]) }}>
                      ← Zurück zur Liste
                    </button>
                    <div style={{fontWeight: 700, marginBottom: '2px'}}>{new Date(selectedHistoryAudit.audit_date).toLocaleString('de-DE')}</div>
                    <div style={{fontSize: '0.85rem', color: '#64748b', marginBottom: '4px'}}>
                      {locations.find(l => l.id === selectedHistoryAudit.location_id)?.name || 'Unbekannter Standort'}
                    </div>
                    <div style={{fontSize: '0.85rem', color: '#64748b', marginBottom: '16px'}}>von {selectedHistoryAudit.user}</div>

                    {historyAuditItems.length === 0 ? (
                      <div style={{color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '24px'}}>Keine Einträge gefunden</div>
                    ) : (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto'}}>
                        {historyAuditItems.map(ai => {
                          const diff = ai.actual_quantity - ai.expected_quantity
                          const hasDiff = diff !== 0
                          return (
                            <div key={ai.id} style={{
                              padding: '10px 12px', borderRadius: '8px',
                              background: hasDiff ? (diff > 0 ? '#f0fdf4' : '#fef2f2') : '#f9fafb',
                              borderLeft: `3px solid ${hasDiff ? (diff > 0 ? '#16a34a' : '#b91c1c') : '#e5e7eb'}`,
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                              <div>
                                <div style={{fontWeight: 700, fontSize: '0.9rem'}}>{ai.expand?.item_id?.name || ai.item_id}</div>
                                <div style={{fontSize: '0.8rem', color: '#64748b'}}>
                                  Erwartet: {ai.expected_quantity} → Gezählt: {ai.actual_quantity}
                                </div>
                              </div>
                              {hasDiff ? (
                                <span style={{fontWeight: 700, fontSize: '0.9rem', color: diff > 0 ? '#16a34a' : '#b91c1c'}}>
                                  {diff > 0 ? '+' : ''}{diff}
                                </span>
                              ) : (
                                <span style={{fontSize: '0.8rem', color: '#64748b'}}>✓</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="audit-history-list">
                    {auditHistory.length === 0 ? (
                      <div className="empty-state">Keine Inventuren vorhanden</div>
                    ) : (
                      auditHistory.map(audit => (
                        <div
                          key={audit.id}
                          className="audit-card"
                          style={{cursor: 'pointer'}}
                          onClick={() => { setSelectedHistoryAudit(audit); loadHistoryAuditItems(audit.id) }}
                        >
                          <div className="audit-card-header">
                            <div className="audit-date">{new Date(audit.audit_date).toLocaleString('de-DE')}</div>
                            <div className="audit-status abgeschlossen">✓ Abgeschlossen</div>
                          </div>
                          <div className="audit-user">
                            <strong>{locations.find(l => l.id === audit.location_id)?.name || 'Standort'}</strong>
                            {' · '}{audit.user}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: ZEITPLAN */}
            {inventoryTab === 'schedule' && (
              <div>
                <div className="form-group">
                  <label>Inventur-Intervall (gilt für alle Standorte)</label>
                  <select value={inventurSchedule.interval} onChange={(e) => setInventurSchedule({ interval: e.target.value })}>
                    <option value="disabled">Deaktiviert</option>
                    <option value="weekly">Wöchentlich</option>
                    <option value="monthly">Monatlich</option>
                    <option value="quarterly">Vierteljährlich</option>
                    <option value="biannual">Halbjährlich</option>
                    <option value="annual">Jährlich</option>
                  </select>
                </div>

                {inventurSchedule.interval !== 'disabled' && (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px'}}>
                    <div style={{fontWeight: 700, fontSize: '0.85rem', color: '#374151'}}>Fälligkeiten je Standort:</div>
                    {locations.map(loc => {
                      const nextDue = getNextDueDateForLocation(loc.id)
                      const lastAudit = auditHistory
                        .filter(a => a.location_id === loc.id)
                        .sort((a, b) => new Date(b.audit_date).getTime() - new Date(a.audit_date).getTime())[0]
                      const neverAudited = !lastAudit
                      const isOverdue = neverAudited || (nextDue !== null && nextDue < new Date())
                      return (
                        <div key={loc.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 12px', borderRadius: '8px',
                          background: isOverdue ? '#fef2f2' : '#f0fdf4',
                          border: `1px solid ${isOverdue ? '#fecaca' : '#bbf7d0'}`
                        }}>
                          <div style={{fontWeight: 700, fontSize: '0.9rem'}}>{loc.name}</div>
                          <div style={{textAlign: 'right', fontSize: '0.85rem'}}>
                            {neverAudited ? (
                              <span style={{color: '#b91c1c', fontWeight: 700}}>Noch nie – sofort fällig</span>
                            ) : (
                              <span style={{color: isOverdue ? '#b91c1c' : '#166534', fontWeight: 600}}>
                                {nextDue?.toLocaleDateString('de-DE')}
                                {isOverdue && ' ⚠ Überfällig'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <button className="btn primary" style={{width: '100%'}} onClick={saveSchedule}>
                  Speichern
                </button>
              </div>
            )}

            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '24px'}}>
              <button className="btn" onClick={() => {
                setShowInventoryModal(false)
                setCurrentAudit(null)
                setAuditItems([])
                setAuditLocationId(null)
                setSelectedHistoryAudit(null)
                setHistoryAuditItems([])
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
                    {item.name}
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
              <div className="form-group">
                <label>Ablaufdatum (optional)</label>
                <input
                  type="date"
                  value={buchungExpiry}
                  onChange={(e) => setBuchungExpiry(e.target.value)}
                />
              </div>
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

      {/* ARTIKEL DETAIL MODAL */}
      {showItemDetailModal && detailItem && (
        <div className="modal" onClick={() => setShowItemDetailModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px'}}>
              <h3 style={{margin: 0}}>{detailItem.name}</h3>
              <span style={{
                background: detailItem.status === 'exp' ? '#fee2e2' : detailItem.status === 'warn' ? '#fef3c7' : '#dcfce7',
                color: detailItem.status === 'exp' ? '#b91c1c' : detailItem.status === 'warn' ? '#92400e' : '#15803d',
                padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700
              }}>
                {detailItem.status === 'exp' ? 'Abgelaufen' : detailItem.status === 'warn' ? 'Achtung' : 'In Ordnung'}
              </span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
              <div style={{color: '#64748b', fontSize: '0.9rem'}}>
                IST: <strong style={{color: 'var(--text)', fontSize: '1.1rem'}}>{detailItem.qty}</strong> {detailItem.unit}
                {detailItem.min_stock > 0 && (
                  <span style={{marginLeft: '8px', color: '#64748b'}}>/ SOLL: {detailItem.min_stock}</span>
                )}
              </div>
              <div style={{display: 'flex', gap: '8px', marginLeft: 'auto'}}>
                <button
                  className="quick-btn minus"
                  onClick={async () => { await adjustQty(detailItem.id, -1); await reloadDetailStocks(); await loadStock() }}
                  title="Ausbuchen (-1)"
                >−</button>
                <button
                  className="quick-btn plus"
                  onClick={async () => { await adjustQty(detailItem.id, 1, ''); await reloadDetailStocks(); await loadStock() }}
                  title="Einbuchen (+1)"
                >+</button>
              </div>
            </div>

            {/* SOLL, Bemerkung & Ablaufdatum */}
            <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px'}}>
              <div className="form-group" style={{marginBottom: 0}}>
                <label>SOLL (Mindestbestand)</label>
                <input
                  type="number"
                  value={detailSoll}
                  onChange={(e) => setDetailSoll(parseInt(e.target.value) || 0)}
                  min="0"
                />
              </div>
              <div className="form-group" style={{marginBottom: 0}}>
                <label>Bemerkung</label>
                <input
                  type="text"
                  value={detailNote}
                  onChange={(e) => setDetailNote(e.target.value)}
                  placeholder="Freitext..."
                />
              </div>
            </div>
            <div className="form-group" style={{marginBottom: '12px'}}>
              <label>Ablaufdatum</label>
              <input
                type="date"
                value={detailExpiry}
                onChange={(e) => setDetailExpiry(e.target.value)}
              />
            </div>
            <button className="btn primary" style={{width: '100%', marginBottom: '20px'}} onClick={saveItemDetail}>
              Speichern
            </button>

            {/* Transaction history */}
            <div>
              <div style={{fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px', color: '#374151'}}>Verlauf</div>
              <div style={{maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px'}}>
                {detailLoadingData ? (
                  <div style={{color: '#64748b', fontSize: '0.9rem'}}>Lade...</div>
                ) : detailTransactions.length === 0 ? (
                  <div style={{color: '#64748b', fontSize: '0.9rem'}}>Keine Transaktionen</div>
                ) : (
                  detailTransactions.map(txn => (
                    <div key={txn.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', background: '#f9fafb', borderRadius: '8px',
                      borderLeft: `3px solid ${txn.type === 'einbuchung' ? '#16a34a' : txn.type === 'ausbuchung' ? '#b91c1c' : '#f59e0b'}`,
                      fontSize: '0.85rem'
                    }}>
                      <div>
                        <div style={{fontWeight: 600}}>
                          {txn.type === 'einbuchung' ? `+${txn.quantity}` : txn.type === 'ausbuchung' ? `${txn.quantity}` : `Korrektur ${txn.quantity > 0 ? '+' : ''}${txn.quantity}`} {detailItem.unit}
                        </div>
                        {txn.note && <div style={{color: '#64748b', marginTop: '2px'}}>{txn.note}</div>}
                      </div>
                      <div style={{textAlign: 'right', color: '#64748b'}}>
                        <div>{txn.user}</div>
                        <div>{new Date(txn.created).toLocaleDateString('de-DE')}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '20px'}}>
              <button className="btn" onClick={() => setShowItemDetailModal(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* MEHRFACHBUCHUNG MODAL */}
      {showMultiBuchungModal && (
        <div className="modal" onClick={() => setShowMultiBuchungModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Mehrfachbuchung</h3>

            <div className="tabs" style={{marginBottom: '16px'}}>
              <button className={`tab ${multiBuchungType === 'ein' ? 'active' : ''}`} onClick={() => setMultiBuchungType('ein')}>Einbuchen</button>
              <button className={`tab ${multiBuchungType === 'aus' ? 'active' : ''}`} onClick={() => setMultiBuchungType('aus')}>Ausbuchen</button>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'end', marginBottom: '12px'}}>
              <div className="form-group" style={{marginBottom: 0}}>
                <label>Artikel</label>
                <select value={multiBuchungNewItemId} onChange={(e) => setMultiBuchungNewItemId(e.target.value)}>
                  <option value="">-- Artikel wählen --</option>
                  {allItems.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{marginBottom: 0}}>
                <label>Menge</label>
                <input type="number" value={multiBuchungNewQty} onChange={(e) => setMultiBuchungNewQty(parseInt(e.target.value) || 1)} min="1" style={{width: '80px'}} />
              </div>
              {multiBuchungType === 'ein' && (
                <div className="form-group" style={{marginBottom: 0}}>
                  <label>Ablaufdatum</label>
                  <input type="date" value={multiBuchungNewExpiry} onChange={(e) => setMultiBuchungNewExpiry(e.target.value)} style={{width: '140px'}} />
                </div>
              )}
              <button
                className="btn primary"
                style={{alignSelf: 'flex-end'}}
                onClick={() => {
                  if (!multiBuchungNewItemId) return
                  setMultiBuchungItems(prev => [...prev, { itemId: multiBuchungNewItemId, qty: multiBuchungNewQty, expiry: multiBuchungNewExpiry }])
                  setMultiBuchungNewItemId('')
                  setMultiBuchungNewQty(1)
                  setMultiBuchungNewExpiry('')
                }}
              >
                Hinzufügen
              </button>
            </div>

            {multiBuchungItems.length > 0 && (
              <div style={{marginBottom: '16px'}}>
                <div style={{fontWeight: 700, marginBottom: '8px', fontSize: '0.9rem'}}>Buchungsliste:</div>
                {multiBuchungItems.map((entry, idx) => {
                  const item = allItems.find(i => i.id === entry.itemId)
                  return (
                    <div key={idx} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f9fafb', borderRadius: '8px', marginBottom: '4px'}}>
                      <span style={{fontWeight: 600}}>{item?.name || entry.itemId}</span>
                      <span style={{color: '#64748b'}}>{entry.qty} {item?.unit || 'Stück'}{entry.expiry ? ` · ${new Date(entry.expiry).toLocaleDateString('de-DE')}` : ''}</span>
                      <button className="btn-small danger" onClick={() => setMultiBuchungItems(prev => prev.filter((_, i) => i !== idx))}>✕</button>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px'}}>
              <button className="btn" onClick={() => { setShowMultiBuchungModal(false); setMultiBuchungItems([]) }}>Abbrechen</button>
              <button className="btn primary" onClick={saveMultiBuchung} disabled={multiBuchungItems.length === 0}>
                Alle {multiBuchungType === 'ein' ? 'einbuchen' : 'ausbuchen'}
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
            
            <div className="form-group">
              <label>Einheit</label>
              <input
                type="text"
                value={itemFormData.unit}
                onChange={(e) => setItemFormData({...itemFormData, unit: e.target.value})}
              />
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
      
        .action-toolbar {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  padding: 0.5rem 1rem;
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  position: sticky;
  top: 60px;
  z-index: 99;
}


        .action-btn {
          border: 1px solid var(--border);
          background: rgba(0,0,0,0.03);
          color: var(--text);
          padding: 0.5rem;
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
          background: rgba(0,0,0,0.06);
        }

        .action-btn svg {
          flex-shrink: 0;
        }

        .content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem;
          padding-top: 100px;  /* ← DIESE ZEILE ÄNDERN */
          padding-bottom: 100px;
        }


        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }

        .toast {
          position: fixed;
          bottom: 32px;
          right: 24px;
          z-index: 9999;
          padding: 12px 18px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          animation: slideInRight 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          max-width: 320px;
        }

        .toast-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        .toast-error {
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
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-card);
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
          border: 1px solid var(--border);
          background: var(--bg-card);
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
          background: var(--bg-subtle);
        }

        .chip.active {
          background: #fee2e2;
          color: #b91c1c;
          border-color: #b91c1c;
        }

        .btn {
          background: var(--bg-card);
          color: var(--text);
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          transition: all 0.2s;
          font-family: inherit;
          border: 1px solid var(--border);
          font-size: 14px;
        }

        .btn:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
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
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .item-info {
          flex: 1;
          min-width: 0;
        }

        .item-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .item-quick-btns {
          display: flex;
          gap: 6px;
        }

        .quick-btn {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: none;
          font-size: 20px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          line-height: 1;
        }

        .quick-btn.minus {
          background: #fee2e2;
          color: #b91c1c;
        }

        .quick-btn.minus:hover {
          background: #fecaca;
          transform: scale(1.1);
        }

        .quick-btn.plus {
          background: #dcfce7;
          color: #15803d;
        }

        .quick-btn.plus:hover {
          background: #bbf7d0;
          transform: scale(1.1);
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

        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          border-bottom: 2px solid #e5e7eb;
        }

        .tab {
          background: none;
          border: none;
          padding: 10px 16px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95rem;
          color: #64748b;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          font-family: inherit;
        }

        .tab:hover {
          color: #1d1d1f;
        }

        .tab.active {
          color: #b91c1c;
          border-bottom-color: #b91c1c;
        }

        .log-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 500px;
          overflow-y: auto;
        }

        .log-entry {
          background: #fafafa;
          border-radius: 8px;
          padding: 12px;
          border-left: 3px solid #64748b;
        }

        .log-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .log-date {
          font-size: 0.9rem;
          color: #64748b;
          font-weight: 600;
        }

        .log-type {
          font-size: 0.85rem;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .log-type.einbuchung {
          background: #dcfce7;
          color: #166534;
        }

        .log-type.ausbuchung {
          background: #fee2e2;
          color: #b91c1c;
        }

        .log-type.korrektur {
          background: #fef3c7;
          color: #92400e;
        }

        .log-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 0.9rem;
        }

        .audit-history-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 400px;
          overflow-y: auto;
        }

        .audit-card {
          background: #fafafa;
          border-radius: 8px;
          padding: 12px;
          border-left: 3px solid #2563eb;
        }

        .audit-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .audit-date {
          font-weight: 700;
          font-size: 0.95rem;
        }

        .audit-status {
          font-size: 0.85rem;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .audit-status.abgeschlossen {
          background: #dcfce7;
          color: #166534;
        }

        .audit-status.offen {
          background: #fef3c7;
          color: #92400e;
        }

        .audit-user {
          font-size: 0.9rem;
          color: #64748b;
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

          /* Toolbar: eine Zeile, kleinere Buttons */
          .action-toolbar {
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            justify-content: flex-start;
            gap: 0.3rem;
            padding: 0.35rem 0.75rem;
          }
          .action-toolbar::-webkit-scrollbar { display: none; }

          .action-btn {
            flex-shrink: 0;
            min-width: 38px;
            height: 38px;
          }

          .action-btn svg {
            width: 16px;
            height: 16px;
          }

          /* Content: kompaktes Padding, Platz für Tabs unten */
          .content {
            padding-top: 106px;
            padding-left: 12px;
            padding-right: 12px;
            padding-bottom: 76px;
          }

          /* Toast über den Standort-Tabs */
          .toast {
            bottom: 72px;
            right: 12px;
            max-width: calc(100vw - 24px);
          }

          /* Stats */
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 12px;
          }

          .stat-card { padding: 12px 14px; border-radius: 10px; }
          .stat-num { font-size: 1.2rem; }

          /* Suche + Filter */
          .toolbar {
            flex-direction: column;
            gap: 8px;
            margin-bottom: 12px;
          }

          .search-box { width: 100%; min-width: auto; }

          .filter-chips {
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            gap: 6px;
          }
          .filter-chips::-webkit-scrollbar { display: none; }

          .chip {
            flex-shrink: 0;
            font-size: 0.8rem;
            padding: 6px 10px;
          }

          /* Artikel-Karten: horizontal kompakt */
          .item-row { padding: 0.7rem 0.85rem; }

          .item-header {
            flex-direction: row;
            align-items: center;
            flex-wrap: nowrap;
            gap: 8px;
          }

          .item-info {
            flex: 1;
            min-width: 0;
          }

          .item-name {
            font-size: 0.9rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .item-category { font-size: 0.8rem; }

          .item-right {
            flex-shrink: 0;
            gap: 8px;
          }

          .item-qty { text-align: right; }
          .qty-display { font-size: 0.88rem; }
          .expiry-date { font-size: 0.75rem; }

          .quick-btn { width: 30px; height: 30px; font-size: 17px; }

          /* Modals: Bottom-Sheet */
          .modal {
            align-items: flex-end;
            padding: 0;
          }

          .modal-box {
            border-radius: 20px 20px 0 0;
            max-height: 92vh;
            padding: 20px 16px;
            padding-bottom: calc(16px + env(safe-area-inset-bottom));
            max-width: 100%;
          }

          .modal-box.small { max-width: 100%; }

          /* Standort-Tabs */
          .location-tabs-fixed {
            flex-wrap: nowrap;
            overflow-x: auto;
            justify-content: flex-start;
            padding: 8px 12px;
            gap: 6px;
          }
          .location-tabs-fixed::-webkit-scrollbar { display: none; }

          .location-tab {
            flex-shrink: 0;
            padding: 8px 14px;
            font-size: 13px;
            min-width: auto;
          }
        }
      `}</style>
    </>
  )
}
