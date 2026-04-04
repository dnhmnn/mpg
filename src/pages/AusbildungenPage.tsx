import React, { useState, useEffect } from 'react'
import PocketBase from 'pocketbase'
import StatusBar from '../components/StatusBar'
import { useAuth } from '../hooks/useAuth'

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

interface User {
  id: string
  name: string
  email: string
  phone: string
  whatsapp: string
  ausbildung_typ: string
  notizen: string
  role: string
  permissions: any
  organization_id: string
  created: string
}

interface TerminUser {
  id: string
  termin_id: string
  teilnehmer_id: string
  status: 'eingeladen' | 'zugesagt' | 'abgesagt' | 'entschuldigt'
  eingeladen_am: string
  eingeladen_via: 'email' | 'whatsapp' | 'persönlich' | 'telefon' | 'link'
  anwesend: boolean
  notizen: string
  organization_id: string
  expand?: {
    teilnehmer_id?: User
  }
}

interface Dokument {
  id: string
  termin_id: string
  name: string
  typ: 'dozent' | 'teilnehmer'
  datei?: string
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

interface ModulUser {
  id: string
  modul_id: string
  teilnehmer_id: string
  zugewiesen_am: string
  frist_datum: string
  pflicht: boolean
  organization_id: string
  expand?: {
    modul_id?: Modul
    teilnehmer_id?: User
  }
}

interface ModulProgress {
  id: string
  modul_id: string
  teilnehmer_id: string
  jahr: number
  fortschritt_prozent: number
  gestartet_am?: string
  abgeschlossen_am?: string
  notizen: string
  organization_id: string
}

interface Einladungslink {
  id: string
  termin_id: string
  token: string
  aktiv: boolean
  max_teilnehmer?: number
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

interface UserForm {
  id?: string
  name: string
  email: string
  phone: string
  whatsapp: string
  ausbildung_typ: string
  notizen: string
}

interface ModulForm {
  id?: string
  name: string
  beschreibung: string
  inhalte: ModulInhalt[]
  dauer_minuten: number
}

export default function Ausbildungen() {
  const { user, loading: authLoading, logout } = useAuth()
  
  const [termine, setTermine] = useState<Termin[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [terminUsers, setTerminUsers] = useState<TerminUser[]>([])
  const [dokumente, setDokumente] = useState<Dokument[]>([])
  const [module, setModule] = useState<Modul[]>([])
  const [modulTermine, setModulTermine] = useState<ModulTermin[]>([])
  const [modulUsers, setModulUsers] = useState<ModulUser[]>([])
  const [modulProgress, setModulProgress] = useState<ModulProgress[]>([])
  const [einladungslinks, setEinladungslinks] = useState<Einladungslink[]>([])
  
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null)
  
  const [showAddTerminModal, setShowAddTerminModal] = useState(false)
  const [showTerminDetailModal, setShowTerminDetailModal] = useState(false)
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [showUserDetailModal, setShowUserDetailModal] = useState(false)
  const [showAddModulModal, setShowAddModulModal] = useState(false)
  const [showUploadDokumentModal, setShowUploadDokumentModal] = useState(false)
  const [showAssignModulModal, setShowAssignModulModal] = useState(false)
  const [showAssignModulToUserModal, setShowAssignModulToUserModal] = useState(false)
  const [showEinladungslinkModal, setShowEinladungslinkModal] = useState(false)
  const [showArchivModal, setShowArchivModal] = useState(false)
  
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
  
  const [userForm, setUserForm] = useState<UserForm>({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    ausbildung_typ: '',
    notizen: ''
  })
  
  const [modulForm, setModulForm] = useState<ModulForm>({
    name: '',
    beschreibung: '',
    inhalte: [],
    dauer_minuten: 60
  })
  
  const [selectedTermin, setSelectedTermin] = useState<Termin | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedModul, setSelectedModul] = useState<Modul | null>(null)
  const [currentTerminTab, setCurrentTerminTab] = useState<'uebersicht' | 'teilnehmer' | 'dokumente' | 'module'>('uebersicht')
  const [currentUserTab, setCurrentUserTab] = useState<'uebersicht' | 'termine' | 'module' | 'archiv'>('uebersicht')
  
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'geplant' | 'laufend' | 'abgeschlossen'>('all')
  const [viewMode, setViewMode] = useState<'termine' | 'teilnehmer' | 'module'>('termine')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTyp, setUploadTyp] = useState<'dozent' | 'teilnehmer'>('teilnehmer')
  const [uploadBeschreibung, setUploadBeschreibung] = useState('')

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
        loadTermine(),
        loadUsers(),
        loadTerminUsers(),
        loadDokumente(),
        loadModule(),
        loadModulTermine(),
        loadModulUsers(),
        loadModulProgress(),
        loadEinladungslinks()
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

