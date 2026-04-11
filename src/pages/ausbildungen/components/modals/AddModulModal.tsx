import React from 'react'
import { ModulForm, ModulInhalt } from '../../types/ausbildungen.types'

interface Props {
  show: boolean
  modulForm: ModulForm
  onClose: () => void
  onSave: () => void
  onFormChange: (form: ModulForm) => void
  onAddInhalt: (typ: 'text' | 'video' | 'quiz' | 'datei') => void
  onRemoveInhalt: (index: number) => void
  onUpdateInhalt: (index: number, field: keyof ModulInhalt, value: any) => void
}

export default function AddModulModal({
  show,
  modulForm,
  onClose,
  onSave,
  onFormChange,
  onAddInhalt,
  onRemoveInhalt,
  onUpdateInhalt
}: Props) {
  if (!show) return null

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content xlarge" onClick={(e) => e.stopPropagation()}>
        <h3>{modulForm.id ? 'Modul bearbeiten' : 'Online-Modul erstellen'}</h3>
        
        <div className="field">
          <label>Modulname *</label>
          <input
            type="text"
            value={modulForm.name}
            onChange={(e) => onFormChange({ ...modulForm, name: e.target.value })}
            placeholder="z.B. Reanimation Grundlagen"
            autoFocus
          />
        </div>
        
        <div className="field">
          <label>Beschreibung</label>
          <textarea
            value={modulForm.beschreibung}
            onChange={(e) => onFormChange({ ...modulForm, beschreibung: e.target.value })}
            rows={3}
            placeholder="Was lernen die Teilnehmer in diesem Modul?"
          />
        </div>
        
        <div className="field">
          <label>Geschätzte Dauer (Minuten)</label>
          <input
            type="number"
            value={modulForm.dauer_minuten}
            onChange={(e) => onFormChange({ ...modulForm, dauer_minuten: parseInt(e.target.value) || 0 })}
            min="1"
          />
        </div>
        
        <div className="modul-inhalte-section">
          <div className="section-header">
            <h4>Lektionen</h4>
            <div className="add-lektion-buttons">
              <button 
                className="btn-small"
                onClick={() => onAddInhalt('text')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                Text
              </button>
              <button 
                className="btn-small"
                onClick={() => onAddInhalt('video')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7"/>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
                Video
              </button>
              <button 
                className="btn-small"
                onClick={() => onAddInhalt('quiz')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Quiz
              </button>
              <button 
                className="btn-small"
                onClick={() => onAddInhalt('datei')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                  <polyline points="13 2 13 9 20 9"/>
                </svg>
                Datei
              </button>
            </div>
          </div>
          
          {modulForm.inhalte.length === 0 ? (
            <div className="empty-hint">Noch keine Lektionen. Füge Text, Videos, Quiz oder Dateien hinzu.</div>
          ) : (
            <div className="inhalte-list">
              {modulForm.inhalte.map((inhalt, index) => (
                <div key={index} className="inhalt-item">
                  <div className="inhalt-header">
                    <div className="inhalt-typ-icon">
                      {inhalt.typ === 'text' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                      )}
                      {inhalt.typ === 'video' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="23 7 16 12 23 17 23 7"/>
                          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                        </svg>
                      )}
                      {inhalt.typ === 'quiz' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                      )}
                      {inhalt.typ === 'datei' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                          <polyline points="13 2 13 9 20 9"/>
                        </svg>
                      )}
                    </div>
                    <span className="inhalt-typ-label">{inhalt.typ}</span>
                    <button
                      className="btn-icon-small danger"
                      onClick={() => onRemoveInhalt(index)}
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
                      value={inhalt.titel}
                      onChange={(e) => onUpdateInhalt(index, 'titel', e.target.value)}
                      placeholder="Titel der Lektion"
                      className="inhalt-input"
                    />
                    <textarea
                      value={inhalt.inhalt}
                      onChange={(e) => onUpdateInhalt(index, 'inhalt', e.target.value)}
                      placeholder={
                        inhalt.typ === 'text' ? 'Text-Inhalt...' :
                        inhalt.typ === 'video' ? 'Video-URL (z.B. YouTube)' :
                        inhalt.typ === 'quiz' ? 'Quiz-Fragen als JSON' :
                        'Datei-URL oder Beschreibung'
                      }
                      rows={3}
                      className="inhalt-textarea"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn primary" onClick={onSave}>
            {modulForm.id ? 'Speichern' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}
