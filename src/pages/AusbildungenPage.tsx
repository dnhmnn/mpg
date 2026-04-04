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

interface Teilnehmer {
  id: string
  vorname: string
  nachname: string
  email: string
  telefon: string
  whatsapp: string
  notizen: string
  lernbar_zugang_aktiv: boolean
  lernbar_email: string
  lernbar_passwort: string
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

export default function Ausbildungen() {
  const { user, loading: authLoading, logout } = useAuth()
  
  const [termine, setTermine] = useState<Termin[]>([])
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([])
  const [terminTeilnehmer, setTerminTeilnehmer] = useState<TerminTeilnehmer[]>([])
  const [dokumente, setDokumente] = useState<Dokument[]>([])
  const [module, setModule] = useState<Modul[]>([])
  const [modulTermine, setModulTermine] = useState<ModulTermin[]>([])
  const [modulProgress, setModulProgress] = useState<ModulProgress[]>([])
  
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null)
  
  const [showAddTerminModal, setShowAddTerminModal] = useState(false)
  const [showTerminDetailModal, setShowTerminDetailModal] = useState(false)
  const [showAddTeilnehmerModal, setShowAddTeilnehmerModal] = useState(false)
  const [showTeilnehmerDetailModal, setShowTeilnehmerDetailModal] = useState(false)
  const [showAddModulModal, setShowAddModulModal] = useState(false)
  const [showUploadDokumentModal, setShowUploadDokumentModal] = useState(false)
  const [showAssignModulModal, setShowAssignModulModal] = useState(false)
  
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
    notizen: '',
    lernbar_zugang_aktiv: false
  })
  
  const [modulForm, setModulForm] = useState<ModulForm>({
    name: '',
    beschreibung: '',
    inhalte: [],
    dauer_minuten: 60
  })
  
  const [selectedTermin, setSelectedTermin] = useState<Termin | null>(null)
  const [selectedTeilnehmer, setSelectedTeilnehmer] = useState<Teilnehmer | null>(null)
  const [currentTerminTab, setCurrentTerminTab] = useState<'uebersicht' | 'teilnehmer' | 'dokumente' | 'module'>('uebersicht')
  
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'geplant' | 'laufend' | 'abgeschlossen'>('all')
  const [viewMode, setViewMode] = useState<'termine' | 'teilnehmer' | 'module'>('termine')
  
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
        loadTeilnehmer(),
        loadTerminTeilnehmer(),
        loadDokumente(),
        loadModule(),
        loadModulTermine(),
        loadModulProgress()
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
    // NUR Users laden die zu Terminen zugeordnet sind
    const terminUsers = await pb.collection('ausbildungen_termine_user').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      expand: 'teilnehmer_id'
    })
    
    // Unique User IDs extrahieren
    const uniqueUserIds = [...new Set(terminUsers.map(tu => tu.teilnehmer_id))]
    
    if (uniqueUserIds.length === 0) {
      setTeilnehmer([])
      return
    }
    
    // Users laden
    const users = await pb.collection('users').getFullList({
      filter: uniqueUserIds.map(id => `id = "${id}"`).join(' || ')
    })
    
    // In Teilnehmer Format umwandeln
    const teilnehmerData = users.map(u => ({
      id: u.id,
      vorname: u.name.split(' ')[0] || '',
      nachname: u.name.split(' ').slice(1).join(' ') || '',
      email: u.email,
      telefon: u.phone || '',
      whatsapp: u.whatsapp || '',
      notizen: u.notizen || '',
      lernbar_zugang_aktiv: u.permissions?.lernbar || false,
      lernbar_email: u.email,
      lernbar_passwort: '',
      organization_id: u.organization_id,
      created: u.created
    }))
    
    setTeilnehmer(teilnehmerData)
  }

  async function loadTerminTeilnehmer() {
    const records = await pb.collection('ausbildungen_termine_user').getFullList({
      filter: `organization_id = "${user?.organization_id}"`,
      expand: 'teilnehmer_id'
    })
    setTerminTeilnehmer(records)
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

  async function loadModulProgress() {
    const records = await pb.collection('ausbildungen_module_progress').getFullList({
      filter: `organization_id = "${user?.organization_id}"`
    })
    setModulProgress(records)
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
  // TEILNEHMER FUNCTIONS

  function openAddTeilnehmer() {
    setTeilnehmerForm({
      vorname: '',
      nachname: '',
      email: '',
      telefon: '',
      whatsapp: '',
      notizen: '',
      lernbar_zugang_aktiv: false
    })
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
      notizen: teilnehmer.notizen,
      lernbar_zugang_aktiv: teilnehmer.lernbar_zugang_aktiv
    })
    setShowAddTeilnehmerModal(true)
  }

  async function saveTeilnehmer() {
    if (!teilnehmerForm.vorname || !teilnehmerForm.nachname) {
      alert('Bitte Vorname und Nachname eingeben')
      return
    }

    // Email nur Pflicht wenn Lernbar-Zugang aktiv
    if (teilnehmerForm.lernbar_zugang_aktiv && !teilnehmerForm.email) {
      alert('E-Mail erforderlich für Lernbar-Zugang')
      return
    }

    try {
      if (teilnehmerForm.id) {
        // UPDATE: User aktualisieren
        const userData: any = {
          name: `${teilnehmerForm.vorname} ${teilnehmerForm.nachname}`,
          phone: teilnehmerForm.telefon,
          whatsapp: teilnehmerForm.whatsapp,
          notizen: teilnehmerForm.notizen
        }

        if (teilnehmerForm.email) {
          userData.email = teilnehmerForm.email
        }

        // Permissions aktualisieren
        const currentUser = await pb.collection('users').getOne(teilnehmerForm.id)
        userData.permissions = {
          ...(currentUser.permissions || {}),
          lernbar: teilnehmerForm.lernbar_zugang_aktiv
        }

        await pb.collection('users').update(teilnehmerForm.id, userData)
        showMessage('Teilnehmer aktualisiert', 'success')
      } else {
        // CREATE: Neuen User erstellen
        const userData: any = {
          name: `${teilnehmerForm.vorname} ${teilnehmerForm.nachname}`,
          phone: teilnehmerForm.telefon || '',
          whatsapp: teilnehmerForm.whatsapp || '',
          notizen: teilnehmerForm.notizen || '',
          organization_id: user?.organization_id,
          role: 'teilnehmer',
          permissions: {
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
        }

        if (teilnehmerForm.email) {
          userData.email = teilnehmerForm.email
          userData.emailVisibility = true
          userData.verified = false
        }

        const newUser = await pb.collection('users').create(userData)

        // Wenn Email + Lernbar aktiv: Password Reset senden
        if (teilnehmerForm.email && teilnehmerForm.lernbar_zugang_aktiv) {
          try {
            await pb.collection('users').requestPasswordReset(teilnehmerForm.email)
            showMessage('Teilnehmer erstellt - Password-Reset Email gesendet!', 'success')
          } catch (resetError: any) {
            console.error('Password-Reset Fehler:', resetError)
            showMessage('Teilnehmer erstellt (Password-Reset fehlgeschlagen)', 'success')
          }
        } else {
          showMessage('Teilnehmer erstellt', 'success')
        }
      }

      setShowAddTeilnehmerModal(false)
      await loadTeilnehmer()
    } catch(e: any) {
      alert('Fehler beim Speichern: ' + e.message)
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

  function openTeilnehmerDetail(teilnehmer: Teilnehmer) {
    setSelectedTeilnehmer(teilnehmer)
    setShowTeilnehmerDetailModal(true)
  }

  function generatePassword(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  async function toggleLernbarZugang(teilnehmer: Teilnehmer) {
    try {
      const neuerStatus = !teilnehmer.lernbar_zugang_aktiv
      
      // User aktualisieren
      const currentUser = await pb.collection('users').getOne(teilnehmer.id)
      const updatedPermissions = {
        ...(currentUser.permissions || {}),
        lernbar: neuerStatus
      }

      await pb.collection('users').update(teilnehmer.id, {
        permissions: updatedPermissions
      })

      // Wenn aktiviert und Email vorhanden: Password Reset senden
      if (neuerStatus && teilnehmer.email) {
        try {
          await pb.collection('users').requestPasswordReset(teilnehmer.email)
          showMessage('Lernbar-Zugang aktiviert - Password-Reset Email gesendet!', 'success')
        } catch (resetError) {
          showMessage('Lernbar-Zugang aktiviert', 'success')
        }
      } else {
        showMessage(neuerStatus ? 'Lernbar-Zugang aktiviert' : 'Lernbar-Zugang deaktiviert', 'success')
      }

      await loadTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }
  // TERMIN-TEILNEHMER FUNCTIONS

  async function addTeilnehmerToTermin(terminId: string, teilnehmerId: string, via: 'email' | 'whatsapp' | 'persönlich' | 'telefon') {
    try {
      await pb.collection('ausbildungen_termine_user').create({
        termin_id: terminId,
        teilnehmer_id: teilnehmerId,
        status: 'eingeladen',
        eingeladen_am: new Date().toISOString(),
        eingeladen_via: via,
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

  async function updateTeilnehmerStatus(ttId: string, newStatus: 'eingeladen' | 'zugesagt' | 'abgesagt' | 'entschuldigt') {
    try {
      await pb.collection('ausbildungen_termine_user').update(ttId, {
        status: newStatus
      })
      showMessage('Status aktualisiert', 'success')
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function toggleAnwesenheit(ttId: string, currentStatus: boolean) {
    try {
      await pb.collection('ausbildungen_termine_user').update(ttId, {
        anwesend: !currentStatus
      })
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function removeTeilnehmerFromTermin(ttId: string) {
    if (!confirm('Teilnehmer vom Termin entfernen?')) return
    
    try {
      await pb.collection('ausbildungen_termine_user').delete(ttId)
      showMessage('Teilnehmer entfernt', 'success')
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  function sendEinladungEmail(termin: Termin, teilnehmer: Teilnehmer) {
    const subject = encodeURIComponent(`Einladung: ${termin.name}`)
    const body = encodeURIComponent(`Hallo ${teilnehmer.vorname},\n\ndu bist eingeladen zu:\n\n${termin.name}\nDatum: ${new Date(termin.start_datetime).toLocaleString('de-DE')}\nOrt: ${termin.location}\n\nBitte bestätige deine Teilnahme.\n\nViele Grüße`)
    window.open(`mailto:${teilnehmer.email}?subject=${subject}&body=${body}`)
  }

  function sendEinladungWhatsApp(termin: Termin, teilnehmer: Teilnehmer) {
    const text = encodeURIComponent(`Hallo ${teilnehmer.vorname}, du bist eingeladen zu: ${termin.name} am ${new Date(termin.start_datetime).toLocaleString('de-DE')} in ${termin.location}`)
    const phone = teilnehmer.whatsapp || teilnehmer.telefon
    if (!phone) {
      alert('Keine WhatsApp/Telefonnummer vorhanden')
      return
    }
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${text}`)
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
  // HELPER FUNCTIONS

  function getTerminTeilnehmerByTermin(terminId: string): TerminTeilnehmer[] {
    return terminTeilnehmer.filter(tt => tt.termin_id === terminId)
  }

  function getDokumenteByTermin(terminId: string): Dokument[] {
    return dokumente.filter(d => d.termin_id === terminId)
  }

  function getModuleByTermin(terminId: string): ModulTermin[] {
    return modulTermine.filter(mt => mt.termin_id === terminId)
  }

  function getTeilnehmerTermine(teilnehmerId: string): TerminTeilnehmer[] {
    return terminTeilnehmer.filter(tt => tt.teilnehmer_id === teilnehmerId)
  }

  function getTeilnehmerModulProgress(teilnehmerId: string): ModulProgress[] {
    return modulProgress.filter(mp => mp.teilnehmer_id === teilnehmerId)
  }

  const stats = {
    termine_gesamt: termine.length,
    termine_geplant: termine.filter(t => t.status === 'geplant').length,
    termine_laufend: termine.filter(t => t.status === 'laufend').length,
    teilnehmer_gesamt: teilnehmer.length,
    teilnehmer_lernbar: teilnehmer.filter(t => t.lernbar_zugang_aktiv).length,
    module_gesamt: module.length
  }

  const filteredTermine = termine.filter(termin => {
    const matchesSearch = 
      termin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      termin.dozent?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      termin.location?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = 
      statusFilter === 'all' || termin.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const filteredTeilnehmer = teilnehmer.filter(t => {
    const fullName = `${t.vorname} ${t.nachname}`.toLowerCase()
    return fullName.includes(searchQuery.toLowerCase()) ||
           t.email.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const filteredModule = module.filter(m => {
    return m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           m.beschreibung.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <>
      <StatusBar user={user} onLogout={logout} pageName="Ausbildungen" showHubLink={true} />


      {/* ICON TOOLBAR */}
      <div className="action-toolbar">
        <button className="action-btn" onClick={openAddTermin} title="Termin hinzufügen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <line x1="12" y1="14" x2="12" y2="18"/>
            <line x1="10" y1="16" x2="14" y2="16"/>
          </svg>
        </button>
        <button className="action-btn" onClick={openAddTeilnehmer} title="Teilnehmer hinzufügen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
        </button>
        <button className="action-btn" onClick={openAddModul} title="Modul erstellen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            <line x1="12" y1="10" x2="12" y2="14"/>
            <line x1="10" y1="12" x2="14" y2="12"/>
          </svg>
        </button>
      </div>

      <div className="content">
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* VIEW MODE TABS */}
        <div className="view-tabs">
          <button 
            className={`tab-btn ${viewMode === 'termine' ? 'active' : ''}`}
            onClick={() => setViewMode('termine')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Termine ({stats.termine_gesamt})
          </button>
          <button 
            className={`tab-btn ${viewMode === 'teilnehmer' ? 'active' : ''}`}
            onClick={() => setViewMode('teilnehmer')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
            </svg>
            Teilnehmer ({stats.teilnehmer_gesamt})
          </button>
          <button 
            className={`tab-btn ${viewMode === 'module' ? 'active' : ''}`}
            onClick={() => setViewMode('module')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
            Module ({stats.module_gesamt})
          </button>
        </div>

        {/* STATISTICS */}
        <div className="stats-grid" key={termine.length}>
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="stat-number">{stats.termine_geplant}</div>
            <div className="stat-label">Geplante Termine</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div className="stat-number">{stats.termine_laufend}</div>
            <div className="stat-label">Laufende Termine</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
              </svg>
            </div>
            <div className="stat-number">{stats.teilnehmer_gesamt}</div>
            <div className="stat-label">Teilnehmer</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div className="stat-number">{stats.teilnehmer_lernbar}</div>
            <div className="stat-label">Lernbar-Zugänge</div>
          </div>
        </div>

        {/* SEARCH AND FILTERS */}
        <div className="filter-bar">
          <input
            type="text"
            className="search-input"
            placeholder={
              viewMode === 'termine' ? 'Termine durchsuchen...' :
              viewMode === 'teilnehmer' ? 'Teilnehmer durchsuchen...' :
              'Module durchsuchen...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {viewMode === 'termine' && (
            <div className="filter-buttons">
              <button 
                className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                Alle
              </button>
              <button 
                className={`filter-btn ${statusFilter === 'geplant' ? 'active' : ''}`}
                onClick={() => setStatusFilter('geplant')}
              >
                Geplant
              </button>
              <button 
                className={`filter-btn ${statusFilter === 'laufend' ? 'active' : ''}`}
                onClick={() => setStatusFilter('laufend')}
              >
                Laufend
              </button>
              <button 
                className={`filter-btn ${statusFilter === 'abgeschlossen' ? 'active' : ''}`}
                onClick={() => setStatusFilter('abgeschlossen')}
              >
                Abgeschlossen
              </button>
            </div>
          )}
        </div>
        {/* TERMINE VIEW */}
        {viewMode === 'termine' && (
          <>
            {loading ? (
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
              <div className="termine-grid">
                {filteredTermine.map(termin => {
                  const teilnehmerCount = getTerminTeilnehmerByTermin(termin.id).length
                  const zugesagtCount = getTerminTeilnehmerByTermin(termin.id).filter(tt => tt.status === 'zugesagt').length
                  
                  return (
                    <div 
                      key={termin.id} 
                      className={`termin-card status-${termin.status}`}
                      onClick={() => openTerminDetail(termin)}
                    >
                      <div className="termin-status-badge">{termin.status}</div>
                      
                      <div className="termin-date">
                        {new Date(termin.start_datetime).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                      
                      <div className="termin-time">
                        {new Date(termin.start_datetime).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })} - {new Date(termin.end_datetime).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      
                      <div className="termin-name">{termin.name}</div>
                      
                      {termin.dozent && (
                        <div className="termin-meta">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                          {termin.dozent}
                        </div>
                      )}
                      
                      {termin.location && (
                        <div className="termin-meta">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                          {termin.location}
                        </div>
                      )}
                      
                      <div className="termin-participants">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        {zugesagtCount}/{teilnehmerCount} zugesagt
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* TEILNEHMER VIEW */}
        {viewMode === 'teilnehmer' && (
          <>
            {loading ? (
              <div className="empty-state">Lade Teilnehmer...</div>
            ) : filteredTeilnehmer.length === 0 ? (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity: 0.3, marginBottom: '16px'}}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                </svg>
                <div style={{fontWeight: 700, marginBottom: '8px'}}>Keine Teilnehmer</div>
                <div>Füge den ersten Teilnehmer hinzu</div>
              </div>
            ) : (
              <div className="teilnehmer-list">
                {filteredTeilnehmer.map(teilnehmer => {
                  const teilnehmerTermine = getTeilnehmerTermine(teilnehmer.id)
                  
                  return (
                    <div 
                      key={teilnehmer.id} 
                      className="teilnehmer-row"
                      onClick={() => openTeilnehmerDetail(teilnehmer)}
                    >
                      <div className="teilnehmer-avatar">
                        {teilnehmer.vorname.charAt(0)}{teilnehmer.nachname.charAt(0)}
                      </div>
                      
                      <div className="teilnehmer-info">
                        <div className="teilnehmer-name">
                          {teilnehmer.vorname} {teilnehmer.nachname}
                        </div>
                        <div className="teilnehmer-email">{teilnehmer.email}</div>
                      </div>
                      
                      <div className="teilnehmer-badges">
                        {teilnehmer.lernbar_zugang_aktiv && (
                          <div className="badge lernbar">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            Lernbar
                          </div>
                        )}
                        {teilnehmerTermine.length > 0 && (
                          <div className="badge termine">
                            {teilnehmerTermine.length} Termine
                          </div>
                        )}
                      </div>
                      
                      <div className="teilnehmer-actions" onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="btn-icon"
                          onClick={() => openEditTeilnehmer(teilnehmer)}
                          title="Bearbeiten"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* MODULE VIEW */}
        {viewMode === 'module' && (
          <>
            {loading ? (
              <div className="empty-state">Lade Module...</div>
            ) : filteredModule.length === 0 ? (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity: 0.3, marginBottom: '16px'}}>
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                <div style={{fontWeight: 700, marginBottom: '8px'}}>Keine Module</div>
                <div>Erstelle dein erstes Online-Modul</div>
              </div>
            ) : (
              <div className="module-grid">
                {filteredModule.map(modul => (
                  <div key={modul.id} className="modul-card">
                    <div className="modul-header">
                      <div className="modul-name">{modul.name}</div>
                      <div className="modul-duration">{modul.dauer_minuten} Min.</div>
                    </div>
                    
                    {modul.beschreibung && (
                      <div className="modul-description" dangerouslySetInnerHTML={{ __html: modul.beschreibung.substring(0, 150) + '...' }} />
                    )}
                    
                    <div className="modul-stats">
                      <div className="modul-stat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 11 12 14 22 4"/>
                          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                        {modul.inhalte.length} Lektionen
                      </div>
                    </div>
                    
                    <div className="modul-actions">
                      <button className="btn" onClick={() => openEditModul(modul)}>
                        Bearbeiten
                      </button>
                      <button className="btn danger" onClick={() => deleteModul(modul.id, modul.name)}>
                        Löschen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {/* ADD/EDIT TERMIN MODAL */}
      {showAddTerminModal && (
        <div className="modal show" onClick={() => setShowAddTerminModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>{terminForm.id ? 'Termin bearbeiten' : 'Termin erstellen'}</h3>
            
            <div className="field">
              <label>Titel *</label>
              <input
                type="text"
                value={terminForm.name}
                onChange={(e) => setTerminForm({ ...terminForm, name: e.target.value })}
                placeholder="z.B. Erste-Hilfe Grundkurs"
                autoFocus
              />
            </div>
            
            <div className="field">
              <label>Beschreibung</label>
              <textarea
                value={terminForm.description}
                onChange={(e) => setTerminForm({ ...terminForm, description: e.target.value })}
                rows={4}
                placeholder="Details zum Termin..."
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
                placeholder="z.B. Max Mustermann"
              />
            </div>
            
            <div className="field-row">
              <div className="field">
                <label>Max. Teilnehmer</label>
                <input
                  type="number"
                  value={terminForm.max_teilnehmer}
                  onChange={(e) => setTerminForm({ ...terminForm, max_teilnehmer: parseInt(e.target.value) || 0 })}
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
      {/* TERMIN DETAIL MODAL */}
      {showTerminDetailModal && selectedTermin && (
        <div className="modal show" onClick={() => setShowTerminDetailModal(false)}>
          <div className="modal-content xlarge" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{selectedTermin.name}</h3>
                <div className="termin-detail-meta">
                  {new Date(selectedTermin.start_datetime).toLocaleString('de-DE')} - {new Date(selectedTermin.end_datetime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  {selectedTermin.location && ` • ${selectedTermin.location}`}
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
            
            {/* TABS */}
            <div className="detail-tabs">
              <button 
                className={`detail-tab ${currentTerminTab === 'uebersicht' ? 'active' : ''}`}
                onClick={() => setCurrentTerminTab('uebersicht')}
              >
                Übersicht
              </button>
              <button 
                className={`detail-tab ${currentTerminTab === 'teilnehmer' ? 'active' : ''}`}
                onClick={() => setCurrentTerminTab('teilnehmer')}
              >
                Teilnehmer ({getTerminTeilnehmerByTermin(selectedTermin.id).length})
              </button>
              <button 
                className={`detail-tab ${currentTerminTab === 'dokumente' ? 'active' : ''}`}
                onClick={() => setCurrentTerminTab('dokumente')}
              >
                Dokumente ({getDokumenteByTermin(selectedTermin.id).length})
              </button>
              <button 
                className={`detail-tab ${currentTerminTab === 'module' ? 'active' : ''}`}
                onClick={() => setCurrentTerminTab('module')}
              >
                Module ({getModuleByTermin(selectedTermin.id).length})
              </button>
            </div>
            
            <div className="detail-content">
              {/* ÜBERSICHT TAB */}
              {currentTerminTab === 'uebersicht' && (
                <div className="uebersicht-content">
                  {selectedTermin.description && (
                    <div className="info-section">
                      <h4>Beschreibung</h4>
                      <div className="description-text" dangerouslySetInnerHTML={{ __html: selectedTermin.description }} />
                    </div>
                  )}
                  
                  <div className="info-section">
                    <h4>Details</h4>
                    <div className="info-grid">
                      <div className="info-item">
                        <div className="info-label">Dozent</div>
                        <div className="info-value">{selectedTermin.dozent || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">Max. Teilnehmer</div>
                        <div className="info-value">{selectedTermin.max_teilnehmer}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">Status</div>
                        <div className="info-value">
                          <span className={`status-pill ${selectedTermin.status}`}>
                            {selectedTermin.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="info-section">
                    <h4>Teilnehmer-Status</h4>
                    <div className="status-overview">
                      {(() => {
                        const tt = getTerminTeilnehmerByTermin(selectedTermin.id)
                        return (
                          <>
                            <div className="status-count">
                              <div className="count-number">{tt.filter(t => t.status === 'eingeladen').length}</div>
                              <div className="count-label">Eingeladen</div>
                            </div>
                            <div className="status-count success">
                              <div className="count-number">{tt.filter(t => t.status === 'zugesagt').length}</div>
                              <div className="count-label">Zugesagt</div>
                            </div>
                            <div className="status-count danger">
                              <div className="count-number">{tt.filter(t => t.status === 'abgesagt').length}</div>
                              <div className="count-label">Abgesagt</div>
                            </div>
                            <div className="status-count warning">
                              <div className="count-number">{tt.filter(t => t.status === 'entschuldigt').length}</div>
                              <div className="count-label">Entschuldigt</div>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )}
              
              {/* TEILNEHMER TAB */}
              {currentTerminTab === 'teilnehmer' && (
                <div className="teilnehmer-content">
                  <div className="content-header">
                    <h4>Teilnehmerverwaltung</h4>
                    <div className="header-actions">
                      <select 
                        className="select-compact"
                        onChange={(e) => {
                          if (e.target.value) {
                            addTeilnehmerToTermin(selectedTermin.id, e.target.value, 'persönlich')
                            e.target.value = ''
                          }
                        }}
                      >
                        <option value="">+ Teilnehmer hinzufügen</option>
                        {teilnehmer
                          .filter(t => !getTerminTeilnehmerByTermin(selectedTermin.id).find(tt => tt.teilnehmer_id === t.id))
                          .map(t => (
                            <option key={t.id} value={t.id}>
                              {t.vorname} {t.nachname}
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                  
                  {getTerminTeilnehmerByTermin(selectedTermin.id).length === 0 ? (
                    <div className="empty-state-small">Noch keine Teilnehmer</div>
                  ) : (
                    <div className="teilnehmer-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Status</th>
                            <th>Eingeladen</th>
                            <th>Anwesend</th>
                            <th>Aktionen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getTerminTeilnehmerByTermin(selectedTermin.id).map(tt => {
                            const t = teilnehmer.find(teiln => teiln.id === tt.teilnehmer_id)
                            if (!t) return null
                            
                            return (
                              <tr key={tt.id}>
                                <td>
                                  <div className="table-person">
                                    <div className="person-avatar-small">
                                      {t.vorname.charAt(0)}{t.nachname.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="person-name">{t.vorname} {t.nachname}</div>
                                      <div className="person-email">{t.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <select
                                    className="status-select"
                                    value={tt.status}
                                    onChange={(e) => updateTeilnehmerStatus(tt.id, e.target.value as any)}
                                  >
                                    <option value="eingeladen">Eingeladen</option>
                                    <option value="zugesagt">Zugesagt</option>
                                    <option value="abgesagt">Abgesagt</option>
                                    <option value="entschuldigt">Entschuldigt</option>
                                  </select>
                                </td>
                                <td>
                                  <div className="einladung-info">
                                    {new Date(tt.eingeladen_am).toLocaleDateString('de-DE')}
                                    <span className="einladung-via">{tt.eingeladen_via}</span>
                                  </div>
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={tt.anwesend}
                                    onChange={() => toggleAnwesenheit(tt.id, tt.anwesend)}
                                    className="anwesenheit-checkbox"
                                  />
                                </td>
                                <td>
                                  <div className="table-actions">
                                    <button
                                      className="btn-icon-small"
                                      onClick={() => sendEinladungEmail(selectedTermin, t)}
                                      title="Email senden"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                        <polyline points="22,6 12,13 2,6"/>
                                      </svg>
                                    </button>
                                    <button
                                      className="btn-icon-small"
                                      onClick={() => sendEinladungWhatsApp(selectedTermin, t)}
                                      title="WhatsApp senden"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                                      </svg>
                                    </button>
                                    <button
                                      className="btn-icon-small danger"
                                      onClick={() => removeTeilnehmerFromTermin(tt.id)}
                                      title="Entfernen"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"/>
                                        <line x1="6" y1="6" x2="18" y2="18"/>
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* DOKUMENTE TAB */}
              {currentTerminTab === 'dokumente' && (
                <div className="dokumente-content">
                  <div className="content-header">
                    <h4>Dokumente & Material</h4>
                    <button 
                      className="btn primary"
                      onClick={() => openUploadDokument(selectedTermin)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      Hochladen
                    </button>
                  </div>
                  
                  {getDokumenteByTermin(selectedTermin.id).length === 0 ? (
                    <div className="empty-state-small">Noch keine Dokumente hochgeladen</div>
                  ) : (
                    <div className="dokumente-sections">
                      <div className="dokument-section">
                        <h5>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                          Dozenten-Material
                        </h5>
                        <div className="dokumente-list">
                          {getDokumenteByTermin(selectedTermin.id)
                            .filter(d => d.typ === 'dozent')
                            .map(dok => (
                              <div key={dok.id} className="dokument-item">
                                <div className="dokument-icon">
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                                    <polyline points="13 2 13 9 20 9"/>
                                  </svg>
                                </div>
                                <div className="dokument-info">
                                  <div className="dokument-name">{dok.name}</div>
                                  {dok.beschreibung && (
                                    <div className="dokument-desc">{dok.beschreibung}</div>
                                  )}
                                </div>
                                <div className="dokument-actions">
                                  {dok.datei && (
                                    <a 
                                      href={getDokumentURL(dok)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn-icon-small"
                                      title="Öffnen"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                        <polyline points="15 3 21 3 21 9"/>
                                        <line x1="10" y1="14" x2="21" y2="3"/>
                                      </svg>
                                    </a>
                                  )}
                                  <button
                                    className="btn-icon-small danger"
                                    onClick={() => deleteDokument(dok.id, dok.name)}
                                    title="Löschen"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3 6 5 6 21 6"/>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          {getDokumenteByTermin(selectedTermin.id).filter(d => d.typ === 'dozent').length === 0 && (
                            <div className="empty-hint">Keine Dozenten-Materialien</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="dokument-section">
                        <h5>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                          </svg>
                          Teilnehmer-Material (in Lernbar sichtbar)
                        </h5>
                        <div className="dokumente-list">
                          {getDokumenteByTermin(selectedTermin.id)
                            .filter(d => d.typ === 'teilnehmer')
                            .map(dok => (
                              <div key={dok.id} className="dokument-item">
                                <div className="dokument-icon">
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                                    <polyline points="13 2 13 9 20 9"/>
                                  </svg>
                                </div>
                                <div className="dokument-info">
                                  <div className="dokument-name">{dok.name}</div>
                                  {dok.beschreibung && (
                                    <div className="dokument-desc">{dok.beschreibung}</div>
                                  )}
                                </div>
                                <div className="dokument-actions">
                                  {dok.datei && (
                                    <a 
                                      href={getDokumentURL(dok)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn-icon-small"
                                      title="Öffnen"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                        <polyline points="15 3 21 3 21 9"/>
                                        <line x1="10" y1="14" x2="21" y2="3"/>
                                      </svg>
                                    </a>
                                  )}
                                  <button
                                    className="btn-icon-small danger"
                                    onClick={() => deleteDokument(dok.id, dok.name)}
                                    title="Löschen"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3 6 5 6 21 6"/>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          {getDokumenteByTermin(selectedTermin.id).filter(d => d.typ === 'teilnehmer').length === 0 && (
                            <div className="empty-hint">Keine Teilnehmer-Materialien</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* MODULE TAB */}
              {currentTerminTab === 'module' && (
                <div className="module-content">
                  <div className="content-header">
                    <h4>Zugeordnete Module</h4>
                    <select 
                      className="select-compact"
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedTermin(selectedTermin)
                          setShowAssignModulModal(true)
                        }
                      }}
                    >
                      <option value="">+ Modul zuordnen</option>
                      {module
                        .filter(m => !getModuleByTermin(selectedTermin.id).find(mt => mt.modul_id === m.id))
                        .map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                  
                  {getModuleByTermin(selectedTermin.id).length === 0 ? (
                    <div className="empty-state-small">Noch keine Module zugeordnet</div>
                  ) : (
                    <div className="assigned-module-list">
                      {getModuleByTermin(selectedTermin.id).map(mt => {
                        const modul = module.find(m => m.id === mt.modul_id)
                        if (!modul) return null
                        
                        return (
                          <div key={mt.id} className="assigned-modul-item">
                            <div className="modul-item-icon">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                              </svg>
                            </div>
                            <div className="modul-item-info">
                              <div className="modul-item-name">{modul.name}</div>
                              <div className="modul-item-meta">
                                {modul.dauer_minuten} Min. • {modul.inhalte.length} Lektionen
                                {mt.pflicht && <span className="pflicht-badge">Pflicht</span>}
                              </div>
                              {mt.frist_datum && (
                                <div className="modul-item-frist">
                                  Frist: {new Date(mt.frist_datum).toLocaleDateString('de-DE')}
                                </div>
                              )}
                            </div>
                            <button
                              className="btn-icon-small danger"
                              onClick={() => removeModulFromTermin(mt.id)}
                              title="Entfernen"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button className="btn danger" onClick={() => deleteTermin(selectedTermin.id, selectedTermin.name)}>
                Termin löschen
              </button>
              <button className="btn" onClick={() => setShowTerminDetailModal(false)}>
                Schließen
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
            
            <div className="field-row">
              <div className="field">
                <label>Vorname *</label>
                <input
                  type="text"
                  value={teilnehmerForm.vorname}
                  onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, vorname: e.target.value })}
                  placeholder="Max"
                  autoFocus
                />
              </div>
              
              <div className="field">
                <label>Nachname *</label>
                <input
                  type="text"
                  value={teilnehmerForm.nachname}
                  onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, nachname: e.target.value })}
                  placeholder="Mustermann"
                />
              </div>
            </div>
            
            <div className="field">
              <label>E-Mail {teilnehmerForm.lernbar_zugang_aktiv && '*'}</label>
              <input
                type="email"
                value={teilnehmerForm.email}
                onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, email: e.target.value })}
                placeholder="max@example.com"
              />
            </div>
            
            <div className="field-row">
              <div className="field">
                <label>Telefon</label>
                <input
                  type="tel"
                  value={teilnehmerForm.telefon}
                  onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, telefon: e.target.value })}
                  placeholder="+49 123 456789"
                />
              </div>
              
              <div className="field">
                <label>WhatsApp</label>
                <input
                  type="tel"
                  value={teilnehmerForm.whatsapp}
                  onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, whatsapp: e.target.value })}
                  placeholder="+49 123 456789"
                />
              </div>
            </div>
            
            <div className="field">
              <label>Notizen</label>
              <textarea
                value={teilnehmerForm.notizen}
                onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, notizen: e.target.value })}
                rows={3}
                placeholder="Zusätzliche Informationen..."
              />
            </div>
            
            <div className="field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={teilnehmerForm.lernbar_zugang_aktiv}
                  onChange={(e) => setTeilnehmerForm({ ...teilnehmerForm, lernbar_zugang_aktiv: e.target.checked })}
                />
                <span>Lernbar-Zugang aktivieren</span>
              </label>
              <div className="field-hint">
                Teilnehmer erhält Zugang zur Lernbar. Bei neuem Teilnehmer wird automatisch ein User-Account erstellt und Password-Reset Email versendet.
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAddTeilnehmerModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={saveTeilnehmer}>
                {teilnehmerForm.id ? 'Speichern' : 'Hinzufügen'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* TEILNEHMER DETAIL MODAL */}
      {showTeilnehmerDetailModal && selectedTeilnehmer && (
        <div className="modal show" onClick={() => setShowTeilnehmerDetailModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{selectedTeilnehmer.vorname} {selectedTeilnehmer.nachname}</h3>
                <div className="teilnehmer-detail-meta">
                  {selectedTeilnehmer.email}
                  {selectedTeilnehmer.telefon && ` • ${selectedTeilnehmer.telefon}`}
                </div>
              </div>
              <button 
                className="btn"
                onClick={(e) => {
                  e.stopPropagation()
                  openEditTeilnehmer(selectedTeilnehmer)
                }}
              >
                Bearbeiten
              </button>
            </div>
            
            <div className="detail-sections">
              {/* LERNBAR-ZUGANG */}
              <div className="info-section">
                <h4>Lernbar-Zugang</h4>
                <div className="lernbar-status">
                  <div className="lernbar-toggle">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={selectedTeilnehmer.lernbar_zugang_aktiv}
                        onChange={() => toggleLernbarZugang(selectedTeilnehmer)}
                      />
                      <span className="slider"></span>
                    </label>
                    <span className="toggle-label">
                      {selectedTeilnehmer.lernbar_zugang_aktiv ? 'Zugang aktiv' : 'Zugang inaktiv'}
                    </span>
                  </div>
                  
                  {selectedTeilnehmer.lernbar_zugang_aktiv && selectedTeilnehmer.lernbar_email && (
                    <div className="lernbar-credentials">
                      <div className="credential-row">
                        <div className="credential-label">E-Mail:</div>
                        <div className="credential-value">{selectedTeilnehmer.lernbar_email}</div>
                      </div>
                      <div className="credential-row">
                        <div className="credential-label">Info:</div>
                        <div className="credential-value">
                          User erhält Password-Reset Email zum Setzen des Passworts
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* TERMINE */}
              <div className="info-section">
                <h4>Termine ({getTeilnehmerTermine(selectedTeilnehmer.id).length})</h4>
                {getTeilnehmerTermine(selectedTeilnehmer.id).length === 0 ? (
                  <div className="empty-hint">Noch keinen Terminen zugeordnet</div>
                ) : (
                  <div className="termine-list-compact">
                    {getTeilnehmerTermine(selectedTeilnehmer.id).map(tt => {
                      const termin = termine.find(t => t.id === tt.termin_id)
                      if (!termin) return null
                      
                      return (
                        <div key={tt.id} className="termin-compact-item">
                          <div className="termin-compact-date">
                            {new Date(termin.start_datetime).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: 'short'
                            })}
                          </div>
                          <div className="termin-compact-info">
                            <div className="termin-compact-name">{termin.name}</div>
                            <div className="termin-compact-status">
                              <span className={`status-dot ${tt.status}`}></span>
                              {tt.status}
                              {tt.anwesend && (
                                <span className="anwesend-badge">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                  Anwesend
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              
              {/* MODUL-FORTSCHRITT */}
              <div className="info-section">
                <h4>Modul-Fortschritt</h4>
                {getTeilnehmerModulProgress(selectedTeilnehmer.id).length === 0 ? (
                  <div className="empty-hint">Noch keine Module bearbeitet</div>
                ) : (
                  <div className="progress-list">
                    {getTeilnehmerModulProgress(selectedTeilnehmer.id).map(mp => {
                      const modul = module.find(m => m.id === mp.modul_id)
                      if (!modul) return null
                      
                      return (
                        <div key={mp.id} className="progress-item">
                          <div className="progress-info">
                            <div className="progress-name">{modul.name}</div>
                            <div className="progress-meta">
                              {mp.gestartet_am && `Gestartet: ${new Date(mp.gestartet_am).toLocaleDateString('de-DE')}`}
                              {mp.abgeschlossen_am && ` • Abgeschlossen: ${new Date(mp.abgeschlossen_am).toLocaleDateString('de-DE')}`}
                            </div>
                          </div>
                          <div className="progress-bar-container">
                            <div className="progress-bar">
                              <div 
                                className="progress-fill"
                                style={{ width: `${mp.fortschritt_prozent}%` }}
                              />
                            </div>
                            <div className="progress-percent">{mp.fortschritt_prozent}%</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              
              {/* NOTIZEN */}
              {selectedTeilnehmer.notizen && (
                <div className="info-section">
                  <h4>Notizen</h4>
                  <div className="notizen-text">{selectedTeilnehmer.notizen}</div>
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button className="btn danger" onClick={() => deleteTeilnehmer(selectedTeilnehmer.id, `${selectedTeilnehmer.vorname} ${selectedTeilnehmer.nachname}`)}>
                Teilnehmer löschen
              </button>
              <button className="btn" onClick={() => setShowTeilnehmerDetailModal(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
      {/* UPLOAD DOKUMENT MODAL */}
      {showUploadDokumentModal && selectedTermin && (
        <div className="modal show" onClick={() => setShowUploadDokumentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Dokument hochladen</h3>
            <div className="upload-termin-info">
              Für Termin: <strong>{selectedTermin.name}</strong>
            </div>
            
            <div className="field">
              <label>Datei *</label>
              <input
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png"
              />
              {uploadFile && (
                <div className="file-preview">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                    <polyline points="13 2 13 9 20 9"/>
                  </svg>
                  {uploadFile.name}
                </div>
              )}
            </div>
            
            <div className="field">
              <label>Typ *</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="uploadTyp"
                    value="dozent"
                    checked={uploadTyp === 'dozent'}
                    onChange={(e) => setUploadTyp('dozent')}
                  />
                  <span>Dozenten-Material</span>
                  <div className="radio-hint">Nur für Dozenten sichtbar</div>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="uploadTyp"
                    value="teilnehmer"
                    checked={uploadTyp === 'teilnehmer'}
                    onChange={(e) => setUploadTyp('teilnehmer')}
                  />
                  <span>Teilnehmer-Material</span>
                  <div className="radio-hint">In Lernbar für Teilnehmer verfügbar</div>
                </label>
              </div>
            </div>
            
            <div className="field">
              <label>Beschreibung</label>
              <textarea
                value={uploadBeschreibung}
                onChange={(e) => setUploadBeschreibung(e.target.value)}
                rows={3}
                placeholder="Optionale Beschreibung zum Dokument..."
              />
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowUploadDokumentModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={uploadDokument} disabled={!uploadFile}>
                Hochladen
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ADD/EDIT MODUL MODAL */}
      {showAddModulModal && (
        <div className="modal show" onClick={() => setShowAddModulModal(false)}>
          <div className="modal-content xlarge" onClick={(e) => e.stopPropagation()}>
            <h3>{modulForm.id ? 'Modul bearbeiten' : 'Modul erstellen'}</h3>
            
            <div className="field">
              <label>Modulname *</label>
              <input
                type="text"
                value={modulForm.name}
                onChange={(e) => setModulForm({ ...modulForm, name: e.target.value })}
                placeholder="z.B. Herz-Lungen-Wiederbelebung"
                autoFocus
              />
            </div>
            
            <div className="field">
              <label>Beschreibung</label>
              <textarea
                value={modulForm.beschreibung}
                onChange={(e) => setModulForm({ ...modulForm, beschreibung: e.target.value })}
                rows={3}
                placeholder="Kurze Beschreibung des Moduls..."
              />
            </div>
            
            <div className="field">
              <label>Geschätzte Dauer (Minuten)</label>
              <input
                type="number"
                value={modulForm.dauer_minuten}
                onChange={(e) => setModulForm({ ...modulForm, dauer_minuten: parseInt(e.target.value) || 0 })}
                min="1"
              />
            </div>
            
            <div className="field">
              <div className="field-header">
                <label>Inhalte</label>
                <div className="add-inhalt-buttons">
                  <button className="btn-small" onClick={() => addModulInhalt('text')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                    Text
                  </button>
                  <button className="btn-small" onClick={() => addModulInhalt('video')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="23 7 16 12 23 17 23 7"/>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                    Video
                  </button>
                  <button className="btn-small" onClick={() => addModulInhalt('quiz')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    Quiz
                  </button>
                  <button className="btn-small" onClick={() => addModulInhalt('datei')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                      <polyline points="13 2 13 9 20 9"/>
                    </svg>
                    Datei
                  </button>
                </div>
              </div>
              
              {modulForm.inhalte.length === 0 ? (
                <div className="empty-hint">Füge Inhalte zum Modul hinzu</div>
              ) : (
                <div className="inhalte-list">
                  {modulForm.inhalte.map((inhalt, index) => (
                    <div key={index} className="inhalt-item">
                      <div className="inhalt-header">
                        <div className="inhalt-typ-badge">
                          {inhalt.typ === 'text' && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <line x1="16" y1="13" x2="8" y2="13"/>
                              <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                          )}
                          {inhalt.typ === 'video' && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="23 7 16 12 23 17 23 7"/>
                              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                            </svg>
                          )}
                          {inhalt.typ === 'quiz' && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/>
                              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                              <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                          )}
                          {inhalt.typ === 'datei' && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                              <polyline points="13 2 13 9 20 9"/>
                            </svg>
                          )}
                          {inhalt.typ}
                        </div>
                        <button 
                          className="btn-icon-small danger"
                          onClick={() => removeModulInhalt(index)}
                          title="Entfernen"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                      
                      <div className="inhalt-fields">
                        <input
                          type="text"
                          className="inhalt-titel"
                          value={inhalt.titel}
                          onChange={(e) => updateModulInhalt(index, 'titel', e.target.value)}
                          placeholder="Titel der Lektion"
                        />
                        
                        {inhalt.typ === 'text' && (
                          <textarea
                            className="inhalt-content"
                            value={inhalt.inhalt}
                            onChange={(e) => updateModulInhalt(index, 'inhalt', e.target.value)}
                            rows={4}
                            placeholder="Textinhalt..."
                          />
                        )}
                        
                        {inhalt.typ === 'video' && (
                          <input
                            type="url"
                            className="inhalt-content"
                            value={inhalt.inhalt}
                            onChange={(e) => updateModulInhalt(index, 'inhalt', e.target.value)}
                            placeholder="Video-URL (YouTube, Vimeo, etc.)"
                          />
                        )}
                        
                        {inhalt.typ === 'quiz' && (
                          <textarea
                            className="inhalt-content"
                            value={inhalt.inhalt}
                            onChange={(e) => updateModulInhalt(index, 'inhalt', e.target.value)}
                            rows={4}
                            placeholder="Quiz-Fragen als JSON oder Text"
                          />
                        )}
                        
                        {inhalt.typ === 'datei' && (
                          <input
                            type="text"
                            className="inhalt-content"
                            value={inhalt.inhalt}
                            onChange={(e) => updateModulInhalt(index, 'inhalt', e.target.value)}
                            placeholder="Datei-URL oder -Referenz"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAddModulModal(false)}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={saveModul}>
                {modulForm.id ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ASSIGN MODUL MODAL */}
      {showAssignModulModal && selectedTermin && (
        <div className="modal show" onClick={() => setShowAssignModulModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Modul zuordnen</h3>
            <div className="assign-termin-info">
              Für Termin: <strong>{selectedTermin.name}</strong>
            </div>
            
            <div className="field">
              <label>Modul auswählen *</label>
              <select 
                id="assignModulSelect"
                className="select-field"
                defaultValue=""
              >
                <option value="">-- Modul wählen --</option>
                {module
                  .filter(m => !getModuleByTermin(selectedTermin.id).find(mt => mt.modul_id === m.id))
                  .map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.dauer_minuten} Min.)
                    </option>
                  ))
                }
              </select>
            </div>
            
            <div className="field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  id="assignModulPflicht"
                  defaultChecked={false}
                />
                <span>Pflichtmodul</span>
              </label>
              <div className="field-hint">
                Teilnehmer müssen dieses Modul zwingend absolvieren
              </div>
            </div>
            
            <div className="field">
              <label>Frist (optional)</label>
              <input
                type="date"
                id="assignModulFrist"
                className="input-field"
              />
              <div className="field-hint">
                Bis wann sollte das Modul abgeschlossen sein?
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAssignModulModal(false)}>
                Abbrechen
              </button>
              <button 
                className="btn primary" 
                onClick={() => {
                  const select = document.getElementById('assignModulSelect') as HTMLSelectElement
                  const pflicht = (document.getElementById('assignModulPflicht') as HTMLInputElement).checked
                  const frist = (document.getElementById('assignModulFrist') as HTMLInputElement).value
                  
                  if (select.value) {
                    assignModulToTermin(select.value, selectedTermin.id, pflicht, frist)
                    setShowAssignModulModal(false)
                  } else {
                    alert('Bitte ein Modul auswählen')
                  }
                }}
              >
                Zuordnen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
const styles = `
.action-toolbar {
  position: fixed;
  top: 60px;
  right: 20px;
  z-index: 100;
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  background: rgba(255, 255, 255, 1);
}

.action-btn svg {
  color: #333;
}

.content {
  padding: 80px 20px 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.message {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  z-index: 1000;
  animation: slideDown 0.3s ease;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.message.success {
  background: rgba(76, 175, 80, 0.95);
  color: white;
}

.message.error {
  background: rgba(244, 67, 54, 0.95);
  color: white;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.view-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  padding: 6px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.tab-btn {
  flex: 1;
  padding: 12px 20px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #666;
}

.tab-btn svg {
  color: #999;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.5);
  color: #333;
}

.tab-btn.active {
  background: white;
  color: #333;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.tab-btn.active svg {
  color: #333;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  transition: all 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.1);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon svg {
  color: #6366f1;
}

.stat-number {
  font-size: 32px;
  font-weight: 700;
  color: #333;
}

.stat-label {
  font-size: 13px;
  color: #666;
  text-align: center;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 250px;
  padding: 12px 16px;
  border: none;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.filter-buttons {
  display: flex;
  gap: 8px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  padding: 4px;
  border-radius: 10px;
}

.filter-btn {
  padding: 8px 16px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  color: #666;
}

.filter-btn:hover {
  background: rgba(255, 255, 255, 0.5);
  color: #333;
}

.filter-btn.active {
  background: white;
  color: #333;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.termine-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.termin-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.termin-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.1);
  background: rgba(255, 255, 255, 0.85);
}

.termin-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: #6366f1;
}

.termin-card.status-laufend::before {
  background: #10b981;
}

.termin-card.status-abgeschlossen::before {
  background: #6b7280;
}

.termin-card.status-abgesagt::before {
  background: #ef4444;
}

.termin-status-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
}

.status-laufend .termin-status-badge {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-abgeschlossen .termin-status-badge {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.status-abgesagt .termin-status-badge {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.termin-date {
  font-size: 13px;
  font-weight: 700;
  color: #6366f1;
  margin-bottom: 4px;
}

.termin-time {
  font-size: 12px;
  color: #666;
  margin-bottom: 12px;
}

.termin-name {
  font-size: 16px;
  font-weight: 700;
  color: #333;
  margin-bottom: 12px;
}

.termin-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666;
  margin-bottom: 6px;
}

.termin-meta svg {
  flex-shrink: 0;
}

.termin-participants {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #10b981;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0,0,0,0.05);
}

.teilnehmer-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.teilnehmer-row {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.teilnehmer-row:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  background: rgba(255, 255, 255, 0.85);
}

.teilnehmer-avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}

.teilnehmer-info {
  flex: 1;
}

.teilnehmer-name {
  font-size: 15px;
  font-weight: 700;
  color: #333;
  margin-bottom: 4px;
}

.teilnehmer-email {
  font-size: 13px;
  color: #666;
}

.teilnehmer-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
}

.badge.lernbar {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.badge.termine {
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
}

.teilnehmer-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 1);
  transform: scale(1.1);
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.modul-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  transition: all 0.2s;
}

.modul-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.1);
}

.modul-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 12px;
}

.modul-name {
  font-size: 16px;
  font-weight: 700;
  color: #333;
  flex: 1;
}

.modul-duration {
  font-size: 12px;
  font-weight: 600;
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.1);
  padding: 4px 10px;
  border-radius: 8px;
}

.modul-description {
  font-size: 13px;
  color: #666;
  margin-bottom: 16px;
  line-height: 1.5;
}

.modul-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(0,0,0,0.05);
}

.modul-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666;
}

.modul-actions {
  display: flex;
  gap: 8px;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
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
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 28px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.modal-content.large {
  max-width: 700px;
}

.modal-content.xlarge {
  max-width: 900px;
}

.modal-content h3 {
  font-size: 22px;
  font-weight: 700;
  color: #333;
  margin: 0 0 24px 0;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 24px;
}

.termin-detail-meta, .teilnehmer-detail-meta {
  font-size: 13px;
  color: #666;
  margin-top: 6px;
}

.detail-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  background: rgba(0, 0, 0, 0.03);
  padding: 4px;
  border-radius: 12px;
}

.detail-tab {
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  color: #666;
}

.detail-tab:hover {
  background: rgba(255, 255, 255, 0.5);
}

.detail-tab.active {
  background: white;
  color: #333;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.detail-content {
  background: rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.info-section {
  margin-bottom: 24px;
}

.info-section:last-child {
  margin-bottom: 0;
}

.info-section h4 {
  font-size: 14px;
  font-weight: 700;
  color: #333;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.description-text {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.info-item {
  background: rgba(255, 255, 255, 0.5);
  padding: 12px;
  border-radius: 8px;
}

.info-label {
  font-size: 11px;
  font-weight: 700;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.info-value {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.status-pill {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-pill.geplant {
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
}

.status-pill.laufend {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-pill.abgeschlossen {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.status-pill.abgesagt {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
}

.status-count {
  background: rgba(255, 255, 255, 0.5);
  padding: 16px;
  border-radius: 12px;
  text-align: center;
}

.status-count.success {
  background: rgba(16, 185, 129, 0.1);
}

.status-count.danger {
  background: rgba(239, 68, 68, 0.1);
}

.status-count.warning {
  background: rgba(245, 158, 11, 0.1);
}

.count-number {
  font-size: 24px;
  font-weight: 700;
  color: #333;
  margin-bottom: 4px;
}

.count-label {
  font-size: 12px;
  color: #666;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.content-header h4 {
  font-size: 14px;
  font-weight: 700;
  color: #333;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.select-compact {
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.select-compact:hover {
  background: white;
}

.empty-state-small {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-size: 14px;
}

.teilnehmer-table {
  overflow-x: auto;
}

.teilnehmer-table table {
  width: 100%;
  border-collapse: collapse;
}

.teilnehmer-table th {
  text-align: left;
  padding: 12px;
  font-size: 11px;
  font-weight: 700;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid rgba(0,0,0,0.05);
}

.teilnehmer-table td {
  padding: 12px;
  font-size: 13px;
  color: #333;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.table-person {
  display: flex;
  align-items: center;
  gap: 12px;
}

.person-avatar-small {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  flex-shrink: 0;
}

.person-name {
  font-weight: 600;
  color: #333;
}

.person-email {
  font-size: 12px;
  color: #666;
}

.status-select {
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.einladung-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.einladung-via {
  font-size: 11px;
  color: #999;
  text-transform: uppercase;
}

.anwesenheit-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.table-actions {
  display: flex;
  gap: 6px;
}

.btn-icon-small {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-icon-small:hover {
  background: white;
  transform: scale(1.1);
}

.btn-icon-small.danger {
  color: #ef4444;
}

.btn-icon-small.danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.dokumente-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dokument-section h5 {
  font-size: 13px;
  font-weight: 700;
  color: #333;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dokumente-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dokument-item {
  background: rgba(255, 255, 255, 0.5);
  padding: 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.2s;
}

.dokument-item:hover {
  background: rgba(255, 255, 255, 0.8);
}

.dokument-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dokument-icon svg {
  color: #6366f1;
}

.dokument-info {
  flex: 1;
}

.dokument-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.dokument-desc {
  font-size: 12px;
  color: #666;
}

.dokument-actions {
  display: flex;
  gap: 6px;
}

.empty-hint {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.assigned-module-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.assigned-modul-item {
  background: rgba(255, 255, 255, 0.5);
  padding: 16px;
  border-radius: 12px;
  display: flex;
  align-items: start;
  gap: 16px;
  transition: all 0.2s;
}

.assigned-modul-item:hover {
  background: rgba(255, 255, 255, 0.8);
}

.modul-item-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(139, 92, 246, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modul-item-icon svg {
  color: #8b5cf6;
}

.modul-item-info {
  flex: 1;
}

.modul-item-name {
  font-size: 15px;
  font-weight: 700;
  color: #333;
  margin-bottom: 6px;
}

.modul-item-meta {
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pflicht-badge {
  padding: 2px 8px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.modul-item-frist {
  font-size: 12px;
  color: #f59e0b;
  margin-top: 4px;
}

.field, .field-row {
  margin-bottom: 16px;
}

.field-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.field label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #666;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field input[type="text"],
.field input[type="email"],
.field input[type="tel"],
.field input[type="url"],
.field input[type="number"],
.field input[type="date"],
.field input[type="datetime-local"],
.field textarea,
.field select {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-family: inherit;
  transition: all 0.2s;
}

.field input:focus,
.field textarea:focus,
.field select:focus {
  outline: none;
  background: white;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.field textarea {
  resize: vertical;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  text-transform: none;
  letter-spacing: normal;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.field-hint {
  font-size: 12px;
  color: #999;
  margin-top: 6px;
  font-weight: normal;
  text-transform: none;
  letter-spacing: normal;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.7);
  color: #333;
}

.btn:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.btn.primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
}

.btn.primary:hover {
  box-shadow: 0 6px 12px rgba(99, 102, 241, 0.3);
}

.btn.danger {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn:disabled:hover {
  transform: none;
}

.upload-termin-info, .assign-termin-info {
  background: rgba(99, 102, 241, 0.1);
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  color: #333;
  margin-bottom: 20px;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  margin-top: 8px;
  font-size: 13px;
  color: #333;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radio-label {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-label:hover {
  background: rgba(255, 255, 255, 0.8);
}

.radio-label input[type="radio"] {
  margin-right: 8px;
}

.radio-label span {
  font-weight: 600;
  color: #333;
}

.radio-hint {
  font-size: 12px;
  color: #666;
  margin-left: 28px;
  margin-top: 4px;
}

.field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.add-inhalt-buttons {
  display: flex;
  gap: 6px;
}

.btn-small {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.7);
  color: #333;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-small:hover {
  background: white;
  transform: translateY(-1px);
}

.inhalte-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inhalt-item {
  background: rgba(255, 255, 255, 0.5);
  padding: 16px;
  border-radius: 12px;
}

.inhalt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.inhalt-typ-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.inhalt-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inhalt-titel, .inhalt-content {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-family: inherit;
  transition: all 0.2s;
}

.inhalt-titel:focus, .inhalt-content:focus {
  outline: none;
  background: white;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.detail-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.lernbar-status {
  background: rgba(255, 255, 255, 0.5);
  padding: 16px;
  border-radius: 12px;
}

.lernbar-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .3s;
  border-radius: 26px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
}

input:checked + .slider {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
}

input:checked + .slider:before {
  transform: translateX(22px);
}

.toggle-label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.lernbar-credentials {
  background: rgba(139, 92, 246, 0.05);
  padding: 12px;
  border-radius: 8px;
}

.credential-row {
  display: flex;
  gap: 12px;
  padding: 8px 0;
}

.credential-label {
  font-size: 12px;
  font-weight: 700;
  color: #666;
  min-width: 80px;
}

.credential-value {
  font-size: 13px;
  color: #333;
  font-weight: 600;
}

.termine-list-compact {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.termin-compact-item {
  background: rgba(255, 255, 255, 0.5);
  padding: 12px;
  border-radius: 8px;
  display: flex;
  gap: 12px;
  align-items: start;
}

.termin-compact-date {
  width: 50px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
  padding: 8px 4px;
  border-radius: 8px;
  flex-shrink: 0;
}

.termin-compact-info {
  flex: 1;
}

.termin-compact-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.termin-compact-status {
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6366f1;
}

.status-dot.zugesagt {
  background: #10b981;
}

.status-dot.abgesagt {
  background: #ef4444;
}

.status-dot.entschuldigt {
  background: #f59e0b;
}

.anwesend-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
}

.progress-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-item {
  background: rgba(255, 255, 255, 0.5);
  padding: 12px;
  border-radius: 8px;
}

.progress-info {
  margin-bottom: 8px;
}

.progress-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.progress-meta {
  font-size: 12px;
  color: #666;
}

.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  transition: width 0.3s;
}

.progress-percent {
  font-size: 12px;
  font-weight: 700;
  color: #6366f1;
  min-width: 40px;
  text-align: right;
}

.notizen-text {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  background: rgba(255, 255, 255, 0.5);
  padding: 12px;
  border-radius: 8px;
}

.select-field, .input-field {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-family: inherit;
  transition: all 0.2s;
}

.select-field:focus, .input-field:focus {
  outline: none;
  background: white;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}
`

const styleSheet = document.createElement('style')
styleSheet.textContent = styles
document.head.appendChild(styleSheet)
      `}</style>
    </>
  )
}
