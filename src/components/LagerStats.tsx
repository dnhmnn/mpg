import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { pb } from '../lib/pocketbase'

interface TxRow { item_id: string; type: string; quantity: number; note?: string; created: string }
interface Props { orgId: string; items: { id: string; name: string; unit?: string }[]; onChanged?: () => void }

// Validierte Chart-Farben (hell + dunkel geprüft): Ausbuchung Rot, Einbuchung Grün
const RED = '#b91c1c'
const GREEN = '#16a34a'
const AXIS = { fontSize: 11, fill: 'var(--warm-gray)', fontFamily: 'inherit' }

interface TxRowId extends TxRow { id: string }

export default function LagerStats({ orgId, items, onChanged }: Props) {
  const [months, setMonths] = useState(6)
  const [txns, setTxns] = useState<TxRow[] | null>(null)
  const [error, setError] = useState('')
  const [resetting, setResetting] = useState(false)

  // Buchungshistorie der Organisation löschen — Statistik & Verlauf werden geleert,
  // die aktuellen Bestände (inventory_stock) bleiben unverändert.
  async function resetBuchungen() {
    if (resetting) return
    if (!confirm('Alle Buchungen (Ein-/Ausbuchungen, Korrekturen) dieser Organisation löschen?\n\nDie Statistik und der Verlauf werden geleert. Die aktuellen Bestände bleiben unverändert. Das lässt sich NICHT rückgängig machen.')) return
    if (!confirm('Wirklich sicher? Die komplette Buchungshistorie wird endgültig gelöscht.')) return
    setResetting(true)
    try {
      let total = 0
      // In Blöcken laden und löschen, bis nichts mehr übrig ist
      // (getFullList kann viele Datensätze liefern — batchweise abarbeiten)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const batch = await pb.collection('inventory_transactions').getList<TxRowId>(1, 200, {
          filter: `organization_id = "${orgId}"`,
          fields: 'id',
          requestKey: `lager-reset-${Date.now()}`,
        })
        if (!batch.items.length) break
        for (const t of batch.items) await pb.collection('inventory_transactions').delete(t.id)
        total += batch.items.length
        if (batch.items.length < 200) break
      }
      setTxns([])
      onChanged?.()
      alert(`${total} Buchung(en) gelöscht. Die Statistik ist zurückgesetzt.`)
    } catch (e: any) {
      alert('Fehler beim Zurücksetzen: ' + (e?.message || e))
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setTxns(null)
    setError('')
    const since = new Date()
    since.setMonth(since.getMonth() - months)
    pb.collection('inventory_transactions').getFullList<TxRow>({
      filter: `organization_id = "${orgId}" && created >= "${since.toISOString().slice(0, 10)} 00:00:00"`,
      fields: 'item_id,type,quantity,note,created',
      requestKey: `lager-stats-${months}-${Date.now()}`,
    })
      .then(list => { if (!cancelled) setTxns(list) })
      .catch(e => { if (!cancelled) setError(e?.message || 'Fehler beim Laden') })
    return () => { cancelled = true }
  }, [orgId, months])

  const { top, monthly, totalOut, totalIn } = useMemo(() => {
    // Umlagerungen sind kein echter Verbrauch/Zugang — ausklammern
    const real = (txns || []).filter(t => !(t.note || '').startsWith('Umlagerung'))
    const byItem: Record<string, number> = {}
    const byMonth: Record<string, { ein: number; aus: number }> = {}
    let totalOut = 0
    let totalIn = 0
    for (const t of real) {
      const q = Math.abs(t.quantity || 0)
      const m = (t.created || '').slice(0, 7)
      if (!byMonth[m]) byMonth[m] = { ein: 0, aus: 0 }
      if (t.type === 'ausbuchung') { byItem[t.item_id] = (byItem[t.item_id] || 0) + q; byMonth[m].aus += q; totalOut += q }
      else if (t.type === 'einbuchung') { byMonth[m].ein += q; totalIn += q }
    }
    const nameOf = (id: string) => {
      const n = items.find(i => i.id === id)?.name || 'Unbekannt'
      return n.length > 24 ? n.slice(0, 23) + '…' : n
    }
    const top = Object.entries(byItem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, qty]) => ({ name: nameOf(id), qty }))
    const monthly: { monat: string; ein: number; aus: number }[] = []
    const now = new Date()
    for (let i = months - 1; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      monthly.push({
        monat: dt.toLocaleDateString('de-DE', { month: 'short', ...(months > 6 ? { year: '2-digit' } : {}) }),
        ein: byMonth[key]?.ein || 0,
        aus: byMonth[key]?.aus || 0,
      })
    }
    return { top, monthly, totalOut, totalIn }
  }, [txns, items, months])

  const tooltipStyle = {
    background: 'var(--lbf-card)', border: '1px solid rgba(96,8,18,0.15)', borderRadius: 8,
    fontSize: 12, fontFamily: 'inherit', color: 'var(--lbf-text)',
  }

  return (
    <div>
      {/* Zeitraum-Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([[3, '3 Monate'], [6, '6 Monate'], [12, '12 Monate']] as const).map(([m, label]) => (
          <button key={m} onClick={() => setMonths(m)} style={{ padding: '6px 14px', borderRadius: 999, border: months === m ? '1.5px solid #600812' : '1px solid rgba(96,8,18,0.15)', background: months === m ? '#600812' : 'transparent', color: months === m ? '#fff' : 'var(--warm-gray)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 14, borderRadius: 10, fontSize: 13 }}>{error}</div>
      ) : txns === null ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Lade Statistik…</div>
      ) : totalIn + totalOut === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Keine Buchungen im gewählten Zeitraum.</div>
      ) : (
        <>
          {/* Kennzahlen */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div style={{ background: 'rgba(250,249,247,0.8)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, textTransform: 'uppercase' as const, letterSpacing: '0.14em' }}>Eingebucht</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--lbf-text)', lineHeight: 1.15 }}>{totalIn}</div>
            </div>
            <div style={{ background: 'rgba(250,249,247,0.8)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: RED, textTransform: 'uppercase' as const, letterSpacing: '0.14em' }}>Verbraucht</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--lbf-text)', lineHeight: 1.15 }}>{totalOut}</div>
            </div>
          </div>

          {/* Monatsverlauf Ein/Aus */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Buchungen pro Monat</div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--warm-gray)' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: GREEN }} /> Einbuchungen</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--warm-gray)' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: RED }} /> Ausbuchungen</span>
          </div>
          <div style={{ width: '100%', height: 190, marginBottom: 22 }}>
            <ResponsiveContainer>
              <BarChart data={monthly} barCategoryGap="25%" barGap={2} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--lbf-border-light, rgba(96,8,18,0.08))" />
                <XAxis dataKey="monat" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(96,8,18,0.05)' }}
                  formatter={(v: number, key: string) => [v, key === 'ein' ? 'Einbuchungen' : 'Ausbuchungen']} />
                <Bar dataKey="ein" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="aus" fill={RED} radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top-Artikel nach Verbrauch */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 8 }}>Top-Artikel nach Verbrauch</div>
          {top.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 13 }}>Noch kein Verbrauch im Zeitraum.</div>
          ) : (
            <div style={{ width: '100%', height: Math.max(120, top.length * 30 + 12) }}>
              <ResponsiveContainer>
                <BarChart data={top} layout="vertical" barCategoryGap="28%" margin={{ top: 0, right: 34, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={150} tick={{ ...AXIS, fill: 'var(--lbf-text)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(96,8,18,0.05)' }} formatter={(v: number) => [v, 'Verbrauch']} />
                  <Bar dataKey="qty" fill={RED} radius={[0, 4, 4, 0]} maxBarSize={16}>
                    <LabelList dataKey="qty" position="right" style={{ fontSize: 11, fill: 'var(--lbf-text)', fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Zurücksetzen */}
      {txns !== null && txns.length > 0 && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '0.5px solid rgba(96,8,18,0.12)' }}>
          <button onClick={resetBuchungen} disabled={resetting}
            style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid rgba(220,38,38,0.35)', background: 'transparent', color: '#dc2626', fontWeight: 700, fontSize: 13, cursor: resetting ? 'default' : 'pointer', fontFamily: 'inherit', opacity: resetting ? 0.6 : 1 }}>
            {resetting ? 'Wird zurückgesetzt…' : 'Buchungen zurücksetzen'}
          </button>
          <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 6, textAlign: 'center' as const }}>
            Löscht die komplette Buchungshistorie. Die aktuellen Bestände bleiben unverändert.
          </div>
        </div>
      )}
    </div>
  )
}
