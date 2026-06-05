import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import { ORGPATIENTEN_SCHEMA, DEFAULT_FORM_CONFIG, type FormConfig, type CustomFieldDef, type SectionDef } from './public/formSchema'

type Tab = 'formulare' | 'editor'
type AddFieldType = 'text' | 'number' | 'date' | 'time' | 'select' | 'checkbox' | 'textarea'

const pik = (ch: React.ReactNode, sz = 18) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{ch}</svg>
)

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
        background: on ? '#600812' : 'rgba(96,8,18,0.12)', position: 'relative',
        transition: 'background .2s', flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

export default function Vorgaenge() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('formulare')
  const [cfg, setCfg] = useState<FormConfig>(DEFAULT_FORM_CONFIG)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [showAddField, setShowAddField] = useState<string | null>(null) // sectionId
  const [newField, setNewField] = useState<Partial<CustomFieldDef>>({ fieldType: 'text', required: false })
  const [newFieldOptions, setNewFieldOptions] = useState('')

  useEffect(() => {
    if (!user?.organization_id) return
    pb.collection('organizations').getOne(user.organization_id)
      .then(org => {
        setOrgId(org.id)
        setOrgName(org.org_name || '')
        if (org.form_config) {
          setCfg({ ...DEFAULT_FORM_CONFIG, ...(org.form_config as FormConfig) })
        }
      })
      .catch(() => {})
  }, [user?.organization_id])

  const save = useCallback(async (newCfg: FormConfig) => {
    if (!orgId) return
    setSaving(true)
    try {
      await pb.collection('organizations').update(orgId, { form_config: newCfg })
      setMsg('Gespeichert')
      setTimeout(() => setMsg(''), 2000)
    } catch {
      setMsg('Fehler beim Speichern')
      setTimeout(() => setMsg(''), 3000)
    } finally {
      setSaving(false)
    }
  }, [orgId])

  function toggleSection(sectionId: string, hide: boolean) {
    const next: FormConfig = {
      ...cfg,
      hidden_sections: hide
        ? [...cfg.hidden_sections, sectionId]
        : cfg.hidden_sections.filter(s => s !== sectionId),
    }
    setCfg(next)
    save(next)
  }

  function toggleField(fieldId: string, hide: boolean) {
    const next: FormConfig = {
      ...cfg,
      hidden_fields: hide
        ? [...cfg.hidden_fields, fieldId]
        : cfg.hidden_fields.filter(f => f !== fieldId),
    }
    setCfg(next)
    save(next)
  }

  function toggleRequired(fieldId: string, required: boolean) {
    const next: FormConfig = {
      ...cfg,
      required_fields: required
        ? [...cfg.required_fields, fieldId]
        : cfg.required_fields.filter(f => f !== fieldId),
    }
    setCfg(next)
    save(next)
  }

  function addCustomField(sectionId: string) {
    if (!newField.label?.trim()) return
    const field: CustomFieldDef = {
      id: 'custom_' + Date.now(),
      sectionId,
      label: newField.label.trim(),
      fieldType: newField.fieldType ?? 'text',
      options: newField.fieldType === 'select' ? newFieldOptions.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
      required: newField.required ?? false,
    }
    const next: FormConfig = { ...cfg, custom_fields: [...cfg.custom_fields, field] }
    setCfg(next)
    save(next)
    setShowAddField(null)
    setNewField({ fieldType: 'text', required: false })
    setNewFieldOptions('')
  }

  function deleteCustomField(fieldId: string) {
    const next: FormConfig = { ...cfg, custom_fields: cfg.custom_fields.filter(f => f.id !== fieldId) }
    setCfg(next)
    save(next)
  }

  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>

      {/* Header */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', padding: 'calc(env(safe-area-inset-top) + 14px) 20px 14px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => navigate('/hub')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#600812', display: 'flex' }}>
          {pik(<><polyline points="15 18 9 12 15 6"/></>)}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>Vorgänge</div>
          <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>{today}</div>
        </div>
        {saving && <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Speichern…</div>}
        {msg && <div style={{ fontSize: 11, color: msg.startsWith('Fehler') ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{msg}</div>}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.08)' }}>
        {([['formulare', 'Formulare'], ['editor', 'Konfigurieren']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '12px 8px 10px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
            color: tab === t ? '#600812' : 'var(--warm-gray)', fontFamily: 'inherit',
            borderTop: tab === t ? '2px solid #600812' : '2px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto' }}>

        {tab === 'formulare' && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>Verfügbare Formulare</div>
            {/* Notaufnahme-Protokoll card */}
            <div
              onClick={() => setTab('editor')}
              style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid #600812', padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(96,8,18,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#600812', flexShrink: 0 }}>
                {pik(<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></>)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>Notaufnahme-Protokoll</div>
                <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                  {cfg.hidden_sections.length > 0 || cfg.hidden_fields.length > 0 || cfg.custom_fields.length > 0
                    ? `${cfg.hidden_sections.length} Abschnitte ausgeblendet · ${cfg.hidden_fields.length} Felder · ${cfg.custom_fields.length} eigene`
                    : 'Standard-Konfiguration'}
                </div>
              </div>
              {pik(<polyline points="9 18 15 12 9 6"/>, 16)}
            </div>

            <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(96,8,18,0.04)', borderRadius: 10, border: '0.5px solid rgba(96,8,18,0.1)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Info</div>
              <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
                Konfigurationen gelten für alle Einsatzkräfte deiner Organisation <span style={{ fontStyle: 'italic', fontWeight: 700, color: 'var(--lbf-text)' }}>{orgName}</span> und werden sofort beim Öffnen des Formulars angewendet.
              </div>
            </div>
          </>
        )}

        {tab === 'editor' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Notaufnahme-Protokoll</div>
              <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>{ORGPATIENTEN_SCHEMA.length} Abschnitte</div>
            </div>

            {ORGPATIENTEN_SCHEMA.map((section: SectionDef) => {
              const isHidden = cfg.hidden_sections.includes(section.id)
              const isExpanded = expandedSection === section.id
              const customFields = cfg.custom_fields.filter(f => f.sectionId === section.id)
              const totalFields = section.fields.length + customFields.length

              return (
                <div key={section.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${isHidden ? 'rgba(139,113,90,0.35)' : '#600812'}`, marginBottom: 10, overflow: 'hidden' }}>
                  {/* Section header row */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                      style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit' }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 14, color: isHidden ? 'var(--warm-gray)' : 'var(--lbf-text)', fontStyle: isHidden ? 'italic' : 'normal' }}>
                        {section.title}
                      </span>
                      {totalFields > 0 && !isHidden && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#600812', background: 'rgba(96,8,18,0.07)', borderRadius: 99, padding: '1px 7px' }}>{totalFields}</span>
                      )}
                      {isHidden && <span style={{ fontSize: 10, color: 'var(--warm-gray)', fontStyle: 'italic' }}>ausgeblendet</span>}
                      <span style={{ marginLeft: 'auto', color: 'var(--warm-gray)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
                        {pik(<polyline points="9 18 15 12 9 6"/>, 14)}
                      </span>
                    </button>
                    {section.canHide && (
                      <Toggle on={!isHidden} onChange={v => toggleSection(section.id, !v)} />
                    )}
                  </div>

                  {/* Expanded field list */}
                  {isExpanded && !isHidden && (
                    <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'rgba(250,249,247,0.5)' }}>

                      {section.fields.length === 0 && customFields.length === 0 && (
                        <div style={{ padding: '12px 14px', fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
                          Dieser Abschnitt hat keine einzeln konfigurierbaren Felder.
                        </div>
                      )}

                      {section.fields.map(field => {
                        const isFieldHidden = cfg.hidden_fields.includes(field.id)
                        const isRequired = cfg.required_fields.includes(field.id)
                        return (
                          <div key={field.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 10, borderBottom: '0.5px solid rgba(96,8,18,0.05)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: isFieldHidden ? 'var(--warm-gray)' : 'var(--lbf-text)', fontStyle: isFieldHidden ? 'italic' : 'normal' }}>{field.label}</div>
                              {field.canRequire && !isFieldHidden && (
                                <button
                                  type="button"
                                  onClick={() => toggleRequired(field.id, !isRequired)}
                                  style={{ marginTop: 3, fontSize: 10, fontWeight: 700, background: isRequired ? 'rgba(96,8,18,0.08)' : 'none', color: isRequired ? '#600812' : 'var(--warm-gray)', border: isRequired ? '0.5px solid rgba(96,8,18,0.2)' : '0.5px dashed rgba(96,8,18,0.2)', borderRadius: 99, padding: '1px 8px', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                                >
                                  {isRequired ? 'Pflichtfeld' : 'Optional'}
                                </button>
                              )}
                            </div>
                            {field.canHide && <Toggle on={!isFieldHidden} onChange={v => toggleField(field.id, !v)} />}
                          </div>
                        )
                      })}

                      {/* Custom fields */}
                      {customFields.map(cf => (
                        <div key={cf.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 10, borderBottom: '0.5px solid rgba(96,8,18,0.05)', background: 'rgba(96,8,18,0.02)' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lbf-text)' }}>{cf.label}</div>
                            <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 2 }}>
                              {cf.fieldType}{cf.required ? ' · Pflichtfeld' : ''}{cf.options?.length ? ` · ${cf.options.length} Optionen` : ''}
                            </div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#600812', background: 'rgba(96,8,18,0.07)', borderRadius: 99, padding: '2px 8px' }}>Eigenes Feld</span>
                          <button
                            type="button"
                            onClick={() => deleteCustomField(cf.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px 4px', display: 'flex' }}
                          >
                            {pik(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>, 14)}
                          </button>
                        </div>
                      ))}

                      {/* Add custom field button */}
                      <button
                        type="button"
                        onClick={() => { setShowAddField(section.id); setNewField({ fieldType: 'text', required: false }); setNewFieldOptions('') }}
                        style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderTop: '0.5px dashed rgba(96,8,18,0.15)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#600812', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        {pik(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>, 14)}
                        Eigenes Feld hinzufügen
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Add custom field bottom sheet */}
      {showAddField && (
        <>
          <div onClick={() => setShowAddField(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(96,8,18,0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>
              {ORGPATIENTEN_SCHEMA.find(s => s.id === showAddField)?.title}
            </div>
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 20 }}>Eigenes Feld</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#600812' }}>Feldbezeichnung *</span>
                <input
                  type="text"
                  placeholder="z.B. Fahrerausweis-Nr."
                  value={newField.label || ''}
                  onChange={e => setNewField(p => ({ ...p, label: e.target.value }))}
                  style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#600812' }}>Feldtyp</span>
                <select
                  value={newField.fieldType}
                  onChange={e => setNewField(p => ({ ...p, fieldType: e.target.value as AddFieldType }))}
                  style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }}
                >
                  <option value="text">Text</option>
                  <option value="number">Zahl</option>
                  <option value="date">Datum</option>
                  <option value="time">Uhrzeit</option>
                  <option value="textarea">Freitext (mehrzeilig)</option>
                  <option value="select">Auswahl (Dropdown)</option>
                  <option value="checkbox">Checkbox (Ja/Nein)</option>
                </select>
              </label>

              {newField.fieldType === 'select' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#600812' }}>Optionen (eine pro Zeile)</span>
                  <textarea
                    value={newFieldOptions}
                    onChange={e => setNewFieldOptions(e.target.value)}
                    placeholder={'Option 1\nOption 2\nOption 3'}
                    rows={4}
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
                  />
                </label>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <Toggle on={newField.required ?? false} onChange={v => setNewField(p => ({ ...p, required: v }))} />
                <span style={{ fontSize: 14, color: 'var(--lbf-text)', fontWeight: 600 }}>Pflichtfeld</span>
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowAddField(null)}
                  style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={() => addCustomField(showAddField)}
                  disabled={!newField.label?.trim()}
                  style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: !newField.label?.trim() ? 'rgba(96,8,18,0.3)' : '#600812', fontSize: 15, fontWeight: 700, color: '#fff', cursor: !newField.label?.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >
                  Hinzufügen
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
