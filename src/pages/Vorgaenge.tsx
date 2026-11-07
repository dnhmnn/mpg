import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import {
  ORGPATIENTEN_SCHEMA, DEFAULT_FORM_CONFIG,
  type FormConfig, type CustomFieldDef, type SectionDef,
  type TemplateFieldDef, type FormTemplate,
} from './public/formSchema'
import CirsVerwaltung from './vorgaenge/CirsVerwaltung'
import { formularFrei, modulFrei } from '../lib/freigabe'
import { hatRecht } from '../lib/apps'
import { absenderModus, darfFormulareEinstellen, type AbsenderModus, type FormularId } from '../lib/formular/absender'
import { absenderSetzen, formConfigAendern, formConfigLesen } from '../lib/formular/einstellung'
import { istFehler, mitgliederPruefung, type MitgliederPruefung } from '../lib/formular/api'
import {
  ABSENDER_MODI, ABSENDER_WAHL, VORGAENGE_TEXTE as VT, ausgeschaltetText, doppeltText, hatAbsenderWahl, karteAusSuche, koennenNichtText,
  pruefEintraege, pruefEintragText, pruefungZeigen, vorgaengeReiter,
} from '../lib/formular/verwaltung'
import { orgFehler } from './benutzer/logik'

type Tab = 'formulare' | 'editor' | 'cirs'
type FType = 'text' | 'number' | 'date' | 'time' | 'select' | 'checkbox' | 'textarea'

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text', number: 'Zahl', date: 'Datum', time: 'Uhrzeit',
  textarea: 'Freitext', select: 'Auswahl', checkbox: 'Checkbox',
}

const STATIC_FORMS = [
  { id: 'patienten',     label: 'Patientendokumentation', desc: 'Notfalleinsatz dokumentieren', configurable: true  },
  { id: 'produktausgabe',label: 'Produktausgabe',         desc: 'Materialausgabe erfassen',     configurable: false },
  { id: 'defektmeldung', label: 'Defektmeldung',          desc: 'Defekt an einem Medizinprodukt melden', configurable: false },
  { id: 'cirs',          label: 'CIRS-Meldung',           desc: 'Kritisches Ereignis melden',  configurable: false },
]

const REITER_TEXT: Record<Tab, string> = { formulare: 'Formulare', editor: 'Protokoll-Felder', cirs: 'CIRS' }

/** Ein Textknopf im LBF-Stil (Akzent, fett, ohne Rahmen); `farbe` für Listenzeilen, die zur Person führen. */
function Textknopf({ children, onClick, farbe }: { children: React.ReactNode; onClick: () => void; farbe?: string }) {
  return (
    <button type="button" onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 12, fontWeight: farbe ? 400 : 700, color: farbe ?? 'var(--lbf-akzent)', cursor: 'pointer', textAlign: 'left', textDecoration: farbe ? 'underline' : 'none', textDecorationColor: 'rgba(var(--lbf-rot-rgb),0.3)', textUnderlineOffset: 3 }}>
      {children}
    </button>
  )
}

/**
 * Wer ein Formular abgibt (Bauplan v2, 3.3): zwei Wahlknöpfe, ihre Erklärung
 * und im Modus Passwort die Zählung, wie viele Mitglieder nicht mit Passwort
 * bestätigen können. Ohne Schreibrecht nur die Anzeige.
 */
