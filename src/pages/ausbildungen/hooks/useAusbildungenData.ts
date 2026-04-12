import { useState, useEffect } from 'react'
import { pb } from '../../../lib/pocketbase'
import { Termin, Teilnehmer, TerminTeilnehmer, Dokument, Modul, ModulTermin, ModulProgress } from '../types/ausbildungen.types'

const pb = new PocketBase('https://api.responda.systems')

export function useAusbildungenData(organizationId: string | undefined) {
  const [termine, setTermine] = useState<Termin[]>([])
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([])
  const [terminTeilnehmer, setTerminTeilnehmer] = useState<TerminTeilnehmer[]>([])
  const [dokumente, setDokumente] = useState<Dokument[]>([])
  const [module, setModule] = useState<Modul[]>([])
  const [modulTermine, setModulTermine] = useState<ModulTermin[]>([])
  const [modulProgress, setModulProgress] = useState<ModulProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (organizationId) {
      loadData()
    }
  }, [organizationId])

  async function loadData() {
    if (!organizationId) return
    
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
    } finally {
      setLoading(false)
    }
  }

  async function loadTermine() {
    const records = await pb.collection('ausbildungen_termine').getFullList({
      filter: `organization_id = "${organizationId}"`,
      sort: '-start_datetime'
    })
    setTermine(records)
  }

  async function loadTeilnehmer() {
    const records = await pb.collection('ausbildungen_teilnehmer').getFullList({
      filter: `organization_id = "${organizationId}"`,
      sort: 'nachname,vorname'
    })
    setTeilnehmer(records)
  }

  async function loadTerminTeilnehmer() {
    const records = await pb.collection('ausbildungen_termine_teilnehmer').getFullList({
      filter: `organization_id = "${organizationId}"`,
      expand: 'teilnehmer_id'
    })
    setTerminTeilnehmer(records)
  }

  async function loadDokumente() {
    const records = await pb.collection('ausbildungen_dokumente').getFullList({
      filter: `organization_id = "${organizationId}"`
    })
    setDokumente(records)
  }

  async function loadModule() {
    const records = await pb.collection('ausbildungen_module').getFullList({
      filter: `organization_id = "${organizationId}"`,
      sort: '-created'
    })
    setModule(records)
  }

  async function loadModulTermine() {
    const records = await pb.collection('ausbildungen_module_termine').getFullList({
      filter: `organization_id = "${organizationId}"`,
      expand: 'modul_id'
    })
    setModulTermine(records)
  }

  async function loadModulProgress() {
    const records = await pb.collection('ausbildungen_module_progress').getFullList({
      filter: `organization_id = "${organizationId}"`
    })
    setModulProgress(records)
  }

  return {
    // Data
    termine,
    teilnehmer,
    terminTeilnehmer,
    dokumente,
    module,
    modulTermine,
    modulProgress,
    loading,
    
    // Reload functions
    loadData,
    loadTermine,
    loadTeilnehmer,
    loadTerminTeilnehmer,
    loadDokumente,
    loadModule,
    loadModulTermine,
    loadModulProgress
  }
}
import { useState, useEffect } from 'react'
import PocketBase from 'pocketbase'
import { Termin, Teilnehmer, TerminTeilnehmer, Dokument, Modul, ModulTermin, ModulProgress } from '../types/ausbildungen.types'

const pb = new PocketBase('https://api.responda.systems')

export function useAusbildungenData(organizationId: string | undefined) {
  const [termine, setTermine] = useState<Termin[]>([])
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([])
  const [terminTeilnehmer, setTerminTeilnehmer] = useState<TerminTeilnehmer[]>([])
  const [dokumente, setDokumente] = useState<Dokument[]>([])
  const [module, setModule] = useState<Modul[]>([])
  const [modulTermine, setModulTermine] = useState<ModulTermin[]>([])
  const [modulProgress, setModulProgress] = useState<ModulProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (organizationId) {
      loadData()
    }
  }, [organizationId])

  async function loadData() {
    if (!organizationId) return
    
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
    } finally {
      setLoading(false)
    }
  }

  async function loadTermine() {
    const records = await pb.collection('ausbildungen_termine').getFullList({
      filter: `organization_id = "${organizationId}"`,
      sort: '-start_datetime'
    })
    setTermine(records)
  }

  async function loadTeilnehmer() {
    const records = await pb.collection('ausbildungen_teilnehmer').getFullList({
      filter: `organization_id = "${organizationId}"`,
      sort: 'nachname,vorname'
    })
    setTeilnehmer(records)
  }

  async function loadTerminTeilnehmer() {
    const records = await pb.collection('ausbildungen_termine_teilnehmer').getFullList({
      filter: `organization_id = "${organizationId}"`,
      expand: 'teilnehmer_id'
    })
    setTerminTeilnehmer(records)
  }

  async function loadDokumente() {
    const records = await pb.collection('ausbildungen_dokumente').getFullList({
      filter: `organization_id = "${organizationId}"`
    })
    setDokumente(records)
  }

  async function loadModule() {
    const records = await pb.collection('ausbildungen_module').getFullList({
      filter: `organization_id = "${organizationId}"`,
      sort: '-created'
    })
    setModule(records)
  }

  async function loadModulTermine() {
    const records = await pb.collection('ausbildungen_module_termine').getFullList({
      filter: `organization_id = "${organizationId}"`,
      expand: 'modul_id'
    })
    setModulTermine(records)
  }

  async function loadModulProgress() {
    const records = await pb.collection('ausbildungen_module_progress').getFullList({
      filter: `organization_id = "${organizationId}"`
    })
    setModulProgress(records)
  }

  return {
    // Data
    termine,
    teilnehmer,
    terminTeilnehmer,
    dokumente,
    module,
    modulTermine,
    modulProgress,
    loading,
    
    // Reload functions
    loadData,
    loadTermine,
    loadTeilnehmer,
    loadTerminTeilnehmer,
    loadDokumente,
    loadModule,
    loadModulTermine,
    loadModulProgress
  }
}
