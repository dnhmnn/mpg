// Unter den Häkchen: welche Rechte andere mitbringen (lib/verknuepfung.ts).

import { mitgebracht, type Verknuepfungen } from '../lib/verknuepfung'

/** "Lager → Dateien & Schreibstube, MPG & Einstellungen, Vorgänge" je Recht mit Verknüpfung. */
export function verknuepfungZeilen(rechte: { key: string; label: string }[], v: Verknuepfungen, org: unknown): string[] {
  const name = (k: string) => rechte.find((r) => r.key === k)?.label ?? k
  return rechte
    .map((r) => ({ r, mit: mitgebracht(r.key, v, org) }))
    .filter((x) => x.mit.length)
    .map((x) => `${x.r.label} → ${x.mit.map(name).join(', ')}`)
}

export default function VerknuepfungHinweis({ rechte, v, org }: { rechte: { key: string; label: string }[]; v: Verknuepfungen; org: unknown }) {
  const zeilen = verknuepfungZeilen(rechte, v, org)
  if (!zeilen.length) return null
  return (
    <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 6, lineHeight: 1.45 }}>
      Wird mit angehakt: {zeilen.join(' · ')}
    </div>
  )
}
