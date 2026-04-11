import { Termin, Teilnehmer, TerminTeilnehmer, Dokument, Modul, ModulTermin, ModulProgress, Stats } from '../types/ausbildungen.types'

// ============================================
// FILTER & FINDER FUNCTIONS
// ============================================

export function getTerminTeilnehmerByTermin(
  terminId: string, 
  terminTeilnehmer: TerminTeilnehmer[]
): TerminTeilnehmer[] {
  return terminTeilnehmer.filter(tt => tt.termin_id === terminId)
}

export function getDokumenteByTermin(terminId: string, dokumente: Dokument[]): Dokument[] {
  return dokumente.filter(d => d.termin_id === terminId)
}

export function getModuleByTermin(terminId: string, modulTermine: ModulTermin[]): ModulTermin[] {
  return modulTermine.filter(mt => mt.termin_id === terminId)
}

export function getTeilnehmerTermine(
  teilnehmerId: string, 
  terminTeilnehmer: TerminTeilnehmer[]
): TerminTeilnehmer[] {
  return terminTeilnehmer.filter(tt => tt.teilnehmer_id === teilnehmerId)
}

export function getTeilnehmerModulProgress(
  teilnehmerId: string, 
  modulProgress: ModulProgress[]
): ModulProgress[] {
  return modulProgress.filter(mp => mp.teilnehmer_id === teilnehmerId)
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export function calculateStats(
  termine: Termin[], 
  teilnehmer: Teilnehmer[], 
  module: Modul[]
): Stats {
  return {
    termine_gesamt: termine.length,
    termine_geplant: termine.filter(t => t.status === 'geplant').length,
    termine_laufend: termine.filter(t => t.status === 'laufend').length,
    teilnehmer_gesamt: teilnehmer.length,
    teilnehmer_lernbar: teilnehmer.filter(t => t.lernbar_zugang_aktiv).length,
    module_gesamt: module.length
  }
}

// ============================================
// FILTER FUNCTIONS
// ============================================

export function filterTermine(
  termine: Termin[],
  searchQuery: string,
  statusFilter: 'all' | 'geplant' | 'laufend' | 'abgeschlossen'
): Termin[] {
  return termine.filter(termin => {
    const matchesSearch = 
      termin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      termin.dozent?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      termin.location?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = 
      statusFilter === 'all' || termin.status === statusFilter
    
    return matchesSearch && matchesStatus
  })
}

export function filterTeilnehmer(teilnehmer: Teilnehmer[], searchQuery: string): Teilnehmer[] {
  return teilnehmer.filter(t => {
    const fullName = `${t.vorname} ${t.nachname}`.toLowerCase()
    return fullName.includes(searchQuery.toLowerCase()) ||
           t.email.toLowerCase().includes(searchQuery.toLowerCase())
  })
}

export function filterModule(module: Modul[], searchQuery: string): Modul[] {
  return module.filter(m => {
    return m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           m.beschreibung.toLowerCase().includes(searchQuery.toLowerCase())
  })
}

// ============================================
// EMAIL & MESSAGING HELPERS
// ============================================

export function createEinladungEmail(termin: Termin, teilnehmer: Teilnehmer): string {
  const subject = encodeURIComponent(`Einladung: ${termin.name}`)
  const body = encodeURIComponent(
    `Hallo ${teilnehmer.vorname},\n\n` +
    `du bist eingeladen zu:\n\n` +
    `${termin.name}\n` +
    `Datum: ${new Date(termin.start_datetime).toLocaleString('de-DE')}\n` +
    `Ort: ${termin.location}\n\n` +
    `Bitte bestätige deine Teilnahme.\n\n` +
    `Viele Grüße`
  )
  return `mailto:${teilnehmer.email}?subject=${subject}&body=${body}`
}

export function createWhatsAppMessage(termin: Termin, teilnehmer: Teilnehmer): string | null {
  const phone = teilnehmer.whatsapp || teilnehmer.telefon
  if (!phone) return null
  
  const text = encodeURIComponent(
    `Hallo ${teilnehmer.vorname}, du bist eingeladen zu: ` +
    `${termin.name} am ${new Date(termin.start_datetime).toLocaleString('de-DE')} ` +
    `in ${termin.location}`
  )
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${text}`
}
