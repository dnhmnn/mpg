import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import {
  ORGPATIENTEN_SCHEMA, DEFAULT_FORM_CONFIG,
  type FormConfig, type CustomFieldDef, type SectionDef,
  type TemplateFieldDef, type FormTemplate,
} from './public/formSchema'

type Tab = 'formulare' | 'editor'
type FType = 'text' | 'number' | 'date' | 'time' | 'select' | 'checkbox' | 'textarea'

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text', number: 'Zahl', date: 'Datum', time: 'Uhrzeit',
  textarea: 'Freitext', select: 'Auswahl', checkbox: 'Checkbox',
}

const STATIC_FORMS = [
  { id: 'patienten',     label: 'Patientendokumentation', desc: 'Notfalleinsatz dokumentieren', configurable: true  },
  { id: 'produktausgabe',label: 'Produktausgabe',         desc: 'Materialausgabe erfassen',     configurable: false },
  { id: 'cirs',          label: 'CIRS-Meldung',           desc: 'Kritisches Ereignis melden',  configurable: false },
]

const pik = (ch: React.ReactNode, sz = 18) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{ch}</svg>
)

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} style={{
      width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
      background: on ? '#600812' : 'rgba(96,8,18,0.12)', position: 'relative',
      transition: 'background .2s', flexShrink: 0, padding: 0,
    }}>
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

  // Org info
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [orgCode, setOrgCode] = useState('')

  // Form config (for Notaufnahme-Protokoll + hidden_forms)
  const [cfg, setCfg] = useState<FormConfig>(DEFAULT_FORM_CONFIG)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Nav
  const [tab, setTab] = useState<Tab>('formulare')

  // Notaufnahme editor state
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [showAddField, setShowAddField] = useState<string | null>(null)
  const [newField, setNewField] = useState<Partial<CustomFieldDef>>({ fieldType: 'text', required: false })
  const [newFieldOptions, setNewFieldOptions] = useState('')

  // Custom templates
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Template builder overlay
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null)
  const [tTitle, setTTitle] = useState('')
  const [tDesc, setTDesc] = useState('')
  const [tFields, setTFields] = useState<TemplateFieldDef[]>([])
  const [tSaving, setTSaving] = useState(false)

  // Add template field sheet
  const [showAddTField, setShowAddTField] = useState(false)
  const [newTField, setNewTField] = useState<Partial<TemplateFieldDef>>({ fieldType: 'text', required: false })
  const [newTFieldOptions, setNewTFieldOptions] = useState('')

  // Load org + templates
  useEffect(() => {
    if (!user?.organization_id) return
    pb.collection('organizations').getOne(user.organization_id)
      .then(org => {
        setOrgId(org.id)
        setOrgName(org.org_name || '')
        setOrgCode(org.org_code || '')
        if (org.form_config) {
          setCfg({ ...DEFAULT_FORM_CONFIG, ...(org.form_config as FormConfig) })
        }
      })
      .catch(() => {})
    loadTemplates()
  }, [user?.organization_id])

  async function loadTemplates() {
    if (!user?.organization_id) return
    setLoadingTemplates(true)
    try {
      const list = await pb.collection('form_templates').getFullList<FormTemplate>({
        filter: `organization_id = "${user.organization_id}"`,
        sort: '-created',
      })
      setTemplates(list)
    } catch { /* collection may not exist yet */ }
    finally { setLoadingTemplates(false) }
  }

  // ── Form config helpers ──────────────────────────────────────────────────

  const saveConfig = useCallback(async (newCfg: FormConfig) => {
    if (!orgId) return
    setSaving(true)
    try {
      await pb.collection('organizations').update(orgId, { form_config: newCfg })
      setMsg('Gespeichert')
      setTimeout(() => setMsg(''), 2000)
    } catch {
      setMsg('Fehler beim Speichern')
      setTimeout(() => setMsg(''), 3000)
    } finally { setSaving(false) }
  }, [orgId])

  function toggleHiddenForm(formId: string, hide: boolean) {
    const next: FormConfig = {
      ...cfg,
      hidden_forms: hide
        ? [...(cfg.hidden_forms || []), formId]
        : (cfg.hidden_forms || []).filter(f => f !== formId),
    }
    setCfg(next)
    saveConfig(next)
  }

  function toggleSection(sectionId: string, hide: boolean) {
    const next: FormConfig = { ...cfg, hidden_sections: hide ? [...cfg.hidden_sections, sectionId] : cfg.hidden_sections.filter(s => s !== sectionId) }
    setCfg(next); saveConfig(next)
  }

  function toggleField(fieldId: string, hide: boolean) {
    const next: FormConfig = { ...cfg, hidden_fields: hide ? [...cfg.hidden_fields, fieldId] : cfg.hidden_fields.filter(f => f !== fieldId) }
    setCfg(next); saveConfig(next)
  }

  function toggleRequired(fieldId: string, required: boolean) {
    const next: FormConfig = { ...cfg, required_fields: required ? [...cfg.required_fields, fieldId] : cfg.required_fields.filter(f => f !== fieldId) }
    setCfg(next); saveConfig(next)
  }

  function addCustomField(sectionId: string) {
    if (!newField.label?.trim()) return
    const field: CustomFieldDef = {
      id: 'custom_' + Date.now(), sectionId,
      label: newField.label.trim(), fieldType: newField.fieldType ?? 'text',
      options: newField.fieldType === 'select' ? newFieldOptions.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
      required: newField.required ?? false,
    }
    const next: FormConfig = { ...cfg, custom_fields: [...cfg.custom_fields, field] }
    setCfg(next); saveConfig(next)
    setShowAddField(null)
    setNewField({ fieldType: 'text', required: false })
    setNewFieldOptions('')
  }

  function deleteCustomField(fieldId: string) {
    const next: FormConfig = { ...cfg, custom_fields: cfg.custom_fields.filter(f => f.id !== fieldId) }
    setCfg(next); saveConfig(next)
  }

  // ── Template helpers ─────────────────────────────────────────────────────

  function openBuilder(template?: FormTemplate) {
    if (template) {
      setEditingTemplate(template)
      setTTitle(template.title)
      setTDesc(template.description || '')
      setTFields([...template.schema])
    } else {
      setEditingTemplate(null)
      setTTitle('')
      setTDesc('')
      setTFields([])
    }
    setBuilderOpen(true)
  }

  async function saveTemplate() {
    if (!tTitle.trim() || !user?.organization_id) return
    setTSaving(true)
    try {
      const data = {
        organization_id: user.organization_id,
        title: tTitle.trim(),
        description: tDesc.trim(),
        schema: tFields,
        is_active: true,
      }
      if (editingTemplate) {
        await pb.collection('form_templates').update(editingTemplate.id, data)
      } else {
        await pb.collection('form_templates').create(data)
      }
      await loadTemplates()
      setBuilderOpen(false)
    } catch (e: unknown) {
      setMsg('Fehler: ' + (e as Error).message)
      setTimeout(() => setMsg(''), 3000)
    } finally { setTSaving(false) }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Vorlage dauerhaft löschen?')) return
    try {
      await pb.collection('form_templates').delete(id)
      setTemplates(ts => ts.filter(t => t.id !== id))
    } catch { /* ignore */ }
  }

  async function toggleTemplateActive(template: FormTemplate) {
    try {
      await pb.collection('form_templates').update(template.id, { is_active: !template.is_active })
      setTemplates(ts => ts.map(t => t.id === template.id ? { ...t, is_active: !t.is_active } : t))
    } catch { /* ignore */ }
  }

  function addTemplateField() {
    if (!newTField.label?.trim()) return
    const field: TemplateFieldDef = {
      id: 'f_' + Date.now(),
      label: newTField.label.trim(),
      fieldType: newTField.fieldType ?? 'text',
      options: newTField.fieldType === 'select' ? newTFieldOptions.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
      required: newTField.required ?? false,
      hint: newTField.hint?.trim() || undefined,
    }
    setTFields(prev => [...prev, field])
    setShowAddTField(false)
    setNewTField({ fieldType: 'text', required: false })
    setNewTFieldOptions('')
  }

  function removeTemplateField(id: string) {
    setTFields(prev => prev.filter(f => f.id !== id))
  }

  function copyShareUrl(templateId: string) {
    const url = `https://app.responda.systems/${orgCode}/formular/${templateId}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiedId(templateId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  // ── Template builder overlay ─────────────────────────────────────────────

  const builderOverlay = builderOpen && (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--warm-bg)', zIndex: 300, overflowY: 'auto', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>

      {/* Header */}
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid rgba(96,8,18,0.12)', padding: 'calc(env(safe-area-inset-top) + 14px) 20px 14px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => setBuilderOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#600812', display: 'flex' }}>
          {pik(<><polyline points="15 18 9 12 15 6"/></>)}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>{editingTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</div>
          <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>{tFields.length} Felder</div>
        </div>
        {tSaving
          ? <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Speichern…</div>
          : <button onClick={saveTemplate} disabled={!tTitle.trim()} style={{ fontSize: 13, fontWeight: 700, color: !tTitle.trim() ? 'rgba(96,8,18,0.35)' : '#600812', background: 'none', border: 'none', cursor: !tTitle.trim() ? 'not-allowed' : 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>
              Speichern
            </button>
        }
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto' }}>

        {/* Title + Description */}
        <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Titel *</span>
            <input
              type="text"
              autoFocus
              placeholder="z.B. Übergabeprotokoll"
              value={tTitle}
              onChange={e => setTTitle(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Beschreibung</span>
            <input
              type="text"
              placeholder="Kurze Beschreibung (optional)"
              value={tDesc}
              onChange={e => setTDesc(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }}
            />
          </label>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em' }}>Felder</div>
          <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>{tFields.length} Felder</div>
        </div>

        {tFields.length === 0 && (
          <div style={{ padding: '20px 14px', background: 'var(--lbf-card)', borderRadius: 12, border: '0.5px dashed rgba(96,8,18,0.2)', textAlign: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch keine Felder. Füge das erste Feld hinzu.</div>
          </div>
        )}

        {tFields.map(field => (
          <div key={field.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid #600812', padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--lbf-text)' }}>{field.label}</div>
              <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                {FIELD_TYPE_LABELS[field.fieldType]}{field.required ? ' · Pflichtfeld' : ''}{field.options?.length ? ` · ${field.options.length} Optionen` : ''}{field.hint ? ` · "${field.hint}"` : ''}
              </div>
            </div>
            <button onClick={() => removeTemplateField(field.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4, display: 'flex' }}>
              {pik(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>, 16)}
            </button>
          </div>
        ))}

        <button
          onClick={() => { setShowAddTField(true); setNewTField({ fieldType: 'text', required: false }); setNewTFieldOptions('') }}
          style={{ width: '100%', padding: '13px', borderRadius: 12, border: '1.5px dashed rgba(96,8,18,0.25)', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#600812', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}
        >
          {pik(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>, 16)}
          Feld hinzufügen
        </button>
      </div>

      {/* Add template field sheet */}
      {showAddTField && (
        <>
          <div onClick={() => setShowAddTField(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 400 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 401, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(96,8,18,0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 20 }}>Neues Feld</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Bezeichnung *</span>
                <input type="text" placeholder="z.B. Fahrzeugkennzeichen" value={newTField.label || ''} onChange={e => setNewTField(p => ({ ...p, label: e.target.value }))}
                  style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Feldtyp</span>
                <select value={newTField.fieldType} onChange={e => setNewTField(p => ({ ...p, fieldType: e.target.value as FType }))}
                  style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }}>
                  <option value="text">Text (einzeilig)</option>
                  <option value="textarea">Freitext (mehrzeilig)</option>
                  <option value="number">Zahl</option>
                  <option value="date">Datum</option>
                  <option value="time">Uhrzeit</option>
                  <option value="select">Auswahl (Dropdown)</option>
                  <option value="checkbox">Checkbox (Ja/Nein)</option>
                </select>
              </label>
              {newTField.fieldType === 'select' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Optionen (eine pro Zeile)</span>
                  <textarea value={newTFieldOptions} onChange={e => setNewTFieldOptions(e.target.value)} placeholder={'Option 1\nOption 2\nOption 3'} rows={4}
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                </label>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Hilfetext (optional)</span>
                <input type="text" placeholder="Hinweis für Ausfüllende" value={newTField.hint || ''} onChange={e => setNewTField(p => ({ ...p, hint: e.target.value }))}
                  style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <Toggle on={newTField.required ?? false} onChange={v => setNewTField(p => ({ ...p, required: v }))} />
                <span style={{ fontSize: 14, color: 'var(--lbf-text)', fontWeight: 600 }}>Pflichtfeld</span>
              </label>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowAddTField(false)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
                <button onClick={addTemplateField} disabled={!newTField.label?.trim()}
                  style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: !newTField.label?.trim() ? 'rgba(96,8,18,0.3)' : '#600812', fontSize: 15, fontWeight: 700, color: '#fff', cursor: !newTField.label?.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  Hinzufügen
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif" }}>

      {builderOverlay}

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
        {([['formulare', 'Formulare'], ['editor', 'Protokoll-Felder']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '12px 8px 10px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em',
            color: tab === t ? '#600812' : 'var(--warm-gray)', fontFamily: 'inherit',
            borderTop: tab === t ? '2px solid #600812' : '2px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto' }}>

        {/* ── Formulare tab ── */}
        {tab === 'formulare' && (
          <>
            {/* Static forms */}
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 10 }}>Standardformulare</div>
            {STATIC_FORMS.map(form => {
              const isHidden = (cfg.hidden_forms || []).includes(form.id)
              return (
                <div key={form.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${isHidden ? 'rgba(139,113,90,0.35)' : '#600812'}`, padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: isHidden ? 'var(--warm-gray)' : 'var(--lbf-text)', fontStyle: isHidden ? 'italic' : 'normal' }}>{form.label}</div>
                    <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{form.desc}</div>
                  </div>
                  {form.configurable && !isHidden && (
                    <button onClick={() => setTab('editor')} style={{ fontSize: 11, fontWeight: 700, color: '#600812', background: 'rgba(96,8,18,0.06)', border: '0.5px solid rgba(96,8,18,0.15)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Felder</button>
                  )}
                  <Toggle on={!isHidden} onChange={v => toggleHiddenForm(form.id, !v)} />
                </div>
              )
            })}

            {/* Custom templates */}
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', margin: '22px 0 10px' }}>Eigene Vorlagen</div>

            {loadingTemplates && (
              <div style={{ padding: '14px', textAlign: 'center', fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Laden…</div>
            )}

            {!loadingTemplates && templates.length === 0 && (
              <div style={{ padding: '18px 14px', background: 'var(--lbf-card)', borderRadius: 12, border: '0.5px dashed rgba(96,8,18,0.2)', textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch keine eigenen Vorlagen</div>
              </div>
            )}

            {templates.map(template => (
              <div key={template.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${template.is_active ? '#600812' : 'rgba(139,113,90,0.35)'}`, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: template.is_active ? 'var(--lbf-text)' : 'var(--warm-gray)', fontStyle: !template.is_active ? 'italic' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.title}</div>
                    {template.description && <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{template.description}</div>}
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>{template.schema.length} Felder{!template.is_active ? ' · ausgeblendet' : ''}</div>
                  </div>
                  <Toggle on={template.is_active} onChange={() => toggleTemplateActive(template)} />
                </div>
                <div style={{ borderTop: '0.5px solid rgba(96,8,18,0.08)', background: 'rgba(250,249,247,0.8)', padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  <button onClick={() => openBuilder(template)} style={{ fontSize: 12, fontWeight: 700, color: '#600812', background: 'none', border: '0.5px solid rgba(96,8,18,0.2)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Bearbeiten</button>
                  {orgCode && (
                    <button onClick={() => copyShareUrl(template.id)} style={{ fontSize: 12, fontWeight: 700, color: copiedId === template.id ? '#16a34a' : 'var(--warm-gray)', background: 'none', border: '0.5px solid rgba(96,8,18,0.1)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {copiedId === template.id ? 'Link kopiert!' : 'Link teilen'}
                    </button>
                  )}
                  <button onClick={() => deleteTemplate(template.id)} style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', padding: '5px 8px', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>Löschen</button>
                </div>
              </div>
            ))}

            <button
              onClick={() => openBuilder()}
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: '1.5px dashed rgba(96,8,18,0.25)', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#600812', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}
            >
              {pik(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>, 16)}
              Neue Vorlage erstellen
            </button>

            <div style={{ padding: '12px 14px', background: 'rgba(96,8,18,0.04)', borderRadius: 10, border: '0.5px solid rgba(96,8,18,0.1)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 4 }}>Info</div>
              <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
                Aktive Formulare erscheinen auf der Seite deiner Organisation <span style={{ fontStyle: 'italic', fontWeight: 700, color: 'var(--lbf-text)' }}>{orgName}</span>. Eigene Vorlagen lassen sich per Link direkt teilen.
              </div>
            </div>
          </>
        )}

        {/* ── Editor tab (Notaufnahme-Protokoll) ── */}
        {tab === 'editor' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em' }}>Patientendokumentation</div>
              <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>{ORGPATIENTEN_SCHEMA.length} Abschnitte</div>
            </div>

            {ORGPATIENTEN_SCHEMA.map((section: SectionDef) => {
              const isHidden = cfg.hidden_sections.includes(section.id)
              const isExpanded = expandedSection === section.id
              const customFields = cfg.custom_fields.filter(f => f.sectionId === section.id)
              const totalFields = section.fields.length + customFields.length

              return (
                <div key={section.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${isHidden ? 'rgba(139,113,90,0.35)' : '#600812'}`, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 10 }}>
                    <button type="button" onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                      style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit' }}>
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
                    {section.canHide && <Toggle on={!isHidden} onChange={v => toggleSection(section.id, !v)} />}
                  </div>

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
                                <button type="button" onClick={() => toggleRequired(field.id, !isRequired)}
                                  style={{ marginTop: 3, fontSize: 10, fontWeight: 700, background: isRequired ? 'rgba(96,8,18,0.08)' : 'none', color: isRequired ? '#600812' : 'var(--warm-gray)', border: isRequired ? '0.5px solid rgba(96,8,18,0.2)' : '0.5px dashed rgba(96,8,18,0.2)', borderRadius: 99, padding: '1px 8px', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                                  {isRequired ? 'Pflichtfeld' : 'Optional'}
                                </button>
                              )}
                            </div>
                            {field.canHide && <Toggle on={!isFieldHidden} onChange={v => toggleField(field.id, !v)} />}
                          </div>
                        )
                      })}
                      {customFields.map(cf => (
                        <div key={cf.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 10, borderBottom: '0.5px solid rgba(96,8,18,0.05)', background: 'rgba(96,8,18,0.02)' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lbf-text)' }}>{cf.label}</div>
                            <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 2 }}>
                              {cf.fieldType}{cf.required ? ' · Pflichtfeld' : ''}{cf.options?.length ? ` · ${cf.options.length} Optionen` : ''}
                            </div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#600812', background: 'rgba(96,8,18,0.07)', borderRadius: 99, padding: '2px 8px', flexShrink: 0 }}>Eigenes Feld</span>
                          <button type="button" onClick={() => deleteCustomField(cf.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px 4px', display: 'flex' }}>
                            {pik(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>, 14)}
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => { setShowAddField(section.id); setNewField({ fieldType: 'text', required: false }); setNewFieldOptions('') }}
                        style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderTop: '0.5px dashed rgba(96,8,18,0.15)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#600812', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
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

      {/* Add custom field bottom sheet (for Notaufnahme editor) */}
      {showAddField && (
        <>
          <div onClick={() => setShowAddField(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--lbf-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(96,8,18,0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>
              {ORGPATIENTEN_SCHEMA.find(s => s.id === showAddField)?.title}
            </div>
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 20 }}>Eigenes Feld</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Feldbezeichnung *</span>
                <input type="text" placeholder="z.B. Fahrerausweis-Nr." value={newField.label || ''} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))}
                  style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Feldtyp</span>
                <select value={newField.fieldType} onChange={e => setNewField(p => ({ ...p, fieldType: e.target.value as FType }))}
                  style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }}>
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
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#600812' }}>Optionen (eine pro Zeile)</span>
                  <textarea value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} placeholder={'Option 1\nOption 2\nOption 3'} rows={4}
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(96,8,18,0.15)', background: 'var(--warm-bg)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                </label>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <Toggle on={newField.required ?? false} onChange={v => setNewField(p => ({ ...p, required: v }))} />
                <span style={{ fontSize: 14, color: 'var(--lbf-text)', fontWeight: 600 }}>Pflichtfeld</span>
              </label>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowAddField(null)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(96,8,18,0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
                <button type="button" onClick={() => addCustomField(showAddField)} disabled={!newField.label?.trim()}
                  style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: !newField.label?.trim() ? 'rgba(96,8,18,0.3)' : '#600812', fontSize: 15, fontWeight: 700, color: '#fff', cursor: !newField.label?.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
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
