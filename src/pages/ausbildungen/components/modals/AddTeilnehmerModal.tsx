import React from 'react'
import { TeilnehmerForm } from '../../types/ausbildungen.types'

interface Props {
  show: boolean
  teilnehmerForm: TeilnehmerForm
  onClose: () => void
  onSave: () => void
  onFormChange: (form: TeilnehmerForm) => void
}

export default function AddTeilnehmerModal({ 
  show, 
  teilnehmerForm, 
  onClose, 
  onSave,
  onFormChange
}: Props) {
  if (!show) return null

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{teilnehmerForm.id ? 'Teilnehmer bearbeiten' : 'Teilnehmer hinzufügen'}</h3>
        
        <div className="field-row">
          <div className="field">
            <label>Vorname *</label>
            <input
              type="text"
              value={teilnehmerForm.vorname}
              onChange={(e) => onFormChange({ ...teilnehmerForm, vorname: e.target.value })}
              placeholder="Max"
              autoFocus
            />
          </div>
          
          <div className="field">
            <label>Nachname *</label>
            <input
              type="text"
              value={teilnehmerForm.nachname}
              onChange={(e) => onFormChange({ ...teilnehmerForm, nachname: e.target.value })}
              placeholder="Mustermann"
            />
          </div>
        </div>
        
        <div className="field">
          <label>E-Mail *</label>
          <input
            type="email"
            value={teilnehmerForm.email}
            onChange={(e) => onFormChange({ ...teilnehmerForm, email: e.target.value })}
            placeholder="max@example.com"
          />
        </div>
        
        <div className="field-row">
          <div className="field">
            <label>Telefon</label>
            <input
              type="tel"
              value={teilnehmerForm.telefon}
              onChange={(e) => onFormChange({ ...teilnehmerForm, telefon: e.target.value })}
              placeholder="+49 123 456789"
            />
          </div>
          
          <div className="field">
            <label>WhatsApp</label>
            <input
              type="tel"
              value={teilnehmerForm.whatsapp}
              onChange={(e) => onFormChange({ ...teilnehmerForm, whatsapp: e.target.value })}
              placeholder="+49 123 456789"
            />
          </div>
        </div>
        
        <div className="field">
          <label>Notizen</label>
          <textarea
            value={teilnehmerForm.notizen}
            onChange={(e) => onFormChange({ ...teilnehmerForm, notizen: e.target.value })}
            rows={3}
            placeholder="Zusätzliche Informationen..."
          />
        </div>
        
        <div className="field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={teilnehmerForm.lernbar_zugang_aktiv}
              onChange={(e) => onFormChange({ ...teilnehmerForm, lernbar_zugang_aktiv: e.target.checked })}
            />
            <span>Lernbar-Zugang aktivieren</span>
          </label>
          <div className="field-hint">
            Teilnehmer erhält Zugang zur Lernbar (nur Module, keine Systemfunktionen)
          </div>
        </div>
        
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn primary" onClick={onSave}>
            {teilnehmerForm.id ? 'Speichern' : 'Hinzufügen'}
          </button>
        </div>
      </div>
    </div>
  )
}
