import React, { useState } from 'react'
import PocketBase from 'pocketbase'
import { Termin, Teilnehmer, TerminTeilnehmer, Dokument, ModulTermin, Modul, TerminTab } from '../../types/ausbildungen.types'
import { createEinladungEmail, createWhatsAppMessage } from '../../utils/helpers'

const pb = new PocketBase('https://api.responda.systems')

interface Props {
  show: boolean
  termin: Termin | null
  teilnehmer: Teilnehmer[]
  terminTeilnehmer: TerminTeilnehmer[]
  dokumente: Dokument[]
  modulTermine: ModulTermin[]
  module: Modul[]
  onClose: () => void
  onEdit: (termin: Termin) => void
  onDelete: (id: string, name: string) => void
  onUploadDokument: (termin: Termin) => void
  onAddTeilnehmer: (terminId: string, teilnehmerId: string, via: 'email' | 'whatsapp' | 'persönlich' | 'telefon') => void
  onUpdateStatus: (ttId: string, status: 'eingeladen' | 'zugesagt' | 'abgesagt' | 'entschuldigt') => void
  onToggleAnwesenheit: (ttId: string, current: boolean) => void
  onRemoveTeilnehmer: (ttId: string) => void
  onDeleteDokument: (id: string, name: string) => void
  onRemoveModul: (mtId: string) => void
  onAssignModul: () => void
}

