import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import * as types from './types/ausbildungen.types'
import * as helpers from './utils/helpers'
import { useAusbildungenData } from './hooks/useAusbildungenData'
import { useAusbildungenActions } from './hooks/useAusbildungenActions'

// Modal Imports
import AddTeilnehmerModal from './components/modals/AddTeilnehmerModal'
import AddTerminModal from './components/modals/AddTerminModal'
import UploadDokumentModal from './components/modals/UploadDokumentModal'
import AssignModulModal from './components/modals/AssignModulModal'
import TerminDetailModal from './components/modals/TerminDetailModal'
import TeilnehmerDetailModal from './components/modals/TeilnehmerDetailModal'
import AddModulModal from './components/modals/AddModulModal'

import './Ausbildungen.css'

function Ausbildungen() {
  const { user } = useAuth()

  const {
    termine,
    teilnehmer,
    terminTeilnehmer,
    dokumente,
    module,
    modulTermine,
    modulProgress,
    loading,
    loadData,
    loadTermine,
    loadTeilnehmer,
    loadTerminTeilnehmer,
    loadDokumente,
    loadModule,
    loadModulTermine
  } = useAusbildungenData(user?.organization_id)

  const actions = useAusbildungenActions({
    organizationId: user?.organization_id,
    onSuccess: (msg) => showMessage(msg, 'success'),
    onError: (msg) => showMessage(msg, 'error'),
    loadData,
    loadTermine,
    loadTeilnehmer,
    loadTerminTeilnehmer,
    loadDokumente,
    loadModule,
    loadModulTermine
  })

  const [viewMode, setViewMode] = useState<types.ViewMode>('termine')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<types.StatusFilter>('all')
  const [message, setMessage] = useState<types.Message | null>(null)

  const [showAddTerminModal, setShowAddTerminModal] = useState(false)
  const [showAddTeilnehmerModal, setShowAddTeilnehmerModal] = useState(false)
  const [showTerminDetailModal, setShowTerminDetailModal] = useState(false)
  const [showTeilnehmerDetailModal, setShowTeilnehmerDetailModal] = useState(false)
  const [showUploadDokumentModal, setShowUploadDokumentModal] = useState(false)
  const [showAddModulModal, setShowAddModulModal] = useState(false)
  const [showAssignModulModal, setShowAssignModulModal] = useState(false)

  const [selectedTermin, setSelectedTermin] = useState<types.Termin | null>(null)
  const [selectedTeilnehmer, setSelectedTeilnehmer] = useState<types.Teilnehmer | null>(null)

  const [terminForm, setTerminForm] = useState<types.TerminForm>({
    name: '',
    description: '',
    start_datetime: '',
    end_datetime: '',
    location: '',
    dozent: '',
    max_teilnehmer: 20,
    status: 'geplant'
  })

  const [teilnehmerForm, setTeilnehmerForm] = useState<types.TeilnehmerForm>({
    vorname: '',
    nachname: '',
    email: '',
    telefon: '',
    whatsapp: '',
    notizen: '',
    lernbar_zugang_aktiv: false
  })

  const [modulForm, setModulForm] = useState<types.ModulForm>({
    name: '',
    beschreibung: '',
    inhalte: [],
    dauer_minuten: 60
  })

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTyp, setUploadTyp] = useState<'dozent' | 'teilnehmer'>('teilnehmer')
  const [uploadBeschreibung, setUploadBeschreibung] = useState('')

  const stats = helpers.calculateStats(termine, teilnehmer, module)
  const filteredTermine = helpers.filterTermine(termine, searchQuery, statusFilter)
  const filteredTeilnehmer = helpers.filterTeilnehmer(teilnehmer, searchQuery)
  const filteredModule = helpers.filterModule(module, searchQuery)

  function showMessage(text: string, type: types.MessageType) {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

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

  function openEditTermin(termin: types.Termin) {
    setTerminForm({
      id: termin.id,
      name: termin.name,
      description: termin.description,
      start_datetime: termin.start_datetime.substring(0, 16),
      end_datetime: termin.end_datetime.substring(0, 16),
      location: termin.location,
      dozent: termin.dozent,
      max_teilnehmer: termin.max_teilnehmer,
      status: termin.status
    })
    setShowAddTerminModal(true)
  }

  function openTerminDetail(termin: types.Termin) {
    setSelectedTermin(termin)
    setShowTerminDetailModal(true)
  }

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

  function openEditTeilnehmer(teilnehmer: types.Teilnehmer) {
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

  function openTeilnehmerDetail(teilnehmer: types.Teilnehmer) {
    setSelectedTeilnehmer(teilnehmer)
    setShowTeilnehmerDetailModal(true)
  }

  function openAddModul() {
    setModulForm({
      name: '',
      beschreibung: '',
      inhalte: [],
      dauer_minuten: 60
    })
    setShowAddModulModal(true)
  }

  function openEditModul(modul: types.Modul) {
    setModulForm({
      id: modul.id,
      name: modul.name,
      beschreibung: modul.beschreibung,
      inhalte: modul.inhalte,
      dauer_minuten: modul.dauer_minuten
    })
    setShowAddModulModal(true)
  }

  function addModulInhalt(typ: 'text' | 'video' | 'quiz' | 'datei') {
    const newInhalt: types.ModulInhalt = {
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

  function updateModulInhalt(index: number, field: keyof types.ModulInhalt, value: any) {
    const updated = [...modulForm.inhalte]
    updated[index] = { ...updated[index], [field]: value }
    setModulForm({ ...modulForm, inhalte: updated })
  }

  function openUploadDokument(termin: types.Termin) {
    setSelectedTermin(termin)
    setUploadFile(null)
    setUploadTyp('teilnehmer')
    setUploadBeschreibung('')
    setShowUploadDokumentModal(true)
  }

  if (loading) {
    return (
      <div className="ausbildungen-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Lade Ausbildungsdaten...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ausbildungen-page">
      {message && (
        <div className={`message-toast ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="page-header">
        <h1>Ausbildungen</h1>
        <div className="header-actions">
          {viewMode === 'termine' && (
            <button className="btn primary" onClick={openAddTermin}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Termin erstellen
            </button>
          )}
          {viewMode === 'teilnehmer' && (
            <button className="btn primary" onClick={openAddTeilnehmer}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Teilnehmer hinzufügen
            </button>
          )}
          {viewMode === 'module' && (
            <button className="btn primary" onClick={openAddModul}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Modul erstellen
            </button>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.termine_gesamt}</div>
            <div className="stat-label">Termine gesamt</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.termine_geplant}</div>
            <div className="stat-label">Geplant</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.teilnehmer_gesamt}</div>
            <div className="stat-label">Teilnehmer</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.module_gesamt}</div>
            <div className="stat-label">Online-Module</div>
          </div>
        </div>
      </div>

      <div className="view-tabs">
        <button
          className={`view-tab ${viewMode === 'termine' ? 'active' : ''}`}
          onClick={() => setViewMode('termine')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Termine
        </button>
        <button
          className={`view-tab ${viewMode === 'teilnehmer' ? 'active' : ''}`}
          onClick={() => setViewMode('teilnehmer')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Teilnehmer
        </button>
        <button
          className={`view-tab ${viewMode === 'module' ? 'active' : ''}`}
          onClick={() => setViewMode('module')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          Online-Module
        </button>
      </div>

      <div className="controls-bar">
        <div className="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {viewMode === 'termine' && (
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as types.StatusFilter)}
          >
            <option value="all">Alle Status</option>
            <option value="geplant">Geplant</option>
            <option value="laufend">Laufend</option>
            <option value="abgeschlossen">Abgeschlossen</option>
          </select>
        )}
      </div>

      {viewMode === 'termine' && (
        <div className="termine-grid">
          {filteredTermine.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <h3>Noch keine Termine</h3>
              <p>Erstelle deinen ersten Ausbildungstermin</p>
              <button className="btn primary" onClick={openAddTermin}>
                Termin erstellen
              </button>
            </div>
          ) : (
            filteredTermine.map(termin => {
              const ttList = helpers.getTerminTeilnehmerByTermin(termin.id, terminTeilnehmer)
              const anwesend = ttList.filter(tt => tt.anwesend).length

              return (
                <div
                  key={termin.id}
                  className="termin-card"
                  onClick={() => openTerminDetail(termin)}
                >
                  <div className="termin-header">
                    <div className="termin-date">
                      <div className="date-day">
                        {new Date(termin.start_datetime).toLocaleDateString('de-DE', { day: '2-digit' })}
                      </div>
                      <div className="date-month">
                        {new Date(termin.start_datetime).toLocaleDateString('de-DE', { month: 'short' })}
                      </div>
                    </div>
                    <div className="termin-info">
                      <h3>{termin.name}</h3>
                      <div className="termin-meta">
                        <span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                          </svg>
                          {new Date(termin.start_datetime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {termin.location && (
                          <span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                              <circle cx="12" cy="10" r="3"/>
                            </svg>
                            {termin.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="termin-stats">
                    <div className="termin-stat">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      {ttList.length}/{termin.max_teilnehmer} Teilnehmer
                    </div>
                    {ttList.length > 0 && (
                      <div className="termin-stat">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        {anwesend} anwesend
                      </div>
                    )}
                  </div>

                  <div className="termin-footer">
                    <span className={`status-badge ${termin.status}`}>
                      {termin.status}
                    </span>
                    {termin.dozent && (
                      <span className="dozent-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                        {termin.dozent}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {viewMode === 'teilnehmer' && (
        <div className="teilnehmer-list">
          {filteredTeilnehmer.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <h3>Noch keine Teilnehmer</h3>
              <p>Füge deinen ersten Teilnehmer hinzu</p>
              <button className="btn primary" onClick={openAddTeilnehmer}>
                Teilnehmer hinzufügen
              </button>
            </div>
          ) : (
            <table className="teilnehmer-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Kontakt</th>
                  <th>Termine</th>
                  <th>Lernbar</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeilnehmer.map(t => {
                  const termine = helpers.getTeilnehmerTermine(t.id, terminTeilnehmer)

                  return (
                    <tr key={t.id} onClick={() => openTeilnehmerDetail(t)}>
                      <td>
                        <div className="person-cell">
                          <div className="person-avatar">
                            {t.vorname.charAt(0)}{t.nachname.charAt(0)}
                          </div>
                          <div>
                            <div className="person-name">{t.vorname} {t.nachname}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="contact-cell">
                          <div>{t.email}</div>
                          {t.telefon && <div className="contact-sub">{t.telefon}</div>}
                        </div>
                      </td>
                      <td>
                        <span className="count-badge">{termine.length}</span>
                      </td>
                      <td>
                        {t.lernbar_zugang_aktiv ? (
                          <span className="badge success">Aktiv</span>
                        ) : (
                          <span className="badge">Inaktiv</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn-small"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditTeilnehmer(t)
                          }}
                        >
                          Bearbeiten
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {viewMode === 'module' && (
        <div className="module-grid">
          {filteredModule.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              <h3>Noch keine Module</h3>
              <p>Erstelle dein erstes Online-Modul für die Lernbar</p>
              <button className="btn primary" onClick={openAddModul}>
                Modul erstellen
              </button>
            </div>
          ) : (
            filteredModule.map(modul => {
              const zuordnungen = modulTermine.filter(mt => mt.modul_id === modul.id)

              return (
                <div key={modul.id} className="modul-card">
                  <div className="modul-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                  </div>
                  <h3>{modul.name}</h3>
                  {modul.beschreibung && (
                    <p className="modul-description">{modul.beschreibung}</p>
                  )}
                  <div className="modul-meta">
                    <span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {modul.dauer_minuten} Min.
                    </span>
                    <span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      {modul.inhalte.length} Lektionen
                    </span>
                    {zuordnungen.length > 0 && (
                      <span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        {zuordnungen.length} Termine
                      </span>
                    )}
                  </div>
                  <div className="modul-actions">
                    <button
                      className="btn-small"
                      onClick={() => openEditModul(modul)}
                    >
                      Bearbeiten
                    </button>
                    <button
                      className="btn-small danger"
                      onClick={() => actions.deleteModul(modul.id, modul.name)}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      <AddTerminModal
        show={showAddTerminModal}
        terminForm={terminForm}
        onClose={() => setShowAddTerminModal(false)}
        onSave={() => {
          actions.saveTermin(terminForm)
          setShowAddTerminModal(false)
        }}
        onFormChange={setTerminForm}
      />

      <AddTeilnehmerModal
        show={showAddTeilnehmerModal}
        teilnehmerForm={teilnehmerForm}
        onClose={() => setShowAddTeilnehmerModal(false)}
        onSave={() => {
          actions.saveTeilnehmer(teilnehmerForm)
          setShowAddTeilnehmerModal(false)
        }}
        onFormChange={setTeilnehmerForm}
      />

      <UploadDokumentModal
        show={showUploadDokumentModal}
        selectedTermin={selectedTermin}
        uploadFile={uploadFile}
        uploadTyp={uploadTyp}
        uploadBeschreibung={uploadBeschreibung}
        onClose={() => setShowUploadDokumentModal(false)}
        onUpload={() => {
          if (uploadFile && selectedTermin) {
            actions.uploadDokument(uploadFile, selectedTermin.id, uploadTyp, uploadBeschreibung)
            setShowUploadDokumentModal(false)
          }
        }}
        onFileChange={setUploadFile}
        onTypChange={setUploadTyp}
        onBeschreibungChange={setUploadBeschreibung}
      />

      <AssignModulModal
        show={showAssignModulModal}
        selectedTermin={selectedTermin}
        module={module}
        modulTermine={modulTermine}
        onClose={() => setShowAssignModulModal(false)}
        onAssign={actions.assignModulToTermin}
      />

      <TerminDetailModal
        show={showTerminDetailModal}
        termin={selectedTermin}
        teilnehmer={teilnehmer}
        terminTeilnehmer={terminTeilnehmer}
        dokumente={dokumente}
        modulTermine={modulTermine}
        module={module}
        onClose={() => setShowTerminDetailModal(false)}
        onEdit={(t) => {
          openEditTermin(t)
          setShowTerminDetailModal(false)
        }}
        onDelete={actions.deleteTermin}
        onUploadDokument={openUploadDokument}
        onAddTeilnehmer={actions.addTeilnehmerToTermin}
        onUpdateStatus={actions.updateTeilnehmerStatus}
        onToggleAnwesenheit={actions.toggleAnwesenheit}
        onRemoveTeilnehmer={actions.removeTeilnehmerFromTermin}
        onDeleteDokument={actions.deleteDokument}
        onRemoveModul={actions.removeModulFromTermin}
        onAssignModul={() => setShowAssignModulModal(true)}
      />

      <TeilnehmerDetailModal
        show={showTeilnehmerDetailModal}
        teilnehmer={selectedTeilnehmer}
        termine={termine}
        terminTeilnehmer={terminTeilnehmer}
        modulProgress={modulProgress}
        module={module}
        onClose={() => setShowTeilnehmerDetailModal(false)}
        onEdit={(t) => {
          openEditTeilnehmer(t)
          setShowTeilnehmerDetailModal(false)
        }}
        onDelete={actions.deleteTeilnehmer}
        onToggleLernbar={actions.toggleLernbarZugang}
        onPasswordCopy={(pw) => {
          navigator.clipboard.writeText(pw)
          showMessage('Passwort kopiert', 'success')
        }}
      />

      <AddModulModal
        show={showAddModulModal}
        modulForm={modulForm}
        onClose={() => setShowAddModulModal(false)}
        onSave={() => {
          actions.saveModul(modulForm)
          setShowAddModulModal(false)
        }}
        onFormChange={setModulForm}
        onAddInhalt={addModulInhalt}
        onRemoveInhalt={removeModulInhalt}
        onUpdateInhalt={updateModulInhalt}
      />
    </div>
  )
}

export default Ausbildungen
