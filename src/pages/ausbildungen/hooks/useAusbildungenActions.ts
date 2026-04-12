import { pb } from '../../../lib/pocketbase'
import { TerminForm, TeilnehmerForm, ModulForm } from '../types/ausbildungen.types'
import { generatePassword } from '../utils/helpers'


interface UseActionsParams {
  organizationId: string | undefined
  onSuccess: (message: string) => void
  onError: (message: string) => void
  loadData: () => Promise<void>
  loadTermine: () => Promise<void>
  loadTeilnehmer: () => Promise<void>
  loadTerminTeilnehmer: () => Promise<void>
  loadDokumente: () => Promise<void>
  loadModule: () => Promise<void>
  loadModulTermine: () => Promise<void>
}

export function useAusbildungenActions(params: UseActionsParams) {
  const { organizationId, onSuccess, onError, loadData, loadTermine, loadTeilnehmer, loadTerminTeilnehmer, loadDokumente, loadModule, loadModulTermine } = params

  // TERMIN ACTIONS
  async function saveTermin(terminForm: TerminForm) {
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
        organization_id: organizationId
      }

      if (terminForm.id) {
        await pb.collection('ausbildungen_termine').update(terminForm.id, data)
        onSuccess('Termin aktualisiert')
      } else {
        await pb.collection('ausbildungen_termine').create(data)
        onSuccess('Termin erstellt')
      }

      await loadTermine()
    } catch(e: any) {
      alert('Fehler beim Speichern: ' + e.message)
    }
  }

  async function deleteTermin(id: string, name: string) {
    if (!confirm(`Termin "${name}" wirklich löschen? Alle Teilnehmer-Zuordnungen werden ebenfalls gelöscht.`)) return

    try {
      await pb.collection('ausbildungen_termine').delete(id)
      onSuccess('Termin gelöscht')
      await loadData()
    } catch(e: any) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  // TEILNEHMER ACTIONS
  async function saveTeilnehmer(teilnehmerForm: TeilnehmerForm) {
    if (!teilnehmerForm.vorname || !teilnehmerForm.nachname || !teilnehmerForm.email) {
      alert('Bitte Vorname, Nachname und E-Mail eingeben')
      return
    }

    try {
      const data: any = {
        vorname: teilnehmerForm.vorname,
        nachname: teilnehmerForm.nachname,
        email: teilnehmerForm.email,
        telefon: teilnehmerForm.telefon,
        whatsapp: teilnehmerForm.whatsapp,
        notizen: teilnehmerForm.notizen,
        lernbar_zugang_aktiv: teilnehmerForm.lernbar_zugang_aktiv,
        organization_id: organizationId
      }

      // Lernbar-Zugang generieren wenn aktiviert und noch nicht vorhanden
      if (teilnehmerForm.lernbar_zugang_aktiv && !teilnehmerForm.id) {
        data.lernbar_email = teilnehmerForm.email
        data.lernbar_passwort = generatePassword()
      }

      if (teilnehmerForm.id) {
        await pb.collection('ausbildungen_teilnehmer').update(teilnehmerForm.id, data)
        onSuccess('Teilnehmer aktualisiert')
      } else {
        await pb.collection('ausbildungen_teilnehmer').create(data)
        onSuccess('Teilnehmer erstellt')
      }

      await loadTeilnehmer()
    } catch(e: any) {
      alert('Fehler beim Speichern: ' + e.message)
    }
  }

  async function deleteTeilnehmer(id: string, name: string) {
    if (!confirm(`Teilnehmer "${name}" wirklich löschen?`)) return

    try {
      await pb.collection('ausbildungen_teilnehmer').delete(id)
      onSuccess('Teilnehmer gelöscht')
      await loadData()
    } catch(e: any) {
      alert('Fehler beim Löschen: ' + e.message)
    }
  }

  async function toggleLernbarZugang(teilnehmerId: string, currentStatus: boolean, email: string, currentLernbarEmail?: string) {
    try {
      const neuerStatus = !currentStatus
      const data: any = {
        lernbar_zugang_aktiv: neuerStatus
      }

      if (neuerStatus && !currentLernbarEmail) {
        data.lernbar_email = email
        data.lernbar_passwort = generatePassword()
      }

      await pb.collection('ausbildungen_teilnehmer').update(teilnehmerId, data)
      onSuccess(neuerStatus ? 'Lernbar-Zugang aktiviert' : 'Lernbar-Zugang deaktiviert')
      await loadTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // TERMIN-TEILNEHMER ACTIONS
  async function addTeilnehmerToTermin(terminId: string, teilnehmerId: string, via: 'email' | 'whatsapp' | 'persönlich' | 'telefon') {
    try {
      await pb.collection('ausbildungen_termine_teilnehmer').create({
        termin_id: terminId,
        teilnehmer_id: teilnehmerId,
        status: 'eingeladen',
        eingeladen_am: new Date().toISOString(),
        eingeladen_via: via,
        anwesend: false,
        notizen: '',
        organization_id: organizationId
      })
      onSuccess('Teilnehmer hinzugefügt')
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function updateTeilnehmerStatus(ttId: string, newStatus: 'eingeladen' | 'zugesagt' | 'abgesagt' | 'entschuldigt') {
    try {
      await pb.collection('ausbildungen_termine_teilnehmer').update(ttId, {
        status: newStatus
      })
      onSuccess('Status aktualisiert')
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function toggleAnwesenheit(ttId: string, currentStatus: boolean) {
    try {
      await pb.collection('ausbildungen_termine_teilnehmer').update(ttId, {
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
      await pb.collection('ausbildungen_termine_teilnehmer').delete(ttId)
      onSuccess('Teilnehmer entfernt')
      await loadTerminTeilnehmer()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // DOKUMENT ACTIONS
  async function uploadDokument(file: File, terminId: string, typ: 'dozent' | 'teilnehmer', beschreibung: string) {
    if (!file) {
      alert('Bitte Datei auswählen')
      return
    }

    try {
      const formData = new FormData()
      formData.append('termin_id', terminId)
      formData.append('name', file.name)
      formData.append('typ', typ)
      formData.append('datei', file)
      formData.append('beschreibung', beschreibung)
      formData.append('organization_id', organizationId || '')

      await pb.collection('ausbildungen_dokumente').create(formData)
      onSuccess('Dokument hochgeladen')
      await loadDokumente()
    } catch(e: any) {
      alert('Fehler beim Hochladen: ' + e.message)
    }
  }

  async function deleteDokument(id: string, name: string) {
    if (!confirm(`Dokument "${name}" wirklich löschen?`)) return

    try {
      await pb.collection('ausbildungen_dokumente').delete(id)
      onSuccess('Dokument gelöscht')
      await loadDokumente()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  // MODUL ACTIONS
  async function saveModul(modulForm: ModulForm) {
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
        organization_id: organizationId
      }

      if (modulForm.id) {
        await pb.collection('ausbildungen_module').update(modulForm.id, data)
        onSuccess('Modul aktualisiert')
      } else {
        await pb.collection('ausbildungen_module').create(data)
        onSuccess('Modul erstellt')
      }

      await loadModule()
    } catch(e: any) {
      alert('Fehler beim Speichern: ' + e.message)
    }
  }

  async function deleteModul(id: string, name: string) {
    if (!confirm(`Modul "${name}" wirklich löschen?`)) return

    try {
      await pb.collection('ausbildungen_module').delete(id)
      onSuccess('Modul gelöscht')
      await loadData()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function assignModulToTermin(modulId: string, terminId: string, pflicht: boolean, frist?: string) {
    try {
      await pb.collection('ausbildungen_module_termine').create({
        modul_id: modulId,
        termin_id: terminId,
        pflicht: pflicht,
        frist_datum: frist || '',
        organization_id: organizationId
      })
      onSuccess('Modul zugeordnet')
      await loadModulTermine()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  async function removeModulFromTermin(mtId: string) {
    if (!confirm('Modulzuordnung entfernen?')) return

    try {
      await pb.collection('ausbildungen_module_termine').delete(mtId)
      onSuccess('Modul entfernt')
      await loadModulTermine()
    } catch(e: any) {
      alert('Fehler: ' + e.message)
    }
  }

  return {
    // Termin
    saveTermin,
    deleteTermin,
    
    // Teilnehmer
    saveTeilnehmer,
    deleteTeilnehmer,
    toggleLernbarZugang,
    
    // Termin-Teilnehmer
    addTeilnehmerToTermin,
    updateTeilnehmerStatus,
    toggleAnwesenheit,
    removeTeilnehmerFromTermin,
    
    // Dokumente
    uploadDokument,
    deleteDokument,
    
    // Module
    saveModul,
    deleteModul,
    assignModulToTermin,
    removeModulFromTermin
  }
}
