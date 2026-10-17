import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { pb } from '../lib/pocketbase'
import { journalSummen } from '../lib/lagerRechnung'

interface TxRow { item_id: string; type: string; quantity: number; note?: string; created: string }
interface Props {
  orgId: string
  items: { id: string; name: string; unit?: string }[]
  /** Zählt erst ab diesem Tag (PocketBase-Datum) — statt Buchungen zu löschen */
  statistikAb?: string | null
  /** Nur mit „Lager verwalten“: neuen Beginn setzen (YYYY-MM-DD) oder aufheben (null) */
  onStatistikAb?: (datum: string | null) => Promise<void>
}

// Validierte Chart-Farben (hell + dunkel geprüft): Ausbuchung Rot, Einbuchung Grün
const RED = '#b91c1c'
const GREEN = '#16a34a'
const AXIS = { fontSize: 11, fill: 'var(--warm-gray)', fontFamily: 'inherit' }

export default function LagerStats({ orgId, items, statistikAb, onStatistikAb }: Props) {
  const [months, setMonths] = useState(6)
  const [txns, setTxns] = useState<TxRow[] | null>(null)
  const [error, setError] = useState('')
  const [abEingabe, setAbEingabe] = useState('')
  const [abSpeichert, setAbSpeichert] = useState(false)

  // Buchungen werden nicht mehr gelöscht (das Journal ist der Nachweis). Wer die
  // Statistik neu beginnen will, setzt „ab Datum“ — ältere Buchungen bleiben im Logbuch.
  async function setzeAb(datum: string | null) {
    if (!onStatistikAb || abSpeichert) return
    setAbSpeichert(true)
    try { await onStatistikAb(datum); setAbEingabe('') }
    catch (e: any) { alert('Nicht gespeichert: ' + (e?.message || e)) }
    finally { setAbSpeichert(false) }
  }

  useEffect(() => {
    let cancelled = false
    setTxns(null)
    setError('')
    const since = new Date()
    since.setMonth(since.getMonth() - months)
    let ab = `${since.toISOString().slice(0, 10)} 00:00:00`
    // Statistik ab Datum: der spätere der beiden Anfänge
    if (statistikAb && statistikAb.slice(0, 19).replace('T', ' ') > ab) ab = statistikAb.slice(0, 19).replace('T', ' ')
    pb.collection('inventory_transactions').getFullList<TxRow>({
      filter: pb.filter('organization_id = {:o} && created >= {:ab}', { o: orgId, ab }),
      fields: 'item_id,type,quantity,note,created',
      requestKey: `lager-stats-${months}-${Date.now()}`,
    })
      .then(list => { if (!cancelled) setTxns(list) })
      .catch(e => { if (!cancelled) setError(e?.message || 'Fehler beim Laden') })
    return () => { cancelled = true }
  }, [orgId, months, statistikAb])

  const { top, monthly, totalOut, totalIn } = useMemo(() => {
    // Mit Vorzeichen gerechnet: Eine zurückgenommene Buchung („Rückgängig“) gleicht sich
    // aus, statt doppelt zu zählen. Umlagerungen sind weder Verbrauch noch Zugang.
    const s = journalSummen(txns || [])
    const byItem = s.ausJeArtikel
    const byMonth = s.jeMonat
    const totalOut = Math.max(0, s.aus)
    const totalIn = Math.max(0, s.ein)
    const nameOf = (id: string) => {
      const n = items.find(i => i.id === id)?.name || 'Unbekannt'
      return n.length > 24 ? n.slice(0, 23) + '…' : n
    }
    const top = Object.entries(byItem)
      .filter(([, qty]) => qty > 0)
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
        ein: Math.max(0, byMonth[key]?.ein || 0),
        aus: Math.max(0, byMonth[key]?.aus || 0),
      })
    }
    return { top, monthly, totalOut, totalIn }
  }, [txns, items, months])

  const tooltipStyle = {
    background: 'var(--lbf-card)', border: '1px solid rgba(var(--lbf-rot-rgb),0.15)', borderRadius: 8,
    fontSize: 12, fontFamily: 'inherit', color: 'var(--lbf-text)',
  }

  return (
    <div>
      {/* Zeitraum-Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([[3, '3 Monate'], [6, '6 Monate'], [12, '12 Monate']] as const).map(([m, label]) => (
          <button key={m} onClick={() => setMonths(m)} style={{ padding: '6px 14px', borderRadius: 999, border: months === m ? '1.5px solid var(--lbf-akzent)' : '1px solid rgba(var(--lbf-rot-rgb),0.15)', background: months === m ? 'var(--lbf-akzent-grund)' : 'transparent', color: months === m ? '#fff' : 'var(--warm-gray)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div style={{ background: 'var(--lbf-fehler-grund)', border: '1px solid #fecaca', color: 'var(--lbf-fehler-text-2)', padding: 14, borderRadius: 10, fontSize: 13 }}>{error}</div>
      ) : txns === null ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Lade Statistik…</div>
      ) : totalIn + totalOut === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Keine Buchungen im gewählten Zeitraum.</div>
      ) : (
        <>
          {/* Kennzahlen */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div style={{ background: 'var(--lbf-fuss)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, textTransform: 'uppercase' as const, letterSpacing: '0.14em' }}>Eingebucht</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--lbf-text)', lineHeight: 1.15 }}>{totalIn}</div>
            </div>
            <div style={{ background: 'var(--lbf-fuss)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-fehler-text-2)', textTransform: 'uppercase' as const, letterSpacing: '0.14em' }}>Verbraucht</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--lbf-text)', lineHeight: 1.15 }}>{totalOut}</div>
            </div>
          </div>

          {/* Monatsverlauf Ein/Aus */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Buchungen pro Monat</div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--warm-gray)' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: GREEN }} /> Einbuchungen</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--warm-gray)' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: RED }} /> Ausbuchungen</span>
          </div>
          <div style={{ width: '100%', height: 190, marginBottom: 22 }}>
            <ResponsiveContainer>
              <BarChart data={monthly} barCategoryGap="25%" barGap={2} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--lbf-border-light, rgba(var(--lbf-rot-rgb),0.08))" />
                <XAxis dataKey="monat" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(var(--lbf-rot-rgb),0.05)' }}
                  formatter={(v: number, key: string) => [v, key === 'ein' ? 'Einbuchungen' : 'Ausbuchungen']} />
                <Bar dataKey="ein" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="aus" fill={RED} radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top-Artikel nach Verbrauch */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 8 }}>Top-Artikel nach Verbrauch</div>
          {top.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--warm-gray)', fontStyle: 'italic', fontSize: 13 }}>Noch kein Verbrauch im Zeitraum.</div>
          ) : (
            <div style={{ width: '100%', height: Math.max(120, top.length * 30 + 12) }}>
              <ResponsiveContainer>
                <BarChart data={top} layout="vertical" barCategoryGap="28%" margin={{ top: 0, right: 34, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={150} tick={{ ...AXIS, fill: 'var(--lbf-text)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(var(--lbf-rot-rgb),0.05)' }} formatter={(v: number) => [v, 'Verbrauch']} />
                  <Bar dataKey="qty" fill={RED} radius={[0, 4, 4, 0]} maxBarSize={16}>
                    <LabelList dataKey="qty" position="right" style={{ fontSize: 11, fill: 'var(--lbf-text)', fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Statistik ab Datum (statt Buchungen löschen) */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '0.5px solid var(--lbf-border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 4 }}>Statistik ab Datum</div>
        <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginBottom: 10 }}>
          {statistikAb ? `Gezählt wird ab ${new Date(statistikAb.replace(' ', 'T')).toLocaleDateString('de-DE')}. ` : 'Gezählt wird der gewählte Zeitraum. '}
          Buchungen werden nie gelöscht — ältere bleiben im Logbuch.
        </div>
        {onStatistikAb ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
            <input className="lager-input" type="date" value={abEingabe} onChange={e => setAbEingabe(e.target.value)} style={{ flex: '1 1 160px' }} />
            <button className="lager-btn primary" disabled={!abEingabe || abSpeichert} onClick={() => setzeAb(abEingabe)}>Ab diesem Tag zählen</button>
            {statistikAb && <button className="lager-btn" disabled={abSpeichert} onClick={() => setzeAb(null)}>Aufheben</button>}
          </div>
        ) : (
          <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>Ändern kann das, wer „Lager verwalten“ hat.</div>
        )}
      </div>
    </div>
  )
}
