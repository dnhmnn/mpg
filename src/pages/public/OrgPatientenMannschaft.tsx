// Besatzung und QR-Code der alten Patientendoku (Bauplan v2, 4.5).
//
// Hier entsteht KEIN Datensatz mehr vor dem Absenden. Früher legte „Mannschaft
// speichern“ einen Entwurf in PocketBase an, und die Maske schrieb ihn laufend
// nach; das ging ohne jeden Absender. Jetzt gibt die Besatzung ihre Namen nach
// oben (`onMannschaft`), der QR-Code bleibt im Gerät (`onQrSaved`). Beides geht
// erst mit dem Absenden raus, über den Server, der den Absender prüft und die
// Besatzung verknüpft. Der Patientenzugang über den Code gilt deshalb erst nach
// dem Absenden.

import { useEffect, useState } from 'react'
import { inp, lbl } from './pubStyles'
import BesatzungNamen from './absender/BesatzungNamen'
import type { Namen } from './doku/besatzung'

const iconMannschaft = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
)

const iconQR = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3"/>
  </svg>
)

const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? 'var(--bg-hover)' : 'var(--accent)',
  color: disabled ? 'var(--text-secondary)' : '#fff',
  border: 'none', borderRadius: 10, padding: '10px 20px',
  fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '.95rem', fontFamily: 'inherit',
})

export default function OrgPatientenMannschaft({
  orgCode, namen, onMannschaft, mitAnmeldung = false, onQrSaved, qrGespeichert = '',
}: {
  orgCode: string
  /** Die vier Namen, wie sie in der Maske stehen. */
  namen: Namen
  /** Jede Änderung geht sofort nach oben; „Besatzung übernehmen“ bestätigt es nur sichtbar. */
  onMannschaft: (namen: Namen) => void
  /** Namensprüfung mit Token (angemeldet, nicht „Anderer Absender“). */
  mitAnmeldung?: boolean
  onQrSaved?: (code: string, created: string) => void
  /** Ein schon gemerkter Code (aus dem Entwurf). */
  qrGespeichert?: string
}) {
  const [uebernommen, setUebernommen] = useState(false)
  const [qrCode, setQrCode] = useState(qrGespeichert)
  const [qrSaved, setQrSaved] = useState(Boolean(qrGespeichert))
  const [qrFehler, setQrFehler] = useState('')
  // Ein Code aus dem Entwurf kommt erst nach dem Einhängen an
  useEffect(() => {
    if (qrGespeichert) { setQrCode(qrGespeichert); setQrSaved(true) }
  }, [qrGespeichert])

  function aendern(n: Namen) {
    onMannschaft(n)
    setUebernommen(false)
  }

  function saveQr() {
    const code = qrCode.trim()
    if (code.length !== 4) { setQrFehler('Bitte eine 4-stellige Nummer eingeben.'); return }
    setQrFehler('')
    onQrSaved?.(code, new Date().toISOString())
    setQrSaved(true)
  }

  return (
    <>
      {/* Mannschaft card */}
      <div style={{ background: 'var(--bg-card)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '0.5px solid var(--border)', borderRadius: 16, marginBottom: '.75rem', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '.9rem 1rem', fontWeight: 700, fontSize: '1rem', color: 'var(--text)', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          {iconMannschaft} Mannschaft
        </div>
        <div style={{ padding: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <BesatzungNamen orgCode={orgCode} namen={namen} onNamen={aendern} mitAnmeldung={mitAnmeldung} spalten />
          </div>
          {uebernommen ? (
            <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '.9rem' }}>Übernommen.</div>
          ) : (
            <button type="button" onClick={() => { onMannschaft(namen); setUebernommen(true) }} style={btnPrimary(false)}>
              Besatzung übernehmen
            </button>
          )}
        </div>
      </div>

      {/* QR-Code card */}
      <div style={{ background: 'var(--bg-card)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '0.5px solid var(--border)', borderRadius: 16, marginBottom: '.75rem', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '.9rem 1rem', fontWeight: 700, fontSize: '1rem', color: 'var(--text)', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          {iconQR} QR-Code für Rettungsdienst
        </div>
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div style={{ flex: '0 0 auto' }}>
              <label style={lbl}>4-stelliger Code</label>
              <input
                style={{ ...inp, width: 100, letterSpacing: '0.2em', fontWeight: 800, fontSize: '1.3rem', textAlign: 'center', color: '#c0392b', margin: 0 }}
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="0000"
                value={qrCode}
                onChange={e => { setQrCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setQrSaved(false) }}
              />
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', paddingBottom: 10, lineHeight: 1.4 }}>
              Nummer vom gedruckten QR-Label eingeben.<br/>
              Rettungsdienst kann das Protokoll 24 h einsehen.
            </span>
          </div>
          {qrFehler && (
            <div style={{ background: 'var(--lbf-warn-grund-4)', border: '0.5px solid #eab308', borderRadius: 8, padding: '8px 12px', fontSize: '.85rem', color: 'var(--lbf-warn-text-4)', marginBottom: '.75rem' }}>
              {qrFehler}
            </div>
          )}
          {qrSaved ? (
            <div>
              <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '.9rem' }}>QR-Code {qrCode} gemerkt</div>
              <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 4 }}>
                Der Zugang über den Code gilt, sobald das Protokoll abgesendet ist.
              </div>
            </div>
          ) : (
            <button type="button" disabled={qrCode.length !== 4} onClick={saveQr}
              style={btnPrimary(qrCode.length !== 4)}>
              QR-Code merken
            </button>
          )}
        </div>
      </div>
    </>
  )
}
