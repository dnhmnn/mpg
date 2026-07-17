import { useState, useEffect, useMemo, useRef } from 'react'
import { pb } from '../lib/pocketbase'

interface EkgFall {
  id: string
  collectionId: string
  titel?: string
  bild?: string
  frequenz?: string
  rhythmus?: string
  lagetyp?: string
  besonderheiten?: string
  diagnose: string
  erklaerung?: string
  kategorie?: string
  schwierigkeit?: number
  quelle?: string
  organization_id: string
  created: string
}

interface User { id: string; organization_id?: string; supervisor?: boolean; permissions?: Record<string, boolean> }
interface Props { user: User; showMessage: (t: string, type?: 'success' | 'error') => void }

const KATEGORIEN = ['Normalbefund', 'Bradykardie', 'Tachykardie', 'Blockbilder', 'Ischämie/STEMI', 'Schrittmacher', 'Sonstige']
const SCHRITTE: { key: keyof EkgFall; label: string }[] = [
  { key: 'frequenz', label: 'Frequenz' },
  { key: 'rhythmus', label: 'Rhythmus' },
  { key: 'lagetyp', label: 'Lagetyp' },
  { key: 'besonderheiten', label: 'Blockbilder / Ischämie' },
  { key: 'diagnose', label: 'Verdachtsdiagnose' },
]

function fileUrl(f: EkgFall): string {
  return f.bild ? `${pb.baseURL || (pb as any).baseUrl}/api/files/${f.collectionId}/${f.id}/${f.bild}` : ''
}