export default function TerminDetailModal({
  show,
  termin,
  teilnehmer,
  terminTeilnehmer,
  dokumente,
  modulTermine,
  module,
  onClose,
  onEdit,
  onDelete,
  onUploadDokument,
  onAddTeilnehmer,
  onUpdateStatus,
  onToggleAnwesenheit,
  onRemoveTeilnehmer,
  onDeleteDokument,
  onRemoveModul,
  onAssignModul
}: Props) {
  const [currentTab, setCurrentTab] = useState<TerminTab>('uebersicht')

  if (!show || !termin) return null

  const terminTeilnehmerList = terminTeilnehmer.filter(tt => tt.termin_id === termin.id)
  const terminDokumente = dokumente.filter(d => d.termin_id === termin.id)
  const terminModule = modulTermine.filter(mt => mt.termin_id === termin.id)

  const sendEinladungEmail = (t: Teilnehmer) => {
    window.open(createEinladungEmail(termin, t))
  }

  const sendEinladungWhatsApp = (t: Teilnehmer) => {
    const url = createWhatsAppMessage(termin, t)
    if (!url) {
      alert('Keine WhatsApp/Telefonnummer vorhanden')
      return
    }
    window.open(url)
  }

  const getDokumentURL = (dokument: Dokument): string => {
    if (!dokument.datei) return ''
    return pb.files.getUrl(dokument as any, dokument.datei)
  }

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content xlarge" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{termin.name}</h3>
            <div className="termin-detail-meta">
              {new Date(termin.start_datetime).toLocaleString('de-DE')} - {new Date(termin.end_datetime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              {termin.location && ` • ${termin.location}`}
            </div>
          </div>
          <button 
            className="btn"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(termin)
            }}
          >
            Bearbeiten
          </button>
        </div>
        
        {/* TABS */}
        <div className="detail-tabs">
          <button 
            className={`detail-tab ${currentTab === 'uebersicht' ? 'active' : ''}`}
            onClick={() => setCurrentTab('uebersicht')}
          >
            Übersicht
          </button>
          <button 
            className={`detail-tab ${currentTab === 'teilnehmer' ? 'active' : ''}`}
            onClick={() => setCurrentTab('teilnehmer')}
          >
            Teilnehmer ({terminTeilnehmerList.length})
          </button>
          <button 
            className={`detail-tab ${currentTab === 'dokumente' ? 'active' : ''}`}
            onClick={() => setCurrentTab('dokumente')}
          >
            Dokumente ({terminDokumente.length})
          </button>
          <button 
            className={`detail-tab ${currentTab === 'module' ? 'active' : ''}`}
            onClick={() => setCurrentTab('module')}
          >
            Module ({terminModule.length})
          </button>
        </div>
        
        <div className="detail-content">
          {/* ÜBERSICHT TAB */}
          {currentTab === 'uebersicht' && (
            <div className="uebersicht-content">
              {termin.description && (
                <div className="info-section">
                  <h4>Beschreibung</h4>
                  <div className="description-text" dangerouslySetInnerHTML={{ __html: termin.description }} />
                </div>
              )}
              
              <div className="info-section">
                <h4>Details</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-label">Dozent</div>
                    <div className="info-value">{termin.dozent || '-'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Max. Teilnehmer</div>
                    <div className="info-value">{termin.max_teilnehmer}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Status</div>
                    <div className="info-value">
                      <span className={`status-pill ${termin.status}`}>
                        {termin.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="info-section">
                <h4>Teilnehmer-Status</h4>
                <div className="status-overview">
                  <div className="status-count">
                    <div className="count-number">{terminTeilnehmerList.filter(t => t.status === 'eingeladen').length}</div>
                    <div className="count-label">Eingeladen</div>
                  </div>
                  <div className="status-count success">
                    <div className="count-number">{terminTeilnehmerList.filter(t => t.status === 'zugesagt').length}</div>
                    <div className="count-label">Zugesagt</div>
                  </div>
                  <div className="status-count danger">
                    <div className="count-number">{terminTeilnehmerList.filter(t => t.status === 'abgesagt').length}</div>
                    <div className="count-label">Abgesagt</div>
                  </div>
                  <div className="status-count warning">
                    <div className="count-number">{terminTeilnehmerList.filter(t => t.status === 'entschuldigt').length}</div>
                    <div className="count-label">Entschuldigt</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* TEILNEHMER TAB */}
          {currentTab === 'teilnehmer' && (
            <div className="teilnehmer-content">
              <div className="content-header">
                <h4>Teilnehmerverwaltung</h4>
                <div className="header-actions">
                  <select 
                    className="select-compact"
                    onChange={(e) => {
                      if (e.target.value) {
                        onAddTeilnehmer(termin.id, e.target.value, 'persönlich')
                        e.target.value = ''
                      }
                    }}
                  >
                    <option value="">+ Teilnehmer hinzufügen</option>
                    {teilnehmer
                      .filter(t => !terminTeilnehmerList.find(tt => tt.teilnehmer_id === t.id))
                      .map(t => (
                        <option key={t.id} value={t.id}>
                          {t.vorname} {t.nachname}
                        </option>
                      ))
                    }
                  </select>
                </div>
              </div>
              
              {terminTeilnehmerList.length === 0 ? (
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
                      {terminTeilnehmerList.map(tt => {
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
                                onChange={(e) => onUpdateStatus(tt.id, e.target.value as any)}
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
                                onChange={() => onToggleAnwesenheit(tt.id, tt.anwesend)}
                                className="anwesenheit-checkbox"
                              />
                            </td>
                            <td>
                              <div className="table-actions">
                                <button
                                  className="btn-icon-small"
                                  onClick={() => sendEinladungEmail(t)}
                                  title="Email senden"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                    <polyline points="22,6 12,13 2,6"/>
                                  </svg>
                                </button>
                                <button
                                  className="btn-icon-small"
                                  onClick={() => sendEinladungWhatsApp(t)}
                                  title="WhatsApp senden"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                                  </svg>
                                </button>
                                <button
                                  className="btn-icon-small danger"
                                  onClick={() => onRemoveTeilnehmer(tt.id)}
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
          {currentTab === 'dokumente' && (
            <div className="dokumente-content">
              <div className="content-header">
                <h4>Dokumente & Material</h4>
                <button 
                  className="btn primary"
                  onClick={() => onUploadDokument(termin)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Hochladen
                </button>
              </div>
              
              {terminDokumente.length === 0 ? (
                <div className="empty-state-small">Noch keine Dokumente hochgeladen</div>
              ) : (
                <div className="dokumente-sections">
                  {/* DOZENTEN-MATERIAL */}
                  <div className="dokument-section">
                    <h5>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      Dozenten-Material
                    </h5>
                    <div className="dokumente-list">
                      {terminDokumente
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
                                onClick={() => onDeleteDokument(dok.id, dok.name)}
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
                      {terminDokumente.filter(d => d.typ === 'dozent').length === 0 && (
                        <div className="empty-hint">Keine Dozenten-Materialien</div>
                      )}
                    </div>
                  </div>
                  
                  {/* TEILNEHMER-MATERIAL */}
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
                      {terminDokumente
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
                                onClick={() => onDeleteDokument(dok.id, dok.name)}
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
                      {terminDokumente.filter(d => d.typ === 'teilnehmer').length === 0 && (
                        <div className="empty-hint">Keine Teilnehmer-Materialien</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* MODULE TAB */}
          {currentTab === 'module' && (
            <div className="module-content">
              <div className="content-header">
                <h4>Zugeordnete Module</h4>
                <select 
                  className="select-compact"
                  onChange={(e) => {
                    if (e.target.value) {
                      onAssignModul()
                    }
                  }}
                >
                  <option value="">+ Modul zuordnen</option>
                  {module
                    .filter(m => !terminModule.find(mt => mt.modul_id === m.id))
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))
                  }
                </select>
              </div>
              
              {terminModule.length === 0 ? (
                <div className="empty-state-small">Noch keine Module zugeordnet</div>
              ) : (
                <div className="assigned-module-list">
                  {terminModule.map(mt => {
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
                          onClick={() => onRemoveModul(mt.id)}
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
          <button className="btn danger" onClick={() => onDelete(termin.id, termin.name)}>
            Termin löschen
          </button>
          <button className="btn" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}
