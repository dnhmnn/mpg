import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as types from './types/ausbildungen.types'
import * as helpers from './utils/helpers'
import { useAusbildungenData } from './hooks/useAusbildungenData'
import { useAusbildungenActions } from './hooks/useAusbildungenActions'

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
    loading
  } = useAusbildungenData(user?.organization_id)

  const [viewMode, setViewMode] = useState<types.ViewMode>('termine')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<types.StatusFilter>('all')

  const stats = helpers.calculateStats(termine, teilnehmer, module)
  const filteredTermine = helpers.filterTermine(termine, searchQuery, statusFilter)
  const filteredTeilnehmer = helpers.filterTeilnehmer(teilnehmer, searchQuery)
  const filteredModule = helpers.filterModule(module, searchQuery)

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
      <div className="page-header">
        <h1>Ausbildungen</h1>
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

      <p style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        Basis-Version läuft ✅<br/>
        {termine.length} Termine • {teilnehmer.length} Teilnehmer • {module.length} Module geladen
      </p>
    </div>
  )
}

export default Ausbildungen