export default function EkgTrainer({ user, showMessage }: Props) {
  const [faelle, setFaelle] = useState<EkgFall[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kat, setKat] = useState<string>('alle')
  const [modus, setModus] = useState<'quiz' | 'gefuehrt' | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const canEdit = !!(user?.supervisor || user?.permissions?.ausbildungen_manage)

  useEffect(() => { if (user?.organization_id) load() }, [user])

  async function load() {
    try {
      setLoading(true); setError('')
      const list = await pb.collection('ekg_faelle').getFullList<EkgFall>({
        filter: `organization_id = "${user.organization_id}"`, sort: '-created', requestKey: `ekg-${Date.now()}`,
      })
      setFaelle(list)
    } catch (e: any) {
      setError('Fehler beim Laden — existiert die Collection "ekg_faelle" in PocketBase?')
    } finally { setLoading(false) }
  }

  const gefiltert = useMemo(() => faelle.filter(f => kat === 'alle' || f.kategorie === kat), [faelle, kat])
  const katCounts = useMemo(() => {
    const c: Record<string, number> = {}
    faelle.forEach(f => { const k = f.kategorie || 'Sonstige'; c[k] = (c[k] || 0) + 1 })
    return c
  }, [faelle])

  if (modus && gefiltert.length > 0) {
    return <Player faelle={gefiltert} modus={modus} allDiagnosen={Array.from(new Set(faelle.map(f => f.diagnose).filter(Boolean)))} onExit={() => setModus(null)} userId={user.id} />
  }

  return (
    <div style={{ padding: '18px 16px calc(90px + env(safe-area-inset-bottom))', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.16em' }}>EKG-Trainer</div>
          <div style={{ fontStyle: 'italic', fontWeight: 800, fontSize: 22, color: 'var(--lbf-text)', letterSpacing: '-0.02em' }}>EKGs lesen üben</div>
        </div>
        {canEdit && (
          <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', borderRadius: 10, background: '#600812', color: '#fff', padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Fall
          </button>
        )}
      </div>
      <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 18, lineHeight: 1.5 }}>
        Nur zu Übungs-/Ausbildungszwecken. EKG-Deutung ersetzt keine ärztliche Beurteilung oder das 12-Kanal-Original.
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 14, borderRadius: 12, marginBottom: 16, fontWeight: 600 }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Lade Fälle…</div>
      ) : faelle.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', background: 'var(--lbf-card)', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--lbf-text)' }}>Noch keine EKG-Fälle</div>
          <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', maxWidth: 360, margin: '0 auto' }}>
            {canEdit ? 'Lade mit „Fall" euer erstes EKG hoch (Bild + Frequenz, Rhythmus, Diagnose, Erklärung).' : 'Ein Ausbilder muss zuerst EKG-Fälle anlegen.'}
          </div>
        </div>
      ) : (
        <>
          {/* Kategorie-Chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
            <button onClick={() => setKat('alle')} style={chip(kat === 'alle')}>Alle ({faelle.length})</button>
            {KATEGORIEN.filter(k => katCounts[k]).map(k => (
              <button key={k} onClick={() => setKat(k)} style={chip(kat === k)}>{k} ({katCounts[k]})</button>
            ))}
          </div>

          <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic', marginBottom: 12 }}>
            {gefiltert.length} Fall{gefiltert.length === 1 ? '' : 'e'} · Modus wählen:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button onClick={() => setModus('quiz')} disabled={!gefiltert.length} style={modeCard('#600812')}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span style={{ fontWeight: 800, fontSize: 15 }}>Schnell-Quiz</span>
              <span style={{ fontSize: 11, opacity: 0.85, fontStyle: 'italic' }}>Diagnose raten</span>
            </button>
            <button onClick={() => setModus('gefuehrt')} disabled={!gefiltert.length} style={modeCard('#1e3a8a')}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
              <span style={{ fontWeight: 800, fontSize: 15 }}>Geführt</span>
              <span style={{ fontSize: 11, opacity: 0.85, fontStyle: 'italic' }}>Schritt für Schritt</span>
            </button>
          </div>
        </>
      )}

      {showAdd && <AddFall user={user} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} showMessage={showMessage} />}
    </div>
  )
}

function chip(active: boolean): React.CSSProperties {
  return { padding: '6px 13px', borderRadius: 999, border: active ? '1.5px solid #600812' : '1px solid rgba(96,8,18,0.15)', background: active ? '#600812' : 'transparent', color: active ? '#fff' : 'var(--warm-gray)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
}
function modeCard(bg: string): React.CSSProperties {
  return { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '20px 12px', borderRadius: 14, border: 'none', background: bg, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }
}

// ── Player ──────────────────────────────────────────────────────────────────
function Player({ faelle, modus, allDiagnosen, onExit, userId }: { faelle: EkgFall[]; modus: 'quiz' | 'gefuehrt'; allDiagnosen: string[]; onExit: () => void; userId: string }) {
  const reihenfolge = useMemo(() => {
    const a = [...faelle]
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((i + 1) * ((Date.now() % 9973) / 9973)); [a[i], a[j]] = [a[j], a[i]] } // leichte Durchmischung
    return a
  }, [faelle])
  const [idx, setIdx] = useState(0)
  const [reveal, setReveal] = useState(false)          // geführt: aufgedeckte Schritte
  const [step, setStep] = useState(0)
  const [answered, setAnswered] = useState<string | null>(null) // quiz
  const [correctCount, setCorrectCount] = useState(0)
  const [zoom, setZoom] = useState(false)

  const fall = reihenfolge[idx]

  const optionen = useMemo(() => {
    if (modus !== 'quiz' || !fall) return []
    const distractors = allDiagnosen.filter(d => d !== fall.diagnose)
    for (let i = distractors.length - 1; i > 0; i--) { const j = Math.floor((i + 1) * ((Date.now() % 7919) / 7919)); [distractors[i], distractors[j]] = [distractors[j], distractors[i]] }
    const opts = [fall.diagnose, ...distractors.slice(0, 3)]
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor((i + 1) * ((idx + i) % opts.length) / Math.max(1, opts.length)); [opts[i], opts[j]] = [opts[j], opts[i]] }
    return opts
  }, [fall, modus, allDiagnosen, idx])

  function next() {
    if (idx + 1 >= reihenfolge.length) { onExit(); return }
    setIdx(idx + 1); setReveal(false); setStep(0); setAnswered(null); setZoom(false)
  }
  function answerQuiz(opt: string) {
    if (answered) return
    setAnswered(opt)
    if (opt === fall.diagnose) setCorrectCount(c => c + 1)
  }

  if (!fall) return null

  return (
    <div style={{ padding: '14px 14px calc(90px + env(safe-area-inset-bottom))', maxWidth: 640, margin: '0 auto' }}>
      {/* Kopf */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button onClick={onExit} style={{ border: 'none', background: 'rgba(96,8,18,0.06)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#600812', flexShrink: 0 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ flex: 1, height: 6, background: 'rgba(96,8,18,0.1)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((idx) / reihenfolge.length) * 100}%`, background: '#600812', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--warm-gray)', flexShrink: 0 }}>{idx + 1}/{reihenfolge.length}</span>
      </div>

      {/* EKG-Bild */}
      <div onClick={() => setZoom(true)} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 12, cursor: 'zoom-in' }}>
        {fileUrl(fall)
          ? <img src={fileUrl(fall)} alt="EKG" style={{ width: '100%', display: 'block' }} />
          : <div style={{ padding: 40, textAlign: 'center', color: 'var(--warm-gray)', fontStyle: 'italic' }}>Kein Bild hinterlegt</div>}
      </div>
      {fall.kategorie && <div style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>{fall.kategorie}{fall.schwierigkeit ? ` · ${'★'.repeat(fall.schwierigkeit)}` : ''}</div>}

      {modus === 'quiz' ? (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--lbf-text)', marginBottom: 10 }}>Welche Verdachtsdiagnose?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {optionen.map(opt => {
              const isRight = opt === fall.diagnose
              const chosen = answered === opt
              const show = answered !== null
              return (
                <button key={opt} onClick={() => answerQuiz(opt)} disabled={show} style={{
                  textAlign: 'left', padding: '12px 15px', borderRadius: 11, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: show ? 'default' : 'pointer',
                  border: `1.5px solid ${show && isRight ? '#16a34a' : show && chosen ? '#dc2626' : 'rgba(96,8,18,0.15)'}`,
                  background: show && isRight ? 'rgba(22,163,74,0.08)' : show && chosen ? 'rgba(220,38,38,0.06)' : 'var(--lbf-card)',
                  color: 'var(--lbf-text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                  {opt}
                  {show && isRight && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                  {show && chosen && !isRight && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SCHRITTE.map((s, i) => {
              const val = (fall[s.key] as string) || '—'
              const open = reveal && i < step
              return (
                <div key={s.key} style={{ border: '1px solid rgba(96,8,18,0.12)', borderRadius: 11, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: open ? 'rgba(96,8,18,0.04)' : 'var(--lbf-card)' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</span>
                    {open && <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--lbf-text)', textAlign: 'right', marginLeft: 12 }}>{val}</span>}
                  </div>
                </div>
              )
            })}
          </div>
          {step < SCHRITTE.length && (
            <button onClick={() => { setReveal(true); setStep(step + 1) }} style={{ width: '100%', marginTop: 12, padding: '13px', borderRadius: 12, border: 'none', background: '#600812', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
              {step === 0 ? 'Analyse starten' : `${SCHRITTE[step].label} aufdecken`}
            </button>
          )}
        </>
      )}

      {/* Auflösung / Erklärung */}
      {((modus === 'quiz' && answered) || (modus === 'gefuehrt' && step >= SCHRITTE.length)) && (
        <div style={{ marginTop: 14, background: 'var(--lbf-card)', borderRadius: 12, borderLeft: '3px solid #600812', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>Auflösung</div>
          <div style={{ fontWeight: 800, fontSize: 16, fontStyle: 'italic', color: 'var(--lbf-text)', marginBottom: 8 }}>{fall.diagnose}</div>
          {fall.erklaerung && <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--lbf-text)', whiteSpace: 'pre-wrap' }}>{fall.erklaerung}</div>}
          {fall.quelle && <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 8 }}>Quelle: {fall.quelle}</div>}
          <button onClick={next} style={{ width: '100%', marginTop: 14, padding: '13px', borderRadius: 12, border: 'none', background: '#600812', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
            {idx + 1 >= reihenfolge.length ? `Fertig — ${modus === 'quiz' ? correctCount + '/' + reihenfolge.length + ' richtig' : 'abschließen'}` : 'Nächstes EKG'}
          </button>
        </div>
      )}

      {/* Zoom-Overlay */}
      {zoom && fileUrl(fall) && (
        <div onClick={() => setZoom(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
          <img src={fileUrl(fall)} alt="EKG" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

// ── Fall hinzufügen ──────────────────────────────────────────────────────────
function AddFall({ user, onClose, onSaved, showMessage }: { user: User; onClose: () => void; onSaved: () => void; showMessage: (t: string, type?: 'success' | 'error') => void }) {
  const [form, setForm] = useState({ diagnose: '', kategorie: 'Sonstige', schwierigkeit: 1, frequenz: '', rhythmus: '', lagetyp: '', besonderheiten: '', erklaerung: '', quelle: '' })
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function pick(f: File | undefined) {
    if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f))
  }
  async function save() {
    if (!form.diagnose.trim()) { alert('Diagnose ist erforderlich'); return }
    if (!file) { alert('Bitte ein EKG-Bild hochladen'); return }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('bild', file)
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))
      fd.append('organization_id', user.organization_id || '')
      await pb.collection('ekg_faelle').create(fd)
      showMessage('✅ EKG-Fall gespeichert!', 'success')
      onSaved()
    } catch (e: any) {
      alert('Fehler: ' + (e?.data ? JSON.stringify(e.data) : e.message) + '\n\nFalls die Collection "ekg_faelle" fehlt, bitte erst in PocketBase anlegen.')
    } finally { setSaving(false) }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(96,8,18,0.15)', background: 'var(--lbf-card)', color: 'var(--lbf-text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
  const lab: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,14,8,0.5)', zIndex: 600, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--lbf-card)', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 560, maxHeight: '92dvh', overflowY: 'auto', padding: '18px 18px calc(20px + env(safe-area-inset-bottom))' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>EKG-Fall hinzufügen</div>

        <div onClick={() => fileRef.current?.click()} style={{ border: '1.5px dashed rgba(96,8,18,0.3)', borderRadius: 12, padding: preview ? 0 : '28px', textAlign: 'center', cursor: 'pointer', marginBottom: 14, overflow: 'hidden' }}>
          {preview ? <img src={preview} alt="Vorschau" style={{ width: '100%', display: 'block' }} /> : <span style={{ fontSize: 13, fontWeight: 700, color: '#600812' }}>EKG-Bild hochladen</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pick(e.target.files?.[0])} />

        <div style={{ marginBottom: 12 }}><label style={lab}>Diagnose *</label><input style={inp} value={form.diagnose} onChange={e => setForm({ ...form, diagnose: e.target.value })} placeholder="z.B. Vorhofflimmern mit schneller Überleitung" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10, marginBottom: 12 }}>
          <div><label style={lab}>Kategorie</label>
            <select style={inp} value={form.kategorie} onChange={e => setForm({ ...form, kategorie: e.target.value })}>{KATEGORIEN.map(k => <option key={k}>{k}</option>)}</select>
          </div>
          <div><label style={lab}>Level</label>
            <select style={inp} value={form.schwierigkeit} onChange={e => setForm({ ...form, schwierigkeit: Number(e.target.value) })}><option value={1}>★</option><option value={2}>★★</option><option value={3}>★★★</option></select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div><label style={lab}>Frequenz</label><input style={inp} value={form.frequenz} onChange={e => setForm({ ...form, frequenz: e.target.value })} placeholder="~75/min" /></div>
          <div><label style={lab}>Rhythmus</label><input style={inp} value={form.rhythmus} onChange={e => setForm({ ...form, rhythmus: e.target.value })} placeholder="regelmäßig, Sinus" /></div>
          <div><label style={lab}>Lagetyp</label><input style={inp} value={form.lagetyp} onChange={e => setForm({ ...form, lagetyp: e.target.value })} placeholder="Indifferenztyp" /></div>
          <div><label style={lab}>Blockb./Ischämie</label><input style={inp} value={form.besonderheiten} onChange={e => setForm({ ...form, besonderheiten: e.target.value })} placeholder="keine / LSB / ST-Hebung V2-V4" /></div>
        </div>
        <div style={{ marginBottom: 12 }}><label style={lab}>Erklärung</label><textarea style={{ ...inp, resize: 'vertical', minHeight: 80 }} value={form.erklaerung} onChange={e => setForm({ ...form, erklaerung: e.target.value })} placeholder="Befund und Begründung, worauf man achtet…" /></div>
        <div style={{ marginBottom: 16 }}><label style={lab}>Quelle / Lizenz</label><input style={inp} value={form.quelle} onChange={e => setForm({ ...form, quelle: e.target.value })} placeholder="z.B. eigene Fortbildung / CC-BY …" /></div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ border: '1px solid rgba(96,8,18,0.2)', background: 'transparent', color: 'var(--warm-gray)', borderRadius: 10, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
          <button onClick={save} disabled={saving} style={{ border: 'none', background: '#600812', color: '#fff', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>{saving ? 'Speichern…' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  )
}
