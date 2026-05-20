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

interface ProductOutput {
  id: string
  title: string
  status: string
  organization_id: string
  created: string
  payload: {
    einsatz: string
    datum: string
    vorname?: string
    nachname?: string
    user_name?: string
    lager_id?: string
    lager_name?: string
    positionen: Array<{ qty: number; name: string; item_id?: string; unit?: string }>
  }
}

export default function Lager() {
  const { user, loading: authLoading, logout } = useAuth()

  const [locations, setLocations] = useState<Location[]>([])
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null)
  const [allItems, setAllItems] = useState<InventoryItem[]>([])
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([])

  const [showAusgabenModal, setShowAusgabenModal] = useState(false)
  const [productOutputs, setProductOutputs] = useState<ProductOutput[]>([])
  const [ausgabenLoading, setAusgabenLoading] = useState(false)
  const [ausgabenCount, setAusgabenCount] = useState(0)
  const [buchendId, setBuchendId] = useState<string | null>(null)
  const [outputLagerIds, setOutputLagerIds] = useState<Record<string, string>>({})
  const [editingOutputId, setEditingOutputId] = useState<string | null>(null)
  const [editedPositionen, setEditedPositionen] = useState<Record<string, Array<{ qty: number; name: string; item_id?: string; unit?: string }>>>({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [addItemId, setAddItemId] = useState<Record<string, string>>({})
  const [addItemQty, setAddItemQty] = useState<Record<string, number>>({})
  const [addFreetext, setAddFreetext] = useState<Record<string, string>>({})
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
      loadAusgabenCount()
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

  async function loadAusgabenCount() {
    try {
      const list = await pb.collection('product_outputs').getList(1, 1, {
        filter: `organization_id = "${user?.organization_id}" && status = "offen"`,
      })
      setAusgabenCount(list.totalItems)
    } catch {}
  }

  async function loadProductOutputs() {
    setAusgabenLoading(true)
    try {
      const list = await pb.collection('product_outputs').getFullList<ProductOutput>({
        filter: `organization_id = "${user?.organization_id}" && status = "offen"`,
        sort: '-created',
      })
      setProductOutputs(list)
      setAusgabenCount(list.length)
      const lagerMap: Record<string, string> = {}
      list.forEach(o => { lagerMap[o.id] = o.payload.lager_id || currentLocationId || '' })
      setOutputLagerIds(lagerMap)
    } catch (e: any) {
      showMsg('Fehler beim Laden: ' + e.message, 'error')
    } finally {
      setAusgabenLoading(false)
    }
  }

  async function saveOutputEdit(output: ProductOutput) {
    const pos = editedPositionen[output.id]
    if (!pos) return
    setSavingEdit(true)
    try {
      await pb.collection('product_outputs').update(output.id, {
        payload: { ...output.payload, positionen: pos }
      })
      setProductOutputs(prev => prev.map(o => o.id === output.id ? { ...o, payload: { ...o.payload, positionen: pos } } : o))
      setEditingOutputId(null)
      showMsg('Gespeichert', 'success')
    } catch (e: any) {
      showMsg('Fehler: ' + e.message, 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  async function ausbuchenAlle(output: ProductOutput) {
    const locId = outputLagerIds[output.id] || currentLocationId
    if (!locId) { showMsg('Kein Lagerort ausgewählt', 'error'); return }
    setBuchendId(output.id)
    try {
      const positionen = output.payload.positionen.filter(p => p.item_id && p.qty > 0)
      for (const pos of positionen) {
        const stockList = await pb.collection('inventory_stock').getFullList<StockItem>({
          filter: `item_id = "${pos.item_id}" && location_id = "${locId}"`,
          sort: 'expiry_date',
        })
        let remaining = pos.qty
        for (const stock of stockList) {
          if (remaining <= 0) break
          const take = Math.min(stock.quantity, remaining)
          const newQty = stock.quantity - take
          if (newQty <= 0) {
            await pb.collection('inventory_stock').delete(stock.id)
          } else {
            await pb.collection('inventory_stock').update(stock.id, { quantity: newQty })
          }
          remaining -= take
        }
        await pb.collection('inventory_transactions').create({
          item_id: pos.item_id,
          location_id: locId,
          type: 'ausbuchung',
          quantity: -pos.qty,
          note: `Produktausgabe ${output.payload.einsatz} – ${output.payload.user_name ?? `${output.payload.vorname ?? ''} ${output.payload.nachname ?? ''}`.trim()}`,
          user: user?.email || user?.id,
          organization_id: user?.organization_id,
        })
      }
      await pb.collection('product_outputs').update(output.id, { status: 'erledigt' })
      setProductOutputs(prev => prev.filter(o => o.id !== output.id))
      setAusgabenCount(prev => Math.max(0, prev - 1))
      showMsg(`✅ Ausgebucht: ${positionen.length} Position(en)`, 'success')
      await loadStock()
    } catch (e: any) {
      showMsg('Fehler: ' + e.message, 'error')
    } finally {
      setBuchendId(null)
    }
  }

  async function ignoreOutput(output: ProductOutput) {
    try {
      await pb.collection('product_outputs').update(output.id, { status: 'ignoriert' })
      setProductOutputs(prev => prev.filter(o => o.id !== output.id))
      setAusgabenCount(prev => Math.max(0, prev - 1))
    } catch (e: any) {
      showMsg('Fehler: ' + e.message, 'error')
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
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>

      {/* MASTHEAD HEADER */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(96,8,18,0.12)', position: 'sticky', top: 0, zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/hub" style={{ display: 'flex', color: '#600812', textDecoration: 'none', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </a>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: '#1a0e08' }}>Lager</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{user?.organization_name || 'Responda'}</div>
          </div>
          <button onClick={() => setShowSettingsModal(true)} style={{ width: 34, height: 34, border: 'none', borderRadius: 8, background: 'rgba(96,8,18,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#600812' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </div>

      {/* ACTION TOOLBAR */}
      <div className="lager-actionbar">
        <button className="lager-action-btn" style={{ position: 'relative' }} onClick={() => { loadProductOutputs(); setShowAusgabenModal(true) }} title="Produktausgaben">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"/><path d="M10 12l2 2 4-4"/></svg>
          {ausgabenCount > 0 && <span className="lager-badge">{ausgabenCount}</span>}
          <span className="lager-action-label">Ausgaben</span>
        </button>
        <button className="lager-action-btn" onClick={() => { loadTransactions(); setShowLogModal(true) }} title="Logbuch">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span className="lager-action-label">Logbuch</span>
        </button>
        <button className="lager-action-btn" onClick={() => setShowItemsModal(true)} title="Artikel-Datenbank">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          <span className="lager-action-label">Artikel</span>
        </button>
        <button className="lager-action-btn" onClick={() => { setBuchungType('ein'); setShowBuchungModal(true) }} title="Einbuchen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span className="lager-action-label">Einbuchen</span>
        </button>
        <button className="lager-action-btn" onClick={() => { setBuchungType('aus'); setShowBuchungModal(true) }} title="Ausbuchen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span className="lager-action-label">Ausbuchen</span>
        </button>
        <button className="lager-action-btn" onClick={() => { setMultiBuchungType('ein'); setShowMultiBuchungModal(true) }} title="Mehrfachbuchung">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="3" y="13" width="7" height="5" rx="1"/><rect x="14" y="13" width="7" height="5" rx="1"/><line x1="17.5" y1="19" x2="17.5" y2="23"/><line x1="15.5" y1="21" x2="19.5" y2="21"/></svg>
          <span className="lager-action-label">Mehrfach</span>
        </button>
        <button className="lager-action-btn" onClick={exportPDF} title="PDF Export">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
          <span className="lager-action-label">PDF</span>
        </button>
        <button className="lager-action-btn" onClick={() => { loadAuditHistory(); loadOpenAudits(); setShowInventoryModal(true) }} title="Inventur">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/><path d="M9 12h6m-6 4h6"/></svg>
          <span className="lager-action-label">Inventur</span>
        </button>
      </div>

      {/* TOAST */}
      {message && (
        <div className={`lager-toast lager-toast-${message.type}`}>{message.text}</div>
      )}

      {/* MAIN CONTENT */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 16px 120px', boxSizing: 'border-box' as const }}>

        {/* STATS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>OK</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{stats.ok}</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 3 }}>In Ordnung</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Bald</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{stats.warn}</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 3 }}>Bald fällig</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Abgel.</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#600812', lineHeight: 1 }}>{stats.exp}</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 3 }}>Abgelaufen</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1a0e08', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Gesamt</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#1a0e08', lineHeight: 1 }}>{stats.total}</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 3 }}>Artikel</div>
          </div>
        </div>

        {/* SEARCH */}
        <div style={{ marginBottom: 10 }}>
          <input
            className="lager-search"
            type="text"
            placeholder="Artikel suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* FILTER CHIPS */}
        <div className="lager-chips" style={{ marginBottom: 14 }}>
          <button className={`lager-chip${statusFilter === 'all' ? ' active' : ''}`} onClick={() => setStatusFilter('all')}>Alle</button>
          <button className={`lager-chip${statusFilter === 'warning' ? ' active' : ''}`} onClick={() => setStatusFilter('warning')}>Bald fällig</button>
          <button className={`lager-chip${statusFilter === 'expired' ? ' active' : ''}`} onClick={() => setStatusFilter('expired')}>Abgelaufen</button>
          <button className={`lager-chip${showLowOnly ? ' active' : ''}`} onClick={() => setShowLowOnly(!showLowOnly)}>Einbestellen</button>
          <button className={`lager-chip${showZeroOnly ? ' active' : ''}`} onClick={() => setShowZeroOnly(!showZeroOnly)}>Leer</button>
        </div>

        {/* ERROR */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 16, borderRadius: 12, marginBottom: 16, fontWeight: 600 }}>
            {error}
            <button onClick={loadStock} style={{ marginLeft: 16, background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#b91c1c', fontFamily: 'inherit' }}>Erneut versuchen</button>
          </div>
        )}

        {/* ITEM LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--warm-gray)', background: '#fff', borderRadius: 12, fontStyle: 'italic' }}>Lade Lagerdaten...</div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--warm-gray)', background: '#fff', borderRadius: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: '#1a0e08' }}>Keine Artikel gefunden</div>
              <div style={{ fontStyle: 'italic', fontSize: 13 }}>Filter anpassen oder Artikel hinzufügen</div>
            </div>
          ) : (
            filteredItems.map(item => {
              const isLow = item.min_stock > 0 && item.qty < item.min_stock
              const isZero = item.qty === 0
              const borderColor = isZero ? 'rgba(139,113,90,0.4)' : item.status === 'ok' ? '#16a34a' : item.status === 'warn' ? '#d97706' : '#600812'
              const expiryColor = item.status === 'exp' ? '#600812' : item.status === 'warn' ? '#d97706' : 'var(--warm-gray)'

              return (
                <div
                  key={item.id}
                  onClick={() => openItemDetail(item)}
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    borderLeft: `3px solid ${borderColor}`,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    opacity: isZero ? 0.65 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1a0e08', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                    {item.notes && <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{item.notes}</div>}
                    {item.expiry && (
                      <div style={{ fontStyle: 'italic', fontSize: 11, color: expiryColor, marginTop: 2 }}>
                        Ablauf: {new Date(item.expiry).toLocaleDateString('de-DE')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: isLow ? '#d97706' : '#1a0e08' }}>{item.qty}</div>
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase' as const }}>{item.unit}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); adjustQty(item.id, -1) }}
                      style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,0.08)', color: '#dc2626', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                    >−</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); adjustQty(item.id, 1, '') }}
                      style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(22,163,74,0.08)', color: '#16a34a', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                    >+</button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* LOCATION TABS */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '0.5px solid rgba(96,8,18,0.12)', padding: '10px 12px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))', display: 'flex', gap: 8, justifyContent: 'center', zIndex: 100, overflowX: 'auto' }}>
        {locations.map(loc => (
          <button
            key={loc.id}
            onClick={() => setCurrentLocationId(loc.id)}
            style={{
              padding: '8px 18px',
              borderRadius: 20,
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: 'pointer',
              flexShrink: 0,
              background: currentLocationId === loc.id ? '#600812' : 'rgba(96,8,18,0.07)',
              color: currentLocationId === loc.id ? '#fff' : '#600812',
            }}
          >
            {loc.name}
          </button>
        ))}
      </div>

      {/* LOGBUCH MODAL */}
      {showLogModal && (
        <div className="lager-modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="lager-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 16 }}>Logbuch</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
              {transactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Keine Transaktionen vorhanden</div>
              ) : (
                transactions.map(txn => (
                  <div key={txn.id} style={{ background: 'rgba(250,249,247,0.8)', borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${txn.type === 'einbuchung' ? '#16a34a' : txn.type === 'ausbuchung' ? '#600812' : '#d97706'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>{new Date(txn.created).toLocaleString('de-DE')}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: txn.type === 'einbuchung' ? '#dcfce7' : txn.type === 'ausbuchung' ? '#fee2e2' : '#fef3c7',
                        color: txn.type === 'einbuchung' ? '#166534' : txn.type === 'ausbuchung' ? '#b91c1c' : '#92400e'
                      }}>
                        {txn.type === 'einbuchung' ? 'Einbuchung' : txn.type === 'ausbuchung' ? 'Ausbuchung' : 'Korrektur'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13, color: '#1a0e08' }}>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="lager-btn" onClick={() => setShowLogModal(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* ARTIKEL-DATENBANK MODAL */}
      {showItemsModal && (
        <div className="lager-modal-overlay" onClick={() => setShowItemsModal(false)}>
          <div className="lager-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 16 }}>Artikel-Datenbank</div>
            <button
              className="lager-btn primary"
              style={{ width: '100%', marginBottom: 16 }}
              onClick={() => { setItemFormData({ name: '', unit: 'Stück', min_stock: 0 }); setEditingItemId(null); setShowAddItemModal(true) }}
            >
              Neuen Artikel anlegen
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {allItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Keine Artikel vorhanden</div>
              ) : (
                allItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid rgba(96,8,18,0.1)', borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1a0e08' }}>{item.name}</div>
                      <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{item.unit || 'Stück'} · SOLL: {item.min_stock || 0}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="lager-btn" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => { setItemFormData({ name: item.name, unit: item.unit, min_stock: item.min_stock }); setEditingItemId(item.id); setShowAddItemModal(true) }}>Bearbeiten</button>
                      <button className="lager-btn" style={{ fontSize: 12, padding: '5px 10px', color: '#600812', borderColor: 'rgba(96,8,18,0.2)' }} onClick={() => deleteItem(item.id)}>Löschen</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="lager-btn" onClick={() => setShowItemsModal(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* EINSTELLUNGEN MODAL */}
      {showSettingsModal && (
        <div className="lager-modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="lager-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 16 }}>Lager-Standorte</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {locations.map(loc => (
                <div key={loc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid rgba(96,8,18,0.1)', borderRadius: 8 }}>
                  <div style={{ fontWeight: 600, color: '#1a0e08' }}>{loc.name}</div>
                  <button className="lager-btn" style={{ fontSize: 12, padding: '5px 10px', color: '#600812', borderColor: 'rgba(96,8,18,0.2)' }} onClick={() => deleteLocation(loc.id)} disabled={locations.length <= 1}>Löschen</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Neuer Standort</label>
              <input className="lager-input" type="text" placeholder="Standort-Name" value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} />
              <button className="lager-btn primary" onClick={addLocation}>Standort hinzufügen</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="lager-btn" onClick={() => setShowSettingsModal(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* INVENTUR MODAL MIT TABS */}
      {showInventoryModal && (
        <div className="lager-modal-overlay" onClick={() => setShowInventoryModal(false)}>
          <div className="lager-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 16 }}>Inventur</div>

            {/* TABS */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid rgba(96,8,18,0.1)' }}>
              {(['new', 'history', 'schedule'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setInventoryTab(tab); if (tab === 'history') loadAuditHistory() }}
                  style={{ background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: 'inherit', color: inventoryTab === tab ? '#600812' : 'var(--warm-gray)', borderBottom: inventoryTab === tab ? '2px solid #600812' : '2px solid transparent', marginBottom: -2 }}
                >
                  {tab === 'new' ? 'Inventur' : tab === 'history' ? 'Historie' : 'Zeitplan'}
                </button>
              ))}
            </div>

            {/* TAB: INVENTUR */}
            {inventoryTab === 'new' && (
              currentAudit ? (
                <div>
                  <div style={{ background: 'rgba(250,249,247,0.8)', padding: 12, borderRadius: 8, marginBottom: 16, border: '1px solid rgba(96,8,18,0.1)' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#600812', marginBottom: 2 }}>
                      {locations.find(l => l.id === auditLocationId)?.name || 'Lager'}
                    </div>
                    <span style={{ fontSize: 13, color: '#1a0e08' }}><strong>Fortschritt:</strong> {auditItems.filter(ai => ai.checked).length} / {auditItems.length} geprüft</span>
                  </div>
                  {auditIndex < auditItems.length && (
                    <div>
                      <div style={{ background: 'rgba(250,249,247,0.8)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#1a0e08', marginBottom: 6 }}>{auditIndex + 1}. {auditItems[auditIndex]?.expand?.item_id?.name}</div>
                        <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 10 }}>{auditItems[auditIndex]?.expand?.item_id?.unit || 'Stück'}</div>
                        <div style={{ background: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 4 }}>Erwarteter Bestand (laut System):</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#1a0e08' }}>{auditItems[auditIndex]?.expected_quantity} {auditItems[auditIndex]?.expand?.item_id?.unit || 'Stück'}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Tatsächlicher Bestand (gezählt):</label>
                          <input className="lager-input" type="number" id="audit-actual" defaultValue={auditItems[auditIndex]?.actual_quantity || 0} min="0" style={{ fontSize: 18, fontWeight: 700 }} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1a0e08' }}>
                          <input type="checkbox" id="audit-checked" defaultChecked={auditItems[auditIndex]?.checked || false} />
                          <span>Als geprüft markieren</span>
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                        <button className="lager-btn" onClick={() => setAuditIndex(Math.max(0, auditIndex - 1))} disabled={auditIndex === 0}>Zurück</button>
                        <button className="lager-btn primary" onClick={() => { const actual = parseInt((document.getElementById('audit-actual') as HTMLInputElement)?.value || '0'); const checked = (document.getElementById('audit-checked') as HTMLInputElement)?.checked || false; saveAuditItem(actual, checked) }}>
                          {auditIndex === auditItems.length - 1 ? 'Fertig' : 'Weiter'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {locations.map(loc => {
                    const openAudit = openAudits.find(a => a.location_id === loc.id)
                    const lastAudit = auditHistory.filter(a => a.location_id === loc.id).sort((a, b) => new Date(b.audit_date).getTime() - new Date(a.audit_date).getTime())[0]
                    const nextDue = getNextDueDateForLocation(loc.id)
                    const neverAudited = !lastAudit && inventurSchedule.interval !== 'disabled'
                    const isOverdue = neverAudited || (nextDue !== null && nextDue < new Date())
                    return (
                      <div key={loc.id} style={{ background: 'rgba(250,249,247,0.8)', borderRadius: 12, padding: 16, border: `1px solid ${isOverdue ? '#fecaca' : 'rgba(96,8,18,0.1)'}`, borderLeft: `4px solid ${isOverdue ? '#600812' : openAudit ? '#d97706' : 'rgba(96,8,18,0.15)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a0e08' }}>{loc.name}</div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {openAudit && <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 999, fontWeight: 700, textTransform: 'uppercase' as const }}>Offen</span>}
                            {isOverdue && <span style={{ fontSize: 10, background: '#fee2e2', color: '#600812', padding: '2px 8px', borderRadius: 999, fontWeight: 700, textTransform: 'uppercase' as const }}>Überfällig</span>}
                          </div>
                        </div>
                        <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div>Letzte Inventur: {lastAudit ? `${new Date(lastAudit.audit_date).toLocaleDateString('de-DE')} · ${lastAudit.user}` : 'Noch nie durchgeführt'}</div>
                          {inventurSchedule.interval !== 'disabled' && (
                            <div style={{ color: isOverdue ? '#600812' : 'var(--warm-gray)' }}>Nächste fällig: {neverAudited ? 'Sofort' : nextDue?.toLocaleDateString('de-DE')}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {openAudit && <button className="lager-btn primary" onClick={() => resumeAudit(openAudit)}>Weiterführen</button>}
                          <button className="lager-btn" onClick={() => startInventur(loc.id)}>{openAudit ? 'Neu starten' : 'Inventur starten'}</button>
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
                    <button className="lager-btn" style={{ marginBottom: 16 }} onClick={() => { setSelectedHistoryAudit(null); setHistoryAuditItems([]) }}>Zurueck zur Liste</button>
                    <div style={{ fontWeight: 700, marginBottom: 2, color: '#1a0e08' }}>{new Date(selectedHistoryAudit.audit_date).toLocaleString('de-DE')}</div>
                    <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 2 }}>{locations.find(l => l.id === selectedHistoryAudit.location_id)?.name || 'Unbekannter Standort'}</div>
                    <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 16 }}>von {selectedHistoryAudit.user}</div>
                    {historyAuditItems.length === 0 ? (
                      <div style={{ color: 'var(--warm-gray)', fontSize: 13, textAlign: 'center', padding: 24, fontStyle: 'italic' }}>Keine Einträge gefunden</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                        {historyAuditItems.map(ai => {
                          const diff = ai.actual_quantity - ai.expected_quantity
                          const hasDiff = diff !== 0
                          return (
                            <div key={ai.id} style={{ padding: '10px 12px', borderRadius: 8, background: hasDiff ? (diff > 0 ? '#f0fdf4' : '#fef2f2') : 'rgba(250,249,247,0.8)', borderLeft: `3px solid ${hasDiff ? (diff > 0 ? '#16a34a' : '#600812') : 'rgba(96,8,18,0.15)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#1a0e08' }}>{ai.expand?.item_id?.name || ai.item_id}</div>
                                <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>Erwartet: {ai.expected_quantity} → Gezählt: {ai.actual_quantity}</div>
                              </div>
                              {hasDiff ? (
                                <span style={{ fontWeight: 800, fontSize: 14, color: diff > 0 ? '#16a34a' : '#600812' }}>{diff > 0 ? '+' : ''}{diff}</span>
                              ) : (
                                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>OK</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                    {auditHistory.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 24, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Keine Inventuren vorhanden</div>
                    ) : (
                      auditHistory.map(audit => (
                        <div key={audit.id} style={{ background: 'rgba(250,249,247,0.8)', borderRadius: 8, padding: '10px 12px', borderLeft: '3px solid #600812', cursor: 'pointer' }} onClick={() => { setSelectedHistoryAudit(audit); loadHistoryAuditItems(audit.id) }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#1a0e08' }}>{new Date(audit.audit_date).toLocaleString('de-DE')}</div>
                            <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Abgeschlossen</span>
                          </div>
                          <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>
                            <strong style={{ fontStyle: 'normal', color: '#1a0e08' }}>{locations.find(l => l.id === audit.location_id)?.name || 'Standort'}</strong>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Inventur-Intervall (gilt für alle Standorte)</label>
                  <select className="lager-input" value={inventurSchedule.interval} onChange={(e) => setInventurSchedule({ interval: e.target.value })}>
                    <option value="disabled">Deaktiviert</option>
                    <option value="weekly">Wöchentlich</option>
                    <option value="monthly">Monatlich</option>
                    <option value="quarterly">Vierteljährlich</option>
                    <option value="biannual">Halbjährlich</option>
                    <option value="annual">Jährlich</option>
                  </select>
                </div>
                {inventurSchedule.interval !== 'disabled' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1a0e08', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Fälligkeiten je Standort:</div>
                    {locations.map(loc => {
                      const nextDue = getNextDueDateForLocation(loc.id)
                      const lastAudit = auditHistory.filter(a => a.location_id === loc.id).sort((a, b) => new Date(b.audit_date).getTime() - new Date(a.audit_date).getTime())[0]
                      const neverAudited = !lastAudit
                      const isOverdue = neverAudited || (nextDue !== null && nextDue < new Date())
                      return (
                        <div key={loc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: isOverdue ? '#fef2f2' : '#f0fdf4', border: `1px solid ${isOverdue ? '#fecaca' : '#bbf7d0'}` }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#1a0e08' }}>{loc.name}</div>
                          <div style={{ textAlign: 'right', fontSize: 12 }}>
                            {neverAudited ? (
                              <span style={{ color: '#600812', fontWeight: 700 }}>Noch nie – sofort fällig</span>
                            ) : (
                              <span style={{ color: isOverdue ? '#600812' : '#166534', fontWeight: 600 }}>
                                {nextDue?.toLocaleDateString('de-DE')}
                                {isOverdue && ' — Überfällig'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <button className="lager-btn primary" style={{ width: '100%' }} onClick={saveSchedule}>Speichern</button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="lager-btn" onClick={() => { setShowInventoryModal(false); setCurrentAudit(null); setAuditItems([]); setAuditLocationId(null); setSelectedHistoryAudit(null); setHistoryAuditItems([]) }}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* BUCHUNG MODAL */}
      {showBuchungModal && (
        <div className="lager-modal-overlay" onClick={() => setShowBuchungModal(false)}>
          <div className="lager-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 16 }}>
              {buchungType === 'ein' ? 'Artikel einbuchen' : 'Artikel ausbuchen'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Artikel *</label>
              <select className="lager-input" value={selectedBuchungItem} onChange={(e) => setSelectedBuchungItem(e.target.value)}>
                <option value="">-- Artikel wählen --</option>
                {allItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Menge *</label>
              <input className="lager-input" type="number" value={buchungQty} onChange={(e) => setBuchungQty(parseInt(e.target.value) || 1)} min="1" />
            </div>
            {buchungType === 'ein' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Ablaufdatum (optional)</label>
                <input className="lager-input" type="date" value={buchungExpiry} onChange={(e) => setBuchungExpiry(e.target.value)} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="lager-btn" onClick={() => setShowBuchungModal(false)}>Abbrechen</button>
              <button className="lager-btn primary" onClick={saveBuchung}>{buchungType === 'ein' ? 'Einbuchen' : 'Ausbuchen'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ARTIKEL DETAIL MODAL */}
      {showItemDetailModal && detailItem && (
        <div className="lager-modal-overlay" onClick={() => setShowItemDetailModal(false)}>
          <div className="lager-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 17, fontStyle: 'italic', color: '#1a0e08' }}>{detailItem.name}</div>
              <span style={{
                background: detailItem.status === 'exp' ? '#fee2e2' : detailItem.status === 'warn' ? '#fef3c7' : '#dcfce7',
                color: detailItem.status === 'exp' ? '#600812' : detailItem.status === 'warn' ? '#92400e' : '#15803d',
                padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const
              }}>
                {detailItem.status === 'exp' ? 'Abgelaufen' : detailItem.status === 'warn' ? 'Achtung' : 'In Ordnung'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)' }}>
                IST: <strong style={{ fontStyle: 'normal', color: '#1a0e08', fontSize: 16 }}>{detailItem.qty}</strong> {detailItem.unit}
                {detailItem.min_stock > 0 && <span style={{ marginLeft: 8 }}>/ SOLL: {detailItem.min_stock}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button onClick={async () => { await adjustQty(detailItem.id, -1); await reloadDetailStocks(); await loadStock() }} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,0.08)', color: '#dc2626', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <button onClick={async () => { await adjustQty(detailItem.id, 1, ''); await reloadDetailStocks(); await loadStock() }} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(22,163,74,0.08)', color: '#16a34a', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>SOLL</label>
                <input className="lager-input" type="number" value={detailSoll} onChange={(e) => setDetailSoll(parseInt(e.target.value) || 0)} min="0" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Bemerkung</label>
                <input className="lager-input" type="text" value={detailNote} onChange={(e) => setDetailNote(e.target.value)} placeholder="Freitext..." />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Ablaufdatum</label>
              <input className="lager-input" type="date" value={detailExpiry} onChange={(e) => setDetailExpiry(e.target.value)} />
            </div>
            <button className="lager-btn primary" style={{ width: '100%', marginBottom: 20 }} onClick={saveItemDetail}>Speichern</button>

            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 10 }}>Verlauf</div>
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {detailLoadingData ? (
                <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)' }}>Lade...</div>
              ) : detailTransactions.length === 0 ? (
                <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)' }}>Keine Transaktionen</div>
              ) : (
                detailTransactions.map(txn => (
                  <div key={txn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(250,249,247,0.8)', borderRadius: 8, borderLeft: `3px solid ${txn.type === 'einbuchung' ? '#16a34a' : txn.type === 'ausbuchung' ? '#600812' : '#d97706'}`, fontSize: 13 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1a0e08' }}>
                        {txn.type === 'einbuchung' ? `+${txn.quantity}` : txn.type === 'ausbuchung' ? `${txn.quantity}` : `Korrektur ${txn.quantity > 0 ? '+' : ''}${txn.quantity}`} {detailItem.unit}
                      </div>
                      {txn.note && <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{txn.note}</div>}
                    </div>
                    <div style={{ textAlign: 'right', fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>
                      <div>{txn.user}</div>
                      <div>{new Date(txn.created).toLocaleDateString('de-DE')}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="lager-btn" onClick={() => setShowItemDetailModal(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* MEHRFACHBUCHUNG MODAL */}
      {showMultiBuchungModal && (
        <div className="lager-modal-overlay" onClick={() => setShowMultiBuchungModal(false)}>
          <div className="lager-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 16 }}>Mehrfachbuchung</div>

            <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid rgba(96,8,18,0.1)' }}>
              {(['ein', 'aus'] as const).map(t => (
                <button key={t} onClick={() => setMultiBuchungType(t)} style={{ background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: 'inherit', color: multiBuchungType === t ? '#600812' : 'var(--warm-gray)', borderBottom: multiBuchungType === t ? '2px solid #600812' : '2px solid transparent', marginBottom: -2 }}>
                  {t === 'ein' ? 'Einbuchen' : 'Ausbuchen'}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'end', marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Artikel</label>
                <select className="lager-input" value={multiBuchungNewItemId} onChange={(e) => setMultiBuchungNewItemId(e.target.value)}>
                  <option value="">-- Artikel wählen --</option>
                  {allItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Menge</label>
                <input className="lager-input" type="number" value={multiBuchungNewQty} onChange={(e) => setMultiBuchungNewQty(parseInt(e.target.value) || 1)} min="1" style={{ width: 80 }} />
              </div>
              {multiBuchungType === 'ein' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Ablaufdatum</label>
                  <input className="lager-input" type="date" value={multiBuchungNewExpiry} onChange={(e) => setMultiBuchungNewExpiry(e.target.value)} style={{ width: 140 }} />
                </div>
              )}
              <button className="lager-btn primary" style={{ alignSelf: 'flex-end' }} onClick={() => { if (!multiBuchungNewItemId) return; setMultiBuchungItems(prev => [...prev, { itemId: multiBuchungNewItemId, qty: multiBuchungNewQty, expiry: multiBuchungNewExpiry }]); setMultiBuchungNewItemId(''); setMultiBuchungNewQty(1); setMultiBuchungNewExpiry('') }}>Hinzufügen</button>
            </div>

            {multiBuchungItems.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 8 }}>Buchungsliste</div>
                {multiBuchungItems.map((entry, idx) => {
                  const item = allItems.find(i => i.id === entry.itemId)
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(250,249,247,0.8)', borderRadius: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: '#1a0e08' }}>{item?.name || entry.itemId}</span>
                      <span style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>{entry.qty} {item?.unit || 'Stück'}{entry.expiry ? ` · ${new Date(entry.expiry).toLocaleDateString('de-DE')}` : ''}</span>
                      <button onClick={() => setMultiBuchungItems(prev => prev.filter((_, i) => i !== idx))} style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(96,8,18,0.2)', background: 'none', color: '#600812', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="lager-btn" onClick={() => { setShowMultiBuchungModal(false); setMultiBuchungItems([]) }}>Abbrechen</button>
              <button className="lager-btn primary" onClick={saveMultiBuchung} disabled={multiBuchungItems.length === 0}>Alle {multiBuchungType === 'ein' ? 'einbuchen' : 'ausbuchen'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ITEM MODAL */}
      {showAddItemModal && (
        <div className="lager-modal-overlay" onClick={() => setShowAddItemModal(false)}>
          <div className="lager-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 16 }}>
              {editingItemId ? 'Artikel bearbeiten' : 'Artikel anlegen'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Artikelname *</label>
              <input className="lager-input" type="text" value={itemFormData.name} onChange={(e) => setItemFormData({...itemFormData, name: e.target.value})} placeholder="z.B. Einmalhandschuhe" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Einheit</label>
              <input className="lager-input" type="text" value={itemFormData.unit} onChange={(e) => setItemFormData({...itemFormData, unit: e.target.value})} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Mindestbestand</label>
              <input className="lager-input" type="number" value={itemFormData.min_stock} onChange={(e) => setItemFormData({...itemFormData, min_stock: parseInt(e.target.value) || 0})} min="0" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="lager-btn" onClick={() => setShowAddItemModal(false)}>Abbrechen</button>
              <button className="lager-btn primary" onClick={saveItem}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes lagerToastIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: none; }
        }

        .lager-actionbar {
          background: #fff;
          border-bottom: 0.5px solid rgba(96,8,18,0.12);
          position: sticky;
          top: 60px;
          z-index: 99;
          display: flex;
          gap: 0;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          padding: 0 4px;
        }
        .lager-actionbar::-webkit-scrollbar { display: none; }

        .lager-action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          flex-shrink: 0;
          min-width: 56px;
          padding: 8px 6px;
          background: none;
          border: none;
          cursor: pointer;
          color: #600812;
          font-family: inherit;
          position: relative;
        }
        .lager-action-btn:hover { background: rgba(96,8,18,0.05); }

        .lager-action-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #600812;
          white-space: nowrap;
        }

        .lager-badge {
          position: absolute;
          top: 6px;
          right: 6px;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          background: #600812;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 3px;
        }

        .lager-toast {
          position: fixed;
          bottom: calc(70px + env(safe-area-inset-bottom));
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          padding: 10px 20px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 13px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          animation: lagerToastIn 0.2s ease both;
          white-space: nowrap;
        }
        .lager-toast-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
        .lager-toast-error   { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }

        .lager-search {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 14px;
          border: 1px solid rgba(96,8,18,0.15);
          border-radius: 10px;
          background: #fff;
          font-size: 14px;
          font-family: inherit;
          color: #1a0e08;
        }
        .lager-search:focus { outline: none; border-color: #600812; box-shadow: 0 0 0 3px rgba(96,8,18,0.08); }

        .lager-chips {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .lager-chips::-webkit-scrollbar { display: none; }

        .lager-chip {
          flex-shrink: 0;
          border: 1px solid rgba(96,8,18,0.15);
          background: #fff;
          color: #1a0e08;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
        }
        .lager-chip.active { background: rgba(96,8,18,0.08); border-color: #600812; color: #600812; }

        .lager-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(26,14,8,0.55);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .lager-modal {
          background: #fff;
          border-radius: 16px;
          max-width: 640px;
          width: 100%;
          max-height: 88vh;
          overflow-y: auto;
          padding: 24px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.18);
        }

        .lager-btn {
          background: #fff;
          color: #1a0e08;
          border: 1px solid rgba(96,8,18,0.15);
          padding: 9px 18px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          font-size: 14px;
          font-family: inherit;
        }
        .lager-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .lager-btn.primary { background: #600812; color: #fff; border-color: #600812; }
        .lager-btn.primary:hover { opacity: 0.88; }

        .lager-input {
          padding: 9px 12px;
          border: 1px solid rgba(96,8,18,0.15);
          border-radius: 8px;
          background: #faf9f7;
          color: #1a0e08;
          font-size: 14px;
          font-family: inherit;
          width: 100%;
          box-sizing: border-box;
        }
        .lager-input:focus { outline: none; border-color: #600812; box-shadow: 0 0 0 3px rgba(96,8,18,0.08); }

        @media (max-width: 768px) {
          .lager-modal-overlay { align-items: flex-end; padding: 0; }
          .lager-modal { border-radius: 16px 16px 0 0; max-height: 85vh; max-width: 100%; padding: 20px 16px calc(20px + env(safe-area-inset-bottom)); }
        }
      `}</style>

      {/* PRODUKTAUSGABEN MODAL */}
      {showAusgabenModal && (
        <div className="lager-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAusgabenModal(false) }}>
          <div className="lager-modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Offene Produktausgaben</div>
              <button className="lager-btn" style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => setShowAusgabenModal(false)}>Schließen</button>
            </div>

            {ausgabenLoading ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Laden…</div>
            ) : productOutputs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--warm-gray)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" style={{ display: 'block', margin: '0 auto 12px' }}><polyline points="20 6 9 17 4 12"/></svg>
                <div style={{ fontWeight: 600, color: '#1a0e08' }}>Keine offenen Ausgaben</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {productOutputs.map(output => {
                  const p = output.payload
                  const deDate = p.datum ? p.datum.split('-').reverse().join('.') : '–'
                  const activePosionen = editingOutputId === output.id ? (editedPositionen[output.id] ?? p.positionen) : p.positionen
                  const withItemId = activePosionen.filter(pos => pos.item_id)
                  const withoutItemId = activePosionen.filter(pos => !pos.item_id)
                  const isBusy = buchendId === output.id
                  const isEditing = editingOutputId === output.id
                  const selectedLocId = outputLagerIds[output.id] || currentLocationId || ''

                  return (
                    <div key={output.id} style={{ background: 'rgba(250,249,247,0.8)', border: '0.5px solid rgba(96,8,18,0.1)', borderRadius: 14, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a0e08' }}>Einsatz {p.einsatz}</div>
                          <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                            {deDate} · {p.user_name ?? `${p.vorname ?? ''} ${p.nachname ?? ''}`.trim()}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, background: '#fef9c3', color: '#854d0e', borderRadius: 6, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Offen</span>
                      </div>

                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Lager</div>
                        {p.lager_name && selectedLocId === p.lager_id && (
                          <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 4 }}>
                            Angefordert: <strong style={{ fontStyle: 'normal', color: '#1a0e08' }}>{p.lager_name}</strong>
                          </div>
                        )}
                        <select
                          className="lager-input"
                          value={selectedLocId}
                          onChange={e => setOutputLagerIds(prev => ({ ...prev, [output.id]: e.target.value }))}
                          style={{ border: selectedLocId !== p.lager_id && p.lager_id ? '1.5px solid #d97706' : '1px solid rgba(96,8,18,0.15)' }}
                        >
                          <option value="">— Lager wählen —</option>
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}{loc.id === p.lager_id ? ' (angefordert)' : ''}</option>
                          ))}
                        </select>
                        {selectedLocId !== p.lager_id && p.lager_id && (
                          <div style={{ fontStyle: 'italic', fontSize: 11, color: '#b45309', marginTop: 4 }}>
                            Abweichend vom angeforderten Lager ({p.lager_name})
                          </div>
                        )}
                      </div>

                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          Positionen
                          {!isEditing && (
                            <button className="lager-btn" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => { setEditingOutputId(output.id); setEditedPositionen(prev => ({ ...prev, [output.id]: p.positionen.map(pos => ({ ...pos })) })) }}>
                              Korrigieren
                            </button>
                          )}
                          {isEditing && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="lager-btn" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setEditingOutputId(null)}>Abbrechen</button>
                              <button className="lager-btn primary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => saveOutputEdit(output)} disabled={savingEdit}>{savingEdit ? '…' : 'Speichern'}</button>
                            </div>
                          )}
                        </div>
                        {activePosionen.map((pos, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: '#fff', borderRadius: 8, marginBottom: 4, border: `0.5px solid ${pos.item_id ? 'rgba(34,197,94,0.3)' : 'rgba(96,8,18,0.1)'}` }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: '#1a0e08', flex: 1, marginRight: 8 }}>{pos.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {isEditing ? (
                                <input
                                  type="number" min={0}
                                  value={pos.qty}
                                  onChange={e => setEditedPositionen(prev => {
                                    const copy = (prev[output.id] ?? p.positionen.map(p2 => ({ ...p2 }))).map((p2, i2) => i2 === idx ? { ...p2, qty: Number(e.target.value) } : p2)
                                    return { ...prev, [output.id]: copy }
                                  })}
                                  style={{ width: 60, padding: '4px 6px', borderRadius: 6, border: '1px solid rgba(96,8,18,0.15)', background: '#faf9f7', color: '#1a0e08', fontSize: 13, textAlign: 'center' }}
                                />
                              ) : (
                                <span style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)' }}>{pos.qty}× {pos.unit || ''}</span>
                              )}
                              {pos.item_id
                                ? <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>Lager</span>
                                : <span style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>Freitext</span>}
                              {isEditing && (
                                <button
                                  type="button"
                                  onClick={() => setEditedPositionen(prev => {
                                    const copy = (prev[output.id] ?? p.positionen.map(p2 => ({ ...p2 }))).filter((_, i2) => i2 !== idx)
                                    return { ...prev, [output.id]: copy }
                                  })}
                                  style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 14, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                >×</button>
                              )}
                            </div>
                          </div>
                        ))}

                        {isEditing && (
                          <div style={{ marginTop: 8, padding: 12, background: '#fff', borderRadius: 8, border: '1px dashed rgba(96,8,18,0.2)' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>Artikel hinzufügen</div>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                              <select
                                className="lager-input"
                                value={addItemId[output.id] ?? ''}
                                onChange={e => setAddItemId(prev => ({ ...prev, [output.id]: e.target.value }))}
                                style={{ flex: 1, padding: '6px 8px', fontSize: 13 }}
                              >
                                <option value="">— Lagerartikel wählen —</option>
                                {allItems.map(item => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}
                              </select>
                              <input type="number" min={1} placeholder="Menge" value={addItemQty[output.id] ?? ''} onChange={e => setAddItemQty(prev => ({ ...prev, [output.id]: Number(e.target.value) }))} className="lager-input" style={{ width: 70, padding: '6px 8px', fontSize: 13, textAlign: 'center' }} />
                              <button type="button" className="lager-btn primary" style={{ padding: '6px 12px', fontSize: 13 }} disabled={!addItemId[output.id]} onClick={() => { const item = allItems.find(i => i.id === (addItemId[output.id] ?? '')); if (!item) return; const qty = addItemQty[output.id] || 1; setEditedPositionen(prev => { const cur = prev[output.id] ?? p.positionen.map(p2 => ({ ...p2 })); return { ...prev, [output.id]: [...cur, { name: item.name, qty, item_id: item.id, unit: item.unit }] } }); setAddItemId(prev => ({ ...prev, [output.id]: '' })); setAddItemQty(prev => ({ ...prev, [output.id]: 1 })) }}>+</button>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input type="text" placeholder="Freitext-Artikel (Name)" value={addFreetext[output.id] ?? ''} onChange={e => setAddFreetext(prev => ({ ...prev, [output.id]: e.target.value }))} className="lager-input" style={{ flex: 1, padding: '6px 8px', fontSize: 13 }} />
                              <input type="number" min={1} placeholder="Menge" value={addItemQty[`${output.id}_ft`] ?? ''} onChange={e => setAddItemQty(prev => ({ ...prev, [`${output.id}_ft`]: Number(e.target.value) }))} className="lager-input" style={{ width: 70, padding: '6px 8px', fontSize: 13, textAlign: 'center' }} />
                              <button type="button" className="lager-btn" style={{ padding: '6px 12px', fontSize: 13 }} disabled={!(addFreetext[output.id] ?? '').trim()} onClick={() => { const name = (addFreetext[output.id] ?? '').trim(); if (!name) return; const qty = addItemQty[`${output.id}_ft`] || 1; setEditedPositionen(prev => { const cur = prev[output.id] ?? p.positionen.map(p2 => ({ ...p2 })); return { ...prev, [output.id]: [...cur, { name, qty }] } }); setAddFreetext(prev => ({ ...prev, [output.id]: '' })); setAddItemQty(prev => ({ ...prev, [`${output.id}_ft`]: 1 })) }}>+</button>
                            </div>
                          </div>
                        )}
                      </div>

                      {withoutItemId.length > 0 && (
                        <div style={{ fontStyle: 'italic', fontSize: 12, color: '#b45309', background: '#fef9c3', borderRadius: 8, padding: '6px 10px', marginBottom: 10 }}>
                          {withoutItemId.length} Position(en) ohne Lager-Verknüpfung — werden nicht ausgebucht
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="lager-btn" onClick={() => ignoreOutput(output)} disabled={isBusy}>Ignorieren</button>
                        <button
                          className="lager-btn primary"
                          onClick={() => ausbuchenAlle(output)}
                          disabled={isBusy || withItemId.length === 0 || !selectedLocId}
                        >
                          {isBusy ? 'Buche aus…' : `Alles ausbuchen (${withItemId.length})`}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
