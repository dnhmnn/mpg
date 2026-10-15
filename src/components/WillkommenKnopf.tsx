// Knopf "Willkommens-E-Mail senden" mit Rückmeldung, woran es hakt
// (lib/willkommen.ts). Ohne userId geht die E-Mail als Probe an einen selbst.

import { useEffect, useState } from 'react'
import { willkommenSenden, type WillkommenErgebnis } from '../lib/willkommen'

export default function WillkommenKnopf({ userId, label = 'Willkommens-E-Mail senden' }: { userId?: string; label?: string }) {
  const [laeuft, setLaeuft] = useState(false)
  const [ergebnis, setErgebnis] = useState<WillkommenErgebnis | null>(null)
  useEffect(() => { setErgebnis(null) }, [userId])

  async function senden() {
    setLaeuft(true)
    setErgebnis(null)
    setErgebnis(await willkommenSenden(userId))
    setLaeuft(false)
  }

  return (
    <div>
      <button type="button" onClick={senden} disabled={laeuft}
        style={{ background: 'none', border: '1px solid rgba(var(--lbf-rot-rgb),0.25)', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 700, color: 'var(--lbf-akzent)', cursor: laeuft ? 'default' : 'pointer', fontFamily: 'inherit', opacity: laeuft ? 0.5 : 1 }}>
        {laeuft ? 'Wird gesendet…' : label}
      </button>
      {ergebnis && (
        <div role={ergebnis.ok ? 'status' : 'alert'} style={{ marginTop: 8, padding: '9px 12px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.45, background: ergebnis.ok ? 'var(--lbf-ok-grund)' : 'var(--lbf-fehler-grund)', color: ergebnis.ok ? 'var(--lbf-ok-text)' : 'var(--lbf-fehler-text)' }}>
          {ergebnis.text}
        </div>
      )}
    </div>
  )
}