function AbsenderWahl({ formular, label, modus, darf, onWahl, pruefung, offen, onOffen, benutzerLink, onBenutzer, onPerson }: {
  formular: FormularId
  label: string
  modus: AbsenderModus
  darf: boolean
  onWahl: (m: AbsenderModus) => void
  pruefung: MitgliederPruefung | null
  offen: boolean
  onOffen: () => void
  benutzerLink: boolean
  onBenutzer: () => void
  /** Eine Person in der Benutzerverwaltung öffnen (nur mit `benutzerLink`). */
  onPerson: (id: string) => void
}) {
  const n = pruefung ? pruefung.koennen_nicht : 0
  const doppelt = pruefung ? pruefung.doppelt ?? 0 : 0
  const liste = pruefEintraege(pruefung)
  return (
    <div style={{ borderTop: '0.5px solid rgba(var(--lbf-rot-rgb),0.08)', padding: '10px 14px 12px' }}>
      <div id={`absender-${formular}`} style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 8 }}>{VT.abschnitt}</div>
      {darf ? (
        <>
          <div role="radiogroup" aria-label={`Absender ${label}`} style={{ display: 'flex', gap: 8 }}>
            {ABSENDER_MODI.map((m) => {
              const an = m === modus
              return (
                <button
                  key={m} type="button" role="radio" aria-checked={an} onClick={() => { if (!an) onWahl(m) }}
                  style={{
                    flex: 1, minWidth: 0, padding: '9px 8px', borderRadius: 8, lineHeight: 1.25,
                    border: '0.5px solid rgba(var(--lbf-rot-rgb),0.15)',
                    background: an ? 'rgba(var(--lbf-rot-rgb),0.06)' : 'transparent',
                    color: an ? 'var(--lbf-akzent)' : 'var(--lbf-text)', fontWeight: an ? 700 : 400,
                    fontSize: 13, fontFamily: 'inherit', cursor: an ? 'default' : 'pointer',
                  }}
                >
                  {ABSENDER_WAHL[m].knopf}
                </button>
              )
            })}
          </div>
          <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 8, lineHeight: 1.45 }}>{ABSENDER_WAHL[modus].erklaerung}</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--lbf-text)' }}>{ABSENDER_WAHL[modus].anzeige}</div>
          <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 4, lineHeight: 1.45 }}>{VT.ohneSchreibrecht}</div>
        </>
      )}
      {/* Zählung nur im Modus Passwort und nur mit Antwort des Servers; sonst entfällt die Zeile still */}
      {modus === 'passwort' && pruefung ? (
        !pruefungZeigen(pruefung) ? (
          <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 8 }}>{koennenNichtText(0)}</div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: n > 0 ? 'var(--lbf-warn-text-2)' : 'var(--warm-gray)', fontStyle: n > 0 ? 'normal' : 'italic', lineHeight: 1.45 }}>
              {koennenNichtText(n)}
            </div>
            {doppelt > 0 ? (
              <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', lineHeight: 1.45, marginTop: 4 }}>{doppeltText(doppelt)}</div>
            ) : null}
            <div style={{ marginTop: 4 }}>
              <Textknopf onClick={onOffen}>{offen ? VT.ausblenden : VT.anzeigen}</Textknopf>
            </div>
            {offen ? (
              <div style={{ marginTop: 6 }}>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {liste.map((e) => (
                    <li key={e.id} style={{ fontSize: 12, color: 'var(--lbf-text)', padding: '4px 0', borderBottom: '0.5px solid rgba(var(--lbf-rot-rgb),0.06)', overflowWrap: 'anywhere' }}>
                      {/* Gleich lautende Zeilen: über die Person in der Benutzerverwaltung unterscheidbar */}
                      {benutzerLink ? <Textknopf onClick={() => onPerson(e.id)} farbe="var(--lbf-text)">{pruefEintragText(e)}</Textknopf> : pruefEintragText(e)}
                    </li>
                  ))}
                </ul>
                <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 6 }}>{VT.hinweisBenutzer}</div>
                {benutzerLink ? <div style={{ marginTop: 4 }}><Textknopf onClick={onBenutzer}>{VT.zurBenutzerverwaltung}</Textknopf></div> : null}
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  )
}

