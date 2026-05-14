import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { useOrg } from './OrgPublicLayout'
import { PubHeader, PubWrap, PubSendBar, PubSection, field, inp, lbl } from './pubStyles'

const today = () => new Date().toISOString().slice(0, 10)

interface InventoryItem { id: string; name: string; unit: string }
interface UserHit { id: string; name: string; email: string }
type Pos = { qty: number; name: string; item_id: string; unit: string }

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

// ── User search ──────────────────────────────────────────────────────────────
function UserSearch({ orgId, value, onChange }: {
  orgId: string; value: UserHit | null; onChange: (u: UserHit | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserHit[]>([])
  const [open, setOpen] = useState(false)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
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
    setSearched(false)
    clearTimeout(timer.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    setSearchError('')
    timer.current = setTimeout(async () => {
      try {
        const res = await pb.collection('users').getList(1, 10, {
          filter: `organization_id = "${orgId}" && name ~ "${q.trim()}"`,
          sort: 'name',
        })
        setResults(res.items.map(u => ({ id: u.id, name: u.name, email: u.email })))
      } catch (e: any) {
        setResults([])
        setSearchError(`FEHLER: ${e?.status ?? ''} ${e?.message ?? e}`)
      }
      setSearched(true)
      setLoading(false)
      setOpen(true)
    }, 300)
  }

  function select(u: UserHit) {
    onChange(u); setQuery(''); setResults([]); setOpen(false); setSearched(false)
  }

  if (value) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-medium)', borderRadius: 12, padding: '10px 14px' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
        {value.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{value.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.email}</div>
      </div>
      <button type="button" onClick={() => onChange(null)}
        style={{ background: 'var(--bg-hover)', border: '0.5px solid var(--border-medium)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, padding: '4px 8px', flexShrink: 0 }}>
        ×
      </button>
    </div>
  )

  return (
    <div ref={ref} style={{ marginTop: 8 }}>
      <input
        style={{ ...inp, marginTop: 0 }}
        type="text"
        value={query}
        onChange={e => onInput(e.target.value)}
        placeholder="Name eingeben und suchen…"
      />
      {loading && (
        <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-medium)', borderRadius: 12, marginTop: 4, padding: '12px 14px', fontSize: 14, color: 'var(--text-secondary)' }}>
          Suche…
        </div>
      )}
      {open && !loading && results.length > 0 && (
        <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-medium)', borderRadius: 12, marginTop: 4, overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
          {results.map((u, idx) => (
            <button key={u.id} type="button" onMouseDown={() => select(u)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '11px 14px', cursor: 'pointer', borderBottom: idx < results.length - 1 ? '0.5px solid var(--border)' : 'none', fontFamily: 'inherit' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{u.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {searchError && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, marginTop: 4, padding: '12px 14px', fontSize: 13, color: '#991b1b', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {searchError}
        </div>
      )}
      {open && !loading && !searchError && searched && results.length === 0 && query.trim() && (
        <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-medium)', borderRadius: 12, marginTop: 4, padding: '12px 14px', fontSize: 14, color: 'var(--text-secondary)' }}>
          Kein Benutzer gefunden
        </div>
      )}
    </div>
  )
}

// ── Artikel-Suchfeld ────────────────────────────────────────────────────────────
function ArticleSearch({ inventoryItems, onSelect }: {
  inventoryItems: InventoryItem[]
  onSelect: (item: InventoryItem) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const suggestions = query.trim()
    ? inventoryItems.filter(it => it.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : inventoryItems.slice(0, 8)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function select(item: InventoryItem) {
    onSelect(item); setQuery(''); setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ flex: 1 }}>
      <input
        style={{ ...inp, marginTop: 0 }}
        type="text"
        placeholder="Artikel suchen…"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && suggestions.length > 0 && (
        <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-medium)', borderRadius: 12, marginTop: 4, overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
          {suggestions.map((item, idx) => (
            <button key={item.id} type="button" onMouseDown={() => select(item)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: idx < suggestions.length - 1 ? '0.5px solid var(--border)' : 'none', color: 'var(--text)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0, marginLeft: 8 }}>{item.unit}</span>
            </button>
          ))}
        </div>
      )}
      {open && inventoryItems.length === 0 && (
        <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-medium)', borderRadius: 12, marginTop: 4, padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
          Keine Artikel in der Datenbank
        </div>
      )}
      {open && suggestions.length === 0 && inventoryItems.length > 0 && query.trim() && (
        <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border-medium)', borderRadius: 12, marginTop: 4, padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
          Kein Artikel gefunden
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
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
  const [itemsError, setItemsError] = useState<string>('')

  useEffect(() => {
    pb.collection('inventory_items').getFullList<InventoryItem>({
      filter: `organization_id = "${org.id}"`,
      sort: 'name',
    }).then(items => {
      setInventoryItems(items)
      setItemsError('')
    }).catch((e: any) => {
      setItemsError(`Artikel-Fehler: ${e?.status ?? ''} ${e?.message ?? e}`)
    })
  }, [org.id])

  const addPos = () => setPositions(p => [...p, { qty: 1 }])
  const delPos = (i: number) => setPositions(p => p.filter((_, j) => j !== i))
  const updQty = (i: number, v: number) =>
    setPositions(p => p.map((r, j) => j === i ? { ...r, qty: v } : r))
  const clearPos = (i: number) =>
    setPositions(p => p.map((r, j) => j === i ? { qty: r.qty } : r))
  const selectItem = useCallback((i: number, item: InventoryItem) =>
    setPositions(p => p.map((r, j) => j === i ? { ...r, name: item.name, item_id: item.id, unit: item.unit } : r)),
    [])

  async function submit() {
    const filled = positions.filter((p): p is Pos => !!(p.item_id && p.name && (p.qty ?? 0) > 0))
    if (!einsatz || !datum || !filled.length || !selectedUser) {
      alert('Bitte Einsatznummer, Datum, mindestens einen Artikel und einen Benutzer auswählen.')
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
    setPositions([{ qty: 1 }]); setSuccess(false)
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

      {itemsError && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', marginBottom: '.75rem', fontSize: 13, color: '#991b1b', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {itemsError}
        </div>
      )}

      <PubSection title="Positionen" open icon={<IconBox />}>
        {positions.map((pos, i) => (
          <div key={i} style={{ padding: '.75rem', background: 'var(--bg-subtle)', border: `0.5px solid ${pos.item_id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, marginBottom: '.6rem' }}>
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start' }}>
              {/* Qty */}
              <div style={{ flexShrink: 0, width: 72 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Anz.</div>
                <input style={{ ...inp, marginTop: 0, textAlign: 'center', padding: '10px 4px' }}
                  type="number" min={1} value={pos.qty ?? 1}
                  onChange={e => updQty(i, Number(e.target.value))} />
              </div>

              {/* Article header + clear */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: pos.item_id ? 'var(--accent)' : 'var(--text-secondary)', marginBottom: 4 }}>
                  {pos.item_id ? '✓ Artikel ausgewählt' : 'Artikel auswählen *'}
                </div>
                {pos.item_id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '0.5px solid var(--border-medium)', borderRadius: 10, padding: '10px 12px' }}>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>{pos.unit}</span>
                    <button type="button" onClick={() => clearPos(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
                  </div>
                ) : null}
              </div>

              {/* Delete row */}
              <button type="button" onClick={() => delPos(i)}
                style={{ width: 36, height: 36, borderRadius: 8, border: '0.5px solid var(--border-medium)', background: 'var(--bg-hover)', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: '1.2rem', flexShrink: 0, alignSelf: 'flex-end', marginBottom: 1 }}>
                ×
              </button>
            </div>

            {/* Article search below header row — inline, never clipped */}
            {!pos.item_id && (
              <div style={{ marginTop: '.5rem' }}>
                <ArticleSearch inventoryItems={inventoryItems} onSelect={item => selectItem(i, item)} />
              </div>
            )}
          </div>
        ))}
        <button type="button" onClick={addPos}
          style={{ border: '0.5px solid var(--border-medium)', background: 'var(--bg-subtle)', padding: '.6rem .9rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600, color: 'var(--accent)', fontSize: '.9rem', fontFamily: 'inherit' }}>
          + Position hinzufügen
        </button>
      </PubSection>

      <PubSection title="Ausgetragen von" open icon={<IconUser />}>
        <label style={lbl}>Benutzer *</label>
        <UserSearch orgId={org.id} value={selectedUser} onChange={setSelectedUser} />
      </PubSection>

    </PubWrap>
    <PubSendBar onSubmit={submit} sending={sending} label="An Lager senden" />
  </>
}

const btnStyle: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12,
  padding: '12px 24px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit'
}
