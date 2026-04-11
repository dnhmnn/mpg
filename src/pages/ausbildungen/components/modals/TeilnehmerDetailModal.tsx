import React from 'react'
import { Teilnehmer, TerminTeilnehmer, Termin, ModulProgress, Modul } from '../../types/ausbildungen.types'

interface Props {
  show: boolean
  teilnehmer: Teilnehmer | null
  termine: Termin[]
  terminTeilnehmer: TerminTeilnehmer[]
  modulProgress: ModulProgress[]
  module: Modul[]
  onClose: () => void
  onEdit: (teilnehmer: Teilnehmer) => void
  onDelete: (id: string, name: string) => void
  onToggleLernbar: (teilnehmerId: string, currentStatus: boolean, email: string, lernbarEmail?: string) => void
  onPasswordCopy: (password: string) => void
}

export default function TeilnehmerDetailModal({
  show,
  teilnehmer,
  termine,
  terminTeilnehmer,
  modulProgress,
  module,
  onClose,
  onEdit,
  onDelete,
  onToggleLernbar,
  onPasswordCopy
}: Props) {
  if (!show || !teilnehmer) return null

  const teilnehmerTermine = terminTeilnehmer.filter(tt => tt.teilnehmer_id === teilnehmer.id)
  const teilnehmerProgress = modulProgress.filter(mp => mp.teilnehmer_id === teilnehmer.id)

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{teilnehmer.vorname} {teilnehmer.nachname}</h3>
            <div className="teilnehmer-detail-meta">
              {teilnehmer.email}
              {teilnehmer.telefon && ` • ${teilnehmer.telefon}`}
            </div>
          </div>
          <button 
            className="btn"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(teilnehmer)
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
                    checked={teilnehmer.lernbar_zugang_aktiv}
                    onChange={() => onToggleLernbar(
                      teilnehmer.id,
                      teilnehmer.lernbar_zugang_aktiv,
                      teilnehmer.email,
                      teilnehmer.lernbar_email
                    )}
                  />
                  <span className="slider"></span>
                </label>
                <span className="toggle-label">
                  {teilnehmer.lernbar_zugang_aktiv ? 'Zugang aktiv' : 'Zugang inaktiv'}
                </span>
              </div>
              
              {teilnehmer.lernbar_zugang_aktiv && teilnehmer.lernbar_email && (
                <div className="lernbar-credentials">
                  <div className="credential-row">
                    <div className="credential-label">E-Mail:</div>
                    <div className="credential-value">{teilnehmer.lernbar_email}</div>
                  </div>
                  <div className="credential-row">
                    <div className="credential-label">Passwort:</div>
                    <div className="credential-value">
                      <code>{teilnehmer.lernbar_passwort}</code>
                      <button
                        className="btn-icon-small"
                        onClick={() => onPasswordCopy(teilnehmer.lernbar_passwort)}
                        title="Kopieren"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* TERMINE */}
          <div className="info-section">
            <h4>Termine ({teilnehmerTermine.length})</h4>
            {teilnehmerTermine.length === 0 ? (
              <div className="empty-hint">Noch keinen Terminen zugeordnet</div>
            ) : (
              <div className="termine-list-compact">
                {teilnehmerTermine.map(tt => {
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
            {teilnehmerProgress.length === 0 ? (
              <div className="empty-hint">Noch keine Module bearbeitet</div>
            ) : (
              <div className="progress-list">
                {teilnehmerProgress.map(mp => {
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
          {teilnehmer.notizen && (
            <div className="info-section">
              <h4>Notizen</h4>
              <div className="notizen-text">{teilnehmer.notizen}</div>
            </div>
          )}
        </div>
        
        <div className="modal-actions">
          <button 
            className="btn danger" 
            onClick={() => onDelete(teilnehmer.id, `${teilnehmer.vorname} ${teilnehmer.nachname}`)}
          >
            Teilnehmer löschen
          </button>
          <button className="btn" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}