const pik = (ch: React.ReactNode, sz = 18) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{ch}</svg>
)

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} style={{
      width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
      background: on ? 'var(--lbf-akzent-grund)' : 'var(--lbf-border)', position: 'relative',
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
  // Verweise aus dem Hub: /vorgaenge?bereich=cirs&meldung=<id>
  const [suchParameter] = useSearchParams()
  const startMeldung = suchParameter.get('meldung')
  const [cirsZahlen, setCirsZahlen] = useState({ neu: 0, ueberfaellig: 0 })

  // Org info
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [orgCode, setOrgCode] = useState('')
  // Für die Freischaltung der Formulare (Supervisor → Module)
  const [orgDaten, setOrgDaten] = useState<unknown>(null)

  // Form config (for Notaufnahme-Protokoll + hidden_forms)
  const [cfg, setCfg] = useState<FormConfig>(DEFAULT_FORM_CONFIG)
  const [saving, setSaving] = useState(false)
  /** Kurze Rückmeldung im Kopf („Gespeichert“). */
  const [msg, setMsg] = useState('')
  /** Fehler beim Speichern, unter den Reitern (kann länger sein). */
  const [fehler, setFehler] = useState('')
  const msgUhr = useRef<ReturnType<typeof setTimeout> | null>(null)

  /*
   * Schreiben ohne Überschreiben (Bauplan v2, 3.2): jede Änderung ist eine
   * Funktion, die auf dem frisch gelesenen Stand läuft (formConfigAendern).
   * Die Änderungen laufen nacheinander, damit zwei schnelle Klicks sich nicht
   * gegenseitig überschreiben. Angezeigt wird sofort; geht etwas schief,
   * zeigt die Seite wieder den zuletzt gespeicherten Stand.
   */
  const gespeichert = useRef<FormConfig>(DEFAULT_FORM_CONFIG)
  const kette = useRef<Promise<void>>(Promise.resolve())
  const offeneAenderungen = useRef(0)

  // Absender: Zählung der Mitglieder, die nicht mit Passwort bestätigen können (einmal je Seitenaufruf)
  const [pruefung, setPruefung] = useState<MitgliederPruefung | null>(null)
  const [pruefungOffen, setPruefungOffen] = useState('')
  const darfEinstellen = darfFormulareEinstellen(user ?? null)

  // ?karte=<formular>: aus MPG und Lager hierher, die Karte zeigen und kurz hervorheben (3.4)
  const karte = karteAusSuche(suchParameter.get('karte'))
  const [hervor, setHervor] = useState('')
  const karteGezeigt = useRef(false)
  const hervorUhr = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ohne Modul Vorgänge: nur die Standardformulare (und der Feld-Editor, wenn Patienten frei ist)
  const orgFuerModule = orgDaten ?? user?.organization ?? null
  const vorgaengeFrei = modulFrei(orgFuerModule, 'dokumente')
  const reiter = vorgaengeReiter({ vorgaengeFrei, patientenFrei: formularFrei(orgFuerModule, 'patienten') })

  // Nav
  const [tab, setTab] = useState<Tab>(() => suchParameter.get('bereich') === 'cirs' || startMeldung ? 'cirs' : 'formulare')
  useEffect(() => { if (!reiter.includes(tab)) setTab('formulare') }, [reiter.join(','), tab])

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
        setOrgDaten(org)
        // form_config als Objekt, Text oder doppelt kodiert
        const gelesen: FormConfig = { ...DEFAULT_FORM_CONFIG, ...formConfigLesen(org.form_config) }
        gespeichert.current = gelesen
        if (offeneAenderungen.current === 0) setCfg(gelesen)
      })
      .catch(() => {})
    loadTemplates()
  }, [user?.organization_id])

  useEffect(() => {
    if (!user?.id || !darfEinstellen) { setPruefung(null); return }
    let aktiv = true
    // Fehler (alter Server, kein Recht, Netz): die Zeile entfällt still
    mitgliederPruefung().then((r) => { if (aktiv) setPruefung(istFehler(r) ? null : r.wert) })
    return () => { aktiv = false }
  }, [user?.id, darfEinstellen])

  // Die Karte aus ?karte= in Sicht holen, sobald sie da ist, und 2 Sekunden hervorheben
  useEffect(() => {
    if (!karte || karteGezeigt.current || !orgDaten || tab !== 'formulare') return
    const el = document.getElementById(`karte-${karte}`)
    if (!el) return
    karteGezeigt.current = true
    el.scrollIntoView({ block: 'center' })
    setHervor(karte)
    hervorUhr.current = setTimeout(() => setHervor(''), 2000)
  }, [karte, orgDaten, tab, cfg])
  useEffect(() => () => {
    if (hervorUhr.current) clearTimeout(hervorUhr.current)
    if (msgUhr.current) clearTimeout(msgUhr.current)
  }, [])

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

  function kurzMelden(text: string) {
    setMsg(text)
    if (msgUhr.current) clearTimeout(msgUhr.current)
    msgUhr.current = setTimeout(() => setMsg(''), 2000)
  }

  /** Eine Änderung an form_config: sofort zeigen, auf dem frischen Stand speichern, nacheinander. */
  const aendern = useCallback((fn: (c: FormConfig) => FormConfig) => {
    if (!orgId) return
    setCfg((c) => fn(c))
    setFehler('')
    offeneAenderungen.current += 1
    setSaving(true)
    kette.current = kette.current.then(async () => {
      try {
        gespeichert.current = await formConfigAendern(orgId, fn)
        kurzMelden(VT.gespeichert)
      } catch (e) {
        setFehler(orgFehler(e))
      } finally {
        offeneAenderungen.current -= 1
        if (offeneAenderungen.current === 0) {
          setCfg(gespeichert.current)
          setSaving(false)
        }
      }
    })
  }, [orgId])

  /** Eintrag in einer Liste setzen oder entfernen, ohne Doppel. */
  const mitOhne = (liste: string[] | undefined, wert: string, an: boolean) => {
    const ohne = (liste || []).filter((x) => x !== wert)
    return an ? [...ohne, wert] : ohne
  }

  function toggleHiddenForm(formId: string, hide: boolean) {
    aendern((c) => ({ ...c, hidden_forms: mitOhne(c.hidden_forms, formId, hide) }))
  }

  function toggleSection(sectionId: string, hide: boolean) {
    aendern((c) => ({ ...c, hidden_sections: mitOhne(c.hidden_sections, sectionId, hide) }))
  }

  function toggleField(fieldId: string, hide: boolean) {
    aendern((c) => ({ ...c, hidden_fields: mitOhne(c.hidden_fields, fieldId, hide) }))
  }

  function toggleRequired(fieldId: string, required: boolean) {
    aendern((c) => ({ ...c, required_fields: mitOhne(c.required_fields, fieldId, required) }))
  }

  /** Absender eines Formulars wählen; geschrieben wird immer der gewählte Wert (3.1). */
  function absenderWaehlen(formular: FormularId, modus: AbsenderModus) {
    if (cfg.absender?.[formular] === modus) return
    aendern((c) => absenderSetzen(c, formular, modus))
  }

  function addCustomField(sectionId: string) {
    if (!newField.label?.trim()) return
    const field: CustomFieldDef = {
      id: 'custom_' + Date.now(), sectionId,
      label: newField.label.trim(), fieldType: newField.fieldType ?? 'text',
      options: newField.fieldType === 'select' ? newFieldOptions.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
      required: newField.required ?? false,
    }
    aendern((c) => ({ ...c, custom_fields: [...(c.custom_fields || []).filter((f) => f.id !== field.id), field] }))
    setShowAddField(null)
    setNewField({ fieldType: 'text', required: false })
    setNewFieldOptions('')
  }

  function deleteCustomField(fieldId: string) {
    aendern((c) => ({ ...c, custom_fields: (c.custom_fields || []).filter((f) => f.id !== fieldId) }))
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
      setFehler('Fehler: ' + (e as Error).message)
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
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid var(--lbf-border)', padding: 'calc(env(safe-area-inset-top) + 14px) 20px 14px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => setBuilderOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--lbf-akzent)', display: 'flex' }}>
          {pik(<><polyline points="15 18 9 12 15 6"/></>)}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>{editingTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</div>
          <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>{tFields.length} Felder</div>
        </div>
        {tSaving
          ? <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Speichern…</div>
          : <button onClick={saveTemplate} disabled={!tTitle.trim()} style={{ fontSize: 13, fontWeight: 700, color: !tTitle.trim() ? 'rgba(var(--lbf-rot-rgb),0.35)' : 'var(--lbf-akzent)', background: 'none', border: 'none', cursor: !tTitle.trim() ? 'not-allowed' : 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>
              Speichern
            </button>
        }
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto' }}>

        {/* Title + Description */}
        <div style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Titel *</span>
            <input
              type="text"
              autoFocus
              placeholder="z.B. Übergabeprotokoll"
              value={tTitle}
              onChange={e => setTTitle(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Beschreibung</span>
            <input
              type="text"
              placeholder="Kurze Beschreibung (optional)"
              value={tDesc}
              onChange={e => setTDesc(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }}
            />
          </label>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em' }}>Felder</div>
          <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>{tFields.length} Felder</div>
        </div>

        {tFields.length === 0 && (
          <div style={{ padding: '20px 14px', background: 'var(--lbf-card)', borderRadius: 12, border: '0.5px dashed rgba(var(--lbf-rot-rgb),0.2)', textAlign: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch keine Felder. Füge das erste Feld hinzu.</div>
          </div>
        )}

        {tFields.map(field => (
          <div key={field.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid var(--lbf-akzent)', padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
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
          style={{ width: '100%', padding: '13px', borderRadius: 12, border: '1.5px dashed rgba(var(--lbf-rot-rgb),0.25)', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--lbf-akzent)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}
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
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(var(--lbf-rot-rgb),0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 20 }}>Neues Feld</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Bezeichnung *</span>
                <input type="text" placeholder="z.B. Fahrzeugkennzeichen" value={newTField.label || ''} onChange={e => setNewTField(p => ({ ...p, label: e.target.value }))}
                  style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Feldtyp</span>
                <select value={newTField.fieldType} onChange={e => setNewTField(p => ({ ...p, fieldType: e.target.value as FType }))}
                  style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }}>
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
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Optionen (eine pro Zeile)</span>
                  <textarea value={newTFieldOptions} onChange={e => setNewTFieldOptions(e.target.value)} placeholder={'Option 1\nOption 2\nOption 3'} rows={4}
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                </label>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Hilfetext (optional)</span>
                <input type="text" placeholder="Hinweis für Ausfüllende" value={newTField.hint || ''} onChange={e => setNewTField(p => ({ ...p, hint: e.target.value }))}
                  style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <Toggle on={newTField.required ?? false} onChange={v => setNewTField(p => ({ ...p, required: v }))} />
                <span style={{ fontSize: 14, color: 'var(--lbf-text)', fontWeight: 600 }}>Pflichtfeld</span>
              </label>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowAddTField(false)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
                <button onClick={addTemplateField} disabled={!newTField.label?.trim()}
                  style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: !newTField.label?.trim() ? 'rgba(var(--lbf-rot-rgb),0.3)' : 'var(--lbf-akzent-grund)', fontSize: 15, fontWeight: 700, color: '#fff', cursor: !newTField.label?.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
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
      <div style={{ background: 'var(--lbf-card)', borderBottom: '0.5px solid var(--lbf-border)', padding: 'calc(env(safe-area-inset-top) + 14px) 20px 14px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => navigate('/hub')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--lbf-akzent)', display: 'flex' }}>
          {pik(<><polyline points="15 18 9 12 15 6"/></>)}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)' }}>Vorgänge</div>
          <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--warm-gray)' }}>{today}</div>
        </div>
        {saving && <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Speichern…</div>}
        {!saving && msg && <div role="status" style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>{msg}</div>}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: 'var(--lbf-card)', borderBottom: '0.5px solid var(--lbf-border-light)' }}>
        {reiter.map((t) => [t, REITER_TEXT[t]] as [Tab, string]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '12px 4px 10px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', whiteSpace: 'nowrap',
            color: tab === t ? 'var(--lbf-akzent)' : 'var(--warm-gray)', fontFamily: 'inherit',
            borderTop: tab === t ? '2px solid var(--lbf-akzent)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {label}
            {t === 'cirs' && cirsZahlen.neu > 0 && (
              <span aria-label={`${cirsZahlen.neu} neue Meldungen`} style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99, background: 'var(--lbf-akzent-grund)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{cirsZahlen.neu}</span>
            )}
          </button>
        ))}
      </div>

      {/* Fehler beim Speichern: der angezeigte Stand ist wieder der zuletzt gespeicherte */}
      {fehler && (
        <div style={{ maxWidth: 640, margin: '12px auto 0', padding: '0 16px', boxSizing: 'border-box' }}>
          <div role="alert" style={{ padding: '9px 12px', borderRadius: 10, background: 'var(--lbf-warn-grund)', border: '0.5px solid #fde047', color: 'var(--lbf-warn-text)', fontSize: 13, fontStyle: 'italic', lineHeight: 1.45, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{fehler}</span>
            <button type="button" onClick={() => setFehler('')} aria-label="Hinweis schließen" style={{ background: 'none', border: 'none', padding: 0, color: 'var(--lbf-warn-text)', fontSize: 16, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
          </div>
        </div>
      )}

      {/* ── CIRS ── immer geladen: der Reiter zeigt die Zahl der neuen Meldungen (nur mit Modul Vorgänge) */}
      {vorgaengeFrei && (
        <div style={{ display: tab === 'cirs' ? 'block' : 'none', padding: '20px 16px calc(32px + env(safe-area-inset-bottom))', maxWidth: 760, margin: '0 auto' }}>
          <CirsVerwaltung user={user} orgId={orgId || user?.organization_id || null} orgName={orgName} startMeldung={startMeldung} onZahlen={setCirsZahlen} />
        </div>
      )}

      <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto', display: tab === 'cirs' ? 'none' : 'block' }}>

        {/* ── Formulare tab ── */}
        {tab === 'formulare' && (
          <>
            {/* Static forms */}
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 10 }}>Standardformulare</div>
            {STATIC_FORMS.filter(form => formularFrei(orgFuerModule, form.id)).map(form => {
              const isHidden = (cfg.hidden_forms || []).includes(form.id)
              const mitWahl = hatAbsenderWahl(form.id)
              const modus = mitWahl ? absenderModus(cfg, form.id as FormularId) : 'frei'
              // Nur der Farbton des Schattens wechselt beim Hervorheben, sonst bewegt sich nichts
              const ring = hervor === form.id ? 'rgba(var(--lbf-rot-rgb),0.25)' : 'rgba(var(--lbf-rot-rgb),0)'
              return (
                <div key={form.id} id={`karte-${form.id}`} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: `0 0 0 2px ${ring}, 0 1px 4px rgba(0,0,0,0.07)`, transition: 'box-shadow 0.4s ease', borderLeft: `3px solid ${isHidden ? 'rgba(var(--lbf-grau-rgb),0.35)' : 'var(--lbf-akzent)'}`, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: isHidden ? 'var(--warm-gray)' : 'var(--lbf-text)', fontStyle: isHidden ? 'italic' : 'normal' }}>{form.label}</div>
                      <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{isHidden ? ausgeschaltetText(form.id) : form.desc}</div>
                    </div>
                    {form.configurable && !isHidden && reiter.includes('editor') && (
                      <button onClick={() => setTab('editor')} style={{ fontSize: 11, fontWeight: 700, color: 'var(--lbf-akzent)', background: 'rgba(var(--lbf-rot-rgb),0.06)', border: '0.5px solid rgba(var(--lbf-rot-rgb),0.15)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Felder</button>
                    )}
                    <Toggle on={!isHidden} onChange={v => toggleHiddenForm(form.id, !v)} />
                  </div>
                  {mitWahl && !isHidden ? (
                    <AbsenderWahl
                      formular={form.id as FormularId} label={form.label} modus={modus} darf={darfEinstellen}
                      onWahl={(m) => absenderWaehlen(form.id as FormularId, m)}
                      pruefung={pruefung} offen={pruefungOffen === form.id}
                      onOffen={() => setPruefungOffen(pruefungOffen === form.id ? '' : form.id)}
                      benutzerLink={hatRecht(user ?? null, 'unitarii')} onBenutzer={() => navigate('/unitarii')}
                      onPerson={(id) => navigate(`/unitarii?seite=person&id=${encodeURIComponent(id)}`)}
                    />
                  ) : null}
                  {form.id === 'cirs' && !isHidden ? (
                    <div style={{ borderTop: '0.5px solid rgba(var(--lbf-rot-rgb),0.08)', padding: '10px 14px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 6 }}>{VT.abschnitt}</div>
                      <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>{VT.cirs}</div>
                    </div>
                  ) : null}
                </div>
              )
            })}

            {vorgaengeFrei && (<>
            {/* Custom templates */}
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', margin: '22px 0 10px' }}>Eigene Vorlagen</div>

            {loadingTemplates && (
              <div style={{ padding: '14px', textAlign: 'center', fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Laden…</div>
            )}

            {!loadingTemplates && templates.length === 0 && (
              <div style={{ padding: '18px 14px', background: 'var(--lbf-card)', borderRadius: 12, border: '0.5px dashed rgba(var(--lbf-rot-rgb),0.2)', textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Noch keine eigenen Vorlagen</div>
              </div>
            )}

            {templates.map(template => (
              <div key={template.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${template.is_active ? 'var(--lbf-akzent)' : 'rgba(var(--lbf-grau-rgb),0.35)'}`, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: template.is_active ? 'var(--lbf-text)' : 'var(--warm-gray)', fontStyle: !template.is_active ? 'italic' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.title}</div>
                    {template.description && <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>{template.description}</div>}
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>{template.schema.length} Felder{!template.is_active ? ' · ausgeblendet' : ''}</div>
                  </div>
                  <Toggle on={template.is_active} onChange={() => toggleTemplateActive(template)} />
                </div>
                <div style={{ borderTop: '0.5px solid var(--lbf-border-light)', background: 'var(--lbf-fuss)', padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  <button onClick={() => openBuilder(template)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--lbf-akzent)', background: 'none', border: '0.5px solid rgba(var(--lbf-rot-rgb),0.2)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Bearbeiten</button>
                  {orgCode && (
                    <button onClick={() => copyShareUrl(template.id)} style={{ fontSize: 12, fontWeight: 700, color: copiedId === template.id ? '#16a34a' : 'var(--warm-gray)', background: 'none', border: '0.5px solid rgba(var(--lbf-rot-rgb),0.1)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {copiedId === template.id ? 'Link kopiert!' : 'Link teilen'}
                    </button>
                  )}
                  <button onClick={() => deleteTemplate(template.id)} style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', padding: '5px 8px', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>Löschen</button>
                </div>
              </div>
            ))}

            <button
              onClick={() => openBuilder()}
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: '1.5px dashed rgba(var(--lbf-rot-rgb),0.25)', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--lbf-akzent)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}
            >
              {pik(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>, 16)}
              Neue Vorlage erstellen
            </button>
            </>)}

            <div style={{ padding: '12px 14px', background: 'rgba(var(--lbf-rot-rgb),0.04)', borderRadius: 10, border: '0.5px solid rgba(var(--lbf-rot-rgb),0.1)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 4 }}>Info</div>
              <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
                Aktive Formulare erscheinen auf der Seite deiner Organisation <span style={{ fontStyle: 'italic', fontWeight: 700, color: 'var(--lbf-text)' }}>{orgName}</span>.{vorgaengeFrei ? ' Eigene Vorlagen lassen sich per Link direkt teilen.' : ''}
              </div>
            </div>
          </>
        )}

        {/* ── Editor tab (Notaufnahme-Protokoll) ── */}
        {tab === 'editor' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em' }}>Patientendokumentation</div>
              <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>{ORGPATIENTEN_SCHEMA.length} Abschnitte</div>
            </div>

            {ORGPATIENTEN_SCHEMA.map((section: SectionDef) => {
              const isHidden = cfg.hidden_sections.includes(section.id)
              const isExpanded = expandedSection === section.id
              const customFields = cfg.custom_fields.filter(f => f.sectionId === section.id)
              const totalFields = section.fields.length + customFields.length

              return (
                <div key={section.id} style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${isHidden ? 'rgba(var(--lbf-grau-rgb),0.35)' : 'var(--lbf-akzent)'}`, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 10 }}>
                    <button type="button" onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                      style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: isHidden ? 'var(--warm-gray)' : 'var(--lbf-text)', fontStyle: isHidden ? 'italic' : 'normal' }}>
                        {section.title}
                      </span>
                      {totalFields > 0 && !isHidden && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', background: 'rgba(var(--lbf-rot-rgb),0.07)', borderRadius: 99, padding: '1px 7px' }}>{totalFields}</span>
                      )}
                      {isHidden && <span style={{ fontSize: 10, color: 'var(--warm-gray)', fontStyle: 'italic' }}>ausgeblendet</span>}
                      <span style={{ marginLeft: 'auto', color: 'var(--warm-gray)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
                        {pik(<polyline points="9 18 15 12 9 6"/>, 14)}
                      </span>
                    </button>
                    {section.canHide && <Toggle on={!isHidden} onChange={v => toggleSection(section.id, !v)} />}
                  </div>

                  {isExpanded && !isHidden && (
                    <div style={{ borderTop: '0.5px solid var(--lbf-border-light)', background: 'var(--lbf-fuss)' }}>
                      {section.fields.length === 0 && customFields.length === 0 && (
                        <div style={{ padding: '12px 14px', fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
                          Dieser Abschnitt hat keine einzeln konfigurierbaren Felder.
                        </div>
                      )}
                      {section.fields.map(field => {
                        const isFieldHidden = cfg.hidden_fields.includes(field.id)
                        const isRequired = cfg.required_fields.includes(field.id)
                        return (
                          <div key={field.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 10, borderBottom: '0.5px solid rgba(var(--lbf-rot-rgb),0.05)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: isFieldHidden ? 'var(--warm-gray)' : 'var(--lbf-text)', fontStyle: isFieldHidden ? 'italic' : 'normal' }}>{field.label}</div>
                              {field.canRequire && !isFieldHidden && (
                                <button type="button" onClick={() => toggleRequired(field.id, !isRequired)}
                                  style={{ marginTop: 3, fontSize: 10, fontWeight: 700, background: isRequired ? 'var(--lbf-border-light)' : 'none', color: isRequired ? 'var(--lbf-akzent)' : 'var(--warm-gray)', border: isRequired ? '0.5px solid rgba(var(--lbf-rot-rgb),0.2)' : '0.5px dashed rgba(var(--lbf-rot-rgb),0.2)', borderRadius: 99, padding: '1px 8px', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                                  {isRequired ? 'Pflichtfeld' : 'Optional'}
                                </button>
                              )}
                            </div>
                            {field.canHide && <Toggle on={!isFieldHidden} onChange={v => toggleField(field.id, !v)} />}
                          </div>
                        )
                      })}
                      {customFields.map(cf => (
                        <div key={cf.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 10, borderBottom: '0.5px solid rgba(var(--lbf-rot-rgb),0.05)', background: 'rgba(var(--lbf-rot-rgb),0.02)' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lbf-text)' }}>{cf.label}</div>
                            <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 2 }}>
                              {cf.fieldType}{cf.required ? ' · Pflichtfeld' : ''}{cf.options?.length ? ` · ${cf.options.length} Optionen` : ''}
                            </div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', background: 'rgba(var(--lbf-rot-rgb),0.07)', borderRadius: 99, padding: '2px 8px', flexShrink: 0 }}>Eigenes Feld</span>
                          <button type="button" onClick={() => deleteCustomField(cf.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px 4px', display: 'flex' }}>
                            {pik(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>, 14)}
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => { setShowAddField(section.id); setNewField({ fieldType: 'text', required: false }); setNewFieldOptions('') }}
                        style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderTop: '0.5px dashed rgba(var(--lbf-rot-rgb),0.15)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--lbf-akzent)', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
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
            <div style={{ width: 36, height: 3, borderRadius: 99, background: 'rgba(var(--lbf-rot-rgb),0.2)', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>
              {ORGPATIENTEN_SCHEMA.find(s => s.id === showAddField)?.title}
            </div>
            <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: 'var(--lbf-text)', marginBottom: 20 }}>Eigenes Feld</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Feldbezeichnung *</span>
                <input type="text" placeholder="z.B. Fahrerausweis-Nr." value={newField.label || ''} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))}
                  style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Feldtyp</span>
                <select value={newField.fieldType} onChange={e => setNewField(p => ({ ...p, fieldType: e.target.value as FType }))}
                  style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 15, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none' }}>
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
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--lbf-akzent)' }}>Optionen (eine pro Zeile)</span>
                  <textarea value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} placeholder={'Option 1\nOption 2\nOption 3'} rows={4}
                    style={{ padding: '11px 12px', borderRadius: 10, border: '1.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--warm-bg)', fontSize: 14, color: 'var(--lbf-text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                </label>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <Toggle on={newField.required ?? false} onChange={v => setNewField(p => ({ ...p, required: v }))} />
                <span style={{ fontSize: 14, color: 'var(--lbf-text)', fontWeight: 600 }}>Pflichtfeld</span>
              </label>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowAddField(null)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'none', fontSize: 15, fontWeight: 700, color: 'var(--warm-gray)', cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
                <button type="button" onClick={() => addCustomField(showAddField)} disabled={!newField.label?.trim()}
                  style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: !newField.label?.trim() ? 'rgba(var(--lbf-rot-rgb),0.3)' : 'var(--lbf-akzent-grund)', fontSize: 15, fontWeight: 700, color: '#fff', cursor: !newField.label?.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
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
