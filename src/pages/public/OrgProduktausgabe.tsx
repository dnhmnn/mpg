import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { useOrg } from './OrgPublicLayout'
import { PubHeader, PubWrap, PubSendBar, PubSection, field, inp, lbl } from './pubStyles'

const today = () => new Date().toISOString().slice(0, 10)

interface InventoryItem { id: string; name: string; unit: string }
interface UserHit { id: string; name: string; email: string }
type Pos = { qty: number; name: string; item_id: string; unit: string }

// ── Icons ──────────────────────────────────────────────────────────────────
const IconClipboard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
)
const IconBox = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
)
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)

// ── User search ─────────────────────────────────────────────────────────────
function UserSearch({ orgId, value, onChange }: {
  orgId: string; value: UserHit | null; onChange: (u: UserHit | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserHit[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function onInput(q: string) {
    setQuery(q)
    clearTimeout(timer.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      try {
        const res = await pb.collection('users').getList(1, 8, {
          filter: `organization_id = "${orgId}" && name ~ "${q.trim()}"`,
          sort: 'name',
        })
        setResults(res.items.map(u => ({ id: u.id, name: u.name, email: u.email })))
        setOpen(true)
      } catch { setResults([]) }
    }, 300)
  }

  function select(u: UserHit) {
    onChange(u); setQuery(''); setResults([]); setOpen(false)
  }

  if (value) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, background: 'var(--bg-subtle)', border: '0.5px solid var(--border-medium)', borderRadius: 10, padding: '9px 12px' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
        {value.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{value.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{value.email}</div>
      </div>
      <button type="button" onClick={() => onChange(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20, lineHeight: 1, padding: '0 2px' }}>×</button>
    </div>
  )

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        style={{ ...inp, marginTop: 6 }}
        type="text"
        value={query}
        onChange={e => onInput(e.target.value)}
        placeholder="Name eingeben…"
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-md)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
          {results.map(u => (
            <button key={u.id} type="button" onMouseDown={() => select(u)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '10px 12px', cursor: 'pointer', borderBottom: '0.5px solid var(--border)', fontFamily: 'inherit' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{u.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && query.trim() && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: 'var(--text-secondary)', zIndex: 50, marginTop: 2 }}>
          Kein Benutzer gefunden
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function OrgProduktausgabe() {
  const { org, orgCode } = useOrg()
  const navigate = useNavigate()
  const [einsatz, setEinsatz] = useState('')
  const [datum, setDatum] = useState(today())
  const [selectedUser, setSelectedUser] = useState<UserHit | null>(null)
  const [positions, setPositions] = useState<Partial<Pos>[]>([{ qty: 1 }])
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [activeSearch, setActiveSearch] = useState<number | null>(null)
  const [queries, setQueries] = useState<string[]>([''])
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    pb.collection('inventory_items').getFullList<InventoryItem>({
      filter: `organization_id = "${org.id}"`,
      sort: 'name',
    }).then(setInventoryItems).catch(() => {})
  }, [org.id])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setActiveSearch(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const getSuggestions = (idx: number) => {
    const q = (queries[idx] ?? '').toLowerCase().trim()
    if (!q) return inventoryItems.slice(0, 6)
    return inventoryItems.filter(it => it.name.toLowerCase().includes(q)).slice(0, 8)
  }

  const addPos = () => {
    setPositions(p => [...p, { qty: 1 }])
    setQueries(q => [...q, ''])
  }
  const delPos = (i: number) => {
    setPositions(p => p.filter((_, j) => j !== i))
    setQueries(q => q.filter((_, j) => j !== i))
  }
  const updQty = (i: number, v: number) =>
    setPositions(p => p.map((r, j) => j === i ? { ...r, qty: v } : r))
  const setQueryAt = (i: number, val: string) => {
    setQueries(q => { const n = [...q]; n[i] = val; return n })
    setPositions(p => p.map((r, j) => j === i ? { qty: r.qty ?? 1 } : r))
    setActiveSearch(i)
  }
  const selectItem = (i: number, item: InventoryItem) => {
    setPositions(p => p.map((r, j) => j === i ? { ...r, name: item.name, item_id: item.id, unit: item.unit } : r))
    setQueries(q => { const n = [...q]; n[i] = item.name; return n })
    setActiveSearch(null)
  }

  async function submit() {
    const filled = positions.filter((p): p is Pos => !!(p.item_id && p.name && (p.qty ?? 0) > 0))
    if (!einsatz || !datum || !filled.length || !selectedUser) {
      alert('Bitte alle Pflichtfelder ausfüllen und mindestens einen Artikel aus dem Lager auswählen.')
      return
    }
    setSending(true)
    try {
      const deDate = datum.split('-').reverse().join('.')
      await pb.collection('product_outputs').create({
        title: `Produktausgabe ${einsatz} (${deDate})`,
        payload: {
          einsatz, datum,
          user_id: selectedUser.id,
          user_name: selectedUser.name,
          positionen: filled,
        },
        submitted_by: selectedUser.id,
        status: 'offen',
        organization_id: org.id,
      })
      setSuccess(true)
    } catch (e: any) {
      alert('Fehler: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  function reset() {
    setEinsatz(''); setDatum(today()); setSelectedUser(null)
    setPositions([{ qty: 1 }]); setQueries(['']); setSuccess(false)
  }

  if (success) return (
    <PubWrap>
      <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 20, padding: 32, textAlign: 'center', maxWidth: 480, margin: '2rem auto', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ width: 56, height: 56, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 style={{ color: 'var(--text)', margin: '0 0 .5rem', fontSize: '1.2rem' }}>Erfolgreich gespeichert!</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: '1.5rem' }}>Die Ausgabe wurde an die Lagerverwaltung weitergeleitet.</p>
        <button style={btnStyle} onClick={reset}>+ Neue Ausgabe</button>
      </div>
    </PubWrap>
  )

  return <>
    <PubHeader title={`Produktausgabe – ${org.org_name}`} onBack={() => navigate(`/${orgCode}`)} />
    <PubWrap>

      {/* Kopfdaten */}
      <PubSection title="Kopfdaten" open icon={<IconClipboard />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem' }}>
          <div style={field}>
            <label style={lbl}>Einsatznummer *
              <input style={inp} type="text" placeholder="z.B. 2025-001" value={einsatz} onChange={e => setEinsatz(e.target.value)} />
            </label>
          </div>
          <div style={field}>
            <label style={lbl}>Datum *
              <input style={inp} type="date" value={datum} onChange={e => setDatum(e.target.value)} />
            </label>
          </div>
        </div>
      </PubSection>

      {/* Positionen */}
      <PubSection title="Positionen" open icon={<IconBox />}>
        <div ref={dropdownRef}>
          {positions.map((pos, i) => {
            const suggestions = getSuggestions(i)
            const showDrop = activeSearch === i && suggestions.length > 0
            const isSelected = !!pos.item_id
            return (
              <div key={i} style={{ marginBottom: '.6rem' }}>
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', padding: '.75rem', background: 'var(--bg-subtle)', border: `0.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12 }}>

                  {/* Qty */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, width: 72 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Anz.</span>
                    <input
                      style={{ ...inp, marginTop: 0, textAlign: 'center', padding: '10px 6px' }}
                      type="number" min={1} value={pos.qty ?? 1}
                      onChange={e => updQty(i, Number(e.target.value))}
                    />
                  </div>

                  {/* Article search */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {isSelected ? '✓ Artikel ausgewählt' : 'Artikel auswählen *'}
                    </span>
                    {isSelected ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, background: 'var(--bg-card)', border: '0.5px solid var(--border-medium)', borderRadius: 10, padding: '10px 12px' }}>
                        <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{pos.name}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginRight: 4 }}>{pos.unit}</span>
                        <button type="button" onClick={() => { setPositions(p => p.map((r, j) => j === i ? { qty: r.qty } : r)); setQueries(q => { const n = [...q]; n[i] = ''; return n }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1 }}>×</button>
                      </div>
                    ) : (
                      <>
                        <input
                          style={{ ...inp, marginTop: 2 }}
                          type="text"
                          placeholder="Artikelname suchen…"
                          value={queries[i] ?? ''}
                          onChange={e => setQueryAt(i, e.target.value)}
                          onFocus={() => setActiveSearch(i)}
                        />
                        {showDrop && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-elevated)', border: '0.5px solid var(--border-medium)', borderRadius: 10, boxShadow: 'var(--shadow-md)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
                            {suggestions.map(item => (
                              <button key={item.id} type="button"
                                onMouseDown={e => { e.preventDefault(); selectItem(i, item) }}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: '0.5px solid var(--border)', color: 'var(--text)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                <span style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.unit}</span>
                              </button>
                            ))}
                            {inventoryItems.length === 0 && (
                              <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>Keine Artikel in der Datenbank</div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Delete */}
                  <button type="button" onClick={() => delPos(i)}
                    style={{ width: 36, height: 36, borderRadius: 8, border: '0.5px solid var(--border-medium)', background: 'var(--bg-hover)', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0, marginTop: 18 }}>
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <button type="button" onClick={addPos}
          style={{ border: '0.5px solid var(--border-medium)', background: 'var(--bg-subtle)', padding: '.6rem .9rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600, color: 'var(--accent)', fontSize: '.9rem', fontFamily: 'inherit', marginTop: '.25rem' }}>
          + Position hinzufügen
        </button>
      </PubSection>

      {/* Ausgetragen von */}
      <PubSection title="Ausgetragen von" open icon={<IconUser />}>
        <label style={lbl}>Benutzer *</label>
        <UserSearch orgId={org.id} value={selectedUser} onChange={setSelectedUser} />
      </PubSection>

    </PubWrap>
    <PubSendBar onSubmit={submit} sending={sending} label="An Lager senden" />
  </>
}

const btnStyle: React.CSSProperties = { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit' }
