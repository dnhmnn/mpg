import React from 'react'
import { Termin, Modul, ModulTermin } from '../../types/ausbildungen.types'

interface Props {
  show: boolean
  selectedTermin: Termin | null
  module: Modul[]
  modulTermine: ModulTermin[]
  onClose: () => void
  onAssign: (modulId: string, terminId: string, pflicht: boolean, frist?: string) => void
}

export default function AssignModulModal({ 
  show,
  selectedTermin,
  module,
  modulTermine,
  onClose,
  onAssign
}: Props) {
  if (!show || !selectedTermin) return null

  const assignedModulIds = modulTermine
    .filter(mt => mt.termin_id === selectedTermin.id)
    .map(mt => mt.modul_id)

  const availableModule = module.filter(m => !assignedModulIds.includes(m.id))

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Modul zuordnen</h3>
        <div className="upload-termin-info">
          Termin: <strong>{selectedTermin.name}</strong>
        </div>
        
        <div className="field">
          <label>Modul auswählen *</label>
          <select 
            id="assign-modul-select"
            defaultValue=""
          >
            <option value="">Modul wählen...</option>
            {availableModule.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.dauer_minuten} Min.)
              </option>
            ))}
          </select>
        </div>
        
        <div className="field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              id="assign-pflicht"
              defaultChecked={true}
            />
            <span>Pflichtmodul</span>
          </label>
        </div>
        
        <div className="field">
          <label>Frist (optional)</label>
          <input
            type="date"
            id="assign-frist"
            className="date-input"
          />
        </div>
        
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button 
            className="btn primary" 
            onClick={() => {
              const modulSelect = document.getElementById('assign-modul-select') as HTMLSelectElement
              const pflichtCheckbox = document.getElementById('assign-pflicht') as HTMLInputElement
              const fristInput = document.getElementById('assign-frist') as HTMLInputElement
              
              if (modulSelect.value) {
                onAssign(
                  modulSelect.value,
                  selectedTermin.id,
                  pflichtCheckbox.checked,
                  fristInput.value
                )
                onClose()
              } else {
                alert('Bitte Modul auswählen')
              }
            }}
          >
            Zuordnen
          </button>
        </div>
      </div>
    </div>
  )
}
