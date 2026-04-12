import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import StatusBar from '../../components/StatusBar'
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

function Ausbildungen() {
  const { user, logout } = useAuth()

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
    setTimeout(() => setMessage(null), 4000)
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
      <>
        <StatusBar user={user} onLogout={logout} pageName="Ausbildungen" showHubLink={true} />
        <div className="content">
          <div className="empty-state">Lade Ausbildungsdaten...</div>
        </div>
      </>
    )
  }

  return (
    <>
      <StatusBar user={user} onLogout={logout} pageName="Ausbildungen" showHubLink={true} />
      
      <div className="content">
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.termine_gesamt}</div>
            <div className="stat-label">Termine</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.termine_geplant}</div>
            <div className="stat-label">Geplant</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.teilnehmer_gesamt}</div>
            <div className="stat-label">Teilnehmer</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.module_gesamt}</div>
            <div className="stat-label">Module</div>
          </div>
        </div>

        <div className="view-tabs">
          <button
            className={`view-tab ${viewMode === 'termine' ? 'active' : ''}`}
            onClick={() => setViewMode('termine')}
          >
            Termine
          </button>
          <button
            className={`view-tab ${viewMode === 'teilnehmer' ? 'active' : ''}`}
            onClick={() => setViewMode('teilnehmer')}
          >
            Teilnehmer
          </button>
          <button
            className={`view-tab ${viewMode === 'module' ? 'active' : ''}`}
            onClick={() => setViewMode('module')}
          >
            Module
          </button>
        </div>

        <div className="actions-bar">
          <div className="search-box">
            <input
              type="text"
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {viewMode === 'termine' && (
            <>
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
              <button className="btn primary" onClick={openAddTermin}>
                Termin erstellen
              </button>
            </>
          )}

          {viewMode === 'teilnehmer' && (
            <button className="btn primary" onClick={openAddTeilnehmer}>
              Teilnehmer hinzufügen
            </button>
          )}

          {viewMode === 'module' && (
            <button className="btn primary" onClick={openAddModul}>
              Modul erstellen
            </button>
          )}
        </div>

        {viewMode === 'termine' && (
          <div className="termine-grid">
            {filteredTermine.length === 0 ? (
              <div className="empty-state">
                <div style={{fontSize: '48px', marginBottom: '16px', opacity: 0.3}}>📅</div>
                <div style={{fontWeight: 700, marginBottom: '8px'}}>Keine Termine</div>
                <div>Erstelle deinen ersten Ausbildungstermin</div>
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
                    <div className="termin-date">
                      <div className="date-day">
                        {new Date(termin.start_datetime).toLocaleDateString('de-DE', { day: '2-digit' })}
                      </div>
                      <div className="date-month">
                        {new Date(termin.start_datetime).toLocaleDateString('de-DE', { month: 'short' })}
                      </div>
                    </div>
                    <div className="termin-content">
                      <div className="termin-name">{termin.name}</div>
                      <div className="termin-meta">
                        {new Date(termin.start_datetime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        {termin.location && ` • ${termin.location}`}
                      </div>
                      <div className="termin-stats">
                        {ttList.length}/{termin.max_teilnehmer} Teilnehmer
                        {ttList.length > 0 && ` • ${anwesend} anwesend`}
                      </div>
                      <div className={`termin-status ${termin.status}`}>
                        {termin.status}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {viewMode === 'teilnehmer' && (
          <div className="teilnehmer-grid">
            {filteredTeilnehmer.length === 0 ? (
              <div className="empty-state">
                <div style={{fontSize: '48px', marginBottom: '16px', opacity: 0.3}}>👥</div>
                <div style={{fontWeight: 700, marginBottom: '8px'}}>Keine Teilnehmer</div>
                <div>Füge deinen ersten Teilnehmer hinzu</div>
              </div>
            ) : (
              filteredTeilnehmer.map(t => {
                const termine = helpers.getTeilnehmerTermine(t.id, terminTeilnehmer)

                return (
                  <div
                    key={t.id}
                    className="teilnehmer-card"
                    onClick={() => openTeilnehmerDetail(t)}
                  >
                    <div className="person-avatar">
                      {t.vorname.charAt(0)}{t.nachname.charAt(0)}
                    </div>
                    <div className="person-name">{t.vorname} {t.nachname}</div>
                    <div className="person-email">{t.email}</div>
                    <div className="person-stats">
                      {termine.length} Termine
                      {t.lernbar_zugang_aktiv && <span className="lernbar-badge">Lernbar</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {viewMode === 'module' && (
          <div className="module-grid">
            {filteredModule.length === 0 ? (
              <div className="empty-state">
                <div style={{fontSize: '48px', marginBottom: '16px', opacity: 0.3}}>📚</div>
                <div style={{fontWeight: 700, marginBottom: '8px'}}>Keine Module</div>
                <div>Erstelle dein erstes Online-Modul</div>
              </div>
            ) : (
              filteredModule.map(modul => {
                const zuordnungen = modulTermine.filter(mt => mt.modul_id === modul.id)

                return (
                  <div key={modul.id} className="modul-card">
                    <div className="modul-name">{modul.name}</div>
                    {modul.beschreibung && (
                      <div className="modul-description">{modul.beschreibung}</div>
                    )}
                    <div className="modul-meta">
                      {modul.dauer_minuten} Min • {modul.inhalte.length} Lektionen
                      {zuordnungen.length > 0 && ` • ${zuordnungen.length} Termine`}
                    </div>
                    <div className="modul-actions">
                      <button
                        className="btn-small"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditModul(modul)
                        }}
                      >
                        Bearbeiten
                      </button>
                      <button
                        className="btn-small danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          actions.deleteModul(modul.id, modul.name)
                        }}
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
      </div>

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

      <style>{`
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

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat-card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: transform 0.2s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
        }

        .stat-value {
          font-size: 32px;
          font-weight: 800;
          color: #b91c1c;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 14px;
          color: #64748b;
          font-weight: 600;
        }

        .view-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          padding: 8px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .view-tab {
          flex: 1;
          padding: 10px 16px;
          background: none;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          font-size: 14px;
          color: #64748b;
          transition: all 0.2s;
          font-family: inherit;
        }

        .view-tab:hover {
          background: rgba(185, 28, 28, 0.1);
          color: #b91c1c;
        }

        .view-tab.active {
          background: #b91c1c;
          color: #fff;
        }

        .actions-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .search-box {
          flex: 1;
          min-width: 200px;
        }

        .search-box input {
          width: 100%;
          padding: 10px 16px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          font-family: inherit;
        }

        .search-box input:focus {
          outline: none;
          border-color: #b91c1c;
          box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.1);
        }

        .filter-select {
          padding: 10px 16px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
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
          font-weight: 700;
          transition: all 0.2s;
          font-family: inherit;
          border: 1px solid rgba(0, 0, 0, 0.08);
          font-size: 12px;
        }

        .btn-small:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .btn-small.danger {
          color: #b91c1c;
        }

        .termine-grid,
        .teilnehmer-grid,
        .module-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 16px;
        }

        .termin-card,
        .teilnehmer-card,
        .modul-card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 12px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          border: 2px solid transparent;
        }

        .termin-card:hover,
        .teilnehmer-card:hover,
        .modul-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
          border-color: rgba(185, 28, 28, 0.2);
        }

        .termin-date {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          background: #b91c1c;
          color: #fff;
          padding: 8px 12px;
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .date-day {
          font-size: 24px;
          font-weight: 800;
          line-height: 1;
        }

        .date-month {
          font-size: 11px;
          text-transform: uppercase;
          opacity: 0.9;
        }

        .termin-name,
        .person-name,
        .modul-name {
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 8px;
          color: #1d1d1f;
        }

        .termin-meta,
        .person-email,
        .modul-meta {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 8px;
        }

        .termin-stats,
        .person-stats {
          font-size: 12px;
          color: #64748b;
          margin-top: 8px;
        }

        .termin-status {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          margin-top: 8px;
        }

        .termin-status.geplant {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .termin-status.laufend {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .termin-status.abgeschlossen {
          background: rgba(107, 114, 128, 0.1);
          color: #6b7280;
        }

        .person-avatar {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #b91c1c;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 18px;
          margin-bottom: 12px;
        }

        .lernbar-badge {
          display: inline-block;
          padding: 2px 8px;
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          margin-left: 8px;
        }

        .modul-description {
          font-size: 14px;
          color: #64748b;
          margin-bottom: 12px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .modul-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(0, 0, 0, 0.05);
        }

        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 48px 16px;
          color: #64748b;
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .actions-bar {
            flex-direction: column;
          }

          .search-box {
            width: 100%;
          }

          .termine-grid,
          .teilnehmer-grid,
          .module-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  )
}

export default Ausbildungen
