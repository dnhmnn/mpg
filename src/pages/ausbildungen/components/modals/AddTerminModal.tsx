import React from 'react'
import { TerminForm } from '../../types/ausbildungen.types'

interface Props {
  show: boolean
  terminForm: TerminForm
  onClose: () => void
  onSave: () => void
  onFormChange: (form: TerminForm) => void
}

export default function AddTerminModal({ 
  show, 
  terminForm, 
  onClose, 
  onSave,
  onFormChange
}: Props) {
  if (!show) return null

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <h3>{terminForm.id ? 'Termin bearbeiten' : 'Termin erstellen'}</h3>
        
        <div className="field">
          <label>Titel *</label>
          <input
            type="text"
            value={terminForm.name}
            onChange={(e) => onFormChange({ ...terminForm, name: e.target.value })}
            placeholder="z.B. Erste-Hilfe Grundkurs"
            autoFocus
          />
        </div>
        
        <div className="field">
          <label>Beschreibung</label>
          <textarea
            value={terminForm.description}
            onChange={(e) => onFormChange({ ...terminForm, description: e.target.value })}
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
              onChange={(e) => onFormChange({ ...terminForm, start_datetime: e.target.value })}
            />
          </div>
          
          <div className="field">
            <label>Ende *</label>
            <input
              type="datetime-local"
              value={terminForm.end_datetime}
              onChange={(e) => onFormChange({ ...terminForm, end_datetime: e.target.value })}
            />
          </div>
        </div>
        
        <div className="field">
          <label>Ort</label>
          <input
            type="text"
            value={terminForm.location}
            onChange={(e) => onFormChange({ ...terminForm, location: e.target.value })}
            placeholder="z.B. Schulungsraum 1"
          />
        </div>
        
        <div className="field">
          <label>Dozent</label>
          <input
            type="text"
            value={terminForm.dozent}
            onChange={(e) => onFormChange({ ...terminForm, dozent: e.target.value })}
            placeholder="z.B. Max Mustermann"
          />
        </div>
        
        <div className="field-row">
          <div className="field">
            <label>Max. Teilnehmer</label>
            <input
              type="number"
              value={terminForm.max_teilnehmer}
              onChange={(e) => onFormChange({ ...terminForm, max_teilnehmer: parseInt(e.target.value) || 0 })}
              min="1"
            />
          </div>
          
          <div className="field">
            <label>Status</label>
            <select 
              value={terminForm.status}
              onChange={(e) => onFormChange({ ...terminForm, status: e.target.value as any })}
            >
              <option value="geplant">Geplant</option>
              <option value="laufend">Laufend</option>
              <option value="abgeschlossen">Abgeschlossen</option>
              <option value="abgesagt">Abgesagt</option>
            </select>
          </div>
        </div>
        
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn primary" onClick={onSave}>
            {terminForm.id ? 'Speichern' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}
