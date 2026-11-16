// Schalterzeile wie SchalterZeile aus benutzer/bausteine.tsx (gleiches Aussehen, gleiche Klassen),
// dazu eine Kennung für die Browserprobe (data-probe). role="switch", ganze Zeile tippbar (48 px).

import type React from 'react'

export function Schalter({ titel, unter, an, onChange, disabled, probe }: {
  titel: string; unter?: React.ReactNode; an: boolean; onChange: (an: boolean) => void; disabled?: boolean; probe?: string
}) {
  return (
    <button type="button" className="bv-z bv-recht" role="switch" aria-checked={an} disabled={disabled} data-probe={probe} onClick={() => onChange(!an)}>
      <span className="bv-tx"><b>{titel}</b>{unter && <small>{unter}</small>}</span>
      <span className="bv-schalter" aria-hidden="true" />
    </button>
  )
}

/** Hinweis „Keine Alarmierung“ (an jeder Einstellungsstelle, auch ohne Unterstützung). */
export function KeineAlarmierung({ text }: { text: string }) {
  const rest = text.replace(/^Keine Alarmierung\.\s*/, '')
  return (
    <div className="bv-notiz pu-alarm" role="note" data-probe="push-keine-alarmierung">
      <b>Keine Alarmierung</b>
      <p>{rest}</p>
    </div>
  )
}
