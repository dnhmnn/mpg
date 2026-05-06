import { useState, useEffect } from 'react'
import QRCode from 'qrcode'

interface QREntry {
  code: string
  created: string
}

const STORAGE_KEY = 'patient_qr_codes'

export default function PatientQRManager() {
  const [codes, setCodes] = useState<QREntry[]>([])
  const [count, setCount] = useState(10)
  const [qrImages, setQrImages] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setCodes(JSON.parse(saved))
  }, [])

  useEffect(() => {
    codes.forEach(entry => {
      if (!qrImages[entry.code]) {
        const url = `${window.location.origin}/p/${entry.code}`
        QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: '#000', light: '#fff' } })
          .then(dataUrl => setQrImages(prev => ({ ...prev, [entry.code]: dataUrl })))
      }
    })
  }, [codes])

  function generateCodes() {
    setGenerating(true)
    const existing = new Set(codes.map(c => c.code))
    const newEntries: QREntry[] = []
    let attempts = 0
    while (newEntries.length < count && attempts < 10000) {
      attempts++
      const code = String(Math.floor(1000 + Math.random() * 9000))
      if (!existing.has(code)) {
        existing.add(code)
        newEntries.push({ code, created: new Date().toISOString() })
      }
    }
    const updated = [...codes, ...newEntries]
    setCodes(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setGenerating(false)
  }

  function deleteCode(code: string) {
    const updated = codes.filter(c => c.code !== code)
    setCodes(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setQrImages(prev => { const n = { ...prev }; delete n[code]; return n })
  }

  function clearAll() {
    if (!confirm(`Alle ${codes.length} QR-Codes löschen?`)) return
    setCodes([])
    setQrImages({})
    localStorage.removeItem(STORAGE_KEY)
  }

  function printAll() {
    const printWindow = window.open('', '_blank', 'width=1000,height=750')
    if (!printWindow) return
    setPrinting(true)

    const cards = codes.map(entry => {
      const img = qrImages[entry.code]
      const date = new Date(entry.created).toLocaleDateString('de-DE')
      return `
        <div class="card">
          ${img ? `<img src="${img}" alt="QR ${entry.code}" />` : '<div class="qr-placeholder"></div>'}
          <div class="code">${entry.code}</div>
          <div class="label">Patientenprotokoll</div>
          <div class="date">${date}</div>
        </div>`
    }).join('')

    printWindow.document.write(`<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8">
<title>QR-Code Vorlagen</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: Arial, sans-serif; background: #fff }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6mm; padding: 10mm }
  .card {
    border: 1px solid #000; border-radius: 4mm; padding: 4mm;
    text-align: center; break-inside: avoid;
    display: flex; flex-direction: column; align-items: center; gap: 2mm;
  }
  .card img { width: 32mm; height: 32mm }
  .qr-placeholder { width: 32mm; height: 32mm; background: #eee }
  .code { font-family: monospace; font-size: 18pt; font-weight: 900; letter-spacing: 2mm; color: #c0392b }
  .label { font-size: 7pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5pt; color: #555 }
  .date { font-size: 6pt; color: #999 }
  .print-btn { position: fixed; bottom: 20px; right: 20px; background: #222; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer }
  @media print { .print-btn { display: none } }
</style></head><body>
<div class="grid">${cards}</div>
<button class="print-btn" onclick="window.print()">🖨 Drucken</button>
</body></html>`)
    printWindow.document.close()
    setPrinting(false)
  }

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('de-DE')

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '8px 14px' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Anzahl:</span>
          <input
            type="number" min={1} max={50} value={count}
            onChange={e => setCount(Math.max(1, Math.min(50, Number(e.target.value))))}
            style={{ width: 56, border: 'none', background: 'transparent', fontSize: 15, fontWeight: 700, color: 'var(--text)', textAlign: 'center', fontFamily: 'inherit' }}
          />
        </div>
        <button
          onClick={generateCodes}
          disabled={generating}
          style={{ padding: '10px 20px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          + {count} Codes generieren
        </button>
        {codes.length > 0 && (
          <>
            <button
              onClick={printAll}
              disabled={printing || Object.keys(qrImages).length < codes.length}
              style={{ padding: '10px 20px', background: 'var(--bg-card)', color: 'var(--text)', border: '0.5px solid var(--border)', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
              </svg>
              Alle drucken ({codes.length})
            </button>
            <button
              onClick={clearAll}
              style={{ marginLeft: 'auto', padding: '10px 16px', background: 'transparent', color: 'var(--text-secondary)', border: '0.5px solid var(--border)', borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Alle löschen
            </button>
          </>
        )}
      </div>

      {/* Info */}
      <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--text)' }}>Ablauf:</strong> Codes generieren → Ausdrucken → Label an Crew verteilen → Crew trägt die 4-stellige Nummer im Protokoll ein → Rettungsdienst scannt QR und sieht das Formular 24 Stunden lang.
      </div>

      {/* Empty state */}
      {codes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ opacity: 0.3, marginBottom: 14 }}>
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3"/>
          </svg>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Noch keine QR-Codes</div>
          <div style={{ fontSize: 13 }}>Oben die gewünschte Anzahl wählen und "Generieren" klicken.</div>
        </div>
      )}

      {/* QR Code Grid */}
      {codes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {codes.map(entry => (
            <div key={entry.code} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 14, textAlign: 'center', position: 'relative' }}>
              <button
                onClick={() => deleteCode(entry.code)}
                title="Löschen"
                style={{ position: 'absolute', top: 8, right: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1, padding: 2 }}
              >×</button>
              {qrImages[entry.code]
                ? <img src={qrImages[entry.code]} alt={`QR ${entry.code}`} style={{ width: 100, height: 100, display: 'block', margin: '0 auto 8px' }} />
                : <div style={{ width: 100, height: 100, background: 'var(--bg)', borderRadius: 8, margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  </div>
              }
              <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 900, letterSpacing: '0.15em', color: '#c0392b', marginBottom: 4 }}>{entry.code}</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{fmtDate(entry.created)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
