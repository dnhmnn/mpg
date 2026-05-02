import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../../lib/pocketbase'
import { useOrg } from './OrgPublicLayout'
import { PubHeader, PubWrap, PubSendBar, PubSection, field, inp, lbl } from './pubStyles'

const today = () => new Date().toISOString().slice(0, 10)

interface InventoryItem { id: string; name: string; unit: string; min_stock: number }
type Pos = { qty: number; name: string; item_id?: string; unit?: string }

export default function OrgProduktausgabe() {
  const { org, orgCode } = useOrg()
  const navigate = useNavigate()
  const [einsatz, setEinsatz] = useState('')
  const [datum, setDatum] = useState(today())
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [positions, setPositions] = useState<Pos[]>([{ qty: 1, name: '' }])
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [activeSearch, setActiveSearch] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState<string[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    pb.collection('inventory_items').getFullList<InventoryItem>({
      filter: `organization_id = "${org.id}"`,
      sort: 'name',
    }).then(items => setInventoryItems(items)).catch(() => {})
  }, [org.id])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveSearch(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const getSuggestions = (idx: number) => {
    const q = (searchQuery[idx] ?? '').toLowerCase()
    if (!q) return []
    return inventoryItems.filter(it => it.name.toLowerCase().includes(q)).slice(0, 8)
  }

  const addPos = () => {
    setPositions(p => [...p, { qty: 1, name: '' }])
    setSearchQuery(q => [...q, ''])
  }
  const delPos = (i: number) => {
    setPositions(p => p.filter((_, j) => j !== i))
    setSearchQuery(q => q.filter((_, j) => j !== i))
  }
  const updPosQty = (i: number, v: number) =>
    setPositions(p => p.map((r, j) => j === i ? { ...r, qty: v } : r))

  const setSearchAt = (i: number, val: string) => {
    setSearchQuery(q => { const n = [...q]; n[i] = val; return n })
    setPositions(p => p.map((r, j) => j === i ? { ...r, name: val, item_id: undefined, unit: undefined } : r))
    setActiveSearch(i)
  }

  const selectItem = (i: number, item: InventoryItem) => {
    setPositions(p => p.map((r, j) => j === i ? { ...r, name: item.name, item_id: item.id, unit: item.unit } : r))
    setSearchQuery(q => { const n = [...q]; n[i] = item.name; return n })
    setActiveSearch(null)
  }

  async function submit() {
    const filled = positions.filter(p => p.qty > 0 && p.name.trim())
    if (!einsatz || !datum || !filled.length || !vorname || !nachname) {
      alert('Bitte alle Pflichtfelder ausfüllen.')
      return
    }
    setSending(true)
    try {
      const deDate = datum.split('-').reverse().join('.')
      await pb.collection('product_outputs').create({
        title: `Produktausgabe ${einsatz} (${deDate})`,
        payload: { einsatz, datum, vorname, nachname, positionen: filled },
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
    setEinsatz(''); setDatum(today()); setVorname(''); setNachname('')
    setPositions([{ qty: 1, name: '' }]); setSearchQuery([]); setSuccess(false)
  }

  if (success) return (
    <PubWrap>
      <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 20, padding: 32, textAlign: 'center', maxWidth: 480, margin: '2rem auto', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ width: 56, height: 56, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.75rem' }}>✅</div>
        <h2 style={{ color: 'var(--text)', margin: '0 0 .5rem', fontSize: '1.2rem' }}>Erfolgreich gespeichert!</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: '1.5rem' }}>Die Ausgabe wurde an die Lagerverwaltung weitergeleitet.</p>
        <button style={btnStyle} onClick={reset}>+ Neue Ausgabe</button>
      </div>
    </PubWrap>
  )

  return <>
    <PubHeader title={`Produktausgabe – ${org.org_name}`} onBack={() => navigate(`/${orgCode}`)} />
    <PubWrap>

      <PubSection title="📋 Kopfdaten" open>
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

      <PubSection title="📦 Positionen" open>
        <div ref={dropdownRef}>
          {positions.map((pos, i) => {
            const suggestions = getSuggestions(i)
            const showDrop = activeSearch === i && suggestions.length > 0
            return (
              <div key={i} style={{ marginBottom: '.6rem' }}>
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', padding: '.75rem', background: 'var(--bg-subtle)', border: `0.5px solid ${pos.item_id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12 }}>
                  {/* Qty */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Anz.</span>
                    <input
                      style={{ ...inp, width: 72, marginTop: 0, textAlign: 'center' }}
                      type="number" min={1} value={pos.qty}
                      onChange={e => updPosQty(i, Number(e.target.value))}
                    />
                  </div>

                  {/* Article search */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {pos.item_id ? '✓ Artikel aus Lager' : 'Artikel suchen…'}
                    </span>
                    <input
                      style={{ ...inp, marginTop: 2 }}
                      type="text"
                      placeholder="Artikelname eingeben…"
                      value={searchQuery[i] ?? pos.name}
                      onChange={e => setSearchAt(i, e.target.value)}
                      onFocus={() => { setActiveSearch(i) }}
                    />
                    {showDrop && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-elevated)', border: '0.5px solid var(--border-medium)', borderRadius: 10, boxShadow: 'var(--shadow-md)', zIndex: 50, overflow: 'hidden', marginTop: 2 }}>
                        {suggestions.map(item => (
                          <button
                            key={item.id}
                            onMouseDown={e => { e.preventDefault(); selectItem(i, item) }}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', borderBottom: '0.5px solid var(--border)', color: 'var(--text)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0, marginLeft: 8 }}>{item.unit}</span>
                          </button>
                        ))}
                        <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', borderTop: '0.5px solid var(--border)' }}>
                          {suggestions.length} Treffer · Nicht dabei?{' '}
                          <span
                            style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                            onMouseDown={e => { e.preventDefault(); setActiveSearch(null) }}
                          >
                            Freitext verwenden
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Unit label if known */}
                  {pos.unit && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Einheit</span>
                      <div style={{ ...inp, marginTop: 2, width: 72, color: 'var(--text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pos.unit}</div>
                    </div>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => delPos(i)}
                    style={{ width: 36, height: 36, borderRadius: 8, border: '0.5px solid var(--border-medium)', background: 'var(--bg-hover)', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0, marginTop: 18 }}
                  >×</button>
                </div>
              </div>
            )
          })}
        </div>
        <button
          onClick={addPos}
          style={{ border: '0.5px solid var(--border-medium)', background: 'var(--bg-subtle)', padding: '.6rem .9rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600, color: 'var(--accent)', fontSize: '.9rem', fontFamily: 'inherit', marginTop: '.25rem' }}
        >
          + Position hinzufügen
        </button>
      </PubSection>

      <PubSection title="👤 Ausgetragen von" open>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem' }}>
          <div style={field}><label style={lbl}>Vorname *<input style={inp} type="text" value={vorname} onChange={e => setVorname(e.target.value)} /></label></div>
          <div style={field}><label style={lbl}>Nachname *<input style={inp} type="text" value={nachname} onChange={e => setNachname(e.target.value)} /></label></div>
        </div>
      </PubSection>

    </PubWrap>
    <PubSendBar onSubmit={submit} sending={sending} label="An Lager senden" />
  </>
}

const btnStyle: React.CSSProperties = { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit' }
