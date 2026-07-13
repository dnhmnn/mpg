import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import QRCode from 'qrcode'
import type { IScannerControls } from '@zxing/browser'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import StatusBar from '../components/StatusBar'

// Recharts erst beim Öffnen der Statistik laden (eigener Chunk)
const LagerStats = lazy(() => import('../components/LagerStats'))


interface InventoryItem {
  id: string
  name: string
  unit: string
  min_stock: number
  location_min_stocks?: Record<string, number>
  notes?: string
  barcode?: string
  supplier?: string
  supplier_item_no?: string
  supplier_email?: string
  order_url?: string
  auto_order?: boolean
  organization_id: string
  created: string
}

function getMinStock(item: InventoryItem, locationId: string | null): number {
  if (locationId && item.location_min_stocks?.[locationId] !== undefined)
    return item.location_min_stocks[locationId]
  return item.min_stock ?? 0
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

// Fahrzeug-/Rucksack-Checks: Sollausstattung ("Packliste") und durchgeführte Prüfungen
interface KitPosition { item_id: string; name: string; soll: number; unit?: string }
interface Kit {
  id: string
  name: string
  organization_id: string
  positionen: KitPosition[]
  created: string
}
interface KitCheckResult { item_id: string; name: string; soll: number; ist: number; status: 'ok' | 'fehlt' | 'abgelaufen' }
interface KitCheck {
  id: string
  kit_id: string
  kit_name: string
  organization_id: string
  user: string
  status: 'ok' | 'maengel'
  note?: string
  results: KitCheckResult[]
  created: string
}

// Payload-Präfix für selbst erzeugte QR-Etiketten (verweisen direkt auf die Artikel-ID)
const QR_ITEM_PREFIX = 'lager:'

const EMPTY_ITEM_FORM = {
  name: '', unit: 'Stück', min_stock: 0,
  barcode: '', supplier: '', supplier_item_no: '', supplier_email: '', order_url: '',
  auto_order: false,
}

function BarcodeScanner({ onDetect, onError }: { onDetect: (code: string) => void; onError: (msg: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const onDetectRef = useRef(onDetect)
  const onErrorRef = useRef(onError)
  onDetectRef.current = onDetect
  onErrorRef.current = onError

  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    let stopped = false
    let fired = false
    // Decoder + Formate erst beim Öffnen nachladen (hält das Haupt-Bundle klein)
    Promise.all([import('@zxing/browser'), import('@zxing/library')])
      .then(([{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }]) => {
        if (stopped) return undefined
        // Nur die tatsächlich relevanten Formate -> schneller & treffsicherer
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
          BarcodeFormat.ITF, BarcodeFormat.CODABAR,
          BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX,
        ])
        hints.set(DecodeHintType.TRY_HARDER, true)
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 })
        return reader.decodeFromConstraints(
          // Hohe Auflösung -> dünne Barcode-Striche bleiben scharf
          { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } },
          videoRef.current || undefined,
          (result, _err, c) => {
            if (result && !fired && !stopped) {
              fired = true
              c.stop()
              onDetectRef.current(result.getText())
            }
          }
        )
      })
      .then(c => {
        if (!c) return
        controlsRef.current = c
        if (stopped) { c.stop(); return }
        try {
          // Dauer-Autofokus aktivieren (best effort, je nach Gerät)
          c.streamVideoConstraintsApply?.({ advanced: [{ focusMode: 'continuous' }] } as unknown as MediaTrackConstraints)
          // Taschenlampe verfügbar?
          const caps = c.streamVideoCapabilitiesGet?.((t) => [t]) as unknown as { torch?: boolean } | undefined
          if (caps && caps.torch) setTorchAvailable(true)
        } catch { /* optionale Features */ }
      })
      .catch(() => {
        if (!stopped) onErrorRef.current('Kamera nicht verfügbar — bitte Kamerazugriff im Browser erlauben.')
      })
    return () => { stopped = true; controlsRef.current?.stop() }
  }, [])

  async function toggleTorch() {
    try {
      await controlsRef.current?.switchTorch?.(!torchOn)
      setTorchOn(v => !v)
    } catch { /* Torch wird nicht unterstützt */ }
  }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <video ref={videoRef} muted playsInline style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12, background: '#000', display: 'block' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ width: '78%', height: '38%', border: '2px solid rgba(253,232,216,0.9)', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.28)' }} />
        </div>
        {torchAvailable && (
          <button type="button" onClick={toggleTorch} style={{ position: 'absolute', bottom: 10, right: 10, background: torchOn ? '#fde8d8' : 'rgba(26,14,8,0.6)', color: torchOn ? '#600812' : '#fde8d8', border: 'none', borderRadius: 999, padding: '7px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
            {torchOn ? 'Licht aus' : 'Licht an'}
          </button>
        )}
      </div>
      <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', margin: '10px 0 8px', textAlign: 'center' as const }}>
        Barcode mittig in den Rahmen, Kamera ca. 10–15 cm entfernt
      </div>
      {/* Manuelle Eingabe als zuverlässiger Notnagel */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="lager-input"
          style={{ flex: 1 }}
          type="text"
          inputMode="numeric"
          placeholder="Code manuell eingeben"
          value={manualCode}
          onChange={e => setManualCode(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && manualCode.trim()) onDetectRef.current(manualCode.trim()) }}
        />
        <button className="lager-btn primary" disabled={!manualCode.trim()} onClick={() => manualCode.trim() && onDetectRef.current(manualCode.trim())}>OK</button>
      </div>
    </div>
  )
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

  const [itemFormData, setItemFormData] = useState({ ...EMPTY_ITEM_FORM })
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Fahrzeug-/Rucksack-Checks
  const [showKitsModal, setShowKitsModal] = useState(false)
  const [kits, setKits] = useState<Kit[]>([])
  const [kitsLoading, setKitsLoading] = useState(false)
  const [kitEditor, setKitEditor] = useState<{ id: string | null; name: string; positionen: KitPosition[] } | null>(null)
  const [kitItemSearch, setKitItemSearch] = useState('')
  const [runningKit, setRunningKit] = useState<Kit | null>(null)
  const [checkResults, setCheckResults] = useState<KitCheckResult[]>([])
  const [checkNote, setCheckNote] = useState('')
  const [savingCheck, setSavingCheck] = useState(false)
  const [kitHistory, setKitHistory] = useState<KitCheck[]>([])
  const [historyKit, setHistoryKit] = useState<Kit | null>(null)

  // Scanner & Bestellung state
  const [showScanModal, setShowScanModal] = useState(false)
  const [scanMode, setScanMode] = useState<'lookup' | 'form'>('lookup')
  const [scanTeachCode, setScanTeachCode] = useState<string | null>(null)
  const [scanTeachSearch, setScanTeachSearch] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanFoundItem, setScanFoundItem] = useState<InventoryItem | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [openOrders, setOpenOrders] = useState<{ id: string; item_id: string; created: string }[]>([])
  const [sendingOrderTo, setSendingOrderTo] = useState<string | null>(null)
  const [qrLabel, setQrLabel] = useState<{ item: InventoryItem; dataUrl: string } | null>(null)

  // Rückruf / Chargen-Suche
  const [showRecallModal, setShowRecallModal] = useState(false)
  const [recallQuery, setRecallQuery] = useState('')
  const [recallResults, setRecallResults] = useState<StockItem[] | null>(null)
  const [recallLoading, setRecallLoading] = useState(false)

  // Statistik
  const [showStatsModal, setShowStatsModal] = useState(false)

  // KI-Link-Vorschlag
  const [aiSearching, setAiSearching] = useState(false)
  const [aiHint, setAiHint] = useState('')

  // Umlagerung zwischen Standorten
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferItemId, setTransferItemId] = useState('')
  const [transferSearch, setTransferSearch] = useState('')
  const [transferQty, setTransferQty] = useState(1)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [savingTransfer, setSavingTransfer] = useState(false)
  
  const [newLocationName, setNewLocationName] = useState('')

  // Benachrichtigungs-Einstellungen (pro Nutzer)
  const [alertPrefs, setAlertPrefs] = useState({ enabled: false, low: true, expired: true, expiring: true, leadDays: 30, email: '' })
  const [savingAlerts, setSavingAlerts] = useState(false)
  const [alertTestMsg, setAlertTestMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  
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
  const [buchungSearch, setBuchungSearch] = useState('')
  const [savingBuchung, setSavingBuchung] = useState(false)

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
  const [multiBuchungSearch, setMultiBuchungSearch] = useState('')

  // Controlled audit inputs
  const [auditActual, setAuditActual] = useState(0)
  const [auditChecked, setAuditChecked] = useState(false)

  // CSV Import state
  type ImportRow = {
    name: string; qty: number; expiry: string
    matchType: 'exact' | 'similar' | 'none'
    item: InventoryItem | null
    similar: InventoryItem[]
    selectedItem: InventoryItem | null
    createNew: boolean
    included: boolean
  }
  const [showImportModal, setShowImportModal] = useState(false)
  const [importItems, setImportItems] = useState<ImportRow[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user?.organization_id) {
      loadLocations()
      loadAusgabenCount()
      loadLagerSettings()
      // Eigene Benachrichtigungs-Einstellungen übernehmen
      const raw = (user as any).lager_alerts
      let p: any = {}
      try { p = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}) } catch { p = {} }
      setAlertPrefs({
        enabled: p.enabled === true,
        low: p.low !== false,
        expired: p.expired !== false,
        expiring: p.expiring !== false,
        leadDays: typeof p.leadDays === 'number' && p.leadDays > 0 ? p.leadDays : 30,
        email: p.email || '',
      })
    }
  }, [user])

  useEffect(() => {
    if (currentLocationId) {
      loadStock()
    }
  }, [currentLocationId])

  useEffect(() => {
    const item = auditItems[auditIndex]
    if (item) { setAuditActual(item.actual_quantity || 0); setAuditChecked(item.checked || false) }
  }, [auditIndex, auditItems])

  useEffect(() => { if (showAddItemModal) setAiHint('') }, [showAddItemModal])

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
        const locMinStock = getMinStock(item, currentLocationId)
        itemMap.set(item.id, {
          id: item.id,
          name: item.name,
          unit: item.unit,
          min_stock: locMinStock,
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

  async function adjustQty(itemId: string, delta: number, expiryParam?: string, batchParam?: string) {
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
        const batch = (batchParam || '').trim()
        await pb.collection('inventory_stock').create({
          item_id: itemId,
          location_id: currentLocationId,
          quantity: delta,
          expiry_date: expiry || null,
          batch: batch || null,
          organization_id: user?.organization_id
        })

        await pb.collection('inventory_transactions').create({
          item_id: itemId,
          location_id: currentLocationId,
          type: 'einbuchung',
          quantity: delta,
          expiry_date: expiry || null,
          note: batch ? `Charge ${batch}` : '',
          user: user?.email || user?.id,
          organization_id: user?.organization_id
        })

        // Offene Bestellung dieses Artikels als geliefert markieren (Wareneingang schließt den Bestell-Kreislauf)
        try {
          const openOrder = await pb.collection('inventory_orders').getFirstListItem(
            `item_id = "${itemId}" && status = "bestellt" && organization_id = "${user?.organization_id}"`,
            { requestKey: `ord-close-${Date.now()}` }
          )
          await pb.collection('inventory_orders').update(openOrder.id, { status: 'geliefert' })
        } catch { /* keine offene Bestellung oder Collection fehlt */ }
        
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
      setItemFormData({ ...EMPTY_ITEM_FORM })
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

  // SCANNER & BESTELL-FUNKTIONEN
  function openScanner(mode: 'lookup' | 'form') {
    setScanMode(mode)
    setScanTeachCode(null)
    setScanTeachSearch('')
    setScanError(null)
    setScanFoundItem(null)
    setShowScanModal(true)
  }

  function handleScanDetect(code: string) {
    if (scanMode === 'form') {
      setItemFormData(prev => ({ ...prev, barcode: code }))
      setShowScanModal(false)
      showMsg('✅ Code übernommen: ' + code, 'success')
      return
    }
    const item = code.startsWith(QR_ITEM_PREFIX)
      ? allItems.find(i => i.id === code.slice(QR_ITEM_PREFIX.length))
      : allItems.find(i => i.barcode && i.barcode === code)
    if (item) {
      // Aktion wählen lassen (Wareneingang, Entnahme oder Details)
      setScanFoundItem(item)
    } else {
      setScanTeachCode(code)
    }
  }

  function scanOpenDetail(item: InventoryItem) {
    setShowScanModal(false)
    const display = displayItems.find(d => d.id === item.id)
      || { id: item.id, name: item.name, unit: item.unit, min_stock: getMinStock(item, currentLocationId), qty: 0, notes: item.notes, status: 'ok' as const }
    openItemDetail(display)
  }

  function scanOpenBuchung(item: InventoryItem, type: 'ein' | 'aus') {
    setShowScanModal(false)
    setBuchungType(type)
    setSelectedBuchungItem(item.id)
    setBuchungSearch(item.name)
    setBuchungQty(1)
    setBuchungExpiry('')
    setBuchungBatch('')
    setShowBuchungModal(true)
  }

  async function assignBarcode(item: InventoryItem, code: string) {
    try {
      await pb.collection('inventory_items').update(item.id, { barcode: code })
      setAllItems(prev => prev.map(i => i.id === item.id ? { ...i, barcode: code } : i))
      setShowScanModal(false)
      showMsg(`✅ Code mit „${item.name}" verknüpft!`, 'success')
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function orderItem(item: InventoryItem, need?: number) {
    if (item.order_url) {
      // {menge}-Platzhalter -> Warenkorb-Deeplink mit der Bedarfsmenge öffnen
      // (Shopify: /cart/VARIANTE:{menge} · WooCommerce: ?add-to-cart=ID&quantity={menge})
      const qty = need && need > 0 ? need : 1
      window.open(item.order_url.replace(/\{menge\}/gi, String(qty)), '_blank', 'noopener')
      return
    }
    if (!item.supplier_email) return
    const itemNo = item.supplier_item_no ? ` (Art.-Nr. ${item.supplier_item_no})` : ''
    const qtyPart = need && need > 0 ? `${need} ${item.unit || 'Stück'} ` : ''
    const subject = encodeURIComponent(`Bestellung: ${item.name}${itemNo}`)
    const body = encodeURIComponent(`Guten Tag,\n\nhiermit bestellen wir:\n\n• ${qtyPart}${item.name}${itemNo}\n\nMit freundlichen Grüßen\n${user?.name || ''}\n${user?.organization_name || ''}`)
    window.location.href = `mailto:${item.supplier_email}?subject=${subject}&body=${body}`
  }

  function getOrderList() {
    return displayItems
      .filter(d => d.min_stock > 0 && d.qty < d.min_stock)
      .map(d => ({ display: d, raw: allItems.find(i => i.id === d.id), need: d.min_stock - d.qty }))
  }

  // Bestell-Link per KI (Mistral, serverseitig) suchen lassen
  async function suggestLinkViaAi() {
    if (!itemFormData.name.trim()) { alert('Bitte zuerst den Artikelnamen eintragen.'); return }
    setAiSearching(true)
    setAiHint('')
    try {
      // Shop-Domain ableiten: aus dem Bestell-Link-Feld (falls dort eine URL/Domain steht)
      // oder aus einem anderen Artikel desselben Lieferanten
      let domain = ''
      if (itemFormData.order_url.trim()) {
        try { domain = new URL(itemFormData.order_url.trim().startsWith('http') ? itemFormData.order_url.trim() : 'https://' + itemFormData.order_url.trim()).host } catch { /* egal */ }
      }
      if (!domain && itemFormData.supplier) {
        const sibling = allItems.find(i => i.supplier === itemFormData.supplier && i.order_url && i.id !== editingItemId)
        if (sibling?.order_url) { try { domain = new URL(sibling.order_url).host } catch { /* egal */ } }
      }
      const res = await pb.send('/lager/suggest-link', {
        method: 'POST',
        body: {
          name: itemFormData.name.trim(),
          supplier: itemFormData.supplier,
          supplier_item_no: itemFormData.supplier_item_no,
          domain,
        },
      }) as { success?: boolean; url?: string | null; typ?: string; begruendung?: string; error?: string }
      if (res?.success && res.url) {
        setItemFormData(prev => ({ ...prev, order_url: res.url! }))
        if (res.typ === 'shopsuche') {
          setAiHint(`🔎 Shop-Such-Link eingesetzt — ${res.begruendung || 'im Browser öffnen und Produkt anklicken'}.`)
        } else {
          setAiHint(`✓ Vorschlag übernommen${res.begruendung ? ` — ${res.begruendung}` : ''}. Bitte Link kurz prüfen!`)
        }
      } else if (res?.success) {
        setAiHint(res.begruendung || 'Kein passender Link gefunden — Artikelname/Lieferant präzisieren oder manuell eintragen.')
      } else {
        setAiHint('Fehler: ' + (res?.error || 'Unbekannt'))
      }
    } catch (e: any) {
      setAiHint('KI-Suche nicht verfügbar: ' + (e?.message || e) + ' (Hook lager-ki.pb.js + MISTRAL_API_KEY auf dem Server?)')
    } finally {
      setAiSearching(false)
    }
  }

  // Kompletten Lieferanten-Bedarf als EINEN Shop-Warenkorb öffnen (Shopify-Format:
  // alle Artikel haben order_url "https://shop.tld/cart/VARIANTE:{menge}" mit gleichem Host)
  function buildSupplierCartUrl(entries: Array<{ display: DisplayItem; raw?: InventoryItem; need: number }>): string | null {
    let host: string | null = null
    const parts: string[] = []
    for (const e of entries) {
      const m = (e.raw?.order_url || '').match(/^(https?:\/\/[^/]+)\/cart\/(\d+):\{menge\}\/?$/i)
      if (!m) return null
      if (host === null) host = m[1]
      else if (host !== m[1]) return null
      parts.push(`${m[2]}:${e.need}`)
    }
    return host && parts.length ? `${host}/cart/${parts.join(',')}` : null
  }

  // Offene Bestellungen laden (für "Bestellt am…"-Badges und Doppelbestellungs-Schutz)
  async function loadOpenOrders() {
    try {
      const list = await pb.collection('inventory_orders').getFullList<{ id: string; item_id: string; created: string }>({
        filter: `organization_id = "${user?.organization_id}" && status = "bestellt"`,
        fields: 'id,item_id,created',
        requestKey: `orders-${Date.now()}`,
      })
      setOpenOrders(list)
    } catch {
      setOpenOrders([]) // Collection evtl. noch nicht angelegt
    }
  }

  // Bestell-Mail direkt über den Server (Brevo) an den Lieferanten senden
  async function sendSupplierOrder(email: string, entries: Array<{ display: DisplayItem; raw?: InventoryItem; need: number }>) {
    const supplierName = entries[0]?.raw?.supplier || email
    if (!confirm(`Bestellung mit ${entries.length} Artikel(n) jetzt direkt an ${supplierName} senden?`)) return
    setSendingOrderTo(email)
    try {
      const res = await pb.send('/lager/order', {
        method: 'POST',
        body: {
          supplier_email: email,
          items: entries.map(e => ({
            item_id: e.display.id,
            name: e.display.name,
            qty: e.need,
            unit: e.display.unit || 'Stück',
            supplier_item_no: e.raw?.supplier_item_no || '',
            supplier: e.raw?.supplier || '',
          })),
        },
      }) as { success?: boolean; error?: string }
      if (res?.success) {
        showMsg(`✅ Bestellung an ${supplierName} gesendet!`, 'success')
        await loadOpenOrders()
      } else {
        alert('Fehler: ' + (res?.error || 'Unbekannt'))
      }
    } catch (e: any) {
      alert('Direktversand fehlgeschlagen: ' + (e?.message || e) + '\n\nIst der Hook lager-orders.pb.js auf dem Server installiert? Alternativ die Mail-App-Buttons nutzen.')
    } finally {
      setSendingOrderTo(null)
    }
  }

  function buildOrderMailBody(entries: Array<{ display: DisplayItem; raw?: InventoryItem; need: number }>) {
    const lines = entries.map(e =>
      `• ${e.need} ${e.display.unit || 'Stück'} ${e.display.name}${e.raw?.supplier_item_no ? ` (Art.-Nr. ${e.raw.supplier_item_no})` : ''}`
    )
    return `Guten Tag,\n\nhiermit bestellen wir:\n\n${lines.join('\n')}\n\nMit freundlichen Grüßen\n${user?.name || ''}\n${user?.organization_name || ''}`
  }

  async function copyOrderList() {
    const text = getOrderList().map(e =>
      `${e.need} ${e.display.unit || 'Stück'} — ${e.display.name}${e.raw?.supplier_item_no ? ` (Art.-Nr. ${e.raw.supplier_item_no})` : ''}${e.raw?.supplier ? ` — ${e.raw.supplier}` : ''}`
    ).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      showMsg('✅ Bestellliste kopiert!', 'success')
    } catch {
      alert(text)
    }
  }

  // UMLAGERUNG zwischen Standorten (Charge/MHD wandern mit, FIFO nach MHD)
  async function transferStock() {
    if (!transferItemId) { alert('Bitte Artikel auswählen'); return }
    if (!transferTargetId || transferTargetId === currentLocationId) { alert('Bitte Ziel-Standort auswählen'); return }
    if (transferQty <= 0) { alert('Menge muss größer 0 sein'); return }
    if (savingTransfer) return

    const item = displayItems.find(i => i.id === transferItemId)
    if (!item || item.qty < transferQty) {
      alert(`Nicht genügend Bestand am aktuellen Standort (verfügbar: ${item?.qty ?? 0})`)
      return
    }

    setSavingTransfer(true)
    try {
      const sourceName = locations.find(l => l.id === currentLocationId)?.name || 'Quelle'
      const targetName = locations.find(l => l.id === transferTargetId)?.name || 'Ziel'

      const stockList = await pb.collection('inventory_stock').getFullList<StockItem>({
        filter: `item_id = "${transferItemId}" && location_id = "${currentLocationId}"`,
        sort: 'expiry_date'
      })

      let remaining = transferQty
      for (const stock of stockList) {
        if (remaining <= 0) break
        const take = Math.min(stock.quantity, remaining)

        // Quelle reduzieren
        if (stock.quantity - take <= 0) {
          await pb.collection('inventory_stock').delete(stock.id)
        } else {
          await pb.collection('inventory_stock').update(stock.id, { quantity: stock.quantity - take })
        }

        // Am Ziel anlegen — gleiche Charge + gleiches MHD bleiben erhalten
        await pb.collection('inventory_stock').create({
          item_id: transferItemId,
          location_id: transferTargetId,
          quantity: take,
          expiry_date: stock.expiry_date || null,
          batch: stock.batch || null,
          organization_id: user?.organization_id,
        })

        remaining -= take
      }

      // Protokoll auf beiden Seiten
      await pb.collection('inventory_transactions').create({
        item_id: transferItemId, location_id: currentLocationId,
        type: 'ausbuchung', quantity: -transferQty,
        note: `Umlagerung → ${targetName}`,
        user: user?.email || user?.id, organization_id: user?.organization_id,
      })
      await pb.collection('inventory_transactions').create({
        item_id: transferItemId, location_id: transferTargetId,
        type: 'einbuchung', quantity: transferQty,
        note: `Umlagerung ← ${sourceName}`,
        user: user?.email || user?.id, organization_id: user?.organization_id,
      })

      setShowTransferModal(false)
      setTransferItemId('')
      setTransferSearch('')
      setTransferQty(1)
      setTransferTargetId('')
      await loadStock()
      showMsg(`✅ ${transferQty} ${item.unit || 'Stück'} nach „${targetName}" umgelagert`, 'success')
    } catch (e: any) {
      alert('Fehler: ' + e.message)
    } finally {
      setSavingTransfer(false)
    }
  }

  // RÜCKRUF / CHARGEN-SUCHE (über alle Standorte der Organisation)
  async function searchRecall() {
    const q = recallQuery.trim()
    if (!q) { alert('Chargen-Nr. eingeben'); return }
    setRecallLoading(true)
    setRecallResults(null)
    try {
      const list = await pb.collection('inventory_stock').getFullList<StockItem>({
        filter: `organization_id = "${user?.organization_id}" && batch ~ "${q.replace(/"/g, '')}"`,
        sort: 'location_id',
      })
      setRecallResults(list)
    } catch (e: any) {
      alert('Fehler: ' + e.message)
    } finally {
      setRecallLoading(false)
    }
  }

  async function recallStockEntry(s: StockItem) {
    const itemName = allItems.find(i => i.id === s.item_id)?.name || 'Artikel'
    if (!confirm(`${s.quantity}x „${itemName}" (Charge ${s.batch}) wegen Rückruf ausbuchen?`)) return
    try {
      await pb.collection('inventory_stock').delete(s.id)
      await pb.collection('inventory_transactions').create({
        item_id: s.item_id,
        location_id: s.location_id,
        type: 'ausbuchung',
        quantity: -s.quantity,
        note: `Rückruf Charge ${s.batch}`,
        user: user?.email || user?.id,
        organization_id: user?.organization_id,
      })
      setRecallResults(prev => prev ? prev.filter(x => x.id !== s.id) : prev)
      await loadStock()
      showMsg(`✅ Charge ${s.batch} ausgebucht (Rückruf)`, 'success')
    } catch (e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function showQrLabel(item: InventoryItem) {
    try {
      const dataUrl = await QRCode.toDataURL(QR_ITEM_PREFIX + item.id, { width: 480, margin: 1, color: { dark: '#1a0e08', light: '#ffffff' } })
      setQrLabel({ item, dataUrl })
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function printQrLabel() {
    if (!qrLabel) return
    const w = window.open('', '_blank', 'width=420,height=520')
    if (!w) return
    w.document.write(`<html><head><title>${qrLabel.item.name}</title></head><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif;margin:0;height:100vh;"><img src="${qrLabel.dataUrl}" style="width:280px;height:280px;" /><div style="font-size:18px;font-weight:700;margin-top:12px;text-align:center;">${qrLabel.item.name}</div></body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  // BENACHRICHTIGUNGEN (pro Nutzer)
  async function saveAlertPrefs() {
    if (!user?.id) return
    setSavingAlerts(true)
    try {
      await pb.collection('users').update(user.id, { lager_alerts: alertPrefs })
      showMsg('✅ Benachrichtigungen gespeichert!', 'success')
    } catch (e: any) {
      alert('Fehler: ' + (e?.data ? JSON.stringify(e.data) : e.message) + '\n\nFalls das Feld "lager_alerts" (JSON) in der users-Collection fehlt, bitte erst in PocketBase anlegen.')
    } finally {
      setSavingAlerts(false)
    }
  }

  async function testAlertEmail() {
    if (!user?.organization_id) return
    setAlertTestMsg(null)
    try {
      // Erst aktuelle Einstellungen speichern, damit der Test sie berücksichtigt
      await pb.collection('users').update(user.id, { lager_alerts: alertPrefs })
      const res = await pb.send(`/lager/alerts-test/${user.organization_id}?send=1`, { method: 'GET' }) as any
      const total = (res.low?.length || 0) + (res.expired?.length || 0) + (res.expiring?.length || 0)
      if (res.sendError) {
        setAlertTestMsg({ text: 'E-Mail konnte nicht gesendet werden (SMTP?): ' + res.sendError, type: 'error' })
      } else if (total === 0) {
        setAlertTestMsg({ text: 'Aktuell keine Warnungen — es gäbe nichts zu melden. (Test-Mail nur bei vorhandenen Warnungen)', type: 'success' })
      } else if (res.sent) {
        setAlertTestMsg({ text: `✅ Test-Mail mit ${total} Warnung(en) an ${res.recipient} gesendet.`, type: 'success' })
      } else {
        setAlertTestMsg({ text: `${total} Warnung(en) gefunden, aber kein Versand.`, type: 'error' })
      }
    } catch (e: any) {
      setAlertTestMsg({ text: 'Fehler: ' + (e?.message || 'Server nicht erreichbar — Hook installiert?'), type: 'error' })
    }
  }

  // FAHRZEUG-/RUCKSACK-CHECKS
  async function loadKits() {
    if (!user?.organization_id) return
    setKitsLoading(true)
    try {
      const list = await pb.collection('inventory_kits').getFullList<Kit>({
        filter: `organization_id = "${user.organization_id}"`,
        sort: 'name',
      })
      setKits(list.map(k => ({ ...k, positionen: Array.isArray(k.positionen) ? k.positionen : [] })))
    } catch (e: any) {
      // Collection evtl. noch nicht angelegt
      console.error('Error loading kits:', e)
      setKits([])
    } finally {
      setKitsLoading(false)
    }
  }

  async function saveKit() {
    if (!kitEditor || !user?.organization_id) return
    if (!kitEditor.name.trim()) { alert('Name erforderlich'); return }
    try {
      const data = {
        name: kitEditor.name.trim(),
        positionen: kitEditor.positionen,
        organization_id: user.organization_id,
      }
      if (kitEditor.id) {
        await pb.collection('inventory_kits').update(kitEditor.id, data)
      } else {
        await pb.collection('inventory_kits').create(data)
      }
      setKitEditor(null)
      await loadKits()
      showMsg('✅ Liste gespeichert!', 'success')
    } catch (e: any) {
      alert('Fehler: ' + (e?.data ? JSON.stringify(e.data) : e.message) + '\n\nFalls die Collection "inventory_kits" fehlt, bitte erst in PocketBase anlegen.')
    }
  }

  async function deleteKit(kitId: string) {
    if (!confirm('Diese Sollausstattung wirklich löschen?')) return
    try {
      await pb.collection('inventory_kits').delete(kitId)
      await loadKits()
      showMsg('✅ Liste gelöscht!', 'success')
    } catch (e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // aktuelle Bestandsmenge eines Artikels am aktuellen Standort
  function currentQtyOf(itemId: string): number {
    const d = displayItems.find(i => i.id === itemId)
    return d ? d.qty : 0
  }
  function isExpiredItem(itemId: string): boolean {
    const d = displayItems.find(i => i.id === itemId)
    return d?.status === 'exp'
  }

  function startKitCheck(kit: Kit) {
    setRunningKit(kit)
    setCheckNote('')
    // Vorbefüllen mit dem aktuellen Bestand + automatischer Status-Einschätzung
    setCheckResults(kit.positionen.map(p => {
      const ist = currentQtyOf(p.item_id)
      let status: KitCheckResult['status'] = 'ok'
      if (ist < p.soll) status = 'fehlt'
      else if (isExpiredItem(p.item_id)) status = 'abgelaufen'
      return { item_id: p.item_id, name: p.name, soll: p.soll, ist, status }
    }))
  }

  function setCheckStatus(itemId: string, status: KitCheckResult['status']) {
    setCheckResults(prev => prev.map(r => r.item_id === itemId ? { ...r, status } : r))
  }

  async function saveKitCheck() {
    if (!runningKit || !user?.organization_id) return
    if (savingCheck) return
    setSavingCheck(true)
    try {
      const hasMaengel = checkResults.some(r => r.status !== 'ok')
      await pb.collection('inventory_kit_checks').create({
        kit_id: runningKit.id,
        kit_name: runningKit.name,
        organization_id: user.organization_id,
        user: user?.name || '',
        status: hasMaengel ? 'maengel' : 'ok',
        note: checkNote,
        results: checkResults,
      })
      setRunningKit(null)
      setCheckResults([])
      showMsg(hasMaengel ? '⚠️ Check gespeichert — mit Mängeln' : '✅ Check gespeichert — alles vollständig', 'success')
    } catch (e: any) {
      alert('Fehler: ' + (e?.data ? JSON.stringify(e.data) : e.message) + '\n\nFalls die Collection "inventory_kit_checks" fehlt, bitte erst in PocketBase anlegen.')
    } finally {
      setSavingCheck(false)
    }
  }

  async function openKitHistory(kit: Kit) {
    setHistoryKit(kit)
    setKitHistory([])
    try {
      const list = await pb.collection('inventory_kit_checks').getFullList<KitCheck>({
        filter: `kit_id = "${kit.id}"`,
        sort: '-created',
        limit: 50,
      })
      setKitHistory(list)
    } catch (e: any) {
      console.error('Error loading kit history:', e)
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

  async function loadLagerSettings() {
    try {
      const s = await pb.collection('lager_settings').getFirstListItem(
        `organization_id = "${user?.organization_id}"`
      )
      if (s?.inventur_interval) setInventurSchedule({ interval: s.inventur_interval })
    } catch { /* localStorage fallback stays */ }
  }

  async function saveSchedule() {
    localStorage.setItem('lager_inventur_schedule', JSON.stringify(inventurSchedule))
    try {
      const existing = await pb.collection('lager_settings').getFullList({
        filter: `organization_id = "${user?.organization_id}"`
      })
      if (existing.length > 0) {
        await pb.collection('lager_settings').update(existing[0].id, { inventur_interval: inventurSchedule.interval })
      } else {
        await pb.collection('lager_settings').create({ organization_id: user?.organization_id, inventur_interval: inventurSchedule.interval })
      }
      showMsg('✅ Zeitplan gespeichert!', 'success')
    } catch (e: any) {
      showMsg('Fehler: ' + e.message, 'error')
    }
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

  async function loadAuditItems(auditId: string, locationId?: string): Promise<AuditItem[]> {
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

      return items
    } catch(e: any) {
      console.error('Error loading audit items:', e)
      return []
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

      const updatedItems = await loadAuditItems(currentAudit.id, locId)
      if (updatedItems.every(ai => ai.checked)) {
        await finishInventur()
      } else {
        const nextUnchecked = updatedItems.findIndex(ai => !ai.checked)
        if (nextUnchecked >= 0) setAuditIndex(nextUnchecked)
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
    if (savingBuchung) return
    setSavingBuchung(true)
    const delta = buchungType === 'ein' ? buchungQty : -buchungQty
    try {
      await adjustQty(selectedBuchungItem, delta, buchungExpiry || undefined, buchungType === 'ein' ? buchungBatch : undefined)
      setShowBuchungModal(false)
      setSelectedBuchungItem('')
      setBuchungQty(1)
      setBuchungExpiry('')
      setBuchungBatch('')
      setBuchungSearch('')
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    } finally {
      setSavingBuchung(false)
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
    const rawItem = allItems.find(i => i.id === item.id)
    setDetailItem(item)
    setDetailNote(item.notes || '')
    setDetailSoll(rawItem ? getMinStock(rawItem, currentLocationId) : item.min_stock)
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
    if (!detailItem || !currentLocationId) return
    try {
      const existingItem = allItems.find(i => i.id === detailItem.id)
      const updatedLocationMinStocks = {
        ...(existingItem?.location_min_stocks || {}),
        [currentLocationId]: detailSoll
      }
      await pb.collection('inventory_items').update(detailItem.id, {
        min_stock: detailSoll,
        location_min_stocks: updatedLocationMinStocks,
        notes: detailNote
      })
      setAllItems(prev => prev.map(i => i.id === detailItem.id
        ? { ...i, min_stock: detailSoll, location_min_stocks: updatedLocationMinStocks }
        : i))
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

  function parseImportCSV(text: string): Array<{name: string, qty: number, expiry: string}> {
    const sep = text.includes(';') ? ';' : ','
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) return []
    const header = lines[0].toLowerCase().split(sep)
    const nameIdx = header.findIndex(h => h.includes('artikel') || h.includes('name') || h.includes('bezeichnung'))
    const qtyIdx = header.findIndex(h => h.includes('menge') || h.includes('anzahl') || h.includes('qty') || h.includes('quantity'))
    const expiryIdx = header.findIndex(h => h.includes('ablauf') || h.includes('mhd') || h.includes('expiry') || h.includes('datum'))
    if (nameIdx < 0) return []
    return lines.slice(1).map(line => {
      const cols = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim())
      const rawDate = expiryIdx >= 0 ? cols[expiryIdx] || '' : ''
      let expiry = ''
      if (rawDate) {
        const m = rawDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
        expiry = m ? `${m[3]}-${m[2]}-${m[1]}` : rawDate
      }
      return { name: cols[nameIdx] || '', qty: qtyIdx >= 0 ? parseInt(cols[qtyIdx]) || 1 : 1, expiry }
    }).filter(r => r.name)
  }

  function fuzzyScore(a: string, b: string): number {
    a = a.toLowerCase().trim(); b = b.toLowerCase().trim()
    if (a === b) return 1.0
    if (a.includes(b) || b.includes(a)) return 0.8
    const wa = new Set(a.split(/[\s\-_/]+/).filter(Boolean))
    const wb = new Set(b.split(/[\s\-_/]+/).filter(Boolean))
    const inter = [...wa].filter(w => wb.has(w)).length
    const union = new Set([...wa, ...wb]).size
    return union > 0 ? inter / union : 0
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const rows = parseImportCSV(text)
    const matched: ImportRow[] = rows.map(row => {
      const exact = allItems.find(i => i.name.toLowerCase() === row.name.toLowerCase()) || null
      if (exact) return { ...row, matchType: 'exact' as const, item: exact, similar: [], selectedItem: null, createNew: false, included: true }
      const candidates = allItems
        .map(i => ({ item: i, score: fuzzyScore(row.name, i.name) }))
        .filter(c => c.score >= 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map(c => c.item)
      if (candidates.length > 0) return { ...row, matchType: 'similar' as const, item: null, similar: candidates, selectedItem: candidates[0], createNew: false, included: true }
      return { ...row, matchType: 'none' as const, item: null, similar: [], selectedItem: null, createNew: false, included: false }
    })
    setImportItems(matched)
    setShowImportModal(true)
    if (importFileRef.current) importFileRef.current.value = ''
  }

  async function confirmImport() {
    if (!currentLocationId) return
    setImportLoading(true)
    let booked = 0
    let created = 0
    try {
      for (const row of importItems) {
        if (!row.included && !row.createNew) continue
        let targetItem: InventoryItem | null = null
        if (row.matchType === 'exact') {
          targetItem = row.item
        } else if (row.matchType === 'similar' && row.selectedItem) {
          targetItem = row.selectedItem
        } else if (row.matchType === 'none' && row.createNew) {
          const newItem = await pb.collection('inventory_items').create({
            name: row.name, unit: 'Stück', min_stock: 0,
            organization_id: user?.organization_id, notes: ''
          })
          targetItem = newItem as unknown as InventoryItem
          setAllItems(prev => [...prev, targetItem as InventoryItem])
          created++
        }
        if (!targetItem) continue
        await pb.collection('inventory_stock').create({
          item_id: targetItem.id, location_id: currentLocationId,
          quantity: row.qty, expiry_date: row.expiry || null,
          organization_id: user?.organization_id
        })
        await pb.collection('inventory_transactions').create({
          item_id: targetItem.id, location_id: currentLocationId,
          type: 'einbuchung', quantity: row.qty, note: 'CSV-Import',
          user: user?.email || user?.id, organization_id: user?.organization_id
        })
        booked++
      }
      await loadStock()
      setShowImportModal(false)
      setImportItems([])
      showMsg(`✅ ${booked} eingebucht${created > 0 ? `, ${created} neu angelegt` : ''}`, 'success')
    } catch (e: any) {
      showMsg('Fehler: ' + e.message, 'error')
    } finally {
      setImportLoading(false)
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
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', position: 'sticky', top: 0, zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/hub" style={{ display: 'flex', color: '#600812', textDecoration: 'none', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </a>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--lbf-text)' }}>Lager</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 1 }}>{user?.organization_name || 'Responda'}</div>
          </div>
          <button onClick={() => setShowSettingsModal(true)} style={{ width: 34, height: 34, border: 'none', borderRadius: 8, background: 'rgba(96,8,18,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#600812' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </div>

      {/* ACTION TOOLBAR */}
      <div className="lager-actionbar">
        <button className="lager-action-btn" onClick={() => openScanner('lookup')} title="Artikel scannen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 012-2h2"/><path d="M17 3h2a2 2 0 012 2v2"/><path d="M21 17v2a2 2 0 01-2 2h-2"/><path d="M7 21H5a2 2 0 01-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>
          <span className="lager-action-label">Scannen</span>
        </button>
        <button className="lager-action-btn" onClick={() => { loadOpenOrders(); setShowOrderModal(true) }} title="Bestellliste">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
          <span className="lager-action-label">Bestellen</span>
        </button>
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
        <button className="lager-action-btn" onClick={() => { setBuchungType('ein'); setBuchungSearch(''); setSelectedBuchungItem(''); setBuchungQty(1); setShowBuchungModal(true) }} title="Einbuchen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span className="lager-action-label">Einbuchen</span>
        </button>
        <button className="lager-action-btn" onClick={() => { setBuchungType('aus'); setBuchungSearch(''); setSelectedBuchungItem(''); setBuchungQty(1); setShowBuchungModal(true) }} title="Ausbuchen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span className="lager-action-label">Ausbuchen</span>
        </button>
        <button className="lager-action-btn" onClick={() => { setMultiBuchungType('ein'); setShowMultiBuchungModal(true) }} title="Mehrfachbuchung">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="3" y="13" width="7" height="5" rx="1"/><rect x="14" y="13" width="7" height="5" rx="1"/><line x1="17.5" y1="19" x2="17.5" y2="23"/><line x1="15.5" y1="21" x2="19.5" y2="21"/></svg>
          <span className="lager-action-label">Mehrfach</span>
        </button>
        <button className="lager-action-btn" onClick={() => importFileRef.current?.click()} title="Liste importieren (CSV)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span className="lager-action-label">Import</span>
        </button>
        <input ref={importFileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleImportFile} />
        <button className="lager-action-btn" onClick={exportPDF} title="PDF Export">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
          <span className="lager-action-label">PDF</span>
        </button>
        <button className="lager-action-btn" onClick={() => { loadAuditHistory(); loadOpenAudits(); setShowInventoryModal(true) }} title="Inventur">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/><path d="M9 12h6m-6 4h6"/></svg>
          <span className="lager-action-label">Inventur</span>
        </button>
        <button className="lager-action-btn" onClick={() => { loadKits(); setShowKitsModal(true) }} title="Fahrzeug- & Rucksack-Checks">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          <span className="lager-action-label">Checks</span>
        </button>
        <button className="lager-action-btn" onClick={() => { setTransferItemId(''); setTransferSearch(''); setTransferQty(1); setTransferTargetId(''); setShowTransferModal(true) }} title="Umlagerung zwischen Standorten">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
          <span className="lager-action-label">Umlagern</span>
        </button>
        <button className="lager-action-btn" onClick={() => { setRecallQuery(''); setRecallResults(null); setShowRecallModal(true) }} title="Rückruf: Charge suchen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span className="lager-action-label">Rückruf</span>
        </button>
        <button className="lager-action-btn" onClick={() => setShowStatsModal(true)} title="Statistik & Auswertungen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="10" width="3" height="7" rx="0.5"/><rect x="11" y="5" width="3" height="12" rx="0.5"/><rect x="16" y="13" width="3" height="4" rx="0.5"/></svg>
          <span className="lager-action-label">Statistik</span>
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
          <div style={{ background: 'var(--lbf-card)', borderRadius: 12, padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>OK</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{stats.ok}</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 3 }}>In Ordnung</div>
          </div>
          <div style={{ background: 'var(--lbf-card)', borderRadius: 12, padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Bald</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{stats.warn}</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 3 }}>Bald fällig</div>
          </div>
          <div style={{ background: 'var(--lbf-card)', borderRadius: 12, padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Abgel.</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#600812', lineHeight: 1 }}>{stats.exp}</div>
            <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)', marginTop: 3 }}>Abgelaufen</div>
          </div>
          <div style={{ background: 'var(--lbf-card)', borderRadius: 12, padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-text)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Gesamt</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--lbf-text)', lineHeight: 1 }}>{stats.total}</div>
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
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--warm-gray)', background: 'var(--lbf-card)', borderRadius: 12, fontStyle: 'italic' }}>Lade Lagerdaten...</div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--warm-gray)', background: 'var(--lbf-card)', borderRadius: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--lbf-text)' }}>Keine Artikel gefunden</div>
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
                    background: 'var(--lbf-card)',
                    borderRadius: 12,
                    boxShadow: 'var(--lbf-shadow)',
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
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                    {item.notes && <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{item.notes}</div>}
                    {item.expiry && (
                      <div style={{ fontStyle: 'italic', fontSize: 11, color: expiryColor, marginTop: 2 }}>
                        Ablauf: {new Date(item.expiry).toLocaleDateString('de-DE')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: isLow ? '#d97706' : 'var(--lbf-text)' }}>{item.qty}</div>
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase' as const }}>{item.unit}</div>
                      {item.min_stock > 0 && <div style={{ fontSize: 10, color: isLow ? '#d97706' : 'var(--warm-gray)', fontWeight: 600 }}>Soll: {item.min_stock}</div>}
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
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--lbf-card)', borderTop: '0.5px solid rgba(96,8,18,0.12)', padding: '10px 12px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))', display: 'flex', gap: 8, justifyContent: 'center', zIndex: 100, overflowX: 'auto' }}>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13, color: 'var(--lbf-text)' }}>
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
              onClick={() => { setItemFormData({ ...EMPTY_ITEM_FORM }); setEditingItemId(null); setShowAddItemModal(true) }}
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
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)' }}>{item.name}</div>
                      <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                        {item.unit || 'Stück'} · SOLL: {item.min_stock || 0}
                        {item.supplier ? ` · ${item.supplier}` : ''}
                        {item.barcode ? ' · Code verknüpft' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="lager-btn" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => showQrLabel(item)} title="QR-Etikett erzeugen">QR</button>
                      <button className="lager-btn" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => { setItemFormData({ name: item.name, unit: item.unit, min_stock: item.min_stock, barcode: item.barcode || '', supplier: item.supplier || '', supplier_item_no: item.supplier_item_no || '', supplier_email: item.supplier_email || '', order_url: item.order_url || '', auto_order: !!item.auto_order }); setEditingItemId(item.id); setShowAddItemModal(true) }}>Bearbeiten</button>
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
                  <div style={{ fontWeight: 600, color: 'var(--lbf-text)' }}>{loc.name}</div>
                  <button className="lager-btn" style={{ fontSize: 12, padding: '5px 10px', color: '#600812', borderColor: 'rgba(96,8,18,0.2)' }} onClick={() => deleteLocation(loc.id)} disabled={locations.length <= 1}>Löschen</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Neuer Standort</label>
              <input className="lager-input" type="text" placeholder="Standort-Name" value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} />
              <button className="lager-btn primary" onClick={addLocation}>Standort hinzufügen</button>
            </div>

            {/* Meine Benachrichtigungen */}
            <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.12)', paddingTop: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Meine Benachrichtigungen</div>
              <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 14 }}>Täglicher E-Mail-Digest bei niedrigem Bestand oder ablaufenden Artikeln</div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
                <input type="checkbox" checked={alertPrefs.enabled} onChange={(e) => setAlertPrefs(p => ({ ...p, enabled: e.target.checked }))} style={{ width: 18, height: 18, accentColor: '#600812' }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)' }}>E-Mail-Benachrichtigungen aktiv</span>
              </label>

              <div style={{ opacity: alertPrefs.enabled ? 1 : 0.5, pointerEvents: alertPrefs.enabled ? 'auto' : 'none' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 8 }}>Welche Warnungen</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {([['low', 'Unter Mindestbestand'], ['expired', 'Abgelaufen'], ['expiring', 'Läuft bald ab']] as const).map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input type="checkbox" checked={alertPrefs[key]} onChange={(e) => setAlertPrefs(p => ({ ...p, [key]: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#600812' }} />
                      <span style={{ fontSize: 14, color: 'var(--lbf-text)' }}>{label}</span>
                    </label>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: '0 0 130px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Vorlaufzeit MHD</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input className="lager-input" type="number" min="1" value={alertPrefs.leadDays} onChange={(e) => setAlertPrefs(p => ({ ...p, leadDays: parseInt(e.target.value) || 0 }))} style={{ width: 70 }} />
                      <span style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Tage</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Empfänger</label>
                  <input className="lager-input" type="email" value={alertPrefs.email} onChange={(e) => setAlertPrefs(p => ({ ...p, email: e.target.value }))} placeholder={user?.email || 'deine@email.de'} />
                  <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Leer lassen = an deine eigene Adresse ({user?.email || '—'})</span>
                </div>
              </div>

              {alertTestMsg && (
                <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12, background: alertTestMsg.type === 'success' ? 'rgba(22,163,74,0.08)' : 'rgba(192,57,43,0.08)', color: alertTestMsg.type === 'success' ? '#15803d' : '#b91c1c' }}>
                  {alertTestMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="lager-btn" onClick={testAlertEmail} disabled={!alertPrefs.enabled}>Test-Mail senden</button>
                <button className="lager-btn primary" onClick={saveAlertPrefs} disabled={savingAlerts}>{savingAlerts ? 'Speichern…' : 'Speichern'}</button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
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
                    <span style={{ fontSize: 13, color: 'var(--lbf-text)' }}><strong>Fortschritt:</strong> {auditItems.filter(ai => ai.checked).length} / {auditItems.length} geprüft</span>
                  </div>
                  {auditIndex < auditItems.length && (
                    <div>
                      <div style={{ background: 'rgba(250,249,247,0.8)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)', marginBottom: 6 }}>{auditIndex + 1}. {auditItems[auditIndex]?.expand?.item_id?.name}</div>
                        <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 10 }}>{auditItems[auditIndex]?.expand?.item_id?.unit || 'Stück'}</div>
                        <div style={{ background: 'var(--lbf-card)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 4 }}>Erwarteter Bestand (laut System):</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lbf-text)' }}>{auditItems[auditIndex]?.expected_quantity} {auditItems[auditIndex]?.expand?.item_id?.unit || 'Stück'}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Tatsächlicher Bestand (gezählt):</label>
                          <input className="lager-input" type="number" value={auditActual} onChange={e => setAuditActual(Number(e.target.value))} min="0" style={{ fontSize: 18, fontWeight: 700 }} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--lbf-text)' }}>
                          <input type="checkbox" checked={auditChecked} onChange={e => setAuditChecked(e.target.checked)} />
                          <span>Als geprüft markieren</span>
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                        <button className="lager-btn" onClick={() => setAuditIndex(Math.max(0, auditIndex - 1))} disabled={auditIndex === 0}>Zurück</button>
                        <button className="lager-btn primary" onClick={() => saveAuditItem(auditActual, auditChecked)}>
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
                      <div key={loc.id} style={{ background: 'rgba(250,249,247,0.8)', borderRadius: 12, padding: 16, border: `1px solid ${isOverdue ? '#fecaca' : 'rgba(96,8,18,0.1)'}`, borderLeft: `4px solid ${isOverdue ? '#600812' : openAudit ? '#d97706' : 'var(--lbf-input-border)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)' }}>{loc.name}</div>
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
                    <div style={{ fontWeight: 700, marginBottom: 2, color: 'var(--lbf-text)' }}>{new Date(selectedHistoryAudit.audit_date).toLocaleString('de-DE')}</div>
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
                            <div key={ai.id} style={{ padding: '10px 12px', borderRadius: 8, background: hasDiff ? (diff > 0 ? '#f0fdf4' : '#fef2f2') : 'rgba(250,249,247,0.8)', borderLeft: `3px solid ${hasDiff ? (diff > 0 ? '#16a34a' : '#600812') : 'var(--lbf-input-border)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lbf-text)' }}>{ai.expand?.item_id?.name || ai.item_id}</div>
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
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lbf-text)' }}>{new Date(audit.audit_date).toLocaleString('de-DE')}</div>
                            <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Abgeschlossen</span>
                          </div>
                          <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>
                            <strong style={{ fontStyle: 'normal', color: 'var(--lbf-text)' }}>{locations.find(l => l.id === audit.location_id)?.name || 'Standort'}</strong>
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
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lbf-text)', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Fälligkeiten je Standort:</div>
                    {locations.map(loc => {
                      const nextDue = getNextDueDateForLocation(loc.id)
                      const lastAudit = auditHistory.filter(a => a.location_id === loc.id).sort((a, b) => new Date(b.audit_date).getTime() - new Date(a.audit_date).getTime())[0]
                      const neverAudited = !lastAudit
                      const isOverdue = neverAudited || (nextDue !== null && nextDue < new Date())
                      return (
                        <div key={loc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: isOverdue ? '#fef2f2' : '#f0fdf4', border: `1px solid ${isOverdue ? '#fecaca' : '#bbf7d0'}` }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lbf-text)' }}>{loc.name}</div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, position: 'relative' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Artikel *</label>
              <input
                className="lager-input"
                type="text"
                placeholder="Artikel suchen..."
                value={buchungSearch}
                onChange={e => { setBuchungSearch(e.target.value); setSelectedBuchungItem('') }}
              />
              {buchungSearch && (
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid rgba(96,8,18,0.15)', borderRadius: 8, marginTop: 4, background: 'var(--lbf-card)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  {allItems.filter(i => i.name.toLowerCase().includes(buchungSearch.toLowerCase())).map(item => (
                    <div
                      key={item.id}
                      onClick={() => { setSelectedBuchungItem(item.id); setBuchungSearch(item.name) }}
                      style={{
                        padding: '9px 14px', cursor: 'pointer', fontSize: 14,
                        background: selectedBuchungItem === item.id ? 'rgba(96,8,18,0.05)' : undefined,
                        fontWeight: selectedBuchungItem === item.id ? 700 : 400,
                        borderBottom: '0.5px solid rgba(96,8,18,0.06)',
                        color: 'var(--lbf-text)',
                      }}
                    >{item.name}</div>
                  ))}
                  {allItems.filter(i => i.name.toLowerCase().includes(buchungSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '9px 14px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 13 }}>Keine Artikel gefunden</div>
                  )}
                </div>
              )}
              {selectedBuchungItem && (
                <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
                  ✓ {allItems.find(i => i.id === selectedBuchungItem)?.name}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Menge *</label>
              <input className="lager-input" type="number" value={buchungQty || ''} onChange={(e) => setBuchungQty(Number(e.target.value))} min="1" />
            </div>
            {buchungType === 'ein' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Ablaufdatum (optional)</label>
                  <input className="lager-input" type="date" value={buchungExpiry} onChange={(e) => setBuchungExpiry(e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Chargen-Nr. (optional)</label>
                  <input className="lager-input" type="text" value={buchungBatch} onChange={(e) => setBuchungBatch(e.target.value)} placeholder="LOT / Charge vom Etikett" />
                  <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Ermöglicht bei Hersteller-Rückrufen die schnelle Suche, wo die Charge liegt.</span>
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="lager-btn" onClick={() => setShowBuchungModal(false)}>Abbrechen</button>
              <button className="lager-btn primary" onClick={saveBuchung} disabled={savingBuchung}>{buchungType === 'ein' ? 'Einbuchen' : 'Ausbuchen'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ARTIKEL DETAIL MODAL */}
      {showItemDetailModal && detailItem && (
        <div className="lager-modal-overlay" onClick={() => setShowItemDetailModal(false)}>
          <div className="lager-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 17, fontStyle: 'italic', color: 'var(--lbf-text)' }}>{detailItem.name}</div>
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
                IST: <strong style={{ fontStyle: 'normal', color: 'var(--lbf-text)', fontSize: 16 }}>{detailItem.qty}</strong> {detailItem.unit}
                {detailItem.min_stock > 0 && <span style={{ marginLeft: 8 }}>/ SOLL: {detailItem.min_stock}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button onClick={async () => { await adjustQty(detailItem.id, -1); await reloadDetailStocks(); await loadStock() }} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,0.08)', color: '#dc2626', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <button onClick={async () => { await adjustQty(detailItem.id, 1, ''); await reloadDetailStocks(); await loadStock() }} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(22,163,74,0.08)', color: '#16a34a', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>SOLL für {locations.find(l => l.id === currentLocationId)?.name || 'diesen Standort'}</label>
                <input className="lager-input" type="number" value={detailSoll || ''} onChange={(e) => setDetailSoll(e.target.value === '' ? 0 : (parseInt(e.target.value) || 0))} min="0" />
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

            {detailStockEntries.length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 10 }}>Bestände / Chargen</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                  {detailStockEntries.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(250,249,247,0.8)', borderRadius: 8, fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: 'var(--lbf-text)', minWidth: 44 }}>{s.quantity} {detailItem.unit || 'Stk.'}</span>
                      <span style={{ fontStyle: 'italic', color: s.batch ? '#600812' : 'var(--warm-gray)', fontWeight: s.batch ? 700 : 400 }}>
                        {s.batch ? `Charge ${s.batch}` : 'ohne Charge'}
                      </span>
                      <span style={{ marginLeft: 'auto', fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>
                        {s.expiry_date ? `MHD ${new Date(s.expiry_date).toLocaleDateString('de-DE')}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

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
                      <div style={{ fontWeight: 700, color: 'var(--lbf-text)' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 16 }}>
              {(() => {
                const raw = allItems.find(i => i.id === detailItem.id)
                return raw && (raw.order_url || raw.supplier_email) ? (
                  <button className="lager-btn primary" onClick={() => orderItem(raw, Math.max(detailItem.min_stock - detailItem.qty, 0))}>
                    Bestellen{raw.supplier ? ` · ${raw.supplier}` : ''}
                  </button>
                ) : <span />
              })()}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>Artikel</label>
                <input
                  className="lager-input"
                  type="text"
                  placeholder="Artikel suchen..."
                  value={multiBuchungSearch}
                  onChange={e => { setMultiBuchungSearch(e.target.value); setMultiBuchungNewItemId('') }}
                />
                {multiBuchungSearch && (
                  <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid rgba(96,8,18,0.15)', borderRadius: 8, marginTop: 4, background: 'var(--lbf-card)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', position: 'relative', zIndex: 10 }}>
                    {allItems.filter(i => i.name.toLowerCase().includes(multiBuchungSearch.toLowerCase())).map(item => (
                      <div
                        key={item.id}
                        onClick={() => { setMultiBuchungNewItemId(item.id); setMultiBuchungSearch(item.name) }}
                        style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 14,
                          background: multiBuchungNewItemId === item.id ? 'rgba(96,8,18,0.05)' : undefined,
                          fontWeight: multiBuchungNewItemId === item.id ? 700 : 400,
                          borderBottom: '0.5px solid rgba(96,8,18,0.06)',
                          color: 'var(--lbf-text)',
                        }}
                      >{item.name}</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
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
                <button className="lager-btn primary" style={{ alignSelf: 'flex-end' }} onClick={() => { if (!multiBuchungNewItemId) return; setMultiBuchungItems(prev => [...prev, { itemId: multiBuchungNewItemId, qty: multiBuchungNewQty, expiry: multiBuchungNewExpiry }]); setMultiBuchungNewItemId(''); setMultiBuchungNewQty(1); setMultiBuchungNewExpiry(''); setMultiBuchungSearch('') }}>Hinzufügen</button>
              </div>
            </div>

            {multiBuchungItems.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 8 }}>Buchungsliste</div>
                {multiBuchungItems.map((entry, idx) => {
                  const item = allItems.find(i => i.id === entry.itemId)
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(250,249,247,0.8)', borderRadius: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: 'var(--lbf-text)' }}>{item?.name || entry.itemId}</span>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Barcode / QR-Code</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="lager-input" style={{ flex: 1 }} type="text" value={itemFormData.barcode} onChange={(e) => setItemFormData({...itemFormData, barcode: e.target.value})} placeholder="EAN scannen oder eintippen" />
                <button className="lager-btn" onClick={() => openScanner('form')}>Scannen</button>
              </div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', margin: '4px 0 10px' }}>Bestellung / Lieferant</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Lieferant</label>
                <input className="lager-input" type="text" value={itemFormData.supplier} onChange={(e) => setItemFormData({...itemFormData, supplier: e.target.value})} placeholder="z.B. Söhngen" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Artikel-Nr.</label>
                <input className="lager-input" type="text" value={itemFormData.supplier_item_no} onChange={(e) => setItemFormData({...itemFormData, supplier_item_no: e.target.value})} placeholder="beim Lieferanten" />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Bestell-Link</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="lager-input" style={{ flex: 1 }} type="url" value={itemFormData.order_url} onChange={(e) => setItemFormData({...itemFormData, order_url: e.target.value})} placeholder="https://shop.lieferant.de/artikel..." />
                <button className="lager-btn" onClick={suggestLinkViaAi} disabled={aiSearching} title="Bestell-Link per KI im Netz suchen (Mistral, EU)">
                  {aiSearching ? 'Sucht…' : 'Per KI suchen'}
                </button>
              </div>
              {aiHint && (
                <span style={{ fontSize: 12, fontWeight: 600, color: (aiHint.startsWith('✓') || aiHint.startsWith('🔎')) ? '#15803d' : '#b91c1c' }}>{aiHint}</span>
              )}
              {/(?:[?&](?:search|s|q|sSearch)=)|\/search\b/i.test(itemFormData.order_url) && (
                <div style={{ background: 'rgba(96,8,18,0.04)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--lbf-text)', lineHeight: 1.5 }}>
                    <strong>So hinterlegst du den exakten Artikel:</strong><br />
                    1. Shop-Suche öffnen &nbsp;2. richtiges Produkt anklicken &nbsp;3. Produkt-Link kopieren und hier oben einfügen.
                  </div>
                  <button className="lager-btn" style={{ alignSelf: 'flex-start' }} onClick={() => window.open(itemFormData.order_url, '_blank', 'noopener')}>
                    🔎 Shop-Suche öffnen
                  </button>
                </div>
              )}
              <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
                Tipp: Unterstützt der Shop Warenkorb-Links, landet der Artikel mit {'{menge}'} direkt im Warenkorb — z.B. Shopify: …/cart/VARIANTE:{'{menge}'} · WooCommerce: …/?add-to-cart=ID&quantity={'{menge}'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Bestell-E-Mail</label>
              <input className="lager-input" type="email" value={itemFormData.supplier_email} onChange={(e) => setItemFormData({...itemFormData, supplier_email: e.target.value})} placeholder="bestellung@lieferant.de" />
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 14, opacity: itemFormData.supplier_email ? 1 : 0.5 }}>
              <input type="checkbox" checked={itemFormData.auto_order} disabled={!itemFormData.supplier_email} onChange={(e) => setItemFormData({...itemFormData, auto_order: e.target.checked})} style={{ width: 17, height: 17, accentColor: '#600812', marginTop: 1 }} />
              <span>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--lbf-text)', display: 'block' }}>Automatisch nachbestellen</span>
                <span style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>Bestellt täglich um 07:30 automatisch per E-Mail beim Lieferanten, wenn der Mindestbestand unterschritten ist (erfordert Bestell-E-Mail).</span>
              </span>
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="lager-btn" onClick={() => setShowAddItemModal(false)}>Abbrechen</button>
              <button className="lager-btn primary" onClick={saveItem}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      {/* SCANNER MODAL */}
      {showScanModal && (
        <div className="lager-modal-overlay" onClick={() => setShowScanModal(false)}>
          <div className="lager-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 16 }}>
              {scanMode === 'form' ? 'Code für Artikel scannen' : 'Artikel scannen'}
            </div>
            {scanError ? (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 14, borderRadius: 10, fontSize: 13 }}>{scanError}</div>
            ) : scanFoundItem ? (
              <>
                <div style={{ textAlign: 'center', padding: '6px 0 14px' }}>
                  <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 18, color: 'var(--lbf-text)' }}>{scanFoundItem.name}</div>
                  <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 3 }}>
                    Bestand hier: {displayItems.find(d => d.id === scanFoundItem.id)?.qty ?? 0} {scanFoundItem.unit || 'Stk.'}
                    {' · '}{locations.find(l => l.id === currentLocationId)?.name || 'Lager'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="lager-btn primary" style={{ width: '100%', padding: '12px' }} onClick={() => scanOpenBuchung(scanFoundItem, 'ein')}>
                    Einbuchen (Wareneingang)
                  </button>
                  <button className="lager-btn" style={{ width: '100%', padding: '12px' }} onClick={() => scanOpenBuchung(scanFoundItem, 'aus')}>
                    Ausbuchen (Entnahme)
                  </button>
                  <button className="lager-btn" style={{ width: '100%', padding: '12px' }} onClick={() => scanOpenDetail(scanFoundItem)}>
                    Details ansehen
                  </button>
                  <button className="lager-btn" style={{ width: '100%', padding: '12px', color: 'var(--warm-gray)' }} onClick={() => setScanFoundItem(null)}>
                    Nächsten Artikel scannen
                  </button>
                </div>
              </>
            ) : scanTeachCode ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--lbf-text)' }}>Unbekannter Code:</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#600812', margin: '4px 0 10px', wordBreak: 'break-all' as const }}>{scanTeachCode}</div>
                <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 10 }}>
                  Einmal einem Artikel zuordnen — danach wird er bei jedem Scan automatisch erkannt.
                </div>
                <input className="lager-input" type="text" placeholder="Artikel suchen..." value={scanTeachSearch} onChange={e => setScanTeachSearch(e.target.value)} style={{ marginBottom: 8 }} />
                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                  {allItems.filter(i => !scanTeachSearch || i.name.toLowerCase().includes(scanTeachSearch.toLowerCase())).map(item => (
                    <div key={item.id} onClick={() => assignBarcode(item, scanTeachCode)} style={{ padding: '9px 12px', border: '1px solid rgba(96,8,18,0.1)', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--lbf-text)' }}>
                      {item.name}
                      {item.barcode && <span style={{ fontStyle: 'italic', fontWeight: 400, fontSize: 11, color: 'var(--warm-gray)', marginLeft: 6 }}>hat bereits einen Code</span>}
                    </div>
                  ))}
                </div>
                <button className="lager-btn primary" style={{ width: '100%' }} onClick={() => { setItemFormData({ ...EMPTY_ITEM_FORM, barcode: scanTeachCode }); setEditingItemId(null); setShowScanModal(false); setShowAddItemModal(true) }}>
                  Neuen Artikel mit diesem Code anlegen
                </button>
              </>
            ) : (
              <>
                <BarcodeScanner onDetect={handleScanDetect} onError={(m) => setScanError(m)} />
                <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 10, textAlign: 'center' as const }}>
                  QR-Etikett oder Barcode (EAN) vor die Kamera halten
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="lager-btn" onClick={() => setShowScanModal(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* BESTELLLISTE MODAL */}
      {showOrderModal && (() => {
        const entries = getOrderList()
        const bySupplier = new Map<string, typeof entries>()
        for (const e of entries) {
          const key = e.raw?.supplier_email
          if (key) {
            if (!bySupplier.has(key)) bySupplier.set(key, [])
            bySupplier.get(key)!.push(e)
          }
        }
        return (
          <div className="lager-modal-overlay" onClick={() => setShowOrderModal(false)}>
            <div className="lager-modal" onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 16 }}>
                Bestellliste — {locations.find(l => l.id === currentLocationId)?.name || 'Lager'}
              </div>
              {entries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Alles aufgefüllt — kein Artikel unter Mindestbestand.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', marginBottom: 14 }}>
                    {entries.map(e => {
                      const ord = openOrders.find(o => o.item_id === e.display.id)
                      return (
                        <div key={e.display.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid rgba(96,8,18,0.1)', borderRadius: 8, borderLeft: `3px solid ${ord ? '#16a34a' : '#d97706'}` }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)' }}>{e.display.name}</div>
                            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                              IST {e.display.qty} / SOLL {e.display.min_stock}
                              {e.raw?.supplier ? ` · ${e.raw.supplier}` : ''}
                              {e.raw?.supplier_item_no ? ` · Art.-Nr. ${e.raw.supplier_item_no}` : ''}
                            </div>
                            {ord && (
                              <div style={{ display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 700, color: '#15803d', background: 'rgba(22,163,74,0.09)', borderRadius: 999, padding: '2px 9px' }}>
                                Bestellt am {new Date(ord.created).toLocaleDateString('de-DE')}
                              </div>
                            )}
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 18, color: '#600812', whiteSpace: 'nowrap' as const }}>+{e.need}</div>
                          {!ord && e.raw && (e.raw.order_url || e.raw.supplier_email) && (
                            <button className="lager-btn" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => orderItem(e.raw!, e.need)}>Bestellen</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Array.from(bySupplier.entries()).map(([email, list]) => {
                      const fresh = list.filter(e => !openOrders.some(o => o.item_id === e.display.id))
                      const cartUrl = fresh.length > 0 ? buildSupplierCartUrl(fresh) : null
                      return (
                        <div key={email} style={{ display: 'flex', gap: 8 }}>
                          {cartUrl && (
                            <button
                              className="lager-btn"
                              style={{ flexShrink: 0, padding: '9px 12px' }}
                              title={`Alle ${fresh.length} Artikel gesammelt in den Shop-Warenkorb legen`}
                              onClick={() => window.open(cartUrl, '_blank', 'noopener')}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
                            </button>
                          )}
                          <button
                            className="lager-btn primary"
                            style={{ flex: 1 }}
                            disabled={sendingOrderTo === email || fresh.length === 0}
                            onClick={() => sendSupplierOrder(email, fresh)}
                            title={fresh.length === 0 ? 'Alles bereits bestellt' : `Direkt per E-Mail an ${email} senden`}
                          >
                            {sendingOrderTo === email ? 'Sende…' : fresh.length === 0 ? `${list[0].raw?.supplier || email}: alles bestellt ✓` : `Direkt bestellen bei ${list[0].raw?.supplier || email} (${fresh.length})`}
                          </button>
                          <button
                            className="lager-btn"
                            style={{ flexShrink: 0, padding: '9px 12px' }}
                            title="Stattdessen eigene Mail-App öffnen"
                            onClick={() => {
                              const subject = encodeURIComponent(`Bestellung ${user?.organization_name || ''}`.trim())
                              window.location.href = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(buildOrderMailBody(list))}`
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>
                          </button>
                        </div>
                      )
                    })}
                    <button className="lager-btn" onClick={copyOrderList}>Liste kopieren</button>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button className="lager-btn" onClick={() => setShowOrderModal(false)}>Schließen</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* QR-ETIKETT MODAL */}
      {qrLabel && (
        <div className="lager-modal-overlay" onClick={() => setQrLabel(null)}>
          <div className="lager-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 16 }}>QR-Etikett</div>
            <div style={{ textAlign: 'center' }}>
              <img src={qrLabel.dataUrl} alt="QR-Code" style={{ width: 240, height: 240, borderRadius: 12, border: '1px solid rgba(96,8,18,0.1)', background: '#fff' }} />
              <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 17, color: 'var(--lbf-text)', marginTop: 10 }}>{qrLabel.item.name}</div>
              <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>Ausdrucken und auf Lagerplatz oder Karton kleben</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="lager-btn" onClick={() => setQrLabel(null)}>Schließen</button>
              <button className="lager-btn primary" onClick={printQrLabel}>Drucken</button>
            </div>
          </div>
        </div>
      )}

      {/* FAHRZEUG-/RUCKSACK-CHECKS MODAL */}
      {showKitsModal && (
        <div className="lager-modal-overlay" onClick={() => setShowKitsModal(false)}>
          <div className="lager-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Fahrzeug- & Rucksack-Checks</div>
            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 16 }}>Sollausstattung anlegen und auf Vollständigkeit prüfen</div>
            <button className="lager-btn primary" style={{ width: '100%', marginBottom: 16 }} onClick={() => setKitEditor({ id: null, name: '', positionen: [] })}>
              Neue Sollausstattung anlegen
            </button>
            {kitsLoading ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Lade…</div>
            ) : kits.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch keine Listen — lege z.B. „RTW 1 – Notfallrucksack" an.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                {kits.map(kit => (
                  <div key={kit.id} style={{ border: '1px solid rgba(96,8,18,0.1)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 15, color: 'var(--lbf-text)' }}>{kit.name}</div>
                        <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{kit.positionen.length} Positionen</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' as const }}>
                      <button className="lager-btn primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => startKitCheck(kit)} disabled={kit.positionen.length === 0}>Prüfen</button>
                      <button className="lager-btn" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openKitHistory(kit)}>Verlauf</button>
                      <button className="lager-btn" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setKitEditor({ id: kit.id, name: kit.name, positionen: [...kit.positionen] })}>Bearbeiten</button>
                      <button className="lager-btn" style={{ fontSize: 12, padding: '6px 12px', color: '#600812' }} onClick={() => deleteKit(kit.id)}>Löschen</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="lager-btn" onClick={() => setShowKitsModal(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* KIT-EDITOR MODAL */}
      {kitEditor && (
        <div className="lager-modal-overlay" onClick={() => setKitEditor(null)}>
          <div className="lager-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 16 }}>
              {kitEditor.id ? 'Sollausstattung bearbeiten' : 'Neue Sollausstattung'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Name *</label>
              <input className="lager-input" type="text" value={kitEditor.name} onChange={(e) => setKitEditor({ ...kitEditor, name: e.target.value })} placeholder="z.B. RTW 1 – Notfallrucksack" />
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 6 }}>Positionen ({kitEditor.positionen.length})</div>
            {kitEditor.positionen.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, maxHeight: 220, overflowY: 'auto' }}>
                {kitEditor.positionen.map(pos => (
                  <div key={pos.item_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(250,249,247,0.8)', borderRadius: 8 }}>
                    <div style={{ flex: 1, fontSize: 14, color: 'var(--lbf-text)' }}>{pos.name}</div>
                    <span style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Soll</span>
                    <input className="lager-input" type="number" min="0" value={pos.soll} onChange={(e) => setKitEditor({ ...kitEditor, positionen: kitEditor.positionen.map(p => p.item_id === pos.item_id ? { ...p, soll: parseInt(e.target.value) || 0 } : p) })} style={{ width: 64, padding: '6px 8px' }} />
                    <button className="lager-btn" style={{ fontSize: 12, padding: '5px 9px', color: '#600812' }} onClick={() => setKitEditor({ ...kitEditor, positionen: kitEditor.positionen.filter(p => p.item_id !== pos.item_id) })}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <input className="lager-input" type="text" placeholder="Artikel zur Liste hinzufügen…" value={kitItemSearch} onChange={(e) => setKitItemSearch(e.target.value)} style={{ marginBottom: 6 }} />
            {kitItemSearch && (
              <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid rgba(96,8,18,0.12)', borderRadius: 8, marginBottom: 12 }}>
                {allItems.filter(i => i.name.toLowerCase().includes(kitItemSearch.toLowerCase()) && !kitEditor.positionen.some(p => p.item_id === i.id)).slice(0, 30).map(item => (
                  <div key={item.id} onClick={() => { setKitEditor({ ...kitEditor, positionen: [...kitEditor.positionen, { item_id: item.id, name: item.name, soll: 1, unit: item.unit }] }); setKitItemSearch('') }}
                    style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '0.5px solid rgba(96,8,18,0.06)', color: 'var(--lbf-text)' }}>
                    {item.name}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="lager-btn" onClick={() => setKitEditor(null)}>Abbrechen</button>
              <button className="lager-btn primary" onClick={saveKit}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* KIT-CHECK DURCHFÜHREN MODAL */}
      {runningKit && (
        <div className="lager-modal-overlay" onClick={() => setRunningKit(null)}>
          <div className="lager-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 2 }}>Check durchführen</div>
            <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 17, color: 'var(--lbf-text)', marginBottom: 4 }}>{runningKit.name}</div>
            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 14 }}>
              Vorbelegt aus dem aktuellen Bestand ({locations.find(l => l.id === currentLocationId)?.name || 'Lager'}). Status pro Position prüfen.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto', marginBottom: 14 }}>
              {checkResults.map(r => (
                <div key={r.item_id} style={{ padding: '10px 12px', border: '1px solid rgba(96,8,18,0.1)', borderRadius: 10, borderLeft: `3px solid ${r.status === 'ok' ? '#16a34a' : r.status === 'abgelaufen' ? '#d97706' : '#dc2626'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)' }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', whiteSpace: 'nowrap' as const }}>IST {r.ist} / SOLL {r.soll}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {([['ok', 'Vollständig', '#16a34a'], ['fehlt', 'Fehlt', '#dc2626'], ['abgelaufen', 'Abgelaufen', '#d97706']] as const).map(([val, label, col]) => (
                      <button key={val} onClick={() => setCheckStatus(r.item_id, val)}
                        style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: `1.5px solid ${r.status === val ? col : 'rgba(96,8,18,0.15)'}`, background: r.status === val ? col : 'transparent', color: r.status === val ? '#fff' : 'var(--warm-gray)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Bemerkung (optional)</label>
              <input className="lager-input" type="text" value={checkNote} onChange={(e) => setCheckNote(e.target.value)} placeholder="z.B. Defibrillator-Elektroden nachbestellt" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="lager-btn" onClick={() => setRunningKit(null)}>Abbrechen</button>
              <button className="lager-btn primary" onClick={saveKitCheck} disabled={savingCheck}>{savingCheck ? 'Speichern…' : 'Check abschließen'}</button>
            </div>
          </div>
        </div>
      )}

      {/* KIT-VERLAUF MODAL */}
      {historyKit && (
        <div className="lager-modal-overlay" onClick={() => setHistoryKit(null)}>
          <div className="lager-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 2 }}>Prüf-Verlauf</div>
            <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 17, color: 'var(--lbf-text)', marginBottom: 14 }}>{historyKit.name}</div>
            {kitHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch keine Prüfungen.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
                {kitHistory.map(check => {
                  const maengel = check.results?.filter(r => r.status !== 'ok') || []
                  return (
                    <div key={check.id} style={{ padding: '10px 12px', border: '1px solid rgba(96,8,18,0.1)', borderRadius: 10, borderLeft: `3px solid ${check.status === 'ok' ? '#16a34a' : '#dc2626'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: check.status === 'ok' ? '#15803d' : '#b91c1c' }}>
                          {check.status === 'ok' ? 'Vollständig' : `${maengel.length} Mängel`}
                        </span>
                        <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
                          {check.user} · {new Date(check.created).toLocaleDateString('de-DE')} {new Date(check.created).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {maengel.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--warm-gray)' }}>
                          {maengel.map(m => `${m.name} (${m.status === 'fehlt' ? 'fehlt' : 'abgelaufen'})`).join(', ')}
                        </div>
                      )}
                      {check.note && <div style={{ marginTop: 6, fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>„{check.note}"</div>}
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="lager-btn" onClick={() => setHistoryKit(null)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* STATISTIK MODAL */}
      {showStatsModal && (
        <div className="lager-modal-overlay" onClick={() => setShowStatsModal(false)}>
          <div className="lager-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Statistik</div>
            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 16 }}>Verbrauch und Buchungen über alle Standorte (ohne Umlagerungen)</div>
            <Suspense fallback={<div style={{ textAlign: 'center', padding: 32, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Lade Statistik…</div>}>
              {user?.organization_id && <LagerStats orgId={user.organization_id} items={allItems} />}
            </Suspense>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="lager-btn" onClick={() => setShowStatsModal(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* UMLAGERUNG MODAL */}
      {showTransferModal && (
        <div className="lager-modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="lager-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Umlagerung</div>
            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 14 }}>
              Von „{locations.find(l => l.id === currentLocationId)?.name || 'aktuellem Standort'}" an einen anderen Standort — Charge und MHD wandern mit.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, position: 'relative' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Artikel *</label>
              <input
                className="lager-input"
                type="text"
                placeholder="Artikel suchen..."
                value={transferSearch}
                onChange={e => { setTransferSearch(e.target.value); setTransferItemId('') }}
              />
              {transferSearch && !transferItemId && (
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid rgba(96,8,18,0.15)', borderRadius: 8, marginTop: 4, background: 'var(--lbf-card)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  {displayItems.filter(i => i.qty > 0 && i.name.toLowerCase().includes(transferSearch.toLowerCase())).map(item => (
                    <div
                      key={item.id}
                      onClick={() => { setTransferItemId(item.id); setTransferSearch(item.name) }}
                      style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 14, borderBottom: '0.5px solid rgba(96,8,18,0.06)', color: 'var(--lbf-text)' }}
                    >
                      {item.name}
                      <span style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginLeft: 6 }}>({item.qty} {item.unit || 'Stk.'} verfügbar)</span>
                    </div>
                  ))}
                  {displayItems.filter(i => i.qty > 0 && i.name.toLowerCase().includes(transferSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '9px 14px', color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 13 }}>Kein Artikel mit Bestand gefunden</div>
                  )}
                </div>
              )}
              {transferItemId && (
                <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
                  ✓ {displayItems.find(i => i.id === transferItemId)?.name} — {displayItems.find(i => i.id === transferItemId)?.qty} {displayItems.find(i => i.id === transferItemId)?.unit || 'Stk.'} verfügbar
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Menge *</label>
                <input className="lager-input" type="number" min="1" value={transferQty || ''} onChange={(e) => setTransferQty(Number(e.target.value))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Ziel-Standort *</label>
                <select className="lager-input" value={transferTargetId} onChange={(e) => setTransferTargetId(e.target.value)} style={{ fontFamily: 'inherit' }}>
                  <option value="">Bitte wählen…</option>
                  {locations.filter(l => l.id !== currentLocationId).map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {locations.length <= 1 && (
              <div style={{ padding: '10px 14px', background: 'rgba(217,119,6,0.08)', borderRadius: 8, fontSize: 13, color: '#92400e', marginBottom: 12 }}>
                Es gibt nur einen Standort — lege in den Einstellungen weitere an, um umzulagern.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="lager-btn" onClick={() => setShowTransferModal(false)}>Abbrechen</button>
              <button className="lager-btn primary" onClick={transferStock} disabled={savingTransfer || !transferItemId || !transferTargetId}>
                {savingTransfer ? 'Umlagern…' : 'Umlagern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RÜCKRUF / CHARGEN-SUCHE MODAL */}
      {showRecallModal && (
        <div className="lager-modal-overlay" onClick={() => setShowRecallModal(false)}>
          <div className="lager-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Rückruf — Chargen-Suche</div>
            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 14 }}>
              Findet eine Charge über alle Standorte der Organisation — z.B. bei einem Hersteller-Rückruf.
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                className="lager-input"
                style={{ flex: 1 }}
                type="text"
                placeholder="Chargen-Nr. / LOT eingeben…"
                value={recallQuery}
                onChange={e => setRecallQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') searchRecall() }}
              />
              <button className="lager-btn primary" onClick={searchRecall} disabled={recallLoading}>{recallLoading ? 'Suche…' : 'Suchen'}</button>
            </div>

            {recallResults !== null && (
              recallResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--warm-gray)', fontStyle: 'italic', background: 'rgba(22,163,74,0.05)', borderRadius: 10 }}>
                  Keine Bestände mit dieser Charge — nichts betroffen. ✓
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', marginBottom: 8 }}>
                    {recallResults.length} betroffene(r) Bestand/Bestände gefunden:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                    {recallResults.map(s => {
                      const item = allItems.find(i => i.id === s.item_id)
                      const loc = locations.find(l => l.id === s.location_id)
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid rgba(220,38,38,0.25)', borderLeft: '3px solid #dc2626', borderRadius: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--lbf-text)' }}>{item?.name || 'Unbekannter Artikel'}</div>
                            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                              {s.quantity} {item?.unit || 'Stk.'} · {loc?.name || 'Standort?'} · Charge {s.batch}
                              {s.expiry_date ? ` · MHD ${new Date(s.expiry_date).toLocaleDateString('de-DE')}` : ''}
                            </div>
                          </div>
                          <button className="lager-btn" style={{ fontSize: 12, padding: '6px 10px', color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }} onClick={() => recallStockEntry(s)}>
                            Ausbuchen
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="lager-btn" onClick={() => setShowRecallModal(false)}>Schließen</button>
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
                <div style={{ fontWeight: 600, color: 'var(--lbf-text)' }}>Keine offenen Ausgaben</div>
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
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>Einsatz {p.einsatz}</div>
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
                            Angefordert: <strong style={{ fontStyle: 'normal', color: 'var(--lbf-text)' }}>{p.lager_name}</strong>
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
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'var(--lbf-card)', borderRadius: 8, marginBottom: 4, border: `0.5px solid ${pos.item_id ? 'rgba(34,197,94,0.3)' : 'rgba(96,8,18,0.1)'}` }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--lbf-text)', flex: 1, marginRight: 8 }}>{pos.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {isEditing ? (
                                <input
                                  type="number" min={0}
                                  value={pos.qty}
                                  onChange={e => setEditedPositionen(prev => {
                                    const copy = (prev[output.id] ?? p.positionen.map(p2 => ({ ...p2 }))).map((p2, i2) => i2 === idx ? { ...p2, qty: Number(e.target.value) } : p2)
                                    return { ...prev, [output.id]: copy }
                                  })}
                                  style={{ width: 60, padding: '4px 6px', borderRadius: 6, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', color: 'var(--lbf-text)', fontSize: 13, textAlign: 'center' }}
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
                          <div style={{ marginTop: 8, padding: 12, background: 'var(--lbf-card)', borderRadius: 8, border: '1px dashed rgba(96,8,18,0.2)' }}>
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

      {/* CSV IMPORT MODAL */}
      {showImportModal && (
        <div className="lager-modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="lager-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>CSV-Import</div>
            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 14 }}>
              {importItems.filter(r => r.matchType === 'exact').length} exakt · {importItems.filter(r => r.matchType === 'similar').length} ähnlich · {importItems.filter(r => r.matchType === 'none').length} unbekannt
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {importItems.map((row, i) => {
                const borderColor = row.matchType === 'exact' ? '#16a34a' : row.matchType === 'similar' ? '#d97706' : 'rgba(139,113,90,0.4)'
                const bg = row.matchType === 'exact' ? 'rgba(22,163,74,0.04)' : row.matchType === 'similar' ? 'rgba(217,119,6,0.05)' : 'rgba(139,113,90,0.06)'
                return (
                  <div key={i} style={{ padding: '10px 12px', background: bg, borderRadius: 10, borderLeft: `3px solid ${borderColor}`, opacity: row.included || row.createNew ? 1 : 0.5 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <input type="checkbox" checked={row.included || row.createNew} onChange={e => setImportItems(prev => prev.map((r, j) => j !== i ? r : { ...r, included: row.matchType !== 'none' ? e.target.checked : r.included, createNew: row.matchType === 'none' ? e.target.checked : r.createNew }))} style={{ marginTop: 3, accentColor: '#600812', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--lbf-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.name}
                            {row.matchType === 'exact' && <span style={{ marginLeft: 6, fontSize: 10, color: '#16a34a', fontWeight: 700 }}>✓ ERKANNT</span>}
                            {row.matchType === 'none' && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--warm-gray)', fontWeight: 700 }}>NEU</span>}
                          </div>
                          <div style={{ fontWeight: 700, color: borderColor, fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {row.qty} {(row.matchType === 'exact' ? row.item?.unit : row.matchType === 'similar' ? (row.selectedItem?.unit || 'Stück') : 'Stück')}
                          </div>
                        </div>
                        {row.expiry && <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 1 }}>MHD: {new Date(row.expiry).toLocaleDateString('de-DE')}</div>}
                        {row.matchType === 'similar' && (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ fontSize: 11, color: '#d97706', fontStyle: 'italic', marginBottom: 4 }}>Ähnlicher Artikel — bitte bestätigen:</div>
                            <select
                              value={row.selectedItem?.id || ''}
                              onChange={e => setImportItems(prev => prev.map((r, j) => j !== i ? r : { ...r, selectedItem: allItems.find(a => a.id === e.target.value) || null }))}
                              style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(96,8,18,0.2)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', width: '100%', fontFamily: 'inherit' }}
                            >
                              {row.similar.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                            </select>
                          </div>
                        )}
                        {row.matchType === 'none' && row.createNew && (
                          <div style={{ fontSize: 11, fontStyle: 'italic', color: '#600812', marginTop: 4 }}>Wird als neuer Artikel angelegt</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="lager-btn" onClick={() => setShowImportModal(false)}>Abbrechen</button>
              <button className="lager-btn primary" onClick={confirmImport} disabled={importLoading || !importItems.some(r => r.included || r.createNew)}>
                {importLoading ? 'Importiere…' : `${importItems.filter(r => r.included || r.createNew).length} Artikel importieren`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
