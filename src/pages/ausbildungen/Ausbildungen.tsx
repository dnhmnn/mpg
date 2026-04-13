import React, { useState, useEffect } from 'react'
import PocketBase from 'pocketbase'
import StatusBar from '../../components/StatusBar'
import { useAuth } from '../../hooks/useAuth'

const pb = new PocketBase('https://api.responda.systems')

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
  organization_id: string
  created: string
  updated: string
}

interface Teilnehmer {
  id: string
  vorname: string
  nachname: string
  email: string
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
  typ: 'text' | 'video' | 'quiz' | 'datei'
  titel: string
  inhalt: string
  reihenfolge: number
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
}

interface TeilnehmerForm {
  id?: string
  vorname: string
  nachname: string
  email: string
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
    status: 'geplant'
  })
  
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
  const [currentTerminTab, setCurrentTerminTab] = useState<'uebersicht' | 'teilnehmer' | 'dokumente' | 'module'>('uebersicht')
  
const [viewMode, setViewMode] = useState<'termine' | 'teilnehmer' | 'module' | 'konzepte'>('termine')
  
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
        loadKonzepte()
      ])
    } catch(e: any) {
      console.error('Fehler beim Laden:', e)
      showMessage('Fehler beim Laden der Daten', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadTermine() {
    const records = await pb.collection('ausbildungen_termine').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      sort: '-start_datetime'
    })
    setTermine(records)
  }

  async function loadTeilnehmer() {
    const termineUser = await pb.collection('ausbildungen_termine_user').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      expand: 'teilnehmer_id'
    })
    
    const userIds = [...new Set(termineUser.map(tu => tu.teilnehmer_id))]
    
    if (userIds.length === 0) {
      setTeilnehmer([])
      return
    }
    
    const userRecords = await pb.collection('users').getFullList({
      filter: userIds.map(id => `id = "${id}"`).join(' || ')
    })
    
    const teilnehmerData = userRecords.map(u => ({
      id: u.id,
      vorname: u.name?.split(' ')[0] || '',
      nachname: u.name?.split(' ').slice(1).join(' ') || '',
      email: u.email || '',
      telefon: u.phone || '',
      whatsapp: u.whatsapp || '',
      notizen: u.notizen || '',
      ausbildung_typ: u.ausbildung_typ || '',
      lernbar_zugang_aktiv: u.permissions?.lernbar || false,
      organization_id: u.organization_id,
      created: u.created
    }))
    
    setTeilnehmer(teilnehmerData)
  }

  async function loadTerminTeilnehmer() {
    const records = await pb.collection('ausbildungen_termine_user').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      expand: 'teilnehmer_id',
      sort: '-created'
    })
    setTerminTeilnehmer(records)
  }

  async function loadDokumente() {
    const records = await pb.collection('ausbildungen_dokumente').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      sort: '-created'
    })
    setDokumente(records)
  }

  async function loadModule() {
    const records = await pb.collection('ausbildungen_module').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      sort: 'name'
    })
    setModule(records)
  }

  async function loadModulTermine() {
    const records = await pb.collection('ausbildungen_module_termine').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      expand: 'modul_id',
      sort: '-created'
    })
    setModulTermine(records)
  }

  async function loadModulProgress() {
    const records = await pb.collection('ausbildungen_module_progress').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      sort: '-updated'
    })
    setModulProgress(records)
  }

  async function loadKonzepte() {
    const records = await pb.collection('ausbildungen_konzepte').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      sort: '-created'
    })
    setKonzepte(records)
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
      const existingUsers = await pb.collection('users').getFullList({
        filter: `email = "${email}" && organization_id = "${user?.organization_id}"`
      })
      
      if (existingUsers.length > 0) {
        const existing = existingUsers[0]
        setExistingUserDetected(existing)
        
        setTeilnehmerForm({
          ...teilnehmerForm,
          vorname: existing.name?.split(' ')[0] || teilnehmerForm.vorname,
          nachname: existing.name?.split(' ').slice(1).join(' ') || teilnehmerForm.nachname,
          telefon: existing.phone || teilnehmerForm.telefon,
          whatsapp: existing.whatsapp || teilnehmerForm.whatsapp,
          ausbildung_typ: existing.ausbildung_typ || teilnehmerForm.ausbildung_typ,
          notizen: existing.notizen || teilnehmerForm.notizen,
          lernbar_zugang_aktiv: existing.permissions?.lernbar || teilnehmerForm.lernbar_zugang_aktiv
        })
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

  const filteredTermine = termine
  const filteredTeilnehmer = teilnehmer
  const filteredModule = module
  const filteredKonzepte = konzepte

  // TERMIN FUNCTIONS
  function openAddTermin() {
    setTerminForm({
      name: '',
      description: '',
      start_datetime: '',
      end_datetime: '',
      location: '',
      dozent: '',
      max_teilnehmer: 20,
      status: 'geplant'
    })
    setShowAddTerminModal(true)
  }

  function openEditTermin(termin: Termin) {
    setTerminForm({
      id: termin.id,
      name: termin.name,
      description: termin.description,
      start_datetime: termin.start_datetime,
      end_datetime: termin.end_datetime,
      location: termin.location,
      dozent: termin.dozent,
      max_teilnehmer: termin.max_teilnehmer,
      status: termin.status
    })
    setShowAddTerminModal(true)
  }

  async function saveTermin() {
    if (!terminForm.name || !terminForm.start_datetime) {
      alert('Bitte Name und Startdatum eingeben')
      return
    }

    try {
      const data = {
        ...terminForm,
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
      alert('Fehler beim Speichern: ' + e.message)
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

  function viewTerminDetail(termin: Termin) {
    setSelectedTermin(termin)
    setCurrentTerminTab('uebersicht')
    setShowTerminDetailModal(true)
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

    const userData = {
      name: fullName,
      email: teilnehmerForm.email || '',
      phone: teilnehmerForm.telefon || '',
      whatsapp: teilnehmerForm.whatsapp || '',
      ausbildung_typ: teilnehmerForm.ausbildung_typ || '',
      notizen: teilnehmerForm.notizen || '',
      role: 'teilnehmer',
      permissions: permissions,
      emailVisibility: true,
      verified: false,
      organization_id: user?.organization_id
    }

    if (teilnehmerForm.id) {
      // UPDATE bestehender Teilnehmer
      const updateData = {
        name: fullName,
        email: teilnehmerForm.email || '',
        phone: teilnehmerForm.telefon || '',
        whatsapp: teilnehmerForm.whatsapp || '',
        ausbildung_typ: teilnehmerForm.ausbildung_typ || '',
        notizen: teilnehmerForm.notizen || '',
        permissions: permissions
      }
      
      await pb.collection('users').update(teilnehmerForm.id, updateData)
      showMessage('Teilnehmer aktualisiert', 'success')
      
      const oldTeilnehmer = teilnehmer.find(t => t.id === teilnehmerForm.id)
      if (teilnehmerForm.lernbar_zugang_aktiv && !oldTeilnehmer?.lernbar_zugang_aktiv && teilnehmerForm.email) {
        try {
          await pb.collection('users').requestPasswordReset(teilnehmerForm.email)
          showMessage('Password-Reset Email gesendet', 'success')
        } catch(e: any) {
          console.error('Password Reset Fehler:', e)
        }
      }
    } else {
      // CREATE: Prüfe zuerst ob User mit Email existiert
      let existingUser = null
      
      if (teilnehmerForm.email) {
        try {
          const existingUsers = await pb.collection('users').getFullList({
            filter: `email = "${teilnehmerForm.email}" && organization_id = "${user?.organization_id}"`
          })
          if (existingUsers.length > 0) {
            existingUser = existingUsers[0]
          }
        } catch(e) {
          console.log('Keine existierenden User gefunden')
        }
      }

      if (existingUser) {
        // BESTEHENDEN USER AKTUALISIEREN
        console.log('✅ Bestehender User gefunden:', existingUser.email)
        
        const mergedPermissions = {
          ...existingUser.permissions,
          lernbar: teilnehmerForm.lernbar_zugang_aktiv
        }
        
        const updateData = {
          name: fullName,
          phone: teilnehmerForm.telefon || '',
          whatsapp: teilnehmerForm.whatsapp || '',
          ausbildung_typ: teilnehmerForm.ausbildung_typ || '',
          notizen: teilnehmerForm.notizen || '',
          permissions: mergedPermissions
        }
        
        await pb.collection('users').update(existingUser.id, updateData)
        showMessage('Bestehender User verknüpft!', 'success')
        
        if (teilnehmerForm.lernbar_zugang_aktiv && teilnehmerForm.email) {
          try {
            await pb.collection('users').requestPasswordReset(teilnehmerForm.email)
            showMessage('Password-Reset Email gesendet', 'success')
          } catch(e: any) {
            console.error('Password Reset Fehler:', e)
          }
        }
      } else {
        // NEUEN USER ERSTELLEN
        console.log('➕ Erstelle neuen User')
        await pb.collection('users').create(userData)
        showMessage('Neuer Teilnehmer erstellt', 'success')
        
        if (teilnehmerForm.lernbar_zugang_aktiv && teilnehmerForm.email) {
          try {
            await pb.collection('users').requestPasswordReset(teilnehmerForm.email)
            showMessage('Password-Reset Email gesendet', 'success')
          } catch(e: any) {
            console.error('Password Reset Fehler:', e)
          }
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
      
      if (newStatus && teilnehmer.email) {
        try {
          await pb.collection('users').requestPasswordReset(teilnehmer.email)
          showMessage('Lernbar aktiviert - Password-Reset Email gesendet', 'success')
        } catch(e: any) {
          console.error('Password Reset Fehler:', e)
          showMessage('Lernbar aktiviert', 'success')
        }
      } else {
        showMessage(newStatus ? 'Lernbar aktiviert' : 'Lernbar deaktiviert', 'success')
      }
      
      await loadTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function viewTeilnehmerDetail(teilnehmer: Teilnehmer) {
    setSelectedTeilnehmer(teilnehmer)
    setShowTeilnehmerDetailModal(true)
  }

  // TERMIN-TEILNEHMER FUNCTIONS
  async function addTeilnehmerToTermin(terminId: string, teilnehmerId: string) {
    try {
      await pb.collection('ausbildungen_termine_user').create({
        termin_id: terminId,
        teilnehmer_id: teilnehmerId,
        status: 'eingeladen',
        eingeladen_am: new Date().toISOString(),
        eingeladen_via: 'persönlich',
        anwesend: false,
        notizen: '',
        organization_id: user?.organization_id
      })
      showMessage('Teilnehmer hinzugefügt', 'success')
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
      showMessage('Status aktualisiert', 'success')
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function toggleAnwesenheit(terminTeilnehmerId: string, currentStatus: boolean) {
    try {
      await pb.collection('ausbildungen_termine_user').update(terminTeilnehmerId, { 
        anwesend: !currentStatus 
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

      <div className="content">
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}


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
                      {new Date(termin.start_datetime).toLocaleDateString('de-DE', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric' 
                      })}
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
              {filteredModule.map(m => (
                <div key={m.id} className="card">
                  <div className="card-type">
                    {m.dauer_minuten} Min.
                  </div>
                  <div className="card-name">{m.name}</div>
                  <div className="card-meta">
                    {m.beschreibung && <div>{m.beschreibung}</div>}
                  </div>
                  <div className="card-stats">
                    <div className="stat-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <span>{m.inhalte?.length || 0} Inhalte</span>
                    </div>
                  </div>
                </div>
              ))}
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
                onChange={(e) => setTerminForm({ ...terminForm, name: e.target.value })}
                placeholder="z.B. Sanitätsausbildung Gruppe A"
                autoFocus
              />
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
                <option value="San A">San A</option>
                <option value="San B">San B</option>
                <option value="San C">San C</option>
                <option value="RS">RS</option>
                <option value="NFS">NFS</option>
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
              <div style={{fontSize: '13px', color: '#64748b', marginTop: '4px'}}>
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
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px'}}>
              <div>
                <h3 style={{margin: 0}}>{selectedTermin.name}</h3>
                <div style={{fontSize: '14px', color: '#64748b', marginTop: '8px'}}>
                  {new Date(selectedTermin.start_datetime).toLocaleDateString('de-DE', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })} • {selectedTermin.location}
                </div>
              </div>
              <button 
                className="btn"
                onClick={(e) => {
                  e.stopPropagation()
                  openEditTermin(selectedTermin)
                }}
              >
                Bearbeiten
              </button>
            </div>
            
            <div className="tabs">
              <button 
                className={`tab ${currentTerminTab === 'uebersicht' ? 'active' : ''}`}
                onClick={() => setCurrentTerminTab('uebersicht')}
              >
                Übersicht
              </button>
              <button 
                className={`tab ${currentTerminTab === 'teilnehmer' ? 'active' : ''}`}
                onClick={() => setCurrentTerminTab('teilnehmer')}
              >
                Teilnehmer ({getTerminTeilnehmerCount(selectedTermin.id)})
              </button>
              <button 
                className={`tab ${currentTerminTab === 'dokumente' ? 'active' : ''}`}
                onClick={() => setCurrentTerminTab('dokumente')}
              >
                Dokumente ({getTerminDokumenteCount(selectedTermin.id)})
              </button>
              <button 
                className={`tab ${currentTerminTab === 'module' ? 'active' : ''}`}
                onClick={() => setCurrentTerminTab('module')}
              >
                Module ({getTerminModuleCount(selectedTermin.id)})
              </button>
            </div>
            
            <div className="tab-content">
              {/* ÜBERSICHT TAB */}
              {currentTerminTab === 'uebersicht' && (
                <div>
                  {selectedTermin.description && (
                    <div style={{marginBottom: '16px'}}>
                      <strong>Beschreibung:</strong>
                      <div style={{marginTop: '8px', color: '#64748b'}}>{selectedTermin.description}</div>
                    </div>
                  )}
                  <div style={{display: 'grid', gap: '12px'}}>
                    <div>
                      <strong>Status:</strong>{' '}
                      <span className={`status-badge ${selectedTermin.status}`}>
                        {selectedTermin.status === 'geplant' && 'Geplant'}
                        {selectedTermin.status === 'laufend' && 'Laufend'}
                        {selectedTermin.status === 'abgeschlossen' && 'Abgeschlossen'}
                        {selectedTermin.status === 'abgesagt' && 'Abgesagt'}
                      </span>
                    </div>
                    <div><strong>Dozent:</strong> {selectedTermin.dozent || '-'}</div>
                    <div><strong>Max. Teilnehmer:</strong> {selectedTermin.max_teilnehmer}</div>
                    <div><strong>Aktuell angemeldet:</strong> {getTerminTeilnehmerCount(selectedTermin.id)}</div>
                    {selectedTermin.end_datetime && (
                      <div><strong>Ende:</strong> {new Date(selectedTermin.end_datetime).toLocaleDateString('de-DE', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</div>
                    )}
                  </div>
                </div>
              )}
              
              {/* TEILNEHMER TAB */}
              {currentTerminTab === 'teilnehmer' && (
                <div>
                  {/* Teilnehmer hinzufügen Dropdown */}
                  <div style={{marginBottom: '16px', display: 'flex', gap: '8px'}}>
                    <select 
                      className="add-teilnehmer-select"
                      onChange={(e) => {
                        if (e.target.value) {
                          addTeilnehmerToTermin(selectedTermin.id, e.target.value)
                          e.target.value = ''
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: '1px solid rgba(0, 0, 0, 0.15)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontFamily: 'inherit'
                      }}
                    >
                      <option value="">Teilnehmer hinzufügen...</option>
                      {teilnehmer
                        .filter(t => !terminTeilnehmer.some(tt => 
                          tt.termin_id === selectedTermin.id && tt.teilnehmer_id === t.id
                        ))
                        .map(t => (
                          <option key={t.id} value={t.id}>
                            {t.vorname} {t.nachname} {t.email && `(${t.email})`}
                          </option>
                        ))
                      }
                    </select>
                    <button 
                      className="btn primary"
                      onClick={() => {
                        const link = `${window.location.origin}/ausbildungen/einladung/${selectedTermin.id}`
                        navigator.clipboard.writeText(link)
                        showMessage('Einladungslink kopiert!', 'success')
                      }}
                      title="Einladungslink kopieren"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                      </svg>
                      Link
                    </button>
                  </div>

                  {/* Anwesenheitsliste */}
                  {terminTeilnehmer.filter(tt => tt.termin_id === selectedTermin.id).length === 0 ? (
                    <div className="empty-state">Noch keine Teilnehmer zugewiesen</div>
                  ) : (
                    <div className="teilnehmer-list">
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto 120px 100px',
                        gap: '12px',
                        padding: '10px 12px',
                        fontWeight: 700,
                        fontSize: '13px',
                        color: '#64748b',
                        borderBottom: '2px solid #e5e7eb',
                        marginBottom: '8px'
                      }}>
                        <div>Name</div>
                        <div>Status</div>
                        <div style={{textAlign: 'center'}}>Anwesend</div>
                        <div></div>
                      </div>
                      
                      {terminTeilnehmer
                        .filter(tt => tt.termin_id === selectedTermin.id)
                        .map(tt => {
                          const t = teilnehmer.find(teiln => teiln.id === tt.teilnehmer_id)
                          if (!t) return null
                          return (
                            <div 
                              key={tt.id} 
                              className="teilnehmer-row"
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr auto 120px 100px',
                                gap: '12px',
                                padding: '12px',
                                background: '#f9fafb',
                                borderRadius: '8px',
                                marginBottom: '8px',
                                alignItems: 'center'
                              }}
                            >
                              <div>
                                <div style={{fontWeight: 600}}>{t.vorname} {t.nachname}</div>
                                <div style={{fontSize: '13px', color: '#64748b'}}>{t.email}</div>
                              </div>
                              
                              <select
                                value={tt.status}
                                onChange={(e) => updateTeilnehmerStatus(tt.id, e.target.value)}
                                style={{
                                  padding: '6px 10px',
                                  border: '1px solid rgba(0, 0, 0, 0.15)',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontFamily: 'inherit'
                                }}
                              >
                                <option value="eingeladen">Eingeladen</option>
                                <option value="zugesagt">Zugesagt</option>
                                <option value="abgesagt">Abgesagt</option>
                                <option value="entschuldigt">Entschuldigt</option>
                              </select>
                              
                              <div style={{textAlign: 'center'}}>
                                <button
                                  className={tt.anwesend ? 'anwesend-btn active' : 'anwesend-btn'}
                                  onClick={() => toggleAnwesenheit(tt.id, tt.anwesend)}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid',
                                    borderColor: tt.anwesend ? '#22c55e' : 'rgba(0, 0, 0, 0.15)',
                                    background: tt.anwesend ? '#f0fdf4' : '#fff',
                                    color: tt.anwesend ? '#166534' : '#64748b',
                                    fontWeight: 600,
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontFamily: 'inherit'
                                  }}
                                >
                                  {tt.anwesend ? '✓ Ja' : 'Nein'}
                                </button>
                              </div>
                              
                              <button 
                                className="btn-small danger"
                                onClick={() => removeTeilnehmerFromTermin(tt.id)}
                              >
                                Entfernen
                              </button>
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
                          <h4 style={{fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#b91c1c'}}>
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
                                      <div style={{fontSize: '13px', color: '#64748b', marginTop: '4px'}}>
                                        {d.beschreibung}
                                      </div>
                                    )}
                                    <div style={{fontSize: '12px', color: '#94a3b8', marginTop: '4px'}}>
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
                                      <div style={{fontSize: '13px', color: '#64748b', marginTop: '4px'}}>
                                        {d.beschreibung}
                                      </div>
                                    )}
                                    <div style={{fontSize: '12px', color: '#94a3b8', marginTop: '4px'}}>
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
                                <div style={{fontSize: '13px', color: '#64748b', marginTop: '4px'}}>
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
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowTerminDetailModal(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEILNEHMER DETAIL MODAL */}
      {showTeilnehmerDetailModal && selectedTeilnehmer && (
        <div className="modal show" onClick={() => setShowTeilnehmerDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedTeilnehmer.vorname} {selectedTeilnehmer.nachname}</h3>
            
            <div style={{display: 'grid', gap: '12px', marginTop: '16px'}}>
              {selectedTeilnehmer.ausbildung_typ && (
                <div><strong>Ausbildungstyp:</strong> {selectedTeilnehmer.ausbildung_typ}</div>
              )}
              {selectedTeilnehmer.email && (
                <div><strong>Email:</strong> {selectedTeilnehmer.email}</div>
              )}
              {selectedTeilnehmer.telefon && (
                <div><strong>Telefon:</strong> {selectedTeilnehmer.telefon}</div>
              )}
              {selectedTeilnehmer.whatsapp && (
                <div><strong>WhatsApp:</strong> {selectedTeilnehmer.whatsapp}</div>
              )}
              {selectedTeilnehmer.notizen && (
                <div>
                  <strong>Notizen:</strong>
                  <div style={{marginTop: '8px', color: '#64748b'}}>{selectedTeilnehmer.notizen}</div>
                </div>
              )}
              <div>
                <strong>Lernbar-Zugang:</strong> {selectedTeilnehmer.lernbar_zugang_aktiv ? 'Aktiv' : 'Inaktiv'}
              </div>
              {selectedTeilnehmer.lernbar_zugang_aktiv && (
                <div style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '13px',
                  color: '#1e40af'
                }}>
                  <strong>Login-Info:</strong><br/>
                  Der Teilnehmer hat eine Password-Reset Email erhalten und kann sich damit ein Passwort setzen.
                  Login-Redirect: Lernbar-Only → /lernbar, sonst → /hub
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowTeilnehmerDetailModal(false)}>
                Schließen
              </button>
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
                      <div style={{fontSize: '12px', color: '#64748b'}}>{link.url}</div>
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
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedKonzept.name}</h3>
            {selectedKonzept.beschreibung && (
              <div style={{fontSize: '14px', color: '#64748b', marginBottom: '24px'}}>
                {selectedKonzept.beschreibung}
              </div>
            )}

            {selectedKonzept.lernziele && selectedKonzept.lernziele.length > 0 && (
              <div style={{marginBottom: '20px'}}>
                <h4 style={{fontSize: '16px', marginBottom: '12px'}}>🎯 Lernziele</h4>
                <ul style={{marginLeft: '20px', lineHeight: '1.8'}}>
                  {selectedKonzept.lernziele.map((lz, idx) => (
                    <li key={idx}>{lz}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedKonzept.handlungen && selectedKonzept.handlungen.length > 0 && (
              <div style={{marginBottom: '20px'}}>
                <h4 style={{fontSize: '16px', marginBottom: '12px'}}>✋ Handlungen</h4>
                <ul style={{marginLeft: '20px', lineHeight: '1.8'}}>
                  {selectedKonzept.handlungen.map((h, idx) => (
                    <li key={idx}>{h}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedKonzept.koennen && selectedKonzept.koennen.length > 0 && (
              <div style={{marginBottom: '20px'}}>
                <h4 style={{fontSize: '16px', marginBottom: '12px'}}>💪 Das Können</h4>
                <ul style={{marginLeft: '20px', lineHeight: '1.8'}}>
                  {selectedKonzept.koennen.map((k, idx) => (
                    <li key={idx}>{k}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedKonzept.wissensanhang_links && selectedKonzept.wissensanhang_links.length > 0 && (
              <div style={{marginBottom: '20px'}}>
                <h4 style={{fontSize: '16px', marginBottom: '12px'}}>📚 Wissensanhang</h4>
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  {selectedKonzept.wissensanhang_links.map((link, idx) => (
                    <a 
                      key={idx} 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        background: '#f9fafb',
                        padding: '12px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        color: '#1d1d1f',
                        display: 'block'
                      }}
                    >
                      <div style={{fontWeight: 600}}>{link.titel}</div>
                      <div style={{fontSize: '12px', color: '#64748b', marginTop: '4px'}}>{link.url}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions">
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

        .action-btn.active {
          background: #b91c1c;
          color: #fff;
          border-color: #b91c1c;
        }

        .action-btn.primary {
          background: #b91c1c;
          color: #fff;
          border-color: #b91c1c;
        }

        .action-btn.primary:hover {
          background: #dc2626;
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
          border-color: rgba(239, 68, 68, 0.2);
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
          color: #b91c1c;
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
          color: #dc2626;
        }

        .menu-item.danger:hover {
          background: #fee2e2;
        }

        .card-type {
          font-size: 12px;
          font-weight: 700;
          color: #b91c1c;
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
          color: #dc2626;
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
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .btn.primary {
          background: #b91c1c;
          color: #fff;
          border-color: #b91c1c;
        }

        .btn.primary:hover {
          background: #dc2626;
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
          color: #dc2626;
        }

        .btn-small.danger:hover {
          background: #fee2e2;
        }

        .btn-small.primary {
          background: #b91c1c;
          color: #fff;
          border-color: #b91c1c;
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
          color: #dc2626;
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
          color: #b91c1c;
          border-bottom-color: #b91c1c;
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

          .cards-grid {
            grid-template-columns: 1fr;
          }

          .content {
            padding-top: 185px;
          }

          .tabs {
            overflow-x: auto;
          }

          .tab {
            white-space: nowrap;
          }
        }
      `}</style>
    </>
  )
}
