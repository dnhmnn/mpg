import React from 'react'
import { Termin } from '../../types/ausbildungen.types'

interface Props {
  show: boolean
  selectedTermin: Termin | null
  uploadFile: File | null
  uploadTyp: 'dozent' | 'teilnehmer'
  uploadBeschreibung: string
  onClose: () => void
  onUpload: () => void
  onFileChange: (file: File | null) => void
  onTypChange: (typ: 'dozent' | 'teilnehmer') => void
  onBeschreibungChange: (text: string) => void
}

export default function UploadDokumentModal({ 
  show,
  selectedTermin,
  uploadFile,
  uploadTyp,
  uploadBeschreibung,
  onClose,
  onUpload,
  onFileChange,
  onTypChange,
  onBeschreibungChange
}: Props) {
  if (!show || !selectedTermin) return null

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Dokument hochladen</h3>
        <div className="upload-termin-info">
          Termin: <strong>{selectedTermin.name}</strong>
        </div>
        
        <div className="field">
          <label>Typ *</label>
          <select 
            value={uploadTyp}
            onChange={(e) => onTypChange(e.target.value as any)}
          >
            <option value="teilnehmer">Teilnehmer-Material (in Lernbar sichtbar)</option>
            <option value="dozent">Dozenten-Material (nur für Dozenten)</option>
          </select>
        </div>
        
        <div className="field">
          <label>Datei *</label>
          <input
            type="file"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            className="file-input"
          />
          {uploadFile && (
            <div className="file-preview">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
              {uploadFile.name}
            </div>
          )}
        </div>
        
        <div className="field">
          <label>Beschreibung</label>
          <textarea
            value={uploadBeschreibung}
            onChange={(e) => onBeschreibungChange(e.target.value)}
            rows={3}
            placeholder="Optional: Was enthält dieses Dokument?"
          />
        </div>
        
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn primary" onClick={onUpload}>
            Hochladen
          </button>
        </div>
      </div>
    </div>
  )
}
