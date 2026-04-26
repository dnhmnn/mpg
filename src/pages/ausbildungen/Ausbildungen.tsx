import React, { useState, useEffect } from 'react'
import PocketBase from 'pocketbase'
import StatusBar from '../../components/StatusBar'
import { useAuth } from '../../hooks/useAuth'

const pb = new PocketBase('https://api.responda.systems')

// PocketBase stores dates as "2026-01-15 14:00:00.000Z" (space instead of T)
// new Date() needs ISO format with T, so we normalize first
function parseDate(str: string | null | undefined): Date {
  if (!str) return new Date(NaN)
  // Replace space separator and ensure Z suffix for Safari compatibility
  let s = str.trim().replace(' ', 'T')
  if (!s.endsWith('Z') && !s.includes('+') && !/ [+-]\d{2}:\d{2}$/.test(s)) {
    s += 'Z'
  }
  return new Date(s)
}

function formatDateForInput(str: string | null | undefined): string {
  if (!str) return ''
  const d = parseDate(str)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 16)
}

function fmtDate(str: string | null | undefined): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return '–'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(str: string | null | undefined): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return '–'
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtTime(str: string | null | undefined): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return '–'
  return d.toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function fmtDayMonth(str: string | null | undefined): string {
  const d = parseDate(str)
  if (isNaN(d.getTime())) return '–'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

interface Termin {
  id: string
  name: string
  description: string
  start_datetime: string
  end_datetime: string
  location: string
  dozent: string
  max_teilnehmer: number
  status: 'geplant' | 'laufend' | 'abgeschlossen' | 'abgesagt'
  konzept_id?: string
  notizen?: string
  einladung_token?: string
  organization_id: string
  created: string
  updated: string
}

interface Teilnehmer {
  id: string
  vorname: string
  nachname: string
  email: string          // PocketBase Auth-Email (Platzhalter, nicht änderbar via API)
  contact_email: string  // Echte Email (normales Text-Feld, frei änderbar)
  telefon: string
  whatsapp: string
  notizen: string
  ausbildung_typ: string
  lernbar_zugang_aktiv: boolean
  organization_id: string
  created: string
}

interface TerminTeilnehmer {
  id: string
  termin_id: string
  teilnehmer_id: string
  status: 'eingeladen' | 'zugesagt' | 'abgesagt' | 'entschuldigt'
  eingeladen_am: string
  eingeladen_via: 'email' | 'whatsapp' | 'persönlich' | 'telefon'
  anwesend: boolean
  notizen: string
  organization_id: string
  expand?: {
    teilnehmer_id?: Teilnehmer
  }
}

interface Dokument {
  id: string
  termin_id: string
  name: string
  typ: 'dozent' | 'teilnehmer'
  datei?: string
  oder_dateien_id?: string
  beschreibung: string
  organization_id: string
  created: string
}

interface Modul {
  id: string
  name: string
  beschreibung: string
  inhalte: ModulInhalt[]
  dauer_minuten: number
  organization_id: string
  created: string
}

interface ModulInhalt {
  typ: 'text' | 'quiz'
  titel: string
  inhalt: string
  reihenfolge: number
}

interface QuizFrage {
  frage: string
  antworten: string[]
  richtige: number
}

interface ModulTermin {
  id: string
  modul_id: string
  termin_id: string
  pflicht: boolean
  frist_datum: string
  organization_id: string
  expand?: {
    modul_id?: Modul
  }
}

interface ModulProgress {
  id: string
  modul_id: string
  teilnehmer_id: string
  termin_id?: string
  fortschritt_prozent: number
  gestartet_am?: string
  abgeschlossen_am?: string
  notizen: string
  organization_id: string
}

interface Ausbildungskonzept {
  id: string
  name: string
  beschreibung: string
  lernziele: string[]
  handlungen: string[]
  koennen: string[]
  wissensanhang_links: {titel: string, url: string}[]
  verknuepfte_module: string[]
  verknuepfte_termine: string[]
  organization_id: string
  created: string
}

interface TerminForm {
  id?: string
  name: string
  description: string
  start_datetime: string
  end_datetime: string
  location: string
  dozent: string
  max_teilnehmer: number
  status: 'geplant' | 'laufend' | 'abgeschlossen' | 'abgesagt'
  konzept_id?: string
  notizen?: string
}

interface TeilnehmerForm {
  id?: string
  vorname: string
  nachname: string
  email: string         // contact_email (echte Email)
  telefon: string
  whatsapp: string
  ausbildung_typ: string
  notizen: string
  lernbar_zugang_aktiv: boolean
}

interface ModulForm {
  id?: string
  name: string
  beschreibung: string
  inhalte: ModulInhalt[]
  dauer_minuten: number
}

interface KonzeptForm {
  id?: string
  name: string
  beschreibung: string
  lernziele: string[]
  handlungen: string[]
  koennen: string[]
  wissensanhang_links: {titel: string, url: string}[]
  verknuepfte_module: string[]
  verknuepfte_termine: string[]
}

export default function Ausbildungen() {
  const { user, loading: authLoading, logout } = useAuth()
  
  const [termine, setTermine] = useState<Termin[]>([])
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([])
  const [terminTeilnehmer, setTerminTeilnehmer] = useState<TerminTeilnehmer[]>([])
  const [dokumente, setDokumente] = useState<Dokument[]>([])
  const [module, setModule] = useState<Modul[]>([])
  const [modulTermine, setModulTermine] = useState<ModulTermin[]>([])
  const [modulProgress, setModulProgress] = useState<ModulProgress[]>([])
  const [konzepte, setKonzepte] = useState<Ausbildungskonzept[]>([])
  const [einladungen, setEinladungen] = useState<{id: string, termin_id: string, name: string, status: string}[]>([])

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null)

  
  const [showAddTerminModal, setShowAddTerminModal] = useState(false)
  const [showTerminDetailModal, setShowTerminDetailModal] = useState(false)
  const [showAddTeilnehmerModal, setShowAddTeilnehmerModal] = useState(false)
  const [showTeilnehmerDetailModal, setShowTeilnehmerDetailModal] = useState(false)
  const [showAddModulModal, setShowAddModulModal] = useState(false)
  const [showUploadDokumentModal, setShowUploadDokumentModal] = useState(false)
  const [showAssignModulModal, setShowAssignModulModal] = useState(false)
  const [showAddKonzeptModal, setShowAddKonzeptModal] = useState(false)
  const [showKonzeptDetailModal, setShowKonzeptDetailModal] = useState(false)
  
  const [terminForm, setTerminForm] = useState<TerminForm>({
    name: '',
    description: '',
    start_datetime: '',
    end_datetime: '',
    location: '',
    dozent: '',
    max_teilnehmer: 20,
    status: 'geplant',
    konzept_id: '',
    notizen: ''
  })
  const [konzeptSuggestions, setKonzeptSuggestions] = useState<Ausbildungskonzept[]>([])
  
  const [teilnehmerForm, setTeilnehmerForm] = useState<TeilnehmerForm>({
    vorname: '',
    nachname: '',
    email: '',
    telefon: '',
    whatsapp: '',
    ausbildung_typ: '',
    notizen: '',
    lernbar_zugang_aktiv: false
  })
  const [originalEmail, setOriginalEmail] = useState('')
  
  const [modulForm, setModulForm] = useState<ModulForm>({
    name: '',
    beschreibung: '',
    inhalte: [],
    dauer_minuten: 60
  })

  const [konzeptForm, setKonzeptForm] = useState<KonzeptForm>({
    name: '',
    beschreibung: '',
    lernziele: [],
    handlungen: [],
    koennen: [],
    wissensanhang_links: [],
    verknuepfte_module: [],
    verknuepfte_termine: []
  })
  
  const [selectedTermin, setSelectedTermin] = useState<Termin | null>(null)
  const [selectedTeilnehmer, setSelectedTeilnehmer] = useState<Teilnehmer | null>(null)
  const [selectedKonzept, setSelectedKonzept] = useState<Ausbildungskonzept | null>(null)
  const [selectedModul, setSelectedModul] = useState<Modul | null>(null)
  const [showModulDetailModal, setShowModulDetailModal] = useState(false)
  const [selectedModulTab, setSelectedModulTab] = useState<'inhalt' | 'teilnehmer'>('inhalt')
  const [currentTerminTab, setCurrentTerminTab] = useState<'uebersicht' | 'teilnehmer' | 'dokumente' | 'module'>('uebersicht')
  const [selectedTeilnehmerDetail, setSelectedTeilnehmerDetail] = useState<Teilnehmer | null>(null)
  const [selectedTeilnehmerTab, setSelectedTeilnehmerTab] = useState<'uebersicht' | 'lernmodule' | 'termine'>('uebersicht')
  const [addModulTeilnehmerId, setAddModulTeilnehmerId] = useState('')
  const [editingQuizBlock, setEditingQuizBlock] = useState<number | null>(null)
  const [newQuizFrage, setNewQuizFrage] = useState('')
  const [newQuizAntworten, setNewQuizAntworten] = useState(['', '', '', ''])
  const [newQuizRichtige, setNewQuizRichtige] = useState(0)
  
const [viewMode, setViewMode] = useState<'termine' | 'teilnehmer' | 'module' | 'konzepte' | 'jahresuebersicht' | 'archiv'>('termine')
  
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTyp, setUploadTyp] = useState<'dozent' | 'teilnehmer'>('teilnehmer')
  const [uploadBeschreibung, setUploadBeschreibung] = useState('')

  const [newLernziel, setNewLernziel] = useState('')
  const [newHandlung, setNewHandlung] = useState('')
  const [newKoennen, setNewKoennen] = useState('')
  const [newLinkTitel, setNewLinkTitel] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')

  const [allUsers, setAllUsers] = useState<any[]>([])
  const [existingUserDetected, setExistingUserDetected] = useState<any>(null)

  useEffect(() => {
    if (user?.organization_id) {
      loadData()
      loadAllUsers()
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
        loadTermine(),
        loadTeilnehmer(),
        loadTerminTeilnehmer(),
        loadDokumente(),
        loadModule(),
        loadModulTermine(),
        loadModulProgress(),
        loadKonzepte(),
      ])
    } catch(e: any) {
      console.error('Fehler beim Laden:', e)
      showMessage('Fehler beim Laden der Daten', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadTermine() {
    try {
      const records = await pb.collection('ausbildungen_termine').getFullList({
        filter: `organization_id = "${user?.organization_id}"`,
        sort: '-start_datetime',
        requestKey: `loadTermine-${Date.now()}`
      })
      setTermine(records)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadTermine:', e)
    }
  }

  async function loadTeilnehmer() {
    try {
      const userRecords = await pb.collection('users').getFullList({
        filter: `organization_id = "${user?.organization_id}" && role = "teilnehmer"`,
        sort: 'name',
        requestKey: `loadTeilnehmer-${Date.now()}`
      })
      const teilnehmerData = userRecords.map(u => ({
        id: u.id,
        vorname: u.name?.split(' ')[0] || '',
        nachname: u.name?.split(' ').slice(1).join(' ') || '',
        // contact_email bevorzugen; falls leer, normale email nehmen (wenn kein Platzhalter)
        email: u.contact_email || (u.email?.includes('@kein-email.intern') ? '' : (u.email || '')),
        contact_email: u.contact_email || '',
        telefon: u.phone || '',
        whatsapp: u.whatsapp || '',
        notizen: u.notizen || '',
        ausbildung_typ: u.ausbildung_typ || '',
        lernbar_zugang_aktiv: u.permissions?.lernbar || false,
        organization_id: u.organization_id,
        created: u.created
      }))
      setTeilnehmer(teilnehmerData)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadTeilnehmer:', e)
    }
  }

  async function loadTerminTeilnehmer() {
    try {
      const records = await pb.collection('ausbildungen_termine_user').getFullList({
        sort: 'created',
        requestKey: `loadTerminTeilnehmer-${Date.now()}`
      })
      setTerminTeilnehmer(records)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadTerminTeilnehmer:', e)
    }
  }

  async function loadDokumente() {
    try {
      const records = await pb.collection('ausbildungen_dokumente').getFullList({
        filter: `organization_id = "${user?.organization_id}"`,
        sort: '-created',
        requestKey: `loadDokumente-${Date.now()}`
      })
      setDokumente(records)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadDokumente:', e)
    }
  }

  async function loadModule() {
    try {
      const records = await pb.collection('ausbildungen_module').getFullList({
        filter: `organization_id = "${user?.organization_id}"`,
        sort: 'name',
        requestKey: `loadModule-${Date.now()}`
      })
      setModule(records)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadModule:', e)
    }
  }

  async function loadModulTermine() {
    try {
      const records = await pb.collection('ausbildungen_module_termine').getFullList({
        expand: 'modul_id',
        sort: '-created',
        requestKey: `loadModulTermine-${Date.now()}`
      })
      setModulTermine(records)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadModulTermine:', e)
    }
  }

  async function loadModulProgress() {
    try {
      const records = await pb.collection('ausbildungen_module_progress').getFullList({
        sort: 'created',
        requestKey: `loadModulProgress-${Date.now()}`
      })
      setModulProgress(records)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadModulProgress:', e)
    }
  }

  async function loadKonzepte() {
    try {
      const records = await pb.collection('ausbildungen_konzepte').getFullList({
        filter: `organization_id = "${user?.organization_id}"`,
        sort: '-created',
        requestKey: `loadKonzepte-${Date.now()}`
      })
      setKonzepte(records)
    } catch(e: any) {
      if (e?.status !== 404) console.error('loadKonzepte:', e)
    }
  }





  async function loadAllUsers() {
    try {
      const users = await pb.collection('users').getFullList({
        filter: `organization_id = "${user?.organization_id}"`
      })
      setAllUsers(users)
    } catch(e) {
      console.error('Fehler beim Laden der User:', e)
    }
  }

  async function checkExistingUser(email: string) {
    if (!email || !email.includes('@')) {
      setExistingUserDetected(null)
      return
    }

    try {
      // Suche in BEIDEN Email-Feldern: auth email UND contact_email
      const existingUsers = await pb.collection('users').getFullList({
        filter: `organization_id = "${user?.organization_id}" && (email = "${email}" || contact_email = "${email}")`
      })

      if (existingUsers.length > 0) {
        const existing = existingUsers[0]
        setExistingUserDetected(existing)
        setTeilnehmerForm(prev => ({
          ...prev,
          vorname: existing.name?.split(' ')[0] || prev.vorname,
          nachname: existing.name?.split(' ').slice(1).join(' ') || prev.nachname,
          telefon: existing.phone || prev.telefon,
          whatsapp: existing.whatsapp || prev.whatsapp,
          ausbildung_typ: existing.ausbildung_typ || prev.ausbildung_typ,
          notizen: existing.notizen || prev.notizen,
          lernbar_zugang_aktiv: existing.permissions?.lernbar || prev.lernbar_zugang_aktiv
        }))
      } else {
        setExistingUserDetected(null)
      }
    } catch(e) {
      console.error('Fehler beim Prüfen:', e)
      setExistingUserDetected(null)
    }
  }

  function showMessage(text: string, type: 'success' | 'error') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  // Aktive Termine (nicht abgeschlossen) im Hauptbereich, abgeschlossene ins Archiv
  const filteredTermine = termine.filter(t => t.status !== 'abgeschlossen')
  const archivTermine = termine.filter(t => t.status === 'abgeschlossen')
  const filteredTeilnehmer = teilnehmer
  const filteredModule = module
  const filteredKonzepte = konzepte

  // TERMIN FUNCTIONS
  function openAddTermin() {
    setTerminForm({
      name: '', description: '', start_datetime: '', end_datetime: '',
      location: '', dozent: '', max_teilnehmer: 20, status: 'geplant',
      konzept_id: '', notizen: ''
    })
    setKonzeptSuggestions([])
    setShowAddTerminModal(true)
  }

  function openEditTermin(termin: Termin) {
    setTerminForm({
      id: termin.id,
      name: termin.name,
      description: termin.description,
      start_datetime: formatDateForInput(termin.start_datetime),
      end_datetime: formatDateForInput(termin.end_datetime),
      location: termin.location,
      dozent: termin.dozent,
      max_teilnehmer: termin.max_teilnehmer,
      status: termin.status,
      konzept_id: termin.konzept_id || '',
      notizen: termin.notizen || ''
    })
    setKonzeptSuggestions([])
    setShowAddTerminModal(true)
  }

  function handleTerminNameChange(name: string) {
    setTerminForm(prev => ({ ...prev, name }))
    // Auto-Matching: suche passende Konzepte anhand des Namens
    if (name.length < 2) { setKonzeptSuggestions([]); return }
    const lower = name.toLowerCase()
    const matches = konzepte.filter(k =>
      k.name.toLowerCase().includes(lower) ||
      lower.includes(k.name.toLowerCase()) ||
      k.beschreibung?.toLowerCase().includes(lower)
    )
    setKonzeptSuggestions(matches.slice(0, 4))
  }

  async function saveTermin() {
    if (!terminForm.name || !terminForm.start_datetime) {
      alert('Bitte Name und Startdatum eingeben')
      return
    }

    // Convert datetime-local values ("2026-04-14T14:00") to full ISO strings
    // PocketBase requires a complete datetime format
    function toISOSafe(val: string): string {
      if (!val) return ''
      const d = new Date(val)
      return isNaN(d.getTime()) ? val : d.toISOString()
    }

    try {
      const { id: _id, ...rest } = terminForm
      const data = {
        ...rest,
        start_datetime: toISOSafe(terminForm.start_datetime),
        end_datetime: terminForm.end_datetime ? toISOSafe(terminForm.end_datetime) : '',
        organization_id: user?.organization_id
      }

      if (terminForm.id) {
        await pb.collection('ausbildungen_termine').update(terminForm.id, data)
        showMessage('Termin aktualisiert', 'success')
      } else {
        await pb.collection('ausbildungen_termine').create(data)
        showMessage('Termin erstellt', 'success')
      }

      setShowAddTerminModal(false)
      await loadTermine()
    } catch(e: any) {
      alert('Fehler beim Speichern: ' + (e?.data ? JSON.stringify(e.data) : e.message))
    }
  }

  async function saveTerminField(terminId: string, fields: Partial<Termin>) {
    try {
      await pb.collection('ausbildungen_termine').update(terminId, fields)
      await loadTermine()
      // selectedTermin aktualisieren
      setSelectedTermin(prev => prev ? { ...prev, ...fields } : prev)
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function generateEinladungsText(termin: Termin): string {
    const datum = fmtDateTime(termin.start_datetime)
    const lines = [
      `📚 Einladung: ${termin.name}`,
      `📅 ${datum}`,
      termin.location ? `📍 ${termin.location}` : '',
      termin.dozent ? `👤 Dozent: ${termin.dozent}` : '',
      termin.description ? `\n${termin.description}` : '',
    ].filter(Boolean)
    return lines.join('\n')
  }

  async function generateEinladungsToken(termin: Termin): Promise<string | null> {
    try {
      const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
      await pb.collection('ausbildungen_einladungs_tokens').create({
        token,
        termin_id: termin.id,
        termin_name: termin.name,
        termin_datum: termin.start_datetime,
        termin_end_datum: termin.end_datetime || '',
        termin_ort: termin.location || '',
        termin_beschreibung: termin.description || '',
        organization_id: termin.organization_id
      }, { requestKey: `token-${Date.now()}` })
      await pb.collection('ausbildungen_termine').update(termin.id, { einladung_token: token }, { requestKey: `termin-token-${Date.now()}` })
      setSelectedTermin(prev => prev ? { ...prev, einladung_token: token } : prev)
      setTermine(prev => prev.map(t => t.id === termin.id ? { ...t, einladung_token: token } : t))
      showMessage('Einladungslink erstellt!', 'success')
      return token
    } catch (e: any) {
      showMessage('Fehler: ' + e.message, 'error')
      return null
    }
  }

  async function deleteTermin(id: string, name: string) {
    if (!confirm(`Termin "${name}" wirklich löschen?`)) return

    try {
      await pb.collection('ausbildungen_termine').delete(id)
      showMessage('Termin gelöscht', 'success')
      await loadData()
    } catch(e: any) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  async function loadEinladungenForTermin(terminId: string) {
    try {
      const res = await pb.collection('ausbildungen_einladungen').getFullList({
        filter: `termin_id = "${terminId}"`,
        requestKey: `einladungen-${terminId}-${Date.now()}`
      })
      setEinladungen(res as any)
    } catch {
      // collection may not exist yet
    }
  }

  function viewTerminDetail(termin: Termin) {
    setSelectedTermin(termin)
    setCurrentTerminTab('uebersicht')
    setShowTerminDetailModal(true)
    loadEinladungenForTermin(termin.id)
  }

  function viewTeilnehmerDetail(t: Teilnehmer) {
    setSelectedTeilnehmerDetail(t)
    setSelectedTeilnehmerTab('uebersicht')
    setShowTeilnehmerDetailModal(true)
  }

  // TEILNEHMER FUNCTIONS
  function openAddTeilnehmer() {
    setTeilnehmerForm({
      vorname: '',
      nachname: '',
      email: '',
      telefon: '',
      whatsapp: '',
      ausbildung_typ: '',
      notizen: '',
      lernbar_zugang_aktiv: false
    })
    setExistingUserDetected(null)
    setShowAddTeilnehmerModal(true)
  }

  function openEditTeilnehmer(teilnehmer: Teilnehmer) {
    setOriginalEmail(teilnehmer.email)
    setTeilnehmerForm({
      id: teilnehmer.id,
      vorname: teilnehmer.vorname,
      nachname: teilnehmer.nachname,
      email: teilnehmer.email,
      telefon: teilnehmer.telefon,
      whatsapp: teilnehmer.whatsapp,
      ausbildung_typ: teilnehmer.ausbildung_typ,
      notizen: teilnehmer.notizen,
      lernbar_zugang_aktiv: teilnehmer.lernbar_zugang_aktiv
    })
    setExistingUserDetected(null)
    setShowAddTeilnehmerModal(true)
  }

  async function saveTeilnehmer() {
  if (!teilnehmerForm.vorname || !teilnehmerForm.nachname) {
    alert('Bitte Vor- und Nachname eingeben')
    return
  }

  if (teilnehmerForm.lernbar_zugang_aktiv && !teilnehmerForm.email) {
    alert('Email erforderlich für Lernbar-Zugang')
    return
  }

  try {
    const fullName = `${teilnehmerForm.vorname} ${teilnehmerForm.nachname}`
    
    const permissions = {
      ausbildungen_manage: false,
      chat: false,
      dashboard: false,
      dateien: false,
      dokumente: false,
      einsaetze: false,
      lager: false,
      lernbar: teilnehmerForm.lernbar_zugang_aktiv,
      patienten: false,
      produktausgabe: false,
      qr: false,
      users_manage: false
    }

    const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).toUpperCase().slice(-6) + '!'
    // Auth-Email: immer Platzhalter (wird für PocketBase-Auth verwendet, nicht änderbar via API)
    const placeholderEmail = `${teilnehmerForm.vorname.toLowerCase()}.${teilnehmerForm.nachname.toLowerCase()}.${Math.random().toString(36).slice(-6)}@kein-email.intern`

    const userData = {
      name: fullName,
      email: placeholderEmail,           // PocketBase Auth-Email (Platzhalter)
      contact_email: teilnehmerForm.email || '', // Echte Email (normales Feld, frei änderbar)
      phone: teilnehmerForm.telefon || '',
      whatsapp: teilnehmerForm.whatsapp || '',
      ausbildung_typ: teilnehmerForm.ausbildung_typ || '',
      notizen: teilnehmerForm.notizen || '',
      role: 'teilnehmer',
      permissions: permissions,
      emailVisibility: true,
      verified: false,
      organization_id: user?.organization_id,
      password: randomPassword,
      passwordConfirm: randomPassword
    }

    if (teilnehmerForm.id) {
      // UPDATE bestehender Teilnehmer
      // contact_email ist ein normales Text-Feld → kann direkt aktualisiert werden
      const updateData = {
        name: fullName,
        contact_email: teilnehmerForm.email || '',
        phone: teilnehmerForm.telefon || '',
        whatsapp: teilnehmerForm.whatsapp || '',
        ausbildung_typ: teilnehmerForm.ausbildung_typ || '',
        notizen: teilnehmerForm.notizen || '',
        permissions: permissions
      }

      await pb.collection('users').update(teilnehmerForm.id, updateData)
      showMessage('Teilnehmer aktualisiert', 'success')

      const oldTeilnehmer = teilnehmer.find(t => t.id === teilnehmerForm.id)
      const kontaktEmail = teilnehmerForm.email || ''
      if (teilnehmerForm.lernbar_zugang_aktiv && !oldTeilnehmer?.lernbar_zugang_aktiv && kontaktEmail) {
        try {
          // Password-Reset an die contact_email senden
          // (PocketBase requestPasswordReset braucht die auth-email, daher über admins-Umweg nicht möglich)
          // Stattdessen: Info-Meldung
          showMessage('Lernbar aktiviert – bitte Password-Reset in PocketBase Admin auslösen', 'success')
        } catch(e: any) {
          console.error('Password Reset Fehler:', e)
        }
      }
    } else {
      // CREATE: Prüfe ob User bereits existiert (in auth-email ODER contact_email)
      let existingUser: any = null

      if (teilnehmerForm.email) {
        try {
          const found = await pb.collection('users').getFullList({
            filter: `organization_id = "${user?.organization_id}" && (email = "${teilnehmerForm.email}" || contact_email = "${teilnehmerForm.email}")`
          })
          if (found.length > 0) existingUser = found[0]
        } catch(e) {
          // ignorieren
        }
      }

      if (existingUser) {
        // BESTEHENDEN USER ALS TEILNEHMER VERKNÜPFEN
        // Kein neuer Login — nur Teilnehmer-Rolle + ggf. Lernbar-Zugang hinzufügen
        const mergedPermissions = {
          ...existingUser.permissions,
          lernbar: teilnehmerForm.lernbar_zugang_aktiv || existingUser.permissions?.lernbar || false
        }
        await pb.collection('users').update(existingUser.id, {
          role: 'teilnehmer',
          contact_email: teilnehmerForm.email || existingUser.contact_email || '',
          phone: teilnehmerForm.telefon || existingUser.phone || '',
          whatsapp: teilnehmerForm.whatsapp || existingUser.whatsapp || '',
          ausbildung_typ: teilnehmerForm.ausbildung_typ || existingUser.ausbildung_typ || '',
          notizen: teilnehmerForm.notizen || existingUser.notizen || '',
          permissions: mergedPermissions
        })
        showMessage('Bestehender User als Teilnehmer verknüpft', 'success')
      } else {
        // NEUEN USER MIT PLATZHALTER-EMAIL ERSTELLEN
        await pb.collection('users').create(userData)
        if (teilnehmerForm.lernbar_zugang_aktiv && teilnehmerForm.email) {
          try {
            await pb.collection('users').requestPasswordReset(teilnehmerForm.email)
            showMessage('Neuer Teilnehmer erstellt – Passwort-Email gesendet', 'success')
          } catch {
            showMessage('Neuer Teilnehmer erstellt', 'success')
          }
        } else {
          showMessage('Neuer Teilnehmer erstellt', 'success')
        }
      }
    }

    setShowAddTeilnehmerModal(false)
    setExistingUserDetected(null)
    await loadTeilnehmer()
  } catch(e: any) {
    console.error('Kompletter Fehler:', e)
    console.error('Response Data:', e.response)
    console.error('Error Data:', e.data)
    alert('Fehler beim Speichern: ' + JSON.stringify(e.data || e.message))
  }
}
  async function deleteTeilnehmer(id: string, name: string) {
    if (!confirm(`Teilnehmer "${name}" wirklich löschen?`)) return

    try {
      await pb.collection('users').delete(id)
      showMessage('Teilnehmer gelöscht', 'success')
      await loadData()
    } catch(e: any) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  async function toggleLernbarZugang(teilnehmer: Teilnehmer) {
    const newStatus = !teilnehmer.lernbar_zugang_aktiv
    
    if (newStatus && !teilnehmer.email) {
      alert('Email erforderlich für Lernbar-Zugang')
      return
    }

    try {
      const permissions = {
        ausbildungen_manage: false,
        chat: false,
        dashboard: false,
        dateien: false,
        dokumente: false,
        einsaetze: false,
        lager: false,
        lernbar: newStatus,
        patienten: false,
        produktausgabe: false,
        qr: false,
        users_manage: false
      }

      await pb.collection('users').update(teilnehmer.id, { permissions })
      showMessage(newStatus ? 'Lernbar aktiviert' : 'Lernbar deaktiviert', 'success')
      await loadTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // TERMIN-TEILNEHMER FUNCTIONS
  async function addTeilnehmerToTermin(terminId: string, teilnehmerId: string) {
    try {
      await pb.collection('ausbildungen_termine_user').create({
        termin_id: terminId,
        teilnehmer_id: teilnehmerId,
        status: 'eingeladen',
        eingeladen_am: new Date().toISOString(),
        eingeladen_via: 'email',
        anwesend: false,
        notizen: '',
        organization_id: user?.organization_id
      })
      showMessage('Teilnehmer hinzugefügt', 'success')
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message + '\nStatus: ' + e.status + '\nDetails: ' + JSON.stringify(e.data))
    }
  }

  async function addAlleTeilnehmerToTermin(terminId: string) {
    const bereitsZugewiesen = terminTeilnehmer
      .filter(tt => tt.termin_id === terminId)
      .map(tt => tt.teilnehmer_id)
    const fehlende = teilnehmer.filter(t => !bereitsZugewiesen.includes(t.id))
    if (fehlende.length === 0) {
      showMessage('Alle Teilnehmer bereits zugewiesen', 'success')
      return
    }
    try {
      for (const t of fehlende) {
        await pb.collection('ausbildungen_termine_user').create({
          termin_id: terminId,
          teilnehmer_id: t.id,
          status: 'eingeladen',
          eingeladen_am: new Date().toISOString(),
          eingeladen_via: 'email',
          anwesend: false,
          notizen: '',
          organization_id: user?.organization_id
        }, { requestKey: `termin-teilnehmer-${terminId}-${t.id}` })
      }
      showMessage(`${fehlende.length} Teilnehmer hinzugefügt`, 'success')
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function removeTeilnehmerFromTermin(terminTeilnehmerId: string) {
    if (!confirm('Teilnehmer wirklich entfernen?')) return
    
    try {
      await pb.collection('ausbildungen_termine_user').delete(terminTeilnehmerId)
      showMessage('Teilnehmer entfernt', 'success')
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function updateTeilnehmerStatus(terminTeilnehmerId: string, status: string) {
    try {
      await pb.collection('ausbildungen_termine_user').update(terminTeilnehmerId, { status })
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function updateAnwesenheit(terminTeilnehmerId: string, anwesenheit: 'da' | 'krank' | 'entschuldigt' | 'fehlend' | '') {
    try {
      await pb.collection('ausbildungen_termine_user').update(terminTeilnehmerId, {
        status: anwesenheit || 'eingeladen',
        anwesend: anwesenheit === 'da'
      })
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // DOKUMENT FUNCTIONS
  async function uploadDokument() {
    if (!selectedTermin || !uploadFile) {
      alert('Bitte Datei auswählen')
      return
    }

    try {
      const formData = new FormData()
      formData.append('termin_id', selectedTermin.id)
      formData.append('name', uploadFile.name)
      formData.append('typ', uploadTyp)
      formData.append('datei', uploadFile)
      formData.append('beschreibung', uploadBeschreibung)
      formData.append('organization_id', user?.organization_id || '')

      await pb.collection('ausbildungen_dokumente').create(formData)
      showMessage('Dokument hochgeladen', 'success')
      setShowUploadDokumentModal(false)
      setUploadFile(null)
      setUploadBeschreibung('')
      await loadDokumente()
    } catch(e: any) {
      alert('Fehler beim Upload: ' + e.message)
    }
  }

  async function deleteDokument(id: string, name: string) {
    if (!confirm(`Dokument "${name}" wirklich löschen?`)) return

    try {
      await pb.collection('ausbildungen_dokumente').delete(id)
      showMessage('Dokument gelöscht', 'success')
      await loadDokumente()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // MODUL FUNCTIONS
  function openAddModul() {
    setModulForm({
      name: '',
      beschreibung: '',
      inhalte: [],
      dauer_minuten: 60
    })
    setShowAddModulModal(true)
  }

  async function saveModul() {
    if (!modulForm.name) {
      alert('Bitte Name eingeben')
      return
    }

    try {
      const data = {
        ...modulForm,
        organization_id: user?.organization_id
      }

      if (modulForm.id) {
        await pb.collection('ausbildungen_module').update(modulForm.id, data)
        showMessage('Modul aktualisiert', 'success')
      } else {
        await pb.collection('ausbildungen_module').create(data)
        showMessage('Modul erstellt', 'success')
      }

      setShowAddModulModal(false)
      await loadModule()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function openEditModul(m: Modul) {
    setModulForm({
      id: m.id,
      name: m.name,
      beschreibung: m.beschreibung,
      inhalte: m.inhalte ? [...m.inhalte] : [],
      dauer_minuten: m.dauer_minuten
    })
    setShowAddModulModal(true)
  }

  async function deleteModul(id: string, name: string) {
    if (!confirm(`Modul "${name}" wirklich löschen?`)) return
    try {
      await pb.collection('ausbildungen_module').delete(id)
      showMessage('Modul gelöscht', 'success')
      await loadModule()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function openModulDetail(m: Modul) {
    setSelectedModul(m)
    setSelectedModulTab('inhalt')
    setAddModulTeilnehmerId('')
    setShowModulDetailModal(true)
  }

  async function assignTeilnehmerToModul(modulId: string, teilnehmerId: string) {
    if (!teilnehmerId) return
    const already = modulProgress.some(p => p.modul_id === modulId && p.teilnehmer_id === teilnehmerId)
    if (already) { showMessage('Bereits zugewiesen', 'success'); return }
    try {
      await pb.collection('ausbildungen_module_progress').create({
        modul_id: modulId,
        teilnehmer_id: teilnehmerId,
        fortschritt_prozent: 0,
        notizen: '',
        organization_id: user?.organization_id
      }, { requestKey: `modul-progress-${modulId}-${teilnehmerId}` })
      await loadModulProgress()
      showMessage('Teilnehmer hinzugefügt', 'success')
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function assignAllTeilnehmerToModul(modulId: string) {
    const unassigned = teilnehmer.filter(t => !modulProgress.some(p => p.modul_id === modulId && p.teilnehmer_id === t.id))
    if (unassigned.length === 0) { showMessage('Alle bereits zugewiesen', 'success'); return }
    try {
      for (const t of unassigned) {
        await pb.collection('ausbildungen_module_progress').create({
          modul_id: modulId,
          teilnehmer_id: t.id,
          fortschritt_prozent: 0,
          notizen: '',
          organization_id: user?.organization_id
        }, { requestKey: `assign-${modulId}-${t.id}` })
      }
      await loadModulProgress()
      showMessage(`${unassigned.length} Teilnehmer hinzugefügt`, 'success')
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function removeModulTeilnehmer(progressId: string) {
    try {
      await pb.collection('ausbildungen_module_progress').delete(progressId)
      await loadModulProgress()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function toggleModulAbgeschlossen(progressId: string, currentlyDone: boolean) {
    try {
      await pb.collection('ausbildungen_module_progress').update(progressId, {
        abgeschlossen_am: currentlyDone ? null : new Date().toISOString(),
        fortschritt_prozent: currentlyDone ? 0 : 100
      })
      await loadModulProgress()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function addInhaltBlock(typ: 'text' | 'quiz') {
    setModulForm(prev => ({
      ...prev,
      inhalte: [...prev.inhalte, {
        typ,
        titel: '',
        inhalt: typ === 'quiz' ? JSON.stringify({ fragen: [] }) : '',
        reihenfolge: prev.inhalte.length
      }]
    }))
  }

  function removeInhaltBlock(idx: number) {
    setModulForm(prev => ({ ...prev, inhalte: prev.inhalte.filter((_, i) => i !== idx) }))
  }

  function updateInhaltBlock(idx: number, field: 'titel' | 'inhalt', value: string) {
    setModulForm(prev => {
      const inhalte = [...prev.inhalte]
      inhalte[idx] = { ...inhalte[idx], [field]: value }
      return { ...prev, inhalte }
    })
  }

  function addQuizFrage(inhaltIdx: number) {
    if (!newQuizFrage.trim()) return
    const answers = newQuizAntworten.filter(a => a.trim())
    if (answers.length < 2) { alert('Mindestens 2 Antworten angeben'); return }
    setModulForm(prev => {
      const inhalte = [...prev.inhalte]
      const block = inhalte[inhaltIdx]
      let quizData: { fragen: QuizFrage[] } = { fragen: [] }
      try { quizData = JSON.parse(block.inhalt) } catch {}
      quizData.fragen = [...quizData.fragen, { frage: newQuizFrage, antworten: answers, richtige: newQuizRichtige }]
      inhalte[inhaltIdx] = { ...block, inhalt: JSON.stringify(quizData) }
      return { ...prev, inhalte }
    })
    setNewQuizFrage('')
    setNewQuizAntworten(['', '', '', ''])
    setNewQuizRichtige(0)
    setEditingQuizBlock(null)
  }

  function removeQuizFrage(inhaltIdx: number, frageIdx: number) {
    setModulForm(prev => {
      const inhalte = [...prev.inhalte]
      const block = inhalte[inhaltIdx]
      let quizData: { fragen: QuizFrage[] } = { fragen: [] }
      try { quizData = JSON.parse(block.inhalt) } catch {}
      quizData.fragen = quizData.fragen.filter((_, i) => i !== frageIdx)
      inhalte[inhaltIdx] = { ...block, inhalt: JSON.stringify(quizData) }
      return { ...prev, inhalte }
    })
  }

  async function assignModulToTermin(modulId: string, terminId: string, pflicht: boolean, frist: string) {
    try {
      await pb.collection('ausbildungen_module_termine').create({
        modul_id: modulId,
        termin_id: terminId,
        pflicht: pflicht,
        frist_datum: frist,
        organization_id: user?.organization_id
      })
      showMessage('Modul zugewiesen', 'success')
      await loadModulTermine()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // KONZEPT FUNCTIONS
  function openAddKonzept() {
    setKonzeptForm({
      name: '',
      beschreibung: '',
      lernziele: [],
      handlungen: [],
      koennen: [],
      wissensanhang_links: [],
      verknuepfte_module: [],
      verknuepfte_termine: []
    })
    setShowAddKonzeptModal(true)
  }

  function openEditKonzept(konzept: Ausbildungskonzept) {
    setKonzeptForm({
      id: konzept.id,
      name: konzept.name,
      beschreibung: konzept.beschreibung,
      lernziele: konzept.lernziele || [],
      handlungen: konzept.handlungen || [],
      koennen: konzept.koennen || [],
      wissensanhang_links: konzept.wissensanhang_links || [],
      verknuepfte_module: konzept.verknuepfte_module || [],
      verknuepfte_termine: konzept.verknuepfte_termine || []
    })
    setShowAddKonzeptModal(true)
  }

  async function saveKonzept() {
    if (!konzeptForm.name) {
      alert('Bitte Name eingeben')
      return
    }

    try {
      const data = {
        ...konzeptForm,
        organization_id: user?.organization_id
      }

      if (konzeptForm.id) {
        await pb.collection('ausbildungen_konzepte').update(konzeptForm.id, data)
        showMessage('Konzept aktualisiert', 'success')
      } else {
        await pb.collection('ausbildungen_konzepte').create(data)
        showMessage('Konzept erstellt', 'success')
      }

      setShowAddKonzeptModal(false)
      await loadKonzepte()
    } catch(e: any) {
      alert('Fehler beim Speichern: ' + e.message)
    }
  }

  async function deleteKonzept(id: string, name: string) {
    if (!confirm(`Konzept "${name}" wirklich löschen?`)) return

    try {
      await pb.collection('ausbildungen_konzepte').delete(id)
      showMessage('Konzept gelöscht', 'success')
      await loadKonzepte()
    } catch(e: any) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  function viewKonzeptDetail(konzept: Ausbildungskonzept) {
    setSelectedKonzept(konzept)
    setShowKonzeptDetailModal(true)
  }

  function addKonzeptItem(field: 'lernziele' | 'handlungen' | 'koennen') {
    let value = ''
    if (field === 'lernziele') value = newLernziel
    if (field === 'handlungen') value = newHandlung
    if (field === 'koennen') value = newKoennen
    
    if (!value.trim()) return
    
    setKonzeptForm({
      ...konzeptForm,
      [field]: [...konzeptForm[field], value.trim()]
    })
    
    if (field === 'lernziele') setNewLernziel('')
    if (field === 'handlungen') setNewHandlung('')
    if (field === 'koennen') setNewKoennen('')
  }

  function removeKonzeptItem(field: 'lernziele' | 'handlungen' | 'koennen', index: number) {
    const updated = konzeptForm[field].filter((_, i) => i !== index)
    setKonzeptForm({ ...konzeptForm, [field]: updated })
  }

  function addWissensLink() {
    if (!newLinkTitel.trim() || !newLinkUrl.trim()) return
    setKonzeptForm({
      ...konzeptForm,
      wissensanhang_links: [...konzeptForm.wissensanhang_links, {titel: newLinkTitel.trim(), url: newLinkUrl.trim()}]
    })
    setNewLinkTitel('')
    setNewLinkUrl('')
  }

  function removeWissensLink(index: number) {
    const updated = konzeptForm.wissensanhang_links.filter((_, i) => i !== index)
    setKonzeptForm({ ...konzeptForm, wissensanhang_links: updated })
  }

  // HELPER FUNCTIONS
  function getTerminTeilnehmerCount(terminId: string): number {
    return terminTeilnehmer.filter(tt => tt.termin_id === terminId).length
  }

  function getTerminDokumenteCount(terminId: string): number {
    return dokumente.filter(d => d.termin_id === terminId).length
  }

  function getTerminModuleCount(terminId: string): number {
    return modulTermine.filter(mt => mt.termin_id === terminId).length
  }

  const aktuellesJahr = new Date().getFullYear()
  const jahresTermine = termine
    .filter(t => parseDate(t.start_datetime).getFullYear() === aktuellesJahr)
    .sort((a, b) => parseDate(a.start_datetime).getTime() - parseDate(b.start_datetime).getTime())

  const anwesenheitsfarben: {[k: string]: {bg: string, label: string, color: string}} = {
    da:           {bg: '#dcfce7', label: 'Da', color: '#166534'},
    krank:        {bg: '#fef9c3', label: 'Kr', color: '#92400e'},
    entschuldigt: {bg: '#dbeafe', label: 'En', color: '#1e40af'},
    fehlend:      {bg: '#fee2e2', label: 'Fe', color: '#991b1b'},
  }

  return (
    <>
      <StatusBar user={user} onLogout={logout} pageName="Ausbildungen" showHubLink={true} />
      
      {/* ICON TOOLBAR */}
      <div className="action-toolbar">
        <button 
          className={`action-btn ${viewMode === 'termine' ? 'active' : ''}`}
          onClick={() => setViewMode('termine')} 
          title="Termine"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
        <button 
          className={`action-btn ${viewMode === 'teilnehmer' ? 'active' : ''}`}
          onClick={() => setViewMode('teilnehmer')} 
          title="Teilnehmer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </button>
        <button 
          className={`action-btn ${viewMode === 'module' ? 'active' : ''}`}
          onClick={() => setViewMode('module')} 
          title="Lernmodule"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </button>
        <button
          className={`action-btn ${viewMode === 'konzepte' ? 'active' : ''}`}
          onClick={() => setViewMode('konzepte')}
          title="Ausbildungskonzepte"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </button>
        <button
          className={`action-btn ${viewMode === 'jahresuebersicht' ? 'active' : ''}`}
          onClick={() => setViewMode('jahresuebersicht')}
          title="Jahresübersicht"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
        </button>
        <button
          className={`action-btn ${viewMode === 'archiv' ? 'active' : ''}`}
          onClick={() => setViewMode('archiv')}
          title={`Archiv (${archivTermine.length})`}
          style={{position: 'relative'}}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
          </svg>
          {archivTermine.length > 0 && (
            <span style={{position: 'absolute', top: '2px', right: '2px', background: 'var(--text-secondary)', color: 'var(--btn-dark-text)', borderRadius: '50%', width: '14px', height: '14px', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700}}>{archivTermine.length > 9 ? '9+' : archivTermine.length}</span>
          )}
        </button>
        <div style={{flex: 1}} />
        {viewMode === 'termine' && (
          <button className="action-btn primary" onClick={openAddTermin} title="Termin hinzufügen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        )}
        {viewMode === 'teilnehmer' && (
          <button className="action-btn primary" onClick={openAddTeilnehmer} title="Teilnehmer hinzufügen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        )}
        {viewMode === 'module' && (
          <button className="action-btn primary" onClick={openAddModul} title="Modul hinzufügen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        )}
        {viewMode === 'konzepte' && (
          <button className="action-btn primary" onClick={openAddKonzept} title="Konzept hinzufügen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        )}
      </div>

      {message && (
        <div className={`toast toast-${message.type}`}>{message.text}</div>
      )}

      {(viewMode === 'termine' || viewMode === 'teilnehmer' || viewMode === 'module' || viewMode === 'konzepte') && (
      <div className="content">


        {/* TERMINE VIEW */}
        {viewMode === 'termine' && (
          loading ? (
            <div className="empty-state">Lade Termine...</div>
          ) : filteredTermine.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity: 0.3, marginBottom: '16px'}}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <div style={{fontWeight: 700, marginBottom: '8px'}}>Keine Termine</div>
              <div>Erstelle deinen ersten Ausbildungstermin</div>
            </div>
          ) : (
            <div className="cards-grid">
              {filteredTermine.map(termin => {
                const teilnehmerCount = getTerminTeilnehmerCount(termin.id)
                const dokumenteCount = getTerminDokumenteCount(termin.id)
                const moduleCount = getTerminModuleCount(termin.id)
                
                const anwesendCount = terminTeilnehmer.filter(tt => tt.termin_id === termin.id && tt.status === 'da').length
                return (
                  <div
                    key={termin.id}
                    className={`card status-${termin.status}`}
                    onClick={() => viewTerminDetail(termin)}
                  >
                    <div className="card-menu-container">
                      <button 
                        className="menu-dots"
                        onClick={(e) => {
                          e.stopPropagation()
                          const menuId = `menu-${termin.id}`
                          const menu = document.getElementById(menuId)
                          const allMenus = document.querySelectorAll('.card-menu-dropdown')
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
                      <div id={`menu-${termin.id}`} className="card-menu-dropdown">
                        <button 
                          className="menu-item"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditTermin(termin)
                          }}
                        >
                          Bearbeiten
                        </button>
                        <button 
                          className="menu-item danger"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteTermin(termin.id, termin.name)
                          }}
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                    
                    <div className="card-type">
                      {fmtDate(termin.start_datetime)}
                    </div>
                    <div className="card-name">{termin.name}</div>
                    <div className="card-meta">
                      {termin.location && <div>{termin.location}</div>}
                      {termin.dozent && <div>Dozent: {termin.dozent}</div>}
                    </div>
                    
                    <div className="card-status-info">
                      <div className={`status-badge ${termin.status}`}>
                        {termin.status === 'geplant' && 'Geplant'}
                        {termin.status === 'laufend' && 'Laufend'}
                        {termin.status === 'abgeschlossen' && 'Abgeschlossen'}
                        {termin.status === 'abgesagt' && 'Abgesagt'}
                      </div>
                    </div>
                    
                    <div className="card-stats">
                      <div className="stat-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                        </svg>
                        <span>{teilnehmerCount}/{termin.max_teilnehmer}</span>
                      </div>
                      {anwesendCount > 0 && (
                        <div className="stat-item" style={{color: '#16a34a'}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          <span>{anwesendCount} Da</span>
                        </div>
                      )}
                      <div className="stat-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span>{dokumenteCount}</span>
                      </div>
                      <div className="stat-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                        </svg>
                        <span>{moduleCount}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* TEILNEHMER VIEW */}
        {viewMode === 'teilnehmer' && (
          loading ? (
            <div className="empty-state">Lade Teilnehmer...</div>
          ) : filteredTeilnehmer.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity: 0.3, marginBottom: '16px'}}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
              <div style={{fontWeight: 700, marginBottom: '8px'}}>Keine Teilnehmer</div>
              <div>Füge Teilnehmer hinzu oder weise sie einem Termin zu</div>
            </div>
          ) : (
            <div className="cards-grid">
              {filteredTeilnehmer.map(t => (
                <div 
                  key={t.id} 
                  className="card"
                  onClick={() => viewTeilnehmerDetail(t)}
                >
                  <div className="card-menu-container">
                    <button 
                      className="menu-dots"
                      onClick={(e) => {
                        e.stopPropagation()
                        const menuId = `menu-${t.id}`
                        const menu = document.getElementById(menuId)
                        const allMenus = document.querySelectorAll('.card-menu-dropdown')
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
                    <div id={`menu-${t.id}`} className="card-menu-dropdown">
                      <button 
                        className="menu-item"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditTeilnehmer(t)
                        }}
                      >
                        Bearbeiten
                      </button>
                      <button 
                        className="menu-item"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleLernbarZugang(t)
                        }}
                      >
                        {t.lernbar_zugang_aktiv ? 'Lernbar deaktivieren' : 'Lernbar aktivieren'}
                      </button>
                      <button 
                        className="menu-item danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteTeilnehmer(t.id, `${t.vorname} ${t.nachname}`)
                        }}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                  
                  <div className="card-type">{t.ausbildung_typ || 'Teilnehmer'}</div>
                  <div className="card-name">{t.vorname} {t.nachname}</div>
                  <div className="card-meta">
                    {t.email && <div>{t.email}</div>}
                    {t.telefon && <div>{t.telefon}</div>}
                  </div>

                  {/* Persönliche Übersicht */}
                  {(() => {
                    const ttList = terminTeilnehmer.filter(tt => tt.teilnehmer_id === t.id && jahresTermine.some(jt => jt.id === tt.termin_id))
                    const da = ttList.filter(tt => tt.status === 'da').length
                    const prozent = jahresTermine.length > 0 ? Math.round((da / jahresTermine.length) * 100) : 0
                    if (ttList.length === 0) return null
                    return (
                      <div style={{marginTop: '10px'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px'}}>
                          <span>{da} / {jahresTermine.length} Termine besucht</span>
                          <span style={{fontWeight: 700, color: prozent >= 80 ? '#16a34a' : prozent >= 50 ? '#d97706' : '#B03050'}}>{prozent}%</span>
                        </div>
                        <div style={{background: '#e2e8f0', borderRadius: '4px', height: '5px'}}>
                          <div style={{background: prozent >= 80 ? '#22c55e' : prozent >= 50 ? '#eab308' : '#C94D6A', borderRadius: '4px', height: '5px', width: `${Math.min(prozent, 100)}%`}} />
                        </div>
                      </div>
                    )
                  })()}

                  {t.lernbar_zugang_aktiv && (
                    <div className="card-status-info">
                      <div className="status-badge lernbar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                        </svg>
                        <span>Lernbar aktiv</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* MODULE VIEW */}
        {viewMode === 'module' && (
          loading ? (
            <div className="empty-state">Lade Module...</div>
          ) : filteredModule.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity: 0.3, marginBottom: '16px'}}>
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              <div style={{fontWeight: 700, marginBottom: '8px'}}>Keine Module</div>
              <div>Erstelle dein erstes Lernmodul</div>
            </div>
          ) : (
            <div className="cards-grid">
              {filteredModule.map(m => {
                const assigned = modulProgress.filter(p => p.modul_id === m.id)
                const done = assigned.filter(p => p.abgeschlossen_am)
                return (
                  <div key={m.id} className="card" onClick={() => openModulDetail(m)}>
                    <div className="card-menu-container">
                      <button
                        className="menu-dots"
                        onClick={(e) => {
                          e.stopPropagation()
                          const menuId = `menu-m-${m.id}`
                          const menu = document.getElementById(menuId)
                          document.querySelectorAll('.card-menu-dropdown').forEach(el => {
                            if (el.id !== menuId) el.classList.remove('show')
                          })
                          menu?.classList.toggle('show')
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
                        </svg>
                      </button>
                      <div id={`menu-m-${m.id}`} className="card-menu-dropdown">
                        <button className="menu-item" onClick={(e) => { e.stopPropagation(); openEditModul(m) }}>Bearbeiten</button>
                        <button className="menu-item danger" onClick={(e) => { e.stopPropagation(); deleteModul(m.id, m.name) }}>Löschen</button>
                      </div>
                    </div>
                    <div className="card-type">{m.dauer_minuten} Min.</div>
                    <div className="card-name">{m.name}</div>
                    <div className="card-meta">{m.beschreibung && <div>{m.beschreibung}</div>}</div>
                    <div className="card-stats">
                      <div className="stat-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                        </svg>
                        <span>{m.inhalte?.length || 0} Blöcke</span>
                      </div>
                      <div className="stat-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <span>{done.length}/{assigned.length} abgeschlossen</span>
                      </div>
                    </div>
                    {assigned.length > 0 && (
                      <div style={{marginTop: '10px'}}>
                        <div style={{height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden'}}>
                          <div style={{height: '100%', background: '#10b981', borderRadius: '2px', width: `${Math.round((done.length / assigned.length) * 100)}%`, transition: 'width 0.3s'}} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* KONZEPTE VIEW */}
        {viewMode === 'konzepte' && (
          loading ? (
            <div className="empty-state">Lade Konzepte...</div>
          ) : filteredKonzepte.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity: 0.3, marginBottom: '16px'}}>
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <div style={{fontWeight: 700, marginBottom: '8px'}}>Keine Konzepte</div>
              <div>Erstelle dein erstes Ausbildungskonzept</div>
            </div>
          ) : (
            <div className="cards-grid">
              {filteredKonzepte.map(k => (
                <div 
                  key={k.id} 
                  className="card"
                  onClick={() => viewKonzeptDetail(k)}
                >
                  <div className="card-menu-container">
                    <button 
                      className="menu-dots"
                      onClick={(e) => {
                        e.stopPropagation()
                        const menuId = `menu-${k.id}`
                        const menu = document.getElementById(menuId)
                        const allMenus = document.querySelectorAll('.card-menu-dropdown')
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
                    <div id={`menu-${k.id}`} className="card-menu-dropdown">
                      <button 
                        className="menu-item"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditKonzept(k)
                        }}
                      >
                        Bearbeiten
                      </button>
                      <button 
                        className="menu-item danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteKonzept(k.id, k.name)
                        }}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                  
                  <div className="card-type">Konzept</div>
                  <div className="card-name">{k.name}</div>
                  <div className="card-meta">
                    {k.beschreibung && <div>{k.beschreibung}</div>}
                  </div>
                  <div className="card-stats">
                    <div className="stat-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      <span>{k.lernziele?.length || 0} Lernziele</span>
                    </div>
                    <div className="stat-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 11 12 14 22 4"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                      </svg>
                      <span>{k.handlungen?.length || 0} Handlungen</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
      )}

      {/* JAHRESÜBERSICHT VIEW */}
      {viewMode === 'jahresuebersicht' && (
        <div className="content">
          <h2 style={{marginBottom: '8px'}}>Jahresübersicht {aktuellesJahr}</h2>
          <p style={{color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px'}}>
            Anwesenheit aller Teilnehmer bei allen Terminen im Jahr {aktuellesJahr}
          </p>

          {teilnehmer.length === 0 || jahresTermine.length === 0 ? (
            <div className="empty-state">Keine Daten vorhanden</div>
          ) : (
            <div>
              <div>
                {/* Matrix-Tabelle */}
                <div style={{overflowX: 'auto', marginBottom: '32px'}}>
                  <table style={{borderCollapse: 'collapse', width: '100%', fontSize: '13px'}}>
                    <thead>
                      <tr>
                        <th style={{textAlign: 'left', padding: '10px 12px', background: 'var(--bg-subtle)', borderBottom: '2px solid var(--border)', position: 'sticky', left: 0, zIndex: 1, minWidth: '160px'}}>
                          Teilnehmer
                        </th>
                        {jahresTermine.map(t => (
                          <th key={t.id} style={{padding: '10px 8px', background: 'var(--bg-subtle)', borderBottom: '2px solid var(--border)', textAlign: 'center', minWidth: '80px', fontWeight: 600}}>
                            <div>{fmtDayMonth(t.start_datetime)}</div>
                            <div style={{fontWeight: 400, color: 'var(--text-secondary)', fontSize: '11px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{t.name}</div>
                          </th>
                        ))}
                        <th style={{padding: '10px 12px', background: 'var(--bg-subtle)', borderBottom: '2px solid var(--border)', textAlign: 'center', minWidth: '80px'}}>
                          Gesamt
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {teilnehmer.map((t, idx) => {
                        let daCount = 0
                        return (
                          <tr key={t.id} style={{background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-subtle)'}}>
                            <td style={{padding: '10px 12px', fontWeight: 600, borderBottom: '1px solid var(--border)', position: 'sticky', left: 0, background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-subtle)', zIndex: 1}}>
                              {t.vorname} {t.nachname}
                              {t.ausbildung_typ && <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400}}>{t.ausbildung_typ}</div>}
                            </td>
                            {jahresTermine.map(termin => {
                              const tt = terminTeilnehmer.find(tt => tt.termin_id === termin.id && tt.teilnehmer_id === t.id)
                              const status = tt?.status as string | undefined
                              if (status === 'da') daCount++
                              const cfg = status ? anwesenheitsfarben[status] : null
                              return (
                                <td key={termin.id} style={{padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid var(--border)'}}>
                                  {cfg ? (
                                    <span style={{display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '11px'}}>
                                      {cfg.label}
                                    </span>
                                  ) : (
                                    tt ? <span style={{color: 'var(--text-secondary)', fontSize: '11px'}}>–</span>
                                       : <span style={{color: 'var(--border)', fontSize: '11px'}}>·</span>
                                  )}
                                </td>
                              )
                            })}
                            <td style={{padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', fontWeight: 700}}>
                              <span style={{color: daCount > 0 ? '#16a34a' : 'var(--text-secondary)'}}>
                                {daCount}/{jahresTermine.length}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Gesamtauswertung */}
                <h3 style={{marginBottom: '16px'}}>Gesamtauswertung</h3>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px'}}>
                  {teilnehmer.map(t => {
                    const ttList = terminTeilnehmer.filter(tt => tt.teilnehmer_id === t.id && jahresTermine.some(jt => jt.id === tt.termin_id))
                    const da = ttList.filter(tt => (tt.status as string) === 'da').length
                    const krank = ttList.filter(tt => (tt.status as string) === 'krank').length
                    const entschuldigt = ttList.filter(tt => (tt.status as string) === 'entschuldigt').length
                    const fehlend = ttList.filter(tt => (tt.status as string) === 'fehlend').length
                    const prozent = jahresTermine.length > 0 ? Math.round((da / jahresTermine.length) * 100) : 0
                    const erreicht = prozent >= 80
                    return (
                      <div key={t.id} style={{background: 'var(--bg-card)', border: `2px solid ${erreicht ? '#22c55e' : 'var(--border)'}`, borderRadius: '10px', padding: '16px'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
                          <div>
                            <div style={{fontWeight: 700}}>{t.vorname} {t.nachname}</div>
                            {t.ausbildung_typ && <div style={{fontSize: '12px', color: 'var(--text-secondary)'}}>{t.ausbildung_typ}</div>}
                          </div>
                          <span style={{padding: '4px 10px', borderRadius: '6px', background: erreicht ? '#dcfce7' : '#fee2e2', color: erreicht ? '#166534' : '#991b1b', fontWeight: 700, fontSize: '12px'}}>
                            {erreicht ? '✓ Erreicht' : '✗ Nicht erreicht'}
                          </span>
                        </div>
                        <div style={{background: 'var(--bg-subtle)', borderRadius: '6px', height: '8px', marginBottom: '8px'}}>
                          <div style={{background: prozent >= 80 ? '#22c55e' : prozent >= 50 ? '#eab308' : '#C94D6A', borderRadius: '6px', height: '8px', width: `${Math.min(prozent, 100)}%`, transition: 'width 0.3s'}} />
                        </div>
                        <div style={{fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                          <span style={{color: '#16a34a'}}><b>{da}</b> Da</span>
                          <span style={{color: '#d97706'}}><b>{krank}</b> Krank</span>
                          <span style={{color: '#2563eb'}}><b>{entschuldigt}</b> Entsch.</span>
                          <span style={{color: '#B03050'}}><b>{fehlend}</b> Fehlend</span>
                          <span style={{marginLeft: 'auto', fontWeight: 700}}>{prozent}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ARCHIV VIEW */}
      {viewMode === 'archiv' && (
        <div className="content">
          <h2 style={{marginBottom: '4px'}}>Archiv</h2>
          <p style={{color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px'}}>
            Abgeschlossene Termine — nach Jahr sortiert
          </p>
          {archivTermine.length === 0 ? (
            <div className="empty-state">Noch keine abgeschlossenen Termine</div>
          ) : (() => {
            const Jahre = ([...new Set(
              archivTermine.map(t => parseDate(t.start_datetime).getFullYear())
            )] as number[]).sort((a, b) => b - a)
            return (
              <div style={{display: 'flex', flexDirection: 'column', gap: '32px'}}>
                {Jahre.map(jahr => {
                  const jahrTermine = archivTermine
                    .filter(t => parseDate(t.start_datetime).getFullYear() === jahr)
                    .sort((a, b) => parseDate(b.start_datetime).getTime() - parseDate(a.start_datetime).getTime())
                  return (
                    <div key={jahr}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px'}}>
                        <h3 style={{margin: 0, fontSize: '18px'}}>{jahr}</h3>
                        <span style={{fontSize: '13px', color: 'var(--text-secondary)'}}>{jahrTermine.length} Termine</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        {jahrTermine.map(termin => {
                          const ttCount = terminTeilnehmer.filter(tt => tt.termin_id === termin.id).length
                          const daCount = terminTeilnehmer.filter(tt => tt.termin_id === termin.id && tt.status === 'da').length
                          return (
                            <div
                              key={termin.id}
                              onClick={() => viewTerminDetail(termin)}
                              style={{display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', cursor: 'pointer', transition: 'box-shadow 0.15s'}}
                              onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
                              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                            >
                              <div style={{minWidth: '48px', textAlign: 'center'}}>
                                <div style={{fontSize: '18px', fontWeight: 700, lineHeight: 1}}>
                                  {parseDate(termin.start_datetime).getDate().toString().padStart(2,'0')}
                                </div>
                                <div style={{fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase'}}>
                                  {parseDate(termin.start_datetime).toLocaleString('de-DE', {month: 'short'})}
                                </div>
                              </div>
                              <div style={{flex: 1}}>
                                <div style={{fontWeight: 600, fontSize: '15px'}}>{termin.name}</div>
                                <div style={{fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                                  {termin.location && <span>📍 {termin.location}</span>}
                                  {termin.dozent && <span>👤 {termin.dozent}</span>}
                                </div>
                              </div>
                              <div style={{textAlign: 'right', fontSize: '13px'}}>
                                {ttCount > 0 && (
                                  <div>
                                    <span style={{color: '#16a34a', fontWeight: 700}}>{daCount}</span>
                                    <span style={{color: 'var(--text-secondary)'}}> / {ttCount} Da</span>
                                  </div>
                                )}
                                <div style={{fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px'}}>
                                  {fmtTime(termin.start_datetime)} Uhr
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* ADD/EDIT TERMIN MODAL */}
      {showAddTerminModal && (
        <div className="modal show" onClick={() => setShowAddTerminModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{terminForm.id ? 'Termin bearbeiten' : 'Termin hinzufügen'}</h3>
            
            <div className="field">
              <label>Name *</label>
              <input
                type="text"
                value={terminForm.name}
                onChange={(e) => handleTerminNameChange(e.target.value)}
                placeholder="z.B. Sanitätsausbildung Gruppe A"
                autoFocus
              />
              {konzeptSuggestions.length > 0 && (
                <div style={{marginTop: '6px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '8px'}}>
                  <div style={{fontSize: '12px', color: '#0369a1', fontWeight: 600, marginBottom: '6px'}}>
                    💡 Passende Konzepte gefunden:
                  </div>
                  {konzeptSuggestions.map(k => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => { setTerminForm(prev => ({ ...prev, konzept_id: k.id })); setKonzeptSuggestions([]) }}
                      style={{display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', marginBottom: '4px', background: terminForm.konzept_id === k.id ? '#0ea5e9' : 'var(--bg-card)', color: terminForm.konzept_id === k.id ? 'var(--btn-dark-text)' : 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit'}}
                    >
                      {terminForm.konzept_id === k.id ? '✓ ' : ''}{k.name}
                      {k.beschreibung && <span style={{color: terminForm.konzept_id === k.id ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)', marginLeft: '6px'}}>— {k.beschreibung.slice(0, 60)}{k.beschreibung.length > 60 ? '…' : ''}</span>}
                    </button>
                  ))}
                </div>
              )}
              {terminForm.konzept_id && (
                <div style={{marginTop: '6px', fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px'}}>
                  ✓ Konzept verknüpft: <strong>{konzepte.find(k => k.id === terminForm.konzept_id)?.name}</strong>
                  <button type="button" onClick={() => setTerminForm(prev => ({ ...prev, konzept_id: '' }))} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', marginLeft: '4px'}}>✕</button>
                </div>
              )}
            </div>
            
            <div className="field">
              <label>Beschreibung</label>
              <textarea
                value={terminForm.description}
                onChange={(e) => setTerminForm({ ...terminForm, description: e.target.value })}
                rows={3}
                placeholder="Optional"
              />
            </div>
            
            <div className="field">
              <label>Startdatum *</label>
              <input
                type="datetime-local"
                value={terminForm.start_datetime}
                onChange={(e) => setTerminForm({ ...terminForm, start_datetime: e.target.value })}
              />
            </div>
            
            <div className="field">
              <label>Enddatum</label>
              <input
                type="datetime-local"
                value={terminForm.end_datetime}
                onChange={(e) => setTerminForm({ ...terminForm, end_datetime: e.target.value })}
              />
            </div>
            
            <div className="field">
              <label>Ort</label>
              <input
                type="text"
                value={terminForm.location}
                onChange={(e) => setTerminForm({ ...terminForm, location: e.target.value })}
                placeholder="z.B. Schulungsraum 1"
              />
            </div>
            
            <div className="field">
              <label>Dozent</label>
              <input
                type="text"
                value={terminForm.dozent}
                onChange={(e) => setTerminForm({ ...terminForm, dozent: e.target.value })}
                placeholder="Name des Dozenten"
              />
            </div>
            
            <div className="field">
              <label>Max. Teilnehmer</label>
              <input
                type="number"
                value={terminForm.max_teilnehmer}
                onChange={(e) => setTerminForm({ ...terminForm, max_teilnehmer: parseInt(e.target.value) })}
                min="1"
              />
            </div>
            
            <div className="field">
              <label>Status</label>
              <select 
                value={terminForm.status}
                onChange={(e) => setTerminForm({ ...terminForm, status: e.target.value as any })}
              >
                <option value="geplant">Geplant</option>
                <option value="laufend">Laufend</option>
                <option value="abgeschlossen">Abgeschlossen</option>
                <option value="abgesagt">Abgesagt</option>
              </select>
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAddTerminModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={saveTermin}>
                {terminForm.id ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEILNEHMER DETAIL MODAL */}
      {showTeilnehmerDetailModal && selectedTeilnehmerDetail && (() => {
        const t = selectedTeilnehmerDetail
        const aktuellesJahrDetail = new Date().getFullYear()
        const alleJahre = [...new Set(
          terminTeilnehmer
            .filter(tt => tt.teilnehmer_id === t.id)
            .map(tt => {
              const termin = termine.find(tr => tr.id === tt.termin_id)
              return termin ? parseDate(termin.start_datetime).getFullYear() : null
            })
            .filter(Boolean) as number[]
        )].sort((a, b) => b - a)
        if (!alleJahre.includes(aktuellesJahrDetail)) alleJahre.unshift(aktuellesJahrDetail)

        const renderJahrBlock = (jahr: number, isArchiv: boolean) => {
          const jahresTermineFiltered = termine
            .filter(tr => parseDate(tr.start_datetime).getFullYear() === jahr)
            .sort((a, b) => parseDate(a.start_datetime).getTime() - parseDate(b.start_datetime).getTime())
          const ttFiltered = terminTeilnehmer.filter(tt =>
            tt.teilnehmer_id === t.id && jahresTermineFiltered.some(tr => tr.id === tt.termin_id)
          )
          const da = ttFiltered.filter(tt => tt.status === 'da').length
          const total = jahresTermineFiltered.length
          const prozent = total > 0 ? Math.round((da / total) * 100) : 0
          const ziel50 = da >= 2
          const zielColor = prozent >= 80 ? '#16a34a' : prozent >= 50 ? '#d97706' : '#B03050'
          const barColor = prozent >= 80 ? '#22c55e' : prozent >= 50 ? '#eab308' : '#C94D6A'

          const statusConfig: {[k:string]: {label:string, bg:string, color:string}} = {
            da:           {label: 'Da',           bg: '#dcfce7', color: '#166534'},
            krank:        {label: 'Krank',         bg: '#fef9c3', color: '#92400e'},
            entschuldigt: {label: 'Entschuldigt',  bg: '#dbeafe', color: '#1e40af'},
            fehlend:      {label: 'Fehlend',       bg: '#fee2e2', color: '#991b1b'},
            zugesagt:     {label: 'Zugesagt',      bg: '#d1fae5', color: '#065f46'},
            abgesagt:     {label: 'Abgesagt',      bg: '#fce7f3', color: '#9d174d'},
            eingeladen:   {label: 'Eingeladen',    bg: 'var(--bg-subtle)', color: 'var(--text-secondary)'},
          }

          return (
            <div key={jahr} style={{marginBottom: isArchiv ? '24px' : '0'}}>
              {/* Jahr-Header + Balken */}
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px'}}>
                <div style={{fontWeight: 700, fontSize: '15px'}}>{jahr}</div>
                <div style={{fontSize: '13px', color: zielColor, fontWeight: 700}}>{da}/{total} · {prozent}%</div>
              </div>
              <div style={{background: '#e2e8f0', borderRadius: '6px', height: '8px', marginBottom: '6px'}}>
                <div style={{background: barColor, borderRadius: '6px', height: '8px', width: `${Math.min(prozent,100)}%`, transition: 'width 0.3s'}} />
              </div>
              <div style={{fontSize: '12px', color: ziel50 ? '#16a34a' : '#94a3b8', marginBottom: '14px'}}>
                {ziel50 ? '✓ Mindestziel erreicht (≥ 2 Schulungen, ≥ 50%)' : '✗ Mindestziel nicht erreicht'}
              </div>

              {/* Termin-Liste */}
              {jahresTermineFiltered.length === 0 ? (
                <div style={{color: 'var(--text-secondary)', fontSize: '13px'}}>Keine Termine in diesem Jahr</div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                  {jahresTermineFiltered.map(termin => {
                    const tt = terminTeilnehmer.find(tt => tt.termin_id === termin.id && tt.teilnehmer_id === t.id)
                    const st = tt?.status as string | undefined
                    const cfg = st ? statusConfig[st] : null
                    return (
                      <div key={termin.id} style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border)'}}>
                        <div style={{fontSize: '12px', color: 'var(--text-secondary)', minWidth: '40px', fontWeight: 600}}>
                          {fmtDayMonth(termin.start_datetime)}
                        </div>
                        <div style={{flex: 1, fontSize: '14px'}}>{termin.name}</div>
                        {cfg ? (
                          <span style={{padding: '3px 10px', borderRadius: '6px', background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '12px'}}>{cfg.label}</span>
                        ) : (
                          <span style={{padding: '3px 10px', borderRadius: '6px', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontSize: '12px'}}>–</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        }

        const archivJahre = alleJahre.filter(j => j !== aktuellesJahrDetail)
        const myProgress = modulProgress.filter(p => p.teilnehmer_id === t.id)
        const myDone = myProgress.filter(p => p.abgeschlossen_am)
        const myTerminCount = terminTeilnehmer.filter(tt => tt.teilnehmer_id === t.id).length

        const tabs = [
          { key: 'uebersicht' as const, label: 'Übersicht' },
          { key: 'lernmodule' as const, label: `Lernmodule (${myProgress.length})` },
          { key: 'termine' as const, label: `Termine (${myTerminCount})` },
        ]

        return (
          <div className="modal show" onClick={() => setShowTeilnehmerDetailModal(false)}>
            <div className="modal-content large" onClick={e => e.stopPropagation()} style={{padding: 0, overflow: 'hidden'}}>
              {/* Dark header */}
              <div style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '24px 28px', color: '#fff', position: 'relative'}}>
                <div style={{width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '18px', marginBottom: '10px'}}>
                  {t.vorname[0]}{t.nachname[0]}
                </div>
                <div style={{fontSize: '20px', fontWeight: 700}}>{t.vorname} {t.nachname}</div>
                {t.ausbildung_typ && <div style={{fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginTop: '4px'}}>{t.ausbildung_typ}</div>}
                <div style={{position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px'}}>
                  <button onClick={() => { setShowTeilnehmerDetailModal(false); openEditTeilnehmer(t) }} style={{background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '13px', fontFamily: 'inherit'}}>Bearbeiten</button>
                  <button onClick={() => setShowTeilnehmerDetailModal(false)} style={{background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div style={{display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 28px', background: 'var(--bg-card)'}}>
                {tabs.map(tab => (
                  <button key={tab.key} onClick={() => setSelectedTeilnehmerTab(tab.key)} style={{
                    padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                    color: selectedTeilnehmerTab === tab.key ? 'var(--text)' : 'var(--text-secondary)',
                    borderBottom: selectedTeilnehmerTab === tab.key ? '2px solid var(--text)' : '2px solid transparent',
                    marginBottom: '-1px', whiteSpace: 'nowrap'
                  }}>{tab.label}</button>
                ))}
              </div>

              {/* Tab body */}
              <div style={{overflowY: 'auto', maxHeight: '60vh', padding: '20px 28px'}}>

                {/* ÜBERSICHT */}
                {selectedTeilnehmerTab === 'uebersicht' && (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                      {t.email && (
                        <div style={{background: 'var(--bg-subtle)', borderRadius: '8px', padding: '10px 14px'}}>
                          <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px'}}>Email</div>
                          <div style={{fontSize: '13px'}}>{t.email}</div>
                        </div>
                      )}
                      {t.telefon && (
                        <div style={{background: 'var(--bg-subtle)', borderRadius: '8px', padding: '10px 14px'}}>
                          <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px'}}>Telefon</div>
                          <div style={{fontSize: '13px'}}>{t.telefon}</div>
                        </div>
                      )}
                      {t.whatsapp && (
                        <div style={{background: 'var(--bg-subtle)', borderRadius: '8px', padding: '10px 14px'}}>
                          <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px'}}>WhatsApp</div>
                          <div style={{fontSize: '13px'}}>{t.whatsapp}</div>
                        </div>
                      )}
                      <div style={{background: 'var(--bg-subtle)', borderRadius: '8px', padding: '10px 14px'}}>
                        <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px'}}>Lernbar</div>
                        <div style={{fontSize: '13px', color: t.lernbar_zugang_aktiv ? '#059669' : 'var(--text-secondary)', fontWeight: 600}}>{t.lernbar_zugang_aktiv ? 'Aktiv' : 'Inaktiv'}</div>
                      </div>
                    </div>
                    {t.notizen && (
                      <div style={{background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#92400e'}}>
                        {t.notizen}
                      </div>
                    )}
                  </div>
                )}

                {/* LERNMODULE */}
                {selectedTeilnehmerTab === 'lernmodule' && (
                  <div>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px'}}>
                      <div style={{fontSize: '13px', fontWeight: 700, color: 'var(--text)'}}>Fortschritt</div>
                      <div style={{fontSize: '12px', color: 'var(--text-secondary)'}}>{myDone.length}/{myProgress.length} abgeschlossen</div>
                    </div>
                    {myProgress.length > 0 && (
                      <div style={{background: 'var(--border)', borderRadius: '6px', height: '8px', marginBottom: '16px'}}>
                        <div style={{background: 'var(--btn-dark)', borderRadius: '6px', height: '8px', width: `${myProgress.length > 0 ? Math.round((myDone.length/myProgress.length)*100) : 0}%`, transition: 'width 0.3s'}} />
                      </div>
                    )}
                    {myProgress.length === 0 ? (
                      <div style={{color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '24px 0'}}>Noch keinem Modul zugewiesen.</div>
                    ) : (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                        {myProgress.map(p => {
                          const mod = module.find(m => m.id === p.modul_id)
                          const isDone = !!p.abgeschlossen_am
                          return (
                            <div key={p.id} style={{display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: isDone ? '#f0fdf4' : '#f8fafc', border: `1px solid ${isDone ? '#bbf7d0' : '#e2e8f0'}`}}>
                              <div style={{width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: isDone ? '#10b981' : '#cbd5e1'}} />
                              <div style={{flex: 1}}>
                                <div style={{fontSize: '13px', fontWeight: 600}}>{mod?.name || 'Unbekanntes Modul'}</div>
                                {isDone && p.abgeschlossen_am && (
                                  <div style={{fontSize: '11px', color: '#059669', marginTop: '1px'}}>Abgeschlossen am {fmtDate(p.abgeschlossen_am)}</div>
                                )}
                              </div>
                              <span style={{fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: isDone ? '#dcfce7' : '#f1f5f9', color: isDone ? '#065f46' : '#94a3b8'}}>
                                {isDone ? 'Fertig' : 'Offen'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TERMINE */}
                {selectedTeilnehmerTab === 'termine' && (
                  <div>
                    {renderJahrBlock(aktuellesJahrDetail, false)}
                    {archivJahre.length > 0 && (
                      <details style={{marginTop: '24px'}}>
                        <summary style={{cursor: 'pointer', fontWeight: 700, fontSize: '14px', color: 'var(--text-secondary)', padding: '10px 0', borderTop: '1px solid var(--border)', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '6px'}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                          Archiv ({archivJahre.length} {archivJahre.length === 1 ? 'Jahr' : 'Jahre'})
                        </summary>
                        <div style={{marginTop: '16px'}}>
                          {archivJahre.map(j => renderJahrBlock(j, true))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>

              <div style={{padding: '14px 28px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end'}}>
                <button className="btn" onClick={() => setShowTeilnehmerDetailModal(false)}>Schließen</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ADD/EDIT TEILNEHMER MODAL */}
      {showAddTeilnehmerModal && (
        <div className="modal show" onClick={() => setShowAddTeilnehmerModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{teilnehmerForm.id ? 'Teilnehmer bearbeiten' : 'Teilnehmer hinzufügen'}</h3>
            
            <div className="field">
              <label>Vorname *</label>
              <input
                type="text"
                value={teilnehmerForm.vorname}
                onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, vorname: e.target.value })}
                autoFocus
              />
            </div>
            
            <div className="field">
              <label>Nachname *</label>
              <input
                type="text"
                value={teilnehmerForm.nachname}
                onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, nachname: e.target.value })}
              />
            </div>
            
            <div className="field">
              <label>Email {teilnehmerForm.lernbar_zugang_aktiv && '*'}</label>
              <input
                type="email"
                value={teilnehmerForm.email}
                onChange={(e) => {
                  setTeilnehmerForm({ ...teilnehmerForm, email: e.target.value })
                  if (!teilnehmerForm.id) {
                    checkExistingUser(e.target.value)
                  }
                }}
                placeholder={teilnehmerForm.lernbar_zugang_aktiv ? 'Erforderlich für Lernbar' : 'Optional'}
                style={{
                  borderColor: existingUserDetected ? '#22c55e' : undefined,
                  borderWidth: existingUserDetected ? '2px' : undefined
                }}
              />
              {existingUserDetected && !teilnehmerForm.id && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '6px',
                  padding: '10px',
                  marginTop: '8px',
                  fontSize: '13px',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <div>
                    <strong>Bestehender User gefunden!</strong><br/>
                    {existingUserDetected.name} wird verknüpft (nicht neu erstellt)
                  </div>
                </div>
              )}
            </div>
            
            <div className="field">
              <label>Telefon</label>
              <input
                type="tel"
                value={teilnehmerForm.telefon}
                onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, telefon: e.target.value })}
              />
            </div>
            
            <div className="field">
              <label>WhatsApp</label>
              <input
                type="tel"
                value={teilnehmerForm.whatsapp}
                onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, whatsapp: e.target.value })}
              />
            </div>
            
            <div className="field">
              <label>Ausbildungstyp</label>
              <select 
                value={teilnehmerForm.ausbildung_typ}
                onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, ausbildung_typ: e.target.value })}
              >
                <option value="">Bitte wählen</option>
                <option value="SAN A/B">SAN A/B</option>
                <option value="Rettungssanitäter">Rettungssanitäter</option>
                <option value="Notfallsanitäter">Notfallsanitäter</option>
                <option value="GuKP">GuKP</option>
                <option value="Kommandant">Kommandant</option>
                <option value="Gerätewart">Gerätewart</option>
                <option value="Erste-Hilfe">Erste-Hilfe</option>
                <option value="Sonstiges">Sonstiges</option>
              </select>
            </div>
            
            <div className="field">
              <label>Notizen</label>
              <textarea
                value={teilnehmerForm.notizen}
                onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, notizen: e.target.value })}
                rows={3}
              />
            </div>
            
            <div className="field">
              <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                <input
                  type="checkbox"
                  checked={teilnehmerForm.lernbar_zugang_aktiv}
                  onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, lernbar_zugang_aktiv: e.target.checked })}
                  style={{width: 'auto'}}
                />
                Lernbar-Zugang aktivieren
              </label>
              <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px'}}>
                Teilnehmer erhält Zugang zur Lernbar. Password-Reset Email wird automatisch gesendet.
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAddTeilnehmerModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={saveTeilnehmer}>
                {teilnehmerForm.id ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TERMIN DETAIL MODAL */}
      {showTerminDetailModal && selectedTermin && (
        <div className="modal show" onClick={() => setShowTerminDetailModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()} style={{padding: 0, overflow: 'hidden'}}>

            {/* Header */}
            {(() => {
              const startD = parseDate(selectedTermin.start_datetime)
              const endD = parseDate(selectedTermin.end_datetime)
              const statusLabels: Record<string, string> = {geplant: 'Geplant', laufend: 'Laufend', abgeschlossen: 'Abgeschlossen', abgesagt: 'Abgesagt'}
              const statusColors: Record<string, string> = {geplant: '#3b82f6', laufend: '#10b981', abgeschlossen: '#6366f1', abgesagt: '#C94D6A'}
              const sc = statusColors[selectedTermin.status] || '#64748b'
              return (
                <div style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '24px 28px', color: '#fff', position: 'relative'}}>
                  <div style={{display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px'}}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      background: sc, color: '#fff', padding: '3px 10px', borderRadius: '20px'
                    }}>
                      {statusLabels[selectedTermin.status]}
                    </span>
                    {selectedTermin.dozent && (
                      <span style={{fontSize: '12px', color: 'rgba(255,255,255,0.5)', paddingTop: '3px'}}>{selectedTermin.dozent}</span>
                    )}
                  </div>
                  <div style={{fontSize: '21px', fontWeight: 700, lineHeight: 1.2, marginBottom: '8px'}}>
                    {selectedTermin.name}
                  </div>
                  <div style={{fontSize: '13px', color: 'rgba(255,255,255,0.6)', display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                    {!isNaN(startD.getTime()) && (
                      <span>
                        {fmtDateTime(selectedTermin.start_datetime)}
                        {!isNaN(endD.getTime()) && ` – ${fmtTime(selectedTermin.end_datetime)}`}
                      </span>
                    )}
                    {selectedTermin.location && <span>{selectedTermin.location}</span>}
                    <span>{getTerminTeilnehmerCount(selectedTermin.id)} / {selectedTermin.max_teilnehmer} Teilnehmer</span>
                  </div>
                  {selectedTermin.description && (
                    <div style={{fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '8px'}}>{selectedTermin.description}</div>
                  )}
                  <div style={{position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px'}}>
                    <button
                      onClick={() => { setShowTerminDetailModal(false); openEditTermin(selectedTermin) }}
                      style={{background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '7px 14px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit'}}
                    >
                      Bearbeiten
                    </button>
                    <button onClick={() => setShowTerminDetailModal(false)} style={{
                      background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '8px',
                      width: '32px', height: '32px', cursor: 'pointer', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Tabs */}
            <div style={{display: 'flex', borderBottom: '1px solid #f1f5f9', padding: '0 28px', background: 'var(--bg-card)'}}>
              {([
                {key: 'uebersicht', label: 'Übersicht'},
                {key: 'teilnehmer', label: `Teilnehmer (${getTerminTeilnehmerCount(selectedTermin.id)})`},
                {key: 'dokumente', label: `Dokumente (${getTerminDokumenteCount(selectedTermin.id)})`},
                {key: 'module', label: `Module (${getTerminModuleCount(selectedTermin.id)})`},
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setCurrentTerminTab(tab.key)} style={{
                  padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                  color: currentTerminTab === tab.key ? 'var(--text)' : 'var(--text-secondary)',
                  borderBottom: currentTerminTab === tab.key ? '2px solid #0f172a' : '2px solid transparent',
                  marginBottom: '-1px', whiteSpace: 'nowrap'
                }}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{overflowY: 'auto', maxHeight: '60vh', padding: '20px 28px'}}>
              {/* ÜBERSICHT TAB */}
              {currentTerminTab === 'uebersicht' && (() => {
                const einladungsText = generateEinladungsText(selectedTermin)
                const linkedKonzept = selectedTermin.konzept_id ? konzepte.find(k => k.id === selectedTermin.konzept_id) : null
                return (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>

                    {/* Termin-Infos */}
                    <div style={{display: 'grid', gap: '8px', fontSize: '14px'}}>
                      <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                        <span className={`status-badge ${selectedTermin.status}`}>
                          {selectedTermin.status === 'geplant' ? 'Geplant' : selectedTermin.status === 'laufend' ? 'Laufend' : selectedTermin.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Abgesagt'}
                        </span>
                        <span style={{color: 'var(--text-secondary)'}}>{getTerminTeilnehmerCount(selectedTermin.id)} / {selectedTermin.max_teilnehmer} Teilnehmer</span>
                        {selectedTermin.dozent && <span style={{color: 'var(--text-secondary)'}}>👤 {selectedTermin.dozent}</span>}
                      </div>
                      {selectedTermin.description && <div style={{color: 'var(--text)'}}>{selectedTermin.description}</div>}
                      {selectedTermin.end_datetime && (
                        <div style={{color: 'var(--text-secondary)'}}>bis {fmtDateTime(selectedTermin.end_datetime)}</div>
                      )}
                    </div>

                    {/* Einladungslinks */}
                    <div style={{background: 'var(--bg-subtle)', borderRadius: '10px', padding: '14px'}}>
                      <div style={{fontWeight: 700, fontSize: '13px', marginBottom: '10px', color: 'var(--text)'}}>Einladung versenden</div>

                      {/* Einladungslink */}
                      {selectedTermin.einladung_token ? (() => {
                        const invUrl = `${window.location.origin}/einladung/${selectedTermin.einladung_token}`
                        const invText = `${einladungsText}\n\nHier anmelden / absagen: ${invUrl}`
                        return (
                          <div style={{marginBottom: '12px'}}>
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px'}}>
                              <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em'}}>Einladungslink</div>
                              <button
                                onClick={() => { if (confirm('Neuen Link generieren? Der alte Link funktioniert dann nicht mehr.')) generateEinladungsToken(selectedTermin) }}
                                style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'inherit', padding: '0'}}
                              >Neu generieren</button>
                            </div>
                            <div style={{display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px'}}>
                              <span style={{flex: 1, fontSize: '12px', color: 'var(--text)', wordBreak: 'break-all'}}>{invUrl}</span>
                              <button
                                onClick={() => { navigator.clipboard.writeText(invUrl); showMessage('Link kopiert!', 'success') }}
                                style={{flexShrink: 0, padding: '4px 10px', borderRadius: '6px', background: 'var(--btn-dark)', border: 'none', color: '#fff', fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit'}}
                              >Kopieren</button>
                            </div>
                            <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px'}}>
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(invText)}`}
                                target="_blank" rel="noreferrer"
                                style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', background: '#25d366', color: '#fff', fontWeight: 600, fontSize: '12px', textDecoration: 'none'}}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.85L0 24l6.335-1.508A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.371l-.359-.213-3.721.886.9-3.62-.234-.372A9.818 9.818 0 1 1 12 21.818z"/></svg>
                                WhatsApp
                              </a>
                              <a
                                href={`mailto:?subject=${encodeURIComponent('Einladung: '+selectedTermin.name)}&body=${encodeURIComponent(invText)}`}
                                style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: '12px', textDecoration: 'none'}}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                E-Mail
                              </a>
                            </div>
                          </div>
                        )
                      })() : (
                        <button
                          onClick={() => generateEinladungsToken(selectedTermin)}
                          style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'var(--btn-dark)', border: 'none', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '12px'}}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          Einladungslink erstellen (einmalig)
                        </button>
                      )}

                      {/* Text-Einladung */}
                      <div style={{fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px'}}>Text versenden</div>
                      <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(einladungsText)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: '#25d366', color: '#fff', fontWeight: 600, fontSize: '13px', textDecoration: 'none'}}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.85L0 24l6.335-1.508A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.371l-.359-.213-3.721.886.9-3.62-.234-.372A9.818 9.818 0 1 1 12 21.818z"/></svg>
                          WhatsApp
                        </a>
                        <a
                          href={`sms:?body=${encodeURIComponent(einladungsText)}`}
                          style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: '#3b82f6', color: '#fff', fontWeight: 600, fontSize: '13px', textDecoration: 'none'}}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          SMS
                        </a>
                        <a
                          href={`mailto:?subject=${encodeURIComponent('Einladung: ' + selectedTermin.name)}&body=${encodeURIComponent(einladungsText)}`}
                          style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: '13px', textDecoration: 'none'}}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                          E-Mail
                        </a>
                        <button
                          onClick={() => { navigator.clipboard.writeText(einladungsText); showMessage('Text kopiert', 'success') }}
                          style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit'}}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          Kopieren
                        </button>
                      </div>
                    </div>

                    {/* Rückmeldungen */}
                    {(() => {
                      const terminEinladungen = einladungen.filter(e => e.termin_id === selectedTermin.id)
                      if (terminEinladungen.length === 0) return null
                      const zusagen = terminEinladungen.filter(e => e.status === 'zusagen')
                      const absagen = terminEinladungen.filter(e => e.status === 'absagen')
                      return (
                        <div style={{borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden'}}>
                          <div style={{padding: '12px 16px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                            <div style={{fontWeight: 700, fontSize: '13px', color: 'var(--text)'}}>Rückmeldungen</div>
                            <div style={{fontSize: '12px', color: 'var(--text-secondary)'}}>{terminEinladungen.length} gesamt</div>
                          </div>
                          <div style={{padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                            {zusagen.length > 0 && (
                              <div>
                                <div style={{fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px'}}>Zugesagt ({zusagen.length})</div>
                                <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                                  {zusagen.map(e => (
                                    <span key={e.id} style={{padding: '4px 10px', borderRadius: '20px', background: '#dcfce7', color: '#166534', fontSize: '13px', fontWeight: 500}}>{e.name}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {absagen.length > 0 && (
                              <div>
                                <div style={{fontSize: '11px', fontWeight: 700, color: '#B03050', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px'}}>Abgesagt ({absagen.length})</div>
                                <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                                  {absagen.map(e => (
                                    <span key={e.id} style={{padding: '4px 10px', borderRadius: '20px', background: '#fee2e2', color: '#991b1b', fontSize: '13px', fontWeight: 500}}>{e.name}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Ausbildungskonzept */}
                    <div style={{borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden'}}>
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-subtle)', borderBottom: linkedKonzept ? '1px solid #e2e8f0' : 'none'}}>
                        <div style={{fontWeight: 700, fontSize: '13px', color: 'var(--text)'}}>Ausbildungskonzept</div>
                        {linkedKonzept && (
                          <button
                            onClick={() => saveTerminField(selectedTermin.id, { konzept_id: '' })}
                            style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1, padding: '0 2px'}}
                            title="Konzept entfernen"
                          >✕</button>
                        )}
                      </div>

                      {linkedKonzept ? (
                        <div style={{padding: '16px'}}>
                          <div style={{fontWeight: 700, fontSize: '15px', marginBottom: '4px'}}>{linkedKonzept.name}</div>
                          {linkedKonzept.beschreibung && (
                            <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px'}}>{linkedKonzept.beschreibung}</div>
                          )}

                          {linkedKonzept.lernziele?.length > 0 && (
                            <div style={{marginBottom: '16px'}}>
                              <div style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                Lernziele
                              </div>
                              <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                                {linkedKonzept.lernziele.map((lz, i) => (
                                  <div key={i} style={{display: 'flex', gap: '10px', padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', borderLeft: '3px solid #3b82f6', fontSize: '13px', color: 'var(--text)'}}>
                                    <span style={{color: '#3b82f6', fontWeight: 700, fontSize: '11px', minWidth: '16px'}}>{i + 1}</span>
                                    {lz}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {linkedKonzept.handlungen?.length > 0 && (
                            <div style={{marginBottom: '16px'}}>
                              <div style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                                Handlungen
                              </div>
                              <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                                {linkedKonzept.handlungen.map((h, i) => (
                                  <div key={i} style={{display: 'flex', gap: '10px', padding: '8px 12px', background: '#f0fdf4', borderRadius: '8px', borderLeft: '3px solid #10b981', fontSize: '13px', color: 'var(--text)'}}>
                                    <span style={{color: '#10b981', fontWeight: 700, fontSize: '11px', minWidth: '16px'}}>{i + 1}</span>
                                    {h}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {linkedKonzept.koennen?.length > 0 && (
                            <div style={{marginBottom: '16px'}}>
                              <div style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg>
                                Das Können
                              </div>
                              <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                                {linkedKonzept.koennen.map((k, i) => (
                                  <span key={i} style={{padding: '4px 12px', background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '20px', fontSize: '12px', color: '#3730a3', fontWeight: 500}}>
                                    {k}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {linkedKonzept.wissensanhang_links?.length > 0 && (
                            <div>
                              <div style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                Wissensanhang
                              </div>
                              <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                                {linkedKonzept.wissensanhang_links.map((link, i) => (
                                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border)', textDecoration: 'none'}}>
                                    <div style={{width: '28px', height: '28px', borderRadius: '6px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                    </div>
                                    <div style={{flex: 1, minWidth: 0}}>
                                      <div style={{fontWeight: 600, fontSize: '13px', color: 'var(--text)'}}>{link.titel}</div>
                                      <div style={{fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{link.url}</div>
                                    </div>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{padding: '12px 16px'}}>
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) saveTerminField(selectedTermin.id, { konzept_id: e.target.value }) }}
                            style={{width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', background: 'var(--bg-card)'}}
                          >
                            <option value="">Konzept auswählen...</option>
                            {konzepte.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Individuelle Notizen */}
                    <div style={{background: 'var(--bg-subtle)', borderRadius: '10px', padding: '14px'}}>
                      <div style={{fontWeight: 700, fontSize: '13px', marginBottom: '10px', color: 'var(--text)'}}>Notizen</div>
                      <textarea
                        defaultValue={selectedTermin.notizen || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (selectedTermin.notizen || '')) {
                            saveTerminField(selectedTermin.id, { notizen: e.target.value })
                          }
                        }}
                        placeholder="Individuelle Notizen zum Termin..."
                        rows={4}
                        style={{width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'var(--bg-card)'}}
                      />
                      <div style={{fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px'}}>Wird automatisch gespeichert wenn du das Feld verlässt</div>
                    </div>

                    {/* RSVP-Liste */}
                    {(() => {
                      const ttList = terminTeilnehmer.filter(tt => tt.termin_id === selectedTermin.id)
                      if (ttList.length === 0) return null
                      const zugesagt = ttList.filter(tt => tt.status === 'zugesagt')
                      const abgesagt = ttList.filter(tt => tt.status === 'abgesagt')
                      const ausstehend = ttList.filter(tt => tt.status === 'eingeladen' || !tt.status)
                      return (
                        <div style={{background: 'var(--bg-subtle)', borderRadius: '10px', padding: '14px'}}>
                          <div style={{fontWeight: 700, fontSize: '13px', marginBottom: '10px', color: 'var(--text)'}}>
                            Zu-/Absagen
                            <span style={{marginLeft: '8px', fontWeight: 400, color: 'var(--text-secondary)', fontSize: '12px'}}>
                              {zugesagt.length} zugesagt · {abgesagt.length} abgesagt · {ausstehend.length} ausstehend
                            </span>
                          </div>
                          <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                            {ttList.map(tt => {
                              const t = teilnehmer.find(tn => tn.id === tt.teilnehmer_id)
                              if (!t) return null
                              const s = tt.status as string
                              return (
                                <div key={tt.id} style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)'}}>
                                  <div style={{flex: 1, fontSize: '14px', fontWeight: 500}}>{t.vorname} {t.nachname}</div>
                                  <div style={{display: 'flex', gap: '4px'}}>
                                    <button
                                      onClick={() => pb.collection('ausbildungen_termine_user').update(tt.id, { status: s === 'zugesagt' ? 'eingeladen' : 'zugesagt' }).then(() => loadTerminTeilnehmer())}
                                      style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: s === 'zugesagt' ? '#dcfce7' : '#fff', color: s === 'zugesagt' ? '#166534' : '#64748b', borderColor: s === 'zugesagt' ? '#22c55e' : '#e2e8f0'}}
                                    >✓ Zugesagt</button>
                                    <button
                                      onClick={() => pb.collection('ausbildungen_termine_user').update(tt.id, { status: s === 'abgesagt' ? 'eingeladen' : 'abgesagt' }).then(() => loadTerminTeilnehmer())}
                                      style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: s === 'abgesagt' ? '#fee2e2' : '#fff', color: s === 'abgesagt' ? '#991b1b' : '#64748b', borderColor: s === 'abgesagt' ? '#C94D6A' : '#e2e8f0'}}
                                    >✕ Abgesagt</button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                  </div>
                )
              })()}
              
              {/* TEILNEHMER TAB */}
              {currentTerminTab === 'teilnehmer' && (
                <div>
                  {/* Teilnehmer hinzufügen */}
                  <div style={{marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addTeilnehmerToTermin(selectedTermin.id, e.target.value)
                          e.target.value = ''
                        }
                      }}
                      style={{flex: 1, minWidth: '200px', padding: '10px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit'}}
                    >
                      <option value="">Teilnehmer hinzufügen...</option>
                      {teilnehmer
                        .filter(t => !terminTeilnehmer.some(tt => tt.termin_id === selectedTermin.id && tt.teilnehmer_id === t.id))
                        .map(t => (
                          <option key={t.id} value={t.id}>{t.vorname} {t.nachname}</option>
                        ))
                      }
                    </select>
                    <button
                      className="btn primary"
                      onClick={() => addAlleTeilnehmerToTermin(selectedTermin.id)}
                      title="Alle Teilnehmer hinzufügen"
                    >
                      Alle hinzufügen
                    </button>
                  </div>

                  {/* Statistik-Zeile */}
                  {terminTeilnehmer.filter(tt => tt.termin_id === selectedTermin.id).length > 0 && (() => {
                    const ttList = terminTeilnehmer.filter(tt => tt.termin_id === selectedTermin.id)
                    const da = ttList.filter(tt => tt.status === 'da').length
                    const krank = ttList.filter(tt => tt.status === 'krank').length
                    const entschuldigt = ttList.filter(tt => tt.status === 'entschuldigt').length
                    const fehlend = ttList.filter(tt => tt.status === 'fehlend').length
                    return (
                      <div style={{display: 'flex', gap: '16px', marginBottom: '16px', padding: '12px', background: 'var(--bg-subtle)', borderRadius: '8px', fontSize: '13px', flexWrap: 'wrap'}}>
                        <span><strong>{ttList.length}</strong> Eingeladen</span>
                        <span style={{color: '#16a34a'}}><strong>{da}</strong> Da</span>
                        <span style={{color: '#d97706'}}><strong>{krank}</strong> Krank</span>
                        <span style={{color: '#2563eb'}}><strong>{entschuldigt}</strong> Entschuldigt</span>
                        <span style={{color: '#B03050'}}><strong>{fehlend}</strong> Fehlend</span>
                      </div>
                    )
                  })()}

                  {/* Anwesenheitsliste */}
                  {terminTeilnehmer.filter(tt => tt.termin_id === selectedTermin.id).length === 0 ? (
                    <div className="empty-state">Noch keine Teilnehmer zugewiesen</div>
                  ) : (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      {terminTeilnehmer
                        .filter(tt => tt.termin_id === selectedTermin.id)
                        .map(tt => {
                          const t = teilnehmer.find(teiln => teiln.id === tt.teilnehmer_id)
                          if (!t) return null
                          const anw = tt.status as string
                          return (
                            <div key={tt.id} style={{display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f9fafb', borderRadius: '8px', flexWrap: 'wrap'}}>
                              <div style={{flex: 1, minWidth: '120px'}}>
                                <div style={{fontWeight: 600}}>{t.vorname} {t.nachname}</div>
                                {t.ausbildung_typ && <div style={{fontSize: '12px', color: 'var(--text-secondary)'}}>{t.ausbildung_typ}</div>}
                              </div>
                              <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap'}}>
                                {(['da', 'krank', 'entschuldigt', 'fehlend'] as const).map(opt => {
                                  const colors: Record<string, {bg: string, color: string, border: string}> = {
                                    da:           {bg: anw === 'da'           ? '#dcfce7' : '#fff', color: anw === 'da'           ? '#166534' : '#64748b', border: anw === 'da'           ? '#22c55e' : 'rgba(0,0,0,0.12)'},
                                    krank:        {bg: anw === 'krank'        ? '#fef9c3' : '#fff', color: anw === 'krank'        ? '#92400e' : '#64748b', border: anw === 'krank'        ? '#eab308' : 'rgba(0,0,0,0.12)'},
                                    entschuldigt: {bg: anw === 'entschuldigt' ? '#dbeafe' : '#fff', color: anw === 'entschuldigt' ? '#1e40af' : '#64748b', border: anw === 'entschuldigt' ? '#3b82f6' : 'var(--border)'},
                                    fehlend:      {bg: anw === 'fehlend'      ? '#fee2e2' : '#fff', color: anw === 'fehlend'      ? '#991b1b' : '#64748b', border: anw === 'fehlend'      ? '#C94D6A' : 'rgba(0,0,0,0.12)'},
                                  }
                                  const c = colors[opt]
                                  const labels: Record<string, string> = {da: 'Da', krank: 'Krank', entschuldigt: 'Entschuldigt', fehlend: 'Fehlend'}
                                  return (
                                    <button
                                      key={opt}
                                      onClick={() => updateAnwesenheit(tt.id, anw === opt ? '' : opt)}
                                      style={{padding: '5px 10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.bg, color: c.color, fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s'}}
                                    >
                                      {labels[opt]}
                                    </button>
                                  )
                                })}
                              </div>
                              <button className="btn-small danger" onClick={() => removeTeilnehmerFromTermin(tt.id)}>✕</button>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}
              
              {/* DOKUMENTE TAB */}
              {currentTerminTab === 'dokumente' && (
                <div>
                  <div style={{marginBottom: '16px'}}>
                    <button className="btn primary" onClick={() => setShowUploadDokumentModal(true)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      Dokument hochladen
                    </button>
                  </div>
                  
                  {dokumente.filter(d => d.termin_id === selectedTermin.id).length === 0 ? (
                    <div className="empty-state">Noch keine Dokumente hochgeladen</div>
                  ) : (
                    <>
                      {/* Dozenten-Dokumente */}
                      {dokumente.filter(d => d.termin_id === selectedTermin.id && d.typ === 'dozent').length > 0 && (
                        <div style={{marginBottom: '24px'}}>
                          <h4 style={{fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#C94D6A'}}>
                            📚 Dozenten-Unterlagen
                          </h4>
                          <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                            {dokumente
                              .filter(d => d.termin_id === selectedTermin.id && d.typ === 'dozent')
                              .map(d => (
                                <div key={d.id} className="dokument-item">
                                  <div style={{flex: 1}}>
                                    <div style={{fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px'}}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                      </svg>
                                      {d.name}
                                    </div>
                                    {d.beschreibung && (
                                      <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px'}}>
                                        {d.beschreibung}
                                      </div>
                                    )}
                                    <div style={{fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px'}}>
                                      {new Date(d.created).toLocaleDateString('de-DE')}
                                    </div>
                                  </div>
                                  <div style={{display: 'flex', gap: '8px'}}>
                                    {d.datei && (
                                      <a 
                                        href={pb.files.getUrl(d, d.datei)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-small"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Download
                                      </a>
                                    )}
                                    <button 
                                      className="btn-small danger"
                                      onClick={() => deleteDokument(d.id, d.name)}
                                    >
                                      Löschen
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Teilnehmer-Dokumente */}
                      {dokumente.filter(d => d.termin_id === selectedTermin.id && d.typ === 'teilnehmer').length > 0 && (
                        <div>
                          <h4 style={{fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#059669'}}>
                            👥 Teilnehmer-Unterlagen
                          </h4>
                          <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                            {dokumente
                              .filter(d => d.termin_id === selectedTermin.id && d.typ === 'teilnehmer')
                              .map(d => (
                                <div key={d.id} className="dokument-item">
                                  <div style={{flex: 1}}>
                                    <div style={{fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px'}}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                      </svg>
                                      {d.name}
                                    </div>
                                    {d.beschreibung && (
                                      <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px'}}>
                                        {d.beschreibung}
                                      </div>
                                    )}
                                    <div style={{fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px'}}>
                                      {new Date(d.created).toLocaleDateString('de-DE')}
                                    </div>
                                  </div>
                                  <div style={{display: 'flex', gap: '8px'}}>
                                    {d.datei && (
                                      <a 
                                        href={pb.files.getUrl(d, d.datei)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-small"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Download
                                      </a>
                                    )}
                                    <button 
                                      className="btn-small danger"
                                      onClick={() => deleteDokument(d.id, d.name)}
                                    >
                                      Löschen
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {/* MODULE TAB */}
              {currentTerminTab === 'module' && (
                <div>
                  <div style={{marginBottom: '16px'}}>
                    <select 
                      onChange={(e) => {
                        if (e.target.value) {
                          const frist = new Date()
                          frist.setDate(frist.getDate() + 14)
                          assignModulToTermin(e.target.value, selectedTermin.id, false, frist.toISOString())
                          e.target.value = ''
                        }
                      }}
                      style={{
                        padding: '10px',
                        border: '1px solid rgba(0, 0, 0, 0.15)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        width: '100%'
                      }}
                    >
                      <option value="">Modul zuweisen...</option>
                      {module
                        .filter(m => !modulTermine.some(mt => 
                          mt.termin_id === selectedTermin.id && mt.modul_id === m.id
                        ))
                        .map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.dauer_minuten} Min.)
                          </option>
                        ))
                      }
                    </select>
                  </div>
                  
                  {modulTermine.filter(mt => mt.termin_id === selectedTermin.id).length === 0 ? (
                    <div className="empty-state">Noch keine Module zugewiesen</div>
                  ) : (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      {modulTermine
                        .filter(mt => mt.termin_id === selectedTermin.id)
                        .map(mt => {
                          const m = module.find(mod => mod.id === mt.modul_id)
                          if (!m) return null
                          return (
                            <div key={mt.id} className="modul-item">
                              <div style={{flex: 1}}>
                                <div style={{fontWeight: 600}}>{m.name}</div>
                                <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px'}}>
                                  {mt.pflicht ? '⚠️ Pflicht' : '📌 Optional'} • 
                                  Frist: {new Date(mt.frist_datum).toLocaleDateString('de-DE')} • 
                                  Dauer: {m.dauer_minuten} Min.
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ADD/EDIT MODUL MODAL */}
      {showAddModulModal && (
        <div className="modal show" onClick={() => setShowAddModulModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()} style={{maxHeight: '90vh', overflowY: 'auto'}}>
            <h3>{modulForm.id ? 'Modul bearbeiten' : 'Modul erstellen'}</h3>

            <div className="field">
              <label>Name *</label>
              <input type="text" value={modulForm.name} autoFocus
                onChange={(e) => setModulForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Grundlagen Erste Hilfe" />
            </div>

            <div className="field">
              <label>Beschreibung</label>
              <textarea rows={2} value={modulForm.beschreibung}
                onChange={(e) => setModulForm(prev => ({ ...prev, beschreibung: e.target.value }))}
                placeholder="Kurze Beschreibung des Moduls" />
            </div>

            <div className="field">
              <label>Dauer (Minuten)</label>
              <input type="number" min={1} value={modulForm.dauer_minuten}
                onChange={(e) => setModulForm(prev => ({ ...prev, dauer_minuten: parseInt(e.target.value) || 60 }))} />
            </div>

            {/* Content blocks */}
            <div style={{marginTop: '24px', marginBottom: '12px'}}>
              <div style={{fontWeight: 700, fontSize: '14px', marginBottom: '12px'}}>Inhalte</div>

              {modulForm.inhalte.length === 0 && (
                <div style={{color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px'}}>Noch keine Inhaltsblöcke hinzugefügt.</div>
              )}

              {modulForm.inhalte.map((block, idx) => (
                <div key={idx} style={{
                  border: '1px solid var(--border)', borderRadius: '10px',
                  padding: '16px', marginBottom: '12px', background: '#fafafa'
                }}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px'}}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: block.typ === 'quiz' ? '#7c3aed' : '#2563eb',
                      background: block.typ === 'quiz' ? '#f5f3ff' : '#eff6ff',
                      padding: '3px 8px', borderRadius: '4px'
                    }}>
                      {block.typ === 'quiz' ? 'Quiz' : 'Text'}
                    </span>
                    <input
                      type="text"
                      value={block.titel}
                      onChange={(e) => updateInhaltBlock(idx, 'titel', e.target.value)}
                      placeholder="Titel des Blocks"
                      style={{flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit'}}
                    />
                    <button onClick={() => removeInhaltBlock(idx)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: '#C94D6A', padding: '4px'
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>

                  {block.typ === 'text' && (
                    <textarea
                      rows={5}
                      value={block.inhalt}
                      onChange={(e) => updateInhaltBlock(idx, 'inhalt', e.target.value)}
                      placeholder="Inhalt hier eingeben..."
                      style={{width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box'}}
                    />
                  )}

                  {block.typ === 'quiz' && (() => {
                    let quizData: { fragen: QuizFrage[] } = { fragen: [] }
                    try { quizData = JSON.parse(block.inhalt) } catch {}
                    return (
                      <div>
                        {quizData.fragen.map((f, fi) => (
                          <div key={fi} style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px',
                            padding: '12px', marginBottom: '8px', fontSize: '13px'
                          }}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                              <div style={{fontWeight: 600, flex: 1}}>{f.frage}</div>
                              <button onClick={() => removeQuizFrage(idx, fi)} style={{background: 'none', border: 'none', cursor: 'pointer', color: '#C94D6A', padding: '2px'}}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            </div>
                            <div style={{marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px'}}>
                              {f.antworten.map((a, ai) => (
                                <div key={ai} style={{
                                  display: 'flex', alignItems: 'center', gap: '6px',
                                  color: ai === f.richtige ? '#059669' : 'var(--text-secondary)'
                                }}>
                                  <span style={{fontSize: '11px', fontWeight: ai === f.richtige ? 700 : 400}}>
                                    {ai === f.richtige ? '✓' : '○'}
                                  </span>
                                  {a}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        {editingQuizBlock === idx ? (
                          <div style={{background: 'var(--bg-card)', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '12px', marginTop: '8px'}}>
                            <div className="field" style={{marginBottom: '8px'}}>
                              <label style={{fontSize: '12px'}}>Frage</label>
                              <input type="text" value={newQuizFrage}
                                onChange={(e) => setNewQuizFrage(e.target.value)}
                                placeholder="Frage eingeben..."
                                style={{padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box'}} />
                            </div>
                            <div style={{display: 'grid', gap: '6px', marginBottom: '10px'}}>
                              {[0,1,2,3].map(i => (
                                <div key={i} style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                                  <input type="radio" name={`richtig-${idx}`} checked={newQuizRichtige === i}
                                    onChange={() => setNewQuizRichtige(i)} title="Richtige Antwort" />
                                  <input type="text" value={newQuizAntworten[i]}
                                    onChange={(e) => {
                                      const a = [...newQuizAntworten]; a[i] = e.target.value; setNewQuizAntworten(a)
                                    }}
                                    placeholder={`Antwort ${i + 1}${i < 2 ? ' *' : ''}`}
                                    style={{flex: 1, padding: '7px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit'}} />
                                </div>
                              ))}
                            </div>
                            <div style={{fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px'}}>Radio = richtige Antwort</div>
                            <div style={{display: 'flex', gap: '8px'}}>
                              <button className="btn primary" style={{fontSize: '12px', padding: '6px 14px'}} onClick={() => addQuizFrage(idx)}>Hinzufügen</button>
                              <button className="btn secondary" style={{fontSize: '12px', padding: '6px 14px'}} onClick={() => setEditingQuizBlock(null)}>Abbrechen</button>
                            </div>
                          </div>
                        ) : (
                          <button className="btn secondary" style={{fontSize: '12px', padding: '6px 14px', marginTop: '8px'}}
                            onClick={() => { setEditingQuizBlock(idx); setNewQuizFrage(''); setNewQuizAntworten(['','','','']); setNewQuizRichtige(0) }}>
                            + Frage hinzufügen
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </div>
              ))}

              <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                <button className="btn secondary" style={{fontSize: '13px'}} onClick={() => addInhaltBlock('text')}>
                  + Textblock
                </button>
                <button className="btn secondary" style={{fontSize: '13px'}} onClick={() => addInhaltBlock('quiz')}>
                  + Quizblock
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAddModulModal(false)}>Abbrechen</button>
              <button className="btn primary" onClick={saveModul}>
                {modulForm.id ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODUL DETAIL MODAL */}
      {showModulDetailModal && selectedModul && (
        <div className="modal show" onClick={() => setShowModulDetailModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()} style={{padding: 0, overflow: 'hidden'}}>
            {/* Header */}
            <div style={{background: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%)', padding: '24px 28px', color: '#fff', position: 'relative'}}>
              <div style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '6px'}}>
                Lernmodul · {selectedModul.dauer_minuten} Min.
              </div>
              <div style={{fontSize: '20px', fontWeight: 700}}>{selectedModul.name}</div>
              {selectedModul.beschreibung && (
                <div style={{fontSize: '13px', color: 'rgba(255,255,255,0.65)', marginTop: '6px'}}>{selectedModul.beschreibung}</div>
              )}
              <button onClick={() => setShowModulDetailModal(false)} style={{
                position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.12)',
                border: 'none', borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div style={{display: 'flex', borderBottom: '1px solid #f1f5f9', padding: '0 28px'}}>
              {(['inhalt', 'teilnehmer'] as const).map(tab => (
                <button key={tab} onClick={() => setSelectedModulTab(tab)} style={{
                  padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                  color: selectedModulTab === tab ? '#3730a3' : '#94a3b8',
                  borderBottom: selectedModulTab === tab ? '2px solid #3730a3' : '2px solid transparent',
                  marginBottom: '-1px'
                }}>
                  {tab === 'inhalt' ? 'Inhalt' : `Teilnehmer (${modulProgress.filter(p => p.modul_id === selectedModul.id).length})`}
                </button>
              ))}
            </div>

            {/* Body */}
            <div style={{padding: '24px 28px', overflowY: 'auto', maxHeight: '55vh'}}>

              {/* INHALT TAB */}
              {selectedModulTab === 'inhalt' && (
                <div>
                  {(!selectedModul.inhalte || selectedModul.inhalte.length === 0) ? (
                    <div style={{color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '24px 0'}}>
                      Noch keine Inhalte. Modul bearbeiten, um Blöcke hinzuzufügen.
                    </div>
                  ) : (
                    selectedModul.inhalte.map((block, idx) => (
                      <div key={idx} style={{marginBottom: '20px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px'}}>
                          <span style={{
                            fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                            color: block.typ === 'quiz' ? '#7c3aed' : '#2563eb',
                            background: block.typ === 'quiz' ? '#f5f3ff' : '#eff6ff',
                            padding: '2px 8px', borderRadius: '4px'
                          }}>{block.typ === 'quiz' ? 'Quiz' : 'Text'}</span>
                          {block.titel && <span style={{fontWeight: 600, fontSize: '14px'}}>{block.titel}</span>}
                        </div>

                        {block.typ === 'text' && (
                          <div style={{
                            background: 'var(--bg-subtle)', borderRadius: '10px', padding: '16px',
                            fontSize: '14px', lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-wrap'
                          }}>
                            {block.inhalt || <span style={{color: 'var(--text-secondary)'}}>Kein Inhalt.</span>}
                          </div>
                        )}

                        {block.typ === 'quiz' && (() => {
                          let quizData: { fragen: QuizFrage[] } = { fragen: [] }
                          try { quizData = JSON.parse(block.inhalt) } catch {}
                          return (
                            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                              {quizData.fragen.length === 0 && (
                                <div style={{color: 'var(--text-secondary)', fontSize: '13px'}}>Noch keine Fragen.</div>
                              )}
                              {quizData.fragen.map((f, fi) => (
                                <div key={fi} style={{background: '#f5f3ff', borderRadius: '10px', padding: '14px', border: '1px solid #e9d5ff'}}>
                                  <div style={{fontWeight: 600, fontSize: '14px', marginBottom: '8px'}}>{fi + 1}. {f.frage}</div>
                                  <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                                    {f.antworten.map((a, ai) => (
                                      <div key={ai} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '6px 10px', borderRadius: '6px',
                                        background: ai === f.richtige ? '#d1fae5' : '#fff',
                                        border: `1px solid ${ai === f.richtige ? '#6ee7b7' : '#e2e8f0'}`,
                                        fontSize: '13px', color: ai === f.richtige ? '#065f46' : '#334155'
                                      }}>
                                        <span style={{fontWeight: ai === f.richtige ? 700 : 400, minWidth: '14px'}}>
                                          {ai === f.richtige ? '✓' : String.fromCharCode(65 + ai)}
                                        </span>
                                        {a}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TEILNEHMER TAB */}
              {selectedModulTab === 'teilnehmer' && (() => {
                const assigned = modulProgress.filter(p => p.modul_id === selectedModul.id)
                const done = assigned.filter(p => p.abgeschlossen_am)
                const unassignedTeilnehmer = teilnehmer.filter(t => !assigned.some(p => p.teilnehmer_id === t.id))
                return (
                  <div>
                    {/* Summary bar */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '16px',
                      background: 'var(--bg-subtle)', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px'
                    }}>
                      <div style={{flex: 1}}>
                        <div style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px'}}>
                          {done.length} von {assigned.length} abgeschlossen
                        </div>
                        <div style={{height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden'}}>
                          <div style={{
                            height: '100%', background: '#10b981', borderRadius: '3px',
                            width: assigned.length > 0 ? `${Math.round((done.length / assigned.length) * 100)}%` : '0%',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                      </div>
                      <button className="btn primary" style={{fontSize: '12px', padding: '7px 14px', whiteSpace: 'nowrap'}}
                        onClick={() => assignAllTeilnehmerToModul(selectedModul.id)}>
                        Alle hinzufügen
                      </button>
                    </div>

                    {/* Add individual */}
                    {unassignedTeilnehmer.length > 0 && (
                      <div style={{display: 'flex', gap: '8px', marginBottom: '16px'}}>
                        <select value={addModulTeilnehmerId} onChange={(e) => setAddModulTeilnehmerId(e.target.value)}
                          style={{flex: 1, padding: '9px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit'}}>
                          <option value="">Teilnehmer einzeln hinzufügen...</option>
                          {unassignedTeilnehmer.map(t => (
                            <option key={t.id} value={t.id}>{t.vorname} {t.nachname}</option>
                          ))}
                        </select>
                        <button className="btn primary" style={{fontSize: '13px', padding: '8px 16px'}}
                          onClick={async () => { await assignTeilnehmerToModul(selectedModul.id, addModulTeilnehmerId); setAddModulTeilnehmerId('') }}>
                          Hinzufügen
                        </button>
                      </div>
                    )}

                    {/* Participant list */}
                    {assigned.length === 0 ? (
                      <div style={{color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '20px 0'}}>
                        Noch keine Teilnehmer zugewiesen.
                      </div>
                    ) : (
                      <div style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                        {assigned.map(p => {
                          const t = teilnehmer.find(x => x.id === p.teilnehmer_id)
                          const isDone = !!p.abgeschlossen_am
                          return (
                            <div key={p.id} style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '12px 14px', borderRadius: '10px',
                              background: isDone ? '#f0fdf4' : '#fafafa',
                              border: `1px solid ${isDone ? '#bbf7d0' : '#e2e8f0'}`
                            }}>
                              <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: isDone ? '#10b981' : '#e2e8f0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, color: isDone ? '#fff' : '#94a3b8', fontSize: '13px', fontWeight: 700
                              }}>
                                {t ? `${t.vorname[0]}${t.nachname[0]}` : '?'}
                              </div>
                              <div style={{flex: 1}}>
                                <div style={{fontWeight: 600, fontSize: '14px'}}>
                                  {t ? `${t.vorname} ${t.nachname}` : 'Unbekannt'}
                                </div>
                                {isDone && p.abgeschlossen_am && (
                                  <div style={{fontSize: '11px', color: '#059669', marginTop: '2px'}}>
                                    Abgeschlossen am {fmtDate(p.abgeschlossen_am)}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => toggleModulAbgeschlossen(p.id, isDone)}
                                style={{
                                  padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
                                  background: isDone ? '#dcfce7' : '#f1f5f9',
                                  color: isDone ? '#065f46' : '#475569'
                                }}
                              >
                                {isDone ? 'Abgeschlossen' : 'Offen'}
                              </button>
                              <button onClick={() => removeModulTeilnehmer(p.id)} style={{background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '4px'}}
                                title="Entfernen">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Footer */}
            <div style={{padding: '14px 28px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
              <button className="btn secondary" onClick={() => { setShowModulDetailModal(false); openEditModul(selectedModul) }}>
                Bearbeiten
              </button>
              <button className="btn" onClick={() => setShowModulDetailModal(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD DOKUMENT MODAL */}
      {showUploadDokumentModal && (
        <div className="modal show" onClick={() => setShowUploadDokumentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Dokument hochladen</h3>
            
            <div className="field">
              <label>Datei *</label>
              <input
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>
            
            <div className="field">
              <label>Typ *</label>
              <select 
                value={uploadTyp}
                onChange={(e) => setUploadTyp(e.target.value as any)}
              >
                <option value="dozent">Dozent</option>
                <option value="teilnehmer">Teilnehmer</option>
              </select>
            </div>
            
            <div className="field">
              <label>Beschreibung</label>
              <textarea
                value={uploadBeschreibung}
                onChange={(e) => setUploadBeschreibung(e.target.value)}
                rows={3}
                placeholder="Optional"
              />
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowUploadDokumentModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={uploadDokument}>
                Hochladen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT KONZEPT MODAL */}
      {showAddKonzeptModal && (
        <div className="modal show" onClick={() => setShowAddKonzeptModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>{konzeptForm.id ? 'Konzept bearbeiten' : 'Konzept erstellen'}</h3>
            
            <div className="field">
              <label>Name *</label>
              <input
                type="text"
                value={konzeptForm.name}
                onChange={(e) => setKonzeptForm({ ...konzeptForm, name: e.target.value })}
                placeholder="z.B. San A - Modul 1"
                autoFocus
              />
            </div>
            
            <div className="field">
              <label>Beschreibung</label>
              <textarea
                value={konzeptForm.beschreibung}
                onChange={(e) => setKonzeptForm({ ...konzeptForm, beschreibung: e.target.value })}
                rows={2}
                placeholder="Kurze Beschreibung des Konzepts"
              />
            </div>

            <div style={{marginTop: '24px'}}>
              <h4 style={{marginBottom: '12px', fontSize: '16px'}}>Lernziele</h4>
              <div className="list-editor">
                {konzeptForm.lernziele.map((lz, idx) => (
                  <div key={idx} className="list-item">
                    <span>{lz}</span>
                    <button className="btn-icon danger" onClick={() => removeKonzeptItem('lernziele', idx)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="add-item">
                  <input
                    type="text"
                    value={newLernziel}
                    onChange={(e) => setNewLernziel(e.target.value)}
                    placeholder="Neues Lernziel hinzufügen..."
                    onKeyPress={(e) => e.key === 'Enter' && addKonzeptItem('lernziele')}
                  />
                  <button className="btn-small primary" onClick={() => addKonzeptItem('lernziele')}>+</button>
                </div>
              </div>
            </div>

            <div style={{marginTop: '24px'}}>
              <h4 style={{marginBottom: '12px', fontSize: '16px'}}>Handlungen</h4>
              <div className="list-editor">
                {konzeptForm.handlungen.map((h, idx) => (
                  <div key={idx} className="list-item">
                    <span>{h}</span>
                    <button className="btn-icon danger" onClick={() => removeKonzeptItem('handlungen', idx)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="add-item">
                  <input
                    type="text"
                    value={newHandlung}
                    onChange={(e) => setNewHandlung(e.target.value)}
                    placeholder="Neue Handlung hinzufügen..."
                    onKeyPress={(e) => e.key === 'Enter' && addKonzeptItem('handlungen')}
                  />
                  <button className="btn-small primary" onClick={() => addKonzeptItem('handlungen')}>+</button>
                </div>
              </div>
            </div>

            <div style={{marginTop: '24px'}}>
              <h4 style={{marginBottom: '12px', fontSize: '16px'}}>Das Können</h4>
              <div className="list-editor">
                {konzeptForm.koennen.map((k, idx) => (
                  <div key={idx} className="list-item">
                    <span>{k}</span>
                    <button className="btn-icon danger" onClick={() => removeKonzeptItem('koennen', idx)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="add-item">
                  <input
                    type="text"
                    value={newKoennen}
                    onChange={(e) => setNewKoennen(e.target.value)}
                    placeholder="Neue Kompetenz hinzufügen..."
                    onKeyPress={(e) => e.key === 'Enter' && addKonzeptItem('koennen')}
                  />
                  <button className="btn-small primary" onClick={() => addKonzeptItem('koennen')}>+</button>
                </div>
              </div>
            </div>

            <div style={{marginTop: '24px'}}>
              <h4 style={{marginBottom: '12px', fontSize: '16px'}}>Wissensanhang (Links)</h4>
              <div className="list-editor">
                {konzeptForm.wissensanhang_links.map((link, idx) => (
                  <div key={idx} className="list-item">
                    <div>
                      <div style={{fontWeight: 600}}>{link.titel}</div>
                      <div style={{fontSize: '12px', color: 'var(--text-secondary)'}}>{link.url}</div>
                    </div>
                    <button className="btn-icon danger" onClick={() => removeWissensLink(idx)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="add-link">
                  <input
                    type="text"
                    value={newLinkTitel}
                    onChange={(e) => setNewLinkTitel(e.target.value)}
                    placeholder="Titel"
                    style={{flex: 1}}
                  />
                  <input
                    type="url"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="URL"
                    style={{flex: 2}}
                  />
                  <button className="btn-small primary" onClick={addWissensLink}>+</button>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAddKonzeptModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={saveKonzept}>
                {konzeptForm.id ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KONZEPT DETAIL MODAL */}
      {showKonzeptDetailModal && selectedKonzept && (
        <div className="modal show" onClick={() => setShowKonzeptDetailModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()} style={{padding: 0, overflow: 'hidden'}}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1d1d1f 0%, #3a3a3c 100%)',
              padding: '28px 32px',
              color: '#fff',
              position: 'relative'
            }}>
              <div style={{fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '8px'}}>
                Ausbildungskonzept
              </div>
              <div style={{fontSize: '22px', fontWeight: 700, lineHeight: 1.2}}>
                {selectedKonzept.name}
              </div>
              {selectedKonzept.beschreibung && (
                <div style={{fontSize: '14px', color: 'rgba(255,255,255,0.65)', marginTop: '10px', lineHeight: 1.6}}>
                  {selectedKonzept.beschreibung}
                </div>
              )}
              <button
                onClick={() => setShowKonzeptDetailModal(false)}
                style={{
                  position: 'absolute', top: '20px', right: '20px',
                  background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '8px',
                  width: '32px', height: '32px', cursor: 'pointer', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{padding: '28px 32px', overflowY: 'auto', maxHeight: '60vh'}}>

              {selectedKonzept.lernziele && selectedKonzept.lernziele.length > 0 && (
                <div style={{marginBottom: '28px'}}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '14px'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    Lernziele
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    {selectedKonzept.lernziele.map((lz, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                        padding: '12px 14px', background: 'var(--bg-subtle)',
                        borderRadius: '10px', borderLeft: '3px solid #3b82f6',
                        fontSize: '14px', lineHeight: 1.5, color: 'var(--text)'
                      }}>
                        <span style={{color: '#3b82f6', fontWeight: 700, fontSize: '12px', minWidth: '20px', paddingTop: '1px'}}>{idx + 1}</span>
                        {lz}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedKonzept.handlungen && selectedKonzept.handlungen.length > 0 && (
                <div style={{marginBottom: '28px'}}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '14px'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    Handlungen
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    {selectedKonzept.handlungen.map((h, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                        padding: '12px 14px', background: 'var(--bg-subtle)',
                        borderRadius: '10px', borderLeft: '3px solid #10b981',
                        fontSize: '14px', lineHeight: 1.5, color: 'var(--text)'
                      }}>
                        <span style={{color: '#10b981', fontWeight: 700, fontSize: '12px', minWidth: '20px', paddingTop: '1px'}}>{idx + 1}</span>
                        {h}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedKonzept.koennen && selectedKonzept.koennen.length > 0 && (
                <div style={{marginBottom: '28px'}}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '14px'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
                    </svg>
                    Das Können
                  </div>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                    {selectedKonzept.koennen.map((k, idx) => (
                      <span key={idx} style={{
                        padding: '6px 14px', background: '#f0f4ff',
                        border: '1px solid #c7d2fe', borderRadius: '20px',
                        fontSize: '13px', color: '#3730a3', fontWeight: 500
                      }}>
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedKonzept.wissensanhang_links && selectedKonzept.wissensanhang_links.length > 0 && (
                <div style={{marginBottom: '8px'}}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '14px'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    Wissensanhang
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    {selectedKonzept.wissensanhang_links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '14px',
                          padding: '14px 16px', background: 'var(--bg-subtle)',
                          borderRadius: '10px', textDecoration: 'none',
                          border: '1px solid var(--border)', transition: 'border-color 0.15s'
                        }}
                      >
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '8px',
                          background: '#e0e7ff', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', flexShrink: 0
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                          </svg>
                        </div>
                        <div style={{flex: 1, minWidth: 0}}>
                          <div style={{fontWeight: 600, fontSize: '14px', color: 'var(--text)'}}>{link.titel}</div>
                          <div style={{fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{link.url}</div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {(!selectedKonzept.lernziele || selectedKonzept.lernziele.length === 0) &&
               (!selectedKonzept.handlungen || selectedKonzept.handlungen.length === 0) &&
               (!selectedKonzept.koennen || selectedKonzept.koennen.length === 0) &&
               (!selectedKonzept.wissensanhang_links || selectedKonzept.wissensanhang_links.length === 0) && (
                <div style={{textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: '14px'}}>
                  Keine weiteren Inhalte vorhanden.
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{padding: '16px 32px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
              <button className="btn secondary" onClick={() => { setShowKonzeptDetailModal(false); openEditKonzept(selectedKonzept) }}>
                Bearbeiten
              </button>
              <button className="btn" onClick={() => setShowKonzeptDetailModal(false)}>
                Schließen
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
          padding-top: 165px;
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
          padding: 14px 20px;
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
          color: #C94D6A;
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

        .action-btn.active {
          background: #C94D6A;
          color: #fff;
          border-color: #C94D6A;
        }

        .action-btn.primary {
          background: #C94D6A;
          color: #fff;
          border-color: #C94D6A;
        }

        .action-btn.primary:hover {
          background: #B03050;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 12px;
          padding: 20px;
          border: 2px solid transparent;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          position: relative;
          transition: all 0.2s;
          cursor: pointer;
        }

        .card.status-geplant {
          border-color: rgba(59, 130, 246, 0.2);
        }

        .card.status-laufend {
          border-color: rgba(234, 179, 8, 0.2);
        }

        .card.status-abgeschlossen {
          border-color: rgba(34, 197, 94, 0.2);
        }

        .card.status-abgesagt {
          border-color: rgba(201, 77, 106, 0.2);
        }

        .card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
        }

        .card-menu-container {
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
          color: #64748b;
          transition: all 0.2s;
        }

        .menu-dots:hover {
          background: #fff;
          color: #C94D6A;
          transform: scale(1.1);
        }

        .card-menu-dropdown {
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

        .card-menu-dropdown.show {
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
          color: #B03050;
        }

        .menu-item.danger:hover {
          background: #fee2e2;
        }

        .card-type {
          font-size: 12px;
          font-weight: 700;
          color: #C94D6A;
          text-transform: uppercase;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }

        .card-name {
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 8px;
          color: #1d1d1f;
        }

        .card-meta {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 12px;
        }

        .card-status-info {
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

        .status-badge.geplant {
          background: #eff6ff;
          color: #1e40af;
        }

        .status-badge.laufend {
          background: #fefce8;
          color: #854d0e;
        }

        .status-badge.abgeschlossen {
          background: #f0fdf4;
          color: #166534;
        }

        .status-badge.abgesagt {
          background: #fef2f2;
          color: #B03050;
        }

        .status-badge.lernbar {
          background: #eff6ff;
          color: #1e40af;
        }

        .card-stats {
          display: flex;
          gap: 16px;
          font-size: 13px;
          color: #64748b;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 6px;
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
          color: #C94D6A;
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
          border-color: #C94D6A;
          box-shadow: 0 0 0 3px rgba(201, 77, 106, 0.1);
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
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .btn.primary {
          background: #C94D6A;
          color: #fff;
          border-color: #C94D6A;
        }

        .btn.primary:hover {
          background: #B03050;
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
          text-decoration: none;
          display: inline-block;
        }

        .btn-small:hover {
          background: #f3f4f6;
        }

        .btn-small.danger {
          color: #B03050;
        }

        .btn-small.danger:hover {
          background: #fee2e2;
        }

        .btn-small.primary {
          background: #C94D6A;
          color: #fff;
          border-color: #C94D6A;
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

        .btn-icon.danger:hover {
          background: #fee2e2;
          color: #B03050;
        }

        .tabs {
          display: flex;
          gap: 4px;
          border-bottom: 2px solid #e5e7eb;
          margin-bottom: 20px;
        }

        .tab {
          background: none;
          border: none;
          padding: 12px 16px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          color: #64748b;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
        }

        .tab:hover {
          color: #1d1d1f;
        }

        .tab.active {
          color: #C94D6A;
          border-bottom-color: #C94D6A;
        }

        .tab-content {
          min-height: 200px;
        }

        .list-editor {
          background: #f9fafb;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 8px;
          padding: 12px;
        }

        .list-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fff;
          padding: 10px 12px;
          border-radius: 6px;
          margin-bottom: 8px;
          gap: 12px;
        }

        .list-item:last-of-type {
          margin-bottom: 12px;
        }

        .add-item {
          display: flex;
          gap: 8px;
        }

        .add-item input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
        }

        .add-link {
          display: flex;
          gap: 8px;
        }

        .add-link input {
          padding: 8px 12px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
        }

        .teilnehmer-list {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px;
          background: #fff;
        }

        .dokument-item {
          background: #f9fafb;
          padding: 12px;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          border: 1px solid #e5e7eb;
        }

        .modul-item {
          background: #f9fafb;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .anwesend-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        @media (max-width: 768px) {
          /* Toolbar: horizontal scroll statt Wrapping */
          .action-toolbar {
            flex-wrap: nowrap;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            justify-content: flex-start;
            gap: 0.25rem;
            padding: 0.3rem 0.6rem;
            max-width: 100vw;
            box-sizing: border-box;
          }
          .action-toolbar::-webkit-scrollbar { display: none; }

          .action-btn {
            flex-shrink: 0;
            min-width: 36px;
            height: 36px;
            padding: 0.3rem;
          }
          .action-btn svg { width: 15px; height: 15px; }

          /* Content */
          .content {
            padding-top: 108px;
            padding-left: 10px;
            padding-right: 10px;
            padding-bottom: 72px;
            overflow-x: hidden;
          }

          /* Toast */
          .toast {
            bottom: 68px;
            right: 10px;
            left: 10px;
            max-width: none;
          }

          /* Karten */
          .cards-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .card { padding: 12px 14px; }

          /* Tabs */
          .tabs {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .tab { white-space: nowrap; flex-shrink: 0; }

          /* Modals: Bottom-Sheet */
          .modal {
            align-items: flex-end;
            padding: 0;
          }
          .modal-content {
            border-radius: 18px 18px 0 0;
            max-width: 100%;
            width: 100%;
            max-height: 60vh;
            padding: 14px 14px 0;
            box-sizing: border-box;
            overflow-x: hidden;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            display: flex;
            flex-direction: column;
          }
          .modal-content.large { max-width: 100%; }
          .modal-content h3 { font-size: 1rem; margin-bottom: 0.6rem; flex-shrink: 0; }
          .modal-content h4 { font-size: 0.9rem; }

          /* Formfelder kompakter */
          .field { margin-bottom: 10px; }
          .field label { font-size: 12px; margin-bottom: 4px; }
          .field input, .field select, .field textarea { padding: 8px; font-size: 14px; }

          /* Modal-Actions: sticky am unteren Rand */
          .modal-actions {
            position: sticky;
            bottom: 0;
            background: rgba(255, 255, 255, 0.98);
            padding: 10px 0 calc(14px + env(safe-area-inset-bottom));
            margin-top: 8px;
            flex-shrink: 0;
          }
        }
      `}</style>
    </>
  )
}
