import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useOrg } from './OrgPublicLayout'
import { pb } from '../../lib/pocketbase'
import type { FormTemplate, TemplateFieldDef } from './formSchema'

function pik(ch: React.ReactNode, sz = 20) {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{ch}</svg>
  )
}

function DynamicField({ field, value, onChange }: { field: TemplateFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid rgba(96,8,18,0.15)', background: '#faf9f7',
    fontSize: 15, color: '#1a0e08', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  }

  if (field.fieldType === 'checkbox') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', padding: '10px 0' }}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
          style={{ width: 20, height: 20, accentColor: '#600812', cursor: 'pointer', flexShrink: 0 }}
        />
        <span style={{ fontSize: 15, color: '#1a0e08', fontWeight: 600 }}>{field.label}{field.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}</span>
      </label>
    )
  }

  if (field.fieldType === 'select') {
    return (
      <select
        value={(value as string) || ''}
        onChange={e => onChange(e.target.value)}
        required={field.required}
        style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none' }}
      >
        <option value="">– Auswählen –</option>
        {(field.options || []).map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  }

  if (field.fieldType === 'textarea') {
    return (
      <textarea
        value={(value as string) || ''}
        onChange={e => onChange(e.target.value)}
        required={field.required}
        rows={4}
        placeholder={field.hint || ''}
        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
      />
    )
  }

  return (
    <input
      type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : field.fieldType === 'time' ? 'time' : 'text'}
      value={(value as string) || ''}
      onChange={e => onChange(e.target.value)}
      required={field.required}
      placeholder={field.hint || ''}
      style={inputStyle}
    />
  )
}

export default function OrgFormular() {
  const { templateId } = useParams<{ templateId: string }>()
  const { org, orgCode } = useOrg()

  const [template, setTemplate] = useState<FormTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!templateId) { setNotFound(true); setLoading(false); return }
    pb.collection('form_templates').getOne<FormTemplate>(templateId)
      .then(t => {
        if (t.organization_id !== org.id || !t.is_active) {
          setNotFound(true)
        } else {
          setTemplate(t)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [templateId, org.id])

  function setValue(fieldId: string, v: unknown) {
    setValues(prev => ({ ...prev, [fieldId]: v }))
    if (validationErrors.has(fieldId)) {
      setValidationErrors(prev => { const s = new Set(prev); s.delete(fieldId); return s })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!template) return

    // Validate required fields
    const errors = new Set<string>()
    template.schema.forEach(field => {
      if (!field.required) return
      const val = values[field.id]
      if (field.fieldType === 'checkbox') return // checkboxes are always valid
      if (!val || (typeof val === 'string' && !val.trim())) {
        errors.add(field.id)
      }
    })
    if (errors.size > 0) {
      setValidationErrors(errors)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await pb.collection('form_submissions').create({
        template_id: template.id,
        organization_id: org.id,
        org_code: orgCode,
        payload: values,
      })
      setSubmitted(true)
    } catch (err: unknown) {
      setError('Fehler beim Absenden. Bitte versuche es erneut.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const baseStyle: React.CSSProperties = {
    minHeight: '100dvh',
    background: '#faf9f7',
    fontFamily: "'Atkinson Hyperlegible', -apple-system, sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 0 calc(40px + env(safe-area-inset-bottom))',
  }

  if (loading) {
    return (
      <div style={{ ...baseStyle, justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#8a7a68', fontStyle: 'italic' }}>Formular wird geladen…</div>
      </div>
    )
  }

  if (notFound || !template) {
    return (
      <div style={{ ...baseStyle, justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: '#600812', marginBottom: 8 }}>Formular nicht gefunden</div>
          <div style={{ fontSize: 14, color: '#8a7a68', fontStyle: 'italic' }}>Dieses Formular ist nicht verfügbar oder wurde deaktiviert.</div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{ ...baseStyle, justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#fff' }}>
            {pik(<><polyline points="20 6 9 17 4 12"/></>, 28)}
          </div>
          <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: '#1a0e08', marginBottom: 8 }}>Eingereicht!</div>
          <div style={{ fontSize: 14, color: '#8a7a68', fontStyle: 'italic', marginBottom: 24 }}>
            Deine Antworten für <strong style={{ fontStyle: 'normal', color: '#1a0e08' }}>{template.title}</strong> wurden erfolgreich übermittelt.
          </div>
          <button
            onClick={() => { setSubmitted(false); setValues({}) }}
            style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#600812', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Neues Formular ausfüllen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={baseStyle}>
      {/* Header */}
      <div style={{ width: '100%', background: '#600812', padding: 'calc(env(safe-area-inset-top) + 24px) 24px 24px', textAlign: 'center' }}>
        <div style={{ fontStyle: 'italic', fontSize: 12, color: 'rgba(253,232,216,0.7)', marginBottom: 4, fontWeight: 400 }}>{org.org_name}</div>
        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: '#fde8d8', lineHeight: 1.25 }}>{template.title}</div>
        {template.description && (
          <div style={{ fontStyle: 'italic', fontSize: 13, color: 'rgba(253,232,216,0.75)', marginTop: 8 }}>{template.description}</div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate style={{ width: '100%', maxWidth: 560, padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {template.schema.map((field, idx) => {
          const hasError = validationErrors.has(field.id)
          return (
            <div key={field.id} style={{ marginBottom: 20 }}>
              {field.fieldType !== 'checkbox' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#600812' }}>
                    {field.label}{field.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                  </span>
                  {field.hint && <span style={{ fontSize: 12, fontStyle: 'italic', color: '#8a7a68', marginTop: -4 }}>{field.hint}</span>}
                  <DynamicField field={field} value={values[field.id]} onChange={v => setValue(field.id, v)} />
                </label>
              )}
              {field.fieldType === 'checkbox' && (
                <DynamicField field={field} value={values[field.id]} onChange={v => setValue(field.id, v)} />
              )}
              {hasError && (
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4, fontStyle: 'italic' }}>Dieses Feld ist erforderlich.</div>
              )}
            </div>
          )
        })}

        {error && (
          <div style={{ padding: '12px 14px', background: 'rgba(220,38,38,0.06)', border: '0.5px solid rgba(220,38,38,0.2)', borderRadius: 10, fontSize: 13, color: '#dc2626', marginBottom: 16, fontStyle: 'italic' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{ width: '100%', padding: '15px', borderRadius: 12, border: 'none', background: submitting ? 'rgba(96,8,18,0.4)' : '#600812', color: '#fff', fontSize: 16, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 8 }}
        >
          {submitting ? 'Wird eingereicht…' : 'Absenden'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, fontStyle: 'italic', color: '#8a7a68', opacity: 0.6 }}>
          © 2025 Responda Systems
        </div>
      </form>
    </div>
  )
}