  async function loadUsers() {
    const records = await pb.collection('users').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      sort: 'name'
    })
    setUsers(records)
  }

  async function loadTerminUsers() {
    const records = await pb.collection('ausbildungen_termine_user').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      expand: 'teilnehmer_id'
    })
    setTerminUsers(records)
  }

  async function loadDokumente() {
    const records = await pb.collection('ausbildungen_dokumente').getFullList({
      filter: `organization_id = "${user?.organization_id}"`
    })
    setDokumente(records)
  }

  async function loadModule() {
    const records = await pb.collection('ausbildungen_module').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      sort: '-created'
    })
    setModule(records)
  }

  async function loadModulTermine() {
    const records = await pb.collection('ausbildungen_module_termine').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      expand: 'modul_id'
    })
    setModulTermine(records)
  }

  async function loadModulUsers() {
    const records = await pb.collection('ausbildungen_module_user').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      expand: 'modul_id,teilnehmer_id'
    })
    setModulUsers(records)
  }

  async function loadModulProgress() {
    const records = await pb.collection('ausbildungen_module_progress').getFullList({
      filter: `organization_id = "${user?.organization_id}"`
    })
    setModulProgress(records)
  }

  async function loadEinladungslinks() {
    const records = await pb.collection('ausbildungen_einladungslinks').getFullList({
      filter: `organization_id = "${user?.organization_id}"`
    })
    setEinladungslinks(records)
  }

  function showMessage(text: string, type: 'success' | 'error') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  // TERMIN FUNCTIONS

  function openAddTermin() {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    
    const endTime = new Date(tomorrow)
    endTime.setHours(17, 0, 0, 0)
    
    setTerminForm({
      name: '',
      description: '',
      start_datetime: tomorrow.toISOString().slice(0, 16),
      end_datetime: endTime.toISOString().slice(0, 16),
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
      start_datetime: new Date(termin.start_datetime).toISOString().slice(0, 16),
      end_datetime: new Date(termin.end_datetime).toISOString().slice(0, 16),
      location: termin.location,
      dozent: termin.dozent,
      max_teilnehmer: termin.max_teilnehmer,
      status: termin.status
    })
    setShowAddTerminModal(true)
  }

  async function saveTermin() {
    if (!terminForm.name || !terminForm.start_datetime || !terminForm.end_datetime) {
      alert('Bitte Name, Start- und Enddatum eingeben')
      return
    }

    try {
      const data = {
        name: terminForm.name,
        description: terminForm.description,
        start_datetime: new Date(terminForm.start_datetime).toISOString(),
        end_datetime: new Date(terminForm.end_datetime).toISOString(),
        location: terminForm.location,
        dozent: terminForm.dozent,
        max_teilnehmer: terminForm.max_teilnehmer,
        status: terminForm.status,
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
    if (!confirm(`Termin "${name}" wirklich löschen? Alle Teilnehmer-Zuordnungen werden ebenfalls gelöscht.`)) return

    try {
      await pb.collection('ausbildungen_termine').delete(id)
      showMessage('Termin gelöscht', 'success')
      await loadData()
    } catch(e: any) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  function openTerminDetail(termin: Termin) {
    setSelectedTermin(termin)
    setCurrentTerminTab('uebersicht')
    setShowTerminDetailModal(true)
  }

  // USER FUNCTIONS

  function openAddUser() {
    setUserForm({
      name: '',
      email: '',
      phone: '',
      whatsapp: '',
      ausbildung_typ: '',
      notizen: ''
    })
    setShowAddUserModal(true)
  }

  function openEditUser(user: User) {
    setUserForm({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      whatsapp: user.whatsapp,
      ausbildung_typ: user.ausbildung_typ,
      notizen: user.notizen
    })
    setShowAddUserModal(true)
  }

  async function saveUser() {
    if (!userForm.name) {
      alert('Bitte Name eingeben')
      return
    }

    if (!userForm.email) {
      alert('Bitte E-Mail eingeben (erforderlich für Login)')
      return
    }

    try {
      const data: any = {
        name: userForm.name,
        email: userForm.email,
        phone: userForm.phone,
        whatsapp: userForm.whatsapp,
        ausbildung_typ: userForm.ausbildung_typ,
        notizen: userForm.notizen,
        organization_id: user?.organization_id
      }

      if (userForm.id) {
        // Update bestehender User
        await pb.collection('users').update(userForm.id, data)
        showMessage('Teilnehmer aktualisiert', 'success')
      } else {
        // Neuer User - erstelle mit Lernbar-Permissions
        data.emailVisibility = true
        data.verified = false
        data.role = 'teilnehmer'
        data.permissions = {
          "ausbildungen_manage": false,
          "chat": false,
          "dashboard": false,
          "dateien": false,
          "dokumente": false,
          "einsaetze": false,
          "lager": false,
          "lernbar": true,
          "patienten": false,
          "produktausgabe": false,
          "qr": false,
          "users_manage": false
        }

        const newUser = await pb.collection('users').create(data)
        
        // Sende Password-Reset Email
        await pb.collection('users').requestPasswordReset(userForm.email)
        
        showMessage('Teilnehmer erstellt - Password-Reset Email gesendet!', 'success')
      }

      setShowAddUserModal(false)
      await loadUsers()
    } catch(e: any) {
      alert('Fehler beim Speichern: ' + e.message)
    }
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Teilnehmer "${name}" wirklich löschen?`)) return

    try {
      await pb.collection('users').delete(id)
      showMessage('Teilnehmer gelöscht', 'success')
      await loadData()
    } catch(e: any) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  function openUserDetail(selectedUser: User) {
    setSelectedUser(selectedUser)
    setCurrentUserTab('uebersicht')
    setShowUserDetailModal(true)
  }

  // TERMIN-USER FUNCTIONS

  async function addUserToTermin(terminId: string, userId: string, via: 'email' | 'whatsapp' | 'persönlich' | 'telefon' | 'link') {
    try {
      await pb.collection('ausbildungen_termine_user').create({
        termin_id: terminId,
        teilnehmer_id: userId,
        status: 'eingeladen',
        eingeladen_am: new Date().toISOString(),
        eingeladen_via: via,
        anwesend: false,
        notizen: '',
        organization_id: user?.organization_id
      })
      showMessage('Teilnehmer hinzugefügt', 'success')
      await loadTerminUsers()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function addMultipleUsersToTermin(terminId: string, userIds: string[]) {
    try {
      for (const userId of userIds) {
        await pb.collection('ausbildungen_termine_user').create({
          termin_id: terminId,
          teilnehmer_id: userId,
          status: 'eingeladen',
          eingeladen_am: new Date().toISOString(),
          eingeladen_via: 'persönlich',
          anwesend: false,
          notizen: '',
          organization_id: user?.organization_id
        })
      }
      showMessage(`${userIds.length} Teilnehmer hinzugefügt`, 'success')
      setSelectedUsers([])
      await loadTerminUsers()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function updateUserStatus(tuId: string, newStatus: 'eingeladen' | 'zugesagt' | 'abgesagt' | 'entschuldigt') {
    try {
      await pb.collection('ausbildungen_termine_user').update(tuId, {
        status: newStatus
      })
      showMessage('Status aktualisiert', 'success')
      await loadTerminUsers()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function toggleAnwesenheit(tuId: string, currentStatus: boolean) {
    try {
      await pb.collection('ausbildungen_termine_user').update(tuId, {
        anwesend: !currentStatus
      })
      await loadTerminUsers()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function removeUserFromTermin(tuId: string) {
    if (!confirm('Teilnehmer vom Termin entfernen?')) return
    
    try {
      await pb.collection('ausbildungen_termine_user').delete(tuId)
      showMessage('Teilnehmer entfernt', 'success')
      await loadTerminUsers()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function sendEinladungEmail(termin: Termin, teilnehmer: User) {
    if (!teilnehmer.email) {
      alert('Teilnehmer hat keine E-Mail-Adresse hinterlegt')
      return
    }
    const subject = encodeURIComponent(`Einladung: ${termin.name}`)
    const body = encodeURIComponent(`Hallo ${teilnehmer.name},\n\ndu bist eingeladen zu:\n\n${termin.name}\nDatum: ${new Date(termin.start_datetime).toLocaleString('de-DE')}\nOrt: ${termin.location}\n\nBitte bestätige deine Teilnahme.\n\nViele Grüße`)
    window.open(`mailto:${teilnehmer.email}?subject=${subject}&body=${body}`)
  }

  function sendEinladungWhatsApp(termin: Termin, teilnehmer: User) {
    const text = encodeURIComponent(`Hallo ${teilnehmer.name}, du bist eingeladen zu: ${termin.name} am ${new Date(termin.start_datetime).toLocaleString('de-DE')} in ${termin.location}`)
    const phone = teilnehmer.whatsapp || teilnehmer.phone
    if (!phone) {
      alert('Keine WhatsApp/Telefonnummer vorhanden')
      return
    }
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${text}`)
  }

  function toggleUserSelection(userId: string) {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  function toggleAllUsers(terminId: string) {
    const availableUsers = users.filter(u => 
      !getTerminUsersByTermin(terminId).find(tu => tu.teilnehmer_id === u.id)
    )
    
    if (selectedUsers.length === availableUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(availableUsers.map(u => u.id))
    }
  }

  // DOKUMENT FUNCTIONS

  function openUploadDokument(termin: Termin) {
    setSelectedTermin(termin)
    setUploadFile(null)
    setUploadTyp('teilnehmer')
    setUploadBeschreibung('')
    setShowUploadDokumentModal(true)
  }

  async function uploadDokument() {
    if (!uploadFile || !selectedTermin) {
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
      await loadDokumente()
    } catch(e: any) {
      alert('Fehler beim Hochladen: ' + e.message)
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

  function getDokumentURL(dokument: Dokument): string {
    if (!dokument.datei) return ''
    return pb.files.getUrl(dokument as any, dokument.datei)
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

  function openEditModul(modul: Modul) {
    setModulForm({
      id: modul.id,
      name: modul.name,
      beschreibung: modul.beschreibung,
      inhalte: modul.inhalte,
      dauer_minuten: modul.dauer_minuten
    })
    setShowAddModulModal(true)
  }

  async function saveModul() {
    if (!modulForm.name) {
      alert('Bitte Modulname eingeben')
      return
    }

    try {
      const data = {
        name: modulForm.name,
        beschreibung: modulForm.beschreibung,
        inhalte: modulForm.inhalte,
        dauer_minuten: modulForm.dauer_minuten,
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
      alert('Fehler beim Speichern: ' + e.message)
    }
  }

  async function deleteModul(id: string, name: string) {
    if (!confirm(`Modul "${name}" wirklich löschen?`)) return

    try {
      await pb.collection('ausbildungen_module').delete(id)
      showMessage('Modul gelöscht', 'success')
      await loadData()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function addModulInhalt(typ: 'text' | 'video' | 'quiz' | 'datei') {
    const newInhalt: ModulInhalt = {
      typ: typ,
      titel: '',
      inhalt: '',
      reihenfolge: modulForm.inhalte.length
    }
    setModulForm({
      ...modulForm,
      inhalte: [...modulForm.inhalte, newInhalt]
    })
  }

  function removeModulInhalt(index: number) {
    const updated = modulForm.inhalte.filter((_, i) => i !== index)
    setModulForm({ ...modulForm, inhalte: updated })
  }

  function updateModulInhalt(index: number, field: keyof ModulInhalt, value: any) {
    const updated = [...modulForm.inhalte]
    updated[index] = { ...updated[index], [field]: value }
    setModulForm({ ...modulForm, inhalte: updated })
  }

  async function assignModulToTermin(modulId: string, terminId: string, pflicht: boolean, frist?: string) {
    try {
      await pb.collection('ausbildungen_module_termine').create({
        modul_id: modulId,
        termin_id: terminId,
        pflicht: pflicht,
        frist_datum: frist || '',
        organization_id: user?.organization_id
      })
      showMessage('Modul zugeordnet', 'success')
      await loadModulTermine()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function removeModulFromTermin(mtId: string) {
    if (!confirm('Modulzuordnung entfernen?')) return

    try {
      await pb.collection('ausbildungen_module_termine').delete(mtId)
      showMessage('Modul entfernt', 'success')
      await loadModulTermine()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function assignModulToUser(modulId: string, userId: string, pflicht: boolean, frist?: string) {
    try {
      await pb.collection('ausbildungen_module_user').create({
        modul_id: modulId,
        teilnehmer_id: userId,
        zugewiesen_am: new Date().toISOString(),
        pflicht: pflicht,
        frist_datum: frist || '',
        organization_id: user?.organization_id
      })
      showMessage('Modul zugewiesen', 'success')
      await loadModulUsers()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function removeModulFromUser(muId: string) {
    if (!confirm('Modulzuweisung entfernen?')) return

    try {
      await pb.collection('ausbildungen_module_user').delete(muId)
      showMessage('Modul entfernt', 'success')
      await loadModulUsers()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // EINLADUNGSLINK FUNCTIONS

  async function createEinladungslink(terminId: string, maxTeilnehmer?: number) {
    try {
      const token = generateToken()
      await pb.collection('ausbildungen_einladungslinks').create({
        termin_id: terminId,
        token: token,
        aktiv: true,
        max_teilnehmer: maxTeilnehmer || null,
        organization_id: user?.organization_id
      })
      showMessage('Einladungslink erstellt', 'success')
      await loadEinladungslinks()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function generateToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  async function toggleEinladungslinkStatus(linkId: string, currentStatus: boolean) {
    try {
      await pb.collection('ausbildungen_einladungslinks').update(linkId, {
        aktiv: !currentStatus
      })
      showMessage(currentStatus ? 'Link deaktiviert' : 'Link aktiviert', 'success')
      await loadEinladungslinks()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function copyEinladungslink(token: string) {
    const url = `${window.location.origin}/termin-einladung/${token}`
    navigator.clipboard.writeText(url)
    showMessage('Link kopiert!', 'success')
  }

  // HELPER FUNCTIONS

  function getTerminUsersByTermin(terminId: string): TerminUser[] {
    return terminUsers.filter(tu => tu.termin_id === terminId)
  }

  function getDokumenteByTermin(terminId: string): Dokument[] {
    return dokumente.filter(d => d.termin_id === terminId)
  }

  function getModuleByTermin(terminId: string): ModulTermin[] {
    return modulTermine.filter(mt => mt.termin_id === terminId)
  }

  function getTermineByUser(userId: string): TerminUser[] {
    return terminUsers.filter(tu => tu.teilnehmer_id === userId)
  }

  function getModuleByUser(userId: string): ModulUser[] {
    return modulUsers.filter(mu => mu.teilnehmer_id === userId)
  }

  function getProgressByUserAndYear(userId: string, jahr: number): ModulProgress[] {
    return modulProgress.filter(mp => mp.teilnehmer_id === userId && mp.jahr === jahr)
  }

  function getEinladungslinkByTermin(terminId: string): Einladungslink | undefined {
    return einladungslinks.find(el => el.termin_id === terminId && el.aktiv)
  }

  function getUserById(userId: string): User | undefined {
    return users.find(u => u.id === userId)
  }

  function getTerminById(terminId: string): Termin | undefined {
    return termine.find(t => t.id === terminId)
  }

  function getModulById(modulId: string): Modul | undefined {
    return module.find(m => m.id === modulId)
  }

  // STATS

  function getTermineStats() {
    const total = termine.length
    const geplant = termine.filter(t => t.status === 'geplant').length
    const laufend = termine.filter(t => t.status === 'laufend').length
    const abgeschlossen = termine.filter(t => t.status === 'abgeschlossen').length
    
    return { total, geplant, laufend, abgeschlossen }
  }

  function getUserStats() {
    const total = users.length
    const mitLernbar = users.filter(u => u.permissions?.lernbar === true).length
    
    return { total, mitLernbar }
  }

  function getModulStats() {
    const total = module.length
    const zugewiesen = modulUsers.length
    
    return { total, zugewiesen }
  }

  // FILTER & SEARCH

  function getFilteredTermine(): Termin[] {
    let filtered = termine

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.location.toLowerCase().includes(query) ||
        t.dozent.toLowerCase().includes(query)
      )
    }

    return filtered
  }

  function getFilteredUsers(): User[] {
    if (!searchQuery) return users

    const query = searchQuery.toLowerCase()
    return users.filter(u =>
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.ausbildung_typ?.toLowerCase().includes(query)
    )
  }

  function getFilteredModule(): Modul[] {
    if (!searchQuery) return module

    const query = searchQuery.toLowerCase()
    return module.filter(m =>
      m.name.toLowerCase().includes(query) ||
      m.beschreibung?.toLowerCase().includes(query)
    )
  }

  // FORMAT HELPERS

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getStatusBadgeClass(status: string): string {
    const classes: {[key: string]: string} = {
      'geplant': 'badge-blue',
      'laufend': 'badge-green',
      'abgeschlossen': 'badge-gray',
      'abgesagt': 'badge-red',
      'eingeladen': 'badge-blue',
      'zugesagt': 'badge-green',
      'abgesagt': 'badge-red',
      'entschuldigt': 'badge-orange'
    }
    return classes[status] || 'badge-gray'
  }

  function getStatusLabel(status: string): string {
    const labels: {[key: string]: string} = {
      'geplant': 'Geplant',
      'laufend': 'Laufend',
      'abgeschlossen': 'Abgeschlossen',
      'abgesagt': 'Abgesagt',
      'eingeladen': 'Eingeladen',
      'zugesagt': 'Zugesagt',
      'entschuldigt': 'Entschuldigt'
    }
    return labels[status] || status
  }

  if (loading) {
    return (
      <div className="page">
        <StatusBar user={user} onLogout={logout} currentPage="ausbildungen" />
        <div className="loading">Lade Ausbildungen...</div>
      </div>
    )
  }

  const stats = getTermineStats()
  const userStatsData = getUserStats()
  const modulStatsData = getModulStats()

  return (
    <div className="page">
      <StatusBar user={user} onLogout={logout} currentPage="ausbildungen" />

      {message && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="page-header">
        <h1>Ausbildungen</h1>
        <div className="header-actions">
          {viewMode === 'termine' && (
            <button className="btn btn-primary" onClick={openAddTermin}>
              <span className="icon">📅</span>
              Neuer Termin
            </button>
          )}
          {viewMode === 'teilnehmer' && (
            <button className="btn btn-primary" onClick={openAddUser}>
              <span className="icon">👤</span>
              Neuer Teilnehmer
            </button>
          )}
          {viewMode === 'module' && (
            <button className="btn btn-primary" onClick={openAddModul}>
              <span className="icon">📚</span>
              Neues Modul
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${viewMode === 'termine' ? 'active' : ''}`}
          onClick={() => setViewMode('termine')}
        >
          Termine
          <span className="badge">{stats.total}</span>
        </button>
        <button
          className={`tab ${viewMode === 'teilnehmer' ? 'active' : ''}`}
          onClick={() => setViewMode('teilnehmer')}
        >
          Teilnehmer
          <span className="badge">{userStatsData.total}</span>
        </button>
        <button
          className={`tab ${viewMode === 'module' ? 'active' : ''}`}
          onClick={() => setViewMode('module')}
        >
          Module
          <span className="badge">{modulStatsData.total}</span>
        </button>
      </div>

      <div className="stats-row">
        {viewMode === 'termine' && (
          <>
            <div className="stat-card">
              <div className="stat-value">{stats.geplant}</div>
              <div className="stat-label">Geplant</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.laufend}</div>
              <div className="stat-label">Laufend</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.abgeschlossen}</div>
              <div className="stat-label">Abgeschlossen</div>
            </div>
          </>
        )}
        {viewMode === 'teilnehmer' && (
          <>
            <div className="stat-card">
              <div className="stat-value">{userStatsData.total}</div>
              <div className="stat-label">Gesamt</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{userStatsData.mitLernbar}</div>
              <div className="stat-label">Mit Lernbar</div>
            </div>
          </>
        )}
        {viewMode === 'module' && (
          <>
            <div className="stat-card">
              <div className="stat-value">{modulStatsData.total}</div>
              <div className="stat-label">Module</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{modulStatsData.zugewiesen}</div>
              <div className="stat-label">Zuweisungen</div>
            </div>
          </>
        )}
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Suchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {viewMode === 'termine' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">Alle Status</option>
            <option value="geplant">Geplant</option>
            <option value="laufend">Laufend</option>
            <option value="abgeschlossen">Abgeschlossen</option>
          </select>
        )}
      </div>

      {viewMode === 'termine' && (
        <div className="content">
          {getFilteredTermine().length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <h3>Keine Termine</h3>
              <p>Erstelle deinen ersten Ausbildungstermin</p>
              <button className="btn btn-primary" onClick={openAddTermin}>
                Termin erstellen
              </button>
            </div>
          ) : (
            <div className="grid">
              {getFilteredTermine().map(termin => {
                const teilnehmerCount = getTerminUsersByTermin(termin.id).length
                const anwesendCount = getTerminUsersByTermin(termin.id).filter(tu => tu.anwesend).length
                const dokumenteCount = getDokumenteByTermin(termin.id).length
                const moduleCount = getModuleByTermin(termin.id).length

                return (
                  <div key={termin.id} className="card termin-card" onClick={() => openTerminDetail(termin)}>
                    <div className="card-header">
                      <h3>{termin.name}</h3>
                      <span className={`badge ${getStatusBadgeClass(termin.status)}`}>
                        {getStatusLabel(termin.status)}
                      </span>
                    </div>
                    <div className="card-body">
                      <div className="info-row">
                        <span className="icon">📅</span>
                        <span>{formatDateTime(termin.start_datetime)}</span>
                      </div>
                      {termin.location && (
                        <div className="info-row">
                          <span className="icon">📍</span>
                          <span>{termin.location}</span>
                        </div>
                      )}
                      {termin.dozent && (
                        <div className="info-row">
                          <span className="icon">👨‍🏫</span>
                          <span>{termin.dozent}</span>
                        </div>
                      )}
                      <div className="info-row">
                        <span className="icon">👥</span>
                        <span>{teilnehmerCount} Teilnehmer</span>
                        {termin.status === 'abgeschlossen' && (
                          <span className="sub-info">({anwesendCount} anwesend)</span>
                        )}
                      </div>
                      {dokumenteCount > 0 && (
                        <div className="info-row">
                          <span className="icon">📄</span>
                          <span>{dokumenteCount} Dokumente</span>
                        </div>
                      )}
                      {moduleCount > 0 && (
                        <div className="info-row">
                          <span className="icon">📚</span>
                          <span>{moduleCount} Module</span>
                        </div>
                      )}
                    </div>
                    <div className="card-footer">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditTermin(termin)
                        }}
                      >
                        Bearbeiten
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteTermin(termin.id, termin.name)
                        }}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === 'teilnehmer' && (
        <div className="content">
          {getFilteredUsers().length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h3>Keine Teilnehmer</h3>
              <p>Erstelle deinen ersten Teilnehmer</p>
              <button className="btn btn-primary" onClick={openAddUser}>
                Teilnehmer erstellen
              </button>
            </div>
          ) : (
            <div className="grid">
              {getFilteredUsers().map(teilnehmer => {
                const termineCount = getTermineByUser(teilnehmer.id).length
                const moduleCount = getModuleByUser(teilnehmer.id).length
                const progressData = getProgressByUserAndYear(teilnehmer.id, currentYear)
                const abgeschlossen = progressData.filter(p => p.fortschritt_prozent === 100).length

                return (
                  <div key={teilnehmer.id} className="card user-card" onClick={() => openUserDetail(teilnehmer)}>
                    <div className="card-header">
                      <div className="user-avatar">{teilnehmer.name.charAt(0)}</div>
                      <div className="user-info">
                        <h3>{teilnehmer.name}</h3>
                        {teilnehmer.ausbildung_typ && (
                          <span className="badge badge-blue">{teilnehmer.ausbildung_typ}</span>
                        )}
                      </div>
                    </div>
                    <div className="card-body">
                      {teilnehmer.email && (
                        <div className="info-row">
                          <span className="icon">📧</span>
                          <span>{teilnehmer.email}</span>
                        </div>
                      )}
                      {teilnehmer.phone && (
                        <div className="info-row">
                          <span className="icon">📱</span>
                          <span>{teilnehmer.phone}</span>
                        </div>
                      )}
                      {teilnehmer.whatsapp && (
                        <div className="info-row">
                          <span className="icon">💬</span>
                          <span>{teilnehmer.whatsapp}</span>
                        </div>
                      )}
                      <div className="info-row">
                        <span className="icon">📅</span>
                        <span>{termineCount} Termine</span>
                      </div>
                      <div className="info-row">
                        <span className="icon">📚</span>
                        <span>{moduleCount} Module zugewiesen</span>
                      </div>
                      {progressData.length > 0 && (
                        <div className="info-row">
                          <span className="icon">✅</span>
                          <span>{abgeschlossen} von {progressData.length} abgeschlossen ({currentYear})</span>
                        </div>
                      )}
                      {teilnehmer.permissions?.lernbar && (
                        <div className="info-row">
                          <span className="icon">🎓</span>
                          <span className="badge badge-green">Lernbar-Zugang</span>
                        </div>
                      )}
                    </div>
                    <div className="card-footer">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditUser(teilnehmer)
                        }}
                      >
                        Bearbeiten
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteUser(teilnehmer.id, teilnehmer.name)
                        }}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === 'module' && (
        <div className="content">
          {getFilteredModule().length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📚</div>
              <h3>Keine Module</h3>
              <p>Erstelle dein erstes Lernmodul</p>
              <button className="btn btn-primary" onClick={openAddModul}>
                Modul erstellen
              </button>
            </div>
          ) : (
            <div className="grid">
              {getFilteredModule().map(modul => {
                const termineCount = modulTermine.filter(mt => mt.modul_id === modul.id).length
                const userCount = modulUsers.filter(mu => mu.modul_id === modul.id).length
                const inhalteCount = modul.inhalte?.length || 0

                return (
                  <div key={modul.id} className="card modul-card">
                    <div className="card-header">
                      <h3>{modul.name}</h3>
                      {modul.dauer_minuten && (
                        <span className="badge badge-gray">{modul.dauer_minuten} Min</span>
                      )}
                    </div>
                    <div className="card-body">
                      {modul.beschreibung && (
                        <div className="modul-description" dangerouslySetInnerHTML={{ __html: modul.beschreibung }} />
                      )}
                      <div className="info-row">
                        <span className="icon">📝</span>
                        <span>{inhalteCount} Inhalte</span>
                      </div>
                      <div className="info-row">
                        <span className="icon">📅</span>
                        <span>{termineCount} Termine</span>
                      </div>
                      <div className="info-row">
                        <span className="icon">👥</span>
                        <span>{userCount} direkte Zuweisungen</span>
                      </div>
                    </div>
                    <div className="card-footer">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openEditModul(modul)}
                      >
                        Bearbeiten
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setSelectedModul(modul)
                          setShowAssignModulToUserModal(true)
                        }}
                      >
                        Zuweisen
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => deleteModul(modul.id, modul.name)}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showAddTerminModal && (
        <div className="modal-overlay" onClick={() => setShowAddTerminModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{terminForm.id ? 'Termin bearbeiten' : 'Neuer Termin'}</h2>
              <button className="modal-close" onClick={() => setShowAddTerminModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Name *</label>
                <input
                  type="text"
                  value={terminForm.name}
                  onChange={(e) => setTerminForm({ ...terminForm, name: e.target.value })}
                  placeholder="z.B. Erste Hilfe Grundkurs"
                />
              </div>

              <div className="field">
                <label>Beschreibung</label>
                <textarea
                  value={terminForm.description}
                  onChange={(e) => setTerminForm({ ...terminForm, description: e.target.value })}
                  placeholder="Kurzbeschreibung des Termins"
                  rows={3}
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Start *</label>
                  <input
                    type="datetime-local"
                    value={terminForm.start_datetime}
                    onChange={(e) => setTerminForm({ ...terminForm, start_datetime: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label>Ende *</label>
                  <input
                    type="datetime-local"
                    value={terminForm.end_datetime}
                    onChange={(e) => setTerminForm({ ...terminForm, end_datetime: e.target.value })}
                  />
                </div>
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

              <div className="field-row">
                <div className="field">
                  <label>Max. Teilnehmer</label>
                  <input
                    type="number"
                    value={terminForm.max_teilnehmer}
                    onChange={(e) => setTerminForm({ ...terminForm, max_teilnehmer: parseInt(e.target.value) || 20 })}
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
   
      {showTerminDetailModal && selectedTermin && (
        <div className="modal-overlay" onClick={() => setShowTerminDetailModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedTermin.name}</h2>
                <span className={`badge ${getStatusBadgeClass(selectedTermin.status)}`}>
                  {getStatusLabel(selectedTermin.status)}
                </span>
              </div>
              <button className="modal-close" onClick={() => setShowTerminDetailModal(false)}>×</button>
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
                Teilnehmer
                <span className="badge">{getTerminUsersByTermin(selectedTermin.id).length}</span>
              </button>
              <button
                className={`tab ${currentTerminTab === 'dokumente' ? 'active' : ''}`}
                onClick={() => setCurrentTerminTab('dokumente')}
              >
                Dokumente
                <span className="badge">{getDokumenteByTermin(selectedTermin.id).length}</span>
              </button>
              <button
                className={`tab ${currentTerminTab === 'module' ? 'active' : ''}`}
                onClick={() => setCurrentTerminTab('module')}
              >
                Module
                <span className="badge">{getModuleByTermin(selectedTermin.id).length}</span>
              </button>
            </div>

            <div className="modal-body">
              {currentTerminTab === 'uebersicht' && (
                <div className="termin-overview">
                  <div className="info-section">
                    <div className="info-row">
                      <span className="icon">📅</span>
                      <div>
                        <strong>Start:</strong> {formatDateTime(selectedTermin.start_datetime)}
                      </div>
                    </div>
                    <div className="info-row">
                      <span className="icon">📅</span>
                      <div>
                        <strong>Ende:</strong> {formatDateTime(selectedTermin.end_datetime)}
                      </div>
                    </div>
                    {selectedTermin.location && (
                      <div className="info-row">
                        <span className="icon">📍</span>
                        <div>
                          <strong>Ort:</strong> {selectedTermin.location}
                        </div>
                      </div>
                    )}
                    {selectedTermin.dozent && (
                      <div className="info-row">
                        <span className="icon">👨‍🏫</span>
                        <div>
                          <strong>Dozent:</strong> {selectedTermin.dozent}
                        </div>
                      </div>
                    )}
                    <div className="info-row">
                      <span className="icon">👥</span>
                      <div>
                        <strong>Max. Teilnehmer:</strong> {selectedTermin.max_teilnehmer}
                      </div>
                    </div>
                  </div>

                  {selectedTermin.description && (
                    <div className="description-section">
                      <h3>Beschreibung</h3>
                      <div dangerouslySetInnerHTML={{ __html: selectedTermin.description }} />
                    </div>
                  )}

                  <div className="actions-section">
                    <button className="btn btn-secondary" onClick={() => openEditTermin(selectedTermin)}>
                      Bearbeiten
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setShowEinladungslinkModal(true)
                      }}
                    >
                      Einladungslink erstellen
                    </button>
                  </div>
                </div>
              )}

              {currentTerminTab === 'teilnehmer' && (
                <div className="teilnehmer-section">
                  <div className="section-header">
                    <h3>Teilnehmer hinzufügen</h3>
                    {selectedUsers.length > 0 && (
                      <button
                        className="btn btn-primary"
                        onClick={() => addMultipleUsersToTermin(selectedTermin.id, selectedUsers)}
                      >
                        {selectedUsers.length} Teilnehmer hinzufügen
                      </button>
                    )}
                  </div>

                  <div className="user-select-list">
                    <div className="user-select-header">
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedUsers.length === users.filter(u => !getTerminUsersByTermin(selectedTermin.id).find(tu => tu.teilnehmer_id === u.id)).length && selectedUsers.length > 0}
                          onChange={() => toggleAllUsers(selectedTermin.id)}
                        />
                        <span>Alle auswählen</span>
                      </label>
                    </div>
                    {users
                      .filter(u => !getTerminUsersByTermin(selectedTermin.id).find(tu => tu.teilnehmer_id === u.id))
                      .map(u => (
                        <div key={u.id} className="user-select-item">
                          <label>
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(u.id)}
                              onChange={() => toggleUserSelection(u.id)}
                            />
                            <span>{u.name}</span>
                            {u.ausbildung_typ && (
                              <span className="badge badge-blue">{u.ausbildung_typ}</span>
                            )}
                          </label>
                        </div>
                      ))}
                  </div>

                  <div className="section-divider"></div>

                  <h3>Zugeordnete Teilnehmer</h3>
                  {getTerminUsersByTermin(selectedTermin.id).length === 0 ? (
                    <p className="empty-text">Noch keine Teilnehmer zugeordnet</p>
                  ) : (
                    <div className="teilnehmer-list">
                      {getTerminUsersByTermin(selectedTermin.id).map(tu => {
                        const teilnehmer = getUserById(tu.teilnehmer_id)
                        if (!teilnehmer) return null

                        return (
                          <div key={tu.id} className="teilnehmer-item">
                            <div className="teilnehmer-info">
                              <div className="user-avatar">{teilnehmer.name.charAt(0)}</div>
                              <div>
                                <strong>{teilnehmer.name}</strong>
                                <div className="teilnehmer-meta">
                                  <span className={`badge ${getStatusBadgeClass(tu.status)}`}>
                                    {getStatusLabel(tu.status)}
                                  </span>
                                  {tu.eingeladen_via && (
                                    <span className="badge badge-gray">{tu.eingeladen_via}</span>
                                  )}
                                  {tu.anwesend && (
                                    <span className="badge badge-green">Anwesend</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="teilnehmer-actions">
                              <select
                                value={tu.status}
                                onChange={(e) => updateUserStatus(tu.id, e.target.value as any)}
                                className="status-select"
                              >
                                <option value="eingeladen">Eingeladen</option>
                                <option value="zugesagt">Zugesagt</option>
                                <option value="abgesagt">Abgesagt</option>
                                <option value="entschuldigt">Entschuldigt</option>
                              </select>
                              <button
                                className={`btn btn-sm ${tu.anwesend ? 'btn-success' : 'btn-secondary'}`}
                                onClick={() => toggleAnwesenheit(tu.id, tu.anwesend)}
                              >
                                {tu.anwesend ? '✓' : '○'}
                              </button>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => sendEinladungEmail(selectedTermin, teilnehmer)}
                              >
                                📧
                              </button>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => sendEinladungWhatsApp(selectedTermin, teilnehmer)}
                              >
                                💬
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => removeUserFromTermin(tu.id)}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {currentTerminTab === 'dokumente' && (
                <div className="dokumente-section">
                  <div className="section-header">
                    <h3>Dokumente</h3>
                    <button
                      className="btn btn-primary"
                      onClick={() => openUploadDokument(selectedTermin)}
                    >
                      📄 Dokument hochladen
                    </button>
                  </div>

                  {getDokumenteByTermin(selectedTermin.id).length === 0 ? (
                    <p className="empty-text">Noch keine Dokumente vorhanden</p>
                  ) : (
                    <div className="dokumente-list">
                      {getDokumenteByTermin(selectedTermin.id).map(dok => (
                        <div key={dok.id} className="dokument-item">
                          <div className="dokument-info">
                            <span className="icon">📄</span>
                            <div>
                              <strong>{dok.name}</strong>
                              <div className="dokument-meta">
                                <span className={`badge ${dok.typ === 'dozent' ? 'badge-orange' : 'badge-blue'}`}>
                                  {dok.typ === 'dozent' ? 'Dozent' : 'Teilnehmer'}
                                </span>
                                <span className="text-muted">{formatDate(dok.created)}</span>
                              </div>
                              {dok.beschreibung && (
                                <p className="dokument-description">{dok.beschreibung}</p>
                              )}
                            </div>
                          </div>
                          <div className="dokument-actions">
                            {dok.datei && (
                              <a
                                href={getDokumentURL(dok)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-secondary"
                              >
                                Öffnen
                              </a>
                            )}
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => deleteDokument(dok.id, dok.name)}
                            >
                              Löschen
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {currentTerminTab === 'module' && (
                <div className="module-section">
                  <div className="section-header">
                    <h3>Zugeordnete Module</h3>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setShowAssignModulModal(true)
                      }}
                    >
                      📚 Modul zuordnen
                    </button>
                  </div>

                  {getModuleByTermin(selectedTermin.id).length === 0 ? (
                    <p className="empty-text">Noch keine Module zugeordnet</p>
                  ) : (
                    <div className="module-list">
                      {getModuleByTermin(selectedTermin.id).map(mt => {
                        const modul = getModulById(mt.modul_id)
                        if (!modul) return null

                        return (
                          <div key={mt.id} className="modul-item">
                            <div className="modul-info">
                              <span className="icon">📚</span>
                              <div>
                                <strong>{modul.name}</strong>
                                <div className="modul-meta">
                                  {mt.pflicht && (
                                    <span className="badge badge-red">Pflicht</span>
                                  )}
                                  {mt.frist_datum && (
                                    <span className="badge badge-orange">
                                      Frist: {formatDate(mt.frist_datum)}
                                    </span>
                                  )}
                                  {modul.dauer_minuten && (
                                    <span className="badge badge-gray">{modul.dauer_minuten} Min</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="modul-actions">
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => removeModulFromTermin(mt.id)}
                              >
                                Entfernen
                              </button>
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
           </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddTerminModal(false)}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={saveTermin}>
                {terminForm.id ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddUserModal && (
        <div className="modal-overlay" onClick={() => setShowAddUserModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{userForm.id ? 'Teilnehmer bearbeiten' : 'Neuer Teilnehmer'}</h2>
              <button className="modal-close" onClick={() => setShowAddUserModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Name *</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="Max Mustermann"
                />
              </div>

              <div className="field">
                <label>E-Mail * (für Login erforderlich)</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="max@example.com"
                />
                {!userForm.id && (
                  <div className="field-hint">
                    Nach dem Erstellen wird automatisch eine Password-Reset E-Mail gesendet
                  </div>
                )}
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Telefon</label>
                  <input
                    type="tel"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    placeholder="+49..."
                  />
                </div>

                <div className="field">
                  <label>WhatsApp</label>
                  <input
                    type="tel"
                    value={userForm.whatsapp}
                    onChange={(e) => setUserForm({ ...userForm, whatsapp: e.target.value })}
                    placeholder="+49..."
                  />
                </div>
              </div>

              <div className="field">
                <label>Ausbildungstyp</label>
                <select
                  value={userForm.ausbildung_typ}
                  onChange={(e) => setUserForm({ ...userForm, ausbildung_typ: e.target.value })}
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
                  value={userForm.notizen}
                  onChange={(e) => setUserForm({ ...userForm, notizen: e.target.value })}
                  placeholder="Zusätzliche Informationen"
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddUserModal(false)}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={saveUser}>
                {userForm.id ? 'Speichern' : 'Erstellen & E-Mail senden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUserDetailModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowUserDetailModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedUser.name}</h2>
                {selectedUser.ausbildung_typ && (
                  <span className="badge badge-blue">{selectedUser.ausbildung_typ}</span>
                )}
              </div>
              <button className="modal-close" onClick={() => setShowUserDetailModal(false)}>×</button>
            </div>

            <div className="tabs">
              <button
                className={`tab ${currentUserTab === 'uebersicht' ? 'active' : ''}`}
                onClick={() => setCurrentUserTab('uebersicht')}
              >
                Übersicht
              </button>
              <button
                className={`tab ${currentUserTab === 'termine' ? 'active' : ''}`}
                onClick={() => setCurrentUserTab('termine')}
              >
                Termine
                <span className="badge">{getTermineByUser(selectedUser.id).length}</span>
              </button>
              <button
                className={`tab ${currentUserTab === 'module' ? 'active' : ''}`}
                onClick={() => setCurrentUserTab('module')}
              >
                Module
                <span className="badge">{getModuleByUser(selectedUser.id).length}</span>
              </button>
              <button
                className={`tab ${currentUserTab === 'archiv' ? 'active' : ''}`}
                onClick={() => setCurrentUserTab('archiv')}
              >
                Archiv
              </button>
            </div>

            <div className="modal-body">
              {currentUserTab === 'uebersicht' && (
                <div className="user-overview">
                  <div className="info-section">
                    {selectedUser.email && (
                      <div className="info-row">
                        <span className="icon">📧</span>
                        <div>
                          <strong>E-Mail:</strong> {selectedUser.email}
                        </div>
                      </div>
                    )}
                    {selectedUser.phone && (
                      <div className="info-row">
                        <span className="icon">📱</span>
                        <div>
                          <strong>Telefon:</strong> {selectedUser.phone}
                        </div>
                      </div>
                    )}
                    {selectedUser.whatsapp && (
                      <div className="info-row">
                        <span className="icon">💬</span>
                        <div>
                          <strong>WhatsApp:</strong> {selectedUser.whatsapp}
                        </div>
                      </div>
                    )}
                    {selectedUser.ausbildung_typ && (
                      <div className="info-row">
                        <span className="icon">🎓</span>
                        <div>
                          <strong>Ausbildungstyp:</strong> {selectedUser.ausbildung_typ}
                        </div>
                      </div>
                    )}
                    {selectedUser.permissions?.lernbar && (
                      <div className="info-row">
                        <span className="icon">✅</span>
                        <div>
                          <strong>Lernbar-Zugang:</strong> Aktiv
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedUser.notizen && (
                    <div className="notes-section">
                      <h3>Notizen</h3>
                      <div dangerouslySetInnerHTML={{ __html: selectedUser.notizen }} />
                    </div>
                  )}

                  <div className="stats-section">
                    <div className="stat-card">
                      <div className="stat-value">{getTermineByUser(selectedUser.id).length}</div>
                      <div className="stat-label">Termine</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{getModuleByUser(selectedUser.id).length}</div>
                      <div className="stat-label">Module</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">
                        {getProgressByUserAndYear(selectedUser.id, currentYear).filter(p => p.fortschritt_prozent === 100).length}
                      </div>
                      <div className="stat-label">Abgeschlossen {currentYear}</div>
                    </div>
                  </div>

                  <button className="btn btn-secondary" onClick={() => openEditUser(selectedUser)}>
                    Bearbeiten
                  </button>
                </div>
              )}

              {currentUserTab === 'termine' && (
                <div className="user-termine">
                  {getTermineByUser(selectedUser.id).length === 0 ? (
                    <p className="empty-text">Keine Termine zugeordnet</p>
                  ) : (
                    <div className="termine-list">
                      {getTermineByUser(selectedUser.id).map(tu => {
                        const termin = getTerminById(tu.termin_id)
                        if (!termin) return null

                        return (
                          <div key={tu.id} className="termin-item">
                            <div className="termin-info">
                              <span className="icon">📅</span>
                              <div>
                                <strong>{termin.name}</strong>
                                <div className="termin-meta">
                                  <span>{formatDateTime(termin.start_datetime)}</span>
                                  <span className={`badge ${getStatusBadgeClass(tu.status)}`}>
                                    {getStatusLabel(tu.status)}
                                  </span>
                                  {tu.anwesend && (
                                    <span className="badge badge-green">Anwesend</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {currentUserTab === 'module' && (
                <div className="user-module">
                  <h3>Fortschritt {currentYear}</h3>
                  {getModuleByUser(selectedUser.id).length === 0 ? (
                    <p className="empty-text">Keine Module zugewiesen</p>
                  ) : (
                    <div className="module-progress-list">
                      {getModuleByUser(selectedUser.id).map(mu => {
                        const modul = mu.expand?.modul_id
                        if (!modul) return null

                        const progress = modulProgress.find(p => 
                          p.modul_id === mu.modul_id && 
                          p.teilnehmer_id === selectedUser.id && 
                          p.jahr === currentYear
                        )

                        return (
                          <div key={mu.id} className="modul-progress-item">
                            <div className="modul-info">
                              <strong>{modul.name}</strong>
                              <div className="modul-meta">
                                {mu.pflicht && (
                                  <span className="badge badge-red">Pflicht</span>
                                )}
                                {mu.frist_datum && (
                                  <span className="badge badge-orange">
                                    Frist: {formatDate(mu.frist_datum)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="progress-info">
                              {progress ? (
                                <>
                                  <div className="progress-bar">
                                    <div
                                      className="progress-fill"
                                      style={{ width: `${progress.fortschritt_prozent}%` }}
                                    ></div>
                                  </div>
                                  <span>{progress.fortschritt_prozent}%</span>
                                  {progress.abgeschlossen_am && (
                                    <span className="badge badge-green">✓</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted">Noch nicht gestartet</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {currentUserTab === 'archiv' && (
                <div className="user-archiv">
                  <div className="year-selector">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setCurrentYear(currentYear - 1)}
                    >
                      ←
                    </button>
                    <span className="year-display">{currentYear}</span>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setCurrentYear(currentYear + 1)}
                      disabled={currentYear >= new Date().getFullYear()}
                    >
                      →
                    </button>
                  </div>

                  {getProgressByUserAndYear(selectedUser.id, currentYear).length === 0 ? (
                    <p className="empty-text">Keine Daten für {currentYear}</p>
                  ) : (
                    <div className="archiv-list">
                      {getProgressByUserAndYear(selectedUser.id, currentYear).map(p => {
                        const modul = getModulById(p.modul_id)
                        if (!modul) return null

                        return (
                          <div key={p.id} className="archiv-item">
                            <div className="modul-info">
                              <strong>{modul.name}</strong>
                            </div>
                            <div className="progress-info">
                              <div className="progress-bar">
                                <div
                                  className="progress-fill"
                                  style={{ width: `${p.fortschritt_prozent}%` }}
                                ></div>
                              </div>
                              <span>{p.fortschritt_prozent}%</span>
                              {p.abgeschlossen_am && (
                                <span className="text-success">
                                  ✓ {formatDate(p.abgeschlossen_am)}
                                </span>
                              )}
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

      {showAddModulModal && (
        <div className="modal-overlay" onClick={() => setShowAddModulModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modulForm.id ? 'Modul bearbeiten' : 'Neues Modul'}</h2>
              <button className="modal-close" onClick={() => setShowAddModulModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Modulname *</label>
                <input
                  type="text"
                  value={modulForm.name}
                  onChange={(e) => setModulForm({ ...modulForm, name: e.target.value })}
                  placeholder="z.B. Reanimation Grundlagen"
                />
              </div>

              <div className="field">
                <label>Beschreibung</label>
                <textarea
                  value={modulForm.beschreibung}
                  onChange={(e) => setModulForm({ ...modulForm, beschreibung: e.target.value })}
                  placeholder="Kurzbeschreibung des Moduls"
                  rows={3}
                />
              </div>

              <div className="field">
                <label>Dauer (Minuten)</label>
                <input
                  type="number"
                  value={modulForm.dauer_minuten}
                  onChange={(e) => setModulForm({ ...modulForm, dauer_minuten: parseInt(e.target.value) || 60 })}
                  min="1"
                />
              </div>

              <div className="field">
                <label>Inhalte</label>
                <div className="inhalte-list">
                  {modulForm.inhalte.map((inhalt, index) => (
                    <div key={index} className="inhalt-item">
                      <div className="inhalt-header">
                        <select
                          value={inhalt.typ}
                          onChange={(e) => updateModulInhalt(index, 'typ', e.target.value)}
                        >
                          <option value="text">Text</option>
                          <option value="video">Video</option>
                          <option value="quiz">Quiz</option>
                          <option value="datei">Datei</option>
                        </select>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => removeModulInhalt(index)}
                        >
                          ×
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Titel"
                        value={inhalt.titel}
                        onChange={(e) => updateModulInhalt(index, 'titel', e.target.value)}
                      />
                      <textarea
                        placeholder="Inhalt"
                        value={inhalt.inhalt}
                        onChange={(e) => updateModulInhalt(index, 'inhalt', e.target.value)}
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
                <div className="add-inhalt-buttons">
                  <button className="btn btn-sm btn-secondary" onClick={() => addModulInhalt('text')}>
                    + Text
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => addModulInhalt('video')}>
                    + Video
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => addModulInhalt('quiz')}>
                    + Quiz
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => addModulInhalt('datei')}>
                    + Datei
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModulModal(false)}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={saveModul}>
                {modulForm.id ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignModulModal && selectedTermin && (
        <div className="modal-overlay" onClick={() => setShowAssignModulModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Modul zu Termin zuordnen</h2>
              <button className="modal-close" onClick={() => setShowAssignModulModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Termin: <strong>{selectedTermin.name}</strong></p>
              
              <div className="module-select-list">
                {module
                  .filter(m => !getModuleByTermin(selectedTermin.id).find(mt => mt.modul_id === m.id))
                  .map(m => (
                    <div key={m.id} className="module-select-item">
                      <div className="module-info">
                        <strong>{m.name}</strong>
                        {m.dauer_minuten && (
                          <span className="badge badge-gray">{m.dauer_minuten} Min</span>
                        )}
                      </div>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          assignModulToTermin(m.id, selectedTermin.id, true)
                          setShowAssignModulModal(false)
                        }}
                      >
                        Zuordnen
                      </button>
                    </div>
                  ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAssignModulModal(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignModulToUserModal && selectedModul && (
        <div className="modal-overlay" onClick={() => setShowAssignModulToUserModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Modul zuweisen</h2>
              <button className="modal-close" onClick={() => setShowAssignModulToUserModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Modul: <strong>{selectedModul.name}</strong></p>
              
              <div className="user-select-list">
                {users
                  .filter(u => !modulUsers.find(mu => mu.modul_id === selectedModul.id && mu.teilnehmer_id === u.id))
                  .map(u => (
                    <div key={u.id} className="user-select-item">
                      <div className="user-info">
                        <strong>{u.name}</strong>
                        {u.ausbildung_typ && (
                          <span className="badge badge-blue">{u.ausbildung_typ}</span>
                        )}
                      </div>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          assignModulToUser(selectedModul.id, u.id, true)
                        }}
                      >
                        Zuweisen
                      </button>
                    </div>
                  ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAssignModulToUserModal(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploadDokumentModal && selectedTermin && (
        <div className="modal-overlay" onClick={() => setShowUploadDokumentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Dokument hochladen</h2>
              <button className="modal-close" onClick={() => setShowUploadDokumentModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Termin: <strong>{selectedTermin.name}</strong></p>

              <div className="field">
                <label>Datei *</label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                />
              </div>

              <div className="field">
                <label>Typ *</label>
                <select
                  value={uploadTyp}
                  onChange={(e) => setUploadTyp(e.target.value as 'dozent' | 'teilnehmer')}
                >
                  <option value="teilnehmer">Teilnehmer (sichtbar in Lernbar)</option>
                  <option value="dozent">Dozent (nur für Dozenten)</option>
                </select>
              </div>

              <div className="field">
                <label>Beschreibung</label>
                <textarea
                  value={uploadBeschreibung}
                  onChange={(e) => setUploadBeschreibung(e.target.value)}
                  placeholder="Optionale Beschreibung"
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowUploadDokumentModal(false)}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={uploadDokument} disabled={!uploadFile}>
                Hochladen
              </button>
            </div>
          </div>
        </div>
      )}

      {showEinladungslinkModal && selectedTermin && (
        <div className="modal-overlay" onClick={() => setShowEinladungslinkModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Einladungslink</h2>
              <button className="modal-close" onClick={() => setShowEinladungslinkModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Termin: <strong>{selectedTermin.name}</strong></p>

              {(() => {
                const link = getEinladungslinkByTermin(selectedTermin.id)
                
                if (link) {
                  return (
                    <div className="einladungslink-info">
                      <div className="link-status">
                        <span className={`badge ${link.aktiv ? 'badge-green' : 'badge-red'}`}>
                          {link.aktiv ? 'Aktiv' : 'Deaktiviert'}
                        </span>
                      </div>
                      
                      <div className="link-url">
                        <input
                          type="text"
                          value={`${window.location.origin}/termin-einladung/${link.token}`}
                          readOnly
                          className="link-input"
                        />
                        <button
                          className="btn btn-secondary"
                          onClick={() => copyEinladungslink(link.token)}
                        >
                          📋 Kopieren
                        </button>
                      </div>

                      <div className="link-actions">
                        <button
                          className={`btn ${link.aktiv ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => toggleEinladungslinkStatus(link.id, link.aktiv)}
                        >
                          {link.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                        </button>
                      </div>

                      <div className="link-info-text">
                        <p>Erstellt am: {formatDateTime(link.created)}</p>
                        {link.max_teilnehmer && (
                          <p>Max. Teilnehmer: {link.max_teilnehmer}</p>
                        )}
                      </div>
                    </div>
                  )
                } else {
                  return (
                    <div className="no-link">
                      <p>Noch kein Einladungslink vorhanden</p>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          createEinladungslink(selectedTermin.id)
                        }}
                      >
                        Link erstellen
                      </button>
                    </div>
                  )
                }
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEinladungslinkModal(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .page {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .loading {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          color: white;
          font-size: 18px;
        }

        .message {
          position: fixed;
          top: 80px;
          right: 20px;
          padding: 16px 24px;
          border-radius: 12px;
          background: white;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
          z-index: 10000;
          animation: slideIn 0.3s ease;
        }

        .message-success {
          border-left: 4px solid #10b981;
        }

        .message-error {
          border-left: 4px solid #ef4444;
        }

        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .page-header {
          padding: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .page-header h1 {
          color: white;
          font-size: 32px;
          font-weight: 600;
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .tabs {
          display: flex;
          gap: 8px;
          padding: 0 24px;
          border-bottom: 1px solid rgba(255,255,255,0.2);
        }

        .tab {
          padding: 12px 24px;
          background: none;
          border: none;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          transition: all 0.2s;
        }

        .tab:hover {
          color: white;
        }

        .tab.active {
          color: white;
          font-weight: 500;
        }

        .tab.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: white;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          padding: 24px;
        }

        .stat-card {
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          padding: 20px;
          text-align: center;
        }

        .stat-value {
          font-size: 36px;
          font-weight: 700;
          color: #667eea;
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 14px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .toolbar {
          padding: 0 24px 24px;
          display: flex;
          gap: 12px;
        }

        .search-input {
          flex: 1;
          padding: 12px 16px;
          border: none;
          border-radius: 12px;
          background: rgba(255,255,255,0.95);
          font-size: 15px;
        }

        .filter-select {
          padding: 12px 16px;
          border: none;
          border-radius: 12px;
          background: rgba(255,255,255,0.95);
          font-size: 15px;
          cursor: pointer;
        }

        .content {
          padding: 0 24px 24px;
        }

        .empty-state {
          background: rgba(255,255,255,0.95);
          border-radius: 16px;
          padding: 64px 32px;
          text-align: center;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          font-size: 24px;
          margin-bottom: 8px;
          color: #1e293b;
        }

        .empty-state p {
          color: #64748b;
          margin-bottom: 24px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
        }

        .card {
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
        }

        .card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.15);
        }

        .card-header {
          padding: 20px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .card-header h3 {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
        }

        .card-body {
          padding: 20px;
        }

        .info-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          font-size: 14px;
          color: #475569;
        }

        .info-row:last-child {
          margin-bottom: 0;
        }

        .icon {
          font-size: 18px;
          width: 24px;
          text-align: center;
        }

        .sub-info {
          color: #94a3b8;
          font-size: 13px;
          margin-left: 4px;
        }

        .card-footer {
          padding: 16px 20px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .user-card .user-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .user-card .card-header {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .user-info {
          flex: 1;
        }

        .user-info h3 {
          margin-bottom: 8px;
        }

        .modul-description {
          font-size: 14px;
          color: #64748b;
          margin-bottom: 16px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .badge-blue {
          background: #dbeafe;
          color: #1e40af;
        }

        .badge-green {
          background: #d1fae5;
          color: #065f46;
        }

        .badge-red {
          background: #fee2e2;
          color: #991b1b;
        }

        .badge-orange {
          background: #fed7aa;
          color: #92400e;
        }

        .badge-gray {
          background: #f1f5f9;
          color: #475569;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
          background: #f1f5f9;
          color: #475569;
        }

        .btn-secondary:hover {
          background: #e2e8f0;
        }

        .btn-danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .btn-danger:hover {
          background: #fecaca;
        }

        .btn-success {
          background: #d1fae5;
          color: #065f46;
        }

        .btn-success:hover {
          background: #a7f3d0;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal {
          background: white;
          border-radius: 20px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-large {
          max-width: 900px;
        }

        .modal-header {
          padding: 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h2 {
          font-size: 24px;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
        }

        .modal-close {
          width: 32px;
          height: 32px;
          border: none;
          background: #f1f5f9;
          border-radius: 8px;
          font-size: 20px;
          cursor: pointer;
          color: #64748b;
        }

        .modal-close:hover {
          background: #e2e8f0;
        }

        .modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }

        .modal-footer {
          padding: 20px 24px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .field {
          margin-bottom: 20px;
        }

        .field label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #475569;
        }

        .field input,
        .field select,
        .field textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 15px;
          font-family: inherit;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .field-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .field-hint {
          margin-top: 8px;
          font-size: 13px;
          color: #64748b;
        }

        .info-section {
          background: #f8fafc;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .description-section {
          margin-bottom: 24px;
        }

        .description-section h3 {
          margin-bottom: 12px;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }

        .actions-section {
          display: flex;
          gap: 12px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-header h3 {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
        }

        .section-divider {
          height: 1px;
          background: #e2e8f0;
          margin: 24px 0;
        }

        .user-select-list,
        .module-select-list {
          max-height: 300px;
          overflow-y: auto;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
        }

        .user-select-header {
          padding: 12px 16px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .user-select-item,
        .module-select-item {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .user-select-item:last-child,
        .module-select-item:last-child {
          border-bottom: none;
        }

        .user-select-item label {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          margin: 0;
        }

        .user-select-item input[type="checkbox"] {
          width: auto;
          cursor: pointer;
        }

        .empty-text {
          text-align: center;
          color: #94a3b8;
          padding: 32px;
        }

        .teilnehmer-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .teilnehmer-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f8fafc;
          border-radius: 12px;
        }

        .teilnehmer-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .teilnehmer-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .teilnehmer-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .status-select {
          padding: 6px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 13px;
        }

        .dokumente-list,
        .module-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .dokument-item,
        .modul-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f8fafc;
          border-radius: 12px;
        }

        .dokument-info,
        .modul-info {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          flex: 1;
        }

        .dokument-meta,
        .modul-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .dokument-description {
          margin-top: 8px;
          font-size: 13px;
          color: #64748b;
        }

        .dokument-actions,
        .modul-actions {
          display: flex;
          gap: 8px;
        }

        .text-muted {
          color: #94a3b8;
        }

        .text-success {
          color: #059669;
        }

        .stats-section {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin: 24px 0;
        }

        .notes-section {
          background: #f8fafc;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .notes-section h3 {
          margin-bottom: 12px;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }

        .termine-list,
        .module-progress-list,
        .archiv-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .termin-item,
        .modul-progress-item,
        .archiv-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f8fafc;
          border-radius: 12px;
        }

        .termin-info {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .termin-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 4px;
          font-size: 13px;
          color: #64748b;
        }

        .progress-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .progress-bar {
          width: 200px;
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          transition: width 0.3s;
        }

        .year-selector {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-bottom: 24px;
        }

        .year-display {
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          min-width: 80px;
          text-align: center;
        }

        .inhalte-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 12px;
        }

        .inhalt-item {
          padding: 16px;
          background: #f8fafc;
          border-radius: 12px;
        }

        .inhalt-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .inhalt-item select {
          width: auto;
          padding: 6px 12px;
        }

        .inhalt-item input,
        .inhalt-item textarea {
          margin-bottom: 8px;
        }

        .inhalt-item input:last-child,
        .inhalt-item textarea:last-child {
          margin-bottom: 0;
        }

        .add-inhalt-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .einladungslink-info {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .link-status {
          display: flex;
          justify-content: center;
        }

        .link-url {
          display: flex;
          gap: 12px;
        }

        .link-input {
          flex: 1;
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 14px;
          background: #f8fafc;
        }

        .link-actions {
          display: flex;
          justify-content: center;
        }

        .link-info-text {
          font-size: 14px;
          color: #64748b;
          text-align: center;
        }

        .link-info-text p {
          margin: 4px 0;
        }

        .no-link {
          text-align: center;
          padding: 32px;
        }

        .no-link p {
          color: #64748b;
          margin-bottom: 20px;
        }

        @media (max-width: 768px) {
          .grid {
            grid-template-columns: 1fr;
          }

          .field-row {
            grid-template-columns: 1fr;
          }

          .stats-section {
            grid-template-columns: 1fr;
          }

          .modal-large {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
