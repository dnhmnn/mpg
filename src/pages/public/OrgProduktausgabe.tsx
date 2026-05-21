import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { useOrg } from './OrgPublicLayout'
import { PubWrap, PubSendBar, PubSection, PubHeader, field, inp, lbl } from './pubStyles'

const today = () => new Date().toISOString().slice(0, 10)

interface InventoryItem { id: string; name: string; unit: string }
interface UserHit { id: string; name: string; email: string }
interface Location { id: string; name: string }
type Pos = { qty: number; name: string; item_id: string; unit: string }

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderLeft: '3px solid #600812', borderRadius: 12, marginBottom: '.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div style={{ padding: '.85rem 1rem', fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: '0.5px solid rgba(96,8,18,0.08)' }}>
        {title}
      </div>
      <div style={{ padding: '1rem' }}>{children}</div>
    </div>
  )
}

function UserSearch({ orgId, value, onChange }: {
  orgId: string; value: UserHit | null; onChange: (u: UserHit | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserHit[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
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
      } catch {
        setResults([])
        setOpen(true)
      }
    }, 350)
  }

  function select(u: UserHit) {
    onChange(u); setQuery(''); setResults([]); setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', marginTop: 8 }}>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(96,8,18,0.04)', border: '1.5px solid rgba(96,8,18,0.15)', borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#600812', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontStyle: 'italic', fontSize: 13, flexShrink: 0 }}>
            {value.name.charAt(0).toUpperCase()}
          </div>
          <span style={{ flex: 1, fontWeight: 700, fontStyle: 'italic', color: '#1a0e08', fontSize: 14 }}>{value.name}</span>
          <button type="button" onClick={() => onChange(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
      ) : (
        <input style={inp} type="text" value={query} onChange={e => onInput(e.target.value)} placeholder="Name suchen…" />
      )}
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid rgba(96,8,18,0.15)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
          {results.map(u => (
            <button key={u.id} type="button" onMouseDown={() => select(u)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '10px 12px', cursor: 'pointer', textAlign: 'left', borderBottom: '0.5px solid rgba(96,8,18,0.08)', fontFamily: 'inherit' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#600812', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontStyle: 'italic', fontSize: 13, flexShrink: 0 }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: 14, color: '#1a0e08' }}>{u.name}</div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && query.trim() && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid rgba(96,8,18,0.15)', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)', zIndex: 50, marginTop: 2 }}>
          Kein Benutzer gefunden
        </div>
      )}
    </div>
  )
}

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
        <div style={{ background: '#fff', border: '1px solid rgba(96,8,18,0.15)', borderRadius: 10, marginTop: 4, overflow: 'hidden', maxHeight: 280, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
          {suggestions.map((item, idx) => (
            <button key={item.id} type="button" onMouseDown={() => select(item)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: idx < suggestions.length - 1 ? '0.5px solid rgba(96,8,18,0.08)' : 'none', color: '#1a0e08' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</span>
              <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', flexShrink: 0, marginLeft: 8 }}>{item.unit}</span>
            </button>
          ))}
        </div>
      )}
      {open && inventoryItems.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid rgba(96,8,18,0.15)', borderRadius: 10, marginTop: 4, padding: '12px 14px', fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
          Keine Artikel in der Datenbank
        </div>
      )}
      {open && suggestions.length === 0 && inventoryItems.length > 0 && query.trim() && (
        <div style={{ background: '#fff', border: '1px solid rgba(96,8,18,0.15)', borderRadius: 10, marginTop: 4, padding: '12px 14px', fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
          Kein Artikel gefunden
        </div>
      )}
    </div>
  )
}

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
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLagerId, setSelectedLagerId] = useState('')

  useEffect(() => {
    pb.collection('inventory_items').getFullList<InventoryItem>({
      filter: `organization_id = "${org.id}"`,
      sort: 'name',
    }).then(items => setInventoryItems(items)).catch(e => console.error('inventory_items:', e))
    pb.collection('inventory_locations').getFullList<Location>({
      filter: `organization_id = "${org.id}"`,
      sort: 'name',
    }).then(async locs => {
      if (locs.length === 0) {
        const defaultLoc = await pb.collection('inventory_locations').create({
          name: 'Lager', icon: 'box', organization_id: org.id,
        })
        setLocations([defaultLoc as unknown as Location])
        setSelectedLagerId(defaultLoc.id)
      } else {
        setLocations(locs)
        if (locs.length === 1) setSelectedLagerId(locs[0].id)
      }
    }).catch(e => console.error('inventory_locations:', e))
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
    if (!selectedLagerId) {
      alert('Bitte einen Verbrauchsort auswählen.')
      return
    }
    setSending(true)
    try {
      const deDate = datum.split('-').reverse().join('.')
      const lagerName = locations.find(l => l.id === selectedLagerId)?.name ?? ''
      await pb.collection('product_outputs').create({
        title: `Produktausgabe ${einsatz} (${deDate})`,
        payload: {
          einsatz, datum,
          user_id: selectedUser.id,
          user_name: selectedUser.name,
          lager_id: selectedLagerId,
          lager_name: lagerName,
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
    setPositions([{ qty: 1 }]); setSuccess(false); setSelectedLagerId('')
  }

  if (success) return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ background: '#fff', borderLeft: '3px solid #16a34a', borderRadius: 12, padding: 32, textAlign: 'center', maxWidth: 400, width: '100%', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
        <div style={{ width: 52, height: 52, background: 'rgba(22,163,74,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 20, color: '#1a0e08', marginBottom: 8 }}>Erfolgreich gespeichert</div>
        <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--warm-gray)', marginBottom: 24 }}>Die Ausgabe wurde an die Lagerverwaltung weitergeleitet.</div>
        <button style={{ background: '#600812', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em' }} onClick={reset}>
          Neue Ausgabe
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)' }}>
      <PubHeader title="Produktausgabe" onBack={() => navigate(`/${orgCode}`)} />
      <PubWrap>

        <PubSection title="Kopfdaten" open>
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

        <Card title="Positionen">
          {positions.map((pos, i) => (
            <div key={i} style={{ padding: '.75rem', background: pos.item_id ? 'rgba(96,8,18,0.03)' : 'var(--warm-bg)', border: `1.5px solid ${pos.item_id ? 'rgba(96,8,18,0.2)' : 'rgba(96,8,18,0.1)'}`, borderRadius: 10, marginBottom: '.6rem' }}>
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: 72 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Anz.</div>
                  <input style={{ ...inp, marginTop: 0, textAlign: 'center', padding: '10px 4px' }}
                    type="number" min={1} value={pos.qty ?? 1}
                    onChange={e => updQty(i, Number(e.target.value))} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: pos.item_id ? '#16a34a' : '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    {pos.item_id ? 'Artikel ausgewählt' : 'Artikel auswählen *'}
                  </div>
                  {pos.item_id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid rgba(96,8,18,0.15)', borderRadius: 10, padding: '10px 12px' }}>
                      <span style={{ flex: 1, fontWeight: 700, fontStyle: 'italic', fontSize: 14, color: '#1a0e08', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.name}</span>
                      <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', flexShrink: 0 }}>{pos.unit}</span>
                      <button type="button" onClick={() => clearPos(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 20, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
                    </div>
                  ) : null}
                </div>
                <button type="button" onClick={() => delPos(i)}
                  style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(96,8,18,0.15)', background: 'rgba(96,8,18,0.05)', color: '#600812', fontWeight: 700, cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0, alignSelf: 'flex-end', marginBottom: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ×
                </button>
              </div>
              {!pos.item_id && (
                <div style={{ marginTop: '.5rem' }}>
                  <ArticleSearch inventoryItems={inventoryItems} onSelect={item => selectItem(i, item)} />
                </div>
              )}
            </div>
          ))}
          <button type="button" onClick={addPos}
            style={{ border: '1px solid rgba(96,8,18,0.15)', background: 'rgba(96,8,18,0.05)', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, color: '#600812', fontSize: 13, fontFamily: 'inherit', letterSpacing: '0.02em' }}>
            + Position hinzufügen
          </button>
        </Card>

        <Card title="Verbrauchsort *">
          {locations.length === 0 ? (
            <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--warm-gray)' }}>Keine Verbrauchsorte gefunden</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {locations.map(loc => (
                <button key={loc.id} type="button" onClick={() => setSelectedLagerId(loc.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: selectedLagerId === loc.id ? '1.5px solid #600812' : '1.5px solid rgba(96,8,18,0.12)', background: selectedLagerId === loc.id ? 'rgba(96,8,18,0.05)' : '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: selectedLagerId === loc.id ? '2px solid #600812' : '2px solid rgba(96,8,18,0.2)', background: selectedLagerId === loc.id ? '#600812' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedLagerId === loc.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <span style={{ fontWeight: selectedLagerId === loc.id ? 700 : 400, fontStyle: selectedLagerId === loc.id ? 'italic' : 'normal', fontSize: 15, color: '#1a0e08' }}>{loc.name}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="Ausgetragen von">
          <label style={lbl}>Benutzer *</label>
          <UserSearch orgId={org.id} value={selectedUser} onChange={setSelectedUser} />
        </Card>

      </PubWrap>
      <PubSendBar onSubmit={submit} sending={sending} label="An Lager senden" small />
    </div>
  )
}
